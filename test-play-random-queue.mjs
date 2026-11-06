// Play's random deck queue: a finished deck is handed over at once, a deck in
// progress is awaited (never built twice), the queue refills after a take,
// nothing builds while a match is on, and an account change drops everything.
import assert from 'node:assert/strict';
import { createRandomDeckQueue } from './play-random-queue.js';
import { createPracticeOpponentBuilder, createRandomDeckProducer } from './play-opponent-build.js';

const tick = () => new Promise(r => setTimeout(r, 0));
let builds = 0, account = 'a', inMatch = false;
const produce = async ({ format }) => { builds++; await tick(); return { name: `${format} deck ${builds}`, format, cards: [{ name: 'Card ' + builds, qty: 1 }] }; };
const timers = [];
const queue = createRandomDeckQueue({ produce, readScope: () => [account], delay: 0, schedule: fn => timers.push(fn), idle: () => !inMatch, wait: tick });
const run = async () => { while (timers.length) timers.shift()(); for (let i = 0; i < 20; i++) await tick(); };

queue.warm([{ format: 'Commander' }, { format: 'Standard' }]);
await run();
assert.equal(builds, 2, 'one deck per format built in the background');
assert.equal(queue.peek('Commander').length, 1);
const first = queue.take({ format: 'Commander' });
assert.equal(first.name, 'Commander deck 1', 'ready deck handed over at once');
assert.equal(queue.take({ format: 'Commander' }), null, 'a taken deck is gone');
await run();
assert.equal(builds, 3, 'the queue refills after a take');

// A pending build is awaited rather than duplicated.
queue.take({ format: 'Commander' });
const pending = queue.fill({ format: 'Commander' });
assert.ok(queue.pending({ format: 'Commander' }));
queue.fill({ format: 'Commander' });
await pending; await run();
assert.equal(builds, 4);

// No background build while a match is on the table.
queue.take({ format: 'Standard' }); inMatch = true;
const before = builds; while (timers.length) timers.shift()(); for (let i = 0; i < 10; i++) await tick();
assert.equal(builds, before, 'paused during a match');
inMatch = false; await run();
assert.equal(builds, before + 1);

// Account change drops ready decks.
account = 'b';
assert.equal(queue.peek('Commander').length, 0);

// The builder takes from the queue instead of building.
let selected = null;
const pipeline = { build: async () => { throw Error('should not build'); }, recheck: () => true };
const builder = createPracticeOpponentBuilder({ pipeline, pickSeed: async () => ({ name: 'x' }), readScope: () => ['b'], onSelect: d => { selected = d; }, queue, produce });
queue.warm([{ format: 'Standard' }]); await run();
const got = await builder.build({ format: 'Standard' });
assert.ok(got && selected && selected.format === 'Standard', 'Random swaps in the queued deck');

// The producer asks the shared builder for a Casual, Varied, seeded random deck.
let seen = null;
const make = createRandomDeckProducer({ pipeline: { build: async r => { seen = r; return { ok: true, deck: { format: r.format, cards: [] }, request: { format: r.format, targetBracket: null, deckStyle: 'classic' } }; }, recheck: () => true }, pickSeed: async () => ({ name: 'Seed' }), random: () => 12345 });
await make({ format: 'Commander' });
assert.equal(seen.forge.power, 'casual'); assert.equal(seen.forge.variation, 'varied'); assert.match(seen.forge.seed, /^[A-Z0-9]{6}$/);
console.log('play random queue: instant hand-over, no duplicate builds, refill, paused in matches, account-scoped');

// Random decks exist for every Play format (Randall 3 Nov): Modern, Pioneer, Legacy, Vintage, Pauper, Standard Brawl too.
{
  const {createRandomDeckProducer, RANDOM_DECK_FORMATS} = await import('./play-opponent-build.js');
  const asked = [];
  const produce = createRandomDeckProducer({comboChance: 0, forgeSeed: () => 'ABC234', pickSeed: async r => ({name: 'Seed ' + r.format}),
    pipeline: {build: async req => { asked.push(req.format); return {ok: true, deck: {format: req.format, name: 'x', cards: []}, request: req}; }, recheck: () => true}});
  for (const f of ['Standard', 'Commander', 'Modern', 'Pioneer', 'Legacy', 'Vintage', 'Pauper', 'Standard Brawl']) {
    if (!RANDOM_DECK_FORMATS.includes(f)) throw Error('missing random format ' + f);
    const d = await produce({format: f});
    if (d.format !== f) throw Error('wrong format for ' + f);
  }
  let refused = false; try { await produce({format: 'Oathbreaker'}); } catch { refused = true; }
  if (!refused || asked.length !== 8) throw Error('only supported formats build');
  console.log('random decks for every format ok');
}

// Combo-aware Random (Randall 6 Nov): ~1 in 5 tries a verified mana-loop build, else the normal synergy build.
{
 const calls = [];
 const ok = r => ({ ok: true, deck: { format: r.format, cards: [] }, request: { format: r.format, targetBracket: null, deckStyle: 'classic' }, plan: { combo: { status: r.requireLoop ? 'verified' : 'not-requested' } } });
 const lucky = createRandomDeckProducer({ pipeline: { build: async r => { calls.push(r.requireLoop || null); return ok(r); }, recheck: () => true }, pickSeed: async () => ({ name: 'Seed' }), random: () => 100 });
 const deck = await lucky({ format: 'Modern' });
 assert.deepEqual(calls, ['infinite-mana']); assert.equal(deck.practiceBuild.combo, 'verified-mana-loop');
 calls.length = 0;
 const unlucky = createRandomDeckProducer({ pipeline: { build: async r => { calls.push(r.requireLoop || null); if (r.requireLoop) return { ok: false }; return ok(r); }, recheck: () => true }, pickSeed: async () => ({ name: 'Seed' }), random: () => 100 });
 const plain = await unlucky({ format: 'Modern' });
 assert.deepEqual(calls, ['infinite-mana', null], 'falls back to the normal build when no verified loop fits'); assert.equal(plain.practiceBuild.combo, null);
 calls.length = 0;
 const none = createRandomDeckProducer({ pipeline: { build: async r => { calls.push(r.requireLoop || null); return ok(r); }, recheck: () => true }, pickSeed: async () => ({ name: 'Seed' }), random: () => 12345 });
 await none({ format: 'Modern' }); assert.deepEqual(calls, [null], 'most decks are plain synergy builds');
 console.log('combo-aware random ok');
}
