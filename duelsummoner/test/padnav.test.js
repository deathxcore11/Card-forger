import test from 'node:test'; import assert from 'node:assert/strict';
import { PadEdges, padLook, REPEAT, REPEAT_FIRST } from '../src/core/padnav.js';
const pad = (down = [], axes = [0, 0, 0, 0]) => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i) })), axes });

test('pad edges: a held button fires once; a direction repeats after the first delay, then every 180 ms', () => {
  const e = new PadEdges(); const got = [];
  for (let t = 0; t < 1.5; t += 1 / 60) for (const n of e.poll(pad([0, 13]), t)) got.push([n, t]);
  assert.equal(got.filter(x => x[0] === 'a').length, 1, 'A is an edge');
  const d = got.filter(x => x[0] === 'down'); assert.ok(d.length >= 1 + Math.floor((1.5 - REPEAT_FIRST) / REPEAT) - 1 && d.length <= 1 + Math.ceil((1.5 - REPEAT_FIRST) / REPEAT), 'down repeated ' + d.length + ' times in 1.5 s');
  assert.ok(Math.abs(d[2][1] - d[1][1] - REPEAT) < 1 / 30, 'repeat interval ' + (d[2][1] - d[1][1]).toFixed(3));
  assert.deepEqual(e.poll(pad([]), 2), []); assert.deepEqual(e.poll(pad([0]), 2.1), ['a'], 'a new press after a release fires again');
});

test('pad edges: Start, Select, X, Y, B, LB, RB are named; the left stick is a direction past 0.55 only', () => {
  const e = new PadEdges(); assert.deepEqual(e.poll(pad([9, 8, 2, 3, 1, 4, 5]), 0).sort(), ['b', 'lb', 'rb', 'select', 'start', 'x', 'y']);
  assert.deepEqual(e.poll(pad([], [0.4, 0]), 1), []); assert.deepEqual(e.poll(pad([], [0.8, 0.2]), 2), ['right']); assert.deepEqual(e.poll(pad([], [-0.1, -0.9]), 3), ['up']);
  assert.deepEqual(e.poll(null, 4), []);
});

test('pad look: the same turn per second at 30, 60, 90 and 120 fps', () => {
  const per = [];
  for (const fps of [30, 60, 90, 120]) { let sum = 0; for (let i = 0; i < fps; i++) sum += padLook(1, 0, 1 / fps)[0]; per.push(sum); }
  for (const v of per) assert.ok(Math.abs(v - per[1]) < 1e-6, 'turn per second ' + per.join(', '));
  assert.ok(Math.abs(per[1] - 840) < 1e-6, 'full stick is 840 units a second, the old 14 a frame at 60 fps');
});
