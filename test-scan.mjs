import assert from "node:assert/strict";
import { scanNamesFor, ygoSetCodes, ygoPasscodes, ptcgNumbers, mtgCollector } from "./scan.js";

const ygo = "Blue-Eyes White Dragon\n[DRAGON/NORMAL]\nThis legendary dragon is a powerful engine of destruction.\nATK/3000 DEF/2500\nLOB-EN0O1\n89631139\n1st Edition";
assert.deepEqual(ygoSetCodes(ygo), ["LOB-EN001"], "set code, with O read as 0");
assert.deepEqual(ygoPasscodes(ygo), ["89631139"]);
assert.equal(scanNamesFor("ygo", ygo)[0], "Blue-Eyes White Dragon");
assert.deepEqual(ygoSetCodes("MP23-EN125 · RA03 - EN016"), ["MP23-EN125", "RA03-EN016"]);

const pk = "BASIC\nPikachu ex HP190\nPika-Pika Parade\nSearch your deck for any number of Basic Pokémon\nweakness x2 resistance retreat\nIllus. 5ban Graphics\n053/128 ★★";
assert.deepEqual(ptcgNumbers(pk), [{ num: "053", total: "128" }]);
assert.equal(scanNamesFor("ptcg", pk)[0], "Pikachu ex", "HP is stripped and BASIC ignored");

const mtg = "Lightning Bolt\nInstant\nLightning Bolt deals 3 damage to any target.\n0157/0281 C\nFDN • EN  Christopher Moeller";
assert.deepEqual(mtgCollector(mtg), { set: "fdn", number: "157" });
assert.equal(mtgCollector("Lightning Bolt\nInstant"), null);
// Real misreads from a phone-quality OCR pass.
assert.deepEqual(mtgCollector("162/274 R E\nM21 + EN %> LEESHA HANNIGAN"), { set: "m21", number: "162" });
assert.equal(scanNamesFor("ygo", "DARK MAGICIAN HE)\n3555505")[0], "DARK MAGICIAN");
const pk2 = "5 Pikachu@X 41904)\nx Pika-Pika Parade\n(3) EE 0537128 Ne—— ;";
assert.equal(scanNamesFor("ptcg", pk2)[0], "Pikachu ex");
assert.deepEqual(ptcgNumbers(pk2), [{ num: "053", total: "128" }]);
console.log("PASS: scan text — Yu-Gi-Oh! set codes and passcodes, Pokémon collector numbers, Magic set + collector number, names per game.");
import { nameCandidates } from "./scan.js";
assert.equal(nameCandidates("mtg", "snce1 Eldegoss")[0], "Eldegoss", "junk tokens with digits are dropped");
assert.ok(nameCandidates("mtg", "Ase Eldegoss %& Hk").includes("Eldegoss"));
assert.equal(nameCandidates("mtg", "Lightning Bolt\nInstant")[0], "Lightning Bolt");
assert.ok(nameCandidates("ygo", "DARK MAGICIAN HE)").includes("DARK MAGICIAN"));
console.log("PASS: name candidates from noisy OCR (\"snce1 Eldegoss\" → Eldegoss).");
import { similarity, prefixQuery } from "./scan.js";
assert.deepEqual(mtgCollector("162/274 R 2 ¢ M21 « EN »% LEESHA"), { set: "m21", number: "162" });
assert.ok(similarity("DAR MACICTAN", "Dark Magician") > 0.65 && similarity("DAR MACICTAN", "A Deal with Dark Ruler") < 0.5);
assert.equal(prefixQuery("DAR MACICTAN"), "DAR MAC");
assert.equal(scanNamesFor("ptcg", "5 Pikachu@?  _~")[0], "Pikachu ex", "the ex logo read as @? still means ex");
console.log("PASS: near-miss names — similarity ranking and forgiving prefix search.");
