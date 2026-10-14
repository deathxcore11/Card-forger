// Scouting report: two scores (Competitive vs Engine), tiers, and plain sections from real evidence.
import assert from "node:assert/strict";
import { scoutingReport, competitiveScore, competitiveTier } from "./scouting.js";
const base = { game: "mtg", plan: "Aggro", lens: "", parts: [], stats: { lands: 20, avg: 1.9, interaction: 6, flow: 2 }, heuristic: 92, score: 92 };
assert.equal(competitiveScore({ ...base, ctx: { from: "build", reason: "unloaded" } }), null, "no data → no competitive score");
assert.equal(competitiveScore({ ...base, ctx: { from: "rogue", fieldEstimate: 48, played: 0.2, lists: 40, field: [{ name: "Izzet Prowess", share: 0.14 }] } }), 48);
assert.equal(competitiveTier(48).label, "Casual / kitchen-table");
assert.match(competitiveTier(90).label, /Tier 1/);
const rogue = scoutingReport({ ...base, ctx: { from: "rogue", fieldEstimate: 48, played: 0.2, lists: 40, field: [{ name: "Izzet Prowess", share: 0.14 }] } });
assert.match(rogue, /attack from the first turns/);
assert.match(rogue, /decks to beat right now are Izzet Prowess/);
assert.match(rogue, /Built well on its own terms \(engine 92\), but against the field it rates 48/);
const meta = scoutingReport({ ...base, ctx: { from: "meta", score: 91, played: 1 }, match: { sim: 0.9, archetype: "Mono-Red Aggro", share: 0.12, bestRank: 1, missing: [] } });
assert.match(meta, /version of <b>Mono-Red Aggro<\/b>/);
assert.match(meta, /Tier 1 contender/);
console.log("PASS: scouting report: competitive vs engine, tiers, field comparison in plain words.");
