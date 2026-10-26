#!/usr/bin/env python3
"""Single-use private exact-input transport; no game, catalog, auth or deck model.

Only the host's internal allocation capability authorizes initialization. Input is
stored unchanged at a fixed server-owned path; the real Java adapter validates it.
The reviewed gateway enforces the exact-capable immutable adapter manifest before
launch, so this cannot turn an old alias-only image into a purported exact match.
"""
import hmac
import http.server
import json
import os
import pathlib
import socket
import sys
import time

INPUT_PATH = pathlib.Path('/run/cardstashy/match-input.json')
GATEWAY = '/opt/host001/gateway.py'
MAX_BYTES = 262144
BOOT_DEADLINE = 120

class BootstrapServer(http.server.HTTPServer):
    allow_reuse_address = True
    def __init__(self, address, token, input_path=INPUT_PATH):
        super().__init__(address, BootstrapHandler)
        self.token = token
        self.input_path = input_path
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
        if not self.allowed(): return self.reply(401)
        if self.path != '/initialize': return self.reply(404)
        if self.server.accepted: return self.reply(409)
        if self.headers.get('Transfer-Encoding') is not None: return self.reply(400)
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not lengths[0].isdigit(): return self.reply(411)
        length = int(lengths[0])
        if not 0 < length <= MAX_BYTES: return self.reply(413)
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json': return self.reply(415)
        try:
            # Wall-clock cap, not just idle socket timeout: no slow-drip bootstrap.
            deadline = min(self.server.deadline, time.monotonic() + 5)
            self.connection.settimeout(max(0.001, deadline - time.monotonic()))
            data = bytearray()
            while len(data) < length:
                remaining = deadline - time.monotonic()
                if remaining <= 0: raise TimeoutError()
                self.connection.settimeout(remaining)
                part = self.rfile.read1(min(65536, length - len(data)))
                if not part: raise ValueError('short_body')
                data.extend(part)
            body = json.loads(data.decode('utf-8'))
            if not isinstance(body, dict) or set(body) != {'input'} or not isinstance(body['input'], dict): return self.reply(400)
            # Native owns snapshot interpretation. Never split commanders, alter
            # printings, or substitute defaults here. Exclusive write forbids reuse.
            fd = os.open(self.server.input_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as output:
                output.write(data)
                output.flush()
                os.fsync(output.fileno())
            self.server.accepted = True
            self.reply(204)
        except (TimeoutError, socket.timeout): self.reply(408)
        except (ValueError, UnicodeError, FileExistsError): self.reply(400)
        except OSError: self.reply(503)
    def do_DELETE(self): self.reply(405)
    def do_PUT(self): self.reply(405)

def main():
    token = os.environ.get('HOST_INTERNAL_TOKEN', '')
    if len(token) < 32 or any(ord(c) < 33 or ord(c) > 126 for c in token):
        raise SystemExit('BOOTSTRAP_EXIT invalid_internal_capability')
    if INPUT_PATH.exists() or not INPUT_PATH.parent.is_dir():
        raise SystemExit('BOOTSTRAP_EXIT invalid_private_input_path')
    try:
        remaining = (int(os.environ.get('HOST_ABSOLUTE_DEADLINE_MS', '')) - time.time() * 1000) / 1000
    except ValueError:
        raise SystemExit('BOOTSTRAP_EXIT invalid_absolute_deadline')
    if not 0 < remaining <= 7200:
        raise SystemExit('BOOTSTRAP_EXIT invalid_absolute_deadline')
    server = BootstrapServer(('0.0.0.0', 8080), token)
    server.deadline = min(server.deadline, time.monotonic() + remaining)
    try:
        while not server.accepted and time.monotonic() < server.deadline:
            server.handle_request()
    finally:
        server.server_close()
    if not server.accepted:
        raise SystemExit('BOOTSTRAP_EXIT initialization_timeout')
    os.environ['HOST_MATCH_INPUT_PATH'] = str(INPUT_PATH)
    os.execv(sys.executable, [sys.executable, GATEWAY])

if __name__ == '__main__':
    main()
