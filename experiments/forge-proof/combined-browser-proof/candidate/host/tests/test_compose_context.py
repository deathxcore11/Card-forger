import importlib.util
import json
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('compose', HERE / 'scripts/compose-exact-context.py')
compose = importlib.util.module_from_spec(spec); spec.loader.exec_module(compose)
class ComposeContextTests(unittest.TestCase):
    def fixture(self):
        temporary = tempfile.TemporaryDirectory(); self.addCleanup(temporary.cleanup)
        root = Path(temporary.name); native=root/'native'; hosting=root/'hosting'; native.mkdir(); hosting.mkdir()
        lines=[]
        for source in compose.NATIVE_FILES:
            path=native/source; path.parent.mkdir(parents=True,exist_ok=True); path.write_text('synthetic input '+source)
            lines.append(hashlib.sha256(path.read_bytes()).hexdigest()+'  ./'+source)
        manifest=native/'SHA256SUMS';manifest.write_text('\n'.join(lines)+'\n')
        (hosting/'checkpoint-files.json').write_text(json.dumps({'forgeRevision':compose.FORGE_REVISION}))
        (hosting/'Dockerfile').write_text('ARG BUILD_IMAGE=mutable\nARG RUNTIME_IMAGE=mutable\nCOPY hosting/gateway.py /opt/host001/gateway.py\nENTRYPOINT ["python3", "/opt/host001/gateway.py"]\n')
        (hosting/'assemble.sh').write_text('javac /opt/forge-proof/adapter/src/cardstashy/forge/ForgeHttpBridge.java\n')
        templates={name:compose.sha((hosting/name).read_bytes()) for name in ['Dockerfile','assemble.sh']}
        patched=patch.object(compose,'TEMPLATE_HASHES',templates);patched.start();self.addCleanup(patched.stop)
        gateway=root/'gateway.py';gateway.write_text('# fixture HOST_ABSOLUTE_DEADLINE_MS proof.requireExact=true')
        args=[native,hosting,gateway,root/'context',compose.sha(manifest.read_bytes()),compose.sha(gateway.read_bytes())]
        return args
    def test_pinned_minimal_context_has_three_sources_bootstrap_and_no_default_image(self):
        args=self.fixture(); result=compose.compose(*args); destination=args[3]
        self.assertEqual(result['files'],16)
        docker=(destination/'Dockerfile').read_text();self.assertIn('/opt/host-service/bootstrap.py',docker);self.assertNotIn('=mutable',docker)
        self.assertIn('*.java',(destination/'hosting/assemble.sh').read_text())
        manifest=json.loads((destination/'hosting/checkpoint-files.json').read_text());self.assertEqual(manifest['adapterCapabilities'],['cardstashy.match-input.v1'])
    def test_bad_manifest_or_gateway_pin_fails_before_context_write(self):
        for index in [4,5]:
            args=self.fixture();args[index]='0'*64
            with self.assertRaises(ValueError):compose.compose(*args)
            self.assertFalse(args[3].exists())
    def test_changed_or_symlinked_native_source_rejected(self):
        for symlink in [False,True]:
            args=self.fixture(); path=args[0]/'adapter/src/cardstashy/forge/ForgeHttpBridge.java'
            if symlink:path.unlink();path.symlink_to(args[0]/'LICENSE')
            else:path.write_text('unexpected source')
            with self.assertRaises(ValueError):compose.compose(*args)
            self.assertFalse(args[3].exists())
if __name__=='__main__':unittest.main()
