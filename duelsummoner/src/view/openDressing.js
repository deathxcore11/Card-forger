// The open desert's dressing, drawn into one flat-faceted, vertex-coloured builder: cacti, bare dead trees, half-sunk grey logs and beams, clay pots, one large carved head, the slits and doorways on the ruin blocks,
// and, beyond the boundary line, large rock blocks, dead trees and ruin pieces. No textures; every piece is a handful of prisms and frusta with one colour per piece. View only: the sim reads map.solid.
import { vnoise, groundAt, footY } from '../gen/open/terrain.js';
import { BLOCKS, blocksOn } from './models.js';
const TAU = 6.283185307179586;
const mixc = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the block look (?blocks=1): a block model's full-detail faces written into the builder at a place, a size [x, y, z] in metres and a turn (no motion: scenery stands still). False when the model is not loaded.
const BLK_TRIS = {};
function blkTris(id) { if (BLK_TRIS[id] !== undefined) return BLK_TRIS[id]; const M = BLOCKS[id]; if (!M) return (BLK_TRIS[id] = null); const P = [], N = [], C = [];
  M.levels[0].parts.forEach((sh, i) => { const pv = M.parts[i].pivot; for (const g of [sh.solid, sh.glow]) if (g) { const a = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array; for (let k = 0; k < a.length; k += 9) { for (let j = 0; j < 9; j += 3) P.push(a[k + j] + pv[0], a[k + j + 1] + pv[1], a[k + j + 2] + pv[2]); N.push(n[k], n[k + 1], n[k + 2]); C.push((Math.round(c[k] * 255) << 16) | (Math.round(c[k + 1] * 255) << 8) | Math.round(c[k + 2] * 255)); } } });
  return (BLK_TRIS[id] = { P, N, C, M }); }
const BLK_TINT = { tree: c => mixc(c, 0x9a8a70, 0.8) };       // the block dead tree's near-black bark lifted to a dry grey-brown
function blockInto(D, id, x, y, z, size, yaw) {
  const B = blkTris(id); if (!B) return false; const tint = BLK_TINT[id] || (c => c); const { P, N, C, M } = B, sx = size[0] / M.size.x, sy = size[1] / M.size.y, sz = size[2] / M.size.z, c = Math.cos(yaw), s = Math.sin(yaw), cx = (M.min[0] + M.max[0]) / 2, cz = (M.min[2] + M.max[2]) / 2;
  const v = k => { const lx = (P[k] - cx) * sx, ly = P[k + 1] * sy, lz = (P[k + 2] - cz) * sz; return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c]; };
  for (let i = 0, k = 0; i < C.length; i++, k += 9) { const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2]; D.tri(v(k), v(k + 3), v(k + 6), [nx * c + nz * s, ny, -nx * s + nz * c], tint(C[i])); }
  return true;
}
// a tapered n-sided rod between two points (a log, a branch, a cactus arm); end caps optional
function rod(D, a, b, r0, r1, n, col, capTop = true, capBot = false, spin = 0, capCol) {
  const pick = i => (Array.isArray(col) ? col[i % col.length] : col), cc = capCol === undefined ? pick(0) : capCol;       // col may be a list: the sides take turns (ribs)
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, ax = dx / len, ay = dy / len, az = dz / len;
  let ux, uy, uz; if (Math.abs(ay) < 0.9) { ux = -az; uy = 0; uz = ax; } else { ux = 1; uy = 0; uz = 0; }
  let l = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= l; uy /= l; uz /= l; const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
  const ring = (c, r) => { const o = []; for (let i = 0; i < n; i++) { const t = spin + i / n * TAU, cs = Math.cos(t), sn = Math.sin(t); o.push([c[0] + (ux * cs + vx * sn) * r, c[1] + (uy * cs + vy * sn) * r, c[2] + (uz * cs + vz * sn) * r, ux * cs + vx * sn, uy * cs + vy * sn, uz * cs + vz * sn]); } return o; };
  const A = ring(a, r0), B = ring(b, r1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, o = [A[i][3] + A[j][3], A[i][4] + A[j][4], A[i][5] + A[j][5]]; D.quad(A[i], A[j], B[j], B[i], o, pick(i)); }
  if (capTop) for (let i = 0; i < n; i++) D.tri(B[i], B[(i + 1) % n], [b[0], b[1], b[2]], [ax, ay, az], cc);
  if (capBot) for (let i = 0; i < n; i++) D.tri(A[i], A[(i + 1) % n], [a[0], a[1], a[2]], [-ax, -ay, -az], cc);
}
// a box or frustum standing on y0: half sizes hx0, hz0 at the foot, hx1, hz1 at the top, turned by yaw, centred on (cx, cz)
function frustum(D, cx, y0, cz, hx0, hz0, hx1, hz1, h, yaw, col, colTop) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz, y) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c], A = [P(-hx0, -hz0, y0), P(hx0, -hz0, y0), P(hx0, hz0, y0), P(-hx0, hz0, y0)], B = [P(-hx1, -hz1, y0 + h), P(hx1, -hz1, y0 + h), P(hx1, hz1, y0 + h), P(-hx1, hz1, y0 + h)];
  D.quad(B[0], B[1], B[2], B[3], [0, 1, 0], colTop === undefined ? col : colTop);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, mx = (A[i][0] + A[j][0]) / 2 - cx, mz = (A[i][2] + A[j][2]) / 2 - cz; D.quad(A[i], A[j], B[j], B[i], [mx, 0.3, mz], col); }
}

// ---- cactus: three shapes of our own, each ribbed (the sides take turns light and dark) with a paler top and a slight lean. 0: a tall column with one or two arms. 1: a branching cactus, a short trunk that forks into three up-curving stems. 2: a low cluster of squat barrels.
const CACT = [[0x7cc04a, 0x5d9a34], [0x86c850, 0x62a038], [0x74b844, 0x568f30]], CTOP = 0xb5dc7e;
function cactus(D, x, y, z, s, rot, v) {
  if (blockInto(D, 'cactus', x, y - 0.1, z, [1.7 * s, 3.4 * s, 0.6 * s], rot)) return;
  const r = rng(Math.floor(x * 131 + z * 71 + v * 7)), lean = (r() - 0.5) * 0.45, rib = CACT[v % 3], dk = [mixc(rib[0], 0x3f6a22, 0.3), mixc(rib[1], 0x3f6a22, 0.3)], lx = Math.cos(rot) * lean * s, lz = Math.sin(rot) * lean * s;
  if (v % 3 === 2) { const n = 3 + ((r() * 3) | 0); for (let k = 0; k < n; k++) { const a = r() * 6.28, d = k ? (0.6 + r() * 0.9) * s : 0, bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d, h = (0.9 + r() * 0.8) * s, rr = (0.55 + r() * 0.3) * s; rod(D, [bx, y - 0.2, bz], [bx + 0.05, y + h, bz], rr, rr * 0.82, 8, rib, true, false, 0, CTOP); } return; }
  if (v % 3 === 1) { const h0 = (1.1 + r() * 0.5) * s; rod(D, [x, y - 0.25, z], [x + lx * 0.2, y + h0, z + lz * 0.2], 0.6 * s, 0.5 * s, 8, rib, false);
    for (let k = 0; k < 3; k++) { const a = rot + k * 2.09 + (r() - 0.5) * 0.5, out = (0.9 + r() * 0.7) * s, up = (1.7 + r() * 1.1) * s; const bx = x + lx * 0.2, bz = z + lz * 0.2, mx = bx + Math.cos(a) * out, mz = bz + Math.sin(a) * out;
      rod(D, [bx, y + h0 - 0.1, bz], [mx, y + h0 + 0.5 * s, mz], 0.34 * s, 0.3 * s, 6, dk, false); rod(D, [mx, y + h0 + 0.3 * s, mz], [mx + Math.cos(a) * 0.25 * s, y + h0 + 0.5 * s + up, mz + Math.sin(a) * 0.25 * s], 0.34 * s, 0.24 * s, 8, rib, true, false, 0, CTOP); } return; }
  const h = (3.2 + r() * 1.4) * s; rod(D, [x, y - 0.25, z], [x + lx * h * 0.4, y + h, z + lz * h * 0.4], 0.62 * s, 0.46 * s, 8, rib, true, false, 0, CTOP);
  const arms = 1 + ((r() * 2) | 0); for (let k = 0; k < arms; k++) { const a = rot + k * 3.14159 + (r() - 0.5) * 0.9, hy = y + h * (0.38 + r() * 0.18), out = (0.95 + r() * 0.5) * s, up = (0.9 + r() * 0.9) * s, bx = x + lx * 0.4 * (hy - y), bz = z + lz * 0.4 * (hy - y), ex = bx + Math.cos(a) * out, ez = bz + Math.sin(a) * out;
    rod(D, [bx, hy, bz], [ex, hy + 0.1 * s, ez], 0.3 * s, 0.28 * s, 6, dk, false); rod(D, [ex, hy - 0.1 * s, ez], [ex + Math.cos(a) * 0.15 * s, hy + up, ez + Math.sin(a) * 0.15 * s], 0.3 * s, 0.22 * s, 8, rib, true, false, 0, CTOP); }
}
// ---- dead tree: a thick pale bleached trunk with three to five forked branches, 6 to 9 m
const WOOD = [0xdcd3bc, 0xd0c6aa, 0xe4dcc8];
function deadTree(D, x, y, z, s, rot, v, small) {
  if (blockInto(D, 'tree', x, y - 0.1, z, [3.1 * s, 6 * s, 1.2 * s], rot)) return;
  const r = rng(Math.floor(x * 97 + z * 53 + v * 11)), col = WOOD[v % 3], dkc = mixc(col, 0x8a7a5a, 0.35), h = (4.6 + r() * 0.9) * s, lean = (r() - 0.5) * 0.9, tx = x + Math.cos(rot) * lean * s, tz = z + Math.sin(rot) * lean * s;
  rod(D, [x, y - 0.4, z], [x + (tx - x) * 0.12, y + h * 0.12, z + (tz - z) * 0.12], 0.9 * s, 0.68 * s, 7, [col, dkc], false);       // a flared root, then a thick trunk with a broken flat top: never a thin point
  rod(D, [x + (tx - x) * 0.12, y + h * 0.12, z + (tz - z) * 0.12], [tx, y + h, tz], 0.68 * s, 0.34 * s, 7, [col, dkc], true);
  const nb = small ? 3 : 3 + ((r() * 3) | 0);
  for (let k = 0; k < nb; k++) { const t = 0.35 + 0.55 * (k + r() * 0.5) / nb, bx = x + (tx - x) * t, by = y + h * t, bz = z + (tz - z) * t, a = rot + k * 2.1 + r() * 1.2, L = (1.7 + r() * 1.7) * s * (1.15 - t * 0.5), ex = bx + Math.cos(a) * L, ey = by + L * (0.45 + r() * 0.5), ez = bz + Math.sin(a) * L;
    rod(D, [bx, by, bz], [ex, ey, ez], 0.2 * s, 0.07 * s, 5, [col, dkc], true); for (let f = 0; f < (small ? 1 : 2); f++) { if (r() < 0.25) continue; const a2 = a + (f ? 1 : -1) * (0.5 + r() * 0.8), L2 = L * (0.5 + r() * 0.2), u = 0.55 + 0.2 * f, fx = bx + (ex - bx) * u, fy = by + (ey - by) * u, fz = bz + (ez - bz) * u; rod(D, [fx, fy, fz], [fx + Math.cos(a2) * L2, fy + L2 * 0.6, fz + Math.sin(a2) * L2], 0.11 * s, 0.04 * s, 4, col, true); } }
}
// ---- logs and beams: bleached grey-brown, a darker end-grain disc at each end, one end broken; every fifth one stands as a broken post
function log(D, map, q) {
  { const [x0, , z0, x1, , z1, rad] = q, dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; if (l > 0.5 && blocksOn) { blockBar(D, [x0, groundAt(map, x0, z0) + rad * 0.9, z0], [x1, groundAt(map, x1, z1) + rad * 0.9, z1], rad, false, 0x9a7a52); return; } }       // the block look: one straight half-sunk beam lying on the ground end to end
  const [x0, y0, z0, x1, y1, z1, rad, kind] = q, base = kind === 3 ? 0x8a6038 : kind === 2 ? 0xe0c89a : kind ? 0xd6b88a : 0xcaa878, col = [base, mixc(base, 0xb98a55, 0.28)], ns = kind >= 2 ? 4 : 6, grain = 0x6a4f30, dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz) || 1;
  if (false) {       // (no standing broken posts: every beam lies flat and can be ground, the no-junk rule)       // (a ride-line beam, kind 3, always lies flat)       // a broken post standing up, half sunk, with a jagged top
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = groundAt(map, mx, mz), h = 2.4 + (rad * 6 % 1.5); rod(D, [mx, my - 0.5, mz], [mx + 0.12, my + h, mz], rad, rad * 0.85, ns, col, true, false, 0.3, grain); rod(D, [mx + 0.05, my + h - 0.05, mz], [mx + 0.25, my + h + rad * 1.5, mz + 0.1], rad * 0.35, 0.03, 4, col[0], true); return; }
  const n = Math.max(1, Math.round(l / 2)), pt = t => { const x = x0 + dx * t, z = z0 + dz * t; return [x, groundAt(map, x, z) + rad * 0.1, z]; };       // 2 m pieces that follow the ground, the middle of the beam on the surface so it is half sunk
  for (let i = 0; i < n; i++) rod(D, pt(i / n), pt((i + 1) / n), rad, rad * 0.97, ns, col, i === n - 1, i === 0, 0.4, grain);
}
// ---- clay pot
const CLAY = [0xc2642f, 0xb4562a, 0xd0793c];
function pot(D, x, y, z, s, rot, v) {
  if (blockInto(D, 'urn', x, y - 0.05, z, [0.9 * s, 1.0 * s, 0.9 * s], rot)) return;
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
const BLK = [{ face: 0xf8e8c4, top: 0xfcf3da, shade: 0xd98a46, frame: 0xefdfb8, bands: [0.94, 0.98, 1.0], sl: 0x5a3f28 }, { face: 0xe8a766, top: 0xf0bb7c, shade: 0xbf6f38, frame: 0xefd2a0, bands: [0.88, 0.94, 1.0], sl: 0x4d321e }, { face: 0xf3c094, top: 0xf8d6b0, shade: 0xd47a4c, frame: 0xf3d6b4, bands: [0.9, 0.96, 1.0], sl: 0x5c3a26 }];
// a light frame with a dark pane set in a wall: centre (cx, y, cz), tangent (tx, tz), outward normal (nx, nz), width and height
function pane(D, K, cx, y, cz, tx, tz, nx, nz, w, h) {
  const q = (o, hw, y0, y1, col) => D.quad([cx + nx * o - tx * hw, y0, cz + nz * o - tz * hw], [cx + nx * o + tx * hw, y0, cz + nz * o + tz * hw], [cx + nx * o + tx * hw, y1, cz + nz * o + tz * hw], [cx + nx * o - tx * hw, y1, cz + nz * o - tz * hw], [nx, 0, nz], col);
  q(0.03, w / 2 + 0.22, y - 0.22, y + h + 0.22, K.frame); q(0.07, w / 2, y, y + h, K.sl);
}
// the block look (?blocks=1): a mesa or landmark drawn on the 24 cm ground grid, rows of cells inside its outline with flat tops and vertical walls, the same banded faces
function blockMeshVox(D, map, b) {
  const cr = Math.cos(b.rot), sr = Math.sin(b.rot), avg = (b.rx + b.rz) / 2, q = 1 - 0.15 * b.cw / avg, K = { face: mixc(0xc09c66, [0xb88a5a, 0xc8a070, 0xb07850][b.tone % 3], 0.35), top: 0xcaa874 }, T = Math.round((b.T + 0.04) / 0.06) * 0.06, C = 0.96, R0 = Math.max(b.rx, b.rz) * q + 1;
  const inside = (x, z) => { const dx = x - b.cx, dz = z - b.cz, lx = (dx * cr + dz * sr) / (q * b.rx), lz = (-dx * sr + dz * cr) / (q * b.rz); return Math.abs(lx) ** 3 + Math.abs(lz) ** 3 <= 1; };
  const x0 = Math.floor((b.cx - R0) / C) * C, z0 = Math.floor((b.cz - R0) / C) * C, N = Math.ceil(2 * R0 / C) + 2, runs = [];
  for (let j = 0; j < N; j++) { const z = z0 + (j + 0.5) * C; let L = -1, Rr = -1; for (let i = 0; i < N; i++) if (inside(x0 + (i + 0.5) * C, z)) { if (L < 0) L = i; Rr = i + 1; } runs.push(L < 0 ? null : [L, Rr]); }
  const band = y => mixc(K.face, 0x000000, [0.0, 0.03, 0.015, 0.045][((Math.floor(y / 0.24 + 1e-6) % 4) + 4) % 4]);       // one subtle shade per 24 cm course, a sandstone of the ground's tone
  const wall = (a, bb, out) => { const g = Math.round(Math.min(footY(map, a[0], a[1]), footY(map, bb[0], bb[1])) / 0.24) * 0.24 - 0.24, mx = (a[0] + bb[0]) / 2 - b.cx, mz = (a[1] + bb[1]) / 2 - b.cz, ml = Math.hypot(mx, mz) || 1, nrm = [mx / ml, 0, mz / ml];       // lit by the outward direction from the centre, so the stepped outline reads as one smooth face
    for (let y = g; y < T - 0.01;) { const y1 = Math.min(T, (Math.floor(y / 0.24 + 1e-6) + 1) * 0.24); D.quad([a[0], y, a[1]], [bb[0], y, bb[1]], [bb[0], y1, bb[1]], [a[0], y1, a[1]], out, band(y)); y = y1; } };
  runs.forEach((r, j) => { if (!r) return; const za = z0 + j * C, zb = za + C, xa = x0 + r[0] * C, xb = x0 + r[1] * C;
    D.quad([xa, T, za], [xb, T, za], [xb, T, zb], [xa, T, zb], [0, 1, 0], K.top); wall([xa, za], [xa, zb], [-1, 0, 0]); wall([xb, za], [xb, zb], [1, 0, 0]);
    for (const [nb, dz, zz] of [[runs[j - 1], -1, za], [runs[j + 1], 1, zb]]) { const segs = nb ? [[r[0], Math.min(r[1], nb[0])], [Math.max(r[0], nb[1]), r[1]]] : [[r[0], r[1]]]; for (const [s0, s1] of segs) if (s1 > s0) wall([x0 + s0 * C, zz], [x0 + s1 * C, zz], [0, 0, dz]); } });
}
function blockMesh(D, map, b) {
  if (blocksOn) { blockMeshVox(D, map, b); return; }
  const cr = Math.cos(b.rot), sr = Math.sin(b.rot), avg = (b.rx + b.rz) / 2, q = 1 - 0.15 * b.cw / avg, K = BLK[b.tone], N = 56, T = b.T + 0.04;
  const pt = k => { const t = k / N * TAU, c = Math.cos(t), s = Math.sin(t), ux = q * Math.sign(c) * Math.cbrt(Math.abs(c)), uz = q * Math.sign(s) * Math.cbrt(Math.abs(s)); return [b.cx + ux * b.rx * cr - uz * b.rz * sr, b.cz + ux * b.rx * sr + uz * b.rz * cr]; };
  const P = []; for (let k = 0; k <= N; k++) P.push(pt(k % N));
  for (let k = 0; k < N; k++) { const a0 = P[k], a1 = P[k + 1], g = Math.min(footY(map, a0[0], a0[1]), footY(map, a1[0], a1[1])), mx = (a0[0] + a1[0]) / 2 - b.cx, mz = (a0[1] + a1[1]) / 2 - b.cz, ml = Math.sqrt(mx * mx + mz * mz) || 1, sh = (mx * 0.8 + mz * 0.55) / (ml * 0.97);
    const base = sh >= 0 ? mixc(K.face, 0xfffbe8, 0.3 * sh) : mixc(K.face, K.shade, Math.min(1, 0.25 - sh * 1.1));              // lit faces cream, shaded faces warm tan, never grey
    for (let y = g, i = 0; y < T - 0.01; i++) { const y1 = Math.min(T, (Math.floor(y / 1.2 + 1e-6) + 1) * 1.2); const bc = mixc(base, 0x000000, 1 - K.bands[((Math.floor(y / 1.2) % 3) + 3) % 3]); D.quad([a0[0], y, a0[1]], [a1[0], y, a1[1]], [a1[0], y1, a1[1]], [a0[0], y1, a0[1]], [mx, 0, mz], y < g + 1.5 ? mixc(bc, 0x5e3f22, 0.4) : bc); y = y1; if (i > 400) break; }
    D.tri([b.cx, T, b.cz], [a0[0], T, a0[1]], [a1[0], T, a1[1]], [0, 1, 0], K.top); }
  if (b.tone === 2) { let sd = b.seed + 7; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; }; const nsh = 4 + ((r() * 4) | 0); for (let k = 0; k < nsh; k++) { const ang = r() * TAU, rr = 0.2 + r() * 0.6, px = b.cx + (Math.cos(ang) * b.rx * rr) * cr - (Math.sin(ang) * b.rz * rr) * sr, pz = b.cz + (Math.cos(ang) * b.rx * rr) * sr + (Math.sin(ang) * b.rz * rr) * cr, wd = 1.2 + r() * 1.4; frustum(D, px, T - 0.05, pz, wd * 1.5, wd, wd * 1.1, wd * 0.8, wd * 0.5, r() * TAU, mixc(K.face, 0xffffff, 0.08 + r() * 0.12), K.top); } }       // low broad rubble on the top (each slab far wider than tall), no spikes
  const faces = [[1, 0, b.rx, b.rz], [-1, 0, b.rx, b.rz], [0, 1, b.rz, b.rx], [0, -1, b.rz, b.rx]];
  faces.forEach((f, fi) => {
    const [ax, az, ext, lat] = f, nx = ax * cr - az * sr, nz = ax * sr + az * cr, tx = -nz, tz = nx, edge = ext * q, px = b.cx + nx * edge, pz = b.cz + nz * edge, span = lat * 0.62, gy = groundAt(map, px + nx * 0.6, pz + nz * 0.6);
    if (b.tone !== 2 && (lat > 3.2 || (b.tone === 0 && fi < 2))) for (let k = -Math.floor(span / 1.15); k <= Math.floor(span / 1.15); k++) { const o = k * 1.15, cx = px + tx * o + nx * 0.03, cz = pz + tz * o + nz * 0.03, hw = 0.24, y = T - (b.tone ? 1.0 : 0.6); D.quad([cx - tx * hw, y - 0.18, cz - tz * hw], [cx + tx * hw, y - 0.18, cz + tz * hw], [cx + tx * hw, y + 0.18, cz + tz * hw], [cx - tx * hw, y + 0.18, cz - tz * hw], [nx, 0, nz], K.sl); }
    if (b.tone === 0 && fi === 3 && b.h >= 5) for (const o of [-lat * 0.35, lat * 0.35]) pane(D, K, px + tx * o, T - 2.6, pz + tz * o, tx, tz, nx, nz, 0.9, 1.1);
    if (b.door && fi === 2) { const cx = px, cz = pz, dh = Math.min(b.h * 0.6, 2.4), hw = 0.7;
      pane(D, K, cx, gy - 0.1, cz, tx, tz, nx, nz, hw * 2, dh);
      D.quad([cx - tx * (hw + 0.5), gy + dh + 0.12, cz - tz * (hw + 0.5)], [cx + tx * (hw + 0.5), gy + dh + 0.12, cz + tz * (hw + 0.5)], [cx + tx * (hw + 0.5), gy + dh + 0.55, cz + tz * (hw + 0.5)], [cx - tx * (hw + 0.5), gy + dh + 0.55, cz - tz * (hw + 0.5)], [nx, 0, nz], K.frame);
      const yaw = Math.atan2(tz, tx); for (let k = 0; k < 3; k++) { const d = 0.9 + k * 0.85, sx = px + nx * d, sz = pz + nz * d; frustum(D, sx, groundAt(map, sx, sz) - 0.25, sz, 1.25 - k * 0.1, 0.42, 1.2 - k * 0.1, 0.4, 0.25 + (2 - k) * 0.25, yaw, mixc(K.face, K.shade, 0.25), K.top); } }       // steps up to the door
    if (b.door && fi === 1) { const yaw = Math.atan2(nz, nx), ox = px + tx * lat * 0.55, oz = pz + tz * lat * 0.55; for (const [d0, len, h] of [[0.5, 2.4, 1.5], [3.7, 1.3, 0.8]]) { const cxx = ox + nx * (d0 + len / 2), czz = oz + nz * (d0 + len / 2); frustum(D, cxx, groundAt(map, cxx, czz) - 0.3, czz, len / 2, 0.3, len / 2 - 0.1, 0.25, h + 0.3, yaw, K.face, K.top); } }       // a low broken wall, attached
  });
}
// ---- the shop stall, twice the first size: a counter, four tall posts and a broad striped ochre awning that reads from 60 m, beside a ruin block
function stall(D, map, q) {
  const k = 2, y = groundAt(map, q.x, q.z), c = Math.cos(q.rot), sn = Math.sin(q.rot), P = (u, v) => [q.x + (u * c - v * sn) * k, q.z + (u * sn + v * c) * k], WOOD = 0xa9763f, W2 = 0x8c5f30;
  const cn = P(0, 0.6); frustum(D, cn[0], y - 0.2, cn[1], 1.2 * k, 0.45 * k, 1.2 * k, 0.45 * k, 1.3 * k, q.rot, WOOD, 0xc89458);
  for (const [u, v] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 1.0], [1.5, 1.0]]) { const pp = P(u, v); rod(D, [pp[0], y - 0.2, pp[1]], [pp[0], y + 5.6, pp[1]], 0.17, 0.15, 4, W2, true); }
  const aw = P(0, 0.1); frustum(D, aw[0], y + 5.5, aw[1], 1.95 * k, 1.55 * k, 1.8 * k, 1.3 * k, 0.28, q.rot, 0xdcae52, 0xe6c273);
  for (let j = -3; j <= 3; j += 2) { const st = P(j * 0.5, 0.1); frustum(D, st[0], y + 5.52, st[1], 0.22 * k, 1.56 * k, 0.22 * k, 1.31 * k, 0.3, q.rot, 0xf7ecd0, 0xf7ecd0); }
  for (const [u, v, h] of [[-1.0, 1.7, 0.7], [-0.2, 1.8, 0.5], [1.1, 1.75, 0.8]]) { const cr2 = P(u, v); frustum(D, cr2[0], y - 0.2, cr2[1], 0.35 * k, 0.35 * k, 0.33 * k, 0.33 * k, (h + 0.2) * k, q.rot + 0.3, 0x9c7040, 0xb98a55); }
}
// ---- beyond the line: big rock blocks (two stacked frusta, banded), a ruin piece (a broken wall slab and fallen blocks), small dead trees
const ROCKC = [[0xc98a4a, 0xdcae72], [0xd39a5a, 0xe3bd82], [0xbb7d41, 0xd29f66]];
function farRock(D, q) { const [x, y, z, w, h, rot, v] = q, c = ROCKC[v % 3]; frustum(D, x, y - 1, z, w * 0.55, w * 0.42, w * 0.48, w * 0.36, h * 0.62 + 1, rot, c[0], c[1]); frustum(D, x + Math.cos(rot) * w * 0.05, y + h * 0.62 - 1, z + Math.sin(rot) * w * 0.05, w * 0.4, w * 0.3, w * 0.34, w * 0.26, h * 0.38, rot, c[1], mixc(c[1], 0xffffff, 0.15)); }
function farRuin(D, q) { const [x, y, z, w, h, rot, v] = q, c = Math.cos(rot), s = Math.sin(rot), col = 0xd6b98a; frustum(D, x, y - 0.8, z, w * 0.5, 0.7, w * 0.46, 0.6, h + 0.8, rot, col, 0xe2c99c); frustum(D, x + c * w * 0.9, y - 0.5, z + s * w * 0.9, 1.2, 1.1, 1.1, 1.0, 1.3, rot + 0.5, col); frustum(D, x - s * 2.8, y - 0.5, z + c * 2.8, 0.9, 0.9, 0.8, 0.8, 0.9, rot + 1.2, 0xc9ab7c); }

// ---- a carved stone card half sunk in the sand: a pale slab with a darker inset panel on both faces and a worn top
function stoneCard(D, x, y, z, s, rot) { if (blockInto(D, 'stonecard', x, y - 0.4 * s, z, [2.7 * s, 4.4 * s, 0.5 * s], rot)) return; frustum(D, x, y - 1.3 * s, z, 1.35 * s, 0.16 * s, 1.25 * s, 0.13 * s, 4.4 * s, rot, 0xd8c8a8, 0xe6dac0); frustum(D, x, y - 0.2 * s, z, 0.95 * s, 0.19 * s, 0.85 * s, 0.17 * s, 2.6 * s, rot, 0xb39c78, 0xc8b490); frustum(D, x, y + 1.0 * s, z, 0.32 * s, 0.21 * s, 0.05 * s, 0.2 * s, 0.6 * s, rot, 0x8a7458); }
// ---- cracked salt on a dry lake: thin darker lines lying on the ground
function crack(D, map, pts) { for (let i = 0; i + 3 < pts.length; i += 2) { const x0 = pts[i], z0 = pts[i + 1], x1 = pts[i + 2], z1 = pts[i + 3], dx = x1 - x0, dz = z1 - z0, l = Math.sqrt(dx * dx + dz * dz) || 1, nx = -dz / l * 0.07, nz = dx / l * 0.07, y0 = groundAt(map, x0, z0) + 0.04, y1 = groundAt(map, x1, z1) + 0.04; D.quad([x0 - nx, y0, z0 - nz], [x0 + nx, y0, z0 + nz], [x1 + nx, y1, z1 + nz], [x1 - nx, y1, z1 - nz], [0, 1, 0], 0xb39a72); } }
// ---- a dormant seal stone: a low dark plinth with a dull gem on top (lit ones get a gold halo from the actors)
function sealStone(D, x, y, z) { if (blockInto(D, 'sealstone', x, y - 0.1, z, [1.3, 1.9, 1.3], 0.4)) return; frustum(D, x, y - 0.3, z, 0.75, 0.75, 0.55, 0.55, 1.6, 0.4, 0xc9a878, 0xd8bc8c); frustum(D, x, y + 1.3, z, 0.6, 0.6, 0.62, 0.62, 0.12, 0.4, 0xe0b24e); frustum(D, x, y + 1.42, z, 0.26, 0.26, 0.05, 0.05, 0.5, 1.2, 0xffd56a); }       // 1.4 m tall, a cap and a dull gem: it reads from the card at speed
// a Ring Shrine's ring rail: low carved posts holding a pale stone rail; a Gate Shrine's arch: two posts and a lintel, a gold band on the keystone
function ringRail(D, q) { const n = q.length; for (let i = 0; i < n; i++) { const a = q[i], b = q[(i + 1) % n]; rod(D, [a[0], a[1], a[2]], [b[0], b[1], b[2]], 0.16, 0.16, 5, [0xcfc3a8, 0xb6aa94], false, false, 0); if (i % 2 === 0) rod(D, [a[0], a[1] - 1.2, a[2]], [a[0], a[1], a[2]], 0.13, 0.11, 5, [0x8a7a68, 0x6a6058], false, false, 0); } }
function arch(D, q) { const [x, y, z, ux, uz] = q, px = -uz * 2.1, pz = ux * 2.1; for (const s of [1, -1]) rod(D, [x + px * s, y - 0.3, z + pz * s], [x + px * s, y + 3.4, z + pz * s], 0.42, 0.36, 6, [0xb6aa94, 0xa09580], true, false, 0); rod(D, [x + px * 1.15, y + 3.55, z + pz * 1.15], [x - px * 1.15, y + 3.55, z - pz * 1.15], 0.38, 0.38, 6, [0xcfc3a8, 0xb6aa94], true, true, 0); rod(D, [x, y + 3.2, z], [x, y + 3.95, z], 0.3, 0.3, 6, [0xe0b24e, 0xc9a24a], true, true, 0); }
// a full pipe: a giant carved card bent into a hoop and half buried, two pale bands with a gold edge and ribs across
function pipeHoop(D, q) { const [x, y, z, ux, uz, R] = q, px = -uz, pz = ux, N = 22, pt = (i, s) => { const t = i / N * 6.283185307179586, al = Math.sin(t) * R, up = R - Math.cos(t) * R; return [x + ux * al + px * s, y - 0.4 + up, z + uz * al + pz * s]; };
  for (let i = 0; i < N; i++) { for (const s of [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5]) rod(D, pt(i, s), pt(i + 1, s), 0.42, 0.42, 5, [0xe6dcc4, 0xcfc3a8], false, false, 0); for (const s of [1.9, -1.9]) rod(D, pt(i, s), pt(i + 1, s), 0.22, 0.22, 5, [0xe0b24e, 0xc9a24a], false, false, 0); }
  for (const side of [1, -1]) for (let k = 0; k < 9; k++) { const d = side * (R + 3 + k * 1.7), gx = x + ux * d, gz = z + uz * d; frustum(D, gx, y - 0.12, gz, 0.8, 0.8, 0.8, 0.8, 0.16, 0, 0x9a6a3c); } }       // a solid band of carved stone, gold edges, and a dark groove leading in from each side
// the block look (?blocks=1) for the park pieces: the same 0.06 m block grid, terracotta courses (a shade darker every fourth block), a gold top edge.
// The ramps are stepped in 6 cm steps; the card still rides the smooth sim surface (sim/ride.js), so they launch exactly as before.
const BK = 0.06, T1 = 0x9a6a4e, T2 = 0x8c5f45, TS = 0x80553f, TD = 0x6a4434, TG = 0xe0b24e;
const course = y => (Math.floor(y / (BK * 4)) % 2 ? T2 : T1);
// a stepped profile along u (unit ux, uz) across width w: steps[k] = [a0, a1, height] (heights rising), from base y0 at (x, z) = the start of the piece
function steppedPiece(D, x, y0, z, ux, uz, w, steps, backA, goldLast) {
  const px = -uz * w / 2, pz = ux * w / 2, at = (a, s, y) => [x + ux * a + px * s, y0 + y, z + uz * a + pz * s];
  steps.forEach(([a0, a1, h], k) => { const last = k === steps.length - 1, top = goldLast && last ? TG : course(h), hp = k ? steps[k - 1][2] : 0;
    D.quad(at(a0, -1, h), at(a1, -1, h), at(a1, 1, h), at(a0, 1, h), [0, 1, 0], top);       // the tread
    D.quad(at(a0, 1, hp), at(a0, -1, hp), at(a0, -1, h), at(a0, 1, h), [-ux, 0, -uz], goldLast && last ? TG : course(h));       // the riser
    D.quad(at(a0, 1, 0), at(a0, 1, h), at(a1, 1, h), at(a1, 1, 0), [px, 0, pz], TS); D.quad(at(a1, -1, 0), at(a1, -1, h), at(a0, -1, h), at(a0, -1, 0), [-px, 0, -pz], TS); });       // the two stepped sides
  const H = steps[steps.length - 1][2]; D.quad(at(backA, -1, 0), at(backA, -1, H), at(backA, 1, H), at(backA, 1, 0), [ux, 0, uz], TD);       // the back
}
function blockKicker(D, q) { const [x, y, z, ux, uz, len, w, h] = q, n = Math.max(1, Math.round(h / BK)), st = []; for (let k = 1; k <= n; k++) st.push([len * (k - 1) / n, len * k / n, k * BK]); steppedPiece(D, x - ux * len / 2, y - 0.2, z - uz * len / 2, ux, uz, w, st, len, true); }
function blockQuarter(D, map, q) { const [x, y, z, ux, uz, w] = q, Rr = 3.2, n = Math.round(Rr / BK), st = [], g0 = groundAt(map, x, z) - 0.2; let a = 0; for (let k = 1; k <= n; k++) { const hk = k * BK, a1 = Math.sqrt(Math.max(0, Rr * Rr - (Rr - hk) * (Rr - hk))); st.push([a, Math.max(a + 0.02, a1), hk]); a = Math.max(a + 0.02, a1); } steppedPiece(D, x, g0, z, ux, uz, w, st, a, true); }
function blockBar(D, a, b, half, gold, col) {       // a straight bar from a to b in its own frame (its top at a[1], b[1]), sides down into the ground, a gold top when it is ridden
  const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.sqrt(dx * dx + dz * dz) || 1, ux = dx / l, uz = dz / l, px = -uz * half, pz = ux * half, P = (p, s, y) => [p[0] + px * s, y, p[2] + pz * s];
  const ya = a[1], yb = b[1], la = ya - 0.6 - 2 * half, lb = yb - 0.6 - 2 * half, c = col || T1;
  D.quad(P(a, -1, ya), P(b, -1, yb), P(b, 1, yb), P(a, 1, ya), [0, 1, 0], gold ? TG : c);
  D.quad(P(a, 1, la), P(b, 1, lb), P(b, 1, yb), P(a, 1, ya), [px, 0, pz], c); D.quad(P(b, -1, lb), P(a, -1, la), P(a, -1, ya), P(b, -1, yb), [-px, 0, -pz], c);
  D.quad(P(a, 1, la), P(a, 1, ya), P(a, -1, ya), P(a, -1, la), [-ux, 0, -uz], TD); D.quad(P(b, -1, lb), P(b, -1, yb), P(b, 1, yb), P(b, 1, lb), [ux, 0, uz], TD);
}
// a map's own dressing kit (themes: dressing.kit, baked models): when set, the desert's cacti, dead trees, pots, spires and bones are drawn as the map's own props instead, picked by place
let KIT = null;
export function setDressKit(list, sites) { KIT = list && list.length ? list : null; SITES = sites && sites.length ? sites : null; }
let SITES = null;       // the map's structure models, by site index (gen W.sites)
// a themed map's palette: the built pieces (mesas, gate, rails, stalls, far rocks) were drawn in desert colours; each colour keeps its brightness and moves onto the map's ground ramp (lee, mid, lit), saturated accents a little less
let PAL = null;
export function setDressPalette(G) { PAL = G ? [G.lee, G.tintA, G.lit] : null; }
export function themeCol(c) { if (!PAL) return c; const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, l = (0.3 * r + 0.55 * g + 0.15 * b) / 255, mx = Math.max(r, g, b), sat = mx ? (mx - Math.min(r, g, b)) / mx : 0;
  const t = l < 0.5 ? mixc(PAL[0], PAL[1], l * 2) : mixc(PAL[1], PAL[2], (l - 0.5) * 2); return mixc(c, t, 0.85 - 0.35 * sat); }
function themeCols(col, from, skip) { for (let i = from; i < col.length; i += 3) { if (skip.some(s => i >= s[0] && i < s[1])) continue; const c = themeCol((Math.round(col[i] * 255) << 16) | (Math.round(col[i + 1] * 255) << 8) | Math.round(col[i + 2] * 255)); col[i] = ((c >> 16) & 255) / 255; col[i + 1] = ((c >> 8) & 255) / 255; col[i + 2] = (c & 255) / 255; } }
const kitAt = (x, z, salt) => KIT[(((Math.imul((x * 10) | 0, 73856093) ^ Math.imul((z * 10) | 0, 19349663) ^ salt) >>> 0) % KIT.length)];
function kitProp(D, x, y, z, salt) { const k = kitAt(x, z, salt); D.addModel(k.geo, x, y - 0.1, z, ((x * 7.31 + z * 3.17) % 6.283), k.s || 1); }
export function addDressing(D, map, ok) {
  D.plain = true;       // flat clean faces: no per-triangle colour jitter on built pieces
  const c0 = D.col ? D.col.length : 0, skip = []; if (PAL && D.col) { D.addModel = function (...a) { const s = this.col.length; Object.getPrototypeOf(this).addModel.apply(this, a); skip.push([s, this.col.length]); }; }       // kit models keep their own colours
  const d = map.dress || {}, yes = ok || (() => true);
  for (const q of d.pipes || []) if (yes(q[0], q[2])) pipeHoop(D, q);
  for (const q of d.rings || []) if (yes(q[0][0], q[0][2])) ringRail(D, q);
  for (const q of d.arches || []) if (yes(q[0], q[2])) arch(D, q);
  for (const q of d.seals || []) if (yes(q[0], q[2])) { if (q[3] === -2) { frustum(D, q[0], q[1] - 0.3, q[2], 0.4, 0.4, 0.26, 0.26, 2.6, 0.4, 0xcfc3a8, 0xb6aa94); frustum(D, q[0], q[1] + 2.3, q[2], 0.34, 0.34, 0.06, 0.06, 0.55, 0.8, 0xe0b24e); } else sealStone(D, q[0], q[1], q[2]); }       // set -2: a Bowl Shrine's marker stone, not a seal
  for (const q of d.spires || []) if (yes(q[0], q[2]) && !blockInto(D, 'spire', q[0], q[1] - 0.2, q[2], [2.2, (q[4] || 9) + 0.4, 2.2], 0)) { const top = q[4] || 9; frustum(D, q[0], q[1] - 0.4, q[2], 0.42, 0.42, 0.05, 0.05, top + 0.4, 0.3, 0xcfc3a8, 0xe6dcc4); rod(D, [q[0], q[1] + q[3] - 0.15, q[2]], [q[0], q[1] + q[3] + 0.15, q[2]], 0.55, 0.55, 8, [0xe0b24e, 0xc9a24a], true, true, 0); frustum(D, q[0], q[1] + top - 0.2, q[2], 0.12, 0.12, 0.01, 0.01, 0.9, 0.8, 0xe0b24e); }       // the needle: pale stone, a gold band at 2.6 m, a gold tip
  // park lines (strip-back, 27 Nov): plain data-driven shapes with flat faces, one sandstone tone per face and one gold edge, so they can be swapped for block-built pieces later
  const SAND = 0xc87a4e, SAND_S = 0xb56a43, SAND_D = 0xa65f3c, GOLD = [0xffd56a, 0xe0b24e];       // terracotta, with lighter side shades (never near black), so a line reads against the sand at 40 m without looking pasted on
  if (blocksOn) { for (const q of d.kickers || []) if (yes(q[0], q[2])) blockKicker(D, q); for (const q of d.quarters || []) if (yes(q[0], q[2])) blockQuarter(D, map, q);
    for (const q of d.ledges || []) if (yes(q[0], q[2])) { const h = q[6]; blockBar(D, [q[0], q[1] + h, q[2]], [q[3], q[4] + h, q[5]], 0.6, true); blockBar(D, [q[0], q[1] + h + BK, q[2]], [q[3], q[4] + h + BK, q[5]], 0.12, true); }
    for (const q of d.poles || []) if (yes(q[0], q[2])) { blockBar(D, [q[0], q[1], q[2]], [q[3], q[4], q[5]], 0.18, true); const n = Math.max(2, Math.round(Math.hypot(q[3] - q[0], q[5] - q[2]) / 6)); for (let k = 0; k <= n; k++) { const f = k / n, x = q[0] + (q[3] - q[0]) * f, z = q[2] + (q[5] - q[2]) * f, top = q[1] + (q[4] - q[1]) * f - 0.36; frustum(D, x, groundAt(map, x, z) - 0.3, z, 0.24, 0.24, 0.24, 0.24, Math.max(0.2, top - groundAt(map, x, z) + 0.3), 0, TD); } } }       // the block look: stepped kickers and quarter pipes, ledges and rails as block bars with a gold top
  else for (const q of d.kickers || []) if (yes(q[0], q[2])) { const [x, y, z, ux, uz, len, w, h] = q, px = -uz * w / 2, pz = ux * w / 2, ax = x - ux * len / 2, az = z - uz * len / 2, bx = x + ux * len / 2, bz = z + uz * len / 2, y0 = y - 0.2;
    const sink = (cx, cz) => Math.min(y0, groundAt(map, cx, cz) - 0.35), A = [ax + px, sink(ax + px, az + pz), az + pz], B = [ax - px, sink(ax - px, az - pz), az - pz], Cc = [bx - px, y0 + h, bz - pz], Dd = [bx + px, y0 + h, bz + pz], E = [bx - px, sink(bx - px, bz - pz), bz - pz], F = [bx + px, sink(bx + px, bz + pz), bz + pz];       // every base corner sits into the sand, whatever the slope
    D.quad(A, B, Cc, Dd, [-ux * h, len, -uz * h], SAND); D.quad(Dd, Cc, E, F, [ux, 0, uz], SAND_D); D.tri(A, Dd, F, [px, 0, pz], SAND_S); D.tri(B, Cc, E, [-px, 0, -pz], SAND_S);
    rod(D, [bx + px, y0 + h + 0.05, bz + pz], [bx - px, y0 + h + 0.05, bz - pz], 0.17, 0.17, 6, GOLD, true, true, 0); }       // a kicker: a plain wedge, one gold lip
  if (!blocksOn) for (const q of d.ledges || []) if (yes(q[0], q[2])) { const [ax, ay, az, bx, by, bz, h] = q; rod(D, [ax, ay - 0.3, az], [bx, by - 0.3, bz], (h + 0.25) * 0.72, (h + 0.25) * 0.72, 4, [SAND, SAND_S], true, true, 0.785); rod(D, [ax, ay + h, az], [bx, by + h, bz], 0.11, 0.11, 5, GOLD, true, true, 0); }       // a ledge: a plain block, a gold grind edge
  if (!blocksOn) for (const q of d.poles || []) if (yes(q[0], q[2])) { const [ax, ay, az, bx, by, bz] = q; rod(D, [ax, ay - 0.3, az], [bx, by - 0.3, bz], 0.36, 0.36, 4, [SAND, SAND_S], true, true, 0.785); rod(D, [ax, ay + 0.02, az], [bx, by + 0.02, bz], 0.09, 0.09, 5, GOLD, true, true, 0);
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 6)); for (let k = 0; k <= n; k++) { const f = k / n, x = ax + (bx - ax) * f, z = az + (bz - az) * f, top = ay + (by - ay) * f - 0.4; frustum(D, x, groundAt(map, x, z) - 0.3, z, 0.3, 0.3, 0.3, 0.3, Math.max(0.2, top - groundAt(map, x, z) + 0.3), 0, SAND_D); } }       // a rail: one thick stone bar on square posts, a gold top edge
  if (!blocksOn) for (const q of d.quarters || []) if (yes(q[0], q[2])) { const [x, y, z, ux, uz, w] = q, px = -uz * w / 2, pz = ux * w / 2, R = 3.2, g0 = groundAt(map, x, z) - 0.2, N = 6, P = k => { const a = k / N * 1.5707963, o = Math.sin(a) * R, hh = R - Math.cos(a) * R; return [x + ux * o, g0 + hh, z + uz * o]; };       // a quarter pipe: a plain curved stone wall, one gold coping
    for (let k = 0; k < N; k++) { const a = P(k), b = P(k + 1); D.quad([a[0] + px, a[1], a[2] + pz], [a[0] - px, a[1], a[2] - pz], [b[0] - px, b[1], b[2] - pz], [b[0] + px, b[1], b[2] + pz], [-ux, 1 - k / N, -uz], SAND); D.quad([a[0] + px, g0, a[2] + pz], [a[0] + px, a[1], a[2] + pz], [b[0] + px, b[1], b[2] + pz], [b[0] + px, g0, b[2] + pz], [px, 0, pz], SAND_D); D.quad([b[0] - px, g0, b[2] - pz], [b[0] - px, b[1], b[2] - pz], [a[0] - px, a[1], a[2] - pz], [a[0] - px, g0, a[2] - pz], [-px, 0, -pz], SAND_D); }
    const t = P(N); D.quad([t[0] + px, g0, t[2] + pz], [t[0] - px, g0, t[2] - pz], [t[0] - px, t[1], t[2] - pz], [t[0] + px, t[1], t[2] + pz], [ux, 0, uz], SAND_D); rod(D, [t[0] + px, t[1] + 0.05, t[2] + pz], [t[0] - px, t[1] + 0.05, t[2] - pz], 0.16, 0.16, 6, GOLD, true, true, 0); }
  if (!KIT) for (const q of d.rspires || []) if (yes(q[0], q[2])) { const [x, y, z, h, w, a] = q; frustum(D, x, y - 0.5, z, w, w * 0.8, w * 0.35, w * 0.3, h * 0.65, a, 0x7a5236, 0x8a6040); frustum(D, x + 0.2, y + h * 0.6, z, w * 0.4, w * 0.35, w * 0.08, w * 0.06, h * 0.4, a + 0.5, 0x8a6040, 0x9a7050); }       // a ridge spine's umber rock spire
  if (!KIT) for (const q of d.bones || []) if (yes(q[0], q[2])) { const [x, y, z, a, s] = q, ca = Math.cos(a), sa = Math.sin(a); rod(D, [x - ca * 1.6 * s, y + 0.15, z - sa * 1.6 * s], [x + ca * 1.6 * s, y + 0.25, z + sa * 1.6 * s], 0.18 * s, 0.14 * s, 5, [0xf0e8d4, 0xdcd8ce], true, true, 0); for (let k = -2; k <= 2; k++) { const bx = x + ca * k * 0.6 * s, bz = z + sa * k * 0.6 * s; rod(D, [bx, y + 0.2, bz], [bx - sa * 1.1 * s, y + 0.9 * s, bz + ca * 1.1 * s], 0.07 * s, 0.05 * s, 4, [0xf0e8d4, 0xdcd8ce], true, false, 0); } }       // a dry lake's bleached bones
  for (const q of d.lips || []) if (yes(q[0], q[2])) { rod(D, [q[0], q[1] - 0.1, q[2]], [q[3], q[4] - 0.1, q[5]], 0.45, 0.45, 6, [0x5a4030, 0x4a3426], true, true, 0); for (const [x, y, z] of [[q[0], q[1], q[2]], [q[3], q[4], q[5]]]) { frustum(D, x, y - 0.3, z, 0.8, 0.8, 0.4, 0.4, 10, 0.4, 0xe6dcc4, 0xf3ead6); for (const hb of [3.2, 6.4, 8.6]) rod(D, [x, y + hb, z], [x, y + hb + 0.5, z], 0.62, 0.55, 8, [0xe0b24e, 0xc9a24a], true, true, 0); frustum(D, x, y + 9.6, z, 0.45, 0.45, 0.05, 0.05, 1.6, 0.8, 0xffd56a); } }       // a great drop's lip: a dark carved edge across it and a marker stone at each end
  for (const q of d.cards || []) if (yes(q[0], q[2])) stoneCard(D, q[0], q[1], q[2], q[3], q[4]);
  for (const q of d.cracks || []) if (yes(q[0], q[1])) crack(D, map, q);
  if (KIT) { for (const q of d.cacti || []) if (yes(q[0], q[2])) kitProp(D, q[0], q[1], q[2], 1); for (const q of d.dead || []) if (yes(q[0], q[2])) kitProp(D, q[0], q[1], q[2], 2); }       // the map's own props
  else { for (const q of d.cacti || []) if (yes(q[0], q[2])) cactus(D, q[0], q[1], q[2], q[3], q[4], q[5]);
  for (const q of d.dead || []) if (yes(q[0], q[2])) deadTree(D, q[0], q[1], q[2], q[3], q[4], q[5], false); }
  for (const q of d.logs || []) if (yes(q[0], q[2])) log(D, map, q);
  if (!KIT) for (const q of d.pots || []) if (yes(q[0], q[2])) pot(D, q[0], q[1], q[2], q[3], q[4], q[5]);
  for (const q of d.heads || []) if (yes(q.x, q.z)) monument(D, q);
  if (yes(map.gate.x, map.gate.z)) gateway(D, map);
  for (const q of d.stalls || []) if (yes(q.x, q.z)) stall(D, map, q);
  for (const b of map.blocks || []) if (yes(b.cx, b.cz)) blockMesh(D, map, b);
  const f = map.far || {};
  for (const q of f.rocks || []) if (yes(q[0], q[2])) farRock(D, q);
  for (const q of f.dead || []) if (yes(q[0], q[2])) deadTree(D, q[0], q[1], q[2], q[3], q[4], q[5], true);
  for (const q of f.ruins || []) if (yes(q[0], q[2])) farRuin(D, q);
  if (SITES) for (const s of map.sites || []) if (yes(s.x, s.z)) { const k = SITES[s.i % SITES.length]; if (k) D.addModel(k.geo, s.x, groundAt(map, s.x, s.z) - 0.25, s.z, s.yaw, 1); }       // each structure stands on its pad, sunk 25 cm so no gap shows under it
  if (PAL && D.col) { delete D.addModel; themeCols(D.col, c0, skip); }
}
void vnoise;
