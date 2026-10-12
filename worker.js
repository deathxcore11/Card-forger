// Cloudflare Worker: serves the static site, plus a cached image route for
// Yu-Gi-Oh! card art and Pokémon set/rarity symbols (from pokesymbols.com). Each image
// is fetched once and kept in Cloudflare's cache for 30 days instead of being hotlinked.
const MONTH = 60 * 60 * 24 * 30;

// Yu-Gi-Oh! tournament meta from YGOPRODeck (it doesn't allow cross-site calls), cached 6 hours.
const META_TTL = 60 * 60 * 6;
async function ygoMeta(url, ctx) {
  const offset = Math.max(0, Math.min(200, parseInt(url.searchParams.get("offset") || "0", 10) || 0)),
    since = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("since") || "") ? url.searchParams.get("since") : "2024-01-01",
    src =
      url.pathname === "/api/meta/ygo/decks"
        ? `https://ygoprodeck.com/api/decks/getDecks.php?format=Tournament%20Meta%20Decks&offset=${offset}`
        : `https://ygoprodeck.com/api/top/getFormat.php?format=Tournament%20Meta%20Decks&dateStart=${since}`;
  const key = new Request("https://cardforge.cache/" + encodeURIComponent(src));
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const upstream = await fetch(src, { headers: { Accept: "application/json", "User-Agent": "Cardforge (deck helper)" } });
  if (!upstream.ok) return new Response(JSON.stringify({ error: "Meta source unavailable" }), { status: 502, headers: { "Content-Type": "application/json" } });
  const res = new Response(await upstream.text(), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${META_TTL}` } });
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/meta/ygo/decks" || url.pathname === "/api/meta/ygo/top") return ygoMeta(url, ctx);
    const m = url.pathname.match(/^\/img\/ygo\/(s\/|a\/)?(\d{1,12})\.jpg$/),
      pk = url.pathname.match(/^\/img\/pks\/(s|r)\/([a-z0-9_-]{1,80})\.png$/);
    if (!m && !pk) return env.ASSETS.fetch(request);
    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;
    let src, type;
    if (pk) {
      src = `https://pokesymbols.com/images/tcg/${pk[1] === "s" ? "sets/symbols" : "rarities"}/${pk[2]}.png`;
      type = "image/png";
    } else {
      const folder = m[1] === "s/" ? "cards_small" : m[1] === "a/" ? "cards_cropped" : "cards";
      src = `https://images.ygoprodeck.com/images/${folder}/${m[2]}.jpg`;
      type = "image/jpeg";
    }
    const upstream = await fetch(src, { cf: { cacheEverything: true, cacheTtl: MONTH } });
    if (!upstream.ok) return new Response("Image not found", { status: 404 });
    const res = new Response(upstream.body, { headers: { "Content-Type": type, "Cache-Control": `public, max-age=${MONTH}, immutable` } });
    ctx.waitUntil(cache.put(request, res.clone()));
    return res;
  },
};
