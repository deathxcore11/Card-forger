// StageSpec tables (numbers live here, not in code). Mirrors src/data/stages/stage{1,2,3}.json.

const ENC_RULES = {
  witness_stone: { cls: 'FREE_ITEM', minR: 200, minSpawn: 110, tags: ['high_perch', 'reward_port', 'pocket_end', 'field', 'hub_edge'] },
  echo_forge: { cls: 'FREE_ITEM', minSpawn: 200, tags: ['pocket_end', 'field', 'reward_port'] },
  relic_broker: { cls: 'PAID', pathRange: [80, 160], offSpine: [15, 40], enemyReach: true, tags: ['field', 'hub_edge'] },
  duel_statue: { cls: 'DANGER', minSpawn: 120, clearR: 8, enemyReach: true, guard: 150, tags: ['field', 'ring_open_r10', 'hub_edge'] },
  shrine_tribute: { cls: 'DANGER', minExposure: 600, spacing: 70, clearR: 10, guard: 100, tags: ['ring_open_r10', 'field', 'hub_edge'] },
  deck_anvil: { cls: 'FREE_LEVEL', minR: 100, minSpawn: 120, branch: true, tags: ['high_perch', 'reward_port', 'pocket_end', 'field'] },
  altar_tribute: { cls: 'UTILITY', pocketPref: true, tags: ['pocket_end', 'field', 'hub_edge'] },
  magnet_tablet: { cls: 'FREE_LEVEL', halves: true, tags: ['reward_port', 'field', 'high_perch'] },
  bone_oath: { cls: 'DANGER', minExposure: 600, guard: 0, tags: ['field', 'hub_edge'] },
  scales_court: { cls: 'UTILITY', tags: ['high_perch', 'field', 'reward_port'] },
  broken_covenant: { cls: 'UTILITY', tags: ['pocket_end', 'reward_port', 'field'] },
  golden_statue: { cls: 'COLLECT', minR: 150, tags: ['reward_port', 'high_perch', 'pocket_end', 'field'] },
  sealed_fragment: { cls: 'COLLECT', deepest: true, tags: ['pocket_end', 'reward_port', 'high_perch', 'field'] },
  card_chest: { cls: 'PAID', spacing: 25, tags: ['pedestal', 'reward_port', 'high_perch', 'pocket_end', 'field', 'hub_edge'] },
  second_seal: { cls: 'UTILITY', tags: ['field', 'hub_edge'] },
  wrapped_mimic: { cls: 'MIMIC', spacing: 25, tags: ['pedestal', 'reward_port', 'high_perch', 'pocket_end', 'field'] },
};
// rarest first (spec §8)
export const PLACE_ORDER = ['second_seal', 'witness_stone', 'echo_forge', 'relic_broker', 'duel_statue', 'shrine_tribute', 'deck_anvil',
  'altar_tribute', 'scales_court', 'broken_covenant', 'bone_oath', 'magnet_tablet', 'golden_statue', 'sealed_fragment', 'card_chest'];

const BASE = {
  cell_m: 24, coarse_m: 8, districts: 4, regionSpacing: 7, loopRatio: 30, maxSpineChange: 40, spineWidth: 12,
  spineRatioMin: 115, maxTierAreaPct: 44, maxTopTierPct: 55, maxPlainPct: 40, // macro-variety and flatness gates (x100 / %)
  econGraphM: 180, bossRings: [5, 7], bossRingCover: 70, bossRingCoverMax: 100, // 5-7 rings; 95% of enemy-reachable ground within 70 m path, all within 100 m (director adds a sky beam past 70 m)
  bossRingR: 14,
  islands: { perchMax: 64, islandMax: 120, count: [4, 8], maxFrac: 8, seerDist: 25, flyerDist: 18 },
  spawnRing: { inner: 22, outer: 30, minFrac: 40, minCells: 150, minSectors: 3, pathRatio10: 18, tolPct: 3 },
  rhythm: { min: 2, moves: [3, 6], len: [25, 60], save: [10, 35] },
  budgets: { tris: 250000, visTris: 90000, draws: 40, instances: 2000 },
  enemyCover: 95, lureEvery: 40, lureDist: 35, encRules: ENC_RULES,
};

export const STAGE_SPECS = {
  1: {
    ...BASE, stage: 1, name: 'Surface Ruins', grid: 15, palette: 'ruins_day', gate: 'Arbiter\'s Gate', gateBoss: 'The Stone Arbiter',
    districtPool: [
      { id: 'sunken_colosseum', hero: 'colosseum_stands', name: 'Sunken Colosseum', required: true, gate: true, w: 0, arche: { plaza: 3, terraces: 1 } },
      { id: 'market_tablets', hero: 'market_awnings', name: 'Market of Tablets', w: 10, arche: { necropolis: 3, dunes: 1 } },
      { id: 'hall_sealed_cards', hero: 'hall_of_cards_facade', name: 'Hall of Sealed Cards', w: 10, arche: { graveyard: 3, plaza: 1 } },
      { id: 'dragons_spine', hero: 'fossil_spine_ribs', name: 'Dragon\'s Spine', w: 10, arche: { canyon: 2, mesa: 2 } },
      { id: 'kings_stair', hero: 'kings_stair_facade', name: 'King\'s Stair', w: 10, arche: { terraces: 3, mesa: 1 } },
    ],
    regions: [12, 15], tierRange: [0, 2], tierWeights: [40, 35, 25], gateTier: 0, spineLen: [190, 290],
    falls: 'gully', openingM: 90, clock_s: 420,
    timeline: [{ t: 0, ev: 'wave', what: 'husks' }, { t: 40, ev: 'wave', what: 'runners' }, { t: 80, ev: 'wave', what: 'seers' },
      { t: 105, ev: 'elite', what: 'Grave Herald', drop: 'card_chest' }, { t: 140, ev: 'wave', what: 'golems' },
      { t: 225, ev: 'timed_boss', what: 'Sealed Warden', drop: 'sealed_chest' }, { t: 260, ev: 'wave', what: 'bloats_scarabs' },
      { t: 330, ev: 'timed_boss', what: 'Twin Jackal Idols', drop: 'sealed_chest' }, { t: 360, ev: 'gate_wake' }, { t: 360, ev: 'husk_ring_every_30s' },
      { t: 420, ev: 'toll_bell' }],
    encounters: { card_chest: 8, witness_stone: 2, relic_broker: 1, shrine_tribute: 3, duel_statue: 2, deck_anvil: 2, altar_tribute: 1,
      magnet_tablet: 2, bone_oath: 2, scales_court: 1, broken_covenant: 1, echo_forge: { n: 1, chance: 40 }, golden_statue: 2, sealed_fragment: 1, second_seal: 0, vases: 40 },
  },
  2: {
    ...BASE, stage: 2, name: 'Ashen Orchard', grid: 14, palette: 'catacomb_cool', gate: 'Seventh Door', gateBoss: 'The Seal Weaver',
    districtPool: [
      { id: 'seventh_door_vault', hero: 'seventh_door_frame', name: 'Seventh Door Vault', required: true, gate: true, w: 0, arche: { plaza: 3, trench: 1 } },
      { id: 'ossuary_galleries', hero: 'ossuary_arch', name: 'Ossuary Galleries', w: 10, arche: { necropolis: 2, trench: 2 } },
      { id: 'sarcophagus_halls', hero: 'sarcophagus_colonnade', name: 'Sarcophagus Halls', w: 10, arche: { graveyard: 3, plaza: 1 } },
      { id: 'chain_bridges', hero: 'chain_winch_tower', name: 'Chain Bridges', w: 10, arche: { trench: 3, mesa: 1 } },
      { id: 'niche_walls', hero: 'niche_wall_shrine', name: 'Niche Walls', w: 10, arche: { terraces: 3, mesa: 1 } },
    ],
    regions: [11, 14], tierRange: [-1, 2], tierWeights: [15, 45, 28, 12], gateTier: -1, spineLen: [175, 270],
    falls: 'pit', pitLP: 10, openingM: 80, clock_s: 420, requireArche: { trench: 2 },
    timeline: [{ t: 0, ev: 'wave', what: 'husks_greyblue' }, { t: 40, ev: 'wave', what: 'runners_greyblue' }, { t: 80, ev: 'wave', what: 'chain_wights' },
      { t: 105, ev: 'elite', what: 'Chainbound Jailer', drop: 'card_chest' }, { t: 140, ev: 'wave', what: 'lantern_keepers' }, { t: 180, ev: 'wave', what: 'seal_moths' },
      { t: 225, ev: 'timed_boss', what: 'Coffin Sentinels', drop: 'sealed_chest' }, { t: 260, ev: 'wave', what: 'ossuary_crawlers' },
      { t: 330, ev: 'timed_boss', what: 'Mirror Duelist', drop: 'sealed_chest' }, { t: 360, ev: 'gate_wake' }, { t: 360, ev: 'husk_ring_every_30s' }, { t: 420, ev: 'toll_bell' }],
    encounters: { card_chest: 7, wrapped_mimic: 2, witness_stone: 1, relic_broker: 1, shrine_tribute: 3, duel_statue: 2, deck_anvil: 1, altar_tribute: 1,
      magnet_tablet: 1, bone_oath: 2, scales_court: 1, broken_covenant: 2, echo_forge: { n: 1, chance: 100 }, golden_statue: 2, sealed_fragment: 1, second_seal: 0, vases: 35 },
  },
  3: {
    ...BASE, stage: 3, name: 'Frostbound Archive', grid: 15, palette: 'vault_gold', gate: 'Throne Gate', gateBoss: 'The Hollow King',
    districtPool: [
      { id: 'duel_table', hero: 'duel_table_rim', name: 'Duel Table', required: true, gate: true, w: 0, arche: { plaza: 3, terraces: 1 } },
      { id: 'treasury_terrace', hero: 'treasury_stack', name: 'Treasury Terrace', w: 10, arche: { terraces: 3, mesa: 1 } },
      { id: 'fallen_kings', hero: 'fallen_king_statue', name: 'Fallen Kings', w: 10, arche: { graveyard: 3, plaza: 1 } },
      { id: 'card_shoals', hero: 'card_shoal_spire', name: 'Card Shoals', w: 10, arche: { shoal: 3, dunes: 1 } },
      { id: 'throne_stair', hero: 'throne_stair_steps', name: 'Throne Stair', w: 10, arche: { terraces: 2, mesa: 2 } },
    ],
    regions: [12, 15], tierRange: [0, 3], tierWeights: [35, 30, 22, 13], gateTier: 1, needTopTier: true, spineLen: [200, 300],
    falls: 'pit', pitLP: 15, openingM: 90, clock_s: 480, requireArche: { shoal: 1 },
    timeline: [{ t: 0, ev: 'wave', what: 'husks_gilded' }, { t: 40, ev: 'wave', what: 'runners' }, { t: 80, ev: 'wave', what: 'gilded_seers_golems' },
      { t: 120, ev: 'elite', what: 'Royal Executioner', drop: 'card_chest' }, { t: 150, ev: 'wave', what: 'gilded_hounds' }, { t: 195, ev: 'wave', what: 'card_wraiths' },
      { t: 255, ev: 'timed_boss', what: 'Court of Three Masks', drop: 'sealed_chest' }, { t: 290, ev: 'wave', what: 'throne_bowmen_coin_thieves' }, { t: 330, ev: 'wave', what: 'abyss_hands' },
      { t: 375, ev: 'timed_boss', what: 'The Hollow Heir', drop: 'sealed_chest' }, { t: 420, ev: 'gate_wake' }, { t: 420, ev: 'husk_ring_every_30s' }, { t: 480, ev: 'toll_bell' }],
    encounters: { card_chest: 6, witness_stone: 1, relic_broker: 1, shrine_tribute: 2, duel_statue: 2, deck_anvil: 1, altar_tribute: 1,
      magnet_tablet: 1, bone_oath: 1, scales_court: 1, broken_covenant: 1, echo_forge: { n: 1, chance: 100 }, golden_statue: 3, sealed_fragment: 1, second_seal: 1, vases: 30 },
  },
};

export const ARCHETYPES = ['plaza', 'dunes', 'necropolis', 'graveyard', 'canyon', 'mesa', 'terraces', 'trench', 'shoal', 'setpiece'];
export const CHANNEL_ARCH = { canyon: 1, trench: 1, shoal: 1 };

// Authored fallback layouts: region seeds as offsets from the map centre in coarse cells, scaled by R/20.
// Gate is seed 0, spawn is seed 1. District index per seed (0 = gate district). Still terrain-sculpted and chunk-filled.
export const FALLBACK_LAYOUTS = [
  { seeds: [[13, -9], [-13, 9], [-4, 12], [-14, -2], [-6, 1], [3, 9], [10, 5], [0, -8], [-8, -11], [6, -2], [13, 1], [-2, -15], [7, 13]],
    district: [0, 1, 1, 2, 2, 1, 3, 2, 2, 3, 0, 2, 3] },
  { seeds: [[-12, -10], [12, 10], [4, 14], [14, 0], [5, 3], [-4, 10], [-10, 5], [0, -6], [8, -10], [-6, -2], [-14, -1], [3, -15], [-6, 14]],
    district: [0, 1, 1, 2, 2, 1, 3, 2, 2, 3, 0, 2, 3] },
  { seeds: [[0, -14], [0, 14], [-9, 10], [9, 10], [-12, 0], [12, 0], [-5, 4], [5, 4], [0, -2], [-8, -8], [8, -8], [-14, 8], [14, 8]],
    district: [0, 1, 1, 1, 2, 3, 2, 3, 2, 2, 3, 2, 3] },
];


