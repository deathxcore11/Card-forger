// Open terrain (preview, ?terrain=open): one square landscape, 360 m a side, a smooth heightfield with no tiers, no rooms and no walls but the plain steep bank round the edge.
// Each seed picks a landscape archetype (a to f), then draws every landform from the seed: gentle rolling ground (0 to 2 m), mesas (flat top, cliff on some sides, one to three smooth ramps on the others), round hills, long ridges with a saddle,
// a basin, a diagonal escarpment, terraced plateaus. Ramps and hills are never steeper than about 20 degrees; only mesa flanks and ramp flanks are steep. Integer hash and + - * / sqrt only (no sin, cos, pow, clock): the same seed gives the same ground everywhere.
// The sim reads the same heightfield (400 x 400 cells of 1 m, WALL outside the square); the view samples it on a 2 m grid with true heights.
const SIM = 400, HALF = 200, S = 360, OFF = 20, WALL = 99, EDGE_H = 14;
export const ARCHETYPES = ['a', 'b', 'c', 'd', 'e', 'f'];
export const ARCH_NAME = { a: 'Great Mesa', b: 'Twin Ridges', c: 'Ring of Hills', d: 'Escarpment', e: 'Knolls and Mesas', f: 'Terraced Plateau' };
const TAU = 6.283185307179586;
function sq(v) { if (!(v > 0)) return 0; let x = v > 1 ? (v + 1) / 2 : 1; for (let k = 0; k < 40; k++) { const y = 0.5 * (x + v / x); if (y >= x && k > 4) break; x = y; } return x; }       // square root by Newton's method (+ - * / only, the same on every platform)
const sstep = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const smax = (a, b, k) => (a + b + sq((a - b) * (a - b) + k * k)) / 2;
function rngOf(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function lat(seed, ix, iz) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(seed, x, z) { const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz), a = lat(seed, x0, z0), b = lat(seed, x0 + 1, z0), c = lat(seed, x0, z0 + 1), d = lat(seed, x0 + 1, z0 + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const cosA = a => { a = ((a % TAU) + TAU) % TAU; const t = a > 3.141592653589793 ? a - TAU : a; return polyCos(t); };       // cos and sin by a short series (no Math.cos): angles are reduced to -pi..pi
function polyCos(t) { let q = t, flip = 1; if (q > 1.5707963267948966) { q = 3.141592653589793 - q; flip = -1; } else if (q < -1.5707963267948966) { q = -3.141592653589793 - q; flip = -1; } const x = q * q; return flip * (1 - x / 2 + x * x / 24 - x * x * x / 720 + x * x * x * x / 40320 - x * x * x * x * x / 3628800); }
const sinA = a => cosA(a - 1.5707963267948966);

// ---- landform builders: each returns { bb: [x0, x1, z0, z1], f(x, z) -> height above 0 (0 outside), tops: [[x, z]] } ----
function mesa(rn, o) {
  const { cx, cz, rx, rz, h } = o, rot = o.rot, cr = cosA(rot), sr = sinA(rot), cw = Math.max(3, h * 0.45), seed = Math.floor(rn() * 1e9), ramps = o.ramps.map(r => ({ dx: cosA(r.ang), dz: sinA(r.ang), w: r.w }));
  const edge = (dx, dz) => { const ux = (dx * cr + dz * sr) / rx, uz = (-dx * sr + dz * cr) / rz, q4 = ux * ux * ux * ux + uz * uz * uz * uz; return 1 / sq(sq(q4)); };       // distance from the centre to the footprint edge along a direction
  for (const r of ramps) { r.t0 = edge(r.dx, r.dz) - cw * 0.5; r.L = h * 4.3; }
  const R = Math.max(rx, rz) * 1.25 + 6, Lmax = Math.max(0, ...ramps.map(r => r.t0 + r.L + 12));
  const m = Math.max(R, Lmax);
  return { bb: [cx - m, cx + m, cz - m, cz + m], tops: [[cx, cz]], mesa: { cx, cz, h, rx, rz }, f: (x, z) => {
    const dx = x - cx, dz = z - cz, ux = (dx * cr + dz * sr) / rx, uz = (-dx * sr + dz * cr) / rz;
    let v = 0; const q4 = ux * ux * ux * ux + uz * uz * uz * uz;
    if (q4 < 2.2) { let q = sq(sq(q4)); q = q / (1 + 0.16 * (vnoise(seed, x * 0.04, z * 0.04) - 0.5)); const s = (1 - q) * ((rx + rz) / 2); if (s > 0) v = h * sstep(0, cw, s); }
    for (const r of ramps) { const t = dx * r.dx + dz * r.dz, u = -dx * r.dz + dz * r.dx; if (t < r.t0 - cw || t > r.t0 + r.L) continue; const hr = h * (1 - sstep(r.t0, r.t0 + r.L, t)), lm = 1 - sstep(r.w / 2, r.w / 2 + 5 + 0.6 * hr, Math.abs(u)); const rv = hr * lm; if (rv > v) v = rv; }
    return v;
  } };
}
function hill(rn, o) {
  const { cx, cz, h } = o, R = Math.max(o.R, h * 4.6), asp = o.asp || 1, cr = cosA(o.rot || 0), sr = sinA(o.rot || 0);
  return { bb: [cx - R * asp, cx + R * asp, cz - R * asp, cz + R * asp], tops: [[cx, cz]], f: (x, z) => { const dx = x - cx, dz = z - cz, u = (dx * cr + dz * sr) / asp, v = -dx * sr + dz * cr, q2 = (u * u + v * v) / (R * R); if (q2 >= 1) return 0; const a = 1 - q2; return h * a * a; } };
}
function ridge(rn, o) {
  const { ax, az, bx, bz, h } = o, W = Math.max(o.W, h * 4.4), len = sq((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), tx = (bx - ax) / len, tz = (bz - az) / len, ts = o.saddle === undefined ? 0.5 : o.saddle, sp = o.sp === undefined ? 0.5 : o.sp, sw = Math.max(0.1, 26 / len);
  const m = W + 4;
  return { bb: [Math.min(ax, bx) - m, Math.max(ax, bx) + m, Math.min(az, bz) - m, Math.max(az, bz) + m], tops: [[ax + (bx - ax) * 0.2, az + (bz - az) * 0.2], [ax + (bx - ax) * 0.8, az + (bz - az) * 0.8]], f: (x, z) => {
    const dx = x - ax, dz = z - az, t = (dx * tx + dz * tz) / len, l = -dx * tz + dz * tx; if (Math.abs(l) >= W) return 0;
    const e = sstep(0, 0.2, t) * sstep(0, 0.2, 1 - t); if (e <= 0) return 0; const sad = 1 - sp * (1 - sstep(0, sw, Math.abs(t - ts))), q2 = (l * l) / (W * W), a = 1 - q2; return h * e * sad * a * a; } };
}
function basin(rn, o) { const { cx, cz, R, depth } = o; return { bb: [cx - R, cx + R, cz - R, cz + R], tops: [], neg: true, f: (x, z) => { const q2 = ((x - cx) * (x - cx) + (z - cz) * (z - cz)) / (R * R); if (q2 >= 1) return 0; const a = 1 - q2; return depth * a * a; } }; }
// a plateau on one side of a diagonal line: a cliff along the line, with ramps cut down to the low side
function escarpment(rn, o) {
  const { cx, cz, h } = o, nx = cosA(o.ang), nz = sinA(o.ang), tx = -nz, tz = nx, cw = 3.5, L = h * 4.3, ramps = o.ramps, seed = Math.floor(rn() * 1e9);
  return { bb: [-HALF, HALF, -HALF, HALF], tops: o.tops, f: (x, z) => {
    const dx = x - cx, dz = z - cz, d0 = dx * nx + dz * nz, along = dx * tx + dz * tz, d = d0 + 7 * (vnoise(seed, along * 0.02, 3.3) - 0.5);       // the edge wanders a little along its length
    let v = h * sstep(0, cw, d) + (d > cw ? 3.2 * sstep(cw, cw + 25, d) * (vnoise(seed, x * 0.03, z * 0.03) - 0.4) : 0);
    for (const r of ramps) { const a = -d, u = along - r.s; if (a > L || d > cw) continue; const hr = a <= 0 ? h : h * (1 - sstep(0, L, a)), lm = 1 - sstep(r.w / 2, r.w / 2 + 5 + 0.6 * hr, Math.abs(u)); if (hr * lm > v) v = hr * lm; }
    return v; } };
}
// terraces stepping down from a corner as smooth slopes (about 15 degrees), each a flat tread
function terraces(rn, o) {
  const { sx, sz, a, tread, rise, wid } = o, seed = Math.floor(rn() * 1e9), n = 3;
  return { bb: [-HALF, HALF, -HALF, HALF], tops: o.tops, f: (x, z) => { const p = ((x * sx + z * sz) / 1.4142135623730951) + 16 * (vnoise(seed, x * 0.012, z * 0.012) - 0.5); let v = 0; for (let k = 0; k < n; k++) v += rise * sstep(a + k * (tread + wid), a + k * (tread + wid) + wid, p); return v > 0.5 ? v + 1.6 * sstep(0, 20, v) * (vnoise(seed ^ 5, x * 0.035, z * 0.035) - 0.4) : v; } };
}

// ---- the edge: a ring of steep rock hills 17 to 25 m high that carries on outward into far hills (the view draws them; the sim has wall cells from 2 m in)
const PLAY = HALF - OFF;                                                                           // 180: half the square
function edgeD(seed, x, z) {
  const ax = PLAY - Math.abs(x), az = PLAY - Math.abs(z), useX = ax < az, e = useX ? ax : az, along = useX ? z : x, side = useX ? (x < 0 ? 0 : 1) : (z < 0 ? 2 : 3);
  return { e: e + 7 * (vnoise(seed ^ 0x51, along / 52, side * 7.3) - 0.5) * 2, top: 17 + 8 * vnoise(seed ^ 0x52, along / 70, side * 3.1 + 9) };
}
const bankH = (seed, x, z) => { const q = edgeD(seed, x, z); return q.e >= 30 ? 0 : q.top * (1 - sstep(0, 30, q.e)); };
export function outerH(seed, x, z) {                                                               // the ground beyond the square: the bank's top carrying on into far hills
  const q = edgeD(seed, x, z); if (q.e >= 0) return bankH(seed, x, z); const d = -q.e;
  return q.top + 14 * sstep(0, 160, d) + 10 * vnoise(seed ^ 0x53, x / 38, z / 38) * sstep(0, 30, d) + 5 * vnoise(seed ^ 0x54, x / 16, z / 16) * sstep(0, 20, d);
}

// ---- the archetypes: each returns the landforms of this seed, 7 to 10 major ones (big enough to be the map) plus a few minor knolls; they may overlap and blend
function layout(arch, rn) {
  const L = [], placed = []; let major = 0;
  const add = (f, x, z, r, isMajor = true) => { f.major = isMajor; f.cx = x; f.cz = z; L.push(f); placed.push({ x, z, r }); if (isMajor) major++; };
  const spot = (r, margin) => { for (let k = 0; k < 150; k++) { const m = Math.max(margin, r * 0.35 + 40), x = -PLAY + m + rn() * (S - 2 * m), z = -PLAY + m + rn() * (S - 2 * m); let ok = true; for (const p of placed) { const dx = x - p.x, dz = z - p.z, rr = 0.5 * (r + p.r); if (dx * dx + dz * dz < rr * rr) { ok = false; break; } } if (ok) return { x, z }; } return null; };
  const addMesa = () => { const rx = 20 + rn() * 14, rz = 18 + rn() * 14, h = 10 + rn() * 7, R = Math.max(rx, rz) + h * 2.2, p = spot(R, 50); if (!p) return; add(mesa(rn, { cx: p.x, cz: p.z, rx, rz, rot: rn() * TAU, h, ramps: ramps(rn, 1 + ((rn() * 3) | 0), 12) }), p.x, p.z, R); };
  const addHill = (rmin, rmax, hmin, hmax, isMajor = true) => { const h = hmin + rn() * (hmax - hmin), R = Math.max(rmin + rn() * (rmax - rmin), h * 4.6), p = spot(R, 50); if (!p) return; add(hill(rn, { cx: p.x, cz: p.z, R, h, asp: 1 + rn() * 0.5, rot: rn() * TAU }), p.x, p.z, R, isMajor); };
  if (arch === 'a') {
    const cx = (rn() - 0.5) * 40, cz = (rn() - 0.5) * 40, rot = rn() * TAU, a0 = rn() * TAU;
    add(mesa(rn, { cx, cz, rx: 62 + rn() * 8, rz: 56 + rn() * 8, rot, h: 6 + rn() * 2, ramps: [{ ang: a0, w: 14 + rn() * 4 }, { ang: a0 + 3.4, w: 14 + rn() * 4 }] }), cx, cz, 105);
    add(mesa(rn, { cx: cx + (rn() - 0.5) * 16, cz: cz + (rn() - 0.5) * 16, rx: 32 + rn() * 6, rz: 28 + rn() * 6, rot: rot + 0.5, h: 16 + rn() * 2, ramps: [{ ang: a0 + 1.6, w: 14 }, { ang: a0 + 4.8, w: 14 }] }), cx, cz, 70);
    for (let k = 0; k < 7; k++) addHill(32, 46, 6, 10.5); addMesa();
  } else if (arch === 'b') {
    const th = rn() * TAU, c = cosA(th), s = sinA(th), off = 66 + rn() * 14, len = 250 + rn() * 30;
    for (const sg of [-1, 1]) { const mx = -s * off * sg, mz = c * off * sg, jx = (rn() - 0.5) * 20; add(ridge(rn, { ax: mx - c * len / 2 + jx, az: mz - s * len / 2, bx: mx + c * len / 2 + jx, bz: mz + s * len / 2, W: 40 + rn() * 6, h: 8 + rn() * 2, saddle: 0.3 + rn() * 0.4, sp: 0.5 }), mx, mz, 80); }
    add(basin(rn, { cx: (rn() - 0.5) * 60 * c, cz: (rn() - 0.5) * 60 * s, R: 48, depth: 3 + rn() * 2 }), 0, 0, 40, false);
    for (let k = 0; k < 4; k++) addHill(30, 44, 5, 9); for (let k = 0; k < 3; k++) addMesa();
  } else if (arch === 'c') {
    const n = 7, a0 = rn() * TAU, rr = 100 + rn() * 10;
    add(basin(rn, { cx: 0, cz: 0, R: 62, depth: 4 + rn() * 2 }), 0, 0, 50, false);
    for (let k = 0; k < n; k++) { const a = a0 + k * TAU / n + (rn() - 0.5) * 0.2, h = 6 + rn() * 4, R = Math.max(34 + rn() * 8, h * 4.6); add(hill(rn, { cx: cosA(a) * rr, cz: sinA(a) * rr, R, h, asp: 1 + rn() * 0.4, rot: a + 1.57 }), cosA(a) * rr, sinA(a) * rr, R); }
    for (let k = 0; k < 2; k++) addMesa(); addHill(28, 36, 5, 8);
  } else if (arch === 'd') {
    const ang = rn() * TAU, h = 9 + rn() * 3, cx = (rn() - 0.5) * 50, cz = (rn() - 0.5) * 50, ra = [];
    for (let k = 0; k < 3; k++) ra.push({ s: -90 + k * 90 + (rn() - 0.5) * 24, w: 14 + rn() * 5 });
    const nx = cosA(ang), nz = sinA(ang), tops = [];
    for (let k = 0; k < 6; k++) { const s = -140 + k * 56, d = 35 + rn() * 50; tops.push([cx + (-nz) * s + nx * d, cz + nx * s + nz * d]); }
    add(escarpment(rn, { cx, cz, ang, h, ramps: ra, tops }), cx, cz, 90);
    for (let k = 0; k < 9; k++) addHill(32, 46, 6, 10.5); for (let k = 0; k < 2; k++) addMesa();
  } else if (arch === 'e') {
    for (let k = 0; k < 8; k++) addHill(30, 46, 5, 10);
    for (let k = 0; k < 3; k++) addMesa();
  } else {
    const sx = rn() < 0.5 ? -1 : 1, sz = rn() < 0.5 ? -1 : 1, tread = 34 + rn() * 12, wid = 24 + rn() * 4, a = -10 + rn() * 30, tops = [];
    for (let k = 1; k <= 3; k++) { const p = a + (k - 1) * (tread + wid) + wid + tread / 2 + 30; tops.push([(sx * p) / 1.4142 - sz * (rn() - 0.5) * 120, (sz * p) / 1.4142 + sx * (rn() - 0.5) * 120]); }
    add(terraces(rn, { sx, sz, a: a + 30, tread, rise: 4, wid, tops }), sx * 80, sz * 80, 110);
    for (let k = 0; k < 8; k++) addHill(32, 46, 6, 10.5); for (let k = 0; k < 2; k++) addMesa();
  }
  for (let k = 0; k < 3; k++) addHill(14, 22, 2, 3.5, false);                         // minor knolls
  return { L, major };
}
function ramps(rn, n, w0) { const out = [], a0 = rn() * TAU; for (let k = 0; k < n; k++) out.push({ ang: a0 + k * (TAU / n) + (rn() - 0.5) * 0.7, w: w0 + rn() * 6 }); return out; }

// ---- the heightfield: rolling base 0 to 4 m, the landforms blended on, the bank round the edge
function field(L, seed) {
  const G = new Float32Array(S * S), F = new Float32Array(S * S), N = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF; G[j * S + i] = 8 * (0.45 * vnoise(seed ^ 0x11, x / 50, z / 50) + 0.4 * vnoise(seed ^ 0x22, x / 23, z / 23)) + 1.8 * vnoise(seed ^ 0x33, x / 11, z / 11); }
  for (const lf of L) {
    const x0 = Math.max(0, Math.floor(lf.bb[0] + HALF - OFF)), x1 = Math.min(S - 1, Math.ceil(lf.bb[1] + HALF - OFF)), z0 = Math.max(0, Math.floor(lf.bb[2] + HALF - OFF)), z1 = Math.min(S - 1, Math.ceil(lf.bb[3] + HALF - OFF));
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { const v = lf.f(i + 0.5 - HALF + OFF, j + 0.5 - HALF + OFF); if (v <= 0.005) continue; const k = j * S + i; if (lf.neg) N[k] += v; else F[k] = F[k] <= 0 ? v : smax(F[k], v, 1.2); }
  }
  for (let k = 0; k < S * S; k++) G[k] = (F[k] > 0 ? smax(G[k], F[k] + 0.3 * G[k], 1.2) : G[k]) - N[k];
  return G;
}
const at = (G, x, z) => { const i = Math.floor(x + HALF - OFF), j = Math.floor(z + HALF - OFF); return i < 0 || j < 0 || i >= S || j >= S ? WALL : G[j * S + i]; };
// a flatten pad: inside rIn the ground is the height at the centre, between rIn and rOut it blends back to the hills with a smoothstep (a flush piece with an earthen approach)
function pad(G, cx, cz, rIn, rOut) {
  let s = 0, n = 0; for (let dz = -rIn; dz <= rIn; dz += 1) for (let dx = -rIn; dx <= rIn; dx += 1) if (dx * dx + dz * dz <= rIn * rIn) { s += at(G, cx + dx, cz + dz); n++; } const hc = n ? s / n : at(G, cx, cz);
  const i0 = Math.max(0, Math.floor(cx - rOut + HALF - OFF)), i1 = Math.min(S - 1, Math.ceil(cx + rOut + HALF - OFF)), j0 = Math.max(0, Math.floor(cz - rOut + HALF - OFF)), j1 = Math.min(S - 1, Math.ceil(cz + rOut + HALF - OFF));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF, d = sq((x - cx) * (x - cx) + (z - cz) * (z - cz)); if (d >= rOut) continue; const w = 1 - sstep(rIn, rOut, d); G[j * S + i] += (hc - G[j * S + i]) * w; }
  return hc;
}
const slopeAt = (G, x, z) => { const a = at(G, x + 1, z), b = at(G, x - 1, z), c = at(G, x, z + 1), d = at(G, x, z - 1); if (a >= 50 || b >= 50 || c >= 50 || d >= 50) return 9; return sq(((a - b) * (a - b) + (c - d) * (c - d)) / 4); };
const spread = (G, x, z, r) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = at(G, x + cosA(t) * r, z + sinA(t) * r); if (h >= 50) return 99; lo = Math.min(lo, h); hi = Math.max(hi, h); } const h0 = at(G, x, z); return Math.max(hi, h0) - Math.min(lo, h0); };

// ---- checks over the inner 300 m (the bank is the edge, not the play area): slope shares, relief, what the starting kit can reach
export function analyse(G, from) {
  let sl = 0, open = 0, tot = 0, lo = 1e9, hi = -1e9; const walk = new Uint8Array(S * S);
  for (let j = 2; j < S - 2; j++) for (let i = 2; i < S - 2; i++) { const k = j * S + i, sx = (G[k + 1] - G[k - 1]) / 2, sz = (G[k + S] - G[k - S]) / 2, s2 = sx * sx + sz * sz; if (i < 30 || i >= S - 30 || j < 30 || j >= S - 30) continue; if (s2 < 0.25) walk[k] = 1; tot++; if (s2 < 0.0719) open++; if (s2 >= 0.00766 && s2 < 0.1632) sl++; if (G[k] < lo) lo = G[k]; if (G[k] > hi) hi = G[k]; }
  const seen = new Uint8Array(S * S), q = []; const s = (Math.floor(from[1] + HALF - OFF)) * S + Math.floor(from[0] + HALF - OFF); seen[s] = 1; q.push(s);
  while (q.length) { const c = q.pop(), x = c % S, z = (c / S) | 0; for (let d = 0; d < 4; d++) { const xx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), zz = z + (d === 2 ? 1 : d === 3 ? -1 : 0); if (xx < 0 || zz < 0 || xx >= S || zz >= S) continue; const m = zz * S + xx; if (seen[m] || Math.abs(G[m] - G[c]) > 0.5 || G[m] > 40) continue; seen[m] = 1; q.push(m); } }
  let w = 0, wr = 0; for (let k = 0; k < S * S; k++) if (walk[k]) { w++; if (seen[k]) wr++; }
  return { openFrac: open / tot, slopeShare: sl / tot, range: hi - lo, reach: seen, walkFrac: w ? wr / w : 0 };
}

// ---- paths: a seeded network over the walkable ground (colour only), spawn to gate and out to every reward, found by cheapest-slope routes on a 4 m grid
function paths(G, points) {
  const C = 90, cs = 4, cx = i => -PLAY + (i + 0.5) * cs, idx = (x, z) => Math.max(0, Math.min(C - 1, Math.floor((z + PLAY) / cs))) * C + Math.max(0, Math.min(C - 1, Math.floor((x + PLAY) / cs)));
  const cost = new Float32Array(C * C); for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) { const s = slopeAt(G, cx(i), cx(j)), h = at(G, cx(i), cx(j)); cost[j * C + i] = s > 0.5 || h > 40 || Math.abs(cx(i)) > 158 || Math.abs(cx(j)) > 158 ? 1e9 : 1 + 30 * s * s; }
  const route = (a, b) => {
    const dist = new Float32Array(C * C).fill(1e18), prev = new Int32Array(C * C).fill(-1), s = idx(a[0], a[1]), t = idx(b[0], b[1]); dist[s] = 0; const heap = [[0, s]];
    const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) { const [d, u] = pop(); if (d > dist[u]) continue; if (u === t) break; const ux = u % C, uz = (u / C) | 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const x = ux + dx, z = uz + dz; if (x < 0 || z < 0 || x >= C || z >= C) continue; const v = z * C + x, c = cost[v]; if (c >= 1e8) continue; const nd = d + c * (dx && dz ? 1.4142 : 1); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); } } }
    if (prev[t] < 0 && t !== s) return null; const out = []; for (let u = t; u >= 0; u = prev[u]) out.push([cx(u % C), cx((u / C) | 0)]); out.reverse(); return out;
  };
  const chaikin = P => { for (let r = 0; r < 2; r++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { Q.push([P[i][0] * 0.75 + P[i + 1][0] * 0.25, P[i][1] * 0.75 + P[i + 1][1] * 0.25], [P[i][0] * 0.25 + P[i + 1][0] * 0.75, P[i][1] * 0.25 + P[i + 1][1] * 0.75]); } Q.push(P[P.length - 1]); P = Q; } return P; };
  const out = [], linked = [0]; const rest = points.map((p, i) => i).slice(1);
  while (rest.length) { let bi = -1, bj = -1, bd = 1e18; for (const i of rest) for (const j of linked) { const d = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2; if (d < bd) { bd = d; bi = i; bj = j; } } const r = route(points[bj], points[bi]); if (r && r.length > 1) out.push(chaikin(r).map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])); linked.push(bi); rest.splice(rest.indexOf(bi), 1); }
  return out;
}

function attempt(seed, arch, k) {
  const rn = rngOf((seed ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0), lay = layout(arch, rn), L = lay.L, G = field(L, seed ^ k);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF; G[j * S + i] += bankH(seed, x, z); }
  const relief = (x, z, r) => { let lo = 1e9, hi = -1e9; for (const rr of [r, r * 0.6]) for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = at(G, x + cosA(t) * rr, z + sinA(t) * rr); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
  // spawn on a slope (never a flat plate): standable underfoot, the ground rising and falling within 30 m; gate on gentle ground 190 m or more away
  const cand = []; for (let z = -120; z <= 120; z += 9) for (let x = -120; x <= 120; x += 9) { const rl = relief(x, z, 30); if (slopeAt(G, x, z) <= 0.22 && spread(G, x, z, 5) <= 0.9 && rl >= 2 && rl <= 8) cand.push([x, z]); }
  const gcand = []; for (let z = -135; z <= 135; z += 9) for (let x = -135; x <= 135; x += 9) if (spread(G, x, z, 24) <= 3.2 && slopeAt(G, x, z) < 0.3) gcand.push([x, z]);
  if (cand.length < 8 || gcand.length < 8) return null;
  for (let tries = 0; tries < 30; tries++) {
    const sp = cand[(rn() * cand.length) | 0], far = gcand.filter(c => Math.sqrt((c[0] - sp[0]) * (c[0] - sp[0]) + (c[1] - sp[1]) * (c[1] - sp[1])) >= 190); if (!far.length) continue;
    const gt = far[(rn() * far.length) | 0], h0 = at(G, sp[0], sp[1]), dir = Math.atan2(gt[1] - sp[1], gt[0] - sp[0]); let forward = false;       // a landform at least 6 m high within 120 m in front of the spawn (60 degrees either side of the gate)
    for (let a = -1; a <= 1 && !forward; a += 0.25) for (let d = 30; d <= 120 && !forward; d += 10) if (at(G, sp[0] + cosA(dir + a) * d, sp[1] + sinA(dir + a) * d) - h0 >= 6) forward = true;
    if (!forward) continue;
    return { L, G, sp, gt, rn, forms: lay.major };
  }
  return null;
}

export function openMap(seedLo, stageIndex, archOverride) {
  const seed = ((seedLo >>> 0) ^ Math.imul(stageIndex + 1, 0x85EBCA6B)) >>> 0, rr = rngOf(seed ^ 0xC0FFEE), arch = archOverride && ARCHETYPES.includes(archOverride) ? archOverride : ARCHETYPES[(rr() * 6) | 0];
  for (let k = 0; k < 24; k++) {
    const a = attempt(seed, arch, k); if (!a) continue;
    const { G, sp, gt, rn, L } = a;
    pad(G, gt[0], gt[1], 14, 30); pad(G, sp[0], sp[1], 3, 9);
    let st = analyse(G, sp); if (st.slopeShare < 0.45 || st.openFrac < 0.4 || st.range < 18 || st.walkFrac < 0.97) continue;
    const reach = (x, z) => st.reach[Math.floor(z + HALF - OFF) * S + Math.floor(x + HALF - OFF)] === 1;
    if (!reach(gt[0], gt[1])) continue;
    // every walker sees at least two landforms: each point of a 40 m grid has two landform centres within 140 m
    const centres = L.filter(l => l.major).map(l => [l.cx, l.cz]); let seeOk = true; for (let z = -140; z <= 140 && seeOk; z += 40) for (let x = -140; x <= 140; x += 40) { let n = 0; for (const c of centres) if ((c[0] - x) * (c[0] - x) + (c[1] - z) * (c[1] - z) < 140 * 140) n++; if (n < 2) { seeOk = false; break; } } if (!seeOk) continue;
    const tops = []; for (const lf of L) for (const t of lf.tops) { if (Math.abs(t[0]) < 140 && Math.abs(t[1]) < 140 && reach(t[0], t[1]) && slopeAt(G, t[0], t[1]) < 0.4) tops.push({ x: t[0], z: t[1], y: at(G, t[0], t[1]) }); }
    tops.sort((p, q) => q.y - p.y); const used = [], enc = [], types = ['cchest', 'shrine', 'cchest', 'altar', 'cchest', 'stone', 'cchest', 'shrine', 'cchest', 'stone'];
    const far = (x, z, d) => used.every(u => (u.x - x) * (u.x - x) + (u.z - z) * (u.z - z) >= d * d) && (x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1]) > 40 * 40 && (x - gt[0]) * (x - gt[0]) + (z - gt[1]) * (z - gt[1]) > 45 * 45;
    for (const t of tops) { if (enc.length >= types.length) break; if (!far(t.x, t.z, 34)) continue; used.push(t); enc.push({ type: types[enc.length], x: t.x, z: t.z, y: t.y }); }
    let fc = null; for (let r = 14; r <= 28 && !fc; r += 2) for (let a2 = 0; a2 < 16 && !fc; a2++) { const x = sp[0] + cosA(a2 * TAU / 16) * r, z = sp[1] + sinA(a2 * TAU / 16) * r; if (spread(G, x, z, 3) < 0.7 && reach(x, z)) fc = { type: 'cchest', x, z, y: at(G, x, z), free: true }; }
    if (!fc) continue; enc.push(fc);
    let bk = null; for (let t = 0; t < 400 && !bk; t++) { const x = (rn() - 0.5) * 260, z = (rn() - 0.5) * 260, d = sq((x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1])); if (d > 60 && d < 150 && spread(G, x, z, 10) < 1.2 && reach(x, z) && far(x, z, 30)) bk = { type: 'broker', x, z, y: at(G, x, z) }; }
    if (!bk) continue; enc.push(bk);
    if (enc.filter(e => e.type === 'cchest').length < 4 || !enc.some(e => e.type === 'shrine') || !enc.some(e => e.type === 'altar') || !enc.some(e => e.type === 'stone')) continue;
    const rings = []; for (let t = 0; t < 800 && rings.length < 2; t++) { const x = (rn() - 0.5) * 270, z = (rn() - 0.5) * 270; if (spread(G, x, z, 15) > 1.0 || !reach(x, z)) continue; if (sq((x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1])) < 60 || sq((x - gt[0]) * (x - gt[0]) + (z - gt[1]) * (z - gt[1])) < 60 || rings.some(q => sq((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z)) < 80) || enc.some(e => sq((e.x - x) * (e.x - x) + (e.z - z) * (e.z - z)) < 20)) continue; rings.push({ x, z, r: 14, y: at(G, x, z) }); }
    if (!rings.length) continue;
    // pads under everything placed: the piece sits flush, the ground blends back into the hills
    for (const e of enc) { const big = e.type === 'broker'; e.y = pad(G, e.x, e.z, big ? 7 : 3, big ? 15 : 8); }
    for (const q of rings) q.y = pad(G, q.x, q.z, 14, 26);
    // half-buried ruins: cut into steep hillsides, sunk and tilted with the slope
    const ruins = [], kinds = ['wall', 'slab', 'arch', 'stair', 'wall', 'slab']; for (let t = 0; t < 900 && ruins.length < 5; t++) { const x = (rn() - 0.5) * 280, z = (rn() - 0.5) * 280, s = slopeAt(G, x, z); if (s < 0.28 || s > 0.5 || at(G, x, z) < 2) continue; if (ruins.some(q => sq((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z)) < 50) || enc.some(e => sq((e.x - x) * (e.x - x) + (e.z - z) * (e.z - z)) < 18) || sq((x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1])) < 30 || sq((x - gt[0]) * (x - gt[0]) + (z - gt[1]) * (z - gt[1])) < 40) continue;
      const gx = (at(G, x + 1, z) - at(G, x - 1, z)) / 2, gz = (at(G, x, z + 1) - at(G, x, z - 1)) / 2; ruins.push({ kind: kinds[ruins.length % kinds.length], x, z, y: at(G, x, z), face: Math.atan2(-gz, -gx), tilt: s }); }
    if (ruins.length < 3) continue;
    st = analyse(G, sp); if (st.walkFrac < 0.97) continue;
    // groves: 5 to 25 trees each with clearings between, on crests and gentle ground, spread over the map
    const groves = []; for (let t = 0; t < 1500 && groves.length < 16; t++) { const x = (rn() - 0.5) * 290, z = (rn() - 0.5) * 290, r = 7 + rn() * 9; if (slopeAt(G, x, z) > 0.4 || at(G, x, z) > 30) continue; const dens = vnoise(seed ^ 0x77, x / 80, z / 80); if (dens < 0.4 && rn() < 0.7) continue;
      if (groves.some(q => sq((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z)) < q.r + r + 26) || enc.some(e => sq((e.x - x) * (e.x - x) + (e.z - z) * (e.z - z)) < r + 8) || sq((x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1])) < r + 24 || sq((x - gt[0]) * (x - gt[0]) + (z - gt[1]) * (z - gt[1])) < r + 40 || rings.some(q => sq((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z)) < r + 20)) continue; groves.push({ x, z, r }); }
    const pts = [[sp[0], sp[1]], [gt[0], gt[1]]].concat(enc.map(e => [e.x, e.z]));
    return assemble({ arch, k, G, sp, gt, enc, rings, st, ruins, groves, paths: paths(G, pts), forms: a.forms }, seed, stageIndex);
  }
  return null;
}

function assemble(b, seed, stageIndex) {
  const H = new Float32Array(SIM * SIM).fill(WALL), Fl = new Uint16Array(SIM * SIM);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const e = Math.min(i, S - 1 - i, j, S - 1 - j); if (e < 2) continue; H[(j + OFF) * SIM + i + OFF] = Math.round(b.G[j * S + i] * 100) / 100; }
  const r2 = v => Math.round(v * 100) / 100, ex = e => Object.assign({}, e, { x: r2(e.x), z: r2(e.z), y: r2(e.y) });
  const key = 'open-' + b.arch + '-' + (seed >>> 0).toString(16);
  return {
    key, hash: key, sealCode: 'OPEN-' + b.arch.toUpperCase() + '-' + (seed >>> 0).toString(16).slice(0, 4).toUpperCase(), stage: stageIndex, attempt: b.k, fallback: false, half: HALF, v2: true, open: true, arch: b.arch, n: S, off: OFF, edgeSeed: seed,
    prims: [], heights: H, cellFlags: Fl, palette: undefined, stageName: ARCH_NAME[b.arch],
    districts: [], spawn: { x: r2(b.sp[0]), z: r2(b.sp[1]) }, gate: { x: r2(b.gt[0]), z: r2(b.gt[1]), radius: 5.5 }, arena: { center: { x: r2(b.gt[0]), z: r2(b.gt[1]) }, boss: { x: r2(b.gt[0]), z: r2(b.gt[1]) }, tollPull: { x: r2(b.gt[0] + 6), z: r2(b.gt[1]) } },
    bossRings: b.rings.map(q => ({ x: r2(q.x), z: r2(q.z), r: 14, y: r2(q.y) })), encounters: b.enc.map(ex), landmarks: [], kits: [], rooms: [], roomOf: null, gateways: [],
    clearings: b.enc.filter(e => e.type === 'broker').map(e => ({ x: r2(e.x), z: r2(e.z), r: 12 })), ruins: b.ruins.map(q => ({ kind: q.kind, x: r2(q.x), z: r2(q.z), y: r2(q.y), face: r2(q.face), tilt: r2(q.tilt) })), groves: b.groves.map(q => ({ x: r2(q.x), z: r2(q.z), r: r2(q.r) })), paths: b.paths,
    _road: { main: [[9000, 9000], [9001, 9001]], trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: 'open2', v2: true, attempt: b.k, fallback: false, openFrac: r2(b.st.openFrac), slopeShare: r2(b.st.slopeShare), range: r2(b.st.range), forms: b.forms, walkFrac: r2(b.st.walkFrac) }
  };
}