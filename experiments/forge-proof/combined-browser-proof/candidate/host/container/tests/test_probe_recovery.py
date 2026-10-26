# SPDX-License-Identifier: GPL-3.0-or-later
"""Actual HTTP/process supervision fixtures, not a native rules simulation."""
from contextlib import ExitStack
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import importlib.util
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("probe_gateway", HERE / "gateway.py")
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)


class ProbeFixture(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.server.calls += 1
        ready = not self.server.fail_first and (self.server.calls == 1 or self.server.recovered)
        body = b'{"status":"running"}' if ready else b'{"error":"temporary_read_failure"}'
        self.send_response(200 if ready else 503)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        if ready:
            self.server.first_ready.set()


class ProbeRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="host001-probe-recovery-")
        self.root = Path(self.temp.name)
        self.native = ThreadingHTTPServer(("127.0.0.1", 0), ProbeFixture)
        self.native.daemon_threads = True
        self.native.calls = 0
        self.native.fail_first = False
        self.native.recovered = False
        self.native.first_ready = threading.Event()
        self.native_thread = threading.Thread(target=lambda: self.native.serve_forever(poll_interval=0.01), daemon=True)
        self.native_thread.start()
        self.children, self.probes = [], []
        self.activity_age = 0
        self.addCleanup(self.clean)

    def clean(self):
        for probe in self.probes:
            probe.stopping.set()
            probe.join(timeout=1)
        for child in self.children:
            if child.poll() is None:
                gateway.terminate(child, grace=0.1)
        self.native.shutdown()
        self.native.server_close()
        self.native_thread.join(timeout=1)
        self.temp.cleanup()

    def context(self, interval=0.02):
        stack = ExitStack()
        original_bridge, original_server, original_probe = gateway.Bridge, gateway.Server, gateway.ProbeMonitor

        def launch(root):
            child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"], start_new_session=True)
            self.children.append(child)
            (root / "adapter/connection.json").write_text('{"token":"synthetic-native-fixture"}')
            return child

        def bridge(native, internal):
            result = original_bridge(native, internal, self.native.server_port)
            result.last_activity -= self.activity_age
            return result

        def monitor(*args):
            result = original_probe(*args)
            self.probes.append(result)
            return result

        for item in (
            patch.object(gateway, "Path", lambda p: self.root if str(p) == "/run/cardstashy" else Path(p)),
            patch.object(gateway, "launch", launch), patch.object(gateway, "Bridge", bridge),
            patch.object(gateway, "Server", lambda _address, b: original_server(("127.0.0.1", 0), b)),
            patch.object(gateway, "ProbeMonitor", monitor), patch.object(gateway.signal, "signal"),
            patch.object(gateway, "STARTUP_TIMEOUT", 0.1), patch.object(gateway, "PROBE_INTERVAL", interval),
            patch.dict(os.environ, {"HOST_INTERNAL_TOKEN": "synthetic-probe-fixture-not-a-service-secret"}),
        ):
            stack.enter_context(item)
        return stack

    def test_three_failed_probes_after_readiness_recover_without_killing_child(self):
        failures = []

        def observe():
            try:
                self.assertTrue(self.native.first_ready.wait(1))
                time.sleep(0.35)  # Past the shortened startup deadline and >3 probes.
                self.assertTrue(self.probes[0].seen_ready())
                self.assertGreaterEqual(self.probes[0].failed(), 3)
                self.assertIsNone(self.children[0].poll())
                self.native.recovered = True
                until = time.monotonic() + 1
                while self.probes[0].failed() and time.monotonic() < until:
                    time.sleep(0.01)
                self.assertEqual(self.probes[0].failed(), 0)
                self.assertIsNone(self.children[0].poll())
            except BaseException as error:
                failures.append(error)
            finally:
                if self.probes:
                    self.probes[0].stopping.set()

        observer = threading.Thread(target=observe, daemon=True)
        with self.context():
            observer.start()
            try:
                gateway.main()
            finally:
                observer.join(timeout=2)
        if failures:
            raise failures[0]
        self.assertIsNotNone(self.children[0].poll())
        self.assertFalse((self.root / "adapter/connection.json").exists())

    def test_persistently_unresponsive_running_process_still_expires_on_idle_deadline(self):
        self.activity_age = 599.6  # Exercise the actual 600-second idle rule.
        with self.context():
            started = time.monotonic()
            gateway.main()
            elapsed = time.monotonic() - started
        self.assertGreaterEqual(elapsed, 0.4)
        self.assertLess(elapsed, 2)
        self.assertTrue(self.probes[0].seen_ready())
        self.assertGreaterEqual(self.probes[0].failed(), 3)
        self.assertIsNotNone(self.children[0].poll())
        self.assertFalse((self.root / "adapter/connection.json").exists())

    def test_never_ready_process_stops_at_startup_deadline_without_waiting_three_failures(self):
        self.native.fail_first = True
        with self.context(interval=5):
            started = time.monotonic()
            with self.assertRaisesRegex(RuntimeError, "startup deadline"):
                gateway.main()
            self.assertLess(time.monotonic() - started, 1.5)
        self.assertFalse(self.probes[0].seen_ready())
        self.assertEqual(self.probes[0].failed(), 1)
        self.assertIsNotNone(self.children[0].poll())
        self.assertFalse((self.root / "adapter/connection.json").exists())


if __name__ == "__main__":
    unittest.main()
