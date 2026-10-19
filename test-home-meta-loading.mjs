// Pure Node state/async regressions. All provider calls use in-process fixtures.
import assert from 'node:assert/strict';
import { S } from './store.js';
import { metaState, loadMeta } from './meta.js';
import { communityState } from './community-feed.js';
import { homeMetaArticle, homeMetaCarousel, homeMetaSlides, homeMetaKey, refreshHomeMeta, refreshHomeCommunity } from './home-ui.js';

const games = ['mtg', 'ygo', 'ptcg'], now = Date.now(), DAY = 86400000;
const savedFormat = S.ui.mtgMeta, savedFetch = globalThis.fetch, savedStorage = globalThis.localStorage;
const savedStates = new Map(), savedNews = new Map(), storage = new Map();
let epoch = Date.parse('2100-01-01T00:00:00Z'), unexpectedNetwork = 0;
globalThis.fetch = () => { unexpectedNetwork++; throw Error('No live provider requests allowed'); };
globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
S.ui.mtgMeta = { format: 'Modern' };
const reset = (game, patch = {}) => {
  const key = homeMetaKey(game), state = metaState(key);
  if (!savedStates.has(key)) savedStates.set(key, { ...state });
  if (!savedNews.has(game)) savedNews.set(game, { ...communityState(game) });
  communityState(game).error = '';
  return Object.assign(state, { data: null, at: 0, busy: false, error: '', promise: null }, patch);
};
const deck = (game, key = 'saved') => ({ key: `${game}:${key}`, name: `${game} ${key} list`, date: '2026-10-01',
  url: game === 'mtg' ? `https://www.mtgo.com/decklist/${key}` : game === 'ygo' ? `https://ygoprodeck.com/deck/${key}` : `https://play.limitlesstcg.com/tournament/test/player/${key}/decklist` });
const data = (game, key = 'saved') => ({ source: 'Fixture tournament source', fetchedAt: new Date(now).toISOString(), decks: [deck(game, key)] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const mount = game => {
  const state = { writes: 0, newsWrites: 0, focused: false };
  let html = homeMetaArticle(game, homeMetaSlides(game)[0], 0, homeMetaSlides(game).length);
  state.stage = { contains: () => state.focused, get innerHTML() { return html; }, set innerHTML(value) { state.writes++; html = value; } };
  state.position = { textContent: '' };
  state.controls = Array.from({ length: 3 }, () => ({ disabled: false, setAttribute() {} }));
  state.meta = { dataset: { homeMeta: game }, isConnected: true, querySelector: selector => selector === '.home-meta-stage' ? state.stage : state.position, querySelectorAll: () => state.controls };
  state.community = { isConnected: true, contains: () => false, set outerHTML(value) { state.newsWrites++; state.newsHtml = value; } };
  state.root = { querySelector: selector => selector.includes('data-home-community=') ? state.community : selector.includes('data-home-meta=') ? state.meta : null };
  state.documentRef = { body: { dataset: { view: 'home', game } }, activeElement: null };
  state.refresh = () => refreshHomeMeta(game, state.meta, state.documentRef);
  return state;
};
const phase = (fixture, expected) => assert.match(fixture.stage.innerHTML, new RegExp(`data-meta-state="${expected}"`));

try {
  for (const game of games) {
    const M = reset(game), html = homeMetaCarousel(game), fixture = mount(game);
    assert.match(html, /data-meta-state="loading"/);
    assert.match(html, /Loading tournament lists/);
    assert.doesNotMatch(html, /No tournament lists available|data-meta-state="empty"|unavailable right now/);
    assert.equal((html.match(/ disabled/g) || []).length, 3, 'no-slide carousel controls stay disabled');
    fixture.refresh(); const initialWrites = fixture.writes;
    M.busy = true; fixture.refresh(); assert.equal(fixture.writes, initialWrites, 'virgin and pending share the same honest loading state');
    Object.assign(M, { busy: false, data: { decks: [] }, at: now });
    fixture.refresh(); phase(fixture, 'empty');
    assert.match(fixture.stage.innerHTML, /No verified tournament lists to show/);
    const emptyWrites = fixture.writes; fixture.refresh(); assert.equal(fixture.writes, emptyWrites, 'settled empty repaint is idempotent');
    M.error = 'Fixture outage'; fixture.refresh(); phase(fixture, 'unavailable');
    assert.equal(fixture.writes, emptyWrites + 1, 'empty-to-error repaints even with identical [] slides');
    Object.assign(M, { busy: true, error: '' }); fixture.refresh(); phase(fixture, 'loading');
    Object.assign(M, { busy: false, data: { decks: [{ ...deck(game), url: 'https://untrusted.invalid/list' }] } });
    fixture.refresh(); phase(fixture, 'empty');
    assert.doesNotMatch(fixture.stage.innerHTML, /data-meta-deck=|untrusted.invalid/, 'filtered-out rows are not fabricated into slides');
    fixture.focused = true; M.error = 'Fixture outage'; const focusedWrites = fixture.writes;
    assert.equal(fixture.refresh(), false); assert.equal(fixture.writes, focusedWrites, 'state-only updates cannot replace a focused action');
    fixture.focused = false; fixture.refresh(); phase(fixture, 'unavailable');

    const cached = { ...data(game), fetchedAt: new Date(now - 13 * 3600000).toISOString() };
    Object.assign(M, { data: cached, at: now - 13 * 3600000, busy: false, error: '' });
    fixture.refresh(); assert.match(fixture.stage.innerHTML, /Older snapshot/);
    const cachedHtml = fixture.stage.innerHTML, cachedWrites = fixture.writes;
    M.busy = true; fixture.refresh(); assert.equal(fixture.writes, cachedWrites, 'refresh does not replace a useful unchanged stale slide');
    Object.assign(M, { busy: false, error: 'Fixture outage' }); fixture.refresh();
    assert.equal(fixture.stage.innerHTML, cachedHtml); assert.equal(M.data, cached, 'failure retains original rows and exact checked date');
    Object.assign(M, { data: data(game, 'new'), at: now, error: '' }); fixture.refresh();
    assert.match(fixture.stage.innerHTML, /data-meta-deck="[^"]+:new"/);
    assert.doesNotMatch(fixture.stage.innerHTML, /Older snapshot|data-meta-state=/);
    M.data.stale = true; fixture.refresh(); assert.match(fixture.stage.innerHTML, /Older snapshot/, 'provider stale remains explicit even with a recent device timestamp');
  }

  for (const game of games) for (const outcome of ['empty', 'unavailable', 'populated']) {
    const M = reset(game, { error: 'Previous attempt failed' }), fixture = mount(game), news = deferred(), decks = deferred();
    fixture.refresh(); phase(fixture, 'unavailable');
    const identity = { root: fixture.root, meta: fixture.meta, stage: fixture.stage, search: { value: 'Keep my search' } };
    fixture.documentRef.activeElement = identity.search;
    let calls = 0;
    const options = { now: epoch += DAY, documentRef: fixture.documentRef, loadNews: () => news.promise, loadDecks: () => {
      calls++; M.busy = true; M.error = '';
      return decks.promise.then(value => { M.data = value; M.at = now; }, error => { M.error = error.message; throw error; }).finally(() => { M.busy = false; });
    } };
    const pending = refreshHomeCommunity(game, fixture.root, options);
    await Promise.resolve();
    phase(fixture, 'loading'); assert.equal(fixture.newsWrites, 0, 'starting Meta does not replace the unrelated news section');
    assert.equal(refreshHomeCommunity(game, fixture.root, options), pending); assert.equal(calls, 1);
    news.resolve(); await settle(); phase(fixture, 'loading'); assert.ok(fixture.newsWrites, 'news completes independently of slow decks');
    if (outcome === 'unavailable') decks.reject(Error('Fixture source offline'));
    else decks.resolve(outcome === 'empty' ? { decks: [] } : data(game, 'arriving'));
    await pending;
    if (outcome === 'populated') assert.match(fixture.stage.innerHTML, /data-meta-deck="[^"]+:arriving"/);
    else phase(fixture, outcome);
    assert.equal(fixture.root, identity.root); assert.equal(fixture.meta, identity.meta); assert.equal(fixture.stage, identity.stage);
    assert.equal(fixture.documentRef.activeElement, identity.search); assert.equal(identity.search.value, 'Keep my search');
    assert.equal(calls, 1);
  }

  for (const cancellation of ['unmount', 'game', 'format', 'route']) {
    S.ui.mtgMeta = { format: 'Modern' };
    const M = reset('mtg'), fixture = mount('mtg'), decks = deferred();
    const pending = refreshHomeCommunity('mtg', fixture.root, { now: epoch += DAY, documentRef: fixture.documentRef, loadNews: async () => {}, loadDecks: () => {
      M.busy = true; return decks.promise.then(value => { M.data = value; }).finally(() => { M.busy = false; });
    } });
    await settle(); phase(fixture, 'loading'); const writes = fixture.writes, newsWrites = fixture.newsWrites;
    if (cancellation === 'unmount') { fixture.meta.isConnected = false; fixture.community.isConnected = false; }
    else if (cancellation === 'game') fixture.documentRef.body.dataset.game = 'ygo';
    else if (cancellation === 'format') S.ui.mtgMeta = { format: 'Pioneer' };
    else fixture.documentRef.body.dataset.view = 'collection';
    decks.resolve({ decks: [] }); await pending;
    assert.equal(fixture.writes, writes, `${cancellation}: stale completion cannot replace the loading stage`);
    assert.equal(fixture.newsWrites, newsWrites, `${cancellation}: stale completion cannot replace news`);
  }

  // Exercise the real loader: cached fallback resolves, but M.error must select
  // the existing failed-request backoff rather than the daily success backoff.
  S.ui.mtgMeta = { format: 'Modern' };
  const cached = data('mtg'), M = reset('mtg', { data: cached, at: 1 }), fixture = mount('mtg');
  let providerCalls = 0, succeeds = false;
  globalThis.fetch = async () => { providerCalls++; if (!succeeds) throw Error('Fixture offline'); return { ok: true, json: async () => data('mtg', 'recovered') }; };
  const started = epoch += DAY;
  const options = { now: started, documentRef: fixture.documentRef, loadNews: async () => {}, loadDecks: loadMeta };
  await refreshHomeCommunity('mtg', fixture.root, options);
  assert.equal(providerCalls, 1); assert.equal(M.data, cached); assert.equal(M.at, 1); assert.ok(M.error);
  assert.match(fixture.stage.innerHTML, /Older snapshot/);
  await refreshHomeCommunity('mtg', fixture.root, { ...options, now: started + 4 * 60000 }); assert.equal(providerCalls, 1);
  await refreshHomeCommunity('mtg', fixture.root, { ...options, now: started + 6 * 60000 }); assert.equal(providerCalls, 2, 'cached failure becomes retryable after the existing five-minute backoff');
  succeeds = true;
  await refreshHomeCommunity('mtg', fixture.root, { ...options, now: started + 12 * 60000 }); assert.equal(providerCalls, 4, 'recovery also reads the shared curation overlay; it does not generate AI');
  assert.equal(M.error, ''); assert.match(fixture.stage.innerHTML, /data-meta-deck="mtg:recovered"/);
  await refreshHomeCommunity('mtg', fixture.root, { ...options, now: started + 18 * 60000 }); assert.equal(providerCalls, 4, 'success still uses the daily Home gate');
  assert.equal(unexpectedNetwork, 0);
} finally {
  S.ui.mtgMeta = savedFormat;
  for (const [key, saved] of savedStates) { const state = metaState(key); for (const field of Object.keys(state)) delete state[field]; Object.assign(state, saved); }
  for (const [game, saved] of savedNews) Object.assign(communityState(game), saved);
  globalThis.fetch = savedFetch; globalThis.localStorage = savedStorage;
}
console.log('PASS: all-game initial/loading/error/verified-empty transitions, state-only repaint and focus guards, useful stale snapshots, independent news, bounded request sharing, route/game/format/unmount isolation, and real cached-failure retry classification.');
