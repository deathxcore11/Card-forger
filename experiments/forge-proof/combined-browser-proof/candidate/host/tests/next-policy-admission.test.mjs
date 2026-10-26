// Local admission transport fixture; NOT a native image or legality proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AdmissionService, ORIGIN } from '../src/service-core.mjs';
import { nativeAdapter } from '../src/native-adapter-next.mjs';
import { ENGINE_REVISION, AI_PATCHSET_SHA256, AI_CLASS_SET_SHA256, EXPECTED_RULES } from '../src/release-policy.mjs';
const OWNER = '00000000-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-10-26T05:00:00Z');
class Storage {
  data = new Map(); tail = Promise.resolve();
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  async setAlarm(at) { this.alarmAt = at; }
  async getAlarm() { return this.alarmAt ?? null; }
  transaction(fn) { const p = this.tail.then(() => fn(this)); this.tail = p.catch(() => {}); return p; }
}
async function fixture(policy) {
  const receipt = JSON.parse(await readFile(new URL('./fixtures/medium-receipt.json', import.meta.url))).initialization;
  const image = 'registry.cloudflare.com/FIXTURE/next@sha256:' + 'a'.repeat(64);
  const release = { schema: 'cardstashy.forge-release-policy.v1', containerImage: image, engineRevision: ENGINE_REVISION,
    nativeManifestSha256: 'b'.repeat(64), nativeSourceSha256: 'c'.repeat(64), aiPatchsetSha256: AI_PATCHSET_SHA256,
    runtimeClassSetSha256: AI_CLASS_SET_SHA256, nativeBuildAttestationSha256: receipt.cpuPolicy.nativeBuildAttestationSha256,
    buildCompilerVersion: receipt.cpuPolicy.buildCompilerVersion, runtimeJavaVersion: receipt.cpuPolicy.runtimeJavaVersion, rulesData: EXPECTED_RULES };
  const deck = { format: 'Commander', cards: [{ name: 'Fixture commander', qty: 1 }, { name: 'Fixture land', qty: 99 }],
    commander: 'Fixture commander', commanders: [{ name: 'Fixture commander', qty: 1 }], side: [], importedText: 'unchanged source' };
  const input = { format: 'Commander', difficultyPolicyVersion: policy, humanDeck: deck, opponentDeck: structuredClone(deck) };
  const storage = new Storage(), begins = [];
  const env = { FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: OWNER,
    FORGE_TRIAL_EXPIRES_AT: new Date(NOW + 86400000).toISOString(), FORGE_CONTAINER_IMAGE: image,
    FORGE_RELEASE_POLICY_JSON: JSON.stringify(release),
    FORGE_MATCHES: { getByName() { return { async begin(_allocation, exact) { begins.push(structuredClone(exact)); } }; } } };
  const service = new AdmissionService({ ctx: { storage }, env, native: nativeAdapter(env, { now: () => NOW }),
    now: () => NOW, verifyBearer: async () => ({ id: OWNER, is_anonymous: false }) });
  const response = await service.fetch(new Request(ORIGIN + '/api/play/matches', { method: 'POST',
    headers: { Authorization: 'Bearer fixture', Origin: ORIGIN, 'Content-Type': 'application/json', 'Idempotency-Key': 'policy_fixture_0001' }, body: JSON.stringify(input) }));
  return { response, storage, begins, input };
}
test('next CPU unknown, legacy and absent policies reject before lease, trial charge or provider dispatch', async () => {
  for (const policy of ['forge-default-smart-v1', 'forge-made-up-hard-v1', 'Medium', undefined]) {
    const f = await fixture(policy);
    assert.equal(f.response.status, 422, String(policy));
    assert.equal((await f.response.json()).error, 'unsupported_explicit_cpu_policy');
    assert.equal(await f.storage.get('leases'), undefined);
    assert.equal(await f.storage.get('trial-budget'), undefined);
    assert.deepEqual(f.begins, []);
  }
});
test('all three explicit CPU policies preserve exact input through provisional admission', async () => {
  for (const tier of ['easy', 'medium', 'hard']) {
    const f = await fixture('forge-heuristic-' + tier + '-beta-v1');
    assert.equal(f.response.status, 202);
    assert.deepEqual(f.begins, [f.input]);
    assert.equal((await f.storage.get('leases')).length, 1);
    assert.equal((await f.storage.get('trial-budget')).reservations, 1);
  }
});
