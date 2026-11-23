// The three-stage run: timeline, gate, gate boss, Descent with carry-over, Final Altar, Toll Bell, Quick Duel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { STAGES, RUNSPEC } from '../src/data/stages.js';
import { heightAt } from '../src/sim/terrain.js';

const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const run = (g, s, cmd = idle) => { for (let t = 0; t < s && !g.over && !g.offer; t += 1 / 60) g.step(1 / 60, cmd); };
const mk = (mode = 'run', seed = 3) => { const g = new Game(seed, { oldGen: true, mode, duelist: 'kael', offers: false }); g.god = true; return g; };
const events = g => { const out = []; g.drainEvents((type, a, b, c, d) => out.push([type, a, d])); return out; };
const kill = (g, role) => { for (const sp of g.sp) if (sp.alive && (!role || sp.role === role)) g.damageSpecial(sp, 1e9, 0, 0, { noCrit: true, area: true }); };
const atGate = g => { g.p.x = g.map.gate.x; g.p.z = g.map.gate.z + 1; g.p.y = heightAt(g.p.x, g.p.z); g.p.vx = g.p.vz = 0; g.p.grounded = true; };

test('a run starts in Stage 1 with the Stage 1 spec, a 7:00 clock and 3 timed events', () => {
  const g = mk(); assert.equal(g.stage, 0); assert.equal(g.stageSpec.id, 'ruins'); assert.equal(g.stageSpec.clock, 420); assert.equal(g.stageSpec.timeline.length, 3);
  assert.deepEqual(STAGES.map(s => s.clock), [420, 420, 480]);
});

test('timeline: events are announced 5 s ahead, then spawn; the elite drops a free Card Chest, a timed boss a Sealed Chest', () => {
  const g = mk(); g.sc = 99.5; run(g, 1);
  assert.ok(events(g).some(e => e[0] === 'announce' && e[1] === 0), 'elite announced at 1:40');
  g.sc = 104.5; run(g, 1); assert.equal(g.sp.filter(s => s.alive && s.role === 'elite').length, 1, 'elite on the field at 1:45');
  kill(g, 'elite'); assert.equal(g.world.cchests.filter(c => c.free).length, 2, 'the elite drops a free Card Chest (the other free chest is the one placed near the spawn)'); assert.equal(g.chests.length, 0, 'an elite drops no Sealed Chest');
  g.sc = 224.5; run(g, 6); assert.equal(g.sp.filter(s => s.alive && s.role === 'bossA').length, 1);
  kill(g, 'bossA'); assert.equal(g.chests.length, 1); assert.equal(g.chests[0].kind, 'sealed');
});

test('the gate wakes when boss B falls, or at its time; holding E for 3 s starts the gate boss', () => {
  const g = mk(); g.sc = 329.5; run(g, 6); assert.equal(g.gate.awake, false);
  kill(g, 'bossA'); run(g, 1); assert.equal(g.sp.filter(s => s.alive && s.role === 'bossB').length, 2, 'boss B comes once boss A is down');
  kill(g, 'bossB'); run(g, 0.2); assert.equal(g.gate.awake, true, 'B down wakes the gate');
  atGate(g); const left = g.stageSpec.clock - g.sc; run(g, 2.5, { ...idle, use: true }); assert.equal(g.gate.state, 'closed', '2.5 s is too short');
  run(g, 1, { ...idle, use: true }); assert.equal(g.gate.state, 'fight');
  const boss = g.sp.find(s => s.role === 'gate'); assert.ok(boss); assert.equal(Math.round(boss.maxHp), 2640); assert.equal(boss.name, 'The Stone Arbiter');
  assert.ok(g.swiftChips >= Math.floor(left / 2) - 2, 'Swift Seal pays Star Chips for clock left');
  const sc0 = g.sc; run(g, 2); assert.equal(g.sc, sc0, 'the clock freezes during the fight');
});

test('the gate also wakes at its wake time when boss B is still alive', () => {
  const g = mk(); g.sc = 359.5; run(g, 1); assert.equal(g.gate.awake, true);
});

test('gate boss down: enemies crumble, a chest descends, the Descent carries the build to Stage 2', () => {
  const g = mk(); g.field.monsters[0].level = 6; g.coins = 77; g.level = 9; g.p.hp = 50;
  g.sc = 360; atGate(g); run(g, 3.5, { ...idle, use: true });
  kill(g, 'gate'); run(g, 0.1);
  assert.equal(g.stagesCleared, 1); assert.equal(g.en.alive.reduce((a, b) => a + b, 0), 0, 'every enemy crumbled'); assert.ok(g.circle, 'a Descent Circle opens'); assert.equal(g.chests.filter(c => !c.open).length, 1);
  g.p.x = g.circle.x; g.p.z = g.circle.z; run(g, 0.1); assert.ok(g.desc, 'stepping in starts the Descent'); run(g, 6.2);
  assert.equal(g.stage, 1); assert.equal(g.stageSpec.id, 'catacombs'); assert.equal(g.sc < 1, true, 'a new stage clock');
  assert.equal(g.field.monsters[0].level, 6, 'the field carries'); assert.ok(g.level >= 9, 'the level carries (kills on the way can add one)'); assert.ok(g.coins >= 77);
  assert.ok(g.p.hp > 50, 'the Descent heals part of the missing LP'); assert.equal(g.chests.filter(c => !c.open).length, 1, 'the unopened Sealed Chest is carried');
  assert.equal(g.stageFacts.length, 1); assert.equal(g.stageFacts[0].stage, 1); assert.ok(g.hpMul > 0.7, 'stage multiplier and the minute curve apply');
});

test('the Toll Bell: at 0:00 with the gate unopened the duelist is pulled in and the boss is enraged', () => {
  const g = mk(); g.sc = g.stageSpec.clock - 0.2; run(g, 1);
  assert.equal(g.gate.state, 'fight'); assert.equal(g.gate.toll, true); const boss = g.sp.find(s => s.role === 'gate'); assert.equal(boss.enrage, RUNSPEC.tollEnrage);
  assert.ok(Math.abs(g.p.z - g.map.arena.tollPull.z) < 2 && Math.abs(g.p.x - g.map.arena.tollPull.x) < 2, 'pulled to the arena');
  run(g, 4); assert.ok(g.enemyCount() > 0, 'the swarm keeps spawning during a Toll Bell fight');
});

test('Stage 3: the King falls, the run is won, the Final Altar offers Close or Duel On', () => {
  const g = mk(); g.stage = 2; g.stageSpec = g.stages[2]; g.sc = 430; atGate(g); run(g, 3.5, { ...idle, use: true });
  const boss = g.sp.find(s => s.role === 'gate'); assert.equal(Math.round(boss.maxHp), 5500 * 1.2); kill(g, 'gate'); run(g, 0.1);
  assert.equal(g.won, true); assert.equal(g.bossKilled, true); assert.ok(g.altar, 'the Final Altar rises'); assert.equal(g.circle, null);
  g.p.x = g.altar.x; g.p.z = g.altar.z; run(g, 0.2, { ...idle, use: true }); assert.equal(g.offer.type, 'final'); assert.equal(g.offer.cards.length, 2);
  g.choose(1); assert.equal(g.duelOn, true); run(g, 40); assert.ok(g.otStep >= 1 && g.enemyCount() > 0, 'Overtime hunters step up');
  assert.equal(g.results({}).result, 'win'); assert.ok(g.results({}).overtimeSeconds > 39);
});

test('Final Altar: Close the Vault banks the win and ends the run', () => {
  const g = mk(); g.stage = 2; g.stageSpec = g.stages[2]; g.sc = 430; atGate(g); run(g, 3.5, { ...idle, use: true }); kill(g, 'gate'); run(g, 0.1);
  g.p.x = g.altar.x; g.p.z = g.altar.z; run(g, 0.2, { ...idle, use: true }); g.choose(0); assert.equal(g.over, true); assert.equal(g.results({}).result, 'win'); assert.equal(g.results({}).stagesCleared, 1);
});

test('Quick Duel: one 8:00 stage on the Stage 1 timeline, no Overtime option', () => {
  const g = mk('quick'); assert.equal(g.stages.length, 1); assert.equal(g.stageSpec.clock, 480); assert.equal(g.stageSpec.timeline[0].t, 105);
  g.sc = 430; atGate(g); run(g, 3.5, { ...idle, use: true }); kill(g, 'gate'); run(g, 0.1);
  assert.ok(g.altar && !g.circle); g.p.x = g.altar.x; g.p.z = g.altar.z; run(g, 0.2, { ...idle, use: true }); assert.equal(g.offer.cards.length, 1, 'only Close the Vault');
});

test('the run report carries stagesCleared and per-stage facts', () => {
  const g = mk(); g.sc = 360; atGate(g); run(g, 3.5, { ...idle, use: true }); kill(g, 'gate'); run(g, 0.1);
  const r = g.results({}); assert.equal(r.stagesCleared, 1); assert.equal(r.stageFacts.length, 1); assert.equal(r.mode, 'run'); assert.ok(r.gateOpenedAt > 0);
});

test('the stage machine is deterministic: two runs with the same inputs match tick for tick', () => {
  const play = () => { const g = mk('run', 9); g.sc = 100; for (let i = 0; i < 1500; i++) g.step(1 / 60, { ...idle, f: (i % 120) < 60 ? 1 : -1 }); return [g.kills, g.p.x, g.p.z, g.sp.length, g.hpMul, g.streams.spawn.s]; };
  assert.deepEqual(play(), play());
});

test('boss rule: a timed boss waits for the one before it, so never two timed boss bars; the gate fight dismisses leftovers', () => {
  const g = mk(); g.sc = 330; run(g, 8);
  assert.equal(g.sp.filter(s => s.alive && s.role === 'bossA').length, 1); assert.equal(g.sp.filter(s => s.alive && s.role === 'bossB').length, 0, 'B waits while A is alive');
  g.sc = 360; atGate(g); run(g, 3.5, { ...idle, use: true });
  assert.equal(g.sp.filter(s => s.alive && s.role !== 'gate').length, 0, 'earlier bosses do not join the gate fight'); assert.equal(g.sp.filter(s => s.alive).length, 1);
});

test('Fusion chest: a ready pair gets a free Sealed Chest 8 to 14 m away on walkable ground, a closer one after 45 s, and it fuses', () => {
  const g = mk(); g.field.monsters[1] = { id: 'cinder-hatchling', level: 10, cd: 0 }; g.field.monsters[0].level = 10; g.spawnAcc = -1e9;
  run(g, 0.5); const c = g.chests.find(x => x.guaranteed); assert.ok(c, 'a chest appears');
  const d = Math.hypot(c.x - g.p.x, c.z - g.p.z); assert.ok(d >= 7 && d <= 15, 'distance ' + d);
  run(g, 46); assert.equal(g.chests.filter(x => x.guaranteed).length, 2, 'a second one after 45 s'); const c2 = g.chests[g.chests.length - 1]; assert.ok(Math.hypot(c2.x - g.p.x, c2.z - g.p.z) <= 10);
});

test('per-monster damage per minute is recorded in the run report', () => {
  const g = mk(); run(g, 30); const r = g.results({}); assert.ok(r.damagePerMinute && typeof r.damagePerMinute === 'object');
  for (const k of Object.keys(r.damagePerMinute)) assert.ok(r.damagePerMinute[k].every(v => Number.isFinite(v)));
});

test('bot with a ready pair fuses within 30 s of the pair becoming ready', async () => {
  const { newBot, botRecord } = await import('../tools/bot.mjs');
  for (const seed of [3, 4, 5, 6, 7]) {
    const g = new Game(seed, { oldGen: true, mode: 'run', duelist: 'kael' }); g.god = true; g.spawnAcc = -1e9; const bot = newBot({ focus: true });
    g.field.monsters[0].level = 10; g.field.monsters[1] = { id: 'cinder-hatchling', level: 10, cd: 0 };
    let n = 0; while (g.fusions < 1 && n < 1800) { g.tick(botRecord(g, bot)); n++; }
    assert.ok(g.fusions >= 1, 'seed ' + seed + ' did not fuse in 30 s (ticks ' + n + ')');
  }
});



