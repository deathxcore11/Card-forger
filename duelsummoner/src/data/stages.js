// The three-stage run (design/run-structure.md, draft v1). Everything the stage machine needs is data here, so the numbers can move
// without touching code. Times are seconds on the stage clock. DRAFT: the spec's numbers may still change.
//
// STAND-INS until the real bosses exist (the engine field says which existing fight plays the part):
//   'warden'  : the Sealed Warden fight (a shield on the front, slam circle)
//   'idols'   : the Twin Jackal Idols fight (kill both inside 10 s)
//   'pharaoh' : the old Hollow Pharaoh fight (three phases) used as every gate boss
// hpScale multiplies the stand-in's base HP. gate.hp is the spec's HP before the stage multiplier.
export const RUNSPEC = {
  announceSeconds: 5,        // every timed event is announced this long before it appears
  sigilSeconds: 1.5,         // the boss ring's sigil scorches this long before the boss
  ringMin: 25, ringMax: 40,  // where a boss ring may be, in metres from the duelist
  gateHoldSeconds: 3,        // hold E at an awake gate this long to start the fight early
  descentSeconds: 6, circleSeconds: 15, circleRadius: 3.5,
  descentHeal: 0.4,          // share of missing LP healed by the Descent
  chestPriceCarry: 0.7,      // Card Chest prices fall back to this share at each stage
  tollEnrage: 1.3,           // damage multiplier of a gate boss started by the Toll Bell
  tollHunterEvery: 30, tollHunterCount: 6,
  dmgPerMinute: 0.06,
  // XP shaping: level-ups come slowly early and speed up. The XP gained is scaled by start..end over the first `minutes` run minutes
  // (target: about 4 level-ups a minute through the first 4 minutes of Stage 1, about 7.5 a minute by mid Stage 2).
  xp: { start: 0.7, end: 1.0, minutes: 8, growth: 0.35, growFrom: 4 },    // growth: crystal value rises per run minute after growFrom, so late level-ups stay frequent
  gate: { x: 0, z: -57, radius: 5.5, arena: { x: 0, z: -12 }, tollPull: { x: 0, z: -2 } },   // stand-in map: the existing Colosseum gate
  overtime: { stepSeconds: 30, baseRate: 2, rateStep: 0.35 },
  // Toll Shades, the clock's answer to broken builds: unkillable, they rise when a stage clock hits 0:00 or afterGateSeconds after the gate boss
  // fell with no Descent taken. They steer straight at the duelist through terrain; a touch costs touchPct of max LP as TRUE damage (it can kill).
  shades: { start: 3, addEverySeconds: 10, max: 12, speedFrac: 0.7, speedStepPct: 10, stepSeconds: 10, touchPct: 0.25, touchRadius: 1.2, touchCooldown: 1.2,
            afterGateSeconds: 60, overtimeEverySeconds: 60, overtimeCount: 3, hardMax: 24, spawnMin: 18, spawnMax: 26 }
};

// Difficulty: per-difficulty tables, applied to every stage and Quick Duel. Medium is the base tuning (all multipliers 1).
//   spawn  multiplies the spawn rate; ramp speeds up (above 1) or slows (below 1) how fast the wave table climbs with the stage clock
//   cap    the enemy count cap ramps linearly from start to end over `minutes` run minutes (the hard ceiling is 300)
//   hp, hpCurve   enemy HP multiplier and the per-minute curve (1 + a m + b m^2); dmg, dmgPerMinute   enemy damage
//   boss   elite and boss HP multiplier on top of hp;   score   multiplier on the run score (placeholder values)
export const DIFFICULTY = {
  easy:   { name: 'Easy',   coin: 1.5, score: 0.75, spawn: 0.8,  ramp: 0.8,  cap: { start: 150, end: 300, minutes: 14 }, hp: 0.5, hpCurve: { a: 0.05, b: 0.003 }, dmg: 0.4, dmgPerMinute: 0.04, boss: 0.8 },
  medium: { name: 'Medium', coin: 1, score: 1.0,  spawn: 1.0,  ramp: 1.0,  cap: { start: 300, end: 300, minutes: 1 },  hp: 0.6,  hpCurve: { a: 0.07, b: 0.005 },  dmg: 0.5,  dmgPerMinute: 0.06, boss: 1.0 },
  hard:   { name: 'Hard',   coin: 1, priceMul: 1.5, score: 1.5,  spawn: 1.2,  ramp: 1.25, cap: { start: 300, end: 300, minutes: 1 },  hp: 0.8, hpCurve: { a: 0.12, b: 0.01 }, dmg: 0.7, dmgPerMinute: 0.08, boss: 1.3 }
};
// The Twin Jackal Idols' bite and speed per difficulty (stage runs only; the classic mode keeps the base numbers)
DIFFICULTY.easy.idol = { bite: 10, speed: 5 }; DIFFICULTY.medium.idol = { bite: 12, speed: 5.5 }; DIFFICULTY.hard.idol = { bite: 15, speed: 6 };
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const ev = (t, role, id, name, engine, hpScale, drop) => ({ t, role, id, name, engine, hpScale, drop });

export const STAGES = [
  {
    id: 'ruins', name: 'The Open Desert', clock: 420, mult: 1.0, gateWake: 360, falls: null,
    waves: { offset: 0, scale: 480 / 420 },
    gen: { counts: { cchest: 8, stone: 2, broker: 1, shrine: 2, altar: 1, vaseClusters: 12 } },
    timeline: [
      ev(105, 'elite', 'herald', 'Grave Herald', 'warden', 0.4, 'card'),
      ev(225, 'bossA', 'warden', 'Sealed Warden', 'warden', 1, 'sealed'),
      ev(330, 'bossB', 'idols', 'Twin Jackal Idols', 'idols', 1, 'sealed')],
    gate: { id: 'arbiter', name: 'The Stone Arbiter', engine: 'pharaoh', hp: 2640 }
  },
  {
    id: 'catacombs', name: 'Ashen Orchard', clock: 420, mult: 1.1, gateWake: 360, falls: { lp: 10 },
    waves: { offset: 120, scale: 360 / 420 },
    gen: { counts: { cchest: 7, stone: 1, broker: 1, shrine: 2, altar: 1, vaseClusters: 10 }, minCounts: { cchest: 5, stone: 1, broker: 1, shrine: 2, altar: 1 } },
    timeline: [
      ev(105, 'elite', 'jailer', 'Chainbound Jailer', 'warden', 0.5, 'card'),
      ev(225, 'bossA', 'coffins', 'Coffin Sentinels', 'warden', 1.3, 'sealed'),
      ev(330, 'bossB', 'mirror', 'Mirror Duelist', 'idols', 1.3, 'sealed')],
    gate: { id: 'weaver', name: 'The Seal Weaver', engine: 'pharaoh', hp: 3960 }
  },
  {
    id: 'vault', name: 'Frostbound Archive', clock: 480, mult: 1.2, gateWake: 420, falls: { lp: 15 },
    waves: { offset: 180, scale: 300 / 480 },
    gen: { counts: { cchest: 6, stone: 1, broker: 1, shrine: 2, altar: 1, vaseClusters: 9 }, minCounts: { cchest: 4, stone: 1, broker: 1, shrine: 2, altar: 1 } },
    timeline: [
      ev(120, 'elite', 'executioner', 'Royal Executioner', 'warden', 0.6, 'card'),
      ev(255, 'bossA', 'masks', 'Court of Three Masks', 'warden', 1.6, 'sealed'),
      ev(375, 'bossB', 'heir', 'The Hollow Heir', 'idols', 1.6, 'sealed')],
    gate: { id: 'king', name: 'The Hollow King', engine: 'pharaoh', hp: 5500 }
  }
];

// Quick Duel: one Stage 1 map on an 8:00 clock, the Stage 1 timeline, the Stone Arbiter as gate boss, no Overtime.
export const QUICK = Object.assign({}, STAGES[0], { id: 'quick', name: 'Quick Duel', clock: 480, gateWake: 420, waves: { offset: 0, scale: 1 } });

export const stagesFor = (mode, big) => (mode === 'quick' ? [QUICK] : big ? STAGES_BIG : STAGES);




// Ace monsters: swarm enemies that carry a star crest, take much more to kill, and may drop a Trophy Chest (a free, open, glowing Card Chest). From the run recordings: the first
// crowned enemy shows about 1:24 into a stage and the first elite chest comes about 35 s later. The drop chance falls with every Trophy so they stay a treat.
export const ACES = {
  from: 84, every: 40, max: 3,                         // first at 1:24 of the stage, then one every 40 s, never more than 3 alive
  hpMul: 7, sizeMul: 1.45, speedMul: 0.92, xp: 6, coins: 3,
  trophy: { first: 0.35, decay: 0.07, min: 0.1 },      // chance an Ace drops a Trophy Chest: 35%, then 28%, 21% ... never below 10%
  rarity: [['rare', 0.6], ['epic', 0.3], ['legendary', 0.1]]
};




// ---- The big streamed desert (terrain 'open'): three stages of 12 minutes. The exit door rises near the duelist between doorRise[0] and doorRise[1] on the clock (seeded), hidden behind a ridge or mesa where it can be.
// The wave tables are stretched over the longer clock (offset + scale x clock ends at the same table time as before), stages 2 and 3 start further in. paceK turns run minutes into the old per-stage pace for enemy strength and crystal value, so a 12 minute stage is as hard per fraction of the clock as the old 7 minute one.
const BIG = [
  { clock: 720, gateWake: 600, doorRise: [480, 600], waves: { offset: 0, scale: 480 / 720 }, t: [180, 385, 565] },
  { clock: 720, gateWake: 600, doorRise: [480, 600], waves: { offset: 150, scale: 330 / 720 }, t: [180, 385, 565] },
  { clock: 720, gateWake: 600, doorRise: [480, 600], waves: { offset: 220, scale: 260 / 720 }, t: [205, 430, 640] }
];
export const STAGES_BIG = STAGES.map((s, i) => Object.assign({}, s, { clock: BIG[i].clock, gateWake: BIG[i].gateWake, doorRise: BIG[i].doorRise, waves: BIG[i].waves, big: true, timeline: s.timeline.map((e, k) => Object.assign({}, e, { t: BIG[i].t[k] })) }));
export const BIG_PACE = 7 / 12;

// How much harder the big desert is than the same difficulty's base numbers (tuned with tools/bigbot.mjs, design/balance-log.md): a first-timer on a fresh save should find the door about half the time and clear stage 1 a third of the time.
export const BIG_TUNE = { easy: { hp: 1, spawn: 4.5, dmg: 2.0, boss: 1, gate: 6 }, medium: { hp: 1, spawn: 1, dmg: 1, boss: 1 }, hard: { hp: 1, spawn: 1, dmg: 1, boss: 1 } };
