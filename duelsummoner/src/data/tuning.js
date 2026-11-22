// K: every balance constant of the stat engine (the Ledger), by the name design/stat-engine/SPEC.md uses. Ported from the reference prototype.
// The sim never hard-codes a balance number: it reads K. Status: numbers are the spec's; none is confirmed in a played seed yet.
// Phase 1 of the port reads: lvlSlope, lvlRate, form, tier, knee1/kneeK1, knee4/kneeK4, critBase, critCap, procCap and the curve k values.

// Score weights for verified leaderboards (placeholders). Integers only; the run score is floor(sum x difficulty multiplier).
export const SCORE = Object.freeze({ kill: 1, elite: 100, bossA: 250, bossB: 250, gate: 1000, other: 400, stage: 2000, overtimeSec: 5, fusion: 300, god: 1500, secret: 6000 });

export const K = Object.freeze({
  hz: 60,
  lutN: 1024,                       // curved stats are clamped to 0..1023 points

  // ---- curves (section 3) ----
  guardK: 20, guardCap: 0.85,
  sideK: 60, sideCap: 0.55,
  keenBase: 0.05, keenSpan: 0.75, keenK: 40,
  fervK: 30,
  fortK: 50,
  rewindFloor: 0.25,
  bargainK: 5000, bargainCap: 0.65,
  strideKnee: 0.6,
  magCap: 1.8, reachCap: 1.5,
  procCap: 0.95,

  // ---- brackets (section 2) ----
  knee1: 1.0, kneeK1: 1.5,          // MIGHT -> x3.5 asymptote
  knee2: 1.0, kneeK2: 1.0,          // SOURCE -> x3.0
  affCap: 2.0,                      // AFFINITY hard x3.0
  markBase: 0.30, revealBonus: 0.10, shredBonus: 0.20,
  knee4: 1.0, kneeK4: 0.8,          // TARGET -> x2.8
  critBase: 1.75, critCap: 6.0,
  resoCap: 1.5,
  resolvePerStep: 0.04,             // OVERTIME bracket, linear
  hiddenPer: 0.03, hiddenMax: 60, hiddenReveal: 25,
  // Rate and flat stats: SPEC.md v1 had no ceiling on these (found by the boundedness probe, see SIM-REPORT.md).
  tempoKnee: 1.0, tempoKneeK: 1.0,  // TEMPO (monster rate) -> x3.0 asymptote
  drawKnee: 1.0, drawKneeK: 1.0,    // DRAW (card rate) -> x3.0 asymptote
  volleyCap: 6,                     // extra projectiles / targets
  edgeCap: 3000,                    // EDGE flat, x100 units -> +30 flat per hit for a 1 s weapon
  edgeRefCd: 1.0,                   // Edge per hit = edge x weapon cd / edgeRefCd, so Edge adds the same DPS per target to every weapon
                                    // (flat per hit let a 0.1 s beam gain x18 from Edge while a God Fusion gained x1.3; skeptic review 22 Nov)
  locketGuardCap: 120,              // Thornbound Locket reads min(Guard, this)
  copyCap: 4, copyK: 2,             // on-event items (Locket, Recoil Seal, Bell): n copies act as 1 + (cap-1)(n-1)/((n-1)+k), x4 asymptote

  // ---- levels, forms, tiers (section 8) ----
  lvlSlope: 0.12, lvlRate: 0.025,
  form: [1.0, 1.3, 1.7], formAt: [1, 5, 10],
  tier: [1.0, 3.2, 8.5, 22],        // Monster, Fusion, God Fusion, Secret Fusion
  tierAura: [0, 500, 1000, 1500],   // team-wide MIGHT bp
  tierArrive: [1, 1, 10, 10],
  fusionInherit: 0.5,
  monsterMax: 10, stMax: 5, zonesMon: 4, zonesST: 4,

  // ---- Tuning rolls and rarity factors ----
  rarityNames: ['Plain', 'Bright', 'Gilded', 'Radiant', 'Mythic'],
  rarityFactor: [1.0, 1.3, 1.7, 2.2, 3.0],
  rarityWeight: [620, 250, 100, 26, 4],
  tiltK: 1.5,
  tunePool: ['dmg', 'rate', 'area', 'coef', 'proj'],
  tunePoolWeight: [1, 1, 1, 1, 0.25],
  tuneInc: { dmg: 600, rate: 400, area: 500, coef: 10, proj: 1 },   // bp, bp, bp, /200 units, count
  coefMax: 200,

  // ---- proc coefficients, stored as value/200 (section 4) ----
  proc: { strike: 200, pierce: 120, multi: 90, pulse: 110, cone: 80, beam: 30, mark: 90,
          card: 160, pit: 120, gust: 80, spell: 60, item: 50, explode: 40, chain: 0, splash: 0, dot: 0 },

  // ---- per hit / per tick caps (5.1) ----
  reactPerHit: 1, statusPerHit: 2,
  reactIcd: 30, whiteoutLock: 360, eclipseLock: 240,
  chainMax: 6, chainBudget: 400,
  explodeDepth: 1, explodeBudget: 32, spillRing: 128, fxBudget: 64,
  killQ: 16384,

  // ---- per minute caps (5.2) ----
  capBuckets: 7,                    // SPEC v1 said 6: that admits 2x the limit in a true 60 s window (see caps test)
  capBucketTicks: 600,              // 10 s buckets
  capLimit: { HURT_TRAP: 30, HURT_TRAP_SELF: 12, SELF_PROC: 15, KILL_STACK: 150, BELL: 20, MARK_EXPLODE: 540, DUEL_GAIN: 600 },
  healPct: 0.08,                    // HEAL_ONHIT per 10 s bucket, fraction of Max LP

  // ---- elements and reactions (section 9) ----
  statusP0: [1.0, 0.8, 0.6, 0.8, 0.5, 0.4, 0.5, 0.3],   // fire ice lightning poison wind earth light dark
  burnPct: 0.25, burnTicks: 180, venomPct: 0.15, venomTicks: 300,
  arcFalloff: 0.5, auraTicks: 150, revealTicks: 180, shredTicks: 180, markTicks: 360,
  drainPct: 0.01,
  react: {                          // [elemA, elemB, R]
    THERMAL: ['fire', 'ice', 1.8], TOXIC: ['fire', 'poison', 1.2], WILDFIRE: ['fire', 'wind', 1.3],
    SHATTER: ['lightning', 'ice', 1.5], TEMPEST: ['lightning', 'wind', 1.2], SANDBLAST: ['earth', 'wind', 1.1],
    MIRE: ['poison', 'earth', 1.2], WHITEOUT: ['ice', 'wind', 1.3], ECLIPSE: ['light', 'dark', 2.5]
  },
  toxicSplash: 0.4, toxicTargets: 2, wildfireTargets: 3, tempestJumps: 2,

  // ---- player and self-damage (section 6) ----
  baseLp: 100, graceSec: 0.25, wardCdSec: 20,
  tollEverySec: 5, tollPct: 0.03,
  trapDmgPerLevel: 0.25,
  gustCdSec: 4, pitCdSec: 6,
  locketPerGuard: 6, locketTargets: 8,
  recoilMul: 2.0,
  bellEvery: 50, bellBase: 10, bellTargets: 6, bellBankStep: 0.10, bellBankMax: 2.5,
  tallyBp: 40, tallySec: 20,

  // ---- duelists (section 11) ----
  kaelPer: 0.025, kaelCap: 2.5,
  miraPer: 800, miraDiv: 500, miraCap: 9000,
  veshPer: 1.2,
  orenPer: 3, orenCap: 60,

  // ---- Overtime (section 13) ----
  otStartMin: 8, otStepSec: 30,
  otHpStep: 1.22, otDmgStep: 1.10, otSpdStep: 1.02, otSpdCap: 1.6, otHpPostCap: 1.0,
  // Run rule: HP x1.22, dmg x1.10, speed x1.02 per 30 s. The speed cap matches the game (waves.js speedCap 1.6);
  // otHpPostCap stays 1.0 so HP growth is exactly x1.22 (an earlier draft added a hidden x1.01 kicker).
  otLutN: 400,
  preOtDmgPerMin: 0.06, preOtDmgFromMin: 3,
  R8: 7000, densStep: 0.02, preOtExp: 2,
  levelsPreOt: 60, otDrawPerMin: 1, otXpLevelsPerMin: 2,   // otXpLevelsPerMin is a sim assumption

  // ---- player card throw ----
  cardBase: 2, cardCd: 0.8,

  // ---- sim-only environment (not content) ----
  // Sim enemies: spawns arrive at simSpawnPerMin x (1 + densStep n); average HP = R(t) / spawns, floored at simEnemyHpMin.
  // This makes R(t) exactly the HP arriving per minute, so effective DPM >= R(t) means the build keeps up.
  simPool: 96, simEnemyHp: 6, simSpawnPerMin: 360, simEnemyHpMin: 4, simSpecialShare: 0.04, simMaxTargets: 12,
  simContactPerSec: 0.25, enemyTouch: 8,
  simKillsPerMinPre: 1200, simKillsPerMinOt: 12000      // run-total kill estimate fed to Mira's passive
});

