import { editionStories, expiredEditionStory } from './community-edition.js';
import { curatedMetaDecks } from './meta-curation.js';
import { metaState as readMetaState } from './meta.js';
import { communityDeckArtwork, safeCommunityImage } from './community-art.js';
import { NEWS_SOURCES, newsSource, safeNewsArticle, safeNewsSourceUrl, safeNewsCardArt } from './community-sources.js';
import { pulseState } from './news-pulse.js';

// Home is a view of the existing tournament cache, not a second deck provider.
// The shared weekly publisher feed has a daily read-only browser cache. Dates retain their
// original meaning: publication, event, or YGOPRODeck submission date.
export const COMMUNITY_TTL = 864e5;
const RETENTION = 7 * COMMUNITY_TTL, KEY = 'cardforge-community-v3', LEGACY_KEY = 'cardforge-community-v2';
const games = ['mtg', 'ptcg', 'ygo'], states = Object.create(null);
const hosts = {
  mtg: ['magic.wizards.com', 'www.magic.wizards.com', 'www.mtgo.com', 'mtgo.com', 'www.mtgtop8.com', 'mtgtop8.com', 'topdeck.gg', 'magic.gg', 'www.magic.gg', 'locator.wizards.com'],
  ptcg: ['www.pokemon.com', 'pokemon.com', 'events.pokemon.com', 'www.serebii.net', 'www.pokeguardian.com', 'play.limitlesstcg.com', 'limitlesstcg.com'],
  ygo: ['www.yugioh-card.com', 'yugioh-card.com', 'ygorganization.com', 'ygoprodeck.com'],
};
export const COMMUNITY_LINKS = Object.freeze({
  mtg: { news: NEWS_SOURCES.wizards.url, events: 'https://locator.wizards.com/', decks: 'https://www.mtgo.com/decklists', source: 'Wizards of the Coast', name: 'Magic' },
  ptcg: { news: NEWS_SOURCES.serebii.url, events: 'https://events.pokemon.com/EventLocator', decks: 'https://play.limitlesstcg.com/tournaments?game=PTCG', source: 'Serebii', name: 'Pokémon' },
  ygo: { news: 'https://www.yugioh-card.com/en/news/', events: 'https://www.yugioh-card.com/en/events/', decks: 'https://ygoprodeck.com/category/format/tournament%20meta%20decks', source: 'Konami', name: 'Yu-Gi-Oh!' },
});
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit = 180) => (['string', 'number', 'boolean'].includes(typeof value) ? String(value) : '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const stamp = value => {
  // Validate the source calendar day before Date.parse normalizes overflow.
  // Check it independently of UTC conversion so valid timezone offsets survive.
  const day = typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (day) { const n = Date.parse(day); if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== day) return ''; }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?: |$)/.test(value)) { const day = value.slice(0, 10), n = Date.parse(day); return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === day ? day : ''; }
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
  const date = new Date(n); return Number.isFinite(date.getTime()) && n > 0 ? date.toISOString() : '';
};
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
const saved = (key = KEY) => { try { const s = JSON.parse(storage()?.getItem(key) || '{}'); return record(s) ? s : {}; } catch { return {}; } };
export function safeCommunityUrl(value, game) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts[game]?.includes(u.hostname) ? u.href : ''; } catch { return ''; }
}
function validSources(rows, game) {
  return (Array.isArray(rows) ? rows : []).slice(0, 6).filter(row => newsSource(row?.sourceId, game) && safeNewsSourceUrl(row.url, game, row.sourceId) && stamp(row.checkedAt)).map(row => ({ sourceId: row.sourceId, name: NEWS_SOURCES[row.sourceId].name, url: NEWS_SOURCES[row.sourceId].url, checkedAt: stamp(row.checkedAt), status: row.status === 'checked' ? 'checked' : 'unavailable', partial: !!row.partial }));
}
export function communitySlideUrl(game, slide) {
  if (slide?.kind === 'news' || (slide?.kind === 'event' && slide.sourceId)) return safeNewsArticle(slide.url, game, slide.sourceId, slide.kind);
  if (slide?.kind === 'event') {
    const url = safeCommunityUrl(slide.url, game);
    try { return ['play.limitlesstcg.com', 'limitlesstcg.com', 'www.mtgo.com', 'mtgo.com', 'www.mtgtop8.com', 'mtgtop8.com', 'topdeck.gg'].includes(new URL(url).hostname) ? url : ''; } catch { return ''; }
  }
  return safeCommunityUrl(slide?.url, game);
}
function validItems(items, game, now) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).slice(0, 36).map(x => {
    if (expiredEditionStory(x, now) || x?.game !== game || !['news', 'event'].includes(x.kind)) return null;
    const weekly = x.cadence === 'weekly', retention = weekly ? 14 * COMMUNITY_TTL : RETENTION;
    const source = newsSource(x.sourceId, game), url = safeNewsArticle(x.url, game, x.sourceId, x.kind), title = text(x.title), fetchedAt = stamp(x.fetchedAt), publishedAt = stamp(x.publishedAt), startsAt = stamp(x.startsAt), endsAt = stamp(x.endsAt);
    if (!url || !title || !fetchedAt || seen.has(x.sourceId === 'serebii' ? url + ':' + title : url) || now - Date.parse(fetchedAt) > retention || Date.parse(fetchedAt) > now + 60000) return null;
    if (x.kind === 'news' ? !publishedAt || Date.parse(publishedAt) > now || now - Date.parse(publishedAt) > retention : !startsAt || !endsAt || startsAt > endsAt || Date.parse(endsAt) + COMMUNITY_TTL <= now || Date.parse(startsAt) > now + 90 * COMMUNITY_TTL) return null;
    seen.add(x.sourceId === 'serebii' ? url + ':' + title : url);
    return { id: x.sourceId === 'serebii' ? `${url}#${encodeURIComponent(title)}` : url, sourceId: x.sourceId, scope: text(x.scope, 80), game, kind: x.kind, title, summary: text(x.summary), whyItMatters: text(x.whyItMatters, 180), category: ['Release','Rules','Tournament','Cards','Community'].includes(x.category) ? x.category : '', editorial: x.editorial === 'ai-assisted' ? 'ai-assisted' : 'source-ranked', url, source: source.name, sourceUrl: source.url, publishedAt, startsAt, endsAt, dateLabel: x.kind === 'news' ? 'Published' : 'Event dates', fetchedAt, cadence: weekly ? 'weekly' : 'daily', stale: !!x.stale || now - Date.parse(fetchedAt) >= (weekly ? 7 : 1) * COMMUNITY_TTL || weekly && x.kind === 'news' && now - Date.parse(publishedAt) > 7 * COMMUNITY_TTL, image: safeCommunityImage(x.image, game, x.sourceId, url, x.kind), cardArt: x.kind === 'news' ? safeNewsCardArt(x.cardArt, game) : null, important: !!x.important };
  }).filter(Boolean).slice(0, 18);
}
export function communityState(game) {
  if (!games.includes(game)) return { data: null, at: 0, busy: false, error: 'Unknown game' };
  if (!states[game]) {
    const current = saved()[game], legacy = !current && saved(LEGACY_KEY)[game], old = current || legacy, raw = old?.data;
    // Browser storage is an untrusted boundary. A malformed cache must not
    // crash Home, impersonate a checked source, or block a valid next response.
    const data = record(raw) && raw.game === game && Array.isArray(raw.items) ? {
      game, cadence: raw.cadence === 'weekly' ? 'weekly' : 'daily', aiStatus: text(raw.aiStatus, 40), curatedAt: stamp(raw.curatedAt), items: raw.items.slice(0, 36).filter(x => record(x) && !!stamp(x.fetchedAt)), sources: validSources(raw.sources, game),
      fetchedAt: stamp(raw.fetchedAt), checkedAt: stamp(raw.checkedAt), nextCheckAt: stamp(raw.nextCheckAt), stale: !!raw.stale,
      status: ['ready', 'partial', 'unavailable'].includes(raw.status) ? raw.status : 'unavailable', error: text(raw.error, 250),
    } : null;
    // Adopt the weekly endpoint once per game, preserving valid old rows. The
    // migration marker also backs off after failure, so reloads never retry-loop.
    const at = !legacy && data && (old?.weeklySchema === 1 || data.cadence === 'weekly') && typeof old?.at === 'number' && stamp(old.at) ? old.at : 0;
    states[game] = { data, at, busy: false, error: data?.error || '' };
  }
  return states[game];
}

// No force flag: repeated visits, clicks and in-flight callers share one daily
// attempt, including failures. Existing valid news survives a publisher outage.
export function loadCommunity(game, { fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  if (!games.includes(game)) return Promise.resolve(null);
  const state = communityState(game);
  if (state.busy) return state.promise;
  const scheduled=Date.parse(state.data?.nextCheckAt), ordinaryExpiry=state.at+COMMUNITY_TTL;
  // Recheck shortly after the shared cron, not a full day after a pre-cron visit.
  // A 15-minute floor and five-minute publication grace prevent visitor retry loops.
  const expires=Number.isFinite(scheduled)&&scheduled>state.at?Math.min(ordinaryExpiry,Math.max(state.at+15*60000,scheduled+5*60000)):ordinaryExpiry;
  if (state.at && now >= state.at && now < expires) return Promise.resolve(state.data);
  state.busy = true; state.error = '';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 16000);
  state.promise = Promise.resolve().then(() => fetchImpl(`api/community?game=${game}`, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } })).then(async response => {
    if (!response.ok) throw Error('Community headlines are temporarily unavailable.');
    const payload = await response.text();
    if (payload.length > 100000) throw Error('Community headline response was too large.');
    const raw = JSON.parse(payload);
    if (!raw || raw.game !== game || !Array.isArray(raw.items)) throw Error('Community headlines are unavailable on this connection.');
    state.data = { game, cadence: raw.cadence === 'weekly' ? 'weekly' : 'daily', aiStatus: text(raw.aiStatus, 40), curatedAt: stamp(raw.curatedAt), sources: validSources(raw.sources, game), items: validItems([...raw.items, ...(raw.cadence === 'weekly' && raw.status !== 'unavailable' ? [] : Array.isArray(state.data?.items) ? state.data.items : []).map(x => ({ ...x, stale: true }))], game, now), fetchedAt: stamp(raw.fetchedAt), checkedAt: stamp(raw.checkedAt), nextCheckAt: stamp(raw.nextCheckAt), stale: !!raw.stale, status: ['ready', 'partial', 'unavailable'].includes(raw.status) ? raw.status : 'unavailable', error: text(raw.error, 250) };
    state.error = state.data.error;
    return state.data;
  }).catch(error => {
    state.error = error?.name === 'AbortError' ? 'Community headlines took too long to respond.' : text(error?.message || 'Community headlines are temporarily unavailable.', 250);
    state.data = { ...state.data, game, items: validItems(state.data?.items, game, now).map(x => ({ ...x, stale: true })), stale: true, status: 'unavailable', error: state.error };
    return state.data;
  }).finally(() => {
    clearTimeout(timer); state.busy = false; state.at = now;
    try { const all = saved(); all[game] = { at: now, data: state.data, weeklySchema: 1 }; storage()?.setItem(KEY, JSON.stringify(Object.fromEntries(games.filter(g => all[g]).map(g => [g, all[g]])))); } catch {}
  });
  return state.promise;
}

export function metaDeckSlides(game, M, metaKey, now = Date.now(), limit = 3) {
  const data = M?.data; if (!Array.isArray(data?.decks)) return [];
  const fetchedAt = stamp(data.fetchedAt) || stamp(M.at), stale = !!M.error || !!data.stale || !fetchedAt || now - Date.parse(fetchedAt) >= 12 * 3600e3;
  const methodology = game === 'ptcg' ? 'Top 8 lists from recent Standard events on Limitless.' : game === 'ygo' ? 'Lists curated as Tournament Meta Decks by YGOPRODeck.' : /Magic Online|MTGO/i.test(data.source || '') ? 'Published Magic Online Challenge and 5–0 League lists; not a global popularity ranking.' : /MTGTop8/i.test(data.source || '') ? 'Top finishes at the largest recent competitive Commander events, from MTGTop8.' : 'Published tournament lists; not a global popularity ranking.';
  const seen = new Set();
  return curatedMetaDecks(data).slice(0, 100).filter(d => {
    if (!d?.key || seen.has(d.key)) return false; seen.add(d.key); return !!(safeCommunityUrl(d.url, game) || safeCommunityUrl(d.eventUrl, game));
  }).slice(0, Math.min(6, Math.max(1, limit))).map(d => ({
    id: `deck:${game}:${d.key}`, game, kind: 'deck', title: text(d.name || 'Tournament deck'), summary: [text(d.place, 35), text(d.event, 110)].filter(Boolean).join(' · '), url: safeCommunityUrl(d.url, game) || safeCommunityUrl(d.eventUrl, game), artwork: communityDeckArtwork(game, d), source: text(data.source, 160), publishedAt: stamp(d.date), dateLabel: game === 'ygo' ? 'List submitted' : 'Event date', fetchedAt, stale, deckKey: d.key, metaKey, methodology, curation: data.curation?.selections?.find(row => row.id === d.key)?.explanation || '',
  }));
}
function resultSlide(game, M, now) {
  if (game === 'ygo') return null; // YGOPRODeck date is submission, not an event date.
  const data = M?.data;
  for (const event of (Array.isArray(data?.events) ? data.events : []).slice(0, 12)) {
    if (!event) continue;
    const d = (Array.isArray(data?.decks) ? data.decks : []).find(x => x?.event === event.name && (!event.date || x.date === event.date));
    let url = safeCommunityUrl(event.url, game);
    if (!url && game === 'ptcg' && d?.url) { const match = d.url.match(/^(https:\/\/play\.limitlesstcg\.com\/tournament\/[a-zA-Z0-9_-]+)\//); if (match) url = safeCommunityUrl(match[1], game); }
    const publishedAt = stamp(event.date); if (!url || !publishedAt || Date.parse(publishedAt) > now) continue;
    const fetchedAt = stamp(data.fetchedAt) || stamp(M.at);
    return { id: `result:${url}`, game, kind: 'event', title: text(event.name), summary: `Tournament results${Number(event.players) > 0 ? ` · ${Number(event.players)} players` : ''}`, url, source: text(data.source, 160), publishedAt, dateLabel: 'Event date', fetchedAt, stale: !!M.error || !!data.stale || !fetchedAt || now - Date.parse(fetchedAt) >= 12 * 3600e3 };
  }
  return null;
}

export function communitySlides(game, { metaState: M, metaKey, format = 'Standard', now = Date.now() } = {}) {
  if (!games.includes(game)) return [];
  metaKey ||= game === 'mtg' ? `mtg:${format}` : game;
  M ||= readMetaState(metaKey);
  const info = COMMUNITY_LINKS[game], N = communityState(game), items = validItems([...(N.data?.items || []), ...editionStories(game, now)], game, now), pulse = validItems(pulseState(game).items, game, now).filter(x => !items.some(y => y.url === x.url));
  // Publisher news leads; the live pulse (subreddit + article feed) takes every other slot after it.
  const official = items.filter(x => x.kind === 'news'), news = []; for (let i = 0; i < Math.max(official.length, pulse.length); i++) { if (official[i]) news.push(official[i]); if (pulse[i]) news.push(pulse[i]); }
  const events = items.filter(x => x.kind === 'event').sort((a, b) => a.startsAt.localeCompare(b.startsAt)), decks = metaDeckSlides(game, M, metaKey, now), result = resultSlide(game, M, now);
  const link = (category, title, summary, url = info[category]) => ({ id: `link:${game}:${category}`, game, kind: 'link', category, title, summary, url, source: category === 'decks' ? game === 'ptcg' ? 'Limitless' : game === 'ygo' ? 'YGOPRODeck' : format === 'EDH' ? 'MTGTop8' : 'Magic Online' : category === 'events' && game === 'ptcg' ? 'Pokémon' : info.source, publishedAt: '', fetchedAt: '', dateLabel: '', stale: false });
  const newsLink = link('news', `${info.name} news`, N.error || N.data?.status === 'unavailable' ? 'Automatic headlines unavailable. Open the news source.' : 'Open the news source. This is a source link, not a fetched story.');
  const eventsLink = link('events', `Find ${info.name} events`, 'Browse the official event listings for dates, locations and registration.');
  const deckLink = link('decks', 'Explore tournament decks', 'Open published tournament decklists at the source.', game === 'mtg' && format === 'EDH' ? 'https://www.mtgtop8.com/format?f=cEDH' : info.decks);
  // Alternate subjects rather than stacking all news ahead of decks and events.
  return [news[0] || newsLink, decks[0] || deckLink, events[0] || result || eventsLink, ...news.slice(1, 4), ...decks.slice(1, 2), ...events.slice(1, 2), ...news.slice(4, 12), ...(game === 'ptcg' && !news.some(row => row.sourceId === 'serebii') && news.length ? [newsLink] : []), ...(events.length || result ? [eventsLink] : [])].filter(Boolean).slice(0, 18);
}
