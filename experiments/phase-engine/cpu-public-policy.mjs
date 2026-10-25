import {chooseVisible} from './visible-cpu-policy.mjs';
import {PUBLIC_CPU_VERSION} from './cpu-public-observation.mjs';
import {creatureValue} from './cpu-combat-evaluation.mjs';
import {chooseBoundedBlock} from './cpu-block-search.mjs';
import {cpuProfile,CPU_CONFIGURATION_VERSION} from './cpu-difficulty-config.mjs';
import {makeSearchBudget,handSequenceScore,attackScore} from './cpu-tactical-planning.mjs';
export function analyzeCpu(packet,rng,{now,cancelled}={}){
 if(packet?.version!==PUBLIC_CPU_VERSION||!Array.isArray(packet.legacy?.choices)||packet.legacy.choices.length!==packet.combat?.blockCandidates?.length)throw Error('INVALID_CPU_PACKET');
 const profile=cpuProfile(packet.difficulty),budget=makeSearchBudget(profile,now,cancelled);
 const finish=index=>({index,rng:rng>>>0,metrics:{...budget.stats(),difficulty:packet.difficulty,configuration:CPU_CONFIGURATION_VERSION}});
 if(packet.commanderZone){
  if(!Array.isArray(packet.commanderZone)||packet.commanderZone.length!==packet.legacy.choices.length||packet.commanderZone.some(c=>c!==null&&(c?.available!==true||typeof c.accept!=='boolean')))throw Error('INVALID_CPU_PACKET');
  // Default to preserving command-zone access; no graveyard-recursion plan
  // is inferred from a hidden library or unspecified future draws.
  let index=packet.commanderZone.findIndex(c=>c?.accept===true);
  if(index<0)index=packet.commanderZone.findIndex(c=>c?.accept===false);
  if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');return finish(index);
 }
 if(packet.combatTax){
  if(!Array.isArray(packet.combatTax)||packet.combatTax.length!==packet.legacy.choices.length||packet.combatTax.some(c=>c!==null&&(c?.available!==true||typeof c.accept!=='boolean')))throw Error('INVALID_CPU_PACKET');
  // Honor the already chosen combat declaration whenever the engine offers
  // its payment. Decline only when paying is absent from the legal offers.
  let index=packet.combatTax.findIndex(c=>c?.accept===true);
  if(index<0)index=packet.combatTax.findIndex(c=>c?.accept===false);
  if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');return finish(index);
 }
 if(packet.named){
  if(!Array.isArray(packet.named)||packet.named.length!==packet.legacy.choices.length)throw Error('INVALID_CPU_PACKET');
  let index=-1,best=-Infinity;
  for(const [i,c]of packet.named.entries())if(c?.available===true){
   if(!Number.isSafeInteger(c.preference)||c.preference<0)throw Error('INVALID_CPU_PACKET');
   if(c.preference>best){best=c.preference;index=i;}
  }
  if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');return finish(index);
 }
 if(packet.modes){
  if(!Array.isArray(packet.modes)||packet.modes.length!==packet.legacy.choices.length)throw Error('INVALID_CPU_PACKET');
  const index=packet.modes.findIndex(c=>c?.available===true);
  if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');return finish(index);
 }
 if(packet.ordering){
  if(!Array.isArray(packet.ordering)||packet.ordering.length!==packet.legacy.choices.length)throw Error('INVALID_CPU_PACKET');
  const index=packet.ordering.findIndex(c=>c?.available===true);
  if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');return finish(index);
 }
 if(packet.targets){
  if(!Array.isArray(packet.targets.choices)||packet.targets.choices.length!==packet.legacy.choices.length)throw Error('INVALID_CPU_PACKET');
  let best=-Infinity,index=-1;
  for(const [i,t]of packet.targets.choices.entries()){
   if(!t)continue;
   // Neutral/opaque effects use stable engine-offer order. This completes the
   // required choice without pretending to understand an unmodeled effect.
   let score=t.kind==='decline'?-1:0;
   if(t.kind==='permanent'||t.kind==='player'){
    const value=t.card?creatureValue(t.card):10;
    if(packet.targets.intent==='hostile')score=(t.own?-1:1)*(10+value);
    if(packet.targets.intent==='friendly')score=(t.own?1:-1)*(10+value);
    if(packet.targets.intent==='haste')score=t.own?1:0;
    if(packet.targets.intent==='haste'&&t.own&&t.card?.creature&&!t.card.tapped&&t.card.summoningSick&&!t.card.keywords.includes('Haste'))score=100+value;
   }
   if(score>best){best=score;index=i;}
  }
  if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');return finish(index);
 }
 const block=chooseBoundedBlock(packet.combat,budget);
 if(block)return finish(block.index);
 if(packet.combat.decision==='DiscardToHandSize'){
  let index=-1,best=Infinity;
  for(const [i,ids]of (packet.hand?.discardIndices||[]).entries())if(ids!==null){
   const cost=ids.reduce((sum,id)=>{const c=packet.hand.cards[id];return sum+(c.land?(packet.hand.lands<3?15:packet.hand.lands<5?6:1):creatureValue(c)+profile.planWeight*(c.toughnessEnabler?3:c.hasTriggers?2:0));},0);
   if(cost<best){best=cost;index=i;}
  }
  if(index<0)throw Error('CPU_DECISION_UNSUPPORTED');return finish(index);
 }
 const fallback=chooseVisible(packet.legacy,rng),choices=packet.legacy.choices;
 const land=choices.findIndex(c=>c.kind==='land'&&c.available);if(land>=0)return finish(land);
 if(packet.combat.decision==='DeclareAttackers'){
  let index=packet.combat.attackCandidates.findIndex(a=>a?.length===0),best=index>=0?0:-Infinity;
  for(const [i,attacks]of packet.combat.attackCandidates.entries())if(attacks?.length){const score=attackScore(packet.combat,attacks,profile,budget);if(score!==null&&score>best){best=score;index=i;}}
  return finish(index>=0?index:fallback.index);
 }
 if(packet.hand&&choices.some(c=>c.kind==='cast'&&c.available)){
  let best=-Infinity,index=fallback.index;
  for(const [i,c]of choices.entries())if(c.kind==='cast'&&c.available){const root=packet.hand.castIndices[i],score=root===null?null:handSequenceScore(packet.hand,root,profile,budget);if(score!==null&&score>best){best=score;index=i;}}
  return finish(index);
 }
 return finish(fallback.index);
}
export function chooseCpu(packet,rng,options){const {index,rng:next}=analyzeCpu(packet,rng,options);return {index,rng:next};}
