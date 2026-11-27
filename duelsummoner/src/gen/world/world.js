// The big desert: a world 32 km across made of seeded regions, never stored whole. Every number comes from (seed, x, z) or (seed, cell), so a chunk can be built when the duelist nears it and dropped when they leave, and the same seed always gives the same world.
// The land has a plan. A macro layer cuts the world into regions of 1 to 3 km (jittered cells of 2200 m), each with one character: a dune sea, a mesa field, a dry lake bed, a canyon run, a ruin field of carved stone cards, a dead forest, a ridge spine.
// Heights blend between the two nearest regions over about 640 m, so there are no seams. A slow global rise and fall sits under all of it. A ring of steep mountains closes the world.
// Everything placed lives in 256 m cells (one pocket of things to do, mesas and ruin blocks, sometimes a boss ring), and a landmark (tall mesa, spire, giant half-sunk card) in each 1100 m cell so a place can be seen from far off.
// The sim reads the heights as 1 m cells (fillSim, in 64 m chunks), the view as the plain ground without the box of a mesa (viewH): the same split the first open desert made.
import { vnoise, duneH, blockProf as prof, qOf, bankOf, reachOf, block, sstep, rngOf, cosA, sinA, cbrt, MAX_DROP } from '../open/terrain.js';
const TAU = 6.283185307179586;
// a boon shrine's riding course (plan section 10), pure from its place: a Ring Shrine has a stone ring rail round the altar (16 pieces at 6.2 m), a Gate Shrine a line of five arches leading in
export function shrineCourse(x, z) { const k = ((Math.floor(x * 7 + z * 13) % 1000) + 1000) % 1000, kind = ['ring', 'gate', 'bowl', 'spire', 'pipe'][k % 5], a = k / 1000 * 6.283185307179586, ux = cosA(a), uz = sinA(a), ring = [], arches = [], marks = [];
  let spire = null, pipe = null; if (kind === 'bowl') for (let i = 0; i < 12; i++) { const t = i / 12 * 6.283185307179586; marks.push([x + cosA(t) * 15, z + sinA(t) * 15]); }       // a Bowl Shrine: twelve marker stones on a 15 m circle, ride laps inside them
  if (kind === 'spire') spire = { x: x + ux * 9, z: z + uz * 9, h: 2.6, top: 9 };       // a Spire Shrine: a 9 m needle beside the altar with a gold band at 2.6 m: air past it above the band
  if (kind === 'pipe') pipe = { x: x + ux * 16, z: z + uz * 16, ux: -uz, uz: ux, R: 5.5 };       // a Pipe Shrine: a full pipe 16 m out
  if (kind === 'ring') for (let i = 0; i < 16; i++) { const t = i / 16 * 6.283185307179586; ring.push([x + cosA(t) * 6.2, z + sinA(t) * 6.2]); }
  else for (let i = 0; i < 5; i++) { const d = 12 + i * 9; arches.push({ x: x + ux * d, z: z + uz * d, ux, uz }); }
  return { kind, ring, arches, marks, spire, pipe }; }
export const WORLD_HALF = 16000, EDGE = 15600, RC = 2200, Q = 256, LC = 1100, WALL = 99;
export const REGION = ['Dune Sea', 'Mesa Field', 'Dry Lake', 'Canyon Run', 'Ruin Field', 'Dead Forest', 'Ridge Spine'];
// square root from + - * / and a bit-trick start only (no Math.sqrt): the same bits on every machine
const F64 = new Float64Array(1), I32 = new Int32Array(F64.buffer);
const sq = v => { if (!(v > 0)) return 0; F64[0] = v; I32[1] = (I32[1] >> 1) + 0x1FF80000; let x = F64[0]; x = 0.5 * (x + v / x); x = 0.5 * (x + v / x); x = 0.5 * (x + v / x); return 0.5 * (x + v / x); };
export { sq };
const r2 = v => Math.round(v * 100) / 100;
const hsh = (s, a, b, c) => { let h = (s ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 0x9E3779B1)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const r4 = (x, z) => sq(sq(x * x * x * x + z * z * z * z));
const dist = (ax, az, bx, bz) => sq((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
// pocket kinds by weight (the first four are the free things of the stage, the broker is rare)
const POCKETS2 = [['wager', 0.08], ['vases', 0.63], ['stone', 0.08], ['cchest', 0.08], ['shrine', 0.1], ['broker', 0.02], ['altar', 0.02]];
const POCKETS = [['wager', 0.12], ['vases', 0.45], ['cchest', 0.13], ['shrine', 0.15], ['stone', 0.07], ['altar', 0.04], ['broker', 0.04]];
// blocks per cell by region type: [mesa p/count, wall, ruin]  (counts are lo..hi inclusive)
const COUNTS = [[[0, 0, 0], [0, 0, 0], [0, 1, 0.15]], [[3, 4, 1], [0, 1, 0.6], [1, 2, 1]], [[0, 1, 0.1], [0, 0, 0], [0, 1, 0.3]], [[1, 2, 1], [0, 1, 0.5], [0, 1, 0.4]], [[0, 1, 0.4], [0, 0, 0], [4, 7, 1]], [[0, 1, 0.2], [0, 0, 0], [0, 1, 0.5]], [[0, 1, 0.5], [1, 1, 0.4], [0, 1, 0.3]]];

export function makeWorld(seedLo, stageIndex, opts) {
  const seed = ((seedLo >>> 0) ^ Math.imul(stageIndex + 1, 0x85EBCA6B)) >>> 0, rr = rngOf(seed ^ 0xC0FFEE), wind = rr() * TAU, WP = { wind };
  const W = { seed, wind, stage: stageIndex, regionNames: REGION, extra: [] };
  if (opts && opts.gym) W.gym = { x: 0, z: 0, r: 110, edge: 150 };       // the ride gym (?gym=1): a flat 200 m arena round (0, 0) with set pieces, see gymH and the gym dressing
  // great drops (plan section 9): two per map, 450 to 800 m from the middle where the start is, from the seed alone. Each: a long approach rising to a 10 to 14 m shelf, a 45% cliff, then a long landing slope down to the land
  W.drops = []; { const dr = rngOf(seed ^ 0xD80B); for (let k = 0; k < 2; k++) { const a = dr() * TAU, r = 450 + dr() * 350, H = 10 + dr() * 4, e = a + (dr() - 0.5) * 0.8; W.drops.push({ x: cosA(a) * r, z: sinA(a) * r, c: cosA(e), s: sinA(e), H, w: 34 + dr() * 14 }); } }
  // the drop's land is its own: inside its footprint the dunes are smoothed to the level at its foot, so the shelf, the cliff and the landing slope are what you ride
  const dropAt = (x, z, h0) => { for (const d of W.drops) { const dx = x - d.x, dz = z - d.z; if (dx * dx + dz * dz > 150 * 150) continue; const a = dx * d.c + dz * d.s, b = Math.abs(-dx * d.s + dz * d.c); if (b > d.w + 16 || a < -110 || a > 100) continue;
    if (d.ref === undefined) d.ref = base0(d.x + d.c * 30, d.z + d.s * 30);
    let p = a < -90 ? 0 : a < -20 ? (a + 90) / 70 : a < 0 ? 1 : a < 2 ? 1 - 0.45 * (a / 2) : a < 34 ? 0.55 - 0.45 * (a - 2) / 32 : a < 80 ? 0.1 * (1 - (a - 34) / 46) : 0; const sp = a < 0 || a >= 2 ? p * p * (3 - 2 * p) * 0.5 + p * 0.5 : p;
    const m = (1 - sstep(d.w, d.w + 16, b)) * sstep(-110, -90, a) * (1 - sstep(80, 100, a)); return h0 * (1 - m) + (d.ref + d.H * sp) * m; } return h0; };
  W.dropH = (x, z) => dropAt(x, z, 0);
  // the start valley: one wave valley through the middle of the map, where the start is, whatever the land there, so every run opens with a line to ride (it fades out 700 m away)
  { const sr = rngOf(seed ^ 0x5A11), a = sr() * TAU; W.sv = { c: cosA(a), s: sinA(a), off: (sr() - 0.5) * 0 }; }
  const startValleyQ = (x, z) => { const S = W.sv, u = x * S.c + z * S.s; if (u > 700 || u < -700) return 0; const v = -x * S.s + z * S.c + 22 * sinA(u / 90) - S.off, d = Math.abs(v) / 36; if (d >= 1) return 0; const q = 1 - d * d; return q * q * (1 - sstep(450, 700, Math.abs(u))); };
  W.startValleyQ = startValleyQ;
  // ---- regions
  const regs = new Map();
  function region(rx, rz) {
    const k = (rx + 64) * 256 + (rz + 64); let R = regs.get(k); if (R) return R;
    const rn = rngOf(hsh(seed, rx, rz, 0x51)), cx = (rx + 0.18 + 0.64 * rn()) * RC, cz = (rz + 0.18 + 0.64 * rn()) * RC; let t = rn(), type = 0, acc = 0;
    for (const [i, w] of [[0, 0.24], [1, 0.16], [2, 0.1], [3, 0.12], [4, 0.14], [5, 0.12], [6, 0.12]]) { acc += w; if (t < acc) { type = i; break; } }
    if (rx === 0 && rz === 0) type = 0; if (rx === -1 && rz === -1) type = 0;
    R = { id: k, rx, rz, cx, cz, type, rn: rngOf(hsh(seed, rx, rz, 0x52)) }; R.P = dparams(R); regs.set(k, R); return R;
  }
  function dparams(R) {
    const rn = R.rn, th = rn() * TAU, side = rn() < 0.5 ? -1 : 1, P = { seed: hsh(seed, R.rx, R.rz, 7) | 0, k: 0.6 + rn() * 0.06, k2: 0.56 + rn() * 0.1, p1: rn() * 50, p2: rn() * 50, shift: 0, shelf: 0, warp: 40, big: [], pan: null, wind };
    let l1 = 70 + rn() * 70, a1 = 4.5 + rn() * 6, l2 = 28 + rn() * 17, a2 = 2 + rn() * 2, lo = 2 + rn() * 2.5, th2 = th + side * (0.3 + rn() * 0.4), nBig = 0;
    const T = R.type;
    if (T === 0) { l1 = 110 + rn() * 30; th2 = th + side * 0.25; P.warp = 34; nBig = 5; }
    else if (T === 1) { a1 = 3 + rn() * 2; a2 = 1.5 + rn(); l1 = 80 + rn() * 40; }
    else if (T === 2) { a1 = 0.6 + rn() * 0.6; a2 = 0.3 + rn() * 0.3; lo = 1; l1 = 140 + rn() * 40; }
    else if (T === 3) { a1 = 3.5 + rn() * 2; a2 = 1.6 + rn(); R.trD = 5 + rn() * 2.5; }
    else if (T === 4) { l1 = 60 + rn() * 20; a1 = 3 + rn() * 1.5; l2 = 26 + rn() * 8; P.warp = 50; }
    else if (T === 5) { a1 = 4 + rn() * 2; l1 = 90 + rn() * 30; }
    else { a1 = 3 + rn(); a2 = 1.5 + rn(); R.rgH = 14 + rn() * 6; }
    a1 = Math.min(a1, 0.1 * l1); a2 = Math.min(a2, 0.1 * l2);
    Object.assign(P, { l1, a1, l2, a2, lo, c1: cosA(th), s1: sinA(th), c2: cosA(th2), s2: sinA(th2) });
    const c0 = [R.cx, R.cz], sp = cosA(th), ss = sinA(th);
    for (let k = 0; k < nBig; k++) { const H = 14 + rn() * 4, x = c0[0] + (rn() - 0.5) * 1100, z = c0[1] + (rn() - 0.5) * 1100, ang = th + (rn() - 0.5) * 0.4; P.big.push({ x, z, c: cosA(ang), s: sinA(ang), H, Lw: 85 + rn() * 25, Ll: Math.max(60, 2.1 * H / 0.48), W: 75 + rn() * 30, sd: Math.floor(rn() * 1e6) }); }
    void sp; void ss; R.off = 0.5 * a1 * 1.1 + 0.5 * a2 + 0.5 * lo + 0.2; return P;
  }
  const NN = { A: null, B: null, da: 0, db: 0 };
  function near2(x, z) {
    const rx0 = Math.floor(x / RC), rz0 = Math.floor(z / RC); let A = null, B = null, da = 1e18, db = 1e18;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const R = region(rx0 + i, rz0 + j), dx = x - R.cx, dz = z - R.cz, d = dx * dx + dz * dz; if (d < da) { B = A; db = da; A = R; da = d; } else if (d < db) { B = R; db = d; } }
    NN.A = A; NN.B = B; NN.da = sq(da); NN.db = sq(db); return NN;
  }
  // ---- landforms for riding (plan section 9), each region its own: wave valleys and rollers in the dune sea, bowls in the dry lakes, half-pipe canyons, step-downs in the mesa fields
  const sites = new Map();       // a landform site per grid cell (bowls, step-downs), rolled once
  const siteOf = (kind, ci, cj, G) => { const k = kind * 1e8 + (ci + 5000) * 10000 + (cj + 5000); let s = sites.get(k); if (s !== undefined) return s; const rn = rngOf(hsh(seed, ci, cj, 0xB0 + kind)); s = null;
    if (kind === 1 && rn() < 0.7) { const R = 15 + rn() * 15; s = { x: (ci + 0.25 + rn() * 0.5) * G, z: (cj + 0.25 + rn() * 0.5) * G, R, D: R * 0.3 }; }       // a bowl 30 to 60 m across, about 0.3 of its radius deep
    else if (kind === 3 && rn() < 0.6) { const a = rn() * TAU; s = { x: (ci + 0.3 + rn() * 0.4) * G, z: (cj + 0.3 + rn() * 0.4) * G, ux: cosA(a), uz: sinA(a), R: 5 + rn() * 1.5 }; }       // a full pipe: a hoop 10 to 13 m high, ridden as a loop at speed
    else if (kind === 2 && rn() < 0.65) { const H = 3 + rn() * 1.5, a = rn() * TAU; s = { x: (ci + 0.3 + rn() * 0.4) * G, z: (cj + 0.3 + rn() * 0.4) * G, H, c: cosA(a), s: sinA(a), L1: H / 0.36, L2: 30 + rn() * 6 }; }       // a step-down: a ramp up at about 20 degrees, a 4 m top, a 30 to 36 m landing slope (about 7 degrees): a 24 m/s launch still comes down on it
    sites.set(k, s); return s; };
  // landform sites in a rectangle, for tools and tests: kind 1 bowls (only where the ground there is a dry lake), kind 2 step-downs (mesa fields)
  W.landSites = (kind, x0, z0, x1, z1) => { const G = kind === 1 ? 200 : kind === 3 ? 700 : 180, out = []; for (let j = Math.floor(z0 / G); j <= Math.floor(z1 / G); j++) for (let i = Math.floor(x0 / G); i <= Math.floor(x1 / G); i++) { const s = siteOf(kind, i, j, G); if (s && (kind === 3 ? [4, 6].includes(near2(s.x, s.z).A.type) : near2(s.x, s.z).A.type === (kind === 1 ? 2 : 1))) out.push(s); } return out; };
  // how deep in a wave valley (0 on the crests, 1 on the floor): S-shaped valleys 56 m wide every 150 m
  function valleyQ(P, x, z) { const u = x * P.c1 + z * P.s1, v = -x * P.s1 + z * P.c1 + 28 * sinA(u / 95), vv = v - 150 * Math.floor(v / 150) - 75, d = Math.abs(vv) / 28; if (d >= 1) return 0; const q = 1 - d * d; return q * q; }
  W.valleyAt = (x, z) => { const A = near2(x, z).A, sv = startValleyQ(x, z); if (A.type === 0) return Math.max(sv, valleyQ(A.P, x, z)); if (A.type === 3) { const a = Math.abs(2 * vnoise(A.P.seed ^ 0x701, x / 520, z / 520) - 1); return Math.max(sv, a < 0.12 ? 1 - a / 0.12 : 0); } return sv; };
  function landform(R, x, z) {
    const T = R.type, P = R.P; let h = 0;
    if (T === 0) {       // wave valleys: S-shaped valleys 48 m wide every 170 m, banked so a carve from side to side keeps speed; rollers in patches: rows of 1.2 m bumps 10.5 m apart
      const q = valleyQ(P, x, z); h -= 8.5 * q;
      const m = sstep(0.56, 0.68, vnoise(P.seed ^ 0x9A1, x / 260, z / 260)); if (m > 0) { const u2 = x * P.c2 + z * P.s2; h += m * 0.6 * (1 - cosA(TAU * u2 / 10.5)); }
    } else if (T === 2) {       // dry lakes: bowls with a rideable lip, and rollers round the edges
      const G = 200, ci = Math.floor(x / G), cj = Math.floor(z / G);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) { const s = siteOf(1, i, j, G); if (!s) continue; const dx = x - s.x, dz = z - s.z, r2 = dx * dx + dz * dz, RR = s.R + 7; if (r2 > RR * RR) continue; const r = sq(r2), k = r / s.R;
        if (k < 1) h -= s.D * (1 - k * k * k); const l = (r - s.R - 1.5) / 4; if (l > -1 && l < 1) h += 1.2 * (1 - l * l); }
      const m = sstep(0.62, 0.72, vnoise(P.seed ^ 0x9A2, x / 220, z / 220)); if (m > 0) h += m * 0.6 * (1 - cosA(TAU * (x * P.c1 + z * P.s1) / 11));
    }
    return h;
  }
  const regH = (R, x, z) => {
    let h = duneH(R.P, x, z) - R.off + landform(R, x, z);
    if (R.type === 1) {       // mesa fields: step-downs, each on its own smoothed ground (the dunes under it are levelled to the height where its ramp starts), so the ramp, the top and the landing slope are exactly what you ride
      const G = 180, ci = Math.floor(x / G), cj = Math.floor(z / G);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) { const s = siteOf(2, i, j, G); if (!s) continue; const dx = x - s.x, dz = z - s.z, a = dx * s.c + dz * s.s, b = Math.abs(-dx * s.s + dz * s.c); if (b > 16 || a < -s.L1 - 12 || a > 16 + s.L2) continue;
        if (s.ref === undefined) s.ref = duneH(R.P, s.x - s.c * s.L1, s.z - s.s * s.L1) - R.off;
        const prof = a < -s.L1 ? 0 : a < 0 ? (a + s.L1) / s.L1 : a < 4 ? 1 : a < 4 + s.L2 ? 1 - (a - 4) / s.L2 : 0, sm = prof * prof * (3 - 2 * prof), m = (1 - sstep(10, 16, b)) * sstep(-s.L1 - 12, -s.L1, a) * (1 - sstep(4 + s.L2, 16 + s.L2, a));
        h = h * (1 - m) + (s.ref + s.H * (a < 0 ? prof : sm)) * m; } }
    if (R.type === 3) { const a = Math.abs(2 * vnoise(R.P.seed ^ 0x701, x / 520, z / 520) - 1), d = a / 0.17; if (d < 1) { const d2 = d * d; h -= R.trD * 2.2 * (1 - d2 * d2 * d2); } }       // canyon runs: a half-pipe, a flat floor and walls that steepen toward the top
    else if (R.type === 6) h += R.rgH * (1 - sstep(0, 0.2, Math.abs(2 * vnoise(R.P.seed ^ 0x711, x / 900, z / 900) - 1)));
    return h;
  };
  function mount(x, z) {
    const r = r4(x, z), w = 90 * (vnoise(seed ^ 0x401, x / 400, z / 400) - 0.5) + 8 * (vnoise(seed ^ 0x402, x / 32, z / 32) - 0.5) * 2, q = r - (EDGE + w);
    if (q <= 0) return 0;
    const top = 31 + 25 * vnoise(seed ^ 0x403, x / 130, z / 130), rise = 28 + 10 * vnoise(seed ^ 0x404, x / 90, z / 90), u = q >= rise ? 1 : q / rise, su = u * u * (3 - 2 * u);
    const rid = 1 - Math.abs(2 * vnoise(seed ^ 0x405, x / 26, z / 26) - 1), rid2 = 1 - Math.abs(2 * vnoise(seed ^ 0x407, x / 11, z / 11) - 1);
    const hm = top * su + 10 * rid * sstep(0.15, 0.9, u) + 3.5 * rid2 * sstep(0.3, 1, u) + 2 * (vnoise(seed ^ 0x406, x / 12, z / 12) - 0.5) * sstep(0.3, 1, u);
    const bank = q < 11.4 ? 12 - sq(144 - q * q) : 8.25 + (q - 11.4) * 3.2;       // the foot of the range is a rideable bank (world v3 section 7): a 12 m quarter-pipe curve that turns a rider back in, never a dead stop
    return Math.max(hm, Math.min(bank, hm + 14));
  }
  // the ground before anything is placed on it: the blended regions, the slow global rise and fall, the mountains
  function gymH(u, v, h0) {       // u, v from the gym's centre; h0 the flat floor
    let h = h0; const d = sq((u - 35) * (u - 35) + v * v); if (d < 12) h -= 3 * (1 - (d / 12) * (d / 12));       // the bowl: 24 m across, 3 m deep
    if (u > -66 && u < -19 && v > 14 && v < 111) { const e = Math.min(1, Math.min(u + 66, -19 - u, v - 14, 111 - v) / 6), s = sstep(20, 105, v); h += 14 * s * e; }       // the downhill run: 14 m over 85 m
    if (u >= 30 && u <= 42 && v >= 40 && v <= 52) h += 6;       // the block mesa: 12 m square, 6 m sheer, a reward on top
    return h;
  }
  // the kill bowl (owner, 27 Nov: "a vast fun enemy kill area where you can do tricks and zoom around hitting the entire corner"): a flat floor 110 m across, banked up to a rim
  // with quarter pipes all round it, two park lines across the floor, and the horde thicker while you are inside it (sim/stages.js). One a stage, 190 m ahead of the start.
  function bowlH(x, z, h) { const B = W.killBowl; if (!B) return h; const dx = x - B.x, dz = z - B.z, d2 = dx * dx + dz * dz; if (d2 > B.out * B.out) return h; const d = sq(d2), hf = B.h0 === undefined ? (B.h0 = baseH1(B.x, B.z) - 3) : B.h0;
    if (d <= B.floor) return hf; const rim = hf + B.bank * sstep(B.floor, B.r, d); return d <= B.r ? rim : rim * (1 - sstep(B.r, B.out, d)) + h * sstep(B.r, B.out, d); }
  // a climb: three square plateaus stepping up (2.5, 4.5 and 6.5 m, sheer sides) with a chest on the top one: a spot to reach by ollies and wall rides
  function climbOf(qx, qz) { if (!W.spawn) return null; const k = hsh(seed, qx, qz, 0xC11B); if (k % 3 !== 0) return null; const r = rngOf(k), x = qx * Q + 50 + r() * (Q - 100), z = qz * Q + 50 + r() * (Q - 100); if (dist(x, z, W.spawn.x, W.spawn.z) < 340) return null; return { x: r2(x), z: r2(z) }; }       // (none near the start: the start, the ride school and the wonder line keep their ground)
  const CLIMB = [[0, 0, 2.5], [10, 4, 4.5], [5, 14, 6.5]];
  function climbH(x, z, h) { if (W.gym) return h; const c = climbOf(Math.floor(x / Q), Math.floor(z / Q)); if (!c) return h; let up = 0; for (const [ox, oz, hh] of CLIMB) if (Math.abs(x - c.x - ox) <= 4 && Math.abs(z - c.z - oz) <= 4) up = Math.max(up, hh); return up ? Math.max(h, (c.h0 === undefined ? (c.h0 = baseH1(c.x, c.z)) : c.h0) + up) : h; }
  W.climbOf = climbOf;       // (a climb's chest is a pocket marked climb: reached by ollies and wall rides, not on foot)
  function baseH(x, z) { const h = climbH(x, z, bowlH(x, z, baseH2(x, z))); return h; }
  function baseH2(x, z) { const h = baseH1(x, z); if (!W.gym) return h; const G = W.gym, u = x - G.x, v = z - G.z, d = sq(u * u + v * v); if (d >= G.edge) return h; const h0 = G.h0 === undefined ? (G.h0 = baseH1(G.x, G.z)) : G.h0, k = sstep(G.r, G.edge, d); return gymH(u, v, h0) * (1 - k) + h * k; }
  function baseH1(x, z) {
    const n = near2(x, z), t = sstep(-320, 320, n.db - n.da); let h = regH(n.A, x, z) * t; if (t < 0.999) h += regH(n.B, x, z) * (1 - t);
    return dropAt(x, z, soft0(h + 11 + 5 * vnoise(seed ^ 0x31, x / 2600, z / 2600) + mount(x, z) - 8 * startValleyQ(x, z) + roll(x, z)));
  }
  // the whole map rolls (owner, 27 Nov: more hills and large dips): broad hills up to about 14 m either way every 200 m or so, and dips 8 to 20 m deep in patches, all with smooth slopes a card can ride and a walker can climb
  const soft0 = h => (h > 4 ? h : 2 + 2 * sstep(-6, 4, h) + (h - 4) * 0.05);       // the deepest dips level out into a floor a little above 0 (smoothly, no shelf)
  function roll(x, z) { const h = 24 * (vnoise(seed ^ 0xA11, x / 130, z / 130) - 0.5) + 7 * (vnoise(seed ^ 0xA13, x / 60, z / 60) - 0.5), q = vnoise(seed ^ 0xA12, x / 110, z / 110), dip = sstep(0.55, 0.85, q); return h - (8 + 12 * vnoise(seed ^ 0xA14, x / 400, z / 400)) * dip; }
  function base0(x, z) { const n = near2(x, z), t = sstep(-320, 320, n.db - n.da); let h = regH(n.A, x, z) * t; if (t < 0.999) h += regH(n.B, x, z) * (1 - t); return soft0(h + 11 + 5 * vnoise(seed ^ 0x31, x / 2600, z / 2600) + mount(x, z) - 8 * startValleyQ(x, z) + roll(x, z)); }
  // the colour a region gives the sand (view only): [colour, strength] per type, blended across the same 640 m band as the heights
  const TINT = [[0xf3c978, 0], [0xd88a4a, 0.6], [0xf4f0e4, 0.9], [0xb8582c, 0.75], [0xdcc890, 0.6], [0x8c8462, 0.6], [0x7a5236, 0.6]], mixh = (a, b, t) => { const m = sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
  W.tintAt = (x, z) => { const n = near2(x, z), t = sstep(-320, 320, n.db - n.da), A = TINT[n.A.type], B = TINT[n.B.type], c = mixh(B[0], A[0], t), k = B[1] * (1 - t) + A[1] * t, vq = Math.max(n.A.type === 0 ? valleyQ(n.A.P, x, z) * t : 0, startValleyQ(x, z)); if (W.drops) for (const d of W.drops) { const dx = x - d.x, dz = z - d.z; if (dx * dx + dz * dz > 120 * 120) continue; const aa = dx * d.c + dz * d.s, bb = Math.abs(-dx * d.s + dz * d.c); if (aa > -92 && aa < 1.5 && bb < d.w - 2) { const stripe = ((aa % 10) + 10) % 10 < 3.5 ? 1 : 0, edge = aa > -6 ? 1 : 0; return { c: edge ? 0x6a3416 : stripe ? 0x8a4420 : 0xb0602c, k: 0.9 }; } if (aa >= 1.5 && aa < 40 && bb < d.w - 2) return { c: aa < 4 ? 0x5a2c12 : 0xc07838, k: aa < 4 ? 0.95 : 0.7 * (1 - (aa - 4) / 36) + 0.2 }; }       // a great drop's ramp is carved dark stone with a band every 9 m, darkest at the lip: it reads as a launch from 100 m
    return vq > 0.02 ? { c: mixh(c, 0xc87436, Math.min(1, vq * 1.1)), k: k + (0.55 - k) * Math.min(1, vq * 1.2) } : { c, k }; };       // a wave valley's floor is a warmer, darker sand: the line to ride reads at once
  W.baseH = baseH; W.regionAt = (x, z) => near2(x, z).A; W.mount = mount;
  // names: every region and every landmark has its own, seeded, in our own words (shown when you arrive)
  const RNAMES = [['the Amber Sea', 'the Whispering Dunes', 'the Sea of Cinders', 'the Long Drift', 'the Gilded Swells', 'the Tallow Dunes', 'the Slow Waves'], ['the Anvil Mesas', 'the Red Tables', 'the Broken Altars', 'the Stacks', 'the Kiln Mesas', 'the Hearth Tables'],
    ['the Salt Mirror', 'the Bone Flat', 'the White Pan', 'the Glass Lake', 'the Pale Floor'], ['the Throat Canyons', 'the Split Runs', 'the Knife Gullies', 'the Hollow Cuts'], ['the Field of Fallen Cards', 'the Card Graves', 'the Ashen Deck', 'the Sunken Hand', 'the Discard Pile'],
    ['the Dead Orchard', 'the Grey Wood', 'the Bleached Grove', 'the Thorn Wood'], ['the Spine of Teeth', 'the Long Ridge', 'the Saw Ridge', 'the Old Backbone']];
  W.regionLabel = R => { const L = RNAMES[R.type]; return L[hsh(seed, R.rx, R.rz, 0x4E4D) % L.length]; };
  const LWORD = ['Ember', 'Ash', 'Gilded', 'Silent', 'Hollow', 'Last', 'Weeping', 'Crowned', 'Sunken', 'Broken', 'Sleeping', 'Ivory', 'Dusk', 'Oath', 'Gambler', 'Lantern'];
  W.landmarkLabel = (b, lx, lz) => { const w = LWORD[hsh(seed, lx, lz, 0x4C4D) % LWORD.length]; return b.kind === 1 ? 'the ' + w + ' Spire' : b.kind === 2 ? 'the ' + w + ' Card' : 'the ' + w + ' Mesa'; };
  const spread = (x, z, r) => { let lo = baseH(x, z), hi = lo; for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = baseH(x + cosA(t) * r, z + sinA(t) * r); if (h < lo) lo = h; if (h > hi) hi = h; } return hi - lo; };
  const slope = (x, z) => { const a = baseH(x + 1, z), b = baseH(x - 1, z), c = baseH(x, z + 1), d = baseH(x, z - 1); return sq(((a - b) * (a - b) + (c - d) * (c - d)) / 4); };
  W.spread = spread; W.slope = slope;
  // ---- blocks
  const setT = b => { let top = -1e9; const R = Math.max(b.rx, b.rz) * 1.2 + 2; for (let z = b.cz - R; z <= b.cz + R; z += 1.5) for (let x = b.cx - R; x <= b.cx + R; x += 1.5) if (prof(b, x, z) > 0.02) { const h = baseH(x, z) + bankOf(WP, b, x, z); if (h > top) top = h; } b.T = top + b.h; };
  const drop = b => { let lo = 1e9, hi = -1e9; for (let k = 0; k < 20; k++) { const t = k / 20 * TAU, c = cosA(t), s = sinA(t); for (const f of [1, 0.55, 0]) { const ux = c * b.rx * f, uz = s * b.rz * f, h = baseH(b.cx + ux * b.cr - uz * b.sr, b.cz + ux * b.sr + uz * b.cr); if (h < lo) lo = h; if (h > hi) hi = h; } } return hi - lo; };
  const mk = (rn, kind, x, z) => kind === 0 ? block(rn, x, z, 7 + rn() * 6, 7 + rn() * 5, 7 + rn() * 3, 2.4, rn() < 0.45 ? 2 : 1) : kind === 1 ? block(rn, x, z, 13 + rn() * 6, 3 + rn() * 1.5, 10 + rn() * 4, 2.4, rn() < 0.5 ? 2 : 1) : (b => { b.door = rn() < 0.55; return b; })(block(rn, x, z, 3.8 + rn() * 2, 3 + rn() * 1.4, 6 + rn() * 3, 1.3, 0));
  // ---- landmarks: one per 1100 m cell, a tall mesa, a spire or a giant half-sunk card, seen from far off
  const lms = new Map();
  function landmark(lx, lz) {
    const k = (lx + 64) * 256 + (lz + 64); if (lms.has(k)) return lms.get(k);
    const rn = rngOf(hsh(seed, lx, lz, 0x1A4D)), kind = (rn() * 3) | 0; let best = null, bd = 1e9;
    for (let t = 0; t < 24; t++) {
      const x = (lx + 0.12 + 0.76 * rn()) * LC, z = (lz + 0.12 + 0.76 * rn()) * LC; if (r4(x, z) > EDGE - 500) continue;
      const b = kind === 0 ? block(rn, x, z, 26 + rn() * 14, 22 + rn() * 12, 34 + rn() * 20, 5, rn() < 0.5 ? 2 : 1) : kind === 1 ? block(rn, x, z, 7 + rn() * 3, 7 + rn() * 3, 55 + rn() * 25, 3.4, rn() < 0.5 ? 2 : 1) : block(rn, x, z, 30 + rn() * 10, 3.5, 36 + rn() * 14, 3, rn() < 0.5 ? 2 : 1);
      const d = drop(b); if (d < bd) { bd = d; best = b; } if (d <= 3) break;
    }
    if (best) { setT(best); best.landmark = true; best.kind = kind; }
    lms.set(k, best); return best;
  }
  W.landmark = landmark;
  // ---- cells
  const cells = new Map();
  function cell(qx, qz) { const C = cell0(qx, qz); if (W.killBowl && !C.bowlDone) { C.bowlDone = true; const B = W.killBowl, out = (x, z, r) => dist(x, z, B.x, B.z) > B.out + 10 + (r || 0); C.blocks = C.blocks.filter(b => out(b.cx, b.cz, reachOf(b))); C.pockets = C.pockets.filter(q => out(q.x, q.z)); C.extras = C.extras.filter(q => out(q.x, q.z)); if (C.ring && !out(C.ring.x, C.ring.z)) C.ring = null; }
    if (!C.climbDone) { C.climbDone = true; const c = climbOf(qx, qz); if (c && (!W.killBowl || dist(c.x, c.z, W.killBowl.x, W.killBowl.z) > W.killBowl.out + 20)) { C.blocks = C.blocks.filter(b => dist(b.cx, b.cz, c.x + 5, c.z + 7) > reachOf(b) + 14); C.pockets.push({ type: 'cchest', x: c.x + 5, z: c.z + 14, climb: true }); } } if (W.gym && !C.gymDone) { C.gymDone = true; const G = W.gym, out = (x, z, r) => dist(x, z, G.x, G.z) > G.edge + 20 + (r || 0); C.blocks = C.blocks.filter(b => out(b.cx, b.cz, reachOf(b))); C.pockets = C.pockets.filter(q => out(q.x, q.z)); C.extras = C.extras.filter(q => out(q.x, q.z)); if (C.ring && !out(C.ring.x, C.ring.z)) C.ring = null; } return C; }
  function cell0(qx, qz) {
    const key = (qx + 128) * 512 + (qz + 128); let C = cells.get(key); if (C) return C;
    const x0 = qx * Q, z0 = qz * Q, cxm = x0 + Q / 2, czm = z0 + Q / 2; C = { qx, qz, x0, z0, blocks: [], pocket: null, pockets: [], ring: null, extras: [], type: 0, pads: [] }; cells.set(key, C);
    if (r4(cxm, czm) > EDGE - 300) return C;
    C.type = near2(cxm, czm).A.type; const rn = rngOf(hsh(seed, qx, qz, 0xCE11)), T = C.type, fixed = [];
    for (let j = Math.floor(z0 / LC) - 1; j <= Math.floor((z0 + Q) / LC) + 1; j++) for (let i = Math.floor(x0 / LC) - 1; i <= Math.floor((x0 + Q) / LC) + 1; i++) { const b = landmark(i, j); if (b && b.cx >= x0 && b.cx < x0 + Q && b.cz >= z0 && b.cz < z0 + Q) { C.blocks.push(b); fixed.push(b); } else if (b) fixed.push(b); }
    const clear = (x, z, d) => fixed.every(b => dist(b.cx, b.cz, x, z) >= reachOf(b) + d) && C.blocks.every(b => dist(b.cx, b.cz, x, z) >= reachOf(b) + d);
    // the pocket: one thing to do near the middle of the cell, on the flattest of ten tries, so the next one is never more than about 40 s away
    let best = null, bs = 1e9; for (let t = 0; t < 10; t++) { const x = cxm + (rn() - 0.5) * 140, z = czm + (rn() - 0.5) * 140; if (!clear(x, z, 26)) continue; const s = spread(x, z, 6) + 1.6 * (1 - W.valleyAt(x, z)); if (s < bs) { bs = s; best = [x, z]; } }       // the flattest try, and a valley floor first: following a valley finds things
    if (best) {
      let roll = rn(), kind = 'vases'; for (const [k, w] of POCKETS) { if (roll < w) { kind = k; break; } roll -= w; }
      const big = kind === 'broker', pk = { type: kind, x: r2(best[0]), z: r2(best[1]), rIn: big ? 4 : 3, rOut: big ? 7 : 8 };
      if (kind === 'vases') { const n = 5 + ((rn() * 4) | 0); pk.vases = []; for (let k = 0; k < n; k++) { const a = rn() * TAU, d = k ? 0.9 + rn() * 2.4 : 0; pk.vases.push([r2(cosA(a) * d), r2(sinA(a) * d), rn() < 0.12]); } }
      C.pocket = pk; C.pockets.push(pk); C.pads.push(padOf(pk.x, pk.z, pk.rIn, pk.rOut));
    }
    // a second, lighter pocket 110 m or more from the first, so a straight drive through the cell almost always passes something
    { let b2 = null, s2 = 1e9; for (let t = 0; t < 14; t++) { const x = x0 + 30 + rn() * (Q - 60), z = z0 + 30 + rn() * (Q - 60); if (!clear(x, z, 26) || (C.pocket && dist(x, z, C.pocket.x, C.pocket.z) < 110)) continue; const s = spread(x, z, 6) + 1.6 * (1 - W.valleyAt(x, z)); if (s < s2) { s2 = s; b2 = [x, z]; } }
      if (b2) { let roll = rn(), kind = 'vases'; for (const [k, w] of POCKETS2) { if (roll < w) { kind = k; break; } roll -= w; } const pk = { type: kind, x: r2(b2[0]), z: r2(b2[1]), rIn: kind === 'broker' ? 4 : 3, rOut: kind === 'broker' ? 7 : 8 };
        if (kind === 'vases') { const n = 4 + ((rn() * 4) | 0); pk.vases = []; for (let k = 0; k < n; k++) { const a = rn() * TAU, d = k ? 0.9 + rn() * 2.4 : 0; pk.vases.push([r2(cosA(a) * d), r2(sinA(a) * d), rn() < 0.12]); } }
        C.pockets.push(pk); C.pads.push(padOf(pk.x, pk.z, pk.rIn, pk.rOut)); } }
    // a boss ring: a flat open disc, in four cells out of ten
    if (rn() < 0.6) { let rb = null, rs = 1e9; for (let t = 0; t < 8; t++) { const x = x0 + 50 + rn() * (Q - 100), z = z0 + 50 + rn() * (Q - 100); if (!clear(x, z, 40) || C.pockets.some(q => dist(x, z, q.x, q.z) < 60)) continue; const s = spread(x, z, 14); if (s < rs) { rs = s; rb = [x, z]; } } if (rb && rs < 4) { C.ring = { x: r2(rb[0]), z: r2(rb[1]), r: 14 }; C.pads.push(padOf(rb[0], rb[1], 14, 26)); } }
    // blocks: mesas (kind 0), tall walls (1), small ruin blocks (2), kept inside the cell and clear of the pocket and the ring
    const placed = C.blocks.slice();
    for (let kind = 0; kind < 3; kind++) {
      const [lo, hi, pr] = COUNTS[T][kind]; let n = rn() < pr ? lo + ((rn() * (hi - lo + 1)) | 0) : (lo > 0 ? lo : 0); if (kind === 2 && T === 4) n = lo + ((rn() * (hi - lo + 1)) | 0);
      for (let t = 0; t < 60 && n > 0; t++) {
        const probe = mk(rn, kind, 0, 0), m = reachOf(probe) + 4; if (m * 2 > Q - 30) continue;
        const x = x0 + m + rn() * (Q - 2 * m), z = z0 + m + rn() * (Q - 2 * m); if (C.pockets.some(q => dist(x, z, q.x, q.z) < reachOf(probe) + 14)) continue; if (C.ring && dist(x, z, C.ring.x, C.ring.z) < reachOf(probe) + 30) continue;
        const gap = kind === 2 ? 40 : 55; if (placed.some(p => dist(p.cx, p.cz, x, z) < gap + Math.max(p.rx, p.rz))) continue;
        const b = block(rn, x, z, probe.rx, probe.rz, probe.h, probe.cw, probe.tone); b.door = probe.door; if (drop(b) > MAX_DROP) continue; setT(b); C.blocks.push(b); placed.push(b); n--;
      }
    }
    if (rn() < 0.6) { for (let t = 0; t < 10; t++) { const x = x0 + 16 + rn() * (Q - 32), z = z0 + 16 + rn() * (Q - 32); if (!clear(x, z, 8) || C.pockets.some(q => dist(x, z, q.x, q.z) < 30) || (C.ring && dist(x, z, C.ring.x, C.ring.z) < 34)) continue; const vs = []; const n = 4 + ((rn() * 4) | 0); for (let k = 0; k < n; k++) { const a = rn() * TAU, d = k ? 0.9 + rn() * 2 : 0; vs.push([r2(cosA(a) * d), r2(sinA(a) * d), rn() < 0.12]); } C.extras.push({ type: 'vases', x: r2(x), z: r2(z), vases: vs }); break; } }
    return C;
  }
  function padOf(x, z, rIn, rOut) { let s = baseH(x, z), n = 1; for (const f of [0.5, 1]) for (let a = 0; a < 8; a++) { const t = a * TAU / 8; s += baseH(x + cosA(t) * rIn * f, z + sinA(t) * rIn * f); n++; } return { x, z, rIn, rOut, hc: s / n }; }
  W.cell = cell; W.padOf = padOf;
  // ---- placing things by hand (spawn, free chest, sleepers, the gate) on top of the cells: they join W.extra as pads
  W.addPad = (x, z, rIn, rOut) => { const p = padOf(x, z, rIn, rOut); W.extra.push(p); return p; };
  // ---- gathering what touches a rectangle
  W.gather = (x0, z0, x1, z1, m) => {
    const F = { blocks: [], pads: [] }; for (let j = Math.floor((z0 - m) / Q); j <= Math.floor((z1 + m) / Q); j++) for (let i = Math.floor((x0 - m) / Q); i <= Math.floor((x1 + m) / Q); i++) {
      const C = cell(i, j); for (const b of C.blocks) { const R = reachOf(b) + 18; if (b.cx + R > x0 && b.cx - R < x1 && b.cz + R > z0 && b.cz - R < z1) F.blocks.push(b); }
      for (const p of C.pads) if (p.x + p.rOut > x0 && p.x - p.rOut < x1 && p.z + p.rOut > z0 && p.z - p.rOut < z1) F.pads.push(p);
    }
    for (const b of lmNear(x0 - m, z0 - m, x1 + m, z1 + m)) if (!F.blocks.includes(b)) F.blocks.push(b);
    for (const p of W.extra) if (p.x + p.rOut > x0 && p.x - p.rOut < x1 && p.z + p.rOut > z0 && p.z - p.rOut < z1) F.pads.push(p);
    return F;
  };
  function lmNear(x0, z0, x1, z1) { const o = []; for (let j = Math.floor(z0 / LC) - 1; j <= Math.floor(z1 / LC) + 1; j++) for (let i = Math.floor(x0 / LC) - 1; i <= Math.floor(x1 / LC) + 1; i++) { const b = landmark(i, j); if (b) { const R = reachOf(b) + 18; if (b.cx + R > x0 && b.cx - R < x1 && b.cz + R > z0 && b.cz - R < z1) o.push(b); } } return o; }
  // ---- what a point's height is once the placed things are on it
  const viewOver = (x, z, g, F) => {
    for (const b of F.blocks) { const dx = x - b.cx, dz = z - b.cz, R = reachOf(b) + 16; if (dx * dx + dz * dz < R * R) g += bankOf(WP, b, x, z); }
    for (const p of F.pads) { const dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz; if (d2 >= p.rOut * p.rOut) continue; const w = 1 - sstep(p.rIn, p.rOut, sq(d2)); g += (p.hc - g) * w; }
    return g;
  };
  const simOver = (x, z, g, F) => { g = viewOver(x, z, g, F); for (const b of F.blocks) { const dx = x - b.cx, dz = z - b.cz, R = Math.max(b.rx, b.rz) * 1.3 + 3; if (dx * dx + dz * dz < R * R) { const p = prof(b, x, z); if (p > 0) g += (b.T - g) * p; } } return g; };
  let lastKey = -1, lastF = null;
  const near = (x, z) => { const qx = Math.floor(x / Q), qz = Math.floor(z / Q), key = (qx + 128) * 512 + (qz + 128); if (key !== lastKey) { lastF = W.gather(qx * Q, qz * Q, qx * Q + Q, qz * Q + Q, 40); lastKey = key; } return lastF; };
  W.viewAt = (x, z) => viewOver(x, z, baseH(x, z), near(x, z));
  W.simAt = (x, z) => r4(x, z) > EDGE + 90 ? WALL : simOver(x, z, baseH(x, z), near(x, z));
  W.inside = (x, z) => r4(x, z) < EDGE - 20;
  // 1 m cells i0..i0+n-1, j0..j0+n-1 (world metres, cell centres at +0.5): base height on a 2 m lattice, the same interpolation the first open map used, then the placed things
  W.fillSim = (i0, j0, n, out) => {
    const F = W.gather(i0, j0, i0 + n, j0 + n, 24), m = n / 2 + 2, L = new Float32Array(m * m);
    for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) { const x = i0 - 2 + a * 2 + 0.5, z = j0 - 2 + b * 2 + 0.5; L[b * m + a] = baseH(x, z); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i0 + i + 0.5, z = j0 + j + 0.5; if (r4(x, z) > EDGE + 90) { out[j * n + i] = WALL; continue; }
      const fa = (x - (i0 - 2 + 0.5)) / 2, fb = (z - (j0 - 2 + 0.5)) / 2, a = Math.floor(fa), b = Math.floor(fb), u = fa - a, v = fb - b;
      const g = (L[b * m + a] * (1 - u) + L[b * m + a + 1] * u) * (1 - v) + (L[(b + 1) * m + a] * (1 - u) + L[(b + 1) * m + a + 1] * u) * v;
      out[j * n + i] = simOver(x, z, g, F);
    }
  };
  // ---- dressing per cell: cacti, dead trees, logs, clay pots and carved heads, thicker or thinner by region, kept off the pockets, rings, blocks and the start
  const dcache = new Map();
  W.dressCell = (qx, qz) => {
    const key = (qx + 128) * 512 + (qz + 128); let D = dcache.get(key); if (D) return D;
    D = { cacti: [], dead: [], logs: [], pots: [], heads: [], stalls: [], solid: [], cards: [], cracks: [], seals: [], rings: [], arches: [], pipes: [], spires: [], lips: [], rspires: [], bones: [], kickers: [], ledges: [], poles: [], parkPots: [], grooves: [], rollLogs: [], quarters: [] }; dcache.set(key, D); const C = cell(qx, qz); if (!C.type && r4(C.x0 + Q / 2, C.z0 + Q / 2) > EDGE - 300) return D;
    const rn = rngOf(hsh(seed, qx, qz, 0xD7E55)), T = C.type, F = W.gather(C.x0, C.z0, C.x0 + Q, C.z0 + Q, 40), keep = [];
    for (const q of C.pockets) keep.push([q.x, q.z, q.type === 'broker' ? 12 : 7]); if (C.ring) keep.push([C.ring.x, C.ring.z, 18]); for (const e of C.extras) keep.push([e.x, e.z, 5]); for (const p of W.extra) keep.push([p.x, p.z, Math.max(p.rOut, 10)]);
    const wb = W.wonder ? W.wonder.beams.filter(s => Math.floor((s[0] + s[2]) / 2 / Q) === qx && Math.floor((s[1] + s[3]) / 2 / Q) === qz) : [], ws = W.wonder ? W.wonder.seals.filter(s => Math.floor(s[0] / Q) === qx && Math.floor(s[1] / Q) === qz) : [];
    if (W.wonder) { for (const s of W.wonder.beams) for (let k = 0; k <= 4; k++) keep.push([s[0] + (s[2] - s[0]) * k / 4, s[1] + (s[3] - s[1]) * k / 4, 2.5]); for (const s of W.wonder.seals) keep.push([s[0], s[1], 2]); }
    for (const s of W.landSites(3, C.x0 - 20, C.z0 - 20, C.x0 + Q + 20, C.z0 + Q + 20)) keep.push([s.x, s.z, 9]);
    const courses = C.pockets.filter(q => q.type === 'shrine').map(q => shrineCourse(q.x, q.z)); for (const cs of courses) { for (const a of cs.arches) keep.push([a.x, a.z, 4]); for (const m of cs.marks) keep.push([m[0], m[1], 2]); if (cs.spire) keep.push([cs.spire.x, cs.spire.z, 3]); if (cs.pipe) keep.push([cs.pipe.x, cs.pipe.z, 9]); }
    const school = (W.school || []).filter(s => Math.floor((s[0] + s[2]) / 2 / Q) === qx && Math.floor((s[1] + s[3]) / 2 / Q) === qz); for (const s of W.school || []) for (let k = 0; k <= 4; k++) keep.push([s[0] + (s[2] - s[0]) * k / 4, s[1] + (s[3] - s[1]) * k / 4, 2.5]);
    const mul = { cactus: [0.12, 0.8, 0.05, 0.9, 0.5, 0.2, 0.4][T], dead: [0.05, 0.5, 0.15, 0.4, 0.6, 7.0, 0.3][T], logs: [0.6, 0.8, 0.25, 0.7, 1.6, 1.2, 0.5][T] };       // region faces: the dune sea stands empty but for beams, the dead forest is the most crowded with trunks
    const free = (x, z, pad) => { for (const k of keep) { const r = k[2] + (pad || 0); if ((x - k[0]) * (x - k[0]) + (z - k[1]) * (z - k[1]) < r * r) return false; } for (const b of F.blocks) if (dist(b.cx, b.cz, x, z) < reachOf(b) + 1 + (pad || 0)) return false; return true; };
    const gy = (x, z) => viewOver(x, z, baseH(x, z), F), slp = (x, z) => { const e = 1.2; return sq(((gy(x + e, z) - gy(x - e, z)) ** 2 + (gy(x, z + e) - gy(x, z - e)) ** 2) / (4 * e * e)); };
    for (const s of W.landSites(3, C.x0, C.z0, C.x0 + Q - 0.01, C.z0 + Q - 0.01)) if (Math.floor(s.x / Q) === qx && Math.floor(s.z / Q) === qz && spread(s.x, s.z, 6) < 1.6 && (!W.spawn || dist(s.x, s.z, W.spawn.x, W.spawn.z) > 150)) { D.pipes.push([r2(s.x), r2(gy(s.x, s.z)), r2(s.z), r2(s.ux), r2(s.uz), r2(s.R)]); }
    for (const d of W.drops) if (Math.floor(d.x / Q) === qx && Math.floor(d.z / Q) === qz) { const px = -d.s, pz = d.c, w = d.w - 3, ax = d.x + px * w, az = d.z + pz * w, bx = d.x - px * w, bz = d.z - pz * w; D.lips.push([r2(ax), r2(gy(ax, az)), r2(az), r2(bx), r2(gy(bx, bz)), r2(bz), r2(d.c), r2(d.s)]); }
    for (const cs of courses) { for (const m of cs.marks) D.seals.push([r2(m[0]), r2(gy(m[0], m[1])), r2(m[1]), -2]); if (cs.spire) { D.spires.push([r2(cs.spire.x), r2(gy(cs.spire.x, cs.spire.z)), r2(cs.spire.z), cs.spire.h, cs.spire.top]); D.solid.push([r2(cs.spire.x), r2(gy(cs.spire.x, cs.spire.z)), r2(cs.spire.z), 0.32, cs.spire.top]); } if (cs.pipe) D.pipes.push([r2(cs.pipe.x), r2(gy(cs.pipe.x, cs.pipe.z)), r2(cs.pipe.z), r2(cs.pipe.ux), r2(cs.pipe.uz), cs.pipe.R]);
      if (cs.ring.length) D.rings.push(cs.ring.map(q => [r2(q[0]), r2(gy(q[0], q[1]) + 0.9), r2(q[1])])); for (const a of cs.arches) { const px = -a.uz * 2.1, pz = a.ux * 2.1; D.arches.push([r2(a.x), r2(gy(a.x, a.z)), r2(a.z), r2(a.ux), r2(a.uz)]); for (const s of [1, -1]) D.solid.push([r2(a.x + px * s), r2(gy(a.x + px * s, a.z + pz * s)), r2(a.z + pz * s), 0.45, 3.6]); } }
    for (const s of wb) D.logs.push([r2(s[0]), r2(gy(s[0], s[1]) - 0.15), r2(s[1]), r2(s[2]), r2(gy(s[2], s[3]) - 0.15), r2(s[3]), r2(0.5), 3]);
    for (const s of ws) D.seals.push([r2(s[0]), r2(gy(s[0], s[1])), r2(s[1]), -1]);       // set -1: the wonder
    for (const s of school) D.logs.push([r2(s[0]), r2(gy(s[0], s[1]) - 0.15), r2(s[1]), r2(s[2]), r2(gy(s[2], s[3]) - 0.15), r2(s[3]), r2(0.5), 3]);
    const grid = new Map(), gk = (x, z) => Math.floor(x / 8) * 4096 + Math.floor(z / 8), put = (kind, x, z) => { const k = gk(x, z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push([kind, x, z]); };
    const nearby = (kind, x, z, d) => { for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const a = grid.get(gk(x + i * 8, z + j * 8)); if (a) for (const o of a) if ((kind === '*' || o[0] === kind) && (o[1] - x) * (o[1] - x) + (o[2] - z) * (o[2] - z) < d * d) return true; } return false; };
    const dens = (x, z) => 0.6 * vnoise(seed & 0xffff, x / 70, z / 70) + 0.4 * vnoise((seed >>> 7) & 0xffff, x / 28, z / 28), ok = (x, z, pad, ms) => free(x, z, pad) && slp(x, z) < (ms || 0.42);
    const clearOfPark = (x, z) => x >= C.x0 && x < C.x0 + Q && z >= C.z0 && z < C.z0 + Q && !nearby('k', x, z, 6) && !nearby('u', x, z, 5);       // no cactus or tree on a park piece or in its run-up, and none spilling into the next cell (where that cell's pieces cannot see it)
    const cactus = (x, z, s) => { if (!clearOfPark(x, z)) return; const y = gy(x, z); D.cacti.push([r2(x), r2(y), r2(z), r2(s), r2(rn() * TAU), (rn() * 3) | 0]); D.solid.push([r2(x), r2(y), r2(z), r2(0.55 * s), r2(3.5 * s)]); put('c', x, z); };
    const dead = (x, z, s) => { if (!clearOfPark(x, z)) return; const y = gy(x, z); D.dead.push([r2(x), r2(y), r2(z), r2(s), r2(rn() * TAU), (rn() * 3) | 0]); D.solid.push([r2(x), r2(y), r2(z), r2(0.55 * s), r2(6 * s)]); put('d', x, z); };
    const beam = (x, z, len, rad, kind) => { const a = rn() * TAU, dx = cosA(a) * len / 2, dz = sinA(a) * len / 2; D.logs.push([r2(x - dx), r2(gy(x - dx, z - dz) - 0.15), r2(z - dz), r2(x + dx), r2(gy(x + dx, z + dz) - 0.15), r2(z + dz), r2(rad), kind]); put('l', x, z); };
    const potc = (x, z) => { const n = 3 + ((rn() * 3) | 0); for (let q = 0; q < n; q++) { const a = rn() * TAU, d = q ? 0.8 + rn() * 1.3 : 0, px = x + cosA(a) * d, pz = z + sinA(a) * d; D.pots.push([r2(px), r2(gy(px, pz)), r2(pz), r2(0.9 + rn() * 0.7), r2(rn() * TAU), (rn() * 3) | 0]); } put('p', x, z); };
    const fill = (n, tries, kind, sep, pred, make) => { let k = 0; for (let t = 0; t < tries && k < n; t++) { const x = C.x0 + rn() * Q, z = C.z0 + rn() * Q; if (!pred(x, z) || nearby(kind, x, z, sep)) continue; make(x, z); k++; } };
    // groups of cacti beside every block, a few logs and a clay pot cluster at its foot
    for (const b of C.blocks) {
      for (let g = 0; g < 2 && !(g && rn() < 0.5); g++) { const a0 = rn() * TAU, d0 = reachOf(b) + 3 + rn() * 7, cx = b.cx + cosA(a0) * d0, cz = b.cz + sinA(a0) * d0, n = 4 + ((rn() * 6) | 0); let k = 0; for (let t = 0; t < 40 && k < n; t++) { const a = rn() * TAU, d = 0.8 + rn() * 4.5, x = cx + cosA(a) * d, z = cz + sinA(a) * d; if (!ok(x, z, 1, 0.45) || nearby('c', x, z, 1.7)) continue; cactus(x, z, k === 0 ? 1.3 + rn() * 0.25 : 0.6 + rn() * 0.7); k++; } }
      if (rn() < 0.55 * (T === 5 ? 1.5 : 1)) { const a0 = rn() * TAU, d0 = reachOf(b) + 4 + rn() * 8, x = b.cx + cosA(a0) * d0, z = b.cz + sinA(a0) * d0; if (ok(x, z, 2) && !nearby('d', x, z, 6)) dead(x, z, 1.25 + rn() * 0.35); }
      { const a0 = rn() * TAU, d0 = Math.max(b.rx, b.rz) * 1.05 + 4 + rn() * 3, x = b.cx + cosA(a0) * d0, z = b.cz + sinA(a0) * d0; if (ok(x, z, 1.5, 0.35)) potc(x, z); rn(); rn(); rn(); rn(); rn(); rn(); }
    }
    fill(Math.round(50 * mul.cactus), 400, 'c', 12, (x, z) => dens(x, z) > 0.3 && ok(x, z, 2), (x, z) => cactus(x, z, 0.9 + rn() * 0.6));
    if (T === 6) fill(14, 300, 's', 14, (x, z) => ok(x, z, 3, 0.6), (x, z) => { const y = gy(x, z), h = 7 + rn() * 9, w = 1.2 + rn() * 1.4; D.rspires.push([r2(x), r2(y), r2(z), r2(h), r2(w), r2(rn() * TAU)]); D.solid.push([r2(x), r2(y), r2(z), r2(w * 0.8), r2(h)]); put('s', x, z); });       // ridge spine: umber rock spires
    if (T === 2) fill(10, 200, 'b', 18, (x, z) => ok(x, z, 2), (x, z) => { const y = gy(x, z); D.bones.push([r2(x), r2(y), r2(z), r2(rn() * TAU), r2(0.8 + rn() * 0.6)]); put('b', x, z); });       // dry lake: bleached bones on the flats
    // park lines (owner, 27 Nov strip-back): three lines a cell plus one in the opening view. A line is 3 or 4 pieces in a row on ONE heading, gaps sized so the landing from one leads into the next:
    // kicker (carved wedge 9 m long, 9 m wide, 2.4 to 3.4 m at a gold lip), then a ledge or a carved rail (8 to 10 m, knee to waist high: ledge top 0.8 m, rail 0.7 m), then a kicker or a quarter pipe. No lone pieces: a line that does not fit whole is not laid.
    // Lines run down the fall line or along a valley floor, so the land carries the card from piece to piece.
    { const prn = rngOf(hsh(seed, qx, qz, 0x9A7)), lineScore = (x, z, ux, uz) => W.valleyAt(x + ux * 30, z + uz * 30) + (gy(x, z) - gy(x + ux * 40, z + uz * 40)) / 10;
      const TPL = [['k', 'l', 'k', 'q'], ['k', 'r', 'k'], ['k', 'l', 'k'], ['k', 'r', 'k', 'q'], ['l', 'k', 'r', 'k']];
      const line = (x, z, a, open, T0) => { const ux = cosA(a), uz = sinA(a), tpl = T0 || (open ? ['k', 'l', 'k', 'q'] : TPL[(prn() * TPL.length) | 0]), P = []; let t = 0;
        for (let e = 0; e < tpl.length; e++) { const kind = tpl[e], nx = tpl[e + 1], len = kind === 'k' ? 9 : kind === 'q' ? 3 : 8 + ((prn() * 3) | 0); P.push([kind, t, len]); t += len + (kind === 'k' ? (nx === 'l' || nx === 'r' ? 8 : 15) : kind === 'q' ? 0 : 9); }       // off a kicker the card comes down onto the rail that follows (7 m on), or lands clear before the next ramp (15 m)
        const y0 = gy(x, z); for (let s = -18; s <= t + 6; s += 3) { const px = x + ux * s, pz = z + uz * s; if (px < C.x0 + 6 || px > C.x0 + Q - 6 || pz < C.z0 + 6 || pz > C.z0 + Q - 6 || !ok(px, pz, 5, 0.5) || nearby('k', px, pz, 14) || gy(px, pz) > y0 + 2 + s * 0.04) return false; }       // the whole line fits: clear, gentle, never climbing, and well apart from every other line
        for (const [kind, t0, len] of P) { const ax = x + ux * t0, az = z + uz * t0, bx = ax + ux * len, bz = az + uz * len, cx = (ax + bx) / 2, cz = (az + bz) / 2;
          if (kind === 'k' && gy(bx, bz) - gy(bx + ux * 14, bz + uz * 14) > 2.5) D.kickers.push([r2(cx), r2(gy(cx, cz)), r2(cz), r2(ux), r2(uz), 9, 9, 3.3]);       // the land falls away past the lip: a gap kicker, the dip below is the landing
          else if (kind === 'k') D.kickers.push([r2(cx), r2(gy(cx, cz)), r2(cz), r2(ux), r2(uz), 9, 9, r2(2.4 + prn() * 0.8)]);
          else if (kind === 'l') D.ledges.push([r2(ax), r2(gy(ax, az)), r2(az), r2(bx), r2(gy(bx, bz)), r2(bz), 0.8]);
          else if (kind === 'r') D.poles.push([r2(ax), r2(gy(ax, az) + 0.7), r2(az), r2(bx), r2(gy(bx, bz) + 0.7), r2(bz)]);
          else D.quarters.push([r2(ax), r2(gy(ax, az)), r2(az), r2(ux), r2(uz), 12]);
          for (let s = 0; s <= len; s += 4) put('k', ax + ux * s, az + uz * s); }
        for (let s = -20; s < 0; s += 4) put('u', x + ux * s, z + uz * s);       // the run-up
        { const lane = (q, pad) => { const dx = q[0] - x, dz = q[2] - z, s = dx * ux + dz * uz, w = dx * uz - dz * ux; return s > -20 && s < t + 4 && Math.abs(w) < 5.5 + pad; }; for (const k of ['cacti', 'dead', 'solid']) D[k] = D[k].filter(q => !lane(q, k === 'solid' ? q[3] : 0)); }       // nothing standing in the run-up or along the line: a cactus by a block can sit in the lane
        if (open) D.parkPots.push({ x: r2(x + ux * (t + 6)), z: r2(z + uz * (t + 6)), vases: [[r2(-uz * 1.4), r2(ux * 1.4), false], [r2(uz * 1.4), r2(-ux * 1.4), prn() < 0.2]] });
        return true; };
      // the opening view: in the start's own cell, a line from about 40 m out along the start view, running away from the camera
      if (W.spawn && Math.floor(W.spawn.x / Q) === qx && Math.floor(W.spawn.z / Q) === qz) { const fx = -sinA(W.startYaw), fz = -cosA(W.startYaw); let a0 = 0, bd = -2; for (let k = 0; k < 48; k++) { const a = k * TAU / 48, d = cosA(a) * fx + sinA(a) * fz; if (d > bd) { bd = d; a0 = a; } }
        const sx = W.spawn.x, sz = W.spawn.z, sc = W.school && W.school[0], lat = sc ? ((sc[0] - sx) * fz - (sc[1] - sz) * fx > 0 ? -8 : 8) : 0; let done = false;
        for (const T0 of [null, ['k', 'l', 'k'], ['k', 'r'], ['k']]) for (const d of [40, 32, 48, 26, 56, 64]) for (const la of [lat, -lat, 0, 16, -16, 24, -24]) for (const da of [0, 0.13, -0.13, 0.26, -0.26, 0.39, -0.39, 0.52, -0.52]) if (!done) done = line(sx + fx * d + fz * la, sz + fz * d - fx * la, a0 + da, true, T0);       // the full line if it fits, else a shorter one: never a lone piece dropped blind
      }
      for (let li = 0, n = 0; li < 90 && n < 3; li++) { let bx = 0, bz = 0, bs = -9; for (let c = 0; c < 4; c++) { const x = C.x0 + 30 + prn() * (Q - 60), z = C.z0 + 30 + prn() * (Q - 60), sc = W.valleyAt(x, z) + slp(x, z); if (sc > bs) { bs = sc; bx = x; bz = z; } }       // start where riders go: a valley floor or a hill face
        let a = 0, as = -9; for (let k = 0; k < 16; k++) { const aa = k * TAU / 16, s2 = lineScore(bx, bz, cosA(aa), sinA(aa)); if (s2 > as) { as = s2; a = aa; } } if (line(bx, bz, a, false)) n++; } }
    fill(Math.round(21 * mul.dead), 300, 'd', 16, (x, z) => ok(x, z, 2), (x, z) => dead(x, z, 1.25 + rn() * 0.35));
    fill(Math.round(8 * (T === 4 ? 2 : T === 2 ? 0.3 : 1)), 200, 'p', 20, (x, z) => ok(x, z, 2, 0.35), () => {});       // (no loose pots out in the open: the no-junk rule; pots stand only by landmarks, and vases you can break are in the pockets)
    // ride lines: from every pocket, 2 to 4 grindable beams laid one after another toward the next pocket (a short gap between, so an ollie carries from one to the next), and in two pockets out of five a set of five seal stones along the line
    C.pockets.forEach((pk, pi) => { let tx = C.x0 + Q / 2, tz = C.z0 + Q / 2; const other = C.pockets[1 - pi]; if (other) { tx = other.x; tz = other.z; } else { tx += (rn() - 0.5) * Q; tz += (rn() - 0.5) * Q; }
      let dx = tx - pk.x, dz = tz - pk.z, dl = sq(dx * dx + dz * dz) || 1; dx /= dl; dz /= dl; const n = 2 + ((rn() * 3) | 0); let ox = pk.x + dx * 12, oz = pk.z + dz * 12;
      for (let k = 0; k < n; k++) { const len = 7 + rn() * 3, cx = ox + dx * len / 2, cz = oz + dz * len / 2; const ax = cx - dx * len / 2, az = cz - dz * len / 2, bx = cx + dx * len / 2, bz = cz + dz * len / 2; if (!free(cx, cz, 0.5) || !free(ax, az, 0.6) || !free(bx, bz, 0.6) || !free((ax + cx) / 2, (az + cz) / 2, 0.6) || !free((bx + cx) / 2, (bz + cz) / 2, 0.6) || slp(cx, cz) > 0.35 || D.solid.some(o => { const sx = bx - ax, sz = bz - az, l2 = sx * sx + sz * sz, u = Math.max(0, Math.min(1, ((o[0] - ax) * sx + (o[2] - az) * sz) / l2)), ex = ax + sx * u - o[0], ez = az + sz * u - o[2], rr = o[3] + 1; return ex * ex + ez * ez < rr * rr; })) break; D.logs.push([r2(ax), r2(gy(ax, az) - 0.15), r2(az), r2(bx), r2(gy(bx, bz) - 0.15), r2(bz), r2(0.5), 3]); put('l', cx, cz); put('l', ax, az); put('l', bx, bz); ox = bx + dx * (3 + rn() * 2); oz = bz + dz * (3 + rn() * 2); const lat = (rn() - 0.5) * 0.6, c2 = 1 - lat * lat * 0.5; const ndx = dx * c2 - dz * lat, ndz = dz * c2 + dx * lat; dx = ndx; dz = ndz; }
      if (rn() < 0.4) { const sid = ((qx + 128) * 512 + (qz + 128)) * 4 + pi; const set = []; for (let k = 0; k < 5; k++) { const d = 10 + k * 7, side = (k % 2 ? 1 : -1) * 2.0, sx = pk.x + dx * d - dz * side, sz = pk.z + dz * d + dx * side; if (free(sx, sz, 0)) set.push([r2(sx), r2(gy(sx, sz)), r2(sz), sid]); } if (set.length === 5) for (const q of set) D.seals.push(q); } });
    // the ruin field's half-sunk carved stone cards (solid), and the dry lake's cracked salt (flat, view only)
    if (T === 4) fill(9, 300, 'k', 16, (x, z) => ok(x, z, 2.5, 0.3), (x, z) => { const y = gy(x, z), s = 0.8 + rn() * 0.7; D.cards.push([r2(x), r2(y), r2(z), r2(s), r2(rn() * TAU)]); D.solid.push([r2(x), r2(y), r2(z), r2(1.2 * s), r2(3.2 * s), 1]); put('k', x, z); });
    if (T === 2) for (let k = 0, t = 0; k < 46 && t < 200; t++) { let x = C.x0 + rn() * Q, z = C.z0 + rn() * Q; if (!free(x, z, 1)) continue; const pts = [r2(x), r2(z)]; let a = rn() * TAU; for (let s = 0; s < 3; s++) { a += (rn() - 0.5) * 1.4; const l = 2.5 + rn() * 4; x += cosA(a) * l; z += sinA(a) * l; pts.push(r2(x), r2(z)); } D.cracks.push(pts); k++; }
    // cactus clumps (owner, 27 Nov): fewer and smaller, and never within 6 m of the start or of a park line piece (they hid the path). Removed after placement, so nothing else in the cell moves.
    { const near = (x, z) => (W.spawn && dist(x, z, W.spawn.x, W.spawn.z) < 9) || D.kickers.some(q => dist(x, z, q[0], q[2]) < 6 + q[5] / 2) || D.quarters.some(q => dist(x, z, q[0], q[2]) < 7) || D.ledges.concat(D.poles).some(q => { const sx = q[3] - q[0], sz = q[5] - q[2], l2 = sx * sx + sz * sz || 1, u = Math.max(0, Math.min(1, ((x - q[0]) * sx + (z - q[2]) * sz) / l2)); return dist(x, z, q[0] + sx * u, q[2] + sz * u) < 6; });
      const gone = new Set(); D.cacti.forEach((c, k) => { if (near(c[0], c[2])) gone.add(k); else if (k % 2 && D.cacti.some((o, j) => j !== k && !gone.has(j) && dist(o[0], o[2], c[0], c[2]) < 3)) gone.add(k); });       // every other cactus of a tight clump goes
      if (gone.size) { const keyOf = c => c[0] + "," + c[2], dead = new Set([...gone].map(k => keyOf(D.cacti[k]))); D.cacti = D.cacti.filter((c, k) => !gone.has(k)); D.solid = D.solid.filter(s => !dead.has(s[0] + "," + s[2])); } }
    if (W.killBowl) { const B = W.killBowl, inside = (x, z) => dist(x, z, B.x, B.z) < B.out + 6;
      for (const k of Object.keys(D)) if (Array.isArray(D[k])) D[k] = D[k].filter(q => { const x = Array.isArray(q) ? q[0] : q.x, z = Array.isArray(q) ? (q.length > 2 && typeof q[2] === 'number' ? q[2] : q[1]) : q.z; return typeof x !== 'number' || !inside(x, z); });
      if (Math.floor(B.x / Q) === qx && Math.floor(B.z / Q) === qz) { const y = B.h0 === undefined ? gy(B.x, B.z) : B.h0;
        for (const s of [-1, 1]) { const v = B.z + s * 16; D.kickers.push([r2(B.x - 30), r2(y), r2(v), 1, 0, 9, 9, 2.6]); D.poles.push([r2(B.x - 17.5), r2(y + 0.7), r2(v), r2(B.x - 7.5), r2(y + 0.7), r2(v)]); D.kickers.push([r2(B.x + 6), r2(y), r2(v), 1, 0, 9, 9, 2.6]); D.ledges.push([r2(B.x + 20), r2(y), r2(v + s * 8), r2(B.x + 30), r2(y), r2(v + s * 8), 0.8]); }
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8, ux = cosA(a), uz = sinA(a), x = B.x + ux * (B.floor + 2), z = B.z + uz * (B.floor + 2); D.quarters.push([r2(x), r2(gy(x, z)), r2(z), r2(ux), r2(uz), 12]); } } }
    if (W.gym) { const G = W.gym, inside = (x, z) => dist(x, z, G.x, G.z) < G.edge + 10;
      for (const k of Object.keys(D)) if (Array.isArray(D[k])) D[k] = D[k].filter(q => { const x = Array.isArray(q) ? q[0] : q.x, z = Array.isArray(q) ? (q.length > 2 && typeof q[2] === 'number' ? q[2] : q[1]) : q.z; return !inside(x, z); });
      if (Math.floor(G.x / Q) === qx && Math.floor(G.z / Q) === qz) { const v = G.z - 30, y = gy(G.x, v);
        D.kickers.push([r2(G.x - 6), r2(y), r2(v), 1, 0, 9, 9, 2.6]); D.poles.push([r2(G.x + 6.5), r2(y + 0.7), r2(v), r2(G.x + 16.5), r2(y + 0.7), r2(v)]); D.kickers.push([r2(G.x + 30), r2(y), r2(v), 1, 0, 9, 9, 2.6]); D.quarters.push([r2(G.x + 55), r2(y), r2(v), 1, 0, 12]); } }       // the gym's line runs east 30 m south of the centre
    return D;
  };
  W.cellOf = (x, z) => cell(Math.floor(x / Q), Math.floor(z / Q));
  // ---- the start: on a slope with a wide view, a pad under the feet, a free chest beside it, the first mesa or landmark in front
  const gather9 = (x, z) => { const o = { blocks: [], pockets: [], rings: [] }; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const C = cell(Math.floor(x / Q) + i, Math.floor(z / Q) + j); for (const b of C.blocks) o.blocks.push(b); for (const q of C.pockets) o.pockets.push(q); if (C.ring) o.rings.push(C.ring); for (const e of C.extras) o.pockets.push(e); } return o; };
  W.gather9 = gather9;
  const relief = (x, z, r) => { let lo = 1e9, hi = -1e9; for (const f of [r, r * 0.6]) for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = baseH(x + cosA(t) * f, z + sinA(t) * f); if (h < lo) lo = h; if (h > hi) hi = h; } return hi - lo; };
  const rs = rngOf(seed ^ 0x5EED5);
  let sp = null;
  for (let t = 0; t < 4000 && !sp; t++) {
    const r = 40 + (t / 4000) * 700, a = rs() * TAU, x = cosA(a) * r, z = sinA(a) * r, o = gather9(x, z);
    if (t < 3000) { const S = W.sv, u = x * S.c + z * S.s, v = Math.abs(-x * S.s + z * S.c + 22 * sinA(u / 90) - S.off); if (v < 14 || v > 48) continue; }       // the start sits beside the start valley, so its line is in sight within 60 m
    if (slope(x, z) > 0.22 || spread(x, z, 5) > 0.9) continue; const rl = relief(x, z, 30); if (rl < 3 || rl > 14) continue;
    if (o.blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + 20) || o.pockets.some(p => dist(p.x, p.z, x, z) < 45) || o.rings.some(q => dist(q.x, q.z, x, z) < 45)) continue; sp = [x, z];
  }
  if (!sp) sp = [0, 0];
  if (W.gym) sp = [W.gym.x, W.gym.z - 45];
  W.spawn = { x: r2(sp[0]), z: r2(sp[1]) }; W.addPad(sp[0], sp[1], 3, 9);
  // the free chest a short way from the start
  let fc = null; { const o = gather9(sp[0], sp[1]); for (let r = 14; r <= 30 && !fc; r += 2) for (let a2 = 0; a2 < 16 && !fc; a2++) { const x = sp[0] + cosA(a2 * TAU / 16) * r, z = sp[1] + sinA(a2 * TAU / 16) * r; if (spread(x, z, 3) < 0.9 && !o.blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + 3) && !o.pockets.some(p => dist(p.x, p.z, x, z) < 14)) fc = { type: 'cchest', x, z, free: true }; } }
  if (W.gym) fc = { type: 'cchest', x: W.gym.x + 36, z: W.gym.z + 46, free: true };       // the gym: the reward sits on the mesa
  if (fc) { W.addPad(fc.x, fc.z, 3, 8); } W.freeChest = fc;
  // the start is generous: a Witness Stone 35 to 60 m out and a second free chest 60 to 100 m out, on flat ground clear of everything, so the first item comes inside the first minute
  W.startExtras = []; { const o = gather9(sp[0], sp[1]); for (const [type, lo, hi] of [['stone', 35, 60], ['cchest', 60, 100]]) { let site = null; for (let t = 0; t < 400 && !site; t++) { const r = lo + rs() * (hi - lo), a = rs() * TAU, x = sp[0] + cosA(a) * r, z = sp[1] + sinA(a) * r; if (spread(x, z, 3) > 0.9 || o.blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + 4) || o.pockets.some(p => dist(p.x, p.z, x, z) < 16) || o.rings.some(q => dist(q.x, q.z, x, z) < 30) || (fc && dist(fc.x, fc.z, x, z) < 12) || W.startExtras.some(q => dist(q.x, q.z, x, z) < 14)) continue; site = { type, x, z, free: true }; } if (site) { W.addPad(site.x, site.z, 3, 8); W.startExtras.push(site); } } }
  // the first landmark or mesa the start looks at
  { let bd = 1e9, bt = null; const o = gather9(sp[0], sp[1]); for (const b of o.blocks) { const d = dist(b.cx, b.cz, sp[0], sp[1]); if (b.h >= 7 && d >= 50 && d < bd) { bd = d; bt = b; } } for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const b = landmark(Math.floor(sp[0] / LC) + i, Math.floor(sp[1] / LC) + j); if (b) { const d = dist(b.cx, b.cz, sp[0], sp[1]); if (d >= 80 && d < 900 && d < bd * 3) { bd = Math.min(bd, d); bt = b; } } } { let by = 0, bdot = -9; const dx = bt ? bt.cx - sp[0] : 0, dz = bt ? bt.cz - sp[1] : 0, dl = sq(dx * dx + dz * dz) || 1; for (let k = 0; k < 48; k++) { const a = k * TAU / 48, fx = -sinA(a), fz = -cosA(a); let vq = 0; for (let d = 18; d <= 60; d += 6) { const q = W.valleyAt(sp[0] + fx * d, sp[1] + fz * d); if (q > vq) vq = q; } const dot = (bt ? (fx * dx + fz * dz) / dl : 0) + 1.5 * vq; if (dot > bdot) { bdot = dot; by = a; } } W.startYaw = r2(by); } W.startLandmark = bt; }
  if (W.gym) W.startYaw = r2(3.141592653589793);
  else { const ba = W.startYaw + 1.7, fx = -sinA(ba), fz = -cosA(ba); W.killBowl = { x: r2(W.spawn.x + fx * 200), z: r2(W.spawn.z + fz * 200), floor: 55, r: 72, out: 92, bank: 7 }; }       // the kill bowl, 200 m out to the side of the start view (clear of the wonder line ahead)       // the gym: facing north up the arena
  // ride school: a straight line of three beams just ahead of the spawn and 3.5 m to the right, along the start view, for the first ollie and grind (the tutorial points at it)
  // (the opening view looks toward the landmark and a wave valley in sight within 110 m, the valley weighted more)
  // ride school: three short beams in the opening view (within about 25 degrees of the start camera, 18 to 36 m ahead), the flattest such line, with the ground flattened under each
  { let best = null, bs = 1e9; for (const k of [0, 0.12, -0.12, 0.24, -0.24]) for (const side of [2.5, -2.5]) { const yw = W.startYaw + k, fx = -sinA(yw), fz = -cosA(yw), ox = sp[0] - fz * side, oz = sp[1] + fx * side, L = []; let worst = 0; for (const [d0, d1] of [[18, 22.5], [25, 29.5], [32, 36.5]]) { const ax = ox + fx * d0, az = oz + fz * d0, bx = ox + fx * d1, bz = oz + fz * d1; worst = Math.max(worst, spread((ax + bx) / 2, (az + bz) / 2, 4)); L.push([ax, az, bx, bz]); } if (worst < bs) { bs = worst; best = L; } }
    W.school = best; for (const s of best) W.addPad((s[0] + s[2]) / 2, (s[1] + s[3]) / 2, 3.5, 7); }
  // the wonder of this seed: a long ride line of 5 to 8 beams from about 60 m out, leading toward the landmark the start faces, with five seal stones along it; all five lit in one combo opens an epic chest
  W.wonder = null; { const bt = W.startLandmark, base = bt ? (() => { const dx = bt.cx - sp[0], dz = bt.cz - sp[1]; let best = W.startYaw, bd = -2; const dl = sq(dx * dx + dz * dz) || 1; for (let k = 0; k < 96; k++) { const a = k * TAU / 96, d = (-sinA(a) * dx - cosA(a) * dz) / dl; if (d > bd) { bd = d; best = a; } } return best; })() : W.startYaw, stop = bt ? dist(bt.cx, bt.cz, sp[0], sp[1]) - reachOf(bt) - 12 : 1e9;
    for (const [b0, lim] of [[base, stop]].concat([0, 1, 2, 3, 4, 5, 6, 7].map(i => [base + (i + 0.5) * TAU / 8, 1e9]))) for (const k of [0, 1, -1, 2, -2, 3, -3]) { if (W.wonder) break; const yw = b0 + k * 0.12, fx = -sinA(yw), fz = -cosA(yw); let beams = [], best = [], d = 50, last = -1e9;
      while (best.length < 8 && beams.length < 8 && d + 9 < Math.min(lim, 260)) { const ax = sp[0] + fx * d, az = sp[1] + fz * d, bx = ax + fx * 9, bz = az + fz * 9, o = gather9((ax + bx) / 2, (az + bz) / 2); if (spread((ax + bx) / 2, (az + bz) / 2, 4) > 2.2 || o.blocks.some(b => dist(b.cx, b.cz, (ax + bx) / 2, (az + bz) / 2) < reachOf(b) + 6) || o.pockets.some(p => dist(p.x, p.z, (ax + bx) / 2, (az + bz) / 2) < 10)) { d += 3; continue; } if (d - last > 22 && beams.length) { if (beams.length > best.length) best = beams; beams = []; } beams.push([ax, az, bx, bz]); last = d; d += 13; }
      if (best.length > beams.length) beams = best;       // the longest run of beams with no gap wider than an ollie (about 10 m)
      if (beams.length >= 5) { const seals = []; for (let s = 0; s < 5; s++) { const b = beams[s], side = (s % 2 ? 1 : -1) * 2.0, cx = (b[0] + b[2]) / 2 - fz * side, cz = (b[1] + b[3]) / 2 + fx * side; seals.push([cx, cz]); } W.wonder = { beams, seals, yaw: r2(yw) }; } } }
  // the three sleepers (the elite and the two mini bosses): on flat sand 220, 420 and 650 m from the start
  W.sleepers = []; { const o0 = gather9(sp[0], sp[1]); void o0; for (const [role, r0] of [['elite', 230], ['bossA', 430], ['bossB', 650]]) { let site = null; for (let t = 0; t < 600 && !site; t++) { const r = r0 + (rs() - 0.5) * 80, a = rs() * TAU, x = sp[0] + cosA(a) * r, z = sp[1] + sinA(a) * r; if (r4(x, z) > EDGE - 400) continue; const o = gather9(x, z); if (spread(x, z, 5) > 1.3 || slope(x, z) > 0.25 || o.blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + 14) || o.pockets.some(p => dist(p.x, p.z, x, z) < 22) || o.rings.some(q => dist(q.x, q.z, x, z) < 24) || W.sleepers.some(q => dist(q.x, q.z, x, z) < 120)) continue; site = { role, x: r2(x), z: r2(z) }; } if (site) { W.sleepers.push(site); W.addPad(site.x, site.z, 4, 8); } } }
  void cbrt; void qOf;
  return W;
}
