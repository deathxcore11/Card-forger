// Exercise production Magic loaders and registered picker action without browser or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadMagicPrintingPage,mergeMagicCards} from './catalog-tools.js';
import {createPrintingPicker} from './printing-picker.js';
import {S as store,blank} from './store.js';
import {cardSheet} from './views.js';
const source=fs.readFileSync('app.js','utf8');
const card=(id,extra={})=>({id,name:'Same Magic Name',oracle_id:'oracle-a',set:'fdn',set_name:'Foundations',collector_number:id,released_at:'2024-11-15',finishes:['nonfoil','foil'],prices:{usd:null,usd_foil:null},full:true,games:['paper'],...extra});
let requested=[];
const sourceCard=card('initial'),unknown=card('1');
let page=await loadMagicPrintingPage(sourceCard,{request:async path=>{requested.push(path);return {data:[unknown,unknown,card('bad',{oracle_id:'other-oracle'}),card('digital',{games:['arena']})],has_more:true,next_page:'https://api.scryfall.com/cards/search?page=2',total_cards:4};}});
assert.deepEqual(page.cards,[unknown]);assert.equal(page.complete,false);assert.equal(page.cards[0].prices.usd,null);assert.match(decodeURIComponent(requested[0]).replaceAll('+',' '),/oracleid:oracle-a game:paper/);assert.equal(page.nextCursor,'/cards/search?page=2');
await assert.rejects(()=>loadMagicPrintingPage(sourceCard,{cursor:'https://attacker.invalid/cards/search',request:()=>{throw Error('never');}}),/Unexpected/);
await assert.rejects(()=>loadMagicPrintingPage(sourceCard,{request:async()=>({data:[],has_more:true})}),/next printing page/);
await assert.rejects(()=>loadMagicPrintingPage(sourceCard,{cursor:'/cards/search?page=2',request:async()=>({data:[],has_more:true,next_page:'/cards/search?page=2'})}),/repeated/);
const aborted=new AbortController();aborted.abort();await assert.rejects(()=>loadMagicPrintingPage(sourceCard,{signal:aborted.signal,request:()=>{throw Error('must not fetch');}}),/cancelled/);
const db={term:'parent draft',filters:{sort:'usd'},results:[card('search')],next:'search-cursor'},state={collection:[{id:'old-owned',printingId:'initial',printingVerified:true,qty:3,finish:'foil'},{id:'new-owned',printingId:'chosen',printingVerified:true,qty:2,finish:'foil'}],printings:{initial:sourceCard},priceChoices:{unrelated:{price:17}}};
const ctx={type:'card',name:sourceCard.name,print:sourceCard,priceFinish:'foil',tab:'versions',face:1,entryId:'old-owned',entry:'legacy-old-entry'},S={state,ui:{db,sheetCtx:ctx,prints:['global-sentinel']}};
let sheetOpen=true,game='mtg',refreshes=0,cacheWrites=0;const pending=[];
const harness={navigationStamp:()=>({}),navigationCurrent:()=>true,S,T:{game:()=>game},A:{},meta:()=>sourceCard,$:()=>({open:sheetOpen}),api:path=>new Promise((resolve,reject)=>pending.push({path,resolve,reject})),loadMagicPrintingPage,mergeMagicCards,refreshSheet:()=>refreshes++,ensureTcgPrices(){},cacheCard:c=>{cacheWrites++;return c;},saveCatalogSoon(){},slim:c=>c,URLSearchParams,URL,selectedFinish:(_g,_c,f)=>f};
vm.createContext(harness);vm.runInContext(source.slice(source.indexOf('async function loadCardExtras('),source.indexOf('\nA.flipFace')),harness);
let loading=harness.loadMagicVersions(ctx);assert.equal(ctx.printsBusy,true);pending.at(-1).resolve({data:[card('1')],has_more:true,next_page:'/cards/search?page=2',total_cards:5});await loading;
assert.equal(ctx.printsComplete,false);assert.equal(ctx.printsNext,'/cards/search?page=2');assert.deepEqual(S.ui.prints,['global-sentinel']);
loading=harness.A.magicVersionsMore();pending.at(-1).reject(Error('fixture offline'));await loading;assert.equal(ctx.prints.length,1);assert.equal(ctx.printsNext,'/cards/search?page=2');assert.match(ctx.printsError,/offline/);
for(let i=2;i<=5;i++) {loading=harness.A.magicVersionsMore();assert.equal(pending.at(-1).path,'/cards/search?page='+i);pending.at(-1).resolve({data:[card(String(i-1)),card(String(i))],has_more:i<5,next_page:i<5?'/cards/search?page='+(i+1):null,total_cards:5});await loading;}
assert.equal(ctx.prints.length,5,'no three-page ceiling and duplicate printing IDs stay unique');assert.equal(ctx.printsComplete,true);assert.equal(ctx.printsNext,null);assert.equal(ctx.print.id,'initial');assert.equal(ctx.priceFinish,'foil');assert.equal(cacheWrites,0);assert.deepEqual(S.ui.prints,['global-sentinel']);
// Leave during enrichment: no late write to a newer detail, Search, prices or global printings.
const abandoned={type:'card',name:sourceCard.name,print:sourceCard};S.ui.sheetCtx=abandoned;loading=harness.loadMagicVersions(abandoned);S.ui.sheetCtx=ctx;pending.at(-1).resolve({data:[card('abandoned')],has_more:false});await loading;assert.equal(abandoned.prints,undefined);assert.equal(abandoned.printsBusy,false);assert.match(abandoned.printsError,/paused/);assert.equal(ctx.prints.length,5);
// Actual registered picker open/action uses independent state; selection only changes the parent view.
const snapshots=[],body={innerHTML:'parent',scrollTop:55,querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false};
const openSheet=(html,context,top=0)=>{if(S.ui.sheetCtx!==context && S.ui.sheetCtx?.type!=='printing-picker')snapshots.push({ctx:S.ui.sheetCtx,html:body.innerHTML,scroll:body.scrollTop});S.ui.sheetCtx=context;body.innerHTML=html;body.scrollTop=top;};
const picker=createPrintingPicker({A:harness.A,C:{},I:{},openSheet,getContext:()=>S.ui.sheetCtx,getBody:()=>body,back:()=>{const snapshot=snapshots.pop();S.ui.sheetCtx=snapshot.ctx;body.innerHTML=snapshot.html;body.scrollTop=snapshot.scroll;}});
harness.printingPicker=picker;harness.toast=()=>{};
const beforeDb=JSON.stringify(db),beforeState=JSON.stringify(state),beforePrint=ctx.print;
loading=harness.A.magicPrintings();assert.equal(S.ui.sheetCtx.type,'printing-picker');pending.at(-1).resolve({data:[card('chosen')],has_more:false});await loading;
assert.equal(ctx.print,beforePrint);assert.equal(ctx.priceFinish,'foil');assert.equal(JSON.stringify(db),beforeDb);assert.equal(JSON.stringify(state),beforeState);
const foil=picker.state.rows.find(row=>row.finish==='foil');harness.A.printingPickerChoose({dataset:{key:foil.key}});
assert.equal(S.ui.sheetCtx,ctx);assert.equal(ctx.print.id,'chosen');assert.equal(ctx.priceFinish,'foil');assert.equal(ctx.face,0);assert.equal(ctx.entryId,'');assert.equal(ctx.entry,undefined);assert.equal(ctx.setVariant,'foil');assert.equal(body.scrollTop,55);assert.equal(JSON.stringify(db),beforeDb);assert.equal(JSON.stringify(state),beforeState);assert.equal(cacheWrites,0);
// Actual long-press projection and quick quantity scope cannot target the prior owned lot.
harness.key=x=>String(x||'').toLowerCase();harness.location={hash:'#collection'};harness.ownedCardLots=()=>{throw Error('Exact printing must stay scoped');};
vm.runInContext(source.slice(source.indexOf('async function resolveActionCard('),source.indexOf('function startCardCompare(')),harness);
const held=await harness.resolveActionCard({dataset:{name:ctx.name,entry:ctx.entryId||ctx.entry||''}});assert.equal(held.card.id,'chosen');assert.equal(held.setId,'fdn');assert.deepEqual(Array.from(harness.quickCardLots(held,state.collection),lot=>lot.id),['new-owned']);
// Cancel aborts old request, restores context and does not let its late response replace a reopened picker.
loading=harness.A.magicPrintings();const stale=pending.at(-1);assert(picker.cancel());assert.equal(S.ui.sheetCtx,ctx);const reopened=harness.A.magicPrintings(),newRequest=pending.at(-1);stale.resolve({data:[card('late')],has_more:false});await loading;assert.equal(picker.state.busy,true);newRequest.resolve({data:[card('current')],has_more:false});await reopened;assert.deepEqual(picker.state.cards.map(c=>c.id),['current']);assert(picker.cancel());assert.equal(JSON.stringify(db),beforeDb);assert.equal(JSON.stringify(state),beforeState);
// Selecting a raw printing cannot restart the paged list or discard its cursor.
ctx.print={...card('raw-selected'),full:undefined};ctx.prints=[card('page1'),card('page2')];ctx.printsNext='/cards/search?page=3';ctx.printsPages=['/cards/search?page=2'];ctx.printsComplete=false;S.ui.sheetCtx=ctx;
loading=harness.A.magicVersionsMore();assert.equal(pending.at(-1).path,'/cards/search?page=3','continuation takes precedence over raw selected-card hydration');pending.at(-1).resolve({data:[{...card('page3'),full:undefined}],has_more:false});await loading;assert.deepEqual(Array.from(ctx.prints,c=>c.id),['page1','page2','page3']);assert.equal(ctx.prints.at(-1).full,true,'full Scryfall printing payload is not treated as a brief card');
// Explicit full-card retry also preserves existing cards/cursor rather than reloading page one.
ctx.print={...card('hydrate-selected'),full:false};ctx.printsNext='/cards/search?page=4';ctx.detailsError=ctx.printsError='Prior details failure';const retainedPrints=ctx.prints;loading=harness.loadCardExtras(ctx);const detailsOnly=pending.at(-1),beforeDetailsCount=pending.length;detailsOnly.resolve({...card('hydrate-selected'),full:true});await loading;assert.equal(pending.length,beforeDetailsCount);assert.equal(ctx.prints,retainedPrints);assert.equal(ctx.printsNext,'/cards/search?page=4');assert.equal(ctx.detailsError,'');assert.equal(ctx.printsError,'');
// The real detail renderer tells the truth about partial coverage and explicit retries.
store.state=blank();const partial={...ctx,prints:[unknown],printsComplete:false,printsNext:'/cards/search?page=2',printsTotal:5,printsError:'Try again'};
let html=cardSheet(sourceCard,partial);assert.match(html,/Among 1 loaded printings/);assert.match(html,/data-act="magicPrintings"/);assert.match(html,/data-act="magicVersionsMore"/);assert.match(html,/1 verified printings loaded of 5/);assert.doesNotMatch(html,/Across 1 printings/);
console.log('PASS: Magic exact-oracle loader, paper-only gate, >3-page continuation/retry/dedup, stale detail isolation, actual picker selection/cancel/reopen, preserved parent Search/finish/scroll, and zero collection/default-price/global-printing writes.');
// Full-card enrichment interrupted before the printing stage must expose a real retry.
const unfinished={type:'card',name:sourceCard.name,print:{...sourceCard,full:false}};S.ui.sheetCtx=unfinished;
loading=harness.loadCardExtras(unfinished);const fullRequest=pending.at(-1);S.ui.sheetCtx={type:'printing-picker'};
fullRequest.resolve({...sourceCard,full:true});await loading;
assert.equal(unfinished.print.full,false);assert.equal(unfinished.prints,undefined);assert.equal(unfinished.detailsBusy,false);assert.match(unfinished.detailsError,/paused/);assert.match(unfinished.printsError,/Retry/);
S.ui.sheetCtx=unfinished;loading=harness.A.magicVersionsMore();const fullRetry=pending.at(-1);assert.match(fullRetry.path,/\/cards\/initial$/);const pendingCount=pending.length;await harness.A.magicVersionsMore();assert.equal(pending.length,pendingCount,'repeat retry cannot duplicate pending full-card hydration');
fullRetry.resolve({...sourceCard,full:true});await new Promise(r=>setTimeout(r,0));const printingRetry=pending.at(-1);assert.match(printingRetry.path,/\/cards\/search/);printingRetry.resolve({data:[card('resumed')],has_more:false});await loading;
assert.equal(unfinished.print.full,true);assert.equal(unfinished.prints[0].id,'resumed');assert.equal(unfinished.detailsBusy,false);assert.equal(unfinished.detailsError,'');assert.equal(unfinished.printsError,'');assert.equal(cacheWrites,0);
console.log('PASS: interrupted full-detail hydration exposes scoped pause/retry, resumes through the registered action, and cannot duplicate requests or mutate name-wide card cache.');

// Native dialog.close() queues `close`: run actual open/close/back callbacks against
// a fake dialog that delivers that queued event only after a new detail has opened.
const {SheetHistory,BROWSE_TYPES,sheetKey}=await import('./sheet-history.js');
const {captureDetailState,restoreDetailState}=await import('./pricing-presentation.js');
const events=new Map(),closeEvents=[],classes=new Set();let returnedFocus=0,abandons=0,cleanupCount=0;
const opener={isConnected:true,focus(){returnedFocus++;}};
const dialog={open:false,dataset:{},showModal(){this.open=true;},close(){this.open=false;closeEvents.push(()=>events.get('close')?.());},addEventListener:(type,fn)=>events.set(type,fn)};
const sheetBody={dataset:{},innerHTML:'',scrollTop:0,offsetWidth:0,classList:{add(){},remove(){}},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false,addEventListener(){}};
const life={S:{ui:{sheetCtx:null}},A:{},T:{game:()=> 'ptcg'},$:id=>id==='#sheet'?dialog:sheetBody,document:{activeElement:opener,documentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},querySelector:()=>null},window:{scrollY:0},location:{hash:'#decks'},BROWSE_TYPES,SheetHistory,sheetKey,captureDetailState,restoreDetailState,sheetTrail:new SheetHistory(),restoringSheet:false,pendingRoute:null,binderDragCleanup:()=>cleanupCount++,lastSheetStep:'',sheetReturn:null,sheetScrollWired:false,detailContextIdentity:()=>'',dismissRuleHint(){},dismissRulesGuide(){},sheetScrolled(){},refreshConditionPrice(){},wireSheetBack(){},attachBinderDrag(){},printingPicker:{abandon(){abandons++;}}};
vm.createContext(life);
const segment=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
vm.runInContext(segment('function sheetSnapshot(){','\nfunction restoreSheet(')+'\n'+segment('function openSheet(','\n// Emblems')+'\n'+segment('function closeSheet(','\nfunction refreshSheet()')+'\n'+segment('function restoreSheetHistory()','\nconst printingPicker')+'\n'+segment('$("#sheet").addEventListener("close",','\nconst busy ='),life);
life.openSheet('<p>Picker</p>',{type:'printing-picker'});assert(dialog.open);assert(classes.has('sheet-open'));
life.restoreSheetHistory();assert.equal(dialog.open,false);assert.equal(closeEvents.length,1);assert.equal(life.S.ui.sheetCtx,null);
const selectedDetail={type:'tcard',game:'ptcg',id:'chosen-name-only'};life.openSheet('<p>Selected card</p>',selectedDetail);assert(dialog.open);const cleanupsBefore=cleanupCount,abandonsBefore=abandons;
closeEvents.shift()();assert.equal(life.S.ui.sheetCtx,selectedDetail,'old native close cannot erase the reopened selected detail');assert.equal(dialog.open,true);assert(classes.has('sheet-open'),'old native close cannot unlock the background under a new modal');assert.equal(returnedFocus,0,'stale close must not steal focus');assert.equal(cleanupCount,cleanupsBefore);assert.equal(abandons,abandonsBefore,'stale close cannot abandon a newly active picker/session');
// A genuine later close still cleans the current dialog and restores its opener.
life.closeSheet(false);closeEvents.shift()();assert.equal(dialog.open,false);assert.equal(life.S.ui.sheetCtx,null);assert.equal(classes.has('sheet-open'),false);assert.equal(returnedFocus,1);
console.log('PASS: actual queued close/back/open lifecycle preserves newly selected name-only detail and modal lock/focus; real later close still cleans up normally.');
