// Cards, levels, offers and Fusion rules. All numbers here; src/sim reads them by name.
// Rules (owner, 22 Nov): monsters level 1 to 10 with three forms (levels 1, 5, 10); Fusion needs both named partners at level 10;
// a Fusion is a new monster from level 1 with its own three forms; Spells and Traps level 1 to 5 and never fuse.
export const XP = { base: 2.5, perLevel: 0.35, quad: 0.038 };         // xp to go from level L to L+1 = base + perLevel * L + quad * L * L
export const LEVELS = { monsterMax: 10, fusedMax: 10, spellMax: 5, damagePerLevel: 0.15 };
export const OFFER = {
  size: 3, redraws: 2, banishes: 1, passCoins: 10,
  rarityOdds: { common: 60, rare: 28, epic: 10, legendary: 2 },
  secondMonsterByLevel: 3,                                           // the duelist's partner monster is forced into an offer by here
  trapByLevel: 4,                                                    // a Trap is forced by here if none is set
  chestRarityFloor: 'rare',
  guaranteeMonsterUpgrade: true                                       // every offer holds at least one upgrade for a monster you already field
};
export const FIELD_RULES = { monsterZones: 4, spellTrapZones: 4, fusionLevel: 10, critChance: 0.05, critMult: 2, playerCardDamage: 2, playerCardCooldown: 0.8 };
export const MARKS = { duration: 6, bonus: 0.30 };

// Three forms per monster: young (level 1), grown (5), full (10). Each form is its own model; until more art arrives
// every form reuses the monster's one model at 0.7 / 0.85 / 1.0 scale.
const forms = id => [{ fromLevel: 1, modelId: id, scale: 0.7 }, { fromLevel: 5, modelId: id, scale: 0.85 }, { fromLevel: 10, modelId: id, scale: 1.0 }];

// Attack kinds: line (piercing shot), lob (splash), mark, homing, cone. fx = extras gained at levels 3, 6 and 10.
export const MONSTERS = {
  'ember-wyvern': { name: 'Ember Wyvern', type: 'Dragon', elements: ['fire'], rarity: 'common', flame: true, partner: 'cinder-hatchling', forms: forms('ember-wyvern'),
    text: 'Fire line 20 m long, pierces 2.',
    attack: { kind: 'line', dmg: 2, cd: 0.65, length: 20, pierce: 2, speed: 34 },
    fx: { 3: { pierce: 1 }, 6: { length: 6 }, 10: { pierce: 2 } }, fxText: { 3: 'pierces +1', 6: 'line +6 m', 10: 'pierces +2' } },
  'cinder-hatchling': { name: 'Cinder Hatchling', type: 'Dragon', elements: ['fire'], rarity: 'common', flame: true, partner: 'ember-wyvern', forms: forms('cinder-hatchling'),
    text: 'Lobbed fireball, 3 m splash.',
    attack: { kind: 'lob', dmg: 3, cd: 1.4, splash: 3, range: 22, flight: 0.7, count: 1 },
    fx: { 3: { splash: 0.7 }, 6: { count: 1 }, 10: { splash: 1 } }, fxText: { 3: 'splash +0.7 m', 6: 'a second fireball', 10: 'splash +1 m' } },
  'rune-apprentice': { name: 'Rune Apprentice', type: 'Spellcaster', elements: ['lightning'], rarity: 'common', partner: 'sigil-familiar', forms: forms('rune-apprentice'),
    text: 'Marks the 3 nearest for 6 s; marked take +30%.',
    attack: { kind: 'mark', dmg: 1, cd: 1.0, marks: 3, range: 24 },
    fx: { 3: { marks: 1 }, 6: { marks: 1 }, 10: { marks: 2 } }, fxText: { 3: 'marks +1', 6: 'marks +1', 10: 'marks +2' } },
  'sigil-familiar': { name: 'Sigil Familiar', type: 'Spellcaster', elements: ['lightning'], rarity: 'common', partner: 'rune-apprentice', forms: forms('sigil-familiar'),
    text: 'Homing bolt at a marked enemy, else the nearest.',
    attack: { kind: 'homing', dmg: 3, cd: 0.5, speed: 22, range: 26 },
    fx: { 3: { dmg: 1 }, 6: { speed: 6 }, 10: { dmg: 2 } }, fxText: { 3: '+1 damage', 6: 'faster bolt', 10: '+2 damage' } }
};
export const FUSIONS = {
  'twinflare-tyrant': { name: 'Twinflare Tyrant', type: 'Dragon', elements: ['fire'], flame: true, from: ['ember-wyvern', 'cinder-hatchling'], forms: forms('twinflare-tyrant'),
    text: '60 degree cone, 14 m, about 8 damage a hit at level 1. Starts stronger than a level 10 basic.',
    attack: { kind: 'cone', dmg: 2.5, cd: 0.9, range: 14, arc: 60 }, fx: { 3: { range: 2 }, 6: { arc: 20 }, 10: { range: 3, arc: 20 } }, fxText: { 3: 'cone +2 m', 6: 'cone wider', 10: 'longest, widest cone' } },
  'astral-magus': { name: 'Astral Magus', type: 'Spellcaster', elements: ['lightning'], from: ['rune-apprentice', 'sigil-familiar'], forms: forms('astral-magus'),
    text: 'Marks 6. Marked enemies explode on defeat: 4 m, 8 damage.',
    attack: { kind: 'mark', dmg: 1, cd: 1.0, marks: 6, range: 26, explodeRadius: 4, explodeDmg: 8 }, fx: { 3: { marks: 2 }, 6: { explodeDmg: 4 }, 10: { marks: 2, explodeRadius: 1 } }, fxText: { 3: 'marks +2', 6: 'bigger blasts', 10: 'marks +2, wider blasts' } }
};
export function formOf(id, level) {
  const D = MONSTERS[id] || FUSIONS[id]; let f = 0;
  D.forms.forEach((fm, i) => { if (level >= fm.fromLevel) f = i; });
  return f;
}

// Spells: levels are stacks. "per" values are added per stack.
export const SPELLS = {
  'toll-of-ash': { name: 'Toll of Ash', rarity: 'rare', kind: 'spell', text: 'Every 5 s you pay 3% of your current Life Points (never below 1). +7% Might a level.', per: { dmgMult: 0.07, toll: 1 } },
  'kindling-rite': { name: 'Kindling Rite', rarity: 'rare', kind: 'spell', text: 'Fire burns +1 damage a second, and +1 s a stack.', per: { burnDps: 1, burnDur: 1 } },
  'deep-marks': { name: 'Deep Marks', rarity: 'rare', kind: 'spell', text: 'Marks last 3 s longer and add +10% damage taken a stack.', per: { markDur: 3, markBonus: 0.10 } },
  'swift-draw': { name: 'Swift Draw', rarity: 'common', kind: 'spell', text: 'Your card throw is 20% faster a stack.', per: { cardRate: 0.20 } },
  'runners-sash': { name: "Runner's Sash", rarity: 'common', kind: 'spell', text: '+8% move speed and +10% dash distance a stack.', per: { move: 0.08, dash: 0.10 } },
  'heart-of-the-cards': { name: 'Heart of the Cards', rarity: 'common', kind: 'spell', text: '+20 max Life Points and heal 20 now.', per: { maxLp: 20 }, healNow: 20 },
  'collectors-eye': { name: "Collector's Eye", rarity: 'common', kind: 'spell', text: '+25% pickup range and +10% XP a stack.', per: { pickup: 0.25, xp: 0.10 } }
};
export const ONE_SHOTS = {
  'second-wind': { name: 'Second Wind', rarity: 'epic', kind: 'oneshot', text: 'Heal to full, once, now.' },
  'storm-of-cards': { name: 'Storm of Cards', rarity: 'epic', kind: 'oneshot', text: '60 cards rain on the enemies: 4 damage each.', cards: 60, dmg: 4, seconds: 3 }
};
export const TRAPS = {
  'gust-ward': { name: 'Gust Ward', rarity: 'rare', kind: 'trap', trigger: 'hurt', text: 'When you take damage: knocks back everything within 6 m, 2 damage.',
    recharge: 10, rechargePerLevel: 0.9, radius: 6, dmg: 2, dmgPerLevel: 0.25, knock: 6 },
  'pit-of-seals': { name: 'Pit of Seals', rarity: 'rare', kind: 'trap', trigger: 'crowd', text: '8 enemies within 4 m: a seal opens, 10 damage, roots 2 s.',
    recharge: 14, rechargePerLevel: 0.9, crowd: 8, radius: 4, dmg: 10, dmgPerLevel: 0.25, root: 2 }
};

export const DUELISTS = {
  kael: { name: 'Kael, Ember Tamer', start: 'ember-wyvern', second: 'cinder-hatchling' },
  mira: { name: 'Mira, Rune Scribe', start: 'rune-apprentice', second: 'sigil-familiar' }
};

// Balance targets, checked by test/run-sim.mjs. Pick budget: about 48 level-ups from the XP curve (faster early) plus about 12
// from chests and shrines = about 60. A focused pair costs 18 level-ups (two monsters, 9 each). Maxing 4 monsters to 10 and
// 4 Spells/Traps to 5 costs 52, so no run maxes everything.
export const TARGETS = {
  levelUpsByEnd: 48, picksPerRun: 60, focusedPairPicks: 18, maxEverythingPicks: 52,
  levelAt: [[60, 8], [120, 16], [180, 24], [240, 30], [300, 35], [360, 40], [420, 44], [480, 48]],   // [seconds, level]: fast early, slow late; a player who collects most crystals
  firstFusionSeconds: [225, 270],                                     // 3:45 to 4:30 with focused picks
  secondFusionShare: 0.15                                             // runs that reach a second Fusion: rare, under 15%
};






