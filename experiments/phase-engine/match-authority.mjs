// Shared worker-side rules adapter. The UI and CPU never receive authority saves.
import {submitHumanCommand} from './human-command.mjs';
import {fail} from './protocol-fault.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {cpuPacket} from './visible-cpu-policy.mjs';
import {projectSeat,createSeatController} from './seat-surface.mjs';
export function createMatchAuthority({engine,epoch,mode='human-timed',decks,format,onStart=()=>{},present=view=>view,policyWorker}={}){
 const policy=policyWorker||new Worker(new URL('./visible-policy-worker.mjs',import.meta.url),{type:'module'});let seq=0;
 const cpuChoose=(actions,rng,actor)=>new Promise((resolve,reject)=>{
  const id=++seq,timer=setTimeout(()=>{cleanup();policy.terminate();reject(Error('POLICY_TIMEOUT'));},5000);
  const cleanup=()=>{clearTimeout(timer);policy.removeEventListener('message',onMessage);policy.removeEventListener('error',onError);};
  const onMessage=({data})=>{if(data?.id!==id)return;cleanup();data.error?reject(Error('POLICY_FAILED')):resolve(data);};
  const onError=()=>{cleanup();reject(Error('POLICY_FAILED'));};
  policy.addEventListener('message',onMessage);policy.addEventListener('error',onError);
  policy.postMessage({id,packet:cpuPacket(projectSeat(engine.get_filtered_game_state(actor),actor),actions),rng});
 });
 const controller=mode.startsWith('human')?createSeatController({engine,seat:0,epoch}):null;
 const choose=(actions,rng,context)=>{
  if(controller&&context.actor===0)return controller.select(actions,rng,context);
  if(context.choice!==undefined)fail('WRONG_SEAT');return cpuChoose(actions,rng,context.actor);
 };
 const adapter={
  clockContext(revision){const w=engine.get_filtered_game_state(0).state.waiting_for,interaction=engine.get_viewer_snapshot_js(0).viewerInteraction;const actor=w?.type==='Priority'?w.data.player:interaction?.canSubmit&&interaction.authorizedSubmitters?.includes(0)?0:1;return {actor,kind:w?.type||'Unavailable',decisionId:`decision-${revision}`};},
  humanSeat:controller?0:null,
  act:controller?command=>submitHumanCommand(engine,command):undefined,
  respond:controller?submission=>{const r=engine.submit_interaction_js(0,submission);if(['applied','Applied'].includes(r.status))return true;if(['rejected','Rejected'].includes(r.status))return false;fail('ENGINE_FAILED');}:undefined,
  start(seed,first){const result=engine.initialize_game(decks,seed,format,null,2,first);if(!Array.isArray(result.events))fail('INITIALIZE_FAILED');onStart(engine);},
  save:()=>engine.export_game_state_json(),restore:s=>engine.restore_game_state(s),
  summary(revision){const s=engine.get_filtered_game_state(0).state;return {turn:s.turn_number,waiting:s.waiting_for?.type||null,terminal:s.waiting_for?.type==='GameOver'?{winner:s.waiting_for.data?.winner??null}:null,...(controller?{surface:present({...controller.read(revision),awaitingHuman:engine.get_viewer_snapshot_js(0).viewerInteraction.authorizedSubmitters?.includes(0)===true,interaction:projectInteraction(engine.get_viewer_snapshot_js(0).viewerInteraction,0)})}:{})};},
  legal(){for(const actor of [0,1]){const {actions}=engine.get_legal_actions_for_viewer_js(actor);if(actions.length)return {actor,actions};}return {actor:null,actions:[]};},
  apply(actor,action){const r=engine.submit_action(actor,action);if(!['applied','Applied'].includes(r.status))fail('ENGINE_REJECTED');}
 };
 return {adapter,choose,close:()=>policy.terminate()};
}
