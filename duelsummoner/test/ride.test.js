import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
import { RIDE, comboValue, flowOf } from '../src/sim/ride.js';
import { railsNear } from '../src/sim/rails.js';
import { spawnEnemy } from '../src/sim/enemies.js';
const STEP = 1 / 60, I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
const mk = () => { const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9; return g; };
const run = (g, n, cmd) => { for (let i = 0; i < n; i++) g.step(STEP, typeof cmd === 'function' ? cmd(i) : cmd || I); };
// find flat ground near the start to ride on
function flatSpot(g) { for (let r = 30; r < 600; r += 7) for (let a = 0; a < 6.28; a += 0.3) { const x = g.p.x + Math.cos(a) * r, z = g.p.z + Math.sin(a) * r, h = heightAt(x, z); let ok = h < 50; for (let k = 1; k <= 30 && ok; k++) if (Math.abs(heightAt(x, z - k) - h) > 0.25 * k / 10 + 0.15) ok = false; if (ok) return [x, z]; } return [g.p.x, g.p.z]; }
const place = (g, x, z, speed) => { g.p.x = x; g.p.z = z; g.p.y = heightAt(x, z); g.p.grounded = true; g.p.vx = 0; g.p.vz = -speed; g.p.vy = 0; };

test('ride: above 10.5 m/s the duelist steps on the card; below 7 m/s on the ground steps off', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 13); run(g, 2, { ...I, f: 1 }); assert.ok(g.p.ride && g.p.ride.on, 'riding'); 
  place(g, x, z, 5); g.p.ride.speed = 5; run(g, 3); assert.equal(g.p.ride.on, false, 'stepped off');
});
test('ride: hold jump to crouch, release to pop: a short tap about 2.2 m, a full half-second crouch about 4.5 m', () => {
  for (const [hold, lo, hi] of [[1, 1.8, 2.8], [32, 3.8, 5.0]]) {
    const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 }); const y0 = g.p.y; let top = y0;
    run(g, hold, { ...I, f: 1, jump: true }); run(g, 70, i => { top = Math.max(top, g.p.y); return { ...I, f: 1 }; });
    assert.ok(top - y0 > lo && top - y0 < hi, 'hold ' + hold + ' ticks: ' + (top - y0).toFixed(2) + ' m');
  }
});
test('ride: a flip in the air landed clean banks a combo, slams and raises Flow; landing mid-flip bails and costs a Flow step', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 });
  for (let i = 0; i < 6; i++) spawnEnemy(g, 'husk', { x: g.p.x + 2 + i * 0.5, z: g.p.z - 6 });
  const k0 = g.kills; run(g, 30, { ...I, f: 1, jump: true }); run(g, 2, { ...I, f: 1 }); run(g, 1, { ...I, f: 1, dash: true }); run(g, 120, { ...I, f: 1 });
  const F = flowOf(g); assert.ok(F.banked > 0, 'banked ' + F.banked); assert.ok(F.slams >= 1, 'a slam'); assert.ok(g.kills > k0, 'the slam killed');
  F.step = 3; place(g, g.p.x, g.p.z, 14); run(g, 2, { ...I, f: 1 }); run(g, 30, { ...I, f: 1, jump: true }); run(g, 200, i => ({ ...I, f: 1, slide: i < 120 }));
  assert.ok(F.step <= 2, 'a grab held into the landing bails: Flow ' + F.step);
});
test('ride: rails exist (beams, card tops, mesa rims), the card snaps onto one in reach and grinds along it', () => {
  const g = mk(); let rail = null; for (let r = 20; r < 1500 && !rail; r += 40) { const L = railsNear(g, g.p.x + r, g.p.z, 60); rail = L.find(s => Math.hypot(s[3] - s[0], s[5] - s[2]) > 5 && Math.abs(s[4] - s[1]) < 1 && s[1] < 30); }
  assert.ok(rail, 'a rail');
  const mx = (rail[0] + rail[3]) / 2, mz = (rail[2] + rail[5]) / 2, my = (rail[1] + rail[4]) / 2, ux = (rail[3] - rail[0]), uz = (rail[5] - rail[2]), L = Math.hypot(ux, uz);
  g.p.ride = undefined; g.p.x = mx - ux / L * 1.5; g.p.z = mz - uz / L * 1.5; g.p.y = my + 1.0; g.p.vx = ux / L * 12; g.p.vz = uz / L * 12; g.p.vy = -1; g.p.grounded = false;
  // force the ride on, already airborne
  run(g, 1); if (!g.p.ride || !g.p.ride.on) { g.p.ride.on = true; g.p.ride.speed = 12; g.p.ride.heading = Math.atan2(g.p.vx, g.p.vz); }
  let ground = false; run(g, 20, i => { if (g.p.ride.grind) ground = true; return { ...I, use: i === 0 }; });
  assert.ok(ground, 'snapped onto the rail');
});
