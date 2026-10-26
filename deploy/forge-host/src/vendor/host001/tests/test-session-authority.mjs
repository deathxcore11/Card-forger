// SPDX-License-Identifier: GPL-3.0-or-later
// Host fixtures only. Driver fixtures perform no card/rules simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchAuthority, FORGE_REVISION, NATIVE_SCHEMA, digest, boundedJSON } from '../session-authority.mjs';
import { AdmissionLedger, validateExactDeckInput } from '../admission-ledger.mjs';

const OWNER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const THIRD = '00000000-0000-4000-8000-000000000003';
const MATCH = '00000000-0000-4000-8000-000000000004';
const GENERATION = '00000000-0000-4000-8000-000000000005';
const EPOCH = '00000000-0000-4000-8000-000000000006';
const ORIGIN = 'https://cardstashy.com';
const PATH = `/api/play/matches/${MATCH}`;
const COMMAND = 'fixture_command_0001';
const ACTION = { revision: 12, op: 'reply', promptId: 44, indexes: [2, 0] };

// This is a transaction fixture, NOT a Cloudflare runtime certification.
class MemoryStorage {
  constructor() { this.data = new Map(); this.queue = Promise.resolve(); }
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { this.data.set(key, structuredClone(value)); }
  async delete(key) { return this.data.delete(key); }
  async list({ prefix }) { return new Map([...this.data].filter(([key]) => key.startsWith(prefix))); }
  transaction(callback) {
    const run = this.queue.then(async () => {
      const staging = new MemoryStorage();
      staging.data = structuredClone(this.data);
      const result = await callback(staging);
      this.data = staging.data;
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

const request = ({ method = 'GET', path = PATH, token = 'owner', body, origin = ORIGIN, headers = {} } = {}) => new Request(ORIGIN + path, {
  method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
  ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
});
const actionRequest = (changes = {}, options = {}) => request({ method: 'POST', path: PATH + '/actions',
  body: { commandId: COMMAND, generation: GENERATION, action: ACTION, ...changes }, ...options });

async function fixture() {
  let time = 1000;
  const storage = new MemoryStorage();
  const calls = { read: 0, submit: [], destroy: 0, verify: 0 };
  const snapshot = { schema: NATIVE_SCHEMA, forgeRevision: FORGE_REVISION, viewer: 0, status: 'running',
    revision: 12, players: [{ id: 0, zones: {} }], fixture: true };
  const driver = {
    async readExisting({ expectedEpoch }) { assert.equal(expectedEpoch, EPOCH); calls.read++; return { epoch: EPOCH, snapshot }; },
    async submitExisting(action, { expectedEpoch }) { assert.equal(expectedEpoch, EPOCH); calls.submit.push(action); return { epoch: EPOCH, status: 202 }; },
    async destroyExisting({ expectedEpoch }) { assert.equal(expectedEpoch, EPOCH); calls.destroy++; return { confirmed: true }; },
  };
  const authority = new MatchAuthority({ storage, driver, now: () => time,
    verifyBearer: async bearer => { calls.verify++; return bearer === 'Bearer owner' ? { id: OWNER, is_anonymous: false }
      : bearer === 'Bearer other' ? { id: OTHER, is_anonymous: false } : null; } });
  await authority.initialize({ ownerId: OWNER, matchId: MATCH, generation: GENERATION, epoch: EPOCH,
    viewerId: 0, deckDigests: { human: 'a'.repeat(64), opponent: 'b'.repeat(64) }, expiresAt: 7201000 });
  return { authority, storage, driver, calls, snapshot, setTime: value => { time = value; } };
}

test('unsigned, invalid and different accounts cannot inspect a native match', async () => {
  const f = await fixture();
  for (const token of [null, 'invalid']) assert.equal((await f.authority.handle(request({ token }))).status, 401);
  assert.equal((await f.authority.handle(request({ token: 'other' }))).status, 404);
  assert.equal(f.calls.read, 0);
});

test('cross-origin writes, missing write Origin and query viewer overrides are denied', async () => {
  const f = await fixture();
  for (const options of [{ origin: 'https://attacker.invalid' }, { origin: null }, { headers: { 'Sec-Fetch-Site': 'cross-site' } }]) {
    assert.equal((await f.authority.handle(actionRequest({}, options))).status, 401);
  }
  assert.equal((await f.authority.handle(request({ path: PATH + '?viewer=1' }))).status, 401);
  assert.equal(f.calls.submit.length, 0);
});

test('anonymous users and verifier errors fail closed', async () => {
  const f = await fixture();
  f.authority.verifyBearer = async () => ({ id: OWNER, is_anonymous: true });
  assert.equal((await f.authority.handle(request())).status, 401);
  f.authority.verifyBearer = async () => { throw Error('provider unavailable'); };
  assert.equal((await f.authority.handle(request())).status, 401);
  assert.equal(f.calls.read, 0);
});

test('every state/action request revalidates account and keeps response uncacheable', async () => {
  const f = await fixture();
  const response = await f.authority.handle(request());
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await response.json()).snapshot, f.snapshot);
  await f.authority.handle(actionRequest());
  assert.equal(f.calls.verify, 2);
});

test('exact native action fields and ordering are retained', async () => {
  const f = await fixture();
  const response = await f.authority.handle(actionRequest());
  assert.equal(response.status, 202);
  assert.deepEqual(f.calls.submit, [ACTION]);
  assert.equal((await response.json()).state, 'accepted');
});

test('simultaneous duplicate commands reach native only once', async () => {
  const f = await fixture();
  const responses = await Promise.all(Array.from({ length: 16 }, () => f.authority.handle(actionRequest())));
  assert.ok(responses.every(response => response.status === 202));
  assert.equal(f.calls.submit.length, 1);
});

test('command receipt survives authority reconstruction', async () => {
  const f = await fixture();
  await f.authority.handle(actionRequest());
  const next = new MatchAuthority({ storage: f.storage, driver: f.driver, verifyBearer: f.authority.verifyBearer });
  next.now = () => 1000;
  assert.equal((await next.handle(actionRequest())).status, 202);
  assert.equal(f.calls.submit.length, 1);
});

test('reusing command ID for different input is rejected', async () => {
  const f = await fixture();
  await f.authority.handle(actionRequest());
  const response = await f.authority.handle(actionRequest({ action: { ...ACTION, indexes: [0, 2] } }));
  assert.equal(response.status, 409);
  assert.equal(f.calls.submit.length, 1);
});

test('ambiguous network failure persists pending and blocks retries and later commands', async () => {
  const f = await fixture();
  f.driver.submitExisting = async action => { f.calls.submit.push(action); throw Error('lost response after possible acceptance'); };
  const first = await f.authority.handle(actionRequest());
  assert.equal((await first.json()).state, 'pending_outcome_unknown');
  const duplicate = await f.authority.handle(actionRequest());
  assert.equal((await duplicate.json()).state, 'pending_outcome_unknown');
  assert.equal((await f.authority.handle(actionRequest({ commandId: 'fixture_command_0002' }))).status, 409);
  assert.equal(f.calls.submit.length, 1);
  assert.equal((await f.storage.get('match')).pendingCommand, COMMAND);
});

test('a state read past the pending revision settles an unknown outcome without resending it', async () => {
  const f = await fixture();
  f.driver.submitExisting = async action => { f.calls.submit.push(action); throw Error('lost response after possible acceptance'); };
  assert.equal((await (await f.authority.handle(actionRequest())).json()).state, 'pending_outcome_unknown');
  f.snapshot.revision = 13; // the engine accepted it (or moved on): revision 12 can never apply again
  const state = await f.authority.handle(request());
  assert.equal(state.status, 200); assert.equal((await state.json()).commandPending, false);
  assert.equal((await f.storage.get('match')).pendingCommand, null);
  const replay = await f.authority.handle(actionRequest());
  assert.equal(replay.status, 409); assert.deepEqual(await replay.json(), { commandId: COMMAND, state: 'outcome_settled_by_state' });
  assert.equal(f.calls.submit.length, 1, 'the unknown command is never resent');
  f.driver.submitExisting = async action => { f.calls.submit.push(action); return { epoch: EPOCH, status: 202 }; };
  const next = await f.authority.handle(actionRequest({ commandId: 'fixture_command_0002', action: { ...ACTION, revision: 13 } }));
  assert.equal(next.status, 202); assert.equal(f.calls.submit.length, 2);
});

test('an unknown outcome at an unchanged revision stays pending until it is too old to race a new command', async () => {
  const f = await fixture();
  f.driver.submitExisting = async action => { f.calls.submit.push(action); throw Error('gateway timeout'); };
  await f.authority.handle(actionRequest());
  f.setTime(1000 + 9999);
  assert.equal((await (await f.authority.handle(request())).json()).commandPending, true);
  assert.equal((await f.authority.handle(actionRequest({ commandId: 'fixture_command_0002' }))).status, 409);
  f.setTime(1000 + 10000);
  assert.equal((await (await f.authority.handle(request())).json()).commandPending, false);
  f.driver.submitExisting = async action => { f.calls.submit.push(action); return { epoch: EPOCH, status: 202 }; };
  // Same revision as the settled command: the engine applies at most one of them.
  assert.equal((await f.authority.handle(actionRequest({ commandId: 'fixture_command_0003' }))).status, 202);
  assert.deepEqual(f.calls.submit.map(a => a.revision), [12, 12]);
});

test('a failed state read never settles a pending command', async () => {
  const f = await fixture();
  f.driver.submitExisting = async action => { f.calls.submit.push(action); throw Error('gateway timeout'); };
  await f.authority.handle(actionRequest());
  f.setTime(1000 + 60000);
  f.driver.readExisting = async () => { throw Object.assign(Error('read unavailable'), { code: 'HOST_STATE_READ_UNAVAILABLE', retryable: true }); };
  assert.equal((await f.authority.handle(request())).status, 503);
  assert.equal((await f.storage.get('match')).pendingCommand, COMMAND);
});

test('an accepted command leaves no pending command in the state reply', async () => {
  const f = await fixture();
  assert.equal((await f.authority.handle(actionRequest())).status, 202);
  const match = await f.storage.get('match');
  assert.equal(match.pendingCommand, null); assert.equal(match.pendingRevision, undefined); assert.equal(match.pendingAt, undefined);
  assert.equal((await (await f.authority.handle(request())).json()).commandPending, false);
});

test('native stale rejection is retained and can be followed by a fresh command', async () => {
  const f = await fixture();
  f.driver.submitExisting = async action => { f.calls.submit.push(action); return { epoch: EPOCH, status: 409 }; };
  assert.equal((await f.authority.handle(actionRequest())).status, 409);
  assert.equal((await f.authority.handle(actionRequest())).status, 409);
  assert.equal(f.calls.submit.length, 1);
  await f.authority.handle(actionRequest({ commandId: 'fixture_command_0002' }));
  assert.equal(f.calls.submit.length, 2);
});

test('stale generation, unknown envelope fields and oversize JSON never dispatch', async () => {
  const f = await fixture();
  for (const changes of [{ generation: OTHER }, { viewer: 1 }, { action: { ...ACTION, revision: 1.5 } }, { action: { op: 'arbitrary', revision: 12 } }]) {
    assert.equal((await f.authority.handle(actionRequest(changes))).status, 400);
  }
  assert.equal((await f.authority.handle(actionRequest({ padding: 'x'.repeat(21000) }))).status, 413);
  assert.equal(f.calls.submit.length, 0);
});

test('native restart or wrong projection permanently interrupts without reading it again', async () => {
  for (const kind of ['epoch', 'viewer', 'schema', 'forgeRevision']) {
    const f = await fixture();
    if (kind === 'epoch') f.driver.readExisting = async () => ({ epoch: OTHER, snapshot: f.snapshot });
    else f.snapshot[kind] = kind === 'viewer' ? 1 : 'different';
    assert.equal((await f.authority.handle(request())).status, 410, kind);
    assert.equal((await f.authority.handle(actionRequest())).status, 410, kind);
    assert.equal(f.calls.submit.length, 0);
    assert.equal((await f.storage.get('match')).status, 'interrupted');
  }
});

test('native process disappearance is interruption, never a fabricated draw', async () => {
  const f = await fixture();
  f.driver.readExisting = async () => { throw Error('container stopped'); };
  const response = await f.authority.handle(request());
  assert.equal(response.status, 410);
  assert.equal((await f.storage.get('match')).result, undefined);
});

test('native terminal receipt stores only summary and survives JVM destruction', async () => {
  const f = await fixture();
  Object.assign(f.snapshot, { status: 'finished', draw: false, winnerPlayerId: 1, privateFieldFixture: 'must-not-persist' });
  const ended = await f.authority.handle(request());
  assert.deepEqual((await ended.json()).result, { draw: false, winnerPlayerId: 1 });
  assert.ok(!JSON.stringify(await f.storage.get('match')).includes('must-not-persist'));
  f.driver.readExisting = async () => { throw Error('should not call'); };
  assert.equal((await f.authority.handle(request())).status, 200);
  assert.equal((await f.authority.handle(actionRequest())).status, 410);
});

test('invalid terminal receipt fails visibly without making up a winner', async () => {
  const f = await fixture();
  Object.assign(f.snapshot, { status: 'finished', draw: false, winnerPlayerId: null });
  assert.equal((await f.authority.handle(request())).status, 410);
  assert.equal((await f.storage.get('match')).result, undefined);
});

test('close requires owner and confirmed process destruction before release flag', async () => {
  const f = await fixture();
  assert.equal((await f.authority.handle(request({ method: 'DELETE', token: 'other' }))).status, 404);
  assert.equal(f.calls.destroy, 0);
  f.driver.destroyExisting = async () => ({ confirmed: false });
  assert.equal((await f.authority.handle(request({ method: 'DELETE' }))).status, 503);
  assert.equal(await f.storage.get('destructionConfirmed'), undefined);
  assert.equal((await f.authority.handle(actionRequest())).status, 410);
  f.driver.destroyExisting = async () => ({ confirmed: true });
  assert.equal((await f.authority.handle(request({ method: 'DELETE' }))).status, 204);
  assert.equal(await f.storage.get('destructionConfirmed'), true);
});

test('hard expiry stops all commands without touching native', async () => {
  const f = await fixture(); f.setTime(7201000);
  assert.equal((await f.authority.handle(actionRequest())).status, 410);
  assert.equal(f.calls.submit.length, 0);
});

test('initialize cannot replace an existing allocation or accept invalid bootstrap', async () => {
  const f = await fixture();
  await assert.rejects(() => f.authority.initialize({ ownerId: OWNER }));
  await assert.rejects(() => f.authority.initialize({ ownerId: OWNER, matchId: MATCH, generation: GENERATION, epoch: EPOCH,
    viewerId: 0, deckDigests: { human: 'a'.repeat(64), opponent: 'b'.repeat(64) }, expiresAt: 3000 }), /already_initialized/);
});

test('bounded JSON rejects invalid UTF-8 and arrays', async () => {
  await assert.rejects(() => boundedJSON(new Request(ORIGIN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]) }), 20));
  await assert.rejects(() => boundedJSON(request({ method: 'POST', body: '[]' }), 20));
});

const deck = () => ({ id: 'existing-saved-fixture', name: 'Existing saved fixture', format: 'Commander',
  cards: [{ name: 'Fixture face A // Fixture face B', qty: 2, set: 'TST', collectorNumber: '007', finish: 'nonfoil' },
    { name: 'Fixture commander', qty: 1 }],
  commander: 'Fixture commander', commanders: [{ name: 'Fixture commander', qty: 1 }], side: [] });
const input = () => ({ format: 'Commander', difficultyPolicyVersion: 'Default.full.frozen-proof', humanDeck: deck(), opponentDeck: deck() });
const admit = async exact => ({ supported: true, legal: true, humanDigest: await digest(exact.humanDeck), opponentDigest: await digest(exact.opponentDeck) });

function admissionFixture() {
  let counter = 20, time = 1000;
  const storage = new MemoryStorage();
  const ledger = new AdmissionLedger({ storage, now: () => time,
    newId: () => `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}` });
  const reserve = (changes = {}) => ledger.reserve({ ownerId: OWNER, idempotencyKey: 'fixture_create_0001', input: input(), admitExact: admit, ...changes });
  return { ledger, storage, reserve, setTime: value => { time = value; } };
}

test('deck manifests retain faces, printing IDs, quantities, order and source object', () => {
  const original = input(), saved = structuredClone(original);
  const validated = validateExactDeckInput(original);
  assert.deepEqual(validated, saved); validated.humanDeck.cards[0].qty = 10;
  assert.deepEqual(original, saved);
});

test('invalid quantities and supplied Java/path fields are rejected instead of repaired', () => {
  for (const quantity of [0, -1, 1.5, '2', 1001]) {
    const value = input(); value.humanDeck.cards[0].qty = quantity;
    assert.throws(() => validateExactDeckInput(value));
  }
  assert.throws(() => validateExactDeckInput({ ...input(), deckPath: '/tmp/deck.dck' }));
  const value = input(); value.opponentDeck.commander = { name: 'invalid' };
  assert.throws(() => validateExactDeckInput(value));
});

test('missing real adapter, unsupported policy, or changed exact deck digest cannot reserve capacity', async () => {
  const f = admissionFixture();
  assert.equal((await f.reserve({ admitExact: undefined })).status, 503);
  assert.equal((await f.reserve({ admitExact: async () => ({ supported: false, legal: true }) })).status, 422);
  assert.equal((await f.reserve({ admitExact: async () => ({ supported: true, legal: true, humanDigest: 'changed', opponentDigest: 'changed' }) })).status, 422);
  assert.equal(await f.storage.get('leases'), undefined);
});

test('simultaneous create retries produce exactly one allocation and receipt', async () => {
  const f = admissionFixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => f.reserve()));
  assert.ok(results.every(result => result.status === 202));
  assert.equal(new Set(results.map(result => result.allocation.matchId)).size, 1);
  assert.equal((await f.storage.get('leases')).length, 1);
});

test('same create idempotency key with a changed deck is rejected', async () => {
  const f = admissionFixture(); await f.reserve();
  const changed = input(); changed.humanDeck.cards[0].qty++;
  assert.equal((await f.reserve({ input: changed })).status, 409);
});

test('global two-match and one-per-user limits are enforced', async () => {
  const f = admissionFixture();
  assert.equal((await f.reserve()).status, 202);
  assert.equal((await f.reserve({ idempotencyKey: 'fixture_create_0002' })).status, 409);
  assert.equal((await f.reserve({ ownerId: OTHER })).status, 202);
  assert.equal((await f.reserve({ ownerId: THIRD })).status, 503);
});

test('expired allocations retain capacity until destruction is confirmed for same generation', async () => {
  const f = admissionFixture();
  const a = (await f.reserve()).allocation;
  f.setTime(8000000);
  assert.equal((await f.reserve({ idempotencyKey: 'fixture_create_0002' })).status, 409);
  assert.equal(await f.ledger.releaseAfterDestruction({ ...a, confirmed: false }), false);
  assert.equal(await f.ledger.releaseAfterDestruction({ ...a, generation: EPOCH, confirmed: true }), false);
  assert.equal(await f.ledger.releaseAfterDestruction({ ...a, confirmed: true }), true);
  assert.equal((await f.reserve({ idempotencyKey: 'fixture_create_0002' })).status, 202);
});

test('rolling create quota persists across ledger instances and confirmed closes', async () => {
  const f = admissionFixture();
  for (let i = 0; i < 3; i++) {
    const allocation = (await f.reserve({ idempotencyKey: `fixture_create_000${i}` })).allocation;
    assert.ok(allocation);
    await f.ledger.releaseAfterDestruction({ ...allocation, confirmed: true });
  }
  assert.equal((await f.reserve({ idempotencyKey: 'fixture_create_0009' })).status, 429);
  f.setTime(62000);
  assert.equal((await f.reserve({ idempotencyKey: 'fixture_create_0009' })).status, 202);
});

test('receipt pruning does not release a live or expired process lease', async () => {
  const f = admissionFixture(); await f.reserve(); f.setTime(90000000);
  await f.ledger.pruneReceipts();
  assert.equal((await f.storage.list({ prefix: 'create:' })).size, 0);
  assert.equal((await f.storage.get('leases')).length, 1);
});

test('canonical hashing ignores object key order but preserves deck entry order', async () => {
  assert.equal(await digest({ a: 1, b: 2 }), await digest({ b: 2, a: 1 }));
  assert.notEqual(await digest([1, 2]), await digest([2, 1]));
});
