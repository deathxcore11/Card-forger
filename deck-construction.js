import {setupBurden} from './deck-preferences.js';
// Shared request/result boundary for manual construction and conversational AI.
// Builders remain responsible for card selection; this layer never fabricates cards.
import { comparePower } from './deck-optimizer.js';
import { engineMap } from './engine-map.js';
import { strategicRisk } from './strategy-risk.js';
import {pokemonEnergyCapability} from './deckpower.js';
import { inspectMtgTheme } from './builder.js';
import { CREATURE_THEMES, fitsTypeRestrictions, readCreatureTypeRestrictions } from './planner.js';
import {readLoopIntent,inspectManaLoop} from './mtg-combo-packages.js';
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
 const budgetMode=input.budgetMode==='target'?'target':'cap',budgetBoundary=budgetMode==='cap'&&input.budgetBoundary==='exclusive'?'exclusive':'inclusive';
 // Constraints read from the theme text stay derived: Edit choices re-reads
 // them from the current theme, while explicit selections are kept as given.
 const sources=input.constraintSources||{},given=field=>Object.hasOwn(input,field)&&input[field]!==undefined&&sources[field]!=='theme',constraintSources={};
 const parsedLoop=readLoopIntent(input.theme??input.style??''),loopIntent={};
 for(const field of ['requireLoop','loopOutput','unsupportedLoop','loopConflict','clearLoop']){loopIntent[field]=given(field)?input[field]:parsedLoop[field];constraintSources[field]=given(field)?'explicit':'theme';}
 if(loopIntent.requireLoop!==null&&loopIntent.requireLoop!==undefined&&loopIntent.requireLoop!=='infinite-mana')throw Error('Choose a supported repeatable-mana requirement.');
 if(loopIntent.loopOutput&&!['W','U','B','R','G','C','any-color'].includes(loopIntent.loopOutput))throw Error('Choose a known requested mana output.');
 if(game!=='mtg'&&(loopIntent.requireLoop||loopIntent.unsupportedLoop||loopIntent.loopConflict))loopIntent.unsupportedLoop='The reviewed repeatable-mana packages apply to Magic only. This game needs its own exact-card interaction check.';
 const avoidInfinite=given('avoid_infinite')?input.avoid_infinite:(parsedLoop.hasLoopNegation&&parsedLoop.avoidInfinite===true);constraintSources.avoid_infinite=given('avoid_infinite')?'explicit':'theme';
 loopIntent.loopConflict=loopIntent.loopConflict===true||!!(loopIntent.requireLoop&&avoidInfinite);
 const parsedTypes=game==='mtg'?readCreatureTypeRestrictions(input.theme??input.style??''):{creatureTypesOnly:[],excludedSubtypes:[]},typeRestrictions={};
 for(const field of ['creatureTypesOnly','excludedSubtypes']){
  if(given(field)&&(!Array.isArray(input[field])||input[field].some(type=>!CREATURE_THEMES.includes(type))))throw Error('Choose known creature types for the type restriction.');
  typeRestrictions[field]=[...new Set(given(field)?input[field]:parsedTypes[field])];constraintSources[field]=given(field)?'explicit':'theme';
 }
 const allowance=target===null||budgetMode==='cap'?0:cents(Math.min(target*DECK_POLICY.overagePercent/100,DECK_POLICY.overageMaximum));
 return {...input,...typeRestrictions,...loopIntent,constraintSources,avoid_infinite:avoidInfinite===true,game,format:game==='mtg'?selected.name:selected.id,formatName:selected.name,
  theme:String(input.theme??input.style??'').trim(),budget:target,budgetBasis:budgetBasis==='purchase'||budgetBasis==='owned'?'purchase':'total',
  ownedOnly,budgetMode,preferOwned:input.preferOwned??input.goal!=='strongest',easy:input.easy===true||/easy to play|beginner|simple/i.test(input.style||''),
  randomSeed:Number.isFinite(input.randomSeed)?input.randomSeed:Math.floor(Math.random()*0x7fffffff),
  // An exclusive cap ("under $20") builds toward one cent below it.
  allowance,budgetBoundary,constructionBudgets:ownedOnly?[0]:target===null?[Infinity]:budgetMode==='cap'?[budgetBoundary==='exclusive'?Math.max(0,cents(target-.01)):target]:[...new Set([target,target+allowance,Infinity])]};
}
// One cap test for every entry point. Unknown prices never pass a cap.
export function withinBudgetCap(estimate,request) {
 if(request.budgetMode!=='cap'||request.budget===null)return true;
 if(estimate===null||!Number.isFinite(estimate))return false;
 return request.budgetBoundary==='exclusive'?estimate<request.budget-1e-9:estimate<=request.budget+1e-6;
}
// Stable fingerprint of the constraints a result was validated against, so a
// report can be matched to its request. Not a security hash.
export function requestFingerprint(request) {
 const fields=['game','format','theme','seed','commander','budget','budgetMode','budgetBoundary','budgetBasis','ownedOnly','creatureTypesOnly','excludedSubtypes','required_cards','excluded_cards','colors','requireLoop','loopOutput','avoid_infinite','randomSeed'];
 const text=JSON.stringify(fields.map(k=>[k,request?.[k]??null]));let h=2166136261;
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0).toString(16).padStart(8,'0');
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
 const parsedTypes=request.game==='mtg'?readCreatureTypeRestrictions(request.theme||request.style||''):{creatureTypesOnly:[],excludedSubtypes:[]};
 request={...request,creatureTypesOnly:[...new Set(request.creatureTypesOnly===undefined?parsedTypes.creatureTypesOnly:request.creatureTypesOnly)],excludedSubtypes:[...new Set(request.excludedSubtypes===undefined?parsedTypes.excludedSubtypes:request.excludedSubtypes)]};
 const main=rows.filter(r=>r.zone!=='extra'&&r.zone!=='side'),cards=main.map(r=>r.card).filter(Boolean),issues=[],notes=[];let attackers=[];
 const names=new Set(cards.map(c=>key(c.name))),text=c=>String(c?.text||c?.oracle_text||'');
 const restrictionRequested=request.game==='mtg'&&(request.creatureTypesOnly?.length||request.excludedSubtypes?.length),restrictionFailures=restrictionRequested?main.filter(r=>!fitsTypeRestrictions(r.card,request)):[];
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
  for(const row of restrictionFailures)issues.push(`${row.name||row.card?.name||'A selected card'} does not satisfy the requested creature-type restriction or its card types are unverified.`);
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
 const theme=request.game==='mtg'?inspectMtgTheme(rows,{style:request.theme||request.style,commander:deck.commander,goal:request.goal}):null;
 if(theme){issues.push(...theme.issues);notes.push(...theme.notes);}
 const combo=request.game==='mtg'?inspectManaLoop(rows,request):{status:request.unsupportedLoop?'unverified':'not-requested',issues:request.unsupportedLoop?[request.unsupportedLoop]:[],packages:[]};
 issues.push(...combo.issues);
 for(const conflict of engine.conflicts||[])notes.push(conflict.reason);
 const risks=strategicRisk(request.game,analysisRows);
 // Preference measures setup burden, not text length or a fake skill rating.
 const setup=main.reduce((sum,r)=>sum+setupBurden(request.game,r.card)*r.qty,0);
 const typeRestrictions={status:restrictionRequested?(restrictionFailures.length?'fail':'pass'):'not-requested',creatureTypesOnly:[...(request.creatureTypesOnly||[])],excludedSubtypes:[...(request.excludedSubtypes||[])],includesCommander:true,noncreatureSupportAllowed:true,conflicts:restrictionFailures.map(r=>r.name||r.card?.name||'Unresolved card')};
 return {attackers,issues:[...new Set(issues)],notes:[...new Set([...notes,...(deck.repairNotes||[])])],engine,theme,strategy:theme?.strategy||null,mechanics:theme?.mechanics||null,combo,typeRestrictions,risks,setupBurden:setup};
}
export function chooseDeck(candidates,request) {
 const valid=candidates.filter(c=>c.check.complete&&c.check.legal&&!c.plan.issues.length&&(!request.ownedOnly||c.pricing.ownedCopies===c.pricing.copies)&&
  (!request.requireLoop||c.plan.combo?.status==='verified')&&!request.unsupportedLoop&&!request.loopConflict&&
  withinBudgetCap(c.pricing.estimate,request));
 const budgetClass=c=>request.budget===null?0:c.pricing.estimate===null?2:c.pricing.estimate<=request.budget?0:c.pricing.estimate<=request.budget+request.allowance+1e-6?1:3;
 const strategyClass=c=>({supported:0,'not-requested':0,partial:1,unverified:2,insufficient:3}[c.plan.theme?.status]??0);
 valid.sort((a,b)=>budgetClass(a)-budgetClass(b)||strategyClass(a)-strategyClass(b)||(request.easy?a.plan.setupBurden-b.plan.setupBurden:0)||(budgetClass(a)===3?a.pricing.estimate-b.pricing.estimate:0)||(request.preferOwned?b.pricing.ownedCopies/b.pricing.copies-a.pricing.ownedCopies/a.pricing.copies:0)||comparePower(b.power,a.power)||a.pricing.unpriced-b.pricing.unpriced||a.pricing.subtotal-b.pricing.subtotal);
 const winner=valid[0];
 if(!winner){
  const nearest=[...candidates].sort((a,b)=>Number(b.check.complete)-Number(a.check.complete)||a.plan.issues.length-b.plan.issues.length)[0];
  const loopPieces=new Set((nearest?.deck.internalRequiredCards||[]).map(key)),unknownLoopPrice=request.requireLoop&&request.budgetMode==='cap'&&request.budget!==null&&nearest?.rows?.some(r=>loopPieces.has(key(r.name))&&!(request.budgetBasis==='purchase'&&r.owned>=r.qty)&&!(typeof r.price==='number'&&Number.isFinite(r.price)&&r.price>=0));
  const priceIssue=unknownLoopPrice?'The required repeatable-mana package has unverified prices. It cannot pass your spending cap; unknown quotes were not treated as free cards.':request.budgetMode==='cap'&&request.budget!==null&&nearest?.check.complete&&nearest?.check.legal&&!nearest?.plan.issues.length?`No complete candidate has a verified ${request.budgetBasis==='purchase'?'purchase':'whole-deck'} estimate ${request.budgetBoundary==='exclusive'?'under':'within'} your $${request.budget.toFixed(2)} cap. Unknown prices and over-budget lists cannot pass this cap.`:null;
  return {ok:false,request,code:request.ownedOnly?'owned-inventory':priceIssue?'budget-cap':'construction',message:request.ownedOnly?'Your available owned cards could not form a complete, checked deck for this request.':(reason=>reason?`Couldn’t build a complete, checked deck: ${reason}`:'The loaded card pool could not produce a complete, checked deck. Try another build-around or retry card loading.')(priceIssue||nearest?.check.issues?.[0]||nearest?.plan.issues?.[0]),details:[...(priceIssue?[priceIssue]:[]),...(nearest?.check.issues||[]),...(nearest?.plan.issues||[])].slice(0,6)};
 }
 const delta=request.budget!==null&&winner.pricing.estimate!==null?cents(winner.pricing.estimate-request.budget):null;
 const budgetVerified=winner.pricing.estimate!==null&&(request.budget===null||(request.budgetBoundary==='exclusive'?delta<0:delta<=0)),themeVerified=winner.plan.theme?.status==='supported';
 const themeOK=!winner.plan.theme||['supported','not-requested'].includes(winner.plan.theme.status),requestSatisfied=(request.budget===null||budgetVerified)&&themeOK&&(!request.requireLoop||winner.plan.combo?.status==='verified')&&!request.unsupportedLoop&&!request.loopConflict;
 return {ok:true,...winner,request,budgetVerified,themeVerified,requestSatisfied,validation:{complete:true,legal:true,budget:request.budget===null?'not-requested':budgetVerified?'pass':winner.pricing.estimate===null?'unverified':'fail',theme:winner.plan.theme?.status||'unverified',combo:winner.plan.combo?.status||'not-requested',creatureTypes:winner.plan.typeRestrictions?.status||'not-requested',prerequisites:winner.plan.theme?.prerequisites?.status||'not-applicable',competitive:'unverified',request:requestFingerprint(request)},budgetStatus:budgetClass(winner)===3?'outside-target':winner.pricing.estimate===null?'unverified':delta>0?'over-target':'within-target',delta,
  compared:candidates.length,summary:`${request.seedCard?.name||winner.deck.buildAround||request.seed||'Your deck'} · ${request.formatName}`};
}
export async function constructDeck(input,adapter,options={}) {
 const request=normalizeDeckRequest(input,adapter.formats),current=options.current||(()=>true);
 if(request.game!=='mtg'&&(request.requireLoop||request.unsupportedLoop||request.loopConflict))return {ok:false,request,code:'requirements',message:request.unsupportedLoop||'This game needs its own exact-card interaction check.'};
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
