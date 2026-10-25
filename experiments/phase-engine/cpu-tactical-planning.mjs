import {creatureValue,estimateBlocks} from './cpu-combat-evaluation.mjs';
const has=(c,k)=>c?.keywords?.includes(k),power=c=>Math.max(0,c.damageFromToughness?c.toughness:c.power);
export function makeSearchBudget(profile,now=()=>performance.now()){
 const started=now();let nodes=0,exhausted=false;
 return {take(){if(nodes>=profile.maxNodes||now()-started>=profile.maxMs){exhausted=true;return false;}nodes++;return true;},stats(){return {nodes,elapsedMs:now()-started,budgetExhausted:exhausted};}};
}
export function handSequenceScore(hand,root,profile,budget){
 const card=hand?.cards[root];if(!card)return null;
 const value=c=>creatureValue(c)+(hand.plan==='green-creatures'?profile.planWeight*((c.toughnessEnabler?2:0)+(c.hasTriggers?1:0)+(c.hasAbility?1:0)):0);
 const starting=value(card),rootCost=card.cost?.total;
 if(!card.creature||rootCost==null||rootCost>hand.mana)return starting;
 function search(available,mana,addedPower,depth){
  if(depth<=0)return 0;let best=0;
  for(const id of available){if(!budget.take())break;const c=hand.cards[id];if(!c.creature||!c.cost)continue;
   const paid=c.cost.colored+Math.max(0,c.cost.generic-(c.powerDiscount?addedPower:0));if(paid>mana)continue;
   best=Math.max(best,value(c)+search(available.filter(i=>i!==id),mana-paid,addedPower+Math.max(0,c.power),depth-1));
  }return best;
 }
 return starting+search(hand.cards.map((_,i)=>i).filter(i=>i!==root),hand.mana-rootCost,Math.max(0,card.power),profile.depth-1);
}
export function attackScore(combat,attacks,profile,budget){
 if(!attacks.length)return 0;
 if(attacks.some(a=>a.object===null||a.target.kind==='unknown'))return -Infinity;
 const seat=combat.seat,attackers=attacks.map(a=>({...a,defendingSeat:a.target.kind==='player'?a.target.seat:1-seat}));
 const blockers=combat.objects.map((c,i)=>({c,i})).filter(({c})=>c.known&&c.creature&&c.controller!==seat&&!c.tapped);
 const edges=blockers.map(({c,i})=>[i,attackers.filter(a=>!has(combat.objects[a.object],'Flying')||has(c,'Flying')||has(c,'Reach')).map(a=>a.object)]);
 const hypothetical={...combat,attackers,legalBlocks:edges.flatMap(([b,aa])=>aa.map(a=>[b,a])),complete:false,uncertain:true};
 let worst=Infinity,replies=0;
 function evaluate(assignments){
  if(replies>=profile.maxReplies||!budget.take())return;replies++;
  const e=estimateBlocks(hypothetical,assignments);if(!e)return;
  let score=e.killed-e.lost+(combat.life[1-seat]-e.life[1-seat])*.8;
  if(e.life[1-seat]<=0&&e.life[seat]>0)score+=1000;
  if(e.life[seat]<=0)score-=2000;
  if(profile.counterWeight){
   const committed=new Set(attacks.filter(a=>!has(combat.objects[a.object],'Vigilance')).map(a=>a.object));
   const defense=combat.objects.reduce((sum,c,i)=>sum+(c.known&&c.creature&&c.controller===seat&&!c.tapped&&!committed.has(i)?Math.max(0,c.toughness):0),0);
   const counter=Math.max(0,blockers.reduce((sum,{c})=>sum+power(c),0)-defense);
   score-=counter*profile.counterWeight;if(counter>=Math.max(1,e.life[seat]))score-=30*profile.counterWeight;
  }
  worst=Math.min(worst,score);
 }
 // First a greedy plausible defense, then bounded alternative assignments.
 // These are estimates of future responses, never engine-authorized actions.
 const greedy=edges.flatMap(([b,aa])=>aa.length?[[b,[...aa].sort((x,y)=>power(combat.objects[y])-power(combat.objects[x]))[0]]]:[]);evaluate(greedy);
 // Avoid unbounded traversal after a time/node stop: count partial nodes too.
 if(blockers.length<=8&&budget.take()){
  function bounded(at,pairs){if(replies>=profile.maxReplies||!budget.take())return;if(at===edges.length){evaluate(pairs);return;}const [b,aa]=edges[at];bounded(at+1,pairs);for(const a of aa){if(replies>=profile.maxReplies)return;bounded(at+1,[...pairs,[b,a]]);}}
  bounded(0,[]);
 }
 return worst===Infinity?null:worst;
}
