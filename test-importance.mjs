import assert from "node:assert/strict";
import { buildIndex, importance, tileEmblem, emblemChips, isBasic, TIERS } from "./importance.js";

// 20 Modern lists: Bolt in 12 across 4 archetypes, a combo piece in 3 of one archetype, a basic in all.
const deck = (arch, cards) => ({ archetype: arch, main: [...cards.map((name) => ({ qty: 4, name })), { qty: 4, name: "Mountain", land: true }] });
const decks = [];
for (let i = 0; i < 20; i++) {
  const arch = ["Burn", "Prowess", "Boros", "Jund", "Tron"][i % 5];
  const cards = ["Filler " + i];
  if (i < 12) cards.push("Lightning Bolt");
  if (arch === "Tron" ) cards.push("Karn Liberated");
  if (i === 0) cards.push("Rare Tech");
  decks.push(deck(arch, cards));
}
const cached = { "mtg:Modern": { at: 1, data: { format: "Modern", decks } } };
const idx = buildIndex("mtg", cached);
const kinds = (name, extra = {}) => importance("mtg", { name, ...extra }, idx).map((b) => b.kind);
assert.deepEqual(kinds("Lightning Bolt"), ["core", "flex"], "60% of lists in 4 archetypes: meta staple + flexible staple");
assert.match(importance("mtg", { name: "Lightning Bolt" }, idx)[0].detail, /60% of recent Modern top lists/);
assert.deepEqual(kinds("Karn Liberated"), ["meta"], "20% in one archetype: meta card, not flexible");
assert.deepEqual(kinds("Rare Tech"), ["played"], "one list: tournament played");
assert.deepEqual(kinds("Mountain"), [], "basic lands never get emblems");
assert.deepEqual(kinds("Sol Ring", { edhrec_rank: 1 }), ["edh"], "EDHREC top 250 is a Commander staple");
assert.deepEqual(kinds("Obscure", { edhrec_rank: 9000 }), []);
assert.equal(isBasic("Basic Fire Energy"), true); assert.equal(isBasic("Fire Energy"), true); assert.equal(isBasic("Double Turbo Energy"), false);
// Too little data (under the minimum lists) gives no meta claims.
assert.equal(buildIndex("mtg", { "mtg:Pauper": { data: { format: "Pauper", decks: decks.slice(0, TIERS.minDecks - 1) } } }).size, 0);

// Pokémon by name, Yu-Gi-Oh! by passcode (and YGOPRODeck's own most-played figure when higher).
const pidx = buildIndex("ptcg", { ptcg: { data: { decks: Array.from({ length: 10 }, (_, i) => ({ name: i < 5 ? "Gardevoir ex" : "Charizard ex", list: [{ name: "Ultra Ball", kind: "Trainer", qty: 4 }, { name: "Basic Psychic Energy", kind: "Energy", qty: 8 }, ...(i < 5 ? [{ name: "Gardevoir ex", kind: "Pokemon", qty: 2 }] : [])] })) } } });
assert.equal(importance("ptcg", { name: "Ultra Ball" }, pidx)[0].kind, "core");
assert.equal(importance("ptcg", { name: "Basic Psychic Energy" }, pidx).length, 0);
const yidx = buildIndex("ygo", { ygo: { data: { decks: Array.from({ length: 10 }, (_, i) => ({ name: "Deck " + (i % 3), main: ["14558127", i < 2 ? "1" : "2"], extra: [] })), top: [{ id: "1", pct: 40 }] } } });
assert.deepEqual(importance("ygo", { id: "14558127", name: "Ash Blossom & Joyous Spring" }, yidx).map((b) => b.kind), ["core", "flex"]);
assert.equal(importance("ygo", { id: "1", name: "X" }, yidx)[0].kind, "core", "YGOPRODeck's 40% beats 2 of 10 lists");

// Rendering: one seal on tiles (played-only stays quiet), explained chips on the sheet, escaped.
assert.equal(tileEmblem("mtg", { name: "Rare Tech" }), "", "no tile seal for played-only cards");
assert.match(tileEmblem("mtg", { name: "Sol Ring", edhrec_rank: 3 }), /imp-edh/);
assert.match(emblemChips("mtg", { name: "Sol Ring", edhrec_rank: 3 }), /Commander staple.*#3 most played on EDHREC/);
console.log("PASS: emblems — meta staple / meta card / flexible / Commander / played tiers, basics excluded, minimum data, per-game keys.");
