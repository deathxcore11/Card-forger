// Skeptic engine review (22 Nov): determinism, integration-safety and test-honesty regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { K } from '../src/tuning.js';
import { Ledger, SRC, EBIT, HF, C, CAP, EV, FX, OT, DUELIST, hitFlags, dlog2 } from '../src/stats.js';
import { runMinute } from '../src/loadout.js';
import { BUILDS } from '../sim/builds.mjs';
import { benchPerHitPath } from '../src/bench.js';

const src = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');

test('engine sources use no wall clock, no Math.random, and (runtime ledger) no platform-rounded transcendental maths', () => {
  for (const f of ['stats.js', 'loadout.js', 'content.js', 'tuning.js']) {
    const s = src(f);
    assert.ok(!/Math\.random|Date\b|performance\.|hrtime/.test(s), `${f} reads a clock or Math.random`);
  }
  // the Ledger's runtime methods must match the game's dmath contract (+ - * / floor sqrt only)
  const s = src('stats.js'), cls = s.slice(s.indexOf('export class Ledger'));
  assert.ok(!/Math\.(pow|log|log2|log10|exp|sin|cos|tan|atan|atan2|cbrt|hypot)\b/.test(cls), 'Ledger uses a transcendental Math function');
});

test('dlog2 matches Math.log2 and uses only basic arithmetic', () => {
  for (const x of [1, 1.5, 2, 3, 21, 601, 1001, 2e3, 1e6, 0.3]) assert.ok(Math.abs(dlog2(x) - Math.log2(x)) < 1e-12, `dlog2(${x})`);
  const L = new Ledger({ duelist: DUELIST.MIRA }); L.setMiraKills(10000);
  assert.ok(Math.abs(L.miraTempo - K.miraPer * Math.log2(21)) < 1e-8);
});

test('Overtime speed table is a running product (no Math.pow) and still matches 1.02^n to 1e-12', () => {
  for (let n = 1; n < 24; n++) assert.ok(Math.abs(OT.SPD[n] / Math.pow(K.otSpdStep, n) - 1) < 1e-12);
});

test('resolveHit with any src id (incl. ENEMY/SELF/DOT) never reads past the hitMul cache', () => {
  for (const s of [SRC.MON, SRC.ITEM, SRC.ENEMY, SRC.SELF, SRC.DOT]) {
    const L = new Ledger({ pool: 4, enemyHp: 1e9 }); L.recompute();
    L.resolveHit(0, 10, hitFlags(s, EBIT.fire | EBIT.dark, HF.NOCRIT), 0, 0);
    assert.ok(Number.isFinite(L.out[0]) && L.out[0] > 0, `src ${s}: ${L.out[0]}`);
    assert.ok(Number.isFinite(L.brackets(s, EBIT.fire).b2));
  }
});

test('RNG seeding: same seed -> same stream; large seeds still differ in the second stream (no float precision loss)', () => {
  const a = new Ledger({ seed: 0xfffffff0 }), b = new Ledger({ seed: 0xfffffff0 }), c = new Ledger({ seed: 0xfffffff1 });
  for (let i = 0; i < 1000; i++) { const x = a.rngHit(); assert.equal(x, b.rngHit()); a.rngWorld(); b.rngWorld(); }
  assert.ok(Number.isInteger(a.rs[1]) && a.rs[1] !== 0);
  let same = 0; for (let i = 0; i < 64; i++) if (new Ledger({ seed: 0xfffffff0 }).rngWorld() === c.rngWorld()) same++;
  assert.ok(same < 4);
});

test('the sim is seed-driven: interleaved runs agree, and a different seed changes the result', () => {
  const b = BUILDS.find(x => x.id === 'broken'), o = { warmSec: 5, measureSec: 10 };
  const r1 = runMinute(b, 12, o), other = runMinute({ ...b, seed: b.seed + 1 }, 12, o), r2 = runMinute(b, 12, o);
  assert.equal(r1.dpm, r2.dpm); assert.deepEqual(r1.counters, r2.counters);
  assert.notEqual(r1.counters.CRITS, other.counters.CRITS, 'seed is not wired into the combat RNG');
});

test('Graveyard Bell spends its bank on the next allowed toll', () => {
  const L = new Ledger({ pool: 64, enemyHp: 1 });
  L.recompute(); L.bellN = 1; L.setEffects(EV.KILL, [FX.BELL]);
  const f = hitFlags(SRC.MON, 0);
  for (let k = 0; k < 50 * 60; k++) { L.resolveHit(k % 64, 10, f, 0, 0); if (k % 64 === 63) L.drainKills(); }
  L.drainKills();
  assert.ok(Math.abs(L.bellBank - K.bellBankMax) < 1e-9);
  L.tick += 70 * K.hz;                                      // the window forgets
  for (let k = 0; k < 50; k++) { L.resolveHit(k % 64, 10, f, 0, 0); L.drainKills(); }
  assert.equal(L.c[C.BELL_TOLLS], 21); assert.equal(L.bellBank, 0);
});

test('per-hit bench reports the counters it names (reactions really happen on the measured path)', async () => {
  const r = await benchPerHitPath(2e5);
  assert.ok(r.reacts > 0 && r.procs > 0 && r.crits > 0);
  assert.ok(r.crits < r.hits && r.reacts < r.hits && Number.isInteger(r.crits), 'labels point at the wrong counters');
});
