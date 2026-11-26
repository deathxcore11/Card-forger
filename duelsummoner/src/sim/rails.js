// Grindable edges of the big desert, as straight segments [ax, ay, az, bx, by, bz] (y is the top of the edge): the half-sunk beams and logs, the top edge of every carved stone card, and the top rims of the mesas and ruin blocks.
// Built per 256 m cell from the same seeded dressing and blocks the view draws (so what you see is what you can grind), cached for the run.
import { cos, sin } from './dmath.js';
import { cbrt } from '../gen/open/terrain.js';
const Q = 256;
function cellRails(m, qx, qz) {
  const out = [], D = m.dressCell(qx, qz), C = m.cell(qx, qz);
  // one log in five is drawn as a standing broken post (view/openDressing.js): no rail along the ground there
  for (const q of D.logs || []) { if (q[7] !== 3 && ((Math.floor(q[0] * 7 + q[2] * 13) % 5) + 5) % 5 === 0) continue; const rad = q[6]; out.push([q[0], q[1] + rad * 1.1 + 0.15, q[2], q[3], q[4] + rad * 1.1 + 0.15, q[5]]); }
  for (const q of D.cards || []) { const [x, y, z, s, rot] = q, c = cos(rot), sn = sin(rot), hw = 1.25 * s, top = y + 3.1 * s; out.push([x - c * hw, top, z - sn * hw, x + c * hw, top, z + sn * hw, 'card', x, z]); }       // a card's rail remembers its card (it lights when ground)
  for (const b of C.blocks || []) {
    const N = 16, q = 1 - 0.15 * b.cw / ((b.rx + b.rz) / 2), pts = [];
    for (let k = 0; k < N; k++) { const t = k / N * 6.283185307179586, ct = cos(t), st = sin(t), cr = Math.sign(ct) * cbrt(Math.abs(ct)), sr = Math.sign(st) * cbrt(Math.abs(st)), ux = q * cr * b.rx, uz = q * sr * b.rz; pts.push([b.cx + ux * b.cr - uz * b.sr, b.cz + ux * b.sr + uz * b.cr]); }
    for (let k = 0; k < N; k++) { const a = pts[k], bb = pts[(k + 1) % N]; out.push([a[0], b.T, a[1], bb[0], b.T, bb[1]]); }
  }
  for (const q of D.rings || []) { const n = q.length; let cx = 0, cz = 0; for (const p of q) { cx += p[0] / n; cz += p[2] / n; } for (let i = 0; i < n; i++) { const a = q[i], b = q[(i + 1) % n]; out.push([a[0], a[1], a[2], b[0], b[1], b[2], 'ring', cx, cz]); } }       // a Ring Shrine's rail remembers its shrine's centre
  out.seals = (D.seals || []).filter(q => q[3] !== -2); out.pipes = (D.pipes || []).slice();
  return out;
}
function cellOf(g, m, qx, qz) { const cache = g.railCache && g.railCache.key === m.key ? g.railCache : (g.railCache = { key: m.key, cells: new Map() }), k = (qx + 128) * 512 + (qz + 128); let L = cache.cells.get(k); if (!L) { L = cellRails(m, qx, qz); cache.cells.set(k, L); } return L; }
// the seal stones [x, y, z, setId] within r of (x, z)
export function sealsNear(g, x, z, r) {
  const m = g.map; if (!m || !m.big) return []; const out = [];
  for (let qz = Math.floor((z - r) / Q); qz <= Math.floor((z + r) / Q); qz++) for (let qx = Math.floor((x - r) / Q); qx <= Math.floor((x + r) / Q); qx++) for (const s of cellOf(g, m, qx, qz).seals || []) { const dx = s[0] - x, dz = s[2] - z; if (dx * dx + dz * dz < r * r) out.push(s); }
  return out;
}
// the full pipes [x, y, z, ux, uz, R] within r of (x, z)
export function pipesNear(g, x, z, r) { const m = g.map; if (!m || !m.big) return []; const out = [], M = r + 24; for (let qz = Math.floor((z - M) / Q); qz <= Math.floor((z + M) / Q); qz++) for (let qx = Math.floor((x - M) / Q); qx <= Math.floor((x + M) / Q); qx++) for (const s of cellOf(g, m, qx, qz).pipes || []) { const dx = s[0] - x, dz = s[2] - z; if (dx * dx + dz * dz < r * r) out.push(s); } return out; }
// every seal stone of one set (they all sit in the set's own cell)
export function sealSet(g, sid) { if (sid === -1) { const W = g.map.world, w = W && W.wonder; if (!w) return []; const out = []; for (const s of w.seals) for (const q of cellOf(g, g.map, Math.floor(s[0] / Q), Math.floor(s[1] / Q)).seals || []) if (q[3] === -1 && Math.abs(q[0] - s[0]) < 0.02 && Math.abs(q[2] - s[1]) < 0.02) out.push(q); return out; }       // the wonder: its five stones span cells
  const m = g.map, k = Math.floor(sid / 4), qx = Math.floor(k / 512) - 128, qz = (k % 512) - 128; return (cellOf(g, m, qx, qz).seals || []).filter(s => s[3] === sid); }
export function railsNear(g, x, z, r) {
  const m = g.map; if (!m || !m.big) return []; const cache = g.railCache && g.railCache.key === m.key ? g.railCache : (g.railCache = { key: m.key, cells: new Map() }), out = [];
  for (let qz = Math.floor((z - r) / Q); qz <= Math.floor((z + r) / Q); qz++) for (let qx = Math.floor((x - r) / Q); qx <= Math.floor((x + r) / Q); qx++) {
    const L = cellOf(g, m, qx, qz);
    for (const s of L) { const lo = Math.min(s[0], s[3]) - r, hi = Math.max(s[0], s[3]) + r, lz = Math.min(s[2], s[5]) - r, hz = Math.max(s[2], s[5]) + r; if (x >= lo && x <= hi && z >= lz && z <= hz) out.push(s); }
  }
  return out;
}
