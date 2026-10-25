import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTimedPriorityJournal} from './timed-priority-journal.mjs';
function fixture(){
 let time=1000,saved=null,sequence=0,writes=0,failWrite=null;
 const store={read:async()=>structuredClone(saved),write:async(next,expected)=>{
  if((saved?.revision??null)!==expected)throw Error('WRITE_CONFLICT');
  if(failWrite==='before')throw Error('WRITE_FAILED');
  saved=structuredClone(next);writes++;
  if(failWrite==='after')throw Error('ACK_LOST');
 }};
 function open({kind='Priority',actor=0,legal=true}={}){
  let position={kind,actor,applies:0};
  const engine={context:()=>({kind:position.kind,actor:position.actor,decisionId:'choice-'+position.applies}),legal:()=>legal?[{type:'PassPriority'}]:[],save:()=>JSON.stringify(position),restore:s=>{position=JSON.parse(s);},apply:(seat,action)=>{assert.equal(seat,position.actor);assert.equal(action.type,'PassPriority');position.applies++;position.actor=1;}};
  const send=createTimedPriorityJournal({engine,storage:store,matchId:'match',version:'fixture-v1',now:()=>time,newId:()=>`timeout-${++sequence}`});
  return {send,get position(){return position;}};
 }
 return {open,store,set time(t){time=t;},get saved(){return structuredClone(saved);},get writes(){return writes;},set failure(v){failWrite=v;}};
}
const pass={op:'pass',id:'human-1',revision:0,actor:0};
test('deadline and engine are stored together; reads and premature ticks never rewrite',async()=>{
 const f=fixture(),a=f.open();await a.send({op:'create'});assert.equal(f.saved.clock.current.deadlineAt,31000);
 f.time=30000;for(let i=0;i<4;i++)assert.equal((await a.send({op:'tick'})).revision,0);
 assert.equal((await a.send({op:'status'})).clock.remainingMs,1000);assert.equal(f.writes,1);
});
test('cold restore retains the deadline and applies one timeout pass',async()=>{
 const f=fixture(),a=f.open();await a.send({op:'create'});f.time=60000;const b=f.open();await b.send({op:'resume'});
 const result=await b.send({op:'tick'});assert.equal(result.requestId,'timeout-1');assert.equal(result.revision,1);assert.equal(b.position.applies,1);
 assert.equal(f.saved.revision,1);assert.equal(f.saved.clock.current.context.actor,1);assert.equal(f.saved.receipts['timeout-1'].revision,1);
 await b.send({op:'tick'});assert.equal(b.position.applies,1);
});
test('simultaneous human and expiry requests serialize to one accepted pass',async()=>{
 for(const humanFirst of [true,false]){
  const f=fixture(),a=f.open();await a.send({op:'create'});f.time=31000;
  const commands=humanFirst?[pass,{op:'tick'}]:[{op:'tick'},pass];
  const results=await Promise.allSettled(commands.map(a.send));
  assert.equal(a.position.applies,1);assert.equal(f.saved.revision,1);
  if(!humanFirst)assert.match(results[1].reason.message,/STALE_REVISION/);
 }
});
test('duplicate human pass replays receipt after restore without another action',async()=>{
 const f=fixture(),a=f.open();await a.send({op:'create'});await a.send(pass);
 const b=f.open();await b.send({op:'resume'});assert.deepEqual(await b.send(pass),{revision:1,replayed:true});assert.equal(b.position.applies,1);assert.equal(f.writes,2);
});
test('required choices, other seats and missing pass never get an automatic action',async()=>{
 for(const options of [{kind:'Payment'},{kind:'SearchChoice'},{kind:'MulliganDecision'},{kind:'DeclareBlockers'},{actor:1},{legal:false}]){
  const f=fixture(),a=f.open(options);await a.send({op:'create'});f.time=60000;
  const result=await a.send({op:'tick'});assert.equal(result.clock.state,options.actor===1?'other-actor':'timeout-needs-choice');assert.equal(a.position.applies,0);assert.equal(f.writes,1);
 }
});
test('wrong actor, stale revision and unavailable pass preserve deadline',async()=>{
 const f=fixture(),a=f.open({legal:false});await a.send({op:'create'});const before=f.saved;
 for(const p of [{...pass,actor:1},{...pass,revision:2},pass])await assert.rejects(a.send(p));
 assert.deepEqual(f.saved,before);assert.equal(a.position.applies,0);
});
test('failed write poisons the authority; recovery uses actual durable outcome',async()=>{
 for(const mode of ['before','after']){
  const f=fixture(),a=f.open();await a.send({op:'create'});f.time=31000;f.failure=mode;
  await assert.rejects(a.send({op:'tick'}));await assert.rejects(a.send({op:'tick'}),/RECOVERY_REQUIRED/);
  f.failure=null;const b=f.open();await b.send({op:'resume'});
  assert.equal(b.position.applies,mode==='after'?1:0);await b.send({op:'tick'});
  assert.equal(b.position.applies,1);assert.equal(f.saved.revision,1);assert.equal(f.saved.receipts['timeout-1'].revision,1);
 }
});
test('two authorities cannot overwrite the same revision',async()=>{
 const f=fixture(),a=f.open();await a.send({op:'create'});const b=f.open();await b.send({op:'resume'});await a.send(pass);
 await assert.rejects(b.send({...pass,id:'other'}),/WRITE_CONFLICT/);await assert.rejects(b.send({op:'status'}),/RECOVERY_REQUIRED/);assert.equal(f.saved.revision,1);
});
test('mismatched persisted clock fails closed instead of extending its deadline',async()=>{
 const f=fixture(),a=f.open();await a.send({op:'create'});const corrupt=f.saved;corrupt.clock.current.context.decisionId='wrong';
 const original=f.store.read;f.store.read=async()=>corrupt;const b=f.open();await assert.rejects(b.send({op:'resume'}),/CLOCK_CONTEXT_MISMATCH/);f.store.read=original;
 assert.equal(f.writes,1);
});
