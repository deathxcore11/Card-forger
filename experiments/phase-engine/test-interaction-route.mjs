import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interactionSubmission,projectInteraction} from './interaction-surface.mjs';
import {createJournal,packet} from './worker-journal.mjs';
const sub={interactionId:'session.0.1',response:{type:'select',data:{choiceIds:['card-a']}}};
function fixture(){
 let saved=null,n=0,failWrite=false,accepted=true,calls=0;
 const engine={humanSeat:0,start:()=>{n=0;},save:()=>String(n),restore:s=>n=Number(s),summary:()=>({position:n}),respond:s=>{calls++;assert.deepEqual(s,sub);if(!accepted)return false;n++;return true;}};
 const storage={read:async()=>structuredClone(saved),write:async(next,expected)=>{assert.equal(saved?.revision??null,expected);saved=structuredClone(next);if(failWrite)throw Error('ACK_LOST');}};
 const open=()=>createJournal({engine,storage,epoch:'session',version:'test',choose:()=>assert.fail('no candidate chooser')});let send=open();
 const request=(op,extra={})=>send({v:1,epoch:'session',op,id:'request',...extra});
 return {request,engine,get calls(){return calls;},get saved(){return saved;},set accepted(v){accepted=v;},set failWrite(v){failWrite=v;},resume(){send=open();return request('resume');}};
}
test('bounded ingress refuses fabricated actions, fields, duplicate and huge selections',()=>{
 for(const value of [{...sub,actor:1},{...sub,response:{type:'Debug',data:{}}},{...sub,response:{type:'select',data:{choiceIds:['a','a']}}},{...sub,response:{type:'select',data:{choiceIds:Array(1025).fill('x')}}},{...sub,interactionId:''}])assert.throws(()=>interactionSubmission(value));
 assert.deepEqual(interactionSubmission(sub),sub);assert.throws(()=>packet({v:1,epoch:'session',id:'r',op:'status',submission:sub}));
});
test('valid human submission is committed once and replayed across recovery',async()=>{
 const f=fixture();await f.request('create',{seed:1,first:0});let r=await f.request('respond',{revision:0,submission:sub});assert.equal(r.ok,true);assert.equal(r.result.revision,1);assert.equal(f.saved.history[0].actor,0);assert.equal(f.saved.history[0].action.type,'InteractionSubmission');
 await f.resume();r=await f.request('respond',{revision:0,submission:sub});assert.equal(r.result.revision,1);assert.equal(f.calls,1);
 const collision=await f.request('respond',{revision:0,submission:{...sub,interactionId:'different'}});assert.equal(collision.error,'ID_COLLISION');
});
test('engine refusal preserves revision and permits a corrected selection',async()=>{
 const f=fixture();await f.request('create',{seed:1,first:0});const before=structuredClone(f.saved);f.accepted=false;
 const r=await f.request('respond',{revision:0,submission:sub});assert.equal(r.result.rejected,true);assert.deepEqual(f.saved,before);
 f.accepted=true;assert.equal((await f.request('respond',{revision:0,submission:sub})).result.revision,1);
});
test('automatic mode and stale revision never enter the human engine route',async()=>{
 const f=fixture();await f.request('create',{seed:1,first:0});f.engine.humanSeat=null;
 assert.equal((await f.request('respond',{revision:0,submission:sub})).error,'HUMAN_ROUTE_UNAVAILABLE');f.engine.humanSeat=0;
 assert.equal((await f.request('respond',{revision:1,submission:sub})).error,'STALE_REVISION');assert.equal(f.calls,0);
});
test('lost write acknowledgement requires recovery and receipt prevents replay',async()=>{
 const f=fixture();await f.request('create',{seed:1,first:0});f.failWrite=true;
 assert.equal((await f.request('respond',{revision:0,submission:sub})).error,'RECOVERY_REQUIRED');assert.equal((await f.request('status')).error,'RECOVERY_REQUIRED');
 f.failWrite=false;await f.resume();assert.equal((await f.request('respond',{revision:0,submission:sub})).result.revision,1);assert.equal(f.calls,1);
});
test('queued request owns its submission bytes before caller can change them',async()=>{
 const f=fixture();await f.request('create',{seed:1,first:0});const draft=structuredClone(sub),p=f.request('respond',{revision:0,submission:draft});draft.response.data.choiceIds[0]='tampered';assert.equal((await p).ok,true);
});
test('projection excludes authority witnesses and unknown fields, retires unauthorized choices',()=>{
 const raw={canSubmit:true,authorizedSubmitters:[0],waitingForKind:{code:'search'},opportunities:[{interactionId:'a',response:{type:'schema',data:{spec:{type:'select',data:{constraint:{type:'count',data:{min:2,max:2}},confirm:'explicit'}},candidates:[{id:'b',status:{type:'available'},surfaces:[{type:'object',data:{reference:'42',name:'Forest',zone:'library',privateData:'secret'}}]}]}}}],availability:{data:{witness:{secret:'private'}}}};
 const view=projectInteraction(raw,0);assert.equal(view.opportunities[0].min,2);assert(!JSON.stringify(view).includes('secret'));assert.equal(projectInteraction(raw,1).opportunities.length,0);
 raw.opportunities[0].response.data.spec.type='assignAmounts';assert.equal(projectInteraction(raw,0).canSubmit,false);
});
test('unknown adapter outcomes poison the journal instead of reporting a harmless rejection',async()=>{
 const f=fixture();await f.request('create',{seed:1,first:0});f.engine.respond=()=>undefined;
 assert.equal((await f.request('respond',{revision:0,submission:sub})).error,'INVALID_ENGINE_RESPONSE');assert.equal((await f.request('status')).error,'RECOVERY_REQUIRED');
});
