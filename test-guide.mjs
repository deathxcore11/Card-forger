import assert from "node:assert/strict";
import { playGuide, playedAlongside, guideHtml, mtgComplementQuery } from "./guide.js";

// Magic: Quicksmith Genius — artifact trigger + looting, a 3-mana creature.
const qs = { name: "Quicksmith Genius", type_line: "Creature — Human Artificer", cmc: 3, power: "3", color_identity: ["R"], keywords: [], oracle_text: "Whenever an artifact you control enters, you may discard a card. If you do, draw a card." };
const g = playGuide("mtg", qs);
assert.deepEqual(g.roles.map((r) => r.id), ["loot", "artifacts"]);
assert.match(g.tips[0], /Costs 3 mana — castable on turn 3/);
const q = mtgComplementQuery(qs, g);
assert.equal(q.label, "Artifacts", "the artifact trigger is the main synergy"); assert.match(q.q, /id<=R/); assert.match(q.q, /-!"Quicksmith Genius"/);
const bolt = playGuide("mtg", { name: "Lightning Bolt", type_line: "Instant", cmc: 1, oracle_text: "Lightning Bolt deals 3 damage to any target." });
assert.deepEqual(bolt.roles.map((r) => r.id), ["removal"]); assert.ok(!bolt.tips.some((t) => /^Instant/.test(t)), "casting speed is listed once, under Rules & legality");
assert.match(playGuide("mtg", { name: "X", type_line: "Creature", cmc: 2, keywords: ["Flying", "Haste"], oracle_text: "Flying, haste" }).tips.join(" "), /Flying —.*Haste —/);
assert.equal(playGuide("mtg", { name: "Counterspell", type_line: "Instant", cmc: 2, oracle_text: "Counter target spell." }).roles[0].id, "counter");

// Yu-Gi-Oh!: Ash Blossom is a hand trap that negates.
const ash = playGuide("ygo", { name: "Ash Blossom & Joyous Spring", category: "Monster", typeLine: "Tuner Effect Monster", level: 3, atk: 0, text: "When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect. You can only use this effect of \"Ash Blossom & Joyous Spring\" once per turn." });
assert.deepEqual(ash.roles.map((r) => r.id).slice(0, 2), ["handtrap", "negate"]); assert.match(ash.tips.join(" "), /Tuner/);
assert.match(playGuide("ygo", { category: "Monster", level: 8, text: "" }).tips[0], /two Tributes/);
assert.match(playGuide("ygo", { category: "Monster", level: 8, text: "Cannot be Normal Summoned/Set. Must be Special Summoned by a card effect." }).tips[0], /Can't be Normal Summoned/);

// Pokémon: a Stage 2 ex with a search ability and a heavy retreat.
const pk = playGuide("ptcg", { name: "Dragapult ex", category: "Pokemon", stage: "Stage2", evolveFrom: "Drakloak", retreat: 1, abilities: [], attacks: [{ name: "Phantom Dive", cost: ["Fire", "Psychic"], damage: 200, effect: "Put 6 damage counters on your opponent's Benched Pokémon in any way you like." }] });
assert.match(pk.tips.join(" "), /Multi-Prize/); assert.match(pk.tips.join(" "), /Rare Candy/); assert.doesNotMatch(pk.tips.join(" "), /costs 2 Energy/, "a 2-Energy attack needs no planning warning");
const tr = playGuide("ptcg", { name: "Crispin", category: "Trainer", typeLine: "Trainer · Supporter", effect: "Search your deck for up to 2 Basic Energy of different types, reveal them, and put 1 of them into your hand. Attach the other to 1 of your Pokémon. Then, shuffle your deck." });
assert.deepEqual(tr.roles.map((r) => r.id), ["search", "accel"]); assert.equal(tr.tips.length, 0, "Supporter limits are listed once, under Rules & legality");

// Played alongside: share among lists that run the card; basics left out.
const cached = { ptcg: { data: { decks: [
  { list: [{ name: "Crispin" }, { name: "Rare Candy" }, { name: "Basic Fire Energy" }] },
  { list: [{ name: "Crispin" }, { name: "Rare Candy" }, { name: "Buddy-Buddy Poffin" }] },
  { list: [{ name: "Rare Candy" }] },
] } } };
const al = playedAlongside("ptcg", { name: "Crispin" }, cached);
assert.equal(al.lists, 2); assert.deepEqual(al.cards.map((x) => [x.name, x.share]), [["Rare Candy", 100]], "one-off cards are left out once there are 2+ lists");
// Lift: a partner only played next to this card beats a staple every deck plays.
const lift = { ptcg: { data: { decks: [
  ...Array.from({ length: 4 }, () => ({ list: [{ name: "Crispin" }, { name: "Dreepy" }, { name: "Ultra Ball" }] })),
  ...Array.from({ length: 6 }, () => ({ list: [{ name: "Ultra Ball" }, { name: "Pikachu" }] })),
] } } };
assert.deepEqual(playedAlongside("ptcg", { name: "Crispin" }, lift).cards.map((x) => x.name), ["Dreepy", "Ultra Ball"]);

const html = guideHtml("ptcg", { name: "Crispin" }, tr, { alongside: al, alongsideAttrs: () => "", alongsideName: (x) => x.name, complements: [], complementsLoading: false, complementsNote: "x" });
assert.match(html, /How to play it/); assert.match(html, /Played alongside it/); assert.match(html, /Rare Candy/);
assert.doesNotMatch(guideHtml("mtg", { name: "<b>" }, { roles: [], tips: ["a <script>"] }, {}), /<script>/);
// Structural roles: every Pokémon gets its battlefield job; vanilla cards and Energy get roles.
assert.equal(playGuide("ptcg", { name: "Charizard ex", category: "Pokemon", stage: "Stage2", attacks: [{ name: "Burning Darkness", cost: ["Fire", "Fire"], damage: "180+" }], abilities: [{ name: "Infernal Reign", effect: "When you play this Pokémon from your hand to evolve 1 of your Pokémon during your turn, you may search your deck for up to 3 Basic Fire Energy cards and attach them to your Pokémon in any way you like. Then, shuffle your deck." }] }).roles[0].label, "Main attacker");
assert.equal(playGuide("ptcg", { name: "Pidgey", category: "Pokemon", stage: "Basic", retreat: 1, attacks: [{ name: "Gust", damage: "10" }] }).roles[0].id, "pivot");
assert.equal(playGuide("ptcg", { name: "Fire Energy", category: "Energy", basicEnergy: true }).roles[0].label, "Basic Energy");
assert.equal(playGuide("ygo", { name: "Blue-Eyes White Dragon", category: "Monster", typeLine: "Normal Monster", level: 8, atk: 3000, text: "" }).roles[0].label, "Normal monster");
assert.equal(playGuide("mtg", { name: "Ordinary Bear", type_line: "Creature — Bear", cmc: 2, power: "2", toughness: "2", oracle_text: "" }).roles[0].label, "Creature");
assert.equal(playGuide("mtg", { name: "Chaos Warp", type_line: "Instant", cmc: 3, oracle_text: "The owner of target permanent shuffles it into their library, then reveals the top card of their library." }).roles[0].id, "removal");
assert.deepEqual(playGuide("ptcg", { name: "Devolution Spray", category: "Trainer", typeLine: "Trainer · Item", effect: "Devolve 1 of your evolved Pokémon and put the highest Stage Evolution card on it into your hand. (That Pokémon can't evolve this turn.)" }).roles.map((r) => r.id), ["devolve"]);
// Accuracy: Turtonator's only 80-damage attack costs 3 Energy, so it is not an "early attacker".
const turt = playGuide("ptcg", { name: "Turtonator", category: "Pokemon", stage: "Basic", retreat: 3, abilities: [], attacks: [{ name: "Heat Crash", cost: ["Fire", "Colorless", "Colorless"], damage: "80" }] });
assert.equal(turt.roles[0].label, "Attacker"); assert.match(turt.roles[0].what, /“Heat Crash” does 80 for 3 Energy/); assert.match(turt.tips.join(" "), /costs 3 Energy \(80 damage\)/); assert.match(turt.tips.join(" "), /Retreat cost 3/);
assert.doesNotMatch(turt.tips.join(" "), /Basic Pokémon —/, "Bench rules are listed once, under Rules & legality");
// "20+" is a floor, never a cap.
const plusle = playGuide("ptcg", { name: "Plusle", category: "Pokemon", stage: "Basic", retreat: 1, attacks: [{ name: "Spark Duo", cost: ["Colorless"], damage: "20+" }] });
assert.doesNotMatch(JSON.stringify(plusle), /up to 20/); assert.match(plusle.roles[0].what, /a 1-Energy retreat/);
// */* creatures get no invented stats.
assert.match(playGuide("mtg", { name: "Tarmogoyf", type_line: "Creature — Lhurgoyf", cmc: 2, power: "*", toughness: "1+*", oracle_text: "Tarmogoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1." }).roles[0].what, /\*\/1\+\*/);
console.log("PASS: play guide — roles, timing and keyword tips (Magic), hand traps & tributes (Yu-Gi-Oh!), evolution/Rule Box/Supporter (Pokémon), played-alongside, escaping.");
