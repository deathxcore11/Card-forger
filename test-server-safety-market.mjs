// Load the real Deno handler in an isolated VM. All provider and database I/O is mocked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const source = stripTypeScriptTypes(readFileSync('supabase/functions/market-history/index.ts', 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, ''));
let handler, registrations = [], saved = [], reads = [], providerCalls = [], watch = null, watchError = null, rpcError = null, result = 'registered';
let card = { id: 'base1-1', name: 'Alakazam', set: { id: 'base1' }, variants: { normal: true }, pricing: { tcgplayer: { normal: { marketPrice: 12 } } } };
const series = [{ source: 'saved source', currency: 'USD', finish: 'normal', points: [{ date: '2026-01-01', value: 1 }] }];
const db = {
  from(table) {
    reads.push(table);
    return {
      select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: watch, error: watchError }; },
      then(resolve) { return Promise.resolve({ data: series, error: null }).then(resolve); },
      upsert() { assert.fail('Direct registration must never bypass the atomic RPC'); },
    };
  },
  async rpc(name, args) {
    if (name === 'register_market_watch') { registrations.push(JSON.parse(JSON.stringify(args))); return { data: result, error: rpcError }; }
    assert.equal(name, 'merge_market_series'); saved.push(args); return { error: null };
  },
};
const context = {
  Response, Request, URL, AbortSignal, Date, console,
  Deno: { env: { get: name => ({ SUPABASE_URL: 'https://database.test', SUPABASE_SERVICE_ROLE_KEY: 'test-secret' })[name] }, serve: fn => { handler = fn; } },
  createClient: () => db, createRemoteJWKSet: () => ({}), jwtVerify: async () => ({ payload: {} }),
  fetch: async url => { providerCalls.push(url); assert.ok(url.startsWith('https://api.tcgdex.net/') || url.startsWith('https://api.scryfall.com/') || url.startsWith('https://db.ygoprodeck.com/'), 'unexpected fallback or live request'); return Response.json(card); },
};
vm.runInNewContext(source, context);
const request = (finish, game = 'ptcg', id = 'base1-1') => new Request('https://edge.test/market-history?' + new URLSearchParams({ game, id, finish }));
for (const finish of [...Array.from({ length: 30 }, (_, i) => 'fake-' + i), 'detail:missing', 'constructor', 'toString']) {
  const response = await handler(request(finish));
  const body = await response.json();
  assert.equal(response.status, 200); assert.deepEqual(body.series, series); assert.match(body.notice, /not supported/);
}
assert.equal(registrations.length, 0); assert.equal(saved.length, 0, 'invented finishes make zero writes');
let response = await handler(request('normal'));
assert.equal(response.status, 200); assert.equal(registrations.length, 1); assert.equal(saved.length, 1);
assert.deepEqual(registrations[0], { g: 'ptcg', c: 'base1-1', f: 'normal', n: 'Alakazam', s: 'base1' });
assert.equal(saved[0].p[0].value, 12);
card.pricing.tcgplayer.normal.marketPrice = null;
const registered = registrations.length;
response = await handler(request('normal'));
assert.match((await response.json()).notice, /supported but has no current USD quote/);
assert.equal(registrations.length, registered, 'supported-but-unpriced variants do not start new tracking');
card.variants_detailed = [{ variantId: 'real', type: 'normal', pricing: { tcgplayer: { normal: { marketPrice: 9 } } } }];
response = await handler(request('detail:real'));
assert.equal(response.status, 200); assert.equal(registrations.at(-1).f, 'detail:real'); assert.equal(saved.at(-1).p[0].value, 9);
card.pricing.tcgplayer.normal.marketPrice = 12;
const beforeMissing = saved.length;
rpcError = { code: 'PGRST202' };
response = await handler(request('normal'));
assert.match((await response.json()).notice, /registration is unavailable/); assert.equal(saved.length, beforeMissing, 'missing migration never falls back to direct writes');
rpcError = null;
for (const denied of ['capacity', 'rate_limited']) {
  result = denied; response = await handler(request('normal'));
  assert.deepEqual((await response.json()).series, series); assert.equal(saved.length, beforeMissing, 'denied registration writes no quote');
}
result = 'registered'; watchError = { code: 'offline' };
const beforeError = registrations.length;
assert.deepEqual((await (await handler(request('normal'))).json()).series, series);
assert.equal(registrations.length, beforeError, 'watch lookup failure never creates a registration');
watchError = null;
watch = { touched_at: new Date().toISOString() };
const beforeFresh = providerCalls.length;
await handler(request('normal'));
assert.equal(providerCalls.length, beforeFresh, 'fresh existing watch does not call the provider');
watch = null;
const uuid = '00000000-0000-4000-8000-000000000001';
card = { id: uuid, name: 'Island', set: 'lea', finishes: ['nonfoil'], prices: { usd: '3' } };
const beforeInvalid = registrations.length;
await handler(request('foil', 'mtg', uuid));
assert.equal(registrations.length, beforeInvalid, 'real Magic ID with nonexistent printing finish does not register');
assert.equal((await handler(request('nonfoil', 'mtg', 'made-up'))).status, 400);
assert.equal((await handler(request('foil', 'ygo', '89631139'))).status, 400);
assert.equal((await handler(request('nonfoil', 'mtg', uuid))).status, 200);
assert.equal(registrations.at(-1).g, 'mtg');
console.log('PASS: real market-history handler rejects fake finishes before writes, defines unpriced-variant policy and keeps saved history on registration failure.');
