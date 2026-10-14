// Shareable deck links and the "decks I can almost build" finder.
// A shared deck travels entirely inside the link (#shared/<data>): no server,
// no account, and nothing about the sharer's collection, ownership or value.
import { cardKey, aggregateCards } from "./core.js";
import { formatOf, isFormatName } from "./formats.js";

const MAX_CARDS = 400;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

// What a link carries. Fields are short to keep URLs small.
export function sharePayload(deck, { author = "", about = "" } = {}) {
  return {
    v: 1,
    n: clean(deck.name, 100),
    c: clean(deck.commander, 150),
    f: deck.format === "Commander" ? "C" : deck.format === "60-card casual" ? "60" : clean(deck.format, 40),
    s: clean(deck.strategy && deck.strategy !== "Auto" ? deck.strategy : "", 40),
    b: Number.isFinite(Number(deck.budget)) ? Number(deck.budget) : null,
    a: clean(author, 60),
    d: clean(about, 1500),
    l: aggregateCards(deck.cards).slice(0, MAX_CARDS).map((c) => (c.qty === 1 ? c.name : [c.name, c.qty])),
    ...((deck.side || []).length ? { sb: aggregateCards(deck.side).slice(0, 30).map((c) => (c.qty === 1 ? c.name : [c.name, c.qty])) } : {}),
  };
}

// Turn a decoded payload back into a deck object; rejects anything malformed.
// Yu-Gi-Oh! and Pokémon decks travel by card id, per zone (main/extra/side).
export function sharePayloadTcg(game, deck, { author = "", about = "" } = {}) {
  const z = (rows) => (rows || []).slice(0, MAX_CARDS).map((r) => [String(r.cardId), r.qty, clean(r.name, 150)]);
  return { v: 2, g: game, n: clean(deck.name, 100), f: clean(deck.format, 40), a: clean(author, 60), d: clean(about, 1500), z: { m: z(deck.zones?.main), e: z(deck.zones?.extra), s: z(deck.zones?.side) } };
}
function tcgDeckFromPayload(p) {
  if (!["ygo", "ptcg"].includes(p.g) || !p.z || typeof p.z !== "object") throw Error("This share link is damaged or incomplete.");
  const zone = (rows) => {
    if (!Array.isArray(rows) || rows.length > MAX_CARDS) throw Error("This share link is damaged or incomplete.");
    return rows.map((r) => ({ cardId: clean(r?.[0], 40), qty: Number(r?.[1]), name: clean(r?.[2], 150) })).filter((r) => r.cardId && Number.isInteger(r.qty) && r.qty > 0 && r.qty <= 99);
  };
  const zones = { main: zone(p.z.m), extra: zone(p.z.e || []), side: zone(p.z.s || []) };
  if (!zones.main.length && !zones.extra.length) throw Error("This share link has no cards.");
  return { game: p.g, name: clean(p.n, 100) || "Shared deck", format: clean(p.f, 40), author: clean(p.a, 60), about: clean(p.d, 1500), zones };
}

export function deckFromPayload(p) {
  if (p?.v === 2) return tcgDeckFromPayload(p);
  if (!p || p.v !== 1 || !Array.isArray(p.l) || !p.l.length || p.l.length > MAX_CARDS) throw Error("This share link is damaged or incomplete.");
  const cards = p.l.map((x) => (Array.isArray(x) ? { name: clean(x[0], 150), qty: Number(x[1]) } : { name: clean(x, 150), qty: 1 }));
  if (cards.some((c) => !c.name || !Number.isInteger(c.qty) || c.qty < 1 || c.qty > 250)) throw Error("This share link has an invalid card line.");
  return {
    name: clean(p.n, 100) || "Shared deck",
    commander: clean(p.c, 150),
    format: p.f === "C" ? "Commander" : p.f === "60" ? "60-card casual" : isFormatName(p.f) ? formatOf(p.f).name : "60-card casual",
    strategy: clean(p.s, 40) || "Auto",
    budget: Number.isFinite(Number(p.b)) && p.b !== null ? Number(p.b) : null,
    author: clean(p.a, 60),
    about: clean(p.d, 1500),
    cards,
    // Sideboard (optional; older links have none).
    side: (Array.isArray(p.sb) ? p.sb.slice(0, 30) : []).map((x) => (Array.isArray(x) ? { name: clean(x[0], 150), qty: Number(x[1]) } : { name: clean(x, 150), qty: 1 })).filter((c) => c.name && Number.isInteger(c.qty) && c.qty > 0 && c.qty <= 15),
  };
}

const toB64url = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
};
async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

// "z." = deflate-compressed JSON; "j." = plain JSON for browsers without compression streams.
export async function encodeShare(payload) {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream === "function") return "z." + toB64url(await pipe(json, new CompressionStream("deflate-raw")));
  return "j." + toB64url(json);
}
export async function decodeShare(code) {
  const m = /^([zj])\.([A-Za-z0-9_-]+)$/.exec(String(code || ""));
  if (!m) throw Error("This share link is damaged or incomplete.");
  if (m[2].length > 60000) throw Error("This share link is too long.");
  let bytes = fromB64url(m[2]);
  if (m[1] === "z") {
    if (typeof DecompressionStream !== "function") throw Error("This browser can’t open compressed share links. Try an up-to-date Chrome, Safari or Firefox.");
    bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  }
  return deckFromPayload(JSON.parse(new TextDecoder().decode(bytes)));
}

/* ---------- Decks I can almost build ---------- */

// Score one candidate deck against what you own (copies other decks have reserved don't count).
// `available(name)` returns free copies; `price(name)` returns a USD estimate or null.
// `skip(name)` leaves a card out entirely (basic lands: most players have plenty and they rarely have a price).
export function buildability(deck, available, price, skip = () => false) {
  let owned = 0,
    missing = 0,
    cost = 0,
    unknown = 0;
  const need = [];
  let total = 0,
    skipped = 0;
  for (const c of aggregateCards(deck.cards)) {
    if (skip(c.name)) {
      skipped += c.qty;
      continue;
    }
    total += c.qty;
    const have = Math.min(c.qty, Math.max(0, available(c.name) || 0)),
      miss = c.qty - have;
    owned += have;
    if (!miss) continue;
    missing += miss;
    const p = price(c.name);
    if (p === null || p === undefined || !Number.isFinite(Number(p))) unknown += miss;
    else cost += Number(p) * miss;
    need.push({ name: c.name, qty: miss, price: p ?? null });
  }
  return { total, skipped, owned, missing, cost, unknown, ratio: total ? owned / total : 0, need: need.sort((a, b) => (b.price ?? -1) - (a.price ?? -1)) };
}

export function rankBuildable(candidates, { maxCost = null, query = "", colors = "", sort = "cost" } = {}) {
  const q = query.trim().toLowerCase();
  return candidates
    .filter((x) => maxCost === null || x.score.cost <= maxCost)
    .filter((x) => !q || [x.deck.name, x.deck.commander, x.source].some((v) => String(v || "").toLowerCase().includes(q)))
    .filter((x) => !colors || [...colors].every((c) => (x.identity || []).includes(c)))
    .sort((a, b) =>
      sort === "owned"
        ? b.score.ratio - a.score.ratio || a.score.cost - b.score.cost
        : a.score.cost - b.score.cost || b.score.ratio - a.score.ratio,
    );
}

export const sameList = (a, b) => {
  const k = (d) => aggregateCards(d.cards).map((c) => cardKey(c.name) + "×" + c.qty).sort().join("|");
  return k(a) === k(b);
};
