"""Stage exact previously verified runtime bytes; never compiles or deploys."""
import gzip, hashlib, io, json, os, pathlib, subprocess, sys, tarfile, tempfile, zipfile
ARTIFACT=12584327345
ZIP_SHA='edb82685e8f71de64006da5f8cd188d738939c106ae19d67ad4281158cff513b'
WASM_SHA='a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee'
GLUE_SHA='7317b542201dea626776001e91f8d2fcbe92ae8108c9003da6c7ed41f59149cc'
TREE='60fc8715ad91f5c91b81f8a8335e238c623ec957'
BRANCH='codex/cardstashy-play-engine-20261024'
APPROVAL='APPROVED: stage verified CardStashy runtime'
PIN='71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234'
CARDS_SHA='0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9'
REL=pathlib.Path('experiments/phase-engine/runtime')/WASM_SHA[:16]
sha=lambda b:hashlib.sha256(b).hexdigest()
def package(archive,destination,rules_file=None):
    data=pathlib.Path(archive).read_bytes();assert sha(data)==ZIP_SHA
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        result=json.loads(z.read('verification-result.json'));assert result['passed'] and result['mechanicsCases']==8
        receipt=json.loads(z.read('build-receipt.json'))
        assert receipt['sourceTree']==TREE and receipt['wasmSha256']==WASM_SHA and receipt['glueSha256']==GLUE_SHA
        mechanics=json.loads(z.read('mechanics-report.json'));assert len(mechanics['cases'])==8 and all(c['passed'] for c in mechanics['cases'])
        with tarfile.open(fileobj=io.BytesIO(z.read('runtime-package.tar.gz')),mode='r:gz') as t:
            allowed={'pkg','pkg/engine_wasm.js','pkg/engine_wasm_bg.wasm','pkg/engine_wasm.d.ts','pkg/engine_wasm_bg.wasm.d.ts','pkg/package.json'}
            assert all(m.name in allowed and (m.isfile() or m.isdir()) for m in t.getmembers())
            wasm=t.extractfile('pkg/engine_wasm_bg.wasm').read();glue=t.extractfile('pkg/engine_wasm.js').read()
        assert sha(wasm)==WASM_SHA and sha(glue)==GLUE_SHA
        packed=gzip.compress(wasm,compresslevel=6,mtime=0);assert gzip.decompress(packed)==wasm
        dest=pathlib.Path(destination);assert not dest.exists();dest.mkdir(parents=True)
        chunks=[]
        for i,start in enumerate(range(0,len(packed),16*1024*1024)):
            b=packed[start:start+16*1024*1024];name=f'wasm.part-{i:02d}.bin';(dest/name).write_bytes(b);chunks.append({'path':name,'bytes':len(b),'sha256':sha(b)})
        assert gzip.decompress(b''.join((dest/c['path']).read_bytes() for c in chunks))==wasm
        (dest/'engine_wasm.js').write_bytes(glue)
        for name in ['LICENSE-MIT','LICENSE-APACHE','build-receipt.json']:(dest/name).write_bytes(z.read(name))
        manifest={'schema':1,'status':'research-runtime-not-public-play-adoption','buildIdentity':receipt['buildIdentity'],'sourceTree':TREE,'sourceCommit':receipt['sourceCommit'],'artifactId':ARTIFACT,'artifactZipSha256':ZIP_SHA,'wasmSha256':WASM_SHA,'wasmBytes':len(wasm),'encoding':'gzip','compressedSha256':sha(packed),'compressedBytes':len(packed),'chunks':chunks,'glue':{'path':'engine_wasm.js','sha256':GLUE_SHA},'limits':'External executable card-data and real-deck admission remain separate. No engine execution on the web server.'}
        if rules_file is not None:
            card_bytes=pathlib.Path(rules_file).read_bytes();assert sha(card_bytes)==CARDS_SHA
            unpacked=gzip.decompress(card_bytes);assert len(json.loads(unpacked))==6137
            (dest/'card-rules.bin').write_bytes(card_bytes)
            manifest['cardDatabase']={'path':'card-rules.bin','encoding':'gzip','sha256':CARDS_SHA,'bytes':len(card_bytes),'decodedSha256':sha(unpacked),'decodedBytes':len(unpacked),'entries':6137,'source':'pinned upstream integration fixture, not a full-card support certificate'}
        (dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        assert all(p.stat().st_size<25*1024*1024 for p in dest.iterdir())
        return manifest

def main():
    assert sys.argv[1:]==['--approved-stage'] and os.environ.get('GITHUB_ACTIONS')=='true'
    assert os.environ['GITHUB_REPOSITORY']=='deathxcore11/Card-forger' and os.environ['GITHUB_REF']=='refs/heads/'+BRANCH
    event=json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text());assert event['repository']['private'] and event['head_commit']['message']==APPROVAL
    expected=os.environ['GITHUB_SHA'];assert event['after']==expected
    git=lambda *args:subprocess.check_output(['git',*args],text=True).strip()
    assert git('rev-parse','HEAD')==expected and not git('status','--porcelain')
    with tempfile.TemporaryDirectory() as tmp:
        archive=pathlib.Path(tmp)/'runtime.zip'
        with archive.open('wb') as f:subprocess.run(['gh','api',f'repos/deathxcore11/Card-forger/actions/artifacts/{ARTIFACT}/zip'],stdout=f,check=True,timeout=120)
        rules=pathlib.Path(tmp)/'card-rules.gz'
        subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','120',f'https://raw.githubusercontent.com/phase-rs/phase/{PIN}/crates/engine/tests/fixtures/integration_cards.json.gz','--output',str(rules)],check=True,timeout=130)
        manifest=package(archive,REL,rules)
    assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==expected,'branch moved; no overwrite'
    subprocess.run(['git','add','-f','--',str(REL)],check=True)
    subprocess.run(['git','-c','user.name=CardStashy runtime packaging','-c','user.email=cardstashy-runtime@users.noreply.github.com','commit','-m','Stage verified Play runtime assets [skip ci]'],check=True)
    subprocess.run(['git','push',f'--force-with-lease=refs/heads/{BRANCH}:{expected}','origin',f'HEAD:refs/heads/{BRANCH}'],check=True,timeout=120)
    print(json.dumps({'commit':git('rev-parse','HEAD'),'path':str(REL),'chunks':len(manifest['chunks']),'compressedBytes':manifest['compressedBytes'],'decompressedBytesUnchanged':True}))
if __name__=='__main__':main()
