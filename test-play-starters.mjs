// The ten free precons (data/play-starters/precons.json, Randall 4 Nov 00:32Z): five 60-card and five
// Commander decks, saved as Play decks once; the 60-card decks' cards go into the Trunk; the old
// homemade starter decks are taken back; players from before get them on login; new signups get
// 5 packs each of the 4 newest Merchant sets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RETIRED_STARTER_NAMES} from './play-starter-deck.js';
import {playDeckSupport} from './play-deck-sources.js';
import {progressRoute, STARTER_TOP_UP, STARTER_REF, STARTER_COMMANDER_CARDS} from './play-econ-route.js';

const data = JSON.parse(readFileSync(new URL('./data/play-starters/precons.json', import.meta.url), 'utf8'));
assert.equal(data.decks.filter(d => d.format === 'Standard').length, 5, 'five 60-card decks');
assert.equal(data.decks.filter(d => d.format === 'Commander').length, 10, 'ten Commander decks (five from the 2022 Starter Commander Decks)');
for (const d of data.decks) {
  for (const r of d.rows) if (r.was) assert.ok(Object.entries(data.swaps).some(([real, stand]) => real === r.was && stand === r.name), d.name + ': ' + r.name + ' was must name the real card it stands in for');
  for (const r of d.rows) assert.ok(r.set && /^[0-9A-Za-z★†-]+$/.test(r.number || ''), d.name + ': ' + r.name + ' needs a set and collector number (the deck view finds art by them)');
  for (const r of d.rows) assert.ok(/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(r.id || ''), d.name + ': ' + r.name + ' needs its exact printing id (a precon shows the art it came with, not the newest reprint)');
  assert.equal(d.rows.reduce((n, r) => n + r.qty, 0), d.format === 'Commander' ? 100 : 60, d.name);
  const commander = d.rows.find(r => r.commander)?.name || '';
  assert.equal(!!commander, d.format === 'Commander', d.name + ': a commander only in Commander');
  // The Commander decks list real cards the legacy web engine lacks rules for; the Forge engine plays them.
  if (d.format !== 'Commander') assert.equal(playDeckSupport({...d, commander, cards: d.rows.map(r => ({name: r.name, qty: r.qty})), side: []}).status, 'pool', d.name + ': every card has rules in the web engine');
}
assert.equal(STARTER_TOP_UP, true);

const ora = n => n.toString(16).padStart(8, '0') + '-0000-0000-0000-000000000000';
const byPrint = new Map(data.decks.flatMap(d => d.rows.filter(r => r.set).map(r => [r.set + ':' + r.number, r.name])));
let decks, ledger, counters, granted, wallet, packs, cards;
const reset = () => { decks = [{id: 'old', name: RETIRED_STARTER_NAMES[0], format: 'Standard', cards: []}, {id: 'mine', name: 'My own deck', format: 'Standard', cards: []}]; ledger = new Set(); counters = {logins: 3}; granted = []; wallet = {coins: 0, starter_at: '2026-11-01'}; packs = []; cards = []; };
const fetcher = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('/rest/v1/rpc/')) {
    const name = u.split('/rpc/')[1], args = JSON.parse(init.body);
    if (name === 'play_state') return new Response(JSON.stringify({config: {}, wallet, packs, cards, decks}));
    if (name === 'play_bump') { if (ledger.has(args.p_ref)) return new Response(JSON.stringify({duplicate: true, counters})); ledger.add(args.p_ref); for (const [k, v] of Object.entries(args.p_counters)) counters[k] = (counters[k] || 0) + v; return new Response(JSON.stringify({duplicate: false, counters})); }
    if (name === 'play_apply') { if (ledger.has(args.p_ref)) return new Response(JSON.stringify({duplicate: true})); ledger.add(args.p_ref); granted.push(...(args.p_delta.cards || [])); packs.push(...(args.p_delta.packs || [])); if (args.p_delta.starter) wallet = {...wallet, starter_at: 'now'}; return new Response(JSON.stringify({})); }
    if (name === 'play_save_deck') { if (args.p_delete) decks = decks.filter(d => d.id !== args.p_id); else decks.push({id: 'd' + decks.length, name: args.p_name, format: args.p_format, cards: args.p_cards}); return new Response(JSON.stringify({id: 'd'})); }
    return new Response(JSON.stringify({}));
  }
  if (u.endsWith('/data/play-starters/precons.json')) return new Response(JSON.stringify(data));
  if (u.endsWith('/cards/collection')) {
    const ids = JSON.parse(init.body).identifiers;
    return new Response(JSON.stringify({data: ids.map((x, i) => { const name = x.name || byPrint.get(x.set + ':' + x.collector_number); return {name, oracle_id: ora(i + 1), rarity: 'rare', set: x.set || 'fdn', collector_number: x.collector_number || String(i + 1), id: ora(i + 1)}; })}));
  }
  if (u.endsWith('/data/mtg-boosters/index.json')) return new Response(JSON.stringify({sets: {mbc: {}, fra: {}, hob: {}, msh: {}, old: {}}}));
  if (u.includes('/forge-rules/')) return new Response(JSON.stringify({standardSets: ['mbc', 'fra', 'hob', 'msh']}));
  if (u.includes('api.scryfall.com/sets')) return new Response(JSON.stringify({data: [['mbc', '2026-10-30'], ['fra', '2026-10-01'], ['hob', '2026-08-01'], ['msh', '2026-06-01'], ['old', '2020-01-01']].map(([code, released_at]) => ({code, name: code, released_at, set_type: 'expansion', card_count: 250}))}));
  return new Response('nf', {status: 404});
};
const env = {SUPABASE_SERVICE_KEY: 'sb_secret_test', SUPABASE_URL: 'https://example.supabase.co'};
const verifyBearer = async () => ({id: 'u1'});
const post = async path => (await progressRoute(new Request('https://cardstashy.com/api/progress/' + path, {method: 'POST', headers: {Authorization: 'Bearer ok'}, body: '{}'}), env, {verifyBearer, fetcher})).json();

// A player from before: the precons come on login, once; the old starters go; their own decks stay.
reset();
const first = await post('login');
assert.ok(first.state, 'the top-up sends the new state');
assert.ok(ledger.has(STARTER_REF));
const names = decks.map(d => d.name);
for (const d of data.decks) assert.equal(names.includes(d.name), d.format !== 'Commander', d.name + (d.format === 'Commander' ? ' stays out of Decks' : ' saved as a Play deck'));
assert.ok(!names.includes(RETIRED_STARTER_NAMES[0]), 'the old homemade starter is taken back');
assert.ok(names.includes('My own deck'), "the player's own decks stay");
assert.ok(decks.filter(d => data.decks.some(p => p.name === d.name)).every(d => d.cards.every(r => r.set && r.number)), 'saved with real printings (the Precon emblem)');
const sixty = data.decks.filter(d => d.format === 'Standard').flatMap(d => d.rows).filter(r => !/^(?:Plains|Island|Swamp|Mountain|Forest)$/.test(r.name)).reduce((t, r) => t + Math.min(4, r.qty), 0);
assert.equal(STARTER_COMMANDER_CARDS, false);
assert.equal(granted.length, sixty, 'only the 60-card decks fill the Trunk');
const before = [granted.length, decks.length];
await post('login'); await post('login');
assert.deepEqual([granted.length, decks.length], before, 'once only');

// A new signup: the welcome gift with 5 packs each of the 4 newest Merchant sets, then the precons.
reset(); decks = []; wallet = {coins: 0};
await post('starter');
const bySet = packs.reduce((m, p) => ({...m, [p.set]: (m[p.set] || 0) + 1}), {});
assert.deepEqual(bySet, {mbc: 5, fra: 5, hob: 5, msh: 5}, '20 packs: 5 each of the 4 newest sets');
assert.equal(decks.length, 5, 'and the five 60-card precons as Play decks');
// An account that already holds packs (the 4 Nov reset gift) gets no second set of packs.
reset(); decks = []; wallet = {coins: 0}; packs = [{id: 1, set: 'mbc'}];
await post('starter');
assert.equal(packs.length, 1, 'no double gift');
console.log('play starters ok');
