// G1-G4: playable mask, districts, regions, region graph + spine, tiers and transitions. Coarse 8 m grid.
import { hash32, fnv1a32Ints } from './seed.js';
import { isqrt, valueNoise1, pseudoAngle, Heap, DIR16 } from './imath.js';
import { CHANNEL_ARCH, FALLBACK_LAYOUTS } from './spec.js';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [-1, 1, 14], [1, -1, 14], [-1, -1, 14]];

/* ---------- G1.1 mask: one of four seeded silhouettes ---------- */
// round: superellipse (exp 3) with a +-1 cell wobble; lobed: 3-5 bays cut into the rim; crescent: a disc
// with a large bite taken out of one side; twin: two overlapping basins joined by a waist. All integer.
export const MASK_SHAPES = ['round', 'lobed', 'crescent', 'twin'];
const smoothTri = (t) => { // 0..256 periodic bump from a triangle wave, smoothstepped (0 at t=0, 256 at t=128)
  const a = Math.abs(((t % 256) + 256) % 256 - 128); const u = 128 - a; // 0..128
  return Math.trunc((u * u * (384 - 2 * u)) / 8192); // 0..256
};
export function buildMask(C, R, seed, shape = 'round', dir = [1000, 0], lobes = 4) {
  const m = new Uint8Array(C * C);
  const R2 = 2 * R;
  const [ux, uz] = dir; // unit*1000
  const rot = Math.trunc(((seed >>> 8) & 511));
  for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) {
    const dx = 2 * x + 1 - C, dz = 2 * z + 1 - C;
    const pa = pseudoAngle(dx, dz);
    const nz = valueNoise1(pa, seed, 64); // -1024..1024
    const off = nz > 400 ? 2 : nz < -400 ? -2 : 0; // +-1 coarse cell (doubled units)
    const ax = Math.abs(dx), az = Math.abs(dz);
    let inside;
    if (shape === 'lobed') {
      const bay = smoothTri(Math.trunc(((pa + rot) * lobes) / 2)); // 0..256 around the rim, 'lobes' bays
      const r = R2 + off - Math.trunc((bay * 14) / 256);          // bays cut up to 7 cells (56 m) inward
      inside = ax * ax * ax + az * az * az <= r * r * r;
    } else if (shape === 'crescent') {
      const r = R2 + off; const bx = Math.trunc((ux * R2 * 95) / 100000), bz = Math.trunc((uz * R2 * 95) / 100000);
      const br = Math.trunc((R2 * 58) / 100);
      inside = ax * ax * ax + az * az * az <= r * r * r && (dx - bx) * (dx - bx) + (dz - bz) * (dz - bz) > br * br;
    } else if (shape === 'twin') {
      const cx = Math.trunc((ux * R2 * 40) / 100000), cz = Math.trunc((uz * R2 * 40) / 100000);
      const r = Math.trunc((R2 * 70) / 100) + off;
      inside = (dx - cx) * (dx - cx) + (dz - cz) * (dz - cz) <= r * r || (dx + cx) * (dx + cx) + (dz + cz) * (dz + cz) <= r * r;
    } else {
      const r = R2 + off; inside = ax * ax * ax + az * az * az <= r * r * r;
    }
    if (inside) m[z * C + x] = 2;
  }
  // keep the largest 4-connected piece only
  const comp = new Int32Array(C * C).fill(-1); let best = -1, bestN = 0;
  for (let i = 0; i < C * C; i++) {
    if (!m[i] || comp[i] >= 0) continue; const q = [i]; comp[i] = i;
    for (let k = 0; k < q.length; k++) { const c = q[k], x = c % C, z = (c / C) | 0; for (const [ddx, ddz] of N4) { const xx = x + ddx, zz = z + ddz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue; const j = zz * C + xx; if (m[j] && comp[j] < 0) { comp[j] = i; q.push(j); } } }
    if (q.length > bestN) { bestN = q.length; best = i; }
  }
  for (let i = 0; i < C * C; i++) if (m[i] && comp[i] !== best) m[i] = 0;
  // rim = in-mask cells within Chebyshev 2 of outside
  const out = new Uint8Array(C * C);
  for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) {
    if (!m[z * C + x]) continue;
    let rim = false;
    for (let dz = -2; dz <= 2 && !rim; dz++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= C || zz >= C || !m[zz * C + xx]) { rim = true; break; }
    }
    out[z * C + x] = rim ? 1 : 2;
  }
  return out;
}

function bfs4(C, cmask, srcPred) { // distance (in cells) over playable cells from cells matching srcPred
  const d = new Int16Array(C * C).fill(-1); const q = new Int32Array(C * C); let qh = 0, qt = 0;
  for (let i = 0; i < C * C; i++) if (srcPred(i)) { d[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], x = i % C, z = (i / C) | 0;
    for (const [dx, dz] of N4) {
      const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue;
      const j = zz * C + xx; if (d[j] >= 0 || cmask[j] !== 2) continue;
      d[j] = d[i] + 1; q[qt++] = j;
    }
  }
  return d;
}

// Multi-source jittered growth. seeds: [{cell,id}], allowed(cell, seedIndex) -> bool. Returns owner (seed index) per cell.
function grow(C, cmask, seeds, allowed, salt) {
  const own = new Int16Array(C * C).fill(-1);
  const dist = new Int32Array(C * C).fill(0x3FFFFFFF);
  const h = new Heap(C * C);
  seeds.forEach((s, k) => { dist[s.cell] = 0; own[s.cell] = k; h.push(0, s.cell); });
  while (h.n) {
    const i = h.pop(); const key = h.lastKey; const d = Math.floor(key / 65536);
    if (d > dist[i]) continue;
    const x = i % C, z = (i / C) | 0, k = own[i];
    for (const [dx, dz, c] of N8) {
      const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue;
      const j = zz * C + xx; if (cmask[j] !== 2 || !allowed(j, k)) continue;
      const jit = hash32((j ^ Math.imul(seeds[k].id + 1, 0x9E37) ^ salt) >>> 0);
      const nd = d + c + (jit % 7);
      if (nd < dist[j]) { dist[j] = nd; own[j] = k; h.push(nd * 65536 + (jit & 0xFFFF), j); }
    }
  }
  return own;
}

const cd2 = (C, a, b) => { const ax = a % C, az = (a / C) | 0, bx = b % C, bz = (b / C) | 0; return (ax - bx) * (ax - bx) + (az - bz) * (az - bz); };

/* ---------- G1-G2 districts and regions ---------- */
function placeDistricts(ctx, M, gateTry) {
  const { spec, C } = ctx; const rng = ctx.streams.districts;
  const { cmask, dRim } = M;
  const pool = spec.districtPool;
  const chosen = [pool.find((d) => d.required)];
  const rest = pool.filter((d) => !d.required).map((d) => ({ ...d }));
  while (chosen.length < spec.districts) { const p = rng.pickWeighted(rest, 'w'); chosen.push(p); rest.splice(rest.indexOf(p), 1); }
  // gate seed: 5-7 cells inside the rim so the 9x9 footprint fits
  const gc = [];
  for (let i = 0; i < C * C; i++) if (cmask[i] === 2 && dRim[i] >= 5 && dRim[i] <= 7) gc.push(i);
  if (!gc.length) return null;
  const gate = gc[rng.int(gc.length)];
  // spawn seed: anywhere at least 4 cells (32 m) inside the rim, at a straight-line distance of
  // 0.50-0.85 x the playable diameter from the gate, drawn uniformly (so it is often inland, and the
  // spawn-gate bearing varies from about 60 to 180 degrees around the map)
  const diam = 2 * (ctx.R - 2);
  const dLo = Math.trunc((50 * diam) / 100), dHi = Math.trunc((85 * diam) / 100);
  const sc = [];
  for (let i = 0; i < C * C; i++) {
    if (cmask[i] !== 2 || dRim[i] < 4) continue;
    const g2 = cd2(C, i, gate);
    if (g2 >= dLo * dLo && g2 <= dHi * dHi) sc.push(i);
  }
  if (!sc.length) return null;
  // half of the seeds put spawn in the inner part of the map (within 0.55 R of the centre) when they can
  const inner = sc.filter((i) => { const dx = 2 * (i % C) + 1 - C, dz = 2 * ((i / C) | 0) + 1 - C; return dx * dx + dz * dz <= (11 * ctx.R / 10) ** 2; });
  const spawnPool = rng.chance(50) && inner.length ? inner : sc;
  const spawn = spawnPool[rng.int(spawnPool.length)];
  const seeds = [gate, spawn];
  // other districts: farthest point (random among the best 6)
  for (let k = 2; k < chosen.length; k++) {
    const cand = [];
    for (let i = 0; i < C * C; i++) {
      if (cmask[i] !== 2 || dRim[i] < 3) continue;
      let md = 1e9; for (const s of seeds) md = Math.min(md, cd2(C, i, s));
      cand.push([md, i]);
    }
    cand.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    seeds.push(cand[rng.int(Math.min(6, cand.length))][1]);
  }
  // order: gate district first, then spawn district
  const districts = chosen.map((d, k) => ({ id: d.id, name: d.name, hero: d.hero, idx: k, gate: !!d.gate, arche: d.arche, seed: seeds[k] }));
  const own = grow(C, cmask, districts.map((d, k) => ({ cell: d.seed, id: k })), () => true, 0x51ED + gateTry);
  return { districts, cdist: own, gate, spawn };
}

function placeRegions(ctx, M, D) {
  const { spec, C } = ctx; const rng = ctx.streams.regions;
  const { cmask } = M;
  const nD = D.districts.length;
  const cellsPer = new Array(nD).fill(0); let tot = 0;
  for (let i = 0; i < C * C; i++) if (D.cdist[i] >= 0) { cellsPer[D.cdist[i]]++; tot++; }
  const [rMin, rMax] = regionRange(ctx, M);
  const target = rng.range(rMin, rMax);
  const quota = cellsPer.map((c) => Math.max(1, Math.round((target * c) / tot)));
  const seeds = D.districts.map((d, k) => ({ cell: d.seed, district: k }));
  const sp = M.playable >= 1000 ? spec.regionSpacing : spec.regionSpacing - 1, sp2 = sp * sp; // 56 m, 48 m on the smaller silhouettes
  const distCells = [];
  for (let k = 0; k < nD; k++) distCells.push([]);
  for (let i = 0; i < C * C; i++) if (D.cdist[i] >= 0 && M.dRim[i] >= 2) distCells[D.cdist[i]].push(i);
  let added = true;
  while (seeds.length < target && added) {
    added = false;
    for (let k = 0; k < nD && seeds.length < target; k++) {
      const have = seeds.filter((s) => s.district === k).length;
      if (have >= quota[k] + (seeds.length < target - 1 ? 0 : 1)) continue;
      const cells = distCells[k]; if (!cells.length) continue;
      let best = -1, bestD = -1;
      for (let t = 0; t < 20; t++) {
        const c = cells[rng.int(cells.length)];
        let md = 1e9; for (const s of seeds) md = Math.min(md, cd2(C, c, s.cell));
        if (cd2(C, c, D.gate) < 81) continue;
        if (md > bestD) { bestD = md; best = c; }
      }
      if (best >= 0 && bestD >= sp2) { seeds.push({ cell: best, district: k }); added = true; }
    }
    if (!added) { // relax quotas once: let any district with room take a seed
      for (let k = 0; k < nD && seeds.length < target; k++) {
        const cells = distCells[k]; let best = -1, bestD = -1;
        for (let t = 0; t < 20; t++) {
          const c = cells[rng.int(cells.length)];
          let md = 1e9; for (const s of seeds) md = Math.min(md, cd2(C, c, s.cell));
          if (cd2(C, c, D.gate) < 81) continue;
          if (md > bestD) { bestD = md; best = c; }
        }
        if (best >= 0 && bestD >= sp2) { seeds.push({ cell: best, district: k }); added = true; }
      }
    }
  }
  return finishRegions(ctx, M, D, seeds);
}

function finishRegions(ctx, M, D, seeds) {
  const { C } = ctx;
  let list = seeds.slice();
  let own;
  for (let iter = 0; iter < 6; iter++) {
    own = grow(C, M.cmask, list.map((s, k) => ({ cell: s.cell, id: k })), (j, k) => D.cdist[j] === list[k].district, 0xA11CE + iter);
    // gate footprint 9x9 and spawn plaza disc
    const gx = D.gate % C, gz = (D.gate / C) | 0;
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const j = (gz + dz) * C + gx + dx; if (M.cmask[j] === 2) { own[j] = 0; D.cdist[j] = 0; } }
    const sx = D.spawn % C, sz = (D.spawn / C) | 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dz * dz > 5) continue; const j = (sz + dz) * C + sx + dx;
      if (M.cmask[j] === 2 && own[j] !== 0) { own[j] = 1; D.cdist[j] = list[1].district; }
    }
    const cnt = new Array(list.length).fill(0);
    for (let i = 0; i < C * C; i++) if (own[i] >= 0) cnt[own[i]]++;
    const small = []; for (let k = 2; k < list.length; k++) if (cnt[k] < 20) small.push(k);
    if (!small.length) break;
    list = list.filter((_, k) => !small.includes(k));
  }
  // keep only the 4-connected component of each region that contains its seed; orphan cells go to a neighbour
  for (let pass = 0; pass < 3; pass++) {
    const keep = new Uint8Array(C * C);
    list.forEach((s, k) => {
      const q = [s.cell]; keep[s.cell] = 1;
      while (q.length) { const i = q.pop(); const x = i % C, z = (i / C) | 0;
        for (const [dx, dz] of N4) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue; const j = zz * C + xx; if (!keep[j] && own[j] === k) { keep[j] = 1; q.push(j); } } }
    });
    let orphans = 0;
    for (let i = 0; i < C * C; i++) {
      if (own[i] < 0 || keep[i]) continue; orphans++;
      const x = i % C, z = (i / C) | 0;
      for (const [dx, dz] of N4) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue; const j = zz * C + xx; if (keep[j] && own[j] >= 0) { own[i] = own[j]; D.cdist[i] = D.cdist[j]; break; } }
    }
    if (!orphans) break;
  }
  const regions = list.map((s, k) => ({ id: k, district: D.cdist[s.cell], seed: s.cell, cells: 0 }));
  const sx = new Array(list.length).fill(0), sz = new Array(list.length).fill(0);
  for (let i = 0; i < C * C; i++) if (own[i] >= 0) { const r = regions[own[i]]; r.cells++; sx[own[i]] += i % C; sz[own[i]] += (i / C) | 0; }
  for (const r of regions) {
    if (r.id <= 1) { r.centre = r.seed; continue; }
    const mx = Math.round(sx[r.id] / Math.max(1, r.cells)), mz = Math.round(sz[r.id] / Math.max(1, r.cells));
    let best = r.seed, bd = 1e9;
    for (let i = 0; i < C * C; i++) if (own[i] === r.id) { const d = (i % C - mx) ** 2 + (((i / C) | 0) - mz) ** 2; if (d < bd) { bd = d; best = i; } }
    r.centre = best;
  }
  return { regions, cregion: own };
}

/* ---------- rooms (the designed layout): 5 to 7 rooms cut from the playable shape by straight bisectors ---------- */
// Every coarse cell goes to the nearest room seed by a Chebyshev-first metric (never a jittered flood fill), so the borders between rooms are long straight runs, axis-aligned or at 45 degrees.
// Each room is its own region, one tier, one named district for the first five. The gate and spawn seeds are chosen as before.
function partitionBox(C, cmask, seeds) {
  const own = new Int16Array(C * C).fill(-1);
  for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) {
    if (cmask[z * C + x] !== 2) continue; let best = -1, bs = 1e9;
    for (let k = 0; k < seeds.length; k++) { const dx = Math.abs(x - seeds[k] % C), dz = Math.abs(z - ((seeds[k] / C) | 0)), s = Math.max(dx, dz) * 16 + dx + dz; if (s < bs) { bs = s; best = k; } }
    own[z * C + x] = best;
  }
  return own;
}
function placeRooms(ctx, M, gateTry) {
  const { spec, C } = ctx; const rng = ctx.streams.districts; const { cmask, dRim } = M;
  const gc = []; for (let i = 0; i < C * C; i++) if (cmask[i] === 2 && dRim[i] >= 5 && dRim[i] <= 7) gc.push(i);
  if (!gc.length) return null;
  const gate = gc[rng.int(gc.length)];
  const diam = 2 * (ctx.R - 2), dLo = Math.trunc((50 * diam) / 100), dHi = Math.trunc((85 * diam) / 100), sc = [];
  for (let i = 0; i < C * C; i++) { if (cmask[i] !== 2 || dRim[i] < 4) continue; const g2 = cd2(C, i, gate); if (g2 >= dLo * dLo && g2 <= dHi * dHi) sc.push(i); }
  if (!sc.length) return null;
  const spawn = sc[rng.int(sc.length)];
  const nRooms = rng.range(spec.regions[0], spec.regions[1]), MINSEP = 7, seeds = [gate, spawn];
  while (seeds.length < nRooms) {                                           // farthest point from every seed so far (random among the best 3), at least 9 cells (72 m) from each
    const cand = []; for (let i = 0; i < C * C; i++) { if (cmask[i] !== 2 || dRim[i] < 2) continue; let md = 1e9; for (const s of seeds) md = Math.min(md, cd2(C, i, s)); if (md >= MINSEP * MINSEP) cand.push([md, i]); }
    if (!cand.length) break; cand.sort((a, b) => b[0] - a[0] || a[1] - b[1]); seeds.push(cand[rng.int(Math.min(3, cand.length))][1]);
  }
  if (seeds.length < spec.regions[0]) { if (globalThis.__TRACE) console.error('rooms: seeds', seeds.length); return null; }
  let own = partitionBox(C, cmask, seeds);
  const gx = gate % C, gz = (gate / C) | 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const j = (gz + dz) * C + gx + dx; if (cmask[j] === 2) own[j] = 0; }       // the gate plaza is region 0
  const sx = spawn % C, sz = (spawn / C) | 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { if (dx * dx + dz * dz > 5) continue; const j = (sz + dz) * C + sx + dx; if (cmask[j] === 2 && own[j] !== 0) own[j] = 1; }
  const cnt = new Array(seeds.length).fill(0); for (let i = 0; i < C * C; i++) if (own[i] >= 0) cnt[own[i]]++;
  { let touch = 0; for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) { const a = own[z * C + x]; if (a < 0) continue; for (const [dx, dz] of N4) { const xx = x + dx, zz = z + dz; if (xx >= C || zz >= C || xx < 0 || zz < 0) continue; const b = own[zz * C + xx]; if ((a === 0 && b === 1) || (a === 1 && b === 0)) touch++; } } if (touch > 0) return null; }       // the spawn room and the gate room never share a wall: there is always a room between them
  if (cnt.some((n) => n < 26)) { if (globalThis.__TRACE) console.error('rooms: small', cnt.join(',')); return null; }                                  // a room under about 2,300 m2 is a closet: re-draw
  const pool = spec.districtPool, chosen = [pool.find((d) => d.required)], rest = pool.filter((d) => !d.required).map((d) => ({ ...d })), nD = Math.min(spec.districts, seeds.length);
  while (chosen.length < nD) { const p = rng.pickWeighted(rest, 'w'); chosen.push(p); rest.splice(rest.indexOf(p), 1); }
  const distOf = (k) => (k < nD ? k : (() => { let b = 0, bd = 1e9; for (let q = 0; q < nD; q++) { const d = cd2(C, seeds[k], seeds[q]); if (d < bd) { bd = d; b = q; } } return b; })());
  const cdist = new Int16Array(C * C).fill(-1); for (let i = 0; i < C * C; i++) if (own[i] >= 0) cdist[i] = distOf(own[i]);
  const districts = chosen.map((d, k) => ({ id: d.id, name: d.name, hero: d.hero, idx: k, gate: !!d.gate, arche: d.arche, seed: seeds[k] }));
  const D = { districts, cdist, gate, spawn };
  const regions = seeds.map((s, k) => ({ id: k, district: distOf(k), seed: s, cells: cnt[k], centre: s }));
  const sxs = new Array(seeds.length).fill(0), szs = new Array(seeds.length).fill(0); for (let i = 0; i < C * C; i++) if (own[i] >= 0) { sxs[own[i]] += i % C; szs[own[i]] += (i / C) | 0; }
  for (const r of regions) { if (r.id <= 1) continue; const mx = Math.round(sxs[r.id] / Math.max(1, r.cells)), mz = Math.round(szs[r.id] / Math.max(1, r.cells)); let best = r.seed, bd = 1e9; for (let i = 0; i < C * C; i++) if (own[i] === r.id) { const d = (i % C - mx) ** 2 + (((i / C) | 0) - mz) ** 2; if (d < bd) { bd = d; best = i; } } r.centre = best; }
  return { D, Rg: { regions, cregion: own } };
}

/* ---------- G3 graph ---------- */
function buildGraph(ctx, M, D, Rg) {
  const { C, spec } = ctx; const rng = ctx.streams.graph;
  const nR = Rg.regions.length;
  const pairs = new Int32Array(nR * nR);
  for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) {
    const a = Rg.cregion[z * C + x]; if (a < 0) continue;
    if (x + 1 < C) { const b = Rg.cregion[z * C + x + 1]; if (b >= 0 && b !== a) pairs[Math.min(a, b) * nR + Math.max(a, b)]++; }
    if (z + 1 < C) { const b = Rg.cregion[(z + 1) * C + x]; if (b >= 0 && b !== a) pairs[Math.min(a, b) * nR + Math.max(a, b)]++; }
  }
  const cen = (r) => [Rg.regions[r].centre % C, (Rg.regions[r].centre / C) | 0];
  const all = [];
  for (let a = 0; a < nR; a++) for (let b = a + 1; b < nR; b++) {
    if (pairs[a * nR + b] < 3) continue;
    const [ax, az] = cen(a), [bx, bz] = cen(b);
    const d = isqrt(((ax - bx) * 800) ** 2 + ((az - bz) * 800) ** 2);
    all.push({ id: all.length, a, b, len: d, w: Math.trunc((d * (1000 + rng.int(301))) / 1000), pairs: pairs[a * nR + b] });
  }
  // Kruskal
  const par = new Int32Array(nR); for (let i = 0; i < nR; i++) par[i] = i;
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const sorted = all.slice().sort((p, q) => p.w - q.w || p.id - q.id);
  const deg = new Int32Array(nR); const chosen = [];
  for (const e of sorted) { const ra = find(e.a), rb = find(e.b); if (ra !== rb) { par[ra] = rb; e.tree = true; chosen.push(e); deg[e.a]++; deg[e.b]++; } }
  // connected?
  const root = find(0); for (let i = 1; i < nR; i++) if (find(i) !== root) return { fail: 'graph_disconnected' };
  const rest = all.filter((e) => !e.tree);
  rng.shuffle(rest);
  const want = Math.round((rest.length * spec.loopRatio) / 100);
  let added = 0;
  for (const e of rest) {
    if (added >= want) break;
    if (deg[e.a] >= 5 || deg[e.b] >= 5) continue;
    e.loop = true; chosen.push(e); deg[e.a]++; deg[e.b]++; added++;
  }
  const sp = 1;
  const addIf = (pred) => { const c = rest.filter((e) => !e.loop && pred(e)).sort((p, q) => p.len - q.len || p.id - q.id); if (!c.length) return false; const e = c[0]; e.loop = true; chosen.push(e); deg[e.a]++; deg[e.b]++; return true; };
  while (chosen.length - nR + 1 < (spec.rooms ? 1 : 2)) if (!addIf((e) => deg[e.a] < 5 && deg[e.b] < 5) && !addIf(() => true)) return { fail: 'graph_cycles' };
  while (deg[sp] < (spec.rooms ? 2 : 3)) if (!addIf((e) => e.a === sp || e.b === sp)) return { fail: 'spawn_degree' };
  // spawn on a cycle (kiting loop near spawn)
  const adj = () => { const A = []; for (let i = 0; i < nR; i++) A.push([]); for (const e of chosen) { A[e.a].push(e.b); A[e.b].push(e.a); } A.forEach((l) => l.sort((p, q) => p - q)); return A; };
  const onCycle = () => {
    const A = adj(); const nb = A[sp]; const seen = new Uint8Array(nR); seen[sp] = 1; const q = [nb[0]]; seen[nb[0]] = 1;
    while (q.length) { const r = q.pop(); for (const t of A[r]) if (!seen[t]) { seen[t] = 1; q.push(t); } }
    return nb.slice(1).some((t) => seen[t]);
  };
  if (!spec.rooms && !onCycle()) {
    const nb = adj()[sp];
    if (!addIf((e) => nb.includes(e.a) && nb.includes(e.b)) || !onCycle()) return { fail: 'spawn_cycle' };
  }
  chosen.sort((p, q) => p.a - q.a || p.b - q.b);
  chosen.forEach((e, k) => { e.id = k; });
  return { edges: chosen, adjacentPairs: pairs, nR };
}

function regionPath(Rg, G, src, dst, excl) { // Dijkstra over the region graph by centre distance; excl: Uint8Array
  const nR = Rg.regions.length;
  const dist = new Array(nR).fill(1e15), prev = new Array(nR).fill(-1), done = new Uint8Array(nR);
  dist[src] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < nR; i++) if (!done[i] && dist[i] < 1e15 && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break; done[u] = 1; if (u === dst) break;
    for (const e of G.edges) {
      const v = e.a === u ? e.b : e.b === u ? e.a : -1; if (v < 0 || (excl && excl[v] && v !== dst)) continue;
      if (dist[u] + e.len < dist[v]) { dist[v] = dist[u] + e.len; prev[v] = u; }
    }
  }
  if (dist[dst] >= 1e15) return null;
  const path = []; for (let r = dst; r >= 0; r = prev[r]) path.push(r); return path.reverse();
}
function estimateLen(ctx, Rg, path) { // coarse chamfer walk restricted to the path's regions
  const C = ctx.C; const nR = Rg.regions.length;
  const inSp = new Uint8Array(nR); for (const r of path) inSp[r] = 1;
  const d = new Int32Array(C * C).fill(0x3FFFFFFF); const h = new Heap(C * C);
  const s = Rg.regions[1].seed, g = Rg.regions[0].seed; d[s] = 0; h.push(0, s);
  while (h.n) {
    const i = h.pop(); const k = h.lastKey; if (k > d[i]) continue; if (i === g) break;
    const x = i % C, z = (i / C) | 0;
    for (const [dx, dz, c] of N8) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue; const j = zz * C + xx; const r = Rg.cregion[j]; if (r < 0 || !inSp[r]) continue; if (k + c < d[j]) { d[j] = k + c; h.push(k + c, j); } }
  }
  return d[g] >= 0x3FFFFFFF ? 1e9 : Math.trunc((d[g] * 8) / 10);
}
function spineOf(ctx, Rg, G, excl = -1) {
  const nR = Rg.regions.length; const ex = new Uint8Array(nR); if (excl >= 0) ex[excl] = 1;
  const path = regionPath(Rg, G, 1, 0, ex); if (!path) return null;
  return { regions: path, estM: estimateLen(ctx, Rg, path) };
}
// Winding spine: spawn -> waypoint region -> gate, never through the keystone and never revisiting a region.
// Waypoints are tried in seeded order; the first whose estimated length is in range and whose length is at
// least spineRatioMin x the straight spawn-gate distance wins. Returns null when none fits.
function windingSpine(ctx, Rg, G, keystone, straightM) {
  const nR = Rg.regions.length; const rng = ctx.streams.graph; const [lo, hi] = ctx.spec.spineLen;
  const order = []; for (let r = 2; r < nR; r++) if (r !== keystone) order.push(r); rng.shuffle(order);
  for (const w of order.slice(0, 10)) {
    const ex = new Uint8Array(nR); if (keystone >= 0) ex[keystone] = 1; ex[0] = 1;
    const p1 = regionPath(Rg, G, 1, w, ex); if (!p1) continue;
    const ex2 = new Uint8Array(nR); if (keystone >= 0) ex2[keystone] = 1; for (const r of p1) if (r !== w) ex2[r] = 1;
    const p2 = regionPath(Rg, G, w, 0, ex2); if (!p2) continue;
    const path = p1.concat(p2.slice(1));
    const estM = estimateLen(ctx, Rg, path);
    if (estM < lo - 10 || estM > hi - 25 || estM * 100 < ctx.spec.spineRatioMin * straightM) continue;
    return { regions: path, estM, waypoint: w };
  }
  return null;
}

// Region count range scales with the playable area (the round silhouette, about 1,080 coarse cells, gets the
// StageSpec range; smaller silhouettes get proportionally fewer regions, never under 10).
export function regionRange(ctx, M) {
  if (ctx.spec.rooms) return ctx.spec.regions.slice();
  const [a, b] = ctx.spec.regions; const k = Math.min(1000, Math.trunc((M.playable * 1000) / 1080));
  return [Math.max(10, Math.trunc((a * k) / 1000)), Math.max(11, Math.trunc((b * k + 999) / 1000))];
}

function pickKeystone(ctx, Rg, D) {
  const C = ctx.C; const sx = D.spawn % C, sz = (D.spawn / C) | 0, gx = D.gate % C, gz = (D.gate / C) | 0;
  const vx = gx - sx, vz = gz - sz, L2 = vx * vx + vz * vz; if (L2 < 1) return -1;
  let best = -1, bd = 17;
  for (const r of Rg.regions) {
    if (r.id <= 1 || r.cells < 20) continue;
    const px = r.centre % C - sx, pz = ((r.centre / C) | 0) - sz;
    const t = px * vx + pz * vz; if (t * 4 < L2 || t * 4 > 3 * L2) continue; // middle half of the line
    const cr = px * vz - pz * vx; const d2 = Math.trunc((cr * cr) / L2); // squared distance to the line (cells)
    if (d2 < bd || (d2 === bd && r.id < best)) { bd = d2; best = r.id; }
  }
  return best;
}

/* ---------- G4 tiers ---------- */
function assignTiers(ctx, Rg, G, spine, keystone = -1) {
  const { spec } = ctx; const rng = ctx.streams.tiers;
  const nR = Rg.regions.length; const [lo, hi] = spec.tierRange;
  const A = []; for (let i = 0; i < nR; i++) A.push([]); for (const e of G.edges) { A[e.a].push(e.b); A[e.b].push(e.a); } A.forEach((l) => l.sort((p, q) => p - q));
  const onSpine = new Uint8Array(nR); for (const r of spine.regions) onSpine[r] = 1;
  const nearSpine = new Uint8Array(nR); for (let r = 0; r < nR; r++) if (!onSpine[r] && A[r].some((n) => onSpine[n] || n === 0)) nearSpine[r] = 1;
  const spineEdgeSet = new Set(); for (let i = 0; i + 1 < spine.regions.length; i++) { const a = spine.regions[i], b = spine.regions[i + 1]; spineEdgeSet.add(Math.min(a, b) * 64 + Math.max(a, b)); }
  const totCells = Rg.regions.reduce((s, r) => s + r.cells, 0);
  for (let tryN = 0; tryN < 10; tryN++) {
    const T = new Int32Array(nR).fill(-99);
    T[1] = 0; T[0] = spec.gateTier;
    const order = []; const seen = new Uint8Array(nR); seen[1] = 1; const q = [1];
    while (q.length) { const r = q.shift(); order.push(r); for (const t of A[r]) if (!seen[t]) { seen[t] = 1; q.push(t); } }
    let ok = true;
    for (const r of order) {
      if (T[r] !== -99) continue;
      const opts = [];
      for (let t = lo; t <= hi; t++) {
        if (A[r].every((n) => T[n] === -99 || Math.abs(T[n] - t) <= 1)) opts.push({ t, w: spec.tierWeights[t - lo] * (CHANNEL_ARCH[Rg.regions[r].archetype] && t === lo ? 2 : 1) });
      }
      if (!opts.length) { ok = false; break; }
      T[r] = rng.pickWeighted(opts, 'w').t;
    }
    if (!ok) continue;
    // spine: at least one tier change (a ramp pair to climb), at most ceil(40%) of its edges
    const sp = spine.regions; const nE = sp.length - 1;
    const maxCh = Math.max(1, Math.ceil((nE * spec.maxSpineChange) / 100));
    const fits = (r, t) => t >= lo && t <= hi && A[r].every((n) => Math.abs(T[n] - t) <= 1) && r !== 1 && r !== 0;
    const chOf = () => { let c = 0; for (let k = 0; k < nE; k++) if (T[sp[k]] !== T[sp[k + 1]]) c++; return c; };
    let ch = chOf();
    for (let i = nE - 1; i >= 0 && ch > maxCh; i--) {
      if (T[sp[i]] !== T[sp[i + 1]] && fits(sp[i + 1], T[sp[i]])) T[sp[i + 1]] = T[sp[i]];
      else if (T[sp[i]] !== T[sp[i + 1]] && fits(sp[i], T[sp[i + 1]])) T[sp[i]] = T[sp[i + 1]];
      ch = chOf();
    }
    if (ch > maxCh) continue;
    if (ch === 0 && nE >= 2) { // lift (or sink) a middle stretch of the spine by one tier
      const mids = []; for (let k = 1; k < nE; k++) mids.push(k); rng.shuffle(mids);
      for (const k of mids) { const r = sp[k]; for (const d of [1, -1]) { if (ch) break; if (fits(r, T[r] + d)) { T[r] += d; ch = chOf(); if (ch > maxCh) { T[r] -= d; ch = 0; } } } if (ch) break; }
      if (!ch) continue;
    }
    // vantage: >= 2 regions at tier >= 2 (when the stage allows it); the keystone first, then regions that
    // border the spine or the gate, so climbing pays off with a view of the route
    const vant = Math.min(2, hi);
    const vantN = () => { let n = 0; for (const t of T) if (t >= vant) n++; return n; };
    if (keystone >= 0) for (let k = 0; k < 2 && T[keystone] < hi && fits(keystone, T[keystone] + 1); k++) T[keystone]++;
    for (let it = 0; it < 12; it++) {
      if (vantN() >= (spec.rooms ? 1 : 2)) break;
      const cands = [];
      for (let r = 2; r < nR; r++) if (!onSpine[r] && T[r] < hi && fits(r, T[r] + 1)) cands.push(r);
      if (!cands.length) break;
      cands.sort((a, b) => nearSpine[b] - nearSpine[a] || T[b] - T[a] || a - b);
      const top = cands.filter((r) => nearSpine[r] === nearSpine[cands[0]] && T[r] === T[cands[0]]);
      const r = top[rng.int(top.length)]; T[r]++;
    }
    if (vantN() < (spec.rooms ? 1 : 2)) continue;
    if (spec.needTopTier) { // e.g. stage 3 must climb to tier 3 somewhere
      for (let it = 0; it < 16 && !T.some((t) => t >= hi); it++) { // climb the highest liftable region step by step
        const c = []; for (let r = 2; r < nR; r++) if (!onSpine[r] && fits(r, T[r] + 1)) c.push(r);
        if (!c.length) break; c.sort((a, b) => T[b] - T[a] || (b === keystone) - (a === keystone) || nearSpine[b] - nearSpine[a] || a - b); T[c[0]]++;
      }
      if (!T.some((t) => t >= hi)) continue;
    }
    // blandness guard: no tier holds more than maxTierAreaPct of the region area
    const area = {}; Rg.regions.forEach((r, k) => { area[T[k]] = (area[T[k]] || 0) + r.cells; });
    if (Object.keys(area).some((k) => area[k] * 100 > spec.maxTierAreaPct * totCells)) continue;
    return { tiers: Array.from(T), spineEdgeSet, changes: chOf() };
  }
  return null;
}

function classifyEdges(ctx, Rg, G, tiers, spineEdgeSet) {
  const rng = ctx.streams.tiers;
  const other = [];
  for (const e of G.edges) {
    e.spine = spineEdgeSet.has(e.a * 64 + e.b);
    const ta = tiers[e.a], tb = tiers[e.b];
    if (ta === tb) e.type = 'open';
    else if (e.spine) e.type = 'ramp2';
    else { e.type = ctx.spec.rooms || rng.chance(70) ? 'ramp2' : 'hopstair'; other.push(e); }
    const lowR = ta < tb ? e.a : e.b, highR = ta < tb ? e.b : e.a;
    e.low = ta === tb ? e.a : lowR; e.high = ta === tb ? e.b : highR;
    e.drop = ta !== tb && Rg.regions[highR].role === 'pocket';
  }
  // every region must be enemy-reachable: promote hop stairs to ramps until the open/ramp graph is connected
  for (let it = 0; it < 64; it++) {
    const seen = new Uint8Array(Rg.regions.length); seen[1] = 1; const q = [1];
    while (q.length) { const r = q.pop(); for (const e of G.edges) { if (e.type === 'hopstair') continue; const o = e.a === r ? e.b : e.b === r ? e.a : -1; if (o >= 0 && !seen[o]) { seen[o] = 1; q.push(o); } } }
    const fix = G.edges.find((e) => e.type === 'hopstair' && seen[e.a] !== seen[e.b]);
    if (!fix) break; fix.type = 'ramp2';
  }
  // >= 60% of non-spine tier changes are enemy ramps
  let r2 = other.filter((e) => e.type === 'ramp2').length;
  for (const e of other) { if (r2 * 100 >= 60 * other.length) break; if (e.type === 'hopstair') { e.type = 'ramp2'; r2++; } }
}

function pickArchetypes(ctx, Rg, D, G) {
  const rng = ctx.streams.regions;
  const nR = Rg.regions.length;
  const nb = []; for (let i = 0; i < nR; i++) nb.push([]);
  for (let a = 0; a < nR; a++) for (let b = a + 1; b < nR; b++) if (G.adjacentPairs[a * nR + b] > 0) { nb[a].push(b); nb[b].push(a); }
  for (const r of Rg.regions) {
    if (r.id === 0) { r.archetype = 'setpiece'; continue; }
    if (r.id === 1) { r.archetype = 'plaza'; continue; }
    const arche = D.districts[r.district].arche;
    const items = Object.keys(arche).sort().map((k) => ({ k, w: arche[k] }));
    if (!arche.dunes) items.push({ k: 'dunes', w: 1 });
    let pick = 'dunes';
    for (let t = 0; t < 10; t++) {
      const p = rng.pickWeighted(items, 'w').k;
      if (CHANNEL_ARCH[p] && nb[r.id].some((n) => n < r.id && CHANNEL_ARCH[Rg.regions[n].archetype])) continue;
      pick = p; break;
    }
    r.archetype = pick;
  }
  // structural identity per stage: e.g. stage 2 needs 2 trenches (pits + chain bridges), stage 3 a sand sea
  if (ctx.spec.rooms) { for (const r of Rg.regions) if (r.id > 1) r.archetype = 'plaza'; return; }       // rooms: flat floors, the identity comes from the kit and the landmark
  const req = ctx.spec.requireArche || {};
  for (const k of Object.keys(req).sort()) {
    let have = Rg.regions.filter((r) => r.archetype === k).length;
    const cand = Rg.regions.filter((r) => r.id > 1 && r.archetype !== k && r.cells >= 30 && !(CHANNEL_ARCH[k] && nb[r.id].some((n) => CHANNEL_ARCH[Rg.regions[n].archetype])))
      .sort((a, b) => (a.role === 'spine') - (b.role === 'spine') || (b.archetype === 'dunes') - (a.archetype === 'dunes') || b.cells - a.cells || a.id - b.id);
    for (const r of cand) { if (have >= req[k]) break; if (CHANNEL_ARCH[k] && nb[r.id].some((n) => CHANNEL_ARCH[Rg.regions[n].archetype])) continue; r.archetype = k; have++; }
  }
}

/* ---------- entry ---------- */
export function buildMacro(ctx) {
  const { C } = ctx;
  const drng = ctx.streams.districts;
  const shape = ctx.fallback ? 'round' : MASK_SHAPES[drng.int(MASK_SHAPES.length)];
  const shapeDir = DIR16[drng.int(16)], lobes = drng.range(3, 5);
  const cmask = buildMask(C, ctx.R, drng.next(), shape, shapeDir, lobes);
  const dRim = bfs4(C, cmask, (i) => cmask[i] === 1);
  let playable = 0; for (let i = 0; i < C * C; i++) if (cmask[i] === 2) playable++;
  const M = { cmask, dRim, playable };
  let fail = 'districts';
  for (let gateTry = 0; gateTry < 4; gateTry++) {
    let D, Rg;
    if (ctx.fallback) { const fb = fallbackDistricts(ctx, M); if (!fb) return { fail: 'fallback_layout' }; D = fb.D; Rg = finishRegions(ctx, M, D, fb.seeds); }
    else if (ctx.spec.rooms) { const rr = placeRooms(ctx, M, gateTry); if (!rr) { fail = 'rooms'; continue; } D = rr.D; Rg = rr.Rg; }
    else { D = placeDistricts(ctx, M, gateTry); if (!D) { fail = 'districts'; continue; } Rg = placeRegions(ctx, M, D); }
    if (Rg.regions.length < regionRange(ctx, M)[0] - (ctx.fallback ? 2 : 0)) { fail = 'region_count'; continue; }
    const G = buildGraph(ctx, M, D, Rg);
    if (G.fail) { fail = G.fail; continue; }
    // keystone: the region nearest the middle of the spawn-gate line. The spine may not cross it, so the
    // safe route bends around it; it becomes the vantage region that carries the stage mega landmark.
    const keystone = pickKeystone(ctx, Rg, D);
    const straightM = isqrt(cd2(C, D.spawn, D.gate) * 6400) / 10;
    let spine = keystone >= 0 ? spineOf(ctx, Rg, G, keystone) : null;
    if (!ctx.fallback && (!spine || spine.estM * 100 < ctx.spec.spineRatioMin * straightM)) spine = windingSpine(ctx, Rg, G, keystone, straightM) || spine;
    if (!spine) spine = spineOf(ctx, Rg, G);
    if (!spine) { fail = 'spine'; continue; }
    const [lo, hi] = ctx.spec.spineLen;
    if (!ctx.fallback) { // cheap early reject of a near-straight safe route (the fine spine is checked again later)
      if (spine.estM * 100 < (ctx.spec.spineRatioMin - 5) * straightM) { fail = 'spine_straight_est'; continue; }
    }
    if (spine.estM < lo - 10 || spine.estM > hi - 25) { fail = 'spine_len_est'; if (ctx.fallback) { /* accept */ } else continue; }
    // roles
    const deg = new Int32Array(Rg.regions.length); for (const e of G.edges) { deg[e.a]++; deg[e.b]++; }
    const onSp = new Set(spine.regions);
    for (const r of Rg.regions) r.role = onSp.has(r.id) ? 'spine' : deg[r.id] === 1 ? 'pocket' : 'branch';
    pickArchetypes(ctx, Rg, D, G);
    const T = assignTiers(ctx, Rg, G, spine, spine.regions.includes(keystone) ? -1 : keystone);
    if (!T) { fail = 'tiers'; continue; }
    Rg.regions.forEach((r, k) => { r.tier = T.tiers[k]; });
    classifyEdges(ctx, Rg, G, T.tiers, T.spineEdgeSet);
    const sig = [];
    for (const e of G.edges) sig.push(e.a, e.b);
    for (const r of Rg.regions) sig.push(r.tier, r.cells);
    return { cmask, dRim, districts: D.districts, cdist: D.cdist, regions: Rg.regions, cregion: Rg.cregion, edges: G.edges,
      shape, keystone: spine.regions.includes(keystone) ? -1 : keystone,
      spineRegions: spine.regions, spineEstM: spine.estM, spineChanges: T.changes, gateSeed: D.gate, spawnSeed: D.spawn,
      signature: fnv1a32Ints(sig), gateTries: gateTry };
  }
  return { fail };
}

function fallbackDistricts(ctx, M) {
  const { C, spec } = ctx;
  const L = FALLBACK_LAYOUTS[ctx.fallbackIndex % FALLBACK_LAYOUTS.length];
  const c0 = (C / 2) | 0; const sc = ctx.R;
  const cell = ([x, z]) => {
    let cx = c0 + Math.trunc((x * sc) / 20), cz = c0 + Math.trunc((z * sc) / 20);
    // snap inward until playable
    for (let k = 0; k < 10 && M.cmask[cz * C + cx] !== 2; k++) { cx += Math.sign(c0 - cx); cz += Math.sign(c0 - cz); }
    return cz * C + cx;
  };
  const pool = spec.districtPool;
  const chosen = [pool.find((d) => d.required), ...pool.filter((d) => !d.required).slice(0, Math.min(spec.districts, 4) - 1)];       // the authored layouts name four districts
  const seeds = L.seeds.map((s, k) => ({ cell: cell(s), district: L.district[k] }));
  // gate must sit with dRim >= 5: walk it inward
  let g = seeds[0].cell;
  for (let k = 0; k < 10 && M.dRim[g] < 5; k++) { const x = g % C, z = (g / C) | 0; g = (z + Math.sign(c0 - z)) * C + x + Math.sign(c0 - x); }
  seeds[0].cell = g;
  const districts = chosen.map((d, k) => ({ id: d.id, name: d.name, hero: d.hero, idx: k, gate: !!d.gate, arche: d.arche, seed: seeds[L.district.indexOf(k)].cell }));
  const own = grow(C, M.cmask, seeds.map((s, k) => ({ cell: s.cell, id: k })), () => true, 0xFA11);
  const cdist = new Int16Array(C * C).fill(-1);
  for (let i = 0; i < C * C; i++) if (own[i] >= 0) cdist[i] = seeds[own[i]].district;
  return { D: { districts, cdist, gate: seeds[0].cell, spawn: seeds[1].cell }, seeds };
}

