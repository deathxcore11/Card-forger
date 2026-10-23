// Synthetic card data and mocked I/O; the production builders, validators,
// pricing, Power analysis, result gate and renderers execute unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {S,blank} from './store.js';
import * as T from './tcg.js';
import {cardKey,cardPrice} from './core.js';
import {createDeckPipeline} from './deck-pipeline.js';
import {normalizeDeckRequest,priceDeck,chooseDeck,constructDeck} from './deck-construction.js';
import {deckResultMarkup,deckSetupMarkup} from './deck-experience.js';
import {makeAskTools} from './ai-tools.js';
S.state=blank();S.catalog={};
const card=(name,type='Artifact',ci=[],price='.25',extra={})=>({name,type_line:type,color_identity:ci,colors:ci,mana_cost:ci.length?'{1}{'+ci[0]+'}':'{2}',cmc:2,oracle_text:'Draw a card.',legalities:{commander:'legal',modern:'legal'},prices:{usd:price},...extra});
const anchor=card('Fixture build-around'),leader=card('Fixture leader','Legendary Creature — Human Artificer',['U'],'2',{oracle_text:'Whenever you cast an artifact spell, create a 1/1 colorless Thopter artifact creature token with flying.'}),land=card('Island','Basic Land — Island',['U'],'.10',{produced_mana:['U'],cmc:0,mana_cost:''});
const pool=[anchor,leader,land,...Array.from({length:85},(_,i)=>card('Artifact fixture '+i,'Artifact',[],'.25',{oracle_text:i%3===0?'Draw a card.':i%3===1?'Add {C}.':'Destroy target artifact.'}))];
for(const c of pool)S.catalog[cardKey(c.name)]=c;
let calls=0;
const context={S,T,tcgCtx:{},meta:name=>S.catalog[cardKey(name)],resolve:async name=>S.catalog[cardKey(name)],cacheCard:c=>S.catalog[cardKey(c.name)]=c,inv:()=>({available:0}),priceOf:name=>cardPrice(S.catalog[cardKey(name)]),api:async path=>{calls++;const q=new URL(path,'https://fixture.invalid').searchParams.get('q');return {data:q?.includes('is:commander')?[leader]:pool};}};
const pipeline=createDeckPipeline(context);
const request={game:'mtg',format:'Commander',seed:anchor.name,commander:leader.name,budget:'10',budgetMode:'target',theme:'Artifacts',preferOwned:false};
let result=await pipeline.build(request);
assert(result.ok,JSON.stringify(result));assert.equal(result.rows.reduce((n,r)=>n+r.qty,0),100);assert(result.rows.some(r=>r.name===anchor.name));assert(pipeline.recheck(result));assert(result.delta>0);assert.equal(result.budgetStatus,'outside-target');assert.equal(S.state.decks.length,0);assert(calls<15,'card retrieval is bounded, not one call per deck slot');
const markup=deckResultMarkup(result,'fixture');assert.match(markup,/Save deck/);assert.match(markup,/exceeds the allowed overage/);assert.doesNotMatch(markup,/Save draft|Hard to play|Buy .*TCG/);
assert.equal(normalizeDeckRequest({...request,budget:''},pipeline.formats).budget,null);assert.equal(normalizeDeckRequest({...request,budget:0},pipeline.formats).budget,0);
assert.equal(priceDeck([{id:'x',qty:4,price:null,owned:1}]).estimate,null);
assert.equal(priceDeck([{id:'x',qty:3,price:1,owned:3},{id:'x',qty:2,price:1,owned:3}],'purchase').subtotal,2,'shared owned copies allocated once across zones');
assert.equal(priceDeck([{id:'x',qty:4,price:'',owned:0}]).estimate,null);
const setup=deckSetupMarkup({request:{...request,seedCard:anchor}},pipeline.formats);assert.match(setup,/data-flow-field="budget" type="number"/);assert.match(setup,/data-flow-field="format"/);assert.match(setup,/Generate deck/);assert.doesNotMatch(setup,/fmt-chips|Save all/);
const ghoti=JSON.parse(fs.readFileSync('tests/fixtures/deck-construction/ghoti-incomplete-report.json'));
const failure=chooseDeck([{deck:{},check:{complete:false,legal:true,issues:[`Required build-around ${ghoti.requiredCard} is missing.`]},plan:{issues:[]},pricing:{}}],normalizeDeckRequest({game:'ygo',format:'tcg',budget:100},pipeline.formats));
assert.equal(failure.ok,false);assert.match(failure.message,/missing/);assert.doesNotMatch(deckResultMarkup(failure,'bad'),/data-act="flowSave"|Buy|Hard to play/);
// Unknown prices still allow a complete checked list, without a false budget fit.
land.prices.usd=null;result=await pipeline.build({...request,budget:''});assert(result.ok,result.message);assert.equal(result.pricing.estimate,null);assert(result.pricing.unpriced>0);assert.equal(result.budgetStatus,'unverified');assert.match(deckResultMarkup(result,'unknown'),/budget fit are unverified/);
land.prices.usd='.10';
let live=true;const pending=constructDeck(request,{formats:pipeline.formats,construct:async()=>{live=false;return [];}},{current:()=>live});await assert.rejects(pending,e=>e.name==='AbortError');
// Chat calls the SAME pipeline, exposes the actual list inline, and never opens setup.
let registered,opened=0;const tools=makeAskTools({...context,deckExperience:{build:pipeline.build,register:r=>{registered=r;return 'inline';},markup:()=>'<article>Actual inline deck</article>'},openMtgDraft:()=>opened++});
const answer=await tools.build_deck({...request,budget:50,style:'artifacts',budget_basis:'total'});assert(answer.complete,JSON.stringify(answer));assert.equal(answer.cards.reduce((s,r)=>s+r.qty,0),100);assert.deepEqual(answer.cards,registered.rows.map(r=>({name:r.name,qty:r.qty,zone:r.zone})));assert.match(tools.preview(tools.pendingItem(),0),/Actual inline deck/);assert.equal(opened,0);assert.equal(S.state.decks.length,0);
console.log('PASS: shared real construction/validation/Power gate, complete inline AI list, tight-target attempt, explicit overage, unknown quotes, owned allocation, incomplete Ghoti refusal and stale cancellation.');

// Saving changes the workspace stamp but must not break this result's read actions.
const {createDeckExperience}=await import('./deck-experience.js');
let workspace=0,account=0,exported='',changeAccountOnSave=false;
const actions={},scope=()=>{const a=account,w=workspace;return()=>a===account&&w===workspace;};
const experience=createDeckExperience({A:actions,pipeline,scope,identity:()=>{const a=account;return()=>a===account;},
 save:async()=>{workspace++;if(changeAccountOnSave)account++;},export:text=>exported=text,
 onInput:()=>{},game:()=> 'mtg'});
const savedId=experience.register(result,scope()),saveButton={dataset:{result:savedId}};
await actions.flowSave(saveButton);assert.equal(saveButton.textContent,'Saved to My decks');actions.flowExport(saveButton);assert.match(exported,/Fixture build-around/);
account++;assert.throws(()=>actions.flowExport(saveButton),/account or collection changed/);
const unsafeId=experience.register(result,scope());changeAccountOnSave=true;
await assert.rejects(actions.flowSave({dataset:{result:unsafeId}}),/account changed while saving/);
assert.throws(()=>actions.flowExport({dataset:{result:unsafeId}}),/account or collection changed/);
console.log('PASS: Save → Export stays usable; account changes before or during Save remain blocked.');
