// Collision heightfield: the map primitives rasterised at 1 m. heightAt(x,z) is the standing height there.
import { MAP, PRIMS } from '../data/map.js';
import { atan2, cos, sin } from './dmath.js';

export const WALL = 99;
const HALF = MAP.half, N = HALF * 2;
const grid = new Float32Array(N * N);

const DEG = Math.PI / 180;
function put(ix, iz, h) { if (h > grid[iz * N + ix]) grid[iz * N + ix] = h; }

function rasterise(p) {
  if (p.deco) return;
  let x0, x1, z0, z1;
  if (p.t === 'box') {
    if (p.rot) {                                          // bounding box of the rotated rectangle
      const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, hw = (p.x1 - p.x0) / 2, hd = (p.z1 - p.z0) / 2;
      const c = cos(p.rot * DEG), s = sin(p.rot * DEG), ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
      x0 = cx - ex; x1 = cx + ex; z0 = cz - ez; z1 = cz + ez;
    } else { x0 = p.x0; x1 = p.x1; z0 = p.z0; z1 = p.z1; }
  } else if (p.t === 'ramp') {
    const lo = Math.min(p.a0, p.a1), hi = Math.max(p.a0, p.a1);
    if (p.axis === 'x') { x0 = lo; x1 = hi; z0 = p.b0; z1 = p.b1; } else { z0 = lo; z1 = hi; x0 = p.b0; x1 = p.b1; }
  } else if (p.t === 'ring') { x0 = p.cx - p.r1; x1 = p.cx + p.r1; z0 = p.cz - p.r1; z1 = p.cz + p.r1; }
  else { x0 = p.x - p.r; x1 = p.x + p.r; z0 = p.z - p.r; z1 = p.z + p.r; }
  const ia = Math.max(0, Math.floor(x0 + HALF)), ib = Math.min(N - 1, Math.floor(x1 + HALF - 1e-6));
  const ja = Math.max(0, Math.floor(z0 + HALF)), jb = Math.min(N - 1, Math.floor(z1 + HALF - 1e-6));
  for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
    const x = i - HALF + 0.5, z = j - HALF + 0.5;
    const h = primHeight(p, x, z);
    if (h > 0) put(i, j, h);
  }
}

export function primHeight(p, x, z) {
  switch (p.t) {
    case 'box': {
      if (p.rot) {
        const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, c = cos(-p.rot * DEG), s = sin(-p.rot * DEG);
        const dx = x - cx, dz = z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c;
        return Math.abs(lx) <= (p.x1 - p.x0) / 2 && Math.abs(lz) <= (p.z1 - p.z0) / 2 ? p.h : 0;
      }
      return x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 ? p.h : 0;
    }
    case 'ramp': {
      const a = p.axis === 'x' ? x : z, b = p.axis === 'x' ? z : x;
      if (b < p.b0 || b > p.b1) return 0;
      const t = (a - p.a0) / (p.a1 - p.a0);
      if (t < 0 || t > 1) return 0;
      return p.h0 + (p.h1 - p.h0) * t;
    }
    case 'ring': {
      const dx = x - p.cx, dz = z - p.cz, r = Math.sqrt(dx * dx + dz * dz);
      if (r < p.r0 || r > p.r1) return 0;
      let a = atan2(dz, dx) / DEG; if (a < 0) a += 360;
      return a >= p.a0 && a <= p.a1 ? p.h : 0;
    }
    default: {
      const dx = x - p.x, dz = z - p.z;
      return dx * dx + dz * dz <= p.r * p.r ? p.h : 0;
    }
  }
}

PRIMS.forEach(rasterise);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = i - HALF + 0.5, z = j - HALF + 0.5;
  if (x * x + z * z > MAP.boundaryR * MAP.boundaryR) grid[j * N + i] = WALL;
}

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

