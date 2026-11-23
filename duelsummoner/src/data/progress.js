// Meta progress data: duelists (select screen), mastery, maps, difficulty rewards, Oaths, library rules. All data; the screens only read it.
// Placeholder names, jokes and numbers: the final text and look wait for the menu mock.

export const DUELIST_INFO = {
  kael: { name: 'Kael', title: 'Ember Tamer', joke: 'Has never once been told to calm down, and it shows.', passive: 'Ante Up: the more coins he holds, the harder he hits (planned: the Ledger passive).',
          start: 'ember-wyvern', color: 0x3c2a66, outfits: [{ id: 'kael-1', name: 'Cinder Coat', killsNeeded: 15000 }, { id: 'kael-2', name: 'Ashen Mantle', quest: 'mastery-kael-5' }] },
  mira: { name: 'Mira', title: 'Rune Scribe', joke: 'Annotates everything, including the enemies.', passive: 'Graveyard Toll: every kill quickens her monsters (planned: the Ledger passive).',
          start: 'rune-apprentice', color: 0x1f6a6a, outfits: [{ id: 'mira-1', name: 'Margin Robes', killsNeeded: 15000 }, { id: 'mira-2', name: 'Inked Cloak', quest: 'mastery-mira-5' }] },
  vesh: { name: 'Vesh', title: 'Hollow Hand', locked: true, quest: 'duelist-vesh', joke: '???', passive: 'Hollow Hand: hits harder the lower his health (planned).', start: null, color: 0x552233, outfits: [] },
  oren: { name: 'Oren', title: 'Page Binder', locked: true, quest: 'duelist-oren', joke: '???', passive: 'Bound Pages: Spell and Trap levels sharpen his luck (planned).', start: null, color: 0x4a5a2a, outfits: [] }
};
export const DUELIST_ORDER = ['kael', 'mira', 'vesh', 'oren'];

// Mastery rank from points = kills with the duelist + 250 per run. Thresholds are the points needed for each rank.
export const MASTERY = { pointsPerRun: 250, ranks: [0, 500, 1500, 3500, 7000, 12000, 20000, 32000, 50000, 80000], outfitKills: 15000 };
export function masteryRank(entry) {
  const pts = (entry ? entry.kills : 0) + (entry ? entry.runs : 0) * MASTERY.pointsPerRun; let r = 0;
  for (let i = 0; i < MASTERY.ranks.length; i++) if (pts >= MASTERY.ranks[i]) r = i + 1;
  const next = r < MASTERY.ranks.length ? MASTERY.ranks[r] : null, base = MASTERY.ranks[r - 1] || 0;
  return { rank: r, points: pts, next, frac: next === null ? 1 : (pts - base) / (next - base) };
}

export const MAPS = [
  { id: 'ruins', name: 'Surface Ruins', blurb: 'The sun-bleached top of the Buried Kingdom. Three stages, each deeper than the last.', stages: 3, quickDuel: true }
];
// Star Chip multiplier per difficulty (separate from the score multiplier in data/stages.js)
export const DIFF_CHIPS = { easy: 1.0, medium: 1.1, hard: 1.2 };

// Oaths: a rule sworn before the run. Each is its own quest (reward on completing a run with it), and is recorded in the run report.
// complete: how the run counts as keeping the oath ('clear' = cleared every stage; swift also needs the time). scorePct: added to the score multiplier in percent.
export const OATHS = [
  { id: 'glass', name: 'Glass Oath', text: 'Your health are 1 and cannot be raised.', reward: { chips: 60 }, scorePct: 20 },
  { id: 'hasty', name: 'Hasty Oath', text: 'The whole game runs at 1.25x speed.', reward: { chips: 25 }, scorePct: 10 },
  { id: 'small', name: 'Small Oath', text: 'Your duelist and summons are half size.', reward: { chips: 15 }, scorePct: 5 },
  { id: 'still', name: 'Still Oath', text: 'No dashing.', reward: { chips: 30 }, scorePct: 10 },
  { id: 'blind', name: 'Blind Oath', text: 'The minimap and boss plates are hidden.', reward: { chips: 25 }, scorePct: 10 },
  { id: 'pauper', name: 'Pauper Oath', text: 'No shop and no Broker.', reward: { chips: 25 }, scorePct: 10 },
  { id: 'swift', name: 'Swift Oath', text: 'Clear all 3 stages in under 20 minutes.', reward: { chips: 50 }, scorePct: 15, swiftSeconds: 1200 },
  { id: 'peace', name: 'Peace Oath', text: 'You deal no damage yourself for the first 3 minutes (your cards stay in your hand).', reward: { chips: 30 }, scorePct: 10, peaceSeconds: 180 }
];
export const OATH_BY_ID = Object.fromEntries(OATHS.map(o => [o.id, o]));

// Card Library: how many cards must stay in the offer pool
export const LIBRARY_MIN = 6;
// "useful stats": which stats lift a card (the Ledger stat names), by monster attack kind; Spells and Traps list their own
export const USEFUL_BY_ATTACK = {
  line: ['Might', 'Tempo', 'Reach', 'Volley', 'Drill: Monster'], lob: ['Might', 'Tempo', 'Reach', 'Drill: Monster'], mark: ['Mark Depth', 'Resonance', 'Tempo', 'Hunter'],
  homing: ['Might', 'Tempo', 'Volley', 'Swarmbane'], cone: ['Might', 'Tempo', 'Reach', 'Swarmbane']
};
export const USEFUL_BY_ELEMENT = { fire: 'Affinity: Fire', lightning: 'Affinity: Lightning', ice: 'Affinity: Ice', poison: 'Affinity: Poison', wind: 'Affinity: Wind', earth: 'Affinity: Earth', light: 'Affinity: Light', dark: 'Affinity: Dark' };
