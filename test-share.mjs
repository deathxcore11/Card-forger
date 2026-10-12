// Share links round-trip and the "almost build" scoring.
import assert from "node:assert/strict";
import { sharePayload, encodeShare, decodeShare, deckFromPayload, buildability, rankBuildable } from "./share.js";

const deck = { name: "Elves <script>", commander: "Lathril, Blade of the Elves", format: "Commander", strategy: "Tokens", budget: 150, cards: [{ name: "Lathril, Blade of the Elves", qty: 1 }, { name: "Llanowar Elves", qty: 1 }, { name: "Forest", qty: 30 }, { name: "Swamp", qty: 10 }] };
const code = await encodeShare(sharePayload(deck, { author: "Randall", about: "Go wide.\nKeep 2 lands + a dork." }));
assert.match(code, /^z\.[A-Za-z0-9_-]+$/);
const back = await decodeShare(code);
assert.equal(back.name, deck.name);
assert.equal(back.commander, deck.commander);
assert.equal(back.author, "Randall");
assert.equal(back.budget, 150);
assert.equal(back.cards.find((c) => c.name === "Forest").qty, 30);
assert.equal(back.cards.reduce((n, c) => n + c.qty, 0), 42);
// A link never carries ownership or collection data.
assert.deepEqual(Object.keys(sharePayload(deck)).sort(), ["a", "b", "c", "d", "f", "l", "n", "s", "v"]);
// Damaged links fail clearly.
await assert.rejects(decodeShare("z.!!!"), /damaged/);
await assert.rejects(decodeShare("j." + Buffer.from(JSON.stringify({ v: 1, l: [["X", 0]] })).toString("base64url")), /invalid card/);
assert.throws(() => deckFromPayload({ v: 2, l: ["A"] }), /damaged/);
// A 100-card deck makes a link short enough to paste anywhere.
const big = { ...deck, cards: Array.from({ length: 99 }, (_, i) => ({ name: "Some Fairly Long Card Name Number " + i, qty: 1 })) };
assert.ok((await encodeShare(sharePayload(big))).length < 2500);

// Buildability: free copies only, unknown prices counted separately.
const own = { "Llanowar Elves": 1, Forest: 40 };
const s = buildability(deck, (n) => own[n] || 0, (n) => ({ "Lathril, Blade of the Elves": 2.5, Swamp: 0.1 })[n] ?? null);
assert.equal(s.owned, 31);
assert.equal(s.missing, 11);
assert.equal(Math.round(s.cost * 100), 350);
assert.equal(s.unknown, 0);
const s2 = buildability(deck, () => 0, () => null);
assert.equal(s2.unknown, 42);
const s3 = buildability(deck, () => 0, () => null, (n) => n === "Forest" || n === "Swamp");
assert.equal(s3.total, 2);
assert.equal(s3.skipped, 40);
const ranked = rankBuildable([{ deck: { name: "A" }, score: { cost: 50, ratio: 0.9 } }, { deck: { name: "B" }, score: { cost: 5, ratio: 0.2 } }], { maxCost: 40 });
assert.deepEqual(ranked.map((x) => x.deck.name), ["B"]);

console.log("PASS: share links round-trip without ownership data, damaged links rejected, buildability and ranking.");
