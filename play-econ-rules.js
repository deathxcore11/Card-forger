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
    set: c.set || '', id: c.id || '', image: c.image || img.normal || '', ...(c.foil ? {foil: true} : {})};
}
// Seals of the card's rarity that turn one owned copy holo at the Forge (Randall 2026-11-01 20:37Z).
export const holoCost = (config = {}) => Math.max(1, config?.holoSeals ?? 2);

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
// maxCopies: a number, or name → copies (Vintage's restricted cards count one). Copies past the
// cap never bill (eight owned across two old sets still only cover the four a deck may play), and
// rarity is the cheapest printing the card can be crafted at, when the caller knows it.
export function deckShortfall(deck = [], owned = new Map(), rarity = new Map(), maxCopies = 4) {
  const want = new Map(), cap = typeof maxCopies === 'function' ? maxCopies : () => maxCopies;
  for (const row of deck) if (row?.name && !isBasicLand(row.name)) want.set(row.name, (want.get(row.name) || 0) + Math.max(1, row.qty | 0));
  const missing = [], seals = {c: 0, u: 0, r: 0, m: 0};
  for (const [name, qty] of want) {
    const need = Math.min(qty, cap(name) ?? 4) - (owned.get(name) || 0);
    if (need <= 0) continue;
    const r = rarityOf(rarity.get(name)), seal = RARITY_SEAL[r];
    missing.push({name, need, rarity: r, seal});
    seals[seal] += need;
  }
  return {missing, seals, complete: missing.length === 0};
}
// Untapped's four-bucket check: Buildable when nothing is missing, Craftable when the seals cover
// every rarity bucket, otherwise short (with how many seals of each rarity are still needed).
export function deckStatus(shortfall, seals = {}) {
  if (shortfall?.complete) return {status: 'buildable', short: {c: 0, u: 0, r: 0, m: 0}};
  const short = {};
  for (const s of SEALS) short[s.key] = Math.max(0, (shortfall?.seals?.[s.key] || 0) - (seals?.[s.key] | 0));
  return {status: SEALS.some(s => short[s.key]) ? 'short' : 'craftable', short};
}

// Copies owned by card name. Two-faced cards answer to their full name and their front face,
// since deck lists often name only the front ("Graveyard Trespasser").
export function ownedByName(cards = []) {
  const out = new Map();
  // Copies pool across printings: rows that share a name add up (Untapped's cross-set pooling).
  const fronts = new Map();
  for (const c of cards) { if (!c?.n) continue; out.set(c.n, (out.get(c.n) || 0) + (c.c | 0)); const front = String(c.n).split(' // ')[0]; if (front !== c.n) fronts.set(front, (fronts.get(front) || 0) + (c.c | 0)); }
  for (const [front, n] of fronts) if (!out.has(front)) out.set(front, n);
  return out;
}

// Deck building rules for Play decks: size and copies by format. Basic lands are free and unlimited.
// Every format the Play table deals (play-setup.js). Singleton formats lead with a commander.
export const PLAY_FORMATS = ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper', 'Commander', 'Standard Brawl'];
const SINGLETON = {Commander: {size: 100, legality: 'commander'}, 'Standard Brawl': {size: 60, legality: 'standardbrawl'}};
export const isSingleton = format => !!SINGLETON[format];
export function deckRules(format = '') {
  const one = SINGLETON[format];
  return one ? {size: one.size, copies: 1, exact: true, commander: true, legality: one.legality} : {size: 60, copies: 4, exact: false, commander: false, legality: String(format || 'standard').toLowerCase()};
}
// Copies of one card a deck may play: basics unlimited, singleton 1, Vintage's restricted list 1.
// legalities: the card's Scryfall legalities when known.
export function copyCap(name, format = '', legalities = null) {
  if (isBasicLand(name)) return Infinity;
  const rules = deckRules(format);
  return legalities?.[rules.legality] === 'restricted' ? 1 : rules.copies;
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

// Precons: pay only for the cards you don't own yet, priced by rarity (Randall 5 Nov 18:05Z, "price by
// rarity, keep seals"). `missing` is a number (flat perCard, the old rate) or a seals-style count
// {c,u,r,m} from deckShortfall(...).seals. Rates come from play.config precon.perRarity, so they retune
// without a release. Minimum 250, no cap. A deck you already own entirely is free to add.
export const PRECON_RATES = Object.freeze({c: 25, u: 75, r: 500, m: 1500});
// Value pricing (Randall 5 Nov 20:12Z, half-scale ladder): 1 pack = 500 coins = $5. Each product class has a
// list price (config precon.list) and a player pays it times the share of the deck's value they don't own.
// Value weights: common 1, uncommon 3, rare 20, mythic 60; basic lands are free. The class comes from the
// MTGJSON deck type, then the cards (no rare or mythic = Pauper), then the release era (precon.eras).
export const PRECON_LIST = Object.freeze({pauper: 1500, standard: 2500, brawl: 3000, modern: 3500, commander: 5000, legacy: 7500});
// MTGJSON deck type -> class; anything not listed is classed by its cards and release date.
export const PRECON_TYPE_CLASS = Object.freeze({'Commander Deck': 'commander', 'Brawl Deck': 'brawl', 'Starter Kit': 'standard', 'Arena Starter Kit': 'standard',
  'Intro Pack': 'standard', 'Welcome Deck': 'standard', 'Clash Pack': 'standard', 'Masters Deck': 'legacy', 'From the Vault': 'legacy', 'Premium Deck': 'legacy'});
// Release-date eras for the rest (a date opens its class): Standard = the last three years.
export const PRECON_ERAS = Object.freeze({modern: '2012-10-05', legacy: '1900-01-01'});
export const PRECON_VALUE = Object.freeze({c: 1, u: 3, r: 20, m: 60});
export function preconClass(type = '', {rows = [], released = '', config = {}, now = Date.now()} = {}) {
  const types = {...PRECON_TYPE_CLASS, ...(config?.precon?.types || {})}, eras = {...PRECON_ERAS, ...(config?.precon?.eras || {})};
  if (types[type]) return types[type];
  const cards = rows.filter(r => r?.name && !isBasicLand(r.name));
  if (cards.length && cards.every(r => ['common', 'uncommon'].includes(rarityOf(r.rarity)))) return 'pauper';
  const std = new Date(now - 3 * 366 * 864e5).toISOString().slice(0, 10), d = String(released || '');
  return !d || d >= std ? 'standard' : d >= eras.modern ? 'modern' : 'legacy';
}
export function preconListPrice(cls = 'standard', config = {}) {
  return Number({...PRECON_LIST, ...(config?.precon?.list || {})}[cls]) || PRECON_LIST.standard;
}
// {price, missing, share, seals, cls}: rows [{name,qty,rarity}], owned Map, type = MTGJSON deck type.
export function preconQuote(rows = [], owned = new Map(), {type = '', released = '', config = {}, cap = 4, now = Date.now()} = {}) {
  const rarity = new Map(rows.map(r => [r.name, r.rarity])), short = deckShortfall(rows, owned, rarity, cap);
  const w = r => PRECON_VALUE[RARITY_SEAL[rarityOf(r)]] || 1, capOf = typeof cap === 'function' ? cap : () => cap;
  const want = new Map();
  for (const r of rows) if (r?.name && !isBasicLand(r.name)) want.set(r.name, (want.get(r.name) || 0) + Math.max(1, r.qty | 0));
  let total = 0; for (const [name, qty] of want) total += Math.min(qty, capOf(name) ?? 4) * w(rarity.get(name));
  const miss = short.missing.reduce((t, m) => t + m.need * w(m.rarity), 0), share = total ? Math.min(1, miss / total) : 0;
  const missing = short.missing.reduce((t, m) => t + m.need, 0), min = config?.precon?.min ?? 250, cls = preconClass(type, {rows, released, config, now});
  const price = miss <= 0 ? 0 : Math.max(min, Math.round(preconListPrice(cls, config) * share / 5) * 5);
  return {price, missing, share, seals: short.seals, short, cls};
}
export function preconPrice(missing = 0, config = {}) {
  const p = config?.precon || {};
  let total;
  if (missing && typeof missing === 'object') {
    const rates = {...PRECON_RATES, ...(p.perRarity || {})};
    total = SEALS.reduce((t, s) => t + (missing[s.key] | 0) * (Number(rates[s.key]) || 0), 0);
  } else total = (missing | 0) * (p.perCard ?? 25);
  return total <= 0 ? 0 : Math.max(p.min ?? 250, total);
}
// One MTGJSON deck card as a Play card grant: the exact printing in the product (set and number),
// so era decks keep their era art, basic lands included.
export const scryfallImage = id => /^[0-9a-f-]{36}$/i.test(id || '') ? `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg` : '';
export function mtgjsonCardDelta(c = {}) {
  const id = c.identifiers?.scryfallId || '';
  return {oracle_id: c.identifiers?.scryfallOracleId || '', name: c.name || '', rarity: rarityOf(c.rarity), set: String(c.setCode || '').toLowerCase(), id, image: scryfallImage(id)};
}
// The rows of an MTGJSON deck (main and sideboard), each with its exact printing.
export function mtgjsonDeckRows(d = {}) {
  const row = (c, board) => ({name: String(c.name || ''), qty: Math.max(1, c.count | 0), set: String(c.setCode || '').toLowerCase(), number: String(c.number || ''), id: c.identifiers?.scryfallId || '', rarity: rarityOf(c.rarity), ...(board === 'side' ? {board} : {})});
  return [...(d.mainBoard || []).map(c => row(c, 'main')), ...(d.sideBoard || []).map(c => row(c, 'side'))].filter(r => r.name);
}

// The face of a published deck, for its tile: the commander when it has one, else the star card
// (the deck's headline rare or mythic: planeswalkers and big creatures first, never a basic land).
// d: one MTGJSON deck. Returns {name, id} (id is the exact printing) or null.
export function preconFace(d = {}) {
  const pick = c => c?.identifiers?.scryfallId ? {name: String(c.name || ''), id: c.identifiers.scryfallId} : null;
  const cmd = pick((d.commander || [])[0]); if (cmd) return cmd;
  const weight = c => {
    const types = c.types || [], r = {mythic: 3, rare: 2, uncommon: 1}[c.rarity] || 0;
    return (types.includes('Planeswalker') ? 40 : types.includes('Creature') ? 20 : 0) + r * 12 + Math.min(10, c.manaValue | 0) + (c.isFoil ? 2 : 0) + Math.min(4, c.count | 0) * -1;
  };
  const pool = (d.mainBoard || []).filter(c => c?.identifiers?.scryfallId && !(c.supertypes || []).includes('Basic') && !(c.types || []).includes('Land'));
  return pick(pool.sort((a, b) => weight(b) - weight(a))[0]);
}

// Formats a pasted list can be played in: every card legal (Vintage also allows restricted cards at
// one copy) and the deck rules met. legal: Map name -> Scryfall legalities.
export function legalFormats(rows = [], legal = new Map()) {
  const main = rows.filter(r => r.board !== 'side'), size = main.reduce((t, r) => t + (r.qty | 0), 0);
  const copies = new Map();
  for (const r of rows) copies.set(r.name, (copies.get(r.name) || 0) + (r.qty | 0));
  return PLAY_FORMATS.filter(f => {
    const key = f.toLowerCase(), rule = deckRules(f);
    if (rule.exact ? size !== rule.size : size < rule.size) return false;
    for (const [name, n] of copies) {
      const l = legal.get(name)?.[key];
      if (!l) return false;
      if (l === 'restricted' ? n > 1 : l !== 'legal') return false;
      if (!isBasicLand(name) && n > rule.copies) return false;
    }
    return true;
  });
}

// Collector packs: the set's own booster with its real pull rates (same sheets, same rare and mythic
// odds), but every card comes out holo. Story bosses and the hard achievement steps always give one,
// and any ordinary pack can turn into one when it's opened (config.collectorOdds, 1 in 200 by default).
// A collector pack is a play.packs row whose source ends in ':collector', so no new column is needed.
export const COLLECTOR_ODDS = 1 / 200;
export const collectorSource = (source = 'reward') => String(source || 'reward').replace(/:collector$/, '') + ':collector';
export const isCollectorPack = pack => /(?:^|:)collector$/.test(String(pack?.source || ''));
export const collectorOdds = (config = {}) => { const n = Number(config?.collectorOdds); return Number.isFinite(n) && n >= 0 && n <= 1 ? n : COLLECTOR_ODDS; };
// Every pick holo; the pack keeps its cards, order and slots.
export function collectorPicks(picks = []) {
  const out = picks.map(p => ({...p, packFoil: true}));
  out.collector = true;
  return out;
}
// God pack odds by pack kind (mtg-boosters.js GOD_PACK_ODDS); config.godPackOdds can retune them.
export const godPackOdds = (config = {}, kind = 'regular') => { const n = Number(config?.godPackOdds?.[kind]); return Number.isFinite(n) && n >= 0 && n <= 1 ? n : kind === 'collector' ? 1 / 300 : 1 / 1000; };
