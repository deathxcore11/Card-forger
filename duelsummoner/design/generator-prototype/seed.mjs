// Seal Codes, seed derivation and deterministic random streams.
// Integer-only: Math.imul and >>> 0. No unseeded randomness anywhere in the generator.

export const GEN_VERSION = 2; // v2: arc-checked jumps, seeded silhouettes, winding spine, landmarks, spread encounters
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function splitmix32(x) {
  x = (x + 0x9E3779B9) >>> 0;
  let z = x;
  z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
  z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
  return (z ^ (z >>> 16)) >>> 0;
}

export function fnv1a32(str) {
  let h = 0x811C9DC5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) & 0xFF;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function fnv1a32Ints(arr) {
  let h = 0x811C9DC5;
  for (let i = 0; i < arr.length; i++) {
    let v = arr[i] | 0;
    for (let b = 0; b < 4; b++) { h ^= v & 0xFF; h = Math.imul(h, 0x01000193); v >>>= 8; }
  }
  return h >>> 0;
}

// Low-bias integer hash, used for tie-breaks and lattice noise.
export function hash32(x) {
  x = x >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D);
  x ^= x >>> 15; x = Math.imul(x, 0x846CA68B);
  x ^= x >>> 16;
  return x >>> 0;
}

/* ---------- Seal Code (8 Crockford base32 chars = 40 bits) ---------- */
function get5(hi, lo, pos) {
  if (pos >= 32) return (hi >>> (pos - 32)) & 31;
  if (pos + 5 <= 32) return (lo >>> pos) & 31;
  return ((lo >>> pos) | (hi << (32 - pos))) & 31;
}

export function encodeSeal(hi, lo) {
  let s = '';
  for (let k = 0; k < 8; k++) s += ALPHA[get5(hi & 0xFF, lo >>> 0, 35 - 5 * k)];
  return s;
}

export function decodeSeal(code) {
  const c = String(code).toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
  if (c.length !== 8) throw new Error('Seal Code must be 8 characters');
  let hi = 0, lo = 0;
  for (let k = 0; k < 8; k++) {
    const v = ALPHA.indexOf(c[k]);
    if (v < 0) throw new Error('bad Seal Code character ' + c[k]);
    // shift the 40-bit value left by 5 and add v
    hi = ((hi << 5) | (lo >>> 27)) & 0xFF;
    lo = ((lo << 5) | v) >>> 0;
  }
  return { hi, lo };
}

// A plain integer seed (CLI --seed N) maps to hi = 0, lo = N.
export function sealFromSeed(n) { return encodeSeal(0, n >>> 0); }

export function stageSeedOf(hi, lo, stage) {
  return splitmix32((lo ^ Math.imul(hi + 1, 0x85EBCA6B) ^ Math.imul(stage + 1, 0x9E3779B9) ^ GEN_VERSION) >>> 0);
}
export function attemptSeedOf(stageSeed, attempt) {
  return splitmix32((stageSeed + Math.imul(attempt, 0x632BE5AB)) >>> 0);
}

/* ---------- xoshiro128** ---------- */
function rotl(x, k) { return ((x << k) | (x >>> (32 - k))) >>> 0; }

export class Rng {
  constructor(seed) {
    let x = seed >>> 0;
    const s = new Uint32Array(4);
    for (let i = 0; i < 4; i++) { x = (x + 0x9E3779B9) >>> 0; s[i] = splitmix32(x - 0x9E3779B9 >>> 0); }
    if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 1;
    this.s = s;
  }
  next() {
    const s = this.s;
    const r = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return r;
  }
  int(n) { // unbiased 0..n-1
    if (n <= 1) return 0;
    const lim = 0x100000000 - (0x100000000 % n);
    let r = this.next();
    while (r >= lim) r = this.next();
    return r % n;
  }
  range(a, b) { return a + this.int(b - a + 1); }
  chance(pct) { return this.int(100) < pct; }
  pick(arr) { return arr[this.int(arr.length)]; }
  pickWeighted(items, key) {
    let tot = 0;
    for (const it of items) tot += Math.max(0, key ? it[key] : it.w) | 0;
    if (tot <= 0) return items.length ? items[0] : null;
    let r = this.int(tot);
    for (const it of items) { r -= Math.max(0, key ? it[key] : it.w) | 0; if (r < 0) return it; }
    return items[items.length - 1];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
}

// Stream seeding exactly per spec: four successive splitmix32 outputs from attemptSeed ^ fnv1a32(name).
export function rngFor(attemptSeed, name) {
  const r = new Rng(0);
  let x = (attemptSeed ^ fnv1a32(name)) >>> 0;
  for (let i = 0; i < 4; i++) { r.s[i] = splitmix32(x); x = (x + 0x9E3779B9) >>> 0; }
  if ((r.s[0] | r.s[1] | r.s[2] | r.s[3]) === 0) r.s[0] = 1;
  return r;
}

export const STEPS = ['districts', 'regions', 'graph', 'tiers', 'terrain', 'chunks', 'scatter', 'encounters', 'events', 'repair'];
export function makeStreams(attemptSeed) {
  const o = {};
  for (const s of STEPS) o[s] = rngFor(attemptSeed, s);
  return o;
}

/* ---------- xxHash32 ---------- */
const P1 = 0x9E3779B1, P2 = 0x85EBCA77, P3 = 0xC2B2AE3D, P4 = 0x27D4EB2F, P5 = 0x165667B1;
function rd32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
function round(acc, v) { acc = (acc + Math.imul(v, P2)) >>> 0; acc = rotl(acc, 13); return Math.imul(acc, P1) >>> 0; }
export function xxh32(bytes, seed = 0) {
  const len = bytes.length; let i = 0; let h;
  if (len >= 16) {
    let v1 = (seed + P1 + P2) >>> 0, v2 = (seed + P2) >>> 0, v3 = seed >>> 0, v4 = (seed - P1) >>> 0;
    const lim = len - 16;
    while (i <= lim) {
      v1 = round(v1, rd32(bytes, i)); v2 = round(v2, rd32(bytes, i + 4));
      v3 = round(v3, rd32(bytes, i + 8)); v4 = round(v4, rd32(bytes, i + 12)); i += 16;
    }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) >>> 0;
  } else h = (seed + P5) >>> 0;
  h = (h + len) >>> 0;
  while (i + 4 <= len) { h = (h + Math.imul(rd32(bytes, i), P3)) >>> 0; h = Math.imul(rotl(h, 17), P4) >>> 0; i += 4; }
  while (i < len) { h = (h + Math.imul(bytes[i], P5)) >>> 0; h = Math.imul(rotl(h, 11), P1) >>> 0; i++; }
  h ^= h >>> 15; h = Math.imul(h, P2) >>> 0; h ^= h >>> 13; h = Math.imul(h, P3) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
export const hex8 = (u) => (u >>> 0).toString(16).padStart(8, '0');
