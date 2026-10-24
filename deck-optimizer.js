import {esc,usd} from './ui.js';
// Rank complete candidate decks using the same evaluator shown in Power.
// Budget is additional purchase cost; a missing quote is never a free card.
export function purchaseCost(rows,{key=r=>r.cardId || r.name,owned=()=>0,price=()=>null}={}){
 const counts=new Map();for(const r of rows){const k=key(r),old=counts.get(k);counts.set(k,{row:r,qty:(old?.qty||0)+r.qty});}
 let cost=0,unknown=0;for(const {row,qty} of counts.values()){
  const missing=Math.max(0,qty-Math.max(0,owned(row))),p=price(row);
  if(!missing)continue;if(p==null||typeof p==='string'&&!p.trim()||!Number.isFinite(Number(p))||Number(p)<0)unknown+=missing;else cost+=missing*Number(p);
 }return {cost,unknown};
}
export function comparePower(a,b){
 const valid=p=>!p?.readiness?.provisional;
 if(valid(a)!==valid(b))return valid(a)?1:-1;
 const goalA=a?.goal||a?.criteria?.goal||'strongest',goalB=b?.goal||b?.criteria?.goal||'strongest';
 if(goalA!==goalB || ['fun','chaos','weak'].includes(goalA))return 0;
 // Theme is an admissibility constraint, not a reward per filler creature. A
 // strength upgrade may vary density, but cannot erase the only recognized route
 // serving the requested theme. Unmapped subjective themes need user review.
 if(goalA==='theme'){
  const ap=a?.criteria?.plan,bp=b?.criteria?.plan;
  if(!ap||!bp||a?.criteria?.requestedStyle!==b?.criteria?.requestedStyle)return 0;
  const ar=new Set((ap.routes||[]).filter(r=>r.status!=='unsupported').map(r=>r.kind)),br=new Set((bp.routes||[]).filter(r=>r.status!=='unsupported').map(r=>r.kind));
  if(!ar.size&&!br.size)return 0;
  if(!ar.size||!br.size)return ar.size?1:-1;
  if(![...ar].some(r=>br.has(r)))return 0;
 }

 // A high generic role score cannot displace a complete, closely matched placing engine.
 if(valid(a) && (a?.from==='meta')!==(b?.from==='meta'))return a?.from==='meta'?1:-1;
 const unresolved=p=>(p?.readiness?.unknown || 0)+(p?.readiness?.issues?.length || 0);
 if(!valid(a)&&unresolved(a)!==unresolved(b))return unresolved(b)-unresolved(a);
 // Commander role saturation is not proof of a supported plan. Preserve known
 // support before optimizing a structural subscore; subjective goals must not be
 // silently turned into strongest-deck searches. No arbitrary tribal/ramp caps.
 const ac=a?.criteria,bc=b?.criteria;
 if(ac&&bc&&!a?.strategic&&!b?.strategic){
  const goal=a?.goal||ac.goal||'strongest',other=b?.goal||bc.goal||'strongest';
  if(goal!==other)return 0;
  if(['fun','chaos','weak'].includes(goal))return 0;
  const known=p=>p.plan?.status==='supported',support=p=>p.plan?.supportedCopies||0;
  if(known(ac)!==known(bc))return known(ac)?1:-1;
  if(known(ac)&&known(bc)){
   const routeSet=p=>new Set((p.plan?.routes||[]).filter(r=>r.status!=='unsupported').map(r=>r.kind));
   const ar=routeSet(ac),br=routeSet(bc),lost=[...br].filter(r=>!ar.has(r)),gained=[...ar].filter(r=>!br.has(r));
   if(lost.length&&!gained.length)return -1;if(gained.length&&!lost.length)return 1;
   if(goal==='theme'&&support(ac)!==support(bc))return support(ac)-support(bc);
   // A proposed replacement cannot call itself an improvement solely by trading
   // away demonstrated support to fill more generic role checkboxes.
   if(support(ac)<support(bc)&&(a.score||0)>(b.score||0))return -1;
   if(support(bc)<support(ac)&&(b.score||0)>(a.score||0))return 1;
  }
 }
 if((a?.strategic?.score===null)||(b?.strategic?.score===null))return 0;
 const value=p=>p?.strategic&&p.from!=='meta'?p.strategic.rankingValue??p.score:p?.score;
 const delta=(value(a)||0)-(value(b)||0);if(delta)return delta;
 if(a?.strategic||b?.strategic)return 0;
 const engine=(a?.heuristic ?? a?.score ?? 0)-(b?.heuristic ?? b?.score ?? 0);if(engine)return engine;
 return (b?.engine?.unmappedNeeds || 0)-(a?.engine?.unmappedNeeds || 0);
}
export function bestBudgetDecks(candidates,budgets,{evaluate,cost,accept=()=>true}={}){
 const evaluated=candidates.filter(accept).map(d=>({...d,...cost(d),assessment:evaluate(d)}));
 const signature=d=>JSON.stringify((d.cards || Object.entries(d.zones || {}).flatMap(([zone,rs])=>rs.map(r=>({...r,zone})))).map(r=>[r.zone || 'main',r.cardId || r.name,r.qty]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 let previous=null;
 return budgets.map(budget=>{
  const feasible=evaluated.filter(d=>d.cost<=budget+1e-6 && (!d.unknown || budget===Infinity));
  const complete=d=>{
    if(d.open>0)return false;
    const n=(d.cards||d.zones?.main||[]).reduce((sum,r)=>sum+r.qty,0);
    return !(d.size>0&&n<d.size);
  };
  const ready=d=>complete(d)&&!d.assessment?.readiness?.provisional;
  feasible.sort((a,b)=>Number(ready(b))-Number(ready(a))||comparePower(b.assessment,a.assessment)||(!!b.proven-!!a.proven)||a.cost-b.cost);
  const winner=feasible[0];if(!winner)return null;
  const stronger=evaluated.filter(d=>!d.unknown && (ready(d)||!ready(winner)) && comparePower(d.assessment,winner.assessment)>0 && d.cost>budget).sort((a,b)=>a.cost-b.cost);
  const next=stronger[0],same=previous && signature(previous)===signature(winner);
  const explanation=winner.assessment?.score==null?'Power is unavailable for this candidate. This is a reviewable budget-fit draft, not a verified strongest list.':same?'Same strongest assessed list as the lower budget. Extra spending did not improve the supported checks in this candidate pool.':winner.cost<budget-10 && budget!==Infinity?'The strongest assessed candidate costs less than this budget. Unspent money is kept; price alone does not improve the engine.':'';
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
// Long searches hand the main thread back every ~40 ms so the screen keeps animating and scrolling.
let lastBreath = 0;
const breathe = async () => {
  const now = globalThis.performance?.now?.() ?? Date.now();
  if (now - lastBreath > 40) { await new Promise((r) => setTimeout(r, 0)); lastBreath = globalThis.performance?.now?.() ?? Date.now(); }
};
export async function refineCandidates(candidates,{neighbors,evaluate,cost,accept=()=>true,rounds=2,maxNeighbors=12,status=()=>{},current=()=>true}){
 const checkCurrent=()=>{if(current?.()===false)throw new DOMException('Build replaced','AbortError');};
 checkCurrent();const found=[...candidates];let frontier=[...candidates];
 for(let round=0;round<rounds;round++){
  const next=[];
  for(const [i,deck] of frontier.entries()){
   checkCurrent();const before=evaluate(deck),options=[];
   // Preserve the first N accepted neighbors, including unknown-price entries.
   // Later neighbors could never be evaluated by filter(...).slice(0,N), so
   // avoid inspecting them once this exact same admission window is filled.
   if(maxNeighbors>0)for(const candidate of neighbors(deck)){
    checkCurrent();if(accept(candidate))options.push(candidate);
    if(options.length>=maxNeighbors)break;
    await breathe();checkCurrent();
   }
   let best=null;
   for(const d of options){await breathe();checkCurrent();const quote=cost(d);if(quote.unknown)continue;const after=evaluate(d);if(comparePower(after,before)<=0)continue;
    const improved={...d,...quote,assessment:after,power:after.score};found.push(improved);if(!best || comparePower(after,best.assessment)>0)best=improved;
   }
   if(best)next.push(best);
   status(`Testing engine upgrades · pass ${round+1}/${rounds} · list ${i+1}/${frontier.length}`);
   await new Promise(resolve=>setTimeout(resolve,0));checkCurrent();
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

// Card strength for spending a budget: how much of the competitive field plays it, plus a modest
// price signal (inside one legal format, stronger cards usually cost more). Owned copies never
// look cheaper here; cost is handled by the purchase quote.
// fit: how well it serves this deck's plan (game-specific score, roughly 0–15). Price only breaks
// ties between cards that fit about as well, so an expensive card that doesn't fit never wins.
export const cardQuality = (rate, price, fit = 0) => fit + (rate || 0) / 8 + Math.min(4, Math.log2(1 + Math.max(0, Number(price) || 0))) * 0.35;

// Spend toward a budget: swap the weakest replaceable copies for stronger affordable cards while
// the list stays legal and its Power doesn't drop. Lands within `tolerance` of the budget (over is
// allowed up to the tolerance). Never touches protected cards (the build-around card, a Pokémon
// line, Energy, lands). Returns the upgraded deck and the swaps made, in order.
// rows(deck) → [{key, zone, qty, card}], swap(deck, out, inCard, n) → new deck.
export async function spendUp(deck, budget, { pool, quality, rows, swap, cost, evaluate, accept = () => true, protect = () => false, maxCopies = () => 4, tolerance = 10, maxSwaps = 30, status = () => {} }) {
  const cap = budget === Infinity ? Infinity : budget + tolerance,
    ranked = [...new Map(pool.filter(Boolean).map((c) => [c.id || c.name, c])).values()].map((c) => ({ c, q: quality(c) })).sort((a, b) => b.q - a.q),
    swaps = [];
  let cur = deck,
    curCost = cost(cur),
    curPower = evaluate(cur),
    evals = 0;
  if (curCost.unknown) return { deck, swaps };
  const goal = deck.goal || curPower?.goal || curPower?.criteria?.goal || 'strongest';
  // Price/popularity-based spending is a strength search, not a way to validate
  // subjective intent. Keep the requested experience instead of spending it away.
  if (['fun', 'chaos', 'weak'].includes(goal)) return { deck, swaps, cost: curCost.cost, power: curPower };
  for (let step = 0; step < maxSwaps && evals < 90; step++) {
    if (budget !== Infinity && curCost.cost >= budget - 1) break;
    const have = rows(cur),
      weak = have.filter((r) => !protect(r)).map((r) => ({ ...r, q: quality(r.card) })).sort((a, b) => a.q - b.q).slice(0, 6);
    let done = false;
    for (const w of weak) {
      for (const { c, q } of ranked) {
        if (q <= w.q + 0.6) break;
        const inDeck = have.filter((r) => (r.card?.id || r.card?.name) === (c.id || c.name)).reduce((a, r) => a + r.qty, 0),
          room = maxCopies(c) - inDeck;
        if (room <= 0) continue;
        const n = Math.min(w.qty, room);
        let next;
        try {
          next = swap(cur, w, c, n);
        } catch {
          continue;
        }
        const quote = cost(next);
        if (quote.unknown || quote.cost > cap + 1e-6 || !accept(next)) continue;
        evals++;
        await breathe();
        const power = evaluate(next);
        const issues = (x) => (x?.readiness?.issues?.length || 0) + (x?.readiness?.unknown || 0);
        if (comparePower(power, curPower) < 0 || (power?.score ?? 0) < (curPower?.score ?? 0) - 1 || (power?.readiness?.provisional && !curPower?.readiness?.provisional) || issues(power) > issues(curPower)) continue;
        swaps.push({ out: w.card?.name || w.key, in: c.name, n, from: w.q, to: q, cost: quote.cost - curCost.cost });
        cur = next;
        curCost = quote;
        curPower = power;
        done = true;
        break;
      }
      if (done || evals >= 90) break;
    }
    status(`Spending toward ${budget === Infinity ? "the best version" : "$" + budget} · ${swaps.length} upgrade${swaps.length === 1 ? "" : "s"}`);
    await new Promise((r) => setTimeout(r, 0));
    if (!done) break;
  }
  return { deck: cur, swaps, cost: curCost.cost, power: curPower };
}

// Plain notes for each budget version: how much of the budget it uses, whether it repeats the
// version below, and what the strongest version found costs when that's beyond this budget.
export function budgetNotes(tiers, budgets) {
  const sig = (d) => JSON.stringify((d?.cards || Object.values(d?.zones || {}).flat()).map((r) => [r.cardId || r.name, r.qty]).sort());
  const real = tiers.filter(Boolean),
    best = real.reduce((a, t) => (!a || (t.power ?? 0) > (a.power ?? 0) || ((t.power ?? 0) === (a.power ?? 0) && t.cost > a.cost) ? t : a), null);
  let prev = null;
  return tiers.map((t, i) => {
    if (!t) return t;
    const b = budgets[i],
      notes = [];
    if (prev && sig(prev.t) === sig(t)) notes.push(`Same list as the ${prev.b === 0 ? "your-cards" : usd(prev.b)} version: nothing stronger for this plan was found in the extra budget.`);
    else if (b !== Infinity && b > 0 && t.cost < b - 10) notes.push(`Uses ${usd(t.cost)} of ${usd(b)}. No stronger cards for this plan fit the rest without weakening it; the difference stays in your pocket.`);
    if (t.upgrades?.length) notes.push(`${t.upgrades.length} upgrade${t.upgrades.length === 1 ? "" : "s"} for this budget: ${t.upgrades.slice(0, 4).map((u) => `${u.n}× ${u.out} → ${u.in}`).join(" · ")}${t.upgrades.length > 4 ? " · …" : ""}.`);
    if (best && best !== t && b !== Infinity && best.cost > b + 10 && (best.power ?? 0) > (t.power ?? 0)) notes.push(`The strongest version found costs ${usd(best.cost)} (${best.power} power${t.power != null ? ` vs ${t.power}` : ""}). ${best.cost > b + 100 ? "The upgrades past this budget are expensive cards; see the No-limit version for them." : "See the higher versions for what the extra money buys."}`);
    prev = { t, b };
    return { ...t, explanation: notes.join(" ") || t.explanation || "" };
  });
}

// How hard a list is to pilot, from how much each card asks of you (rules text per card, weighted
// by copies; lands and basic Energy don't count). Easy / Medium / Hard.
export function difficultyOf(entries) {
  let chars = 0, n = 0;
  for (const { qty, text } of entries) {
    if (text == null) continue;
    chars += Math.min(600, String(text).length) * qty;
    n += qty;
  }
  const avg = n ? chars / n : 0;
  return avg < 130 ? { label: "Easy to play", key: "easy", avg } : avg < 230 ? { label: "Medium", key: "medium", avg } : { label: "Hard to play", key: "hard", avg };
}

// Budget versions → distinct variations: identical lists merge into one (covering every budget
// they won), then they're named by what they are, cheapest/easiest first, strongest last.
export function variantsFrom(tiers, budgets, difficulty = () => null) {
  const sig = (d) => JSON.stringify((d?.cards || Object.values(d?.zones || {}).flat()).map((r) => [r.cardId || r.name, r.qty]).sort());
  const out = [];
  tiers.forEach((t, i) => {
    if (!t) return;
    const b = budgets[i] ?? t.budget,
      same = out.find((x) => sig(x) === sig(t));
    if (same) {
      same.covers.push(b);
      return;
    }
    out.push({ ...t, budget: b, covers: [b], difficulty: difficulty(t) });
  });
  const full = out.filter((t) => !(t.open || t.total < t.size));
  full.forEach((t, k) => {
    t.variant = full.length === 1 ? "Best version" : k === 0 ? "Starter" : k === full.length - 1 ? "Best version" : full.length === 3 ? "Upgraded" : ["Upgraded", "Strong", "Stronger"][k - 1] || "Upgraded";
  });
  for (const t of out) {
    if (!t.variant) t.variant = t.budget===0?"Your cards only":"Budget draft";
    const c = t.covers.filter((x) => x !== 0);
    t.coversText = !c.length ? "" : c.includes(Infinity) && c.length > 1 ? `for budgets of ${usd(Math.min(...c))} and up` : c.includes(Infinity) ? "no budget limit" : c.length > 1 ? `for budgets ${usd(Math.min(...c))}–${usd(Math.max(...c))}` : `up to ${usd(c[0])}`;
    // The merge replaces "Same list as…" notes.
    t.explanation = String(t.explanation || "").replace(/Same list as the [^.]*\.\s*/g, "").trim();
  }
  return out;
}

// Fill open slots with the strongest affordable cards (one copy at a time) while the budget allows.
export function fillOpen(deck, budget, { pool, quality, count, size, add, cost, accept = () => true, maxCopies = () => 4, have = () => 0, tolerance = 10 }) {
  const cap = budget === Infinity ? Infinity : budget + tolerance,
    ranked = [...new Map(pool.filter(Boolean).map((c) => [c.id || c.name, c])).values()].sort((a, b) => quality(b) - quality(a));
  let d = deck, guard = 0;
  while (count(d) < size && guard++ < 80) {
    let placed = false;
    const choices=ranked.filter(c=>have(d,c)<maxCopies(c)).map(c=>{const next=add(d,c);return {c,next,q:cost(next)};}).filter(x=>!x.q.unknown&&x.q.cost<=cap+1e-6&&accept(x.next)).sort((a,b)=>a.q.cost-b.q.cost||quality(b.c)-quality(a.c));
    if(choices.length){const {next,q}=choices[0];d={...next,cost:q.cost};placed=true;}
    if (!placed) break;
  }
  return d;
}
