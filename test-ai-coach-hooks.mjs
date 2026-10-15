// AI coach hooks on real tournament lists: owned candidates are legal and new to the deck, and a
// proposed swap is re-scored by the app's own Deck Power, in all three games.
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { S, blank } from "./store.js";
import { cache, tcgCoachHooks } from "./tcg.js";
import { mtgCoachHooks } from "./views.js";
import { mtgPower, tcgPower, powerReadiness } from "./power.js";
import { YGO_FORMATS } from "./ygo.js";
import { PTCG_FORMATS } from "./ptcg.js";
import { aiReviewPanel, runAiReview, reviewPayload } from "./ai-review.js";

const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL("./test-fixtures/power-bench.json.gz", import.meta.url))));
S.state = blank(); S.catalog = B.mtg.cards;
Object.assign(cache.ygo, B.ygo.cards); Object.assign(cache.ptcg, B.ptcg.cards);

// Magic Commander: owned cards outside the commander's colors never become candidates.
const edh = B.mtg.cases.find((c) => c.fmt === "EDH");
const d = { id: "hk", name: "t", format: "Commander", cards: edh.cards, commander: edh.commander };
const inDeck = new Set(d.cards.map((r) => r.name.toLowerCase()));
S.state.collection = Object.values(B.mtg.cards).filter((c) => !inDeck.has(c.name.toLowerCase())).slice(0, 400).map((c, i) => ({ id: "e" + i, name: c.name, qty: 1 }));
const pw = mtgPower(d), hooks = mtgCoachHooks(d, pw), ident = S.catalog[edh.commander.toLowerCase()].color_identity;
const cands = hooks.candidates();
assert.ok(cands.length > 0 && cands.length <= 60);
assert.ok(cands.every((c) => !inDeck.has(c.name.toLowerCase()) && (c.color_identity || []).every((x) => ident.includes(x))), "owned, new to the deck, inside the commander's colors");
const cutRow = { zone: "main", row: d.cards.find((r) => r.name !== edh.commander && !/^(Forest|Island|Swamp|Mountain|Plains)$/.test(r.name)) };
const v = hooks.rescore(cutRow, cands[0]);
assert.ok(Number.isFinite(v.before) && Number.isFinite(v.after));
assert.ok(!(v.issues || []).some((i) => /outside the commander/.test(i)), "a candidate swap stays legal");
// Power picks the candidates: test-added cards that raise a weak area's count come first, labelled.
const weakKeys = pw.parts.filter((x) => x.ratio < 0.9).map((x) => x.key), lands = cands.find((c) => /Land/.test(c.type_line || ""));
if (lands && weakKeys.includes("Lands")) assert.ok(hooks.probe(lands).find((x) => x.key === "Lands").count > pw.parts.find((x) => x.key === "Lands").count, "Power counts a probed land toward Lands");
aiReviewPanel("mtg", d, (n) => S.catalog[n.toLowerCase()], pw, hooks);
let mtgSent; await runAiReview("mtg:hk", () => {}, async (u, init) => { mtgSent = JSON.parse(init.body); return Response.json({}, { status: 500 }); });
assert.ok(mtgSent.candidates.length <= 25 && mtgSent.candidates.some((c) => c.helps), "candidates carry the Power areas they raise");
assert.ok(mtgSent.candidates.findIndex((c) => !c.helps) === -1 || mtgSent.candidates.slice(0, mtgSent.candidates.findIndex((c) => !c.helps)).every((c) => c.helps), "helpers first");
console.log(`PASS: Magic coach swap re-scored by Deck Power (${v.before} → ${v.after}); ${mtgSent.candidates.filter((c) => c.helps).length} owned candidates raise a weak Power area (e.g. ${mtgSent.candidates.find((c) => c.helps)?.name}: ${mtgSent.candidates.find((c) => c.helps)?.helps}).`);

for (const g of ["ygo", "ptcg"]) {
  const c = B[g].cases[0], f = (g === "ygo" ? YGO_FORMATS : PTCG_FORMATS)[0], dd = { id: "hk" + g, name: "t", format: c.fmt, zones: c.zones };
  const names = new Set(Object.values(c.zones).flat().map((r) => cache[g][r.cardId]?.name));
  S.state.tcg = { ...(S.state.tcg || {}), [g]: { ...(S.state.tcg?.[g] || {}), collection: Object.values(cache[g]).filter((x) => !names.has(x.name)).slice(0, 300).map((x) => ({ cardId: x.id, name: x.name, qty: 1, key: x.id })) } };
  // Plant owned cards the deck can't legally play (e.g. an old Pokémon printing in Standard).
  const base = new Set(powerReadiness(g, dd, f, (x) => cache[g][x] || null).issues);
  const illegal = Object.values(cache[g]).filter((x) => !names.has(x.name) && powerReadiness(g, { ...dd, zones: { ...dd.zones, main: [...dd.zones.main, { cardId: x.id, name: x.name, qty: 1 }] } }, f, (y) => cache[g][y] || null).issues.some((i) => !base.has(i) && i.includes(x.name))).slice(0, 15);
  S.state.tcg[g].collection.unshift(...illegal.map((x) => ({ cardId: x.id, name: x.name, qty: 1, key: x.id })));
  const p = tcgPower(g, dd, f, (x) => cache[g][x] || null), h = tcgCoachHooks(g, dd, f, p), cs = h.candidates();
  if (illegal.length) assert.ok(!cs.some((x) => illegal.some((y) => y.id === x.id)), g + ": owned cards that aren't legal in this format are never offered as swaps");
  console.log(`PASS: ${g === "ygo" ? "Yu-Gi-Oh!" : "Pokémon"} swap candidates exclude ${illegal.length} owned cards that aren't legal here.`);
  assert.ok(cs.length > 0 && cs.every((x) => !names.has(x.name)), g + ": candidates are owned and new to the deck");
  const r = dd.zones.main[0], out = h.rescore({ zone: "main", row: r }, cs[0]);
  assert.ok(Number.isFinite(out.before) && Number.isFinite(out.after), g + ": swap re-scored");
  // End to end: the payload carries facts and a hand, and the candidates go out with the request.
  aiReviewPanel(g, dd, (x) => cache[g][x] || null, p, h);
  let sent; await runAiReview(g + ":" + dd.id, () => {}, async (u, init) => { sent = JSON.parse(init.body); return Response.json({ error: 1 }, { status: 500 }); });
  assert.equal(sent.hand.length, g === "ygo" ? 5 : 7); assert.ok(sent.facts.length > 10); assert.ok(sent.candidates.length > 0);
  assert.ok(new Blob([JSON.stringify(sent)]).size < 240000, g + ": request fits the server limit");
  // "Helps" follows Power's ratio, not raw counts: adding a card never "helps" an oversized deck's size.
  const big = sent.power.areas.find((a) => a.key === "Size" && Number(a.count) > Number(a.target));
  if (big) assert.ok(!sent.candidates.some((c) => (c.helps || "").includes(big.label)), g + ": adding cards doesn't count as fixing an oversized deck");
  console.log(`PASS: ${g === "ygo" ? "Yu-Gi-Oh!" : "Pokémon"} coach swap re-scored (${out.before} → ${out.after}); request carries ${sent.facts.length} facts, a ${sent.hand.length}-card hand and ${sent.candidates.length} owned candidates.`);
}
const big = reviewPayload("mtg", d, (n) => S.catalog[n.toLowerCase()], pw);
assert.ok(new Blob([JSON.stringify(big)]).size < 200000, "a 100-card Commander request fits with room for candidates");
console.log("PASS: A 100-card Commander coaching request fits the server's size limit.");
