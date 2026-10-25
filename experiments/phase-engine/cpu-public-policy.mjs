import {chooseVisible} from './visible-cpu-policy.mjs';
import {PUBLIC_CPU_VERSION} from './cpu-public-observation.mjs';
import {rankBlockCandidates,survivalRank,creatureValue} from './cpu-combat-evaluation.mjs';
import {cpuProfile,CPU_CONFIGURATION_VERSION} from './cpu-difficulty-config.mjs';
import {makeSearchBudget,handSequenceScore,attackScore} from './cpu-tactical-planning.mjs';
export function analyzeCpu(packet,rng,{now}={}){
 if(packet?.version!==PUBLIC_CPU_VERSION||!Array.isArray(packet.legacy?.choices)||packet.legacy.choices.length!==packet.combat?.blockCandidates?.length)throw Error('INVALID_CPU_PACKET');
 const profile=cpuProfile(packet.difficulty),budget=makeSearchBudget(profile,now);
 const finish=index=>({index,rng:rng>>>0,metrics:{...budget.stats(),difficulty:packet.difficulty,configuration:CPU_CONFIGURATION_VERSION}});
 const ranked=rankBlockCandidates(packet.combat).sort((a,b)=>survivalRank(b.evaluation)-survivalRank(a.evaluation)||b.evaluation.score-a.evaluation.score||a.index-b.index);
 if(ranked.length)return finish(ranked[0].index);
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
