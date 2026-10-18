// Test the actual app transaction, account hooks and Recovery action wiring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {recoveryKey,syncBaselineKey,createRecoverySnapshot,appendRecoverySnapshot,readRecoverySnapshots,createSyncBaseline,recoverySummary} from './recovery-store.js';
const src=fs.readFileSync('app.js','utf8');
const between=(a,b)=>{const start=src.indexOf(a);assert(start>=0,a);const end=src.indexOf(b,start);assert(end>start,b);return src.slice(start,end);};
const transactions=between('function queueWorkspaceWrite(transaction)', 'async function commit(');
const saveAction=between('function save({queued=false}', '// Transactional change:');
const mutationGuards=between('const mutationScope=', 'function scopedEditDeck(');
const baselineHook=between('    saveSyncBaseline:', '    reconciled:');
const backupHook=between('    backup: async (state,label,file,metadata={})', '    status:');
const recoveryActions=between('async function recoverySnapshot(id)', 'async function readBackup(file)');
const oldRestore=between('C.restoreBackup = async (t)', 'A.reset = async');
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const initial=()=>({collection:[{id:'mine',qty:3}],decks:[{id:'deck'}],settings:{game:'mtg'},tcg:{ptcg:{collection:[{id:'p',qty:2}],decks:[]}}});
function harness(){
 const records=new Map(),writes=[],writeOptions=[],downloads=[],prompts=[],events=[];let journalGate=null,failWrites=false,askGate=null;
 const c={console,structuredClone,Date,JSON,Map,Error,Promise,accountGeneration:1,accountLocked:false,conditionWorkspaceRevision:1,commitQueue:Promise.resolve(),S:{state:initial()},owner:'A',STORAGE:'workspace',RECOVERY:'recovery',lastUndo:null,workspaceTransition:null,
  A:{},C:{},recoveryKey,syncBaselineKey,createRecoverySnapshot,appendRecoverySnapshot,readRecoverySnapshots,createSyncBaseline,recoverySummary,
  cloudInfo:()=>({user:c.owner?{id:c.owner}:null}),normalize:x=>structuredClone(x),stripCache:x=>structuredClone(x),blank:()=>({collection:[],decks:[],settings:{}}),
  accountWorkspaces:{guard:{key:'owner-marker',value:{owner:'A',revision:1},advance:true}},accountStorageOptions:()=>({owner:c.owner}),readRecord:async key=>{if(journalGate&&key.startsWith('cardstashy-recovery-journal'))await journalGate.promise;return structuredClone(records.get(key)||null);},
  writeRecords:async (pairs,options)=>{writeOptions.push(options);if(failWrites)throw Error('Storage quota reached');for(const[k,v]of pairs){writes.push(k);records.set(k,structuredClone(v));}},writeRecord:async(k,v,options)=>c.writeRecords([[k,v]],options),
  afterLocalSave:()=>events.push('schedule-sync'),render:()=>events.push('render'),toast:text=>events.push(text),download:(...args)=>downloads.push(args),backupEnvelope:x=>({version:3,...structuredClone(x)}),fileSafe:x=>x.replace(/\W+/g,'_'),esc:x=>String(x),
  navigationReady:true,setSaveStatus(){},document:{getElementById:()=>null},ask:async text=>{prompts.push(text);if(askGate)await askGate.promise;return true;},sumQty:rows=>rows.reduce((n,x)=>n+x.qty,0),readBackup:async file=>({next:structuredClone(file),cache:{}}),slim:x=>x,saveCatalogSoon(){},};
 c.S.catalog={};vm.createContext(c);vm.runInContext(transactions+'\n'+mutationGuards+'\n'+saveAction+'\nconst extractedHooks={'+baselineHook+backupHook+'};globalThis.appHooks=extractedHooks;\n'+recoveryActions+'\n'+oldRestore,c);
 return {c,records,writes,writeOptions,downloads,prompts,events,set journalGate(x){journalGate=x;},set failWrites(x){failWrites=x;},set askGate(x){askGate=x;}};
}
{
 const h=harness(),original=structuredClone(h.c.S.state);await h.c.appHooks.backup(original,'Before account sync',false,{owner:'A',revision:7,reason:'account-conflict'});
 const journal=h.records.get(recoveryKey('A'));assert.equal(journal.snapshots[0].reason,'account-conflict');assert.equal(journal.snapshots[0].revision,7);assert.deepEqual(h.records.get('recovery'),original);assert.equal(h.downloads.length,0);
 await h.c.replaceWorkspace({collection:[],decks:[{id:'remote'}],settings:{}},{recovery:true});assert.equal(h.records.get(recoveryKey('A')).snapshots.length,1,'automatic replacement deduplicates identical already-durable recovery');assert(!h.writes.some(k=>k===recoveryKey('B')));
}
{
 const h=harness(),original=structuredClone(h.c.S.state);h.failWrites=true;await assert.rejects(()=>h.c.replaceWorkspace({collection:[],decks:[]},{recovery:true}),/quota/);assert.deepEqual(h.c.S.state,original);assert.equal(h.writes.length,0);assert.equal(h.events.length,0);
}
{
 const h=harness(),gate=deferred(),original=structuredClone(h.c.S.state);h.journalGate=gate;const run=h.c.replaceWorkspace({collection:[],decks:[{id:'old-account'}]},{recovery:true});for(let i=0;i<6;i++)await Promise.resolve();h.c.accountGeneration++;h.c.owner='B';gate.resolve();assert.equal(await run,false);assert.deepEqual(h.c.S.state,original);assert.equal(h.writes.length,0);
}
{
 const h=harness(),gate=deferred();h.c.commitQueue=gate.promise;const run=h.c.appHooks.saveSyncBaseline('A',9,initial());h.c.accountGeneration++;h.c.owner='B';gate.resolve();await assert.rejects(()=>run,/Account changed/);assert.equal(h.writes.length,0);
}
{
 const h=harness(),gate=deferred();h.journalGate=gate;const run=h.c.appHooks.backup(initial(),'Old account',false,{owner:'A'});for(let i=0;i<6;i++)await Promise.resolve();h.c.accountGeneration++;h.c.owner='B';gate.resolve();await assert.rejects(()=>run,/Account changed/);assert.equal(h.writes.length,0);assert.equal(h.downloads.length,0);
}
{
 const h=harness(),old={collection:[{id:'old',qty:9}],decks:[{id:'saved'}],settings:{}},snapshot=createRecoverySnapshot(old,{owner:'A',id:'restore-me'});h.records.set(recoveryKey('A'),appendRecoverySnapshot(null,snapshot));
 await h.c.A.restoreRecovery({dataset:{id:'restore-me'}});assert.equal(h.c.S.state.collection[0].id,'old');assert(h.c.S.state.lastSavedAt);assert(h.events.includes('schedule-sync'));assert.equal(h.records.get(recoveryKey('A')).snapshots.length,2);assert.match(h.prompts[0],/9 card copies/);
 await h.c.A.downloadRecovery({dataset:{id:'restore-me'}});assert.equal(h.downloads.length,1);assert.equal(JSON.parse(h.downloads[0][1]).collection[0].qty,9);
 h.c.owner='B';h.c.accountGeneration++;await h.c.A.downloadRecovery({dataset:{id:'restore-me'}});assert.equal(h.downloads.length,1,'another account cannot download prior owner recovery');
}
{
 const h=harness(),snapshot=createRecoverySnapshot(initial(),{owner:'A',id:'gated'});h.records.set(recoveryKey('A'),appendRecoverySnapshot(null,snapshot));const gate=deferred();h.askGate=gate;const run=h.c.A.restoreRecovery({dataset:{id:'gated'}});while(!h.prompts.length)await Promise.resolve();h.c.owner='B';h.c.accountGeneration++;gate.resolve();await run;assert.equal(h.writes.length,0,'account switch while restore confirmation is open cancels restore');
}
{
 const h=harness();await h.c.C.restoreBackup({files:[{collection:[{id:'file',qty:2}],decks:[],settings:{}}]});assert.equal(h.c.S.state.collection[0].id,'file');assert(h.c.S.state.lastSavedAt);assert(h.events.includes('schedule-sync'));assert.equal(h.records.get(recoveryKey('A')).snapshots.length,1);
 h.events.length=0;await h.c.A.undoRestore();assert.equal(h.c.S.state.collection[0].id,'mine');assert(h.events.includes('schedule-sync'));assert.equal(h.records.get(recoveryKey('A')).snapshots.length,2);
}
{
 const h=harness(),gate=deferred();h.c.commitQueue=gate.promise;const save=h.c.save();h.c.accountGeneration++;h.c.owner='B';h.c.S.state={collection:[{id:'other-account',qty:1}],decks:[],settings:{}};gate.resolve();assert.equal(await save,false);assert.equal(h.writes.length,0);assert(!h.events.includes('schedule-sync'),'old queued Magic save cannot notify/sync after account switch');assert.equal(h.c.S.state.lastSavedAt,undefined);
}
{
 const h=harness(),gate=deferred();h.c.commitQueue=gate.promise;const save=h.c.save();h.c.conditionWorkspaceRevision++;gate.resolve();assert.equal(await save,false);assert.equal(h.writes.length,0,'old queued save cannot stamp a replaced workspace under the same owner');
}
{
 const h=harness(),state=initial();await h.c.appHooks.saveSyncBaseline('A',3,state);assert.equal(h.records.get(syncBaselineKey('A')).revision,3);assert.equal(h.writeOptions.at(-1).guardRecord.advance,false,'metadata-only baseline write preserves the cross-tab workspace revision');assert.equal(h.writeOptions.at(-1).guardRecord.value.owner,'A');const count=h.writes.length;await h.c.appHooks.saveSyncBaseline('A',3,state);assert.equal(h.writes.length,count,'identical baseline is not rewritten');
}
const renderStart=src.indexOf('function render() {');assert(!src.slice(renderStart,src.indexOf('\nfunction ',renderStart+1)).includes('scheduleValueObservation();'),'render must not dirty account with cached price history');
console.log('PASS: actual app Recovery journal/restore/download hooks, atomic failure, delayed owner/queue guards, private account scope, legacy restore sync, and no history-on-render writes.');
