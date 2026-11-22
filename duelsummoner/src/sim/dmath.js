// Deterministic maths for the sim: only + - * / floor sqrt are used, so every platform (and the Kotlin port) gets the same bits.
const PI = 3.141592653589793, TWO_PI = 6.283185307179586, HALF_PI = 1.5707963267948966, LN2 = 0.6931471805599453;

export function sin(x) {
  x = x - TWO_PI * Math.floor((x + PI) / TWO_PI);                  // to [-pi, pi)
  if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;  // fold to [-pi/2, pi/2]
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800)))))));
}
export function cos(x) { return sin(x + HALF_PI); }

function atanSmall(x) {                                             // |x| <= 0.2 after two half-angle reductions
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 3 + x2 * (1 / 5 + x2 * (-1 / 7 + x2 * (1 / 9 + x2 * (-1 / 11))))));
}
export function atan(x) {
  const neg = x < 0; if (neg) x = -x;
  let inv = false; if (x > 1) { x = 1 / x; inv = true; }
  x = x / (1 + Math.sqrt(1 + x * x)); x = x / (1 + Math.sqrt(1 + x * x));   // atan(x) = 4 * atan(reduced)
  let r = 4 * atanSmall(x);
  if (inv) r = HALF_PI - r;
  return neg ? -r : r;
}
export function atan2(y, x) {
  if (x > 0) return atan(y / x);
  if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
  return y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0;
}
export function exp(x) {
  const n = Math.floor(x / LN2 + 0.5), r = x - n * LN2;
  const p = 1 + r * (1 + r * (1 / 2 + r * (1 / 6 + r * (1 / 24 + r * (1 / 120 + r * (1 / 720 + r * (1 / 5040 + r * (1 / 40320 + r * (1 / 362880 + r * (1 / 3628800))))))))));
  let out = p; if (n > 0) for (let i = 0; i < n; i++) out *= 2; else for (let i = 0; i < -n; i++) out *= 0.5;
  return out;
}
export function pow(b, e) {                                         // integer exponents only (levels, overtime steps)
  let n = Math.round(e), r = 1, base = b; if (n < 0) { base = 1 / b; n = -n; }
  while (n > 0) { if (n & 1) r *= base; base *= base; n >>= 1; }
  return r;
}
