// Grindable edges of the big desert, as straight segments [ax, ay, az, bx, by, bz] (y is the top of the edge): the half-sunk beams and logs, the top edge of every carved stone card, and the top rims of the mesas and ruin blocks.
// Built per 256 m cell from the same seeded dressing and blocks the view draws (so what you see is what you can grind), cached for the run.
import { cos, sin } from './dmath.js';
import { cbrt } from '../gen/open/terrain.js';
const Q = 256;
function cellRails(m, qx, qz) {
  const out = [], D = m.dressCell(qx, qz), C = m.cell(qx, qz);
  for (const q of D.logs || []) { const rad = q[6]; out.push([q[0], q[1] + rad * 1.1 + 0.15, q[2], q[3], q[4] + rad * 1.1 + 0.15, q[5]]); }
  for (const q of D.cards || []) { const [x, y, z, s, rot] = q, c = cos(rot), sn = sin(rot), hw = 1.25 * s, top = y + 3.1 * s; out.push([x - c * hw, top, z - sn * hw, x + c * hw, top, z + sn * hw]); }
  for (const b of C.blocks || []) {
    const N = 16, q = 1 - 0.15 * b.cw / ((b.rx + b.rz) / 2), pts = [];
    for (let k = 0; k < N; k++) { const t = k / N * 6.283185307179586, ct = cos(t), st = sin(t), cr = Math.sign(ct) * cbrt(Math.abs(ct)), sr = Math.sign(st) * cbrt(Math.abs(st)), ux = q * cr * b.rx, uz = q * sr * b.rz; pts.push([b.cx + ux * b.cr - uz * b.sr, b.cz + ux * b.sr + uz * b.cr]); }
    for (let k = 0; k < N; k++) { const a = pts[k], bb = pts[(k + 1) % N]; out.push([a[0], b.T, a[1], bb[0], b.T, bb[1]]); }
  }
  return out;
}
export function railsNear(g, x, z, r) {
  const m = g.map; if (!m || !m.big) return []; const cache = g.railCache && g.railCache.key === m.key ? g.railCache : (g.railCache = { key: m.key, cells: new Map() }), out = [];
  for (let qz = Math.floor((z - r) / Q); qz <= Math.floor((z + r) / Q); qz++) for (let qx = Math.floor((x - r) / Q); qx <= Math.floor((x + r) / Q); qx++) {
    const k = (qx + 128) * 512 + (qz + 128); let L = cache.cells.get(k); if (!L) { L = cellRails(m, qx, qz); cache.cells.set(k, L); }
    for (const s of L) { const lo = Math.min(s[0], s[3]) - r, hi = Math.max(s[0], s[3]) + r, lz = Math.min(s[2], s[5]) - r, hz = Math.max(s[2], s[5]) + r; if (x >= lo && x <= hi && z >= lz && z <= hz) out.push(s); }
  }
  return out;
}
