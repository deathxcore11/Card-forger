// Server side of shared price history (runs in the Cloudflare Worker).
//   POST /api/prices/watch    { game, ids: [...] }   → adds cards to the daily recording list
//   GET  /api/prices/history?game=&id=&finish=&source= → [{ date, value }] for the chart
//   daily cron                                        → records today's price for watched cards
// Needs the SUPABASE_SERVICE_KEY secret (Supabase → Project Settings → API keys → secret key).
// Without it, history reads still work and recording is skipped.
import { SUPABASE } from "./config.js";

const GAMES = new Set(["mtg", "ygo", "ptcg"]);
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const WATCH_GAMES = new Set(["mtg", "ygo"]);
const watchId = (game, id) => typeof id === "string" && (game === "mtg"
  ? /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)
  : game === "ygo" && /^[1-9][0-9]{0,9}$/.test(id));
export const MTG_SOURCE = "Scryfall / TCGplayer",
  YGO_SOURCE = "TCGplayer reference";

const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" } });

function rest(env, path, init = {}, { service = false, fetcher = fetch } = {}) {
  const url = (env.SUPABASE_URL || SUPABASE.url) + "/rest/v1/" + path,
    key = service ? env.SUPABASE_SERVICE_KEY : env.SUPABASE_SERVICE_KEY || SUPABASE.key,
    headers = { apikey: key, "Content-Type": "application/json", ...(init.headers || {}) };
  // Legacy JWT keys also go in Authorization; new sb_secret_/sb_publishable_ keys don't.
  if (/^eyJ/.test(key || "")) headers.Authorization = "Bearer " + key;
  return fetcher(url, { ...init, headers });
}

// Registration is an all-or-nothing, provider-verified batch. Syntax alone is not a
// card identity: do not let made-up IDs consume shared storage or daily fetch slots.
export async function watchRoute(request, env, { fetcher = fetch } = {}) {
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env.SUPABASE_SERVICE_KEY) return json({ error: "not_configured" }, 200);
  let body;
  try {
    if (Number(request.headers?.get("Content-Length")) > 40000) return json({ error: "too_large" }, 413);
    if (request.text) {
      const text = await request.text();
      if (text.length > 40000) return json({ error: "too_large" }, 413);
      body = JSON.parse(text);
    } else body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const game = body?.game;
  if (!WATCH_GAMES.has(game) || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 300 || body.ids.some(id => !watchId(game, id))) return json({ error: "bad_request" }, 400);
  const ids = [...new Set(body.ids)];
  try {
    const found = new Set(), batchSize = game === "mtg" ? 75 : 50;
    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const r = await fetcher(game === "mtg" ? "https://api.scryfall.com/cards/collection" : "https://db.ygoprodeck.com/api/v7/cardinfo.php?id=" + chunk.join(","), {
        ...(game === "mtg" ? { method: "POST", body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) }) } : {}),
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "CardStashy/3 (price history)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) return json({ error: r.status === 400 || r.status === 404 ? "unknown_card" : "provider_unavailable" }, r.status === 400 || r.status === 404 ? 400 : 503);
      for (const card of (await r.json()).data || []) if (watchId(game, String(card?.id))) found.add(String(card.id));
      if (game === "mtg" && i + batchSize < ids.length) await new Promise(resolve => setTimeout(resolve, 110));
    }
    if (ids.some(id => !found.has(id))) return json({ error: "unknown_card" }, 400);
    // The database serializes capacity/rate checks and insertion. A missing migration
    // fails closed; never fall back to an unbounded service-role upsert.
    const r = await rest(env, "rpc/register_price_watch", { method: "POST", body: JSON.stringify({ g: game, ids }) }, { service: true, fetcher });
    if (!r.ok) return json({ error: "registration_unavailable" }, 503);
    const result = await r.json();
    if (result === "capacity" || result === "rate_limited") return json({ error: result }, 429);
    if (result !== "registered") return json({ error: "registration_unavailable" }, 503);
    return json({ ok: true, tracked: ids.length });
  } catch { return json({ error: "registration_unavailable" }, 503); }
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

// Each supported game gets its own query and budget. Filtering a global LIMIT
// afterward lets unsupported legacy watches or a busy game starve the other game.
// Defaults stay below 50 outgoing requests: 2 reads, 30+6 provider batches, writes.
export async function recordDailyPrices(env, fetchImpl = fetch) {
  if (!env.SUPABASE_SERVICE_KEY) return { skipped: "not_configured" };
  const day = new Date().toISOString().slice(0, 10),
    mtgBatches = Math.max(1, Math.min(900, Math.floor(Number(env.PRICE_BATCHES) || 30))),
    ygoBudget = Number(env.YGO_PRICE_BATCHES ?? 6),
    ygoBatches = Math.max(0, Math.min(200, Math.floor(Number.isFinite(ygoBudget) ? ygoBudget : 6))),
    cutoff = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10),
    watches = {}, errors = [];
  for (const [game, limit] of [["mtg", mtgBatches * 75], ["ygo", ygoBatches * 50]]) {
    if (!limit) { watches[game] = []; continue; }
    try {
      const r = await rest(env, `price_watch?select=game,card_id&game=eq.${game}&last_seen=gte.${cutoff}&order=last_seen.desc,card_id.asc&limit=${limit}`, {}, { service: true, fetcher: fetchImpl });
      if (!r.ok) throw new Error("watch_unavailable");
      const data = await r.json();
      watches[game] = [...new Set(data.filter(x => x.game === game && watchId(game, x.card_id)).map(x => x.card_id))].slice(0, limit);
    } catch { watches[game] = []; errors.push(game); }
  }
  if (errors.length === (ygoBatches ? 2 : 1)) return { error: "watch_unavailable" };
  const mtg = watches.mtg, ygo = watches.ygo, rows = [];
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
    const r = await rest(env, "price_points?on_conflict=game,card_id,finish,source,currency,day", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 1000)) }, { service: true, fetcher: fetchImpl });
    if (r.ok) saved += Math.min(1000, rows.length - i);
  }
  // Monthly cleanup of old rows.
  if (day.endsWith("-01")) await rest(env, "rpc/prune_price_points", { method: "POST", body: "{}" }, { service: true, fetcher: fetchImpl }).catch(() => {});
  return { watched: mtg.length + ygo.length, saved, ...(errors.length ? { unavailableGames: errors } : {}) };
}
