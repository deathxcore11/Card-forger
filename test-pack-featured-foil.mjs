import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePtcg} from './ptcg.js';
import {packNeedsHydration,packHitFinish,packFinishes} from './pack-preview.js';
// Today's pack pulls the Card of the Day from the set list, which carries no Pokémon variants. It came out plain
// (N's Plan, Professor Sada's Vitality) because the full card was never loaded for the featured hit.
const full=normalizePtcg(JSON.parse(readFileSync('tests/fixtures/ptcg-sv10.5b-170.json','utf8')));
const brief={id:full.id,name:full.name,game:'ptcg',rarity:full.rarity,image:full.image,set:full.set};
assert.equal(packHitFinish('ptcg',brief),null,'a set-list entry cannot name its foil');
assert(packNeedsHydration('ptcg',brief,true),'the featured hit loads its full card');
assert.deepEqual(packHitFinish('ptcg',full),{priceFinish:'holofoil'},'once loaded, the hit comes out in its holofoil');
assert.deepEqual(packFinishes('ptcg',[full])[0],{priceFinish:'holofoil'});
assert(!packNeedsHydration('ptcg',full,true),'a card that already has variants is not reloaded');
assert(!packNeedsHydration('ptcg',{id:'x',rarity:'Common'},false),'plain commons stay as listed');
console.log('PASS: today\'s pack loads the featured Pokémon hit and pulls it in its holofoil.');
