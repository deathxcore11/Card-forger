import assert from 'node:assert/strict';
import {createAccountWorkspaces,ACCOUNT_OWNER,LEGACY_ARCHIVE,accountRecord} from './account-workspaces.js';
import {readRecord,writeRecords,writeRecord} from './storage.js';
import {setAccountScope,privateKey} from './account-scope.js';
import {loadBatch,saveBatch} from './scan-batch.js';
import {initCloud,cloudInfo,startSync,resolvePending,scheduleSync,signOut,workspaceSig} from './cloud.js';
import {passwordField,togglePassword} from './auth-form.js';
const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true,userAgent:'Isolation tests'},configurable:true});
globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.window={addEventListener(){}};
globalThis.location={search:'',hash:'',origin:'https://cardstashy.com',pathname:'/'};
globalThis.fetch=async()=>Response.json({external:{email:true}});
const empty=()=>({collection:[],decks:[],tcg:{},settings:{}});
const state=(name,avatar)=>({...empty(),collection:[{id:name,name,qty:1}],decks:[{id:name,name}],settings:{cardAvatar:avatar,binders:[{id:name}]}});
const A=state('A-only','A-art'),B=state('B-only','B-art'),guest=state('Guest-only','Guest-art');
let local=structuredClone(A);
const makeVault=()=>createAccountWorkspaces({read:readRecord,write:writeRecords,getState:()=>local,blank:empty,normalize:x=>x,storage:'workspace',recovery:'recovery'});
let vault=makeVault();
await writeRecord('recovery',{secret:'A recovery'});
const legacyMeta={userId:'A',revision:7,sig:workspaceSig(A)};
let result=await vault.switchTo('B',legacyMeta);local=result.state;
assert.deepEqual(local,empty(),'B never adopts the legacy A workspace');
assert.deepEqual((await readRecord(LEGACY_ARCHIVE)).state,A,'unchanged legacy snapshot survives migration');
assert.equal(await readRecord('recovery').then(x=>x.secret),undefined,'A recovery is not shown under B');
assert.equal(result.meta,null);
local=structuredClone(B);await writeRecord('workspace',local,{guardRecord:vault.guard});
result=await vault.switchTo('A',{userId:'B',revision:1,sig:workspaceSig(B)});local=result.state;
assert.deepEqual(local,A);assert.equal((await readRecord('recovery')).secret,'A recovery');
assert.equal(result.meta,null,'legacy shared workspace requires reconciliation, even with an old baseline');
result=await vault.switchTo(null,{userId:'A',revision:7,sig:workspaceSig(A)});local=result.state;
assert.deepEqual(local,empty(),'sign-out hides account cards and artwork');
local=structuredClone(guest);
result=await vault.switchTo('B',null);local=result.state;
assert.deepEqual(local,B,'sign-in restores B rather than importing guest cards');
assert.deepEqual(await vault.guest(),guest);
// Reload with B active, then return to A; scoped recovery and baselines survive.
vault=makeVault();result=await vault.switchTo('B',result.meta);local=result.state;
assert.deepEqual(local,B);assert.equal(result.meta.userId,'B');
result=await vault.switchTo('A',result.meta);local=result.state;assert.deepEqual(local,A);
// Another tab switches ownership. Stale edits cannot overwrite its active copy.
await writeRecord(ACCOUNT_OWNER,{owner:'B'});
await assert.rejects(writeRecord('workspace',A,{guardRecord:vault.guard}),/another tab/);
await assert.rejects(vault.switchTo('A',legacyMeta),/another tab/);
assert.deepEqual(await readRecord('workspace'),A,'guard failure performs no write');

// Pending captures are private, including the in-memory fallback and legacy queue.
localStorage.setItem('cardstashy-scan-batch-v1',JSON.stringify([{id:'A capture'}]));
setAccountScope('B','A');assert.deepEqual(loadBatch(),[]);
saveBatch([{id:'B capture'}]);setAccountScope('A','A');assert.equal(loadBatch()[0].id,'A capture');
setAccountScope('B');assert.equal(loadBatch()[0].id,'B capture');
assert.notEqual(privateKey('recovery'),'recovery');
await writeRecord(ACCOUNT_OWNER,{owner:'A'});
await vault.eraseArchived('B');assert.deepEqual((await readRecord(accountRecord('B'))).state,empty());assert.deepEqual(await vault.guest(),guest);assert.deepEqual((await readRecord(LEGACY_ARCHIVE)).state,A);
await assert.rejects(vault.eraseArchived('A'),/Sign out/);

// Run the actual cloud orchestration against two independent account rows.
storage.clear();local=structuredClone(guest);vault=makeVault();
const rows=new Map([['A',{data:A,revision:4}],['B',{data:B,revision:2}]]);
let event,session={user:{id:'A'}},writes=[],holdRead=null,releaseRead,holdBackup=false,releaseBackup;
const client={auth:{onAuthStateChange(fn){event=fn;},async getSession(){return {data:{session}};},async signOut(){session=null;event('SIGNED_OUT',null);return {}; }},from(table){
 let owner,revision,operation='read',data;
 const q={select(){return q;},eq(k,v){if(k==='user_id'||k==='id')owner=v;if(k==='revision')revision=v;return q;},update(d){operation='update';data=d;return q;},insert(d){operation='insert';data=d;owner=d.user_id;return q;},
  async maybeSingle(){const value={data:table==='profiles'?{display_name:owner}:structuredClone(rows.get(owner)||null)};if(table==='workspaces'&&holdRead===owner){holdRead=null;await new Promise(r=>releaseRead=r);}return value;},
  async single(){writes.push(owner);rows.set(owner,{data:structuredClone(data.data),revision:data.revision});return {data:{revision:data.revision}};},
  then(resolve){writes.push(owner);const old=rows.get(owner);if(operation==='update'&&old.revision!==revision)return resolve({data:[]});rows.set(owner,{data:structuredClone(data.data),revision:data.revision});resolve({data:[{revision:data.revision}]});}};return q;
 }};
await initCloud({getState:()=>local,changed(){},status(){},accountChanged(){},switchWorkspace:async(id,meta)=>{const r=await vault.switchTo(id,meta);local=r.state;return r;},apply:async(data,{current})=>{if(!current())return false;local=structuredClone(data);return true;},backup:async()=>{if(holdBackup){holdBackup=false;await new Promise(r=>releaseBackup=r);}},decide(){}},{createClient:()=>client});
const settle=async()=>{for(let n=0;n<20;n++){await new Promise(r=>setTimeout(r,0));if(!cloudInfo().switching)return;}throw Error('switch did not settle');};
await startSync();assert.deepEqual(local,A);assert.deepEqual(writes,[]);
await signOut();assert.deepEqual(local,guest);
session={user:{id:'B'}};event('SIGNED_IN',session);await settle();await startSync();assert.deepEqual(local,B);
local.collection[0].qty=3;await startSync();assert.equal(rows.get('B').data.collection[0].qty,3);assert.deepEqual(rows.get('A').data,A);
// Real pause: both copies changed; Later, manual sync, edits and reconnect cannot upload.
holdRead='B';releaseRead=null;const earlierSync=startSync();while(!releaseRead)await new Promise(r=>setTimeout(r,0));
rows.get('B').revision++;rows.get('B').data.collection[0].qty=9;local.collection[0].qty=4;
await startSync();assert.equal(cloudInfo().pending.kind,'conflict');await resolvePending('later');
const pausedDecision=cloudInfo().pending;assert.equal(pausedDecision.owner,'B');
releaseRead();await earlierSync;assert.equal(cloudInfo().pending,pausedDecision,'an older same-account read cannot clear a later pause');assert.equal(local.collection[0].qty,4);
const before=writes.length;local.collection[0].qty=5;scheduleSync();await startSync();
navigator.onLine=false;await startSync();navigator.onLine=true;await startSync();
assert.equal(writes.length,before);assert.equal(rows.get('B').data.collection[0].qty,9);assert.ok(cloudInfo().pending);
holdBackup=true;releaseBackup=null;const abandonedAdoption=resolvePending('account');while(!releaseBackup)await new Promise(r=>setTimeout(r,0));await resolvePending('later');releaseBackup();await abandonedAdoption;assert.equal(local.collection[0].qty,5,'Later cancels an adoption still preserving its backup');assert.equal(cloudInfo().pending,pausedDecision);
holdBackup=true;releaseBackup=null;const editedAdoption=resolvePending('account');while(!releaseBackup)await new Promise(r=>setTimeout(r,0));local.collection[0].qty=6;releaseBackup();await editedAdoption;assert.equal(local.collection[0].qty,6,'An edit during backup cannot be overwritten by an older cloud adoption');assert.equal(cloudInfo().pending.kind,'conflict');
await signOut();session={user:{id:'A'}};event('SIGNED_IN',session);await settle();await startSync();assert.deepEqual(local,A);await resolvePending('device',pausedDecision);assert.equal(writes.length,before,'an old account decision cannot resolve the current account');
// A response already in flight must not adopt data or baselines into another account.
rows.get('A').revision++;holdRead='A';releaseRead=null;const oldRead=startSync();while(!releaseRead)await new Promise(r=>setTimeout(r,0));
session={user:{id:'B'}};event('SIGNED_IN',session);await settle();releaseRead();await oldRead;await startSync();
assert.equal(local.collection[0].name,'B-only');assert.equal(local.settings.cardAvatar,'B-art');assert.equal(cloudInfo().meta.userId,'B');
await resolvePending('account');assert.equal(local.collection[0].qty,9);
await signOut();assert.deepEqual(local,guest);

// Visibility controls never submit or persist credentials.
assert.match(passwordField('<input id="pw" type="password">'),/type="button"/);
let attributes={},focused=false;const field={type:'password',selectionStart:2,selectionEnd:4,focus(){focused=true;},setSelectionRange(a,b){assert.deepEqual([a,b],[2,4]);}};
const button={dataset:{field:'pw',label:'password'},setAttribute(k,v){attributes[k]=v;}};
togglePassword(button,{querySelector:()=>field});assert.equal(field.type,'text');assert.equal(attributes['aria-label'],'Hide password');assert.ok(focused);
togglePassword(button,{querySelector:()=>field});assert.equal(field.type,'password');assert.equal(attributes['aria-pressed'],'false');
console.log('PASS: account A → sign-out → B → edit/reload → A, legacy preservation, private artwork/scans/recovery, guest separation, paused/manual/offline sync, stale responses, cross-tab write fence and password controls.');
