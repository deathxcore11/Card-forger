// Session policy only. Authority supplies decision facts and revalidates a pass.
// Neither cards, legacy recommendations nor UI choices establish completeness.
export const FLOW_PHASES=Object.freeze(['Untap','Upkeep','Draw','PreCombatMain','BeginCombat','DeclareAttackers','DeclareBlockers','CombatDamage','EndCombat','PostCombatMain','End','Cleanup']);
const seat=n=>n===0||n===1;
export function priorityCapability({state,actor,epoch,revision,engineProof}={}){
 const priority=state?.waiting_for?.type==='Priority';
 const proof=engineProof?.value;
 // The authority supplies either the native reducer-family certificate or a
 // bounded response proof for the pinned shipped runtime. Neither proof comes
 // from UI input or absence in an AI action list. Unknown/stale proofs stop.
 const complete=priority&&seat(actor)&&seat(state?.active_player)&&FLOW_PHASES.includes(state?.phase)
  &&typeof epoch==='string'&&Number.isSafeInteger(revision)&&revision>=0
  &&engineProof?.epoch===epoch&&engineProof?.revision===revision
  &&proof?.version===1&&(proof.status==='actionless'||proof.status==='no-response'&&proof.source==='shipped-response-v1')&&proof.passVerified===true
  &&proof.actor===actor&&proof.priorityHolder===state.waiting_for.data?.player
  &&proof.actor===proof.priorityHolder&&typeof proof.floatingMana==='boolean';
 return {epoch,revision,decisionId:`decision-${revision}`,actorSeat:seat(actor)?actor:null,
  activeSeat:seat(state?.active_player)?state.active_player:null,
  prioritySeat:priority&&seat(state.waiting_for.data?.player)?state.waiting_for.data.player:null,
  phase:FLOW_PHASES.includes(state?.phase)?state.phase:null,
  mandatoryChoice:actor===0&&!priority&&state?.waiting_for?.type!=='GameOver',
  // RULES-004: neither legacy recommendation nor a union of offers is a proof.
  coverage:complete?'complete':'unknown',meaningfulAction:complete?false:null,
  manaWindow:complete?proof.floatingMana:null,passAvailable:complete};
}
export function createPriorityFlow({read,dispatch,onChange=()=>{},onError=()=>{},enqueue=fn=>setTimeout(fn,0),dequeue=clearTimeout}={}){
 if(typeof read!=='function'||typeof dispatch!=='function')throw Error('BAD_FLOW_OPTIONS');
 let controlMode='smart',temporaryYield=false,stops=[],closed=false,generation=0,queued=null,submitting=false,cancelledDecision=null,cancelAfterReceipt=false;
 const key=c=>c?JSON.stringify([c.epoch,c.revision,c.decisionId]):null;
 function snapshot(){
  const {status,pending,busy,error}=read(),c=status?.priorityCapability;
  const supported=!!c&&typeof c.epoch==='string'&&Number.isSafeInteger(c.revision)&&c.revision===status.revision&&typeof c.decisionId==='string';
  const stopActive=supported&&stops.some(s=>s.activeSeat===c.activeSeat&&s.phase===c.phase);
  let reason=!supported||closed?'not-ready':status.terminal?'terminal':error?'error':controlMode==='full'?'full-control':c.mandatoryChoice?'mandatory-choice':c.actorSeat!==0||c.prioritySeat!==0?'not-human-priority':stopActive?'phase-stop':pending?'pending-draft':cancelledDecision===key(c)?'cancelled':c.coverage!=='complete'||!FLOW_PHASES.includes(c.phase)||!seat(c.activeSeat)||c.passAvailable!==true||typeof c.meaningfulAction!=='boolean'||typeof c.manaWindow!=='boolean'?'coverage-unknown':c.manaWindow?'mana-window':c.meaningfulAction?'meaningful-action':busy&&!submitting?'busy':'auto-pass-ready';
  return {version:1,supported,capabilities:{smartPass:supported,fullControl:supported,temporaryYield:supported,phaseStops:supported},
   epoch:c?.epoch??null,revision:status?.revision??null,decisionId:c?.decisionId??null,actorSeat:c?.actorSeat??null,activeSeat:c?.activeSeat??null,prioritySeat:c?.prioritySeat??null,phase:c?.phase??null,mandatoryChoice:c?.mandatoryChoice===true,coverage:c?.coverage==='complete'?'complete':'unknown',controlMode,temporaryYield,passState:submitting?'submitting':queued!==null?'queued':'idle',stops:structuredClone(stops),stopActive,reason};
 }
 function retire(){generation++;if(queued!==null)dequeue(queued);queued=null;}
 function reconcile(){
  if(closed)return;
  const value=snapshot();
  if(temporaryYield&&['terminal','error','mandatory-choice','phase-stop','coverage-unknown','meaningful-action','mana-window','pending-draft','full-control','cancelled'].includes(value.reason))temporaryYield=false;
  if(value.reason!=='auto-pass-ready'){if(!submitting)retire();return;}
  if(queued!==null||submitting)return;
  const ticket=++generation,decision=key(read().status?.priorityCapability);
  queued=enqueue(async()=>{
   if(closed||ticket!==generation)return;
   queued=null;
   if(closed||ticket!==generation||key(read().status?.priorityCapability)!==decision||snapshot().reason!=='auto-pass-ready')return;
   submitting=true;onChange();
   try{
    // A synchronous subscriber can cancel or start a manual action on publish.
    if(closed||ticket!==generation||read().busy||key(read().status?.priorityCapability)!==decision||snapshot().reason!=='auto-pass-ready')return;
    await dispatch({epoch:value.epoch,revision:value.revision,decisionId:value.decisionId});
   }catch(error){temporaryYield=false;cancelledDecision=key(read().status?.priorityCapability);onError(error);}
   finally{submitting=false;if(cancelAfterReceipt){cancelledDecision=key(read().status?.priorityCapability);cancelAfterReceipt=false;}else if(ticket===generation&&key(read().status?.priorityCapability)===decision)cancelledDecision=decision;onChange();reconcile();}
  });
 }
 function ready(){if(closed)throw Error('SESSION_CLOSED');if(!snapshot().supported)throw Error('TURN_FLOW_UNSUPPORTED');}
 const change=()=>{retire();reconcile();onChange();};
 return {snapshot,reconcile,
  setControlMode(mode){ready();if(!['smart','full'].includes(mode))throw Error('BAD_CONTROL_MODE');controlMode=mode;if(mode==='full')temporaryYield=false;change();},
  yieldUntilAction(){ready();if(controlMode==='full')throw Error('FULL_CONTROL');temporaryYield=true;cancelledDecision=null;change();},
  cancelYield(){ready();temporaryYield=false;cancelledDecision=key(read().status.priorityCapability);if(submitting)cancelAfterReceipt=true;change();},
  setPhaseStop(activeSeat,phase,enabled){ready();if(!seat(activeSeat)||!FLOW_PHASES.includes(phase)||typeof enabled!=='boolean')throw Error('BAD_PHASE_STOP');stops=stops.filter(s=>s.activeSeat!==activeSeat||s.phase!==phase);if(enabled)stops.push({activeSeat,phase});change();},
  close(){closed=true;temporaryYield=false;retire();}
 };
}
