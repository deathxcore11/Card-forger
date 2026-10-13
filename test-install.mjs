// Install nudge: only for people using the app, on browsers that can install, not when installed.
import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const { shouldNudge, isIOS } = await import("./install.js");
assert.equal(shouldNudge({ copies: 0, state: { visits: 1 }, installed: false, prompt: true, ios: false }), false, "first visit, nothing saved: no nudge");
assert.equal(shouldNudge({ copies: 3, state: { visits: 1 }, installed: false, prompt: true, ios: false }), true, "cards saved: nudge");
assert.equal(shouldNudge({ copies: 0, state: { visits: 2 }, installed: false, prompt: false, ios: true }), true, "second visit on iPhone: Share-menu nudge");
assert.equal(shouldNudge({ copies: 5, state: { visits: 9 }, installed: true, prompt: true, ios: false }), false, "already installed");
assert.equal(shouldNudge({ copies: 5, state: { visits: 9, dismissedAt: Date.now() }, installed: false, prompt: true, ios: false }), false, "Not now is respected");
assert.equal(shouldNudge({ copies: 5, state: { visits: 9 }, installed: false, prompt: false, ios: false }), false, "browser can't install: nothing to show");
assert.equal(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), true);
assert.equal(isIOS("Mozilla/5.0 (Linux; Android 14)"), false);
console.log("PASS: install nudge only when it can help.");
