// Execute the production cloud orchestration twice against one synthetic server.
// Each VM is an independent browser/device, with independent auth, metadata and state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mergeAccountWorkspaces,workspaceContentSig} from './sync-merge.js';
import {createRecoverySnapshot,appendRecoverySnapshot,readRecoverySnapshots,createSyncBaseline} from './recovery-store.js';
import {createAccountWorkspaces,ACCOUNT_OWNER} from './account-workspaces.js';
import {writeRecords,readRecord} from './storage.js';
const source=fs.readFileSync('cloud.js','utf8').replace(/^import .*?;\n/gm,'').replace(/\bexport /g,'');
const copy=x=>x===undefined?undefined:structuredClone(x),plain=x=>JSON.parse(JSON.stringify(x));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const ws=()=>({version:3,collection:[{id:'lot',qty:2}],decks:[{id:'a',name:'A',cards:[{name:'Card',qty:1}]},{id:'b',name:'B',cards:[]}],settings:{game:'mtg',budget:25},valueHistory:[]});
function server(state=ws()){
 const rows=new Map([['owner',{data:copy(state),revision:1}]]),writes=[];
 return {rows,writes,beforeWrite:null,failReads:false};
}
async function device(db,{owner='owner',state=copy(db.rows.get(owner)?.data||ws()),metaRevision=1,noBaseline=false,accountFirst=true}={}){
 let local=state,session={user:{id:owner}},authEvent,baseline=noBaseline?null:createSyncBaseline(owner,metaRevision,state),journal=null;
 const timers=[],events=[],controls={canSyncGate:null,backupGate:null,applyGate:null,baselineGate:null,failBackup:false,failBaseline:false,current:true},storage=new Map();
 const context={console,structuredClone,URLSearchParams,Date,Math,JSON,Map,Set,Number,String,Promise,Error,RegExp,mergeAccountWorkspaces,workspaceContentSig,SUPABASE:{url:'https://synthetic.invalid',key:'test'},timedFetch:()=>{},createPasswordAuth:()=>{},authError:e=>String(e),navigator:{onLine:true,userAgent:'Synthetic browser'},document:{visibilityState:'visible',addEventListener(name,fn){events.push([name,fn]);}},window:{addEventListener(name,fn){events.push([name,fn]);}},location:{search:'',hash:'#home',origin:'https://synthetic.invalid',pathname:'/'},history:{replaceState(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async()=>({ok:true,json:async()=>({external:{email:true}})}),setTimeout(fn,delay){const id={fn,delay,cancelled:false};timers.push(id);return id;},clearTimeout(id){if(id)id.cancelled=true;},setInterval(){return {unref(){}};},clearInterval(){}};
 vm.createContext(context);vm.runInContext(source+"\nglobalThis.cloudInfo=cloudInfo;",context);
 storage.set('cardforge-cloud-v1',JSON.stringify({userId:owner,revision:metaRevision,sig:context.workspaceSig(state)}));
 const client={auth:{onAuthStateChange(fn){authEvent=fn;return {};},async getSession(){return {data:{session}};},async signOut(){session=null;authEvent('SIGNED_OUT',null);return {}; }},from(table){
  let target,revision,operation='read',data;const q={select(){return q;},eq(key,value){if(key==='user_id'||key==='id')target=value;if(key==='revision')revision=value;return q;},update(value){operation='update';data=copy(value);return q;},insert(value){operation='insert';data=copy(value);target=value.user_id;return q;},
   async maybeSingle(){if(db.failReads)throw Error('Network failed');return {data:table==='profiles'?null:copy(db.rows.get(target)||null)};},
   async single(){if(db.rows.has(target))return {error:{code:'23505',message:'duplicate'}};db.rows.set(target,{data:copy(data.data),revision:data.revision});db.writes.push({target,revision:data.revision,data:copy(data.data)});return {data:{revision:data.revision}};},
   async then(resolve){if(db.beforeWrite){const callback=db.beforeWrite;db.beforeWrite=null;await callback();}const old=db.rows.get(target);if(operation==='update'&&old?.revision!==revision)return resolve({data:[]});db.rows.set(target,{data:copy(data.data),revision:data.revision});db.writes.push({target,revision:data.revision,data:copy(data.data)});return resolve({data:[{revision:data.revision}]});}};return q;
 }};
 const hooks={accountFirst,getState:()=>local,canSync:async()=>{if(controls.canSyncGate)await controls.canSyncGate.promise;return controls.current;},changed(){},status(){},decide(){events.push(['decide']);},reconciled(){events.push(['reconciled']);},recovered(notice){events.push(['recovered',notice]);},readSyncBaseline:async()=>copy(baseline),saveSyncBaseline:async(id,revision,state)=>{const captured=createSyncBaseline(id,revision,state);if(controls.baselineGate)await controls.baselineGate.promise;if(controls.failBaseline)throw Error('Baseline storage full');baseline=captured;},backup:async(state,label,file,extra)=>{const snapshot=createRecoverySnapshot(state,{owner:extra?.owner||session?.user.id,label,...extra});if(controls.backupGate)await controls.backupGate.promise;if(controls.failBackup)throw Error('Recovery storage full');journal=appendRecoverySnapshot(journal,snapshot);events.push(['backup']);},apply:async(data,{current})=>{if(controls.applyGate)await controls.applyGate.promise;if(!current())return false;local=copy(data);events.push(['apply']);return {cloudBaseline:copy(data)};}};
 await context.initCloud(hooks,{createClient:()=>client,remotePollMs:0});
 // Disable only the startup timer; each scenario drives reconciliation explicitly.
 for(const timer of timers)if(timer.delay===0)timer.cancelled=true;
 return {c:context,controls,events,timers,get local(){return local;},set local(x){local=x;},get baseline(){return baseline;},get snapshots(){return readRecoverySnapshots(journal,owner);},get meta(){return context.cloudInfo().meta;},get status(){return context.cloudInfo().status;},sync:()=>context.startSync(),async switchTo(id){session={user:{id}};authEvent('SIGNED_IN',session);for(let i=0;i<10;i++)await Promise.resolve();},async runImmediate(){const batch=timers.filter(t=>!t.cancelled&&t.delay===0);for(const t of batch){t.cancelled=true;await t.fn();}for(let i=0;i<12;i++)await Promise.resolve();}};
}
{
 const db=server(),pc=await device(db),phone=await device(db);await pc.sync();await phone.sync();
 pc.local.decks[0].name='PC A';await pc.sync();assert.equal(db.rows.get('owner').revision,2);
 phone.local.decks[1].name='Phone B';await phone.sync();assert.deepEqual(phone.local.decks.map(d=>d.name),['PC A','Phone B']);assert.equal(phone.c.cloudInfo().pending,null);assert.equal(phone.snapshots.length,1);assert.equal(phone.baseline.revision,2);assert.equal(phone.baseline.state.decks[1].name,'B','baseline records remote, not merged unsent state');
 await phone.sync();await pc.sync();assert.deepEqual(pc.local.decks.map(d=>d.name),['PC A','Phone B']);assert.equal(db.rows.get('owner').revision,3);
}
{
 const db=server(),pc=await device(db),phone=await device(db);pc.local.decks[0].name='PC same deck';await pc.sync();phone.local.decks[0].name='Phone same deck';await phone.sync();
 assert.equal(phone.local.decks[0].name,'PC same deck');assert.equal(phone.snapshots[0].state.decks[0].name,'Phone same deck');assert.match(phone.status.recoveryNotice,/Recovery/);assert(phone.events.some(e=>e[0]==='recovered'));assert.equal(phone.c.cloudInfo().pending,null);
 // Later ordinary adoption must not overwrite the older conflicting version.
 pc.local.decks[1].name='PC next';await pc.sync();await phone.sync();assert(phone.snapshots.some(s=>s.state.decks[0].name==='Phone same deck'));
}
{
 const db=server(),pc=await device(db),phone=await device(db);pc.local.decks.shift();await pc.sync();phone.local.valueHistory=[{date:'2026-10-18',total:4,copies:2}];phone.local.settings.game='ptcg';await phone.sync();
 assert.deepEqual(phone.local.decks.map(d=>d.id),['b']);assert.equal(phone.local.settings.game,'ptcg');assert.equal(phone.local.valueHistory.length,1);assert.equal(phone.c.cloudInfo().pending,null);
}
{
 const db=server(),pc=await device(db),phone=await device(db);pc.local.decks[0].name='Remote';await pc.sync();phone.local.decks[0].name='Keep me';phone.controls.failBackup=true;await phone.sync();
 assert.equal(phone.local.decks[0].name,'Keep me');assert.equal(phone.meta.revision,1);assert.equal(phone.status.state,'error');assert.equal(phone.snapshots.length,0);assert(!phone.events.some(e=>e[0]==='apply'));
}
{
 const db=server(),pc=await device(db),phone=await device(db);pc.local.decks[0].name='Remote';await pc.sync();phone.local.decks[1].name='Before wait';phone.controls.backupGate=deferred();const run=phone.sync();while(!phone.events.length&&phone.controls.backupGate)await Promise.resolve();
 // Wait until backup is pending, then create a newer local edit.
 for(let i=0;i<10;i++)await Promise.resolve();phone.local=copy(phone.local);phone.local.decks[1].name='During backup';phone.controls.backupGate.resolve();await run;
 assert.equal(phone.local.decks[1].name,'During backup');assert(!phone.events.some(e=>e[0]==='apply'));phone.controls.backupGate=null;await phone.runImmediate();await phone.sync();assert.equal(phone.local.decks[1].name,'During backup');assert.equal(phone.local.decks[0].name,'Remote');
}
{
 const db=server(),phone=await device(db);phone.local.decks[0].name='Uploaded';phone.controls.baselineGate=deferred();const run=phone.sync();while(db.writes.length===0)await Promise.resolve();phone.local=copy(phone.local);phone.local.decks[0].name='After upload';phone.controls.baselineGate.resolve();await run;
 assert.equal(phone.baseline.state.decks[0].name,'Uploaded');assert.equal(phone.local.decks[0].name,'After upload');assert.equal(phone.status.state,'syncing');phone.controls.baselineGate=null;await phone.sync();assert.equal(db.rows.get('owner').data.decks[0].name,'After upload');
}
{
 const db=server(),phone=await device(db);phone.local.decks[0].name='Server saved';phone.controls.failBaseline=true;await phone.sync();assert.equal(db.rows.get('owner').revision,2);assert.equal(phone.meta.revision,1);assert.equal(phone.status.state,'error');phone.controls.failBaseline=false;await phone.sync();assert.equal(phone.meta.revision,2);assert.equal(phone.status.state,'synced');
}
{
 const db=server(),pc=await device(db),phone=await device(db);phone.local.decks[1].name='Phone';db.beforeWrite=async()=>{pc.local.decks[0].name='PC raced';await pc.sync();};await phone.sync();assert.equal(phone.local.decks[0].name,'PC raced');assert.equal(phone.local.decks[1].name,'Phone');await phone.sync();assert.deepEqual(db.rows.get('owner').data.decks.map(d=>d.name),['PC raced','Phone']);
}
{
 const db=server(),phone=await device(db);phone.local.decks[0].name='Unsynced';phone.controls.current=false;await phone.sync();assert.equal(db.writes.length,0);assert.match(phone.status.msg,/Another tab/);
}
{
 const db=server(),phone=await device(db,{noBaseline:true});phone.local.decks[0].name='Old local';db.rows.get('owner').revision=2;db.rows.get('owner').data.decks[0].name='Cloud';await phone.sync();assert.equal(phone.local.decks[0].name,'Cloud');assert.equal(phone.snapshots[0].state.decks[0].name,'Old local');
 const rollback=await device(db,{metaRevision:3});rollback.local.decks[0].name='Changed';await rollback.sync();assert.equal(rollback.c.cloudInfo().pending.kind,'choose');
}
{
 const db=server(),pc=await device(db),phone=await device(db);db.rows.set('other',{data:ws(),revision:1});pc.local.decks[0].name='Remote';await pc.sync();phone.controls.applyGate=deferred();const run=phone.sync();for(let i=0;i<20;i++)await Promise.resolve();const before=copy(phone.local);await phone.switchTo('other');phone.controls.applyGate.resolve();await run;assert.deepEqual(phone.local,before);assert(!phone.events.some(e=>e[0]==='apply'));
}
{
 const db=server(),phone=await device(db);db.rows.set('other',{data:ws(),revision:1});phone.local.decks[0].name='Owner A';phone.controls.canSyncGate=deferred();const run=phone.c.pushNow();for(let i=0;i<5;i++)await Promise.resolve();await phone.switchTo('other');phone.local={...ws(),decks:[{id:'private-B',name:'Other account secret'}]};phone.controls.canSyncGate.resolve();await run;assert.equal(db.writes.length,0,'account changed while awaiting storage guard: no stale network request');assert.equal(db.rows.get('owner').data.decks[0].name,'A');
}
{
 const db=server(),pc=await device(db),phone=await device(db);phone.local.settings.game='ptcg';phone.local.activeDeck='b';await phone.sync();assert.equal(db.writes.length,0,'navigation does not dirty account');pc.local.decks[0].name='PC';await pc.sync();await phone.sync();assert.equal(phone.local.settings.game,'ptcg');const count=db.writes.length;for(let i=0;i<3;i++){await phone.sync();await pc.sync();}assert.equal(db.writes.length,count,'preserved device navigation cannot cause revision ping-pong');
}
{
 const db=server(),pc=await device(db),phone=await device(db);pc.local.decks[0].name='Cloud';await pc.sync();phone.local.decks[0].name='Recover this';await phone.sync();const recovered=copy(phone.snapshots[0].state);phone.local=recovered;await phone.sync();assert.equal(db.rows.get('owner').data.decks[0].name,'Recover this','restoring saved version is a fresh CAS account update');
}
{
 // Two real account vaults with the same owner still have distinct revision
 // fences. Same email is not permission for a stale tab to overwrite this tab.
 const stored=new Map([[ACCOUNT_OWNER,JSON.stringify({owner:'owner',revision:1})],['workspace',JSON.stringify(ws())]]);
 globalThis.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(name,fn)=>fn()}},configurable:true});
 const make=()=>createAccountWorkspaces({read:readRecord,write:writeRecords,getState:ws,blank:ws,normalize:x=>x,storage:'workspace',recovery:'recovery'});
 const first=make(),second=make();await first.switchTo('owner',null);await second.switchTo('owner',null);
 const changed=ws();changed.decks[0].name='First tab saved';await writeRecords([['workspace',changed]],{guardRecord:first.guard});assert.equal(await second.current(),false);
 await assert.rejects(()=>writeRecords([['workspace',ws()]],{guardRecord:second.guard}),/Another tab/);assert.equal((await readRecord('workspace')).decks[0].name,'First tab saved');
}
console.log('PASS: two actual cloud runtimes, independent and conflicting edits, deletion/history/navigation, durable recovery failure, edited-during-backup retry, exact upload baseline, failed baseline retry, CAS race, stale-tab fence, migration/rollback and account-switch guards.');
