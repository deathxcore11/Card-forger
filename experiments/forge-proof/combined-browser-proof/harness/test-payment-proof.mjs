// Synthetic observer regressions, not browser/native gameplay acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMimicPaymentProof} from './payment-proof.mjs';
import {actionEvent} from './action-diagnostics.mjs';
const card={id:7,name:'Metallic Mimic',type:'Artifact Creature',tapped:false};
const lands=[1,2].map(id=>({id,name:'Plains',type:'Basic Land',tapped:false}));
const mana={W:0,U:0,B:0,R:0,G:0,C:0};
function state(revision=10){return {revision,viewer:0,activePlayer:0,turn:3,phase:'MAIN1',controlMode:'smart',
 busy:false,prompt:null,nativeAutoPayments:0,stack:[],players:[{id:0,isViewer:true,life:40,mana:{...mana},zones:{
  Hand:{cards:[{...card}]},Battlefield:{cards:structuredClone(lands)}}}]};}
function paid(revision=11){const s=state(revision);s.nativeAutoPayments=1;s.players[0].zones.Hand.cards=[];
 s.players[0].zones.Battlefield.cards.forEach(c=>c.tapped=true);s.stack=[{id:90,source:{...card}}];return s;}
function resolved(revision=12){const s=paid(revision);s.stack=[];s.players[0].zones.Battlefield.cards.push({...card});return s;}
function begin(){const proof=createMimicPaymentProof(state(),card.id);proof.request({action:{op:'card',id:card.id}});
 proof.receipt({stage:'native creature tap',state:'accepted'});return proof;}
test('repeated stack snapshots count one cast/payment and completion requires resumed controls',()=>{
 const p=begin();p.observe(paid());p.observe(paid());p.observe(paid(12));const partial=p.resolve(resolved(13));
 assert.equal(partial.result,'incomplete');assert.equal(partial.controlsResumed,false);
 const result=p.finish(resolved(14));assert.equal(result.result,'passed');
 assert.deepEqual([result.castRequests,result.castAccepted,result.stackEntries,result.uniqueStackItems,result.maxStackCopies,result.autoPayments,result.tappedLands],[1,1,1,1,1,1,2]);
 assert.equal(JSON.stringify(result).includes('Metallic Mimic'),false);
});
test('a second submission for the same card fails even with a new deduplication ID',()=>{
 const p=begin();assert.throws(()=>p.request({commandId:'different',action:{op:'card',id:card.id}}),/duplicate Mimic request/);
});
test('two stack copies or two distinct stack entries cannot pass',()=>{
 for(const second of [90,91]){const p=begin(),s=paid();s.stack.push({id:second,source:{...card}});assert.throws(()=>p.observe(s),/duplicate stack spell/);}
});
test('a disappearing spell re-entering the stack is counted twice',()=>{
 const p=begin();p.observe(paid());const gap=paid(12);gap.stack=[];p.observe(gap);
 assert.throws(()=>p.observe(paid(13)),/more than once/);
});
test('multiple native Auto payments fail',()=>{
 const p=begin(),s=paid();s.nativeAutoPayments=2;assert.throws(()=>p.observe(s),/payment count differs/);
});
test('a resolved permanent alone cannot substitute for observing its stack entry',()=>{
 assert.throws(()=>begin().resolve(resolved()),/stack entry was not observed/);
});
test('wrong resource payment or a later turn cannot pass',()=>{
 const changes=[s=>s.players[0].zones.Battlefield.cards[0].tapped=false,
  s=>s.players[0].life--,s=>s.players[0].mana.W++,s=>s.turn++,s=>s.nativeAutoPayments=0];
 for(const change of changes){const p=begin();p.observe(paid());const end=resolved();change(end);assert.throws(()=>p.resolve(end));}
});
test('busy, mandatory-choice and unchanged-revision controls do not count as recovered',()=>{
 for(const change of [s=>s.busy=true,s=>s.prompt={id:4},s=>s.revision=12,s=>s.controlMode='full']){
  const p=begin();p.observe(paid());p.resolve(resolved());const next=resolved(13);change(next);assert.throws(()=>p.finish(next));
 }
});
test('uncertain or rejected cast receipt cannot pass as acceptance',()=>{
 for(const outcome of ['unknown','pending_outcome_unknown','rejected']){
  const p=createMimicPaymentProof(state(),card.id);assert.throws(()=>p.receipt({stage:'native creature tap',state:outcome}),/must be bound and accepted/);
 }
});
test('payment and resources stay single while controls recover after resolution',()=>{
 for(const change of [s=>s.nativeAutoPayments++,s=>s.players[0].life--,s=>s.players[0].mana.W++,s=>s.players[0].zones.Battlefield.cards[0].tapped=false,s=>s.stack=[{id:90,source:{...card}}]]){
  const p=begin();p.observe(paid());p.resolve(resolved());const next=resolved(13);change(next);assert.throws(()=>p.finish(next));
 }
 const p=begin();p.observe(paid());p.resolve(resolved());assert.throws(()=>p.request({action:{op:'card',id:card.id}}),/duplicate Mimic request/);
});
test('the proof refuses a different starting decision, existing mana or tapped land',()=>{
 for(const change of [s=>s.controlMode='full',s=>s.phase='MAIN2',s=>s.players[0].mana.W=1,s=>s.players[0].zones.Battlefield.cards[0].tapped=true]){
  const s=state();change(s);assert.throws(()=>createMimicPaymentProof(s,card.id));
 }
});
test('event ordering metadata cannot retain arbitrary private values',()=>{
 const privateValue='PRIVATE_CANARY';const event=actionEvent({order:4,event:'action-submitted',requestRevision:10,
  commandHash:'a'.repeat(64),generationHash:['b'.repeat(64)],operation:'card',card:privateValue,body:privateValue,
  inputType:{privateValue},decisionId:true,busy:privateValue,state:privateValue});
 assert.equal(event.order,4);assert.equal(event.commandHash,'a'.repeat(64));assert.equal(event.generationHash,null);
 assert.equal(event.inputType,'unknown');assert.equal(event.decisionId,null);assert.equal(event.busy,null);
 assert.equal(JSON.stringify(event).includes(privateValue),false);
});
