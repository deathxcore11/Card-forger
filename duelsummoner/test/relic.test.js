import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { spawnEnemy } from '../src/sim/enemies.js'; import { RELIC } from '../src/sim/world.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const mk = seed => { const g = new Game(seed, { oldGen: true, mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };
const spot = g => g.world.relic && [g.world.relic.x, g.world.relic.z].join(',');

test('relic: one per stage, on the same spot for the same seed, 45 to 130 m from the spawn', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const a = mk(seed), b = mk(seed); assert.ok(a.world.relic, 'seed ' + seed + ' has a relic'); assert.equal(spot(a), spot(b), 'the same spot on a replay');
    const d = Math.hypot(a.world.relic.x - a.map.spawn.x, a.world.relic.z - a.map.spawn.z); assert.ok(d >= 44 && d <= 131, 'distance ' + d.toFixed(0));
  }
});

test('relic: taking it removes every swarm enemy within 30 m, adds them to the kills, leaves the far ones and bosses, and starts a 20 s frenzy', () => {
  const g = mk(3), R = g.world.relic; g.p.x = R.x; g.p.z = R.z; g.p.y = R.y;
  const near = [], far = []; for (let i = 0; i < 30; i++) { spawnEnemy(g, 'runner', { x: R.x + 4 + (i % 10) * 2, z: R.z + (i / 10 | 0) * 3 }); }
  for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) near.push(i);
  spawnEnemy(g, 'runner', { x: R.x + 60, z: R.z }); for (let i = 0; i < g.en.max; i++) if (g.en.alive[i] && !near.includes(i)) far.push(i);
  const boss = { alive: true, dead: false, role: 'gate', kind: 'pharaoh', size: 6, radius: 1, x: R.x + 3, y: R.y, z: R.z, hp: 1e6, maxHp: 1e6, face: 0 }; g.sp.push(boss);
  const k0 = g.kills, nNear = near.filter(i => (g.en.x[i] - R.x) ** 2 + (g.en.z[i] - R.z) ** 2 <= 900).length; assert.ok(nNear >= 25, 'set up ' + nNear + ' near enemies');
  g.step(1 / 60, idle);
  assert.equal(R.taken, true); assert.equal(g.kills - k0, nNear, 'the kill counter jumped by the number cleared');
  for (const i of far) assert.equal(g.en.alive[i], 1, 'a far enemy stays'); assert.equal(boss.alive, true, 'the boss stays');
  assert.ok(g.frenzyT > 19.9 && g.frenzyT <= 20, 'frenzy started: ' + g.frenzyT);
  for (let t = 0; t < 21; t += 1 / 60) g.step(1 / 60, idle); assert.equal(g.frenzyT, 0, 'and ended after 20 s');
});

test('Coin Rite: while it lasts every kill drops a coin, worth double', () => {
  const g = mk(5); g.frenzyT = 5; let coins = 0, val = 0; const m = g.pick; for (let i = 0; i < m.max; i++) m.alive[i] = 0;
  for (let i = 0; i < 20; i++) { spawnEnemy(g, 'runner', { x: g.p.x + 8 + i % 5, z: g.p.z + (i / 5 | 0) }); }
  for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) g.hitEnemy(i, 1e6, 1, 0);
  for (let i = 0; i < m.max; i++) if (m.alive[i] && m.kind[i] === 1) { coins++; val += m.val[i]; }
  assert.equal(coins, 20, 'a coin for every kill'); assert.ok(val >= 40, 'double value: ' + val);
});

