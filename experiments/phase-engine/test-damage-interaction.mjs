import {test} from 'node:test';import assert from 'node:assert/strict';
import {projectInteraction,interactionSubmission,validDamageAssignments} from './interaction-surface.mjs';
import {createMatchSession} from './match-session.mjs';import {cpuPacket,chooseVisible} from './visible-cpu-policy.mjs';
const raw=()=>({canSubmit:true,authorizedSubmitters:[0],opportunities:[{interactionId:'damage',response:{type:'schema',data:{spec:{type:'assignDamage',data:{total:12,modes:['normal'],confirm:'explicit'}},candidates:[{id:'blocker',status:{type:'available'},surfaces:[{type:'object',data:{name:'Bear Cub',reference:'99',zone:'battlefield'}},{type:'amount',data:{min:0,max:12,total:12}}]},{id:'player',status:{type:'available'},surfaces:[{type:'player',data:{seat:1}},{type:'amount',data:{min:0,max:12,total:12}}]}]}}}]});
const split=()=>[{choiceId:'blocker',amount:2},{choiceId:'player',amount:10}];
test('damage projection retains exact engine targets, totals and modes only for the permitted seat',()=>{
 const o=projectInteraction(raw(),0).opportunities[0];assert.equal(o.type,'assignDamage');assert.equal(o.total,12);assert.deepEqual(o.modes,['normal']);assert.deepEqual(o.choices.map(c=>c.id),['blocker','player']);assert(validDamageAssignments(o,'normal',split()));assert.equal(projectInteraction(raw(),1).canSubmit,false);
 for(const change of [r=>r.opportunities[0].response.data.spec.data.total=-1,r=>r.opportunities[0].response.data.spec.data.modes=['invented'],r=>r.opportunities[0].response.data.candidates[0].surfaces[1].data.max=13,r=>r.opportunities[0].response.data.candidates[1].id='blocker']){const r=raw();change(r);assert.equal(projectInteraction(r,0).canSubmit,false);}
});
test('damage ingress rejects duplicate targets, fractional/negative/overflow amounts and injected fields',()=>{
 const request={interactionId:'damage',response:{type:'assignDamage',data:{mode:'normal',assignments:split()}}};assert.deepEqual(interactionSubmission(request),request);
 const overkill={interactionId:'damage',response:{type:'assignDamage',data:{mode:'normal',assignments:[{choiceId:'blocker',amount:12},{choiceId:'player',amount:0}]}}};assert.deepEqual(interactionSubmission(overkill).response.data.assignments,[{choiceId:'blocker',amount:12}]);
 for(const value of [-1,0.5,4294967296,'2',NaN]){const r=structuredClone(request);r.response.data.assignments[0].amount=value;assert.throws(()=>interactionSubmission(r));}
 for(const change of [r=>r.response.data.assignments.push(r.response.data.assignments[0]),r=>r.response.data.assignments[0].actor=1,r=>r.response.data.mode='automatic',r=>r.response.data.actor=1]){const r=structuredClone(request);change(r);assert.throws(()=>interactionSubmission(r));}
 const o=projectInteraction(raw(),0).opportunities[0];assert(!validDamageAssignments(o,'normal',[{choiceId:'player',amount:11}]));assert(!validDamageAssignments(o,'normal',[{choiceId:'other',amount:12}]));
});
test('damage draft sends nothing until confirmation and duplicate confirmation cannot submit twice',async()=>{
 let sent=[],current={revision:0,terminal:null,clock:{state:'needs-choice'},surface:{cards:[],awaitingHuman:true,canAct:false,choices:[],interaction:projectInteraction(raw(),0)}};
 const session=createMatchSession({client:{close(){},async request(op,fields){if(op==='respond'){sent.push(structuredClone(fields.submission));await new Promise(r=>setTimeout(r,5));current={...current,revision:1};}return structuredClone(current);}}});
 try{await session.open();assert.throws(()=>session.selectNone('damage'),/CHOICE_REQUIRED/);assert.throws(()=>session.setDamage('damage','normal',[{choiceId:'player',amount:11}]),/CHOICE_INCOMPLETE/);session.setDamage('damage','normal',split());assert.equal(sent.length,0);const pending=session.confirm();await assert.rejects(session.confirm(),/MATCH_NOT_READY/);await pending;assert.equal(sent.length,1);assert.equal(sent[0].response.type,'assignDamage');assert.equal(session.snapshot().pending,null);}finally{session.close();}
});
test('CPU can choose an engine-authored damage split without receiving handles or hidden identities',()=>{
 const view={seat:1,players:[{seat:0,life:10},{seat:1,life:20}],cards:[{id:99,known:true,name:'Public blocker',zone:'Battlefield',controller:0,power:2,toughness:2,damage:0},{id:7,known:false,name:'SECRET',zone:'Hand',controller:0}]};
 const actions=[{type:'AssignCombatDamage',data:{assignments:[[99,12]],trample_damage:0,controller_damage:0}},{type:'AssignCombatDamage',data:{assignments:[[99,2]],trample_damage:10,controller_damage:0}}],packet=cpuPacket(view,actions);assert.equal(chooseVisible(packet,1).index,1);for(const secret of ['SECRET','Public blocker','99','object_id'])assert(!JSON.stringify(packet).includes(secret));
});
