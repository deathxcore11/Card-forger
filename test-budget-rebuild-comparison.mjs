import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import * as T from './tcg.js';
import {cardKey,cardPrice} from './core.js';
import {createDeckPipeline} from './deck-pipeline.js';
import {prepareMtgDeck} from './ai-deck-builder.js';
import {deckListSignature,chooseDeck,normalizeDeckRequest,rebuildComparison} from './deck-construction.js';
import {deckResultMarkup,createDeckExperience} from './deck-experience.js';
const card=(name,price,text='',extra={})=>({name,type_line:'Creature — Merfolk Wizard',color_identity:['U'],colors:['U'],mana_cost:'{1}{U}',cmc:2,power:'2',toughness:'2',oracle_text:text,legalities:{standard:'legal'},prices:{usd:String(price)},...extra});
const seed=card('Synthetic budget anchor',.2,'Flash. When this creature enters, counter target activated or triggered ability.',{cmc:3,mana_cost:'{2}{U}'});
const island=card('Island',.03,'{T}: Add {U}.',{type_line:'Basic Land — Island',mana_cost:'',cmc:0,produced_mana:['U'],power:undefined,toughness:undefined});
const cheap=Array.from({length:12},(_,i)=>card('Synthetic cheap support '+i,.1,i%3===0?'When this creature enters, draw a card.':i%3===1?'Flying.':'',{power:'1',toughness:'1'}));
const premium=Array.from({length:8},(_,i)=>card('Synthetic premium support '+i,20,i%2?'Flying. Whenever this creature deals combat damage to a player, draw a card.':'Flash. When this creature enters, counter target spell.',{power:'5',toughness:'5'}));
const weak=card('Synthetic expensive weaker',500,'',{cmc:6,mana_cost:'{5}{U}',power:'1',toughness:'1'});
const unknown=card('Synthetic unknown quote',null,'When this creature enters, draw three cards.',{power:'9',toughness:'9',prices:{usd:null}});
const records=[seed,island,...cheap,...premium,weak,unknown];
S.state=blank();S.catalog={};S.ui={};const queries=[];
const x={S,T,tcgCtx:{prepareDeck:()=>{throw Error('Unexpected game');}},meta:n=>S.catalog[cardKey(n)],resolve:async n=>records.find(c=>cardKey(c.name)===cardKey(n)),cacheCard:c=>S.catalog[cardKey(c.name)]=c,inv:()=>({owned:0,available:0}),priceOf:n=>cardPrice(S.catalog[cardKey(n)]),api:async path=>{const url=new URL(path,'https://fixture.invalid'),q=url.searchParams.get('q')||'';queries.push({q,page:url.searchParams.get('page'),order:url.searchParams.get('order')});let data=records;if(/t:basic|!"Island"/.test(q))data=[island];else if(/\bt:land/.test(q)&&!/-t:land/.test(q))data=[];else if(/usd<=0.5/.test(q))data=cheap;else if(q.includes('(t:creature or t:planeswalker)'))data=[...premium,weak,unknown];else data=[seed,...cheap];return {data,has_more:false};}};
const pipeline=createDeckPipeline(x),base={game:'mtg',format:'Standard',seed:seed.name,goal:'strongest',budgetMode:'cap',budgetBasis:'total',preferOwned:false,randomSeed:7};
const sig=d=>JSON.stringify(d.cards.map(r=>[r.name,r.qty]).sort());
const results=[];
const report={scope:'Real unmodified pipeline, synthetic explicitly labeled cards/provider replies; not user deck reproduction',runs:[]};let previous=null;
for(const budget of [8,7400,8000,8]){const start=queries.length,begin=performance.now();const result=await pipeline.build({...base,budget,...(previous?{previousDeck:previous.deck,previousBudget:previous.request.budget,previousEstimate:previous.pricing.estimate}: {})});results.push(result);report.runs.push({budget,ok:result.ok,price:result.pricing?.estimate,requestBudget:result.request?.budget,constructionBudgets:result.request?.constructionBudgets,fingerprint:result.validation?.request,compared:result.compared,score:result.power?.score,strategic:result.power?.strategic?.status,rankingValue:result.power?.strategic?.rankingValue,sameList:previous?sig(previous.deck)===sig(result.deck):null,premiumCopies:result.deck?.cards.filter(r=>r.name.includes('premium')).reduce((n,r)=>n+r.qty,0),cards:result.deck?.cards,queries:queries.slice(start),elapsed:performance.now()-begin,errors:result.message});if(result.ok)previous=result;}
assert(report.runs.every(r=>r.ok),JSON.stringify(report.runs));
assert(results.every(r=>r.deck.requiredCards.length===0&&r.deck.internalRequiredCards.length===0),'scout anchors are not persisted as user constraints');
assert.equal(results[1].request.budget,7400);assert.notEqual(results[1].validation.request,results[0].validation.request);
assert(results[1].rebuild.changes.length>0);assert.equal(results[1].rebuild.oldBudget,8);assert.equal(results[1].rebuild.newBudget,7400);
assert(results[1].rebuild.priceDelta>0);assert(results[1].deck.cards.some(r=>r.name.includes('premium')),'stronger card only available in expanded functional discovery is considered');
assert(results.every(r=>!r.deck.cards.some(c=>c.name===unknown.name)),'unknown quotes never pass a finite cap');
assert(results.every(r=>!r.deck.cards.some(c=>c.name===weak.name)),'higher dollar value alone never wins');
assert(results[2].rebuild.sameList);assert.match(results[2].rebuild.reason,/bounded search/);assert.match(deckResultMarkup(results[2],'same'),/Same card quantities/);assert.doesNotMatch(deckResultMarkup(results[2],'same'),/already optimal|best possible/i);
assert.equal(results[3].request.budget,8);assert(results[3].pricing.estimate<=8);assert(!results[3].rebuild.sameList,'overcap previous list cannot survive lower cap');
assert(report.runs.every(r=>r.queries.length<=10),'two extra lanes, bounded one-page discovery');
assert(queries.every(q=>q.order!=='edhrec'),'Standard discovery never ranks by Commander popularity');
assert.equal(deckListSignature({cards:[{name:' A ',qty:1,id:'printing1'},{name:'a',qty:1},{name:'B',qty:3}]}),deckListSignature({cards:[{name:'b',qty:3,id:'printing2'},{name:'A',qty:2}]}),'row order, split quantities and Magic printings do not invent a changed list');
const request=normalizeDeckRequest({...base,budget:100},pipeline.formats),candidate=(name,cost,score)=>({deck:{cards:[{name,qty:60}]},rows:[],power:{score},check:{complete:true,legal:true},plan:{issues:[]},pricing:{estimate:cost,subtotal:cost,unpriced:0,copies:60,ownedCopies:0}});
assert.equal(chooseDeck([candidate('Expensive weaker',90,10),candidate('Cheaper better',20,30)],request).deck.cards[0].name,'Cheaper better');
let active=true;const staleX={...x,api:async path=>{active=false;return x.api(path);}};
const stale=await prepareMtgDeck({...base,budget:7400,flow:true,current:()=>active},staleX);assert(stale.cancelled);assert(!stale.candidates,'cancelled provider discovery cannot produce a candidate result');
console.log('PASS: actual shared pipeline budget8→7400 changes via bounded functional discovery,8000 unchanged explained, lower cap rejects prior; no dollar ranking, unknown/printing distinctions and cancellation preserved.');
console.log(JSON.stringify(report.runs.map(({cards,queries,...r})=>({...r,queries:queries.length})),null,2));

// Exercise the real rebuild handler with a minimal DOM boundary: cancellation
// and a changed workspace must not overwrite or relabel the previous output.
const originalDocument=globalThis.document;let scopeActive=true,pendingResolve,replacements=0;
const status={textContent:''},field={value:'7400',focus(){}},root={isConnected:true,querySelector:s=>s==='[data-flow-budget]'?field:status,append(){},set outerHTML(value){replacements++;}};
const overlay=()=>({isConnected:true,innerHTML:'',querySelector:()=>({focus(){},textContent:''}),remove(){this.isConnected=false;}});
globalThis.document={createElement:overlay};
const actions={},experience=createDeckExperience({A:actions,pipeline:{formats:pipeline.formats,build:()=>new Promise(resolve=>pendingResolve=resolve)},scope:()=>()=>scopeActive,identity:()=>()=>scopeActive,meta:x.meta,T,onInput(){},game:()=> 'mtg'});
const id=experience.register(results[0],()=>scopeActive),button={dataset:{result:id},closest:()=>root,focus(){}};
let pending=actions.flowAdjust(button);await Promise.resolve();actions.flowCancelBuild();pendingResolve(results[1]);await pending;assert.equal(replacements,0);assert.match(status.textContent,/unchanged/);
field.value='8000';pending=actions.flowAdjust(button);await Promise.resolve();scopeActive=false;pendingResolve(results[2]);await pending;assert.equal(replacements,0,'workspace change cannot relabel or overwrite the previous list');
globalThis.document=originalDocument;
console.log('PASS: actual rebuild handler cancellation and workspace staleness preserve the old visible deck.');

const changedCommander=rebuildComparison({...results[0],deck:{...results[0].deck,commander:'New commander'}},[],{...results[0].request,previousDeck:{...results[0].deck,commander:'Old commander'}});
assert.equal(changedCommander.sameList,false);assert.equal(changedCommander.commanderChanged,true);assert.equal(changedCommander.changes.length,0);assert.match(changedCommander.reason,/commander changed; the card quantities are unchanged/i);
const commanderMarkup=deckResultMarkup({...results[0],rebuild:changedCommander},'commander-change');assert.match(commanderMarkup,/Commander changed/);assert.doesNotMatch(commanderMarkup,/Updated card quantities/);
