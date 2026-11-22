import test from 'node:test';
import assert from 'node:assert/strict';
import { K } from '../src/tuning.js';
import { Ledger, LUT, STAT, SRC, EBIT, HF, TF, OT, knee, hyp, hitFlags, rewindMul, bargain, strideSoft, RX, RX_R, REACT, ELEMS, PROC_CAP_THR, STAT_NAME } from '../src/stats.js';
import { rarityWeights, rollRarity } from '../src/loadout.js';
import { BLESSINGS, ITEMS } from '../src/content.js';

const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('LUTs match their formulas at every point', () => {
  for (let i = 0; i < K.lutN; i++) {
    near(LUT.guard[i], Math.min(i / (K.guardK + i), K.guardCap), 1e-6);
    near(LUT.side[i], Math.min(i / (K.sideK + i), K.sideCap), 1e-6);
    near(LUT.crit[i], K.keenBase + K.keenSpan * i / (K.keenK + i), 1e-6);
    near(LUT.ferv[i], 1 + i / (K.fervK + i), 1e-6);
    near(LUT.fort[i], i / (K.fortK + i), 1e-6);
  }
});

test('curve sample values from SPEC section 3', () => {
  near(LUT.guard[4], 0.1667); near(LUT.guard[20], 0.5); near(LUT.guard[60], 0.75);
  near(LUT.side[15], 0.2); near(LUT.side[60], 0.5);
  near(LUT.crit[6], 0.1478); near(LUT.crit[40], 0.425);
  near(LUT.ferv[30], 1.5);
  near(LUT.fort[8], 0.1379); near(LUT.fort[50], 0.5);
  near(rewindMul(10000), 0.5); near(rewindMul(1e9), K.rewindFloor);
  near(bargain(2500), 0.2167);
  near(strideSoft(0.8), 0.7);
});

test('no curve ever reaches 100%: evasion, mitigation, crit, proc', () => {
  const max = a => a.reduce((m, v) => Math.max(m, v), 0);
  assert.ok(max(LUT.side) <= K.sideCap + 1e-7 && max(LUT.side) < 1);
  assert.ok(max(LUT.guard) <= K.guardCap + 1e-7 && max(LUT.guard) < 1);
  assert.ok(max(LUT.crit) < K.keenBase + K.keenSpan && max(LUT.crit) < 1);
  assert.ok(PROC_CAP_THR < 16777216, 'proc threshold below 2^24');
  const L = new Ledger();
  for (const s of [STAT.SIDE, STAT.GUARD, STAT.KEEN, STAT.FERV]) L.pts[s] = 1e9;   // clamped to 1023
  L.recompute();
  assert.ok(L.evade < 1 && L.guardMit < 1 && L.critChance < 1);
  assert.ok(L.evadeThresh < 16777216 && L.critThresh < 16777216);
});

test('knee ceilings hold when stacking 99 copies', () => {
  const L = new Ledger();
  const add = (mods, n) => { for (const [s, v] of mods) L.pts[s] += v * n; };
  add(BLESSINGS.might.mods, 99);
  L.pts[STAT.SRC_MON] = 99 * 1500; L.pts[STAT.AFF_FIRE] = 99 * 1200;
  L.pts[STAT.MARKD] = 99 * 1000; L.pts[STAT.HUNT] = 99 * 2500; L.pts[STAT.FERO] = 99 * 2500; L.pts[STAT.RESO] = 99 * 2000;
  L.recompute();
  assert.ok(L.b1 < 1 + K.knee1 + K.kneeK1 && L.b1 > 3.2, `B1 ${L.b1}`);   // 99 x +10%: 3.28, asymptote 3.5
  assert.ok(L.b2[SRC.MON] < 3.0, `B2 ${L.b2[0]}`);
  near(L.brackets(SRC.MON, EBIT.fire).b3, 3.0, 1e-9);
  assert.ok(L.b4[TF.MARKED | TF.SPECIAL | TF.REVEAL | TF.SHRED] < 2.8);
  assert.equal(L.critMul, K.critCap);
  near(1 + (RX_R[RX.ECLIPSE] - 1) * L.resoMul, 4.75, 1e-9);
  for (const v of [L.b1, ...L.b2, ...L.b4, L.critMul, L.resoMul]) assert.ok(Number.isFinite(v));
});

test('add within a bracket, multiply across brackets (hand computed)', () => {
  const L = new Ledger({ pool: 8, enemyHp: 1e9 });
  L.pts[STAT.MIGHT] = 1000 + 1500;          // two Might sources add: +25%
  L.pts[STAT.SRC_MON] = 5000;               // +50%
  L.pts[STAT.AFF_FIRE] = 1200 + 800;        // two Affinity sources add: +20%
  L.recompute();
  near(L.b1, 1.25, 1e-12); near(L.b2[SRC.MON], 1.5, 1e-12);
  const b = L.brackets(SRC.MON, EBIT.fire);
  near(b.hitMul, 1.25 * 1.5 * 1.2, 1e-12);
  L.resolveHit(0, 10, hitFlags(SRC.MON, EBIT.fire, HF.NOCRIT), 0, 0);   // coef 0: no proc, no reaction
  near(L.out[0], 10 * 2.25, 1e-9);
  // a two-element hit uses the mean of its Affinities
  L.pts[STAT.AFF_ICE] = 0; L.recompute();
  near(L.brackets(SRC.MON, EBIT.fire | EBIT.ice).b3, 1.1, 1e-12);
  // knee: linear to the knee, hyperbolic after
  near(knee(0.5, 1, 1.5), 0.5); near(knee(2.5, 1, 1.5), 1 + 1.5 * 1.5 / 3);
  near(hyp(20, 20), 0.5);
});

test('reaction table is symmetric and Eclipse peaks at x4.75 with max Resonance', () => {
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) assert.equal(REACT[a * 8 + b], REACT[b * 8 + a]);
  assert.equal(REACT[ELEMS.indexOf('fire') * 8 + ELEMS.indexOf('ice')], RX.THERMAL);
  const L = new Ledger({ pool: 4, enemyHp: 1e9 });
  L.pts[STAT.RESO] = 1e7; L.recompute();
  L.aura[0] = ELEMS.indexOf('dark') + 1;
  const res = L.resolveHit(0, 1, hitFlags(SRC.MON, EBIT.light, HF.NOCRIT), 200, 0);
  assert.ok(res & 2, 'reacted');
  near(L.out[0], 4.75, 1e-9);
  assert.equal(L.aura[0], 0, 'aura consumed');
  // reaction internal cooldown: an immediate second reaction is refused
  L.aura[0] = ELEMS.indexOf('dark') + 1;
  assert.equal(L.resolveHit(0, 1, hitFlags(SRC.MON, EBIT.light, HF.NOCRIT), 200, 0) & 2, 0);
});

// A DPS proxy over every offensive stat: if doubling a stat's points 100x still grows this, the stat has no ceiling.
function dpsProxy(L) {
  const b = L.brackets(SRC.MON, EBIT.fire, TF.MARKED | TF.SPECIAL);
  const crit = 1 + L.critChance * (L.critMul - 1), react = 1 + (RX_R[RX.ECLIPSE] - 1) * L.resoMul;
  const g = Math.min(L.pts[STAT.GUARD], L.specLiteral ? 1e12 : K.locketGuardCap);
  return (5 + L.edge) * b.hitMul * b.b4 * crit * react * L.tempoMul * L.drawMul * L.reachMul * (1 + L.volley) * (1 + g) * L.fervMul / L.rewind;
}
const OFFENSIVE = ['MIGHT', 'EDGE', 'KEEN', 'FERO', 'FERV', 'RESO', 'HUNT', 'SWARM', 'MARKD', 'AFF_FIRE', 'SRC_MON', 'TEMPO', 'DRAW', 'REWIND', 'REACH', 'VOLLEY', 'GUARD'];

test('boundedness probe: every offensive stat has a ceiling (no build is unbounded)', () => {
  for (const name of OFFENSIVE) {
    const at = pts => { const L = new Ledger(); L.pts[STAT[name]] = pts; L.recompute(); return dpsProxy(L); };
    const r = at(1e8) / at(1e6);
    assert.ok(Number.isFinite(r) && r < 1.01, `${name} keeps growing: x${r.toFixed(3)} from 1e6 to 1e8 points`);
  }
});

test('boundedness probe: SPEC v1 literal formulas leave TEMPO, DRAW, VOLLEY and EDGE unbounded (why the spec changed)', () => {
  const unbounded = [];
  for (const name of OFFENSIVE) {
    const at = pts => { const L = new Ledger({ specLiteral: true }); L.pts[STAT[name]] = pts; L.recompute(); return dpsProxy(L); };
    if (at(1e8) / at(1e6) > 2) unbounded.push(name);
  }
  assert.deepEqual(unbounded.sort(), ['DRAW', 'EDGE', 'TEMPO', 'VOLLEY']);
  // the Locket is bounded only by the 1023-point clamp: literal it reads 1023 Guard (6138 base), capped it reads 120 (720 base)
  const lit = new Ledger({ specLiteral: true }); lit.pts[STAT.GUARD] = 5000; lit.recompute();
  assert.equal(lit.pts[STAT.GUARD], 1023);
  assert.ok(Math.abs(lit.guardMit - K.guardCap) < 1e-6, 'Guard past ~114 points adds no defence, only Locket damage');
});

test('rarity weights: Fortune tilts toward rare results, floors remove Plain, rolls are valid', () => {
  const w0 = rarityWeights(0), w50 = rarityWeights(50), wf = rarityWeights(0, 1);
  near(w0.reduce((a, b) => a + b, 0), 1, 1e-12);
  near(w0[4], 4 / 1000, 1e-12);
  assert.ok(w50[4] > w0[4] * 2.5 && w50[0] < w0[0]);   // Fortune 50 (phi 0.5): Mythic 0.4% -> 1.1%
  assert.equal(wf[0], 0);
  for (let i = 0; i < 1000; i++) { const r = rollRarity(i / 1000, 30, 0); assert.ok(r >= 0 && r <= 4); }
  assert.deepEqual(K.rarityFactor, [1.0, 1.3, 1.7, 2.2, 3.0]);
});

test('Overtime tables: exact compounding, speed cap, post-cap HP step, finite to n=400', () => {
  near(OT.HP[8], Math.pow(1.22, 8), 1e-9);
  near(OT.DMG[10], Math.pow(1.10, 10), 1e-9);
  const capN = Math.ceil(Math.log(K.otSpdCap) / Math.log(K.otSpdStep));
  assert.equal(OT.SPD[capN + 5], K.otSpdCap);
  near(OT.HP[capN + 3] / OT.HP[capN + 2], K.otHpStep * K.otHpPostCap, 1e-12);
  // fidelity to the run rule: HP x1.22, dmg x1.10 every step with no hidden kicker, speed x1.02 until the game's cap
  assert.equal(K.otHpStep, 1.22); assert.equal(K.otDmgStep, 1.10); assert.equal(K.otSpdStep, 1.02); assert.equal(K.otHpPostCap, 1.0);
  for (const n of [1, 10, capN + 10, 200]) { near(OT.HP[n] / OT.HP[n - 1], 1.22, 1e-12); near(OT.DMG[n] / OT.DMG[n - 1], 1.10, 1e-12); }
  for (const a of [OT.HP, OT.DMG, OT.SPD]) assert.ok(a.every(Number.isFinite));
});

test('content data shape: every modifier is a [STAT, value] pair', () => {
  for (const D of [...Object.values(ITEMS), ...Object.values(BLESSINGS)])
    for (const m of D.mods) { assert.equal(m.length, 2); assert.ok(STAT_NAME[m[0]], `bad stat ${m[0]}`); assert.ok(Number.isFinite(m[1])); }
});
