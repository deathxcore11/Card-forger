// Play progression screens: the top bar (coins, seals, packs, level), the "your stuff" row on the
// Play homepage, the Merchant, Packs, Collection and Decks. Legacy of the Duelist style menus
// on real card art, in the app's glass and gold. Markup only; app.js wires the actions.
// The wall: no prices anywhere in Play. Cards show art, name, rarity and copies owned (of 4).
import {SEALS, FORGE_STEPS, forgeRatio, masteryLevel, deckShortfall, deckRules, copiesLeft, isBasicLand, PLAY_FORMATS, ownedByName, preconPrice, scryfallImage} from './play-econ-rules.js';
import {cardGroup, cardFact} from './play-econ-cards.js';
import {setRowContent, setYearSections} from './set-list-ui.js';
import {segmented, setIconUrl, img, manaCost, symbolUrl, bar} from './ui.js';
import {rowEmblem} from './importance.js';
import {finishAttrs} from './finish-preview.js';
import {tileChrome} from './tiles.js';
import {deckShell} from './deck-viewer.js';
import {purse} from './play-econ-client.js';
import {deedsScreenMarkup} from './play-deeds-ui.js';
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
export const packIcon = `<svg class="pe-pack-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 4h16l-1 3 1 3v15l-1 3 1 3H8l1-3-1-3V10l1-3z" fill="url(#peGold)" stroke="#7a5418" stroke-width="1"/><path d="M12 14h8M12 18h8" stroke="#7a5418" stroke-width="1.4" opacity=".6"/></svg>`;
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

export const head = (title, snapshot, eyebrow = 'Play') => `<header class="pl-head pe-head"><button class="pl-back" data-act="playHome" aria-label="Back to Play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div class="pl-head-title"><p class="eyebrow">${eyebrow}</p><h1 id="playTitle" tabindex="-1">${title}</h1></div>${purseMarkup(snapshot)}</header>`;
const statusLine = snap => `<p class="pe-status" role="status" aria-live="polite">${esc(snap?.error || '')}</p>`;
// The real booster wrapper in front, the set's own key art behind it.
// A booster wrapper drawn for every set alike: crimped foil, the set's most played card's art,
// its symbol and name on the band. No product photos, so no white boxes or doubled titles.
export function boosterMarkup({code = '', name = '', facts = null, big = false, mini = false} = {}) {
  const f = facts?.set?.(code) || {}, label = name || f.name || code.toUpperCase(), icon = f.icon || setIconUrl(code);
  return `<span class="pe-booster${big ? ' pe-booster--big' : ''}${mini ? ' pe-booster--mini' : ''}" aria-hidden="true"${f.art ? ` style="--art:url('${esc(f.art)}')"` : ''}><span class="pe-booster-art"></span><span class="pe-booster-band"><span class="pe-booster-icon" style="--icon:url('${esc(icon)}')"></span><b>${esc(label)}</b><small>Play booster</small></span><span class="pe-booster-sheen"></span></span>`;
}

// The Forge (play-progression.md): seals climb one rarity at a time, common to mythic. Each step shows
// how close the next seal is, and glows when it can be struck.
export function forgeMarkup(snapshot, {compact = false} = {}) {
  const s = snapshot?.state, w = s?.wallet || {}, busy = !!snapshot?.busy, rar = k => SEALS.find(x => x.key === k).rarity;
  // One row per step: the lower seals going in (lit as you hold them), an ember arrow, the seal that comes out.
  const row = to => {
    const from = FORGE_STEPS[to], ratio = forgeRatio(s?.config, to), have = w['seal_' + from] | 0, can = Math.min(10, Math.floor(have / ratio)), lit = can ? ratio : have % ratio;
    return `<div class="pe-forge-row${can ? ' ready' : ''}">
      <span class="pe-forge-in" role="img" aria-label="${n(have)} ${rar(from)} seals; ${ratio} make one ${rar(to)} seal">${Array.from({length: ratio}, (_, i) => sealIcon(from, i < lit ? 'on' : 'off')).join('')}</span>
      <span class="pe-forge-arrow" aria-hidden="true"></span>
      <span class="pe-forge-out">${sealIcon(to)}</span>
      <span class="pe-forge-text"><b>${rar(to)} seal</b><small>${can ? `${can} ready to forge` : `${ratio - have} more ${rar(from)} needed`}</small></span>
      <span class="pe-forge-acts"><button class="pe-forge-strike" data-act="playEconForge" data-econ-to="${to}" data-econ-times="1" ${can && !busy ? '' : 'disabled'} aria-label="Forge ${ratio} ${rar(from)} seals into 1 ${rar(to)} seal">Forge</button>${can > 1 ? `<button class="link small pe-forge-all" data-act="playEconForge" data-econ-to="${to}" data-econ-times="${can}" ${busy ? 'disabled' : ''} aria-label="Forge ${can} ${rar(to)} seals">All ${can}</button>` : ''}</span>
    </div>`;
  };
  const id = 'peForgeTitle' + (compact ? 'Home' : '');
  return `<section class="pe-forge${compact ? ' pe-forge--compact' : ''}" aria-labelledby="${id}" style="--forge-art:url('${cardImageByName('Great Furnace', 'art_crop')}')">
    <div class="pe-forge-head"><h2 id="${id}">The Forge</h2><p>Three seals strike one of the next rarity.</p>
      <div class="pe-forge-purse">${SEALS.map(x => `<span class="pe-forge-seal" data-seal="${x.key}" title="${x.rarity} seals">${sealIcon(x.key)}<b>${n(w['seal_' + x.key])}</b></span>`).join('')}</div></div>
    <div class="pe-forge-rows">${row('u')}${row('r')}${row('m')}</div></section>`;
}

export function shopMarkup(snapshot, {query = '', press = null, facts = null, packFocus = ''} = {}) {
  const s = snapshot.state, price = s.config?.packPrice || 500, coins = s.wallet?.coins | 0, shop = s.shop || [], reward = s.rewardSet;
  const q = query.trim().toLowerCase(), list = (q ? shop.filter(x => x.name.toLowerCase().includes(q) || x.code === q) : shop).slice(0, q ? 60 : 24);
  const buy = (set, big = false) => `<article class="pe-pack pe-pack--shop${big ? ' pe-pack--feature' : ''}${packFocus === set.code ? ' pe-pack--focus' : ''}" data-pack-code="${esc(set.code)}" aria-label="${esc(set.name)}, ${esc(String(set.released || '').slice(0, 4))}">${boosterMarkup({code: set.code, name: set.name, facts, big})}<span class="pe-pack-year">${esc(String(set.released || '').slice(0, 4))}</span><button class="pe-buy" data-act="playEconBuy" data-econ-set="${esc(set.code)}" ${coins < price || snapshot.busy ? 'disabled' : ''} aria-label="Buy a ${esc(set.name)} pack for ${n(price)} coins">${coinIcon('pe-coin--sm')}<b>${n(price)}</b></button></article>`;
  const pressCard = press?.card ? (() => { const c = press.card, key = {common: 'c', uncommon: 'u', rare: 'r', mythic: 'm'}[c.rarity] || 'r', have = (s.cards || []).find(x => x.o === c.oracle_id)?.c || 0, seals = s.wallet?.['seal_' + key] | 0;
    return `<div class="pe-press-result"><img src="${esc(c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || cardImageByName(c.name))}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer"><div class="pe-press-copy"><strong>${esc(c.name)}</strong><span>${have} of 4 owned</span><button class="pe-stamp" data-act="playEconCraft" data-econ-card="${esc(c.id)}" ${have >= 4 || seals < 1 || snapshot.busy ? 'disabled' : ''}>${sealIcon(key)}<b>${have >= 4 ? 'All 4 owned' : 'Stamp it'}</b></button></div></div>`; })() : press?.error ? `<p class="pe-press-empty">${esc(press.error)}</p>` : '';
  return `<section class="play-menu pe-screen pe-shop" aria-labelledby="playTitle">${head('Merchant', snapshot)}
    <div class="pe-table">
      <section class="pe-shelf" aria-labelledby="peShelfTitle"><h2 id="peShelfTitle">Packs</h2>
        ${reward ? `<div class="pe-feature">${buy(reward, true)}</div>` : ''}
        <label class="pe-search"><span>Any set, any year</span><input type="search" data-input="playEconSetSearch" value="${esc(query)}" maxlength="60" placeholder="Search sets"></label>
        <div class="pe-pack-grid">${list.filter(x => x.code !== reward?.code).map(x => buy(x)).join('') || '<p class="pe-press-empty">No set by that name.</p>'}</div>
      </section>
      ${forgeMarkup(snapshot)}
      <section class="pe-press" aria-labelledby="pePressTitle"><h2 id="pePressTitle">Seal press</h2>
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
    ${groups.size ? `<div class="pe-pack-grid pe-pack-grid--open">${[...groups].map(([code, list]) => `<button class="pe-pack pe-pack--open${snapshot.busy === 'open:' + list[0].id ? ' pe-pack--opening' : ''}" data-act="playEconOpen" data-econ-pack="${esc(list[0].id)}" ${snapshot.busy ? 'disabled' : ''} aria-label="Open a ${esc(names.get(code) || code.toUpperCase())} pack, ${list.length} waiting">${boosterMarkup({code, name: names.get(code), facts})}<span class="pe-badge">${n(list.length)}</span></button>`).join('')}</div>`
      : `<div class="pe-empty"><h2>Every pack is open</h2><p>Packs come from Story battles, Planeswalk bosses, weekly quests and the Merchant.</p><button class="btn" data-act="playEconView" data-econ-view="shop">Visit the Merchant</button></div>`}
    ${statusLine(snapshot)}</section>`;
}

const COLORS = [['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green'], ['C', 'Colorless']];
const TYPES = ['Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Lands'];
const pips = c => `<span class="pe-pips${c.holo ? ' pe-pips--holo' : ''}" aria-label="${c.holo ? `${c.c} holo` : `${c.c} of 4`}">${[1, 2, 3, 4].map(i => `<i class="${i <= c.c ? 'on' : ''}"></i>`).join('')}</span>`;
// The printing you pulled, else the card's own art, else Scryfall's image by name.
const cardImage = (c, facts) => c.p?.image || facts?.card?.(c.o)?.i || cardImageByName(c.n);

// The app's own card tile (foil, holo stamp, colour and set emblems, hover and tilt), with copies
// owned in Play where the app shows a price. Tapping opens the app's card sheet in Play mode.
// The app's set badge look, without its link to the real set page (Play's wall): the art opens the card.
const playSetBadge = (code, rarity) => `<span class="set-badge r-${esc(rarity || 'common')}"><span class="set-icon" style="--icon:url('${esc(setIconUrl(code))}')" aria-hidden="true"></span><span>${esc(code.toUpperCase())}</span></span>`;
// Normal and holo copies of one card as separate tiles: the holo tile right after its card.
export const holoSplit = cards => cards.flatMap(c => { const h = Math.min(c.h | 0, c.c | 0), rest = (c.c | 0) - h;
  return [...(rest > 0 ? [{...c, c: rest}] : []), ...(h > 0 ? [{...c, c: h, holo: true}] : [])]; });
export function playCardTile(c, facts, i = 0) {
  // The main collection's own row tile (.lot): art with finish and tile chrome, name with emblem and
  // set badge, mana cost and set line. Play shows copies owned instead of price, condition and stepper.
  const base = facts?.card?.(c.o)?.card || {name: c.n, rarity: c.r, set: c.p?.set || c.s?.[0] || ''}, n = Math.min(c.c | 0, 4);
  // Holo copies sit on their own tile with the app's foil finish.
  const card = c.holo ? {...base, finishes: [...new Set([...(base.finishes || ['nonfoil']), 'foil'])]} : base;
  const set = card.set || c.p?.set || c.s?.[0] || '', number = card.collector_number || c.p?.number || '';
  return `<div class="lot pe-lot${c.holo ? ' pe-lot--holo' : ''}" data-rarity="${esc(card.rarity || c.r || '')}" style="--i:${Math.min(i, 24)}">
    <button class="lot-art" ${card.id ? finishAttrs('mtg', card, c.holo ? {priceFinish: 'foil'} : {}) : ''} data-act="card" data-name="${esc(c.n)}" data-play-card="1" data-oracle="${esc(c.o)}"${c.holo ? ' data-play-finish="foil"' : ''} aria-label="Open ${esc(c.n)}">${img(cardImage(c, facts), c.n)}</button>
    <div class="lot-info"><span class="lot-name">${esc(c.n)}${card.id ? rowEmblem('mtg', card) : ''} ${set ? playSetBadge(set, card.rarity || c.r) : ''}</span>
      <span class="lot-sub">${manaCost(card)}<span>${esc(set.toUpperCase())}${number ? ' #' + esc(number) : ''}</span></span></div>
    <div class="lot-side" title="${c.holo ? `${n} holo` : `${n} of 4 copies`}">${c.holo ? `<span class="pe-holo-tag">Holo</span>` : ''}${pips(c)}</div>
  </div>`;
}

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
    <div class="pe-color-tabs" role="group" aria-label="Colour">${COLORS.map(([k, l]) => `<button class="pe-mana pe-mana--${k}" data-act="playEconColor" data-econ-color="${k}" aria-pressed="${ui.color === k}" aria-label="${l}" title="${l}"><img class="pe-mana-sym" src="${symbolUrl(k)}" alt="" aria-hidden="true" loading="lazy" decoding="async"></button>`).join('')}</div>
    <select class="pe-type" data-change="playEconType" aria-label="Card type"><option value="">All types</option>${TYPES.map(t => `<option${ui.type === t ? ' selected' : ''}>${t}</option>`).join('')}</select>
    <div class="pe-rarity-tabs" role="group" aria-label="Rarity">${[['', 'All'], ['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['mythic', 'Mythic']].map(([k, l]) => `<button data-act="playEconRarity" data-econ-rarity="${k}" aria-pressed="${(ui.rarity || '') === k}">${l}</button>`).join('')}</div>
    <select class="pe-sort" data-change="playEconSort" aria-label="Sort cards">${PLAY_SORTS.map(([k, l]) => `<option value="${k}"${(ui.sort || '') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${setSelect(ui, sets)}</div>`;
}

// One menu for the set filter, grouped by release year, so a big binder never grows a wall of chips.
function setSelect(ui = {}, sets = []) {
  if (sets.length < 2) return '';
  const years = new Map();
  for (const x of sets) { const y = (x.released || '').slice(0, 4) || 'Other'; if (!years.has(y)) years.set(y, []); years.get(y).push(x); }
  const opt = x => `<option value="${esc(x.code)}"${(ui.set || '') === x.code ? ' selected' : ''}>${esc(x.name)} (${esc(x.code.toUpperCase())})</option>`;
  return `<select class="pe-set-pick" data-change="playEconSetPick" aria-label="Set"><option value="">Every set</option>${[...years].map(([y, list]) => `<optgroup label="${esc(y)}">${list.map(opt).join('')}</optgroup>`).join('')}</select>`;
}

// How the Trunk can be ordered. Set order puts the newest set first, like the Merchant.
export const PLAY_SORTS = [['', 'Name'], ['rarity', 'Rarity'], ['set', 'Newest set'], ['cmc', 'Mana value'], ['count', 'Most copies']];
const RARITY_RANK = {mythic: 0, rare: 1, uncommon: 2, common: 3};
export function sortPlayCards(cards = [], facts = null, sort = '', sets = []) {
  const byName = (a, b) => a.n.localeCompare(b.n), rel = new Map(sets.map(x => [x.code, x.released || '']));
  const setOf = c => c.p?.set || c.s?.[0] || '';
  const cmp = {
    rarity: (a, b) => (RARITY_RANK[a.r] ?? 4) - (RARITY_RANK[b.r] ?? 4) || byName(a, b),
    set: (a, b) => (rel.get(setOf(b)) || '').localeCompare(rel.get(setOf(a)) || '') || setOf(a).localeCompare(setOf(b)) || byName(a, b),
    cmc: (a, b) => (facts?.card?.(a.o)?.m ?? 99) - (facts?.card?.(b.o)?.m ?? 99) || byName(a, b),
    count: (a, b) => (b.c | 0) - (a.c | 0) || byName(a, b),
  }[sort] || byName;
  return cards.slice().sort(cmp);
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

// Every set the Merchant sells plus every set you own cards from, like the app's Sets page: year
// sections, the app's set tiles and progress bars. Sets you haven't started sit greyed at 0%.
export const SET_FORMATS = [['', 'All sets'], ['standard', 'Standard'], ['modern', 'Modern'], ['eternal', 'Vintage & Legacy'], ['started', 'Started']];
export function allPlaySets(state, facts) {
  const own = new Map(playSetRows(state, facts).map(x => [x.code, x])), out = new Map();
  for (const x of state?.shop || []) { const f = facts?.set?.(x.code) || {}, o = own.get(x.code);
    out.set(x.code, {code: x.code, name: x.name, icon: f.icon || setIconUrl(x.code), released: x.released || f.released || '', total: f.total || x.count || null, owned: o?.owned || 0, format: x.format || 'eternal'}); }
  for (const [code, o] of own) if (!out.has(code)) out.set(code, {...o, format: 'eternal'});
  return [...out.values()].sort((a, b) => (b.released || '').localeCompare(a.released || '') || a.name.localeCompare(b.name));
}
function playSetsTab(state, facts, ui = {}) {
  const all = allPlaySets(state, facts), f = ui.setFormat || '', q = String(ui.setQuery || '').trim().toLowerCase();
  const list = all.filter(x => (!f || (f === 'started' ? x.owned > 0 : x.format === f)) && (!q || x.name.toLowerCase().includes(q) || x.code.includes(q)));
  const tile = x => `<button class="set-row set-browser-tile${x.owned ? '' : ' pe-set-none'}" data-act="playEconSet" data-econ-set="${esc(x.code)}" aria-label="${esc(x.name)}: ${x.owned} of ${x.total ?? 'unknown'} cards">${setRowContent({name: x.name, ambient: true, magicSet: {code: x.code, name: x.name}, code: x.code.toUpperCase(), image: x.icon, symbol: `<span class="set-icon" style="--icon:url('${esc(x.icon)}')" aria-hidden="true"></span>`, detail: x.released ? x.released.slice(0, 4) : '', count: x.total, progress: {key: 'play:' + x.code, owned: x.owned, total: x.total, loaded: x.total || 0, known: x.total || 0, complete: true}})}</button>`;
  return `<section class="set-browser-controls pe-set-controls" aria-label="Set filters"><div class="searchbar"><input type="search" value="${esc(ui.setQuery || '')}" placeholder="Search every set by name or code" data-input="playEconSetQuery" aria-label="Search all sets" autocomplete="off"></div>
    <div class="set-browser-quick" role="group" aria-label="Format" data-audit-scroll>${SET_FORMATS.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="playEconSetFormat" data-value="${k}" aria-pressed="${f === k}">${esc(l)}</button>`).join('')}</div>
    <p class="pe-count" role="status">${n(list.length)} of ${n(all.length)} sets · ${n(all.filter(x => x.owned).length)} started</p></section>
    ${list.length ? setYearSections(list, tile, x => x.released) : `<div class="pe-empty"><h2>No sets match</h2><p>Try another format or name.</p></div>`}`;
}

export function collectionMarkup(snapshot, ui = {}) {
  const tab = ui.tab === 'sets' ? 'sets' : 'cards', facts = ui.facts, state = snapshot.state;
  const cards = (state.cards || []).slice().sort((a, b) => a.n.localeCompare(b.n)), sets = playSetRows(state, facts);
  const body = tab === 'sets' ? playSetsTab(state, facts, ui)
    : (() => { const shown = sortPlayCards(filterPlayCards(cards, facts, {query: ui.cardQuery, rarity: ui.rarity, color: ui.color, type: ui.type, set: ui.set}), facts, ui.sort, sets);
      return `${filterBar(ui, {sets})}<p class="pe-count" role="status">${n(shown.length)} of ${n(cards.length)} cards</p>
      ${shown.length ? `<div class="view-gallery pe-coll-view"><div class="list display-list deal pe-coll-list">${holoSplit(shown).slice(0, 300).map((c, i) => playCardTile(c, facts, i)).join('')}</div></div>`
        : `<div class="pe-empty"><h2>${cards.length ? 'No cards match' : 'Your binder is empty'}</h2><p>${cards.length ? 'Try another name, colour or type.' : 'Open a pack to start your Play collection.'}</p></div>`}`; })();
  return `<section class="play-menu pe-screen pe-collection" aria-labelledby="playTitle">${head('Collection', snapshot)}
    ${segmented('playEconCollTab', tab, [['cards', 'Cards', 'cardStack'], ['sets', 'Sets', 'binder']])}
    ${body}
    ${statusLine(snapshot)}</section>`;
}

// The deck builder, Arena style: the app's deck hero on top, your decklist on one side and the
// card pool on the other (your Play cards, or every card in the format). Tap a card for its card
// view (add, remove, craft); drag it onto the decklist; + adds one. Cards you don't own yet can go
// in: they sit greyed in the list with their seal, and Craft (1 to 4 copies) or Craft all spends seals.
// ui.nameFact(name) → slim Scryfall card for cards not in the Trunk; ui.pool = {mode, cards, busy, error}.
export function craftPlan(deck = [], owned = new Map(), rarityOf = () => '', wallet = {}) {
  const rows = [], need = {c: 0, u: 0, r: 0, m: 0};
  for (const c of deck) { if (isBasicLand(c.name)) continue; const miss = Math.max(0, (c.qty | 0) - (owned.get(c.name) || 0)); if (!miss) continue;
    const seal = {common: 'c', uncommon: 'u', rare: 'r', mythic: 'm', special: 'r', bonus: 'm'}[rarityOf(c.name)] || ''; rows.push({name: c.name, miss, seal}); if (seal) need[seal] += miss; }
  const have = {c: wallet.seal_c | 0, u: wallet.seal_u | 0, r: wallet.seal_r | 0, m: wallet.seal_m | 0}, left = {...have};
  let craftable = 0; for (const r of rows) if (r.seal) { const k = Math.min(r.miss, left[r.seal]); left[r.seal] -= k; r.now = k; craftable += k; }
  return {rows, need, have, craftable, missing: rows.reduce((t, r) => t + r.miss, 0)};
}
export function deckBuilderMarkup(snapshot, ui = {}) {
  const edit = ui.edit || {cards: []}, facts = ui.facts, state = snapshot.state, rules = deckRules(edit.format);
  const ownedCards = state.cards || [], owned = ownedByName(ownedCards), byName = new Map(ownedCards.flatMap(c => [[c.n.split(' // ')[0], c], [c.n, c]]));
  const deck = edit.cards || [], count = deck.reduce((t, c) => t + c.qty, 0);
  const slimOf = name => facts?.card?.(byName.get(name)?.o)?.card || ui.nameFact?.(name) || null;
  const factOf = name => facts?.card?.(byName.get(name)?.o) || (ui.nameFact?.(name) ? cardFact(ui.nameFact(name)) : null);
  const groups = new Map();
  for (const c of deck) { const g = isBasicLand(c.name) ? 'Lands' : cardGroup(factOf(c.name)); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); }
  const order = ['Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Battles', 'Cards', 'Lands'];
  const lands = groups.get('Lands')?.reduce((t, c) => t + c.qty, 0) || 0, creatures = groups.get('Creatures')?.reduce((t, c) => t + c.qty, 0) || 0;
  const spells = deck.filter(c => !isBasicLand(c.name) && factOf(c.name) && cardGroup(factOf(c.name)) !== 'Lands');
  const mvCount = spells.reduce((t, c) => t + c.qty, 0), avg = mvCount ? (spells.reduce((t, c) => t + c.qty * factOf(c.name).m, 0) / mvCount).toFixed(1) : '—';
  const lead = deck.find(c => !isBasicLand(c.name)), art = lead ? (factOf(lead.name)?.a || cardImageByName(lead.name, 'art_crop')) : ART + 'f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg';
  const ok = rules.exact ? count === rules.size : count >= rules.size;
  const plan = craftPlan(deck, owned, name => slimOf(name)?.rarity || byName.get(name)?.r || '', state.wallet || {}), planOf = new Map(plan.rows.map(r => [r.name, r]));
  const inDeck = name => deck.filter(c => c.name === name).reduce((t, c) => t + c.qty, 0);
  const room = name => isBasicLand(name) ? Infinity : Math.max(0, rules.copies - inDeck(name));
  const craftMenu = (name, miss, seal, id) => `<details class="pe-craft"><summary aria-label="Craft ${esc(name)}: ${miss} missing" title="Craft with seals">${sealIcon(seal || 'c')}<b>${miss}</b></summary><div class="pe-craft-pop" role="group" aria-label="Craft copies of ${esc(name)}">${slimOf(name)?.set ? `<button class="pe-craft-set" data-act="playGetPack" data-code="${esc(slimOf(name).set)}" aria-label="Get ${esc(slimOf(name).set_name || slimOf(name).set.toUpperCase())} packs at the Merchant" title="Get packs"><span class="set-icon" style="--icon:url('${esc(setIconUrl(slimOf(name).set))}')" aria-hidden="true"></span></button>` : ''}${Array.from({length: miss}, (_, i) => i + 1).map(k => `<button class="pe-craft-n" data-act="playCraftCopies" data-name="${esc(name)}" data-card-id="${esc(id || '')}" data-n="${k}" ${!id || !seal || k > plan.have[seal] || snapshot.busy ? 'disabled' : ''} aria-label="Craft ${k} for ${k} ${SEALS.find(s => s.key === seal)?.label || 'seal'}${k > 1 ? 's' : ''}">${sealIcon(seal || 'c')}<b>${k}</b></button>`).join('')}</div></details>`;
  const row = c => { const miss = planOf.get(c.name)?.miss || 0, have = c.qty - miss, slim = slimOf(c.name);
    return `<li class="pe-build-row${miss ? ' pe-build-row--missing' : ''}" data-drag-card="${esc(c.name)}"><button class="pe-build-open" data-act="card" data-name="${esc(c.name)}" data-play-card="1"${byName.get(c.name) ? ` data-oracle="${esc(byName.get(c.name).o)}"` : ''} aria-label="Open ${esc(c.name)}${miss ? `, ${have} of ${c.qty} owned` : ''}"><span class="pe-build-thumb" style="background-image:url(${esc(factOf(c.name)?.a || cardImageByName(c.name, 'art_crop'))})" aria-hidden="true"></span><span class="pe-build-name">${esc(c.name)}</span>${factOf(c.name)?.mc ? `<span class="pe-build-cost">${esc(factOf(c.name).mc.replace(/[{}]/g, ''))}</span>` : ''}</button>${miss ? craftMenu(c.name, miss, planOf.get(c.name).seal, slim?.id) : ''}<span class="pe-step"><button data-act="playEconStep" data-econ-card="${esc(c.name)}" data-econ-step="-1" aria-label="Remove one ${esc(c.name)}">−</button><b>${c.qty}</b><button data-act="playEconStep" data-econ-card="${esc(c.name)}" data-econ-step="1" ${room(c.name) < 1 ? 'disabled' : ''} aria-label="Add one ${esc(c.name)}">+</button></span></li>`; };
  const mode = ui.pool?.mode === 'all' ? 'all' : 'mine';
  const minePool = filterPlayCards(ownedCards.slice().sort((a, b) => a.n.localeCompare(b.n)), facts, {query: ui.cardQuery, rarity: ui.rarity, color: ui.color, type: ui.type, set: ui.set});
  const tiles = mode === 'all' ? (ui.pool?.cards || []).map(c => ({name: c.name, image: c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || cardImageByName(c.name), rarity: c.rarity, have: owned.get(c.name) || owned.get(c.name.split(' // ')[0]) || 0, oracle: ''}))
    : minePool.map(c => ({name: c.n, image: cardImage(c, facts), rarity: c.r, have: c.c | 0, oracle: c.o}));
  const tile = c => { const r = room(c.name), seal = RARITY_KEY[c.rarity] || 'c', missing = !c.have;
    return `<div class="pe-pool-card${missing ? ' pe-pool-card--missing' : ''}" data-rarity="${esc(c.rarity || '')}" data-drag-card="${esc(c.name)}"><button class="pe-pool-open" data-act="card" data-name="${esc(c.name)}" data-play-card="1"${c.oracle ? ` data-oracle="${esc(c.oracle)}"` : ''} aria-label="Open ${esc(c.name)}, ${c.have ? Math.min(c.have, 4) + ' of 4 owned' : 'not owned yet'}"><img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false"></button><span class="pe-left">${missing ? sealIcon(seal, 'pe-left-seal') : Math.min(c.have, 4)}</span><button class="pe-pool-add" data-act="playEconStep" data-econ-card="${esc(c.name)}" data-econ-step="1" ${r < 1 ? 'disabled' : ''} aria-label="Add ${esc(c.name)} to the deck">+</button></div>`; };
  const poolBody = mode === 'all' && ui.pool?.busy && !tiles.length ? '<div class="pe-grid pe-grid--pool" aria-busy="true">' + '<span class="pe-pool-skeleton" aria-hidden="true"></span>'.repeat(8) + '</div>'
    : tiles.length ? `<div class="pe-grid pe-grid--pool">${tiles.slice(0, 300).map(tile).join('')}</div>`
    : `<div class="pe-empty"><h2>${mode === 'all' ? (ui.pool?.error ? 'Cards could not load' : 'No cards match') : ownedCards.length ? 'No cards match' : 'No cards yet'}</h2><p>${mode === 'all' ? esc(ui.pool?.error || 'Try another name, colour or type.') : ownedCards.length ? 'Try another name, colour or type, or look through all cards.' : 'Open packs, or look through all cards and craft them with seals.'}</p></div>`;
  const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
  const craftAll = plan.missing ? `<div class="pe-craft-all-bar"><span class="pe-craft-need" aria-label="Missing ${plan.missing} cards">${SEALS.filter(s => plan.need[s.key]).map(s => `<span class="pe-cost${plan.need[s.key] > plan.have[s.key] ? ' pe-cost--short' : ''}" title="${plan.need[s.key]} ${s.label}${plan.need[s.key] > 1 ? 's' : ''} needed, ${plan.have[s.key]} owned">${sealIcon(s.key)}${plan.need[s.key]}</span>`).join('')}</span><button class="pe-stamp pe-craft-all" data-act="playCraftAll" ${!plan.craftable || snapshot.busy || ui.crafting ? 'disabled' : ''}>${ui.crafting ? 'Crafting…' : ui.craftArmed ? `Craft ${plan.craftable} now` : plan.craftable < plan.missing ? `Craft ${plan.craftable} of ${plan.missing}` : 'Craft all'}</button></div>` : '';
  return `<section class="play-menu pe-screen pe-builder-screen" aria-labelledby="playDeckTitle">
    ${deckShell({game: 'mtg', source: 'play', art, title: edit.name || 'New Play deck',
      back: `<button class="icon light" data-act="playEconView" data-econ-view="decks" aria-label="Back to Play decks">←</button>`,
      badge: 'Play deck', format: `<span class="chip dark">${esc(edit.format || 'Standard')}</span>`,
      stats: [{value: `${count}/${rules.size}`, label: 'cards', tone: ok ? '' : 'warn'}, ...(plan.missing ? [{value: plan.missing, label: 'to craft', tone: 'warn'}] : []), {value: creatures, label: 'creatures'}, {value: lands, label: 'lands'}, {value: avg, label: 'average mana value'}],
      actions: [{label: edit.busy ? 'Saving…' : 'Save deck', primary: true, attrs: 'data-act="playEconSaveEdit"', disabled: !!edit.busy || !count}]}).replace('<h1>', '<h1 id="playDeckTitle" tabindex="-1">')}
    <div class="pe-builder">
      <section class="pe-build-deck" aria-label="Your deck" data-drop-deck="1">
        <div class="pe-build-meta"><input name="name" data-input="playEconDeckName" maxlength="80" value="${esc(edit.name || '')}" placeholder="Deck name" aria-label="Deck name"><select data-change="playEconDeckFormat" aria-label="Format">${PLAY_FORMATS.map(f => `<option${(edit.format || 'Standard') === f ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
        ${craftAll}
        ${count < rules.size ? `<button class="btn pe-fill" data-act="playFillSlots" ${ui.filling ? 'disabled' : ''}>${ui.filling ? 'Finding cards…' : `Fill ${rules.size - count} empty slot${rules.size - count > 1 ? 's' : ''}`}</button>` : ''}
        ${packGoals(plan, slimOf, facts)}
        ${count ? `<div class="pe-build-tools"><button class="btn ghost" data-act="playEconCopyList">Copy list</button><button class="btn ghost" data-act="playEconToApp">Copy to My decks</button></div>` : ''}
        ${deck.length ? order.filter(g => groups.has(g)).map(g => `<h3 class="pe-build-group">${g} <span>${groups.get(g).reduce((t, c) => t + c.qty, 0)}</span></h3><ul class="pe-build-list">${groups.get(g).sort((a, b) => (factOf(a.name)?.m ?? 99) - (factOf(b.name)?.m ?? 99) || a.name.localeCompare(b.name)).map(row).join('')}</ul>`).join('')
          : '<p class="pe-build-empty">Drag cards here, or tap one to see it.</p>'}
        <div class="pe-basics" role="group" aria-label="Basic lands, free and unlimited">${basics.map(b => `<button class="pe-basic" data-act="playEconStep" data-econ-card="${b}" data-econ-step="1" aria-label="Add a ${b}"><span style="background-image:url(${esc(cardImageByName(b, 'art_crop'))})" aria-hidden="true"></span><b>${b}</b></button>`).join('')}</div>
      </section>
      <section class="pe-build-pool" aria-label="Card pool">
        ${segmented('playEconPool', mode, [['mine', 'Your cards', 'cardStack'], ['all', 'All cards', 'search']])}
        ${filterBar(ui, {sets: mode === 'mine' ? playSetRows(state, facts) : []})}
        <p class="pe-count" role="status">${mode === 'all' ? (ui.pool?.busy ? 'Looking through every card…' : `${n(tiles.length)}${ui.pool?.more ? '+' : ''} ${esc(edit.format || 'Standard')} cards`) : `${n(minePool.length)} of ${n(ownedCards.length)} cards`}</p>
        ${poolBody}
        ${mode === 'all' && ui.pool?.more && !ui.pool?.busy ? '<button class="btn ghost pe-pool-more" data-act="playEconPoolMore">More cards</button>' : ''}
      </section>
    </div>
    ${statusLine(snapshot)}</section>`;
}
// Pack goals: the sets your missing cards come from, most missing first. Each opens that set's
// Play page (its cards, greyed where missing, and Buy a pack); Story acts and quests drop them too.
function packGoals(plan, slimOf, facts) {
  const by = new Map();
  for (const r of plan.rows) { const c = slimOf(r.name); if (!c?.set) continue; const g = by.get(c.set) || {code: c.set, name: facts?.set?.(c.set)?.name || c.set_name || c.set.toUpperCase(), miss: 0}; g.miss += r.miss; by.set(c.set, g); }
  const sets = [...by.values()].sort((a, b) => b.miss - a.miss).slice(0, 4);
  if (!sets.length) return '';
  return `<div class="pe-pack-goals" role="group" aria-label="Packs with your missing cards">${sets.map(g => `<button class="pe-pack-goal" data-act="playGetPack" data-code="${esc(g.code)}" aria-label="${esc(g.name)}: ${g.miss} missing card${g.miss > 1 ? 's' : ''}. Get its packs at the Merchant."><span class="set-icon" style="--icon:url('${esc(setIconUrl(g.code))}')" aria-hidden="true"></span><span class="pe-pack-goal-name">${esc(g.name)}</span><b>${g.miss}</b></button>`).join('')}</div>`;
}
const RARITY_KEY = {common: 'c', uncommon: 'u', rare: 'r', mythic: 'm', special: 'r', bonus: 'm'};

// The Decks page, like the app's deck shelf: your decks front and centre as the app's deck tiles,
// then published precons (browse, see the exact printings, buy only what you're missing), then
// "Paste a list", which finds the formats the list is legal in and asks when more than one fits.
const artCrop = id => scryfallImage(id).replace('/normal/', '/art_crop/');
const deckCover = cards => { const lead = (cards || []).find(c => c.board !== 'side' && !isBasicLand(c.name)) || (cards || [])[0];
  return lead ? (lead.id ? artCrop(lead.id) : cardImageByName(lead.name, 'art_crop')) : ''; };
function playDeckTile(d, owned) {
  const main = (d.cards || []).filter(c => c.board !== 'side'), side = (d.cards || []).filter(c => c.board === 'side');
  const count = list => list.reduce((t, c) => t + (c.qty | 0), 0), size = deckRules(d.format).size;
  const sh = deckShortfall(d.cards || [], owned), want = (d.cards || []).filter(c => !isBasicLand(c.name)).reduce((t, c) => t + (c.qty | 0), 0);
  const missing = sh.missing.reduce((t, m) => t + m.need, 0), share = want ? (want - missing) / want : 1, name = d.name || 'Untitled deck';
  return `<div class="pe-deck-cell"><button class="deck-tile" data-act="playEconEditDeck" data-econ-deck="${esc(d.id)}" aria-label="Open ${esc(name)}">
    <span class="tile-art">${img(deckCover(d.cards), name)}</span><span class="tile-shade"></span>
    <span class="tile-top"><span class="chip dark deck-format-emblem">${esc(d.format || 'Casual')}</span></span>
    <span class="tile-body"><b>${esc(name)}</b><small>${count(main)}/${size}${side.length ? ` · ${count(side)} sideboard` : ''}</small>
      <span class="tile-stats"><span class="tile-owned"><em>${Math.round(share * 100)}%</em> in your Trunk</span><span class="tile-find">${missing ? `<em>${missing}</em> to stamp` : 'Ready'}</span></span>${bar(share, 'thin')}</span></button>
    <button class="pe-deck-delete" data-act="playEconDeleteDeck" data-econ-deck="${esc(d.id)}" aria-label="Delete ${esc(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
}
const year = d => String(d || '').slice(0, 4);
// Hyphenated words (Free-for-All) never split across lines.
const keepWords = t => esc(t).replace(/\S*-\S*/g, w => `<span class="nowrap">${w}</span>`);
function preconShelf(snapshot, pc = {}) {
  const s = snapshot.state, owned = ownedByName(s.cards || []);
  if (pc.open) {
    const o = pc.open, rows = o.rows || [], sh = deckShortfall(rows, owned, new Map(rows.map(r => [r.name, r.rarity])));
    const missing = sh.missing.reduce((t, m) => t + m.need, 0), price = preconPrice(missing, s.config), coins = s.wallet?.coins || 0;
    const have = new Map(owned), card = r => { const got = isBasicLand(r.name) ? r.qty : Math.min(r.qty, have.get(r.name) || 0); have.set(r.name, Math.max(0, (have.get(r.name) || 0) - got));
      return `<figure class="pe-precon-card${got < r.qty ? ' is-missing' : ''}"><img src="${esc(scryfallImage(r.id) || cardImageByName(r.name))}" alt="${esc(r.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><figcaption>${r.qty}×${got < r.qty ? ` <span>${r.qty - got} new</span>` : ''}</figcaption></figure>`; };
    const main = rows.filter(r => r.board !== 'side'), side = rows.filter(r => r.board === 'side');
    return `<div class="pe-precon-open"><div class="pe-precon-top"><button class="btn ghost" data-act="playEconPreconClose">All precons</button>
      <div class="pe-precon-title"><h3>${keepWords(o.name)}</h3><p>${esc(o.product || 'Precon')} · ${esc(year(o.released))}${o.formats?.length ? ' · ' + o.formats.map(esc).join(', ') : ' · Casual'}</p></div>
      <div class="pe-precon-buy"><p>${missing ? `${missing} card${missing === 1 ? '' : 's'} to add · <b>${price.toLocaleString()} coins</b>` : 'You own every card'}</p>
      <button class="btn" data-act="playEconBuyPrecon" ${snapshot.busy || (price > coins) ? 'disabled' : ''}>${price > coins ? 'Not enough coins' : missing ? 'Buy deck' : 'Add to my decks'}</button></div></div>
      <div class="pe-precon-cards">${main.map(card).join('')}</div>
      ${side.length ? `<h4 class="pe-precon-side">Sideboard</h4><div class="pe-precon-cards">${side.map(card).join('')}</div>` : ''}</div>`;
  }
  if (pc.busy && !pc.index) return '<p class="pe-count" role="status">Loading the precon list…</p>';
  if (pc.error) return `<p class="note warn">${esc(pc.error)}</p>`;
  if (!pc.index) return '<button class="btn ghost" data-act="playEconPrecons">Show the precons</button>';
  const q = (pc.query || '').trim().toLowerCase(), list = pc.index.filter(d => !q || d.name.toLowerCase().includes(q) || (d.code || '').toLowerCase() === q || d.type.toLowerCase().includes(q)), shown = list.slice(0, pc.limit || 12);
  return `<label class="pe-search"><span>Find a precon</span><input type="search" data-input="playEconPreconQuery" value="${esc(pc.query || '')}" maxlength="80" placeholder="Precon or set name"></label>
    ${pc.busy ? '<p class="pe-count" role="status">Opening the deck box…</p>' : ''}
    <div class="pe-precon-grid">${shown.map(d => `<button class="pe-precon" data-act="playEconPrecon" data-econ-file="${esc(d.fileName)}" aria-label="${esc(d.name)}, ${esc(d.type)}, ${esc(year(d.releaseDate))}"><span class="set-icon" style="--icon:url('${esc(setIconUrl(String(d.code || '').toLowerCase()))}')" aria-hidden="true"></span><span class="pe-precon-name">${keepWords(d.name)}</span><span class="pe-precon-line">${esc(d.type)} · ${esc(year(d.releaseDate))}</span></button>`).join('') || '<p class="pe-count">No precons match.</p>'}</div>
    ${list.length > shown.length ? `<button class="btn ghost" data-act="playEconPreconMore">Show more (${list.length - shown.length})</button>` : ''}`;
}
function importPanel(snapshot, check) {
  const owned = ownedByName(snapshot.state.cards || []), short = check?.rows ? deckShortfall(check.rows, owned, check.rarity || new Map()) : null;
  const formats = check?.formats || [], pick = check?.format;
  const sealsLine = sh => SEALS.filter(x => sh.seals[x.key]).map(x => `<span class="pe-cost">${sealIcon(x.key)}<b>${sh.seals[x.key]}</b></span>`).join('');
  return `<form class="pe-import-form" data-submit="playEconCheckDeck"><textarea name="list" rows="6" maxlength="20000" aria-label="Deck list" placeholder="Paste a list: 4 Lightning Bolt, one card per line. A Sideboard line starts the sideboard.">${esc(check?.text || '')}</textarea><button class="btn" ${check?.busy ? 'disabled' : ''}>${check?.busy ? 'Checking…' : 'Check the list'}</button></form>
    ${check?.error ? `<p class="note warn">${esc(check.error)}</p>` : ''}
    ${short ? `<div class="pe-shortfall">
      <p>${formats.length === 1 ? `Legal in <b>${esc(formats[0])}</b>.` : formats.length ? 'Legal in more than one format. Which is it for?' : 'Not legal in any format as listed, so it is saved as Casual.'}</p>
      ${formats.length > 1 ? `<div class="pe-format-pick" role="group" aria-label="Format">${formats.map(f => `<button data-act="playEconImportFormat" data-econ-format="${esc(f)}" aria-pressed="${pick === f}">${esc(f)}</button>`).join('')}</div>` : ''}
      ${short.complete ? '<p class="pe-ready">Every card is in your Trunk.</p>' : `<p>To finish it, stamp ${short.missing.reduce((t, m) => t + m.need, 0)} cards:</p><span class="pe-costs">${sealsLine(short)}</span><ul class="pe-missing">${short.missing.slice(0, 60).map(m => `<li>${sealIcon(m.seal)}<span>${m.need} × ${esc(m.name)}</span></li>`).join('')}</ul>`}
      <div class="pe-import-save"><input data-input="playEconImportName" maxlength="80" placeholder="Deck name" aria-label="Deck name" value="${esc(check.name || '')}"><button class="btn" data-act="playEconSaveDeck" ${snapshot.busy || (formats.length > 1 && !pick) ? 'disabled' : ''}>Save deck</button></div></div>` : ''}`;
}
export function decksMarkup(snapshot, {check = null, precon = {}} = {}) {
  const s = snapshot.state, decks = s.decks || [], owned = ownedByName(s.cards || []);
  return `<section class="play-menu pe-screen pe-decks" aria-labelledby="playTitle">${head('Decks', snapshot)}
    <div class="deck-grid pe-deck-shelf"><button class="deck-tile pe-deck-new" data-act="playEconView" data-econ-view="finder"><span class="tile-art">${img(TILE_ART.decks, '')}</span><span class="tile-shade"></span><span class="tile-body"><b>Build a deck</b><small>From the cards in your Trunk</small></span></button>${decks.map(d => playDeckTile(d, owned)).join('')}</div>
    <section class="pe-import pe-precons" aria-labelledby="pePreconTitle"><h2 id="pePreconTitle">Precons</h2><p class="pe-sub">Published decks with their real printings. You only pay for the cards you don't have yet.</p>${preconShelf(snapshot, precon)}</section>
    <section class="pe-import" aria-labelledby="peImportTitle"><h2 id="peImportTitle">Paste a list</h2>${importPanel(snapshot, check)}</section>
    ${statusLine(snapshot)}</section>`;
}

export function econScreenMarkup(view, snapshot, ui = {}) {
  if (!purse(snapshot?.state)) return `<section class="play-menu pe-screen" aria-labelledby="playTitle"><header class="pl-head pe-head"><button class="pl-back" data-act="playHome" aria-label="Back to Play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div class="pl-head-title"><p class="eyebrow">Play</p><h1 id="playTitle" tabindex="-1">Your Play collection</h1></div></header><div class="pe-empty"><h2>${snapshot?.loading ? 'Opening your binder…' : 'Sign in to start collecting'}</h2>${snapshot?.loading ? '' : '<p>Your Play collection, coins and seals live with your account.</p><button class="btn" data-act="menu">Sign in</button>'}</div>${statusLine(snapshot)}</section>`;
  if (view === 'shop') return shopMarkup(snapshot, ui);
  if (view === 'packs') return packsMarkup(snapshot, ui);
  if (view === 'collection') return collectionMarkup(snapshot, ui);
  if (view === 'decks') return decksMarkup(snapshot, ui);
  if (view === 'deck') return deckBuilderMarkup(snapshot, ui);
  if (view === 'deeds') return deedsScreenMarkup(snapshot, ui);
  return '';
}
export const ECON_VIEWS = new Set(['shop', 'packs', 'collection', 'decks', 'deck', 'deeds', 'finder']);
