// Secret Lair in Play (Randall 3 Nov: "Both"). Two bonuses, built on the Merchant, coins and the Trunk:
//  1. A weekly themed Secret Lair bundle at the Merchant: real Secret Lair printings for coins, a new one
//     every Play week (Monday), gone when the week ends. Buying it adds each card to the Trunk and unlocks
//     its Secret Lair art as a style.
//  2. Rare Secret Lair art styles from god packs, Story bosses and gold achievements: the Secret Lair art
//     of a card you already own, applied to your copy (pick it in the card view). If you own none of the
//     cards with a Secret Lair printing yet, the drop brings the card itself.
// Shared by the server route (play-econ-route.js) and the app. Data: data/secret-lair/drops.json
// (scripts/bake-secret-lair.mjs). A style changes the art you see; it never changes counts or rules.

const SKIP_LAYOUTS = new Set(['token', 'double_faced_token', 'art_series', 'emblem', 'planar', 'scheme', 'vanguard']);
const SKIP_PROMOS = ['serialized', 'playtest', 'sldbonus', 'thick'];
const RARITY = new Set(['common', 'uncommon', 'rare', 'mythic']);

// One Scryfall printing, slimmed for the baked file.
export function slimSecretLairCard(c = {}) {
  const o = c.oracle_id || c.card_faces?.[0]?.oracle_id || '';
  if (!o || !c.id || SKIP_LAYOUTS.has(c.layout) || (c.promo_types || []).some(p => SKIP_PROMOS.includes(p)) || c.digital || c.oversized) return null;
  const f = (c.finishes || []).filter(x => x === 'nonfoil' || x === 'foil' || x === 'etched');
  return {id: c.id, o, n: c.name || '', r: RARITY.has(c.rarity) ? c.rarity : 'rare', num: String(c.collector_number || ''), f: f.length ? f : ['nonfoil'], a: c.artist || '', d: c.released_at || ''};
}

// Scryfall has no drop names: a drop is a run of collector numbers released the same day by one artist,
// or a lettered series ("IFIYW-1..n"). Lone cards from a run with many artists are kept together.
export function groupSecretLairDrops(cards = []) {
  const slim = cards.map(slimSecretLairCard).filter(Boolean);
  const lettered = new Map(), numbered = [];
  for (const c of slim) {
    const m = c.num.match(/^([A-Z][A-Z0-9]*)-(\d+)$/);
    if (m) { const k = c.d + ':' + m[1]; if (!lettered.has(k)) lettered.set(k, []); lettered.get(k).push({...c, seq: Number(m[2])}); }
    else if (/^\d+$/.test(c.num)) numbered.push({...c, seq: Number(c.num)});
  }
  const groups = [];
  for (const [k, list] of lettered) groups.push({id: 'sld-' + k.split(':')[1].toLowerCase(), cards: list.sort((a, b) => a.seq - b.seq)});
  numbered.sort((a, b) => a.seq - b.seq);
  let run = [];
  const flush = () => {
    if (!run.length) return;
    // Split the run by artist, then keep runs of lone cards together (a multi-artist drop).
    const parts = [];
    for (const c of run) { const last = parts.at(-1); if (last && last[0].a === c.a) last.push(c); else parts.push([c]); }
    const merged = [];
    for (const p of parts) { const last = merged.at(-1); if (last && p.length < 3 && last.length < 3 && last.length + p.length <= 6) last.push(...p); else merged.push([...p]); }
    for (const p of merged) groups.push({id: 'sld-' + p[0].num, cards: p});
    run = [];
  };
  for (const c of numbered) {
    const last = run.at(-1);
    if (last && (c.d !== last.d || c.seq - last.seq > 2)) flush();
    run.push(c);
  }
  flush();
  return groups.map(g => ({id: g.id, released: g.cards[0].d, artists: [...new Set(g.cards.map(c => c.a).filter(Boolean))],
    cards: g.cards.map(({seq, d, ...c}) => c)})).sort((a, b) => a.released.localeCompare(b.released) || a.id.localeCompare(b.id));
}

// A week's bundle: only drops of 3 to 8 cards that are already out, picked by the week alone, so every
// player sees the same one and it never changes inside the week.
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function weeklySecretLair(drops = [], week = '', today = '') {
  const pool = drops.filter(d => d.cards.length >= 3 && d.cards.length <= 8 && (!today || d.released <= today));
  return pool.length ? pool[hash('sl:' + week) % pool.length] : null;
}
export const secretLairRef = week => 'sl:' + week;

// Coins for the bundle: 300 a card, 1,000 to 2,500 (a pack is 500). config.secretLair can retune it.
export function secretLairPrice(drop, config = {}) {
  // Priced card by card (Randall 5 Nov): each card at its rarity's coin price, then summed.
  return (drop?.cards || []).reduce((t, c) => t + secretLairOfferPrice({r: c.r}, config).was, 0);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// An honest label: the drop's month and its artists (Scryfall does not name drops).
export function secretLairLabel(drop) {
  const [y, m] = String(drop?.released || '').split('-'), when = y ? `${MONTHS[(Number(m) || 1) - 1]} ${y}` : '';
  const a = drop?.artists || [], by = a.length === 1 ? a[0] : a.length === 2 ? `${a[0]} and ${a[1]}` : a.length ? `${a.length} artists` : '';
  return {title: 'Secret Lair' + (when ? ` · ${when}` : ''), by: by ? `Art by ${by}` : ''};
}

export const secretLairImage = (id, size = 'normal') => /^[0-9a-f-]{36}$/.test(id || '') ? `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg` : '';

// The Trunk delta for one Secret Lair card (play.apply cards[]): foil-only printings come in holo.
export const secretLairCardDelta = c => ({oracle_id: c.o, name: c.n, rarity: c.r, set: 'sld', id: c.id, image: secretLairImage(c.id), ...(c.f.includes('nonfoil') ? {} : {foil: true})});
// One unlocked style (play_add_styles).
export const secretLairStyle = c => ({o: c.o, id: c.id, n: c.n, i: secretLairImage(c.id)});

// A rare style drop: the Secret Lair art of a card you own and have no style for yet. Owning none, it is a
// card with a Secret Lair printing, and the card comes with it. Null when every printing is unlocked.
export function pickSecretLairStyle(drops = [], owned = new Set(), unlocked = new Set(), rng = Math.random) {
  const all = drops.flatMap(d => d.cards).filter(c => !unlocked.has(c.id));
  const mine = all.filter(c => owned.has(c.o));
  const pool = mine.length ? mine : all;
  if (!pool.length) return null;
  const card = pool[Math.floor(rng() * pool.length) % pool.length];
  return {card, owned: owned.has(card.o)};
}

// The styles a player has unlocked for one card, and the one in use.
export function stylesFor(styles = [], oracle = '') {
  const list = styles.filter(s => s.o === oracle);
  return {list, on: list.find(s => s.on) || null};
}

// The Secret Lair store (Randall 3 Nov 22:34Z, like Arena's card-style store): six single Secret Lair
// cards a week beside the bundle, a few of them on sale. Each one is the real printing: into the Trunk,
// with its Secret Lair art unlocked. Pay in coins, or one seal of the card's rarity.
const SALES = [60, 50, 40, 25];
const BASIC = /^(?:Snow-Covered )?(?:Plains|Island|Swamp|Mountain|Forest|Wastes)$/;
export const SECRET_LAIR_OFFERS = 6;
export function weeklySecretLairOffers(drops = [], week = '', today = '', bundleId = '', n = SECRET_LAIR_OFFERS) {
  const pool = drops.filter(d => d.id !== bundleId && (!today || d.released <= today)).flatMap(d => d.cards).filter(c => !BASIC.test(c.n));
  const out = [], seen = new Set();
  let h = hash('slo:' + week);
  for (let tries = 0; out.length < n && tries < n * 20 && pool.length; tries++) {
    const c = pool[h % pool.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    if (seen.has(c.o)) continue;
    seen.add(c.o); out.push(c);
  }
  // Four are on sale, at 60, 50, 40 and 25% off, in places that change every week.
  const saleAt = new Set(); for (let i = 0; saleAt.size < Math.min(SALES.length, out.length); i++) saleAt.add((hash('sls:' + week + i)) % out.length);
  const order = [...saleAt];
  return out.map((c, i) => ({...c, off: order.includes(i) ? SALES[order.indexOf(i)] : 0}));
}
const SEAL = {common: 'c', uncommon: 'u', rare: 'r', mythic: 'm'};
// Coins: 200 for a common or uncommon, 300 for a rare, 500 for a mythic (config.secretLair.offerCoins),
// less the sale, rounded to 10. Or one seal of the card's rarity.
export function secretLairOfferPrice(card, config = {}) {
  const base = {...{common: 200, uncommon: 200, rare: 300, mythic: 500}, ...(config?.secretLair?.offerCoins || {})}[card?.r] ?? 300;
  return {was: base, coins: card?.off ? Math.max(10, Math.round(base * (100 - card.off) / 1000) * 10) : base, seal: SEAL[card?.r] || 'r'};
}
