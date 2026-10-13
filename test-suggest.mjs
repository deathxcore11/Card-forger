// Suggestions: names from each game's source, starting-with first; recent searches capped and deduped.
import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const { suggestNames, rememberSearch, recentSearches } = await import("./suggest.js");
const fake = (body) => async () => ({ ok: true, json: async () => body });
assert.deepEqual(await suggestNames("mtg", "sol", fake({ data: ["Bolt of Sol", "Sol Ring", "Sol Ring // Sol Ring", "Solemn Offering"] })), ["Sol Ring", "Solemn Offering", "Bolt of Sol"]);
assert.deepEqual(await suggestNames("ygo", "dark mag", fake({ data: [{ name: "Dark Magician Girl" }, { name: "Dark Magician" }] })), ["Dark Magician", "Dark Magician Girl"]);
assert.deepEqual(await suggestNames("ptcg", "pika", fake([{ id: "a", name: "Pikachu" }, { id: "b", name: "Pikachu" }, { id: "A1-1", name: "Pikachu ex" }])), ["Pikachu"], "duplicates and Pocket cards dropped");
assert.deepEqual(await suggestNames("mtg", "s", fake({ data: ["x"] })), [], "one letter: nothing yet");
for (const q of ["Sol Ring", "Lightning Bolt", "sol ring", "t:angel", "Counterspell"]) rememberSearch("mtg", q);
assert.deepEqual(recentSearches("mtg"), ["Counterspell", "sol ring", "Lightning Bolt"], "newest first, no dupes, syntax queries skipped");
console.log("PASS: search suggestions and recent searches.");
