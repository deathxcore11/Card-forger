// Play "Build a deck" finder: ownership share, seal costs, ranking, Trunk build, and the price wall.
import assert from 'node:assert/strict';
import {finderDeckMarkup, finderRow, rankFinderRows, rankFinderLists, ownedShare, trunkDeck, finderMarkup, createNameFacts, createCraftRarity, clusterArchetypes, finderArchetypes, finderRowMarkup, FINDER_FORMATS} from './play-deck-finder.js';
import {deckShortfall, deckStatus, copyCap, deckRules, ownedByName, PLAY_FORMATS} from './play-econ-rules.js';
import {craftPlan} from './play-econ-ui.js';

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
const ready = {key: 'meta:shock', name: 'Shock pile', format: 'Standard', cards: [{name: 'Shock', qty: 4}, {name: 'Mountain', qty: 56}]};
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

// Counted like the builder: an unfinished Trunk build reads 80/100, never 39/39, and is not ready.
const commanderTrunk = {key: 'trunk:Commander', trunk: true, format: 'Commander', size: 100, cards: [...Array.from({length: 39}, (_, i) => ({name: 'Card ' + i, qty: 1})), {name: 'Plains', qty: 21}, {name: 'Swamp', qty: 20}]};
const ownAll = new Map(Array.from({length: 39}, (_, i) => ['Card ' + i, 1]));
const tr = finderRow(commanderTrunk, {owned: ownAll});
assert.equal(`${tr.cardsHave}/${tr.size}`, '80/100');
assert.equal(tr.open, 20);
assert.equal(tr.complete, false);
assert.match(finderMarkup({rows: [tr], total: 1}), /80\/100/);

// Hundreds of lists rank by names alone; sorts and search.
assert.deepEqual(ownedShare(ready, owned), {have: 60, size: 60, share: 1, complete: true});
const many = Array.from({length: 300}, (_, i) => ({key: 'm' + i, name: i % 3 ? 'Burn' : 'Dragons', format: 'Standard', cards: [{name: 'Shock', qty: i % 5}, {name: 'Glorybringer', qty: 4}, {name: 'Mountain', qty: 56 - (i % 5)}]}));
const r1 = rankFinderLists([...many, trunk], {owned});
assert.equal(r1.length, 301);
assert.equal(r1[0].list.trunk, true);
assert.ok(r1[1].share >= r1[50].share);
assert.equal(rankFinderLists(many, {owned, sort: 'popular'})[0].list.name, 'Burn');
assert.equal(rankFinderLists([...many, ready], {owned, sort: 'ready'}).map(x => x.list.key).join(), 'meta:shock');
assert.equal(rankFinderLists(many, {owned, query: 'dragons'}).length, 100);
assert.equal(rankFinderLists(many, {owned, query: 'glorybringer'}).length, 300, 'search matches card names too');
assert.match(finderMarkup({rows: [tr], total: 301, limit: 8}), /More decks/);
assert.match(finderMarkup({rows: [], filter: 'trunk'}), /data-finder-filter="trunk" aria-pressed="true"/);

// Craft plan: seals per missing copy, what the wallet covers now.
const plan = craftPlan([{name: 'Goblin Guide', qty: 4}, {name: 'Glorybringer', qty: 2}, {name: 'Shock', qty: 4}, {name: 'Mountain', qty: 20}], owned, n => facts.get(n)?.rarity, {seal_r: 2, seal_m: 5});
assert.equal(plan.missing, 5);
assert.deepEqual(plan.need, {c: 0, u: 0, r: 3, m: 2});
assert.equal(plan.craftable, 4, 'two rare seals cover two of three Goblin Guides; both Glorybringers');

// --- Untapped-style seal math (3 Nov) ---
// Cross-printing pooling: copies add up by name.
assert.equal(ownedByName([{n: 'Lightning Strike', c: 2}, {n: 'Lightning Strike', c: 2}]).get('Lightning Strike'), 4);
// Caps: eight owned only cover four; singleton formats one; Vintage restricted one; basics free.
const capV = n => copyCap(n, 'Vintage', n === 'Black Lotus' ? {vintage: 'restricted'} : {vintage: 'legal'});
assert.deepEqual(deckShortfall([{name: 'Black Lotus', qty: 4}, {name: 'Island', qty: 20}], new Map(), new Map([['Black Lotus', 'rare']]), capV).seals, {c: 0, u: 0, r: 1, m: 0});
assert.equal(deckShortfall([{name: 'Shock', qty: 4}], new Map([['Shock', 8]]), new Map()).complete, true);
assert.equal(copyCap('Sol Ring', 'Commander'), 1);
assert.equal(copyCap('Forest', 'Standard Brawl'), Infinity);
assert.deepEqual(deckRules('Standard Brawl'), {size: 60, copies: 1, exact: true, commander: true, legality: 'standardbrawl'});
assert.ok(FINDER_FORMATS.every(f => PLAY_FORMATS.includes(f)) && FINDER_FORMATS.length === PLAY_FORMATS.length, 'finder covers every Play format');
// Four buckets: buildable, craftable, short per rarity.
const sf = deckShortfall([{name: 'A', qty: 2}, {name: 'B', qty: 1}], new Map(), new Map([['A', 'uncommon'], ['B', 'mythic']]));
assert.equal(deckStatus(sf, {u: 2, m: 1}).status, 'craftable');
assert.deepEqual(deckStatus(sf, {u: 5, m: 0}), {status: 'short', short: {c: 0, u: 0, r: 0, m: 1}});
assert.equal(deckStatus({complete: true}, {}).status, 'buildable');
// Cheapest rarity: a common printing wins over the rare one Scryfall shows by default; the id is
// the printing crafting stamps; one search per rarity per 40 names; cached on the device.
const store = new Map(), storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
const asked = [];
const fake = async url => { const q = new URL(url).searchParams.get('q'); asked.push(q);
  const data = /r:c/.test(q) ? [{name: 'Lightning Bolt', id: 'bolt-c', set: 'm10'}] : /r:u/.test(q) ? [{name: 'Counterspell', id: 'cs-u', set: 'dsc'}] : /r:m/.test(q) ? [{name: 'Fable of the Mirror-Breaker // Reflection of Kiki-Jiki', id: 'fable', set: 'neo'}] : [];
  return {json: async () => data.length ? {data} : {object: 'error', code: 'not_found'}}; };
const cr = createCraftRarity({fetchImpl: fake, storage, pause: async () => {}});
await cr.want(['Lightning Bolt', 'Counterspell', 'Fable of the Mirror-Breaker', 'Mountain', 'Nope']);
assert.equal(cr.rarity('Lightning Bolt'), 'common');
assert.equal(cr.id('Lightning Bolt'), 'bolt-c');
assert.equal(cr.rarity('Counterspell'), 'uncommon');
assert.equal(cr.rarity('Fable of the Mirror-Breaker'), 'mythic', 'front names match two-faced cards');
assert.equal(cr.missed('Nope'), true);
assert.equal(asked.length, 4, 'one search per rarity for the whole batch');
assert.doesNotMatch(asked.join(), /Mountain/, 'basics are never looked up');
assert.equal(createCraftRarity({fetchImpl: async () => { throw Error('no'); }, storage}).rarity('Lightning Bolt'), 'common', 'kept on the device');
// The finder bills at the cheap rarity.
const boltList = {key: 'meta:bolt', name: 'Bolt', format: 'Modern', cards: [{name: 'Lightning Bolt', qty: 4}, {name: 'Mountain', qty: 56}]};
assert.deepEqual(finderRow(boltList, {cardOf: () => ({name: 'Lightning Bolt', rarity: 'uncommon', type_line: 'Instant'}), rarityOf: n => cr.rarity(n), seals: {c: 4}}).shortfall.seals, {c: 4, u: 0, r: 0, m: 0});
assert.equal(finderRow(boltList, {cardOf: () => null, rarityOf: n => cr.rarity(n), seals: {c: 4}}).status, 'craftable');
// Names-only status for hundreds of lists, pending while a rarity loads, and the filters.
assert.equal(ownedShare(boltList, new Map(), {rarityOf: () => '', seals: {}}).status, 'pending');
assert.equal(ownedShare(boltList, new Map(), {rarityOf: () => 'common', seals: {c: 3}}).status, 'short');
const L = [boltList, ready, far];
const R = n => ({'Lightning Bolt': 'common', Glorybringer: 'mythic'})[n] || 'common';
assert.deepEqual(rankFinderLists(L, {owned, filter: 'craftable', rarityOf: R, seals: {c: 4}}).map(x => x.list.key), ['meta:shock', 'meta:bolt'], 'buildable first, then craftable');
assert.deepEqual(rankFinderLists(L, {owned, filter: 'trunk', rarityOf: R, seals: {c: 4}}).map(x => x.list.key), ['meta:shock']);
// Archetypes: a one-card swap stays in the same archetype; a different package does not.
const base = Array.from({length: 8}, (_, i) => ({name: 'Core ' + i, qty: 4}));
const v1 = {key: 'a', name: 'Izzet Prowess', archetype: 'Izzet Prowess', format: 'Standard', cards: base};
const v2 = {key: 'b', name: 'UR Tempo', archetype: '', format: 'Standard', cards: [...base.slice(0, 7), {name: 'Swap', qty: 4}]};
const v3 = {key: 'c', name: 'Mono Green', archetype: 'Mono Green', format: 'Standard', cards: Array.from({length: 8}, (_, i) => ({name: 'Green ' + i, qty: 4}))};
const cl = clusterArchetypes([v1, v2, v3]);
assert.equal(cl.of('a').id, cl.of('b').id);
assert.notEqual(cl.of('a').id, cl.of('c').id);
assert.equal(cl.of('b').name, 'Izzet Prowess', 'named by the label its members use');
const cmd = (key, c) => ({key, name: c, format: 'Commander', commander: c, cards: [{name: c, qty: 1}, {name: 'Sol Ring', qty: 1}]});
const cc = clusterArchetypes([cmd('x', 'Kinnan'), cmd('y', 'Kinnan'), cmd('z', 'Tymna')]);
assert.equal(cc.of('x').id, cc.of('y').id, 'Commander lists cluster by commander');
assert.notEqual(cc.of('x').id, cc.of('z').id);
const arch = finderArchetypes(rankFinderLists([v1, v2, v3], {owned: new Map([['Swap', 4]]), clusters: cl}), cl);
assert.equal(arch.length, 2);
assert.equal(arch[0].lead.list.key, 'b', 'the variant closest to the Trunk leads');
assert.equal(arch[0].variants.length, 1);
const archHtml = finderRowMarkup(finderRow(v2, {owned: new Map([['Swap', 4]])}), {arch: {...arch[0], name: 'Izzet Prowess', size: 2}, enter: true});
assert.match(archHtml, /pf-row--enter/);
assert.match(archHtml, /1 more list</);
assert.match(archHtml, /data-act="playFinderOpen" data-finder-key="b">Izzet Prowess</, 'the title opens the deck page');
assert.match(archHtml, /data-finder-key="a"/, 'a variant opens in the builder too');
assert.doesNotMatch(archHtml, /\$|usd|price/i);
// The deck page is the app's own: deckShell hero + deck viewer, Play ownership, seals, no prices.
const full = {...list, cards: [...list.cards, {name: 'Mountain', qty: 30}]};
const page = finderDeckMarkup(finderRow(full, {owned, cardOf, seals: {r: 5, m: 2}}), {cardOf, packGoals: '<div class="pe-pack-goals"></div>'});
assert.match(page, /ds-hero/);
assert.match(page, /data-deck-view=/);
assert.match(page, /data-deck-category="Creatures"/);
assert.match(page, /pf-deck-row--missing/);
assert.match(page, /data-act="playFinderCraftAll"/, 'seals cover it: Craft all is offered');
assert.match(page, /Craft all 5/);
assert.match(page, /data-play-card="1"/);
assert.doesNotMatch(page, /\$|usd|price/i);
assert.doesNotMatch(finderDeckMarkup(finderRow(full, {owned, cardOf, seals: {}}), {cardOf}), /playFinderCraftAll/, 'short of seals: no Craft all');
// Craft plan respects the caps (no billing past four, or past one in singleton).
assert.equal(craftPlan([{name: 'Goblin Guide', qty: 7}], new Map(), () => 'rare', {}, () => 4).missing, 4);
console.log('play deck finder ok');
