import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSeeds} from './deck-seeds.js';
// Random card and a typed name both left seedCards as [], and `seedCards||[seed]` kept the empty array: Pokémon
// builds had no evolution line ("No primary attacker") and Yu-Gi-Oh! builds no archetype.
const seed={id:'me05-054',name:'Thievul'},other={id:'me05-021',name:'Finizen'};
assert.deepEqual(normalizeSeeds(seed,[]),[seed],'an empty list keeps the featured card');
assert.deepEqual(normalizeSeeds(seed,undefined),[seed]);
assert.deepEqual(normalizeSeeds(seed,[other]),[seed,other],'the featured card leads a multi-card selection');
assert.deepEqual(normalizeSeeds(seed,[other,{...seed}]),[seed,other],'no duplicate featured card');
assert.throws(()=>normalizeSeeds(seed,[{name:'Ghost'}]),/Could not verify the required card Ghost/,'an unresolved required card is an error, not dropped');
const tcg=readFileSync('tcg.js','utf8');
assert.doesNotMatch(tcg,/seedCards\s*\|\|\s*\[seed\]/,'no truthy-empty seed fallback in construction');
assert.doesNotMatch(tcg,/B\.seeds\s*\|\|\s*\[B\.seed\]/,'no truthy-empty seed fallback in the build run');
assert.match(readFileSync('deck-experience.js','utf8'),/seedCard:card,seedCards:\[card\]/,'Random card hands its card on as the seed list');
console.log('PASS: deck builds always carry their build-around card (Random, typed name, multi-card), unresolved seeds are rejected.');
