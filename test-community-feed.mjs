import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseNewsIndex, parseNewsArticle, parseYgoEvents, retainCommunityItems, COMMUNITY_DAY, COMMUNITY_RETENTION } from './community-feed-route.js';

const now = Date.parse('2026-10-17T12:00:00Z'), iso = n => new Date(n).toISOString();
const articleUrl = 'https://magic.wizards.com/en/news/announcements/fixture-update';
const index = '<h2>Latest Articles</h2><article><a href="/en/news/announcements/fixture-update"><h3>Fixture update</h3></a></article>';
const article = (published = '2026-10-16T09:00-07:00', title = 'Fixture rules update') => `<meta property="og:image" content="https://images.ctfassets.net/s5n2t79q9icq/fixture/0123456789abcdef0123456789abcdef/fixture.webp"><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', headline: title, datePublished: published, dateModified: iso(now) })}</script>`;
const candidate = { url: articleUrl, title: 'Fallback title' };
const news = parseNewsArticle('mtg', article(), candidate, now);
assert.equal(news.title, 'Fixture rules update');
assert.equal(news.publishedAt, '2026-10-16T16:00:00.000Z');
assert.equal(news.fetchedAt, iso(now));
assert.equal(news.important, true);
assert.equal(news.image, 'https://images.ctfassets.net/s5n2t79q9icq/fixture/0123456789abcdef0123456789abcdef/fixture.webp');
assert.equal(news.dateLabel, 'Published');
assert.equal(parseNewsArticle('mtg', article('2026-10-01'), candidate, now), null, 'modified date never refreshes an old publication');
assert.equal(parseNewsArticle('mtg', article('2026-10-18'), candidate, now), null, 'future publications excluded');
assert.equal(parseNewsArticle('mtg', '<h1>Undated item</h1>', candidate, now), null, 'missing dates never invented');
assert.equal(parseNewsArticle('mtg', article('2026-02-31'), candidate, now), null, 'impossible dates excluded');
assert.equal(parseNewsArticle('mtg', article(), { ...candidate, url: 'https://attacker.test/story' }, now), null);
assert.equal(parseNewsArticle('mtg', article().replace('https://images.ctfassets.net/s5n2t79q9icq/fixture/0123456789abcdef0123456789abcdef/fixture.webp', 'javascript:alert(1)'), candidate, now).image, '');
const indexAttack = index + '<a href="https://magic.wizards.com.attacker.test/en/news/a/b">Bad</a><a href="https://user:pass@magic.wizards.com/en/news/a/b">Bad</a><a href="/en/news/a/b?url=http://169.254.169.254/">Bad</a><a href="http://magic.wizards.com/en/news/a/b">Bad</a>';
assert.deepEqual(parseNewsIndex('mtg', indexAttack), [{ sourceId: 'wizards', url: articleUrl, title: 'Fixture update' }]);
assert.equal(parseNewsIndex('mtg', '<h2>Latest Articles</h2>' + Array.from({ length: 30 }, (_, i) => `<a href="/en/news/announcements/story-${i}">Story ${i}</a>`).join('')).length, 4, 'bounded article requests');
assert.deepEqual(parseNewsIndex('mtg', '<a href="/en/news/mtg-arena/event-terms-and-conditions">Event terms and conditions</a>'), [], 'legal terms are not a community headline');
assert.deepEqual(parseNewsIndex('ptcg', '<iframe src="/challenge"></iframe>'), [], 'a block page is not news');
assert.deepEqual(parseNewsIndex('ptcg', '<a href="/us/pokemon-news/new-animation">Animation</a>'), [], 'unrelated Pokémon news is not tabletop news');
const ygoIndex = '<li class="clear"><img class="thumb" src="/en/wp-content/uploads/2026/10/story.jpg"><section class="copy"><h4><a href="/en/news/fixture-update/">Fixture update</a></h4><p class="date">October 16, 2026</p><section class="preview"></section></section></li>';
assert.equal(parseNewsIndex('ygo', ygoIndex)[0].publishedAt, '2026-10-16', 'calendar date does not invent a time zone');
const events = `<h2>Upcoming Events</h2><a href="/en/events-item/fixture-event/"><p>Fixture championship</p><p>Fixture city</p><p>10/16/2026 - 10/18/2026</p></a><a href="/en/events-item/expired/"><p>Old event</p><p>City</p><p>10/01/2026 - 10/02/2026</p></a><a href="https://attacker.test/en/events-item/other/"><p>Bad</p><p>City</p><p>10/16/2026 - 10/18/2026</p></a>`;
const event = parseYgoEvents(events, now)[0];
assert.equal(parseYgoEvents(events, now).length, 1);
assert.equal(event.startsAt, '2026-10-16'); assert.equal(event.endsAt, '2026-10-18');
assert.equal(event.publishedAt, '', 'event date never masquerades as publication date');
assert.equal(retainCommunityItems([news, news, { ...news, id: 'expired', publishedAt: iso(now - COMMUNITY_RETENTION - 1) }, event], now).length, 2);
assert.equal(retainCommunityItems([event], now + 8 * COMMUNITY_DAY).length, 0, 'stale future event snapshots also expire in a week');

const html = text => new Response(text, { headers: { 'Content-Type': 'text/html' } });
// Match workerd's Request::tryParseRedirect boundary, not Node's more permissive
// fetch. Source: https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B
const edgeFetch = handler => async (url, options) => {
  if (!['follow', 'manual'].includes(options?.redirect)) throw new TypeError('Invalid redirect value, must be one of "follow" or "manual"');
  return handler(url, options);
};
await assert.rejects(edgeFetch(() => html(index))('https://magic.wizards.com/en/news/announcements', { redirect: 'error' }), /Invalid redirect value/);
const memoryCache = () => { const rows = new Map(); return { match: async key => rows.get(key.url)?.clone(), put: async (key, response) => { rows.set(key.url, response.clone()); } }; };
const routeModule = id => import(`./community-feed-route.js?case=${id}`);
const request = (game = 'mtg', extra = '', method = 'GET') => { const url = new URL(`https://app.test/api/community?game=${game}${extra}`); return [new Request(url, { method }), url, null]; };
{
  const { communityFeedRoute } = await routeModule('cache'); const cache = memoryCache(); let calls = 0;
  const fetchImpl = edgeFetch(async (url, options) => { calls++; assert.equal(options.redirect, 'manual'); assert.ok(options.signal); assert.ok(!options.headers.Authorization); if (url.endsWith('/en/news/announcements')) return html(index); assert.equal(url, articleUrl); return html(article()); });
  const results = await Promise.all(Array.from({ length: 8 }, () => communityFeedRoute(...request(), { cache, fetchImpl, now })));
  const body = await results[0].json(); assert.equal(calls, 2, 'simultaneous refreshes share one upstream batch'); assert.equal(body.items.length, 1); assert.equal(body.status, 'ready');
  await communityFeedRoute(...request(), { cache, fetchImpl, now: now + COMMUNITY_DAY - 1 }); assert.equal(calls, 2, 'no refresh within 24 hours');
  let failures = 0; const outage = async () => { failures++; throw Error('Publisher offline'); };
  const stale = await (await communityFeedRoute(...request(), { cache, fetchImpl: outage, now: now + COMMUNITY_DAY })).json();
  assert.equal(stale.items.length, 1); assert.equal(stale.items[0].stale, true); assert.equal(stale.items[0].publishedAt, news.publishedAt); assert.equal(stale.items[0].fetchedAt, news.fetchedAt); assert.equal(stale.fetchedAt, body.fetchedAt); assert.equal(stale.status, 'unavailable');
  await communityFeedRoute(...request(), { cache, fetchImpl: outage, now: now + COMMUNITY_DAY + 100 }); assert.equal(failures, 1, 'outages also cached for 24 hours');
  const expired = await (await communityFeedRoute(...request(), { cache, fetchImpl: outage, now: now + 8 * COMMUNITY_DAY })).json(); assert.equal(expired.items.length, 0);
}
{
  const targets = [
    'http://magic.wizards.com/en/news/announcements/fixture-update',
    'http://169.254.169.254/latest/meta-data/',
    'https://user:pass@magic.wizards.com/en/news/announcements/fixture-update',
    'https://attacker.test/news',
    'https://magic.wizards.com.attacker.test/en/news/announcements/fixture-update',
    'https://www.pokemon.com/us/pokemon-news/fixture-tcg',
    articleUrl,
    '/en/news/announcements/fixture-update',
  ];
  // All 3xx are refused, including uncommon codes. A Location is never fetched,
  // even when it points to another allowlisted publisher or the same origin.
  for (let status = 300; status < 400; status++) {
    const { communityFeedRoute } = await routeModule(`redirect-${status}`), urls = [], location = targets[(status - 300) % targets.length];
    const fetchImpl = edgeFetch(async (url, options) => {
      urls.push(url);
      if (options.redirect === 'follow') { urls.push(location); return html(index); }
      return new Response(null, { status, headers: { Location: location, 'Content-Type': 'text/html' } });
    });
    const body = await (await communityFeedRoute(...request(), { cache: null, fetchImpl, now })).json();
    assert.equal(body.status, 'unavailable'); assert.deepEqual(body.items, []); assert.match(body.error, /redirects are not allowed/);
    assert.deepEqual(urls, ['https://magic.wizards.com/en/news/announcements'], `HTTP ${status} must never request ${location}`);
    await communityFeedRoute(...request(), { cache: null, fetchImpl, now: now + 1 });
    assert.equal(urls.length, 1, 'redirect refusal retains daily failure backoff');
  }
  for (const [i, location] of targets.entries()) {
    const { communityFeedRoute } = await routeModule(`article-redirect-${i}`), urls = [];
    const fetchImpl = edgeFetch(async (url, options) => {
      urls.push(url);
      if (url === 'https://magic.wizards.com/en/news/announcements') return html(index);
      if (options.redirect === 'follow') { urls.push(location); return html(article()); }
      return new Response(article(), { status: 302, headers: { Location: location, 'Content-Type': 'text/html' } });
    });
    const body = await (await communityFeedRoute(...request(), { cache: null, fetchImpl, now })).json();
    assert.equal(body.status, 'unavailable'); assert.deepEqual(body.items, []);
    assert.deepEqual(urls, ['https://magic.wizards.com/en/news/announcements', articleUrl], 'article redirect body is not parsed and target is never requested');
  }
}
{
  const { communityFeedRoute } = await routeModule('edge-cache-v2-recovery'), cache = memoryCache(); let calls = 0;
  const legacyKey = new Request('https://cardforge.cache/community/v2/mtg'), key = new Request('https://cardforge.cache/community/v3/mtg');
  const previous = { game: 'mtg', items: [news, { ...news, id: 'expired', publishedAt: iso(now - COMMUNITY_RETENTION - 1) }], status: 'unavailable', error: 'Invalid redirect value', checkedAt: iso(now - 1000), fetchedAt: news.fetchedAt, nextCheckAt: iso(now + COMMUNITY_DAY - 1000) };
  await cache.put(legacyKey, Response.json(previous));
  const fetchImpl = edgeFetch(async () => { calls++; throw Error('Publisher offline'); });
  const body = await (await communityFeedRoute(...request(), { cache, fetchImpl, now })).json();
  assert.equal(calls, 1, 'fresh v3 failure cannot suppress the corrected attempt');
  assert.equal(body.status, 'unavailable'); assert.equal(body.items.length, 1); assert.equal(body.items[0].stale, true);
  assert.equal(body.items[0].publishedAt, news.publishedAt); assert.equal(body.items[0].fetchedAt, news.fetchedAt); assert.equal(body.fetchedAt, news.fetchedAt);
  assert.equal(body.nextCheckAt, iso(now + COMMUNITY_DAY)); assert.match(body.error, /Publisher offline/);
  assert.deepEqual(await (await cache.match(legacyKey)).json(), previous, 'legacy cache is not purged or rewritten');
  const stored = await cache.match(key); assert.match(stored.headers.get('Cache-Control'), /max-age=604800/); assert.equal((await stored.json()).checkedAt, iso(now));
  const reloaded = await routeModule('edge-cache-v2-recovery-reloaded');
  await reloaded.communityFeedRoute(...request(), { cache, fetchImpl, now: now + COMMUNITY_DAY - 1 });
  assert.equal(calls, 1, 'persisted v3 failure backoff survives a new Worker instance');
  await reloaded.communityFeedRoute(...request(), { cache, fetchImpl, now: now + COMMUNITY_DAY });
  assert.equal(calls, 2, 'recovery does not disable normal next-day refresh');
}
{
  const { communityFeedRoute } = await routeModule('edge-cache-migration-race'); let releaseLegacy, markWaiting, calls = 0;
  const waiting = new Promise(resolve => { markWaiting = resolve; }), blockedLegacy = new Promise(resolve => { releaseLegacy = resolve; });
  const cache = { match: async key => {
    if (key.url.includes('/v2/')) { markWaiting(); await blockedLegacy; return Response.json({ game: 'mtg', items: [news], checkedAt: iso(now), nextCheckAt: iso(now + COMMUNITY_DAY) }); }
  }, put: async () => {} };
  const fetchImpl = edgeFetch(async () => { calls++; throw Error('Offline'); });
  const delayed = communityFeedRoute(...request(), { cache, fetchImpl, now });
  await waiting;
  await communityFeedRoute(...request(), { cache: null, fetchImpl, now: now + 1 });
  releaseLegacy();
  const body = await (await delayed).json();
  assert.equal(body.nextCheckAt, iso(now + COMMUNITY_DAY + 1)); assert.equal(calls, 1, 'slow legacy reads cannot cause a second refresh after a later-started caller already finished');
}
{
  const { communityFeedRoute } = await routeModule('future-external-cache'), cache = memoryCache(); let calls = 0;
  await cache.put(new Request('https://cardforge.cache/community/v3/mtg'), Response.json({ game: 'mtg', items: [], checkedAt: iso(now + 1), nextCheckAt: iso(now + COMMUNITY_DAY), status: 'ready' }));
  const body = await (await communityFeedRoute(...request(), { cache, now, fetchImpl: edgeFetch(async () => { calls++; throw Error('Offline'); }) })).json();
  assert.equal(calls, 1, 'future-dated external cache is not trusted like a completed in-process request');
  assert.equal(body.status, 'unavailable'); assert.equal(body.checkedAt, iso(now));
}
{
  const { communityFeedRoute } = await routeModule('validation'); let calls = 0; const fetchImpl = async () => { calls++; return html(index); };
  for (const args of [request('nope'), request('mtg', '&url=http://169.254.169.254/'), request('mtg', '&force=1'), request('mtg', '&game=ygo'), request('mtg', '', 'POST')]) {
    assert.ok((await communityFeedRoute(...args, { cache: memoryCache(), fetchImpl, now })).status >= 400);
  }
  assert.equal(calls, 0, 'invalid callers cannot cause provider fetches');
}
{
  const { communityFeedRoute } = await routeModule('bounds'); let calls = 0;
  const fetchImpl = async () => { calls++; return html('x'.repeat(1024 * 1024 + 1)); };
  const body = await (await communityFeedRoute(...request(), { cache: null, fetchImpl, now })).json(); assert.equal(body.status, 'unavailable'); assert.match(body.error, /size limit/);
  await communityFeedRoute(...request(), { cache: null, fetchImpl, now: now + 10 }); assert.equal(calls, 1, 'in-memory daily backoff survives unavailable edge cache');
}
{
  const { communityFeedRoute } = await routeModule('ygo'); const cache = memoryCache(); const urls = [];
  const body = await (await communityFeedRoute(...request('ygo'), { cache, now, fetchImpl: async url => { urls.push(url); return html(url.endsWith('/news/') ? ygoIndex : events); } })).json();
  assert.equal(urls.length, 3); assert.deepEqual(body.items.map(x => x.kind).sort(), ['event', 'news']);
}
{
  const { communityFeedRoute } = await routeModule('pokemon');
  const body = await (await communityFeedRoute(...request('ptcg'), { cache: memoryCache(), now, fetchImpl: async () => html('<iframe src="/challenge"></iframe>') })).json();
  assert.equal(body.status, 'unavailable'); assert.equal(body.items.length, 0); assert.ok(body.error);
}

const store = new Map(); globalThis.localStorage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
const { communitySlides, communityState, loadCommunity, safeCommunityUrl } = await import('./community-feed.js');
for (const game of ['mtg', 'ptcg', 'ygo']) {
  const slides = communitySlides(game, { metaState: { data: null }, now });
  assert.equal(slides.length, 3); assert.ok(slides.every(x => x.kind === 'link' && !x.publishedAt && !x.fetchedAt));
  assert.ok(slides.every(x => safeCommunityUrl(x.url, game)));
}
for (const url of ['javascript:alert(1)', 'http://magic.wizards.com/en/news', 'https://magic.wizards.com.attacker.test/', 'https://a:b@magic.wizards.com/', 'https://magic.wizards.com:444/']) assert.equal(safeCommunityUrl(url, 'mtg'), '');
const M = { at: now, data: { source: 'Magic Online', fetchedAt: iso(now - 2 * COMMUNITY_DAY), decks: [{ key: 'real-key', name: 'Fixture deck', place: '5-0 League', event: 'Fixture League', date: '2026-10-15', url: 'https://www.mtgo.com/decklist/fixture-league' }, { key: 'evil', name: 'Bad', url: 'javascript:alert(1)' }], events: [] } };
const deck = communitySlides('mtg', { metaState: M, now }).find(x => x.kind === 'deck'); assert.equal(deck.stale, true, 'provider fetchedAt beats recently loaded device time'); assert.equal(deck.dateLabel, 'Event date'); assert.equal(deck.deckKey, 'real-key'); assert.match(deck.methodology, /not a global popularity ranking/);
const ygo = communitySlides('ygo', { metaState: { at: now, data: { source: 'YGOPRODeck Tournament Meta Decks', decks: [{ key: 'ygo:1', name: 'Fixture deck', date: '2026-10-16 10:30:00', url: 'https://ygoprodeck.com/deck/fixture' }] } }, now }).find(x => x.kind === 'deck'); assert.equal(ygo.dateLabel, 'List submitted'); assert.equal(ygo.publishedAt, '2026-10-16');
const ptcgM = { at: now, data: { source: 'Limitless — fixture coverage', decks: [{ key: 'ptcg:one:1', name: 'Fixture', event: 'Real fixture event', date: '2026-10-16', url: 'https://play.limitlesstcg.com/tournament/one/player/fixture/decklist' }], events: [{ name: 'Real fixture event', date: '2026-10-16', players: 32 }] } };
assert.equal(communitySlides('ptcg', { metaState: ptcgM, now }).find(x => x.kind === 'event').url, 'https://play.limitlesstcg.com/tournament/one');
let calls = 0; const feed = { game: 'mtg', items: [news, { ...news, game: 'ptcg', id: 'wrong-game' }, { ...news, url: 'javascript:alert(1)', id: 'bad-url' }], checkedAt: iso(now), fetchedAt: iso(now), nextCheckAt: iso(now + COMMUNITY_DAY), status: 'ready' };
const fetchImpl = async (url, options) => { calls++; assert.equal(url, 'api/community?game=mtg'); assert.equal(options.cache, 'no-store', 'bypass old HTTP-cache errors; daily browser cache remains authoritative'); return Response.json(feed); };
await Promise.all(Array.from({ length: 8 }, () => loadCommunity('mtg', { fetchImpl, now }))); assert.equal(calls, 1); assert.equal(communityState('mtg').data.items.length, 1);
await loadCommunity('mtg', { fetchImpl, now: now + COMMUNITY_DAY - 1 }); assert.equal(calls, 1);
await loadCommunity('mtg', { fetchImpl: async () => { calls++; throw Error('Offline'); }, now: now + COMMUNITY_DAY }); assert.equal(communityState('mtg').data.items[0].stale, true); assert.equal(communityState('mtg').data.items[0].publishedAt, news.publishedAt);
await loadCommunity('mtg', { fetchImpl, now: now + COMMUNITY_DAY + 5 }); assert.equal(calls, 2, 'client failure does not trigger retry loops');
assert.equal(communitySlides('mtg', { metaState: M, now: now + 8 * COMMUNITY_DAY }).some(x => x.url === news.url), false, 'expired cached story is removed even when a newer reviewed edition is available');

// A v2 success or failure may contain useful data, but its daily lock must not
// hide the fixed endpoint. Migrate per game and persist even a failed attempt.
for (const outage of [false, true]) {
  store.clear();
  const legacy = Object.fromEntries(['mtg', 'ptcg', 'ygo'].map(game => [game, { at: now - 1000, data: {
    game, items: game === 'mtg' ? [news, { ...news, url: articleUrl + '-expired', publishedAt: iso(now - COMMUNITY_RETENTION - 1) }] : game === 'ygo' ? [event] : [],
    status: game === 'mtg' ? 'ready' : 'unavailable', error: game === 'mtg' ? '' : 'Invalid redirect value', checkedAt: iso(now - 1000), fetchedAt: iso(now - 1000), nextCheckAt: iso(now + COMMUNITY_DAY - 1000),
  } }]));
  const original = JSON.stringify(legacy); store.set('cardforge-community-v2', original);
  const mod = await import(`./community-feed.js?migration=${outage}`); let requests = 0;
  const fetchImpl = async (url, options) => {
    requests++; assert.equal(options.cache, 'no-store'); assert.ok(options.signal);
    const game = new URL(url, 'https://app.test/').searchParams.get('game');
    assert.equal(url, `api/community?game=${game}`); assert.ok(['mtg', 'ptcg', 'ygo'].includes(game));
    if (outage) throw Error('Publisher still offline');
    return Response.json({ game, items: [], status: 'ready', checkedAt: iso(now), fetchedAt: iso(now), nextCheckAt: iso(now + COMMUNITY_DAY) });
  };
  for (const game of ['mtg', 'ptcg', 'ygo']) {
    assert.equal(mod.communityState(game).at, 0, 'legacy freshness cannot block the one-time recovery');
    await Promise.all(Array.from({ length: 4 }, () => mod.loadCommunity(game, { now, fetchImpl })));
    const state = mod.communityState(game);
    assert.equal(state.at, now); assert.equal(state.data.status, outage ? 'unavailable' : 'ready');
    assert.equal(state.data.items.length, game === 'ptcg' ? 0 : 1, 'retain only still-valid legacy data');
    if (game === 'mtg') { assert.equal(state.data.items[0].stale, true); assert.equal(state.data.items[0].publishedAt, news.publishedAt); assert.equal(state.data.items[0].fetchedAt, news.fetchedAt); }
  }
  assert.equal(requests, 3, 'one migration request per game, including concurrent visitors');
  assert.equal(store.get('cardforge-community-v2'), original, 'recovery does not purge legacy data');
  const restored = await import(`./community-feed.js?migration-reload=${outage}`);
  for (const game of ['mtg', 'ptcg', 'ygo']) await restored.loadCommunity(game, { now: now + COMMUNITY_DAY - 1, fetchImpl });
  assert.equal(requests, 3, 'v3 success/failure backoff survives reload, despite fresh legacy data');
  for (const game of ['mtg', 'ptcg', 'ygo']) {
    await restored.loadCommunity(game, { now: now + COMMUNITY_DAY, fetchImpl });
    assert.equal(restored.communitySlides(game, { metaState: { data: null }, now: now + 8 * COMMUNITY_DAY }).some(x => legacy[game].data.items.some(old => old.url === x.url)), false, 'migrated data still expires after seven days; newer reviewed stories are independent');
  }
  assert.equal(requests, 6, 'normal daily attempts resume after migration');
}
store.clear();

// Corrupt browser caches must fail closed to source links, never crash Home.
// 1e999 is valid JSON numeric syntax and parses as Infinity, unlike JSON.stringify(Infinity).
const badDates = ['1e100', '1e999', '-1e999', 'null', '8640000000000001'];
for (let i = 0; i < badDates.length; i++) {
  const value = badDates[i], corrupt = JSON.stringify({ mtg: { at: '__BAD__', data: { game: 'mtg', status: 'ready', fetchedAt: '__BAD__', checkedAt: '__BAD__', nextCheckAt: '__BAD__', items: [{ ...news, fetchedAt: '__BAD__' }] } } }).replaceAll('"__BAD__"', value);
  store.set('cardforge-community-v3', corrupt);
  const mod = await import(`./community-feed.js?invalid-date=${i}`);
  const restored = mod.communityState('mtg');
  assert.equal(restored.at, 0); assert.equal(restored.data.fetchedAt, ''); assert.equal(restored.data.checkedAt, ''); assert.equal(restored.data.nextCheckAt, ''); assert.deepEqual(restored.data.items, []);
  assert.doesNotThrow(() => mod.communitySlides('mtg', { metaState: { data: null }, now }));
  assert.ok(mod.communitySlides('mtg', { metaState: { data: null }, now }).every(x => x.kind === 'link' && !x.publishedAt && !x.fetchedAt));
  // Also exercise the renderer boundary directly, not just restoration filtering.
  restored.data.items = [{ ...news, fetchedAt: Number(value) }];
  assert.doesNotThrow(() => mod.communitySlides('mtg', { metaState: { data: null }, now }));
  assert.equal(mod.communitySlides('mtg', { metaState: { data: null }, now }).some(x => x.kind === 'news'), false);
  await mod.loadCommunity('mtg', { now, fetchImpl });
  assert.equal(mod.communityState('mtg').data.items.length, 1, 'valid next response recovers from malformed dates');
}
for (const [i, items] of [{}, 'not-an-array', true, 1, null].entries()) {
  store.set('cardforge-community-v3', JSON.stringify({ mtg: { at: now, data: { game: 'mtg', items, status: 'ready' } } }));
  const mod = await import(`./community-feed.js?invalid-items=${i}`);
  assert.equal(mod.communityState('mtg').data, null); assert.equal(mod.communityState('mtg').at, 0, 'discarded cache cannot suppress a fresh request');
  assert.equal(mod.communitySlides('mtg', { metaState: { data: null }, now }).length, 3);
  await mod.loadCommunity('mtg', { now, fetchImpl });
  assert.equal(mod.communityState('mtg').data.items.length, 1, 'wrong-shaped cache does not poison valid source response');
  mod.communityState('mtg').data.items = items;
  await mod.loadCommunity('mtg', { now: now + COMMUNITY_DAY, fetchImpl });
  assert.equal(mod.communityState('mtg').data.status, 'ready'); assert.equal(mod.communityState('mtg').data.items.length, 1, 'in-memory wrong-shaped items also recover without map/spread errors');
}
for (const [i, data] of [[], 'invalid', true].entries()) {
  store.set('cardforge-community-v3', JSON.stringify({ mtg: { at: now, data } }));
  const mod = await import(`./community-feed.js?invalid-data=${i}`);
  assert.equal(mod.communityState('mtg').data, null);
  assert.doesNotThrow(() => mod.communitySlides('mtg', { metaState: { data: null }, now }));
}
const worker = fs.readFileSync(new URL('./worker.js', import.meta.url), 'utf8'); assert.match(worker, /url\.pathname === '\/api\/community'/);
assert.doesNotMatch(fs.readFileSync(new URL('./community-feed.js', import.meta.url), 'utf8'), /import .*community-feed-route/);
console.log('PASS: source-backed community feed, edge-compatible no-follow redirects, v2-to-v3 source-contract recovery, truthful dates, safe URLs, all-game fallbacks, shared meta, bounded fixed sources, daily success/failure dedupe, stale preservation and seven-day retention.');
