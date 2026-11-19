// PCG32 (XSH-RR, 64-bit state, 32-bit output). The state is a decimal string so it
// survives JSON and hashes the same on every platform. Integers only.
const MASK = (1n << 64n) - 1n;
const MULT = 6364136223846793005n;
const INC = 1442695040888963407n;

export function seedRng(seed) {
  let s = (BigInt.asUintN(64, BigInt(seed)) + INC) & MASK;
  s = (s * MULT + INC) & MASK;
  return s.toString();
}

// Returns [uint32, nextState].
export function nextU32(state) {
  const old = BigInt(state);
  const next = (old * MULT + INC) & MASK;
  const xorshifted = Number(((old >> 18n) ^ old) >> 27n & 0xffffffffn);
  const rot = Number(old >> 59n);
  const out = ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  return [out, next.toString()];
}

// A small mutable wrapper for hot loops. `box.s` is the serialisable state.
export class Rng {
  constructor(state) { this.s = state; }
  static fromSeed(seed) { return new Rng(seedRng(seed)); }
  u32() { const [v, n] = nextU32(this.s); this.s = n; return v; }
  // Unbiased integer in [0, n) by rejection sampling.
  int(n) {
    if (n <= 0) throw new Error('rng.int needs n > 0');
    const limit = 0x100000000 - (0x100000000 % n);
    for (;;) { const v = this.u32(); if (v < limit) return v % n; }
  }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  chance(num, den) { return this.int(den) < num; }
  // Derive an independent stream without disturbing this one's sequence much.
  fork(label) { let h = 0; for (const ch of String(label)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return Rng.fromSeed((BigInt(this.u32()) << 32n) | BigInt(h)); }
}
