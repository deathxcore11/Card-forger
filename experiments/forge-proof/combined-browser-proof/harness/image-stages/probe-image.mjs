// Actual initialization probe only; NO browser, account service or registry use.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {createLocalTestPolicy} from '../local-oci/local-test-policy.mjs';
import {existingNativeTransport as bootstrapTransport,digest} from '../local-oci/reviewed-host.mjs';
import {assertNativePrivacy} from '../acceptance-contract.mjs';
import {PINS,SCOPE} from './pins.mjs';import {assertProbeCleanup} from './load-evidence.mjs';import {sha256} from '../local-oci/oci-identity.mjs';
const stateKeys=['schema','forgeRevision','status','viewer'];
const initKeys=['schema','engineRevision','supported','legal','registeredRosterVerified','nativeRosterVerified','viewerId','requestDigest','humanDigest','opponentDigest','humanRosterDigest','opponentRosterDigest','errors','policyVersion','aiProfile','controlMode','cpuPolicyRuntimeVerified','nativeLegal'];
const cpuKeys=['difficultyPolicyVersion','aiProfile','profileSha256','controlMode','forgeCommit','aiPatchsetVersion','aiPatchsetSha256','runtimeClassSetSha256','nativeBuildAttestationSha256','buildCompilerVersion','runtimeJavaVersion','runtimeBytecodeVerified','runtimeSettingsVerified','admissionAllowed','admissionScope','nativeAiModified','monteCarlo','legacySimulation','strictServiceLatencyProven','nativePriorityTimeoutSeconds','opponentDeckKnowledge','calibration'];
const rulesKeys=['schema','mode','engineRevision','decksVerified','version','manifestSha256','indexSha256','sourceSha256','sourceUpdatedAt','asOfDate','validUntilExclusive'];
const humanPriorityKeys=['schema','sourceManifestSha256','classManifestSha256','buildAttestationSha256','runtimeBytecodeVerified','assessment','uncertaintyPreservesPriority'];
const pregameKeys=['schema','firstPlayerId','selection','playStyle'];
export function receiptOnlyState(state){
 const pick=(value,keys)=>Object.fromEntries(keys.map(k=>[k,value?.[k]]));
 return {...pick(state,stateKeys),players:(state.players||[]).map(player=>pick(player,['id'])),pregame:pick(state.pregame,pregameKeys),initialization:{...pick(state.initialization,initKeys),pregame:pick(state.initialization?.pregame,pregameKeys),cpuPolicy:pick(state.initialization?.cpuPolicy,cpuKeys),rulesData:pick(state.initialization?.rulesData,rulesKeys),humanPriority:pick(state.initialization?.humanPriority,humanPriorityKeys)}};
}
const headersOf=response=>Object.fromEntries(['x-host-epoch','x-host-native-source-sha256','x-host-native-manifest-sha256'].map(k=>[k,response.headers.get(k)]));
async function json(response){const text=await response.text();assert(Buffer.byteLength(text)<=4*1024*1024,'Bounded native response required');return JSON.parse(text);}
export async function probeImage({identity,input,privateRoot,nativeManifestBytes,providerFactory,signal,now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 assert(input.difficultyPolicyVersion===PINS.policyVersion,'Only explicit reviewed Medium-beta probe supported');
 const started=now(),deadline=started+180000,activeDeadline=started+120000,token=randomUUID()+randomUUID();
 const allocation={requestDigest:await digest(input),deckDigests:{human:await digest(input.humanDeck),opponent:await digest(input.opponentDeck)},expiresAt:deadline};
 const providerRoot=path.join(privateRoot,'probe-provider');await mkdir(providerRoot,{mode:0o700});
 const provider=providerFactory({identity,privateRoot:providerRoot,id:'probe-'+randomUUID()});
 let success=false,probe,inspect,artifacts,policy,errorCategory;
 const ensure=()=>{signal?.throwIfAborted();if(now()>=activeDeadline)throw Error('bounded_probe_deadline');};
 try{
  const transport=bootstrapTransport({});provider.start(await transport.startOptions({internalToken:token,allocation,input}));
  const fetchExisting=request=>{ensure();return provider.getTcpPort(8080).fetch(request);};
  await transport.bootstrapExisting({input,internalToken:token,fetchExisting,deadline:Math.min(activeDeadline,now()+30000),now,wait});
  let value,responseHeaders,epoch,status;
  while(now()<activeDeadline){ensure();
   let ready;
   try{ready=await fetchExisting(new Request('http://host001.internal/ready',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)}));}
   catch(error){if(signal?.aborted)throw error;await wait(250);continue;}
   epoch=ready.headers.get('x-host-epoch');const readyStatus=ready.status;await ready.body?.cancel();
   if(readyStatus===200){
    assert(epoch,'Ready native instance lacks epoch');
    const stateResponse=await fetchExisting(new Request('http://host001.internal/state',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(5000)}));status=stateResponse.status;responseHeaders=headersOf(stateResponse);const state=await json(stateResponse);
    assert.equal(status,200,'Ready native state unavailable');assert.notEqual(state.status,'failed','Native initialization failed');assertNativePrivacy(state);value=receiptOnlyState(state);break;
   }
   await wait(250);
  }
  ensure();assert(value&&epoch,'Native initialization probe expired');inspect=await provider.inspect();artifacts=await provider.extractImageArtifacts();ensure();
  probe={state:value,epoch,responseStatus:status,responseHeaders,input,allocation};
  policy=await createLocalTestPolicy({identity,artifactContainerInspect:inspect,probeContainerInspect:inspect,reviewedManifestBytes:nativeManifestBytes,reviewedManifestSha256:PINS.nativeManifestSha256,reviewedSourceSha256:PINS.nativeSourceSha256,imageSourceBytes:artifacts.nativeSourceBytes,imageCheckpointBytes:artifacts.imageCheckpointBytes,buildAttestationBytes:artifacts.buildAttestationBytes,runtimeIndexBytes:artifacts.runtimeIndexBytes,probe,now:now()});
  success=true;
 }catch(error){errorCategory=error?.name==='AssertionError'?'assertion':'probe-failed';throw error;}
 finally{
  let cleanupError;try{await provider.destroy();}catch(error){cleanupError=error;}
  const evidence=provider.evidence();
  try{assertProbeCleanup(evidence.cleanup,identity.dockerImageId,inspect?.Id??evidence.cleanup?.containerId);}catch(error){cleanupError??=error;}
  await writeFile(path.join(privateRoot,'probe-summary.json'),JSON.stringify({schema:'cardstashy.local-oci-probe-summary.v1',scope:SCOPE,deployable:false,registryPublication:false,result:success&&!cleanupError?'passed':'failed',category:cleanupError?'cleanup-unconfirmed':errorCategory??null,policyVersion:PINS.policyVersion,elapsedSeconds:Math.ceil((now()-started)/1000),sameImageId:identity.dockerImageId,ociManifestDigest:identity.ociManifestDigest,sourceSHA256:PINS.nativeSourceSha256,nativeManifestSHA256:PINS.nativeManifestSha256,exactRosterVerified:success,cpuRulesRuntimeVerified:success,humanPriorityRuntimeVerified:success,humanPrioritySourceSha256:policy?probe.state.initialization.humanPriority.sourceManifestSha256:null,humanPriorityClassesSha256:policy?probe.state.initialization.humanPriority.classManifestSha256:null,humanPriorityBuildSha256:policy?probe.state.initialization.humanPriority.buildAttestationSha256:null,privacyGatePassed:success,nativeBuildAttestationSha256:policy?.nativeBuildAttestationSha256??null,buildCompilerVersion:policy?.buildCompilerVersion??null,runtimeJavaVersion:policy?.runtimeJavaVersion??null,runtimeClassSetSha256:policy?.runtimeClassSetSha256??null,aiPatchsetSha256:policy?.aiPatchsetSha256??null,selectedProfileSHA256:policy?probe.state.initialization.cpuPolicy.profileSha256:null,rulesManifestSHA256:policy?.rulesData?.manifestSha256??null,humanDigest:policy?probe.state.initialization.humanDigest:null,opponentDigest:policy?probe.state.initialization.opponentDigest:null,registeredRosterVerified:policy?probe.state.initialization.registeredRosterVerified:false,nativeRosterVerified:policy?probe.state.initialization.nativeRosterVerified:false,cleanup:evidence.cleanup??null,browserAcceptance:false},null,2)+'\n',{mode:0o600});
  if(cleanupError)throw Error('Probe cleanup failed');
 }
 const cleanup=provider.evidence().cleanup;
 assertProbeCleanup(cleanup,identity.dockerImageId,inspect.Id);
 // Remove original input and capability from the private persisted probe capsule.
 const {input:discardInput,allocation:discardAllocation,...minimalProbe}=probe;
 return {policy,probe:minimalProbe,probeInspect:inspect,probeCleanup:cleanup,artifacts};
}
