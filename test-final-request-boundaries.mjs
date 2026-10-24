// Frozen public card text + synthetic price/basic data; real final assessment,
// swap, rebuild and candidate selection. No live provider or account mutations.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {createDeckPipeline} from './deck-pipeline.js';import {constructDeck,inspectDeckPlan,normalizedDeckList,deckListSignature,rebuildComparison} from './deck-construction.js';import {cardKey} from './core.js';import {S,blank} from './store.js';import * as T from './tcg.js';
const cards=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/final-support-cards.json',import.meta.url))).cards;
const get=n=>structuredClone(cards.find(c=>c.name===n)),plains=get('Plains'),hammer=get('Colossus Hammer'),ornithopter=get('Ornithopter');
const paladin=get('Puresteel Paladin');
const island={...plains,name:'Island',type_line:'Basic Land — Island',color_identity:['U'],oracle_text:'{T}: Add {U}.',produced_mana:['U']},conflict={...hammer,name:'Synthetic side conflict',type_line:'Artifact',oracle_text:'',color_identity:[]};
S.state=blank();S.catalog=Object.fromEntries([plains,hammer,ornithopter,paladin,island,conflict].map(c=>[cardKey(c.name),c]));
const x={S,T,meta:n=>S.catalog[cardKey(n)],priceOf:()=>.1,inv:()=>({available:0})},pipeline=createDeckPipeline(x);
const deck={format:'Modern',cards:[{name:'Plains',qty:51},{name:hammer.name,qty:4},{name:ornithopter.name,qty:4},{name:paladin.name,qty:1}],side:[{name:paladin.name,qty:1}]},request={game:'mtg',format:'Modern',formatName:'Modern',colors:['W'],required_cards:[paladin.name],budget:20,budgetMode:'cap',budgetBasis:'total',budgetBoundary:'inclusive',allowance:0};
const result={ok:true,deck,request};assert(pipeline.recheck(result),'Positive original request remains valid');
const swapped=pipeline.trialSwap(result,{name:'Plains',zone:'main'},island);assert(swapped.plan.issues.some(i=>i.includes('requested color identity')));assert(!pipeline.recheck({...result,deck:swapped.deck}));assert(pipeline.recheck(result),'Original not mutated by invalid proposal');
const lostAnchor=pipeline.trialSwap(result,{name:paladin.name,zone:'main'},plains);assert(lostAnchor.deck.side.some(r=>r.name===paladin.name));assert(lostAnchor.plan.issues.some(i=>i.includes('Required card')));assert(!pipeline.recheck({...result,deck:lostAnchor.deck}),'Side-only card cannot satisfy required main build-around');
const unknownRows=pipeline.assess(deck,request,{withPower:false}).rows.map(r=>r.name===hammer.name?{...r,card:{...r.card,color_identity:undefined}}:r);assert(inspectDeckPlan(request,unknownRows,deck).issues.some(i=>i.includes('color identity is unverified')));
const bad={...deck,side:[{name:conflict.name,qty:1}]},good={...deck,side:[]},input={...request,excluded_cards:[conflict.name]},adapter={formats:pipeline.formats,assess:pipeline.assess,construct:async()=>[bad,good]};
let built=await constructDeck(input,adapter);assert(built.ok,built.message);assert.deepEqual(built.deck.side,[],'Same-main invalid side cannot discard a valid side candidate');assert.equal(built.compared,2);
const tooDear={...good,referencePrices:{plains:100}};built=await constructDeck(request,{...adapter,construct:async()=>[tooDear,good]});assert(built.ok,built.message);assert.equal(built.pricing.estimate,6,'Same-list quote alternatives independently pass the cap');
assert.notEqual(deckListSignature(bad),deckListSignature(good));assert(normalizedDeckList(bad).some(r=>r.zone==='side'));
const comparison=rebuildComparison({...built,deck:good},[],{...request,previousDeck:bad,previousEstimate:6.1});assert.equal(comparison.sameList,false);assert.equal(comparison.removedCopies,1);assert(comparison.changes.some(r=>r.zone==='side'));
const rows=pipeline.assess(good,request,{withPower:false}).rows;assert(inspectDeckPlan({...request,commander:'Kinnan, Bonder Prodigy'},rows,{...good,commander:'Dion, Bahamut’s Dominant'}).issues.some(i=>i.includes('requested commander')));assert(inspectDeckPlan({...request,format:'Standard'},rows,good).issues.some(i=>i.includes('deck format')));
console.log('PASS: side-aware identity/dedup and quote alternatives; exact colors, required main anchors, declared commander and format survive final candidate, swap and recheck boundaries.');
const rebuilt=await constructDeck({...request,previousDeck:swapped.deck},{...adapter,construct:async()=>[swapped.deck,good]});assert(rebuilt.ok);assert(!rebuilt.deck.cards.some(r=>r.name==='Island'),'A preserved off-color prior cannot win the rebuilt request');
assert(!pipeline.recheck({...result,request:{...request,commander:'Kinnan, Bonder Prodigy'},deck:{...deck,commander:'Dion, Bahamut’s Dominant'}}));
assert.notEqual(deckListSignature({...good,commanders:['Leader A']}),deckListSignature({...good,commanders:['Leader B']}));
