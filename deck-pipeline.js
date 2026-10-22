// One construction boundary for the manual UI and Ask. All assessments use the
// exact selected list; no account mutation or UI handoff happens during a build.
import { constructDeck, inspectDeckPlan, priceDeck, chooseDeck } from './deck-construction.js';
import { prepareMtgDeck } from './ai-deck-builder.js';
import { FORMATS, formatOf } from './formats.js';
import { cardKey, validateDeck } from './core.js';
import { refineCandidates, towardDeck } from './deck-optimizer.js';
import { mtgPower } from './power.js';

export function createDeckPipeline(x) {
 const {T,S}=x;
 const formats={mtg:FORMATS.filter(f=>!['limited','oathbreaker'].includes(f.id)),ygo:T.SOURCES.ygo.formats,ptcg:T.SOURCES.ptcg.formats};
 const resolveSeed=async request=>{
  if(request.game==='mtg')return request.seedCard|| (request.seed?await x.resolve(request.seed,true):null);
  const src=T.SOURCES[request.game],f=formats[request.game].find(f=>f.id===request.format)||formats[request.game][0];
  const compatible=c=>c&&!c.brief&&(request.game!=='ptcg'||c.category==='Pokemon')&&(!src.legality||src.legality(c,f)==='legal')&&(!src.limit||src.limit(c,f)>0);
  let card=request.seedCard;
  if(!card&&request.seed){card=await src.byName?.(request.seed);if(!card){const found=await src.search({q:request.seed,exactName:true,format:f.id,size:12});card=found.cards?.find(c=>cardKey(c.name)===cardKey(request.seed));}}
  if(!card&&!request.seed){
   const pool=request.game==='ygo'?request.theme?(await src.search({archetype:request.theme,size:100})).cards:(await src.randomArchetype()).cards:(await src.search({category:'Pokemon',type:request.theme||'',format:f.id,size:100})).cards;
   const choices=(pool||[]).filter(c=>request.game!=='ygo'||c.category==='Monster'&&!c.extra);
   const start=Math.abs(request.randomSeed||0)%Math.max(1,choices.length);
   for(let i=0;i<Math.min(12,choices.length);i++){const candidate=choices[(start+i)%choices.length];const full=candidate.brief?await src.get(candidate.id):candidate;if(compatible(full)){card=full;break;}}
  }
  if(card?.brief)card=await src.get(card.id);
  if(!compatible(card))throw Error(`Could not verify the build-around in ${f.name}. Check the card and format, or retry card loading.`);
  if(request.theme&&request.game==='ptcg'&&!card.types?.includes(request.theme))throw Error(`${card.name} does not match the ${request.theme} type preference. Change the card or theme.`);
  if(request.theme&&request.game==='ygo'&&card.archetype!==request.theme)throw Error(`${card.name} is not in the selected ${request.theme} archetype. Change the card or theme.`);
  return card;
 };
 const assess=(deck,request)=>{
  if(request.game==='mtg'){
   const f=formatOf(deck),validation=validateDeck(deck,S.catalog,[],[]),issues=[...validation.issues,...(deck.unverifiedConstraints||[]).map(text=>({text:"Unverified requirement: "+text}))];
   const rows=deck.cards.map(r=>({name:r.name,id:cardKey(r.name),qty:r.qty,zone:'main',card:x.meta(r.name),price:deck.referencePrices?.[cardKey(r.name)]??x.priceOf(r.name),owned:x.inv(r.name)?.available??0}));
   return {rows,power:mtgPower({...deck,id:'construction'}),check:{complete:rows.reduce((n,r)=>n+r.qty,0)===f.size,legal:issues.length===0,issues:[...new Set(issues.map(i=>i.text))]}};
  }
  const a=T.flowAssessment(request.game,deck),d=a.diagnostics;
  return {...a,check:{complete:d.complete&&!d.missingEnergy&&!d.missingRequiredSeeds.length,legal:d.legalChecked,
   issues:[...a.issues.filter(i=>['bad','pending'].includes(i.level)).map(i=>i.text),...d.missingRequiredSeeds.map(s=>`The required build-around ${s.name} is missing.`),...(d.missingEnergy?[`${d.missingEnergy} required Energy copies are missing.`]:[])]}};
 };
 const adapter={formats,assess,async construct(request,options){
  const seed=await resolveSeed(request);if(options.current?.()===false)throw new DOMException('Build replaced','AbortError');
  request.seedCard=seed;request.seed=seed?.name||request.seed||'';
  if(request.game==='mtg'){
   const built=await prepareMtgDeck({...request,flow:true,style:[request.theme,request.easy?'easy to play':'',request.style].filter(Boolean).join(' '),budget_basis:request.ownedOnly?'owned':request.budgetBasis,current:options.current},x);
   if(!built.candidates)return {error:built.note||'The card service could not complete this request.'};
   const candidates=built.candidates.map(c=>c.draft);if(request.previousDeck)candidates.unshift(structuredClone(request.previousDeck));
   return refineCandidates(candidates,{evaluate:d=>assess(d,request).power,cost:d=>{const p=priceDeck(assess(d,request).rows,request.budgetBasis);return {cost:p.subtotal,unknown:p.unpriced};},accept:d=>assess(d,request).check.legal,neighbors:d=>candidates.flatMap(target=>towardDeck(d,target,{protectedKeys:new Set([request.seed,request.commander,...(request.required_cards||[])].filter(Boolean))})),rounds:2,maxNeighbors:12,status:options.onStatus});
  }
  const candidates=await x.tcgCtx.prepareDeck(request,options);if(request.previousDeck)candidates.unshift(structuredClone(request.previousDeck));
  if(request.game!=='ygo')return candidates;
  // Bounded repair: omit unsupported optional Extra Deck cards. Never remove a
  // requested anchor, and recheck the entire plan (including an empty Extra Deck).
  return candidates.flatMap(deck=>{
   const assessed=assess(deck,request),plan=inspectDeckPlan(request,assessed.rows,deck);
   const required=new Set([request.seedCard?.name,...(request.seedCards||[]).map(c=>c.name),...(request.required_cards||[])]);
   const remove=assessed.rows.filter(r=>r.zone==='extra'&&!required.has(r.name)&&plan.issues.some(i=>i.startsWith(r.name+':')));
   if(!remove.length)return [deck];
   const ids=new Set(remove.map(r=>r.id));
   const repaired={...deck,zones:{...deck.zones,extra:deck.zones.extra.filter(r=>!ids.has(r.cardId))},repairNotes:[...(deck.repairNotes||[]),'Left out optional Extra Deck cards whose summon routes could not be checked: '+remove.map(r=>r.name).join(', ')+'.']};
   return [repaired,deck];
  });
 }};
 const trialSwap=(result,out,card)=>{
  if(!result?.ok||!card?.name||card.brief)throw Error('That replacement has not been resolved.');
  const d=structuredClone(result.deck),game=result.request.game,zone=out.zone==='commander'?'main':out.zone;
  const rows=game==='mtg'?d.cards:d.zones?.[zone];if(!rows)throw Error('Deck section unavailable.');
  const row=rows.find(r=>game==='mtg'?cardKey(r.name)===cardKey(out.row?.name||out.name):r.cardId===(out.row?.cardId||out.id));
  if(!row||row.qty<1)throw Error('The suggested cut is not in this deck.');row.qty--;
  const same=rows.find(r=>game==='mtg'?cardKey(r.name)===cardKey(card.name):r.cardId===card.id);
  if(same)same.qty++;else rows.push(game==='mtg'?{name:card.name,qty:1}:{name:card.name,cardId:card.id,qty:1});
  if(game==='mtg')d.cards=rows.filter(r=>r.qty>0);else d.zones[zone]=rows.filter(r=>r.qty>0);
  const a=assess(d,result.request),plan=inspectDeckPlan(result.request,a.rows,d);
  return {...a,deck:d,plan,pricing:priceDeck(a.rows,result.request.budgetBasis)};
 };
 const improve=(result,proposals)=>{
  const original=assess(result.deck,result.request),plan=inspectDeckPlan(result.request,original.rows,result.deck);
  const candidates=[{...original,deck:result.deck,plan,pricing:priceDeck(original.rows,result.request.budgetBasis)}];for(const proposal of proposals.slice(0,5))try{candidates.push(trialSwap(result,proposal.out,proposal.card));}catch{}
  return chooseDeck(candidates,result.request);
 };
 return {formats,resolveSeed,assess,trialSwap,improve,themes:game=>game==='ygo'?T.SOURCES.ygo.archetypeNames():Promise.resolve([]),build:(input,options)=>constructDeck(input,adapter,options),recheck(result){
  if(!result?.ok)return false;const a=assess(result.deck,result.request),plan=inspectDeckPlan(result.request,a.rows,result.deck);
  const pricing=priceDeck(a.rows,result.request.budgetBasis);
  return a.check.complete&&a.check.legal&&!plan.issues.length&&(!result.request.ownedOnly||pricing.ownedCopies===pricing.copies);
 }};
}
