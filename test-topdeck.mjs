import assert from "node:assert/strict";
import { parseDecklist, parseDeckObj, normalizeTopdeck } from "./topdeck.js";

const text = "~~Mainboard~~\n4 Lightning Bolt\n4x Goblin Guide\n20 Mountain\n~~Sideboard~~\n2 Smash to Smithereens";
const p = parseDecklist(text);
assert.deepEqual(p.main.map((x) => x.qty), [4, 4, 20]);
assert.equal(p.side[0].name, "Smash to Smithereens");
assert.equal(parseDecklist("https://moxfield.com/decks/abc"), null, "a link isn't a list");
const cmd = parseDecklist("~~Commanders~~\n1 Atraxa, Grand Unifier\n~~Mainboard~~\n1 Sol Ring");
assert.equal(cmd.commanders[0].name, "Atraxa, Grand Unifier");
assert.deepEqual(parseDeckObj({ Mainboard: { "Lightning Bolt": { count: 4 }, Mountain: 20 }, Sideboard: { Duress: { quantity: 2 } } }).side, [{ qty: 2, name: "Duress" }]);

const st = (n, extra = {}) => ({ name: "P" + n, standing: n, wins: 5, losses: 1, draws: 0, ...extra });
const raw = [
  { TID: "a", tournamentName: "Modern Open", startDate: 1760000000, topCut: 8, standings: [st(1, { decklist: text, archetype: "Burn" }), st(2, { deckObj: { Mainboard: { Ragavan: 4 } }, archetype: "Rakdos" }), st(3, { decklist: "https://moxfield.com/x", archetype: "Burn" }), st(4), ...Array.from({ length: 20 }, (_, i) => st(i + 5, { decklist: text, archetype: "Burn" }))] },
  { TID: "a", tournamentName: "duplicate", standings: [] },
];
const d = normalizeTopdeck(raw, { format: "Modern", days: 30 });
assert.equal(d.coverage.events, 1, "duplicate events are dropped");
assert.equal(d.coverage.players, 24);
assert.equal(d.coverage.topSlots, 8, "only the top cut is kept");
assert.deepEqual([d.coverage.withList, d.coverage.structured, d.coverage.linkOnly, d.coverage.missing], [6, 1, 1, 1]);
assert.equal(d.decks[0].place, "1st");
assert.equal(d.decks[0].record, "5-1");
assert.equal(d.archetypes[0].name, "Burn");
assert.equal(d.archetypes[0].lists, 5);
assert.ok(Math.abs(d.archetypes[0].share - 5 / 6) < 1e-9, "share is of published top-cut lists");
// Spec example shape (bulk: no "standing" field, order = placement) and team events skipped.
const bulk = normalizeTopdeck([{ TID: "w", tournamentName: "Weekly EDH", startDate: 1627844461, format: "EDH", topCut: 8, standings: [{ name: "Player Name", decklist: "~~Commanders~~\nAtraxa, Grand Unifier\n~~Mainboard~~\n1 Sol Ring", wins: 4, draws: 1, losses: 0 }] }, { TID: "team", tournamentName: "2HG", standings: [{ name: "Team A", players: [{ id: "1", name: "A" }] }] }], { format: "EDH", days: 30 });
assert.equal(bulk.decks.length, 1);
assert.equal(bulk.decks[0].place, "1st");
assert.equal(bulk.decks[0].commander, "Atraxa, Grand Unifier");
assert.equal(bulk.decks[0].record, "4-0-1");
assert.equal(bulk.coverage.events, 1, "team events aren't counted as decks");
console.log("PASS: TopDeck lists (text, structured, links), top-cut only, duplicates dropped, coverage counts and archetype share.");
