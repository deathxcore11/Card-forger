// Magic tournament results from TopDeck.gg (https://topdeck.gg) for the Cloudflare Worker.
// TopDeck's API is free but needs a key and a visible credit ("Data provided by TopDeck.gg").
// The key lives only in the Worker (secret TOPDECK_KEY); the browser never sees it.
// Pure functions here are shared with the tests and the coverage script.

export const TOPDECK_API = "https://topdeck.gg/api/v2/tournaments";
// TopDeck format names (case sensitive) the site may ask for.
export const TOPDECK_FORMATS = ["Standard", "Pioneer", "Modern", "Legacy", "Vintage", "Pauper", "Premodern", "EDH", "Pauper EDH", "Duel Commander", "Canadian Highlander"];
// Formats warmed by the daily schedule and listed in the coverage report.
export const WARM_FORMATS = ["Standard", "Pioneer", "Modern", "Legacy", "Vintage", "Pauper", "Premodern", "EDH"];

const SECTION = /^~~\s*(.+?)\s*~~$/;
const ZONE = (s) => (/command/i.test(s) ? "commanders" : /side/i.test(s) ? "side" : /companion/i.test(s) ? "side" : "main");

// "~~Mainboard~~\n4 Lightning Bolt\n…" → { main, side, commanders }. Returns null for a link or nothing.
export function parseDecklist(text) {
  if (!text || typeof text !== "string" || /^https?:\/\//i.test(text.trim())) return null;
  const out = { main: [], side: [], commanders: [] };
  let zone = "main";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sec = line.match(SECTION);
    if (sec) {
      zone = ZONE(sec[1]);
      continue;
    }
    const m = line.match(/^(\d{1,3})x?\s+(.+?)\s*$/i);
    if (m) out[zone].push({ qty: Number(m[1]), name: m[2] });
    else if (zone === "commanders") out.commanders.push({ qty: 1, name: line });
  }
  return out.main.length || out.commanders.length ? out : null;
}

// deckObj: { Commanders: { "Name": {count} | n }, Mainboard: {…}, Sideboard: {…} }
export function parseDeckObj(obj) {
  if (!obj || typeof obj !== "object") return null;
  const out = { main: [], side: [], commanders: [] };
  for (const [section, cards] of Object.entries(obj)) {
    if (!cards || typeof cards !== "object") continue;
    for (const [name, v] of Object.entries(cards)) {
      const qty = typeof v === "number" ? v : Number(v?.count ?? v?.quantity ?? v?.qty ?? 1);
      if (name && qty > 0) out[ZONE(section)].push({ qty, name: v?.name || name });
    }
  }
  return out.main.length || out.commanders.length ? out : null;
}

const placeLabel = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n <= 4 ? "Top 4" : n <= 8 ? "Top 8" : n <= 16 ? "Top 16" : n <= 32 ? "Top 32" : `#${n}`);

/**
 * Raw TopDeck tournaments → the shape the app shows, plus honest coverage numbers.
 * Only top-cut lists are kept (Top 8, or the event's own cut), so "share" means share of
 * published top-cut lists — not overall popularity or win rate.
 */
export function normalizeTopdeck(raw, { format, days }) {
  const events = [],
    decks = [];
  const cov = { events: 0, players: 0, topSlots: 0, withList: 0, structured: 0, linkOnly: 0, missing: 0 };
  const seen = new Set();
  for (const t of Array.isArray(raw) ? raw : []) {
    if (!t?.TID || seen.has(t.TID)) continue;
    seen.add(t.TID);
    const standings = Array.isArray(t.standings) ? t.standings : [],
      cut = Math.max(8, Number(t.topCut) || 0),
      url = `https://topdeck.gg/event/${encodeURIComponent(t.TID)}`;
    cov.events++;
    cov.players += standings.length;
    events.push({ id: t.TID, name: t.tournamentName || "Tournament", date: t.startDate ? new Date(t.startDate * 1000).toISOString().slice(0, 10) : "", players: standings.length, topCut: Number(t.topCut) || 0, url });
    standings.slice(0, cut).forEach((s, i) => {
      const rank = Number(s.standing) || i + 1;
      cov.topSlots++;
      const fromObj = parseDeckObj(s.deckObj),
        list = fromObj || parseDecklist(s.decklist);
      if (fromObj) cov.structured++;
      if (list) cov.withList++;
      else if (typeof s.decklist === "string" && /^https?:\/\//i.test(s.decklist.trim())) cov.linkOnly++;
      else cov.missing++;
      if (!list) return;
      const commander = s.leader || list.commanders.map((c) => c.name).join(" / ");
      decks.push({
        key: `mtg:${t.TID}:${rank}`,
        name: s.archetype || commander || s.archetypeInput || "Unlabeled deck",
        archetype: s.archetype || commander || "",
        commander: commander || "",
        event: t.tournamentName || "Tournament",
        eventId: t.TID,
        date: t.startDate ? new Date(t.startDate * 1000).toISOString().slice(0, 10) : "",
        players: standings.length,
        rank,
        place: placeLabel(rank),
        player: s.name || "",
        record: [s.wins, s.losses, s.draws].every((x) => typeof x === "number") ? `${s.wins}-${s.losses}${s.draws ? "-" + s.draws : ""}` : "",
        main: list.main,
        side: list.side,
        commanders: list.commanders,
        url,
        eventUrl: url,
      });
    });
  }
  const groups = new Map();
  for (const d of decks) {
    const k = d.archetype || "Unlabeled";
    const g = groups.get(k) || { name: k, lists: 0, best: d.key, bestRank: d.rank };
    g.lists++;
    if (d.rank < g.bestRank) Object.assign(g, { best: d.key, bestRank: d.rank });
    groups.set(k, g);
  }
  decks.sort((a, b) => a.rank - b.rank || b.players - a.players || b.date.localeCompare(a.date));
  return {
    game: "mtg",
    format,
    days,
    source: "TopDeck.gg",
    events: events.sort((a, b) => b.date.localeCompare(a.date)),
    decks,
    archetypes: [...groups.values()].sort((a, b) => b.lists - a.lists).map(({ bestRank, ...g }) => ({ ...g, share: g.lists / Math.max(1, decks.length) })),
    coverage: cov,
  };
}

export const topdeckBody = (format, days, participantMin = 16) => ({
  game: "Magic: The Gathering",
  format,
  last: days,
  participantMin,
  columns: ["name", "decklist", "wins", "draws", "losses"],
});
