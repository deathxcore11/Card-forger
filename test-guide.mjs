import assert from "node:assert/strict";
import { playGuide, playedAlongside, guideHtml, mtgComplementQuery } from "./guide.js";

// Magic: Quicksmith Genius — artifact trigger + looting, a 3-mana creature.
const qs = { name: "Quicksmith Genius", type_line: "Creature — Human Artificer", cmc: 3, power: "3", color_identity: ["R"], keywords: [], oracle_text: "Whenever an artifact you control enters, you may discard a card. If you do, draw a card." };
const g = playGuide("mtg", qs);
assert.deepEqual(g.roles.map((r) => r.id), ["loot", "artifacts"]);
assert.match(g.tips[0], /Costs 3 mana — usually played around turn 3/);
const q = mtgComplementQuery(qs, g);
assert.equal(q.label, "Artifacts", "the artifact trigger is the main synergy"); assert.match(q.q, /id<=R/); assert.match(q.q, /-!"Quicksmith Genius"/);
const bolt = playGuide("mtg", { name: "Lightning Bolt", type_line: "Instant", cmc: 1, oracle_text: "Lightning Bolt deals 3 damage to any target." });
assert.deepEqual(bolt.roles.map((r) => r.id), ["removal"]); assert.match(bolt.tips[0], /^Instant/);
assert.match(playGuide("mtg", { name: "X", type_line: "Creature", cmc: 2, keywords: ["Flying", "Haste"], oracle_text: "Flying, haste" }).tips.join(" "), /Flying —.*Haste —/);
assert.equal(playGuide("mtg", { name: "Counterspell", type_line: "Instant", cmc: 2, oracle_text: "Counter target spell." }).roles[0].id, "counter");

// Yu-Gi-Oh!: Ash Blossom is a hand trap that negates.
const ash = playGuide("ygo", { name: "Ash Blossom & Joyous Spring", category: "Monster", typeLine: "Tuner Effect Monster", level: 3, atk: 0, text: "When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect. You can only use this effect of \"Ash Blossom & Joyous Spring\" once per turn." });
assert.deepEqual(ash.roles.map((r) => r.id).slice(0, 2), ["handtrap", "negate"]); assert.match(ash.tips.join(" "), /Tuner/);
assert.match(playGuide("ygo", { category: "Monster", level: 8, text: "" }).tips[0], /two Tributes/);

// Pokémon: a Stage 2 ex with a search ability and a heavy retreat.
const pk = playGuide("ptcg", { name: "Dragapult ex", category: "Pokemon", stage: "Stage2", evolveFrom: "Drakloak", retreat: 1, abilities: [], attacks: [{ name: "Phantom Dive", cost: ["Fire", "Psychic"], damage: 200, effect: "Put 6 damage counters on your opponent's Benched Pokémon in any way you like." }] });
assert.match(pk.tips.join(" "), /Rule Box/); assert.match(pk.tips.join(" "), /Rare Candy/); assert.match(pk.tips.join(" "), /2 Energy for 200 damage/);
const tr = playGuide("ptcg", { name: "Crispin", category: "Trainer", typeLine: "Trainer · Supporter", effect: "Search your deck for up to 2 Basic Energy of different types, reveal them, and put 1 of them into your hand. Attach the other to 1 of your Pokémon. Then, shuffle your deck." });
assert.deepEqual(tr.roles.map((r) => r.id), ["search", "accel"]); assert.match(tr.tips[0], /one per turn/);

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
assert.match(html, /How and when to play it/); assert.match(html, /Played alongside it/); assert.match(html, /Rare Candy/); assert.match(html, /not expert strategy/);
assert.doesNotMatch(guideHtml("mtg", { name: "<b>" }, { roles: [], tips: ["a <script>"] }, {}), /<script>/);
console.log("PASS: play guide — roles, timing and keyword tips (Magic), hand traps & tributes (Yu-Gi-Oh!), evolution/Rule Box/Supporter (Pokémon), played-alongside, escaping.");
