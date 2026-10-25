// Shared worker-side rules adapter. The UI and CPU never receive authority saves.
import {submitHumanCommand} from './human-command.mjs';
import {fail} from './protocol-fault.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {cpuLegalCandidates} from './cpu-legal-candidates.mjs';
import {createCpuPlaybook} from './cpu-playbook.mjs';
import {cpuProfile} from './cpu-difficulty-config.mjs';
import {priorityCapability} from './priority-flow.mjs';
import {readShippedResponseProof} from './shipped-response-proof.mjs';
import {createCommanderProjector} from './commander-projection.mjs';
import {projectSeat,createSeatController} from './seat-surface.mjs';
import {projectRandomEvents} from './random-outcomes.mjs';
export function createMatchAuthority({engine,epoch,mode='human-timed',decks,format,difficulty='Medium',runtimeIdentity=null,cpuPlaybookProposals=[],onStart=()=>{},present=view=>view,policyWorker}={}){
 cpuProfile(difficulty);const playbooks=[createCpuPlaybook(decks?.player,cpuPlaybookProposals[0]),createCpuPlaybook(decks?.opponent,cpuPlaybookProposals[1])];
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
  policy.postMessage({id,packet:makeCpuObservation(engine.get_filtered_game_state(actor),actor,actions,{difficulty,legal:engine.get_legal_actions_for_viewer_js(actor),playbook:playbooks[actor]}),rng});
 });
 const commanders=createCommanderProjector();
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
 const readPriorityProof=revision=>{
  try{
   const native=typeof engine.get_priority_capability_v1_js==='function'?engine.get_priority_capability_v1_js(0):null;
   const value=native?.status==='actionless'?native:readShippedResponseProof(engine,0,runtimeIdentity);
   return value?{epoch,revision,value}:null;
  }catch{return null;}
 };
 const adapter={
  clockContext(revision){const w=engine.get_filtered_game_state(0).state.waiting_for,interaction=engine.get_viewer_snapshot_js(0).viewerInteraction;const actor=w?.type==='Priority'?w.data.player:interaction?.canSubmit&&interaction.authorizedSubmitters?.includes(0)?0:1;return {actor,kind:w?.type||'Unavailable',decisionId:`decision-${revision}`};},
  humanSeat:controller?0:null,
  priorityCapability(revision){return priorityCapability({state:engine.get_filtered_game_state(0).state,actor:adapter.clockContext(revision).actor,epoch,revision,engineProof:readPriorityProof(revision)});},
  act:controller?command=>submitHumanCommand(humanEngine,command):undefined,
  respond:controller?submission=>{invalidateCandidates();const r=observe(engine.submit_interaction_js(0,submission));if(['applied','Applied'].includes(r.status))return true;if(['rejected','Rejected'].includes(r.status))return false;fail('ENGINE_FAILED');}:undefined,
  start(seed,first){invalidateCandidates();outcomes=[];const result=engine.initialize_game(decks,seed,format,null,2,first);if(!Array.isArray(result.events))fail('INITIALIZE_FAILED');commanders.reset(engine.get_filtered_game_state(0),0);observe(result);onStart(engine);},
  drainOutcomes(){const pending=outcomes;outcomes=[];return pending;},
  save:()=>engine.export_game_state_json(),restore(s){invalidateCandidates();outcomes=[];return engine.restore_game_state(s);},
  summary(revision){
   const s=engine.get_filtered_game_state(0).state,interaction=controller?engine.get_viewer_snapshot_js(0).viewerInteraction:null;
   const actor=s.waiting_for?.type==='Priority'?s.waiting_for.data.player:interaction?.canSubmit&&interaction.authorizedSubmitters?.includes(0)?0:1;
   return {turn:s.turn_number,waiting:s.waiting_for?.type||null,terminal:s.waiting_for?.type==='GameOver'?{winner:s.waiting_for.data?.winner??null}:null,
    priorityCapability:priorityCapability({state:s,actor,epoch,revision,engineProof:readPriorityProof(revision)}),
    ...(controller?{surface:present({...controller.read(revision),commander:commanders.read({state:s},0),awaitingHuman:interaction?.authorizedSubmitters?.includes(0)===true,interaction:projectInteraction(interaction,0)})}:{})};
  },
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
