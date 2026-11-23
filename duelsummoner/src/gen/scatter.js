// The scatter of a stage: where its trees, rocks, bushes, grass and flowers stand. Pure and integer-seeded (the same map always gives the same stage, in Node and in the browser),
// so the sim can make the trees and big rocks solid and the view can draw exactly the same ones. The view adds colours and shapes; this module only decides places and sizes.
// Rules (design/environment-bar.md): trees and rocks keep 24 m clear of the spawn; groves of 3 to 5 trees with trunks 6 to 9 m apart and at most 3 in any 10 x 10 m cell;
// two tree species (parasol 9-11 m, blob 13-16 m); rocks in tiers (hero 4.5-6 m, tall 3-3.5 m, low 1.2-1.5 m, pebbles 0.35 m or less), nothing solid between 0.4 and 1.2 m;
// grass only as short clumps at the feet of trees and rocks.
import { MAP } from '../data/map.js';
import { heightAt } from '../sim/terrain.js';
import { sin, cos } from '../sim/dmath.js';
import { isqrt } from './imath.js';
import { roadPath, roadDist, poolSpots } from './road.js';
import { vnoise } from './open/terrain.js';
const sqrt01 = u => isqrt(Math.floor(u * 100000000)) / 10000;                  // the square root of a number in 0..1, by integer maths
const TAU = 6.283185307;
const sqrtf = v => isqrt(Math.floor(v * 10000)) / 100;                       // square root to 1 cm, by integer maths

export const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const mulberry = a => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function noise2(seed) {                                                       // smooth value noise 0..1, for patchy grass and flower meadows
  const L = 64, v = new Float32Array(L * L), r = mulberry(seed); for (let i = 0; i < v.length; i++) v[i] = r();
  const g = (x, y) => v[((y & 63) << 6) | (x & 63)], s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi); return (g(xi, yi) * (1 - fx) + g(xi + 1, yi) * fx) * (1 - fy) + (g(xi, yi + 1) * (1 - fx) + g(xi + 1, yi + 1) * fx) * fy; };
}

// densities per stage: how much of each thing grows there (the view picks the palette). groves: how many tree groves; heroes: hero boulders.
export const DENSITY = [
  { groves: 110, heroes: 36, singles: 60, bushes: 50, grass: 1, flowers: 0.6, specials: 0, nFlowerCols: 4 },
  { groves: 0, heroes: 22, singles: 14, bushes: 0, grass: 0.2, flowers: 0.1, specials: 0.8, nFlowerCols: 2 },
  { groves: 0, heroes: 16, singles: 12, bushes: 0, grass: 0.1, flowers: 0.0, specials: 0.9, nFlowerCols: 1 }
];
// tree variants: 0 and 1 are the parasol (9-11 m, a wide flat crown), 2 and 3 the blob (13-16 m)
export const PARASOL = [0, 1];
export const TREE_SCALE = { parasol: [0.9, 1.1], blob: [1.3, 1.6] };

// solidOnly: stop after the trees and rocks (the only things you can run into), which come first in the random sequence so they are the same either way
export function scatterStage(map, stageIndex, solidOnly) {
  if (map.sample) return { trees: [[], [], [], []], rocks: [[], [], []], bushes: [], special: [], grass: [], flowers: [], flowerSpots: [] };       // the hand-built sample plants nothing yet
  if (map.open) return scatterOpen(map, stageIndex, solidOnly);
  if (map.rooms && map.rooms.length) return scatterRooms(map, stageIndex, solidOnly);
  const D = DENSITY[Math.min(stageIndex || 0, DENSITY.length - 1)], seed = strHash(String(map.hash || map.key || 'x')), rnd = mulberry(seed ^ 0x5CE9E), pat = noise2(seed ^ 0xA11CE);
  const R = (MAP && MAP.boundaryR ? MAP.boundaryR : 195) * 0.94, out = { trees: [[], [], [], []], rocks: [[], [], []], bushes: [], special: [], grass: [], flowers: [], flowerSpots: [] };
  const keep = [{ x: map.spawn.x, z: map.spawn.z, r: 10 }, { x: map.gate.x, z: map.gate.z, r: 12 }];                  // places scenery stays out of: the start, the gate, the arena, boss rings, every encounter
  if (map.arena) keep.push({ x: map.arena.center.x, z: map.arena.center.z, r: 16 });
  const pools = poolSpots(map); for (const p of pools) keep.push({ x: p.x, z: p.z, r: p.r + 3 });
  for (const b of map.bossRings || []) keep.push({ x: b.x, z: b.z, r: (b.r || 14) + 3 });
  for (const e of map.encounters || []) keep.push({ x: e.x, z: e.z, r: 6 });
  const road = roadPath(map);
  const free = (x, z, pad) => { if (roadDist(road, x, z) < 2.25 + 1.5 + (pad ? Math.min(pad, 2) : 0)) return false; for (const k of keep) { const dx = x - k.x, dz = z - k.z, rr = k.r + (pad || 0); if (dx * dx + dz * dz < rr * rr) return false; } return x * x + z * z < R * R; };
  const farSpawn = (x, z, d) => { const dx = x - map.spawn.x, dz = z - map.spawn.z; return dx * dx + dz * dz >= d * d; };      // trees and rocks stay 24 m from the spawn, hero rocks 32 m
  const flat = (x, z, tol = 0.3) => { const h = heightAt(x, z); if (h >= 50) return null; for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) if (Math.abs(heightAt(x + dx, z + dz) - h) > tol) return null; return h; };
  const spots = (n, test) => { const o = []; for (let tries = 0; o.length < n && tries < n * 14; tries++) { const a = rnd() * TAU, d = sqrt01(rnd()) * R, x = cos(a) * d, z = sin(a) * d; const h = test(x, z); if (h !== null && h !== undefined && h !== false) o.push([x, h, z]); } return o; };
  const tint = (lo, hi) => 1 - lo + rnd() * (lo + hi);
  const solids = [];                                                              // every tree and big rock placed so far: [x, z, collider radius, isTree]
  const gapOk = (x, z, r, minGap, tree) => { for (const s of solids) { const dx = x - s[0], dz = z - s[1], rr = tree && s[3] ? 6 : r + s[2] + minGap; if (dx * dx + dz * dz < rr * rr) return false; } return true; };       // two trunks keep 6 m between centres; anything else keeps the given gap
  // ---- trees: groves of 3 to 5, trunks 6-9 m apart, at most 3 in a 10 x 10 m cell
  const cellCount = new Map(), trees = [];
  if (D.groves > 0) {
    const groves = spots(D.groves, (x, z) => (free(x, z, 14) && farSpawn(x, z, 30) && flat(x, z, 0.4) !== null ? flat(x, z, 0.4) : null));
    for (const p of pools) groves.unshift([p.x, 0, p.z, p.r + 4]);                 // a ring of trees stands round each pool
    for (const g of groves) {
      if (trees.length >= 214) break;
      const n = 3 + Math.floor(rnd() * 3), a0 = rnd() * TAU;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * TAU / n + (rnd() - 0.5) * 0.5, d = (g[3] || 4.2) + rnd() * 3.6, x = g[0] + cos(a) * d, z = g[2] + sin(a) * d;
        if (!free(x, z, g[3] ? 0 : 3) || !farSpawn(x, z, 24)) continue; const h = flat(x, z, 0.35); if (h === null) continue;
        const key = Math.floor(x / 10) * 4096 + Math.floor(z / 10); if ((cellCount.get(key) || 0) >= 3) continue;
        const parasol = rnd() < 0.6, sc = parasol ? TREE_SCALE.parasol : TREE_SCALE.blob, s = sc[0] + rnd() * (sc[1] - sc[0]), r = 0.55 * s;
        if (!gapOk(x, z, r, 3.2, true)) continue;                                  // trunk centres at least 6 m apart, and 3 m or more of air between a trunk and a rock
        cellCount.set(key, (cellCount.get(key) || 0) + 1); solids.push([x, z, r, true]); trees.push([x, h, z, s, rnd() * TAU, tint(0.12, 0.12), parasol ? Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2)]);
      }
    }
    // road-aware thinning and filling: walking the road, every sample (about every 20 m) should see 6 to 10 trees within 50 m
    const countNear = (x, z) => { let c = 0; for (const t of trees) { const dx = t[0] - x, dz = t[2] - z; if (dx * dx + dz * dz < 2500) c++; } return c; };
    const samples = []; for (let i = 1; i < road.main.length; i++) { const a = road.main[i - 1], b = road.main[i], l = sqrtf((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])), n = Math.max(1, Math.round(l / 20)); for (let k = 0; k < n; k++) samples.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    const dropTree = i => { const t = trees[i], key = Math.floor(t[0] / 10) * 4096 + Math.floor(t[2] / 10); cellCount.set(key, (cellCount.get(key) || 1) - 1); trees.splice(i, 1); const si = solids.findIndex(q => q[3] && q[0] === t[0] && q[1] === t[2]); if (si >= 0) solids.splice(si, 1); };
    for (let pass = 0; pass < 8; pass++) for (const sm of samples) {
      let n = countNear(sm[0], sm[1]);
      while (n > 10) { let best = -1, bd = -1; for (let i = 0; i < trees.length; i++) { const dx = trees[i][0] - sm[0], dz = trees[i][2] - sm[1], d2 = dx * dx + dz * dz; if (d2 < 2500 && d2 > bd) { bd = d2; best = i; } } if (best < 0) break; dropTree(best); n--; }       // too many: drop the farthest ones in view
      for (let tries = 0; n < 6 && tries < 40; tries++) {                                                            // too few: stand a tree 10 to 30 m off the road
        const a = rnd() * TAU, d = 10 + rnd() * 20, x = sm[0] + cos(a) * d, z = sm[1] + sin(a) * d; if (!free(x, z, 3) || !farSpawn(x, z, 24)) continue; const h = flat(x, z, 0.35); if (h === null) continue;
        const key = Math.floor(x / 10) * 4096 + Math.floor(z / 10); if ((cellCount.get(key) || 0) >= 3) continue;
        const parasol = rnd() < 0.6, sc = parasol ? TREE_SCALE.parasol : TREE_SCALE.blob, sz = sc[0] + rnd() * (sc[1] - sc[0]), r = 0.55 * sz; if (!gapOk(x, z, r, 3.2, true)) continue;
        cellCount.set(key, (cellCount.get(key) || 0) + 1); solids.push([x, z, r, true]); trees.push([x, h, z, sz, rnd() * TAU, tint(0.12, 0.12), parasol ? Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2)]); n++;
      }
    }
    for (const t of trees) out.trees[t[6]].push([t[0], t[1], t[2], t[3], t[4], t[5]]);
  }
  // ---- rocks: hero boulders with a low or tall rock leaning on them and a few pebbles, plus lone low and tall rocks
  const rocks = [], pebbles = [], solidRock = (x, z, sx, sy, h) => { rocks.push([x, h, z, sx, rnd() * TAU, tint(0.1, 0.1), sy]); solids.push([x, z, sx, false]); };
  const heroes = [];
  for (const s of spots(D.heroes * 10, (x, z) => (free(x, z, 8) && farSpawn(x, z, 32) && flat(x, z, 0.5) !== null ? flat(x, z, 0.5) : null))) {
    const sx = 2.6 + rnd() * 0.8, sy = 3.5 + rnd() * 0.9;                           // 5.2-6.8 m wide, 4.5-6 m tall (the blob is about 1.3 high at scale 1)
    if (heroes.length >= D.heroes) break;
    if (roadDist(road, s[0], s[2]) < sx + 10) continue;                              // hero boulders keep 10 m from the road
    let ok = true; for (const o of heroes) { const dx = s[0] - o[0], dz = s[2] - o[1]; if (dx * dx + dz * dz < 25 * 25) { ok = false; break; } }
    if (!ok || !gapOk(s[0], s[2], sx, 3.2)) continue;
    heroes.push([s[0], s[2]]); solidRock(s[0], s[2], sx, sy, s[1]);
    for (let k = 0; k < 2; k++) {                                                   // a low or tall rock touching the hero (gap under 0.9 m)
      const tall = rnd() < 0.5, ex = tall ? 1.6 + rnd() * 0.4 : 1.2 + rnd() * 0.5, ey = tall ? 2.4 + rnd() * 0.4 : 1.0 + rnd() * 0.2, a = rnd() * TAU, d = sx + ex + 0.25 + rnd() * 0.5;
      const x = s[0] + cos(a) * d, z = s[2] + sin(a) * d, h = flat(x, z, 0.5); if (h === null || !free(x, z, 2) || !gapOk(x, z, ex, 0.2) ) continue;
      let near = false; for (const q of solids) { const dx = x - q[0], dz = z - q[1], gap = sqrtf(dx * dx + dz * dz) - ex - q[2]; if (gap > 0.8 && gap < 3.1) { near = true; break; } } if (near) continue;   // no gap between 0.9 and 3 m
      solidRock(x, z, ex, ey, h);
    }
    for (let k = 0; k < 4; k++) { const a = rnd() * TAU, d = sx + 1.5 + rnd() * 3.5, x = s[0] + cos(a) * d, z = s[2] + sin(a) * d, h = flat(x, z, 0.5); if (h !== null) pebbles.push([x, h, z, 0.16 + rnd() * 0.12, rnd() * TAU, tint(0.1, 0.1), 0.12 + rnd() * 0.08]); }
  }
  let lowTall = rocks.length - heroes.length;
  for (const s of spots(D.singles * 3, (x, z) => (free(x, z, 4) && farSpawn(x, z, 28) && flat(x, z, 0.5) !== null ? flat(x, z, 0.5) : null))) {
    if (lowTall >= 95) break;
    const tall = rnd() < 0.5, ex = tall ? 1.6 + rnd() * 0.4 : 1.2 + rnd() * 0.5, ey = tall ? 2.4 + rnd() * 0.4 : 1.0 + rnd() * 0.2;
    let near = false; for (const q of solids) { const dx = s[0] - q[0], dz = s[2] - q[1], gap = sqrtf(dx * dx + dz * dz) - ex - q[2]; if (gap < 3.1) { near = true; break; } } if (near) continue;      // a lone rock keeps 3 m or more from everything
    solidRock(s[0], s[2], ex, ey, s[1]); lowTall++;
  }
  rocks.forEach((r, i) => out.rocks[i % 3].push(r)); pebbles.forEach((r, i) => out.rocks[i % 3].push(r));
  if (solidOnly) return out;
  const feet = solids.slice();                                                    // grass and bushes grow at the feet of trees and rocks
  const near = (n, r0, r1, make) => { const o = []; if (!feet.length) return o; for (let i = 0; i < n; i++) { const f = feet[Math.floor(rnd() * feet.length)], a = rnd() * TAU, d = f[2] + r0 + rnd() * r1, x = f[0] + cos(a) * d, z = f[1] + sin(a) * d; const h = flat(x, z, 0.3); if (h !== null && free(x, z, 0) && farSpawn(x, z, 10) && !(x * x + z * z > R * R)) o.push(make(x, h, z)); } return o; };
  if (D.bushes > 0) out.bushes = near(D.bushes, 1.5, 3, (x, h, z) => [x, h, z, 1.0 + rnd() * 0.8, rnd() * TAU, tint(0.1, 0.1)]);
  if (D.specials > 0) out.special = spots(Math.round(120 * D.specials), (x, z) => (free(x, z, 3) && farSpawn(x, z, 24) ? flat(x, z, 0.4) : null)).map(s => [s[0], s[1], s[2], 0.8 + rnd() * 1.6, rnd() * TAU, 1]);
  if (D.grass > 0) out.grass = near(Math.round(600 * D.grass), 0.4, 3, (x, h, z) => [x, h, z, 0.8 + rnd() * 0.5, rnd() * TAU, tint(0.15, 0.1)]);        // about 600 low clumps, never taller than 0.52 m
  // fill: no walkable point more than 12.5 m from a feature 1.5 m or taller (trees, tall rocks, tall kit pieces); empty cells get low non-solid clump bushes of 1.5 to 2 m, not more trees
  { const feat = []; for (const t of trees) feat.push([t[0], t[2]]); for (const r of rocks) if (1.25 * (r[6] || r[3]) >= 1.5) feat.push([r[0], r[2]]);
    for (const p of map.prims) { if (p.h < 1.5) continue; if (p.t === 'box') feat.push([(p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2]); else if (p.t === 'cyl') feat.push([p.x, p.z]); else if (p.t === 'ring') feat.push([p.cx + 0, p.cz + 0]); }
    const near2 = (x, z) => { let b = 1e9; for (const f of feat) { const dx = f[0] - x, dz = f[1] - z, d = dx * dx + dz * dz; if (d < b) b = d; } return b; };
    const off = Math.floor(rnd() * 4);
    for (let x = -184 + off; x <= 184; x += 4) for (let z = -184 + off; z <= 184; z += 4) { if (x * x + z * z > 184 * 184 || heightAt(x, z) > 0.5 || near2(x, z) <= 156.25) continue;
      for (let k = 0; k < 16; k++) { const px = x + (rnd() - 0.5) * 9, pz = z + (rnd() - 0.5) * 9, h = flat(px, pz, 0.3); if (h !== null && free(px, pz, 0) && farSpawn(px, pz, 16)) { out.bushes.push([px, h, pz, 1.7 + rnd() * 0.5, rnd() * TAU, tint(0.1, 0.1)]); feat.push([px, pz]); break; } } } }
  if (D.flowers > 0) {
    const fl = spots(Math.round(420 * D.flowers), (x, z) => (free(x, z, 0) && farSpawn(x, z, 10) && pat(x * 0.03 + 40, z * 0.03 + 9) > 0.62 ? flat(x, z, 0.25) : null));
    for (const s of fl) { const ci = Math.floor(pat(s[0] * 0.05, s[2] * 0.05) * D.nFlowerCols) % D.nFlowerCols; out.flowers.push([s[0], s[1], s[2], 0.8 + rnd() * 0.6, rnd() * TAU, ci]); out.flowerSpots.push([s[0], s[1], s[2]]); }
  }
  return out;
}







// ---- rooms (the designed maps): trees and rocks follow the same structure rule as the kit. Each room has its own planting rule: a grove has trees in rows 3 to 7 m from its walls, a pool room a ring of trees round its pool, a meadow a few trees on its walls and bushes,
// a colonnade, ruin or court none or very few; boulders stand only at the foot of a wall or cliff. Nothing is dropped on open floor, and the 20 m round each room's landmark stays clear.
function scatterRooms(map, stageIndex, solidOnly) {
  const seed = strHash(String(map.hash || map.key || 'x')), rnd = mulberry(seed ^ 0x5CE9E), SZ = 400, HALF = 200;
  const out = { trees: [[], [], [], []], rocks: [[], [], []], bushes: [], special: [], grass: [], flowers: [], flowerSpots: [] };
  const H = (x, z) => heightAt(x, z), ok = (x, z) => H(x, z) < 50;
  // distance (m, 1 m cells, chamfer) to the nearest wall cell: a solid block or the rim
  const dist = new Float32Array(SZ * SZ).fill(1e9), q = [];
  for (let j = 0; j < SZ; j++) for (let i = 0; i < SZ; i++) { const h = map.heights[j * SZ + i]; if (h >= 50 || (map.cellFlags[j * SZ + i] & 4096)) { dist[j * SZ + i] = 0; q.push(j * SZ + i); } }
  for (let k = 0; k < q.length; k++) { const c = q[k], x = c % SZ, z = (c / SZ) | 0, d = dist[c]; for (const [dx, dz, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4], [-1, -1, 1.4], [1, -1, 1.4], [-1, 1, 1.4]]) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= SZ || zz >= SZ) continue; const n = zz * SZ + xx; if (d + w < dist[n]) { dist[n] = d + w; q.push(n); } } }
  const wd = (x, z) => { const i = Math.floor(x + HALF), j = Math.floor(z + HALF); return i < 0 || j < 0 || i >= SZ || j >= SZ ? 0 : dist[j * SZ + i]; };
  const roomAt = (x, z) => { const cx = Math.floor((x + HALF) / 2), cz = Math.floor((z + HALF) / 2); if (cx < 0 || cz < 0 || cx >= 200 || cz >= 200) return -1; const r = map.roomOf[cz * 200 + cx]; return r === 255 ? -1 : r; };
  const keep = [{ x: map.spawn.x, z: map.spawn.z, r: 24 }, { x: map.gate.x, z: map.gate.z, r: 14 }]; if (map.arena) keep.push({ x: map.arena.center.x, z: map.arena.center.z, r: 18 });
  for (const r of map.rooms) if (r.landmark) keep.push({ x: r.x, z: r.z, r: 20 });
  for (const e of map.encounters || []) keep.push({ x: e.x, z: e.z, r: 6 });
  for (const b of map.bossRings || []) keep.push({ x: b.x, z: b.z, r: (b.r || 14) + 2 });
  const road = roadPath(map), pools = poolSpots(map); for (const p of pools) keep.push({ x: p.x, z: p.z, r: p.r + 3 });
  for (const g of map.gateways || []) keep.push({ x: g.x, z: g.z, r: 10 });
  const free = (x, z, pad) => { if (roadDist(road, x, z) < 4 + (pad || 0)) return false; for (const k of keep) { const dx = x - k.x, dz = z - k.z, rr = k.r + (pad || 0); if (dx * dx + dz * dz < rr * rr) return false; } return true; };
  const flat = (x, z, tol = 0.3) => { const h = H(x, z); if (h >= 50) return null; for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) if (Math.abs(H(x + dx, z + dz) - h) > tol) return null; return h; };
  const tint = (lo, hi) => 1 - lo + rnd() * (lo + hi), trees = [], rocks = [];
  const rule = { grove: { p: 0.30, lo: 3, hi: 7 }, pool: { p: 0.07, lo: 3, hi: 6 }, meadow: { p: 0.05, lo: 3, hi: 6 }, colonnade: { p: 0.02, lo: 4, hi: 6 }, ruin: { p: 0.03, lo: 3, hi: 6 }, court: { p: 0 } };
  const treeOk = (x, z) => { for (const t of trees) { const dx = x - t[0], dz = z - t[2]; if (dx * dx + dz * dz < 6.5 * 6.5) return false; } return true; };
  for (let z = -190; z <= 190; z += 3) for (let x = -190; x <= 190; x += 3) {
    const jx = x + (rnd() - 0.5) * 2, jz = z + (rnd() - 0.5) * 2, r = roomAt(jx, jz); if (r < 0) continue; const room = map.rooms[r], R = rule[room.style] || rule.court, d = wd(jx, jz);
    if (R.p > 0 && d >= R.lo && d <= R.hi && rnd() < R.p && trees.length < 220) { if (!free(jx, jz, 3) || !treeOk(jx, jz)) continue; const h = flat(jx, jz, 0.35); if (h === null) continue; const parasol = rnd() < 0.6, sc = parasol ? TREE_SCALE.parasol : TREE_SCALE.blob, s = sc[0] + rnd() * (sc[1] - sc[0]); trees.push([jx, h, jz, s, rnd() * TAU, tint(0.12, 0.12), parasol ? Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2)]); continue; }
    if (d >= 1.8 && d <= 3.6 && rnd() < 0.012 && rocks.length < 60) { if (!free(jx, jz, 2)) continue; const h = flat(jx, jz, 0.4); if (h === null) continue; const tall = rnd() < 0.4, ex = tall ? 1.6 + rnd() * 0.4 : 1.2 + rnd() * 0.5, ey = tall ? 2.4 + rnd() * 0.4 : 1.0 + rnd() * 0.2; let near = false; for (const o of rocks) { const dx = jx - o[0], dz = jz - o[2]; if (dx * dx + dz * dz < 36) { near = true; break; } } if (!near) rocks.push([jx, h, jz, ex, rnd() * TAU, tint(0.1, 0.1), ey]); }
  }
  for (const t of trees) out.trees[t[6]].push([t[0], t[1], t[2], t[3], t[4], t[5]]);
  rocks.forEach((r, i) => out.rocks[i % 3].push(r));
  if (solidOnly) return out;
  for (const t of trees) for (let k = 0; k < 2; k++) { const a = rnd() * TAU, dd = 1.8 + rnd() * 2, x = t[0] + cos(a) * dd, z = t[2] + sin(a) * dd, h = flat(x, z, 0.4); if (h !== null && free(x, z, 0)) out.bushes.push([x, h, z, 1.0 + rnd() * 0.8, rnd() * TAU, tint(0.1, 0.1)]); }
  const pat = noise2(seed ^ 0xA11CE);
  for (const room of map.rooms) if (room.style === 'meadow') for (let k = 0; k < 40; k++) { const a = rnd() * TAU, dd = 8 + rnd() * 24, x = room.x + cos(a) * dd, z = room.z + sin(a) * dd; if (roomAt(x, z) === room.id && free(x, z, 1) && flat(x, z, 0.3) !== null && pat(x * 0.05, z * 0.05) > 0.4) out.flowerSpots.push([x, flat(x, z, 0.3), z]); }
  return out;
}
// ---- open terrain (the preview desert): the trees, boulders, bushes and flowers of the other stages do not grow here. Its dressing (cacti, dead trees, logs, pots, the carved head) is a plain list in the map (map.dress, drawn by view/openMesh.js), its solid pieces are map.solid (read by sim/colliders.js).
function scatterOpen(map, stageIndex, solidOnly) { return { trees: [[], [], [], []], rocks: [[], [], []], bushes: [], special: [], grass: [], flowers: [], flowerSpots: [] }; }
