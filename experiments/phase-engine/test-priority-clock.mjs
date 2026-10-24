import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPriorityClock,DEFAULT_RESPONSE_WINDOW_MS,CLOCK_POLICY} from './priority-clock.mjs';
const decision=(overrides={})=>({matchId:'match-1',revision:7,actor:0,decisionId:'priority-7-seat0',kind:'Priority',...overrides});
const pass={type:'PassPriority'};
function fixture(options={}){let t=1000,ids=0;const c=createPriorityClock({matchId:'match-1',now:()=>t,newId:()=>`timeout-${++ids}`,...options});return {c,set time(v){t=v;},get ids(){return ids;}};}
test('default clock waits before deadline and proposes only at deadline',()=>{
 const f=fixture(),ctx=decision();const armed=f.c.arm(ctx);assert.equal(armed.remainingMs,DEFAULT_RESPONSE_WINDOW_MS);assert.equal(armed.deadlineAt,31000);
 f.time=30999;assert.equal(f.c.propose(ctx,[pass]).state,'waiting');f.time=31000;const proposal=f.c.propose(ctx,[pass]);assert.equal(proposal.state,'timeout-proposal');assert.deepEqual(proposal.action,pass);
});
test('repeated arm/read/proposal calls retain the deadline and timeout ID',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=5000;for(let i=0;i<5;i++){assert.equal(f.c.arm(ctx).deadlineAt,31000);assert.equal(f.c.inspect(ctx).deadlineAt,31000);}
 f.time=32000;const a=f.c.propose(ctx,[pass]),b=f.c.propose(ctx,[pass]);assert.deepEqual(a,b);assert.equal(f.ids,1);
});
test('export/restore does not reset an expired deadline or proposal identity',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=31000;const expected=f.c.propose(ctx,[pass]),saved=f.c.snapshot();
 const restored=createPriorityClock({matchId:'match-1',saved,now:()=>60000,newId:()=>{throw Error('must not reroll ID');}});
 assert.equal(restored.arm(ctx).deadlineAt,31000);assert.deepEqual(restored.propose(ctx,[pass]),expected);assert.equal(restored.snapshot().policy,CLOCK_POLICY);
});
test('required target/payment/blocker/search choices never receive a guessed action',()=>{
 for(const kind of ['TargetChoice','Payment','DeclareBlockers','SearchChoice','MulliganDecision']){
  const f=fixture(),ctx=decision({kind});f.c.arm(ctx);f.time=31000;
  const result=f.c.propose(ctx,[pass,{type:'SelectCards',data:{cards:[1]}}]);assert.equal(result.state,'timeout-needs-choice');assert.equal(result.reason,'mandatory-choice');assert.equal(result.action,undefined);
 }
});
test('no actual legal pass yields timeout-needs-choice without inventing a loss',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=31000;
 for(const legal of [[],[{type:'CancelCast'}],undefined]){const r=f.c.propose(ctx,legal);assert.equal(r.state,'timeout-needs-choice');assert.equal(r.action,undefined);assert.equal(r.winner,undefined);}
});
test('changed seat/revision/decision identity cannot execute an old clock or reset it',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=31000;const p=f.c.propose(ctx,[pass]);
 for(const changed of [decision({revision:6}),decision({revision:8}),decision({actor:1}),decision({decisionId:'different'})])assert.equal(f.c.validate(p,changed,[pass]).state,'stale-clock');
 assert.equal(f.c.arm(decision({decisionId:'different'})).state,'stale-clock');assert.equal(f.c.arm(decision({revision:6})).state,'stale-clock');assert.equal(f.c.snapshot().current.deadlineAt,31000);
});
test('other actor never gets an automatic human timeout pass',()=>{
 const f=fixture(),ctx=decision({actor:1});assert.equal(f.c.arm(ctx).state,'other-actor');f.time=100000;assert.equal(f.c.propose(ctx,[pass]).state,'other-actor');assert.equal(f.ids,0);
});
test('suspension suppresses proposals while wall time continues; resume retains deadline',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=5000;assert.equal(f.c.suspend(ctx).state,'suspended');f.time=60000;
 const suspended=f.c.propose(ctx,[pass]);assert.equal(suspended.state,'suspended');assert.equal(suspended.expired,true);
 const restored=createPriorityClock({matchId:'match-1',saved:f.c.snapshot(),now:()=>70000});assert.equal(restored.propose(ctx,[pass]).state,'suspended');assert.equal(restored.resume(ctx).deadlineAt,31000);assert.equal(restored.propose(ctx,[pass]).state,'timeout-proposal');
});
test('timeout pass revalidates exact legal membership and current actor immediately before submit',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=31000;const p=f.c.propose(ctx,[pass]);let applies=0;
 function submit(proposal,current,actions){const allowed=f.c.validate(proposal,current,actions);if(allowed.ok){applies++;f.c.acknowledge(proposal,8);}return allowed;}
 assert.equal(submit(p,decision({actor:1}),[pass]).ok,false);assert.equal(submit(p,ctx,[]).ok,false);assert.equal(submit({...p,action:{type:'Concede'}},ctx,[pass]).ok,false);assert.equal(applies,0);
 assert.equal(submit(p,ctx,[pass]).ok,true);assert.equal(applies,1);assert.equal(submit(p,ctx,[pass]).state,'committed');assert.equal(applies,1);
});
test('rejected validation leaves the clock unchanged, accepted acknowledgement consumes once',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=31000;const p=f.c.propose(ctx,[pass]),before=f.c.snapshot();
 assert.equal(f.c.validate({...p,requestId:'wrong'},ctx,[pass]).ok,false);assert.deepEqual(f.c.snapshot(),before);
 assert.throws(()=>f.c.acknowledge(p,9),/STALE_TIMEOUT_ACK/);assert.deepEqual(f.c.snapshot(),before);
 f.c.acknowledge(p,8);f.c.acknowledge(p,8);assert.equal(f.c.propose(ctx,[pass]).state,'committed');
 const restored=createPriorityClock({matchId:'match-1',saved:f.c.snapshot(),now:()=>70000});assert.equal(restored.propose(ctx,[pass]).state,'committed');
});
test('new accepted revision can arm a new decision but cannot revive prior revision',()=>{
 const f=fixture(),old=decision();f.c.arm(old);f.time=31000;const p=f.c.propose(old,[pass]);f.c.acknowledge(p,8);
 const next=decision({revision:8,decisionId:'priority-8-seat0'});const armed=f.c.arm(next);assert.equal(armed.deadlineAt,61000);assert.equal(armed.requestId,'timeout-2');assert.equal(f.c.arm(old).state,'stale-clock');
});
test('tampered or incompatible persisted deadlines are rejected',()=>{
 const f=fixture();f.c.arm(decision());
 for(const mutate of [s=>s.current.deadlineAt++,s=>s.current.requestId='',s=>s.current.context.matchId='other']){const s=f.c.snapshot();mutate(s);assert.throws(()=>createPriorityClock({matchId:'match-1',saved:s}),/CORRUPT_CLOCK|BAD_CLOCK_CONTEXT/);}
 assert.throws(()=>createPriorityClock({matchId:'other',saved:f.c.snapshot()}),/INCOMPATIBLE_CLOCK/);
});

test('acknowledgement cannot consume a mandatory decision or a non-pass proposal',()=>{
 const f=fixture(),ctx=decision();f.c.arm(ctx);f.time=31000;const p=f.c.propose(ctx,[pass]);
 assert.throws(()=>f.c.acknowledge({...p,action:{type:'Concede'}},8),/STALE_TIMEOUT_ACK/);assert.equal(f.c.propose(ctx,[pass]).state,'timeout-proposal');
 const mandatory=fixture(),target=decision({kind:'TargetChoice'});mandatory.c.arm(target);mandatory.time=31000;const pending=mandatory.c.propose(target,[pass]);
 assert.throws(()=>mandatory.c.acknowledge({...target,...pending,state:'timeout-proposal',action:pass},8),/STALE_TIMEOUT_ACK/);assert.equal(mandatory.c.propose(target,[pass]).state,'timeout-needs-choice');
});
