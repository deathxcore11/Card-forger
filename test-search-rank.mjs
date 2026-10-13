// Exact names first in search results ("Sol Ring" before "Solemn Offering").
import assert from "node:assert/strict";
const { rankByName } = await import("./catalog-tools.js");
const names = (l) => l.map((c) => c.name);
assert.deepEqual(names(rankByName([{ name: "Solemn Offering" }, { name: "Sol Ring" }, { name: "Sol Talisman" }, { name: "Ring of Sol" }], "Sol Ring")), ["Sol Ring", "Solemn Offering", "Sol Talisman", "Ring of Sol"]);
assert.equal(rankByName([{ name: "Dark Magician Girl" }, { name: "Dark Magician" }], "dark magician")[0].name, "Dark Magician");
assert.equal(rankByName([{ name: "Fire // Ice" }, { name: "Fireball" }], "Fire")[0].name, "Fire // Ice");
const l = [{ name: "B" }, { name: "A" }];
assert.equal(rankByName(l, "t:creature"), l, "syntax searches keep the source order");
console.log("PASS: search ranks exact names first.");
