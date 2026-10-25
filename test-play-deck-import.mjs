import assert from "node:assert/strict";
import { parsePlayDeckImport, PLAY_DECK_IMPORT_LIMITS as limits } from "./play-deck-import.js";

const cards = (rows) => Object.fromEntries(rows.map(({ name, qty }) => [name, qty]));
let checks = 0;
function test(label, run) {
  run(); checks++; console.log(`ok ${checks} - ${label}`);
}

test("Arena export keeps commander, split card, main copies, sideboard and printing", () => {
  const parsed = parsePlayDeckImport(`Commander
1 Aragorn, the Uniter (LTR) 192

Deck
1 Commander's Sphere (CMM) 384
2 Swords to Plowshares (STA) 10
1 Fire // Ice (MH2) 290
24 Plains (M21) 260

Sideboard
1 Disenchant (M21) 14`);
  assert.deepEqual(cards(parsed.cards), {
    "Aragorn, the Uniter": 1, "Commander's Sphere": 1,
    "Swords to Plowshares": 2, "Fire // Ice": 1, Plains: 24,
  });
  assert.deepEqual(parsed.commanders, [{ name: "Aragorn, the Uniter", qty: 1 }]);
  assert.equal(parsed.commander, "Aragorn, the Uniter");
  assert.deepEqual(parsed.side, [{ name: "Disenchant", qty: 1 }]);
  assert.equal(parsed.rows[0].set, "LTR");
  assert.equal(parsed.rows[0].collectorNumber, "192");
  assert.equal(parsed.total, 29);
  assert.equal(parsed.sideTotal, 1);
  assert.equal(parsed.errors.length, 0);
});

test("copied markdown categories preserve both commanders and real names beginning with header words", () => {
  const parsed = parsePlayDeckImport(`# Commander (2)
1x Tymna the Weaver (C16) 48 [Commander]
1 xThrasios, Triton Hero (C16) 46 [Commander]
## Creatures (2)
Commander Eesha
1xBirds of Paradise
**Artifacts** (2)
Commander's Sphere
1Deck of Many Things
[Sideboard] (1)
Negate
### Creatures (1)
1 Commander Eesha
Maybeboard: (2)
2 Counterspell`);
  assert.deepEqual(parsed.commanders, [
    { name: "Tymna the Weaver", qty: 1 }, { name: "Thrasios, Triton Hero", qty: 1 },
  ]);
  assert.deepEqual(cards(parsed.cards), {
    "Tymna the Weaver": 1, "Thrasios, Triton Hero": 1, "Commander Eesha": 1,
    "Birds of Paradise": 1, "Commander's Sphere": 1, "Deck of Many Things": 1,
  });
  assert.deepEqual(cards(parsed.side), { Negate: 1, "Commander Eesha": 1 });
  assert.deepEqual(parsed.excludedCards, [{ name: "Counterspell", qty: 2 }]);
  assert.deepEqual(parsed.categoryCounts, { Creatures: 3, Artifacts: 2 });
  assert.equal(parsed.counts.main, 4);
  assert.equal(parsed.counts.commanders, 2);
  assert(parsed.warnings.some(({ code }) => code === "multiple_commanders"));
  assert.equal(parsed.warnings.filter(({ code }) => code === "category_count_mismatch").length, 0);
});

test("plain names and compact quantity variants aggregate without guessing a commander", () => {
  const parsed = parsePlayDeckImport(`1Sol Ring
1x Sol Ring
1 xSol Ring
1 x Sol Ring
Sol Ring
Commander Eesha
Commander's Sphere
Deck of Many Things
Definitely Not A Real Card`);
  assert.equal(cards(parsed.cards)["Sol Ring"], 5);
  assert.equal(parsed.commander, "");
  assert.deepEqual(parsed.commanders, []);
  assert(parsed.unresolved.some(({ name }) => name === "Definitely Not A Real Card"));
  assert(parsed.rows.every(({ nameVerified }) => nameVerified === false));
  assert.equal(parsed.errors.length, 0);
});

test("SB and explicit commander prefixes affect only that card row", () => {
  const parsed = parsePlayDeckImport(`Commander: Isshin, Two Heavens as One
1 Sol Ring
SB: 2 Negate
1 Arcane Signet
Companion: 1 Jegantha, the Wellspring
1 Plains`);
  assert.deepEqual(parsed.commanders, [{ name: "Isshin, Two Heavens as One", qty: 1 }]);
  assert.deepEqual(cards(parsed.side), { Negate: 2, "Jegantha, the Wellspring": 1 });
  assert.deepEqual(cards(parsed.cards), {
    "Isshin, Two Heavens as One": 1, "Sol Ring": 1, "Arcane Signet": 1, Plains: 1,
  });
});

test("MTGO blank-block sideboard rule survives quantity normalization", () => {
  const parsed = parsePlayDeckImport(`24 Island
16 Swamp

3x Negate
2 Duress`);
  assert.deepEqual(cards(parsed.cards), { Island: 24, Swamp: 16 });
  assert.deepEqual(cards(parsed.side), { Negate: 3, Duress: 2 });
  assert.equal(parsed.counts.all, 45);
  const small = parsePlayDeckImport(`4 Island\n\n1 Negate`);
  assert.equal(small.side.length, 0);
  assert.equal(small.total, 5);
  const explicit = parsePlayDeckImport(`Deck\n40 Island\n\n1 Negate`);
  assert.equal(explicit.side.length, 0);
});

test("recognized metadata is warned about; unknown names remain resolvable", () => {
  const parsed = parsePlayDeckImport(`Deck Name: Aragorn's fireworks
Format: Commander
Author: A player
https://www.moxfield.com/decks/example
// notes copied with the export
# Deck (3)
1 Commander Eesha
1 Commander's Sphere
1 Deck of Many Things
Unrecognized Deck Title`);
  assert.equal(parsed.warnings.filter(({ code }) => code === "ignored_metadata").length, 5);
  assert.equal(parsed.cards.length, 4);
  assert(parsed.unresolved.some(({ name }) => name === "Unrecognized Deck Title"));
  assert.equal(parsed.commanders.length, 0);
});

test("bad rows produce useful line errors while valid cards are retained", () => {
  const parsed = parsePlayDeckImport(`Deck
1 Sol Ring
-1 Island
1.5 Mountain
1e3 Swamp
0 Forest
9007199254740993 Plains
1001 Wastes
2 x
1 Arcane Signet`);
  assert.deepEqual(cards(parsed.cards), { "Sol Ring": 1, "Arcane Signet": 1 });
  assert.deepEqual(parsed.errors.map(({ line }) => line), [3, 4, 5, 6, 7, 8, 9]);
  assert(parsed.errors.every(({ reason, raw }) => reason && Array.isArray(raw)));
  assert.equal(parsePlayDeckImport("1Elvish Mystic").cards[0].name, "Elvish Mystic");
});

test("duplicate and total-copy limits reject rows, never clamp quantities", () => {
  const duplicate = parsePlayDeckImport("600 Island\n500 Island\n1 Sol Ring");
  assert.deepEqual(cards(duplicate.cards), { Island: 600, "Sol Ring": 1 });
  assert(duplicate.errors.some(({ code }) => code === "card_copy_limit"));
  const all = parsePlayDeckImport(Array.from({ length: 11 }, (_, index) => `1000 Unresolved Card ${index}`).join("\n"));
  assert.equal(all.counts.all, limits.copies);
  assert.equal(all.errors.length, 1);
  assert.equal(all.errors[0].code, "copy_limit");
});

test("oversized input is rejected in full instead of importing a truncated deck", () => {
  for (const value of ["a".repeat(limits.inputChars + 1), "1 Island\n".repeat(limits.rows + 1), "a".repeat(limits.lineChars + 1)]) {
    const parsed = parsePlayDeckImport(value);
    assert.equal(parsed.cards.length, 0);
    assert.equal(parsed.errors.length, 1);
    assert.equal(parsed.errors[0].fatal, true);
  }
  assert.equal(parsePlayDeckImport(null).errors[0].code, "invalid_input");
  assert.equal(parsePlayDeckImport("\n\n").errors[0].code, "empty_deck");
});

test("CSV preserves quoted comma names and defaults blank quantities", () => {
  const parsed = parsePlayDeckImport(`\uFEFFName,Quantity,Set code\r\n"Aragorn, the Uniter",1,LTR\r\n"Commander's Sphere",,CMM\r\nUnknown Card,2,ABC`);
  assert.deepEqual(cards(parsed.cards), { "Aragorn, the Uniter": 1, "Commander's Sphere": 1, "Unknown Card": 2 });
  assert.equal(parsed.rows[0].raw["Set code"], "LTR");
  assert.equal(parsed.commanders.length, 0);
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsePlayDeckImport("Name,Quantity\nSol Ring").cards, [{ name: "Sol Ring", qty: 1 }]);
  assert.equal(parsePlayDeckImport('Name,Quantity\n"Sol Ring,1').errors[0].code, "invalid_csv");
});

test("unsafe CSV quantities are isolated before delegating to the shared parser", () => {
  const parsed = parsePlayDeckImport("Name,Quantity,Finish\nSol Ring,1,foil\nIsland,1e3,normal\nMountain,-2,normal", {
    parseDeckImport(text) {
      assert(!text.includes("Island"));
      assert(!text.includes("Mountain"));
      return { source: "Collection CSV", mapping: { name: "Name" }, errors: [], rows: [
        { line: 2, name: "Sol Ring", qty: 1, finish: "foil", set: "CMM", raw: { Finish: "foil" } },
      ] };
    },
  });
  assert.deepEqual(parsed.cards, [{ name: "Sol Ring", qty: 1 }]);
  assert.equal(parsed.rows[0].finish, "foil");
  assert.equal(parsed.rows[0].set, "CMM");
  assert.equal(parsed.source, "Collection CSV");
  assert.deepEqual(parsed.errors.map(({ line }) => line), [3, 4]);
});

test("shared text parsing enriches safe rows without dropping unresolved cards", () => {
  const parsed = parsePlayDeckImport("## Commander (1)\n1xAragorn, the Uniter\nDeck\nSol Ring\nUnknown Card", {
    parseDeckImport(text) {
      assert(text.includes("Commander\n1 Aragorn, the Uniter"));
      return { source: "text", cards: [{ name: "Sol Ring", qty: 1 }], rows: [
        { line: 1, name: "Sol Ring", qty: 1, finish: "foil", nameVerified: true },
      ], errors: [{ line: 4, reason: "Unresolved parser row", raw: ["Unknown Card"] }] };
    },
  });
  assert.equal(parsed.rows.find(({ name }) => name === "Sol Ring").line, 4);
  assert.equal(parsed.rows.find(({ name }) => name === "Sol Ring").finish, "nonfoil");
  assert.equal(parsed.rows.find(({ name }) => name === "Sol Ring").nameVerified, false);
  assert(parsed.cards.some(({ name }) => name === "Unknown Card"));
  assert.equal(parsed.commander, "Aragorn, the Uniter");
  assert(parsed.warnings.some(({ code }) => code === "shared_parser_row"));
});

test("same-name printings keep their own set, finish and original row", () => {
  const parsed = parsePlayDeckImport("Deck\n1 Lightning Bolt (M11) 146\n1 Lightning Bolt (2XM) 141 *F*", {
    parseDeckImport() {
      return { cards: [{ name: "Lightning Bolt", qty: 2 }], rows: [
        { name: "Lightning Bolt", qty: 1, set: "M11", collectorNumber: "146", finish: "nonfoil", raw: { text: "first printing" } },
        { name: "Lightning Bolt", qty: 1, set: "2XM", collectorNumber: "141", finish: "foil", raw: { text: "second printing" } },
      ] };
    },
  });
  assert.deepEqual(parsed.cards, [{ name: "Lightning Bolt", qty: 2 }]);
  assert.deepEqual(parsed.rows.map(({ set, collectorNumber, finish, raw }) => [set, collectorNumber, finish, raw.text]), [
    ["M11", "146", "nonfoil", "1 Lightning Bolt (M11) 146"],
    ["2XM", "141", "foil", "1 Lightning Bolt (2XM) 141 *F*"],
  ]);
});

test("CSV board and section declarations retain sides and all commanders", () => {
  const input = 'Name,Quantity,Board\n"Tymna the Weaver",1,Commander\n"Thrasios, Triton Hero",1,Commander\nIsland,60,Mainboard\nNegate,3,Sideboard\nDuress,2,Maybeboard';
  const basic = parsePlayDeckImport(input);
  const delegated = parsePlayDeckImport(input, {
    parseDeckImport() {
      return { source: "Collection CSV", rows: [
        { line: 2, name: "Tymna the Weaver", qty: 1 },
        { line: 3, name: "Thrasios, Triton Hero", qty: 1 },
        { line: 4, name: "Island", qty: 60 },
        { line: 5, name: "Negate", qty: 3 },
        { line: 6, name: "Duress", qty: 2 },
      ] };
    },
  });
  for (const parsed of [basic, delegated]) {
    assert.equal(parsed.total, 62);
    assert.deepEqual(parsed.side, [{ name: "Negate", qty: 3 }]);
    assert.equal(parsed.commanders.length, 2);
    assert.deepEqual(parsed.excludedCards, [{ name: "Duress", qty: 2 }]);
    assert.equal(parsed.errors.length, 0);
  }
  const unknown = parsePlayDeckImport("Name,Count,Section\nSol Ring,1,Unrecognized board");
  assert.equal(unknown.total, 1);
  assert(unknown.warnings.some(({ code }) => code === "unknown_csv_section"));
});

test("count mismatches and parser failures stay reviewable", () => {
  const parsed = parsePlayDeckImport("Deck\nCreatures (5)\n1 Commander Eesha", {
    parseDeckImport() { throw Error("Could not parse the export"); },
  });
  assert.deepEqual(parsed.cards, [{ name: "Commander Eesha", qty: 1 }]);
  assert(parsed.warnings.some(({ code }) => code === "category_count_mismatch"));
  assert(parsed.warnings.some(({ code }) => code === "shared_parser_unavailable"));
  assert.throws(() => parsePlayDeckImport("1 Sol Ring", { parseDeckImport: true }), TypeError);
});

test("a parsed result is independent of prior calls and remains plain data", () => {
  const a = parsePlayDeckImport("Commander\n1 Aragorn, the Uniter\nDeck\n1 Sol Ring");
  const b = parsePlayDeckImport("1 Island");
  a.cards[0].qty = 999;
  assert.equal(b.total, 1);
  assert.equal(b.commander, "");
  assert.deepEqual(JSON.parse(JSON.stringify(b)), b);
});

console.log(`Play deck import: ${checks} checks passed`);
