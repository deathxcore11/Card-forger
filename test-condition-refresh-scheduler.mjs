import { recordHomeDeckWork } from './home-deck-activity.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {CONDITION_REFRESH_LIMITS,createConditionRefreshScheduler,selectConditionLots,changedConditionLots,conditionLotIdentity,conditionCursorKey} from './condition-refresh-scheduler.js';
import {loadConditionQuotes,applyConditionQuotes,conditionRequest,CONDITION_IDENTITY} from './condition-feed.js';
import {conditionValue} from './condition-value.js';
import {registerScanner} from './scancam.js';
import {loadBatch,saveBatch} from './scan-batch.js';
import {S,blank} from './store.js';

// Pure Node only. Every request below is a fixture; accidental live I/O fails closed.
const original={fetch:globalThis.fetch,document:globalThis.document,localStorage:globalThis.localStorage};
globalThis.fetch=()=>{throw Error('Live provider/AI/network access is forbidden in this suite.');};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function clock(){
 let now=0,id=0;const timers=new Map();
 return {now:()=>now,setTimer:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},clearTimer:id=>timers.delete(id),
  async tick(ms=0){const target=now+ms;let rounds=0;await flush();while(true){const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert(++rounds<1000,'bounded scheduler timer work');timers.delete(next[0]);now=next[1].at;next[1].fn();await flush();}now=target;await flush();}};
}
const result={changed:false,status:'unavailable'};
try{
 assert.equal(CONDITION_REFRESH_LIMITS.automatic,8);
 assert.equal(CONDITION_REFRESH_LIMITS.concurrent,2);
 assert.equal(CONDITION_REFRESH_LIMITS.intervalMs,8000);
 {
  const time=clock(),scheduler=createConditionRefreshScheduler(time),calls=[],a=gate(),b=gate();
  const auto=scheduler.request('auto',()=>{calls.push(['auto',time.now()]);return b.promise;},{source:'collection'});
  const explicit=scheduler.request('saved-tail',()=>{calls.push(['saved-tail',time.now()]);return a.promise;},{source:'saved'});
  const later=scheduler.request('auto-2',()=>{calls.push(['auto-2',time.now()]);return result;},{source:'collection'});
  await time.tick();assert.deepEqual(calls,[['saved-tail',0]],'a saved tail lot bypasses automatic backlog');
  await time.tick(7999);assert.equal(calls.length,1);
  await time.tick(1);assert.deepEqual(calls[1],['auto',8000]);assert.equal(scheduler.state().active,2);
  await time.tick(8000);assert.equal(calls.length,2,'two in-flight requests are the ceiling');
  a.resolve(result);await time.tick();assert.deepEqual(calls[2],['auto-2',16000]);b.resolve(result);await Promise.all([auto,explicit,later]);await flush();
  assert.equal(scheduler.state().automaticStarted,2);
 }
 {
  const time=clock(),scheduler=createConditionRefreshScheduler({...time,intervalMs:0}),requests=[];
  for(let i=0;i<12;i++)requests.push(scheduler.request('automatic-'+i,()=>result,{source:'collection'}));
  for(let i=0;i<40;i++){await time.tick();requests.push(scheduler.request('explicit-'+i,()=>result,{source:'search'}));}
  await time.tick();const all=await Promise.all(requests);
  assert.equal(scheduler.state().automaticStarted,8);assert.equal(scheduler.state().started,48,'explicit Search/save/review have no new24-request cap');
  assert.equal(all.filter(r=>r.reason==='automatic-budget').length,4);
 }
 {
  const time=clock(),scheduler=createConditionRefreshScheduler({...time,intervalMs:0,maxPending:2}),calls=[];
  const first=scheduler.request('first',()=>{calls.push('first');return result;},{source:'collection'});
  const evicted=scheduler.request('evicted',()=>{calls.push('evicted');return result;},{source:'collection'});
  const explicit=scheduler.request('review',()=>{calls.push('review');return result;},{source:'review'});
  assert.equal((await evicted).reason,'explicit-priority');assert.equal(scheduler.has('evicted'),false);
  await time.tick();await Promise.all([first,explicit]);assert.deepEqual(calls,['review','first']);assert.equal(scheduler.state().automaticStarted,1);
  const stale=scheduler.request('stale',()=>{throw Error('Retired context ran');},{source:'collection',current:()=>false});
  await time.tick();assert.equal((await stale).reason,'context-changed');assert.equal(scheduler.state().automaticStarted,1);assert(!scheduler.has('stale'));
 }
 {
  const time=clock(),scheduler=createConditionRefreshScheduler({...time,intervalMs:0}),hold=gate();let starts=0;
  const a=scheduler.request('same-product',()=>{starts++;return hold.promise;},{source:'collection'});
  const b=scheduler.request('same-product',()=>{throw Error('Duplicate provider request');},{source:'review'});
  await time.tick();assert.equal(starts,1);assert.equal(scheduler.state().automaticStarted,0,'queued product promoted to explicit work');
  hold.resolve({changed:true,status:'available',rawQuotes:[]});assert.equal((await a).changed,true);assert.equal((await b).reused,true);
  assert.equal((await scheduler.request('same-product',()=>{throw Error('Repeated completed request');})).changed,false);
 }
 {
  const time=clock(),scheduler=createConditionRefreshScheduler({...time,intervalMs:0});let calls=0;
  const first=scheduler.request('deadline',()=>{calls++;return {status:'rate_limited',reason:'provider_shared_limit',retryAfterMs:60000,nextRetryAt:1000};});
  await time.tick();assert.equal((await first).nextRetryAt,1000);
  await time.tick(500);
  const reused=await scheduler.request('deadline',()=>{throw Error('Duplicate blocked lookup');});assert.equal(reused.nextRetryAt,1000);
  const queued=await scheduler.request('other',()=>{throw Error('Provider cooldown was bypassed');});assert.equal(queued.nextRetryAt,1000);assert.equal(queued.retryAfterMs,500);
  await time.tick(501);assert.equal(calls,1,'Deadline expiry never starts a background provider request');
  const recovered=scheduler.request('deadline',()=>{calls++;return {status:'available'};});await time.tick();assert.equal((await recovered).status,'available');assert.equal(calls,2,'Absolute deadline, not stale relative duration, controls explicit recovery');
 }
 for(const status of ['not_configured','rate_limited']){
  const time=clock(),scheduler=createConditionRefreshScheduler({...time,retryMs:1000,intervalMs:0});let calls=0;
  const first=scheduler.request('blocked',()=>{calls++;return {changed:false,status};});
  const pending=scheduler.request('pending',()=>{calls++;return result;},{source:'collection'});
  await time.tick();assert.equal((await first).status,status);assert.equal((await pending).reason,status);assert.equal(calls,1);
  assert.equal((await scheduler.request('other',()=>{calls++;return result;})).reason,status);
  await time.tick(1001);assert.equal(calls,1,'no timer-driven provider retries');assert.equal(scheduler.canScheduleCollection(),false);
  const retry=scheduler.request('blocked',()=>{calls++;return result;},{source:'search'});await time.tick();await retry;assert.equal(calls,2,'later explicit work can recover after cooldown');
 }
 {
  const time=clock(),scheduler=createConditionRefreshScheduler({...time,retryMs:1000,intervalMs:0,cacheEntries:2});let calls=0;
  const run=()=>{calls++;return result;};
  const first=scheduler.request('a',run);await time.tick();await first;await scheduler.request('a',run);assert.equal(calls,1);
  await time.tick(1001);const retry=scheduler.request('a',run);await time.tick();await retry;assert.equal(calls,2,'completed dedup expires at existing attempt window');
  for(const key of ['b','c']){const p=scheduler.request(key,run);await time.tick();await p;}
  assert.equal(scheduler.has('a'),false);assert(scheduler.has('b')&&scheduler.has('c'),'completed result cache is bounded');
 }
 console.log('PASS: explicit priority,8 passive starts, no new explicit quota,2 concurrent,8sec pacing, pending backpressure, dedup, cooldown and bounded cache TTL.');

 {
  const lots=Array.from({length:140},(_,i)=>({id:'lot-'+i,cardId:'card-'+i,condition:'Lightly Played'})),visited=new Set();let cursor='';
  for(let session=0;session<30;session++){
   const attempted=new Set();
   for(let pass=0;pass<2;pass++){
    const choice=selectConditionLots(lots,{cursor,visibleIds:new Set(lots.slice(0,10).map(e=>e.id)),eligible:e=>!attempted.has(e.id)});
    cursor=choice.cursor;
    for(const entry of choice.entries){visited.add(entry.id);attempted.add(entry.id);}
   }
   assert(attempted.size<=8);
  }
  assert(visited.has('lot-139'),'cursor reaches tail beyond100 even when visible requests always fail across sessions');
  const tail=selectConditionLots(lots,{visibleIds:new Set(['lot-139'])});assert.equal(tail.entries[0].id,'lot-139');assert.equal(tail.entries[1].id,'lot-0');
  assert.equal(selectConditionLots(lots,{cursor:'deleted-lot',visibleIds:new Set()}).entries[0].id,'lot-0');
  assert.equal(conditionCursorKey('ptcg'),'cardstashy-condition-cursor:ptcg');
  const before={collection:lots,tcg:{ptcg:{collection:[]},ygo:{collection:[]}}},after=structuredClone(before);
  after.collection[139].condition='Damaged';after.collection[0].qty=10;
  after.tcg.ptcg.collection.push({id:'pokemon-tail',cardId:'pokemon',variant:'holofoil'});
  after.tcg.ygo.collection.push({id:'ygo-tail',cardId:'ygo',printing:'SET-001',rarity:'Rare',edition:'unlimited'});
  assert.deepEqual(changedConditionLots(before,after).map(x=>[x.game,x.entry.id]),[['mtg','lot-139'],['ptcg','pokemon-tail'],['ygo','ygo-tail']]);
  after.collection[139].conditionQuotes=[{price:4}];assert.equal(conditionLotIdentity(after.collection[139]),conditionLotIdentity({...after.collection[139],conditionQuotes:[]}),'quote writes do not trigger recursive pricing');
 }
 console.log('PASS: visible+fair cursor advances beyond100 across failing sessions; all-game new/changed lot detection ignores quantity and quote-only writes.');

 const quote=(condition,price,extra={})=>({condition,price,currency:'USD',priceStatus:'current',validUntil:new Date(Date.now()+86400000).toISOString(),...extra});
 for(const game of ['mtg','ptcg','ygo']){
  const card={id:'dedup-'+game},entry={condition:'Lightly Played',language:'en',...(game==='mtg'?{finish:'nonfoil'}:game==='ptcg'?{cardId:card.id,variant:'normal'}:{cardId:card.id,printing:'TEST-001',rarity:'Rare',edition:'unlimited'})};
  const time=clock(),scheduler=createConditionRefreshScheduler({...time,intervalMs:0});let calls=0;
  const url=conditionRequest(card,entry,game),other={...entry,condition:'Damaged',...(game==='mtg'?{printingId:card.id,printingVerified:true}:{})};
  assert.equal(conditionRequest(card,other,game),url,'conditions and local binding IDs do not create provider requests');
  const a=scheduler.request(url,()=>loadConditionQuotes(card,entry,game,async()=>{calls++;return Response.json({status:'available',quotes:[quote('Lightly Played',7),quote('Damaged',2)]});}));
  const b=scheduler.request(url,()=>{throw Error('Duplicate');});await time.tick();await a;
  const freshObject={id:card.id},data=await b;applyConditionQuotes(freshObject,other,data.rawQuotes);
  assert.equal(calls,1);assert.equal(conditionValue(null,entry,card.conditionQuotes).price,7);assert.equal(conditionValue(null,other,freshObject.conditionQuotes).price,2);
  assert.equal(conditionValue(null,{...other,language:'ja'},freshObject.conditionQuotes).price,null);
 }
 {
  const card={id:'strict'},entry={cardId:'strict',condition:'Damaged',variant:'normal',language:'en'};
  const data=await loadConditionQuotes(card,entry,'ptcg',async()=>Response.json({status:'available',quotes:[
   quote('Damaged',99,{currency:'EUR'}),quote('Damaged',98,{language:'ja'}),quote('Damaged',97,{variant:'holofoil'}),quote('Damaged',96,{cardId:'other'}),quote('Damaged',null),quote('Damaged',95,{validUntil:'2000-01-01'}),quote('Near Mint',100)]}));
  assert.equal(data.quotes.length,1);assert.equal(conditionValue(null,entry,card.conditionQuotes).price,null,'NM,foreign currency,wrong identity and stale rows never substitute for a damaged quote');
  const r=await loadConditionQuotes({id:'http429'},{cardId:'http429'},'ptcg',async()=>new Response('',{status:429}));assert.equal(r.status,'rate_limited');
 }
 console.log('PASS: all-game exact product fan-out across conditions/card objects; conflicting identity/currency/expiry/condition refusal and HTTP429 classification.');

 {
  const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.document={querySelector:()=>null,addEventListener(){},getElementById:()=>null};
  S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.scan={};S.ui.sheetCtx=null;
  const card={id:'review-card',game:'ptcg',name:'Review fixture',variants:[{key:'normal'},{key:'holofoil'}]},c={id:card.id,name:card.name,card,exact:true};
  const row=id=>({id,captureRevision:'r1',game:'ptcg',cands:[structuredClone(c)],selectedIndex:0,status:'review',finish:'normal',qty:1,condition:'Lightly Played',lang:'en'});
  saveBatch([row('capture-A'),row('capture-B')]);let renders=0,currentPrice=null;const requests=[];
  const ctx={A:{},C:{},render:()=>renders++,toast(){},game:()=>S.state.settings.game,priceOf:()=>currentPrice,setOf:()=>'',numberOf:()=>'',requestConditionPrice:(...args)=>requests.push(args)};
  registerScanner(ctx);assert.equal(requests.length,0,'register/render/camera paths do not request condition pricing');
  ctx.A.scanBatchReview({dataset:{id:'capture-A'}});assert.equal(requests[0][0],'ptcg','review uses capture game,not global game');
  ctx.A.scanConfirmCondition({dataset:{condition:'Damaged'}});assert.equal(requests.length,2);assert.equal(requests[1][3].condition,'Damaged');
  const oldRender=renders;currentPrice=7;requests[0][4]({status:'available'});assert.equal(renders,oldRender);assert.equal(S.ui.scan.confirm.price,null,'old selection callback does not price changed condition');
  requests[1][4]({status:'available'});assert.equal(S.ui.scan.confirm.price,7);
  ctx.C.scanConfirmLanguage({value:'ja'});const ja=requests.at(-1);assert.equal(ja[3].language,'ja');
  ctx.C.scanConfirmFinish({value:'holofoil'});const foil=requests.at(-1);assert.equal(foil[2],'holofoil');assert.equal(ja[5](),false);
  saveBatch(loadBatch().map(x=>x.id==='capture-A'?{...x,captureRevision:'r2'}:x));assert.equal(foil[5](),false,'replacement pixels retire old revision');
  ctx.A.scanBatchReview({dataset:{id:'capture-B'}});const b=requests.at(-1),qb=S.ui.scan.confirm;const before=renders;foil[4]({status:'available'});assert.equal(S.ui.scan.confirm,qb);assert.equal(renders,before,'A cannot touch B');
  S.ui.sheetCtx={type:'other'};assert.equal(b[5](),false,'different review context retires callback');S.ui.sheetCtx=null;
  ctx.A.scanDismiss();const closed=renders;b[4]({status:'available'});assert.equal(S.ui.scan.confirm,null);assert.equal(renders,closed,'late completion does not reopen review');
 }
 console.log('PASS: actual scanner explicit hooks bind capture game,condition/finish/language,revision,candidate and current review context; late A/B/dismiss callbacks are inert.');

 const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
 assert(!app.includes('lots.slice(0,100)'));
 assert.match(app,/try \{ await writeRecords\(records,accountStorageOptions\(\)\); \}\s*catch \(error\) \{ workspaceTransition\?\.failed\(transition\); throw error; \}\s*S\.state = valid;\s*workspaceTransition\?\.finished\(transition\);\s*if\(!scopeCurrent\(\)\)throw Error\([^;]+;\s*const changedLots = changedConditionLots/,'newlot scheduling follows successful persistence');
 assert.match(app,/await queueWorkspaceWrite\(async\(\)=>\{/,'condition persistence joins workspace write queue');
 console.log('PASS: condition scheduling hooks are post-commit and quote persistence is serialized.');
{
const segment=(from,to)=>{const start=app.indexOf(from),end=app.indexOf(to,start);assert(start>=0&&end>start,`Missing controller segment ${from}`);return app.slice(start,end);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(r=>setTimeout(r,0));
async function until(check){for(let i=0;i<100;i++){if(check())return;await flush();}assert.fail('Controller fixture did not reach expected boundary');}
let serial=0;
function harness(){
 const id='controller-condition-'+(++serial),card={id,name:'Fixture '+id,finishes:['nonfoil','foil'],prices:{usd:'10'}};
 const lot={id:'same-lot',name:card.name,qty:1,printingId:id,printingVerified:true,finish:'nonfoil',language:'en',condition:'Lightly Played'};
 const initial={collection:[lot],printings:{[id]:card},settings:{},tcg:{ptcg:{collection:[]},ygo:{collection:[]}}};
 const disk=new Map([['workspace',structuredClone(initial)]]),body=deferred(),firstWrite=deferred(),releaseWrite=deferred();
 let storageQueue=Promise.resolve(),writes=0,networkCalls=0,quoteCallbacks=0,homeRefreshes=0;
 const scheduled=[];
 const c={S:{state:initial,catalog:{[card.name.toLowerCase()]:card},ui:{view:'scan'}},navigator:{onLine:true},structuredClone,Date,Promise,CONDITION_IDENTITY,conditionRequest,applyConditionQuotes,conditionValue,changedConditionLots,conditionLotIdentity,
  createConditionRefreshScheduler:()=>createConditionRefreshScheduler({intervalMs:0}),
  loadConditionQuotes:(card,entry,game)=>loadConditionQuotes(card,entry,game,async()=>{networkCalls++;return {ok:true,json:()=>body.promise};}),
  key:s=>String(s).toLowerCase(),meta:name=>c.S.catalog[String(name).toLowerCase()],T:{game:()=> 'mtg',gs:game=>c.S.state.tcg[game],cardOf:()=>null,persistQuoteCache(){},currentYgoCatalogue:()=>[]},
  recordHomeDeckWork,normalize:s=>s,stripCache:s=>s,STORAGE:'workspace',RECOVERY:'recovery',blank:()=>({collection:[],printings:{},settings:{},tcg:{ptcg:{collection:[]},ygo:{collection:[]}}}),
  writeRecords(records){const snapshots=structuredClone(records);const transaction=async()=>{if(++writes===1){firstWrite.resolve();await releaseWrite.promise;}for(const[k,v]of snapshots)disk.set(k,v);};const result=storageQueue.then(transaction,transaction);storageQueue=result.catch(()=>{});return result;},
  writeRecord:(key,value)=>c.writeRecords([[key,value]]),afterLocalSave(){},refreshHomeValueGlance(){homeRefreshes++;},saveCatalogSoon(){},setSaveStatus(){},render(){},refreshSheet(){},haptic(){},flyToCollection(){},toast(){},autoEnrich(){},lastActTarget:null,
  setTimeout(fn,ms){scheduled.push({fn,ms});return scheduled.length;}
 };
 Object.assign(c,{cloudInfo:c.cloudInfo||(()=>({configured:false})),createAccountWorkspaces:()=>({guard:null}),readRecord:c.readRecord|| (async()=>null)});
vm.createContext(c);
 vm.runInContext(segment('function save(','// Transactional change:')+segment('let lastUndo =','const safely =')+segment('let conditionScheduler=','let magicPriceRefresh='),c);
 return {c,card,lot,disk,scheduled,firstWrite,releaseWrite,start:()=>c.fetchConditionValue(card,lot,'mtg',()=>quoteCallbacks++,{source:'review'}),resolveQuote:()=>body.resolve({status:'available',quotes:[{condition:'Lightly Played',price:7.25,currency:'USD',priceStatus:'current',validUntil:new Date(Date.now()+86400000).toISOString()}]}),get networkCalls(){return networkCalls;},get writes(){return writes;},get quoteCallbacks(){return quoteCallbacks;},get homeRefreshes(){return homeRefreshes;}};
}
{
 const h=harness(),quote=h.start();await until(()=>h.networkCalls===1);
 const edit=h.c.commit(s=>{s.collection[0].qty=4;s.collection[0].location='Changed while quote pending';},{enrich:false,rerender:false});
 await h.firstWrite.promise;h.resolveQuote();await flush();assert.equal(h.writes,1,'Quote persistence waits behind the in-flight edit');
 h.releaseWrite.resolve();await Promise.all([edit,quote]);
 for(const state of [h.c.S.state,h.disk.get('workspace')]){assert.equal(state.collection[0].qty,4);assert.equal(state.collection[0].location,'Changed while quote pending');assert.equal(state.collection[0].conditionQuotes[0].price,7.25);}
 assert.equal(h.writes,2);assert.equal(h.scheduled.length,0,'Price attachment and quantity/location-only edit do not recursively queue condition refreshes');assert.equal(h.networkCalls,1);assert.equal(h.quoteCallbacks,1);assert.equal(h.homeRefreshes,1,'Canonical quote changes notify the scoped Home glance even after the requesting view changes');
 console.log('PASS: actual quote completion serializes after an in-flight collection edit without overwriting quantity/location, and does not recursively schedule refreshes.');
}
{
 const h=harness(),quote=h.start();await until(()=>h.networkCalls===1);
 const edit=h.c.commit(s=>{s.collection[0].qty=3;},{enrich:false,rerender:false});await h.firstWrite.promise;
 const replacement=structuredClone(h.c.S.state);replacement.collection[0].qty=9;replacement.collection[0].location='Restored workspace';
 const restore=h.c.replaceWorkspace(replacement);h.resolveQuote();await flush();h.releaseWrite.resolve();await Promise.all([edit,restore,quote]);
 for(const state of [h.c.S.state,h.disk.get('workspace')]){assert.equal(state.collection[0].qty,9);assert.equal(state.collection[0].location,'Restored workspace');assert.equal(state.collection[0].conditionQuotes,undefined);assert.equal(state.printings[h.card.id].conditionQuotes,undefined);}
 assert.equal(h.writes,2,'A completion predating restore does not persist a third stale snapshot');assert.equal(h.quoteCallbacks,0);assert.equal(h.scheduled.length,0);
 console.log('PASS: actual queued restore of even the same lot ID/printing retires old quote completion, preserving replacement state and preventing stale callbacks.');
}
{
 const h=harness(),quote=h.start();await until(()=>h.networkCalls===1);
 const edit=h.c.commit(s=>{s.collection[0].finish='foil';s.collection[0].language='ja';},{enrich:false,rerender:false});await h.firstWrite.promise;h.resolveQuote();await flush();h.releaseWrite.resolve();await Promise.all([edit,quote]);
 for(const state of [h.c.S.state,h.disk.get('workspace')]){assert.equal(state.collection[0].finish,'foil');assert.equal(state.collection[0].language,'ja');assert.equal(state.collection[0].conditionQuotes,undefined);}
 assert.equal(h.writes,1,'A quote for old finish/language does not save a stale lot');assert.equal(h.scheduled.length,1,'Only the explicit identity edit schedules a saved-lot refresh');
 console.log('PASS: actual same-ID finish/language edit rejects old quote attachment without extra workspace write or recursive refresh hook.');
}
{
 const h=harness(),quote=h.start();await until(()=>h.networkCalls===1);
 const reset=h.c.replaceWorkspace(h.c.blank());await h.firstWrite.promise;h.resolveQuote();await flush();h.releaseWrite.resolve();await Promise.all([reset,quote]);
 assert.equal(h.c.S.state.collection.length,0);assert.equal(h.disk.get('workspace').collection.length,0);assert.equal(h.writes,1);assert.equal(h.quoteCallbacks,0);assert.equal(h.networkCalls,1);
 console.log('PASS: actual reset while a condition request is pending never resurrects a collection lot or writes a stale snapshot.');
}

}
{
const source=app.slice(app.indexOf('let conditionScheduler='),app.indexOf('function refreshChangedConditions('));
const card={id:'88000001',game:'ygo',name:'Synthetic reused-code card',sets:[{code:'SET-EN001',rarity:'Rare'}]};let raw=card,resolve,requests=0,callbacks=0;
const response=new Promise(r=>resolve=r),entry={cardId:card.id,printing:'SET-EN001',rarity:'Rare',edition:'unlimited',language:'en',condition:'Lightly Played',setReleaseId:'release-A',setReleaseUnverified:false};
const context={S:{state:{collection:[],tcg:{ygo:{collection:[]}}},ui:{}},navigator:{onLine:true},conditionWorkspaceRevision:0,CONDITION_IDENTITY,conditionRequest,applyConditionQuotes,conditionValue,createConditionRefreshScheduler:()=>createConditionRefreshScheduler({intervalMs:0}),loadConditionQuotes:(...args)=>loadConditionQuotes(...args,async()=>{requests++;return {ok:true,json:()=>response};}),queueWorkspaceWrite:fn=>fn(),key:s=>s,meta:()=>null,T:{cardOf:()=>raw,currentYgoCatalogue:()=>[],setContextCard:()=>({setContext:{status:'resolved',printings:raw.sets}}),gs:()=>({collection:[]}),persistQuoteCache(){}}};
vm.createContext(context);vm.runInContext(source,context);
const pending=context.fetchConditionValue(card,entry,'ygo',()=>callbacks++);
for(let i=0;i<100&&!requests;i++)await new Promise(r=>setTimeout(r,0));assert.equal(requests,1);
raw={...card,sets:[...card.sets,{code:'SET-EN001',rarity:'Rare'}]};
resolve({status:'available',quotes:[{condition:'Lightly Played',price:99,currency:'USD',priceStatus:'current',validUntil:new Date(Date.now()+86400000).toISOString()}]});
const result=await pending;assert.equal(result.reason,'unverified-selection');assert.equal(callbacks,0);
assert.equal(conditionValue(null,entry,card.conditionQuotes||[]).price,null);
assert.equal(card.conditionQuotes?.length||0,0,'Revalidation must prevent mutation of the original candidate, not merely suppress its callback.');
console.log('PASS: newly ambiguous inflight release never mutates stale scanner/canonical quote objects.');

}
}finally{Object.assign(globalThis,original);}
