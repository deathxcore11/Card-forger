// Which set Play's reward packs come from. Never hardcoded: it is the newest set that is
//  (a) on Wizards' Standard list (forge-rules/current/official-format-facts.json, refreshed weekly),
//  (b) has a baked booster file (data/mtg-boosters/index.json), and
//  (c) has been released, per Scryfall's set list (an expansion or core set).
// Wizards' list is in page order, not release order, and uses display names, so names are cleaned
// and matched to Scryfall set codes here. Story mode does not use this: eras pay their own sets.
// Shared by the app and the worker, which must agree on it.

// "Magic: The Gathering | The Hobbit" → "the hobbit"; "Magic: The Gathering® Foundations" → "foundations".
export function cleanSetName(name) {
  return String(name || '')
    .replace(/[’‘`]/g, "'")
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+-\s+digital only/i, ' ')
    .replace(/^magic:\s*the\s*gathering\s*(?:®|\||—|-|:)?\s*/i, '')
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const KINDS = new Set(['expansion', 'core']);

// standardSets: Wizards' names. boosterIndex: data/mtg-boosters/index.json. scryfallSets: the data
// array from api.scryfall.com/sets. Returns [{code,name,released}] newest first, and the names that
// matched no set (each one is a data problem to look at, except digital-only entries).
export function standardBoosterSets({standardSets = [], boosterIndex = {}, scryfallSets = [], today = new Date()} = {}) {
  const day = (today instanceof Date ? today : new Date(today)).toISOString().slice(0, 10);
  const byName = new Map();
  for (const s of scryfallSets) if (s && KINDS.has(s.set_type) && !s.digital) byName.set(cleanSetName(s.name), s);
  const baked = boosterIndex.sets || {};
  const out = [], unmatched = [];
  for (const raw of standardSets) {
    const hit = byName.get(cleanSetName(raw));
    if (!hit) { if (!/digital only/i.test(raw)) unmatched.push(raw); continue; }
    if (!baked[hit.code] || !hit.released_at || hit.released_at > day) continue;
    out.push({code: hit.code, name: hit.name, released: hit.released_at});
  }
  out.sort((a, b) => b.released.localeCompare(a.released) || a.code.localeCompare(b.code));
  return {sets: out, unmatched};
}

// The reward set's code, or null when nothing qualifies (callers then keep the last known one).
export function rewardSet(input) {
  return standardBoosterSets(input).sets[0] || null;
}
