import importlib.util
import http.client
import json
from pathlib import Path
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
    def test_transfer_encoding_and_oversize_rejected(self):
        self.assertEqual(self.call('POST', '/initialize', {'input': {}}, headers={'Transfer-Encoding': 'chunked'})[0], 400)
        self.assertEqual(self.call('POST', '/initialize', {'input': {}}, headers={'Content-Length': '262145'})[0], 413)

if __name__ == '__main__': unittest.main()
