import assert from 'node:assert/strict';
import {cachedImages,localStorageFootprint} from './settings-storage.js';
import {createRecoverySnapshot,appendRecoverySnapshot} from './recovery-store.js';
const requests=paths=>paths.map(path=>({url:'https://cardstashy.test/'+path}));
const shell=requests(['app.js','index.html','img/ygo/1.jpg','icon.svg','scanidx/ptcg.bin']);
const other=requests(['private-photo.jpg']);
const buckets=new Map([['cardforge-shell-v261',shell],['unrelated-cache',other]]),deleted=[];
const storage={keys:async()=>[...buckets.keys()],open:async name=>({keys:async()=>buckets.get(name),delete:async request=>{deleted.push(request.url);buckets.set(name,buckets.get(name).filter(x=>x!==request));return true;}})};
assert.deepEqual(await cachedImages({storage}),{available:true,count:2});assert.equal(deleted.length,0);
assert.deepEqual(await cachedImages({storage,clear:true}),{available:true,count:2});
assert.deepEqual(buckets.get('cardforge-shell-v261').map(x=>x.url.split('/').at(-1)),['app.js','index.html','ptcg.bin']);
assert.equal(buckets.get('unrelated-cache').length,1,'other cache namespaces remain intact');
assert.deepEqual(await cachedImages({storage:null,clear:true}),{available:false,count:0});
await assert.rejects(()=>cachedImages({storage:{keys:async()=>{throw Error('denied');}}}),/denied/);
const values=new Map([['settings','dark'],['pending','data:image/jpeg;abc']]);
assert.equal(localStorageFootprint({length:2,key:i=>[...values.keys()][i],getItem:k=>values.get(k)}),38);
let journal=null;
const state={collection:[{id:'a',qty:3}],settings:{game:'mtg'},valueHistory:[{total:9}],lastSavedAt:'one'};
for(let i=0;i<30;i++)journal=appendRecoverySnapshot(journal,createRecoverySnapshot({...state,lastSavedAt:String(i)},{owner:'A',id:String(i)}));
assert.equal(journal.snapshots.length,1,'timestamp-only account reloads do not add snapshots');
for(const patch of [{collection:[{id:'a',qty:4}]},{settings:{game:'ygo'}},{valueHistory:[{total:10}]}])journal=appendRecoverySnapshot(journal,createRecoverySnapshot({...state,...patch},{owner:'A'}));
assert.equal(journal.snapshots.length,4,'distinct cards, settings and history remain recoverable');
assert.equal(journal.snapshots.at(-1).state.collection[0].qty,3,'original copy remains exact');
console.log('PASS: image-only app-cache cleanup, read-only storage estimates, unavailable/denied APIs, timestamp dedupe and distinct recovery protection.');

const {readFileSync}=await import('node:fs');
const {default:vm}=await import('node:vm');
const source=readFileSync('app.js','utf8'),action=source.slice(source.indexOf('A.exportBackup = () => {'),source.indexOf('async function recoverySnapshot'));
for(const failed of [false,true]){
 const classes=new Set(),status={textContent:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},messages=[],files=[];
 const ctx={A:{},Date,document:{getElementById:()=>status},backupPayload:()=>{if(failed)throw Error('export failure');return 'exact-workspace';},download:(...args)=>files.push(args),toast:x=>messages.push(x)};
 vm.runInNewContext(action,ctx);ctx.A.exportBackup();
 assert.equal(files.length,failed?0:1);assert.equal(classes.has('success'),!failed);
 assert.match(status.textContent,failed?/could not be prepared/:/Check your downloads/);assert.equal(messages.length,1);
}
console.log('PASS: actual backup handler leaves persistent honest success/failure feedback.');

// Saving copy must not imply that paused/offline edits are already online.
const {settingsSaveCopy}=await import('./views.js');
const empty={lastSavedAt:null},stored={lastSavedAt:'2026-10-21T00:00:00Z'};
assert.equal(settingsSaveCopy({user:null},empty).label,'On this device');
assert.equal(settingsSaveCopy({user:null},stored).label,'Saved on this device');
assert.equal(settingsSaveCopy({user:null},stored,{state:stored,owner:null,text:'Not saved',cls:'bad'}).label,'Not saved');
assert.equal(settingsSaveCopy({user:{id:'B'},status:{state:'offline'}},stored,{state:stored,owner:'A',text:'Saved online',cls:'ok'}).detail,'Offline. New changes are waiting on this device.');
for(const state of ['offline','error','decide'])assert.doesNotMatch(settingsSaveCopy({user:{id:'A'},status:{state}},stored).detail,/are online|sync automatically/);
const {setFinishEffects}=await import('./finish-preview.js'),{setHaptics}=await import('./feel.js');
const previousStorage=globalThis.localStorage;
try{
 globalThis.localStorage={setItem(){throw Error('quota');},getItem(){return null;}};
 assert.equal(setFinishEffects(false),false);assert.equal(setHaptics(false),false);
 globalThis.localStorage={setItem(){},getItem(){return null;}};
 assert.equal(setFinishEffects(true),true);assert.equal(setHaptics(true),true);
}finally{globalThis.localStorage=previousStorage;}
console.log('PASS: current-owner save state, no false online claim, and explicit foil/haptics storage failure results.');

for(const text of ['Not saved','Saving…']){
 const copy=settingsSaveCopy({user:{id:'A'},status:{state:'synced'}},stored,{state:stored,owner:'A',text,cls:text==='Not saved'?'bad':''});
 assert.equal(copy.label,text);assert.doesNotMatch(copy.detail,/changes are online/);
}
console.log('PASS: local save failure/in-progress state overrides stale cloud success.');

// Exercise the actual status update path: both text lines change together and
// catalogue lookup failures cannot poison the workspace's save feedback.
const appSource=readFileSync('app.js','utf8'),statusAction=appSource.slice(appSource.indexOf('function setSaveStatus('),appSource.indexOf('// Glass look:'));
const headline={textContent:'',className:''},detail={textContent:''};
const saveState={lastSavedAt:'earlier'},ctx={S:{state:saveState,ui:{}},cloudInfo:()=>({user:{id:'A'},status:{state:'synced'}}),V:{settingsSaveCopy},document:{querySelectorAll:s=>s==='[data-settings-save-detail]'?[detail]:[headline]}};
vm.runInNewContext(statusAction,ctx);ctx.setSaveStatus('Not saved','bad');
assert.equal(headline.textContent,'Not saved');assert.match(detail.textContent,/could not be saved/);
const feedback=ctx.S.ui.saveFeedback;ctx.setSaveStatus('Lookup paused','bad');assert.equal(ctx.S.ui.saveFeedback,feedback);assert.equal(headline.textContent,'Not saved');
ctx.setSaveStatus('Saving…');assert.match(detail.textContent,/before sending/);
console.log('PASS: actual status updates keep the subtitle truthful and ignore non-save lookup status.');
const queued=settingsSaveCopy({user:{id:'A'},status:{state:'synced'}},stored,{state:stored,owner:'A',text:'Saved on this device · waiting to sync',cls:''});
assert.match(queued.detail,/Waiting to save/);assert.doesNotMatch(queued.detail,/changes are online/);
const updatedApp=readFileSync('app.js','utf8'),afterSave=updatedApp.slice(updatedApp.indexOf('function afterLocalSave()'),updatedApp.indexOf('let catalogTimer;'));
for(const phase of ['synced','syncing','local','offline','error','decide']){
 const labels=[],calls=[];
 const localCtx={cloudInfo:()=>({user:{id:'A'},status:{state:phase}}),refreshHomeValueGlance(){},setSaveStatus:text=>labels.push(text),statusLabel:()=>[phase+' status'],scheduleSync:()=>calls.push('queue')};
 vm.runInNewContext(afterSave,localCtx);localCtx.afterLocalSave();
 assert.equal(labels[0],['offline','error','decide'].includes(phase)?phase+' status':'Saved on this device · waiting to sync');assert.deepEqual(calls,['queue']);
}
console.log('PASS: actual afterLocalSave reports queued upload until cloud confirmation and preserves offline/error/conflict states.');
