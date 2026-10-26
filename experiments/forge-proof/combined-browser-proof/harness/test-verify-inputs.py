#!/usr/bin/env python3
# Source inventory boundary only; never executes Docker or a browser.
import hashlib,json,os,pathlib,shutil,subprocess,tempfile,unittest
HERE=pathlib.Path(__file__).resolve().parent
CANDIDATE=pathlib.Path(os.environ['FORGE_COMBINED_CANDIDATE_ROOT']).resolve() if os.environ.get('FORGE_COMBINED_CANDIDATE_ROOT') else (HERE/json.loads((HERE/'composition-contract.json').read_text())['candidateRoot']).resolve()
class Inputs(unittest.TestCase):
 def run_copy(self,edit=lambda p:None):
  with tempfile.TemporaryDirectory(prefix='input-inventory-test-') as t:
   p=pathlib.Path(t)/'package';shutil.copytree(HERE,p,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
   records=[{'path':str(f.relative_to(p)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(p.rglob('*')) if f.is_file() and f.name!='MANIFEST.json' or f.is_file() and f.name=='MANIFEST.json' and f.parent!=p]
   (p/'MANIFEST.json').write_text(json.dumps({'files':records}));edit(p)
   return subprocess.run(['python3',str(p/'verify-inputs.py')],env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','FORGE_COMBINED_CANDIDATE_ROOT':str(CANDIDATE)},capture_output=True,text=True)
 def test_exact_copy_passes(self):r=self.run_copy();self.assertEqual(r.returncode,0,r.stderr)
 def test_unmanifested_executable_rejected(self):self.assertNotEqual(self.run_copy(lambda p:(p/'test-unreviewed.mjs').write_text('throw Error("not reviewed");')).returncode,0)
 def test_package_symlink_rejected(self):self.assertNotEqual(self.run_copy(lambda p:(p/'unreviewed').symlink_to(p/'README.md')).returncode,0)
 def test_modified_listed_file_rejected(self):self.assertNotEqual(self.run_copy(lambda p:(p/'README.md').write_text('changed')).returncode,0)
if __name__=='__main__':unittest.main()
