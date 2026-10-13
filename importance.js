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
const indexFor = (game) => {
  const v = metaVersion();
  if (memo.v !== v) memo = { v, idx: {}, cached: allCachedMeta() };
  return (memo.idx[game] ||= buildIndex(game, memo.cached));
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
