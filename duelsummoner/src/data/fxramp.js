// The one effect colour ramp (spectacle spec 3.0): eight elements, five tones each. Columns: 0 core, 1 bright, 2 body, 3 shade, 4 ink. Core, bright and body come from the art book's effect palette
// (design/art-book/make.mjs and look.mjs); shade and ink are proposals. Rows with no ink in the spec (wind, light) repeat their shade in the ink column, so the shader never reads a hole. Dark is the black one:
// core is the black, bright is the moon-white rim, ink is the pinpoint. No tone is pure white, and none sits near a reserved colour (test/fxramp.test.js).
export const ELEMENTS = ['fire', 'ice', 'lightning', 'poison', 'wind', 'earth', 'light', 'dark'];
export const RAMP = {
  fire:      [0xfff4c8, 0xffc24a, 0xff8a1f, 0x8a5012, 0x3a2a18],
  ice:       [0xf0fbff, 0xcfeefc, 0x8ab8e0, 0x4f7396, 0x23384d],
  lightning: [0xf4f9ff, 0xbfdcff, 0x7fb8ff, 0x3a4ad0, 0x141a40],
  poison:    [0xe8ff9a, 0x8fd14f, 0x4f8a2a, 0x2a5a3a, 0x18161c],
  wind:      [0xf4fff9, 0xd9fff0, 0x9ad8c0, 0x6e8aa0, 0x6e8aa0],
  earth:     [0xe8c890, 0xc08a3e, 0x7a5428, 0x4a3a24, 0x1e1e2a],
  light:     [0xfffbe8, 0xfff2c4, 0xffe9a8, 0xd8c48a, 0xd8c48a],
  dark:      [0x0d0b12, 0xd8e4f4, 0x2a2632, 0x46445a, 0xf4f8ff]
};
export const ROW = Object.fromEntries(ELEMENTS.map((e, i) => [e.toUpperCase(), i]));

// ---- own-effect colour: the tone an element's own areas, rims and domes are drawn in. Not always the bright tone: the first of bright, body, shade, core that sits at least 25 delta E from every reserved colour
// (gold e0b765 and its light fff0b8, XP cyan 46e0ff, violet b26bff, danger red ff3b30), else the one farthest from them. Fire's bright tone ffc24a is only 21 from gold, so fire draws in its orange body ff8a1f.
export const RESERVED = [0xe0b765, 0xfff0b8, 0x46e0ff, 0xb26bff, 0xff3b30];
const lab = h => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, R = f((h >> 16) & 255), G = f((h >> 8) & 255), B = f(h & 255), X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883, q = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))]; };
export const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export const nearestReserved = c => Math.min(...RESERVED.map(r => deltaE(c, r)));
export function ownColour(el) { const r = RAMP[el]; if (!r) return 0xf3e3c2; let best = r[1], bd = -1; for (const t of [1, 2, 3, 0]) { const d = nearestReserved(r[t]); if (d >= 25) return r[t]; if (d > bd) { bd = d; best = r[t]; } } return best; }