#!/usr/bin/env python3
"""Compose a minimal LOCAL image context from explicitly pinned reviewed inputs.

Does not download, build, push, deploy, inspect credentials or modify sources.
A caller must supply expected native-manifest AND exact-gateway SHA256 values.
Base images have NO default: later build must supply reviewed digest-pinned ARGs.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parents[1]
FORGE_REVISION = 'e5a0f8156da70ffc7866f923bed371c0111707cd'
PREFIX = 'experiments/forge-proof/native/'
TEMPLATE_HASHES = {
    'Dockerfile': '8808fe171b0e8fb8022a3c5cf8d7be2e07bf87427e424df7657f44f25768b309',
    'assemble.sh': '0fbdb4e336788e0f2e7186234928765e9bf9411110d369626319a32768f742a3',
}
NATIVE_FILES = {
    'LICENSE': 'LICENSE', 'PROVENANCE.md': 'PROVENANCE.md', 'adapter/CONTRACT.md': 'CONTRACT.md',
    'EXACT-INPUT.md': 'EXACT-INPUT.md',
    **{f'adapter/src/cardstashy/forge/{name}.java': f'adapter/src/cardstashy/forge/{name}.java' for name in ['ForgeHttpBridge', 'NativeDeckInput', 'NativeDeckAdmission']},
    **{f'decks/{name}.dck': f'decks/{name}.dck' for name in ['calling-all-angels', 'keen-engineering', 'reign-of-dragons']},
}
def sha(data): return hashlib.sha256(data).hexdigest()
def regular(path):
    if path.is_symlink() or not path.is_file(): raise ValueError('Expected regular reviewed input: ' + path.name)
    return path.read_bytes()
def compose(native, hosting, gateway, destination, native_manifest_sha, gateway_sha):
    for expected in [native_manifest_sha, gateway_sha]:
        if not re.fullmatch('[a-f0-9]{64}', expected): raise ValueError('Explicit pinned SHA256 required')
    manifest_bytes = regular(native / 'SHA256SUMS')
    if sha(manifest_bytes) != native_manifest_sha: raise ValueError('Native manifest hash mismatch')
    declared = {}
    for line in manifest_bytes.decode().splitlines():
        expected, name = line.split(None, 1); declared[name.removeprefix('./')] = expected
    verified = {}
    for source, target in NATIVE_FILES.items():
        data = regular(native / source)
        if sha(data) != declared.get(source): raise ValueError('Native input hash mismatch: ' + source)
        verified['native/' + target] = data
    gateway_data = regular(gateway)
    if sha(gateway_data) != gateway_sha: raise ValueError('Exact gateway hash mismatch')
    if b'HOST_ABSOLUTE_DEADLINE_MS' not in gateway_data or b'proof.requireExact=true' not in gateway_data:
        raise ValueError('Exact gateway capability/deadline seam missing')
    for name, expected in TEMPLATE_HASHES.items():
        if sha(regular(hosting / name)) != expected: raise ValueError('Reviewed host template hash mismatch: ' + name)
    original_manifest = json.loads(regular(hosting / 'checkpoint-files.json'))
    if original_manifest['forgeRevision'] != FORGE_REVISION: raise ValueError('Pinned Forge revision mismatch')
    docker = regular(hosting / 'Dockerfile').decode()
    docker = re.sub(r'^ARG BUILD_IMAGE=.*$', 'ARG BUILD_IMAGE', docker, flags=re.M)
    docker = re.sub(r'^ARG RUNTIME_IMAGE=.*$', 'ARG RUNTIME_IMAGE', docker, flags=re.M)
    docker = docker.replace('COPY hosting/gateway.py /opt/host001/gateway.py', 'COPY hosting/gateway.py /opt/host001/gateway.py\nCOPY hosting/bootstrap.py /opt/host-service/bootstrap.py')
    docker = docker.replace('ENTRYPOINT ["python3", "/opt/host001/gateway.py"]', 'ENTRYPOINT ["python3", "/opt/host-service/bootstrap.py"]')
    docker = docker.replace('frozen precon', 'reviewed exact input')
    docker = re.sub(r'org.opencontainers.image.revision="[^"]+"', 'org.opencontainers.image.revision="' + declared['adapter/src/cardstashy/forge/ForgeHttpBridge.java'] + '"', docker)
    docker += '\nLABEL org.cardstashy.native-manifest-sha256="' + native_manifest_sha + '"\n'
    assemble = regular(hosting / 'assemble.sh').decode()
    single = '/opt/forge-proof/adapter/src/cardstashy/forge/ForgeHttpBridge.java'
    if assemble.count(single) != 1: raise ValueError('Unexpected assembler shape')
    assemble = assemble.replace(single, '/opt/forge-proof/adapter/src/cardstashy/forge/*.java')
    manifest = {'checkpoint': 'exact-candidate-manifest:' + native_manifest_sha, 'forgeRevision': FORGE_REVISION,
                'adapterCapabilities': ['cardstashy.match-input.v1'],
                'sha256': {PREFIX + key.removeprefix('native/'): sha(value) for key,value in verified.items()},
                'gatewaySha256': gateway_sha, 'bootstrapSha256': sha(regular(HERE / 'container/bootstrap.py'))}
    verified.update({'Dockerfile': docker.encode(), 'hosting/assemble.sh': assemble.encode(),
                     'hosting/gateway.py': gateway_data, 'hosting/bootstrap.py': regular(HERE / 'container/bootstrap.py'),
                     'hosting/checkpoint-files.json': (json.dumps(manifest, indent=2)+'\n').encode(),
                     '.dockerignore': b'**\n!Dockerfile\n!hosting/\n!hosting/**\n!native/\n!native/**\n**/__pycache__/**\n**/*.pyc\n'})
    destination.mkdir(parents=True, exist_ok=False)
    for name,data in verified.items():
        target = destination / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
    (destination / 'CONTEXT-SHA256.json').write_text(json.dumps({name:sha(data) for name,data in verified.items()}, indent=2)+'\n')
    return {'result':'PASS', 'files':len(verified), 'nativeManifestSha256':native_manifest_sha, 'gatewaySha256':gateway_sha,
            'bootstrapIncludedAt':'/opt/host-service/bootstrap.py', 'built':False, 'deployed':False}
if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for flag in ['native','hosting','gateway','destination']: p.add_argument('--'+flag, required=True, type=Path)
    for flag in ['native-manifest-sha256','gateway-sha256']: p.add_argument('--'+flag, required=True)
    a=p.parse_args()
    print(json.dumps(compose(a.native,a.hosting,a.gateway,a.destination,a.native_manifest_sha256,a.gateway_sha256)))
