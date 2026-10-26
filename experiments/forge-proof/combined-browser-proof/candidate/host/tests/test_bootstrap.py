import importlib.util
import http.client
import json
from pathlib import Path
import socket
import tempfile
import threading
import unittest

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).resolve().parents[1] / 'container/bootstrap.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)
TOKEN = 'fixture-capability-with-at-least-32-characters'

class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'match-input.json'
        self.server = bootstrap.BootstrapServer(('127.0.0.1', 0), TOKEN, self.path)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
    def call(self, method, path, body=None, token=TOKEN, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=2)
        payload = None if body is None else json.dumps(body, separators=(',', ':')).encode()
        h = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
        h.update(headers or {})
        conn.request(method, path, body=payload, headers=h)
        response = conn.getresponse(); status = response.status; value = response.read(); conn.close()
        return status, value
    def test_no_account_credential_or_missing_capability_can_initialize(self):
        self.assertEqual(self.call('POST', '/initialize', {'input': {}}, token='account-bearer')[0], 401)
        self.assertFalse(self.path.exists())
    def test_authenticated_readiness_has_no_private_input(self):
        status, body = self.call('GET', '/bootstrap-ready')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {'protocol': 'cardstashy.match-input.v1'})
    def test_snapshot_is_saved_byte_exact_once_with_private_mode(self):
        value = {'input': {'format': 'Commander', 'humanDeck': {'cards': [{'name': 'Fixture', 'qty': 1, 'cn': '007'}]}, 'note': 'do not transform'}}
        self.assertEqual(self.call('POST', '/initialize', value)[0], 204)
        self.assertEqual(self.path.read_bytes(), json.dumps(value, separators=(',', ':')).encode())
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.call('POST', '/initialize', value)[0], 409)
    def test_browser_chosen_path_extra_commands_and_wrong_route_rejected(self):
        self.assertEqual(self.call('POST', '/initialize', {'input': {}, 'path': '/tmp/bad'})[0], 400)
        self.assertEqual(self.call('POST', '/action', {'input': {}})[0], 404)
        self.assertFalse(self.path.exists())
    def test_existing_file_or_symlink_never_overwritten(self):
        target = Path(self.temp.name) / 'target'; target.write_text('preserve')
        self.path.symlink_to(target)
        self.assertEqual(self.call('POST', '/initialize', {'input': {}})[0], 400)
        self.assertEqual(target.read_text(), 'preserve')
    def raw(self, head, body=b''):
        with socket.create_connection(('127.0.0.1', self.server.server_port), timeout=2) as conn:
            conn.sendall(('POST /initialize HTTP/1.1\r\nHost: host001.internal\r\nAuthorization: Bearer ' + TOKEN
                          + '\r\nContent-Type: application/json\r\n' + head + '\r\n').encode() + body)
            data = b''
            while chunk := conn.recv(65536): data += chunk
        return int(data.split(b' ', 2)[1]), json.loads(data.split(b'\r\n\r\n', 1)[1] or b'null')
    def test_chunked_snapshot_is_saved_byte_exact(self):
        # The container runtime may forward a body of known size chunked.
        encoded = json.dumps({'input': {'format': 'Modern', 'note': 'unchanged'}}, separators=(',', ':')).encode()
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=2)
        conn.request('POST', '/initialize', body=iter([encoded[:9], encoded[9:]]), encode_chunked=True,
                     headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked'})
        self.assertEqual(conn.getresponse().status, 204); conn.close()
        self.assertEqual(self.path.read_bytes(), encoded)
    def test_repeated_equal_length_is_one_body(self):
        encoded = b'{"input":{"format":"Standard"}}'
        self.assertEqual(self.raw(f'Content-Length: {len(encoded)}\r\nContent-Length: {len(encoded)}\r\n', encoded), (204, None))
        self.assertEqual(self.path.read_bytes(), encoded)
    def test_every_refusal_names_its_reason(self):
        self.assertEqual(self.raw('Content-Length: 3, 4\r\n', b'{}x'), (400, {'error': 'content_length_invalid'}))
        self.assertEqual(self.raw(''), (411, {'error': 'content_length_required'}))
        self.assertEqual(self.raw('Transfer-Encoding: gzip\r\n', b'{}'), (400, {'error': 'unsupported_transfer_encoding'}))
        self.assertEqual(self.raw('Transfer-Encoding: chunked\r\n', b'zz\r\n'), (400, {'error': 'malformed_body'}))
        self.assertEqual(self.raw('Transfer-Encoding: chunked\r\n', b'0\r\n\r\n'), (400, {'error': 'empty_body'}))
        big = bootstrap.MAX_BYTES + 1
        self.assertEqual(self.raw('Transfer-Encoding: chunked\r\n', f'{big:x}\r\n'.encode()), (413, {'error': 'body_too_large'}))
        self.assertEqual(self.raw('Content-Length: 262145\r\n'), (413, {'error': 'body_too_large'}))
        self.assertFalse(self.path.exists())
    def test_unwritable_input_location_is_named_without_its_path(self):
        self.server.input_path = Path(self.temp.name) / 'missing-directory' / 'match-input.json'
        status, value = self.raw('Content-Length: 12\r\n', b'{"input":{}}')
        self.assertEqual((status, value), (503, {'error': 'input_write_failed_filenotfounderror'}))
        self.assertNotIn(self.temp.name, json.dumps(value))

if __name__ == '__main__': unittest.main()
