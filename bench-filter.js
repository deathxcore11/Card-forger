// The deck builder's filters (deck view redesign, approved 14 Nov): the bar's colours and the Filters panel's Mana value, Type,
// Does, Rarity, Copies you own, Set and Sort. A port of the native app's BenchFilter.kt, pure, so the pool, the live
// "N cards" count and the chips follow the same rules. No prices (Play's wall).
import {forgeTags} from './deck-forge.js';

export const BENCH = {
  // W U B R G, then C (colourless, not a land) and M (two colours or more).
  COLORS: ['W', 'U', 'B', 'R', 'G', 'C', 'M'],
  COLOR_NAMES: {W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colourless', M: 'Multicolour'},
  // 0..6, then 7 for 7 and up.
  MANA: [0, 1, 2, 3, 4, 5, 6, 7],
  TYPES: ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Battle', 'Land'],
  // The builder's own role tags (deck-forge.js forgeTags) and the words the panel shows for them.
  DOES: [['ramp', 'Ramp'], ['draw', 'Draw'], ['removal', 'Removal'], ['wipe', 'Sweeper'], ['protection', 'Protection'], ['wincon', 'Finisher']],
  RARITIES: [['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['mythic', 'Mythic']],
  // 1..3, then 4 for 4 and up.
  COPIES: [1, 2, 3, 4],
  SORTS: [['mv', 'Mana value'], ['name', 'Name'], ['rarity', 'Rarity'], ['new', 'Newest'], ['copies', 'Most copies']],
};
const RANK = {mythic: 0, rare: 1, uncommon: 2, common: 3};
export const rarityRank = r => RANK[String(r || '').toLowerCase()] ?? 4;
export const manaLabel = v => v >= 7 ? '7+' : String(v);
/** A card's mana value bucket: 0..6, 7 for 7 and up. */
export const bucket = cmc => Math.max(0, Math.min(7, Math.trunc(Number(cmc) || 0)));
export const BENCH_SORT_KEYS = new Set(BENCH.SORTS.map(([k]) => k));

/** No picks; Sort is kept by the caller (Reset keeps it too). */
export const emptyBench = (sort = 'mv') => ({mana: [], types: [], does: [], rarity: [], copies: [], notInDeck: false, set: '', sort: BENCH_SORT_KEYS.has(sort) ? sort : 'mv'});

/** The Filters button's badge: how many panel picks are on (colours show on the bar itself, Sort is not a filter). */
export const benchCount = (f = {}) => (f.mana?.length || 0) + (f.types?.length || 0) + (f.does?.length || 0) + (f.rarity?.length || 0) + (f.copies?.length || 0) + (f.notInDeck ? 1 : 0) + (f.set ? 1 : 0);

/** C = colourless and not a land, M = two colours or more. */
export function benchColorKeeps(t, colors = []) {
  const cs = t.colors || [];
  if (cs.some(c => colors.includes(c))) return true;
  if (colors.includes('C') && !cs.length && !t.land) return true;
  if (colors.includes('M') && cs.length >= 2) return true;
  return false;
}

const wordRe = new Map();
const typeHit = (w, line) => { let re = wordRe.get(w); if (!re) wordRe.set(w, re = new RegExp('\\b' + w + '\\b', 'i')); return re.test(line || ''); };

/** Does tile t pass every filter on? find is the bar's search, colors its colour buttons, roles the builder's tags by card name. */
export function benchKeeps(t, f = {}, find = '', colors = [], roles = null) {
  const q = String(find || '').trim().toLowerCase();
  if (q && !String(t.name || '').toLowerCase().includes(q)) return false;
  if (colors.length && !benchColorKeeps(t, colors)) return false;
  if (f.mana?.length && (t.land || !f.mana.includes(bucket(t.cmc)))) return false;
  // Either face's type counts (Scryfall's t: reads both), so a spell // land shows under Land too.
  if (f.types?.length && !f.types.some(w => typeHit(w, t.typeLine))) return false;
  if (f.does?.length) { const r = roles?.get?.(t.name) ?? roles?.get?.(String(t.name).split(' // ')[0]); if (!r) return false; if (!r.some(x => f.does.includes(x))) return false; }
  if (f.rarity?.length && !f.rarity.includes(String(t.rarity || '').toLowerCase())) return false;
  if (f.copies?.length && !f.copies.some(n => n >= 4 ? (t.own | 0) >= 4 : (t.own | 0) === n)) return false;
  if (f.notInDeck && (t.inDeck | 0) > 0) return false;
  if (f.set) { const s = f.set.toLowerCase(); if (String(t.set || '').toLowerCase() !== s && !(t.sets || []).some(x => String(x).toLowerCase() === s)) return false; }
  return true;
}

/** The tiles in the Sort's order. The web pool has no mana value sections, so Mana value sorts by mana value, then name. */
export function benchSorted(tiles = [], sort = 'mv') {
  const byName = (a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase());
  const cmp = {
    name: byName,
    rarity: (a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || byName(a, b),
    new: (a, b) => String(b.released || '').localeCompare(String(a.released || '')) || byName(a, b),
    copies: (a, b) => (b.own | 0) - (a.own | 0) || byName(a, b),
    mv: (a, b) => (a.land ? 99 : Number(a.cmc) || 0) - (b.land ? 99 : Number(b.cmc) || 0) || byName(a, b),
  }[sort] || null;
  return cmp ? tiles.slice().sort(cmp) : tiles.slice();
}

/** The chips under the bar: one per pick, in the panel's order, each naming the pick its × takes off. */
export function benchChips(f = {}, setName = code => String(code).toUpperCase()) {
  const out = [];
  for (const v of [...(f.mana || [])].sort((a, b) => a - b)) out.push({label: 'Mana ' + manaLabel(v), field: 'mana', value: String(v)});
  for (const t of BENCH.TYPES) if (f.types?.includes(t)) out.push({label: t, field: 'types', value: t});
  for (const [k, w] of BENCH.DOES) if (f.does?.includes(k)) out.push({label: w, field: 'does', value: k});
  for (const [k, w] of BENCH.RARITIES) if (f.rarity?.includes(k)) out.push({label: w, field: 'rarity', value: k});
  for (const n of [...(f.copies || [])].sort((a, b) => a - b)) out.push({label: n >= 4 ? 'Own 4+' : 'Own ' + n, field: 'copies', value: String(n)});
  if (f.notInDeck) out.push({label: 'Not in this deck', field: 'notInDeck', value: '1'});
  if (f.set) out.push({label: setName(f.set), field: 'set', value: f.set});
  return out;
}

/** A pick toggled on or off (a chip's × or a panel button); returns a new filter. */
export function benchToggle(f, field, value) {
  const next = {...f};
  if (field === 'notInDeck') next.notInDeck = !f.notInDeck;
  else if (field === 'set') next.set = f.set === value ? '' : String(value || '');
  else if (['mana', 'copies'].includes(field)) { const v = Number(value); if (!Number.isInteger(v)) return next; next[field] = f[field].includes(v) ? f[field].filter(x => x !== v) : [...f[field], v]; }
  else if (['types', 'does', 'rarity'].includes(field)) next[field] = f[field].includes(value) ? f[field].filter(x => x !== value) : [...f[field], value];
  return next;
}

/** Scryfall's words for the picks it can search itself (All cards): mana value, type, rarity, set. Does and copies stay local. */
export function benchQuery(f = {}) {
  const q = [];
  if (f.mana?.length) q.push('(' + [...f.mana].sort((a, b) => a - b).map(v => v >= 7 ? 'mv>=7' : 'mv=' + v).join(' or ') + ')');
  if (f.types?.length) q.push('(' + f.types.map(t => 't:' + t.toLowerCase()).join(' or ') + ')');
  if (f.rarity?.length) q.push('(' + f.rarity.map(r => 'r:' + r).join(' or ') + ')');
  if (f.set) q.push('s:' + f.set.toLowerCase());
  return q;
}
/** The bar's colours as one Scryfall group: (c:w or c:u); C is c:c, M is c:m. */
export const benchColorQuery = (colors = []) => colors.length ? '(' + colors.map(c => 'c:' + c.toLowerCase()).join(' or ') + ')' : '';

const costColors = cost => ['W', 'U', 'B', 'R', 'G'].filter(k => new RegExp('\\{[^}]*' + k + '[^}]*\\}').test(cost || ''));
/** Every colour of every face (a double-faced card shows under its back face's colour too), as the native allColorsOf.
 * A card saved before faces kept their colours: each face's cost; a face with no cost is colourless if it is a land, else
 * (a back face coloured by its indicator) the card's identity fills in. With no faces and no colours: the cost, else identity. */
export function allColors(card) {
  if (!card) return [];
  const faces = card.card_faces || [];
  const listed = [...(card.colors || []), ...faces.flatMap(f => f.colors || [])];
  if (Array.isArray(card.colors) || faces.some(f => Array.isArray(f.colors))) return [...new Set(listed)];
  if (faces.length) {
    const unknown = faces.some(f => !f.mana_cost && !/\bLand\b/.test(f.type_line || ''));
    if (unknown) return [...(card.color_identity || [])];
    return costColors(faces.map(f => f.mana_cost).join(''));
  }
  if (card.mana_cost) return costColors(card.mana_cost);
  return [...(card.color_identity || [])];
}

/** The deck's mana curve: copies of its spells (lands left out) at 0..6 and 7+. rows: [{qty, cmc}] with cmc null for no fact yet. */
export function benchCurve(rows = []) {
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) if (!r.land && r.cmc != null && Number.isFinite(Number(r.cmc))) out[bucket(r.cmc)] += r.qty | 0;
  return out;
}

/** The deck list by mana value: spells at each value (by name), then Other (no mana value to read yet), then Lands. */
export function benchByMana(groups = []) {
  const lands = groups.filter(g => g.name === 'Lands');
  const spells = groups.filter(g => g.name !== 'Lands').flatMap(g => g.rows);
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const known = spells.filter(r => r.cmc != null), by = new Map();
  for (const r of known) { const v = bucket(r.cmc); if (!by.has(v)) by.set(v, []); by.get(v).push(r); }
  const out = [...by].sort((a, b) => a[0] - b[0]).map(([v, rows]) => ({name: 'Mana value ' + manaLabel(v), rows: rows.sort(byName)}));
  const other = spells.filter(r => r.cmc == null);
  if (other.length) out.push({name: 'Other', rows: other.sort(byName)});
  return [...out, ...lands];
}

/** The Does tags: the builder's own role tags (forgeTags) that the panel offers. */
const DOES_KEYS = new Set(BENCH.DOES.map(([k]) => k));
export function roleTags(card) {
  if (!card) return [];
  try { return [...new Set(forgeTags(card).map(t => t.tag).filter(t => DOES_KEYS.has(t)))]; } catch { return []; }
}
