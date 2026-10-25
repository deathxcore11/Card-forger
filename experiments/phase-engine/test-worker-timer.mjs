import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createJournal} from './worker-journal.mjs';
function fixture(){
 let state={actor:0,kind:'Priority'},durable=null,now=1000,count=0,lost=false;
 const engine={humanSeat:0,start(){},save:()=>JSON.stringify(state),restore:s=>{state=JSON.parse(s);},
 summary:()=>({terminal:null}),clockContext:revision=>({...state,decisionId:`d-${revision}`}),
 legal:()=>({actor:state.actor,actions:[{type:'PassPriority'}]}),apply(){count++;state.actor=1-state.actor;},
 respond(){count++;state={actor:0,kind:'Priority'};return true;}};
 const storage={read:async()=>structuredClone(durable),write:async(s,expected)=>{assert.equal(durable?.revision??null,expected);durable=structuredClone(s);if(lost)throw Error('ACK_LOST');}};
 const make=(epoch='a')=>createJournal({engine,storage,epoch,version:'timed',choose:async(a,r)=>({index:0,rng:r}),timing:{matchId:'m',now:()=>now,newId:()=>`clock-${count}`}});
 return {make,get saved(){return durable;},get count(){return count;},set now(v){now=v;},set lost(v){lost=v;},set kind(v){state.kind=v;}};
}
const msg=(op,id,revision=0,epoch='a')=>({v:1,epoch,op,id,...(op==='create'?{seed:1,first:0}:['tick','step','respond'].includes(op)?{revision}:{})});
test('timer reads and early ticks preserve durable deadline; expiry passes exactly once',async()=>{
 const f=fixture(),h=f.make();const start=await h(msg('create','c'));assert(start.ok);assert.equal(start.result.clock.deadlineAt,31000);
 f.now=30000;assert.equal((await h(msg('tick','early'))).result.clock.state,'waiting');assert.equal(f.count,0);
 f.now=31000;const tick=msg('tick','expiry');const accepted=await h(tick);assert(accepted.ok);assert.equal(accepted.result.revision,1);assert.equal(f.count,1);
 assert.deepEqual(await h(tick),accepted);assert.equal((await h(msg('tick','old'))).error,'STALE_REVISION');assert.equal(f.count,1);
 assert.equal(f.saved.history[0].action.type,'PassPriority');
});
test('human command wins a race with expired timer without a second pass',async()=>{
 const f=fixture(),h=f.make();await h(msg('create','c'));f.now=31000;
 const [human,timer]=await Promise.all([h(msg('step','human')),h(msg('tick','expiry'))]);assert(human.ok);assert.equal(timer.error,'STALE_REVISION');assert.equal(f.count,1);
});
test('cold recovery retains expiry and durable timeout receipt after lost acknowledgement',async()=>{
 const f=fixture(),h=f.make();await h(msg('create','c'));f.now=31000;f.lost=true;
 assert.equal((await h(msg('tick','expiry'))).error,'RECOVERY_REQUIRED');assert.equal(f.saved.revision,1);
 f.lost=false;const resumed=f.make('b');assert((await resumed(msg('resume','r',0,'b'))).ok);
 assert.equal((await resumed(msg('tick','expiry',0,'b'))).result.revision,1);assert.equal(f.count,1);
});
test('resume never replenishes response time',async()=>{
 const f=fixture();await f.make()(msg('create','c'));f.now=50000;const h=f.make('b');
 const result=await h(msg('resume','r',0,'b'));assert(result.ok);assert.equal(result.result.clock.deadlineAt,31000);assert.equal(result.result.clock.state,'expired');
});
test('mandatory choice expiry never guesses an action; explicit interaction re-arms next decision',async()=>{
 const f=fixture();f.kind='SearchChoice';const h=f.make();await h(msg('create','c'));f.now=31000;
 assert.equal((await h(msg('tick','expiry'))).result.clock.state,'timeout-needs-choice');assert.equal(f.count,0);
 const r=await h({...msg('respond','selected'),submission:{interactionId:'i',response:{type:'choose',data:{choiceId:'c'}}}});
 assert(r.ok);assert.equal(r.result.clock.deadlineAt,61000);assert.equal(f.count,1);
});
test('inconsistent saved clock refuses recovery',async()=>{
 const f=fixture();await f.make()(msg('create','c'));f.saved.clock.current.context.revision=9;
 assert.equal((await f.make('b')(msg('resume','r',0,'b'))).error,'CLOCK_CONTEXT_MISMATCH');assert.equal(f.count,0);
});
