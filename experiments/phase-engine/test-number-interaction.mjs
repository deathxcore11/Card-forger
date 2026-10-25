import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interactionSubmission,projectInteraction} from './interaction-surface.mjs';
import {createMatchSession} from './match-session.mjs';
const raw=(min=0,max=5)=>({canSubmit:true,authorizedSubmitters:[0],opportunities:[{interactionId:'x',response:{type:'schema',data:{spec:{type:'number',data:{min,max,confirm:'explicit'}},candidates:[]}}}]});
test('number ingress accepts uint32 only, without coercion or extra fields',()=>{
 for(const value of [0,5,4294967295])assert.equal(interactionSubmission({interactionId:'x',response:{type:'number',data:{value}}}).response.data.value,value);
 for(const value of [-1,1.5,NaN,Infinity,4294967296,'2',null])assert.throws(()=>interactionSubmission({interactionId:'x',response:{type:'number',data:{value}}}));
 assert.throws(()=>interactionSubmission({interactionId:'x',response:{type:'number',data:{value:2,actor:1}}}));
});
test('numeric projection preserves engine range and seat permission, fails closed on invalid schema',()=>{
 assert.deepEqual(projectInteraction(raw(),0).opportunities,[{interactionId:'x',type:'number',min:0,max:5,choices:[]}]);
 assert.equal(projectInteraction(raw(),1).canSubmit,false);
 for(const [min,max] of [[-1,2],[2,1],[0,4294967296],[0,1.5]])assert.equal(projectInteraction(raw(min,max),0).canSubmit,false);
 const r=raw();r.opportunities[0].response.data.spec.data.confirm='implicit';assert.equal(projectInteraction(r,0).canSubmit,false);
});
test('number draft requires explicit confirmation, preserves zero, and clears after accepted revision',async()=>{
 let submission;let current={revision:0,terminal:null,clock:{state:'other-actor'},surface:{cards:[],awaitingHuman:true,canAct:false,choices:[],interaction:projectInteraction(raw(),0)}};
 const s=createMatchSession({client:{close(){},async request(op,fields){if(op==='respond'){submission=fields.submission;current={...current,revision:1};}return structuredClone(current);}}});
 try{await s.open();assert.throws(()=>s.confirm(),/CHOICE_INCOMPLETE/);assert.throws(()=>s.selectNone('x'),/CHOICE_REQUIRED/);
 for(const value of [-1,6,1.5,'2'])assert.throws(()=>s.setNumber('x',value),/CHOICE_INCOMPLETE/);
 s.setNumber('x',3);assert.equal(submission,undefined);s.clearSelection();assert.throws(()=>s.confirm(),/CHOICE_INCOMPLETE/);
 s.setNumber('x',0);await s.confirm();assert.deepEqual(submission,{interactionId:'x',response:{type:'number',data:{value:0}}});assert.equal(s.snapshot().pending,null);
 }finally{s.close();}
});
