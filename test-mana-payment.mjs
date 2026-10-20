// Synthetic arrangements, not a user's list. Individual public card data is an
// independent parser check, never a target score or an exact-deck fixture.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardKey, validateDeck } from "./core.js";
import { engineProfile, manaPaymentProfile } from "./insights.js";
import { manaBase, deckReview } from "./extras.js";
import { manaBasePanel, deckReviewSheet } from "./views.js";
import { S, blank } from "./store.js";

const card = (name, mana_cost, extra = {}) => ({
  name, mana_cost, type_line: "Creature — Test", cmc: 2,
  colors: ["W"], color_identity: ["W"],
  legalities: { standard: "legal", commander: "legal" }, ...extra,
});
const basic = (name, color) => card(name, "", { type_line: `Basic Land — ${name}`, produced_mana: [color], cmc: 0, color_identity: [color] });
const plains = basic("Plains", "W"), island = basic("Island", "U");
const white = Array.from({ length: 8 }, (_, i) => card(`White fixture ${i + 1}`, "{1}{W}"));
const hybrid = card("Hybrid fixture", "{W/U}{W/U}", { colors: ["W", "U"], color_identity: ["W", "U"] });
const blue = card("True blue fixture", "{U}{U}", { colors: ["U"], color_identity: ["U"] });
const catalogOf = (...cards) => Object.fromEntries(cards.map(c => [cardKey(c.name), c]));
const catalog = catalogOf(plains, island, ...white, hybrid, blue);
const deck = {
  id: "synthetic-mana", name: "Synthetic mana checks", format: "Standard", side: [],
  cards: [{ name: "Plains", qty: 24 }, ...white.map(c => ({ name: c.name, qty: 4 })), { name: hybrid.name, qty: 4 }],
};
const manaReview = (d, c = catalog) => deckReview(d, c).find(x => x.title === "Review your basic-land split");
const beforeDeck = JSON.stringify(deck), beforeCatalog = JSON.stringify(catalog);
const profile = engineProfile(deck, catalog);
assert.deepEqual(profile.pips, { W: 40, U: 0, B: 0, R: 0, G: 0 });
assert.deepEqual(manaBase(deck, catalog, profile.pips, profile.mana).suggested, { W: 24 });
assert.equal(manaReview(deck), undefined, "white-payable hybrid costs never invent an Island requirement");
assert.match(profile.mana.notes.join(" "), /Hybrid fixture.*\{W\/U\} accepts white or blue/);
assert.match(profile.mana.notes.join(" "), /counted once/);
assert.equal(profile.mana.required.U, 0);

// Independent public card parser corroboration, not the user's deck arrangement.
const publicSpider = JSON.parse(readFileSync(new URL("./test-fixtures/aura-mechanic-cards.json", import.meta.url))).cards.find(c => c.name === "Skyward Spider");
assert.equal(publicSpider.mana_cost, "{W/U}{W/U}");
assert.equal(manaPaymentProfile([{ card: publicSpider, qty: 1 }], { W: 1 }).pips.W, 2);
assert.equal(manaPaymentProfile([{ card: publicSpider, qty: 1 }], { W: 1 }).pips.U, 0);

// Real blue symbols remain demand. The message identifies cards, printed costs,
// the actual split and the suggested split instead of a vague color mismatch.
const trueBlue = { ...deck, cards: deck.cards.map(r => r.name === hybrid.name ? { name: blue.name, qty: 4 } : { ...r }) };
const warning = manaReview(trueBlue);
assert.ok(warning?.heuristic);
assert.match(warning.detail, /Current basics: 24 Plains/);
assert.match(warning.detail, /Suggested guideline: 19 Plains, 5 Islands/);
assert.match(warning.detail, /4× True blue fixture \(\{U\}\{U\}\)/);
assert.match(warning.detail, /not a requirement/);
assert.deepEqual(warning.cards, [blue.name]);

// Hybrid-only plans prefer existing sources, with an honest even estimate only
// when neither required colors nor source evidence distinguishes the options.
const entry = [{ card: hybrid, qty: 3 }];
assert.deepEqual(manaPaymentProfile(entry, { U: 8 }).pips, { W: 0, U: 6, B: 0, R: 0, G: 0 });
assert.deepEqual(manaPaymentProfile(entry, { W: 6, U: 2 }).pips, { W: 4.5, U: 1.5, B: 0, R: 0, G: 0 });
assert.deepEqual(manaPaymentProfile(entry).pips, { W: 3, U: 3, B: 0, R: 0, G: 0 });
for (const [name, type_line] of [["Plains", "Basic Land — Plains"], ["Snow-Covered Plains", "Basic Snow Land — Plains"]]) {
  for (const produced_mana of [undefined, []]) {
    const land = { ...plains, name, type_line, produced_mana },
      c = catalogOf(land, hybrid),
      d = { format: "Standard", cards: [{ name, qty: 24 }, { name: hybrid.name, qty: 4 }] },
      p = engineProfile(d, c);
    assert.equal(p.sources.W, 24, "known basic subtype gives a source even when produced_mana is absent/empty");
    assert.equal(p.pips.U, 0, "hybrid-only white sources do not invent blue demand");
    assert.equal(manaBase(d, c, p.pips, p.mana).off, false);
  }
}
const phyrexian = manaPaymentProfile([{ card: card("Optional fixture", "{W}{U/P}{B/R/P}{2/G}"), qty: 2 }]);
assert.deepEqual(phyrexian.pips, { W: 2, U: 0, B: 0, R: 0, G: 0 });
assert.match(phyrexian.notes.join(" "), /blue mana or 2 life/);
assert.match(phyrexian.notes.join(" "), /black or red mana or 2 life/);
assert.match(phyrexian.notes.join(" "), /green mana or two mana of any type/);
assert.match(phyrexian.notes.join(" "), /optional color is not forced/);

const noColor = manaPaymentProfile([{ card: card("Other costs", "{X}{3}{C}{S}{Y}{Z}"), qty: 2 }]);
assert.equal(Object.values(noColor.pips).reduce((n, x) => n + x, 0), 0);
assert.equal(noColor.complete, true);
assert.match(noColor.notes.join(" "), /colorless mana needs separate sources/);
assert.match(noColor.notes.join(" "), /snow mana needs separate sources/);
const noSplit = manaBase(deck, catalog, noColor.pips, noColor);
assert.equal(noSplit.canSuggest, false);
assert.equal(noSplit.off, false);
assert.equal(noSplit.suggested.W, 24, "zero colored demand never suggests removing all basics");

// Don't count transformed backs or land faces as a second spell requirement.
const front = { name: "Front", mana_cost: "{W}", type_line: "Creature" },
  back = { name: "Back", mana_cost: "{U}{U}", type_line: "Creature" };
const transform = manaPaymentProfile([{ card: card("Transform fixture", "", { layout: "transform", card_faces: [front, back] }), qty: 1 }]);
assert.equal(transform.pips.W, 1); assert.equal(transform.pips.U, 0);
const mdfc = manaPaymentProfile([{ card: card("Modal land fixture", "", { layout: "modal_dfc", card_faces: [front, { name: "Back land", mana_cost: "", type_line: "Land" }] }), qty: 1 }]);
assert.equal(mdfc.pips.W, 1); assert.equal(mdfc.complete, true);
for (const layout of ["split", "modal_dfc"]) {
  const alternative = manaPaymentProfile([{ card: card("Alternative fixture", "{W} // {U}{U}", { layout, card_faces: [front, back] }), qty: 1 }]);
  assert.equal(alternative.complete, false);
  assert.match(alternative.notes.join(" "), /alternative spell costs \{W\} or \{U\}\{U\}/);
  assert.equal(manaBase(deck, catalog, alternative.pips, alternative).canSuggest, false);
}
const unknown = manaPaymentProfile([{ card: card("Unsupported fixture", "{HW}"), qty: 1 }]);
assert.equal(unknown.complete, false);
assert.match(unknown.notes.join(" "), /not modeled/);
for (const missingOrMalformed of [undefined, null, 12, "WU", "{W", "{W} junk"]) {
  const incomplete = manaPaymentProfile([{ card: card("Incomplete fixture", missingOrMalformed), qty: 1 }]);
  assert.equal(incomplete.complete, false);
  assert.match(incomplete.notes.join(" "), /Incomplete fixture: casting-cost data is missing or unsupported/);
}
assert.equal(manaPaymentProfile([{ card: card("Explicit no cost", ""), qty: 1 }]).complete, true);
const landBackSpell = card("Land first fixture", "", { layout: "modal_dfc", type_line: "Land // Creature", card_faces: [{ type_line: "Land", mana_cost: "" }, back] });
const landBackProfile = engineProfile({ ...deck, cards: [{ name: landBackSpell.name, qty: 1 }, ...deck.cards] }, { ...catalog, [cardKey(landBackSpell.name)]: landBackSpell });
assert.equal(landBackProfile.mana.complete, false);
assert.match(landBackProfile.mana.notes.join(" "), /Land first fixture: alternative spell costs a land face or \{U\}\{U\}/);
const missingCardProfile = engineProfile({ ...deck, cards: [{ name: "Unknown card", qty: 1 }, ...deck.cards] }, catalog);
assert.equal(missingCardProfile.mana.complete, false);
assert.match(missingCardProfile.mana.notes.join(" "), /Unknown card: casting-cost data is missing/);
const unresolvedLand = card("Unresolved source fixture", "", { type_line: "Land", produced_mana: [] });
const sourceProfile = engineProfile({ ...deck, cards: [{ name: unresolvedLand.name, qty: 1 }, ...deck.cards] }, { ...catalog, [cardKey(unresolvedLand.name)]: unresolvedLand });
assert.match(sourceProfile.mana.notes.join(" "), /Unresolved source fixture: no mana production is listed in the cached source data/);
assert.equal(sourceProfile.mana.complete, true, "source-data caveat does not invent or erase printed payment requirements");
assert.equal(sourceProfile.sources.W, 24);

// Commander eligibility still uses the full W/U identity, not payment choices.
const commander = card("White leader", "{W}", { type_line: "Legendary Creature — Test" });
const commanderDeck = { format: "Commander", commander: commander.name, cards: [{ name: commander.name, qty: 1 }, { name: hybrid.name, qty: 1 }] };
assert.ok(validateDeck(commanderDeck, catalogOf(commander, hybrid), [], []).issues.some(i => i.kind === "color"));

// Both rendered surfaces use real evidence and escape card-name content.
S.state = blank(); S.catalog = catalog;
const panel = manaBasePanel(deck, profile);
assert.match(panel, /Payment choices and limits/);
assert.match(panel, /Hybrid fixture.*\{W\/U\}\{W\/U\}/);
assert.doesNotMatch(panel, /<span>Island<\/span>/);
assert.match(panel, /Commander color identity is checked separately/);
const sheet = deckReviewSheet(trueBlue);
assert.match(sheet, /Guideline/); assert.match(sheet, /24 Plains/); assert.match(sheet, /5 Islands/);
assert.match(sheet, /data-name="True blue fixture"/);
const escaped = card('<script>alert("x")</script>', "{U}{U}", { color_identity: ["U"] });
S.catalog = catalogOf(plains, ...white, escaped);
const escapedDeck = { ...trueBlue, cards: trueBlue.cards.map(r => r.name === blue.name ? { name: escaped.name, qty: 4 } : r) };
const escapedSheet = deckReviewSheet(escapedDeck);
assert.doesNotMatch(escapedSheet, /<script>/);
assert.match(escapedSheet, /&lt;script&gt;/);
assert.equal(JSON.stringify(deck), beforeDeck); assert.equal(JSON.stringify(catalog), beforeCatalog);
console.log("PASS: payment-aware basic-land guidance, named evidence, hybrid/optional/colorless/snow/face controls, unchanged Commander identity and read-only rendering.");
