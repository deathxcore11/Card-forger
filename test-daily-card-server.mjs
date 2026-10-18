import assert from 'node:assert/strict';
import {dailyDate, nextDailyReset} from './daily-clock.js';
import {DailyCards, dailyCardRoute} from './daily-card-route.js';
const RealDate = Date;
let now = RealDate.parse('2026-10-18T03:59:59.999Z');
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
for (const [at, date, reset] of [
  ['2026-10-18T03:59:59.999Z', '2026-10-17', '2026-10-18T04:00:00.000Z'],
  ['2026-10-18T04:00:00.000Z', '2026-10-18', '2026-10-19T04:00:00.000Z'],
  ['2026-03-08T05:00:00.000Z', '2026-03-08', '2026-03-09T04:00:00.000Z'],
  ['2026-11-01T04:00:00.000Z', '2026-11-01', '2026-11-02T05:00:00.000Z'],
  ['2026-12-31T05:00:00.000Z', '2026-12-31', '2027-01-01T05:00:00.000Z'],
]) {
  assert.equal(dailyDate(Date.parse(at)), date);
  assert.equal(new Date(nextDailyReset(Date.parse(at))).toISOString(), reset);
}
class Storage {
  map = new Map(); alarm = null;
  async get(key) { return structuredClone(this.map.get(key)); }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) { this.map.delete(key); }
  async getAlarm() { return this.alarm; }
  async setAlarm(at) { this.alarm = at; }
}
const storage = new Storage(), object = new DailyCards({storage});
const names = [], env = { DAILY_CARDS: { idFromName: name => (names.push(name), name), get: () => ({fetch: url => object.fetch(new Request(url))}) } };
const lookup = (game, suffix = '') => dailyCardRoute(new Request(`https://cardstashy.com/api/daily-card?game=${game}${suffix}`), env);
const calls = {mtg: 0, ygo: 0, ptcg: 0};
globalThis.fetch = async url => {
  const game = url.includes('scryfall') ? 'mtg' : url.includes('ygoprodeck') ? 'ygo' : 'ptcg';
  const n = ++calls[game];
  return Response.json(game === 'mtg'
    ? {id: `magic-${n}`, name: `Magic ${n}`, image_uris: {art_crop: `https://example.test/${n}.jpg`}}
    : game === 'ygo' ? {data: [{id: 1, name: 'YGO one'}, {id: 2, name: 'YGO two'}]}
    : [{id: 'sv01-1', name: 'Pokémon one', image: 'https://assets.tcgdex.net/en/sv/sv01/001'}, {id: 'sv01-2', name: 'Pokémon two', image: 'https://assets.tcgdex.net/en/sv/sv01/002'}]);
};
const first = {};
for (const game of ['mtg', 'ygo', 'ptcg']) {
  const replies = await Promise.all(Array.from({length: 10}, () => lookup(game)));
  const data = await Promise.all(replies.map(r => r.json()));
  first[game] = data[0];
  assert(data.every(d => d.card.id === data[0].card.id));
  assert.equal(calls[game], 1, 'concurrent visitors share one provider lookup');
  assert.equal(data[0].date, '2026-10-17');
  assert.equal(data[0].nextResetAt, '2026-10-18T04:00:00.000Z');
  assert.equal(replies[0].headers.get('cache-control'), 'no-store');
}
assert.equal(new Set(names).size, 1, 'all users/games resolve to the same durable selection');
assert.equal((await (await lookup('mtg', '&date=2099-01-01&refresh=true')).json()).card.id, first.mtg.card.id, 'client cannot reroll or advance the date');
assert.equal(await dailyCardRoute(new Request('https://cardstashy.com/other'), env), null);
assert.equal((await lookup('bad')).status, 400);
assert.equal((await dailyCardRoute(new Request('https://cardstashy.com/api/daily-card?game=mtg', {method:'POST'}), env)).status, 405);
// Reconstructing the Durable Object keeps the same selection across restarts.
assert.equal((await (await new DailyCards({storage}).fetch(new Request('https://internal/?game=mtg'))).json()).card.id, first.mtg.card.id);
now++;
// Even if the scheduled alarm is late, the first midnight request rotates.
assert.notEqual((await (await lookup('mtg')).json()).card.id, first.mtg.card.id);
storage.alarm = null;
await object.alarm();
for (const game of ['mtg', 'ygo', 'ptcg']) {
  const today = await (await lookup(game)).json();
  assert.equal(today.date, '2026-10-18');
  assert.notEqual(today.card.id, first[game].card.id);
  assert.notEqual(today.card.name, first[game].card.name);
}
assert.equal(storage.alarm, Date.parse('2026-10-19T04:00:00Z'));
assert.equal(calls.mtg, 2); assert.equal(calls.ygo, 1); assert.equal(calls.ptcg, 1, 'daily choices reuse cached metadata pools');
// An outage never returns yesterday as today or fans out requests per visitor.
now = Date.parse('2026-10-19T04:00:00Z');
let failures = 0;
globalThis.fetch = async () => { failures++; throw Error('offline'); };
const outage = await lookup('mtg');
assert.equal(outage.status, 503); assert.equal((await outage.json()).card, undefined);
assert.equal((await lookup('mtg')).status, 503); assert.equal(failures, 1);
assert.equal(storage.alarm, now + 300_000);
// A response started yesterday is retired in favor of today's server choice.
const lateStorage = new Storage(), late = new DailyCards({storage: lateStorage});
let release;
late.pick = async () => new Promise(resolve => { release = resolve; });
const old = late.current('mtg');
await new Promise(resolve => setImmediate(resolve));
now += 86400_000;
late.pick = async () => ({id:'new-day', name:'New day', art:'https://example.test/new.jpg'});
release({id:'old-day', name:'Old day', art:'https://example.test/old.jpg'});
assert.equal((await old).id, 'new-day');
assert.equal((await lateStorage.get('card:mtg')).date, dailyDate());
globalThis.Date = RealDate;
console.log('PASS: server-owned shared daily picks, midnight New York/DST rollover, alarm warming, no consecutive repeats, persistent caches, concurrency and outage cooldown.');
