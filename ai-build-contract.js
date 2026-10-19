// The model proposes; this small deterministic contract keeps the player's hard
// choices intact. It deliberately recognizes explicit syntax, not arbitrary prose.
import { DECK_GOALS, inferDeckGoal, normalizeDeckGoal } from './ai-deck-goal.js';
import { FORMATS } from './formats.js';
import { cardKey } from './core.js';
const text = v => typeof v==='string'?v.trim():'';
const same = (a,b) => cardKey(String(a||''))===cardKey(String(b||''));
const names = rows => [...new Map((Array.isArray(rows)?rows:[]).map(text).filter(Boolean).map(n=>[cardKey(n),n])).values()];
const COLORS={white:'W',blue:'U',black:'B',red:'R',green:'G',colorless:'C'};
const THEMES=/\b(?:dragons?|goblins?|zombies?|elves|elf|slivers?|artifacts?|tokens?|lifegain|landfall|graveyard|spellslinger|vampires?|angels?|dinosaurs?|merfolk)\b/gi;
const themeKey=s=>s.toLowerCase().replace(/elves|elf/,'elf').replace(/s$/,'');
const violations = (code,field,message) => ({code,field,message});
// Only an entirely generic request authorizes automatic card selection. Unknown
// words, quoted names and card directives keep exact-name handling intact.
const GENERIC_BUILD_WORDS=new Set('can could would will you please build make create me us a an the deck decks using with that is its it s i want good easy to play fun casual beginner beginners friendly aggressive aggro mono white blue black red green colorless colourless standard modern pioneer commander edh magic mtg gathering themed theme tribal kindred for under below at most up dollars dollar bucks buck usd budget of total whole no spending cap limit unlimited affordable cheap and idk pick choose select random one be'.split(' '));
const genericBuildLanguage=request=>!/["“”]/.test(request)&&(request.match(/[\p{L}]+/gu)||[]).every(w=>GENERIC_BUILD_WORDS.has(w.toLowerCase())||new RegExp('^(?:'+THEMES.source.replace(/\\b/g,'')+')$','i').test(w));
const genericBuildRequest=request=>/\b(?:build|make|create)\b[^.!?]*\bdeck\b/i.test(request)&&/\b(?:white|blue|black|red|green|colou?rless)\b/i.test(request)&&genericBuildLanguage(request);

export function applyUserBuildIntent(input,contract={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))return input;
 const args={...input};
 // Copy trusted, retained player selections rather than paying the model to
 // repeat them. Budget ambiguity and missing-amount choices remain validation.
 for(const field of ['game','format','goal','seed','commander','budget','budget_basis'])if(contract[field]!==undefined)args[field]=contract[field];
 if(contract.colors?.length)args.colors=[...contract.colors];
 if(typeof args.style==='string'&&contract.themes?.length){const missing=contract.themes.filter(t=>!(args.style.match(THEMES)||[]).map(themeKey).includes(t));if(missing.length)args.style=[...missing,args.style].join(' ').slice(0,120);}
 const explicit=names([contract.seed,contract.commander,...(contract.required_cards||[])]);
 const bareTheme=n=>typeof n==='string'&&contract.themes?.includes(themeKey(n.trim()))&&!explicit.some(e=>same(e,n))&&!/["“”]/.test(contract.request||'');
 const automatic=contract.autoSelectSeed===true&&args.game==='mtg';
 const optional=[];
 for(const field of ['seed','commander'])if(typeof args[field]==='string'&&args[field]&&(automatic&&!explicit.some(n=>same(n,args[field]))||bareTheme(args[field]))){if(!bareTheme(args[field]))optional.push(args[field]);args[field]='';}
 if(Array.isArray(args.required_cards))args.required_cards=args.required_cards.filter(n=>{if(explicit.some(e=>same(e,n)))return true;if(automatic||bareTheme(n)){if(!bareTheme(n))optional.push(n);return false;}return true;});
 if(optional.length)args.candidate_cards=names([...(Array.isArray(args.candidate_cards)?args.candidate_cards:[]),...optional]).slice(0,6);
 return args;
}

export function readBuildContract(items=[],retained=null) {
 const latestIndex=items.findLastIndex(x=>x?.type==='message'&&x.role==='user'&&typeof x.content==='string');
 const request=items[latestIndex]?.content||'';
 if(/^\s*(?:cancel|stop)(?: this| the)?(?: deck| build| request)?[.!]?\s*$/i.test(request))return {request,required_cards:[],excluded_cards:[],colors:[],themes:[],avoid_infinite:false,cancelled:true,provenance:{}};
 const fresh=/\b(?:new|another|different|fresh)\s+(?:(?:\w+[- ]?){0,3})deck\b|\bstart over\b/i.test(request);
 const follow=/^\s*(?:same|keep|instead|make (?:it|that)|change|also|and|with|without|now|but|yes|ok(?:ay)?|allow|remove|drop|exclude|include|use|don't|do not|no|cancel|stop)\b/i.test(request);
 const newBuild=/\b(?:build|make|create)\b[^.!?]*\bdeck\b/i.test(request)&&!/^\s*(?:build|make|create)\s+(?:it|that|the same)\b/i.test(request);
 const continuation=!fresh&&(follow||!newBuild);
 const previous=continuation?(retained||(latestIndex>0?readBuildContract(items.slice(0,latestIndex)):null)):null;
 const prior=previous?.cancelled?null:previous;
 const out={request:request.slice(0,600),required_cards:[],excluded_cards:[],colors:[],themes:[]};
 if(genericBuildRequest(request))out.autoSelectSeed=true;
 else if(newBuild||prior?.autoSelectSeed&&!genericBuildLanguage(request)||/["“”]|\b(?:build around|include|must have|must use|stars|featuring|led by)\b/i.test(request))out.autoSelectSeed=false;
 if(/\b(?:affordable|cheap|budget[- ]friendly|low[- ]cost|inexpensive|budget deck|doesn['’]t cost (?:that|too) much)\b/i.test(request))out.costConscious=true;
 if(/\b(?:yu[- ]?gi[- ]?oh!?|ygo)\b/i.test(request))out.game='ygo';
 else if(/\b(?:pok[eé]mon|ptcg)\b/i.test(request))out.game='ptcg';
 else if(/\b(?:magic|mtg|edh|commander)\b/i.test(request))out.game='mtg';
 const goal=inferDeckGoal(request);if(goal)out.goal=goal;
 const unquoted=request.replace(/["“][^"”]*["”]/g,'');
 const formats=FORMATS.filter(f=>{const re=new RegExp('\\b'+f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi');return [...unquoted.matchAll(re)].some(m=>! /\b(?:not|without|rather than)(?: an?)?\s*$/i.test(unquoted.slice(Math.max(0,m.index-24),m.index)));}).sort((a,b)=>b.name.length-a.name.length);
 if(formats.length)out.format=formats[0].name;else if(/\b(?:edh|cedh)\b/i.test(request))out.format='Commander';
 // Only unambiguous whole-deck/purchase amounts are a contract. A per-card cap
 // must not accidentally become the entire deck budget.
 const moneyNumber='(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';
 const afterAmount=m=>request.slice(m.index+m[0].length,m.index+m[0].length+25);
 const negated=m=>/\b(?:not|rather than)\s*$/i.test(request.slice(Math.max(0,m.index-15),m.index));
 const amounts=[...request.matchAll(new RegExp('\\$\\s*('+moneyNumber+')|('+moneyNumber+')\\s*(?:\\$|\\b(?:usd|dollars?|bucks?)\\b)','gi'))]
  .filter(m=>!/(?:per|each|a)\s+card\b/i.test(afterAmount(m))&&!negated(m))
  .map(m=>Number((m[1]||m[2]).replaceAll(',','')));
 // Bare numbers need spending context, never a card/count/time restriction.
 const bareBudget=new RegExp('\\b(?:budget\\s*(?:of|is|:|=)?|under|below|at most|up to)\\s*('+moneyNumber+')','gi');
 for(const m of request.matchAll(bareBudget))if(!negated(m)&&!/^(?:\s*)(?:cards?|copies|lands?|creatures?|spells?|mana|minutes?|hours?|days?|percent|%|per card)\b/i.test(afterAmount(m))&&(/budget/i.test(m[0])||/\b(?:budget|spend|cost|price|dollars?|usd|deck)\b/i.test(request)))amounts.push(Number(m[1].replaceAll(',','')));
 if(new Set(amounts).size===1)out.budget=amounts[0];
 const uncapped=/\b(?:unlimited|no (?:spending |budget )?(?:limit|cap)|without (?:a )?(?:budget |spending )?(?:limit|cap))\b/i.test(request);
 if(uncapped)out.budget=0;
 // A vague "budget deck" is a cost-conscious preference, not consent to an
 // invented $25 (or any other numeric) cap. Follow-ups can retain a prior cap.
 if(out.budget===undefined&&!amounts.length){
  if(prior?.budget!==undefined){out.budget=prior.budget;if(prior.budget_basis)out.budget_basis=prior.budget_basis;}
  else out.budgetUnspecified=true;
 }
 if(out.budget===undefined&&amounts.length)out.ambiguousBudget=true;
 if(/\b(?:owned[- ]only|only (?:the )?cards I (?:already )?(?:own|have)|only (?:my|from my) collection|use (?:only )?what I (?:already )?own)\b/i.test(request))out.budget_basis='owned';
 else if(/\b(?:purchase budget|to buy|new purchases|after (?:my )?owned cards|excluding (?:my )?owned cards)\b/i.test(request))out.budget_basis='purchase';
 else if(/\b(?:total budget|whole[- ]deck|entire deck)\b/i.test(request))out.budget_basis='total';
 else if(out.budget!==undefined&&!out.budget_basis)out.budget_basis=prior?.budget_basis||'total';
 if(amounts.length&&out.budget===0&&out.budget_basis!=='owned'&&!uncapped)out.zeroBudget=true;
 const mono=request.match(/\bmono[- ]?(white|blue|black|red|green|colou?rless)\b/i);
 if(mono)out.colors=[COLORS[mono[1].toLowerCase().replace('colourless','colorless')]];
 else {
  const pair=request.match(/\b(white|blue|black|red|green)(?:\s*(?:and|\/|[-+])\s*(?:white|blue|black|red|green)){1,4}\b/i);
  if(pair)out.colors=[...new Set(pair[0].toLowerCase().match(/white|blue|black|red|green/g).map(c=>COLORS[c]))];
  else {const single=request.match(/\b(white|blue|black|red|green|colorless)\s+(?:deck|commander deck)\b/i);if(single)out.colors=[COLORS[single[1].toLowerCase()]];}
 }
 for(const m of request.matchAll(/\b(?:must include|must have|include|keep|build around)\s+["“]([^"”]{1,120})["”]/gi))out.required_cards.push(m[1]);
 for(const m of request.matchAll(/\b(?:exclude|without|no|don't use|do not use|avoid)\s+["“]([^"”]{1,120})["”]/gi))out.excluded_cards.push(m[1]);
 const commander=request.match(/\b(?:commander(?: is|:)?|led by)\s+["“]([^"”]{1,120})["”]/i);if(commander)out.commander=commander[1];
 const comboText=request.replace(/["“][^"”]*["”]/g,'');
 if(/\b(?:no|without|avoid|don't (?:use|include|want|allow|permit)|do not (?:use|include|want|allow|permit))\s+(?:(?:any|all)\s+)?infinite(?:[ -](?:combos?|loops?))?\b/i.test(comboText))out.avoid_infinite=true;
 else if(/\b(?:(?:allow|permit)\s+infinite(?: combos?| loops?)?|infinite (?:combos?|loops?) (?:are )?(?:fine|ok(?:ay)?|allowed)|(?:remove|drop|relax)\s+(?:the |that )?(?:no[ -])?infinite(?:[ -](?:combo|loop)s?)?(?: restriction)?)\b/i.test(comboText)&&! /\b(?:don't|do not|not)\s+allow\b/i.test(comboText))out.avoid_infinite=false;
 // Preserve common explicit themes even if the proposed AI style drops them.
 const positive=request.replace(/["“][^"”]*["”]/g,'').replace(/\b(?:no|without|avoid)\s+[^,.;]*(?=[,.;]|$)/gi,'');
 out.themes=[...new Set((positive.match(THEMES)||[]).map(themeKey))];
 out.required_cards=names(out.required_cards);out.excluded_cards=names(out.excluded_cards);
 const merged={...prior,...out,continuation:!!prior,provenance:{...prior?.provenance}};
 // Retain only user-authored constraints. Prior assistant prose and model
 // defaults are never parsed as requirements, including the combo boolean.
 for(const field of ['required_cards','excluded_cards','colors','themes'])if(!out[field].length&&prior?.[field])merged[field]=[...prior[field]];
 for(const field of ['required_cards','excluded_cards'])merged[field]=names([...(prior?.[field]||[]),...out[field]]);
 if(/\b(?:remove|drop|clear) (?:all |the )?exclusions\b|\bno exclusions\b/i.test(request))merged.excluded_cards=[];
 for(const m of request.matchAll(/\b(?:allow|remove (?:the )?exclusion(?: for)?)\s+["“]([^"”]+)["”]/gi))merged.excluded_cards=merged.excluded_cards.filter(n=>!same(n,m[1]));
 if(/\b(?:any colors?|no colou?r restriction|remove (?:the )?colou?r restriction)\b/i.test(request))merged.colors=[];
 merged.avoid_infinite=out.avoid_infinite??prior?.avoid_infinite??false;
 if(merged.budget!==undefined)delete merged.budgetUnspecified;
 if(out.budget!==undefined&&(amounts.length||uncapped)&&!out.ambiguousBudget){delete merged.ambiguousBudget;if(!out.zeroBudget)delete merged.zeroBudget;}
 if(merged.budget_basis==='owned')delete merged.zeroBudget;
 for(const field of ['game','format','goal','commander','budget','budget_basis','avoid_infinite','required_cards','excluded_cards','colors','themes'])if(out[field]!==undefined&&(!Array.isArray(out[field])||out[field].length)&&!(field==='budget'&&!amounts.length&&!uncapped))merged.provenance[field]={source:'user',turn:latestIndex,text:request.slice(0,600)};
 return merged;
}

export function validateBuildProposal(input,contract={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,args:{},violations:[violations('arguments','request','Send a complete deck request object.')]};
 const args={...input},errors=[];
 if(args.game!==undefined&&!['mtg','ygo','ptcg'].includes(args.game))errors.push(violations('invalid_game','game','Choose mtg, ygo, or ptcg.'));
 if(contract.budgetUnspecified&&Number(args.budget)>0)errors.push(violations('unrequested_budget','budget','No numeric spending cap was requested. Use budget 0 for no limit, or ask the player to choose a cap; do not invent one.'));
 else if(contract.budgetUnspecified&&contract.costConscious)errors.push(violations('unrequested_budget','budget','The player asked for affordability without an amount. Ask for a numeric spending choice; do not decide what is affordable for them.'));
 if(contract.ambiguousBudget)errors.push(violations('ambiguous_budget','budget','More than one spending amount was given. Ask the player which whole-deck or purchase cap to use.'));
 if(contract.zeroBudget)errors.push(violations('zero_budget','budget','A $0 budget cannot use the unlimited-budget setting. Choose owned-only or a positive spending budget.'));
 for(const [field,max] of [['style',120],['seed',120],['commander',120],['format',80]]){
  if(args[field]!==undefined&&(typeof args[field]!=='string'||args[field].length>max))errors.push(violations('invalid_field',field,`Use a ${field} string no longer than ${max} characters.`));
  args[field]=text(args[field]);
 }
 if(args.budget!==undefined&&(typeof args.budget!=='number'||!Number.isFinite(args.budget)||args.budget<0||args.budget>10000))errors.push(violations('invalid_budget','budget','Use a budget from 0 to 10000 USD. Zero means unlimited unless the budget basis is owned-only.'));
 args.budget=args.budget??0;args.budget_basis=args.budget_basis||'total';
 if(!['total','purchase','owned'].includes(args.budget_basis))errors.push(violations('invalid_basis','budget_basis','Use total, purchase, or owned as the budget basis.'));
 if(args.goal!==undefined&&!DECK_GOALS.includes(args.goal))errors.push(violations('invalid_goal','goal','Choose strongest, theme, fun, chaos, or weak.'));
 args.goal=normalizeDeckGoal(args.goal,args.style);
 for(const [field,max] of [['required_cards',8],['excluded_cards',16],['candidate_cards',6]]){
  if(args[field]!==undefined&&(!Array.isArray(args[field])||args[field].length>max||args[field].some(n=>typeof n!=='string'||!n.trim()||n.length>120)))errors.push(violations('invalid_cards',field,`Use at most ${max} exact card names in ${field}.`));
  args[field]=names(args[field]);
 }
 if(args.colors!==undefined&&(!Array.isArray(args.colors)||args.colors.length>5||args.colors.some(c=>!['W','U','B','R','G','C'].includes(c))))errors.push(violations('invalid_colors','colors','Use W, U, B, R, G, or C as the color constraint, or an empty list.'));
 args.colors=Array.isArray(args.colors)?[...new Set(args.colors)]:[];
 if(args.colors.includes('C')&&args.colors.length>1)errors.push(violations('invalid_colors','colors','Colorless is not a sixth color; use C alone, or the requested colored identity.'));
 if(args.avoid_infinite!==undefined&&typeof args.avoid_infinite!=='boolean')errors.push(violations('invalid_constraint','avoid_infinite','avoid_infinite must be true or false.'));
 args.avoid_infinite=args.avoid_infinite===true;
 // A required schema boolean is not evidence of a player request. Normalize
 // unsolicited restrictions locally so one mistaken default cannot stop a build.
 if(Object.hasOwn(contract,'avoid_infinite'))args.avoid_infinite=contract.avoid_infinite===true;
 for(const field of ['game','format','goal','commander','seed','budget','budget_basis','style'])if(contract[field]!==undefined&&!same(args[field],contract[field]))errors.push(violations('changed_constraint',field,`Keep the requested ${field}: ${contract[field]}.`));
 if(contract.avoid_infinite&&!args.avoid_infinite)errors.push(violations('changed_constraint','avoid_infinite','Keep the requested no-infinite-combos constraint.'));
 if(contract.colors?.length&&[...args.colors].sort().join('')!==[...contract.colors].sort().join(''))errors.push(violations('changed_constraint','colors',`Keep the requested colors: ${contract.colors.join(', ')}.`));
 for(const field of ['required_cards','excluded_cards'])for(const n of contract[field]||[])if(!(field==='required_cards'&&[args.seed,args.commander].some(c=>same(c,n)))&&!args[field].some(c=>same(c,n)))errors.push(violations('changed_constraint',field,`Keep ${n} in ${field}.`));
 for(const n of [...args.required_cards,args.seed,args.commander].filter(Boolean))if(args.excluded_cards.some(c=>same(c,n)))errors.push(violations('conflicting_cards','excluded_cards',`${n} cannot be both required and excluded.`));
 const styleThemes=(args.style.match(THEMES)||[]).map(themeKey);
 for(const theme of contract.themes||[])if(!styleThemes.includes(theme))errors.push(violations('changed_constraint','style',`Preserve the requested ${theme} theme in style.`));
 return {ok:!errors.length,args,violations:errors,requiresChoice:!!(contract.zeroBudget||contract.ambiguousBudget||errors.some(e=>e.code==='unrequested_budget'))};
}

export function lockBuildContract(args,original={}) {
 // Once a valid proposal has been accepted, the only revision input is a small
 // list of candidate identities. It cannot buy success by relaxing constraints.
 return {...original,...Object.fromEntries(['game','format','goal','style','seed','commander','budget','budget_basis','avoid_infinite'].map(k=>[k,args[k]])),required_cards:[...args.required_cards],excluded_cards:[...args.excluded_cards],colors:[...args.colors]};
}
export function proposalFeedback(check,{terminal=false}={}) {
 const budgetChoice=check.violations.some(v=>v.code==='unrequested_budget');
 return {ready:false,terminal,requiresCorrection:!terminal,requiresChoice:terminal,reviewAvailable:false,violations:check.violations,
  ...(budgetChoice?{choice:'budget',userNote:'What spending limit would you like? “Affordable” does not specify an amount. Choose a budget and I’ll keep your deck request.'}:{userNote:terminal?'I need a clarification before building: '+check.violations.map(v=>v.code==='changed_constraint'?v.message:'Please rephrase the '+v.field.replaceAll('_',' ')+'.').join(' '):'I could not match that request yet. Please name the format, budget, or card you want to keep.'}),
  note:check.violations.map(v=>v.message).join(' ').slice(0,950)+(terminal?' Nothing was saved.':' Correct only these fields once; do not relax the player’s request. Nothing was saved.')};
}
