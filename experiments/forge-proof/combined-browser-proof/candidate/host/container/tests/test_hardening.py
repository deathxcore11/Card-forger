# SPDX-License-Identifier: GPL-3.0-or-later
"""Real socket/process regressions; no rules engine or account credentials."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import http.client
import importlib.util
import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("hardening_gateway", HERE / "gateway.py")
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)
TOKEN = "synthetic-internal-fixture-only-not-a-service-secret"


class NativeFixture(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.server.calls += 1
        body = b'{"status":"running"}'
        head = b"HTTP/1.0 200 OK\r\nContent-Length: " + str(len(body)).encode() + b"\r\n\r\n"
        try:
            if self.server.mode == "slow_headers":
                for value in head:
                    self.connection.sendall(bytes([value]))
                    if self.server.stopping.wait(0.03):
                        return
            else:
                self.connection.sendall(head)
            if self.server.mode == "slow_body":
                for value in body:
                    self.connection.sendall(bytes([value]))
                    if self.server.stopping.wait(0.03):
                        return
            else:
                self.connection.sendall(body)
        except OSError:
            pass

    do_POST = do_GET


class DeadlineTests(unittest.TestCase):
    def setUp(self):
        self.native = ThreadingHTTPServer(("127.0.0.1", 0), NativeFixture)
        self.native.daemon_threads = True
        self.native.mode = "fast"
        self.native.calls = 0
        self.native.stopping = threading.Event()
        self.native_thread = threading.Thread(target=lambda: self.native.serve_forever(poll_interval=0.01), daemon=True)
        self.native_thread.start()
        self.bridge = gateway.Bridge("synthetic-native-fixture", TOKEN, self.native.server_port)
        self.proxy = gateway.Server(("127.0.0.1", 0), self.bridge)
        self.proxy_thread = threading.Thread(target=lambda: self.proxy.serve_forever(poll_interval=0.01), daemon=True)
        self.proxy_thread.start()
        self.clients = []
        self.addCleanup(self.clean)

    def clean(self):
        for client in self.clients:
            client.close()
        self.native.stopping.set()
        for server, thread in ((self.proxy, self.proxy_thread), (self.native, self.native_thread)):
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

    def state(self):
        client = http.client.HTTPConnection("127.0.0.1", self.proxy.server_port, timeout=1)
        try:
            client.request("GET", "/state", headers={"Authorization": "Bearer " + TOKEN})
            response = client.getresponse()
            response.read()
            return response.status
        finally:
            client.close()

    def assert_slots_recovered(self):
        deadline = time.monotonic() + 1
        while self.proxy.slots._value != 8 and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertEqual(self.proxy.slots._value, 8)
        self.assertEqual(self.state(), 200)

    def test_upstream_trickle_headers_cannot_extend_total_deadline(self):
        self.native.mode = "slow_headers"
        with patch.object(gateway, "UPSTREAM_TIMEOUT", 0.2):
            started = time.monotonic()
            with self.assertRaises((OSError, ValueError, http.client.HTTPException)):
                self.bridge.forward("GET", "/state")
            self.assertLess(time.monotonic() - started, 0.65)

    def test_upstream_trickle_body_cannot_extend_total_deadline(self):
        self.native.mode = "slow_body"
        with patch.object(gateway, "UPSTREAM_TIMEOUT", 0.2):
            started = time.monotonic()
            with self.assertRaises((OSError, ValueError, http.client.HTTPException)):
                self.bridge.forward("GET", "/state")
            self.assertLess(time.monotonic() - started, 0.65)

    def test_inbound_remaining_budget_limits_upstream_request(self):
        self.native.mode = "slow_body"
        with patch.object(gateway, "UPSTREAM_TIMEOUT", 1):
            started = time.monotonic()
            with self.assertRaises((OSError, ValueError, http.client.HTTPException)):
                self.bridge.forward("GET", "/state", deadline=started + 0.15)
            self.assertLess(time.monotonic() - started, 0.5)

    def test_expired_request_never_contacts_native(self):
        with self.assertRaises(TimeoutError):
            self.bridge.forward("POST", "/action", b"{}", deadline=time.monotonic() - 1)
        self.assertEqual(self.native.calls, 0)

    def test_eight_unauthorized_trickle_headers_release_all_slots(self):
        with patch.object(gateway, "REQUEST_TIMEOUT", 0.25):
            for _ in range(8):
                client = socket.create_connection(("127.0.0.1", self.proxy.server_port), timeout=1)
                client.sendall(b"GET /state HTTP/1.1\r\nX-Trickle: ")
                self.clients.append(client)
            until = time.monotonic() + 0.15
            while self.proxy.slots._value and time.monotonic() < until:
                time.sleep(0.005)
            self.assertEqual(self.proxy.slots._value, 0)
            for _ in range(12):
                for client in self.clients:
                    try:
                        client.sendall(b"x")
                    except OSError:
                        pass
                time.sleep(0.03)
            self.assertEqual(self.native.calls, 0)
            self.assert_slots_recovered()

    def test_authorized_trickle_body_is_not_submitted_and_slot_recovers(self):
        with patch.object(gateway, "REQUEST_TIMEOUT", 0.2):
            client = socket.create_connection(("127.0.0.1", self.proxy.server_port), timeout=1)
            self.clients.append(client)
            headers = ("POST /action HTTP/1.1\r\nAuthorization: Bearer " + TOKEN
                       + "\r\nX-Expected-Host-Epoch: " + self.bridge.epoch
                       + "\r\nContent-Type: application/json\r\nContent-Length: 50\r\n\r\n")
            client.sendall(headers.encode())
            for _ in range(10):
                try:
                    client.sendall(b" ")
                except OSError:
                    pass
                time.sleep(0.03)
            self.assertEqual(self.native.calls, 0)
            self.assert_slots_recovered()


@unittest.skipUnless(sys.platform.startswith("linux"), "Container target is Linux")
class DescendantTests(unittest.TestCase):
    def check_descendants(self, leader_exits):
        # A separate test supervisor is a subreaper, so no orphan test zombies
        # are left for the executor's PID 1. Production PID 1 adopts naturally.
        code = r'''
import ctypes, importlib.util, json, os, signal, subprocess, sys, time
libc = ctypes.CDLL(None, use_errno=True)
assert libc.prctl(36, 1, 0, 0, 0) == 0
spec = importlib.util.spec_from_file_location("gateway", sys.argv[1])
gateway = importlib.util.module_from_spec(spec); spec.loader.exec_module(gateway)
descendant = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); print('ready',flush=True); time.sleep(30)"
leader_code = "import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c'," + repr(descendant) + "],stdout=subprocess.PIPE,text=True); p.stdout.readline(); print(p.pid,flush=True); " + ("pass" if sys.argv[2] == "yes" else "time.sleep(30)")
leader = subprocess.Popen([sys.executable, '-c', leader_code], stdout=subprocess.PIPE, text=True, start_new_session=True)
child_pid = int(leader.stdout.readline())
try:
    if sys.argv[2] == "yes": leader.wait(timeout=2)
    gateway.terminate(leader, grace=0.1, kill_grace=1)
    assert leader.poll() is not None
    assert not gateway.group_alive(leader.pid)
    try: os.kill(child_pid, 0)
    except ProcessLookupError: pass
    else: raise AssertionError("descendant not reaped")
    print("group terminated and descendant reaped")
finally:
    try: os.killpg(leader.pid, signal.SIGKILL)
    except ProcessLookupError: pass
    leader.wait(timeout=2)
    leader.stdout.close()
    until = time.monotonic() + 2
    while time.monotonic() < until:
        try:
            if os.waitpid(-1, os.WNOHANG)[0] == 0: time.sleep(0.01)
        except ChildProcessError: break
'''
        result = subprocess.run([sys.executable, "-c", code, str(HERE / "gateway.py"), "yes" if leader_exits else "no"],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("descendant reaped", result.stdout)

    def test_term_resistant_descendant_is_killed_after_leader_exits(self):
        self.check_descendants(False)

    def test_already_exited_leader_does_not_skip_descendant_cleanup(self):
        self.check_descendants(True)


class WatchdogTests(unittest.TestCase):
    def test_expiry_stops_process_even_while_readiness_probe_is_blocked(self):
        with tempfile.TemporaryDirectory(prefix="host001-watchdog-") as directory:
            root = Path(directory)
            release = threading.Event()
            probing = threading.Event()
            children = []
            monitors = []
            original_bridge, original_server, original_monitor = gateway.Bridge, gateway.Server, gateway.ProbeMonitor

            class BlockedBridge(original_bridge):
                def ready(self, **_kwargs):
                    probing.set()
                    release.wait(5)
                    return True

            def launch(actual_root):
                child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"], start_new_session=True)
                children.append(child)
                (actual_root / "adapter/connection.json").write_text('{"token":"synthetic-native-fixture"}')
                return child

            def monitor(*args):
                result = original_monitor(*args)
                monitors.append(result)
                return result

            try:
                with patch.object(gateway, "Path", lambda p: root if str(p) == "/run/cardstashy" else Path(p)), \
                     patch.object(gateway, "launch", launch), \
                     patch.object(gateway, "Bridge", BlockedBridge), \
                     patch.object(gateway, "ProbeMonitor", monitor), \
                     patch.object(gateway, "Server", lambda _address, bridge: original_server(("127.0.0.1", 0), bridge)), \
                     patch.object(gateway.signal, "signal"), \
                     patch.object(gateway, "expiry_reason", lambda started, _activity, _terminal, now: "hard_lifetime" if now - started >= 0.1 else None), \
                     patch.dict(os.environ, {"HOST_INTERNAL_TOKEN": TOKEN}):
                    started = time.monotonic()
                    gateway.main()
                    self.assertLess(time.monotonic() - started, 1.5)
                self.assertTrue(probing.is_set())
                self.assertIsNotNone(children[0].poll())
                self.assertFalse((root / "adapter/connection.json").exists())
            finally:
                release.set()
                for item in monitors:
                    item.join(timeout=1)
                for child in children:
                    if child.poll() is None:
                        child.kill()
                        child.wait()


if __name__ == "__main__":
    unittest.main()
