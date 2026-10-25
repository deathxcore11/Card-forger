// Public-state estimates only. Proposed assignments still require engine validation.
import {estimateBlocks,survivalRank,creatureValue} from './cpu-combat-evaluation.mjs';
export const compareBlockEvaluations=(a,b)=>survivalRank(b)-survivalRank(a)||b.score-a.score;
const canonical=pairs=>pairs.map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
const power=c=>Math.max(0,c?.damageFromToughness?c.toughness:c?.power||0);
export function searchBlockAssignments(combat,{maxNodes=2048,maxEvaluations=96,maxMs=20,now=()=>performance.now(),cancelled=()=>false,eligibleBlockers=null}={}){
 const start=now();let nodes=0,evaluations=0,stopped=false;
 const take=()=>{if(nodes>=maxNodes||now()-start>=maxMs||cancelled()){stopped=true;return false;}nodes++;return true;};
 const rows=[],seen=new Set(),eligible=eligibleBlockers===null?null:new Set(eligibleBlockers);
 const add=pairs=>{if(evaluations>=maxEvaluations||!take()){stopped=true;return null;}const assignments=canonical(pairs),key=JSON.stringify(assignments);if(seen.has(key))return null;seen.add(key);evaluations++;const evaluation=estimateBlocks(combat,assignments);if(!evaluation)return null;const r={assignments,evaluation};rows.push(r);return r;};
 const finish=()=>({candidates:rows.sort((a,b)=>compareBlockEvaluations(a.evaluation,b.evaluation)),nodes,evaluations,truncated:stopped,elapsedMs:now()-start});
 // Explicit finite graph bounds; existing authoritative suggestions are retained.
 if(combat.objects.length>512||combat.attackers.length>64||combat.legalBlocks.length>4096){stopped=true;return finish();}
 const byAttacker=new Map(combat.attackers.filter(a=>a.object!==null).map(a=>[a.object,[]]));
 for(const [b,a]of combat.legalBlocks){if(!take())return finish();if(b!==null&&byAttacker.has(a)&&(!eligible||eligible.has(b)))byAttacker.get(a).push(b);}
 for(const [a,bb]of byAttacker)byAttacker.set(a,[...new Set(bb)]);
 const destination=new Map(combat.attackers.map(a=>[a.object,a.target]));
 const threat=a=>(destination.get(a)?.kind==='player'&&destination.get(a)?.seat===combat.seat?1000:0)+power(combat.objects[a]);
 add([]);
 // Augmenting paths preserve scarce blockers: a ground creature should not use
 // the only flying blocker if a reassignment covers both attackers.
 for(const mode of ['cheap','tough','trade']){
  const occupied=new Map(),attackers=[...byAttacker.keys()].sort((a,b)=>byAttacker.get(a).length-byAttacker.get(b).length||threat(b)-threat(a)||a-b);
  const quality=(b,a)=>mode==='tough'?-(combat.objects[b]?.toughness||0)+(combat.objects[b]?.damage||0):mode==='trade'?Math.abs(power(combat.objects[b])-(combat.objects[a]?.toughness||0)):creatureValue(combat.objects[b]);
  const ordered=new Map([...byAttacker].map(([a,bb])=>[a,[...bb].sort((b,c)=>quality(b,a)-quality(c,a)||b-c)]));
  function place(a,visited){for(const b of ordered.get(a)||[]){if(!take())return false;if(visited.has(b))continue;visited.add(b);if(!occupied.has(b)||place(occupied.get(b),visited)){occupied.set(b,a);return true;}}return false;}
  for(const a of attackers){if(stopped)break;place(a,new Set());}
  add([...occupied]);if(stopped)break;
 }
 // A second shape covers legal multi-blocks, including trample situations. Its
 // outcome remains uncertain under the existing allocation model.
 if(!stopped){const used=new Set(),pairs=[];for(const a of [...byAttacker.keys()].sort((a,b)=>threat(b)-threat(a)||a-b)){
  for(const b of byAttacker.get(a)){if(!take())break;if(used.has(b))continue;pairs.push([b,a]);used.add(b);}if(stopped)break;
 }add(pairs);}
 // Prune unnecessary sacrifices from the best seed. Never blindly reward blocks.
 if(!stopped&&rows.length){let current=[...rows].sort((a,b)=>compareBlockEvaluations(a.evaluation,b.evaluation))[0];
  for(const [b]of [...current.assignments]){if(stopped)break;const next=add(current.assignments.filter(p=>p[0]!==b));if(next&&compareBlockEvaluations(next.evaluation,current.evaluation)<0)current=next;}
  // Small graphs also retain exhaustive alternatives; large boards get broad
  // seeds first instead of spending the whole budget in one traversal prefix.
  const bs=[...new Set([...byAttacker.values()].flat())].sort((a,b)=>a-b),edges=new Map(bs.map(b=>[b,[...byAttacker].filter(([,bb])=>bb.includes(b)).map(([a])=>a)]));
  if(bs.length<=6){function walk(at,pairs){if(stopped||evaluations>=maxEvaluations){stopped=true;return;}if(!take())return;if(at===bs.length){add(pairs);return;}const b=bs[at];walk(at+1,pairs);for(const a of edges.get(b)){if(stopped)break;walk(at+1,[...pairs,[b,a]]);}}walk(0,[]);}
 }
 return finish();
}
export function chooseBoundedBlock(combat,budget){
 if(combat.decision!=='DeclareBlockers')return null;
 // Dense legal proposals first, then no-block. A time stop retains an evaluated
 // survival candidate rather than falling back to the first (often empty) row.
 const order=combat.blockCandidates.map((pairs,index)=>({pairs,index})).filter(x=>Array.isArray(x.pairs)).sort((a,b)=>b.pairs.length-a.pairs.length||a.index-b.index);
 if(!order.length)return null;
 const empty=order.findIndex(x=>x.pairs.length===0);if(empty>1)order.splice(1,0,order.splice(empty,1)[0]);
 let best=null;
 for(const c of order){if(!budget.take())break;const evaluation=estimateBlocks(combat,c.pairs);if(evaluation&&(!best||compareBlockEvaluations(evaluation,best.evaluation)<0))best={index:c.index,evaluation};}
 // An expired budget before any evaluation is an explicit legal fallback, not
 // a claim that a terminal outcome was proved. Ordering is deterministic.
 return {index:best?.index??order[0].index,evaluated:best!==null};
}
