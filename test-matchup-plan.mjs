// The matchup read with no AI: real tournament lists from the Power bench through the app's own simulation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { S, blank } from './store.js';
import { mtgConstructedPower } from './deckpower.js';
import { profileOf, simulateMatchup, gamePlan } from './matchup.js';
import { buildMatchupRequest } from './ai-matchup-core.js';
import { buildMatchupPlan } from './matchup-plan.js';
import { setMtgTags } from './mtg-tags.js';
const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/power-bench.json.gz', import.meta.url))));
S.state = blank(); S.catalog = B.mtg.cards; setMtgTags(JSON.parse(fs.readFileSync(new URL('./mtg-tags.json', import.meta.url), 'utf8')));
globalThis.fetch = () => { throw Error('the matchup read must not use the network'); };
const key = n => String(n).toLowerCase(), meta = n => S.catalog[key(n)];
const winners = B.mtg.cases.filter(c => c.label === 'winner' && c.fmt === 'Standard').slice(0, 2);
assert.equal(winners.length, 2);
const [a, b] = winners.map((c, i) => ({ id: 'm' + i, name: i ? 'Their list' : 'My list', format: 'Standard', cards: c.cards, side: c.side || [] }));
const rows = list => (list || []).map(r => ({ qty: r.qty, name: r.name, c: meta(r.name) })).filter(r => r.c);
const profile = d => profileOf('mtg', mtgConstructedPower({ cards: d.cards }, S.catalog, key, 60), rows(d.cards));
const me = profile(a), op = profile(b); assert.ok(me && op, 'both lists profile');
const request = buildMatchupRequest({ deck: a, opponent: { ...b, provenance: { kind: 'import' } }, lookup: meta, mode: 'bo3' });
const sim = simulateMatchup('mtg', me, op), plan = gamePlan('mtg', me, op, { main: rows(a.cards), side: rows(a.side), reprofile: list => profile({ cards: list.map(r => ({ name: r.c.name, qty: r.qty })) }), sim: sim.win });
const r = buildMatchupPlan({ request, me, op, sim, plan, mode: 'bo3' });
assert.equal(r.scenarios.length, 3); assert.deepEqual(r.scenarios.slice(0, 2).map(s => s.title), ['You go first', 'You go second']);
assert.match(r.summary, new RegExp(`My list wins ${Math.round(sim.win * 100)}% of 2,000 simulated games against Their list`));
assert.equal(r.outlook, sim.win >= 0.55 ? 'favorable' : sim.win <= 0.45 ? 'difficult' : 'balanced');
for (const s of r.scenarios) { for (const f of ['setup', 'plan', 'risk', 'lesson']) assert.ok(s[f] && !/undefined|NaN/.test(s[f]), s.title + ' ' + f); for (const id of s.cardIds) assert.ok(request.player.cards.some(c => c.id === id), 'sideboard cards named are in my list'); }
if ((plan.ins || []).length) { assert.equal(r.scenarios[2].title, 'After sideboarding'); for (const x of plan.ins) assert.ok(r.scenarios[2].plan.includes(x.name)); }
assert.deepEqual(buildMatchupPlan({ request, me, op, sim: simulateMatchup('mtg', me, op), plan, mode: 'bo3' }), r, 'same lists, same read');
const one = buildMatchupPlan({ request, me, op, sim, plan: null, mode: 'bo1' }); assert.equal(one.scenarios[2].title, 'A long game'); assert.match(one.scenarios[2].lesson, /Best of one/);
console.log(`  ${r.summary}`); console.log(`  3: ${r.scenarios[2].title}: ${r.scenarios[2].plan} ${r.scenarios[2].risk}`);
console.log('PASS: the matchup read comes from the app simulation and sideboard rules, is repeatable, names only real cards and uses no network.');
