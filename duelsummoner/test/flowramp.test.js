import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { Flow } from '../src/sim/flow.js'; import { heightAt } from '../src/sim/terrain.js';

test('flow field: enemies on the ground have a route up a 1:2 ramp to a 3 m plateau (a per-edge pass mask from the 1 m lanes, not whole-cell heights)', () => {
  for (const seed of [1, 3, 7]) {
    const g = new Game(seed, { mode: 'run', duelist: 'kael', oldGen: true }), spots = [];
    for (let x = -190; x < 190; x += 4) for (let z = -190; z < 190; z += 4) { const h = heightAt(x, z); if (h > 2.2 && h < 3.6 && [-1, 0, 1].every(a => [-1, 0, 1].every(b => Math.abs(heightAt(x + a * 2, z + b * 2) - h) < 0.1))) spots.push([x, z]); }
    assert.ok(spots.length > 20, 'seed ' + seed + ' has plateaus');
    const f = new Flow(); f.col = g.colliders; f.rebuild(); let reach = 0, tot = 0; const o = {}, n = Math.min(spots.length, 12);
    for (let s = 0; s < n; s++) { const [px, pz] = spots[Math.floor(s * spots.length / n)]; f.update(px, pz); for (let a = -30; a <= 30; a += 4) for (let b = -30; b <= 30; b += 4) { const x = px + a, z = pz + b; if (Math.hypot(a, b) < 14 || heightAt(x, z) > 0.2) continue; tot++; if (f.next(x, z, o)) reach++; } }
    assert.ok(reach / tot >= 0.8, 'seed ' + seed + ': ' + Math.round(reach / tot * 100) + '% of nearby ground has a route up');
  }
});
