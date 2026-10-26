#!/usr/bin/env python3
"""LOCAL TEST ONLY: compile reviewed exact0146 into an ephemeral distribution."""
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path
EXPECTED_MANIFEST = 'a5e7e38bb72b937936f7db7d1fcacb4a2196dddf6f103e90203d1d778aa43813'
EXPECTED_SOURCE = '586511f3e9bf28a6918ef696ce614e50b5dbdf55c0b14d9a54f1fd89967aeddd'
def prepare(proof, candidate, output):
    os.umask(0o077)
    assert subprocess.check_output(['git','-C',str(proof/'forge'),'rev-parse','HEAD'],text=True).strip()=='e5a0f8156da70ffc7866f923bed371c0111707cd'
    assert hashlib.sha256((candidate/'SHA256SUMS').read_bytes()).hexdigest() == EXPECTED_MANIFEST
    hashes = {line.split(None, 1)[1].removeprefix('./'):line.split(None, 1)[0] for line in (candidate/'SHA256SUMS').read_text().splitlines() if line.strip()}
    source_dir=output/'adapter/src/cardstashy/forge'; source_dir.mkdir(parents=True)
    classes=output/'adapter/classes';classes.mkdir(parents=True)
    for name in ('ForgeHttpBridge.java','NativeDeckInput.java','NativeDeckAdmission.java'):
        key='adapter/src/cardstashy/forge/'+name;source=candidate/key
        assert source.is_file() and not source.is_symlink()
        assert hashlib.sha256(source.read_bytes()).hexdigest()==hashes[key]
        shutil.copy2(source,source_dir/name)
    assert hashlib.sha256((source_dir/'ForgeHttpBridge.java').read_bytes()).hexdigest()==EXPECTED_SOURCE
    (output/'forge').symlink_to(proof/'forge');(output/'decks').symlink_to(candidate/'decks')
    cp=':'.join([str(classes)]+[str(proof/'forge'/name/'target/classes') for name in ('forge-core','forge-game','forge-ai','forge-gui','forge-gui-desktop')]+[(proof/'forge/forge-gui-desktop/target/runtime-classpath.txt').read_text().strip()])
    (output/'runtime-classpath.txt').write_text(cp)
    subprocess.run([str(proof/'tools/jdk21/bin/javac'),'-cp',cp,'-d',str(classes),*map(str,source_dir.glob('*.java'))],check=True,timeout=90,stdout=subprocess.DEVNULL)
    (output/'local-test-checkpoint.json').write_text(json.dumps({'localTestOnly':True,'adapterCapabilities':['cardstashy.match-input.v1'],'sha256':{'experiments/forge-proof/native/adapter/src/cardstashy/forge/ForgeHttpBridge.java':EXPECTED_SOURCE}}))
    print(json.dumps({'prepared':True,'fixtureOnly':True,'nativeSourceSha256':EXPECTED_SOURCE}))
if __name__=='__main__':prepare(*[Path(p).resolve() for p in sys.argv[1:]])
