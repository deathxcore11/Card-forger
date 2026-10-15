// AI coach evaluation against Deck Power, on real tournament lists and damaged copies of them.
// Sends real reviews to the deployed app (costs a few cents of the owner's OpenAI credit each) and
// measures, by code:
//   follows Power   the coach's focus is Power's own top priority (or its top three)
//   covers Power    share of Power's cap/weak areas the coach explains
//   finds damage    on a damaged list, the focus/headline names the area that was damaged
//   identity        the win cards it names include what Power's played-out games win with
//   consistency     the same list reviewed again names the same core cards and focus
//   grounding       lines passing the app's rule checks, swaps that don't lower Power, swaps whose
//                   targeted Power area actually improves, and suggestions dropped for bad citations
// Usage: NODE_USE_ENV_PROXY=1 node scripts/coach-eval.mjs <out.json> [repeats=3]
import fs from "node:fs";
import zlib from "node:zlib";
const R = new URL("../", import.meta.url).pathname;
const { S, blank } = await import(R + "store.js");
const { cache, tcgCoachHooks } = await import(R + "tcg.js");
const { mtgCoachHooks } = await import(R + "views.js");
const { metaState } = await import(R + "meta.js");
const { mtgPower, tcgPower } = await import(R + "power.js");
const { YGO_FORMATS } = await import(R + "ygo.js");
const { PTCG_FORMATS } = await import(R + "ptcg.js");
const { aiReviewPanel, runAiReview, coachEntry } = await import(R + "ai-review.js");
const { setMtgTags } = await import(R + "mtg-tags.js");

const OUT = process.argv[2] || "coach-eval.json", REPEATS = Number(process.argv[3] || 3);
const ORIGIN = "https://cardforge2.deathxcore11.workers.dev";
const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(R + "test-fixtures/power-bench.json.gz")));
S.state = blank(); S.catalog = B.mtg.cards; Object.assign(cache.ygo, B.ygo.cards); Object.assign(cache.ptcg, B.ptcg.cards);
setMtgTags(JSON.parse(fs.readFileSync(R + "mtg-tags.json", "utf8")));
for (const [f, data] of Object.entries(B.mtg.meta)) Object.assign(metaState("mtg:" + f), { data, at: 1 });
for (const g of ["ygo", "ptcg"]) Object.assign(metaState(g), { data: B[g].meta, at: 1 });

// What each kind of damage removes, in words a review that noticed it would use.
const DAMAGE = { wrongMana: /mana|land|colou?r|source/i, noInteraction: /interact|removal|answer|counter|disrupt/i, noStarters: /starter|consisten|search|open/i, noHandTraps: /hand.?trap|interrupt|disrupt|interaction|negat/i, noSupDraw: /draw|supporter|consisten/i, noGust: /gust|boss|switch|pull|bench/i };
const pick = (g, labels, groups) => groups.flatMap((grp) => labels.map((l) => B[g].cases.find((c) => c.group === grp && c.label === l)).filter(Boolean).map((c) => ({ g, ...c })));
const mtgGroups = [...new Set(B.mtg.cases.filter((c) => c.label === "winner").map((c) => c.group))];
const edh = mtgGroups.find((grp) => B.mtg.cases.find((c) => c.group === grp && c.fmt === "EDH")), con = mtgGroups.find((grp) => B.mtg.cases.find((c) => c.group === grp && c.fmt !== "EDH" && c.label === "wrongMana"));
const ygoGroups = [...new Set(B.ygo.cases.map((c) => c.group))].slice(0, 2), ptcgGroups = [...new Set(B.ptcg.cases.filter((c) => c.label === "noGust").map((c) => c.group))].slice(0, 2);
const CASES = [...pick("mtg", ["winner"], [edh]), ...pick("mtg", ["winner", "wrongMana", "noInteraction"], [con]), ...pick("ygo", ["winner", "noStarters", "noHandTraps"], ygoGroups), ...pick("ptcg", ["winner", "noSupDraw", "noGust"], ptcgGroups)];

let n = 0;
function setup(c) {
  const id = "ev" + ++n;
  if (c.g === "mtg") {
    const d = { id, name: c.group, format: c.fmt === "EDH" ? "Commander" : c.fmt, cards: c.cards, side: c.side || [], commander: c.commander || undefined };
    const inDeck = new Set(d.cards.map((r) => r.name.toLowerCase()));
    S.state.collection = Object.values(B.mtg.cards).filter((x) => !inDeck.has(x.name.toLowerCase())).slice(0, 800).map((x, i) => ({ id: "e" + i, name: x.name, qty: 1 }));
    const p = mtgPower(d);
    return { d, p, hooks: mtgCoachHooks(d, p), lookup: (x) => S.catalog[x.toLowerCase()] };
  }
  const f = (c.g === "ygo" ? YGO_FORMATS : PTCG_FORMATS)[0], d = { id, name: c.group, format: c.fmt, zones: c.zones };
  const names = new Set(Object.values(c.zones).flat().map((r) => cache[c.g][r.cardId]?.name));
  S.state.tcg = { ...(S.state.tcg || {}), [c.g]: { ...(S.state.tcg?.[c.g] || {}), collection: Object.values(cache[c.g]).filter((x) => !names.has(x.name)).slice(0, 500).map((x) => ({ cardId: x.id, name: x.name, qty: 1, key: x.id })) } };
  const lookup = (x) => cache[c.g][x] || null, p = tcgPower(c.g, d, f, lookup);
  return { d, p, hooks: tcgCoachHooks(c.g, d, f, p), lookup };
}
async function run(c) {
  const { d, p, hooks, lookup } = setup(c);
  aiReviewPanel(c.g, d, lookup, p, hooks);
  const t = Date.now(), key = c.g + ":" + d.id;
  await runAiReview(key, () => {}, (u, init) => fetch(ORIGIN + u, { ...init, headers: { ...init.headers, Origin: ORIGIN } }));
  const e = coachEntry(key), r = e.result, P = e.payload.power;
  if (!r) return { case: `${c.g} ${c.group} ${c.label}`, error: e.error };
  const areaLabel = (k) => P.areas.find((a) => a.key === k)?.label || "";
  const text = [r.headline, areaLabel(r.priority), ...(r.explain || []).filter((x) => x.area === r.priority || P.priority.slice(0, 2).includes(x.area)).map((x) => x.says)].join(" ");
  const top = P.priority.filter((k) => !k.startsWith("cap:Legal")), mustExplain = P.areas.filter((a) => a.status === "cap" || a.status === "weak").map((a) => a.key);
  const win = (p.goldfish?.winCon || "").toLowerCase(), named = [...(r.identity?.winCards || []), ...(r.identity?.engineCards || [])].map((x) => x.name);
  const swaps = e.verified.swaps.filter(Boolean);
  return {
    case: `${c.g} ${c.group} ${c.label}`, g: c.g, label: c.label, group: c.group, seconds: (Date.now() - t) / 1000,
    powerTop: P.priority.slice(0, 3).map(areaLabel), focus: areaLabel(r.priority) || "(none)", headline: r.headline,
    followsTop1: top.length ? r.priority === top[0] : null, followsTop3: top.length ? top.slice(0, 3).includes(r.priority) : null,
    covers: mustExplain.length ? mustExplain.filter((k) => r.explain.some((x) => x.area === k)).length / mustExplain.length : null,
    damageFound: DAMAGE[c.label] ? DAMAGE[c.label].test(text) : null, powerFoundDamage: DAMAGE[c.label] ? DAMAGE[c.label].test(P.priority.slice(0, 2).map(areaLabel).join(" ")) : null,
    winMatchesGoldfish: named.length && win ? named.some((nm) => win.includes(nm.toLowerCase().split(/,| \/\/ /)[0])) : null,
    core: [...new Set(named)], plan: r.identity?.plan,
    lines: r.pilot.lines.length, linesPass: e.verified.lines.filter((f) => !f.length).length,
    swaps: r.improve.length, swapsRescored: swaps.length, swapsNotWorse: swaps.filter((x) => x.after >= x.before && !x.issues.length).length, swapsAreaUp: swaps.filter((x) => x.area && x.area.after > x.area.before).length,
    beyond: r.beyond.length, explain: r.explain.length, omitted: r.omitted, notes: r.notes || [],
  };
}
const pool = async (items, k, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: k }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j]); } })); return out; };
const jobs = [...CASES, ...CASES.filter((c) => c.label === "winner").flatMap((c) => Array(Math.max(0, REPEATS - 1)).fill(c))];
console.error(`${CASES.length} cases + ${jobs.length - CASES.length} repeats = ${jobs.length} live reviews`);
const results = await pool(jobs, 4, async (c) => { try { const x = await run(c); console.error("done", x.case, x.error || x.focus); return x; } catch (err) { console.error("fail", c.g, c.label, err.message); return { case: `${c.g} ${c.group} ${c.label}`, error: err.message }; } });

const ok = results.filter((x) => !x.error), rate = (xs, f) => { const v = xs.map(f).filter((x) => x !== null && x !== undefined); return v.length ? +(v.reduce((a, b) => a + Number(b), 0) / v.length).toFixed(2) : null; };
const byCase = new Map(); for (const x of ok.filter((x) => x.label === "winner")) (byCase.get(x.case) || byCase.set(x.case, []).get(x.case)).push(x);
const jac = (a, b) => { const A = new Set(a), B2 = new Set(b); const i = [...A].filter((x) => B2.has(x)).length; return A.size + B2.size - i ? i / (A.size + B2.size - i) : 1; };
const consistency = [...byCase.entries()].filter(([, xs]) => xs.length > 1).map(([k, xs]) => ({ case: k, runs: xs.length, sameFocus: xs.every((x) => x.focus === xs[0].focus), coreOverlap: +(xs.slice(1).reduce((s, x) => s + jac(xs[0].core, x.core), 0) / (xs.length - 1)).toFixed(2), focuses: xs.map((x) => x.focus) }));
const summary = {
  reviews: results.length, errors: results.filter((x) => x.error).length,
  followsPowerTop1: rate(ok, (x) => x.followsTop1), followsPowerTop3: rate(ok, (x) => x.followsTop3), coversPowerWeakAreas: rate(ok, (x) => x.covers),
  damageFoundByCoach: rate(ok.filter((x) => x.damageFound !== null), (x) => x.damageFound), damageFoundByPower: rate(ok.filter((x) => x.powerFoundDamage !== null), (x) => x.powerFoundDamage),
  winCardsMatchGoldfish: rate(ok, (x) => x.winMatchesGoldfish),
  linesPassAppChecks: +(ok.reduce((s, x) => s + x.linesPass, 0) / Math.max(1, ok.reduce((s, x) => s + x.lines, 0))).toFixed(2),
  swapsNotWorse: +(ok.reduce((s, x) => s + x.swapsNotWorse, 0) / Math.max(1, ok.reduce((s, x) => s + x.swapsRescored, 0))).toFixed(2),
  swapsImproveTheirArea: +(ok.reduce((s, x) => s + x.swapsAreaUp, 0) / Math.max(1, ok.reduce((s, x) => s + x.swapsRescored, 0))).toFixed(2),
  droppedPerReview: rate(ok, (x) => x.omitted), consistency,
};
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const x of results) console.log(x.error ? `${x.case}: ERROR ${x.error}` : `${x.case} | Power: ${x.powerTop.join(" > ")} | coach: ${x.focus} | ${x.headline}`);
