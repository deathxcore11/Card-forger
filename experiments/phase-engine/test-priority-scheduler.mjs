import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPriorityScheduler} from './priority-scheduler.mjs';
import {createTimedPriorityJournal} from './timed-priority-journal.mjs';
function harness(request){
 const timers=new Map(),statuses=[],errors=[];let id=0;
 const scheduler=createPriorityScheduler({request,onStatus:s=>statuses.push(s),onError:e=>errors.push(e),setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:i=>timers.delete(i)});
 return {scheduler,timers,statuses,errors};
}
function authority(kind='Priority'){
 let time=0,saved=null,count=0,position={actor:0,kind,applies:0};
 const engine={context:()=>({...position,decisionId:'decision-'+position.applies}),legal:()=>[{type:'PassPriority'}],save:()=>JSON.stringify(position),restore:s=>position=JSON.parse(s),apply:()=>{position.applies++;position.actor=1;}};
 const storage={read:async()=>structuredClone(saved),write:async(next,expected)=>{assert.equal(saved?.revision??null,expected);saved=structuredClone(next);}};
 const open=()=>createTimedPriorityJournal({engine,storage,matchId:'scheduler',version:'fixture',now:()=>time,newId:()=>`timeout-${++count}`});
 return {open,set time(t){time=t;},get saved(){return saved;},get applies(){return position.applies;}};
}
test('journal deadline drives countdown and one pass; no timer remains for CPU actor',async()=>{
 const a=authority(),send=a.open();await send({op:'create'});const h=harness(send);
 await h.scheduler.start();assert.equal(h.statuses.at(-1).remainingSeconds,30);assert.equal(h.timers.size,1);
 a.time=25001;await h.scheduler.refresh();assert.equal(h.statuses.at(-1).remainingSeconds,5);assert.equal(h.statuses.at(-1).warning,true);
 a.time=30000;await h.scheduler.refresh();assert.equal(a.applies,1);assert.equal(a.saved.revision,1);assert.equal(h.statuses.at(-1).state,'other-actor');assert.equal(h.timers.size,0);
 await h.scheduler.refresh();assert.equal(a.applies,1);
});
test('cold journal reconstruction preserves expired deadline',async()=>{
 const a=authority();await a.open()({op:'create'});a.time=90000;const send=a.open();await send({op:'resume'});
 const h=harness(send);await h.scheduler.start();assert.equal(a.applies,1);assert.equal(a.saved.receipts['timeout-1'].revision,1);
});
test('all mandatory prompts stop scheduling without guessing a choice or result',async()=>{
 for(const kind of ['Payment','SearchChoice','MulliganDecision','DeclareBlockers','TargetChoice','BottomCards','UnknownFutureChoice']){
  const a=authority(kind),send=a.open();await send({op:'create'});a.time=30000;const h=harness(send);await h.scheduler.start();
  assert.equal(h.statuses.at(-1).needsChoice,true);assert.equal(h.timers.size,0);assert.equal(a.applies,0);assert.equal(a.saved.revision,0);
 }
});
test('scheduled wake consults authority instead of subtracting callback intervals',async()=>{
 const a=authority(),send=a.open();await send({op:'create'});const h=harness(send);await h.scheduler.start();
 const [{fn,ms}]=h.timers.values();assert.equal(ms,250);h.timers.clear();a.time=80000;fn();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(a.applies,1);assert.equal(h.timers.size,0);
});
test('stop suppresses a late status and never issues tick',async()=>{
 let resolve;const calls=[];const h=harness(c=>{calls.push(c);return new Promise(r=>resolve=r);});
 const pending=h.scheduler.start();h.scheduler.stop();resolve({revision:0,clock:{state:'expired',remainingMs:0,deadlineAt:1}});await pending;
 assert.deepEqual(calls,[{op:'status'}]);assert.equal(h.statuses.length,0);assert.equal(h.timers.size,0);
});
test('overlapping refreshes coalesce and never overlap authority requests',async()=>{
 let active=0,max=0,calls=0;const h=harness(async()=>{active++;max=Math.max(max,active);calls++;await new Promise(r=>setImmediate(r));active--;return {revision:0,clock:{state:'other-actor'}};});
 const pending=h.scheduler.start();for(let i=0;i<20;i++)void h.scheduler.refresh();await pending;await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
 assert.equal(max,1);assert.equal(calls,2);h.scheduler.stop();
});
test('unknown mutation acknowledgement stops until explicit recovery, with no retry loop',async()=>{
 const calls=[];const h=harness(async c=>{calls.push(c.op);if(c.op==='tick')throw Error('private engine details');return {revision:0,clock:{state:'expired',remainingMs:0,deadlineAt:1}};});
 await h.scheduler.start();await h.scheduler.refresh();assert.deepEqual(calls,['status','tick']);assert.deepEqual(h.errors,[{state:'recovery-required'}]);assert.equal(h.timers.size,0);
});
test('countdown projection drops unexpected private data and malformed time stops',async()=>{
 const h=harness(async()=>({revision:3,secret:'hand',clock:{state:'waiting',remainingMs:1,deadlineAt:10,save:'private'}}));
 await h.scheduler.start();assert.deepEqual(h.statuses[0],{revision:3,state:'waiting',remainingSeconds:1,warning:true,needsChoice:false});h.scheduler.stop();
 const bad=harness(async()=>({revision:0,clock:{state:'waiting',remainingMs:NaN,deadlineAt:10}}));await bad.scheduler.start();assert.equal(bad.errors.length,1);assert.equal(bad.timers.size,0);
});
