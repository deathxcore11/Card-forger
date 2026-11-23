import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { enemyCount } from '../src/sim/enemies.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };
const AT = [0.4 * 420, 0.7 * 420, 360];
test('surges: a banner 4 s ahead of each of the two timed surges and the gate wake, then 100 or more Husks within 15 s', () => {
  for (const seed of [3, 7, 11]) {
    const g = mk(seed), banners = []; let seen = g.evHead; const drain = () => { for (; seen < g.evHead; seen++) { const i = seen & 255; if (g.evType[i] === 'banner') banners.push([g.sc, g.evData[i]]); } };
    for (let i = 0; i < 3; i++) {
      g.sc = AT[i] - 6; g.en.alive.fill(0); const n0 = g.spawned; let peak = 0;
      for (let t = 0; t < 22; t += 1 / 60) { g.step(1 / 60, idle); drain(); peak = Math.max(peak, enemyCount(g.en)); if (g.over || g.offer) break; }
      const b = banners.filter(x => /HORDE|GATE CALLS/.test(x[1])).at(-1); assert.ok(b, 'surge ' + i + ' banner on seed ' + seed);
      assert.ok(Math.abs((AT[i] - b[0]) - 4) <= 0.5, 'banner ' + (AT[i] - b[0]).toFixed(2) + ' s ahead');
      assert.ok(peak >= 100, 'enemy count reached ' + peak);
      assert.ok(g.spawned - n0 >= 100, 'spawned ' + (g.spawned - n0));
    }
  }
});

