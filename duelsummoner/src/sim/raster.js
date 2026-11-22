// Pure rasteriser for map primitives: the one definition of "how tall is the ground here", shared by the live terrain (terrain.js)
// and the stage generator (src/gen) so both see exactly the same map. No module state.
import { atan2, cos, sin } from './dmath.js';

export const WALL = 99;
const DEG = Math.PI / 180;

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

function bounds(p) {
  if (p.t === 'box') {
    if (p.rot) {                                          // bounding box of the rotated rectangle
      const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, hw = (p.x1 - p.x0) / 2, hd = (p.z1 - p.z0) / 2;
      const c = cos(p.rot * DEG), s = sin(p.rot * DEG), ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
      return [cx - ex, cx + ex, cz - ez, cz + ez];
    }
    return [p.x0, p.x1, p.z0, p.z1];
  }
  if (p.t === 'ramp') {
    const lo = Math.min(p.a0, p.a1), hi = Math.max(p.a0, p.a1);
    return p.axis === 'x' ? [lo, hi, p.b0, p.b1] : [p.b0, p.b1, lo, hi];
  }
  if (p.t === 'ring') return [p.cx - p.r1, p.cx + p.r1, p.cz - p.r1, p.cz + p.r1];
  return [p.x - p.r, p.x + p.r, p.z - p.r, p.z + p.r];
}

// Fills grid (N x N, 1 m cells, origin -half) from prims: tallest primitive wins; outside boundaryR is WALL.
export function rasterizeInto(grid, N, HALF, prims, boundaryR) {
  grid.fill(0);
  for (const p of prims) {
    if (p.deco) continue;
    const [x0, x1, z0, z1] = bounds(p);
    const ia = Math.max(0, Math.floor(x0 + HALF)), ib = Math.min(N - 1, Math.floor(x1 + HALF - 1e-6));
    const ja = Math.max(0, Math.floor(z0 + HALF)), jb = Math.min(N - 1, Math.floor(z1 + HALF - 1e-6));
    for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
      const h = primHeight(p, i - HALF + 0.5, j - HALF + 0.5);
      if (h > 0 && h > grid[j * N + i]) grid[j * N + i] = h;
    }
  }
  const R2 = boundaryR * boundaryR;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = i - HALF + 0.5, z = j - HALF + 0.5; if (x * x + z * z > R2) grid[j * N + i] = WALL; }
  return grid;
}
