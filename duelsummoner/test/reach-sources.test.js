// Reach sources (step 12b): Widening Rite (+20% area a level, five levels) and Surveyor's Lens (+10% each) both feed the one stat, and the one cap (+150% area, radius x1.58) holds however they stack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { recompute } from '../src/sim/field.js';
import { K } from '../src/data/tuning.js';
import { SPELLS } from '../src/data/cards.js';
import { ITEMS } from '../src/data/items.js';

const run = (spellLv, lenses) => { const g = new Game(3, { mode: 'run', duelist: 'kael', offers: false }); if (spellLv) g.field.spells[0] = { id: 'widening-rite', level: spellLv, cd: 0, rootFx: 0 }; for (let i = 0; i < lenses; i++) g.items.push('surveyors-lens'); recompute(g); return g; };
test('the sources exist as data, with the numbers asked for', () => {
  assert.equal(SPELLS['widening-rite'].per.reach, 0.2); assert.equal(ITEMS['surveyors-lens'].mods.reach, 0.1); assert.equal(K.reachCap, 1.5);
});
test('no source: Reach is 0 and the factor is 1', () => { const g = run(0, 0); assert.equal(g.mods.reach, 0); assert.equal(g.reachK, 1); });
test('Widening Rite: +20% area per level, +100% at level 5 (radius x1.41)', () => {
  for (let lv = 1; lv <= 5; lv++) assert.ok(Math.abs(run(lv, 0).mods.reach - 0.2 * lv) < 1e-9, 'level ' + lv);
  assert.ok(Math.abs(run(5, 0).reachK - Math.sqrt(2)) < 1e-9);
});
test('Surveyor\'s Lens stacks +10% each', () => { assert.ok(Math.abs(run(0, 3).mods.reach - 0.3) < 1e-9); });
test('both sources stacked: the build reaches the +150% cap and never passes it', () => {
  assert.ok(Math.abs(run(5, 5).mods.reach - 1.5) < 1e-9); assert.ok(Math.abs(run(5, 5).reachK - Math.sqrt(2.5)) < 1e-9);
  const over = run(5, 30); assert.equal(over.mods.reach, K.reachCap); assert.equal(over.reachK, Math.sqrt(1 + K.reachCap)); assert.ok(over.mods.raw.reach > K.reachCap, 'the raw sum is kept for the stat panel');
});
