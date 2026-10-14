import {esc,usd} from './ui.js';
// Rank complete candidate decks using the same evaluator shown in Power.
// Budget is additional purchase cost; a missing quote is never a free card.
export function purchaseCost(rows,{key=r=>r.cardId || r.name,owned=()=>0,price=()=>null}={}){
 const counts=new Map();for(const r of rows){const k=key(r),old=counts.get(k);counts.set(k,{row:r,qty:(old?.qty||0)+r.qty});}
 let cost=0,unknown=0;for(const {row,qty} of counts.values()){
  const missing=Math.max(0,qty-Math.max(0,owned(row))),p=price(row);
  if(!missing)continue;if(p==null||!Number.isFinite(Number(p))||Number(p)<0)unknown+=missing;else cost+=missing*Number(p);
 }return {cost,unknown};
}
export function comparePower(a,b){
 const valid=p=>!p?.readiness?.provisional;
 if(valid(a)!==valid(b))return valid(a)?1:-1;
 // A high generic role score cannot displace a complete, closely matched placing engine.
 if(valid(a) && (a?.from==='meta')!==(b?.from==='meta'))return a?.from==='meta'?1:-1;
 const unresolved=p=>(p?.readiness?.unknown || 0)+(p?.readiness?.issues?.length || 0);
 if(!valid(a)&&unresolved(a)!==unresolved(b))return unresolved(b)-unresolved(a);
 const delta=(a?.score||0)-(b?.score||0);if(delta)return delta;
 const engine=(a?.heuristic ?? a?.score ?? 0)-(b?.heuristic ?? b?.score ?? 0);if(engine)return engine;
 return (b?.engine?.unmappedNeeds || 0)-(a?.engine?.unmappedNeeds || 0);
}
export function bestBudgetDecks(candidates,budgets,{evaluate,cost,accept=()=>true}={}){
 const evaluated=candidates.filter(accept).map(d=>({...d,...cost(d),assessment:evaluate(d)}));
 const signature=d=>JSON.stringify((d.cards || Object.entries(d.zones || {}).flatMap(([zone,rs])=>rs.map(r=>({...r,zone})))).map(r=>[r.zone || 'main',r.cardId || r.name,r.qty]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 let previous=null;
 return budgets.map(budget=>{
  const feasible=evaluated.filter(d=>d.cost<=budget+1e-6 && (!d.unknown || budget===Infinity));
  feasible.sort((a,b)=>comparePower(b.assessment,a.assessment)||(!!b.proven-!!a.proven)||a.cost-b.cost);
  const winner=feasible[0];if(!winner)return null;
  const stronger=evaluated.filter(d=>!d.unknown && comparePower(d.assessment,winner.assessment)>0 && d.cost>budget).sort((a,b)=>a.cost-b.cost);
  const next=stronger[0],same=previous && signature(previous)===signature(winner);
  const explanation=same?'Same strongest assessed list as the lower budget. Extra spending did not improve the supported checks in this candidate pool.':winner.cost<budget-10 && budget!==Infinity?'The strongest assessed candidate costs less than this budget. Unspent money is kept; price alone does not improve the engine.':'';
  previous=winner;
  return {...winner,budget,explanation,nextUpgrade:next?{...next,budget:next.cost,overBy:next.cost-budget,withinTolerance:budget>0 && next.cost-budget<=10,power:next.assessment.score}:null,warnings:[...(winner.warnings || []),...(winner.unknown?[`${winner.unknown} missing copies have no verified price; purchase total is incomplete.`]:[])],power:winner.assessment.score};
 });
}
export function swappedZones(deck,zone,outId,inCard){
 const zones=structuredClone(deck.zones),out=zones[zone]?.find(r=>r.cardId===outId);
 if(!out||out.qty<1||outId===inCard.id)throw Error('Invalid replacement');
 out.qty--;zones[zone]=zones[zone].filter(r=>r.qty>0);const same=zones[zone].find(r=>r.cardId===inCard.id);
 if(same)same.qty++;else zones[zone].push({cardId:inCard.id,name:inCard.name,qty:1});
 return {...deck,zones};
}

export function sameCardLogic(game,a,b){
 if(!a||!b)return false;if(a.id===b.id)return true;if(a.name!==b.name)return false;
 const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
 if(game==='ptcg')return JSON.stringify([a.category,a.stage,a.hp,a.evolveFrom,a.types,(a.abilities||[]).map(x=>[x.name,clean(x.effect)]),(a.attacks||[]).map(x=>[x.name,x.damage,x.cost,clean(x.effect)]),clean(a.effect)])===JSON.stringify([b.category,b.stage,b.hp,b.evolveFrom,b.types,(b.abilities||[]).map(x=>[x.name,clean(x.effect)]),(b.attacks||[]).map(x=>[x.name,x.damage,x.cost,clean(x.effect)]),clean(b.effect)]);
 return clean(a.text || a.oracle_text)===clean(b.text || b.oracle_text);
}

// Bounded, yielding search over real replacement packages. Never mutates a saved list.
export async function refineCandidates(candidates,{neighbors,evaluate,cost,accept=()=>true,rounds=2,maxNeighbors=12,status=()=>{}}){
 const found=[...candidates];let frontier=[...candidates];
 for(let round=0;round<rounds;round++){
  const next=[];
  for(const [i,deck] of frontier.entries()){
   const before=evaluate(deck),options=neighbors(deck).filter(accept).slice(0,maxNeighbors);
   let best=null;
   for(const d of options){const quote=cost(d);if(quote.unknown)continue;const after=evaluate(d);if(comparePower(after,before)<=0)continue;
    const improved={...d,...quote,assessment:after,power:after.score};found.push(improved);if(!best || comparePower(after,best.assessment)>0)best=improved;
   }
   if(best)next.push(best);
   status(`Testing engine upgrades · pass ${round+1}/${rounds} · list ${i+1}/${frontier.length}`);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  frontier=next;if(!frontier.length)break;
 }
 return found;
}
export function towardDeck(deck,target,{protectedKeys=new Set(),key=r=>r.cardId || r.name,zoneOf=()=> 'main'}={}){
 const zones=d=>d.zones || {main:d.cards},out=[];
 for(const [zone,rows] of Object.entries(zones(deck))){
  const desired=zones(target)[zone] || [],count=new Map(rows.map(r=>[key(r),r.qty]));
  const adds=desired.filter(r=>r.qty>(count.get(key(r)) || 0));
  const cuts=rows.filter(r=>!protectedKeys.has(key(r)) && r.qty>(desired.find(x=>key(x)===key(r))?.qty || 0));
  for(const add of adds.slice(0,6))for(const cut of cuts.slice(0,3)){
   if(zoneOf(add)!==zoneOf(cut))continue;
   for(const n of [...new Set([1,Math.min(cut.qty-(desired.find(x=>key(x)===key(cut))?.qty || 0),add.qty-(count.get(key(add)) || 0))])]){
    const copy=structuredClone(deck),rs=zones(copy)[zone],old=rs.find(r=>key(r)===key(cut));old.qty-=n;
    const hit=rs.find(r=>key(r)===key(add));if(hit)hit.qty+=n;else rs.push({...add,qty:n,why:'Engine upgrade candidate'});
    const clean=rs.filter(r=>r.qty>0);if(copy.zones)copy.zones[zone]=clean;else copy.cards=clean;
    copy.proven=null;copy.source=null;copy.label='Assessed engine upgrade';out.push(copy);
   }
  }
 }
 return out;
}

export function budgetComparisonHtml(t,i,action){
 const n=t.nextUpgrade,rows=n?(n.cards || Object.values(n.zones || {}).flat()):[];
 return `${t.explanation?`<p class="small budget-explanation">${esc(t.explanation)}</p>`:''}${n?`<details class="budget-next"><summary>${n.withinTolerance?'Within $10 above your budget':'Next assessed improvement · outside budget'} · ${usd(n.cost)}</summary><p class="small">${usd(n.overBy)} above your ${usd(t.budget)} purchase budget · ${n.power} power estimate. This option is not included in the within-budget list.</p><p class="small">${rows.map(r=>`${r.qty}× ${esc(r.name)}`).join(' · ')}</p><button class="btn ghost small" data-act="${action}" data-i="${i}">Review this version</button></details>`:''}`;
}
