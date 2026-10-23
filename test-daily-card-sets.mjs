import assert from 'node:assert/strict';
import {DailyCards} from './daily-card-route.js';
// Today's pack opens from the Card of the Day's set: consecutive days pick cards from different sets,
// even when the provider lists a set's cards side by side.
const RealDate = Date;
let now = RealDate.parse('2026-10-18T12:00:00.000Z');
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
class Storage { map = new Map(); async get(k) { return structuredClone(this.map.get(k)); } async put(k, v) { this.map.set(k, structuredClone(v)); } async delete(k) { this.map.delete(k); } async getAlarm() { return null; } async setAlarm() {} }
const sets = ['sv01', 'sv02', 'sv03', 'sv04', 'sv05', 'sv06'];
const ptcg = sets.flatMap(s => Array.from({length: 30}, (_, i) => ({id: `${s}-${200 + i}`, name: `${s} card ${i}`, image: `https://assets.tcgdex.net/en/sv/${s}/${200 + i}`})));
const ygo = sets.flatMap(s => Array.from({length: 20}, (_, i) => ({id: s.length * 1000 + sets.indexOf(s) * 100 + i, name: `${s} staple ${i}`, card_sets: [{set_name: `${s} promo tin`}, {set_name: s}]})));
let mtgCall = 0;
globalThis.fetch = async url => {
  if (url.includes('scryfall')) { mtgCall++; return Response.json({id: `m${mtgCall}`, name: `Magic ${mtgCall}`, set: mtgCall % 4 ? 'one' : `s${mtgCall}`, image_uris: {art_crop: `https://example.test/${mtgCall}.jpg`}}); }
  return Response.json(url.includes('ygoprodeck') ? {data: ygo} : ptcg);
};
const object = new DailyCards({storage: new Storage()});
for (const game of ['ptcg', 'ygo', 'mtg']) {
  const picked = [];
  for (let day = 0; day < 12; day++) {
    now = RealDate.parse('2026-10-18T12:00:00.000Z') + day * 86400_000;
    const body = await (await object.fetch(new Request(`https://internal/?game=${game}`))).json();
    assert(body.card.set, `${game} card carries its set`);
    picked.push(body.card.set);
  }
  for (let i = 1; i < picked.length; i++) assert.notEqual(picked[i], picked[i - 1], `${game}: day ${i} repeats yesterday's set (${picked.join(', ')})`);
  if (game !== 'mtg') for (let i = 3; i < picked.length; i++) assert(!picked.slice(i - 3, i).includes(picked[i]), `${game}: day ${i} repeats a set from the last three days`);
}
console.log('PASS: Card of the Day changes set every day (Pokémon, Yu-Gi-Oh! booster release, Magic), avoiding the last three days\' sets when it can.');
