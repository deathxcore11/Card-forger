import { TOPDECK_API, TOPDECK_FORMATS, WARM_FORMATS, normalizeTopdeck, topdeckBody } from "./topdeck.js";
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

// Magic tournament results from TopDeck.gg (needs the TOPDECK_KEY secret). Fresh for 12 hours;
// the last good result is kept for 30 days and served (marked stale) if TopDeck is down.
const MTG_TTL = 60 * 60 * 12,
  LAST_GOOD_TTL = 60 * 60 * 24 * 30;
const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" } });
const mtgKey = (format, days, kind = "fresh") => new Request(`https://cardforge.cache/mtg/${kind}/${encodeURIComponent(format)}/${days}`);

async function fetchMtg(env, format, days) {
  const r = await fetch(TOPDECK_API, { method: "POST", headers: { Authorization: env.TOPDECK_KEY, "Content-Type": "application/json" }, body: JSON.stringify(topdeckBody(format, days)) });
  if (!r.ok) throw Error(r.status === 401 ? "TopDeck rejected the API key" : r.status === 429 ? "TopDeck rate limit reached" : "TopDeck error " + r.status);
  return { ...normalizeTopdeck(await r.json(), { format, days }), fetchedAt: new Date().toISOString() };
}
async function mtgMeta(env, format, days, ctx, { force = false } = {}) {
  const cache = caches.default;
  if (!force) {
    const hit = await cache.match(mtgKey(format, days));
    if (hit) return hit.json();
  }
  try {
    const data = await fetchMtg(env, format, days);
    const put = (kind, ttl) => cache.put(mtgKey(format, days, kind), json(data, 200, ttl));
    const work = Promise.all([put("fresh", MTG_TTL), put("good", LAST_GOOD_TTL)]);
    if (ctx) ctx.waitUntil(work);
    else await work;
    return data;
  } catch (e) {
    const old = await cache.match(mtgKey(format, days, "good"));
    if (old) return { ...(await old.json()), stale: true, staleReason: e.message };
    throw e;
  }
}
async function mtgRoute(url, env, ctx) {
  if (!env.TOPDECK_KEY) return json({ error: "not_configured", message: "Magic tournament data needs a TopDeck.gg API key on the Worker (secret TOPDECK_KEY)." }, 503);
  const days = [7, 14, 30, 60, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
  if (url.pathname === "/api/meta/mtg/coverage") {
    const rows = [];
    for (const f of WARM_FORMATS) {
      try {
        const d = await mtgMeta(env, f, days, ctx);
        rows.push({ format: f, ...d.coverage, lists: d.decks.length, archetypes: d.archetypes.length, newest: d.events[0]?.date || "", stale: !!d.stale, fetchedAt: d.fetchedAt });
      } catch (e) {
        rows.push({ format: f, error: e.message });
      }
    }
    return json({ source: "TopDeck.gg", days, participantMin: 16, checkedAt: new Date().toISOString(), formats: rows });
  }
  const format = url.searchParams.get("format") || "";
  if (!TOPDECK_FORMATS.includes(format)) return json({ error: "unknown_format", formats: TOPDECK_FORMATS }, 400);
  try {
    return json(await mtgMeta(env, format, days, ctx), 200, 600);
  } catch (e) {
    return json({ error: "upstream", message: e.message }, 502);
  }
}

export default {
  // Daily refresh of the popular formats, so visitors rarely wait on TopDeck.
  async scheduled(event, env, ctx) {
    if (!env.TOPDECK_KEY) return;
    for (const f of WARM_FORMATS) {
      try {
        await mtgMeta(env, f, 30, null, { force: true });
      } catch {}
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/meta/mtg" || url.pathname === "/api/meta/mtg/coverage") return mtgRoute(url, env, ctx);
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
