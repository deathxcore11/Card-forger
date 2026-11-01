// The live news pulse for Home: each game's subreddit (hot posts, news and spoilers first) and one public
// article feed. Keyless sources only. The worker serves /api/news (edge-cached half an hour); when Reddit
// refuses the worker, the browser asks Reddit itself (its JSON listings answer any origin). Rows come out
// in the community feed's news shape, so community-feed.js validates and draws them like any other story.
import { NEWS_SOURCES, PULSE_SOURCES, safeNewsArticle, safeNewsImage } from './community-sources.js';

export const PULSE_TTL = 30 * 60000;
export const PULSE_MAX_AGE = 4 * 864e5;
const MAX_REDDIT = 10, MAX_FEED = 6;
const iso = n => new Date(n).toISOString();
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', '#39': "'" };
export function pulseText(value, max = 180) {
  const s = String(value ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, k) => k[0] !== '#' ? ENTITIES[k.toLowerCase()] ?? all : (n => n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '')(k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)))
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
}
const compact = n => n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n);
// News, spoilers, events and discussion come first; memes, pulls, collection shots and help threads never show.
const NEWSY = /news|spoiler|leak|announce|event|tournament|competitive|ban|limit|rules|product|release|article|discussion|reveal|meta|official|card ruling|data/i;
const NOISE = /meme|humou?r|fluff|shitpost|pulls?\b|collection|art\b|cosplay|custom|altered|help|question|q&a|sale|trade|giveaway|deck ?help|rate|value|lgs|grading|show ?off|mail ?day/i;
const TITLE_NOISE = /\b(?:my pulls?|pulled|mail ?day|rate my|what(?:'s| is) (?:it|this) worth|price check|help me|wtb|wts|lf\b|for trade|daily (?:q&a|question)|weekly (?:q&a|question|thread))\b/i;
// One Reddit listing ({data:{children}}) → pulse rows. Stickied mod threads, NSFW, removed and low-signal posts are dropped.
export function parseRedditListing(game, listing, now = Date.now()) {
  const sourceId = PULSE_SOURCES[game]?.[0], source = NEWS_SOURCES[sourceId];
  if (!source) return [];
  const rows = [];
  for (const child of (Array.isArray(listing?.data?.children) ? listing.data.children : []).slice(0, 100)) {
    const p = child?.data;
    if (!p || child.kind !== 't3' || p.stickied || p.over_18 || p.removed_by_category || p.spoiler && !/spoiler/i.test(p.link_flair_text || '')) continue;
    const flair = pulseText(p.link_flair_text, 40), title = pulseText(p.title, 180), score = Number(p.score) || 0, comments = Number(p.num_comments) || 0, created = Number(p.created_utc) * 1000;
    if (!title || !Number.isFinite(created) || now - created > PULSE_MAX_AGE || created > now + 60000) continue;
    if (NOISE.test(flair) && !NEWSY.test(flair) || TITLE_NOISE.test(title)) continue;
    const newsy = NEWSY.test(flair);
    if (score < (newsy ? 15 : 60)) continue;
    const url = safeNewsArticle(`https://www.reddit.com${String(p.permalink || '').replace(/\?.*$/, '')}`, game, sourceId, 'news');
    if (!url) continue;
    const preview = p.preview?.images?.[0], sized = [...(preview?.resolutions || [])].reverse().find(r => r.width <= 960) || preview?.source;
    const image = safeNewsImage(pulseText(sized?.url, 2048), game, sourceId, url, 'news') || (p.post_hint === 'image' ? safeNewsImage(String(p.url || ''), game, sourceId, url, 'news') : '');
    const self = pulseText(p.selftext, 150);
    const hot = (Math.log10(Math.max(1, score + comments * 2)) + (newsy ? 1.2 : 0)) / Math.pow((now - created) / 36e5 + 2, 0.45);
    rows.push({ id: url, sourceId, game, kind: 'news', category: 'Community', scope: flair, title, summary: [self, `${compact(score)} upvotes · ${compact(comments)} comments`].filter(Boolean).join(' · '),
      url, source: source.name, sourceUrl: source.url, publishedAt: iso(created), dateLabel: 'Posted', fetchedAt: iso(now), image, pulse: hot });
  }
  return rows.sort((a, b) => b.pulse - a.pulse).slice(0, MAX_REDDIT);
}
// One RSS 2.0 or Atom document → pulse rows from the game's article feed.
export function parseFeed(game, xml, now = Date.now()) {
  const sourceId = PULSE_SOURCES[game]?.[1], source = NEWS_SOURCES[sourceId];
  if (!source || typeof xml !== 'string') return [];
  const tag = (block, name) => block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
  const rows = [];
  for (const m of xml.slice(0, 1500000).matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const block = m[2];
    const link = pulseText(tag(block, 'link'), 2048) || (block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || '');
    let url = '';
    try { const u = new URL(link.trim()); u.search = ''; u.hash = ''; url = safeNewsArticle(u.href, game, sourceId, 'news'); } catch {}
    const title = pulseText(tag(block, 'title'), 180), when = Date.parse(pulseText(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date'), 60));
    if (!url || !title || !Number.isFinite(when) || when > now + 60000 || now - when > PULSE_MAX_AGE * 2) continue;
    rows.push({ id: url, sourceId, game, kind: 'news', category: '', scope: '', title, summary: pulseText(tag(block, 'description') || tag(block, 'summary'), 170),
      url, source: source.name, sourceUrl: source.url, publishedAt: iso(when), dateLabel: 'Published', fetchedAt: iso(now), image: '', pulse: 2 / Math.pow((now - when) / 36e5 + 2, 0.45) });
    if (rows.length >= MAX_FEED) break;
  }
  return rows;
}
export const redditListingUrl = game => `https://www.reddit.com/r/${NEWS_SOURCES[PULSE_SOURCES[game][0]].sub}/hot.json?limit=50&raw_json=1`;
// Publisher stories and community posts take turns, so neither crowds the other out.
export function mergePulse(...groups) {
  const lists = groups.map(g => (Array.isArray(g) ? g : []).slice().sort((a, b) => (b.pulse || 0) - (a.pulse || 0))), out = [], seen = new Set();
  for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) { const row = l[i]; if (row && !seen.has(row.url)) { seen.add(row.url); out.push(row); } }
  return out.slice(0, 16);
}

// ---- Browser side: one half-hourly pulse per game, kept in localStorage so Home paints instantly. ----
const KEY = 'cardforge-pulse-v1', states = Object.create(null);
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
export function pulseState(game) {
  if (!states[game]) {
    let saved = null; try { saved = JSON.parse(store()?.getItem(KEY) || '{}')[game]; } catch {}
    states[game] = { items: Array.isArray(saved?.items) ? saved.items.slice(0, 20) : [], at: Number(saved?.at) || 0, busy: false, promise: null };
  }
  return states[game];
}
async function readJson(fetchImpl, url, ms, init = {}) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetchImpl(url, { ...init, signal: c.signal, credentials: 'omit', headers: { Accept: 'application/json' } }); if (!r.ok) throw Error(`News returned ${r.status}`); const text = await r.text(); if (text.length > 3e6) throw Error('News response too large'); return JSON.parse(text); }
  finally { clearTimeout(t); }
}
export function loadPulse(game, { fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  if (!PULSE_SOURCES[game]) return Promise.resolve([]);
  const s = pulseState(game);
  if (s.busy) return s.promise;
  if (s.at && now - s.at < PULSE_TTL && now >= s.at) return Promise.resolve(s.items);
  s.busy = true;
  s.promise = (async () => {
    let rows = [], hasReddit = false;
    try { const body = await readJson(fetchImpl, `api/news?game=${game}`, 12000); rows = Array.isArray(body?.items) ? body.items : []; hasReddit = rows.some(r => /^reddit-/.test(r?.sourceId)); } catch {}
    // The worker's Reddit call is often refused from datacenter addresses; the browser's is not.
    if (!hasReddit) { try { rows = mergePulse(rows.filter(r => !/^reddit-/.test(r?.sourceId)), parseRedditListing(game, await readJson(fetchImpl, redditListingUrl(game), 9000), now)); } catch {} }
    if (rows.length) { s.items = rows.slice(0, 16); s.at = now; }
    else s.at = now - PULSE_TTL + 5 * 60000; // nothing new: keep the last pulse, try again in five minutes
    try { const all = JSON.parse(store()?.getItem(KEY) || '{}'); all[game] = { at: s.at, items: s.items }; store()?.setItem(KEY, JSON.stringify(all)); } catch {}
    return s.items;
  })().finally(() => { s.busy = false; });
  return s.promise;
}
