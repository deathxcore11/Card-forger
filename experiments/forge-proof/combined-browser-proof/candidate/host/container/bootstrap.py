#!/usr/bin/env python3
"""Single-use private exact-input transport; no game, catalog, auth or deck model.

Only the host's internal allocation capability authorizes initialization. Input is
stored unchanged in a private directory this process creates; the real Java adapter
validates it.
The reviewed gateway enforces the exact-capable immutable adapter manifest before
launch, so this cannot turn an old alias-only image into a purported exact match.
"""
import errno
import hmac
import http.server
import json
import os
import pathlib
import socket
import sys
import tempfile
import time

INPUT_NAME = 'match-input.json'
# Where one match's private files may live, in order: the image's own directory,
# then the standard writable locations. The container platform does not always let
# the process write the image's directory (a live start was refused there).
RUNTIME_PARENTS = ('/run/cardstashy', '/tmp', '/dev/shm', '/var/tmp')
GATEWAY = '/opt/host001/gateway.py'
MAX_BYTES = 262144
BOOT_DEADLINE = 120

def private_root(parents=RUNTIME_PARENTS):
    """A new 0700 directory owned by this process for one match's files, in the first
    location that allows it. If none does, a fixed code naming the first refusal and
    this process's user, never a path."""
    first = None
    for parent in parents:
        try:
            return pathlib.Path(tempfile.mkdtemp(prefix='cardstashy-', dir=parent))
        except OSError as failure:
            first = first or failure
    name = errno.errorcode.get(getattr(first, 'errno', None), 'unknown').lower()
    return 'runtime_root_unavailable_' + name + '_u' + str(os.geteuid())

def request_body(handler, maximum, deadline):
    """One bounded request body. The container runtime may forward a body of known size
    chunked, or repeat its length header; either way it is the same bytes. Returns the
    body, or (status, code) for a malformed or oversized one. Raises TimeoutError."""
    def wait():
        remaining = deadline - time.monotonic()
        if remaining <= 0: raise TimeoutError()
        handler.connection.settimeout(remaining)
    def exactly(size):
        data = bytearray()
        while len(data) < size:
            wait()
            part = handler.rfile.read1(min(65536, size - len(data)))
            if not part: raise ValueError('short_body')
            data.extend(part)
        return bytes(data)
    def line():
        wait()
        value = handler.rfile.readline(1026)
        if not value.endswith(b'\r\n'): raise ValueError('malformed_chunk')
        return value[:-2]
    codings = [v.strip().lower() for raw in handler.headers.get_all('Transfer-Encoding', []) for v in raw.split(',') if v.strip()]
    if codings:
        if codings != ['chunked']: return 400, 'unsupported_transfer_encoding'
        data = bytearray()
        while True:
            size = line().split(b';', 1)[0].strip()
            if not 0 < len(size) <= 8 or any(c not in b'0123456789abcdefABCDEF' for c in size): raise ValueError('malformed_chunk')
            size = int(size, 16)
            if size == 0: break
            if len(data) + size > maximum: return 413, 'body_too_large'
            data.extend(exactly(size))
            if exactly(2) != b'\r\n': raise ValueError('malformed_chunk')
        while line(): pass  # trailers carry nothing this service reads
        if not data: return 400, 'empty_body'
        return bytes(data)
    lengths = [v.strip() for raw in handler.headers.get_all('Content-Length', []) for v in raw.split(',')]
    if not lengths: return 411, 'content_length_required'
    if len(set(lengths)) != 1 or not lengths[0].isascii() or not lengths[0].isdigit(): return 400, 'content_length_invalid'
    if not 0 < int(lengths[0]) <= maximum: return 413, 'body_too_large'
    return exactly(int(lengths[0]))

class BootstrapServer(http.server.HTTPServer):
    allow_reuse_address = True
    def __init__(self, address, token, input_path, unavailable=None):
        super().__init__(address, BootstrapHandler)
        self.token = token
        self.input_path = input_path
        self.unavailable = unavailable
        self.accepted = False
        self.deadline = time.monotonic() + BOOT_DEADLINE
        self.timeout = 0.5

class BootstrapHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.0'
    def log_message(self, *_args):
        pass
    def setup(self):
        super().setup()
        self.connection.settimeout(5)
    def reply(self, status, value=None):
        body = b'' if value is None else json.dumps(value, separators=(',', ':')).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        # Every reply ends its connection. Said aloud, because a platform client that
        # assumes keep-alive would otherwise send the next request into a closed socket.
        self.send_header('Connection', 'close')
        self.end_headers()
        if body:
            self.wfile.write(body)
        self.wfile.flush()
    def allowed(self):
        return (len(self.headers.get_all('Authorization', [])) == 1
                and hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + self.server.token))
    def do_GET(self):
        if not self.allowed(): return self.reply(401)
        if self.path != '/bootstrap-ready': return self.reply(404)
        return self.reply(200, {'protocol': 'cardstashy.match-input.v1'})
    def do_POST(self):
        if not self.allowed(): return self.reply(401, {'error': 'internal_authorization_required'})
        if self.path != '/initialize': return self.reply(404, {'error': 'route_not_found'})
        if self.server.accepted: return self.reply(409, {'error': 'already_initialized'})
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json': return self.reply(415, {'error': 'json_required'})
        try:
            # Wall-clock cap, not just idle socket timeout: no slow-drip bootstrap.
            data = request_body(self, MAX_BYTES, min(self.server.deadline, time.monotonic() + 5))
            if isinstance(data, tuple): return self.reply(data[0], {'error': data[1]})
            body = json.loads(data.decode('utf-8'))
            if not isinstance(body, dict) or set(body) != {'input'} or not isinstance(body['input'], dict): return self.reply(400, {'error': 'input_object_required'})
            # The body is read first, so the refusal is not lost to a reset connection.
            if self.server.input_path is None: return self.reply(503, {'error': self.server.unavailable})
            # Native owns snapshot interpretation. Never split commanders, alter
            # printings, or substitute defaults here. Exclusive write forbids reuse.
            fd = os.open(self.server.input_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as output:
                output.write(data)
                output.flush()
                os.fsync(output.fileno())
            self.server.accepted = True
            self.reply(204)
        except (TimeoutError, socket.timeout): self.reply(408, {'error': 'body_timeout'})
        except FileExistsError: self.reply(400, {'error': 'input_already_present'})
        except (ValueError, UnicodeError): self.reply(400, {'error': 'malformed_body'})
        # Only the error class: never a path, input or capability.
        except OSError as failure: self.reply(503, {'error': 'input_write_failed_' + type(failure).__name__.lower()})
    def do_DELETE(self): self.reply(405)
    def do_PUT(self): self.reply(405)

def main():
    token = os.environ.get('HOST_INTERNAL_TOKEN', '')
    if len(token) < 32 or any(ord(c) < 33 or ord(c) > 126 for c in token):
        raise SystemExit('BOOTSTRAP_EXIT invalid_internal_capability')
    try:
        remaining = (int(os.environ.get('HOST_ABSOLUTE_DEADLINE_MS', '')) - time.time() * 1000) / 1000
    except ValueError:
        raise SystemExit('BOOTSTRAP_EXIT invalid_absolute_deadline')
    if not 0 < remaining <= 7200:
        raise SystemExit('BOOTSTRAP_EXIT invalid_absolute_deadline')
    # A fresh directory cannot already hold input; if no location allows one, the
    # launcher still answers so the host can show why initialization was refused.
    root = private_root()
    unavailable = root if isinstance(root, str) else None
    server = BootstrapServer(('0.0.0.0', 8080), token, None if unavailable else root / INPUT_NAME, unavailable)
    server.deadline = min(server.deadline, time.monotonic() + remaining)
    try:
        while not server.accepted and time.monotonic() < server.deadline:
            server.handle_request()
    finally:
        server.server_close()
    if not server.accepted:
        raise SystemExit('BOOTSTRAP_EXIT initialization_timeout')
    os.environ['HOST_RUNTIME_ROOT'] = str(root)
    os.environ['HOST_MATCH_INPUT_PATH'] = str(root / INPUT_NAME)
    # The engine's working directory is its own private directory, as it was when
    # that directory was the image's /run/cardstashy.
    os.chdir(root)
    os.execv(sys.executable, [sys.executable, GATEWAY])

if __name__ == '__main__':
    main()
