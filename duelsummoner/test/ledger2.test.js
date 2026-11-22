// Ledger phase 2: token-bucket caps, the self-damage pipeline (1 HP floor), Toll of Ash, the Thornbound Locket and the single hurt-trigger cap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { CAP, capTake, refillCaps, capLimit } from '../src/sim/caps.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { K } from '../src/data/tuning.js';

const idle = { mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 };
const mk = (o) => { const g = new Game(5, Object.assign({ offers: false, duelist: 'kael' }, o || {})); g.spawnAcc = -1e9; g.golemT = 1e9; g.cardT = 1e9; return g; };

test('token bucket: the per-minute ceiling holds in every sliding minute, and the effect never goes silent for a minute', () => {
  const g = mk(); const times = []; const dt = 1 / 60;
  for (let i = 0; i < 60 * 600; i++) { refillCaps(g, dt); if (capTake(g, CAP.HURT_FIRE)) times.push(i * dt); }          // asks for a charge every tick for 10 minutes
  const L = capLimit(CAP.HURT_FIRE); assert.equal(L, 30);
  for (let a = 0; a < times.length; a++) { let n = 0; for (let b = a; b < times.length && times[b] < times[a] + 60; b++) n++; assert.ok(n <= L + 1, 'window starting at ' + times[a].toFixed(1) + ' had ' + n); }
  let gap = 0; for (let k = 1; k < times.length; k++) gap = Math.max(gap, times[k] - times[k - 1]); assert.ok(gap <= 60 / L + 0.1, 'longest silence ' + gap.toFixed(2) + ' s');
  assert.ok(times.length >= L * 9, 'it keeps firing: ' + times.length);
});

test('self-damage: never kills, 1 HP floor, grants no i-frames, ignores dash i-frames, and never raises LP already below 1', () => {
  const g = mk(); g.p.hp = 40; assert.equal(g.hurtPlayer(1000, false, 'Toll', 1), true); assert.equal(g.p.hp, 1); assert.equal(g.over, false); assert.equal(g.grace, 0, 'self ticks grant no grace');
  g.p.hp = 0.5; g.hurtPlayer(10, false, 'Toll', 1); assert.equal(g.p.hp, 0.5, 'LP already below 1 is not healed to 1');
  const h = mk(); h.p.dashT = 0.2; h.p.hp = 50; h.hurtPlayer(10, false, 'enemy'); assert.equal(h.p.hp, 50, 'a dash dodges an enemy hit'); h.hurtPlayer(10, false, 'Toll', 1); assert.ok(h.p.hp < 50, 'but not a self cost');
  const k = mk(); k.p.hp = 5; k.hurtPlayer(50, false, 'enemy'); assert.equal(k.over, true, 'enemy damage still kills'); assert.equal(k.killedBy, 'enemy');
  const t = mk(); t.mods.armour = 3; t.p.hp = 50; t.hurtPlayer(10, false, 'enemy'); assert.equal(t.p.hp, 43); t.p.hp = 50; t.hurtPlayer(10, false, 'enemy', 4); assert.equal(t.p.hp, 40, 'TRUE damage ignores Guard');
});

test('Toll of Ash: pays 3% of current LP every 5 s, never kills, adds +7% Might a level', () => {
  const g = mk(); g.field.spells[0] = { id: 'toll-of-ash', level: 3, cd: 0, rootFx: 0 }; g.god = false;
  import('../src/sim/field.js').then(() => {});
  return import('../src/sim/field.js').then(F => {
    F.recompute(g); assert.ok(Math.abs(g.mods.dmgMult - 0.21) < 1e-9, 'might ' + g.mods.dmgMult); assert.equal(g.mods.toll, 3);
    const hp0 = g.p.hp; for (let i = 0; i < 60 * 11; i++) g.tick(idle); assert.ok(g.p.hp < hp0 && g.p.hp > hp0 * 0.9, 'LP ' + g.p.hp);
    g.p.hp = 2; for (let i = 0; i < 60 * 60; i++) g.tick(idle); assert.ok(g.p.hp >= 1 && !g.over, 'the Toll never takes you below 1 (hp ' + g.p.hp + ')');
  });
});

test('Thornbound Locket: a nova of 6 x Guard on every hurt, capped, with a ceiling on copies', async () => {
  const g = mk(); g.items.push('thornbound-locket'); g.mods = {}; const F = await import('../src/sim/field.js'); F.recompute(g); g.mods.armour = 5;
  assert.equal(g.mods.locket, 1); spawnEnemy(g, 'husk', { x: 2, z: 0 }); g.en.hp.fill(1e6); g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive); const hp0 = g.en.hp[0];
  g.hurtPlayer(5, false, 'enemy'); assert.ok(g.en.hp[0] < hp0, 'the nova hit the husk'); const dealt = hp0 - g.en.hp[0]; assert.ok(Math.abs(dealt - 6 * 20) < 1, 'about 6 x Guard (armour 5 = 20 Guard points): ' + dealt);
  const g2 = mk(); F.recompute(g2); g2.mods.armour = 5; g2.mods.locket = 50; spawnEnemy(g2, 'husk', { x: 2, z: 0 }); g2.en.hp.fill(1e6); g2.grid.rebuild(g2.en.max, g2.en.x, g2.en.z, g2.en.alive); g2.hurtPlayer(5, false, 'e'); assert.ok(1e6 - g2.en.hp[0] <= 6 * 20 * K.copyCap + 1, '50 copies stay under the x4 ceiling');
  const g3 = mk(); F.recompute(g3); g3.mods.armour = 500; g3.mods.locket = 1; spawnEnemy(g3, 'husk', { x: 2, z: 0 }); g3.en.hp.fill(1e6); g3.grid.rebuild(g3.en.max, g3.en.x, g3.en.z, g3.en.alive); g3.hurtPlayer(5, false, 'e'); assert.ok(1e6 - g3.en.hp[0] <= 6 * K.locketGuardCap + 1, 'Guard counts up to 120');
});

test('one cap on every hurt-triggered effect: enemy hits and self-damage share it', () => {
  const g = mk(); g.field.spells[0] = { id: 'gust-ward', level: 1, cd: 0, rootFx: 0 }; g.items.push('thornbound-locket'); g.god = false;
  let t0 = g.trapsFired; for (let i = 0; i < 100; i++) { g.p.hp = 100; g.hurtPlayer(1, false, 'enemy'); g.field.spells[0].cd = 0; }
  assert.ok(g.trapsFired - t0 <= 1, 'a flood of hits in one tick fires the trap at most once (' + (g.trapsFired - t0) + ')');
  assert.ok(g.caps.denied[CAP.HURT_FIRE] > 0);
  const s = mk(); s.field.spells[0] = { id: 'gust-ward', level: 1, cd: 0, rootFx: 0 }; let fired = 0; for (let i = 0; i < 200; i++) { s.field.spells[0].cd = 0; const f0 = s.trapsFired; s.hurtPlayer(1, false, 'Toll', 1); fired += s.trapsFired - f0; refillCaps(s, 1 / 60); }
  assert.ok(fired <= 4, 'self-damage fires at most ' + fired + ' in about 3 s (self allowance is 12 a minute)');
});

test('1,000,000 kills and absurd values keep the pipeline finite', () => {
  const g = mk(); g.kills = 1e6; g.p.hp = 1e9; for (let i = 0; i < 100; i++) g.hurtPlayer(1e12, false, 'x', 1); assert.ok(Number.isFinite(g.p.hp) && g.p.hp >= 1);
});
