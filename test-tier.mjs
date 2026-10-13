// Card tiers are by one card's market price, the same bands in every game, never by copies owned.
import assert from "node:assert/strict";
import { tierOf, priceTier } from "./tier.js";
assert.deepEqual([0.52, 1.5, 2, 4.95, 10, 10.5, 50, 51, 200, 200.5, 824.69, 1000, 1000.01, 5000].map(priceTier), [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5]);
assert.equal(tierOf("ptcg", "Secret Rare", 0.5).label, "Common", "price decides, not printed rarity");
assert.equal(tierOf("mtg", "mythic", 1200).label, "Grail");
assert.equal(tierOf("ygo", "Common", 150).label, "Epic");
assert.equal(tierOf("ygo", "Common", 350).label, "Legendary");
console.log("PASS: price-band tiers per card, identical across games.");
assert.equal(tierOf("ptcg", "", null).key, "tn", "no price → no tier frame");
// Magic thumbnails read the printing's price from the card object (Ba Sing Se $4.76 → green).
import { cardImage, img } from "./ui.js";
const basing = { name: "Ba Sing Se", prices: { usd: "4.76" }, image_uris: { normal: "https://example/ba.jpg" } };
assert.match(img(cardImage(basing), basing.name), /data-tier="t1"/);
assert.doesNotMatch(img("https://example/unknown.jpg", "x"), /data-tier/, "unknown price → no ring");
console.log("PASS: card thumbnails take their tier from that printing's own price.");
