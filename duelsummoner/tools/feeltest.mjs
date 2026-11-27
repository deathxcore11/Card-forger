// Feel numbers from the sim in the ride gym (?gym=1 world, seed 21): time to top speed and to a stop on foot, ollie heights, rail snaps and wall rides over 20 tries each.
//   node tools/feeltest.mjs
import { Game } from '../src/sim/game.js';
import { heightAt, streamTo } from '../src/sim/terrain.js';
import { FEEL } from '../src/data/feel.js';
const I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
const mk = () => { const g = new Game(21, { mode: 'run', duelist: 'kael', terrain: 'open', gym: true, offers: false }); g.god = true; g.rideKicks = 1; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.opts.gym = false; g.spawnAcc = -1e9; return g; };       // (no husks for the measures)
const out = {};
const sp = p => Math.hypot(p.vx, p.vz);
// 1. on foot: from a stand to 95 per cent of top speed, and from top speed to under 0.5 m/s
{ const g = mk(), p = g.p; streamTo(0, -60, 120, 6); p.x = 0; p.z = -60; p.y = heightAt(0, -60); p.vx = p.vz = 0; let t = 0; while (sp(p) < 0.95 * FEEL.foot.top && t < 2) { g.step(1 / 60, { ...I, f: 1, yaw: Math.PI }); t += 1 / 60; } out.footToTop = +t.toFixed(3);
  for (let i = 0; i < 30; i++) g.step(1 / 60, { ...I, f: 1, yaw: Math.PI }); let s = 0; while (sp(p) > 0.5 && s < 2) { g.step(1 / 60, { ...I, yaw: Math.PI }); s += 1 / 60; } out.footToStop = +s.toFixed(3); }
// 2. ollie heights on the card: a tap and a full crouch
const ride = (g, x, z, heading, speed) => { const p = g.p; streamTo(x, z, 120, 6); p.x = x; p.z = z; p.y = heightAt(x, z); p.grounded = true; p.sliding = true; g.step(1 / 60, { ...I, f: 1, yaw: heading + Math.PI }); Object.assign(p.ride, { on: true, heading, speed }); };
for (const [name, hold] of [['ollieTap', 1], ['ollieFull', Math.round(FEEL.ride.crouchMax * 60) + 1]]) { const g = mk(), p = g.p; ride(g, -60, -70, Math.PI / 2, 14); const y0 = p.y; let top = y0;
  for (let i = 0; i < hold; i++) g.step(1 / 60, { ...I, f: 1, yaw: -Math.PI / 2, jump: true }); for (let i = 0; i < 90; i++) { g.step(1 / 60, { ...I, f: 1, yaw: -Math.PI / 2 }); top = Math.max(top, p.y); } out[name] = +(top - y0).toFixed(2); }
// 3. rail snap: the gym rail (x 6.5 to 16.5, z -30, top 0.7 m), approached at 25 degrees from the south-west so the line's kicker is not in the way, aimed 0 to 1.9 m off the rail, at 12 to 18 m/s, the ollie let go 0.3 to 0.6 s before it
{ let ok = 0; const rows = []; for (let k = 0; k < 20; k++) { const g = mk(), p = g.p, off = (k % 10) * 0.19 * (k < 10 ? 1 : -1), v = 12 + (k % 4) * 2, early = 0.3 + (k % 3) * 0.15, a = 25 * Math.PI / 180, hx = Math.cos(a), hz = Math.sin(a), tx = 11.5 - hz * off, tz = -30 + hx * off, back = v * (early + 10 / 60); ride(g, tx - hx * back, tz - hz * back, Math.atan2(hx, hz), v);
  let grind = false; for (let i = 0; i < 150 && !grind; i++) { g.step(1 / 60, { ...I, f: 1, yaw: Math.atan2(hx, hz) + Math.PI, jump: i < 10 }); if (p.ride.grind) grind = true; } if (grind) ok++; rows.push(grind ? 1 : 0); } out.railSnap = ok + ' of 20'; out.railRows = rows.join(''); }
// 4. wall ride: the gym mesa's south face (z 40, x 30 to 42), approached glancing at 15 to 55 degrees at 12 to 20 m/s, an ollie just before
{ let ok = 0; const rows = []; for (let k = 0; k < 20; k++) { const g = mk(), p = g.p, ang = (15 + (k % 5) * 10) * Math.PI / 180, v = 12 + (k % 5) * 2, dir = k < 10 ? 1 : -1, hx = Math.cos(ang) * dir, hz = Math.sin(ang), x0 = 36 - hx * 8, z0 = 40 - hz * 8 - 0.7; ride(g, x0, z0, Math.atan2(hx, hz), v);
  let wall = false; for (let i = 0; i < 120 && !wall; i++) { g.step(1 / 60, { ...I, f: 1, yaw: Math.atan2(hx, hz) + Math.PI, jump: i < 8 }); if (p.ride.wall) wall = true; } if (wall) ok++; rows.push(wall ? 1 : 0); } out.wallRide = ok + ' of 20'; out.wallRows = rows.join(''); }
console.log(JSON.stringify(out, null, 1));
