// Launch test (world v3 section 7): 20 dune crests on each of two seeds, ridden straight at from 30 m back with the stick forward, the ollie held and let go
// by a bot with human timing (aiming 0.1 s before the lip, give or take 0.15 s). Reports launch height against entry speed and the Perfect Pop rate.
//   node tools/launchtest.mjs [seeds...]
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
import { lipAhead } from '../src/sim/ride.js';
const seeds = process.argv.slice(2).map(Number).filter(Boolean); if (!seeds.length) seeds.push(21, 77);
const I = { f: 1, r: 0, yaw: 0, jump: false };
const out = []; let rnd = 12345; const R = () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);
for (const seed of seeds) {
  const g0 = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy', card: true }), sp = g0.map.world.spawn, crests = [];
  for (let k = 0; k < 4000 && crests.length < 20; k++) { const a = R() * 6.283, d = 30 + R() * 260, x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d, ua = R() * 6.283, ux = Math.sin(ua), uz = Math.cos(ua), h = heightAt(x, z);
    if (h > 40) continue; const up = h - heightAt(x - ux * 8, z - uz * 8), dn = h - heightAt(x + ux * 6, z + uz * 6); if (up > 1.2 && dn > 1.2 && crests.every(c => Math.hypot(c.x - x, c.z - z) > 25)) crests.push({ x, z, ux, uz }); }
  for (const c of crests) {
    const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy', card: true }); g.god = true; g.spawnAcc = -1e9; const p = g.p, yaw = Math.atan2(-c.ux, -c.uz);
    p.x = c.x - c.ux * 30; p.z = c.z - c.uz * 30; p.y = heightAt(p.x, p.z); p.grounded = true; p.vx = c.ux * 14; p.vz = c.uz * 14;
    g.step(1 / 60, { ...I, yaw }); if (!p.ride || !p.ride.on) continue; p.ride.heading = Math.atan2(c.ux, c.uz); p.ride.speed = 14;
    const aim = 0.1 + (R() - 0.5) * 0.3; let held = false, popped = null, top = 0;
    for (let t = 0; t < 360; t++) { const r = p.ride, lip = lipAhead(g, p, r); let jump = held;
      if (!popped && p.grounded) { if (!held && Math.hypot(p.x - c.x, p.z - c.z) < 14) held = true; jump = held && !(lip >= 0 && lip <= aim); }
      g.step(1 / 60, { ...I, yaw, jump }); if (!popped && r.lastPop) { popped = r.lastPop; r.lastPop = null; }
      if (popped) { top = Math.max(top, p.y - heightAt(p.x, p.z)); if (p.grounded && t > 5) break; } }
    if (popped) out.push({ seed, speed: +popped.speed.toFixed(1), perfect: popped.perfect, h: +popped.h.toFixed(2), air: +top.toFixed(2) });
  }
}
const n = out.length, perf = out.filter(o => o.perfect).length, bins = {}; for (const o of out) { const b = Math.floor(o.speed / 4) * 4; (bins[b] || (bins[b] = [])).push(o.air); }
console.log(JSON.stringify({ launches: n, perfectRate: +(perf / Math.max(1, n)).toFixed(2), byEntrySpeed: Object.fromEntries(Object.entries(bins).map(([k, v]) => [k + '-' + (+k + 4) + ' m/s', { n: v.length, peakHeight: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) }])) }));
