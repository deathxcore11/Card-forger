import {classicEvidence,classicProviderCard} from './pokemon-classic-evidence.js';
import { ptcgProduct } from "./ptcg-product.js";
// Last-resort Pokémon card art: the TCGplayer product image for the exact card, for printings
// TCGdex has no scan of (promos, McDonald's sets, Shiny Vault, gallery subsets…). The card's own
// TCGplayer product id comes from TCGdex; without one, the product is matched in the set's
// TCGplayer group by name and collector number. Never another printing's image.
const MONTH = 60 * 60 * 24 * 30;
// Words of a set name, singular ("Energies" and "Energy" match), "HS" read as HGSS.
const words = (s) => (String(s || "").toLowerCase().replace(/\bhs\b/g, "hgss").replace(/pok[eé]mon/g, "").match(/[a-z0-9]+/g) || []).map((w) => (w.length > 4 ? w.replace(/ies$/, "y").replace(/s$/, "") : w));
const norm = (s) => String(s || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
const numKey = (s) => {
  const first = String(s || "").split("/")[0].trim().toUpperCase();
  return /^\d+$/.test(first) ? String(Number(first)) : first.replace(/^([A-Z]+)0+(\d)/, "$1$2");
};

// The set's TCGplayer group: every word of the TCGdex set name appears in the group name.
// TCGdex and TCGplayer name the promo sets differently.
const ALIAS = { "svp black star promos": "SV: Scarlet & Violet Promo Cards", "swsh black star promos": "SWSH: Sword & Shield Promo Cards", "mep black star promos": "ME: Mega Evolution Promo", "xy black star promos": "XY Promos", "bw black star promos": "Black and White Promos", "dp black star promos": "Diamond and Pearl Promos", "hgss black star promos": "HGSS Promos", "sm black star promos": "SM Promos", "wizards black star promos": "WoTC Promo", "nintendo black star promos": "Nintendo Promos" };
export function pickGroup(groups, setName) {
  setName = ALIAS[String(setName || "").toLowerCase()] || setName;
  const want = words(setName).filter((w) => !["trainer", "kit", "collection", "set"].includes(w) || words(setName).length < 3);
  if (!want.length) return null;
  const hits = (groups || []).filter((g) => { const have = new Set(words(g.name)); return want.every((w) => have.has(w)); });
  const exact = hits.filter(g=>norm(g.name)===norm(setName));
  if(exact.length) return exact.length===1?exact[0]:null;
  hits.sort((a,b)=>a.name.length-b.name.length);
  return hits.length && (hits.length===1 || hits[0].name.length<hits[1].name.length)?hits[0]:null;
}

// The card in the group's products: same collector number and exact card name.
// Reprint collections with no numbering of their own (TCGdex: 0 official cards) keep each card's
// original number on TCGplayer (30th Classic Collection's Charizard is 4/102 there, 001 on
// TCGdex): for those only, the one product in the group with exactly that name.
export function pickProduct(products, card) {
  const n = numKey(card.localId), name = norm(card.name), list = products || [];
  if(!n||!name)return null;
  // Only known finish/collector annotations may follow the name. EX/GX/V are identities.
  const nameOf=p=>{
    let title=String(p.name||"").replace(/\s*\((?:Holo|Holofoil|Reverse Holo(?:foil)?|Non-Holo)\)\s*$/i,"");
    // Trainer kits repeat Energy names. TCGplayer's (#5) annotation is a
    // collector number, not part of the name, but must agree with Number.
    const numbered=title.match(/\s+(?:\(#([A-Z]*\d+(?:\/\d+)?)\)|-\s+([A-Z]*\d+(?:\/\d+)?))\s*$/i);
    if(numbered){
      const number=numKey((p.extendedData||[]).find(x=>x.name==="Number")?.value);
      if(numKey(numbered[1]||numbered[2])!==number)return "";
      title=title.slice(0,numbered.index);
    }
    return norm(title);
  };
  const exact = list.filter(p=>numKey((p.extendedData||[]).find(x=>x.name==="Number")?.value)===n && nameOf(p)===name);
  if(exact.length || card.set?.cardCount?.official!==0)return exact.length===1?exact[0]:null;
  const named=list.filter(p=>(p.extendedData||[]).some(x=>x.name==="Number")&&nameOf(p)===name);
  return named.length===1?named[0]:null;
}

export async function pokemonProductId(id, get) {
  const card = classicProviderCard(await get("https://api.tcgdex.net/v2/en/cards/" + encodeURIComponent(id)));
  if (card?.id !== id) return null;
  // Use the same conservative reference product as price history: older sets
  // often have this exact ID only under pricing.tcgplayer.<finish>.productId.
  const direct = ptcgProduct(card)?.productId;
  if (Number.isSafeInteger(direct) && direct > 0) return direct;
  // Conflicting variants must not be bypassed by a looser set/name match.
  if ((card.variants_detailed || []).some(v => v.thirdParty?.tcgplayer)) return null;
  // TCGdex also publishes a card-level identity even when pricing is absent.
  const cardProduct = Number(card.thirdParty?.tcgplayer);
  if (Number.isSafeInteger(cardProduct) && cardProduct > 0) return cardProduct;
  const groups = await get("https://tcgcsv.com/tcgplayer/3/groups");
  const group = pickGroup(groups?.results, card.set?.name);
  const groupId = Number(group?.groupId);
  if (!Number.isSafeInteger(groupId) || groupId < 1) return null;
  const products = await get(`https://tcgcsv.com/tcgplayer/3/${groupId}/products`);
  const productId = Number(pickProduct(products?.results, card)?.productId);
  return Number.isSafeInteger(productId) && productId > 0 ? productId : null;
}

// GET /img/ptcg/(s|l)/<card id>.jpg — small for grids, large for the card page and zoom.
export async function pokemonArtRoute(request, url, ctx, fetchImpl = fetch) {
  const m = url.pathname.match(/^\/img\/ptcg\/(s|l)\/(.{1,120})\.jpg$/);
  let id = "";
  try { id = decodeURIComponent(m?.[2] || ""); } catch {}
  if (!m || !/^[A-Za-z0-9.!?_-]{1,80}$/.test(id)) return new Response("Invalid card", { status: 400 });
  const cache = caches.default, cacheRequest=classicEvidence(id)?new Request(request.url+(request.url.includes('?')?'&':'?')+'classicSchema=1'):request, hit = await cache.match(cacheRequest);
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
    const miss = () => { const r = new Response("No artwork", { status: 404, headers: { "Cache-Control": "public, max-age=86400" } }); ctx?.waitUntil?.(cache.put(cacheRequest, r.clone())); return r; };
    if (!pid) return miss();
    const upstream = await fetchImpl(`https://tcgplayer-cdn.tcgplayer.com/product/${pid}_${m[1] === "s" ? "400w" : "in_1000x1000"}.jpg`, { signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) return miss();
    const res = new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg", "Cache-Control": `public, max-age=${MONTH}`, "X-Art-Source": "TCGplayer" } });
    ctx?.waitUntil?.(cache.put(cacheRequest, res.clone()));
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
