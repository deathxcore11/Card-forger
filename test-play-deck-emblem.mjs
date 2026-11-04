// Deck emblems (play-deck-emblem.js): mana colours, the deck's plan in one word, meta archetype, precon.
import assert from 'node:assert/strict';
import {deckEmblem} from './play-deck-emblem.js';
const C = (type, cmc, text = '', ci = ['R']) => ({type_line: type, cmc, oracle_text: text, color_identity: ci});
const facts = {
  Bolt: C('Instant', 1, 'Lightning Bolt deals 3 damage to any target.'), Guy: C('Creature — Goblin', 1, 'Haste'),
  Bird: C('Creature — Bird', 2, 'Flying', ['U']), Nope: C('Instant', 2, 'Counter target spell.', ['U']),
  Leech: C('Creature — Vampire', 2, 'Whenever this creature attacks, each opponent loses 1 life and you gain 1 life.', ['B']),
  Wrath: C('Sorcery', 4, 'Destroy all creatures.', ['W']), Kill: C('Instant', 2, 'Destroy target creature.', ['W']), Think: C('Instant', 2, 'Draw two cards.', ['U']),
  Bear: C('Creature — Bear', 2, '', ['G']), Elf: C('Creature — Elf', 1, '{T}: Add {G}.', ['G']), Big: C('Creature — Dinosaur', 6, 'Trample', ['G']), Grow: C('Sorcery', 2, 'Search your library for a basic land card, put it onto the battlefield tapped.', ['G']),
};
const of = n => facts[n] || null, deck = (...rows) => rows.map(([name, qty]) => ({name, qty}));
assert.equal(deckEmblem(deck(['Mountain', 20], ['Bolt', 16], ['Guy', 24]), of).style, 'Burn');
assert.equal(deckEmblem(deck(['Island', 24], ['Bird', 24], ['Nope', 12]), of).style, 'Tempo');
assert.equal(deckEmblem(deck(['Swamp', 24], ['Leech', 20], ['Guy', 16]), of).style, 'Drain');
assert.equal(deckEmblem(deck(['Plains', 13], ['Island', 13], ['Wrath', 8], ['Kill', 12], ['Think', 10], ['Nope', 4]), of).style, 'Control');
assert.equal(deckEmblem(deck(['Forest', 22], ['Elf', 8], ['Grow', 8], ['Big', 22]), of).style, 'Ramp');
assert.equal(deckEmblem(deck(['Mountain', 20], ['Guy', 40]), of).style, 'Aggro');
assert.deepEqual(deckEmblem(deck(['Plains', 12], ['Island', 12], ['Kill', 4]), of).colors, ['W', 'U'], 'colours from cards and basics');
assert.equal(deckEmblem(deck(['Forest', 24], ['Unknown', 36]), of).style, '', 'no style until most cards are known');
// Meta: close to a tournament list of its format, by shared cards.
const mine = deck(['Mountain', 20], ['Bolt', 16], ['Guy', 24]);
assert.equal(deckEmblem(mine, of, [{archetype: 'Mono-Red Aggro', cards: deck(['Bolt', 16], ['Guy', 20])}, {archetype: 'Other', cards: deck(['Bird', 30])}]).meta, 'Mono-Red Aggro');
assert.equal(deckEmblem(mine, of, [{archetype: 'Other', cards: deck(['Bird', 30])}]).meta, '', 'no close list, no meta line');
// Precon: bought precons keep their real printings on every row.
assert.equal(deckEmblem(mine.map(r => ({...r, set: 'fdn', number: '1'})), of).precon, true);
assert.equal(deckEmblem(mine, of).precon, false);
console.log('play deck emblem ok');
