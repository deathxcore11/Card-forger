"""Local fixtures test proof criteria; they are not a native/container proof."""
import copy
import importlib.util
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('docker_proof_client', HERE / 'scripts/docker-proof-client.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class DockerProofClientTests(unittest.TestCase):
    def state(self):
        return {'revision': 42, 'prompt': {'supported': True, 'method': 'getChoices',
                'id': 8, 'min': 1, 'options': [{'index': 3}, {'index': 9}]}}

    def run_proof(self, replace=None):
        calls = []
        responses = [(401, {'error': 'internal_authorization_required'}),
                     (401, {'error': 'internal_authorization_required'}),
                     (409, {'error': 'native_generation_mismatch'}),
                     (409, {'error': 'native_generation_mismatch'}),
                     (409, {}), (400, {}), (409, {}), (202, {}), (409, {})]
        if replace is not None:
            index, response = replace
            responses[index] = response
        def call(method, path, body=None, epoch=None, **kwargs):
            calls.append((method, path, copy.deepcopy(body), epoch, kwargs))
            status, value = responses[len(calls) - 1]
            return status, value, 'epoch'
        result = client.prove_native_action(call, self.state(), 'epoch')
        return result, calls

    def test_requires_actual_offered_native_move(self):
        for prompt in [None, {}, {'supported': False, 'method': 'getChoices'},
                       {'supported': True, 'method': 'unsupported'}]:
            state = self.state(); state['prompt'] = prompt
            with self.subTest(prompt=prompt), self.assertRaisesRegex(RuntimeError, 'native_action_proof_unavailable'):
                client.prove_native_action(lambda *a, **kw: self.fail('must not dispatch'), state, 'epoch')

    def test_malformed_offer_fails_before_requests(self):
        for minimum in [-1, 3, True, '1']:
            state = self.state(); state['prompt']['min'] = minimum
            with self.subTest(minimum=minimum), self.assertRaisesRegex(RuntimeError, 'native_action_offer_invalid'):
                client.prove_native_action(lambda *a, **kw: self.fail('must not dispatch'), state, 'epoch')

    def test_guards_precede_accepted_reply_and_duplicate(self):
        result, calls = self.run_proof()
        self.assertEqual(calls[0], ('GET', '/state', None, None, {'bearer': None}))
        self.assertEqual(calls[1], ('GET', '/state', None, None, {'bearer': 'invalid-proof-capability'}))
        action = {'revision': 42, 'op': 'reply', 'promptId': 8, 'indexes': [3]}
        self.assertEqual(calls[2], ('POST', '/action', action, None, {}))
        self.assertEqual(calls[3], ('POST', '/action', action, 'epoch-wrong', {}))
        self.assertEqual(calls[6][2], {'revision': 42, 'op': 'controlMode', 'value': 'full'})
        self.assertEqual(calls[7], ('POST', '/action', action, 'epoch', {}))
        self.assertEqual(calls[8], calls[7])
        self.assertEqual(result['nativeAction'], 'native_startup_reply202_duplicate409')
        self.assertEqual(result['modeGuards'], 'stale409_invalid400_busy409')
        self.assertEqual(result['authGuards'], 'missing401_wrong401')
        self.assertEqual(result['epochGuards'], 'missing409_wrong409')

    def test_missing_rejection_or_wrong_rejection_reason_never_passes(self):
        for index in range(7):
            with self.subTest(index=index), self.assertRaises(AssertionError):
                self.run_proof((index, (200, {})))
        for index, status in [(0, 401), (1, 401), (2, 409), (3, 409)]:
            with self.subTest(index=index, reason='wrong'), self.assertRaises(AssertionError):
                self.run_proof((index, (status, {'error': 'unrelated_rejection'})))

    def test_rejected_move_or_accepted_duplicate_never_passes(self):
        for index, status in [(7, 409), (8, 202)]:
            with self.subTest(index=index), self.assertRaises(AssertionError):
                self.run_proof((index, (status, {})))


if __name__ == '__main__':
    unittest.main()
