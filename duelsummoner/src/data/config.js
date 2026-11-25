// All tuning numbers for the simulation live here. Nothing in src/sim hard-codes a rule value.
export const CFG = {
  gravity: 28,
  player: {
    hp: 100, speed: 9, radius: 0.6, height: 1.7, stepUp: 0.55,
    jumpHeight: 2.2,                                   // metres, apex above the take-off point
    mantle: 0.9,                                       // metres: a ledge this far above your feet, reached while moving into it in the air, is climbed for you (no ledge-grabbing skill)
    coyote: 0.1,                                       // seconds after walking off a ledge that a jump still counts as a ground jump
    jumpBuffer: 0.12,                                  // seconds a jump press is remembered before landing, so it fires the moment the feet touch
    jumpCut: 0.5,                                      // letting go of jump on the way up multiplies the rise speed by this (a short tap is a short hop)
    groundAccel: 16, airAccel: 3,                      // how fast velocity follows input (1/s)
    dashDist: 4, dashTime: 0.15, dashTail: 0.25, dashCd: 1.1,          // no damage taken while dashing
    slide: { minStart: 6.5, keepMin: 3.2, max: 22, friction: 2.2, downhill: 34, turn: 1.8, probe: 1.2 }
  },
  cam: {
    back: 10, up: 1.2, shoulder: 0.6, headY: 1.4,          // 7 m behind, 3 m above, over the right shoulder
    sens: 0.0025, pitchMin: -0.5, pitchMax: 0.75,      // pitch is added to the default arm angle
    minDist: 2.2, margin: 0.35, floorGap: 0.6
  },
  enemy: {
    max: 900, hp: 4, speed: 4.2, speedJitter: 0.18, radius: 0.7, reach: 1.45, vReach: 1.3,
    damage: 8, attackCd: 0.9, grace: 0.25,             // 0.9 s per enemy, 0.25 s shared after any hit
    stepUp: 0.55, separation: 1.3, relocateDist: 60, knock: 0.4,
    directRange: 9
  },
  spawn: { min: 22, max: 30, rateStart: 1, rateEnd: 4, rampSeconds: 180, tries: 8 },
  card: { speed: 32, life: 1.3, range: 34, hitRadius: 0.95, max: 48 },
  xp: { magnet: 5, pick: 1.3, perLevel: 8, max: 220 },
  path: { cell: 2, span: 80, refresh: 0.25 }            // enemy flow field: 2 m cells, 80 cells (160 m) across
};



// Ley Threads: the one place their colour lives. A near-white core inside a violet halo with a thin dark under-stroke so it reads on bright sand (red stays reserved for enemy attacks).
export const LEY = { core: 0xc8402c, halo: 0x8a2a1c, under: 0x6a1c14,       // red wind streaks: a deep warm red core, a darker red halo and under-stroke (never the danger red, never violet)
   corePx: 3, haloPx: 6, underPx: 8, maxAlpha: 0.85, coreAlpha: 0.95 };
