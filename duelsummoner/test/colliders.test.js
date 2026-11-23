// Solid scenery: tree trunks and big boulders are pillars the duelist slides along, the same places the view draws, deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { scatterStage } from '../src/gen/scatter.js';
import { CFG } from '../src/data/config.js';

const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
test('scatter: the same map gives the same places, and the solid-only call matches the full one for trees and rocks', () => {
  const g = new Game(5, { mode: 'run', duelist: 'kael' }), a = scatterStage(g.map, 0, false), b = scatterStage(g.map, 0, false), s = scatterStage(g.map, 0, true);
  assert.deepEqual(a, b); assert.deepEqual(a.trees, s.trees); assert.deepEqual(a.rocks, s.rocks); assert.ok(a.trees.flat().length > 30 && a.rocks.flat().length > 10, 'trees ' + a.trees.flat().length);
  assert.ok(a.grass.length > 100 && a.flowers.length > 0);
});
test('colliders: running at a trunk stops at its surface and slides along it, never through', () => {
  const g = new Game(5, { mode: 'run', duelist: 'kael' }); g.god = true; const c = g.colliders.list.find(k => k.r < 0.7 && k.top - k.y > 2 && Math.abs(k.x) < 150 && Math.abs(k.z) < 150); assert.ok(c, 'a tree trunk');
  const p = g.p; p.x = c.x - 3; p.z = c.z + 0.25; p.y = c.y; p.vx = p.vz = 0; p.grounded = true; let minD = 1e9, zStart = p.z;
  for (let i = 0; i < 120; i++) { g.step(1 / 60, { ...idle, f: 1, yaw: -Math.PI / 2 }); minD = Math.min(minD, Math.hypot(p.x - c.x, p.z - c.z)); }
  assert.ok(minD >= c.r + CFG.player.radius - 0.02, 'never inside the trunk: ' + minD.toFixed(2) + ' vs ' + (c.r + CFG.player.radius).toFixed(2));
  assert.ok(Math.abs(p.z - zStart) > 0.3, 'slid sideways round it: dz ' + (p.z - zStart).toFixed(2)); assert.ok(p.x > c.x - 4, 'and kept moving, not stuck');
});
test('colliders: a jump clears a big boulder, and colliders are the same on two runs of the same seed', () => {
  const g1 = new Game(7, { mode: 'run', duelist: 'kael' }), g2 = new Game(7, { mode: 'run', duelist: 'kael' }); assert.deepEqual(g1.colliders.list, g2.colliders.list);
  const r = g1.colliders.list.find(k => k.r > 1.2 && k.top - k.y < 2.0); if (r) { g1.god = true; const p = g1.p; p.x = r.x; p.z = r.z; p.y = r.top + 0.5; p.vx = p.vz = 0; p.grounded = false; p.vy = 0; g1.step(1 / 60, idle); assert.ok(Math.hypot(p.x - r.x, p.z - r.z) < 0.5, 'not shoved out while above it'); }
});

test('colliders: enemies are blocked by trunks and boulders too, and the flow field routes round them', () => {
  const g = new Game(5, { mode: 'run', duelist: 'kael' }); g.god = true; const c = g.colliders.list.find(k => k.r < 1.0 && k.top - k.y > 2 && Math.abs(k.x) < 150 && Math.abs(k.z) < 150);
  const p = g.p; p.x = c.x + 9; p.z = c.z; p.y = c.y; p.vx = p.vz = 0;                       // the duelist stands 9 m behind the trunk
  const e = g.en; const n = 40; for (let k = 0; k < n; k++) { e.alive[k] = 1; e.kind[k] = 0; e.hp[k] = 1e6; e.x[k] = c.x - 4 - (k % 5); e.z[k] = c.z + (k - 20) * 0.1; e.y[k] = c.y; }
  let worst = 1e9; for (let i = 0; i < 360; i++) { p.x = c.x + 9; p.z = c.z; g.step(1 / 60, { ...idle }); for (let k = 0; k < n; k++) if (e.alive[k]) worst = Math.min(worst, Math.hypot(e.x[k] - c.x, e.z[k] - c.z) - c.r); }
  assert.ok(worst > 0.7 - 0.12, 'no enemy inside the trunk (closest surface gap ' + worst.toFixed(2) + ' m)');
});
