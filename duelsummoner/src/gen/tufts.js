// Grass tufts, placed once per stage as a pure function of the map and the ground height: a seeded, stable pattern in world space (the same tufts every time, nothing appears or moves as the player walks).
// A tuft is only planted where the ground is flat and open: the height at its own x,z and at four points 0.5 m around it differ by at most 0.23 m (a slope under about 25 degrees), and a wider ring at 1.2 m by at most 0.45 m
// (so no tuft hangs over a cliff edge); never on a wall cell. Its base is the ground height at its own x,z. `hf` is the one height function the sim and the mesh use.
import { roadPath, roadDist, poolSpots } from './road.js';
import { strHash, noise2 } from './scatter.js';
export const grassRadius = fogNear => Math.max(70, (fogNear || 80) + 10);       // the draw radius reaches past the fog start
export const TUFT_STEP = 1.55, SLOPE_NEAR = 0.23, SLOPE_FAR = 0.45;
export function tuftOk(hf, x, z) {
  const h = hf(x, z); if (!(h < 50) || h > 6) return null;
  const n = 0.5, f = 1.2;
  for (const [dx, dz] of [[n, 0], [-n, 0], [0, n], [0, -n]]) { const q = hf(x + dx, z + dz); if (!(q < 50) || Math.abs(q - h) > SLOPE_NEAR) return null; }
  for (const [dx, dz] of [[f, 0], [-f, 0], [0, f], [0, -f]]) { const q = hf(x + dx, z + dz); if (!(q < 50) || Math.abs(q - h) > SLOPE_FAR) return null; }
  return h;
}
export function bakeTufts(map, S, hf, reach) {
  const R = reach || 190, seed = strHash(String(map.hash || map.key || 'x')), pat = noise2(seed ^ 0xA11CE), road = roadPath(map);
  const keep = [{ x: map.spawn.x, z: map.spawn.z, r: 9 }, { x: map.gate.x, z: map.gate.z, r: 12 }]; if (map.arena) keep.push({ x: map.arena.center.x, z: map.arena.center.z, r: 17 });
  for (const p of poolSpots(map)) keep.push({ x: p.x, z: p.z, r: p.r + 3.5 });
  for (const b of map.bossRings || []) keep.push({ x: b.x, z: b.z, r: (b.r || 14) + 3 });
  for (const e of map.encounters || []) keep.push({ x: e.x, z: e.z, r: 5 });
  const out = [], rnd = (i, j, k) => { let a = (Math.imul(i + 4001, 73856093) ^ Math.imul(j + 7919, 19349663) ^ Math.imul(k + seed, 83492791)) >>> 0; a = (Math.imul(a ^ (a >>> 15), 2246822507) >>> 0); a = (Math.imul(a ^ (a >>> 13), 3266489909) >>> 0); return ((a ^ (a >>> 16)) >>> 0) / 4294967296; };
  const n = Math.ceil(R / TUFT_STEP);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const x = (i + 0.5 + (rnd(i, j, 1) - 0.5) * 0.9) * TUFT_STEP, z = (j + 0.5 + (rnd(i, j, 2) - 0.5) * 0.9) * TUFT_STEP; if (x * x + z * z > R * R) continue;
    const m = pat(x * 0.03 + 40, z * 0.03 + 9), mm = pat(x * 0.012 + 7, z * 0.012 + 70), dens = Math.min(1, 0.22 + Math.max(0, m - 0.42) * 3.2 + Math.max(0, mm - 0.5) * 1.5);
    if (rnd(i, j, 3) > dens * 0.95 * (map.open ? 0.3 : 1)) continue;       // the open desert: few, pale tufts
    const h = tuftOk(hf, x, z); if (h === null) continue;
    if (roadDist(road, x, z) < 5.2) continue;
    let bad = false; for (const k of keep) { const dx = x - k.x, dz = z - k.z; if (dx * dx + dz * dz < k.r * k.r) { bad = true; break; } } if (bad) continue;
    out.push(x, h, z, rnd(i, j, 4));
  }
  return Float32Array.from(out);
}
