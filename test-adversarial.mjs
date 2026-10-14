// Adversarial Deck Power checks: decks built to fool each game's scorer must not rate well.
// Each game is attacked with its own failure modes (no way to win, cards that can't work
// with the rest of the list, staples with no engine, Extra Decks you can't summon, matching
// a tournament deck on generic staples alone).
import assert from "node:assert/strict";
import { mtgConstructedPower, ygoPower, ptcgPower, metaMatch } from "./deckpower.js";

const out = [];
const report = (game, name, score, max) => { out.push(`${game} · ${name}: ${score} (must be ≤ ${max})`); return score <= max; };
const fails = [];
const check = (game, name, score, max) => { if (!report(game, name, score, max)) fails.push(`${game} · ${name}: ${score} > ${max}`); };

/* ---------- Magic ---------- */
const key = (s) => String(s).toLowerCase(), cat = {};
const mc = (name, cmc, type_line, oracle_text = "", extra = {}) => (cat[key(name)] = { name, cmc, type_line, oracle_text, mana_cost: extra.mana_cost ?? "{" + Math.max(0, cmc - 1) + "}{R}", ...extra });
mc("Mountain", 0, "Basic Land — Mountain", "", { produced_mana: ["R"], mana_cost: "" });
mc("Island", 0, "Basic Land — Island", "", { produced_mana: ["U"], mana_cost: "" });
for (let i = 0; i < 9; i++) mc("Vanilla " + i, 2 + (i % 2), "Creature — Bear", "", { power: "2", toughness: "1" });
for (let i = 0; i < 9; i++) mc("Removal " + i, 2, "Instant", "Destroy target creature.");
for (let i = 0; i < 4; i++) mc("Shock " + i, 1, "Instant", "Shock deals 2 damage to any target.");
for (let i = 0; i < 9; i++) mc("Blue Bird " + i, 2, "Creature — Bird", "Flying. When this creature enters, draw a card.", { power: "2", toughness: "2", mana_cost: "{1}{U}" });
const mdeck = (rows) => ({ format: "Standard", cards: rows.map(([name, qty]) => ({ name, qty })) });
const M = (rows) => mtgConstructedPower(mdeck(rows), cat, key, 60).score;
// 1. Vanilla bears: perfect curve, 4-ofs, right land count, and nothing else.
check("Magic", "36 vanilla 2/1s", M([["Mountain", 24], ...Array.from({ length: 9 }, (_, i) => ["Vanilla " + i, 4])]), 62);
// 2. All removal, nothing that wins.
check("Magic", "36 removal spells, no threats", M([["Mountain", 24], ...Array.from({ length: 9 }, (_, i) => ["Removal " + i, 4])]), 60);
// 3. Blue spells with only Mountains: the deck can't cast a spell.
check("Magic", "blue deck with only Mountains", M([["Mountain", 24], ...Array.from({ length: 9 }, (_, i) => ["Blue Bird " + i, 4])]), 45);

// 4. Gavin Verhey's example: an aggressive deck playing life gain and board wipes instead of
//    burn (Ritual of Rejuvenation over Lightning Strike) works against its own plan.
mc("Plains", 0, "Basic Land — Plains", "", { produced_mana: ["W"], mana_cost: "" });
for (let i = 0; i < 5; i++) mc("Raider " + i, 1 + (i % 2), "Creature — Human Warrior", "Haste. Whenever this creature attacks, it gets +1/+0 until end of turn.", { power: "2", toughness: "1" });
mc("Ritual of Rejuvenation", 3, "Instant", "You gain 4 life. Draw a card.".replace(" Draw a card.", ""), { mana_cost: "{2}{W}" });
mc("Heal Up", 2, "Sorcery", "You gain 5 life.", { mana_cost: "{1}{W}" });
mc("Wrath", 4, "Sorcery", "Destroy all creatures.", { mana_cost: "{2}{W}{W}" });
mc("Lightning Strike", 2, "Instant", "Lightning Strike deals 3 damage to any target.");
const rw = (extra) => M([["Mountain", 11], ["Plains", 11], ...Array.from({ length: 5 }, (_, i) => ["Raider " + i, 4]), ...extra]);
const focused = rw([["Lightning Strike", 4], ["Shock 0", 4], ["Shock 1", 4], ["Shock 2", 4], ["Shock 3", 2]]);
const conflicted = rw([["Ritual of Rejuvenation", 4], ["Heal Up", 4], ["Wrath", 4], ["Lightning Strike", 4], ["Shock 0", 2]]);
check("Magic", "aggro deck full of life gain and wraths", conflicted, Math.min(64, focused - 15));
out.push(`Magic · same aggro deck with burn instead: ${focused}`);
// 5. Tribal payoffs without the tribe (below critical mass).
for (let i = 0; i < 3; i++) mc("Elf Lord " + i, 2, "Creature — Elf Warrior", "Other Elves you control get +1/+1.", { power: "2", toughness: "2", mana_cost: "{1}{G}" });
for (let i = 0; i < 6; i++) mc("Bear " + i, 2, "Creature — Bear", "Trample. When this creature enters, put a +1/+1 counter on target creature.", { power: "2", toughness: "2", mana_cost: "{1}{G}" });
for (let i = 0; i < 4; i++) mc("Elf Kin " + i, 1, "Creature — Elf Druid", "{T}: Add {G}. Whenever another Elf you control enters, scry 1.", { power: "1", toughness: "1", mana_cost: "{G}" });
mc("Forest", 0, "Basic Land — Forest", "", { produced_mana: ["G"], mana_cost: "" });
const lords = M([["Forest", 24], ["Elf Lord 0", 4], ["Elf Lord 1", 4], ...Array.from({ length: 6 }, (_, i) => ["Bear " + i, 4]), ["Elf Kin 0", 4]]);
const dense = M([["Forest", 18], ...Array.from({ length: 3 }, (_, i) => ["Elf Lord " + i, 4]), ...Array.from({ length: 4 }, (_, i) => ["Elf Kin " + i, 4]), ["Bear 0", 4], ["Bear 1", 2], ["Bear 2", 4]]);
check("Magic", "Elf payoffs with too few Elves", lords, Math.min(66, dense - 8));
out.push(`Magic · same deck with 28 Elves: ${dense}`);

/* ---------- Yu-Gi-Oh! ---------- */
const yc = (name, category, text, extra = {}) => ({ name, category, text, ...extra });
const ash = yc("Ash Blossom & Joyous Spring", "Monster", "(Quick Effect): You can discard this card; negate that effect.", { level: 3 });
const imperm = yc("Infinite Impermanence", "Trap", "Target 1 face-up monster your opponent controls; negate its effects. If this card is in your hand, you can activate it during your opponent's turn (Quick Effect).");
const ghost = yc("Ghost Ogre & Snow Rabbit", "Monster", "(Quick Effect): You can send this card from your hand to the GY; destroy that card.", { level: 3 });
const duster = yc("Harpie's Feather Duster", "Spell", "Destroy all Spells and Traps your opponent controls.");
const storm = yc("Lightning Storm", "Spell", "Destroy all face-up monsters your opponent controls.");
const pot = yc("Pot of Prosperity", "Spell", "Banish 3 or 6 cards from your Extra Deck, face-down; draw 2 cards.");
const terra = yc("Terraforming", "Spell", "Add 1 Field Spell from your Deck to your hand.");
const rota = yc("Reinforcement of the Army", "Spell", "Add 1 Level 4 or lower Warrior monster from your Deck to your hand.");
const sb = (i) => yc("Searcher " + i, "Monster", `If this card is Normal Summoned: You can add 1 "Ghost Archetype" monster from your Deck to your hand.`, { level: 4, archetype: "Searcher" });
const xyz = (i) => yc("Rank 8 Xyz " + i, "Monster", "2 Level 8 monsters. Once per turn: detach 1 material; destroy 1 card.", { extra: true, typeLine: "XYZ Monster" });
const fus = (i) => yc("Fusion " + i, "Monster", `"Dragon A" + "Dragon B". Must be Fusion Summoned.`, { extra: true, typeLine: "Fusion Monster" });
const Y = (main, extra = [], side = 0) => ygoPower([...main.map(([c, qty]) => ({ zone: "main", qty, c })), ...extra.map(([c, qty]) => ({ zone: "extra", qty, c })), ...(side ? [{ zone: "side", qty: side, c: ash }] : [])], { name: "Advanced", main: [40, 60], extra: 15, side: 15 }).score;
// 4. A pile of hand traps and staples with no engine to play.
check("Yu-Gi-Oh!", "hand traps and staples, no engine", Y([[ash, 3], [imperm, 3], [ghost, 3], [duster, 1], [storm, 1], [pot, 3], ...Array.from({ length: 13 }, (_, i) => [yc("Vanilla " + i, "Monster", "A normal monster.", { level: 4 }), 2]), [yc("Filler", "Monster", "", { level: 4 }), 0]].filter(([, q]) => q), Array.from({ length: 15 }, (_, i) => [xyz(i), 1]), 15), 55);
// 5. Searchers that search for cards the deck doesn't run (dead "starters").
check("Yu-Gi-Oh!", "searchers with nothing to search", Y([...Array.from({ length: 5 }, (_, i) => [sb(i), 3]), [terra, 3], [rota, 3], [ash, 3], [imperm, 3], [ghost, 3], [duster, 1], [storm, 1], ...Array.from({ length: 3 }, (_, i) => [yc("Normal " + i, "Monster", "A normal monster.", { level: 4, race: "Spellcaster", attribute: "DARK" }), 3])], Array.from({ length: 15 }, (_, i) => [fus(i), 1]), 15), 60);
// 6. Extra Deck full of Rank 8s with no Level 8 monster to make them.
const engine = Array.from({ length: 6 }, (_, i) => [yc("Engine " + i, "Monster", `Add 1 "Engine" card from your Deck to your hand. You can Special Summon this card from your hand.`, { level: 4, archetype: "Engine" }), 3]);
const xyzHeavy = Y([...engine, [yc("Engine Xyz Spell", "Spell", "Xyz Summon 1 Xyz Monster using monsters you control.", { archetype: "Engine" }), 2], [ash, 3], [imperm, 3], [ghost, 3], [duster, 1], [storm, 1], [pot, 2], [yc("Engine Field", "Spell", `Add 1 "Engine" monster from your Deck to your hand.`, { archetype: "Engine", typeLine: "Field Spell" }), 2]], Array.from({ length: 15 }, (_, i) => [xyz(i), 1]), 15);
check("Yu-Gi-Oh!", "Rank 8 Extra Deck, Level 4 main deck", xyzHeavy, 75);

/* ---------- Pokémon ---------- */
const pk = (name, extra) => ({ name, ...extra });
const trainers = [
  [pk("Ultra Ball", { category: "Trainer", text: "Discard 2 cards from your hand. Search your deck for a Pokémon." }), 4],
  [pk("Nest Ball", { category: "Trainer", text: "Search your deck for a Basic Pokémon and put it onto your Bench." }), 4],
  [pk("Iono", { category: "Trainer", text: "Each player shuffles their hand and puts it on the bottom of their deck. Then each player draws a card for each of their remaining Prize cards." }), 4],
  [pk("Professor's Research", { category: "Trainer", text: "Discard your hand and draw 7 cards." }), 4],
  [pk("Lillie's Determination", { category: "Trainer", text: "Shuffle your hand into your deck. Then, draw 6 cards." }), 4],
  [pk("Boss's Orders", { category: "Trainer", text: "Switch in 1 of your opponent's Benched Pokémon to the Active Spot." }), 3],
  [pk("Night Stretcher", { category: "Trainer", text: "Put a Pokémon or a Basic Energy card from your discard pile into your hand." }), 3],
  [pk("Switch", { category: "Trainer", text: "Switch your Active Pokémon with 1 of your Benched Pokémon." }), 2],
  [pk("Buddy-Buddy Poffin", { category: "Trainer", text: "Search your deck for up to 2 Basic Pokémon with 70 HP or less." }), 4],
];
const PT = (rows) => ptcgPower(rows.map(([c, qty]) => ({ qty, c })), { name: "Standard" }).score;
// 7. A real attacker that can never attack: Fire costs, only Water Energy.
check("Pokémon", "Fire attacker with only Water Energy", PT([[pk("Charmander", { category: "Pokemon", basicPokemon: true, stage: "Basic", attackCosts: ["Fire"], attacks: [{ cost: ["Fire"], damage: "10" }] }), 4], [pk("Charmeleon", { category: "Pokemon", stage: "Stage1", evolveFrom: "Charmander", attackCosts: ["Fire"], attacks: [{ cost: ["Fire", "Fire"], damage: "50" }] }), 3], [pk("Charizard ex", { category: "Pokemon", stage: "Stage2", evolveFrom: "Charmeleon", ruleBox: true, attackCosts: ["Fire"], attacks: [{ cost: ["Fire", "Fire"], damage: "250" }] }), 3], [pk("Rare Candy", { category: "Trainer" }), 4], [pk("Pidgey", { category: "Pokemon", basicPokemon: true, stage: "Basic", attacks: [{ cost: ["Colorless"], damage: "10" }] }), 2], ...trainers, [pk("Basic Water Energy", { category: "Energy", basicEnergy: true }), 12]]), 55);
check("Pokémon", "every attacker needs Energy the deck doesn't run", PT([[pk("Charmander", { category: "Pokemon", basicPokemon: true, stage: "Basic", attacks: [{ cost: ["Fire"], damage: "10" }] }), 4], [pk("Charmeleon", { category: "Pokemon", stage: "Stage1", evolveFrom: "Charmander", attacks: [{ cost: ["Fire", "Fire"], damage: "50" }] }), 3], [pk("Charizard ex", { category: "Pokemon", stage: "Stage2", evolveFrom: "Charmeleon", ruleBox: true, attacks: [{ cost: ["Fire", "Fire"], damage: "250" }] }), 3], [pk("Rare Candy", { category: "Trainer" }), 4], ...trainers, [pk("Basic Water Energy", { category: "Energy", basicEnergy: true }), 14]]), 45);
// 8. A Stage 2 attacker with a 1-1-1 line and no Rare Candy.
check("Pokémon", "Stage 2 attacker on a 1-1-1 line", PT([[pk("Dreepy", { category: "Pokemon", basicPokemon: true, stage: "Basic", attacks: [{ cost: ["Psychic"], damage: "10" }] }), 1], [pk("Drakloak", { category: "Pokemon", stage: "Stage1", evolveFrom: "Dreepy", attacks: [{ cost: ["Psychic"], damage: "30" }] }), 1], [pk("Dragapult ex", { category: "Pokemon", stage: "Stage2", evolveFrom: "Drakloak", ruleBox: true, attackCosts: ["Fire", "Psychic"], attacks: [{ cost: ["Fire", "Psychic"], damage: "200" }] }), 1], [pk("Pidgey", { category: "Pokemon", basicPokemon: true, stage: "Basic", attacks: [{ cost: ["Colorless"], damage: "10" }] }), 9], ...trainers, [pk("Basic Fire Energy", { category: "Energy", basicEnergy: true }), 6], [pk("Basic Psychic Energy", { category: "Energy", basicEnergy: true }), 5]]), 65);

/* ---------- Tournament match on staples alone (all games) ---------- */
// Pokémon lists share ~30 Trainers; a list that shares only those must not count as a copy.
const staples = new Map([["ultra ball", 4], ["nest ball", 4], ["iono", 4], ["professor's research", 4], ["boss's orders", 3], ["night stretcher", 3], ["switch", 2], ["buddy-buddy poffin", 4], ["lillie's determination", 4]]);
const arch = (name, core, rank) => ({ key: name, name, archetype: name, rank, rows: new Map([...staples, ...core]), labels: new Map() });
const field = [arch("Dragapult", [["dreepy", 4], ["drakloak", 4], ["dragapult ex", 3]], 1), arch("Gardevoir", [["ralts", 4], ["kirlia", 3], ["gardevoir ex", 2]], 2), arch("Raging Bolt", [["raging bolt ex", 4], ["teal mask ogerpon ex", 3]], 3)];
const pile = new Map([...staples, ["pidgey", 4], ["pidgeotto", 3], ["pidgeot", 3]]);
const mm = metaMatch(pile, field, []);
if (mm.sim >= 0.35) fails.push(`Staples-only list matched ${mm.archetype} at ${Math.round(mm.sim * 100)}%`);
out.push(`Match · staples-only list vs field: ${Math.round(mm.sim * 100)}% (must be < 35%)`);
const real = new Map([...staples, ["dreepy", 4], ["drakloak", 4], ["dragapult ex", 3]]);
const rm = metaMatch(real, field, []);
if (!(rm.sim >= 0.8 && rm.archetype === "Dragapult")) fails.push(`Real Dragapult copy only matched ${Math.round(rm.sim * 100)}%`);

console.log(out.join("\n"));
assert.deepEqual(fails, [], "Decks built to fool Deck Power:\n" + fails.join("\n"));
console.log("PASS: decks built to fool Deck Power rate low in all three games.");
