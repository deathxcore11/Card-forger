// LOCAL_TEST_NOT_DEPLOYABLE. Explicit local fixture API, NO production selector.
// This module is not imported by any production/host entry point.
import assert from 'node:assert/strict';
import {ENGINE_REVISION,AI_PATCHSET_VERSION,AI_PATCHSET_SHA256,AI_CLASS_SET_SHA256,EXPECTED_RULES,selectedPolicy} from './reviewed-host.mjs';
import {digest,NATIVE_SCHEMA} from './reviewed-host.mjs';
import {SCOPE,sha256,assertSameContainerImage} from './oci-identity.mjs';
import {assertHumanPriorityReceipt} from '../image-stages/human-priority-contract.mjs';
const policies=new WeakSet();
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)&&!/^0+$/.test(value);
const fail=code=>{throw Error(code);};
const canonical=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
const schema='cardstashy.local-oci-test-policy.v1';
export function validateLocalTestPolicy(policy,identity,now=Date.now()){
 assert(policies.has(policy)&&policy?.schema===schema&&policy.scope===SCOPE&&policy.deployable===false&&policy.registryPublication===false&&!Object.hasOwn(policy,'containerImage'),'Explicit in-process local test policy required');
 assert(policy.image===identity,'Local image identity changed');
 if(policy.engineRevision!==ENGINE_REVISION||!sha(policy.nativeManifestSha256)||!sha(policy.nativeSourceSha256)||!sha(policy.nativeBuildAttestationSha256)
   ||!/^javac 21\.[0-9]+\.[0-9]+(?:\S*)?$/.test(policy.buildCompilerVersion||'')||typeof policy.runtimeJavaVersion!=='string'||!/^21\./.test(policy.runtimeJavaVersion)||policy.runtimeJavaVersion.length>128
   ||policy.aiPatchsetSha256!==AI_PATCHSET_SHA256||policy.runtimeClassSetSha256!==AI_CLASS_SET_SHA256)fail('unbound_local_native_image_policy');
 for(const [key,expected]of Object.entries(EXPECTED_RULES))if(policy.rulesData?.[key]!==expected)fail('unbound_rules_data_policy');
 if(!Number.isSafeInteger(now)||now<Date.parse(EXPECTED_RULES.asOfDate+'T00:00:00Z')||now>=Date.parse(EXPECTED_RULES.validUntilExclusive+'T00:00:00Z'))fail('rules_data_policy_not_current');
 return policy;
}
export async function verifyExactLocalInitialization({state,epoch,responseStatus,responseHeaders,input,allocation,policy,identity,now=Date.now()}){
 validateLocalTestPolicy(policy,identity,now);
 assert(responseStatus===200,'Native initialization HTTP response must be200');
 assert(typeof epoch==='string'&&epoch.length>0&&responseHeaders['x-host-epoch']===epoch,'initialization_epoch_mismatch');
 assert(responseHeaders['x-host-native-source-sha256']===policy.nativeSourceSha256&&responseHeaders['x-host-native-manifest-sha256']===policy.nativeManifestSha256,'initialization_image_identity_mismatch');
 const receipt=state?.initialization;
 if(state?.schema!==NATIVE_SCHEMA||state.forgeRevision!==ENGINE_REVISION||!['running','finished'].includes(state.status)
   ||receipt?.schema!=='cardstashy.forge-exact-initialization.v1'||receipt.engineRevision!==ENGINE_REVISION
   ||receipt.supported!==true||receipt.legal!==true||receipt.registeredRosterVerified!==true||receipt.nativeRosterVerified!==true
   ||!Number.isSafeInteger(receipt.viewerId)||receipt.viewerId<0||receipt.viewerId!==state.viewer
   ||receipt.requestDigest!==allocation?.requestDigest||receipt.requestDigest!==await digest(input)
   ||receipt.humanDigest!==allocation.deckDigests.human||receipt.opponentDigest!==allocation.deckDigests.opponent
   ||!/^[a-f0-9]{64}$/.test(receipt.humanRosterDigest||'')||!/^[a-f0-9]{64}$/.test(receipt.opponentRosterDigest||'')
   ||!Array.isArray(receipt.errors)||receipt.errors.length!==0)fail('native_exact_validation_rejected');
 assertHumanPriorityReceipt(receipt);
 verifyLocalPolicyReceipt(receipt,input,policy,identity,now);
 return {scope:SCOPE,deployable:false,verified:true};
}
// Caller must obtain every byte below from recorded containers of this SAME
// verified image, via a reviewed private Docker extraction/HTTP relay. This
// function cannot authenticate a caller's claimed origin; that seam is NOT yet
// implemented. Neither untrusted browser input nor environment JSON selects it.
export async function createLocalTestPolicy({identity,artifactContainerInspect,probeContainerInspect,reviewedManifestBytes,reviewedManifestSha256,reviewedSourceSha256,imageSourceBytes,imageCheckpointBytes,buildAttestationBytes,runtimeIndexBytes,probe,now=Date.now()}){
 assertSameContainerImage(identity,artifactContainerInspect);assertSameContainerImage(identity,probeContainerInspect);
 assert(sha(reviewedManifestSha256)&&sha(reviewedSourceSha256)&&sha256(reviewedManifestBytes)===reviewedManifestSha256&&sha256(imageSourceBytes)===reviewedSourceSha256,'Reviewed native source identity mismatch');
 const entry=reviewedManifestBytes.toString().split('\n').map(line=>/^([a-f0-9]{64})\s+(?:\.\/)?(.+)$/.exec(line)).find(x=>x?.[2]==='adapter/src/cardstashy/forge/ForgeHttpBridge.java');
 assert(entry?.[1]===reviewedSourceSha256,'Native source not in reviewed manifest');
 const checkpoint=JSON.parse(imageCheckpointBytes);assert(checkpoint.nativeManifestSha256===reviewedManifestSha256&&checkpoint.sha256?.['experiments/forge-proof/native/adapter/src/cardstashy/forge/ForgeHttpBridge.java']===reviewedSourceSha256,'Image checkpoint/source binding mismatch');
 const artifact=JSON.parse(buildAttestationBytes),classes=JSON.parse(runtimeIndexBytes);
 assert(artifact.schema==='cardstashy.native-ai-build-attestation.v1'&&artifact.forgeRevision===ENGINE_REVISION&&artifact.classSetSha256===AI_CLASS_SET_SHA256&&sha256(runtimeIndexBytes)===AI_CLASS_SET_SHA256
   &&artifact.classCount===12&&Object.keys(classes).length===12&&canonical(artifact.classes)===canonical(classes)&&artifact.actualCompilerBytecodeMatchesReviewed===true&&artifact.differentCompilerHashFallbackAllowed===false,'unverified_actual_image_build_attestation');
 const policy=Object.freeze({schema,scope:SCOPE,deployable:false,registryPublication:false,image:identity,engineRevision:ENGINE_REVISION,nativeManifestSha256:reviewedManifestSha256,nativeSourceSha256:reviewedSourceSha256,aiPatchsetSha256:AI_PATCHSET_SHA256,runtimeClassSetSha256:AI_CLASS_SET_SHA256,nativeBuildAttestationSha256:sha256(buildAttestationBytes),buildCompilerVersion:artifact.javacVersion,runtimeJavaVersion:probe.state?.initialization?.cpuPolicy?.runtimeJavaVersion,rulesData:Object.freeze({...EXPECTED_RULES})});
 policies.add(policy);
 try{await verifyExactLocalInitialization({...probe,policy,identity,now});return policy;}catch(error){policies.delete(policy);throw error;}
}

// Pure CPU/rules predicates copied verbatim from the reviewed production
// verifyPolicyReceipt body, with ONLY its separate image validator replaced.
// Parity test pins original source and compares this entire predicate body.
export function verifyLocalPolicyReceipt(receipt, input, release, configuredImage, now = Date.now()) {
  validateLocalTestPolicy(release, configuredImage, now);
  const policy = selectedPolicy(input?.difficultyPolicyVersion), cpu = receipt?.cpuPolicy, rules = receipt?.rulesData;
  if (receipt.policyVersion !== input.difficultyPolicyVersion || receipt.aiProfile !== policy.profile || receipt.controlMode !== 'smart'
    || receipt.cpuPolicyRuntimeVerified !== true || receipt.nativeLegal !== true || !cpu
    || cpu.difficultyPolicyVersion !== input.difficultyPolicyVersion || cpu.aiProfile !== policy.profile || cpu.profileSha256 !== policy.profileSha256
    || cpu.controlMode !== 'smart' || cpu.forgeCommit !== ENGINE_REVISION || cpu.aiPatchsetVersion !== AI_PATCHSET_VERSION
    || cpu.aiPatchsetSha256 !== AI_PATCHSET_SHA256 || cpu.runtimeClassSetSha256 !== AI_CLASS_SET_SHA256
    || cpu.nativeBuildAttestationSha256 !== release.nativeBuildAttestationSha256 || cpu.buildCompilerVersion !== release.buildCompilerVersion
    || cpu.runtimeJavaVersion !== release.runtimeJavaVersion || cpu.runtimeBytecodeVerified !== true || cpu.runtimeSettingsVerified !== true
    || cpu.admissionAllowed !== true || cpu.admissionScope !== 'bounded-experimental-native-integration'
    || cpu.nativeAiModified !== true || cpu.monteCarlo !== false || cpu.legacySimulation !== false
    || cpu.strictServiceLatencyProven !== false || cpu.nativePriorityTimeoutSeconds !== 5
    || cpu.opponentDeckKnowledge !== 'secret-current-lawful-observations-only'
    || cpu.calibration !== 'experimental-bounded-tactical-corpus-not-universal-strength-ranking') fail('native_cpu_policy_receipt_mismatch');
  if (!rules || rules.schema !== 'cardstashy.rules-data-receipt.v1' || rules.mode !== 'current'
    || rules.engineRevision !== ENGINE_REVISION || rules.decksVerified !== true) fail('native_rules_data_receipt_mismatch');
  for (const [key, expected] of Object.entries(EXPECTED_RULES)) if (rules[key] !== expected) fail('native_rules_data_receipt_mismatch');
  return policy;
}
