// Launch and landing check for the riding landforms: every step-down near the start of each seed is ridden at 12, 18 and 24 m/s in the real sim. A launch passes when the card lands
// on a slope (or from under 4 m of air), the rider stays on the card, and nothing bails.   node tools/landcheck.mjs [seeds=8]
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
const N = +process.argv[2] || 8, I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
let runs = 0, ok = 0, flatHigh = 0, bails = 0, noAir = 0, maxAir = 0; const fails = [];
for (let s = 0; s < N; s++) {
  const seed = 3000 + s * 131, g0 = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }), W = g0.map.world, sp = W.spawn;
  const S = W.landSites(2, sp.x - 2500, sp.z - 2500, sp.x + 2500, sp.z + 2500).filter(st => { for (let a = -st.L1 - 14; a < 4 + st.L2 + 20; a += 6) { const x = st.x + st.c * a, z = st.z + st.s * a, C = W.cell(Math.floor(x / 256), Math.floor(z / 256)); if (C.blocks.some(b => Math.hypot(b.cx - x, b.cz - z) < Math.max(b.rx, b.rz) * 1.3 + 8)) return false; } return true; }).slice(0, 6).concat(W.drops.map(d => ({ x: d.x, z: d.z, c: d.c, s: d.s, L1: 30, L2: 58, drop: true }))) ;       // plus the two great drops: approach from 44 m back on the shelf       // a step-down that runs into a mesa or ruin block is the block's cliff, not the landform: counted apart
  for (const st of S) for (const v of [12, 18, 24]) {
    const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9; g.rideKicks = 1; runs++;
    const x0 = st.x - st.c * (st.L1 + 14), z0 = st.z - st.s * (st.L1 + 14); g.p.x = x0; g.p.z = z0; g.p.y = heightAt(x0, z0); g.p.grounded = true; g.p.vx = st.c * v; g.p.vz = st.s * v; g.p.vy = 0;
    const yaw = Math.atan2(-st.c, -st.s); let air = 0, top = -1e9, landY = 0, landSlope = 0, wasAir = false, bailed = false, vert = false, vmax = 0;
    g.step(1 / 60, { ...I, f: 1, yaw }); if (g.p.ride) g.p.ride.speed = v;
    for (let i = 0; i < 240; i++) { g.step(1 / 60, { ...I, f: 1, yaw }); const r = g.p.ride; if (!r || !r.on) break; if (r.bailT > 0) bailed = true; if (r.vert) { vert = true; r.vert = false; } vmax = Math.max(vmax, g.p.vy);
      if (!g.p.grounded) { wasAir = true; top = Math.max(top, g.p.y); } else if (wasAir) { wasAir = false; const h0 = heightAt(g.p.x, g.p.z), h1 = heightAt(g.p.x + Math.sin(r.heading) * 1.5, g.p.z + Math.cos(r.heading) * 1.5); landY = h0; landSlope = (h1 - h0) / 1.5; air = Math.max(air, top - landY); top = -1e9; const along = (g.p.x - st.x) * st.c + (g.p.z - st.z) * st.s; if (along > -2) break; } if ((g.p.x - st.x) * st.c + (g.p.z - st.z) * st.s > 4 + st.L2 + 20) break; }       // the first landing past the lip, and nothing beyond the run-out
    maxAir = Math.max(maxAir, air); if (air < 0.5) noAir++;
    const flat = air > 4 && Math.abs(landSlope) < 0.08; if (flat) flatHigh++; if (bailed) bails++;
    if (!flat && !bailed) ok++; else fails.push({ seed, v, air: +air.toFixed(1), slope: +landSlope.toFixed(2), bailed, vert, vy: +vmax.toFixed(1) });
  }
}
console.log(JSON.stringify({ seeds: N, note: 'sites clear of blocks only', runs, pass: ok, flatLandingsFromOver4m: flatHigh, bails, noAir, maxAir: +maxAir.toFixed(1), fails: fails.slice(0, 8) }));
