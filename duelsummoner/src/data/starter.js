// What a fresh save can already use (the big desert is a roguelite: you start with very little and unlock the rest by playing, src/data/quests2.js).
//   cards: the level-up pool (4 creatures, 3 spells and a trap and more, 12 in all); items: the chest pool (15 common items); boons: what a shrine can offer (4); pickups: what a vase can drop (6 of the 10).
export const STARTER = {
  cards: ['ember-wyvern', 'cinder-hatchling', 'rune-apprentice', 'sigil-familiar', 'swift-draw', 'collectors-eye', 'heart-of-the-cards', 'runners-sash', 'gust-ward', 'pack-drill', 'elemental-litany', 'widening-rite'],
  items: ['worn-duel-glove', 'sand-sandals', 'cracked-hourglass', 'scarab-charm', 'clay-heart', 'lucky-coin', 'whetstone-tablet', 'travelling-cloak', 'lodestone', 'bandaged-hand', 'bronze-scale', 'dueling-boots', 'leather-vest', 'keen-eye', 'brass-ring'],
  boons: ['might', 'swiftness', 'vigor', 'guard'],
  pickups: [2, 3, 4, 5, 7, 9],
  duelists: ['kael'],
  stages: 1
};
// what a save from before the unlock ladder already owns (kept whole when it is migrated)
export const OLD_STARTER = {
  cards: ['ember-wyvern', 'cinder-hatchling', 'rune-apprentice', 'sigil-familiar', 'swift-draw', 'collectors-eye', 'heart-of-the-cards', 'runners-sash', 'gust-ward'],
  items: ['worn-duel-glove', 'sand-sandals', 'cracked-hourglass', 'scarab-charm', 'clay-heart', 'lucky-coin', 'whetstone-tablet', 'travelling-cloak', 'lodestone', 'bandaged-hand', 'bronze-scale', 'dueling-boots'],
  boons: ['might', 'swiftness', 'vigor', 'haste', 'guard', 'plenty', 'renewal'],
  duelists: ['kael', 'mira']
};
