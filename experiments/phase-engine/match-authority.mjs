// Shared worker-side rules adapter. The UI and CPU never receive authority saves.
import {submitHumanCommand} from './human-command.mjs';
import {fail} from './protocol-fault.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {cpuLegalCandidates} from './cpu-legal-candidates.mjs';
import {projectSeat,createSeatController} from './seat-surface.mjs';
import {projectRandomEvents} from './random-outcomes.mjs';
export function createMatchAuthority({engine,epoch,mode='human-timed',decks,format,onStart=()=>{},present=view=>view,policyWorker}={}){
 const policy=policyWorker||new Worker(new URL('./cpu-public-worker.mjs',import.meta.url),{type:'module'});let seq=0;
 // The journal is the sole mutator of this engine instance. Cache only the
 // expensive CPU expansion, never the engine's fresh base suggestions or submit.
 // Mutation attempts invalidate even when rejected or thrown.
 let candidateSnapshot=null;
 const invalidateCandidates=()=>{candidateSnapshot=null;};
 const cpuChoose=(actions,rng,actor)=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{cleanup();policy.terminate();reject(Error('POLICY_TIMEOUT'));},5000);
  const cleanup=()=>{clearTimeout(timer);policy.removeEventListener('message',onMessage);policy.removeEventListener('error',onError);};
  const onMessage=({data})=>{if(data?.id!==id)return;cleanup();data.error?reject(Error('POLICY_FAILED')):resolve(data);};
  const onError=()=>{cleanup();reject(Error('POLICY_FAILED'));};
  policy.addEventListener('message',onMessage);policy.addEventListener('error',onError);
  policy.postMessage({id,packet:makeCpuObservation(engine.get_filtered_game_state(actor),actor,actions),rng});
 });
 let outcomes=[];
 function observe(result){
  if(result?.status&&!['applied','Applied'].includes(result.status))return result;
  const events=result?.result?.events||result?.events||[];
  const relevant=events.filter(e=>['DieRolled','DieRollIgnored','CoinFlipped'].includes(e?.type));
  if(relevant.length){const authorized=engine.get_viewer_transition_snapshot_js(0,relevant);outcomes.push(...projectRandomEvents(authorized?.events));}
  return result;
 }
 const humanEngine={get_filtered_game_state:seat=>engine.get_filtered_game_state(seat),submit_action:(...args)=>{invalidateCandidates();return observe(engine.submit_action(...args));}};
 const controller=mode.startsWith('human')?createSeatController({engine,seat:0,epoch}):null;
 const choose=(actions,rng,context)=>{
  if(controller&&context.actor===0)return controller.select(actions,rng,context);
  if(context.choice!==undefined)fail('WRONG_SEAT');return cpuChoose(actions,rng,context.actor);
 };
 const adapter={
  clockContext(revision){const w=engine.get_filtered_game_state(0).state.waiting_for,interaction=engine.get_viewer_snapshot_js(0).viewerInteraction;const actor=w?.type==='Priority'?w.data.player:interaction?.canSubmit&&interaction.authorizedSubmitters?.includes(0)?0:1;return {actor,kind:w?.type||'Unavailable',decisionId:`decision-${revision}`};},
  humanSeat:controller?0:null,
  act:controller?command=>submitHumanCommand(humanEngine,command):undefined,
  respond:controller?submission=>{invalidateCandidates();const r=observe(engine.submit_interaction_js(0,submission));if(['applied','Applied'].includes(r.status))return true;if(['rejected','Rejected'].includes(r.status))return false;fail('ENGINE_FAILED');}:undefined,
  start(seed,first){invalidateCandidates();outcomes=[];const result=engine.initialize_game(decks,seed,format,null,2,first);if(!Array.isArray(result.events))fail('INITIALIZE_FAILED');observe(result);onStart(engine);},
  drainOutcomes(){const pending=outcomes;outcomes=[];return pending;},
  save:()=>engine.export_game_state_json(),restore(s){invalidateCandidates();outcomes=[];return engine.restore_game_state(s);},
  summary(revision){const s=engine.get_filtered_game_state(0).state;return {turn:s.turn_number,waiting:s.waiting_for?.type||null,terminal:s.waiting_for?.type==='GameOver'?{winner:s.waiting_for.data?.winner??null}:null,...(controller?{surface:present({...controller.read(revision),awaitingHuman:engine.get_viewer_snapshot_js(0).viewerInteraction.authorizedSubmitters?.includes(0)===true,interaction:projectInteraction(engine.get_viewer_snapshot_js(0).viewerInteraction,0)})}:{})};},
  legal(context){
   const cacheable=context?.epoch===epoch&&Number.isSafeInteger(context?.revision)&&context.revision>=0;
   if(!cacheable)invalidateCandidates();
   for(const actor of [0,1]){
    const {actions}=engine.get_legal_actions_for_viewer_js(actor);
    if(!actions.length)continue;
    if(controller&&actor===0){invalidateCandidates();return {actor,actions};}
    const decision=engine.get_filtered_game_state(actor).state.waiting_for;
    const key=cacheable?JSON.stringify([epoch,context.revision,actor,decision,actions]):null;
    if(key!==null&&candidateSnapshot?.key===key)return {actor,actions:structuredClone(candidateSnapshot.actions)};
    const expanded=cpuLegalCandidates(engine,actor,actions).actions;
    candidateSnapshot=key===null?null:{key,actions:structuredClone(expanded)};
    return {actor,actions:expanded};
   }
   invalidateCandidates();return {actor:null,actions:[]};
  },
  apply(actor,action){invalidateCandidates();const r=observe(engine.submit_action(actor,action));if(!['applied','Applied'].includes(r.status))fail('ENGINE_REJECTED');}
 };
 return {adapter,choose,close:()=>policy.terminate()};
}
