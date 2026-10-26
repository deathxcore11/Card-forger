import test from 'node:test';
import assert from 'node:assert/strict';
import { glyphFor, manaColors, surfaceColors, frameTone } from './play-token-art.js';
import { tokenColors } from './experiments/forge-proof/forge-session.mjs';
import { battlefieldPiles } from './experiments/phase-engine/match-table.mjs';
import { nativeActionLabel } from './experiments/forge-proof/native-panel.mjs';

test('token crests follow the type line, most specific kind first', () => {
  assert.equal(glyphFor('Token Artifact — Treasure'), 'gem');
  assert.equal(glyphFor('Token Creature — Zombie Soldier'), 'skull');
  assert.equal(glyphFor('Token Creature — Soldier'), 'shield');
  assert.equal(glyphFor('Token Creature — Saproling'), 'leaf');
  assert.equal(glyphFor('Creature — Elf Archer'), 'leaf');
  assert.equal(glyphFor('Token Creature — Thopter'), 'wing');
  assert.equal(glyphFor('Creature — Horse'), 'sword');
  assert.equal(glyphFor('Basic Land — Forest'), 'peak');
  assert.equal(glyphFor(''), 'spark');
  assert.equal(glyphFor(undefined), 'spark');
});

test('frame colors come from the printing, then the token, then the mana cost', () => {
  assert.deepEqual(manaColors('{1}{R}{W}'), ['W', 'R']);
  assert.deepEqual(manaColors('{G/U}{G}'), ['U', 'G']);
  assert.deepEqual(manaColors('{3}'), []);
  assert.deepEqual(surfaceColors({ manaCost: '{R}' }, { type_line: 'Creature — Human', colors: ['W'] }), ['W']);
  assert.deepEqual(surfaceColors({}, { type_line: 'Land', colors: [], color_identity: ['R', 'W'] }), ['W', 'R']);
  assert.deepEqual(surfaceColors({ tokenColors: ['G'] }, null), ['G']);
  assert.deepEqual(surfaceColors({ manaCost: '{1}{G}' }, null), ['G']);
  assert.deepEqual(surfaceColors({ manaCost: '{2}' }, null), []);
  assert.equal(surfaceColors({}, null), null);
  assert.equal(frameTone(null), null);
  assert.equal(frameTone([]).key, 'C');
  assert.equal(frameTone(['W', 'U', 'B']).key, 'M');
  assert.deepEqual(frameTone(['W', 'R']), { key: 'WR', a: '#efe3bd', b: '#d6503a' });
});

test("a token's colors are read from Forge's image key only when it names them", () => {
  assert.deepEqual(tokenColors('t:w_1_1_soldier'), ['W']);
  assert.deepEqual(tokenColors('t:c_a_treasure_sac'), []);
  assert.deepEqual(tokenColors('t:wb_1_1_spirit_flying'), ['W', 'B']);
  assert.equal(tokenColors('MOM/123'), null);
  assert.equal(tokenColors(undefined), null);
});

test('identical permanents share a pile; any visible difference splits one out', () => {
  const soldier = id => ({ id, known: true, name: 'Soldier', controller: 1, isToken: true, tapped: false, power: 1, toughness: 1, type: 'Token Creature — Soldier' });
  const cards = [soldier(1), soldier(2), { ...soldier(3), tapped: true }, soldier(4), { ...soldier(5), counters: { P1P1: 1 } }, { id: 6, known: false }, { id: 7, known: false }];
  assert.deepEqual(battlefieldPiles(cards).map(pile => pile.map(c => c.id)), [[1, 2, 4], [3], [5], [6], [7]]);
});

test("Forge's generic buttons are named for what they do; other labels stay verbatim", () => {
  const n = (extra = {}) => ({ viewer: 1, activePlayer: 1, phase: 'MAIN1', inputType: 'InputPassPriority', stack: [], players: [{ id: 1, zones: { Battlefield: { cards: [{ attacking: true }, { attacking: true }, { blocking: true }] } } }], ...extra });
  assert.equal(nativeActionLabel(n(), 'ok', 'OK'), 'Next: Combat');
  assert.equal(nativeActionLabel(n(), 'cancel', 'End Turn'), 'End turn');
  assert.equal(nativeActionLabel(n({ stack: [{}] }), 'ok', 'OK'), 'Pass · let it resolve');
  assert.equal(nativeActionLabel(n({ activePlayer: 2 }), 'ok', 'OK'), 'Pass');
  assert.equal(nativeActionLabel(n({ inputType: 'InputAttack' }), 'ok', 'OK'), 'Attack with 2');
  assert.equal(nativeActionLabel(n({ inputType: 'InputBlock' }), 'ok', 'OK'), 'Confirm 1 block');
  assert.equal(nativeActionLabel(n({ inputType: 'InputPayManaOfCostPayment' }), 'ok', 'Auto'), 'Pay automatically');
  assert.equal(nativeActionLabel(n({ inputType: 'InputSelectTargets' }), 'ok', 'OK'), 'Confirm targets');
  assert.equal(nativeActionLabel(n({ inputType: 'InputConfirmMulligan' }), 'ok', 'Keep'), 'Keep');
});
