// Server side of shared price history (runs in the Cloudflare Worker).
//   POST /api/prices/watch    { game, ids: [...] }   → adds cards to the daily recording list
//   GET  /api/prices/history?game=&id=&finish=&source= → [{ date, value }] for the chart
//   daily cron                                        → records today's price for watched cards
// Needs the SUPABASE_SERVICE_KEY secret (Supabase → Project Settings → API keys → secret key).
// Without it, history reads still work and recording is skipped.
import { SUPABASE } from "./config.js";

const GAMES = new Set(["mtg", "ygo", "ptcg"]);
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;
export const MTG_SOURCE = "Scryfall / TCGplayer",
  YGO_SOURCE = "TCGplayer reference";

const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" } });

function rest(env, path, init = {}, { service = false } = {}) {
  const url = (env.SUPABASE_URL || SUPABASE.url) + "/rest/v1/" + path,
    key = service ? env.SUPABASE_SERVICE_KEY : env.SUPABASE_SERVICE_KEY || SUPABASE.key,
    headers = { apikey: key, "Content-Type": "application/json", ...(init.headers || {}) };
  // Legacy JWT keys also go in Authorization; new sb_secret_/sb_publishable_ keys don't.
  if (/^eyJ/.test(key || "")) headers.Authorization = "Bearer " + key;
  return fetch(url, { ...init, headers });
}

export async function watchRoute(request, env) {
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env.SUPABASE_SERVICE_KEY) return json({ error: "not_configured" }, 200);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const game = String(body?.game || ""),
    ids = [...new Set((Array.isArray(body?.ids) ? body.ids : []).map(String).filter((x) => ID.test(x)))].slice(0, 300);
  if (!GAMES.has(game) || !ids.length) return json({ error: "bad_request" }, 400);
  const today = new Date().toISOString().slice(0, 10),
    r = await rest(env, "price_watch?on_conflict=game,card_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(ids.map((card_id) => ({ game, card_id, last_seen: today }))) }, { service: true });
  return json(r.ok ? { ok: true, tracked: ids.length } : { error: "store_failed" }, r.ok ? 200 : 502);
}

export async function historyRoute(url, env, ctx) {
  const game = url.searchParams.get("game") || "",
    id = url.searchParams.get("id") || "",
    finish = (url.searchParams.get("finish") || "").slice(0, 40),
    source = (url.searchParams.get("source") || "").slice(0, 60);
  if (!GAMES.has(game) || !ID.test(id)) return json({ error: "bad_request" }, 400);
  const cacheKey = new Request("https://cardstashy.cache/prices/" + [game, id, finish, source].map(encodeURIComponent).join("/"));
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;
  const q = `price_points?select=day,price&game=eq.${game}&card_id=eq.${encodeURIComponent(id)}${finish ? "&finish=eq." + encodeURIComponent(finish) : ""}${source ? "&source=eq." + encodeURIComponent(source) : ""}&currency=eq.USD&order=day.asc&limit=400`;
  const r = await rest(env, q);
  if (!r.ok) return json({ points: [], error: r.status === 404 ? "not_installed" : "unavailable" }, 200, 300);
  const rows = await r.json(),
    res = json({ points: rows.map((x) => ({ date: x.day, value: Number(x.price) })) }, 200, 6 * 3600);
  ctx?.waitUntil?.(caches.default.put(cacheKey, res.clone()));
  return res;
}

// Price rows for one Scryfall card (each finish is its own series).
export function mtgRows(card, day) {
  const out = [];
  for (const [finish, field] of [["nonfoil", "usd"], ["foil", "usd_foil"], ["etched", "usd_etched"]]) {
    const v = Number(card?.prices?.[field]);
    if (card?.id && v > 0) out.push({ game: "mtg", card_id: card.id, finish, source: MTG_SOURCE, currency: "USD", day, price: Math.round(v * 100) / 100 });
  }
  return out;
}
export function ygoRows(card, day) {
  const v = Number(card?.card_prices?.[0]?.tcgplayer_price);
  return card?.id && v > 0 ? [{ game: "ygo", card_id: String(card.id), finish: "reference", source: YGO_SOURCE, currency: "USD", day, price: Math.round(v * 100) / 100 }] : [];
}

// Daily recording. Kept under Cloudflare's free-plan limit of 50 outgoing requests per run:
// 1 read + up to PRICE_BATCHES Scryfall batches (75 cards each) + YGO batches + a few writes.
export async function recordDailyPrices(env, fetchImpl = fetch) {
  if (!env.SUPABASE_SERVICE_KEY) return { skipped: "not_configured" };
  const day = new Date().toISOString().slice(0, 10),
    mtgBatches = Math.max(1, Math.min(900, Number(env.PRICE_BATCHES) || 30)),
    ygoBatches = Math.max(0, Math.min(200, Number(env.YGO_PRICE_BATCHES) || 6));
  const w = await rest(env, `price_watch?select=game,card_id&order=last_seen.desc&limit=${mtgBatches * 75 + ygoBatches * 50}`, {}, { service: true });
  if (!w.ok) return { error: "watch_unavailable" };
  const watch = await w.json(),
    mtg = watch.filter((x) => x.game === "mtg").map((x) => x.card_id).slice(0, mtgBatches * 75),
    ygo = watch.filter((x) => x.game === "ygo").map((x) => x.card_id).slice(0, ygoBatches * 50),
    rows = [];
  for (let i = 0; i < mtg.length; i += 75) {
    try {
      const r = await fetchImpl("https://api.scryfall.com/cards/collection", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "CardStashy/3 (price history)" }, body: JSON.stringify({ identifiers: mtg.slice(i, i + 75).map((id) => ({ id })) }) });
      if (r.ok) for (const c of (await r.json()).data || []) rows.push(...mtgRows(c, day));
      await new Promise((ok) => setTimeout(ok, 110));
    } catch {}
  }
  for (let i = 0; i < ygo.length; i += 50) {
    try {
      const r = await fetchImpl("https://db.ygoprodeck.com/api/v7/cardinfo.php?id=" + ygo.slice(i, i + 50).join(","), { headers: { Accept: "application/json" } });
      if (r.ok) for (const c of (await r.json()).data || []) rows.push(...ygoRows(c, day));
    } catch {}
  }
  let saved = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const r = await rest(env, "price_points?on_conflict=game,card_id,finish,source,currency,day", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 1000)) }, { service: true });
    if (r.ok) saved += Math.min(1000, rows.length - i);
  }
  // Monthly cleanup of old rows.
  if (day.endsWith("-01")) await rest(env, "rpc/prune_price_points", { method: "POST", body: "{}" }, { service: true }).catch(() => {});
  return { watched: watch.length, saved };
}
