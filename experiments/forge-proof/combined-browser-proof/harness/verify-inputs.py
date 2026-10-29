#!/usr/bin/env python3
"""Read-only source/package gate. It never builds, runs, publishes or deploys."""
import hashlib,json,os,pathlib,sys
HERE=pathlib.Path(__file__).resolve().parent
c=json.loads((HERE/'composition-contract.json').read_text())
assert c['status']=='source-bound-awaiting-root-approval', 'Combined source identities are not frozen for review'
candidate=pathlib.Path(os.environ['FORGE_COMBINED_CANDIDATE_ROOT']).resolve() if os.environ.get('FORGE_COMBINED_CANDIDATE_ROOT') else (HERE/c['candidateRoot']).resolve()
assert candidate.is_dir()
for name,item in c['inputs'].items():
 assert isinstance(item,dict) and isinstance(item.get('sha256'),str) and len(item['sha256'])==64,name+' unbound'
 rel=item['path'];base=candidate if rel.startswith('${CANDIDATE}/') else HERE if rel.startswith('${PACKAGE}/') else None
 assert base is not None and '..' not in rel.split('/'),name+' unsafe path'
 path=base/rel.split('/',1)[1]
 assert path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(base),name+' not a regular input'
 assert hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256'],name+' hash mismatch'
for rel,inventory in [('host','HOST-SHA256.json'),('ui','UI-RUNTIME-SHA256.json'),('build-context','build-context/CONTEXT-SHA256.json')]:
 inv=json.loads((candidate/inventory).read_text())
 if rel=='ui':
  source=json.loads((candidate/'UI-SHA256.json').read_text())
  parent=json.loads((candidate/'UI-PARENT-SHA256.json').read_text())
  changed=c['runtimeUIChangedPaths']
  assert isinstance(changed,list) and len(set(changed))==len(changed), 'Invalid UI descendant change inventory'
  assert source.keys()==parent.keys() and {k for k in source if source[k]!=parent[k]}==set(changed), 'UI changes differ from declared descendant scope'
  assert inv and all(source.get(k)==v for k,v in inv.items()), 'UI subset differs from reviewed descendant inventory'
  for k in inv:
   parts=pathlib.PurePosixPath(k).parts
   assert not any(q in {'test-results','private-work','node_modules','.git'} for q in parts) and not k.endswith(('.log','.orig','.pyc','.class','.wasm','.bin','.zip','.tar','.gz','.apk')), 'Forbidden runtime UI artifact'
 allowed=set(inv)|({'CONTEXT-SHA256.json'} if rel=='build-context' else set())
 actual=set()
 for p in (candidate/rel).rglob('*'):
  assert not p.is_symlink(),rel+' contains a symlink'
  if p.is_file():actual.add(str(p.relative_to(candidate/rel)))
 assert actual==allowed,rel+' has unmanifested or missing files'
 for name,expected in inv.items():
  assert not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
  p=candidate/rel/name
  assert p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(candidate/rel)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==expected,rel+'/'+name+' differs from inventory'
m=json.loads((HERE/'MANIFEST.json').read_text())
listed={r['path'] for r in m['files']}
assert len(listed)==len(m['files']), 'Duplicate package manifest path'
actual=set()
for p in HERE.rglob('*'):
 assert not p.is_symlink(), 'Package contains symlink'
 if p.is_file():actual.add(str(p.relative_to(HERE)))
assert actual==listed|{'MANIFEST.json'}, 'Package contains unlisted or missing files'
for record in m['files']:
 assert not pathlib.PurePosixPath(record['path']).is_absolute() and '..' not in pathlib.PurePosixPath(record['path']).parts
 p=HERE/record['path'];assert p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(HERE)
 assert len(p.read_bytes())==record['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==record['sha256'],record['path']+' package hash mismatch'
assert c['sourceIdentity']['forgeRevision']=='e5a0f8156da70ffc7866f923bed371c0111707cd'
assert c['sourceIdentity']['nativeSourceSHA256']=='016ed24c9a90a17bb0198cca7a6635327367e6d0be8f1c72584a7dcded225570'
assert c['sourceIdentity']['difficultyPolicyVersion']=='forge-heuristic-medium-beta-v1'
assert c['localImageScope']=='LOCAL_TEST_NOT_DEPLOYABLE' and c['productionReleasePolicy'] is None
print(json.dumps({'inputsVerified':len(c['inputs']),'packageFilesVerified':len(m['files']),'candidateRoot':str(candidate),'publicationAuthorized':False,'runAuthorized':False,'productionReleaseReady':False}))
