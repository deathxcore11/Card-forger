// The Ledger: stat sheet, damage brackets, hyperbolic curves, proc coefficients, per-minute caps,
// the hit pipeline (resolveHit / resolveTick) and the self-damage pipeline (hurtPlayer, 1 HP floor).
// Rules: add within a bracket, multiply across brackets. Every constant comes from K.
// Hot paths (resolveHit, resolveTick, hurtPlayer, tickWorld, drainKills) allocate nothing:
// all state is typed arrays, results go to this.out (Float64Array), RNG returns 24-bit ints.

import { K } from './tuning.js';

// ---------------------------------------------------------------- enums
const STAT_NAMES = [
  'MIGHT', 'EDGE', 'KEEN', 'FERO', 'FERV', 'RESO', 'HUNT', 'SWARM', 'MARKD',
  'AFF_FIRE', 'AFF_ICE', 'AFF_LIGHTNING', 'AFF_POISON', 'AFF_WIND', 'AFF_EARTH', 'AFF_LIGHT', 'AFF_DARK',
  'SRC_MON', 'SRC_CARD', 'SRC_TRAP', 'SRC_SPELL', 'SRC_ITEM',
  'TEMPO', 'DRAW', 'REWIND', 'REACH', 'VOLLEY',
  'LP', 'GUARD', 'SIDE', 'REGEN', 'WARD',
  'STRIDE', 'DASH', 'DASHCD', 'LIFT', 'MAG', 'GREED', 'INSIGHT', 'BARGAIN', 'FORT'
];
export const STAT = Object.freeze(Object.fromEntries(STAT_NAMES.map((n, i) => [n, i])));
export const STAT_N = STAT_NAMES.length;
export const STAT_NAME = Object.freeze(STAT_NAMES.slice());
export const CURVED = Object.freeze([STAT.KEEN, STAT.FERV, STAT.GUARD, STAT.SIDE, STAT.FORT]);

export const ELEMS = Object.freeze(['fire', 'ice', 'lightning', 'poison', 'wind', 'earth', 'light', 'dark']);
export const EBIT = Object.freeze(Object.fromEntries(ELEMS.map((e, i) => [e, 1 << i])));
export const elemMask = list => (list || []).reduce((m, e) => m | (EBIT[e] || 0), 0);

export const SRC = Object.freeze({ MON: 0, CARD: 1, TRAP: 2, SPELL: 3, ITEM: 4, ENEMY: 5, SELF: 6, DOT: 7 });
export const BR = Object.freeze({ BASE: 0, MIGHT: 1, SOURCE: 2, AFFINITY: 3, TARGET: 4, CRIT: 5, REACTION: 6, DUELIST: 7, OVERTIME: 8, HIDDEN: 9 });
// hit flags (Uint16): src(3) | elem(8)<<3 | NOCRIT | NOCHAIN | AREA | SELF
export const HF = Object.freeze({ ELEM_SHIFT: 3, NOCRIT: 1 << 11, NOCHAIN: 1 << 12, AREA: 1 << 13, SELF: 1 << 14 });
export const hitFlags = (src, em, extra = 0) => (src & 7) | ((em & 255) << 3) | extra;
// target flags for B4
export const TF = Object.freeze({ SPECIAL: 1, MARKED: 2, REVEAL: 4, SHRED: 8 });
// hurt flags (Uint8)
export const PF = Object.freeze({ SELF: 1, PIERCE: 2, TRUE: 4 });
export const CAP = Object.freeze({ HURT_TRAP: 0, HURT_TRAP_SELF: 1, SELF_PROC: 2, KILL_STACK: 3, BELL: 4, MARK_EXPLODE: 5, DUEL_GAIN: 6 });
export const CAP_N = 7;
export const CAP_NAME = Object.freeze(Object.keys(CAP));
export const EV = Object.freeze({ HURT: 0, DODGE: 1, BLOCK: 2, KILL: 3, REACT: 4 });
export const FX = Object.freeze({ NONE: 0, GUST_WARD: 1, LOCKET_NOVA: 2, RECOIL_SEAL: 3, BELL: 4, TALLY: 5, MARK_EXPLODE: 6 });
export const DUELIST = Object.freeze({ NONE: 0, KAEL: 1, MIRA: 2, VESH: 3, OREN: 4 });

// counters (ledger.c)
const C_NAMES = ['HITS', 'DMG', 'EFF', 'CRITS', 'PROCS', 'REACTS', 'KILLS', 'CHAINS', 'CHAIN_DROPPED', 'EXPLODES', 'EXPLODE_SPILLED',
  'EXPLODE_DROPPED', 'HURTS', 'SELF_HURTS', 'DODGES', 'BLOCKS', 'FLOOR_SAVES', 'DEATHS', 'SELF_DEATHS', 'TRAP_FIRES',
  'LOCKET_FIRES', 'RECOIL_FIRES', 'BELL_TOLLS', 'BELL_BANKED', 'TALLY_STACKS', 'HEALED', 'HEAL_CLIPPED', 'STATUSES',
  'KILLQ_DROPPED', 'OT_CLAMPED', 'CAP_DENIED', 'ITEM_PROCS'];
export const C = Object.freeze(Object.fromEntries(C_NAMES.map((n, i) => [n, i])));
export const C_N = C_NAMES.length;

// ---------------------------------------------------------------- curves
export const hyp = (x, k) => x / (k + x);
export function knee(s, a, k) { return s <= a ? s : a + (s - a) * k / ((s - a) + k); }
const lut = fn => { const a = new Float32Array(K.lutN); for (let i = 0; i < K.lutN; i++) a[i] = fn(i); return a; };
export const LUT = Object.freeze({
  guard: lut(g => Math.min(hyp(g, K.guardK), K.guardCap)),
  side: lut(s => Math.min(hyp(s, K.sideK), K.sideCap)),
  crit: lut(k => K.keenBase + K.keenSpan * hyp(k, K.keenK)),
  ferv: lut(f => 1 + hyp(f, K.fervK)),
  fort: lut(f => hyp(f, K.fortK))
});
export const clampPts = v => (v < 0 ? 0 : v >= K.lutN ? K.lutN - 1 : v | 0);
export const rewindMul = rew => Math.max(K.rewindFloor, 1e4 / (1e4 + Math.max(0, rew)));
export const bargain = b => K.bargainCap * hyp(Math.max(0, b), K.bargainK);
export const strideSoft = s => (s <= K.strideKnee ? s : K.strideKnee + (s - K.strideKnee) / 2);
export const lvlMul = L => 1 + K.lvlSlope * (L - 1);
export const rateMul = L => 1 + K.lvlRate * (L - 1);
// on-event item copies: 1 copy = 1, then hyperbolic toward K.copyCap (every player BASE source needs a ceiling)
export const copyEff = n => (n <= 1 ? Math.max(0, n) : 1 + (K.copyCap - 1) * (n - 1) / ((n - 1) + K.copyK));
// Edge per hit scales with the weapon's cooldown, so it adds the same DPS per target to fast and slow weapons
export const edgePerHit = (edge, cd) => edge * cd / K.edgeRefCd;
export const formOf = L => (L >= K.formAt[2] ? 2 : L >= K.formAt[1] ? 1 : 0);

// ---------------------------------------------------------------- reactions
export const RX = Object.freeze(Object.fromEntries([['NONE', 0], ...Object.keys(K.react).map((n, i) => [n, i + 1])]));
export const RX_NAME = Object.freeze(['NONE', ...Object.keys(K.react)]);
export const RX_R = new Float64Array(RX_NAME.length);
export const REACT = new Uint8Array(64);
for (const [name, [a, b, r]] of Object.entries(K.react)) {
  const ia = ELEMS.indexOf(a), ib = ELEMS.indexOf(b), id = RX[name];
  REACT[ia * 8 + ib] = id; REACT[ib * 8 + ia] = id; RX_R[id] = r;
}
const P0 = Float64Array.from(K.statusP0);
export const PROC_CAP_THR = Math.floor(K.procCap * 16777216);   // 0.95 of 2^24; a roll can never pass 100%

// ---------------------------------------------------------------- Overtime tables
export const OT = (() => {
  const n = K.otLutN + 1, HP = new Float64Array(n), DMG = new Float64Array(n), SPD = new Float64Array(n);
  HP[0] = DMG[0] = SPD[0] = 1; let rawSpd = 1;
  for (let i = 1; i < n; i++) {
    rawSpd *= K.otSpdStep;                               // running product: no Math.pow (bit-exact on every platform)
    SPD[i] = Math.min(rawSpd, K.otSpdCap);
    DMG[i] = DMG[i - 1] * K.otDmgStep;
    HP[i] = HP[i - 1] * K.otHpStep * (rawSpd > K.otSpdCap ? K.otHpPostCap : 1);
  }
  return Object.freeze({ HP, DMG, SPD });
})();
// Deterministic log2 for the runtime path (Mira): only + - * / and comparisons, like the game's src/sim/dmath.js,
// so a port gets the same bits. Math.log2 is not required by ECMAScript to be correctly rounded.
export function dlog2(x) {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN;
  let e = 0;
  while (x >= 2) { x *= 0.5; e++; }
  while (x < 1) { x *= 2; e--; }
  const t = (x - 1) / (x + 1), t2 = t * t;              // x in [1, 2): t in [0, 1/3); ln x = 2 atanh t
  let s = 1 / 29;
  for (let k = 27; k >= 1; k -= 2) s = 1 / k + t2 * s;
  return e + 2 * t * s / 0.6931471805599453;
}
export const otStepAt = tMin => (tMin < K.otStartMin ? -1 : Math.floor((tMin - K.otStartMin) * 60 / K.otStepSec + 1e-9));
const otIdx = n => (n < 0 ? 0 : n > K.otLutN ? K.otLutN : n);
export const enemyHpMul = tMin => OT.HP[otIdx(otStepAt(tMin))];
export function enemyHitAt(tMin) {
  const pre = 1 + K.preOtDmgPerMin * Math.max(0, tMin - K.preOtDmgFromMin);
  return K.enemyTouch * pre * OT.DMG[otIdx(otStepAt(tMin))];
}
export function enemyHpAt(tMin) {                        // sim only: average enemy HP so that R(t) = HP x spawns
  if (tMin < K.otStartMin) return Math.max(K.simEnemyHpMin, requiredDpm(tMin) / K.simSpawnPerMin);
  return Math.max(K.simEnemyHpMin, K.R8 / K.simSpawnPerMin * OT.HP[otIdx(otStepAt(tMin))]);
}
export const spawnsPerMin = tMin => requiredDpm(tMin) / enemyHpAt(tMin);
export function requiredDpm(tMin) {
  if (tMin < K.otStartMin) return K.R8 * Math.pow(tMin / K.otStartMin, K.preOtExp);
  const n = otStepAt(tMin);
  return K.R8 * OT.HP[otIdx(n)] * (1 + K.densStep * n);
}

// ---------------------------------------------------------------- per-minute caps
// Rolling window of B buckets of 10 s. With B = 7 any true 60 s window is covered by one check window
// (current bucket + 6 previous), so the limit holds for every sliding minute. Integer, deterministic.
export class Caps {
  constructor(buckets = K.capBuckets, auditN = 0) {
    this.nb = buckets;
    this.cnt = new Uint16Array(CAP_N * buckets);
    this.ep = new Int32Array(CAP_N * buckets).fill(-1);
    this.limit = new Uint16Array(CAP_N);
    for (const [k, v] of Object.entries(K.capLimit)) this.limit[CAP[k]] = v;
    this.denied = new Float64Array(CAP_N);
    this.used = new Float64Array(CAP_N);
    this.auditN = auditN;                                  // optional log of take ticks for an independent check
    this.log = auditN ? new Int32Array(CAP_N * auditN) : null;
    this.logN = new Int32Array(CAP_N);
  }
  window(cap, tick) {
    const e = (tick / K.capBucketTicks) | 0, nb = this.nb, base = cap * nb;
    let s = 0;
    for (let j = 0; j < nb; j++) { const ej = this.ep[base + j]; if (ej > e - nb && ej <= e) s += this.cnt[base + j]; }
    return s;
  }
  can(cap, tick, amt) { return this.window(cap, tick) + amt <= this.limit[cap]; }
  take(cap, tick, amt) {
    if (!this.can(cap, tick, amt)) { this.denied[cap] += amt; return false; }
    const e = (tick / K.capBucketTicks) | 0, b = cap * this.nb + (e % this.nb);
    if (this.ep[b] !== e) { this.ep[b] = e; this.cnt[b] = 0; }
    this.cnt[b] += amt; this.used[cap] += amt;
    if (this.log !== null) for (let a = 0; a < amt; a++) { const n = this.logN[cap]; if (n < this.auditN) { this.log[cap * this.auditN + n] = tick; this.logN[cap] = n + 1; } }
    return true;
  }
  // independent check: max events in any sliding window of `ticks` length, from the audit log
  maxSliding(cap, ticks = 60 * K.hz) {
    const n = this.logN[cap], o = cap * this.auditN; let best = 0, lo = 0;
    for (let hi = 0; hi < n; hi++) { while (this.log[o + hi] - this.log[o + lo] >= ticks) lo++; if (hi - lo + 1 > best) best = hi - lo + 1; }
    return best;
  }
}

// ---------------------------------------------------------------- the ledger
export class Ledger {
  constructor(opts = {}) {
    const N = this.N = opts.pool || K.simPool;
    this.specLiteral = !!opts.specLiteral;               // true: SPEC v1 formulas with no rate/flat ceilings (probe only)
    this.pts = new Int32Array(STAT_N);
    this.hitMul = new Float64Array(2048); this.stamp = new Uint32Array(2048); this.gen = 1;   // key = src(3 bits) << 8 | elem mask: every src id fits
    this.b1 = 1; this.b2 = new Float64Array(5); this.aff = new Float64Array(8); this.b4 = new Float64Array(16);
    this.b7 = 1; this.b8 = 1; this.b9 = 1; this.tail = 1;
    this.critChance = K.keenBase; this.critThresh = 0; this.critMul = K.critBase; this.fervMul = 1; this.resoMul = 1;
    this.guardMit = 0; this.evade = 0; this.evadeThresh = 0; this.tempoMul = 1; this.drawMul = 1; this.reachMul = 1;
    this.volley = 0; this.edge = 0; this.rewind = 1;
    this.duelist = opts.duelist | 0; this.coins = 0; this.runKills = 0; this.otStep = -1; this.hidden = 0;
    this.stLevels = 0; this.dirtyDuelist = false; this.miraTempo = 0;
    const seed = (opts.seed >>> 0) || 0x9e3779b9;
    // Math.imul, not seed * 2654435761: a plain multiply past 2^53 loses the low bits a 32-bit port would keep
    this.rs = new Int32Array([seed | 1, Math.imul(seed ^ (seed >>> 16), 0x9e3779b1) | 1]);
    // enemies (SoA)
    this.ehp = new Float64Array(N); this.alive = new Uint8Array(N); this.special = new Uint8Array(N);
    this.aura = new Uint8Array(N); this.auraT = new Uint8Array(N); this.rlock = new Uint8Array(N); this.lockT = new Uint16Array(N);
    this.markT = new Uint16Array(N); this.revealT = new Uint8Array(N); this.shredT = new Uint8Array(N);
    this.burnDps = new Float64Array(N); this.burnT = new Int16Array(N); this.venomDps = new Float64Array(N); this.venomT = new Int16Array(N);
    this.enemyHp = opts.enemyHp || K.simEnemyHp; this.specialShare = opts.specialShare ?? K.simSpecialShare; this.specialAcc = 0;
    // player
    this.maxLp = K.baseLp; this.hp = K.baseLp; this.regen = 0; this.wards = 0; this.wardMax = 0; this.wardT = 0;
    this.grace = 0; this.dashT = 0; this.godMode = false; this.gameOver = false; this.respawnOnDeath = !!opts.respawnOnDeath;
    this.healEpoch = -1; this.healUsed = 0;
    // results and counters
    this.out = new Float64Array(2);
    this.f = new Float64Array(8);                        // scratch registers for doubles passed between hot methods
    this.c = new Float64Array(C_N);
    this.dmgBy = new Float64Array(8); this.takenBy = new Float64Array(8);
    this.rxCount = new Float64Array(RX_NAME.length);
    this.caps = new Caps(opts.capBuckets || K.capBuckets, opts.capAudit | 0);
    // compiled event lists: Int16 effect ids, 16 per event
    this.evList = new Int16Array(5 * 16); this.evN = new Uint8Array(5);
    // world
    this.chainMax = K.chainMax;                         // a Secret Fusion trait may lift this one cap
    this.tick = 0; this.depth = 0; this.chainsTick = 0; this.explodesTick = 0; this.cursor = 0;
    this.kq = new Int32Array(K.killQ); this.kqH = 0; this.kqT = 0;
    this.spill = new Int32Array(K.spillRing); this.spH = 0; this.spN = 0;
    // content state (set by applyLoadout)
    this.gustLv = 0; this.gustReady = 0; this.locketN = 0; this.recoilN = 0; this.bellN = 0; this.bellKills = 0; this.bellBank = 0;
    this.tallyN = 0; this.tallyRing = new Uint16Array(K.tallySec); this.tallyActive = 0; this.tallySec = 0;
    this.tempestBonus = 0; this.explodeBase = 0; this.explodeTargets = 0; this.explodeElem = 0; this.tollLv = 0; this.tollT = 0;
    for (let i = 0; i < N; i++) this.spawn(i);
  }

  // xorshift32, 24-bit integer result (always a small integer: no boxing)
  rngHit() { let x = this.rs[0]; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rs[0] = x; return x >>> 8; }
  rngWorld() { let x = this.rs[1]; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rs[1] = x; return x >>> 8; }

  setEffects(ev, ids) { this.evN[ev] = ids.length; for (let k = 0; k < ids.length; k++) this.evList[ev * 16 + k] = ids[k]; }
  addEffect(ev, id) { const n = this.evN[ev]; for (let k = 0; k < n; k++) if (this.evList[ev * 16 + k] === id) return; this.evList[ev * 16 + n] = id; this.evN[ev] = n + 1; }

  // ---------------------------------------------------------- recompute (cold path)
  recompute() {
    const p = this.pts, lit = this.specLiteral;
    for (const s of CURVED) p[s] = clampPts(p[s]);
    this.setB1();
    for (let s = 0; s < 5; s++) this.b2[s] = 1 + knee(Math.max(0, p[STAT.SRC_MON + s]) / 1e4, K.knee2, K.kneeK2);
    for (let e = 0; e < 8; e++) this.aff[e] = Math.max(0, p[STAT.AFF_FIRE + e]) / 1e4;
    this.critChance = LUT.crit[p[STAT.KEEN]];
    this.critThresh = Math.floor(this.critChance * 16777216);
    this.critMul = Math.min(K.critBase + Math.max(0, p[STAT.FERO]) / 1e4, K.critCap);
    const oren = this.duelist === DUELIST.OREN ? Math.min(K.orenPer * this.stLevels, K.orenCap) : 0;
    this.fervMul = LUT.ferv[clampPts(p[STAT.FERV] + oren)];
    this.resoMul = 1 + Math.min(Math.max(0, p[STAT.RESO]) / 1e4, K.resoCap);
    this.guardMit = LUT.guard[p[STAT.GUARD]];
    this.evade = LUT.side[p[STAT.SIDE]];
    this.evadeThresh = Math.floor(this.evade * 16777216);
    this.maxLp = K.baseLp + Math.max(0, p[STAT.LP]);
    if (this.hp > this.maxLp) this.hp = this.maxLp;
    this.regen = Math.max(0, p[STAT.REGEN]) / 100;
    this.wardMax = Math.max(0, p[STAT.WARD]);
    this.rewind = rewindMul(p[STAT.REWIND]);
    const tempo = (Math.max(0, p[STAT.TEMPO]) + this.miraTempo) / 1e4, draw = Math.max(0, p[STAT.DRAW]) / 1e4;
    this.tempoMul = lit ? 1 + tempo : 1 + knee(tempo, K.tempoKnee, K.tempoKneeK);
    this.drawMul = lit ? 1 + draw : 1 + knee(draw, K.drawKnee, K.drawKneeK);
    this.reachMul = 1 + Math.min(Math.max(0, p[STAT.REACH]) / 1e4, K.reachCap);
    this.volley = lit ? Math.max(0, p[STAT.VOLLEY]) : Math.min(Math.max(0, p[STAT.VOLLEY]), K.volleyCap);
    this.edge = (lit ? Math.max(0, p[STAT.EDGE]) : Math.min(Math.max(0, p[STAT.EDGE]), K.edgeCap)) / 100;
    for (let m = 0; m < 16; m++) {
      let s = 0;
      if (m & TF.MARKED) s += K.markBase + Math.max(0, p[STAT.MARKD]) / 1e4;
      s += (m & TF.SPECIAL ? Math.max(0, p[STAT.HUNT]) : Math.max(0, p[STAT.SWARM])) / 1e4;
      if (m & TF.REVEAL) s += K.revealBonus;
      if (m & TF.SHRED) s += K.shredBonus;
      this.b4[m] = 1 + knee(s, K.knee4, K.kneeK4);
    }
    this.refreshTail();
  }
  setB1() {                                              // MIGHT bracket incl. live Tally stacks; writes a field, returns nothing
    const s = (this.pts[STAT.MIGHT] + this.tallyActive * K.tallyBp) / 1e4, a = K.knee1, k = K.kneeK1;
    this.b1 = 1 + (s <= a ? s : a + (s - a) * k / ((s - a) + k));
  }
  duelistScalar() { this.refreshTail(); return this.b7; }    // cold helper for tests and the HUD
  setMiraKills(kills) {
    this.runKills = kills;
    this.miraTempo = this.duelist === DUELIST.MIRA ? Math.min(K.miraPer * dlog2(1 + Math.max(0, kills) / K.miraDiv), K.miraCap) : 0;
  }
  refreshTail() {
    switch (this.duelist) {
      case DUELIST.KAEL: this.b7 = Math.min(1 + K.kaelPer * Math.sqrt(Math.max(0, this.coins)), K.kaelCap); break;
      case DUELIST.VESH: this.b7 = 1 + K.veshPer * (1 - Math.min(1, Math.max(0, this.hp / this.maxLp))); break;
      default: this.b7 = 1;
    }
    this.b8 = 1 + K.resolvePerStep * Math.max(0, this.otStep);
    this.b9 = 1 + K.hiddenPer * Math.min(Math.max(0, this.hidden), K.hiddenMax);
    this.tail = this.b7 * this.b8 * this.b9;
    this.gen = (this.gen + 1) >>> 0 || 1;
  }
  fillKey(key) {
    const src = key >>> 8, em = key & 255;
    let a = 0, n = 0;
    for (let e = 0; e < 8; e++) if ((em >>> e) & 1) { a += this.aff[e]; n++; }
    const b3 = n ? 1 + Math.min(a / n, K.affCap) : 1;
    this.hitMul[key] = this.b1 * this.b2[src > 4 ? 4 : src] * b3 * this.tail;
    this.stamp[key] = this.gen;
  }
  // bracket values for the tooltip / tests (cold)
  brackets(src, em, tflags = 0) {
    const key = (src << 8) | em; if (this.stamp[key] !== this.gen) this.fillKey(key);
    let a = 0, n = 0; for (let e = 0; e < 8; e++) if ((em >>> e) & 1) { a += this.aff[e]; n++; }
    return { b1: this.b1, b2: this.b2[src > 4 ? 4 : src], b3: n ? 1 + Math.min(a / n, K.affCap) : 1, b4: this.b4[tflags & 15],
      critMul: this.critMul, critChance: this.critChance, b7: this.b7, b8: this.b8, b9: this.b9, hitMul: this.hitMul[key] };
  }

  // ---------------------------------------------------------- hit pipeline (hot)
  // Returns a bit set: 1 crit, 2 reacted, 4 proc. Final damage is written to this.out[0].
  // Doubles never cross a call boundary as arguments or return values (that would box them): they travel
  // through the scratch register file this.f (Float64Array). resolveHit is the small public wrapper.
  resolveHit(i, base, flags, coef, tflags) { this.f[0] = base; return this.hit(i, flags, coef, tflags); }
  hit(i, flags, coef, tflags) {
    if (this.alive[i] === 0) { this.out[0] = 0; return 0; }
    const base = this.f[0];
    const src = flags & 7, em = (flags >>> 3) & 255, key = (src << 8) | em;
    if (this.stamp[key] !== this.gen) this.fillKey(key);
    const snap = base * this.hitMul[key];
    let m = tflags | (this.special[i] ? TF.SPECIAL : 0) | (this.markT[i] ? TF.MARKED : 0) | (this.revealT[i] ? TF.REVEAL : 0) | (this.shredT[i] ? TF.SHRED : 0);
    let d = snap * this.b4[m & 15];
    let res = 0, rx = 0, proc = 0, hit = 0;
    if ((flags & HF.NOCRIT) === 0 && this.rngHit() < this.critThresh) { d *= this.critMul; res |= 1; this.c[C.CRITS]++; }
    if (em !== 0 && coef > 0) {
      hit = 31 - Math.clz32(em & -em);
      const a = this.aura[i];
      if (a !== 0 && a - 1 !== hit && this.rlock[i] === 0 && this.lockT[i] === 0) {
        rx = REACT[hit * 8 + a - 1];
        if (rx !== 0) { d *= 1 + (RX_R[rx] - 1) * this.resoMul; this.aura[i] = 0; this.rlock[i] = K.reactIcd; res |= 2; this.c[C.REACTS]++; this.rxCount[rx]++; }
      }
      // integer threshold out of 2^24; min() against a Smi keeps the value unboxed
      const thr = Math.min(Math.floor(P0[hit] * coef * this.fervMul * 83886.08), PROC_CAP_THR);   // 83886.08 = 2^24 / 200
      if (this.rngHit() < thr) { proc = 1; res |= 4; this.c[C.PROCS]++; }
    }
    this.f[3] = d; this.deal(i, src);
    if (rx !== 0) { this.f[2] = d; this.reactExtra(rx, i, src); }
    if (proc !== 0) { this.f[0] = base; this.f[1] = snap; this.f[2] = d; this.applyStatuses(i, em, rx === 0, flags, hit); }
    this.tempestBonus = 0;
    this.out[0] = d;
    return res;
  }
  // DoT ticks, reaction splash, fixed damage: no crit, no TARGET, no REACTION, proc coef 0
  resolveTick(i, amt, src) { this.f[3] = amt; this.deal(i, src); }
  deal(i, src) {                                         // amount in f[3]
    if (this.alive[i] === 0) return;
    const d = this.f[3], h0 = this.ehp[i];
    this.ehp[i] = h0 - d; this.dmgBy[src] += d; this.c[C.DMG] += d; this.c[C.HITS]++;
    this.c[C.EFF] += d < h0 ? d : h0;                   // effective damage: overkill excluded
    if (this.ehp[i] <= 0 && this.alive[i] !== 0) { this.alive[i] = 0; this.pushKill(i, src, this.depth); }
  }
  applyStatuses(i, em, setAura, flags, hit) {          // base, snap, d in f[0..2]
    const base = this.f[0], snap = this.f[1], d = this.f[2];
    let left = K.statusPerHit;
    for (let e = 0; e < 8 && left > 0; e++) {
      if (((em >>> e) & 1) === 0) continue;
      left--; this.c[C.STATUSES]++;
      switch (e) {
        case 0: { const v = K.burnPct * snap; if (v > this.burnDps[i]) this.burnDps[i] = v; this.burnT[i] = K.burnTicks; break; }
        case 3: { const v = K.venomPct * snap; if (v > this.venomDps[i]) this.venomDps[i] = v; this.venomT[i] = K.venomTicks; break; }
        case 2: if ((flags & HF.NOCHAIN) === 0) { this.f[6] = base * K.arcFalloff; this.chain(i, flags, this.tempestBonus); } break;
        case 6: this.revealT[i] = K.revealTicks; break;
        case 7: this.f[4] = K.drainPct * d; this.healF(); break;
        default: break;                                   // chill, gust, stagger: movement effects (counted only)
      }
    }
    if (setAura && this.alive[i] !== 0) { this.aura[i] = hit + 1; this.auraT[i] = K.auraTicks; }
  }
  chain(i, flags, extra) {                               // jump base in f[6]
    const base = this.f[6];
    let jumps = 1 + this.volley + extra; if (jumps > this.chainMax) jumps = this.chainMax;
    const f = (flags & 0x7ff) | HF.NOCRIT | HF.NOCHAIN;
    for (let j = 1; j <= jumps; j++) {
      if (this.chainsTick >= K.chainBudget) { this.c[C.CHAIN_DROPPED]++; continue; }
      this.chainsTick++; this.c[C.CHAINS]++;
      this.f[0] = base; this.hit((i + j) % this.N, f, K.proc.chain, 0);
    }
  }
  reactExtra(rx, i, src) {                               // hit damage in f[2]
    const N = this.N, d = this.f[2];
    switch (rx) {
      case RX.TOXIC: for (let j = 1; j <= K.toxicTargets; j++) { this.f[3] = d * K.toxicSplash; this.deal((i + j) % N, src); } break;
      case RX.WILDFIRE: { const v = this.burnDps[i]; for (let j = 1; j <= K.wildfireTargets; j++) { const t = (i + j) % N; if (v > this.burnDps[t]) this.burnDps[t] = v; if (v > 0) this.burnT[t] = K.burnTicks; } break; }
      case RX.SANDBLAST: this.shredT[i] = K.shredTicks; break;
      case RX.TEMPEST: this.tempestBonus = K.tempestJumps; break;     // the same hit's chain gets +2 jumps (within chainMax)
      case RX.WHITEOUT: this.lockT[i] = K.whiteoutLock; break;
      case RX.ECLIPSE: this.lockT[i] = K.eclipseLock; break;
      default: break;
    }
  }
  heal(a) { this.f[4] = a; this.healF(); }
  healF() {                                              // amount in f[4]
    const a = this.f[4];
    const e = (this.tick / K.capBucketTicks) | 0;
    if (e !== this.healEpoch) { this.healEpoch = e; this.healUsed = 0; }
    let room = K.healPct * this.maxLp - this.healUsed; if (room < 0) room = 0;
    const g = a < room ? a : room;
    this.healUsed += g; this.c[C.HEALED] += g; this.c[C.HEAL_CLIPPED] += a - g;
    this.hp = Math.min(this.maxLp, this.hp + g);
    if (this.duelist === DUELIST.VESH) this.dirtyDuelist = true;
  }

  // ---------------------------------------------------------- kills (bounded ring, no recursion)
  pushKill(i, cause, depth) {
    const n = (this.kqT + 1) % K.killQ;
    if (n === this.kqH) { this.c[C.KILLQ_DROPPED]++; this.spawn(i); return; }
    this.kq[this.kqT] = i | (cause << 16) | (depth << 24); this.kqT = n;
  }
  spawn(i) {
    this.ehp[i] = this.enemyHp; this.alive[i] = 1; this.aura[i] = 0; this.auraT[i] = 0; this.rlock[i] = 0; this.lockT[i] = 0;
    this.markT[i] = 0; this.revealT[i] = 0; this.shredT[i] = 0; this.burnDps[i] = 0; this.burnT[i] = 0; this.venomDps[i] = 0; this.venomT[i] = 0;
    this.specialAcc += this.specialShare;
    if (this.specialAcc >= 1) { this.specialAcc -= 1; this.special[i] = 1; } else this.special[i] = 0;
  }
  drainKills() {
    let guard = 0;
    while (this.kqH !== this.kqT && guard++ < K.killQ) {
      const v = this.kq[this.kqH]; this.kqH = (this.kqH + 1) % K.killQ;
      const i = v & 0xffff, depth = (v >>> 24) & 0xff;
      this.c[C.KILLS]++; this.runKills++;
      const wasMarked = this.markT[i] !== 0;
      const n = this.evN[EV.KILL];
      for (let k = 0; k < n; k++) {
        switch (this.evList[EV.KILL * 16 + k]) {
          case FX.BELL:
            if (++this.bellKills >= K.bellEvery) {
              this.bellKills = 0;
              if (this.caps.take(CAP.BELL, this.tick, 1)) { this.f[7] = K.bellBase * this.bellN * (1 + this.bellBank); this.toll(); this.bellBank = 0; }
              else { this.bellBank = Math.min(this.bellBank + K.bellBankStep, K.bellBankMax); this.c[C.BELL_BANKED]++; }
            }
            break;
          case FX.TALLY:
            if (this.caps.take(CAP.KILL_STACK, this.tick, 1)) { this.tallyRing[this.tallySec]++; this.tallyActive++; this.c[C.TALLY_STACKS]++; }
            break;
          case FX.MARK_EXPLODE:
            if (wasMarked && depth < K.explodeDepth && this.caps.take(CAP.MARK_EXPLODE, this.tick, 1)) {
              if (this.explodesTick < K.explodeBudget) this.explode(i, depth + 1);
              else if (this.spN < K.spillRing) { this.spill[(this.spH + this.spN) % K.spillRing] = i | ((depth + 1) << 24); this.spN++; this.c[C.EXPLODE_SPILLED]++; }
              else this.c[C.EXPLODE_DROPPED]++;
            }
            break;
          default: break;
        }
      }
      this.spawn(i);
    }
  }
  explode(i, depth) {
    this.explodesTick++; this.c[C.EXPLODES]++;
    const saved = this.depth; this.depth = depth;
    const f = hitFlags(SRC.MON, this.explodeElem, HF.AREA);
    for (let j = 1; j <= this.explodeTargets; j++) { this.f[0] = this.explodeBase; this.hit((i + j) % this.N, f, K.proc.explode, 0); }
    this.depth = saved;
  }
  toll() {                                               // base in f[7]
    this.c[C.BELL_TOLLS]++; this.c[C.ITEM_PROCS]++;
    const f = hitFlags(SRC.ITEM, 0, HF.AREA), base = this.f[7];
    for (let j = 0; j < K.bellTargets; j++) { this.f[0] = base; this.hit(this.nextTarget(), f, K.proc.item, 0); }
  }
  nextTarget() { const t = this.cursor; this.cursor = (t + 1) % this.N; return t; }

  // ---------------------------------------------------------- self-damage pipeline (section 6)
  hurtPlayer(n, flags, src) { this.f[5] = n; return this.hurt(flags, src); }
  hurt(flags, src) {                                     // amount in f[5]
    let n = this.f[5];
    if (this.godMode || this.gameOver) return 0;
    const self = flags & PF.SELF;
    if (this.dashT > 0 && !self) { this.c[C.DODGES]++; this.f[5] = 0; this.emit(EV.DODGE, flags, src); return 0; }
    if ((flags & (PF.SELF | PF.PIERCE)) === 0 && this.rngHit() < this.evadeThresh) { this.c[C.DODGES]++; this.f[5] = 0; this.emit(EV.DODGE, flags, src); return 0; }
    if (!self && this.wards > 0) { this.wards--; this.c[C.BLOCKS]++; this.f[5] = n; this.emit(EV.BLOCK, flags, src); return 0; }
    if ((flags & (PF.SELF | PF.TRUE)) === 0) n = Math.max(1, Math.round(n * (1 - this.guardMit)));
    if (self) {
      const floor = this.hp < 1 ? this.hp : 1;          // never raises LP that is already below 1
      if (this.hp - n < floor) this.c[C.FLOOR_SAVES]++;
      this.hp = Math.max(floor, this.hp - n);
    } else this.hp = Math.max(0, this.hp - n);
    this.takenBy[src & 7] += n;
    if (!self) this.grace = K.graceSec;
    if (this.duelist === DUELIST.VESH) this.dirtyDuelist = true;
    this.c[C.HURTS]++; if (self) this.c[C.SELF_HURTS]++;
    this.f[5] = n; this.emit(EV.HURT, flags, src);
    if (this.hp <= 0) {
      if (self) this.c[C.SELF_DEATHS]++;                // unreachable by construction; asserted by tests
      this.c[C.DEATHS]++;
      if (this.respawnOnDeath) { this.hp = this.maxLp; if (this.duelist === DUELIST.VESH) this.dirtyDuelist = true; } else this.gameOver = true;
    }
    return 1;
  }
  emit(ev, flags, src) {                                 // amount in f[5]
    const n = this.f[5], cnt = this.evN[ev], self = flags & PF.SELF;
    for (let k = 0; k < cnt; k++) {
      switch (this.evList[ev * 16 + k]) {
        case FX.GUST_WARD: {
          if (this.tick < this.gustReady) break;
          if (!this.caps.can(CAP.HURT_TRAP, this.tick, 1) || (self && !this.caps.can(CAP.HURT_TRAP_SELF, this.tick, 1))) { this.c[C.CAP_DENIED]++; break; }
          this.caps.take(CAP.HURT_TRAP, this.tick, 1); if (self) this.caps.take(CAP.HURT_TRAP_SELF, this.tick, 1);
          this.gustReady = this.tick + Math.round(K.gustCdSec * K.hz * this.rewind);
          this.c[C.TRAP_FIRES]++;
          const base = 2 * (1 + K.trapDmgPerLevel * (this.gustLv - 1)), f = hitFlags(SRC.TRAP, EBIT.wind, HF.AREA);
          for (let j = 0; j < 6; j++) { this.f[0] = base; this.hit(this.nextTarget(), f, K.proc.gust, 0); }
          break;
        }
        case FX.LOCKET_NOVA: {
          if (self && !this.caps.take(CAP.SELF_PROC, this.tick, 1)) { this.c[C.CAP_DENIED]++; break; }
          this.c[C.LOCKET_FIRES]++; this.c[C.ITEM_PROCS]++;
          const g = this.specLiteral ? this.pts[STAT.GUARD] : Math.min(this.pts[STAT.GUARD], K.locketGuardCap);
          const base = K.locketPerGuard * g * this.locketN, f = hitFlags(SRC.ITEM, 0, HF.AREA);
          for (let j = 0; j < K.locketTargets; j++) { this.f[0] = base; this.hit(this.nextTarget(), f, K.proc.item, 0); }
          break;
        }
        case FX.RECOIL_SEAL: {
          this.c[C.RECOIL_FIRES]++; this.c[C.ITEM_PROCS]++;
          this.f[0] = K.recoilMul * n * this.recoilN; this.hit(this.nextTarget(), hitFlags(SRC.ITEM, 0, 0), K.proc.item, 0);
          break;
        }
        default: break;
      }
    }
  }

  // ---------------------------------------------------------- 60 Hz world upkeep
  tickWorld() {
    const t = ++this.tick, N = this.N;
    this.chainsTick = 0; this.explodesTick = 0;
    while (this.spN > 0 && this.explodesTick < K.explodeBudget) {
      const v = this.spill[this.spH]; this.spH = (this.spH + 1) % K.spillRing; this.spN--;
      this.explode(v & 0xffff, (v >>> 24) & 0xff);
    }
    for (let i = 0; i < N; i++) {
      if (this.auraT[i] !== 0 && --this.auraT[i] === 0) this.aura[i] = 0;
      if (this.rlock[i] !== 0) this.rlock[i]--;
      if (this.lockT[i] !== 0) this.lockT[i]--;
      if (this.markT[i] !== 0) this.markT[i]--;
      if (this.revealT[i] !== 0) this.revealT[i]--;
      if (this.shredT[i] !== 0) this.shredT[i]--;
    }
    if (t % 6 === 0) {                                     // DoTs at 10 Hz, one multiply per tick, coef 0
      for (let i = 0; i < N; i++) {
        if (this.burnT[i] > 0) { this.f[3] = this.burnDps[i] * 0.1; this.deal(i, SRC.DOT); this.burnT[i] -= 6; if (this.burnT[i] <= 0) this.burnDps[i] = 0; }
        if (this.venomT[i] > 0) { this.f[3] = this.venomDps[i] * 0.1; this.deal(i, SRC.DOT); this.venomT[i] -= 6; if (this.venomT[i] <= 0) this.venomDps[i] = 0; }
      }
    }
    if (this.regen > 0 && this.hp < this.maxLp && this.hp > 0) {
      this.hp = Math.min(this.maxLp, this.hp + this.regen / K.hz);
      if (this.duelist === DUELIST.VESH) this.dirtyDuelist = true;
    }
    if (this.wards < this.wardMax && ++this.wardT >= Math.round(K.wardCdSec * K.hz * this.rewind)) { this.wards++; this.wardT = 0; }
    if (this.grace > 0) this.grace -= 1 / K.hz;
    if (this.dashT > 0) this.dashT--;
    if (this.tollLv > 0 && ++this.tollT >= K.tollEverySec * K.hz) { this.tollT = 0; this.f[5] = this.hp * K.tollPct; this.hurt(PF.SELF, SRC.SELF); }
    if (t % K.hz === 0) {
      if (this.tallyN > 0) {                               // 1 Hz: expire Tally stacks older than tallySec
        this.tallySec = (this.tallySec + 1) % K.tallySec;
        this.tallyActive -= this.tallyRing[this.tallySec]; this.tallyRing[this.tallySec] = 0;
        this.setB1();
        this.gen = (this.gen + 1) >>> 0 || 1;
      }
      if (this.duelist === DUELIST.MIRA) { this.setMiraKills(this.runKills); this.tempoMul = 1 + knee((Math.max(0, this.pts[STAT.TEMPO]) + this.miraTempo) / 1e4, K.tempoKnee, K.tempoKneeK); }
    }
    if (this.dirtyDuelist) { this.dirtyDuelist = false; this.refreshTail(); }   // at most once per tick
    this.drainKills();
  }
}
