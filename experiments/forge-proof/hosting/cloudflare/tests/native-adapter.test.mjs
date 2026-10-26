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
