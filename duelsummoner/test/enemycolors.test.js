// Enemy colours (art-direction rule): gold, XP cyan, violet and danger red are reserved and never an enemy colour. Every swarm kind's and every boss stand-in's base colour must be at least 20 delta E from each of them.
import test from 'node:test'; import assert from 'node:assert/strict';
import { KIND_LIST, BOSS_COLORS } from '../src/data/enemies.js';
const lab = c => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, r = f((c >> 16) & 255), g = f((c >> 8) & 255), b = f(c & 255); const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883, h = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2); };
const RESERVED = { gold: 0xe0b765, goldLight: 0xfff0b8, xp: 0x46e0ff, violet: 0xb26bff, violetLight: 0xf4ecff, danger: 0xff3b30, white: 0xffffff };
test('no enemy kind or boss stand-in colour is within 20 delta E of a reserved colour', () => {
  const all = KIND_LIST.map(k => [k.name, k.color]); for (const [b, o] of Object.entries(BOSS_COLORS)) for (const [p, c] of Object.entries(o)) all.push([b + '.' + p, c]);
  for (const [n, c] of all) for (const [rn, rc] of Object.entries(RESERVED)) assert.ok(dE(c, rc) >= 20, n + ' ' + c.toString(16) + ' is ' + dE(c, rc).toFixed(1) + ' from ' + rn);
});
test('every swarm kind keeps its own look: no two kinds share both colour and silhouette scale', () => {
  const seen = new Set(); for (const k of KIND_LIST) { const key = k.color + ':' + k.scale.join(','); assert.ok(!seen.has(key), k.name + ' repeats another kind'); seen.add(key); }
});
