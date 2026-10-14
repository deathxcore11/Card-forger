// Last-resort Pokémon card art: the TCGplayer product image for the exact card, for printings
// TCGdex has no scan of (promos, McDonald's sets, Shiny Vault, gallery subsets…). The card's own
// TCGplayer product id comes from TCGdex; without one, the product is matched in the set's
// TCGplayer group by name and collector number. Never another printing's image.
const MONTH = 60 * 60 * 24 * 30;
// Words of a set name, singular ("Energies" and "Energy" match), "HS" read as HGSS.
const words = (s) => (String(s || "").toLowerCase().replace(/\bhs\b/g, "hgss").replace(/pok[eé]mon/g, "").match(/[a-z0-9]+/g) || []).map((w) => (w.length > 4 ? w.replace(/ies$/, "y").replace(/s$/, "") : w));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const numKey = (s) => {
  const first = String(s || "").split("/")[0].trim().toUpperCase();
  return /^\d+$/.test(first) ? String(Number(first)) : first.replace(/^([A-Z]+)0+(\d)/, "$1$2");
};

// The set's TCGplayer group: every word of the TCGdex set name appears in the group name.
// TCGdex and TCGplayer name the promo sets differently.
const ALIAS = { "xy black star promos": "XY Promos", "bw black star promos": "Black and White Promos", "dp black star promos": "Diamond and Pearl Promos", "hgss black star promos": "HGSS Promos", "sm black star promos": "SM Promos", "wizards black star promos": "WoTC Promo", "nintendo black star promos": "Nintendo Promos" };
export function pickGroup(groups, setName) {
  setName = ALIAS[String(setName || "").toLowerCase()] || setName;
  const want = words(setName).filter((w) => !["trainer", "kit", "collection", "set"].includes(w) || words(setName).length < 3);
  if (!want.length) return null;
  const hits = (groups || []).filter((g) => { const have = new Set(words(g.name)); return want.every((w) => have.has(w)); });
  return hits.sort((a, b) => a.name.length - b.name.length)[0] || null;
}

// The card in the group's products: same collector number, and a name that starts with the card's.
export function pickProduct(products, card) {
  const n = numKey(card.localId), name = norm(card.name);
  return (products || []).find((p) => {
    const num = (p.extendedData || []).find((x) => x.name === "Number")?.value;
    return num && numKey(num) === n && norm(p.name).startsWith(name);
  }) || null;
}

export async function pokemonProductId(id, get) {
  const card = await get("https://api.tcgdex.net/v2/en/cards/" + encodeURIComponent(id));
  if (card?.id !== id) return null;
  const direct = (card.variants_detailed || []).map((v) => Number(v.thirdParty?.tcgplayer)).find(Boolean);
  if (direct) return direct;
  const groups = await get("https://tcgcsv.com/tcgplayer/3/groups");
  const group = pickGroup(groups?.results, card.set?.name);
  if (!group) return null;
  const products = await get(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/products`);
  return pickProduct(products?.results, card)?.productId || null;
}

// GET /img/ptcg/(s|l)/<card id>.jpg — small for grids, large for the card page and zoom.
export async function pokemonArtRoute(request, url, ctx, fetchImpl = fetch) {
  const m = url.pathname.match(/^\/img\/ptcg\/(s|l)\/(.{1,120})\.jpg$/);
  let id = "";
  try { id = decodeURIComponent(m?.[2] || ""); } catch {}
  if (!m || !/^[A-Za-z0-9.!?_-]{1,80}$/.test(id)) return new Response("Invalid card", { status: 400 });
  const cache = caches.default, hit = await cache.match(request);
  if (hit) return hit;
  const get = async (u) => {
    const saved = await cache.match(u);
    if (saved) return saved.json();
    const r = await fetchImpl(u, { headers: { Accept: "application/json", "User-Agent": "CardStashy/3.50 (card art fallback)" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const body = await r.json();
    ctx?.waitUntil?.(cache.put(u, new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } })));
    return body;
  };
  try {
    const pid = await pokemonProductId(id, get);
    const miss = () => { const r = new Response("No artwork", { status: 404, headers: { "Cache-Control": "public, max-age=86400" } }); ctx?.waitUntil?.(cache.put(request, r.clone())); return r; };
    if (!pid) return miss();
    const upstream = await fetchImpl(`https://tcgplayer-cdn.tcgplayer.com/product/${pid}_${m[1] === "s" ? "400w" : "in_1000x1000"}.jpg`, { signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) return miss();
    const res = new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg", "Cache-Control": `public, max-age=${MONTH}`, "X-Art-Source": "TCGplayer" } });
    ctx?.waitUntil?.(cache.put(request, res.clone()));
    return res;
  } catch {
    return new Response("Artwork unavailable", { status: 503 });
  }
}

// TCGplayer's own set codes ("SSP", "PAL"…) for a game, for Mass Entry lines. Cached for a day.
export async function tcgplayerSetsRoute(url, ctx, fetchImpl = fetch) {
  const cat = { ptcg: 3, ygo: 2, mtg: 1 }[url.searchParams.get("game")];
  if (!cat) return Response.json({ error: "Unknown game" }, { status: 400 });
  const cache = caches.default, hit = await cache.match(url.href);
  if (hit) return hit;
  try {
    const r = await fetchImpl(`https://tcgcsv.com/tcgplayer/${cat}/groups`, { headers: { Accept: "application/json", "User-Agent": "CardStashy/3.54 (mass entry set codes)" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Error();
    const sets = ((await r.json()).results || []).filter((g) => g.abbreviation).map((g) => ({ name: g.name, code: g.abbreviation }));
    const res = Response.json({ sets }, { headers: { "Cache-Control": "public, max-age=86400" } });
    ctx?.waitUntil?.(cache.put(url.href, res.clone()));
    return res;
  } catch {
    return Response.json({ sets: [] }, { status: 503 });
  }
}
