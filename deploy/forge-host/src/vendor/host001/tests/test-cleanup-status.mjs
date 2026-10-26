// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatewayDriver } from '../gateway-driver.mjs';
import { MatchAuthority } from '../session-authority.mjs';
const EPOCH = '00000000-0000-4000-8000-000000000006';
const OWNER = '00000000-0000-4000-8000-000000000001';
const MATCH = '00000000-0000-4000-8000-000000000004';
const GENERATION = '00000000-0000-4000-8000-000000000005';

function fixture(statuses) {
  const calls = { fetch: 0, stop: 0 };
  let index = 0;
  const driver = new GatewayDriver({ internalToken: 'cleanup-fixture-not-a-service-credential',
    isRunning: async () => statuses[Math.min(index++, statuses.length - 1)],
    fetchExisting: async () => { calls.fetch++; return new Response('{}', { headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': EPOCH } }); },
    stopExisting: async () => { calls.stop++; return { confirmed: true }; } });
  return { driver, calls };
}

test('unknown initial process status cannot confirm destruction or contact a process', async () => {
  for (const status of [undefined, null, 0, '', 'false']) {
    const f = fixture([status]);
    assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: false });
    assert.deepEqual(f.calls, { fetch: 0, stop: 0 });
  }
});

test('unknown status after stop acknowledgment is not proof the process stopped', async () => {
  for (const status of [undefined, null, 0, '', 'false', true, 1, {}]) {
    const f = fixture([true, true, status]);
    assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: false });
    assert.deepEqual(f.calls, { fetch: 1, stop: 1 });
  }
});

test('initial false lacks destruction proof; only fenced stop plus explicit false confirms', async () => {
  const stopped = fixture([false]);
  assert.deepEqual(await stopped.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: false });
  assert.deepEqual(stopped.calls, { fetch: 0, stop: 0 });
  const terminated = fixture([true, true, false]);
  assert.deepEqual(await terminated.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: true });
  assert.deepEqual(terminated.calls, { fetch: 1, stop: 1 });
});

test('authority does not mark destruction confirmed when driver status is unknown', async () => {
  const f = fixture([undefined]);
  const data = new Map();
  const storage = { async get(key) { return structuredClone(data.get(key)); },
    async put(key, value) { data.set(key, structuredClone(value)); },
    async transaction(fn) { return fn(storage); } };
  const authority = new MatchAuthority({ storage, driver: f.driver, now: () => 1000,
    verifyBearer: async () => ({ id: OWNER, is_anonymous: false }) });
  await authority.initialize({ ownerId: OWNER, matchId: MATCH, generation: GENERATION, epoch: EPOCH, viewerId: 0,
    deckDigests: { human: 'a'.repeat(64), opponent: 'b'.repeat(64) }, expiresAt: 7201000 });
  const response = await authority.handle(new Request(`https://cardstashy.com/api/play/matches/${MATCH}`, {
    method: 'DELETE', headers: { Authorization: 'Bearer fixture', Origin: 'https://cardstashy.com' } }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'cleanup_unconfirmed');
  assert.notEqual(await storage.get('destructionConfirmed'), true);
  assert.equal((await storage.get('match')).status, 'closed', 'owner commands stay closed while cleanup is retried');
});

test('authority keeps cleanup pending when final post-stop status is unknown', async () => {
  const f = fixture([true, true, undefined]);
  const data = new Map();
  const storage = { async get(key) { return structuredClone(data.get(key)); },
    async put(key, value) { data.set(key, structuredClone(value)); },
    async transaction(fn) { return fn(storage); } };
  const authority = new MatchAuthority({ storage, driver: f.driver, now: () => 1000,
    verifyBearer: async () => ({ id: OWNER, is_anonymous: false }) });
  await authority.initialize({ ownerId: OWNER, matchId: MATCH, generation: GENERATION, epoch: EPOCH, viewerId: 0,
    deckDigests: { human: 'a'.repeat(64), opponent: 'b'.repeat(64) }, expiresAt: 7201000 });
  const response = await authority.handle(new Request(`https://cardstashy.com/api/play/matches/${MATCH}`, {
    method: 'DELETE', headers: { Authorization: 'Bearer fixture', Origin: 'https://cardstashy.com' } }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'cleanup_unconfirmed');
  assert.notEqual(await storage.get('destructionConfirmed'), true);
  assert.equal((await storage.get('match')).status, 'closed', 'owner commands stay closed while cleanup is retried');
});
