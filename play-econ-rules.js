// Pure Play economy rules, shared by the server routes and the app. No storage, no network,
// no prices. Values come from the play.config row (seeded from data/play-economy.json).
export const RARITY_SEAL = Object.freeze({common: 'c', uncommon: 'u', rare: 'r', mythic: 'm', special: 'r', bonus: 'm'});
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
    for (let i = 0; i < Math.min(4, row.qty || 1); i++) out.push({oracle_id: c.oracle_id, name: c.name, rarity: rarityOf(c.rarity)});
  }
  return {starter: true, coins: s.coins || 0, seals: s.seals || {},
    packs: Array.from({length: s.packs || 0}, () => ({set: setCode, source: 'starter'})), cards: out};
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
