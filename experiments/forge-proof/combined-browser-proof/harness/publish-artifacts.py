#!/usr/bin/env python3
"""Atomic sanitized publication. A collector exception never stages upload files."""
import hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile
HERE=pathlib.Path(__file__).resolve().parent

def publish(work,out,code,stage,cleanup):
 out=pathlib.Path(out);out.parent.mkdir(parents=True,exist_ok=True)
 assert not out.is_symlink() and (not out.exists() or out.is_dir() and not any(out.iterdir())), 'Nonempty output refused'
 staging=pathlib.Path(tempfile.mkdtemp(prefix='.forge-sanitized-private-',dir=out.parent));os.chmod(staging,0o700)
 try:
  p=subprocess.run(['python3',str(HERE/'collect-combined.py'),str(work),str(staging),str(code),stage,cleanup],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  assert p.returncode in [0,1], 'Collector failed'
  receipt=staging/'verified-artifact.json'
  assert receipt.is_file() and not receipt.is_symlink() and receipt.stat().st_size<=65536, 'Collector did not complete privacy checks'
  v=json.loads(receipt.read_text());assert set(v)=={'schema','verified','result','files'} and v['schema']=='cardstashy.sanitized-artifact.v1' and v['verified'] is True and v['result'] in ['passed','failed']
  assert p.returncode==(0 if v['result']=='passed' else 1)
  actual=set()
  for f in staging.rglob('*'):
   assert not f.is_symlink()
   if f.is_file() and f!=receipt:actual.add(str(f.relative_to(staging)))
  assert actual==set(v['files']) and all(hashlib.sha256((staging/f).read_bytes()).hexdigest()==v['files'][f] for f in actual)
  # Same-parent rename makes verified evidence appear at the upload path at once.
  # Existing destination may only be the empty directory created by the wrapper.
  os.replace(staging,out)
  return p.returncode
 finally:
  if staging.exists():shutil.rmtree(staging)

if __name__=='__main__':
 try:sys.exit(publish(*sys.argv[1:]))
 except Exception:
  # Never echo raw input, paths, exception text or partially sanitized content.
  print('Sanitized artifact publication failed; no upload marker.',file=sys.stderr);sys.exit(2)
