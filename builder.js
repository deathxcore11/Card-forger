import {abilityEndpointRequirements,endpointCandidateMatches,inspectAbilityEndpoints} from './mtg-ability-endpoints.js';
import {primaryInputRequirements,primaryInputQueries,inspectPrimaryInputs} from './mtg-primary-inputs.js';
import {commanderCardConditions, inspectCommanderCardConditions, commanderEngineCoverage} from './mtg-commander-conditions.js';
import {mtgManaSourceProfile} from './mtg-mana-sources.js';
import {setupBurden} from './deck-preferences.js';
import { functionalIn } from "./deck-safety.js";
import { commanderHooks, forgeScore, forgeRoles, forgeTargets, forgeNoise, forgeDiscoveryQueries, forgeLandCount, DECK_TAGS } from './deck-forge.js';
// Format-aware deck generator: builds a full, legal deck around one or more
// seed cards, preferring cards you own and staying inside a purchase budget.
// Works for every constructed format in formats.js (60-card, singleton and
// command-zone formats). Scores are transparent rules of thumb, not predictions.
import { effectiveCopyLimit, cardKey, rulesText, typeText, isLand, isBasic, roles, aggregateCards, sumQty } from "./core.js";
import { engineRoles } from "./insights.js";
import { commanderTheme, creatureTypes, CREATURE_THEMES, tribalSupport, themeSupport, readCreatureTypeRestrictions, fitsTypeRestrictions } from "./planner.js";
import { formatOf, canLead, legalityIn } from "./formats.js";
import { splitBasics } from "./extras.js";
import { goalCardPreference } from "./ai-deck-goal.js";
import { mtgResourceProfile, mtgEffectProfile, mtgSelfConflicts } from "./mtg-effects.js";
import { atLeastOne } from './deckaudit.js';
import { requestedKeywords, tribePattern } from './mtg-vocabulary.js';
import { mtgAbilityEvidence } from './mtg-effects.js';
import { inspectTribalStrategy } from './deck-strategy-plan.js';
import { inspectMechanicPlan, requestedMechanics, mechanicCardMatches, mechanicDiscoveryQueries } from './deck-mechanic-plan.js';
import { readMtgConceptMentions } from './mtg-wiki-knowledge.js';
import { commanderLandRequirements, landSubtypeRoles, hasLandSubtype, inspectLandRequirements, LAND_REQUIREMENT_POLICY } from './mtg-land-requirements.js';

const BASIC = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" };
const BASIC_KEYS = new Set(Object.values(BASIC).map(cardKey));
const THEMES = ["Tokens", "Graveyard", "Spells", "Dragons", "Artifacts", "Lifegain", "Lifelink", "Landfall", "Counters"];
const TIERS = [0, 10, 25, 50, 100, Infinity];
export const BUDGET_TIERS = TIERS;

// Creature types and similar subtypes on a card ("Goblin Warrior" → Goblin, Warrior).
export const subtypes = creatureTypes;

const ident = (c) => c?.color_identity || [];
export const fitsColors = (c, colors) => ident(c).every((x) => colors.includes(x));
// 60-card formats go by what you can actually pay: a hybrid {W/U} needs either colour, {2/W} and
// Phyrexian symbols can be paid without it. Every plain coloured symbol in the cost or the rules
// text still has to be in the deck's colours. Commander keeps colour identity (fitsColors).
export function castableIn(c, colors) {
  const faces = [c, ...(c?.card_faces || [])], text = faces.map((f) => `${f?.mana_cost || ""} ${f?.oracle_text || ""}`).join(" ").replace(/\([^)]*\)/g, "");
  for (const [, sym] of text.matchAll(/\{([^}]+)\}/g)) {
    if (/^[WUBRG]$/.test(sym)) { if (!colors.includes(sym)) return false; continue; }
    if (!sym.includes("/")) continue;
    const parts = sym.split("/");
    if (parts.includes("P") || parts.some((x) => /^\d+$/.test(x))) continue;
    if (!parts.some((x) => colors.includes(x))) return false;
  }
  // Colour indicators (no mana cost, e.g. suspend cards) still need their colours.
  return faces.every((f) => f?.mana_cost || !(f?.colors || []).length || f.colors.every((x) => colors.includes(x)));
}
export const fitsDeck = (c, colors, commander) => (commander ? fitsColors(c, colors) : castableIn(c, colors));

// Keep explicit style independent from inferred commander/seed mechanics.
const THEME_TERMS = {Tokens:'(o:"creature token" or o:populate)',Graveyard:'o:graveyard',Spells:'(t:instant or t:sorcery or o:"instant or sorcery")',Dragons:'t:dragon',Artifacts:'(t:artifact or o:artifact)',Lifegain:'(keyword:lifelink or (o:gain o:life))',Lifelink:'(keyword:lifelink or o:lifelink)',Landfall:'o:landfall',Counters:'(o:"+1/+1 counter" or o:proliferate)'};
const STYLE_ROLES = {token:"Tokens",graveyard:"Graveyard",reanimator:"Graveyard",spells:"Spells",spellslinger:"Spells",artifact:"Artifacts",lifegain:"Lifegain",lifelink:"Lifelink",landfall:"Landfall",counter:"Counters",proliferate:"Counters"};
export function requestedIntent(style = "") {
  const positive=String(style).replace(/[‐‑‒–—]/g,'-').replace(/\b(?:no|without|avoid|don't use|do not use)\s+[^,.;]*(?=[,.;]|$)/gi,' ').replace(new RegExp('\\bnon[- ](?:'+CREATURE_THEMES.map(tribePattern).join('|')+')s?\\b','gi'),' '),
    concepts=readMtgConceptMentions(positive).filter(c=>c.id==='bloodlust'),mechanics=requestedMechanics(positive),
    thematic=concepts.flatMap(c=>c.aliases).sort((a,b)=>b.length-a.length).reduce((s,alias)=>s.replace(new RegExp('\\b'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),' '),positive),
    abilities=requestedKeywords(positive).filter(k=>!['Lifelink','Landfall','Proliferate'].includes(k)),
    matchedTribes=CREATURE_THEMES.filter(t=>new RegExp('\\b'+tribePattern(t)+'\\b','i').test(thematic)),
    stripped=[...abilities,...matchedTribes].reduce((s,k)=>s.replace(new RegExp('\\b'+(matchedTribes.includes(k)?tribePattern(k):k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))+'\\b','gi'),' '),thematic),
    words = stripped.toLowerCase().replace(/life[- ]gain/g,'lifegain').replace(/\+1\/\+1/g,"counter").match(/[\p{L}\p{N}]+/gu) || [],
    noise = new Set("a an the and or with for of in mono white blue black red green colorless deck decks good budget tribal kindred commander build around focused focus theme themed strongest best optimized optimal strong powerful competitive fun casual silly janky jank chaos chaotic weak bad easy easier to play simple simpler beginner friendly prefer preferably only strictly creature creatures card cards infinite unlimited unbounded mana loop loops combo combos".split(" ")),
    terms = [...new Set(words.filter(w => !noise.has(w)).map(w => ({elves:"elf",dwarves:"dwarf",spells:"spells"})[w] || (w.endsWith("s")?w.slice(0,-1):w)))].slice(0,6),
    tribes = matchedTribes,
    roles = [...new Set(terms.map(w => STYLE_ROLES[w]).filter(Boolean))],
    other = terms.filter(w => !STYLE_ROLES[w] && !tribes.some(t => t.toLowerCase() === w));
  return {style:String(style).trim(),tribes,roles,abilities,mechanics,other};
}
const tribeQuery = t => {const v=/^[a-z]+$/i.test(t)?t.toLowerCase():`"${t.toLowerCase()}"`;return `(t:${v} or o:${v})`;};
const roleQuery = roles => {const terms=[...new Set(roles.map(r=>THEME_TERMS[r]).filter(Boolean))];return terms.length===1?terms[0]:terms.length?'('+terms.join(' or ')+')':'';};
export function themeQueries(seed, style = "") {
  const theme = commanderTheme(seed), requested = requestedIntent(style),
    tribes = [...new Set([...requested.tribes,...theme.tribes])],
    explicit = roleQuery(requested.roles),
    support = roleQuery(theme.roles.filter(r=>THEMES.includes(r))),
    other = requested.other.length?'('+requested.other.map(w=>`t:"${w}" or o:"${w}"`).join(' or ')+')':'';
  // Separate requests keep a popular generic support pool from crowding actual
  // payoff subjects out of the provider's first page. No subtype-slot truncation.
  return [...new Set([...mechanicDiscoveryQueries(requested.mechanics,{limit:1}),...(/\bLegendary\b/.test(typeText(seed))?forgeDiscoveryQueries(seed):[]),...requested.tribes.map(tribeQuery),...requested.abilities.map(k=>`keyword:"${k.toLowerCase()}"`),...primaryInputQueries(seed),...abilityEndpointRequirements(seed).filter(r=>r.recognized).map(r=>r.query),explicit,other,...tribes.map(tribeQuery),support].filter(Boolean))];
}
export function themeQuery(seed, style = "") {
  const queries = themeQueries(seed,style);
  return queries.length === 1 ? queries[0] : queries.length ? '('+queries.join(' or ')+')' : '';
}
function seedIntent(seeds, style = "") {
  const requested=requestedIntent(style), themes=seeds.map(commanderTheme);
  return {tokenKinds:[...new Set(themes.flatMap(t=>t.tokenKinds))],tags:[...new Set([...requested.roles,...themes.flatMap(t=>t.roles.filter(r=>THEMES.includes(r)))])],subs:[...new Set([...requested.tribes,...themes.flatMap(t=>t.tribes)])],requested};
}
function styleFit(c, requested) {
  return requested.tribes.some(t=>tribalSupport(c,t)) || requested.abilities.some(k=>mtgAbilityEvidence(c,k).length) || mechanicCardMatches(c,requested.mechanics) || themeSupport(c,{roles:requested.roles}).length > 0 || requested.other.some(w=>new RegExp('\\b'+w+'s?\\b','i').test(typeText(c)+' '+rulesText(c)));
}

// Declared theme-density targets, not universal deck rules: at least 6% of the
// library (2 cards minimum; 6 in a 99-card library) and a 60% chance to see one
// in the first 11 library cards. Access below the target makes the plan partial.
export const THEME_POLICY=Object.freeze({minimumShare:.06,minimumCopies:2,accessTarget:.6});
const themeMinimum=N=>Math.max(THEME_POLICY.minimumCopies,Math.ceil(N*THEME_POLICY.minimumShare));
// Minimum evidence checks, not a universal tribal quota or a power rating.
// Access counts physical cards in the library; commanders are accessible only
// from their zone and token output is never counted as cards drawn.
export function inspectMtgTheme(rows,{style='',commander='',seed='',goal='strongest'}={}) {
  const main=rows.filter(r=>!['side','extra'].includes(r.zone)&&r.card&&r.qty>0),
    lead=main.find(r=>cardKey(r.name||r.card.name)===cardKey(commander))?.card,
    library=main.filter(r=>cardKey(r.name||r.card.name)!==cardKey(commander)),
    N=library.reduce((n,r)=>n+r.qty,0),seen=Math.min(N,11),requested=requestedIntent(style),inferred=commanderTheme(lead),
    tribes=[...new Set([...requested.tribes,...inferred.tribes])],groups=[],issues=[],notes=[],partial=[];
  const check=(label,test,source)=>{
    const matches=library.filter(r=>test(r.card)),copies=matches.reduce((n,r)=>n+r.qty,0),access=N?atLeastOne(N,copies,seen):0;
    groups.push({label,source,copies,library:N,seen,access,cards:matches.map(r=>({name:r.name||r.card.name,qty:r.qty}))});
    // Fewer than two cards cannot form a plan. Below the density target the
    // list stays a reviewable partial draft, never a supported strategy.
    const minimum=themeMinimum(N);
    if(copies<THEME_POLICY.minimumCopies)issues.push(`${label}: only ${copies} supporting library ${copies===1?'card':'cards'} found. The loaded pool does not establish this plan.`);
    else if(copies<minimum){partial.push(label);notes.push(`${label}: ${copies} supporting library cards, below the ${minimum}-card target for a ${N}-card library. This plan is partial, not established.`);}
    else if(access<THEME_POLICY.accessTarget){partial.push(label);notes.push(`${label}: ${Math.round(access*100)}% chance to naturally see support in the first ${seen} cards, below the ${Math.round(THEME_POLICY.accessTarget*100)}% target; access is limited before searches and extra draws.`);}
  };
  for(const tribe of tribes)check(tribe+' plan',c=>tribalSupport(c,tribe),requested.tribes.includes(tribe)?'requested':'commander');
  for(const role of requested.roles)check(role+' plan',c=>themeSupport(c,{roles:[role]}).length>0,'requested');
  // Use the commander's recognized input plan even with no explicit style.
  // Choose one primary route rather than requiring every incidental output.
  if(lead&&!tribes.length&&!requested.roles.length){
    const primary=['Artifacts','Spells','Landfall','Lifegain','Graveyard','Counters','Tokens'].find(role=>inferred.roles.includes(role));
    if(primary)check(primary+' commander plan',c=>themeSupport(c,{roles:[primary],tokenKinds:inferred.tokenKinds}).length>0,'commander');
  }
  for(const ability of requested.abilities)check(ability+' ability',c=>mtgAbilityEvidence(c,ability).length>0,'requested');
  if(requested.roles.includes('Lifegain')){
    const sources=main.filter(r=>mtgEffectProfile(r.card).provides.some(e=>e.tag==='lifegain'));
    if(!sources.length)issues.push('The requested life-gain plan has no recognized source of your own life gain.');
  }
  const unknown=requested.other;
  if(unknown.length)notes.push('Theme terms requiring review: '+unknown.join(', ')+'. Matching text does not verify a franchise or strategic plan.');
  // Commander land-subtype prerequisites are their own gate; generic landfall
  // or token counts can never stand in for them.
  const prerequisites=inspectLandRequirements(rows,{commander});
  for(const g of prerequisites.groups)groups.unshift({label:g.label,source:'commander',copies:g.copies,library:g.library,seen:g.seen,access:g.access,cards:g.sources.cards,summary:g.summary,status:g.status});
  issues.unshift(...prerequisites.issues);notes.push(...prerequisites.notes);
  const cardConditions=inspectCommanderCardConditions(rows,{commander,atLeastOne});
  groups.unshift(...cardConditions.groups);issues.push(...cardConditions.issues);notes.push(...cardConditions.notes);
  if(cardConditions.status==='partial')partial.push('Commander card eligibility');
  const strategy=inspectTribalStrategy(rows,{tribes,commander,goal}),mechanics=inspectMechanicPlan(rows,{abilities:[...new Set([...requested.abilities,...requested.mechanics])],commander,goal});
  let status=issues.length?'insufficient':unknown.length?'unverified':partial.length?'partial':groups.length?'supported':'not-requested';
  if(cardConditions.status==='unverified'&&!issues.length)status='unverified';
  // Keep complete drafts reviewable, but two incidental tribal cards cannot
  // acquire a verified-theme claim from the old minimum sanity check.
  if(status==='supported'&&requested.tribes.length&&strategy.status!=='supported')status=strategy.status==='unverified'?'unverified':'partial';
  if(requested.mechanics.length&&!issues.length&&!unknown.length){if(status==='not-requested')status=mechanics.status;else if(mechanics.status!=='supported')status=mechanics.status==='unverified'?'unverified':'partial';}
  const primaryInputs=inspectPrimaryInputs(rows,{commander,seed});
  notes.push(...primaryInputs.notes);
  if(primaryInputs.status==='missing'&&!issues.length)status='insufficient';
  else if(['conditional','unverified'].includes(primaryInputs.status)&&!issues.length&&status==='supported')status='partial';
  const engineCoverage=commanderEngineCoverage(lead,{hasPlan:inferred.tribes.length>0||inferred.roles.some(r=>THEMES.includes(r))||cardConditions.groups.length>0||prerequisites.groups.length>0});
  notes.push(...engineCoverage.notes);
  if(engineCoverage.status==='unverified'&&!issues.length&&primaryInputs.status!=='missing')status='unverified';
  if(requested.tribes.length&&strategy.status!=='supported')notes.push(...strategy.issues,...strategy.notes);
  if(requested.mechanics.length)notes.push(...mechanics.issues,...mechanics.notes);
  return {status,groups,issues,notes,strategy,mechanics,prerequisites,cardConditions,engineCoverage,primaryInputs,unverifiedTerms:unknown,method:(prerequisites.method?prerequisites.method+' ':'')+'Theme support needs at least 6% of the library (minimum 2 cards) and 60% access in the first 11 cards; that is a density check, not proof of a working engine. Requested tribal and mapped mechanic plans also report their prerequisites, conditional connections and library access; partial coverage remains a reviewable draft, not verified strategy or competitive strength.'};
}

// Candidate heuristics, not optimization of the complete Power analysis.
// A mana role earns credit for demonstrated net output relative to setup cost.
export function candidateRampWeight(c) {
  const p=mtgResourceProfile(c), effects=p.effects.filter(e=>e.acceleration && e.controller === "self");
  if(!effects.length)return 0;
  return Math.max(...effects.map(e=>{
    const output=Math.max(1,Number(e.netMana)||Number(e.netLands)||0), setup=(p.castManaValue||0)+(e.activationMana||0)+(e.equipMana||0);
    return Math.min(1,(1+output)/Math.max(1,setup))*(e.status === "conditional"?.7:1);
  }));
}
// How well a candidate fits the seed and a working deck. Higher is better.
export function scoreCard(c, seedTags, seedSubs, { free = 0, size = 60, tokenKinds, goal = "strongest" } = {}) {
  const e = engineRoles(c),
    cmc = Number(c.cmc) || 0,
    rank = size >= 100 ? c.edhrec_rank || null : null;
  let s = 0;
  s += themeSupport(c,{roles:seedTags,tokenKinds}).length * 3;
  s += subtypes(c).filter((x) => seedSubs.includes(x)).length * 4;
  if (seedSubs.some((x) => new RegExp("\\b" + x + "s?\\b", "i").test(rulesText(c)))) s += 2;
  if (goal !== "weak" && e.includes("Removal")) s += 2.5;
  if (goal !== "weak" && e.includes("Draw")) s += 1.5;
  if (goal !== "weak" && e.includes("Ramp")) s += (size >= 100 ? 2 : 0.5)*candidateRampWeight(c);
  if (goal !== "weak" && e.includes("Wipe")) s += size >= 100 ? 1.5 : 0.5;
  if (/\bCreature\b/.test(typeText(c))) s += 1;
  s -= Math.max(0, cmc - (size >= 100 ? 4 : 3)) * 1.4;
  if (goal !== "weak" && rank) s += Math.max(0, 3.5 - Math.log10(rank));
  // Ownership already reduces purchase cost; it must not overwhelm engine quality.
  if (free) s += 0.5;
  return s;
}

/**
 * Build one deck.
 * opts: format, seeds (card objects), base (existing {name, qty} rows to keep), catalog,
 *       available(name) → free copies you own, price(card) → USD or null,
 *       budget (USD for cards you must buy), colors (optional override)
 */
export function buildDeck(opts) {
  const first = buildDeckOnce(opts);
  if (Number.isInteger(opts?.landCount) || opts?.completionFirst) return first;
  const wanted = first.forge?.landsWanted;
  if (!Number.isInteger(wanted) || wanted === first.lands) return first;
  const second = buildDeckOnce({ ...opts, landCount: wanted });
  return second.open <= first.open ? second : first;
}
function buildDeckOnce({ format, seeds = [], base = [], catalog, available = () => 0, price = (c) => null, budget = Infinity, colors = null, commander = null, completionFirst = false, easy = false, preferred = () => 0, requestedStyle = "", goal = "strongest", suggestedCards = [], excludedCards = [], creatureTypesOnly, excludedSubtypes, power = null, variation = "tight", forgeSeed = "", landCount = null }) {
  const f = formatOf(format);
  if (f.id === "limited") throw Error("Limited decks come from the cards you open — build those by hand.");
  if ((!Number.isFinite(budget) && budget!==Infinity) || budget < 0) throw Error("Enter a budget of $0 or more.");
  const size = f.size,
    lead = f.commander ? commander || seeds.find((s) => canLead(s, f)) : null;
  if (f.commander && !lead) throw Error(`${f.name} decks need a card that can lead them (${f.commander === "planeswalker" ? "a planeswalker" : "a legendary creature"}).`);
  const parsedTypes=readCreatureTypeRestrictions(requestedStyle),restrictions={creatureTypesOnly:[...new Set(creatureTypesOnly===undefined?parsedTypes.creatureTypesOnly:creatureTypesOnly)],excludedSubtypes:[...new Set(excludedSubtypes===undefined?parsedTypes.excludedSubtypes:excludedSubtypes)]};
  if(lead&&!fitsTypeRestrictions(lead,restrictions))throw Error(`${lead.name} does not satisfy the requested creature-type restriction. Choose another commander or revise that restriction.`);
  const excludedKeys=new Set(excludedCards.map(cardKey)),
    legalStatus = (c) => legalityIn(c, f),
    isLegal = (c) => (!BASIC_KEYS.has(cardKey(c?.name)) || isBasic(c)&&isLand(c)) && !excludedKeys.has(cardKey(c?.name)) && fitsTypeRestrictions(c,restrictions) && functionalIn(c,f) && (!f.legality || ["legal", "restricted"].includes(legalStatus(c))),
    maxCopies = (c) => effectiveCopyLimit(c,f);
  // Colors: the leader's identity, else the seeds', else the base list's.
  let deckColors = colors || (lead ? ident(lead) : [...new Set([...seeds, ...base.map((b) => catalog[cardKey(b.name)])].flatMap(ident))]);
  if (!deckColors.length) deckColors = ["C"];
  const intent = seedIntent([...seeds,...(lead&&!seeds.includes(lead)?[lead]:[])],requestedStyle),
    seedTags = intent.tags,
    seedSubs = intent.subs,
    rows = new Map(),
    warnings = [];
  let spent = 0,
    unknown = 0;
  const qtyOf = (c) => rows.get(cardKey(c.name))?.qty || 0,
    unitCost = (c) => {const p=c && (c.type_line || c.card_faces?.length)?price(c):null;return typeof p === "number" && Number.isFinite(p) && p>=0?p:null;},
    stock = name => Math.max(0,Math.floor(Number(available(name))||0)),
    // Cost of going from `have` to `want` copies, after using free owned copies.
    costFor = (c, have, want) => {
      const free = Math.max(0, stock(c.name) - have),
        buy = Math.max(0, want - have - free),
        p = unitCost(c);
      return buy ? (p === null ? Infinity : buy * p) : 0;
    },
    put = (c, n, why) => {
      const have=qtyOf(c),buy=Math.max(0,n-Math.max(0,stock(c.name)-have)),p=unitCost(c);
      if(buy && p===null)unknown+=buy;else if(buy)spent+=buy*p;
      const r = rows.get(cardKey(c.name));
      if (r) r.qty += n;
      else rows.set(cardKey(c.name), { name: c.name, qty: n, why });
    },
    count = () => [...rows.values()].reduce((a, r) => a + r.qty, 0),
    landsIn = () => [...rows.values()].filter((r) => isLand(catalog[cardKey(r.name)])).reduce((a, r) => a + r.qty, 0);

  if (sumQty(base)>size) throw Error(`This list has ${sumQty(base)} cards. Review ${sumQty(base)-size} cuts before building to the ${size}-card target.`);
  // Keep everything already in the list.
  for (const b of aggregateCards(base)) {
    const c = catalog[cardKey(b.name)];
    if(!fitsTypeRestrictions(c,restrictions))throw Error(`${b.name} does not satisfy the requested creature-type restriction or its card types are unverified.`);
    if(c && !isLegal(c))throw Error(`${b.name} is illegal or nonfunctional in ${f.name}. Replace it before completing the list.`);
    if(c && b.qty>maxCopies(c))throw Error(`${b.name} exceeds this format’s copy limit. Review your list first.`);
    put(c || { name: b.name }, b.qty, "Already in your list");
  }
  // Deck Forge targets (deck-forge-tags.js): 38 lands in Commander, interaction,
  // card advantage and ramp quotas, and the commander's own theme hooks.
  const forgeT = forgeTargets(f), forgeLead = lead || seeds[0] || null, hooks = commanderHooks(forgeLead, { size });
  // First pass starts from the rule of thumb (38 in Commander); the finished
  // list then sets its own count (forgeLandCount) and the deck is rebuilt once.
  const landTarget = Math.max(Number.isInteger(landCount) ? landCount : f.commander && size >= 100 ? forgeT.lands : Math.round(size * 0.4) - (f.commander ? 1 : 0), landsIn()),
    spellTarget = size - landTarget;
  if (lead && !qtyOf(lead)) {
    put(lead, 1, "Leads the deck");
  }

  const basicColors=deckColors.filter(k=>k!=="C"),basicNames=(basicColors.length?basicColors:["C"]).map(k=>BASIC[k]),
    verifiedBasics=basicNames.map(name=>catalog[cardKey(name)]).filter(c=>c && isBasic(c) && isLegal(c) && fitsColors(c,deckColors)),
    manaReserve=()=>{
      const left=Math.max(0,landTarget-landsIn()),free=verifiedBasics.reduce((n,c)=>n+Math.max(0,stock(c.name)-qtyOf(c)),0),quotes=verifiedBasics.map(unitCost).filter(p=>p!==null);
      return Math.max(0,left-free)*(quotes.length?Math.max(...quotes):0);
    },
    canAfford=(extra,reserve=0,keepMana=true)=>budget===Infinity || extra===0 || (unknown===0 && extra!==Infinity && spent+extra+reserve+(keepMana?manaReserve():0)<=budget+1e-6);
  // Commander land-subtype prerequisites (a Desert entering, Deserts in the
  // graveyard) get their land slots and budget before any spell is chosen.
  // Lands that make the deck's colors come first; colorless-only ones are
  // capped so the reserved package still leaves a castable mana base.
  const landNeeds=commanderLandRequirements(lead||seeds[0]),needPolicy=size>=100?LAND_REQUIREMENT_POLICY.commander:LAND_REQUIREMENT_POLICY.constructed;
  for(const need of landNeeds){
    const makes=c=>mtgManaSourceProfile(c,{commanderIdentity:lead?.color_identity}).colors.filter(m=>deckColors.includes(m)).length,tapped=c=>/enters tapped/i.test(rulesText(c))?1:0;
    const choices=[...new Map(Object.values(catalog).filter(c=>c?.name&&isLand(c)&&!isBasic(c)&&isLegal(c)&&fitsColors(c,deckColors)&&hasLandSubtype(c,need.subtype)).map(c=>[cardKey(c.name),c])).values()]
      .sort((a,b)=>makes(b)-makes(a)||tapped(a)-tapped(b)||stock(b.name)-stock(a.name)||(f.commander?(a.edhrec_rank||1e9)-(b.edhrec_rank||1e9):0)||a.name.localeCompare(b.name));
    const colorlessCap=Math.floor(landTarget*LAND_REQUIREMENT_POLICY.colorlessShare);let placed=0,colorless=0;
    for(const c of choices){
      if(placed>=needPolicy.target||landsIn()>=landTarget)break;
      if(!makes(c)&&colorless>=colorlessCap)continue;
      const n=Math.min(maxCopies(c)-qtyOf(c),needPolicy.target-placed,landTarget-landsIn());
      for(let k=n;k>=1;k--)if(canAfford(costFor(c,qtyOf(c),qtyOf(c)+k))){put(c,k,`${need.subtype} for ${lead?.name||seeds[0]?.name}`);placed+=k;if(!makes(c))colorless+=k;break;}
    }
    if(placed<needPolicy.minimum)warnings.push(`Only ${placed} ${need.subtype} lands could be added from the loaded, legal and affordable cards; ${lead?.name||seeds[0]?.name} needs ${need.subtype}s.`);
  }
  const cardConditions=commanderCardConditions(lead||seeds[0]),primaryNeeds=primaryInputRequirements(lead||seeds[0]),conditionBoost=c=>(cardConditions.some(condition=>condition.matches(c))?8:0)+primaryNeeds.reduce((n,need)=>n+(need.match(c)?8*need.priority(c):0),0);
  const needBoost=c=>landNeeds.reduce((n,need)=>n+landSubtypeRoles(c,need.subtype).reduce((s,r)=>s+({fetch:8,grant:8,tutor:5,setup:3,payoff:4}[r.kind]||0),0),0);

  const pool = [...new Map(Object.values(catalog).filter((c) => c?.name && !isLand(c) && isLegal(c) && fitsDeck(c, deckColors, f.commander)).map((c) => [cardKey(c.name), c])).values()],
    supports=c=>seedSubs.some(t=>tribalSupport(c,t))||themeSupport(c,{roles:seedTags,tokenKinds:intent.tokenKinds}).length>0,
    scored = pool.map((c) => ({ c, plan:supports(c), forge:forgeScore(c, hooks, { leader: forgeLead, power }), s: -(easy?setupBurden('mtg',c)*3:0) + scoreCard(c, seedTags, seedSubs, { free: available(c.name) || preferred(c), size, tokenKinds:intent.tokenKinds, goal }) + goalCardPreference(c,goal,{suggested:suggestedCards.some(name=>cardKey(name)===cardKey(c.name))}) + (styleFit(c,intent.requested)?(goal === "theme"?16:8):0) - (mtgSelfConflicts([...seeds,...(lead?[lead]:[]),c]).length?24:0) + needBoost(c) + conditionBoost(c) }));
  for (const x of scored) { x.s += x.forge.score + forgeNoise(forgeSeed, x.c.name, variation); x.roles = forgeRoles(x.c); x.hookIds = x.forge.fit.hooks; }
  // Seeds go in first at full copies, then everything else by score.
  for (const s of seeds) {
    const hit = scored.find((x) => cardKey(x.c.name) === cardKey(s.name));
    if (hit) hit.s += 1000;
  }
  scored.sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name));
  // What a filler slot really costs: the average of the cheapest cards available here.
  const cheapPrices = pool.map((c) => (available(c.name) ? 0 : unitCost(c))).filter((p) => p !== null).sort((a, b) => a - b).slice(0, 24),
    fillerPrice = cheapPrices.length ? Math.max(0.02, cheapPrices.reduce((a, b) => a + b, 0) / cheapPrices.length) : 0.25,
    nonland = () => count() - landsIn(),
    heavy = () => [...rows.values()].filter((r) => (Number(catalog[cardKey(r.name)]?.cmc) || 0) >= 5 && !isLand(catalog[cardKey(r.name)])).reduce((a, r) => a + r.qty, 0);
  // Required build-arounds are not optional scoring bonuses. Reserve their
  // first legal copy before any heuristic input/endpoint package can spend it.
  for(const seed of seeds){
    const c=pool.find(c=>cardKey(c.name)===cardKey(seed.name));
    if(c&&!qtyOf(c)&&nonland()<spellTarget&&canAfford(costFor(c,0,1)))put(c,1,'Your build-around card');
  }
  // Reserve the existing declared theme-density target for actual primary
  // inputs before cheap generic filler. This is a construction heuristic, not
  // a universal rules minimum or a claim that a trigger can already execute.
  for(const need of primaryNeeds){
    const target=themeMinimum(size-(lead?1:0));
    const existing=()=>[...rows.values()].filter(r=>cardKey(r.name)!==cardKey(lead?.name)&&need.match(catalog[cardKey(r.name)])).reduce((n,r)=>n+r.qty,0);
    const inputs=scored.filter(x=>need.match(x.c)).sort((a,b)=>need.priority(b.c)-need.priority(a.c)||b.s-a.s||a.c.name.localeCompare(b.c.name));
    for(const {c} of inputs){
      if(existing()>=target||nonland()>=spellTarget)break;
      const n=Math.min(maxCopies(c)-qtyOf(c),target-existing(),spellTarget-nonland());
      for(let k=n;k>=1;k--){
        const pendingSeeds=seeds.filter(seed=>!qtyOf(seed)&&cardKey(seed.name)!==cardKey(c.name)),seedReserve=pendingSeeds.reduce((sum,seed)=>sum+costFor(seed,0,1),0),fillerReserve=Math.max(0,spellTarget-nonland()-k-pendingSeeds.length)*fillerPrice;
        if(canAfford(costFor(c,qtyOf(c),qtyOf(c)+k),seedReserve+fillerReserve)){put(c,k,'Primary input: '+need.label);break;}
      }
    }
    if(!existing())warnings.push('No eligible affordable '+need.label+' was available; the primary engine remains unverified rather than inferred from generic keyword counts.');
  }
  // Optional anchor branches receive a minimal actual endpoint (or Aura pair),
  // never a blanket subtype quota. Keep filler and mana money; absent support
  // removes branch credit, not the card body or the rest of the deck.
  for(const source of [...seeds,...(lead?[lead]:[])])for(const need of abilityEndpointRequirements(source).filter(r=>r.recognized)){
    const current=()=>inspectAbilityEndpoints([...rows.values()].map(r=>({...r,card:catalog[cardKey(r.name)]})),{commander:lead?.name}).groups.find(g=>cardKey(g.sourceName)===cardKey(source.name)&&g.kind===need.kind);
    if(current()?.status==='conditional')continue;
    const options=[],endpointPool=scored.filter(x=>new RegExp('\\b'+need.endpointType+'\\b','i').test((x.c.card_faces?.[0]||x.c).type_line||''));
    for(const item of endpointPool){
      const c=item.c;if(cardKey(c.name)===cardKey(lead?.name))continue;
      if(need.kind==='cast-aura-library-chain'){
        for(const trigger of endpointPool)if(endpointCandidateMatches(need,c,{source,trigger:trigger.c}).status==='eligible')options.push([trigger.c,c]);
      }else if(endpointCandidateMatches(need,c,{source}).status==='eligible')options.push([c]);
    }
    options.sort((a,b)=>a.reduce((n,c)=>n+(qtyOf(c)?0:costFor(c,0,1)),0)-b.reduce((n,c)=>n+(qtyOf(c)?0:costFor(c,0,1)),0)||a.map(c=>c.name).join().localeCompare(b.map(c=>c.name).join()));
    for(const option of options){
      const additions=option.filter(c=>!qtyOf(c));if(nonland()+additions.length>spellTarget)continue;
      const pendingSeeds=seeds.filter(seed=>!qtyOf(seed)&&!additions.some(c=>cardKey(c.name)===cardKey(seed.name))),seedReserve=pendingSeeds.reduce((sum,seed)=>sum+costFor(seed,0,1),0);
      const cost=additions.reduce((n,c)=>n+costFor(c,0,1),0),reserve=seedReserve+Math.max(0,spellTarget-nonland()-additions.length-pendingSeeds.length)*fillerPrice;
      if(!canAfford(cost,reserve))continue;
      for(const c of additions)put(c,1,'Optional endpoint: '+need.label);
      break;
    }
  }
  const remaining=[...scored];
  if(completionFirst){
    // Keep each requested build-around, then buy the cheapest next legal copy.
    // Ownership is recalculated per copy, so one free copy is not treated as a free playset.
    for(const seed of seeds){const c=pool.find(c=>cardKey(c.name)===cardKey(seed.name));if(!c||qtyOf(c)||nonland()>=spellTarget)continue;
      const extra=costFor(c,0,1);if(canAfford(extra)){put(c,1,'Your build-around card');}}
    while(nonland()<spellTarget){
      const choices=scored.filter(x=>qtyOf(x.c)<maxCopies(x.c)).map(x=>({...x,extra:costFor(x.c,qtyOf(x.c),qtyOf(x.c)+1)})).filter(x=>canAfford(x.extra)).sort((a,b)=>a.extra-b.extra||b.s-a.s);
      const next=choices[0];if(!next)break;put(next.c,1,stock(next.c.name)>qtyOf(next.c)?'you own it':next.extra===Infinity?'Unpriced candidate; cost unverified':'Budget completion');
    }
    remaining.length=0;
  }
  while(remaining.length){
    // Quotas: permanent ramp, real card advantage, interaction, wipes, win
    // conditions, then each theme group from the commander's four questions.
    // A card that fills a short quota rises; one that overfills a role sinks.
    const counts=new Map(),bump=(k,n)=>counts.set(k,(counts.get(k)||0)+n);
    for(const row of rows.values()){const card=catalog[cardKey(row.name)];if(!card||cardKey(row.name)===cardKey(lead?.name))continue;for(const role of forgeRoles(card))bump(role,row.qty);for(const h of hooks)if(h.match(card))bump('hook:'+h.id,row.qty);}
    const targets={ramp:forgeT.ramp,draw:forgeT.draw,interaction:forgeT.interaction,wipe:forgeT.wipe.target,wincon:forgeT.wincon};
    const supportCopies=[...rows.values()].filter(r=>supports(catalog[cardKey(r.name)]||{})).reduce((n,r)=>n+r.qty,0);
    const roleBonus=r=>{const have=counts.get(r)||0,t=targets[r];if(!t&&r!=='wipe')return 0;if(have<t)return 8;if(r==='wipe')return have>=forgeT.wipe.max?-8:0;if(r==='draw')return 0;return -3;};
    const adaptive=x=>x.s+(x.plan&&supportCopies<Math.ceil(spellTarget*.35)?6:0)+x.roles.reduce((n,r)=>n+roleBonus(r),0)+hooks.reduce((n,h)=>n+(h.min&&x.hookIds.includes(h.id)&&(counts.get('hook:'+h.id)||0)<h.min?5:0),0);
    remaining.sort((a,b)=>adaptive(b)-adaptive(a)||a.c.name.localeCompare(b.c.name));
    const {c}=remaining.shift();
    const left = spellTarget - nonland();
    if (left <= 0) break;
    const have = qtyOf(c);
    if (have >= maxCopies(c)) continue;
    const isSeed = seeds.some((s) => cardKey(s.name) === cardKey(c.name));
    // Keep only a few big cards (video: 3 or 4 in Commander), more when the deck ramps hard.
    if (!isSeed && (Number(c.cmc) || 0) >= forgeT.bigFrom && heavy() >= (f.commander && size >= 100 ? forgeT.bigCards + Math.floor(Math.max(0, (counts.get('ramp') || 0) - forgeT.ramp) / 3) : Math.ceil(spellTarget * 0.15))) continue;
    // Playsets in 60-card formats; fewer copies when only a few are affordable.
    const ideal = Math.min(maxCopies(c) - have, left, f.copies === 1 ? 1 : isSeed ? 4 : 4);
    let take = 0;
    for (let n = ideal; n >= (f.copies === 1 || isSeed ? 1 : 2); n--) {
      const extra = costFor(c, have, have + n),
        reserve = Math.max(0, left - n) * fillerPrice; // keep money for the rest of the slots
      if (canAfford(extra,reserve)) {
        take = n;
        break;
      }
    }
    if (take) put(c, take, isSeed ? "Your build-around card" : reasonFor(c, seedTags, seedSubs, available(c.name) >= take));
  }

  // Second pass: fill any slots still open with the cheapest legal cards that fit.
  if (spellTarget - nonland() > 0) {
    const byPrice = scored
      .map((x) => ({ ...x, unit: available(x.c.name) > qtyOf(x.c) ? 0 : unitCost(x.c) }))
      .filter((x) => x.unit !== null || budget===Infinity)
      .sort((a, b) => (a.unit??Infinity) - (b.unit??Infinity) || b.s - a.s);
    for (const { c } of byPrice) {
      const left = spellTarget - nonland();
      if (left <= 0) break;
      const have = qtyOf(c),
        room = Math.min(maxCopies(c) - have, left, f.copies === 1 ? 1 : 4);
      for (let n = room; n >= 1; n--) {
        const extra = costFor(c, have, have + n);
        if (canAfford(extra)) {
          put(c, n, available(c.name) >= have + n ? "you own it" : "budget filler");
          break;
        }
      }
    }
  }

  // Mana: owned (or affordable) dual lands that fit, then basics split by color symbols.
  const landPool = [...new Map(Object.values(catalog).filter((c) => c?.name && isLand(c) && !isBasic(c) && isLegal(c) && fitsColors(c, deckColors) && mtgManaSourceProfile(c,{commanderIdentity:lead?.color_identity}).colors.filter((m) => deckColors.includes(m)).length >= Math.min(2, deckColors.length)).map((c) => [cardKey(c.name), c])).values()]
    .sort((a, b) => available(b.name) - available(a.name) || (f.commander ? (a.edhrec_rank || 1e9) - (b.edhrec_rank || 1e9) : 0) || a.name.localeCompare(b.name));
  // Three or more colours: most lands should fix (video, step 6).
  const dualCap = deckColors.length > 2 ? Math.round(landTarget * 0.6) : deckColors.length > 1 ? Math.round(landTarget * 0.4) : 0;
  for (const c of landPool) {
    const duals = landsIn() - [...rows.values()].filter((r) => isBasic(catalog[cardKey(r.name)])).reduce((a, r) => a + r.qty, 0);
    if (duals >= dualCap || landsIn() >= landTarget || count() >= size) break;
    const n = Math.min(f.copies === 1 ? 1 : 4, dualCap - duals, landTarget - landsIn(), size-count()),
      extra = costFor(c, qtyOf(c), qtyOf(c) + n);
    if (canAfford(extra,0,false)) {
      put(c, n, available(c.name) >= n ? "Dual land you own" : "Fixes your colors");
    }
  }
  const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const r of rows.values()) {
    const c = catalog[cardKey(r.name)];
    for (const m of (c?.mana_cost || c?.card_faces?.[0]?.mana_cost || "").match(/\{[^}]+\}/g) || []) for (const k of "WUBRG") if (m.includes(k) && deckColors.includes(k)) pips[k] += r.qty;
  }
  const basicsNeeded = Math.max(0, Math.min(landTarget - landsIn(), size - count()));
  if (basicsNeeded) {
    const real = deckColors.filter(x=>x!=="C"),weights=Object.fromEntries((real.length?real:["C"]).map(k=>[k,pips[k]||1])),split=splitBasics(weights,basicsNeeded);
    for(const [k,wanted] of Object.entries(split)){
      if(!wanted)continue;
      const name=BASIC[k],c=verifiedBasics.find(c=>cardKey(c.name)===cardKey(name));
      if(!c){warnings.push(`${name} was not added: verified legal basic-land details are missing or it is excluded.`);continue;}
      let take=0;
      for(let n=wanted;n>=1;n--)if(canAfford(costFor(c,qtyOf(c),qtyOf(c)+n),0,false)){take=n;break;}
      if(take)put(c,take,stock(c.name)>=qtyOf(c)+take?"Basic land you own":unitCost(c)===null?"Unpriced basic land; cost unverified":"Basic mana source");
      if(take<wanted)warnings.push(`${wanted-take} ${name} copies could not be added within the verified purchase budget.`);
    }
  }

  // The finished list sets its own land count (forgeLandCount); buildDeck
  // rebuilds once with it and keeps whichever version is more complete.
  const landsWanted = Math.max(forgeLandCount([...rows.values()].filter(r => cardKey(r.name) !== cardKey(lead?.name)).map(r => ({ card: catalog[cardKey(r.name)], qty: r.qty })), { size, commander: !!f.commander, hooks }), [...rows.values()].filter(r => r.why === 'Already in your list' && isLand(catalog[cardKey(r.name)])).reduce((n, r) => n + r.qty, 0));
  const cards = [...rows.values()].filter((r) => r.qty > 0),
    total = sumQty(cards),
    open = Math.max(0, size - total);
  if(total>size)throw Error("Generated deck exceeds its target; no version was applied.");
  if(open && !completionFirst){
    const economical=buildDeck({format,seeds,base,catalog,available,price,budget,colors,commander,completionFirst:true,easy,preferred,requestedStyle,goal,suggestedCards,excludedCards,...restrictions,power,variation,forgeSeed,landCount});
    const seedKept=seeds.every(seed=>isLand(seed)||economical.cards.some(r=>cardKey(r.name)===cardKey(seed.name)));
    if(seedKept && economical.open<open)return economical;
  }
  if (open) warnings.push(`${open} slots still open — raise the budget or add more cards to your collection.`);
  if(spent>budget+1e-6)warnings.push("Existing or required cards exceed the requested purchase budget; this is not an under-budget deck.");
  if (unknown) warnings.push(`${unknown} card${unknown > 1 ? "s have" : " has"} no current price.`);
  if(unknown)warnings.push("Purchase cost is unverified; unknown quotes are not free cards.");
  const owned=cards.reduce((a,r)=>a+Math.min(r.qty,stock(r.name)),0),knownSubtotal=Math.round(spent*1e6)/1e6,priceVerified=unknown===0;
  return {format:f.name,requestedStyle,goal,...restrictions,forge:{version:DECK_TAGS.version,hooks:hooks.map(h=>h.id),power,variation,seed:forgeSeed||null,landsWanted},colors:deckColors,commander:lead?.name||"",cards,cost:priceVerified?knownSubtotal:null,knownSubtotal,unknown,unpricedCopies:unknown,priceVerified,priceBasis:"purchase",unpricedPurchaseCopies:unknown,withinBudget:priceVerified&&knownSubtotal<=budget+1e-6,budget,total,size,open,owned,warnings,lands:landsIn()};
}


function reasonFor(c, tags, subs, owned) {
  const bits = [];
  const t = roles(c).filter((x) => tags.includes(x));
  if (subtypes(c).some((x) => subs.includes(x))) bits.push("shares a creature type");
  if (t.length) bits.push(t.join(" & ").toLowerCase() + " plan");
  const e = engineRoles(c);
  if (e.includes("Removal")) bits.push("removal");
  else if (e.includes("Draw")) bits.push("card draw");
  if (owned) bits.push("you own it");
  return bits.length ? bits.join(" · ") : "solid in this format";
}

// One deck per budget tier; tiers that would come out identical are merged.
export function buildTiers(opts, tiers = TIERS) {
  const out = [];
  for (const budget of tiers) {
    const d = buildDeck({ ...opts, budget }),
      sig = d.cards.map((r) => r.name + r.qty).sort().join("|");
    if (out.length && out.at(-1).sig === sig) {
      out.at(-1).upTo = budget;
      continue;
    }
    out.push({ ...d, budget, sig });
  }
  return out;
}

// Formats a card can be built around: legal there and, for command-zone formats, able to lead.
export function formatsFor(card, all) {
  return all.filter((f) => f.id !== "limited" && (!f.legality || ["legal", "restricted"].includes(card?.legalities?.[f.legality])) && (!f.commander || canLead(card, f)));
}

// Spells a deck in this format and these colors could play (for spending a budget on upgrades).
export function upgradePool(format, catalog, colors) {
  const f = formatOf(format);
  return [...new Map(Object.values(catalog).filter((c) => c?.name && !isLand(c) && functionalIn(c, f) && (!f.legality || ["legal", "restricted"].includes(legalityIn(c, f))) && fitsDeck(c, colors, f.commander)).map((c) => [cardKey(c.name), c])).values()];
}
export const copyLimit = (c, format) => {
  const f = formatOf(format);
  return isBasic(c) ? Infinity : legalityIn(c, f) === "restricted" ? 1 : f.copies;
};

// How well a card fits decks built around these seeds (the builder's own fit score).
export function fitFor(seeds, size = 60) {
  const {tags,subs,tokenKinds} = seedIntent(seeds);
  return (c) => scoreCard(c, tags, subs, { size,tokenKinds });
}
