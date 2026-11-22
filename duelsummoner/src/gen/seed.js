// Seeds for the stage generator: Seal Codes, splitmix32, xoshiro128** and one named stream per generation step, so tuning one step
// never shifts another. Pure 32-bit integer arithmetic (Math.imul, >>> 0): the same on Node, Chrome and the Android build.
export const GEN_VERSION = 1;

export function splitmix32(x) {
  x = (x + 0x9E3779B9) | 0; let z = x;
  z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B); z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35); return (z ^ (z >>> 16)) >>> 0;
}
export function fnv1a32(str) {
  let h = 0x811C9DC5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rotl = (x, k) => (x << k) | (x >>> (32 - k));

export class Rng {                                                   // xoshiro128**
  constructor(a, b, c, d) { this.s0 = a | 0; this.s1 = b | 0; this.s2 = c | 0; this.s3 = d | 0; if (!(a | b | c | d)) this.s0 = 1; }
  next32() {
    const r = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0, t = this.s1 << 9;
    this.s2 ^= this.s0; this.s3 ^= this.s1; this.s1 ^= this.s2; this.s0 ^= this.s3; this.s2 ^= t; this.s3 = rotl(this.s3, 11);
    return r;
  }
  float() { return this.next32() / 4294967296; }
  int(n) { return Math.floor(this.float() * n); }
  range(a, b) { return a + this.float() * (b - a); }
  pick(list) { return list[this.int(list.length)]; }
  chance(p) { return this.float() < p; }
}
export function rngFor(attemptSeed, name) {
  const k = (attemptSeed ^ fnv1a32(name)) >>> 0, a = splitmix32(k), b = splitmix32(a), c = splitmix32(b), d = splitmix32(c);
  return new Rng(a, b, c, d);
}
export const stageSeed = (lo, hi, stage) => splitmix32((lo ^ Math.imul(hi + 1, 0x85EBCA6B) ^ Math.imul(stage + 1, 0x9E3779B9) ^ GEN_VERSION) >>> 0);
export const attemptSeed = (ss, attempt) => splitmix32((ss + Math.imul(attempt, 0x632BE5AB)) >>> 0);

// Seal Code: 8 Crockford base32 characters (no I, L, O, U) = 40 bits
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function sealCodeFrom(lo, hi) {
  let s = ''; hi = (hi || 0) & 255; lo = lo >>> 0;
  for (let i = 0; i < 8; i++) {                                         // low 5 bits first, from a 40-bit value held as hi:lo
    const idx = lo & 31; s = ALPHA[idx] + s; lo = ((lo >>> 5) | (hi << 27)) >>> 0; hi >>>= 5;
  }
  return s;
}
export function sealCodeParse(code) {
  let lo = 0, hi = 0;
  for (const ch of String(code).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')) {
    const v = ALPHA.indexOf(ch); if (v < 0) return null;
    hi = ((hi << 5) | (lo >>> 27)) & 255; lo = ((lo << 5) | v) >>> 0;
  }
  return { lo, hi };
}
