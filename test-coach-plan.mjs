// The deck coach with no AI: real tournament lists (and damaged copies) from the Power bench, network refused.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
const R = new URL('./', import.meta.url).pathname;
const { S, blank } = await import(R + 'store.js');
const { cache, tcgCoachHooks } = await import(R + 'tcg.js');
const { mtgCoachHooks } = await import(R + 'views.js');
const { metaState } = await import(R + 'meta.js');
const { mtgPower, tcgPower } = await import(R + 'power.js');
const { YGO_FORMATS } = await import(R + 'ygo.js');
const { PTCG_FORMATS } = await import(R + 'ptcg.js');
const { aiReviewPanel, runAiReview, coachEntry, aiReviewDialogContent } = await import(R + 'ai-review.js');
const { setMtgTags } = await import(R + 'mtg-tags.js');
const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(R + 'test-fixtures/power-bench.json.gz')));
S.state = blank(); S.catalog = B.mtg.cards; Object.assign(cache.ygo, B.ygo.cards); Object.assign(cache.ptcg, B.ptcg.cards);
setMtgTags(JSON.parse(fs.readFileSync(R + 'mtg-tags.json', 'utf8')));
for (const [f, data] of Object.entries(B.mtg.meta)) Object.assign(metaState('mtg:' + f), { data, at: 1 });
for (const g of ['ygo', 'ptcg']) Object.assign(metaState(g), { data: B[g].meta, at: 1 });
let net = 0; globalThis.fetch = () => { net++; throw Error('the coach must not use the network'); };
let n = 0;
function setup(c) {
  const id = 'cp' + ++n;
  if (c.g === 'mtg') {
    const d = { id, name: c.group, format: c.fmt === 'EDH' ? 'Commander' : c.fmt, cards: c.cards, side: c.side || [], commander: c.commander || undefined };
    const inDeck = new Set(d.cards.map(r => r.name.toLowerCase()));
    S.state.collection = Object.values(B.mtg.cards).filter(x => !inDeck.has(x.name.toLowerCase())).slice(0, 800).map((x, i) => ({ id: 'e' + i, name: x.name, qty: 1 }));
    const p = mtgPower(d);
    return { d, p, hooks: mtgCoachHooks(d, p), lookup: x => S.catalog[x.toLowerCase()] };
  }
  const f = (c.g === 'ygo' ? YGO_FORMATS : PTCG_FORMATS)[0], d = { id, name: c.group, format: c.fmt, zones: c.zones };
  const names = new Set(Object.values(c.zones).flat().map(r => cache[c.g][r.cardId]?.name));
  S.state.tcg = { ...(S.state.tcg || {}), [c.g]: { ...(S.state.tcg?.[c.g] || {}), collection: Object.values(cache[c.g]).filter(x => !names.has(x.name)).slice(0, 500).map(x => ({ cardId: x.id, name: x.name, qty: 1, key: x.id })) } };
  const lookup = x => cache[c.g][x] || null, p = tcgPower(c.g, d, f, lookup);
  return { d, p, hooks: tcgCoachHooks(c.g, d, f, p), lookup };
}
const cases = ['mtg', 'ygo', 'ptcg'].map(g => ({ g, ...B[g].cases.find(c => c.label === 'minus1' && c.fmt !== 'EDH') }));
for (const c of cases) {
  const { d, p, hooks, lookup } = setup(c), key = c.g + ':' + d.id;
  const launch = aiReviewPanel(c.g, d, lookup, p, hooks);
  assert.match(launch, /Coach this deck/); assert.doesNotMatch(launch, /OpenAI|\bAI\b/, 'the launcher says nothing about AI');
  await runAiReview(key, () => {});
  const e = coachEntry(key), r = e.result, P = e.payload.power;
  assert.equal(e.error, '', c.g + ': ' + e.error); assert.ok(r, c.g + ' has coaching');
  const top = P.areas.find(a => a.key === P.priority[0]);
  assert.equal(r.priority, P.priority[0], 'the focus is Power\'s own first priority');
  if (top) assert.ok(r.headline.includes(top.label), `${c.g} headline names ${top.label}: ${r.headline}`);
  for (const k of P.priority) assert.ok(r.explain.some(x => x.area === k), `${c.g} explains ${k}`);
  for (const x of r.explain) for (const card of x.cards) assert.ok(e.rows.some(row => row.id === card.cardId), 'explained cards are in the list');
  assert.ok(r.pilot.hand, c.g + ' reads the opening hand'); assert.ok(r.pilot.hand.odds.length, c.g + ' shows hand odds from the shuffles');
  if (c.g === 'mtg') { const lands = e.payload.hand.filter(id => /Land/.test(e.rows.find(x => x.id === id).c.type_line)).length; assert.equal(r.pilot.hand.verdict === 'keep', lands >= 2 && lands <= 5 && r.pilot.hand.reason.includes('keep'), 'keep or mulligan follows the stated land rule'); assert.ok(r.pilot.lines.length === 1 && !e.verified.lines[0].length, 'the curve line passes the mana check'); }
  if (c.g === 'ygo') assert.equal(r.pilot.hand.verdict, 'none');
  r.improve.forEach((s, i) => { const v = e.verified.swaps[i]; assert.ok(v && v.after >= v.before && !v.issues.length && (s.area ? v.area?.up : v.after > v.before), `${c.g} swap ${s.cutName} -> ${s.addName} is legal, does not lower Power and raises its area`); assert.ok(e.cands.some(x => x.id === s.add), 'the added card is one you own'); });
  assert.ok(r.field?.archetype, c.g + ' names the closest tournament list');
  for (const tab of ['deck', 'pilot', 'meta', 'improve']) { e.tab = tab; const html = aiReviewDialogContent({ ...e, tab }); assert.doesNotMatch(html, /OpenAI|AI coach|AI review|undefined|NaN/, `${c.g} ${tab} tab`); assert.ok(html.length > 400); }
  console.log(`  ${c.g}: ${r.headline} | ${r.explain.length} parts, ${r.pressure.scenarios.length} stress tests, ${r.improve.length} swaps`);
}
assert.equal(net, 0, 'no network call at all');
console.log('PASS: the deck coach is written by the app from Power, hand odds, the goldfish and the tournament field for all three games; swaps are owned, legal and re-scored; zero network calls.');
