// Solid scenery. A tree trunk and a big boulder are round pillars the duelist cannot walk through: they slide along them. Small rocks, bushes, grass and flowers are not solid.
// The places come from the same pure scatter the view draws, so what you see is exactly what you hit. Deterministic, no allocation per tick.
import { scatterStage } from '../gen/scatter.js';

const CELL = 8, TRUNK_R = 0.55, TRUNK_TOP = 10, ROCK_R = 1.0, ROCK_MIN = 1.0, ROCK_TOP = 1.25;   // landmark scale: a tree is 9-16 m with a trunk 1.4-2.4 m wide, a rock 2-6 m wide; nothing smaller is solid
export function buildColliders(map, stageIndex) {
  if (map.big) {       // the streamed world: the solid props of each 256 m cell join the list when something first looks at that cell
    const list = [], grid = new Map(), have = new Set(), add = (x, y, z, r, top, deck) => { const c = { x, y, z, r, top: y + top, deck: !!deck }, k = Math.floor(x / CELL) * 4096 + Math.floor(z / CELL); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); list.push(c); };
    const ensure = (x0, z0, x1, z1) => { for (let qz = Math.floor(z0 / 256); qz <= Math.floor(z1 / 256); qz++) for (let qx = Math.floor(x0 / 256); qx <= Math.floor(x1 / 256); qx++) { const k = (qx + 128) * 512 + (qz + 128); if (have.has(k)) continue; have.add(k); for (const q of map.dressCell(qx, qz).solid) add(q[0], q[1], q[2], q[3], q[4], q[5]); } };
    return { list, grid, CELL, ensure, big: true };
  }
  const S = scatterStage(map, stageIndex, true), list = [], grid = new Map();
  const add = (x, y, z, r, top) => { const c = { x, y, z, r, top: y + top }, k = Math.floor(x / CELL) * 4096 + Math.floor(z / CELL); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); list.push(c); };
  for (const v of S.trees) for (const t of v) add(t[0], t[1], t[2], TRUNK_R * t[3], TRUNK_TOP * t[3]);
  for (const v of S.rocks) for (const r of v) if (r[3] >= ROCK_MIN) add(r[0], r[1], r[2], ROCK_R * r[3], ROCK_TOP * (r[6] || r[3]));
  for (const q of map.solid || []) add(q[0], q[1], q[2], q[3], q[4]);                       // the open desert's cacti, dead trees and carved head: x, y, z, radius, height
  return { list, grid, CELL };
}
// push o (x, z, y, vx, vz) out of any collider within radius, keeping the speed along the surface so the duelist slides round instead of stopping dead
export function resolveColliders(col, o, radius) {
  if (!col) return;
  for (let pass = 0; pass < 2; pass++) {
    const i0 = Math.floor((o.x - radius - 3) / CELL), i1 = Math.floor((o.x + radius + 3) / CELL), j0 = Math.floor((o.z - radius - 3) / CELL), j1 = Math.floor((o.z + radius + 3) / CELL);
    let moved = false;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = col.grid.get(i * 4096 + j); if (!a) continue;
      for (let n = 0; n < a.length; n++) {
        const c = a[n]; if ((c.top - c.y < 2.2 || c.deck) && o.y > c.top - 0.15) continue;       // a carved stone card is a deck: above its top edge (riding over or grinding it) it does not push                          // above a low rock (jumping over it): not blocked; a cactus, a trunk or the head is always solid, so a jump cannot land on top of one: the duelist slides off
        const dx = o.x - c.x, dz = o.z - c.z, rr = c.r + radius, d2 = dx * dx + dz * dz; if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4, nx = d2 > 1e-8 ? dx / d : 1, nz = d2 > 1e-8 ? dz / d : 0, push = rr - d + 0.001;
        o.x += nx * push; o.z += nz * push; moved = true;
        const vn = o.vx * nx + o.vz * nz; if (vn < 0) { o.vx -= vn * nx; o.vz -= vn * nz; }
      }
    }
    if (!moved) break;
  }
}
