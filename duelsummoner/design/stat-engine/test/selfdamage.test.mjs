import test from 'node:test';
import assert from 'node:assert/strict';
import { K } from '../src/tuning.js';
import { Ledger, STAT, SRC, PF, EV, FX, C, CAP, DUELIST } from '../src/stats.js';

const mk = (o = {}) => { const L = new Ledger({ pool: 16, enemyHp: 1e12, ...o }); return L; };

test('self-damage never kills: 1 HP floor over a 100k-case fuzz', () => {
  const L = mk(); L.recompute();
  let x = 1;
  for (let k = 0; k < 100000; k++) {
    x = (x * 1103515245 + 12345) >>> 0;
    L.hp = 1 + (x % 1000) / 7; const n = (x % 7 === 0) ? 1e9 : (x % 500) / 3;
    L.hurtPlayer(n, PF.SELF, SRC.SELF);
    assert.ok(L.hp >= 1, `hp ${L.hp}`);
  }
  assert.equal(L.c[C.DEATHS], 0); assert.equal(L.c[C.SELF_DEATHS], 0); assert.equal(L.gameOver, false);
  assert.ok(L.c[C.FLOOR_SAVES] > 0);
});

test('self-damage never raises LP that is already below 1', () => {
  const L = mk(); L.recompute(); L.hp = 0.4;
  L.hurtPlayer(5, PF.SELF, SRC.SELF);
  assert.equal(L.hp, 0.4);
});

test('SELF goes through the normal pipeline: EV_HURT fires, but no evasion, no Ward, no Guard, no grace', () => {
  const L = mk();
  L.pts[STAT.SIDE] = 1023; L.pts[STAT.WARD] = 3; L.pts[STAT.GUARD] = 1023;
  L.recompute(); L.wards = 3; L.hp = 100;
  L.locketN = 1; L.setEffects(EV.HURT, [FX.LOCKET_NOVA]);
  for (let i = 0; i < 10; i++) L.hurtPlayer(2, PF.SELF, SRC.SELF);
  assert.equal(L.hp, 80, 'unmitigated, never dodged');
  assert.equal(L.wards, 3, 'Wards untouched');
  assert.equal(L.grace, 0, 'self ticks never grant i-frames');
  assert.equal(L.c[C.LOCKET_FIRES], 10, 'EV_HURT fired for SELF');
  assert.equal(L.c[C.SELF_HURTS], 10);
});

test('enemy hits: dash i-frames, evasion, Wards then Guard; grace is granted; death is possible', () => {
  const L = mk(); L.pts[STAT.GUARD] = 20; L.pts[STAT.WARD] = 1; L.recompute(); L.wards = 1; L.hp = 100;
  L.dashT = 5; L.hurtPlayer(50, 0, SRC.ENEMY); assert.equal(L.hp, 100); assert.equal(L.c[C.DODGES], 1); L.dashT = 0;
  L.hurtPlayer(50, 0, SRC.ENEMY); assert.equal(L.hp, 100); assert.equal(L.wards, 0); assert.equal(L.c[C.BLOCKS], 1);
  L.hurtPlayer(50, 0, SRC.ENEMY); assert.equal(L.hp, 75, 'Guard 20 = 50% mitigation'); assert.equal(L.grace, K.graceSec);
  L.hurtPlayer(1, 0, SRC.ENEMY); assert.equal(L.hp, 74, 'never below 1 damage');
  L.hurtPlayer(1e6, PF.TRUE, SRC.ENEMY); assert.equal(L.hp, 0); assert.equal(L.gameOver, true); assert.equal(L.c[C.SELF_DEATHS], 0);
});

test('evasion is a real roll capped at 55%', () => {
  const L = mk({ seed: 7 }); L.pts[STAT.SIDE] = 1023; L.recompute();
  L.respawnOnDeath = true;
  for (let i = 0; i < 20000; i++) { L.hp = 1e9; L.hurtPlayer(1, 0, SRC.ENEMY); }
  const rate = L.c[C.DODGES] / 20000;
  assert.ok(Math.abs(rate - K.sideCap) < 0.02, `dodge rate ${rate}`);
});

test('HURT_TRAP: at most 30 per minute, at most 12 of them from SELF', () => {
  const L = mk({ capAudit: 4096 }); L.pts[STAT.REWIND] = 1e9; L.recompute(); L.hp = 1e6;
  L.gustLv = 5; L.setEffects(EV.HURT, [FX.GUST_WARD]);
  for (let t = 0; t < 60 * 60 * 3; t++) {                 // 3 minutes, self-hurt every tick, enemy hit every 10 ticks
    L.hurtPlayer(1, PF.SELF, SRC.SELF);
    if (t % 10 === 0) { L.grace = 0; L.hurtPlayer(1, PF.PIERCE, SRC.ENEMY); }
    L.tickWorld();
  }
  assert.ok(L.caps.maxSliding(CAP.HURT_TRAP) <= 30, `HURT_TRAP ${L.caps.maxSliding(CAP.HURT_TRAP)}`);
  assert.ok(L.caps.maxSliding(CAP.HURT_TRAP_SELF) <= 12, `SELF ${L.caps.maxSliding(CAP.HURT_TRAP_SELF)}`);
  assert.ok(L.c[C.TRAP_FIRES] > 60, 'the trap does fire');
});

test('SELF_PROC: on-hurt items fired by self-damage are capped at 15 per minute; enemy hits still fire them', () => {
  const L = mk({ capAudit: 4096 }); L.pts[STAT.GUARD] = 40; L.recompute(); L.hp = 1e6;
  L.locketN = 1; L.setEffects(EV.HURT, [FX.LOCKET_NOVA]);
  for (let t = 0; t < 60 * 60 * 2; t++) { L.hurtPlayer(1, PF.SELF, SRC.SELF); L.tickWorld(); }
  assert.ok(L.caps.maxSliding(CAP.SELF_PROC) <= 15);
  const before = L.c[C.LOCKET_FIRES];
  for (let i = 0; i < 5; i++) { L.grace = 0; L.hurtPlayer(3, PF.PIERCE, SRC.ENEMY); }
  assert.equal(L.c[C.LOCKET_FIRES] - before, 5);
});

test('Toll of Ash through tickWorld never kills; Vesh scalar stays below x2.2', () => {
  const L = mk({ duelist: DUELIST.VESH }); L.recompute(); L.hp = 3;
  L.tollLv = 5;
  for (let t = 0; t < 60 * 60 * 10; t++) { L.hurtPlayer(1, PF.SELF, SRC.SELF); L.tickWorld(); }
  assert.ok(L.hp >= 1); assert.equal(L.c[C.DEATHS], 0);
  assert.ok(L.b7 < 1 + K.veshPer && L.b7 > 2.15, `B7 ${L.b7}`);
});
