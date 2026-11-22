// The Ledger, phase 1: level, form and tier multipliers, brackets with ceilings, and the hit flags the view reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { K } from '../src/data/tuning.js';
import { MONSTERS, FUSIONS } from '../src/data/cards.js';
import { damageOf } from '../src/sim/field.js';
import { knee, hyp, lvlMul, formMul, monsterMul, mightBracket, targetBracket, critMul, keenChance, guardMit, procChance } from '../src/sim/ledger.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { damageEnemy } from '../src/sim/combat.js';

test('curves: knee is linear then bounded, hyperbolic curves never pass their caps', () => {
  assert.equal(knee(0.5, 1, 1.5), 0.5); assert.ok(knee(100, 1, 1.5) < 2.5 && knee(100, 1, 1.5) > 2.4);
  for (let s = 0; s < 1000; s += 7) assert.ok(mightBracket(s) <= 1 + K.knee1 + K.kneeK1 + 1e-9, 'Might ends below x3.5');
  for (let s = 0; s < 1000; s += 7) assert.ok(targetBracket(s) <= 1 + K.knee4 + K.kneeK4 + 1e-9);
  assert.ok(Math.abs(guardMit(20) - 0.5) < 1e-9 && guardMit(1e9) <= K.guardCap);
  assert.ok(Math.abs(keenChance(40) - 0.425) < 1e-9);
  assert.ok(procChance(1, 1, 1e9) <= K.procCap, 'a proc roll can never pass the cap'); assert.equal(critMul(1e9), K.critCap);
});

test('level, form and tier: a maxed monster clearly outhits a fresh one, in every card', () => {
  assert.ok(Math.abs(lvlMul(10) - 2.08) < 1e-9); assert.equal(formMul(1), 1); assert.equal(formMul(5), 1.3); assert.equal(formMul(10), 1.7);
  for (const id of [...Object.keys(MONSTERS), ...Object.keys(FUSIONS)]) {
    const d1 = damageOf({ id, level: 1 }), d5 = damageOf({ id, level: 5 }), d10 = damageOf({ id, level: 10 });
    assert.ok(d5 > d1 * 1.5, id + ' level 5 should clearly beat level 1'); assert.ok(d10 > d1 * 3.4, id + ' level 10 should be about x3.5 level 1 (got x' + (d10 / d1).toFixed(2) + ')');
  }
  assert.ok(Math.abs(monsterMul('twinflare-tyrant', 1) - 3.2) < 1e-9, 'a fresh Fusion is tier x3.2');
  assert.ok(damageOf({ id: 'twinflare-tyrant', level: 1 }) > damageOf({ id: 'ember-wyvern', level: 10 }), 'a fresh Fusion starts above a level 10 basic');
});

test('hit events carry crit and element flags for the view', () => {
  const g = new Game(5, { duelist: 'kael', offers: false }); g.spawnAcc = -1e9; spawnEnemy(g, 'husk', { x: 3, z: 0 }); const seen = [];
  g.en.hp.fill(1e9); for (let k = 0; k < 40; k++) damageEnemy(g, 0, 10, { elem: 1 });
  g.drainEvents((t, a, b, c, d) => { if (t === 'hit') seen.push(d); });
  assert.ok(seen.length === 40 && seen.every(f => (f >> 1) === 1), 'every hit says fire'); assert.ok(seen.some(f => (f & 1) === 1), 'some hits are crits (5% chance each)');
});

test('no NaN or Infinity at a million kills and absurd stat values', () => {
  for (const v of [0, 1, 1e3, 1e6, 1e9]) for (const f of [mightBracket, targetBracket, critMul, keenChance, guardMit]) assert.ok(Number.isFinite(f(v)));
  assert.ok(Number.isFinite(damageOf({ id: 'twinflare-tyrant', level: 10 })));
});
