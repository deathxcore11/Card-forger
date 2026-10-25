import {chooseVisible} from './visible-cpu-policy.mjs';
import {PUBLIC_CPU_VERSION} from './cpu-public-observation.mjs';
import {rankBlockCandidates,survivalRank} from './cpu-combat-evaluation.mjs';
export function chooseCpu(packet,rng){
 if(packet?.version!==PUBLIC_CPU_VERSION||!Array.isArray(packet.legacy?.choices)||packet.legacy.choices.length!==packet.combat?.blockCandidates?.length)throw Error('INVALID_CPU_PACKET');
 const ranked=rankBlockCandidates(packet.combat).sort((a,b)=>survivalRank(b.evaluation)-survivalRank(a.evaluation)||b.evaluation.score-a.evaluation.score||a.index-b.index);
 if(ranked.length)return {index:ranked[0].index,rng:rng>>>0};
 return chooseVisible(packet.legacy,rng);
}
