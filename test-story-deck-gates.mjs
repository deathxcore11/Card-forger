// Story deck gates (scripts/story/deck-gates.mjs): the mistakes the Story review found must fail.
import assert from 'node:assert/strict';
import {checkDeck, diffLists} from './scripts/story/deck-gates.mjs';
const card = (set, number, name, type, mana_cost = '', cmc = 0, text = '', extra = {}) => ({set, number, name, type, mana_cost, cmc, text, forge: true, vintage: 'legal', id: `${set}-${number}`, ...extra});
const P = [
  card('x', '1', 'Swamp', 'Basic Land — Swamp'), card('x', '2', 'Forest', 'Basic Land — Forest'), card('x', '3', 'Plains', 'Basic Land — Plains'),
  card('x', '4', 'Grizzly Bears', 'Creature — Bear', '{1}{G}', 2), card('x', '5', 'Lightning Helix', 'Instant', '{R}{W}', 2, 'Lightning Helix deals 3 damage to any target and you gain 3 life.'),
  card('x', '6', 'Black Knight', 'Creature — Human Knight', '{B}{B}', 2), card('x', '7', 'Mox Jet', 'Artifact', '{0}', 0, '{T}: Add {B}.', {vintage: 'restricted'}),
  card('x', '8', 'Shield', 'Instant', '{W}', 1, 'Prevent the next 1 damage.'), card('y', '9', 'Later Card', 'Creature — Elf', '{G}', 1),
];
const pool = new Map(P.map(c => [c.set + '#' + c.number, c])), act = {sets: ['x'], landSet: 'x'};
const row = (qty, number) => { const c = P.find(x => x.number === number); return {qty, name: c.name, set: c.set, number}; };
const run = (cards, extra = {}) => checkDeck({label: 'tribute', cards, ...extra}, {pool, act});
const has = (r, re) => r.fail.some(f => re.test(f));

// Size and copies. Same-name rows add up, so 36 Grizzly Bears breaks the four-of limit.
const base = run([row(24, '2'), row(36, '4')]);
assert.ok(has(base, /36 copies of Grizzly Bears/), 'four-of limit');
assert.ok(!has(base, /cards, needs 60|mana:|win:|label:/), 'a 60-card mono-green deck passes every other gate');
assert.ok(has(run([row(20, '2'), row(32, '4')]), /52 cards, needs 60/), 'deck size: short lists fail (the 52 and 55 card lists)');
assert.ok(has(run([row(28, '2'), row(36, '4')]), /64 cards, needs 60/), 'deck size: long lists fail (the 64 card lists)');
// Oba's mana: Lightning Helix in a Swamp-Forest deck has no red or white sources.
const oba = run([row(15, '1'), row(15, '2'), row(4, '5'), row(4, '6'), row(22, '4')]);
assert.ok(has(oba, /Lightning Helix needs \{R\} and nothing in the deck makes it/), 'mana: uncastable colours fail');
// Out-of-era printing and restricted copies.
assert.ok(has(run([row(24, '2'), row(4, '9'), row(32, '4')]), /era: Later Card from y/), 'era: sets outside the act fail');
assert.ok(has(run([row(24, '1'), row(2, '7'), row(34, '6')]), /Mox Jet is restricted/), 'restricted cards: max one');
// No way to win.
assert.ok(has(run([row(24, '3'), row(36, '8')]), /no clear way to win/), 'win: a deck of prevention spells fails');
// Labels: no label fails, Exact must match the original, and every change must be explained.
assert.ok(has(checkDeck({cards: [row(24, '2'), row(36, '4')]}, {pool, act}), /label: needs/), 'label required');
const original = {source: 'test', list: '24 Forest\n4 Grizzly Bears\n4 Black Knight'};
assert.ok(has(run([row(24, '2'), row(36, '4')], {label: 'exact', original}), /called Historical Exact but differs/), 'exact must match');
assert.ok(has(run([row(24, '2'), row(36, '4')], {original}), /silent change, Black Knight 4 -> 0/), 'no silent substitution');
assert.ok(!has(run([row(24, '2'), row(36, '4')], {original, changes: [{from: '4 Black Knight', to: 'Grizzly Bears', why: 'test'}, {from: '4 Grizzly Bears', to: '36', why: 'test'}]}), /silent/), 'explained changes pass');
assert.ok(has(run([row(24, '2'), row(36, '4')], {label: 'experimental'}), /Experimental decks say which special rules/), 'experimental needs its rules');
// A partial original only compares the names it lists.
assert.deepEqual(diffLists('4 Black Knight', [{qty: 4, name: 'Black Knight'}, {qty: 56, name: 'Forest'}], true), []);
console.log('story deck gates: ok');
