// Enemy numbers from the game bible. Edit here to rebalance; nothing in src/sim hard-codes a value.
// Swarm kinds live in typed arrays (fast, 300 at once); elites and the boss are single objects (see SPECIALS).
export const KINDS = {
  husk:   { id: 0, name: 'Dust Husk',   hp: 4,  speed: 4.2, touch: 8, radius: 0.7, reach: 1.45, color: 0x5a6b4a, scale: [1, 1.25, 1], eye: true },
  runner: { id: 1, name: 'Husk Runner', hp: 2,  speed: 7.0, touch: 5, radius: 0.55, reach: 1.3, color: 0xa8683a, scale: [0.7, 1.0, 0.7], eye: true },
  seer:   { id: 2, name: 'Glass Seer',  hp: 8,  speed: 2.5, touch: 0, radius: 0.7, reach: 1.2, color: 0x7aa8c8, scale: [0.8, 1.8, 0.8],
            shot: { dmg: 12, every: 2.6, telegraph: 0.8, speed: 26, life: 0.9, radius: 0.9, keepMin: 8, keepMax: 14, range: 22, width: 0.9 } },
  golem:  { id: 3, name: 'Ram Golem',   hp: 30, speed: 3.0, touch: 0, radius: 1.0, reach: 1.6, color: 0x8a8278, scale: [1.5, 1.3, 1.5],
            rush: { dmg: 25, speed: 16, telegraph: 1.0, duration: 1.0, cooldown: 6, trigger: 18, width: 2.6 } },
  bloat:  { id: 4, name: 'Sand Bloat',  hp: 10, speed: 3.5, touch: 0, radius: 0.9, reach: 1.5, color: 0xd88a3a, scale: [1.3, 1.1, 1.3],
            blast: { radius: 3, dmg: 20, fuse: 0.7, trigger: 2.4 } },
  hunter: { id: 6, name: 'Overtime Hunter', hp: 12, speed: 6.0, touch: 10, radius: 0.8, reach: 1.5, color: 0xb03060, scale: [0.95, 1.5, 0.95], eye: true },
  scarab: { id: 5, name: 'Tomb Scarab', hp: 5,  speed: 5.0, touch: 6, radius: 0.5, reach: 1.3, color: 0xd8b24a, scale: [0.8, 0.4, 1.0], fly: true, hover: 1.2 }
};
export const KIND_LIST = Object.values(KINDS).sort((a, b) => a.id - b.id);   // indexed by id

export const SPECIALS = {
  warden: { name: 'Sealed Warden', hp: 250, speed: 3.5, radius: 1.5, turnRate: 1.4, shieldHalfArc: 55,       // degrees; hits from the front are blocked
            slam: { dmg: 20, radius: 5, trigger: 5.5, telegraph: 1.0, cooldown: 4 } },
  idol:   { name: 'Twin Jackal Idol', hp: 250, speed: 6.0, radius: 0.9, bite: 15, reach: 1.7, reviveSeconds: 10, reviveHpFraction: 0.6 },
  pharaoh: {
    name: 'The Hollow Pharaoh', hp: 3000, speed: 4.0, radius: 1.5, phase2: 0.66, phase3: 0.33,
    blade: { dmg: 30, arcDeg: 100, range: 9, telegraph: 1.0, cooldown: 5 },
    summon: { every: 12, count: 10 },                              // phase 1 only
    traps: { count: 3, every: 10, burstRadius: 3, dmg: 25, stepRadius: 1.3, lifetime: 30, max: 6, spread: 14 },   // phase 2
    sand: { rStart: 32, rEnd: 10, seconds: 60, dps: 6, tick: 0.5 }  // phase 3: the arena edge fills with sand
  }
};




