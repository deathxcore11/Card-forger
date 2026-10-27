// Pokémon and Yu-Gi-Oh! deck pages: art tiles with power, Power tab, Upgrade lab from
// placing lists of the same archetype, and power on saved versions.
import assert from "node:assert/strict";
import { S, blank } from "./store.js";
import { cache, tcgDeck, tcgDecks, metaState } from "./tcg.js";
import { blankGame } from "./games.js";
import { archetypeUpgrades } from "./deckpower.js";

// Pure upgrade logic.
const mine = new Map([["a", 3], ["b", 1], ["z", 2]]),
  lists = [1, 2, 3].map((i) => ({ rows: new Map([["a", 3], ["b", 3], ["c", 2], ...(i === 1 ? [["z", 1]] : [])]), labels: new Map([["a", "A"], ["b", "B"], ["c", "C"]]) }));
const up = archetypeUpgrades(mine, lists);
assert.deepEqual(up.adds.map((x) => [x.key, x.need]), [["b", 2], ["c", 2]]);
assert.ok(!up.cuts.length || up.cuts.every((x) => x.key !== "a"));

S.state = blank();
S.state.tcg = { ygo: blankGame(), ptcg: blankGame() };
// Yu-Gi-Oh! fixture: an intentionally invalid 40-card list (34 copies of Filler) and a reference list of the same archetype.
const mk = (id, name, extra = {}) => (cache.ygo[id] = { game: "ygo", id, name, category: "Monster", text: "", level: 4, artSchema: 1, fetchedAt: new Date().toISOString(), prices: { usd: 1.5 }, image: "", ...extra });
mk("1", "Mitsurugi Starter", { text: "Add 1 monster from your Deck to your hand.", archetype: "Mitsurugi" });
mk("2", "Mitsurugi Extender", { text: "You can Special Summon this card from your hand.", archetype: "Mitsurugi" });
mk("3", "Ash Blossom & Joyous Spring", { text: "(Quick Effect): You can discard this card; negate that effect." });
mk("4", "Filler", {});
mk("5", "Mitsurugi Ritual", { category: "Spell", text: "Add 1 Ritual monster from your Deck to your hand." });
const deck = { id: "y1", name: "Mitsurugi", format: "tcg", zones: { main: [{ cardId: "1", name: "Mitsurugi Starter", qty: 3 }, { cardId: "2", name: "Mitsurugi Extender", qty: 3 }, { cardId: "4", name: "Filler", qty: 34 }], extra: [], side: [] }, versions: [{ id: "v1", label: "Before", at: Date.now(), zones: { main: [{ cardId: "4", name: "Filler", qty: 40 }], extra: [], side: [] } }] };
S.state.tcg.ygo.decks = [deck];
S.state.settings.game = "ygo";
const ids = (arr) => arr.flatMap(([id, n]) => Array(n).fill(id));
const M = metaState("ygo");
M.data = { source: "fixture", decks: [1, 2].map((i) => ({ key: "k" + i, name: "Mitsurugi", rank: i, place: i === 1 ? "Winner" : "Runner-Up", main: ids([["1", 3], ["2", 3], ["3", 3], ["5", 2], ["4", 29]]), extra: [], side: [] })), archetypes: [{ name: "Mitsurugi", count: 2, share: 0.12 }], top: [{ id: "3", name: "Ash Blossom & Joyous Spring", pct: 80, avg: 3 }] };
M.at = Date.now();

let html = tcgDecks();
assert.match(html, /deck-tile tcg-tile tile-ygo/, "same art tile style as Magic");
// No exact edition quote is known for this list: the tile says so instead of printing $0.
assert.match(html, /—<\/em> value unavailable · 40 unpriced/);
assert.doesNotMatch(html, /\$0<\/em> (?:value|to finish)/);
assert.match(html, /power-chip/);
S.ui.tdeckTab = { "ygo:y1": "insights" };
html = tcgDeck("y1");
assert.match(html, /Deck Power/);
assert.match(html, /Matches: Mitsurugi/);
assert.match(html, /power unavailable<\/button>/);assert.doesNotMatch(html, /<b>null<\/b>/);
S.ui.tdeckTab = { "ygo:y1": "upgrade" };
html = tcgDeck("y1");
assert.match(html, /Make it play like Mitsurugi/);
assert.match(html, /Ash Blossom/);
assert.match(html, /data-act="tDeckAdd" data-id="3"/);
S.ui.tdeckTab = { "ygo:y1": "versions" };
const versions=tcgDeck("y1");assert.match(versions, /Power then <b>Unavailable<\/b> → now <b class="">Unavailable<\/b>/);assert.doesNotMatch(versions, /<b(?: class="[^"]*")?>null<\/b>/);
console.log("PASS: Yu-Gi-Oh! art tiles, Power tab with tournament match, Upgrade lab adds and unavailable version Power for illegal copy counts.");

// Pokémon renders without card data or meta (no crash, prompts to load).
S.state.settings.game = "ptcg";
S.state.tcg.ptcg.decks = [{ id: "p1", name: "Dragapult", format: "standard", zones: { main: [{ cardId: "sv6-130", name: "Dragapult ex", qty: 3 }], extra: [], side: [] } }];
S.ui.tdeckTab = { "ptcg:p1": "upgrade" };
assert.match(tcgDeck("p1"), /Upgrade lab/);
S.ui.tdeckTab = { "ptcg:p1": "insights" };
assert.match(tcgDeck("p1"), /Deck Power/);
console.log("PASS: Pokémon deck page renders Power and Upgrade lab without data.");
