import {test} from 'node:test';import assert from 'node:assert/strict';
import {projectInteraction,validInteractionRelations,interactionSubmission} from './interaction-surface.mjs';
import {createMatchSession} from './match-session.mjs';
const raw=()=>({canSubmit:true,authorizedSubmitters:[0],opportunities:[{interactionId:'combat',response:{type:'schema',data:{spec:{type:'relations',data:{min:0,max:4,sourceConstraint:'atMostOne',allowGroups:true,confirm:'explicit',edges:[{sourceId:'a',targetIds:['p','b']},{sourceId:'c',targetIds:['p']}]}},candidates:['a','b','c','p'].map(id=>({id,status:{type:'available'},surfaces:[{type:'object',data:{name:id,reference:id}}]}))}}}]});
const rel=(sourceId,targetId,group=null)=>({sourceId,targetId,group});
test('combat projection requires authorization and explicit bounded edges',()=>{
 const r=raw(),o=projectInteraction(r,0).opportunities[0];assert.equal(o.type,'relations');assert.equal(projectInteraction(r,1).canSubmit,false);
 for(const change of [d=>d.max=1025,d=>d.sourceConstraint='guess',d=>d.edges[0].targetIds.push('unknown'),d=>d.edges.push(d.edges[0]),d=>d.allowGroups='yes']){const r=raw();change(r.opportunities[0].response.data.spec.data);assert.equal(projectInteraction(r,0).opportunities.length,0);}
});
test('edge membership, duplicate pairs, grouping and source capacity are bounded before engine validation',()=>{
 const o=projectInteraction(raw(),0).opportunities[0];assert(validInteractionRelations(o,[]));assert(validInteractionRelations(o,[rel('a','p'),rel('c','p')]));
 for(const rows of [[rel('a','a')],[rel('a','unknown')],[rel('a','p'),rel('a','p')],[rel('a','p'),rel('a','b')],[rel('a','p',-1)]])assert(!validInteractionRelations(o,rows));
 o.sourceConstraint='engineValidated';assert(validInteractionRelations(o,[rel('a','p'),rel('a','b')]));o.allowGroups=false;assert(!validInteractionRelations(o,[rel('a','p',1)]));
 o.min=1;assert(!validInteractionRelations(o,[]));assert(validInteractionRelations(o,[],{complete:false}));
});
test('relation wire copies exact bounded identifiers and rejects malformed group or extra fields',()=>{
 const v={interactionId:'combat',response:{type:'relations',data:{relations:[rel('a','p')]}}},s=interactionSubmission(v);v.response.data.relations[0].targetId='changed';assert.equal(s.response.data.relations[0].targetId,'p');
 assert.throws(()=>interactionSubmission({interactionId:'combat',response:{type:'relations',data:{relations:[{...rel('a','p'),extra:true}]}}}));
});
test('combat session drafts locally, confirms once, and clears on new accepted revision',async()=>{
 const opportunity=projectInteraction(raw(),0),sent=[];let status={revision:0,surface:{cards:[],awaitingHuman:true,interaction:opportunity},clock:{state:'other-actor'}};
 const session=createMatchSession({client:{close(){},async request(op,fields){if(op==='respond'){sent.push(fields);await new Promise(r=>setTimeout(r,5));status={...status,revision:1};}return structuredClone(status);}},schedulerOptions:{setTimer:()=>0,clearTimer(){}}});
 await session.open();session.setRelations('combat',[rel('a','p'),rel('c','p')]);assert.equal(sent.length,0);const p=session.confirm();await assert.rejects(async()=>session.confirm(),/MATCH_NOT_READY/);await p;assert.equal(sent.length,1);assert.equal(sent[0].submission.response.type,'relations');assert.equal(session.snapshot().pending,null);session.close();
});
