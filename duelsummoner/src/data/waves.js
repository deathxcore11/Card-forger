// The 8-minute wave table (bible "Enemies and waves"), plus the boss clock and the Royal Gate.
export const RUN = {
  maxAlive: 300,
  // spawns per second; linear between rows. The last row (8:00) is the rate while the boss is up.
  rate: [[0, 1], [60, 2], [120, 3], [180, 4], [240, 4], [300, 6], [360, 7], [420, 9], [480, 3]],
  bossRate: 3,
  // from this second on, each spawn rolls these chances in order; whatever is left over is a Husk
  mix: [
    { from: 0,   chance: {} },
    { from: 45,  chance: { scarab: 0.06 } },                                 // flyers from 0:45 so roofs are not safe
    { from: 60,  chance: { scarab: 0.06, runner: 0.25 } },
    { from: 120, chance: { scarab: 0.06, runner: 0.25, seer: 0.10 } },
    { from: 300, chance: { scarab: 0.12, runner: 0.22, seer: 0.10, bloat: 0.08 } }
  ],
  golem: { from: 180, every: 20 },                                           // one Ram Golem every 20 s from 3:00
  elites: { warden: 240, idols: 360 },
  ring: { from: 420, every: 30, count: 40, radius: 24 },                     // the Last Audience: 40 Husks in a ring
  bossAt: 480,
  // Overtime: from 8:00 the run does not end. Hunters spawn and grow stronger every 30 s with no cap, so every run ends eventually.
  overtime: { from: 480, stepSeconds: 30, baseRate: 2, rateStep: 0.35, hpGrowth: 1.22, dmgGrowth: 1.10, speedGrowth: 1.02, speedCap: 1.6 },
  enemyDamagePerMinute: 0.06,                                                // enemy damage rises 6% a minute
  gate: { x: 0, z: -57, radius: 5.5, earliest: 360, earlyStarChips: 50 },   // Royal Gate: early entry from 6:00
  bossSpawn: { x: 0, z: -12 },
  starChips: { perKills: 10, perElite: 20, boss: 100 },
  // drops
  coinChance: 1 / 6, heartChance: 1 / 80, heartHeal: 15
};

