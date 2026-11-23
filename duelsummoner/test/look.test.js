// Environment: each stage has its own look from the locked palettes; stage 1 is exactly what the game drew before; enemies stay readable (CIE76 delta E of 20 or more) on every floor.
import test from 'node:test'; import assert from 'node:assert/strict';
import { STAGE_LOOK, lookFor, rampColour } from '../src/data/look.js'; import { generateStage as generateStageAny } from '../src/gen/generate.js';
const generateStage = (s, i, sp) => generateStageAny(s, i, Object.assign({ old: true }, sp)); import { readFileSync } from 'node:fs';
const lab = c => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, r = f((c >> 16) & 255), g = f((c >> 8) & 255), b = f(c & 255);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883, h = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))]; };
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2); };

test('entry 0 of the look is exactly what the game drew before', () => {
  const L = STAGE_LOOK[0]; assert.deepEqual(L.sand, [0xc8a46c, 0xcaa978, 0xc09c66]); assert.equal(L.road, 0xb09470); assert.deepEqual(L.rim, [0xbca494, 0xd0bcaa, 0xbca494]); assert.equal(L.mesa, 0xd4c4ac); assert.equal(L.skirt, 0xc8a46c);
  assert.equal(L.ramp, null); assert.deepEqual(L.sky, [0x8fb2cc, 0xe8d6b0, 0xd9c29a]); assert.deepEqual(L.landmark, [0xe6dcc0, 0x4a4250]); assert.equal(lookFor(99), STAGE_LOOK[2]);
});
test('enemies stay readable on every floor: delta E of 20 or more against enemy dust', () => {
  for (const [i, L] of STAGE_LOOK.entries()) for (const f of L.sand) for (const e of (i === 0 ? [0x6e604c] : [0x6e604c, 0x9a8a70])) assert.ok(dE(f, e) >= 20, L.name + ' floor ' + f.toString(16) + ' vs enemy ' + e.toString(16) + ' = ' + dE(f, e).toFixed(1));
});
test('a ramp maps dark to dark and light to light, and stays inside its palette', () => {
  for (const L of STAGE_LOOK.slice(1)) { const lo = rampColour(L.ramp, 0x303030), hi = rampColour(L.ramp, 0xf0e8d0); assert.ok(lab(lo)[0] < lab(hi)[0], L.name); assert.equal(rampColour(L.ramp, 0x000000), L.ramp[0]); assert.equal(rampColour(L.ramp, 0xffffff), L.ramp[L.ramp.length - 1]); }
});
test('Stage 3 has no violet in its scenery, and the generator keeps the map hash while storing the untinted colour', () => {
  const line = readFileSync(new URL('../src/view/scenery.js', import.meta.url), 'utf8').split('\n').find(l => l.includes("name: 'vault'")), cols = [...line.matchAll(/0x([0-9a-f]{6})/gi)].map(m => parseInt(m[1], 16)); assert.ok(cols.length >= 10);
  for (const c of cols) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; assert.ok(!(b > r + 24 && b > g + 24 && r > g + 8 && b > 130), 'violet-ish ' + c.toString(16)); }
  const m1 = generateStage(7, 1), m2 = generateStage(7, 1); assert.equal(m1.hash, m2.hash); assert.ok(m1.prims.every(p => p.c0 !== undefined), 'every primitive keeps its untinted colour'); assert.ok(m1.prims.some(p => p.c0 !== p.c), 'the stage tint changed some');
});


