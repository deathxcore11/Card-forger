#!/usr/bin/env python3
"""LOCAL composition only. Requires explicit reviewed source-manifest pin; no build/push/deploy."""
import argparse,hashlib,json,re
from pathlib import Path
HERE=Path(__file__).resolve().parents[1]
ENGINE='e5a0f8156da70ffc7866f923bed371c0111707cd'
BOOTSTRAP='f527cdd5ba61faab856690aa72fd01a0535be9ff904efdb435eced4258d9859d'
CAPABILITIES=['cardstashy.match-input.v1','cardstashy.formats-three.v1','cardstashy.rules-data.v1','cardstashy.native-concession.v1','cardstashy.native-affordances.v1','cardstashy.experimental-heuristic-cpu.v1','cardstashy.forge-visibility.v1']
REQUIRED_JAVA=['ForgeHttpBridge','NativeDeckInput','NativeDeckAdmission','NativeMatchFormat','NativeRulesData','BoundedHeuristicPolicy','NativeCpuPolicyIntegration','NativePatchsetProof']
REQUIRED=['LICENSE','PROVENANCE.md','adapter/CONTRACT.md','EXACT-INPUT.md','RULES-DATA.md','EXPERIMENTAL-CPU.md','BASE-CANDIDATE.json','build-ai-overlay.sh','cpu/combined-native-ai.patch','cpu/runtime-sha256.json','rules-data/current/manifest.json','rules-data/current/cards.json','rules-data/current/official-format-facts.json']+[f'decks/{name}.dck' for name in ['calling-all-angels','keen-engineering','reign-of-dragons']]
def sha(data):return hashlib.sha256(data).hexdigest()
def regular(path,maximum=16*1024*1024):
 if path.is_symlink() or not path.is_file() or path.stat().st_size>maximum:raise ValueError('bounded regular source required:'+str(path))
 return path.read_bytes()
def compose(native,expected,destination,bootstrap):
 if not re.fullmatch('[a-f0-9]{64}',expected):raise ValueError('reviewed manifest SHA256 required')
 manifest=regular(native/'SHA256SUMS',2*1024*1024)
 if sha(manifest)!=expected:raise ValueError('native manifest mismatch')
 declared={}
 for line in manifest.decode().splitlines():
  value,name=line.split(None,1);declared[name.removeprefix('./')]=value
 java=sorted(name for name in declared if re.fullmatch(r'adapter/src/cardstashy/forge/[A-Za-z_$][A-Za-z0-9_$]*\.java',name))
 if not all('adapter/src/cardstashy/forge/'+name+'.java' in java for name in REQUIRED_JAVA):raise ValueError('next native CPU/rules sources absent')
 files={}
 for name in REQUIRED+java:
  data=regular(native/name)
  if sha(data)!=declared.get(name):raise ValueError('native file hash mismatch:'+name)
  files['native/'+('CONTRACT.md' if name=='adapter/CONTRACT.md' else name)]=data
 if sha(files['native/cpu/combined-native-ai.patch'])!='cd14c95185c4bfd44e90a809a6095f2027f23d102c1cf04464533ca545a0a4b1':raise ValueError('AI patch mismatch')
 if sha(files['native/cpu/runtime-sha256.json'])!='e39ea6388050f31319b121c0605fde23069d35e7133a203fd19f0a6c72528f80':raise ValueError('AI class manifest mismatch')
 if sha(files['native/rules-data/current/manifest.json'])!='374282d37829bf78913508db7d2e7f85e3c85e2c9bf282e4c72e196fec8621c1':raise ValueError('rules manifest mismatch')
 bootstrap_bytes=regular(bootstrap)
 if sha(bootstrap_bytes)!=BOOTSTRAP:raise ValueError('bootstrap mismatch')
 source_sha=declared['adapter/src/cardstashy/forge/ForgeHttpBridge.java']
 docker=regular(HERE/'container/Dockerfile.template').decode().replace('__NATIVE_SOURCE_SHA256__',source_sha).replace('__NATIVE_MANIFEST_SHA256__',expected)
 gateway=regular(HERE/'container/gateway.py');assembly=regular(HERE/'container/assemble.sh')
 checkpoint={'checkpoint':'next-cpu-native-manifest:'+expected,'forgeRevision':ENGINE,'nativeManifestSha256':expected,'adapterCapabilities':CAPABILITIES,'sha256':{'experiments/forge-proof/native/'+name.removeprefix('native/'):sha(data) for name,data in files.items()},'gatewaySha256':sha(gateway),'bootstrapSha256':BOOTSTRAP,'runtimeBuildAttestation':'must be generated and verified by actual BUILD_IMAGE JDK, then bound to tested immutable image'}
 files.update({'Dockerfile':docker.encode(),'hosting/gateway.py':gateway,'hosting/assemble.sh':assembly,'hosting/bootstrap.py':bootstrap_bytes,'hosting/checkpoint-files.json':(json.dumps(checkpoint,indent=2)+'\n').encode(),'.dockerignore':b'**\n!Dockerfile\n!hosting/\n!hosting/**\n!native/\n!native/**\n**/__pycache__/**\n**/*.pyc\n'})
 if any('native/cpu/'+name in files for name in ['build-attestation.json','runtime-classes','native-source']):raise ValueError('local generated CPU output must not be input')
 destination.mkdir(parents=True,exist_ok=False)
 for name,data in files.items():
  output=destination/name;output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(data)
 (destination/'CONTEXT-SHA256.json').write_text(json.dumps({name:sha(data) for name,data in files.items()},indent=2)+'\n')
 return {'composed':True,'files':len(files),'nativeManifestSha256':expected,'nativeSourceSha256':source_sha,'built':False,'pushed':False,'deployed':False}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 for flag in ['native','destination','bootstrap']:parser.add_argument('--'+flag,type=Path,required=True)
 parser.add_argument('--native-manifest-sha256',required=True);a=parser.parse_args();print(json.dumps(compose(a.native,a.native_manifest_sha256,a.destination,a.bootstrap)))
