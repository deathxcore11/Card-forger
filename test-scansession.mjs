import assert from "node:assert/strict";
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const S = await import("./scansession.js");

// Defaults: per-game finish, shared rest; prefer foil changes the default finish.
assert.equal(S.loadPrefs("mtg").finish, "nonfoil");
assert.equal(S.loadPrefs("ptcg").finish, "normal");
S.savePrefs("mtg", { finish: "foil", qty: 2, lockSet: "woe" });
assert.equal(S.loadPrefs("mtg").finish, "foil"); assert.equal(S.loadPrefs("mtg").qty, 2); assert.equal(S.loadPrefs("mtg").lockSet, "woe");
assert.equal(S.loadPrefs("ygo").qty, 2, "quantity default is shared"); assert.equal(S.loadPrefs("ygo").lockSet, "", "set lock is per game");

// Session: identical rows stack; different finish or condition don't.
let list = [];
const bolt = { id: "b1", name: "Lightning Bolt", setCode: "m21", number: "162", finish: "nonfoil", condition: "Near Mint", lang: "en", qty: 1, price: 1.5 };
list = S.addToSession(list, bolt);
list = S.addToSession(list, { ...bolt, qty: 2 });
assert.equal(list.length, 1); assert.equal(list[0].qty, 3);
list = S.addToSession(list, { ...bolt, finish: "foil", price: 4 });
list = S.addToSession(list, { ...bolt, condition: "Lightly Played", price: null });
assert.equal(list.length, 3);
assert.equal(S.sessionCount(list), 5);
assert.equal(S.sessionValue(list), 3 * 1.5 + 4);
assert.equal(S.sessionUnpriced(list), 1, "unpriced copies are counted, not valued at $0");
S.saveSession("mtg", list);
assert.equal(S.loadSession("mtg").length, 3); assert.equal(S.loadSession("ptcg").length, 0, "sessions are per game");

// Export text in the format Moxfield / ManaBox import.
assert.equal(S.sessionText([{ ...bolt, qty: 2 }, { ...bolt, finish: "foil", qty: 1 }]), "1 Lightning Bolt (M21) 162 *F*\n2 Lightning Bolt (M21) 162");
console.log("PASS: scan sessions — per-game defaults, stacking rows, totals with unpriced copies, per-game lists, Moxfield-style export.");
