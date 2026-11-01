// The live news pulse for Home: each game's subreddits (hot posts, news and spoilers first) and public
// article feeds. Keyless sources only. The worker serves /api/news (edge-cached half an hour); when Reddit
// refuses the worker, the browser asks Reddit itself (its JSON listings answer any origin). Rows come out
// in the community feed's news shape, so community-feed.js validates and draws them like any other story.
// Every story gets its own picture where one exists: the post's image or gallery, the article's feed or
// page image, else the card its headline names (cardForTitle), drawn from the app's own card art.
import { NEWS_SOURCES, PULSE_SOURCES, safeNewsArticle, safeNewsImage, safeNewsCardArt } from './community-sources.js';

export const PULSE_TTL = 30 * 60000;
export const PULSE_MAX_AGE = 4 * 864e5;
const MAX_REDDIT = 10, MAX_FEED = 6, MAX_CARD_LOOKUPS = 10;
const iso = n => new Date(n).toISOString();
export const redditIds = game => (PULSE_SOURCES[game] || []).filter(id => NEWS_SOURCES[id]?.sub);
export const feedIds = game => (PULSE_SOURCES[game] || []).filter(id => NEWS_SOURCES[id]?.feed);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', eacute: 'é' };
const decode = s => String(s ?? '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, k) => k[0] !== '#' ? ENTITIES[k.toLowerCase()] ?? all : (n => n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '')(k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)));
export function pulseText(value, max = 180) {
  // Feeds escape their HTML once more (&lt;p&gt;), so entities are decoded before tags are removed.
  const s = decode(decode(String(value ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
}
const compact = n => n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n);
// News, spoilers, events and discussion come first; memes, pulls, collection shots and help threads never show.
const NEWSY = /news|spoiler|leak|announce|event|tournament|competitive|ban|limit|rules|product|release|article|discussion|reveal|meta|official|card ruling|data|deck ?list|results/i;
const NOISE = /meme|humou?r|fluff|shitpost|pulls?\b|collection|art\b|cosplay|custom|altered|help|question|q&a|sale|trade|giveaway|deck ?help|rate|value|lgs|grading|show ?off|mail ?day/i;
const TITLE_NOISE = /\b(?:my pulls?|pulled|mail ?day|rate my|what(?:'s| is) (?:it|this) worth|price check|help me|wtb|wts|lf\b|for trade|daily (?:q&a|question)|weekly (?:q&a|question|thread))\b/i;
const hotness = (score, comments, newsy, created, now) => (Math.log10(Math.max(1, score + comments * 2)) + (newsy ? 1.2 : 0)) / Math.pow((now - created) / 36e5 + 2, 0.45);
// One Reddit listing ({data:{children}}) → pulse rows. Stickied mod threads, NSFW, removed and low-signal posts are dropped.
export function parseRedditListing(game, listing, now = Date.now(), sourceId = redditIds(game)[0]) {
  const source = NEWS_SOURCES[sourceId];
  if (!source?.sub || source.game !== game) return [];
  const rows = [];
  for (const child of (Array.isArray(listing?.data?.children) ? listing.data.children : []).slice(0, 100)) {
    const p = child?.data;
    if (!p || child.kind !== 't3' || p.stickied || p.over_18 || p.removed_by_category || p.spoiler && !/spoiler/i.test(p.link_flair_text || '')) continue;
    const flair = pulseText(p.link_flair_text, 40), title = pulseText(p.title, 180), score = Number(p.score) || 0, comments = Number(p.num_comments) || 0, created = Number(p.created_utc) * 1000;
    if (!title || !Number.isFinite(created) || now - created > PULSE_MAX_AGE || created > now + 60000) continue;
    if (NOISE.test(flair) && !NEWSY.test(flair) || TITLE_NOISE.test(title)) continue;
    const newsy = NEWSY.test(flair);
    if (score < (newsy ? 8 : 30)) continue;
    const url = safeNewsArticle(`https://www.reddit.com${String(p.permalink || '').replace(/\?.*$/, '')}`, game, sourceId, 'news');
    if (!url) continue;
    const img = v => safeNewsImage(pulseText(v, 2048), game, sourceId, url, 'news');
    const preview = p.preview?.images?.[0], sized = [...(preview?.resolutions || [])].reverse().find(r => r.width <= 960) || preview?.source;
    const gallery = p.media_metadata && Object.values(p.media_metadata).find(m => m?.status === 'valid' && m.e === 'Image');
    const gallerySized = gallery && ([...(gallery.p || [])].reverse().find(r => r.x <= 960)?.u || gallery.s?.u);
    const image = img(sized?.url) || img(gallerySized) || (p.post_hint === 'image' ? img(p.url) : '') || img(p.thumbnail);
    const self = pulseText(p.selftext, 150);
    rows.push({ id: url, sourceId, game, kind: 'news', category: 'Community', scope: flair, title, summary: [self, `${compact(score)} upvotes · ${compact(comments)} comments`].filter(Boolean).join(' · '),
      url, source: source.name, sourceUrl: source.url, publishedAt: iso(created), dateLabel: 'Posted', fetchedAt: iso(now), image, pulse: hotness(score, comments, newsy, created, now) });
  }
  return rows.sort((a, b) => b.pulse - a.pulse).slice(0, MAX_REDDIT);
}
const tag = (block, name) => block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
const attr = (block, re) => decode(block.match(re)?.[1] || '');
// Reddit's Atom feed: the fallback when its JSON refuses a server. No scores, so only headline filters apply.
export function parseRedditAtom(game, xml, now = Date.now(), sourceId = redditIds(game)[0]) {
  const source = NEWS_SOURCES[sourceId];
  if (!source?.sub || typeof xml !== 'string') return [];
  const rows = [];
  for (const m of xml.slice(0, 2e6).matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const block = m[1], title = pulseText(tag(block, 'title'), 180), when = Date.parse(pulseText(tag(block, 'published') || tag(block, 'updated'), 60));
    let url = ''; try { const u = new URL(attr(block, /<link\b[^>]*href=["']([^"']+)["']/i)); u.search = ''; url = safeNewsArticle(u.href, game, sourceId, 'news'); } catch {}
    const flair = attr(block, /<category\b[^>]*label=["']([^"']*)["']/i);
    if (!url || !title || !Number.isFinite(when) || now - when > PULSE_MAX_AGE || TITLE_NOISE.test(title) || NOISE.test(flair) && !NEWSY.test(flair)) continue;
    const content = decode(tag(block, 'content')), image = [...content.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)].map(x => safeNewsImage(decode(x[1]), game, sourceId, url, 'news')).find(Boolean) || '';
    rows.push({ id: url, sourceId, game, kind: 'news', category: 'Community', scope: '', title, summary: '', url, source: source.name, sourceUrl: source.url, publishedAt: iso(when), dateLabel: 'Posted', fetchedAt: iso(now), image, pulse: hotness(0, 0, NEWSY.test(title), when, now) });
    if (rows.length >= MAX_REDDIT) break;
  }
  return rows;
}
// A physical-card story from a publisher that also covers video games and the anime.
const TCG_STORY = /\bTCG\b|Trading Card|\bcards?\b|expansion|booster|Championship|Play! Pok|\bdeck|tournament|Elite Trainer|prerelease|collection box/i;
// One RSS 2.0 or Atom document → pulse rows, each with its feed image when the feed carries one.
export function parseFeed(game, xml, now = Date.now(), sourceId = feedIds(game)[0]) {
  const source = NEWS_SOURCES[sourceId];
  if (!source?.feed || source.game !== game || typeof xml !== 'string') return [];
  const rows = [];
  for (const m of xml.slice(0, 2e6).matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const block = m[2];
    const link = pulseText(tag(block, 'link'), 2048) || attr(block, /<link\b[^>]*href=["']([^"']+)["']/i);
    let url = '';
    try { const u = new URL(link.trim()); u.search = ''; u.hash = ''; url = safeNewsArticle(u.href, game, sourceId, 'news'); } catch {}
    const title = pulseText(tag(block, 'title'), 180), when = Date.parse(pulseText(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date'), 60));
    const body = tag(block, 'content:encoded') || tag(block, 'content') || tag(block, 'description') || tag(block, 'summary');
    if (!url || !title || !Number.isFinite(when) || when > now + 60000 || now - when > PULSE_MAX_AGE * 2) continue;
    if (source.tcgOnly && !TCG_STORY.test(title + ' ' + pulseText(tag(block, 'description') || body, 400))) continue;
    const clean = v => { try { const u = new URL(decode(v).trim()); u.search = ''; return safeNewsImage(u.href, game, sourceId, url, 'news'); } catch { return ''; } };
    const html = decode(decode(body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')));
    const image = [attr(block, /<media:(?:content|thumbnail)\b[^>]*url=["']([^"']+)["']/i), attr(block, /<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image/i), ...[...html.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)].map(x => x[1])].map(clean).find(Boolean) || '';
    rows.push({ id: url, sourceId, game, kind: 'news', category: '', scope: '', title, summary: pulseText(tag(block, 'description') || tag(block, 'summary') || body, 170),
      url, source: source.name, sourceUrl: source.url, publishedAt: iso(when), dateLabel: 'Published', fetchedAt: iso(now), image, pulse: 2 / Math.pow((now - when) / 36e5 + 2, 0.45) });
    if (rows.length >= MAX_FEED) break;
  }
  return rows;
}
// An article page's own share image (og:image / twitter:image), checked against the feed's image domains.
export function pageImage(row, html) {
  if (typeof html !== 'string') return '';
  for (const m of html.slice(0, 600000).matchAll(/<meta\b([^>]*)>/gi)) {
    const a = m[1], key = (a.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
    if (!['og:image', 'og:image:secure_url', 'twitter:image'].includes(key)) continue;
    try { const u = new URL(decode(a.match(/content=["']([^"']+)["']/i)?.[1] || '').trim(), row.url); u.search = ''; const ok = safeNewsImage(u.href, row.game, row.sourceId, row.url, 'news'); if (ok) return ok; } catch {}
  }
  return '';
}
export const redditListingUrl = (game, sourceId = redditIds(game)[0]) => `https://www.reddit.com/r/${NEWS_SOURCES[sourceId].sub}/hot.json?limit=50&raw_json=1`;
export const redditAtomUrl = (game, sourceId = redditIds(game)[0]) => `https://www.reddit.com/r/${NEWS_SOURCES[sourceId].sub}/hot/.rss?limit=40`;

// ---- Stand-in art: the card a headline names, looked up exactly (never a guess from a fuzzy match). ----
const STOP = new Set('a an the new my our your this that these those just psa til is are was why how what when who any does do did can could would should will i im i\'m me we you got finally first best top official today daily weekly leak leaked spoiler spoilers reveal revealed preview announced announcement update news discussion thoughts opinion unpopular hot take tcg ocg pokemon pokémon magic mtg yugioh yu-gi-oh ygo card cards deck decks set sets booster pack packs box art and or of to from in on for with vs at by it its if not no yes all every some more most set'.split(' '));
const CONNECT = new Set(['of', 'the', 'and', 'to', 'from', 'in', 'a', 'de', 'ex', 'gx', 'v', 'vmax', 'vstar']);
export function titleCandidates(game, title) {
  const text = String(title || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[|:;!?]+/g, ' | ');
  const out = [], push = s => { s = s.replace(/^[\s,'’".-]+|[\s,'’".-]+$/g, '').replace(/\s+/g, ' '); if (s.length >= 3 && s.length <= 60 && !STOP.has(s.toLowerCase()) && !out.includes(s)) out.push(s); };
  for (const m of text.matchAll(/["“]([^"”]{3,60})["”]/g)) push(m[1]);
  const words = text.split(/\s+/).filter(Boolean), runs = []; let run = [];
  const cap = w => /^[A-Z0-9][\w'’\-,.é]*$/.test(w) && !STOP.has(w.replace(/[,.'’]+$/, '').toLowerCase());
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (cap(w) || run.length && CONNECT.has(w.toLowerCase()) && (game === 'ptcg' && /^(?:ex|gx|v|vmax|vstar)$/i.test(w) || words[i + 1] && cap(words[i + 1]))) run.push(w);
    else { if (run.length) runs.push(run); run = []; }
    if (/[,]$/.test(w) && !(game === 'mtg' && run.length)) { if (run.length) runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  runs.sort((a, b) => b.length - a.length);
  for (const r of runs) { if (r.length >= 2) push(r.join(' ')); if (r.length >= 3) push(r.slice(1).join(' ')); }
  if (game === 'ptcg' || game === 'ygo') for (const r of runs) for (const w of r) if (!CONNECT.has(w.toLowerCase())) push(w);
  return out.slice(0, 4);
}
const artMemo = new Map();
async function cardArt(game, name, fetchJson) {
  const key = `${game}|${name.toLowerCase()}`;
  if (!artMemo.has(key)) {
    artMemo.set(key, (async () => {
      if (game === 'mtg') { const c = await fetchJson(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`); return safeNewsCardArt({ name: c?.name, url: c?.image_uris?.art_crop || c?.card_faces?.[0]?.image_uris?.art_crop }, game); }
      if (game === 'ygo') { const c = (await fetchJson(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`))?.data?.[0]; return c?.id ? safeNewsCardArt({ name: c.name, url: `img/ygo/a/${Number(c.id)}.jpg` }, game) : null; }
      if (game === 'ptcg') { const list = await fetchJson(`https://api.tcgdex.net/v2/en/cards?name=eq:${encodeURIComponent(name)}`); const c = (Array.isArray(list) ? list : []).filter(x => x?.image).at(-1); return c ? safeNewsCardArt({ name: c.name, url: `${c.image}/high.webp` }, game) : null; }
      return null;
    })().catch(() => null));
    if (artMemo.size > 500) artMemo.delete(artMemo.keys().next().value);
  }
  return artMemo.get(key);
}
// Rows without a picture get the card their headline names; at most MAX_CARD_LOOKUPS lookups per pass.
export async function addCardArt(game, rows, fetchJson) {
  let budget = MAX_CARD_LOOKUPS;
  for (const row of rows) {
    if (row.image || row.cardArt) continue;
    for (const name of titleCandidates(game, row.title)) {
      if (budget-- <= 0) return rows;
      const art = await cardArt(game, name, fetchJson);
      if (art) { row.cardArt = art; break; }
    }
  }
  return rows;
}
// Publisher stories and community posts take turns, so neither crowds the other out.
export function mergePulse(...groups) {
  const lists = groups.map(g => (Array.isArray(g) ? g : []).slice().sort((a, b) => (b.pulse || 0) - (a.pulse || 0))), out = [], seen = new Set();
  for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) { const row = l[i]; if (row && !seen.has(row.url)) { seen.add(row.url); out.push(row); } }
  return out.slice(0, 16);
}

// ---- Browser side: one half-hourly pulse per game, kept in localStorage so Home paints instantly. ----
const KEY = 'cardforge-pulse-v2', states = Object.create(null);
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
    let rows = [];
    try { const body = await readJson(fetchImpl, `api/news?game=${game}`, 14000); rows = Array.isArray(body?.items) ? body.items : []; } catch {}
    // The worker's Reddit call is often refused from datacenter addresses; the browser's is not.
    const missing = redditIds(game).filter(id => !rows.some(r => r?.sourceId === id));
    if (missing.length) {
      const extra = await Promise.all(missing.map(id => readJson(fetchImpl, redditListingUrl(game, id), 9000).then(l => parseRedditListing(game, l, now, id)).catch(() => [])));
      rows = mergePulse(rows.filter(r => !/^reddit-/.test(r?.sourceId)), ...redditIds(game).map(id => rows.filter(r => r?.sourceId === id)), ...extra);
      await addCardArt(game, rows, url => readJson(fetchImpl, url, 6000)).catch(() => {});
    }
    if (rows.length) { s.items = rows.slice(0, 16); s.at = now; }
    else s.at = now - PULSE_TTL + 5 * 60000; // nothing new: keep the last pulse, try again in five minutes
    try { const all = JSON.parse(store()?.getItem(KEY) || '{}'); all[game] = { at: s.at, items: s.items }; store()?.setItem(KEY, JSON.stringify(all)); } catch {}
    return s.items;
  })().finally(() => { s.busy = false; });
  return s.promise;
}
