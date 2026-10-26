import test from 'node:test';
import assert from 'node:assert/strict';
import { AdmissionService, MatchService, routeHostRequest, ORIGIN } from '../src/service-core.mjs';
import { digest, FORGE_REVISION, NATIVE_SCHEMA } from '../src/policy.mjs';
import { nativeAdapter } from '../src/native-adapter.mjs';
import { accountVerifier } from '../src/auth.mjs';
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const third = '00000000-0000-4000-8000-000000000003';
const epoch = '00000000-0000-4000-8000-000000000004';
const verifyBearer = async a => ({ 'Bearer owner': owner, 'Bearer other': other, 'Bearer third': third }[a] ? { id: { 'Bearer owner': owner, 'Bearer other': other, 'Bearer third': third }[a], is_anonymous: false } : null);
// TRANSPORT fixture, NOT a real legality/engine certification or card simulation.
const deck = { format: 'Commander', cards: [{ name: 'Fixture commander', qty: 1, set: 'TST', cn: '001', finish: 'foil' }, { name: 'Fixture land', qty: 99 }], commander: 'Fixture commander', commanders: [{ name: 'Fixture commander', qty: 1 }], side: [], importedText: 'private original text' };
const input = () => ({ format: 'Commander', difficultyPolicyVersion: 'forge-default-v1', humanDeck: structuredClone(deck), opponentDeck: structuredClone(deck) });
class Storage {
  constructor() { this.data = new Map(); this.tail = Promise.resolve(); this.alarmAt = null; }
  async get(k) { return structuredClone(this.data.get(k)); }
  async put(k, v) { this.data.set(k, structuredClone(v)); }
  async delete(k) { return this.data.delete(k); }
  async list({ prefix }) { return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
  async setAlarm(t) { this.alarmAt = t; }
  async getAlarm() { return this.alarmAt; }
  transaction(fn) {
    const run = this.tail.then(async () => { const staged = new Storage(); staged.data = structuredClone(this.data); staged.alarmAt = this.alarmAt; const result = await fn(staged); this.data = staged.data; this.alarmAt = staged.alarmAt; return result; });
    this.tail = run.catch(() => {}); return run;
  }
}
function request(path = '/api/play/matches', { method = 'POST', token = 'owner', body = input(), headers = {}, origin = ORIGIN } = {}) {
  return new Request(ORIGIN + path, { method, headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(origin && { Origin: origin }), ...(body !== undefined && { 'Content-Type': 'application/json' }), 'Idempotency-Key': 'fixture_idempotency_0001', ...headers }, ...(body !== undefined && !['GET', 'DELETE'].includes(method) ? { body: JSON.stringify(body) } : {}) });
}
function fixture() {
  let time = 1000;
  const calls = { start: 0, port: 0, destroy: 0, actions: [], admitted: [], verified: [] };
  const matches = new Map(), stores = new Map(), containers = new Map();
  const native = { ready: true, async admitExact(value) { calls.admitted.push(structuredClone(value)); return { supported: true, legal: true, humanDigest: await digest(value.humanDeck), opponentDigest: await digest(value.opponentDeck) }; },
    async startOptions({ input: value, allocation, internalToken }) { calls.verified.push(value); return { enableInternet: false, env: { HOST_INTERNAL_TOKEN: internalToken, HOST_ABSOLUTE_DEADLINE_MS: String(allocation.expiresAt) } }; },
    async confirmInitialization({ input: value, allocation }) { assert.equal(await digest(value), allocation.requestDigest); return { viewerId: 0, schema: NATIVE_SCHEMA, engineRevision: FORGE_REVISION, policyVersion: value.difficultyPolicyVersion, humanDigest: allocation.deckDigests.human, opponentDigest: allocation.deckDigests.opponent }; },
  };
  const env = { FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: [owner, other, third].join(','), FORGE_TRIAL_EXPIRES_AT: new Date(86401000).toISOString(), FORGE_MATCHES: { getByName(id) {
    if (!matches.has(id)) {
      const storage = new Storage(); stores.set(id, storage);
      const container = { running: false, epoch, failStop: false, failRead: false,
        start(options) { calls.start++; this.running = true; assert.equal(options.enableInternet, false); },
        async setInactivityTimeout(ms) { assert.equal(ms, 600000); },
        async destroy() { calls.destroy++; assert.notEqual((await storage.get('allocation')).status, 'running'); if (this.failStop) throw Error('stop failed'); this.running = false; },
        getTcpPort(port) { calls.port++; assert.equal(port, 8080); return { fetch: async r => {
          assert(this.running, 'must never fetch stopped container'); assert(r.headers.get('Authorization').startsWith('Bearer fixture-internal'));
          assert(!r.headers.get('Authorization').includes('owner'));
          if (this.failRead) throw Error('unresponsive');
          const headers = { 'Content-Type': 'application/json', 'X-Host-Epoch': this.epoch };
          if (new URL(r.url).pathname === '/action') { calls.actions.push(await r.json()); return new Response('{}', { status: this.actionStatus || 202, headers }); }
          return new Response(JSON.stringify({ schema: NATIVE_SCHEMA, forgeRevision: FORGE_REVISION, viewer: 0, status: 'running', revision: 1, fixture: true, ...this.snapshot }), { headers });
        } }; },
      }; containers.set(id, container);
      matches.set(id, new MatchService({ ctx: { storage, container }, env, verifyBearer, native, now: () => time, wait: async ms => { time += ms; }, newToken: () => 'fixture-internal-capability-12345678901234567890' }));
    } return matches.get(id);
  } } };
  const storage = new Storage();
  const admission = new AdmissionService({ ctx: { storage }, env, verifyBearer, native, now: () => time });
  env.FORGE_ADMISSION = { getByName: () => admission };
  return { calls, native, env, admission, storage, matches, stores, containers, setTime: t => { time = t; }, route: r => routeHostRequest(r, env, verifyBearer), async create(options) { const response = await this.route(request(undefined, options)); return { response, body: await response.json() }; } };
}
test('default native adapter fails closed before reservation and any provider call', async () => {
  const f = fixture(); f.admission.native = { ready: false };
  const { response, body } = await f.create(); assert.equal(response.status, 503); assert.equal(body.error, 'exact_native_adapter_unavailable');
  assert.equal(f.calls.start, 0); assert.equal(await f.storage.get('leases'), undefined);
});
test('actual existing Supabase verifier uses configured user endpoint; no local JWT proof', async () => {
  let seen;
  const verify = accountVerifier({}, async (url, options) => { seen = { url, options }; return Response.json({ id: owner, is_anonymous: false }); });
  assert.equal((await verify('Bearer fixture'))?.id, owner); assert(seen.url.endsWith('/auth/v1/user')); assert.equal(seen.options.redirect, 'manual'); assert(seen.options.headers.apikey.startsWith('sb_publishable_'));
  assert.equal(await verify('invalid'), null);
});
test('all public routes require account and exact origin before a DO is reached', async () => {
  const f = fixture();
  for (const options of [{ token: null }, { token: 'bad' }, { origin: 'https://evil.invalid' }, { origin: null }, { headers: { 'Sec-Fetch-Site': 'cross-site' } }]) assert.equal((await f.create(options)).response.status, 401);
  assert.equal(f.matches.size, 0); assert.equal(f.calls.start, 0);
});
test('only exact HTTP inventory is forwarded; no bootstrap/RPC/viewer endpoint', async () => {
  const f = fixture();
  for (const path of ['/begin', '/release', '/api/play/matches/invalid', '/api/play/matches/00000000-0000-4000-8000-000000000001/initialize']) assert.equal((await f.route(request(path))).status, 404);
  assert.equal((await f.route(request('/api/play/matches?viewer=1'))).status, 401);
});
test('creation preserves existing snapshot metadata/commander count and replay never starts twice', async () => {
  const f = fixture(); const first = await f.create(); assert.equal(first.response.status, 202); assert.equal(f.calls.start, 1);
  assert.equal(f.calls.admitted.length, 0); assert.deepEqual(f.calls.verified[0], input());
  assert(!JSON.stringify(first.body).includes('private original text'));
  const replay = await f.create(); assert.equal(replay.body.matchId, first.body.matchId); assert.equal(replay.body.replay, true); assert.equal(f.calls.start, 1);
  const changed = input(); changed.humanDeck.cards[0].qty = 2; assert.equal((await f.create({ body: changed })).response.status, 409);
});
test('one allocation per user, two globally; no provider startup after rejection', async () => {
  const f = fixture(); await f.create();
  assert.equal((await f.create({ headers: { 'Idempotency-Key': 'different_fixture_key' } })).response.status, 409);
  assert.equal((await f.create({ token: 'other' })).response.status, 202);
  assert.equal((await f.create({ token: 'third' })).response.status, 503); assert.equal(f.calls.start, 2);
});
test('unknown/other-owner state returns same 404 with no container access', async () => {
  const f = fixture(); const { body } = await f.create(); const before = f.calls.port;
  assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'GET', token: 'other' }))).status, 404);
  assert.equal((await f.route(request('/api/play/matches/00000000-0000-4000-8000-000000000009', { method: 'GET' }))).status, 404);
  assert.equal(f.calls.port, before); assert.equal(f.calls.start, 1);
});
test('state and action go only to existing runtime; action receipt prevents resend', async () => {
  const f = fixture(); const { body } = await f.create(); const path = '/api/play/matches/' + body.matchId;
  assert.equal((await f.route(request(path, { method: 'GET' }))).status, 200);
  const action = { commandId: 'fixture_command_0001', generation: body.generation, action: { revision: 1, op: 'ok' } };
  for (let i = 0; i < 2; i++) assert.equal((await f.route(request(path + '/actions', { body: action }))).status, 202);
  assert.equal(f.calls.actions.length, 1); assert.equal(f.calls.start, 1);
});
test('close writes tombstone, confirms destruction, and global release checks trusted proof', async () => {
  const f = fixture(); const { body } = await f.create(); const path = '/api/play/matches/' + body.matchId;
  assert.equal(await f.admission.release(body.matchId, body.generation), false);
  assert.equal((await f.route(request(path, { method: 'DELETE' }))).status, 204);
  const portBefore = f.calls.port; assert.equal((await f.route(request(path, { method: 'GET' }))).status, 410); assert.equal(f.calls.port, portBefore);
  assert.equal(await f.admission.release(body.matchId, epoch), false);
  assert.equal((await f.storage.get('leases')).length, 0); // already released before204
  assert.equal(await f.admission.release(body.matchId, body.generation), false);
  assert.equal(f.calls.start, 1);
});
test('unresponsive gateway does not prevent trusted instance destroy', async () => {
  const f = fixture(); const { body } = await f.create(); f.containers.get(body.matchId).failRead = true;
  assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'DELETE' }))).status, 204);
  assert.equal((await f.matches.get(body.matchId).destructionProof(body.generation)).confirmed, true);
});
test('failed destruction keeps global capacity; alarm safely retries destruction only', async () => {
  const f = fixture(); const { body } = await f.create(); const c = f.containers.get(body.matchId); c.failStop = true;
  assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'DELETE' }))).status, 503);
  assert.equal(await f.admission.release(body.matchId, body.generation), false); assert.equal((await f.storage.get('leases')).length, 1);
  c.failStop = false; await f.admission.alarm(); assert.equal((await f.storage.get('leases')).length, 0); assert.equal(f.calls.start, 1);
});
test('stopped/runtime-replaced allocation interrupts, never auto-starts', async () => {
  for (const replacement of [false, true]) {
    const f = fixture(); const { body } = await f.create(); const c = f.containers.get(body.matchId);
    if (replacement) c.epoch = '00000000-0000-4000-8000-000000000099'; else c.running = false;
    assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'GET' }))).status, 410); assert.equal(f.calls.start, 1);
  }
});
test('incoming create attempts and owner polls are rate limited', async () => {
  const f = fixture(); const { body } = await f.create(); await f.create(); await f.create(); assert.equal((await f.create()).response.status, 429);
  for (let i = 0; i < 4; i++) assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'GET' }))).status, 200);
  assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'GET' }))).status, 429);
});
test('absolute/idle alarm destroys allocation and does not renew on unauthorized reads', async () => {
  const f = fixture(); const { body } = await f.create(); f.setTime(601001); await f.matches.get(body.matchId).alarm();
  assert.equal(f.containers.get(body.matchId).running, false); assert.equal(f.calls.start, 1);
});
test('reserve-before-start RPC loss is reconciled to tombstone; delayed begin cannot start', async () => {
  const f = fixture(); const get = f.env.FORGE_MATCHES.getByName; f.env.FORGE_MATCHES.getByName = id => ({ begin: async () => { throw Error('lost before dispatch'); } });
  const { body } = await f.create(); assert.equal(f.calls.start, 0); const lease = (await f.storage.get('leases'))[0];
  f.env.FORGE_MATCHES.getByName = get; f.setTime(122000); await f.admission.alarm(); assert.equal((await f.storage.get('leases')).length, 0);
  await assert.rejects(f.matches.get(body.matchId).begin(lease, input())); assert.equal(f.calls.start, 0);
});
test('ambiguous action remains pending and never dispatches a second command', async () => {
  const f = fixture(); const { body } = await f.create(); const c = f.containers.get(body.matchId); c.failRead = true;
  const action = { commandId: 'fixture_command_0001', generation: body.generation, action: { revision: 1, op: 'ok' } };
  const path = '/api/play/matches/' + body.matchId + '/actions';
  const r = await f.route(request(path, { body: action })); assert.equal((await r.json()).state, 'pending_outcome_unknown');
  c.failRead = false; assert.equal((await f.route(request(path, { body: action }))).status, 202); assert.equal(f.calls.actions.length, 0);
});
test('closed tombstone cannot be restarted with the released original lease', async () => {
  const f = fixture(); const { body } = await f.create(); const lease = (await f.storage.get('leases'))[0];
  await f.route(request('/api/play/matches/' + body.matchId, { method: 'DELETE' }));
  await assert.rejects(f.matches.get(body.matchId).begin(lease, input()), /unreserved_allocation/); assert.equal(f.calls.start, 1);
});
test('trial disabled, missing allowlist, unknown owner and expired trial cannot reserve', async () => {
  for (const env of [{ FORGE_TRIAL_ENABLED: 'false' }, { FORGE_TRIAL_OWNER_IDS: '' }, { FORGE_TRIAL_OWNER_IDS: other }, { FORGE_TRIAL_EXPIRES_AT: new Date(999).toISOString() }]) {
    const f = fixture(); Object.assign(f.env, env); assert([403, 503].includes((await f.create()).response.status)); assert.equal(f.calls.start, 0); assert.equal(await f.storage.get('leases'), undefined);
  }
});
test('trial atomic cumulative charges survive close and replay without refunds or reset', async () => {
  const f = fixture(); f.env.FORGE_TRIAL_RUNTIME_BUDGET_MS = '3628000';
  for (let i = 0; i < 4; i++) {
    f.setTime(1000 + i * 61000); const { body, response } = await f.create({ headers: { 'Idempotency-Key': 'fixture_budget_key_' + i } }); assert.equal(response.status, 202);
    const before = await f.storage.get('trial-budget');
    await f.create({ headers: { 'Idempotency-Key': 'fixture_budget_key_' + i } }); assert.deepEqual(await f.storage.get('trial-budget'), before);
    await f.route(request('/api/play/matches/' + body.matchId, { method: 'DELETE' })); await f.admission.release(body.matchId, body.generation);
  }
  f.setTime(245000); const last = await f.create({ headers: { 'Idempotency-Key': 'fixture_budget_key_4' } }); assert.equal(last.response.status, 429); assert.equal(last.body.error, 'trial_resource_budget_exhausted');
  assert.deepEqual(await f.storage.get('trial-budget'), { expiresAt: 86401000, reservations: 4, reservedRuntimeMs: 3628000 });
  assert.equal(f.calls.start, 4);
});
test('changing trial expiry does not reset consumed reservation counters', async () => {
  const f = fixture(); const { body } = await f.create(); await f.route(request('/api/play/matches/' + body.matchId, { method: 'DELETE' })); await f.admission.release(body.matchId, body.generation);
  f.env.FORGE_TRIAL_EXPIRES_AT = new Date(86401001).toISOString(); const result = await f.create({ headers: { 'Idempotency-Key': 'fixture_changed_trial' } });
  assert.equal(result.response.status, 503); assert.equal(result.body.error, 'trial_configuration_changed'); assert.equal(f.calls.start, 1);
});
test('invalid native initialization is never playable, budget remains charged, cleanup releases capacity', async () => {
  const f = fixture(); f.native.confirmInitialization = async () => { throw Error('invalid_native_deck'); };
  const { body } = await f.create(); assert.equal(f.calls.start, 1); assert.equal((await f.storage.get('trial-budget')).reservations, 1);
  assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'GET' }))).status, 410);
  await f.admission.alarm(); assert.equal((await f.storage.get('leases')).length, 0); assert.equal((await f.storage.get('trial-budget')).reservations, 1);
});
test('Modern snapshot travels unchanged to native validation, never relabeled to Commander', async () => {
  const f = fixture(); const value = input(); value.format = value.humanDeck.format = value.opponentDeck.format = 'Modern';
  assert.equal((await f.create({ body: value })).response.status, 202); assert.deepEqual(f.calls.verified[0], value);
});
test('native-confirmed terminal summary survives idle/game expiry and ends after retention', async () => {
  const f = fixture(); const { body } = await f.create(); const storage = f.stores.get(body.matchId);
  const match = await storage.get('match'); match.status = 'finished'; match.result = { draw: false, winnerPlayerId: 0 }; await storage.put('match', match);
  const service = f.matches.get(body.matchId); await service.serial(() => service.cleanup(storage.data.get('allocation'), 'finished'));
  f.setTime(9000000); const result = await f.route(request('/api/play/matches/' + body.matchId, { method: 'GET' })); assert.equal(result.status, 200); assert.equal((await result.json()).status, 'finished');
  f.setTime(86402000); await service.alarm(); assert.equal((await f.route(request('/api/play/matches/' + body.matchId, { method: 'GET' }))).status, 404);
});
test('stalled authenticated action upload cannot hold the match queue ahead of close', async () => {
  const f = fixture(); const { body } = await f.create(); const path = '/api/play/matches/' + body.matchId;
  const stream = new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { return new Promise(() => {}); } });
  const upload = f.route(new Request(ORIGIN + path + '/actions', { method: 'POST', body: stream, duplex: 'half', headers: { Origin: ORIGIN, Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }));
  await new Promise(resolve => setTimeout(resolve, 10));
  const closed = await Promise.race([f.route(request(path, { method: 'DELETE' })), new Promise((_, reject) => setTimeout(() => reject(Error('close blocked by upload')), 500))]);
  assert.equal(closed.status, 204); assert.equal((await upload).status, 408); assert.equal(f.calls.actions.length, 0);
});
test('evicted/reconstructed match object reads tombstone and never starts old allocation', async () => {
  const f = fixture(); const { body } = await f.create(); const lease = (await f.storage.get('leases'))[0];
  await f.route(request('/api/play/matches/' + body.matchId, { method: 'DELETE' }));
  const restored = new MatchService({ ctx: { storage: f.stores.get(body.matchId), container: f.containers.get(body.matchId) }, env: f.env, verifyBearer, native: f.native, now: () => 2000 });
  await assert.rejects(restored.begin(lease, input()), /unreserved_allocation/); assert.equal((await restored.fetch(request('/api/play/matches/' + body.matchId, { method: 'GET' }))).status, 410); assert.equal(f.calls.start, 1);
});
test('reviewed controlMode sends only real smart/full native action with dedup and generation fence', async () => {
  const f = fixture(); const { body } = await f.create(); const path = '/api/play/matches/' + body.matchId + '/actions';
  for (const mode of ['smart', 'full']) {
    const command = { commandId: 'fixture_mode_' + mode + '_0001', generation: body.generation, action: { revision: 1, op: 'controlMode', value: mode } };
    assert.equal((await f.route(request(path, { body: command }))).status, 202);
    assert.equal((await f.route(request(path, { body: command }))).status, 202);
  }
  assert.deepEqual(f.calls.actions, [{ revision: 1, op: 'controlMode', value: 'smart' }, { revision: 1, op: 'controlMode', value: 'full' }]);
  for (const action of [{ revision: 1, op: 'arbitrary' }, { revision: 1, op: 'controlMode', value: 'easy' }, { revision: 1, op: 'controlMode', value: true }, { revision: 1, op: 'controlMode', value: 'smart', execute: 'bad' }]) {
    assert.equal((await f.route(request(path, { body: { commandId: 'fixture_bad_mode_0001', generation: body.generation, action } }))).status, 400);
  }
  assert.equal((await f.route(request(path, { body: { commandId: 'fixture_old_mode_0001', generation: epoch, action: { revision: 1, op: 'controlMode', value: 'full' } } }))).status, 400);
  assert.equal(f.calls.actions.length, 2);
});
test('native stale/busy409 controlMode remains rejection receipt, not accepted or blindly retried', async () => {
  const f = fixture(); const { body } = await f.create(); const path = '/api/play/matches/' + body.matchId + '/actions'; f.containers.get(body.matchId).actionStatus = 409;
  const command = { commandId: 'fixture_mode_busy_0001', generation: body.generation, action: { revision: 0, op: 'controlMode', value: 'full' } };
  for (let i = 0; i < 2; i++) { const result = await f.route(request(path, { body: command })); assert.equal(result.status, 409); assert.equal((await result.json()).state, 'rejected'); }
  assert.equal(f.calls.actions.length, 1);
});
test('retryable native state failure preserves same live allocation and forwards Retry-After', async () => {
  const f = fixture(); const { body } = await f.create(); const c = f.containers.get(body.matchId); c.failRead = true;
  const path = '/api/play/matches/' + body.matchId;
  const transient = await f.route(request(path, { method: 'GET' })); assert.equal(transient.status, 503); assert.equal(transient.headers.get('Retry-After'), '1');
  assert.equal(c.running, true); assert.equal(f.calls.destroy, 0); assert.equal((await f.stores.get(body.matchId).get('allocation')).status, 'running');
  assert.equal((await f.storage.get('leases')).length, 1);
  c.failRead = false; assert.equal((await f.route(request(path, { method: 'GET' }))).status, 200); assert.equal(f.calls.start, 1);
});
test('provider create returns202 after durable provisional admission while startup remains pending', async () => {
  const f = fixture(); const work = [];
  f.admission.ctx.waitUntil = promise => work.push(promise);
  let release; const pending = new Promise(resolve => { release = resolve; });
  const original = f.env.FORGE_MATCHES.getByName;
  f.env.FORGE_MATCHES.getByName = id => ({ begin: () => pending });
  const result = await Promise.race([f.create(), new Promise((_, reject) => setTimeout(() => reject(Error('202 waited on JVM')), 300))]);
  assert.equal(result.response.status, 202); assert.equal(result.body.status, 'initializing'); assert.equal(work.length, 1);
  assert.equal((await f.storage.get('leases')).length, 1); assert.equal((await f.storage.get('trial-budget')).reservations, 1);
  release(); await Promise.all(work); f.env.FORGE_MATCHES.getByName = original;
});

// Rematch integration uses real admission, authority and trusted release RPC;
// only account/provider/native projection are explicit transport fixtures.
test('successful close releases outside the match queue before explicit Rematch', async () => {
  const f = fixture(); const first = await f.create(); const id = first.body.matchId;
  const service = f.matches.get(id); const release = f.admission.release.bind(f.admission); let proofs = 0;
  f.admission.release = async (matchId, generation) => {
    const proof = await service.destructionProof(generation); proofs++;
    assert.equal(proof.confirmed, true); return release(matchId, generation);
  };
  const response = await Promise.race([f.route(request('/api/play/matches/' + id, { method: 'DELETE' })),
    new Promise((_, reject) => setTimeout(() => reject(Error('release callback deadlocked on match queue')), 500))]);
  assert.equal(response.status, 204); assert.equal(proofs, 1); assert.equal((await f.storage.get('leases')).length, 0);
  assert.equal(f.calls.start, 1); // cleanup must not create the next game
  const next = await f.create({ headers: { 'Idempotency-Key': 'explicit_rematch_closed_0001' } });
  assert.equal(next.response.status, 202); assert.notEqual(next.body.matchId, id); assert.equal(f.calls.start, 2);
  assert.equal((await f.storage.get('trial-budget')).reservations, 2); // no cleanup refund
});
test('rules-provided finished result confirms cleanup and allows immediate explicit Rematch', async () => {
  const f = fixture(); const first = await f.create(); const id = first.body.matchId;
  f.containers.get(id).snapshot = { status: 'finished', draw: false, winnerPlayerId: 0 };
  const response = await f.route(request('/api/play/matches/' + id, { method: 'GET' }));
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).result, { draw: false, winnerPlayerId: 0 });
  assert.equal(f.containers.get(id).running, false); assert.equal((await f.storage.get('leases')).length, 0);
  const next = await f.create({ headers: { 'Idempotency-Key': 'explicit_rematch_finished_0001' } });
  assert.equal(next.response.status, 202); assert.notEqual(next.body.matchId, id); assert.equal(f.calls.start, 2);
});
test('persisted terminal result after eviction repairs skipped cleanup before release', async () => {
  const f = fixture(); const first = await f.create(); const id = first.body.matchId; const storage = f.stores.get(id);
  const match = await storage.get('match'); match.status = 'finished'; match.result = { draw: true, winnerPlayerId: null }; await storage.put('match', match);
  assert.equal(f.containers.get(id).running, true);
  const response = await f.route(request('/api/play/matches/' + id, { method: 'GET' }));
  assert.equal(response.status, 200); assert.equal((await response.json()).result.draw, true);
  assert.equal(f.calls.destroy, 1); assert.equal(f.containers.get(id).running, false); assert.equal((await f.storage.get('leases')).length, 0);
});
test('unconfirmed cleanup blocks Rematch for close and finished result until alarm succeeds', async () => {
  for (const ended of [false, true]) {
    const f = fixture(); const first = await f.create(); const id = first.body.matchId; const container = f.containers.get(id);
    container.failStop = true;
    if (ended) container.snapshot = { status: 'finished', draw: true, winnerPlayerId: null };
    const response = await f.route(request('/api/play/matches/' + id, { method: ended ? 'GET' : 'DELETE' }));
    assert.equal(response.status, ended ? 200 : 503); assert.equal((await f.storage.get('leases')).length, 1);
    const blocked = await f.create({ headers: { 'Idempotency-Key': 'blocked_rematch_cleanup_0001' } });
    assert.equal(blocked.response.status, 409); assert.equal(blocked.body.error, 'user_has_active_allocation'); assert.equal(f.calls.start, 1);
    container.failStop = false; await f.admission.alarm();
    assert.equal((await f.storage.get('leases')).length, 0); assert.equal(f.calls.start, 1);
  }
});
test('raced duplicate close destroys once and old close cannot release a new generation', async () => {
  const f = fixture(); const first = await f.create(); const path = '/api/play/matches/' + first.body.matchId;
  const responses = await Promise.all([f.route(request(path, { method: 'DELETE' })), f.route(request(path, { method: 'DELETE' }))]);
  assert.deepEqual(responses.map(r => r.status), [204, 204]); assert.equal(f.calls.destroy, 1); assert.equal((await f.storage.get('leases')).length, 0);
  const next = await f.create({ headers: { 'Idempotency-Key': 'explicit_rematch_race_0001' } }); assert.equal(next.response.status, 202);
  assert.equal((await f.route(request(path, { method: 'DELETE' }))).status, 204);
  assert.equal((await f.storage.get('leases'))[0].matchId, next.body.matchId); assert.equal(f.calls.start, 2); assert.equal(f.calls.destroy, 1);
});
test('lease-release transport failure preserves cleanup response and alarm fallback', async () => {
  const f = fixture(); const first = await f.create(); const release = f.admission.release.bind(f.admission);
  f.admission.release = async () => { throw Error('fixture release RPC unavailable'); };
  assert.equal((await f.route(request('/api/play/matches/' + first.body.matchId, { method: 'DELETE' }))).status, 204);
  assert.equal(f.containers.get(first.body.matchId).running, false); assert.equal((await f.storage.get('leases')).length, 1);
  const blocked = await f.create({ headers: { 'Idempotency-Key': 'blocked_rematch_release_0001' } }); assert.equal(blocked.response.status, 409);
  f.admission.release = release; await f.admission.alarm(); assert.equal((await f.storage.get('leases')).length, 0);
  const next = await f.create({ headers: { 'Idempotency-Key': 'explicit_rematch_retry_0001' } }); assert.equal(next.response.status, 202); assert.equal(f.calls.start, 2);
});
test('hung release is bounded outside the queue and does not restart or replay', async t => {
  const f = fixture(); const first = await f.create(); const release = f.admission.release.bind(f.admission);
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, 'timeout', ms => timeout(ms === 5000 ? 20 : ms));
  f.admission.release = () => new Promise(() => {});
  const response = await Promise.race([f.route(request('/api/play/matches/' + first.body.matchId, { method: 'DELETE' })),
    new Promise((_, reject) => setTimeout(() => reject(Error('release exceeded bounded response')), 300))]);
  assert.equal(response.status, 204); assert.equal((await f.storage.get('leases')).length, 1);
  assert.equal((await f.matches.get(first.body.matchId).destructionProof(first.body.generation)).confirmed, true);
  assert.equal(f.calls.start, 1); assert.equal(f.calls.actions.length, 0);
  f.admission.release = release; await f.admission.alarm(); assert.equal((await f.storage.get('leases')).length, 0);
});
test('replaying original create after close returns its old receipt without auto-rematch', async () => {
  const f = fixture(); const first = await f.create();
  await f.route(request('/api/play/matches/' + first.body.matchId, { method: 'DELETE' }));
  const replay = await f.create(); assert.equal(replay.body.replay, true); assert.equal(replay.body.matchId, first.body.matchId);
  assert.equal(f.calls.start, 1); assert.equal((await f.storage.get('leases')).length, 0); assert.equal((await f.storage.get('trial-budget')).reservations, 1);
});
test('post-start eviction with abandoned caller reconciles durable initializing allocation without restart', async () => {
  const f = fixture(); const original = f.env.FORGE_MATCHES.getByName; const background = [];
  f.admission.ctx.waitUntil = promise => background.push(promise);
  f.env.FORGE_MATCHES.getByName = id => {
    const service = original(id);
    return { ...service, begin: async allocation => {
      const storage = f.stores.get(id);
      await storage.put('allocation', { ...allocation, status: 'initializing', internalToken: 'fixture-internal-capability-before-eviction',
        startupDeadline: allocation.createdAt + 120000, lastAuthorizedAt: allocation.createdAt, retainUntil: allocation.expiresAt + 86400000 });
      await storage.setAlarm(allocation.createdAt + 120000);
      f.containers.get(id).start({ enableInternet: false });
      // Simulate runtime replacement after persisted start, not a clean finally.
      throw Error('fixture caller/runtime abandoned startup');
    } };
  };
  const first = await f.create(); assert.equal(first.response.status, 202); await Promise.all(background);
  assert.equal(f.calls.start, 1); assert.equal((await f.storage.get('leases')).length, 1);
  const lease = (await f.storage.get('leases'))[0];
  f.env.FORGE_MATCHES.getByName = original;
  const restored = new MatchService({ ctx: { storage: f.stores.get(first.body.matchId), container: f.containers.get(first.body.matchId) }, env: f.env, verifyBearer, native: f.native, now: () => 122000 });
  f.matches.set(first.body.matchId, restored);
  await restored.reconcile(lease); // same recorded instance only, no begin()
  f.setTime(122000); await f.admission.alarm();
  assert.equal(f.calls.start, 1); assert.equal(f.calls.destroy, 1); assert.equal((await f.storage.get('leases')).length, 0);
  await assert.rejects(restored.begin(lease, input()), /invalid_or_expired_allocation/);
  const replay = await f.create(); assert.equal(replay.body.matchId, first.body.matchId); assert.equal(replay.body.replay, true); assert.equal(f.calls.start, 1);
});
test('owner initialization GET is immediate and read-only while real begin queue is occupied', async () => {
  const f = fixture(), work = []; f.admission.ctx.waitUntil = promise => work.push(promise);
  const confirm = f.native.confirmInitialization; let finish; const gate = new Promise(resolve => { finish = resolve; });
  f.native.confirmInitialization = async options => { await gate; return confirm(options); };
  const first = await f.create(); const path = '/api/play/matches/' + first.body.matchId;
  while (!(await f.stores.get(first.body.matchId).get('allocation'))) await new Promise(r => setTimeout(r, 1));
  const before = f.calls.port;
  const response = await Promise.race([f.route(request(path, { method: 'GET' })), new Promise((_, reject) => setTimeout(() => reject(Error('initialization GET queued behind begin')), 300))]);
  assert.equal(response.status, 202); assert.equal((await response.json()).status, 'initializing'); assert.equal(f.calls.port, before);
  assert.equal((await f.route(request(path, { method: 'GET', token: 'other' }))).status, 404);
  finish(); await Promise.all(work); assert.equal((await f.route(request(path, { method: 'GET' }))).status, 200); assert.equal(f.calls.start, 1);
});
test('create202 before per-match persistence uses trusted owner lease, never404 or polling start', async () => {
  const f = fixture(), work = []; f.admission.ctx.waitUntil = promise => work.push(promise);
  const original = f.env.FORGE_MATCHES.getByName; let finish; const gate = new Promise(resolve => { finish = resolve; });
  f.env.FORGE_MATCHES.getByName = id => { const service = original(id); return { begin: () => gate, fetch: request => service.fetch(request) }; };
  const first = await f.create(); const path = '/api/play/matches/' + first.body.matchId;
  assert.equal(await f.stores.get(first.body.matchId).get('allocation'), undefined);
  const response = await f.route(request(path, { method: 'GET' })); const value = await response.json();
  assert.equal(response.status, 202); assert.equal(value.matchId, first.body.matchId); assert.equal(value.generation, first.body.generation);
  assert.equal(value.startupDeadline, undefined); assert.equal(value.ownerId, undefined);
  assert.equal((await f.route(request(path, { method: 'GET', token: 'other' }))).status, 404);
  assert.equal((await f.route(request('/api/play/matches/00000000-0000-4000-8000-000000000099', { method: 'GET' }))).status, 404);
  assert.equal((await f.route(request(path, { method: 'GET', token: null }))).status, 401);
  assert.equal(f.calls.start, 0); assert.equal(f.calls.port, 0); assert.equal(f.calls.destroy, 0);
  f.setTime(122000); assert.equal((await f.route(request(path, { method: 'GET' }))).status, 410);
  assert.equal(f.calls.start, 0); assert.equal(f.calls.destroy, 0); // alarm, not GET, owns cleanup
  finish(); await Promise.all(work); f.env.FORGE_MATCHES.getByName = original; await f.admission.alarm();
  assert.equal((await f.storage.get('leases')).length, 0); assert.equal(f.calls.start, 0);
});
test('pending lease lookup uncertainty is retryable503, never fabricated unknown or initialization', async () => {
  const f = fixture(); f.admission.pendingStatus = async () => { throw Error('fixture admission unavailable'); };
  const response = await f.route(request('/api/play/matches/00000000-0000-4000-8000-000000000099', { method: 'GET' }));
  assert.equal(response.status, 503); assert.equal(response.headers.get('Retry-After'), '1'); assert.equal(f.calls.start, 0);
});
test('running state still waits for lifecycle queue and cannot use initialization bypass', async () => {
  const f = fixture(); const first = await f.create(); const service = f.matches.get(first.body.matchId);
  let finish; const gate = new Promise(resolve => { finish = resolve; }); const held = service.serial(() => gate); const before = f.calls.port;
  let completed = false; const response = f.route(request('/api/play/matches/' + first.body.matchId, { method: 'GET' })).then(value => { completed = true; return value; });
  await new Promise(r => setTimeout(r, 20)); assert.equal(completed, false); assert.equal(f.calls.port, before);
  finish(); await held; assert.equal((await response).status, 200);
});

test('wrapper cleanup never certifies an indeterminate post-destroy process status or releases capacity', async () => {
  for (const unknown of [undefined, null, 0, '', 'false']) {
    const f = fixture(); const { body } = await f.create();
    const container = f.containers.get(body.matchId), storage = f.stores.get(body.matchId);
    container.destroy = async () => { f.calls.destroy++; container.running = unknown; };
    const response = await f.route(request('/api/play/matches/' + body.matchId, { method: 'DELETE', body: undefined }));
    assert.equal(response.status, 503, 'unknown status ' + String(unknown));
    assert.equal((await response.json()).error, 'cleanup_unconfirmed');
    assert.notEqual(await storage.get('destructionConfirmed'), true);
    assert.equal((await f.storage.get('leases')).length, 1);
    assert.equal((await storage.get('allocation')).status, 'closed');
    container.destroy = async () => { f.calls.destroy++; container.running = false; };
    await f.admission.alarm();
    assert.equal(await storage.get('destructionConfirmed'), true);
    assert.equal((await f.storage.get('leases')).length, 0);
  }
});
