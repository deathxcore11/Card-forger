// These are engineered initial positions, NOT legal game histories. Existing
// exact upstream card objects are moved using the persisted-state setup seam.
// All subsequent tested actions use the engine's authoritative submit boundary.
import assert from 'node:assert/strict';
import {sha} from './mechanics-inputs.mjs';
export const deck=(land,...cards)=>[...Array(60-cards.length).fill(land),...cards];
export const state=e=>e.get_game_state().state;
export const snapshot=e=>e.export_game_state_json();
export function prepare(e,player,opponent,{seed=12345}={}){
 assert.equal(player.length,60);assert.equal(opponent.length,60);
 const format=e.getFormatRegistry().find(f=>f.format==='Vintage').default_config;
 const init=e.initialize_game({player:{main_deck:player},opponent:{main_deck:opponent}},seed,format,null,2,0);assert(Array.isArray(init.events));
 const save=JSON.parse(snapshot(e)),s=save.state;
 for(const player of s.players){
  player.hand=[];player.library=Object.values(s.objects).filter(o=>o.owner===player.id).map(o=>o.id);
  for(const id of player.library)s.objects[id].zone='Library';
 }
 s.phase='PreCombatMain';s.waiting_for={type:'Priority',data:{player:0}};s.active_player=0;s.priority_player=0;s.turn_number=2;
 s.battlefield=[];s.priority_pass_count=0;s.priority_passes=[];s.combat=null;
 function move(name,owner,zone,count=1){
  const matches=Object.values(s.objects).filter(o=>o.name===name&&o.owner===owner&&o.zone==='Library').slice(0,count);assert.equal(matches.length,count,'setup missing '+name);
  for(const object of matches){
   s.players[owner].library=s.players[owner].library.filter(id=>id!==object.id);object.zone=zone;object.tapped=false;
   if(zone==='Battlefield'){s.battlefield.push(object.id);object.entered_battlefield_turn=1;}else s.players[owner][zone.toLowerCase()].push(object.id);
  }
  return matches.map(o=>o.id);
 }
 return {save,s,move,restore(){e.restore_game_state(JSON.stringify(save));assert.equal(state(e).waiting_for.type,'Priority');return sha(JSON.stringify(save));}};
}
export function candidates(e){return [0,1].map(actor=>({actor,...e.get_legal_actions_for_viewer_js(actor)})).filter(x=>x.actions.length);}
export function tracker(e){
 const trace=[],events=[];
 function submit(actor,action,{requireCandidate=true}={}){
  const packet=e.get_legal_actions_for_viewer_js(actor),generated=packet.actions.some(a=>JSON.stringify(a)===JSON.stringify(action));
  if(requireCandidate)assert(generated,'test action must have a generated candidate witness');
  const result=e.submit_action(actor,structuredClone(action));assert(['applied','Applied'].includes(result.status),JSON.stringify({actor,action,status:result.status}));
  trace.push({actor,action:structuredClone(action),generatedCandidate:generated,acceptedByEngine:true});events.push(...(result.result?.events||[]));return result;
 }
 function take(type,predicate=()=>true){
  for(const row of candidates(e)){const action=row.actions.find(a=>a.type===type&&predicate(a));if(action)return submit(row.actor,action);}
  assert.fail('No candidate for '+type+' at '+JSON.stringify(state(e).waiting_for));
 }
 function passUntil(predicate,max=20){for(let i=0;i<max&&!predicate(state(e));i++)take('PassPriority');assert(predicate(state(e)),'explicit action bound reached');}
 return {trace,events,submit,take,passUntil,receipt(){return {acceptedActions:trace.length,acceptedTraceSha256:sha(JSON.stringify(trace)),events:Object.fromEntries([...new Set(events.map(e=>e.type))].map(type=>[type,events.filter(e=>e.type===type).length]))};}};
}
export function signature(e){
 const s=JSON.parse(snapshot(e)).state;
 return {phase:s.phase,waiting:s.waiting_for,turn:s.turn_number,rngSeed:s.rng_seed,rngPosition:s.rng_word_pos,
  players:s.players.map(p=>({life:p.life,hand:p.hand,library:p.library,graveyard:p.graveyard,mana_pool:p.mana_pool})),
  battlefield:s.battlefield,stack:s.stack.map(x=>({id:x.object_id??x.id,type:x.type})),
  objects:Object.values(s.objects).map(o=>({id:o.id,zone:o.zone,tapped:o.tapped,controller:o.controller,attached_to:o.attached_to,power:o.power,toughness:o.toughness}))};
}
