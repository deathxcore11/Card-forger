// The Chronicle: one page per match, filled from what the table showed (match-facts.js) and kept in the deck record.
import assert from 'node:assert/strict';
import {createMatchFacts} from './match-facts.js';
import {recordMatch, deckRecord, bestMoment, deckChronicles, clock} from './play-match-record.js';

let t = 1000; const facts = createMatchFacts({now: () => t});
const surf = (turn, active, my, opp, power = 3) => ({seat: 0, turn, activeSeat: active, players: [{seat: 0, life: my}, {seat: 1, life: opp}],
  cards: [{id: 1, name: 'Mimeoplasm', zone: 'Battlefield', controller: 0, owner: 0, types: ['Creature'], power, known: true}]});
facts.update(surf(1, 0, 20, 20)); t += 30000;
assert.equal(facts.mark().turn, 1);
facts.update(surf(2, 1, 20, 20)); t += 5000;
facts.update(surf(3, 0, 18, 20, 5)); t += 60000;
facts.update(surf(3, 0, 18, 6, 5)); t += 1000;
facts.update(surf(4, 1, 18, 6, 5));
assert.equal(facts.mark().turn, 2, 'flags the turn being played, by your own turn count');
assert.equal(facts.mark().turn, 2, 'one flag a turn: a second tap replaces the first');
const c = facts.chronicle();
assert.equal(c.swing.dmg, 14); assert.equal(c.swing.n, 2); assert.equal(c.swing.who, 'you');
assert.equal(c.longest.who, 'you'); assert.equal(c.longest.n, 2); assert.ok(c.longest.ms >= 60000);
assert.deepEqual(c.standout, {name: 'Mimeoplasm', power: 5});
assert.equal(c.moments.length, 1 + 1);
assert.equal(c.moments[0].board[0], 'Mimeoplasm');
assert.equal(Object.keys(facts.snapshot()).includes('moments'), false, 'deed facts stay unchanged');
assert.equal(clock(501000), '8:21');

const store = new Map(), storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
const deck = {id: 7, name: 'Mimeo'};
assert.equal(bestMoment(deck, {storage}), null);
recordMatch({outcome: 'win', deck, opponent: {name: 'CPU'}, turns: 7, chronicle: c}, {storage});
recordMatch({outcome: 'loss', deck, opponent: {name: 'CPU'}, turns: 5, chronicle: {swing: {dmg: 3, who: 'you', n: 1}, moments: [{turn: 2, life: 4, oppLife: 9, board: ['A']}]}}, {storage});
recordMatch({outcome: 'win', deck, chronicle: {junk: 1, swing: {dmg: -4}, standout: {name: 'x'.repeat(500)}}}, {storage});
assert.equal(deckRecord(deck, {storage}).wins, 2);
assert.equal(bestMoment(deck, {storage}), '14 damage in one turn');
const rows = deckChronicles(deck, {storage});
assert.equal(rows.length, 3); assert.equal(rows[0].outcome, 'win');
assert.equal(rows[0].chronicle.swing, null, 'a negative swing is dropped');
assert.equal(rows[0].chronicle.standout.name.length, 80);
console.log('match chronicle ok');
