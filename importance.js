// Deck-building emblems: how much a card matters right now, from the tournament data the app
// already caches (meta.js) plus EDHREC popularity for Magic. Several kinds, best one on tiles:
//   · Meta staple (gold)     — in at least 25% of recent top lists
//   · Meta card (silver)     — in at least 8%
//   · Flexible staple (blue) — played across 3+ different archetypes (goes in many decks)
//   · Commander staple (purple, Magic) — EDHREC top 250
//   · Tournament played (bronze) — seen in recent top lists
// Basic lands and basic Energy are everywhere, so they never get an emblem.

import { allCachedMeta, metaVersion } from "./meta.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const nameKey = (n) => String(n || "").split(" // ")[0].toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const BASIC = /^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$|^(?:basic )?(?:grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy) energy$/i;
export const isBasic = (name) => BASIC.test(String(name || "").trim());

export const TIERS = { core: 25, meta: 8, flexArchetypes: 3, flexPct: 5, edh: 250, minDecks: 10 };

// card key → { pct, lists, total, archetypes:Set, format } for one dataset of decks.
// `cardsOf(deck)` gives the deck's card keys; `archOf(deck)` its archetype name.
export function indexDecks(decks, cardsOf, archOf, format = "") {
  const out = new Map(),
    total = decks.length;
  if (!total) return out;
  for (const d of decks) {
    const arch = archOf(d);
    for (const k of new Set(cardsOf(d))) {
      if (!k) continue;
      const e = out.get(k) || { lists: 0, archetypes: new Set(), total, format };
      e.lists++;
      if (arch) e.archetypes.add(arch);
      out.set(k, e);
    }
  }
  for (const e of out.values()) e.pct = (e.lists / total) * 100;
  return out;
}

// Keep the strongest reading per card across formats/sources.
const mergeInto = (into, from) => {
  for (const [k, e] of from) {
    const was = into.get(k);
    if (!was || e.pct > was.pct) into.set(k, was ? { ...e, formats: [...new Set([...(was.formats || [was.format]), e.format])] } : { ...e, formats: [e.format] });
    else was.formats = [...new Set([...(was.formats || [was.format]), e.format])];
  }
};

export function buildIndex(game, cached) {
  const idx = new Map();
  for (const [g, entry] of Object.entries(cached || {})) {
    const data = entry?.data;
    if (!data?.decks?.length || data.decks.length < TIERS.minDecks) continue;
    if (game === "mtg" && g.startsWith("mtg:")) {
      const fmt = data.format === "EDH" ? "Commander (cEDH)" : data.format || g.slice(4);
      mergeInto(idx, indexDecks(data.decks, (d) => [...(d.main || []), ...(d.commanders || [])].filter((r) => !r.land || !isBasic(r.name)).map((r) => nameKey(r.name)), (d) => d.archetype || d.name, fmt));
    } else if (game === "ygo" && g === "ygo") {
      const m = indexDecks(data.decks, (d) => [...(d.main || []), ...(d.extra || [])].map(String), (d) => d.name, "Yu-Gi-Oh! tournaments");
      // YGOPRODeck's own 90-day "most played" figure, when it is higher.
      for (const t of data.top || []) {
        const e = m.get(String(t.id));
        if (!e || t.pct > e.pct) m.set(String(t.id), { ...(e || { lists: 0, archetypes: new Set(), total: data.decks.length, format: "Yu-Gi-Oh! tournaments" }), pct: t.pct });
      }
      mergeInto(idx, m);
    } else if (game === "ptcg" && g === "ptcg") {
      mergeInto(idx, indexDecks(data.decks, (d) => (d.list || []).filter((r) => !isBasic(r.name)).map((r) => nameKey(r.name)), (d) => d.archetype || d.name, "Pokémon Standard"));
    }
  }
  return idx;
}

let memo = { v: -1, idx: {} };
export const indexFor = (game) => {
  const v = metaVersion();
  if (memo.v !== v) memo = { v, idx: {}, cached: allCachedMeta() };
  if (!memo.idx[game]) {
    memo.idx[game] = buildIndex(game, memo.cached);
    recordSnapshot(game, memo.idx[game]);
  }
  return memo.idx[game];
};

/** Every emblem a card earns, strongest first. `card` is a Scryfall card (Magic) or a normalized YGO/Pokémon card. */
export function importance(game, card, idx = indexFor(game)) {
  if (!card?.name || isBasic(card.name)) return [];
  const e = idx.get(game === "ygo" ? String(card.id) : nameKey(card.name)) || (game === "ygo" ? idx.get(nameKey(card.name)) : null);
  const out = [];
  if (e) {
    const where = e.formats?.length > 1 ? `${e.format} (also ${e.formats.filter((f) => f !== e.format).slice(0, 2).join(", ")})` : e.format;
    const share = `${e.pct >= 10 ? Math.round(e.pct) : e.pct.toFixed(1)}% of recent ${where} top lists`;
    if (e.pct >= TIERS.core) out.push({ kind: "core", label: "Meta staple", detail: share });
    else if (e.pct >= TIERS.meta) out.push({ kind: "meta", label: "Meta card", detail: share });
    if (e.archetypes.size >= TIERS.flexArchetypes && e.pct >= TIERS.flexPct) out.push({ kind: "flex", label: "Flexible staple", detail: `played in ${e.archetypes.size} different decks — useful beyond one archetype` });
    if (e.pct < TIERS.meta) out.push({ kind: "played", label: "Tournament played", detail: share });
  }
  const rank = game === "mtg" ? Number(card.edhrec_rank) : 0;
  if (rank && rank <= TIERS.edh) out.push({ kind: "edh", label: "Commander staple", detail: `#${rank.toLocaleString()} most played on EDHREC` });
  const order = ["core", "meta", "edh", "flex", "played"];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

const GLYPH = {
  core: `<path d="M7 15.5h10l1-7-3.5 2.6L12 6.5l-2.5 4.6L6 8.5z" fill="#3a2a00"/>`,
  meta: `<path d="M12 6.2l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#1f2630"/>`,
  flex: `<path d="M12 6.5l5 5.5-5 5.5-5-5.5z" fill="none" stroke="#06223a" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6" fill="#06223a"/>`,
  edh: `<path d="M8 8.5h8v3.2c0 2.8-1.8 4.6-4 5.6-2.2-1-4-2.8-4-5.6z" fill="none" stroke="#24073d" stroke-width="1.8"/><path d="M12 9.8v5" stroke="#24073d" stroke-width="1.6"/>`,
  played: `<circle cx="12" cy="12" r="3.2" fill="#2f1806"/>`,
};
const FILL = { core: ["#ffe9a3", "#d6a531"], meta: ["#f3f6fa", "#9aa6b5"], flex: ["#bfe6ff", "#3c97d6"], edh: ["#e3c8ff", "#8e54d6"], played: ["#f1c9a0", "#b0703c"] };

export function emblemIcon(kind, size = 22) {
  const [a, b] = FILL[kind] || FILL.played,
    id = "ig-" + kind;
  return `<svg class="imp-ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><path d="M12 1.8l8.8 5.1v10.2L12 22.2 3.2 17.1V6.9z" fill="url(#${id})" stroke="#0008" stroke-width=".8"/>${GLYPH[kind] || ""}</svg>`;
}

// One emblem on a card tile: the strongest. Played-only cards stay quiet on tiles.
export function tileEmblem(game, card) {
  const top = importance(game, card).find((b) => b.kind !== "played");
  return top ? `<span class="imp-tile imp-${top.kind}" title="${esc(top.label)} · ${esc(top.detail)}">${emblemIcon(top.kind, 22)}</span>` : "";
}

// All emblems with what they mean, for the card sheet.
export function emblemChips(game, card) {
  const list = importance(game, card);
  if (!list.length) return "";
  return `<div class="imp-chips">${list.map((b) => `<span class="imp-chip imp-${b.kind}">${emblemIcon(b.kind, 20)}<span><b>${esc(b.label)}</b><small>${esc(b.detail)}</small></span></span>`).join("")}</div>`;
}

// Small inline emblem for list rows (deck lists, proven decks).
export function rowEmblem(game, card) {
  const top = importance(game, card)[0];
  return top && top.kind !== "played" ? `<span class="imp-row" title="${esc(top.label)} · ${esc(top.detail)}">${emblemIcon(top.kind, 16)}</span>` : "";
}

/* ---------- Ranking, trends and trade advice ---------- */

const SCORE = { core: 5, meta: 4, edh: 3, flex: 2, played: 1 };
// 0–5: how much a card matters for deck building right now (its strongest emblem).
export const impactScore = (game, card, idx) => SCORE[importance(game, card, idx)[0]?.kind] || 0;
export const hasEmblem = (game, card, idx) => impactScore(game, card, idx) >= 2;

// Daily snapshots of each game's play rates, so we can say what is rising or falling.
const TREND_KEY = "cardstashy-meta-trend-v1";
const readTrend = () => {
  try {
    return JSON.parse(localStorage.getItem(TREND_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
export function recordSnapshot(game, idx, now = Date.now(), store = null) {
  if (!idx?.size) return store;
  const all = store || readTrend(),
    list = (all[game] ||= []),
    last = list[list.length - 1];
  if (last && now - last.at < 20 * 3600e3) return all;
  const pct = {};
  for (const [k, e] of idx) if (e.pct >= 1) pct[k] = Math.round(e.pct * 10) / 10;
  list.push({ at: now, pct });
  // About two months of daily points is plenty.
  all[game] = list.filter((s) => now - s.at < 60 * 864e5).slice(-40);
  if (!store)
    try {
      localStorage.setItem(TREND_KEY, JSON.stringify(all));
    } catch {}
  return all;
}
/** Change in play rate (percentage points) against the oldest snapshot 3–45 days old; null when unknown. */
export function trendOf(game, card, idx, store = readTrend(), now = Date.now()) {
  const k = game === "ygo" ? String(card?.id) : nameKey(card?.name),
    base = (store[game] || []).find((s) => now - s.at >= 3 * 864e5 && now - s.at <= 45 * 864e5);
  if (!base) return null;
  const nowPct = idx.get(k)?.pct || 0,
    then = base.pct[k] || 0;
  if (!nowPct && !then) return null;
  return { delta: Math.round((nowPct - then) * 10) / 10, days: Math.round((now - base.at) / 864e5) };
}

/**
 * Trade advice for owned cards. items: [{ key, name, card, qty, inDecks, price }]
 *   rising  — play rate up 5+ points: hold, or trade while it's hot
 *   bait    — meta/staple cards with copies no deck uses: good trade bait
 *   falling — play rate down 5+ points and not in your decks: consider trading soon
 */
export function tradeAdvice(game, items, idx = indexFor(game), store = readTrend(), now = Date.now()) {
  const rows = items
    .filter((x) => x.card && !isBasic(x.name))
    .map((x) => ({ ...x, emb: importance(game, x.card, idx)[0] || null, trend: trendOf(game, x.card, idx, store, now), spare: Math.max(0, x.qty - (x.inDecks || 0)) }));
  const byValue = (a, b) => (SCORE[b.emb?.kind] || 0) - (SCORE[a.emb?.kind] || 0) || (b.price ?? -1) * b.spare - (a.price ?? -1) * a.spare;
  const rising = rows.filter((x) => x.trend && x.trend.delta >= 5).sort((a, b) => b.trend.delta - a.trend.delta);
  const falling = rows.filter((x) => x.trend && x.trend.delta <= -5 && x.spare).sort((a, b) => a.trend.delta - b.trend.delta);
  const used = new Set([...rising, ...falling].map((x) => x.key));
  const bait = rows.filter((x) => !used.has(x.key) && x.spare && (SCORE[x.emb?.kind] || 0) >= 2).sort(byValue);
  const tracked = (store[game] || []).length;
  return { rising: rising.slice(0, 6), bait: bait.slice(0, 6), falling: falling.slice(0, 6), trendReady: rows.some((x) => x.trend), tracked };
}

export function tradeAdviceHtml(game, adv, attrs, money) {
  const n = adv.rising.length + adv.bait.length + adv.falling.length;
  if (!n && !adv.tracked) return "";
  const item = (x, note) => `<button class="mini-row adv-row" ${attrs(x)}><span class="ellip"><span><b>${esc(x.name)}</b>${x.emb ? `<span class="imp-row" title="${esc(x.emb.label)}">${emblemIcon(x.emb.kind, 16)}</span>` : ""}</span><small>${note}</small></span><span class="small">${x.price != null ? money(x.price) : "—"}</span></button>`;
  const trendTxt = (x) => `${x.trend.delta > 0 ? "▲" : "▼"} ${Math.abs(x.trend.delta)} pts in ${x.trend.days} days`;
  const group = (title, list, note) => (list.length ? `<p class="list-head">${title}</p><div class="list compact">${list.map((x) => item(x, note(x))).join("")}</div>` : "");
  return `<details class="panel advice"><summary><b>Trade & play advice</b> <span class="muted small">${n ? `${n} card${n === 1 ? "" : "s"}` : "collecting trend data"}</span></summary>
    ${group("▲ Rising in the meta — hold, or trade while it’s hot", adv.rising, (x) => `${trendTxt(x)} · ${x.spare ? `${x.spare} spare` : "all in decks"}`)}
    ${group("⇄ Good trade bait — in demand, not in your decks", adv.bait, (x) => `${esc(x.emb?.label || "")} · ${x.spare} spare cop${x.spare === 1 ? "y" : "ies"}`)}
    ${group("▼ Cooling off — consider trading soon", adv.falling, (x) => `${trendTxt(x)} · ${x.spare} spare`)}
    <p class="foot">${adv.trendReady ? "Trends compare today’s tournament play rates with a few days ago." : `Rising and falling cards appear after a few days of tournament data (${adv.tracked} snapshot${adv.tracked === 1 ? "" : "s"} so far).`} Play rate isn’t price — check the market before trading.</p></details>`;
}

/* ---------- Decks: emblem tally and upgrades from your own cards ---------- */

/**
 * rows:   the deck — [{ key, name, card, qty }]
 * spares: cards you own that aren't in the deck — [{ key, name, card, spare }]
 * fits(card): legal for this deck; sameSlot(outCard, inCard): a sensible like-for-like swap;
 * protect(row): never suggest cutting it (lands, the commander, archetype cards…).
 * Suggests up to 3 swaps: a no-emblem card out, an owned meta/flexible/Commander staple in.
 */
export function deckEmblems(game, rows, spares, { fits = () => true, sameSlot = () => true, protect = () => false, idx = indexFor(game), max = 3 } = {}) {
  const tally = { core: 0, meta: 0, edh: 0, flex: 0, played: 0 },
    scored = rows.filter((r) => r.card).map((r) => {
      const list = importance(game, r.card, idx);
      for (const b of list) tally[b.kind] += r.qty;
      return { ...r, score: SCORE[list[0]?.kind] || 0, emb: list[0] || null };
    });
  const low = scored.filter((r) => r.score <= 1 && !isBasic(r.name) && !protect(r)).sort((a, b) => a.score - b.score || (b.card?.price ?? 0) - (a.card?.price ?? 0)),
    inDeck = new Set(rows.map((r) => r.key)),
    pool = spares
      .filter((x) => x.card && x.spare > 0 && !inDeck.has(x.key) && fits(x.card))
      .map((x) => ({ ...x, list: importance(game, x.card, idx) }))
      .filter((x) => (SCORE[x.list[0]?.kind] || 0) >= 2)
      .sort((a, b) => SCORE[b.list[0].kind] - SCORE[a.list[0].kind]);
  const swaps = [],
    used = new Set();
  for (const add of pool) {
    if (swaps.length >= max) break;
    const out = low.find((r) => !used.has(r.key) && sameSlot(r.card, add.card));
    if (!out) continue;
    used.add(out.key);
    swaps.push({ out, in: add, why: `${add.list[0].label} — ${add.list[0].detail}` });
  }
  return { tally, swaps, scored: scored.length };
}

export function deckEmblemHtml(game, res, { swapAttrs, cardAttrs }) {
  const t = res.tally,
    parts = [["core", "meta staple"], ["meta", "meta card"], ["flex", "flexible staple"], ["edh", "Commander staple"]].filter(([k]) => t[k]).map(([k, label]) => `<span class="emb-count imp-${k}">${emblemIcon(k, 16)}<b>${t[k]}</b> ${label}${t[k] === 1 ? "" : "s"}</span>`);
  if (!parts.length && !res.swaps.length) return "";
  return `<section class="panel deck-emb"><div class="emb-tally">${parts.join("") || `<span class="muted small">No meta or staple cards yet.</span>`}</div>
  ${res.swaps.length ? `<p class="list-head">Upgrade from your collection</p><div class="list compact">${res.swaps.map((s) => `<div class="mini-row emb-swap"><button class="link ellip" ${cardAttrs(s.out)}>${esc(s.out.name)}</button><span class="muted">→</span><button class="link ellip strong" ${cardAttrs(s.in)}>${emblemIcon(s.in.list[0].kind, 15)} ${esc(s.in.name)}</button><button class="btn small" ${swapAttrs(s)}>Swap</button><small class="emb-why">${esc(s.why)} · you own a spare</small></div>`).join("")}</div><p class="foot">The card going out has no meta or staple emblem. Check it isn’t part of your combo or theme before swapping.</p>` : ""}</section>`;
}

/* ---------- Card sheet "Meta" tab ---------- */

// Where a card shows up in the cached tournament data: per format, its play rate, the archetypes
// that play it and the best-placed decks that include it.
export function cardMetaUsage(game, card, cached) {
  if (!cached) {
    indexFor(game);
    cached = memo.cached;
  }
  if (!card?.name) return { sets: [], loaded: [] };
  const k = nameKey(card.name),
    id = String(card.id),
    sets = [],
    loaded = [];
  for (const [dataKey, entry] of Object.entries(cached || {})) {
    const data = entry?.data;
    if (!data?.decks?.length) continue;
    if (game === "mtg" ? !dataKey.startsWith("mtg:") : dataKey !== game) continue;
    const format = game === "mtg" ? (data.format === "EDH" ? "Commander (cEDH)" : data.format || dataKey.slice(4)) : game === "ygo" ? "Yu-Gi-Oh! tournaments" : "Pokémon Standard";
    loaded.push(format);
    const has = (d) =>
      game === "mtg" ? [...(d.main || []), ...(d.commanders || [])].some((r) => nameKey(r.name) === k)
      : game === "ygo" ? [...(d.main || []), ...(d.extra || []), ...(d.side || [])].map(String).includes(id)
      : (d.list || []).some((r) => nameKey(r.name) === k);
    const decks = data.decks.filter(has);
    if (!decks.length) continue;
    const arch = new Map();
    for (const d of decks) {
      const a = d.archetype && game !== "ptcg" ? d.archetype : d.name;
      arch.set(a, (arch.get(a) || 0) + 1);
    }
    const asCommander = game === "mtg" && decks.some((d) => (d.commanders || []).some((r) => nameKey(r.name) === k));
    sets.push({ dataKey, format: dataKey.startsWith("mtg:") ? dataKey.slice(4) : dataKey, label: format, total: data.decks.length, lists: decks.length, pct: (decks.length / data.decks.length) * 100, asCommander, archetypes: [...arch].sort((a, b) => b[1] - a[1]).slice(0, 6), decks: [...decks].sort((a, b) => (a.rank || 99) - (b.rank || 99) || String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5) });
  }
  return { sets: sets.sort((a, b) => b.pct - a.pct), loaded };
}

// The card sheet shows its Meta tab only when there is something real to explain: an emblem
// (meta staple, Commander staple, tournament played…) or a recent top list that plays the card.
export const hasCardMeta = (game, card, usage = cardMetaUsage(game, card)) => importance(game, card).length > 0 || usage.sets.length > 0;

/**
 * opts: { deckAttrs(set, deck), buildAttrs, loadAttrs, loadLabel, busy, extra }
 */
export function cardMetaTab(game, card, usage, opts) {
  // The emblems themselves already show under the card name; this tab explains where they come from.
  const chips = importance(game, card).length ? "" : `<p class="small muted">No meta or staple emblem${usage.loaded.length ? "" : " yet"}.</p>`,
    pctTxt = (p) => (p >= 10 ? Math.round(p) : p.toFixed(1)) + "%";
  const sets = usage.sets
    .map((s) => `<section class="meta-use"><h3>${esc(s.label)} <span class="muted small">in ${s.lists} of ${s.total} top lists · ${pctTxt(s.pct)}</span></h3>
      ${s.asCommander ? `<p class="small"><b>Played as a commander</b> in this data.</p>` : ""}
      <p class="small muted">${s.archetypes.length > 1 ? "Played in" : "Played by"}: ${s.archetypes.map(([a, n]) => `${esc(a)}${n > 1 ? ` <b>×${n}</b>` : ""}`).join(" · ")}</p>
      <div class="list compact">${s.decks.map((d) => `<button class="mini-row meta-use-row" ${opts.deckAttrs(s, d)}><span class="ellip"><b>${esc(d.name || d.archetype || "Deck")}</b><small>${esc([d.place, d.event, d.date].filter(Boolean).join(" · "))}</small></span><span class="small link">Open ›</span></button>`).join("")}</div></section>`)
    .join("");
  const none = usage.loaded.length
    ? `<p class="muted small">Not in recent top lists for ${esc(usage.loaded.join(", "))}. That doesn’t mean it’s bad — casual and theme decks can still want it.</p>`
    : `<p class="muted small">No tournament data on this device yet.</p>`;
  return `${chips}
    ${sets || none}
    ${opts.loadAttrs ? `<button class="btn ghost small" ${opts.loadAttrs} ${opts.busy ? "disabled" : ""}>${opts.busy ? "Loading…" : esc(opts.loadLabel || "Load tournament data")}</button>` : ""}
    <section class="meta-use"><h3>Deck ideas around this card</h3><p class="small muted">Build decks that use it, from your collection and budget.</p><div class="actions wrap"><button class="btn" ${opts.buildAttrs}>⚒ Build decks around it</button>${opts.extra || ""}</div></section>`;
}

// Share of recent top lists (0–100) that play this card, in any loaded format; 0 when unknown.
export function playRate(game, card, idx = indexFor(game)) {
  if (!card?.name || isBasic(card.name)) return 0;
  const e = idx.get(game === "ygo" ? String(card.id) : nameKey(card.name)) || (game === "ygo" ? idx.get(nameKey(card.name)) : null);
  return e?.pct || 0;
}
