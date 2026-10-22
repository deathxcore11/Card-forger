import { scanNamesFor } from "./scan.js";
import { parseCollectorQuery } from "./collector-search.js";
export function searchQuery(
  name,
  { color = "", cardColor = "", type = "", format = "", maxPrice = "", rarity = "", mv = "", set = "" } = {},
) {
  const error = magicFilterError({ set, maxPrice, mv });
  if (error) throw Error(error);
  const parts = ["game:paper"];
  if (name.trim()) parts.push(name.trim());
  if (color) parts.push("id<=" + color);
  // Card color (what's printed), separate from Commander color identity above.
  if (cardColor) parts.push(cardColor === "M" ? "c:m" : cardColor === "C" ? "c:c" : "c:" + cardColor.toLowerCase());
  if (type) parts.push(...String(type).trim().split(/\s+/).map((part) => "t:" + part));
  if (format) parts.push("legal:" + format);
  if (rarity) parts.push("r:" + rarity);
  if (mv !== "" && /^\d+\+?$/.test(mv)) parts.push(mv.endsWith("+") ? "mv>=" + parseInt(mv, 10) : "mv=" + mv);
  if (/^[a-z0-9]{2,6}$/i.test(set.trim())) parts.push("s:" + set.trim().toLowerCase());
  if (
    maxPrice !== "" &&
    Number.isFinite(Number(maxPrice)) &&
    Number(maxPrice) >= 0
  )
    parts.push("usd<=" + Number(maxPrice));
  return parts.join(" ");
}
// Validate before submitting: a visible constraint must never silently disappear.
export function magicFilterError({ set = "", maxPrice = "", mv = "" } = {}) {
  if (String(set).trim() && !/^[a-z0-9]{2,6}$/i.test(String(set).trim())) return "Enter a set code with 2–6 letters or numbers (for example FDN), or remove the Set filter.";
  if (String(maxPrice).trim() && (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0)) return "Enter a maximum price of 0 or more, or remove the price filter.";
  if (String(mv).trim() && !/^\d+\+?$/.test(String(mv))) return "Choose a valid mana value, or remove the mana value filter.";
  return "";
}
export function hasMagicSearchQuery(term, filters = {}) {
  return !!(String(term || "").trim() || ["color", "cardColor", "type", "rarity", "mv", "set", "format", "maxPrice"].some(k => String(filters[k] ?? "").trim()));
}
export function magicSearchSpec(term, filters = {}) {
  const frozen = Object.freeze(Object.fromEntries(["color", "cardColor", "type", "format", "maxPrice", "rarity", "mv", "set", "sort", "own", "fits"].map(k => [k, String(filters[k] ?? "").trim()])));
  const typed = String(term || "").trim();
  // A set code and collector number ("0323 trk", "trk 323") finds that exact printing.
  const collector = parseCollectorQuery("mtg", typed);
  term = collector ? `e:${collector.set} cn:${collector.number}` : typed;
  const query = searchQuery(term, frozen);
  if (!hasMagicSearchQuery(term, frozen)) throw Error("Type a card name or pick a filter.");
  const syntax = /[:<>=]/.test(term), order = frozen.sort === "usdAsc" ? "usd" : frozen.sort || (syntax ? "edhrec" : "name");
  return Object.freeze({ term, typed, collector, filters: frozen, query, syntax, order, dir: frozen.sort === "usdAsc" ? "asc" : ["usd", "released", "rarity"].includes(order) ? "desc" : "auto" });
}
// Continuations are provider paths, not arbitrary URLs. Reject cycles in the caller.
export function scryfallSearchPath(cursor) {
  const url = new URL(cursor, "https://api.scryfall.com");
  if (url.origin !== "https://api.scryfall.com" || url.pathname !== "/cards/search" || url.username || url.password) throw Error("Unexpected card database continuation link.");
  return url.pathname + url.search;
}
// The printing browser is independent of Search and always scoped to one oracle identity.
export async function loadMagicPrintingPage(card, { cursor = null, signal, request } = {}) {
  if (!card?.oracle_id) throw Error("This card has no verified Magic identity. Reopen its card details and try again.");
  const path = cursor ? scryfallSearchPath(cursor) : "/cards/search?" + new URLSearchParams({ q: "oracleid:" + card.oracle_id + " game:paper", unique: "prints", order: "released", dir: "desc" });
  if (signal?.aborted) throw Error("Printing lookup cancelled.");
  const result = await request(path, { signal });
  if (signal?.aborted) throw Error("Printing lookup cancelled.");
  if (!Array.isArray(result?.data)) throw Error("The card database returned incomplete printings. Try again.");
  if (result.has_more && !result.next_page) throw Error("The card database did not return the next printing page. Try again.");
  // /cards/search supplies full Scryfall card objects, not brief name-only rows.
  const cards = mergeMagicCards([], result.data.filter(p => p?.id && p.oracle_id === card.oracle_id && (!Array.isArray(p.games) || p.games.includes("paper"))).map(p => ({...p, full:true})), { printings: true });
  const nextCursor = result.has_more ? scryfallSearchPath(result.next_page) : null;
  if (nextCursor && nextCursor === path) throw Error("The card database repeated a printing page. Try again.");
  return { cards, nextCursor, complete: !nextCursor, total: Number(result.total_cards) || null, note: cards.length !== result.data.length ? "Only verified paper printings of this exact card are shown." : "" };
}
export function mergeMagicCards(previous, incoming, { printings = false } = {}) {
  const seen = new Set();
  return [...previous, ...incoming].filter(card => {
    const id = printings ? card?.id : card?.oracle_id || card?.id || String(card?.name || "").toLowerCase();
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  });
}
const searchFocusKey = el => {
  if (!el) return "";
  if (el.id) return "id:" + el.id;
  if (el.tagName === "SUMMARY") return "summary:" + (el.parentElement?.id || "");
  const d = el.dataset || {};
  return JSON.stringify([el.tagName, d.input || "", d.change || "", d.act || "", d.field || "", d.q || "", d.i || "", d.name || "", d.id || "", d.game || "", d.setId || "", d.tab || "", d.to || ""]);
};
// Keep a draft and selection intact when an asynchronous result redraws Search.
export function captureSearchFocus(root, active = globalThis.document?.activeElement) {
  if (!active || !root?.contains?.(active)) return null;
  return { key: searchFocusKey(active), value: /^(INPUT|TEXTAREA)$/.test(active.tagName) ? active.value : undefined, start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection,
    suggestFocus: active.dataset?.suggest ? { input: active, game: active.dataset.suggest, value: active.value } : null };
}
export function restoreSearchFocus(root, state) {
  if (!state) return;
  const el = [...(root?.querySelectorAll?.("input,select,button,summary,textarea") || [])].find(node => searchFocusKey(node) === state.key);
  if (!el || el.disabled) return;
  if (state.value !== undefined) el.value = state.value;
  // Restoring the same field is not a new request for suggestions. The marker
  // exists only during focus dispatch; user focus and typing remain ordinary.
  const previous = el.suggestFocusRestore;
  el.suggestFocusRestore = searchFocusKey(state.suggestFocus?.input) === state.key ? state.suggestFocus : null;
  try { el.focus?.({ preventScroll: true }); }
  finally { if (previous === undefined) delete el.suggestFocusRestore; else el.suggestFocusRestore = previous; }
  if (Number.isInteger(state.start)) try { el.setSelectionRange(state.start, state.end, state.direction); } catch {}
}

// Best name matches first: exact name, then names starting with the words, then names with a word
// starting with them, then everything else in the order the source gave (stable).
export function rankByName(list, term, nameOf = (c) => c.name) {
  const k = (x) => String(x || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(),
    t = k(term);
  if (!t || /[:<>=]/.test(term)) return list;
  const score = (c) => {
    const n = k(nameOf(c));
    if (n === t || k(String(nameOf(c)).split(" // ")[0]) === t) return 0;
    if (n.startsWith(t + " ") || n.startsWith(t)) return 1;
    if ((" " + n).includes(" " + t)) return 2;
    return 3;
  };
  return list.map((c, i) => [score(c), i, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}
export const scanNames = (text) => scanNamesFor("mtg", text);
export function cardLinks(card) {
  const name = encodeURIComponent(card.name);
  return [
    {
      label: "Scryfall · cards & printings",
      url: card.scryfall_uri || "https://scryfall.com/search?q=" + name,
    },
    {
      label: "Gatherer · official database",
      url:
        "https://gatherer.wizards.com/Pages/Search/Default.aspx?name=" +
        encodeURIComponent("+[" + card.name + "]"),
    },
    {
      label: "MTG Wiki · research",
      url: "https://mtg.wiki/page/Special:Search?search=" + name,
    },
    {
      label: "TCGplayer · seller listings",
      url:
        "https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=" +
        name,
    },
    {
      label: "Card Kingdom · seller listings",
      url:
        "https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=" +
        name,
    },
    {
      label: "EDHREC · Commander usage",
      url: "https://edhrec.com/route/?cc=" + name,
    },
  ];
}
