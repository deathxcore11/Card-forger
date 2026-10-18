export {DailyCards} from './daily-card-route.js';
import {dailyCardRoute} from './daily-card-route.js';
export {ConditionPriceCache} from './condition-cache.js';
import {conditionFeedRoute} from './condition-feed-route.js';
import {communityFeedRoute} from './community-feed-route.js';
import { aiReviewRoute } from './ai-review-route.js';
import { aiAskRoute } from './ai-ask-route.js';
import { scanIdentifyRoute } from './scan-identify-route.js';
export { AiReviewLimits } from './ai-review-route.js';
import {recentHistoryRoute} from './recent-history.js';
import {ygoSetPriceRoute} from './ygo-set-prices.js';
import {ygoPriceRoute} from './ygo-prices.js';
import {archivePriceRoute} from "./historical-archive.js";
import {pokemonPriceRoute} from "./pokemon-prices.js";
import {mtgTcgPriceRoute} from "./mtg-tcg-route.js";
import {pokemonArtRoute, tcgplayerSetsRoute} from "./pokemon-art.js";
import {magicSetArtwork} from "./set-art.js";
import { watchRoute, historyRoute, recordDailyPrices } from "./pricefeed.js";
import { TOPDECK_API, TOPDECK_FORMATS, WARM_FORMATS, normalizeTopdeck, topdeckBody } from "./topdeck.js";
import { MTGO_SLUGS, MTGO_INDEX, mtgoEventSlugs, parseMtgoEvent, normalizeMtgo, EDHTOP16_API, edhtop16Query, normalizeEdhtop16 } from "./mtgmeta.js";
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
  const upstream = await fetch(src, { headers: { Accept: "application/json", "User-Agent": "CardStashy (deck helper)" } });
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

const UA = { "User-Agent": "CardStashy deck helper (cached, a few requests a day)" };
// Keyless sources first: Magic Online's official decklists, EDHTop16 for Commander.
async function fetchMtgo(format, days) {
  const idx = await fetch(MTGO_INDEX, { headers: UA });
  if (!idx.ok) throw Error("Magic Online decklists unavailable (" + idx.status + ")");
  const slugs = mtgoEventSlugs(await idx.text(), format, { days });
  if (!slugs.length) throw Error("No recent Magic Online events for " + format);
  const pages = await Promise.all(slugs.map((x) => fetch("https://www.mtgo.com/decklist/" + x.slug, { headers: UA }).then((r) => (r.ok ? r.text() : "")).then(parseMtgoEvent).catch(() => null)));
  return { ...normalizeMtgo(pages.filter(Boolean), { format, days }), fetchedAt: new Date().toISOString() };
}
async function fetchEdhtop16() {
  const r = await fetch(EDHTOP16_API, { method: "POST", headers: { ...UA, "Content-Type": "application/json" }, body: JSON.stringify(edhtop16Query()) });
  if (!r.ok) throw Error("EDHTop16 unavailable (" + r.status + ")");
  return { ...normalizeEdhtop16(await r.json()), fetchedAt: new Date().toISOString() };
}
async function fetchMtg(env, format, days) {
  if (format === "EDH") {
    try {
      return await fetchEdhtop16();
    } catch (e) {
      if (!env.TOPDECK_KEY) throw e;
    }
  } else if (MTGO_SLUGS[format]) {
    try {
      return await fetchMtgo(format, Math.min(days, 14));
    } catch (e) {
      if (!env.TOPDECK_KEY) throw e;
    }
  }
  if (!env.TOPDECK_KEY) throw Object.assign(Error("This format needs a TopDeck.gg API key on the Worker (secret TOPDECK_KEY)."), { notConfigured: true });
  return fetchTopdeck(env, format, days);
}
async function fetchTopdeck(env, format, days) {
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
  const days = [7, 14, 30, 60, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
  if (url.pathname === "/api/meta/mtg/coverage") {
    if (!env.TOPDECK_KEY) return json({ error: "not_configured", message: "The TopDeck.gg coverage report needs the TOPDECK_KEY secret. Magic Online and EDHTop16 data work without it." }, 503);
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
  if (!TOPDECK_FORMATS.includes(format) && !MTGO_SLUGS[format]) return json({ error: "unknown_format", formats: [...new Set([...Object.keys(MTGO_SLUGS), ...TOPDECK_FORMATS])] }, 400);
  try {
    return json(await mtgMeta(env, format, days, ctx), 200, 600);
  } catch (e) {
    return e.notConfigured ? json({ error: "not_configured", message: e.message }, 503) : json({ error: "upstream", message: e.message }, 502);
  }
}

// Google Lens refuses uploads posted from another website (it checks Origin), so the scanner's
// "Search with Google Lens" sends the picture here; the Worker uploads it and returns the results link.
export async function lensUpload(request, url, fetchImpl = fetch) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (request.method !== "POST") return json({ error: "POST a picture." }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return json({ error: "Not allowed." }, 403);
  const type = request.headers.get("Content-Type") || "";
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return json({ error: "Send a JPEG, PNG or WebP picture." }, 415);
  const img = await request.arrayBuffer();
  if (!img.byteLength || img.byteLength > 6 * 1024 * 1024) return json({ error: "Picture too large." }, 413);
  const form = new FormData();
  form.append("encoded_image", new File([img], "card." + type.split("/")[1], { type }));
  const up = await fetchImpl("https://lens.google.com/v3/upload?hl=en", { method: "POST", body: form, redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36" } }).catch(() => null);
  const loc = up?.headers.get("Location") || "";
  if (!up || up.status < 300 || up.status > 399 || !/^https:\/\/(www\.)?google\.[a-z.]+\//.test(loc)) return json({ error: "Google Lens didn’t answer." }, 502);
  return json({ url: loc });
}

// Android app (a Trusted Web Activity built with PWABuilder or Bubblewrap): Android shows this
// site full-screen inside the app only when this file names the app and its signing key. Add the
// package name and the SHA-256 fingerprint(s) from the packaging step; empty means no app yet.
export const ANDROID_APPS = [
  { package: "dev.workers.deathxcore11.cardforge2.twa", sha256: ["89:18:F5:EC:D8:0C:08:48:7D:D0:84:9E:A7:84:BF:2A:02:07:0F:5E:D0:B0:AD:82:D3:83:CF:42:2F:60:5D:65"] },
];
export function assetLinks(apps = ANDROID_APPS) {
  if (!apps.length) return new Response("No Android app registered yet.", { status: 404 });
  const body = apps.map((a) => ({ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: a.package, sha256_cert_fingerprints: a.sha256 } }));
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
}

export const PRICE_CRON = "41 7 * * *";

export default {
  // Daily refresh of the popular formats, so visitors rarely wait on TopDeck.
  async scheduled(event, env, ctx) {
    // Separate trigger for shared price history (each run has its own request budget).
    if (event?.cron === PRICE_CRON) {
      try {
        await recordDailyPrices(env);
      } catch {}
      return;
    }
    for (const f of WARM_FORMATS) {
      try {
        await mtgMeta(env, f, 30, null, { force: true });
      } catch {}
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/daily-card') return dailyCardRoute(request, env);
    if (url.pathname === '/api/community') return communityFeedRoute(request, url, ctx);
    if (url.pathname === "/api/ai/deck-review") return aiReviewRoute(request, env);
    if (url.pathname === "/api/ai/ask") return aiAskRoute(request, env);
    if (url.pathname === "/api/ai/identify-card") return scanIdentifyRoute(request, env);
    const setImage=url.pathname.match(/^\/img\/mtg-set\/([a-z0-9]{2,8})\.jpg$/i);
    if(setImage){
      const hit=await caches.default.match(request);if(hit)return hit;
      try{const art=await magicSetArtwork(setImage[1]);if(!art)return new Response('No product artwork',{status:404,headers:{'Cache-Control':'public, max-age=3600'}});
        const upstream=await fetch(art.url,{signal:AbortSignal.timeout(15000)});if(!upstream.ok)return new Response('Product artwork unavailable',{status:404});
        const res=new Response(upstream.body,{headers:{'Content-Type':upstream.headers.get('Content-Type')||'image/jpeg','Cache-Control':`public, max-age=${MONTH}`,'X-Art-Source':'MTGJSON / TCGplayer'}});ctx.waitUntil(caches.default.put(request,res.clone()));return res;
      }catch{return new Response('Product artwork unavailable',{status:503});}
    }
    if (url.pathname.startsWith("/img/ptcg/")) return pokemonArtRoute(request, url, ctx);
    if (url.pathname === "/api/tcgplayer/sets") return tcgplayerSetsRoute(url, ctx);
    if (url.pathname === "/.well-known/assetlinks.json") return assetLinks();
    if (url.pathname === "/api/lens") return lensUpload(request, url);
    if (url.pathname === "/api/prices/recent") return recentHistoryRoute(url,ctx);
    if (url.pathname === "/api/prices/archive") return archivePriceRoute(url,ctx);
    if (url.pathname === "/api/prices/conditions") return conditionFeedRoute(url,env,ctx,fetch,{request});
    if (url.pathname === "/api/prices/yugioh-set") return ygoSetPriceRoute(url,ctx);
    if (url.pathname === "/api/prices/yugioh") return ygoPriceRoute(url,ctx);
    if (url.pathname === "/api/prices/pokemon") return pokemonPriceRoute(url,ctx);
    if (url.pathname === "/api/prices/mtg-tcg") return mtgTcgPriceRoute(url,ctx);
    if (url.pathname === "/api/prices/watch") return watchRoute(request, env);
    if (url.pathname === "/api/prices/history") return historyRoute(url, env, ctx);
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
