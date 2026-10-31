// Actual production manual/random/Ask handoffs, assembly, optimizer, Save/Buy,
// preview and serialized reopen. Providers and persistence are local fakes only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {S,blank} from './store.js';
import * as T from './tcg.js';
import {buildPtcg,buildYgo,energyName,PTCG_SUPPORT_BASICS,PTCG_STAPLES,YGO_STAPLES} from './tcgbuild.js';
import {PTCG_FORMATS,validatePtcg,ptcgLegality} from './ptcg.js';
import {YGO_FORMATS,validateYgo,ygoLegality,ygoLimit} from './ygo.js';
import {tcgPower,asShown} from './power.js';
import * as optimizer from './deck-optimizer.js';
import {makeAskTools} from './ai-tools.js';
import {ygoPurchaseReference,ygoPurchaseChecklist} from './ygo-price-selection.js';
import {normalizeSeeds} from './deck-seeds.js';
let liveCalls=0;globalThis.fetch=()=>{liveCalls++;throw Error('No live network in builder accounting regression');};
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const source=fs.readFileSync(new URL('./tcg.js',import.meta.url),'utf8');
const card=(id,name,category='Pokemon',usd=.1)=>({game:'ptcg',id,name,category,stage:category==='Pokemon'?'Basic':null,basicPokemon:category==='Pokemon',types:['Fire'],attackCosts:['Fire'],image:'https://fixture.invalid/card.png',set:{id:'energy-fixture',name:'Verified fixture printing'},legal:{standard:true,expanded:true},prices:{usd},text:'',hp:70,attacks:[{name:'Ember',cost:['Fire'],damage:'20',effect:''}]});
const seed=card('seed','Fixture seed'),support=PTCG_SUPPORT_BASICS.map((n,i)=>card('support-'+i,n)),trainers=Array.from({length:15},(_,i)=>({card:card('trainer-'+i,'Fixture trainer '+i,'Trainer'),want:4})),energy={...card('energy','Basic Fire Energy','Energy',2),basicEnergy:true};
const all=[seed,...support,...trainers.map(t=>t.card),energy],named=new Map(all.map(c=>[c.name,c]));
all.forEach(c=>T.cache.ptcg[c.id]=c);
const formatOf=(g,id)=>(g==='ptcg'?PTCG_FORMATS:YGO_FORMATS).find(f=>f.id===id)||(g==='ptcg'?PTCG_FORMATS:YGO_FORMATS)[0];
const A={},C={},messages=[],purchases=[],starts=[];let savedId=0;
const sources={ptcg:{...T.SOURCES.ptcg,validate:validatePtcg,legality:ptcgLegality,search:async()=>({cards:[seed]}),get:async id=>T.cache.ptcg[id],byName:async()=>seed},ygo:T.SOURCES.ygo};
sources.ptcg.cheapestPrint=async (c,{legal,owned,known})=>{if(c.setContext)return c;const equivalents=known.filter(x=>legal(x)&&optimizer.sameCardLogic('ptcg',c,x)),mine=equivalents.filter(x=>owned(x)>0),cost=x=>x.prices?.usd==null||String(x.prices.usd).trim()===''?Infinity:Number(x.prices.usd);return [...(mine.length?mine:equivalents)].sort((a,b)=>cost(a)-cost(b))[0]||c;};
const ctx={normalizeSeeds,referenceEntryPrice:T.referenceEntryPrice,ygoPurchaseReference,ygoPurchaseChecklist,ask:async()=>false,copyText:async()=>{},setContextCard:T.setContextCard,currentYgoCatalogue:()=>T.ui("ygo").sets.list,cache:T.cache,...optimizer,tcgPower,asShown,S,A,C,structuredClone,URLSearchParams,Math,document:{querySelector:()=>null},c:{refreshSheet:()=>{}},cardOf:T.cardOf,ownedMap:T.ownedMap,price:c=>c?.prices?.usd??null,formatOf,SOURCES:sources,metaFor:async()=>null,buildPtcg,buildYgo,energyName,PTCG_SUPPORT_BASICS,PTCG_STAPLES,YGO_STAPLES,climb:async c=>c,lineFor:async c=>[{card:c,want:4}],ptcgBest:async name=>named.get(name)||null,ptcgMetaBasics:()=>[],ptcgMetaTrainers:()=>trainers.map(x=>[x.card.name,4]),abilityEnergy:()=>[],inBatches:async(xs,n,fn)=>Promise.all(xs.map(fn)),playRate:()=>0,remember:c=>c,gs:g=>S.state.tcg[g],captureCommit:()=>({}),scopedMutate:()=>async(fn,options)=>{fn(S.state.tcg[S.state.settings.game]);messages.push(options.msg);},uid:()=>String(++savedId),g:()=>S.state.settings.game,toast:s=>messages.push(s),openSheet:(_,c)=>{S.ui.sheetCtx=c;starts.push(S.ui.tbuild.custom);},tcgBuildSheet:()=>'',buildable:()=>[formatOf(S.state.settings.game,S.state.settings.game==='ptcg'?'standard':'tcg')],ensureCard:async(g,id)=>T.cache[g][id],navigationStamp:()=>1,navigationCurrent:()=>true,tcgBuildDiagnostics:T.tcgBuildDiagnostics,massLines:async(g,rows)=>rows,buyOnTcgplayer:async(g,rows)=>{purchases.push({g,rows});return !!rows.length;},closeSheet:()=>{},go:()=>{}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('const sameCard ='),source.indexOf('export function ownedMap')),ctx);
vm.runInContext(source.slice(source.indexOf('const ownedOf ='),source.indexOf('export function collectionValue')),ctx);
vm.runInContext(source.slice(source.indexOf('function deckStats('),source.indexOf('/* ---------- shared pieces')),ctx);
vm.runInContext(source.slice(source.indexOf('export const TCG_TIERS'),source.indexOf('const buildable =')).replace('export const','const'),ctx);
vm.runInContext(source.slice(source.indexOf('const buildSaveStatus ='),source.indexOf('export function tcgBuildSheet')),ctx);
vm.runInContext(source.slice(source.indexOf('  const legalIn ='),source.indexOf('  const ptcgBest =')),ctx);
vm.runInContext(source.slice(source.indexOf('  const runTBuild ='),source.indexOf('  A.tOptimizeDeck =')),ctx);
vm.runInContext(source.slice(source.indexOf('  let buildRequest=0;'),source.indexOf('  // Build around several cards at once')),ctx);
vm.runInContext(source.slice(source.indexOf('  let randomBusy ='),source.indexOf('  A.tVariantArt')),ctx);
vm.runInContext(source.slice(source.indexOf('  const buyTcgRows ='),source.indexOf('  // ----- meta decks & ideas')),ctx);
const settle=async()=>{while(S.ui.tbuild.busy)await new Promise(r=>setImmediate(r));assert.equal(S.ui.tbuild.error,false,S.ui.tbuild.msg);};
function reset(g='ptcg',collection=[]){S.state=blank();S.state.tcg={[g]:{collection:structuredClone(collection),decks:[],wishlist:[],binders:[],valueHistory:[]}};S.state.settings.game=g;S.ui.sheetCtx=null;S.ui.tbuild={busy:false};}
async function build({entry='manual',quote=2,ownedEnergy=0,missingEnergy=false}={}){
 energy.prices.usd=quote;if(missingEnergy)named.delete(energy.name);else named.set(energy.name,energy);
 reset('ptcg',ownedEnergy?[{cardId:energy.id,key:'name:'+energy.name,name:energy.name,qty:ownedEnergy}]:[]);
 const before=JSON.stringify(S.state.tcg.ptcg.collection);
 if(entry==='manual')await A.tBuild({dataset:{id:seed.id,format:'standard'}});
 else if(entry==='random')await A.tRandomDeck({dataset:{format:'standard'}});
 else{
  const tools=makeAskTools({S,T:{...T,game:()=> 'ptcg',SOURCES:sources},openTcgBuild:(g,id,budget,format,current)=>A.tBuild({dataset:{id,format},initialBudget:budget>0?budget:'',buildCurrent:current})});
  const handoff=await tools.build_deck({game:'ptcg',seed:seed.name,format:'Standard',budget:0,budget_basis:'total'});
  assert.equal(handoff.complete,false);assert.equal(handoff.prepared,true);assert.equal(handoff.budgetBasis,'purchase');assert.equal(handoff.requestedBudgetBasis,'total');assert.equal(S.state.tcg.ptcg.decks.length,0);
  await tools.open(tools.pendingItem());
 }
 await settle();assert.equal(starts.at(-1),'','omitted cap is blank, never an implicit25');assert.equal(JSON.stringify(S.state.tcg.ptcg.collection),before,'building never changes collection quantities');
 return S.ui.tbuild.results.standard;
}
const forBudget=(tiers,budget)=>tiers.find(t=>t.covers?.includes(budget));
async function saveReopen(tier){const index=S.ui.tbuild.results[S.ui.tbuild.format].indexOf(tier);await A.tTierSave({dataset:{i:String(index)}});const g=S.state.settings.game,saved=S.state.tcg[g].decks.at(-1);S.state=JSON.parse(JSON.stringify(S.state));return {saved:S.state.tcg[g].decks.at(-1),html:T.tcgDeck(saved.id),message:messages.at(-1)};}
for(const entry of ['manual','random','ai']){
 const tiers=await build({entry}),full=forBudget(tiers,Infinity),low=forBudget(tiers,10);
 assert.equal(full.total,60);assert(full.cost>25,'real unowned Energy prevents a fabricated sub25 list');assert.equal(full.buildDiagnostics.ownedCopies,0);assert.equal(full.unknown,0);assert.equal(full.buildDiagnostics.purchaseEstimate,Math.round(full.cost*100)/100);
 assert(low.total<60,'fillOpen cannot replace unaffordable Energy with Trainers even with60+ available Trainer copies');assert(low.buildDiagnostics.missingEnergy>0);assert.equal(low.buildDiagnostics.ready,false);assert(low.cost<=10);
 let saved=await saveReopen(low);assert.match(saved.message,/Saved draft/);assert.match(saved.html,/Incomplete draft: \d+ slots remain/);assert.match(saved.html,/<b>0%<\/b><span>owned/);
 saved=await saveReopen(full);assert.match(saved.message,/Saved complete list/);assert.equal(saved.saved.buildDiagnostics.purchaseEstimateVerified,true);assert.deepEqual(saved.saved.zones,JSON.parse(JSON.stringify(full.zones)));
 const index=tiers.indexOf(full);await A.tTierBuy({dataset:{i:String(index)}});const bought=purchases.at(-1).rows.find(r=>r.name===energy.name);assert(bought?.qty>0,'Buy includes missing Energy');assert.equal(bought.set,energy.set.name);assert.equal(bought.code,energy.set.id,'Buy preserves selected Energy printing instead of substituting SVE');
}
console.log('PASS: actual Pokémon manual/random/Ask handoff→build→save→reopen/Buy charges unowned Energy, includes its chosen printing, has no25 cap, and cannot refill required Energy with Trainers.');
for(const quote of ['', '   ']){const versions=await build({quote}),uncapped=forBudget(versions,Infinity);assert(uncapped.unknown>=11,'empty Energy quote is unknown, not zero');assert(forBudget(versions,10).total<60);}
let tiers=await build({quote:null}),full=forBudget(tiers,Infinity),low=forBudget(tiers,10);
assert.equal(full.total,60);assert(full.unknown>=11);assert.equal(full.buildDiagnostics.purchaseEstimate,null);assert.equal(full.buildDiagnostics.ready,true,'uncapped legal completeness is distinct from unknown price');assert.equal(full.buildDiagnostics.withinBudget,false);assert(low.total<60);assert.equal(low.unknown,0,'unpriced purchases excluded under finite cap are not fabricated free cards');
let preview=T.tcgBuildSheet();assert.match(preview,/Known purchase subtotal only/);assert.match(preview,/Save deck · cost unverified/);assert.doesNotMatch(preview,/Basic Energy is assumed owned/);
let saved=await saveReopen(full);assert.match(saved.message,/unpriced purchases, cost unverified/);assert.match(saved.html,/unpriced.*unverified, not free/);assert.equal(saved.saved.buildDiagnostics.unpricedPurchaseCopies,full.unknown);assert.match(saved.html,/<b>0%<\/b><span>owned/);
tiers=await build({quote:2,ownedEnergy:5});full=forBudget(tiers,Infinity);assert.equal(full.buildDiagnostics.ownedCopies,5);const energyQty=full.zones.main.find(r=>r.cardId===energy.id).qty;assert.equal(Math.round(full.cost*100)/100,Math.round(((60-energyQty)*.1+(energyQty-5)*2)*100)/100);
saved=await saveReopen(full);assert.match(saved.html,/<b>8%<\/b><span>owned/);assert.equal(S.state.tcg.ptcg.collection[0].qty,5);
tiers=await build({quote:null,ownedEnergy:20});full=forBudget(tiers,10);assert.equal(full.total,60);assert.equal(full.unknown,0,'actual owned Energy needs no purchase quote');assert.equal(full.buildDiagnostics.ready,true);
const zero=forBudget(tiers,0);assert.equal(zero.total,14);assert.equal(zero.buildDiagnostics.ownedCopies,14,'owned-only14 is allowed only from20 actually owned copies');
tiers=await build({quote:null});assert.equal(forBudget(tiers,0).total,0,'owned-only no longer invents14 unowned Energy');
tiers=await build({missingEnergy:true});assert(tiers.every(t=>t.total<60));assert.match(S.ui.tbuild.msg,/No complete checked list/);assert.match(T.tcgBuildSheet(),/Save draft/);
energy.printingComparison={partial:true};await build();assert.match(S.ui.tbuild.evidence,/Printing comparisons.*incomplete.*not a guaranteed cheapest printing/);delete energy.printingComparison;
console.log('PASS: finite unknown/missing Energy is an explicit shortfall; uncapped identities can complete with unknown total; real partial/full Energy ownership is charged once and survives serialization.');
// Shared uncapped picker must record unknown prices for both games, not reject
// every legal card or report the resulting subtotal as a verified zero total.
const yseed={game:'ygo',id:'yseed',name:'Fixture YGO seed',category:'Monster',extra:false,archetype:'Fixture',level:4,atk:1000,pools:['TCG'],ban:{tcg:null},prices:{usd:null},text:''};
const yarch=Array.from({length:16},(_,i)=>({...yseed,id:'ya'+i,name:'Fixture archetype '+i})),ystaples=Array.from({length:15},(_,i)=>({...yseed,id:'ys'+i,name:'Fixture staple '+i,category:'Spell',archetype:''}));
[yseed,...yarch,...ystaples].forEach(c=>T.cache.ygo[c.id]=c);
sources.ygo={...T.SOURCES.ygo,search:async()=>({cards:yarch}),randomArchetype:async()=>({cards:[yseed]}),byNames:async()=>ystaples,byName:async()=>yseed,validate:validateYgo,legality:ygoLegality,limit:ygoLimit};ctx.ygoMetaStaples=async()=>null;
for(const entry of ['manual','random','ai']){
 reset('ygo');
 if(entry==='manual')await A.tBuild({dataset:{id:yseed.id,format:'tcg'}});
 else if(entry==='random')await A.tRandomDeck({dataset:{format:'tcg'}});
 else{const ask=makeAskTools({S,T:{...T,game:()=> 'ygo',SOURCES:sources},openTcgBuild:(g,id,budget,format,current)=>A.tBuild({dataset:{id,format},initialBudget:budget>0?budget:'',buildCurrent:current})});const handoff=await ask.build_deck({game:'ygo',seed:yseed.name,format:'Advanced (TCG)',budget:0});assert.equal(handoff.complete,false);await ask.open(ask.pendingItem());}
 await settle();const versions=S.ui.tbuild.results.tcg,uncapped=forBudget(versions,Infinity);assert.equal(uncapped.total,40);assert.equal(uncapped.unknown,40);assert.equal(uncapped.buildDiagnostics.purchaseEstimate,null);assert.equal(uncapped.buildDiagnostics.ready,true);assert.equal(forBudget(versions,10).total,0);const result=await saveReopen(uncapped);assert.match(result.message,/40 unpriced purchases/);assert.match(result.html,/unverified, not free/);
}
// Exact synthetic provider identity is required for a verified YGO budget.
const quoteIds=new Map();let quoteSequence=910000;
function setYgoQuote(c,value){
 if(!quoteIds.has(c.id))quoteIds.set(c.id,++quoteSequence);
 c.prices={usd:value};c.sets=[{name:'Synthetic checked release',code:'FXQ-'+c.id.toUpperCase(),rarity:'Common',productId:quoteIds.get(c.id),priceSource:'Synthetic provider',checkedAt:'2026-10-19T12:00:00Z',quotes:[{edition:'Unlimited',market:value}]}];
}
// A legal full-count fallback is still a draft when it omitted the user's seed.
for(const c of [yseed,...yarch,...ystaples])setYgoQuote(c,1);setYgoQuote(yseed,1000);
reset('ygo');await A.tBuild({dataset:{id:yseed.id,format:'tcg'}});await settle();
let constrained=forBudget(S.ui.tbuild.results.tcg,50);assert.equal(constrained.total,40);assert(!constrained.zones.main.some(r=>r.cardId===yseed.id));assert.equal(constrained.buildDiagnostics.ready,false);assert.equal(constrained.buildDiagnostics.missingRequiredSeeds[0].id,yseed.id);assert.equal(S.ui.tbuild.seed,yseed.id);
const sideOnly={...constrained,zones:{...constrained.zones,side:[{cardId:yseed.id,name:yseed.name,qty:1}]}};assert.equal(T.tcgBuildDiagnostics('ygo',sideOnly,formatOf('ygo','tcg')).missingRequiredSeeds[0].id,yseed.id,'sideboard seed does not satisfy a Main Deck request');
let constrainedSaved=await saveReopen(constrained);assert.match(constrainedSaved.message,/Saved draft.*required build-around card missing/);assert.match(constrainedSaved.html,/required build-around card missing: Fixture YGO seed/);assert.equal(constrainedSaved.saved.buildDiagnostics.requiredSeeds[0].id,yseed.id);assert.match(T.tcgBuildSheet(),/Constraint shortfall/);
// Real Pokémon seed caller must request cheapest equivalent BEFORE line assembly.
seed.prices={usd:1000};seed.ruleBox=true;
const cheaperSeed={...seed,id:'seed-cheap',prices:{usd:.1}},illegalSeed={...seed,id:'seed-illegal',prices:{usd:.001},legal:{standard:false,expanded:false}},unknownSeed={...seed,id:'seed-unknown',prices:{usd:''}};
for(const c of [cheaperSeed,illegalSeed,unknownSeed])T.cache.ptcg[c.id]=c;
tiers=await build();constrained=forBudget(tiers,50);assert.equal(constrained.total,60);assert.equal(constrained.buildDiagnostics.ready,true);assert(constrained.zones.main.some(r=>r.cardId===cheaperSeed.id));assert(!constrained.zones.main.some(r=>r.cardId===illegalSeed.id||r.cardId===unknownSeed.id));assert.equal(constrained.buildDiagnostics.requiredSeeds[0].id,seed.id);assert.equal(S.ui.tbuild.seed,seed.id,'cheapest printing does not rewrite requested identity');
// Explicit set selection is not an invitation to replace the printing.
seed.setContext={price:1000};tiers=await build();constrained=forBudget(tiers,50);assert.equal(constrained.buildDiagnostics.ready,false);assert.equal(constrained.buildDiagnostics.missingRequiredSeeds[0].id,seed.id);delete seed.setContext;
// Newly owned exact Pokemon copies are preferred without collection mutation.
reset('ptcg',[{cardId:seed.id,key:'id:'+seed.id,name:seed.name,qty:4}]);const beforeOwned=JSON.stringify(S.state.tcg.ptcg.collection);await A.tBuild({dataset:{id:seed.id,format:'standard'}});await settle();constrained=forBudget(S.ui.tbuild.results.standard,50);assert(constrained.zones.main.some(r=>r.cardId===seed.id));assert.equal(constrained.buildDiagnostics.ready,true);assert.equal(JSON.stringify(S.state.tcg.ptcg.collection),beforeOwned);
delete T.cache.ptcg[cheaperSeed.id];delete T.cache.ptcg[illegalSeed.id];delete T.cache.ptcg[unknownSeed.id];seed.prices={usd:.1};delete seed.ruleBox;
console.log('PASS: full-count seed-omission fallbacks save/reopen as constraint-shortfall drafts; Pokemon seed caller selects a legal checked equivalent, preserves explicit/owned choices, and ignores blank quotes.');
// A full legal count does not verify Extra Deck summoning. Parse only exact
// quoted material headers; never infer that absent names prove impossibility.
setYgoQuote(yseed,1);
const fusion={...yseed,id:'fusion',name:'Fixture Fusion',extra:true,typeLine:'Fusion Monster',text:'3 "Required missing dragon"\nMust first be Fusion Summoned.',prices:{usd:1}};
setYgoQuote(fusion,1);T.cache.ygo[fusion.id]=fusion;yarch.push(fusion);
const misplacedFusion={zones:{main:[{cardId:fusion.id,name:fusion.name,qty:1}],extra:[],side:[]},requiredSeeds:[{id:fusion.id,name:fusion.name,zone:'extra'}]};assert.equal(T.tcgBuildDiagnostics('ygo',misplacedFusion,formatOf('ygo','tcg')).missingRequiredSeeds[0].id,fusion.id,'Fusion request requires its normal Extra Deck zone');
async function fusionBuild(id=yseed.id){reset('ygo');await A.tBuild({dataset:{id,format:'tcg'}});await settle();return forBudget(S.ui.tbuild.results.tcg,Infinity);}
let reviewed=await fusionBuild();assert.equal(reviewed.total,40);assert.equal(reviewed.buildDiagnostics.ready,true,'summoning review is separate from legal/count completeness');assert.equal(reviewed.buildDiagnostics.coreRouteUnverified,false);
let review=reviewed.buildDiagnostics.summoningReview.find(x=>x.cardId===fusion.id);assert.deepEqual(review.missingNamedMaterials,['Required missing dragon']);assert.equal(review.status,'unverified');assert.match(review.explanation,/does not prove the card unusable/);
let reviewSaved=await saveReopen(reviewed);assert.match(reviewSaved.message,/complete list · Extra Deck summoning needs review/);assert.match(reviewSaved.html,/Extra Deck summoning needs review/);assert.match(reviewSaved.html,/Required missing dragon/);assert.equal(reviewSaved.saved.buildDiagnostics.summoningReview[0].status,'unverified');assert.match(T.tcgBuildSheet(),/Save list · summoning review/);
// Finite caps persist independently of current quotes across real save/reopen.
const finiteTier=forBudget(S.ui.tbuild.results.tcg,50);assert.equal(finiteTier.buildDiagnostics.ready,true);const finiteSaved=await saveReopen(finiteTier);assert.equal(finiteSaved.saved.buildDiagnostics.purchaseBudget,50);assert.equal(finiteSaved.saved.budget,undefined);
const changedId=finiteSaved.saved.zones.main[0].cardId,changedCard=T.cache.ygo[changedId],oldQuote=structuredClone(changedCard.sets);
setYgoQuote(changedCard,1000);let changedCheck=T.tcgBuildDiagnostics('ygo',finiteSaved.saved,formatOf('ygo','tcg'));assert.equal(changedCheck.purchaseBudget,50);assert.equal(changedCheck.ready,false);assert.equal(changedCheck.withinBudget,false);assert.match(T.tcgDeck(finiteSaved.saved.id),/Draft: the requested purchase budget is not verified/);
setYgoQuote(changedCard,'');changedCheck=T.tcgBuildDiagnostics('ygo',finiteSaved.saved,formatOf('ygo','tcg'));assert.equal(changedCheck.ready,false);assert(changedCheck.unpricedPurchaseCopies>0);assert.match(T.tcgDeck(finiteSaved.saved.id),/purchase cost is unverified, not free/);changedCard.sets=oldQuote;
// An explicitly mentioned alternative changes the explanation, not verification.
ystaples[0].text='Special Summon "Fixture Fusion" from your Extra Deck, ignoring its Summoning conditions.';
reviewed=await fusionBuild();review=reviewed.buildDiagnostics.summoningReview.find(x=>x.cardId===fusion.id);assert(review.alternateRouteEvidence.includes(ystaples[0].name));assert.equal(review.status,'unverified');assert.match(review.explanation,/Possible alternate-route text/);assert.match(review.explanation,/applicability have not been verified/);
// Archetype/generic labels in quotation marks are not exact card names.
fusion.text='2 "Fixture" monsters\nMust first be Fusion Summoned.';reviewed=await fusionBuild();review=reviewed.buildDiagnostics.summoningReview[0];assert.equal(review.materialParsing,'unparsed');assert.deepEqual(review.missingNamedMaterials,[]);assert.match(review.explanation,/generic or unparsed/);
fusion.text='3 "'+yseed.name+'"\nMust first be Fusion Summoned.';reviewed=await fusionBuild();review=reviewed.buildDiagnostics.summoningReview[0];assert.deepEqual(review.missingNamedMaterials,[]);assert.equal(review.status,'unverified','present material names do not prove availability or a summon effect');
// A Fusion requested as the core must not be advertised as successfully playable.
fusion.text='3 "Required missing dragon"\nMust first be Fusion Summoned.';reviewed=await fusionBuild(fusion.id);assert.equal(reviewed.buildDiagnostics.ready,true);assert.equal(reviewed.buildDiagnostics.coreRouteUnverified,true);assert.match(S.ui.tbuild.msg,/Core route unverified/);assert.match(T.tcgBuildSheet(),/Complete list, core route unverified/);reviewSaved=await saveReopen(reviewed);assert.match(reviewSaved.message,/complete list, core route unverified/);assert.match(reviewSaved.html,/Complete list, core route unverified/);
const reviewedIndex=S.ui.tbuild.results.tcg.indexOf(reviewed);await A.tTierSaveGo({dataset:{i:String(reviewedIndex),to:'playtest'}});assert.match(messages.at(-1),/core route unverified/);await A.tTierSaveAll();assert.match(messages.at(-1),/unverified core route/);assert.match(messages.at(-1),/Extra Deck summoning review/);
console.log('PASS: actual YGO optional/core Fusion builds persist exact/generic/alternative-route uncertainty through preview, Save, Save+Playtest, Save All and reopen, without a false impossibility or summon-verification claim.');
// Exact purchase choices survive actual Build and saved-deck optimization.
yseed.sets[0].quotes=[{edition:'Unlimited',market:1},{edition:'1st Edition',market:200}];
const requestedPrinting=yseed.sets[0].code+'::Common';
reset('ygo');S.ui.sheetCtx={type:'tcard',game:'ygo',id:yseed.id,priceEdition:requestedPrinting,priceYgoEdition:'1st-edition',ygoEditionExplicit:true};
await A.tBuild({dataset:{id:yseed.id,format:'tcg'}});await settle();
assert.equal(S.ui.tbuild.ygoPurchaseSelections[yseed.id].edition,'1st-edition');
let exactTier=forBudget(S.ui.tbuild.results.tcg,50);assert.equal(exactTier.buildDiagnostics.ready,false);assert(exactTier.buildDiagnostics.missingRequiredSeeds.some(s=>s.id===yseed.id));
let exactUncapped=forBudget(S.ui.tbuild.results.tcg,Infinity);assert.equal(exactUncapped.zones.main.find(r=>r.cardId===yseed.id).ygoPurchaseSelection.edition,'1st-edition');
const exactSaved=await saveReopen(exactUncapped);assert.equal(exactSaved.saved.zones.main.find(r=>r.cardId===yseed.id).ygoPurchaseSelection.edition,'1st-edition');assert.match(exactSaved.html,/1st Edition/);
reset('ygo');S.ui.sheetCtx={type:'tcard',game:'ygo',id:yseed.id,priceEdition:requestedPrinting,priceYgoEdition:'1st-edition',ygoPriceDefault:'1st-edition'};
await A.tBuild({dataset:{id:yseed.id,format:'tcg'}});await settle();assert.equal(S.ui.tbuild.ygoPurchaseSelections[yseed.id].edition,undefined,'Automatic preview does not constrain purchase edition');assert.equal(forBudget(S.ui.tbuild.results.tcg,Infinity).zones.main.find(r=>r.cardId===yseed.id).ygoPurchaseSelection.edition,'unlimited');
reset('ygo');S.ui.sheetCtx={type:'tcard',game:'ygo',id:yseed.id,priceEdition:requestedPrinting,priceYgoEdition:'',ygoEditionExplicit:true};await A.tBuild({dataset:{id:yseed.id,format:'tcg'}});await settle();assert.equal(forBudget(S.ui.tbuild.results.tcg,Infinity).zones.main.find(r=>r.cardId===yseed.id).ygoPurchaseSelection.edition,'');assert(forBudget(S.ui.tbuild.results.tcg,Infinity).buildDiagnostics.unpricedPurchaseCopies>0);
reset('ygo');S.ui.sheetCtx={type:'tcard',game:'ygo',id:yseed.id,priceEdition:'',priceYgoEdition:'',ygoPrintingExplicit:true};await A.tBuild({dataset:{id:yseed.id,format:'tcg'}});await settle();
const clearedPrinting=forBudget(S.ui.tbuild.results.tcg,Infinity);assert.equal(clearedPrinting.zones.main.find(r=>r.cardId===yseed.id).ygoPurchaseSelection.printingKey,'');assert(clearedPrinting.buildDiagnostics.unpricedPurchaseCopies>0);const clearedSaved=await saveReopen(clearedPrinting);assert.equal(clearedSaved.saved.zones.main.find(r=>r.cardId===yseed.id).ygoPurchaseSelection.printingKey,'');assert(T.tcgBuildDiagnostics('ygo',clearedSaved.saved,formatOf('ygo','tcg')).unpricedPurchaseCopies>0);assert.match(clearedSaved.html,/price unknown/);
reset('ygo');ctx.baseFixture=exactSaved.saved;S.state.tcg.ygo.decks=[ctx.baseFixture];vm.runInContext('openBuild("ygo",["yseed"],"",baseFixture)',ctx);await settle();assert.equal(S.ui.tbuild.ygoPurchaseSelections[yseed.id].edition,'1st-edition');assert.equal(forBudget(S.ui.tbuild.results.tcg,50).buildDiagnostics.ready,false);
reset('ygo');ctx.baseFixture={...exactSaved.saved,zones:{main:[{cardId:yseed.id,qty:1,ygoPurchaseSelection:{printingKey:requestedPrinting,edition:'1st-edition'}},{cardId:yseed.id,qty:1,ygoPurchaseSelection:{printingKey:requestedPrinting,edition:'unlimited'}}]}};const beforeConflict=JSON.stringify(S.ui.tbuild);vm.runInContext('openBuild("ygo",["yseed"],"",baseFixture)',ctx);assert.equal(JSON.stringify(S.ui.tbuild),beforeConflict);assert.match(messages.at(-1),/separate purchase editions.*unchanged/);
console.log('PASS: real detail→Build explicit/automatic/unknown edition isolation, saved row identity, and saved-deck optimization constraint preservation; conflicting edition rows stop for individual review.');
assert.equal(liveCalls,0);console.log('PASS: actual YGO manual/random/Ask handoffs retain full legal uncapped lists with explicit unknown cost; finite tiers remain honest drafts. No network/account/paid AI calls.');
// The new manual/chat adapter executes the same real TCG assembly and optimizer,
// then applies the shared complete-list/plan gate. No legacy popup or Save runs.
const {createDeckPipeline}=await import('./deck-pipeline.js');
const flow=createDeckPipeline({S,T:{...T,SOURCES:sources},tcgCtx:ctx.c});
reset('ptcg');energy.prices.usd=.1;named.set(energy.name,energy);
let sharedResult=await flow.build({game:'ptcg',format:'standard',seedCard:seed,budget:20,preferOwned:true,easy:true});
assert(sharedResult.ok,sharedResult.message);assert.equal(sharedResult.rows.reduce((n,r)=>n+r.qty,0),60);assert(flow.recheck(sharedResult));assert.equal(S.state.tcg.ptcg.decks.length,0);
energy.prices.usd=null;sharedResult=await flow.build({game:'ptcg',format:'standard',seedCard:seed,budget:20});assert.equal(sharedResult.ok,false,'unknown Energy prices cannot pass a strict cap');sharedResult=await flow.build({game:'ptcg',format:'standard',seedCard:seed,budget:20,budgetMode:'target'});assert(sharedResult.ok,sharedResult.message);assert.equal(sharedResult.pricing.estimate,null);assert(sharedResult.pricing.unpriced>0);
reset('ygo');sources.ygo.search=async()=>({cards:yarch});ystaples[0].text='';
sharedResult=await flow.build({game:'ygo',format:'tcg',seedCard:yseed,budget:20});assert.equal(sharedResult.ok,false,'unknown YGO prices cannot pass a strict cap');sharedResult=await flow.build({game:'ygo',format:'tcg',seedCard:yseed,budget:20,budgetMode:'target'});assert(sharedResult.ok,sharedResult.message);assert.equal(sharedResult.rows.filter(r=>r.zone==='main').reduce((n,r)=>n+r.qty,0),40);assert(sharedResult.rows.some(r=>r.id===yseed.id));assert(flow.recheck(sharedResult));
sources.ygo.search=async()=>({cards:[...yarch,fusion]});sharedResult=await flow.build({game:'ygo',format:'tcg',seedCard:fusion,budget:''});assert.equal(sharedResult.ok,false,'unverified core Fusion route cannot become a successful generated deck');assert.equal(S.state.tcg.ygo.decks.length,0);
console.log('PASS: shared actual Pokémon/YGO construction returns complete 60/40 lists with honest unknown prices; unsupported core Fusion blocks success and nothing auto-saves.');
// Shared pricing must use deckStats' allocation across logical Energy reprints.
const {priceDeck,inspectDeckPlan}=await import('./deck-construction.js');
const energyReprint={...energy,id:'energy-second-print',prices:{usd:1}};energy.prices.usd=1;T.cache.ptcg[energyReprint.id]=energyReprint;
reset('ptcg',[{cardId:energy.id,key:'name:'+energy.name,name:energy.name,qty:4}]);
const split={format:'standard',zones:{main:[{cardId:energy.id,qty:4},{cardId:energyReprint.id,qty:4}],extra:[],side:[]}};
const splitAssessment=T.flowAssessment('ptcg',split),splitPrice=priceDeck(splitAssessment.rows,'purchase');
assert.equal(splitPrice.ownedCopies,4);assert.equal(splitPrice.purchaseEstimate,4);assert.equal(splitPrice.purchaseEstimate,splitAssessment.diagnostics.knownPurchaseSubtotal);
// Candidate-specific attacker identity survives reprinting, and swaps recheck it.
const evolved={...seed,id:'evolved',name:'Fixture evolved',stage:'Stage1',basicPokemon:false,evolveFrom:seed.name};
const attackRows=[{card:seed,id:seed.id,qty:4,zone:'main'},{card:evolved,id:evolved.id,qty:4,zone:'main'},{card:energy,id:energy.id,qty:12,zone:'main'}];
let plan=inspectDeckPlan({game:'ptcg',seedCard:seed},attackRows,{planAttackers:['a-different-candidate-id']});
assert.deepEqual(plan.attackers.map(c=>c.id),[evolved.id]);assert.equal(plan.issues.length,0);
plan=inspectDeckPlan({game:'ptcg',seedCard:seed},attackRows.filter(r=>r.id!==energy.id),{planAttackers:['a-different-candidate-id']});assert(plan.issues.some(i=>/no attack supported/.test(i)));
console.log('PASS: logical inventory is allocated once across Energy reprints; each candidate checks its actual attacker and Energy.');

// Saved Pokémon variants keep the same finish quote as the generated result.
const variantCard={...seed,id:'variant-fixture',variants:[{key:'normal',usd:1},{key:'holofoil',usd:9}],prices:{usd:1}};T.cache.ptcg[variantCard.id]=variantCard;
reset('ptcg');const variantDeck={format:'standard',zones:{main:[{cardId:variantCard.id,name:variantCard.name,qty:2,ptcgPurchaseSelection:{variant:'holofoil'}}],extra:[],side:[]}};
const variantAssessment=T.flowAssessment('ptcg',JSON.parse(JSON.stringify(variantDeck)));
assert.equal(variantAssessment.rows[0].selection.variant,'holofoil');assert.equal(variantAssessment.rows[0].price,9);assert.equal(variantAssessment.diagnostics.knownPurchaseSubtotal,18);assert.equal(priceDeck(variantAssessment.rows,'purchase').purchaseEstimate,18);
console.log('PASS: serialized Pokémon finish selection, result estimate and reopened deck accounting agree.');
