// Deck generator: legal, full-size decks around a seed card, inside a budget.
import assert from "node:assert/strict";
import { cardKey } from "./core.js";
import { buildDeck, buildTiers, formatsFor, themeQuery } from "./builder.js";
import { FORMATS, formatOf } from "./formats.js";
import { validateDeck } from "./core.js";

const legal = (o = {}) => Object.fromEntries(FORMATS.filter((f) => f.legality).map((f) => [f.legality, o[f.legality] || "legal"]));
const card = (name, type, o = {}) => ({ name, type_line: type, oracle_text: o.text || "", cmc: o.cmc ?? 2, mana_cost: o.cost || "{1}{R}", color_identity: o.ci || ["R"], legalities: legal(o.legal), prices: { usd: o.usd ?? "0.25" }, edhrec_rank: o.rank || 5000, produced_mana: o.produced });
const seed = card("Goblin Chieftain", "Creature — Goblin", { text: "Other Goblin creatures you control get +1/+1 and have haste.", cmc: 3, usd: "0.5" });
const goblins = Array.from({ length: 20 }, (_, i) => card("Goblin " + i, "Creature — Goblin Warrior", { cmc: 1 + (i % 4), usd: i < 4 ? "12" : "0.3" }));
const burn = Array.from({ length: 10 }, (_, i) => card("Burn " + i, "Instant", { text: "Deal 3 damage to any target.", cmc: 1, usd: "0.2" }));
const blue = card("Blue Thing", "Creature — Wizard", { ci: ["U"] });
const banned = card("Banned Goblin", "Creature — Goblin", { legal: { modern: "banned" }, usd: "0.1", rank: 1 });
const mountain = { name: "Mountain", type_line: "Basic Land — Mountain", color_identity: [], legalities: legal(), prices: {usd:"0.05"} };
const pw = card("Chandra Test", "Legendary Planeswalker — Chandra", { cmc: 4 });
const catalog = Object.fromEntries([seed, ...goblins, ...burn, blue, banned, mountain, pw].map((c) => [cardKey(c.name), c]));
const owned = { "Goblin Chieftain": 4, "Goblin 5": 4 };
const opts = { format: "Modern", seeds: [seed], catalog, available: (n) => owned[n] || 0, price: (c) => (c.prices?.usd ? Number(c.prices.usd) : null) };

const d = buildDeck({ ...opts, budget: 25 });
const total = d.cards.reduce((a, r) => a + r.qty, 0);
assert.equal(total, 60);
assert.equal(d.cards.find((r) => r.name === "Goblin Chieftain").qty, 4);
assert.ok(!d.cards.some((r) => r.name === "Blue Thing"), "off-color card left out");
assert.ok(!d.cards.some((r) => r.name === "Banned Goblin"), "banned card left out");
assert.ok(d.cost <= 25);
assert.equal(d.lands, 23); // contextual: Karsten's 60-card land math for this curve
assert.ok(d.cards.every((r) => r.qty <= 4 || r.name === "Mountain"));
assert.deepEqual(validateDeck({ format: "Modern", cards: d.cards }, { ...catalog }, []).issues, []);
// $0 means only actual owned copies, including basic lands; open slots stay open.
const free = buildDeck({ ...opts, budget: 0 });
assert.equal(free.cost, 0);
assert.ok(free.cards.every((r) => (owned[r.name] || 0) >= r.qty));
assert(!free.cards.some(r=>r.name==="Mountain"),"Unowned basic lands are not fabricated for free");
assert.ok(free.open > 0 && free.warnings.length);
// Tiers: more budget never costs more than its tier, and buys more of the expensive goblins.
const tiers = buildTiers(opts);
assert.ok(tiers.length >= 2);
for (const t of tiers) assert.ok(t.cost <= t.budget + 1e-6);
assert.ok(tiers.at(-1).cards.some((r) => /Goblin [0-3]$/.test(r.name)));
// Singleton command-zone format led by a planeswalker.
const oath = buildDeck({ ...opts, format: "Oathbreaker", seeds: [pw], budget: 50 });
assert.equal(oath.commander, "Chandra Test");
assert.ok(oath.cards.every((r) => r.qty === 1 || r.name === "Mountain"));
assert.throws(() => buildDeck({ ...opts, format: "Commander", seeds: [seed] }), /need a card that can lead/);
// Where a card can be built around.
const names = formatsFor(seed, FORMATS).map((f) => f.name);
assert.ok(names.includes("Modern") && names.includes("Standard") && !names.includes("Commander") && !names.includes("Limited (40-card)"));
assert.ok(formatsFor(pw, FORMATS).some((f) => f.name === "Oathbreaker"));
assert.match(themeQuery(seed), /t:goblin/);
console.log("PASS: deck generator — legal 60-card and singleton decks, budget tiers, owned-only $0, banned/off-color excluded.");
