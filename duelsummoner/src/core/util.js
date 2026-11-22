export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Small seeded random generator so the simulation is repeatable in tests.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clock(t) {
  const s = Math.floor(t);
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}
