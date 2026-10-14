// Matchups: each game's simulation behaves like the game (mirrors are even, faster or stronger
// decks are favored, Weakness matters, the play matters), logged games move the estimate, and
// the game plan brings in the right sideboard cards.
import assert from "node:assert/strict";
import { simulateMatchup, gamePlan, recordOf, blend, profileOf } from "./matchup.js";

const dist = (t, maxT = 10) => Array.from({ length: maxT + 1 }, (_, i) => (i === t - 1 ? 0.6 : i === t ? 0.25 : i === t - 2 ? 0.15 : 0));
const mtg = (t, extra = {}) => ({ game: "mtg", clock: dist(t), maxT: 10, inter: 6, threats: 20, flow: 4, plan: "Midrange", size: 60, features: { creatures: 20, noncreature: 16, artifacts: 0, enchantments: 0, gy: 0, fliers: 0, colors: ["R"] }, ...extra });

const mirror = simulateMatchup("mtg", mtg(6), mtg(6));
assert.ok(Math.abs(mirror.win - 0.5) < 0.06, `Magic mirror is even (${mirror.win})`);
assert.ok(mirror.onPlay > mirror.onDraw, "being on the play helps in Magic");
const fast = simulateMatchup("mtg", mtg(4), mtg(7));
assert.ok(fast.win > 0.7, `a turn-4 deck beats a turn-7 deck (${fast.win})`);
const answered = simulateMatchup("mtg", mtg(5, { threats: 8 }), mtg(6, { inter: 18 }));
assert.ok(answered.win < simulateMatchup("mtg", mtg(5, { threats: 8 }), mtg(6, { inter: 2 })).win, "interaction slows the other side");
assert.match(fast.reasons[0], /You're faster/);

const pk = (extra) => ({ game: "ptcg", clock: dist(2, 6), maxT: 6, name: "A", reach: 200, hp: 300, types: ["Psychic"], weak: ["Darkness"], prize: 2, lives: 4, gust: 3, disrupt: 2, swarm: false, ...extra });
const pm = simulateMatchup("ptcg", pk(), pk());
assert.ok(Math.abs(pm.win - 0.5) < 0.08, `Pokémon mirror is even (${pm.win})`);
const weak = simulateMatchup("ptcg", pk({ types: ["Darkness"], weak: ["Fighting"] }), pk());
assert.ok(weak.win > pm.win + 0.1, `hitting Weakness wins more (${weak.win} vs ${pm.win})`);
const single = simulateMatchup("ptcg", pk({ reach: 120, hp: 130, prize: 1, swarm: true }), pk());
assert.ok(single.reasons[0].includes("Knock Outs"), "Pokémon reasons talk about Knock Outs");
void single;

const yg = (open, extra = {}) => ({ game: "ygo", open, second: 0.7, through: 0.5, breakRate: 0.5, inter: 9, features: { gy: 4, extraUse: 15, st: 12, starters: 12, monsters: 22 }, ...extra });
const ym = simulateMatchup("ygo", yg(0.85), yg(0.85));
assert.ok(Math.abs(ym.win - 0.5) < 0.06, `Yu-Gi-Oh! mirror is even (${ym.win})`);
assert.ok(ym.onPlay > ym.onDraw, "going first helps in Yu-Gi-Oh!");
assert.ok(simulateMatchup("ygo", yg(0.92), yg(0.6)).win > ym.win + 0.04, "the deck that opens more wins more");

// Logged games: six simulated "games" of weight, then your record takes over.
const res = [{ opp: "Mono Red", res: "W" }, { opp: "mono red", res: "W" }, { opp: "Mono-Red", res: "L" }, { opp: "Elves", res: "L" }];
assert.deepEqual(recordOf(res, "Mono Red"), { w: 2, l: 1, d: 0, n: 3, rate: 2 / 3 });
assert.equal(Math.round(blend(0.4, recordOf(res, "Mono Red")) * 1000), Math.round(((0.4 * 6 + 2) / 9) * 1000));
assert.equal(blend(0.4, recordOf([], "x")), 0.4);

// Sideboard plan: graveyard hate in against a graveyard deck, dead removal out against creatureless.
const card = (name, oracle_text, type_line = "Instant", cmc = 2) => ({ name, oracle_text, type_line, cmc, mana_cost: "{1}{B}" });
const main = [{ qty: 4, c: card("Murder", "Destroy target creature.") }, { qty: 4, c: card("Bear", "", "Creature — Bear", 2) }, { qty: 20, c: card("Swamp", "", "Basic Land — Swamp", 0) }];
const side = [{ qty: 3, c: card("Leyline of the Void", "If a card would be put into an opponent's graveyard from anywhere, exile it instead. Exile all cards from target player's graveyard.", "Enchantment", 4) }, { qty: 2, c: card("Duress", "Target opponent reveals their hand. You choose a noncreature card from it.", "Sorcery", 1) }];
const gyCombo = mtg(5, { plan: "Control", features: { creatures: 4, noncreature: 30, artifacts: 0, enchantments: 0, gy: 14, fliers: 0, colors: ["U"] } });
const plan = gamePlan("mtg", mtg(6), gyCombo, { main, side });
assert.ok(plan.ins.some((x) => x.name === "Leyline of the Void" && /graveyard/.test(x.why)), "graveyard hate comes in");
assert.ok(plan.ins.some((x) => x.name === "Duress"), "discard comes in against a spell-heavy deck");
assert.ok(plan.outs.some((x) => x.name === "Murder" && /creatures/.test(x.why)), "creature removal goes out against a creatureless deck");
assert.equal(plan.outs.reduce((a, x) => a + x.qty, 0), plan.ins.reduce((a, x) => a + x.qty, 0), "as many out as in");
const prize = gamePlan("ptcg", pk({ name: "Dragapult ex", types: ["Dragon"] }), pk({ name: "Gardevoir ex", hp: 310, weak: ["Darkness"], disrupt: 4 }));
assert.equal(prize.kind, "prize");
assert.match(prize.lines.join(" "), /2-Prize|Iono/);

// Profiles come from each game's Deck Power result.
assert.equal(profileOf("mtg", { goldfish: { turnDist: { d: dist(5), maxT: 10 } }, stats: { interaction: 8, threats: 14, flow: 3 }, plan: "Aggro · Tokens" }, []).plan, "Aggro");
assert.equal(profileOf("ptcg", { attacker: { name: "X", reach: 180, hp: 280, types: ["Fire"], weak: ["Water"], ruleBox: true, lives: 4 }, goldfish: { turnDist: { d: dist(2, 6), maxT: 6 } } }).prize, 2);
console.log("PASS: matchups follow each game's rules, logged games move the estimate, and side plans fit the opponent.");
