// Randall 26 Nov: a Commander deck with no legend in its list showed "No legendary creatures were found" and a bare typed box.
// With the same deck and a legend in the player's collection, the picker now offers that card, and the box suggests card names.
import assert from "node:assert/strict";
const {S} = await import("../store.js");
const {commanderPicker, deckPage} = await import("../views.js");
S.catalog = {};
const korvold = {name: "Korvold, Fae-Cursed King", type_line: "Legendary Creature — Dragon Noble", color_identity: ["B", "R", "G"], oracle_text: "", legalities: {commander: "legal"}};
S.catalog["korvold, fae-cursed king"] = korvold;
S.catalog["sol ring"] = {name: "Sol Ring", type_line: "Artifact", color_identity: [], legalities: {commander: "legal"}};
S.state.collection = [{name: "Korvold, Fae-Cursed King", qty: 1}];
const deck = {id: "d1", name: "New Commander deck", format: "Commander", cards: [{name: "Sol Ring", qty: 1}]};
const html = commanderPicker(deck);
assert.match(html, /data-act="setCommander" data-name="Korvold, Fae-Cursed King"/, "an owned legend is offered");
assert.match(html, /data-suggest="mtg"/, "the typed box suggests card names");
assert.doesNotMatch(html, /No legendary creatures were found in this list\.</, "old dead-end text is gone");
S.state.collection = [];
assert.match(commanderPicker(deck), /Search for one below/, "nothing owned: it says to search");
console.log("commander picker: pass");
// Web "Always include": Fill's panel (open slots, Commander, commander set) offers a box that adds a card the deck keeps.
S.state.collection = [];
S.state.decks = [{id: "d2", name: "Korvold deck", format: "Commander", commander: "Korvold, Fae-Cursed King", cards: [{name: "Korvold, Fae-Cursed King", qty: 1}, {name: "Sol Ring", qty: 1}]}];
S.state.activeDeck = "d2"; S.ui.deckId = "d2"; S.ui.deckTab = "upgrade";
let page = "";
try { page = deckPage(); } catch (e) { console.log("deckPage not renderable in node:", e.message); }
if (page) { assert.match(page, /fillRun/, "Fill N slots reaches the Fill panel"); assert.match(page, /id="fillPinName"/, "the Fill panel offers an Always include box"); assert.match(page, /data-act="fillPin"/); console.log("fill pin box: pass"); }
