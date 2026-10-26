// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdmissionService, ORIGIN } from '../src/service-core.mjs';
const OWNER = '00000000-0000-4000-8000-000000000001';
const NOW = 100000000;

// The list hook returns an old snapshot after another request commits. This
// fixture serializes storage transactions, not entire alarm/request handlers.
class Storage {
  data = new Map();
  tail = Promise.resolve();
  alarmAt = null;
  transactions = 0;
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  async delete(key) { return this.data.delete(key); }
  async setAlarm(at) { this.alarmAt = at; }
  async list({ prefix }) {
    const snapshot = new Map([...this.data].filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key, structuredClone(value)]));
    if (this.onList) await this.onList(prefix);
    return snapshot;
  }
  transaction(fn) {
    this.transactions++;
    const result = this.tail.then(() => fn(this));
    this.tail = result.catch(() => {});
    return result;
  }
}
function fixture() {
  const storage = new Storage();
  let providerCalls = 0;
  const env = { FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: OWNER,
    FORGE_TRIAL_EXPIRES_AT: new Date(NOW + 86400000).toISOString(),
    FORGE_MATCHES: { getByName() { providerCalls++; throw new Error('unexpected_provider_access'); } } };
  const service = new AdmissionService({ ctx: { storage }, env, native: { ready: false },
    now: () => NOW, verifyBearer: async () => ({ id: OWNER, is_anonymous: false }) });
  const attempt = () => service.fetch(new Request(ORIGIN + '/api/play/matches', {
    method: 'POST', headers: { Authorization: 'Bearer fixture', Origin: ORIGIN,
      'Content-Type': 'application/json', 'Idempotency-Key': 'fixture_attempt_0001' }, body: '{}',
  }));
  return { storage, service, attempt, providerCalls: () => providerCalls };
}

test('alarm preserves real concurrent create attempts and their rolling rejection', async () => {
  const f = fixture();
  const key = 'attempt:' + OWNER;
  await f.storage.put(key, [NOW - 3600001]);
  f.storage.onList = async prefix => {
    if (prefix !== 'attempt:') return;
    f.storage.onList = null;
    for (let i = 0; i < 3; i++) {
      const response = await f.attempt();
      assert.equal(response.status, 503); // Disabled native, but attempt counts.
      assert.equal((await response.json()).error, 'exact_native_adapter_unavailable');
    }
  };
  await f.service.alarm();
  assert.deepEqual(await f.storage.get(key), [NOW, NOW, NOW]);
  const denied = await f.attempt();
  assert.equal(denied.status, 429);
  assert.equal((await denied.json()).error, 'create_attempt_rate_limit');
  assert.equal(f.providerCalls(), 0);
  assert.equal(await f.storage.get('leases'), undefined);
  assert(f.storage.alarmAt > NOW, 'fresh quota still has a future cleanup alarm');
});

test('alarm conditionally deletes expired attempts but preserves fresh and missing records', async () => {
  const f = fixture();
  await f.storage.put('attempt:expired', [NOW - 3600000]);
  await f.storage.put('attempt:gone', [NOW - 3600001]);
  await f.storage.put('attempt:fresh', [NOW]);
  f.storage.onList = async prefix => {
    if (prefix !== 'attempt:') return;
    f.storage.onList = null;
    await f.storage.delete('attempt:gone');
  };
  await f.service.alarm();
  assert.equal(await f.storage.get('attempt:expired'), undefined);
  assert.equal(await f.storage.get('attempt:gone'), undefined);
  assert.deepEqual(await f.storage.get('attempt:fresh'), [NOW]);
  assert.equal(f.providerCalls(), 0);
});
