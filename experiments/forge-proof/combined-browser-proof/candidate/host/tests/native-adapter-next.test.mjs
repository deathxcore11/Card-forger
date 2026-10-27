import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeAdapter } from '../src/native-adapter-next.mjs';
import { digest, FORGE_REVISION, NATIVE_SCHEMA } from '../src/policy.mjs';
import { AI_PATCHSET_SHA256, AI_CLASS_SET_SHA256, EXPECTED_RULES } from '../src/release-policy.mjs';
const epoch='00000000-0000-4000-8000-000000000099', image='registry.cloudflare.com/FIXTURE/next@sha256:'+'a'.repeat(64), now=()=>Date.parse('2026-10-27T04:00:00Z');
async function fixture(tier='easy') {
  const receipt=JSON.parse(await readFile(new URL('./fixtures/'+tier+'-receipt.json',import.meta.url),'utf8')).initialization;
  // Explicit transport fixture, NOT a new native/game result.
  const input={format:'Commander',difficultyPolicyVersion:receipt.policyVersion,humanDeck:{cards:[{name:'fixture',qty:100}]},opponentDeck:{cards:[{name:'fixture',qty:100}]}};
  const allocation={requestDigest:await digest(input),deckDigests:{human:await digest(input.humanDeck),opponent:await digest(input.opponentDeck)},expiresAt:now()+180000};
  Object.assign(receipt,{requestDigest:allocation.requestDigest,humanDigest:allocation.deckDigests.human,opponentDigest:allocation.deckDigests.opponent});
  const state={schema:NATIVE_SCHEMA,forgeRevision:FORGE_REVISION,status:'running',viewer:receipt.viewerId,initialization:receipt};
  const release={schema:'cardstashy.forge-release-policy.v1',containerImage:image,engineRevision:FORGE_REVISION,nativeManifestSha256:'b'.repeat(64),nativeSourceSha256:'c'.repeat(64),aiPatchsetSha256:AI_PATCHSET_SHA256,runtimeClassSetSha256:AI_CLASS_SET_SHA256,nativeBuildAttestationSha256:receipt.cpuPolicy.nativeBuildAttestationSha256,buildCompilerVersion:receipt.cpuPolicy.buildCompilerVersion,runtimeJavaVersion:receipt.cpuPolicy.runtimeJavaVersion,rulesData:EXPECTED_RULES};
  const env={FORGE_CONTAINER_IMAGE:image,FORGE_RELEASE_POLICY_JSON:JSON.stringify(release)},adapter=nativeAdapter(env,{now});let reads=0;
  const options={input,allocation,epoch,internalToken:'fixture-internal-next-capability-only',fetchExisting:async request=>{reads++;assert.equal(new URL(request.url).pathname,'/state');assert.equal(request.headers.get('Authorization'),'Bearer fixture-internal-next-capability-only');return Response.json(state,{headers:{'X-Host-Epoch':epoch,'X-Host-Native-Source-SHA256':release.nativeSourceSha256,'X-Host-Native-Manifest-SHA256':release.nativeManifestSha256}});}};
  return {adapter,env,state,options,reads:()=>reads};
}
test('next adapter binds all3 explicit policies and preserves existing source/roster/viewer gates',async()=>{
 for(const tier of ['easy','medium','hard']){const f=await fixture(tier);assert.equal(f.adapter.ready,true);const r=await f.adapter.confirmInitialization(f.options);assert.equal(r.policyVersion,f.options.input.difficultyPolicyVersion);assert.equal(r.schema,NATIVE_SCHEMA);assert.equal(f.reads(),1);const start=await f.adapter.startOptions(f.options);assert.equal(start.enableInternet,false);assert.equal(start.env.HOST_ABSOLUTE_DEADLINE_MS,String(f.options.allocation.expiresAt));}
});
test('missing image configuration and stale rules disable next adapter without reads',async()=>{
 assert.equal(nativeAdapter({},{now}).ready,false);const f=await fixture();assert.equal(nativeAdapter(f.env,{now:()=>Date.parse('2026-11-03T00:00:00Z')}).ready,false);
 await assert.rejects(nativeAdapter({},{now}).confirmInitialization(f.options),/unbound/);assert.equal(f.reads(),0);
});
test('oldDefault/unknown policy rejects before bootstrap/native read, never mapped to Medium',async()=>{
 const f=await fixture();for(const policy of ['forge-default-smart-v1','Medium','unknown']){const options={...f.options,input:{...f.options.input,difficultyPolicyVersion:policy}};await assert.rejects(f.adapter.startOptions(options),/unsupported_explicit/);await assert.rejects(f.adapter.confirmInitialization(options),/unsupported_explicit/);}assert.equal(f.reads(),0);
});
test('new policy cannot bypass exact digests, roster flags, viewer, epoch or schema fences',async()=>{
 for(const edit of [s=>s.initialization.humanDigest='f'.repeat(64),s=>s.initialization.requestDigest='f'.repeat(64),s=>s.initialization.registeredRosterVerified=false,s=>s.initialization.nativeRosterVerified=false,s=>s.viewer=999,s=>s.schema='wrong']){const f=await fixture();edit(f.state);await assert.rejects(f.adapter.confirmInitialization(f.options),/native_exact_validation_rejected/);}
 const f=await fixture();await assert.rejects(f.adapter.confirmInitialization({...f.options,epoch:'wrong'}),/epoch_mismatch/);
});

test('next adapter rejects missing or mixed immutable image identities even with a valid CPU receipt',async()=>{
 const f=await fixture();
 for(const headers of [{},{'X-Host-Native-Source-SHA256':'c'.repeat(64),'X-Host-Native-Manifest-SHA256':'d'.repeat(64)},{'X-Host-Native-Source-SHA256':'d'.repeat(64),'X-Host-Native-Manifest-SHA256':'b'.repeat(64)}]){
  await assert.rejects(f.adapter.confirmInitialization({...f.options,fetchExisting:async()=>Response.json(f.state,{headers:{'X-Host-Epoch':epoch,...headers}})}),/image_identity_mismatch/);
 }
});
