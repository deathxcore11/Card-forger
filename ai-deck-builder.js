import {opponentDiscoveryQueries} from './deck-matchup-plan.js';
// One bounded app-data operation, not one AI call per card. Recommendations stay
// unsaved until the player reviews the exact list and uses the normal save action.
import { buildDeck, themeQuery, themeQueries, fitsColors, requestedIntent, inspectMtgTheme, scoreCard } from './builder.js';
import { cardKey, cardPrice, sumQty, validateDeck } from './core.js';
import { formatOf, canLead, legalityIn, verifyLeader } from './formats.js';
import { normalizeDeckGoal, goalDescription } from './ai-deck-goal.js';
import { commanderTheme, tribeEvidence, tribalSupport, themeSupport, fitsTypeRestrictions, readCreatureTypeRestrictions, CREATURE_THEMES } from './planner.js';
import { mtgAbilityEvidence } from './mtg-effects.js';
import { functionalIn } from './deck-safety.js';
import { findCheapestPrinting, eligiblePrinting } from './mtg-cheap.js';
import {readLoopIntent,manaLoopCandidates,inspectManaLoop} from './mtg-combo-packages.js';
import {tribalDiscoveryQueries} from './deck-strategy-plan.js';
import {requestedMechanics,mechanicDiscoveryQueries,mechanicCardMatches} from './deck-mechanic-plan.js';
import {commanderLandRequirements} from './mtg-land-requirements.js';
const BASIC = { W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest', C:'Wastes' };
const money = n => Math.round(n * 100) / 100;
const quote = c => { const p = cardPrice(c); return Number.isFinite(p) && p >= 0 ? p : null; };
const clean = s => String(s || '').replace(/["\\\u0000-\u001f]/g,'').trim().slice(0,120);
 const isLegal = (c,f) => !!c && (!f.legality || ['legal','restricted'].includes(legalityIn(c,f)));
const available = (x,name) => Math.max(0, Number(x.inv?.(name)?.available ?? x.inv?.(name)?.owned) || 0);
async function batches(rows,fn,width=3) { const out=[]; for(let i=0;i<rows.length;i+=width)out.push(...await Promise.all(rows.slice(i,i+width).map(fn))); return out; }
export function deckPriceCoverage(cards,catalog,owned=()=>0,price=quote) {
 let total=0,purchase=0,unknown=0,purchaseUnknown=0,ownedCopies=0;
 for(const row of cards){const p=price(catalog[cardKey(row.name)]),have=Math.min(row.qty,Math.max(0,owned(row.name)||0)),need=row.qty-have;ownedCopies+=have;if(p===null){unknown+=row.qty;purchaseUnknown+=need;}else{total+=p*row.qty;purchase+=p*need;}}
 return {totalEstimate:unknown?null:money(total),pricedSubtotal:money(total),unpricedCopies:unknown,purchaseEstimate:purchaseUnknown?null:money(purchase),pricedPurchaseSubtotal:money(purchase),unpricedPurchaseCopies:purchaseUnknown,ownedCopies,priceBasis:'Available app USD reference quotes, including basic lands and selected printings; lower-price checks cover bounded Scryfall results, not the whole market. Excludes tax and shipping; not a checkout quote.'};
}
export async function prepareMtgDeck(args,x) {
 const referencePriceSelections={},referenceCards={};
 const quote = c => {
  const selected=referencePriceSelections[cardKey(c?.name)],choice = x.S?.state?.priceChoices?.[cardKey(c?.name)], value = choice ? choice.price : selected&&selected.printingId===c?.id&&selected.oracleId===c?.oracle_id&&c?.finishes?.includes(selected.finish)?selected.price: typeof x.priceOf === 'function' ? x.priceOf(c?.name) : cardPrice(c);
  return value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
 };
 const f=formatOf(args.format),budget=Number(args.budget)>0?Math.min(10000,Number(args.budget)):Infinity,basis=['purchase','owned'].includes(args.budget_basis)?args.budget_basis:'total',limit=basis==='owned'?0:budget,exclusive=args.budgetBoundary==='exclusive'&&budget!==Infinity;
 if(f.id==='limited')return {requiresChoice:true,note:'Limited needs the cards from your draft or sealed pool. Choose a constructed format or provide that pool.'};
 if(f.id==='paupercommander'&&!args.flow)return {requiresChoice:true,note:'This AI draft path does not yet verify Pauper Commander’s separate commander-rarity rule. Choose Commander, or use the existing Pauper Commander builder and review its commander eligibility check.'};
 const style=clean(args.style),seedName=clean(args.seed),leaderName=clean(args.commander),catalog={},warnings=[],goal=normalizeDeckGoal(args.goal,style);
 const parsedTypes=readCreatureTypeRestrictions(style);
 for(const field of ['creatureTypesOnly','excludedSubtypes'])if(args[field]!==undefined&&(!Array.isArray(args[field])||args[field].length>8||args[field].some(type=>!CREATURE_THEMES.includes(type))))return {requiresChoice:true,note:'Choose at most eight known creature types for each type restriction.'};
 args={...args,creatureTypesOnly:[...new Set(args.creatureTypesOnly===undefined?parsedTypes.creatureTypesOnly:args.creatureTypesOnly)],excludedSubtypes:[...new Set(args.excludedSubtypes===undefined?parsedTypes.excludedSubtypes:args.excludedSubtypes)]};
 const parsedLoop=readLoopIntent(style);
 for(const field of ['requireLoop','loopOutput','unsupportedLoop','loopConflict','clearLoop'])if(!Object.hasOwn(args,field))args[field]=parsedLoop[field];
 const loopIntent={requireLoop:args.requireLoop??null,loopOutput:args.loopOutput??null,unsupportedLoop:args.unsupportedLoop??null,loopConflict:args.loopConflict===true,clearLoop:args.clearLoop===true};
 if(loopIntent.unsupportedLoop)return {requiresChoice:true,choice:'loop',goal,note:loopIntent.unsupportedLoop};
 if(loopIntent.loopConflict||loopIntent.requireLoop&&args.avoid_infinite)return {requiresChoice:true,choice:'loop',goal,note:'Infinite mana conflicts with your retained no-infinite-combos restriction. Choose which requirement to keep; neither was relaxed.'};
 if(loopIntent.requireLoop&&args.game&&args.game!=='mtg')return {requiresChoice:true,choice:'loop',goal,note:'The reviewed repeatable-mana packages are for Magic only. This game needs its own exact-card interaction check.'};
 let automaticLeader=false,leaderSupport=0,leaderCandidates=0;
 const unverifiedInfinite=args.avoid_infinite===true&&args.allowUnverifiedInfinite===true;
 if(args.avoid_infinite===true&&!unverifiedInfinite)return {requiresChoice:true,choice:'infinite',goal,note:'You asked for no infinite combos. CardStashy cannot verify every possible loop. You can review an explicitly unverified draft, revise the restriction, or name specific cards to exclude. An exclusion list alone cannot prove there are no infinite combos. Nothing was saved.'};
 if(unverifiedInfinite)warnings.push('Unverified restriction: you allowed this draft without checking every possible infinite combo. Specific card exclusions are enforced, but do not prove the absence of all loops.');
 for(const [key,max] of [['required_cards',8],['excluded_cards',16],['candidate_cards',6]])if(args[key] !== undefined && (!Array.isArray(args[key]) || args[key].length>max || args[key].some(n=>typeof n !== 'string' || !clean(n))))return {requiresChoice:true,note:`Provide at most ${max} exact card names for ${key.replace('_',' ')}.`};
 if(args.colors !== undefined && (!Array.isArray(args.colors) || args.colors.some(c=>!['W','U','B','R','G','C'].includes(c))))return {requiresChoice:true,note:'Choose colors using W, U, B, R, G or C.'};
 const styleColors={white:'W',blue:'U',black:'B',red:'R',green:'G',colorless:'C'},requestedColors=[...new Set(args.colors?.length?args.colors:Object.keys(styleColors).filter(k=>new RegExp('\\b'+k+'\\b','i').test(style)).map(k=>styleColors[k]))];
 if(requestedColors.includes('C') && requestedColors.length>1)return {requiresChoice:true,note:'Use C for a colorless deck, or choose colored identity letters without C.'};
 const requiredNames=[...new Set((args.required_cards || []).map(clean))],excludedNames=[...new Set((args.excluded_cards || []).map(clean))];
 if(!f.commander&&leaderName)return {requiresChoice:true,note:`${f.name} does not use a commander slot. Choose Commander, or use that card as the build-around instead.`};
 const active=()=>args.current?.()!==false;
 const remember=input=>{const c=referenceCards[cardKey(input?.name)]||input;if(c?.name){catalog[cardKey(c.name)]=c;x.cacheCard?.(c);}return c;};
 const resolve=async name=>{if(!active())return null;try{return remember(x.meta?.(name)||await x.resolve(name,true));}catch{return null;}};
 let successfulSearches=0;
 const search=async(q,{pages=1}={})=>{
  const found=[];
  for(let page=1;page<=Math.min(pages,2)&&active();page++)try{
   const params=new URLSearchParams({q:q+' prefer:usd-low',unique:'cards',order:f.commander?'edhrec':'cmc',...(page>1?{page:String(page)}:{})});
   const r=await x.api('/cards/search?'+params);if(!active())break;successfulSearches++;
   found.push(...(r?.data||[]).slice(0,175).map(remember));if(!r?.has_more)break;
  }catch{warnings.push('Some card lookups were unavailable; this draft is limited to resolved and cached card data.');break;}
  return [...new Map(found.map(c=>[cardKey(c.name),c])).values()];
 };
 let seed=seedName?await resolve(seedName):null,lead=leaderName?await resolve(leaderName):null;
 if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
 // Name-based build-arounds may have an unpriced default printing. Check one
 // existing bounded paper-print page before treating that as no priced card.
 // Explicit quote/printing choices and owned-only builds are never substituted.
 if(basis!=='owned'&&!args.ownedOnly){
  for(const original of [...new Map([seed,lead].filter(Boolean).map(c=>[cardKey(c.name),c])).values()]){
   const locked=x.S?.state?.priceChoices?.[cardKey(original.name)]||args.printingId||args.seedPrintingId||args.commanderPrintingId||args.printingLocked||args.finish||args.language||args.printingLanguage||args.seedFinish||args.commanderFinish||args.lockedPrintings?.[cardKey(original.name)];
   if(locked||!original.oracle_id||quote(original)!==null)continue;
   try{const found=await findCheapestPrinting(original.name,{api:x.api,reference:original,format:f.legality});
    if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
    let selected=found.card,finish='nonfoil';
    if(!selected&&original.finishes?.length===1&&original.finishes[0]==='foil'){
     selected=(found.checkedPrintings||[]).filter(c=>eligiblePrinting(c,original.name,{reference:original,format:f.legality})&&c.finishes?.length===1&&c.finishes[0]==='foil'&&typeof c.prices?.usd_foil==='string'&&c.prices.usd_foil.trim()&&Number.isFinite(Number(c.prices.usd_foil))&&Number(c.prices.usd_foil)>=0).sort((a,b)=>Number(a.prices.usd_foil)-Number(b.prices.usd_foil)||a.id.localeCompare(b.id))[0];finish='foil';
    }
    if(selected?.id&&selected.oracle_id===original.oracle_id){
     referencePriceSelections[cardKey(original.name)]={printingId:selected.id,oracleId:selected.oracle_id,finish,price:Number(selected.prices[finish==='foil'?'usd_foil':'usd']),quoteField:finish==='foil'?'usd_foil':'usd',provider:'Scryfall',retrievedAt:new Date().toISOString(),set:selected.set,collectorNumber:selected.collector_number,coverage:found.coverage};
     referenceCards[cardKey(original.name)]=selected;remember(selected);if(seed&&cardKey(seed.name)===cardKey(original.name))seed=selected;if(lead&&cardKey(lead.name)===cardKey(original.name))lead=selected;warnings.push('Used a verified '+(finish==='foil'?'foil-only':'nonfoil')+' paper printing for '+original.name+' after its default estimate had no quote; this one-page check is not a market-wide lowest-price claim.');
    }
   }catch{if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};warnings.push('Could not recover a verified priced paper printing for '+original.name+'; its price remains unverified.');}
  }
 }
 const requiredCards=await batches(requiredNames,resolve),excludedCards=await batches(excludedNames,resolve);
 const suggested=await batches((args.candidate_cards || []).map(clean),resolve);
 if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
 if(suggested.some(c=>!c))warnings.push('Some suggested alternatives could not be verified and were not added to the candidate pool.');
 const unresolved=requiredNames.filter((_,i)=>!requiredCards[i]).concat(excludedNames.filter((_,i)=>!excludedCards[i]));
 if(unresolved.length)return {requiresChoice:true,note:`I could not verify these exact required or excluded cards: ${unresolved.join(', ')}. Please use their exact names.`};
 const excludedKeys=new Set(excludedCards.map(c=>cardKey(c.name)));
 if([seed,lead,...requiredCards].filter(Boolean).some(c=>excludedKeys.has(cardKey(c.name))))return {requiresChoice:true,note:'A required build-around, commander or required card is also excluded. Which instruction should take priority?'};
 if(requiredCards.some(c=>!isLegal(c,f)||!functionalIn(c,f)))return {requiresChoice:true,note:'A required card is not confirmed legal in this format. Choose another format or remove that requirement.'};
 if([seed,lead,...requiredCards].filter(Boolean).some(c=>!fitsTypeRestrictions(c,args)))return {requiresChoice:true,note:'A required card or commander conflicts with your explicit creature-type restriction. Change that card or revise the restriction.'};
 const allowedColors=requestedColors.filter(c=>c!=='C');
 if(requestedColors.length && [seed,lead,...requiredCards].filter(Boolean).some(c=>!fitsColors(c,allowedColors)))return {requiresChoice:true,note:'A required card or commander is outside your requested colors. Change the card or the color constraint.'};
 if(seedName&&!seed)return {requiresChoice:true,note:`Which card did you mean by “${seedName}”? I could not resolve one card reliably.`};
 if(leaderName&&!lead)return {requiresChoice:true,note:`Which commander did you mean by “${leaderName}”? I could not resolve one card reliably.`};
 if(seed&&!isLegal(seed,f))return {requiresChoice:true,note:`${seed.name} is not confirmed legal in ${f.name}. Choose a different format or build-around.`};
 if(f.commander&&seed&&canLead(seed,f)&&!lead)lead=seed;
 if(f.commander&&lead){await verifyLeader(lead,f,x.api);if(!canLead(lead,f)||!isLegal(lead,f))return {requiresChoice:true,note:`${lead.name} cannot be used as a verified ${f.name} commander. Choose another commander.`};}
 if(f.commander&&seed&&lead&&!fitsColors(seed,lead.color_identity||[]))return {requiresChoice:true,note:`${seed.name} is outside ${lead.name}'s color identity. Choose a commander that can include it.`};
 const colorWords={white:'w',blue:'u',black:'b',red:'r',green:'g'},cs=Object.keys(colorWords).filter(k=>new RegExp('\\b'+k+'\\b','i').test(style)).map(k=>colorWords[k]).join('');
 // Subjective playstyle words are preferences, not literal card-text filters.
 // Exact seed names and actual theme/mechanic words still use their own paths.
 const discoveryStyle=style.replace(/\bbeginner[- ]friendly\b|\beasy to play\b|\b(?:aggressive|aggro|beginner|beginners|easy|friendly)\b/gi,' ').trim();
 const theme=themeQuery(seed,discoveryStyle),fq=f.legality?'f:'+f.legality:'game:paper';
 if(!seed||f.commander&&!lead){
  const leadQuery=f.commander?(f.id==='paupercommander'?'is:paupercommander':f.commander==='planeswalker'?'t:planeswalker':'is:commander'):'-t:land';
  const neededColors=[...new Set([seed,...requiredCards].filter(Boolean).flatMap(c=>c.color_identity || []))],identity=requestedColors.length?`id=${allowedColors.join('').toLowerCase()||'c'}`:cs?`id=${cs}`:neededColors.length?`id>=${neededColors.join('').toLowerCase()}`:'';
  const choices=await search(`${fq} ${leadQuery} ${identity} ${theme}`,{pages:2});
  // Keep already-resolved suggestions available if the catalogue search misses
  // or fails. They must demonstrably fit the same requested theme and checks.
  const intent=requestedIntent(discoveryStyle);
  const fallback=[...suggested,...(!successfulSearches?Object.values(x.S?.catalog||{}):[])].filter(c=>c&&intent.other.length===0&&intent.tribes.every(t=>tribalSupport(c,t))&&intent.roles.every(r=>themeSupport(c,{roles:[r]}).length>0)&&intent.abilities.every(k=>mtgAbilityEvidence(c,k).length));
  const candidates=[...choices,...fallback.filter(c=>!choices.some(found=>cardKey(found.name)===cardKey(c.name)))];
  const loopRoutes=loopIntent.requireLoop?manaLoopCandidates({...args,...loopIntent},{excluded_cards:excludedNames}):null;
  const leaderCost=c=>basis!=='total'&&available(x,c.name)>0?0:quote(c);
  const usable=candidates.filter(c=>!excludedKeys.has(cardKey(c.name))&&fitsTypeRestrictions(c,args)&&(!requestedColors.length||fitsColors(c,allowedColors))&&requiredCards.every(r=>!f.commander||fitsColors(r,c.color_identity||[]))&&isLegal(c,f)&&(!f.commander||canLead(c,f)||f.id==='paupercommander')&&(!seed||!f.commander||fitsColors(seed,c.color_identity||[]))&&(!loopRoutes||!f.commander||loopRoutes.some(p=>p.colors.every(color=>(c.color_identity||[]).includes(color))))).filter(c=>basis==='owned'?available(x,c.name)>0:limit===Infinity||args.flow&&args.budgetMode==='target'||leaderCost(c)!==null&&leaderCost(c)<=limit);
  // A requested plan needs an appropriate engine, not an arbitrary member of
  // the first page. These are bounded, explained tie-breaks, not a power score.
  const planFit=c=>intent.tribes.reduce((n,type)=>n+tribeEvidence(c,type).reduce((s,e)=>s+(e.kind==='payoff'?4:e.kind==='token'?2:1),0),0)+intent.roles.reduce((n,role)=>n+themeSupport(c,{roles:[role]}).length,0)+intent.abilities.reduce((n,ability)=>n+mtgAbilityEvidence(c,ability).length,0)+(mechanicCardMatches(c,intent.mechanics||[])?4:0);
  if(goal==='strongest'||goal==='theme')usable.sort((a,b)=>planFit(b)-planFit(a)||(f.commander?(a.edhrec_rank||Infinity)-(b.edhrec_rank||Infinity):0)||a.name.localeCompare(b.name));
  const chosen=usable[args.flow&&goal!=='strongest'&&goal!=='theme' ? Math.abs(Number(args.randomSeed)||0)%Math.min(usable.length,24) : 0];
  if(!chosen)return {requiresChoice:true,note:seed?`I found ${seed.name}, but no compatible priced commander in this search. Name a commander to use with it.`:warnings.some(w=>w.startsWith('Some card lookups'))?`The card search could not finish, so I cannot verify a ${f.name} build-around yet. Try again, or name a card to build around.`:`I could not find a verified ${f.name} build-around for that theme in this search. Name a card to build around.`,warnings:[...new Set(warnings)]};
  if(f.commander){lead=chosen;automaticLeader=true;leaderSupport=planFit(chosen);leaderCandidates=usable.length;if(f.id==='paupercommander'){lead.pdhCommander=true;remember(lead);}}else seed=chosen;
  if(!seed)seed=chosen;
 }
 if(lead&&requiredCards.some(c=>!fitsColors(c,lead.color_identity||[])))return {requiresChoice:true,note:'A required card is outside the selected commander’s color identity. Choose a compatible commander or change that requirement.'};
 const colors=(lead?.color_identity||(requestedColors.length?allowedColors:[...new Set([seed,...requiredCards].filter(Boolean).flatMap(c=>c.color_identity||[]))])),ci=colors.join('').toLowerCase()||'c',baseQ=`${fq} id<=${ci}${args.targetBracket&&args.targetBracket<=2?' -is:gamechanger':''}`;
 let loopPackages=[null];
 if(loopIntent.requireLoop){
  const possible=manaLoopCandidates({...args,...loopIntent},{excluded_cards:excludedNames}).filter(p=>p.colors.every(color=>colors.includes(color)));
  const pieceNames=[...new Set(possible.flatMap(p=>p.cards))],resolved=await batches(pieceNames,resolve),pieces=new Map(pieceNames.map((name,i)=>[cardKey(name),resolved[i]]));
  if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
  loopPackages=possible.filter(p=>p.cards.every(name=>{const c=pieces.get(cardKey(name));return c&&!c.brief&&isLegal(c,f)&&functionalIn(c,f)&&fitsColors(c,colors)&&fitsTypeRestrictions(c,args)&&!excludedKeys.has(cardKey(c.name));})&&inspectManaLoop(p.cards.map(name=>({card:pieces.get(cardKey(name)),qty:1,zone:'main'})),{...args,...loopIntent}).status==='verified');
  if(!loopPackages.length)return {requiresChoice:true,choice:'loop',goal,note:'No reviewed repeatable-mana package could be resolved within your format, commander colors, creature types, exclusions and requested mana output. Missing or incompatible pieces were not substituted. Revise a requirement or name an exact route for review.'};
 }
 const requestedTribes=[...new Set([...requestedIntent(style).tribes,...(args.creatureTypesOnly||[]),...(lead?commanderTheme(lead).tribes:[])])];
 const focusedQueries=[...opponentDiscoveryQueries(args.matchupContext),...tribalDiscoveryQueries(requestedTribes,{limit:3}),...mechanicDiscoveryQueries(requestedMechanics(style),{limit:3})];
 const planQueries=[...new Set([...focusedQueries,...themeQueries(seed,style),...(lead&&cardKey(lead.name)!==cardKey(seed.name)?themeQueries(lead):[])])];
 // Two bounded discovery lanes complement—not replace—the affordable pool.
 // The six-mana window is a retrieval heuristic, not a legality restriction.
 // Standard retains mana-value ordering; Commander popularity is not used as
 // a Standard quality prior. Actual card/deck evaluators decide acceptance.
 const alternativeQueries=[`${baseQ} -t:land (t:creature or t:planeswalker) cmc<=6 (o:draw or o:enters or o:whenever or keyword:haste or keyword:flying)`,`${baseQ} t:land -t:basic`];
 const alternativeCards=[];
 const queries=[...planQueries.map(query=>`${baseQ} -t:land ${query}`),`${baseQ} -t:land usd<=0.5`,`${baseQ} -t:land cmc<=3 (o:destroy or o:exile or o:counter)`,`${baseQ} -t:land (o:draw or o:search)`,`${baseQ} -t:land (o:"add {" or o:"mana of")`,`${baseQ} t:land -t:basic usd<=1`];
 // A commander that needs a land subtype (Deserts, Gates…) must see those
 // lands and the cards that find them, not only generic land discovery.
 const needQueries=commanderLandRequirements(lead||seed).flatMap(need=>{const t=/^[a-z-]+$/i.test(need.subtype)?need.subtype.toLowerCase():`"${need.subtype.toLowerCase()}"`;return [`${baseQ} t:land t:${t}`,`${baseQ} -t:land o:${t}`];});
 queries.push(...needQueries,...alternativeQueries);
 await batches([...new Set(queries)],async q=>{const found=await search(q,{pages:planQueries.some(p=>q.endsWith(p))||needQueries.includes(q)?2:1});if(alternativeQueries.includes(q))alternativeCards.push(...found);return found;});
 // The same selector can work without the AI/provider on already loaded rules
 // records. This is a bounded cached pool, not a claim of a full offline catalog.
 if(!successfulSearches)for(const c of Object.values(x.S?.catalog||{}))if(c?.name&&c.type_line&&isLegal(c,f)&&fitsColors(c,colors)&&!excludedKeys.has(cardKey(c.name)))remember(c);
 // Basics are real catalog cards with actual quote coverage, never fabricated $0 rows.
 const basicNames=(colors.length?colors:['C']).map(c=>BASIC[c]).filter(Boolean);
 await batches(basicNames,async name => {
  const current = await resolve(name);
  if (!active()) return;
  try {
   const { card } = await findCheapestPrinting(name,{api:x.api,reference:current,format:f.legality,basicOnly:true});
   if(active() && card && (!current || cardPrice(current)===null || cardPrice(card)<cardPrice(current) || !isLegal(current,f))) remember(card);
  } catch { warnings.push('Some basic-land printing lookups were unavailable; only existing verified card data and known quotes were used.'); }
 });
 if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
 const own=n=>available(x,n),required=[...new Map([seed,...requiredCards].filter(c=>c&&cardKey(c.name)!==cardKey(lead?.name)).map(c=>[cardKey(c.name),{name:c.name,qty:1}])).values()];
 if(args.flow&&args.preferOwned!==false)for(const c of Object.values(x.S?.catalog||{}))if(c?.name&&available(x,c.name)>0&&!catalog[cardKey(c.name)]&&isLegal(c,f)&&fitsColors(c,colors))remember(c);
 const buildCatalog=Object.fromEntries(Object.entries(catalog).filter(([,c])=>!excludedKeys.has(cardKey(c.name))&&fitsTypeRestrictions(c,args)));
 const options=({format:f.name,targetBracket:args.targetBracket,matchupContext:args.matchupContext,seeds:[seed],commander:lead,easy:args.easy===true,preferred:args.preferOwned===true?c=>own(c.name):()=>0,requestedStyle:style,goal,creatureTypesOnly:args.creatureTypesOnly,excludedSubtypes:args.excludedSubtypes,suggestedCards:suggested.filter(Boolean).map(c=>c.name),excludedCards:excludedCards.map(c=>c.name),catalog:buildCatalog,base:required,colors:colors.length?colors:['C'],available:basis==='total'?()=>0:own,price:quote,budget:limit});
 const alternativeDrafts=[];
 const candidates=loopPackages.flatMap(pkg=>{
  const base=[...new Map([...required,...(pkg?pkg.cards.filter(name=>cardKey(name)!==cardKey(lead?.name)).map(name=>({name,qty:1})):[])].map(r=>[cardKey(r.name),r])).values()];
  return (args.constructionBudgets||[exclusive?Math.max(0,money(limit-.01)):limit]).flatMap(cap=>{
   const decorate=draft=>({...draft,...loopIntent,requiredLoopPackage:pkg?.id||null,internalRequiredCards:pkg?[...pkg.cards]:[]});
   const primary=buildDeck({...options,base,budget:cap}),drafts=[decorate(primary),...(args.flow?[decorate(buildDeck({...options,base,budget:cap,completionFirst:true}))]:[])];
   if(args.flow&&active()&&alternativeDrafts.length<2){
    const present=new Set(primary.cards.map(r=>cardKey(r.name))),intent=requestedIntent(style),themes=[seed,lead].filter(Boolean).map(commanderTheme),tags=[...new Set([...intent.roles,...themes.flatMap(t=>t.roles)])],tribes=[...new Set([...intent.tribes,...themes.flatMap(t=>t.tribes)])];
    const alternatives=[...new Map(alternativeCards.filter(c=>c&&buildCatalog[cardKey(c.name)]&&isLegal(c,f)&&functionalIn(c,f)&&fitsColors(c,colors)&&!present.has(cardKey(c.name))&&(basis==='owned'?own(c.name)>0:cap===Infinity||basis!=='total'&&own(c.name)>0||quote(c)!==null&&quote(c)<=cap)&&!/\bLand\b/.test(c.type_line||'')).map(c=>[cardKey(c.name),c])).values()].sort((a,b)=>scoreCard(b,tags,tribes,{size:f.size,goal})-scoreCard(a,tags,tribes,{size:f.size,goal})||a.name.localeCompare(b.name)).slice(0,2);
    // A discovery anchor creates an alternative, not a user-required card. It
    // is never persisted as an instruction and can lose to the original list.
    for(const c of alternatives.slice(0,2-alternativeDrafts.length))alternativeDrafts.push(decorate(buildDeck({...options,base:[...base,{name:c.name,qty:1}],budget:cap})));
   }
   return drafts;
  });
 });
 // Keep every original cap/package candidate ahead of the at-most-two scouts.
 candidates.push(...alternativeDrafts);
 const finish=draft=>{
 const candidateWarnings=[...warnings];
 const pricing=deckPriceCoverage(draft.cards,catalog,own,quote),validation=validateDeck(draft,catalog,[],[]),issues=[...validation.issues];
 if(f.id==='oathbreaker')issues.push({kind:'unverified',text:'Oathbreaker requires a signature spell. This draft path has not selected or checked that special command-zone requirement.'});
 for(const row of draft.cards){const c=catalog[cardKey(row.name)];if(c&&!Array.isArray(c.color_identity))issues.push({kind:'unverified',text:`${row.name}: color identity data is missing.`});}
 if(!draft.cards.some(r=>cardKey(r.name)===cardKey(seed.name)))issues.push({kind:'build-around',text:`Required build-around ${seed.name} is missing.`});
 for(const c of requiredCards)if(!draft.cards.some(r=>cardKey(r.name)===cardKey(c.name)))issues.push({kind:'required',text:`Required card ${c.name} is missing.`});
 for(const r of draft.cards)if(excludedKeys.has(cardKey(r.name)))issues.push({kind:'excluded',text:`Excluded card ${r.name} was selected.`});
 for(const r of draft.cards)if(!fitsTypeRestrictions(catalog[cardKey(r.name)],args))issues.push({kind:'creature-type',text:`${r.name} does not satisfy the requested creature-type restriction or its card types are unverified.`});
 if(basis==='owned'&&pricing.ownedCopies<sumQty(draft.cards))issues.push({kind:'ownership',text:`${sumQty(draft.cards)-pricing.ownedCopies} copies are not available in your saved collection.`});
 const estimate=basis==='total'?pricing.totalEstimate:pricing.purchaseEstimate,withinBudget=estimate!==null&&(exclusive?estimate<limit-1e-9:estimate<=limit+1e-6);
 if(estimate===null)candidateWarnings.push('Some selected cards have no current quote. The budget is not verified.');
 else if(!withinBudget)candidateWarnings.push(`The ${basis==='total'?'whole-deck':'purchase'} estimate exceeds your budget. This is not an under-budget recommendation.`);
 if(goal !== 'strongest')candidateWarnings.push(goalDescription(goal)+' Goal fit is a judgment to review, not a verified power or fun rating.');
 const finalRows=draft.cards.map(r=>({...r,card:catalog[cardKey(r.name)],zone:'main'})),themeCheck=inspectMtgTheme(finalRows,{style,commander:lead?.name,seed:seed?.name,goal}),comboCheck=inspectManaLoop(finalRows,args);
 candidateWarnings.push(...themeCheck.issues,...themeCheck.notes,...comboCheck.issues);
 if(comboCheck.status==='verified')candidateWarnings.push('A reviewed repeatable-mana sequence is present conditionally. Deployment, a useful outlet and a winning line are separate; this does not guarantee a win.');
 for(const text of comboCheck.issues)issues.push({kind:'loop',text});
 const legalChecked=issues.length===0,complete=draft.total===f.size,ready=complete&&legalChecked&&withinBudget&&!unverifiedInfinite&&!themeCheck.issues.length&&['supported','not-requested'].includes(themeCheck.status);
 const rankedLeader=goal==='strongest'||goal==='theme';
 const commanderReason=lead?(leaderName?'Your requested commander':automaticLeader?`Selected from ${leaderCandidates} verified theme candidates ${rankedLeader?'by recognized plan support, then provider popularity':'from the bounded compatible theme pool'}; this is not a measured power ranking or an optimality guarantee.`:cardKey(lead.name)===cardKey(seed.name)?'The requested build-around can lead this format':`Selected from legal theme candidates; its color identity can include ${seed.name}`):'';
 const note=`${unverifiedInfinite?'Unverified draft':ready?'Checked draft':'Partial draft'}: ${draft.total}/${f.size} cards${lead?`, led by ${lead.name}`:''}, including ${seed.name}. ${pricing.totalEstimate===null?'Whole-deck estimate incomplete':`Whole-deck estimate $${pricing.totalEstimate.toFixed(2)}`}; ${pricing.purchaseEstimate===null?'purchase estimate incomplete':`$${pricing.purchaseEstimate.toFixed(2)} to buy with available owned copies`}. ${unverifiedInfinite?'Infinite combos have not been verified. Review the warnings before using or saving this draft.':ready?'Review the exact list before saving.':'Review the warnings before using or saving it.'}`;
 const availableCopies=Object.fromEntries(draft.cards.map(r=>[cardKey(r.name),Math.min(r.qty,own(r.name))])),referencePrices=Object.fromEntries(draft.cards.map(r=>[cardKey(r.name),quote(catalog[cardKey(r.name)])]));
 const typeRestrictions={creatureTypesOnly:[...args.creatureTypesOnly],excludedSubtypes:[...args.excludedSubtypes]};
 return {draft:{...draft,...pricing,...typeRestrictions,...loopIntent,comboCheck,themeCheck,goal,goalDescription:goalDescription(goal),goalVerified:false,unverifiedConstraints:unverifiedInfinite?['infinite_combos']:[],requiredCards:requiredCards.map(c=>c.name),excludedCards:excludedCards.map(c=>c.name),requestedColors,availableCopies,referencePrices,referencePriceSelections:structuredClone(referencePriceSelections),preparedAt:new Date().toISOString(),budget:limit,budgetBasis:basis,cost:pricing.purchaseEstimate,unknown:pricing.unpricedPurchaseCopies,owned:pricing.ownedCopies,buildAround:seed.name,commanderReason,commanderSelection:automaticLeader?{candidates:leaderCandidates,recognizedSupport:leaderSupport,method:rankedLeader?'bounded-plan-support':'bounded-compatible-pool'}:null,legalChecked,complete,withinBudget,issues,warnings:[...new Set([...draft.warnings,...candidateWarnings,...issues.map(i=>i.text)])],note,preparedByAsk:true},result:{game:'mtg',requestedStyle:style,...typeRestrictions,...loopIntent,comboCheck,themeCheck,themeVerified:themeCheck.status==='supported',goal,goalDescription:goalDescription(goal),goalVerified:false,unverifiedConstraints:unverifiedInfinite?['infinite_combos']:[],requiredCards:requiredCards.map(c=>c.name),excludedCards:excludedCards.map(c=>c.name),requestedColors,ready,partial:!ready,format:f.name,seed:seed.name,commander:lead?.name||'',commanderReason,total:draft.total,target:f.size,lands:draft.lands,legalChecked,withinBudget,budget:limit===Infinity?'no limit':limit,budgetBasis:basis,...pricing,note,warnings:[...new Set([...candidateWarnings,...issues.map(i=>i.text)])].slice(0,8)}};
 };
 return args.flow?{candidates:candidates.map(finish)}:finish(candidates[0]);
}
