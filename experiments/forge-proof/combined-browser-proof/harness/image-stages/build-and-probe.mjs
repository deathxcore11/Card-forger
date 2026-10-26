// Build/export/probe ONE actual local image. This module performs external
// Docker actions only when explicitly invoked after the parent's source review.
import assert from 'node:assert/strict';import {readFile,writeFile,mkdir,lstat,rm,realpath,statfs,readdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {command} from './command.mjs';import {PINS,SCOPE,BUILD_IMAGE,RUNTIME_IMAGE,IMAGE_INSPECT_FORMAT} from './pins.mjs';
import {readBounded,assertHostManifest,assertProbeCleanup,BUNDLE_SCHEMA} from './load-evidence.mjs';import {publicMediumInput} from './public-input.mjs';import {probeImage} from './probe-image.mjs';
import {verifyLocalOciLayout,sha256} from '../local-oci/oci-identity.mjs';
import {createImageOwnershipLedger,assertImageOwnership} from './image-ownership.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
export async function assertContextInventory(contextRoot,entries){
 const actual=[];
 async function walk(dir,prefix='',depth=0){
  assert(depth<32,'Context directory nesting exceeds bound');
  const current=await lstat(dir);assert(current.isDirectory()&&!current.isSymbolicLink(),'Context directory symlink rejected');
  for(const name of await readdir(dir)){
   const relative=prefix+name,file=path.join(dir,name),st=await lstat(file);
   assert(!st.isSymbolicLink(),'Context symlink rejected');
   if(st.isDirectory())await walk(file,relative+'/',depth+1);
   else{assert(st.isFile(),'Context special file rejected');actual.push(relative);assert(actual.length<=1024,'Context file count exceeds bound');}
  }
 }
 await walk(contextRoot);
 const expected=[...Object.keys(entries),'CONTEXT-SHA256.json'].sort();
 assert.deepEqual(actual.sort(),expected,'Image context contains missing or unmanifested files');
}
export async function verifyCandidate(candidateRoot){
 const manifest=await readBounded(path.join(candidateRoot,'native/SHA256SUMS'));
 assert(sha256(manifest)===PINS.nativeManifestSha256,'Native source inventory is not reviewed');
 const source=await readBounded(path.join(candidateRoot,'native/adapter/src/cardstashy/forge/ForgeHttpBridge.java'));
 assert(sha256(source)===PINS.nativeSourceSha256,'Native source is not reviewed descendant');
 const host=await readBounded(path.join(candidateRoot,'HOST-SHA256.json'));await assertHostManifest(path.join(candidateRoot,'host'),host);
 const contextRoot=path.join(candidateRoot,'build-context'),context=await readBounded(path.join(contextRoot,'CONTEXT-SHA256.json'));
 assert(sha256(context)===PINS.contextManifestSha256,'Final image context inventory changed');
 const contextEntries=JSON.parse(context);await assertContextInventory(contextRoot,contextEntries);
 for(const [name,expected]of Object.entries(contextEntries)){assert(typeof name==='string'&&!name.startsWith('/')&&!name.split('/').includes('..'),'Unsafe context entry');assert(sha256(await readBounded(path.join(contextRoot,name),64*1024*1024))===expected,'Final image context differs from reviewed bytes');}
 assert(sha256(await readBounded(path.join(contextRoot,'native/adapter/src/cardstashy/forge/ForgeHttpBridge.java')))===PINS.nativeSourceSha256);
 return {nativeManifestBytes:manifest,hostManifestBytes:host};
}
export async function writeEvidenceBundle(work,{identity,reference,reviewed,proof}){
 const map={nativeManifest:['native-SHA256SUMS',reviewed.nativeManifestBytes],hostManifest:['host-SHA256.json',reviewed.hostManifestBytes],imageSource:['image-source.java',proof.artifacts.nativeSourceBytes],imageCheckpoint:['image-checkpoint.json',proof.artifacts.imageCheckpointBytes],buildAttestation:['actual-build-attestation.json',proof.artifacts.buildAttestationBytes],runtimeIndex:['actual-runtime-index.json',proof.artifacts.runtimeIndexBytes],probe:['actual-probe-private.json',Buffer.from(JSON.stringify(proof.probe))],probeInspect:['actual-probe-inspect.json',Buffer.from(JSON.stringify(proof.probeInspect))],probeCleanup:['actual-probe-cleanup.json',Buffer.from(JSON.stringify(proof.probeCleanup))]};
 assertProbeCleanup(proof.probeCleanup,identity.dockerImageId,proof.probeInspect.Id);
 const ownershipBytes=await readBounded(path.join(work,'image-ownership.json'),4096);
 const files={imageOwnership:{path:'image-ownership.json',bytes:ownershipBytes.length,sha256:sha256(ownershipBytes)}};for(const [key,[name,bytes]]of Object.entries(map)){assert(Buffer.isBuffer(bytes)&&bytes.length<=4*1024*1024,'Bounded actual evidence required');await writeFile(path.join(work,name),bytes,{flag:'wx',mode:0o600});files[key]={path:name,bytes:bytes.length,sha256:sha256(bytes)};}
 const bundle={schema:BUNDLE_SCHEMA,scope:SCOPE,deployable:false,registryPublication:false,createdForSameJob:true,ociLayout:'oci',dockerImageId:identity.dockerImageId,ociManifestDigest:identity.ociManifestDigest,reviewedNativeManifestSha256:PINS.nativeManifestSha256,reviewedNativeSourceSha256:PINS.nativeSourceSha256,policyVersion:PINS.policyVersion,publicFixture:reference,files};
 await writeFile(path.join(work,'evidence-bundle.json'),JSON.stringify(bundle,null,2)+'\n',{flag:'wx',mode:0o600});return bundle;
}
export async function buildAndProbe({candidateRoot,privateRoot,fixtureDecksPath,run=command,providerFactory,signal}={}){
 const reviewed=await verifyCandidate(candidateRoot);const {input,reference}=await publicMediumInput(fixtureDecksPath);
 await mkdir(privateRoot,{mode:0o700,recursive:false});const work=await realpath(privateRoot);
 const ownership=await createImageOwnershipLedger(work);
 const idFile=path.join(work,'image.id'),archive=path.join(work,'actual-image.docker.tar');let imageId=null,success=false;
 const summary={schema:'cardstashy.local-oci-build-summary.v1',identityKind:'local-docker-config-and-oci-manifest',scope:SCOPE,deployable:false,registryPublication:false,result:'running',nativeSourceSHA256:PINS.nativeSourceSha256,nativeManifestSHA256:PINS.nativeManifestSha256,contextManifestSHA256:PINS.contextManifestSha256,buildImage:BUILD_IMAGE,runtimeImage:RUNTIME_IMAGE,buildCapSeconds:600,exportCapSeconds:90,probeCapSeconds:180,browserAcceptance:false};
 try{
  signal?.throwIfAborted();let started=Date.now();
  await run('docker',['build','--platform','linux/amd64','--iidfile',idFile,'--label',ownership.labelKey+'='+ownership.jobNonce,'--build-arg','BUILD_IMAGE='+BUILD_IMAGE,'--build-arg','RUNTIME_IMAGE='+RUNTIME_IMAGE,path.join(candidateRoot,'build-context')],{signal,timeoutMs:600000,maxOutputBytes:50*1024*1024,outputFile:path.join(work,'private-build.log')});
  summary.buildSeconds=Math.ceil((Date.now()-started)/1000);imageId=(await readBounded(idFile,256)).toString().trim();assert(/^sha256:[a-f0-9]{64}$/.test(imageId),'Docker did not return immutable local image ID');
  const inspected=await run('docker',['image','inspect',imageId,'--format',IMAGE_INSPECT_FORMAT],{signal,timeoutMs:10000,maxOutputBytes:1024*1024});const imageInspect=JSON.parse(inspected.stdout.toString());assertImageOwnership(ownership,imageInspect,imageId);
  assert(imageInspect.Id===imageId&&imageInspect.Os==='linux'&&imageInspect.Architecture==='amd64'&&Number.isSafeInteger(imageInspect.Size)&&imageInspect.Size>0&&imageInspect.Size<=6*1024**3,'Unsupported local image metadata');
  const disk=await statfs(work);assert(Number(disk.bavail)*Number(disk.bsize)>imageInspect.Size*2+512*1024*1024,'Insufficient private export space');
  summary.imageId=imageId;summary.sizeBytes=imageInspect.Size;
  // One absolute export budget includes save, conversion and byte verification.
  const exportStarted=Date.now(),exportDeadline=exportStarted+90000;
  const remaining=()=>{const n=exportDeadline-Date.now();assert(n>0,'OCI export deadline exceeded');return n;};
  await run('docker',['image','save','--output',archive,imageId],{signal,timeoutMs:remaining(),maxOutputBytes:1024*1024});
  const converted=await run('python3',[path.join(HERE,'export-docker-oci.py'),archive,path.join(work,'oci'),imageId],{signal,timeoutMs:remaining(),maxOutputBytes:1024*1024});const exported=JSON.parse(converted.stdout.toString());
  const exportSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(remaining())]);
  const identity=await verifyLocalOciLayout(path.join(work,'oci'),{manifestDigest:exported.ociManifestDigest,dockerImageInspect:imageInspect,signal:exportSignal});remaining();await rm(archive);
  summary.exportSeconds=Math.ceil((Date.now()-exportStarted)/1000);summary.ociManifestDigest=identity.ociManifestDigest;summary.layers=identity.layerDigests.length;
  signal?.throwIfAborted();
  if(!providerFactory){const mod=await import('../local-oci/docker-provider.mjs');providerFactory=mod.makeDockerProvider;}
  const proof=await probeImage({identity,input,privateRoot:work,nativeManifestBytes:reviewed.nativeManifestBytes,providerFactory,signal});
  await writeEvidenceBundle(work,{identity,reference,reviewed,proof});success=true;summary.result='passed';
  return {bundlePath:path.join(work,'evidence-bundle.json'),imageId,summary};
 }catch(error){summary.result='failed';summary.failureCategory=error?.name==='AssertionError'?'assertion':'stage-failed';throw error;}
 finally{
  await rm(archive,{force:true}).catch(()=>{});
  if(!success){summary.imageRemovalConfirmed=false;try{imageId??=(await readBounded(idFile,256)).toString().trim();if(/^sha256:[a-f0-9]{64}$/.test(imageId)){const inspected=await run('docker',['image','inspect',imageId,'--format',IMAGE_INSPECT_FORMAT],{timeoutMs:5000,maxOutputBytes:1024*1024});assertImageOwnership(ownership,JSON.parse(inspected.stdout.toString()),imageId);await run('docker',['image','rm',imageId],{timeoutMs:10000,maxOutputBytes:1024*1024});}}catch{summary.imageRemovalConfirmed=false;}}
  await writeFile(path.join(work,'image-summary.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const controller=new AbortController();let interrupts=0;for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{interrupts++;controller.abort();if(interrupts>1)process.exitCode=1;});
 try{assert(/^[a-f0-9]{64}$/.test(process.env.FORGE_COMBINED_REVIEWED_MANIFEST_SHA256||''),'Reviewed package manifest gate required');const [candidateRoot,privateRoot,fixtureDecksPath]=process.argv.slice(2);assert(candidateRoot&&privateRoot&&fixtureDecksPath);const result=await buildAndProbe({candidateRoot:path.resolve(candidateRoot),privateRoot:path.resolve(privateRoot),fixtureDecksPath:path.resolve(fixtureDecksPath),signal:controller.signal});console.log(JSON.stringify({scope:SCOPE,result:'passed',evidenceBundle:result.bundlePath,imageId:result.imageId,registryPublication:false,browserAcceptance:false}));}
 catch{console.error(JSON.stringify({scope:SCOPE,result:'failed',category:'bounded-image-stage-failure',privateDiagnosticsNotUploaded:true}));process.exitCode=1;}
}
