// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatewayDriver } from '../gateway-driver.mjs';
const EPOCH = '00000000-0000-4000-8000-000000000006';
const OTHER = '00000000-0000-4000-8000-000000000007';
const TOKEN = 'internal-transport-fixture-not-a-service-credential';

function fixture() {
  const f = { requests: [], running: true, status: 200, epoch: EPOCH, body: '{"status":"running","fixture":true}', stopCalls: [] };
  f.driver = new GatewayDriver({ internalToken: TOKEN, isRunning: async () => f.running,
    fetchExisting: async request => {
      f.requests.push(request);
      return new Response(f.body, { status: f.status, headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': f.epoch } });
    }, stopExisting: async options => { f.stopCalls.push(options); f.running = false; return { confirmed: true }; } });
  return f;
}

test('existing state read uses only internal capability, fixed route and manual redirects', async () => {
  const f = fixture();
  assert.equal((await f.driver.readExisting({ expectedEpoch: EPOCH })).snapshot.fixture, true);
  const request = f.requests[0];
  assert.equal(request.url, 'http://host001.internal/state');
  assert.equal(request.redirect, 'manual');
  assert.equal(request.headers.get('Authorization'), 'Bearer ' + TOKEN);
  assert.equal(request.headers.get('Cookie'), null);
});

test('native POST carries the epoch precondition and original action', async () => {
  const f = fixture(); f.status = 202; f.body = '{"accepted":true}';
  const action = { revision: 9, op: 'reply', indexes: [1, 0], promptId: 3 };
  assert.deepEqual(await f.driver.submitExisting(action, { expectedEpoch: EPOCH }), { epoch: EPOCH, status: 202 });
  assert.equal(f.requests[0].headers.get('X-Expected-Host-Epoch'), EPOCH);
  assert.deepEqual(await f.requests[0].json(), action);
});

test('stopped container read and action do not fetch or start anything', async () => {
  const f = fixture(); f.running = false;
  await assert.rejects(() => f.driver.readExisting({ expectedEpoch: EPOCH }), /not_running/);
  await assert.rejects(() => f.driver.submitExisting({ revision: 1, op: 'ok' }, { expectedEpoch: EPOCH }), /not_running/);
  assert.equal(f.requests.length, 0);
});

test('replacement JVM epoch is rejected on state and action receipts', async () => {
  const f = fixture(); f.epoch = OTHER;
  await assert.rejects(() => f.driver.readExisting({ expectedEpoch: EPOCH }), /epoch_mismatch/);
  await assert.rejects(() => f.driver.submitExisting({ revision: 1, op: 'ok' }, { expectedEpoch: EPOCH }), /epoch_mismatch/);
});

test('unknown POST result is not retried', async () => {
  const f = fixture(); f.status = 503;
  await assert.rejects(() => f.driver.submitExisting({ revision: 1, op: 'ok' }, { expectedEpoch: EPOCH }), /outcome_unknown/);
  assert.equal(f.requests.length, 1);
});

test('network error after POST is not retried', async () => {
  const f = fixture(); let attempts = 0;
  f.driver.fetchExisting = async () => { attempts++; throw Error('lost response'); };
  await assert.rejects(() => f.driver.submitExisting({ revision: 1, op: 'ok' }, { expectedEpoch: EPOCH }));
  assert.equal(attempts, 1);
});

test('oversize action and missing epoch are rejected before transport', async () => {
  const f = fixture();
  await assert.rejects(() => f.driver.submitExisting({ text: 'x'.repeat(17000) }, { expectedEpoch: EPOCH }));
  await assert.rejects(() => f.driver.readExisting({ expectedEpoch: '' }));
  assert.equal(f.requests.length, 0);
});

test('destruction checks epoch and requires confirmed stopped process', async () => {
  const f = fixture();
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: true });
  assert.deepEqual(f.stopCalls, [{ expectedEpoch: EPOCH }]);
  assert.equal(f.running, false);
});

test('destruction cannot kill a different JVM epoch', async () => {
  const f = fixture(); f.epoch = OTHER;
  await assert.rejects(() => f.driver.destroyExisting({ expectedEpoch: EPOCH }), /epoch_mismatch/);
  assert.equal(f.stopCalls.length, 0);
});

test('unconfirmed destruction cannot free admission capacity', async () => {
  const f = fixture(); f.driver.stopExisting = async () => ({ confirmed: true });
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: false });
});
