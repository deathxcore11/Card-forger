import {setupBurden} from './deck-preferences.js';
// Shared request/result boundary for manual construction and conversational AI.
// Builders remain responsible for card selection; this layer never fabricates cards.
import { comparePower } from './deck-optimizer.js';
import { engineMap } from './engine-map.js';
import { strategicRisk } from './strategy-risk.js';
import {pokemonEnergyCapability} from './deckpower.js';
import { inspectMtgTheme } from './builder.js';
import { fitsTypeRestrictions } from './planner.js';
export const DECK_POLICY = Object.freeze({overagePercent:10,overageMaximum:5,maxCandidates:24});
const cents=n=>Math.round(n*100)/100;
const key=s=>String(s||'').normalize('NFKC').toLowerCase().trim();
export function normalizeDeckRequest(input={},formats={}) {
 const game=['mtg','ygo','ptcg'].includes(input.game)?input.game:'mtg', choices=formats[game]||[];
 const fallback={mtg:'Standard',ygo:'tcg',ptcg:'standard'}[game];
 const selected=choices.find(f=>[f.id,f.name].some(v=>key(v)===key(input.format||fallback)))||(!input.format?choices[0]:null);
 if(!selected)throw Error('Choose a supported format.');
 const raw=input.budget,target=raw===undefined||raw===null||raw===''||raw===Infinity?null:Number(raw);
 if(target!==null&&(!Number.isFinite(target)||target<0||target>100000))throw Error('Enter a budget between $0 and $100,000, or leave it blank.');
 const budgetBasis=input.budgetBasis||input.budget_basis||'total',ownedOnly=input.ownedOnly===true||budgetBasis==='owned';
 const budgetMode=input.budgetMode==='target'?'target':'cap';
 const allowance=target===null||budgetMode==='cap'?0:cents(Math.min(target*DECK_POLICY.overagePercent/100,DECK_POLICY.overageMaximum));
 return {...input,game,format:game==='mtg'?selected.name:selected.id,formatName:selected.name,
  theme:String(input.theme??input.style??'').trim(),budget:target,budgetBasis:budgetBasis==='purchase'||budgetBasis==='owned'?'purchase':'total',
  ownedOnly,budgetMode,preferOwned:input.preferOwned??input.goal!=='strongest',easy:input.easy===true||/easy to play|beginner|simple/i.test(input.style||''),
  randomSeed:Number.isFinite(input.randomSeed)?input.randomSeed:Math.floor(Math.random()*0x7fffffff),
  allowance,constructionBudgets:ownedOnly?[0]:target===null?[Infinity]:budgetMode==='cap'?[target]:[...new Set([target,target+allowance,Infinity])]};
}
export function priceDeck(rows,basis='total') {
 const grouped=new Map();
 for(const r of rows){const k=r.priceKey||r.id||r.name,old=grouped.get(k);grouped.set(k,{...r,qty:r.qty+(old?.qty||0)});}
 let total=0,purchase=0,unknown=0,purchaseUnknown=0,ownedCopies=0,copies=0;
 for(const r of grouped.values()){
  const qty=Math.max(0,r.qty),owned=Math.min(qty,Math.max(0,r.owned||0)),missing=qty-owned;
  const p=typeof r.price==='number'&&Number.isFinite(r.price)&&r.price>=0?r.price:null;
  copies+=qty;ownedCopies+=owned;
  if(p===null){unknown+=qty;purchaseUnknown+=missing;}else{total+=qty*p;purchase+=missing*p;}
 }
 const unpriced=basis==='purchase'?purchaseUnknown:unknown,subtotal=cents(basis==='purchase'?purchase:total);
 return {basis,copies,ownedCopies,subtotal,unpriced,estimate:unpriced?null:subtotal,
  totalEstimate:unknown?null:cents(total),purchaseEstimate:purchaseUnknown?null:cents(purchase),
  coverage:copies?1-(basis==='purchase'?purchaseUnknown:unknown)/Math.max(1,basis==='purchase'?copies-ownedCopies:copies):0,
  note:'App reference prices, not a checkout quote. Tax and shipping excluded.'};
}
// Follow the anchor's evolution chain in THIS candidate, including equivalent
// printings. Never reuse the heuristic candidate's attacker IDs on another list.
export function pokemonPlanAttackers(request,rows,deck={}) {
 const cards=rows.filter(r=>r.zone==='main'&&r.card?.category==='Pokemon').map(r=>r.card);
 const anchors=[request.seedCard,...(request.seedCards||[])].filter(c=>c?.category==='Pokemon');
 const lineage=new Set(anchors.map(c=>key(c.name)));
 for(let pass=0;pass<3;pass++)for(const c of cards)if(lineage.has(key(c.evolveFrom)))lineage.add(key(c.name));
 const relevant=anchors.length?cards.filter(c=>lineage.has(key(c.name))):cards.filter(c=>deck.planAttackers?.includes(c.id));
 return [...new Map(relevant.filter(c=>!relevant.some(other=>key(other.evolveFrom)===key(c.name))).map(c=>[c.id,c])).values()];
}
// These checks reject known broken dependencies. They are not a rules simulator.
export function inspectDeckPlan(request,rows,deck={}) {
 const main=rows.filter(r=>r.zone!=='extra'&&r.zone!=='side'),cards=main.map(r=>r.card).filter(Boolean),issues=[],notes=[];let attackers=[];
 const names=new Set(cards.map(c=>key(c.name))),text=c=>String(c?.text||c?.oracle_text||'');
 if(rows.some(r=>!Number.isInteger(r.qty)||r.qty<=0))issues.push('A card quantity is invalid.');
 if(rows.some(r=>!r.card||r.card.brief))issues.push('Some selected cards have incomplete rules data.');
 if(request.game==='ptcg'){
  for(const c of cards.filter(c=>c.category==='Pokemon'&&c.evolveFrom))if(!names.has(key(c.evolveFrom)))issues.push(`${c.name} is missing its preceding evolution, ${c.evolveFrom}.`);
  
  attackers=pokemonPlanAttackers(request,rows,deck);
  if(!attackers.length)issues.push('No primary attacker could be established for this plan.');
  for(const c of attackers){
   const units=main.filter(r=>r.card?.category==='Energy').flatMap(r=>{const cap=pokemonEnergyCapability(r.card,c);return cap.status==='supported'?Array(Math.min(60,r.qty*cap.units)).fill(cap.types):[];});
   const supported=(c.attacks||[]).some(a=>{
    if(!Array.isArray(a.cost))return false;
    // Match each required symbol to one real Energy unit. A rainbow unit cannot
    // pay two simultaneous costs merely because it lists both types.
    const assigned=new Map(),cost=a.cost.filter(t=>t!=='Free');
    const match=(i,seen)=>{for(let j=0;j<units.length;j++){if(seen.has(j)||cost[i]!=='Colorless'&&!units[j].includes(cost[i]))continue;seen.add(j);if(!assigned.has(j)||match(assigned.get(j),seen)){assigned.set(j,i);return true;}}return false;};
    return cost.length<=units.length&&cost.every((_,i)=>match(i,new Set()));
   });
   if(!supported)issues.push(`${c.name} has no attack supported by the selected Energy types and quantities.`);
  }
  if(!cards.some(c=>c.category==='Pokemon'&&(c.basicPokemon||c.stage==='Basic')))issues.push('The deck needs a Basic Pokémon.');
 } else if(request.game==='ygo'){
  const seed=request.seedCard||cards.find(c=>key(c.name)===key(request.seed));
  if(seed?.archetype&&!cards.some(c=>c.id!==seed.id&&c.archetype===seed.archetype))issues.push(`The ${seed.archetype} build-around has no supporting archetype cards.`);
  const extra=rows.filter(r=>r.zone==='extra');
  if(!extra.length&&cards.some(c=>/fusion summon|synchro summon|xyz summon|link summon/i.test(text(c))))issues.push('The selected plan names an Extra Deck summon, but has no Extra Deck target.');
  for(const r of extra){
   const c=r.card;if(!c)continue;
   const header=text(c).split(/[\r\n]/)[0].trim(),named=[...header.matchAll(/["“]([^"”]+)["”]/g)].map(m=>m[1]);
   const unresolved=()=>issues.push(`${c.name}: the app could not verify its material requirements and summon route. Try another build-around or review the card data.`);
   if(/Fusion/i.test(c.typeLine||'')){
    // Only an exact A + B material line and a known unrestricted Fusion effect
    // are resolved here. Alternate/contact/substitution routes need an adapter.
    const exact=/^["“][^"”]+["”](?:\s*\+\s*["“][^"”]+["”])+$/.test(header);
    if(!exact){unresolved();continue;}
    const wanted=new Map();for(const n of named)wanted.set(key(n),(wanted.get(key(n))||0)+1);
    const missing=[...wanted].filter(([name,n])=>main.filter(r=>key(r.card?.name)===name).reduce((s,r)=>s+r.qty,0)<n);
    if(missing.length||!cards.some(x=>x.name==='Polymerization'&&/fusion summon/i.test(text(x)))){unresolved();continue;}
    notes.push(`${c.name}: printed named materials and Polymerization are present; access and sequencing still need playtesting.`);
   }else if(/Synchro/i.test(c.typeLine||'')){
    const match=header.match(/^1 Tuner \+ (\d+)\+? non-Tuner monsters?$/i);
    if(!match){unresolved();continue;}
    const tuners=main.filter(r=>/Tuner/i.test(r.card?.typeLine||'')&&r.card?.category==='Monster');
    const others=main.filter(r=>r.card?.category==='Monster'&&!/Tuner/i.test(r.card.typeLine||''));
    const levels=others.flatMap(r=>Array(Math.min(r.qty,8)).fill(Number(r.card.level))).filter(n=>Number.isInteger(n)&&n>0);
    const totals=new Set(['0:0']);for(const level of levels)for(const token of [...totals]){const [sum,count]=token.split(':').map(Number);if(sum+level<=Number(c.level)&&count<8)totals.add(`${sum+level}:${count+1}`);}
    const supported=tuners.some(r=>[...totals].some(token=>{const [sum,count]=token.split(':').map(Number);return sum+Number(r.card.level)===Number(c.level)&&count>=Number(match[1]);}));
    if(!supported){unresolved();continue;}
    notes.push(`${c.name}: a printed Tuner and level combination is in the list; getting those monsters onto the field still needs playtesting.`);
   }else if(/XYZ/i.test(c.typeLine||'')){
    const match=header.match(/^(\d+) Level (\d+) monsters$/i);
    if(!match||main.filter(r=>r.card?.category==='Monster'&&Number(r.card.level)===Number(match[2])).reduce((s,r)=>s+r.qty,0)<Number(match[1])){unresolved();continue;}
    notes.push(`${c.name}: its printed level/count materials are present; access and sequencing still need playtesting.`);
   }else if(/Link/i.test(c.typeLine||'')){
    const match=header.match(/^(\d+)(\+)? (Effect )?monsters$/i),rating=Number(c.link);
    const count=main.filter(r=>r.card?.category==='Monster'&&(!match?.[3]||/Effect/i.test(r.card.typeLine||''))).reduce((s,r)=>s+r.qty,0);
    if(!match||!Number.isInteger(rating)||rating<Number(match[1])||!match[2]&&rating!==Number(match[1])||count<rating){unresolved();continue;}
    notes.push(`${c.name}: Main Deck material counts support its Link Rating; field access and effects are not simulated.`);
   }else unresolved();
  }
 }else{
  for(const c of cards)if(!fitsTypeRestrictions(c,request))issues.push(`${c.name} conflicts with the explicit creature-type restriction.`);
  const lands=main.filter(r=>/\bLand\b/.test(r.card?.type_line||''));
  if(lands.reduce((s,r)=>s+r.qty,0)<Math.floor(main.reduce((s,r)=>s+r.qty,0)*.25))issues.push('The deck has too few lands for the supported construction plan.');
  const produces=new Set(lands.flatMap(r=>r.card?.produced_mana||r.card?.color_identity||[]));
  const needed=new Set(cards.filter(c=>! /\bLand\b/.test(c.type_line||'')).flatMap(c=>c.colors||[]));
  for(const color of needed)if(!produces.has(color))issues.push(`No confirmed land source for ${color} mana.`);
 }
 if(request.seedCards?.some(c=>!rows.some(r=>r.qty>0&&r.zone!=='side'&&key(r.card?.name)===key(c.name))))issues.push('A required build-around card is missing from its playable deck section.');
 if(request.seedCard&&!rows.some(r=>r.qty>0&&key(r.card?.name)===key(request.seedCard.name)))issues.push(`The required build-around ${request.seedCard.name} is missing.`);
 for(const name of request.required_cards||[])if(!names.has(key(name))&&!rows.some(r=>key(r.card?.name)===key(name)))issues.push(`Required card ${name} is missing.`);
 for(const name of request.excluded_cards||[])if(rows.some(r=>key(r.card?.name)===key(name)))issues.push(`Excluded card ${name} was selected.`);
 const analysisRows=rows.map(r=>({...r,c:r.card}));
 const engine=engineMap(request.game,analysisRows,{commanders:deck.commander?[deck.commander]:[]});
 const theme=request.game==='mtg'?inspectMtgTheme(rows,{style:request.theme||request.style,commander:deck.commander}):null;
 if(theme){issues.push(...theme.issues);notes.push(...theme.notes);}
 for(const conflict of engine.conflicts||[])notes.push(conflict.reason);
 const risks=strategicRisk(request.game,analysisRows);
 // Preference measures setup burden, not text length or a fake skill rating.
 const setup=main.reduce((sum,r)=>sum+setupBurden(request.game,r.card)*r.qty,0);
 return {attackers,issues:[...new Set(issues)],notes:[...new Set([...notes,...(deck.repairNotes||[])])],engine,theme,risks,setupBurden:setup};
}
export function chooseDeck(candidates,request) {
 const valid=candidates.filter(c=>c.check.complete&&c.check.legal&&!c.plan.issues.length&&(!request.ownedOnly||c.pricing.ownedCopies===c.pricing.copies)&&
  (request.budgetMode!=='cap'||request.budget===null||c.pricing.estimate!==null&&c.pricing.estimate<=request.budget+1e-6));
 const budgetClass=c=>request.budget===null?0:c.pricing.estimate===null?2:c.pricing.estimate<=request.budget?0:c.pricing.estimate<=request.budget+request.allowance+1e-6?1:3;
 valid.sort((a,b)=>budgetClass(a)-budgetClass(b)||(request.easy?a.plan.setupBurden-b.plan.setupBurden:0)||(budgetClass(a)===3?a.pricing.estimate-b.pricing.estimate:0)||(request.preferOwned?b.pricing.ownedCopies/b.pricing.copies-a.pricing.ownedCopies/a.pricing.copies:0)||comparePower(b.power,a.power)||a.pricing.unpriced-b.pricing.unpriced||a.pricing.subtotal-b.pricing.subtotal);
 const winner=valid[0];
 if(!winner){
  const nearest=[...candidates].sort((a,b)=>Number(b.check.complete)-Number(a.check.complete)||a.plan.issues.length-b.plan.issues.length)[0];
  const priceIssue=request.budgetMode==='cap'&&request.budget!==null&&nearest?.check.complete&&nearest?.check.legal&&!nearest?.plan.issues.length?`No complete candidate has a verified ${request.budgetBasis==='purchase'?'purchase':'whole-deck'} estimate within your $${request.budget.toFixed(2)} cap. Unknown prices and over-budget lists cannot pass this cap.`:null;
  return {ok:false,request,code:request.ownedOnly?'owned-inventory':priceIssue?'budget-cap':'construction',message:request.ownedOnly?'Your available owned cards could not form a complete, checked deck for this request.':(reason=>reason?`Couldn’t build a complete, checked deck: ${reason}`:'The loaded card pool could not produce a complete, checked deck. Try another build-around or retry card loading.')(priceIssue||nearest?.check.issues?.[0]||nearest?.plan.issues?.[0]),details:[...(priceIssue?[priceIssue]:[]),...(nearest?.check.issues||[]),...(nearest?.plan.issues||[])].slice(0,6)};
 }
 const delta=request.budget!==null&&winner.pricing.estimate!==null?cents(winner.pricing.estimate-request.budget):null;
 const budgetVerified=winner.pricing.estimate!==null&&(request.budget===null||delta<=0),themeVerified=winner.plan.theme?.status==='supported';
 const requestSatisfied=(request.budget===null||budgetVerified)&&winner.plan.theme?.status!=='unverified';
 return {ok:true,...winner,request,budgetVerified,themeVerified,requestSatisfied,validation:{complete:true,legal:true,budget:request.budget===null?'not-requested':budgetVerified?'pass':winner.pricing.estimate===null?'unverified':'fail',theme:winner.plan.theme?.status||'unverified',competitive:'unverified'},budgetStatus:budgetClass(winner)===3?'outside-target':winner.pricing.estimate===null?'unverified':delta>0?'over-target':'within-target',delta,
  compared:candidates.length,summary:`${request.seedCard?.name||winner.deck.buildAround||request.seed||'Your deck'} · ${request.formatName}`};
}
export async function constructDeck(input,adapter,options={}) {
 const request=normalizeDeckRequest(input,adapter.formats),current=options.current||(()=>true);
 const check=()=>{if(!current())throw new DOMException('This build was replaced.','AbortError');};
 check();options.onStatus?.('Finding cards for your plan…');
 const raw=await adapter.construct(request,{...options,current});check();
 if(raw.error)return {ok:false,request,code:'requirements',message:raw.error};
 const found=[],seen=new Set();
 for(const deck of raw.slice(0,DECK_POLICY.maxCandidates)){
  check();const signature=JSON.stringify([deck.commander,deck.cards||deck.zones]);if(seen.has(signature))continue;seen.add(signature);
  const assessed=await adapter.assess(deck,request);check();
  found.push({...assessed,deck,pricing:priceDeck(assessed.rows,request.budgetBasis),plan:inspectDeckPlan(request,assessed.rows,deck)});
 }
 options.onStatus?.('Checking the final list and price coverage…');
 return chooseDeck(found,request);
}
