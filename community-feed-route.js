// Public, keyless publisher news. No caller-provided URL, credentials, database,
// or scheduled job. One bounded refresh per game/cache location every 24 hours.
export const COMMUNITY_DAY = 864e5;
export const COMMUNITY_RETENTION = 7 * COMMUNITY_DAY;
export const COMMUNITY_SOURCES = Object.freeze({
  mtg: { name: 'Wizards of the Coast', url: 'https://magic.wizards.com/en/news' },
  ptcg: { name: 'Pokémon', url: 'https://www.pokemon.com/us/pokemon-news' },
  ygo: { name: 'Konami', url: 'https://www.yugioh-card.com/en/news/' },
});
const YGO_EVENTS = 'https://www.yugioh-card.com/en/events/';
const MAX_BYTES = 1024 * 1024, MAX_ARTICLES = 4, MAX_ITEMS = 18;
const pending = new Map();
const snapshots = new Map(); // At most three games; also bounds retries if edge cache is unavailable.
const iso = n => new Date(n).toISOString();
const json = (body, status = 200, ttl = 600) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${ttl}`, 'X-Content-Type-Options': 'nosniff' } });

export function communityText(value, max = 180) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', trade: '™', reg: '®', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' };
  return String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, key) => {
    if (key[0] !== '#') return entities[key.toLowerCase()] ?? all;
    const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
  }).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
const attrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), communityText(m[2] ?? m[3], 2048)]));
function articleUrl(game, href) {
  try {
    const u = new URL(href, COMMUNITY_SOURCES[game].url), origin = new URL(COMMUNITY_SOURCES[game].url).origin;
    if (u.origin !== origin || u.username || u.password || u.search || u.hash) return '';
    const valid = game === 'mtg' ? /^\/en\/news\/[a-z0-9-]+\/[a-z0-9-]+\/?$/ : game === 'ptcg' ? /^\/us\/pokemon-news\/[a-z0-9-]+\/?$/ : /^\/en\/news\/[a-z0-9_-]+\/?$/;
    return valid.test(u.pathname) ? u.href : '';
  } catch { return ''; }
}
function date(value) {
  const v = communityText(value, 60);
  if (!/^(?:\d{4}-\d{2}-\d{2}(?:T[\d:.+Z-]+)?|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})$/.test(v)) return '';
  const dayOnly = !v.includes('T'), n = Date.parse(dayOnly && !/^\d/.test(v) ? v + ' UTC' : v);
  if (!Number.isFinite(n)) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) && iso(n).slice(0, 10) !== v) return '';
  return dayOnly ? iso(n).slice(0, 10) : iso(n);
}
function thumbnail(href) {
  try { const u = new URL(href, 'https://magic.wizards.com'); return u.protocol === 'https:' && !u.username && !u.password && ['images.ctfassets.net', 'assets.pokemon.com', 'img.yugioh-card.com', 'www.yugioh-card.com'].includes(u.hostname) ? u.href : ''; } catch { return ''; }
}
function summary(title) {
  if (/bann|restrict|rules|policy|errata|replacement/i.test(title)) return 'An official rules or product update. Read the publisher’s full details.';
  if (/championship|tournament|qualifier|arena direct/i.test(title)) return 'An official organized-play announcement. See the event details and requirements.';
  if (/decklist/i.test(title)) return 'Explore the decklists published by the game’s official team.';
  return 'Read the full announcement from the game’s official team.';
}
function news(game, row, now) {
  const url = articleUrl(game, row.url), publishedAt = date(row.publishedAt), title = communityText(row.title);
  const age = now - Date.parse(publishedAt);
  if (!url || !title || !publishedAt || age < 0 || age > COMMUNITY_RETENTION) return null;
  return { id: url, game, kind: 'news', title, summary: summary(title), url, source: COMMUNITY_SOURCES[game].name, sourceUrl: COMMUNITY_SOURCES[game].url, publishedAt, dateLabel: 'Published', fetchedAt: iso(now), image: thumbnail(row.image), important: /bann|restrict|rules|policy|errata|championship|replacement/i.test(title), stale: false };
}

// Read public markup only. Never evaluate embedded scripts or follow arbitrary links.
export function parseNewsIndex(game, html) {
  let input = String(html).slice(0, MAX_BYTES);
  if (game === 'mtg') { const i = input.indexOf('Latest Articles'); if (i >= 0) input = input.slice(i); }
  const out = [], seen = new Set();
  if (game === 'ygo') {
    for (const m of input.matchAll(/<section\b[^>]*class=["']copy["'][^>]*>([\s\S]*?)<\/section>/gi)) {
      const link = m[1].match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i), d = m[1].match(/<p\b[^>]*class=["']date["'][^>]*>([\s\S]*?)<\/p>/i);
      const url = link && articleUrl(game, attrs(link[1]).href);
      if (url && d && !seen.has(url)) { seen.add(url); out.push({ url, title: communityText(link[2]), publishedAt: date(d[1]) }); }
    }
    return out.slice(0, 24);
  }
  for (const m of input.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const url = articleUrl(game, attrs(m[1]).href), title = communityText(m[2]);
    if (!url || !title || seen.has(url)) continue;
    if (/terms.and.conditions|terms.of.service|privacy.policy/i.test(url + ' ' + title)) continue;
    // Pokémon's general news page also contains animation, games and merchandise.
    if (game === 'ptcg' && !/tcg|trading.card|play.pok.mon|championship|regional/i.test(title + ' ' + url)) continue;
    seen.add(url); out.push({ url, title }); if (out.length >= MAX_ARTICLES) break;
  }
  return out;
}

export function parseNewsArticle(game, html, candidate, now = Date.now()) {
  const input = String(html).slice(0, MAX_BYTES), metadata = {};
  for (const m of input.matchAll(/<meta\b([^>]*)>/gi)) { const a = attrs(m[1]); metadata[a.property || a.name] = a.content; }
  let publishedAt = metadata['article:published_time'] || metadata.date || '', title = metadata['og:title'] || candidate.title, image = metadata['og:image'] || '';
  for (const m of input.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const root = JSON.parse(m[1]); const rows = [...(Array.isArray(root) ? root : [root]), ...(Array.isArray(root?.['@graph']) ? root['@graph'] : [])];
      const a = rows.find(x => /^(?:Article|NewsArticle|BlogPosting)$/.test(String(x?.['@type'])));
      if (a) { publishedAt = a.datePublished || publishedAt; title = a.headline || title; image = typeof a.image === 'string' ? a.image : Array.isArray(a.image) ? a.image[0] : a.image?.url || image; }
    } catch {}
  }
  if (!publishedAt) { const t = input.match(/<time\b([^>]*)>([\s\S]*?)<\/time>/i); if (t) publishedAt = attrs(t[1]).datetime || communityText(t[2]); }
  return news(game, { url: candidate.url, title, publishedAt, image }, now);
}

export function parseYgoEvents(html, now = Date.now()) {
  const input = String(html).slice(0, MAX_BYTES), at = input.indexOf('Upcoming Events'); if (at < 0) return [];
  const out = [];
  for (const m of input.slice(at).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const p = [...m[2].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(x => communityText(x[1]));
    const d = p[2]?.match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})$/); if (!d) continue;
    const startsAt = date(`${d[3]}-${d[1]}-${d[2]}`), endsAt = date(`${d[6]}-${d[4]}-${d[5]}`);
    if (!startsAt || !endsAt || Date.parse(endsAt) + COMMUNITY_DAY <= now || Date.parse(startsAt) > now + 90 * COMMUNITY_DAY) continue;
    let u; try { u = new URL(attrs(m[1]).href, YGO_EVENTS); } catch { continue; }
    if (u.origin !== 'https://www.yugioh-card.com' || !/^\/en\/events-item\/[a-z0-9-]+\/$/.test(u.pathname) || u.search || u.hash || u.username || u.password) continue;
    out.push({ id: u.href, game: 'ygo', kind: 'event', title: p[0], summary: p[1], url: u.href, source: 'Konami', sourceUrl: YGO_EVENTS, publishedAt: '', startsAt, endsAt, dateLabel: 'Event dates', fetchedAt: iso(now), stale: false });
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 3);
}

export function retainCommunityItems(items, now = Date.now()) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(x => {
    if (!x?.id || seen.has(x.id) || !COMMUNITY_SOURCES[x.game] || !Number.isFinite(Date.parse(x.fetchedAt))) return false;
    const n = Date.parse(x.kind === 'event' ? x.endsAt : x.publishedAt);
    if (!Number.isFinite(n) || now - Date.parse(x.fetchedAt) > COMMUNITY_RETENTION || (x.kind === 'event' ? n + COMMUNITY_DAY <= now : n > now || now - n > COMMUNITY_RETENTION)) return false;
    seen.add(x.id); return true;
  }).sort((a, b) => (Number(b.important) || 0) - (Number(a.important) || 0) || String(b.publishedAt || b.startsAt).localeCompare(String(a.publishedAt || a.startsAt))).slice(0, MAX_ITEMS);
}

async function boundedHtml(url, fetchImpl) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6500);
  try {
    const r = await fetchImpl(url, { redirect: 'error', signal: controller.signal, headers: { Accept: 'text/html', 'User-Agent': 'CardStashy (public publisher news; cached daily)' } });
    if (!r.ok) throw Error(`Publisher returned ${r.status}`);
    if (!/text\/html|application\/xhtml/i.test(r.headers.get('Content-Type') || '')) throw Error('Publisher did not return a news page');
    if (Number(r.headers.get('Content-Length')) > MAX_BYTES) throw Error('Publisher page exceeded the size limit');
    const reader = r.body?.getReader(); if (!reader) throw Error('Publisher returned an empty page');
    let size = 0, text = ''; const decoder = new TextDecoder();
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw Error('Publisher page exceeded the size limit'); } text += decoder.decode(value, { stream: true }); } } finally { reader.releaseLock(); }
    return text + decoder.decode();
  } finally { clearTimeout(timer); }
}

async function refresh(game, previous, cache, key, fetchImpl, now) {
  let items = [], good = false; const errors = [], sources = [];
  const source = COMMUNITY_SOURCES[game];
  try {
    const candidates = parseNewsIndex(game, await boundedHtml(source.url, fetchImpl));
    if (!candidates.length) throw Error('Automatic headlines unavailable from this publisher');
    if (game === 'ygo') { items = candidates.map(x => news(game, x, now)).filter(Boolean); good = true; }
    else {
      const settled = await Promise.allSettled(candidates.map(async c => {
        const parsed = parseNewsArticle(game, await boundedHtml(c.url, fetchImpl), c, now);
        // Undated or older articles are not promoted to today's news.
        return parsed;
      }));
      items = settled.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
      good = settled.some(x => x.status === 'fulfilled');
      if (settled.some(x => x.status === 'rejected')) errors.push('Some publisher articles could not be checked');
    }
    sources.push({ name: source.name, url: source.url, checkedAt: iso(now), status: good ? 'checked' : 'unavailable' });
  } catch (e) { errors.push(String(e.message).slice(0, 150)); sources.push({ name: source.name, url: source.url, checkedAt: iso(now), status: 'unavailable' }); }
  if (game === 'ygo') {
    try {
      const events = parseYgoEvents(await boundedHtml(YGO_EVENTS, fetchImpl), now);
      if (!events.length) throw Error('No dated upcoming events could be verified');
      items.push(...events); good = true; sources.push({ name: 'Konami events', url: YGO_EVENTS, checkedAt: iso(now), status: 'checked' });
    } catch (e) { errors.push(String(e.message).slice(0, 150)); sources.push({ name: 'Konami events', url: YGO_EVENTS, checkedAt: iso(now), status: 'unavailable' }); }
  }
  const retained = (previous?.items || []).map(x => ({ ...x, stale: true }));
  const body = { game, items: retainCommunityItems([...items, ...retained], now), sources, checkedAt: iso(now), fetchedAt: good ? iso(now) : previous?.fetchedAt || '', nextCheckAt: iso(now + COMMUNITY_DAY), stale: errors.length > 0, error: errors.join('. '), status: good ? errors.length ? 'partial' : 'ready' : 'unavailable' };
  snapshots.set(game, body);
  if (cache) { try { await cache.put(key, json(body, 200, COMMUNITY_RETENTION / 1000)); } catch {} }
  return body;
}

export async function communityFeedRoute(request, url, ctx, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405, 0);
  const game = url.searchParams.get('game');
  if (!Object.hasOwn(COMMUNITY_SOURCES, game || '') || [...url.searchParams.keys()].some(k => k !== 'game') || url.searchParams.getAll('game').length !== 1) return json({ error: 'Choose mtg, ptcg or ygo only' }, 400, 0);
  const key = new Request(`https://cardforge.cache/community/v1/${game}`);
  let old = null; try { old = await (await cache?.match(key))?.json(); } catch {}
  const memory = snapshots.get(game);
  if (memory && (!old || Date.parse(memory.checkedAt) > Date.parse(old.checkedAt))) old = memory;
  if (old && Date.parse(old.nextCheckAt) > now && Date.parse(old.checkedAt) <= now) return json({ ...old, items: retainCommunityItems(old.items, now) });
  if (!pending.has(game)) pending.set(game, refresh(game, old, cache, key, fetchImpl, now).finally(() => pending.delete(game)));
  return json(await pending.get(game));
}
