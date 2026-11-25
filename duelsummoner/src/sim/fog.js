// Fog of war. The kingdom is a grid of cells; a cell is explored once the duelist has come within sight of it. High ground sees further (a rooftop or a ridge scouts a wide
// circle), so climbing is also scouting. The mask is run state: it lives in the sim, it is the same on every machine for the same inputs, and it resets with each stage.
import { MAP } from '../data/map.js';

export const FOG_N = 64;
// The big world: 8 m cells in tiles of 32 x 32 (256 m, the same cells the generator places things in), made when first seen. f.added lists the cells seen since the view last drew them (only while the view asks, f.track).
export const FOG_CELL = 8, FOG_TILE = 32;
export const makeFogBig = () => ({ big: true, n: 0, tiles: new Map(), count: 0, version: 0, track: false, added: [], bb: [1e9, 1e9, -1e9, -1e9] });
export const tileKey = (tx, tz) => (tx + 128) * 512 + (tz + 128);
export const makeFog = () => ({ n: FOG_N, cells: new Uint8Array(FOG_N * FOG_N), count: 0, version: 0 });
// radius in metres: 30 on the ground, 1.6 metres further for every metre of height, never more than 80
export const sightRadius = y => Math.min(80, 30 + 1.6 * Math.max(0, y));
export function revealFog(g) {
  const f = g.fog; if (!f) return;
  if (f.big) return revealBig(g, f); const p = g.p, half = MAP.half, cell = half * 2 / f.n, r = sightRadius(p.y), r2 = r * r;
  const i0 = Math.max(0, Math.floor((p.x - r + half) / cell)), i1 = Math.min(f.n - 1, Math.floor((p.x + r + half) / cell)), j0 = Math.max(0, Math.floor((p.z - r + half) / cell)), j1 = Math.min(f.n - 1, Math.floor((p.z + r + half) / cell));
  let added = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = -half + (i + 0.5) * cell - p.x, cz = -half + (j + 0.5) * cell - p.z, k = j * f.n + i;
    if (!f.cells[k] && cx * cx + cz * cz <= r2) { f.cells[k] = 1; added++; }
  }
  if (added) { f.count += added; f.version++; }
}
export const exploredAt = (f, x, z) => { if (!f) return true; if (f.big) { const gx = Math.floor(x / FOG_CELL), gz = Math.floor(z / FOG_CELL), t = f.tiles.get(tileKey(Math.floor(gx / FOG_TILE), Math.floor(gz / FOG_TILE))); return !!t && t[(gz - Math.floor(gz / FOG_TILE) * FOG_TILE) * FOG_TILE + (gx - Math.floor(gx / FOG_TILE) * FOG_TILE)] === 1; } const cell = MAP.half * 2 / f.n, i = Math.floor((x + MAP.half) / cell), j = Math.floor((z + MAP.half) / cell); return i >= 0 && j >= 0 && i < f.n && j < f.n && f.cells[j * f.n + i] === 1; };
function revealBig(g, f) {
  const p = g.p, r = sightRadius(p.y), r2 = r * r, C = FOG_CELL, T = FOG_TILE;
  const i0 = Math.floor((p.x - r) / C), i1 = Math.floor((p.x + r) / C), j0 = Math.floor((p.z - r) / C), j1 = Math.floor((p.z + r) / C); let added = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = (i + 0.5) * C - p.x, cz = (j + 0.5) * C - p.z; if (cx * cx + cz * cz > r2) continue;
    const tx = Math.floor(i / T), tz = Math.floor(j / T), key = tileKey(tx, tz); let t = f.tiles.get(key); if (!t) { t = new Uint8Array(T * T); f.tiles.set(key, t); }
    const k = (j - tz * T) * T + (i - tx * T); if (t[k]) continue; t[k] = 1; added++; if (f.track) f.added.push(i, j);
  }
  if (added) { f.count += added; f.version++; const b = f.bb; b[0] = Math.min(b[0], (i0 + 0.5) * C); b[1] = Math.min(b[1], (j0 + 0.5) * C); b[2] = Math.max(b[2], (i1 + 0.5) * C); b[3] = Math.max(b[3], (j1 + 0.5) * C); }
}
