import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
test('no encounter is placed within 12 m of the gate', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const g = new Game(seed, { mode: 'run', duelist: 'kael' }), G = g.map.gate;
    for (const e of g.map.encounters) assert.ok(Math.hypot(e.x - G.x, e.z - G.z) >= 12, 'seed ' + seed + ': a ' + e.type + ' at ' + Math.round(Math.hypot(e.x - G.x, e.z - G.z)) + ' m from the gate'); }
});
