import assert from "node:assert/strict";
import { mtgTags, ygoTags, ptcgTags, rankPairs, mtgPairQueries, edhPop } from "./pairing.js";
import { cardRules } from "./guide.js";

// Magic: an artifact payoff pairs with Treasure makers (gives) and is used by artifact payoffs.
const qs = { name: "Quicksmith Genius", type_line: "Creature — Human Artificer", cmc: 3, color_identity: ["R"], oracle_text: "Whenever an artifact you control enters, you may discard a card. If you do, draw a card." };
const T = mtgTags(qs);
assert.ok(T.needs.has("artifact") && T.provides.has("discard"));
const treasure = { name: "Big Score", type_line: "Instant", cmc: 4, oracle_text: "As an additional cost, discard a card. Draw two cards and create two Treasure tokens.", edhrec_rank: 400 };
const madness = { name: "Fiery Temper", type_line: "Instant", cmc: 3, keywords: ["Madness"], oracle_text: "Fiery Temper deals 3 damage to any target. Madness {R}" };
const vanilla = { name: "Gray Ogre", type_line: "Creature — Ogre", cmc: 3, oracle_text: "" };
const ranked = rankPairs("mtg", qs, [{ card: vanilla, pop: 2 }, { card: madness, pop: 0.5 }, { card: treasure, pop: edhPop(400) }]);
assert.deepEqual(ranked.map((r) => r.card.name), ["Big Score", "Fiery Temper"], "unrelated cards never make the list, however popular");
assert.match(ranked[0].reasons[0], /gives it artifacts/); assert.match(ranked[1].reasons[0], /uses its discarding/);
const q = mtgPairQueries(qs, T);
assert.equal(q[0].tag, "artifact"); assert.match(q[0].q, /id<=R/);
assert.ok(edhPop(1) > edhPop(5000) && edhPop(0) === 0);

// Yu-Gi-Oh!: a card naming "Dark Magician" pairs with it; same archetype scores.
const circle = { name: "Dark Magical Circle", category: "Spell", archetype: "Dark Magician", text: 'Excavate the top 3 cards of your Deck, add 1 "Dark Magician" or 1 Spell/Trap that mentions it. When "Dark Magician" is Normal or Special Summoned...' };
assert.ok(ygoTags(circle).needs.has("named:Dark Magician"));
const dm = { name: "Dark Magician", category: "Monster", attribute: "DARK", race: "Spellcaster", archetype: "Dark Magician", typeLine: "Normal Monster", text: "The ultimate wizard." };
const blue = { name: "Blue-Eyes White Dragon", category: "Monster", attribute: "LIGHT", race: "Dragon", archetype: "Blue-Eyes", text: "" };
const yr = rankPairs("ygo", circle, [{ card: blue }, { card: dm }]);
assert.deepEqual(yr.map((r) => r.card.name), ["Dark Magician"]); assert.ok(yr[0].reasons.some((r) => /named in its text/.test(r)) && yr[0].reasons.some((r) => /same archetype/.test(r)));

// Pokémon: Devolution Spray needs evolved Pokémon with evolve-trigger Abilities; Stage 2 lines link up.
const spray = { name: "Devolution Spray", category: "Trainer", typeLine: "Trainer · Item", effect: "Devolve 1 of your evolved Pokémon and put the highest Stage Evolution card on it into your hand. (That Pokémon can't evolve this turn.)" };
const ST = ptcgTags(spray);
assert.ok(ST.needs.has("evolution") && ST.needs.has("evolve_trigger"));
const kirlia = { name: "Kirlia", category: "Pokemon", stage: "Stage1", evolveFrom: "Ralts", types: ["Psychic"], abilities: [{ effect: "When you play this Pokémon from your hand to evolve 1 of your Pokémon during your turn, you may draw 2 cards." }], attacks: [] };
const ralts = { name: "Ralts", category: "Pokemon", stage: "Basic", types: ["Psychic"], attacks: [] };
const pr = rankPairs("ptcg", spray, [{ card: ralts }, { card: kirlia }]);
assert.deepEqual(pr.map((r) => r.card.name), ["Kirlia"]); assert.match(pr[0].reasons.join(" "), /evolve-trigger Abilities/);
const gard = { name: "Gardevoir ex", category: "Pokemon", stage: "Stage2", evolveFrom: "Kirlia", types: ["Psychic"], attacks: [{ cost: ["Psychic", "Psychic", "Colorless"] }] };
const candy = { name: "Rare Candy", category: "Trainer", typeLine: "Trainer · Item", effect: "Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon to evolve it, skipping the Stage 1." };
const gr = rankPairs("ptcg", gard, [{ card: candy }, { card: kirlia }, { card: { name: "Basic Psychic Energy", category: "Energy", energyType: "Normal" } }]);
assert.equal(gr[0].card.name, "Kirlia", "its own evolution line first"); assert.ok(gr.some((r) => r.card.name === "Rare Candy" && /Stage 2/.test(r.reasons.join(" "))));
assert.ok(gr.some((r) => r.card.name === "Basic Psychic Energy"), "Energy it needs for attacks");

// Lift and ownership add points (with reasons).
const lifted = rankPairs("mtg", qs, [{ card: treasure, lift: 40, share: 60, owned: true }])[0];
assert.match(lifted.reasons.join(" "), /60% of its lists.*you own it/);

// Rules: copies per format and turn rules.
const sprayFull = { ...spray, legal: { standard: false, expanded: true } };
const r = cardRules("ptcg", sprayFull);
assert.match(r.turn[0], /Item: play as many/);
assert.deepEqual(r.limits.map((x) => x[1]), ["Not legal", "Up to 4 with this name", "1 (singleton)"]);
assert.match(cardRules("ptcg", { name: "Iono", category: "Trainer", typeLine: "Trainer · Supporter", legal: { standard: true, expanded: true } }).turn[0], /only one per turn.*first turn/);
assert.match(cardRules("ptcg", { name: "Prime Catcher", category: "Trainer", typeLine: "Trainer · Item", aceSpec: true, legal: { standard: true, expanded: true } }).limits[0][1], /only 1 ACE SPEC/);
assert.equal(cardRules("ptcg", { name: "Charizard ex", category: "Pokemon", stage: "Stage2", ruleBox: true, legal: { standard: true, expanded: true } }).limits[2][1], "Not allowed (Rule Box)");
assert.equal(cardRules("ptcg", { name: "Basic Fire Energy", category: "Energy", basicEnergy: true, legal: { standard: true, expanded: true } }).limits[0][1], "Any number");
const ml = cardRules("mtg", { name: "Sol Ring", type_line: "Artifact", oracle_text: "{T}: Add {C}{C}.", legalities: { vintage: "restricted", legacy: "banned", commander: "legal", modern: "not_legal" } });
assert.deepEqual(Object.fromEntries(ml.limits), { Modern: "Not legal", Legacy: "Banned", Vintage: "1 (restricted)", Commander: "1 (singleton)" });
assert.equal(Object.fromEntries(cardRules("mtg", { name: "Relentless Rats", type_line: "Creature", oracle_text: "A deck can have any number of cards named Relentless Rats.", legalities: { modern: "legal" } }).limits).Modern, "Any number");
const yl = cardRules("ygo", { name: "Pot of Greed", category: "Spell", typeLine: "Normal Spell", ban: { tcg: "banned", ocg: "banned", goat: "limited" }, pools: [] });
assert.deepEqual(yl.limits.slice(0, 3).map((x) => x[1]), ["Forbidden", "Forbidden", "1 (Limited)"]);
// Loose links (any Evolution Pokémon) are kept in the "also works with" tier; gusting isn't switching.
const meta2 = { name: "Metapod", category: "Pokemon", stage: "Stage1", evolveFrom: "Caterpie", types: ["Grass"], attacks: [] };
const loose = rankPairs("ptcg", spray, [{ card: meta2 }]);
assert.equal(loose.length, 1); assert.equal(loose[0].fallback, true, "a generic Evolution Pokémon is a loose link");
assert.equal(ptcgTags({ name: "Boss's Orders", category: "Trainer", typeLine: "Trainer · Supporter", effect: "Switch in 1 of your opponent's Benched Pokémon to the Active Spot." }).provides.has("switching"), false);
assert.equal(ptcgTags({ name: "Switch", category: "Trainer", typeLine: "Trainer · Item", effect: "Switch your Active Pokémon with 1 of your Benched Pokémon." }).provides.has("switching"), true);
console.log("PASS: pairing — needs/provides tags per game, named cards & archetypes, evolution lines & evolve triggers, lift/owned reasons; rules — copies per format (banned/restricted/ACE SPEC/Rule Box/basics) and turn rules.");
