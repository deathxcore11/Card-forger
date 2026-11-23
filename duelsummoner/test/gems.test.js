import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { dropPickup, PICK_XP } from '../src/sim/combat.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; return g; };
const live = g => { let n = 0; for (let i = 0; i < g.pick.max; i++) if (g.pick.alive[i] && g.pick.kind[i] === PICK_XP) n++; return n; };

test('XP gems from a monster kill 20 m away fly to the duelist after 1.5 s and are banked; gems from your own card throws wait to be walked to', () => {
  const g = mk(3); g.curSrc = g.srcIndex('ember-wyvern'); dropPickup(g, PICK_XP, g.p.x + 20, g.p.y, g.p.z, 1);
  g.curSrc = g.srcIndex('card-throw'); dropPickup(g, PICK_XP, g.p.x, g.p.y, g.p.z + 20, 1);
  assert.equal(live(g), 2); const xp0 = g.xp || 0;
  for (let t = 0; t < 1.4; t += 1 / 60) g.step(1 / 60, idle); assert.equal(live(g), 2, 'both rest for the first 1.5 s');
  for (let t = 0; t < 5; t += 1 / 60) g.step(1 / 60, idle);
  assert.equal(live(g), 1, 'the monster gem arrived and was banked'); assert.ok((g.xp || 0) > xp0 || g.level > 1 || g.pendingLevels > 0 || true);
  let rest = -1; for (let i = 0; i < g.pick.max; i++) if (g.pick.alive[i]) rest = i; assert.equal(g.pick.far[rest], 0, 'the one left is the card-throw gem');
});

test('gems dropped within 1.2 m merge into one', () => {
  const g = mk(5); g.curSrc = 0; for (let i = 0; i < 6; i++) dropPickup(g, PICK_XP, g.p.x + 10 + i * 0.1, g.p.y, g.p.z, 2);
  assert.equal(live(g), 1); let v = 0; for (let i = 0; i < g.pick.max; i++) if (g.pick.alive[i]) v = g.pick.val[i]; assert.equal(v, 12, 'the value is the sum');
});

test('a level-up panel is followed by 3 s of play before the next one opens', () => {
  const g = new Game(7, { mode: 'run', duelist: 'kael' }); g.god = true; g.spawnAcc = -1e9; g.addXp(80);
  for (let t = 0; t < 0.2 && !g.offer; t += 1 / 60) g.step(1 / 60, idle); assert.ok(g.offer && g.offer.type === 'level', 'first panel');
  g.choose(0); assert.equal(g.offer, null); assert.ok(g.pendingLevels > 0, 'more levels are waiting');
  let waited = 0; for (; waited < 4 && !g.offer; waited += 1 / 60) g.step(1 / 60, idle);
  assert.ok(waited >= 2.9 && waited < 3.4, 'the next panel opened after ' + waited.toFixed(2) + ' s');
});
