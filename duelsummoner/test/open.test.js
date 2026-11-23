import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openMap, ARCHETYPES, analyse } from '../src/gen/open/terrain.js';
import { Game } from '../src/sim/game.js';
import { scatterStage } from '../src/gen/scatter.js';
import { loadMap } from '../src/sim/terrain.js';

const HALF = 200, SIM = 400;
test('open terrain: every archetype makes a square landscape that is mostly open ground, fully reachable, with the rewards the game needs', () => {
  for (const a of ARCHETYPES) for (const seed of [1, 2, 3, 4]) {
    const m = openMap(seed * 7919, 0, a); assert.ok(m, a + ' ' + seed); assert.equal(m.arch, a);
    assert.ok(m.report.openFrac >= 0.6, a + ' open ground ' + m.report.openFrac); assert.ok(m.report.walkFrac >= 0.97, a + ' reachable ' + m.report.walkFrac);
    assert.ok(Math.hypot(m.spawn.x - m.gate.x, m.spawn.z - m.gate.z) >= 180, 'spawn and gate are far apart');
    const by = t => m.encounters.filter(e => e.type === t).length; assert.ok(by('cchest') >= 4 && by('shrine') >= 1 && by('altar') >= 1 && by('stone') >= 1 && by('broker') === 1, a + ' rewards');
    assert.ok(m.encounters.some(e => e.free), 'a free chest near the start'); assert.ok(m.bossRings.length >= 1);
    // no step anywhere: neighbouring playable cells differ by at most 0.55 m except on the steep faces (flank cells)
    let flat = 0, tot = 0; for (let j = 36; j < 364; j++) for (let i = 36; i < 364; i++) { tot++; const h = m.heights[j * SIM + i]; if (Math.abs(h - m.heights[j * SIM + i + 1]) <= 0.55 && Math.abs(h - m.heights[(j + 1) * SIM + i]) <= 0.55) flat++; }
    assert.ok(flat / tot > 0.96, a + ' smooth cells ' + flat / tot);
    for (let k = 0; k < SIM; k++) assert.equal(m.heights[k], 99, 'outside the square is wall');
  }
});
test('open terrain: the same seed gives the same ground, different seeds differ, and it only loads behind the option', () => {
  const a = openMap(12345, 0, 'e'), b = openMap(12345, 0, 'e'), c = openMap(54321, 0, 'e');
  assert.deepEqual(Array.from(a.heights), Array.from(b.heights)); assert.notDeepEqual(Array.from(a.heights), Array.from(c.heights));
  const g = new Game(5, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', arch: 'b' }); assert.equal(g.map.open, true); assert.equal(g.map.arch, 'b');
  const n = new Game(5, { mode: 'run', duelist: 'kael', offers: false }); assert.ok(!n.map.open);
});
test('open terrain: trees stand in woods (never alone), boulders stand at cliff feet, and nothing is built', () => {
  const m = openMap(777, 0, 'a'); loadMap(m); const S = scatterStage(m, 0, true), trees = [].concat(...S.trees);
  assert.ok(trees.length > 80 && trees.length <= 420, 'woods ' + trees.length);
  let lone = 0; for (const t of trees) { let n = 0; for (const o of trees) if (o !== t && Math.hypot(o[0] - t[0], o[2] - t[2]) < 14) n++; if (n < 2) lone++; } assert.ok(lone / trees.length < 0.06, 'lone trees ' + lone);
  assert.equal(m.kits.length, 0); assert.equal((m.props || []).length, 0);
});
