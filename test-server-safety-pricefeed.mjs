// No live writes or provider calls. Exercise the real Worker routes with a fake REST API.
import assert from 'node:assert/strict';
import { watchRoute, recordDailyPrices } from './pricefeed.js';
const env = { SUPABASE_SERVICE_KEY: 'test-secret', SUPABASE_URL: 'https://database.test', PRICE_BATCHES: '1', YGO_PRICE_BATCHES: '1' };
const mtgId = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const req = body => new Request('https://site.test/api/prices/watch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let requests = [], registered = [], providerError = 0, absent = false, rpcStatus = 'registered', rpcError = 0;
const fetcher = async (url, init = {}) => {
  requests.push(String(url));
  if (url.includes('/cards/collection')) return Response.json({ data: absent ? [] : JSON.parse(init.body).identifiers.map(({ id }) => ({ id })) }, { status: providerError || 200 });
  if (url.includes('/cardinfo.php')) return Response.json({ data: absent ? [] : new URL(url).searchParams.get('id').split(',').map(id => ({ id: Number(id) })) }, { status: providerError || 200 });
  assert.equal(url, 'https://database.test/rest/v1/rpc/register_price_watch', 'no direct service-role registration fallback');
  registered.push(JSON.parse(init.body));
  return Response.json(rpcStatus, { status: rpcError || 200 });
};
for (const body of [{ game: 'ptcg', ids: ['base1-1'] }, { game: 'mtg', ids: ['made-up'] }, { game: 'ygo', ids: ['1&limit=3000'] }, { game: 'mtg', ids: Array(301).fill(mtgId(1)) }, { game: 'ygo', ids: ['1', null] }]) {
  assert.equal((await watchRoute(req(body), env, { fetcher })).status, 400);
}
assert.equal(requests.length, 0, 'unsupported games and malformed batches never reach a provider or database');
absent = true;
assert.equal((await watchRoute(req({ game: 'mtg', ids: [mtgId(1)] }), env, { fetcher })).status, 400);
assert.equal(registered.length, 0, 'syntactically valid but nonexistent printing never registers');
absent = false;
let response = await watchRoute(req({ game: 'mtg', ids: [mtgId(1), mtgId(1)] }), env, { fetcher });
assert.deepEqual(await response.json(), { ok: true, tracked: 1 });
assert.deepEqual(registered[0], { g: 'mtg', ids: [mtgId(1)] });
assert.equal((await watchRoute(req({ game: 'ygo', ids: ['89631139'] }), env, { fetcher })).status, 200);
providerError = 503;
const writes = registered.length;
assert.equal((await watchRoute(req({ game: 'mtg', ids: [mtgId(1)] }), env, { fetcher })).status, 503);
assert.equal(registered.length, writes);
providerError = 0; rpcError = 404;
assert.equal((await watchRoute(req({ game: 'mtg', ids: [mtgId(1)] }), env, { fetcher })).status, 503, 'missing migration fails closed');
rpcError = 0; rpcStatus = 'capacity';
assert.equal((await watchRoute(req({ game: 'mtg', ids: [mtgId(1)] }), env, { fetcher })).status, 429);
rpcStatus = 'rate_limited';
assert.equal((await watchRoute(req({ game: 'mtg', ids: [mtgId(1)] }), env, { fetcher })).status, 429);

const allWatches = [
  ...Array.from({ length: 3000 }, (_, i) => ({ game: 'ptcg', card_id: 'fake-' + i })),
  ...Array.from({ length: 200 }, (_, i) => ({ game: 'mtg', card_id: mtgId(i + 1) })),
  { game: 'ygo', card_id: '89631139' },
];
let watchQueries = [], saved = [], failMagicRead = false;
const dailyFetcher = async (url, init = {}) => {
  const u = new URL(url);
  if (u.pathname.endsWith('/price_watch')) {
    const game = u.searchParams.get('game')?.replace('eq.', '');
    watchQueries.push(game); assert.ok(['mtg', 'ygo'].includes(game), 'filter games before LIMIT');
    assert.ok(u.searchParams.get('last_seen')?.startsWith('gte.'));
    if (game === 'mtg' && failMagicRead) return Response.json({}, { status: 503 });
    return Response.json(allWatches.filter(w => w.game === game).slice(0, Number(u.searchParams.get('limit'))));
  }
  if (u.host === 'api.scryfall.com') return Response.json({ data: JSON.parse(init.body).identifiers.map(({ id }) => ({ id, prices: { usd: '1.23' } })) });
  if (u.host === 'db.ygoprodeck.com') return Response.json({ data: [{ id: 89631139, card_prices: [{ tcgplayer_price: '2.5' }] }] });
  if (u.pathname.endsWith('/price_points')) { saved.push(...JSON.parse(init.body)); return new Response(null, { status: 201 }); }
  if (u.pathname.endsWith('/rpc/prune_price_points')) return new Response(null, { status: 204 });
  throw new Error('Unexpected request: ' + url);
};
assert.deepEqual(await recordDailyPrices(env, dailyFetcher), { watched: 76, saved: 76 });
assert.deepEqual(watchQueries, ['mtg', 'ygo']);
assert.ok(saved.some(row => row.game === 'ygo'), 'saturated Magic and unsupported legacy watches cannot starve Yu-Gi-Oh!');
failMagicRead = true; saved = []; watchQueries = [];
assert.deepEqual(await recordDailyPrices(env, dailyFetcher), { watched: 1, saved: 1, unavailableGames: ['mtg'] });
assert.equal(saved[0].game, 'ygo', 'one game read outage cannot suppress the other');
watchQueries = []; failMagicRead = false;
await recordDailyPrices({ ...env, YGO_PRICE_BATCHES: '0' }, dailyFetcher);
assert.deepEqual(watchQueries, ['mtg'], 'explicit zero batch budget is respected');
console.log('PASS: verified/bounded legacy registrations, fail-closed RPCs, independent per-game history budgets and partial-outage recording.');
