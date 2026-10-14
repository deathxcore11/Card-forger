import assert from "node:assert/strict";
import { ptcgProduct, sameSubtype } from "./ptcg-product.js";
// BREAKthrough-era: product only on the per-finish price block (Parasect).
const parasect = { variants_detailed: [{ type: "normal" }], pricing: { tcgplayer: { normal: { productId: 107121 }, "reverse-holofoil": { productId: 107121 } } } };
assert.deepEqual(ptcgProduct(parasect, "normal"), { productId: 107121, finishKey: "normal", subtype: "Normal" });
assert.equal(ptcgProduct(parasect, "reverse-holofoil").subtype, "Reverse Holofoil");
assert.equal(ptcgProduct(parasect, "reference").finishKey, "normal");
assert.equal(ptcgProduct(parasect, "holofoil"), null, "no invented finish");
// Plain printing wins the reference when stamped versions are separate products (Space Center).
const space = { variants_detailed: [{ type: "reverse", stamp: ["set-logo"], thirdParty: { tcgplayer: 89434 } }, { type: "normal", thirdParty: { tcgplayer: 89434 } }, { type: "normal", stamp: ["10th-anniversary"], thirdParty: { tcgplayer: 286613 } }] };
assert.equal(ptcgProduct(space, "reference").productId, 89434);
// Two unmarked holo products stay ambiguous.
assert.equal(ptcgProduct({ variants_detailed: [{ type: "holo", thirdParty: { tcgplayer: 1 } }, { type: "holo", thirdParty: { tcgplayer: 2 } }] }, "reference"), null);
assert.ok(sameSubtype("1st Edition Normal", "1st Edition") && sameSubtype("reverse holofoil", "Reverse Holofoil") && !sameSubtype("Holofoil", "Reverse Holofoil"));
console.log("PASS: Pokémon price history resolves one exact product and finish, including older sets priced per finish.");
