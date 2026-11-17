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
 assert.equal(buildPlanTargets({ plan: 'auto', seed: null }), null, 'no card chosen yet: no numbers');
 assert.deepEqual(buildPlanTargets({ plan: 'auto', seed: card('Abrade') }), buildPlanTargets({ plan: 'control' }), 'Auto reads an answer spell as a control build-around');
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

// Seen 16 Nov on a $20 rebuild of the Rubble Rouser deck: the cheapest-first build kept ONE Rubble Rouser (a $0.20 card)
// and that list was shown. A build-around is played at its full copy count whenever the budget allows.
{
 const cheap = buildDeck({ ...options, budget: 20, completionFirst: true }), d = read(cheap);
 assert.equal(d.total, 60, 'the $20 cheapest-first build is complete');
 assert.equal(d.rows.find(r => r.name === fx.seed)?.qty, 4, 'four Rubble Rouser in the $20 cheapest-first build, not one');
 assert.ok(d.rows.reduce((n, r) => n + (Number(r.card?.prices?.usd) || 0) * r.qty, 0) <= 20 + 1e-6, 'and it stays inside $20');
}
// The deck view groups by job with the builder's own tests.
{
 const { cardJob } = await import('./builder.js');
 assert.equal(cardJob(card('Rubble Rouser')), 'Threats'); assert.equal(cardJob(card('Burst Lightning')), 'Removal'); assert.equal(cardJob(card('Mountain') || { type_line: 'Basic Land — Mountain' }), 'Lands');
}
// "Rebuild unlocked": locked cards come back at the copies they had (ai-deck-builder.js passes them as base rows).
{
 const deck = buildDeck({ ...options, base: [{ name: fx.seed, qty: 4 }, { name: 'Burst Lightning', qty: 4 }, { name: 'Fear of Missing Out', qty: 3 }], variation: 'varied', forgeSeed: 'LOCK22' }), qty = n => deck.cards.find(r => r.name === n)?.qty;
 assert.equal(qty(fx.seed), 4); assert.equal(qty('Burst Lightning'), 4); assert.ok(qty('Fear of Missing Out') >= 3, 'a locked card keeps at least its copies');
 assert.equal(deck.cards.reduce((n, r) => n + r.qty, 0), 60);
}

// Seen 16 Nov 2026 by Randall on the released builder (three more Standard Random builds):
//  - Monoist Sentry (a 4/1 defender), Plan Auto, Power Strong: twenty removal spells and almost nothing that wins,
//    with Kain, Traitorous Dragoon, who hands himself to the opponent. A defender is not a "threat", so Auto held no plan.
//  - Drogskol Reaver: nineteen creatures beside seven counterspells. Real creature lists average half a counterspell.
//  - A planeswalker build-around (The Theorist, Jace Beleren) built 22 creatures; the 33 real lists that play it are control.
// The fixture is the card pool the site loaded for each of those builds; the lists are the same 131.
{
 const { planShape, isCounterspell, givesItselfAway } = await import('./builder.js');
 const fx2 = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/random-build-pools-2026-11-17.json.gz', import.meta.url))));
 const pool = Object.fromEntries(fx2.cards.map(c => [cardKey(c.name), c])), get = n => pool[cardKey(n)];
 const build = (seed, colors, more = {}) => buildDeck({ format: 'Standard', seeds: [get(seed)], base: [{ name: seed, qty: 1 }], catalog: pool, colors, price: c => Number(c?.prices?.usd) || null, prior: c => prior.weight(c.name), ...more });
 const shape = deck => { const rows = deck.cards.map(r => ({ ...r, card: get(r.name) })).filter(r => !isLand(r.card)), sum = f => rows.filter(r => f(r.card)).reduce((n, r) => n + r.qty, 0);
  return { rows, creatures: sum(c => /\bCreature\b/.test(c.type_line.split(' // ')[0])), threats: sum(isThreat), removal: sum(c => forgeRoles(c).includes('interaction') && !isThreat(c)), counters: sum(isCounterspell), total: deck.cards.reduce((n, r) => n + r.qty, 0) }; };
 // Card facts, checked on Scryfall.
 assert.equal(get('Monoist Sentry').power, '4'); assert.match(get('Monoist Sentry').oracle_text, /Defender/);
 assert.equal(isThreat(get('Monoist Sentry')), false, 'a defender does not attack');
 assert.equal(givesItselfAway(get('Kain, Traitorous Dragoon')), true, 'Kain hands himself to the opponent');
 assert.equal(givesItselfAway(get('Bitter Triumph')), false);
 for (const n of ['Countersculpt', 'Three Steps Ahead', 'Spell Snare']) assert.equal(isCounterspell(get(n)), true, n + ' counters a spell');
 assert.equal(isCounterspell(get('Erode')), false);
 // Auto always commits to a plan.
 assert.equal(planShape('auto', [get('Monoist Sentry')]).board, true, 'a wall build-around gets the creature deck numbers');
 assert.equal(planShape('auto', [get('Drogskol Reaver')]).board, true);
 assert.equal(planShape('auto', [get('The Theorist, Jace Beleren')]).id, 'control', 'a planeswalker leads a control deck');
 assert.equal(planShape('auto', [get('Countersculpt')]).id, 'control', 'so does a counterspell');
 // Monoist Sentry, every Power setting: a creature deck, not a removal pile, and no Kain.
 for (const power of [null, 'casual', 'strong', 'max']) {
  const deck = build('Monoist Sentry', ['B'], { power }), d = shape(deck), label = 'Monoist Sentry at ' + power + ': ';
  assert.equal(d.total, 60, label + 'sixty cards'); assert.equal(d.rows.find(r => r.name === 'Monoist Sentry')?.qty, 4, label + 'four copies of the build-around');
  assert.ok(d.threats >= 20, label + d.threats + ' threats'); assert.ok(d.removal <= 10 && d.removal >= 4, label + d.removal + ' removal spells');
  assert.ok(!d.rows.some(r => r.name === 'Kain, Traitorous Dragoon'), label + 'no card that hands itself to the opponent');
 }
 // Power Strong and Max mean cards real lists play: fewer cards no current list plays than at Casual.
 { const unplayed = power => shape(build('Monoist Sentry', ['B'], { power })).rows.filter(r => r.name !== 'Monoist Sentry' && prior.weight(r.name) === 0).reduce((n, r) => n + r.qty, 0);
  assert.ok(unplayed('max') <= unplayed('casual'), 'Max plays no more unplayed cards than Casual: ' + unplayed('max') + ' vs ' + unplayed('casual'));
  assert.ok(unplayed('max') <= 4, 'at Max at most one playset of cards no real list plays: ' + unplayed('max')); }
 // Drogskol Reaver: a creature deck with no main-deck counterspell.
 { const d = shape(build('Drogskol Reaver', ['W', 'U'], { power: 'casual' }));
  assert.equal(d.total, 60); assert.equal(d.counters, 0, 'a creature deck main-decks no counterspell: ' + d.rows.filter(r => isCounterspell(r.card)).map(r => r.qty + ' ' + r.name));
  assert.ok(d.threats >= 20, d.threats + ' threats'); }
 // The Theorist, Jace Beleren: a control deck. Few creatures, counterspells and answers in numbers.
 { const d = shape(build('The Theorist, Jace Beleren', ['U'], { power: 'casual' }));
  assert.equal(d.total, 60); assert.ok(d.creatures <= 12, d.creatures + ' creatures in a control deck; real control lists average 1.3');
  assert.ok(d.removal >= 12, d.removal + ' answers; real control lists play 14'); assert.ok(d.counters >= 4, d.counters + ' counterspells; real control lists average 7.5'); }
}
