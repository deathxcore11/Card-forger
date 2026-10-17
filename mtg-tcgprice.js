import {referenceQuote} from './price-reference.js';
// TCGplayer prices for Magic printings Scryfall leaves unpriced (Alpha/Beta rares, old promos).
// Fetched per set through the Worker (/api/prices/mtg-tcg), kept for a day on the device, and only
// ever used where Scryfall has no USD price for that finish; the UI labels them as TCGplayer's.
const KEY = "cf-mtg-tcg-v1", TTL = 86400000, MAX_SETS = 40;
let sets = null;
const pending = new Set(), failed = new Map(); // set → time of a failed fetch, retried after 10 minutes

function store() {
  if (sets) { for(const [k,v] of sets)if(!Number.isFinite(v.t)||Date.now()-v.t>=TTL)sets.delete(k);return sets; }
  sets = new Map();
  try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(KEY) || "{}"))) if (Date.now() - v.t < TTL) sets.set(k, v); } catch {}
  return sets;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries([...store()].sort((a, b) => b[1].t - a[1].t).slice(0, MAX_SETS)))); } catch {}
}
// Load one set's prices from a Worker response (also used by tests).
export function setTcgPrices(code, prices) { store().set(code, { t: Date.now(), prices: prices || {} }); }

// The TCGplayer product for this printing: Scryfall's id, or the one in its TCGplayer link.
export function productIdOf(c, finish = "nonfoil") {
  if (finish === "etched" && c?.tcgplayer_etched_id) return Number(c.tcgplayer_etched_id);
  if (c?.tcgplayer_id) return Number(c.tcgplayer_id);
  let u = String(c?.purchase_uris?.tcgplayer || "");
  try { u = decodeURIComponent(u); } catch {}
  return Number(u.match(/\/product\/(\d+)/)?.[1]) || null;
}
// { value, kind: "market" | "mid" | "low" } or null.
export function tcgFallback(c, finish = "nonfoil") {
  // Only finishes this printing comes in (no "etched" Alpha card).
  if (Array.isArray(c?.finishes) && !c.finishes.includes(finish)) return null;
  if (finish === "etched" && !c?.tcgplayer_etched_id) return null;
  const s = c?.set && store().get(c.set), p = s?.prices[productIdOf(c, finish)];
  if (!p) return null;
  const sub = finish === "nonfoil" ? p.Normal : p.Foil || (finish === "etched" ? p.Normal : null);
  return sub ? referenceQuote(sub) : null;
}
// A printing needs its set's TCGplayer prices when any finish it comes in (Scryfall's `finishes`)
// has no Scryfall USD price: a card priced only as a regular printing still needs its foil.
const FIELD = { nonfoil: "usd", foil: "usd_foil", etched: "usd_etched" };
export const needsTcgPrices = (c) => !!c?.set && (Array.isArray(c.finishes) && c.finishes.length ? c.finishes : ["nonfoil"]).some((f) => FIELD[f] && !(Number(c.prices?.[FIELD[f]]) > 0) && productIdOf(c, f) && (f !== "etched" || c.tcgplayer_etched_id));

// Fetch the sets of any unpriced printings among `cards`; fires "cf:tcg-prices" when new prices land.
export async function ensureTcgPrices(cards, { retry = false } = {}) {
  if (typeof fetch !== "function" || typeof location === "undefined") return;
  const codes = [...new Set((cards || []).filter(needsTcgPrices).map((c) => c.set))].filter((code) => !store().has(code) && !pending.has(code) && (retry || !(Date.now() - (failed.get(code) || 0) < 600000))).slice(0, 8);
  if (!codes.length) return;
  codes.forEach((code) => pending.add(code));
  let got = false;
  await Promise.all(codes.map(async (code) => {
    try {
      const r = await fetch("/api/prices/mtg-tcg?set=" + encodeURIComponent(code));
      if (r.ok) { setTcgPrices(code, (await r.json()).prices); got = true; } else failed.set(code, Date.now());
    } catch { failed.set(code, Date.now()); } finally { pending.delete(code); }
  }));
  if (got) { persist(); globalThis.dispatchEvent?.(new Event("cf:tcg-prices")); }
}

// The player's own prices (long-press a price), kept in their saved data and shown only to them.
// Used only where no store prices the printing at all.
let mine = {};
export const useMyPrices = (map) => { mine = map || {}; };
export const myPriceKey = (c, finish = "nonfoil") => (c?.id || c?.name || "") + ":" + finish;
export const myPrice = (c, finish = "nonfoil") => { const v = mine[myPriceKey(c, finish)]?.price; return v == null ? null : Number(v); };
