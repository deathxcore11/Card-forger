// Research contract only; this is not a mounted UI or a complete no-stall policy.
// Only the rules authority may arm/restore this clock and supply current context
// and legal actions. The default wall clock continues through suspension and a
// browser restart. A production multiplayer clock needs a trusted time source.
// Persist snapshot() atomically with the accepted match/checkpoint. Reading,
// rejected input, opening a menu and reconnecting never re-arm an existing key.
export const DEFAULT_RESPONSE_WINDOW_MS=30_000;
export const CLOCK_POLICY='wall-clock-continues-v1';
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const token=s=>typeof s==='string'&&s.length>0&&s.length<=160&&!/[\u0000-\u001f\u007f]/.test(s);
const requestId=s=>typeof s==='string'&&/^[-\w]{1,80}$/.test(s);
const same=(a,b)=>a.matchId===b.matchId&&a.revision===b.revision&&a.actor===b.actor&&a.decisionId===b.decisionId&&a.kind===b.kind;
const legalPass=(actions,action)=>Array.isArray(actions)&&actions.some(a=>object(a)&&a.type==='PassPriority'&&JSON.stringify(a)===JSON.stringify(action));
function context(c,matchId){
 if(!object(c)||c.matchId!==matchId||!integer(c.revision)||!integer(c.actor)||!token(c.decisionId)||!token(c.kind))throw Error('BAD_CLOCK_CONTEXT');
 return {matchId:c.matchId,revision:c.revision,actor:c.actor,decisionId:c.decisionId,kind:c.kind};
}
export function createPriorityClock({matchId,humanActor=0,windowMs,now=()=>Date.now(),newId=()=>`timeout-${crypto.randomUUID()}`,saved=null}={}) {
 windowMs??=saved?.windowMs??DEFAULT_RESPONSE_WINDOW_MS;
 if(!requestId(matchId)||!integer(humanActor)||!Number.isSafeInteger(windowMs)||windowMs<=0||typeof now!=='function'||typeof newId!=='function')throw Error('BAD_CLOCK_OPTIONS');
 let record={schema:1,policy:CLOCK_POLICY,matchId,humanActor,windowMs,current:null};
 if(saved!==null){
  if(!object(saved)||saved.schema!==1||saved.policy!==CLOCK_POLICY||saved.matchId!==matchId||saved.humanActor!==humanActor||saved.windowMs!==windowMs)throw Error('INCOMPATIBLE_CLOCK');
  if(saved.current!==null){
   const r=saved.current;context(r?.context,matchId);
   if(!object(r)||typeof r.suspended!=='boolean'||typeof r.committed!=='boolean')throw Error('CORRUPT_CLOCK');
   if(r.context.actor===humanActor){
    if(!integer(r.startedAt)||!integer(r.deadlineAt)||r.deadlineAt-r.startedAt!==windowMs||!requestId(r.requestId))throw Error('CORRUPT_CLOCK');
   }else if(r.startedAt!==null||r.deadlineAt!==null||r.requestId!==null||r.committed)throw Error('CORRUPT_CLOCK');
   if(r.committed&&r.acceptedRevision!==r.context.revision+1)throw Error('CORRUPT_CLOCK');
  }
  record=structuredClone(saved);
 }
 function time(){const t=now();if(!integer(t))throw Error('BAD_CLOCK_TIME');return t;}
 function inspect(raw){
  const c=context(raw,matchId),r=record.current;
  if(!r)return {state:'unarmed'};
  if(!same(r.context,c))return {state:'stale-clock'};
  if(c.actor!==humanActor)return {state:'other-actor'};
  const detail={deadlineAt:r.deadlineAt,requestId:r.requestId};
  if(r.committed)return {state:'committed',...detail,acceptedRevision:r.acceptedRevision};
  const remainingMs=Math.max(0,r.deadlineAt-time());
  if(r.suspended)return {state:'suspended',...detail,remainingMs,expired:remainingMs===0};
  return {state:remainingMs===0?'expired':'waiting',...detail,remainingMs};
 }
 function arm(raw){
  const c=context(raw,matchId),r=record.current;
  if(r&&same(r.context,c))return inspect(c);
  // A changed actor/prompt cannot reset a deadline at the same accepted revision.
  if(r&&c.revision<=r.context.revision)return {state:'stale-clock'};
  const startedAt=c.actor===humanActor?time():null,id=c.actor===humanActor?newId():null;
  if(c.actor===humanActor&&(!requestId(id)||!Number.isSafeInteger(startedAt+windowMs)))throw Error('BAD_CLOCK_ID_OR_DEADLINE');
  record.current={context:c,startedAt,deadlineAt:startedAt===null?null:startedAt+windowMs,requestId:id,suspended:false,committed:false};
  return inspect(c);
 }
 function propose(raw,actions){
  const c=context(raw,matchId),status=inspect(c);
  if(status.state!=='expired')return status;
  // Required targets, payments, blockers, searches, etc. never become an
  // invented pass, selected target or loss merely because time elapsed.
  if(c.kind!=='Priority')return {...status,state:'timeout-needs-choice',reason:'mandatory-choice'};
  const action=Array.isArray(actions)?actions.find(a=>object(a)&&a.type==='PassPriority'):null;
  if(!action)return {...status,state:'timeout-needs-choice',reason:'no-legal-pass'};
  return {state:'timeout-proposal',...structuredClone(c),deadlineAt:status.deadlineAt,requestId:status.requestId,action:structuredClone(action)};
 }
 function validate(proposal,raw,actions){
  const c=context(raw,matchId),status=inspect(c);
  if(status.state!=='expired')return {ok:false,state:status.state};
  if(c.kind!=='Priority')return {ok:false,state:'timeout-needs-choice'};
  if(!object(proposal)||proposal.state!=='timeout-proposal'||!same(proposal,c)||proposal.requestId!==status.requestId||proposal.deadlineAt!==status.deadlineAt)return {ok:false,state:'stale-clock'};
  if(!legalPass(actions,proposal.action))return {ok:false,state:'timeout-needs-choice'};
  // Call immediately before submitting through the revision/seat-checked engine
  // command path. This module itself never applies a game action.
  return {ok:true,requestId:status.requestId,expectedRevision:c.revision,actor:c.actor,action:structuredClone(proposal.action)};
 }
 function acknowledge(proposal,acceptedRevision){
  const r=record.current;
  if(!r||r.context.actor!==humanActor||r.context.kind!=='Priority'||!object(proposal)||proposal.state!=='timeout-proposal'||proposal.action?.type!=='PassPriority'||!same(r.context,proposal)||proposal.requestId!==r.requestId||proposal.deadlineAt!==r.deadlineAt||acceptedRevision!==r.context.revision+1)throw Error('STALE_TIMEOUT_ACK');
  // Only call after the authority durably accepted this exact timeout command.
  // An unknown commit outcome keeps the same ID for idempotent recovery/retry.
  if(r.committed&&r.acceptedRevision===acceptedRevision)return;
  r.committed=true;r.acceptedRevision=acceptedRevision;
 }
 function suspend(raw){const c=context(raw,matchId);if(!record.current||!same(record.current.context,c))return {state:'stale-clock'};record.current.suspended=true;return inspect(c);}
 function resume(raw){const c=context(raw,matchId);if(!record.current||!same(record.current.context,c))return {state:'stale-clock'};record.current.suspended=false;return inspect(c);}
 return {arm,inspect,propose,validate,acknowledge,suspend,resume,snapshot:()=>structuredClone(record)};
}
