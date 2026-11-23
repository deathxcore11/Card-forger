// The effect ramp (spectacle spec 3.0): shape of the table, the hue rule for fire, earth and light, no pure white, and a distance from the reserved colours so an own effect cannot be mistaken for gold, XP cyan,
// violet or danger red. Pure data: no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAMP, ELEMENTS, ROW } from '../src/data/fxramp.js';

const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const hue = h => { const [r, g, b] = rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d === 0) return 0; let x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; x *= 60; return x < 0 ? x + 360 : x; };
const sat = h => { const [r, g, b] = rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const lab = h => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, [R, G, B] = rgb(h).map(f), X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883, q = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

test('ramp: eight elements, five tones each, row numbers in element order', () => {
  assert.equal(ELEMENTS.length, 8); for (const e of ELEMENTS) assert.equal(RAMP[e].length, 5, e);
  assert.deepEqual(ELEMENTS.map(e => ROW[e.toUpperCase()]), [0, 1, 2, 3, 4, 5, 6, 7]);
});
test('ramp: no tone is pure white', () => { for (const e of ELEMENTS) for (const c of RAMP[e]) assert.notEqual(c, 0xffffff, e); });
test('ramp: fire, earth and light tones keep hue between 28 and 345 degrees (never red, never the danger hue)', () => {
  for (const e of ['fire', 'earth', 'light']) for (const c of RAMP[e]) { const h = hue(c); assert.ok(h >= 28 && h <= 345, e + ' ' + c.toString(16) + ' hue ' + h.toFixed(1)); }
});
test('ramp: the cold elements keep their art book hue split (lightning is more saturated than ice)', () => {
  assert.ok(sat(RAMP.lightning[2]) > sat(RAMP.ice[2]) + 0.1, 'lightning body vs ice body saturation');
  assert.ok(RAMP.lightning[3] !== RAMP.ice[3]);
});
test('ramp (the spec fire core #fff4c8 is only 6.5 from the gold light #fff0b8, so that one is exempt and reported): no tone is within 12 delta E of a reserved colour (XP cyan, violet, danger red, gold), except the documented near-gold tones (the light row, and the fire core)', () => {
  const RES = { xp: 0x46e0ff, violet: 0xb26bff, danger: 0xff3b30, gold: 0xe0b765, goldLight: 0xfff0b8 };
  for (const e of ELEMENTS) RAMP[e].forEach((c, t) => { for (const [n, r] of Object.entries(RES)) { if (e === 'light' && (n === 'gold' || n === 'goldLight')) continue; if (e === 'fire' && t === 0 && n === 'goldLight') continue; const d = dE(c, r); assert.ok(d >= 12, e + ' tone ' + t + ' ' + c.toString(16) + ' is only ' + d.toFixed(1) + ' from ' + n); } });
});
