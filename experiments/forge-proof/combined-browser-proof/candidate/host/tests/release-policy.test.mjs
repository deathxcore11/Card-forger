import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENGINE_REVISION, CPU_POLICIES, AI_PATCHSET_SHA256, AI_CLASS_SET_SHA256, EXPECTED_RULES,
  validateReleasePolicy, selectedPolicy, verifyPolicyReceipt } from '../src/release-policy.mjs';
const now = Date.parse('2026-10-27T04:00:00Z'), image = 'registry.cloudflare.com/FIXTURE/account-forge@sha256:' + 'a'.repeat(64);
const receipts = Object.fromEntries(await Promise.all(['easy', 'medium', 'hard'].map(async tier => [tier,
  JSON.parse(await readFile(new URL('./fixtures/' + tier + '-receipt.json', import.meta.url), 'utf8')).initialization])));
const release = () => ({ schema: 'cardstashy.forge-release-policy.v1', containerImage: image, engineRevision: ENGINE_REVISION,
  nativeManifestSha256: 'b'.repeat(64), nativeSourceSha256: 'c'.repeat(64),
  aiPatchsetSha256: AI_PATCHSET_SHA256, runtimeClassSetSha256: AI_CLASS_SET_SHA256,
  nativeBuildAttestationSha256: receipts.easy.cpuPolicy.nativeBuildAttestationSha256,
  buildCompilerVersion: receipts.easy.cpuPolicy.buildCompilerVersion, runtimeJavaVersion: receipts.easy.cpuPolicy.runtimeJavaVersion,
  rulesData: structuredClone(EXPECTED_RULES) });
const check = (receipt, policy = receipt.policyVersion, manifest = release(), instant = now) => verifyPolicyReceipt(receipt, { difficultyPolicyVersion: policy }, manifest, image, instant);
test('all3 actual native receipt metadata match exact explicit version/profile/hash mappings', () => {
  for (const tier of ['easy','medium','hard']) {
    const r = receipts[tier]; assert.equal(check(r).profile, 'CardStashy' + tier[0].toUpperCase() + tier.slice(1) + 'BetaV1');
    assert.equal(r.cpuPolicy.strictServiceLatencyProven, false);
  }
});
test('unknown, oldDefault, omitted and unversioned policies never map implicitly', () => {
  for (const version of [undefined, '', 'Easy', 'Medium', 'Hard', 'Default', 'forge-default-smart-v1', 'forge-heuristic-hard-beta-v2', '__proto__']) {
    assert.throws(() => selectedPolicy(version), /unsupported_explicit_cpu_policy/);
    assert.throws(() => check(receipts.easy, version === undefined ? null : version));
  }
});
test('wrong profile/tier/hash, modifiedAI/class/build provenance or runtime flags reject', () => {
  for (const [path,value] of [
    ['aiProfile','Default'],['policyVersion','forge-default-smart-v1'],['cpuPolicyRuntimeVerified',false],['nativeLegal',false],
    ['cpuPolicy.aiProfile',CPU_POLICIES['forge-heuristic-hard-beta-v1'].profile],['cpuPolicy.profileSha256','f'.repeat(64)],
    ['cpuPolicy.aiPatchsetSha256','f'.repeat(64)],['cpuPolicy.runtimeClassSetSha256','f'.repeat(64)],
    ['cpuPolicy.nativeBuildAttestationSha256','f'.repeat(64)],['cpuPolicy.buildCompilerVersion','javac 21.0.99'],
    ['cpuPolicy.runtimeJavaVersion','21.0.99+1'],['cpuPolicy.runtimeBytecodeVerified',false],['cpuPolicy.runtimeSettingsVerified',false],
    ['cpuPolicy.admissionAllowed',false],['cpuPolicy.nativeAiModified',false],['cpuPolicy.monteCarlo',true],['cpuPolicy.legacySimulation',true],
    ['cpuPolicy.strictServiceLatencyProven',true],['cpuPolicy.nativePriorityTimeoutSeconds',1],
  ]) {
    const receipt=structuredClone(receipts.easy), keys=path.split('.'); let target=receipt; for(const key of keys.slice(0,-1))target=target[key]; target[keys.at(-1)]=value;
    assert.throws(() => check(receipt, receipts.easy.policyVersion), undefined, path);
  }
});
test('current rules data must match trusted bundle, format-engine and freshness pins', () => {
  for (const [key,value] of [['mode','pinned-practice'],['decksVerified',false],['version','new-client-label'],['manifestSha256','f'.repeat(64)],['indexSha256','f'.repeat(64)],['sourceSha256','f'.repeat(64)],['engineRevision','different'],['validUntilExclusive','2099-01-01']]) {
    const r=structuredClone(receipts.easy);r.rulesData[key]=value;assert.throws(()=>check(r),undefined,key);
  }
  for(const date of ['2026-10-26T23:59:59Z','2026-11-03T00:00:00Z'])assert.throws(()=>check(receipts.easy,receipts.easy.policyVersion,release(),Date.parse(date)),/not_current/);
});
test('worker image declaration and build provenance cannot silently drift', () => {
  assert.throws(()=>validateReleasePolicy(release(),image.replace(/a{64}/,'d'.repeat(64)),now),/unbound/);
  for(const key of ['nativeManifestSha256','nativeSourceSha256','nativeBuildAttestationSha256','buildCompilerVersion','runtimeJavaVersion']) {
    const r=release();delete r[key];assert.throws(()=>validateReleasePolicy(r,image,now));
  }
  const changed=release();changed.rulesData.manifestSha256='e'.repeat(64);assert.throws(()=>validateReleasePolicy(changed,image,now),/unbound_rules/);
});
