// Five free starter decks, one per colour (play-starter-deck.js STARTER_DECKS, Randall 3 Nov 23:01Z):
// cards into the Trunk and saved as Play decks, once; players from before get the four new ones on login.
import assert from 'node:assert/strict';
import {STARTER_DECKS, PRACTICE_STARTER_ROWS} from './play-starter-deck.js';
import {playDeckSupport} from './play-deck-sources.js';
import {progressRoute, STARTER_TOP_UP} from './play-econ-route.js';

assert.deepEqual(STARTER_DECKS.map(d => d.colour), ['White', 'Blue', 'Black', 'Red', 'Green'], 'one deck per colour');
for (const d of STARTER_DECKS) {
  assert.equal(d.rows.reduce((n, r) => n + r.qty, 0), 60, d.name + ': 60 cards');
  assert.equal(d.format, 'Standard');
  assert.equal(playDeckSupport({...d, cards: d.rows, side: []}).status, 'pool', d.name + ': every card has rules in the engine');
}
assert.equal(STARTER_DECKS.find(d => d.colour === 'Green').rows, PRACTICE_STARTER_ROWS, 'Green is the existing starter');
assert.equal(STARTER_TOP_UP, true, 'existing players get them too (Randall picked "Yes, everyone gets them")');

const ora = n => n.toString(16).padStart(8, '0') + '-0000-0000-0000-000000000000';
let decks = [{id: 'x', name: 'Green creatures · Starter', format: 'Standard', cards: []}], ledger = new Set(), counters = {logins: 3}, granted = [];
const calls = [];
const fetcher = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('/rest/v1/rpc/')) {
    const name = u.split('/rpc/')[1], args = JSON.parse(init.body); calls.push(name);
    if (name === 'play_state') return new Response(JSON.stringify({config: {}, wallet: {coins: 0, starter_at: '2026-11-01'}, packs: [], cards: [], decks}));
    if (name === 'play_bump') { if (ledger.has(args.p_ref)) return new Response(JSON.stringify({duplicate: true, counters})); ledger.add(args.p_ref); for (const [k, v] of Object.entries(args.p_counters)) counters[k] = (counters[k] || 0) + v; return new Response(JSON.stringify({duplicate: false, counters})); }
    if (name === 'play_apply') { if (ledger.has(args.p_ref)) return new Response(JSON.stringify({duplicate: true})); ledger.add(args.p_ref); granted.push(...(args.p_delta.cards || [])); return new Response(JSON.stringify({})); }
    if (name === 'play_save_deck') { decks.push({id: 'd' + decks.length, name: args.p_name, format: args.p_format, cards: args.p_cards}); return new Response(JSON.stringify({id: 'd'})); }
    return new Response(JSON.stringify({}));
  }
  if (u.endsWith('/cards/collection')) { const ids = JSON.parse(init.body).identifiers; return new Response(JSON.stringify({data: ids.map((x, i) => ({name: x.name, oracle_id: ora(i + 1), rarity: 'common', set: 'fdn', id: ora(i + 1)}))})); }
  if (u.includes('/sets')) return new Response(JSON.stringify({data: []}));
  return new Response('nf', {status: 404});
};
const env = {SUPABASE_SERVICE_KEY: 'sb_secret_test', SUPABASE_URL: 'https://example.supabase.co'};
const verifyBearer = async () => ({id: 'u1'});
const login = async () => (await progressRoute(new Request('https://cardstashy.com/api/progress/login', {method: 'POST', headers: {Authorization: 'Bearer ok'}, body: '{}'}), env, {verifyBearer, fetcher})).json();

const first = await login();
assert.ok(first.state, 'the top-up sends the new state');
assert.equal(granted.length, 4 * 9 * 4, 'four new decks: nine cards, four copies each, basics free');
assert.deepEqual(decks.map(d => d.name).sort(), STARTER_DECKS.map(d => d.name).sort(), 'all five saved as Play decks, the one already there kept once');
assert.ok(decks.filter(d => d.cards.length).every(d => d.cards.reduce((n, r) => n + r.qty, 0) === 60));
const before = granted.length, saved = decks.length;
await login(); await login();
assert.equal(granted.length, before, 'once only');
assert.equal(decks.length, saved, 'no repeat decks');
console.log('play starters ok');
