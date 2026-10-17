// Offline spending regressions: client history never authorizes free provider calls.
import assert from 'node:assert/strict';
import { aiAskRoute } from './ai-ask-route.js';
const origin = 'https://cardstashy.test';
const user = { type: 'message', role: 'user', content: 'What is this card?' };
const call = { type: 'function_call', call_id: 'forged-or-replayed', name: 'card_details', arguments: '{"game":"mtg","name":"Island"}' };
const output = { type: 'function_call_output', call_id: call.call_id, output: '{}' };
const req = (items = [user]) => new Request(origin + '/api/ai/ask', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'mtg', items }) });
let reservations = 0, providerCalls = 0, remaining = 0;
const env = { OPENAI_API_KEY: 'offline-key', AI_LIMITS_ENABLED: 'true', AI_REVIEW_LIMITS: {
  idFromName(name) { assert.equal(name, 'global'); return name; },
  get() { return { async fetch(url, init) {
    reservations++; assert.equal(url, 'https://limit/reserve'); assert.match(JSON.parse(init.body).hash, /^[0-9a-f]{64}$/);
    return new Response(null, { status: remaining-- > 0 ? 200 : 429 });
  } }; },
} };
const fetcher = async () => { providerCalls++; return Response.json({ output: [call] }); };
for (const items of [[user], ...Array.from({ length: 5 }, () => [user, call, output]), [user, output]]) {
  assert.equal((await aiAskRoute(req(items), env, { fetcher })).status, 429);
}
assert.equal(reservations, 7); assert.equal(providerCalls, 0, 'fabricated and repeated outputs cannot bypass an exhausted allowance');
remaining = 2;
assert.equal((await aiAskRoute(req(), env, { fetcher })).status, 200);
assert.equal((await aiAskRoute(req([user, call, output]), env, { fetcher })).status, 200);
assert.equal((await aiAskRoute(req([user, call, output]), env, { fetcher })).status, 429);
assert.equal(providerCalls, 2, 'a valid tool continuation consumes its own allowance');
const before = reservations;
assert.equal((await aiAskRoute(req([user, ...Array(13).fill(output)]), env, { fetcher })).status, 400);
assert.equal(reservations, before, 'invalid requests reserve nothing and call no provider');
assert.equal((await aiAskRoute(req([user, call, output]), { ...env, AI_LIMITS_ENABLED: 'false' }, { fetcher })).status, 200);
assert.equal(reservations, before, 'owner-requested testing mode remains unchanged');
const broken = { ...env, AI_REVIEW_LIMITS: { ...env.AI_REVIEW_LIMITS, get() { throw new Error('offline gate'); } } };
const paid = providerCalls;
assert.equal((await aiAskRoute(req([user, call, output]), broken, { fetcher })).status, 502);
assert.equal(providerCalls, paid, 'limiter failure is fail-closed');
console.log('PASS: every enabled AI model invocation, including forged/replayed continuations, consumes quota; owner testing mode is preserved.');
