// Session-only anti-stall budget. Call only with current authority context.
// This module proposes a concession; the engine must validate/apply it once.
// Priority's separate 30-second legal-pass clock is unchanged.
export const DEFAULT_INACTIVITY_MS=90_000;
export const DEFAULT_TURN_LIMIT_MS=300_000;
export const DEFAULT_BUDGET_WARNING_MS=30_000;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const id=v=>typeof v==='string'&&/^[-\w]{1,80}$/.test(v);
function context(raw){
 if(!object(raw)||!integer(raw.revision)||!integer(raw.turn)||![0,1].includes(raw.activeSeat)||typeof raw.humanCanAct!=='boolean'||typeof raw.canConcede!=='boolean'||!(raw.terminal===undefined||raw.terminal===null||typeof raw.terminal==='boolean'||object(raw.terminal)))throw Error('BAD_TURN_CONTEXT');
 return {revision:raw.revision,turn:raw.turn,activeSeat:raw.activeSeat,humanCanAct:raw.humanCanAct,canConcede:raw.canConcede,terminal:Boolean(raw.terminal)};
}
const same=(a,b)=>a&&a.revision===b.revision&&a.turn===b.turn&&a.activeSeat===b.activeSeat&&a.humanCanAct===b.humanCanAct&&a.canConcede===b.canConcede&&a.terminal===b.terminal;
export function createTurnBudget({humanSeat=0,inactivityMs=DEFAULT_INACTIVITY_MS,turnLimitMs=DEFAULT_TURN_LIMIT_MS,warningMs=DEFAULT_BUDGET_WARNING_MS,now=()=>Date.now(),newId=()=>`budget-${crypto.randomUUID()}`}={}){
 if(![0,1].includes(humanSeat)||![inactivityMs,turnLimitMs].every(n=>Number.isSafeInteger(n)&&n>0)||!integer(warningMs)||typeof now!=='function'||typeof newId!=='function')throw Error('BAD_TURN_OPTIONS');
 let seen=null,hard=null,idle=null,latestTime=0;
 const acknowledged=new Map();
 const time=()=>{const value=now();if(!integer(value))throw Error('BAD_TURN_TIME');latestTime=Math.max(latestTime,value);return latestTime;};
 const token=()=>{const value=newId();if(!id(value))throw Error('BAD_TURN_ID');return value;};
 const deadline=(start,duration)=>{const value=start+duration;if(!integer(value))throw Error('BAD_TURN_DEADLINE');return value;};
 const idleRemaining=t=>idle?Math.max(0,idle.remainingMs-(idle.runningSince===null?0:t-idle.runningSince)):null;
 function describe(c,t){
  if(!seen)return {state:'unarmed'};
  if(!same(seen,c))return {state:'stale-budget'};
  if(c.terminal)return {state:'terminal'};
  const idleRemainingMs=idleRemaining(t),turnRemainingMs=hard?Math.max(0,hard.deadlineAt-t):null;
  const reason=turnRemainingMs===0?'turn-limit':idleRemainingMs===0?'inactivity':null;
  const chosen=reason==='turn-limit'?hard:reason==='inactivity'?idle:null;
  const remainingMs=Math.min(...[idleRemainingMs,turnRemainingMs].filter(v=>v!==null));
  const detail={idleRemainingMs,turnRemainingMs,remainingMs:Number.isFinite(remainingMs)?remainingMs:null,warning:Number.isFinite(remainingMs)&&remainingMs<=warningMs,expired:Boolean(reason),reason,turnDeadlineAt:hard?.deadlineAt??null,idleDeadlineAt:idle?.runningSince===null?null:idle?deadline(idle.runningSince,idle.remainingMs):null};
  if(chosen&&acknowledged.has(chosen.requestId))return {state:'committed',...detail,requestId:chosen.requestId,acceptedRevision:acknowledged.get(chosen.requestId)};
  return {state:reason?(c.humanCanAct&&c.canConcede?'expired':'waiting-for-human'):c.humanCanAct?'waiting':'waiting-for-human',...detail};
 }
 function observe(raw,{acceptedHumanAction=false}={}){
  const c=context(raw),t=time();if(typeof acceptedHumanAction!=='boolean')throw Error('BAD_TURN_OBSERVATION');
  if(seen&&(c.revision<seen.revision||c.turn<seen.turn||c.revision===seen.revision&&!same(seen,c)))return {state:'stale-budget'};
  if(seen&&c.revision===seen.revision)return describe(c,t);
  // Settle elapsed human-action time before changing actor or resetting idle.
  // CPU thinking/response time does not consume inactivity; own-turn hard time
  // continues regardless of actor and never resets on legal repeated actions.
  const remaining=idleRemaining(t);
  if(idle){idle.remainingMs=remaining;idle.runningSince=null;}
  const accepted=Boolean(seen)&&acceptedHumanAction;
  if(!idle||accepted&&remaining>0)idle={remainingMs:inactivityMs,runningSince:null,requestId:token()};
  if(c.activeSeat===humanSeat){
   if(!hard||hard.turn!==c.turn)hard={turn:c.turn,startedAt:t,deadlineAt:deadline(t,turnLimitMs),requestId:token()};
  }else hard=null;
  if(c.humanCanAct&&!c.terminal)idle.runningSince=t;
  seen=c;return describe(c,t);
 }
 function inspect(raw){return describe(context(raw),time());}
 function propose(raw){
  const c=context(raw),status=describe(c,time());if(status.state!=='expired')return status;
  const selected=status.reason==='turn-limit'?hard:idle;
  return {...status,state:'forfeit-proposal',requestId:selected.requestId,revision:c.revision,turn:c.turn,activeSeat:c.activeSeat,deadlineAt:status.reason==='turn-limit'?status.turnDeadlineAt:status.idleDeadlineAt,action:{kind:'concede'}};
 }
 function validate(proposal,raw){
  const expected=propose(raw);
  if(expected.state!=='forfeit-proposal')return {ok:false,state:expected.state};
  if(!object(proposal)||proposal.state!=='forfeit-proposal'||!['requestId','revision','turn','activeSeat','deadlineAt','reason'].every(k=>proposal[k]===expected[k])||!object(proposal.action)||Object.keys(proposal.action).length!==1||proposal.action.kind!=='concede')return {ok:false,state:'stale-budget'};
  return {ok:true,requestId:expected.requestId,expectedRevision:expected.revision,reason:expected.reason,action:{kind:'concede'}};
 }
 function acknowledge(proposal,acceptedRevision){
  if(acknowledged.get(proposal?.requestId)===acceptedRevision)return;
  const valid=validate(proposal,seen);
  if(!valid.ok||acceptedRevision!==valid.expectedRevision+1)throw Error('STALE_BUDGET_ACK');
  acknowledged.set(valid.requestId,acceptedRevision);
 }
 return {observe,inspect,propose,validate,acknowledge};
}
