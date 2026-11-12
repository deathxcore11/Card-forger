// A card only goes into a built deck when the deck holds what the card needs
// (deck-needs.js). Real Scryfall card text and the real candidate pools the
// builder searches (test-fixtures/deck-real-pools.json.gz, 12 Nov 2026): the
// two piles Randall reported (a colourless Walls of Ba Sing Se deck and a
// green-blue Lessons from Life deck) must not come back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { cardNeeds, inspectNeeds, idleFixer } from './deck-needs.js';
import { buildDeck } from './builder.js';
import { cardKey } from './core.js';

const fx = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/deck-real-pools.json.gz', import.meta.url))));
const extra = Object.fromEntries(fx.extra.map(c => [c.name, c])), card = n => extra[n] || Object.values(fx.pools).flat().find(c => c.name === n);
const ids = n => cardNeeds(card(n)).map(x => x.id);

// What each reported card needs.
assert.deepEqual(ids("Pirate's Cutlass"), ['sub:Pirate']);
assert.deepEqual(ids('First-Time Flyer'), ['sub:Lesson']);
assert.deepEqual(ids('Razzle-Dazzler'), ['second-spell']);
assert.deepEqual(ids('Jaded Analyst'), ['second-draw']);
assert.deepEqual(ids('Gnarlid Colony'), ['plus-counters']);
assert.deepEqual(ids('Evidence Examiner'), ['graveyard-fill']);
for (const n of ['Juggernaut', 'Essence Scatter', 'Campus Guide', 'The Walls of Ba Sing Se', 'Lessons from Life', 'Well-Worn Spatula']) assert.deepEqual(ids(n), [], n + ' needs nothing');
// Lessons from Life is a plain Sorcery, not a Lesson: it does not feed First-Time Flyer.
assert.equal(cardNeeds(card('First-Time Flyer'))[0].provides(card('Lessons from Life')), false);
// A colour fixer has nothing to fix in a colourless or one-colour deck.
for (const n of ["Giant's Boulder", 'Prophetic Prism', 'Gravestone Strider']) { assert.ok(idleFixer(card(n), ['C']), n); assert.ok(idleFixer(card(n), ['G']), n); assert.ok(!idleFixer(card(n), ['G', 'U']), n); }

// The reported lists, read back: every unsupported card is named.
const reported = [[1, 'Lessons from Life'], [4, 'First-Time Flyer'], [4, 'Razzle-Dazzler'], [4, 'Essence Scatter'], [4, 'Evidence Examiner'], [4, 'Cryotheory Adept'], [4, 'Gnarlid Colony'], [3, 'Jaded Analyst'], [4, 'Extraordinary Journey'], [4, "Giant's Boulder"]].map(([qty, n]) => ({ card: card(n), qty }));
const open = inspectNeeds(reported, { size: 60 }).filter(n => !n.met).map(n => n.name).sort();
assert.deepEqual(open, ['Evidence Examiner', 'First-Time Flyer', 'Gnarlid Colony', 'Jaded Analyst', 'Razzle-Dazzler'], 'the reported green-blue pile has five unsupported cards: ' + open);

// Builds from the real pools: no unsupported card, no idle fixer, no Giant's Boulder.
const build = (format, ci, seedName, more = []) => {
 const all = [...fx.pools[format.toLowerCase() + '|' + ci], ...fx.extra.filter(c => /Basic/.test(c.type_line) || c.name === seedName || more.includes(c.name))];
 const catalog = Object.fromEntries(all.map(c => [cardKey(c.name), c])), colors = ci === 'c' ? ['C'] : ci.toUpperCase().split('');
 const deck = buildDeck({ format, seeds: [catalog[cardKey(seedName)]], catalog, colors, price: c => Number(c.prices?.usd) || null, forgeSeed: 'ABCD', variation: 'varied', power: 'casual' });
 return { deck, rows: deck.cards.map(r => ({ card: catalog[cardKey(r.name)], qty: r.qty })), names: deck.cards.map(r => r.name) };
};
const reportedCards = fx.extra.map(c => c.name);
for (const [format, ci, seed] of [['Standard', 'c', 'The Walls of Ba Sing Se'], ['Standard', 'gu', 'Lessons from Life'], ['Standard', 'gu', 'First-Time Flyer'], ['Pioneer', 'gu', 'Lessons from Life'], ['Modern', 'ub', 'Essence Scatter'], ['Pauper', 'g', 'Gnarlid Colony']]) {
 const { deck, rows, names } = build(format, ci, seed, reportedCards), label = format + ' ' + seed;
 assert.equal(deck.total, 60, label + ' is complete');
 assert.ok(!names.includes("Giant's Boulder"), label + " has no Giant's Boulder");
 assert.ok(!names.includes("Pirate's Cutlass"), label + " has no Pirate's Cutlass");
 const unmet = inspectNeeds(rows, { size: 60 }).filter(n => !n.met && cardKey(n.name) !== cardKey(seed));
 assert.deepEqual(unmet, [], label + ' has no unsupported card: ' + JSON.stringify(unmet));
 if (ci.length < 2) assert.deepEqual(rows.filter(r => idleFixer(r.card, deck.colors)).map(r => r.card.name), [], label + ' has no idle colour fixer');
}
console.log('deck needs: reported piles read correctly; 6 real-pool builds hold no unsupported card');
