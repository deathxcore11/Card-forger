// Counters must survive a very long run: 600,000 kills is the design ceiling, this fakes 1,000,000 and more.
// Every counter is a plain JS number (exact to 2^53). A native port must use 64-bit integers for kills, coins and xp, not Int32.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { killEnemy } from '../src/sim/combat.js';
import { runResults } from '../src/sim/results.js';
import { defaultMeta, applyRun } from '../src/core/meta.js';
import { freshSave, recordRun } from '../src/core/save.js';

test('1,000,000 kills: the kill path, results, star chips, meta totals and the save all stay exact', () => {
  const g = new Game(8, { duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; g.golemT = 1e9; g.field.monsters.fill(null); g.cardT = 1e9;
  g.kills = 999_995; g.coins = 3_000_000_000; g.levelUps = 4_000_000_000;                 // past int32 on purpose
  const rec = { mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 };
  for (let k = 0; k < 10; k++) assert.ok(spawnEnemy(g, 'husk', { x: 3 + k, z: 0 }));
  for (let i = 0; i < g.en.max; i++) killEnemy(g, i);
  assert.equal(g.kills, 1_000_005);
  for (let i = 0; i < 600; i++) g.tick(rec);
  const r = runResults(g, {});
  assert.equal(r.kills, 1_000_005); assert.ok(Number.isSafeInteger(r.kills) && Number.isFinite(g.starChips()) && g.starChips() >= 1_000_005 / 1e6);
  const round = JSON.parse(JSON.stringify(r)); assert.deepEqual(round, r, 'the report survives JSON');
  const meta = defaultMeta(); meta.totals.kills = 600_000; applyRun(meta, r); assert.equal(meta.totals.kills, 1_600_005);
  const save = freshSave(); recordRun({ save: { write: () => true } }, save, 'kael', g.runStats()); assert.equal(save.records.kael.mostKills, 1_000_005);
});

test('huge XP gains terminate and keep the level finite', () => {
  const g = new Game(8, { duelist: 'kael', offers: false });
  g.addXp(5e9);
  assert.ok(Number.isFinite(g.level) && g.level > 100 && g.level < 1e6, 'level ' + g.level);
  assert.ok(Number.isFinite(g.xpCur) && g.xpCur >= 0 && g.xpCur < g.xpNeed);
  assert.equal(g.pendingLevels, g.level - 1);
});

test('state size does not depend on kills: the pools are fixed', () => {
  const g = new Game(8, { duelist: 'kael', offers: false }); const sizes = [g.en.max, g.pick.max, g.evType.length];
  g.kills = 1_000_000; for (let i = 0; i < 300; i++) g.tick({ mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 });
  assert.deepEqual([g.en.max, g.pick.max, g.evType.length], sizes);
});




