// Pickup colours: the XP gem core and the coin must sit within 6 delta E of their reserved colours (XP cyan 46e0ff, gold e0b765); the XP crystal keeps facets in the same hue.
import test from 'node:test'; import assert from 'node:assert/strict';
import { PICKUP_COLORS as P } from '../src/data/pickups.js';
const lab = c => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, r = f((c >> 16) & 255), g = f((c >> 8) & 255), b = f(c & 255); const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883, h = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2); };
const hue = c => { const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1; return (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; };
test('pickup base colours sit on their reserved colours', () => { assert.ok(dE(P.xp, 0x46e0ff) <= 6, 'XP gem core'); assert.ok(dE(P.coin, 0xe0b765) <= 6, 'coin'); });
test('the XP crystal keeps its facets in the XP hue: tip lighter, underside darker, hues within 25 degrees', () => {
  assert.ok(lab(P.xpTip)[0] > lab(P.xp)[0] + 8 && lab(P.xpUnder)[0] < lab(P.xp)[0] - 8, 'three lightness steps'); for (const c of [P.xpTip, P.xpUnder]) assert.ok(Math.abs(hue(c) - hue(P.xp)) < 25, 'same hue');
});
