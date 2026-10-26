// Revalidate actual private files and reconstruct in-process brands; never trust
// a serialized policy or claim that a local OCI manifest is a registry digest.
import assert from 'node:assert/strict';import {readFile,lstat,realpath} from 'node:fs/promises';import path from 'node:path';
import {verifyLocalOciLayout,sha256} from '../local-oci/oci-identity.mjs';
import {createLocalTestPolicy} from '../local-oci/local-test-policy.mjs';
import {command} from './command.mjs';import {publicMediumInput} from './public-input.mjs';import {digest} from '../local-oci/reviewed-host.mjs';import {PINS,SCOPE,IMAGE_INSPECT_FORMAT} from './pins.mjs';
import {assertImageOwnership} from './image-ownership.mjs';
export const BUNDLE_SCHEMA='cardstashy.local-image-evidence-bundle.v1';
const requiredFiles=['imageOwnership','nativeManifest','hostManifest','imageSource','imageCheckpoint','buildAttestation','runtimeIndex','probe','probeInspect','probeCleanup'];
export async function readBounded(file,max=4*1024*1024){const st=await lstat(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,'Bounded regular evidence file required');return readFile(file);}
export async function assertHostManifest(serviceRoot,bytes){
 assert(sha256(bytes)===PINS.hostManifestSha256,'Final host manifest identity mismatch');
 const entries=JSON.parse(bytes);for(const [relative,expected]of Object.entries(entries)){
  assert(!relative.startsWith('/')&&!relative.split('/').includes('..')&&/^[a-f0-9]{64}$/.test(expected),'Invalid reviewed host entry');
  assert(sha256(await readBounded(path.join(serviceRoot,relative),32*1024*1024))===expected,'Host source differs from reviewed manifest');
 }
}
export function assertProbeCleanup(cleanup,imageId,containerId){
 assert(cleanup?.scope===SCOPE&&cleanup.imageId===imageId&&cleanup.containerId===containerId&&cleanup.confirmed===true&&cleanup.privateInputRemoved===true&&cleanup.removed===true&&cleanup.forced===false&&cleanup.starts===1&&cleanup.destroys===1&&cleanup.status==='exited'&&cleanup.exitCode===0&&cleanup.oomKilled===false,'Actual probe cleanup unconfirmed');
}
export async function loadEvidenceBundle(bundlePath,{serviceRoot,run=command,now=Date.now(),signal}={}){
 assert(typeof serviceRoot==='string'&&serviceRoot,'Explicit reviewed host root required');
 const st=await lstat(bundlePath);assert(st.isFile()&&!st.isSymbolicLink(),'Evidence bundle symlink rejected');
 const root=await realpath(path.dirname(bundlePath)),bundle=JSON.parse(await readBounded(bundlePath,128*1024));
 assert(bundle.schema===BUNDLE_SCHEMA&&bundle.scope===SCOPE&&bundle.deployable===false&&bundle.registryPublication===false&&bundle.ociLayout==='oci'&&bundle.createdForSameJob===true,'Invalid local image evidence bundle');
 assert(bundle.reviewedNativeManifestSha256===PINS.nativeManifestSha256&&bundle.reviewedNativeSourceSha256===PINS.nativeSourceSha256&&bundle.policyVersion===PINS.policyVersion,'Unreviewed native source/policy');
 assert(JSON.stringify(Object.keys(bundle.files).sort())===JSON.stringify(requiredFiles.sort()),'Unexpected evidence files');
 const bytes={};for(const name of requiredFiles){const f=bundle.files[name];assert(f&&/^[A-Za-z0-9_.-]{1,100}$/.test(f.path)&&/^[a-f0-9]{64}$/.test(f.sha256)&&Number.isSafeInteger(f.bytes),'Invalid private evidence descriptor');const value=await readBounded(path.join(root,f.path));assert(value.length===f.bytes&&sha256(value)===f.sha256,'Private evidence changed');bytes[name]=value;}
 await assertHostManifest(serviceRoot,bytes.hostManifest);
 assert(/^sha256:[a-f0-9]{64}$/.test(bundle.dockerImageId),'Immutable local config digest required');
 const loaderSignal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(120000)]);
 const inspected=await run('docker',['image','inspect',bundle.dockerImageId,'--format',IMAGE_INSPECT_FORMAT],{signal:loaderSignal,timeoutMs:10000,maxOutputBytes:1024*1024});
 const liveInspect=JSON.parse(inspected.stdout.toString());assertImageOwnership(JSON.parse(bytes.imageOwnership),liveInspect,bundle.dockerImageId);
 const identity=await verifyLocalOciLayout(path.join(root,'oci'),{manifestDigest:bundle.ociManifestDigest,dockerImageInspect:liveInspect,signal:loaderSignal});
 const probeInspect=JSON.parse(bytes.probeInspect),probe=JSON.parse(bytes.probe);
 const {input}=await publicMediumInput(bundle.publicFixture.path,bundle.publicFixture.sha256);probe.input=input;probe.allocation={requestDigest:await digest(input),deckDigests:{human:await digest(input.humanDeck),opponent:await digest(input.opponentDeck)}};
 assertProbeCleanup(JSON.parse(bytes.probeCleanup),identity.dockerImageId,probeInspect.Id);
 // Persisted probe state deliberately contains no board, hand, private snapshot,
 // token or environment. Only initialization metadata and public player IDs
 // needed to verify the committed first-player event survive.
 assert(JSON.stringify(Object.keys(probe.state||{}).sort())===JSON.stringify(['forgeRevision','initialization','schema','status','viewer','players','pregame'].sort()),'Unallowlisted private probe state');
 assert(Array.isArray(probe.state.players)&&probe.state.players.length===2&&probe.state.players.every(player=>Object.keys(player).length===1&&Number.isSafeInteger(player.id)&&player.id>=0),'Unallowlisted probe player metadata');
 const pregameKeys=['firstPlayerId','playStyle','schema','selection'].sort();
 for(const pregame of [probe.state.pregame,probe.state.initialization?.pregame])assert(pregame&&JSON.stringify(Object.keys(pregame).sort())===JSON.stringify(pregameKeys),'Unallowlisted probe pregame metadata');
 const policy=await createLocalTestPolicy({identity,artifactContainerInspect:probeInspect,probeContainerInspect:probeInspect,reviewedManifestBytes:bytes.nativeManifest,reviewedManifestSha256:PINS.nativeManifestSha256,reviewedSourceSha256:PINS.nativeSourceSha256,imageSourceBytes:bytes.imageSource,imageCheckpointBytes:bytes.imageCheckpoint,buildAttestationBytes:bytes.buildAttestation,runtimeIndexBytes:bytes.runtimeIndex,probe,now});
 return {identity,policy,sourceIdentity:{nativeSourceSHA256:PINS.nativeSourceSha256,forgeRevision:PINS.forgeRevision,difficultyPolicyVersion:PINS.policyVersion}};
}
