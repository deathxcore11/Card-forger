// Field rules. The numbers live in cards.js so they exist once; this file gives them their agreed names.
import { FIELD_RULES, LEVELS, FUSIONS } from './cards.js';

export const FIELD = {
  monsterZones: FIELD_RULES.monsterZones,
  spellTrapZones: FIELD_RULES.spellTrapZones,
  monsterLevel: { min: 1, max: LEVELS.monsterMax },
  spellTrapLevel: { min: 1, max: LEVELS.spellMax },
  fusionLevel: FIELD_RULES.fusionLevel,          // a named pair fuses when BOTH reach this level
  fusions: Object.keys(FUSIONS).map(id => ({ a: FUSIONS[id].from[0], b: FUSIONS[id].from[1], result: id }))
};

export const RARITIES = [
  { id: 'common', weight: 60, color: '#b9b2a2' },
  { id: 'uncommon', weight: 25, color: '#6fbf73' },
  { id: 'rare', weight: 11, color: '#5b9bd5' },
  { id: 'epic', weight: 3.5, color: '#a974e0' },
  { id: 'legendary', weight: 0.5, color: '#e8b84a' }
];

export const CHESTS = {
  small: { rolls: 1, rarityBias: 0 },
  gilded: { rolls: 2, rarityBias: 1 },
  royal: { rolls: 3, rarityBias: 2 }
};
