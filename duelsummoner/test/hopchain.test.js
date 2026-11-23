import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { CFG } from '../src/data/config.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
// the spawn hop chain: from the 2.4 m tier the duelist can climb onto the first pad, hop each 2.8 m gap, and a missed hop lands on the tier below
for (const seed of [1, 4242, 31337, 48879]) test('hop chain on seed ' + seed + ': run and jump carry the duelist over every gap, a miss lands on the 2.4 m tier', () => {
  const g = new Game(seed, { mode: 'run', duelist: 'kael' }); g.god = true; const P = g.map.prims;
  const pads = P.filter(p => p.t === 'box' && p.h === 3.6 && !p.deco).map(p => ({ cx: (p.x0 + p.x1) / 2, cz: (p.z0 + p.z1) / 2, w: p.x1 - p.x0, d: p.z1 - p.z0 })); assert.equal(pads.length, 3, 'three pads');
  const cx0 = pads.reduce((a, q) => a + q.cx, 0) / 3, cz0 = pads.reduce((a, q) => a + q.cz, 0) / 3, t2 = P.filter(p => p.t === 'box' && p.h === 2.4 && !p.deco).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - cx0, (a.z0 + a.z1) / 2 - cz0) - Math.hypot((b.x0 + b.x1) / 2 - cx0, (b.z0 + b.z1) / 2 - cz0))[0]; assert.ok(t2, 'the 2.4 m tier');
  // order the pads along the tier's long axis
  const alongX = (t2.x1 - t2.x0) > (t2.z1 - t2.z0); pads.sort((a, b) => alongX ? a.cx - b.cx : a.cz - b.cz);
  const p = g.p, hop1 = (from, to, topY, hold) => {                                              // stand on `from`, run at `to`, jump near its edge
    p.x = from.x; p.z = from.z; p.y = topY; p.vx = p.vz = 0; p.grounded = true; p.vy = 0;
    const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz), yaw = Math.atan2(-dx, -dz); let landed = false, maxY = 0, jumpAt = -99;
    for (let i = 0; i < 180; i++) { const left = Math.hypot(to.x - p.x, to.z - p.z), run = { ...idle, f: 1, yaw, jump: false }; if (Math.hypot(p.x - from.x, p.z - from.z) > (from.pad ? 1.5 : 0.25) && left > 0.2 && p.grounded && i > 2) { run.jump = true; jumpAt = i; } if (i - jumpAt < hold) run.jump = true; g.step(1 / 60, run); maxY = Math.max(maxY, p.y); if (p.grounded && Math.abs(to.x - p.x) <= to.hw && Math.abs(to.z - p.z) <= to.hd && Math.abs(p.y - 3.6) < 0.1) { landed = true; break; } }
    return { landed, maxY, y: p.y };
  };
  const hop = (from, to, topY) => { let best = null; for (let hold = 4; hold <= 26; hold += 2) { const r = hop1(from, to, topY, hold); if (r.landed) return Object.assign(r, { hold }); best = r; } return best; };       // the duelist shortens a jump by letting go early, so a hop works if some hold length lands on the pad
  const centre = pads.map(q => ({ x: q.cx, z: q.cz, hw: q.w / 2, hd: q.d / 2 }));
  // the first pad from the tier floor (a 1.2 m rise)
  const dirx = alongX ? Math.sign(centre[1].x - centre[0].x) : 0, dirz = alongX ? 0 : Math.sign(centre[1].z - centre[0].z);
  const start = { x: centre[0].x - dirx * 3.4, z: centre[0].z - dirz * 3.4 }, r0 = hop(start, centre[0], 2.4); assert.ok(r0.landed, 'tier to first pad: ' + JSON.stringify(r0));
  const r1 = hop({ ...centre[0], pad: true }, centre[1], 3.6); assert.ok(r1.landed, 'pad 1 to pad 2: ' + JSON.stringify(r1));
  const r2 = hop({ ...centre[1], pad: true }, centre[2], 3.6); assert.ok(r2.landed, 'pad 2 to pad 3: ' + JSON.stringify(r2));
  // a missed hop (walk off pad 1 toward pad 2 without jumping) lands on the 2.4 m tier
  p.x = centre[0].x; p.z = centre[0].z; p.y = 3.6; p.grounded = true; p.vx = p.vz = 0; const yaw = Math.atan2(-(centre[1].x - centre[0].x), -(centre[1].z - centre[0].z));
  for (let i = 0; i < 40; i++) g.step(1 / 60, { ...idle, f: 1, yaw }); for (let i = 0; i < 60; i++) g.step(1 / 60, idle);
  assert.ok(Math.abs(p.y - 2.4) < 0.05, 'a miss lands on the tier below, y = ' + p.y.toFixed(2));
});











