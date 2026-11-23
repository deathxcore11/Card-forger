import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { enemyCount, spawnRate } from '../src/sim/enemies.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };
const AT = [0.4 * 420, 0.7 * 420, 360];
test('surges: a banner 4 s ahead of each of the two timed surges and the gate wake, then 100 or more Husks within 15 s', () => {
  for (const seed of [3, 7, 11]) {
    const g = mk(seed), banners = []; let seen = g.evHead; const drain = () => { for (; seen < g.evHead; seen++) { const i = seen & (g.evCap - 1); if (g.evType[i] === 'banner') banners.push([g.sc, g.evData[i]]); } };
    for (let i = 0; i < 3; i++) {
      g.sc = AT[i] - 6; g.evState.fill(2); for (const q of g.sp) if (q.role === 'bossA' || q.role === 'bossB') q.alive = false; g.en.alive.fill(0); const n0 = g.spawned; let peak = 0;
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


test('surges: 1 and 2 wait for a live timed boss (at most 25 s) and then fire with their banner; the gate-wake surge never waits', () => {
  const g = mk(5), banners = []; let seen = g.evHead; const drain = () => { for (; seen < g.evHead; seen++) { const i = seen & (g.evCap - 1); if (g.evType[i] === 'banner') banners.push([g.sc, g.evData[i]]); } };
  const sur = () => banners.filter(x => /HORDE|GATE CALLS/.test(x[1]));
  const boss = { alive: true, dead: false, role: 'bossA', x: 0, y: 0, z: 0 }; g.sp.push(boss);
  g.sc = AT[0] - 6; for (let t = 0; t < 12 && !g.over; t += 1 / 60) { g.step(1 / 60, idle); drain(); }
  assert.equal(sur().length, 0, 'surge 1 is held while the timed boss is alive'); assert.equal(g.surgeDone[0], 0);
  boss.alive = false; for (let t = 0; t < 8; t += 1 / 60) { g.step(1 / 60, idle); drain(); }
  assert.equal(sur().length, 1, 'surge 1 gets its banner once the boss is dead'); assert.equal(g.surgeDone[0], 1, 'and fires 4 s later');
  g.sp.push({ alive: true, dead: false, role: 'bossB', x: 0, y: 0, z: 0 }); g.sc = AT[1] - 6; const before = sur().length;
  for (let t = 0; t < 40 && !g.over; t += 1 / 60) { g.step(1 / 60, idle); drain(); }
  assert.equal(g.surgeDone[1], 1, 'surge 2 fires anyway 25 s after its time'); assert.ok(sur().length === before + 1);
  g.sp.push({ alive: true, dead: false, role: 'bossB', x: 0, y: 0, z: 0 }); g.sc = AT[2] - 6; for (let t = 0; t < 8 && !g.over; t += 1 / 60) { g.step(1 / 60, idle); drain(); }
  assert.equal(g.surgeDone[2], 1, 'the gate-wake surge fires on time even with a timed boss alive');
});



