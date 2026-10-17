import assert from 'node:assert/strict';
import fs from 'node:fs';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {normalizeYgoSets,resolveYgoSet,summarizeYgoSetContents,YGO_SET_CACHE_KEY,YGO_SET_LEGACY_CACHE_KEY} from './ygo.js';
import {SOURCES,cache,ui,entryPrice,setContextCard,ownedInSet,ownedBySet,tcgSets,tcgSet,tcgCardSheet,tcgAddSheet,registerTcg} from './tcg.js';
import {tcgSetBadge} from './emblems.js';
import {setYearSections,setRowContent,setCardFacets,filterSortSetCards,setProgressMarkup} from './set-list-ui.js';
const catalogue=normalizeYgoSets([
 {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08',num_of_cards:744},
 {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',tcg_date:'2023-04-21',num_of_cards:126},
 {set_code:'KC01',set_name:'Kaiba Collection',tcg_date:'2022-01-01',num_of_cards:1},
]);
const original=resolveYgoSet(catalogue,'Legend of Blue Eyes White Dragon').set,anniversary=resolveYgoSet(catalogue,'Legend of Blue Eyes White Dragon (25th Anniversary Edition)').set;
const card={game:'ygo',id:'4614116',name:'Dark Energy',category:'Spell',race:'Normal',prices:{usd:999},sets:[{code:'KC01-EN001',name:'Kaiba Collection',rarity:'Ultra Rare',price:999},{code:'LOB-118',name:original.name,rarity:'Common',price:null},{code:'LOB-EN118',name:anniversary.name,rarity:'Common',price:88}],image:'',fetchedAt:new Date().toISOString(),artSchema:1,printPriceSchema:1};
const snapshot=structuredClone(card),projection=setContextCard('ygo',card,original,catalogue);
assert.equal(projection.setContext.releaseId,original.id);assert.equal(projection.setContext.cardId,'4614116');assert.equal(projection.setContext.game,'ygo');assert.equal(projection.setContext.price,null);assert.equal(projection.prices.usd,null);assert.equal(projection.sets[0].code,'LOB-118');assert.equal(projection.setContext.edition,'unknown');assert.deepEqual(card,snapshot,'projection never mutates generic source card');
assert.match(tcgSetBadge(projection),/>LOB</);assert.doesNotMatch(tcgSetBadge(projection),/KC01/);
assert.equal(setContextCard('ygo',card,anniversary,catalogue).prices.usd,88);
assert.equal(setContextCard('ygo',card,'LOB',catalogue).setContext.status,'missing');assert.equal(setContextCard('ygo',card,'missing',catalogue).prices.usd,null);
const ambiguous={...card,sets:[...card.sets,{code:'LOB-E118',name:original.name,rarity:'Rare',price:10}]};
assert.equal(setContextCard('ygo',ambiguous,original,catalogue).setContext.printing,null);assert.equal(setContextCard('ygo',ambiguous,original,catalogue).prices.usd,null);
const contaminated={...card,sets:[{code:'LOB-EN118',name:original.name,rarity:'Common',price:88,priceSource:'TCGplayer via TCGCSV',productId:999,quotes:[{edition:'Unlimited',market:88}]},{code:'LOB-EN118',name:anniversary.name,rarity:'Common',price:88,priceSource:'TCGplayer via TCGCSV',productId:999,quotes:[{edition:'Unlimited',market:88}]}]};
const isolated=setContextCard('ygo',contaminated,original,catalogue);assert.equal(isolated.prices.usd,null);assert.equal(isolated.sets[0].productId,null);assert.deepEqual(isolated.sets[0].quotes,[]);assert.equal(contaminated.sets[0].price,88,'legacy cache evidence preserved for recovery');

const reusedCatalogue=normalizeYgoSets([{set_code:'X',set_name:'Reused Release',tcg_date:'2001-01-01'},{set_code:'X',set_name:'Reused Release',tcg_date:'2023-01-01'}]);
const reused={...card,sets:[{code:'X-001',name:'Reused Release',rarity:'Common',price:88,url:'https://www.tcgplayer.com/product/123',productId:123,quotes:[{edition:'Unlimited',market:88}]}]};
const unresolved=setContextCard('ygo',reused,reusedCatalogue[0],reusedCatalogue);assert.equal(unresolved.setContext.status,'ambiguous');assert.equal(unresolved.sets[0].price,null);assert.equal(unresolved.sets[0].productId,null);assert.deepEqual(unresolved.sets[0].quotes,[]);
const wrong=[{cardId:'4614116',printing:'KC01-EN001',rarity:'Ultra Rare',qty:8}];
assert.equal(ownedInSet('ygo',card,original,wrong,catalogue),0);
assert.equal(ownedInSet('ygo',card,original,[{cardId:'4614116',printing:'LOB-118',rarity:'Common',qty:8}],catalogue),0,'legacy reused code is unresolved even with a matching card name');
const exact=[{cardId:'4614116',printing:'LOB-118',rarity:'Common',qty:8,setReleaseId:original.id}];
assert.equal(ownedInSet('ygo',card,original,exact,catalogue),8);assert.equal(ownedInSet('ygo',card,anniversary,exact,catalogue),0);
const pokemon={game:'ptcg',id:'fixturea-001',name:'Same Trainer',category:'Trainer',set:{id:'fixturea',name:'A',number:'001'},prices:{usd:1},rarity:'Common',variants:[{key:'normal'}]},release={id:'fixturea',name:'A',count:123};
assert.equal(ownedInSet('ptcg',pokemon,release,[{cardId:'fixtureb-001',name:'Same Trainer',key:'name:Same Trainer',qty:99}],[]),0);
assert.equal(setContextCard('ptcg',pokemon,{id:'unrelated'},[]).setContext.status,'missing');
assert.equal(ownedInSet('ptcg',pokemon,release,[{cardId:'fixturea-001',qty:5}],[]),5);
const variantCard={...pokemon,variants:[{key:'normal',usd:1},{key:'holofoil',usd:7}]};
const selectedVariant=setContextCard('ptcg',variantCard,release,[],{variantKey:'holofoil'});assert.equal(selectedVariant.setContext.variantKey,'holofoil');assert.equal(selectedVariant.prices.usd,7);assert.equal(setContextCard('ptcg',variantCard,release,[],{variantKey:'nonexistent'}).prices.usd,null);
assert.equal(setContextCard('ptcg',selectedVariant,release,[],{variantKey:''}).setContext.variantKey,'');assert.equal(setContextCard('ptcg',selectedVariant,release,[],{variantKey:'reference'}).prices.usd,1,'changing from holo to reference recovers original reference, not projected holo');assert.equal(selectedVariant.setContext.referencePrice,1);
const gallery={id:'gallery',name:'Verified gallery'},galleryCard={...pokemon,id:'parent-RC1',set:{id:'parent',name:'Source parent',number:'RC1'},setContext:{game:'ptcg',cardId:'parent-RC1',releaseId:'gallery',membership:'set-response'}};
const galleryProjection=setContextCard('ptcg',galleryCard,gallery,[]);assert.equal(galleryProjection.set.id,'gallery');assert.equal(galleryProjection.set.name,'Verified gallery');assert.equal(galleryProjection.setContext.sourceSet.id,'parent');assert.equal(galleryCard.set.id,'parent');assert.equal(setContextCard('ptcg',galleryProjection,{id:'other-gallery'},[]).setContext.status,'missing');


assert.deepEqual(setCardFacets([projection],'ygo').finishes,[],'YGO finishes not invented from rarity');assert.deepEqual(filterSortSetCards([setContextCard('ygo',ambiguous,original,catalogue)],'ygo',{q:'LOB-E118'}).map(c=>c.id),['4614116'],'collector search matches every verified regional number without selecting its price');
assert.deepEqual(filterSortSetCards([pokemon,{...pokemon,id:'fixturea-002',set:{...pokemon.set,number:'002'},name:'Second',rarity:'Rare'}],'ptcg',{rarity:'Common'}).map(c=>c.id),['fixturea-001']);
const initial=setProgressMarkup({key:original.id,owned:1,total:126,loaded:14,complete:false});assert.match(initial.html,/aria-valuemax="126"/);assert.match(initial.html,/aria-valuenow="1"/);assert.match(initial.html,/14 unique cards loaded of 126/);assert.doesNotMatch(initial.html,/progress-changed/);
const changed=setProgressMarkup({key:original.id,owned:2,total:126,loaded:14,previous:initial.snapshot});assert.match(changed.html,/progress-changed/);assert.match(changed.html,/--progress-from:0\.0079/);
assert.doesNotMatch(setProgressMarkup({key:original.id,owned:2,total:126,loaded:14,previous:changed.snapshot}).html,/progress-changed/);
assert.doesNotMatch(setProgressMarkup({key:'unknown',owned:1,total:null,loaded:14}).html,/role="progressbar"|\d+%/);
assert.doesNotMatch(setProgressMarkup({key:'overflow',owned:127,total:126,loaded:127}).html,/role="progressbar"|\d+%/);
assert.match(setRowContent({name:'Unknown',code:'X',count:null}),/Unknown/);assert.doesNotMatch(setRowContent({name:'Unknown',code:'X',count:null}),/<b>0<\/b>/);
const years=setYearSections(catalogue,s=>`<button data-id="${s.id}"></button>`);assert.equal((years.match(/class="set-year-section"/g)||[]).length,3);assert.doesNotMatch(years,/<div class="set-list set-year-grid"><h2/);
const css=fs.readFileSync('sets-ui.css','utf8');assert.match(css,/420ms/);assert.match(css,/prefers-reduced-motion:reduce/);assert.doesNotMatch(css,/\.bar[^}]*animation/);

// Run actual registered actions with deferred providers. No network/browser required.
const records=new Map();globalThis.localStorage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value)};
S.state=blank();S.state.settings.game='ygo';S.state.tcg={ygo:blankGame(),ptcg:blankGame()};S.state.tcg.ygo.collection=exact;
Object.assign(ui('ygo').sets,{list:catalogue,busy:false,error:'',q:'',limit:80});Object.assign(ui('ygo').set,{id:'',generation:0,loaded:false,busy:false});cache.ygo[card.id]=card;
const A={},C={},I={},renders=[],sheets=[],ctx={A,C,I,render:()=>renders.push(ui('ygo').set.info?.id),commit:async fn=>fn(S.state),openSheet:(html,context)=>{S.ui.sheetCtx=context;sheets.push(html);},closeSheet:()=>{S.ui.sheetCtx=null;},toast:()=>{},go:()=>{},rerenderKeepingFocus:()=>{},writeRecord:async()=>{}};
registerTcg(ctx);S.ui.view='set';
const real=SOURCES.ygo.setContents,requests=new Map();SOURCES.ygo.setContents=set=>new Promise((resolve,reject)=>requests.set(set.id,{resolve,reject}));
try{
 S.ui.tsetId=original.id;const first=ctx.openSet(original.id);S.ui.tsetId=anniversary.id;const second=ctx.openSet(anniversary.id);
 requests.get(anniversary.id).resolve(summarizeYgoSetContents(anniversary,[card]));await second;assert.equal(ui('ygo').set.info.id,anniversary.id);
 requests.get(original.id).resolve(summarizeYgoSetContents(original,[card]));await first;assert.equal(ui('ygo').set.info.id,anniversary.id);assert.equal(ui('ygo').set.cards[0].setContext.releaseId,anniversary.id,'late release A cannot mix with release B');assert.equal(cache.ygo[card.id].setContext,undefined,'no contextual card written to shared cache');assert.equal(cache.ygo[card.id].prices.usd,999);
 const sameCode={...card,sets:[{code:'LOB-EN118',name:anniversary.name,rarity:'Common',price:88},{code:'LOB-EN118',name:original.name,rarity:'Common',price:5}]};
 assert.equal(entryPrice(sameCode,{cardId:card.id,setReleaseId:original.id,printing:'LOB-EN118',rarity:'Common',condition:'Near Mint'}),5,'saved canonical lot retains original release quote');
 assert.equal(entryPrice(sameCode,{cardId:card.id,setReleaseId:anniversary.id,printing:'LOB-EN118',rarity:'Common',condition:'Near Mint'}),88);
 assert.equal(entryPrice(sameCode,{cardId:card.id,printing:'BOGUS-001',rarity:'Common',condition:'Near Mint'}),null,'unknown requested printing cannot fall back to generic price');
 assert.equal(entryPrice(sameCode,{cardId:card.id,printing:'LOB-EN118',rarity:'Common',condition:'Near Mint'}),null,'unbound repeated printing cannot choose first release');

 S.ui.tsetId=original.id;const fail=ctx.openSet(original.id);requests.get(original.id).reject(Error('Temporary fixture failure'));await fail;assert.match(ui('ygo').set.error,/fixture/);assert.match(tcgSet(),/data-act="tSetRetry"/);
 const retry=A.tSetRetry();requests.get(original.id).resolve(summarizeYgoSetContents(original,[card]));await retry;assert.equal(ui('ygo').set.loaded,true);assert.equal(ui('ygo').set.error,'');assert.equal(ui('ygo').set.info.id,original.id);assert.equal(ownedBySet('ygo').get(original.id),1,'eight copies count as one unique slot');
 const html=tcgSet();assert.match(html,/data-set-id="ygo:LOB/);assert.match(html,/aria-valuenow="1"/);assert.doesNotMatch(html,/fewer-than-expected|KC01|\$999/);
 S.ui.tsetId='LOB';await ctx.openSet('LOB');assert.equal(ui('ygo').set.candidates.length,2);assert.match(tcgSet(),/set-release-chooser/);assert.match(tcgSet(),new RegExp(original.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 S.ui.tsetId=original.id;const abandoned=ctx.openSet(original.id);S.ui.view='search';requests.get(original.id).resolve(summarizeYgoSetContents(original,[card]));await abandoned;assert.equal(ui('ygo').set.id,'','returning to an abandoned route can load again');
 assert.equal(ui('ygo').set.busy,false);
 // Saving a contextual printing carries the canonical release but never fabricates an edition.
 const nodes={'#lotManualValue':{value:''},'#tQty':{value:'3'},'#tPrint':{value:'LOB-118|Common'},'#tEdition':{value:''},'#tCond':{value:'Lightly Played'},'#tLoc':{value:''}};
 globalThis.document={querySelector:key=>nodes[key]||null};
 S.ui.sheetCtx={type:'tadd',game:'ygo',id:card.id,setId:original.id};await A.tOwnSave({dataset:{id:card.id,setId:original.id}});
 const saved=S.state.tcg.ygo.collection.at(-1);assert.equal(saved.setReleaseId,original.id);assert.equal(saved.printing,'LOB-118');assert.equal(saved.qty,3);assert.equal(saved.edition,'');assert.equal(saved.condition,'Lightly Played');
 const count=S.state.tcg.ygo.collection.length;await A.tOwnSave({dataset:{id:card.id,setId:original.id}});assert.equal(S.state.tcg.ygo.collection.length,count,'closed/stale add cannot save again');
 S.ui.sheetCtx={type:'tadd',game:'ygo',id:card.id,setId:original.id};nodes['#tPrint'].value='';await A.tOwnSave({dataset:{id:card.id,setId:original.id}});assert.equal(S.state.tcg.ygo.collection.at(-1).setReleaseId,'','Not sure does not claim a verified release');assert.equal(S.state.tcg.ygo.collection.at(-1).setReleaseUnverified,true);assert.equal(entryPrice(card,S.state.tcg.ygo.collection.at(-1)),null,'unknown contextual save stays unpriced after the sheet closes');

 // Exact add opens the source printing, not the first generic row, and edition is not guessed.
 S.ui.sheetCtx={type:'tcard',game:'ygo',id:'4614116',setId:original.id};A.tOwn({dataset:{id:'4614116'}});assert.equal(S.ui.sheetCtx.setId,original.id);assert.match(sheets.at(-1),/value="LOB-118\|Common" selected/);assert.doesNotMatch(sheets.at(-1),/KC01/);assert.match(sheets.at(-1),/<option value="" selected>Not sure<\/option>/);
 S.ui.sheetCtx={type:'tcard',game:'ygo',id:card.id,setId:original.id,priceEdition:'LOB-118::Common',priceYgoEdition:'1st-edition'};A.tOwn({dataset:{id:card.id}});assert.match(sheets.at(-1),/value="LOB-118\|Common" selected/);assert.match(sheets.at(-1),/value="1st-edition" selected>First Edition/,'only an explicitly selected edition carries into Add');
 // Reopening a newly scoped saved lot must retain its release or explicit uncertainty.
 nodes['#sheetBody']={scrollTop:0};await A.tCard({dataset:{id:card.id,entry:saved.id}});assert.equal(S.ui.sheetCtx.setId,original.id);assert.equal(S.ui.sheetCtx.priceEdition,'LOB-118::Common');assert.doesNotMatch(sheets.at(-1),/KC01|\$999/);
 const unknownSaved=S.state.tcg.ygo.collection.find(e=>e.setReleaseUnverified);await A.tCard({dataset:{id:card.id,entry:unknownSaved.id}});assert.equal(S.ui.sheetCtx.setReleaseUnverified,true);assert.equal(S.ui.sheetCtx.setId,'');assert.doesNotMatch(sheets.at(-1),/KC01|\$999/);assert.match(sheets.at(-1),/Owned copy<\/b> <span class="muted">· printing unverified/);assert.doesNotMatch(sheets.at(-1),/Not in your collection/);assert.equal(ownedInSet('ygo',card,original,[unknownSaved],catalogue),0,'the saved-copy explanation grants no verified set credit');
 A.tOwn({dataset:{id:card.id}});assert.equal(S.ui.sheetCtx.setReleaseUnverified,true);assert.doesNotMatch(sheets.at(-1),/KC01|\$999/);
 const unverifiedProjection=setContextCard('ygo',card,'',catalogue,{unverifiedRelease:true});assert.equal(unverifiedProjection.setContext.status,'missing');assert.equal(unverifiedProjection.prices.usd,null);assert.deepEqual(unverifiedProjection.sets,[]);


}finally{SOURCES.ygo.setContents=real;}
// Two clicks while the storage transaction is pending must be one save; failures can retry.
const delayedActions={},jobs=[],delayedContext={...ctx,A:delayedActions,C:{},I:{},commit:(fn,options)=>new Promise((resolve,reject)=>jobs.push({fn,options,resolve,reject}))};
registerTcg(delayedContext);
const delayedNodes={'#lotManualValue':{value:''},'#tQty':{value:'2'},'#tPrint':{value:'LOB-118|Common'},'#tEdition':{value:''},'#tCond':{value:'Moderately Played'},'#tLoc':{value:''}};
globalThis.document={querySelector:key=>delayedNodes[key]||null};
S.ui.sheetCtx={type:'tadd',game:'ygo',id:card.id,setId:original.id};
const saveFirst=delayedActions.tOwnSave({dataset:{id:card.id,setId:original.id}}),saveDuplicate=delayedActions.tOwnSave({dataset:{id:card.id,setId:original.id}});
assert.equal(jobs.length,1,'in-flight duplicate Add never queues a second mutation');delayedNodes['#tCond'].value='Damaged';
const job=jobs.shift();assert.equal(job.options.guard(),true);job.resolve(job.fn(S.state));await Promise.all([saveFirst,saveDuplicate]);assert.equal(S.state.tcg.ygo.collection.at(-1).qty,2);assert.equal(S.state.tcg.ygo.collection.at(-1).condition,'Moderately Played','queued save uses the captured form, not later field changes');
S.ui.sheetCtx={type:'tadd',game:'ygo',id:card.id,setId:original.id};const failedSave=delayedActions.tOwnSave({dataset:{id:card.id,setId:original.id}});jobs.shift().reject(Error('Fixture storage failed'));await assert.rejects(failedSave,/storage failed/);const retriedSave=delayedActions.tOwnSave({dataset:{id:card.id,setId:original.id}});assert.equal(jobs.length,1,'failed storage write releases pending guard for explicit retry');const retryJob=jobs.shift();retryJob.resolve(retryJob.fn(S.state));await retriedSave;

// Cache migration preserves original record and refreshes schema-v2 identity collisions.
Object.assign(ui('ygo').sets,{list:[],busy:false,error:''});records.clear();records.set(YGO_SET_LEGACY_CACHE_KEY,JSON.stringify({at:Date.now(),list:catalogue.map(s=>({...s,id:s.code,catalogSchema:2}))}));let fetches=0;const actualSets=SOURCES.ygo.sets;SOURCES.ygo.sets=async()=>{fetches++;return catalogue;};
try{await ctx.loadSets('ygo');assert.equal(fetches,1);assert(records.has(YGO_SET_LEGACY_CACHE_KEY));assert.equal(JSON.parse(records.get(YGO_SET_CACHE_KEY)).schema,3);assert.equal(new Set(ui('ygo').sets.list.map(s=>s.id)).size,3);}finally{SOURCES.ygo.sets=actualSets;}
assert.match(tcgSets(),/set-year-section/);
// A broken new cache must not hide the recoverable legacy catalogue while offline.
ui('ygo').sets.list=[];records.set(YGO_SET_CACHE_KEY,'broken-json');SOURCES.ygo.sets=async()=>{throw Error('Fixture offline');};
try{await ctx.loadSets('ygo',true);assert.equal(ui('ygo').sets.list.length,3);assert.match(ui('ygo').sets.error,/offline/);assert(records.has(YGO_SET_LEGACY_CACHE_KEY));}finally{SOURCES.ygo.sets=actualSets;}
const priorCatalogue=ui('ygo').sets.list;ui('ygo').sets.list=[];
const cachedValueCard={...card,sets:[{code:'LOB-EN118',name:anniversary.name,rarity:'Common',price:88},{code:'LOB-EN118',name:original.name,rarity:'Common',price:5}]};
assert.equal(entryPrice(cachedValueCard,{cardId:card.id,setReleaseId:original.id,printing:'LOB-EN118',rarity:'Common',condition:'Near Mint'}),5,'saved lot resolves persisted catalogue after reload before Sets is opened');ui('ygo').sets.list=priorCatalogue;

// Missing catalogue evidence does not erase the existence of the matching saved copy.
const copyCatalogue=ui('ygo').sets.list,copyRecords=new Map(records),copyCollection=S.state.tcg.ygo.collection;
ui('ygo').sets.list=[];records.clear();
const scopedSaved={id:'missing-catalogue-saved-lot',cardId:card.id,setReleaseId:original.id,printing:'LOB-118',rarity:'Common',qty:3};
S.state.tcg.ygo.collection=[scopedSaved];
try{
 const detailContext={type:'tcard',game:'ygo',id:card.id,entryId:scopedSaved.id,setId:original.id};
 const missingCopy=tcgCardSheet(card,detailContext);
 assert.match(missingCopy,/Owned copy<\/b> <span class="muted">· printing unverified/);
 assert.doesNotMatch(missingCopy,/Not in your collection|KC01|\$999/);
 const missingCard=setContextCard('ygo',card,original.id,[]);
 assert.equal(missingCard.setContext.status,'missing');assert.equal(missingCard.prices.usd,null);
 assert.equal(entryPrice(card,scopedSaved),null,'explanatory ownership copy does not grant a reference price');
 assert.equal(ownedInSet('ygo',missingCard,original,[scopedSaved],[]),0,'explanatory ownership copy does not grant set-completion credit');
 assert.equal(ownedBySet('ygo').size,0);
 for(const mismatch of [{entryId:'different-entry'},{id:'different-card-context'},{game:'ptcg'},{setId:anniversary.id}]){
  const html=tcgCardSheet(card,{...detailContext,...mismatch});
  assert.doesNotMatch(html,/Owned copy<\/b>/,'a mismatched saved context cannot claim this copy');
  assert.match(html,/Not in your collection/);
 }
 const differentCard=tcgCardSheet({...card,id:'different-card'},detailContext);
 assert.doesNotMatch(differentCard,/Owned copy<\/b>/,'the entry must match the displayed card ID');
}finally{ui('ygo').sets.list=copyCatalogue;records.clear();for(const [key,value] of copyRecords)records.set(key,value);S.state.tcg.ygo.collection=copyCollection;}

console.log('PASS: exact release copies, no generic price/ownership leakage, unique progress/coverage/motion, data-driven facets, year grids, stale request isolation, same-route retry, legacy chooser, contextual add and recoverable v3 migration.');
