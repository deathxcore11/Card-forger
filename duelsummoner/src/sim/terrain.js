// Collision heightfield: the map primitives rasterised at 1 m. heightAt(x,z) is the standing height there.
import { MAP, PRIMS } from '../data/map.js';

import { rasterizeInto, primHeight, WALL } from './raster.js';
export { primHeight, WALL };

const HALF = MAP.half, N = HALF * 2;
const grid = new Float32Array(N * N), SLX = new Float32Array(N * N), SLZ = new Float32Array(N * N), PB = new Float32Array(N * N), LO = new Float32Array(N * N), HI = new Float32Array(N * N), SL = { x: SLX, z: SLZ, pb: PB, lo: LO, hi: HI };
let currentKey = '';

// Loads a map's primitives into the collision grid. The live terrain is one global: the sim checks mapKey() each tick and reloads if needed.
export function loadMap(map) {
  if (map.heights) { grid.set(map.heights); SLX.fill(0); SLZ.fill(0); PB.fill(0); LO.fill(0); HI.fill(0); currentKey = map.key; return; }       // a designed (v2) map is already a heightfield: 1 m cells, no ramp slopes inside a cell
  rasterizeInto(grid, N, HALF, map.prims, MAP.boundaryR, SL); currentKey = map.key;
}
export const mapKey = () => currentKey;
loadMap({ key: 'classic', prims: PRIMS });

export function heightAt(x, z) {
  const i = Math.floor(x + HALF), j = Math.floor(z + HALF);
  if (i < 0 || j < 0 || i >= N || j >= N) return WALL;
  const k = j * N + i, h = grid[k], sx = SLX[k], sz = SLZ[k];
  if (sx === 0 && sz === 0) return h;
  const v = PB[k] + sx * (x - (i - HALF + 0.5)) + sz * (z - (j - HALF + 0.5));       // a ramp cell is the ramp's own sloped surface, clamped to the ramp's heights
  return v < LO[k] ? LO[k] : v > HI[k] ? HI[k] : v;
}
// How fast the ground rises in the direction (ax, az) at a point: 0 on the flat, the ramp's slope on a ramp. A wide body leading up a ramp has its front edge this much higher than its centre.
function riseAlong(x, z, ax, az) {
  const i = Math.floor(x + HALF), j = Math.floor(z + HALF); if (i < 0 || j < 0 || i >= N || j >= N) return 0;
  const k = j * N + i, r = SLX[k] * ax + SLZ[k] * az; return r > 0 ? r : 0;
}
// Coarse cells for enemy pathing: height at the centre of each cell.
export function buildCells(size) {
  const n = Math.floor(N / size), h = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {                // a cell is as tall as its tallest 1 m sample
    const x = i * size - HALF, z = j * size - HALF; let m = 0;
    for (let a = 0.5; a < size; a += 1) for (let b = 0.5; b < size; b += 1) m = Math.max(m, heightAt(x + a, z + b));
    h[j * n + i] = m;
  }
  return { n, size, h };
}

// Move a body horizontally. Each axis is tested separately so walls are slid along, in sub-steps of at most 0.5 m so a fast move (a dash) cannot skip a thin wall.
// A point is walkable if its surface is at most stepUp above the body's feet, plus the rise a ramp makes over the body's own radius: the front edge of a wide body on a slope is
// higher than its centre by radius x slope, and without that allowance a body of radius 1.2 m or more could not climb a 1:2 ramp at all. The limit is measured from o.y at the start.
const SUB = 0.5;
export function moveXZ(o, dx, dz, radius, stepUp) {
  let blocked = 0; const len = Math.sqrt(dx * dx + dz * dz), n = len > SUB ? Math.ceil(len / SUB) : 1, sx = dx / n, sz = dz / n; let stopX = dx === 0, stopZ = dz === 0;
  const y0 = o.y;
  for (let k = 0; k < n; k++) {
    if (!stopX) {
      const nx = o.x + sx, dir = sx > 0 ? 1 : -1, probe = nx + dir * radius, ph = heightAt(probe, o.z);
      if (ph <= y0 + stepUp || ph <= y0 + stepUp + radius * Math.max(riseAlong(o.x, o.z, dir, 0), riseAlong(probe, o.z, dir, 0))) o.x = nx; else { blocked |= 1; stopX = true; }
    }
    if (!stopZ) {
      const nz = o.z + sz, dir = sz > 0 ? 1 : -1, probe = nz + dir * radius, ph = heightAt(o.x, probe);
      if (ph <= y0 + stepUp || ph <= y0 + stepUp + radius * Math.max(riseAlong(o.x, o.z, 0, dir), riseAlong(o.x, probe, 0, dir))) o.z = nz; else { blocked |= 2; stopZ = true; }
    }
  }
  return blocked;
}


