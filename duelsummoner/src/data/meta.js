// Between-run progress: Star Chips buy permanent Deck Box upgrades; quests unlock cards and items for the Card Library.
// All numbers here. The sim only ever sees the result (opts.meta), so runs stay deterministic from the seed.
export const DECK_BOX = {
  maxLp:       { name: 'Max LP', text: '+5 max LP a rank', cost: [20, 40, 70, 110, 160], per: { maxLp: 5 } },
  moveSpeed:   { name: 'Move speed', text: '+2% move speed a rank', cost: [25, 45, 75, 115, 170], per: { move: 0.02 } },
  pickupRange: { name: 'Pickup range', text: '+10% pickup range a rank', cost: [15, 30, 55, 90, 130], per: { pickup: 0.10 } },
  xpGain:      { name: 'XP gain', text: '+4% XP a rank', cost: [30, 55, 90, 135, 190], per: { xp: 0.04 } },
  coinGain:    { name: 'Coin gain', text: '+5% coins a rank', cost: [20, 40, 65, 100, 150], per: { coinMult: 0.05 } },
  luck:        { name: 'Luck', text: '+2% luck a rank', cost: [30, 55, 90, 135, 190], per: { luck: 0.02 } },
  armour:      { name: 'Armour', text: '+1 armour at ranks 2 and 4', cost: [40, 70, 110, 160, 220], perRank: [{}, { armour: 1 }, {}, { armour: 1 }, {}] },
  redraws:     { name: 'Redraws', text: '+1 Redraw at ranks 2 and 4', cost: [35, 65, 100, 150, 210], perRank: [{}, { redraws: 1 }, {}, { redraws: 1 }, {}] },
  banishes:    { name: 'Banishes', text: '+1 Banish at ranks 3 and 5', cost: [40, 70, 110, 160, 220], perRank: [{}, {}, { banishes: 1 }, {}, { banishes: 1 }] },
  startLevel:  { name: 'Starting monster level', text: 'Your starter monster begins +1 level at ranks 3 and 5', cost: [50, 90, 140, 200, 280], perRank: [{}, {}, { startLevel: 1 }, {}, { startLevel: 1 }] },
  chestReroll: { name: 'Chest Redraw', text: 'One extra free Redraw on chests at rank 1 (+1 more at rank 4)', cost: [30, 60, 100, 150, 210], perRank: [{ chestRedraws: 1 }, {}, {}, { chestRedraws: 1 }, {}] },
  openingHand: { name: 'Opening Hand', text: 'Start the run with a random unlocked Spell, rank 1; a second at rank 5', cost: [60, 100, 150, 210, 300], perRank: [{ openingHand: 1 }, {}, {}, {}, { openingHand: 1 }] }
};

// What a fresh save can already use (20 of the launch set is the plan; this build has fewer cards, the rest unlock by quest).
export const STARTER = {
  cards: ['ember-wyvern', 'cinder-hatchling', 'rune-apprentice', 'sigil-familiar', 'swift-draw', 'collectors-eye', 'heart-of-the-cards', 'runners-sash', 'gust-ward'],
  items: ['worn-duel-glove', 'sand-sandals', 'cracked-hourglass', 'scarab-charm', 'clay-heart', 'lucky-coin', 'whetstone-tablet', 'travelling-cloak', 'lodestone', 'bandaged-hand', 'bronze-scale', 'dueling-boots']
};

// stats = this run's numbers; totals = lifetime counters kept in the save.
export const QUESTS = [
  { id: 'husks500', name: 'Husk Hunter', text: 'Defeat 500 enemies in total.', test: (r, T) => T.kills >= 500, unlock: { card: 'kindling-rite' } },
  { id: 'level15', name: 'Quick Study', text: 'Reach level 15 in one run.', test: (r) => r.level >= 15, unlock: { card: 'deep-marks' } },
  { id: 'fuse1', name: 'Two Become One', text: 'Make a Fusion.', test: (r) => r.fusions >= 1, unlock: { card: 'pit-of-seals' } },
  { id: 'warden', name: 'Shieldbreaker', text: 'Defeat the Sealed Warden.', test: (r) => r.wardenKilled, unlock: { card: 'storm-of-cards' } },
  { id: 'pharaoh', name: 'The Last Round', text: 'Defeat The Hollow Pharaoh.', test: (r) => r.bossKills > 0, unlock: { card: 'second-wind' } },
  { id: 'survive6', name: 'Long Duel', text: 'Survive 6:00.', test: (r) => r.timeSurvived >= 360, unlock: { item: 'hunters-mark' } },
  { id: 'chests10', name: 'Collector', text: 'Open 10 Card Chests in total.', test: (r, T) => T.chests >= 10, unlock: { item: 'traders-seal' } },
  { id: 'vases40', name: 'Clay Breaker', text: 'Break 40 vases in total.', test: (r, T) => T.vases >= 40, unlock: { item: 'graveyard-bell' } },
  { id: 'overtime2', name: 'Overtime', text: 'Survive 2:00 of Overtime.', test: (r) => r.overtimeSeconds >= 120, unlock: { item: 'paper-talisman' } },
  { id: 'noTrap', name: 'Bare Hands', text: 'Defeat the Pharaoh with no Trap set.', test: (r) => r.bossKills > 0 && r.trapsSet === 0, unlock: { item: 'burning-deck' } },
  { id: 'runs5', name: 'Regular', text: 'Finish 5 runs.', test: (r, T) => T.runs >= 5, unlock: { item: 'jar-of-avarice' } }
];
