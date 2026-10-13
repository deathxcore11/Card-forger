// Fair trades: singles within 15%, pairs within 10%, wishlist asks only when you own the card.
import assert from "node:assert/strict";
const { tradeMatches } = await import("./trade.js");
const owned = [
  { key: "a", name: "A", price: 10.5, qty: 1 }, { key: "b", name: "B", price: 6, qty: 1 }, { key: "c", name: "C", price: 4, qty: 1 },
  { key: "d", name: "D", price: 5, qty: 2 }, { key: "e", name: "E", price: 30, qty: 1 }, { key: "t", name: "Target", price: 10, qty: 1 },
];
const m = tradeMatches({ target: { key: "t", price: 10, owned: true }, owned, wish: [{ key: "w", name: "W", price: 11 }, { key: "x", name: "X", price: 40 }] });
assert.deepEqual(m.singles.map((x) => x.items[0].key), ["a"], "A is within 15%, the card itself is excluded");
assert.ok(m.pairs.some((p) => p.items.map((x) => x.key).join() === "b,c"), "6 + 4 = 10");
assert.ok(m.pairs.some((p) => p.items.map((x) => x.key).join() === "d,d"), "two copies of D = 10");
assert.deepEqual(m.asks.map((x) => x.items[0].key), ["w"]);
assert.deepEqual(tradeMatches({ target: { key: "t", price: 10, owned: false }, owned, wish: [{ key: "w", price: 11 }] }).asks, [], "not owned: nothing to ask for");
assert.equal(tradeMatches({ target: { key: "t", price: null }, owned }).price, null);
console.log("PASS: equal-value trade matching.");
