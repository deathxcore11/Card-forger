// Seen 17 Nov 2026 by Randall (deck 6, Standard): a deck built at Power "Casual" and then switched to "Max" on the
// built deck kept its Casual cards and read 59 power. Cause: on a Plan or Power change the old list stays in the
// running, and the closing-plan class was ranked ahead of power, so the old list (classed "supported") beat the new
// Max lists (classed "unverified") although they read higher.
// Fixture: one real-site run recorded that day around Acolyte of Aclazotz. It holds the cards the site had loaded,
// every card-search answer of the build, and the lists the old site showed (Casual 61, switched to Max 64).
// The 131 tournament lists are the ones the site served on 16 Nov.
// What fails on the old code is the ranking check at the end, which uses the two lists the site weighed that day (63 with a
// "supported" closing plan against 70 "unverified"). The replayed build guards the outcome on the real card pool; in Node the
// recorded pool does not class the Casual list the way the browser did, so the replay alone passes on old code too.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { S, blank } from './store.js';
import * as T from './tcg.js';
import { cardKey, cardPrice } from './core.js';
import { createDeckPipeline } from './deck-pipeline.js';
import { metaState } from './meta.js';
import { shownPower } from './power.js';
import { metaPrior } from './deck-meta-prior.js';

const read = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/' + name, import.meta.url))));
const fx = read('power-switch-acolyte-2026-11-17.json.gz'), lists = read('random-build-rubble-rouser-2026-11-16.json.gz').decks;
S.state = blank(); S.catalog = {};
const known = new Map(fx.cards.map(c => [cardKey(c.name), c]));
for (const c of fx.cards) for (const face of c.card_faces || []) if (!known.has(cardKey(face.name))) known.set(cardKey(face.name), c);
for (const name of fx.before) { const c = known.get(cardKey(name)); if (c) S.catalog[cardKey(c.name)] = c; }
const M = metaState('mtg:Standard'); M.data = { decks: lists, archetypes: [] }; M.at = Date.now();
const api = async (path, options = {}) => {
 const hit = fx.calls[(options.method || 'GET') + ' ' + path + (options.body || '')];
 if (!hit || hit.error) throw Object.assign(Error('not recorded'), { status: hit?.error || 404 });
 return hit.card ? known.get(cardKey(hit.card)) : { ...hit, data: hit.data.map(n => known.get(cardKey(n))).filter(Boolean) };
};
const resolve = async name => { const c = known.get(cardKey(name)) || null; if (c) S.catalog[cardKey(c.name)] = c; return c; };
const x = { S, T, tcgCtx: {}, api, resolve, resolveNames: async names => { for (const n of names) await resolve(n); }, cacheCard: c => (S.catalog[cardKey(c.name)] = c), meta: n => S.catalog[cardKey(n)] || null, priceOf: n => cardPrice(S.catalog[cardKey(n)]), inv: () => ({ owned: 0, available: 0 }) };
const pipeline = createDeckPipeline(x), prior = metaPrior(lists);
let s = 20261117; const random = Math.random; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const spells = r => r.rows.filter(q => q.zone === 'main' && !/\bLand\b/.test(q.card?.type_line || ''));
const unplayed = r => spells(r).filter(q => prior.weight(q.name) === 0).reduce((n, q) => n + q.qty, 0);
const line = r => shownPower(r.power) + ' power, ' + unplayed(r) + ' unplayed copies: ' + r.rows.filter(q => q.zone === 'main').map(q => q.qty + ' ' + q.name).join(', ');

// The sheet's own request for a one-tap build (Plan Auto, Power Casual, sideboard on).
const casual = await pipeline.build({ game: 'mtg', format: 'Standard', seed: fx.seed, budget: null, budgetMode: 'cap', preferOwned: true, sideboard: true, power: 'casual' });
assert.ok(casual.ok, casual.message);
// The Power chip on the built deck (deck-experience.js flowRetune).
const max = await pipeline.build({ ...casual.request, closest: false, retune: true, power: 'max', previousDeck: casual.deck, previousBudget: casual.request.budget, previousEstimate: casual.pricing.estimate });
Math.random = random;
assert.ok(max.ok, max.message);
console.log('power switch: casual ' + line(casual) + '\npower switch: max ' + line(max));
const kept = new Set(casual.rows.filter(q => q.zone === 'main').map(q => q.name)), same = spells(max).filter(q => kept.has(q.name) && q.name !== fx.seed).reduce((n, q) => n + q.qty, 0);
assert.ok(shownPower(max.power) >= 67, 'switched to Max the deck reads ' + shownPower(max.power) + ' (the old site showed ' + fx.site.max.power + ')');
assert.ok(unplayed(max) <= unplayed(casual) / 2, 'Max drops most cards no tournament list plays: ' + unplayed(casual) + ' to ' + unplayed(max));
assert.ok(same < spells(max).reduce((n, q) => n + q.qty, 0) - 4 - 8, 'Max is a new list, not the Casual one with a few cards changed (' + same + ' copies kept)');
// A budget rebuild is not a Plan or Power change: the closing-plan class still ranks ahead of power there.
const { chooseDeck, normalizeDeckRequest } = await import('./deck-construction.js');
{
 const cand = (score, status) => ({ check: { complete: true, legal: true }, plan: { issues: [], finalSupport: { status } }, pricing: { estimate: 10, subtotal: 10, unpriced: 0, copies: 60, ownedCopies: 0 }, power: { score, ctx: { score } }, deck: { cards: [] } });
 const req = extra => normalizeDeckRequest({ game: 'mtg', format: 'Standard', ...extra }, pipeline.formats), pair = [cand(63, 'supported-conditional'), cand(70, 'unverified')];
 assert.equal(shownPower(chooseDeck(pair, req({ retune: true })).power), 70, 'a Plan or Power change takes the stronger list');
 assert.equal(shownPower(chooseDeck(pair, req({})).power), 63, 'any other build keeps the old order');
}
