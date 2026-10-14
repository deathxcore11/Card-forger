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
 const unresolved=p=>(p?.readiness?.unknown || 0)+(p?.readiness?.issues?.length || 0);
 if(!valid(a)&&unresolved(a)!==unresolved(b))return unresolved(b)-unresolved(a);
 const delta=(a?.score||0)-(b?.score||0);if(delta)return delta;
 const engine=(a?.heuristic ?? a?.score ?? 0)-(b?.heuristic ?? b?.score ?? 0);if(engine)return engine;
 return (b?.engine?.unmappedNeeds || 0)-(a?.engine?.unmappedNeeds || 0);
}
export function bestBudgetDecks(candidates,budgets,{evaluate,cost,accept=()=>true}={}){
 const evaluated=candidates.filter(accept).map(d=>({...d,...cost(d),assessment:evaluate(d)}));
 return budgets.map(budget=>{
  const feasible=evaluated.filter(d=>d.cost<=budget+1e-6 && (!d.unknown || budget===Infinity));
  feasible.sort((a,b)=>comparePower(b.assessment,a.assessment)||(!!b.proven-!!a.proven)||a.cost-b.cost);
  const winner=feasible[0];if(!winner)return null;
  return {...winner,budget,warnings:[...(winner.warnings || []),...(winner.unknown?[`${winner.unknown} missing copies have no verified price; purchase total is incomplete.`]:[])],power:winner.assessment.score};
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
