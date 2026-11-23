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
    let v = h * sstep(0, cw, d);
    for (const r of ramps) { const a = -d, u = along - r.s; if (a > L || d > cw) continue; const hr = a <= 0 ? h : h * (1 - sstep(0, L, a)), lm = 1 - sstep(r.w / 2, r.w / 2 + 5 + 0.6 * hr, Math.abs(u)); if (hr * lm > v) v = hr * lm; }
    return v; } };
}
// terraces stepping down from a corner as smooth slopes (about 15 degrees), each a flat tread
function terraces(rn, o) {
  const { sx, sz, a, tread, rise, wid } = o, seed = Math.floor(rn() * 1e9), n = 3;
  return { bb: [-HALF, HALF, -HALF, HALF], tops: o.tops, f: (x, z) => { const p = ((x * sx + z * sz) / 1.4142135623730951) + 16 * (vnoise(seed, x * 0.012, z * 0.012) - 0.5); let v = 0; for (let k = 0; k < n; k++) v += rise * sstep(a + k * (tread + wid), a + k * (tread + wid) + wid, p); return v; } };
}

// ---- the archetypes: each returns the list of landforms for this seed ----
function pickSpot(rn, placed, r, margin) {
  for (let k = 0; k < 40; k++) { const x = -HALF + 20 + margin + rn() * (S - 2 * margin), z = -HALF + 20 + margin + rn() * (S - 2 * margin); let ok = true; for (const p of placed) { const dx = x - p.x, dz = z - p.z; if (dx * dx + dz * dz < (r + p.r + 14) * (r + p.r + 14)) { ok = false; break; } } if (ok) return { x, z }; }
  return null;
}
function ramps(rn, n, w0) { const out = [], a0 = rn() * TAU; for (let k = 0; k < n; k++) out.push({ ang: a0 + k * (TAU / n) + (rn() - 0.5) * 0.7, w: w0 + rn() * 6 }); return out; }
function layout(arch, rn) {
  const L = [], placed = [], add = (f, x, z, r) => { L.push(f); placed.push({ x, z, r }); };
  const addMesa = (r, margin) => { const rx = 14 + rn() * 20, rz = 14 + rn() * 20, h = 5 + rn() * 5, R = Math.max(rx, rz) + h * 4.3 * 0.6, p = pickSpot(rn, placed, R, margin || 30); if (!p) return; add(mesa(rn, { cx: p.x, cz: p.z, rx, rz, rot: rn() * TAU, h, ramps: ramps(rn, 1 + ((rn() * 3) | 0), 10) }), p.x, p.z, R); };
  const addHill = (rmin, rmax, hmin, hmax, margin) => { const R = rmin + rn() * (rmax - rmin), h = hmin + rn() * (hmax - hmin), p = pickSpot(rn, placed, R, margin || 20); if (!p) return; add(hill(rn, { cx: p.x, cz: p.z, R, h, asp: 1 + rn() * 0.5, rot: rn() * TAU }), p.x, p.z, R); };
  if (arch === 'a') {
    const cx = (rn() - 0.5) * 40, cz = (rn() - 0.5) * 40, rot = rn() * TAU, a0 = rn() * TAU;
    L.push(mesa(rn, { cx, cz, rx: 62 + rn() * 8, rz: 56 + rn() * 8, rot, h: 5 + rn(), ramps: [{ ang: a0, w: 12 + rn() * 4 }, { ang: a0 + 3.4, w: 12 + rn() * 4 }] }));       // the lower shoulder, two ramps up from the plain
    L.push(mesa(rn, { cx: cx + (rn() - 0.5) * 16, cz: cz + (rn() - 0.5) * 16, rx: 32 + rn() * 6, rz: 28 + rn() * 6, rot: rot + 0.5, h: 12, ramps: [{ ang: a0 + 1.6, w: 12 }, { ang: a0 + 4.8, w: 12 }] }));       // the summit, two ramps from the shoulder at other angles: the road spirals up
    placed.push({ x: cx, z: cz, r: 110 });
    for (let k = 0; k < 6; k++) addHill(22, 34, 3, 6, 24); for (let k = 0; k < 2; k++) addMesa(24);
  } else if (arch === 'b') {
    const th = rn() * TAU, c = cosA(th), s = sinA(th), off = 56 + rn() * 14, len = 250 + rn() * 30;
    for (const sg of [-1, 1]) { const mx = -s * off * sg, mz = c * off * sg, jx = (rn() - 0.5) * 20; L.push(ridge(rn, { ax: mx - c * len / 2 + jx, az: mz - s * len / 2, bx: mx + c * len / 2 + jx, bz: mz + s * len / 2, W: 30 + rn() * 6, h: 7 + rn() * 2, saddle: 0.3 + rn() * 0.4, sp: 0.5 })); }
    placed.push({ x: 0, z: 0, r: 150 });
    L.push(basin(rn, { cx: (rn() - 0.5) * 60 * c, cz: (rn() - 0.5) * 60 * s, R: 48, depth: 3 + rn() * 1.5 }));
    for (let k = 0; k < 3; k++) addHill(20, 32, 3, 5, 24); for (let k = 0; k < 2; k++) addMesa(24);
  } else if (arch === 'c') {
    const n = 8 + ((rn() * 2) | 0), a0 = rn() * TAU, rr = 92 + rn() * 12;
    L.push(basin(rn, { cx: 0, cz: 0, R: 60, depth: 3.5 + rn() * 1.5 }));
    for (let k = 0; k < n; k++) { const a = a0 + k * TAU / n + (rn() - 0.5) * 0.18, R = 31 + rn() * 7, h = 5 + rn() * 3.5, x = cosA(a) * rr, z = sinA(a) * rr; L.push(hill(rn, { cx: x, cz: z, R, h, asp: 1 + rn() * 0.4, rot: a + 1.57 })); }
    placed.push({ x: 0, z: 0, r: 150 });
    for (let k = 0; k < 2; k++) addMesa(24); for (let k = 0; k < 3; k++) addHill(18, 26, 3, 4.5, 20);
  } else if (arch === 'd') {
    const ang = rn() * TAU, h = 8 + rn() * 2, cx = (rn() - 0.5) * 50, cz = (rn() - 0.5) * 50, ra = [];
    for (let k = 0; k < 3; k++) ra.push({ s: -90 + k * 90 + (rn() - 0.5) * 24, w: 11 + rn() * 5 });
    const nx = cosA(ang), nz = sinA(ang), tops = [];
    for (let k = 0; k < 6; k++) { const s = -140 + k * 56, d = 35 + rn() * 50; tops.push([cx + (-nz) * s + nx * d, cz + nx * s + nz * d]); }
    L.push(escarpment(rn, { cx, cz, ang, h, ramps: ra, tops }));
    placed.push({ x: 0, z: 0, r: 120 });
    for (let k = 0; k < 4; k++) addHill(18, 30, 3, 5, 24);
  } else if (arch === 'e') {
    for (let k = 0; k < 15; k++) addHill(16, 28, 3, 6, 22);
    for (let k = 0; k < 6; k++) addMesa(26);
  } else {
    const sx = rn() < 0.5 ? -1 : 1, sz = rn() < 0.5 ? -1 : 1, tread = 34 + rn() * 12, wid = 24 + rn() * 4, a = -10 + rn() * 30, tops = [];
    for (let k = 1; k <= 3; k++) { const p = a + (k - 1) * (tread + wid) + wid + tread / 2 + 40; tops.push([(sx * p) / 1.4142 + (-sz * (rn() - 0.5) * 80) / 1.4142 * 0 + (-sz * (rn() - 0.5) * 120), (sz * p) / 1.4142 + sx * (rn() - 0.5) * 120]); }
    L.push(terraces(rn, { sx, sz, a: a + 30, tread, rise: 4, wid, tops }));
    placed.push({ x: sx * 80, z: sz * 80, r: 120 });
    for (let k = 0; k < 5; k++) addHill(18, 30, 3, 5, 24); for (let k = 0; k < 2; k++) addMesa(24);
  }
  return L;
}

// ---- the heightfield ----
function field(L, seed) {
  const G = new Float32Array(S * S), F = new Float32Array(S * S), N = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF; G[j * S + i] = 2 * (0.65 * vnoise(seed ^ 0x11, x / 90, z / 90) + 0.35 * vnoise(seed ^ 0x22, x / 37, z / 37)); }
  for (const lf of L) {
    const x0 = Math.max(0, Math.floor(lf.bb[0] + HALF - OFF)), x1 = Math.min(S - 1, Math.ceil(lf.bb[1] + HALF - OFF)), z0 = Math.max(0, Math.floor(lf.bb[2] + HALF - OFF)), z1 = Math.min(S - 1, Math.ceil(lf.bb[3] + HALF - OFF));
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { const v = lf.f(i + 0.5 - HALF + OFF, j + 0.5 - HALF + OFF); if (v <= 0.005) continue; const k = j * S + i; if (lf.neg) N[k] += v; else F[k] = F[k] <= 0 ? v : smax(F[k], v, 0.8); }
  }
  for (let k = 0; k < S * S; k++) G[k] = (F[k] > 0 ? smax(G[k], F[k], 0.8) : G[k]) - N[k];
  return G;
}
const at = (G, x, z) => { const i = Math.floor(x + HALF - OFF), j = Math.floor(z + HALF - OFF); return i < 0 || j < 0 || i >= S || j >= S ? WALL : G[j * S + i]; };
function flatten(G, cx, cz, r0, r1) {
  let s = 0, n = 0; for (let dz = -r0; dz <= r0; dz += 2) for (let dx = -r0; dx <= r0; dx += 2) if (dx * dx + dz * dz <= r0 * r0) { s += at(G, cx + dx, cz + dz); n++; } const hc = s / n;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF, d = sq((x - cx) * (x - cx) + (z - cz) * (z - cz)); if (d >= r1) continue; const w = 1 - sstep(r0, r1, d); G[j * S + i] += (hc - G[j * S + i]) * w; }
  return hc;
}
const slopeAt = (G, x, z) => { const a = at(G, x + 1, z), b = at(G, x - 1, z), c = at(G, x, z + 1), d = at(G, x, z - 1); if (a >= 50 || b >= 50 || c >= 50 || d >= 50) return 9; return sq((a - b) * (a - b) + (c - d) * (c - d)) / 2; };
const spread = (G, x, z, r) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = at(G, x + cosA(t) * r, z + sinA(t) * r); if (h >= 50) return 99; lo = Math.min(lo, h); hi = Math.max(hi, h); } const h0 = at(G, x, z); return Math.max(hi, h0) - Math.min(lo, h0); };

function attempt(seed, arch, k) {
  const rn = rngOf((seed ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0), L = layout(arch, rn), G = field(L, seed ^ k);
  // spawn and gate on gentle ground, at least 190 m apart, 45 m from the edge
  const cand = []; for (let z = -135; z <= 135; z += 9) for (let x = -135; x <= 135; x += 9) if (spread(G, x, z, 18) <= 1.6) cand.push([x, z]);
  if (cand.length < 12) return null;
  const sp = cand[(rn() * cand.length) | 0], far = cand.filter(c => sq((c[0] - sp[0]) * (c[0] - sp[0]) + (c[1] - sp[1]) * (c[1] - sp[1])) >= 190); if (!far.length) return null;
  const gt = far[(rn() * far.length) | 0], arenaH = flatten(G, gt[0], gt[1], 18, 32), spawnH = flatten(G, sp[0], sp[1], 10, 22);
  // the edge: a plain steep bank all round
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF, e = Math.min(HALF - OFF - Math.abs(x), HALF - OFF - Math.abs(z)); if (e < 14) G[j * S + i] += EDGE_H * (1 - sstep(0, 14, e)); }
  return { L, G, sp, gt, spawnH, arenaH, rn };
}

// ---- checks: how much is open ground, and what the starting kit can reach ----
export function analyse(G, from) {
  let open = 0, tot = 0; const walk = new Uint8Array(S * S);
  for (let j = 2; j < S - 2; j++) for (let i = 2; i < S - 2; i++) { const k = j * S + i, sx = (G[k + 1] - G[k - 1]) / 2, sz = (G[k + S] - G[k - S]) / 2, sl = sq(sx * sx + sz * sz); tot++; if (sl < 0.268) open++; if (sl < 0.5) walk[k] = 1; }
  const seen = new Uint8Array(S * S), q = []; const s = (Math.floor(from[1] + HALF - OFF)) * S + Math.floor(from[0] + HALF - OFF); seen[s] = 1; q.push(s); let n = 0;
  while (q.length) { const c = q.pop(), x = c % S, z = (c / S) | 0; n++; for (let d = 0; d < 4; d++) { const xx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), zz = z + (d === 2 ? 1 : d === 3 ? -1 : 0); if (xx < 0 || zz < 0 || xx >= S || zz >= S) continue; const m = zz * S + xx; if (seen[m] || Math.abs(G[m] - G[c]) > 0.5 || G[m] > 40) continue; seen[m] = 1; q.push(m); } }
  let w = 0, wr = 0; for (let k = 0; k < S * S; k++) if (walk[k]) { w++; if (seen[k]) wr++; }
  return { openFrac: open / tot, reach: seen, walkFrac: w ? wr / w : 0 };
}

export function openMap(seedLo, stageIndex, archOverride) {
  const seed = ((seedLo >>> 0) ^ Math.imul(stageIndex + 1, 0x85EBCA6B)) >>> 0, rr = rngOf(seed ^ 0xC0FFEE), arch = archOverride && ARCHETYPES.includes(archOverride) ? archOverride : ARCHETYPES[(rr() * 6) | 0];
  let best = null, why = '';
  for (let k = 0; k < 10; k++) {
    const a = attempt(seed, arch, k); if (!a) { why = 'spots'; continue; }
    const st = analyse(a.G, a.sp); if (st.openFrac < 0.6) { why = 'open ' + st.openFrac.toFixed(2); continue; } if (st.walkFrac < 0.97) { why = 'reach ' + st.walkFrac.toFixed(2); continue; }
    const rn = a.rn, reach = (x, z) => st.reach[Math.floor(z + HALF - OFF) * S + Math.floor(x + HALF - OFF)] === 1, G = a.G, sp = a.sp, gt = a.gt;
    if (!reach(gt[0], gt[1])) { why = 'gate'; continue; }
    const tops = []; for (const lf of a.L) for (const t of lf.tops) { if (Math.abs(t[0]) < 150 && Math.abs(t[1]) < 150 && reach(t[0], t[1]) && slopeAt(G, t[0], t[1]) < 0.4) tops.push({ x: t[0], z: t[1], y: at(G, t[0], t[1]), mesa: !!lf.mesa }); }
    tops.sort((p, q) => q.y - p.y); const used = [], enc = [], types = ['cchest', 'shrine', 'cchest', 'altar', 'cchest', 'stone', 'cchest', 'shrine', 'cchest', 'stone'];
    const far = (x, z, d) => used.every(u => (u.x - x) * (u.x - x) + (u.z - z) * (u.z - z) >= d * d) && (x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1]) > 40 * 40 && (x - gt[0]) * (x - gt[0]) + (z - gt[1]) * (z - gt[1]) > 45 * 45;
    for (const t of tops) { if (enc.length >= types.length) break; if (!far(t.x, t.z, 34)) continue; used.push(t); enc.push({ type: types[enc.length], x: t.x, z: t.z, y: t.y }); }
    // a chest in reach of the start: a free one on level ground 14 to 26 m from the spawn
    let fc = null; for (let r = 14; r <= 26 && !fc; r += 2) for (let a2 = 0; a2 < 16 && !fc; a2++) { const x = sp[0] + cosA(a2 * TAU / 16) * r, z = sp[1] + sinA(a2 * TAU / 16) * r; if (spread(G, x, z, 3) < 0.35 && reach(x, z)) fc = { type: 'cchest', x, z, y: at(G, x, z), free: true }; }
    if (!fc) { why = 'freechest'; continue; } enc.push(fc);
    // the Broker in a clearing: flat, open, 60 to 150 m from the spawn
    let bk = null; for (let t = 0; t < 400 && !bk; t++) { const x = (rn() - 0.5) * 260, z = (rn() - 0.5) * 260, d = sq((x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1])); if (d > 60 && d < 150 && spread(G, x, z, 8) < 0.5 && reach(x, z) && far(x, z, 30)) bk = { type: 'broker', x, z, y: at(G, x, z) }; }
    if (!bk) { why = 'broker'; continue; } enc.push(bk);
    if (enc.filter(e => e.type === 'cchest').length < 4 || !enc.some(e => e.type === 'shrine') || !enc.some(e => e.type === 'altar') || !enc.some(e => e.type === 'stone')) { why = 'rewards ' + enc.length; continue; }
    // boss rings: the flattest discs, away from the start and the gate
    const rings = []; for (let t = 0; t < 600 && rings.length < 2; t++) { const x = (rn() - 0.5) * 270, z = (rn() - 0.5) * 270; if (spread(G, x, z, 15) > 0.45 || !reach(x, z)) continue; if (sq((x - sp[0]) * (x - sp[0]) + (z - sp[1]) * (z - sp[1])) < 60 || sq((x - gt[0]) * (x - gt[0]) + (z - gt[1]) * (z - gt[1])) < 60 || rings.some(q => sq((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z)) < 80) || enc.some(e => sq((e.x - x) * (e.x - x) + (e.z - z) * (e.z - z)) < 20)) continue; rings.push({ x, z, r: 14, y: at(G, x, z) }); }
    if (rings.length < 1) { why = 'rings'; continue; }
    best = { arch, k, G, sp, gt, enc, rings, st, L: a.L, spawnH: a.spawnH, arenaH: a.arenaH }; break;
  }
  if (!best) return null;
  return assemble(best, seed, stageIndex, why);
}

function assemble(b, seed, stageIndex) {
  const H = new Float32Array(SIM * SIM).fill(WALL), Fl = new Uint16Array(SIM * SIM);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const e = Math.min(i, S - 1 - i, j, S - 1 - j); if (e < 2) continue; H[(j + OFF) * SIM + i + OFF] = Math.round(b.G[j * S + i] * 100) / 100; }
  const r2 = v => Math.round(v * 100) / 100, ex = e => Object.assign({}, e, { x: r2(e.x), z: r2(e.z), y: r2(e.y) });
  const key = 'open-' + b.arch + '-' + (seed >>> 0).toString(16);
  return {
    key, hash: key, sealCode: 'OPEN-' + b.arch.toUpperCase() + '-' + (seed >>> 0).toString(16).slice(0, 4).toUpperCase(), stage: stageIndex, attempt: b.k, fallback: false, half: HALF, v2: true, open: true, arch: b.arch, n: S, off: OFF,
    prims: [], heights: H, cellFlags: Fl, palette: undefined, stageName: ARCH_NAME[b.arch],
    districts: [], spawn: { x: r2(b.sp[0]), z: r2(b.sp[1]) }, gate: { x: r2(b.gt[0]), z: r2(b.gt[1]), radius: 5.5 }, arena: { center: { x: r2(b.gt[0]), z: r2(b.gt[1]) }, boss: { x: r2(b.gt[0]), z: r2(b.gt[1]) }, tollPull: { x: r2(b.gt[0] + 6), z: r2(b.gt[1]) } },
    bossRings: b.rings.map(q => ({ x: r2(q.x), z: r2(q.z), r: 14, y: r2(q.y) })), encounters: b.enc.map(ex), landmarks: [], kits: [], rooms: [], roomOf: null, gateways: [], clearings: b.enc.filter(e => e.type === 'broker').map(e => ({ x: r2(e.x), z: r2(e.z), r: 12 })),
    _road: { main: [[9000, 9000], [9001, 9001]], trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: 'open1', v2: true, attempt: b.k, fallback: false, openFrac: r2(b.st.openFrac), walkFrac: r2(b.st.walkFrac) }
  };
}
