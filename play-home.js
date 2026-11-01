// The Play homepage, laid out like the app's own home: a Story header on the current act (its
// art, its sets' packs, where you are), then your packs, the play modes, your decks, your set
// progress and the Merchant's newest sets. Markup only; app.js wires the actions.
// Play's wall: no prices, and nothing here reads the real collection.
import {boosterMarkup, playSetRows, econNoticeMarkup, cardImageByName, coinIcon, purseMarkup, forgeMarkup} from './play-econ-ui.js';
import {purse} from './play-econ-client.js';
import {deckRules, isBasicLand} from './play-econ-rules.js';
import {setRowContent} from './set-list-ui.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('en-US');

// Story acts in order (story-mode-acts.md). Only what the header shows; battles live with Story mode.
export const STORY_ACTS = [
  {act: 1, name: 'The Dawn of Dominaria', years: '1993 to 1994', line: 'Urza and Mishra, and the first spells ever cast.',
    sets: [{code: 'lea', name: 'Limited Edition Alpha'}, {code: 'arn', name: 'Arabian Nights'}, {code: 'atq', name: 'Antiquities'}],
    art: 'https://api.scryfall.com/cards/atq/57?format=image&version=art_crop', battles: 8},
];
export const storyActFor = (progress = {}) => STORY_ACTS.find(a => a.act === (progress.act || 1)) || STORY_ACTS[0];

const shelf = (title, link, body, id) => `<section class="pe-shelf-row" aria-labelledby="${id}"><div class="home-shelf-heading"><h2 id="${id}">${title}</h2>${link}</div>${body}</section>`;
const viewLink = (view, label) => `<button class="link small" data-act="playEconView" data-econ-view="${view}">${label}</button>`;

function storyHeader(act, facts, progress = {}) {
  const won = progress.won || 0;
  return `<section class="pe-story" aria-labelledby="peStoryTitle">
    <img class="pe-story-art" src="${esc(act.art)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()"><span class="pe-story-shade" aria-hidden="true"></span>
    <div class="pe-story-body">
      <div class="pe-story-copy"><p class="eyebrow">Story · Act ${act.act}</p><h2 id="peStoryTitle">${esc(act.name)}</h2><p class="pe-story-line">${esc(act.years)}. ${esc(act.line)}</p>
        <div class="pe-story-progress" role="img" aria-label="Battle ${won} of ${act.battles} won">${Array.from({length: act.battles}, (_, i) => `<i class="${i < won ? 'on' : ''}${i === act.battles - 1 ? ' boss' : ''}"></i>`).join('')}</div>
        <button class="btn cs-plate pe-story-go" disabled><span class="cs-plate-label">Story opens soon</span></button></div>
      <div class="pe-story-packs" aria-label="Packs this act gives">${act.sets.map(s => `<span class="pe-story-pack" role="img" aria-label="${esc(s.name)} pack">${boosterMarkup({code: s.code, name: s.name, facts, mini: true})}</span>`).join('')}</div>
    </div></section>`;
}

export function playHomeMarkup({econ = null, facts = null, signedIn = false, modesHtml = '', story = {}} = {}) {
  const state = econ?.state, p = purse(state), act = storyActFor(story);
  const head = `<header class="pl-home-head"><div><h1 id="playTitle">Play</h1></div>${purseMarkup(econ)}</header>`;
  if (!p) return `<section class="play-menu play-menu--forge pl-home pe-home" aria-labelledby="playTitle">${head}${storyHeader(act, facts)}${modesHtml}${econNoticeMarkup(econ, {signedIn})}</section>`;
  // Packs: one wrapper per set, with how many are waiting.
  const groups = new Map();
  for (const pk of state.packs || []) { if (!groups.has(pk.set)) groups.set(pk.set, []); groups.get(pk.set).push(pk); }
  const names = new Map([...(state.shop || []).map(x => [x.code, x.name]), ...(state.rewardSet ? [[state.rewardSet.code, state.rewardSet.name]] : [])]);
  const packs = groups.size
    ? `<div class="pe-home-packs">${[...groups].slice(0, 6).map(([code, list]) => `<button class="pe-pack pe-pack--open${econ.busy === 'open:' + list[0].id ? ' pe-pack--opening' : ''}" data-act="playEconOpen" data-econ-pack="${esc(list[0].id)}" ${econ.busy ? 'disabled' : ''} aria-label="Open a ${esc(names.get(code) || code.toUpperCase())} pack, ${list.length} waiting">${boosterMarkup({code, name: names.get(code), facts})}<span class="pe-badge">${n(list.length)}</span></button>`).join('')}</div>`
    : `<p class="pe-home-empty">Every pack is open. Story battles, Planeswalk bosses and the Merchant give more.</p>`;
  // Decks: the app's deck shelf cards, with Build a deck first.
  const decks = state.decks || [];
  const deckCard = d => { const count = (d.cards || []).reduce((t, c) => t + (c.qty | 0), 0), lead = (d.cards || []).find(c => !isBasicLand(c.name));
    return `<button type="button" class="home-personal-deck" data-act="playEconEditDeck" data-econ-deck="${esc(d.id)}"><span class="home-personal-art" aria-hidden="true">${lead ? `<img src="${esc(cardImageByName(lead.name, 'art_crop'))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span><span class="home-personal-copy"><b>${esc(d.name || 'Untitled deck')}</b><small>${esc(d.format || 'Standard')} · ${count}/${deckRules(d.format).size} cards</small></span></button>`; };
  const deckRow = `<div class="home-personal-grid pe-home-decks"><button type="button" class="home-personal-deck pe-home-build" data-act="playEconEditDeck" data-econ-deck=""><span class="home-personal-art" aria-hidden="true"><img src="https://cards.scryfall.io/art_crop/front/f/d/fd99bce1-ce39-464b-8e61-2631eb3ed6f6.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"></span><span class="home-personal-copy"><b>Build a deck</b><small>From the cards you own</small></span></button>${decks.slice(0, 2).map(deckCard).join('')}</div>`;
  // Collection: the sets you are filling, with the app's progress bars.
  const sets = playSetRows(state, facts).slice(0, 3);
  const owned = (state.cards || []).length;
  const setRow = sets.length ? `<div class="set-list set-year-grid set-browser-flat pe-set-grid">${sets.map(x => `<button class="set-row set-browser-tile" data-act="playEconSet" data-econ-set="${esc(x.code)}" data-econ-from="home" aria-label="${esc(x.name)}: ${x.owned} of ${x.total ?? 'unknown'} cards">${setRowContent({name: x.name, ambient: true, magicSet: {code: x.code, name: x.name}, code: x.code.toUpperCase(), image: x.icon, symbol: `<span class="set-icon" style="--icon:url('${esc(x.icon)}')" aria-hidden="true"></span>`, detail: x.released ? x.released.slice(0, 4) : '', count: x.total, progress: {key: 'play:' + x.code, owned: x.owned, total: x.total, loaded: x.total || 0, known: x.total || 0, complete: true}})}</button>`).join('')}</div>` : '';
  // Merchant: the newest sets first, so new releases are easy to find.
  const price = state.config?.packPrice || 500, coins = state.wallet?.coins | 0;
  const shop = (state.shop || []).slice(0, 6);
  const shopRow = shop.length ? `<div class="pe-home-shop">${shop.map(s => `<article class="pe-pack pe-pack--shop" aria-label="${esc(s.name)}">${boosterMarkup({code: s.code, name: s.name, facts})}<button class="pe-buy" data-act="playEconBuy" data-econ-set="${esc(s.code)}" ${coins < price || econ.busy ? 'disabled' : ''} aria-label="Buy a ${esc(s.name)} pack for ${n(price)} coins">${coinIcon('pe-coin--sm')}<b>${n(price)}</b></button></article>`).join('')}</div>` : '';
  return `<section class="play-menu play-menu--forge pl-home pe-home" aria-labelledby="playTitle">
    ${head}
    ${storyHeader(act, facts, story)}
    ${shelf('Your packs', viewLink('packs', 'All packs'), packs, 'peHomePacks')}
    ${shelf('Play', '', modesHtml, 'peHomeModes')}
    ${forgeMarkup(econ, {compact: true})}
    ${shelf('Your decks', viewLink('decks', 'All decks'), deckRow, 'peHomeDecks')}
    ${shelf('Your collection', viewLink('collection', `${n(owned)} cards`), setRow || `<p class="pe-home-empty">Open a pack and your first set starts filling in.</p>`, 'peHomeColl')}
    ${shopRow ? shelf('Merchant', viewLink('shop', 'Every set'), shopRow, 'peHomeShop') : ''}
  </section>`;
}
