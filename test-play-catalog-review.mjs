import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeCatalogReview} from './play-catalog-review.js';
import {createPracticeCardPreparation} from './play-card-preparation.js';
import {catalogNameKey,catalogCardMatchesName,evaluateCatalogAdmission} from './experiments/phase-engine/catalog-admission.mjs';
import {engineDeckFromSnapshot} from './experiments/phase-engine/match-input.mjs';
const card={name:'The Arkenstone // Seek the Heart',oracle_id:'oracle-arkenstone',id:'printing-arkenstone',legalities:{standard:'legal',commander:'legal'},card_faces:[{name:'The Arkenstone'},{name:'Seek the Heart'}]};
const deck=name=>({name:'Exact list',format:'Standard',cards:[{name,qty:60}],side:[]});
const setup=name=>({selected:deck(name),opponent:deck(name),match:{format:'Standard'}});
function reviewer(lookupNames){return createPracticeCatalogReview({lookupNames,isCurrent:()=>true,now:()=>1000});}
test('catalog matches ordered combined face metadata, face aliases and separator/case variants',async()=>{
 const faceRecord={...card,name:'The Arkenstone'};
 const state=setup('the arkenstone//Seek the Heart'),before=structuredClone(state);
 const review=await reviewer(async()=>({data:[faceRecord]}))(state);
 assert.equal(review.player.cards[0].oracleId,card.oracle_id);assert.equal(review.player.cards[0].name,'the arkenstone//Seek the Heart');assert.deepEqual(state,before);
 assert(catalogCardMatchesName(card,'Seek the Heart'));assert(!catalogCardMatchesName(faceRecord,'Seek the Heart // The Arkenstone'));
});
test('one exact front-name retry resolves a combined lookup miss without changing the deck',async()=>{
 const calls=[],state=setup(card.name),before=structuredClone(state);
 const review=await reviewer(async identifiers=>{calls.push(identifiers);return calls.length===1?{data:[],not_found:identifiers}:{data:[card]};})(state);
 assert.deepEqual(calls,[[{name:card.name}],[{name:'The Arkenstone'}]]);assert.equal(review.player.cards[0].legality,'legal');assert.deepEqual(state,before);
});
test('front fallback cannot substitute a different back face or a bare front record',async()=>{
 for(const wrong of [{...card,name:'The Arkenstone // Other Face',card_faces:[{name:'The Arkenstone'},{name:'Other Face'}]},{name:'The Arkenstone',oracle_id:'bare-front',legalities:{standard:'legal'}}]){
  let calls=0;const review=reviewer(async()=>({data:++calls===1?[]:[wrong]}));
  await assert.rejects(review(setup(card.name)),error=>error.reasons.every(reason=>reason.includes('card identity could not be resolved')));assert.equal(calls,2);
 }
});
test('unresolved identity, missing legality metadata and known format rejection are distinct',async()=>{
 for(const [record,expected] of [[{...card,oracle_id:''},/card identity could not be resolved/],[{...card,legalities:{}},/legality metadata is unavailable/],[{...card,legalities:{standard:'not_legal'}},/not_legal in Standard/]]){
  await assert.rejects(reviewer(async()=>({data:[record]}))(setup(card.name)),error=>error.reasons.every(reason=>expected.test(reason)));
 }
});
test('ambiguous returned oracle identities do not select the first result as legal',async()=>{
 await assert.rejects(reviewer(async()=>({data:[card,{...card,oracle_id:'different-oracle'}]}))(setup(card.name)),error=>error.reasons.every(reason=>reason.includes('card identity could not be resolved')));
});
test('account retirement during retry stops before producing a review',async()=>{
 let current=true,calls=0;const review=createPracticeCatalogReview({isCurrent:()=>current,lookupNames:async()=>{if(++calls===1)return {data:[]};current=false;return {data:[card]};}});
 await assert.rejects(review(setup(card.name)),/ACCOUNT_CHANGED/);
});
test('exact printing validation uses the same strict composite identity and never falls back to another printing',async()=>{
 const state=setup('The Arkenstone//Seek the Heart');for(const d of [state.selected,state.opponent])d.cards[0].printingId=card.id;
 const preparation=createPracticeCardPreparation({resolveNames:async()=>{},lookup:()=>null,fetchPrinting:async()=>({...card,name:'The Arkenstone'}),selectionKey:catalogNameKey,isCurrent:()=>true});
 await preparation.prepare(state);assert.equal(preparation.lookup(card.name,card.id).id,card.id);
 state.selected.cards[0].name='The Arkenstone // Wrong Face';await assert.rejects(preparation.prepare(state),/SELECTED_PRINTING_UNAVAILABLE/);
});
test('catalog review still binds the exact list, format and freshness',async()=>{
 const state=setup(card.name),review=(await reviewer(async()=>({data:[card]}))(state)).player,list=engineDeckFromSnapshot(state.selected,'Standard');
 assert.equal(evaluateCatalogAdmission(list,'Standard',review,{now:1000}).admitted,true);
 assert.equal(evaluateCatalogAdmission({...list,main_deck:[...list.main_deck,'Forest']},'Standard',review,{now:1000}).admitted,false);
 assert.equal(evaluateCatalogAdmission(list,'Commander',review,{now:1000}).admitted,false);
 assert.equal(evaluateCatalogAdmission(list,'Standard',review,{now:1000+86400001}).admitted,false);
});
test('Detect Intrusion preserves its saved printed name and resolves the exact Spider-Sense engine identity',async()=>{
 const state=setup('Detect Intrusion'),before=structuredClone(state),calls=[];
 const review=await reviewer(async identifiers=>{calls.push(identifiers);return {data:[{name:'Spider-Sense',printed_name:'Detect Intrusion',oracle_id:'c4485bf9-e7ff-48b5-a983-02900939ee9d',legalities:{standard:'legal'}}]};})(state);
 assert.deepEqual(calls,[[{name:'Spider-Sense'}]]);assert.deepEqual(state,before);assert.equal(engineDeckFromSnapshot(state.selected,'Standard').main_deck[0],'Spider-Sense');assert.equal(review.player.cards[0].legality,'legal');
});
test('Murderous Rider requires both correct Adventure faces and retains the full card identity',async()=>{
 const state=setup('Murderous Rider // Swift End');state.match.format='Commander';for(const d of [state.selected,state.opponent])d.format='Commander';
 const card={name:'Murderous Rider',oracle_id:'1080c5b5-6651-4c6a-93e6-099fbe389e26',layout:'adventure',card_faces:[{name:'Murderous Rider'},{name:'Swift End'}],legalities:{commander:'legal'}};
 let calls=0;const review=await reviewer(async()=>({data:++calls===1?[]:[card]}))(state);assert.equal(review.player.cards[0].legality,'legal');assert.equal(engineDeckFromSnapshot(state.selected,'Commander').main_deck[0],'Murderous Rider // Swift End');
});
