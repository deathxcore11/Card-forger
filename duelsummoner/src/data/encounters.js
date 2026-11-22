// Sunken Colosseum encounters: counts, authored regions, costs and numbers. Spots are drawn each run from these regions
// (src/sim/world.js), so the map is learnable but never the same twice. Regions are polar: radius from the arena centre and
// angle in degrees (0 = east, 90 = south). Heights: floor 0, stands 4, hall roofs 5.8.
// Rule that keeps the economy honest: the free item (Witness Stones, far side of the floor), the free level (Deck Anvil, later,
// on the stands) and an early Fusion sit on opposite sides and different heights, so no route gives all three safely.
export const ENCOUNTERS = {
  vases: {
    clusters: 14, perCluster: [2, 4], bandedChance: 0.12,
    // where clusters may sit: ramp feet and edges, wall edges, risky stands rim, roof edges
    regions: [
      { name: 'ramp feet', r: [17, 28], deg: [[-12, 12], [78, 102], [168, 192], [258, 282]], h: 0 },
      { name: 'wall edge', r: [27, 31], deg: [[0, 360]], h: 0 },
      { name: 'stands rim', r: [34, 50], deg: [[0, 360]], h: 4 },
      { name: 'roof edge', r: [53, 58], deg: [[0, 360]], h: 5.8 }
    ],
    drops: { coins: [1, 3], xp: [1, 1], heartChance: 0.06 }, banded: { xp: 6, heartChance: 1 }, hp: 1
  },
  witnessStones: { count: 2, regions: [{ r: [14, 22], deg: [[20, 70], [200, 250]], h: 0 }], minApart: 25, ring: 3.2, choices: 3 },
  broker: { count: 1, regions: [{ r: [39, 47], deg: [[25, 60], [120, 148], [235, 262], [335, 355]], h: 4 }], stock: 3, rarityWeights: { common: 3, rare: 1 } },
  shrines: { count: 3, regions: [{ r: [8, 26], deg: [[0, 360]], h: 0 }], minApart: 14, radius: 4.5, hold: 5, leaveGrace: 1.5, decayPerSecond: 0.6, choices: 3 },
  cardChests: {
    count: 8, basePrice: 20, priceStep: 15,                                // 20, 35, 50 ... rising with every chest opened
    placement: [{ n: 3, r: [10, 28], deg: [[0, 360]], h: 0 }, { n: 3, r: [36, 50], deg: [[0, 360]], h: 4 }, { n: 2, r: [53, 58], deg: [[0, 360]], h: 5.8 }],
    rarityByOrder: ['common', 'common', 'common', 'rare', 'rare', 'rare', 'epic', 'epic']      // shown on the chest before you pay
  },
  altar: { count: 1, regions: [{ r: [14, 24], deg: [[-25, 25]], h: 0 }], tributeBonus: 2, banishChoices: 3 },   // one landmark, two labelled actions
  minSpacing: 5,                                                          // spots keep this far from each other
  interactRange: 3.2
};
