// Scryfall role tags: cards the text patterns miss (edicts, ETB removal, wheel draw, -X sweepers)
// still count as interaction, draw, ramp or wipes once mtg-tags.json is loaded, and tags only add.
import assert from "node:assert/strict";
import fs from "node:fs";
import { setMtgTags, mtgTagged, mtgTagsReady } from "./mtg-tags.js";
import { engineRoles } from "./insights.js";
import { mtgConstructedPower } from "./deckpower.js";

const data = JSON.parse(fs.readFileSync(new URL("./mtg-tags.json", import.meta.url), "utf8"));
for (const role of ["removal", "counter", "wipe", "draw", "ramp", "discard"]) assert.ok(data.roles[role]?.length > 50, `${role} tags present`);
assert.ok(fs.statSync(new URL("./mtg-tags.json", import.meta.url)).size < 200_000, "tag file stays small (only pattern misses)");

const gatekeeper = { name: "Gatekeeper of Malakir", type_line: "Creature — Vampire Warrior", cmc: 2, mana_cost: "{B}{B}", oracle_text: "Kicker {B}\nWhen this creature enters, if it was kicked, target player sacrifices a creature." };
const wurm = { name: "Massacre Wurm", type_line: "Creature — Phyrexian Wurm", cmc: 6, oracle_text: "When this creature enters, creatures your opponents control get -2/-2 until end of turn.\nWhenever a creature an opponent controls dies, that player loses 2 life." };
const before = engineRoles({ ...wurm });
assert.equal(mtgTagsReady(), false);
assert.equal(mtgTagged(gatekeeper, "removal"), false, "no tags before load: patterns alone decide");
setMtgTags(data);
assert.ok(mtgTagged(gatekeeper, "removal"), "Gatekeeper is tagged removal");
assert.ok(!before.includes("Wipe") && engineRoles({ ...wurm }).includes("Wipe"), "engine roles gain Wipe from the tag (one-sided -2/-2)");
assert.ok(!mtgTagged({ name: "Grizzly Bears" }, "removal"), "vanilla creature has no tag");

// Deck Power: a deck of edict creatures counts them as interaction.
const cat = { "gatekeeper of malakir": gatekeeper, swamp: { name: "Swamp", type_line: "Basic Land — Swamp", oracle_text: "", produced_mana: ["B"] } };
const p = mtgConstructedPower({ format: "Standard", cards: [{ name: "Gatekeeper of Malakir", qty: 4 }, { name: "Swamp", qty: 20 }] }, cat, (s) => s.toLowerCase(), 60);
const inter = p.parts.find((x) => x.key === "Interaction" || /Interaction/.test(x.label));
assert.ok(inter && inter.count === 4, `edicts count as interaction (got ${inter?.count})`);
console.log("PASS: Scryfall role tags add what text patterns miss (removal, engine roles, Deck Power interaction).");
