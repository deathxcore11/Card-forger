import test from 'node:test'; import assert from 'node:assert/strict';
import { Kit } from '../src/gen/kit.js'; import { KITS } from '../src/gen/kits.js'; import { primHeight } from '../src/sim/raster.js'; import { splitmix32 } from '../src/gen/seed.js';
test('the Terraces kit builds three ramps and its top tier can be walked up, so ground enemies can follow', () => {
  for (const r of [28, 31, 33]) {
    const prims = [], k = new Kit(prims, 0, 0, 0, c => c); KITS.terraces.build(k, { r });
    assert.equal(prims.filter(p => p.t === 'ramp').length, 3, 'three ramps at r ' + r);
    const R = r - 8, H = (x, z) => { let h = 0; for (const p of prims) { if (p.deco) continue; const v = primHeight(p, x, z); if (v > h) h = v; } return h; };
    // breadth-first walk on a 0.5 m grid, climbing at most 0.72 m per step (the enemy limit), from the ground beside the first ramp to the top tier
    const S = 0.5, key = (i, j) => i + ',' + j, seen = new Set(), q = [[Math.round((R + 6) / S), 0]]; seen.add(key(q[0][0], 0)); let top = false;
    for (let n = 0; n < q.length && !top; n++) { const [i, j] = q[n], h0 = H(i * S, j * S); if (h0 >= 4.1) top = true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (Math.abs(a * S) > R + 10 || Math.abs(b * S) > R + 10 || seen.has(key(a, b))) continue; if (H(a * S, b * S) - h0 > 0.72) continue; seen.add(key(a, b)); q.push([a, b]); } }
    assert.ok(top, 'the top tier (4.2 m) is reachable on foot at r ' + r);
  }
});
