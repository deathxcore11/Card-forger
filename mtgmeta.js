// Magic tournament results without an API key, for the Cloudflare Worker.
//   · Constructed formats: Wizards' official Magic Online decklists (mtgo.com/decklists) —
//     Challenges (ranked, with standings) and Leagues (5-0 lists).
//   · Commander: EDHTop16 (edhtop16.com), competitive Commander results with full decklists.
// Neither allows cross-site browser calls, so the Worker fetches them a few times a day and
// caches the result. Pure functions here are shared with the tests.

export const MTGO_SLUGS = { Standard: "standard", Pioneer: "pioneer", Modern: "modern", Legacy: "legacy", Vintage: "vintage", Pauper: "pauper", Premodern: "premodern", "Duel Commander": "duel-commander" };
export const MTGO_INDEX = "https://www.mtgo.com/decklists";

// Event pages listed on the index for a format, newest first: Challenges before Leagues.
export function mtgoEventSlugs(html, format, { days = 14, now = Date.now(), challenges = 4, leagues = 2 } = {}) {
  const slug = MTGO_SLUGS[format];
  if (!slug) return [];
  const seen = new Set(),
    out = [];
  for (const m of String(html).matchAll(/href="\/decklist\/([a-z0-9-]+)"/g)) {
    const s = m[1];
    if (seen.has(s) || !s.startsWith(slug + "-")) continue;
    seen.add(s);
    const rest = s.slice(slug.length + 1);
    // "challenge-32-2026-10-1112856172" or "league-2026-10-1211161"; never "pauper-commander" for "pauper".
    if (!/^(challenge|league|championship|showcase|qualifier|super-qualifier|last-chance)/.test(rest)) continue;
    const date = rest.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!date || now - Date.parse(`${date[1]}-${date[2]}-${date[3]}`) > days * 864e5) continue;
    out.push({ slug: s, kind: /^league/.test(rest) ? "league" : "challenge", date: `${date[1]}-${date[2]}-${date[3]}` });
  }
  const pick = (k, n) => out.filter((x) => x.kind === k).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  return [...pick("challenge", challenges), ...pick("league", leagues)];
}

export function parseMtgoEvent(html) {
  const m = String(html).match(/window\.MTGO\.decklists\.data\s*=\s*(\{[\s\S]*?\});\s*\n/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

const placeLabel = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n <= 4 ? "Top 4" : n <= 8 ? "Top 8" : n <= 16 ? "Top 16" : n <= 32 ? "Top 32" : `#${n}`);
const cards = (list) => {
  const by = new Map();
  for (const c of list || []) {
    const name = c.card_attributes?.card_name;
    if (!name) continue;
    const r = by.get(name) || { qty: 0, name, land: /LAND/.test(c.card_attributes?.card_type || "") };
    r.qty += Number(c.qty) || 0;
    by.set(name, r);
  }
  return [...by.values()];
};

// Name decks by the cards that set them apart, since MTGO lists carry no archetype labels.
export function labelArchetypes(decks) {
  const sig = (d) => new Set(d.main.filter((r) => !r.land && r.qty >= 2).map((r) => r.name)),
    sigs = decks.map(sig),
    freq = new Map();
  for (const s of sigs) for (const n of s) freq.set(n, (freq.get(n) || 0) + 1);
  const clusters = [];
  decks.forEach((d, i) => {
    const s = sigs[i];
    let best = null,
      bestJ = 0;
    for (const c of clusters) {
      let inter = 0;
      for (const n of s) if (c.core.has(n)) inter++;
      const j = inter / Math.max(1, s.size + c.core.size - inter);
      if (j > bestJ) [best, bestJ] = [c, j];
    }
    if (best && bestJ >= 0.35) best.members.push(i);
    else clusters.push({ core: s, members: [i] });
  });
  for (const c of clusters) {
    const inCluster = new Map();
    for (const i of c.members) for (const n of sigs[i]) inCluster.set(n, (inCluster.get(n) || 0) + 1);
    // Distinctive: played by most of this group, by few others.
    const key = [...inCluster]
      .filter(([, k]) => k / c.members.length >= 0.6)
      .sort((a, b) => b[1] / (freq.get(b[0]) || 1) - a[1] / (freq.get(a[0]) || 1) || b[1] - a[1])
      .slice(0, 2)
      .map(([n]) => n);
    const name = key.length ? key.join(" · ") : decks[c.members[0]].main.filter((r) => !r.land).sort((a, b) => b.qty - a.qty)[0]?.name || "Unlabeled deck";
    for (const i of c.members) decks[i].name = decks[i].archetype = name;
  }
  return decks;
}

const groupShare = (decks) => {
  const groups = new Map();
  for (const d of decks) {
    const g = groups.get(d.archetype) || { name: d.archetype, lists: 0, best: d.key, bestRank: d.rank, cover: d.cover };
    g.lists++;
    if (d.rank < g.bestRank) Object.assign(g, { best: d.key, bestRank: d.rank, cover: d.cover });
    groups.set(d.archetype, g);
  }
  return [...groups.values()].sort((a, b) => b.lists - a.lists).map(({ bestRank, ...g }) => ({ ...g, share: g.lists / Math.max(1, decks.length) }));
};

export function normalizeMtgo(events, { format, days }) {
  const decks = [],
    evs = [],
    // Challenges have a field size and ranked lists; Leagues only publish 5-0 lists (no field size).
    cov = { events: 0, players: 0, topSlots: 0, withList: 0, structured: 0, linkOnly: 0, missing: 0, challenges: 0, challengeLists: 0, leagues: 0, leagueLists: 0 };
  const seenLists = new Set();
  for (const e of events) {
    if (!e?.decklists) continue;
    const league = e.type !== "TOURNAMENT" || /league/i.test(e.description || ""),
      players = Number(e.player_count?.players) || 0,
      url = "https://www.mtgo.com/decklist/" + (e.site_name || ""),
      date = String(e.starttime || "").slice(0, 10),
      rankOf = new Map([...(e.standings || []), ...(e.final_rank || [])].map((s) => [String(s.loginid), Number(s.rank)])),
      wl = new Map((e.winloss || []).map((w) => [String(w.loginid), w]));
    for (const s of e.final_rank || []) rankOf.set(String(s.loginid), Number(s.rank));
    if (evs.some((x) => x.id === e.event_id)) continue;
    cov.events++;
    if (league) cov.leagues++;
    else {
      cov.challenges++;
      cov.players += players;
    }
    evs.push({ id: e.event_id, name: e.description || "MTGO event", date, players: league ? 0 : players, league, url });
    for (const dl of e.decklists) {
      const main = cards(dl.main_deck),
        listKey = e.event_id + ":" + dl.loginid;
      if (!main.length || seenLists.has(listKey)) continue;
      seenLists.add(listKey);
      if (league) cov.leagueLists++;
      else cov.challengeLists++;
      cov.topSlots++;
      cov.withList++;
      cov.structured++;
      const rank = league ? 99 : rankOf.get(String(dl.loginid)) || 99,
        w = wl.get(String(dl.loginid)),
        lead = main.filter((r) => !r.land).sort((a, b) => b.qty - a.qty)[0];
      decks.push({
        key: `mtgo:${e.event_id}:${dl.loginid}`,
        name: "",
        archetype: "",
        commander: "",
        event: e.description || "MTGO event",
        eventId: e.event_id,
        date,
        players: league ? 0 : players,
        rank,
        place: league ? "5-0 League" : placeLabel(rank),
        player: dl.player || "",
        record: w ? `${w.wins}-${w.losses}` : league ? "5-0" : "",
        main: main.map(({ qty, name, land }) => ({ qty, name, land })),
        side: cards(dl.sideboard_deck).map(({ qty, name }) => ({ qty, name })),
        commanders: [],
        cover: lead?.name || "",
        url,
        eventUrl: url,
      });
    }
  }
  labelArchetypes(decks);
  decks.sort((a, b) => a.rank - b.rank || b.date.localeCompare(a.date));
  return { game: "mtg", format, days, source: "Magic Online (official decklists)", sourceUrl: "https://www.mtgo.com/decklists", labelNote: "Deck names come from each list’s key cards (MTGO doesn’t label archetypes).", events: evs.sort((a, b) => b.date.localeCompare(a.date)), decks, archetypes: groupShare(decks), coverage: cov };
}

/* ---------- Commander: EDHTop16 ---------- */

export const EDHTOP16_API = "https://edhtop16.com/api/graphql";
export const edhtop16Query = (n = 12) => ({
  query: `{ commanders(first: ${n}, sortBy: TOP_CUTS, timePeriod: ONE_MONTH, minEntries: 0) { edges { node { name colorId stats(filters:{timePeriod: ONE_MONTH}) { count topCuts metaShare conversionRate } cards { name imageUrls } entries(first: 2, sortBy: TOP, filters:{timePeriod: ONE_MONTH, maxStanding: 8, minEventSize: 32}) { edges { node { standing wins losses draws decklist maindeck { name type } player { name } tournament { name TID size tournamentDate topCut } } } } } } } }`,
});

export function normalizeEdhtop16(json, { days = 30 } = {}) {
  const decks = [],
    archetypes = [],
    evs = new Map(),
    cov = { events: 0, players: 0, topSlots: 0, withList: 0, structured: 0, linkOnly: 0, missing: 0 };
  for (const { node: c } of json?.data?.commanders?.edges || []) {
    const parts = c.name.split(" / "),
      art = c.cards?.[0]?.imageUrls?.[0] || "";
    let best = null;
    for (const { node: e } of c.entries?.edges || []) {
      const t = e.tournament || {};
      if (t.TID && !evs.has(t.TID)) evs.set(t.TID, { id: t.TID, name: t.name, date: String(t.tournamentDate || "").slice(0, 10), players: t.size || 0, url: `https://edhtop16.com/tournament/${encodeURIComponent(t.TID)}` });
      cov.topSlots++;
      const main = (e.maindeck || []).filter((x) => x?.name && !parts.includes(x.name));
      if (!main.length) {
        if (e.decklist) cov.linkOnly++;
        else cov.missing++;
        continue;
      }
      cov.withList++;
      cov.structured++;
      const d = {
        key: `edh:${t.TID}:${e.standing}:${c.name}`,
        name: c.name,
        archetype: c.name,
        commander: c.name,
        event: t.name || "cEDH tournament",
        eventId: t.TID,
        date: String(t.tournamentDate || "").slice(0, 10),
        players: t.size || 0,
        rank: e.standing || 99,
        place: placeLabel(e.standing || 99),
        player: e.player?.name || "",
        record: [e.wins, e.losses].every((x) => typeof x === "number") ? `${e.wins}-${e.losses}${e.draws ? "-" + e.draws : ""}` : "",
        commanders: parts.map((name) => ({ qty: 1, name })),
        main: main.map((x) => ({ qty: 1, name: x.name, land: /Land/.test(x.type || "") })),
        side: [],
        cover: parts[0],
        art,
        url: e.decklist || `https://edhtop16.com/commander/${encodeURIComponent(c.name)}`,
        eventUrl: evs.get(t.TID)?.url || "",
      };
      decks.push(d);
      if (!best || d.rank < best.rank) best = d;
    }
    archetypes.push({ name: c.name, lists: c.stats?.topCuts || 0, entries: c.stats?.count || 0, share: c.stats?.metaShare || 0, conversion: c.stats?.conversionRate ?? null, best: best?.key || "", cover: parts[0], art });
  }
  cov.events = evs.size;
  cov.players = [...evs.values()].reduce((a, e) => a + e.players, 0);
  return { game: "mtg", format: "EDH", days, source: "EDHTop16 (competitive Commander)", sourceUrl: "https://edhtop16.com", shareNote: "Share of all entries at tracked cEDH events in the last month; top-cut rate = top cuts ÷ entries.", events: [...evs.values()].sort((a, b) => b.date.localeCompare(a.date)), decks: decks.sort((a, b) => a.rank - b.rank || b.date.localeCompare(a.date)), archetypes, coverage: cov };
}
