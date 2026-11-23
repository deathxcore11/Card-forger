// G7-G9 terrain: 1 m heightfield (int16 cm). Region wobble, tiers, channels, ramps, hop stairs,
// walls, gate set piece, spawn basin, archetype detail, snap/relax/rail passes.
import { isqrt, valueNoise2, catmullRomInt, chamfer, DIR8 } from './imath.js';
import { hash32 } from './seed.js';
import { createMap, F, NONE, refreshWalk } from './map.js';
import { CHANNEL_ARCH } from './spec.js';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// distance (cm) from a 1 m cell centre to a neighbouring 8 m coarse-cell centre, by relative offset (-8..15)
const DT = new Int32Array(24 * 24);
for (let a = 0; a < 24; a++) for (let b = 0; b < 24; b++) DT[a * 24 + b] = isqrt(((a - 8) * 100 - 350) ** 2 + ((b - 8) * 100 - 350) ** 2);
export function initTerrain(ctx, mac) {
  const { C } = ctx; const N = C * 8;
  const m = createMap(N);
  m.C = C; m.macro = mac;
  const seed = ctx.streams.terrain.next();
  m.noiseSeed = seed;
  const creg = mac.cregion, cmask = mac.cmask;
  const regTier = mac.regions.map((r) => r.tier);
  const maxTier = Math.max(...regTier);
  const isBorderC = (cx, cz) => {
    const a = creg[cz * C + cx];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const xx = cx + dx, zz = cz + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) return true;
      if (creg[zz * C + xx] !== a) return true;
    }
    return false;
  };
  const border = new Uint8Array(C * C);
  for (let cz = 0; cz < C; cz++) for (let cx = 0; cx < C; cx++) border[cz * C + cx] = isBorderC(cx, cz) ? 1 : 0;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const cx = x >> 3, cz = z >> 3, ci = cz * C + cx, i = z * N + x;
    let r = creg[ci];
    if (border[ci]) {
      let best = 1e9;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const xx = cx + dx, zz = cz + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue;
        const nci = zz * C + xx;
        const d = DT[(x - xx * 8 + 8) * 24 + (z - zz * 8 + 8)] + ((valueNoise2(x + xx * 131, z + zz * 71, seed, 6) * 150) >> 10);
        if (d < best) { best = d; r = cmask[nci] === 2 ? creg[nci] : -1; }
      }
    } else if (cmask[ci] !== 2) r = -1;
    if (r < 0 || cmask[ci] === 0 && r < 0) {
      m.mask1[i] = cmask[ci] === 0 ? 0 : 1;
      if (m.mask1[i] === 0 && cmask[ci] !== 0) m.mask1[i] = 1;
      m.h0[i] = (maxTier + 2) * 300; m.flags[i] = F.RIM;
    } else {
      m.mask1[i] = 2; m.reg[i] = r; m.h0[i] = regTier[r] * 300;
    }
  }
  return m;
}

/* ---------- channels: canyon / trench / shoal ---------- */
export function carveChannels(ctx, m) {
  const { C, stage } = ctx; const N = m.N; const rng = ctx.streams.terrain; const mac = m.macro;
  for (const R of mac.regions) {
    if (!CHANNEL_ARCH[R.archetype]) continue;
    // interior coarse cells (>= 3, else >= 2 cells from the region edge)
    const own = mac.cregion; const dIn = new Int16Array(C * C).fill(-1); const q = [];
    for (let i = 0; i < C * C; i++) {
      if (own[i] !== R.id) continue; const x = i % C, z = (i / C) | 0; let edge = false;
      for (const [dx, dz] of N4) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C || own[zz * C + xx] !== R.id) edge = true; }
      if (edge) { dIn[i] = 0; q.push(i); }
    }
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % C, z = (i / C) | 0; for (const [dx, dz] of N4) { const j = (z + dz) * C + x + dx; if (own[j] === R.id && dIn[j] < 0) { dIn[j] = dIn[i] + 1; q.push(j); } } }
    let inner = []; for (let i = 0; i < C * C; i++) if (dIn[i] >= 3) inner.push(i);
    if (inner.length < 3) { inner = []; for (let i = 0; i < C * C; i++) if (dIn[i] >= 2) inner.push(i); }
    if (inner.length < 3) continue;
    const A = inner[rng.int(inner.length)];
    let B = A, bd = -1;
    for (const c of inner) { const d = (c % C - A % C) ** 2 + (((c / C) | 0) - ((A / C) | 0)) ** 2; if (d > bd) { bd = d; B = c; } }
    if (bd < 9) continue;
    const pts = [[A % C, (A / C) | 0]];
    const nm = rng.range(1, 3);
    for (let k = 1; k <= nm; k++) {
      let px = Math.round(A % C + ((B % C - A % C) * k) / (nm + 1)), pz = Math.round(((A / C) | 0) + ((((B / C) | 0) - ((A / C) | 0)) * k) / (nm + 1));
      const jx = px + rng.range(-1, 1), jz = pz + rng.range(-1, 1);
      if (dIn[jz * C + jx] >= 2) { px = jx; pz = jz; }
      pts.push([px, pz]);
    }
    pts.push([B % C, (B / C) | 0]);
    const cmPts = pts.map(([x, z]) => [x * 800 + 400, z * 800 + 400]);
    const poly = catmullRomInt(cmPts, 8);
    const cum = [0]; for (let k = 1; k < poly.length; k++) cum.push(cum[k - 1] + isqrt((poly[k][0] - poly[k - 1][0]) ** 2 + (poly[k][1] - poly[k - 1][1]) ** 2));
    const L = cum[cum.length - 1];
    const shoal = R.archetype === 'shoal', trench = R.archetype === 'trench';
    const halfW = shoal ? rng.range(900, 1200) : rng.range(700, 1000);
    const D = shoal ? 300 : trench ? 600 : rng.range(5, 6) * 100;
    const top = R.tier * 300;
    const pitFrom = trench ? Math.trunc(L / 3) : shoal ? 0 : -1, pitTo = trench ? Math.trunc((2 * L) / 3) : shoal ? L + 1 : -1;
    const exits = [];
    if (!shoal) for (let s = 800; s < L - 400; s += 1600) if (!(s >= pitFrom - 400 && s <= pitTo + 400)) exits.push(s);
    const g = { region: R.id, poly, len: L, halfW, depth: D, top, pit: pitFrom >= 0, exits };
    m.gullies.push(g);
    const ext = halfW + 2 * D + 200;
    let x0 = N, x1 = 0, z0 = N, z1 = 0;
    for (const [px, pz] of poly) { x0 = Math.min(x0, ((px - ext) / 100) | 0); x1 = Math.max(x1, ((px + ext) / 100) | 0); z0 = Math.min(z0, ((pz - ext) / 100) | 0); z1 = Math.max(z1, ((pz + ext) / 100) | 0); }
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(N - 1, x1); z1 = Math.min(N - 1, z1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = z * N + x; if (m.reg[i] !== R.id) continue;
      const px = x * 100 + 50, pz = z * 100 + 50;
      let bd2 = 1e18, bs = 0;
      for (let k = 0; k + 1 < poly.length; k++) {
        const ax = poly[k][0], az = poly[k][1], bx = poly[k + 1][0], bz = poly[k + 1][1];
        const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
        let t = l2 ? ((px - ax) * vx + (pz - az) * vz) : 0;
        t = t < 0 ? 0 : t > l2 ? l2 : t;
        const qx = l2 ? ax + Math.trunc((vx * t) / l2) : ax, qz = l2 ? az + Math.trunc((vz * t) / l2) : az;
        const d2 = (px - qx) ** 2 + (pz - qz) ** 2;
        if (d2 < bd2) { bd2 = d2; bs = cum[k] + (l2 ? Math.trunc(((cum[k + 1] - cum[k]) * t) / l2) : 0); }
      }
      const d = isqrt(bd2);
      const depthAt = (s) => Math.max(0, Math.min(D, s >> 1, (L - s) >> 1));
      const dep = shoal ? D : depthAt(bs);
      if (d <= halfW && dep > 0) {
        m.h0[i] = top - dep; m.flags[i] |= F.GULLY; m.nodetail[i] = 1;
        if (bs >= pitFrom && bs <= pitTo && pitFrom >= 0) { m.flags[i] |= F.PIT; m.h0[i] = top - D - (shoal ? 0 : 500); } // trench pits are a 5 m chasm below the trench floor
        continue;
      }
      // exit ramps cut into the bank, 1:2
      for (const s of exits) {
        if (Math.abs(bs - s) > 450) continue;
        const de = depthAt(s);
        if (d > halfW && d <= halfW + 2 * de) {
          const h = top - de + ((d - halfW) >> 1);
          if (h < m.h0[i]) { m.h0[i] = h; m.flags[i] |= F.RAMP; m.nodetail[i] = 1; }
        }
      }
    }
  }
}

/* ---------- ramps and hop stairs ---------- */
function rectCells(m, P, dir, u0, u1, hv, fn) {
  const N = m.N; const ext = Math.max(Math.abs(u0), Math.abs(u1), hv) + 100;
  const x0 = Math.max(0, ((P[0] - ext) / 100) | 0), x1 = Math.min(N - 1, ((P[0] + ext) / 100) | 0);
  const z0 = Math.max(0, ((P[1] - ext) / 100) | 0), z1 = Math.min(N - 1, ((P[1] + ext) / 100) | 0);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const rx = x * 100 + 50 - P[0], rz = z * 100 + 50 - P[1];
    const u = rx * dir[0] + rz * dir[1], v = -rx * dir[1] + rz * dir[0];
    if (u < u0 || u >= u1 || v < -hv || v >= hv) continue;
    if (fn(z * N + x, u, v) === false) return false;
  }
  return true;
}
const BLOCK_T = F.GULLY | F.RAMP | F.SOLID | F.ARENA | F.PONLY | F.SPAWNB | F.CHUNK | F.PIT;

export function tryRamp(m, P, dir, W, lowH, highH, regs, opts = {}) {
  const hv = (W >> 1) + 100;
  const ok = rectCells(m, P, dir, -900, 900, hv, (i) => {
    if (m.mask1[i] !== 2) return false;
    if (regs && !regs.includes(m.reg[i])) return false;
    if (m.flags[i] & BLOCK_T) return false;
  });
  if (!ok) return null;
  const rise = highH - lowH; const half = rise; // slope length = rise*2 cm (1:2)
  const s0 = -half, s1 = half; // slope spans u in [-rise, rise) -> 2*rise cm long at 1:2
  rectCells(m, P, dir, -900, 900, hv, (i, u, v) => {
    const hRamp = u < s0 ? lowH : u >= s1 ? highH : lowH + ((u - s0) >> 1);
    m.nodetail[i] = 1;
    if (Math.abs(v) < (W >> 1) || v === -(W >> 1)) {
      m.h0[i] = hRamp; if (u >= s0 && u < s1) m.flags[i] |= F.RAMP;
    } else if (u >= s0 - 100 && u < s1 + 100) {
      m.h0[i] = hRamp + 100; m.flags[i] |= F.SOLID; // 1 m shoulder kerb
    } else m.h0[i] = hRamp;
  });
  const r = { P, dir, W, lowH, highH, edge: opts.edge ?? -1, spine: !!opts.spine, kind: opts.kind || 'ramp2' };
  m.ramps.push(r);
  return r;
}

export function tryHopstair(m, P, dir, lowH, highH, regs, opts = {}) {
  const ok = rectCells(m, P, dir, -800, 400, 300, (i) => {
    if (m.mask1[i] !== 2) return false;
    if (regs && !regs.includes(m.reg[i])) return false;
    if (m.flags[i] & BLOCK_T) return false;
  });
  if (!ok) return null;
  rectCells(m, P, dir, -800, 400, 300, (i, u) => {
    m.nodetail[i] = 1;
    if (u < -400) { m.h0[i] = lowH + 140; m.flags[i] |= F.PONLY; }
    else if (u < 0) { m.h0[i] = lowH + 280; m.flags[i] |= F.PONLY; }
    else m.h0[i] = highH;
  });
  const h = { P, dir, lowH, highH, edge: opts.edge ?? -1 };
  m.hopstairs.push(h);
  return h;
}

function borderPairs(ctx, mac, a, b) { // coarse pairs (cell in a, cell in b)
  const C = ctx.C, own = mac.cregion, out = [];
  for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) {
    if (own[z * C + x] !== a) continue;
    for (const [dx, dz] of N4) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C) continue; if (own[zz * C + xx] === b) out.push({ ax: x, az: z, dx, dz }); }
  }
  return out;
}

export function carveTransitions(ctx, m) {
  const mac = m.macro; const rng = ctx.streams.terrain; const nR = mac.regions.length;
  const fails = [];
  for (const e of mac.edges) {
    if (e.type === 'open') continue;
    const lo = e.low, hi = e.high;
    const ps = borderPairs(ctx, mac, lo, hi);
    const ca = mac.regions[lo].centre, cb = mac.regions[hi].centre;
    const tx = -(((cb / ctx.C) | 0) - ((ca / ctx.C) | 0)), tz = (cb % ctx.C) - (ca % ctx.C);
    ps.forEach((p) => { p.P = [(2 * p.ax + p.dx) * 400 + 400, (2 * p.az + p.dz) * 400 + 400]; p.k = p.P[0] * tx + p.P[1] * tz; });
    ps.sort((p, q) => p.k - q.k || p.ax - q.ax || p.az - q.az);
    const lowH = mac.regions[lo].tier * 300, highH = mac.regions[hi].tier * 300;
    const tryAt = (idx0, fn) => { for (const off of [0, 1, -1, 2, -2, 3, -3, 4, -4]) { const k = idx0 + off; if (k < 0 || k >= ps.length) continue; const p = ps[k]; const r = fn(p); if (r) return r; } return null; };
    if (e.type === 'ramp2') {
      const n = ps.length; let made = 0;
      for (const frac of [1, 2]) {
        const W = e.spine ? 1200 : rng.range(4, 6) * 200;
        const r = tryAt(Math.trunc((n * frac) / 3), (p) => tryRamp(m, p.P, [p.dx, p.dz], W, lowH, highH, [lo, hi], { edge: e.id, spine: e.spine }));
        if (r) made++;
      }
      e.ramps = made;
      if (!made) {
        if (e.spine) fails.push('spine_ramp');
        else { const h = tryAt(n >> 1, (p) => tryHopstair(m, p.P, [p.dx, p.dz], lowH, highH, [lo, hi], { edge: e.id })); if (h) e.type = 'hopstair'; else fails.push('transition'); }
      }
    } else if (e.type === 'hopstair') {
      const h = tryAt(ps.length >> 1, (p) => tryHopstair(m, p.P, [p.dx, p.dz], lowH, highH, [lo, hi], { edge: e.id }));
      if (!h) { const r = tryAt(ps.length >> 1, (p) => tryRamp(m, p.P, [p.dx, p.dz], 800, lowH, highH, [lo, hi], { edge: e.id })); if (r) e.type = 'ramp2'; else fails.push('transition'); }
    }
  }
  // walls on same-tier borders that have no graph edge
  const isEdge = new Uint8Array(nR * nR);
  for (const e of mac.edges) { isEdge[e.a * nR + e.b] = 1; isEdge[e.b * nR + e.a] = 1; }
  const N = m.N;
  if (globalThis.__NOWALLS) return fails;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; const a = m.reg[i]; if (a === 255) continue;
    for (const [dx, dz] of N4) {
      const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue;
      const b = m.reg[zz * N + xx]; if (b === 255 || b === a || a > b) continue;
      if (mac.regions[a].tier !== mac.regions[b].tier || isEdge[a * nR + b]) continue;
      if (m.flags[i] & (F.RAMP | F.GULLY)) continue;
      // ruin wall with breaches: about one coarse segment in three stays open
      if (hash32((((z >> 3) * 97 + (x >> 3)) * 131 + a * 7 + b) >>> 0) % 3 === 0) continue;
      m.flags[i] |= F.SOLID; m.h0[i] = mac.regions[a].tier * 300 + 300; m.nodetail[i] = 1;
    }
  }
  return fails;
}

/* ---------- gate set piece ---------- */
export function buildArena(ctx, m) {
  const mac = m.macro; const N = m.N; const C = ctx.C;
  const g = mac.regions[0]; const gx = (g.seed % C) * 800 + 400, gz = ((g.seed / C) | 0) * 800 + 400;
  const base = g.tier * 300;
  // entrance directions: towards the previous spine region first
  const prev = mac.regions[mac.spineRegions[mac.spineRegions.length - 2]];
  const px = (prev.centre % C) * 800 + 400 - gx, pz = ((prev.centre / C) | 0) * 800 + 400 - gz;
  const valid = DIR8.map(([dx, dz], k) => {
    const tx = gx + Math.trunc((dx * 4200) / 1000), tz = gz + Math.trunc((dz * 4200) / 1000);
    const cx = (tx / 100) | 0, cz = (tz / 100) | 0; if (cx < 0 || cz < 0 || cx >= N || cz >= N) return null;
    const i = cz * N + cx; if (m.mask1[i] !== 2) return null;
    const r = m.reg[i]; if (r !== 0 && mac.regions[r].tier !== g.tier) return null;
    return { k, dot: dx * px + dz * pz };
  }).filter(Boolean);
  if (valid.length < 2) return { fail: 'arena_entrances' };
  valid.sort((a, b) => b.dot - a.dot || a.k - b.k);
  const picks = [valid[0].k];
  const cand = valid.slice(1).map((v) => v.k);
  while (picks.length < 3 && cand.length) {
    let best = -1, bs = -1;
    for (const k of cand) { let md = 9; for (const p of picks) { const d = Math.min((k - p + 8) % 8, (p - k + 8) % 8); md = Math.min(md, d); } if (md > bs) { bs = md; best = k; } }
    if (bs < 2) break; picks.push(best); cand.splice(cand.indexOf(best), 1);
  }
  picks.sort((a, b) => a - b);
  const ents = picks.map((k) => DIR8[k]);
  const R0 = 2200, R1 = 2700, RA = 3600;
  const x0 = Math.max(0, ((gx - RA) / 100) | 0), x1 = Math.min(N - 1, ((gx + RA) / 100) | 0);
  const z0 = Math.max(0, ((gz - RA) / 100) | 0), z1 = Math.min(N - 1, ((gz + RA) / 100) | 0);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * N + x; if (m.mask1[i] !== 2) continue;
    const rx = x * 100 + 50 - gx, rz = z * 100 + 50 - gz; const d = isqrt(rx * rx + rz * rz);
    if (d > RA) continue;
    if (d > R1 && m.reg[i] !== 0) continue;
    m.nodetail[i] = 1;
    m.flags[i] &= ~(F.SOLID | F.RAMP | F.GULLY | F.PIT | F.PONLY);
    m.h0[i] = base;
    if (d <= R0) m.flags[i] |= F.ARENA;
    else if (d <= R1) {
      let open = false;
      for (const [dx, dz] of ents) { const along = rx * dx + rz * dz, perp = Math.abs(-rx * dz + rz * dx); if (along > 0 && perp <= 700 * 1000) open = true; }
      if (!open) { m.flags[i] |= F.SOLID; m.h0[i] = base + 400; } else m.flags[i] |= F.ENTRY;
    }
  }
  m.arena = { x: gx, z: gz, r: R0, ring: R1, tier: g.tier, mainDir: DIR8[valid[0].k],
    entrances: ents.map(([dx, dz]) => [gx + Math.trunc((dx * 2450) / 1000), gz + Math.trunc((dz * 2450) / 1000)]),
    // set-piece anchors for the gate boss (sigils, pillar sockets, perches, charge lanes, Toll Bell pull point)
    sigils: [[gx - 800, gz], [gx + 800, gz], [gx, gz - 800], [gx, gz + 800]],
    pillarSockets: DIR8.filter((_, k) => k % 2 === 1).map(([dx, dz]) => [gx + Math.trunc((dx * 1500) / 1000), gz + Math.trunc((dz * 1500) / 1000)]),
    chargeLanes: ents.map(([dx, dz]) => [[gx + Math.trunc((dx * 2000) / 1000), gz + Math.trunc((dz * 2000) / 1000)], [gx - Math.trunc((dx * 2000) / 1000), gz - Math.trunc((dz * 2000) / 1000)]]),
    tollBell: [gx, gz] };
  return {};
}

export function spawnBasin(ctx, m) {
  const mac = m.macro; const C = ctx.C; const N = m.N;
  const s = mac.regions[1]; const sx = (s.seed % C) * 800 + 400, sz = ((s.seed / C) | 0) * 800 + 400;
  m.spawn = { x: sx, z: sz };
  const base = s.tier * 300;
  for (let z = ((sz - 1800) / 100) | 0; z <= ((sz + 1800) / 100) | 0; z++) for (let x = ((sx - 1800) / 100) | 0; x <= ((sx + 1800) / 100) | 0; x++) {
    const i = z * N + x; if (m.mask1[i] !== 2) continue;
    const d2 = (x * 100 + 50 - sx) ** 2 + (z * 100 + 50 - sz) ** 2;
    if (d2 > 1700 * 1700) continue;
    if (m.flags[i] & (F.RAMP | F.SOLID | F.GULLY | F.PONLY | F.ARENA)) continue;
    m.h0[i] = base; m.flags[i] |= F.SPAWNB; m.nodetail[i] = 1;
  }
}

/* ---------- archetype detail ---------- */
// [amplitude cm, wavelength m] octaves. The long 40-48 m swells keep big same-tier fields from reading as one
// flat sheet (slopes stay under 3%), the short octave is surface texture.
const DETAIL = { plaza: [[15, 16], [100, 48]], dunes: [[85, 24], [25, 8], [90, 48]], necropolis: [[10, 12], [80, 40]], graveyard: [[25, 12], [90, 40]], canyon: [[30, 16]],
  mesa: [[20, 16], [40, 40]], terraces: [[10, 12], [55, 40]], setpiece: [], trench: [[20, 12], [40, 40]], shoal: [[20, 12]] };
export function applyDetail(ctx, m) {
  const N = m.N; const mac = m.macro;
  const src = new Uint8Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x;
    if (m.mask1[i] !== 2 || m.nodetail[i]) { src[i] = 1; continue; }
    const a = m.reg[i];
    if ((x > 0 && m.reg[i - 1] !== a) || (x < N - 1 && m.reg[i + 1] !== a) || (z > 0 && m.reg[i - N] !== a) || (z < N - 1 && m.reg[i + N] !== a)) src[i] = 1;
  }
  const d = chamfer(N, src);
  const seed = m.noiseSeed;
  // per-region swell bias (-90..+90 cm, faded to 0 over 6 m at region borders): neighbouring same-tier
  // regions sit at slightly different heights, so a tier is never one flat sheet; slopes stay under 20%
  const bias = mac.regions.map((r) => (r.id <= 1 || r.archetype === 'setpiece' || CHANNEL_ARCH[r.archetype] ? 0 : ((hash32((seed ^ Math.imul(r.id + 1, 0x9E3779B1)) >>> 0) % 5) - 2) * 45));
  for (let i = 0; i < N * N; i++) {
    if (src[i] || m.mask1[i] !== 2) continue;
    const oct = DETAIL[mac.regions[m.reg[i]].archetype] || [];
    if (!oct.length) continue;
    const fade = Math.min(d[i], 60);
    const x = i % N, z = (i / N) | 0;
    let v = bias[m.reg[i]];
    oct.forEach(([amp, wl], k) => { v += (valueNoise2(x, z, (seed + k * 7919) >>> 0, wl) * amp) >> 10; });
    m.h0[i] += Math.trunc((v * fade) / 60);
  }
}

/* ---------- finalise: relax, snap, rails ---------- */
const PROT = F.CHUNK | F.RAMP | F.PONLY | F.SOLID | F.ARENA | F.SPAWNB;
export function finalizeTerrain(m) {
  const N = m.N; const h = m.h0; const fl = m.flags;
  refreshWalk(m);
  const W = (i) => (fl[i] & F.WALK) !== 0;
  // relax 76-119 cm steps on unprotected cells (3 passes)
  const delta = new Int32Array(N * N);
  for (let pass = 0; pass < 3; pass++) {
    delta.fill(0);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x; if (!W(i)) continue;
      for (const j of [x + 1 < N ? i + 1 : -1, z + 1 < N ? i + N : -1]) {
        if (j < 0 || !W(j)) continue;
        const d = h[i] - h[j], a = Math.abs(d);
        if (a < 76 || a > 119) continue;
        if ((fl[i] | fl[j]) & PROT) continue;
        const s = Math.trunc(d / 3);
        delta[i] -= s; delta[j] += s;
      }
    }
    for (let i = 0; i < N * N; i++) if (delta[i]) h[i] += Math.trunc(delta[i] / 2);
  }
  // snap forbidden band (181-259) to 140 / 300 by moving the lower cell (2 passes), then rails
  let snapped = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x; if (!W(i)) continue;
      for (const j of [x + 1 < N ? i + 1 : -1, z + 1 < N ? i + N : -1]) {
        if (j < 0 || !W(j)) continue;
        const d = Math.abs(h[i] - h[j]); if (d < 181 || d > 259) continue;
        const lo = h[i] < h[j] ? i : j, hi = lo === i ? j : i;
        if (fl[lo] & PROT || fl[lo] & F.GULLY) continue;
        if (d - 140 <= 300 - d) h[lo] = h[hi] - 140; else h[lo] = h[hi] - 300;
        snapped++;
      }
    }
  }
  let rails = 0;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; if (!W(i)) continue;
    for (const j of [x + 1 < N ? i + 1 : -1, z + 1 < N ? i + N : -1, x > 0 ? i - 1 : -1, z > 0 ? i - N : -1]) {
      if (j < 0 || !W(j) || !W(i)) continue;
      const d = Math.abs(h[i] - h[j]); if (d < 181 || d > 259) continue;
      const hi = h[i] > h[j] ? i : j;
      fl[hi] = (fl[hi] | F.SOLID) & ~F.WALK; h[hi] += 60; rails++;
    }
  }
  m.snapped = snapped; m.rails = rails;
  refreshWalk(m);
}

