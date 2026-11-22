// Integer helpers for the generator: no platform square root, sine or power (the lint in test/gen.test.js enforces it).
export function isqrt(n) {                                      // floor(sqrt(n)) for integers up to 2^52, Newton's method
  n = Math.floor(n); if (n < 2) return n < 0 ? 0 : n;
  let x = n, y = Math.floor((x + 1) / 2);
  while (y < x) { x = y; y = Math.floor((x + Math.floor(n / x)) / 2); }
  return x;
}
export const dist = (dx, dz) => isqrt(Math.floor((dx * dx + dz * dz) * 10000)) / 100;      // metres, to the centimetre
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const r2 = v => Math.round(v * 100) / 100;
