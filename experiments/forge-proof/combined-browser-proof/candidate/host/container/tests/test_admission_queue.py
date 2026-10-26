"""Real TCP burst before the accept loop starts; no native process or account."""
import importlib.util
from pathlib import Path
import socket
import threading
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('queue_gateway', Path(__file__).resolve().parents[1] / 'gateway.py')
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)


class AdmissionQueueTests(unittest.TestCase):
    def test_eight_pending_connections_reach_bounded_handlers_and_release(self):
        bridge = gateway.Bridge('synthetic-native', 'synthetic-internal')
        bridge.forward = lambda *_args, **_kwargs: self.fail('Unauthenticated request reached native')
        server = gateway.Server(('127.0.0.1', 0), bridge)
        clients = []
        thread = None
        try:
            # Hold the accept loop to reproduce a scheduler-delayed burst.
            # All eight TCP handshakes must fit without extending timeouts.
            for _ in range(8):
                client = socket.create_connection(('127.0.0.1', server.server_port), timeout=0.2)
                clients.append(client)
                client.sendall(b'GET /state HTTP/1.1\r\nX-Trickle: ')
            with patch.object(gateway, 'REQUEST_TIMEOUT', 0.25):
                thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=0.01), daemon=True)
                thread.start()
                deadline = time.monotonic() + 0.15
                while server.slots._value and time.monotonic() < deadline:
                    time.sleep(0.001)
                self.assertEqual(server.slots._value, 0)
                deadline = time.monotonic() + 1
                while server.slots._value != 8 and time.monotonic() < deadline:
                    time.sleep(0.005)
                self.assertEqual(server.slots._value, 8)
            with socket.create_connection(('127.0.0.1', server.server_port), timeout=0.2) as client:
                client.sendall(b'GET /state HTTP/1.0\r\n\r\n')
                self.assertIn(b'401', client.recv(512).split(b'\r\n', 1)[0])
        finally:
            for client in clients:
                client.close()
            if thread is not None:
                server.shutdown()
                thread.join(timeout=1)
            server.server_close()


if __name__ == '__main__':
    unittest.main()
