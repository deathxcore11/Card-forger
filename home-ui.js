// Home presentation and isolated interactions. No collection writes or deck generation.
import { GAMES, GAME_IDS, GAME_ICON } from './games.js';
import { esc, safeHref, usd } from './ui.js';
import { communityState, communitySlides, loadCommunity } from './community-feed.js';
import { loadMeta, metaState } from './meta.js';
import { communityArtwork, handleCommunityArtwork } from './community-art.js';

export const homeMetaKey = g => g === 'mtg' ? 'mtg:Standard' : g;
const positions = new Map();
const requests = new Map();
const DAY = 86400000;
export function gameTabs(active) {
  return GAME_IDS.map(g => `<button type="button" class="game-tab game-tab-${g}" data-act="setGame" data-game="${g}" role="tab" id="game-tab-${g}" aria-controls="content" aria-selected="${g === active}" tabindex="${g === active ? 0 : -1}" aria-label="${esc(GAMES[g].name)}"><span class="game-tab-mark" aria-hidden="true">${GAME_ICON[g]}</span><span class="game-tab-name">${esc(GAMES[g].short)}</span><span class="game-tab-light" aria-hidden="true"></span></button>`).join('');
}
export function syncGameTabs(root, active) {
  if (!root?.querySelector || !root?.querySelectorAll) return;
  if (!root.querySelector('[role="tab"]')) root.innerHTML = gameTabs(active);
  for (const tab of root.querySelectorAll('[role="tab"]')) {
    const selected = tab.dataset.game === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}
export function attachGameTabs(root) {
  if (!root) return () => {};
  const onKey = e => {
    const tab = e.target.closest?.('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...root.querySelectorAll('[role="tab"]')], i = tabs.indexOf(tab);
    const index = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].focus();
    tabs[index].click();
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

export function homeValue({ total, copies, decks, unpriced = 0, change = null, valueRoute = '#collection' }) {
  const amount = copies > 0 && unpriced >= copies ? '—' : usd(total, 0);
  return `<section class="home-value" aria-label="Your collection at a glance"><button class="home-value-main" data-act="go" data-to="${esc(valueRoute)}"><span class="eyebrow">Your collection</span><strong>${amount}</strong><span class="home-value-note">${copies ? unpriced ? 'Known subtotal' : 'Estimated value' : 'Ready for your first card'}${unpriced ? ` · ${unpriced.toLocaleString()} unpriced` : ''}${change !== null && copies && !unpriced ? ` <span class="${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '+' : '−'}${usd(Math.abs(change), 0)}</span>` : ''}</span></button><div class="home-value-counts"><button data-act="go" data-to="#collection"><b>${Number(copies || 0).toLocaleString()}</b><span>cards</span></button><button data-act="go" data-to="#decks"><b>${Number(decks || 0).toLocaleString()}</b><span>decks</span></button></div></section>`;
}

export function displayDate(value) {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', ...(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? { timeZone: 'UTC' } : {}) }) : '';
}
export function featureArticle(g, slide, index, length) {
  if (!slide) return `<article class="community-feature community-empty"><p class="eyebrow">From the community</p><h3>No live stories right now.</h3><p>News and deck sources are temporarily unavailable. Your collection and decks are still here.</p><button class="link" data-act="go" data-to="#decks/inspiration">Explore deck sources →</button></article>`;
  const kind = ['deck', 'event', 'news', 'link'].includes(slide.kind) ? slide.kind : 'link';
  const label = { deck: 'Community deck', event: 'Events', news: 'In the news', link: 'Explore the source' }[kind];
  const date = displayDate(slide.publishedAt), fetched = displayDate(slide.fetchedAt), starts = displayDate(slide.startsAt), ends = displayDate(slide.endsAt);
  const dateHtml = kind === 'event' && starts ? `<span>Event dates <time datetime="${esc(slide.startsAt)}">${esc(starts)}</time>${ends && ends !== starts ? ` to <time datetime="${esc(slide.endsAt)}">${esc(ends)}</time>` : ''}</span>` : date ? `<span>${esc(slide.dateLabel || 'Published')} <time datetime="${esc(slide.publishedAt)}">${esc(date)}</time></span>` : `<span>${kind === 'event' ? 'Event date' : 'Publication date'} unavailable</span>`;
  const href = safeHref(slide.url);
  return `<article class="community-feature feature-${kind}" role="group" aria-roledescription="slide" aria-label="${index + 1} of ${length}" data-slide-id="${esc(slide.id || '')}"><div class="community-feature-copy"><p class="eyebrow"><span class="community-signal" aria-hidden="true"></span>${label}${slide.stale ? ' · Older snapshot' : ''}</p><h3>${esc(slide.title || 'Visit the source')}</h3>${slide.summary ? `<p class="community-summary">${esc(slide.summary)}</p>` : ''}${slide.methodology ? `<p class="community-methodology">${esc(slide.methodology)}</p>` : ''}<div class="community-source"><span>${esc(slide.source || 'Source')}</span>${kind === 'link' ? '<span>Source link · not a live headline</span>' : dateHtml}${kind !== 'link' && fetched ? `<span>Checked ${esc(fetched)}</span>` : ''}</div>${href && href !== '#' ? `<a class="community-open" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${kind === 'deck' ? 'View original deck' : kind === 'event' ? 'View event' : kind === 'news' ? 'Read at source' : 'Open source'} <span aria-hidden="true">↗</span><span class="home-sr-only"> (opens in a new tab)</span></a>` : '<p class="small muted">Source link unavailable.</p>'}</div>${communityArtwork(g, slide)}</article>`;
}
function slidesFor(g) { return communitySlides(g, { metaState: metaState(homeMetaKey(g)), metaKey: homeMetaKey(g), format: g === 'mtg' ? 'Standard' : undefined }); }
// The existing Meta decks shortcut, with a quiet preview of the exact first
// tournament list. It keeps its action and footprint; no new deck section.
export function homeMetaShortcut(g) {
  const slide = slidesFor(g).find(item => item.kind === 'deck') || { kind: 'link' };
  const label = slide.artwork ? `Featured deck: ${slide.title}, via ${slide.source}. Card preview: ${slide.artwork.cardId}, when artwork is available.` : `${GAMES[g].short} game theme; no verified deck artwork is available.`;
  return `<button class="quick-btn home-meta-shortcut" data-home-meta="${g}" data-act="go" data-to="#decks/inspiration">${communityArtwork(g, slide, { compact: true })}<span class="home-meta-icon" aria-hidden="true">🏆</span><b>Meta decks</b><small>${g === 'mtg' ? 'Tournament decks, precons and shared lists, with what you own' : 'Today’s tournament decks, with what you own'}</small><span class="home-sr-only">${esc(label)}</span></button>`;
}
function positionFor(g, count) { return count ? ((positions.get(g) || 0) % count + count) % count : 0; }
export function homeCommunity(g) {
  const slides = slidesFor(g), index = positionFor(g, slides.length), state = communityState(g);
  const status = state.busy && !state.data ? 'Checking sources…' : (state.error || state.data?.error || state.data?.status === 'unavailable') ? 'Some sources are unavailable. Available links and cached items remain.' : 'Daily source check · recent stories kept for 7 days';
  return `<section class="home-community" data-home-community="${g}" data-home-gesture="carousel" role="region" aria-roledescription="carousel" aria-label="${esc(GAMES[g].short)} community highlights"><div class="section-head"><div><p class="eyebrow">Beyond your binder</p><h2>Community spotlight</h2></div><button class="link small" data-act="go" data-to="#decks/inspiration">All decks <span aria-hidden="true">↗</span></button></div><div class="community-stage" aria-live="polite" aria-atomic="true">${featureArticle(g, slides[index], index, slides.length)}</div><div class="community-footer"><span class="community-status">${esc(status)}</span><div class="community-controls"><button class="community-arrow" type="button" data-community-step="-1" aria-label="Previous community highlight"${slides.length < 2 ? ' disabled' : ''}>←</button><span class="community-position" aria-live="off">${slides.length ? `${index + 1} / ${slides.length}` : '0 / 0'}</span><button class="community-arrow" type="button" data-community-step="1" aria-label="Next community highlight"${slides.length < 2 ? ' disabled' : ''}>→</button></div></div></section>`;
}
export function homeDiscovery(g) {
  return `<section class="home-discover" data-home-gesture="reveal"><div><p class="eyebrow">A little serendipity</p><h2>Your next deck<br>starts with a surprise.</h2><p>Choose your format. Discover a real build-around. Make it yours.</p><button class="home-random" data-act="homeRandomDeck"><span aria-hidden="true">✧</span> Random deck <span aria-hidden="true">↗</span></button></div><div class="home-deal" aria-hidden="true"><span></span><span></span><span>${GAME_ICON[g]}</span></div></section>`;
}
export function homeEdition(g) { return `<div class="home-editorial">${homeCommunity(g)}${homeDiscovery(g)}</div>`; }

// Refresh only the community section: async data must not replace a user's search text,
// reset scroll, steal focus, or apply a previous game's response after a swipe.
export function refreshHomeCommunity(g, root, { now = Date.now(), loadNews = loadCommunity, loadDecks = loadMeta, documentRef = globalThis.document } = {}) {
  const last = requests.get(g);
  if (last && now - last.at < (last.failed ? 5 * 60000 : DAY)) return last.promise;
  const request = { at: now, failed: false, promise: null };
  requests.set(g, request);
  const paint = () => {
    const node = root.querySelector?.(`[data-home-community="${g}"]`);
    if (!node || documentRef?.body?.dataset.view !== 'home' || documentRef?.body?.dataset.game !== g) return;
    // Do not replace the article while a user has focus in its source link.
    if (node.contains(documentRef.activeElement)) return;
    node.outerHTML = homeCommunity(g);
    const shortcut = root.querySelector?.(`[data-home-meta="${g}"]`);
    if (shortcut?.dataset?.homeMeta === g && !shortcut.contains(documentRef.activeElement)) shortcut.outerHTML = homeMetaShortcut(g);
  };
  // A slow or hung tournament source cannot hold fresh bounded news hostage.
  // Each source paints independently; neither invalidates the other's cache.
  const news = Promise.resolve().then(() => loadNews(g)).then(() => {
    request.failed ||= !!communityState(g).error; paint();
  }, () => { request.failed = true; paint(); });
  const decks = Promise.resolve().then(() => loadDecks(homeMetaKey(g))).then(paint, () => {
    request.failed = true; paint();
  });
  request.promise = Promise.allSettled([news, decks]);
  return request.promise;
}
export function attachHomeCommunity(root) {
  if (!root) return () => {};
  let gesture = null, suppressUntil = 0;
  const step = (node, delta) => {
    const g = node.dataset.homeCommunity, slides = slidesFor(g);
    if (slides.length < 2) return;
    const index = positionFor(g, slides.length) + delta;
    positions.set(g, (index + slides.length) % slides.length);
    const at = positionFor(g, slides.length);
    node.querySelector('.community-stage').innerHTML = featureArticle(g, slides[at], at, slides.length);
    node.querySelector('.community-position').textContent = `${at + 1} / ${slides.length}`;
  };
  const click = e => {
    const carousel = e.target.closest?.('[data-home-community]');
    if (!carousel) return;
    if (Date.now() < suppressUntil) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    const button = e.target.closest?.('[data-community-step]');
    if (button) step(carousel, Number(button.dataset.communityStep));
  };
  const key = e => {
    const carousel = e.target.closest?.('[data-home-community]');
    if (!carousel || !['ArrowLeft', 'ArrowRight'].includes(e.key) || e.target.closest('input,textarea,select')) return;
    e.preventDefault(); e.stopPropagation(); step(carousel, e.key === 'ArrowRight' ? 1 : -1);
  };
  const start = e => {
    gesture = null;
    const node = e.target.closest?.('[data-home-community]');
    if (!node || e.touches.length !== 1 || e.target.closest('button')) return;
    const t = e.touches[0];
    gesture = { node, x: t.clientX, y: t.clientY, time: Date.now() };
  };
  const end = e => {
    const old = gesture; gesture = null;
    if (!old || e.touches?.length || !old.node.isConnected) return;
    const t = e.changedTouches?.[0]; if (!t) return;
    const dx = t.clientX - old.x, dy = t.clientY - old.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - old.time > 800) return;
    step(old.node, dx < 0 ? 1 : -1); suppressUntil = Date.now() + 450;
  };
  const cancel = () => { gesture = null; };
  root.addEventListener('load', handleCommunityArtwork, true); root.addEventListener('error', handleCommunityArtwork, true);
  root.addEventListener('click', click, true); root.addEventListener('keydown', key);
  root.addEventListener('touchstart', start, { passive: true }); root.addEventListener('touchend', end); root.addEventListener('touchcancel', cancel);
  return () => { root.removeEventListener('load', handleCommunityArtwork, true); root.removeEventListener('error', handleCommunityArtwork, true); root.removeEventListener('click', click, true); root.removeEventListener('keydown', key); root.removeEventListener('touchstart', start); root.removeEventListener('touchend', end); root.removeEventListener('touchcancel', cancel); };
}

// Pending selection may only reveal in the exact game, route and picker that requested it.
export function isHomeRevealCurrent(origin, current) {
  return !!current.open && origin.game === current.game && origin.view === current.view && origin.sheet === current.sheet;
}
export function homeDeckReveal({ name, format, imageHtml = "" }) {
  return `<div class="sheet-head"><h2>Your build-around</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><section class="home-deck-reveal"><div class="home-reveal-fan" aria-hidden="true"><span></span><span></span><div>${imageHtml || '<span class="home-reveal-no-art">✧</span>'}</div></div><p class="eyebrow">A new direction · ${esc(format)}</p><h3>${esc(name)}</h3><p>This is your starting card, not a finished deck. Explore what the builder can make around it.</p><button class="btn block" data-act="homeBuildReveal">Build around this card</button><button class="link" data-act="randomDeckOptions" data-home="1">Try another direction</button></section>`;
}
