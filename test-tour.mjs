import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const { shouldTour, STEPS } = await import("./tour.js");
assert.equal(shouldTour({ cards: 0, decks: 0, seen: false }), true, "brand new: show");
assert.equal(shouldTour({ cards: 3, decks: 0, seen: false }), false, "has cards: skip");
assert.equal(shouldTour({ cards: 0, decks: 0, seen: true }), false, "seen: never again");
assert.equal(STEPS.length, 3);
console.log("PASS: first-run tour only for new users, once.");
