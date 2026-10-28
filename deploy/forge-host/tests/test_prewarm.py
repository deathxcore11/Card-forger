import importlib.util
import http.client
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest

spec = importlib.util.spec_from_file_location('gateway', Path(__file__).resolve().parents[1] / 'container/gateway.py')
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)
TOKEN = 'fixture-capability-with-at-least-32-characters'

class PrewarmInputTests(unittest.TestCase):
    # A warm engine's JVM loads before its match exists. The gateway takes the input on
    # the bootstrap's own route without waiting for the JVM, then fills its private pipe.
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.fifo = Path(self.temp.name) / 'match-input.json'
        os.mkfifo(self.fifo, 0o600)
        self.server = gateway.prewarm_server(TOKEN, self.fifo, time.monotonic() + 30, ('127.0.0.1', 0))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
    def call(self, method, path, body=None, token=TOKEN):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=2)
        payload = None if body is None else json.dumps(body, separators=(',', ':')).encode()
        conn.request(method, path, body=payload, headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        response = conn.getresponse(); status = response.status; value = response.read(); conn.close()
        return status, value
    def test_input_is_accepted_before_the_jvm_reads_and_delivered_byte_exact_once(self):
        self.assertEqual(self.call('GET', '/bootstrap-ready'), (200, b'{"protocol":"cardstashy.match-input.v1"}'))
        value = {'input': {'format': 'Commander', 'note': 'do not transform'}}
        self.assertEqual(self.call('POST', '/initialize', value)[0], 204)  # no reader yet
        self.assertFalse(self.server.delivered.is_set())
        with open(self.fifo, 'rb') as reader:
            self.assertEqual(reader.read(), json.dumps(value, separators=(',', ':')).encode())
        self.assertTrue(self.server.delivered.wait(2))
        self.assertIsNone(self.server.failed)
        self.assertEqual(self.call('POST', '/initialize', value)[0], 409)
    def test_no_internal_capability_cannot_give_input(self):
        self.assertEqual(self.call('POST', '/initialize', {'input': {}}, token='account-bearer')[0], 401)
        self.assertFalse(self.server.accepted)
    def test_a_regular_file_in_place_of_the_pipe_is_never_written(self):
        self.fifo.unlink(); self.fifo.write_text('{}')
        self.assertEqual(self.call('POST', '/initialize', {'input': {}})[0], 400)
        self.assertEqual(self.fifo.read_text(), '{}')

if __name__ == '__main__':
    unittest.main()
