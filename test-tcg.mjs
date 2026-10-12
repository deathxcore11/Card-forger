// Yu-Gi-Oh! and Pokémon deck rules, card normalization and import parsing.
import assert from "node:assert/strict";
import { normalizeYgo, validateYgo, ygoLimit, ygoLegality, YGO_FORMATS } from "./ygo.js";
import { normalizePtcg, validatePtcg, PTCG_FORMATS } from "./ptcg.js";
import { parseLines, parseYdk, ptcglName } from "./tcg.js";

const F = (list, id) => list.find((f) => f.id === id);
// ---- Yu-Gi-Oh!
const ygo = (id, name, o = {}) => normalizeYgo({ id, name, type: o.type || "Normal Monster", frameType: o.frame || "normal", desc: "", atk: 1000, def: 1000, level: 4, race: "Warrior", banlist_info: o.ban, card_prices: [{ tcgplayer_price: o.usd || "0.50", cardmarket_price: "0.10" }], misc_info: [{ formats: o.pools || ["TCG", "OCG", "GOAT"] }] });
const dm = ygo(1, "Dark Magician"), pot = ygo(2, "Pot of Greed", { type: "Spell Card", ban: { ban_tcg: "Forbidden", ban_goat: "Limited" } }), fusion = ygo(3, "Dark Paladin", { type: "Fusion Monster", frame: "fusion" }), semi = ygo(4, "Semi Card", { ban: { ban_tcg: "Semi-Limited" } }), ocgOnly = ygo(5, "OCG Only", { pools: ["OCG"] });
const cards = Object.fromEntries([dm, pot, fusion, semi, ocgOnly].map((c) => [c.id, c])), of = (id) => cards[id];
const tcg = F(YGO_FORMATS, "tcg"), trad = F(YGO_FORMATS, "traditional"), goat = F(YGO_FORMATS, "goat");
assert.equal(dm.prices.usd, 0.5);
assert.ok(fusion.extra && !dm.extra);
assert.equal(ygoLimit(pot, tcg), 0);
assert.equal(ygoLimit(pot, trad), 1);
assert.equal(ygoLimit(pot, goat), 1);
assert.equal(ygoLimit(semi, tcg), 2);
assert.equal(ygoLegality(ocgOnly, tcg), "not_legal");
const deck = (main, extra = [], side = []) => ({ zones: { main, extra, side } });
const forty = [{ cardId: "1", name: "Dark Magician", qty: 3 }, ...Array.from({ length: 37 }, (_, i) => ({ cardId: "x" + i, name: "Filler " + i, qty: 1 }))];
assert.deepEqual(validateYgo(deck(forty), of, tcg), []);
const t = (d, f = tcg) => validateYgo(d, of, f).map((i) => i.text).join(" | ");
assert.match(t(deck(forty.slice(0, 10))), /needs 40–60/);
assert.match(t(deck([...forty, { cardId: "2", name: "Pot of Greed", qty: 1 }])), /Pot of Greed is Forbidden/);
assert.doesNotMatch(t(deck([...forty, { cardId: "2", name: "Pot of Greed", qty: 1 }]), trad), /Pot of Greed/);
assert.match(t(deck([...forty, { cardId: "4", name: "Semi Card", qty: 3 }])), /allows 2 \(Semi-Limited\)/);
assert.match(t(deck([...forty, { cardId: "3", name: "Dark Paladin", qty: 1 }])), /move it to the Extra Deck/);
assert.match(t(deck(forty, [{ cardId: "1", name: "Dark Magician", qty: 1 }])), /can’t go in the Extra Deck/);
assert.match(t(deck([...forty.slice(1), { cardId: "1", name: "Dark Magician", qty: 2 }], [], [{ cardId: "1", name: "Dark Magician", qty: 2 }])), /4 copies, Advanced \(TCG\) allows 3/);
assert.match(t(deck([...forty, { cardId: "5", name: "OCG Only", qty: 1 }])), /isn’t available in Advanced/);
// ---- Pokémon
const pk = (id, name, o = {}) => normalizePtcg({ id, name, category: o.cat || "Pokemon", stage: o.stage ?? "Basic", energyType: o.energy, rarity: o.rarity || "Common", legal: { standard: o.std ?? true, expanded: true }, pricing: { tcgplayer: { normal: { marketPrice: 0.25, productId: 9 } } }, image: "https://assets.tcgdex.net/en/sv/sv01/001" });
const pika = pk("sv1-1", "Pikachu"), nest = pk("sv1-2", "Nest Ball", { cat: "Trainer", stage: null }), ace = pk("sv1-3", "Prime Catcher", { cat: "Trainer", stage: null, rarity: "ACE SPEC Rare" }), energy = pk("sv1-4", "Basic Lightning Energy", { cat: "Energy", stage: null, energy: "Normal" }), old = pk("sv1-5", "Old Card", { std: false }), rad = pk("sv1-6", "Radiant Charizard"), rad2 = pk("sv1-7", "Radiant Greninja"), exmon = pk("sv1-8", "Pikachu ex");
const P = Object.fromEntries([pika, nest, ace, energy, old, rad, rad2, exmon].map((c) => [c.id, c])), pof = (id) => P[id];
const std = F(PTCG_FORMATS, "standard"), glc = F(PTCG_FORMATS, "glc");
assert.equal(pika.prices.usd, 0.25);
assert.ok(energy.basicEnergy && ace.aceSpec && rad.radiant && exmon.ruleBox && !pika.ruleBox);
const pd = (rows) => ({ zones: { main: rows } });
const ok60 = [{ cardId: "sv1-1", name: "Pikachu", qty: 4 }, { cardId: "sv1-2", name: "Nest Ball", qty: 4 }, { cardId: "sv1-4", name: "Basic Lightning Energy", qty: 52 }];
const pt = (rows, f = std) => validatePtcg(pd(rows), pof, f).map((i) => i.text).join(" | ");
assert.equal(pt(ok60), "");
assert.match(pt(ok60.slice(0, 2)), /8\/60 cards/);
assert.match(pt([{ cardId: "sv1-1", name: "Pikachu", qty: 5 }, ...ok60.slice(1, 2), { cardId: "sv1-4", name: "E", qty: 51 }]), /5× Pikachu/);
assert.match(pt([...ok60.slice(0, 2), { cardId: "sv1-3", name: "Prime Catcher", qty: 2 }, { cardId: "sv1-4", name: "E", qty: 50 }]), /2 ACE SPEC/);
assert.match(pt([...ok60.slice(0, 2), { cardId: "sv1-6", name: "Radiant Charizard", qty: 1 }, { cardId: "sv1-7", name: "Radiant Greninja", qty: 1 }, { cardId: "sv1-4", name: "E", qty: 50 }]), /2 Radiant/);
assert.match(pt([...ok60.slice(0, 2), { cardId: "sv1-5", name: "Old Card", qty: 1 }, { cardId: "sv1-4", name: "E", qty: 51 }]), /Old Card .* isn’t legal in Standard/);
assert.match(pt([{ cardId: "sv1-2", name: "Nest Ball", qty: 4 }, { cardId: "sv1-4", name: "E", qty: 56 }]), /No Basic Pokémon/);
assert.match(pt([{ cardId: "sv1-1", name: "Pikachu", qty: 2 }, { cardId: "sv1-8", name: "Pikachu ex", qty: 1 }, { cardId: "sv1-4", name: "E", qty: 57 }], glc), /Pikachu ex .*Rule Box|2× Pikachu/);
// ---- import parsing
assert.deepEqual(parseLines("Pokémon: 4\n4 Pikachu ex SVI 63\n2x Nest Ball\nDark Magician"), [{ qty: 4, name: "Pikachu ex SVI 63" }, { qty: 2, name: "Nest Ball" }, { qty: 1, name: "Dark Magician" }]);
assert.equal(ptcglName("Pikachu ex SVI 63"), "Pikachu ex");
assert.equal(ptcglName("Nest Ball"), "Nest Ball");
assert.deepEqual(parseYdk("#created by x\n#main\n46986414\n46986414\n#extra\n98502113\n!side\n55144522\n"), { main: ["46986414", "46986414"], extra: ["98502113"], side: ["55144522"] });
console.log("PASS: Yu-Gi-Oh! (Forbidden/Limited/Semi, Traditional, Extra Deck, card pools) and Pokémon (60 cards, 4 by name, ACE SPEC, Radiant, legality, GLC) rules; .ydk and PTCGL parsing.");
