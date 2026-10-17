import assert from 'node:assert/strict';
import { S, blank } from './store.js';
import { proven, provenSheetHtml, registerTcg } from './tcg.js';

S.state=blank();
const row=(name,price,qty=2,owned=0)=>({key:name,name,price,qty,owned,kind:'creature'});
const make=(rows,side=[])=>({g:'mtg',key:Math.random().toString(),title:'Fixture',sub:'',evidence:'',rows,sideRowsFn:()=>side,lists:[],load:async()=>{}});
const show=(spec,mode='original')=>{Object.assign(proven,{spec,mode,busy:false,msg:'',budget:0,last:null});return provenSheetHtml();};
let html=show(make([row('Unknown',null)]));
assert.match(html,/Price unavailable/);assert.match(html,/\$0<\/b> known subtotal · 2 unpriced · Incomplete total/);assert.doesNotMatch(html,/\$0<\/b> to finish/);assert.match(html,/provenRetry/);
html=show(make([row('Known',5),row('Unknown',null,3,1)]));
assert.match(html,/\$10<\/b> known subtotal · 2 unpriced/);
html=show(make([row('Owned unknown',null,3,3)]));assert.match(html,/complete ✓/);assert.doesNotMatch(html,/Price unavailable|Incomplete total/);
html=show(make([row('Free',0)]));assert.match(html,/\$0<\/b> to finish/);assert.doesNotMatch(html,/unpriced|Incomplete total/);
html=show(make([row('Free',0)],[row('Side unknown',null,3,1)]));assert.match(html,/Sideboard/);assert.match(html,/\$0 known subtotal · 2 unpriced · Incomplete total/);
html=show(make([row('Known',10)],[row('Side unknown',null)]),'budget');
assert.match(html,/Price check incomplete/);assert.doesNotMatch(html,/already costs little|fits \$|data-act="provenBudget"/);assert.match(html,/data-act="provenSave" disabled/);assert.equal(proven.last,null);
html=show(make([row('Known',1)],[row('Side known',50)]),'budget');assert.match(html,/Budgets below cover the main deck only/);
html=show(make([row('Unknown',null)]),'draft');assert.match(html,/known subtotal · 2 unpriced · Incomplete total/);
html=show({...make([]),sourceUrl:'javascript:alert(1)'});assert.doesNotMatch(html,/href="javascript:/);

const A={}, status={textContent:''};let rendered='',opens=0,toasts=[];
globalThis.document={querySelector:s=>s.includes('role=status')?status:s==='#sheetBody'?{scrollTop:0}:null,querySelectorAll:()=>[]};
const c={A,C:{},I:{},commit:async fn=>fn(S.state),render:()=>{},openSheet:(h,ctx)=>{opens++;rendered=h;S.ui.sheetCtx=ctx;},closeSheet:()=>{S.ui.sheetCtx=null;},toast:m=>toasts.push(m),writeRecord:async()=>{},go:()=>{},busy:()=>()=>{}};
registerTcg(c);
let attempts=0,rows=[row('Retry card',null)];
const retry={...make(rows),rowsFn:()=>rows,load:async status=>{status('Checking source');if(++attempts===1)return {failed:['Retry card']};rows=[row('Retry card',2)];return {failed:[]};}};
await c.openProven(retry);assert.equal(proven.busy,false);assert.match(proven.msg,/couldn’t load/);assert.match(rendered,/Retry prices/);
A.provenMode({dataset:{id:'budget'}});proven.budget=50;
await A.provenSave({dataset:{}});assert.match(toasts.at(-1),/total is incomplete/);
await A.provenRetry();assert.equal(attempts,2);assert.equal(proven.mode,'budget');assert.equal(proven.budget,50);assert.equal(proven.msg,'');assert.doesNotMatch(rendered,/Price unavailable|Incomplete total/);
await c.openProven({...make([]),load:async()=>{throw Error('Provider 503');}});assert.match(proven.msg,/Provider 503/);assert.match(rendered,/Retry prices/);
// A retry already in progress is never duplicated.
let finishRetry;const deferred={...make(rows),load:()=>new Promise(r=>finishRetry=r)};
const inFlight=c.openProven(deferred);const count=opens;await A.provenRetry();assert.equal(opens,count);finishRetry({failed:[]});await inFlight;
// A completed old request must never replace the current list's status.
let releaseOld,oldStatus;const old={...make(rows),load:status=>{oldStatus=status;return new Promise(r=>releaseOld=r);}};
const pending=c.openProven(old),snapshot={...proven},oldCtx=S.ui.sheetCtx;
const newer={...make(rows),load:async()=>({failed:['Newer problem']})};await c.openProven(newer);
oldStatus('Old pending message');assert.match(proven.msg,/Newer problem/);releaseOld({failed:['Old problem']});await pending;
assert.equal(proven.spec,newer);assert.match(proven.msg,/Newer problem/);
// Restore an earlier snapshot after completion, exactly as app Back does.
Object.assign(proven,snapshot);S.ui.sheetCtx=oldCtx;html=provenSheetHtml();assert.equal(proven.busy,false);assert.match(proven.msg,/Old problem/);assert.match(html,/Retry prices/);
// Closing the sheet cannot be undone by a late request.
let finishClosed;const closing={...make(rows),load:()=>new Promise(r=>finishClosed=r)};
const closed=c.openProven(closing);S.ui.sheetCtx=null;const closedOpens=opens;finishClosed({failed:[]});await closed;assert.equal(opens,closedOpens);assert.equal(S.ui.sheetCtx,null);
console.log('PASS: honest known subtotals, main/side unknown counts, owned/zero distinctions, blocked incomplete affordability claims, provider failure/retry, preserved selection, load races and Back/Close safety.');

// Exercise the actual non-Magic tournament loader contracts, not only UI fixtures.
const {metaState}=await import('./meta.js');
const {SOURCES,cache}=await import('./tcg.js');
const {normalizePtcg}=await import('./ptcg.js');
const {normalizeYgo}=await import('./ygo.js');
let captured;const open=c.openProven;c.openProven=spec=>{captured=spec;};
const oldY=SOURCES.ygo.byIds,oldP={get:SOURCES.ptcg.get,search:SOURCES.ptcg.search,cheapestPrint:SOURCES.ptcg.cheapestPrint,byName:SOURCES.ptcg.byName};
try {
  const stale={...normalizeYgo({id:9991,name:'Stale fixture',type:'Normal Monster',card_prices:[{tcgplayer_price:'5'}]}),fetchedAt:'2020-01-01T00:00:00Z'};
  cache.ygo[stale.id]=stale;S.state.settings.game='ygo';S.state.tcg={ygo:{collection:[],decks:[],wishlist:[]},ptcg:{collection:[],decks:[],wishlist:[]}};
  const d={key:'loader-ygo',main:[stale.id],extra:[],name:'Fixture',place:1,event:'Fixture'};
  metaState('ygo').data={decks:[d],top:[]};
  let calls=0;SOURCES.ygo.byIds=async ids=>{calls++;return [{...stale,fetchedAt:new Date().toISOString(),artSchema:1,prices:{usd:7}}];};
  A.tMetaDeck({dataset:{key:d.key}});assert.deepEqual(await captured.load(()=>{}),{failed:[]});assert.equal(calls,1,'stale cached cards refresh');assert.equal(captured.rowsFn()[0].price,7);
  cache.ygo[stale.id].prices.usd=null;await captured.load(()=>{});assert.equal(calls,2,'fresh but missing prices refresh');
  cache.ygo[stale.id].prices.usd=0;await captured.load(()=>{});assert.equal(calls,2,'genuine zero is priced, not missing');
  const p=normalizePtcg({id:'sv04-999',name:'Retry Pokémon',localId:'999',category:'Pokemon',stage:'Basic',legal:{standard:true},set:{id:'sv04',name:'Fixture'}});
  S.state.settings.game='ptcg';const pd={key:'loader-ptcg',name:'Fixture',place:1,event:'Fixture',list:[{name:p.name,qty:1,kind:'Pokemon'}]};
  metaState('ptcg').data={decks:[pd],top:[]};let phase=0,getCalls=0;
  SOURCES.ptcg.search=async()=>({cards:[p]});SOURCES.ptcg.get=async()=>{getCalls++;return {...p,prices:{usd:phase?3:null},fetchedAt:new Date().toISOString()};};SOURCES.ptcg.cheapestPrint=async card=>card;SOURCES.ptcg.byName=async()=>null;
  A.tMetaDeck({dataset:{key:pd.key}});assert.deepEqual((await captured.load(()=>{})).failed,[p.name]);assert.equal(captured.rowsFn()[0].price,null);
  phase=1;const firstCalls=getCalls;assert.deepEqual((await captured.load(()=>{})).failed,[]);assert.ok(getCalls>firstCalls,'previously unpriced Pokémon retries its provider');assert.equal(captured.rowsFn()[0].price,3);
} finally {SOURCES.ygo.byIds=oldY;Object.assign(SOURCES.ptcg,oldP);c.openProven=open;}
console.log('PASS: actual YGO/Pokémon tournament loaders refresh stale and missing prices, retry prior misses and preserve genuine zero-valued cards.');
