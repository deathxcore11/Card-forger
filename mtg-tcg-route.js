// Worker: TCGplayer prices for a Magic set, for printings Scryfall leaves unpriced (Alpha and
// Beta rares, old promos). Scryfall's set record names the TCGplayer group; tcgcsv mirrors that
// group's daily prices. GET /api/prices/mtg-tcg?set=lea → { prices: { productId: { Normal, Foil } } }
const DAY = 86400;
const HEAD = { Accept: "application/json", "User-Agent": "CardStashy/3.57 (price fallback)" };
const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) || Number(v)<=0 ? null : Math.round(Number(v) * 100) / 100);

export function compactPrices(results) {
  const out = {};
  for (const r of results || []) {
    const p = { market: num(r.marketPrice), low: num(r.lowPrice), mid: num(r.midPrice) };
    if (p.market == null && p.low == null && p.mid == null) continue;
    (out[r.productId] ||= {})[r.subTypeName || "Normal"] = p;
  }
  return out;
}

export async function mtgTcgPriceRoute(url, ctx, fetchImpl = fetch) {
  const set = String(url.searchParams.get("set") || "").toLowerCase();
  if (!/^[a-z0-9]{2,8}$/.test(set)) return Response.json({ error: "Unknown set" }, { status: 400 });
  const cache = caches.default, key = new Request(`https://cardstashy.cache/mtg-tcg/${set}`), hit = await cache.match(key);
  if (hit) return hit;
  const save = (body, status = 200, age = DAY) => {
    const res = Response.json(body, { status, headers: { "Cache-Control": `public, max-age=${age}` } });
    ctx?.waitUntil?.(cache.put(key, res.clone()));
    return res;
  };
  try {
    const s = await fetchImpl(`https://api.scryfall.com/sets/${set}`, { headers: HEAD, signal: AbortSignal.timeout(15000) });
    if (s.status === 404) return save({ set, prices: {} }, 200);
    if (!s.ok) throw Error();
    const group = (await s.json()).tcgplayer_id;
    if (!group) return save({ set, prices: {} });
    const r = await fetchImpl(`https://tcgcsv.com/tcgplayer/1/${group}/prices`, { headers: HEAD, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Error();
    return save({ set, group, at: new Date().toISOString().slice(0, 10), prices: compactPrices((await r.json()).results) });
  } catch {
    return Response.json({ set, prices: {} }, { status: 503 });
  }
}
