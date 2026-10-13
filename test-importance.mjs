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

// Trends, trade advice, deck tally + swaps, card Meta tab, uniform tile layout.
{
  const { recordSnapshot, trendOf, tradeAdvice, deckEmblems, cardMetaUsage, cardMetaTab, impactScore } = await import("./importance.js");
  const day = 864e5, now = 100 * day;
  const old = new Map([["lightningbolt", { pct: 40 }], ["karnliberated", { pct: 30 }]]);
  let store = recordSnapshot("mtg", old, now - 7 * day, {});
  store = recordSnapshot("mtg", idx, now - 7 * day + 3600e3, store);
  assert.equal(store.mtg.length, 1, "one snapshot per day at most");
  const bolt = trendOf("mtg", { name: "Lightning Bolt" }, idx, store, now);
  assert.deepEqual(bolt, { delta: 20, days: 7 }, "Bolt went from 40% to 60%");
  assert.equal(trendOf("mtg", { name: "Lightning Bolt" }, idx, {}, now), null, "no history, no trend claim");
  const items = [
    { key: "bolt", name: "Lightning Bolt", card: { name: "Lightning Bolt" }, qty: 4, inDecks: 4, price: 2 },
    { key: "karn", name: "Karn Liberated", card: { name: "Karn Liberated" }, qty: 2, inDecks: 0, price: 20 },
    { key: "sol", name: "Sol Ring", card: { name: "Sol Ring", edhrec_rank: 1 }, qty: 3, inDecks: 1, price: 1 },
    { key: "mtn", name: "Mountain", card: { name: "Mountain" }, qty: 40, inDecks: 0, price: 0.1 },
  ];
  const adv = tradeAdvice("mtg", items, idx, store, now);
  assert.deepEqual(adv.rising.map((x) => x.name), ["Lightning Bolt"]);
  assert.deepEqual(adv.falling.map((x) => x.name), ["Karn Liberated"], "Karn fell 30% → 20% and is spare");
  assert.deepEqual(adv.bait.map((x) => x.name), ["Sol Ring"], "spare staples are trade bait; basics never");
  assert.equal(impactScore("mtg", { name: "Lightning Bolt" }, idx), 5);

  const deck = [{ key: "a", name: "Meh Creature", card: { name: "Meh Creature", type: "c" }, qty: 1 }, { key: "b", name: "Meh Spell", card: { name: "Meh Spell", type: "s" }, qty: 1 }, { key: "bolt", name: "Lightning Bolt", card: { name: "Lightning Bolt", type: "s" }, qty: 4 }];
  const spares = [{ key: "sol", name: "Sol Ring", card: { name: "Sol Ring", edhrec_rank: 1, type: "s" }, spare: 1 }, { key: "karn", name: "Karn Liberated", card: { name: "Karn Liberated", type: "s" }, spare: 2 }];
  const res = deckEmblems("mtg", deck, spares, { idx, sameSlot: (a, b) => a.type === b.type, fits: (c) => c.name !== "Karn Liberated" });
  assert.equal(res.tally.core, 4); assert.equal(res.tally.flex, 4);
  assert.deepEqual(res.swaps.map((s) => [s.out.name, s.in.name]), [["Meh Spell", "Sol Ring"]], "like-for-like swap, illegal cards skipped, staples never cut");

  const usage = cardMetaUsage("mtg", { name: "Karn Liberated" }, cached);
  assert.equal(usage.sets[0].lists, 4); assert.deepEqual(usage.sets[0].archetypes, [["Tron", 4]]);
  const html = cardMetaTab("mtg", { name: "Karn Liberated" }, usage, { deckAttrs: (s, d) => `data-k="${d.archetype}"`, buildAttrs: 'data-act="buildFrom"' });
  assert.match(html, /in 4 of 20 top lists · 20%/); assert.match(html, /Build decks around it/);
  assert.match(cardMetaTab("mtg", { name: "Nope" }, cardMetaUsage("mtg", { name: "Nope" }, cached), { deckAttrs: () => "", buildAttrs: "" }), /Not in recent top lists for Modern/);
}
{
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const { tileChrome } = await import("./tiles.js");
  const m = tileChrome("mtg", { name: "Niv-Mizzet Reborn", color_identity: ["W", "U", "B", "R", "G"], set: "war", rarity: "mythic" });
  assert.equal((m.match(/class="ms /g) || []).length, 3, "at most three type icons"); assert.match(m, /\+2/); assert.match(m, /r-mythic/);
  const p = tileChrome("ptcg", { game: "ptcg", name: "Squirtle", types: ["Water"], set: { id: "sv1", name: "Scarlet & Violet", number: "7" }, rarity: "Common" });
  assert.match(p, /tile-emb/); assert.match(p, /Water Energy/); assert.match(p, /tile-set/);
  const y = tileChrome("ygo", { game: "ygo", name: "Dark Magician", category: "Monster", attribute: "DARK", level: 7, sets: [{ code: "LOB-005", rarity: "Ultra Rare", name: "LOB" }] });
  assert.match(y, /tile-emb/); assert.match(y, /LOB/);
}
console.log("PASS: trends need history, trade advice (rising / bait / cooling), deck tally + like-for-like swaps, card Meta tab, uniform tile emblems.");
