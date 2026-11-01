// GET /api/news?game=mtg|ptcg|ygo: the live pulse (news-pulse.js). Two keyless fetches per game at most
// every half hour, shared by every visitor through the edge cache. A source that fails is simply left out.
import { NEWS_SOURCES, PULSE_SOURCES } from './community-sources.js';
import { parseRedditListing, parseFeed, mergePulse, redditListingUrl, PULSE_TTL } from './news-pulse.js';

const MAX_BYTES = 3 * 1024 * 1024, UA = 'web:com.cardstashy.news:v1 (public headlines, cached half-hourly)';
const json = (body, ttl) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${ttl}`, 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' } });
async function bounded(url, fetchImpl, accept) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 7000);
  try {
    const r = await fetchImpl(url, { signal: c.signal, headers: { Accept: accept, 'User-Agent': UA } });
    if (!r.ok) throw Error(`${new URL(url).hostname} returned ${r.status}`);
    const text = await r.text(); if (text.length > MAX_BYTES) throw Error('Source page too large');
    return text;
  } finally { clearTimeout(t); }
}
export async function collectPulse(game, { fetchImpl = fetch, now = Date.now() } = {}) {
  const [redditId, feedId] = PULSE_SOURCES[game], sources = [];
  const reddit = bounded(redditListingUrl(game), fetchImpl, 'application/json')
    .catch(() => bounded(redditListingUrl(game).replace('www.reddit.com', 'old.reddit.com'), fetchImpl, 'application/json'))
    .then(text => parseRedditListing(game, JSON.parse(text), now));
  const feed = bounded(NEWS_SOURCES[feedId].feed, fetchImpl, 'application/rss+xml, application/atom+xml, application/xml, text/xml').then(xml => parseFeed(game, xml, now));
  const [r, f] = await Promise.allSettled([reddit, feed]);
  for (const [id, res] of [[redditId, r], [feedId, f]]) sources.push({ sourceId: id, name: NEWS_SOURCES[id].name, status: res.status === 'fulfilled' ? 'checked' : 'unavailable' });
  return { game, items: mergePulse(f.value, r.value), sources, checkedAt: new Date(now).toISOString() };
}
export async function newsPulseRoute(request, url, ctx, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  if (request.method !== 'GET') return new Response('GET only', { status: 405 });
  const game = url.searchParams.get('game');
  if (!Object.hasOwn(PULSE_SOURCES, game || '') || [...url.searchParams.keys()].some(k => k !== 'game')) return new Response('Choose mtg, ptcg or ygo', { status: 400 });
  const key = new Request(`https://cardforge.cache/news-pulse/v1/${game}`);
  try { const hit = await cache?.match(key); if (hit) return hit; } catch {}
  const body = await collectPulse(game, { fetchImpl, now });
  // A pulse with no stories is cached briefly so a source outage is retried soon, never hammered.
  const res = json(body, body.items.length ? PULSE_TTL / 1000 : 300);
  if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); ctx?.waitUntil ? ctx.waitUntil(put) : await put; }
  return res;
}
