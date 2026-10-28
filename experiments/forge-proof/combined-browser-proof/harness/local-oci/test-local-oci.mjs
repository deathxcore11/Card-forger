// UNIT TESTS ONLY: all OCI/container/runtime evidence below is explicitly SYNTHETIC.
// No image build, Docker daemon, native process, registry or browser is used.
import {spawnSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {gzipSync} from 'node:zlib';
import {verifyLocalOciLayout,assertSameContainerImage,sha256,SCOPE} from './oci-identity.mjs';
import {createLocalTestPolicy,verifyExactLocalInitialization,verifyLocalPolicyReceipt,validateLocalTestPolicy} from './local-test-policy.mjs';
import {pathToFileURL} from 'node:url';
import {reviewedCandidateRoot,reviewedHostRoot,digest,NATIVE_SCHEMA} from './reviewed-host.mjs';
const {ENGINE_REVISION,AI_PATCHSET_VERSION,AI_PATCHSET_SHA256,AI_CLASS_SET_SHA256,EXPECTED_RULES,CPU_POLICIES,validateReleasePolicy}=await import(pathToFileURL(path.join(reviewedHostRoot,'src/release-policy.mjs')));
const {nativeAdapter:productionAdapter}=await import(pathToFileURL(path.join(reviewedHostRoot,'src/native-adapter-next.mjs')));
async function readReviewedRuntimeIndex(){
 for(const relative of ['native/cpu/runtime-sha256.json','build-context/native/cpu/runtime-sha256.json','context/native/cpu/runtime-sha256.json']){
  const file=path.join(reviewedCandidateRoot,relative);let st;try{st=await lstat(file);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=131072,'Bounded regular reviewed runtime index required');const bytes=await readFile(file);assert.equal(sha256(bytes),AI_CLASS_SET_SHA256,'Reviewed runtime class-set identity mismatch');return bytes;
 }
 throw Error('Reviewed candidate runtime index missing');
}
const now=Date.parse('2026-10-28T12:00:00Z'),version='forge-heuristic-medium-beta-v1',profile=CPU_POLICIES[version];
async function syntheticOCI({gzip=false,layerBytes=1024}={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'SYNTHETIC-OCI-UNIT-'));await mkdir(path.join(root,'blobs','sha256'),{recursive:true});
 const blob=async(bytes,mediaType)=>{const digest='sha256:'+sha256(bytes);await writeFile(path.join(root,'blobs','sha256',digest.slice(7)),bytes);return {mediaType,digest,size:bytes.length};};
 const tar=Buffer.alloc(layerBytes),layer=await blob(gzip?gzipSync(tar):tar,'application/vnd.oci.image.layer.v1.tar'+(gzip?'+gzip':''));
 const config={architecture:'amd64',os:'linux',rootfs:{type:'layers',diff_ids:['sha256:'+sha256(tar)]},config:{Labels:{'test-only':'SYNTHETIC_UNIT_FIXTURE'}}};
 const configDesc=await blob(Buffer.from(JSON.stringify(config)),'application/vnd.oci.image.config.v1+json');
 const manifest={schemaVersion:2,mediaType:'application/vnd.oci.image.manifest.v1+json',config:configDesc,layers:[layer]};
 const descriptor=await blob(Buffer.from(JSON.stringify(manifest)),manifest.mediaType);
 await writeFile(path.join(root,'oci-layout'),JSON.stringify({imageLayoutVersion:'1.0.0'}));await writeFile(path.join(root,'index.json'),JSON.stringify({schemaVersion:2,manifests:[descriptor]}));
 const dockerImageInspect={Id:configDesc.digest,Os:'linux',Architecture:'amd64',RootFS:{Layers:config.rootfs.diff_ids}};
 const containerInspect={Id:'a'.repeat(64),Image:configDesc.digest,HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Memory:4294967296,MemorySwap:4294967296,NanoCpus:500000000,PidsLimit:256},Config:{User:'10001:10001',Entrypoint:['python3','/opt/host-service/bootstrap.py']}};
 return {root,manifestDigest:descriptor.digest,dockerImageInspect,containerInspect,layer,configDesc,syntheticUnitFixture:true,cleanup:()=>rm(root,{recursive:true,force:true})};
}
async function syntheticPolicy(f){
 const identity=await verifyLocalOciLayout(f.root,f),imageSourceBytes=Buffer.from('// SYNTHETIC UNIT SOURCE, never a runtime attestation\n');
 const reviewedSourceSha256=sha256(imageSourceBytes),reviewedManifestBytes=Buffer.from(reviewedSourceSha256+'  adapter/src/cardstashy/forge/ForgeHttpBridge.java\n'),reviewedManifestSha256=sha256(reviewedManifestBytes);
 const runtimeIndexBytes=await readReviewedRuntimeIndex();
 const classes=JSON.parse(runtimeIndexBytes),buildAttestationBytes=Buffer.from(JSON.stringify({schema:'cardstashy.native-ai-build-attestation.v1',forgeRevision:ENGINE_REVISION,classSetSha256:AI_CLASS_SET_SHA256,classCount:12,classes,actualCompilerBytecodeMatchesReviewed:true,differentCompilerHashFallbackAllowed:false,javacVersion:'javac 21.0.9',syntheticUnitFixture:true}));
 const input={difficultyPolicyVersion:version,humanDeck:{syntheticUnitFixture:true},opponentDeck:{syntheticUnitFixture:true}},allocation={requestDigest:await digest(input),deckDigests:{human:'1'.repeat(64),opponent:'2'.repeat(64)}};
 const receipt={schema:'cardstashy.forge-exact-initialization.v1',engineRevision:ENGINE_REVISION,supported:true,legal:true,registeredRosterVerified:true,nativeRosterVerified:true,viewerId:0,requestDigest:allocation.requestDigest,humanDigest:allocation.deckDigests.human,opponentDigest:allocation.deckDigests.opponent,humanRosterDigest:'3'.repeat(64),opponentRosterDigest:'4'.repeat(64),errors:[],policyVersion:version,aiProfile:profile.profile,controlMode:'smart',cpuPolicyRuntimeVerified:true,nativeLegal:true,
  cpuPolicy:{difficultyPolicyVersion:version,aiProfile:profile.profile,profileSha256:profile.profileSha256,controlMode:'smart',forgeCommit:ENGINE_REVISION,aiPatchsetVersion:AI_PATCHSET_VERSION,aiPatchsetSha256:AI_PATCHSET_SHA256,runtimeClassSetSha256:AI_CLASS_SET_SHA256,nativeBuildAttestationSha256:sha256(buildAttestationBytes),buildCompilerVersion:'javac 21.0.9',runtimeJavaVersion:'21.0.9+10-LTS',runtimeBytecodeVerified:true,runtimeSettingsVerified:true,admissionAllowed:true,admissionScope:'bounded-experimental-native-integration',nativeAiModified:true,monteCarlo:false,legacySimulation:false,strictServiceLatencyProven:false,nativePriorityTimeoutSeconds:5,opponentDeckKnowledge:'secret-current-lawful-observations-only',calibration:'experimental-bounded-tactical-corpus-not-universal-strength-ranking'},
  humanPriority:{schema:'cardstashy.human-priority-receipt.v1',sourceManifestSha256:'23b9220fb5fe8646ab3784a2e19c6c43d968dabed719bc8c59c88f00cc26350c',classManifestSha256:'61ad2c7b314ce2d091f96f1fb89dfffc1e7c6634058a019e49978904b660570e',buildAttestationSha256:'a'.repeat(64),runtimeBytecodeVerified:true,assessment:'bounded-human-feasibility-tristate-v1',uncertaintyPreservesPriority:true},
  rulesData:{schema:'cardstashy.rules-data-receipt.v1',mode:'current',engineRevision:ENGINE_REVISION,decksVerified:true,...EXPECTED_RULES}};
 const probe={state:{schema:NATIVE_SCHEMA,forgeRevision:ENGINE_REVISION,status:'running',viewer:0,initialization:receipt},epoch:'SYNTHETIC_UNIT_EPOCH',responseStatus:200,responseHeaders:{'x-host-epoch':'SYNTHETIC_UNIT_EPOCH','x-host-native-source-sha256':reviewedSourceSha256,'x-host-native-manifest-sha256':reviewedManifestSha256},input,allocation};
 const args={identity,artifactContainerInspect:f.containerInspect,probeContainerInspect:f.containerInspect,reviewedManifestBytes,reviewedManifestSha256,reviewedSourceSha256,imageSourceBytes,imageCheckpointBytes:Buffer.from(JSON.stringify({nativeManifestSha256:reviewedManifestSha256,sha256:{'experiments/forge-proof/native/adapter/src/cardstashy/forge/ForgeHttpBridge.java':reviewedSourceSha256}})),buildAttestationBytes,runtimeIndexBytes,probe,now};
 return {identity,policy:await createLocalTestPolicy(args),args,probe};
}
for(const gzip of [false,true])test('SYNTHETIC OCI '+(gzip?'gzip':'plain')+' digest/config/layer relation',async()=>{const f=await syntheticOCI({gzip});try{const id=await verifyLocalOciLayout(f.root,f);assert.equal(id.scope,SCOPE);assert.notEqual(id.ociManifestDigest,id.dockerImageId);assertSameContainerImage(id,f.containerInspect);}finally{await f.cleanup();}});
test('OCI tampered layer and Docker config ID fail closed',async()=>{const f=await syntheticOCI();try{await assert.rejects(verifyLocalOciLayout(f.root,{...f,dockerImageInspect:{...f.dockerImageInspect,Id:'sha256:'+'0'.repeat(64)}}));await writeFile(path.join(f.root,'blobs','sha256',f.layer.digest.slice(7)),Buffer.alloc(1024,1));await assert.rejects(verifyLocalOciLayout(f.root,f));}finally{await f.cleanup();}});
test('runtime container/network/resources/entrypoint are bound; serialized identity cannot bypass verifier',async()=>{const f=await syntheticOCI();try{const id=await verifyLocalOciLayout(f.root,f);for(const change of [c=>c.Image='sha256:'+'0'.repeat(64),c=>c.HostConfig.NetworkMode='bridge',c=>c.HostConfig.ReadonlyRootfs=false,c=>c.HostConfig.Memory=0,c=>c.Config.Entrypoint=['sh']]){const c=structuredClone(f.containerInspect);change(c);assert.throws(()=>assertSameContainerImage(id,c));}assert.throws(()=>assertSameContainerImage(JSON.parse(JSON.stringify(id)),f.containerInspect));}finally{await f.cleanup();}});
test('SYNTHETIC policy retains CPU/rules/roster checks; never production-selectable',async()=>{const f=await syntheticOCI();try{const {identity,policy,probe}=await syntheticPolicy(f);assert.equal(policy.scope,SCOPE);assert.equal(policy.deployable,false);assert(!Object.hasOwn(policy,'containerImage'));assert.throws(()=>validateReleasePolicy(policy,identity.ociManifestDigest,now));assert.equal(productionAdapter({FORGE_RELEASE_POLICY_JSON:JSON.stringify(policy),FORGE_CONTAINER_IMAGE:identity.ociManifestDigest},{now:()=>now}).ready,false);assert.throws(()=>validateLocalTestPolicy(JSON.parse(JSON.stringify(policy)),identity,now));
 for(const [key,value]of Object.entries(probe.state.initialization.cpuPolicy)){const r=structuredClone(probe.state.initialization);r.cpuPolicy[key]=typeof value==='boolean'?!value:typeof value==='number'?value+1:'SYNTHETIC_MISMATCH';assert.throws(()=>verifyLocalPolicyReceipt(r,probe.input,policy,identity,now),key);}
 for(const key of Object.keys(probe.state.initialization.rulesData)){const r=structuredClone(probe.state.initialization);r.rulesData[key]='SYNTHETIC_MISMATCH';assert.throws(()=>verifyLocalPolicyReceipt(r,probe.input,policy,identity,now),key);}
 for(const key of ['supported','legal','registeredRosterVerified','nativeRosterVerified','viewerId','requestDigest','humanDigest','opponentDigest','humanRosterDigest','opponentRosterDigest','errors']){const p=structuredClone(probe);p.state.initialization[key]=key==='errors'?['SYNTHETIC_FAILURE']:false;await assert.rejects(verifyExactLocalInitialization({...p,policy,identity,now}),undefined,key);}
 for(const key of Object.keys(probe.responseHeaders)){const p=structuredClone(probe);p.responseHeaders[key]='SYNTHETIC_MISMATCH';await assert.rejects(verifyExactLocalInitialization({...p,policy,identity,now}),undefined,key);}
 await assert.rejects(verifyExactLocalInitialization({...probe,responseStatus:503,policy,identity,now}));assert.throws(()=>validateLocalTestPolicy(policy,identity,Date.parse('2026-11-04T00:00:00Z')));
 }finally{await f.cleanup();}});
test('attestation, native source and manifest evidence cannot be replaced',async()=>{const f=await syntheticOCI();try{const {args}=await syntheticPolicy(f);for(const key of ['reviewedManifestBytes','imageSourceBytes','imageCheckpointBytes','buildAttestationBytes','runtimeIndexBytes'])await assert.rejects(createLocalTestPolicy({...args,[key]:Buffer.from('{}')}),undefined,key);}finally{await f.cleanup();}});
test('production CPU/rules predicates are copied verbatim; production has no local selector',async()=>{
 const production=await readFile(path.join(reviewedHostRoot,'src/release-policy.mjs'),'utf8'),local=await readFile(new URL('./local-test-policy.mjs',import.meta.url),'utf8');
 assert.equal(sha256(production),'5d97d7a61ddf703a274f08635c21a13775c62204799fe75c8092897855a965bd');
 const start='  const policy = selectedPolicy(input?.difficultyPolicyVersion)';assert.equal(local.slice(local.indexOf(start)),production.slice(production.indexOf(start)));
 for(const file of ['worker.mjs','native-adapter-next.mjs','release-policy.mjs']){const text=await readFile(path.join(reviewedHostRoot,'src',file),'utf8');assert(!/local-oci|LOCAL_TEST_NOT_DEPLOYABLE|local-test-policy/.test(text));}
});

test('OCI verification rejects pre-abort and cancels ongoing bounded hashing',async()=>{const f=await syntheticOCI({layerBytes:32*1024*1024});try{const pre=new AbortController();pre.abort();await assert.rejects(verifyLocalOciLayout(f.root,{...f,signal:pre.signal}),{name:'AbortError'});const active=new AbortController();const timer=setTimeout(()=>active.abort(),10);try{await assert.rejects(verifyLocalOciLayout(f.root,{...f,signal:active.signal}),{name:'AbortError'});}finally{clearTimeout(timer);}}finally{await f.cleanup();}});

// A package import must never guess a sibling candidate when its explicit input is absent.
test('reviewed host import fails closed when explicit candidate input is absent or empty',()=>{
 for(const value of [undefined,'','   ']){
  const env={...process.env};if(value===undefined)delete env.FORGE_COMBINED_CANDIDATE_ROOT;else env.FORGE_COMBINED_CANDIDATE_ROOT=value;
  const result=spawnSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('./reviewed-host.mjs',import.meta.url).href)+')'],{env,encoding:'utf8',timeout:3000,maxBuffer:16384});
  assert.equal(result.error,undefined);assert.notEqual(result.status,0);assert.match(result.stderr,/Explicit FORGE_COMBINED_CANDIDATE_ROOT is required/);
 }
});
