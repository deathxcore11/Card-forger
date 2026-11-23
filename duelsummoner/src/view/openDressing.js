// The open desert's dressing, drawn into one flat-faceted, vertex-coloured builder: cacti, bare dead trees, half-sunk grey logs and beams, clay pots, one large carved head, the slits and doorways on the ruin blocks,
// and, beyond the boundary line, large rock blocks, dead trees and ruin pieces. No textures; every piece is a handful of prisms and frusta with one colour per piece. View only: the sim reads map.solid.
import { vnoise, groundAt } from '../gen/open/terrain.js';
const TAU = 6.283185307179586;
const mixc = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// a tapered n-sided rod between two points (a log, a branch, a cactus arm); end caps optional
function rod(D, a, b, r0, r1, n, col, capTop = true, capBot = false, spin = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, ax = dx / len, ay = dy / len, az = dz / len;
  let ux, uy, uz; if (Math.abs(ay) < 0.9) { ux = -az; uy = 0; uz = ax; } else { ux = 1; uy = 0; uz = 0; }
  let l = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= l; uy /= l; uz /= l; const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
  const ring = (c, r) => { const o = []; for (let i = 0; i < n; i++) { const t = spin + i / n * TAU, cs = Math.cos(t), sn = Math.sin(t); o.push([c[0] + (ux * cs + vx * sn) * r, c[1] + (uy * cs + vy * sn) * r, c[2] + (uz * cs + vz * sn) * r, ux * cs + vx * sn, uy * cs + vy * sn, uz * cs + vz * sn]); } return o; };
  const A = ring(a, r0), B = ring(b, r1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, o = [A[i][3] + A[j][3], A[i][4] + A[j][4], A[i][5] + A[j][5]]; D.quad(A[i], A[j], B[j], B[i], o, col); }
  if (capTop) for (let i = 0; i < n; i++) D.tri(B[i], B[(i + 1) % n], [b[0], b[1], b[2]], [ax, ay, az], col);
  if (capBot) for (let i = 0; i < n; i++) D.tri(A[i], A[(i + 1) % n], [a[0], a[1], a[2]], [-ax, -ay, -az], col);
}
// a box or frustum standing on y0: half sizes hx0, hz0 at the foot, hx1, hz1 at the top, turned by yaw, centred on (cx, cz)
function frustum(D, cx, y0, cz, hx0, hz0, hx1, hz1, h, yaw, col, colTop) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz, y) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c], A = [P(-hx0, -hz0, y0), P(hx0, -hz0, y0), P(hx0, hz0, y0), P(-hx0, hz0, y0)], B = [P(-hx1, -hz1, y0 + h), P(hx1, -hz1, y0 + h), P(hx1, hz1, y0 + h), P(-hx1, hz1, y0 + h)];
  D.quad(B[0], B[1], B[2], B[3], [0, 1, 0], colTop === undefined ? col : colTop);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, mx = (A[i][0] + A[j][0]) / 2 - cx, mz = (A[i][2] + A[j][2]) / 2 - cz; D.quad(A[i], A[j], B[j], B[i], [mx, 0.3, mz], col); }
}

// ---- cactus: a faceted green trunk with one or two arms, leaning a little
const CACT = [0x6fae3c, 0x7dbb46, 0x62a036];
function cactus(D, x, y, z, s, rot, v) {
  const r = rng(Math.floor(x * 131 + z * 71 + v * 7)), lean = (r() - 0.5) * 0.5, h = (3.2 + r() * 1.4) * s, col = CACT[v % 3], dk = mixc(col, 0x3f6a22, 0.35), lx = Math.cos(rot) * lean * s, lz = Math.sin(rot) * lean * s;
  rod(D, [x, y - 0.25, z], [x + lx * h * 0.4, y + h, z + lz * h * 0.4], 0.62 * s, 0.46 * s, 6, col, true);
  const arms = 1 + ((r() * 2) | 0); for (let k = 0; k < arms; k++) { const a = rot + k * 3.14159 + (r() - 0.5) * 0.9, hy = y + h * (0.38 + r() * 0.18), out = (0.95 + r() * 0.5) * s, up = (0.9 + r() * 0.9) * s, bx = x + lx * 0.4 * (hy - y), bz = z + lz * 0.4 * (hy - y), ex = bx + Math.cos(a) * out, ez = bz + Math.sin(a) * out;
    rod(D, [bx, hy, bz], [ex, hy + 0.1 * s, ez], 0.3 * s, 0.28 * s, 5, dk, false); rod(D, [ex, hy - 0.1 * s, ez], [ex + Math.cos(a) * 0.15 * s, hy + up, ez + Math.sin(a) * 0.15 * s], 0.3 * s, 0.22 * s, 5, dk, true); }
}
// ---- dead tree: a bare grey-tan trunk with a few forked branches
const WOOD = [0xb59a6f, 0xa58d66, 0xbfa57a];
function deadTree(D, x, y, z, s, rot, v, small) {
  const r = rng(Math.floor(x * 97 + z * 53 + v * 11)), col = WOOD[v % 3], h = (4 + r() * 1.5) * s, lean = (r() - 0.5) * 1.0, tx = x + Math.cos(rot) * lean * s, tz = z + Math.sin(rot) * lean * s;
  rod(D, [x, y - 0.3, z], [tx, y + h, tz], 0.38 * s, 0.1 * s, 5, col, true);
  const nb = small ? 2 : 3 + ((r() * 2) | 0);
  for (let k = 0; k < nb; k++) { const t = 0.4 + 0.5 * (k + r() * 0.5) / nb, bx = x + (tx - x) * t, by = y + h * t, bz = z + (tz - z) * t, a = rot + k * 2.1 + r() * 1.2, L = (1.6 + r() * 1.6) * s * (1.1 - t * 0.5), ex = bx + Math.cos(a) * L, ey = by + L * (0.45 + r() * 0.5), ez = bz + Math.sin(a) * L;
    rod(D, [bx, by, bz], [ex, ey, ez], 0.12 * s, 0.04 * s, 4, col, true); if (!small && r() < 0.7) { const a2 = a + (r() - 0.5) * 1.6, L2 = L * 0.55; rod(D, [bx + (ex - bx) * 0.6, by + (ey - by) * 0.6, bz + (ez - bz) * 0.6], [bx + (ex - bx) * 0.6 + Math.cos(a2) * L2, ey + L2 * 0.5, bz + (ez - bz) * 0.6 + Math.sin(a2) * L2], 0.07 * s, 0.025 * s, 4, col, true); } }
}
// ---- logs and beams: grey, half sunk, one end broken
function log(D, q) {
  const [x0, y0, z0, x1, y1, z1, rad, kind] = q, col = kind === 2 ? 0xa59f93 : kind ? 0x9a9488 : 0x8f897d, n = kind === 2 ? 4 : 6;
  rod(D, [x0, y0 + rad * 0.5, z0], [x1, y1 + rad * 0.5, z1], rad, rad * 0.92, n, col, true, true, 0.4);
  const dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz) || 1;                 // a broken spike at one end
  rod(D, [x1, y1 + rad * 1.0, z1], [x1 + dx / l * 0.1, y1 + rad * 1.0 + rad * 1.7, z1 + dz / l * 0.1], rad * 0.34, 0.02, 4, mixc(col, 0xd9d2c0, 0.4), true);
}
// ---- clay pot
const CLAY = [0xc2642f, 0xb4562a, 0xd0793c];
function pot(D, x, y, z, s, rot, v) {
  const col = CLAY[v % 3], dk = mixc(col, 0x6a2c12, 0.3), lean = 0.06 * Math.sin(rot * 3);
  rod(D, [x, y - 0.06 * s, z], [x + lean, y + 0.3 * s, z], 0.2 * s, 0.34 * s, 7, dk, false, true); rod(D, [x + lean, y + 0.3 * s, z], [x + lean, y + 0.6 * s, z], 0.34 * s, 0.22 * s, 7, col, false);
  rod(D, [x + lean, y + 0.6 * s, z], [x + lean, y + 0.72 * s, z], 0.22 * s, 0.17 * s, 7, col, false); rod(D, [x + lean, y + 0.72 * s, z], [x + lean, y + 0.78 * s, z], 0.2 * s, 0.2 * s, 7, dk, true);
}
// ---- carved monuments, our own design, about 6 m tall. kind 0: a duelist mask (a tall stone slab with a brow band, two eye holes, a nose ridge, a jaw bar and two pointed ties). kind 1: a great stone hand rising from the sand holding a card upright (palm, four curled fingers, a thumb, a framed card with a diamond seal).
function monument(D, q) {
  const { x, y, z, rot, s, kind } = q, c = Math.cos(rot), sn = Math.sin(rot), G = 0xc2b498, G2 = 0xaa9c82, G3 = 0xd2c5aa, DK = 0x4f4130;
  const L = (lx, lz) => [x + lx * s * c - lz * s * sn, z + lx * s * sn + lz * s * c];                 // local +z is the front
  const part = (lx, lz, y0, hx0, hz0, hx1, hz1, h, col, colTop) => { const p = L(lx, lz); frustum(D, p[0], y + y0 * s - 0.3, p[1], hx0 * s, hz0 * s, hx1 * s, hz1 * s, h * s, rot, col, colTop); };
  part(0, 0, 0, 2.6, 2.0, 2.2, 1.7, 0.8, G2);
  if (kind === 0) {
    part(0, 0, 0.8, 1.5, 0.75, 1.3, 0.6, 4.4, G, G3);
    part(0, 0.55, 3.9, 1.7, 0.3, 1.6, 0.25, 0.55, G2);
    part(-0.62, 0.62, 3.35, 0.36, 0.06, 0.3, 0.04, 0.36, DK); part(0.62, 0.62, 3.35, 0.36, 0.06, 0.3, 0.04, 0.36, DK);
    part(0, 0.6, 2.2, 0.18, 0.18, 0.12, 0.1, 1.5, G3);
    part(0, 0.62, 1.55, 0.7, 0.05, 0.7, 0.03, 0.14, DK);
    part(-1.85, 0, 3.3, 0.38, 0.12, 0.05, 0.06, 1.3, G2); part(1.85, 0, 3.3, 0.38, 0.12, 0.05, 0.06, 1.3, G2);
    part(0, 0, 5.2, 0.9, 0.4, 0.6, 0.3, 0.45, G2);
  } else {
    part(0, -0.2, 0.8, 1.2, 1.0, 1.1, 0.9, 2.0, G);
    part(0, 0.1, 2.8, 1.5, 1.05, 1.5, 1.0, 0.9, G, G3);
    for (let k = -1.5; k <= 1.5; k += 1) part(k * 0.72, 0.85, 3.05, 0.3, 0.32, 0.28, 0.3, 1.0, G2, G3);
    part(-1.65, 0.45, 3.0, 0.3, 0.5, 0.26, 0.4, 1.1, G2);
    part(0.1, 0.55, 3.7, 1.15, 0.12, 1.1, 0.1, 2.5, G3);
    part(0.1, 0.69, 4.05, 0.8, 0.02, 0.8, 0.02, 1.8, G);
    part(0.1, 0.71, 4.6, 0.32, 0.02, 0.05, 0.02, 0.6, DK); part(0.1, 0.71, 4.0, 0.32, 0.02, 0.05, 0.02, 0.6, DK);
  }
}
// ---- the gate: a low round stone plinth and a framed standing gateway (two pillars, a lintel, a stepped crest and a carved round seal), turned toward the start, so it reads as a built place across the sand
function gateway(D, map) {
  const g = map.gate, sp = map.spawn, y = groundAt(map, g.x, g.z), dx = sp.x - g.x, dz = sp.z - g.z, d = Math.sqrt(dx * dx + dz * dz) || 1, nx = dx / d, nz = dz / d, yaw = Math.atan2(nz, nx) - Math.PI / 2, tx = -nz, tz = nx, ST = 0xb6aa94, ST2 = 0xa09580, ST3 = 0xcfc3a8, DK = 0x4a3f30;
  rod(D, [g.x, y - 0.4, g.z], [g.x, y + 0.35, g.z], 7.6, 7.0, 12, ST2, true, false, 0.2);
  const P = (u, v, y0) => [g.x + tx * u + nx * v, y0, g.z + tz * u + nz * v];
  for (const u of [-4.6, 4.6]) { const c = P(u, 0, y); frustum(D, c[0], y + 0.3, c[2], 0.55, 0.55, 0.45, 0.45, 6.6, yaw, ST, ST3); frustum(D, c[0], y + 0.3, c[2], 0.75, 0.75, 0.65, 0.65, 0.6, yaw, ST2); }
  const m = P(0, 0, y); frustum(D, m[0], y + 6.9, m[2], 5.6, 0.6, 5.4, 0.55, 0.9, yaw, ST, ST3); frustum(D, m[0], y + 7.8, m[2], 3.8, 0.5, 3.4, 0.45, 0.5, yaw, ST2, ST3); frustum(D, m[0], y + 8.3, m[2], 1.4, 0.4, 1.0, 0.35, 0.5, yaw, ST, ST3);
  const sCtr = P(0, 0.9, y + 5.6); rod(D, sCtr, [sCtr[0] + nx * 0.15, sCtr[1], sCtr[2] + nz * 0.15], 1.5, 1.5, 16, ST3, true, true);
  const sIn = P(0, 1.1, y + 5.6); rod(D, sIn, [sIn[0] + nx * 0.05, sIn[1], sIn[2] + nz * 0.05], 1.0, 1.0, 16, DK, true, true);
}
// ---- blocks: a crisp box drawn at the foot of the sim's steep side (15 % into the rise), with a flat top, banded walls, a row of dark window slits high on the long faces and a doorway low on one face
const BLK = [{ face: 0xf2dcae, top: 0xf6e6c2, bands: [0.9, 0.96, 1.0], sl: 0x6a4a2c }, { face: 0xe2a361, top: 0xeab777, bands: [0.82, 0.91, 1.0], sl: 0x5a3a20 }, { face: 0xf0b98a, top: 0xf6d2ac, bands: [0.86, 0.94, 1.0], sl: 0x6a3f28 }];
function blockMesh(D, map, b) {
  const cr = Math.cos(b.rot), sr = Math.sin(b.rot), avg = (b.rx + b.rz) / 2, q = 1 - 0.15 * b.cw / avg, K = BLK[b.tone], N = 56, T = b.T + 0.04;
  const pt = k => { const t = k / N * TAU, c = Math.cos(t), s = Math.sin(t), ux = q * Math.sign(c) * Math.sqrt(Math.abs(c)), uz = q * Math.sign(s) * Math.sqrt(Math.abs(s)); return [b.cx + ux * b.rx * cr - uz * b.rz * sr, b.cz + ux * b.rx * sr + uz * b.rz * cr]; };
  const P = []; for (let k = 0; k <= N; k++) P.push(pt(k % N));
  for (let k = 0; k < N; k++) { const a0 = P[k], a1 = P[k + 1], g = Math.min(groundAt(map, a0[0], a0[1]), groundAt(map, a1[0], a1[1])) - 0.6, mx = (a0[0] + a1[0]) / 2 - b.cx, mz = (a0[1] + a1[1]) / 2 - b.cz;
    for (let y = g, i = 0; y < T - 0.01; i++) { const y1 = Math.min(T, (Math.floor(y / 1.2) + 1) * 1.2); D.quad([a0[0], y, a0[1]], [a1[0], y, a1[1]], [a1[0], y1, a1[1]], [a0[0], y1, a0[1]], [mx, 0, mz], mixc(K.face, 0x000000, 1 - K.bands[((Math.floor(y / 1.2) % 3) + 3) % 3])); y = y1; if (i > 40) break; }
    D.tri([b.cx, T, b.cz], [a0[0], T, a0[1]], [a1[0], T, a1[1]], [0, 1, 0], K.top); }
  if (b.tone === 2) { let sd = b.seed + 7; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; }; const nsh = 5 + ((r() * 4) | 0); for (let k = 0; k < nsh; k++) { const ang = r() * TAU, rr = 0.2 + r() * 0.6, px = b.cx + (Math.cos(ang) * b.rx * rr) * cr - (Math.sin(ang) * b.rz * rr) * sr, pz = b.cz + (Math.cos(ang) * b.rx * rr) * sr + (Math.sin(ang) * b.rz * rr) * cr, h = 1.4 + r() * 2.6, lean = (r() - 0.5) * 2.2, la = r() * TAU, w = 0.5 + r() * 0.7; rod(D, [px, T - 0.1, pz], [px + Math.cos(la) * lean, T + h, pz + Math.sin(la) * lean], w, w * 0.15, 4, mixc(K.face, 0xffffff, 0.12 + r() * 0.15), true, false, r() * 1.5); } }
  const faces = [[1, 0, b.rx, b.rz], [-1, 0, b.rx, b.rz], [0, 1, b.rz, b.rx], [0, -1, b.rz, b.rx]];
  faces.forEach((f, fi) => {
    const [ax, az, ext, lat] = f, nx = ax * cr - az * sr, nz = ax * sr + az * cr, tx = -nz, tz = nx, edge = ext * q, px = b.cx + nx * edge, pz = b.cz + nz * edge, span = lat * 0.62;
    if (b.tone !== 2 && (lat > 3.2 || (b.tone === 0 && fi < 2))) for (let k = -Math.floor(span / 1.15); k <= Math.floor(span / 1.15); k++) { const o = k * 1.15, cx = px + tx * o + nx * 0.03, cz = pz + tz * o + nz * 0.03, hw = 0.24, y = T - (b.tone ? 1.0 : 0.6); D.quad([cx - tx * hw, y - 0.18, cz - tz * hw], [cx + tx * hw, y - 0.18, cz + tz * hw], [cx + tx * hw, y + 0.18, cz + tz * hw], [cx - tx * hw, y + 0.18, cz - tz * hw], [nx, 0, nz], K.sl); }
    if (b.door && fi === 2) { const gy = groundAt(map, px + nx * 0.6, pz + nz * 0.6), cx = px + nx * 0.03, cz = pz + nz * 0.03, hw = 0.62, dh = Math.min(b.h * 0.7, 2.0);
      D.quad([cx - tx * hw, gy - 0.1, cz - tz * hw], [cx + tx * hw, gy - 0.1, cz + tz * hw], [cx + tx * hw, gy + dh, cz + tz * hw], [cx - tx * hw, gy + dh, cz - tz * hw], [nx, 0, nz], 0x40301f);
      D.quad([cx - tx * (hw + 0.25), gy + dh, cz - tz * (hw + 0.25)], [cx + tx * (hw + 0.25), gy + dh, cz + tz * (hw + 0.25)], [cx + tx * (hw + 0.25), gy + dh + 0.3, cz + tz * (hw + 0.25)], [cx - tx * (hw + 0.25), gy + dh + 0.3, cz - tz * (hw + 0.25)], [nx, 0, nz], 0xcfae78); }
  });
}
// ---- beyond the line: big rock blocks (two stacked frusta, banded), a ruin piece (a broken wall slab and fallen blocks), small dead trees
const ROCKC = [[0xc98a4a, 0xdcae72], [0xd39a5a, 0xe3bd82], [0xbb7d41, 0xd29f66]];
function farRock(D, q) { const [x, y, z, w, h, rot, v] = q, c = ROCKC[v % 3]; frustum(D, x, y - 1, z, w * 0.55, w * 0.42, w * 0.48, w * 0.36, h * 0.62 + 1, rot, c[0], c[1]); frustum(D, x + Math.cos(rot) * w * 0.05, y + h * 0.62 - 1, z + Math.sin(rot) * w * 0.05, w * 0.4, w * 0.3, w * 0.34, w * 0.26, h * 0.38, rot, c[1], mixc(c[1], 0xffffff, 0.15)); }
function farRuin(D, q) { const [x, y, z, w, h, rot, v] = q, c = Math.cos(rot), s = Math.sin(rot), col = 0xd6b98a; frustum(D, x, y - 0.8, z, w * 0.5, 0.7, w * 0.46, 0.6, h + 0.8, rot, col, 0xe2c99c); frustum(D, x + c * w * 0.9, y - 0.5, z + s * w * 0.9, 1.2, 1.1, 1.1, 1.0, 1.3, rot + 0.5, col); frustum(D, x - s * 2.8, y - 0.5, z + c * 2.8, 0.9, 0.9, 0.8, 0.8, 0.9, rot + 1.2, 0xc9ab7c); }

export function addDressing(D, map) {
  const d = map.dress || {};
  for (const q of d.cacti || []) cactus(D, q[0], q[1], q[2], q[3], q[4], q[5]);
  for (const q of d.dead || []) deadTree(D, q[0], q[1], q[2], q[3], q[4], q[5], false);
  for (const q of d.logs || []) log(D, q);
  for (const q of d.pots || []) pot(D, q[0], q[1], q[2], q[3], q[4], q[5]);
  for (const q of d.heads || []) monument(D, q);
  gateway(D, map);
  for (const b of map.blocks || []) blockMesh(D, map, b);
  const f = map.far || {};
  for (const q of f.rocks || []) farRock(D, q);
  for (const q of f.dead || []) deadTree(D, q[0], q[1], q[2], q[3], q[4], q[5], true);
  for (const q of f.ruins || []) farRuin(D, q);
}
void vnoise;
