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
    async confirmInitialization({ input: value, allocation }) { assert.equal(await digest(value), allocation.requestDigest); return { viewerId: 0, ...(value.opponentKind === 'human' ? { guestViewerId: 1 } : {}), schema: NATIVE_SCHEMA, engineRevision: FORGE_REVISION, policyVersion: value.difficultyPolicyVersion, humanDigest: allocation.deckDigests.human, opponentDigest: allocation.deckDigests.opponent }; },
  };
  const env = { FORGE_TRIAL_ENABLED: 'true', FORGE_TRIAL_OWNER_IDS: [owner, other, third].join(','), FORGE_TRIAL_EXPIRES_AT: new Date(86401000).toISOString(), FORGE_MATCHES: { getByName(id) {
    if (!matches.has(id)) {
      const storage = new Storage(); stores.set(id, storage);
      const container = { running: false, epoch, failStop: false, failRead: false,
        start(options) { calls.start++; this.running = true; assert.equal(options.enableInternet, false); },
        async setInactivityTimeout(ms) { assert.equal(ms, 600000); },
        monitor() { return new Promise((resolve, reject) => { this.exit = { resolve, reject }; }); },
        async destroy() { calls.destroy++; assert.notEqual((await storage.get('allocation')).status, 'running'); if (this.failStop) throw Error('stop failed'); this.running = false; },
        getTcpPort(port) { calls.port++; assert.equal(port, 8080); return { fetch: async r => {
          assert(this.running, 'must never fetch stopped container'); assert(r.headers.get('Authorization').startsWith('Bearer fixture-internal'));
          assert(!r.headers.get('Authorization').includes('owner'));
          if (this.failRead) throw Error('unresponsive');
          const headers = { 'Content-Type': 'application/json', 'X-Host-Epoch': this.epoch };
          const seatPath = new URL(r.url).pathname, seat2 = seatPath.startsWith('/seat2/');
          if (seatPath.endsWith('/action')) { calls.actions.push({ seat: seat2 ? 2 : 1, ...await r.json() }); return new Response('{}', { status: this.actionStatus || 202, headers }); }
          return new Response(JSON.stringify({ schema: NATIVE_SCHEMA, forgeRevision: FORGE_REVISION, viewer: seat2 ? 1 : 0, status: 'running', revision: 1, fixture: true, seatPath, ...this.snapshot }), { headers });
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
// Friend matches: a private room, an invite, two accounts bound to the two seats of one engine.
const json = async (f, path, { token = 'owner', method = 'POST', body } = {}) => {
  const response = await f.route(new Request(ORIGIN + path, { method, headers: { Authorization: 'Bearer ' + token, Origin: ORIGIN,
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
};
const read = (f, matchId, token) => json(f, '/api/play/matches/' + matchId, { token, method: 'GET' });
const act = (f, matchId, token, commandId, action) => json(f, '/api/play/matches/' + matchId + '/actions', { token, body: { commandId, generation: f.generation, action } });

async function openMatch(f) {
  const room = await json(f, '/api/play/rooms', { body: { format: 'Commander', deck: structuredClone(deck) } });
  assert.equal(room.status, 201); assert.match(room.body.invite, /^[A-Za-z0-9_-]{43}$/); assert.equal(room.body.status, 'open');
  // The guest first sees only the room's format, then joins with their own deck.
  const peek = await json(f, '/api/play/rooms/join', { token: 'other', body: { invite: room.body.invite } });
  assert.equal(peek.status, 200); assert.equal(peek.body.format, 'Commander'); assert.equal(peek.body.seat, 'guest'); assert.equal(peek.body.hostDeck, undefined);
  const guestDeck = structuredClone(deck); guestDeck.cards[1].name = 'Guest land';
  const joined = await json(f, '/api/play/rooms/join', { token: 'other', body: { invite: room.body.invite, deck: guestDeck } });
  assert.equal(joined.status, 202, JSON.stringify(joined.body));
  f.generation = joined.body.generation;
  return { room: room.body, matchId: joined.body.matchId, guestDeck };
}

test('a friend room seats the host and the guest in one engine, each with their own view', async () => {
  const f = fixture();
  const { room, matchId, guestDeck } = await openMatch(f);
  // The engine received both decks: host first, guest second, as two people.
  const [sent] = f.calls.verified;
  assert.equal(sent.opponentKind, 'human'); assert.equal(sent.startingPlayer, 'random');
  assert.deepEqual(sent.humanDeck, deck); assert.deepEqual(sent.opponentDeck, guestDeck);
  // The host learns the match from the room.
  const hostRoom = await json(f, '/api/play/rooms/' + room.roomId, { method: 'GET' });
  assert.equal(hostRoom.body.status, 'started'); assert.equal(hostRoom.body.matchId, matchId); assert.equal(hostRoom.body.guestJoined, true);
  const host = await read(f, matchId, 'owner'), guest = await read(f, matchId, 'other');
  assert.equal(host.status, 200); assert.equal(guest.status, 200);
  assert.equal(host.body.snapshot.viewer, 0); assert.equal(host.body.snapshot.seatPath, '/state');
  assert.equal(guest.body.snapshot.viewer, 1); assert.equal(guest.body.snapshot.seatPath, '/seat2/state');
  // A third account is nobody in this match.
  assert.equal((await read(f, matchId, 'third')).status, 404);
  assert.equal((await json(f, '/api/play/rooms/' + room.roomId, { token: 'third', method: 'GET' })).status, 404);
  // Each player's action goes to their own seat; ids are per seat, never shared.
  assert.equal((await act(f, matchId, 'owner', 'host-command-0000001', { revision: 1, op: 'ok' })).status, 202);
  assert.equal((await act(f, matchId, 'other', 'host-command-0000001', { revision: 1, op: 'ok' })).status, 202);
  assert.deepEqual(f.calls.actions.map(a => a.seat), [1, 2]);
  assert.equal((await act(f, matchId, 'third', 'third-command-000001', { revision: 1, op: 'ok' })).status, 404);
});

test('a room is full once a guest joins, and an invite cannot be reused, expired or self-joined', async () => {
  const f = fixture();
  const room = await json(f, '/api/play/rooms', { body: { format: 'Modern', deck: structuredClone(deck) } });
  assert.equal(room.status, 400, 'deck must match the room format');
  const ok = await json(f, '/api/play/rooms', { body: { format: 'Commander', deck: structuredClone(deck) } });
  assert.equal((await json(f, '/api/play/rooms/join', { token: 'owner', body: { invite: ok.body.invite } })).status, 409);
  // Two people race for the seat: one gets it.
  const [a, b] = await Promise.all(['other', 'third'].map(token => json(f, '/api/play/rooms/join', { token, body: { invite: ok.body.invite, deck: structuredClone(deck) } })));
  assert.deepEqual([a.status, b.status].sort(), [202, 409]);
  // The invite is spent once the match starts.
  assert.equal((await json(f, '/api/play/rooms/join', { token: 'third', body: { invite: ok.body.invite } })).status, 404);
  // An expired invite.
  const g = fixture();
  const late = await json(g, '/api/play/rooms', { body: { format: 'Commander', deck: structuredClone(deck) } });
  g.setTime(1000 + 1_800_001);
  assert.equal((await json(g, '/api/play/rooms/join', { token: 'other', body: { invite: late.body.invite } })).status, 410);
  // A cancelled room.
  const h = fixture();
  const gone = await json(h, '/api/play/rooms', { body: { format: 'Commander', deck: structuredClone(deck) } });
  assert.equal((await json(h, '/api/play/rooms/' + gone.body.roomId, { token: 'other', method: 'DELETE' })).status, 404, 'only the host cancels');
  assert.equal((await json(h, '/api/play/rooms/' + gone.body.roomId, { method: 'DELETE' })).status, 204);
  assert.equal((await json(h, '/api/play/rooms/join', { token: 'other', body: { invite: gone.body.invite } })).status, 410);
  assert.equal((await json(h, '/api/play/rooms/join', { token: 'other', body: { invite: 'x'.repeat(43) } })).status, 404);
});

test('either player of a friend match can end it, and both then see the same result', async () => {
  const f = fixture();
  const { matchId } = await openMatch(f);
  const [container] = [...f.containers.values()];
  container.snapshot = { status: 'finished', draw: false, winnerPlayerId: 1 };
  const guest = await read(f, matchId, 'other');
  assert.equal(guest.body.status, 'finished'); assert.equal(guest.body.viewerId, 1); assert.deepEqual(guest.body.result, { draw: false, winnerPlayerId: 1 });
  const host = await read(f, matchId, 'owner');
  assert.equal(host.body.status, 'finished'); assert.equal(host.body.viewerId, 0); assert.deepEqual(host.body.result, { draw: false, winnerPlayerId: 1 });
});
