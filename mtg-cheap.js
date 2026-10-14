// Magic decks are lists of names: any paper printing of a card plays the same. A deck's cost is
// what the cheapest tournament-legal printing costs (no gold-bordered World Championship cards,
// oversized or memorabilia). Looked up per card, kept for a week on this device.
const KEY = "cardstashy-mtg-cheapest", WEEK = 7 * 864e5;
let store = null;
const load = () => {
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { store = {}; }
  return store;
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };
export const cheapestKnown = (key) => {
  const x = load()[key];
  return x && Date.now() - x.at < WEEK ? x : null;
};
export const cheapestQuery = (name) => `!"${String(name).split(" // ")[0].replace(/"/g, "")}" game:paper unique:prints usd>0 -border:gold -is:oversized -set_type:memorabilia`;
// names: card names; api: the app's rate-limited Scryfall fetch; key: the app's card key.
export async function refreshCheapest(names, { api, key, progress = () => {}, limit = 60 } = {}) {
  const want = [...new Set(names)].filter((n) => !cheapestKnown(key(n))).slice(0, limit);
  let i = 0;
  for (const n of want) {
    progress(`Checking cheapest printings ${++i}/${want.length}…`);
    try {
      const r = await api("/cards/search?" + new URLSearchParams({ q: cheapestQuery(n), order: "usd", dir: "asc" })),
        c = r.data?.[0], usd = Number(c?.prices?.usd);
      load()[key(n)] = Number.isFinite(usd) && usd > 0 ? { usd, set: c.set, cn: c.collector_number, at: Date.now() } : { usd: null, at: Date.now() };
    } catch {
      load()[key(n)] = { usd: null, at: Date.now() - WEEK + 864e5 };
    }
  }
  if (want.length) save();
  return want.length;
}
