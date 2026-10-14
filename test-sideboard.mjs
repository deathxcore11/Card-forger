// Magic sideboards: kept on import (Arena headings or MTGO blank line), exported under
// "Sideboard", limited to 15, and counted with the main deck for copy limits.
import assert from "node:assert/strict";
import { parseDeckImport } from "./deck-flow.js";
import { exportDeckText, validateDeck } from "./core.js";

const arena = parseDeckImport("Deck\n4 Lightning Bolt\n20 Mountain\n\nSideboard\n2 Pyroblast\n1 Lightning Bolt");
assert.deepEqual(arena.side, [{ name: "Pyroblast", qty: 2 }, { name: "Lightning Bolt", qty: 1 }]);
const mtgo = parseDeckImport("4 Lightning Bolt\n36 Mountain\n\n3 Pyroblast");
assert.equal(mtgo.side.reduce((a, r) => a + r.qty, 0), 3, "MTGO blank-line sideboard");
const cmd = parseDeckImport("Commander\n1 Lyra, Tolarian Archangel\nDeck\n99 Plains\nMaybeboard\n1 Sol Ring");
assert.equal(cmd.side.length, 0);
assert.equal(cmd.excluded, 1, "maybeboard still left out");

assert.equal(exportDeckText({ cards: [{ name: "Lightning Bolt", qty: 4 }], side: [{ name: "Pyroblast", qty: 2 }] }), "4 Lightning Bolt\n\nSideboard\n2 Pyroblast");
assert.equal(exportDeckText({ cards: [{ name: "Lightning Bolt", qty: 4 }] }), "4 Lightning Bolt");

const cat = {
  "lightning bolt": { name: "Lightning Bolt", type_line: "Instant", oracle_text: "Lightning Bolt deals 3 damage to any target.", legalities: { modern: "legal" } },
  mountain: { name: "Mountain", type_line: "Basic Land — Mountain", oracle_text: "", legalities: { modern: "legal" } },
  pyroblast: { name: "Pyroblast", type_line: "Instant", oracle_text: "Counter target spell if it's blue.", legalities: { modern: "not_legal" } },
};
const deck = { format: "Modern", cards: [{ name: "Lightning Bolt", qty: 4 }, { name: "Mountain", qty: 56 }], side: [{ name: "Lightning Bolt", qty: 1 }, { name: "Pyroblast", qty: 16 }] };
const v = validateDeck(deck, cat, [], []);
const t = v.issues.map((i) => i.text).join(" | ");
assert.match(t, /Sideboard has 17 cards; the limit is 15/);
assert.match(t, /Lightning Bolt: 5 copies across main deck and sideboard/);
assert.match(t, /Pyroblast \(sideboard\): not legal in Modern/);
assert.equal(v.count, 60, "sideboard isn't counted in the main deck");
console.log("PASS: Magic sideboards import, export and follow the 15-card and copy-limit rules.");
