import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPriorityFlow,priorityCapability} from './priority-flow.mjs';
import {createJournal,packet} from './worker-journal.mjs';
import {createMatchSession} from './match-session.mjs';
import {createMatchAuthority} from './match-authority.mjs';
const cap=(patch={})=>({epoch:'flow',revision:0,decisionId:'decision-0',actorSeat:0,activeSeat:1,prioritySeat:0,phase:'PreCombatMain',mandatoryChoice:false,coverage:'complete',meaningfulAction:false,manaWindow:false,passAvailable:true,...patch});
function fixture(patch={}){
 const jobs=new Map(),sent=[];let seq=0;
 const state={status:{revision:0,priorityCapability:cap(patch),terminal:null},busy:false,pending:null,error:null};
 const f=createPriorityFlow({read:()=>state,dispatch:async p=>{sent.push(p);},enqueue:fn=>{jobs.set(++seq,fn);return seq;},dequeue:id=>jobs.delete(id)});
 return {f,state,sent,jobs,async flush(){const first=jobs.entries().next().value;if(first){jobs.delete(first[0]);await first[1]();}}};
}
test('delivered engine legacy flags never establish coverage, including empty-looking windows',()=>{
 for(const autoPassRecommended of [true,false])for(const phase of ['PreCombatMain','UnknownPhase']){
  const c=priorityCapability({state:{active_player:1,phase,waiting_for:{type:'Priority',data:{player:0}},autoPassRecommended},actor:0,epoch:'flow',revision:0});
  assert.equal(c.coverage,'unknown');assert.equal(c.passAvailable,false);assert.equal(c.phase,phase==='UnknownPhase'?null:phase);
  const x=fixture(c);x.f.reconcile();assert.equal(x.jobs.size,0);assert.equal(x.f.snapshot().reason,'coverage-unknown');
 }
});
const proofValue=()=>({version:1,status:'actionless',actor:0,priorityHolder:0,floatingMana:false,passVerified:true});
const proofInput=()=>({state:{active_player:1,phase:'End',waiting_for:{type:'Priority',data:{player:0}}},actor:0,epoch:'flow',revision:3,engineProof:{epoch:'flow',revision:3,value:proofValue()}});
test('only the exact engine v1 actionless certificate permits the bound positive path',async()=>{
 const c=priorityCapability(proofInput());assert.equal(c.coverage,'complete');assert.equal(c.meaningfulAction,false);assert.equal(c.manaWindow,false);
 const x=fixture(c);x.state.status.revision=3;x.f.reconcile();assert.equal(x.jobs.size,1);await x.flush();assert.deepEqual(x.sent,[{epoch:'flow',revision:3,decisionId:'decision-3'}]);
});
test('missing, stale, malformed, nonempty and differently authorized engine certificates stop',()=>{
 const changes=[
  i=>delete i.engineProof,i=>{i.engineProof.epoch='old';},i=>{i.engineProof.revision=2;},
  i=>{i.engineProof.value=null;},i=>{i.engineProof.value.version=2;},i=>{i.engineProof.value.version='1';},
  ...['actionable','unknown','notPriority','other'].map(status=>i=>{i.engineProof.value.status=status;}),
  i=>{i.engineProof.value.passVerified=false;},i=>{i.engineProof.value.passVerified=1;},
  i=>{i.engineProof.value.actor=1;},i=>{i.engineProof.value.priorityHolder=1;},
  i=>{i.engineProof.value.floatingMana=null;},i=>{i.state.phase='UnsupportedPhase';},
  i=>{i.state.waiting_for={type:'TargetSelection',data:{player:0}};},i=>{i.actor=1;}
 ];
 for(const change of changes){const i=proofInput();change(i);const c=priorityCapability(i);assert.equal(c.coverage,'unknown');assert.equal(c.passAvailable,false);const x=fixture(c);x.state.status.revision=3;x.f.reconcile();assert.equal(x.jobs.size,0);}
});
test('an actionless certificate never spends or passes away floating mana',()=>{
 const i=proofInput();i.engineProof.value.floatingMana=true;const c=priorityCapability(i);assert.equal(c.coverage,'complete');assert.equal(c.manaWindow,true);
 const x=fixture(c);x.state.status.revision=3;x.f.reconcile();assert.equal(x.jobs.size,0);assert.equal(x.f.snapshot().reason,'mana-window');
});
test('authority recomputes optional engine certificate and fails closed on absence or exception',()=>{
 let value=proofValue(),reads=0,throws=false;
 const engine={get_filtered_game_state:()=>({state:proofInput().state}),get_viewer_snapshot_js:()=>({viewerInteraction:{}}),get_priority_capability_v1_js(seat){assert.equal(seat,0);reads++;if(throws)throw Error('FAILED_PROOF');return value;}};
 const authority=createMatchAuthority({engine,mode:'cpu-test',epoch:'flow',policyWorker:{terminate(){}}});
 try{
  assert.equal(authority.adapter.summary(3).priorityCapability.coverage,'complete');assert.equal(reads,1);
  value={...proofValue(),status:'actionable'};assert.equal(authority.adapter.priorityCapability(3).coverage,'unknown');assert.equal(reads,2);
  throws=true;assert.equal(authority.adapter.summary(4).priorityCapability.coverage,'unknown');assert.equal(reads,3);
  delete engine.get_priority_capability_v1_js;assert.equal(authority.adapter.priorityCapability(4).coverage,'unknown');assert.equal(reads,3);
 }finally{authority.close();}
});
test('known empty window queues one bound pass; unchanged acknowledgement cannot loop',async()=>{
 const x=fixture();x.f.reconcile();x.f.reconcile();assert.equal(x.jobs.size,1);assert.equal(x.f.snapshot().passState,'queued');await x.flush();assert.equal(x.sent.length,1);assert.equal(x.jobs.size,0);assert.equal(x.f.snapshot().reason,'cancelled');
});
test('unknown coverage, mana, meaningful actions, mandatory choices and drafts stop automation',()=>{
 for(const [patch,reason]of [[{coverage:'unknown'},'coverage-unknown'],[{manaWindow:true},'mana-window'],[{meaningfulAction:true},'meaningful-action'],[{mandatoryChoice:true,prioritySeat:null},'mandatory-choice'],[{phase:null},'coverage-unknown'],[{passAvailable:false},'coverage-unknown'],[{activeSeat:null},'coverage-unknown'],[{actorSeat:1,prioritySeat:1},'not-human-priority']]){
  const x=fixture(patch);x.f.yieldUntilAction();assert.equal(x.jobs.size,0);assert.equal(x.f.snapshot().reason,reason);
  if(reason!=='not-human-priority')assert.equal(x.f.snapshot().temporaryYield,false);
 }
 const x=fixture();x.state.pending={revision:0};x.f.reconcile();assert.equal(x.jobs.size,0);assert.equal(x.f.snapshot().reason,'pending-draft');
});
test('Full Control retires queued passes and yield conflicts without changing mode',async()=>{
 const x=fixture();x.f.reconcile();const stale=[...x.jobs.values()][0];x.f.setControlMode('full');assert.equal(x.jobs.size,0);await stale();assert.equal(x.sent.length,0);assert.throws(()=>x.f.yieldUntilAction(),/FULL_CONTROL/);assert.equal(x.f.snapshot().controlMode,'full');
});
test('cancellation latches at this decision, then a fresh decision can resume Smart',async()=>{
 const x=fixture();x.f.reconcile();const stale=[...x.jobs.values()][0];x.f.cancelYield();x.f.reconcile();await stale();assert.equal(x.sent.length,0);assert.equal(x.jobs.size,0);
 x.state.status={...x.state.status,revision:1,priorityCapability:cap({revision:1,decisionId:'decision-1'})};x.f.reconcile();await x.flush();assert.equal(x.sent.length,1);assert.equal(x.sent[0].revision,1);
});
test('both-seat phase stops are idempotent, stay active at same phase and reject malformed input',async()=>{
 for(const activeSeat of [0,1]){const x=fixture({activeSeat});x.f.reconcile();x.f.setPhaseStop(activeSeat,'PreCombatMain',true);x.f.setPhaseStop(activeSeat,'PreCombatMain',true);assert.equal(x.f.snapshot().stops.length,1);assert.equal(x.f.snapshot().reason,'phase-stop');assert.equal(x.jobs.size,0);
  const before=x.f.snapshot();assert.throws(()=>x.f.setPhaseStop(2,'PreCombatMain',true),/BAD_PHASE_STOP/);assert.throws(()=>x.f.setPhaseStop(activeSeat,'Guess',true),/BAD_PHASE_STOP/);assert.deepEqual(x.f.snapshot(),before);
  x.state.status.revision=1;x.state.status.priorityCapability=cap({revision:1,decisionId:'decision-1',activeSeat});x.f.reconcile();assert.equal(x.jobs.size,0);x.f.setPhaseStop(activeSeat,'PreCombatMain',false);await x.flush();assert.equal(x.sent.length,1);
 }
});
test('stale callbacks cannot pass a new mandatory decision or a retired session',async()=>{
 const x=fixture();x.f.reconcile();const stale=[...x.jobs.values()][0];x.state.status.revision=1;x.state.status.priorityCapability=cap({revision:1,decisionId:'decision-1',mandatoryChoice:true,prioritySeat:null});await stale();assert.equal(x.sent.length,0);
 const y=fixture();y.f.reconcile();const retired=[...y.jobs.values()][0];y.f.close();await retired();assert.equal(y.sent.length,0);assert.throws(()=>y.f.setControlMode('full'),/SESSION_CLOSED/);
});
test('cancellation while a pass is in flight permits its receipt but forbids the next pass',async()=>{
 let release;const jobs=[],state={status:{revision:0,priorityCapability:cap()},busy:false};let n=0;
 const f=createPriorityFlow({read:()=>state,enqueue:fn=>(jobs.push(fn),jobs.length),dequeue(){},dispatch:async()=>{n++;await new Promise(r=>release=r);state.status={revision:1,priorityCapability:cap({revision:1,decisionId:'decision-1'})};}});
 f.reconcile();const done=jobs.shift()();assert.equal(f.snapshot().passState,'submitting');f.cancelYield();release();await done;
 assert.equal(n,1);assert.equal(f.snapshot().temporaryYield,false);assert.equal(jobs.length,0);assert.equal(f.snapshot().reason,'cancelled');f.close();
});
test('a synchronous subscriber can cancel at dispatch publication before any command is sent',async()=>{
 const jobs=[];let sent=0;const state={status:{revision:0,priorityCapability:cap()}};
 const f=createPriorityFlow({read:()=>state,enqueue:fn=>(jobs.push(fn),jobs.length),dequeue(){},dispatch:async()=>{sent++;},onChange(){if(f.snapshot().passState==='submitting'&&f.snapshot().reason!=='cancelled')f.cancelYield();}});
 f.reconcile();await jobs.shift()();assert.equal(sent,0);assert.equal(f.snapshot().reason,'cancelled');f.close();
});
test('dispatch failure stops automatic retries without fabricating a result',async()=>{
 const jobs=[],errors=[];const state={status:{revision:0,priorityCapability:cap(),terminal:null}};
 const f=createPriorityFlow({read:()=>state,enqueue:fn=>(jobs.push(fn),jobs.length),dequeue(){},dispatch:async()=>{throw Error('OUTCOME_UNKNOWN');},onError:e=>errors.push(e.message)});
 f.reconcile();await jobs.shift()();f.reconcile();assert.deepEqual(errors,['OUTCOME_UNKNOWN']);assert.equal(jobs.length,0);assert.equal(state.status.terminal,null);f.close();
});
function journalFixture(){
 let saved=null,revision=0,accepted=0,c=cap();
 const engine={humanSeat:0,start(){},save:()=>String(revision),restore:s=>{revision=Number(s);},summary:()=>({terminal:null}),priorityCapability:r=>({...c,revision:r}),legal:()=>({actor:0,actions:[{type:'PassPriority'}]}),apply(){accepted++;revision++;}};
 const journal=createJournal({engine,epoch:'flow',version:'test',storage:{read:async()=>saved,write:async v=>{saved=structuredClone(v);}},choose(){throw Error('NO_POLICY_FOR_AUTO_PASS');}});
 const send=(op,id,fields={})=>journal({v:1,epoch:'flow',id,op,...fields});
 return {send,set capability(v){c=v;},get accepted(){return accepted;},get saved(){return saved;}};
}
test('authority recomputes coverage after projection; refused auto-pass leaves journal untouched',async()=>{
 const x=journalFixture();const first=await x.send('create','open',{seed:1,first:0});assert.equal(first.result.priorityCapability.coverage,'complete');x.capability=cap({coverage:'unknown'});
 const rejected=await x.send('autoPass','auto',{revision:0,decisionId:'decision-0'});assert.equal(rejected.error,'AUTO_PASS_UNAVAILABLE');assert.equal(x.accepted,0);assert.equal(x.saved.revision,0);
});
test('authority serializes duplicate/competing passes and binds receipt to exact decision',async()=>{
 const x=journalFixture();await x.send('create','open',{seed:1,first:0});
 const a={revision:0,decisionId:'decision-0'},results=await Promise.all([x.send('autoPass','auto',a),x.send('autoPass','auto',a),x.send('autoPass','other',a)]);
 assert(results[0].ok);assert.deepEqual(results[0],results[1]);assert.equal(results[2].error,'STALE_REVISION');assert.equal(x.accepted,1);
 assert.equal((await x.send('autoPass','auto',{...a,decisionId:'different'})).error,'ID_COLLISION');
});
test('authority refuses each unsafe gate even if a legal pass exists',async()=>{
 for(const patch of [{actorSeat:1},{prioritySeat:1},{mandatoryChoice:true},{manaWindow:true},{meaningfulAction:true},{passAvailable:false},{phase:null},{epoch:'other'},{decisionId:'other'}]){
  const x=journalFixture();x.capability=cap(patch);await x.send('create','open',{seed:1,first:0});assert.equal((await x.send('autoPass','auto',{revision:0,decisionId:'decision-0'})).error,'AUTO_PASS_UNAVAILABLE');assert.equal(x.accepted,0);
 }
 assert.throws(()=>packet({v:1,epoch:'flow',id:'a',op:'autoPass',revision:0}),/BAD_REQUEST/);
});
test('real session exposes controls, preserves unknown windows, and retires methods on close',async()=>{
 const calls=[],current={revision:0,priorityCapability:cap({coverage:'unknown'}),terminal:null,clock:{state:'other-actor'},surface:{cards:[],awaitingHuman:true,canAct:false,choices:[],interaction:{opportunities:[]}}};
 const session=createMatchSession({client:{async request(op){calls.push(op);return structuredClone(current);},close(){}}});
 await session.open();assert.equal(session.snapshot().turnFlow.reason,'coverage-unknown');session.setControlMode('full');assert.equal(session.snapshot().turnFlow.reason,'full-control');session.setPhaseStop(1,'Draw',true);assert.equal(session.snapshot().turnFlow.stops.length,1);session.setControlMode('smart');session.yieldUntilAction();await new Promise(r=>setTimeout(r,5));assert(!calls.includes('autoPass'));session.close();assert.throws(()=>session.cancelYield(),/SESSION_CLOSED/);
});
