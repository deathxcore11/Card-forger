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
