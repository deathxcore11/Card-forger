// Play "Build a deck" finder: ownership share, seal costs, ranking, Trunk build, and the price wall.
import assert from 'node:assert/strict';
import {finderRow, rankFinderRows, trunkDeck, finderMarkup, createNameFacts} from './play-deck-finder.js';

const card = (name, type, rarity = 'common', ci = ['R'], extra = {}) => ({name, type_line: type, rarity, color_identity: ci, cmc: 2, oracle_text: '', legalities: {standard: 'legal', commander: 'legal'}, image_uris: {normal: `https://img/${name}.jpg`, art_crop: `https://art/${name}.jpg`}, ...extra});
const facts = new Map([
  ['Shock', card('Shock', 'Instant')],
  ['Goblin Guide', card('Goblin Guide', 'Creature — Goblin Scout', 'rare')],
  ['Glorybringer', card('Glorybringer', 'Creature — Dragon', 'mythic')],
  ['Mind Stone', card('Mind Stone', 'Artifact', 'uncommon', [])],
]);
const cardOf = n => facts.get(n) || null;
const list = {key: 'meta:burn', name: 'Burn', format: 'Standard', cards: [{name: 'Shock', qty: 4}, {name: 'Goblin Guide', qty: 4}, {name: 'Glorybringer', qty: 2}, {name: 'Mountain', qty: 20}, {name: 'Shock', qty: 1, board: 'side'}]};

// Owned counts, greyed rows and seal cost per rarity.
const owned = new Map([['Shock', 4], ['Goblin Guide', 1]]);
const row = finderRow(list, {owned, cardOf, seals: {c: 0, u: 0, r: 5, m: 1}});
assert.equal(row.want, 10, 'basics never count toward what you need');
assert.equal(row.have, 5);
assert.equal(row.complete, false);
assert.deepEqual(row.colors, ['R']);
assert.equal(row.shortfall.seals.r, 3, 'three missing Goblin Guides = three rare seals');
assert.equal(row.shortfall.seals.m, 2);
assert.equal(row.enough, false, 'one mythic seal does not cover two');
assert.deepEqual(row.groups.map(g => g.label), ['Creatures', 'Spells', 'Lands']);
assert.equal(row.groups.find(g => g.label === 'Lands').count, 20);
assert.match(row.cover, /Glorybringer|Goblin Guide/, 'cover is creature art');

// Ranking: Trunk build first, then complete, then most owned.
const ready = {key: 'meta:shock', name: 'Shock pile', format: 'Standard', cards: [{name: 'Shock', qty: 4}, {name: 'Mountain', qty: 20}]};
const far = {key: 'meta:dragons', name: 'Dragons', format: 'Standard', cards: [{name: 'Glorybringer', qty: 4}]};
const trunk = {key: 'trunk:Standard', trunk: true, name: 'Forged from your Trunk', format: 'Standard', cards: [{name: 'Goblin Guide', qty: 1}]};
const ranked = rankFinderRows([far, list, ready, trunk], {owned, cardOf});
assert.deepEqual(ranked.map(r => r.key), ['trunk:Standard', 'meta:shock', 'meta:burn', 'meta:dragons']);

// Markup: missing cards greyed with seal labels, no prices anywhere.
const html = finderMarkup({format: 'Standard', rows: ranked, limit: 3});
assert.match(html, /pf-card--missing/);
assert.match(html, /aria-pressed="true">Standard</);
assert.match(html, /More decks/);
assert.doesNotMatch(html, /\$|usd|eur|price/i, 'Play wall: no prices');
assert.match(finderMarkup({busy: true}), /pf-skeleton/);

// Trunk build: only owned cards (plus basics), never priced.
const built = [];
const deck = trunkDeck({format: 'Standard', ownedCards: [{o: 'a', c: 4}, {o: 'b', c: 2}], factOf: o => ({a: facts.get('Shock'), b: facts.get('Goblin Guide')})[o], build: opts => {
  built.push(opts);
  assert.equal(opts.budget, 0);
  assert.equal(opts.price('Shock'), null);
  assert.equal(opts.available('Shock'), 4);
  assert.equal(opts.available('Mountain'), 99);
  assert.equal(opts.available('Glorybringer'), 0);
  return {cards: [{name: 'Shock', qty: 4}, {name: 'Mountain', qty: 20}], open: 0};
}});
assert.equal(deck.trunk, true);
assert.equal(deck.detail, 'Every card is yours');
assert.equal(built.length, 1, 'stops at the first complete build');
assert.equal(trunkDeck({format: 'Standard'}), null);

// Name facts: fetched once by name, slim (no prices).
let calls = 0;
const nf = createNameFacts({fetchImpl: async (url, init) => { calls++; assert.match(url, /cards\/collection$/); return {ok: true, json: async () => ({data: [{...card('Shock', 'Instant'), prices: {usd: '0.10'}}]})}; }});
await nf.want(['Shock', 'Mountain']);
await nf.want(['Shock']);
assert.equal(calls, 1);
assert.equal(nf.get('Shock').name, 'Shock');
assert.equal(nf.get('Shock').prices, undefined, 'slim cards drop prices');
console.log('play deck finder ok');
