// Elements and Fusion tiers, shaped so later content (more monsters, God and Secret Fusions) is data, not code.
// Built now: fire (burn) and lightning (chain). The rest are listed with their intended behaviour and not wired yet.
export const ELEMENTS = {
  fire:      { bit: 1, burn: { dps: 1, dur: 3 } },
  lightning: { bit: 2, chain: { jumps: 1, falloff: 0.5, radius: 4.5 } },
  ice:       { bit: 4, planned: 'slow, then freeze' },
  poison:    { bit: 8, planned: 'growing stacks' },
  wind:      { bit: 16, planned: 'knockback or pull' },
  earth:     { bit: 32, planned: 'armour break' },
  light:     { bit: 64, planned: 'heal on kill' },
  dark:      { bit: 128, planned: 'curse that spreads on death' }
};
export const REACTIONS = [                                     // planned: not wired yet
  { when: ['frozen', 'lightning'], result: 'shatter' },
  { when: ['burning', 'poison'], result: 'explode' },
  { when: ['wind', 'fire'], result: 'spread fire' }
];
export const elemBits = list => (list || []).reduce((b, e) => b | (ELEMENTS[e] ? ELEMENTS[e].bit : 0), 0);

// Tiers: monster -> Fusion (two monsters at level 10) -> God Fusion (two Fusions at 10, one form, arrives at level 10)
// -> Secret Fusion (two specific God Fusions, one form, hidden). Only monster and fusion exist in this build.
export const TIERS = {
  monster: { forms: 3, startLevel: 1 },
  fusion:  { forms: 3, startLevel: 1 },
  god:     { forms: 1, startLevel: 10 },
  secret:  { forms: 1, startLevel: 10, hidden: true }
};
// The generic recipe table: a + b -> result. Each ingredient must be on the field at the fusion level.
export const RECIPES = [
  { a: 'ember-wyvern', b: 'cinder-hatchling', result: 'twinflare-tyrant', tier: 'fusion' },
  { a: 'rune-apprentice', b: 'sigil-familiar', result: 'astral-magus', tier: 'fusion' }
];
