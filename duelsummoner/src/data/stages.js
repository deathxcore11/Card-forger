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
  overtime: { stepSeconds: 30, baseRate: 2, rateStep: 0.35 }
};

// Difficulty: per-difficulty tables, applied to every stage and Quick Duel. Medium is the base tuning (all multipliers 1).
//   spawn  multiplies the spawn rate; ramp speeds up (above 1) or slows (below 1) how fast the wave table climbs with the stage clock
//   cap    the enemy count cap ramps linearly from start to end over `minutes` run minutes (the hard ceiling is 300)
//   hp, hpCurve   enemy HP multiplier and the per-minute curve (1 + a m + b m^2); dmg, dmgPerMinute   enemy damage
//   boss   elite and boss HP multiplier on top of hp;   score   multiplier on the run score (placeholder values)
export const DIFFICULTY = {
  easy:   { name: 'Easy',   score: 0.75, spawn: 0.8,  ramp: 0.8,  cap: { start: 150, end: 300, minutes: 14 }, hp: 0.85, hpCurve: { a: 0.07, b: 0.005 }, dmg: 0.85, dmgPerMinute: 0.04, boss: 0.8 },
  medium: { name: 'Medium', score: 1.0,  spawn: 1.0,  ramp: 1.0,  cap: { start: 300, end: 300, minutes: 1 },  hp: 1.0,  hpCurve: { a: 0.10, b: 0.008 },  dmg: 1.0,  dmgPerMinute: 0.06, boss: 1.0 },
  hard:   { name: 'Hard',   score: 1.5,  spawn: 1.2,  ramp: 1.25, cap: { start: 300, end: 300, minutes: 1 },  hp: 1.15, hpCurve: { a: 0.18, b: 0.02 }, dmg: 1.15, dmgPerMinute: 0.08, boss: 1.3 }
};
// The Twin Jackal Idols' bite and speed per difficulty (stage runs only; the classic mode keeps the base numbers)
DIFFICULTY.easy.idol = { bite: 10, speed: 5 }; DIFFICULTY.medium.idol = { bite: 12, speed: 5.5 }; DIFFICULTY.hard.idol = { bite: 15, speed: 6 };
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const ev = (t, role, id, name, engine, hpScale, drop) => ({ t, role, id, name, engine, hpScale, drop });

export const STAGES = [
  {
    id: 'ruins', name: 'Surface Ruins', clock: 420, mult: 1.0, gateWake: 360, falls: null,
    waves: { offset: 0, scale: 480 / 420 },
    timeline: [
      ev(105, 'elite', 'herald', 'Grave Herald', 'warden', 0.4, 'card'),
      ev(225, 'bossA', 'warden', 'Sealed Warden', 'warden', 1, 'sealed'),
      ev(330, 'bossB', 'idols', 'Twin Jackal Idols', 'idols', 1, 'sealed')],
    gate: { id: 'arbiter', name: 'The Stone Arbiter', engine: 'pharaoh', hp: 2400 }
  },
  {
    id: 'catacombs', name: 'Sealed Catacombs', clock: 420, mult: 1.1, gateWake: 360, falls: { lp: 10 },
    waves: { offset: 120, scale: 360 / 420 },
    timeline: [
      ev(105, 'elite', 'jailer', 'Chainbound Jailer', 'warden', 0.5, 'card'),
      ev(225, 'bossA', 'coffins', 'Coffin Sentinels', 'warden', 1.3, 'sealed'),
      ev(330, 'bossB', 'mirror', 'Mirror Duelist', 'idols', 1.3, 'sealed')],
    gate: { id: 'weaver', name: 'The Seal Weaver', engine: 'pharaoh', hp: 3600 }
  },
  {
    id: 'vault', name: 'Vault of the Last Duel', clock: 480, mult: 1.2, gateWake: 420, falls: { lp: 15 },
    waves: { offset: 180, scale: 300 / 480 },
    timeline: [
      ev(120, 'elite', 'executioner', 'Royal Executioner', 'warden', 0.6, 'card'),
      ev(255, 'bossA', 'masks', 'Court of Three Masks', 'warden', 1.6, 'sealed'),
      ev(375, 'bossB', 'heir', 'The Hollow Heir', 'idols', 1.6, 'sealed')],
    gate: { id: 'king', name: 'The Hollow King', engine: 'pharaoh', hp: 5000 }
  }
];

// Quick Duel: one Stage 1 map on an 8:00 clock, the Stage 1 timeline, the Stone Arbiter as gate boss, no Overtime.
export const QUICK = Object.assign({}, STAGES[0], { id: 'quick', name: 'Quick Duel', clock: 480, gateWake: 420, waves: { offset: 0, scale: 1 } });

export const stagesFor = mode => (mode === 'quick' ? [QUICK] : STAGES);



