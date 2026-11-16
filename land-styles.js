// Land styles (Randall 16 Nov 2026, preview https://claude.ai/artifact/Xv5a3wJ2Kqmnr2ASuwSsc6, spec
// specs/land-styles.md): a style is one real printing of a basic land. Basics stay free and unlimited;
// owning one copy of a printing unlocks its look for every land of that type, in every deck. The deck row
// carries the chosen printing (id), so a match only changes the picture, never the rules.
// Shared by the server route (play-econ-route.js) and the app. Data: data/land-styles.json
// (scripts/bake-land-styles.mjs): every paper printing of the five basics, from Scryfall.

export const LAND_TYPES = Object.freeze(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);
// Regular set lands craft for a common seal, full art for an uncommon seal; Secret Lair and promo lands
// only come from packs (config.landStyles can retune both).
export const LAND_KINDS = Object.freeze({r: 'Regular', f: 'Full art', s: 'Special'});
export const landCraftSeal = (kind, config = {}) => kind === 's' ? null : (config?.landStyles?.craft?.[kind] || (kind === 'f' ? 'u' : 'c'));
// About 1 pack in 20 swaps its land for a Special land the player doesn't own yet.
export const landSpecialOdds = (config = {}) => { const n = Number(config?.landStyles?.specialOdds); return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1 / 20; };

// The baked file as a list of styles: {id, type, set, setName, num, kind, released, artist, booster}.
export function landStyleList(data) {
  const sets = data?.sets || {};
  return (data?.styles || []).map(([id, t, set, num, kind, released, artist, booster]) =>
    ({id, type: LAND_TYPES[t], set, setName: sets[set] || set.toUpperCase(), num, kind, released, artist, booster: !!booster})).filter(s => s.type);
}
export const landStyleImage = (id, size = 'normal') => /^[0-9a-f-]{36}$/.test(id || '') ? `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg` : '';
export const isLandType = name => LAND_TYPES.includes(String(name || ''));

// Which styles the player owns: the starter style of each type, every style unlocked in play.styles
// (pulled, crafted or found), and, for packs opened before land styles existed, every booster printing of
// a land type in each set the Trunk already holds that land from (the Trunk kept sets, not printings).
// Returns Map id -> {at, src}; at orders "Recently got" (0 = before land styles).
export function ownedLandStyles(list, {styles = [], cards = [], starter = {}} = {}) {
  const own = new Map(), byId = new Map(list.map(s => [s.id, s]));
  for (const t of LAND_TYPES) if (starter[t]) own.set(starter[t], {at: 0, src: 'starter'});
  const held = new Map();
  for (const c of cards) if (isLandType(c?.n)) held.set(c.n, new Set([...(c.s || [])].map(x => String(x).toLowerCase())));
  for (const s of list) if (s.booster && s.kind !== 's' && held.get(s.type)?.has(s.set) && !own.has(s.id)) own.set(s.id, {at: 0, src: 'trunk'});
  for (const c of cards) if (isLandType(c?.n) && byId.has(c.p) && !own.has(c.p)) own.set(c.p, {at: 0, src: 'trunk'});
  // play_styles lists newest first and carries no time, so the list order is the order they were got.
  styles.forEach((x, i) => { if (byId.has(x?.id)) own.set(x.id, {at: styles.length - i, src: x.src || ''}); });
  return own;
}

// The picker's order: the style in use first, then owned, then locked. Owned by "Recently got" (default),
// "Newest set" or "Oldest set"; locked ones by set date (newest first unless Oldest set).
export const LAND_SORTS = Object.freeze([['recent', 'Recently got'], ['newest', 'Newest set'], ['oldest', 'Oldest set']]);
export function sortLandStyles(list, owned, sort = 'recent', inUse = '') {
  const bySet = (a, b) => (sort === 'oldest' ? a.released.localeCompare(b.released) : b.released.localeCompare(a.released)) || a.num.localeCompare(b.num, 'en', {numeric: true});
  const mine = list.filter(s => owned.has(s.id)), locked = list.filter(s => !owned.has(s.id));
  mine.sort(sort === 'recent' ? (a, b) => (owned.get(b.id).at - owned.get(a.id).at) || bySet(a, b) : bySet);
  locked.sort(sort === 'oldest' ? bySet : (a, b) => b.released.localeCompare(a.released) || a.num.localeCompare(b.num, 'en', {numeric: true}));
  const i = mine.findIndex(s => s.id === inUse);
  if (i > 0) mine.unshift(mine.splice(i, 1)[0]);
  return [...mine, ...locked];
}

// The pack's land slot (Randall 16 Nov): it only gives a land style you don't own yet from that set. When
// you own all of them the slot gives one of the set's commons instead. Returns the filter for
// drawMtgBooster: {keep(id, card) -> bool for land sheets, fallback sheet name}.
export function landSlotPlan(data, owned) {
  const common = Object.keys(data?.sheets || {}).find(n => /^common$/i.test(n)) || Object.keys(data?.sheets || {}).find(n => /common/i.test(n) && !/uncommon/i.test(n) && !data.sheets[n].foil) || null;
  return {keep: (id, card) => !(isLandType(card?.name) && owned.has(id)), fallback: common};
}

// One Special land the player doesn't own yet, or null.
export function pickSpecialLand(list, owned, random = Math.random) {
  const pool = list.filter(s => s.kind === 's' && !owned.has(s.id));
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

// What play_add_styles stores for a land style.
export const landStyleRow = (s, oracle) => ({o: oracle, id: s.id, n: s.type, i: landStyleImage(s.id)});

// The printing a deck's land rows use: the row's own id when owned, else the account default (the style
// marked chosen), else the starter style.
export function deckLandStyle(type, rowId, owned, chosen = {}, starter = {}) {
  if (rowId && owned.has(rowId)) return rowId;
  if (chosen[type] && owned.has(chosen[type])) return chosen[type];
  return starter[type] || '';
}
