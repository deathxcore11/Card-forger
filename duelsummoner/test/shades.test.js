// Toll Shades, enemy-cap merging and the data behind them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { RUNSPEC, STAGES } from '../src/data/stages.js';
import { heightAt } from '../src/sim/terrain.js';
import { explode } from '../src/sim/combat.js';
import { spawnEnemy, mergeEnemy } from '../src/sim/enemies.js';
import { killEnemy } from '../src/sim/combat.js';

const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const run = (g, s, cmd = idle) => { for (let t = 0; t < s && !g.over && !g.offer; t += 1 / 60) g.step(1 / 60, cmd); };
const mk = (o) => { const g = new Game(3, Object.assign({ mode: 'run', duelist: 'kael', offers: false }, o || {})); g.spawnAcc = -1e9; g.golemT = 1e9; g.cardT = 1e9; g.evState.fill(2); return g; };
const SH = RUNSPEC.shades;

test('the numbers live in data and match the design', () => {
  assert.equal(SH.start, 3); assert.equal(SH.addEverySeconds, 10); assert.equal(SH.max, 12); assert.equal(SH.speedFrac, 0.7); assert.equal(SH.speedStepPct, 10); assert.equal(SH.touchPct, 0.25); assert.equal(SH.afterGateSeconds, 60);
});

test('they rise when the stage clock hits 0:00: 3 at first, one more every 10 s up to 12, faster by 10% every 10 s from 70% of player speed', () => {
  const g = mk(); g.god = true; g.sc = STAGES[0].clock - 0.1; run(g, 0.05); assert.equal(g.shades.length, 0, 'not yet');
  run(g, 0.5); assert.equal(g.shades.length, 3);
  g.p.x = 0; g.p.z = 0; const s = g.shades[0]; s.cd = 99; const x0 = s.x, z0 = s.z; g.step(1 / 60, idle);
  const moved = Math.sqrt((s.x - x0) ** 2 + (s.z - z0) ** 2); assert.ok(Math.abs(moved - 9 * 0.7 / 60) < 0.02, 'speed ' + (moved * 60).toFixed(2));
  run(g, 10); assert.equal(g.shades.length, 4); run(g, 200); assert.equal(g.shades.length, 12, 'capped at 12');
  for (const sh of g.shades) sh.cd = 99; const a = g.shades[0]; a.x = g.p.x + 60; a.z = g.p.z; const ax = a.x, az = a.z; g.step(1 / 60, idle); const sp = Math.sqrt((a.x - ax) ** 2 + (a.z - az) ** 2) * 60;
  assert.ok(sp > 9 * 0.7 * 1.1 ** 15, 'they speed up by 10% every 10 s: ' + sp.toFixed(1) + ' m/s after 210 s');
});

test('a shade cannot be damaged: explosions, shots and statuses leave it alone, and it has no health', () => {
  const g = mk(); g.god = true; g.sc = STAGES[0].clock; run(g, 1); assert.equal(g.shades.length, 3);
  for (const s of g.shades) { assert.equal(s.hp, undefined); explode(g, s.x, s.y, s.z, 60, 0, 1e12, 0xffffff, 'test'); }
  g.damageSpecial({ alive: true, dead: false, kind: 'x', x: 0, z: 0, hp: 1, maxHp: 1, radius: 1, flash: 0 }, 1e9, 0, 0, {});
  run(g, 3); assert.equal(g.shades.length, 3); assert.ok(g.shades.every(s => Number.isFinite(s.x)));
});

test('a touch takes 25% of max LP as TRUE damage and can kill, even a 1-LP player', () => {
  const g = mk(); g.sc = STAGES[0].clock; g.p.hp = 100; g.mods.armour = 50; run(g, 0.2); const s = g.shades[0]; s.x = g.p.x + 0.3; s.z = g.p.z; s.cd = 0; g.grace = 0; g.step(1 / 60, idle);
  assert.ok(Math.abs(g.p.hp - 75) < 1e-6, 'LP ' + g.p.hp + ': armour does not help against TRUE damage');
  const h = mk(); h.sc = STAGES[0].clock; run(h, 0.2); h.p.hp = 1; const t = h.shades[0]; t.x = h.p.x + 0.3; t.z = h.p.z; t.cd = 0; h.step(1 / 60, idle);
  assert.equal(h.over, true, 'a 1-LP player dies to one touch'); assert.equal(h.killedBy, 'Toll Shade');
  const gl = mk({ oaths: ['glass'] }); gl.sc = STAGES[0].clock; run(gl, 0.2); const u = gl.shades[0]; u.x = gl.p.x + 0.3; u.z = gl.p.z; u.cd = 0; gl.step(1 / 60, idle); assert.equal(gl.over, true, 'with the Glass Oath (1 LP) a touch costs at least 1 LP');
  const d = mk(); d.sc = STAGES[0].clock; run(d, 0.2); for (const x of d.shades) x.cd = 99; d.shades[0].cd = 0; d.shades[0].x = d.p.x + 0.3; d.shades[0].z = d.p.z; d.p.dashT = 0.2; d.p.hp = 100; d.step(1 / 60, idle); assert.equal(d.p.hp, 100, 'a dash still dodges a shade');
});

test('shades come 60 s after the gate boss falls if the Descent is not taken (in Stage 3 the Final Altar waits; stages 1 and 2 keep the Descent Circle open and the Shades rise on their own clock)', () => {
  const g = mk(); g.god = true; g.stage = 2; g.stageSpec = g.stages[2]; g.sc = 430; g.p.x = g.map.gate.x; g.p.z = g.map.gate.z + 1; g.p.y = heightAt(g.p.x, g.p.z); run(g, 3.5, { ...idle, use: true });
  for (const sp of g.sp) if (sp.alive && sp.role === 'gate') g.damageSpecial(sp, 1e9, 0, 0, { noCrit: true, area: true }); run(g, 0.2); assert.ok(g.altar && !g.circle);
  run(g, 57); assert.equal(g.shades.length, 0); run(g, 4); assert.ok(g.shades.length > 0, 'rose 60 s after the King fell');
  const h = mk(); h.god = true; h.sc = 360; h.p.x = h.map.gate.x; h.p.z = h.map.gate.z + 1; h.p.y = heightAt(h.p.x, h.p.z); run(h, 3.5, { ...idle, use: true });
  for (const sp of h.sp) if (sp.alive && sp.role === 'gate') h.damageSpecial(sp, 1e9, 0, 0, { noCrit: true, area: true }); run(h, 22); assert.equal(h.stage, 0, 'the Circle no longer pulls the duelist down; they step in when they choose'); assert.ok(h.circle, 'the Circle stays open'); run(h, 45); assert.ok(h.shades.length > 0, 'the Toll Shades rose 60 s after the gate boss'); h.p.x = h.circle.x; h.p.z = h.circle.z; run(h, 7); assert.equal(h.stage, 1, 'stepping in descends'); assert.equal(h.shades.length, 0, 'a fresh stage starts clean');
});
test('in Overtime after Duel On a wave of 3 shades rises every 60 s (up to 24)', () => {
  const g = mk(); g.god = true; g.stage = 2; g.stageSpec = g.stages[2]; g.duelOn = true; g.shadeWaveT = 0.5; g.otAcc = 0; run(g, 1); assert.equal(g.shades.length, 3);
  run(g, 61); assert.equal(g.shades.length, 6); run(g, 600); assert.equal(g.shades.length, 24, 'hard cap');
});

test('past the enemy cap a spawn merges into the nearest of its kind: total HP kept, size up to 1.5x, reward summed', () => {
  const g = mk(); g.god = true; g.maxAlive = 6; g.hpMul = 1;
  for (let i = 0; i < 6; i++) spawnEnemy(g, 'husk', { x: 10 + i * 3, z: 10 }); const hpBefore = Array.from(g.en.hp).reduce((a, b, i) => a + (g.en.alive[i] ? b : 0), 0), n0 = g.enemyCount();
  let merged = 0; for (let i = 0; i < 40; i++) if (mergeEnemy(g, 'husk')) merged++;
  const hpAfter = Array.from(g.en.hp).reduce((a, b, i) => a + (g.en.alive[i] ? b : 0), 0);
  assert.equal(g.enemyCount(), n0, 'no new enemy appeared'); assert.equal(merged, 40); assert.ok(Math.abs(hpAfter - (hpBefore + 40 * 4)) < 1e-3, 'HP ' + hpAfter);
  let big = 0, mx = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) { big = Math.max(big, g.en.size[i]); mx += g.en.mrg[i]; } assert.ok(big <= 1.5 + 1e-9 && big > 1.1, 'size ' + big); assert.equal(mx, 40);
  const idx = Array.from(g.en.mrg).indexOf(Math.max(...g.en.mrg)); const xpSum = () => Array.from(g.pick.val).reduce((a, v, i) => a + (g.pick.alive[i] && g.pick.kind[i] === 0 ? v : 0), 0); const xp0 = xpSum(); const m = g.en.mrg[idx];
  killEnemy(g, idx); const xp1 = xpSum(); assert.equal(xp1 - xp0, 1 + m, 'the kill drops the summed reward');
});

