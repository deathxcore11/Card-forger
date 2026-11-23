// Open terrain (preview, ?terrain=open): one square of rolling desert, 356 m a side inside a thin dark boundary line, with the same sand carrying on past the line for 220 m (the view draws it, the sim stops the duelist at the line).
// The floor is one broad dune sheet: a long swell and a shorter cross swell (wavelength 40 to 120 m, 2 to 8 m high, slow windward rise and quicker lee fall) over a very slow rise and fall of the whole ground, so it is almost never flat for 25 m.
// On it stand 2 to 4 blocky mesas (5 to 8 m tall, flat tops, steep sides, no ramps) and a few small lone ruin blocks (about 3 m). Rewards stand on open, nearly flat sand beside a block, one at a time and far apart, never on a height.
// Dressing (cacti, dead trees, half-sunk logs, clay pots, one carved head) and the far dressing beyond the line are plain lists in the map: the view draws them, the sim reads only `solid`.
// Integer hash and + - * / sqrt only (no sin, cos, pow, clock): the same seed gives the same ground everywhere.
// The sim reads the same heightfield (400 x 400 cells of 1 m, WALL outside the square); the view samples it on a 2 m grid with true heights.
const SIM = 400, HALF = 200, S = 360, OFF = 20, WALL = 99;
export const LINE = 178;                                                                           // the boundary line: |x| or |z| of 178 m; the cells beyond are wall for the sim
export const ARCHETYPES = ['a', 'b', 'c', 'd', 'e', 'f'];
export const ARCH_NAME = { a: 'Long Swells', b: 'Cross Winds', c: 'Low Pan', d: 'High Shelf', e: 'Short Swells', f: 'Ringed Pan' };
const TAU = 6.283185307179586;
function sq(v) { if (!(v > 0)) return 0; let x = v > 1 ? (v + 1) / 2 : 1; for (let k = 0; k < 40; k++) { const y = 0.5 * (x + v / x); if (y >= x && k > 4) break; x = y; } return x; }       // square root by Newton's method (+ - * / only, the same on every platform)
const sstep = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
function rngOf(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function lat(seed, ix, iz) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(seed, x, z) { const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz), a = lat(seed, x0, z0), b = lat(seed, x0 + 1, z0), c = lat(seed, x0, z0 + 1), d = lat(seed, x0 + 1, z0 + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const cosA = a => { a = ((a % TAU) + TAU) % TAU; const t = a > 3.141592653589793 ? a - TAU : a; return polyCos(t); };       // cos and sin by a short series (no Math.cos): angles are reduced to -pi..pi
function polyCos(t) { let q = t, flip = 1; if (q > 1.5707963267948966) { q = 3.141592653589793 - q; flip = -1; } else if (q < -1.5707963267948966) { q = -3.141592653589793 - q; flip = -1; } const x = q * q; return flip * (1 - x / 2 + x * x / 24 - x * x * x / 720 + x * x * x * x / 40320 - x * x * x * x * x / 3628800); }
const sinA = a => cosA(a - 1.5707963267948966);
const r2 = v => Math.round(v * 100) / 100;

// ---- the dune sheet: a pure function of (params, x, z), used for the playable square and, unchanged, for the land beyond the line.
// Two swells (5 to 12 m and 2 to 4 m) whose crest lines are domain-warped so they curve and wander (never parallel bands), a slow rise and fall of the whole ground, 2 or 3 big dunes of 14 to 18 m, and in some styles a broad low pan.
// Every dune has a gentle windward side and a steeper lee side (about 26 degrees at most).
const saw = (t, k) => { const p = t - Math.floor(t); return p < k ? sstep(0, k, p) : 1 - sstep(k, 1, p); };       // 0 to 1: a slow windward rise to the crest, then a quicker lee fall
function bigH(B, x, z) {                                                                           // one big dune: a wandering crest, a long windward side, a steeper lee side, finite along the crest
  const dx = x - B.x, dz = z - B.z, a = dx * B.c + dz * B.s, c = -dx * B.s + dz * B.c, a2 = a + 16 * (vnoise(B.sd, c / 70, 3.3) - 0.5) * 2;
  const f = a2 < 0 ? 1 - sstep(0, 1, -a2 / B.Lw) : 1 - sstep(0, 1, a2 / B.Ll), g = 1 - sstep(0.35, 1.0, Math.abs(c) / B.W); return B.H * f * g;
}
export function duneH(P, x, z) {
  const sd = P.seed, wp = P.warp;
  const X = x + wp * (vnoise(sd ^ 0x201, x / 120, z / 120) - 0.5) + 0.35 * wp * (vnoise(sd ^ 0x202, x / 45, z / 45) - 0.5), Z = z + wp * (vnoise(sd ^ 0x203, x / 120, z / 120) - 0.5) + 0.35 * wp * (vnoise(sd ^ 0x204, x / 45, z / 45) - 0.5);
  const u1 = X * P.c1 + Z * P.s1, u2 = X * P.c2 + Z * P.s2, m1 = 0.6 + 0.7 * vnoise(sd ^ 0x103, x / 180, z / 180), m2 = 0.5 + 1.0 * vnoise(sd ^ 0x104, x / 110, z / 110);
  let h = P.a1 * m1 * saw(u1 / P.l1 + P.p1, P.k) + P.a2 * m2 * saw(u2 / P.l2 + P.p2, P.k2) + P.lo * vnoise(sd ^ 0x105, x / 200, z / 200) + 0.35 * vnoise(sd ^ 0x106, x / 30, z / 30) + 0.07 * vnoise(sd ^ 0x107, x / 7, z / 7);
  for (const B of P.big) h += bigH(B, x, z);
  if (P.pan) { const q = P.pan, dx = x - q.x, dz = z - q.z, u = (dx * q.c + dz * q.s) / q.ax, v = (-dx * q.s + dz * q.c) / q.az; h -= q.depth * (1 - sstep(0.25, 1, sq(u * u + v * v))); }
  if (P.shelf) h += P.shelf * sstep(-200, 200, x * P.cs + z * P.ss);
  return h + P.shift;
}
function params(arch, rn, seed) {
  const th = rn() * TAU, side = rn() < 0.5 ? -1 : 1, P = { seed: seed | 0, k: 0.6 + rn() * 0.06, k2: 0.56 + rn() * 0.1, p1: rn() * 50, p2: rn() * 50, shift: 0, shelf: 0, warp: 40, big: [], pan: null, wind: th };
  let l1 = 70 + rn() * 70, a1 = 4.5 + rn() * 6, l2 = 28 + rn() * 17, a2 = 2 + rn() * 2, lo = 2 + rn() * 2.5, th2 = th + side * (0.3 + rn() * 0.4), mode = 'scatter', nBig = 2 + (rn() < 0.5 ? 1 : 0);
  if (arch === 'a') { l1 = 110 + rn() * 30; th2 = th + side * 0.25; mode = 'line'; P.warp = 32; }
  else if (arch === 'b') { th2 = th + side * (0.9 + rn() * 0.3); l2 = l1 * (0.42 + rn() * 0.08); P.warp = 50; }
  else if (arch === 'c') { mode = 'cluster'; P.pan = { x: (rn() - 0.5) * 80, z: (rn() - 0.5) * 80, c: cosA(th + 1.57), s: sinA(th + 1.57), ax: 120 + rn() * 30, az: 55 + rn() * 15, depth: 2.6 + rn() * 1.2 }; }
  else if (arch === 'd') { P.shelf = 7 + rn() * 2; const a = rn() * TAU; P.cs = cosA(a); P.ss = sinA(a); mode = 'line'; }
  else if (arch === 'e') { l1 = 60 + rn() * 20; a1 = 4.5 + rn() * 2; l2 = 26 + rn() * 8; P.warp = 56; nBig = 2; }
  else { l1 = 120 + rn() * 20; mode = 'ring'; nBig = 3; P.pan = { x: (rn() - 0.5) * 40, z: (rn() - 0.5) * 40, c: cosA(th + 1.57), s: sinA(th + 1.57), ax: 100 + rn() * 20, az: 70 + rn() * 15, depth: 2.2 + rn() * 1.0 }; }
  a1 = Math.min(a1, 0.11 * l1); a2 = Math.min(a2, 0.11 * l2);
  Object.assign(P, { l1, a1, l2, a2, lo, c1: cosA(th), s1: sinA(th), c2: cosA(th2), s2: sinA(th2) });
  const cw = cosA(th), sw = sinA(th), c0 = [(rn() - 0.5) * 120, (rn() - 0.5) * 120];
  for (let k = 0; k < nBig; k++) {
    const H = 14 + rn() * 4; let x, z;
    if (mode === 'line') { const t = k - (nBig - 1) / 2; x = c0[0] - sw * t * 100 + (rn() - 0.5) * 20; z = c0[1] + cw * t * 100 + (rn() - 0.5) * 20; }
    else if (mode === 'cluster') { x = c0[0] + (k ? (rn() - 0.5) * 150 : 0); z = c0[1] + (k ? (rn() - 0.5) * 150 : 0); }
    else if (mode === 'ring') { const a = k * TAU / nBig + rn() * 0.5; x = (P.pan ? P.pan.x : 0) + cosA(a) * 125; z = (P.pan ? P.pan.z : 0) + sinA(a) * 125; }
    else { x = (rn() - 0.5) * 240; z = (rn() - 0.5) * 240; }
    const ang = th + (rn() - 0.5) * 0.4; P.big.push({ x: Math.max(-130, Math.min(130, x)), z: Math.max(-130, Math.min(130, z)), c: cosA(ang), s: sinA(ang), H, Lw: 85 + rn() * 25, Ll: Math.max(52, 1.6 * H / 0.48), W: 75 + rn() * 30, sd: Math.floor(rn() * 1e6) });
  }
  return P;
}

// ---- blocks: a flat-topped box standing on the sand, 5 to 8 m above the highest ground under it (mesas) or about 3 m (lone ruin blocks), steep sides, no ramps
function block(rn, cx, cz, rx, rz, h, cw, tone) {
  const rot = rn() * TAU; return { cx, cz, rx, rz, h, cw, rot, cr: cosA(rot), sr: sinA(rot), seed: Math.floor(rn() * 1e9) & 0xffff, tone, T: 0, door: false };
}
function cbrt(v) { if (!(v > 0)) return 0; let x = v > 1 ? v / 3 + 0.67 : 1; for (let k = 0; k < 40; k++) { const y = (2 * x + v / (x * x)) / 3; if (Math.abs(y - x) < 1e-9) { x = y; break; } x = y; } return x; }       // cube root by Newton's method (+ - * / only)
function qOf(b, x, z) { const dx = x - b.cx, dz = z - b.cz, ux = (dx * b.cr + dz * b.sr) / b.rx, uz = (-dx * b.sr + dz * b.cr) / b.rz, u2 = ux * ux, v2 = uz * uz, q6 = u2 * u2 * u2 + v2 * v2 * v2; return q6 > 40 ? 9 : cbrt(sq(q6)); }
function prof(b, x, z) {                                                                           // 0 outside, 1 on the flat top, a smooth rise across the steep side
  const dx = x - b.cx, dz = z - b.cz, ux = (dx * b.cr + dz * b.sr) / b.rx, uz = (-dx * b.sr + dz * b.cr) / b.rz, u2 = ux * ux, v2 = uz * uz, q6 = u2 * u2 * u2 + v2 * v2 * v2;
  if (q6 > 3) return 0; const q = cbrt(sq(q6)); const s = (1 - q) * ((b.rx + b.rz) / 2); return s > 0 ? sstep(0, b.cw, s) : 0;
}
export const blockProf = prof;
const reachOf = b => Math.max(b.rx, b.rz) * 1.25 + 2;

function field(P, blocks) {
  const G = new Float32Array(S * S); let lo = 1e9;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = duneH(P, i + 0.5 - HALF + OFF, j + 0.5 - HALF + OFF); G[j * S + i] = v; if (v < lo) lo = v; }
  P.shift = 0.3 - lo; for (let k = 0; k < S * S; k++) G[k] += P.shift - 0;                         // the lowest sand is 0.3 m (duneH adds P.shift itself for the view)
  // sand banked against the windward face of every block: up to 1.8 m, fading over 9 m
  { const wx = cosA(P.wind), wz = sinA(P.wind); for (const b of blocks) { const R = reachOf(b) + 10, avg = (b.rx + b.rz) / 2, i0 = Math.max(0, Math.floor(b.cx - R + HALF - OFF)), i1 = Math.min(S - 1, Math.ceil(b.cx + R + HALF - OFF)), j0 = Math.max(0, Math.floor(b.cz - R + HALF - OFF)), j1 = Math.min(S - 1, Math.ceil(b.cz + R + HALF - OFF));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF, q = qOf(b, x, z); if (q <= 1) continue; const so = (q - 1) * avg; if (so > 9) continue; const dx = x - b.cx, dz = z - b.cz, d = sq(dx * dx + dz * dz) || 1, face = sstep(0.1, 0.7, -(dx * wx + dz * wz) / d); G[j * S + i] += 1.8 * (1 - sstep(0, 9, so)) * face; } } }
  for (const b of blocks) {
    const R = reachOf(b), i0 = Math.max(0, Math.floor(b.cx - R + HALF - OFF)), i1 = Math.min(S - 1, Math.ceil(b.cx + R + HALF - OFF)), j0 = Math.max(0, Math.floor(b.cz - R + HALF - OFF)), j1 = Math.min(S - 1, Math.ceil(b.cz + R + HALF - OFF));
    let top = -1e9; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (prof(b, i + 0.5 - HALF + OFF, j + 0.5 - HALF + OFF) > 0.02) top = Math.max(top, G[j * S + i]);
    b.T = top + b.h;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const p = prof(b, i + 0.5 - HALF + OFF, j + 0.5 - HALF + OFF); if (p > 0) G[j * S + i] += (b.T - G[j * S + i]) * p; }
  }
  return G;
}
// the ground height anywhere (bilinear on the 1 m cells inside the line, the dune function beyond it); used by the view and the dressing
export function groundAt(map, x, z) {
  if (x > -LINE + 1 && x < LINE - 1 && z > -LINE + 1 && z < LINE - 1) { const H = map.heights, fx = x + HALF - 0.5, fz = z + HALF - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j; return (H[j * SIM + i] * (1 - u) + H[j * SIM + i + 1] * u) * (1 - v) + (H[(j + 1) * SIM + i] * (1 - u) + H[(j + 1) * SIM + i + 1] * u) * v; }
  const cx = x < -LINE + 1 ? -LINE + 1 : x > LINE - 1 ? LINE - 1 : x, cz = z < -LINE + 1 ? -LINE + 1 : z > LINE - 1 ? LINE - 1 : z, d = sq((x - cx) * (x - cx) + (z - cz) * (z - cz));
  const H = map.heights, fx = cx + HALF - 0.5, fz = cz + HALF - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, g = (H[j * SIM + i] * (1 - u) + H[j * SIM + i + 1] * u) * (1 - v) + (H[(j + 1) * SIM + i] * (1 - u) + H[(j + 1) * SIM + i + 1] * u) * v;
  const w = 1 - sstep(0, 2.5, d); return duneH(map.dune, x, z) * (1 - w) + (g + duneH(map.dune, x, z) - duneH(map.dune, cx, cz)) * w;       // the last 2.5 m blend the cell value into the pure function so the seam at the line has no step
}

const at = (G, x, z) => { const i = Math.floor(x + HALF - OFF), j = Math.floor(z + HALF - OFF); return i < 0 || j < 0 || i >= S || j >= S ? WALL : G[j * S + i]; };
// a flatten pad: inside rIn the ground is the height at the centre, between rIn and rOut it blends back to the dunes with a smoothstep (a flush piece with a sand approach)
function pad(G, cx, cz, rIn, rOut) {
  let s = 0, n = 0; for (let dz = -rIn; dz <= rIn; dz += 1) for (let dx = -rIn; dx <= rIn; dx += 1) if (dx * dx + dz * dz <= rIn * rIn) { s += at(G, cx + dx, cz + dz); n++; } const hc = n ? s / n : at(G, cx, cz);
  const i0 = Math.max(0, Math.floor(cx - rOut + HALF - OFF)), i1 = Math.min(S - 1, Math.ceil(cx + rOut + HALF - OFF)), j0 = Math.max(0, Math.floor(cz - rOut + HALF - OFF)), j1 = Math.min(S - 1, Math.ceil(cz + rOut + HALF - OFF));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = i + 0.5 - HALF + OFF, z = j + 0.5 - HALF + OFF, d = sq((x - cx) * (x - cx) + (z - cz) * (z - cz)); if (d >= rOut) continue; const w = 1 - sstep(rIn, rOut, d); G[j * S + i] += (hc - G[j * S + i]) * w; }
  return hc;
}
const slopeAt = (G, x, z) => { const a = at(G, x + 1, z), b = at(G, x - 1, z), c = at(G, x, z + 1), d = at(G, x, z - 1); if (a >= 50 || b >= 50 || c >= 50 || d >= 50) return 9; return sq(((a - b) * (a - b) + (c - d) * (c - d)) / 4); };
const spread = (G, x, z, r) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = at(G, x + cosA(t) * r, z + sinA(t) * r); if (h >= 50) return 99; lo = Math.min(lo, h); hi = Math.max(hi, h); } const h0 = at(G, x, z); return Math.max(hi, h0) - Math.min(lo, h0); };
const dist = (ax, az, bx, bz) => sq((ax - bx) * (ax - bx) + (az - bz) * (az - bz));

// ---- checks over the inner square: slope shares, relief, flat patches, what the starting kit can reach
export function analyse(G, from) {
  let sl = 0, open = 0, tot = 0, lo = 1e9, hi = -1e9; const walk = new Uint8Array(S * S);
  for (let j = 2; j < S - 2; j++) for (let i = 2; i < S - 2; i++) { const k = j * S + i, sx = (G[k + 1] - G[k - 1]) / 2, sz = (G[k + S] - G[k - S]) / 2, s2 = sx * sx + sz * sz; if (i < 30 || i >= S - 30 || j < 30 || j >= S - 30) continue; if (s2 < 0.25) walk[k] = 1; tot++; if (s2 < 0.0719) open++; if (s2 >= 0.00766 && s2 < 0.1632) sl++; if (G[k] < lo) lo = G[k]; if (G[k] > hi) hi = G[k]; }
  const seen = new Uint8Array(S * S), q = []; const s = (Math.floor(from[1] + HALF - OFF)) * S + Math.floor(from[0] + HALF - OFF); seen[s] = 1; q.push(s);
  while (q.length) { const c = q.pop(), x = c % S, z = (c / S) | 0; for (let d = 0; d < 4; d++) { const xx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), zz = z + (d === 2 ? 1 : d === 3 ? -1 : 0); if (xx < 0 || zz < 0 || xx >= S || zz >= S) continue; const m = zz * S + xx; if (seen[m] || Math.abs(G[m] - G[c]) > 0.55 || G[m] > 40) continue; seen[m] = 1; q.push(m); } }
  let w = 0, wr = 0; for (let k = 0; k < S * S; k++) if (walk[k]) { w++; if (seen[k]) wr++; }
  let win = 0, flatWin = 0; for (let z = 40; z < S - 65; z += 12) for (let x = 40; x < S - 65; x += 12) { let a = 1e9, b = -1e9; for (let dz = 0; dz <= 25; dz += 5) for (let dx = 0; dx <= 25; dx += 5) { const v = G[(z + dz) * S + x + dx]; if (v < a) a = v; if (v > b) b = v; } win++; if (b - a < 0.6) flatWin++; }       // 25 m windows with under 0.6 m of relief
  return { openFrac: open / tot, slopeShare: sl / tot, range: hi - lo, reach: seen, walkFrac: w ? wr / w : 0, flatShare: flatWin / win };
}

const hz = (G, P, x, z) => (Math.abs(x) < LINE - 1 && Math.abs(z) < LINE - 1 ? at(G, x, z) : duneH(P, x, z));
function horizon(G, P, sp, yaw) {                                                                  // how much the skyline rises and falls across a 90 degree view from the start camera (tangent of the elevation, a range)
  const y0 = at(G, sp[0], sp[1]) + 4; let lo = 9, hi = -9;
  for (let k = -8; k <= 8; k++) { const a = yaw + k * 0.098, fx = -sinA(a), fz = -cosA(a); let e = -9; for (let d = 6; d <= 400; d += 4) { const v = (hz(G, P, sp[0] + fx * d, sp[1] + fz * d) - y0) / d; if (v > e) e = v; } if (e < lo) lo = e; if (e > hi) hi = e; }
  return hi - lo;
}
function placeHeads(G, rn, sp, gt, blocks, nh, k0) {                                              // 2 or 3 monuments: the first on the way to the gate, the others on open flat sand 70 m apart
  const heads = [], gx = gt[0] - sp[0], gz = gt[1] - sp[1], gd = sq(gx * gx + gz * gz), ux = gx / gd, uz = gz / gd;
  const ok = (x, z) => Math.abs(x) <= 120 && Math.abs(z) <= 120 && dist(x, z, sp[0], sp[1]) >= 60 && dist(x, z, gt[0], gt[1]) >= 60 && heads.every(h => dist(h.x, h.z, x, z) >= 70) && spread(G, x, z, 4) <= 0.8 && slopeAt(G, x, z) < 0.2 && !blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 6);
  const add = (x, z) => heads.push({ x, z, rot: r2(rn() * TAU), kind: (heads.length + k0) % 2 });
  for (let t = 0; t < 400 && !heads.length; t++) { const f = 0.35 + rn() * 0.15, lat = (rn() - 0.5) * 50, x = sp[0] + ux * gd * f - uz * lat, z = sp[1] + uz * gd * f + ux * lat; if (ok(x, z)) add(x, z); }
  for (let t = 0; t < 2000 && heads.length < nh; t++) { const x = (rn() - 0.5) * 240, z = (rn() - 0.5) * 240; if (ok(x, z)) add(x, z); }
  return heads;
}
// the opening view: a heading (24 to choose from) with the gate and a landmark (monument, mesa or tall wall) each within 40 degrees of the centre, a foreground that climbs or falls, and a skyline that rises and falls
function startView(G, P, sp, gt, blocks, heads) {
  const lms = []; for (const b of blocks) if (b.tone > 0) lms.push([b.cx, b.cz]); for (const h of heads) lms.push([h.x, h.z]);
  let best = null, bs = -1;
  for (let k = 0; k < 24; k++) {
    const a = k * TAU / 24, fx = -sinA(a), fz = -cosA(a), dot = (x, z) => { const dx = x - sp[0], dz = z - sp[1], d = sq(dx * dx + dz * dz) || 1; return (dx * fx + dz * fz) / d; };
    if (dot(gt[0], gt[1]) < 0.766) continue; let lm = 1e9; for (const m of lms) { const d = dist(m[0], m[1], sp[0], sp[1]); if (d >= 35 && d <= 130 && dot(m[0], m[1]) >= 0.766 && d < lm) lm = d; } if (lm > 1e8) continue;
    const fg = Math.abs(at(G, sp[0] + fx * 20, sp[1] + fz * 20) - at(G, sp[0] + fx * 6, sp[1] + fz * 6)); if (fg < 1.2) continue;
    const hs = horizon(G, P, sp, a); if (hs < 0.07) continue; const sc = hs * 10 + fg - lm / 100; if (sc > bs) { bs = sc; best = { yaw: a, horizon: hs, fg }; }
  }
  return best;
}
function attempt(seed, arch, k) {
  const rn = rngOf((seed ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0), P = params(arch, rn, seed ^ k);
  // 2 to 4 mesas (7 to 10 m), 1 or 2 tall rock walls (10 to 14 m) and 6 to 9 lone ruin blocks (6 to 9 m), 50 m or more in from the line, kept apart
  const blocks = [], placedAt = [];
  const place = (n, mk, gap) => { for (let t = 0; t < 300 && n > 0; t++) { const x = (rn() - 0.5) * 240, z = (rn() - 0.5) * 240; if (placedAt.some(p => dist(p[0], p[1], x, z) < gap + p[2])) continue; const b = mk(x, z); blocks.push(b); placedAt.push([x, z, Math.max(b.rx, b.rz)]); n--; } };
  place(2 + ((rn() * 3) | 0), (x, z) => block(rn, x, z, 7 + rn() * 6, 7 + rn() * 5, 7 + rn() * 3, 2.4, rn() < 0.45 ? 2 : 1), 60);
  place(1 + (rn() < 0.5 ? 1 : 0), (x, z) => block(rn, x, z, 13 + rn() * 6, 3 + rn() * 1.5, 10 + rn() * 4, 2.4, rn() < 0.5 ? 2 : 1), 60);
  place(6 + ((rn() * 4) | 0), (x, z) => { const b = block(rn, x, z, 3.8 + rn() * 2, 3 + rn() * 1.4, 6 + rn() * 3, 1.3, 0); b.door = rn() < 0.55; return b; }, 45);
  const G = field(P, blocks);
  const relief = (x, z, r) => { let lo = 1e9, hi = -1e9; for (const rr of [r, r * 0.6]) for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = at(G, x + cosA(t) * rr, z + sinA(t) * rr); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
  const nearBlock = (x, z, d) => blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + d);
  // spawn on a slope (never a flat plate): standable underfoot and the ground within 30 m spanning 3 m or more; gate on gentle ground 190 m or more away; both well clear of the blocks
  const cand = []; for (let z = -120; z <= 120; z += 9) for (let x = -120; x <= 120; x += 9) { const rl = relief(x, z, 30); if (slopeAt(G, x, z) <= 0.22 && spread(G, x, z, 5) <= 0.9 && rl >= 3 && rl <= 14 && !nearBlock(x, z, 20)) cand.push([x, z]); }
  const gcand = []; for (let z = -135; z <= 135; z += 9) for (let x = -135; x <= 135; x += 9) if (spread(G, x, z, 24) <= 8 && slopeAt(G, x, z) < 0.3 && !nearBlock(x, z, 30)) gcand.push([x, z]);
  if (cand.length < 8 || gcand.length < 8) return null;
  for (let tries = 0; tries < 60; tries++) {
    const sp = cand[(rn() * cand.length) | 0], far = gcand.filter(c => dist(c[0], c[1], sp[0], sp[1]) >= 190); if (!far.length) continue;
    const gt = far[(rn() * far.length) | 0], heads = placeHeads(G, rn, sp, gt, blocks, 2 + (rn() < 0.5 ? 1 : 0), (rn() * 2) | 0); if (heads.length < 2) continue;
    const sv = startView(G, P, sp, gt, blocks, heads); if (!sv) continue;
    return { P, blocks, G, sp, gt, rn, heads, start: sv };
  }
  return null;
}

// ---- dressing and far dressing: plain lists, drawn by the view
function dressing(b, seed, enc, rings, st) {
  const { G, sp, gt, blocks, P } = b, rn = rngOf(seed ^ 0xD7E55), out = { cacti: [], dead: [], logs: [], pots: [], head: null }, solid = [], grid = new Map();
  const keep = [{ x: sp[0], z: sp[1], r: 22 }, { x: gt[0], z: gt[1], r: 32 }]; for (const e of enc) keep.push({ x: e.x, z: e.z, r: e.type === 'broker' ? 12 : 6 }); for (const q of rings) keep.push({ x: q.x, z: q.z, r: 18 });
  const free = (x, z, pad) => { for (const k of keep) { const rr = k.r + (pad || 0); if ((x - k.x) * (x - k.x) + (z - k.z) * (z - k.z) < rr * rr) return false; } for (const bl of blocks) if (dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 1 + (pad || 0)) return false; return true; };
  const key = (x, z) => Math.floor(x / 8) * 4096 + Math.floor(z / 8), put = (kind, x, z) => { const k = key(x, z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push([kind, x, z]); };
  const near = (kind, x, z, d) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get(key(x + i * 8, z + j * 8)); if (a) for (const o of a) if ((kind === '*' || o[0] === kind) && (o[1] - x) * (o[1] - x) + (o[2] - z) * (o[2] - z) < d * d) return true; } return false; };
  const dens = (x, z) => 0.6 * vnoise(seed & 0xffff, x / 70, z / 70) + 0.4 * vnoise((seed >>> 7) & 0xffff, x / 28, z / 28);
  const gy = (x, z) => groundAt(b.map, x, z), spot = () => [(rn() - 0.5) * 344, (rn() - 0.5) * 344];
  const okAt = (x, z, pad, maxSlope) => free(x, z, pad) && slopeAt(G, x, z) < (maxSlope || 0.42);
  const rnd = rn;
  out.heads = (b.heads || []).map(h => ({ x: r2(h.x), y: r2(gy(h.x, h.z)), z: r2(h.z), rot: h.rot, s: 1, kind: h.kind })); for (const h of out.heads) { put('h', h.x, h.z); solid.push([h.x, h.y, h.z, 1.9, 6]); keep.push({ x: h.x, z: h.z, r: 4 }); } out.head = out.heads[0] || null;
  const fill = (n, tries, kind, sep, ok, make) => { let k = 0; for (let t = 0; t < tries && k < n; t++) { const [x, z] = spot(); if (!ok(x, z) || near(kind, x, z, sep)) continue; make(x, z); put(kind, x, z); k++; } };
  fill(70, 4000, 'c', 11, (x, z) => dens(x, z) > 0.3 && okAt(x, z, 2), (x, z) => { const y = gy(x, z), s = 0.85 + rnd() * 0.5; out.cacti.push([r2(x), r2(y), r2(z), r2(s), r2(rnd() * TAU), (rnd() * 3) | 0]); solid.push([r2(x), r2(y), r2(z), r2(0.55 * s), r2(3.5 * s)]);
    if (rnd() < 0.4) { const a = rnd() * TAU, d = 2.2 + rnd() * 1.5, x2 = x + cosA(a) * d, z2 = z + sinA(a) * d; if (okAt(x2, z2, 1)) { const y2 = gy(x2, z2), s2 = 0.6 + rnd() * 0.5; out.cacti.push([r2(x2), r2(y2), r2(z2), r2(s2), r2(rnd() * TAU), (rnd() * 3) | 0]); solid.push([r2(x2), r2(y2), r2(z2), r2(0.55 * s2), r2(3.5 * s2)]); } } });
  fill(42, 3000, 'd', 14, (x, z) => okAt(x, z, 2), (x, z) => { const y = gy(x, z), s = 0.8 + rnd() * 0.6; out.dead.push([r2(x), r2(y), r2(z), r2(s), r2(rnd() * TAU), (rnd() * 3) | 0]); solid.push([r2(x), r2(y), r2(z), r2(0.4 * s), r2(4 * s)]); });
  fill(120, 5000, 'l', 9, (x, z) => okAt(x, z, 1, 0.5), (x, z) => { const a = rnd() * TAU, len = 3 + rnd() * 6, dx = cosA(a) * len / 2, dz = sinA(a) * len / 2, x0 = x - dx, z0 = z - dz, x1 = x + dx, z1 = z + dz; out.logs.push([r2(x0), r2(gy(x0, z0) - 0.12), r2(z0), r2(x1), r2(gy(x1, z1) - 0.12), r2(z1), r2(0.3 + rnd() * 0.25), (rnd() * 2) | 0]); });
  fill(30, 3000, 'p', 16, (x, z) => okAt(x, z, 2, 0.35), (x, z) => { const n = 2 + ((rnd() * 3) | 0); for (let q = 0; q < n; q++) { const a = rnd() * TAU, d = q ? 0.8 + rnd() * 1.2 : 0, px = x + cosA(a) * d, pz = z + sinA(a) * d; out.pots.push([r2(px), r2(gy(px, pz)), r2(pz), r2(0.8 + rnd() * 0.6), r2(rnd() * TAU), (rnd() * 3) | 0]); } });
  // a beam beside every ruin block and every mesa: a long grey beam lying at an angle, half sunk
  for (const bl of blocks) { const a = rnd() * TAU, d = reachOf(bl) + 2 + rnd() * 3, x = bl.cx + cosA(a) * d, z = bl.cz + sinA(a) * d; if (!free(x, z, 1) || slopeAt(G, x, z) > 0.5) continue; const a2 = rnd() * TAU, len = 4 + rnd() * 5, dx = cosA(a2) * len / 2, dz = sinA(a2) * len / 2; out.logs.push([r2(x - dx), r2(gy(x - dx, z - dz) - 0.15), r2(z - dz), r2(x + dx), r2(gy(x + dx, z + dz) - 0.15), r2(z + dz), r2(0.4 + rnd() * 0.2), 2]); }
  return { dress: out, solid };
}
function farDressing(P, seed) {                                                                    // large rock blocks, dead trees and ruin pieces on the sand beyond the line, 190 to 380 m out; sparse
  const rn = rngOf(seed ^ 0xFA2), out = { rocks: [], dead: [], ruins: [] }; const ring = () => { for (;;) { const x = (rn() - 0.5) * 780, z = (rn() - 0.5) * 780; if (Math.abs(x) > 190 || Math.abs(z) > 190) return [x, z]; } };
  const H = (x, z) => duneH(P, x, z);
  for (let k = 0; k < 40; k++) { const [x, z] = ring(), w = 7 + rn() * 12, h = 4 + rn() * 9; out.rocks.push([r2(x), r2(H(x, z)), r2(z), r2(w), r2(h), r2(rn() * TAU), (rn() * 3) | 0]); }
  for (let k = 0; k < 40; k++) { const [x, z] = ring(); out.dead.push([r2(x), r2(H(x, z)), r2(z), r2(1.1 + rn() * 0.8), r2(rn() * TAU), (rn() * 3) | 0]); }
  for (let k = 0; k < 18; k++) { const [x, z] = ring(); out.ruins.push([r2(x), r2(H(x, z)), r2(z), r2(5 + rn() * 5), r2(3 + rn() * 4), r2(rn() * TAU), (rn() * 3) | 0]); }
  return out;
}

export function openMap(seedLo, stageIndex, archOverride) {
  const seed = ((seedLo >>> 0) ^ Math.imul(stageIndex + 1, 0x85EBCA6B)) >>> 0, rr = rngOf(seed ^ 0xC0FFEE), arch = archOverride && ARCHETYPES.includes(archOverride) ? archOverride : ARCHETYPES[(rr() * 6) | 0];
  for (let k = 0; k < 24; k++) {
    const a = attempt(seed, arch, k); if (!a) continue;
    const { G, sp, gt, rn, blocks, P } = a;
    pad(G, gt[0], gt[1], 14, 30); pad(G, sp[0], sp[1], 3, 9); for (const h of a.heads) pad(G, h.x, h.z, 4, 10);
    let st = analyse(G, sp); if (st.slopeShare < 0.45 || st.openFrac < 0.55 || st.range < 14 || st.walkFrac < 0.97 || st.flatShare > 0.04) continue;
    const reach = (x, z) => st.reach[Math.floor(z + HALF - OFF) * S + Math.floor(x + HALF - OFF)] === 1;
    if (!reach(gt[0], gt[1])) continue;
    // rewards stand on open, nearly flat sand beside a block, one at a time and far apart: a ring of spots round every block, the first that is flat, reachable and 52 m from the others
    const used = [], enc = [], types = ['cchest', 'shrine', 'cchest', 'altar', 'cchest', 'stone', 'cchest', 'shrine', 'cchest', 'stone'];
    const clear = (x, z, d) => used.every(u => dist(u.x, u.z, x, z) >= d) && dist(x, z, sp[0], sp[1]) > 45 && dist(x, z, gt[0], gt[1]) > 50 && Math.abs(x) < 150 && Math.abs(z) < 150 && !blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 2);
    const flatOk = (x, z) => spread(G, x, z, 4) <= 0.8 && slopeAt(G, x, z) < 0.18 && reach(x, z);
    const order = blocks.map((bl, i) => [rn(), i]).sort((p, q) => p[0] - q[0]).map(p => blocks[p[1]]);
    for (const bl of order) { if (enc.length >= types.length) break; const a0 = rn() * TAU; let got = false; for (let t = 0; t < 24 && !got; t++) { const ang = a0 + t * 0.2618, d = reachOf(bl) + 3 + (t % 3) * 1.5, x = bl.cx + cosA(ang) * d, z = bl.cz + sinA(ang) * d; if (clear(x, z, 52) && flatOk(x, z)) { used.push({ x, z }); enc.push({ type: types[enc.length], x, z, y: 0, beside: true }); got = true; } } }
    for (let t = 0; t < 3000 && enc.length < types.length; t++) { const x = (rn() - 0.5) * 290, z = (rn() - 0.5) * 290; if (clear(x, z, 55) && flatOk(x, z)) { used.push({ x, z }); enc.push({ type: types[enc.length], x, z, y: 0 }); } }
    if (enc.length < types.length) continue;
    let fc = null; for (let r = 14; r <= 28 && !fc; r += 2) for (let a2 = 0; a2 < 16 && !fc; a2++) { const x = sp[0] + cosA(a2 * TAU / 16) * r, z = sp[1] + sinA(a2 * TAU / 16) * r; if (spread(G, x, z, 3) < 0.9 && reach(x, z) && !blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 3)) fc = { type: 'cchest', x, z, y: at(G, x, z), free: true }; }
    if (!fc) continue; enc.push(fc);
    let bk = null; for (let t = 0; t < 600 && !bk; t++) { const x = (rn() - 0.5) * 260, z = (rn() - 0.5) * 260, d = dist(x, z, sp[0], sp[1]); if (d > 60 && d < 150 && spread(G, x, z, 10) < 2.2 && slopeAt(G, x, z) < 0.25 && reach(x, z) && clear(x, z, 40) && !near2(enc, x, z, 30)) bk = { type: 'broker', x, z, y: at(G, x, z) }; }
    if (!bk) continue; enc.push(bk);
    const rings = []; for (let t = 0; t < 1500 && rings.length < 2; t++) { const x = (rn() - 0.5) * 270, z = (rn() - 0.5) * 270; if (spread(G, x, z, 15) > 3.2 || !reach(x, z) || blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 18)) continue; if (dist(x, z, sp[0], sp[1]) < 60 || dist(x, z, gt[0], gt[1]) < 60 || rings.some(q => dist(q.x, q.z, x, z) < 80) || enc.some(e => dist(e.x, e.z, x, z) < 22)) continue; rings.push({ x, z, r: 14, y: at(G, x, z) }); }
    if (!rings.length) continue;
    // pads under everything placed: the piece sits flush, the sand blends back into the dunes
    for (const e of enc) { const big = e.type === 'broker'; e.y = pad(G, e.x, e.z, big ? 7 : 3, big ? 15 : 8); }
    for (const q of rings) q.y = pad(G, q.x, q.z, 14, 26);
    st = analyse(G, sp); if (st.walkFrac < 0.97) continue;
    return assemble({ arch, k, G, sp, gt, enc, rings, st, blocks, P, heads: a.heads, start: a.start }, seed, stageIndex);
  }
  return null;
}
const near2 = (enc, x, z, d) => enc.some(e => dist(e.x, e.z, x, z) < d);

function assemble(b, seed, stageIndex) {
  const H = new Float32Array(SIM * SIM).fill(WALL), Fl = new Uint16Array(SIM * SIM);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const e = Math.min(i, S - 1 - i, j, S - 1 - j); if (e < 2) continue; H[(j + OFF) * SIM + i + OFF] = Math.round(b.G[j * S + i] * 100) / 100; }
  const ex = e => Object.assign({}, e, { x: r2(e.x), z: r2(e.z), y: r2(e.y) });
  const key = 'open-' + b.arch + '-' + (seed >>> 0).toString(16), P = b.P;
  const map = {
    key, hash: key, sealCode: 'OPEN-' + b.arch.toUpperCase() + '-' + (seed >>> 0).toString(16).slice(0, 4).toUpperCase(), stage: stageIndex, attempt: b.k, fallback: false, half: HALF, v2: true, open: true, arch: b.arch, n: S, off: OFF, line: LINE, edgeSeed: seed,
    prims: [], heights: H, cellFlags: Fl, palette: undefined, stageName: ARCH_NAME[b.arch],
    districts: [], spawn: { x: r2(b.sp[0]), z: r2(b.sp[1]) }, gate: { x: r2(b.gt[0]), z: r2(b.gt[1]), radius: 5.5 }, arena: { center: { x: r2(b.gt[0]), z: r2(b.gt[1]) }, boss: { x: r2(b.gt[0]), z: r2(b.gt[1]) }, tollPull: { x: r2(b.gt[0] + 6), z: r2(b.gt[1]) } },
    bossRings: b.rings.map(q => ({ x: r2(q.x), z: r2(q.z), r: 14, y: r2(q.y) })), encounters: b.enc.map(ex), landmarks: [], kits: [], rooms: [], roomOf: null, gateways: [],
    clearings: b.enc.filter(e => e.type === 'broker').map(e => ({ x: r2(e.x), z: r2(e.z), r: 12 })), groves: [], paths: [],
    dune: P, startYaw: r2(b.start.yaw),
    blocks: b.blocks.map(q => ({ cx: r2(q.cx), cz: r2(q.cz), rx: r2(q.rx), rz: r2(q.rz), h: r2(q.h), cw: q.cw, rot: q.rot, cr: q.cr, sr: q.sr, seed: q.seed, tone: q.tone, T: r2(q.T), door: q.door })),
    _road: { main: [[9000, 9000], [9001, 9001]], trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: 'open3', v2: true, attempt: b.k, fallback: false, openFrac: r2(b.st.openFrac), slopeShare: r2(b.st.slopeShare), range: r2(b.st.range), forms: b.blocks.length, walkFrac: r2(b.st.walkFrac), flatShare: r2(b.st.flatShare), horizon: r2(b.start.horizon), fg: r2(b.start.fg), big: P.big.length }
  };
  map.ruins = map.blocks.filter(q => q.tone === 0).map(q => ({ kind: 'block', x: q.cx, z: q.cz, y: q.T, face: q.rot, tilt: 0 }));
  const d = dressing(Object.assign({ map }, b), seed, b.enc, b.rings, b.st); map.dress = d.dress; map.solid = d.solid; map.far = farDressing(P, seed);
  return map;
}
