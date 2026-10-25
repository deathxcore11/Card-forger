// Bounded public-information prediction. This never determines game outcomes.
// Predictions assume no intervening spells/abilities. Unknown effects downgrade
// confidence, and only engine-authored candidate indices can be returned.
const has=(c,k)=>c?.keywords?.includes(k);
const strength=c=>Math.max(0,c.damageFromToughness?c.toughness:c.power);
export const creatureValue=c=>c?.known===false?2:Math.max(0,c?.power||0)+Math.max(0,c?.toughness||0)+(['Deathtouch','Flying','DoubleStrike','Lifelink'].reduce((v,k)=>v+(has(c,k)?2:0),0));
const first=c=>has(c,'FirstStrike')||has(c,'DoubleStrike');
const strikes=(c,wave)=>wave===0?first(c):!first(c)||has(c,'DoubleStrike');
const dead=c=>c.toughness<=0||(!has(c,'Indestructible')&&(c.damage>=c.toughness||c.deathtouch));
export function estimateBlocks(combat,assignments){
 if(!combat||!Array.isArray(assignments))return null;
 const {seat,attackers}=combat,objects=combat.objects.map(c=>({...c,alive:true,deathtouch:false})),life=[...combat.life];
 let supported=combat.complete&&!combat.uncertain&&life.length===2&&life.every(Number.isFinite),lost=0,killed=0;
 const seen=new Set(),groups=new Map(attackers.map(a=>[a.object,[]]));
 for(const [b,a]of assignments){
  if(b===null||a===null||!objects[b]||!groups.has(a)||seen.has(b)||!combat.legalBlocks.some(([x,y])=>b===x&&a===y))return null;
  seen.add(b);groups.get(a).push(b);
 }
 const participants=new Set([...attackers.map(a=>a.object),...seen]);
 for(const id of participants){const c=objects[id];if(!c?.known||!c.creature||![c.power,c.toughness,c.damage].every(Number.isFinite))supported=false;}
 if([...groups.values()].some(g=>g.length>1))supported=false; // multi-block allocation is an estimate, not an exhaustive proof
 const initiallyBlocked=new Set([...groups].filter(([,b])=>b.length).map(([a])=>a));
 const initial=objects.map(c=>({...c}));
 for(const wave of [0,1]){
  const hits=[],gains=[0,0],damage=[0,0];
  function hit(from,to,amount){if(amount<=0)return;if(has(from,'Lifelink'))gains[from.controller]+=amount;hits.push({to,amount,touch:has(from,'Deathtouch')});}
  for(const a of attackers){
   const attacker=objects[a.object];if(!attacker?.alive)continue;
   const blockers=(groups.get(a.object)||[]).filter(b=>objects[b]?.alive);
   if(strikes(attacker,wave)){
    let remaining=strength(attacker);
    // Allocation estimate prioritizes lethal assignments. With one blocker
    // the maximal player damage is exact under the stated model assumptions.
    for(const b of blockers){const blocker=objects[b],need=has(attacker,'Deathtouch')?1:Math.max(0,blocker.toughness-blocker.damage),amount=Math.min(remaining,need);hit(attacker,b,amount);remaining-=amount;}
    const through=(!initiallyBlocked.has(a.object)||has(attacker,'Trample'))?remaining:0;
    if(through&&a.target.kind==='player'){damage[a.target.seat]+=through;if(has(attacker,'Lifelink'))gains[attacker.controller]+=through;}
    if(!through&&remaining&&blockers.length)hit(attacker,blockers[0],remaining);
   }
   for(const b of blockers){const blocker=objects[b];if(strikes(blocker,wave))hit(blocker,a.object,strength(blocker));}
  }
  for(const h of hits){objects[h.to].damage+=h.amount;if(h.touch)objects[h.to].deathtouch=true;}
  for(const p of [0,1])life[p]+=gains[p]-damage[p];
  for(const id of participants){const c=objects[id];if(c?.alive&&dead(c)){c.alive=false;if(c.controller===seat)lost+=creatureValue(initial[id]);else killed+=creatureValue(initial[id]);}}
  if(life.some(n=>n<=0))break; // state-based loss before the next damage step
 }
 const ownLost=life[seat]<=0,otherLost=life[1-seat]<=0;
 return {confidence:supported?'supported-no-response-model':'estimate',life,lost,killed,
  outcome:supported?(ownLost?(otherLost?'draw':'loss'):(otherLost?'win':'survive')):'unknown',
  score:killed-lost+(life[seat]-combat.life[seat])*Math.min(2,4/Math.max(1,combat.life[seat]))-(life[1-seat]-combat.life[1-seat])*.3,
  assumption:'No intervening responses; engine remains authoritative.'};
}
export function rankBlockCandidates(combat){
 if(combat?.decision!=='DeclareBlockers')return [];
 return combat.blockCandidates.map((a,index)=>a===null?null:{index,evaluation:estimateBlocks(combat,a)}).filter(r=>r?.evaluation);
}
export function survivalRank(e){return e.outcome==='win'?4:e.outcome==='survive'?3:e.outcome==='draw'?2:e.outcome==='unknown'?1:0;}
