// How much a rider meets: along 8 straight lines of 600 m from each seed's spawn, the rideable things within 7 m of the line (grind rails of every kind, kickers, seal stones, full pipes), and the mean gap between them in seconds at 14 m/s.
//   node tools/ridecount.mjs [seeds...]
import { Game } from '../src/sim/game.js';
import * as RL from '../src/sim/rails.js';
const { railsNear, sealsNear, pipesNear } = RL, kickersNear = RL.kickersNear;
const seeds = process.argv.slice(2).map(Number).filter(Boolean); if (!seeds.length) seeds.push(21, 4711, 9, 77, 1234, 101);
const out = [];
for (const seed of seeds) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }), sp = g.map.world.spawn; let n = 0; const seen = new Set();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    for (let d = 0; d <= 600; d += 10) { const x = sp.x + c * d, z = sp.z + s * d;
      for (const r of railsNear(g, x, z, 7)) { const key = 'r' + r[0].toFixed(1) + ',' + r[2].toFixed(1); if (!seen.has(key)) { seen.add(key); n++; } }
      for (const q of sealsNear(g, x, z, 7)) { const key = 's' + q[0] + ',' + q[2]; if (!seen.has(key)) { seen.add(key); n++; } }
      for (const q of pipesNear(g, x, z, 7)) { const key = 'p' + q[0] + ',' + q[2]; if (!seen.has(key)) { seen.add(key); n++; } }
      if (kickersNear) for (const q of kickersNear(g, x, z, 7)) { const key = 'k' + q[0] + ',' + q[2]; if (!seen.has(key)) { seen.add(key); n++; } } } }
  out.push({ seed, things: n, everySec: +((8 * 600 / Math.max(1, n)) / 14).toFixed(1) });
}
console.log(JSON.stringify(out)); console.log(JSON.stringify({ meanEverySec: +(out.reduce((s, r) => s + r.everySec, 0) / out.length).toFixed(1), meanThings: +(out.reduce((s, r) => s + r.things, 0) / out.length).toFixed(0) }));
