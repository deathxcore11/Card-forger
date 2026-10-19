// Public synthetic fixtures only. No live provider, browser, credentials or inventory.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {normalizeYgoSets} from './ygo.js';
import {tcgCardSheet,setContextCard,ui,cache,registerTcg,SOURCES} from './tcg.js';
import * as T from './tcg.js';
import {registerWorkbench,ygoPreviewSelectors} from './workbench-ui.js';
import {ygoPricePreview,supportedYgoEditions} from './ygo-price-selection.js';
import {presentationQuote,compactPriceSummary,sellerModels,matchingLot} from './pricing-presentation.js';
import {conditionValue} from './condition-value.js';
import {myPriceKey,useMyPrices} from './mtg-tcgprice.js';
import {ygoSetPriceRoute} from './ygo-set-prices.js';
const [release]=normalizeYgoSets([{set_name:'Synthetic preview release',set_code:'FXP',tcg_date:'2026-01-01'}]);
const printing={name:release.name,code:'FXP-EN001',rarity:'Super Rare',price:null,productId:900101,priceSource:'TCGplayer via TCGCSV',checkedAt:new Date().toISOString(),quotes:[{edition:'1st Edition',market:2},{edition:'Unlimited',market:1}]};
const card={game:'ygo',id:'99099101',name:'Synthetic edition preview',category:'Monster',stats:[],typeLine:'Effect Monster',sets:[printing],prices:{usd:999},fetchedAt:new Date().toISOString(),artSchema:1,printPriceSchema:1};
const scoped=setContextCard('ygo',card,release,[release]),key=printing.code+'::'+printing.rarity,ctx={type:'tcard',game:'ygo',id:card.id,setId:release.id};
const before=JSON.stringify(card),initial=ygoPricePreview(scoped,ctx);
assert.deepEqual(initial,{priceEdition:key,priceYgoEdition:'1st-edition',ygoPriceDefault:'1st-edition'});
assert.equal(JSON.stringify(card),before);assert.equal(ctx.priceEdition,undefined);
assert.deepEqual(ygoPricePreview(scoped,{...ctx,priceEdition:key,priceYgoEdition:'unlimited'}),{});
assert.deepEqual(ygoPricePreview(scoped,{...ctx,priceEdition:key,priceYgoEdition:'',ygoEditionExplicit:true}),{});
for(const patch of [{entryId:'saved'},{entry:'saved'},{setReleaseUnverified:true},{setId:'wrong'},{id:'wrong'},{game:'ptcg'}])assert.deepEqual(ygoPricePreview(scoped,{...ctx,...patch}),{});
assert.deepEqual(ygoPricePreview({...scoped,setContext:{...scoped.setContext,status:'ambiguous'}},ctx),{});
assert.deepEqual(ygoPricePreview({...card,game:'ptcg'},ctx),{});
assert.deepEqual(supportedYgoEditions({...printing,quotes:[{edition:'Unlimited',market:1}]}),['unlimited']);
const withQuotes=quotes=>setContextCard('ygo',{...card,sets:[{...printing,quotes}]},release,[release]);
assert.equal(ygoPricePreview(withQuotes([{edition:'Unlimited',market:1}]),ctx).priceYgoEdition,'unlimited');
assert.equal(ygoPricePreview(withQuotes([{edition:'Limited',market:1}]),ctx).priceYgoEdition,'limited');
assert.deepEqual(ygoPricePreview(withQuotes([{edition:'Unlimited',market:1}]),{...ctx,...initial}),{priceYgoEdition:'unlimited',ygoPriceDefault:'unlimited'},'Fresh evidence may replace an untouched preview default');
assert.deepEqual(ygoPricePreview(withQuotes([]),{...ctx,...initial}),{priceYgoEdition:'',ygoPriceDefault:''},'A vanished quote must not keep claiming an available default');
assert.deepEqual(ygoPricePreview(withQuotes([]),{...ctx,...initial,ygoEditionExplicit:true}),{},'Explicit edition is preserved when its quote disappears');
assert.equal(ygoPricePreview(withQuotes([{edition:'Unlimited',market:1},{edition:'Limited',market:2}]),ctx).priceYgoEdition,undefined,'No global preference between other supported editions');
for(const quotes of [[],[{edition:'1st Edition',market:null}],[{edition:'1st Edition',market:0}],[{edition:'1st Edition',market:2},{edition:'1st Edition',market:3}]])assert.equal(ygoPricePreview(withQuotes(quotes),ctx).priceYgoEdition,undefined);
const second={...printing,rarity:'Ultra Rare',productId:900102,quotes:[{edition:'1st Edition',market:20}]},multiple={...card,sets:[printing,second]},projected=setContextCard('ygo',multiple,release,[release]);
assert.deepEqual(ygoPricePreview(projected,ctx),{},'Never choose the cheapest or first rarity');
let summary=compactPriceSummary('ygo',projected,ctx);assert.match(summary,/\$1\.00–\$20\.00/);assert.match(summary,/release reference, not your copy/);assert.doesNotMatch(summary,/\$999|Near Mint/);
assert.equal(presentationQuote('ygo',projected).value,null,'Range does not become exact or condition price');
assert.doesNotMatch(compactPriceSummary('ygo',projected,{...ctx,priceEdition:'WRONG::Rare'}),/\$1\.00|\$20\.00/);
assert.doesNotMatch(compactPriceSummary('ygo',projected,{...ctx,setId:'wrong'}),/\$1\.00|\$20\.00/);
S.state=blank();S.state.settings.game='ygo';S.state.tcg={ygo:blankGame(),ptcg:blankGame()};ui('ygo').sets.list=[release];cache.ygo[card.id]=multiple;
const lot={id:'saved',cardId:card.id,setReleaseId:release.id,printing:printing.code,rarity:printing.rarity,edition:'unlimited',condition:'Heavily Played',language:'de',manualValue:7,manualValueCondition:'Heavily Played',qty:1};S.state.tcg.ygo.collection=[lot];
const stateBefore=JSON.stringify(S.state.tcg.ygo),lotCtx={...ctx,entryId:lot.id,priceEdition:key,priceYgoEdition:'unlimited'};
let html=tcgCardSheet(multiple,lotCtx);assert.match(html,/Preview edition/);assert.match(html,/value="unlimited" selected/);assert.doesNotMatch(html,/selected for this preview/);
assert.equal(matchingLot('ygo',projected,lotCtx,S.state),lot);assert.equal(conditionValue(null,lot,[]).price,7);
assert.equal(conditionValue(20,{...lot,manualValue:null},[]).price,null,'No reference becomes an HP quote');
assert.equal(JSON.stringify(S.state.tcg.ygo),stateBefore);
const A={},C={},I={};let lastHTML='',renders=0;
globalThis.document={body:{dataset:{}},querySelector:selector=>selector==='#sheet'?{open:true}:selector==='#sheetBody'?{scrollTop:0}:null};
const draw=()=>{renders++;lastHTML=tcgCardSheet(cache.ygo[card.id],S.ui.sheetCtx);};
registerWorkbench({A,C,getGame:()=> 'ygo',getCard:()=>projected,refreshSheet:draw,openSheet:(html,context)=>{lastHTML=html;S.ui.sheetCtx=context;},links:()=>[]});
S.ui.sheetCtx={...ctx};draw();
C.ygoPreviewPrinting({value:key,dataset:{change:'ygoPreviewPrinting'}});
assert.equal(S.ui.sheetCtx.priceYgoEdition,'1st-edition');assert.match(lastHTML,/1st Edition selected for this preview/);assert.match(lastHTML,/\$2\.00/);
C.ygoPreviewEdition({value:'unlimited'});assert.equal(S.ui.sheetCtx.ygoPriceDefault,undefined);assert.match(lastHTML,/\$1\.00/);assert.doesNotMatch(lastHTML.match(/class="card-price-summary"[\s\S]*?<\/button>/)?.[0]||'',/\$2\.00/);
C.ygoPreviewEdition({value:'limited'});assert.match(lastHTML,/No quote yet/);assert.doesNotMatch(compactPriceSummary('ygo',projected,S.ui.sheetCtx),/\$1\.00|\$2\.00|\$20\.00/);
C.ygoPreviewEdition({value:''});draw();assert.equal(S.ui.sheetCtx.priceYgoEdition,'','Explicit unknown stays unknown after render');
C.ygoPreviewPrinting({value:second.code+'::'+second.rarity,dataset:{change:'ygoPreviewPrinting'}});assert.equal(S.ui.sheetCtx.priceYgoEdition,'1st-edition');assert.match(lastHTML,/\$20\.00/);
assert.equal(sellerModels('ygo',projected,S.ui.sheetCtx)[0].url,'https://www.tcgplayer.com/product/900102?Language=English&Printing=1st+Edition');
assert.equal(JSON.stringify(S.state.tcg.ygo),stateBefore);
for(const other of [{type:'card',id:'magic'},{type:'tcard',game:'ptcg',id:'pokemon'},{type:'market',game:'ygo',id:card.id}]){
 const active=S.ui.sheetCtx;S.ui.sheetCtx=other;C.ygoPreviewPrinting({value:key});C.ygoPreviewEdition({value:'unlimited'});assert.equal(other.priceEdition,undefined);assert.equal(other.priceYgoEdition,undefined);S.ui.sheetCtx=active;
}
// Private prices stay bound to their exact printing/edition and never enter sellers.
useMyPrices({[myPriceKey(projected,'nonfoil',{...ctx,priceEdition:key,priceYgoEdition:'limited'})]:{price:13}});
summary=compactPriceSummary('ygo',projected,{...ctx,priceEdition:key,priceYgoEdition:'limited'});assert.match(summary,/\$13\.00/);assert.match(summary,/Your private value/);
assert.equal(sellerModels('ygo',projected,{...ctx,priceEdition:key,priceYgoEdition:'limited'})[0].value,null);useMyPrices({});
assert.match(ygoPreviewSelectors({...scoped,setContext:{...scoped.setContext,printings:[{...printing,checkedAt:'2020-01-01'}]}},{...ctx,...initial}),/stale/i);
// Real card opener: newer selected edition wins over a delayed card refresh.
let resolveCard;const get=SOURCES.ygo.get;
const handlers={A:{},C:{},I:{},render(){},commit:async fn=>fn(S.state),openSheet:(html,context)=>{lastHTML=html;S.ui.sheetCtx=context;},closeSheet(){S.ui.sheetCtx=null;},toast(){},go(){},writeRecord:async()=>{}};
registerTcg(handlers);cache.ygo[card.id]={...multiple,fetchedAt:'2020-01-01'};SOURCES.ygo.get=()=>new Promise(resolve=>{resolveCard=resolve;});
try{
 const pending=handlers.A.tCard({dataset:{id:card.id,setId:release.id,printing:key,edition:'1st-edition'}});
 const active=S.ui.sheetCtx;C.ygoPreviewEdition({value:'unlimited'});resolveCard({...multiple,fetchedAt:new Date().toISOString()});await pending;
 assert.equal(S.ui.sheetCtx,active);assert.equal(active.priceYgoEdition,'unlimited');assert.match(compactPriceSummary('ygo',projected,active),/\$1\.00/);
 cache.ygo[card.id]={...multiple,fetchedAt:'2020-01-01'};const closed=handlers.A.tCard({dataset:{id:card.id,setId:release.id}});S.ui.sheetCtx=null;const closedHTML=lastHTML;resolveCard(multiple);await closed;assert.equal(S.ui.sheetCtx,null);assert.equal(lastHTML,closedHTML,'Late refresh never reopens a dismissed sheet');
}finally{SOURCES.ygo.get=get;}
// Display-only defaults cannot silently become evidence about a saved copy.
S.ui.sheetCtx={...ctx,...initial};handlers.A.tOwn({dataset:{id:card.id}});
assert.match(lastHTML,/<select id="tEdition"><option value="" selected>Not sure/);assert.doesNotMatch(lastHTML,/value="1st-edition" selected/);
S.ui.sheetCtx={...ctx,priceEdition:key,priceYgoEdition:'1st-edition',ygoEditionExplicit:true};handlers.A.tOwn({dataset:{id:card.id}});assert.match(lastHTML,/value="1st-edition" selected/);
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8'),actionCode=app.slice(app.indexOf('async function resolveActionCard('),app.indexOf('\nfunction startCardCompare'));
const actionHarness={navigationStamp:()=>({}),navigationCurrent:()=>true,S,T:{...T,ensureCard:async()=>multiple},location:{hash:'#set/'+encodeURIComponent(release.id)},key:s=>String(s).toLowerCase()};
vm.createContext(actionHarness);vm.runInContext(actionCode,actionHarness);S.ui.sheetCtx={...ctx,...initial};
const held=await actionHarness.resolveActionCard({dataset:{id:card.id,setId:release.id}});assert.equal(held.ygoPriceDefault,'1st-edition');
const heldLots=[{...lot,id:'first',edition:'1st-edition'},{...lot,id:'unlimited',edition:'unlimited'}];
assert.deepEqual(actionHarness.quickCardLots(held,heldLots).map(e=>e.id),['first','unlimited'],'Preview assumption does not select an owned edition');
assert.deepEqual(actionHarness.quickCardLots({...held,ygoPriceDefault:''},heldLots).map(e=>e.id),['first'],'Explicit edition keeps exact lot filtering');
let quickInput;const ownHarness={A:{tOwn:input=>quickInput=input},quickCard:held,T:{game:()=> 'ygo'},addSheet(){}};
vm.runInNewContext(app.slice(app.indexOf('  A.quickOwn = () => {'),app.indexOf('  A.quickWish = async')),ownHarness);ownHarness.A.quickOwn();assert.equal(quickInput.dataset.edition,'');
ownHarness.quickCard={...held,ygoPriceDefault:''};ownHarness.A.quickOwn();assert.equal(quickInput.dataset.edition,'1st-edition');
assert.doesNotMatch(ygoPreviewSelectors(scoped,{...ctx,...initial}).match(/<select data-change="ygoPreviewPrinting"[^>]*>(.*?)<\/select>/)?.[1]||'',/Choose a printing/,'A sole verified printing has no nonfunctional clear option');
// Actual provider route rejects every non-2xx without following redirects.
for(const status of [301,302,403,429,500]){
 let calls=0;const response=await ygoSetPriceRoute(new URL('https://fixture.invalid/api/prices/yugioh-set?name=Fixture'+status+'&code=FX'+status),{},async(_url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response('',{status,headers:{Location:'https://never-follow.invalid/'}});});
 assert.equal(calls,1);assert.equal(response.status,503);const body=await response.json();assert.equal(body.status,'unavailable');assert.match(body.notice,new RegExp(String(status)));assert.deepEqual(body.products,[]);
}
console.log('PASS: supported-only edition preview, explicit/saved/unknown preservation, no rarity guess, exact URL/quote switching, labeled release range, private and condition isolation, delayed refresh/cancel safety, and non-2xx refusal handling.');
