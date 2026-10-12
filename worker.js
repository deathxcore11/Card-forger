// Cloudflare Worker: serves the static site, plus a cached image route for
// Yu-Gi-Oh! card art and Pokémon set/rarity symbols (from pokesymbols.com). Each image
// is fetched once and kept in Cloudflare's cache for 30 days instead of being hotlinked.
const MONTH = 60 * 60 * 24 * 30;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
