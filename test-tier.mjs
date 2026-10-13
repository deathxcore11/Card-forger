// Card tiers are by one card's market price, the same bands in every game, never by copies owned.
import assert from "node:assert/strict";
import { tierOf, priceTier } from "./tier.js";
assert.deepEqual([0.52, 1, 4.95, 7.4, 20, 99, 100.87, 824.69, 1000, 5000].map(priceTier), [0, 1, 1, 2, 3, 3, 4, 4, 5, 5]);
assert.equal(tierOf("ptcg", "Secret Rare", 0.5).label, "Common", "price decides, not printed rarity");
assert.equal(tierOf("mtg", "mythic", 1200).label, "Grail");
assert.equal(tierOf("ygo", "Common", 150).label, "Legendary");
console.log("PASS: price-band tiers per card, identical across games.");
