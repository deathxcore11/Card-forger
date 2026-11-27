// Ramp test: ride straight at kickers from the front and count launches. For each of two seeds, the 20 kickers nearest the start, ridden at 10, 14 or 18 m/s (in turn)
// from 20 m back along the kicker's heading with the stick held forward. A pass is a launch off the lip with at least 0.5 s of air. Quarter pipes and rails are checked the same way.
//   node tools/ramptest.mjs [seeds...]
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
import { kickersNear, quartersNear, railsNear } from '../src/sim/rails.js';
const I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
const seeds = process.argv.slice(2).map(Number).filter(Boolean); if (!seeds.length) seeds.push(21, 77);
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9; g.rideKicks = 1; return g; };
const out = { kickers: { runs: 0, launched: 0, minAir: 99, fails: [] }, quarters: { runs: 0, vert: 0 }, rails: { runs: 0, grind: 0 } };
for (const seed of seeds) {
  const g0 = mk(seed), sp = g0.map.world.spawn; const K = kickersNear(g0, sp.x, sp.z, 900).map(k => [Math.hypot(k[0] - sp.x, k[2] - sp.z), k]).sort((a, b) => a[0] - b[0]).slice(0, 20).map(q => q[1]);
  K.forEach((k, i) => { const v = [10, 14, 18][i % 3], g = mk(seed), [x, y, z, ux, uz, len] = k; g.p.x = x - ux * (len / 2 + 20); g.p.z = z - uz * (len / 2 + 20); g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.sliding = true; g.p.vx = ux * v; g.p.vz = uz * v; const yaw = Math.atan2(-ux, -uz);
    g.step(1 / 60, { ...I, f: 1, yaw }); const R0 = g.p.ride; R0.on = true; R0.heading = Math.atan2(ux, uz); R0.speed = v;       // already on the card at that speed
    let launched = false, air = 0, best = 0; for (let tk = 0; tk < 240; tk++) { g.step(1 / 60, { ...I, f: 1, yaw }); const r = g.p.ride; if (r && r.combo && r.combo.names.Kicker) launched = true; if (launched && !g.p.grounded) { air += 1 / 60; best = Math.max(best, air); } else if (launched && g.p.grounded) break; }
    out.kickers.runs++; if (launched && best >= 0.5) out.kickers.launched++; else out.kickers.fails.push({ seed, i, v, launched, air: +best.toFixed(2) }); if (launched) out.kickers.minAir = Math.min(out.kickers.minAir, +best.toFixed(2)); });
  const Q = quartersNear(g0, sp.x, sp.z, 900).slice(0, 10); Q.forEach(q => { const g = mk(seed), [x, y, z, ux, uz] = q; g.p.x = x - ux * 10; g.p.z = z - uz * 10; g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.sliding = true; g.p.vx = ux * 15; g.p.vz = uz * 15; const yaw = Math.atan2(-ux, -uz); g.step(1 / 60, { ...I, f: 1, yaw }); Object.assign(g.p.ride, { on: true, heading: Math.atan2(ux, uz), speed: 15 }); let vert = false; for (let tk = 0; tk < 120 && !vert; tk++) { g.step(1 / 60, { ...I, f: 1, yaw }); if (g.p.ride && g.p.ride.vert) vert = true; } out.quarters.runs++; if (vert) out.quarters.vert++; });
  const Rr = railsNear(g0, sp.x, sp.z, 400).filter(s => (s[6] === 'ledge' || s[6] === 'pole' || !s[6]) && (s[1] + s[4]) / 2 - heightAt((s[0] + s[3]) / 2, (s[2] + s[5]) / 2) < 2.5).filter(s => Math.hypot(s[3] - s[0], s[5] - s[2]) > 5).slice(0, 10);
  Rr.forEach((s, i) => { const g = mk(seed), L = Math.hypot(s[3] - s[0], s[5] - s[2]), ux = (s[3] - s[0]) / L, uz = (s[5] - s[2]) / L, off = (i % 2 ? 1 : -1) * 1.5; g.p.x = s[0] + ux * 0.5 - uz * off - ux * 8; g.p.z = s[2] + uz * 0.5 + ux * off - uz * 8; g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.sliding = true; g.p.vx = ux * 14; g.p.vz = uz * 14; const yaw = Math.atan2(-ux, -uz); g.step(1 / 60, { ...I, f: 1, yaw }); Object.assign(g.p.ride, { on: true, heading: Math.atan2(ux, uz), speed: 14 });
    let grind = false; for (let tk = 0; tk < 90 && !grind; tk++) { g.step(1 / 60, { ...I, f: 1, yaw, jump: tk > 2 && tk < 14 }); if (g.p.ride && g.p.ride.grind) grind = true; } out.rails.runs++; if (grind) out.rails.grind++; else (out.rails.fails || (out.rails.fails = [])).push({ seed, i, kind: s[6] || "log" }); });
}
console.log(JSON.stringify(out));
// whole lines: from 22 m behind each of the 10 line starts nearest the spawn, ride at 15 m/s with the stick forward for 9 s and list what the card did (no other input)
out.lines = [];
for (const seed of seeds) {
  const g0 = mk(seed), sp = g0.map.world.spawn;
  const S = kickersNear(g0, sp.x, sp.z, 700).filter(q => !kickersNear(g0, q[0] - q[3] * 26, q[2] - q[4] * 26, 6).length && !railsNear(g0, q[0] - q[3] * 26, q[2] - q[4] * 26, 4).some(s => s[6] === 'ledge' || s[6] === 'pole')).map(q => [Math.hypot(q[0] - sp.x, q[2] - sp.z), q]).sort((a, c) => a[0] - c[0]).slice(0, 10).map(a => a[1]);
  for (const q of S) { const g = mk(seed), [x, , z, ux, uz, len] = q; g.p.x = x - ux * (len / 2 + 22); g.p.z = z - uz * (len / 2 + 22); g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.sliding = true; const yaw = Math.atan2(-ux, -uz);
    g.step(1 / 60, { ...I, f: 1, yaw }); Object.assign(g.p.ride, { on: true, heading: Math.atan2(ux, uz), speed: 15 }); const did = []; let n0 = 0;
    for (let tk = 0; tk < 540; tk++) { g.step(1 / 60, { ...I, f: 1, yaw }); const r = g.p.ride, L = (r && r.combo && r.combo.list) || []; if (L.length < n0) n0 = 0; for (let k = n0; k < L.length; k++) did.push(L[k]); n0 = L.length; if (r && r.grind && did[did.length - 1] !== 'grind') did.push('grind'); if (!r || !r.on) { did.push('OFF'); break; } }
    out.lines.push({ seed, did: did.join(' ') }); }
}
console.log(JSON.stringify(out.lines, null, 1));
