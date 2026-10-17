import { metaState as readMetaState } from './meta.js';

// Home is a view of the existing tournament cache, not a second deck provider.
// Only the small publisher feed has its own daily cache. All dates retain their
// original meaning: publication, event, or YGOPRODeck submission date.
export const COMMUNITY_TTL = 864e5;
const RETENTION = 7 * COMMUNITY_TTL, KEY = 'cardforge-community-v1';
const games = ['mtg', 'ptcg', 'ygo'], states = Object.create(null);
const hosts = {
  mtg: ['magic.wizards.com', 'www.magic.wizards.com', 'www.mtgo.com', 'mtgo.com', 'edhtop16.com', 'topdeck.gg', 'magic.gg', 'www.magic.gg', 'locator.wizards.com'],
  ptcg: ['www.pokemon.com', 'pokemon.com', 'events.pokemon.com', 'play.limitlesstcg.com', 'limitlesstcg.com'],
  ygo: ['www.yugioh-card.com', 'yugioh-card.com', 'ygoprodeck.com'],
};
export const COMMUNITY_LINKS = Object.freeze({
  mtg: { news: 'https://magic.wizards.com/en/news', events: 'https://locator.wizards.com/', decks: 'https://www.mtgo.com/decklists', source: 'Wizards of the Coast', name: 'Magic' },
  ptcg: { news: 'https://www.pokemon.com/us/pokemon-news', events: 'https://events.pokemon.com/EventLocator', decks: 'https://play.limitlesstcg.com/tournaments?game=PTCG', source: 'Pokémon', name: 'Pokémon' },
  ygo: { news: 'https://www.yugioh-card.com/en/news/', events: 'https://www.yugioh-card.com/en/events/', decks: 'https://ygoprodeck.com/category/format/tournament%20meta%20decks', source: 'Konami', name: 'Yu-Gi-Oh!' },
});
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit = 180) => (['string', 'number', 'boolean'].includes(typeof value) ? String(value) : '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const stamp = value => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?: |$)/.test(value)) { const day = value.slice(0, 10), n = Date.parse(day); return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === day ? day : ''; }
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
  const date = new Date(n); return Number.isFinite(date.getTime()) && n > 0 ? date.toISOString() : '';
};
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };
const saved = () => { try { const s = JSON.parse(storage()?.getItem(KEY) || '{}'); return record(s) ? s : {}; } catch { return {}; } };
export function safeCommunityUrl(value, game) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts[game]?.includes(u.hostname) ? u.href : ''; } catch { return ''; }
}
function safeImage(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && ['images.ctfassets.net', 'assets.pokemon.com', 'img.yugioh-card.com', 'www.yugioh-card.com'].includes(u.hostname) ? u.href : ''; } catch { return ''; }
}
function validItems(items, game, now) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).slice(0, 36).map(x => {
    if (x?.game !== game || !['news', 'event'].includes(x.kind)) return null;
    const url = safeCommunityUrl(x.url, game), title = text(x.title), fetchedAt = stamp(x.fetchedAt), publishedAt = stamp(x.publishedAt), startsAt = stamp(x.startsAt), endsAt = stamp(x.endsAt);
    if (!url || !title || !fetchedAt || seen.has(url) || now - Date.parse(fetchedAt) > RETENTION || Date.parse(fetchedAt) > now + 60000) return null;
    if (x.kind === 'news' ? !publishedAt || Date.parse(publishedAt) > now || now - Date.parse(publishedAt) > RETENTION : !startsAt || !endsAt || Date.parse(endsAt) + COMMUNITY_TTL <= now || Date.parse(startsAt) > now + 90 * COMMUNITY_TTL) return null;
    seen.add(url);
    return { id: url, game, kind: x.kind, title, summary: text(x.summary), url, source: text(x.source, 100), sourceUrl: safeCommunityUrl(x.sourceUrl, game), publishedAt, startsAt, endsAt, dateLabel: x.kind === 'news' ? 'Published' : 'Event dates', fetchedAt, stale: !!x.stale || now - Date.parse(fetchedAt) >= COMMUNITY_TTL, image: safeImage(x.image), important: !!x.important };
  }).filter(Boolean).slice(0, 18);
}
export function communityState(game) {
  if (!games.includes(game)) return { data: null, at: 0, busy: false, error: 'Unknown game' };
  if (!states[game]) {
    const old = saved()[game], raw = old?.data;
    // Browser storage is an untrusted boundary. A malformed cache must not
    // crash Home, impersonate a checked source, or block a valid next response.
    const data = record(raw) && raw.game === game && Array.isArray(raw.items) ? {
      game, items: raw.items.slice(0, 36).filter(x => record(x) && !!stamp(x.fetchedAt)),
      fetchedAt: stamp(raw.fetchedAt), checkedAt: stamp(raw.checkedAt), nextCheckAt: stamp(raw.nextCheckAt), stale: !!raw.stale,
      status: ['ready', 'partial', 'unavailable'].includes(raw.status) ? raw.status : 'unavailable', error: text(raw.error, 250),
    } : null;
    const at = data && typeof old?.at === 'number' && stamp(old.at) ? old.at : 0;
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
  if (state.at && now >= state.at && now - state.at < COMMUNITY_TTL) return Promise.resolve(state.data);
  state.busy = true; state.error = '';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 16000);
  state.promise = Promise.resolve().then(() => fetchImpl(`api/community?game=${game}`, { signal: controller.signal, headers: { Accept: 'application/json' } })).then(async response => {
    if (!response.ok) throw Error('Community headlines are temporarily unavailable.');
    const payload = await response.text();
    if (payload.length > 100000) throw Error('Community headline response was too large.');
    const raw = JSON.parse(payload);
    if (!raw || raw.game !== game || !Array.isArray(raw.items)) throw Error('Community headlines are unavailable on this connection.');
    state.data = { game, items: validItems([...raw.items, ...(Array.isArray(state.data?.items) ? state.data.items : []).map(x => ({ ...x, stale: true }))], game, now), fetchedAt: stamp(raw.fetchedAt), checkedAt: stamp(raw.checkedAt), nextCheckAt: stamp(raw.nextCheckAt), stale: !!raw.stale, status: ['ready', 'partial', 'unavailable'].includes(raw.status) ? raw.status : 'unavailable', error: text(raw.error, 250) };
    state.error = state.data.error;
    return state.data;
  }).catch(error => {
    state.error = error?.name === 'AbortError' ? 'Community headlines took too long to respond.' : text(error?.message || 'Community headlines are temporarily unavailable.', 250);
    state.data = { ...state.data, game, items: validItems(state.data?.items, game, now).map(x => ({ ...x, stale: true })), stale: true, status: 'unavailable', error: state.error };
    return state.data;
  }).finally(() => {
    clearTimeout(timer); state.busy = false; state.at = now;
    try { const all = saved(); all[game] = { at: now, data: state.data }; storage()?.setItem(KEY, JSON.stringify(Object.fromEntries(games.filter(g => all[g]).map(g => [g, all[g]])))); } catch {}
  });
  return state.promise;
}

function deckSlides(game, M, metaKey, now) {
  const data = M?.data; if (!Array.isArray(data?.decks)) return [];
  const fetchedAt = stamp(data.fetchedAt) || stamp(M.at), stale = !!M.error || !!data.stale || !fetchedAt || now - Date.parse(fetchedAt) >= 12 * 3600e3;
  const methodology = game === 'ptcg' ? 'Top 8 lists from recent Standard events on Limitless.' : game === 'ygo' ? 'Lists curated as Tournament Meta Decks by YGOPRODeck.' : /Magic Online|MTGO/i.test(data.source || '') ? 'Published Magic Online Challenge and 5–0 League lists; not a global popularity ranking.' : /EDHTop16/i.test(data.source || '') ? 'Competitive Commander tournament results from EDHTop16.' : 'Published tournament lists; not a global popularity ranking.';
  const seen = new Set();
  return data.decks.slice(0, 100).filter(d => {
    if (!d?.key || seen.has(d.key)) return false; seen.add(d.key); return !!safeCommunityUrl(d.url || d.eventUrl, game);
  }).slice(0, 3).map(d => ({
    id: `deck:${game}:${d.key}`, game, kind: 'deck', title: text(d.name || 'Tournament deck'), summary: [text(d.place, 35), text(d.event, 110)].filter(Boolean).join(' · '), url: safeCommunityUrl(d.url || d.eventUrl, game), source: text(data.source, 160), publishedAt: stamp(d.date), dateLabel: game === 'ygo' ? 'List submitted' : 'Event date', fetchedAt, stale, deckKey: d.key, metaKey, methodology,
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
  const info = COMMUNITY_LINKS[game], N = communityState(game), items = validItems(N.data?.items, game, now), news = items.filter(x => x.kind === 'news'), events = items.filter(x => x.kind === 'event').sort((a, b) => a.startsAt.localeCompare(b.startsAt)), decks = deckSlides(game, M, metaKey, now), result = resultSlide(game, M, now);
  const link = (category, title, summary, url = info[category]) => ({ id: `link:${game}:${category}`, game, kind: 'link', category, title, summary, url, source: category === 'decks' ? game === 'ptcg' ? 'Limitless' : game === 'ygo' ? 'YGOPRODeck' : format === 'EDH' ? 'EDHTop16' : 'Magic Online' : info.source, publishedAt: '', fetchedAt: '', dateLabel: '', stale: false });
  const newsLink = link('news', `${info.name} news`, N.error || N.data?.status === 'unavailable' ? 'Automatic headlines unavailable. Open the official news website.' : 'Open the official news website. This is a source link, not a fetched story.');
  const eventsLink = link('events', `Find ${info.name} events`, 'Browse the official event listings for dates, locations and registration.');
  const deckLink = link('decks', 'Explore tournament decks', 'Open published tournament decklists at the source.', game === 'mtg' && format === 'EDH' ? 'https://edhtop16.com/' : info.decks);
  // Alternate subjects rather than stacking all news ahead of decks and events.
  return [news[0] || newsLink, decks[0] || deckLink, events[0] || result || eventsLink, ...news.slice(1, 4), ...decks.slice(1, 2), ...events.slice(1, 2), ...(events.length || result ? [eventsLink] : [])].filter(Boolean).slice(0, 9);
}
