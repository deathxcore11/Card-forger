// A card only goes into a built deck when the deck holds what the card needs
// (deck-needs.js). Real Scryfall card text and the real candidate pools the
// builder searches (test-fixtures/deck-real-pools.json.gz, 12 Nov 2026): the
// two piles Randall reported (a colourless Walls of Ba Sing Se deck and a
// green-blue Lessons from Life deck) must not come back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { cardNeeds, inspectNeeds, idleFixer } from './deck-needs.js';
import { buildDeck } from './builder.js';
import { cardKey } from './core.js';

const fx = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/deck-real-pools.json.gz', import.meta.url))));
const extra = Object.fromEntries(fx.extra.map(c => [c.name, c])), card = n => extra[n] || Object.values(fx.pools).flat().find(c => c.name === n);
const ids = n => cardNeeds(card(n)).map(x => x.id);

// What each reported card needs.
assert.deepEqual(ids("Pirate's Cutlass"), ['sub:Pirate']);
assert.deepEqual(ids('First-Time Flyer'), ['sub:Lesson']);
assert.deepEqual(ids('Razzle-Dazzler'), ['second-spell']);
assert.deepEqual(ids('Jaded Analyst'), ['second-draw']);
assert.deepEqual(ids('Gnarlid Colony'), ['plus-counters']);
assert.deepEqual(ids('Evidence Examiner'), ['graveyard-fill']);
for (const n of ['Juggernaut', 'Essence Scatter', 'Campus Guide', 'The Walls of Ba Sing Se', 'Lessons from Life', 'Well-Worn Spatula']) assert.deepEqual(ids(n), [], n + ' needs nothing');
// Lessons from Life is a plain Sorcery, not a Lesson: it does not feed First-Time Flyer.
assert.equal(cardNeeds(card('First-Time Flyer'))[0].provides(card('Lessons from Life')), false);
// A colour fixer has nothing to fix in a colourless or one-colour deck.
for (const n of ["Giant's Boulder", 'Prophetic Prism', 'Gravestone Strider']) { assert.ok(idleFixer(card(n), ['C']), n); assert.ok(idleFixer(card(n), ['G']), n); assert.ok(!idleFixer(card(n), ['G', 'U']), n); }

// The reported lists, read back: every unsupported card is named.
const reported = [[1, 'Lessons from Life'], [4, 'First-Time Flyer'], [4, 'Razzle-Dazzler'], [4, 'Essence Scatter'], [4, 'Evidence Examiner'], [4, 'Cryotheory Adept'], [4, 'Gnarlid Colony'], [3, 'Jaded Analyst'], [4, 'Extraordinary Journey'], [4, "Giant's Boulder"]].map(([qty, n]) => ({ card: card(n), qty }));
const open = inspectNeeds(reported, { size: 60 }).filter(n => !n.met).map(n => n.name).sort();
assert.deepEqual(open, ['Evidence Examiner', 'First-Time Flyer', 'Gnarlid Colony', 'Jaded Analyst', 'Razzle-Dazzler'], 'the reported green-blue pile has five unsupported cards: ' + open);

// Builds from the real pools: no unsupported card, no idle fixer, no Giant's Boulder.
const build = (format, ci, seedName, more = []) => {
 const all = [...fx.pools[format.toLowerCase() + '|' + ci], ...fx.extra.filter(c => /Basic/.test(c.type_line) || c.name === seedName || more.includes(c.name))];
 const catalog = Object.fromEntries(all.map(c => [cardKey(c.name), c])), colors = ci === 'c' ? ['C'] : ci.toUpperCase().split('');
 const deck = buildDeck({ format, seeds: [catalog[cardKey(seedName)]], catalog, colors, price: c => Number(c.prices?.usd) || null, forgeSeed: 'ABCD', variation: 'varied', power: 'casual' });
 return { deck, rows: deck.cards.map(r => ({ card: catalog[cardKey(r.name)], qty: r.qty })), names: deck.cards.map(r => r.name) };
};
const reportedCards = fx.extra.map(c => c.name);
for (const [format, ci, seed] of [['Standard', 'c', 'The Walls of Ba Sing Se'], ['Standard', 'gu', 'Lessons from Life'], ['Standard', 'gu', 'First-Time Flyer'], ['Pioneer', 'gu', 'Lessons from Life'], ['Modern', 'ub', 'Essence Scatter'], ['Pauper', 'g', 'Gnarlid Colony']]) {
 const { deck, rows, names } = build(format, ci, seed, reportedCards), label = format + ' ' + seed;
 assert.equal(deck.total, 60, label + ' is complete');
 assert.ok(!names.includes("Giant's Boulder"), label + " has no Giant's Boulder");
 assert.ok(!names.includes("Pirate's Cutlass"), label + " has no Pirate's Cutlass");
 const unmet = inspectNeeds(rows, { size: 60 }).filter(n => !n.met && cardKey(n.name) !== cardKey(seed));
 assert.deepEqual(unmet, [], label + ' has no unsupported card: ' + JSON.stringify(unmet));
 if (ci.length < 2) assert.deepEqual(rows.filter(r => idleFixer(r.card, deck.colors)).map(r => r.card.name), [], label + ' has no idle colour fixer');
}
// Shape (12 Nov): legends are two-ofs, a big build-around brings its ramp and its lands, and the meta prior lifts real staples.
{
 const { forgeRoles } = await import('./deck-forge.js'), { metaPrior } = await import('./deck-meta-prior.js'), { shapeFaults } = await import('./deck-needs.js');
 const legend = c => /\bLegendary\b/.test((c.card_faces?.[0] || c).type_line || '');
 const walls = build('Standard', 'c', 'The Walls of Ba Sing Se', reportedCards), qty = n => walls.deck.cards.find(r => r.name === n)?.qty || 0;
 assert.equal(qty('The Walls of Ba Sing Se'), 3, 'an eight-mana legendary build-around is a three-of');
 assert.ok(walls.deck.lands >= 24, 'a deck built to reach eight mana keeps 24 lands, has ' + walls.deck.lands);
 const ramp = walls.rows.reduce((n, r) => n + (forgeRoles(r.card).includes('ramp') ? r.qty : 0), 0);
 assert.ok(ramp >= 6, 'Walls of Ba Sing Se comes with real ramp, has ' + ramp);
 for (const [format, ci, seed] of [['Standard', 'gu', 'Lessons from Life'], ['Standard', 'wb', 'Duress'], ['Legacy', 'w', 'Day of Judgment'], ['Vintage', 'u', 'Essence Scatter']]) {
  const b = build(format, ci, seed, [...reportedCards, 'Duress', 'Day of Judgment']); if (!b.deck.cards.length) continue;
  const over = b.rows.filter(r => legend(r.card) && r.qty > 2 && r.card.name !== seed).map(r => r.card.name);
  assert.deepEqual(over, [], format + ' ' + seed + ' has no legend past two copies: ' + over);
  assert.ok(b.deck.lands >= 20, format + ' ' + seed + ' has at least 20 lands, has ' + b.deck.lands);
  assert.equal(shapeFaults(b.rows, { size: 60, colors: b.deck.colors, keep: c => c.name === seed }), 0, format + ' ' + seed + ' has no shape fault');
 }
 // The tournament prior: weights follow how many lists play a card, and a staple outranks an unplayed card.
 const meta = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/mtg-meta-standard-2026-11-12.json.gz', import.meta.url)))), prior = metaPrior(meta.decks);
 assert.equal(prior.size, 126);
 assert.ok(prior.weight('Stock Up') > 0.5 && prior.weight('Pirate\'s Cutlass') === 0 && prior.weight('Gravestone Strider') === 0);
 assert.ok(prior.top(150).length === 150 && prior.lands(10).includes('Starting Town'));
 assert.equal(metaPrior(null).size, 0); assert.equal(metaPrior([]).weight('Stock Up'), 0);
}
console.log('deck needs: reported piles read correctly; 6 real-pool builds hold no unsupported card');

// Seen 12 Nov in Strong Modern builds: Kozilek's Command ({X}{C}{C}) in a deck of basic Islands, and a 60-card list with one creature.
{
 const { castableIn, isThreat } = await import('./builder.js');
 assert.equal(castableIn({ mana_cost: '{X}{C}{C}', oracle_text: '' }, ['U']), false, 'a {C} cost needs colourless sources');
 assert.equal(castableIn({ mana_cost: '{X}{C}{C}', oracle_text: '' }, ['C']), true);
 assert.equal(castableIn({ mana_cost: '{1}', oracle_text: '{T}: Add {C}{C}.' }, ['U']), true, 'making {C} is not needing it');
 assert.equal(isThreat({ type_line: 'Creature — Bear', power: '2', oracle_text: '' }), true);
 assert.equal(isThreat({ type_line: 'Creature — Wall', power: '0', oracle_text: 'Defender' }), false);
 assert.equal(isThreat({ type_line: 'Instant', oracle_text: 'Counter target spell.' }), false);
 assert.equal(isThreat({ type_line: 'Sorcery', oracle_text: 'Create two 1/1 white Soldier creature tokens.' }), true);
}

// Seen 12 Nov in a live Mono-White counters list (4.3.184): Agent Maria Hill with no teamwork card, Belladonna Took with no
// token maker, Exemplar of Light and Lyra with one real way to gain life, and four Pinnacle Starcage beside twenty of the
// cheap creatures and artifacts it exiles. Real card texts in test-fixtures/deck-input-conditions.json.
{
 const cards = JSON.parse(fs.readFileSync(new URL('./test-fixtures/deck-input-conditions.json', import.meta.url), 'utf8')), by = n => cards.find(c => c.name.startsWith(n));
 const ids = n => cardNeeds(by(n)).map(x => x.id);
 assert.deepEqual(ids('Agent Maria Hill'), ['teamwork']);
 assert.deepEqual(ids('Belladonna Took'), ['own-tokens']);
 assert.deepEqual(ids('Exemplar of Light'), ['lifegain']);
 assert.deepEqual(ids('Lyra, Archangel of Dawn'), ['lifegain']);
 assert.deepEqual(ids('Pinnacle Starcage'), ['self-sweep']);
 assert.deepEqual(ids("Healer's Hawk"), [], 'a plain lifelinker asks for nothing');
 const tokens = cardNeeds(by('Belladonna Took'))[0], life = cardNeeds(by('Exemplar of Light'))[0];
 assert.equal(tokens.provides(by('Parting Gust')), false, 'a gift token goes to the opponent');
 assert.equal(tokens.provides(by('Pinnacle Starcage')), false, 'an eight-mana activation is not a token plan');
 for (const n of ["Healer's Hawk", 'Ruin-Lurker Bat', 'Hinterland Sanctifier', 'Sheltered by Ghosts', 'Curious Farm Animals']) assert.equal(life.provides(by(n)), true, n + ' gains life');
 assert.equal(life.provides(by('Lightfoot Technique')), false);
 const row = (n, qty) => ({ card: by(n), qty }), reported = [row('Exemplar of Light', 4), row('Lyra, Archangel of Dawn', 2), row('Agent Maria Hill', 2), row('Belladonna Took', 2), row('Pinnacle Starcage', 4), row('Nurturing Pixie', 4), row('Guiding Hydra', 4), row('Lightfoot Technique', 4), row('Parting Gust', 4), row('Venat', 2), row('The Mind Stone', 2), row('Curious Farm Animals', 4)];
 const { unmetNeeds } = await import('./deck-needs.js');
 const open = unmetNeeds(reported, { size: 60 }).map(n => n.name + ':' + n.need).sort();
 assert.deepEqual(open, ['Agent Maria Hill:teamwork', 'Belladonna Took:own-tokens', 'Exemplar of Light:lifegain', 'Lyra, Archangel of Dawn:lifegain', 'Pinnacle Starcage:self-sweep'], 'every leak in the reported list is caught');
 const fixed = [row('Exemplar of Light', 4), row('Lyra, Archangel of Dawn', 2), row("Healer's Hawk", 4), row('Ruin-Lurker Bat', 4), row('Hinterland Sanctifier', 4), row('Sheltered by Ghosts', 4), row('Lightfoot Technique', 4)];
 assert.deepEqual(unmetNeeds(fixed, { size: 60 }), [], 'the same payoffs with real lifegain pass');
}
