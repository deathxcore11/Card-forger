// Player-only islands: enemy-unreachable walkable groups that sit >= 2.5 m above nearby enemy ground
// (outside melee reach), grouped by adjacency plus base player links.
import { F, los } from './map.mjs';
import { L, BASE } from './links.mjs';
import { INF } from './nav.mjs';

export function findIslands(m, A, spec) {
  const N = m.N, h = m.h0; const pg = A.pg;
  const un = (c) => (m.flags[c] & F.WALK) && !A.enemy[c * 2] && A.reachAny[c * 2];
  const grp = new Int32Array(N * N).fill(-1); const groups = [];
  for (let i = 0; i < N * N; i++) {
    if (grp[i] >= 0 || !un(i)) continue;
    const g = { id: groups.length, cells: [], connector: false };
    const st = [i]; grp[i] = g.id;
    while (st.length) {
      const c = st.pop(); g.cells.push(c); const x = c % N, z = (c / N) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue; const j = zz * N + xx;
        if (grp[j] < 0 && un(j) && Math.abs(h[j] - h[c]) <= 70) { grp[j] = g.id; st.push(j); }
      }
      const u = c * 2;
      for (let e = pg.off[u]; e < pg.off[u + 1]; e++) {
        const v = pg.to[e] >> 1; const k = pg.cls[e];
        if (!((BASE >> k) & 1)) continue;
        if (A.enemy[pg.to[e]] && k === L.WALK) g.connector = true;
        if (grp[v] < 0 && un(v) && k !== L.DROP) { grp[v] = g.id; st.push(v); }
      }
    }
    groups.push(g);
  }
  const islands = []; const cellIsland = new Int16Array(N * N).fill(-1);
  for (const g of groups) {
    if (g.connector) continue;
    let elevated = false;
    for (const c of g.cells) {
      const x = c % N, z = (c / N) | 0; let mx = -32768;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue; const j = zz * N + xx; if (A.enemy[j * 2] && h[j] > mx) mx = h[j]; }
      if (mx > -32768 && h[c] - mx >= 250) { elevated = true; break; }
    }
    if (!elevated) continue;
    // perches: 8-adjacent pieces of similar height
    const pid = new Map(); const perches = [];
    const inG = new Set(g.cells);
    for (const c of g.cells.slice().sort((a, b) => a - b)) {
      if (pid.has(c)) continue; const st = [c]; pid.set(c, perches.length); let area = 0;
      while (st.length) { const q = st.pop(); area++; const x = q % N, z = (q / N) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const j = (z + dz) * N + x + dx; if (inG.has(j) && !pid.has(j) && Math.abs(h[j] - h[q]) <= 70) { pid.set(j, perches.length); st.push(j); } } }
      perches.push(area);
    }
    const id = islands.length;
    for (const c of g.cells) cellIsland[c] = id;
    // seer perch: enemy-reachable cell within 25 m with a clear line to an island cell
    let seer = INF, flyer = INF;
    const sample = g.cells.filter((_, k) => k % 7 === 0).slice(0, 12);
    for (const c of sample) {
      const x = c % N, z = (c / N) | 0;
      for (let dz = -spec.islands.seerDist; dz <= spec.islands.seerDist; dz += 2) for (let dx = -spec.islands.seerDist; dx <= spec.islands.seerDist; dx += 2) {
        const d2 = dx * dx + dz * dz; if (d2 > spec.islands.seerDist ** 2) continue; const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue;
        const j = zz * N + xx; if (!A.enemy[j * 2]) continue;
        const d = isq(d2);
        if (d < flyer && !(m.flags[j] & F.DECK)) flyer = d;
        if (d < seer && los(m, xx, zz, h[j] + 170, x, z, h[c] + 50)) seer = d;
      }
    }
    islands.push({ id, area: g.cells.length, perchMax: Math.max(...perches), perches: perches.length, seerDist: seer, flyerDist: flyer, cell: g.cells[0] });
  }
  return { islands, cellIsland };
}
function isq(n) { let x = n, y = (x + 1) >> 1; if (n < 2) return n; while (y < x) { x = y; y = (x + Math.trunc(n / x)) >> 1; } return x; }
