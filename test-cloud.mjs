// Sync decisions: never silently overwrite data on either side.
import assert from "node:assert/strict";
import { decideSync, workspaceSig, isEmptyWorkspace, summarize } from "./cloud.js";

const ws = (cards, extra = {}) => ({ version: 3, collection: cards.map((n, i) => ({ id: "e" + i, name: n, qty: 1 })), decks: [], wishlist: [], references: [], settings: {}, ...extra });
const A = ws(["Sol Ring"]), B = ws(["Sol Ring", "Arcane Signet"]), empty = ws([]);
const me = "user-1";
const meta = (state, revision) => ({ userId: me, revision, sig: workspaceSig(state) });

// First sign-in, empty account.
assert.equal(decideSync({ cloud: null, meta: null, userId: me, local: empty }), "upload");
assert.equal(decideSync({ cloud: null, meta: null, userId: me, local: A }), "offer");
// First sign-in on a device; the account has data.
assert.equal(decideSync({ cloud: { data: A, revision: 3 }, meta: null, userId: me, local: empty }), "adopt");
assert.equal(decideSync({ cloud: { data: A, revision: 3 }, meta: null, userId: me, local: ws([], { example: true, collection: [{ id: "x", name: "Example", qty: 1 }] }) }), "adopt");
assert.equal(decideSync({ cloud: { data: A, revision: 3 }, meta: null, userId: me, local: B }), "choose");
assert.equal(decideSync({ cloud: { data: A, revision: 3 }, meta: null, userId: me, local: { ...A, lastSavedAt: "x" } }), "link");
// A different account signs in on this device: treated like a first sign-in.
assert.equal(decideSync({ cloud: { data: A, revision: 3 }, meta: { ...meta(B, 3), userId: "user-2" }, userId: me, local: B }), "choose");
// Normal running.
assert.equal(decideSync({ cloud: { data: A, revision: 3 }, meta: meta(A, 3), userId: me, local: A }), "none");
assert.equal(decideSync({ cloud: { data: A, revision: 3 }, meta: meta(A, 3), userId: me, local: B }), "push");
assert.equal(decideSync({ cloud: { data: B, revision: 4 }, meta: meta(A, 3), userId: me, local: A }), "adopt");
// Both changed since the last sync.
assert.equal(decideSync({ cloud: { data: B, revision: 4 }, meta: meta(A, 3), userId: me, local: ws(["Mind Stone"]) }), "conflict");
// The account copy went backwards (restored elsewhere): ask.
assert.equal(decideSync({ cloud: { data: B, revision: 2 }, meta: meta(A, 3), userId: me, local: A }), "choose");

assert.equal(workspaceSig({ ...A, lastSavedAt: "a" }), workspaceSig({ ...A, lastSavedAt: "b" }));
assert.notEqual(workspaceSig(A), workspaceSig(B));
assert.ok(isEmptyWorkspace(empty) && !isEmptyWorkspace(A));
assert.equal(summarize(B).copies, 2);
console.log("PASS: sync decisions — upload, offer, adopt, choose, push, conflict, never a silent overwrite.");
