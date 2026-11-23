// The own-effect colour (view only; it lives here, not in data/, because the colour maths uses platform maths that src/sim and src/data may not).
import { RAMP } from '../data/fxramp.js';

// ---- own-effect colour: the tone an element's own areas, rims and domes are drawn in. Not always the bright tone: the first of bright, body, shade, core that sits at least 25 delta E from every reserved colour
// (gold e0b765 and its light fff0b8, XP cyan 46e0ff, violet b26bff, danger red ff3b30), else the one farthest from them. Fire's bright tone ffc24a is only 21 from gold, so fire draws in its orange body ff8a1f.
export const RESERVED = [0xe0b765, 0xfff0b8, 0x46e0ff, 0xb26bff, 0xff3b30];
const lab = h => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, R = f((h >> 16) & 255), G = f((h >> 8) & 255), B = f(h & 255), X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883, q = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))]; };
export const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export const nearestReserved = c => Math.min(...RESERVED.map(r => deltaE(c, r)));
export function ownColour(el) { const r = RAMP[el]; if (!r) return 0xf3e3c2; let best = r[1], bd = -1; for (const t of [1, 2, 3, 0]) { const d = nearestReserved(r[t]); if (d >= 25) return r[t]; if (d > bd) { bd = d; best = r[t]; } } return best; }