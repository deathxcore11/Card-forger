import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionPolicy, allowsAccount, reserveAdmissionBudget, settleAdmissionBudget } from '../src/admission-policy.mjs';

const owner = '00000000-0000-4000-8000-000000000001';
const NOW = 1_800_000_000_000;
const enabled = { FORGE_PLAY_ACCESS: 'authenticated', FORGE_PLAY_ENABLED: 'true' };
const store = () => {
  const data = new Map();
  return { async get(k) { return structuredClone(data.get(k)); }, async put(k, v) { data.set(k, structuredClone(v)); } };
};
const allocation = (now = NOW, ms = 3_600_000) => ({ ownerId: owner, createdAt: now, expiresAt: now + ms });

test('authenticated mode is explicit, bounded and accepts verified account IDs without an owner list', () => {
  assert.equal(admissionPolicy({}, NOW), null);
  assert.equal(admissionPolicy({ FORGE_PLAY_ACCESS: 'authenticated' }, NOW), null);
  const policy = admissionPolicy(enabled, NOW);
  assert.equal(policy.matchMs, 3_600_000);
  assert.equal(policy.runtimeBudgetMs, 28_800_000);
  assert.equal(allowsAccount(policy, owner), true);
  for (const id of [null, '', 'guest', '*']) assert.equal(allowsAccount(policy, id), false);
  for (const change of [
    { FORGE_PLAY_ACCESS: 'all' }, { FORGE_PLAY_ENABLED: 'false' },
    { FORGE_PLAY_MATCH_MS: '' }, { FORGE_PLAY_MATCH_MS: 'Infinity' },
    { FORGE_PLAY_MATCH_MS: '119999' }, { FORGE_PLAY_MATCH_MS: '7200001' },
    { FORGE_PLAY_DAILY_RUNTIME_MS: '3600000' }, { FORGE_PLAY_DAILY_RUNTIME_MS: '28800001' },
    { FORGE_PLAY_DAILY_RESERVATIONS: '0' }, { FORGE_PLAY_DAILY_RESERVATIONS: '101' },
  ]) assert.equal(admissionPolicy({ ...enabled, ...change }, NOW), null, JSON.stringify(change));
});

test('rolling budget expires individually after 24 hours, not at midnight or on config changes', async () => {
  const storage = store();
  const policy = admissionPolicy({ ...enabled, FORGE_PLAY_DAILY_RESERVATIONS: '1' }, NOW);
  assert.equal(await reserveAdmissionBudget(storage, allocation(), policy, NOW), null);
  const expected = { status: 429, error: 'play_resource_budget_exhausted' };
  assert.deepEqual(await reserveAdmissionBudget(storage, allocation(NOW + 1), policy, NOW + 1), expected);
  const changed = admissionPolicy({ ...enabled, FORGE_PLAY_DAILY_RESERVATIONS: '1', FORGE_PLAY_MATCH_MS: '120000' }, NOW + 60_000);
  assert.deepEqual(await reserveAdmissionBudget(storage, allocation(NOW + 60_000, 120_000), changed, NOW + 60_000), expected);
  assert.deepEqual(await reserveAdmissionBudget(storage, allocation(NOW + 86_399_999), policy, NOW + 86_399_999), expected);
  assert.equal(await reserveAdmissionBudget(storage, allocation(NOW + 86_400_000), policy, NOW + 86_400_000), null);
  assert.equal((await storage.get('play-runtime-budget')).entries.length, 1);
});

test('runtime cap includes teardown allowance and cannot be bypassed with a larger reservation', async () => {
  const storage = store();
  const policy = admissionPolicy({ ...enabled, FORGE_PLAY_DAILY_RUNTIME_MS: '3607000' }, NOW);
  assert.equal(await reserveAdmissionBudget(storage, allocation(), policy, NOW), null);
  assert.deepEqual(await reserveAdmissionBudget(storage, allocation(), policy, NOW), { status: 429, error: 'play_resource_budget_exhausted' });
  assert.deepEqual(await reserveAdmissionBudget(store(), allocation(NOW, 3_600_001), policy, NOW), { status: 503, error: 'play_invalid_runtime_reservation' });
});

test('invalid persisted accounting and backwards time fail closed without resetting usage', async () => {
  const policy = admissionPolicy(enabled, NOW);
  for (const saved of [{ version: 2, entries: [] }, { version: 1, entries: [{ at: NOW + 1, runtimeMs: 3_607_000 }] },
    { version: 1, entries: [{ at: NOW, runtimeMs: -1 }] }, { version: 1, entries: 'invalid' }]) {
    const storage = store(); await storage.put('play-runtime-budget', saved);
    assert.deepEqual(await reserveAdmissionBudget(storage, allocation(), policy, NOW), { status: 503, error: 'play_runtime_budget_unavailable' });
    assert.deepEqual(await storage.get('play-runtime-budget'), saved);
  }
});

test('confirmed release settles a failed start to the runtime it held, never above its reservation', async () => {
  const storage = store(); storage.transaction = async fn => fn(storage);
  const policy = admissionPolicy(enabled, NOW), matchId = '00000000-0000-4000-8000-0000000000aa';
  const failed = { ...allocation(NOW), matchId };
  assert.equal(await reserveAdmissionBudget(storage, failed, policy, NOW), null);
  assert.equal((await storage.get('play-runtime-budget')).entries[0].matchId, matchId);
  assert.equal(await settleAdmissionBudget(storage, failed, NOW + 3000), true);
  assert.equal((await storage.get('play-runtime-budget')).entries[0].runtimeMs, 10_000);
  assert.equal(await settleAdmissionBudget(storage, failed, NOW + 9_000_000), false, 'a settled entry is never raised');
  assert.equal(await settleAdmissionBudget(storage, { ...failed, matchId: '00000000-0000-4000-8000-0000000000bb' }, NOW), false);
  // Eight failed starts no longer exhaust the eight-hour allowance.
  for (let i = 1; i < 8; i++) {
    const next = { ...allocation(NOW + i), matchId: '00000000-0000-4000-8000-00000000000' + i };
    assert.equal(await reserveAdmissionBudget(storage, next, policy, NOW + i), null);
    await settleAdmissionBudget(storage, next, NOW + i + 3000);
  }
  assert.equal(await reserveAdmissionBudget(storage, { ...allocation(NOW + 9), matchId: '00000000-0000-4000-8000-0000000000cc' }, policy, NOW + 9), null);
});
