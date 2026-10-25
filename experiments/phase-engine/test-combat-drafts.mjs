import {test} from 'node:test';import assert from 'node:assert/strict';
import {interactionSubmission,projectInteraction,validInteractionRelations} from './interaction-surface.mjs';
import {createMatchSession} from './match-session.mjs';
const relation=(sourceId='a',targetId='x',group=null)=>({sourceId,targetId,group});
function raw({constraint='atMostOne',groups=true}={}){return {canSubmit:true,authorizedSubmitters:[0],opportunities:[{interactionId:'combat',response:{type:'schema',data:{spec:{type:'relations',data:{min:0,max:4,edges:[{sourceId:'a',targetIds:['x','y']},{sourceId:'b',targetIds:['x']}],sourceConstraint:constraint,allowGroups:groups,confirm:'explicit'}},candidates:['a','b','x','y'].map(id=>({id,status:{type:'available'},surfaces:[{type:'object',data:{name:id,reference:id,zone:'battlefield',secret:'PRIVATE'}}]}))}}}]};}
test('bounded combat ingress preserves exact endpoints/groups; rejects duplication and injection',()=>{
 const sub={interactionId:'combat',response:{type:'relations',data:{relations:[relation(),relation('b','x',0)]}}};assert.deepEqual(interactionSubmission(sub),sub);
 for(const rows of [[relation(),relation()],[{...relation(),actor:1}],[relation('a','x',-1)],[relation('a','x',1.5)],[relation('a','x',4294967296)],Array(1025).fill(relation())])assert.throws(()=>interactionSubmission({...sub,response:{type:'relations',data:{relations:rows}}}));
 assert.deepEqual(interactionSubmission({...sub,response:{type:'relations',data:{relations:[]}}}).response.data.relations,[]);
});
test('relation projection retains authorized topology only and rejects malformed edge domains',()=>{
 const v=projectInteraction(raw(),0);assert.equal(v.opportunities[0].type,'relations');assert.equal(projectInteraction(raw(),1).canSubmit,false);assert(!JSON.stringify(v).includes('PRIVATE'));
 for(const mutate of [d=>d.edges[0].targetIds.push('unknown'),d=>d.edges.push(d.edges[0]),d=>d.sourceConstraint='guessed',d=>d.allowGroups='yes',d=>d.edges[0].targetIds.push('x'),d=>d.confirm='implicit']){const r=raw();mutate(r.opportunities[0].response.data.spec.data);assert.equal(projectInteraction(r,0).canSubmit,false);}
});
test('local relation constraints do not invent special blocking limits or ignore endpoint restrictions',()=>{
 const attacks=projectInteraction(raw(),0).opportunities[0],blocks=projectInteraction(raw({constraint:'engineValidated',groups:false}),0).opportunities[0];
 assert.equal(validInteractionRelations(attacks,[relation(),relation('a','y')]),false);assert.equal(validInteractionRelations(blocks,[relation(),relation('a','y')]),true);
 assert.equal(validInteractionRelations(blocks,[relation('b','y')]),false);assert.equal(validInteractionRelations(blocks,[relation('a','x',0)]),false);assert.equal(validInteractionRelations(attacks,[relation('a','x',0)]),true);
});
function fixture(options){let current={revision:0,terminal:null,clock:{state:'other-actor'},surface:{cards:[],choices:[],awaitingHuman:true,canAct:false,interaction:projectInteraction(raw(options),0)}},sent=[];
 const s=createMatchSession({client:{close(){},async request(op,fields){if(op==='respond'){sent.push(structuredClone(fields.submission));current={...current,revision:current.revision+1};}return structuredClone(current);}}});return {s,sent};}
test('attack targets replace by source, clear remains local and confirmation retires the draft',async()=>{
 const {s,sent}=fixture();try{await s.open();assert.throws(()=>s.confirm(),/CHOICE_INCOMPLETE/);s.toggleRelation('combat','a','x');s.toggleRelation('combat','a','y');assert.deepEqual(s.snapshot().pending.relations,[relation('a','y')]);s.setRelationGroup('combat','a',0);assert.equal(sent.length,0);s.clearSelection();assert.equal(sent.length,0);s.toggleRelation('combat','a','x');s.toggleRelation('combat','b','x');await s.confirm();assert.deepEqual(sent[0].response.data.relations,[relation(),relation('b','x')]);assert.equal(s.snapshot().pending,null);}finally{s.close();}
});
test('multi-block assignments reach the engine unchanged and no-blocks needs explicit confirmation',async()=>{
 const {s,sent}=fixture({constraint:'engineValidated',groups:false});try{await s.open();s.toggleRelation('combat','a','x');s.toggleRelation('combat','a','y');assert.equal(sent.length,0);assert.throws(()=>s.setRelationGroup('combat','a',2),/STALE_CHOICE/);await s.confirm();assert.deepEqual(sent[0].response.data.relations,[relation(),relation('a','y')]);s.selectNone('combat');assert.equal(sent.length,1);await s.confirm();assert.deepEqual(sent[1].response.data.relations,[]);}finally{s.close();}
});
