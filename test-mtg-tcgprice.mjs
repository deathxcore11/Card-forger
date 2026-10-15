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
