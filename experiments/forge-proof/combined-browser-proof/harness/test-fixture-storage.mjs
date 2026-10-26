import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage } from './fixture-storage.mjs';
import { AdmissionService, GLOBAL_NAME, ORIGIN, routeHostRequest } from '../candidate/host/src/service-core.mjs';

test('unset fixture alarm reads null inside and outside a transaction', async () => {
  const storage = new MemoryStorage();
  assert.equal(await storage.getAlarm(), null);
  await storage.transaction(async txn => assert.equal(await txn.getAlarm(), null));
  assert.equal(await storage.getAlarm(), null);
});

test('transaction sees and preserves an earlier cleanup alarm', async () => {
  const storage = new MemoryStorage();
  await storage.setAlarm(1000);
  await storage.transaction(async txn => {
    const current = await txn.getAlarm();
    assert.equal(current, 1000);
    if (current === null || 2000 < current) await txn.setAlarm(2000);
    await txn.put('attempt', [10]);
  });
  assert.equal(await storage.getAlarm(), 1000);
  assert.deepEqual(await storage.get('attempt'), [10]);
});

test('successful transaction commits staged alarm and data together', async () => {
  const storage = new MemoryStorage();
  await storage.setAlarm(2000);
  await storage.put('lease', { phase: 'before' });
  const result = await storage.transaction(async txn => {
    await txn.setAlarm(1000);
    await txn.put('lease', { phase: 'after' });
    assert.equal(await storage.getAlarm(), 2000);
    assert.deepEqual(await storage.get('lease'), { phase: 'before' });
    return 'committed';
  });
  assert.equal(result, 'committed');
  assert.equal(await storage.getAlarm(), 1000);
  assert.deepEqual(await storage.get('lease'), { phase: 'after' });
});

test('failed transaction rolls back alarm and data without blocking the next transaction', async () => {
  const storage = new MemoryStorage();
  await storage.setAlarm(1000);
  await storage.put('lease', { phase: 'before' });
  await assert.rejects(storage.transaction(async txn => {
    await txn.setAlarm(500);
    await txn.put('lease', { phase: 'uncommitted' });
    await txn.put('new', true);
    throw new Error('fixture rollback');
  }), /fixture rollback/);
  await storage.transaction(async txn => {
    assert.equal(await txn.getAlarm(), 1000);
    assert.deepEqual(await txn.get('lease'), { phase: 'before' });
    assert.equal(await txn.get('new'), undefined);
    await txn.put('next', true);
  });
  assert.equal(await storage.getAlarm(), 1000);
  assert.deepEqual(await storage.get('lease'), { phase: 'before' });
  assert.equal(await storage.get('new'), undefined);
  assert.equal(await storage.get('next'), true);
});

test('concurrent transactions serialize and observe the preceding committed alarm and data', async () => {
  const storage = new MemoryStorage();
  let releaseFirst, markFirstEntered, secondEntered = false;
  const firstEntered = new Promise(resolve => { markFirstEntered = resolve; });
  const release = new Promise(resolve => { releaseFirst = resolve; });
  const first = storage.transaction(async txn => {
    await txn.setAlarm(1000);
    await txn.put('attempt', [1]);
    markFirstEntered();
    await release;
  });
  await firstEntered;
  const second = storage.transaction(async txn => {
    secondEntered = true;
    assert.equal(await txn.getAlarm(), 1000);
    const attempts = await txn.get('attempt');
    assert.deepEqual(attempts, [1]);
    await txn.put('attempt', [...attempts, 2]);
    const current = await txn.getAlarm();
    if (current === null || 2000 < current) await txn.setAlarm(2000);
  });
  await Promise.resolve();
  assert.equal(secondEntered, false);
  assert.equal(await storage.getAlarm(), null);
  assert.equal(await storage.get('attempt'), undefined);
  releaseFirst();
  await Promise.all([first, second]);
  assert.equal(await storage.getAlarm(), 1000);
  assert.deepEqual(await storage.get('attempt'), [1, 2]);
});

test('actual admission route rejects invalid input after scheduling cleanup without reaching a provider', async () => {
  const owner = '00000000-0000-4000-8000-000000000001';
  const now = 1_800_000_000_000;
  for (const earlierAlarm of [null, now + 1000]) {
    const storage = new MemoryStorage();
    if (earlierAlarm !== null) await storage.setAlarm(earlierAlarm);
    let nativeReads = 0, providerLookups = 0, startups = 0;
    const env = {
      FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: owner,
      FORGE_TRIAL_EXPIRES_AT: new Date(now + 875000).toISOString(),
      FORGE_TRIAL_MATCH_MS: '875000', FORGE_TRIAL_RUNTIME_BUDGET_MS: '1764000',
      FORGE_TRIAL_MAX_RESERVATIONS: '2',
      FORGE_MATCHES: { getByName() { providerLookups++; throw new Error('provider must not be reached'); } },
    };
    const verifyBearer = async authorization => authorization === 'Bearer fixture-storage-test' ? { id: owner, is_anonymous: false } : null;
    const native = { get ready() { nativeReads++; throw new Error('native must not be reached'); } };
    const admission = new AdmissionService({
      ctx: { storage, waitUntil() { startups++; throw new Error('startup must not be reached'); } },
      env, native, verifyBearer, now: () => now,
    });
    env.FORGE_ADMISSION = { getByName(name) { assert.equal(name, GLOBAL_NAME); return admission; } };
    const response = await routeHostRequest(new Request(ORIGIN + '/api/play/matches', {
      method: 'POST', headers: {
        Origin: ORIGIN, Authorization: 'Bearer fixture-storage-test',
        'Content-Type': 'application/json', 'Idempotency-Key': 'fixture-storage-invalid-input',
      }, body: '[]',
    }), env, verifyBearer);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'invalid_json' });
    assert.equal(await storage.getAlarm(), earlierAlarm ?? now + 60000);
    assert.deepEqual(await storage.get('attempt:' + owner), [now]);
    assert.equal(await storage.get('leases'), undefined);
    assert.equal(nativeReads, 0);
    assert.equal(providerLookups, 0);
    assert.equal(startups, 0);
  }
});
