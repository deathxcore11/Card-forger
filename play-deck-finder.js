// Play "Build a deck": an Untapped-style deck finder for the Play collection.
// Rows are ranked by how much of each list the player already owns; cards
// they don't own show greyed out with the seals that finish them. The first
// row is a Deck Forge build from the Trunk alone. The wall: no prices here.
// Card facts are fetched by name (slim, priceless) and kept per visit.
import {slimCard} from './play-econ-cards.js';
import {deckShortfall, isBasicLand, SEALS, RARITY_SEAL} from './play-econ-rules.js';
import {symbolUrl, img} from './ui.js';
import {sealIcon} from './play-econ-ui.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SCRYFALL = 'https://api.scryfall.com';
export const FINDER_FORMATS = ['Standard', 'Pioneer', 'Modern', 'Pauper', 'Legacy', 'Vintage', 'Commander'];
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

const GROUPS = [['Creatures', /\bCreature\b/], ['Planeswalkers', /\bPlaneswalker\b/], ['Spells', /\b(?:Instant|Sorcery)\b/], ['Permanents', /\b(?:Artifact|Enchantment|Battle)\b/], ['Lands', /\bLand\b/]];
const groupOf = card => (GROUPS.find(([, re]) => re.test(typeOf(card).split(' // ')[0])) || ['Other'])[0];

// One finder row: the list against the Play collection.
export function finderRow(list, {owned = new Map(), cardOf = () => null, seals = null} = {}) {
  const commander = list.format === 'Commander', rows = new Map();
  for (const r of list.cards || []) if (r?.name && !r.board) rows.set(r.name, (rows.get(r.name) || 0) + Math.max(1, r.qty | 0));
  const rarity = new Map(), colors = new Set(), groups = new Map();
  let want = 0, have = 0;
  for (const [name, qty] of rows) {
    const card = cardOf(name), basic = isBasicLand(name), r = card?.rarity || 'common';
    rarity.set(name, r);
    for (const k of card?.color_identity || (basic && BASIC_COLOR[name] ? [BASIC_COLOR[name]] : [])) if (k !== 'C') colors.add(k);
    const got = basic ? qty : Math.min(qty, owned.get(name) || owned.get(frontName(name)) || 0);
    if (!basic) { want += qty; have += got; }
    const g = basic ? 'Lands' : groupOf(card);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({name, qty, have: got, basic, rarity: r, seal: RARITY_SEAL[r] || 'r', image: card?.image_uris?.small || card?.card_faces?.[0]?.image_uris?.small || card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || '', art: card?.image_uris?.art_crop || card?.card_faces?.[0]?.image_uris?.art_crop || ''});
  }
  const shortfall = deckShortfall([...rows].map(([name, qty]) => ({name, qty})), new Map([...rows.keys()].map(n => [n, owned.get(n) || owned.get(frontName(n)) || 0])), rarity, commander ? 1 : 4);
  const ordered = GROUPS.map(([g]) => g).concat('Other').filter(g => groups.has(g)).map(g => ({label: g, count: groups.get(g).reduce((t, c) => t + c.qty, 0), cards: groups.get(g).sort((a, b) => (b.have >= b.qty) - (a.have >= a.qty) || a.name.localeCompare(b.name))}));
  const lead = commander ? cardOf(list.commander) : null, cover = lead?.image_uris?.art_crop || ordered.flatMap(g => g.cards).find(c => !c.basic && c.art && /Creature|Planeswalker/.test(typeOf(cardOf(c.name))))?.art || ordered.flatMap(g => g.cards).find(c => c.art)?.art || '';
  const enough = !!seals && SEALS.every(s => (shortfall.seals[s.key] || 0) <= (seals[s.key] || 0));
  return {key: list.key, name: list.name || 'Deck', source: list.source || '', detail: list.detail || '', format: list.format, commander: list.commander || '', colors: 'WUBRG'.split('').filter(k => colors.has(k)), groups: ordered, want, have, share: want ? have / want : 1, shortfall, complete: shortfall.complete, enough, cover, list};
}

// Ranked rows: ready decks first, then the most-owned lists; meta order breaks ties.
export function rankFinderRows(lists, ctx = {}) {
  return lists.map((l, i) => ({...finderRow(l, ctx), order: i})).sort((a, b) => (b.list.trunk === true) - (a.list.trunk === true) || b.complete - a.complete || b.share - a.share || a.order - b.order);
}

// A Deck Forge build from the Trunk alone: only cards the player owns (and basics).
// build = builder.buildDeck; owned = state.cards; factOf(oracle) → slim card.
export function trunkDeck({format, ownedCards = [], factOf = () => null, build, hooksOf = null} = {}) {
  if (typeof build !== 'function') return null;
  const catalog = {}, stock = new Map();
  for (const c of ownedCards) { const card = factOf(c.o); if (!card?.name) continue; catalog[card.name.toLowerCase()] = card; stock.set(card.name, (stock.get(card.name) || 0) + (c.c | 0)); }
  for (const [name, k] of Object.entries(BASIC_COLOR)) catalog[name.toLowerCase()] = {name, type_line: 'Basic Land — ' + name, oracle_text: `({T}: Add {${k}}.)`, cmc: 0, mana_cost: '', color_identity: k === 'C' ? [] : [k], produced_mana: [k], legalities: Object.fromEntries(['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'commander'].map(f => [f, 'legal'])), rarity: 'common'};
  const legal = c => { const k = format.toLowerCase(); return ['legal', 'restricted'].includes(c?.legalities?.[k]); };
  const spells = Object.values(catalog).filter(c => legal(c) && !/\bLand\b/.test(typeOf(c)));
  // Build-arounds: legendary creatures for Commander, otherwise the cards owned in the most copies.
  const leads = format === 'Commander'
    ? spells.filter(c => /Legendary/.test(typeOf(c)) && /Creature/.test(typeOf(c))).sort((a, b) => (hooksOf ? hooksOf(b, spells) - hooksOf(a, spells) : 0) || a.name.localeCompare(b.name)).slice(0, 4)
    : spells.sort((a, b) => (stock.get(b.name) || 0) - (stock.get(a.name) || 0) || (a.edhrec_rank || 1e9) - (b.edhrec_rank || 1e9)).slice(0, 4);
  let best = null;
  for (const seed of leads) {
    let d = null;
    try { d = build({format, seeds: [seed], commander: format === 'Commander' ? seed : null, catalog, available: name => isBasicLand(name) ? 99 : stock.get(name) || 0, price: () => null, budget: 0, power: 'casual'}); } catch { continue; }
    if (!best || d.open < best.open) best = d;
    if (!d.open) break;
  }
  if (!best) return null;
  return {key: 'trunk:' + format, trunk: true, name: 'Forged from your Trunk', source: 'Deck Forge', detail: best.open ? `${best.open} slots still open` : 'Every card is yours', format, commander: best.commander || '', cards: best.cards.map(r => ({name: r.name, qty: r.qty})), open: best.open};
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

export function finderRowMarkup(row) {
  const cost = SEALS.filter(s => row.shortfall.seals[s.key]).map(s => sealChip(s.key, row.shortfall.seals[s.key], `${row.shortfall.seals[s.key]} ${s.rarity} seals to finish`)).join('');
  const state = row.complete ? '<span class="pf-ready" role="img" aria-label="Ready to play" title="Ready to play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>' : `<span class="pf-cost${row.enough ? ' pf-cost--covered' : ''}"${row.enough ? ' title="Your seals cover it"' : ''}>${cost}</span>`;
  return `<article class="pf-row" style="--pf-art:url('${esc(row.cover)}')">
    <header class="pf-head"><div class="pf-title">${pips(row.colors)}<h3>${esc(row.name)}</h3><small>${esc([row.source, row.detail].filter(Boolean).join(' · '))}</small></div>
      <div class="pf-own"><b>${row.have}/${row.want}</b><span>owned</span></div>
      <div class="pf-state">${state}</div>
      <button class="btn pf-use" data-act="playFinderUse" data-finder-key="${esc(row.key)}">${row.complete ? 'Use deck' : 'Get deck'}</button></header>
    <div class="pf-groups">${row.groups.map(g => `<section class="pf-group"><h4>${esc(g.label)} <span>${g.count}</span></h4><div class="pf-cards">${g.cards.map(cardChip).join('')}</div></section>`).join('')}</div>
  </article>`;
}

// The whole screen. head = play-econ-ui head(); rows already ranked.
export function finderMarkup({headHtml = '', format = 'Standard', rows = [], busy = false, error = '', limit = 8} = {}) {
  const tabs = FINDER_FORMATS.map(f => `<button class="pf-tab${f === format ? ' on' : ''}" data-act="playFinderFormat" data-finder-format="${f}" aria-pressed="${f === format}">${f}</button>`).join('');
  const list = rows.slice(0, limit).map(finderRowMarkup).join('');
  return `<section class="play-menu pe-screen pf-screen" aria-labelledby="playTitle">${headHtml}
    <div class="pf-bar"><div class="pf-tabs" role="group" aria-label="Format">${tabs}</div><button class="btn ghost pf-empty" data-act="playEconEditDeck" data-econ-deck="">Start empty</button></div>
    ${error ? `<p class="pf-note" role="status">${esc(error)}</p>` : ''}
    <div class="pf-list" aria-busy="${busy}">${list || (busy ? '<div class="pf-skeleton" aria-hidden="true"></div><div class="pf-skeleton" aria-hidden="true"></div>' : '<p class="pf-note">No decks for this format yet.</p>')}</div>
    ${rows.length > limit ? `<button class="btn ghost pf-more" data-act="playFinderMore">More decks</button>` : ''}
  </section>`;
}
