// How well the route shows landmarks on foot: along the spine of each designed map, every 8 m, is there a kit piece or landmark within 40 m with a clear line of sight from the camera height?   node tools/landmarkview.mjs
import { generateStage } from '../src/gen/generate.js';
const sets = [[1, 0], [2, 0], [3, 0], [777, 0], [4242, 0], [1, 1], [1, 2]]; let worst = 100;
for (const [seed, stage] of sets) {
  const m = generateStage(seed, stage), H = m.heights, at = (x, z) => { const i = Math.floor(x + 200), j = Math.floor(z + 200); return i < 0 || j < 0 || i >= 400 || j >= 400 ? 99 : H[j * 400 + i]; };
  const pts = [...m.kits.map(k => [k.x, k.z, k.y + 3]), ...m.landmarks.map(l => [l.x, l.z, l.top])], road = m._road.main; let n = 0, ok = 0;
  for (let i = 1; i < road.length; i++) { const ax = road[i - 1][0], az = road[i - 1][1], bx = road[i][0], bz = road[i][1], l = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.floor(l / 8));
    for (let s = 0; s < steps; s++) { const x = ax + (bx - ax) * s / steps, z = az + (bz - az) * s / steps, eye = at(x, z) + 3; n++; let seen = false;
      for (const [px, pz, ph] of pts) { const d = Math.hypot(px - x, pz - z); if (d > 40) continue; let blocked = false; for (let t = 4; t < d - 2 && !blocked; t += 4) { const hh = at(x + (px - x) * t / d, z + (pz - z) * t / d), line = eye + (ph - eye) * t / d; if (hh > line + 0.2) blocked = true; } if (!blocked) { seen = true; break; } }
      if (seen) ok++; } }
  const pc = ok / n * 100; worst = Math.min(worst, pc); console.log(`seed ${seed} stage ${stage + 1}: ${ok}/${n} spine samples (${pc.toFixed(0)}%) have a kit piece or landmark within 40 m in view; ${m.kits.length} pieces`);
}
process.exit(worst >= 95 ? 0 : 1);
