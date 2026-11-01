// GET /api/news?game=mtg|ptcg|ygo: the live pulse (news-pulse.js). A handful of keyless fetches per game at
// most every half hour, shared by every visitor through the edge cache. A source that fails is left out.
import { NEWS_SOURCES, PULSE_SOURCES } from './community-sources.js';
import { parseRedditListing, parseRedditAtom, parseFeed, pageImage, addCardArt, mergePulse, redditIds, feedIds, redditListingUrl, redditAtomUrl, PULSE_TTL } from './news-pulse.js';

const MAX_BYTES = 3 * 1024 * 1024, MAX_PAGE_IMAGES = 4, UA = 'web:com.cardstashy.news:v2 (public headlines, cached half-hourly)';
const json = (body, ttl) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${ttl}`, 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' } });
async function bounded(url, fetchImpl, accept, max = MAX_BYTES) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 7000);
  try {
    const r = await fetchImpl(url, { signal: c.signal, headers: { Accept: accept, 'User-Agent': UA } });
    if (!r.ok) throw Error(`${new URL(url).hostname} returned ${r.status}`);
    const text = await r.text(); if (text.length > max) throw Error('Source page too large');
    return text;
  } finally { clearTimeout(t); }
}
const XML = 'application/rss+xml, application/atom+xml, application/xml, text/xml';
export async function collectPulse(game, { fetchImpl = fetch, now = Date.now() } = {}) {
  const reddit = id => bounded(redditListingUrl(game, id), fetchImpl, 'application/json')
    .catch(() => bounded(redditListingUrl(game, id).replace('www.reddit.com', 'old.reddit.com'), fetchImpl, 'application/json'))
    .then(text => parseRedditListing(game, JSON.parse(text), now, id))
    // Reddit's Atom feed is often still open to servers when its JSON is not.
    .catch(() => bounded(redditAtomUrl(game, id), fetchImpl, XML).then(xml => parseRedditAtom(game, xml, now, id)));
  const feed = id => bounded(NEWS_SOURCES[id].feed, fetchImpl, XML).then(xml => parseFeed(game, xml, now, id));
  const ids = [...redditIds(game), ...feedIds(game)];
  const results = await Promise.allSettled(ids.map(id => NEWS_SOURCES[id].sub ? reddit(id) : feed(id)));
  const sources = ids.map((id, i) => ({ sourceId: id, name: NEWS_SOURCES[id].name, status: results[i].status === 'fulfilled' && results[i].value.length ? 'checked' : results[i].status === 'fulfilled' ? 'empty' : 'unavailable' }));
  const items = mergePulse(...feedIds(game).map(id => results[ids.indexOf(id)].value), ...redditIds(game).map(id => results[ids.indexOf(id)].value));
  // Articles whose feed carried no picture: the page's own share image (a few per pass).
  await Promise.all(items.filter(r => !r.image && !/^reddit-/.test(r.sourceId)).slice(0, MAX_PAGE_IMAGES).map(async r => { try { r.image = pageImage(r, await bounded(r.url, fetchImpl, 'text/html', 1.5e6)); } catch {} }));
  await addCardArt(game, items, async url => JSON.parse(await bounded(url, fetchImpl, 'application/json'))).catch(() => {});
  return { game, items, sources, checkedAt: new Date(now).toISOString() };
}
export async function newsPulseRoute(request, url, ctx, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  if (request.method !== 'GET') return new Response('GET only', { status: 405 });
  const game = url.searchParams.get('game');
  if (!Object.hasOwn(PULSE_SOURCES, game || '') || [...url.searchParams.keys()].some(k => k !== 'game')) return new Response('Choose mtg, ptcg or ygo', { status: 400 });
  const key = new Request(`https://cardforge.cache/news-pulse/v2/${game}`);
  try { const hit = await cache?.match(key); if (hit) return hit; } catch {}
  const body = await collectPulse(game, { fetchImpl, now });
  // A pulse with no stories is cached briefly so a source outage is retried soon, never hammered.
  const res = json(body, body.items.length ? PULSE_TTL / 1000 : 300);
  if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); ctx?.waitUntil ? ctx.waitUntil(put) : await put; }
  return res;
}
