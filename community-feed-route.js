// Public, keyless news. Fixed sources, six pages total/game/day, no credentials,
// caller-provided URLs or redirect following. Failed attempts are cached too.
import { NEWS_SOURCES, GAME_NEWS_SOURCES, newsSource, safeNewsArticle, safeNewsImage } from './community-sources.js';
export const COMMUNITY_DAY = 864e5;
export const COMMUNITY_RETENTION = 7 * COMMUNITY_DAY;
export const COMMUNITY_SOURCES = Object.freeze(Object.fromEntries(Object.entries(GAME_NEWS_SOURCES).map(([game, ids]) => [game, NEWS_SOURCES[ids[0]]])));
export const COMMUNITY_FETCH_LIMIT = 6;
const MAX_BYTES = 1024 * 1024, MAX_ARTICLES = 4, MAX_ITEMS = 18;
const pending = new Map(), snapshots = new Map();
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
const cleanMarkup = html => String(html).slice(0, MAX_BYTES).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
// Small balanced element reader. Nested containers stay inside their own card;
// adjacent cards/sections can never supply dates, titles or images by accident.
function elements(html, tag) {
  const out = [], stack = [], regex = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  for (const m of html.matchAll(regex)) {
    if (/^<\//.test(m[0])) {
      const open = stack.pop();
      if (open) out.push({ ...open, end: m.index + m[0].length, inner: html.slice(open.contentStart, m.index), full: html.slice(open.start, m.index + m[0].length) });
    } else if (!/\/>$/.test(m[0])) stack.push({ start: m.index, contentStart: m.index + m[0].length, attrs: attrs(m[0]) });
  }
  return out.sort((a, b) => a.start - b.start);
}
function absolute(value, sourceId) {
  try { return new URL(value, NEWS_SOURCES[sourceId].url).href; } catch { return ''; }
}
function date(value) {
  const v = communityText(value, 60);
  if (!/^(?:\d{4}-\d{2}-\d{2}(?:T[\d:.+Z-]+)?|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})$/.test(v)) return '';
  const dayOnly = !v.includes('T'), n = Date.parse(dayOnly && !/^\d{4}-/.test(v) ? v + ' UTC' : v);
  if (!Number.isFinite(n)) return '';
  const isoDay = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDay && (!Number.isFinite(Date.parse(isoDay[1])) || iso(Date.parse(isoDay[1])).slice(0, 10) !== isoDay[1])) return '';
  const humanDay = v.match(/^(?:[A-Za-z]{3,9}\s+)?(\d{1,2})(?:,?\s+[A-Za-z]{3,9})?[, ]+20\d{2}$/);
  if (dayOnly && humanDay && new Date(n).getUTCDate() !== Number(humanDay[1])) return '';
  return dayOnly ? iso(n).slice(0, 10) : iso(n);
}
const digital = value => /\b(?:Pocket|TCG Live|PTCGL|Master\s*Duel|Duel\s*Links|Rush\s*Duel|RushDuel)\b|\[RD\]|\[DL\]|\[MD\]/i.test(value);
const physicalPokemon = value => !digital(value) && /\bTCG\b|Trading Card Game|card gym|promo cards?|pokemon cards?|booster|expansion|deck|elite trainer|collection box/i.test(value);
function storyScope(sourceId, row) {
  if (sourceId === 'serebii') return row.scope === 'TCG and other games' ? row.scope : 'Physical Pokémon TCG';
  if (sourceId === 'pokeguardian') return /\bJapan|Japanese|Card Gym/i.test(row.title) ? 'Pokémon TCG · Japan' : 'Physical Pokémon TCG';
  if (sourceId === 'ygorganization') return /\bOCG\b|Japan|Japanese|\b[A-Z0-9]{2,8}-JP\d{2,4}\b/i.test(row.region || '') ? 'OCG · Japan' : 'OCG/TCG coverage';
  return '';
}
function summary(sourceId, scope) {
  if (sourceId === 'ygorganization') return `${scope === 'OCG · Japan' ? 'Japanese OCG news' : 'Physical-card news'} via YGOrganization. OCG announcements do not establish TCG release dates or legality.`;
  if (scope === 'TCG and other games') return 'Regional championship coverage including the physical TCG and other Pokémon games. See Serebii for the full schedule.';
  return NEWS_SOURCES[sourceId].official ? 'Read the full announcement from the game’s official team.' : `Read the physical-card news at ${NEWS_SOURCES[sourceId].name}; regional releases may differ.`;
}
function news(game, sourceId, row, now) {
  const url = safeNewsArticle(row.url, game, sourceId), publishedAt = date(row.publishedAt), title = communityText(row.title);
  const age = now - Date.parse(publishedAt);
  if (!url || !title || !publishedAt || age < 0 || age > COMMUNITY_RETENTION || digital(title + ' ' + (row.categories || ''))) return null;
  if (sourceId === 'wizards' && /\bArena\b|Competitive Brawl/i.test(title)) return null;
  const source = NEWS_SOURCES[sourceId], scope = storyScope(sourceId, row);
  return { id: sourceId === 'serebii' ? `${url}#${encodeURIComponent(title)}` : url, sourceId, game, kind: 'news', title, scope, summary: summary(sourceId, scope), evidence: communityText(row.evidence || row.description, 480), url, source: source.name, sourceUrl: source.url, publishedAt, dateLabel: 'Published', fetchedAt: iso(now), image: safeNewsImage(row.image, game, sourceId, url), important: /bann|restrict|rules|policy|errata|championship|replacement/i.test(title), stale: false };
}
function anchors(html, sourceId, game) {
  return elements(html, 'a').map(a => ({ ...a, url: safeNewsArticle(absolute(a.attrs.href || '', sourceId), game, sourceId), title: communityText(a.inner) })).filter(a => a.url && a.title);
}
function firstImage(html, sourceId) {
  const m = html.match(/<img\b([^>]*)>/i);
  return m ? absolute(attrs(m[1]).src || attrs(m[1])['data-src'] || '', sourceId) : '';
}
export function parseSerebiiIndex(html) {
  const input = cleanMarkup(html), out = [];
  for (const post of elements(input, 'div').filter(node => hasClass(node, 'post'))) {
    const heading = elements(post.inner, 'h2')[0], link = heading && elements(heading.inner, 'a')[0];
    const url = link && safeNewsArticle(absolute(link.attrs.href || '', 'serebii'), 'ptcg', 'serebii');
    const day = elements(post.inner, 'span').find(node => hasClass(node, 'date'));
    const dayText = day && communityText(day.inner), numericDay = dayText?.match(/^(\d{2})-(\d{2})-(20\d{2})(?:\s|$)/);
    const publishedAt = numericDay ? date(`${numericDay[3]}-${numericDay[2]}-${numericDay[1]}`) : date(dayText?.replace(/^(?:Mon|Tues?|Wed(?:nes)?|Thurs?|Fri|Satur|Sun)day\s*[:,]?\s*/i, '').replace(/(\d)(?:st|nd|rd|th)\b/g, '$1'));
    const pathDay = url?.match(/\/(\d{2})-([A-Za-z]+)-(20\d{2})\.shtml$/);
    if (pathDay && date(`${pathDay[1]} ${pathDay[2]} ${pathDay[3]}`) !== publishedAt) continue;
    if (!url || !publishedAt) continue;
    const sections = elements(post.inner, 'div').filter(node => hasClass(node, 'pics') || hasClass(node, 'subcat'));
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]; if (!hasClass(section, 'subcat')) continue;
      const text = communityText(section.inner, 6000), department = elements(section.inner, 'h3')[0] || elements(section.inner, 'h4')[0];
      const label = department ? communityText(department.inner) : '';
      const titleNode = elements(section.inner, 'p').find(node => hasClass(node, 'title'));
      const title = titleNode ? communityText(titleNode.inner) : '';
      const physical = /Trading Card Game/i.test(label) && !digital(label + ' ' + title);
      const championship = /Championship/i.test(label) && /\bTCG\b|Trading Card Game/i.test(text);
      if (!title || (!physical && !championship) || digital(label + ' ' + title)) continue;
      const previous = sections[i - 1];
      // Whitespace/comments are the only allowed gap between the paired siblings.
      const adjacent = previous && hasClass(previous, 'pics') && !post.inner.slice(previous.end, section.start).replace(/<!--[\s\S]*?-->/g, '').trim();
      out.push({ sourceId: 'serebii', url, title, publishedAt, image: adjacent ? firstImage(previous.inner, 'serebii') : '', evidence: text.replace(label, '').replace(title, '').trim().slice(0, 480), scope: championship ? 'TCG and other games' : 'Physical Pokémon TCG' });
    }
  }
  return out.slice(0, 18);
}
export function parseNewsIndex(game, html, sourceId = GAME_NEWS_SOURCES[game]?.[0]) {
  if (!newsSource(sourceId, game)) return [];
  const input = cleanMarkup(html), out = [], seen = new Set();
  if (sourceId === 'serebii') return parseSerebiiIndex(input);
  if (sourceId === 'konami') {
    for (const item of elements(input, 'li').filter(node => hasClass(node, 'clear'))) {
      const copy = elements(item.inner, 'section').find(node => hasClass(node, 'copy'));
      const link = copy && anchors(copy.inner, sourceId, game)[0], d = copy && elements(copy.inner, 'p').find(node => hasClass(node, 'date'));
      if (link && d) out.push({ sourceId, url: link.url, title: link.title, publishedAt: date(d.inner), evidence: communityText(elements(copy.inner, 'section').find(node => hasClass(node, 'preview'))?.inner, 480), image: firstImage(item.inner, sourceId) });
    }
  } else if (['pokeguardian', 'ygorganization'].includes(sourceId)) {
    for (const item of elements(input, 'article')) {
      if (sourceId === 'pokeguardian' && !hasClass(item, 'jw-news-post')) continue;
      const headings = ['h2', 'h3'].flatMap(tag => elements(item.inner, tag));
      const link = headings.flatMap(node => anchors(node.inner, sourceId, game))[0] || anchors(item.inner, sourceId, game)[0];
      if (!link) continue;
      const categories = elements(item.inner, 'a').filter(a => /\/category\//.test(a.attrs.href || '')).map(a => communityText(a.inner)).join(' ');
      if (digital(link.title + ' ' + categories)) continue;
      if (sourceId === 'ygorganization' && !/OCG\s*(?:&|and)\s*TCG/i.test(categories)) continue;
      if (sourceId === 'pokeguardian' && !physicalPokemon(link.title + ' ' + link.url)) continue;
      const time = elements(item.inner, 'time')[0], day = sourceId === 'pokeguardian' && elements(item.inner, 'span').find(node => hasClass(node, 'jw-news-date'));
      const imageLink = sourceId === 'pokeguardian' && elements(item.inner, 'a').find(node => hasClass(node, 'jw-news-post__image') && absolute(node.attrs.href || '', sourceId) === link.url);
      const style = imageLink ? elements(imageLink.inner, 'div').find(node => node.attrs.style)?.attrs.style || '' : '';
      const image = style?.match(/background-image\s*:\s*url\(\s*["']?([^\s"')]+)["']?\s*\)/i)?.[1] || '';
      out.push({ sourceId, url: link.url, title: link.title, categories, publishedAt: time ? date(time.attrs.datetime || time.inner) : day ? date(day.inner) : '', ...(image ? { image } : {}) });
    }
  } else {
    for (const link of anchors(input, sourceId, game)) {
      if (/terms.and.conditions|terms.of.service|privacy.policy/i.test(link.url + ' ' + link.title) || /\bArena\b|Competitive Brawl/i.test(link.title)) continue;
      out.push({ sourceId, url: link.url, title: link.title });
    }
  }
  return out.filter(row => { if (seen.has(row.url)) return false; seen.add(row.url); return true; }).slice(0, sourceId === 'konami' ? 24 : MAX_ARTICLES);
}
function articleData(input, url) {
  const nodes = [];
  for (const m of input.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const root = JSON.parse(m[1]);
      for (const row of (Array.isArray(root) ? root : [root])) { nodes.push(row); if (Array.isArray(row?.['@graph'])) nodes.push(...row['@graph'].slice(0, 100)); }
    } catch {}
  }
  const ownReference = value => !value || typeof value === 'string' && (value === url || value.startsWith(url + '#'));
  const article = nodes.find(row => /^(?:Article|NewsArticle|BlogPosting)$/.test(String(row?.['@type'])) && ownReference(row.url) && ownReference(typeof row.mainEntityOfPage === 'object' ? row.mainEntityOfPage?.['@id'] : row.mainEntityOfPage) && ownReference(row['@id']?.startsWith?.('http') ? row['@id'] : ''));
  const resolveImage = value => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return resolveImage(value[0]);
    if (typeof value?.url === 'string') return value.url;
    const referenced = value?.['@id'] && nodes.find(row => row?.['@type'] === 'ImageObject' && row['@id'] === value['@id']);
    return referenced?.url || referenced?.contentUrl || '';
  };
  return article ? { ...article, image: resolveImage(article.image) || resolveImage(article.thumbnailUrl) } : null;
}
export function parseNewsArticle(game, html, candidate, now = Date.now(), sourceId = candidate?.sourceId || GAME_NEWS_SOURCES[game]?.[0]) {
  if (!newsSource(sourceId, game) || !safeNewsArticle(candidate?.url, game, sourceId)) return null;
  const input = String(html).slice(0, MAX_BYTES), metadata = {};
  // First metadata wins. Some publishers append footer OG images after the story.
  for (const m of input.matchAll(/<meta\b([^>]*)>/gi)) {
    const a = attrs(m[1]), key = a.property || a.name || a.itemprop;
    if (key && a.content && !Object.hasOwn(metadata, key)) metadata[key] = a.content;
  }
  if (metadata['og:url'] && metadata['og:url'] !== candidate.url) return null;
  const article = articleData(input, candidate.url);
  const publishedAt = article?.datePublished || metadata['article:published_time'] || metadata.datePublished || candidate.publishedAt || '';
  const heading = elements(cleanMarkup(input), 'h1').find(node => node.attrs.itemprop === 'headline');
  const title = article?.headline || (heading && communityText(heading.inner)) || candidate.title || metadata['og:title'];
  const categories = [candidate.categories, Array.isArray(article?.articleSection) ? article.articleSection.join(' ') : article?.articleSection].filter(Boolean).join(' ');
  if (digital(title + ' ' + categories)) return null;
  const images = [article?.image, metadata['og:image'], metadata['og:image:url'], metadata['og:image:secure_url'], candidate.image];
  const image = images.map(value => safeNewsImage(value, game, sourceId, candidate.url)).find(Boolean) || '';
  const markup = cleanMarkup(input), body = elements(markup, 'article')[0]?.inner || elements(markup, 'div').find(node => hasClass(node, 'post-content') && hasClass(node, 'prose'))?.inner || '';
  return news(game, sourceId, { ...candidate, title, publishedAt, image, categories, evidence: article?.description || metadata['og:description'] || metadata.description || communityText(body, 480) || candidate.evidence, region: communityText(body, 12000) }, now);
}
export function parseYgoEvents(html, now = Date.now()) {
  const input = cleanMarkup(html), at = input.indexOf('Upcoming Events'); if (at < 0) return [];
  const out = [], sourceId = 'konami-events';
  for (const a of elements(input.slice(at), 'a')) {
    const p = elements(a.inner, 'p').map(node => communityText(node.inner));
    const d = p[2]?.match(/^(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})$/); if (!d || digital(p.join(' '))) continue;
    const startsAt = date(`${d[3]}-${d[1]}-${d[2]}`), endsAt = date(`${d[6]}-${d[4]}-${d[5]}`), url = safeNewsArticle(absolute(a.attrs.href || '', sourceId), 'ygo', sourceId, 'event');
    if (!url || !startsAt || !endsAt || startsAt > endsAt || Date.parse(endsAt) + COMMUNITY_DAY <= now || Date.parse(startsAt) > now + 90 * COMMUNITY_DAY) continue;
    out.push({ id: url, sourceId, game: 'ygo', kind: 'event', title: p[0], summary: p[1], url, source: NEWS_SOURCES[sourceId].name, sourceUrl: NEWS_SOURCES[sourceId].url, image: safeNewsImage(firstImage(a.inner, sourceId), 'ygo', sourceId, url, 'event'), publishedAt: '', startsAt, endsAt, dateLabel: 'Event dates', fetchedAt: iso(now), stale: false });
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 3);
}
export function retainCommunityItems(items, now = Date.now(), maxAge = COMMUNITY_RETENTION) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).slice(0, 100).filter(x => {
    if (!x?.id || seen.has(x.sourceId === 'serebii' ? x.url + ':' + x.title : x.url) || !['news', 'event'].includes(x.kind) || !safeNewsArticle(x.url, x.game, x.sourceId, x.kind) || !Number.isFinite(Date.parse(x.fetchedAt)) || Date.parse(x.fetchedAt) > now + 60000) return false;
    const n = Date.parse(date(x.kind === 'event' ? x.endsAt : x.publishedAt));
    if (x.kind === 'event' && (!date(x.startsAt) || date(x.startsAt) > date(x.endsAt))) return false;
    if (!Number.isFinite(n) || now - Date.parse(x.fetchedAt) > maxAge || (x.kind === 'event' ? n + COMMUNITY_DAY <= now : n > now || now - n > maxAge)) return false;
    seen.add(x.sourceId === 'serebii' ? x.url + ':' + x.title : x.url); return true;
  }).map(x => ({ ...x, id: x.sourceId === 'serebii' ? `${x.url}#${encodeURIComponent(communityText(x.title))}` : x.url, source: NEWS_SOURCES[x.sourceId].name, sourceUrl: NEWS_SOURCES[x.sourceId].url, image: safeNewsImage(x.image, x.game, x.sourceId, x.url, x.kind) })).sort((a, b) => (Number(b.important) || 0) - (Number(a.important) || 0) || String(b.publishedAt || b.startsAt).localeCompare(String(a.publishedAt || a.startsAt))).slice(0, MAX_ITEMS);
}
async function boundedHtml(url, fetchImpl, budget, sourceId) {
  if (budget.remaining-- <= 0) throw Error('Daily source page budget exhausted');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6500);
  try {
    const r = await fetchImpl(url, { redirect: 'manual', signal: controller.signal, credentials: 'omit', headers: { Accept: 'text/html', 'User-Agent': 'CardStashy (public publisher news; cached daily)' } });
    if (r.status >= 300 && r.status < 400) throw Error('Publisher redirects are not allowed');
    if (!r.ok) throw Error(`Publisher returned ${r.status}`);
    if (!/text\/html|application\/xhtml/i.test(r.headers.get('Content-Type') || '')) throw Error('Publisher did not return a news page');
    if (Number(r.headers.get('Content-Length')) > MAX_BYTES) throw Error('Publisher page exceeded the size limit');
    const reader = r.body?.getReader(); if (!reader) throw Error('Publisher returned an empty page');
    let size = 0, text = '';
    const charset = sourceId === 'serebii' && /charset\s*=\s*["']?(?:iso-8859-1|windows-1252)/i.test(r.headers.get('Content-Type') || '') ? 'windows-1252' : 'utf-8';
    const decoder = new TextDecoder(charset);
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw Error('Publisher page exceeded the size limit'); } text += decoder.decode(value, { stream: true }); } } finally { reader.releaseLock(); }
    return text + decoder.decode();
  } finally { clearTimeout(timer); }
}
export async function collectCommunity(game, previous = null, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!Object.hasOwn(COMMUNITY_SOURCES, game || '')) throw Error('Unknown community game');
  const items = [], errors = [], sources = [], budget = { remaining: COMMUNITY_FETCH_LIMIT }, articleCandidates = [];
  const ids = [...GAME_NEWS_SOURCES[game], ...(game === 'ygo' ? ['konami-events'] : [])];
  // All indexes reserve their share first. Article slots are shared game-wide,
  // not multiplied by the number of publishers. YGO: 3+3; Pokémon: 2+4.
  await Promise.all(ids.map(async sourceId => {
    const source = NEWS_SOURCES[sourceId], record = { sourceId, name: source.name, url: source.url, checkedAt: iso(now), status: 'unavailable' }; sources.push(record);
    try {
      const html = await boundedHtml(source.url, fetchImpl, budget, sourceId);
      if (sourceId === 'konami-events') {
        if (!/Upcoming Events/i.test(html)) throw Error('Dated event listings unavailable from this publisher');
        items.push(...parseYgoEvents(html, now)); record.status = 'checked'; return;
      }
      const candidates = parseNewsIndex(game, html, sourceId);
      if (!candidates.length) {
        // An intact dated Serebii page without a physical-TCG section is not a failure.
        if (sourceId === 'serebii' && /class=["']post["']/i.test(html) && /class=["']date["']/i.test(html)) { record.status = 'checked'; return; }
        throw Error('Automatic headlines unavailable from this publisher');
      }
      if (['serebii', 'konami'].includes(sourceId)) { items.push(...candidates.map(row => news(game, sourceId, row, now)).filter(Boolean)); record.status = 'checked'; }
      else {
        const eligible = candidates.filter(row => !row.publishedAt || now - Date.parse(row.publishedAt) <= COMMUNITY_RETENTION && Date.parse(row.publishedAt) <= now);
        if (!eligible.length) record.status = 'checked';
        else articleCandidates.push({ sourceId, candidates: eligible, record });
      }
    } catch (e) { errors.push(`${source.name}: ${String(e.message).slice(0, 150)}`); }
  }));
  const selected = [];
  for (let i = 0; i < MAX_ARTICLES && selected.length < Math.min(MAX_ARTICLES, budget.remaining); i++) {
    for (const source of articleCandidates) if (source.candidates[i] && selected.length < Math.min(MAX_ARTICLES, budget.remaining)) selected.push({ ...source, candidate: source.candidates[i] });
  }
  await Promise.all(selected.map(async ({ sourceId, candidate, record }) => {
    try {
      const html = await boundedHtml(candidate.url, fetchImpl, budget, sourceId);
      const row = parseNewsArticle(game, html, candidate, now, sourceId);
      if (row) items.push(row);
      // A valid, dated old/excluded story is a successful check, not fresh news.
      const publishedMeta = [...html.matchAll(/<meta\b([^>]*)>/gi)].map(match => attrs(match[1])).find(meta => ['article:published_time', 'datePublished'].includes(meta.property || meta.name || meta.itemprop));
      if (!date(articleData(html, candidate.url)?.datePublished || publishedMeta?.content || candidate.publishedAt)) throw Error('Article publication date unavailable');
      record.status = 'checked';
    } catch (e) { record.partial = true; errors.push(`${NEWS_SOURCES[sourceId].name}: ${String(e.message).slice(0, 150)}`); }
  }));
  const good = sources.some(source => source.status === 'checked');
  const retained = (Array.isArray(previous?.items) ? previous.items : []).map(x => ({ ...x, stale: true }));
  const body = { game, items: retainCommunityItems([...items, ...retained], now), sources: sources.sort((a, b) => ids.indexOf(a.sourceId) - ids.indexOf(b.sourceId)), checkedAt: iso(now), fetchedAt: good ? iso(now) : previous?.fetchedAt || '', nextCheckAt: iso(now + COMMUNITY_DAY), stale: errors.length > 0, error: [...new Set(errors)].join('. ').slice(0, 600), status: good ? errors.length ? 'partial' : 'ready' : 'unavailable' };
  return body;
}
async function refresh(game, previous, cache, key, fetchImpl, now) {
  const body = await collectCommunity(game, previous, { fetchImpl, now });
  snapshots.set(game, body);
  if (cache) { try { await cache.put(key, json(body, 200, COMMUNITY_RETENTION / 1000)); } catch {} }
  return body;
}
export async function communityFeedRoute(request, url, ctx, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405, 0);
  const game = url.searchParams.get('game');
  if (!Object.hasOwn(COMMUNITY_SOURCES, game || '') || [...url.searchParams.keys()].some(k => k !== 'game') || url.searchParams.getAll('game').length !== 1) return json({ error: 'Choose mtg, ptcg or ygo only' }, 400, 0);
  const key = new Request(`https://cardforge.cache/community/v3/${game}`);
  let old = null; try { old = await (await cache?.match(key))?.json(); } catch {}
  if (old?.game !== game || !Array.isArray(old?.items)) old = null;
  // Upgrade once from the old source contract. Only rows carrying a valid exact
  // source ID survive retention; an old daily failure must not lock out recovery.
  if (!old && !snapshots.has(game)) {
    try {
      const legacy = await (await cache?.match(new Request(`https://cardforge.cache/community/v2/${game}`)))?.json();
      if (legacy?.game === game && Array.isArray(legacy.items)) old = { ...legacy, items: retainCommunityItems(legacy.items, now), nextCheckAt: '' };
    } catch {}
  }
  const memory = snapshots.get(game);
  if (memory && (!old || !old.nextCheckAt || Date.parse(memory.checkedAt) > Date.parse(old.checkedAt))) old = memory;
  if (old && Date.parse(old.nextCheckAt) > now && Date.parse(old.nextCheckAt) <= Date.parse(old.checkedAt) + COMMUNITY_DAY && (old === memory || Date.parse(old.checkedAt) <= now)) return json({ ...old, items: retainCommunityItems(old.items, now) });
  if (!pending.has(game)) pending.set(game, refresh(game, old, cache, key, fetchImpl, now).finally(() => pending.delete(game)));
  return json(await pending.get(game));
}
