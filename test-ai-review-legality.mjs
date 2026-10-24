import assert from 'node:assert/strict';
import {cleanDeck,validateReview,instructionsFor} from './ai-review-route.js';
import {readFileSync} from 'node:fs';

// Synthetic provider records deliberately use neutral names. Legality must come
// from metadata, never a maintained name list or the model's training memory.
const card=(id,name,zone='main',legalities={standard:'legal'})=>({id,name,zone,qty:1,known:true,type:'Creature — Wizard',text:'When this creature enters, draw a card.',details:'{}',legalities});
const review={headline:'Consider this conditional swap.',pilot:{hand:{},lines:[]},pressure:{scenarios:[]},improve:[{cut:'c0',add:'o0',gain:'Could improve card flow.',loss:'A body.',evidence:[]}]};
const payload=(legalities,format='Standard')=>({game:'mtg',format,cards:[card('c0','Existing card')],candidates:[card('o0','Candidate card','owned',legalities)]});
const result=(legalities,format)=>validateReview(review,cleanDeck(payload(legalities,format)));
assert.equal(result({standard:'legal'}).improve.length,1,'currently legal data is accepted');
for(const status of ['banned','not_legal','future','unknown'])assert.equal(result({standard:status}).improve.length,0,`${status} cannot be recommended`);
assert.equal(result({}).improve.length,0,'missing legality is unknown, not legal');
assert.equal(result({commander:'legal'}).improve.length,0,'another format does not establish Standard legality');
assert.equal(result({standard:'legal'},'unknown format').improve.length,0,'unknown formats do not silently become casual');
assert.equal(result({},'60-card casual').improve.length,1,'formats without legality gates remain supported');
assert.equal(result({standard:'legal'},'standard').improve.length,1,'canonical format ids are recognized');
const changed=payload({standard:'legal'});changed.candidates[0].known=false;
assert.equal(validateReview(review,cleanDeck(changed)).improve.length,0,'brief/unresolved card data cannot certify a recommendation');
const restricted=payload({vintage:'restricted'},'Vintage');
assert.equal(validateReview(review,cleanDeck(restricted)).improve.length,1,'one restricted copy is permitted');
restricted.cards.push(card('c1','Candidate card','main',{vintage:'restricted'}));
assert.equal(validateReview(review,cleanDeck(restricted)).improve.length,0,'a second restricted copy is rejected');
restricted.cards=[{...card('c0','Candidate card','main',{vintage:'restricted'}),qty:2}];
assert.equal(validateReview(review,cleanDeck(restricted)).improve.length,0,'replacing one of two restricted copies does not make the resulting list legal');
restricted.cards[0].qty=1;
assert.equal(validateReview(review,cleanDeck(restricted)).improve.length,1,'one-for-one same-card replacement respects remaining-copy arithmetic');
const sanitized=cleanDeck(payload({standard:'legal',commander:'banned',madeup:'legal',modern:{toString:'legal'}}));
assert.deepEqual(sanitized.candidates[0].legalities,{standard:'legal',commander:'banned'});
const other={...payload({}),game:'ygo',format:'Advanced'};
assert.equal(validateReview(review,cleanDeck(other)).improve.length,1,'Magic legality does not leak into other games');
assert.match(instructionsFor('mtg'),/exact card text and legality metadata ahead of model memory/);
assert.match(instructionsFor('mtg'),/Missing legality or unmapped mechanics are unknown/);
const client=readFileSync(new URL('./ai-review.js',import.meta.url),'utf8');
assert.match(client,/legalities: c\?\.legalities \|\| \{\}/,'client transmits actual catalog legality metadata');
console.log('AI review legality: provider-metadata, unknown, format and restricted-copy checks passed.');
