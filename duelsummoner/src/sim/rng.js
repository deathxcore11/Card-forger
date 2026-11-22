// Seeded random numbers: mulberry32 (32-bit state, one multiply-xorshift per draw) in four named streams, each seeded from the
// run seed by splitmix32. A change that draws from one stream (for example cosmetic) can never shift another (for example loot).
function splitmix32(x) {
  x = (x + 0x9E3779B9) | 0; let z = x;
  z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B); z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35); return (z ^ (z >>> 16)) >>> 0;
}
export const STREAMS = ['spawn', 'loot', 'combat', 'cosmetic'];

export class Rng {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
export function makeStreams(seed) {
  const out = {}; let k = splitmix32(seed >>> 0);
  for (const name of STREAMS) { k = splitmix32(k); out[name] = new Rng(k); }
  return out;
}
