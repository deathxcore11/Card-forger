// Builds the player / enemy graphs and the derived distance fields that placement and validation share.
import { F, NONE } from './map.js';
import { buildPlayerGraph, buildEnemyGraph, BASE, ANY, L } from './links.js';
import { dijkstra, bfsReach, reverseCSR, INF } from './nav.js';

export function analyze(m) {
  const N = m.N; const sc = Math.floor(m.spawn.z / 100) * N + Math.floor(m.spawn.x / 100);
  let eg = buildEnemyGraph(m); let enemy = bfsReach(eg, [sc * 2], 1 << L.WALK);
  // clutter pass: tiny walkable pockets that neither enemies nor chunks own become rubble
  const seen = new Uint8Array(N * N); let changed = 0;
  for (let i = 0; i < N * N; i++) {
    if (seen[i] || !(m.flags[i] & F.WALK) || enemy[i * 2] || (m.flags[i] & (F.CHUNK | F.PONLY))) continue;
    const comp = [i]; seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k], x = c % N, z = (c / N) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue; const j = zz * N + xx;
        if (!seen[j] && (m.flags[j] & F.WALK) && !enemy[j * 2] && !(m.flags[j] & (F.CHUNK | F.PONLY))) { seen[j] = 1; comp.push(j); }
      }
    }
    if (comp.length < 16) for (const c of comp) { m.flags[c] = (m.flags[c] | F.SOLID) & ~F.WALK; changed++; }
  }
  if (changed) { eg = buildEnemyGraph(m); enemy = bfsReach(eg, [sc * 2], 1 << L.WALK); }
  const A = build(m, eg, enemy);
  A.rubble = changed;
  return A;
}

export function build(m, eg0, enemy0) {
  const N = m.N;
  const pg = buildPlayerGraph(m);
  const prev = reverseCSR(pg);
  const sc = Math.floor(m.spawn.z / 100) * N + Math.floor(m.spawn.x / 100);
  const spawnNode = sc * 2;
  const sp = dijkstra(pg, [spawnNode], BASE, INF, true);
  const reachAny = bfsReach(pg, [spawnNode], ANY);
  const canReturn = bfsReach(prev, [spawnNode], BASE);
  const walkReach = bfsReach(pg, [spawnNode], (1 << L.WALK) | (1 << L.DROP));
  const eg = eg0 || buildEnemyGraph(m);
  const enemy = enemy0 || bfsReach(eg, [spawnNode], 1 << L.WALK);
  const spineNodes = (m.spine?.path || []).map((c) => c * 2);
  const spd = spineNodes.length ? dijkstra(pg, spineNodes, BASE, INF, true) : { dist: new Int32Array(pg.n).fill(INF), par: new Int32Array(pg.n).fill(-1) };
  return { pg, prev, eg, spawnNode, spawnCell: sc, dSpawn: sp.dist, parSpawn: sp.par, reachAny, canReturn, walkReach, enemy, dSpine: spd.dist, parSpine: spd.par };
}

export const nodeOf = (m, x, z, layer = 0) => (z * m.N + x) * 2 + layer;
export const reachable = (A, node) => A.dSpawn[node] < INF;

