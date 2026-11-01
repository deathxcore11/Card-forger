// Play progression screens: the top bar (coins, seals, packs, level), the "your stuff" row on the
// Play homepage, the Merchant, Packs, Collection and Decks. Legacy of the Duelist style menus
// on real card art, in the app's glass and gold. Markup only; app.js wires the actions.
// The wall: no prices anywhere in Play. Cards show art, name, rarity and copies owned (of 4).
import {SEALS, masteryLevel, deckShortfall, deckRules, copiesLeft, isBasicLand, PLAY_FORMATS, ownedByName} from './play-econ-rules.js';
import {cardGroup} from './play-econ-cards.js';
import {setRowContent} from './set-list-ui.js';
import {segmented, setIconUrl} from './ui.js';
import {deckShell} from './deck-viewer.js';
import {purse} from './play-econ-client.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('en-US');
const ART = 'https://cards.scryfall.io/art_crop/front/';
// Tile art: real card illustrations, picked for the place each tile stands for.
const TILE_ART = {
  shop: ART + 'c/8/c88acaa8-ad4d-4321-a6f6-9361916e5b5e.jpg',        // Bazaar of Baghdad
  packs: ART + '4/2/42c45880-15c7-4259-8066-c04d031d8216.jpg',       // Treasure Cruise
  collection: ART + 'e/5/e5145f31-a4ac-44ef-8f85-e4d95f2c9ff5.jpg',  // Library of Alexandria
  decks: ART + 'f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg'};      // Tolarian Academy
export const cardImageByName = (name, version = 'normal') => 'https://api.scryfall.com/cards/named?format=image&version=' + version + '&exact=' + encodeURIComponent(name);

export const coinIcon = (cls = '') => `<svg class="pe-coin ${cls}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="url(#peGold)" stroke="#6b4612" stroke-width="1.6"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#6b4612" stroke-width="1.5"/><path d="M16 8.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#5c3c0c"/></svg>`;
const SEAL_INK = {c: ['#9aa1a9', '#5d636b'], u: ['#d9e3ea', '#7e8d99'], r: ['#f1cf7c', '#a77a23'], m: ['#f28a4b', '#a8381b']};
export const sealIcon = (key, cls = '') => { const [a, b] = SEAL_INK[key] || SEAL_INK.c; return `<svg class="pe-seal ${cls}" data-seal="${key}" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5c2 0 2.6 1.9 4.4 2.5s3.6-.6 5 .8.1 3.2.8 5 2.5 2.4 2.5 4.4-1.9 2.6-2.5 4.4.6 3.6-.8 5-3.2.1-5 .8-2.4 2.5-4.4 2.5-2.6-1.9-4.4-2.5-3.6.6-5-.8-.1-3.2-.8-5S2.5 18 2.5 16s1.9-2.6 2.5-4.4-.6-3.6.8-5 3.2-.1 5-.8S14 2.5 16 2.5z" fill="${a}"/><circle cx="16" cy="16" r="8.4" fill="none" stroke="${b}" stroke-width="1.6"/><path d="M16 10.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="${b}"/></svg>`; };
const packIcon = `<svg class="pe-pack-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 4h16l-1 3 1 3v15l-1 3 1 3H8l1-3-1-3V10l1-3z" fill="url(#peGold)" stroke="#7a5418" stroke-width="1"/><path d="M12 14h8M12 18h8" stroke="#7a5418" stroke-width="1.4" opacity=".6"/></svg>`;
// One shared gradient, so every coin and wrapper is the same stamped gold.
export const econDefs = `<svg class="pe-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><radialGradient id="peGold" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff3c9"/><stop offset=".45" stop-color="#f0c66d"/><stop offset="1" stop-color="#a8761f"/></radialGradient></defs></svg>`;

// The top bar: always visible on the Play homepage and every Play screen. Each part is a way in.
export function purseMarkup(snapshot) {
  const p = purse(snapshot?.state);
  if (!p) return '';
  const lvl = masteryLevel(snapshot.state.config || {}, p.xp), pct = Math.round(lvl.into / lvl.need * 100);
  return `<nav class="pe-purse" aria-label="Your Play rewards">${econDefs}
    <button class="pe-purse-item pe-purse-coins" data-act="playEconView" data-econ-view="shop" aria-label="${n(p.coins)} coins. Open the Merchant">${coinIcon()}<b>${n(p.coins)}</b></button>
    <button class="pe-purse-item pe-purse-seals" data-act="playEconView" data-econ-view="shop" data-econ-focus="press" aria-label="Seals: ${SEALS.map(s => p.seals[s.key] + ' ' + s.rarity).join(', ')}. Open the seal press">${SEALS.map(s => `<span class="pe-seal-count">${sealIcon(s.key)}<b>${n(p.seals[s.key])}</b></span>`).join('')}</button>
    <button class="pe-purse-item pe-purse-packs${p.packs ? ' pe-glow' : ''}" data-act="playEconView" data-econ-view="packs" aria-label="${p.packs} unopened ${p.packs === 1 ? 'pack' : 'packs'}. Open packs">${packIcon}<b>${n(p.packs)}</b></button>
    <span class="pe-purse-item pe-level" role="img" aria-label="Mastery level ${lvl.level}, ${lvl.into} of ${lvl.need} XP"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="pe-level-track"/><circle cx="18" cy="18" r="15" class="pe-level-fill" pathLength="100" stroke-dasharray="${pct} 100"/></svg><b>${lvl.level}</b></span>
  </nav>`;
}

// Stands in for the top bar and tiles while there is no wallet to show: loading, or why it failed
// (with the server's code, so a screenshot says what broke) and a way to try again. Signed out: nothing.
export function econNoticeMarkup(snapshot, {signedIn = false} = {}) {
  if (!signedIn || purse(snapshot?.state)) return '';
  if (snapshot?.loading && !snapshot.error) return `<p class="pe-notice" role="status">Opening your Play purse…</p>`;
  if (!snapshot?.error) return '';
  const msg = snapshot.errorCode === 'sign_in' ? 'Your sign-in has expired. Sign out and back in to open your Play collection.' : snapshot.error;
  return `<div class="pe-notice pe-notice--error" role="alert"><p>${esc(msg)}</p><small>${esc(snapshot.errorCode || '')}</small><button class="btn small" data-act="playEconRetry" ${snapshot.loading ? 'disabled' : ''}>Try again</button></div>`;
}

// The second row on the Play homepage: Merchant, Packs, Collection, Decks.
export function stuffRowMarkup(snapshot) {
  const s = snapshot?.state, p = purse(s);
  if (!p) return '';
  const owned = (s.cards || []).reduce((t, c) => t + (c.c | 0), 0), decks = (s.decks || []).length;
  const tile = (view, name, line, badge = '') => `<button class="pe-tile" data-act="playEconView" data-econ-view="${view}"><span class="pe-tile-art" style="background-image:url(${TILE_ART[view]})" aria-hidden="true"></span><span class="pe-tile-name">${name}</span><span class="pe-tile-line">${line}</span>${badge}</button>`;
  return `<div class="pe-row" role="group" aria-label="Your Play collection">
    ${tile('shop', 'Merchant', 'Packs, seals and more')}
    ${tile('packs', 'Packs', p.packs ? `${n(p.packs)} waiting` : 'All opened', p.packs ? `<span class="pe-badge" aria-hidden="true">${n(p.packs)}</span>` : '')}
    ${tile('collection', 'Collection', `${n(owned)} cards`)}
    ${tile('decks', 'Decks', decks ? `${n(decks)} ${decks === 1 ? 'deck' : 'decks'}` : 'Build your first')}
  </div>`;
}

const head = (title, snapshot, eyebrow = 'Play') => `<header class="pl-head pe-head"><button class="pl-back" data-act="playHome" aria-label="Back to Play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div class="pl-head-title"><p class="eyebrow">${eyebrow}</p><h1 id="playTitle" tabindex="-1">${title}</h1></div>${purseMarkup(snapshot)}</header>`;
const statusLine = snap => `<p class="pe-status" role="status" aria-live="polite">${esc(snap?.error || '')}</p>`;
// The real booster wrapper in front, the set's own key art behind it.
// A booster wrapper drawn for every set alike: crimped foil, the set's most played card's art,
// its symbol and name on the band. No product photos, so no white boxes or doubled titles.
export function boosterMarkup({code = '', name = '', facts = null, big = false} = {}) {
  const f = facts?.set?.(code) || {}, label = name || f.name || code.toUpperCase(), icon = f.icon || setIconUrl(code);
  return `<span class="pe-booster${big ? ' pe-booster--big' : ''}" aria-hidden="true"${f.art ? ` style="--art:url('${esc(f.art)}')"` : ''}><span class="pe-booster-art"></span><span class="pe-booster-band"><span class="pe-booster-icon" style="--icon:url('${esc(icon)}')"></span><b>${esc(label)}</b><small>Play booster</small></span><span class="pe-booster-sheen"></span></span>`;
}

export function shopMarkup(snapshot, {query = '', press = null, facts = null} = {}) {
  const s = snapshot.state, price = s.config?.packPrice || 500, coins = s.wallet?.coins | 0, shop = s.shop || [], reward = s.rewardSet;
  const q = query.trim().toLowerCase(), list = (q ? shop.filter(x => x.name.toLowerCase().includes(q) || x.code === q) : shop).slice(0, q ? 60 : 24);
  const buy = (set, big = false) => `<article class="pe-pack pe-pack--shop${big ? ' pe-pack--feature' : ''}" aria-label="${esc(set.name)}, ${esc(String(set.released || '').slice(0, 4))}">${boosterMarkup({code: set.code, name: set.name, facts, big})}<span class="pe-pack-year">${esc(String(set.released || '').slice(0, 4))}</span><button class="pe-buy" data-act="playEconBuy" data-econ-set="${esc(set.code)}" ${coins < price || snapshot.busy ? 'disabled' : ''} aria-label="Buy a ${esc(set.name)} pack for ${n(price)} coins">${coinIcon('pe-coin--sm')}<b>${n(price)}</b></button></article>`;
  const pressCard = press?.card ? (() => { const c = press.card, key = {common: 'c', uncommon: 'u', rare: 'r', mythic: 'm'}[c.rarity] || 'r', have = (s.cards || []).find(x => x.o === c.oracle_id)?.c || 0, seals = s.wallet?.['seal_' + key] | 0;
    return `<div class="pe-press-result"><img src="${esc(c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || cardImageByName(c.name))}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer"><div class="pe-press-copy"><strong>${esc(c.name)}</strong><span>${have} of 4 owned</span><button class="pe-stamp" data-act="playEconCraft" data-econ-card="${esc(c.id)}" ${have >= 4 || seals < 1 || snapshot.busy ? 'disabled' : ''}>${sealIcon(key)}<b>${have >= 4 ? 'All 4 owned' : 'Stamp it'}</b></button></div></div>`; })() : press?.error ? `<p class="pe-press-empty">${esc(press.error)}</p>` : '';
  return `<section class="play-menu pe-screen pe-shop" aria-labelledby="playTitle">${head('Merchant', snapshot)}
    <div class="pe-table">
      <section class="pe-shelf" aria-labelledby="peShelfTitle"><h2 id="peShelfTitle">Packs</h2>
        ${reward ? `<div class="pe-feature">${buy(reward, true)}</div>` : ''}
        <label class="pe-search"><span>Any set, any year</span><input type="search" data-input="playEconSetSearch" value="${esc(query)}" maxlength="60" placeholder="Search sets"></label>
        <div class="pe-pack-grid">${list.filter(x => x.code !== reward?.code).map(x => buy(x)).join('') || '<p class="pe-press-empty">No set by that name.</p>'}</div>
      </section>
      <section class="pe-press" aria-labelledby="pePressTitle"><h2 id="pePressTitle">Seal press</h2>
        <div class="pe-press-seals">${SEALS.map(x => `<span class="pe-press-seal">${sealIcon(x.key)}<b>${n(s.wallet?.['seal_' + x.key])}</b><small>${x.rarity}</small></span>`).join('')}</div>
        <form class="pe-press-find" data-submit="playEconFind"><input name="card" type="search" maxlength="160" autocomplete="off" placeholder="Card name" aria-label="Card to stamp" value="${esc(press?.query || '')}"><button class="btn" ${press?.busy ? 'disabled' : ''}>${press?.busy ? 'Finding…' : 'Find'}</button></form>
        ${pressCard}
      </section>
    </div>${statusLine(snapshot)}</section>`;
}

export function packsMarkup(snapshot, {facts = null} = {}) {
  const s = snapshot.state, packs = s.packs || [], names = new Map([...(s.shop || []).map(x => [x.code, x.name]), ...(s.rewardSet ? [[s.rewardSet.code, s.rewardSet.name]] : [])]);
  const groups = new Map();
  for (const p of packs) { if (!groups.has(p.set)) groups.set(p.set, []); groups.get(p.set).push(p); }
  return `<section class="play-menu pe-screen pe-packs" aria-labelledby="playTitle">${head('Packs', snapshot)}
    ${groups.size ? `<div class="pe-pack-grid pe-pack-grid--open">${[...groups].map(([code, list]) => `<button class="pe-pack pe-pack--open" data-act="playEconOpen" data-econ-pack="${esc(list[0].id)}" ${snapshot.busy ? 'disabled' : ''} aria-label="Open a ${esc(names.get(code) || code.toUpperCase())} pack, ${list.length} waiting">${boosterMarkup({code, name: names.get(code), facts})}<span class="pe-badge">${n(list.length)}</span></button>`).join('')}</div>`
      : `<div class="pe-empty"><h2>Every pack is open</h2><p>Packs come from Story battles, Planeswalk bosses, weekly quests and the Merchant.</p><button class="btn" data-act="playEconView" data-econ-view="shop">Visit the Merchant</button></div>`}
    ${statusLine(snapshot)}</section>`;
}

const COLORS = [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green'], ['C', 'Colorless']];
const TYPES = ['Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Lands'];
const pips = c => `<span class="pe-pips" aria-label="${c.c} of 4">${[1, 2, 3, 4].map(i => `<i class="${i <= c.c ? 'on' : ''}"></i>`).join('')}</span>`;
// The printing you pulled, else the card's own art, else Scryfall's image by name.
const cardImage = (c, facts) => c.p?.image || facts?.card?.(c.o)?.i || cardImageByName(c.n);

// Search, rarity, colour, type and set filters, shared by Collection and the deck builder.
export function filterPlayCards(cards = [], facts = null, {query = '', rarity = '', color = '', type = '', set = ''} = {}) {
  const q = query.trim().toLowerCase();
  return cards.filter(c => {
    if (q && !c.n.toLowerCase().includes(q)) return false;
    if (rarity && c.r !== rarity) return false;
    if (set && !(c.s || []).includes(set)) return false;
    const f = facts?.card?.(c.o);
    if (color && (!f || (color === 'C' ? f.k !== '' : !f.k.includes(color)))) return false;
    if (type && (!f || cardGroup(f) !== type)) return false;
    return true;
  });
}

function filterBar(ui = {}, {sets = []} = {}) {
  const setName = code => sets.find(x => x.code === code)?.name || code.toUpperCase();
  return `<div class="pe-tools pe-filters"><label class="pe-search"><span>Find a card</span><input type="search" data-input="playEconCardSearch" value="${esc(ui.cardQuery || '')}" maxlength="80" placeholder="Card name"></label>
    <div class="pe-color-tabs" role="group" aria-label="Colour">${COLORS.map(([k, l]) => `<button class="pe-mana pe-mana--${k}" data-act="playEconColor" data-econ-color="${k}" aria-pressed="${ui.color === k}" aria-label="${l}" title="${l}"><i aria-hidden="true">${k}</i></button>`).join('')}</div>
    <select class="pe-type" data-change="playEconType" aria-label="Card type"><option value="">All types</option>${TYPES.map(t => `<option${ui.type === t ? ' selected' : ''}>${t}</option>`).join('')}</select>
    <div class="pe-rarity-tabs" role="group" aria-label="Rarity">${[['', 'All'], ['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['mythic', 'Mythic']].map(([k, l]) => `<button data-act="playEconRarity" data-econ-rarity="${k}" aria-pressed="${(ui.rarity || '') === k}">${l}</button>`).join('')}</div>
    ${ui.set ? `<button class="chip pe-set-chip" data-act="playEconSet" data-econ-set="" aria-label="Show every set">${esc(setName(ui.set))} <span aria-hidden="true">×</span></button>` : ''}</div>`;
}

// Every set you have pulled cards from (plus the current reward set), with the app's set tiles
// and progress bars: different cards owned out of the cards its packs hold.
export function playSetRows(state, facts) {
  const owned = new Map();
  for (const c of state?.cards || []) for (const code of c.s || []) owned.set(code, (owned.get(code) || 0) + 1);
  if (state?.rewardSet?.code && !owned.has(state.rewardSet.code)) owned.set(state.rewardSet.code, 0);
  return [...owned].map(([code, have]) => { const f = facts?.set?.(code) || {}; return {code, name: f.name || (state?.rewardSet?.code === code ? state.rewardSet.name : '') || code.toUpperCase(), icon: f.icon || setIconUrl(code), released: f.released || '', total: f.total || null, owned: have}; })
    .sort((a, b) => (b.released || '').localeCompare(a.released || '') || a.name.localeCompare(b.name));
}

export function collectionMarkup(snapshot, ui = {}) {
  const tab = ui.tab === 'sets' ? 'sets' : 'cards', facts = ui.facts, state = snapshot.state;
  const cards = (state.cards || []).slice().sort((a, b) => a.n.localeCompare(b.n)), sets = playSetRows(state, facts);
  const body = tab === 'sets'
    ? (sets.length ? `<div class="set-list set-year-grid set-browser-flat pe-set-grid">${sets.map(x => `<button class="set-row set-browser-tile" data-act="playEconSet" data-econ-set="${esc(x.code)}" aria-label="${esc(x.name)}: ${x.owned} of ${x.total ?? 'unknown'} cards. Show them">${setRowContent({name: x.name, ambient: true, magicSet: {code: x.code, name: x.name}, code: x.code.toUpperCase(), image: x.icon, symbol: `<span class="set-icon" style="--icon:url('${esc(x.icon)}')" aria-hidden="true"></span>`, detail: x.released ? x.released.slice(0, 4) : '', count: x.total, progress: {key: 'play:' + x.code, owned: x.owned, total: x.total, loaded: x.total || 0, known: x.total || 0, complete: true}})}</button>`).join('')}</div>`
      : `<div class="pe-empty"><h2>No sets yet</h2><p>Open a pack and its set starts filling in here.</p></div>`)
    : (() => { const shown = filterPlayCards(cards, facts, {query: ui.cardQuery, rarity: ui.rarity, color: ui.color, type: ui.type, set: ui.set});
      return `${filterBar(ui, {sets})}<p class="pe-count" role="status">${n(shown.length)} of ${n(cards.length)} cards</p>
      ${shown.length ? `<div class="pe-grid">${shown.slice(0, 300).map(c => `<figure class="pe-card" data-rarity="${esc(c.r)}"><img src="${esc(cardImage(c, facts))}" alt="${esc(c.n)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><figcaption>${pips(c)}</figcaption></figure>`).join('')}</div>`
        : `<div class="pe-empty"><h2>${cards.length ? 'No cards match' : 'Your binder is empty'}</h2><p>${cards.length ? 'Try another name, colour or type.' : 'Open a pack to start your Play collection.'}</p></div>`}`; })();
  return `<section class="play-menu pe-screen pe-collection" aria-labelledby="playTitle">${head('Collection', snapshot)}
    ${segmented('playEconCollTab', tab, [['cards', 'Cards', 'cardStack'], ['sets', 'Sets', 'binder']])}
    ${body}
    ${statusLine(snapshot)}</section>`;
}

// The deck builder: the app's deck hero on top, your deck on one side and your Play cards on the
// other. Tap a card to add it; only cards you own (and free basic lands) can go in.
export function deckBuilderMarkup(snapshot, ui = {}) {
  const edit = ui.edit || {cards: []}, facts = ui.facts, state = snapshot.state, rules = deckRules(edit.format);
  const ownedCards = state.cards || [], owned = ownedByName(ownedCards), byName = new Map(ownedCards.flatMap(c => [[c.n.split(' // ')[0], c], [c.n, c]]));
  const deck = edit.cards || [], count = deck.reduce((t, c) => t + c.qty, 0);
  const factOf = name => facts?.card?.(byName.get(name)?.o) || null;
  const groups = new Map();
  for (const c of deck) { const g = isBasicLand(c.name) ? 'Lands' : cardGroup(factOf(c.name)); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); }
  const order = ['Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Battles', 'Cards', 'Lands'];
  const lands = groups.get('Lands')?.reduce((t, c) => t + c.qty, 0) || 0, creatures = groups.get('Creatures')?.reduce((t, c) => t + c.qty, 0) || 0;
  const spells = deck.filter(c => !isBasicLand(c.name) && factOf(c.name) && cardGroup(factOf(c.name)) !== 'Lands');
  const mvCount = spells.reduce((t, c) => t + c.qty, 0), avg = mvCount ? (spells.reduce((t, c) => t + c.qty * factOf(c.name).m, 0) / mvCount).toFixed(1) : '—';
  const lead = deck.find(c => !isBasicLand(c.name)), art = lead ? (factOf(lead.name)?.a || cardImageByName(lead.name, 'art_crop')) : ART + 'f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg';
  const ok = rules.exact ? count === rules.size : count >= rules.size;
  const row = c => { const left = copiesLeft(c.name, deck, owned, edit.format);
    return `<li class="pe-build-row"><span class="pe-build-thumb" style="background-image:url(${esc(factOf(c.name)?.a || cardImageByName(c.name, 'art_crop'))})" aria-hidden="true"></span><span class="pe-build-name">${esc(c.name)}</span>${factOf(c.name)?.mc ? `<span class="pe-build-cost">${esc(factOf(c.name).mc.replace(/[{}]/g, ''))}</span>` : ''}<span class="pe-step"><button data-act="playEconStep" data-econ-card="${esc(c.name)}" data-econ-step="-1" aria-label="Remove one ${esc(c.name)}">−</button><b>${c.qty}</b><button data-act="playEconStep" data-econ-card="${esc(c.name)}" data-econ-step="1" ${left < 1 ? 'disabled' : ''} aria-label="Add one ${esc(c.name)}">+</button></span></li>`; };
  const pool = filterPlayCards(ownedCards.slice().sort((a, b) => a.n.localeCompare(b.n)), facts, {query: ui.cardQuery, rarity: ui.rarity, color: ui.color, type: ui.type, set: ui.set});
  const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
  return `<section class="play-menu pe-screen pe-builder-screen" aria-labelledby="playDeckTitle">
    ${deckShell({game: 'mtg', source: 'play', art, title: edit.name || 'New Play deck',
      back: `<button class="icon light" data-act="playEconView" data-econ-view="decks" aria-label="Back to Play decks">←</button>`,
      badge: 'Play deck', format: `<span class="chip dark">${esc(edit.format || 'Standard')}</span>`,
      stats: [{value: `${count}/${rules.size}`, label: 'cards', tone: ok ? '' : 'warn'}, {value: creatures, label: 'creatures'}, {value: lands, label: 'lands'}, {value: avg, label: 'average mana value'}],
      actions: [{label: edit.busy ? 'Saving…' : 'Save deck', primary: true, attrs: 'data-act="playEconSaveEdit"', disabled: !!edit.busy || !count}]}).replace('<h1>', '<h1 id="playDeckTitle" tabindex="-1">')}
    <div class="pe-builder">
      <section class="pe-build-deck" aria-label="Your deck">
        <div class="pe-build-meta"><input name="name" data-input="playEconDeckName" maxlength="80" value="${esc(edit.name || '')}" placeholder="Deck name" aria-label="Deck name"><select data-change="playEconDeckFormat" aria-label="Format">${PLAY_FORMATS.map(f => `<option${(edit.format || 'Standard') === f ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
        ${deck.length ? order.filter(g => groups.has(g)).map(g => `<h3 class="pe-build-group">${g} <span>${groups.get(g).reduce((t, c) => t + c.qty, 0)}</span></h3><ul class="pe-build-list">${groups.get(g).sort((a, b) => (factOf(a.name)?.m ?? 99) - (factOf(b.name)?.m ?? 99) || a.name.localeCompare(b.name)).map(row).join('')}</ul>`).join('')
          : '<p class="pe-build-empty">Tap cards from your collection to add them.</p>'}
        <div class="pe-basics" role="group" aria-label="Basic lands, free and unlimited">${basics.map(b => `<button class="pe-basic" data-act="playEconStep" data-econ-card="${b}" data-econ-step="1" aria-label="Add a ${b}"><span style="background-image:url(${esc(cardImageByName(b, 'art_crop'))})" aria-hidden="true"></span><b>${b}</b></button>`).join('')}</div>
      </section>
      <section class="pe-build-pool" aria-label="Your Play cards">
        ${filterBar(ui, {sets: playSetRows(state, facts)})}
        <p class="pe-count" role="status">${n(pool.length)} of ${n(ownedCards.length)} cards</p>
        ${pool.length ? `<div class="pe-grid pe-grid--pool">${pool.slice(0, 300).map(c => { const left = copiesLeft(c.n, deck, owned, edit.format);
          return `<button class="pe-card pe-card--pick" data-rarity="${esc(c.r)}" data-act="playEconStep" data-econ-card="${esc(c.n)}" data-econ-step="1" ${left < 1 ? 'disabled' : ''} aria-label="Add ${esc(c.n)}, ${left} left"><img src="${esc(cardImage(c, facts))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="pe-left">${left}</span></button>`; }).join('')}</div>`
          : `<div class="pe-empty"><h2>${ownedCards.length ? 'No cards match' : 'No cards yet'}</h2><p>${ownedCards.length ? 'Try another name, colour or type.' : 'Open packs to fill your collection.'}</p></div>`}
      </section>
    </div>
    ${statusLine(snapshot)}</section>`;
}

// decks: Play decks. check: an imported list being checked {name, format, rows, rarity:Map, error}.
export function decksMarkup(snapshot, {check = null} = {}) {
  const s = snapshot.state, decks = s.decks || [], owned = ownedByName(s.cards || []);
  const short = check?.rows ? deckShortfall(check.rows, owned, check.rarity || new Map()) : null;
  const sealsLine = sh => SEALS.filter(x => sh.seals[x.key]).map(x => `<span class="pe-cost">${sealIcon(x.key)}<b>${sh.seals[x.key]}</b></span>`).join('');
  const deckCard = d => { const sh = deckShortfall(d.cards || [], owned, new Map((s.cards || []).map(c => [c.n, c.r]))), lead = (d.cards || []).find(c => !/^(?:plains|island|swamp|mountain|forest)$/i.test(c.name));
    return `<article class="pe-deck"><span class="pe-deck-art" style="background-image:url(${esc(lead ? cardImageByName(lead.name, 'art_crop') : '')})" aria-hidden="true"></span><button class="pe-deck-open" data-act="playEconEditDeck" data-econ-deck="${esc(d.id)}" aria-label="Edit ${esc(d.name || 'Untitled deck')}"></button><span class="pe-deck-name">${esc(d.name || 'Untitled deck')}</span><span class="pe-deck-line">${esc(d.format || 'Any format')} · ${sh.complete ? 'Ready to play' : sh.missing.reduce((t, m) => t + m.need, 0) + ' cards to stamp'}</span>${sh.complete ? '' : `<span class="pe-costs">${sealsLine(sh)}</span>`}<button class="pe-deck-delete" data-act="playEconDeleteDeck" data-econ-deck="${esc(d.id)}" aria-label="Delete ${esc(d.name || 'deck')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></article>`; };
  return `<section class="play-menu pe-screen pe-decks" aria-labelledby="playTitle">${head('Decks', snapshot)}
    <div class="pe-deck-grid"><button class="pe-deck pe-deck--new" data-act="playEconEditDeck" data-econ-deck=""><span class="pe-deck-art" style="background-image:url(${TILE_ART.decks})" aria-hidden="true"></span><span class="pe-deck-name">Build a deck</span><span class="pe-deck-line">From the cards you own</span></button>${decks.map(deckCard).join('')}</div>
    <section class="pe-import" aria-labelledby="peImportTitle"><h2 id="peImportTitle">Bring in a deck</h2>
      <form class="pe-import-form" data-submit="playEconCheckDeck"><input name="name" maxlength="80" placeholder="Deck name" aria-label="Deck name" value="${esc(check?.name || '')}"><select name="format" aria-label="Format">${['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper', 'Commander'].map(f => `<option${check?.format === f ? ' selected' : ''}>${f}</option>`).join('')}</select><textarea name="list" rows="5" maxlength="20000" aria-label="Deck list" placeholder="4 Card name">${esc(check?.text || '')}</textarea><button class="btn" ${check?.busy ? 'disabled' : ''}>${check?.busy ? 'Checking…' : 'Check against my collection'}</button></form>
      ${check?.error ? `<p class="note warn">${esc(check.error)}</p>` : ''}
      ${short ? `<div class="pe-shortfall">${short.complete ? '<p class="pe-ready">Every card is in your collection.</p>' : `<p>To finish it, stamp ${short.missing.reduce((t, m) => t + m.need, 0)} cards:</p><span class="pe-costs">${sealsLine(short)}</span><ul class="pe-missing">${short.missing.slice(0, 60).map(m => `<li>${sealIcon(m.seal)}<span>${m.need} × ${esc(m.name)}</span></li>`).join('')}</ul>`}<button class="btn" data-act="playEconSaveDeck" ${snapshot.busy ? 'disabled' : ''}>Save as a Play deck</button></div>` : ''}
    </section>
    ${statusLine(snapshot)}</section>`;
}

export function econScreenMarkup(view, snapshot, ui = {}) {
  if (!purse(snapshot?.state)) return `<section class="play-menu pe-screen" aria-labelledby="playTitle"><header class="pl-head pe-head"><button class="pl-back" data-act="playHome" aria-label="Back to Play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div class="pl-head-title"><p class="eyebrow">Play</p><h1 id="playTitle" tabindex="-1">Your Play collection</h1></div></header><div class="pe-empty"><h2>${snapshot?.loading ? 'Opening your binder…' : 'Sign in to start collecting'}</h2>${snapshot?.loading ? '' : '<p>Your Play collection, coins and seals live with your account.</p><button class="btn" data-act="menu">Sign in</button>'}</div>${statusLine(snapshot)}</section>`;
  if (view === 'shop') return shopMarkup(snapshot, ui);
  if (view === 'packs') return packsMarkup(snapshot, ui);
  if (view === 'collection') return collectionMarkup(snapshot, ui);
  if (view === 'decks') return decksMarkup(snapshot, ui);
  if (view === 'deck') return deckBuilderMarkup(snapshot, ui);
  return '';
}
export const ECON_VIEWS = new Set(['shop', 'packs', 'collection', 'decks', 'deck']);
