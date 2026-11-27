// Land relief from the start: along 8 straight lines of 600 m from the spawn of each seed, the height range, the mean and steepest slope, and how often the rider meets a rise or a drop of 3 m or more.
//   node tools/landstats.mjs [seeds...]
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
const seeds = process.argv.slice(2).map(Number).filter(Boolean); if (!seeds.length) seeds.push(21, 4711, 9, 77, 1234, 101);
const all = [];
for (const seed of seeds) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }), sp = g.map.world.spawn; let lo = 1e9, hi = -1e9, sSum = 0, sN = 0, sMax = 0, events = 0, steep = 0;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); let prev = heightAt(sp.x, sp.z), ext = prev, dir = 0;
    for (let d = 2; d <= 600; d += 2) { const h = heightAt(sp.x + c * d, sp.z + s * d); if (h >= 50) break; lo = Math.min(lo, h); hi = Math.max(hi, h); const sl = Math.abs(h - prev) / 2; sSum += sl; sN++; sMax = Math.max(sMax, sl); if (sl > 0.9) steep++; prev = h;
      if (dir >= 0 && h < ext - 3) { if (dir > 0) events++; dir = -1; ext = h; } else if (dir <= 0 && h > ext + 3) { if (dir < 0) events++; dir = 1; ext = h; } else if (dir > 0 ? h > ext : h < ext) ext = h; } }
  all.push({ seed, range: +(hi - lo).toFixed(1), meanSlope: +(sSum / sN).toFixed(3), maxSlope: +sMax.toFixed(2), riseOrDropEvery_m: +(8 * 600 / Math.max(1, events)).toFixed(0), wallSteps: steep });
}
console.log(JSON.stringify(all)); const m = k => +(all.reduce((s, r) => s + r[k], 0) / all.length).toFixed(2);
console.log(JSON.stringify({ mean: { range: m('range'), meanSlope: m('meanSlope'), maxSlope: m('maxSlope'), riseOrDropEvery_m: m('riseOrDropEvery_m'), wallSteps: m('wallSteps') } }));
