// Exact-release integration: pure app callbacks + deterministic providers, no live traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {CONDITION_IDENTITY} from './condition-feed.js';
import {normalizeYgoSets,YGO_SET_CACHE_KEY} from './ygo.js';
import * as T from './tcg.js';
import {S,blank} from './store.js';
import {presentationQuote,sellerModels,compactPriceSummary,matchingLot,detailIdentity,selectedFinish} from './pricing-presentation.js';
import {myPriceKey,myPrice,useMyPrices} from './mtg-tcgprice.js';
import {historyPanel,recordQuote,quoteModel,registerWorkbench} from './workbench-ui.js';
import {SheetHistory,sheetKey} from './sheet-history.js';
import {makeAskTools} from './ai-tools.js';
import {readTurn,cleanTurn} from './ai-ask-route.js';
import {setPage,setsPage} from './views.js';
const app=fs.readFileSync('app.js','utf8');
S.state=blank();S.state.tcg={ygo:{collection:[],decks:[],wishlist:[]},ptcg:{collection:[],decks:[],wishlist:[]}};S.state.settings.game='ygo';
const releases=normalizeYgoSets([
 {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08'},
 {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',tcg_date:'2023-04-20'},
]);
const original=releases.find(s=>s.date==='2002-03-08'),anniversary=releases.find(s=>s.date==='2023-04-20');
assert(anniversary.id.length>80);
T.ui('ygo').sets.list=releases;
const ygo={id:'89631139',game:'ygo',name:'Blue-Eyes White Dragon',prices:{usd:999},sets:[
 {name:original.name,code:'LOB-001',rarity:'Ultra Rare',price:11,productId:111},
 {name:anniversary.name,code:'LOB-EN001',rarity:'Ultra Rare',price:22,productId:222},
]};
T.cache.ygo[ygo.id]=ygo;
const before=JSON.stringify(ygo),a=T.setContextCard('ygo',ygo,original.id),b=T.setContextCard('ygo',ygo,anniversary.id);
assert.equal(JSON.stringify(ygo),before,'context projection cannot mutate cache');
assert.equal(presentationQuote('ygo',a).value,11);assert.equal(presentationQuote('ygo',b).value,22);
assert.notEqual(presentationQuote('ygo',a).key,presentationQuote('ygo',b).key);
assert.equal(sellerModels('ygo',b,{},[])[0].url,'https://www.tcgplayer.com/product/222');
assert.equal(sellerModels('ygo',b,{},[])[0].value,22);
const unknown=T.setContextCard('ygo',ygo,'LOB');
assert.equal(presentationQuote('ygo',unknown).value,null);
assert.equal(sellerModels('ygo',unknown,{},[])[0].direct,false);
assert.doesNotMatch(compactPriceSummary('ygo',unknown,{},{value:999,date:'2026-10-17'}),/\$999/);
assert.equal(presentationQuote('ygo',a,'reference','OTHER-001::Rare').value,null);
const reusedName=normalizeYgoSets([{code:'REP',name:'Repeated exact name',date:'2002-01-01'},{code:'REP',name:'Repeated exact name',date:'2023-01-01'}]);
const sameName=T.setContextCard('ygo',{...ygo,sets:[{code:'REP-001',name:'Repeated exact name',rarity:'Rare',price:500}]},reusedName[0],reusedName);
assert.equal(sameName.setContext.status,'ambiguous');assert.equal(presentationQuote('ygo',sameName,'reference','REP-001::Rare').value,null);
assert.equal(myPriceKey(sameName),null);
useMyPrices({[myPriceKey(ygo)]:{price:987}});
assert.equal(myPrice(ygo),987);assert.equal(myPrice(a),null,'old wildcard value stays generic');
assert.notEqual(myPriceKey(a),myPriceKey(b));
assert.notEqual(myPriceKey(a,'nonfoil',{priceYgoEdition:'1st-edition'}),myPriceKey(a,'nonfoil',{priceYgoEdition:'unlimited'}));
useMyPrices({[myPriceKey(a,'nonfoil',{priceYgoEdition:'1st-edition'})]:{price:33}});
assert.equal(myPrice(a,'nonfoil',{priceYgoEdition:'1st-edition'}),33);assert.equal(myPrice(a,'nonfoil',{priceYgoEdition:'unlimited'}),null);assert.equal(myPrice(b,'nonfoil',{priceYgoEdition:'1st-edition'}),null);
const damaged={id:'lot-a',cardId:ygo.id,printing:'LOB-001',rarity:'Ultra Rare',edition:'',setReleaseId:original.id,condition:'Damaged',manualValue:5};
S.state.tcg.ygo.collection=[damaged];
assert.equal(matchingLot('ygo',a,{entryId:damaged.id},S.state)?.id,damaged.id);
assert.equal(matchingLot('ygo',b,{entryId:damaged.id},S.state),null);
const qa=presentationQuote('ygo',a),qb=presentationQuote('ygo',b);
recordQuote(S.state,{...presentationQuote('ygo',ygo),value:999});recordQuote(S.state,qa);
assert.doesNotMatch(historyPanel(qb),/\$999|\$11\.00/,'exact release history never borrows card or another release');
recordQuote(S.state,qb);assert.match(historyPanel(qb),/data-history-state="edition-required"/);
// An edition-unspecified current check is not an exact physical-edition history.
const pricedB=T.setContextCard('ygo',{...ygo,sets:ygo.sets.map(s=>({...s,quotes:[{edition:'1st Edition',market:s.price}]}))},anniversary.id),exactB=presentationQuote('ygo',pricedB,'reference','','1st-edition');
assert.doesNotMatch(historyPanel(exactB),/1 verified observation/);recordQuote(S.state,exactB);assert.match(historyPanel(exactB),/\$22\.00/);assert.match(historyPanel(exactB),/1 verified observation/);assert.doesNotMatch(historyPanel(exactB),/\$999|\$11\.00/);
const releaseA={id:'pk-a',name:'Set A'},releaseB={id:'pk-b',name:'Set B'};T.ui('ptcg').sets.list=[releaseA,releaseB];
const pk={id:'pk-a-1',game:'ptcg',name:'Potion',set:{id:'pk-a',name:'Set A',number:'1'},prices:{usd:2},variants:[{key:'normal',usd:2,productId:301},{key:'holofoil',usd:9,productId:302}]};
const pkA=T.setContextCard('ptcg',pk,releaseA),pkWrong=T.setContextCard('ptcg',pk,releaseB);
assert.equal(presentationQuote('ptcg',pkWrong,'holofoil').value,null);assert.equal(sellerModels('ptcg',pkWrong,{priceFinish:'holofoil'})[0].direct,false);assert.equal(myPriceKey(pkWrong),null);
assert.notEqual(myPriceKey(pkA,'nonfoil',{priceFinish:'normal'}),myPriceKey(pkA,'nonfoil',{priceFinish:'holofoil'}));
assert.equal(sellerModels('ptcg',pkA,{priceFinish:'holofoil'})[0].url,'https://www.tcgplayer.com/product/302');
assert.equal(presentationQuote('ygo',pkA).value,null,'cross-game card context rejected');
assert.equal(T.ownedInSet('ptcg',pkA,releaseA,[{cardId:'pk-b-1',name:'Potion',qty:12}]),0,'cross-set name-equivalent trainers do not count');
const history=new SheetHistory(),ctxA={type:'tcard',game:'ygo',id:ygo.id,setId:original.id},ctxB={...ctxA,setId:anniversary.id};
assert.notEqual(sheetKey(ctxA),sheetKey(ctxB));assert(history.push({ctx:ctxA},ctxB));assert.equal(history.pop().ctx.setId,original.id);
assert.notEqual(detailIdentity(ctxA),detailIdentity(ctxB));
console.log('PASS: exact release/printing/variant prices, sellers, private keys, conditions, history and back-stack remain isolated; missing/ambiguous context stays unknown.');

// Run the actual app projection and price-tab callback against those same records.
const helper=app.slice(app.indexOf('function contextTcgCard('),app.indexOf('const detailContextIdentity='));
const callbacks=app.slice(app.indexOf('A.cardTab = async'),app.indexOf('const jumpToCardPrices'));
let rendered=0,recorded;
const harness={S,T,A:{},$:()=>null,$$:()=>[],selectedFinish,quoteModel,recordQuote:(_s,q)=>{recorded=q;},commit:async fn=>fn(S.state),refreshSheet:()=>rendered++,sheetScrolled(){},tcgCtx:{},meta(){},mtgGuideLoad(){},api(){}};
vm.createContext(harness);vm.runInContext(helper+'\n'+callbacks,harness);
S.ui.sheetCtx=ctxB;await harness.A.cardTab({dataset:{tab:'prices'}});assert.equal(recorded.value,22);assert.equal(recorded.releaseId,anniversary.id);assert.equal(rendered,1);
assert.equal(harness.contextTcgCard('ygo',ygo.id,{...ctxB,id:'other'}),ygo);
assert.equal(harness.contextTcgCard('ygo',ygo.id,{...ctxB,game:'ptcg'}),ygo);
const old=ctxB;let releaseCommit;harness.commit=()=>new Promise(resolve=>releaseCommit=resolve);const pending=harness.A.cardTab({dataset:{tab:'prices'}});S.ui.sheetCtx=ctxA;releaseCommit();await pending;assert.equal(rendered,1,'late price recording cannot rerender another release');

// Magic rows are exact verified printing slots, not names, imported guesses or quantity.
const m1={id:'magic-a',name:'Shared Name',set:'fxa',set_name:'Fixture A',collector_number:'1',rarity:'rare',finishes:['nonfoil'],prices:{usd:null}},m2={...m1,id:'magic-b',set:'fxb',set_name:'Fixture B',prices:{usd:'999'}};
S.state.settings.game='mtg';S.state.collection=[{id:'own-b',name:m1.name,printingVerified:true,printingId:m2.id,set:'fxb',collectorNumber:'1',qty:12},{id:'guess',name:m1.name,set:'fxa',collectorNumber:'1',qty:7}];
S.ui.set={code:'fxa',info:{code:'fxa',name:'Fixture A'},cards:[m1,m1],total:1,complete:true,q:'',filter:'all',rarity:'all',sort:'number',limit:120};
assert.match(setPage(),/0 of 1 unique cards/);
S.state.collection.push({id:'own-a',name:m1.name,printingVerified:true,printingId:m1.id,qty:5});
assert.match(setPage(),/1 of 1 unique cards/);assert.doesNotMatch(setPage(),/5 of 1/);
S.ui.sets={q:'',all:false,list:[{code:'fxa',name:'Fixture A',set_type:'expansion',released_at:'2026-01-01',card_count:1},{code:'fxb',name:'Fixture B',set_type:'expansion',released_at:'2025-01-01',card_count:1}]};
assert.equal((setsPage().match(/class="set-year-section"/g)||[]).length,2);
console.log('PASS: actual app tab projection resists stale/cross-game context; Magic shared year sections and completion count verified distinct printing slots.');

// AI accepts full canonical IDs, separates display codes and asks on ambiguous legacy IDs.
let loadedRelease='',sourceCalls=0;
const fakeT={...T,game:()=> 'ygo',SOURCES:{...T.SOURCES,ygo:{...T.SOURCES.ygo,setCards:async s=>{sourceCalls++;loadedRelease=s.id;return [ygo];}}},ensureCard:async()=>ygo};
const opened=[],routes=[],aiContext={S,T:fakeT,meta:()=>m2,priceOf:()=>999,inv:()=>({owned:12}),cacheCard:c=>c,loadSetIndex:async()=>{},tcgCtx:{},api:async()=>({data:[m1]}),esc:String,go:route=>routes.push(route),A:{setGame:async()=>{},tCard:value=>opened.push(value),card:value=>opened.push(value)}};
const ai=makeAskTools(aiContext);
const listed=await ai.list_sets({game:'ygo',order:'newest'});assert.equal(listed.sets[0].code,'LOB');assert.equal(listed.sets[0].id,anniversary.id);
let result=await ai.set_cards({game:'ygo',set:'LOB'});assert.equal(result.requiresChoice,true);assert.equal(result.candidates.length,2);assert.equal(sourceCalls,0);
result=await ai.set_cards({game:'ygo',set:anniversary.id});assert.equal(loadedRelease,anniversary.id);assert.equal(result.cards[0].price,22);assert.equal(result.set.code,'LOB');
result=await ai.set_cards({game:'ygo',set:'Legend of Blue Eyes'});assert.equal(result.requiresChoice,true);assert.equal(sourceCalls,1);
for(const invalid of ['', 'x'.repeat(4097),'LOB\nother',{},null])assert((await ai.set_cards({game:'ygo',set:invalid})).error);
result=await ai.set_cards({game:'mtg',set:'fxa'});assert.equal(result.cards[0].price,null,'Magic set AI cannot take the cached same-name printing price');assert.equal(result.cards[0].owned,5);
console.log('PASS: AI keeps complete case-sensitive release IDs, displays real codes, rejects malformed inputs, requires explicit ambiguous-release choice and returns exact-set price/ownership.');

// Exact-release mismatch is rejected even if a caller has not reprojected its card yet.
assert.equal(sellerModels('ygo',a,{setId:anniversary.id})[0].direct,false);
assert.doesNotMatch(compactPriceSummary('ygo',a,{setId:anniversary.id}),/\$11\.00/);
// Run the actual Magic pagination loader; stale completions cannot touch newer objects/retries.
const loader=app.slice(app.indexOf('const setCache = new Map();'),app.indexOf('\n/* =========================================================',app.indexOf('const setCache = new Map();')));
const fresh=code=>({code,cards:[],info:null,total:0,loaded:false,busy:false,error:''});
const jobs=[],store={ui:{view:'set',set:fresh('fxa')}},loadHarness={S:store,T:{game:()=> 'mtg'},api:path=>new Promise((resolve,reject)=>jobs.push({path,resolve,reject})),render(){},slim:c=>c,ensureTcgPrices(){},URLSearchParams,URL};
vm.createContext(loadHarness);vm.runInContext(loader,loadHarness);
const tick=()=>new Promise(r=>setTimeout(r,0));
const loadingA=loadHarness.loadSet('fxa');const oldSet=store.ui.set;store.ui.set=fresh('fxb');const loadingB=loadHarness.loadSet('fxb');
jobs[1].resolve({code:'fxb',name:'Fixture B'});await tick();jobs[2].resolve({data:[m2,m2],total_cards:1,has_more:false});await loadingB;
assert.equal(store.ui.set.cards.length,1);assert.equal(store.ui.set.cards[0].id,m2.id);assert.equal(store.ui.set.complete,true);
jobs[0].resolve({code:'fxa',name:'Fixture A'});await loadingA;assert.equal(store.ui.set.info.code,'fxb');assert.equal(oldSet.cards.length,0);
store.ui.set=fresh('fxa');const retryOld=loadHarness.loadSet('fxa');const retryNew=loadHarness.loadSet('fxa');
jobs[4].resolve({code:'fxa'});await tick();jobs[5].resolve({data:[m1],total_cards:2,has_more:true,next_page:'https://api.scryfall.com/cards/search?page=2'});await tick();jobs[6].reject(Error('page two failed'));await retryNew;
assert.equal(store.ui.set.complete,false);assert.match(store.ui.set.error,/Some cards/);assert.equal(vm.runInContext("setCache.has('fxa')",loadHarness),false);
jobs[3].resolve({code:'fxa',name:'Obsolete retry'});await retryOld;assert.notEqual(store.ui.set.info.name,'Obsolete retry');
const repaired=loadHarness.loadSet('fxa');jobs[7].resolve({code:'fxa',name:'Repaired'});await tick();jobs[8].resolve({data:[m1,m1,{...m1,id:'magic-a-2',collector_number:'2'},m2],total_cards:2,has_more:false});await repaired;
assert.equal(store.ui.set.cards.length,2);assert.equal(store.ui.set.complete,true);assert.equal(store.ui.set.error,'');
console.log('PASS: actual Magic set loader rejects cross-route/same-route stale results, deduplicates printing IDs, excludes cross-set rows and retries partial loads without caching false completeness.');

// AI result cards carry a short stable local ref, not a generic name/ID relookup.
result=await ai.set_cards({game:'ygo',set:anniversary.id});
const exactRef=result.cards[0].ref,item={kind:'card',game:'ygo',ref:exactRef,label:ygo.name};
assert.match(ai.preview(item),/\$22\.00/);assert.doesNotMatch(ai.preview(item),/\$999/);
await ai.open(item);assert.equal(opened.at(-1).dataset.setId,anniversary.id);assert.equal(opened.at(-1).dataset.id,ygo.id);
assert.equal(ai.canonicalItem({kind:'card',game:'ygo',ref:ygo.id}).ref,exactRef);
await ai.set_cards({game:'ygo',set:original.id});
assert.doesNotMatch(ai.preview({kind:'card',game:'ygo',ref:ygo.id}),/\$999|\$11|\$22/,'ambiguous result ID cannot become a generic quote');
await ai.open({kind:'card',game:'ygo',ref:ygo.id});assert.equal(routes.at(-1),'#sets');
ai.reset();await ai.open(item);assert.equal(opened.at(-1).dataset.setId,anniversary.id,'older exact answer ref still opens exact release after reset');
result=await ai.set_cards({game:'mtg',set:'fxa'});await ai.open({kind:'card',game:'mtg',ref:result.cards[0].ref});assert.equal(opened.at(-1).printing.id,m1.id);
const longRelease=normalizeYgoSets([{code:'LongCase',name:'Precise release name '.repeat(100),date:'2026-10-17'}])[0];assert(longRelease.id.length>2000&&longRelease.id.length<4096);
T.ui('ygo').sets.list=[...releases,longRelease];
const listing=await ai.list_sets({game:'ygo',limit:30});assert.equal(listing.sets.find(s=>s.id===longRelease.id).code,'LongCase');
const answer=readTurn({output:[{type:'function_call',name:'answer',arguments:JSON.stringify({text:'Exact release',source:'app',show:[{kind:'set',game:'ygo',ref:longRelease.id,label:longRelease.name}],suggestions:[]})}]}).answer;
assert.equal(answer.show[0].ref,longRelease.id);await ai.open(answer.show[0]);assert.equal(decodeURIComponent(routes.at(-1).slice(5)),longRelease.id);
const call={type:'function_call',name:'set_cards',call_id:'exact-long',arguments:JSON.stringify({game:'ygo',set:longRelease.id,limit:1})};
assert.equal(readTurn({output:[call]}).calls[0].arguments,call.arguments);
assert.equal(cleanTurn({game:'ygo',items:[{type:'message',role:'user',content:'Show that release'},call]}).items[1].arguments,call.arguments);
await ai.set_cards(JSON.parse(call.arguments));assert.equal(loadedRelease,longRelease.id);
assert.throws(()=>readTurn({output:[{...call,arguments:JSON.stringify({game:'ygo',set:'x'.repeat(4097)})}]}));
assert.throws(()=>cleanTurn({items:[{type:'message',role:'user',content:'Hello'},{...call,arguments:'{"set":"truncated'}]}));
assert.equal(readTurn({output:[{type:'function_call',name:'answer',arguments:JSON.stringify({show:[{kind:'set',game:'ygo',ref:'x'.repeat(4097)}]})}]}).answer.show.length,0);
console.log('PASS: AI exact-card previews/open retain release snapshots, ambiguous generic refs never guess, and full 2000+ character canonical IDs survive list → server answer → open → set_cards without JSON truncation.');

// The real route parser decodes individual segments, keeping slash-bearing names whole.
const routeCode=app.slice(app.indexOf('const LEGACY ='),app.indexOf('\nfunction go(hash)'));
const routeState={ui:{view:'home',set:fresh(''),q:{},shared:{}},state:{settings:{game:'ygo'}}};
const routeHarness={S:routeState,T:{isTcg:()=>true,ui:()=>({coll:{}})},location:{hash:'#set/'+encodeURIComponent(longRelease.id)},deckById(){},openShared(){},save(){}};
vm.createContext(routeHarness);vm.runInContext(routeCode,routeHarness);routeHarness.parseHash();assert.equal(routeState.ui.tsetId,longRelease.id);
routeHarness.location.hash='#set/'+encodeURIComponent('Release A/B');routeHarness.parseHash();assert.equal(routeState.ui.tsetId,'Release A/B');
routeHarness.location.hash='#set/%E0%A4%A';assert.doesNotThrow(()=>routeHarness.parseHash());assert.equal(routeState.ui.view,'sets');
console.log('PASS: malformed set routes fail safely and encoded slash names/canonical IDs remain intact.');

// Long-press follows exactly the same release and only offers its saved lots.
const actionCode=app.slice(app.indexOf('async function resolveActionCard('),app.indexOf('\nfunction startCardCompare'));
S.ui.sheetCtx=null;S.state.settings.game='ygo';T.ui('ygo').sets.list=releases;
const actionHarness={S,T:{...T,ensureCard:async()=>ygo},location:{hash:'#set/'+encodeURIComponent(anniversary.id)},key:s=>String(s).toLowerCase(),meta:()=>m2,ownedCardLots:()=>{throw Error('Set quick actions must not use name-wide lots');}};
vm.createContext(actionHarness);vm.runInContext(actionCode,actionHarness);
const held=await actionHarness.resolveActionCard({dataset:{id:ygo.id,setId:anniversary.id}});
assert.equal(held.card.setContext.releaseId,anniversary.id);
const annLot={...damaged,id:'lot-ann',qty:4,setReleaseId:anniversary.id,printing:'LOB-EN001'},wrongLot={...damaged,qty:8};
assert.deepEqual(actionHarness.quickCardLots(held,[wrongLot,annLot]).map(e=>e.id),['lot-ann']);
let ownInput;const quickOwn=app.slice(app.indexOf('  A.quickOwn = () => {'),app.indexOf('  A.quickWish = async'));
const ownHarness={A:{tOwn:value=>ownInput=value},quickCard:held,T:{game:()=> 'ygo'},addSheet(){}};
vm.runInNewContext(quickOwn,ownHarness);ownHarness.A.quickOwn();assert.equal(ownInput.dataset.setId,anniversary.id);

// Enriching a selected Magic printing must not replace another name-wide cache entry.
S.state.settings.game='mtg';
const extras=app.slice(app.indexOf('async function loadCardExtras('),app.indexOf('\nA.viewPrint'));
const exactMagic={type:'card',name:m1.name,print:{...m1,full:false},setId:'fxa'};
S.ui.sheetCtx=exactMagic;let cacheWrites=0;
const extraHarness={S,meta:()=>m2,$:q=>q==='#sheet'?{open:true}:{innerHTML:''},api:async path=>path.startsWith('/cards/search')?{data:[],has_more:false}:{...m1,oracle_id:'same-oracle'},cacheCard:c=>{cacheWrites++;return c;},slim:c=>c,saveCatalogSoon(){},V:{cardSheet:()=>''},ensureTcgPrices(){},refreshSheet(){},URLSearchParams,URL};
vm.createContext(extraHarness);vm.runInContext(extras,extraHarness);await extraHarness.loadCardExtras(exactMagic);
assert.equal(cacheWrites,0);assert.equal(exactMagic.print.id,m1.id);assert.equal(exactMagic.print.full,true);
const foilCard={...m1,finishes:['nonfoil','foil'],prices:{usd:'1',usd_foil:'100'}};
S.ui.set={code:'fxa',cards:[foilCard],info:{code:'fxa',name:'Fixture A'},total:1,complete:true,q:'',filter:'all',rarity:'all',finish:'foil',sort:'price',limit:120};
assert.match(setPage(),/\$100\.00/);assert.match(setPage(),/data-set-finish="foil"/);
const cardAction=app.slice(app.indexOf('A.card = async'),app.indexOf('// Full card (flavor text'));
let addPreset;const cardHarness={A:{},S,T:{game:()=> 'mtg'},key:s=>String(s).toLowerCase(),$:()=>({open:true}),currentDeck:()=>null,meta:()=>m2,selectedFinish,openSheet:(_html,ctx)=>{S.ui.sheetCtx=ctx;},V:{cardSheet:()=>''},loadCardExtras(){},esc:String,toast(){},deckById(){},addSheet:(_e,p)=>addPreset=p};
vm.createContext(cardHarness);vm.runInContext(cardAction+'\n'+app.slice(app.indexOf('A.own = async'),app.indexOf('A.addLookup = async')),cardHarness);
await cardHarness.A.card({dataset:{name:m1.name,setI:'0',setFinish:'foil'}});assert.equal(S.ui.sheetCtx.print.id,m1.id);assert.equal(S.ui.sheetCtx.priceFinish,'foil');
await cardHarness.A.own({dataset:{name:m1.name}});assert.equal(addPreset.card.id,m1.id);assert.equal(addPreset.set,'FXA');assert.equal(addPreset.number,'1');assert.equal(addPreset.finish,'foil');
console.log('PASS: exact set long-press/add/quantity isolation, Magic foil tile/detail/add continuity, and exact-detail hydration without global name-cache mutation.');

// A market finish change reprojects from the immutable card reference before recording.
const pkHolo=T.setContextCard('ptcg',pk,releaseA,[releaseA],{variantKey:'holofoil'});
assert.equal(pkHolo.setContext.referencePrice,2);
assert.equal(presentationQuote('ptcg',pkHolo,'reference').value,2);
S.ui.sheetCtx={type:'market',game:'ptcg',card:pkHolo,setId:releaseA.id,setVariant:'holofoil',finish:'holofoil'};
const marketActions={},marketChanges={};
registerWorkbench({A:marketActions,C:marketChanges,getGame:()=> 'ptcg',getCard:(g,e,ctx)=>T.setContextCard(g,pk,ctx.setId,[releaseA],{variantKey:ctx.setVariant}),commit:async fn=>fn(S.state),render(){},openSheet(_html,ctx){S.ui.sheetCtx=ctx;},closeSheet(){},refreshSheet(){},toast(){},links:()=>[]});
await marketChanges.marketFinish({value:'reference'});
assert.equal(S.ui.sheetCtx.card.setContext.referencePrice,2);assert.equal(S.ui.sheetCtx.card.prices.usd,2);
assert.equal(presentationQuote('ptcg',S.ui.sheetCtx.card,'reference').value,2);
const noReference=T.setContextCard('ptcg',{...pk,prices:{usd:null}},releaseA,[releaseA],{variantKey:'holofoil'});
assert.equal(presentationQuote('ptcg',noReference,'reference').value,null,'unknown reference never becomes projected holo price');
const magicHeld={game:'mtg',card:foilCard,setId:'fxa',setVariant:'foil'};
const magicLots=[{id:'nonfoil',printingVerified:true,printingId:m1.id,finish:'nonfoil',qty:8},{id:'foil',printingVerified:true,printingId:m1.id,finish:'foil',qty:1}];
assert.deepEqual(actionHarness.quickCardLots(magicHeld,magicLots).map(e=>e.id),['foil']);
const gallery={id:'pk-gallery',name:'Trainer Gallery'},galleryMembership={game:'ptcg',cardId:pk.id,releaseId:gallery.id,status:'resolved',membership:'set-response'};
T.ui('ptcg').sets.list=[releaseA,gallery];T.ui('ptcg').set={info:gallery,cards:[{...pk,setContext:galleryMembership}]};
S.state.settings.game='ptcg';S.ui.sheetCtx=null;actionHarness.T.ensureCard=async()=>pk;actionHarness.location.hash='#set/pk-gallery';
const galleryHeld=await actionHarness.resolveActionCard({dataset:{id:pk.id,setId:gallery.id,setVariant:'holofoil'}});
assert.equal(galleryHeld.card.setContext.status,'resolved');assert.equal(galleryHeld.card.setContext.price,9);assert.equal(galleryHeld.setMembership.releaseId,gallery.id);
console.log('PASS: Pokémon market holo→reference retains base reference/null; Magic quick mutations respect finish; fresh gallery-alias holds retain provider membership.');

// Scoped add preview fails closed for reused printing enrichment; private condition values survive.
const conditionCode=app.slice(app.indexOf('function refreshConditionPrice(){'),app.indexOf('\ndocument.addEventListener("change",e=>'));
const conditionNodes={'#conditionPricePreview':{innerHTML:'',isConnected:true},'#lotManualValue':{value:''},'#tPrint':{value:'LOB-EN001|Ultra Rare'},'#tCond':{value:'Near Mint'},'#tEdition':{value:''}};
const ambiguousCard={...ygo,sets:[{...ygo.sets[0],code:'LOB-EN001'},ygo.sets[1]]};
const ambiguousProjection=T.setContextCard('ygo',ambiguousCard,anniversary,releases);assert.equal(ambiguousProjection.setContext.printing.releasePriceAmbiguous,true);
let conditionRequests=0;
const conditionHarness={CONDITION_IDENTITY,S:{ui:{sheetCtx:{type:'tadd',game:'ygo',id:ygo.id,setId:anniversary.id}}},T:{game:()=> 'ygo',cardOf:()=>ambiguousCard,entryPrice:()=>500},$:s=>conditionNodes[s],contextTcgCard:()=>ambiguousProjection,conditionName:c=>c,conditionValue:(_price,entry)=>({price:entry.manualValue}),conditionPriceHtml:price=>String(price),fetchConditionValue:()=>conditionRequests++};
vm.createContext(conditionHarness);vm.runInContext(conditionCode,conditionHarness);conditionHarness.refreshConditionPrice();assert.equal(conditionNodes['#conditionPricePreview'].innerHTML,'null');assert.equal(conditionRequests,0);
conditionNodes['#lotManualValue'].value='4';conditionHarness.refreshConditionPrice();assert.equal(conditionNodes['#conditionPricePreview'].innerHTML,'4');assert.equal(conditionRequests,0);
const editionHeld={...held,priceEdition:'LOB-EN001::Ultra Rare',priceYgoEdition:'unlimited'};
assert.deepEqual(actionHarness.quickCardLots(editionHeld,[{...annLot,id:'first',edition:'1st-edition'},{...annLot,id:'unlimited',edition:'unlimited'}]).map(e=>e.id),['unlimited']);
console.log('PASS: ambiguous scoped condition previews never invoke the old code-only feed, manual condition values still work, and selected-edition quick mutation cannot touch another edition.');
// A follow-up collection answer must respect the new saved-lot uncertainty marker.
S.state.settings.game='ygo';S.state.tcg.ygo.collection=[{id:'unknown-set-copy',cardId:ygo.id,name:ygo.name,qty:1,condition:'Near Mint',setReleaseUnverified:true}];
const collectionAnswer=await ai.my_collection({game:'ygo'});
assert.equal(collectionAnswer.cards[0].each,null);assert.equal(collectionAnswer.cards[0].value,0);assert.equal(collectionAnswer.cards[0].set,'Printing not verified');
console.log('PASS: AI collection follow-ups cannot replace an unverified scoped lot with the generic card price.');

// Reopening a newly scoped saved lot cannot recover a generic market/private/history value.
const reopenedActions={},reopenedChanges={};let reopenedHtml='';
registerWorkbench({A:reopenedActions,C:reopenedChanges,getGame:()=>S.state.settings.game,getCard:(g,e,ctx)=>harness.contextTcgCard(g,e.cardId,ctx),commit:async fn=>fn(S.state),render(){},openSheet(html,ctx){reopenedHtml=html;S.ui.sheetCtx=ctx;},closeSheet(){},refreshSheet(){},toast(){},links:()=>[]});
S.ui.sheetCtx=null;S.state.settings.marketHistory={};useMyPrices({[myPriceKey(ygo)]:{price:987}});
await reopenedActions.marketOpen({dataset:{game:'ygo',id:ygo.id,entry:'unknown-set-copy',finish:'reference'}});
assert.equal(S.ui.sheetCtx.setReleaseUnverified,true);assert.equal(S.ui.sheetCtx.setId,'');
assert.equal(presentationQuote('ygo',S.ui.sheetCtx.card).value,null);assert.equal(myPrice(S.ui.sheetCtx.card),null);
assert.doesNotMatch(reopenedHtml,/\$999|\$987/);assert.equal(Object.keys(S.state.settings.marketHistory).length,0);
const unknownCtx=S.ui.sheetCtx;
assert.notEqual(sheetKey({type:'tcard',game:'ygo',id:ygo.id}),sheetKey({...unknownCtx,type:'tcard',id:ygo.id}));
assert.equal(harness.contextTcgCard('ygo',ygo.id,unknownCtx).setContext.unverifiedRelease,true);
S.state.tcg.ygo.collection=[damaged];S.ui.sheetCtx=null;T.ui('ygo').sets.list=releases;
await reopenedActions.marketOpen({dataset:{game:'ygo',id:ygo.id,entry:damaged.id,finish:'reference'}});
assert.equal(S.ui.sheetCtx.setId,original.id);assert.equal(presentationQuote('ygo',S.ui.sheetCtx.card).value,11);
assert.match(myPriceKey(S.ui.sheetCtx.card,'nonfoil',S.ui.sheetCtx),/^exact:/);
assert(Object.values(S.state.settings.marketHistory).every(q=>q.releaseId===original.id));
T.ui('ygo').sets.list=[];S.ui.sheetCtx=null;S.state.settings.marketHistory={};
await reopenedActions.marketOpen({dataset:{game:'ygo',id:ygo.id,entry:damaged.id,finish:'reference'}});
assert.equal(S.ui.sheetCtx.setId,original.id);assert.equal(presentationQuote('ygo',S.ui.sheetCtx.card).value,null);assert.doesNotMatch(reopenedHtml,/\$999|\$987/);
assert.equal(Object.keys(S.state.settings.marketHistory).length,0);T.ui('ygo').sets.list=releases;
const savedMarket=S.ui.sheetCtx;await reopenedActions.marketOpen({dataset:{game:'ptcg',id:ygo.id,entry:damaged.id}});assert.equal(S.ui.sheetCtx,savedMarket);
assert.equal(myPriceKey(ygo,'nonfoil',{setId:original.id}),null,'unprojected scoped card cannot use a wildcard private key');
console.log('PASS: saved exact and Not sure lots reopen without generic prices/private keys/history, reload-without-catalogue stays safely unknown, and forged cross-game entry opens are rejected.');

// Persisted release evidence is shared with tcg details, never a duplicate or older v1 source.
const originalStorage=globalThis.localStorage;
globalThis.localStorage={getItem:key=>key===YGO_SET_CACHE_KEY?JSON.stringify({schema:3,at:Date.now(),list:releases}):null};
T.ui('ygo').sets.list=[];S.ui.sheetCtx=null;
await reopenedActions.marketOpen({dataset:{game:'ygo',id:ygo.id,entry:damaged.id,finish:'reference'}});
assert.equal(S.ui.sheetCtx.setId,original.id);assert.equal(presentationQuote('ygo',S.ui.sheetCtx.card).value,11);
assert.equal(harness.contextTcgCard('ygo',ygo.id,S.ui.sheetCtx).setContext.price,11);
globalThis.localStorage=originalStorage;T.ui('ygo').sets.list=releases;
console.log('PASS: exact saved release market/detail refresh uses shared persisted-v3 catalogue evidence before Sets opens.');
