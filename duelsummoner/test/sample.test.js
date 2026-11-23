import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleMap } from '../src/gen/sample.js';
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';

const HALF = 200, SIM = 400;
const at = (m, x, z) => m.heights[(Math.floor(z) + HALF) * SIM + Math.floor(x) + HALF];

test('the Sunken Court sample: spawn, gate and every chest are connected by walkable ground (0.55 m steps)', () => {
  const m = sampleMap(), H = m.heights, seen = new Uint8Array(SIM * SIM), q = [];
  const s = (Math.floor(m.spawn.z) + HALF) * SIM + Math.floor(m.spawn.x) + HALF; seen[s] = 1; q.push(s);
  while (q.length) { const c = q.pop(), x = c % SIM, z = (c / SIM) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= SIM || zz >= SIM) continue; const n = zz * SIM + xx; if (seen[n] || H[n] >= 50 || Math.abs(H[n] - H[c]) > 0.55) continue; seen[n] = 1; q.push(n); } }
  const reach = (x, z) => seen[(Math.floor(z) + HALF) * SIM + Math.floor(x) + HALF] === 1;
  assert.ok(reach(m.gate.x, m.gate.z), 'gate reachable from the spawn');
  for (const e of m.encounters) assert.ok(reach(e.x, e.z), e.type + ' at ' + e.x + ',' + e.z + ' reachable');
  assert.ok(!reach(100, 60), 'a closed outer room is not reachable');
});
test('the sample: the Court is flat at 3 m, the terraces are 4 m higher, the stairs are 20 m wide with 0.5 m steps, the obelisk and the walls block', () => {
  const m = sampleMap();
  for (const [x, z] of [[0.5, 0.5 + 8], [30.5, 30.5], [-30.5, -30.5], [40.5, 0.5]]) if (!(Math.abs(x) < 5 && Math.abs(z) < 5)) assert.equal(at(m, x, z), 3, 'Court floor ' + x + ',' + z);
  assert.equal(at(m, 0.5, 80.5), 7); assert.equal(at(m, 0.5, -80.5), 7);
  for (const sg of [1, -1]) for (let k = 1; k <= 8; k++) { const z = sg * (48 + 2 * (k - 1) + 1); for (const x of [-9.5, 0.5, 9.5]) assert.equal(at(m, x, z), 3 + 0.5 * k, 'step ' + k); }
  assert.ok(at(m, 0.5, 0.5) > 15, 'the obelisk blocks'); assert.ok(at(m, 0.5, 46.5) === 3, 'the stair mouth is open'); assert.equal(at(m, 20.5, 46.5), 9, 'the Court wall is 6 m high');
  for (const [x, z] of [[30.5, 46.5], [46.5, 0.5], [-46.5, 0.5]]) assert.equal(at(m, x, z), 9, 'a shut gateway stays wall');
  assert.equal(m.drawH[(0 + HALF) * SIM + 0 + HALF], 3, 'the view draws the floor under the obelisk, the prop is drawn by hand');
});
test('the sample loads as Stage 1 of a run only behind the flag, and not otherwise', () => {
  const a = new Game(7, { mode: 'run', duelist: 'kael', offers: false, sample: true }); assert.equal(a.map.sample, true); assert.equal(a.map.key, 'sample-sunken-court-1'); assert.ok(Math.abs(a.p.y - 7) < 0.01 && heightAt(a.p.x, a.p.z) === 7);
  const b = new Game(7, { mode: 'run', duelist: 'kael', offers: false }); assert.ok(!b.map.sample);
});
