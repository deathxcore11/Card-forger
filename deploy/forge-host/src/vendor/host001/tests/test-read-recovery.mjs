// SPDX-License-Identifier: GPL-3.0-or-later
// Regression: read-only network failure must not destroy a still-live match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchAuthority, FORGE_REVISION, NATIVE_SCHEMA } from '../session-authority.mjs';
import { GatewayDriver } from '../gateway-driver.mjs';
const OWNER = '00000000-0000-4000-8000-000000000001';
const MATCH = '00000000-0000-4000-8000-000000000004';
const GENERATION = '00000000-0000-4000-8000-000000000005';
const EPOCH = '00000000-0000-4000-8000-000000000006';
const ORIGIN = 'https://cardstashy.com';
const TOKEN = 'internal-recovery-fixture-not-a-service-credential';
const snapshot = { schema: NATIVE_SCHEMA, forgeRevision: FORGE_REVISION, viewer: 0, status: 'running', revision: 12, fixture: true };

class Storage {
  constructor() { this.data = new Map(); this.queue = Promise.resolve(); }
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  transaction(fn) {
    const pending = this.queue.then(() => fn(this));
    this.queue = pending.catch(() => {});
    return pending;
  }
}

async function fixture() {
  const storage = new Storage();
  const state = { running: true, fetches: 0, submits: 0,
    response: () => new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': EPOCH } }) };
  const driver = new GatewayDriver({ internalToken: TOKEN,
    isRunning: async () => state.running,
    fetchExisting: async request => { state.fetches++; if (request.method === 'POST') state.submits++; return state.response(request); },
    stopExisting: async () => ({ confirmed: false }) });
  const authority = new MatchAuthority({ storage, driver, now: () => 1000,
    verifyBearer: async () => ({ id: OWNER, is_anonymous: false }) });
  await authority.initialize({ ownerId: OWNER, matchId: MATCH, generation: GENERATION, epoch: EPOCH, viewerId: 0,
    deckDigests: { human: 'a'.repeat(64), opponent: 'b'.repeat(64) }, expiresAt: 7201000 });
  const get = () => authority.handle(new Request(`${ORIGIN}/api/play/matches/${MATCH}`, { headers: { Authorization: 'Bearer fixture' } }));
  return { storage, state, driver, authority, get };
}

test('temporary read network failure returns 503 and the same match can recover', async () => {
  const f = await fixture(); const success = f.state.response;
  f.state.response = () => { throw new TypeError('temporary connection reset'); };
  const first = await f.get();
  assert.equal(first.status, 503);
  assert.equal(first.headers.get('Cache-Control'), 'no-store');
  assert.equal(first.headers.get('Retry-After'), '1');
  assert.equal((await f.storage.get('match')).status, 'running');
  assert.equal(f.state.fetches, 1, 'no hidden automatic retry');
  f.state.response = success;
  const second = await f.get();
  assert.equal(second.status, 200);
  assert.equal((await second.json()).generation, GENERATION);
  assert.equal(f.state.submits, 0);
});

test('read timeout does not permanently interrupt the match', async () => {
  const f = await fixture();
  f.state.response = () => { throw new DOMException('read deadline', 'TimeoutError'); };
  assert.equal((await f.get()).status, 503);
  assert.equal((await f.storage.get('match')).status, 'running');
});

test('timeout while streaming native state remains retryable', async () => {
  const f = await fixture();
  f.state.response = () => new Response(new ReadableStream({
    start(controller) { controller.error(new DOMException('body read deadline', 'TimeoutError')); },
  }), { headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': EPOCH } });
  assert.equal((await f.get()).status, 503);
  assert.equal((await f.storage.get('match')).status, 'running');
});

test('unavailable process-status lookup is not mistaken for confirmed death', async () => {
  const f = await fixture();
  f.driver.isRunning = async () => { throw new TypeError('provider status timeout'); };
  assert.equal((await f.get()).status, 503);
  assert.equal((await f.storage.get('match')).status, 'running');
  assert.equal(f.state.fetches, 0);
});

test('indeterminate process-status result remains retryable without fetching', async () => {
  const f = await fixture();
  f.driver.isRunning = async () => undefined;
  assert.equal((await f.get()).status, 503);
  assert.equal((await f.storage.get('match')).status, 'running');
  assert.equal(f.state.fetches, 0);
});

test('503 native read remains a retryable state observation failure', async () => {
  const f = await fixture();
  f.state.response = () => new Response('{"error":"native_unavailable_outcome_unknown"}',
    { status: 503, headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': EPOCH } });
  assert.equal((await f.get()).status, 503);
  assert.equal((await f.storage.get('match')).status, 'running');
});

test('confirmed stopped process remains a permanent interruption without auto-start', async () => {
  const f = await fixture(); f.state.running = false;
  assert.equal((await f.get()).status, 410);
  assert.equal((await f.storage.get('match')).status, 'interrupted');
  assert.equal(f.state.fetches, 0);
  f.state.running = true;
  assert.equal((await f.get()).status, 410);
  assert.equal(f.state.fetches, 0, 'new process must not resurrect the interrupted match');
});

test('changed native epoch still permanently interrupts before exposing replacement state', async () => {
  const f = await fixture();
  f.state.response = () => new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': OWNER } });
  assert.equal((await f.get()).status, 410);
  assert.equal((await f.storage.get('match')).status, 'interrupted');
});

test('malformed native JSON remains a permanent protocol failure', async () => {
  const f = await fixture();
  f.state.response = () => new Response('not-json', { headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': EPOCH } });
  assert.equal((await f.get()).status, 410);
  assert.equal((await f.storage.get('match')).status, 'interrupted');
});

test('ambiguous mutating request still stays pending and is never replayed', async () => {
  const f = await fixture();
  f.state.response = () => { throw new TypeError('reply lost after possible mutation'); };
  const post = () => f.authority.handle(new Request(`${ORIGIN}/api/play/matches/${MATCH}/actions`, {
    method: 'POST', headers: { Authorization: 'Bearer fixture', Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandId: 'recovery_fixture_001', generation: GENERATION, action: { revision: 12, op: 'ok' } }) }));
  assert.equal((await (await post()).json()).state, 'pending_outcome_unknown');
  assert.equal((await (await post()).json()).state, 'pending_outcome_unknown');
  assert.equal(f.state.submits, 1);
  assert.equal((await f.storage.get('match')).pendingCommand, 'recovery_fixture_001');
});

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
async function watched(operation) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('read recovery test exceeded deadline')), 1500);
  })]); } finally { clearTimeout(timer); }
}
const post = (f, commandId, action) => f.authority.handle(new Request(`${ORIGIN}/api/play/matches/${MATCH}/actions`, {
  method: 'POST', headers: { Authorization: 'Bearer fixture', Origin: ORIGIN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ commandId, generation: GENERATION, action }),
}));

test('provider unavailable status without an epoch is uncertainty, not a replacement JVM', async () => {
  for (const status of [408, 429, 502, 503, 504]) {
    const f = await fixture(); const success = f.state.response;
    f.state.response = () => new Response('provider unavailable', { status });
    const response = await f.get();
    assert.equal(response.status, 503, String(status));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Retry-After'), '1');
    assert.equal((await f.storage.get('match')).status, 'running');
    assert.equal(f.state.fetches, 1);
    f.state.response = success;
    assert.equal((await f.get()).status, 200);
  }
});

test('different nonempty epoch remains fatal even on an unavailable status', async () => {
  const f = await fixture();
  f.state.response = () => new Response('unavailable', { status: 503, headers: { 'X-Host-Epoch': OWNER } });
  assert.equal((await f.get()).status, 410);
  assert.equal((await f.storage.get('match')).status, 'interrupted');
});

test('successful response without an epoch is malformed protocol, not a retryable observation', async () => {
  const f = await fixture();
  f.state.response = () => new Response(JSON.stringify(snapshot), { headers: { 'Content-Type': 'application/json' } });
  assert.equal((await f.get()).status, 410);
  assert.equal((await f.storage.get('match')).status, 'interrupted');
});

test('unavailable provider body cancellation cannot stall the read-recovery response', async () => {
  const f = await fixture(); let canceled = 0;
  f.state.response = () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('provider')); },
    cancel() { canceled++; return new Promise(() => {}); },
  }), { status: 503 });
  assert.equal((await watched(f.get())).status, 503);
  assert.equal(canceled, 1);
  assert.equal((await f.storage.get('match')).status, 'running');
});

test('actual driver read deadline preserves the same running allocation for a later GET', async () => {
  const f = await fixture(); const success = f.state.response;
  f.driver.timeoutMs = 25;
  f.state.response = () => new Promise(() => {});
  assert.equal((await watched(f.get())).status, 503);
  assert.equal((await f.storage.get('match')).status, 'running');
  f.state.response = success;
  assert.equal((await f.get()).status, 200);
  assert.equal(f.state.fetches, 2, 'only the two explicit GETs were sent');
});

test('authority read deadline does not mistake cancellation for JVM death', async () => {
  const f = await fixture();
  f.authority.requestTimeoutMs = 25;
  f.state.response = () => new Promise(() => {});
  const response = await watched(f.get());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '1');
  assert.equal((await f.storage.get('match')).status, 'running');
});

test('client abort during an in-flight GET cannot permanently interrupt the match', async () => {
  const f = await fixture(); const entered = deferred(); const controller = new AbortController();
  f.state.response = () => { entered.resolve(); return new Promise(() => {}); };
  const read = f.authority.handle(new Request(`${ORIGIN}/api/play/matches/${MATCH}`, {
    headers: { Authorization: 'Bearer fixture' }, signal: controller.signal,
  }));
  await entered.promise; controller.abort(new Error('client disconnected'));
  assert.equal((await watched(read)).status, 503);
  assert.equal((await f.storage.get('match')).status, 'running');
});

test('retryable read failure crossing hard expiry returns expired, not running503', async () => {
  const f = await fixture(); let time = 1000;
  f.authority.now = () => time;
  f.state.response = () => { time = 7201000; throw new TypeError('temporary read reset at expiry'); };
  const response = await f.get();
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { error: 'match_expired' });
  assert.equal((await f.storage.get('match')).reason, 'expired');
});

test('read recovery does not clear a pending command or admit a later mutation', async () => {
  const f = await fixture(); const success = f.state.response;
  f.state.response = () => { throw new TypeError('possibly accepted POST lost its response'); };
  const action = { revision: 12, op: 'ok' };
  assert.equal((await (await post(f, 'recovery_pending_001', action)).json()).state, 'pending_outcome_unknown');
  assert.equal((await f.get()).status, 503);
  f.state.response = success;
  assert.equal((await f.get()).status, 200);
  assert.equal((await f.storage.get('match')).pendingCommand, 'recovery_pending_001');
  assert.equal((await post(f, 'recovery_pending_002', action)).status, 409);
  assert.equal((await (await post(f, 'recovery_pending_001', action)).json()).state, 'pending_outcome_unknown');
  assert.equal(f.state.submits, 1);
});

test('malformed schema, revision or private viewer still permanently interrupt', async () => {
  for (const changed of [{ schema: 'wrong' }, { forgeRevision: 'wrong' }, { viewer: 1 }]) {
    const f = await fixture();
    f.state.response = () => new Response(JSON.stringify({ ...snapshot, ...changed }), {
      headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': EPOCH },
    });
    assert.equal((await f.get()).status, 410);
    assert.equal((await f.storage.get('match')).status, 'interrupted');
  }
});

test('read recovery never bypasses owner verification', async () => {
  const f = await fixture();
  f.authority.verifyBearer = async () => ({ id: MATCH, is_anonymous: false });
  assert.equal((await f.get()).status, 404);
  assert.equal(f.state.fetches, 0);
  assert.equal((await f.storage.get('match')).status, 'running');
});

test('controlMode transport preserves exact native smart and full requests', async () => {
  for (const value of ['smart', 'full']) {
    const f = await fixture(); let received;
    f.state.response = async request => {
      received = await request.json();
      return new Response('{}', { status: 202, headers: { 'X-Host-Epoch': EPOCH } });
    };
    const action = { revision: 12, op: 'controlMode', value };
    assert.equal((await post(f, 'control_mode_fixture_01', action)).status, 202);
    assert.deepEqual(received, action);
  }
});

test('controlMode rejects missing/invalid values and extra inner fields before dispatch', async () => {
  for (const action of [
    { revision: 12, op: 'controlMode' },
    { revision: 12, op: 'controlMode', value: 'auto' },
    { revision: 12, op: 'controlMode', value: true },
    { revision: 12, op: 'controlMode', value: 'smart', viewer: 1 },
  ]) {
    const f = await fixture();
    assert.equal((await post(f, 'control_mode_invalid_01', action)).status, 400);
    assert.equal(f.state.submits, 0);
  }
});

test('autoPay transport forwards exact boolean requests and rejects anything else', async () => {
  for (const value of [true, false]) {
    const f = await fixture(); let received;
    f.state.response = async request => {
      received = await request.json();
      return new Response('{}', { status: 202, headers: { 'X-Host-Epoch': EPOCH } });
    };
    const action = { revision: 12, op: 'autoPay', value };
    assert.equal((await post(f, 'auto_pay_fixture_01', action)).status, 202);
    assert.deepEqual(received, action);
  }
  for (const action of [
    { revision: 12, op: 'autoPay' },
    { revision: 12, op: 'autoPay', value: 'true' },
    { revision: 12, op: 'autoPay', value: 1 },
    { revision: 12, op: 'autoPay', value: true, viewer: 1 },
  ]) {
    const f = await fixture();
    assert.equal((await post(f, 'auto_pay_invalid_01', action)).status, 400);
    assert.equal(f.state.submits, 0);
  }
});

test('unsupported native controlMode stays a native rejection, not invented support', async () => {
  const f = await fixture();
  f.state.response = () => new Response('{}', { status: 400, headers: { 'X-Host-Epoch': EPOCH } });
  const response = await post(f, 'control_mode_unsupported_01', { revision: 12, op: 'controlMode', value: 'smart' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).state, 'rejected');
  assert.equal((await f.storage.get('match')).pendingCommand, null);
});
