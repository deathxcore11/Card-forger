// SPDX-License-Identifier: GPL-3.0-or-later
// Actual AdmissionService entry points with single-alarm storage/RPC fixtures.
// No card rules, provider process, account, wall-clock wait or billing is simulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdmissionService, ORIGIN } from '../src/service-core.mjs';
const OWNER = '00000000-0000-4000-8000-000000000001';
const START = 1_000_000;
class Storage {
  data = new Map(); tail = Promise.resolve(); alarmAt = null;
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  async delete(key) { return this.data.delete(key); }
  async getAlarm() { return this.alarmAt; }
  async setAlarm(at) { this.alarmAt = at; }
  async list({ prefix }) {
    if (this.beforeList) await this.beforeList(prefix);
    return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).map(([k,v]) => [k, structuredClone(v)]));
  }
  transaction(fn) {
    const run = this.tail.then(async () => {
      const staged = new Storage(); staged.data = structuredClone(this.data); staged.alarmAt = this.alarmAt;
      const value = await fn(staged); this.data = staged.data; this.alarmAt = staged.alarmAt; return value;
    });
    this.tail = run.catch(() => {}); return run;
  }
}
function fixture() {
  const storage = new Storage(), calls = { begin: 0, reconcile: 0, proof: 0 };
  const f = { now: START, storage, calls, allowProof: true };
  const stopped = new Set();
  const env = { FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: OWNER,
    FORGE_TRIAL_EXPIRES_AT: new Date(START + 86400000).toISOString(),
    FORGE_MATCHES: { getByName(matchId) { return {
      async begin() { calls.begin++; throw Error('fixture_startup_RPC_lost_before_dispatch'); },
      async reconcile(allocation) {
        calls.reconcile++;
        if (f.now >= allocation.createdAt + 120000) stopped.add(matchId);
      },
      async destructionProof(generation) {
        calls.proof++;
        return f.allowProof ? { generation, confirmed: stopped.has(matchId) } : undefined;
      },
    }; } },
  };
  const service = new AdmissionService({ ctx: { storage }, env, native: { ready: true },
    verifyBearer: async () => ({ id: OWNER, is_anonymous: false }), now: () => f.now });
  const deck = { format: 'Standard', cards: [{ name: 'Transport fixture only', qty: 60 }], side: [] };
  const input = { format: 'Standard', humanDeck: deck, opponentDeck: deck, difficultyPolicyVersion: 'fixture-no-engine' };
  f.create = (body = input) => service.fetch(new Request(ORIGIN + '/api/play/matches', {
    method: 'POST', headers: { Authorization: 'Bearer fixture', Origin: ORIGIN,
      'Content-Type': 'application/json', 'Idempotency-Key': 'alarm_fixture_create_0001' }, body: JSON.stringify(body),
  }));
  f.fire = async () => { storage.alarmAt = null; await service.alarm(); };
  f.advanceTo = async time => {
    let count = 0;
    while (storage.alarmAt !== null && storage.alarmAt <= time) {
      assert(++count < 20, 'alarm must not spin at an already-processed time');
      f.now = storage.alarmAt; await f.fire();
    }
    f.now = time;
  };
  return { ...f, service, advanceTo: f.advanceTo, fire: f.fire, state: f };
}
test('failed creates cannot keep postponing reconciliation of an earlier lost startup', async () => {
  const f = fixture(); assert.equal((await f.create()).status, 202);
  for (const delta of [30000, 60000, 90000, 120000, 150000, 180000]) {
    await f.advanceTo(START + delta);
    assert.equal((await f.create({})).status, 400);
  }
  assert.equal((await f.storage.get('leases')).length, 0, 'confirmed stopped allocation must be reconciled despite continuing invalid create traffic');
  assert(f.calls.reconcile > 0);
  assert.equal(f.calls.begin, 1, 'alarm never redispatches startup');
  assert.equal((await f.storage.get('trial-budget')).reservations, 1, 'cleanup does not refund startup budget');
});
test('alarm finishing after concurrent admission cannot replace its earlier wakeup with hourly pruning', async () => {
  const f = fixture(); let createLists = 0;
  f.storage.beforeList = async prefix => {
    if (prefix !== 'create:' || ++createLists !== 2) return;
    // The alarm already observed no leases/rates. A real create commits before
    // its final receipt list, including the create path\'s next wakeup.
    assert.equal((await f.create()).status, 202);
  };
  await f.fire();
  assert.equal((await f.storage.get('leases')).length, 1);
  assert.equal(await f.storage.getAlarm(), START + 60000, 'maintenance must not postpone newly reserved startup reconciliation');
  assert.equal(f.calls.begin, 1);
});
test('new admission creates a wakeup and advances a later maintenance alarm', async () => {
  for (const previous of [null, START + 3600000]) {
    const f = fixture(); f.storage.alarmAt = previous;
    assert.equal((await f.create()).status, 202);
    assert.equal(await f.storage.getAlarm(), START + 60000);
    assert.equal((await f.storage.get('leases')).length, 1);
    assert.equal(f.calls.begin, 1);
  }
});
test('valid creates preserve an earlier or equal existing cleanup wakeup',async()=>{
  for(const previous of [START+10000,START+60000]) {
    const f=fixture();f.storage.alarmAt=previous;
    assert.equal((await f.create()).status,202);
    assert.equal(await f.storage.getAlarm(),previous);
    assert.equal(f.calls.begin,1);
  }
});

test('alarm scheduling failure aborts creation before reservation or startup',async()=>{
  const f=fixture();f.storage.alarmAt=START+3600000;
  const transact=f.storage.transaction.bind(f.storage);
  f.storage.transaction=fn=>transact(async txn=>{
    const set=txn.setAlarm.bind(txn);
    txn.setAlarm=async at=>{await set(at);throw Error('synthetic durable write failure');};
    return fn(txn);
  });
  await assert.rejects(f.create(),/synthetic durable write failure/);
  assert.equal(await f.storage.getAlarm(),START+3600000,'failed transaction must retain its previous committed alarm');
  assert.equal(await f.storage.get('leases'),undefined);
  assert.equal(await f.storage.get('trial-budget'),undefined);
  assert.equal(f.calls.begin,0);
});
test('due reconciliation still holds capacity without explicit destruction proof', async () => {
  const f = fixture(); f.state.allowProof = false;
  assert.equal((await f.create()).status, 202);
  await f.advanceTo(START + 180000);
  assert.equal((await f.storage.get('leases')).length, 1);
  assert(f.calls.reconcile > 0 && f.calls.proof > 0);
  assert.equal(f.calls.begin, 1);
  assert.equal(await f.storage.getAlarm(), START + 210000);
});
