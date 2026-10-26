// Magic tournament results without an API key, for the Cloudflare Worker.
//   · Constructed formats: Wizards' official Magic Online decklists (mtgo.com/decklists) —
//     Challenges (ranked, with standings) and Leagues (5-0 lists).
//   · Commander: MTGTop8 (mtgtop8.com), competitive Commander results with full decklists.
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
    const published = date ? `${date[1]}-${date[2]}-${date[3]}` : '', timestamp = Date.parse(published);
    if (!date || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0,10) !== published || timestamp > now || now - timestamp > days * 864e5) continue;
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

/* ---------- Commander: MTGTop8 ---------- */
// MTGTop8 collects competitive Commander results (most from TopDeck.gg) with full lists.
// Its pages are Latin-1 HTML; the Worker decodes them before these parsers see them.

export const MTGTOP8 = "https://www.mtgtop8.com";
export const MTGTOP8_FORMAT = MTGTOP8 + "/format?f=cEDH";
export const mtgtop8EventUrl = (id) => `${MTGTOP8}/event?e=${id}&f=cEDH`;
export const mtgtop8ExportUrl = (deckId) => `${MTGTOP8}/mtgo?d=${deckId}`;
const dmy = (s) => {
  const m = /^(\d\d)\/(\d\d)\/(\d\d)$/.exec(s || "");
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : "";
};
const unhtml = (s) => String(s || "").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// Precon and power-bracket events are not competitive Commander.
const casualEvent = (name) => /\bbracket\s*[1-4]\b|\bprecon|\bcasual\b/i.test(name);

// Events on a cEDH format page: id, name, date and weight (a major event's big star counts 4).
export function mtgtop8Events(html) {
  const out = [];
  for (const [, row] of String(html).matchAll(/<tr class=hover_tr>([\s\S]*?)<\/tr>/g)) {
    const link = /href=event\?e=(\d+)&f=cEDH>([^<]*)<\/a>/.exec(row),
      date = dmy(/class=S12>(\d\d\/\d\d\/\d\d)</.exec(row)?.[1]);
    if (!link || !date) continue;
    const big = (row.match(/bigstar\.png/g) || []).length;
    out.push({ id: link[1], name: unhtml(link[2]), date, stars: (row.match(/star\.png/g) || []).length - big + big * 4 });
  }
  return out;
}
// The format page's further pages of events, as absolute URLs, in page order.
export const mtgtop8Pages = (html) => [...new Set([...String(html).matchAll(/href=\?f=cEDH&meta=(\d+)&cp=(\d+)/g)].sort((a, b) => a[2] - b[2]).map((m) => `${MTGTOP8_FORMAT}&meta=${m[1]}&cp=${m[2]}`))];

// The weightiest recent competitive events, once each.
export function pickMtgtop8Events(events, { now = Date.now(), days = 14, limit = 8 } = {}) {
  const seen = new Set();
  return events
    .filter((e) => {
      const t = Date.parse(e.date);
      if (seen.has(e.id) || !Number.isFinite(t) || t > now + 864e5 || now - t > days * 864e5 || casualEvent(e.name)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => b.stars - a.stars || b.date.localeCompare(a.date))
    .slice(0, limit);
}

// One event page: field size, date, original source and the standings with deck ids.
export function parseMtgtop8Event(html, id) {
  const t = String(html),
    head = /(\d+) players - (\d\d\/\d\d\/\d\d)/.exec(t),
    entries = [];
  for (const part of t.split('<div style="width:42px;" align=center class=S14>').slice(1)) {
    const placing = part.slice(0, part.indexOf("<")).trim(),
      deck = /href=\?e=(\d+)&d=(\d+)&f=cEDH>([^<]*)<\/a>/.exec(part);
    if (!deck || deck[1] !== String(id) || !/^\d+(-\d+)?$/.test(placing)) continue;
    entries.push({ placing, rank: parseInt(placing, 10), deckId: deck[2], commander: unhtml(deck[3]), player: unhtml(/class=player href=[^>]*>([^<]*)<\/a>/.exec(part)?.[1]) });
  }
  return { id: String(id), players: Number(head?.[1]) || 0, date: dmy(head?.[2]), source: /Source: <a[^>]*href=(https:\/\/[^\s>]+)/.exec(t)?.[1] || "", entries };
}

const BASIC = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest)$|^Wastes$/;
// A deck export: main deck, then "Sideboard" holding the commander(s). Only a legal-size
// Commander list (one or two commanders, 100 cards) is accepted.
export function parseMtgtop8Export(text) {
  const main = [],
    commanders = [];
  let side = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (/^sideboard$/i.test(line)) {
      side = true;
      continue;
    }
    const m = /^(\d+)\s+(.+)$/.exec(line);
    if (!m) continue;
    const name = m[2].includes("//") ? m[2] : m[2].replace(/\s*\/\s*/, " // ");
    (side ? commanders : main).push({ qty: Number(m[1]), name, ...(side ? {} : { land: BASIC.test(name) }) });
  }
  const total = [...main, ...commanders].reduce((a, r) => a + r.qty, 0);
  return commanders.length >= 1 && commanders.length <= 2 && commanders.every((c) => c.qty === 1) && total === 100 ? { commanders, main } : null;
}

const MTGTOP8_PLACE = (placing, rank) => (placing === "1" ? "1st" : placing === "2" ? "2nd" : placeLabel(rank));
// Events (parsed pages with their format-page names) and deck lists by id, in the shape every
// meta view uses. A standing without a usable list is counted, never invented.
export function normalizeMtgtop8(events, lists, { days = 14 } = {}) {
  const decks = [],
    evs = [],
    cov = { events: 0, players: 0, topSlots: 0, withList: 0, structured: 0, linkOnly: 0, missing: 0 };
  for (const ev of events) {
    const eventUrl = mtgtop8EventUrl(ev.id);
    evs.push({ id: ev.id, name: ev.name, date: ev.date, players: ev.players, url: eventUrl, source: ev.source || "" });
    for (const e of ev.entries) {
      cov.topSlots++;
      const list = lists.get(e.deckId);
      if (!list) {
        cov.missing++;
        continue;
      }
      cov.withList++;
      cov.structured++;
      const name = list.commanders.map((c) => c.name).join(" + ");
      decks.push({
        key: `t8:${ev.id}:${e.deckId}`,
        name,
        archetype: name,
        commander: name,
        event: ev.name || "cEDH tournament",
        eventId: ev.id,
        date: ev.date,
        players: ev.players,
        rank: e.rank,
        place: MTGTOP8_PLACE(e.placing, e.rank),
        player: e.player,
        record: "",
        commanders: list.commanders,
        main: list.main,
        side: [],
        cover: list.commanders[0].name,
        art: "",
        url: `${MTGTOP8}/event?e=${ev.id}&d=${e.deckId}&f=cEDH`,
        eventUrl,
      });
    }
  }
  cov.events = evs.length;
  cov.players = evs.reduce((a, e) => a + e.players, 0);
  decks.sort((a, b) => a.rank - b.rank || b.date.localeCompare(a.date));
  return { game: "mtg", format: "EDH", days, source: "MTGTop8 (competitive Commander)", sourceUrl: MTGTOP8_FORMAT, shareNote: "Share of the top finishes listed here, from the largest recent cEDH events.", events: evs.sort((a, b) => b.date.localeCompare(a.date)), decks, archetypes: groupShare(decks), coverage: cov };
}
