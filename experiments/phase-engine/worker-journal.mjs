// Research transport only. No UI, card coverage or opponent-strength certification.
import {createPriorityClock} from './priority-clock.mjs';
import {createTurnBudget} from './turn-budget.mjs';
import {humanCommand} from './human-command.mjs';
import {interactionSubmission} from './interaction-surface.mjs';
import {Fault,fail} from './protocol-fault.mjs';
import {appendRandomOutcomes,validOutcomeTimeline} from './random-outcomes.mjs';
import {FLOW_PHASES} from './priority-flow.mjs';
import {terminalOutcome} from './match-result.mjs';
export {Fault,fail} from './protocol-fault.mjs';
export function packet(m) {
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['v','epoch','id','op','revision','seed','first','choice','submission','command','decisionId'].includes(k)))fail('BAD_REQUEST');
 if(typeof m.id!=='string'||typeof m.epoch!=='string'||m.v!==1||!['create','resume','status','step','respond','tick','act','autoPass'].includes(m.op)||!/^[-\w]{1,80}$/.test(m.id||'')||!/^[-\w]{1,80}$/.test(m.epoch||''))fail('BAD_REQUEST');
 if(m.op==='create'&&(!Number.isInteger(m.seed)||m.seed<0||m.seed>0xffffffff||![0,1].includes(m.first)))fail('BAD_REQUEST');
 if(['step','respond','tick','act','autoPass'].includes(m.op)&&(!Number.isSafeInteger(m.revision)||m.revision<0))fail('BAD_REQUEST');
 if(m.op==='autoPass'){if(typeof m.decisionId!=='string'||!/^[-\w]{1,80}$/.test(m.decisionId))fail('BAD_REQUEST');}
 else if(Object.hasOwn(m,'decisionId'))fail('BAD_REQUEST');
 if(Object.hasOwn(m,'choice')&&(m.op!=='step'||typeof m.choice!=='string'||m.choice.length<1||m.choice.length>160||/[\u0000-\u001f\u007f]/.test(m.choice)))fail('BAD_REQUEST');
 if(m.op==='act')humanCommand(m.command);
 else if(Object.hasOwn(m,'command'))fail('BAD_REQUEST');
 if(m.op==='respond')interactionSubmission(m.submission);
 else if(Object.hasOwn(m,'submission'))fail('BAD_REQUEST');
 return m;
}
const recordObject=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
function validSave(s) {
 if(!recordObject(s)||!Number.isSafeInteger(s.revision)||s.revision<0||s.revision>20000||
  !Number.isInteger(s.policyRng)||s.policyRng<0||s.policyRng>0xffffffff||
  !Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||![0,1].includes(s.first)||
  typeof s.engine!=='string'||!s.engine.length||!Array.isArray(s.history)||s.history.length!==s.revision||!recordObject(s.receipts))return false;
 if(Object.hasOwn(s,'outcomes')&&!validOutcomeTimeline(s.outcomes,s.revision))return false;
 if(!s.history.every(h=>recordObject(h)&&Number.isSafeInteger(h.actor)&&h.actor>=0&&recordObject(h.action)&&typeof h.action.type==='string'))return false;
 return Object.entries(s.receipts).every(([id,r])=>/^[-\w]{1,80}$/.test(id)&&recordObject(r)&&typeof r.fingerprint==='string'&&recordObject(r.response)&&Number.isSafeInteger(r.response.revision)&&r.response.revision>0&&r.response.revision<=s.revision);
}
// Durable receipts and engine state are one atomic record. Unknown engine errors
// never cross the boundary. Serialization prevents overlapping WASM mutations.
export function createJournal({engine,storage,choose,version,epoch,timing=null,turnLimits=null}) {
 if(turnLimits!==null&&(!recordObject(turnLimits)||engine.humanSeat!==0||typeof engine.act!=='function'||typeof engine.clockContext!=='function'))throw Error('BAD_TURN_OPTIONS');
 const turnBudget=turnLimits===null?null:createTurnBudget({...turnLimits,now:turnLimits.now??timing?.now,humanSeat:0});
 let clock=null;
 let current=null,queue=Promise.resolve(),poisoned=false,projection=null;
 // Only this serialized authority mutates the engine. Reuse its seat projection
 // between accepted actions; countdown reads still inspect the live clock.
 const view=revision=>{if(!projection||projection.revision!==revision){const value=engine.summary(revision);if(!value.priorityCapability&&typeof engine.priorityCapability==='function')value.priorityCapability=engine.priorityCapability(revision);projection={revision,value};}return projection.value;};
 const fingerprint=m=>{const parts=[m.op,m.revision??null,m.seed??null,m.first??null];if(m.decisionId!==undefined)parts.push(m.decisionId);if(m.choice!==undefined)parts.push(m.choice);if(m.submission!==undefined)parts.push(interactionSubmission(m.submission));if(m.command!==undefined)parts.push(humanCommand(m.command));return JSON.stringify(parts);};
 const clockContext=revision=>({...engine.clockContext(revision),matchId:timing.matchId,revision});
 const makeClock=saved=>createPriorityClock({...timing,saved});
 const armClock=(revision,saved=null)=>{const c=makeClock(saved);if(c.arm(clockContext(revision)).state==='stale-clock')fail('CLOCK_CONTEXT_MISMATCH');return c;};
 const clockSummary=(revision,c=clock)=>timing?{clock:c.inspect(clockContext(revision))}:{};
 const budgetContext=revision=>{const s=view(revision),c=engine.clockContext(revision);return {revision,turn:s.surface?.turn??s.turn,activeSeat:s.surface?.activeSeat,humanCanAct:c.actor===0,canConcede:engine.humanSeat===0&&typeof engine.act==='function'&&!s.terminal,terminal:s.terminal};};
 const turnSummary=revision=>turnBudget?{turnClock:turnBudget.inspect(budgetContext(revision))}:{};
 const observeTurn=(revision,acceptedHumanAction=false)=>{if(turnBudget&&turnBudget.observe(budgetContext(revision),{acceptedHumanAction}).state==='stale-budget')fail('TURN_CLOCK_CONTEXT_MISMATCH');};
 const outcomeSummary=rows=>typeof engine.drainOutcomes==='function'||rows!==undefined?{outcomes:structuredClone(rows||[])}:{};
 const nextOutcomes=revision=>typeof engine.drainOutcomes==='function'?{outcomes:appendRandomOutcomes(current?.outcomes||[],engine.drainOutcomes(),revision)}:{};
 const resultView=(revision,history)=>{const value=structuredClone(view(revision));if(value.terminal)value.terminal=terminalOutcome(value.terminal,history?.at(-1)?.action);return value;};
 const summary=()=>({...resultView(current.revision,current.history),revision:current.revision,...outcomeSummary(current.outcomes),...clockSummary(current.revision),...turnSummary(current.revision)});
 // Revision context is authority-local, not supplied by the policy or UI.
 const legalNow=()=>engine.legal({epoch,revision:current.revision});
 async function execute(raw) {
  const m=packet(raw);if(m.epoch!==epoch)fail('STALE_SESSION');
  if(poisoned)fail('RECOVERY_REQUIRED');
  if(m.op==='create'||m.op==='resume') {
   if(current)fail('ALREADY_OPEN');
   if(m.op==='resume'&&turnBudget)fail('TURN_LIMITS_RESUME_UNAVAILABLE');
   const saved=await storage.read();
   if(m.op==='resume') {
    if(!saved)fail('NO_SAVE');
    if(saved.version!==version||saved.schema!==1)fail('INCOMPATIBLE_SAVE');
    if(!validSave(saved))fail('CORRUPT_SAVE');
    try{engine.restore(saved.engine);
     if(timing){
      if(!saved.clock)fail('INCOMPATIBLE_SAVE');
      clock=makeClock(saved.clock);
      if(['unarmed','stale-clock','committed'].includes(clock.inspect(clockContext(saved.revision)).state))fail('CLOCK_CONTEXT_MISMATCH');
     }
     current=saved;return summary();}
    catch(error){poisoned=true;throw error;}
   }
   if(saved)fail('ALREADY_EXISTS');
   try{
    engine.start(m.seed,m.first);
    const next={schema:1,version,seed:m.seed,first:m.first,revision:0,policyRng:0x63d34a91,history:[],receipts:{},engine:engine.save(),...nextOutcomes(0)};
    if(timing){clock=armClock(0);next.clock=clock.snapshot();}
    observeTurn(0);
    await storage.write(next,null);current=next;return summary();
   }catch(error){poisoned=true;throw error;}
  }
  if(!current)fail('NOT_OPEN');
  if(m.op==='status')return summary();
  const prior=Object.hasOwn(current.receipts,m.id)?current.receipts[m.id]:null,fp=fingerprint(m);
  if(prior){if(prior.fingerprint!==fp)fail('ID_COLLISION');return structuredClone(prior.response);}
  if(m.revision!==current.revision)fail('STALE_REVISION');
  if(current.revision>=20000)fail('ACTION_LIMIT');
  if(view(current.revision).terminal)fail('GAME_OVER');
  let actor,action,timedForfeit=null,policyRng=current.policyRng;
  const expireTurn=()=>{if(!turnBudget)return false;const ctx=budgetContext(current.revision),proposal=turnBudget.propose(ctx);if(proposal.state!=='forfeit-proposal')return false;const valid=turnBudget.validate(proposal,ctx);if(!valid.ok)fail('STALE_TIMEOUT');timedForfeit=proposal;actor=0;action={type:'HumanTimeoutConcede',data:{kind:'concede'},reason:proposal.reason,requestId:proposal.requestId,deadlineAt:proposal.deadlineAt};return true;};
  if(expireTurn()){
   // A late input cannot revive an expired budget. The concession still goes
   // through the actual engine and this same idempotent journal command.
  }else if(m.op==='autoPass'){
   // Recompute under the mutation queue. Cached UI facts never authorize a pass.
   const c=engine.priorityCapability?.(current.revision);
   if(engine.humanSeat!==0||!c||c.epoch!==epoch||c.revision!==current.revision||c.decisionId!==m.decisionId||c.actorSeat!==0||c.prioritySeat!==0||c.mandatoryChoice!==false||c.coverage!=='complete'||c.meaningfulAction!==false||c.manaWindow!==false||c.passAvailable!==true||![0,1].includes(c.activeSeat)||!FLOW_PHASES.includes(c.phase))fail('AUTO_PASS_UNAVAILABLE');
   const fresh=legalNow();actor=fresh.actor;action=fresh.actions?.find(a=>a.type==='PassPriority');
   if(actor!==0||!action)fail('AUTO_PASS_UNAVAILABLE');
  }else if(m.op==='tick'){
   if(!timing)fail('TIMER_UNAVAILABLE');
   const legal=legalNow(),ctx=clockContext(current.revision);
   const proposal=clock.propose(ctx,legal.actor===ctx.actor?legal.actions:[]);
   if(proposal.state!=='timeout-proposal')return {...summary(),clock:proposal};
   const fresh=legalNow(),valid=clock.validate(proposal,clockContext(current.revision),fresh.actor===ctx.actor?fresh.actions:[]);
   if(!valid.ok)fail('STALE_TIMEOUT');
   actor=valid.actor;action=valid.action;
  }else if(m.op==='act'){
   if(typeof engine.act!=='function'||engine.humanSeat!==0)fail('HUMAN_ROUTE_UNAVAILABLE');
   actor=0;const command=humanCommand(m.command);action={type:command.kind==='concede'?'HumanConcede':'HumanCast',data:command};
  }else if(m.op==='respond'){
   if(typeof engine.respond!=='function'||engine.humanSeat!==0)fail('HUMAN_ROUTE_UNAVAILABLE');
   actor=engine.humanSeat;action={type:'InteractionSubmission',data:interactionSubmission(m.submission)};
  }else{
  const legal=legalNow();
  if(!legal.actions?.length)fail('NO_LEGAL_ACTOR');
  // The decision worker sees summaries, never an engine save, events, object
  // handles, unknown card identities or ordered libraries.
  const proposal=await choose(legal.actions,current.policyRng,{choice:m.choice,revision:current.revision,actor:legal.actor});
  if(!recordObject(proposal)||!Number.isInteger(proposal.index)||proposal.index<0||proposal.index>=legal.actions.length||!Number.isInteger(proposal.rng)||proposal.rng<0||proposal.rng>0xffffffff)fail('BAD_PROPOSAL');
  action=legal.actions[proposal.index];const now=legalNow();
  if(now.actor!==legal.actor||!now.actions.some(a=>JSON.stringify(a)===JSON.stringify(action)))fail('STALE_ACTION');
   actor=legal.actor;policyRng=proposal.rng;
  }
  try {
   // A bounded CPU proposal can cross the deadline while it is being selected.
   // Recheck immediately before mutation, without renewing either clock.
   if(!timedForfeit)expireTurn();
   projection=null;
   if(timedForfeit||m.op==='respond'||m.op==='act'){
    const applied=(timedForfeit||m.op==='act')?engine.act(action.data):engine.respond(action.data);
    if(timedForfeit&&applied===false)fail('TIMEOUT_CONCEDE_REJECTED');
    if(applied===false)return {rejected:true,reason:'ENGINE_REJECTED',...summary()};
    if(applied!==true)fail('INVALID_ENGINE_RESPONSE');
   }else engine.apply(actor,action);
   const next={...current,revision:current.revision+1,policyRng,
    history:[...current.history,{actor,action}],engine:engine.save(),receipts:{...current.receipts},...nextOutcomes(current.revision+1)};
   const nextClock=timing?armClock(next.revision,current.clock):null;
   if(timing)next.clock=nextClock.snapshot();
   observeTurn(next.revision,actor===0&&m.op!=='tick'&&m.op!=='autoPass'&&!timedForfeit);
   const response={...resultView(next.revision,next.history),revision:next.revision,...outcomeSummary(next.outcomes),...clockSummary(next.revision,nextClock),...turnSummary(next.revision)};
   Object.defineProperty(next.receipts,m.id,{value:{fingerprint:fp,response},enumerable:true,writable:true,configurable:true});
   // Compare-and-write prevents a second tab/worker overwriting this match.
   await storage.write(next,current.revision);
   current=next;clock=nextClock;return structuredClone(response);
  } catch(error) {
   projection=null;
   try{engine.restore(current.engine);}catch{poisoned=true;}
   // A failed transaction or conflicting writer requires reloading the durable
   // record. No automatic resend and no claim that a timeout rolled back.
   poisoned=true;throw error;
  }
 }
 return raw=>{
  raw=structuredClone(raw);
  const task=queue.then(()=>execute(raw)).then(result=>({v:1,epoch,id:raw.id,ok:true,result}),
   error=>({v:1,epoch,id:typeof raw?.id==='string'?raw.id.slice(0,80):null,ok:false,error:error instanceof Fault?error.code:'RECOVERY_REQUIRED'}));
  queue=task.then(()=>undefined);return task;
 };
}


