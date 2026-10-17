// UI + cache/loader integration with synthetic providers only. No DOM/browser/server.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {presentationQuote,priceSelectionState} from './pricing-presentation.js';
import {historyPanel,priceOverview,registerWorkbench} from './workbench-ui.js';
import {sharedHistory,historyKey,loadSharedHistory,canRequestExactYgoHistory} from './shared-history.js';
import {exactYgoHistoryIdentity} from './ygo-history-identity.js';
import {setContextCard} from './tcg.js';
import {normalizeYgoSets} from './ygo.js';
import {SUPABASE} from './config.js';
const releases=normalizeYgoSets([{set_name:'Exact fixture',set_code:'EX',tcg_date:'2023-11-17'},{set_name:'Exact fixture anniversary',set_code:'EX',tcg_date:'2025-11-17'}]),[releaseA,releaseB]=releases;
const source={game:'ygo',id:'12345',name:'Synthetic exact history card',prices:{usd:999},sets:releases.flatMap(r=>[{name:r.name,code:'EX-EN001',rarity:'Ultra Rare',price:null},{name:r.name,code:'EX-E001',rarity:'Super Rare',price:null}])};
const cardA=setContextCard('ygo',source,releaseA,releases),cardB=setContextCard('ygo',source,releaseB,releases);
const quote=(card=cardA,edition='1st-edition',print='EX-EN001::Ultra Rare')=>presentationQuote('ygo',card,'reference',print,edition);
const q=quote(),storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
S.state=blank();S.state.settings.game='ygo';S.ui.sheetCtx=null;
const saved=JSON.stringify(S.state),calls=[];
const subtype={'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'};
function response(q,{status='ready',points=[{date:'2026-09-13',value:7},{date:'2026-09-16',value:9}],echo={},seriesPatch={}}={}){
 const identity=exactYgoHistoryIdentity(q);
 return {...identity,status,...echo,series:status==='ready'?[{...identity,source:'Synthetic exact provider',historyProvider:'recent',label:[q.edition,q.rarity,subtype[q.selectedEdition]].join(' · '),subtype:subtype[q.selectedEdition],productId:101,points,...seriesPatch}]:[]};
}
function mock(handler=()=>response(q)){
 globalThis.fetch=async raw=>{const url=new URL(raw,'https://fixture.invalid/');calls.push(url);const body=await handler(url);return body instanceof Response?body:Response.json(body);};
}
function query(url){const p=url.searchParams;return {game:p.get('game'),cardId:p.get('id'),finish:p.get('finish'),releaseId:p.get('releaseId'),edition:p.get('edition'),rarity:p.get('rarity'),selectedEdition:p.get('selectedEdition'),currency:p.get('currency')};}
function reset(){sharedHistory.clear();storage.clear();calls.length=0;}
function hasState(html,state){assert.match(html,new RegExp('data-history-state="'+state+'"'));}
mock();
// No current quote is needed to choose an edition. Neither control implies stock.
let noPrint=presentationQuote('ygo',cardA),noEdition=quote(cardA,''),html=priceOverview('ygo',cardA,{type:'tcard',priceEdition:q.editionKey});
assert.equal(noPrint.printing,null);assert.equal(priceSelectionState(noPrint),'printing-required');assert.equal(priceSelectionState(noEdition),'edition-required');
hasState(historyPanel(noPrint),'printing-required');hasState(historyPanel(noEdition),'edition-required');
assert.match(html,/data-change="historyYgoEdition"/);assert.match(html,/value="" selected>Edition not specified/);assert.match(html,/not every printing has every edition/);assert.doesNotMatch(html,/data-history-state="unsupported"|No recorded quotes|\$0\.00/);
assert.equal(priceSelectionState(quote(cardA,'normal')),'edition-required');assert.equal(calls.length,0);
// Browser-mode rendering issues precisely one deduplicated pair per eligible key.
globalThis.window={};
for(const edition of Object.keys(subtype)){
 reset();const selected=quote(cardA,edition);mock(url=>response(query(url)));assert(canRequestExactYgoHistory(selected));hasState(historyPanel(selected,'all'),'loading');await loadSharedHistory(selected);
 assert.equal(calls.length,2);for(const u of calls){assert(['/api/prices/archive','/api/prices/recent'].includes(u.pathname));assert.equal(u.searchParams.get('releaseId'),selected.releaseId);assert.equal(u.searchParams.get('edition'),selected.edition);assert.equal(u.searchParams.get('rarity'),selected.rarity);assert.equal(u.searchParams.get('selectedEdition'),edition);assert.equal(u.searchParams.get('currency'),'USD');}
 html=historyPanel(selected,'all');hasState(html,'ready');assert.match(html,/2 recorded quotes/);assert.match(html,new RegExp(subtype[edition]));assert.doesNotMatch(html,/check edition|Card-level reference|\$999|\$0\.00/);
 assert.equal(selected.value,null,'Historical observations cannot become today\'s current quote');assert.equal(JSON.stringify(S.state),saved,'History reads cannot create owned, condition or current price values');
}
// Incomplete and unverified requests do not fall back to Supabase or card-level feeds.
reset();for(const incomplete of [noPrint,noEdition,{...q,selectionVerified:false},{...q,releaseId:'wrong'}]){historyPanel(incomplete);await loadSharedHistory(incomplete);}assert.equal(calls.length,0);
// A wrong echo at either response or series level is a failure, never confirmed empty.
for(const key of ['releaseId','edition','rarity','currency','selectedEdition'])for(const level of ['echo','seriesPatch']){
 reset();mock(()=>response(q,{[level]:{[key]:'WRONG'}}));await loadSharedHistory(q);html=historyPanel(q,'all');hasState(html,'unavailable');assert.doesNotMatch(html,/market-chart|No recorded quotes|\$0\.00/);
}
reset();mock(()=>response(q,{seriesPatch:{subtype:'Normal'}}));await loadSharedHistory(q);hasState(historyPanel(q),'unavailable');
for(const [status,pattern] of [['unsupported',/could not verify/],['unavailable',/temporarily unavailable/],['empty',/No recorded quotes/]]){
 reset();mock(()=>response(q,{status}));await loadSharedHistory(q);html=historyPanel(q);hasState(html,status);assert.match(html,pattern);assert.doesNotMatch(html,/market-chart|historyChoosePrinting|\$0\.00/);assert.equal((html.match(/class="history-empty"/g)||[]).length,1);
}
for(const points of [[],[{date:'2026-09-13',value:0}],[{date:'2026-02-30',value:10}]]){
 reset();mock(()=>response(q,{points}));await loadSharedHistory(q);html=historyPanel(q);hasState(html,'empty');assert.doesNotMatch(html,/market-chart|\$0\.00/);
}
// Valid exact observations survive a later outage, visibly distinct from a current quote.
reset();sharedHistory.set(historyKey(q),{...response(q),checked:Date.now()-4000000});mock(()=>new Response('',{status:503}));await loadSharedHistory(q);html=historyPanel(q,'all');hasState(html,'ready');assert.match(html,/data-history-source-state="unavailable"/);assert.match(html,/History refresh is temporarily unavailable. Showing saved observations/);assert.match(html,/\$9\.00/);assert.equal(q.value,null);
// Actual workbench change handlers clear the old edition when printing changes.
const A={},C={};let refreshes=0,opened=0;
registerWorkbench({A,C,getGame:()=> 'ygo',getCard:(_g,_e,ctx)=>ctx.setId===releaseB.id?cardB:cardA,refreshSheet:()=>refreshes++,openSheet:()=>opened++,links:()=>[]});
S.ui.sheetCtx={type:'tcard',game:'ygo',id:source.id,setId:releaseA.id,priceEdition:q.editionKey,priceYgoEdition:'1st-edition'};
C.historyEdition({value:'EX-E001::Super Rare'});assert.equal(S.ui.sheetCtx.priceYgoEdition,'');C.historyYgoEdition({value:'limited'});assert.equal(S.ui.sheetCtx.priceYgoEdition,'limited');
// Late responses fill their own exact cache but never redraw B, a new card, or a closed sheet.
async function deferredCase(change,expectRefresh=false){
 reset();refreshes=0;opened=0;const waiting=[];mock(async url=>{await new Promise(resolve=>waiting.push(resolve));return response(query(url));});
 S.ui.sheetCtx={type:'tcard',game:'ygo',id:source.id,setId:releaseA.id,priceEdition:q.editionKey,priceYgoEdition:q.selectedEdition};
 const pending=loadSharedHistory(q);assert.equal(waiting.length,2);change();waiting.forEach(resolve=>resolve());await pending;assert.equal(refreshes,expectRefresh?1:0);assert.equal(opened,0);assert.equal(sharedHistory.get(historyKey(q)).releaseId,q.releaseId);
}
await deferredCase(()=>{S.ui.sheetCtx.priceYgoEdition='unlimited';});
await deferredCase(()=>{S.ui.sheetCtx.setId=releaseB.id;});
await deferredCase(()=>{S.ui.sheetCtx=null;});
// A different card is represented by a projected getCard response, not only a context ID.
registerWorkbench({A:{},C:{},getGame:()=> 'ygo',getCard:(_g,e)=>e.cardId===source.id?cardA:setContextCard('ygo',{...source,id:e.cardId},releaseA,releases),refreshSheet:()=>refreshes++,links:()=>[]});
await deferredCase(()=>{S.ui.sheetCtx.id='98765';});await deferredCase(()=>{},true);
S.ui.sheetCtx=null;
// Legacy non-YGO URL parameters and provider count are unchanged.
for(const [game,finish,count]of [['ptcg','reference',3],['mtg','nonfoil',2]]){
 reset();const legacy=presentationQuote(game,{id:'legacy-'+game,name:'Legacy',prices:{usd:null},finishes:['nonfoil']},finish);mock(()=>({game,cardId:legacy.cardId,finish,series:[]}));await loadSharedHistory(legacy);assert.equal(calls.length,count);assert(calls.some(u=>u.origin===new URL(SUPABASE.url).origin));assert(calls.every(u=>!u.searchParams.has('releaseId')&&!u.searchParams.has('selectedEdition')));hasState(historyPanel(legacy),'empty');
}
delete globalThis.window;
console.log('PASS: exact YGO UI activation, explicit edition without quotes, identity-safe request/response/cache, truthful ready/unsupported/outage/empty states, zero rejection, current/condition isolation, workbench selection and delayed response/cancel/card change, and unchanged non-YGO requests.');
