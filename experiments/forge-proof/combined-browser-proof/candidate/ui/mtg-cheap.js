// Name-based deck estimates may use an equivalent paper printing. These are
// lowest verified quotes among checked Scryfall results, not a global market low.
import { cardKey } from "./core.js";
const KEY = "cardstashy-mtg-cheapest", WEEK = 7 * 864e5;
let store = null;
const load = () => {
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { store = {}; }
  return store;
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };
const knownPrice = value => value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "") && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const legal = (c, format) => format ? ["legal", "restricted"].includes(c?.legalities?.[format]) : Object.values(c?.legalities || {}).some(s => ["legal", "restricted"].includes(s));
export const cheapestKnown = (key, { format = "" } = {}) => {
  const x = load()[key];
  // Old first-row cache entries have no eligibility evidence. Recheck rather
  // than treating that legacy price as a verified equivalent printing.
  return x?.verified === true && Date.now() - x.at < WEEK && (!format || x.usd === null || legal(x, format)) ? x : null;
};
export const cheapestQuery = (name) => `!"${String(name).split(" // ")[0].replace(/"/g, "")}" game:paper unique:prints usd>=0 -border:gold -border:silver -is:oversized -set_type:memorabilia`;
export function eligiblePrinting(c, name, { reference = null, format = "", basicOnly = false } = {}) {
  return !!c && cardKey(c.name) === cardKey(name) && (!reference?.oracle_id || c.oracle_id === reference.oracle_id) &&
    Array.isArray(c.games) && c.games.includes("paper") && c.digital !== true && c.oversized !== true &&
    !["art_series", "token", "double_faced_token", "emblem", "planar", "scheme", "vanguard"].includes(c.layout) &&
    !["gold", "silver"].includes(c.border_color) && c.set_type !== "memorabilia" && c.acorn !== true && c.security_stamp !== "acorn" &&
    (!basicOnly || /^Basic\b/.test(c.type_line || "")) && legal(c, format);
}
export function lowestEligiblePrinting(cards, name, options = {}) {
  return (cards || []).filter(c => eligiblePrinting(c, name, options) && knownPrice(c.prices?.usd) !== null)
    .sort((a, b) => knownPrice(a.prices.usd) - knownPrice(b.prices.usd) || String(a.id || "").localeCompare(String(b.id || "")))[0] || null;
}
// One bounded page, then independent local eligibility and numeric ordering.
// Provider ordering or image preference is never evidence that its first row wins.
export async function findCheapestPrinting(name, { api, key = cardKey, reference = null, format = "", basicOnly = false } = {}) {
  const q = `${cheapestQuery(name)}${format ? ` legal:${format}` : ""}${basicOnly ? " t:basic" : ""}`;
  const result = await api("/cards/search?" + new URLSearchParams({ q, order: "usd", dir: "asc" }));
  const checked = result?.data || [], card = lowestEligiblePrinting(checked, name, { reference, format, basicOnly });
  const coverage = { provider: "Scryfall", pages: 1, checked: checked.length, hasMore: result?.has_more === true, marketComplete: false };
  const quote = { usd: card ? knownPrice(card.prices.usd) : null, verified: true, at: Date.now(), coverage,
    ...(card ? { id: card.id, oracle_id: card.oracle_id, set: card.set, setName: card.set_name, cn: card.collector_number, legalities: card.legalities } : {}) };
  load()[key(name)] = quote;
  save();
  return { card, quote, coverage, checkedPrintings:checked };
}
// names: card names; api: the app's rate-limited Scryfall fetch; key: the app's card key.
export async function refreshCheapest(names, { api, key = cardKey, progress = () => {}, limit = 60, format = "", reference = () => null } = {}) {
  const want = [...new Set(names)].filter(n => !cheapestKnown(key(n), { format })).slice(0, limit);
  let i = 0;
  for (const n of want) {
    progress(`Checking eligible printing quotes ${++i}/${want.length}…`);
    try { await findCheapestPrinting(n, { api, key, format, reference: reference(n) }); }
    catch { load()[key(n)] = { usd: null, verified: true, at: Date.now() - WEEK + 864e5, coverage: { provider: "Scryfall", pages: 0, checked: 0, marketComplete: false, unavailable: true } }; }
  }
  if (want.length) save();
  return want.length;
}
