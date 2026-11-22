// The SCALE table: one place for sizes; the sim and the view both read it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCALE, summonSize, specialSize, DUELIST_H } from '../src/data/scale.js';
import { KINDS } from '../src/data/enemies.js';
import { STAGES } from '../src/data/stages.js';
import { Game } from '../src/sim/game.js';
import { spawnSpecial } from '../src/sim/specials.js';

test('swarm is 0.6 to 1.0x the duelist and its radii come from the table', () => {
  for (const [k, v] of Object.entries(SCALE.swarm)) { assert.ok(v.h >= 0.6 * DUELIST_H - 1e-9 && v.h <= 1.0 * DUELIST_H + 1e-9, k + ' height ' + v.h); assert.equal(KINDS[k].radius, v.r, k + ' radius is the table value'); }
});
test('summons: form 1 / 2 / 3 = 0.5x / 1x / 2x, Fusions 2x to 3x, God Fusion 4x', () => {
  assert.deepEqual(SCALE.summonForm, [0.9, 1.8, 3.6]); assert.ok(SCALE.fusionForm.every(h => h >= 3.6 && h <= 5.4)); assert.equal(SCALE.godForm[0], 7.2);
  assert.equal(summonSize(false, 2), 3.6); assert.equal(summonSize(true, 0), 3.6);
});
test('elites 1.5-2x, timed bosses 3-5x, gate bosses 6-10x; every stage event has an entry', () => {
  for (const S of STAGES) { for (const ev of S.timeline) { const h = SCALE.special[ev.id].h / DUELIST_H; if (ev.role === 'elite') assert.ok(h >= 1.5 && h <= 2.05, ev.id + ' ' + h); else assert.ok(h >= 3 && h <= 5.05, ev.id + ' ' + h); }
    const gh = SCALE.special[S.gate.id].h / DUELIST_H; assert.ok(gh >= 6 && gh <= 10.05, S.gate.id + ' ' + gh); }
});
test('a big boss is big in the sim: hit radius, slam and reach follow the size, walk radius is capped', () => {
  const g = new Game(3, { mode: 'run', offers: false }); const w = STAGES[0].timeline[1], h = STAGES[0].timeline[0];
  spawnSpecial(g, h, { x: 20, y: 0, z: 0 }); spawnSpecial(g, w, { x: 30, y: 0, z: 0 });
  const elite = g.sp[0], boss = g.sp[1];
  assert.ok(boss.radius > elite.radius && boss.size > elite.size); assert.ok(Math.abs(boss.radius - boss.size * SCALE.hitShare) < 1e-6);
  const Z = specialSize('king', 'pharaoh'); assert.ok(Z.radius > 4 && Z.kr <= SCALE.rangeCap && Z.k > Z.kr);
});
