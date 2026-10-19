// One bounded app-data operation, not one AI call per card. Recommendations stay
// unsaved until the player reviews the exact list and uses the normal save action.
import { buildDeck, themeQuery, themeQueries, fitsColors, requestedIntent } from './builder.js';
import { cardKey, cardPrice, sumQty, validateDeck } from './core.js';
import { formatOf, canLead, legalityIn, verifyLeader } from './formats.js';
import { normalizeDeckGoal, goalDescription } from './ai-deck-goal.js';
import { commanderTheme, tribalSupport, themeSupport } from './planner.js';
import { functionalIn } from './deck-safety.js';
import { findCheapestPrinting } from './mtg-cheap.js';
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
 const quote = c => {
  const choice = x.S?.state?.priceChoices?.[cardKey(c?.name)], value = choice ? choice.price : typeof x.priceOf === 'function' ? x.priceOf(c?.name) : cardPrice(c);
  return value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
 };
 const f=formatOf(args.format),budget=Number(args.budget)>0?Math.min(10000,Number(args.budget)):Infinity,basis=['purchase','owned'].includes(args.budget_basis)?args.budget_basis:'total',limit=basis==='owned'?0:budget;
 if(f.id==='limited')return {requiresChoice:true,note:'Limited needs the cards from your draft or sealed pool. Choose a constructed format or provide that pool.'};
 if(f.id==='paupercommander')return {requiresChoice:true,note:'This AI draft path does not yet verify Pauper Commander’s separate commander-rarity rule. Choose Commander, or use the existing Pauper Commander builder and review its commander eligibility check.'};
 const style=clean(args.style),seedName=clean(args.seed),leaderName=clean(args.commander),catalog={},warnings=[],goal=normalizeDeckGoal(args.goal,style);
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
 const remember=c=>{if(c?.name){catalog[cardKey(c.name)]=c;x.cacheCard?.(c);}return c;};
 const resolve=async name=>{if(!active())return null;try{return remember(x.meta?.(name)||await x.resolve(name,true));}catch{return null;}};
 const search=async q=>{if(!active())return [];try{const r=await x.api('/cards/search?'+new URLSearchParams({q:q+' prefer:usd-low',unique:'cards',order:'edhrec'}));return (r?.data||[]).slice(0,175).map(remember);}catch{warnings.push('Some card lookups were unavailable; this may limit the draft.');return [];}};
 let seed=seedName?await resolve(seedName):null,lead=leaderName?await resolve(leaderName):null;
 if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
 const requiredCards=await batches(requiredNames,resolve),excludedCards=await batches(excludedNames,resolve);
 const suggested=await batches((args.candidate_cards || []).map(clean),resolve);
 if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
 if(suggested.some(c=>!c))warnings.push('Some suggested alternatives could not be verified and were not added to the candidate pool.');
 const unresolved=requiredNames.filter((_,i)=>!requiredCards[i]).concat(excludedNames.filter((_,i)=>!excludedCards[i]));
 if(unresolved.length)return {requiresChoice:true,note:`I could not verify these exact required or excluded cards: ${unresolved.join(', ')}. Please use their exact names.`};
 const excludedKeys=new Set(excludedCards.map(c=>cardKey(c.name)));
 if([seed,lead,...requiredCards].filter(Boolean).some(c=>excludedKeys.has(cardKey(c.name))))return {requiresChoice:true,note:'A required build-around, commander or required card is also excluded. Which instruction should take priority?'};
 if(requiredCards.some(c=>!isLegal(c,f)||!functionalIn(c,f)))return {requiresChoice:true,note:'A required card is not confirmed legal in this format. Choose another format or remove that requirement.'};
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
  const choices=await search(`${fq} ${leadQuery} ${identity} ${theme}`);
  // Keep already-resolved suggestions available if the catalogue search misses
  // or fails. They must demonstrably fit the same requested theme and checks.
  const intent=requestedIntent(discoveryStyle);
  const fallback=suggested.filter(c=>c&&intent.other.length===0&&intent.tribes.every(t=>tribalSupport(c,t))&&intent.roles.every(r=>themeSupport(c,{roles:[r]}).length>0));
  const candidates=[...choices,...fallback.filter(c=>!choices.some(found=>cardKey(found.name)===cardKey(c.name)))];
  const usable=candidates.filter(c=>!excludedKeys.has(cardKey(c.name))&&(!requestedColors.length||fitsColors(c,allowedColors))&&requiredCards.every(r=>!f.commander||fitsColors(r,c.color_identity||[]))&&isLegal(c,f)&&(!f.commander||canLead(c,f)||f.id==='paupercommander')&&(!seed||!f.commander||fitsColors(seed,c.color_identity||[]))).filter(c=>basis==='owned'?available(x,c.name)>0:limit===Infinity||quote(c)!==null&&quote(c)<=limit);
  const chosen=usable[0];
  if(!chosen)return {requiresChoice:true,note:seed?`I found ${seed.name}, but no compatible priced commander in this search. Name a commander to use with it.`:warnings.some(w=>w.startsWith('Some card lookups'))?`The card search could not finish, so I cannot verify a ${f.name} build-around yet. Try again, or name a card to build around.`:`I could not find a verified ${f.name} build-around for that theme in this search. Name a card to build around.`,warnings:[...new Set(warnings)]};
  if(f.commander){lead=chosen;if(f.id==='paupercommander'){lead.pdhCommander=true;remember(lead);}}else seed=chosen;
  if(!seed)seed=chosen;
 }
 if(lead&&requiredCards.some(c=>!fitsColors(c,lead.color_identity||[])))return {requiresChoice:true,note:'A required card is outside the selected commander’s color identity. Choose a compatible commander or change that requirement.'};
 const colors=(lead?.color_identity||(requestedColors.length?allowedColors:[...new Set([seed,...requiredCards].filter(Boolean).flatMap(c=>c.color_identity||[]))])),ci=colors.join('').toLowerCase()||'c',baseQ=`${fq} id<=${ci}`;
 const planQueries=[...new Set([...themeQueries(seed,style),...(lead&&cardKey(lead.name)!==cardKey(seed.name)&&commanderTheme(lead).tribes.length?themeQueries(lead):[])])];
 const queries=[...planQueries.map(query=>`${baseQ} -t:land ${query}`),`${baseQ} -t:land usd<=0.5`,`${baseQ} -t:land cmc<=3 (o:destroy or o:exile or o:counter)`,`${baseQ} -t:land (o:draw or o:search)`,`${baseQ} -t:land (o:"add {" or o:"mana of")`,`${baseQ} t:land -t:basic usd<=1`];
 await batches([...new Set(queries)],search);
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
 const buildCatalog=Object.fromEntries(Object.entries(catalog).filter(([,c])=>!excludedKeys.has(cardKey(c.name))));
 const draft=buildDeck({format:f.name,seeds:[seed],commander:lead,requestedStyle:style,goal,suggestedCards:suggested.filter(Boolean).map(c=>c.name),excludedCards:excludedCards.map(c=>c.name),catalog:buildCatalog,base:required,colors:colors.length?colors:['C'],available:basis==='total'?()=>0:own,price:quote,budget:limit});
 const pricing=deckPriceCoverage(draft.cards,catalog,own,quote),validation=validateDeck(draft,catalog,[],[]),issues=[...validation.issues];
 if(f.id==='oathbreaker')issues.push({kind:'unverified',text:'Oathbreaker requires a signature spell. This draft path has not selected or checked that special command-zone requirement.'});
 for(const row of draft.cards){const c=catalog[cardKey(row.name)];if(c&&!Array.isArray(c.color_identity))issues.push({kind:'unverified',text:`${row.name}: color identity data is missing.`});}
 if(!draft.cards.some(r=>cardKey(r.name)===cardKey(seed.name)))issues.push({kind:'build-around',text:`Required build-around ${seed.name} is missing.`});
 for(const c of requiredCards)if(!draft.cards.some(r=>cardKey(r.name)===cardKey(c.name)))issues.push({kind:'required',text:`Required card ${c.name} is missing.`});
 for(const r of draft.cards)if(excludedKeys.has(cardKey(r.name)))issues.push({kind:'excluded',text:`Excluded card ${r.name} was selected.`});
 if(basis==='owned'&&pricing.ownedCopies<sumQty(draft.cards))issues.push({kind:'ownership',text:`${sumQty(draft.cards)-pricing.ownedCopies} copies are not available in your saved collection.`});
 const estimate=basis==='total'?pricing.totalEstimate:pricing.purchaseEstimate,withinBudget=estimate!==null&&estimate<=limit+1e-6;
 if(estimate===null)warnings.push('Some selected cards have no current quote. The budget is not verified.');
 else if(!withinBudget)warnings.push(`The ${basis==='total'?'whole-deck':'purchase'} estimate exceeds your budget. This is not an under-budget recommendation.`);
 if(goal !== 'strongest')warnings.push(goalDescription(goal)+' Goal fit is a judgment to review, not a verified power or fun rating.');
 const legalChecked=issues.length===0,complete=draft.total===f.size,ready=complete&&legalChecked&&withinBudget&&!unverifiedInfinite;
 const commanderReason=lead?(leaderName?'Your requested commander':cardKey(lead.name)===cardKey(seed.name)?'The requested build-around can lead this format':`Selected from legal theme candidates; its color identity can include ${seed.name}`):'';
 const note=`${unverifiedInfinite?'Unverified draft':ready?'Checked draft':'Partial draft'}: ${draft.total}/${f.size} cards${lead?`, led by ${lead.name}`:''}, including ${seed.name}. ${pricing.totalEstimate===null?'Whole-deck estimate incomplete':`Whole-deck estimate $${pricing.totalEstimate.toFixed(2)}`}; ${pricing.purchaseEstimate===null?'purchase estimate incomplete':`$${pricing.purchaseEstimate.toFixed(2)} to buy with available owned copies`}. ${unverifiedInfinite?'Infinite combos have not been verified. Review the warnings before using or saving this draft.':ready?'Review the exact list before saving.':'Review the warnings before using or saving it.'}`;
 const availableCopies=Object.fromEntries(draft.cards.map(r=>[cardKey(r.name),Math.min(r.qty,own(r.name))])),referencePrices=Object.fromEntries(draft.cards.map(r=>[cardKey(r.name),quote(catalog[cardKey(r.name)])]));
 return {draft:{...draft,...pricing,goal,goalDescription:goalDescription(goal),goalVerified:false,unverifiedConstraints:unverifiedInfinite?['infinite_combos']:[],requiredCards:requiredCards.map(c=>c.name),excludedCards:excludedCards.map(c=>c.name),requestedColors,availableCopies,referencePrices,preparedAt:new Date().toISOString(),budget:limit,budgetBasis:basis,cost:pricing.purchaseEstimate,unknown:pricing.unpricedPurchaseCopies,owned:pricing.ownedCopies,buildAround:seed.name,commanderReason,legalChecked,complete,withinBudget,issues,warnings:[...new Set([...draft.warnings,...warnings,...issues.map(i=>i.text)])],note,preparedByAsk:true},result:{game:'mtg',requestedStyle:style,goal,goalDescription:goalDescription(goal),goalVerified:false,unverifiedConstraints:unverifiedInfinite?['infinite_combos']:[],requiredCards:requiredCards.map(c=>c.name),excludedCards:excludedCards.map(c=>c.name),requestedColors,ready,partial:!ready,format:f.name,seed:seed.name,commander:lead?.name||'',commanderReason,total:draft.total,target:f.size,lands:draft.lands,legalChecked,withinBudget,budget:limit===Infinity?'no limit':limit,budgetBasis:basis,...pricing,note,warnings:[...new Set([...warnings,...issues.map(i=>i.text)])].slice(0,8)}};
}
