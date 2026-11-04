// Play "Build a deck": an Untapped-style deck finder for the Play collection.
// Rows are ranked by how much of each list the player already owns; cards
// they don't own show greyed out with the seals that finish them. The first
// row is a Deck Forge build from the Trunk alone. The wall: no prices here.
// Card facts are fetched by name (slim, priceless) and kept per visit.
import {slimCard} from './play-econ-cards.js';
import {deckShortfall, deckStatus, copyCap, deckRules, isSingleton, isBasicLand, SEALS, RARITY_SEAL, PLAY_FORMATS} from './play-econ-rules.js';
import {symbolUrl, img} from './ui.js';
import {sealIcon} from './play-econ-ui.js';
import {deckShell, deckViewer, deckCardAttrs, deckCardCategory} from './deck-viewer.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SCRYFALL = 'https://api.scryfall.com';
// Every format the Play table deals. Standard Brawl has no tournament feed, so it lists Trunk builds.
export const FINDER_FORMATS = ['Standard', 'Pioneer', 'Modern', 'Pauper', 'Legacy', 'Vintage', 'Commander', 'Standard Brawl'];
if (FINDER_FORMATS.some(f => !PLAY_FORMATS.includes(f))) throw Error('Finder format outside Play');
const BASIC_COLOR = {Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G', Wastes: 'C'};
const typeOf = c => String(c?.type_line || c?.card_faces?.[0]?.type_line || '');
const frontName = n => String(n || '').split(' // ')[0];

// Card facts by name for lists the player doesn't own yet (meta decks).
export function createNameFacts({fetchImpl = globalThis.fetch?.bind(globalThis), onChange = () => {}} = {}) {
  const cards = new Map(), tried = new Set();
  return {
    get: name => cards.get(name) || cards.get(frontName(name)) || null,
    put(card) { if (card?.name) { cards.set(card.name, card); cards.set(frontName(card.name), card); } },
    async want(names) {
      const need = [...new Set(names)].filter(n => n && !isBasicLand(n) && !cards.has(n) && !cards.has(frontName(n)) && !tried.has(n));
      if (!need.length || !fetchImpl) return;
      need.forEach(n => tried.add(n));
      for (let i = 0; i < need.length; i += 75) {
        const body = await fetchImpl(SCRYFALL + '/cards/collection', {method: 'POST', headers: {Accept: 'application/json', 'Content-Type': 'application/json'}, body: JSON.stringify({identifiers: need.slice(i, i + 75).map(name => ({name: frontName(name)}))})}).then(r => r.ok ? r.json() : null).catch(() => null);
        for (const c of body?.data || []) this.put(slimCard(c));
      }
      onChange();
    },
  };
}

// Cheapest craftable rarity (Untapped bills missing copies at the lowest rarity a card was ever
// printed at): one Scryfall search per 40 names per rarity, common first, so Lightning Bolt bills a
// common seal even when the newest printing is a rare. The printing found is the one crafting
// stamps, so the seal shown is the seal the server charges. Kept on this device for 30 days.
const LOW_KEY = 'cardstashy-play-craft-rarity-v1', LOW_DAYS = 30, RARITIES = ['common', 'uncommon', 'rare', 'mythic'];
export function createCraftRarity({fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, onChange = () => {}, pause = ms => new Promise(r => setTimeout(r, ms)), now = () => Date.now()} = {}) {
  let low = {};
  try { const d = JSON.parse(storage?.getItem(LOW_KEY) || 'null'); if (d && typeof d === 'object') low = d; } catch {}
  const fresh = e => e && now() - (e.at || 0) < LOW_DAYS * 864e5;
  const tried = new Set(), missed = new Set(), queue = [];
  let running = null;
  const save = () => { try { storage?.setItem(LOW_KEY, JSON.stringify(low)); } catch {} };
  const entry = name => { const e = low[name] || low[frontName(name)]; return fresh(e) ? e : null; };
  async function run() {
    while (queue.length) {
      const names = queue.splice(0, 40);
      let left = names;
      for (const r of RARITIES) {
        if (!left.length) break;
        const q = '(' + left.map(n => `!"${frontName(n).replace(/"/g, '')}"`).join(' or ') + `) r:${r[0]} game:paper`;
        const body = await fetchImpl(SCRYFALL + '/cards/search?' + new URLSearchParams({q, unique: 'cards'}), {headers: {Accept: 'application/json'}}).then(x => x.json()).catch(() => null);
        if (!body) break; // offline or busy: ask again next visit
        const found = new Set();
        for (const c of body.data || []) {
          const e = {r, id: c.id, set: c.set, at: now()};
          for (const n of left) if (n === c.name || frontName(n) === frontName(c.name)) { low[n] = e; found.add(n); }
        }
        left = left.filter(n => !found.has(n));
        await pause(110); // Scryfall asks for ten requests a second at most
        if (r === 'mythic') left.forEach(n => missed.add(n)); // no paper printing: the caller decides
      }
      save();
      onChange();
    }
    running = null;
  }
  return {
    get: entry,
    rarity: name => entry(name)?.r || '',
    id: name => entry(name)?.id || '',
    missed: name => missed.has(name),
    want(names) {
      if (!fetchImpl) return Promise.resolve();
      const need = [...new Set(names)].filter(n => n && !isBasicLand(n) && !entry(n) && !tried.has(n));
      need.forEach(n => tried.add(n));
      queue.push(...need);
      return running || (queue.length ? (running = run()) : Promise.resolve());
    },
    get busy() { return !!running; },
  };
}

// Archetypes (Untapped clusters lists by their core card package, not by name): lists whose cores
// (cards played as three or more copies, or the commander) overlap by half or more share an
// archetype; the same tournament label joins at a quarter. The name is the label most members use.
const coreOf = list => {
  const main = (list.cards || []).filter(r => r?.name && !r.board && !isBasicLand(r.name));
  if (isSingleton(list.format)) return new Set([list.commander || main[0]?.name || ''].filter(Boolean));
  for (const min of [3, 2, 1]) { const set = new Set(main.filter(r => (r.qty | 0) >= min).map(r => r.name)); if (set.size >= 4 || min === 1) return set; }
  return new Set();
};
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let k = 0; for (const x of a) if (b.has(x)) k++; return k / (a.size + b.size - k); };
const label = l => String(l.archetype || l.name || '').trim();
export function clusterArchetypes(lists = []) {
  const clusters = [], of = new Map();
  for (const l of lists) {
    if (l.trunk) { of.set(l.key, {id: l.key, name: l.name, trunk: true}); continue; }
    const core = coreOf(l), tag = label(l).toLowerCase();
    let best = null, score = 0;
    for (const c of clusters) {
      const j = jaccard(core, c.core), s = j >= 0.5 || (tag && c.tags.has(tag) && j >= 0.25) ? j + (c.tags.has(tag) ? 0.5 : 0) : 0;
      if (s > score) { score = s; best = c; }
    }
    if (!best) { best = {id: 'arch:' + clusters.length, core, tags: new Map(), size: 0}; clusters.push(best); }
    best.size++;
    if (tag) best.tags.set(tag, {label: label(l), n: (best.tags.get(tag)?.n || 0) + 1});
    of.set(l.key, best);
  }
  const name = c => c.trunk ? c.name : [...c.tags.values()].sort((a, b) => b.n - a.n)[0]?.label || 'Deck';
  return {of: key => { const c = of.get(key); return c ? {id: c.id, name: name(c), size: c.size || 1, trunk: !!c.trunk} : null; }, count: clusters.length};
}

const GROUPS = [['Creatures', /\bCreature\b/], ['Planeswalkers', /\bPlaneswalker\b/], ['Spells', /\b(?:Instant|Sorcery)\b/], ['Permanents', /\b(?:Artifact|Enchantment|Battle)\b/], ['Lands', /\bLand\b/]];
const groupOf = card => (GROUPS.find(([, re]) => re.test(typeOf(card).split(' // ')[0])) || ['Other'])[0];

// One finder row: the list against the Play collection.
// rarityOf(name): the cheapest craftable rarity when known (createCraftRarity), else the printing's.
export function finderRow(list, {owned = new Map(), cardOf = () => null, seals = null, rarityOf = () => ''} = {}) {
  const commander = isSingleton(list.format), rows = new Map();
  for (const r of list.cards || []) if (r?.name && !r.board) rows.set(r.name, (rows.get(r.name) || 0) + Math.max(1, r.qty | 0));
  const rarity = new Map(), colors = new Set(), groups = new Map();
  let want = 0, have = 0;
  for (const [name, qty] of rows) {
    const card = cardOf(name), basic = isBasicLand(name), r = rarityOf(name) || card?.rarity || 'common';
    rarity.set(name, r);
    for (const k of card?.color_identity || (basic && BASIC_COLOR[name] ? [BASIC_COLOR[name]] : [])) if (k !== 'C') colors.add(k);
    const got = basic ? qty : Math.min(qty, owned.get(name) || owned.get(frontName(name)) || 0);
    if (!basic) { want += qty; have += got; }
    const g = basic ? 'Lands' : groupOf(card);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({name, qty, have: got, basic, rarity: r, seal: RARITY_SEAL[r] || 'r', image: card?.image_uris?.small || card?.card_faces?.[0]?.image_uris?.small || card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || '', art: card?.image_uris?.art_crop || card?.card_faces?.[0]?.image_uris?.art_crop || ''});
  }
  const shortfall = deckShortfall([...rows].map(([name, qty]) => ({name, qty})), new Map([...rows.keys()].map(n => [n, owned.get(n) || owned.get(frontName(n)) || 0])), rarity, name => copyCap(name, list.format, cardOf(name)?.legalities));
  const ordered = GROUPS.map(([g]) => g).concat('Other').filter(g => groups.has(g)).map(g => ({label: g, count: groups.get(g).reduce((t, c) => t + c.qty, 0), cards: groups.get(g).sort((a, b) => (b.have >= b.qty) - (a.have >= a.qty) || a.name.localeCompare(b.name))}));
  const lead = commander ? cardOf(list.commander) : null, cover = lead?.image_uris?.art_crop || ordered.flatMap(g => g.cards).find(c => !c.basic && c.art && /Creature|Planeswalker/.test(typeOf(cardOf(c.name))))?.art || ordered.flatMap(g => g.cards).find(c => c.art)?.art || '';
  const {status, short} = deckStatus(shortfall, seals || {}), enough = !!seals && status !== 'short';
  // Counted like the deck builder: copies you have (basics are free) out of the deck's size, so an
  // unfinished Trunk build reads 80/100 here too, never 39/39.
  const basics = [...rows].filter(([n]) => isBasicLand(n)).reduce((t, [, q]) => t + q, 0), size = Math.max(want + basics, list.size || deckRules(list.format).size);
  const open = Math.max(0, size - want - basics);
  return {status: open ? 'open' : status, short, size, cardsHave: have + basics, open, key: list.key, name: list.name || 'Deck', source: list.source || '', detail: list.detail || '', format: list.format, commander: list.commander || '', colors: 'WUBRG'.split('').filter(k => colors.has(k)), groups: ordered, want, have, share: (have + basics) / size, shortfall, complete: shortfall.complete && !open, enough, cover, list};
}

// Fast ownership share by names alone, so hundreds of meta lists can be sorted before any card
// facts load; only the rows on screen are built in full (finderRow) and fetched. With rarityOf and
// seals it also says Buildable / Craftable / short, or pending while a missing card's rarity loads.
export function ownedShare(list, owned = new Map(), {rarityOf = null, seals = null} = {}) {
  const rows = new Map();
  for (const r of list.cards || []) { if (!r?.name || r.board) continue; rows.set(r.name, (rows.get(r.name) || 0) + Math.max(1, r.qty | 0)); }
  const cap = isSingleton(list.format) ? 1 : 4;
  let have = 0, total = 0;
  for (const [name, q] of rows) { total += q; have += isBasicLand(name) ? q : Math.min(q, cap, owned.get(name) || owned.get(frontName(name)) || 0); }
  const size = Math.max(total, list.size || deckRules(list.format).size), complete = have >= size;
  if (!rarityOf) return {have, size, share: size ? have / size : 0, complete};
  let pending = false;
  const sh = deckShortfall([...rows].map(([name, qty]) => ({name, qty})), new Map([...rows.keys()].map(n => [n, owned.get(n) || owned.get(frontName(n)) || 0])),
    {get: n => { const r = rarityOf(n); if (!r) pending = true; return r; }}, cap);
  const {status, short} = deckStatus(sh, seals || {});
  return {have, size, share: size ? have / size : 0, complete, status: complete ? 'buildable' : pending && status !== 'buildable' ? 'pending' : status, cost: sh.seals, short};
}
// Untapped's personal filters: every list, the ones the Trunk already builds, or the ones the seals
// in hand finish now (Buildable ones included, first).
export const FINDER_FILTERS = [['all', 'All decks'], ['trunk', 'In Trunk'], ['craftable', 'Craftable now']];
export const FINDER_SORTS = [['owned', 'Closest to owned'], ['popular', 'Most played']];
// Sorted lists: the Trunk build first, then by the chosen sort; query narrows by deck or card name.
// filter: all | trunk | craftable (sort 'ready' is the older name for the trunk filter).
export function rankFinderLists(lists, {owned = new Map(), sort = 'owned', query = '', filter = 'all', rarityOf = null, seals = null, clusters = null} = {}) {
  const q = String(query).trim().toLowerCase(), seen = new Map(), only = sort === 'ready' ? 'trunk' : filter;
  const popOf = l => clusters?.of(l.key)?.size ?? seen.get(label(l).toLowerCase()) ?? 0;
  if (!clusters) for (const l of lists) { const a = label(l).toLowerCase(); seen.set(a, (seen.get(a) || 0) + 1); }
  const rank = {buildable: 0, craftable: 1, pending: 2, short: 3};
  return lists.map((l, i) => ({list: l, order: i, pop: popOf(l), ...ownedShare(l, owned, {rarityOf, seals})}))
    .filter(x => !q || x.list.trunk || (x.list.name || '').toLowerCase().includes(q) || label(x.list).toLowerCase().includes(q) || (x.list.cards || []).some(r => r.name.toLowerCase().includes(q)))
    .filter(x => only === 'trunk' ? x.complete : only === 'craftable' ? x.complete || x.status === 'craftable' : true)
    .sort((a, b) => (b.list.trunk === true) - (a.list.trunk === true) || (only === 'craftable' ? (rank[a.status] ?? 3) - (rank[b.status] ?? 3) : 0) || (sort === 'popular' ? b.pop - a.pop : 0) || b.share - a.share || a.order - b.order);
}
// Ranked lists folded into archetypes: each archetype leads with its best variant for this sort
// (the one closest to the Trunk), the rest ride along as variants.
export function finderArchetypes(ranked = [], clusters = null) {
  const out = [], by = new Map();
  for (const x of ranked) {
    const c = clusters?.of(x.list.key) || {id: x.list.key, name: label(x.list) || 'Deck', size: 1, trunk: !!x.list.trunk};
    let a = by.get(c.id);
    if (!a) { a = {id: c.id, name: c.trunk ? x.list.name : c.name, size: c.size, lead: x, variants: []}; by.set(c.id, a); out.push(a); }
    else a.variants.push(x);
  }
  return out;
}
// Ranked rows (full): ready decks first, then the most-owned lists; meta order breaks ties.
export function rankFinderRows(lists, ctx = {}) {
  return lists.map((l, i) => ({...finderRow(l, ctx), order: i})).sort((a, b) => (b.list.trunk === true) - (a.list.trunk === true) || b.complete - a.complete || b.share - a.share || a.order - b.order);
}

// A Deck Forge build from the Trunk alone: only cards the player owns (and basics).
// build = builder.buildDeck; owned = state.cards; factOf(oracle) → slim card.
export function trunkDeck({format, ownedCards = [], factOf = () => null, build, hooksOf = null} = {}) {
  if (typeof build !== 'function') return null;
  const catalog = {}, stock = new Map();
  for (const c of ownedCards) { const card = factOf(c.o); if (!card?.name) continue; catalog[card.name.toLowerCase()] = card; stock.set(card.name, (stock.get(card.name) || 0) + (c.c | 0)); }
  const rules = deckRules(format);
  for (const [name, k] of Object.entries(BASIC_COLOR)) catalog[name.toLowerCase()] = {name, type_line: 'Basic Land — ' + name, oracle_text: `({T}: Add {${k}}.)`, cmc: 0, mana_cost: '', color_identity: k === 'C' ? [] : [k], produced_mana: [k], legalities: Object.fromEntries(['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'commander', 'standardbrawl'].map(f => [f, 'legal'])), rarity: 'common'};
  const legal = c => ['legal', 'restricted'].includes(c?.legalities?.[rules.legality]);
  const spells = Object.values(catalog).filter(c => legal(c) && !/\bLand\b/.test(typeOf(c)));
  // Build-arounds: legendary creatures for Commander (and planeswalkers for Brawl), otherwise the
  // cards owned in the most copies.
  const leads = rules.commander
    ? spells.filter(c => /Legendary/.test(typeOf(c)) && (/Creature/.test(typeOf(c)) || (format === 'Standard Brawl' && /Planeswalker/.test(typeOf(c))))).sort((a, b) => (hooksOf ? hooksOf(b, spells) - hooksOf(a, spells) : 0) || a.name.localeCompare(b.name)).slice(0, 4)
    : spells.sort((a, b) => (stock.get(b.name) || 0) - (stock.get(a.name) || 0) || (a.edhrec_rank || 1e9) - (b.edhrec_rank || 1e9)).slice(0, 4);
  let best = null;
  for (const seed of leads) {
    let d = null;
    try { d = build({format, seeds: [seed], commander: rules.commander ? seed : null, catalog, available: name => isBasicLand(name) ? 99 : stock.get(name) || 0, price: () => null, budget: 0, power: 'casual'}); } catch { continue; }
    if (!best || d.open < best.open) best = d;
    if (!d.open) break;
  }
  if (!best) return null;
  return {key: 'trunk:' + format, trunk: true, name: 'Forged from your Trunk', source: 'Deck Forge', detail: best.open ? `${best.open} slots to fill` : 'Every card is yours', size: rules.size, format, commander: best.commander || '', cards: best.cards.map(r => ({name: r.name, qty: r.qty})), open: best.open};
}

const pips = colors => colors.length ? colors.map(k => `<img class="pf-pip" src="${symbolUrl(k)}" alt="${k}" width="22" height="22">`).join('') : `<img class="pf-pip" src="${symbolUrl('C')}" alt="Colorless" width="22" height="22">`;
const sealChip = (key, count, title) => `<span class="pf-seal" data-seal="${key}" title="${esc(title)}">${sealIcon(key)}<b>${count}</b></span>`;

function cardChip(c) {
  const missing = !c.basic && c.have < c.qty, label = `${c.name}: ${c.basic ? c.qty + ' basic' : c.have + ' of ' + c.qty + ' owned'}`;
  // Basics (and any card without art yet) sit as a slim mana chip instead of a broken image.
  if (c.basic || !c.image) {
    const k = BASIC_COLOR[c.name];
    return `<button class="pf-card pf-card--slim${missing ? ' pf-card--missing' : ''}" data-act="card" data-name="${esc(c.name)}" data-play-card="1" aria-label="${esc(label)}">${k ? `<img class="pf-pip" src="${symbolUrl(k)}" alt="" width="20" height="20">` : ''}<span>${esc(c.name)}</span><b>${c.basic ? c.qty : c.have + '/' + c.qty}</b></button>`;
  }
  return `<button class="pf-card${missing ? ' pf-card--missing' : ''}" data-act="card" data-name="${esc(c.name)}" data-play-card="1" aria-label="${esc(label)}">${img(c.image, c.name, 'pf-art')}<span class="pf-count"><b>${c.have}/${c.qty}</b>${missing ? sealIcon(c.seal, 'pf-mini') : ''}</span></button>`;
}

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const sealLabel = k => SEALS.find(s => s.key === k)?.rarity || '';
// Seal cost chips: the buckets the wallet can't cover yet are marked short.
const costChips = (cost = {}, short = {}) => SEALS.filter(s => cost[s.key]).map(s => `<span class="pf-seal${short[s.key] ? ' pf-seal--short' : ''}" data-seal="${s.key}" title="${esc(`${cost[s.key]} ${s.rarity} seal${cost[s.key] > 1 ? 's' : ''}${short[s.key] ? `, ${short[s.key]} more than you have` : ''}`)}">${sealIcon(s.key)}<b>${cost[s.key]}</b></span>`).join('');
// Buildable / Craftable / the seals still needed. pop = the status just changed (pending → known).
export function statusMarkup({status, cost = {}, short = {}, slots = 0} = {}, {pop = false, mini = false} = {}) {
  status = status || 'pending';
  const cls = `pf-status pf-status--${status || 'pending'}${pop ? ' pf-status--pop' : ''}${mini ? ' pf-status--mini' : ''}`;
  if (status === 'buildable') return `<span class="${cls}">${CHECK}<b>Buildable</b></span>`;
  if (status === 'craftable') return `<span class="${cls}" title="Your seals cover every missing card">${costChips(cost)}<b>Craftable</b></span>`;
  if (status === 'open') return `<span class="${cls}"><b>${slots} slot${slots === 1 ? '' : 's'} to fill</b></span>`;
  if (status === 'pending') return `<span class="${cls}" aria-label="Counting seals"><i></i><i></i><i></i></span>`;
  return `<span class="${cls}">${costChips(cost, short)}</span>`;
}

// One archetype: its best variant in full, the other lists as slim rows. arch = {name, size, variants}.
// enter = first time on screen (rise in, meter fills); pop = its status just resolved.
export function finderRowMarkup(row, {arch = null, enter = false, pop = false, index = 0} = {}) {
  const title = arch?.name || row.name, sub = [title !== row.name ? row.name : '', row.source === 'Meta' ? '' : row.source, row.detail].filter(Boolean).join(' · ');
  const variants = arch?.variants || [];
  const variantRow = x => `<li class="pf-variant"><span class="pf-variant-name"><button class="pf-open" data-act="playFinderOpen" data-finder-key="${esc(x.list.key)}"><b>${esc(x.list.name || 'Deck')}</b></button>${x.list.detail ? `<small>${esc(x.list.detail)}</small>` : ''}</span><span class="pf-variant-own" title="${x.have} of ${x.size} cards owned"><b>${x.have}/${x.size}</b><i class="pf-meter" aria-hidden="true"><i style="width:${Math.round(x.share * 100)}%"></i></i></span>${statusMarkup(x, {mini: true})}<button class="btn ghost pf-variant-use" data-act="playFinderUse" data-finder-key="${esc(x.list.key)}" aria-label="Build ${esc(x.list.name || 'this list')}">Build</button></li>`;
  return `<article class="pf-row${enter ? ' pf-row--enter' : ''}" data-status="${esc(row.status)}" style="--pf-art:url('${esc(row.cover)}');--pf-i:${index}">
    <header class="pf-head"><div class="pf-title">${pips(row.colors)}<h3><button class="pf-open" data-act="playFinderOpen" data-finder-key="${esc(row.key)}">${esc(title)}</button></h3>${arch?.size > 1 ? `<span class="pf-arch-count" title="${arch.size} tournament lists in this archetype">${arch.size}</span>` : ''}<small>${esc(sub)}</small></div>
      <div class="pf-own" title="${row.cardsHave} of ${row.size} cards ready${row.open ? `, ${row.open} slots to fill` : ''}"><b>${row.cardsHave}/${row.size}</b><span>owned</span><i class="pf-meter" aria-hidden="true"><i style="width:${Math.round(row.share * 100)}%"></i></i></div>
      <div class="pf-state">${statusMarkup({status: row.status, cost: row.shortfall.seals, short: row.short, slots: row.open}, {pop})}</div>
      <button class="btn pf-use" data-act="playFinderUse" data-finder-key="${esc(row.key)}">${row.complete ? 'Use deck' : 'Build it'}</button></header>
    <div class="pf-groups">${row.groups.map(g => `<section class="pf-group"><h4>${esc(g.label)} <span>${g.count}</span></h4><div class="pf-cards">${g.cards.map(cardChip).join('')}</div></section>`).join('')}</div>
    ${variants.length ? `<details class="pf-variants"><summary><span>${variants.length} more list${variants.length > 1 ? 's' : ''}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><ul>${variants.slice(0, 12).map(variantRow).join('')}</ul></details>` : ''}
  </article>`;
}

// The whole screen. head = play-econ-ui head(); items = [{row, arch, enter, pop}] already ranked.
// counts = {all, trunk, craftable}; rarityBusy = cheapest rarities still loading.
export function finderMarkup({headHtml = '', format = 'Standard', rows = [], items = null, busy = false, error = '', limit = 8, total = null, sort = 'owned', query = '', filter = 'all', counts = null, rarityBusy = false, more = null} = {}) {
  const list = (items || rows.map(row => ({row}))).slice(0, limit);
  const tabs = FINDER_FORMATS.map(f => `<button class="pf-tab${f === format ? ' on' : ''}" data-act="playFinderFormat" data-finder-format="${f}" aria-pressed="${f === format}">${f}</button>`).join('');
  const filters = FINDER_FILTERS.map(([k, l]) => `<button class="pf-tab pf-filter${k === filter ? ' on' : ''}${k === 'craftable' && rarityBusy ? ' pf-filter--busy' : ''}" data-act="playFinderFilter" data-finder-filter="${k}" aria-pressed="${k === filter}">${k === 'trunk' ? CHECK : k === 'craftable' ? sealIcon('r', 'pf-filter-seal') : ''}<span>${l}</span>${counts?.[k] != null ? `<b>${counts[k].toLocaleString('en-US')}</b>` : ''}</button>`).join('');
  const sorts = FINDER_SORTS.map(([k, l]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${l}</option>`).join('');
  const empty = filter === 'trunk' ? 'Nothing your Trunk builds yet in this format.' : filter === 'craftable' ? (rarityBusy ? 'Counting seals…' : 'Your seals don’t finish a list here yet.') : 'No decks for this format yet.';
  return `<section class="play-menu pe-screen pf-screen" aria-labelledby="playTitle">${headHtml}
    <div class="pf-bar"><div class="pf-tabs pf-formats" role="group" aria-label="Format">${tabs}</div><button class="btn ghost pf-empty" data-act="playEconEditDeck" data-econ-deck="">Start empty</button></div>
    <div class="pf-bar pf-filters"><div class="pf-tabs pf-filter-row" role="group" aria-label="Show">${filters}</div><select class="pe-sort pf-sort" data-change="playFinderSort" aria-label="Sort decks">${sorts}</select><label class="pe-search pf-search"><span class="pf-total">${total == null ? '' : `${total.toLocaleString('en-US')} deck${total === 1 ? '' : 's'}`}</span><input type="search" data-input="playFinderQuery" value="${esc(query)}" maxlength="60" placeholder="Deck or card name" aria-label="Find a deck or card"></label></div>
    ${error ? `<p class="pf-note" role="status">${esc(error)}</p>` : ''}
    <div class="pf-list" aria-busy="${busy}">${list.map((x, i) => finderRowMarkup(x.row, {arch: x.arch, enter: x.enter, pop: x.pop, index: i})).join('') || (busy ? '<div class="pf-skeleton" aria-hidden="true"></div><div class="pf-skeleton" aria-hidden="true"></div>' : `<p class="pf-note">${empty}</p>`)}</div>
    ${(more ?? (total ?? (items || rows).length) > limit) ? `<button class="btn ghost pf-more" data-act="playFinderMore">More decks</button>` : ''}
  </section>`;
}

// The deck page, the app's own (deckShell hero + deck viewer with its four views): every card with
// Play ownership, greyed when missing with the seal that crafts it, never a price. Card taps open
// the Play card view. cardOf(name) → slim card; plan rows come from finderRow.
const ORDER = ['Commander', 'Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Battles', 'Lands', 'Unresolved'];
export function finderDeckMarkup(row, {arch = null, cardOf = () => null, packGoals = '', crafting = false, armed = false} = {}) {
  const title = arch?.name || row.name, list = row.list, lead = list.commander || '';
  const missing = row.shortfall.missing.reduce((t, m) => t + m.need, 0);
  const sub = [title !== row.name ? row.name : '', row.source === 'Meta' ? '' : row.source, row.detail].filter(Boolean).join(' · ');
  const cards = row.groups.flatMap(g => g.cards), groups = new Map();
  for (const c of cards) {
    const card = cardOf(c.name), cat = lead && c.name === lead ? 'Commander' : c.basic ? 'Lands' : deckCardCategory(card);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({...c, card, cat});
  }
  const own = c => c.basic ? '' : c.have >= c.qty ? '<span class="own yes">In your Trunk</span>' : `<span class="own no">${c.have ? `${c.have}/${c.qty} · ` : ''}${sealIcon(c.seal, 'pf-mini')} ${c.qty - c.have} to craft</span>`;
  const cardRow = c => `<div class="lot deck-row pf-deck-row${!c.basic && c.have < c.qty ? ' pf-deck-row--missing' : ''}" ${deckCardAttrs(c.name, c.qty, 'main', c.card, c.cat)}>
    <button class="lot-art" data-act="card" data-name="${esc(c.name)}" data-play-card="1" aria-label="Open ${esc(c.name)}">${c.image || c.card ? img(c.image || c.card?.image_uris?.normal || c.card?.card_faces?.[0]?.image_uris?.normal || '', c.name) : ''}</button>
    <div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(c.name)}" data-play-card="1">${esc(c.name)}</button>${c.card?.mana_cost ? `<span class="lot-sub">${esc(c.card.mana_cost.replace(/[{}]/g, ''))}</span>` : ''}${own(c)}</div>
    <div class="lot-side"><span class="chip">${c.qty}×${c.cat === 'Commander' ? ' · Commander' : ''}</span></div></div>`;
  const body = ORDER.concat([...groups.keys()].filter(g => !ORDER.includes(g))).filter(g => groups.has(g)).map(g => {
    const rows = groups.get(g).sort((a, b) => (a.card?.cmc ?? 99) - (b.card?.cmc ?? 99) || a.name.localeCompare(b.name));
    return `<details class="group" open><summary><span>${esc(g)} <em>${rows.reduce((t, r) => t + r.qty, 0)}</em></span></summary><div class="list display-list" data-deck-list>${rows.map(cardRow).join('')}</div></details>`;
  }).join('');
  const sealStats = SEALS.filter(sl => row.shortfall.seals[sl.key]).map(sl => ({value: `${sealIcon(sl.key, 'pf-stat-seal')}${row.shortfall.seals[sl.key]}`, label: `${sl.rarity} seal${row.shortfall.seals[sl.key] > 1 ? 's' : ''}`, tone: row.short?.[sl.key] ? 'warn' : ''}));
  const canCraft = missing && row.status === 'craftable';
  return `<div class="ds-page pf-deck-page">${deckShell({game: 'mtg', source: 'play', art: row.cover, title,
    back: '<button class="icon light" data-act="playFinderBack" aria-label="Back to Build a deck">←</button>',
    badge: list.trunk ? 'Deck Forge' : 'Meta', format: `<span class="chip dark">${esc(row.format)}</span>`, line: esc(sub),
    stats: [{value: `${row.cardsHave}/${row.size}`, label: 'owned'}, ...sealStats], owned: row.share,
    // The hero already lists the seals; the pill only names the state.
    lead: ['buildable', 'craftable', 'open'].includes(row.status) ? statusMarkup({status: row.status, slots: row.open}) : '',
    actions: [{label: row.complete ? 'Use deck' : 'Build it', primary: true, attrs: `data-act="playFinderUse" data-finder-key="${esc(row.key)}"`},
      canCraft ? {label: crafting ? 'Crafting…' : armed ? `Craft ${missing} now` : `Craft all ${missing}`, attrs: `data-act="playFinderCraftAll" data-finder-key="${esc(row.key)}"${armed ? ' data-armed="1"' : ''}`, disabled: crafting} : null,
      {label: 'Copy list', attrs: `data-act="playFinderCopy" data-finder-key="${esc(row.key)}"`}]}).replace('<h1>', '<h1 id="playFinderDeckTitle" tabindex="-1">')}
    ${packGoals}
    ${deckViewer('mtg', body)}
  </div>`;
}
