// Pokémon / Yu-Gi-Oh! Compare: facts per side and plain differences.
import assert from "node:assert/strict";
const { compareFacts, compareLines, topDamage } = await import("./tcgcompare.js");
const a = { name: "Pikachu", category: "Pokemon", hp: 60, stage: "Basic", types: ["Lightning"], retreat: 1, attacks: [{ cost: ["Lightning"], damage: "20" }], prices: { usd: 0.5 } };
const b = { name: "Raichu", category: "Pokemon", hp: 120, stage: "Stage1", types: ["Lightning"], retreat: 2, attacks: [{ cost: ["Lightning", "Colorless"], damage: "30" }, { cost: ["Lightning", "Lightning", "Colorless"], damage: "120+" }], prices: { usd: 2 } };
assert.equal(topDamage(b), 120);
const lines = compareLines("ptcg", a, b).join(" ");
assert.match(lines, /Raichu has 60 more HP/);
assert.doesNotMatch(lines, /100 more damage/);
assert.match(lines, /damage depends on effects/);
assert.match(lines, /cheapest attack needs 2 Energy \(vs 1\)/);
assert.match(lines, /costs \$1\.50 more/);
assert.ok(compareFacts("ptcg", b).some(([k, v]) => k === "Highest printed damage" && v === "120 · effect-dependent"));
const dm = { name: "Dark Magician", atk: 2500, def: 2100, level: 7, attribute: "DARK", race: "Spellcaster", typeLine: "Normal Monster", prices: { usd: 0.3 } };
const gem = { name: "Gemini Elf", atk: 1900, def: 900, level: 4, attribute: "EARTH", race: "Spellcaster", typeLine: "Gemini Monster", prices: { usd: 0.3 } };
const y = compareLines("ygo", dm, gem).join(" ");
assert.match(y, /Gemini Elf has 600 less ATK/);
assert.match(y, /Level 4; Dark Magician has Level 7/);
assert.ok(!/costs/.test(y), "same price: no price line");
assert.deepEqual(compareLines("ygo", dm, null), []);
console.log("PASS: Pokémon and Yu-Gi-Oh! compare.");

const oldCached={name:'Cached Dragon',atk:3000,level:8,typeLine:'Normal Monster',stats:[['DEF',2500]]};assert.ok(compareFacts('ygo',oldCached).some(([k,v])=>k==='DEF'&&v===2500));
const link={name:'Link',atk:2300,level:3,typeLine:'Link Monster',frame:'link'};
assert.ok(compareFacts('ygo',link).some(([k,v])=>k==='Link rating'&&v===3));assert.ok(!compareFacts('ygo',link).some(([k])=>k==='DEF'));
assert.ok(compareFacts('ygo',{...link,typeLine:'XYZ Monster',frame:'xyz'}).some(([k])=>k==='Rank'));
console.log('PASS: cached DEF, Link/XYZ labels, conditional Pokémon damage and conservative summoning claims.');
