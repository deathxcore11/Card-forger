// Deterministic provider-contract fixtures only. No live or paid requests.
import assert from 'node:assert/strict';
import {archivePriceRoute,ARCHIVE_COMMIT} from './historical-archive.js';
import {recentHistoryRoute} from './recent-history.js';
import {ygoSetId} from './ygo.js';
import {canRequestExactYgoHistory,parseYgoHistoryRelease,exactYgoHistoryIdentity,ygoHistorySubtype,YGO_HISTORY_SCHEMA} from './ygo-history-identity.js';
import {historyKey,validateHistory,loadSharedHistory,requestHistory,sharedHistory,historyResponseStatus} from './shared-history.js';
import {SUPABASE} from './config.js';
const now=Date.parse('2026-10-17T00:00:00Z'),day=Date.parse('2026-09-13T00:00:00Z')/864e5;
const release={set_code:'VASM',set_name:'Valiant Smashers',tcg_date:'2023-11-17'};
const anniversary={...release,set_name:'Valiant Smashers (Anniversary)',tcg_date:'2025-11-17'};
const q={game:'ygo',cardId:'12345',finish:'reference',releaseId:ygoSetId(release),edition:'VASM-EN001',rarity:'Ultra Rare',selectedEdition:'1st-edition',currency:'USD',selectionVerified:true};
const codeProduct=(productId,code='VASM-EN001',rarity='Ultra Rare',groupId=7)=>({productId,groupId,extendedData:[{name:'Number',value:code},{name:'Rarity',value:rarity}]});
const recentRows={'1st Edition':[{snapshot_date:'2026-09-13',market:3}],Unlimited:[{snapshot_date:'2026-09-13',market:8}],Limited:[{snapshot_date:'2026-09-13',market:11}],Normal:[{snapshot_date:'2026-09-13',market:999}]};
const archivedRows={'1st edition':[[day,3]],unlimited:[[day,8]],limited:[[day,11]],normal:[[day,999]]};
function source(overrides={}){
 const f={catalogue:[release,anniversary],card:{id:12345,card_sets:[{set_code:'VASM-EN001',set_name:release.set_name,set_rarity:'Ultra Rare'},{set_code:'VASM-EN001',set_name:anniversary.set_name,set_rarity:'Ultra Rare'}]},groups:[{groupId:7,name:release.set_name},{groupId:8,name:anniversary.set_name}],products:[codeProduct(101),codeProduct(103,'VASM-E001'),codeProduct(104,'VASM-EN001','Super Rare')],otherProducts:[codeProduct(102,'VASM-EN001','Ultra Rare',8)],recent:recentRows,archive:archivedRows,archiveProducts:{101:['VASM-EN001',0]},...overrides},calls=[];
 const fetcher=async raw=>{
  const u=String(raw);calls.push(u);
  if(f.fail)throw Error('Mock network outage');
  if(u.endsWith('/cardsets.php'))return Response.json(f.catalogue);
  if(u.includes('/cardinfo.php?'))return Response.json({data:[f.card]});
  if(u.endsWith('/2/groups'))return Response.json({results:f.groups});
  if(u.endsWith('/2/7/products'))return Response.json({results:f.products});
  if(u.endsWith('/2/8/products'))return Response.json({results:f.otherProducts});
  if(u.includes('api.tickermint.cards/products/'))return Response.json(u.includes('/102/')?{'1st Edition':[{snapshot_date:'2026-09-13',market:22}]}:f.recent);
  if(u.endsWith('/maps/groups.json'))return Response.json({'2':{'7':'valiant-smashers','8':'anniversary'}});
  if(u.includes('/maps/products/yugioh/'))return Response.json(u.endsWith('/anniversary.json')?{'102':['VASM-EN001',0]}:f.archiveProducts);
  if(u.includes('/data/yugioh/'))return Response.json({updated:'2026-09-15',cards:{'VASM-EN001':u.endsWith('/anniversary.json')?{'1st edition':[[day,22]]}:f.archive}});
  throw Error('Unexpected provider '+u);
 };
 return {fetcher,calls};
}
const url=(route,query=q)=>new URL('https://fixture.test/api/prices/'+route+'?'+new URLSearchParams({game:query.game,id:query.cardId,finish:query.finish,edition:query.edition,rarity:query.rarity,releaseId:query.releaseId,selectedEdition:query.selectedEdition,currency:query.currency}));
async function call(route,query=q,overrides={}){
 const f=source(overrides),r=await (route==='archive'?archivePriceRoute:recentHistoryRoute)(url(route,query),{},f.fetcher,now);
 return {r,data:await r.json(),calls:f.calls};
}
assert.equal(canRequestExactYgoHistory(q),true);
for(const patch of [{cardId:12345},{selectedEdition:''},{selectedEdition:'unknown'},{currency:'EUR'},{rarity:''},{releaseId:'VASM'},{releaseId:'ygo:VASM:2023-02-30:Valiant%20Smashers'},{edition:'OTHER-EN001'},{finish:'foil'},{selectionVerified:false}])assert.equal(canRequestExactYgoHistory({...q,...patch}),false);
const longRelease=ygoSetId({...release,set_name:'Very long release '.repeat(150)});assert(longRelease.length>2000);assert.equal(parseYgoHistoryRelease(longRelease).name,'Very long release '.repeat(150).trim());
assert.equal(ygoHistorySubtype('  1ST  Edition  '),'1st-edition');
for(const label of ['Normal','First Edition','1st Edition / Unlimited','Limited Edition','constructor','toString',''])assert.equal(ygoHistorySubtype(label),'');
let valid;
for(const route of ['recent','archive']){
 for(const [selectedEdition,value] of [['1st-edition',3],['unlimited',8],['limited',11]]){
  const query={...q,selectedEdition},{r,data}=await call(route,query);
  assert.equal(r.status,200);assert.equal(data.status,'ready');assert.equal(data.series.length,1);assert.equal(data.series[0].points[0].value,value);
  for(const [key,v] of Object.entries(exactYgoHistoryIdentity(query))){assert.equal(data[key],v);assert.equal(data.series[0][key],v);}
  assert.equal(data.series[0].productId,101);assert.doesNotThrow(()=>validateHistory(data,query));
  if(route==='recent'&&selectedEdition==='1st-edition')valid=data;
 }
 const other=await call(route,{...q,releaseId:ygoSetId(anniversary)});assert.equal(other.data.series[0].productId,102);assert.equal(other.data.series[0].points[0].value,22,'same prefix/code/rarity in another release remains separate');
 for(const overrides of [
  {catalogue:[]},
  {catalogue:[release,{...release,tcg_date:'2024-11-17'}]},
  {catalogue:[release,{...release,set_name:'Valiant: Smashers',set_code:'OTHER'}]},
  {card:{id:12345,card_sets:[{set_code:'VASM-E001',set_name:release.set_name,set_rarity:'Ultra Rare'}]}},
  {card:{id:12345,card_sets:[{set_code:'VASM-EN001',set_name:release.set_name,set_rarity:'Super Rare'}]}},
  {card:{id:999,card_sets:[]}},
  {groups:[{groupId:7,name:'Different Release',abbreviation:'VASM'}]},
  {groups:[{groupId:7,name:release.set_name},{groupId:8,name:release.set_name}]},
  {products:[codeProduct(101),codeProduct(102)]},
  {products:[codeProduct(101,'VASM-E001')]},
  {products:[codeProduct(101,'VASM-EN001','Super Rare')]},
  {products:[codeProduct(101,'VASM-EN001','Ultra Rare',99)]},
  {recent:{Normal:recentRows.Normal},archive:{normal:archivedRows.normal}},
  {recent:{'1st Edition / Unlimited':recentRows.Unlimited},archive:{'1st edition / unlimited':archivedRows.unlimited}},
  {recent:{'1st Edition':recentRows.Unlimited,'1ST EDITION':recentRows.Limited},archive:{'1st edition':archivedRows.unlimited,'1ST EDITION':archivedRows.limited}},
 ]){
  const result=await call(route,q,overrides);assert.equal(result.data.series.length,0,JSON.stringify(overrides));assert.equal(result.data.status,'unsupported',JSON.stringify(overrides));
 }
 const empty=await call(route,q,{recent:{'1st Edition':[]},archive:{'1st edition':[]}});assert.equal(empty.data.status,'empty');assert.deepEqual(empty.data.series,[]);
 for(const overrides of [{fail:true},{catalogue:{}},{products:[codeProduct('101/path')]},{recent:null,archive:null},{recent:{error:'outage'},archive:{error:'outage'}},{recent:{'1st Edition':{}},archive:{'1st edition':{}}}]){const result=await call(route,q,overrides);assert.equal(result.data.status,'unavailable');assert.deepEqual(result.data.series,[]);}
 for(const patch of [{selectedEdition:''},{selectedEdition:'Normal'},{releaseId:'VASM'},{releaseId:ygoSetId({...release,tcg_date:'2023-02-30'})},{currency:'EUR'},{rarity:''},{edition:'OTHER-EN001'}]){
  const result=await call(route,{...q,...patch});assert.equal(result.r.status,400);assert.equal(result.calls.length,0,'invalid exact request must not consume provider requests');
 }
 const duplicate=url(route);duplicate.searchParams.append('selectedEdition','unlimited');let called=0;
 assert.equal((await (route==='archive'?archivePriceRoute:recentHistoryRoute)(duplicate,{},async()=>{called++;throw Error();},now)).status,400);assert.equal(called,0);
}
for(const archiveProducts of [{101:['WRONG-001',0]},{101:['VASM-EN001',1]},{101:['VASM-EN001',0],102:['VASM-EN001',0]}])assert.equal((await call('archive',q,{archiveProducts})).data.status,'unsupported');
assert.equal((await call('recent',q,{recent:{'1st Edition':[{snapshot_date:'2026-02-30',market:9}]}})).data.status,'empty','invalid calendar dates never become observations');

// Old or poisoned response echoes must never validate for an exact selection.
for(const key of ['historySchema','game','cardId','finish','releaseId','edition','rarity','selectedEdition','currency']){
 assert.throws(()=>validateHistory({...valid,[key]:'wrong'},q));
 assert.throws(()=>validateHistory({...valid,series:[{...valid.series[0],[key]:'wrong'}]},q));
 const absent={...valid};delete absent[key];assert.throws(()=>validateHistory(absent,q));
}
for(const patch of [{subtype:'Normal'},{productId:'101'},{productId:0}])assert.throws(()=>validateHistory({...valid,series:[{...valid.series[0],...patch}]},q));
assert.deepEqual(validateHistory({...valid,series:[{...valid.series[0],points:[{date:'2026-02-30',value:9},{date:'2026-09-13',value:0}]}]},q).series[0].points,[],'exact cached data cannot manufacture calendar dates or zero quotes');
assert.equal(historyResponseStatus({status:'unsupported',series:[],notice:'No separate history for this physical edition.'}),'unsupported');
assert.equal(historyResponseStatus({status:'unavailable',series:[],notice:'Mock outage'}),'unavailable');
for(const patch of [{releaseId:ygoSetId(anniversary)},{edition:'VASM-E001'},{rarity:'Super Rare'},{selectedEdition:'unlimited'},{currency:'EUR'},{cardId:'54321'}])assert.notEqual(historyKey(q),historyKey({...q,...patch}));
assert.notEqual(historyKey(q),historyKey({...q,releaseId:''}));

// Cache route responses by all exact dimensions and schema, never by card-level URL.
const oldCaches=globalThis.caches,routeCache=new Map(),pending=[];
globalThis.caches={default:{match:async k=>routeCache.get(k.url)?.clone(),put:async(k,v)=>routeCache.set(k.url,v.clone())}};
try{
 const f=source(),ctx={waitUntil:p=>pending.push(p)};
 await recentHistoryRoute(url('recent'),ctx,f.fetcher,now);await Promise.all(pending);const firstCalls=f.calls.length;
 await recentHistoryRoute(url('recent'),ctx,f.fetcher,now);assert.equal(f.calls.length,firstCalls);
 const second=await recentHistoryRoute(url('recent',{...q,selectedEdition:'unlimited'}),ctx,f.fetcher,now);assert.equal((await second.json()).series[0].points[0].value,8);
 await Promise.all(pending);
 const keys=[...routeCache.keys()].filter(k=>k.includes('/api/prices/recent?'));assert.equal(keys.length,2);assert(keys.every(k=>k.includes('historySchema='+YGO_HISTORY_SCHEMA)&&k.includes('releaseId=')&&k.includes('selectedEdition=')&&k.includes('currency=USD')));
}finally{globalThis.caches=oldCaches;}

// Client uses only the two exact adapters even when shared Supabase is absent.
const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage,oldUrl=SUPABASE.url,storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
try{
 SUPABASE.url='';let seen=[];
 globalThis.fetch=async raw=>{seen.push(String(raw));return Response.json(valid);};
 const result=await loadSharedHistory(q);assert.equal(result.status,'ready');assert.equal(seen.length,2);assert(seen.every(u=>u.startsWith('api/prices/')&&!u.includes('supabase')));
 for(const raw of seen){const params=new URL(raw,'https://fixture.test/').searchParams;assert.equal(params.get('releaseId'),q.releaseId);assert.equal(params.get('selectedEdition'),q.selectedEdition);assert.equal(params.get('currency'),'USD');}
 seen=[];await loadSharedHistory({...q,selectedEdition:''});await loadSharedHistory({...q,selectionVerified:false});assert.equal(seen.length,0);
 const invalidQ={...q,cardId:'33333'},invalidKey=historyKey(invalidQ);
 sharedHistory.set(invalidKey,{...valid,cardId:invalidQ.cardId,releaseId:'another',checked:Date.now()});assert.equal(requestHistory(invalidQ),null,'in-memory wrong release cannot render');
 storage.set('cardstashy-public-market-history-v4',JSON.stringify({[invalidKey]:{...valid,cardId:invalidQ.cardId,checked:Date.now(),historySchema:'old'}}));sharedHistory.delete(invalidKey);assert.equal(requestHistory(invalidQ),null,'old local cache without exact contract cannot render');
 // A matching saved exact series remains available through outages, unchanged.
 const checked=Date.now()-4000000;sharedHistory.set(historyKey(q),{...valid,checked});
 globalThis.fetch=async()=>new Response('',{status:503});const stale=await loadSharedHistory(q);assert.equal(stale.status,'unavailable');assert.deepEqual(stale.series,valid.series);
 // A late response for release A cannot overwrite release B's key.
 sharedHistory.clear();storage.clear();let completeA;seen=[];
 globalThis.fetch=async raw=>{const u=new URL(raw,'https://fixture.test');seen.push(u.href);if(u.searchParams.get('releaseId')===q.releaseId)await new Promise(resolve=>{(completeA??=[]).push(resolve);});const query=u.searchParams.get('releaseId')===q.releaseId?q:{...q,releaseId:ygoSetId(anniversary)};return Response.json({...exactYgoHistoryIdentity(query),status:'empty',series:[]});};
 const first=loadSharedHistory(q),repeat=loadSharedHistory(q),otherQ={...q,releaseId:ygoSetId(anniversary)},second=await loadSharedHistory(otherQ);assert.equal(second.releaseId,otherQ.releaseId);assert.equal(seen.length,4,'one in-flight request pair per exact key');completeA.forEach(resolve=>resolve());await Promise.all([first,repeat]);assert.equal(sharedHistory.get(historyKey(otherQ)).releaseId,otherQ.releaseId);assert.equal(sharedHistory.get(historyKey(q)).releaseId,q.releaseId);
}finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;SUPABASE.url=oldUrl;}
console.log('PASS: exact YGO release/code/rarity/physical-edition/USD binding, provider subtype filtering, ambiguity/unknown/failure states, versioned cache and echo validation, only exact adapter requests, outage retention and late-response isolation.');
