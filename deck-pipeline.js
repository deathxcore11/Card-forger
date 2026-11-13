import {resolveReferenceCandidates,referenceAdaptation} from './mtg-reference-construction.js';
import {metaState,metaNeedsRefresh,loadMeta} from './meta.js';
// One construction boundary for the manual UI and Ask. All assessments use the
// exact selected list; no account mutation or UI handoff happens during a build.
import { constructDeck, inspectDeckPlan, priceDeck, chooseDeck, withinBudgetCap } from './deck-construction.js';
import { prepareMtgDeck } from './ai-deck-builder.js';
import { FORMATS, formatOf } from './formats.js';
import { cardKey, validateDeck } from './core.js';
import { refineCandidates, towardDeck } from './deck-optimizer.js';
import { mtgPower } from './power.js';
import { shapeFaults } from './deck-needs.js';
import { bracketEstimate } from './extras.js';
import { META_PRIOR_FORMATS } from './deck-meta-prior.js';

// A refinement pass treats candidate objects as immutable: towardDeck clones
// each change and refineCandidates adds scored copies. Keep this cache inside
// that pass; a later build must read its own card, price and ownership evidence.
export function createBuildAssessmentCache(inspect,score,{revision=()=>null}={}){
 const entries=new WeakMap();
 const entry=deck=>{const version=revision(deck);let found=entries.get(deck);if(!found||found.revision!==version){found={assessment:inspect(deck),scored:false,revision:version};entries.set(deck,found);}return found;};
 return {inspect:deck=>entry(deck).assessment,power:deck=>{const found=entry(deck);if(!found.scored){found.power=score(deck);found.scored=true;}return found.power;}};
}

// Bound this build's wait without aborting a shared cache fetch used elsewhere.
// A late completion may populate that shared cache, but cannot change this result.
export async function waitForReferenceRefresh(refresh,{current=()=>true,timeoutMs=12000}={}){
 const limit=Math.max(1,Math.min(12000,Number.isFinite(timeoutMs)?timeoutMs:12000)),check=()=>{if(current()===false)throw new DOMException('Build replaced','AbortError');};
 check();let timer;
 const work=Promise.resolve().then(()=>{check();return refresh();}).then(()=>({status:'ready'}),error=>({status:'failed',error}));
 try{const result=await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'timeout',timeoutMs:limit}),limit);})]);check();if(result.error?.name==='AbortError')throw result.error;return result;}
 finally{clearTimeout(timer);}
}

// Cards whose own text answers a colour: protection or hexproof from it, text that targets its spells or permanents, and for blue,
// spells that can't be countered. Only what the card text proves; nothing here knows how a matchup really plays.
const COLOR_WORD={W:'white',U:'blue',B:'black',R:'red',G:'green'};
export const againstQuery=(color,{legality='',identity='',cheap=false}={})=>{
 const n=COLOR_WORD[color];if(!n)return '';
 return `(o:"protection from ${n}" or o:"hexproof from ${n}" or o:"target ${n}"${color==='U'?` or o:"can't be countered"`:''}) -t:land ${legality?'f:'+legality:'game:paper'}${identity?' id<='+identity:''}${cheap?' usd<5':''}`;
};
export async function againstCandidates(request,x){
 const f=formatOf(request.format),lead=request.seed?x.meta?.(request.seed)||await x.resolve(request.seed,true).catch(()=>null):null;
 const identity=(request.colors?.length?request.colors:f.commander&&lead?lead.color_identity||[]:[]).join('').toLowerCase()||(f.commander&&lead?'c':'');
 const colors=[...new Set(request.against)].filter(c=>COLOR_WORD[c]).slice(0,3),out=[],first=[];
 for(const c of colors){
  const r=await x.api('/cards/search?'+new URLSearchParams({q:againstQuery(c,{legality:f.legality,identity,cheap:Number(request.budget)>0}),order:'edhrec',unique:'cards'})).catch(()=>null);
  const found=(r?.data||[]).filter(card=>card.name!==lead?.name).slice(0,Math.ceil(6/colors.length));
  for(const card of found){x.cacheCard?.(card);out.push(card.name);}
  if(found[0])first.push(found[0].name);
 }
 // The most played answer for each colour goes into the deck; the rest are offered and kept only if they fit.
 const must=[...new Set(first)].slice(0,3);
 return {must,offered:[...new Set(out)].filter(n=>!must.includes(n)).slice(0,6)};
}
export function createDeckPipeline(x) {
 const {T,S}=x;
 const formats={mtg:FORMATS.filter(f=>!['limited','oathbreaker'].includes(f.id)),ygo:T.SOURCES.ygo.formats,ptcg:T.SOURCES.ptcg.formats};
 const resolveSeed=async request=>{
  if(request.game==='mtg')return request.seedCard|| (request.seed?await x.resolve(request.seed,true):null);
  const src=T.SOURCES[request.game],f=formats[request.game].find(f=>f.id===request.format)||formats[request.game][0];
  const compatible=c=>c&&!c.brief&&(request.game!=='ptcg'||c.category==='Pokemon')&&(!src.legality||src.legality(c,f)==='legal')&&(!src.limit||src.limit(c,f)>0);
  let card=request.seedCard;
  // A typed name can match many printings: use one that is legal in the chosen format (the first match is often an
  // older, rotated printing), and only fall back to the plain lookup when no printing in the format matches.
  if(!card&&request.seed){
   const found=await src.search({q:request.seed,exactName:true,format:f.id,size:24}).catch(()=>({cards:[]}));
   for(const c of (found.cards||[]).filter(c=>cardKey(c.name)===cardKey(request.seed))){const full=await Promise.resolve().then(()=>src.get(c.id)).catch(()=>null);if(compatible(full)){card=full;break;}}
   if(!card)card=await src.byName?.(request.seed);
  }
  if(!card&&!request.seed){
   const pool=request.game==='ygo'?request.theme?(await src.search({archetype:request.theme,size:100})).cards:(await src.randomArchetype()).cards:(await src.search({category:'Pokemon',type:request.theme||'',format:f.id,size:100})).cards;
   const choices=(pool||[]).filter(c=>request.game!=='ygo'||c.category==='Monster'&&!c.extra);
   const start=Math.abs(request.randomSeed||0)%Math.max(1,choices.length);
   for(let i=0;i<Math.min(12,choices.length);i++){const candidate=choices[(start+i)%choices.length];const full=await Promise.resolve().then(()=>src.get(candidate.id)).catch(()=>null);if(compatible(full)){card=full;break;}}
  }
  if(card?.brief)card=await src.get(card.id);
  // Name the actual problem: no such card, a non-Pokémon seed, or a card not legal in the format.
  if(!card&&request.seed)throw Error(`No card named “${request.seed}” was found. Check the spelling, or pick the card from search.`);
  if(card&&request.game==='ptcg'&&card.category!=='Pokemon')throw Error(`${card.name} is a ${String(card.category||'non-Pokémon').toLowerCase()} card. Choose a Pokémon to build around.`);
  if(card&&!compatible(card))throw Error(`${card.name} is not legal in ${f.name}. Choose another format or card.`);
  if(!compatible(card))throw Error(`Could not verify the build-around in ${f.name}. Check the card and format, or retry card loading.`);
  if(request.theme&&request.game==='ptcg'&&!card.types?.includes(request.theme))throw Error(`${card.name} does not match the ${request.theme} type preference. Change the card or theme.`);
  if(request.theme&&request.game==='ygo'&&card.archetype!==request.theme)throw Error(`${card.name} is not in the selected ${request.theme} archetype. Change the card or theme.`);
  return card;
 };
 const referenceContext=(deck,request)=>deck.referenceOrigin?{...deck,referenceAdaptation:referenceAdaptation(deck.referenceOrigin,deck,request),adaptation:referenceAdaptation(deck.referenceOrigin,deck,request)}:deck;
 const assess=(deck,request,{withPower=true}={})=>{
  if(request.game==='mtg'){
   const f=formatOf(deck),validation=validateDeck(deck,S.catalog,[],[]),issues=[...validation.issues,...(deck.unverifiedConstraints||[]).map(text=>({text:"Unverified requirement: "+text}))];
   if((deck.side||[]).reduce((n,r)=>n+Number(r.qty||0),0)>f.sideboard)issues.push({text:`Sideboard exceeds the ${f.sideboard}-card limit for ${f.name}.`});
   const rows=[['main',deck.cards||[]],['side',deck.side||[]]].flatMap(([zone,list])=>list.map(r=>{
    const key=cardKey(r.name),card=x.meta(r.name),selection=deck.referencePriceSelections?.[key],field=selection?.finish==='foil'?'usd_foil':selection?.finish==='nonfoil'?'usd':null,currentQuote=field?card?.prices?.[field]:null,time=typeof selection?.retrievedAt==='string'?Date.parse(selection.retrievedAt):NaN;
    const knownQuote=['number','string'].includes(typeof currentQuote)&&String(currentQuote).trim()!==''&&Number.isFinite(Number(currentQuote))&&Number(currentQuote)>=0;
    const validSelection=!S.state?.priceChoices?.[key]&&!!selection&&typeof selection.printingId==='string'&&!!selection.printingId&&typeof selection.oracleId==='string'&&!!selection.oracleId&&selection.provider==='Scryfall'&&Number.isFinite(time)&&time<=Date.now()&&new Date(time).toISOString()===selection.retrievedAt&&field&&selection.quoteField===field&&selection.printingId===card?.id&&selection.oracleId===card?.oracle_id&&Array.isArray(card?.finishes)&&card.finishes.includes(selection.finish)&&(selection.finish!=='foil'||card.finishes.length===1)&&typeof selection.price==='number'&&Number.isFinite(selection.price)&&selection.price>=0&&knownQuote&&Number(currentQuote)===selection.price;
    return {name:r.name,id:key,qty:r.qty,zone,card,price:selection?(validSelection?selection.price:null):deck.referencePrices?.[key]??x.priceOf(r.name),owned:x.inv(r.name)?.available??0,...(selection?{referencePriceSelection:{...selection,verified:validSelection}}:{})};
   }));
   return {rows,...(withPower?{power:mtgPower({...deck,id:'construction'})}:{}),check:{complete:rows.filter(r=>r.zone==='main').reduce((n,r)=>n+r.qty,0)===f.size,legal:issues.length===0,issues:[...new Set(issues.map(i=>i.text))]}};
  }
  const a=T.flowAssessment(request.game,deck),d=a.diagnostics;
  return {...a,check:{complete:d.complete&&!d.missingEnergy&&!d.missingRequiredSeeds.length,legal:d.legalChecked,
   issues:[...a.issues.filter(i=>['bad','pending'].includes(i.level)).map(i=>i.text),...d.missingRequiredSeeds.map(s=>`The required build-around ${s.name} is missing.`),...(d.missingEnergy?[`${d.missingEnergy} required Energy copies are missing.`]:[])]}};
 };
 const adapter={formats,assess,async construct(request,options){
  const seed=await resolveSeed(request);if(options.current?.()===false)throw new DOMException('Build replaced','AbortError');
  request.seedCard=seed;request.seed=seed?.name||request.seed||'';
  if(request.game==='mtg'){
   let references={decks:[],notes:[],rejections:[]};
   if(request.format==='Standard'){
    options.onStatus?.('Checking current Standard reference lists and their full-list constraints…');
    const key='mtg:Standard',state=()=>x.referenceMetaState?.()||metaState(key);let refreshStatus=null;
    if(options.current?.()===false)throw new DOMException('Build replaced','AbortError');
    if(x.referenceMetaState?(!state().data||Date.now()-state().at>=12*3600000):metaNeedsRefresh(key)){
     refreshStatus=await waitForReferenceRefresh(()=>x.loadReferenceMeta?x.loadReferenceMeta():loadMeta(key),{current:options.current,timeoutMs:x.referenceRefreshTimeoutMs});
    }
    if(options.current?.()===false)throw new DOMException('Build replaced','AbortError');
    const refreshNote=refreshStatus?.status==='timeout'?'Current reference refresh timed out; this build continues with bounded heuristic search. A late cache response cannot relabel this build.':refreshStatus?.status==='failed'?'Current reference refresh failed; this build continues with bounded heuristic search.':'';
    const snapshot=refreshNote?{...state(),error:refreshNote}:state();
    references=await resolveReferenceCandidates(snapshot.data,request,{now:x.now?.()??Date.now(),cacheState:snapshot,current:options.current,resolve:async name=>{const card=await x.resolve(name,true);if(options.current?.()===false)throw new DOMException('Build replaced','AbortError');if(card)x.cacheCard?.(card);return card;},quote:name=>x.priceOf(name),owned:name=>x.inv(name)?.available??0,priceDeck,withinBudgetCap,inspectPlan:inspectDeckPlan,maxCandidates:2});
    if(refreshNote)references.notes=[refreshNote,...references.notes];
   }
   // Tournament lists as a card-quality prior for every 60-card format with a feed (deck-meta-prior.js).
   // The lists load while the card searches run, and the build waits for them only up to a limit counted
   // from now (a cold list service can take 15 s): a build never hangs on it, it just builds without the prior.
   let metaLists=null;
   if(META_PRIOR_FORMATS.includes(request.format)){
    const key='mtg:'+request.format,standardState=request.format==='Standard'&&x.referenceMetaState,state=()=>standardState?x.referenceMetaState():metaState(key);
    const loading=state()?.data?.decks?.length||standardState?null:Promise.resolve().then(()=>request.format==='Standard'&&x.loadReferenceMeta?x.loadReferenceMeta():loadMeta(key)).catch(()=>{});
    const limit=new Promise(r=>setTimeout(r,x.metaPriorTimeoutMs??20000));
    metaLists=async()=>{if(loading){options.onStatus?.(`Reading current ${request.format} tournament lists…`);await Promise.race([loading,limit]);}return state()?.data?.decks||null;};
   }
   // The deck brief (answer-run.js buildRequest): a power target becomes Deck Forge's own power dial, and cards that answer
   // the other players' colours are offered to the builder as candidates. It keeps only those that are legal and fit the deck.
   const brief={...(request.power&&!request.forge?{forge:{power:request.power}}:{})};
   let answers=[];
   if(request.against?.length){
    options.onStatus?.('Looking for cards that answer the other decks…');
    const found=await againstCandidates(request,x).catch(()=>null),typed=(request.creatureTypesOnly||[]).length>0;
    if(found){
     // A creature-type rule of the request wins over an answer card, so nothing is forced then.
     const must=typed?[]:found.must,offered=typed?[...found.must,...found.offered]:found.offered;
     answers=[...must,...offered];
     if(must.length)brief.required_cards=[...new Set([...(request.required_cards||[]),...must])].slice(0,8);
     if(offered.length)brief.candidate_cards=[...new Set([...(request.candidate_cards||[]),...offered])].slice(0,6);
    }
   }
   const built=await prepareMtgDeck({...request,...brief,metaLists,flow:true,style:[request.theme,request.easy?'easy to play':'',request.style].filter(Boolean).join(' '),budget_basis:request.ownedOnly?'owned':request.budgetBasis,current:options.current},x);
   if(!built.candidates&&!references.decks.length)return {error:built.choice==='infinite'?'The app cannot verify that every possible infinite combo is excluded. No deck was presented. Name specific cards to exclude, or revise that requirement.':built.note||'The card service could not complete this request.'};
   // What the brief asked for against what the finished list is: the bracket it reads as, and which offered answers it kept.
   const briefNotes=d=>{const out=[];
    if(request.bracket&&request.format==='Commander'){try{const b=bracketEstimate(d,S.catalog);if(Number.isInteger(b?.bracket))out.push(b.bracket===request.bracket?`Asked for bracket ${request.bracket}. This list reads as bracket ${b.bracket}.`:`Asked for bracket ${request.bracket}. This list reads as bracket ${b.bracket}${b.reasons?.length?' ('+b.reasons.join(', ')+')':''}.`);}catch{}}
    if(answers.length){const have=new Set((d.cards||[]).map(c=>String(c.name).toLowerCase())),kept=answers.filter(n=>have.has(n.toLowerCase()));out.push(kept.length?'Answers for the other decks kept in this list: '+kept.join(', ')+'.':'None of the cards that answer the other decks fit this list.');}
    return out;};
   const candidates=[...references.decks.map(deck=>({...deck,referenceQualifiedForBuild:true,constructionNotes:[...references.notes,...(references.assessments?.find(a=>a.deck?.referenceOrigin.key===deck.referenceOrigin.key)?.notes||[]),'Based on a resolved source list; source results are not results for this generated or adapted deck.']})),...(built.candidates||[]).map(c=>({...c.draft,constructionBasis:'heuristic',referenceSearch:{notes:references.notes,rejections:references.rejections},constructionNotes:request.format!=='Standard'?briefNotes(c.draft):[...briefNotes(c.draft),...references.notes,'Heuristic construction, not a verified tournament-list result. '+(references.decks.length?'A bounded eligible reference lane was also compared.':'No eligible current reference candidate passed the available source, request, quote and list checks.')]}))];if(request.previousDeck){const prior=structuredClone(request.previousDeck);candidates.unshift({...prior,referenceQualifiedForBuild:false,constructionNotes:[...references.notes,...(prior.referenceOrigin?['Preserved previous source-based list; its source was not requalified for this build. Historical source results do not establish current freshness or this deck’s performance.']:(prior.constructionNotes||[]))]});}
   const assessment=createBuildAssessmentCache(d=>assess(d,request,{withPower:false}),d=>mtgPower({...d,id:'construction'}),{
    // Refinement yields to the screen. A provider refresh may replace or amend
    // card records during that yield, so object identity alone is insufficient.
    revision:d=>JSON.stringify([d.commander,d.commanders,d.referencePriceSelections,...[['main',d.cards||[]],['side',d.side||[]]].flatMap(([zone,list])=>list.map(r=>[zone,r.name,r.qty,x.meta(r.name),x.inv(r.name)?.available??0,d.referencePrices?.[cardKey(r.name)]??x.priceOf(r.name)]))]),
   });
   // An upgrade swap may not add a shape fault (deck-needs.js): an unsupported card, an idle fixer, a third legend copy, a stray one-of.
   const parentFaults=new WeakMap(),kept=new Set([request.seed,request.commander,...(request.required_cards||[])].filter(Boolean).map(n=>cardKey(n))),
    faults=d=>shapeFaults((d.cards||[]).map(r=>({card:x.meta(r.name),qty:r.qty})),{size:(d.cards||[]).reduce((n,r)=>n+r.qty,0),colors:d.colors||[],keep:c=>kept.has(cardKey(c.name))});
   const refined=await refineCandidates(candidates,{evaluate:d=>assessment.power(d),cost:d=>{const p=priceDeck(assessment.inspect(d).rows,request.budgetBasis);return {cost:p.subtotal,unknown:p.unpriced};},accept:d=>{const a=assessment.inspect(d);return a.check.legal&&!inspectDeckPlan(request,a.rows,d,{includeFinalSupport:false}).issues.length&&faults(d)<=(parentFaults.get(d)??Infinity);},neighbors:d=>{const base=faults(d);return candidates.flatMap(target=>towardDeck(d,target,{protectedKeys:new Set([request.seed,request.commander,...(request.required_cards||[]),...(d.internalRequiredCards||[])].filter(Boolean))})).map(n=>{parentFaults.set(n,base);return n;});},rounds:2,maxNeighbors:12,status:options.onStatus,current:options.current});
   return refined.map(deck=>referenceContext(deck,request));
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
  const rows=game==='mtg'?(zone==='side'?d.side:d.cards):d.zones?.[zone];if(!rows)throw Error('Deck section unavailable.');
  const row=rows.find(r=>game==='mtg'?cardKey(r.name)===cardKey(out.row?.name||out.name):r.cardId===(out.row?.cardId||out.id));
  if(!row||row.qty<1)throw Error('The suggested cut is not in this deck.');row.qty--;
  const same=rows.find(r=>game==='mtg'?cardKey(r.name)===cardKey(card.name):r.cardId===card.id);
  if(same)same.qty++;else rows.push(game==='mtg'?{name:card.name,qty:1}:{name:card.name,cardId:card.id,qty:1});
  if(game==='mtg')d[zone==='side'?'side':'cards']=rows.filter(r=>r.qty>0);else d.zones[zone]=rows.filter(r=>r.qty>0);
  if(d.referenceOrigin)Object.assign(d,referenceContext(d,result.request));
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
  return a.check.complete&&a.check.legal&&!plan.issues.length&&(!result.request.ownedOnly||pricing.ownedCopies===pricing.copies)&&withinBudgetCap(pricing.estimate,result.request);
 }};
}
