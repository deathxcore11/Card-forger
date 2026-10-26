# SPDX-License-Identifier: GPL-3.0-or-later
"""Transport fixtures only. These tests do not simulate or certify Magic rules."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import http.client
import importlib.util
import json
import socket
import tempfile
import threading
import unittest

HERE = Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


gateway = module("gateway", "gateway.py")
prepare = module("prepare", "prepare_context.py")
INTERNAL = "transport-fixture-only-not-a-service-secret"
NATIVE = "native-fixture-only-not-a-service-secret"


class NativeFixture(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def request(self):
        size = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(size)
        self.server.calls.append((self.command, self.path, dict(self.headers), body))
        self.send_response(self.server.status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "https://untrusted.invalid")
        self.send_header("Set-Cookie", "do-not-forward=1")
        self.end_headers()
        self.wfile.write(self.server.body)

    do_GET = do_POST = request


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.native = ThreadingHTTPServer(("127.0.0.1", 0), NativeFixture)
        cls.bridge = gateway.Bridge(NATIVE, INTERNAL, cls.native.server_port)
        cls.proxy = gateway.Server(("127.0.0.1", 0), cls.bridge)
        for server in (cls.native, cls.proxy):
            threading.Thread(target=lambda s=server: s.serve_forever(poll_interval=0.01), daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        for server in (cls.proxy, cls.native):
            server.shutdown()
            server.server_close()

    def setUp(self):
        self.native.calls = []
        self.native.status = 200
        self.native.body = b'{"status":"running","revision":7,"fixture":true}'
        self.bridge.terminal_seen = None

    def request(self, method="GET", path="/state", body=None, headers=None, authorized=True):
        actual_headers = {"Authorization": "Bearer " + INTERNAL} if authorized else {}
        if method == "POST":
            actual_headers["X-Expected-Host-Epoch"] = self.bridge.epoch
        actual_headers.update(headers or {})
        conn = http.client.HTTPConnection("127.0.0.1", self.proxy.server_port, timeout=2)
        try:
            conn.request(method, path, body=body, headers=actual_headers)
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def test_unauthenticated_request_never_contacts_native(self):
        self.assertEqual(self.request(authorized=False)[0], 401)
        self.assertEqual(self.native.calls, [])

    def test_wrong_capability_never_contacts_native(self):
        self.assertEqual(self.request(headers={"Authorization": "Bearer wrong"})[0], 401)
        self.assertEqual(self.native.calls, [])

    def test_native_capability_is_not_gateway_authorization(self):
        self.assertEqual(self.request(headers={"Authorization": "Bearer " + NATIVE})[0], 401)

    def test_state_uses_native_capability_and_no_client_cookie(self):
        status, headers, body = self.request(headers={"Cookie": "private=do-not-forward", "Origin": "https://untrusted.invalid"})
        self.assertEqual(status, 200)
        self.assertEqual(body, self.native.body)
        self.assertEqual(self.native.calls[0][2]["Authorization"], "Bearer " + NATIVE)
        self.assertNotIn("Cookie", self.native.calls[0][2])
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertNotIn("Set-Cookie", headers)
        self.assertNotIn(NATIVE.encode(), body)

    def test_command_is_forwarded_byte_for_byte(self):
        body = b'{"revision":7,"op":"reply","promptId":3,"indexes":[2,0]}'
        self.native.status = 202
        self.native.body = b'{"accepted":true}'
        self.assertEqual(self.request("POST", "/action", body, {"Content-Type": "application/json"})[0], 202)
        self.assertEqual(self.native.calls[0][3], body)

    def test_wrong_or_missing_epoch_never_submits_to_replacement_native(self):
        for epoch in ("", "old-jvm-epoch"):
            self.assertEqual(self.request("POST", "/action", b'{"revision":7,"op":"ok"}',
                {"Content-Type": "application/json", "X-Expected-Host-Epoch": epoch})[0], 409)
        self.assertEqual(self.native.calls, [])

    def test_response_epoch_is_stable_and_matches_current_gateway(self):
        for _ in range(2):
            self.assertEqual(self.request()[1]["X-Host-Epoch"], self.bridge.epoch)

    def test_stale_rejection_is_preserved_without_retry(self):
        self.native.status = 409
        self.native.body = b'{"error":"stale_revision"}'
        status, _, body = self.request("POST", "/action", b'{"revision":6,"op":"ok"}', {"Content-Type": "application/json"})
        self.assertEqual((status, body), (409, self.native.body))
        self.assertEqual(len(self.native.calls), 1)

    def test_unknown_path_and_queries_never_forward(self):
        for path in ("/state?viewer=1", "/state/extra", "/health", "/connection.json", "/create", "/../state"):
            self.assertEqual(self.request(path=path)[0], 404, path)
        self.assertEqual(self.native.calls, [])

    def test_wrong_method_and_preflight_never_forward(self):
        for method, path in (("POST", "/state"), ("GET", "/action"), ("OPTIONS", "/state"), ("DELETE", "/action")):
            self.assertEqual(self.request(method, path)[0], 405)
        self.assertEqual(self.native.calls, [])

    def test_oversized_action_is_rejected_before_native(self):
        self.assertEqual(self.request("POST", "/action", b"x" * (gateway.MAX_BODY + 1), {"Content-Type": "application/json"})[0], 413)
        self.assertEqual(self.native.calls, [])

    def test_non_json_and_scalar_json_are_rejected(self):
        self.assertEqual(self.request("POST", "/action", b'{}', {"Content-Type": "text/plain"})[0], 415)
        for body in (b'[]', b'null', b'false', b'not-json', b'"string"'):
            self.assertEqual(self.request("POST", "/action", body, {"Content-Type": "application/json"})[0], 400)
        self.assertEqual(self.native.calls, [])

    def raw(self, head, body=b""):
        with socket.create_connection(("127.0.0.1", self.proxy.server_port), timeout=2) as conn:
            conn.sendall(("POST /action HTTP/1.1\r\nHost: host001.internal\r\nAuthorization: Bearer " + INTERNAL
                          + "\r\nX-Expected-Host-Epoch: " + self.bridge.epoch + "\r\nContent-Type: application/json\r\n"
                          + head + "\r\n").encode() + body)
            data = b""
            while chunk := conn.recv(65536):
                data += chunk
        status = int(data.split(b" ", 2)[1])
        return status, json.loads(data.split(b"\r\n\r\n", 1)[1] or b"null")

    def test_chunked_action_is_decoded_and_forwarded_byte_for_byte(self):
        # The container runtime may forward a body of known size chunked.
        parts = [b'{"revision":7,', b'"op":"reply","promptId":3,', b'"indexes":[2,0]}']
        self.native.status = 202
        self.native.body = b'{"accepted":true}'
        conn = http.client.HTTPConnection("127.0.0.1", self.proxy.server_port, timeout=2)
        try:
            conn.request("POST", "/action", body=iter(parts), encode_chunked=True, headers={
                "Authorization": "Bearer " + INTERNAL, "X-Expected-Host-Epoch": self.bridge.epoch,
                "Content-Type": "application/json", "Transfer-Encoding": "chunked"})
            self.assertEqual(conn.getresponse().status, 202)
        finally:
            conn.close()
        self.assertEqual(self.native.calls[0][3], b"".join(parts))

    def test_repeated_equal_length_is_one_body_and_conflicting_lengths_are_rejected(self):
        body = b'{"revision":7,"op":"ok"}'
        self.native.status = 202
        self.native.body = b'{"accepted":true}'
        self.assertEqual(self.raw(f"Content-Length: {len(body)}\r\nContent-Length: {len(body)}\r\n", body)[0], 202)
        self.assertEqual(self.native.calls[0][3], body)
        self.native.calls = []
        self.assertEqual(self.raw(f"Content-Length: {len(body)}, {len(body) + 1}\r\n", body),
                         (400, {"error": "explicit_content_length_required"}))
        self.assertEqual(self.native.calls, [])

    def test_malformed_unsupported_or_oversized_chunked_action_never_forwards(self):
        self.assertEqual(self.raw("Transfer-Encoding: chunked\r\n", b"zz\r\n{}\r\n0\r\n\r\n"), (400, {"error": "malformed_chunk"}))
        self.assertEqual(self.raw("Transfer-Encoding: gzip, chunked\r\n", b"2\r\n{}\r\n0\r\n\r\n"), (400, {"error": "unsupported_transfer_encoding"}))
        big = gateway.MAX_BODY + 1
        self.assertEqual(self.raw("Transfer-Encoding: chunked\r\n", f"{big:x}\r\n".encode()),
                         (413, {"error": "body_too_large"}))
        self.assertEqual(self.native.calls, [])

    def test_readiness_is_redacted_and_does_not_keep_match_alive(self):
        before = self.bridge.last_activity
        status, _, body = self.request(path="/ready", authorized=False)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"service": "forge-host001"})
        self.assertEqual(before, self.bridge.last_activity)

    def test_initializing_or_failed_is_not_ready(self):
        for value in ("initializing", "failed"):
            self.native.body = json.dumps({"status": value}).encode()
            self.assertEqual(self.request(path="/ready", authorized=False)[0], 503)

    def test_terminal_state_records_cleanup_deadline(self):
        self.native.body = b'{"status":"finished"}'
        self.assertEqual(self.request()[0], 200)
        self.assertIsNotNone(self.bridge.terminal_seen)


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        # Context-building mechanics use an explicit small fixture manifest.
        # Exact checkpoint-byte verification is separately run on real inputs.
        self.original_here = prepare.HERE
        prepare.HERE = self.root / "hosting"
        prepare.HERE.mkdir()
        self.addCleanup(setattr, prepare, "HERE", self.original_here)
        self.path = "experiments/forge-proof/native/adapter/src/Fixture.java"
        self.file = self.source / self.path
        self.file.parent.mkdir(parents=True)
        self.file.write_bytes(b"fixture")
        import hashlib
        manifest = {"checkpoint": "fixture", "sha256": {self.path: hashlib.sha256(b"fixture").hexdigest()}}
        (prepare.HERE / "checkpoint-files.json").write_text(json.dumps(manifest))
        for name in ("Dockerfile", "assemble.sh", "gateway.py"):
            (prepare.HERE / name).write_text("fixture")

    def test_context_excludes_unlisted_runtime_secret_and_root_config(self):
        (self.source / "connection.json").write_text("do-not-copy")
        (self.source / "wrangler.jsonc").write_text("do-not-copy")
        output = self.root / "context"
        prepare.prepare(self.source, output)
        self.assertEqual((output / "native/adapter/src/Fixture.java").read_bytes(), b"fixture")
        self.assertFalse((output / "connection.json").exists())
        self.assertFalse((output / "wrangler.jsonc").exists())

    def test_changed_checkpoint_is_rejected_before_creating_output(self):
        self.file.write_bytes(b"modified")
        output = self.root / "context"
        with self.assertRaises(ValueError):
            prepare.prepare(self.source, output)
        self.assertFalse(output.exists())

    def test_symlink_input_is_rejected(self):
        self.file.unlink()
        self.file.symlink_to(self.source / "somewhere")
        with self.assertRaises(ValueError):
            prepare.prepare(self.source, self.root / "context")

    def test_existing_context_is_not_overwritten(self):
        output = self.root / "context"
        output.mkdir()
        with self.assertRaises(FileExistsError):
            prepare.prepare(self.source, output)


class LifecycleTests(unittest.TestCase):
    def test_polling_cannot_extend_hard_two_hour_lifetime(self):
        self.assertEqual(gateway.expiry_reason(0, 7200, None, 7200), "hard_lifetime")

    def test_no_early_idle_expiry(self):
        self.assertIsNone(gateway.expiry_reason(0, 200, None, 799.9))
        self.assertEqual(gateway.expiry_reason(0, 200, None, 800), "idle")

    def test_terminal_result_has_sixty_second_retention(self):
        self.assertIsNone(gateway.expiry_reason(0, 500, 500, 559.9))
        self.assertEqual(gateway.expiry_reason(0, 500, 500, 560), "terminal_retention")

    def test_terminate_stops_a_real_child_process_group(self):
        import subprocess
        import sys
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], start_new_session=True)
        try:
            gateway.terminate(child)
            self.assertIsNotNone(child.poll())
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()


if __name__ == "__main__":
    unittest.main(verbosity=2)
