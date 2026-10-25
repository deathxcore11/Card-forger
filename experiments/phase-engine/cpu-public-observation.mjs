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
// A target offer carries permission; policy receives only a positional choice
// and public characteristics. Never ship target handles, source text or IDs.
function targetObservation(s,seat,actions,publicObjects,objects){
 const w=s.waiting_for,d=w?.data;
 if(!['TargetSelection','TriggerTargetSelection'].includes(w?.type)||d?.player!==seat)return null;
 const slot=d.target_slots?.[d.selection?.current_slot];
 if(!slot)return null;
 const refs=list(d.selection?.current_legal_targets);
 const matches=(a,b)=>a&&b&&Object.keys(a).length===1&&Object.keys(b).length===1&&
  ((Number.isSafeInteger(a.Object)&&a.Object===b.Object)||(Number.isInteger(a.Player)&&a.Player===b.Player));
 const byId=new Map(publicObjects.map((o,i)=>[o.id,i]));
 let intent='neutral';
 const hostile=new Set(['DealDamage','Destroy','Counter','Tap','LoseLife','Discard','DiscardCard','Mill']);
 const friendly=new Set(['Untap','GainLife','Draw','Regenerate','RemoveAllDamage']);
 if(hostile.has(slot.effect_kind))intent='hostile';else if(friendly.has(slot.effect_kind))intent='friendly';
 // The current public stack ability supplies semantic evidence for this
 // single-slot haste grant. Multiple/chained/ambiguous effects stay neutral.
 const top=list(s.stack).at(-1),a=top?.kind?.data?.ability,e=a?.effect,ss=list(e?.static_abilities);
 if(w.type==='TriggerTargetSelection'&&d.target_slots.length===1&&top?.kind?.type==='TriggeredAbility'&&
  top.source_id===d.source_id&&a?.source_id===d.source_id&&a.controller===seat&&!a.sub_ability&&
  byId.has(d.source_id)&&objects[byId.get(d.source_id)].known&&e?.type==='GenericEffect'&&e.duration==='UntilEndOfTurn'&&
  e.target?.type==='Typed'&&e.target.controller==='You'&&JSON.stringify(e.target.type_filters)==='["Creature"]'&&list(e.target.properties).length===0&&
  ss.length===1&&ss[0].mode==='Continuous'&&ss[0].affected?.type==='ParentTarget'&&!ss[0].condition&&
  ss[0].modifications?.length===1&&ss[0].modifications[0].type==='AddKeyword'&&ss[0].modifications[0].keyword==='Haste')intent='haste';
 return {intent,choices:actions.map(action=>{
  if(action.type!=='ChooseTarget'||!action.data||!Object.hasOwn(action.data,'target'))return null;
  const t=action.data.target;
  if(t===null)return slot.optional===true?{kind:'decline'}:null;
  if(!refs.some(r=>matches(t,r)))return null;
  if(Number.isInteger(t.Player)&&[0,1].includes(t.Player))return {kind:'player',own:t.Player===seat};
  const index=byId.get(t.Object),o=publicObjects[index],c=objects[index];
  if(!c?.known)return {kind:'opaque'};
  return {kind:'permanent',own:c.controller===seat,card:{...c,summoningSick:o.has_summoning_sickness===true}};
 })};
}
function triggerOrderObservation(s,seat,actions){
 const w=s.waiting_for;
 if(w?.type!=='OrderTriggers'||w.data?.player!==seat)return null;
 const n=list(w.data.triggers).length;
 // Permutations are already engine offers. Only the availability bit crosses
 // the worker boundary; unknown ordering effects retain deterministic order.
 return actions.map(a=>{const order=a.data?.order;
  return a.type==='OrderTriggers'&&Array.isArray(order)&&order.length===n&&new Set(order).size===n&&order.every(i=>Number.isInteger(i)&&i>=0&&i<n)?{available:true}:null;
 });
}
function modeChoiceObservation(s,seat,actions){
 const w=s.waiting_for,d=w?.data,m=d?.modal;
 if(!['ModeChoice','AbilityModeChoice'].includes(w?.type)||d?.player!==seat)return null;
 if(!Number.isSafeInteger(m?.mode_count)||m.mode_count<1||!Number.isSafeInteger(m.min_choices)||!Number.isSafeInteger(m.max_choices)||m.min_choices<0||m.max_choices<m.min_choices||typeof m.allow_repeat_modes!=='boolean')return null;
 const unavailable=list(d.unavailable_modes);
 // Only availability crosses the policy boundary. Mode text, pending spell
 // identity, targets and private card/library facts remain in the authority.
 return actions.map(a=>{
  const indices=a.data?.indices;
  return a.type==='SelectModes'&&Array.isArray(indices)&&indices.length>=m.min_choices&&indices.length<=m.max_choices&&
   (m.allow_repeat_modes||new Set(indices).size===indices.length)&&indices.every(i=>Number.isSafeInteger(i)&&i>=0&&i<m.mode_count&&!unavailable.includes(i))?{available:true}:null;
 });
}
function namedChoiceObservation(s,seat,actions){
 const w=s.waiting_for,d=w?.data;
 if(w?.type!=='NamedChoice'||d?.player!==seat)return null;
 const options=list(d.options);
 // Free-form card names without an engine offer are not invented here.
 if(!options.length||options.some(o=>typeof o!=='string'))return null;
 const offered=new Set(options),counts=new Map();
 if(d.choice_type==='CreatureType'){
  const ownHand=new Set(list(s.players[seat].hand));
  const ids=new Set([...ownHand,...list(s.battlefield)]);
  for(const id of ids){
   const o=s.objects?.[id];
   if(!o||o.controller!==seat||o.display_visible_to_viewer!==true||o.face_down||o.name==='Hidden Card'||
    !(o.zone==='Battlefield'||o.zone==='Hand'&&ownHand.has(id))||!list(o.card_types?.core_types).includes('Creature'))continue;
   // A generic tribal preference, using only own authorized hand and public
   // creatures. No library, opponent hand, source context or names are sent.
   for(const subtype of new Set(list(o.card_types?.subtypes)))if(offered.has(subtype))counts.set(subtype,(counts.get(subtype)||0)+1);
  }
 }
 return actions.map(a=>a.type==='ChooseOption'&&typeof a.data?.choice==='string'&&offered.has(a.data.choice)?
  {available:true,preference:counts.get(a.data.choice)||0}:null);
}
function combatTaxObservation(s,seat,actions){
 const w=s.waiting_for;
 if(w?.type!=='CombatTaxPayment'||w.data?.player!==seat)return null;
 // The engine's legal offers certify affordability; do not reconstruct mana
 // payment from card text or inspect the pending declaration/source context.
 return actions.map(a=>a.type==='PayCombatTax'&&typeof a.data?.accept==='boolean'?{available:true,accept:a.data.accept}:null);
}
function commanderZoneObservation(s,seat,actions){
 const w=s.waiting_for;
 if(w?.type!=='CommanderZoneChoice'||w.data?.player!==seat)return null;
 // Only this commander-specific optional decision is handled. Generic
 // optional effects may have entirely different consequences.
 return actions.map(a=>a.type==='DecideOptionalEffect'&&typeof a.data?.accept==='boolean'?{available:true,accept:a.data.accept}:null);
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
 return {version:PUBLIC_CPU_VERSION,difficulty,legacy,commanderZone:commanderZoneObservation(s,seat,actions),combatTax:combatTaxObservation(s,seat,actions),named:namedChoiceObservation(s,seat,actions),modes:modeChoiceObservation(s,seat,actions),ordering:triggerOrderObservation(s,seat,actions),targets:targetObservation(s,seat,actions,publicObjects,objects),hand:ownHandObservation(s,seat,actions,legal,playbook),combat:{seat,life:list(s.players).map(p=>finite(p.life)),objects,attackers,legalBlocks,blockCandidates,attackCandidates,
  decision:w?.type||null,complete:attackers.every(a=>a.object!==null&&a.target.kind!=='unknown'&&!a.banded)&&s.combat?.first_strike_done!==true&&s.combat?.regular_damage_done!==true,
  uncertain:list(s.stack).length>0||objects.some(o=>!o.known||o.uncertain)}};
}
