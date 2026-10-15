// Frozen Deck Power benchmark: real placing lists, damaged copies of them and cheat lists for
// all three games, captured from live tournament data and replayed offline. Each score must
// stay inside its band, so a change to the scoring can't quietly flatter cheats or punish winners.
// Recapture: scratchpad bench scripts → test-fixtures/power-bench.json.gz.
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { S, blank } from "./store.js";
import { cache } from "./tcg.js";
import { metaState } from "./meta.js";
import { mtgPower, tcgPower, shownPower } from "./power.js";
import { YGO_FORMATS } from "./ygo.js";
import { PTCG_FORMATS } from "./ptcg.js";

const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL("./test-fixtures/power-bench.json.gz", import.meta.url))));
S.state = blank();
S.catalog = B.mtg.cards;
Object.assign(cache.ygo, B.ygo.cards);
Object.assign(cache.ptcg, B.ptcg.cards);
for (const [f, data] of Object.entries(B.mtg.meta)) Object.assign(metaState("mtg:" + f), { data, at: 1 });
for (const g of ["ygo", "ptcg"]) Object.assign(metaState(g), { data: B[g].meta, at: 1 });

let n = 0;
function score(g, c) {
  const M = metaState(g === "mtg" ? "mtg:" + c.fmt : g), o = M.data;
  if (c.loo) { M.data = { ...o, decks: o.decks.filter((x) => x.key !== c.loo) }; M.at++; }
  try {
    if (g === "mtg") return shownPower(mtgPower({ id: "bench" + ++n, name: "t", format: c.fmt === "EDH" ? "Commander" : c.fmt, cards: c.cards, side: c.side, commander: c.commander || undefined }));
    const f = (g === "ygo" ? YGO_FORMATS : PTCG_FORMATS)[0];
    return shownPower(tcgPower(g, { id: "bench" + ++n, name: "t", format: c.fmt, zones: c.zones }, f, (id) => cache[g][id] || null));
  } finally { if (c.loo) { M.data = o; M.at++; } }
}

// Hard damage must cost 10+ points, a core card cut to one copy or one copy of every playset
// 5+, softer damage must not beat the list it came from. Cheats (illegal lists, unknown cards)
// stay at 60 or under; piles of real format staples, which are legal, at 65 or under.
const HARD = new Set(["swap6", "swap20", "noInteraction", "wrongMana", "noHandTraps", "noStarters", "noEngine", "noExtra"]);
const MINUS5 = new Set(["minus1", "cutCore"]);
const SOFT = new Set(["noGust", "noSupDraw", "attackerTo1", "noMiddle", "unknown10", "unknown8"]);
const CHEAT = /^(fiveCopies|fourCopies|size59|size99|banned|bannedSwap|potOfGreed|extra16|allUnknown)$/, PILE = /staples|rarePile|goodstuff|consensus_5x/;
const deckOf = (c) => JSON.stringify(c.cards || [c.zones.main, c.zones.extra]), size = (c) => (c.cards || c.zones.main).reduce((a, r) => a + r.qty, 0);
const fails = [], drift = [], skipped = [];
for (const g of ["mtg", "ygo", "ptcg"]) {
  const got = new Map(), win = new Map();
  for (const c of B[g].cases) {
    const s = score(g, c);
    got.set(c.group + "/" + c.label, s);
    if (c.label === "winner") win.set(c.group, c);
    if (s !== c.want.shown) drift.push(`${g} ${c.group} ${c.label}: ${c.want.shown} → ${s}`);
  }
  for (const c of B[g].cases) {
    const s = got.get(c.group + "/" + c.label), w = got.get(c.group + "/winner"), wc = win.get(c.group), where = `${g} ${c.group} ${c.label} = ${s}`;
    // A source list that is itself incomplete (98-card Commander export) is capped as illegal: right, but not a benchmark.
    if (wc?.want.caps?.some((x) => /^Legal/.test(x))) { if (c.label === "winner") skipped.push(`${g} ${c.group} (source list not legal: ${wc.want.caps.join(", ")})`); continue; }
    if (wc && c !== wc && deckOf(c) === deckOf(wc)) continue; // the change didn't apply to this list
    const label = c.label === "size61" || (c.label === "size39" && size(c) >= 40) ? "legalSize" : c.label;
    if (label === "winner") { if (s < 80) fails.push(where + " (winner < 80)"); }
    else if (label === "winnerLOO") { if (s < 40) fails.push(where + " (unseen winner < 40)"); }
    else if (CHEAT.test(label) || label === "size39") { if (s > 60) fails.push(where + " (cheat > 60)"); }
    else if (PILE.test(label)) { if (s > 65) fails.push(where + " (staples pile > 65)"); }
    else if (w == null) continue;
    else if (HARD.has(label)) { if (s > w - 10) fails.push(`${where} (hard damage, winner ${w})`); }
    else if (MINUS5.has(label)) { if (s > w - 5) fails.push(`${where} (core damage, winner ${w})`); }
    else if (SOFT.has(label) || label === "legalSize") { if (s > w) fails.push(`${where} (beats its winner ${w})`); }
  }
  console.log(`Replayed: ${g} ${B[g].cases.length} benchmark decks replayed.`);
}
if (skipped.length) console.log("Skipped: " + skipped.join("; "));
if (drift.length) console.log(`Note: ${drift.length} score(s) moved since capture:\n  ` + drift.slice(0, 20).join("\n  "));
assert.deepEqual(fails, [], "Deck Power left its benchmark bands");
console.log(`PASS: Deck Power benchmark — ${B.mtg.cases.length + B.ygo.cases.length + B.ptcg.cases.length} real, damaged and cheat decks stay in their bands.`);
