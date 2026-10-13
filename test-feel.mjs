// Haptic choices by action, and the off switch.
import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
let buzz = [];
Object.defineProperty(globalThis, "navigator", { value: { vibrate: (p) => buzz.push(p), userAgent: "Android" }, configurable: true });
const F = await import("./feel.js");
assert.equal(F.hapticFor("sessClear"), "warn");
assert.equal(F.hapticFor("deckDel"), "warn");
assert.equal(F.hapticFor("tOwn"), "tap");
assert.equal(F.hapticFor("x", { getAttribute: (a) => (a === "role" ? "tab" : null), closest: () => null, dataset: {} }), "tick");
F.haptic("success");
assert.deepEqual(buzz.at(-1), F.PATTERNS.success);
F.setHaptics(false);
F.haptic("success");
assert.equal(buzz.length, 1, "off means off");
console.log("PASS: haptics map actions to the right feel and respect the setting.");
