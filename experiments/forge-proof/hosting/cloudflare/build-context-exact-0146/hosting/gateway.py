#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Internal, one-match container boundary. NOT account/seat authorization.

The future authorized Worker supplies HOST_INTERNAL_TOKEN server-to-server.
The frozen Java loopback capability is never returned to callers. No endpoint
creates matches, changes decks, chooses rules actions, or restarts a lost game.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hmac
import hashlib
import http.client
import json
import os
import signal
import socket
import subprocess
import threading
import time
import uuid

NATIVE_PORT = 8765
MAX_BODY = 16384  # Match the frozen adapter's native request bound.
MAX_RESPONSE = 4 * 1024 * 1024
REQUEST_TIMEOUT = 5
UPSTREAM_TIMEOUT = 5
STARTUP_TIMEOUT = 120
PROBE_INTERVAL = 5
ALIASES = {"calling-all-angels", "keen-engineering", "reign-of-dragons"}
EXACT_INPUT_PATH = "/run/cardstashy/match-input.json"
EXACT_CAPABILITY = "cardstashy.match-input.v1"
ADAPTER_MANIFEST_PATH = "experiments/forge-proof/native/adapter/src/cardstashy/forge/ForgeHttpBridge.java"
FROZEN_0018_SHA256 = "77169ebedd4121ec655ee3aa2f77793bed016fff9068288b789ce27441c942e5"



def interrupt_socket(sock):
    # shutdown interrupts buffered makefile reads too; close alone does not.
    try:
        sock.shutdown(socket.SHUT_RDWR)
    except OSError:
        pass


class Bridge:
    def __init__(self, native_token, internal_token, port=NATIVE_PORT):
        self.native_token = native_token
        self.internal_token = internal_token
        self.port = port
        self.epoch = str(uuid.uuid4())  # Process identity, not an access credential.
        self.last_activity = time.monotonic()
        self.terminal_seen = None

    def forward(self, method, path, body=None, *, deadline=None):
        deadline = min(time.monotonic() + UPSTREAM_TIMEOUT,
                       deadline if deadline is not None else float("inf"))
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("native_request_deadline")
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=remaining)
        timer = None
        response = None
        try:
            conn.connect()
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("native_request_deadline")
            # Retain the socket: getresponse may detach it for HTTP/1.0 while
            # the response's buffered file still owns a reference.
            conn.sock.settimeout(remaining)
            timer = threading.Timer(remaining, interrupt_socket, (conn.sock,))
            timer.daemon = True
            timer.start()
            conn.request(method, path, body=body, headers={
                "Authorization": "Bearer " + self.native_token,
                "Content-Type": "application/json",
            })
            response = conn.getresponse()
            data = response.read(MAX_RESPONSE + 1)
            if time.monotonic() >= deadline:
                raise TimeoutError("native_request_deadline")
            if len(data) > MAX_RESPONSE:
                raise ValueError("native_response_limit")
            if path == "/state" and response.status == 200:
                state = json.loads(data)
                if state.get("status") in ("finished", "failed") and self.terminal_seen is None:
                    self.terminal_seen = time.monotonic()
            return response.status, data
        finally:
            if timer is not None:
                timer.cancel()
            if response is not None:
                response.close()
            conn.close()

    def ready(self, *, deadline=None):
        try:
            status, data = self.forward("GET", "/state", deadline=deadline)
            return status == 200 and json.loads(data).get("status") in ("running", "finished")
        except (OSError, ValueError, http.client.HTTPException):
            return False


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, bridge):
        self.bridge = bridge
        self.slots = threading.BoundedSemaphore(8)
        self.request_context = threading.local()
        super().__init__(address, Handler)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        self.request_context.deadline = time.monotonic() + REQUEST_TIMEOUT
        timer = threading.Timer(REQUEST_TIMEOUT, interrupt_socket, (request,))
        timer.daemon = True
        try:
            timer.start()
            super().process_request_thread(request, client_address)
        finally:
            timer.cancel()
            self.slots.release()

    def handle_error(self, request, client_address):
        # Do not serialize requests, native state, capabilities or deck contents.
        pass


class Handler(BaseHTTPRequestHandler):
    server_version = "HOST001"
    sys_version = ""
    protocol_version = "HTTP/1.0"

    def setup(self):
        super().setup()
        self.request_deadline = self.server.request_context.deadline
        self.connection.settimeout(max(0.001, self.request_deadline - time.monotonic()))

    def log_message(self, *_args):
        pass

    def result(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Host-Epoch", self.server.bridge.epoch)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def error(self, status, code):
        self.result(status, json.dumps({"error": code}).encode())

    def route(self):
        bridge = self.server.bridge
        if self.command == "GET" and self.path == "/ready":
            self.result(200 if bridge.ready(deadline=self.request_deadline) else 503, b'{"service":"forge-host001"}')
            return
        auth = self.headers.get_all("Authorization", [])
        expected = ("Bearer " + bridge.internal_token).encode()
        if len(auth) != 1 or not hmac.compare_digest(auth[0].encode(), expected):
            self.error(401, "internal_authorization_required")
            return
        if self.path not in ("/state", "/action"):
            self.error(404, "route_not_found")
            return
        if (self.path, self.command) not in (("/state", "GET"), ("/action", "POST")):
            self.error(405, "method_not_allowed")
            return
        body = None
        if self.command == "POST":
            epochs = self.headers.get_all("X-Expected-Host-Epoch", [])
            if len(epochs) != 1 or epochs[0] != bridge.epoch:
                self.error(409, "native_generation_mismatch")
                return
            lengths = self.headers.get_all("Content-Length", [])
            if self.headers.get("Transfer-Encoding") or len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit():
                self.error(400, "explicit_content_length_required")
                return
            size = int(lengths[0])
            if size > MAX_BODY:
                self.error(413, "body_too_large")
                return
            if self.headers.get_content_type() != "application/json":
                self.error(415, "json_required")
                return
            body = self.rfile.read(size)
            if len(body) != size:
                self.error(400, "incomplete_body")
                return
            try:
                if not isinstance(json.loads(body), dict):
                    raise ValueError()
            except (ValueError, UnicodeError):
                self.error(400, "json_object_required")
                return
        try:
            status, data = bridge.forward(self.command, self.path, body, deadline=self.request_deadline)
            if 200 <= status < 300:
                bridge.last_activity = time.monotonic()
            # Do not forward CORS, Set-Cookie, Location, or arbitrary native headers.
            self.result(status, data)
        except (OSError, ValueError, http.client.HTTPException):
            # Never retry a possibly accepted action automatically.
            self.error(503, "native_unavailable_outcome_unknown")

    do_GET = do_POST = do_PUT = do_DELETE = do_OPTIONS = do_HEAD = route


def group_alive(pgid):
    """Linux runtime: zombies are stopped, even before their parent reaps them."""
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    proc = Path("/proc")
    if not proc.is_dir():
        return True  # Fail closed on a non-Linux/uninspectable runtime.
    uncertain = False
    for entry in proc.iterdir():
        if not entry.name.isdigit():
            continue
        try:
            fields = (entry / "stat").read_text().rpartition(")")[2].split()
            if int(fields[2]) == pgid and fields[0] not in ("Z", "X"):
                return True
        except FileNotFoundError:
            continue
        except (OSError, ValueError, IndexError):
            uncertain = True
    return uncertain


def terminate(process, grace=5, kill_grace=5):
    # launch(start_new_session=True) makes this the exclusively owned pgid.
    # The leader can exit before its descendants; never use poll() as a gate.
    pgid = process.pid
    for sig, duration in ((signal.SIGTERM, grace), (signal.SIGKILL, kill_grace)):
        try:
            os.killpg(pgid, sig)
        except ProcessLookupError:
            process.wait(timeout=kill_grace)
            return
        deadline = time.monotonic() + duration
        while True:
            # Reap our leader first. When PID 1, reap adopted descendants in
            # this group too; never wait for unrelated processes.
            if process.poll() is not None:
                try:
                    while os.waitpid(-pgid, os.WNOHANG)[0]:
                        pass
                except ChildProcessError:
                    pass
            if not group_alive(pgid):
                process.wait(timeout=kill_grace)
                return
            if time.monotonic() >= deadline:
                break
            time.sleep(min(0.05, max(0, deadline - time.monotonic())))
    raise RuntimeError("native_process_group_cleanup_unconfirmed")


class ProbeMonitor(threading.Thread):
    """Readiness must not occupy the independent lifecycle watchdog loop."""
    def __init__(self, bridge, stopping):
        super().__init__(daemon=True)
        self.bridge = bridge
        self.stopping = stopping
        self.lock = threading.Lock()
        self.failures = 0
        self.ever_ready = False

    def failed(self):
        with self.lock:
            return self.failures

    def seen_ready(self):
        with self.lock:
            return self.ever_ready

    def run(self):
        while not self.stopping.is_set():
            started = time.monotonic()
            try:
                ready = self.bridge.ready()
            except Exception:
                ready = False  # Redacted failure; never print native state.
            with self.lock:
                self.ever_ready = self.ever_ready or ready
                self.failures = 0 if ready else self.failures + 1
            self.stopping.wait(max(0, PROBE_INTERVAL - (time.monotonic() - started)))


def expiry_reason(started, last_activity, terminal_seen, now):
    if now - started >= 7200:
        return "hard_lifetime"
    if now - last_activity >= 600:
        return "idle"
    if terminal_seen is not None and now - terminal_seen >= 60:
        return "terminal_retention"
    return None


def exact_lifetime_deadline():
    if "HOST_MATCH_INPUT_PATH" not in os.environ:
        return None
    value = os.environ.get("HOST_ABSOLUTE_DEADLINE_MS", "")
    if not value.isascii() or not value.isdigit() or len(value) > 16:
        raise ValueError("Exact mode requires a server-owned absolute deadline")
    remaining = int(value) / 1000 - time.time()
    if not 0 < remaining <= 7200:
        raise ValueError("Exact deadline must be future and within two hours")
    # Latch once in main: client activity and later wall-clock changes cannot
    # extend the allocation. This is interruption, never a rules outcome.
    return time.monotonic() + remaining


def launch_command(root):
    if "HOST_MATCH_INPUT_PATH" in os.environ:
        exact_lifetime_deadline()
        # The server bootstrap owns this path. No browser-selected filesystem
        # path, runtime capability toggle, or fallback to a precon is allowed.
        if os.environ["HOST_MATCH_INPUT_PATH"] != EXACT_INPUT_PATH:
            raise ValueError("Exact input requires the fixed server-owned path")
        manifest = json.loads(Path("/opt/host001/checkpoint-files.json").read_text())
        capabilities = manifest.get("adapterCapabilities", [])
        expected = manifest.get("sha256", {}).get(ADAPTER_MANIFEST_PATH)
        source = Path("/opt/forge-proof/adapter/src/cardstashy/forge/ForgeHttpBridge.java")
        if (not isinstance(capabilities, list) or EXACT_CAPABILITY not in capabilities
                or expected == FROZEN_0018_SHA256 or not source.is_file() or source.is_symlink()
                or hashlib.sha256(source.read_bytes()).hexdigest() != expected):
            raise ValueError("Reviewed exact-input adapter capability required")
        match_input = Path(EXACT_INPUT_PATH)
        if match_input.is_symlink() or not match_input.is_file() or not 0 < match_input.stat().st_size <= 262144:
            raise ValueError("Require a bounded regular exact-input file")
        deck_arguments = [f"-Dproof.matchInput={EXACT_INPUT_PATH}", "-Dproof.requireExact=true"]
    else:
        human = os.environ.get("HOST_HUMAN_DECK", "calling-all-angels")
        opponent = os.environ.get("HOST_CPU_DECK", "keen-engineering")
        if human not in ALIASES or opponent not in ALIASES:
            raise ValueError("Frozen adapter supports only its three pinned precons")
        deck_arguments = [f"-Dproof.humanDeck={human}", f"-Dproof.aiDeck={opponent}"]
    # Randomize matches by default; explicit seed remains server-owned.
    seed = os.environ.get("HOST_SEED", str(int.from_bytes(os.urandom(7), "big")))
    if not seed.isascii() or not seed.isdigit() or int(seed) > 2**63 - 1:
        raise ValueError("Invalid server seed")
    cp = Path("/opt/forge-proof/runtime-classpath.txt").read_text()
    command = ["java", "-Xms256m", "-Xmx2g", "-Xss512k",
               "-XX:MaxMetaspaceSize=384m", "-XX:CompressedClassSpaceSize=128m",
               "-XX:ReservedCodeCacheSize=128m", "-XX:MaxDirectMemorySize=256m",
               "-XX:ActiveProcessorCount=1", "-XX:+ExitOnOutOfMemoryError",
               "-Djava.awt.headless=true", "-Dsentry.enabled=false",
               f"-Duser.home={root}/home", f"-Djava.io.tmpdir={root}/tmp",
               f"-Dproof.root={root}", f"-Dproof.port={NATIVE_PORT}",
               f"-Dproof.seed={seed}", *deck_arguments, "-Dproof.controlMode=full",
               "-cp", cp, "cardstashy.forge.ForgeHttpBridge"]
    return command


def launch(root):
    command = launch_command(root)
    child_env = {key: value for key, value in os.environ.items()
                 if key not in ("HOST_INTERNAL_TOKEN", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS", "CLASSPATH")}
    # Native stdout can contain private game information. Do not collect it.
    return subprocess.Popen(command, env=child_env, start_new_session=True,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    os.umask(0o077)
    internal_token = os.environ.pop("HOST_INTERNAL_TOKEN", "")
    if len(internal_token) < 32 or not internal_token.isascii() or any(c.isspace() for c in internal_token):
        raise ValueError("Require an injected internal capability of at least 32 ASCII non-space characters")
    root = Path("/run/cardstashy")
    for name in ("adapter", "home", "tmp"):
        (root / name).mkdir(parents=True, exist_ok=True)
    for name in ("forge", "decks"):
        (root / name).symlink_to(Path("/opt/forge-proof") / name)
    connection = root / "adapter/connection.json"
    connection.unlink(missing_ok=True)
    stopping = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopping.set())
    absolute_deadline = exact_lifetime_deadline()
    process = launch(root)
    server = None
    probe = None
    started = time.monotonic()
    try:
        while True:
            if (process.poll() is not None or stopping.is_set() or time.monotonic() - started >= STARTUP_TIMEOUT
                    or (absolute_deadline is not None and time.monotonic() >= absolute_deadline)):
                raise RuntimeError("Native startup failed or exceeded 120 seconds")
            try:
                native = json.loads(connection.read_text())
                if not isinstance(native.get("token"), str) or not native["token"]:
                    raise ValueError("Missing native capability")
                break
            except (FileNotFoundError, ValueError):
                stopping.wait(0.1)
        bridge = Bridge(native["token"], internal_token)
        server = Server(("0.0.0.0", 8080), bridge)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        probe = ProbeMonitor(bridge, stopping)
        probe.start()
        while not stopping.wait(0.25):
            now = time.monotonic()
            if process.poll() is not None:
                raise RuntimeError("Native JVM exited; match is interrupted and cannot resume")
            if not probe.seen_ready() and now - started >= STARTUP_TIMEOUT:
                raise RuntimeError("Native readiness exceeded startup deadline; never silently restart")
            # After demonstrated readiness, observation failures alone do not
            # prove JVM loss. Process exit and independent idle/hard/terminal
            # bounds still interrupt this one instance; nothing restarts it.
            if ((absolute_deadline is not None and now >= absolute_deadline)
                    or expiry_reason(started, bridge.last_activity, bridge.terminal_seen, now)):
                break
    finally:
        stopping.set()
        if server is not None:
            server.shutdown()
            server.server_close()
        try:
            grace = 5 if absolute_deadline is None else min(5, max(0, absolute_deadline - time.monotonic()))
            terminate(process, grace=grace)
        finally:
            connection.unlink(missing_ok=True)
        if probe is not None:
            probe.join(timeout=0.25)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Details/tracebacks can contain private data; use redacted lifecycle only.
        print("HOST001_EXIT startup_or_runtime_failure", flush=True)
        raise SystemExit(1)
