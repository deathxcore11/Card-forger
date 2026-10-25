import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interactionSubmission,projectInteraction,validInteractionText} from './interaction-surface.mjs';
import {createMatchSession} from './match-session.mjs';
const raw=()=>({canSubmit:true,authorizedSubmitters:[0],opportunities:[{interactionId:'name',response:{type:'schema',data:{spec:{type:'text',data:{allowArbitrary:true,maxLen:256,confirm:'explicit'}},candidates:[]}}}]});
test('text ingress preserves exact Unicode and rejects blank, malformed, oversized and injected fields',()=>{
 for(const value of ['Ninja of the Deep Hours','Æther Vial','é'.repeat(128)])assert.equal(interactionSubmission({interactionId:'name',response:{type:'text',data:{value}}}).response.data.value,value);
 for(const value of ['', '  ', 'a\n', '\ud800', 'é'.repeat(129), 2, null])assert.equal(validInteractionText(value,256),false);
 assert.throws(()=>interactionSubmission({interactionId:'name',response:{type:'text',data:{value:'Forest',actor:1}}}));
});
test('only explicitly authorized arbitrary text schema is exposed',()=>{
 assert.equal(projectInteraction(raw(),0).opportunities[0].type,'text');assert.equal(projectInteraction(raw(),1).canSubmit,false);
 for(const patch of [{allowArbitrary:false},{maxLen:257},{maxLen:0},{maxLen:1.5},{confirm:'implicit'}]){const r=raw();Object.assign(r.opportunities[0].response.data.spec.data,patch);assert.equal(projectInteraction(r,0).canSubmit,false);}
});
test('text draft is local, confirmed once, and retired by accepted revision',async()=>{
 let submitted=[],release;let current={revision:0,terminal:null,clock:{state:'other-actor'},surface:{cards:[],awaitingHuman:true,canAct:false,choices:[],interaction:projectInteraction(raw(),0)}};
 const s=createMatchSession({client:{close(){},async request(op,fields){if(op==='respond'){submitted.push(fields.submission);await new Promise(r=>release=r);current={...current,revision:1};}return structuredClone(current);}}});
 try{await s.open();assert.throws(()=>s.confirm(),/CHOICE_INCOMPLETE/);assert.throws(()=>s.setText('name',' '),/CHOICE_INCOMPLETE/);assert.throws(()=>s.setText('stale','Forest'),/STALE_CHOICE/);
 s.setText('name','Pithing Needle');assert.equal(submitted.length,0);s.clearSelection();assert.throws(()=>s.confirm(),/CHOICE_INCOMPLETE/);
 s.setText('name','Walking Ballista');const p=s.confirm();await assert.rejects(s.confirm(),/MATCH_NOT_READY/);release();await p;assert.equal(submitted.length,1);assert.deepEqual(submitted[0].response,{type:'text',data:{value:'Walking Ballista'}});assert.equal(s.snapshot().pending,null);
 }finally{s.close();}
});
