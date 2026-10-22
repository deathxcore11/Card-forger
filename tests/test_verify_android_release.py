"""Offline packaging gate tests; no Android SDK, signing key or account involved."""
import hashlib
import importlib.util
import shutil
import pathlib
import tempfile
import unittest
import zipfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('android_gate', pathlib.Path(__file__).parents[1] / 'scripts/verify-android-release.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class BundleGateTests(unittest.TestCase):
    def test_shared_bytes_and_versions_are_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / 'app.js').write_text('export const marker = "shared";')
            (root / 'config.js').write_text('export const APP_VERSION = "9.1.0";')
            (root / 'sw.js').write_text('const ASSETS = ["./app.js", "./config.js"];')
            record = {'webVersion': '9.1.0', 'android': {'interfaceVersion': '9.1.0'}}
            apk = root / 'fixture.apk'
            def build(app, version='9.1.0'):
                with zipfile.ZipFile(apk, 'w') as out:
                    out.writestr('assets/public/app.js', app)
                    out.writestr('assets/public/config.js', f'export const APP_VERSION = "{version} · Android 1.0";')
            with patch.object(gate, 'node', side_effect=lambda source, code: ['app.js', 'config.js'] if 'moduleGraph' in code else '9.1.0'), patch.object(gate, 'native_expected', return_value={}):
                build((root / 'app.js').read_text())
                self.assertEqual(gate.bundle_check(root, apk, record)['errors'], [])
                build('old interface')
                self.assertIn('APK differs from shared source: app.js', gate.bundle_check(root, apk, record)['errors'])
                build((root / 'app.js').read_text(), '9.0.0')
                self.assertIn('APK differs from shared source: config.js', gate.bundle_check(root, apk, record)['errors'])
                record['android']['interfaceVersion'] = '9.0.0'
                self.assertTrue(any('versions must match' in e for e in gate.bundle_check(root, apk, record)['errors']))

    def test_native_adaptations_must_be_exactly_the_reviewed_transforms(self):
        repo = pathlib.Path(__file__).parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            shutil.copytree(repo / 'scripts/android-native', root / 'scripts/android-native')
            (root / 'style.css').write_text('.top{padding-top:env(safe-area-inset-top)}')
            (root / 'plain.js').write_text('export const x = 1;')
            expected = gate.native_expected(root, {'style.css', 'plain.js'})
            self.assertEqual(set(expected), {'style.css'}, 'only adapted files and CSS get a transformed hash')
            adapted = b'.top{padding-top:max(env(safe-area-inset-top), var(--safe-area-inset-top, 0px))}'
            self.assertEqual(expected['style.css'], hashlib.sha256(adapted).hexdigest())
            self.assertNotEqual(expected['style.css'], hashlib.sha256((root / 'style.css').read_bytes()).hexdigest(), 'an unadapted stylesheet fails the gate')

    def test_only_self_referential_fields_may_differ(self):
        one = b"{sha256:'abc',bytes:1,interfaceVersion:'9.1.0'}"
        self.assertEqual(gate.normalized('release-record.js', one), gate.normalized('release-record.js', b"{sha256:'def',bytes:2,interfaceVersion:'9.1.0'}"))
        self.assertNotEqual(gate.normalized('release-record.js', one), gate.normalized('release-record.js', b"{sha256:'def',bytes:2,interfaceVersion:'9.0.0'}"))

if __name__ == '__main__':
    unittest.main()
