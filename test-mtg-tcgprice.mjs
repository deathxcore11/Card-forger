// Magic printings Scryfall leaves unpriced (Alpha Animate Wall): TCGplayer's price for the same
// product fills in, labelled; the player's own price only where no store prices it.
import assert from "node:assert/strict";
import { compactPrices, mtgTcgPriceRoute } from "./mtg-tcg-route.js";
import { setTcgPrices, tcgFallback, productIdOf, useMyPrices, myPrice, myPriceKey } from "./mtg-tcgprice.js";
import { cardPrice } from "./core.js";

const store = new Map();
globalThis.caches = { default: { match: async (r) => store.get(typeof r === "string" ? r : r.url)?.clone(), put: async (r, res) => void store.set(typeof r === "string" ? r : r.url, res.clone()) } };

// Worker route: Scryfall set → TCGplayer group → tcgcsv prices, compacted by product and finish.
const calls = [];
const fake = async (u) => {
  calls.push(u);
  if (u === "https://api.scryfall.com/sets/lea") return Response.json({ code: "lea", tcgplayer_id: 7 });
  if (u === "https://tcgcsv.com/tcgplayer/1/7/prices") return Response.json({ results: [
    { productId: 1029, lowPrice: 249.99, midPrice: 289.98, highPrice: 599.49, marketPrice: null, subTypeName: "Normal" },
    { productId: 1030, lowPrice: null, midPrice: null, marketPrice: null, subTypeName: "Normal" },
  ] });
  return new Response("nope", { status: 500 });
};
const res = await mtgTcgPriceRoute(new URL("https://x/api/prices/mtg-tcg?set=lea"), null, fake);
const body = await res.json();
assert.deepEqual(body.prices, { 1029: { Normal: { market: null, low: 249.99, mid: 289.98 } } }, "unpriced products are dropped");
assert.equal(body.group, 7);
assert.equal((await mtgTcgPriceRoute(new URL("https://x/api/prices/mtg-tcg?set=bad!"), null, fake)).status, 400);
assert.deepEqual(compactPrices([{ productId: 5, marketPrice: 1.234, lowPrice: 1, midPrice: 2, subTypeName: "Foil" }]), { 5: { Foil: { market: 1.23, low: 1, mid: 2 } } });

// Client: the product id comes from Scryfall's id or its TCGplayer link (older cached cards).
const wall = { name: "Animate Wall", set: "lea", prices: { usd: null, eur: "369.27" }, purchase_uris: { tcgplayer: "https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&u=https%3A%2F%2Fwww.tcgplayer.com%2Fproduct%2F1029%3Fpage%3D1" } };
assert.equal(productIdOf(wall), 1029);
assert.equal(productIdOf({ ...wall, tcgplayer_id: 77 }), 77);
assert.equal(cardPrice(wall), null, "no price before the set's TCGplayer prices load");
setTcgPrices("lea", body.prices);
assert.deepEqual(tcgFallback(wall), { value: 249.99, kind: "low" });
assert.equal(cardPrice(wall), 249.99, "collection value and decks use TCGplayer's low listing");
assert.equal(cardPrice(wall, "foil"), null, "no foil Alpha");
assert.equal(cardPrice(wall, "etched"), null, "no etched Alpha");
assert.equal(cardPrice({ ...wall, finishes: ["foil"] }), null, "only finishes the printing comes in");
assert.equal(cardPrice({ ...wall, prices: { usd: "300.00" } }), 300, "Scryfall's own price always wins");
console.log("PASS: Unpriced Magic printings fall back to TCGplayer's price for the same product.");

// Personal price: only for the player, only where nothing prices the card.
const promo = { id: "abc", name: "Weird Promo", set: "zzz", prices: {} };
useMyPrices({ [myPriceKey(promo)]: { price: 12.5 } });
assert.equal(myPrice(promo), 12.5);
assert.equal(cardPrice(promo), 12.5, "own price counts where no store prices the printing");
useMyPrices({ [myPriceKey(wall)]: { price: 5 } });
assert.equal(cardPrice({ ...wall, id: undefined }), 249.99, "own price never replaces a store price");
useMyPrices({});
console.log("PASS: Personal prices stay with the player and only fill gaps.");

// Pokémon promos: TCGdex calls the set "SVP Black Star Promos", TCGplayer "SV: Scarlet & Violet
// Promo Cards". The exact-product price fallback finds the group by the same alias as the art.
const { pokemonPriceRoute } = await import("./pokemon-prices.js");
const pk = async (u) => {
  if (u.endsWith("/cards/svp-1")) return Response.json({ id: "svp-1", name: "Sprigatito", set: { name: "SVP Black Star Promos" }, variants_detailed: [{ type: "holo", thirdParty: { tcgplayer: 4242 } }] });
  if (u.endsWith("/tcgplayer/3/groups")) return Response.json({ results: [{ groupId: 22872, name: "SV: Scarlet & Violet Promo Cards" }, { groupId: 1, name: "Scarlet & Violet" }] });
  if (u.endsWith("/tcgplayer/3/22872/prices")) return Response.json({ results: [{ productId: 4242, marketPrice: 1.75, lowPrice: 1, midPrice: 2, subTypeName: "Holofoil" }] });
  return new Response("", { status: 404 });
};
const promo1 = await (await pokemonPriceRoute(new URL("https://x/api/prices/pokemon?id=svp-1"), null, pk)).json();
assert.equal(promo1.quotes?.[0]?.marketPrice, 1.75, "SVP promo priced through TCGplayer's promo group");
console.log("PASS: Pokémon Black Star promos get TCGplayer prices through the promo group alias.");

// Pokémon card data TCGdex leaves out: stage on old EX/GX, trainer type, kit Basic Energy.
const { normalizePtcg } = await import("./ptcg.js");
const { applyProductPrices } = await import("./pokemon-prices.js");
const celebi = normalizePtcg({ id: "bw7-9", name: "Celebi-EX", category: "Pokemon", hp: 110, types: ["Grass"], attacks: [{ name: "Shiny Leaf", cost: ["Grass"] }] });
assert.ok(celebi.basicPokemon && celebi.stage === "Basic", "an EX that evolves from nothing is a Basic Pokémon");
assert.equal(normalizePtcg({ id: "sm12-4", name: "Vileplume GX", category: "Pokemon", evolveFrom: "Gloom" }).basicPokemon, false, "evolutions are never guessed Basic");
assert.equal(normalizePtcg({ id: "swshp-215", name: "Morpeko V-UNION", category: "Pokemon" }).basicPokemon, false, "V-UNION pieces aren't Basic");
assert.match(normalizePtcg({ id: "x", name: "Old Draw", category: "Trainer", effect: "Draw 3 cards. You may play only 1 Supporter card during your turn." }).typeLine, /Supporter/);
assert.match(normalizePtcg({ id: "y", name: "Tropical Wind", category: "Trainer", effect: "Each player draws 3 cards." }).typeLine, /Item/);
assert.ok(normalizePtcg({ id: "tk-sm-r-3", name: "Lightning Energy", category: "Energy" }).basicEnergy, "kit Basic Energy is Basic Energy");
// A product the Worker found by number and name prices every finish of a card TCGdex never mapped.
const old = normalizePtcg({ id: "bw7-9", name: "Celebi-EX", category: "Pokemon", variants: { holo: true } });
assert.ok(applyProductPrices(old, { cardId: "bw7-9", matchedProduct: 99, quotes: [{ productId: 99, subTypeName: "Holofoil", marketPrice: 4.2, lowPrice: 3, midPrice: 5 }] }));
assert.equal(old.prices.usd, 4.2);
console.log("PASS: Pokémon cards missing stage, trainer type or a TCGplayer link still play and price correctly.");

// Yu-Gi-Oh! printing prices: the TCGplayer set by name, else by the printing's code prefix; the
// product must still carry the exact code and rarity.
const { ygoPriceRoute } = await import("./ygo-prices.js");
const yg = async (u) => {
  if (u.includes("cardinfo.php")) return Response.json({ data: [{ id: 89631139, name: "Blue-Eyes White Dragon", card_sets: [{ set_name: "2014 Mega-Tin Mega Pack", set_code: "MP14-EN001", set_rarity: "Ultra Rare" }, { set_name: "Legendary Duelists: Season 2", set_code: "LDS2-EN001", set_rarity: "Ultra Rare" }] }] });
  if (u.endsWith("/tcgplayer/2/groups")) return Response.json({ results: [{ groupId: 5, name: "2014 Mega-Tins Mega Pack", abbreviation: "MP14" }, { groupId: 6, name: "Legendary Duelists: Season 2", abbreviation: "LDS2" }] });
  const num = (n, r) => [{ name: "Number", value: n }, { name: "Rarity", value: r }];
  if (u.endsWith("/2/5/products")) return Response.json({ results: [{ productId: 50, name: "Blue-Eyes White Dragon", extendedData: num("MP14-EN001", "Ultra Rare") }] });
  if (u.endsWith("/2/5/prices")) return Response.json({ results: [{ productId: 50, marketPrice: 2.5, lowPrice: 2, subTypeName: "1st Edition" }] });
  if (u.endsWith("/2/6/products")) return Response.json({ results: [{ productId: 60, name: "Blue-Eyes White Dragon (Blue)", extendedData: num("LDS2-EN001", "Ultra Rare") }, { productId: 61, name: "Blue-Eyes White Dragon (Green)", extendedData: num("LDS2-EN001", "Ultra Rare") }] });
  if (u.endsWith("/2/6/prices")) return Response.json({ results: [{ productId: 60, marketPrice: 9, subTypeName: "1st Edition" }, { productId: 61, marketPrice: 8, subTypeName: "1st Edition" }] });
  return new Response("", { status: 404 });
};
const ygp = await (await ygoPriceRoute(new URL("https://x/api/prices/yugioh?id=89631139&t=1"), null, yg)).json();
assert.deepEqual(ygp.printings.map((p) => [p.code, p.productId]), [["MP14-EN001", 50]], "set found by code; colour variants sharing a code aren't guessed");
console.log("PASS: Yu-Gi-Oh! printings find their TCGplayer set by code, never guessing between variants.");
