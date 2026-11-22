// A sample of Duel Summoner content, as data, for the Ledger prototype and its tests.
// Every modifier is a [STAT, value] pair. Every name and number is our own.
// Attack kinds map to proc coefficients in K.proc: strike, pierce (line), multi, pulse, cone, beam, mark.

import { STAT as S, DUELIST, FX, EV } from './stats.js';

export const ELEMENTS = {
  fire:      { status: 'Burn',    effect: 'DoT of 25% of the snapshot per second for 3 s' },
  ice:       { status: 'Chill',   effect: '30% slow for 2 s' },
  lightning: { status: 'Arc',     effect: 'chains to the next enemy at half base' },
  poison:    { status: 'Venom',   effect: 'DoT of 15% of the snapshot per second for 5 s' },
  wind:      { status: 'Gust',    effect: '1.5 m push' },
  earth:     { status: 'Stagger', effect: '0.2 s stagger' },
  light:     { status: 'Reveal',  effect: '+10% TARGET for 3 s' },
  dark:      { status: 'Drain',   effect: 'heal 1% of the hit, capped per 10 s' }
};

// atk is per-card base before level, form and tier T (K.tier), so a Fusion's jump comes from T, not from atk.
// tier: 0 Monster, 1 Fusion, 2 God Fusion, 3 Secret Fusion
export const MONSTERS = {
  'ember-wyvern':     { name: 'Ember Wyvern', tier: 0, elems: ['fire'], kind: 'pierce', atk: 2, cd: 0.65, hits: 2, partner: 'cinder-hatchling' },
  'cinder-hatchling': { name: 'Cinder Hatchling', tier: 0, elems: ['fire'], kind: 'pulse', atk: 3, cd: 1.4, hits: 3, partner: 'ember-wyvern' },
  'rune-apprentice':  { name: 'Rune Apprentice', tier: 0, elems: ['lightning'], kind: 'mark', atk: 1, cd: 1.0, hits: 3, marks: true, partner: 'sigil-familiar' },
  'sigil-familiar':   { name: 'Sigil Familiar', tier: 0, elems: ['lightning'], kind: 'strike', atk: 3, cd: 0.5, hits: 1, partner: 'rune-apprentice' },
  'frost-lynx':       { name: 'Frost Lynx', tier: 0, elems: ['ice'], kind: 'strike', atk: 3, cd: 0.7, hits: 1, partner: 'rime-sprite' },
  'rime-sprite':      { name: 'Rime Sprite', tier: 0, elems: ['ice'], kind: 'multi', atk: 1.5, cd: 0.9, hits: 3, partner: 'frost-lynx' },
  'cinder-penitent':  { name: 'Cinder Penitent', tier: 0, elems: ['fire'], kind: 'pulse', atk: 3, cd: 0.6, hits: 3, baseMul: 1.4, selfCost: 1,
                        text: 'Each attack costs 1 LP. Hits 40% harder.' },
  'lantern-acolyte':  { name: 'Lantern Acolyte', tier: 0, elems: ['light'], kind: 'beam', atk: 0.5, cd: 0.1, hits: 1 },
  'hollow-shade':     { name: 'Hollow Shade', tier: 0, elems: ['dark'], kind: 'strike', atk: 3.5, cd: 0.8, hits: 1 },
  // Fusions (arrive at level 1)
  'twinflare-tyrant':   { name: 'Twinflare Tyrant', tier: 1, elems: ['fire'], kind: 'cone', atk: 2.5, cd: 0.9, hits: 5, from: ['ember-wyvern', 'cinder-hatchling'] },
  'astral-magus':       { name: 'Astral Magus', tier: 1, elems: ['lightning'], kind: 'mark', atk: 1.5, cd: 1.0, hits: 6, marks: true, explode: { base: 2.5, targets: 5 },
                          from: ['rune-apprentice', 'sigil-familiar'] },
  'hoarfrost-colossus': { name: 'Hoarfrost Colossus', tier: 1, elems: ['ice'], kind: 'pulse', atk: 2.2, cd: 1.1, hits: 6, from: ['frost-lynx', 'rime-sprite'] },
  'gloam-herald':       { name: 'Gloam Herald', tier: 1, elems: ['light', 'dark'], kind: 'beam', atk: 0.45, cd: 0.1, hits: 1, from: ['lantern-acolyte', 'hollow-shade'] },
  // God Fusions (arrive at level 10, one form)
  'stormcrown-drake':   { name: 'Stormcrown Drake', tier: 2, elems: ['fire', 'lightning'], kind: 'cone', atk: 2.6, cd: 0.8, hits: 6, from: ['twinflare-tyrant', 'astral-magus'] },
  'thermal-sovereign':  { name: 'Thermal Sovereign', tier: 2, elems: ['ice', 'fire'], kind: 'pulse', atk: 2.6, cd: 0.9, hits: 6, from: ['twinflare-tyrant', 'hoarfrost-colossus'] },
  'rimelight-seraph':   { name: 'Rimelight Seraph', tier: 2, elems: ['ice', 'light'], kind: 'pulse', atk: 2.6, cd: 0.9, hits: 6, from: ['hoarfrost-colossus', 'gloam-herald'] },
  // Secret Fusion (arrives at level 10; one cap-lifting trait)
  'eventide-arcanum':   { name: 'Eventide Arcanum', tier: 3, elems: ['fire', 'lightning', 'ice'], kind: 'cone', atk: 2.8, cd: 0.8, hits: 7, trait: 'chainMax10',
                          from: ['stormcrown-drake', 'rimelight-seraph'] }
};
export const fusionOf = (a, b) => Object.entries(MONSTERS).find(([, d]) => d.from && d.from.includes(a) && d.from.includes(b) && a !== b)?.[0];

// Spells and Traps: Lv 1-5, never fuse. per: [[STAT, pts per level], ...]
export const SPELLS = {
  'toll-of-ash':     { name: 'Toll of Ash', kind: 'spell', per: [[S.MIGHT, 700]], toll: true, text: 'Every 5 s, pay 3% of current LP. +7% Might a level.' },
  'kindling-rite':   { name: 'Kindling Rite', kind: 'spell', per: [[S.AFF_FIRE, 1200]] },
  'frost-litany':    { name: 'Frost Litany', kind: 'spell', per: [[S.AFF_ICE, 1200]] },
  'deep-marks':      { name: 'Deep Marks', kind: 'spell', per: [[S.MARKD, 1000]] },
  'swift-draw':      { name: 'Swift Draw', kind: 'spell', per: [[S.DRAW, 2000]] },
  'whetted-focus':   { name: 'Whetted Focus', kind: 'spell', per: [[S.KEEN, 6]] },
  'savage-rite':     { name: 'Savage Rite', kind: 'spell', per: [[S.FERO, 2500]] },
  'storm-lens':      { name: 'Storm Lens', kind: 'spell', per: [[S.RESO, 2000]] },
  'ringing-rite':    { name: 'Ringing Rite', kind: 'spell', per: [[S.FERV, 6]] },
  'iron-psalm':      { name: 'Iron Psalm', kind: 'spell', per: [[S.GUARD, 4]] },
  'quickened-pulse': { name: 'Quickened Pulse', kind: 'spell', per: [[S.TEMPO, 800]] },
  'monster-drill':   { name: 'Pack Discipline', kind: 'spell', per: [[S.SRC_MON, 1500]] },
  'gust-ward':       { name: 'Gust Ward', kind: 'trap', per: [], trap: 'gust', text: 'When you take damage: 6 m push, 2 damage. Rewind shortens its 4 s recharge.' },
  'pit-of-seals':    { name: 'Pit of Seals', kind: 'trap', per: [], trap: 'pit', atk: 10, cdSec: 6, hits: 8, elems: ['earth'] }
};

// Slotless items. Stack by count.
export const ITEMS = {
  'whetstone-tablet': { name: 'Whetstone Tablet', mods: [[S.KEEN, 6]] },
  'bronze-scale':     { name: 'Bronze Scale', mods: [[S.GUARD, 4]] },
  'lucky-coin':       { name: 'Lucky Coin', mods: [[S.FORT, 8]] },
  'clay-heart':       { name: 'Clay Heart', mods: [[S.LP, 15]] },
  'hunters-mark':     { name: "Hunter's Mark", mods: [[S.HUNT, 2500]] },
  'paper-talisman':   { name: 'Paper Talisman', mods: [[S.WARD, 1]] },
  'worn-duel-glove':  { name: 'Worn Duel Glove', mods: [[S.DRAW, 1500]] },
  'bandaged-hand':    { name: 'Bandaged Hand', mods: [[S.REGEN, 20]] },
  'veiled-sandals':   { name: 'Veiled Sandals', mods: [[S.SIDE, 12]] },
  'serrated-fang':    { name: 'Serrated Fang', mods: [[S.FERO, 2500]] },
  'humming-reed':     { name: 'Humming Reed', mods: [[S.FERV, 8]] },
  'cracked-hourglass':{ name: 'Cracked Hourglass', mods: [[S.REWIND, 1500]] },
  'burning-deck':     { name: 'Burning Deck', mods: [], cardElem: 'fire' },
  'graveyard-bell':   { name: 'Graveyard Bell', mods: [], fx: [[EV.KILL, FX.BELL]], text: 'Every 50th kill tolls: 10 damage around you.' },
  'notched-tally':    { name: 'Notched Tally', mods: [], fx: [[EV.KILL, FX.TALLY]], text: 'Each kill: +0.4% Might for 20 s.' },
  'thornbound-locket':{ name: 'Thornbound Locket', mods: [], fx: [[EV.HURT, FX.LOCKET_NOVA]], text: 'When you are hurt: a nova of 6 x Guard damage.' },
  'recoil-seal':      { name: 'Recoil Seal', mods: [], fx: [[EV.BLOCK, FX.RECOIL_SEAL]], text: 'A blocked hit is reflected at 200%.' },
  'unmarked-card':    { name: 'Unmarked Card', mods: [], hidden: true, text: 'It does nothing?', revealName: 'The Wild Draw' }
};

export const BLESSINGS = {
  might:   { name: 'Blessing of Might', mods: [[S.MIGHT, 1000]] },
  guard:   { name: 'Blessing of the Guard', mods: [[S.GUARD, 4]] },
  vigor:   { name: 'Blessing of Vigor', mods: [[S.LP, 20]] },
  haste:   { name: 'Blessing of Haste', mods: [[S.TEMPO, 1000]] },
  renewal: { name: 'Blessing of Renewal', mods: [[S.REGEN, 25]] },
  focus:   { name: 'Blessing of Focus', mods: [[S.KEEN, 4]] }
};

export const DUELISTS = {
  none: { name: 'Practice Duelist', id: DUELIST.NONE, start: 'ember-wyvern', passive: 'none' },
  kael: { name: 'Kael, Ember Tamer', id: DUELIST.KAEL, start: 'ember-wyvern', passive: 'Ante Up: coins held raise damage, 1 + 0.025 x sqrt(coins), up to x2.5' },
  mira: { name: 'Mira, Rune Scribe', id: DUELIST.MIRA, start: 'rune-apprentice', passive: 'Graveyard Toll: kills raise Tempo, 800 x log2(1 + kills/500) bp, up to +90%' },
  vesh: { name: 'Vesh, Hollow Hand', id: DUELIST.VESH, start: 'cinder-penitent', passive: 'Hollow Hand: missing LP raises damage, 1 + 1.2 x missing fraction' },
  oren: { name: 'Oren, Bound Pages', id: DUELIST.OREN, start: 'rime-sprite', passive: 'Bound Pages: +3 Fervor per Spell/Trap level, up to 60' }
};
