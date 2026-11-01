// Play progression screens: the top bar (coins, seals, packs, level), the "your stuff" row on the
// Play homepage, the Merchant, Packs, Collection and Decks. Legacy of the Duelist style menus
// on real card art, in the app's glass and gold. Markup only; app.js wires the actions.
// The wall: no prices anywhere in Play. Cards show art, name, rarity and copies owned (of 4).
import {SEALS, masteryLevel, deckShortfall} from './play-econ-rules.js';
import {purse} from './play-econ-client.js';
import {packArtUrl} from './pack-preview.js';
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

export const coinIcon = (cls = '') => `<svg class="pe-coin ${cls}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="url(#peGold)"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#7a5418" stroke-width="1.4" opacity=".7"/><path d="M16 8.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#7a5418" opacity=".75"/></svg>`;
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
const packArt = (code, name = '') => `${esc(packArtUrl('mtg', {code, name}))}),url(/img/mtg-set/${esc(code)}.jpg`;

export function shopMarkup(snapshot, {query = '', press = null} = {}) {
  const s = snapshot.state, price = s.config?.packPrice || 500, coins = s.wallet?.coins | 0, shop = s.shop || [], reward = s.rewardSet;
  const q = query.trim().toLowerCase(), list = (q ? shop.filter(x => x.name.toLowerCase().includes(q) || x.code === q) : shop).slice(0, q ? 60 : 24);
  const buy = (set, big = false) => `<article class="pe-pack${big ? ' pe-pack--feature' : ''}"><span class="pe-pack-art" style="background-image:url(${packArt(set.code, set.name)})" aria-hidden="true"></span><span class="pe-pack-name">${esc(set.name)}</span><span class="pe-pack-year">${esc(String(set.released || '').slice(0, 4))}</span><button class="pe-buy" data-act="playEconBuy" data-econ-set="${esc(set.code)}" ${coins < price || snapshot.busy ? 'disabled' : ''} aria-label="Buy a ${esc(set.name)} pack for ${n(price)} coins">${coinIcon('pe-coin--sm')}<b>${n(price)}</b></button></article>`;
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

export function packsMarkup(snapshot) {
  const s = snapshot.state, packs = s.packs || [], names = new Map((s.shop || []).map(x => [x.code, x.name]));
  const groups = new Map();
  for (const p of packs) { if (!groups.has(p.set)) groups.set(p.set, []); groups.get(p.set).push(p); }
  return `<section class="play-menu pe-screen pe-packs" aria-labelledby="playTitle">${head('Packs', snapshot)}
    ${groups.size ? `<div class="pe-pack-grid pe-pack-grid--open">${[...groups].map(([code, list]) => `<button class="pe-pack pe-pack--open" data-act="playEconOpen" data-econ-pack="${esc(list[0].id)}" ${snapshot.busy ? 'disabled' : ''} aria-label="Open a ${esc(names.get(code) || code.toUpperCase())} pack, ${list.length} waiting"><span class="pe-pack-art" style="background-image:url(${packArt(code, names.get(code) || '')})" aria-hidden="true"></span><span class="pe-pack-name">${esc(names.get(code) || code.toUpperCase())}</span><span class="pe-badge">${n(list.length)}</span></button>`).join('')}</div>`
      : `<div class="pe-empty"><h2>Every pack is open</h2><p>Packs come from Story battles, Planeswalk bosses, weekly quests and the Merchant.</p><button class="btn" data-act="playEconView" data-econ-view="shop">Visit the Merchant</button></div>`}
    ${statusLine(snapshot)}</section>`;
}

export function collectionMarkup(snapshot, {query = '', rarity = ''} = {}) {
  const cards = (snapshot.state.cards || []).slice().sort((a, b) => a.n.localeCompare(b.n));
  const q = query.trim().toLowerCase(), shown = cards.filter(c => (!q || c.n.toLowerCase().includes(q)) && (!rarity || c.r === rarity));
  const pips = c => `<span class="pe-pips" aria-label="${c.c} of 4">${[1, 2, 3, 4].map(i => `<i class="${i <= c.c ? 'on' : ''}"></i>`).join('')}</span>`;
  return `<section class="play-menu pe-screen pe-collection" aria-labelledby="playTitle">${head('Collection', snapshot)}
    <div class="pe-tools"><label class="pe-search"><span>Find a card</span><input type="search" data-input="playEconCardSearch" value="${esc(query)}" maxlength="80" placeholder="Card name"></label>
      <div class="pe-rarity-tabs" role="group" aria-label="Rarity">${[['', 'All'], ['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['mythic', 'Mythic']].map(([k, l]) => `<button data-act="playEconRarity" data-econ-rarity="${k}" aria-pressed="${rarity === k}">${l}</button>`).join('')}</div></div>
    <p class="pe-count" role="status">${n(shown.length)} of ${n(cards.length)} cards</p>
    ${shown.length ? `<div class="pe-grid">${shown.slice(0, 240).map(c => `<figure class="pe-card" data-rarity="${esc(c.r)}"><img src="${esc(cardImageByName(c.n))}" alt="${esc(c.n)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><figcaption>${pips(c)}</figcaption></figure>`).join('')}</div>`
      : `<div class="pe-empty"><h2>${cards.length ? 'No cards match' : 'Your binder is empty'}</h2><p>${cards.length ? 'Try another name or rarity.' : 'Open a pack to start your Play collection.'}</p></div>`}
    ${statusLine(snapshot)}</section>`;
}

// decks: Play decks. check: an imported list being checked {name, format, rows, rarity:Map, error}.
export function decksMarkup(snapshot, {check = null} = {}) {
  const s = snapshot.state, decks = s.decks || [], owned = new Map((s.cards || []).map(c => [c.n, c.c]));
  const short = check?.rows ? deckShortfall(check.rows, owned, check.rarity || new Map()) : null;
  const sealsLine = sh => SEALS.filter(x => sh.seals[x.key]).map(x => `<span class="pe-cost">${sealIcon(x.key)}<b>${sh.seals[x.key]}</b></span>`).join('');
  const deckCard = d => { const sh = deckShortfall(d.cards || [], owned, new Map((s.cards || []).map(c => [c.n, c.r]))), lead = (d.cards || []).find(c => !/^(?:plains|island|swamp|mountain|forest)$/i.test(c.name));
    return `<article class="pe-deck"><span class="pe-deck-art" style="background-image:url(${esc(lead ? cardImageByName(lead.name, 'art_crop') : '')})" aria-hidden="true"></span><span class="pe-deck-name">${esc(d.name || 'Untitled deck')}</span><span class="pe-deck-line">${esc(d.format || 'Any format')} · ${sh.complete ? 'Ready to play' : sh.missing.reduce((t, m) => t + m.need, 0) + ' cards to stamp'}</span>${sh.complete ? '' : `<span class="pe-costs">${sealsLine(sh)}</span>`}<button class="pe-deck-delete" data-act="playEconDeleteDeck" data-econ-deck="${esc(d.id)}" aria-label="Delete ${esc(d.name || 'deck')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></article>`; };
  return `<section class="play-menu pe-screen pe-decks" aria-labelledby="playTitle">${head('Decks', snapshot)}
    <section class="pe-import" aria-labelledby="peImportTitle"><h2 id="peImportTitle">Bring in a deck</h2>
      <form class="pe-import-form" data-submit="playEconCheckDeck"><input name="name" maxlength="80" placeholder="Deck name" aria-label="Deck name" value="${esc(check?.name || '')}"><select name="format" aria-label="Format">${['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper', 'Commander'].map(f => `<option${check?.format === f ? ' selected' : ''}>${f}</option>`).join('')}</select><textarea name="list" rows="5" maxlength="20000" aria-label="Deck list" placeholder="4 Card name">${esc(check?.text || '')}</textarea><button class="btn" ${check?.busy ? 'disabled' : ''}>${check?.busy ? 'Checking…' : 'Check against my collection'}</button></form>
      ${check?.error ? `<p class="note warn">${esc(check.error)}</p>` : ''}
      ${short ? `<div class="pe-shortfall">${short.complete ? '<p class="pe-ready">Every card is in your collection.</p>' : `<p>To finish it, stamp ${short.missing.reduce((t, m) => t + m.need, 0)} cards:</p><span class="pe-costs">${sealsLine(short)}</span><ul class="pe-missing">${short.missing.slice(0, 60).map(m => `<li>${sealIcon(m.seal)}<span>${m.need} × ${esc(m.name)}</span></li>`).join('')}</ul>`}<button class="btn" data-act="playEconSaveDeck" ${snapshot.busy ? 'disabled' : ''}>Save as a Play deck</button></div>` : ''}
    </section>
    ${decks.length ? `<div class="pe-deck-grid">${decks.map(deckCard).join('')}</div>` : ''}
    ${statusLine(snapshot)}</section>`;
}

export function econScreenMarkup(view, snapshot, ui = {}) {
  if (!purse(snapshot?.state)) return `<section class="play-menu pe-screen" aria-labelledby="playTitle"><header class="pl-head pe-head"><button class="pl-back" data-act="playHome" aria-label="Back to Play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div class="pl-head-title"><p class="eyebrow">Play</p><h1 id="playTitle" tabindex="-1">Your Play collection</h1></div></header><div class="pe-empty"><h2>${snapshot?.loading ? 'Opening your binder…' : 'Sign in to start collecting'}</h2>${snapshot?.loading ? '' : '<p>Your Play collection, coins and seals live with your account.</p><button class="btn" data-act="menu">Sign in</button>'}</div>${statusLine(snapshot)}</section>`;
  if (view === 'shop') return shopMarkup(snapshot, ui);
  if (view === 'packs') return packsMarkup(snapshot);
  if (view === 'collection') return collectionMarkup(snapshot, ui);
  if (view === 'decks') return decksMarkup(snapshot, ui);
  return '';
}
export const ECON_VIEWS = new Set(['shop', 'packs', 'collection', 'decks']);
