// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdmissionLedger } from '../admission-ledger.mjs';
import { digest } from '../session-authority.mjs';
const OWNER = '00000000-0000-4000-8000-000000000001';
const NOW = 100000000;

// Serialized transaction fixture, with a list-time interleaving hook. This
// models an alarm snapshot preceding another request's committed reservation.
class Storage {
  data = new Map();
  tail = Promise.resolve();
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  async delete(key) { this.data.delete(key); }
  async list({ prefix }) {
    const snapshot = new Map([...this.data].filter(([key]) => key.startsWith(prefix)).map(([k,v]) => [k, structuredClone(v)]));
    if (this.onList) await this.onList(prefix);
    return snapshot;
  }
  transaction(fn) {
    const result = this.tail.then(() => fn(this));
    this.tail = result.catch(() => {});
    return result;
  }
}
function fixture() {
  const storage = new Storage();
  const ledger = new AdmissionLedger({ storage, now: () => NOW });
  const deck = { format: 'Modern', cards: [{ name: 'Island', qty: 60 }] };
  const input = { format: 'Modern', humanDeck: deck, opponentDeck: structuredClone(deck), difficultyPolicyVersion: 'fixture-only' };
  const admitExact = async exact => ({ supported: true, legal: true,
    humanDigest: await digest(exact.humanDeck), opponentDigest: await digest(exact.opponentDeck) });
  const reserve = key => ledger.reserve({ ownerId: OWNER, idempotencyKey: key, input, admitExact });
  return { storage, ledger, reserve };
}

test('pruning a stale rate snapshot preserves a concurrently committed reservation and quota', async () => {
  const { storage, ledger, reserve } = fixture();
  const rateKey = 'create-rate:' + OWNER;
  await storage.put(rateKey, [NOW - 86400001]);
  storage.onList = async prefix => {
    if (prefix !== 'create-rate:') return;
    storage.onList = null;
    for (let i = 0; i < 3; i++) {
      const r = await reserve('concurrent_create_000' + i);
      assert.equal(r.status, 202);
      assert.equal(await ledger.releaseAfterDestruction({ ...r.allocation, confirmed: true }), true);
    }
  };
  await ledger.pruneReceipts();
  assert.deepEqual(await storage.get(rateKey), [NOW, NOW, NOW]);
  assert.equal((await reserve('concurrent_create_0004')).status, 429);
});

test('pruning rechecks a receipt renewed after listing instead of deleting its replacement', async () => {
  const { storage, ledger } = fixture();
  const key = 'create:fixture';
  await storage.put(key, { retainUntil: NOW - 1 });
  storage.onList = async prefix => {
    if (prefix === 'create:') await storage.put(key, { retainUntil: NOW + 86400000, replacement: true });
  };
  await ledger.pruneReceipts();
  assert.deepEqual(await storage.get(key), { retainUntil: NOW + 86400000, replacement: true });
});

test('pruning removes expired records, tolerates already removed records, and never frees leases', async () => {
  const { storage, ledger } = fixture();
  await storage.put('create:expired', { retainUntil: NOW });
  await storage.put('create:gone', { retainUntil: NOW - 1 });
  await storage.put('create:live', { retainUntil: NOW + 1 });
  await storage.put('create-rate:expired', [NOW - 86400000]);
  await storage.put('create-rate:gone', [NOW - 86400001]);
  await storage.put('create-rate:live', [NOW]);
  const leases = [{ matchId: 'still-allocated', expiresAt: NOW - 1 }];
  await storage.put('leases', leases);
  storage.onList = async prefix => { await storage.delete(prefix + 'gone'); };
  await ledger.pruneReceipts();
  assert.equal(await storage.get('create:expired'), undefined);
  assert.equal(await storage.get('create-rate:expired'), undefined);
  assert.deepEqual(await storage.get('create:live'), { retainUntil: NOW + 1 });
  assert.deepEqual(await storage.get('create-rate:live'), [NOW]);
  assert.deepEqual(await storage.get('leases'), leases);
});
