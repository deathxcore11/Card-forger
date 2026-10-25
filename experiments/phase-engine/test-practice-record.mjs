import {test} from 'node:test';import assert from 'node:assert/strict';import {canonical,practiceKey,validatePracticeInput,snapshotDigest} from './practice-record.mjs';import {prepareMatchInput} from './match-input.mjs';import {RUNTIME_IDENTITY} from './runtime-assets.mjs';
const input=()=>{const d={name:'Saved list',format:'Standard',cards:[{name:'Plains',qty:56},{name:'Savannah Lions',qty:4,printingId:'exact-print',finish:'foil'}]};return prepareMatchInput({player:d,opponent:d,format:'Standard',difficulty:'Medium',profile:{displayName:'You'},runtimeIdentity:RUNTIME_IDENTITY.wasmSha256});};
test('account and match identities form separate tuple keys',()=>{assert.deepEqual(practiceKey('owner-a','match'),['owner-a','match']);assert.notDeepEqual(practiceKey('a-b','c'),practiceKey('a','b-c'));for(const v of ['',null,'a/b','__proto__\n'])assert.throws(()=>practiceKey(v,'m'));});
test('snapshot canonicalization is finite, stable and ignores undefined object fields only',()=>{assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));assert.equal(canonical({a:1,b:undefined}),canonical({a:1}));for(const v of [NaN,Infinity,new Date(),[undefined]])assert.throws(()=>canonical(v));const v={};v.a=v;assert.throws(()=>canonical(v),/SNAPSHOT_LIMIT/);});
test('a persisted engine list cannot diverge from the original deck snapshot',()=>{const v=input();assert.deepEqual(validatePracticeInput(v),v);v.engineLists.player.main_deck[0]='Black Lotus';assert.throws(()=>validatePracticeInput(v),/MATCH_INPUT_MISMATCH/);});
test('digest binds printing, finish, format, profile and CPU difficulty',async()=>{const v=input(),a=await snapshotDigest(v),reordered={...v,profile:{...v.profile}};assert.equal(await snapshotDigest(reordered),a);for(const mutate of [x=>x.decks.player.cards[1].finish='nonfoil',x=>x.profile.displayName='Changed',x=>x.difficulty='Hard']){const n=structuredClone(v);mutate(n);assert.notEqual(await snapshotDigest(n),a);}assert.equal(v.decks.player.cards[1].finish,'foil');});

test('a deck capture without an optional profile remains valid across the worker boundary',()=>{const v=input(),captured=prepareMatchInput({player:v.decks.player,opponent:v.decks.opponent,format:'Standard',difficulty:'Medium',runtimeIdentity:RUNTIME_IDENTITY.wasmSha256});assert.deepEqual(validatePracticeInput(captured),captured);assert.deepEqual(captured.profile,{});});

test('journal writes request strict durability and refuse an ignored durability option',async()=>{const {openPracticeRecord}=await import('./practice-record.mjs');for(const supported of [true,false]){const calls=[];const db={transaction(name,mode,options){calls.push({name,mode,options});const t={durability:supported?'strict':'default',abort(){},objectStore(){return {get(){const q={};queueMicrotask(()=>{q.result=undefined;q.onsuccess?.();queueMicrotask(()=>t.oncomplete?.());});return q;},put(){}};}};return t;}};const r=await openPracticeRecord({ownerId:'owner',matchId:'strict-proof',input:input(),db});const p=r.storage.write({revision:0,receipts:{},history:[]},null);if(supported)await p;else await assert.rejects(p,/MATCH_STORE_UNAVAILABLE/);assert.deepEqual(calls.at(-1),{name:'matches',mode:'readwrite',options:{durability:'strict'}});}});

test('owned record operations close fresh connections on success and abort; close retires the handle',async()=>{
 const {openPracticeRecord}=await import('./practice-record.mjs');let opens=0,closes=0,stored;
 const previous=globalThis.indexedDB;
 globalThis.indexedDB={open(){const q={};opens++;queueMicrotask(()=>{q.result={close(){closes++;},transaction(){const t={durability:'strict',abort(){queueMicrotask(()=>t.onabort?.());},objectStore(){return {get(){const r={};queueMicrotask(()=>{r.result=stored;r.onsuccess?.();queueMicrotask(()=>t.oncomplete?.());});return r;},put(v){stored=structuredClone(v);}};}};return t;}};q.onsuccess();});return q;}};
 try{
  const r=await openPracticeRecord({ownerId:'owner',matchId:'lifecycle',input:input()});assert.equal(opens,1);assert.equal(closes,1);
  await r.storage.write({revision:0,receipts:{},history:[]},null);assert.equal(opens,2);assert.equal(closes,2);
  assert.equal((await r.storage.read()).revision,0);assert.equal(opens,3);assert.equal(closes,3);
  await assert.rejects(r.storage.write({revision:1,receipts:{},history:[]},9),/WRITE_CONFLICT/);assert.equal(opens,4);assert.equal(closes,4);
  r.close();await assert.rejects(r.storage.read(),/MATCH_STORE_CLOSED/);await assert.rejects(r.storage.write({},0),/MATCH_STORE_CLOSED/);assert.equal(opens,4);
 }finally{globalThis.indexedDB=previous;}
});

test('durable terminal records distinguish timeout reasons and bind the frozen deck revision',async()=>{
 const {openPracticeRecord}=await import('./practice-record.mjs');
 for(const [reason,expected]of [['inactivity','idle-timeout'],['turn-limit','turn-timeout']]){
  let stored,aborted=false;
  const db={transaction(){aborted=false;const t={durability:'strict',abort(){aborted=true;queueMicrotask(()=>t.onabort?.());},objectStore(){return {get(){const q={};queueMicrotask(()=>{q.result=structuredClone(stored);q.onsuccess?.();queueMicrotask(()=>{if(!aborted)t.oncomplete?.();});});return q;},put(value){stored=structuredClone(value);}};}};return t;}};
  const source=input(),r=await openPracticeRecord({ownerId:'owner',matchId:'clock-result',input:source,db,now:()=>4321});source.decks.player.name='edited-later';
  await r.storage.write({revision:0,receipts:{},history:[]},null);
  const journal={revision:1,history:[{actor:0,action:{type:'HumanTimeoutConcede',reason}}],receipts:{finish:{response:{revision:1,terminal:{winner:1}}}}};await r.storage.write(journal,0);
  assert.equal(stored.result.reason,expected);assert.equal(stored.result.snapshotDigest,r.digest);assert.equal(stored.result.finishedAt,4321);assert.equal(stored.input.decks.player.name,'Saved list');
  await assert.rejects(r.storage.write({revision:2,receipts:{},history:[]},1),/RESULT_CONFLICT/);assert.equal(stored.journal.revision,1);assert.equal(stored.result.reason,expected);r.close();
 }
});
