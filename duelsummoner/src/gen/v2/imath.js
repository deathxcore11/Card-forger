// Integer math helpers. Values are integer-valued; any Number arithmetic here stays exact (< 2^53).
import { hash32 } from './seed.js';

export function isqrt(n) { // floor(sqrt(n)) for 0 <= n < 2^52, integer Newton
  if (n <= 0) return 0;
  if (n < 4) return 1;
  let x = n, y = Math.floor((x + 1) / 2);
  // start from a power-of-two estimate for speed
  let b = 1; while (b * b <= n) b *= 2; x = b; y = Math.floor((x + Math.floor(n / x)) / 2);
  while (y < x) { x = y; y = Math.floor((x + Math.floor(n / x)) / 2); }
  return x;
}
export const isqrt32 = isqrt;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerpInt = (a, b, t, den) => a + Math.trunc(((b - a) * t) / den);
export const idiv = (a, b) => Math.trunc(a / b);
export const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const idist = (ax, az, bx, bz) => isqrt(dist2(ax, az, bx, bz));

// Smooth 2D value noise, integer in/out. Returns -1024..1024. wl = wavelength in cells.
function lattice(ix, iz, seed) { return (hash32((Math.imul(ix, 0x27D4EB2D) ^ Math.imul(iz, 0x165667B1) ^ seed) >>> 0) & 2047) - 1024; }
export function valueNoise2(x, z, seed, wl) {
  const gx = Math.floor(x / wl), gz = Math.floor(z / wl);
  const fx = x - gx * wl, fz = z - gz * wl;
  const w3 = wl * wl * wl;
  const sx = Math.trunc((fx * fx * (3 * wl - 2 * fx) * 1024) / w3);
  const sz = Math.trunc((fz * fz * (3 * wl - 2 * fz) * 1024) / w3);
  const a = lattice(gx, gz, seed), b = lattice(gx + 1, gz, seed);
  const c = lattice(gx, gz + 1, seed), d = lattice(gx + 1, gz + 1, seed);
  const ab = a + ((b - a) * sx >> 10), cd = c + ((d - c) * sx >> 10);
  return ab + ((cd - ab) * sz >> 10);
}
export function valueNoise1(x, seed, wl) {
  const g = Math.floor(x / wl), f = x - g * wl;
  const s = Math.trunc((f * f * (3 * wl - 2 * f) * 1024) / (wl * wl * wl));
  const a = lattice(g, 7, seed), b = lattice(g + 1, 7, seed);
  return a + ((b - a) * s >> 10);
}

// Integer Catmull-Rom over control points [[x,z],...] (cm). Returns polyline [[x,z],...] with `steps` per span.
export function catmullRomInt(pts, steps = 8) {
  const out = [];
  const n = pts.length;
  if (n < 2) return pts.slice();
  const P = (i) => pts[i < 0 ? 0 : i >= n ? n - 1 : i];
  const S = steps, S2 = S * S, S3 = S2 * S;
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < S; k++) {
      const o = [0, 0];
      for (let c = 0; c < 2; c++) {
        const a = 2 * p1[c] * S3, b = (-p0[c] + p2[c]) * k * S2;
        const cc = (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * k * k * S;
        const d = (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * k * k * k;
        o[c] = Math.trunc((a + b + cc + d) / (2 * S3));
      }
      out.push(o);
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

// Pseudo-angle 0..511 (monotonic around the circle, no trig).
export function pseudoAngle(dx, dz) {
  if (dx === 0 && dz === 0) return 0;
  const ax = Math.abs(dx), az = Math.abs(dz);
  // within first octant-pair: p in [0,128) per quadrant
  let p = ax >= az ? Math.trunc((az * 64) / ax) : 128 - Math.trunc((ax * 64) / az);
  if (dx >= 0 && dz >= 0) return p;
  if (dx < 0 && dz >= 0) return 256 - p;
  if (dx < 0 && dz < 0) return 256 + p;
  return (512 - p) & 511;
}
// Compass sector 0..7 from an integer offset.
export const sector8 = (dx, dz) => (pseudoAngle(dx, dz) + 32) >> 6 & 7;

// 16 unit directions * 1000 (fixed table, no trig).
export const DIR16 = [[1000, 0], [924, 383], [707, 707], [383, 924], [0, 1000], [-383, 924], [-707, 707], [-924, 383],
  [-1000, 0], [-924, -383], [-707, -707], [-383, -924], [0, -1000], [383, -924], [707, -707], [924, -383]];
export const DIR8 = [[1000, 0], [707, 707], [0, 1000], [-707, 707], [-1000, 0], [-707, -707], [0, -1000], [707, -707]];

/* Binary min-heap on integer keys (Number, exact). */
export class Heap {
  constructor(cap = 1024) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2); k.set(this.k); this.k = k; const v = new Int32Array(this.v.length * 2); v.set(this.v); this.v = v; }
    let i = this.n++; const K = this.k, V = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] < key || (K[p] === key && V[p] <= val)) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = key; V[i] = val;
  }
  pop() { // returns val; key in this.lastKey
    const K = this.k, V = this.v; const top = V[0]; this.lastKey = K[0];
    const n = --this.n; if (n === 0) return top;
    const key = K[n], val = V[n]; let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= n) break;
      if (c + 1 < n && (K[c + 1] < K[c] || (K[c + 1] === K[c] && V[c + 1] < V[c]))) c++;
      if (K[c] > key || (K[c] === key && V[c] >= val)) break;
      K[i] = K[c]; V[i] = V[c]; i = c;
    }
    K[i] = key; V[i] = val; return top;
  }
}

// Two-pass chamfer distance transform (10 orth / 14 diag) from seed cells (src[i]=1). Returns Int32Array.
export function chamfer(N, src, cap = 1 << 29) {
  const d = new Int32Array(N * N);
  for (let i = 0; i < N * N; i++) d[i] = src[i] ? 0 : cap;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; let v = d[i];
    if (x > 0 && d[i - 1] + 10 < v) v = d[i - 1] + 10;
    if (z > 0) {
      if (d[i - N] + 10 < v) v = d[i - N] + 10;
      if (x > 0 && d[i - N - 1] + 14 < v) v = d[i - N - 1] + 14;
      if (x < N - 1 && d[i - N + 1] + 14 < v) v = d[i - N + 1] + 14;
    }
    d[i] = v;
  }
  for (let z = N - 1; z >= 0; z--) for (let x = N - 1; x >= 0; x--) {
    const i = z * N + x; let v = d[i];
    if (x < N - 1 && d[i + 1] + 10 < v) v = d[i + 1] + 10;
    if (z < N - 1) {
      if (d[i + N] + 10 < v) v = d[i + N] + 10;
      if (x < N - 1 && d[i + N + 1] + 14 < v) v = d[i + N + 1] + 14;
      if (x > 0 && d[i + N - 1] + 14 < v) v = d[i + N - 1] + 14;
    }
    d[i] = v;
  }
  return d;
}

// Disc offsets for radius r (cells), sorted by (d2, dz, dx).
const discCache = new Map();
export function discOffsets(r) {
  if (discCache.has(r)) return discCache.get(r);
  const o = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r) o.push([dx, dz]);
  o.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]) || a[1] - b[1] || a[0] - b[0]);
  discCache.set(r, o);
  return o;
}

