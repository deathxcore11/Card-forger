// Seen 16 Nov 2026 by Randall: a Standard Random build at Power "Strong" (Monoist Sentry) read 57 power, and the
// number did not move with the Power dial. Cause: one label, two scales. A list matched to tournament results is
// scored against the field (72 to 100). Every other list was shown the model score alone, and on that score 28 real
// Magic Online Standard lists read a median of 53 (46 to 84), so any deck outside the known lists landed near 50.
// The model score is now re-anchored (a real tournament list reads at the top of the unproven band) and the share
// of the list's cards that current tournament lists play counts beside it.
// Fixtures: the card pools the site loaded for the reported builds and the 131 lists it served that day.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { S } from './store.js';
import { cardKey } from './core.js';
import { buildDeck } from './builder.js';
import { mtgPower, shownPower, calibrateConstructedPower, POWER_CALIBRATION, powerPanel } from './power.js';
import { BUILD_CAP } from './deckpower.js';
import { metaState } from './meta.js';
import { metaPrior } from './deck-meta-prior.js';

const read = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/' + name, import.meta.url))));
const fx = read('random-build-rubble-rouser-2026-11-16.json.gz'), fx2 = read('random-build-pools-2026-11-17.json.gz');
for (const c of [...fx.cards, ...fx2.cards]) S.catalog[cardKey(c.name)] = c;
const prior = metaPrior(fx.decks);

// The calibration itself.
assert.equal(calibrateConstructedPower(null), null, 'no model score: no power');
assert.equal(calibrateConstructedPower(53, 1), BUILD_CAP, 'a real tournament list (model median 53, every card played) reads at the top of the unproven band');
assert.ok(calibrateConstructedPower(100, 1) <= BUILD_CAP, 'a list with no results of its own never passes the cap');
assert.ok(BUILD_CAP < 72, 'and the cap sits below every list proven by results (72 to 100)');
for (let m = 0; m < 100; m += 7) {
 assert.ok(calibrateConstructedPower(m + 7, 0.5) >= calibrateConstructedPower(m, 0.5), 'a better model score never lowers power');
 assert.ok(calibrateConstructedPower(m, 0.9) >= calibrateConstructedPower(m, 0.3), 'more cards that real lists play never lowers power');
}
assert.equal(calibrateConstructedPower(50, null), calibrateConstructedPower(50, 0.5), 'with no tournament data the played share counts as half');
assert.ok(calibrateConstructedPower(34, 0) < 50, 'a pile of cards nobody plays stays low: ' + calibrateConstructedPower(34, 0));

const build = (seed, colors, power) => buildDeck({ format: 'Standard', seeds: [S.catalog[cardKey(seed)]], base: [{ name: seed, qty: 1 }], catalog: S.catalog, colors, price: c => Number(c?.prices?.usd) || null, prior: c => prior.weight(c.name), power });
const score = (deck, id) => mtgPower({ ...deck, id });

// With no tournament data loaded the model score is shown re-anchored, the played share counting as half.
{
 const p = score(build('Monoist Sentry', ['B'], 'strong'), 'no-meta');
 assert.equal(p.from, 'build'); assert.ok(p.modelScore != null && p.calibration?.played === null);
 assert.equal(shownPower(p), calibrateConstructedPower(p.modelScore, null));
}

// With the day's 131 lists loaded, as on the site.
const M = metaState('mtg:Standard'); M.data = { decks: fx.decks, archetypes: [] }; M.at = Date.now();
const shown = {};
for (const [seed, colors] of [['Monoist Sentry', ['B']], ['Rubble Rouser', ['R']], ['Drogskol Reaver', ['W', 'U']]]) for (const power of ['casual', 'strong', 'max']) {
 const p = score(build(seed, colors, power), seed + power), label = seed + ' at ' + power + ': ';
 assert.equal(p.from, 'rogue', label + 'not a known tournament list');
 assert.equal(shownPower(p), p.score, label + 'one number everywhere');
 assert.equal(p.score, Math.min(calibrateConstructedPower(p.modelScore, p.ctx.played), p.caps?.[0]?.max ?? 100), label + 'the shown power is the calibrated model score');
 assert.ok(p.score <= BUILD_CAP, label + 'stays under the cap for lists with no results');
 shown[seed + power] = { power: p.score, model: p.modelScore, played: p.ctx.played };
}
// The reported build: Monoist Sentry at Strong read 57 (50 on this pool). It now reads in the sixties.
assert.ok(shown['Monoist Sentrystrong'].power >= 62, 'Monoist Sentry at Strong reads ' + shown['Monoist Sentrystrong'].power);
// The number follows the Power dial: Strong and Max never read lower than Casual, and Rubble Rouser moves clearly.
for (const seed of ['Monoist Sentry', 'Rubble Rouser', 'Drogskol Reaver']) for (const power of ['strong', 'max'])
 assert.ok(shown[seed + power].power >= shown[seed + 'casual'].power, seed + ': ' + power + ' ' + shown[seed + power].power + ' is not below casual ' + shown[seed + 'casual'].power);
assert.ok(shown['Rubble Rouserstrong'].power - shown['Rubble Rousercasual'].power >= 3, 'Rubble Rouser: Strong reads at least 3 above Casual (' + shown['Rubble Rousercasual'].power + ' to ' + shown['Rubble Rouserstrong'].power + ')');
// A pile of commons no list plays reads clearly below every build.
{
 const junk = fx.cards.filter(c => !/Land/.test(c.type_line) && (c.color_identity || []).every(k => k === 'R') && prior.weight(c.name) === 0 && c.rarity === 'common').slice(0, 9);
 const p = score({ format: 'Standard', cards: [...junk.map(c => ({ name: c.name, qty: 4 })), { name: 'Mountain', qty: 24 }], side: [] }, 'junk');
 assert.ok(p.score < Math.min(...Object.values(shown).map(x => x.power)), 'the junk pile (' + p.score + ') reads below every build');
}
// A real list matched to its own results keeps the field's score: the calibration does not touch proven lists.
{
 const real = fx.decks.find(d => d.main.every(r => S.catalog[cardKey(r.name)]) && (d.side || []).every(r => S.catalog[cardKey(r.name)]));
 if (real) { const p = score({ format: 'Standard', cards: real.main.map(r => ({ name: r.name, qty: r.qty })), side: (real.side || []).map(r => ({ name: r.name, qty: r.qty })) }, 'real');
  assert.ok(['meta', 'mixed'].includes(p.from), 'a real list matches the field'); assert.equal(p.calibration, undefined, 'and is not recalibrated'); }
}
// The Power page says where the number comes from.
{
 const html = powerPanel(score(build('Monoist Sentry', ['B'], 'strong'), 'panel'));
 assert.match(html, /re-anchored by \+17/); assert.match(html, /stops at 70/);
}
assert.equal(POWER_CALIBRATION.cap, BUILD_CAP);
console.log('power calibration: ' + Object.entries(shown).map(([k, v]) => k + ' ' + v.model + '→' + v.power).join(', '));
