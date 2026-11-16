// Seen 16 Nov 2026 by Randall in a live Standard Random build around Rubble Rouser (web 4.3.210): four Fire Magic
// (damage to EVERY creature) beside sixteen small creatures of its own, twenty-one removal spells against twelve
// creatures in the build before it, and a stray single Gastal Blockbuster / Aetherjacket.
// The fixture is the exact input: the card pool ai-deck-builder.js loaded for that build and the 131 Magic Online
// Standard lists the site served that day. Real lists come in two shapes: decks with 16 or more creatures play no
// main-deck sweeper (4 of 81 do, none of them a damage sweeper) and about 6 interaction; decks with fewer than 12
// creatures play 3 to 4 sweepers. A creature build-around gets the creature shape.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { buildDeck, isThreat } from './builder.js';
import { cardNeeds } from './deck-needs.js';
import { forgeRoles } from './deck-forge.js';
import { metaPrior } from './deck-meta-prior.js';
import { cardKey, isLand } from './core.js';

const fx = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/random-build-rubble-rouser-2026-11-16.json.gz', import.meta.url))));
const catalog = Object.fromEntries(fx.cards.map(c => [cardKey(c.name), c])), card = n => catalog[cardKey(n)], prior = metaPrior(fx.decks);
assert.equal(prior.size, 131);

// The sweepers in the reported lists hit their owner's creatures too, and the needs check now knows it.
const sweepIds = n => cardNeeds(card(n)).filter(x => x.max).map(x => x.id);
assert.deepEqual(sweepIds('Fire Magic'), ['self-sweep'], 'Fire Magic deals damage to each creature');
assert.deepEqual(sweepIds('Burst Lightning'), [], 'a one-target burn spell sweeps nothing');
assert.deepEqual(sweepIds('Torch the Tower'), []);
{
 const need = cardNeeds(card('Fire Magic')).find(x => x.max);
 assert.equal(need.provides(card('Fear of Missing Out')), true, 'Fear of Missing Out (2/3) dies to its own Fire Magic');
 assert.equal(need.provides(card('Flamewake Phoenix')), true);
 assert.equal(need.provides(card('Rubble Rouser')), false, 'Rubble Rouser is a 1/4: three damage does not kill it');
 assert.equal(need.provides(card('Burst Lightning')), false, 'a spell is not swept');
}
// Damage that only hits the other side is not a conflict.
assert.deepEqual(cardNeeds({ name: 'One-sided', type_line: 'Sorcery', oracle_text: 'One-sided deals 2 damage to each creature your opponents control.' }).filter(x => x.max), []);
// Ajani Unrelenting ({4}{R}{R}, mono-red): "4 damage to each creature except for tokens you control" kills its owner's real creatures.
assert.deepEqual(cardNeeds({ name: 'Ajani Unrelenting', type_line: 'Legendary Planeswalker — Ajani', oracle_text: 'Whenever you activate a loyalty ability, create a 2/2 colorless Wizard Soldier creature token named Cadet.\n+1: Creatures you control get +1/+0 and gain haste until end of turn.\n−2: Discard your hand, then draw a card for each creature you control.\n−3: Ajani deals 4 damage to each creature except for tokens you control.' }).filter(x => x.max).map(x => x.id), ['self-sweep']);

const options = { format: 'Standard', seeds: [card(fx.seed)], base: [{ name: fx.seed, qty: 1 }], catalog, colors: ['R'], price: c => Number(c?.prices?.usd) || null, prior: c => prior.weight(c.name) };
const read = deck => {
 const rows = deck.cards.map(r => ({ ...r, card: card(r.name) })), spells = rows.filter(r => !isLand(r.card)), sum = f => spells.filter(r => f(r.card)).reduce((n, r) => n + r.qty, 0);
 return { rows, spells, total: rows.reduce((n, r) => n + r.qty, 0), creatures: sum(c => /\bCreature\b/.test(c.type_line)), threats: sum(isThreat),
  removalSpells: sum(c => forgeRoles(c).includes('interaction') && !isThreat(c)), sweepers: spells.filter(r => cardNeeds(r.card).some(x => x.max) || forgeRoles(r.card).includes('wipe')).map(r => r.qty + ' ' + r.name) };
};
// Every build the app makes for this card: the default, and each pick setting of a Random build.
for (const forge of [{}, { power: 'casual', variation: 'varied', forgeSeed: 'ABCD' }, { power: 'casual', variation: 'varied', forgeSeed: 'QQ11' }, { power: 'casual', variation: 'varied', forgeSeed: 'K3K3' }, { power: 'strong', variation: 'tight' }]) {
 const deck = buildDeck({ ...options, ...forge }), d = read(deck), label = 'Rubble Rouser ' + JSON.stringify(forge) + ': ';
 assert.equal(d.total, 60, label + 'sixty cards');
 assert.equal(d.rows.find(r => r.name === fx.seed)?.qty, 4, label + 'four copies of the build-around');
 assert.deepEqual(d.sweepers, [], label + 'no sweeper that kills its own creatures: ' + d.sweepers);
 assert.ok(d.threats >= 20, label + d.threats + ' threats; real creature decks play 20 or more');
 assert.ok(d.removalSpells <= 10, label + d.removalSpells + ' removal spells; real creature decks average 6 and stop at 13');
 assert.ok(d.removalSpells >= 4, label + d.removalSpells + ' removal spells; a creature deck still answers a blocker');
 assert.ok(deck.lands >= 21 && deck.lands <= 24, label + deck.lands + ' lands');
 assert.deepEqual(d.spells.filter(r => r.qty === 1 && !/\bLegendary\b/.test(r.card.type_line)).map(r => r.name), [], label + 'no stray one-of');
}
// The comparison draft the app builds beside the main one ("scout", ai-deck-builder.js) used to hold ONE copy of its
// anchor card as if the player had asked for a single copy; that draft could win and ship the stray one-of.
for (const anchor of ['Gastal Blockbuster', 'Aetherjacket', 'Fanatical Firebrand']) {
 if (!card(anchor)) continue;
 const deck = buildDeck({ ...options, anchors: [anchor] }), row = deck.cards.find(r => r.name === anchor);
 assert.ok(!row || row.qty >= 2, 'a scout anchor is a real slot or absent, never a stray single copy: ' + anchor + ' x' + row?.qty);
 const strays = read(deck).spells.filter(r => r.qty === 1 && !/\bLegendary\b/.test(r.card.type_line)).map(r => r.name);
 assert.deepEqual(strays, [], 'no stray one-of beside ' + anchor);
}
// The Plan row of Build a deck (approved by Randall 16 Nov): the player may name the plan, and the sheet shows the numbers the builder holds.
{
 const { buildPlanTargets, planShape } = await import('./builder.js');
 assert.deepEqual(buildPlanTargets({ plan: 'auto', seed: card(fx.seed) }), { threats: '20+', removal: '6–10', sweepers: '0' });
 assert.deepEqual(buildPlanTargets({ plan: 'aggro', seed: card(fx.seed) }), { threats: '24+', removal: '6–8', sweepers: '0' });
 assert.deepEqual(buildPlanTargets({ plan: 'control', seed: card(fx.seed) }), { threats: '8+', removal: '12+', sweepers: '3' });
 assert.equal(buildPlanTargets({ plan: 'auto', seed: card('Abrade') }), null, 'Auto holds no numbers for a build-around that does not attack');
 assert.deepEqual(buildPlanTargets({ size: 100, commander: true }), { lands: '38', ramp: '10', draw: '12', removal: '10', sweepers: '3' });
 assert.equal(planShape('auto', [card(fx.seed)], 'control').board, false, 'a control request in words still wins over Auto');
 const aggro = read(buildDeck({ ...options, plan: 'aggro' })), mid = read(buildDeck({ ...options, plan: 'midrange' })), control = read(buildDeck({ ...options, plan: 'control' }));
 assert.ok(aggro.total === 60 && aggro.threats >= 24 && aggro.removalSpells >= 6 && aggro.removalSpells <= 8 && !aggro.sweepers.length, 'aggro: ' + aggro.threats + ' threats, ' + aggro.removalSpells + ' removal, ' + aggro.sweepers);
 assert.ok(mid.total === 60 && mid.threats >= 20 && mid.removalSpells >= 6 && mid.removalSpells <= 10 && !mid.sweepers.length, 'midrange');
 assert.ok(control.total === 60 && control.removalSpells >= 12 && control.removalSpells <= 16 && control.sweepers.length >= 1 && control.creatures <= 12, 'control: ' + control.removalSpells + ' removal, ' + control.creatures + ' creatures, ' + control.sweepers);
 const avg = d => d.spells.reduce((n, r) => n + r.qty * (Number(r.card.cmc) || 0), 0) / d.spells.reduce((n, r) => n + r.qty, 0);
 assert.ok(avg(aggro) <= avg(mid) + 1e-9, 'aggro is not the slower deck');
}
// The sideboard (approved 16 Nov): fifteen cards current lists sideboard, castable in the deck's colours, inside the copy limit
// with the main deck, and never past the budget. With nothing known or nothing affordable it stays empty and says so.
{
 const { buildSideboard } = await import('./deck-sideboard.js');
 const deck = buildDeck(options), base = { rows: deck.cards, catalog, colors: ['R'], prior, copyLimit: () => 4, isLegal: c => c.legalities?.standard === 'legal', cost: (c, n) => (Number(c.prices?.usd) || Infinity) * n };
 const side = buildSideboard(base), total = side.reduce((n, r) => n + r.qty, 0);
 assert.equal(total, 15, 'fifteen sideboard cards: ' + side.map(r => r.qty + ' ' + r.name).join(', '));
 assert.ok(side.some(r => r.name === 'Fire Magic'), 'Fire Magic belongs in the sideboard (25 lists sideboard it, 11 play it main)');
 for (const r of side) { const c = card(r.name), main = deck.cards.find(m => m.name === r.name)?.qty || 0;
  assert.ok(c && !isLand(c) && (c.color_identity || []).every(k => k === 'R'), r.name + ' is castable in mono-red');
  assert.ok(r.qty >= 1 && r.qty + main <= 4, r.name + ' stays inside four copies with the main deck');
  assert.ok(prior.sideLists(r.name) >= 1, r.name + ' is in a real sideboard'); }
 assert.ok(!side.some(r => r.name === 'Engineered Explosives'), 'a colour-counting card is idle in one colour');
 assert.deepEqual(buildSideboard({ ...base, budget: 0 }), [], 'no money left: no sideboard, not a padded one');
 const cheap = buildSideboard({ ...base, budget: 2 });
 assert.ok(cheap.reduce((n, r) => n + base.cost(card(r.name), r.qty), 0) <= 2 + 1e-6, 'the sideboard never passes the budget');
 assert.deepEqual(buildSideboard({ ...base, prior: metaPrior([]) }), [], 'no lists, no sideboard');
}
console.log('random build shape: the reported Rubble Rouser pool builds a creature deck with no self-sweeper and no stray one-of');
