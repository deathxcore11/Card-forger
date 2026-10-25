import {test} from 'node:test';import assert from 'node:assert/strict';
import {openPracticeSessionRecord} from './practice-session-record.mjs';
import {prepareMatchInput} from './match-input.mjs';import {RUNTIME_IDENTITY} from './runtime-assets.mjs';import {createJournal} from './worker-journal.mjs';
const input=()=>{const d={name:'Session list',format:'Standard',cards:[{name:'Plains',qty:56},{name:'Savannah Lions',qty:4,printingId:'exact-print',finish:'foil'}]};return prepareMatchInput({player:d,opponent:d,format:'Standard',difficulty:'Medium',profile:{displayName:'You'},runtimeIdentity:RUNTIME_IDENTITY.wasmSha256});};
const save=(revision=0)=>({revision,history:Array.from({length:revision},()=>({actor:0,action:{type:'PassPriority'}})),receipts:{},engine:'position-'+revision});

test('session records do not touch IndexedDB and freeze input, presentation and accepted journals',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');let access=0;
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,get(){access++;throw Error('INDEXEDDB_FORBIDDEN');}});
 try{
  const source=input(),r=await openPracticeSessionRecord({ownerId:'owner',matchId:'session',input:source});
  source.decks.player.cards[1].finish='changed';assert.equal(r.input.decks.player.cards[1].finish,'foil');const digest=r.digest;r.input.decks.player.cards[1].finish='caller-change';assert.equal(r.digest,digest);
  const presentation={one:{printingId:'exact-print',finish:'foil'}};r.setPresentation(presentation);presentation.one.finish='changed';assert.equal(r.getPresentation().one.finish,'foil');const copy=r.getPresentation();copy.one.finish='another-change';assert.equal(r.getPresentation().one.finish,'foil');
  assert.equal(await r.storage.read(),undefined);const next=save();next.receipts.exact={fingerprint:'cast',response:{revision:0,surface:{cards:[{printing:{finish:'foil'}}]}}};await r.storage.write(next,null);
  next.receipts.exact.response.surface.cards[0].printing.finish='changed';const saved=await r.storage.read();assert.equal(saved.receipts.exact.response.surface.cards[0].printing.finish,'foil');saved.engine='edited';assert.equal((await r.storage.read()).engine,'position-0');
  assert.throws(()=>r.setPresentation({}),/ALREADY_EXISTS/);r.close();await assert.rejects(r.storage.read(),/MATCH_STORE_CLOSED/);await assert.rejects(r.storage.write(save(1),0),/MATCH_STORE_CLOSED/);assert.throws(()=>r.getPresentation(),/MATCH_STORE_CLOSED/);assert.equal(access,0);
 }finally{if(previous)Object.defineProperty(globalThis,'indexedDB',previous);else delete globalThis.indexedDB;}
});

test('session CAS accepts one simultaneous next revision and rejects stale overwrites',async()=>{
 const r=await openPracticeSessionRecord({ownerId:'owner',matchId:'cas',input:input()});await r.storage.write(save(),null);
 const replies=await Promise.allSettled([r.storage.write({...save(1),engine:'first'},0),r.storage.write({...save(1),engine:'second'},0)]);
 assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);assert.match(replies.find(r=>r.status==='rejected').reason.message,/WRITE_CONFLICT/);assert.equal((await r.storage.read()).engine,'first');await assert.rejects(r.storage.write(save(2),null),/WRITE_CONFLICT/);assert.equal((await r.storage.read()).revision,1);
 await assert.rejects(r.storage.write({...save(2),revision:NaN},1),/INVALID_MATCH_JOURNAL/);assert.equal((await r.storage.read()).revision,1);r.close();
});

test('a fresh session does not resume another worker or another account',async()=>{
 const a=await openPracticeSessionRecord({ownerId:'owner-a',matchId:'same',input:input()});await a.storage.write(save(),null);
 const fresh=await openPracticeSessionRecord({ownerId:'owner-a',matchId:'same',input:input()}),other=await openPracticeSessionRecord({ownerId:'owner-b',matchId:'same',input:input()});assert.equal(await fresh.storage.read(),undefined);assert.equal(await other.storage.read(),undefined);a.close();fresh.close();other.close();
 await assert.rejects(openPracticeSessionRecord({ownerId:'owner/a',matchId:'same',input:input()}),/INVALID_MATCH_BINDING/);await assert.rejects(openPracticeSessionRecord({ownerId:'owner',matchId:'same'}),/INCOMPATIBLE_MATCH_INPUT/);
});

test('the unchanged journal preserves exact receipt replay and engine terminal rules in a session',async()=>{
 const record=await openPracticeSessionRecord({ownerId:'owner',matchId:'journal',input:input()});let state=0,applied=0;
 const engine={start(){state=0;},restore:s=>{state=Number(s);},save:()=>String(state),summary:()=>({terminal:state>=2?{winner:1}:null,surface:{cards:[]}}),legal:()=>({actor:0,actions:[{type:'PassPriority'}]}),apply(){state++;applied++;}};
 const h=createJournal({engine,storage:record.storage,choose:async()=>({index:0,rng:1}),version:'session-test',epoch:'epoch'}),m=(op,id,revision=0)=>({v:1,epoch:'epoch',op,id,revision,...(op==='create'?{seed:123,first:0}:{})});
 assert.equal((await h(m('create','create'))).ok,true);const first=await h(m('step','first'));assert.equal(first.result.revision,1);assert.deepEqual(await h(m('step','first')),first);assert.equal(applied,1);
 assert.equal((await h(m('step','stale'))).error,'STALE_REVISION');assert.equal(applied,1);const terminal=await h(m('step','terminal',1));assert.deepEqual(terminal.result.terminal,{winner:1,reason:'engine-terminal'});assert.deepEqual(await h(m('step','terminal',1)),terminal);assert.equal(applied,2);assert.equal((await h(m('step','extra',2))).error,'GAME_OVER');assert.equal(applied,2);
 const saved=await record.storage.read();assert.deepEqual(saved.receipts.terminal.response,terminal.result);assert.equal(saved.history.length,2);record.close();
});

test('session result is once-only, uses frozen deck digest and cannot turn an error into a win',async()=>{
 let now=1234;const original=input(),record=await openPracticeSessionRecord({ownerId:'owner',matchId:'result',input:original,now:()=>now});
 await record.storage.write(save(),null);assert.equal(record.getResult(),null);original.decks.player.name='Edited after start';record.input.decks.player.name='Caller edit';
 const terminal={...save(1),history:[{actor:0,action:{type:'HumanTimeoutConcede',reason:'inactivity'}}],receipts:{finish:{response:{revision:1,terminal:{winner:1}}}}};
 await record.storage.write(terminal,0);const result=record.getResult();assert.equal(result.snapshotDigest,record.digest);assert.equal(result.reason,'idle-timeout');assert.equal(result.finishedAt,1234);assert.equal(result.revision,1);
 now=9999;assert.deepEqual(record.getResult(),result);result.winner=0;assert.equal(record.getResult().winner,1);
 await assert.rejects(record.storage.write(save(2),1),/RESULT_CONFLICT/);assert.equal((await record.storage.read()).revision,1);
 record.close();assert.throws(()=>record.getResult(),/MATCH_STORE_CLOSED/);
});
