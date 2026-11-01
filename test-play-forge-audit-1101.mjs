// 1 Nov audit fixes: combat damage split, the plain-language match history and the going-first line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { amountsDefault, amountsLegal, nativePromptUnanswerable, seatWords } from './experiments/forge-proof/native-panel.mjs';
import { storyLines } from './experiments/forge-proof/cpu-action-playback.mjs';

const card = id => ({ kind: 'card', id, name: 'C' + id });
const combat = (assign, size) => ({ id: 'p', method: 'assignCombatDamage', supported: true, min: 0, max: size, options: [...Array(size)].map((_, i) => ({ index: i, value: i === assign.defenderIndex ? { kind: 'player', id: 2 } : card(i) })), assign });

test('a double block starts at lethal for each blocker and only legal splits can be sent', () => {
  const p = combat({ amount: 3, lethal: [2, 3], defenderIndex: null, freeDivision: false, maySkip: false }, 2);
  assert.equal(nativePromptUnanswerable(p), false);
  assert.deepEqual(amountsDefault(p), [2, 1]);
  assert.equal(amountsLegal(p, [2, 1]), true);
  assert.equal(amountsLegal(p, [0, 3]), true, 'no damage order: any split among blockers');
  assert.equal(amountsLegal(p, [1, 1]), false, 'must add up');
});

test('trample reaches the player only after every blocker has lethal; deathtouch lethal is 1', () => {
  const p = combat({ amount: 5, lethal: [2, 1, null], defenderIndex: 2, freeDivision: false, maySkip: false }, 3);
  assert.deepEqual(amountsDefault(p), [2, 1, 2]);
  assert.equal(amountsLegal(p, [1, 1, 3]), false);
  assert.equal(amountsLegal(p, [4, 1, 0]), true);
});

test('divided damage respects each limit and at-least-one', () => {
  const p = { id: 'g', method: 'assignGenericAmount', supported: true, options: [{ index: 0, value: card(1) }, { index: 1, value: card(2) }], assign: { amount: 3, maxima: [3, 3], atLeastOne: true, label: 'damage' } };
  assert.deepEqual(amountsDefault(p), [2, 1]);
  assert.equal(amountsLegal(p, [3, 0]), false);
  assert.equal(nativePromptUnanswerable({ ...p, assign: null }), true, 'a malformed prompt still offers Concede');
});

test('the history tells the match in plain words', () => {
  const surface = { seat: 0, players: [{ seat: 0, nativeId: 1 }, { seat: 1, nativeId: 2 }], cards: [{ id: 10, known: true, name: 'Biotech Specialist', type: 'Creature' }, { id: 11, known: true, name: 'Burnished Hart', type: 'Artifact Creature' }] };
  const lines = storyLines([
    { seq: 1, type: 'cast', player: 1, source: { kind: 'card', id: 10 } },
    { seq: 2, type: 'attack', player: 1, attackers: [{ kind: 'card', id: 10, target: { kind: 'player', id: 2 } }] },
    { seq: 3, type: 'block', player: 2, blockers: [{ kind: 'card', id: 11, blocking: 10 }] },
    { seq: 4, type: 'zone', card: { kind: 'card', id: 11 }, from: 'Battlefield', to: 'Graveyard', player: 2 },
  ], surface).map(l => l.text);
  assert.deepEqual(lines, ['You cast Biotech Specialist.', 'You attacked CPU with Biotech Specialist.', 'Burnished Hart blocked Biotech Specialist.', 'Burnished Hart died.']);
});

test('the opening line reads naturally', () => {
  assert.equal(seatWords('You, you are going 2nd'), 'You’re going second.');
});
