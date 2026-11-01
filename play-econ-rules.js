// Pure Play economy rules, shared by the server routes and the app. No storage, no network,
// no prices. Values come from the play.config row (seeded from data/play-economy.json).
export const RARITY_SEAL = Object.freeze({common: 'c', uncommon: 'u', rare: 'r', mythic: 'm', special: 'r', bonus: 'm'});
// The Forge: three seals of one rarity become one seal of the next (settled 3:1, Randall 1 Nov).
// play.config can rebalance each step with forge: {u, r, m}; meltRareToMythic is the older name for m.
export const FORGE_STEPS = Object.freeze({u: 'c', r: 'u', m: 'r'});
export const forgeRatio = (config = {}, to = 'u') => Math.max(2, Number(config?.forge?.[to]) || (to === 'm' ? Number(config?.meltRareToMythic) : 0) || 3);
export const SEALS = Object.freeze([
  {key: 'c', rarity: 'common', label: 'Common seal'},
  {key: 'u', rarity: 'uncommon', label: 'Uncommon seal'},
  {key: 'r', rarity: 'rare', label: 'Rare seal'},
  {key: 'm', rarity: 'mythic', label: 'Mythic seal'}]);
const BASICS = /^(?:plains|island|swamp|mountain|forest|wastes|snow-covered (?:plains|island|swamp|mountain|forest))$/i;
export const isBasicLand = name => BASICS.test(String(name || '').trim());
const rarityOf = r => ['common', 'uncommon', 'rare', 'mythic'].includes(r) ? r : r === 'special' ? 'rare' : r === 'bonus' ? 'mythic' : 'common';

// The one-time starting gift: packs of the reward set, coins, seals and the starter deck's cards.
// cards: Scryfall cards for the starter deck's non-basic names; rows: [{name,qty}].
export function starterGrant(config = {}, setCode, cards = [], rows = []) {
  const s = config.starter || {}, byName = new Map(cards.map(c => [c.name, c])), out = [];
  for (const row of rows) {
    const c = byName.get(row.name);
    if (!c?.oracle_id || isBasicLand(row.name)) continue;
    for (let i = 0; i < Math.min(4, row.qty || 1); i++) out.push(cardDelta(c));
  }
  return {starter: true, coins: s.coins || 0, seals: s.seals || {},
    packs: Array.from({length: s.packs || 0}, () => ({set: setCode, source: 'starter'})), cards: out};
}

// One card for play.apply: identity plus the printing it came as (its set feeds set progress).
export function cardDelta(c = {}) {
  const img = c.image_uris || c.card_faces?.[0]?.image_uris || {};
  return {oracle_id: c.oracle_id || c.card_faces?.[0]?.oracle_id || '', name: c.name || '', rarity: rarityOf(c.rarity),
    set: c.set || '', id: c.id || '', image: c.image || img.normal || ''};
}

// Seals earned for the Nth pack opened (Arena's wildcard track): every 3rd an uncommon, and so on.
export function sealTrackBonus(config = {}, nth) {
  const t = config.sealTrack || {}, out = {};
  for (const k of ['u', 'r', 'm']) if (t[k] > 0 && nth > 0 && nth % t[k] === 0) out[k] = 1;
  return out;
}

// What a pulled card keeps in the pack record: identity and look, never a price.
export function packContentsRow(c = {}) {
  const img = c.image_uris || c.card_faces?.[0]?.image_uris || {};
  return {id: c.id || '', oracle_id: c.oracle_id || c.card_faces?.[0]?.oracle_id || '', name: c.name || '', rarity: rarityOf(c.rarity),
    set: c.set || '', number: c.collector_number || '', image: img.normal || img.large || '', art: img.art_crop || '',
    ...(c.packFoil ? {foil: true} : {}), ...(c.packSlot ? {slot: c.packSlot} : {})};
}

// Mastery level from XP: {level, into, need}.
export function masteryLevel(config = {}, xp = 0) {
  const per = config.mastery?.xpPerLevel || 1000, x = Math.max(0, xp | 0);
  return {level: 1 + Math.floor(x / per), into: x % per, need: per};
}

// A deck against the Play collection: which cards are missing and how many seals of each rarity
// fill the gap. deck: [{name,qty}]. owned: Map name→count. rarity: Map name→rarity.
export function deckShortfall(deck = [], owned = new Map(), rarity = new Map(), maxCopies = 4) {
  const want = new Map();
  for (const row of deck) if (row?.name && !isBasicLand(row.name)) want.set(row.name, (want.get(row.name) || 0) + Math.max(1, row.qty | 0));
  const missing = [], seals = {c: 0, u: 0, r: 0, m: 0};
  for (const [name, qty] of want) {
    const need = Math.min(qty, maxCopies) - (owned.get(name) || 0);
    if (need <= 0) continue;
    const r = rarityOf(rarity.get(name)), seal = RARITY_SEAL[r];
    missing.push({name, need, rarity: r, seal});
    seals[seal] += need;
  }
  return {missing, seals, complete: missing.length === 0};
}

// Copies owned by card name. Two-faced cards answer to their full name and their front face,
// since deck lists often name only the front ("Graveyard Trespasser").
export function ownedByName(cards = []) {
  const out = new Map();
  for (const c of cards) { out.set(c.n, c.c); const front = String(c.n || '').split(' // ')[0]; if (front !== c.n && !out.has(front)) out.set(front, c.c); }
  return out;
}

// Deck building rules for Play decks: size and copies by format. Basic lands are free and unlimited.
export const PLAY_FORMATS = ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper', 'Commander'];
export function deckRules(format = '') {
  return format === 'Commander' ? {size: 100, copies: 1, exact: true} : {size: 60, copies: 4, exact: false};
}
// How many more copies of a card this deck may take, from the Play collection and the format.
export function copiesLeft(name, deck = [], owned = new Map(), format = '') {
  if (isBasicLand(name)) return Infinity;
  const inDeck = deck.filter(c => c.name === name).reduce((t, c) => t + (c.qty | 0), 0);
  return Math.max(0, Math.min(owned.get(name) || 0, deckRules(format).copies) - inDeck);
}
// Adds (+1) or removes (-1) one copy, never past what the collection and format allow.
export function stepDeckCard(deck = [], name, step, owned = new Map(), format = '') {
  const rows = deck.map(c => ({...c})), row = rows.find(c => c.name === name);
  if (step > 0) {
    if (copiesLeft(name, rows, owned, format) < 1) return rows;
    if (row) row.qty += 1; else rows.push({name, qty: 1});
    return rows;
  }
  if (!row) return rows;
  row.qty -= 1;
  return rows.filter(c => c.qty > 0);
}
