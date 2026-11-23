// Fog of war. The kingdom is a grid of cells; a cell is explored once the duelist has come within sight of it. High ground sees further (a rooftop or a ridge scouts a wide
// circle), so climbing is also scouting. The mask is run state: it lives in the sim, it is the same on every machine for the same inputs, and it resets with each stage.
import { MAP } from '../data/map.js';

export const FOG_N = 64;
export const makeFog = () => ({ n: FOG_N, cells: new Uint8Array(FOG_N * FOG_N), count: 0, version: 0 });
// radius in metres: 30 on the ground, 1.6 metres further for every metre of height, never more than 80
export const sightRadius = y => Math.min(80, 30 + 1.6 * Math.max(0, y));
export function revealFog(g) {
  const f = g.fog; if (!f) return; const p = g.p, half = MAP.half, cell = half * 2 / f.n, r = sightRadius(p.y), r2 = r * r;
  const i0 = Math.max(0, Math.floor((p.x - r + half) / cell)), i1 = Math.min(f.n - 1, Math.floor((p.x + r + half) / cell)), j0 = Math.max(0, Math.floor((p.z - r + half) / cell)), j1 = Math.min(f.n - 1, Math.floor((p.z + r + half) / cell));
  let added = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = -half + (i + 0.5) * cell - p.x, cz = -half + (j + 0.5) * cell - p.z, k = j * f.n + i;
    if (!f.cells[k] && cx * cx + cz * cz <= r2) { f.cells[k] = 1; added++; }
  }
  if (added) { f.count += added; f.version++; }
}
export const exploredAt = (f, x, z) => { if (!f) return true; const cell = MAP.half * 2 / f.n, i = Math.floor((x + MAP.half) / cell), j = Math.floor((z + MAP.half) / cell); return i >= 0 && j >= 0 && i < f.n && j < f.n && f.cells[j * f.n + i] === 1; };
