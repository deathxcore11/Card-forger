// The model proposes; this small deterministic contract keeps the player's hard
// choices intact. It deliberately recognizes explicit syntax, not arbitrary prose.
import { DECK_GOALS, inferDeckGoal, normalizeDeckGoal, isDeckBuildRequest } from './ai-deck-goal.js';
import { FORMATS } from './formats.js';
import { cardKey } from './core.js';
import { CREATURE_THEMES, readCreatureTypeRestrictions } from './planner.js';
import { tribePattern, keywordPattern, MTG_VOCABULARY } from './mtg-vocabulary.js';
import {readLoopIntent} from './mtg-combo-packages.js';
import {MTG_CONCEPTS,resolveMtgConcept,readMtgConceptMentions} from './mtg-wiki-knowledge.js';
const LOOP_FIELDS=['requireLoop','loopOutput','unsupportedLoop','loopConflict','clearLoop'];
const text = v => typeof v==='string'?v.trim():'';
const same = (a,b) => cardKey(String(a||''))===cardKey(String(b||''));
const names = rows => [...new Map((Array.isArray(rows)?rows:[]).map(text).filter(Boolean).map(n=>[cardKey(n),n])).values()];
const COLORS={white:'W',blue:'U',black:'B',red:'R',green:'G',colorless:'C'};
const pattern=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const modeledMechanics=MTG_CONCEPTS.filter(c=>c.builderCoverage.status==='modeled'),mechanicIds=new Set(modeledMechanics.map(c=>c.id));
const mechanicAliases=modeledMechanics.flatMap(c=>c.aliases.map(alias=>({alias,id:c.id}))).sort((a,b)=>b.alias.length-a.alias.length);
const mechanicTerms=[...new Set(mechanicAliases.map(c=>c.alias))].map(pattern).join('|'),mechanicPattern='\\b(?:'+mechanicTerms+')\\b';
const removedMechanicPrefix=new RegExp('\\b(?:no|not|without|avoid|remove|drop|clear|stop|skip|don\'t(?: use| want| include)?|do not(?: use| want| include)?)\\s+(?:(?:an?|the|any|that)\\s+)?(?:(?:'+mechanicTerms+')(?:[- ](?:mechanics?|themes?|strategy))?\\s*(?:and|or|/|,)\\s*)*$','i');
const informalAliases=modeledMechanics.filter(c=>c.kind==='informal-mechanic').flatMap(c=>c.aliases).sort((a,b)=>b.length-a.length).map(pattern);
const withoutQuoted=(value,replace)=>String(value).split(/(["“][^"”]*["”])/g).map(part=>/^["“]/.test(part)?part:replace(part)).join('');
const canonicalMechanics=value=>withoutQuoted(value,part=>part.replace(new RegExp(mechanicPattern,'gi'),alias=>resolveMtgConcept(alias)?.id||alias));
function stripRemovedMechanics(value,removed=[]) {
 const aliases=mechanicAliases.filter(c=>removed.includes(c.id)).map(c=>pattern(c.alias));
 if(!aliases.length)return value;
 const re=new RegExp('\\b(?:'+aliases.join('|')+')(?:[- ](?:style|mechanics?|themes?|strategy))?\\b','gi');
 return withoutQuoted(value,part=>part.replace(re,' ')).replace(/\s+/g,' ').trim();
}
function mechanicChanges(value='') {
 const unquoted=String(value).replace(/[’‘]/g,"'").replace(/["“][^"”]*["”]/g,match=>' '.repeat(match.length));
 const removed=new Set();
 for(const match of unquoted.matchAll(new RegExp(mechanicPattern,'gi'))){
  const prefix=unquoted.slice(0,match.index).split(/[.!?;]|\bbut\b/i).at(-1);
  if(removedMechanicPrefix.test(prefix))removed.add(resolveMtgConcept(match[0]).id);
 }
 const positive=readMtgConceptMentions(value).filter(c=>mechanicIds.has(c.id)&&!removed.has(c.id)).map(c=>c.id);
 return {positive,removed:[...removed]};
}
const THEMES=new RegExp('\\b(?:'+informalAliases.join('|')+'|'+CREATURE_THEMES.map(tribePattern).join('|')+'|'+keywordPattern+'|artifacts?|tokens?|life[- ]?gain|landfall|graveyard|spellslinger|counters?)\\b','gi');
const themeKey=s=>resolveMtgConcept(s)?.builderCoverage.status==='modeled'?resolveMtgConcept(s).id:CREATURE_THEMES.find(t=>new RegExp('^'+tribePattern(t)+'$','i').test(s))?.toLowerCase()||MTG_VOCABULARY['keyword-abilities'].find(t=>t.toLowerCase()===s.toLowerCase())?.toLowerCase()||s.toLowerCase().replace(/life[- ]gain/,'lifegain').replace(/s$/,'');
const violations = (code,field,message) => ({code,field,message});
// Only an entirely generic request authorizes automatic card selection. Unknown
// words, quoted names and card directives keep exact-name handling intact.
const GENERIC_BUILD_WORDS=new Set('can could would will you please build make create recommend give me us a an the deck decks using with that is its it s i want need like good easy to play fun casual beginner beginners friendly aggressive aggro mono white blue black red green colorless colourless standard modern pioneer commander edh magic mtg gathering themed theme tribal kindred for under below at most up dollars dollar bucks buck usd budget of total whole no spending cap limit unlimited affordable cheap and idk pick choose select random one be only strictly creature creatures card cards'.split(' '));
const genericBuildLanguage=request=>!/["“”]/.test(request)&&(canonicalMechanics(request).match(/[\p{L}]+/gu)||[]).every(w=>GENERIC_BUILD_WORDS.has(w.toLowerCase())||new RegExp('^(?:'+THEMES.source.replace(/\\b/g,'')+')$','i').test(w));
const genericBuildRequest=request=>isDeckBuildRequest(request)&&/\b(?:white|blue|black|red|green|colou?rless)\b/i.test(request)&&genericBuildLanguage(request);

// A pasted reference guide is not a request for every subtype/keyword that
// happens to describe its suggested cards or alternative commanders. Recognize
// only a conservative Markdown guide shape; unfamiliar/ambiguous prose keeps
// the ordinary path. Scope themes, not the original request or exact hard
// constraints, to the introductory plan and clearly user-directed additions.
function guideThemeRequest(request) {
 const lines=request.split(/\r?\n/),heading=line=>line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
 const headings=lines.map(heading).filter(Boolean);
 const referenceHeading=/^(?:choose (?:your|a|the) commander|commander (?:options|choices|candidates)|(?:core )?(?:deck )?blueprint|(?:deckbuilding|deck building|strategy) guide|featured options|(?:recommended|suggested|example) (?:cards|commanders|decklists|decks))\b/i;
 const examples=lines.filter(line=>/^\s*[-*+]\s+\*\*[^*\n]{2,120}\*\*(?:\s*[:(—-]|\s*&|\s*$)/.test(line));
 if(headings.length<2||examples.length<3||!headings.some(h=>referenceHeading.test(h[1].replace(/\*\*/g,''))))return request;
 const requirements=/^(?:(?:my|our|user|build|deck|hard|explicit|additional|extra)\s+){0,2}(?:requirements?|constraints?|preferences?|request)(?:\s*(?:&|and)\s*(?:requirements?|constraints?|preferences?))?(?:\s*[:—-].*)?$/i;
 const firstHeading=lines.findIndex(line=>heading(line)),title=headings[0][1].replace(/\*\*/g,'');
 // A leading guide title and its introductory paragraph are still the plan.
 // Only skip that first heading boundary, never a reference or requirements
 // section; later body headings do not gain theme authority this way.
 const leadingTitle=lines.slice(0,firstHeading).every(line=>!line.trim())&&!referenceHeading.test(title)&&!requirements.test(title);
 const bodyStart=leadingTitle?lines.findIndex((line,i)=>i>firstHeading&&heading(line)):firstHeading;
 const selected=lines.slice(0,bodyStart);
 const directed=/^(?:(?:please\s+)?(?:build|make|create)\b|(?:i|we)\s+(?:want|need|require|prefer|would like|don't want|do not want)\b|(?:must|only|strictly)\b|use\s+only\b|(?:no|without|avoid|exclude|don't use|do not use)\b)/i;
 let constraintLevel=null;
 for(const line of lines.slice(bodyStart)){
  const h=heading(line);
  if(h){
   const level=line.match(/^\s*(#+)/)[1].length;
   if(constraintLevel!==null&&level<=constraintLevel)constraintLevel=null;
   if(requirements.test(h[1].replace(/\*\*/g,'')))constraintLevel=level;
   continue;
  }
  const plain=line.replace(/^\s*[-*+]\s+(?:\[[ xX]\]\s*)?/,'').replace(/\*\*/g,'').replace(/[’‘]/g,"'").trim();
  if(constraintLevel!==null||directed.test(plain))selected.push(line);
 }
 return selected.join('\n');
}

export function applyUserBuildIntent(input,contract={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))return input;
 const args={budgetMode:'cap',matchMode:'unspecified',creatureTypesOnly:[],excludedSubtypes:[],...input};
 for(const field of ['creatureTypesOnly','excludedSubtypes'])if(contract[field])args[field]=[...contract[field]];
 // Copy trusted, retained player selections rather than paying the model to
 // repeat them. Budget ambiguity and missing-amount choices remain validation.
 for(const field of ['game','format','matchMode','goal','seed','commander','budget','budget_basis','budgetMode','budgetBoundary'])if(contract[field]!==undefined)args[field]=contract[field];
 for(const field of LOOP_FIELDS)if(Object.hasOwn(contract,field))args[field]=contract[field];
 if(contract.colors?.length)args.colors=[...contract.colors];
 if(typeof args.style==='string'&&contract.removedMechanics?.length)args.style=stripRemovedMechanics(args.style,contract.removedMechanics);
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

export function readBuildContract(items=[],retained=null,options={}) {
 const latestIndex=items.findLastIndex(x=>x?.type==='message'&&x.role==='user'&&typeof x.content==='string');
 const request=items[latestIndex]?.content||'';
 if(/^\s*(?:cancel|stop)(?: this| the)?(?: deck| build| request)?[.!]?\s*$/i.test(request))return {request,required_cards:[],excluded_cards:[],colors:[],themes:[],avoid_infinite:false,cancelled:true,provenance:{}};
 const fresh=/\b(?:new|another|different|fresh)\s+(?:(?:\w+[- ]?){0,3})deck\b|\bstart over\b/i.test(request);
 const follow=/^\s*(?:same|keep|instead|make (?:it|that)|change|also|and|with|without|now|but|yes|ok(?:ay)?|allow|remove|drop|exclude|include|use|don't|do not|no|cancel|stop)\b/i.test(request);
 const newBuild=isDeckBuildRequest(request)&&!/^\s*(?:build|make|create)\s+(?:it|that|the same)\b/i.test(request);
 const continuation=!fresh&&(follow||!newBuild);
 const previous=continuation?(retained||(latestIndex>0?readBuildContract(items.slice(0,latestIndex),null,options):null)):null;
 const prior=previous?.cancelled?null:previous;
 const out={request:request.slice(0,600),required_cards:[],excluded_cards:[],colors:[],themes:[],creatureTypesOnly:[],excludedSubtypes:[]};
 if(genericBuildRequest(request))out.autoSelectSeed=true;
 else if(newBuild||prior?.autoSelectSeed&&!genericBuildLanguage(request)||/["“”]|\b(?:build around|include|must have|must use|stars|featuring|led by)\b/i.test(request))out.autoSelectSeed=false;
 if(/\b(?:affordable|cheap|budget[- ]friendly|low[- ]cost|inexpensive|budget deck|doesn['’]t cost (?:that|too) much)\b/i.test(request))out.costConscious=true;
 if(/\b(?:yu[- ]?gi[- ]?oh!?|ygo)\b/i.test(request))out.game='ygo';
 else if(/\b(?:pok[eé]mon|ptcg)\b/i.test(request))out.game='ptcg';
 else if(/\b(?:magic|mtg|edh|commander)\b/i.test(request))out.game='mtg';
 const goal=inferDeckGoal(request);if(goal)out.goal=goal;
 const unquoted=request.replace(/["“][^"”]*["”]/g,'');
 const unlimitedBudget=/\b(?:unlimited\s+(?:budget|spending)|(?:budget|spending)(?:\s+(?:is|of))?\s*[:=]?\s*unlimited)\b/i.test(request);
 const formats=(options.formats?.[out.game||prior?.game||options.game]||FORMATS).filter(f=>f.name!=='Unlimited'||!unlimitedBudget).filter(f=>{const re=new RegExp('\\b'+f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|\\W)','gi');return [...unquoted.matchAll(re)].some(m=>! /\b(?:not|without|rather than)(?: an?)?\s*$/i.test(unquoted.slice(Math.max(0,m.index-24),m.index)));}).sort((a,b)=>b.name.length-a.name.length);
 if(formats.length)out.format=formats[0].name;else if(/\b(?:edh|cedh)\b/i.test(request))out.format='Commander';
 const modes=[...unquoted.matchAll(/\b(?:bo[ -]?([13])|best[ -]of[ -](one|three|1|3))\b/gi)].filter(m=>!/\b(?:not|without|rather than)\s*$/i.test(unquoted.slice(Math.max(0,m.index-24),m.index)));
 if(modes.length){const m=modes.at(-1);out.matchMode=['1','one'].includes((m[1]||m[2]).toLowerCase())?'bo1':'bo3';}
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
 // Spending amounts are caps unless the player explicitly permits flexibility.
 if(amounts.length)out.budgetMode=/\b(?:flexible (?:budget|target)|budget target|approximate budget)\b|\b(?:around|about|roughly|approximately)\s*\$?\s*\d|~\s*\$?\s*\d|\bcan go (?:a little )?over\b/i.test(request)?'target':'cap';
 if(/\b(?:strict|hard) (?:budget|cap)|\b(?:under|below|less than|at most|no more than|up to)\s*\$?\s*\d/i.test(request))out.budgetMode='cap';
 // "Under $20" excludes $20.00; "at most", "up to" and a plain cap include it.
 if(amounts.length)out.budgetBoundary=/\b(?:under|below|less than)\s*\$?\s*\d/i.test(request)&&!/\b(?:at most|no more than|up to|or less|or under)\b/i.test(request)?'exclusive':'inclusive';
 const uncapped=/\b(?:no (?:spending |budget )?(?:limit|cap)|without (?:a )?(?:budget |spending )?(?:limit|cap))\b/i.test(request)||unlimitedBudget||/^\s*unlimited[.!]?\s*$/i.test(request)&&out.format!=='Unlimited';
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
 const colorOnly=[...request.matchAll(/\b(?:only|strictly)\s+(white|blue|black|red|green|colou?rless)\b|\b(white|blue|black|red|green|colou?rless)[- ]only\b/gi)].find(m=>!/\b(?:not|don't want|don’t want|do not want)\s+$/i.test(request.slice(Math.max(0,m.index-25),m.index)));
 const mono=request.match(/\bmono[- ]?(white|blue|black|red|green|colou?rless)\b/i)||(colorOnly?[colorOnly[0],colorOnly[1]||colorOnly[2]]:null);
 if(mono)out.colors=[COLORS[mono[1].toLowerCase().replace('colourless','colorless')]];
 else {
  const pair=request.match(/\b(white|blue|black|red|green)(?:\s*(?:and|\/|[-+])\s*(?:white|blue|black|red|green)){1,4}\b/i);
  if(pair)out.colors=[...new Set(pair[0].toLowerCase().match(/white|blue|black|red|green/g).map(c=>COLORS[c]))];
  else {const single=request.match(/\b(white|blue|black|red|green|colou?rless)\s+(?:(?:Standard|Modern|Pioneer|Commander|Legacy|Vintage|Pauper)\s+)?(?:deck|commander deck)\b/i)||request.match(/\b(?:deck|decks)\b[^.!?;]{0,80}?\b(?:for|in)\s+(white|blue|black|red|green|colou?rless)\b/i);if(single)out.colors=[COLORS[single[1].toLowerCase().replace('colourless','colorless')]];}
 }
 for(const m of request.matchAll(/\b(?:must include|must have|include|keep|build around)\s+["“]([^"”]{1,120})["”]/gi))out.required_cards.push(m[1]);
 for(const m of request.matchAll(/\b(?:exclude|without|no|don't use|do not use|avoid)\s+["“]([^"”]{1,120})["”]/gi))out.excluded_cards.push(m[1]);
 const commander=request.match(/\b(?:commander(?: is|:)?|led by)\s+["“]([^"”]{1,120})["”]/i);if(commander)out.commander=commander[1];
 const comboText=request.replace(/["“][^"”]*["”]/g,'');
 if(/\b(?:no|without|avoid|don't (?:use|include|want|allow|permit)|do not (?:use|include|want|allow|permit))\s+(?:(?:any|all)\s+)?infinite(?:[ -](?:combos?|loops?))?\b/i.test(comboText))out.avoid_infinite=true;
 else if(/\b(?:(?:allow|permit)\s+infinite(?: combos?| loops?)?|infinite (?:combos?|loops?) (?:are )?(?:fine|ok(?:ay)?|allowed)|(?:remove|drop|relax)\s+(?:the |that )?(?:no[ -])?infinite(?:[ -](?:combo|loop)s?)?(?: restriction)?)\b/i.test(comboText)&&! /\b(?:don't|do not|not)\s+allow\b/i.test(comboText))out.avoid_infinite=false;
 // Preserve explicit themes, while keeping a recognized guide's named
 // examples and alternative packages from becoming mandatory AND themes.
 const themeRequest=guideThemeRequest(request);
 const positive=themeRequest.replace(/["“][^"”]*["”]/g,'').replace(/\b(?:build around|around|include|must have|must use|featuring|led by|commander is)\s+([^,;.!]+?)(?=\s+(?:with|under|for|budget)\b|[,;.!]|$)/gi,(full,named)=>genericBuildLanguage(named)?full:' ').replace(/\b(?:no|without|avoid)\s+[^,.;]*(?=[,.;]|$)/gi,'');
 out.themes=[...new Set((positive.match(THEMES)||[]).map(themeKey))];
 const mechanicChange=mechanicChanges(themeRequest);
 out.themes=[...new Set([...out.themes.filter(t=>!mechanicIds.has(t)),...mechanicChange.positive])];
 const removedMechanics=new Set([...(prior?.removedMechanics||[]),...mechanicChange.removed]);
 for(const id of mechanicChange.positive)removedMechanics.delete(id);
 out.removedMechanics=[...removedMechanics];
 Object.assign(out,readCreatureTypeRestrictions(request));
 out.themes=[...new Set([...out.themes,...out.creatureTypesOnly.map(themeKey)])];
 out.required_cards=names(out.required_cards);out.excluded_cards=names(out.excluded_cards);
 const merged={...prior,...out,continuation:!!prior,provenance:{...prior?.provenance}};
 // Retain only user-authored constraints. Prior assistant prose and model
 // defaults are never parsed as requirements, including the combo boolean.
 const negatedOnly=prior?.creatureTypesOnly?.some(type=>new RegExp('\\b(?:not|don[\u2019\']t want|do not want)\\s+(?:(?:an?|the)\\s+)?(?:only\\s+'+tribePattern(type)+'|'+tribePattern(type)+'[- ]only)\\b','i').test(request));
 const anyCreatures=/\bany (?:creatures?|creature types?)\b|\b(?:remove|drop|clear)\s+all\s+creature(?:[- ]type)?\s+restrictions?\b/i.test(request),relaxTypes=anyCreatures||negatedOnly||/\b(?:remove|drop|relax|clear)\s+(?:(?:the|that|my)\s+)?(?:[\p{L} -]+[- ]only\s+(?:restriction|requirement)|creature[- ]type\s+(?:restriction|requirement)|type\s+(?:restriction|requirement))/iu.test(request);
 for(const field of ['required_cards','excluded_cards','colors','themes','creatureTypesOnly','excludedSubtypes'])if(!out[field].length&&prior?.[field]&&!(field==='creatureTypesOnly'&&relaxTypes||field==='excludedSubtypes'&&anyCreatures))merged[field]=[...prior[field]];
 // Adding or removing a mechanic revises that part of the retained request;
 // it does not erase an independently requested tribe, budget or colors.
 if(prior&&out.themes.length&&out.themes.every(t=>mechanicIds.has(t)))merged.themes=[...new Set([...(prior.themes||[]),...out.themes])];
 merged.themes=merged.themes.filter(t=>!removedMechanics.has(t));
 if(mechanicChange.positive.length||mechanicChange.removed.length)delete merged.style;
 merged.themes=merged.themes.filter(t=>!merged.excludedSubtypes.some(ex=>ex.toLowerCase()===t));
 for(const field of ['required_cards','excluded_cards'])merged[field]=names([...(prior?.[field]||[]),...out[field]]);
 if(/\b(?:remove|drop|clear) (?:all |the )?exclusions\b|\bno exclusions\b/i.test(request))merged.excluded_cards=[];
 for(const m of request.matchAll(/\b(?:allow|remove (?:the )?exclusion(?: for)?)\s+["“]([^"”]+)["”]/gi))merged.excluded_cards=merged.excluded_cards.filter(n=>!same(n,m[1]));
 if(/\b(?:any colors?|no colou?r restriction|remove (?:the )?colou?r restriction)\b/i.test(request))merged.colors=[];
 // Permission to use a loop is not a requirement to build one. Removing a
 // negative ban also must not erase a separately retained positive outcome.
 const loopText=request.replace(/\b(?:(?:allow|permit)\s+(?:any\s+)?infinite(?:\s+(?:combos?|loops?))?|infinite\s+(?:combos?|loops?)\s+(?:are\s+)?(?:fine|ok(?:ay)?|allowed)|(?:remove|drop|relax)\s+(?:(?:the|that|my)\s+)?no[- ]infinite(?:[- ](?:combo|loop)s?)?(?:\s+(?:restriction|ban|rule))?)\b/gi,(full,offset)=>{
  if(/\b(?:no|not|without|avoid|don't|don’t|do not)\b(?:\s+[a-z’'-]+){0,6}\s*$/i.test(request.slice(Math.max(0,offset-60),offset)))return full;
  out.avoid_infinite=false;return ' ';
 });
 const loop=readLoopIntent(loopText);
 if(loop.hasLoopNegation)out.avoid_infinite=loop.avoidInfinite===true||prior?.avoid_infinite===true;
 merged.avoid_infinite=out.avoid_infinite??prior?.avoid_infinite??false;
 const explicitRelax=loop.clearLoop,loopSpecified=loop.requireLoop||loop.unsupportedLoop||loop.loopConflict||explicitRelax;
 for(const field of LOOP_FIELDS)merged[field]=loopSpecified?loop[field]:prior?.[field]??(field==='loopConflict'||field==='clearLoop'?false:null);
 if(explicitRelax){merged.requireLoop=null;merged.loopOutput=null;merged.unsupportedLoop=loop.unsupportedLoop??null;merged.loopConflict=false;merged.clearLoop=true;}
 merged.loopConflict=loop.loopConflict===true||!!(merged.requireLoop&&merged.avoid_infinite);
 if(merged.budget!==undefined)delete merged.budgetUnspecified;
 if(out.budget!==undefined&&(amounts.length||uncapped)&&!out.ambiguousBudget){delete merged.ambiguousBudget;if(!out.zeroBudget)delete merged.zeroBudget;}
 if(merged.budget_basis==='owned')delete merged.zeroBudget;
 for(const field of ['game','format','matchMode','goal','commander','budget','budget_basis','budgetMode','budgetBoundary','avoid_infinite','required_cards','excluded_cards','colors','themes','creatureTypesOnly','excludedSubtypes'])if(out[field]!==undefined&&(!Array.isArray(out[field])||out[field].length)&&!(field==='budget'&&!amounts.length&&!uncapped))merged.provenance[field]={source:'user',turn:latestIndex,text:request.slice(0,600)};
 if(relaxTypes)merged.provenance.creatureTypesOnly={source:'user',turn:latestIndex,text:request.slice(0,600)};
 if(anyCreatures)merged.provenance.excludedSubtypes={source:'user',turn:latestIndex,text:request.slice(0,600)};
 if(loopSpecified)for(const field of LOOP_FIELDS)merged.provenance[field]={source:'user',turn:latestIndex,text:request.slice(0,600)};
 if(mechanicChange.positive.length||mechanicChange.removed.length)merged.provenance.removedMechanics={source:'user',turn:latestIndex,text:request.slice(0,600)};
 return merged;
}

export function validateBuildProposal(input,contract={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,args:{},violations:[violations('arguments','request','Send a complete deck request object.')]};
 const args={...input},errors=[];
 for(const field of ['creatureTypesOnly','excludedSubtypes']){
  if(args[field]!==undefined&&(!Array.isArray(args[field])||args[field].length>8||args[field].some(t=>!CREATURE_THEMES.includes(t))))errors.push(violations('invalid_types',field,'Use at most eight exact creature subtypes.'));
  args[field]=Array.isArray(args[field])?args[field]:[];
  for(const type of contract[field]||[])if(!args[field].includes(type))errors.push(violations('changed_constraint',field,`Keep the requested ${type} type restriction.`));
 }
 args.budgetMode=contract.budgetMode||args.budgetMode||'cap';
 // The player's wording sets the cap boundary; a proposal cannot change it.
 if(contract.budgetBoundary)args.budgetBoundary=contract.budgetBoundary;else if(args.budgetBoundary!==undefined)args.budgetBoundary=args.budgetBoundary==='exclusive'?'exclusive':'inclusive';
 if(!['cap','target'].includes(args.budgetMode))errors.push(violations('invalid_budget_mode','budgetMode','Use a strict cap or an explicitly flexible target.'));
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
 args.matchMode=args.matchMode??'unspecified';if(!['unspecified','bo1','bo3'].includes(args.matchMode))errors.push(violations('invalid_match_mode','matchMode','Use unspecified, bo1, or bo3; do not infer a match mode.'));
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
 for(const field of LOOP_FIELDS)if(Object.hasOwn(contract,field)){
  if(Object.hasOwn(input,field)&&!same(input[field],contract[field]))errors.push(violations('changed_constraint',field,`Keep the requested ${field}.`));
  args[field]=contract[field];
 }
 args.requireLoop=args.requireLoop??null;args.loopOutput=args.loopOutput??null;args.unsupportedLoop=args.unsupportedLoop??null;args.loopConflict=args.loopConflict===true||!!(args.requireLoop&&args.avoid_infinite);args.clearLoop=args.clearLoop===true;
 if(args.requireLoop!==null&&args.requireLoop!=='infinite-mana')errors.push(violations('invalid_loop','requireLoop','Only a reviewed infinite-mana requirement is supported.'));
 if(args.loopOutput!==null&&!['W','U','B','R','G','C','any-color'].includes(args.loopOutput))errors.push(violations('invalid_loop','loopOutput','Choose a known mana output.'));
 if(args.unsupportedLoop!==null&&(typeof args.unsupportedLoop!=='string'||args.unsupportedLoop.length>1000))errors.push(violations('invalid_loop','unsupportedLoop','Use the app’s bounded loop clarification.'));
 for(const field of ['game','format','matchMode','goal','commander','seed','budget','budget_basis','budgetMode','style'])if(contract[field]!==undefined&&!same(args[field],contract[field]))errors.push(violations('changed_constraint',field,`Keep the requested ${field}: ${contract[field]}.`));
 if(contract.avoid_infinite&&!args.avoid_infinite)errors.push(violations('changed_constraint','avoid_infinite','Keep the requested no-infinite-combos constraint.'));
 if(contract.colors?.length&&[...args.colors].sort().join('')!==[...contract.colors].sort().join(''))errors.push(violations('changed_constraint','colors',`Keep the requested colors: ${contract.colors.join(', ')}.`));
 for(const field of ['required_cards','excluded_cards'])for(const n of contract[field]||[])if(!(field==='required_cards'&&[args.seed,args.commander].some(c=>same(c,n)))&&!args[field].some(c=>same(c,n)))errors.push(violations('changed_constraint',field,`Keep ${n} in ${field}.`));
 for(const n of [...args.required_cards,args.seed,args.commander].filter(Boolean))if(args.excluded_cards.some(c=>same(c,n)))errors.push(violations('conflicting_cards','excluded_cards',`${n} cannot be both required and excluded.`));
 const styleThemes=(args.style.match(THEMES)||[]).map(themeKey);
 for(const theme of contract.themes||[])if(!styleThemes.includes(theme))errors.push(violations('changed_constraint','style',`Preserve the requested ${theme} theme in style.`));
 for(const id of contract.removedMechanics||[])if(readMtgConceptMentions(args.style).some(c=>c.id===id))errors.push(violations('changed_constraint','style',`Do not restore the removed ${id} mechanic.`));
 return {ok:!errors.length,args,violations:errors,requiresChoice:!!(contract.zeroBudget||contract.ambiguousBudget||errors.some(e=>e.code==='unrequested_budget'))};
}

export function lockBuildContract(args,original={}) {
 // Once a valid proposal has been accepted, the only revision input is a small
 // list of candidate identities. It cannot buy success by relaxing constraints.
 return {...original,...Object.fromEntries(['game','format','matchMode','goal','style','seed','commander','budget','budget_basis','budgetMode','budgetBoundary','avoid_infinite',...LOOP_FIELDS].map(k=>[k,args[k]])),creatureTypesOnly:[...args.creatureTypesOnly],excludedSubtypes:[...args.excludedSubtypes],required_cards:[...args.required_cards],excluded_cards:[...args.excluded_cards],colors:[...args.colors]};
}
export function proposalFeedback(check,{terminal=false}={}) {
 const budgetChoice=check.violations.some(v=>v.code==='unrequested_budget');
 return {ready:false,terminal,requiresCorrection:!terminal,requiresChoice:terminal,reviewAvailable:false,violations:check.violations,
  ...(budgetChoice?{choice:'budget',userNote:'What spending limit would you like? “Affordable” does not specify an amount. Choose a budget and I’ll keep your deck request.'}:{userNote:terminal?'I need a clarification before building: '+check.violations.map(v=>v.code==='changed_constraint'?v.message:'Please rephrase the '+v.field.replaceAll('_',' ')+'.').join(' '):'I could not match that request yet. Please name the format, budget, or card you want to keep.'}),
  note:check.violations.map(v=>v.message).join(' ').slice(0,950)+(terminal?' Nothing was saved.':' Correct only these fields once; do not relax the player’s request. Nothing was saved.')};
}
