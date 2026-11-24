// Open terrain (preview, ?terrain=open): one square of rolling desert, 356 m a side inside a thin dark boundary line, with the same sand carrying on past the line for 220 m (the view draws it, the sim stops the duelist at the line).
// The floor is one broad dune sheet: a long swell and a shorter cross swell (wavelength 40 to 120 m, 2 to 8 m high, slow windward rise and quicker lee fall) over a very slow rise and fall of the whole ground, so it is almost never flat for 25 m.
// On it stand 2 to 4 blocky mesas (5 to 8 m tall, flat tops, steep sides, no ramps) and a few small lone ruin blocks (about 3 m). Rewards stand on open, nearly flat sand beside a block, one at a time and far apart, never on a height.
// Dressing (cacti, dead trees, half-sunk logs, clay pots, one carved head) and the far dressing beyond the line are plain lists in the map: the view draws them, the sim reads only `solid`.
// Integer hash and + - * / sqrt only (no sin, cos, pow, clock): the same seed gives the same ground everywhere.
// The sim reads the same heightfield (400 x 400 cells of 1 m, WALL outside the square); the view samples it on a 2 m grid with true heights.
const SIM = 840, HALF = 420, S = 840, OFF = 0, WALL = 99;                                          // the heightfield: 840 m a side in 1 m cells; the playable ground is about 720 m across, ringed by mountains
export const EDGE_R = 345;                                                                         // the foot of the mountain range: the playable ground is where (x^4 + z^4)^(1/4) is under this (plus or minus the wander)
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
  a1 = Math.min(a1, 0.1 * l1); a2 = Math.min(a2, 0.1 * l2);
  Object.assign(P, { l1, a1, l2, a2, lo, c1: cosA(th), s1: sinA(th), c2: cosA(th2), s2: sinA(th2) });
  const cw = cosA(th), sw = sinA(th), c0 = [(rn() - 0.5) * 120, (rn() - 0.5) * 120];
  for (let k = 0; k < nBig; k++) {
    const H = 14 + rn() * 4; let x, z;
    if (mode === 'line') { const t = k - (nBig - 1) / 2; x = c0[0] - sw * t * 100 + (rn() - 0.5) * 20; z = c0[1] + cw * t * 100 + (rn() - 0.5) * 20; }
    else if (mode === 'cluster') { x = c0[0] + (k ? (rn() - 0.5) * 150 : 0); z = c0[1] + (k ? (rn() - 0.5) * 150 : 0); }
    else if (mode === 'ring') { const a = k * TAU / nBig + rn() * 0.5; x = (P.pan ? P.pan.x : 0) + cosA(a) * 125; z = (P.pan ? P.pan.z : 0) + sinA(a) * 125; }
    else { x = (rn() - 0.5) * 240; z = (rn() - 0.5) * 240; }
    const ang = th + (rn() - 0.5) * 0.4; P.big.push({ x: Math.max(-130, Math.min(130, x)), z: Math.max(-130, Math.min(130, z)), c: cosA(ang), s: sinA(ang), H, Lw: 85 + rn() * 25, Ll: Math.max(60, 2.1 * H / 0.48), W: 75 + rn() * 30, sd: Math.floor(rn() * 1e6) });
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

// the mountain range all round: steep faceted rock rising 35 to 70 m out of the dunes. The outline is a rounded square that wanders by up to 30 m; the rise takes 30 to 44 m, so the faces are far too steep to climb
function mount(P, x, z) {
  const sd = P.seed, x2 = x * x, z2 = z * z, r = sq(sq(x2 * x2 + z2 * z2)), w = 22 * (vnoise(sd ^ 0x401, x / 100, z / 100) - 0.5) * 2 + 8 * (vnoise(sd ^ 0x402, x / 32, z / 32) - 0.5) * 2, q = r - (EDGE_R + w);
  if (q <= 0) return 0;
  const top = 31 + 25 * vnoise(sd ^ 0x403, x / 130, z / 130), rise = 28 + 10 * vnoise(sd ^ 0x404, x / 90, z / 90), u = q >= rise ? 1 : q / rise, su = u * u * (3 - 2 * u);
  const rid = 1 - Math.abs(2 * vnoise(sd ^ 0x405, x / 26, z / 26) - 1);
  const rid2 = 1 - Math.abs(2 * vnoise(sd ^ 0x407, x / 11, z / 11) - 1);
  return top * su + 10 * rid * sstep(0.15, 0.9, u) + 3.5 * rid2 * sstep(0.3, 1, u) + 2 * (vnoise(sd ^ 0x406, x / 12, z / 12) - 0.5) * sstep(0.3, 1, u);
}
function field(P, blocks) {
  const G = new Float32Array(S * S), NC = S / 2 + 1, C = new Float32Array(NC * NC); let lo = 1e9;
  for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) { const x = 2 * ci + 0.5 - HALF, z = 2 * cj + 0.5 - HALF, d = duneH(P, x, z); if (x > -300 && x < 300 && z > -300 && z < 300 && d < lo) lo = d; C[cj * NC + ci] = d + mount(P, x, z); }       // dunes and mountains on a 2 m grid, then 1 m by interpolation
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const ci = i >> 1, cj = j >> 1, a = C[cj * NC + ci]; G[j * S + i] = (i & 1) ? ((j & 1) ? 0.25 * (a + C[cj * NC + ci + 1] + C[(cj + 1) * NC + ci] + C[(cj + 1) * NC + ci + 1]) : 0.5 * (a + C[cj * NC + ci + 1])) : ((j & 1) ? 0.5 * (a + C[(cj + 1) * NC + ci]) : a); }
  P.shift = 0.3 - lo; for (let k = 0; k < S * S; k++) G[k] += P.shift;                              // the lowest sand is 0.3 m (duneH adds P.shift itself for the view)
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
// the ground height anywhere (bilinear on the 1 m cells, clamped to the inside of the heightfield); used by the view and the dressing
export function groundAt(map, x, z) {
  const L = HALF - 3.5, cx = x < -L ? -L : x > L ? L : x, cz = z < -L ? -L : z > L ? L : z, H = map.heights, fx = cx + HALF - 0.5, fz = cz + HALF - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (H[j * SIM + i] * (1 - u) + H[j * SIM + i + 1] * u) * (1 - v) + (H[(j + 1) * SIM + i] * (1 - u) + H[(j + 1) * SIM + i + 1] * u) * v;
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
  for (let j = 2; j < S - 2; j++) for (let i = 2; i < S - 2; i++) { const k = j * S + i, sx = (G[k + 1] - G[k - 1]) / 2, sz = (G[k + S] - G[k - S]) / 2, s2 = sx * sx + sz * sz; if (i < 135 || i >= S - 135 || j < 135 || j >= S - 135) continue; if (s2 < 0.25) walk[k] = 1; tot++; if (s2 < 0.0719) open++; if (s2 >= 0.00766 && s2 < 0.1632) sl++; if (G[k] < lo) lo = G[k]; if (G[k] > hi) hi = G[k]; }
  const seen = new Uint8Array(S * S), q = []; const s = (Math.floor(from[1] + HALF - OFF)) * S + Math.floor(from[0] + HALF - OFF); seen[s] = 1; q.push(s);
  while (q.length) { const c = q.pop(), x = c % S, z = (c / S) | 0; for (let d = 0; d < 4; d++) { const xx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), zz = z + (d === 2 ? 1 : d === 3 ? -1 : 0); if (xx < 0 || zz < 0 || xx >= S || zz >= S) continue; const m = zz * S + xx; if (seen[m] || Math.abs(G[m] - G[c]) > 0.55 || G[m] > 40) continue; seen[m] = 1; q.push(m); } }
  let w = 0, wr = 0; for (let k = 0; k < S * S; k++) if (walk[k]) { w++; if (seen[k]) wr++; }
  let win = 0, flatWin = 0; for (let z = 140; z < S - 165; z += 12) for (let x = 140; x < S - 165; x += 12) { let a = 1e9, b = -1e9; for (let dz = 0; dz <= 25; dz += 5) for (let dx = 0; dx <= 25; dx += 5) { const v = G[(z + dz) * S + x + dx]; if (v < a) a = v; if (v > b) b = v; } win++; if (b - a < 0.6) flatWin++; }       // 25 m windows with under 0.6 m of relief
  return { openFrac: open / tot, slopeShare: sl / tot, range: hi - lo, reach: seen, walkFrac: w ? wr / w : 0, flatShare: flatWin / win };
}

const hz = (G, P, x, z) => { const h = at(G, x, z); return h >= WALL ? -50 : h; };
function horizon(G, P, sp, yaw) {                                                                  // how much the skyline rises and falls across a 90 degree view from the start camera (tangent of the elevation, a range)
  const y0 = at(G, sp[0], sp[1]) + 4; let lo = 9, hi = -9;
  for (let k = -8; k <= 8; k++) { const a = yaw + k * 0.098, fx = -sinA(a), fz = -cosA(a); let e = -9; for (let d = 6; d <= 400; d += 4) { const v = (hz(G, P, sp[0] + fx * d, sp[1] + fz * d) - y0) / d; if (v > e) e = v; } if (e < lo) lo = e; if (e > hi) hi = e; }
  return hi - lo;
}
function placeHeads(G, rn, sp, gt, blocks, nh, k0) {                                              // 2 or 3 monuments: the first on the way to the gate, the others on open flat sand 70 m apart
  const heads = [], gx = gt[0] - sp[0], gz = gt[1] - sp[1], gd = sq(gx * gx + gz * gz), ux = gx / gd, uz = gz / gd;
  const ok = (x, z) => Math.abs(x) <= 250 && Math.abs(z) <= 250 && dist(x, z, sp[0], sp[1]) >= 60 && dist(x, z, gt[0], gt[1]) >= 60 && heads.every(h => dist(h.x, h.z, x, z) >= 100) && spread(G, x, z, 4) <= 0.8 && slopeAt(G, x, z) < 0.2 && !blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 6);
  const add = (x, z) => heads.push({ x, z, rot: r2(rn() * TAU), kind: (heads.length + k0) % 2 });
  for (let t = 0; t < 400 && !heads.length; t++) { const f = Math.max(0.2, 70 / gd) + rn() * 0.12, lat = (rn() - 0.5) * 60, x = sp[0] + ux * gd * f - uz * lat, z = sp[1] + uz * gd * f + ux * lat; if (ok(x, z)) add(x, z); }
  for (let t = 0; t < 4000 && heads.length < nh; t++) { const x = (rn() - 0.5) * 500, z = (rn() - 0.5) * 500; if (ok(x, z)) add(x, z); }
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
  // 4 to 6 mesas (7 to 10 m), 2 to 4 tall rock walls (10 to 14 m) and 16 to 22 lone ruin blocks (6 to 9 m), kept apart
  const blocks = [], placedAt = [];
  const place = (n, mk, gap) => { for (let t = 0; t < 600 && n > 0; t++) { const x = (rn() - 0.5) * 520, z = (rn() - 0.5) * 520; if (placedAt.some(p => dist(p[0], p[1], x, z) < gap + p[2])) continue; const b = mk(x, z); blocks.push(b); placedAt.push([x, z, Math.max(b.rx, b.rz)]); n--; } };
  place(4 + ((rn() * 3) | 0), (x, z) => block(rn, x, z, 7 + rn() * 6, 7 + rn() * 5, 7 + rn() * 3, 2.4, rn() < 0.45 ? 2 : 1), 70);
  place(2 + ((rn() * 3) | 0), (x, z) => block(rn, x, z, 13 + rn() * 6, 3 + rn() * 1.5, 10 + rn() * 4, 2.4, rn() < 0.5 ? 2 : 1), 70);
  place(16 + ((rn() * 7) | 0), (x, z) => { const b = block(rn, x, z, 3.8 + rn() * 2, 3 + rn() * 1.4, 6 + rn() * 3, 1.3, 0); b.door = rn() < 0.55; return b; }, 45);
  const G = field(P, blocks);
  const relief = (x, z, r) => { let lo = 1e9, hi = -1e9; for (const rr of [r, r * 0.6]) for (let a = 0; a < 12; a++) { const t = a * TAU / 12, h = at(G, x + cosA(t) * rr, z + sinA(t) * rr); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
  const nearBlock = (x, z, d) => blocks.some(b => dist(b.cx, b.cz, x, z) < reachOf(b) + d);
  // spawn on a slope (never a flat plate): standable underfoot and the ground within 30 m spanning 3 m or more; gate on gentle ground 190 m or more away; both well clear of the blocks
  const cand = []; for (let z = -240; z <= 240; z += 12) for (let x = -240; x <= 240; x += 12) { const rl = relief(x, z, 30); if (slopeAt(G, x, z) <= 0.22 && spread(G, x, z, 5) <= 0.9 && rl >= 3 && rl <= 14 && !nearBlock(x, z, 20)) cand.push([x, z]); }
  const gcand = []; for (let z = -270; z <= 270; z += 12) for (let x = -270; x <= 270; x += 12) if (spread(G, x, z, 24) <= 8 && slopeAt(G, x, z) < 0.3 && !nearBlock(x, z, 30)) gcand.push([x, z]);
  if (cand.length < 8 || gcand.length < 8) return null;
  for (let tries = 0; tries < 160; tries++) {
    const sp = cand[(rn() * cand.length) | 0], far = gcand.filter(c => dist(c[0], c[1], sp[0], sp[1]) >= 350); if (!far.length) continue;
    const gt = far[(rn() * far.length) | 0], heads = placeHeads(G, rn, sp, gt, blocks, 4 + ((rn() * 3) | 0), (rn() * 2) | 0); if (heads.length < 4) continue;
    const sv = startView(G, P, sp, gt, blocks, heads); if (!sv) continue;
    return { P, blocks, G, sp, gt, rn, heads, start: sv };
  }
  return null;
}

// ---- dressing and far dressing: plain lists, drawn by the view
function dressing(b, seed, enc, rings, st) {
  const { G, sp, gt, blocks } = b, rn = rngOf(seed ^ 0xD7E55), out = { cacti: [], dead: [], logs: [], pots: [], heads: [], head: null, stalls: b.stalls || [] }, solid = [], grid = new Map();
  const keep = [{ x: sp[0], z: sp[1], r: 22 }, { x: gt[0], z: gt[1], r: 34 }]; for (const e of enc) keep.push({ x: e.x, z: e.z, r: e.type === 'broker' ? 12 : 7 }); for (const q of rings) keep.push({ x: q.x, z: q.z, r: 18 });
  const free = (x, z, pad) => { for (const k of keep) { const rr = k.r + (pad || 0); if ((x - k.x) * (x - k.x) + (z - k.z) * (z - k.z) < rr * rr) return false; } for (const bl of blocks) if (dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 1 + (pad || 0)) return false; return true; };
  const key = (x, z) => Math.floor(x / 8) * 4096 + Math.floor(z / 8), put = (kind, x, z) => { const k = key(x, z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push([kind, x, z]); };
  const near = (kind, x, z, d) => { for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const a = grid.get(key(x + i * 8, z + j * 8)); if (a) for (const o of a) if ((kind === '*' || o[0] === kind) && (o[1] - x) * (o[1] - x) + (o[2] - z) * (o[2] - z) < d * d) return true; } return false; };
  const dens = (x, z) => 0.6 * vnoise(seed & 0xffff, x / 70, z / 70) + 0.4 * vnoise((seed >>> 7) & 0xffff, x / 28, z / 28);
  const gy = (x, z) => groundAt(b.map, x, z), spot = () => [(rn() - 0.5) * 560, (rn() - 0.5) * 560];
  const okAt = (x, z, pad, maxSlope) => free(x, z, pad) && slopeAt(G, x, z) < (maxSlope || 0.42);
  const rnd = rn;
  out.heads = (b.heads || []).map(h => ({ x: r2(h.x), y: r2(gy(h.x, h.z)), z: r2(h.z), rot: h.rot, s: 1, kind: h.kind })); for (const h of out.heads) { put('h', h.x, h.z); solid.push([h.x, h.y, h.z, 1.9, 6]); keep.push({ x: h.x, z: h.z, r: 4 }); } out.head = out.heads[0] || null;
  const cactus = (x, z, s) => { const y = gy(x, z); out.cacti.push([r2(x), r2(y), r2(z), r2(s), r2(rnd() * TAU), (rnd() * 3) | 0]); solid.push([r2(x), r2(y), r2(z), r2(0.55 * s), r2(3.5 * s)]); put('c', x, z); };
  const dead = (x, z, s) => { const y = gy(x, z); out.dead.push([r2(x), r2(y), r2(z), r2(s), r2(rnd() * TAU), (rnd() * 3) | 0]); solid.push([r2(x), r2(y), r2(z), r2(0.55 * s), r2(6 * s)]); put('d', x, z); };
  const beam = (x, z, len, rad, kind) => { const a = rnd() * TAU, dx = cosA(a) * len / 2, dz = sinA(a) * len / 2; out.logs.push([r2(x - dx), r2(gy(x - dx, z - dz) - 0.15), r2(z - dz), r2(x + dx), r2(gy(x + dx, z + dz) - 0.15), r2(z + dz), r2(rad), kind]); put('l', x, z); };
  const potc = (x, z) => { const n = 3 + ((rnd() * 3) | 0); for (let q = 0; q < n; q++) { const a = rnd() * TAU, d = q ? 0.8 + rnd() * 1.3 : 0, px = x + cosA(a) * d, pz = z + sinA(a) * d; out.pots.push([r2(px), r2(gy(px, pz)), r2(pz), r2(0.9 + rnd() * 0.7), r2(rnd() * TAU), (rnd() * 3) | 0]); } put('p', x, z); };
  // anchors: every block, monument and reward site. Dense groups of 4 to 9 cacti (2 to 6 m, mixed heights) stand 7 to 15 m off each, so the ring round the reward itself stays open for circling
  const anchors = []; for (const bl of blocks) anchors.push({ x: bl.cx, z: bl.cz, r: reachOf(bl) + 2, blk: bl }); for (const h of out.heads) anchors.push({ x: h.x, z: h.z, r: 6 }); for (const e of enc) anchors.push({ x: e.x, z: e.z, r: 8 });
  for (const an of anchors) {
    if (!an.blk && rnd() < 0.2) continue;
    for (let g = 0; g < 2 && !(g && rnd() < 0.5); g++) { const a0 = rnd() * TAU, d0 = an.r + 3 + rnd() * 7, cx = an.x + cosA(a0) * d0, cz = an.z + sinA(a0) * d0, n = 4 + ((rnd() * 6) | 0); let k = 0;
      for (let t = 0; t < 40 && k < n; t++) { const a = rnd() * TAU, d = 0.8 + rnd() * 4.5, x = cx + cosA(a) * d, z = cz + sinA(a) * d; if (!okAt(x, z, 1, 0.45) || near('c', x, z, 1.7)) continue; const s = k === 0 ? 1.3 + rnd() * 0.25 : 0.6 + rnd() * 0.7; cactus(x, z, s); k++; } }
    if (rnd() < 0.55) { const a0 = rnd() * TAU, d0 = an.r + 4 + rnd() * 8, n = 1 + ((rnd() * 3) | 0); for (let k = 0; k < n; k++) { const x = an.x + cosA(a0) * d0 + (rnd() - 0.5) * 7, z = an.z + sinA(a0) * d0 + (rnd() - 0.5) * 7; if (okAt(x, z, 2) && !near('d', x, z, 6)) dead(x, z, 1.25 + rnd() * 0.35); } }
    if (an.blk) { const bl = an.blk, a0 = rnd() * TAU, d0 = Math.max(bl.rx, bl.rz) * 1.05 + 4 + rnd() * 3, x = bl.cx + cosA(a0) * d0, z = bl.cz + sinA(a0) * d0; if (okAt(x, z, 1.5, 0.35)) potc(x, z); const a1 = a0 + 2 + rnd() * 2, d1 = d0 + 3 + rnd() * 3, x1 = bl.cx + cosA(a1) * d1, z1 = bl.cz + sinA(a1) * d1; if (free(x1, z1, 1) && slopeAt(G, x1, z1) < 0.5) beam(x1, z1, 7 + rnd() * 6, 0.45 + rnd() * 0.25, 2); }
  }
  const fill = (n, tries, kind, sep, ok, make) => { let k = 0; for (let t = 0; t < tries && k < n; t++) { const [x, z] = spot(); if (!ok(x, z) || near(kind, x, z, sep)) continue; make(x, z); k++; } };
  fill(240, 16000, 'c', 12, (x, z) => dens(x, z) > 0.3 && okAt(x, z, 2), (x, z) => cactus(x, z, 0.9 + rnd() * 0.6));
  fill(100, 12000, 'd', 16, (x, z) => okAt(x, z, 2), (x, z) => dead(x, z, 1.25 + rnd() * 0.35));
  fill(360, 20000, 'l', 10, (x, z) => okAt(x, z, 1, 0.5), (x, z) => beam(x, z, 5 + rnd() * 7, 0.4 + rnd() * 0.3, (rnd() * 2) | 0));
  fill(40, 8000, 'p', 20, (x, z) => okAt(x, z, 2, 0.35), (x, z) => potc(x, z));
  // coverage: every 28 m cell of the square has a piece within 25 m of its centre
  for (let cz = -280; cz <= 280; cz += 28) for (let cx = -280; cx <= 280; cx += 28) { if (near('*', cx, cz, 22)) continue; for (let t = 0; t < 12; t++) { const x = cx + (rnd() - 0.5) * 16, z = cz + (rnd() - 0.5) * 16; if (!okAt(x, z, 2, 0.45)) continue; const r = rnd(); if (r < 0.45) cactus(x, z, 1.0 + rnd() * 0.5); else if (r < 0.7) dead(x, z, 1.25 + rnd() * 0.35); else beam(x, z, 6 + rnd() * 6, 0.45 + rnd() * 0.25, 2); break; } }
  return { dress: out, solid };
}
const farDressing = () => ({ rocks: [], dead: [], ruins: [] });                                          // the mountains close the view: nothing stands beyond them

export function openMap(seedLo, stageIndex, archOverride) {
  const seed = ((seedLo >>> 0) ^ Math.imul(stageIndex + 1, 0x85EBCA6B)) >>> 0, rr = rngOf(seed ^ 0xC0FFEE), arch = archOverride && ARCHETYPES.includes(archOverride) ? archOverride : ARCHETYPES[(rr() * 6) | 0];
  for (let k = 0; k < 24; k++) {
    const a = attempt(seed, arch, k); if (!a) continue;
    const { G, sp, gt, rn, blocks, P } = a;
    pad(G, gt[0], gt[1], 14, 30); pad(G, sp[0], sp[1], 3, 9); for (const h of a.heads) pad(G, h.x, h.z, 4, 10);
    let st = analyse(G, sp); if (st.slopeShare < 0.45 || st.openFrac < 0.55 || st.range < 14 || st.walkFrac < 0.97 || st.flatShare > 0.04) continue;
    const reach = (x, z) => st.reach[Math.floor(z + HALF - OFF) * S + Math.floor(x + HALF - OFF)] === 1;
    if (!reach(gt[0], gt[1])) continue;
    // points of interest gather loosely round blocks, tall walls and monuments (2 or 3 per cluster, 14 m or more apart); clusters stand 70 m or more apart with open sand between
    const enc = [], types = ['cchest', 'shrine', 'cchest', 'altar', 'cchest', 'stone', 'cchest', 'shrine', 'cchest', 'stone', 'cchest', 'shrine', 'cchest', 'altar', 'cchest', 'stone', 'cchest', 'shrine', 'cchest', 'stone', 'cchest', 'shrine', 'stone', 'altar', 'cchest'];       // 25 points of interest, 2.5 times the first map
    const anchors = blocks.map(bl => ({ x: bl.cx, z: bl.cz, r: Math.max(bl.rx, bl.rz) * 1.1 })).concat(a.heads.map(h => ({ x: h.x, z: h.z, r: 4 })));
    const gapOk = (x, z, d) => enc.every(e => dist(e.x, e.z, x, z) >= d);
    const farOk = (x, z) => dist(x, z, sp[0], sp[1]) > 45 && dist(x, z, gt[0], gt[1]) > 50 && Math.abs(x) < 285 && Math.abs(z) < 285 && !blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 2) && !a.heads.some(h => dist(h.x, h.z, x, z) < 8);
    const flatOk = (x, z) => spread(G, x, z, 4) <= 1.6 && slopeAt(G, x, z) < 0.3 && reach(x, z);
    const order = anchors.map(an => [rn(), an]).sort((p, q) => p[0] - q[0]).map(p => p[1]), picked = [];
    for (const an of order) { if (enc.length >= types.length) break; if (picked.some(q => dist(q.x, q.z, an.x, an.z) < 70)) continue; const want = 2 + (rn() < 0.4 ? 1 : 0); let got = 0;
      for (let t = 0; t < 80 && got < want && enc.length < types.length; t++) { const ang = rn() * TAU, d = an.r + 4 + rn() * 14, x = an.x + cosA(ang) * d, z = an.z + sinA(ang) * d; if (farOk(x, z) && gapOk(x, z, 14) && flatOk(x, z)) { enc.push({ type: types[enc.length], x, z, y: 0, beside: true }); got++; } }
      if (got) picked.push(an); }
    for (let t = 0; t < 8000 && enc.length < types.length; t++) { const x = (rn() - 0.5) * 570, z = (rn() - 0.5) * 570; if (farOk(x, z) && gapOk(x, z, 40) && flatOk(x, z)) enc.push({ type: types[enc.length], x, z, y: 0 }); }
    if (enc.length < types.length) continue;
    let fc = null; for (let r = 14; r <= 30 && !fc; r += 2) for (let a2 = 0; a2 < 16 && !fc; a2++) { const x = sp[0] + cosA(a2 * TAU / 16) * r, z = sp[1] + sinA(a2 * TAU / 16) * r; if (spread(G, x, z, 3) < 0.9 && reach(x, z) && !blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 3)) fc = { type: 'cchest', x, z, y: at(G, x, z), free: true }; }
    if (!fc) continue; enc.push(fc);
    let bk = null, stalls = [];
    for (const bl of blocks.filter(q => q.tone === 0).sort(() => rn() - 0.5)) { if (bk) break; for (let t = 0; t < 30 && !bk; t++) { const ang = rn() * TAU, d = Math.max(bl.rx, bl.rz) * 1.05 + 5 + rn() * 4, x = bl.cx + cosA(ang) * d, z = bl.cz + sinA(ang) * d; if (dist(x, z, sp[0], sp[1]) > 50 && farOk(x, z) && gapOk(x, z, 14) && spread(G, x, z, 5) < 1.3 && slopeAt(G, x, z) < 0.25 && reach(x, z)) { bk = { type: 'broker', x, z, y: at(G, x, z) }; stalls.push({ x: r2(x + cosA(ang + 3.1416) * 3), z: r2(z + sinA(ang + 3.1416) * 3), rot: r2(ang) }); } } }
    if (!bk) continue; enc.push(bk);
    const rings = []; for (let t = 0; t < 4000 && rings.length < 4; t++) { const x = (rn() - 0.5) * 540, z = (rn() - 0.5) * 540; if (spread(G, x, z, 15) > 3.2 || !reach(x, z) || blocks.some(bl => dist(bl.cx, bl.cz, x, z) < reachOf(bl) + 18)) continue; if (dist(x, z, sp[0], sp[1]) < 60 || dist(x, z, gt[0], gt[1]) < 60 || rings.some(q => dist(q.x, q.z, x, z) < 100) || enc.some(e => dist(e.x, e.z, x, z) < 22)) continue; rings.push({ x, z, r: 14, y: at(G, x, z) }); }
    if (!rings.length) continue;
    // the three sleepers (the elite and the two mini bosses): each stands asleep at its own spot far from the start, from the gate and from each other, on open sand beside a block, wall or monument
    const sleepers = [], shuffled = anchors.map(an => [rn(), an]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
    for (const role of ['elite', 'bossA', 'bossB']) {
      let site = null;
      for (let pass = 0; pass < 3 && !site; pass++) { const minSp = [200, 150, 100][pass], minMu = [150, 110, 70][pass];
        for (const an of shuffled) { for (let t = 0; t < 20 && !site; t++) { const ang = rn() * TAU, d = an.r + 8 + rn() * 10, x = an.x + cosA(ang) * d, z = an.z + sinA(ang) * d; if (dist(x, z, sp[0], sp[1]) >= minSp && dist(x, z, gt[0], gt[1]) >= 100 && sleepers.every(q => dist(q.x, q.z, x, z) >= minMu) && farOk(x, z) && enc.every(e => dist(e.x, e.z, x, z) >= 16) && flatOk(x, z)) site = { role, x, z }; } if (site) break; } }
      for (let t = 0; t < 6000 && !site; t++) { const x = (rn() - 0.5) * 540, z = (rn() - 0.5) * 540; if (dist(x, z, sp[0], sp[1]) >= 120 && dist(x, z, gt[0], gt[1]) >= 80 && sleepers.every(q => dist(q.x, q.z, x, z) >= 70) && farOk(x, z) && enc.every(e => dist(e.x, e.z, x, z) >= 16) && flatOk(x, z)) site = { role, x, z }; }
      if (!site) break; sleepers.push(site);
    }
    if (sleepers.length < 3) continue;
    for (const q of sleepers) pad(G, q.x, q.z, 5, 12);
    // pads under everything placed: the piece sits flush, the sand blends back into the dunes
    for (const e of enc) { const big = e.type === 'broker'; e.y = pad(G, e.x, e.z, big ? 7 : 3, big ? 15 : 8); }
    for (const q of rings) q.y = pad(G, q.x, q.z, 14, 26);
    st = analyse(G, sp); if (st.walkFrac < 0.97) continue;
    return assemble({ arch, k, G, sp, gt, enc, rings, st, blocks, P, heads: a.heads, start: a.start, stalls, sleepers }, seed, stageIndex);
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
    key, hash: key, sealCode: 'OPEN-' + b.arch.toUpperCase() + '-' + (seed >>> 0).toString(16).slice(0, 4).toUpperCase(), stage: stageIndex, attempt: b.k, fallback: false, half: HALF, simN: SIM, v2: true, open: true, arch: b.arch, n: S, off: OFF, play: EDGE_R, edgeSeed: seed,
    prims: [], heights: H, cellFlags: Fl, palette: undefined, stageName: ARCH_NAME[b.arch],
    districts: [], spawn: { x: r2(b.sp[0]), z: r2(b.sp[1]) }, gate: { x: r2(b.gt[0]), z: r2(b.gt[1]), radius: 5.5, guide: { far: 340, mid: 190, near: 60 } }, arena: { center: { x: r2(b.gt[0]), z: r2(b.gt[1]) }, boss: { x: r2(b.gt[0] + 9), z: r2(b.gt[1]) }, tollPull: { x: r2(b.gt[0] + 6), z: r2(b.gt[1]) } },
    bossRings: b.rings.map(q => ({ x: r2(q.x), z: r2(q.z), r: 14, y: r2(q.y) })), encounters: b.enc.map(ex), landmarks: [], kits: [], rooms: [], roomOf: null, gateways: [],
    clearings: b.enc.filter(e => e.type === 'broker').map(e => ({ x: r2(e.x), z: r2(e.z), r: 12 })), groves: [], paths: [],
    dune: P, startYaw: r2(b.start.yaw), sleepers: b.sleepers.map(q => ({ role: q.role, x: r2(q.x), z: r2(q.z) })),
    blocks: b.blocks.map(q => ({ cx: r2(q.cx), cz: r2(q.cz), rx: r2(q.rx), rz: r2(q.rz), h: r2(q.h), cw: q.cw, rot: q.rot, cr: q.cr, sr: q.sr, seed: q.seed, tone: q.tone, T: r2(q.T), door: q.door })),
    _road: { main: [[9000, 9000], [9001, 9001]], trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: 'open3', v2: true, attempt: b.k, fallback: false, openFrac: r2(b.st.openFrac), slopeShare: r2(b.st.slopeShare), range: r2(b.st.range), forms: b.blocks.length, walkFrac: r2(b.st.walkFrac), flatShare: r2(b.st.flatShare), horizon: r2(b.start.horizon), fg: r2(b.start.fg), big: P.big.length }
  };
  map.ruins = map.blocks.filter(q => q.tone === 0).map(q => ({ kind: 'block', x: q.cx, z: q.cz, y: q.T, face: q.rot, tilt: 0 }));
  const d = dressing(Object.assign({ map }, b), seed, b.enc, b.rings, b.st); map.dress = d.dress; map.solid = d.solid; map.far = farDressing();
  return map;
}
