import assert from "node:assert/strict";
import { S, cacheCard } from "./store.js";
// A price refresh (fresh Scryfall data, no condition quotes) keeps the NM/LP quotes already learned
// for the same printing, so a saved copy's condition keeps its price.
const quotes = [{ condition: "LP", price: 1.5, printingId: "p1", finish: "nonfoil", source: "TCGplayer" }];
cacheCard({ id: "p1", name: "Carry Test", prices: { usd: "2.00" }, conditionQuotes: quotes });
const fresh = cacheCard({ id: "p1", name: "Carry Test", prices: { usd: "2.10" } });
assert.deepEqual(fresh.conditionQuotes, quotes); assert.equal(fresh.prices.usd, "2.10");
// A different printing under the same name never inherits them.
assert.equal(cacheCard({ id: "p2", name: "Carry Test", prices: { usd: "9.00" } }).conditionQuotes, undefined);
// New quotes from the source replace the old ones.
const next = [{ condition: "LP", price: 1.7, printingId: "p2", finish: "nonfoil", source: "TCGplayer" }];
assert.deepEqual(cacheCard({ id: "p2", name: "Carry Test", conditionQuotes: next }).conditionQuotes, next);
assert.ok(S.catalog);
console.log("PASS: condition quotes survive price refreshes for the same printing.");
