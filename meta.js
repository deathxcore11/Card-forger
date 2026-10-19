import { sourceDate, applyMetaOverlay } from './meta-curation.js';
import { tallyResults } from "./matchup.js";
import { pokemonDeckCover } from "./artwork.js";
// Live "what's winning right now" data for Yu-Gi-Oh! and Pokémon.
// · Yu-Gi-Oh!: YGOPRODeck's curated Tournament Meta Decks (recent WCQ/YCS top cuts) and the
//   most-played cards in them. YGOPRODeck doesn't allow cross-site calls, so the site's
//   Cloudflare Worker fetches and caches them (/api/meta/ygo/…).
// · Pokémon: the biggest recent Standard events on Limitless (play.limitlesstcg.com), their
//   archetype shares and Top 8 decklists.
// Results are cached on the device for 12 hours.

const KEY = "cardforge-meta-v1",
  TTL = 12 * 3600 * 1000,
  PTCG_ART_SCHEMA = 2;
const state = {};

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const writeCache = (g, data) => {
  try {
    const all = readCache();
    all[g] = { at: Date.now(), data };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
};

// Bumped whenever new tournament data arrives, so derived views (emblems) recompute.
let version = 0;
export const metaVersion = () => version;
// Every cached dataset (all games, every Magic format looked at): { key: { at, data } }.
export const allCachedMeta = () => {
  const all = readCache();
  for (const [g, M] of Object.entries(state)) if (M.data && (!all[g] || all[g].at < M.at)) all[g] = { at: M.at, data: M.data };
  return all;
};

export const metaState = (g) => {
  if (!state[g]) {
    const saved = readCache()[g];
    state[g] = { data: saved?.data || null, at: saved?.at || 0, artRefreshAttempted: !!saved?.artRefreshAttempted, busy: false, error: "" };
  }
  return state[g];
};

const needsArtworkRefresh = (g, M) => g === "ptcg" && M.data && M.data.artSchema !== PTCG_ART_SCHEMA && !M.artRefreshAttempted;
export const metaNeedsRefresh = (g) => {
  const M = metaState(g);
  return !M.data || Date.now() - M.at >= TTL || !!needsArtworkRefresh(g, M);
};

// One schema-refresh attempt per saved snapshot, persisted before requesting.
// A failed/offline refresh leaves its data and original update time intact. Normal
// TTL expiry and the user's explicit Refresh remain available; render never loops.
function markArtworkRefresh(g, M) {
  M.artRefreshAttempted = true;
  try {
    const all = readCache();
    if (all[g]?.at === M.at) {
      all[g].artRefreshAttempted = true;
      localStorage.setItem(KEY, JSON.stringify(all));
    }
  } catch {}
}

export async function loadMeta(g, force = false) {
  const M = metaState(g);
  if (M.busy) return M.promise;
  if (!force && !metaNeedsRefresh(g)) return M.data;
  if (needsArtworkRefresh(g, M)) markArtworkRefresh(g, M);
  M.busy = true;
  M.error = "";
  M.code = "";
  M.promise = (g.startsWith("mtg:") ? mtgMeta(g.slice(4)) : g === "ygo" ? ygoMeta() : ptcgMeta())
    .then(async (data) => {
      try { const game = g.startsWith('mtg:') ? 'mtg' : g, format = g.startsWith('mtg:') ? g.slice(4) : game === 'ptcg' ? 'Standard' : 'TCG'; const response = await fetch(`api/meta/curation?${new URLSearchParams({game,format})}`, { headers: { Accept:'application/json' }, signal: AbortSignal.timeout(4000) }); if (response.ok) data = applyMetaOverlay(data, await response.json()); } catch {}
      M.data = data;
      M.at = Date.now();
      M.artRefreshAttempted = false;
      writeCache(g, data);
      version++;
      return data;
    })
    .catch((e) => {
      M.error = e.message || "Couldn’t load the current meta.";
      M.code = e.code || "";
      if (!M.data) throw e;
      return M.data;
    })
    .finally(() => {
      M.busy = false;
    });
  return M.promise;
}

/* ---------- Magic (TopDeck.gg, through the Worker) ---------- */

export const DEFAULT_MTG_META_FORMAT = "Modern";
export const MTG_META_FORMATS = [["Standard", "Standard"], ["Pioneer", "Pioneer"], ["Modern", "Modern"], ["Legacy", "Legacy"], ["Vintage", "Vintage"], ["Pauper", "Pauper"], ["Premodern", "Premodern"], ["Duel Commander", "Duel Commander"], ["EDH", "Commander (cEDH)"]];
export async function mtgMeta(format, days = 30) {
  let r;
  try {
    r = await fetch(`api/meta/mtg?format=${encodeURIComponent(format)}&days=${days}`, { headers: { Accept: "application/json" } });
  } catch {
    throw Error("Couldn’t reach the site’s tournament service. Check your connection.");
  }
  const body = await r.json().catch(() => null);
  if (!body) throw Object.assign(Error("Magic tournament results load on your published site (they come through the Cloudflare Worker)."), { code: "no_worker" });
  if (body.error === "not_configured") throw Object.assign(Error(body.message), { code: "not_configured" });
  if (!r.ok) throw Error(body.message || "TopDeck.gg is unavailable right now.");
  return body;
}

/* ---------- Yu-Gi-Oh! ---------- */

const YGO_UP = {
  decks: (offset) => `https://ygoprodeck.com/api/decks/getDecks.php?format=Tournament%20Meta%20Decks&offset=${offset}`,
  top: (since) => `https://ygoprodeck.com/api/top/getFormat.php?format=Tournament%20Meta%20Decks&dateStart=${since}`,
};
// The Worker route first (works on the published site); YGOPRODeck directly as a fallback.
async function ygoGet(path, upstream) {
  for (const url of [path, upstream]) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) continue;
      return await r.json();
    } catch {}
  }
  throw Error("The Yu-Gi-Oh! meta loads on your published site (it comes through the Cloudflare Worker).");
}
const ids = (s) => {
  try {
    return (JSON.parse(s || "[]") || []).map(String);
  } catch {
    return [];
  }
};
const PLACE = { Winner: 1, "Runner-Up": 2, "Top 4": 4, "Top 8": 8, "Top 16": 16, "Top 32": 32, "Top 64": 64 };

export async function ygoMeta({ fetchImpl = globalThis.fetch, now = Date.now(), server = false } = {}) {
  const get = async (path, upstream) => {
    if (!server && fetchImpl === globalThis.fetch) return ygoGet(path, upstream);
    const r = await fetchImpl(server ? upstream : path, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!r.ok) throw Error('Yu-Gi-Oh! tournament source unavailable');
    return r.json();
  };
  const since = new Date(now - 90 * 864e5).toISOString().slice(0, 10);
  const [p0, p1, p2, top] = await Promise.all([
    get("api/meta/ygo/decks?offset=0", YGO_UP.decks(0)),
    get("api/meta/ygo/decks?offset=20", YGO_UP.decks(20)).catch(() => []),
    get("api/meta/ygo/decks?offset=40", YGO_UP.decks(40)).catch(() => []),
    server ? { results: [] } : get("api/meta/ygo/top?since=" + since, YGO_UP.top(since)).catch(() => ({ results: [] })),
  ]);
  const seenDecks = new Set();
  const decks = [...(Array.isArray(p0) ? p0 : []), ...(Array.isArray(p1) ? p1 : []), ...(Array.isArray(p2) ? p2 : [])]
    .filter((d) => { if (!d?.main_deck || !d.deckNum || seenDecks.has(String(d.deckNum))) return false; seenDecks.add(String(d.deckNum)); const date = sourceDate(d.submit_date); return !date || Date.parse(date) <= now && now - Date.parse(date) <= 90 * 864e5; })
    .map((d) => ({
      key: "ygo:" + d.deckNum,
      name: d.deck_name || "Tournament deck",
      event: cleanName(d.tournamentName),
      place: d.tournamentPlacement || "",
      rank: PLACE[d.tournamentPlacement] || 99,
      players: Number(d.tournamentPlayerCount) || 0,
      player: d.tournamentPlayerName || "",
      date: sourceDate(d.submit_date),
      dateMeaning: "List submitted",
      region: /\bOCG\b/i.test(String(d.deck_format || d.format || "")) ? "OCG" : "Region unverified",
      main: ids(d.main_deck),
      extra: ids(d.extra_deck),
      side: ids(d.side_deck),
      cover: String(d.cover_card || ""),
      url: d.pretty_url ? "https://ygoprodeck.com/deck/" + d.pretty_url : "",
    }));
  // Share by deck name, as the event reported it.
  const groups = new Map();
  for (const d of decks) {
    const k = d.name.trim();
    const x = groups.get(k) || { name: k, count: 0, best: d };
    x.count++;
    if (d.rank < x.best.rank) x.best = d;
    groups.set(k, x);
  }
  return {
    game: "ygo",
    fetchedAt: new Date(now).toISOString(),
    source: "YGOPRODeck Tournament Meta Decks",
    decks,
    archetypes: [...groups.values()].sort((a, b) => b.count - a.count).map((x) => ({ ...x, share: x.count / Math.max(1, decks.length), best: x.best.key })),
    top: ((top && top.results) || []).slice(0, 60).map((r) => ({ id: String(r.card_number), name: r.name, pct: Number(r.percentage) || 0, avg: Number(r.avg_card_per_deck) || 0, type: r.type || "" })),
  };
}

/* ---------- Pokémon ---------- */

// Organizers decorate event names with emoji ("🏆Moujii's Dojo🏆"); show the plain name.
export const cleanName = (s) => String(s || "").replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s{2,}/g, " ").trim();

const LIMITLESS = "https://play.limitlesstcg.com/api";
export async function ptcgMeta({ fetchImpl = globalThis.fetch, now = Date.now(), server = false } = {}) {
  const source = async path => { const r = await fetchImpl(LIMITLESS + path, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } }); if (!r.ok) throw Error('Limitless is unavailable right now (' + r.status + ').'); return r.json(); };
  const list = await source("/tournaments?game=PTCG&format=STANDARD&limit=100");
  const cutoff = now - 21 * 864e5;
  const validEvents = (Array.isArray(list) ? list : []).filter(t => t && /^[a-zA-Z0-9_-]{1,80}$/.test(t.id || '') && (!t.game || t.game === 'PTCG') && (!t.format || t.format === 'STANDARD'));
  const events = validEvents
    .filter((t) => Date.parse(sourceDate(t.date)) >= cutoff && Date.parse(sourceDate(t.date)) <= now && (!t.game || t.game === "PTCG") && (!t.format || t.format === "STANDARD") && t.players >= 24)
    .sort((a, b) => b.players - a.players)
    .slice(0, 6);
  if (!events.length) throw Error("No recent Standard events found.");
  const standings = await Promise.all(events.map((t) => source(`/tournaments/${t.id}/standings`).then((s) => ({ t, s })).catch(() => ({ t, s: [] }))));
  // Real results for the Matchups tab: every round of the biggest recent events (up to 12),
  // tallied by archetype and head to head (realMatchup in matchup.js).
  // Weekly editorial curation needs lists, not a second download of matchup rounds.
  const resultEvents = server ? [] : validEvents.filter((t) => Date.parse(sourceDate(t.date)) >= cutoff && Date.parse(sourceDate(t.date)) < now - 864e5 && t.players >= 32).sort((a, b) => b.players - a.players).slice(0, 12);
  const games = [];
  await Promise.all(resultEvents.map(async (t) => {
    try {
      const [s, pairs] = await Promise.all([standings.find((x) => x.t.id === t.id)?.s || source(`/tournaments/${t.id}/standings`), source(`/tournaments/${t.id}/pairings`)]);
      const deckOf = new Map((s || []).filter((p) => p.deck?.name).map((p) => [p.player, p.deck.name]));
      for (const m of pairs || []) {
        const a = deckOf.get(m.player1), b = deckOf.get(m.player2);
        if (a && b && m.winner && m.winner !== -1 && m.winner !== 0) games.push([a, b, m.winner === m.player1 ? 1 : 0]);
      }
    } catch {}
  }));
  const arch = new Map(),
    decks = [];
  let players = 0;
  for (const { t, s } of standings)
    for (const p of s || []) {
      if (!p?.deck?.id) continue;
      players++;
      const a = arch.get(p.deck.id) || { id: p.deck.id, name: p.deck.name, icons: Array.isArray(p.deck.icons) ? p.deck.icons : [], count: 0, top8: 0, best: null, cover: null };
      a.count++;
      if (p.placing && p.placing <= 8) a.top8++;
      arch.set(p.deck.id, a);
      if (p.decklist) {
        const rows = [];
        for (const [kind, key] of [["Pokemon", "pokemon"], ["Trainer", "trainer"], ["Energy", "energy"]])
          for (const c of Array.isArray(p.decklist[key]) ? p.decklist[key] : []) if (c && typeof c.name === "string") rows.push({ qty: c.count, name: c.name, set: c.set || "", number: c.number || "", kind });
        const cover = pokemonDeckCover({ name: a.name, icons: a.icons, list: rows }), rank = Number(p.placing) > 0 ? Number(p.placing) : Infinity;
        if (cover && (!a.cover || rank < a.coverRank)) {
          a.cover = { ...cover, source: { eventId: t.id, rank: Number.isFinite(rank) ? rank : null } };
          a.coverRank = rank;
        }
        const d = { key: "ptcg:" + t.id + ":" + p.placing, name: p.deck.name, archetype: p.deck.id, icons: p.deck.icons || [], event: cleanName(t.name), place: p.placing === 1 ? "Winner" : p.placing === 2 ? "Runner-Up" : "Top " + (p.placing <= 4 ? 4 : p.placing <= 8 ? 8 : p.placing), rank: p.placing, players: t.players, player: p.name || "", date: t.date?.slice(0, 10) || "", list: rows, url: `https://play.limitlesstcg.com/tournament/${t.id}/player/${encodeURIComponent(p.player || "")}/decklist` };
        // Keep a real representative accessible without polluting Top-8 stats.
        if(rows.length&&(!a.representative||d.rank<a.representative.rank))a.representative=d;
        if (!(p.placing && p.placing <= 8)) continue;
        decks.push(d);
        if (!a.best || d.rank < a.best.rank) a.best = d;
      }
    }
  // How often each card shows up in the Top 8 lists, and how many copies on average.
  const cards = new Map();
  for (const d of decks)
    for (const r of d.list) {
      const c = cards.get(r.name) || { name: r.name, kind: r.kind, decks: 0, copies: 0 };
      c.decks++;
      c.copies += r.qty;
      cards.set(r.name, c);
    }
  return {
    game: "ptcg",
    format: "Standard",
    fetchedAt: new Date(now).toISOString(),
    artSchema: PTCG_ART_SCHEMA,
    results: games.length ? { ...tallyResults(games), events: resultEvents.length } : null,
    source: "Limitless — " + events.length + " recent Standard events, " + players + " players",
    events: events.map((t) => ({ name: cleanName(t.name), players: t.players, date: t.date?.slice(0, 10) })),
    decks: decks.sort((a, b) => a.rank - b.rank || b.players - a.players),
    archetypes: [...arch.values()].filter((a) => a.id !== "other").sort((a, b) => b.count - a.count).map((a) => ({ id: a.id, name: a.name, icons: a.icons, count: a.count, top8: a.top8, share: a.count / Math.max(1, players), best: a.best?.key || "", representative: a.best || a.representative || null, cover: pokemonDeckCover(a.best) || a.cover })),
    top: [...cards.values()].map((c) => ({ name: c.name, kind: c.kind, pct: (c.decks / Math.max(1, decks.length)) * 100, avg: c.copies / c.decks })).sort((a, b) => b.pct - a.pct),
  };
}

export const ptcgIcon = (name) => `https://r2.limitlesstcg.net/pokemon/gen9/${encodeURIComponent(name)}.png`;
