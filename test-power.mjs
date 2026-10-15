// Deck Power: each game and format is judged on its own terms, and proven tournament
// lists rate highly instead of being marked down by Commander targets.
import assert from "node:assert/strict";
import { mtgConstructedPower, ygoPower, ptcgPower, metaMatch, blend, overlap } from "./deckpower.js";

const key = (s) => String(s).toLowerCase();
const cat = {};
const card = (name, cmc, type_line, oracle_text, extra = {}) => (cat[key(name)] = { name, cmc, type_line, oracle_text, mana_cost: "{" + Math.max(0, cmc - 1) + "}{G}", ...extra });

// A mono-green landfall Standard list (shape of a real placing deck).
card("Forest", 0, "Basic Land — Forest", "", { produced_mana: ["G"] });
card("Fabled Passage", 0, "Land", "{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped.", { produced_mana: [] });
card("Llanowar Elves", 1, "Creature — Elf Druid", "{T}: Add {G}.");
card("Lumra, Bellow of the Woods", 6, "Legendary Creature — Elemental Bear", "Vigilance, reach. When Lumra enters, mill four cards. Then return all land cards from your graveyard to the battlefield tapped. Lumra's power is equal to the number of lands you control.");
card("Mossborn Hydra", 3, "Creature — Elemental Hydra", "Trample. Landfall — Whenever a land you control enters, double the number of +1/+1 counters on this creature.");
card("Tifa's Limit Break", 2, "Instant", "Target creature you control gets +2/+2. It fights target creature you don't control.");
card("Bushwhack", 1, "Sorcery", "Choose one — Search your library for a basic land card, reveal it, put it into your hand; or target creature you control fights target creature you don't control.");
card("Sazh's Chocobo", 1, "Creature — Bird", "Landfall — Whenever a land you control enters, put a +1/+1 counter on this creature.");
card("Earthbender Ascension", 3, "Enchantment", "When this enchantment enters, earthbend 2. Then search your library for a basic land card, put it onto the battlefield tapped. Landfall — Whenever a land you control enters, put a quest counter.");
card("Icetill Explorer", 3, "Creature — Insect Scout", "You may play an additional land on each of your turns. You may play lands from your graveyard. Landfall — Whenever a land you control enters, mill a card.");
card("Spider-Man Noir", 4, "Creature — Spider", "Whenever this creature attacks, put a +1/+1 counter on it. Then draw a card.");
card("Up the Beanstalk", 2, "Enchantment", "When Up the Beanstalk enters and whenever you cast a spell with mana value 5 or greater, draw a card.");
card("Mightform Harmonizer", 4, "Creature — Insect Druid", "Landfall — Whenever a land you control enters, double the power of target creature you control until end of turn.");
card("Overlord of the Hauntwoods", 5, "Enchantment Creature — Avatar Horror", "Impending 4. Whenever this permanent enters or attacks, create a tapped colorless land token named Everywhere.");
const list = [["Forest", 20], ["Fabled Passage", 2], ["Llanowar Elves", 4], ["Lumra, Bellow of the Woods", 2], ["Mossborn Hydra", 4], ["Tifa's Limit Break", 4], ["Bushwhack", 4], ["Sazh's Chocobo", 4], ["Earthbender Ascension", 4], ["Icetill Explorer", 4], ["Spider-Man Noir", 2], ["Up the Beanstalk", 2], ["Mightform Harmonizer", 2], ["Overlord of the Hauntwoods", 2]].map(([name, qty]) => ({ name, qty }));
assert.equal(list.reduce((a, r) => a + r.qty, 0), 60);
const deck = { format: "Standard", cards: list };

const p = mtgConstructedPower(deck, cat, key, 60);
assert.ok(!p.parts.some((x) => /Commander|Wipe|Protection/.test(x.label)), "no Commander-only targets on a Standard deck");
assert.match(p.plan, /Landfall|Ramp|Aggro|Midrange/);
assert.ok(p.score >= 70, `a tight 4-of Standard list rates solid on build alone (got ${p.score})`);
console.log(`PASS: Standard list judged as constructed (${p.plan}, build ${p.score}).`);

// Meta match: our list vs the 2nd-place list it was copied from.
const mine = new Map(list.filter((r) => r.name !== "Forest").map((r) => [key(r.name), r.qty]));
const meta = [
  { key: "a", name: "Mono Green Landfall", archetype: "Mono Green Landfall", rank: 2, rows: new Map(mine), labels: new Map() },
  { key: "b", name: "Izzet Prowess", archetype: "Izzet Prowess", rank: 1, rows: new Map([["slickshot show-off", 4], ["monstrous rage", 4]]), labels: new Map() },
];
const m = metaMatch(mine, meta, [{ name: "Mono Green Landfall", share: 0.1156 }]);
assert.equal(m.archetype, "Mono Green Landfall");
assert.ok(m.sim > 0.99 && m.weight === 1);
const b = blend(p.score, m);
assert.ok(b.score >= 90, `a 2nd-place meta list rates tournament-ready (got ${b.score})`);
console.log(`PASS: proven meta list rated ${b.score} (was 60 with Commander targets).`);
assert.equal(overlap(new Map([["x", 4]]), new Map([["y", 4]])), 0);
assert.equal(blend(55, null).score, 55, "no meta data → build score only");

// Yu-Gi-Oh!: 40-card combo deck vs a bloated 60-card pile.
const ygo = (name, text, extra = {}) => ({ name, category: "Monster", text, level: 4, ...extra });
const starter = ygo("Starter", "Add 1 monster from your Deck to your hand.", { archetype: "Mitsurugi" });
const ext = ygo("Extender", "You can Special Summon this card from your hand.", { archetype: "Mitsurugi" });
const ash = ygo("Ash Blossom", "(Quick Effect): You can discard this card; negate that effect.");
const filler = ygo("Vanilla", "A plain monster.", { level: 8 });
const tight = [...Array(4)].flatMap(() => []).concat([
  { zone: "main", qty: 3, c: starter }, { zone: "main", qty: 3, c: { ...starter, name: "Starter 2" } }, { zone: "main", qty: 3, c: { ...starter, name: "Starter 3" } }, { zone: "main", qty: 3, c: { ...starter, name: "Starter 4" } },
  { zone: "main", qty: 3, c: ext }, { zone: "main", qty: 3, c: { ...ext, name: "Extender 2" } },
  { zone: "main", qty: 3, c: ash }, { zone: "main", qty: 3, c: { ...ash, name: "Maxx C" } }, { zone: "main", qty: 3, c: { ...ash, name: "Ghost Ogre" } },
  { zone: "main", qty: 3, c: { ...ash, name: "Infinite Impermanence", category: "Trap" } },
  { zone: "main", qty: 2, c: { name: "Called by the Grave", category: "Spell", text: "Target 1 monster in your opponent's GY; banish it." } },
  { zone: "main", qty: 3, c: { name: "Pot of Prosperity", category: "Spell", text: "Draw 2 cards." } },
  { zone: "main", qty: 2, c: { name: "Harpie's Feather Duster", category: "Spell", text: "Destroy all Spells and Traps your opponent controls." } },
  { zone: "main", qty: 3, c: { name: "Triple Tactics", category: "Spell", text: "Destroy 1 card your opponent controls." } },
  { zone: "extra", qty: 15, c: { name: "Extra", category: "Monster", extra: true, text: "" } },
]);
const y1 = ygoPower(tight, { name: "Advanced", main: [40, 60], extra: 15 });
const y2 = ygoPower([{ zone: "main", qty: 60, c: filler }], { name: "Advanced", main: [40, 60], extra: 15 });
assert.ok(y1.score >= 75 && y2.score <= 30, `YGO: tight 40 ${y1.score} vs pile ${y2.score}`);
assert.ok(y1.parts.some((x) => x.key === "Interaction") && !y1.parts.some((x) => /Ramp|Lands/.test(x.key)));
console.log(`PASS: Yu-Gi-Oh! judged on starters, hand traps and 40-card consistency (${y1.score} vs ${y2.score}).`);

// Pokémon: real-shaped list vs one with no Basics or draw.
const pk = (name, extra) => ({ name, ...extra });
const pt = ptcgPower([
  { qty: 4, c: pk("Dreepy", { category: "Pokemon", basicPokemon: true, stage: "Basic" }) },
  { qty: 4, c: pk("Drakloak", { category: "Pokemon", evolveFrom: "Dreepy", stage: "Stage1", abilities: [{ effect: "Look at the top 2 cards of your deck and put 1 of them into your hand." }] }) },
  { qty: 3, c: pk("Dragapult ex", { category: "Pokemon", evolveFrom: "Drakloak", stage: "Stage2", ruleBox: true, attackCosts: ["Fire", "Psychic"], attacks: [{ name: "Phantom Dive", cost: ["Fire", "Psychic"], damage: "200" }] }) },
  { qty: 2, c: pk("Fezandipiti ex", { category: "Pokemon", basicPokemon: true, ruleBox: true, abilities: [{ effect: "Draw 3 cards." }] }) },
  { qty: 4, c: pk("Rare Candy", { category: "Trainer" }) },
  { qty: 4, c: pk("Ultra Ball", { category: "Trainer", text: "Discard 2 cards from your hand. Search your deck for a Pokémon." }) },
  { qty: 4, c: pk("Buddy-Buddy Poffin", { category: "Trainer", text: "Search your deck for up to 2 Basic Pokémon with 70 HP or less." }) },
  { qty: 4, c: pk("Iono", { category: "Trainer", text: "Each player shuffles their hand and puts it on the bottom of their deck. Then each player draws a card for each of their remaining Prize cards." }) },
  { qty: 4, c: pk("Lillie's Determination", { category: "Trainer", text: "Shuffle your hand into your deck. Then, draw 6 cards." }) },
  { qty: 3, c: pk("Boss's Orders", { category: "Trainer", text: "Switch in 1 of your opponent's Benched Pokémon to the Active Spot." }) },
  { qty: 2, c: pk("Counter Catcher", { category: "Trainer", text: "Switch in 1 of your opponent's Benched Pokémon to the Active Spot." }) },
  { qty: 4, c: pk("Nest Ball", { category: "Trainer", text: "Search your deck for a Basic Pokémon and put it onto your Bench." }) },
  { qty: 4, c: pk("Professor's Research", { category: "Trainer", text: "Discard your hand and draw 7 cards." }) },
  { qty: 4, c: pk("Night Stretcher", { category: "Trainer", text: "Put a Pokémon or a Basic Energy card from your discard pile into your hand." }) },
  { qty: 2, c: pk("Fire Energy", { category: "Energy", basicEnergy: true }) },
  { qty: 4, c: pk("Psychic Energy", { category: "Energy", basicEnergy: true }) },
  { qty: 4, c: pk("Neo Upper Energy", { category: "Energy" }) },
], { name: "Standard" });
assert.equal(pt.stats.N, 60);
assert.ok(pt.score >= 75, `a proper Pokémon list rates well (got ${pt.score})`);
assert.ok(!pt.parts.some((x) => /Ramp|Lands|Interaction/.test(x.key)), "Pokémon uses its own ingredients");
console.log(`PASS: Pokémon judged on Basics, draw, search and gust (${pt.score}).`);

// A consistent pile with no real attacker, and an Ability that needs Energy the deck doesn't run.
const pile = ptcgPower([
  { qty: 4, c: pk("Impidimp", { category: "Pokemon", basicPokemon: true, stage: "Basic", attackCosts: ["Psychic"], attacks: [{ name: "Tackle", cost: ["Psychic"], damage: "20" }] }) },
  { qty: 2, c: pk("Munkidori", { category: "Pokemon", basicPokemon: true, stage: "Basic", attacks: [{ name: "Mind Bend", cost: ["Psychic", "Colorless"], damage: "60" }], abilities: [{ effect: "Once during your turn, if this Pokémon has any Darkness Energy attached, you may move up to 3 damage counters from 1 of your Pokémon to 1 of your opponent's Pokémon." }] }) },
  { qty: 2, c: pk("Fezandipiti ex", { category: "Pokemon", basicPokemon: true, ruleBox: true, attacks: [{ name: "Cruel Arrow", cost: ["Colorless", "Colorless", "Colorless"], damage: "" }], abilities: [{ effect: "Draw 3 cards." }] }) },
  ...[
    { qty: 4, c: pk("Ultra Ball", { category: "Trainer", text: "Discard 2 cards from your hand. Search your deck for a Pokémon." }) },
    { qty: 4, c: pk("Buddy-Buddy Poffin", { category: "Trainer", text: "Search your deck for up to 2 Basic Pokémon with 70 HP or less." }) },
    { qty: 4, c: pk("Iono", { category: "Trainer", text: "Each player shuffles their hand and puts it on the bottom of their deck. Then each player draws a card for each of their remaining Prize cards." }) },
    { qty: 4, c: pk("Lillie's Determination", { category: "Trainer", text: "Shuffle your hand into your deck. Then, draw 6 cards." }) },
    { qty: 4, c: pk("Boss's Orders", { category: "Trainer", text: "Switch in 1 of your opponent's Benched Pokémon to the Active Spot." }) },
    { qty: 4, c: pk("Nest Ball", { category: "Trainer", text: "Search your deck for a Basic Pokémon and put it onto your Bench." }) },
    { qty: 4, c: pk("Professor's Research", { category: "Trainer", text: "Discard your hand and draw 7 cards." }) },
    { qty: 4, c: pk("Night Stretcher", { category: "Trainer", text: "Put a Pokémon or a Basic Energy card from your discard pile into your hand." }) },
    { qty: 2, c: pk("Switch", { category: "Trainer", text: "Switch your Active Pokémon with 1 of your Benched Pokémon." }) },
    { qty: 4, c: pk("Poké Pad", { category: "Trainer", text: "Search your deck for a Pokémon that doesn't have a Rule Box." }) },
  ],
  { qty: 14, c: pk("Psychic Energy", { category: "Energy", basicEnergy: true, name: "Basic Psychic Energy" }) },
], { name: "Standard" });
const atk = pile.parts.find((x) => x.key === "Attacker"), en = pile.parts.find((x) => x.key === "Energy");
assert.ok(pile.score <= 72 && pile.score < pt.score - 10, `no attacker caps the score (pile ${pile.score} vs ${pt.score})`);
assert.ok(atk && atk.ratio < 0.5 && /Munkidori's Ability needs Darkness/.test(en.why), "attacker and dead Ability explained");
console.log(`PASS: Pokémon needs a real attacker and working Abilities (pile ${pile.score} vs real list ${pt.score}).`);

// Detail: simulated hands, ranked weaknesses with the cards behind them, card roles.
import { review, simulate, poolOf, allIn } from "./deckaudit.js";
assert.ok(pt.sims.length >= 4 && pt.sims.every((x) => x.p >= 0 && x.p <= 1), "Pokémon hand simulation");
assert.ok(pt.parts.find((x) => x.key === "Gust").cards.some((c) => c.name === "Boss's Orders" && c.qty === 3), "gust evidence lists the real cards");
const weakDeck = ptcgPower([{ qty: 4, c: pk("Pikachu", { category: "Pokemon", basicPokemon: true }) }, { qty: 56, c: pk("Fire Energy", { category: "Energy", basicEnergy: true }) }], {});
const rv = review(weakDeck.parts);
assert.ok(rv.weak.length >= 4 && rv.weak[0].lost >= rv.weak.at(-1).lost, "weaknesses ranked by points lost");
assert.ok(rv.weak.every((x) => x.why), "every weakness says why in plain words");
assert.ok(y1.sims.find((x) => /starter \+/.test(x.label)).p > 0.4 && y2.sims[0].p === 0);
assert.ok(Math.abs(simulate(poolOf([{ qty: 4, tags: new Set(["x"]) }, { qty: 36, tags: new Set() }]), (a) => ({ hit: a.slice(0, 5).some((c) => c.tags.has("x")) })).hit - 0.427) < 0.03, "simulation matches exact odds");
assert.ok(Math.abs(allIn(60, 1, 6) - 0.1) < 1e-9);
assert.ok(p.sims.find((x) => /Keepable/.test(x.label)).p > 0.7);
console.log("PASS: weaknesses ranked with reasons and cards, seeded hand simulations match exact odds.");

// Always judged against the field: no data → capped; off-meta → capped lower; proven → can top out.
import { metaContext } from "./deckpower.js";
const mineM = new Map([["a", 4], ["b", 4], ["z", 4]]);
const fieldDecks = [1, 2, 3, 4].map((i) => ({ rows: new Map([["a", 4], ["b", 4], ["c", 4]]), rank: i }));
assert.equal(metaContext({ build: 95, mine: mineM, loaded: false }).score, 95, "no tournament data must not penalize the engine");
assert.equal(metaContext({ build: 95, mine: mineM, loaded: true, formatOk: false, decks: fieldDecks }).reason, "format");
const rogueCtx = metaContext({ build: 95, mine: new Map([["x", 4], ["y", 4]]), loaded: true, decks: fieldDecks });
assert.ok(rogueCtx.from === "rogue" && rogueCtx.score === 95 && rogueCtx.unplayed.length === 2, `novel strategies retain their engine estimate (${rogueCtx.score})`);
const copy = new Map([["a", 4], ["b", 4], ["c", 4]]);
const proven = metaContext({ build: 90, mine: copy, loaded: true, decks: fieldDecks, match: { sim: 0.95, metaScore: 96 } });
assert.ok(proven.score >= 90 && proven.from === "meta", `a copy of a placing list can rate tournament-ready (${proven.score})`);
// A third of the copies are a card no placing list plays: that costs, even at high similarity.
const padded = metaContext({ build: 90, mine: mineM, loaded: true, decks: fieldDecks, match: { sim: 0.95, metaScore: 96 } });
assert.ok(padded.score < proven.score - 5, `filler no list plays costs points (${padded.score} vs ${proven.score})`);
// Copies short of what the archetype plays cost in proportion; the score never sits far above the build.
const thinList = metaContext({ build: 90, mine: copy, loaded: true, decks: fieldDecks, match: { sim: 0.9, metaScore: 96, deficit: 3 } });
assert.ok(thinList.score <= proven.score - 10, `cutting copies of the deck's usual cards lowers the score (${thinList.score})`);
assert.ok(metaContext({ build: 60, mine: copy, loaded: true, decks: fieldDecks, match: { sim: 0.95, metaScore: 96 } }).score <= 78, "a badly built copy can't borrow the archetype's results");
console.log(`PASS: rated against the field: unloaded 95, off-meta ${rogueCtx.score}, proven ${proven.score}.`);
