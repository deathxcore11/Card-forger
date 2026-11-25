// The big desert: a world 32 km across made of seeded regions, never stored whole. Every number comes from (seed, x, z) or (seed, cell), so a chunk can be built when the duelist nears it and dropped when they leave, and the same seed always gives the same world.
// The land has a plan. A macro layer cuts the world into regions of 1 to 3 km (jittered cells of 2200 m), each with one character: a dune sea, a mesa field, a dry lake bed, a canyon run, a ruin field of carved stone cards, a dead forest, a ridge spine.
// Heights blend between the two nearest regions over about 640 m, so there are no seams. A slow global rise and fall sits under all of it. A ring of steep mountains closes the world.
// Everything placed lives in 256 m cells (one pocket of things to do, mesas and ruin blocks, sometimes a boss ring), and a landmark (tall mesa, spire, giant half-sunk card) in each 1100 m cell so a place can be seen from far off.
// The sim reads the heights as 1 m cells (fillSim, in 64 m chunks), the view as the plain ground without the box of a mesa (viewH): the same split the first open desert made.
import { vnoise, duneH, blockProf as prof, qOf, bankOf, reachOf, block, sstep, rngOf, cosA, sinA, cbrt, MAX_DROP } from '../open/terrain.js';
const TAU = 6.283185307179586;
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
const POCKETS2 = [['vases', 0.5], ['stone', 0.2], ['cchest', 0.14], ['shrine', 0.11], ['broker', 0.02], ['altar', 0.03]];
const POCKETS = [['vases', 0.34], ['cchest', 0.22], ['shrine', 0.15], ['stone', 0.17], ['altar', 0.07], ['broker', 0.05]];
// blocks per cell by region type: [mesa p/count, wall, ruin]  (counts are lo..hi inclusive)
const COUNTS = [[[0, 1, 0.3], [0, 0, 0], [0, 1, 0.3]], [[2, 3, 1], [0, 1, 0.6], [1, 2, 1]], [[0, 1, 0.1], [0, 0, 0], [0, 1, 0.3]], [[1, 2, 1], [0, 1, 0.5], [0, 1, 0.4]], [[0, 1, 0.4], [0, 0, 0], [4, 7, 1]], [[0, 1, 0.2], [0, 0, 0], [0, 1, 0.5]], [[0, 1, 0.5], [1, 1, 0.4], [0, 1, 0.3]]];

export function makeWorld(seedLo, stageIndex) {
  const seed = ((seedLo >>> 0) ^ Math.imul(stageIndex + 1, 0x85EBCA6B)) >>> 0, rr = rngOf(seed ^ 0xC0FFEE), wind = rr() * TAU, WP = { wind };
  const W = { seed, wind, stage: stageIndex, regionNames: REGION, extra: [] };
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
  const regH = (R, x, z) => {
    let h = duneH(R.P, x, z) - R.off;
    if (R.type === 3) h -= R.trD * (1 - sstep(0.02, 0.16, Math.abs(2 * vnoise(R.P.seed ^ 0x701, x / 520, z / 520) - 1)));
    else if (R.type === 6) h += R.rgH * (1 - sstep(0, 0.2, Math.abs(2 * vnoise(R.P.seed ^ 0x711, x / 900, z / 900) - 1)));
    return h;
  };
  function mount(x, z) {
    const r = r4(x, z), w = 90 * (vnoise(seed ^ 0x401, x / 400, z / 400) - 0.5) + 8 * (vnoise(seed ^ 0x402, x / 32, z / 32) - 0.5) * 2, q = r - (EDGE + w);
    if (q <= 0) return 0;
    const top = 31 + 25 * vnoise(seed ^ 0x403, x / 130, z / 130), rise = 28 + 10 * vnoise(seed ^ 0x404, x / 90, z / 90), u = q >= rise ? 1 : q / rise, su = u * u * (3 - 2 * u);
    const rid = 1 - Math.abs(2 * vnoise(seed ^ 0x405, x / 26, z / 26) - 1), rid2 = 1 - Math.abs(2 * vnoise(seed ^ 0x407, x / 11, z / 11) - 1);
    return top * su + 10 * rid * sstep(0.15, 0.9, u) + 3.5 * rid2 * sstep(0.3, 1, u) + 2 * (vnoise(seed ^ 0x406, x / 12, z / 12) - 0.5) * sstep(0.3, 1, u);
  }
  // the ground before anything is placed on it: the blended regions, the slow global rise and fall, the mountains
  function baseH(x, z) {
    const n = near2(x, z), t = sstep(-320, 320, n.db - n.da); let h = regH(n.A, x, z) * t; if (t < 0.999) h += regH(n.B, x, z) * (1 - t);
    return h + 11 + 5 * vnoise(seed ^ 0x31, x / 2600, z / 2600) + mount(x, z);
  }
  // the colour a region gives the sand (view only): [colour, strength] per type, blended across the same 640 m band as the heights
  const TINT = [[0xf3c978, 0], [0xe0a060, 0.38], [0xeee2c8, 0.6], [0xd98a50, 0.45], [0xe8d29a, 0.25], [0xc9b378, 0.4], [0xd6a878, 0.35]], mixh = (a, b, t) => { const m = sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
  W.tintAt = (x, z) => { const n = near2(x, z), t = sstep(-320, 320, n.db - n.da), A = TINT[n.A.type], B = TINT[n.B.type]; return { c: mixh(B[0], A[0], t), k: B[1] * (1 - t) + A[1] * t }; };
  W.baseH = baseH; W.regionAt = (x, z) => near2(x, z).A; W.mount = mount;
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
  function cell(qx, qz) {
    const key = (qx + 128) * 512 + (qz + 128); let C = cells.get(key); if (C) return C;
    const x0 = qx * Q, z0 = qz * Q, cxm = x0 + Q / 2, czm = z0 + Q / 2; C = { qx, qz, x0, z0, blocks: [], pocket: null, pockets: [], ring: null, extras: [], type: 0, pads: [] }; cells.set(key, C);
    if (r4(cxm, czm) > EDGE - 300) return C;
    C.type = near2(cxm, czm).A.type; const rn = rngOf(hsh(seed, qx, qz, 0xCE11)), T = C.type, fixed = [];
    for (let j = Math.floor(z0 / LC) - 1; j <= Math.floor((z0 + Q) / LC) + 1; j++) for (let i = Math.floor(x0 / LC) - 1; i <= Math.floor((x0 + Q) / LC) + 1; i++) { const b = landmark(i, j); if (b && b.cx >= x0 && b.cx < x0 + Q && b.cz >= z0 && b.cz < z0 + Q) { C.blocks.push(b); fixed.push(b); } else if (b) fixed.push(b); }
    const clear = (x, z, d) => fixed.every(b => dist(b.cx, b.cz, x, z) >= reachOf(b) + d) && C.blocks.every(b => dist(b.cx, b.cz, x, z) >= reachOf(b) + d);
    // the pocket: one thing to do near the middle of the cell, on the flattest of ten tries, so the next one is never more than about 40 s away
    let best = null, bs = 1e9; for (let t = 0; t < 10; t++) { const x = cxm + (rn() - 0.5) * 140, z = czm + (rn() - 0.5) * 140; if (!clear(x, z, 26)) continue; const s = spread(x, z, 6); if (s < bs) { bs = s; best = [x, z]; } }
    if (best) {
      let roll = rn(), kind = 'vases'; for (const [k, w] of POCKETS) { if (roll < w) { kind = k; break; } roll -= w; }
      const big = kind === 'broker', pk = { type: kind, x: r2(best[0]), z: r2(best[1]), rIn: big ? 4 : 3, rOut: big ? 7 : 8 };
      if (kind === 'vases') { const n = 5 + ((rn() * 4) | 0); pk.vases = []; for (let k = 0; k < n; k++) { const a = rn() * TAU, d = k ? 0.9 + rn() * 2.4 : 0; pk.vases.push([r2(cosA(a) * d), r2(sinA(a) * d), rn() < 0.12]); } }
      C.pocket = pk; C.pockets.push(pk); C.pads.push(padOf(pk.x, pk.z, pk.rIn, pk.rOut));
    }
    // a second, lighter pocket 110 m or more from the first, so a straight drive through the cell almost always passes something
    { let b2 = null, s2 = 1e9; for (let t = 0; t < 14; t++) { const x = x0 + 30 + rn() * (Q - 60), z = z0 + 30 + rn() * (Q - 60); if (!clear(x, z, 26) || (C.pocket && dist(x, z, C.pocket.x, C.pocket.z) < 110)) continue; const s = spread(x, z, 6); if (s < s2) { s2 = s; b2 = [x, z]; } }
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
    D = { cacti: [], dead: [], logs: [], pots: [], heads: [], stalls: [], solid: [] }; dcache.set(key, D); const C = cell(qx, qz); if (!C.type && r4(C.x0 + Q / 2, C.z0 + Q / 2) > EDGE - 300) return D;
    const rn = rngOf(hsh(seed, qx, qz, 0xD7E55)), T = C.type, F = W.gather(C.x0, C.z0, C.x0 + Q, C.z0 + Q, 40), keep = [];
    for (const q of C.pockets) keep.push([q.x, q.z, q.type === 'broker' ? 12 : 7]); if (C.ring) keep.push([C.ring.x, C.ring.z, 18]); for (const e of C.extras) keep.push([e.x, e.z, 5]); for (const p of W.extra) keep.push([p.x, p.z, Math.max(p.rOut, 10)]);
    const mul = { cactus: [0.6, 0.8, 0.15, 0.9, 0.7, 0.4, 0.6][T], dead: [0.6, 0.8, 0.2, 0.6, 1.0, 3.0, 0.5][T], logs: [0.6, 0.8, 0.2, 0.7, 1.6, 1.2, 0.5][T] };
    const free = (x, z, pad) => { for (const k of keep) { const r = k[2] + (pad || 0); if ((x - k[0]) * (x - k[0]) + (z - k[1]) * (z - k[1]) < r * r) return false; } for (const b of F.blocks) if (dist(b.cx, b.cz, x, z) < reachOf(b) + 1 + (pad || 0)) return false; return true; };
    const gy = (x, z) => viewOver(x, z, baseH(x, z), F), slp = (x, z) => { const e = 1.2; return sq(((gy(x + e, z) - gy(x - e, z)) ** 2 + (gy(x, z + e) - gy(x, z - e)) ** 2) / (4 * e * e)); };
    const grid = new Map(), gk = (x, z) => Math.floor(x / 8) * 4096 + Math.floor(z / 8), put = (kind, x, z) => { const k = gk(x, z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push([kind, x, z]); };
    const nearby = (kind, x, z, d) => { for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const a = grid.get(gk(x + i * 8, z + j * 8)); if (a) for (const o of a) if ((kind === '*' || o[0] === kind) && (o[1] - x) * (o[1] - x) + (o[2] - z) * (o[2] - z) < d * d) return true; } return false; };
    const dens = (x, z) => 0.6 * vnoise(seed & 0xffff, x / 70, z / 70) + 0.4 * vnoise((seed >>> 7) & 0xffff, x / 28, z / 28), ok = (x, z, pad, ms) => free(x, z, pad) && slp(x, z) < (ms || 0.42);
    const cactus = (x, z, s) => { const y = gy(x, z); D.cacti.push([r2(x), r2(y), r2(z), r2(s), r2(rn() * TAU), (rn() * 3) | 0]); D.solid.push([r2(x), r2(y), r2(z), r2(0.55 * s), r2(3.5 * s)]); put('c', x, z); };
    const dead = (x, z, s) => { const y = gy(x, z); D.dead.push([r2(x), r2(y), r2(z), r2(s), r2(rn() * TAU), (rn() * 3) | 0]); D.solid.push([r2(x), r2(y), r2(z), r2(0.55 * s), r2(6 * s)]); put('d', x, z); };
    const beam = (x, z, len, rad, kind) => { const a = rn() * TAU, dx = cosA(a) * len / 2, dz = sinA(a) * len / 2; D.logs.push([r2(x - dx), r2(gy(x - dx, z - dz) - 0.15), r2(z - dz), r2(x + dx), r2(gy(x + dx, z + dz) - 0.15), r2(z + dz), r2(rad), kind]); put('l', x, z); };
    const potc = (x, z) => { const n = 3 + ((rn() * 3) | 0); for (let q = 0; q < n; q++) { const a = rn() * TAU, d = q ? 0.8 + rn() * 1.3 : 0, px = x + cosA(a) * d, pz = z + sinA(a) * d; D.pots.push([r2(px), r2(gy(px, pz)), r2(pz), r2(0.9 + rn() * 0.7), r2(rn() * TAU), (rn() * 3) | 0]); } put('p', x, z); };
    const fill = (n, tries, kind, sep, pred, make) => { let k = 0; for (let t = 0; t < tries && k < n; t++) { const x = C.x0 + rn() * Q, z = C.z0 + rn() * Q; if (!pred(x, z) || nearby(kind, x, z, sep)) continue; make(x, z); k++; } };
    // groups of cacti beside every block, a few logs and a clay pot cluster at its foot
    for (const b of C.blocks) {
      for (let g = 0; g < 2 && !(g && rn() < 0.5); g++) { const a0 = rn() * TAU, d0 = reachOf(b) + 3 + rn() * 7, cx = b.cx + cosA(a0) * d0, cz = b.cz + sinA(a0) * d0, n = 4 + ((rn() * 6) | 0); let k = 0; for (let t = 0; t < 40 && k < n; t++) { const a = rn() * TAU, d = 0.8 + rn() * 4.5, x = cx + cosA(a) * d, z = cz + sinA(a) * d; if (!ok(x, z, 1, 0.45) || nearby('c', x, z, 1.7)) continue; cactus(x, z, k === 0 ? 1.3 + rn() * 0.25 : 0.6 + rn() * 0.7); k++; } }
      if (rn() < 0.55 * (T === 5 ? 1.5 : 1)) { const a0 = rn() * TAU, d0 = reachOf(b) + 4 + rn() * 8, x = b.cx + cosA(a0) * d0, z = b.cz + sinA(a0) * d0; if (ok(x, z, 2) && !nearby('d', x, z, 6)) dead(x, z, 1.25 + rn() * 0.35); }
      { const a0 = rn() * TAU, d0 = Math.max(b.rx, b.rz) * 1.05 + 4 + rn() * 3, x = b.cx + cosA(a0) * d0, z = b.cz + sinA(a0) * d0; if (ok(x, z, 1.5, 0.35)) potc(x, z); const a1 = a0 + 2 + rn() * 2, d1 = d0 + 3 + rn() * 3, x1 = b.cx + cosA(a1) * d1, z1 = b.cz + sinA(a1) * d1; if (free(x1, z1, 1) && slp(x1, z1) < 0.5) beam(x1, z1, 6 + rn() * 3, 0.45 + rn() * 0.25, 2); }
    }
    fill(Math.round(50 * mul.cactus), 400, 'c', 12, (x, z) => dens(x, z) > 0.3 && ok(x, z, 2), (x, z) => cactus(x, z, 0.9 + rn() * 0.6));
    fill(Math.round(21 * mul.dead), 300, 'd', 16, (x, z) => ok(x, z, 2), (x, z) => dead(x, z, 1.25 + rn() * 0.35));
    fill(Math.round(75 * mul.logs), 500, 'l', 10, (x, z) => ok(x, z, 1, 0.5), (x, z) => beam(x, z, 6 + rn() * 3, 0.4 + rn() * 0.3, (rn() * 2) | 0));
    fill(Math.round(8 * (T === 4 ? 2 : T === 2 ? 0.3 : 1)), 200, 'p', 20, (x, z) => ok(x, z, 2, 0.35), (x, z) => potc(x, z));
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
    if (slope(x, z) > 0.22 || spread(x, z, 5) > 0.9) continue; const rl = relief(x, z, 30); if (rl < 3 || rl > 14) continue;
    if (o.blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + 20) || o.pockets.some(p => dist(p.x, p.z, x, z) < 45) || o.rings.some(q => dist(q.x, q.z, x, z) < 45)) continue; sp = [x, z];
  }
  if (!sp) sp = [0, 0];
  W.spawn = { x: r2(sp[0]), z: r2(sp[1]) }; W.addPad(sp[0], sp[1], 3, 9);
  // the free chest a short way from the start
  let fc = null; { const o = gather9(sp[0], sp[1]); for (let r = 14; r <= 30 && !fc; r += 2) for (let a2 = 0; a2 < 16 && !fc; a2++) { const x = sp[0] + cosA(a2 * TAU / 16) * r, z = sp[1] + sinA(a2 * TAU / 16) * r; if (spread(x, z, 3) < 0.9 && !o.blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + 3) && !o.pockets.some(p => dist(p.x, p.z, x, z) < 14)) fc = { type: 'cchest', x, z, free: true }; } }
  if (fc) { W.addPad(fc.x, fc.z, 3, 8); } W.freeChest = fc;
  // the first landmark or mesa the start looks at
  { let bd = 1e9, bt = null; const o = gather9(sp[0], sp[1]); for (const b of o.blocks) { const d = dist(b.cx, b.cz, sp[0], sp[1]); if (b.h >= 7 && d >= 50 && d < bd) { bd = d; bt = b; } } for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const b = landmark(Math.floor(sp[0] / LC) + i, Math.floor(sp[1] / LC) + j); if (b) { const d = dist(b.cx, b.cz, sp[0], sp[1]); if (d >= 80 && d < 900 && d < bd * 3) { bd = Math.min(bd, d); bt = b; } } } { let by = 0, bdot = -2; if (bt) { const dx = bt.cx - sp[0], dz = bt.cz - sp[1], dl = sq(dx * dx + dz * dz) || 1; for (let k = 0; k < 48; k++) { const a = k * TAU / 48, dot = (-sinA(a) * dx - cosA(a) * dz) / dl; if (dot > bdot) { bdot = dot; by = a; } } } W.startYaw = r2(by); } W.startLandmark = bt; }
  // the three sleepers (the elite and the two mini bosses): on flat sand 220, 420 and 650 m from the start
  W.sleepers = []; { const o0 = gather9(sp[0], sp[1]); void o0; for (const [role, r0] of [['elite', 230], ['bossA', 430], ['bossB', 650]]) { let site = null; for (let t = 0; t < 600 && !site; t++) { const r = r0 + (rs() - 0.5) * 80, a = rs() * TAU, x = sp[0] + cosA(a) * r, z = sp[1] + sinA(a) * r; if (r4(x, z) > EDGE - 400) continue; const o = gather9(x, z); if (spread(x, z, 5) > 1.3 || slope(x, z) > 0.25 || o.blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + 14) || o.pockets.some(p => dist(p.x, p.z, x, z) < 22) || o.rings.some(q => dist(q.x, q.z, x, z) < 24) || W.sleepers.some(q => dist(q.x, q.z, x, z) < 120)) continue; site = { role, x: r2(x), z: r2(z) }; } if (site) { W.sleepers.push(site); W.addPad(site.x, site.z, 4, 8); } } }
  void cbrt; void qOf;
  return W;
}
