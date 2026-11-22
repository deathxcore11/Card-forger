import test from 'node:test';
import assert from 'node:assert/strict';
import { K } from '../src/tuning.js';
import { Caps, CAP, Ledger, STAT, SRC, EBIT, EV, FX, C, hitFlags } from '../src/stats.js';

const B = K.capBucketTicks;

test('7-bucket window: an adversarial burst at both ends of a 60 s span cannot exceed the limit', () => {
  const caps = new Caps(7, 1000);
  for (let i = 0; i < 40; i++) caps.take(CAP.BELL, B - 1, 1);         // end of bucket 0
  for (let i = 0; i < 40; i++) caps.take(CAP.BELL, 6 * B, 1);         // start of bucket 6 (50 s later)
  assert.equal(caps.used[CAP.BELL], 20);
  assert.ok(caps.maxSliding(CAP.BELL) <= 20);
});

test('6 buckets (SPEC v1) admits twice the limit inside one true minute: the reason for 7', () => {
  const caps = new Caps(6, 1000);
  for (let i = 0; i < 40; i++) caps.take(CAP.BELL, B - 1, 1);
  for (let i = 0; i < 40; i++) caps.take(CAP.BELL, 6 * B, 1);
  assert.equal(caps.maxSliding(CAP.BELL), 40);
});

test('random bursts: no sliding 60 s window ever exceeds any limit', () => {
  let x = 99;
  const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let trial = 0; trial < 20; trial++) {
    const caps = new Caps(7, 8192);
    let t = 0;
    while (t < 60 * 60 * 8) { t += Math.floor(rnd() * 120); const n = 1 + Math.floor(rnd() * 30); for (let i = 0; i < n; i++) for (let c = 0; c < 6; c++) caps.take(c, t, 1); }
    for (let c = 0; c < 6; c++) assert.ok(caps.maxSliding(c) <= caps.limit[c], `cap ${c}: ${caps.maxSliding(c)} > ${caps.limit[c]}`);
  }
});

test('the window forgets: after 70 s the full limit is available again', () => {
  const caps = new Caps(7);
  for (let i = 0; i < 30; i++) caps.take(CAP.BELL, 0, 1);
  assert.equal(caps.can(CAP.BELL, 69 * 60, 1), false);
  assert.equal(caps.can(CAP.BELL, 70 * 60, 1), true);
  assert.equal(caps.window(CAP.BELL, 70 * 60), 0);
});

test('Graveyard Bell: skipped tolls bank +10% each, at most +250%, and the next toll spends the bank', () => {
  const L = new Ledger({ pool: 64, enemyHp: 1, capAudit: 4096 });
  L.recompute(); L.bellN = 1; L.setEffects(EV.KILL, [FX.BELL]);
  const f = hitFlags(SRC.MON, 0);
  for (let k = 0; k < 50 * 60; k++) { L.resolveHit(k % 64, 10, f, 0, 0); if (k % 64 === 63) L.drainKills(); }
  L.drainKills();
  assert.equal(L.c[C.BELL_TOLLS], 20);
  assert.ok(L.c[C.BELL_BANKED] >= 25);
  assert.ok(Math.abs(L.bellBank - K.bellBankMax) < 1e-9, `bank ${L.bellBank}`);
  assert.ok(L.caps.maxSliding(CAP.BELL) <= 20);
});

test('per-tick budgets: chain jumps <= 400 per tick, explosions <= 32 per tick with a 128-slot spill ring', () => {
  const L = new Ledger({ pool: 4096, enemyHp: 1e12 });
  L.pts[STAT.VOLLEY] = 99; L.pts[STAT.FERV] = 1023; L.recompute();
  const f = hitFlags(SRC.MON, EBIT.lightning);
  for (let i = 0; i < 2000; i++) L.resolveHit(i, 1, f, 200, 0);
  assert.equal(L.c[C.CHAINS], K.chainBudget);
  assert.ok(L.c[C.CHAIN_DROPPED] > 0);

  const E = new Ledger({ pool: 4096, enemyHp: 1 });
  E.recompute(); E.explodeBase = 1; E.explodeTargets = 3; E.setEffects(EV.KILL, [FX.MARK_EXPLODE]);
  for (let i = 0; i < 400; i++) { E.markT[i * 8] = 100; E.resolveHit(i * 8, 5, hitFlags(SRC.MON, 0), 0, 0); }
  E.drainKills();
  assert.equal(E.c[C.EXPLODES], K.explodeBudget);
  assert.equal(E.c[C.EXPLODE_SPILLED], K.spillRing);
  assert.equal(E.c[C.EXPLODE_DROPPED], 400 - K.explodeBudget - K.spillRing);
  E.tickWorld();
  assert.equal(E.c[C.EXPLODES], 2 * K.explodeBudget, 'spill drains at the budget next tick');
  // depth 1: kills caused by an explosion never explode
  assert.ok(E.c[C.KILLS] > 400);
});

test('Dark drain heals at most 8% of Max LP per 10 s bucket', () => {
  const L = new Ledger({ pool: 8, enemyHp: 1e12 }); L.pts[STAT.FERV] = 1023; L.recompute(); L.hp = 1;
  const f = hitFlags(SRC.MON, EBIT.dark);
  for (let i = 0; i < 5000; i++) L.resolveHit(i % 8, 1000, f, 200, 0);
  assert.ok(L.hp - 1 <= K.healPct * L.maxLp + 1e-9, `healed ${L.hp - 1}`);
  assert.ok(L.c[C.HEAL_CLIPPED] > 0);
});
