import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { loadStageMap } from '../src/sim/stages.js'; import { heightAt } from '../src/sim/terrain.js';
import { bakeTufts, tuftOk, SLOPE_NEAR, grassRadius } from '../src/gen/tufts.js';
// Grass on foot (the device report: tufts floating on cliff faces): every tuft stands on flat open ground, its base is the ground height, and the pattern is the same every time.
const mk = (seed, stage) => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.stage = stage; loadStageMap(g, stage); return g; };
test('tufts: base on the ground, no slope over the limit, never on a wall, never near a ledge, stable', () => {
  for (const [seed, stage] of [[1, 0], [2, 1], [3, 2]]) {
    const g = mk(seed, stage), a = bakeTufts(g.map, null, heightAt, 190), b = bakeTufts(g.map, null, heightAt, 190);
    assert.ok(a.length / 4 > 800, 'stage ' + (stage + 1) + ' has tufts: ' + a.length / 4); assert.deepEqual(Array.from(a), Array.from(b), 'the pattern is seeded and stable');
    let worst = 0, steep = 0, wall = 0;
    for (let k = 0; k < a.length; k += 4) {
      const x = a[k], y = a[k + 1], z = a[k + 2], h = heightAt(x, z); worst = Math.max(worst, Math.abs(y - h)); if (h >= 50) wall++;
      for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) { const q = heightAt(x + dx, z + dz); if (q >= 50) wall++; else if (Math.abs(q - h) > SLOPE_NEAR + 1e-9) steep++; }
      for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) if (heightAt(x + dx, z + dz) >= 50) wall++;
    }
    assert.ok(worst <= 0.05, 'tuft base off the ground by ' + worst); assert.equal(steep, 0, 'tufts on a slope over the limit'); assert.equal(wall, 0, 'tufts on or beside a wall');
  }
});
test('a tuft that enters the draw radius is invisible at the edge (scale fade over the last 20%), and the radius reaches past the fog start', () => {
  const fade = (d, R) => { const s = Math.min(1, Math.max(0, (d - R * 0.8) / (R * 0.2))); return 1 - s * s * (3 - 2 * s); };
  for (const fog of [60, 80, 120]) { const R = grassRadius(fog); assert.ok(R >= fog, 'radius ' + R + ' vs fog start ' + fog); assert.ok(fade(R - 0.01, R) < 0.001, 'full size at the edge'); assert.equal(fade(R * 0.8, R), 1); }
  // walk 60 m: no tuft is ever visible at more than 5% scale in the step it first comes inside the radius
  const g = mk(1, 0), a = bakeTufts(g.map, null, heightAt, 190), R = grassRadius(80); let pop = 0, x = g.map.spawn.x, z = g.map.spawn.z;
  const inside = (px, pz) => { const s = new Set(); for (let k = 0; k < a.length; k += 4) { const d = Math.hypot(a[k] - px, a[k + 2] - pz); if (d < R) s.add(k); } return s; };
  let prev = inside(x, z); for (let i = 1; i <= 60; i++) { x += 1; const cur = inside(x, z); for (const k of cur) if (!prev.has(k) && fade(Math.hypot(a[k] - x, a[k + 2] - z), R) > 0.05) pop++; prev = cur; }
  assert.equal(pop, 0, 'tufts popped in at full size');
});
