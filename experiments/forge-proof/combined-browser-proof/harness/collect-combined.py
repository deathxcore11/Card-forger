#!/usr/bin/env python3
"""Explicit sanitized output boundary. Never copies OCI/source/private workroot."""
import hashlib,json,pathlib,re,subprocess,sys
work,out,code,stage,cleanup=pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),int(sys.argv[3]),sys.argv[4],sys.argv[5]=='true'
HERE=pathlib.Path(__file__).resolve().parent
allowed_stages={'setup','image-build-export-probe','source-contracts','desktop','touch750','complete'}
assert stage in allowed_stages
subprocess.run(['python3',str(HERE/'artifacts.py'),str(work/'raw'),str(out),str(code),stage],check=True,stdout=subprocess.DEVNULL)
summary=json.loads((out/'summary.json').read_text());summary['scope']='LOCAL_TEST_NOT_DEPLOYABLE: actual same local OCI image; synthetic account/storage; no registry publication, Cloudflare deployment, real account or physical-device claim'
summary['cleanupFallbackConfirmed']=cleanup
preflight_path=work/'cleanup-preflight.json'
preflight={}
if preflight_path.is_file() and not preflight_path.is_symlink() and preflight_path.stat().st_size<=4096:
 raw=json.loads(preflight_path.read_text())
 if raw.get('schema')=='cardstashy.cleanup-preflight.v1':
  preflight={'result':'passed' if raw.get('result')=='passed' else 'failed','procfsMatchesNamespace':raw.get('procfsMatchesNamespace') is True}
  for k in ['testsRun','failures','errors','skipped','requiredTests']:
   if type(raw.get(k)) is int and 0<=raw[k]<=100:preflight[k]=raw[k]
preflight_verified=preflight.get('result')=='passed' and preflight.get('procfsMatchesNamespace') is True and preflight.get('testsRun')==preflight.get('requiredTests')==11 and all(preflight.get(k)==0 for k in ['failures','errors','skipped'])
summary['cleanupPreflight']=preflight
sha=lambda x:isinstance(x,str) and re.fullmatch(r'[a-f0-9]{64}',x) is not None
image_id=lambda x:isinstance(x,str) and re.fullmatch(r'sha256:[a-f0-9]{64}',x) is not None

def read(name):
 p=work/'image'/name
 if not p.is_file() or p.is_symlink() or p.stat().st_size>65536:return None
 d=json.loads(p.read_text());return d if isinstance(d,dict) else None

def safe_common(raw):
 if not raw:return {'result':'not-run','scope':'LOCAL_TEST_NOT_DEPLOYABLE','deployable':False,'registryPublication':False}
 assert raw.get('scope')=='LOCAL_TEST_NOT_DEPLOYABLE' and raw.get('deployable') is False and raw.get('registryPublication') is False
 return {'scope':'LOCAL_TEST_NOT_DEPLOYABLE','deployable':False,'registryPublication':False,'result':raw['result'] if raw.get('result') in ['passed','failed','running'] else 'failed','browserAcceptance':False}
image,probe=read('image-summary.json'),read('probe-summary.json');ci,cp=safe_common(image),safe_common(probe)
if image:assert image.get('schema')=='cardstashy.local-oci-build-summary.v1'
if probe:assert probe.get('schema')=='cardstashy.local-oci-probe-summary.v1'
ci['schema']='cardstashy.local-oci-build-summary.v1';cp['schema']='cardstashy.local-oci-probe-summary.v1'
for raw,clean in [(image,ci),(probe,cp)]:
 if not raw:continue
 for k in ['nativeSourceSHA256','nativeManifestSHA256','contextManifestSHA256','sourceSHA256','nativeBuildAttestationSha256','runtimeClassSetSha256','aiPatchsetSha256','selectedProfileSHA256','rulesManifestSHA256','humanDigest','opponentDigest','humanPrioritySourceSha256','humanPriorityClassesSha256','humanPriorityBuildSha256']:
  if sha(raw.get(k)):clean[k]=raw[k]
 for k in ['imageId','sameImageId','ociManifestDigest']:
  if image_id(raw.get(k)):clean[k]=raw[k]
 for k in ['sizeBytes','layers','buildCapSeconds','exportCapSeconds','probeCapSeconds','buildSeconds','exportSeconds','elapsedSeconds']:
  if type(raw.get(k)) is int and 0<=raw[k]<=32*1024*1024*1024:clean[k]=raw[k]
 for k in ['exactRosterVerified','cpuRulesRuntimeVerified','humanPriorityRuntimeVerified','privacyGatePassed','registeredRosterVerified','nativeRosterVerified']:
  clean[k]=raw.get(k) is True
 if raw.get('policyVersion')=='forge-heuristic-medium-beta-v1':clean['policyVersion']=raw['policyVersion']
 if isinstance(raw.get('buildCompilerVersion'),str) and re.fullmatch(r'javac 21\.[0-9]+\.[0-9]+[^\s]{0,32}',raw['buildCompilerVersion']):clean['buildCompilerVersion']=raw['buildCompilerVersion']
 if isinstance(raw.get('runtimeJavaVersion'),str) and re.fullmatch(r'21\.[A-Za-z0-9.+_-]{1,100}',raw['runtimeJavaVersion']):clean['runtimeJavaVersion']=raw['runtimeJavaVersion']
 for key,expected in {'buildImage':'maven:3.9.11-eclipse-temurin-21@sha256:463a1849665463254b2dd56e3a5b316f1596bc93d0571065c06ea05bb48ab8f4','runtimeImage':'eclipse-temurin:21-jre-jammy@sha256:8ecbec1f32912979c15b86aaf98f7082a77d318a7f92af3d9fe2c0fd2723df10'}.items():
  if raw.get(key)==expected:clean[key]=expected
 if raw.get('category') in ['cleanup-unconfirmed','assertion','stage-failed']:clean['category']=raw['category']
if probe:
 life=probe.get('cleanup') or {}
 cp['cleanup']={k:life.get(k) is True for k in ['confirmed','privateInputRemoved','removed']}
 cp['cleanup']['forced']=life.get('forced') is not False
 for k in ['starts','destroys','exitCode']:
  cp['cleanup'][k]=life[k] if type(life.get(k)) is int and 0<=life[k]<=256 else None
 cp['cleanup']['status']='exited' if life.get('status')=='exited' else 'unconfirmed'
 cp['cleanup']['oomKilled']=life.get('oomKilled') is not False
same_image=ci.get('result')==cp.get('result')=='passed' and image_id(ci.get('imageId')) and ci.get('imageId')==cp.get('sameImageId') and image_id(ci.get('ociManifestDigest')) and ci['ociManifestDigest']==cp.get('ociManifestDigest')
expected_source='b817b4f24702e9929378f9211492d4cc6e445803f62ad0e6dbc12947e543303b'
expected_manifest='1bb177ec2b54840e0e26a3159e30ee75007bf1d5911798ceb9046df7852c1ca3'
asserted_runtime={'humanPrioritySourceSha256':'a51adddc0000ee80916fb290bb7e31514181b5373b033866bf43ad49cad64f9c','humanPriorityClassesSha256':'e22e7d45a8a7f2aee5bedc168d2ca6d500a7e5894797ee7418bfcbdb93e1ab69','runtimeClassSetSha256':'e39ea6388050f31319b121c0605fde23069d35e7133a203fd19f0a6c72528f80','aiPatchsetSha256':'cd14c95185c4bfd44e90a809a6095f2027f23d102c1cf04464533ca545a0a4b1','selectedProfileSHA256':'d77ec318868fcdb8fe1dce8d8c2df336fe26d54e13b51f7aab13d259bdf70330','rulesManifestSHA256':'21707a19c7701be9a0a499264f73ef23374d4dd14d3848a6486110289706c28b'}
required_digest_fields=['humanPrioritySourceSha256','humanPriorityClassesSha256','humanPriorityBuildSha256','nativeBuildAttestationSha256','runtimeClassSetSha256','aiPatchsetSha256','selectedProfileSHA256','rulesManifestSHA256','humanDigest','opponentDigest']
valid_probe=same_image and ci.get('nativeSourceSHA256')==cp.get('sourceSHA256')==expected_source and ci.get('nativeManifestSHA256')==cp.get('nativeManifestSHA256')==expected_manifest and all(sha(cp.get(k)) for k in required_digest_fields) and cp.get('policyVersion')=='forge-heuristic-medium-beta-v1' and cp.get('buildCompilerVersion') and cp.get('runtimeJavaVersion') and all(cp.get(k) is True for k in ['exactRosterVerified','cpuRulesRuntimeVerified','humanPriorityRuntimeVerified','privacyGatePassed','registeredRosterVerified','nativeRosterVerified'])
life=cp.get('cleanup',{})
valid_probe=bool(valid_probe and all(cp.get(k)==v for k,v in asserted_runtime.items()) and ci.get('contextManifestSHA256')=='d6e293394d6a7e30aca37343a0d1996a58e983bab00cf84e113843d10699a5f7' and ci.get('buildImage') and ci.get('runtimeImage') and life.get('confirmed') and life.get('privateInputRemoved') and life.get('removed') and life.get('forced') is False and life.get('starts')==life.get('destroys')==1 and life.get('status')=='exited' and life.get('exitCode')==0 and life.get('oomKilled') is False)
browser_same_image=True
for name in ['desktop','touch750']:
 p=out/name/'summary.json'
 if not p.is_file():browser_same_image=False;continue
 case=json.loads(p.read_text());lc=case.get('cleanup',{});alloc=lc.get('allocations',[])
 if lc.get('imageId')!=ci.get('imageId') or len(alloc)!=(2 if name=='desktop' else 1) or any(a.get('imageId')!=ci.get('imageId') or not a.get('confirmed') for a in alloc):browser_same_image=False
summary['sameImageBrowserAllocationsVerified']=browser_same_image
summary['sameImageProbeVerified']=valid_probe;summary['image']={k:ci.get(k) for k in ['result','imageId','ociManifestDigest']};summary['probe']={'result':cp.get('result'),'cleanupConfirmed':valid_probe}
if not preflight_verified or not cleanup or not valid_probe or not browser_same_image or stage!='complete' or code!=0:summary['result']='failed'
for name,data in [('image-summary.json',ci),('probe-summary.json',cp),('summary.json',summary)]:
 (out/name).write_text(json.dumps(data,indent=2)+'\n')
for p in out.rglob('*'):
 if p.is_file():assert p.name in {'summary.json','image-summary.json','probe-summary.json','setup.png','opening.png','resolved.png','terminal.png','complete.png','failure.png'} and not p.is_symlink() and b'Bearer ' not in p.read_bytes() and b'forge-browser-fixture-owner' not in p.read_bytes()
assert sum(p.stat().st_size for p in out.rglob('*') if p.is_file())<=10*1024*1024
# Written only after every recursive privacy/size/schema gate has completed.
verified={'schema':'cardstashy.sanitized-artifact.v1','verified':True,'result':summary['result'],'files':{str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file()}}
(out/'verified-artifact.json').write_text(json.dumps(verified,indent=2)+'\n')
print(json.dumps(summary))
sys.exit(0 if summary['result']=='passed' else 1)
