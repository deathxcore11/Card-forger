// Movement flow step 1 (fix list part 5): ramps. The duelist must not pop up a ramp in 0.5 m steps, every body from 0.7 m to 2.2 m radius must be able to climb every ramp it fits on,
// and an uphill dash must still go the full 4 m. Plus the pinned jump distances, so nothing here moves a jump by accident.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { heightAt } from '../src/sim/terrain.js'; import { CFG } from '../src/data/config.js'; import { walk, settle } from '../src/sim/steer.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false };
const YAW = { '+x': -Math.PI / 2, '-x': Math.PI / 2, '+z': Math.PI, '-z': 0 };
const mk = seed => { const g = new Game(seed, { oldGen: true, mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; g.colliders = null; return g; };

// every ramp of a map that has clean flat ground for 6 m before its foot, described by where it starts, which way is up, and its slope
function ramps(g) {
  const out = [];
  for (const p of g.map.prims) {
    if (p.t !== 'ramp' || p.deco) continue;
    const lo = Math.min(p.h0, p.h1), hi = Math.max(p.h0, p.h1), up = p.h1 > p.h0 ? 1 : -1, len = Math.abs(p.a1 - p.a0), slope = (hi - lo) / len, bm = (p.b0 + p.b1) / 2, half = (p.b1 - p.b0) / 2;
    if (hi - lo < 0.8 || slope > 0.55 || lo !== 0) continue;                                          // ground-level ramps only
    const aFoot = up > 0 ? p.a0 : p.a1, dir = (up > 0 ? Math.sign(p.a1 - p.a0) : Math.sign(p.a0 - p.a1)), at = a => (p.axis === 'x' ? [a, bm] : [bm, a]);
    let clean = true; for (let d = 1; d <= 24 && clean; d++) { const [x, z] = at(aFoot - dir * d * 0.25); if (heightAt(x, z) !== 0) clean = false; }          // 6 m of flat ground in front
    for (let k = 0; k <= len && clean; k++) { const [x, z] = at(aFoot + dir * k); for (const o of [-half * 0.6, 0, half * 0.6]) { const [xx, zz] = p.axis === 'x' ? [x, z + o] : [x + o, z]; const want = lo + slope * Math.abs(xx * (p.axis === 'x' ? 1 : 0) + zz * (p.axis === 'z' ? 1 : 0) - aFoot) ; void want; } }
    if (!clean) continue;
    out.push({ p, slope, hi, half, dir, dirName: (p.axis === 'x' ? '' : '') + (dir > 0 ? '+' : '-') + p.axis, at, aFoot, len, bm });
  }
  return out;
}
const sample = (seeds, per) => { const all = []; for (const s of seeds) { const g = mk(s), r = ramps(g); const seen = new Set(); let n = 0; for (const q of r) { const key = q.slope.toFixed(2) + ':' + q.len.toFixed(0); if (seen.has(key) || n >= per) continue; seen.add(key); n++; all.push({ seed: s, ...q }); } } return all; };

test('pinned jumps: standing 5.06 m, running 7.20 m, a short tap 4.65 m (the numbers movement must not change by accident)', () => {
  const jump = (pre, hold) => {
    const g = mk(1), p = g.p; let found = null;
    for (let z0 = 60; z0 > -150 && !found; z0 -= 3) for (let x0 = -120; x0 < 120 && !found; x0 += 3) { let ok = true; for (let d = 0; d < 40 && ok; d++) if (heightAt(x0, z0 - d) !== 0) ok = false; if (ok) found = [x0, z0]; }
    p.x = found[0]; p.z = found[1]; p.y = 0; p.grounded = true; g.step(1 / 60, idle); for (let i = 0; i < pre; i++) g.step(1 / 60, { ...idle, f: 1 });
    const sx = p.x, sz = p.z; let landed = false; for (let i = 0; i < 400 && !landed; i++) { g.step(1 / 60, { ...idle, f: 1, jump: i < hold }); if (p.grounded && i > 3) landed = true; } return Math.hypot(p.x - sx, p.z - sz);
  };
  assert.ok(Math.abs(jump(0, 40) - 5.06) < 0.01, 'standing jump ' + jump(0, 40)); assert.ok(Math.abs(jump(60, 40) - 7.20) < 0.01, 'running jump ' + jump(60, 40)); assert.ok(Math.abs(jump(60, 4) - 4.65) < 0.01, 'a tap ' + jump(60, 4));
});

test('ramps: running up any ramp never pops the duelist up by more than the slope allows (slope x 9/60 + 0.02 a tick)', () => {
  const list = sample([1, 2, 3, 4], 5); assert.ok(list.length >= 6, 'ramps found: ' + list.length); let bad = 0; const lines = [];
  for (const q of list) {
    const g = mk(q.seed), p = g.p, [x0, z0] = q.at(q.aFoot - q.dir * 4); p.x = x0; p.z = z0; p.y = 0; p.grounded = true; g.step(1 / 60, idle);
    const yaw = YAW[q.dirName], lim = q.slope * 9 / 60 + 0.02; let prev = p.y, worst = 0;
    for (let i = 0; i < 60 * (q.len / 6 + 6) && p.y < q.hi - 0.01; i++) { g.step(1 / 60, { ...idle, f: 1, yaw }); worst = Math.max(worst, Math.abs(p.y - prev)); prev = p.y; }
    if (worst > lim) { bad++; lines.push(q.seed + ' slope ' + q.slope.toFixed(2) + ' worst step ' + worst.toFixed(3) + ' > ' + lim.toFixed(3)); }
  }
  assert.equal(bad, 0, bad + ' ramps pop:\n' + lines.join('\n'));
});

test('ramps: bodies of radius 0.7 to 2.2 m climb every ramp they fit on', () => {
  const list = sample([1, 2, 3, 4], 5); assert.ok(list.length >= 6); const fails = [];
  for (const q of list) for (const r of [0.7, 1.2, 1.8, 2.2]) {
    if (q.half < r + 0.3) continue;                                                                    // a ramp narrower than the body is not climbed by it
    const g = mk(q.seed), [x0, z0] = q.at(q.aFoot - q.dir * 4), o = { x: x0, y: 0, z: z0, vy: 0, dx: 0, dz: 0 }, ux = q.p.axis === 'x' ? q.dir : 0, uz = q.p.axis === 'z' ? q.dir : 0, st = { colliders: null };
    let ok = false; for (let i = 0; i < 60 * 40; i++) { walk(st, o, ux, uz, 4.2, 1 / 60, r, CFG.enemy.stepUp); settle(o, 1 / 60); if (o.y >= q.hi - 0.05) { ok = true; break; } }
    if (!ok) fails.push('seed ' + q.seed + ' slope ' + q.slope.toFixed(2) + ' r ' + r + ' stuck at y ' + o.y.toFixed(2) + ' of ' + q.hi);
  }
  assert.equal(fails.length, 0, fails.length + ' climbs fail:\n' + fails.slice(0, 12).join('\n'));
});

test('ramps: 100 dashes uphill reach 4 m, and every dash lasts exactly 9 ticks', () => {
  const list = sample([1, 2, 3, 4, 5, 6], 6); assert.ok(list.length >= 8); let n = 0, short = [], lens = new Set();
  for (let k = 0; n < 100; k++) {
    const q = list[k % list.length], g = mk(q.seed), p = g.p, off = 2 + (k % 5) * 0.4, [x0, z0] = q.at(q.aFoot + q.dir * Math.min(off, q.len - 5)); p.x = x0; p.z = z0; p.y = heightAt(p.x, p.z); p.grounded = true; g.step(1 / 60, idle);
    const yaw = YAW[q.dirName], sx = p.x, sz = p.z; let ticks = 0; g.step(1 / 60, { ...idle, f: 1, yaw, dash: true }); while (p.dashT > 0 && ticks < 30) { ticks++; g.step(1 / 60, { ...idle, f: 1, yaw }); }
    const dist = Math.hypot(p.x - sx, p.z - sz); lens.add(ticks + 1); if (dist < 3.9) short.push(q.seed + ' slope ' + q.slope.toFixed(2) + ' went ' + dist.toFixed(2)); n++;
  }
  assert.equal(short.length, 0, short.length + ' dashes cut short:\n' + short.slice(0, 8).join('\n')); assert.deepEqual([...lens], [9], 'every dash is 9 ticks, saw ' + [...lens]);
});

import { updatePickups } from '../src/sim/weapons.js'; import { dropPickup, PICK_COIN } from '../src/sim/combat.js';
test('magnet curve: a drop 5 m away is collected 0.25 to 0.50 s after its hop (0.41 s is to the centre; collection is at 1.3 m), ignores the magnet for its first 280 ms, and a fast runner cannot outrun it', () => {
  const arrive = (dist, runSpeed) => {
    const g = mk(7), p = g.p; p.x = 0; p.z = 0; p.y = heightAt(0, 0); let fx = 0; for (let x = -90; x < 90 && !fx; x += 2) { let ok = true; for (let d = 0; d < 60 && ok; d++) if (heightAt(x, d) !== 0) ok = false; if (ok) fx = x; } p.x = fx || 0; p.z = 0; p.y = 0; p.vx = p.vz = 0;
    g.pick.alive.fill(0); dropPickup(g, PICK_COIN, p.x, 0, p.z + dist, 1); const i = [...g.pick.alive].findIndex(a => a); let t = 0, started = -1;
    for (let k = 0; k < 600; k++) { p.vz = runSpeed; p.z += runSpeed / 60; t += 1 / 60; const before = g.pick.x[i] * 0 + g.pick.z[i]; updatePickups(g, 1 / 60); if (started < 0 && Math.abs(g.pick.z[i] - before) > 1e-6) started = t; if (!g.pick.alive[i]) return { t, started }; }
    return { t: Infinity, started };
  };
  const a = arrive(4.8, 0); assert.ok(a.started >= 0.27, 'it starts moving at ' + a.started + ' s, not before 0.28'); const flight = a.t - a.started; assert.ok(flight > 0.25 && flight < 0.50, 'arrives ' + flight + ' s after it starts');
  const b = arrive(4.8, 11); assert.ok(b.t < 2.5, 'a drop still catches a duelist running at 11 m/s: ' + b.t);
});

