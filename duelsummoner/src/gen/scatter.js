// The scatter of a stage: where its trees, rocks, bushes, grass and flowers stand. Pure and integer-seeded (the same map always gives the same stage, in Node and in the browser),
// so the sim can make the trees and big rocks solid and the view can draw exactly the same ones. The view adds colours and shapes; this module only decides places and sizes.
import { MAP } from '../data/map.js';
import { heightAt } from '../sim/terrain.js';
import { sin, cos } from '../sim/dmath.js';
import { isqrt } from './imath.js';
const sqrt01 = u => isqrt(Math.floor(u * 100000000)) / 10000;                  // the square root of a number in 0..1, by integer maths

export const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const mulberry = a => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function noise2(seed) {                                                       // smooth value noise 0..1, for patchy grass and flower meadows
  const L = 64, v = new Float32Array(L * L), r = mulberry(seed); for (let i = 0; i < v.length; i++) v[i] = r();
  const g = (x, y) => v[((y & 63) << 6) | (x & 63)], s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi); return (g(xi, yi) * (1 - fx) + g(xi + 1, yi) * fx) * (1 - fy) + (g(xi, yi + 1) * (1 - fx) + g(xi + 1, yi + 1) * fx) * fy; };
}

// densities per stage: how much of each thing grows there (the view picks the palette)
export const DENSITY = [
  { trees: 1.0, rocks: 0.5, bushes: 0.6, grass: 1.0, flowers: 0.6, specials: 0, nFlowerCols: 4 },
  { trees: 0.0, rocks: 0.9, bushes: 0.0, grass: 0.2, flowers: 0.1, specials: 0.8, nFlowerCols: 2 },
  { trees: 0.0, rocks: 0.6, bushes: 0.0, grass: 0.1, flowers: 0.0, specials: 0.9, nFlowerCols: 1 }
];

// solidOnly: stop after the trees and rocks (the only things you can run into), which come first in the random sequence so they are the same either way
export function scatterStage(map, stageIndex, solidOnly) {
  const D = DENSITY[Math.min(stageIndex || 0, DENSITY.length - 1)], seed = strHash(String(map.hash || map.key || 'x')), rnd = mulberry(seed ^ 0x5CE9E), pat = noise2(seed ^ 0xA11CE);
  const R = (MAP && MAP.boundaryR ? MAP.boundaryR : 195) * 0.94, out = { trees: [[], [], []], rocks: [[], [], []], bushes: [], special: [], grass: [], flowers: [], flowerSpots: [] };
  const keep = [{ x: map.spawn.x, z: map.spawn.z, r: 9 }, { x: map.gate.x, z: map.gate.z, r: 12 }];                  // places scenery stays out of: the start, the gate, the arena, boss rings, every encounter
  if (map.arena) keep.push({ x: map.arena.center.x, z: map.arena.center.z, r: 16 });
  for (const b of map.bossRings || []) keep.push({ x: b.x, z: b.z, r: (b.r || 14) + 3 });
  for (const e of map.encounters || []) keep.push({ x: e.x, z: e.z, r: 6 });
  const free = (x, z, pad) => { for (const k of keep) { const dx = x - k.x, dz = z - k.z, rr = k.r + (pad || 0); if (dx * dx + dz * dz < rr * rr) return false; } return x * x + z * z < R * R; };
  const flat = (x, z, tol = 0.3) => { const h = heightAt(x, z); for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) if (Math.abs(heightAt(x + dx, z + dz) - h) > tol) return null; return h; };
  const spots = (n, test) => { const o = []; for (let tries = 0; o.length < n && tries < n * 12; tries++) { const a = rnd() * Math.PI * 2, d = sqrt01(rnd()) * R, x = cos(a) * d, z = sin(a) * d; const h = test(x, z); if (h !== null && h !== undefined && h !== false) o.push([x, h, z]); } return o; };
  const tint = (lo, hi) => 1 - lo + rnd() * (lo + hi);
  if (D.trees > 0) {                                                               // groves: pick centres, then ring them with trees of different sizes
    const groves = spots(Math.round(14 * D.trees), (x, z) => (free(x, z, 14) && flat(x, z, 0.4) !== null ? flat(x, z, 0.4) : null)), per = [];
    for (const g of groves) { const n = 4 + Math.floor(rnd() * 5); for (let i = 0; i < n; i++) { const a = rnd() * 6.283, d = 6 + rnd() * 18, x = g[0] + cos(a) * d, z = g[2] + sin(a) * d; if (!free(x, z, 5)) continue; const h = flat(x, z, 0.35); if (h === null) continue; per.push([x, h, z, 0.85 + rnd() * 0.6, rnd() * 6.283, tint(0.12, 0.12)]); } }
    per.forEach((t, i) => out.trees[i % 3].push(t));
  }
  if (D.rocks > 0) { const rs = spots(Math.round(55 * D.rocks), (x, z) => (free(x, z, 2) ? flat(x, z, 0.5) : null)).map(s => [s[0], s[1], s[2], 1.0 + rnd() * rnd() * 2.0, rnd() * 6.283, tint(0.1, 0.1)]); rs.forEach((r, i) => out.rocks[i % 3].push(r)); }
  if (solidOnly) return out;
  if (D.bushes > 0) out.bushes = spots(Math.round(110 * D.bushes), (x, z) => (free(x, z, 2) ? flat(x, z, 0.35) : null)).map(s => [s[0], s[1], s[2], 0.7 + rnd() * 0.8, rnd() * 6.283, tint(0.1, 0.1)]);
  if (D.specials > 0) out.special = spots(Math.round(120 * D.specials), (x, z) => (free(x, z, 3) ? flat(x, z, 0.4) : null)).map(s => [s[0], s[1], s[2], 0.8 + rnd() * 1.6, rnd() * 6.283, 1]);
  if (D.grass > 0) out.grass = spots(Math.round(2600 * D.grass), (x, z) => (free(x, z, 0) && pat(x * 0.045 + 7, z * 0.045 + 3) > 0.38 ? flat(x, z, 0.25) : null)).map(s => [s[0], s[1], s[2], 0.8 + rnd() * 0.9, rnd() * 6.283, tint(0.15, 0.1)]);
  if (D.flowers > 0) {
    const fl = spots(Math.round(420 * D.flowers), (x, z) => (free(x, z, 0) && pat(x * 0.03 + 40, z * 0.03 + 9) > 0.62 ? flat(x, z, 0.25) : null));
    for (const s of fl) { const ci = Math.floor(pat(s[0] * 0.05, s[2] * 0.05) * D.nFlowerCols) % D.nFlowerCols; out.flowers.push([s[0], s[1], s[2], 0.8 + rnd() * 0.6, rnd() * 6.283, ci]); out.flowerSpots.push([s[0], s[1], s[2]]); }
  }
  return out;
}
