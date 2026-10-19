// One bounded app-data operation, not one AI call per card. Recommendations stay
// unsaved until the player reviews the exact list and uses the normal save action.
import { buildDeck, themeQuery, fitsColors } from './builder.js';
import { cardKey, cardPrice, sumQty, validateDeck } from './core.js';
import { formatOf, canLead, legalityIn, verifyLeader } from './formats.js';
const BASIC = { W:'Plains', U:'Island', B:'Swamp', R:'Mountain', G:'Forest', C:'Wastes' };
const money = n => Math.round(n * 100) / 100;
const quote = c => { const p = cardPrice(c); return Number.isFinite(p) && p >= 0 ? p : null; };
const clean = s => String(s || '').replace(/["\\\u0000-\u001f]/g,'').trim().slice(0,120);
const isLegal = (c,f) => !!c && (!f.legality || ['legal','restricted'].includes(legalityIn(c,f)));
const available = (x,name) => Math.max(0, Number(x.inv?.(name)?.available ?? x.inv?.(name)?.owned) || 0);
async function batches(rows,fn,width=3) { const out=[]; for(let i=0;i<rows.length;i+=width)out.push(...await Promise.all(rows.slice(i,i+width).map(fn))); return out; }
export function deckPriceCoverage(cards,catalog,owned=()=>0) {
 let total=0,purchase=0,unknown=0,purchaseUnknown=0,ownedCopies=0;
 for(const row of cards){const p=quote(catalog[cardKey(row.name)]),have=Math.min(row.qty,Math.max(0,owned(row.name)||0)),need=row.qty-have;ownedCopies+=have;if(p===null){unknown+=row.qty;purchaseUnknown+=need;}else{total+=p*row.qty;purchase+=p*need;}}
 return {totalEstimate:unknown?null:money(total),pricedSubtotal:money(total),unpricedCopies:unknown,purchaseEstimate:purchaseUnknown?null:money(purchase),pricedPurchaseSubtotal:money(purchase),unpricedPurchaseCopies:purchaseUnknown,ownedCopies,priceBasis:'Available app USD reference quotes, including basic lands; excludes tax and shipping. Estimates, not a checkout quote.'};
}
export async function prepareMtgDeck(args,x) {
 const f=formatOf(args.format),budget=Number(args.budget)>0?Math.min(10000,Number(args.budget)):Infinity,basis=['purchase','owned'].includes(args.budget_basis)?args.budget_basis:'total',limit=basis==='owned'?0:budget;
 if(f.id==='limited')return {requiresChoice:true,note:'Limited needs the cards from your draft or sealed pool. Choose a constructed format or provide that pool.'};
 if(f.id==='paupercommander')return {requiresChoice:true,note:'This AI draft path does not yet verify Pauper Commander’s separate commander-rarity rule. Choose Commander, or use the existing Pauper Commander builder and review its commander eligibility check.'};
 const style=clean(args.style),seedName=clean(args.seed),leaderName=clean(args.commander),catalog={},warnings=[];
 if(!f.commander&&leaderName)return {requiresChoice:true,note:`${f.name} does not use a commander slot. Choose Commander, or use that card as the build-around instead.`};
 const active=()=>args.current?.()!==false;
 const remember=c=>{if(c?.name){catalog[cardKey(c.name)]=c;x.cacheCard?.(c);}return c;};
 const resolve=async name=>{if(!active())return null;try{return remember(x.meta?.(name)||await x.resolve(name,true));}catch{return null;}};
 const search=async q=>{if(!active())return [];try{const r=await x.api('/cards/search?'+new URLSearchParams({q:q+' prefer:usd-low',unique:'cards',order:'edhrec'}));return (r?.data||[]).slice(0,175).map(remember);}catch{warnings.push('Some card lookups were unavailable; this may limit the draft.');return [];}};
 let seed=seedName?await resolve(seedName):null,lead=leaderName?await resolve(leaderName):null;
 if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
 if(seedName&&!seed)return {requiresChoice:true,note:`Which card did you mean by “${seedName}”? I could not resolve one card reliably.`};
 if(leaderName&&!lead)return {requiresChoice:true,note:`Which commander did you mean by “${leaderName}”? I could not resolve one card reliably.`};
 if(seed&&!isLegal(seed,f))return {requiresChoice:true,note:`${seed.name} is not confirmed legal in ${f.name}. Choose a different format or build-around.`};
 if(f.commander&&seed&&canLead(seed,f)&&!lead)lead=seed;
 if(f.commander&&lead){await verifyLeader(lead,f,x.api);if(!canLead(lead,f)||!isLegal(lead,f))return {requiresChoice:true,note:`${lead.name} cannot be used as a verified ${f.name} commander. Choose another commander.`};}
 if(f.commander&&seed&&lead&&!fitsColors(seed,lead.color_identity||[]))return {requiresChoice:true,note:`${seed.name} is outside ${lead.name}'s color identity. Choose a commander that can include it.`};
 const colorWords={white:'w',blue:'u',black:'b',red:'r',green:'g'},cs=Object.keys(colorWords).filter(k=>new RegExp('\\b'+k+'\\b','i').test(style)).map(k=>colorWords[k]).join('');
 const textTheme=style.toLowerCase().replace(/\b(mono|white|blue|black|red|green|deck|good|budget)\b/gi,'').replace(/\b(artifacts|dragons|tokens)\b/g,w=>w.slice(0,-1)).match(/[\p{L}\p{N}]+/gu)?.slice(0,4)||[],theme=seed?themeQuery(seed):(textTheme.length?'('+textTheme.map(w=>`t:"${w}" or o:"${w}"`).join(' or ')+')':''),fq=f.legality?'f:'+f.legality:'game:paper';
 if(!seed||f.commander&&!lead){
  const leadQuery=f.commander?(f.id==='paupercommander'?'is:paupercommander':f.commander==='planeswalker'?'t:planeswalker':'is:commander'):'-t:land';
  const identity=cs?`id=${cs}`:seed?.color_identity?.length?`id>=${seed.color_identity.join('').toLowerCase()}`:'';
  const choices=await search(`${fq} ${leadQuery} ${identity} ${theme}`);
  const usable=choices.filter(c=>isLegal(c,f)&&(!f.commander||canLead(c,f)||f.id==='paupercommander')&&(!seed||!f.commander||fitsColors(seed,c.color_identity||[]))).filter(c=>basis==='owned'?available(x,c.name)>0:limit===Infinity||quote(c)!==null&&quote(c)<=limit);
  const chosen=usable[0];
  if(!chosen)return {requiresChoice:true,note:seed?`I found ${seed.name}, but no compatible priced commander in this search. Name a commander to use with it.`:`I could not find a verified ${f.name} build-around for that theme. Name a card to build around.`,warnings:[...new Set(warnings)]};
  if(f.commander){lead=chosen;if(f.id==='paupercommander'){lead.pdhCommander=true;remember(lead);}}else seed=chosen;
  if(!seed)seed=chosen;
 }
 const colors=(lead?.color_identity||seed?.color_identity||[]),ci=colors.join('').toLowerCase()||'c',baseQ=`${fq} id<=${ci}`;
 const queries=[`${baseQ} -t:land ${theme||themeQuery(seed)}`,`${baseQ} -t:land usd<=0.5`,`${baseQ} -t:land cmc<=3 (o:destroy or o:exile or o:counter)`,`${baseQ} -t:land (o:draw or o:search)`,`${baseQ} -t:land (o:"add {" or o:"mana of")`,`${baseQ} t:land -t:basic usd<=1`];
 await batches([...new Set(queries)],search);
 // Basics are real catalog cards with actual quote coverage, never fabricated $0 rows.
 const basicNames=(colors.length?colors:['C']).map(c=>BASIC[c]).filter(Boolean);
 await batches(basicNames,resolve);
 if(!active())return {cancelled:true,note:'The question was closed or replaced. Nothing was saved.'};
 const own=n=>available(x,n),required=seed&&cardKey(seed.name)!==cardKey(lead?.name)?[{name:seed.name,qty:1}]:[];
 const seedCost=required.reduce((n,r)=>n+(quote(seed)||0)*(basis==='total'?1:Math.max(0,1-own(r.name))),0);
 const basicPrices=basicNames.map(n=>quote(catalog[cardKey(n)])),landTarget=f.commander&&f.size===100?36:Math.round(f.size*.4)-(f.commander?1:0);
 const basicReserve=basis==='owned'?0:Math.max(0,landTarget-(basis==='purchase'?basicNames.reduce((n,k)=>n+own(k),0):0))*Math.max(0,...basicPrices.filter(p=>p!==null));
 const draft=buildDeck({format:f.name,seeds:[seed],commander:lead,catalog,base:required,colors:colors.length?colors:['C'],available:basis==='total'?()=>0:own,price:quote,budget:limit===Infinity?Infinity:Math.max(0,limit-seedCost-basicReserve)});
 const pricing=deckPriceCoverage(draft.cards,catalog,own),validation=validateDeck(draft,catalog,[],[]),issues=[...validation.issues];
 if(f.id==='oathbreaker')issues.push({kind:'unverified',text:'Oathbreaker requires a signature spell. This draft path has not selected or checked that special command-zone requirement.'});
 for(const row of draft.cards){const c=catalog[cardKey(row.name)];if(c&&!Array.isArray(c.color_identity))issues.push({kind:'unverified',text:`${row.name}: color identity data is missing.`});}
 if(!draft.cards.some(r=>cardKey(r.name)===cardKey(seed.name)))issues.push({kind:'build-around',text:`Required build-around ${seed.name} is missing.`});
 if(basis==='owned'&&pricing.ownedCopies<sumQty(draft.cards))issues.push({kind:'ownership',text:`${sumQty(draft.cards)-pricing.ownedCopies} copies are not available in your saved collection.`});
 const estimate=basis==='total'?pricing.totalEstimate:pricing.purchaseEstimate,withinBudget=estimate!==null&&estimate<=limit+1e-6;
 if(estimate===null)warnings.push('Some selected cards have no current quote. The budget is not verified.');
 else if(!withinBudget)warnings.push(`The ${basis==='total'?'whole-deck':'purchase'} estimate exceeds your budget. This is not an under-budget recommendation.`);
 const legalChecked=issues.length===0,complete=draft.total===f.size,ready=complete&&legalChecked&&withinBudget;
 const commanderReason=lead?(leaderName?'Your requested commander':cardKey(lead.name)===cardKey(seed.name)?'The requested build-around can lead this format':`Selected from legal theme candidates; its color identity can include ${seed.name}`):'';
 const note=`${ready?'Checked draft':'Partial draft'}: ${draft.total}/${f.size} cards${lead?`, led by ${lead.name}`:''}, including ${seed.name}. ${pricing.totalEstimate===null?'Whole-deck estimate incomplete':`Whole-deck estimate $${pricing.totalEstimate.toFixed(2)}`}; ${pricing.purchaseEstimate===null?'purchase estimate incomplete':`$${pricing.purchaseEstimate.toFixed(2)} to buy with available owned copies`}. ${ready?'Review the exact list before saving.':'Review the warnings before using or saving it.'}`;
 const availableCopies=Object.fromEntries(draft.cards.map(r=>[cardKey(r.name),Math.min(r.qty,own(r.name))])),referencePrices=Object.fromEntries(draft.cards.map(r=>[cardKey(r.name),quote(catalog[cardKey(r.name)])]));
 return {draft:{...draft,...pricing,availableCopies,referencePrices,preparedAt:new Date().toISOString(),budget:limit,budgetBasis:basis,cost:pricing.purchaseEstimate,unknown:pricing.unpricedPurchaseCopies,owned:pricing.ownedCopies,buildAround:seed.name,commanderReason,legalChecked,complete,withinBudget,issues,warnings:[...new Set([...draft.warnings,...warnings,...issues.map(i=>i.text)])],note,preparedByAsk:true},result:{game:'mtg',ready,partial:!ready,format:f.name,seed:seed.name,commander:lead?.name||'',commanderReason,total:draft.total,target:f.size,lands:draft.lands,legalChecked,withinBudget,budget:limit===Infinity?'no limit':limit,budgetBasis:basis,...pricing,note,warnings:[...new Set([...warnings,...issues.map(i=>i.text)])].slice(0,8)}};
}
