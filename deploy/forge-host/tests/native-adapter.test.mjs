import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeAdapter } from '../src/native-adapter.mjs';
import { digest, FORGE_REVISION, NATIVE_SCHEMA } from '../src/policy.mjs';
const epoch = '00000000-0000-4000-8000-000000000004';
const input = { format: 'Commander', difficultyPolicyVersion: 'forge-default-smart-v1', humanDeck: { cards: [{ name: 'Fixture', qty: 1 }] }, opponentDeck: { cards: [{ name: 'Fixture CPU', qty: 1 }] } };
async function fixture() {
  const allocation = { expiresAt: 900000, requestDigest: await digest(input), deckDigests: { human: await digest(input.humanDeck), opponent: await digest(input.opponentDeck) } };
  const receipt = { schema: 'cardstashy.forge-exact-initialization.v1', engineRevision: FORGE_REVISION, policyVersion: input.difficultyPolicyVersion, aiProfile: 'Default', controlMode: 'smart', viewerId: 0, requestDigest: allocation.requestDigest, humanDigest: allocation.deckDigests.human, opponentDigest: allocation.deckDigests.opponent, humanRosterDigest: 'a'.repeat(64), opponentRosterDigest: 'b'.repeat(64), supported: true, legal: true, registeredRosterVerified: true, nativeRosterVerified: true, errors: [] };
  const state = { schema: NATIVE_SCHEMA, forgeRevision: FORGE_REVISION, viewer: 0, status: 'running', initialization: receipt };
  const args = { allocation, input, epoch, internalToken: 'fixture-capability-12345678901234567890', fetchExisting: async () => Response.json(state, { headers: { 'X-Host-Epoch': epoch } }) };
  return { allocation, receipt, state, args, adapter: nativeAdapter({}) };
}
test('exact adapter uses only fixed bootstrap command and runtime capability/deadline', async () => {
  const f = await fixture(); const options = await f.adapter.startOptions(f.args);
  assert.deepEqual(options.entrypoint, ['python3', '/opt/host-service/bootstrap.py']); assert.equal(options.enableInternet, false);
  assert.equal(options.env.HOST_ABSOLUTE_DEADLINE_MS, String(f.allocation.expiresAt)); assert.equal(Object.keys(options.env).length, 2);
});
test('bootstrap preserves raw snapshot, sends initialization once and never retries ambiguous POST', async () => {
  const f = await fixture(); let posts = 0;
  const args = { ...f.args, deadline: 1000, now: () => 0, wait: async () => {}, fetchExisting: async request => {
    if (request.method === 'GET') return Response.json({ protocol: 'cardstashy.match-input.v1' });
    posts++; assert.deepEqual(await request.json(), { input }); assert.equal(request.redirect, 'manual'); throw Error('ambiguous');
  } };
  await assert.rejects(f.adapter.bootstrapExisting(args)); assert.equal(posts, 1);
});
test('a lost initialization reply is settled by one look at the launcher, never by sending the input again', async () => {
  const lost = () => { throw TypeError('Network connection lost.'); };
  for (const [name, afterPost, outcome] of [
    ['launcher gone: it took the input, so startup goes on to prove it', lost, null],
    ['the engine gateway answers in its place', () => Response.json({ error: 'route_not_found' }, { status: 404 }), null],
    ['launcher still waiting: it never took the input', () => Response.json({ protocol: 'cardstashy.match-input.v1' }), /^bootstrap_input_not_taken Network connection lost\.$/],
  ]) {
    const f = await fixture(); let posts = 0, looks = 0, clock = 0;
    const args = { ...f.args, deadline: 100000, now: () => clock, wait: async ms => { clock += ms; }, fetchExisting: async request => {
      if (request.method === 'POST') { posts++; lost(); }
      if (!posts) return Response.json({ protocol: 'cardstashy.match-input.v1' });
      looks++; return afterPost();
    } };
    if (outcome) await assert.rejects(f.adapter.bootstrapExisting(args), error => outcome.test(error.message), name);
    else await f.adapter.bootstrapExisting(args);
    assert.equal(posts, 1, name);
    // A lost look is asked again for about 3 s; an answer settles it at once.
    if (afterPost === lost) { assert.ok(looks > 1 && clock >= 3000 && clock <= 3500, name); } else assert.equal(looks, 1, name);
  }
});
test('a look lost to the same brief fault is asked again, so a launcher still waiting is reported at once', async () => {
  const f = await fixture(); let posts = 0, looks = 0, clock = 0;
  const args = { ...f.args, deadline: 100000, now: () => clock, wait: async ms => { clock += ms; }, fetchExisting: async request => {
    if (request.method === 'POST') { posts++; throw TypeError('Network connection lost.'); }
    if (!posts) return Response.json({ protocol: 'cardstashy.match-input.v1' });
    if (++looks < 3) throw TypeError('Network connection lost.');
    return Response.json({ protocol: 'cardstashy.match-input.v1' });
  } };
  await assert.rejects(f.adapter.bootstrapExisting(args), /^Error: bootstrap_input_not_taken/);
  assert.equal(posts, 1); assert.equal(looks, 3); assert.ok(clock < 1000);
});
test('a container end or a replacement during initialization is reported as itself, without a look', async () => {
  for (const failure of [Object.assign(Error('container_exited'), { containerExited: true }), Object.assign(Error('replaced_by_new_start'), { replaced: true })]) {
    const f = await fixture(); let calls = 0;
    const args = { ...f.args, deadline: 1000, now: () => 0, wait: async () => {}, fetchExisting: async request => {
      calls++; if (request.method === 'GET') return Response.json({ protocol: 'cardstashy.match-input.v1' }); throw failure;
    } };
    await assert.rejects(f.adapter.bootstrapExisting(args), error => error === failure); assert.equal(calls, 2);
  }
});
test('bootstrap refusal names the launcher status and fixed code, a platform reply by its first words; the runtime alone sets the length', async () => {
  for (const [reply, expected] of [
    [() => Response.json({ error: 'content_length_required' }, { status: 411 }), /^bootstrap_rejected_411_content_length_required$/],
    [() => Response.json({ error: 'input_write_failed_permissionerror' }, { status: 503 }), /^bootstrap_rejected_503_input_write_failed_permissionerror$/],
    [() => new Response('<html>provider error</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }), /^bootstrap_rejected_502 html provider error html$/],
    [() => new Response('There is no Container instance available at this time.', { status: 503 }), /^bootstrap_rejected_503 There is no Container instance available at this time$/],
    [() => new Response(null, { status: 503 }), /^bootstrap_rejected_503$/],
    [() => Response.json({ error: 'Not a code: /run/cardstashy/match-input.json' }, { status: 400 }), /^bootstrap_rejected_400$/],
  ]) {
    const f = await fixture(); let sent = null;
    const args = { ...f.args, deadline: 1000, now: () => 0, wait: async () => {}, fetchExisting: async request => {
      if (request.method === 'GET') return Response.json({ protocol: 'cardstashy.match-input.v1' });
      sent = request; return reply();
    } };
    await assert.rejects(f.adapter.bootstrapExisting(args), error => expected.test(error.message));
    assert.equal(sent.headers.get('Content-Length'), null); assert.equal(sent.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(await sent.json(), { input });
  }
});
test('native receipt must prove exact source, policy, both rosters and viewer before acceptance', async () => {
  for (const [key, value] of Object.entries({ supported: false, legal: false, registeredRosterVerified: false, nativeRosterVerified: false, viewerId: 1, humanDigest: 'c'.repeat(64), opponentDigest: 'c'.repeat(64), requestDigest: 'c'.repeat(64), policyVersion: 'easy', engineRevision: 'other', humanRosterDigest: null, schema: 'other', aiProfile: 'Cheat', errors: ['rejected'] })) {
    const f = await fixture(); f.receipt[key] = value; await assert.rejects(f.adapter.confirmInitialization(f.args), undefined, key);
  }
  const good = await fixture(); assert.equal((await good.adapter.confirmInitialization(good.args)).viewerId, 0);
});
test('failed native receipt exposes bounded validation findings, not seats/rosters', async () => {
  const f = await fixture(); f.state.status = 'failed'; f.receipt.errors = ['format_or_policy_not_supported']; f.receipt.seats = { opponent: { secret: 'not returned' } };
  assert.deepEqual(await f.adapter.readStartupFailure(f.args), { code: 'native_exact_validation_rejected', errors: ['format_or_policy_not_supported'] });
});
test('engine human player identity is bound from verified receipt, not assumed equal to seat index', async () => {
  const f = await fixture(); f.receipt.viewerId = 7; f.state.viewer = 7;
  assert.equal((await f.adapter.confirmInitialization(f.args)).viewerId, 7);
});
