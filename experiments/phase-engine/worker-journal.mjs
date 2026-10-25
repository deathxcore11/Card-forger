// Research transport only. No UI, card coverage or opponent-strength certification.
import {createPriorityClock} from './priority-clock.mjs';
import {humanCommand} from './human-command.mjs';
import {interactionSubmission} from './interaction-surface.mjs';
import {Fault,fail} from './protocol-fault.mjs';
export {Fault,fail} from './protocol-fault.mjs';
export function packet(m) {
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['v','epoch','id','op','revision','seed','first','choice','submission','command'].includes(k)))fail('BAD_REQUEST');
 if(typeof m.id!=='string'||typeof m.epoch!=='string'||m.v!==1||!['create','resume','status','step','respond','tick','act'].includes(m.op)||!/^[-\w]{1,80}$/.test(m.id||'')||!/^[-\w]{1,80}$/.test(m.epoch||''))fail('BAD_REQUEST');
 if(m.op==='create'&&(!Number.isInteger(m.seed)||m.seed<0||m.seed>0xffffffff||![0,1].includes(m.first)))fail('BAD_REQUEST');
 if(['step','respond','tick','act'].includes(m.op)&&(!Number.isSafeInteger(m.revision)||m.revision<0))fail('BAD_REQUEST');
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
 if(!s.history.every(h=>recordObject(h)&&Number.isSafeInteger(h.actor)&&h.actor>=0&&recordObject(h.action)&&typeof h.action.type==='string'))return false;
 return Object.entries(s.receipts).every(([id,r])=>/^[-\w]{1,80}$/.test(id)&&recordObject(r)&&typeof r.fingerprint==='string'&&recordObject(r.response)&&Number.isSafeInteger(r.response.revision)&&r.response.revision>0&&r.response.revision<=s.revision);
}
// Durable receipts and engine state are one atomic record. Unknown engine errors
// never cross the boundary. Serialization prevents overlapping WASM mutations.
export function createJournal({engine,storage,choose,version,epoch,timing=null}) {
 let clock=null;
 let current=null,queue=Promise.resolve(),poisoned=false;
 const fingerprint=m=>{const parts=[m.op,m.revision??null,m.seed??null,m.first??null];if(m.choice!==undefined)parts.push(m.choice);if(m.submission!==undefined)parts.push(interactionSubmission(m.submission));if(m.command!==undefined)parts.push(humanCommand(m.command));return JSON.stringify(parts);};
 const clockContext=revision=>({...engine.clockContext(revision),matchId:timing.matchId,revision});
 const makeClock=saved=>createPriorityClock({...timing,saved});
 const armClock=(revision,saved=null)=>{const c=makeClock(saved);if(c.arm(clockContext(revision)).state==='stale-clock')fail('CLOCK_CONTEXT_MISMATCH');return c;};
 const clockSummary=(revision,c=clock)=>timing?{clock:c.inspect(clockContext(revision))}:{};
 const summary=()=>({...engine.summary(current.revision),revision:current.revision,...clockSummary(current.revision)});
 async function execute(raw) {
  const m=packet(raw);if(m.epoch!==epoch)fail('STALE_SESSION');
  if(poisoned)fail('RECOVERY_REQUIRED');
  if(m.op==='create'||m.op==='resume') {
   if(current)fail('ALREADY_OPEN');
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
    const next={schema:1,version,seed:m.seed,first:m.first,revision:0,policyRng:0x63d34a91,history:[],receipts:{},engine:engine.save()};
    if(timing){clock=armClock(0);next.clock=clock.snapshot();}
    await storage.write(next,null);current=next;return summary();
   }catch(error){poisoned=true;throw error;}
  }
  if(!current)fail('NOT_OPEN');
  if(m.op==='status')return summary();
  const prior=Object.hasOwn(current.receipts,m.id)?current.receipts[m.id]:null,fp=fingerprint(m);
  if(prior){if(prior.fingerprint!==fp)fail('ID_COLLISION');return structuredClone(prior.response);}
  if(m.revision!==current.revision)fail('STALE_REVISION');
  if(current.revision>=20000)fail('ACTION_LIMIT');
  if(engine.summary(current.revision).terminal)fail('GAME_OVER');
  let actor,action,policyRng=current.policyRng;
  if(m.op==='tick'){
   if(!timing)fail('TIMER_UNAVAILABLE');
   const legal=engine.legal(),ctx=clockContext(current.revision);
   const proposal=clock.propose(ctx,legal.actor===ctx.actor?legal.actions:[]);
   if(proposal.state!=='timeout-proposal')return {...summary(),clock:proposal};
   const fresh=engine.legal(),valid=clock.validate(proposal,clockContext(current.revision),fresh.actor===ctx.actor?fresh.actions:[]);
   if(!valid.ok)fail('STALE_TIMEOUT');
   actor=valid.actor;action=valid.action;
  }else if(m.op==='act'){
   if(typeof engine.act!=='function'||engine.humanSeat!==0)fail('HUMAN_ROUTE_UNAVAILABLE');
   actor=0;action={type:'HumanCast',data:humanCommand(m.command)};
  }else if(m.op==='respond'){
   if(typeof engine.respond!=='function'||engine.humanSeat!==0)fail('HUMAN_ROUTE_UNAVAILABLE');
   actor=engine.humanSeat;action={type:'InteractionSubmission',data:interactionSubmission(m.submission)};
  }else{
  const legal=engine.legal();
  if(!legal.actions?.length)fail('NO_LEGAL_ACTOR');
  // The decision worker sees summaries, never an engine save, events, object
  // handles, unknown card identities or ordered libraries.
  const proposal=await choose(legal.actions,current.policyRng,{choice:m.choice,revision:current.revision,actor:legal.actor});
  if(!recordObject(proposal)||!Number.isInteger(proposal.index)||proposal.index<0||proposal.index>=legal.actions.length||!Number.isInteger(proposal.rng)||proposal.rng<0||proposal.rng>0xffffffff)fail('BAD_PROPOSAL');
  action=legal.actions[proposal.index];const now=engine.legal();
  if(now.actor!==legal.actor||!now.actions.some(a=>JSON.stringify(a)===JSON.stringify(action)))fail('STALE_ACTION');
   actor=legal.actor;policyRng=proposal.rng;
  }
  try {
   if(m.op==='respond'||m.op==='act'){
    const applied=m.op==='act'?engine.act(action.data):engine.respond(action.data);
    if(applied===false)return {rejected:true,reason:'ENGINE_REJECTED',...summary()};
    if(applied!==true)fail('INVALID_ENGINE_RESPONSE');
   }else engine.apply(actor,action);
   const next={...current,revision:current.revision+1,policyRng,
    history:[...current.history,{actor,action}],engine:engine.save(),receipts:{...current.receipts}};
   const nextClock=timing?armClock(next.revision,current.clock):null;
   if(timing)next.clock=nextClock.snapshot();
   const response={...engine.summary(next.revision),revision:next.revision,...clockSummary(next.revision,nextClock)};
   Object.defineProperty(next.receipts,m.id,{value:{fingerprint:fp,response},enumerable:true,writable:true,configurable:true});
   // Compare-and-write prevents a second tab/worker overwriting this match.
   await storage.write(next,current.revision);
   current=next;clock=nextClock;return structuredClone(response);
  } catch(error) {
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


