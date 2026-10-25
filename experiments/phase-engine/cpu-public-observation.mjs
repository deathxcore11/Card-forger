// Authority-side allowlist. Only a seat-filtered envelope is accepted here.
// The policy worker receives local indices, never names, object handles or saves.
import {projectSeat} from './seat-surface.mjs';
import {cpuPacket} from './visible-cpu-policy.mjs';
import {ownHandObservation} from './cpu-hand-observation.mjs';
export const PUBLIC_CPU_VERSION='public-cpu-v1';
const list=v=>Array.isArray(v)?v:[];
const finite=v=>Number.isFinite(v)?v:null;
const supportedKeywords=new Set(['Trample','FirstStrike','DoubleStrike','Deathtouch','Lifelink','Indestructible','Flying','Reach','Vigilance','Haste','Defender']);
function publicEffects(o){
 if(list(o.trigger_definitions).length||list(o.replacement_definitions).length)return true;
 return list(o.static_definitions).some(s=>{
  if(typeof s.mode==='object'&&(s.mode.ModifyCost||s.mode.CrewContribution))return false;
  return s.mode!=='Continuous'||list(s.modifications).some(m=>!['AssignDamageFromToughness','AddStaticMode'].includes(m.type)||(m.type==='AddStaticMode'&&!m.mode?.CrewContribution));
 });
}
export function makeCpuObservation(envelope,seat,actions,{difficulty='Medium',legal=null,playbook=null}={}){
 const s=envelope?.state;
 if(!s||s.viewer_projection!==seat||![0,1].includes(seat)||!Array.isArray(actions))throw Error('INVALID_CPU_VIEW');
 const view=projectSeat(envelope,seat),legacy=cpuPacket(view,actions);
 const publicObjects=list(s.battlefield).map(id=>s.objects?.[id]).filter(Boolean).sort((a,b)=>a.id-b.id);
 const indices=new Map(publicObjects.map((o,i)=>[o.id,i]));
 const creature=o=>{
  const known=o.display_visible_to_viewer===true&&!o.face_down&&o.name!=='Hidden Card';
  if(!known)return {known:false,controller:o.controller};
  const keywords=list(o.keywords).map(k=>typeof k==='string'?k:k?.type||Object.keys(k||{})[0]||'Unknown');
  return {known:true,controller:o.controller,creature:list(o.card_types?.core_types).includes('Creature'),power:finite(o.power),toughness:finite(o.toughness),damage:finite(o.damage_marked)||0,
   damageFromToughness:o.assigns_damage_from_toughness===true,tapped:o.tapped===true,keywords:keywords.filter(k=>supportedKeywords.has(k)).sort(),
   uncertain:keywords.some(k=>!supportedKeywords.has(k))||publicEffects(o)||o.dealt_deathtouch_damage===true};
 };
 const objects=publicObjects.map(creature),target=t=>t?.type==='Player'&&[0,1].includes(t.data)?{kind:'player',seat:t.data}:
  ['Planeswalker','Battle'].includes(t?.type)&&indices.has(t.data)?{kind:'permanent',object:indices.get(t.data)}:{kind:'unknown'};
 const attackers=list(s.combat?.attackers).map(a=>({object:indices.get(a.object_id)??null,target:target(a.attack_target),defendingSeat:a.defending_player,banded:a.band_id!==null&&a.band_id!==undefined}));
 const w=s.waiting_for,legalBlocks=w?.type==='DeclareBlockers'&&w.data?.player===seat?Object.entries(w.data.valid_block_targets||{}).flatMap(([b,targets])=>list(targets).map(a=>[indices.get(Number(b))??null,indices.get(a)??null])):[];
 const blockCandidates=actions.map(a=>a.type==='DeclareBlockers'?list(a.data?.assignments).map(([b,t])=>[indices.get(b)??null,indices.get(t)??null]):null);
 const attackCandidates=actions.map(a=>a.type==='DeclareAttackers'?list(a.data?.attacks).map(([id,t])=>({object:indices.get(id)??null,target:target(t)})):null);
 return {version:PUBLIC_CPU_VERSION,difficulty,legacy,hand:ownHandObservation(s,seat,actions,legal,playbook),combat:{seat,life:list(s.players).map(p=>finite(p.life)),objects,attackers,legalBlocks,blockCandidates,attackCandidates,
  decision:w?.type||null,complete:attackers.every(a=>a.object!==null&&a.target.kind!=='unknown'&&!a.banded)&&s.combat?.first_strike_done!==true&&s.combat?.regular_damage_done!==true,
  uncertain:list(s.stack).length>0||objects.some(o=>!o.known||o.uncertain)}};
}
