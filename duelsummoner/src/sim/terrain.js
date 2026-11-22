// Collision heightfield: the map primitives rasterised at 1 m. heightAt(x,z) is the standing height there.
import { MAP, PRIMS } from '../data/map.js';

import { rasterizeInto, primHeight, WALL } from './raster.js';
export { primHeight, WALL };

const HALF = MAP.half, N = HALF * 2;
const grid = new Float32Array(N * N);
let currentKey = '';

// Loads a map's primitives into the collision grid. The live terrain is one global: the sim checks mapKey() each tick and reloads if needed.
export function loadMap(map) { rasterizeInto(grid, N, HALF, map.prims, MAP.boundaryR); currentKey = map.key; }
export const mapKey = () => currentKey;
loadMap({ key: 'classic', prims: PRIMS });

export function heightAt(x, z) {
  const i = Math.floor(x + HALF), j = Math.floor(z + HALF);
  if (i < 0 || j < 0 || i >= N || j >= N) return WALL;
  return grid[j * N + i];
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

// Move a body horizontally. Each axis is tested separately so walls are slid along.
// A point is walkable if its surface is at most stepUp above the body's feet.
export function moveXZ(o, dx, dz, radius, stepUp) {
  let blocked = 0;
  if (dx !== 0) {
    const nx = o.x + dx, probe = nx + (dx > 0 ? radius : -radius);
    if (heightAt(probe, o.z) <= o.y + stepUp) o.x = nx; else blocked |= 1;
  }
  if (dz !== 0) {
    const nz = o.z + dz, probe = nz + (dz > 0 ? radius : -radius);
    if (heightAt(o.x, probe) <= o.y + stepUp) o.z = nz; else blocked |= 2;
  }
  return blocked;
}

