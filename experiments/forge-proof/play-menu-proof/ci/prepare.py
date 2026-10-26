#!/usr/bin/env python3
"""Compose immutable inputs into a disposable sibling layout, never the checkout."""
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path

repo, work, base = (Path(p).resolve() for p in sys.argv[1:])
source = repo/'experiments/forge-proof/play-menu-proof'
assert work != repo and repo not in work.parents and work != base
assert base.is_dir() and not (base/'.git').exists()
takeover = work/'takeover'; takeover.mkdir(parents=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for entry in json.loads((source/'SOURCE-SHA256.json').read_text()):
    p=source/entry['path']; assert p.is_file() and not p.is_symlink() and sha(p)==entry['sha256'], entry['path']
def copy(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst)
def patch(root, file):
    subprocess.run(['patch','--fuzz=0','--batch','-p1','-d',str(root)],input=file.read_bytes(),check=True,stdout=subprocess.DEVNULL)

# The frozen materializer expects sibling directories. Keep it byte-for-byte;
# only this explicit layout adapter is new CI orchestration.
# fs.cp preserves directory symlinks by default. A REAL copy is mandatory here:
# otherwise the unmodified materializer would write through to its source.
protected={str(p.relative_to(base)):sha(p) for p in base.rglob('*') if p.is_file()}
shutil.copytree(base,takeover/'cardstashy',symlinks=False)
browser=takeover/'forge-play-browser-proof';shutil.copytree(source/'browser',browser)
patch(browser,source/'patches/browser-menu-exit.patch')
assert sha(browser/'browser-journey.mjs')=='cac54a7761aa0e84aa12873c802ecf614757c072d09b3bfe768b515ba2d80399'
inspector=takeover/'forge-inspector-fix-overlay'
for rel in ['experiments/phase-engine/match-table.mjs','experiments/forge-proof/forge-table.mjs']:
    copy(base/rel,inspector/rel)
patch(inspector,source/'patches/inspector.patch')
integration=takeover/'forge-play-integration-overlay';integration.mkdir()
entries=json.loads((source/'patches/integration-sha256.json').read_text())
for entry in entries:
    if entry['baseline']:
        prior=takeover/entry['baseline']
        assert sha(prior)==entry['baselineSha256'], 'Integration baseline mismatch: '+entry['path']
        copy(prior,integration/entry['path'])
patch(integration,source/'patches/integration.patch')
for entry in entries: assert sha(integration/entry['path'])==entry['sha256'],entry['path']
copy(source/'patches/integration-sha256.json',integration/'SHA256SUMS.json')
copy(source/'patches/integration.patch',integration/'forge-play-integration.patch')
fan=takeover/'forge-land-hitfix-overlay';rel='experiments/phase-engine/match-table.css'
copy(base/rel,fan/rel)
expected_fan='4ad62dbc2de39c1103bf11f4fb26f19dbc89123daa04db3b386355fe9b6775b9'
if sha(fan/rel)!=expected_fan: patch(fan,source/'patches/hand-fan.patch')
assert sha(fan/rel)==expected_fan,'Reviewed hand fan mismatch'
copy(source/'patches/wide-entry.patch',takeover/'wide-screen-entry.patch')

native=repo/'experiments/forge-proof/native-exact-0146'
assert sha(native/'SHA256SUMS')=='a5e7e38bb72b937936f7db7d1fcacb4a2196dddf6f103e90203d1d778aa43813'
proof=takeover/'forge-proof';proof.mkdir()
(proof/'review-candidate-20261026-0146-exact').symlink_to(native,target_is_directory=True)
(proof/'decks').symlink_to(native/'decks',target_is_directory=True)
host=repo/'experiments/forge-proof/hosting/cloudflare'
service=takeover/'forge-host-service-rematch/composed';service.mkdir(parents=True)
for rel in ['src','tests']: shutil.copytree(host/rel,service/rel)
copy(host/'package.json',service/'package.json')
changes=json.loads((source/'patches/rematch-manifest.json').read_text())['changes']
for rel,record in changes.items(): assert sha(service/rel)==record['before'],rel
patch(service,source/'patches/rematch.patch')
for rel,record in changes.items(): assert sha(service/rel)==record['after'],rel
shutil.copytree(source/'fixture',takeover/'forge-host-local-fixture')
env={**os.environ,'FORGE_WIDE_ENTRY':str(takeover/'wide-screen-entry.patch')}
subprocess.run(['node',str(browser/'materialize.mjs')],env=env,check=True,stdout=subprocess.DEVNULL)
assert not (browser/'runtime').is_symlink()
assert protected=={str(p.relative_to(base)):sha(p) for p in base.rglob('*') if p.is_file()},'Source archive mutated'
print(json.dumps({'prepared':True,'sourceFilesVerified':len(json.loads((source/'SOURCE-SHA256.json').read_text())),'integrationFilesVerified':len(entries),'hostChangesVerified':len(changes),'frozenNative':'0146','nativeAndBrowserSourcesUnmodified':True}))
