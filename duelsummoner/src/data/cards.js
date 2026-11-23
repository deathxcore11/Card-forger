// Cards, levels, offers and Fusion rules. All numbers here; src/sim reads them by name.
// Rules (owner, 22 Nov): monsters level 1 to 10 with three forms (levels 1, 5, 10); Fusion needs both named partners at level 10;
// a Fusion is a new monster from level 1 with its own three forms; Spells and Traps level 1 to 5 and never fuse.
export const XP = { table: [9.7,14.7,20.3,26.3,32.9,39.9,47.5,55.5,64.1,73.1,82.7,92.7,103.3,114.3,125.9,137.9,150.5,163.5,177.1,191.1,205.7,220.7,236.3,252.3], tail: 1.07, base: 2.5, perLevel: 0.35, quad: 0.038, early: 0, earlyTo: 9 };         // xp to go from level L to L+1 = base + perLevel * L + quad * L * L
export const LEVELS = { monsterMax: 10, fusedMax: 10, spellMax: 5 };
export const OFFER = {
  size: 3, redraws: 2, banishes: 1, passCoins: 6,
  rarityOdds: { common: 60, rare: 28, epic: 10, legendary: 2 },
  secondMonsterByLevel: 3,                                           // the duelist's partner monster is forced into an offer by here
  trapByLevel: 4,                                                    // a Trap is forced by here if none is set
  chestRarityFloor: 'rare',
  guaranteeMonsterUpgrade: true                                       // every offer holds at least one upgrade for a monster you already field
};
export const FIELD_RULES = { monsterZones: 4, spellTrapZones: 4, fusionLevel: 10, critChance: 0.05, playerCardDamage: 2, playerCardCooldown: 0.8 };
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
    text: '60 degree cone, 14 m, about 11 damage a hit at level 1. Starts stronger than a level 10 basic.',
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
  'toll-of-ash': { name: 'Toll of Ash', rarity: 'rare', kind: 'spell', text: 'Every 5 s you pay 3% of your current health (never below 1). +10% Might per level.', per: { dmgMult: 0.10, toll: 1 } },
  'kindling-rite': { name: 'Kindling Rite', rarity: 'rare', kind: 'spell', text: 'For each level, fire burns +1.4 damage a second and 1.4 s longer.', per: { burnDps: 1.4, burnDur: 1.4 } },
  'deep-marks': { name: 'Deep Marks', rarity: 'rare', kind: 'spell', text: 'Marks last 4 s longer and add +14% damage taken per level.', per: { markDur: 4, markBonus: 0.14 } },
  'pack-drill': { name: 'Pack Drill', rarity: 'rare', kind: 'spell', text: 'Monster hits do 21% more per level. The Source bracket: it rewards committing to one kind of damage, up to x3.', per: { drill: [0, 0.21] } },
  'elemental-litany': { name: 'Elemental Litany', rarity: 'rare', kind: 'spell', text: '+17% damage in each element for every monster of it you field, per level. The Affinity bracket.', per: { affPerElement: 0.17 } },
  'swift-draw': { name: 'Swift Draw', rarity: 'common', kind: 'spell', text: 'Your card throw is 28% faster per level.', per: { cardRate: 0.28 } },
  'runners-sash': { name: "Runner's Sash", rarity: 'common', kind: 'spell', text: '+11% move speed and +14% dash distance per level.', per: { move: 0.11, dash: 0.14 } },
  'heart-of-the-cards': { name: 'Heart of the Cards', rarity: 'common', kind: 'spell', text: '+28 max health and heal 28 now.', per: { maxLp: 28 }, healNow: 28 },
  'collectors-eye': { name: "Collector's Eye", rarity: 'common', kind: 'spell', text: '+35% pickup range and +14% XP per level.', per: { pickup: 0.35, xp: 0.14 } }
};
export const ONE_SHOTS = {
  'second-wind': { name: 'Second Wind', rarity: 'epic', kind: 'oneshot', text: 'Heal to full, once, now.' },
  'storm-of-cards': { name: 'Storm of Cards', rarity: 'epic', kind: 'oneshot', text: '60 cards rain on the enemies: 4 damage each.', cards: 60, dmg: 4, seconds: 3 }
};
export const TRAPS = {
  'gust-ward': { name: 'Gust Ward', rarity: 'rare', kind: 'trap', trigger: 'hurt', text: 'When you take damage: knocks back everything within 6 m, 2 damage.',
    recharge: 10, rechargePerLevel: 0.9, radius: 6, dmg: 2, dmgPerLevel: 0.35, knock: 6 },
  'pit-of-seals': { name: 'Pit of Seals', rarity: 'rare', kind: 'trap', trigger: 'crowd', text: '8 enemies within 4 m: a seal opens, 10 damage, roots 2 s.',
    recharge: 14, rechargePerLevel: 0.9, crowd: 8, radius: 4, dmg: 10, dmgPerLevel: 0.35, root: 2 }
};

export const DUELISTS = {
  kael: { name: 'Kael, Ember Tamer', start: 'ember-wyvern', second: 'cinder-hatchling' },
  mira: { name: 'Mira, Rune Scribe', start: 'rune-apprentice', second: 'sigil-familiar' }
};

// Balance targets, checked by test/run-sim.mjs and tools/balance.mjs. Stage 1 pace: level-ups per minute 0-1, 2, 2-3, 3, 3, 3-4, 4-5 (about 20 by 7:00),
// 30 to 38 picks in all with chests and shrines, the first Fusion between 5:30 and 7:00. The full-run budget below is the old whole-run figure:
// a focused pair costs 18 level-ups (two monsters, 9 each) and maxing 4 monsters to 10 and 4 Spells/Traps to 5 costs 52, so no run maxes everything.
export const TARGETS = {
  levelUpsByEnd: 20, picksPerRun: [30, 38], focusedPairPicks: 18, maxEverythingPicks: 52,
  levelAt: [[60, 1], [120, 3], [180, 6], [240, 9], [300, 12], [360, 16], [420, 20]],   // [seconds, level] on Stage 1: about the middle of each minute's range (0-1, 2, 2-3, 3, 3, 3-4, 4-5 level-ups)
  firstFusionSeconds: [330, 420],                                     // 5:30 to 7:00 with focused picks
  secondFusionShare: 0.15                                             // runs that reach a second Fusion: rare, under 15%
};












