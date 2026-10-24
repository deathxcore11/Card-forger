// Research-only human seat surface. Keep authority, policy and UI packets apart.
// The initial controls cover the Forest/Bears proof, not arbitrary Magic choices.
import {fail} from './worker-journal.mjs';
const id=v=>Number.isSafeInteger(v)&&v>0;
const seatId=v=>Number.isInteger(v)&&v>=0&&v<2;
const scalar=v=>typeof v==='string'&&v.length<=300?v:null;
const list=v=>Array.isArray(v)?v:[];
const visible=o=>o?.display_visible_to_viewer===true&&o.name!=='Hidden Card'&&!o.face_down;
const publicZones=new Set(['Battlefield','Graveyard','Stack','Exile','Command']);
const basicDecisions=new Set(['MulliganDecision','Priority','DeclareAttackers','DeclareBlockers','GameOver']);
export function projectSeat(envelope,seat) {
 const s=envelope?.state;
 if(!s||!seatId(seat)||s.viewer_projection!==seat||!Array.isArray(s.players)||s.players.length!==2)fail('INVALID_VIEW');
 const objects=s.objects||{},own=new Set(list(s.players[seat].hand));
 const cards=[];
 for(const o of Object.values(objects)) {
  if(!id(o?.id)||(!publicZones.has(o.zone)&&!(o.zone==='Hand'&&own.has(o.id))))continue;
  // Private-zone objects never acquire identity merely because a broad object
  // map retained them. Public face-down cards keep only public instance state.
  const known=visible(o);
  const card={id:o.id,zone:o.zone,owner:seatId(o.owner)?o.owner:null,controller:seatId(o.controller)?o.controller:null,
   known,tapped:o.tapped===true};
  if(known){
   card.name=scalar(o.name);card.oracleId=scalar(o.printed_ref?.oracle_id);card.face=scalar(o.printed_ref?.face_name);
   card.power=Number.isFinite(o.power)?o.power:null;card.toughness=Number.isFinite(o.toughness)?o.toughness:null;
   card.damage=Number.isFinite(o.damage_marked)?o.damage_marked:0;
   card.counters=Object.fromEntries(Object.entries(o.counters||{}).filter(([k,v])=>k.length<=80&&Number.isFinite(v)));
   card.types=list(o.card_types?.core_types).filter(t=>scalar(t));
   card.keywords=list(o.keywords).map(k=>scalar(typeof k==='string'?k:k?.type)).filter(Boolean);
  }
  cards.push(card);
 }
 cards.sort((a,b)=>a.id-b.id);const allowed=new Set(cards.map(c=>c.id));
 const onlyKnownIds=ids=>list(ids).filter(n=>allowed.has(n));
 const players=s.players.map((p,i)=>({seat:i,life:p.life,poison:p.poison_counters||0,handCount:list(p.hand).length,
  libraryCount:list(p.library).length,graveyard:onlyKnownIds(p.graveyard)}));
 return {seat,turn:s.turn_number,phase:scalar(s.phase),activeSeat:seatId(s.active_player)?s.active_player:null,
  prioritySeat:seatId(s.priority_player)?s.priority_player:null,players,cards,hand:onlyKnownIds(s.players[seat].hand),
  battlefield:onlyKnownIds(s.battlefield),exile:onlyKnownIds(s.exile),command:onlyKnownIds(s.command_zone),
  stack:list(s.stack).map(e=>({id:id(e.id)?e.id:null,source:allowed.has(e.source_id)?e.source_id:null,controller:seatId(e.controller)?e.controller:null})),
  decision:{kind:scalar(s.waiting_for?.type),supported:basicDecisions.has(s.waiting_for?.type)&&(s.waiting_for?.type!=='MulliganDecision'||list(s.waiting_for.data?.pending).find(p=>p.player===seat)?.phase?.type==='Declare')}};
}
function label(action,view) {
 const data=action.data||{},byId=new Map(view.cards.map(c=>[c.id,c]));
 const ownCard=n=>{const o=byId.get(n);return o?.known&&o.controller===view.seat?o:null;};
 if(action.type==='PassPriority')return 'Pass priority';
 if(action.type==='MulliganDecision')return data.choice?.type==='Keep'?'Keep hand':data.choice?.type==='Mulligan'?'Take a mulligan':null;
 if(action.type==='PlayLand'){const c=ownCard(data.object_id);return c&&c.zone==='Hand'?`Play ${c.name}`:null;}
 if(action.type==='CastSpell'){
  const c=ownCard(data.object_id);
  // Only the exact no-target Bears fixture is admitted here. Other costs and
  // target/payment prompts await their own complete player-choice contract.
  return c?.name==='Grizzly Bears'&&list(data.targets).length===0&&data.payment_mode?.type==='Auto'?`Cast ${c.name} (automatic mana payment)`:null;
 }
 if(action.type==='DeclareAttackers'){
  if(list(data.bands).length||!Array.isArray(data.attacks))return null;
  const rows=data.attacks.map(a=>{const c=ownCard(a?.[0]),target=a?.[1];return c&&target?.type==='Player'&&target.data!==view.seat&&seatId(target.data)?c.name:null;});
  return rows.every(Boolean)?rows.length?`Attack with ${rows.join(', ')}`:'Attack with no creatures':null;
 }
 if(action.type==='DeclareBlockers'){
  if(!Array.isArray(data.assignments))return null;
  const rows=data.assignments.map(a=>{const blocker=ownCard(a?.[0]),attacker=byId.get(a?.[1]);return blocker&&attacker?.known?`${blocker.name} blocks ${attacker.name}`:null;});
  return rows.every(Boolean)?rows.length?rows.join('; '):'Declare no blockers':null;
 }
 return null;
}
export function createSeatController({engine,seat,epoch}) {
 if(!seatId(seat)||typeof epoch!=='string'||!epoch.length)fail('BAD_SEAT_BINDING');
 let offered=null;
 function read(revision) {
  const view=projectSeat(engine.get_filtered_game_state(seat),seat),legal=engine.get_legal_actions_for_viewer_js(seat);
  const choices=[],seen=new Set(),registry=new Map();
  if(view.decision.supported)for(const [index,action]of list(legal.actions).entries()){
   const text=label(action,view),key=JSON.stringify(action);if(!text||seen.has(key))continue;seen.add(key);
   const token=`${epoch}:${revision}:${index}`;choices.push({token,label:text,kind:action.type});registry.set(token,{index,key});
  }
  offered={revision,registry};return {...view,choices,canAct:choices.length>0,
   unavailableReason:legal.actions?.length&&!choices.length?'DECISION_NOT_IMPLEMENTED':null};
 }
 function select(actions,rng,{choice,revision,actor}) {
  if(actor!==seat)fail('WRONG_SEAT');if(!choice)fail('CHOICE_REQUIRED');
  if(!offered||offered.revision!==revision)fail('STALE_CHOICE');
  const selected=offered.registry.get(choice);if(!selected||JSON.stringify(actions[selected.index])!==selected.key)fail('STALE_CHOICE');
  return {index:selected.index,rng};
 }
 return {read,select};
}
