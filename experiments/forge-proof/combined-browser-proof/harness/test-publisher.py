#!/usr/bin/env python3
# Synthetic privacy-boundary checks only; no browser/image proof.
import base64,json,pathlib,subprocess,tempfile,unittest
HERE=pathlib.Path(__file__).resolve().parent
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
class Publication(unittest.TestCase):
 def run_fixture(self,inject=False):
  with tempfile.TemporaryDirectory() as t:
   root=pathlib.Path(t);work=root/'work';work.mkdir();out=root/'artifact';out.mkdir()
   if inject:
    raw=work/'raw'/'desktop';raw.mkdir(parents=True);(raw/'failure.png').write_bytes(PNG+b'Bearer PRIVATE_CANARY')
   r=subprocess.run(['python3',str(HERE/'publish-artifacts.py'),str(work),str(out),'1','desktop','true'],capture_output=True,text=True)
   files={str(p.relative_to(out)):p.read_bytes() for p in out.rglob('*') if p.is_file()}
   self.assertFalse(list(root.glob('.forge-sanitized-private-*')))
   self.assertNotIn('PRIVATE_CANARY',r.stdout+r.stderr)
   return r.returncode,files
 def test_legitimate_failed_game_evidence_can_publish_after_privacy_checks(self):
  code,files=self.run_fixture();self.assertEqual(code,1);self.assertIn('verified-artifact.json',files);self.assertEqual(json.loads(files['summary.json'])['result'],'failed')
 def test_privacy_rejection_leaves_no_uploadable_partial_artifact(self):
  code,files=self.run_fixture(True);self.assertEqual(code,2);self.assertEqual(files,{})
 def test_wrapper_requires_verified_marker_not_summary_existence(self):
  s=(HERE/'run-combined.sh').read_text();self.assertIn('"$HERE/publish-artifacts.py"',s);self.assertIn('[[ -f "$ARTIFACT/verified-artifact.json" ]]',s);self.assertNotIn('[[ -f "$ARTIFACT/summary.json" ]]',s)
if __name__=='__main__':unittest.main()
