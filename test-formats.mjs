// Every format's deck rules: size, copies, restricted/banned lists, commanders.
import assert from "node:assert/strict";
import { cardKey, validateDeck } from "./core.js";
import { FORMATS, formatOf, canLead, legalityIn } from "./formats.js";

const L = (o) => Object.fromEntries(FORMATS.filter((f) => f.legality).map((f) => [f.legality, o[f.legality] || "legal"]));
const card = (name, type, legal = {}, extra = {}) => ({ name, type_line: type, oracle_text: "", color_identity: [], legalities: L(legal), ...extra });
const cat = (...cs) => Object.fromEntries(cs.map((c) => [cardKey(c.name), c]));
const deck = (format, cards, commander = "") => ({ id: "d", format, commander, cards });
const issues = (d, c) => validateDeck(d, c, []).issues.map((i) => i.kind + ":" + i.text);

assert.equal(FORMATS.length, 22);
assert.equal(formatOf("Modern").size, 60);
assert.equal(formatOf("nonsense").name, "60-card casual");
assert.equal(formatOf({ format: "Commander" }).life, 40);

const bolt = card("Lightning Bolt", "Instant"), mountain = card("Mountain", "Basic Land — Mountain");
const twin = card("Splinter Twin", "Enchantment — Aura", { modern: "banned" });
const lotus = card("Black Lotus", "Artifact", { vintage: "restricted", legacy: "banned", modern: "not_legal" });
const C = cat(bolt, mountain, twin, lotus);

// Modern: 60 minimum, 4 copies, banned list.
assert.deepEqual(issues(deck("Modern", [{ name: "Lightning Bolt", qty: 4 }, { name: "Mountain", qty: 56 }]), C), []);
assert.match(issues(deck("Modern", [{ name: "Lightning Bolt", qty: 4 }, { name: "Mountain", qty: 50 }]), C).join(), /count:54 cards\. Modern needs at least 60/);
assert.match(issues(deck("Modern", [{ name: "Lightning Bolt", qty: 5 }, { name: "Mountain", qty: 55 }]), C).join(), /more than 4 copies/);
assert.match(issues(deck("Modern", [{ name: "Splinter Twin", qty: 1 }, { name: "Mountain", qty: 59 }]), C).join(), /Splinter Twin: banned in Modern/);
// 61+ is fine outside exact-size formats.
assert.deepEqual(issues(deck("Modern", [{ name: "Mountain", qty: 75 }]), C), []);
// Vintage restricted: one copy.
assert.deepEqual(issues(deck("Vintage", [{ name: "Black Lotus", qty: 1 }, { name: "Mountain", qty: 59 }]), C), []);
assert.match(issues(deck("Vintage", [{ name: "Black Lotus", qty: 2 }, { name: "Mountain", qty: 58 }]), C).join(), /restricted in Vintage — one copy only/);
assert.match(issues(deck("Legacy", [{ name: "Black Lotus", qty: 1 }, { name: "Mountain", qty: 59 }]), C).join(), /banned in Legacy/);
assert.match(issues(deck("Modern", [{ name: "Black Lotus", qty: 1 }, { name: "Mountain", qty: 59 }]), C).join(), /not legal in Modern/);
// Casual formats skip legality; Limited allows any number of copies.
assert.deepEqual(issues(deck("60-card casual", [{ name: "Black Lotus", qty: 1 }, { name: "Mountain", qty: 59 }]), C), []);
assert.deepEqual(issues(deck("Limited (40-card)", [{ name: "Lightning Bolt", qty: 6 }, { name: "Mountain", qty: 34 }]), C), []);

// Commander leaders per format.
const legend = card("Krenko, Mob Boss", "Legendary Creature — Goblin", {}, { color_identity: ["R"] });
const pw = card("Chandra, Torch of Defiance", "Legendary Planeswalker — Chandra", {}, { color_identity: ["R"] });
const elf = card("Llanowar Elves", "Creature — Elf Druid");
assert.ok(canLead(legend, formatOf("Commander")) && !canLead(pw, formatOf("Commander")));
assert.ok(canLead(pw, formatOf("Oathbreaker")) && !canLead(legend, formatOf("Oathbreaker")));
assert.ok(canLead(elf, formatOf("Pauper Commander")) && !canLead(elf, formatOf("Commander")));
assert.ok(canLead(pw, formatOf("Brawl")));
// Oathbreaker: exactly 60, singleton, planeswalker leads.
const oath = cat(pw, bolt, mountain);
assert.deepEqual(issues(deck("Oathbreaker", [{ name: pw.name, qty: 1 }, { name: "Lightning Bolt", qty: 1 }, { name: "Mountain", qty: 58 }], pw.name), oath), []);
assert.match(issues(deck("Oathbreaker", [{ name: pw.name, qty: 1 }, { name: "Lightning Bolt", qty: 2 }, { name: "Mountain", qty: 57 }], pw.name), oath).join(), /singleton/);
assert.match(issues(deck("Oathbreaker", [{ name: legend.name, qty: 1 }, { name: "Mountain", qty: 59 }], legend.name), cat(legend, mountain)).join(), /planeswalker as your Oathbreaker/);
// Format-specific ban: legal in Commander, banned in Duel.
const dual = card("Sol Ring", "Artifact", { duel: "banned" });
assert.equal(legalityIn(dual, formatOf("Commander")), "legal");
assert.equal(legalityIn(dual, formatOf("Duel Commander")), "banned");
console.log("PASS: 22 formats — sizes, copy limits, banned/restricted/not-legal, commanders, Oathbreaker, Limited.");
