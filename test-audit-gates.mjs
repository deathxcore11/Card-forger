import assert from "node:assert/strict";
import { metaMatch, metaContext } from "./deckpower.js";
import { listSig, forList, recordOf } from "./matchup.js";
import { withSnapshot } from "./insights.js";
// Core quantities: one copy where every list of the archetype plays four is "short", not fine.
const mk = (name, rows, rank = 1) => ({ key: name + rank, name, archetype: "Tron", rank, rows: new Map(rows), labels: new Map(rows.map(([k]) => [k, k])) });
const tron = [["karn", 4], ["map", 4], ["stone", 4], ["mine", 4], ["filler", 24]];
const decks = [mk("Tron", tron, 1), mk("Tron", tron, 2), mk("Tron", tron, 3), { ...mk("Burn", [["bolt", 4], ["filler", 24], ["guide", 4]], 4), archetype: "Burn" }, { ...mk("Elves", [["elf", 4], ["filler", 24]], 5), archetype: "Elves" }];
const full = new Map(tron), oneKarn = new Map([...tron.filter(([k]) => k !== "karn"), ["karn", 1], ["bears", 3]]);
const a = metaMatch(full, decks), b = metaMatch(oneKarn, decks);
assert.equal(a.coreShort.length, 0);
assert.deepEqual(b.coreShort.map((x) => [x.key, x.have, x.qty]), [["karn", 1, 4]]);
const sa = metaContext({ build: 85, mine: full, decks, match: a, loaded: true }).score, sb = metaContext({ build: 85, mine: oneKarn, decks, match: b, loaded: true });
assert.ok(sa - sb.score >= 12, `cutting three of four core copies costs real points (${sa} → ${sb.score})`);
assert.notEqual(sb.from, "meta", "a list short on its core doesn't borrow the archetype's results outright");
// Logged games belong to the exact list they were played with.
const v1 = listSig({ main: [{ name: "Karn", qty: 4 }], side: [{ name: "Bears", qty: 2 }] }),
  v2 = listSig({ main: [{ name: "Karn", qty: 4 }], side: [{ name: "Bears", qty: 3 }] });
assert.notEqual(v1, v2, "a sideboard change is a new list");
assert.equal(v1, listSig({ side: [{ name: "bears", qty: 2 }], main: [{ name: "karn", qty: 4 }] }), "order and case don't matter");
const games = [{ opp: "Burn", res: "W", sig: v1 }, { opp: "Burn", res: "L", sig: v2 }, { opp: "Burn", res: "L" }];
const { current, earlier } = forList(games, v2);
assert.equal(recordOf(current).n, 1);
assert.equal(earlier.length, 2, "untagged and older-list games stay out of the numbers");
// Versions keep the sideboard, and a sideboard-only change is a new version.
let d = withSnapshot({ cards: [{ name: "Karn", qty: 4 }], side: [{ name: "Bears", qty: 2 }], versions: [] }, "a");
d = withSnapshot({ ...d, side: [{ name: "Bears", qty: 3 }] }, "b");
d = withSnapshot(d, "unchanged");
assert.deepEqual(d.versions.map((v) => v.side[0].qty), [2, 3]);
console.log("PASS: core quantities, untagged/earlier-list games and sideboard-aware list fingerprints and versions.");
