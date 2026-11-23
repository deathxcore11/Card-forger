import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { enemyCount, spawnRate } from '../src/sim/enemies.js';
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


test('gate fight: the horde keeps coming at 40 percent of the spawn rate at the moment the gate woke', () => {
  for (const seed of [3, 7]) {
    const g = mk(seed); g.sc = 361; g.p.x = g.map.gate.x; g.p.z = g.map.gate.z + 1;
    for (let t = 0; t < 4 && g.gate.state !== 'fight'; t += 1 / 60) g.step(1 / 60, { ...idle, use: true }); assert.equal(g.gate.state, 'fight', 'the gate fight started');
    const te = Math.min(479, g.stageSpec.waves.offset + g.sc * g.stageSpec.waves.scale * g.diff.ramp), want = 0.4 * spawnRate(te) * g.diff.spawn;
    const n0 = g.spawned; const T = 40; for (let t = 0; t < T; t += 1 / 60) { g.step(1 / 60, idle); if (Math.floor(t * 60) % 60 === 0) for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; }
    const got = (g.spawned - n0) / T; assert.ok(Math.abs(got - want) <= want * 0.1 + 0.05, 'spawn rate ' + got.toFixed(2) + ' vs ' + want.toFixed(2) + '/s on seed ' + seed);
  }
});

