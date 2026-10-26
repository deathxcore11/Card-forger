// SPDX-License-Identifier: GPL-3.0-or-later
// Host lifecycle fixtures only. No accounts, provider calls, or game simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { MatchAuthority, NATIVE_SCHEMA, FORGE_REVISION, boundedJSON } from '../session-authority.mjs';
import { GatewayDriver } from '../gateway-driver.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [OWNER, MATCH, GENERATION, EPOCH, OTHER_EPOCH] = [1, 2, 3, 4, 5].map(id);
const TOKEN = 'lifecycle-fixture-only-not-a-service-secret';
const ORIGIN = 'https://cardstashy.com';
const PATH = '/api/play/matches/' + MATCH;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function watched(operation, timeoutMs = 1500) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('bounded lifecycle test exceeded watchdog')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

class MemoryStorage {
  constructor() { this.data = new Map(); this.queue = Promise.resolve(); }
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  transaction(callback) {
    const result = this.queue.then(async () => {
      const staged = new MemoryStorage(); staged.data = structuredClone(this.data);
      const value = await callback(staged); this.data = staged.data; return value;
    });
    this.queue = result.catch(() => {});
    return result;
  }
}

const request = (method = 'GET', body) => new Request(ORIGIN + PATH + (method === 'POST' ? '/actions' : ''), {
  method, headers: { Authorization: 'Bearer fixture', Origin: ORIGIN, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const command = () => ({ commandId: 'lifecycle_command_0001', generation: GENERATION, action: { revision: 1, op: 'ok' } });

async function fixture(driver) {
  const storage = new MemoryStorage();
  const options = { storage, driver, now: () => 1000,
    verifyBearer: async () => ({ id: OWNER, is_anonymous: false }) };
  const authority = new MatchAuthority(options);
  await authority.initialize({ ownerId: OWNER, matchId: MATCH, generation: GENERATION, epoch: EPOCH,
    viewerId: 0, deckDigests: { human: 'a'.repeat(64), opponent: 'b'.repeat(64) }, expiresAt: 2000 });
  return { authority, storage, options };
}

function cleanupFixture() {
  const f = { running: true, epoch: EPOCH, inspections: 0, fetches: 0, stops: [] };
  f.driver = new GatewayDriver({ internalToken: TOKEN, isRunning: async () => f.running,
    inspectExisting: async ({ expectedEpoch }) => {
      assert.equal(expectedEpoch, EPOCH); f.inspections++; return { running: f.running, epoch: f.epoch };
    },
    fetchExisting: async () => { f.fetches++; throw Error('unavailable HTTP readiness'); },
    stopExisting: async options => { f.stops.push(options); f.running = false; return { confirmed: true }; },
  });
  return f;
}

test('trusted immutable-allocation identity permits cleanup despite unavailable HTTP', async () => {
  const f = cleanupFixture();
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: true });
  assert.deepEqual(f.stops, [{ expectedEpoch: EPOCH }]);
  assert.equal(f.inspections, 2);
  assert.equal(f.fetches, 0);
});

test('trusted inspection cannot authorize stopping a different allocation epoch', async () => {
  const f = cleanupFixture(); f.epoch = OTHER_EPOCH;
  await assert.rejects(() => f.driver.destroyExisting({ expectedEpoch: EPOCH }), /identity_mismatch/);
  assert.equal(f.stops.length, 0);
  assert.equal(f.fetches, 0);
});

test('absent or malformed trusted identity cannot authorize forced stop', async () => {
  for (const record of [undefined, { running: true }, { epoch: EPOCH, running: 'false' }]) {
    const f = cleanupFixture(); f.driver.inspectExisting = async () => record;
    await assert.rejects(() => f.driver.destroyExisting({ expectedEpoch: EPOCH }), /identity_mismatch/);
    assert.equal(f.stops.length, 0);
  }
});

test('trusted confirmed destruction receipt needs no HTTP or another stop', async () => {
  const f = cleanupFixture(); f.running = false;
  f.driver.inspectExisting = async () => ({ epoch: EPOCH, running: false, destructionConfirmed: true });
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: true });
  assert.equal(f.stops.length, 0);
  assert.equal(f.fetches, 0);
});

test('not-running without confirmed destruction still performs recorded-instance stop', async () => {
  const f = cleanupFixture(); f.running = false;
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: true });
  assert.equal(f.stops.length, 1);
});

test('confirmed stop receipt alone is insufficient when provider still reports running', async () => {
  const f = cleanupFixture(); f.driver.stopExisting = async () => ({ confirmed: true });
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: false });
});

test('changed allocation identity after stop cannot release admission', async () => {
  const f = cleanupFixture();
  f.driver.stopExisting = async () => { f.running = false; f.epoch = OTHER_EPOCH; return { confirmed: true }; };
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: false });
});

test('HTTP outage without trusted identity retains the legacy fail-closed fence', async () => {
  const f = cleanupFixture(); f.driver.inspectExisting = undefined;
  await assert.rejects(() => f.driver.destroyExisting({ expectedEpoch: EPOCH }), /unavailable HTTP/);
  assert.equal(f.stops.length, 0);
});

test('legacy running=false alone cannot certify destruction or free admission', async () => {
  const f = cleanupFixture(); f.driver.inspectExisting = undefined; f.running = false;
  assert.deepEqual(await f.driver.destroyExisting({ expectedEpoch: EPOCH }), { confirmed: false });
  assert.equal(f.stops.length, 0);
  assert.equal(f.fetches, 0);
});

test('close drains a reserved action before its tombstone; no post-close dispatch', async () => {
  const entered = deferred(), release = deferred();
  let running = true, checks = 0, storage;
  const dispatchedStates = [];
  const driver = new GatewayDriver({ internalToken: TOKEN,
    isRunning: async () => { if (++checks === 1) { entered.resolve(); await release.promise; } return running; },
    inspectExisting: async () => ({ running, epoch: EPOCH }),
    fetchExisting: async req => {
      assert.equal(req.method, 'POST');
      dispatchedStates.push((await storage.get('match')).status);
      return new Response('{}', { status: 202, headers: { 'X-Host-Epoch': EPOCH } });
    },
    stopExisting: async () => { running = false; return { confirmed: true }; },
  });
  const f = await fixture(driver); storage = f.storage;
  const action = f.authority.handle(request('POST', command()));
  await entered.promise;
  const close = f.authority.handle(request('DELETE'));
  await tick();
  assert.equal((await storage.get('match')).status, 'running', 'close must not tombstone ahead of reserved dispatch');
  release.resolve();
  assert.equal((await action).status, 202);
  assert.equal((await close).status, 204);
  assert.deepEqual(dispatchedStates, ['running']);
  assert.equal((await storage.get('match')).status, 'closed');
  assert.equal((await f.authority.handle(request('POST', command()))).status, 410);
  assert.equal(dispatchedStates.length, 1);
});

test('different authority facades sharing storage serialize close behind dispatch', async () => {
  const entered = deferred(), release = deferred();
  const order = [];
  const f = await fixture({
    submitExisting: async () => { entered.resolve(); await release.promise; order.push('submitted'); return { epoch: EPOCH, status: 202 }; },
    destroyExisting: async () => { order.push('destroyed'); return { confirmed: true }; },
  });
  const second = new MatchAuthority(f.options);
  const action = f.authority.handle(request('POST', command())); await entered.promise;
  const close = second.handle(request('DELETE')); await tick();
  assert.deepEqual(order, []);
  release.resolve(); await action; await close;
  assert.deepEqual(order, ['submitted', 'destroyed']);
});

test('a failed request does not poison the authority operation queue', async () => {
  const f = await fixture({ destroyExisting: async () => ({ confirmed: true }) });
  const original = f.storage.get.bind(f.storage); let once = true;
  f.storage.get = async key => { if (once) { once = false; throw Error('fixture storage error'); } return original(key); };
  await assert.rejects(() => f.authority.handle(request()), /fixture storage error/);
  assert.equal((await f.authority.handle(request('DELETE'))).status, 204);
});

test('late terminal response cannot override an independently committed close tombstone', async () => {
  const entered = deferred(), release = deferred();
  const f = await fixture({ readExisting: async () => {
    entered.resolve(); await release.promise;
    return { epoch: EPOCH, snapshot: { schema: NATIVE_SCHEMA, forgeRevision: FORGE_REVISION,
      viewer: 0, status: 'finished', draw: false, winnerPlayerId: 1 } };
  } });
  const state = f.authority.handle(request()); await entered.promise;
  await f.storage.transaction(async txn => { const match = await txn.get('match'); match.status = 'closed'; await txn.put('match', match); });
  release.resolve();
  const response = await state;
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { error: 'match_closed' });
  assert.equal((await f.storage.get('match')).result, undefined);
});

test('terminal response uses the winning durable receipt, not a later uncommitted result', async () => {
  const entered = deferred(), release = deferred();
  const f = await fixture({ readExisting: async () => {
    entered.resolve(); await release.promise;
    return { epoch: EPOCH, snapshot: { schema: NATIVE_SCHEMA, forgeRevision: FORGE_REVISION,
      viewer: 0, status: 'finished', draw: false, winnerPlayerId: 1 } };
  } });
  const state = f.authority.handle(request()); await entered.promise;
  await f.storage.transaction(async txn => {
    const match = await txn.get('match'); match.status = 'finished'; match.result = { draw: true, winnerPlayerId: null }; await txn.put('match', match);
  });
  release.resolve();
  assert.deepEqual((await (await state).json()).result, { draw: true, winnerPlayerId: null });
});

test('stalled action body and stalled source cancellation release queued close without dispatch', async () => {
  let submits = 0, destroys = 0, cancels = 0;
  const f = await fixture({ submitExisting: async () => { submits++; return { epoch: EPOCH, status: 202 }; },
    destroyExisting: async () => { destroys++; return { confirmed: true }; } });
  f.authority.requestTimeoutMs = 40;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
    cancel() { cancels++; return new Promise(() => {}); } });
  const action = f.authority.handle(new Request(ORIGIN + PATH + '/actions', { method: 'POST', duplex: 'half', body,
    headers: { Authorization: 'Bearer fixture', Origin: ORIGIN, 'Content-Type': 'application/json' } }));
  const close = f.authority.handle(request('DELETE'));
  const [first, second] = await watched(Promise.all([action, close]));
  assert.equal(first.status, 400);
  assert.equal(second.status, 204);
  assert.equal(submits, 0);
  assert.equal(destroys, 1);
  assert.equal(cancels, 1);
});

test('stalled verifier cannot hold queued close indefinitely', async () => {
  let verifies = 0, destroys = 0;
  const f = await fixture({ destroyExisting: async () => { destroys++; return { confirmed: true }; } });
  f.authority.requestTimeoutMs = 40;
  f.authority.verifyBearer = async () => ++verifies === 1 ? new Promise(() => {}) : { id: OWNER, is_anonymous: false };
  const responses = await watched(Promise.all([f.authority.handle(request()), f.authority.handle(request('DELETE'))]));
  assert.equal(responses[0].status, 401);
  assert.equal(responses[1].status, 204);
  assert.equal(destroys, 1);
});

test('late isRunning resolution after timeout and close cannot dispatch a reserved action', async () => {
  const runningCheck = deferred(); let calls = 0, posts = 0, running = true;
  const driver = new GatewayDriver({ internalToken: TOKEN, timeoutMs: 30,
    isRunning: async () => ++calls === 1 ? runningCheck.promise : running,
    inspectExisting: async () => ({ running, epoch: EPOCH }),
    fetchExisting: async () => { posts++; return new Response('{}', { status: 202, headers: { 'X-Host-Epoch': EPOCH } }); },
    stopExisting: async () => { running = false; return { confirmed: true }; },
  });
  const f = await fixture(driver);
  const [action, close] = await watched(Promise.all([f.authority.handle(request('POST', command())), f.authority.handle(request('DELETE'))]));
  assert.equal(action.status, 202);
  assert.equal((await action.json()).state, 'pending_outcome_unknown');
  assert.equal(close.status, 204);
  runningCheck.resolve(true); await tick();
  assert.equal(posts, 0);
  assert.equal((await f.storage.get('match')).pendingCommand, command().commandId);
});

test('stalled dispatched transport releases queued close with pending receipt and no replay', async () => {
  let calls = 0, running = true, outgoing;
  const driver = new GatewayDriver({ internalToken: TOKEN, timeoutMs: 30,
    isRunning: async () => running,
    inspectExisting: async () => ({ running, epoch: EPOCH }),
    fetchExisting: async request => { calls++; outgoing = request; return new Promise(() => {}); },
    stopExisting: async () => { running = false; return { confirmed: true }; },
  });
  const f = await fixture(driver);
  const [action, close] = await watched(Promise.all([f.authority.handle(request('POST', command())), f.authority.handle(request('DELETE'))]));
  assert.equal((await action.json()).state, 'pending_outcome_unknown');
  assert.equal(close.status, 204);
  assert.equal(outgoing.signal.aborted, true);
  assert.equal(calls, 1);
  assert.equal((await f.storage.get('match')).pendingCommand, command().commandId);
});

test('stalled native snapshot body obeys the same total driver deadline', async () => {
  let canceled = false;
  const driver = new GatewayDriver({ internalToken: TOKEN, timeoutMs: 30, isRunning: async () => true,
    stopExisting: async () => ({ confirmed: false }),
    fetchExisting: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
      cancel() { canceled = true; return new Promise(() => {}); },
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Host-Epoch': EPOCH } }),
  });
  await watched(assert.rejects(() => driver.readExisting({ expectedEpoch: EPOCH }), { name: 'TimeoutError' }));
  assert.equal(canceled, true);
});

test('direct router boundedJSON has a five-second deadline without an authority or caller abort', async () => {
  let canceled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
    cancel() { canceled = true; return new Promise(() => {}); },
  });
  const incoming = new Request(ORIGIN, { method: 'POST', duplex: 'half', body, headers: { 'Content-Type': 'application/json' } });
  const started = performance.now();
  await watched(assert.rejects(() => boundedJSON(incoming, 20480), { name: 'TimeoutError' }), 6500);
  assert.ok(performance.now() - started < 6000);
  assert.equal(canceled, true);
});
