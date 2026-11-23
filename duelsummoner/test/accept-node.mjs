// Acceptance checks that can run in Node (geometry only). Usage: node test/accept-node.mjs seed...
import { Game } from '../src/sim/game.js'; import { heightAt } from '../src/sim/terrain.js'; import { roadPath, roadDist } from '../src/gen/road.js'; import { scatterStage } from '../src/gen/scatter.js';
const seeds = process.argv.slice(2).map(Number), out = [];
for (const seed of seeds) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael' }), m = g.map, L = g.colliders.list, road = roadPath(m), S = scatterStage(m, 0, false), sp = m.spawn, gt = m.gate, R = {};
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), trees = L.filter(c => c.top - c.y > 8 && c.r < 1.0), rocks = L.filter(c => !(c.top - c.y > 8 && c.r < 1.0)), hero = rocks.filter(c => c.top - c.y >= 4.5);
  // 4 gate seal visible from 95% of walkable 2 m cells: ray from the cell (1.7 m up) to the seal at 80 m, against prims of 10 m or more and hero landmarks (axis-aligned boxes; trees and rotation ignored)
  const boxes = m.prims.filter(p => p.t === 'box' && (p.h >= 10 || p.landmark) && !(p.deco && !p.landmark)).map(p => ({ x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, y0: p.y0 || 0, y1: p.h }));
  let cells = 0, seen = 0; for (let x = -190; x <= 190; x += 2) for (let z = -190; z <= 190; z += 2) { if (x * x + z * z > 190 * 190 || heightAt(x, z) > 0.6) continue; cells++;
    let blocked = false; for (const b of boxes) { for (let t = 0.02; t < 0.98 && !blocked; t += 0.02) { const px = x + (gt.x - x) * t, pz = z + (gt.z - z) * t, py = 1.7 + (80 - 1.7) * t; if (px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1 && py > b.y0 && py < b.y1) blocked = true; } if (blocked) break; } if (!blocked) seen++; }
  R.c4_sealVisibleFromCells = (100 * seen / cells).toFixed(1) + '% of ' + cells;
  // 5 heights
  const lm = m.prims.filter(p => p.landmark), tops = {}; for (const p of lm) { const key = Math.round((p.x0 !== undefined ? (p.x0 + p.x1) / 2 : p.x) / 40) + ':' + Math.round((p.z0 !== undefined ? (p.z0 + p.z1) / 2 : p.z) / 40); tops[key] = Math.max(tops[key] || 0, p.h); }
  R.c5_sealM = 90; R.c5_districtHeroTops = Object.values(tops).map(v => +v.toFixed(1)).join(','); R.c5_tallestTree = +Math.max(...trees.map(t => t.top - t.y)).toFixed(1);
  // 6 trees
  let minT = 1e9; for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) minT = Math.min(minT, dist(trees[i], trees[j])); const cell = new Map(); for (const t of trees) { const k = Math.floor(t.x / 10) * 4096 + Math.floor(t.z / 10); cell.set(k, (cell.get(k) || 0) + 1); }
  // 80% of road samples with 6-10 trees within 50 m
  let rs = 0, rok = 0; for (let i = 1; i < road.main.length; i++) { const a = road.main[i - 1], b = road.main[i]; for (let t = 0; t < 1; t += 0.25) { const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; rs++; const n = trees.filter(q => Math.hypot(q.x - x, q.z - z) < 50).length; if (n >= 6 && n <= 10) rok++; } }
  R.c6 = { total: trees.length, minTrunk: +minT.toFixed(1), maxPerCell: Math.max(...cell.values()), within24: trees.filter(t => dist(t, sp) < 24).length, roadSamples6to10: (100 * rok / rs).toFixed(0) + '%' };
  // 7 gaps, 8 heights
  let bad = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const d = dist(L[i], L[j]) - L[i].r - L[j].r; if (d > 0.9 && d < 3.0) bad++; } R.c7_badGaps = bad;
  const hts = L.map(c => c.top - c.y); R.c8 = { solidsBetween04and12: hts.filter(v => v > 0.4 && v < 1.2).length, solidsNearRoad: L.filter(c => roadDist(road, c.x, c.z) < 2.25 + 1.5 + c.r - 0.01).length };
  // 10 rocks
  let minH = 1e9; for (let i = 0; i < hero.length; i++) for (let j = i + 1; j < hero.length; j++) minH = Math.min(minH, dist(hero[i], hero[j])); R.c10 = { hero: hero.length, minHeroSpacing: +minH.toFixed(0), heroFromRoad: +Math.min(...hero.map(h => roadDist(road, h.x, h.z) - h.r)).toFixed(0), lowTall: rocks.length - hero.length, pebbleMaxH: +Math.max(...S.rocks.flat().filter(r => r[3] < 1).map(r => 1.3 * (r[6] || r[3]))).toFixed(2) };
  // 11 empty space: 4 m raster over walkable ground, nearest feature of 1.5 m or more (trees, rocks, tall prims)
  const feat = [...S.bushes.filter(b => b[3] >= 1.5).map(b => [b[0], b[2]]), ...L.filter(c => c.top - c.y >= 1.5).map(c => [c.x, c.z]), ...m.prims.filter(p => p.t === 'box' && p.h >= 1.5).map(p => [(p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2]), ...m.prims.filter(p => p.t === 'cyl' && p.h >= 1.5).map(p => [p.x, p.z])];
  let pts = 0, far = 0; for (let x = -185; x <= 185; x += 4) for (let z = -185; z <= 185; z += 4) { if (x * x + z * z > 185 * 185) continue; pts++; let best = 1e9; for (const f of feat) { const d = Math.hypot(f[0] - x, f[1] - z); if (d < best) best = d; } if (best > 12.5) far++; } R.c11_pointsOver12_5m = (100 * far / pts).toFixed(1) + '%';
  // 17 road width and continuity
  R.c17 = { width: road.width, trails: road.trails.length, mainPoints: road.main.length, reachesGate: Math.hypot(road.main.at(-1)[0] - gt.x, road.main.at(-1)[1] - gt.z) < 1 }; 
  // 18 grass
  R.c18 = { clumps: S.grass.length, maxHeight: +Math.max(...S.grass.map(r => 0.4 * r[3])).toFixed(2) };
  out.push({ seed, ...R });
}
console.log(JSON.stringify(out, null, 1));

