// Quests as data: every entry is { id, tab, name, text, rarity, stat, goal, reward }. The screens and the evaluator only read this list, so it
// can grow to hundreds of entries. stat is a path into the saved progress (core/meta.js statValue):
//   total.<name>      lifetime counters (kills, chests, runs, fusions, stagesCleared ...)
//   best.<name>       the best single-run value (level, timeSurvived, overtimeSeconds ...)
//   key.<run key>     how many runs reported that key (dsfull:ember-wyvern, dsfu:twinflare-tyrant, dsdu:kael ...)
//   oath.<id>         runs that kept that Oath
//   mastery.<duelist> the duelist's mastery rank
//   manual            cannot be earned yet (hidden finds are not built)
// reward: { chips: n } | { card: id } | { item: id } | { duelist: id } | { outfit: id } | { regalia: id }
import { OATHS } from './progress.js';

export const QUEST_TABS = ['Duelists', 'Monsters', 'Spells/Traps', 'Items', 'General', 'Oaths', 'Mastery', 'Regalia'];
export const RARITIES = ['Plain', 'Bright', 'Gilded', 'Radiant', 'Mythic'];
export const RARITY_COLOUR = { Plain: '#8a8f99', Bright: '#5fb0e8', Gilded: '#e8b84a', Radiant: '#e87fc8', Mythic: '#ff7a3a' };

const q = (id, tab, name, text, rarity, stat, goal, reward) => ({ id, tab, name, text, rarity, stat, goal, reward });

const core = [
  // the first eleven quests, restructured (ids and unlocks unchanged)
  q('husks500', 'General', 'Husk Hunter', 'Defeat 500 enemies in total.', 'Plain', 'total.kills', 500, { card: 'kindling-rite' }),
  q('level15', 'General', 'Quick Study', 'Reach level 15 in one run.', 'Plain', 'best.level', 15, { card: 'deep-marks' }),
  q('fuse1', 'Monsters', 'Two Become One', 'Make a Fusion.', 'Bright', 'total.fusions', 1, { card: 'pit-of-seals' }),
  q('warden', 'General', 'Shieldbreaker', 'Defeat the Sealed Warden.', 'Bright', 'total.wardenKills', 1, { card: 'storm-of-cards' }),
  q('pharaoh', 'General', 'The Last Round', 'Defeat a gate boss (or the Hollow Pharaoh).', 'Gilded', 'total.bossKills', 1, { card: 'second-wind' }),
  q('survive6', 'General', 'Long Duel', 'Survive 6:00 in one run.', 'Plain', 'best.timeSurvived', 360, { item: 'hunters-mark' }),
  q('chests10', 'Items', 'Collector', 'Open 10 Card Chests in total.', 'Plain', 'total.chests', 10, { item: 'traders-seal' }),
  q('vases40', 'Items', 'Clay Breaker', 'Break 40 vases in total.', 'Plain', 'total.vases', 40, { item: 'graveyard-bell' }),
  q('overtime2', 'General', 'Overtime', 'Survive 2:00 of Overtime.', 'Gilded', 'best.overtimeSeconds', 120, { item: 'paper-talisman' }),
  q('noTrap', 'Spells/Traps', 'Bare Hands', 'Defeat a gate boss with no Trap set.', 'Radiant', 'best.bareBossKill', 1, { item: 'burning-deck' }),
  q('runs5', 'General', 'Regular', 'Finish 5 runs.', 'Plain', 'total.runs', 5, { item: 'jar-of-avarice' }),
  // more, to fill the tabs (placeholder rewards)
  q('stage1', 'General', 'First Descent', 'Clear a stage.', 'Plain', 'total.stagesCleared', 1, { chips: 20 }),
  q('stage3', 'General', 'The Whole Kingdom', 'Clear all three stages in one run.', 'Radiant', 'best.stagesCleared', 3, { chips: 150 }),
  q('kills5000', 'General', 'Horde Breaker', 'Defeat 5,000 enemies in total.', 'Bright', 'total.kills', 5000, { chips: 60 }),
  q('runs20', 'General', 'Dedicated', 'Finish 20 runs.', 'Bright', 'total.runs', 20, { chips: 60 }),
  q('fullwyvern', 'Monsters', 'Grown Up', 'Take an Ember Wyvern to level 10.', 'Plain', 'key.dsfull:ember-wyvern', 1, { chips: 20 }),
  q('fullhatch', 'Monsters', 'Hot Stuff', 'Take a Cinder Hatchling to level 10.', 'Plain', 'key.dsfull:cinder-hatchling', 1, { chips: 20 }),
  q('fullapp', 'Monsters', 'Scribbles Made Real', 'Take a Rune Apprentice to level 10.', 'Plain', 'key.dsfull:rune-apprentice', 1, { chips: 20 }),
  q('tyrant', 'Monsters', 'Twinflare', 'Summon a Twinflare Tyrant.', 'Bright', 'key.dsfu:twinflare-tyrant', 1, { chips: 40 }),
  q('magus', 'Monsters', 'Astral', 'Summon an Astral Magus.', 'Bright', 'key.dsfu:astral-magus', 1, { chips: 40 }),
  q('trapset', 'Spells/Traps', 'Set and Forget', 'Set a Trap in a run.', 'Plain', 'best.trapsSet', 1, { chips: 15 }),
  q('godfuse', 'Monsters', 'Beyond Fusion', 'Make a God Fusion.', 'Mythic', 'total.godFusions', 1, { chips: 400 }),
  q('duelist-vesh', 'Duelists', 'A Hollow Welcome', 'Clear a stage on Hard.', 'Gilded', 'best.hardStages', 1, { duelist: 'vesh' }),
  q('duelist-oren', 'Duelists', 'Bound to Win', 'Clear all three stages on Medium.', 'Gilded', 'best.mediumFull', 1, { duelist: 'oren' }),
  q('duelist-mira', 'Duelists', 'Runes Aplenty', 'Use Kael to finish 3 runs.', 'Plain', 'key.dsdu:kael', 3, { chips: 20 })
];
// every Oath is its own quest: keep it once (finish a run with it sworn and every stage cleared)
const oathQuests = OATHS.map(o => q('oath-' + o.id, 'Oaths', o.name, 'Clear a run while keeping the ' + o.name + ': ' + o.text, o.reward.chips >= 50 ? 'Gilded' : 'Bright', 'oath.' + o.id, 1, o.reward));
// mastery ranks per duelist
const masteryQuests = [];
for (const d of ['kael', 'mira']) for (const r of [2, 3, 5, 8]) masteryQuests.push(q('mastery-' + d + '-' + r, 'Mastery', d[0].toUpperCase() + d.slice(1) + ' mastery rank ' + r, 'Reach mastery rank ' + r + ' with ' + d[0].toUpperCase() + d.slice(1) + '.', r >= 8 ? 'Radiant' : r >= 5 ? 'Gilded' : 'Bright', 'mastery.' + d, r, r === 5 ? { outfit: d + '-2' } : { chips: 10 * r }));
// regalia (hats and trinkets) come from hidden finds on maps and from quests: not buildable until the map generator places finds
const regaliaQuests = [
  q('regalia-hat1', 'Regalia', 'The Dusty Hat', 'Find the hat buried in the Surface Ruins.', 'Gilded', 'manual', 1, { regalia: 'dusty-hat' }),
  q('regalia-trinket1', 'Regalia', 'A Cracked Charm', 'Find a charm hidden in a vase on any map.', 'Bright', 'manual', 1, { regalia: 'cracked-charm' }),
  q('regalia-mastery', 'Regalia', 'Veteran Insignia', 'Reach mastery rank 10 with any duelist.', 'Mythic', 'mastery.any', 10, { regalia: 'veteran-insignia' })
];
export const QUESTS = [...core, ...oathQuests, ...masteryQuests, ...regaliaQuests];
