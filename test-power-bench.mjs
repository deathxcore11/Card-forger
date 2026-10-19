// Frozen Deck Power benchmark: real placing lists, damaged copies of them and cheat lists for
// all three games, captured from live tournament data and replayed offline. Numeric cases
// retain their original bands. Unavailable eligibility and every skipped case are reported
// separately: calculating a score is not the same thing as asserting it or calibrating a format.
// Recapture: scratchpad bench scripts → test-fixtures/power-bench.json.gz.
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { S, blank } from "./store.js";
import { cache } from "./tcg.js";
import { metaState } from "./meta.js";
import { mtgPower, tcgPower, shownPower, powerEligibility } from "./power.js";
import { YGO_FORMATS } from "./ygo.js";
import { PTCG_FORMATS } from "./ptcg.js";
import { setMtgTags } from "./mtg-tags.js";

const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL("./test-fixtures/power-bench.json.gz", import.meta.url))));
S.state = blank();
S.catalog = B.mtg.cards;
setMtgTags(JSON.parse(fs.readFileSync(new URL("./mtg-tags.json", import.meta.url), "utf8")));
Object.assign(cache.ygo, B.ygo.cards);
Object.assign(cache.ptcg, B.ptcg.cards);
for (const [f, data] of Object.entries(B.mtg.meta)) Object.assign(metaState("mtg:" + f), { data, at: 1 });
for (const g of ["ygo", "ptcg"]) Object.assign(metaState(g), { data: B[g].meta, at: 1 });

let n = 0;
function formatFor(g, value) {
  const formats = g === "ygo" ? YGO_FORMATS : PTCG_FORMATS;
  const f = formats.find((x) => x.id === value || x.name === value);
  assert.ok(f, `Unknown ${g} benchmark format: ${value}`);
  return f;
}
function score(g, c) {
  const M = metaState(g === "mtg" ? "mtg:" + c.fmt : g), o = M.data;
  if (c.loo) { M.data = { ...o, decks: o.decks.filter((x) => x.key !== c.loo) }; M.at++; }
  try {
    const p = g === "mtg"
      ? mtgPower({ id: "bench" + ++n, name: "t", format: c.fmt === "EDH" ? "Commander" : c.fmt, cards: c.cards, side: c.side, commander: c.commander || undefined })
      : tcgPower(g, { id: "bench" + ++n, name: "t", format: c.fmt, zones: c.zones }, formatFor(g, c.fmt), (id) => cache[g][id] || null);
    return { shown: shownPower(p), eligibility: powerEligibility(p), readiness: p.readiness };
  } finally { if (c.loo) { M.data = o; M.at++; } }
}

// Hard damage must cost 10+ points, a core card cut to one copy or one copy of every playset
// 5+, softer damage must not beat the list it came from. Cheats (illegal lists, unknown cards)
// stay at 60 or under when a numeric rating is eligible; piles of real format staples,
// which are legal, at 65 or under. Captured Legal/Data failures instead require an explicit
// unavailable result. Null must never pass a numeric comparison by coercing to zero.
const HARD = new Set(["swap6", "swap20", "noInteraction", "wrongMana", "noHandTraps", "noStarters", "noEngine", "noExtra"]);
const MINUS5 = new Set(["minus1", "cutCore"]);
const SOFT = new Set(["noGust", "noSupDraw", "attackerTo1", "noMiddle", "unknown10", "unknown8"]);
const CHEAT = /^(fiveCopies|fourCopies|size59|size99|banned|bannedSwap|potOfGreed|extra16|allUnknown)$/, PILE = /staples|rarePile|goodstuff|consensus_5x/;
const deckOf = (c) => JSON.stringify(c.cards || [c.zones.main, c.zones.extra]), size = (c) => (c.cards || c.zones.main).reduce((a, r) => a + r.qty, 0);
function expectation(c, wc) {
  // Keep the original exclusion, but account for EVERY excluded case, not just its winner.
  if (wc?.want.caps?.some((x) => /^Legal/.test(x))) return { kind: "skipped", reason: `source list not legal at capture: ${wc.want.caps.join(", ")}` };
  // LOO changes the evidence, not the deck. Identical cards must not bypass that assertion.
  if (wc && c !== wc && c.label !== "winnerLOO" && deckOf(c) === deckOf(wc)) return { kind: "skipped", reason: "intended core mutation did not change assessed main/extra cards (sideboard differences are not this core-damage assertion)" };
  const invalid = c.want.caps.filter((x) => /^(Legal|Data)/.test(x));
  if (invalid.length) return { kind: "eligibility", reason: `captured legality/card-data failure: ${invalid.join(", ")}` };
  const label = c.label === "size61" || (c.label === "size39" && size(c) >= 40) ? "legalSize" : c.label;
  if (label === "winner") return { kind: "numeric", min: 80, reason: "winner >= 80" };
  if (label === "winnerLOO") return { kind: "numeric", min: 40, reason: "unseen winner >= 40" };
  if (CHEAT.test(label) || label === "size39") return { kind: "numeric", max: 60, reason: "cheat <= 60" };
  if (PILE.test(label)) return { kind: "numeric", max: 65, reason: "staples pile <= 65" };
  if (HARD.has(label)) return { kind: "numeric", delta: 10, reason: "hard damage <= winner - 10" };
  if (MINUS5.has(label)) return { kind: "numeric", delta: 5, reason: "core damage <= winner - 5" };
  if (SOFT.has(label) || label === "legalSize") return { kind: "numeric", delta: 0, reason: "must not beat its winner" };
  return { kind: "skipped", reason: "coverage gap: no pre-existing expectation for this label" };
}
function check(e, result, winner) {
  if (e.kind === "skipped") return null;
  if (e.kind === "eligibility") {
    const r = result.readiness;
    return result.shown === null && result.eligibility.eligible === false && !!result.eligibility.reason
      && (r?.eligible === false || r?.provisional === true)
      && !!(r?.incomplete || r?.unknown > 0 || r?.issues?.length);
  }
  if (!Number.isFinite(result.shown)) return false;
  if (e.delta !== undefined) return Number.isFinite(winner?.shown) && result.shown <= winner.shown - e.delta;
  return (e.min === undefined || result.shown >= e.min) && (e.max === undefined || result.shown <= e.max);
}

// Guard the benchmark itself: an unchanged LOO deck still asserts; null is not zero;
// unknown formats do not silently fall back to the first format in the registry.
const probe = { label: "winner", cards: [{ name: "Synthetic", qty: 60 }], want: { caps: [] } };
assert.equal(expectation({ ...probe, label: "winnerLOO", loo: "held-out" }, probe).kind, "numeric");
assert.equal(expectation({ ...probe, label: "swap6" }, probe).kind, "skipped");
assert.equal(check({ kind: "numeric", max: 60 }, { shown: null }), false);
assert.equal(check({ kind: "numeric", min: 40 }, { shown: 35 }), false);
assert.equal(check({ kind: "eligibility" }, { shown: null, eligibility: { eligible: false, reason: "Incomplete" }, readiness: { provisional: true, incomplete: true } }), true);
assert.equal(check({ kind: "eligibility" }, { shown: 0, eligibility: { eligible: false, reason: "Incomplete" }, readiness: { provisional: true, incomplete: true } }), false);
assert.equal(formatFor("ygo", "traditional").id, "traditional");
assert.equal(formatFor("ptcg", "Expanded").id, "expanded");
assert.throws(() => formatFor("ygo", "not-a-format"), /Unknown/);

const fails = [], drift = [], records = [];
for (const g of ["mtg", "ygo", "ptcg"]) {
  const got = new Map(), win = new Map();
  for (const c of B[g].cases) {
    const result = score(g, c), s = result.shown;
    assert.ok(!got.has(c.group + "/" + c.label), `Duplicate benchmark case: ${g} ${c.group} ${c.label}`);
    got.set(c.group + "/" + c.label, result);
    if (c.label === "winner") win.set(c.group, c);
    if (s !== c.want.shown) drift.push(`${g} ${c.group} ${c.label}: ${c.want.shown} → ${s}`);
  }
  for (const c of B[g].cases) {
    const result = got.get(c.group + "/" + c.label), winner = got.get(c.group + "/winner"), e = expectation(c, win.get(c.group));
    const passed = check(e, result, winner), status = passed === null ? "skipped" : passed ? "passed" : "failed";
    const failure = status !== "failed" ? null : e.kind === "numeric" && !Number.isFinite(result.shown)
      ? "coverage failure: complete/legal numeric-band case has unavailable Power"
      : e.kind === "numeric" && e.delta !== undefined && !Number.isFinite(winner?.shown)
        ? "coverage failure: numeric comparison has no numeric source winner"
        : e.kind === "eligibility" ? "expected explicit unavailable eligibility with a concrete readiness reason" : e.reason;
    records.push({ game: g, format: c.fmt, group: c.group, label: c.label, shown: result.shown, winner: winner?.shown ?? null, assertion: e.kind, status, expectation: e.reason, failure, eligibilityReason: result.eligibility.reason, readinessIssues: result.readiness?.issues || [] });
    if (failure) fails.push(`${g} ${c.group} ${c.label} = ${result.shown}: ${failure}`);
  }
}
function counts(rows) {
  const out = { executed: rows.length, asserted: rows.filter((x) => x.assertion !== "skipped").length, numeric: rows.filter((x) => x.assertion === "numeric").length, eligibility: rows.filter((x) => x.assertion === "eligibility").length, skipped: rows.filter((x) => x.status === "skipped").length, passed: rows.filter((x) => x.status === "passed").length, failed: rows.filter((x) => x.status === "failed").length };
  assert.equal(out.executed, out.asserted + out.skipped);
  assert.equal(out.asserted, out.numeric + out.eligibility);
  assert.equal(out.asserted, out.passed + out.failed);
  return out;
}
const byFormat = Object.fromEntries([...new Set(records.map((x) => `${x.game}/${x.format}`))].map((key) => [key, counts(records.filter((x) => `${x.game}/${x.format}` === key))]));
const summary = { ...counts(records), winnerLOO: counts(records.filter((x) => x.label === "winnerLOO")), byFormat };
assert.equal(summary.executed, B.mtg.cases.length + B.ygo.cases.length + B.ptcg.cases.length);
console.log("Benchmark accounting: " + JSON.stringify(summary));
for (const row of records.filter((x) => x.status === "skipped")) console.log(`SKIP: ${row.game} ${row.group} ${row.label}: ${row.expectation}`);
if (drift.length) console.log(`Note: ${drift.length} score(s) moved since capture:\n  ` + drift.slice(0, 20).join("\n  "));
if (process.env.POWER_BENCH_REPORT) fs.writeFileSync(process.env.POWER_BENCH_REPORT, JSON.stringify({ summary, records, failures: fails }, null, 2) + "\n");
assert.deepEqual(fails, [], "Deck Power left its benchmark bands");
console.log(`PASS: Deck Power benchmark — ${summary.executed} executed, ${summary.asserted} asserted (${summary.numeric} numeric, ${summary.eligibility} eligibility), ${summary.skipped} explicitly skipped. Regression evidence for the listed formats only, not all-format calibration.`);
