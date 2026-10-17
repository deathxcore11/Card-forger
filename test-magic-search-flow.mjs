// Actual registered Magic callbacks, with deferred deterministic API responses only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {searchQuery,rankByName,magicFilterError,hasMagicSearchQuery,magicSearchSpec,scryfallSearchPath,mergeMagicCards,captureSearchFocus,restoreSearchFocus} from './catalog-tools.js';
import {captureDisclosures,restoreDisclosures} from './ui.js';
import {search} from './views.js';
import {S as store,blank} from './store.js';
const source=fs.readFileSync('app.js','utf8'),start=source.indexOf('function dbInvalidate('),end=source.indexOf('/* =========================================================\n   Ideas, references',start);
const card=(id,name=id,oracle_id=id)=>({id,name,oracle_id,set:'fdn',prices:{usd:null}});
const queued=[],cached=[],toasts=[],saved=[];let renders=0,game='mtg';
const db={term:'Alpha',filters:{},results:[],next:null,total:0,busy:false,error:''};
const context={A:{},C:{},I:{},S:{ui:{db,view:'search'}},T:{game:()=>game,savedSearches:()=>saved,setSavedSearches:(_g,x)=>saved.splice(0,saved.length,...x)},URL,URLSearchParams,AbortController,structuredClone,searchQuery,rankByName,magicFilterError,hasMagicSearchQuery,magicSearchSpec,scryfallSearchPath,mergeMagicCards,
 api:(path,options={})=>new Promise((resolve,reject)=>queued.push({path,signal:options.signal,resolve,reject})),cacheCard:c=>cached.push(c),saveCatalogSoon(){},render:()=>renders++,toast:m=>toasts.push(m),V:{mtgFilterChips:()=>[]},currentDeck:()=>null};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
const {A,C,I}=context,tick=()=>new Promise(r=>setTimeout(r,0));
const response=(data,more=false,next='https://api.scryfall.com/cards/search?page=2')=>({data,total_cards:8,has_more:more,next_page:more?next:null});
let old=A.dbSearch();assert.equal(queued.length,1);assert.equal(db.busy,true);assert(Object.isFrozen(db.submitted));assert(Object.isFrozen(db.submitted.filters));
I.dbTerm({value:'Beta'});assert.equal(queued[0].signal.aborted,true,'new drafts cancel queued or in-flight API work');assert.equal(db.busy,false);let fresh=A.dbSearch();assert.equal(queued.length,2,'replacement is never lost');
queued[0].resolve(response([card('stale')]));await old;assert.equal(db.busy,true,'old finally cannot release newer lock');assert.deepEqual(cached,[]);
queued[1].resolve(response([card('b')],true));await fresh;assert.equal(db.results[0].id,'b');assert.equal(db.busy,false);
// Paging is immutable, duplicate clicks suppressed, failed page retained for retry.
let more=A.dbMore();assert.equal(queued.length,3);await A.dbMore();assert.equal(queued.length,3);queued[2].reject(Error('offline'));await more;
assert.equal(db.results.length,1);assert.equal(db.next,'/cards/search?page=2');assert.match(db.error,/offline/);
more=A.dbMore();assert.equal(queued[3].path,queued[2].path);queued[3].resolve(response([card('b-duplicate','b','b'),card('c')],true,'https://api.scryfall.com/cards/search?page=3'));await more;
assert.deepEqual(Array.from(db.results,x=>x.id),['b','c']);
// Replacing a pending page with filters cancels that page and retains the new order.
more=A.dbMore();let filter=C.dbFilter({dataset:{field:'sort'},value:'usdAsc'});assert.equal(queued.length,6);assert.match(queued[5].path,/order=usd&dir=asc/);
queued[4].reject(Error('late page failure'));await more;assert.equal(db.error,'');assert.equal(db.busy,true);
queued[5].resolve(response([card('new')]));await filter;assert.equal(db.results[0].id,'new');
// Clear, last-chip removal, and plain query edits invalidate both success and failure.
old=A.dbSearch();db.term='';A.dbClear();queued[6].resolve(response([card('clear-stale')]));await old;assert.equal(db.results.length,0);assert.equal(db.next,null);assert.equal(db.busy,false);
filter=C.dbFilter({dataset:{field:'maxPrice'},value:'0'});assert.match(decodeURIComponent(queued[7].path),/usd<=0/);queued[7].resolve(response([]));await filter;
assert(hasMagicSearchQuery('',{maxPrice:'0'}));filter=C.dbFilter({dataset:{field:'maxPrice'},value:'2.5'});A.dbChip({dataset:{field:'maxPrice'}});queued[8].reject(Error('late removed filter'));await filter;assert.equal(db.error,'');assert.equal(db.busy,false);
// Invalid set is rejected before network and cannot be saved as a silently omitted chip.
const count=queued.length;await C.dbFilter({dataset:{field:'set'},value:'not a set'});assert.equal(queued.length,count);assert.match(db.error,/set code/);A.dbSave();assert.equal(saved.length,0);assert.match(toasts.at(-1),/set code/);
assert.throws(()=>searchQuery('',{set:'wrong set'}),/set code/);assert.equal(searchQuery('',{type:'legendary creature'}),'game:paper t:legendary t:creature');
// Saved-search restore supersedes in-flight query, no mutation of saved filter objects.
db.filters={};db.term='old';old=A.dbSearch();saved.push({term:'saved',filters:{type:'legendary creature',sort:'released'}});fresh=A.dbSaved({dataset:{i:'0'}});
assert.match(decodeURIComponent(queued.at(-1).path).replaceAll('+',' '),/t:legendary t:creature/);const latest=queued.at(-1);queued.at(-2).reject(Error('late saved-replaced'));await old;latest.resolve(response([card('saved')]));await fresh;
assert.equal(db.results[0].id,'saved');db.filters.type='land';assert.equal(saved[0].filters.type,'legendary creature');
// Actual shared game action invokes invalidation before async commit, including away/back.
const tcgSource=fs.readFileSync('tcg.js','utf8');
if(tcgSource.includes('ctx.invalidateMagicSearch?.()')) {
 const switchCode=tcgSource.slice(tcgSource.indexOf('  A.setGame = async'),tcgSource.indexOf('  A.hideStart ='));
 const switchCtx={A:{},ctx:{invalidateMagicSearch:()=>context.dbInvalidate(false)},GAMES:{mtg:{},ptcg:{},ygo:{}},game:()=>game,commit:async fn=>{const state={settings:{game}};fn(state);game=state.settings.game;},document:{body:{dataset:{}}},S:context.S,closeSheet(){},go(){},render(){},invalidateSearch:()=>{},invalidateTcgSearch:()=>{},ui:()=>({search:{}})};
 vm.runInNewContext(switchCode,switchCtx);old=A.dbSearch();await switchCtx.A.setGame({dataset:{game:'ptcg'}});await switchCtx.A.setGame({dataset:{game:'mtg'}});queued.at(-1).resolve(response([card('wrong-game')]));await old;assert.equal(db.results.length,0);
} else {
 old=A.dbSearch();context.dbInvalidate();game='ptcg';game='mtg';queued.at(-1).resolve(response([card('wrong-game')]));await old;assert.equal(db.results.length,0);
}
// A stale no-match response cannot launch a fallback against a newer query.
db.term='draw old';db.filters={};old=A.dbSearch();I.dbTerm({value:'draw new'});const fallbackCount=queued.length;queued.at(-1).reject(Error("didn't match any cards"));await old;assert.equal(queued.length,fallbackCount);
fresh=A.dbSearch();queued.at(-1).reject(Error("didn't match any cards"));await tick();assert.match(decodeURIComponent(queued.at(-1).path).replaceAll('+',' '),/o:"draw new"/);queued.at(-1).resolve(response([card('rules')]));await fresh;assert.match(db.note,/draw new/);
// A repeated provider cursor stops truthfully instead of looping or adding duplicates.
db.term='repeat';fresh=A.dbSearch();queued.at(-1).resolve(response([card('r')],true));await fresh;more=A.dbMore();queued.at(-1).resolve(response([card('r')],true));await more;assert.equal(db.next,null);assert.match(db.error,/repeated/);
// Stable disclosure identity survives changing active-filter summary, plus focus range/draft.
const oldDetail={id:'magic-search-filters',open:true,querySelector:()=>({textContent:'Filters · 1 on'})},newDetail={...oldDetail,open:false,querySelector:()=>({textContent:'Filters · 2 on'})};
const state=captureDisclosures({querySelectorAll:()=>[oldDetail]});restoreDisclosures({querySelectorAll:()=>[newDetail]},state);assert.equal(newDetail.open,true);
const active={tagName:'INPUT',id:'dbTerm',value:'draft still typing',selectionStart:2,selectionEnd:7,selectionDirection:'backward'},copy={...active,value:'server',focus(opts){this.focused=opts;},setSelectionRange(...range){this.range=range;}};
const focus=captureSearchFocus({contains:el=>el===active},active);restoreSearchFocus({querySelectorAll:()=>[copy]},focus);assert.equal(copy.value,active.value);assert.deepEqual(copy.range,[2,7,'backward']);assert.deepEqual(copy.focused,{preventScroll:true});
const cardButton=name=>({tagName:'BUTTON',dataset:{act:'card',name},focus(){this.focused=true;}}),firstButton=cardButton('First'),wantedButton=cardButton('Second'),oldButton=cardButton('Second');
restoreSearchFocus({querySelectorAll:()=>[firstButton,wantedButton]},captureSearchFocus({contains:()=>true},oldButton));assert.equal(wantedButton.focused,true);assert.equal(firstButton.focused,undefined,'focus restores exact card action, not first action with same name');
store.state=blank();store.ui.db={...db,term:'',filters:{maxPrice:'0'},results:[],next:'/cards/search?page=2',total:8,busy:false,error:''};
let html=search();assert.match(html,/id="magic-search-filters"/);assert.match(html,/id="magic-search-advanced"/);assert.match(html,/At most \$0\.00/);assert.match(html,/data-act="dbMore"/,'continuation survives a zero-result provider page');
store.ui.db.results=[card('not-owned')];store.ui.db.filters={own:'owned'};html=search();assert.match(html,/None of the loaded cards/);assert.match(html,/data-act="dbMore"/);
assert.throws(()=>scryfallSearchPath('https://other.example/cards/search?page=2'),/Unexpected/);assert.throws(()=>scryfallSearchPath('https://api.scryfall.com/cards/random'),/Unexpected/);
console.log('PASS: actual Magic query/filter/Clear/saved/page actions resist stale success/failure, fallback and game changes; valid price-only/legendary queries, honest invalid filters, retries/dedup, stable disclosures and draft focus.');
// Exercise the actual serialized API boundary: cancellation releases A and skips queued C.
const apiCalls=[],apiCtx={AbortController,setTimeout,clearTimeout,fetch:(url,init)=>new Promise((resolve,reject)=>{
 const call={url,resolve,reject,signal:init.signal};apiCalls.push(call);
 init.signal.addEventListener('abort',()=>{const error=Error('aborted');error.name='AbortError';reject(error);},{once:true});
})};
vm.createContext(apiCtx);vm.runInContext(source.slice(source.indexOf('let apiChain ='),source.indexOf('\nasync function resolve(name')),apiCtx);
const aAbort=new AbortController(),cAbort=new AbortController();
const apiA=apiCtx.api('/cards/search?q=A',{signal:aAbort.signal});const aRejected=assert.rejects(apiA,/cancelled/);
while(!apiCalls.length)await new Promise(r=>setTimeout(r,5));
const apiB=apiCtx.api('/cards/search?q=B'),apiC=apiCtx.api('/cards/search?q=C',{signal:cAbort.signal});const cRejected=assert.rejects(apiC,/cancelled/);cAbort.abort();aAbort.abort();await aRejected;
while(apiCalls.length<2)await new Promise(r=>setTimeout(r,5));assert.match(apiCalls[1].url,/q=B$/);apiCalls[1].resolve({ok:true,json:async()=>({data:[]})});await apiB;await cRejected;assert.equal(apiCalls.length,2,'an already cancelled queued request never reaches the provider');
console.log('PASS: actual queued Scryfall API honors AbortSignal, releases replaced requests promptly and skips cancelled queued traffic.');
