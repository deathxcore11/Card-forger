// Cloudflare Worker: serves the static site, plus a cached image route for
// Yu-Gi-Oh! card art. YGOPRODeck asks apps not to hotlink its images, so each
// image is fetched once and kept in Cloudflare's cache for 30 days.
const MONTH = 60 * 60 * 24 * 30;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/img\/ygo\/(s\/)?(\d{1,12})\.jpg$/);
    if (!m) return env.ASSETS.fetch(request);
    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;
    const src = `https://images.ygoprodeck.com/images/cards${m[1] ? "_small" : ""}/${m[2]}.jpg`;
    const upstream = await fetch(src, { cf: { cacheEverything: true, cacheTtl: MONTH } });
    if (!upstream.ok) return new Response("Image not found", { status: 404 });
    const res = new Response(upstream.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": `public, max-age=${MONTH}, immutable` } });
    ctx.waitUntil(cache.put(request, res.clone()));
    return res;
  },
};
