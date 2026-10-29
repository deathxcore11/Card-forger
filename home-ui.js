// Home presentation and isolated interactions. No collection writes or deck generation.
import { GAMES, GAME_IDS, GAME_ICON } from './games.js';
import { esc, safeHref, usd } from './ui.js';
import { communityState, communitySlides, metaDeckSlides, loadCommunity, communitySlideUrl, COMMUNITY_LINKS } from './community-feed.js';
import { loadMeta, metaState, DEFAULT_MTG_META_FORMAT } from './meta.js';
import { communityArtwork, handleCommunityArtwork } from './community-art.js';
import { S } from './store.js';
import { lastWorkedDeck } from './home-deck-activity.js';

export const homeMetaKey = g => g === 'mtg' ? `mtg:${S.ui.mtgMeta?.format || DEFAULT_MTG_META_FORMAT}` : g;
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

// Home uses the same exact-owned USD resolver as Collection. A change is a
// collection-total comparison, not investment return; inventory/manual edits count.
export const homeValueCoverage = value => ({ unpriced: value.unpriced, currency: 'USD', basis: 'exact-owned-v1' });
export function homeValueComparison(value, history = [], now = Date.now()) {
  if (!value.copies || value.unpriced !== 0 || !Number.isFinite(value.total)) return null;
  const today = new Date(now).toISOString().slice(0, 10);
  const prior = (Array.isArray(history) ? history : []).filter(point =>
    /^\d{4}-\d{2}-\d{2}$/.test(point?.date || '') && Number.isFinite(Date.parse(point.date)) &&
    new Date(point.date).toISOString().slice(0, 10) === point.date && point.date < today &&
    Number.isFinite(point.total) && point.total >= 0 && Number.isFinite(point.copies) && point.copies > 0
  ).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  // Do not skip a gap to manufacture a longer comparison. Legacy snapshots
  // without coverage/currency/basis remain available in Collection, not inferred.
  if (!prior || prior.unpriced !== 0 || prior.currency !== 'USD' || prior.basis !== 'exact-owned-v1') return null;
  const delta = Math.round((value.total - prior.total) * 100) / 100;
  return { delta, date: prior.date, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}
export function homeValueModel({ total, copies = 0, decks = 0, unpriced = 0, history = [], now }) {
  const allMissing = copies > 0 && unpriced >= copies;
  const known = Number.isFinite(total) && total >= 0 && !allMissing;
  const change = homeValueComparison({ total, copies, unpriced }, history, now);
  const amount = known ? usd(total) : '—';
  const note = !copies ? 'Ready for your first card' : allMissing || !known ? 'Value unavailable' : unpriced ? 'Known subtotal' : 'Estimated value · USD';
  const coverage = unpriced ? ` · ${Number(unpriced).toLocaleString()} unpriced` : '';
  const movement = change ? `${change.direction === 'up' ? '↑ +' : change.direction === 'down' ? '↓ −' : '↔ '}${usd(Math.abs(change.delta))} · ${change.direction === 'flat' ? 'unchanged' : 'total change'} since ${displayDate(change.date)}` : '';
  return { amount, note: note + coverage, copies: Number(copies).toLocaleString(), decks: Number(decks).toLocaleString(), movement, direction: change?.direction || '', explanation: movement ? 'Collection-total change includes copies, recorded values and available prices. Not market-only returns.' : '' };
}
export function homeValue(options) {
  const model = homeValueModel(options), game = options.game || 'mtg';
  return `<section class="home-value" data-home-value="${esc(game)}" aria-label="${esc(GAMES[game]?.short || '')} collection at a glance"><button class="home-value-main" data-act="go" data-to="${esc(options.valueRoute || '#collection/value')}"><span class="eyebrow">Your collection</span><strong data-value-amount>${model.amount}</strong><span class="home-value-note" data-value-note>${esc(model.note)}</span><span class="home-value-movement ${model.direction}" data-value-movement${model.movement ? '' : ' hidden'} title="${esc(model.explanation)}">${esc(model.movement)}</span><span class="home-sr-only" data-value-explanation>${esc(model.explanation)}</span></button><div class="home-value-counts"><button data-act="go" data-to="#collection"><b data-value-copies>${model.copies}</b><span>cards</span></button><button data-act="go" data-to="#decks"><b data-value-decks>${model.decks}</b><span>decks</span></button></div></section>`;
}
// Update leaf text only: never replace a focused button or unrelated Home UI.
export function refreshHomeValue(game, root, options, documentRef = globalThis.document) {
  if (documentRef?.body?.dataset.view !== 'home' || documentRef?.body?.dataset.game !== game) return false;
  const node = root?.querySelector?.(`[data-home-value="${game}"]`);
  if (!node || node.isConnected === false) return false;
  const model = homeValueModel(options);
  for (const field of ['amount', 'note', 'copies', 'decks', 'movement', 'explanation']) {
    const leaf = node.querySelector(`[data-value-${field}]`);
    if (leaf && leaf.textContent !== model[field]) leaf.textContent = model[field];
  }
  const movement = node.querySelector('[data-value-movement]');
  if (movement) { movement.hidden = !model.movement; movement.className = `home-value-movement ${model.direction}`; movement.title = model.explanation; }
  return true;
}

// One recent personal task, supported by a successful saved edit, never by
// array position, an import timestamp, or Magic's legacy activeDeck fallback.
const pickedDecks = new Map();
export function homeResume(game, formatName = deck => deck.format) {
  const recent = lastWorkedDeck(S.state, game), decks = (game === 'mtg' ? S.state : S.state.tcg?.[game])?.decks || [];
  // No recorded edit yet: show one of the person's own decks (picked at random once per visit), never
  // labelled as recently worked on, beside the way to choose another.
  const picked = !recent && decks.length ? decks.find(d => d.id === pickedDecks.get(game)) || decks[Math.floor(Math.random() * decks.length)] : null;
  if (picked) {
    pickedDecks.set(game, picked.id);
    const n = (game === 'mtg' ? picked.cards : picked.zones?.main || []).reduce((total, row) => total + (Number(row.qty) || 0), 0);
    const to = `#${game === 'mtg' ? 'deck' : 'tdeck'}/${encodeURIComponent(picked.id)}/cards`;
    return `<section class="home-resume home-resume-pick" data-home-resume="${game}" data-home-deck-pick="${esc(picked.id)}" aria-label="One of your decks"><div><h2>${esc(picked.name || 'Untitled deck')}</h2><p>${esc(formatName(picked) || GAMES[game].short)} · ${n} ${game === 'ygo' ? 'main-deck cards' : 'cards'}</p></div><button type="button" class="home-resume-open home-card-hit" data-act="go" data-to="${esc(to)}" aria-label="Open ${esc(picked.name || 'deck')}"></button></section>`;
  }
  if (!recent) return `<section class="home-resume home-resume-empty" data-home-resume="${game}" aria-label="Resume a deck"><div><p>${decks.length ? 'Choose a deck to pick up where you left off.' : 'No saved decks yet.'}</p></div><button type="button" class="link" data-act="go" data-to="#decks">${decks.length ? 'Choose a deck' : 'Open Decks'}</button></section>`;
  const { deck, at } = recent, count = (game === 'mtg' ? deck.cards : deck.zones?.main || []).reduce((total, row) => total + (Number(row.qty) || 0), 0);
  const route = `#${game === 'mtg' ? 'deck' : 'tdeck'}/${encodeURIComponent(deck.id)}/cards`;
  return `<section class="home-resume" data-home-resume="${game}" data-resume-deck="${esc(deck.id)}" aria-label="Resume your last-worked deck"><div><p class="eyebrow">Last worked on</p><h2>${esc(deck.name)}</h2><p>${esc(formatName(deck) || GAMES[game].short)} · ${count} ${game === 'ygo' ? 'main-deck cards' : 'cards'} · Edited <time datetime="${esc(at)}">${esc(displayDate(at))}</time></p></div><button type="button" class="home-resume-open home-card-hit" data-act="go" data-to="${esc(route)}" aria-label="Resume ${esc(deck.name)}"></button></section>`;
}

// A few real personal decks, without running Power, construction or provider
// lookups to paint Home. Keep the existing honest recent-work/resume contract.
export function homeDeckShelf(game, describe = deck => ({ format: deck.format })) {
  const decks = (game === 'mtg' ? S.state : S.state.tcg?.[game])?.decks || [];
  const resume = homeResume(game, deck => describe(deck).format);
  const selectedId = lastWorkedDeck(S.state, game)?.deck.id || pickedDecks.get(game);
  const selected = decks.find(deck => deck.id === selectedId);
  const art = deck => describe(deck).artHTML || '';
  const lead = selected ? `<div class="home-personal-deck home-personal-resume" data-home-personal-deck="${esc(selected.id)}"><span class="home-personal-art" aria-hidden="true">${art(selected)}</span>${resume}</div>` : resume;
  const others = decks.filter(deck => deck.id !== selectedId).slice(0, 2).map(deck => {
    const info = describe(deck), rows = game === 'mtg' ? deck.cards : deck.zones?.main;
    const count = (rows || []).reduce((n, row) => n + (Number(row.qty) || 0), 0);
    const route = `#${game === 'mtg' ? 'deck' : 'tdeck'}/${encodeURIComponent(deck.id)}/cards`;
    return `<button type="button" class="home-personal-deck" data-home-personal-deck="${esc(deck.id)}" data-act="go" data-to="${esc(route)}"><span class="home-personal-art" aria-hidden="true">${art(deck)}</span><span class="home-personal-copy"><b>${esc(deck.name || 'Untitled deck')}</b><small>${esc(info.format || GAMES[game].short)} · ${count} ${game === 'ygo' ? 'main-deck cards' : 'cards'}</small></span></button>`;
  }).join('');
  return `<section class="home-saved-decks" data-home-decks="${game}" aria-label="Your saved decks"><div class="home-shelf-heading"><h2>Your decks</h2><button class="link small" data-act="go" data-to="#decks">All decks</button></div><div class="home-personal-grid">${lead}${others}</div></section>`;
}

export function displayDate(value) {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', ...(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? { timeZone: 'UTC' } : {}) }) : '';
}
export function featureArticle(g, slide, index, length) {
  if (!slide) return `<article class="community-feature community-empty feature-text-only"><div class="community-feature-copy"><h3>No live stories right now.</h3><p class="community-summary">News sources are temporarily unavailable. Your collection and decks are still here.</p></div></article>`;
  const kind = ['deck', 'event', 'news', 'link'].includes(slide.kind) ? slide.kind : 'link';
  const label = { deck: 'Community deck', event: 'Event', news: 'News', link: 'Source directory' }[kind];
  const date = displayDate(slide.publishedAt), fetched = displayDate(slide.fetchedAt), starts = displayDate(slide.startsAt), ends = displayDate(slide.endsAt);
  const dateHtml = kind === 'event' && starts ? `<span>Event dates <time datetime="${esc(slide.startsAt)}">${esc(starts)}</time>${ends && ends !== starts ? ` to <time datetime="${esc(slide.endsAt)}">${esc(ends)}</time>` : ''}</span>` : date ? `<span>${esc(slide.dateLabel || 'Published')} <time datetime="${esc(slide.publishedAt)}">${esc(date)}</time></span>` : `<span>${kind === 'event' ? 'Event date' : 'Publication date'} unavailable</span>`;
  const href = communitySlideUrl(g, slide), art = communityArtwork(g, slide), title = slide.title || 'Visit the source';
  const action = kind === 'deck' ? 'View original deck' : kind === 'event' ? 'View event' : kind === 'news' ? 'Read at source' : 'Open source';
  // Publisher headlines are never rewritten into promotional copy. Context and
  // check dates remain available without competing with the source/date line.
  // Older cached feeds have a source summary but no weekly editorial brief.
  // Reuse that supplied text, never invent analysis or hide all useful context.
  const briefSource = [slide.whyItMatters, slide.summary].find(value => typeof value === 'string' && value.trim())?.trim() || '';
  const brief = briefSource.length > 180 ? briefSource.slice(0,177).replace(/\s+\S*$/, '') + '…' : briefSource;
  const context = [slide.summary, slide.methodology, slide.editorial === 'ai-assisted' ? 'AI-assisted summary of the linked source. Original headline, dates and publisher are preserved.' : ''].filter(Boolean).map(text => `<p>${esc(text)}</p>`).join('');
  return `<article class="community-feature feature-${kind}${!art ? ' feature-text-only' : ''}" role="group" aria-label="${index + 1} of ${length}" data-slide-id="${esc(slide.id || '')}">${art}<div class="community-feature-copy"><p class="eyebrow community-pills"><span class="chip">${esc(slide.category || label)}</span>${slide.scope ? `<span class="chip">${esc(slide.scope)}</span>` : ''}${slide.stale ? '<span class="chip">Older snapshot</span>' : ''}</p><h3>${href && href !== '#' ? `<a class="community-open" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(title)}. ${action} (opens in a new tab)">${esc(title)}</a>` : esc(title)}</h3>${brief ? `<p class="community-summary">${esc(brief)}</p>` : ''}<div class="community-source"><span>${esc(slide.source || 'Source')}</span>${kind === 'link' ? '<span>Source link · not a live headline</span>' : dateHtml}</div>${context || kind !== 'link' && fetched ? `<details class="community-context"><summary>Source details</summary>${context}${kind !== 'link' && fetched ? `<p>Checked ${esc(fetched)}</p>` : ''}</details>` : ''}${!href || href === '#' ? '<p class="small muted">Source link unavailable.</p>' : ''}</div></article>`;
}
// Deck discovery has its own exact-list rail; news/events should not repeat it.
function slidesFor(g) { return communitySlides(g, { metaState: metaState(homeMetaKey(g)), metaKey: homeMetaKey(g), format: g === 'mtg' ? homeMetaKey(g).slice(4) : undefined }).filter(slide => slide.kind !== 'deck' && slide.kind !== 'link' && slide.category !== 'decks').sort((a, b) => Number(a.kind === 'link') - Number(b.kind === 'link')); }
const metaPositions = new Map();
// At most one rendered snapshot per game. A focused visible list remains an
// exact action even after the provider atomically replaces its cache. Never put
// retained rows back into that cache or silently resolve the key in newer data.
const renderedMeta = new Map();
let renderedMetaId = 0;
function captureHomeMeta(game, slide) {
  if (!slide) { renderedMeta.delete(game); return ''; }
  const data = metaState(slide.metaKey).data, deck = data?.decks?.find(d => d.key === slide.deckKey);
  if (!deck) return '';
  const token = String(++renderedMetaId);
  // Preserve the original dataset/list membership and verified source URL.
  const snapshot = { ...data, decks: data.decks.slice() };
  const exact = { ...deck, url: slide.url };
  snapshot.decks = snapshot.decks.map(d => d === deck ? exact : d);
  renderedMeta.set(game, { token, game, metaKey: slide.metaKey, deck: exact, data: snapshot });
  return token;
}
export function homeMetaSnapshot(target, game, documentRef = globalThis.document) {
  const saved = renderedMeta.get(game), node = target?.closest?.('[data-home-meta]');
  if (!saved || target?.isConnected === false || node?.isConnected === false || node?.dataset.homeMeta !== game ||
      documentRef?.body?.dataset.view !== 'home' || documentRef?.body?.dataset.game !== game ||
      saved.metaKey !== homeMetaKey(game) || target.dataset.homeMetaOpen !== saved.token ||
      target.dataset.key !== saved.deck.key || (game === 'mtg' && target.dataset.format !== saved.metaKey.slice(4))) return null;
  return saved;
}
function releaseHomeMeta(node) {
  const game = node?.dataset.homeMeta, token = node?.querySelector?.('[data-home-meta-open]')?.dataset?.homeMetaOpen;
  if (token && renderedMeta.get(game)?.token === token) renderedMeta.delete(game);
}
function metaSelection(game, slides) {
  const old = metaPositions.get(game) || { index: 0, signature: '', paused: false };
  const signature = JSON.stringify(slides);
  if (old.signature !== signature) { old.signature = signature; old.index = 0; }
  old.index = slides.length ? old.index % slides.length : 0;
  metaPositions.set(game, old);
  return old;
}
export function homeMetaSlides(game) {
  const key = homeMetaKey(game);
  return metaDeckSlides(game, metaState(key), key, Date.now(), 6);
}
function homeMetaEmptyState(game) {
  const state = metaState(homeMetaKey(game));
  // The first Home render precedes its scheduled request. No data yet is not
  // evidence of an empty result, even before the loader has marked itself busy.
  if (state.busy || (!state.data && !state.error)) return 'loading';
  return state.error ? 'unavailable' : 'empty';
}
export function homeMetaArticle(game, slide, index, count) {
  if (!slide) {
    captureHomeMeta(game, null);
    const state = homeMetaEmptyState(game), [title, note] = {
      loading: ['Loading tournament lists…', 'Checking the current sources.'],
      unavailable: ['Tournament lists are unavailable right now.', 'Open Meta decks to check the sources or try again.'],
      empty: ['No verified tournament lists to show.', 'Open Meta decks to explore the available source results.'],
    }[state];
    return `<article class="home-meta-card home-meta-empty" data-meta-state="${state}"><div class="home-meta-copy"><h3><span role="status">${esc(title)}</span></h3><p>${esc(note)}</p><button class="link" data-act="go" data-to="#decks/inspiration">Explore Meta decks →</button></div>${communityArtwork(game, { kind: 'deck' })}</article>`;
  }
  const date = displayDate(slide.publishedAt), checked = displayDate(slide.fetchedAt);
  const format = game === 'mtg' ? slide.metaKey.slice(4) : game === 'ptcg' ? 'Standard' : 'TCG';
  const action = game === 'mtg' ? 'mtgProven' : 'tMetaDeck', token = captureHomeMeta(game, slide);
  return `<article class="home-meta-card" role="group" aria-roledescription="slide" aria-label="${index + 1} of ${count}" data-meta-deck="${esc(slide.deckKey)}" data-meta-key="${esc(slide.metaKey)}"><div class="home-meta-copy"><span class="eyebrow">Top Meta · ${esc(format)}${slide.stale ? ' · Older snapshot' : ' · Published list'}</span><h3><button class="home-meta-open" data-act="${action}" data-key="${esc(slide.deckKey)}" data-format="${esc(format)}" data-home-meta-open="${token}">${esc(slide.title)}</button></h3>${slide.summary ? `<p class="home-meta-result">${esc(slide.summary)}</p>` : ''}<p class="home-meta-source">${esc(slide.source || 'Tournament source')} · ${date ? `${esc(slide.dateLabel)} <time datetime="${esc(slide.publishedAt)}">${esc(date)}</time>` : 'List date unavailable'}${checked ? ` · Checked ${esc(checked)}` : ''}</p><p class="home-meta-method">${esc(slide.curation || slide.methodology)}</p><span class="home-sr-only">${esc(slide.artwork ? `Featured deck: ${slide.title}, via ${slide.source}. Card preview: ${slide.artwork.cardId}.` : `Featured deck: ${slide.title}, via ${slide.source}. Verified deck artwork unavailable.`)}</span><a class="home-meta-original" href="${esc(safeHref(slide.url))}" target="_blank" rel="noopener noreferrer">Original source<span class="home-sr-only"> (opens in a new tab)</span></a></div>${communityArtwork(game, slide)}</article>`;
}
export function homeMetaCarousel(game) {
  const slides = homeMetaSlides(game), state = metaSelection(game, slides), disabled = slides.length < 2;
  return `<section class="home-meta" data-home-meta="${game}" data-home-discovery="${game}" data-home-gesture="carousel" role="region" aria-roledescription="carousel" aria-label="${esc(GAMES[game].short)} deck discovery"><div class="home-meta-heading"><h2>Community Meta decks</h2><button class="link small" data-act="go" data-to="#decks/inspiration">All Meta decks</button></div><div class="home-meta-stage" aria-live="off" aria-atomic="true">${homeMetaArticle(game, slides[state.index], state.index, slides.length)}</div><div class="home-meta-footer"><div class="home-meta-controls"><button type="button" data-meta-toggle aria-label="${state.paused ? 'Resume' : 'Pause'} automatic Meta slides" aria-pressed="${state.paused}"${disabled ? ' disabled' : ''}>${state.paused ? 'Resume' : 'Pause'}</button><button type="button" data-meta-step="-1" aria-label="Previous Meta deck"${disabled ? ' disabled' : ''}>←</button><span data-meta-position>${slides.length ? `${state.index + 1} / ${slides.length}` : '0 / 0'}</span><button type="button" data-meta-step="1" aria-label="Next Meta deck"${disabled ? ' disabled' : ''}>→</button></div></div></section>`;
}
// Kept as an alias for callers that used the previous shortcut.
export const homeMetaShortcut = homeMetaCarousel;
export function refreshHomeMeta(game, node, documentRef = globalThis.document) {
  if (!node || node.isConnected === false || node.dataset?.homeMeta !== game) return false;
  const stage = node.querySelector?.('.home-meta-stage');
  if (!stage || stage.contains(documentRef?.activeElement)) return false;
  const slides = homeMetaSlides(game), state = metaSelection(game, slides);
  const signature = `${state.index}:${state.signature}:${slides.length ? 'ready' : homeMetaEmptyState(game)}`;
  if (node.homeMetaSignature !== signature) {
    stage.innerHTML = homeMetaArticle(game, slides[state.index], state.index, slides.length);
    node.homeMetaSignature = signature;
    node.querySelector('[data-meta-position]').textContent = slides.length ? `${state.index + 1} / ${slides.length}` : '0 / 0';
  }
  for (const control of node.querySelectorAll('[data-meta-step], [data-meta-toggle]')) { const unavailable = slides.length < 2; control.disabled = unavailable && control !== documentRef?.activeElement; control.setAttribute?.('aria-disabled', String(unavailable)); }
  return true;
}

// One timer for the mounted carousel, never an offscreen game. Focus/interaction
// stops automatic rotation until explicit resume; hover/background pause temporarily.
export function attachHomeMeta(root, { documentRef = globalThis.document, view = globalThis, interval = 8000 } = {}) {
  if (!root) return () => {};
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let timer = null, mounted = null, hovered = false, gesture = null, suppressUntil = 0, disposed = false;
  const clear = () => { if (timer !== null) view.clearTimeout(timer); timer = null; };
  const nodeFor = target => target?.closest?.('[data-home-meta]');
  const sync = () => {
    if (disposed) return;
    const node = root.querySelector?.('[data-home-meta]');
    if (node !== mounted) { clear(); releaseHomeMeta(mounted); mounted = node; hovered = false; }
    if (!node || node.isConnected === false || documentRef?.body?.dataset.view !== 'home' || documentRef?.body?.dataset.game !== node.dataset.homeMeta) { clear(); return; }
    const game = node.dataset.homeMeta, slides = homeMetaSlides(game), state = metaSelection(game, slides);
    refreshHomeMeta(game, node, documentRef);
    const focused = node.contains(documentRef.activeElement), stopped = state.paused || !!motion?.matches;
    const toggle = node.querySelector('[data-meta-toggle]');
    const text = motion?.matches ? 'Motion paused' : state.paused ? 'Resume' : 'Pause';
    if (toggle.textContent !== text) toggle.textContent = text;
    toggle.setAttribute('aria-label', motion?.matches ? 'Automatic Meta slides paused for reduced motion' : `${state.paused ? 'Resume' : 'Pause'} automatic Meta slides`);
    toggle.setAttribute('aria-pressed', String(stopped)); const unavailable = slides.length < 2 || !!motion?.matches; toggle.disabled = unavailable && toggle !== documentRef.activeElement; toggle.setAttribute('aria-disabled', String(unavailable));
    node.querySelector('.home-meta-stage').setAttribute('aria-live', stopped || focused || hovered || documentRef.hidden ? 'polite' : 'off');
    if (slides.length < 2 || stopped || focused || hovered || documentRef.hidden) { clear(); return; }
    if (timer === null) timer = view.setTimeout(() => {
      timer = null;
      if (!disposed && mounted === node && node.isConnected !== false && !documentRef.hidden && !node.contains(documentRef.activeElement) && !motion?.matches && !hovered && !state.paused) state.index = (state.index + 1) % slides.length;
      sync();
    }, interval);
  };
  const pause = node => { if (node) metaSelection(node.dataset.homeMeta, homeMetaSlides(node.dataset.homeMeta)).paused = true; clear(); };
  const step = (node, delta) => { const slides = homeMetaSlides(node.dataset.homeMeta), state = metaSelection(node.dataset.homeMeta, slides); pause(node); if (slides.length) state.index = (state.index + delta + slides.length) % slides.length; sync(); };
  const click = event => {
    const node = nodeFor(event.target); if (!node) return;
    if (Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const toggle = event.target.closest?.('[data-meta-toggle]'), arrow = event.target.closest?.('[data-meta-step]');
    if (toggle) { if (motion?.matches || homeMetaSlides(node.dataset.homeMeta).length < 2) return; const state = metaSelection(node.dataset.homeMeta, homeMetaSlides(node.dataset.homeMeta)); state.paused = !state.paused; sync(); }
    else if (arrow) step(node, Number(arrow.dataset.metaStep));
    else pause(node);
  };
  const key = event => { const node = nodeFor(event.target); if (!node || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); step(node, event.key === 'ArrowRight' ? 1 : -1); };
  const focus = event => { if (nodeFor(event.target)) { if (!event.target.closest?.('[data-meta-toggle]')) pause(nodeFor(event.target)); sync(); } };
  const blur = () => { view.setTimeout(sync, 0); };
  const over = event => { const node = nodeFor(event.target); if (node && !node.contains(event.relatedTarget)) { hovered = true; sync(); } };
  const out = event => { const node = nodeFor(event.target); if (node && !node.contains(event.relatedTarget)) { hovered = false; sync(); } };
  const start = event => { const node = nodeFor(event.target); gesture = null; if (!node) return; pause(node); sync(); if (event.touches?.length === 1 && !event.target.closest('button')) { const t = event.touches[0]; gesture = { node, x: t.clientX, y: t.clientY, at: Date.now() }; } };
  const end = event => { const old = gesture; gesture = null; const t = event.changedTouches?.[0]; if (!old || !t || event.touches?.length || old.node.isConnected === false) return; const dx = t.clientX - old.x, dy = t.clientY - old.y; if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - old.at < 800) { step(old.node, dx < 0 ? 1 : -1); suppressUntil = Date.now() + 450; } };
  const cancel = () => { gesture = null; };
  const handlers = { click, keydown: key, focusin: focus, focusout: blur, mouseover: over, mouseout: out, touchstart: start, touchend: end, touchcancel: cancel };
  for (const [event, handler] of Object.entries(handlers)) root.addEventListener(event, handler, event === 'click' ? true : event === 'touchstart' ? { passive: true } : false);
  documentRef?.addEventListener?.('visibilitychange', sync); motion?.addEventListener?.('change', sync);
  const observer = view.MutationObserver ? new view.MutationObserver(sync) : null;
  observer?.observe(root, { childList: true, subtree: true }); sync();
  return () => { disposed = true; clear(); releaseHomeMeta(mounted); observer?.disconnect(); documentRef?.removeEventListener?.('visibilitychange', sync); motion?.removeEventListener?.('change', sync); for (const [event, handler] of Object.entries(handlers)) root.removeEventListener(event, handler, event === 'click'); };
}
function positionFor(g, count) { return count ? ((positions.get(g) || 0) % count + count) % count : 0; }
const COMMUNITY_PAGE_SIZE = 3;
export function communityPage(g, slides = slidesFor(g)) {
  const pages = Math.ceil(slides.length / COMMUNITY_PAGE_SIZE), index = positionFor(g, pages), start = index * COMMUNITY_PAGE_SIZE;
  return { pages, index, start, slides: slides.slice(start, start + COMMUNITY_PAGE_SIZE), total: slides.length,
    position: slides.length ? `${start + 1}–${Math.min(start + COMMUNITY_PAGE_SIZE, slides.length)} / ${slides.length}` : '0 / 0' };
}
function communityPageHtml(g, page) {
  return page.slides.length ? page.slides.map((slide, i) => featureArticle(g, slide, page.start + i, page.total)).join('') : featureArticle(g, null, 0, 0);
}
export function homeCommunity(g) {
  const page = communityPage(g), state = communityState(g), directory = COMMUNITY_LINKS[g];
  const status = state.busy && !state.data ? 'Checking sources…' : (state.error || state.data?.error || state.data?.status === 'unavailable') ? 'Some sources unavailable · verified stories shown where available' : state.data?.cadence === 'weekly' ? `Shared weekly edition${state.data?.curatedAt ? ' · ' + displayDate(state.data.curatedAt) : ''}` : 'Checked daily · recent stories';
  return `<section class="home-community" data-home-community="${g}" data-home-gesture="carousel" role="region" aria-roledescription="carousel" aria-label="${esc(GAMES[g].short)} news and events"><div class="section-head"><h2>News</h2><span class="community-heading-note">${esc(GAMES[g].short)}</span></div><div class="community-stage" aria-live="polite" aria-atomic="true">${communityPageHtml(g, page)}</div><nav class="community-source-links" aria-label="News and event sources"><a href="${esc(directory.news)}" target="_blank" rel="noopener noreferrer">News source</a><a href="${esc(directory.events)}" target="_blank" rel="noopener noreferrer">Find events</a></nav><div class="community-footer"><span class="community-status">${esc(status)}</span><div class="community-controls"><button class="community-arrow" type="button" data-community-step="-1" aria-label="Previous news page"${page.pages < 2 ? ' disabled' : ''}>←</button><span class="community-position" aria-live="off">${page.position}</span><button class="community-arrow" type="button" data-community-step="1" aria-label="Next news page"${page.pages < 2 ? ' disabled' : ''}>→</button></div></div></section>`;
}
// Compatibility entrypoint, now the single shared discovery composition.
export const homeDiscovery = homeMetaCarousel;
export function homeEdition(g) { return `<div class="home-editorial">${homeCommunity(g)}</div>`; }

// Refresh only the community section: async data must not replace a user's search text,
// reset scroll, steal focus, or apply a previous game's response after a swipe.
export function refreshHomeCommunity(g, root, { now = Date.now(), loadNews = loadCommunity, loadDecks = loadMeta, documentRef = globalThis.document } = {}) {
  const deckKey = homeMetaKey(g), requestKey = `${g}:${deckKey}`;
  let originCommunity = root.querySelector?.(`[data-home-community="${g}"]`);
  const originMeta = root.querySelector?.(`[data-home-meta="${g}"]`);
  const paint = (metaOnly = false) => {
    if (documentRef?.body?.dataset.view !== 'home' || documentRef?.body?.dataset.game !== g || homeMetaKey(g) !== deckKey) return false;
    const node = root.querySelector?.(`[data-home-community="${g}"]`);
    const carousel = root.querySelector?.(`[data-home-meta="${g}"]`);
    const sameCommunity = node && node === originCommunity && node.isConnected !== false;
    const sameMeta = carousel && carousel === originMeta && carousel.isConnected !== false;
    if (!metaOnly && sameCommunity && !node.contains(documentRef.activeElement)) { node.outerHTML = homeCommunity(g); originCommunity = root.querySelector?.(`[data-home-community="${g}"]`); }
    if (sameMeta) refreshHomeMeta(g, carousel, documentRef);
    return !!(sameCommunity || sameMeta);
  };
  const last = requests.get(requestKey);
  if (last && (last.pending || now - last.at < (last.failed ? 5 * 60000 : DAY))) {
    // Re-entering Home subscribes the new mount to the same bounded request.
    // One subscription per application root replaces, not accumulates, old mounts.
    if (last.pending) last.mounts.set(root, paint);
    return last.promise;
  }
  const request = { at: now, failed: false, pending: true, promise: null, mounts: new Map([[root, paint]]) };
  requests.set(requestKey, request);
  const publish = (metaOnly = false) => { for (const [mount, update] of request.mounts) if (!update(metaOnly)) request.mounts.delete(mount); };
  // A slow tournament source cannot hold fresh news hostage. Each completion
  // notifies the latest eligible mount; leaving cancels only its paint, not the
  // shared provider request or daily cache/backoff policy.
  const news = Promise.resolve().then(() => loadNews(g)).then(() => {
    request.failed ||= !!communityState(g).error; publish();
  }, () => { request.failed = true; publish(); });
  const decks = Promise.resolve().then(() => {
    const pending = loadDecks(deckKey);
    // Show a retry/empty-cache refresh immediately without replacing news.
    if (metaState(deckKey).busy) publish(true);
    return pending;
  }).then(() => {
    // Cached-data fallback resolves normally but still records a failed check.
    request.failed ||= !!metaState(deckKey).error; publish();
  }, () => {
    request.failed = true; publish();
  });
  request.promise = Promise.allSettled([news, decks]).finally(() => { request.pending = false; request.mounts.clear(); });
  return request.promise;
}
export function attachHomeCommunity(root) {
  if (!root) return () => {};
  const cleanupMeta = attachHomeMeta(root);
  let gesture = null, suppressUntil = 0;
  const step = (node, delta) => {
    const g = node.dataset.homeCommunity, slides = slidesFor(g), current = communityPage(g, slides);
    if (current.pages < 2) return;
    const stage = node.querySelector('.community-stage');
    const focusInPage = stage.contains?.(globalThis.document?.activeElement);
    positions.set(g, (current.index + delta + current.pages) % current.pages);
    const page = communityPage(g, slides);
    stage.innerHTML = communityPageHtml(g, page);
    node.querySelector('.community-position').textContent = page.position;
    // Keyboard pagination from a story must not strand focus on a detached link.
    if (focusInPage) stage.querySelector?.('.community-open')?.focus({ preventScroll: true });
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
  return () => { cleanupMeta(); root.removeEventListener('load', handleCommunityArtwork, true); root.removeEventListener('error', handleCommunityArtwork, true); root.removeEventListener('click', click, true); root.removeEventListener('keydown', key); root.removeEventListener('touchstart', start); root.removeEventListener('touchend', end); root.removeEventListener('touchcancel', cancel); };
}

// Pending selection may only reveal in the exact game, route and picker that requested it.
export function isHomeRevealCurrent(origin, current) {
  return !!current.open && origin.game === current.game && origin.view === current.view && origin.sheet === current.sheet;
}
export function homeDeckReveal({ name, format, imageHtml = "" }) {
  return `<div class="sheet-head"><h2>Your build-around</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><section class="home-deck-reveal"><div class="home-reveal-fan" aria-hidden="true"><span></span><span></span><div>${imageHtml || '<span class="home-reveal-no-art">✧</span>'}</div></div><p class="eyebrow">A new direction · ${esc(format)}</p><h3>${esc(name)}</h3><p>This is your starting card, not a finished deck. Explore what the builder can make around it.</p><button class="btn block" data-act="homeBuildReveal">Build around this card</button><button class="link" data-act="randomDeckOptions" data-home="1">Try another direction</button></section>`;
}
