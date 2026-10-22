import {setupBurden} from './deck-preferences.js';
import { functionalIn } from "./deck-safety.js";
// Format-aware deck generator: builds a full, legal deck around one or more
// seed cards, preferring cards you own and staying inside a purchase budget.
// Works for every constructed format in formats.js (60-card, singleton and
// command-zone formats). Scores are transparent rules of thumb, not predictions.
import { effectiveCopyLimit, cardKey, rulesText, typeText, isLand, isBasic, roles, aggregateCards, sumQty } from "./core.js";
import { engineRoles } from "./insights.js";
import { commanderTheme, creatureTypes, CREATURE_THEMES, tribalSupport, themeSupport } from "./planner.js";
import { formatOf, canLead, legalityIn } from "./formats.js";
import { splitBasics } from "./extras.js";
import { goalCardPreference } from "./ai-deck-goal.js";
import { mtgResourceProfile } from "./mtg-effects.js";

const BASIC = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" };
const THEMES = ["Tokens", "Graveyard", "Spells", "Dragons", "Artifacts", "Lifegain", "Landfall", "Counters"];
const TIERS = [0, 10, 25, 50, 100, Infinity];
export const BUDGET_TIERS = TIERS;

// Creature types and similar subtypes on a card ("Goblin Warrior" → Goblin, Warrior).
export const subtypes = (c) =>
  (typeText(c).split(" // ")[0].split("—")[1] || "").trim().split(/\s+/).filter((w) => w.length > 2);

const ident = (c) => c?.color_identity || [];
export const fitsColors = (c, colors) => ident(c).every((x) => colors.includes(x));

// Keep explicit style independent from inferred commander/seed mechanics.
const THEME_TERMS = {Tokens:'(o:"creature token" or o:populate)',Graveyard:'o:graveyard',Spells:'(t:instant or t:sorcery or o:"instant or sorcery")',Dragons:'t:dragon',Artifacts:'(t:artifact or o:artifact)',Lifegain:'(o:"gain" o:life)',Landfall:'o:landfall',Counters:'(o:"+1/+1 counter" or o:proliferate)'};
const STYLE_ROLES = {token:"Tokens",graveyard:"Graveyard",reanimator:"Graveyard",spells:"Spells",spellslinger:"Spells",artifact:"Artifacts",lifegain:"Lifegain",landfall:"Landfall",counter:"Counters",proliferate:"Counters"};
export function requestedIntent(style = "") {
  const words = String(style).toLowerCase().replace(/\+1\/\+1/g,"counter").match(/[\p{L}\p{N}]+/gu) || [],
    noise = new Set("a an the and or with for of mono white blue black red green colorless deck decks good budget tribal commander build around focused focus theme strongest best optimized optimal strong powerful competitive fun casual silly janky jank chaos chaotic weak bad".split(" ")),
    terms = [...new Set(words.filter(w => !noise.has(w)).map(w => ({elves:"elf",dwarves:"dwarf",spells:"spells"})[w] || (w.endsWith("s")?w.slice(0,-1):w)))].slice(0,6),
    tribes = terms.map(w => CREATURE_THEMES.find(t => t.toLowerCase() === w)).filter(Boolean),
    roles = [...new Set(terms.map(w => STYLE_ROLES[w]).filter(Boolean))],
    other = terms.filter(w => !STYLE_ROLES[w] && !tribes.some(t => t.toLowerCase() === w));
  return {style:String(style).trim(),tribes,roles,other};
}
const tribeQuery = t => `(t:${t.toLowerCase()} or o:${t.toLowerCase()})`;
const roleQuery = roles => {const terms=[...new Set(roles.map(r=>THEME_TERMS[r]).filter(Boolean))];return terms.length===1?terms[0]:terms.length?'('+terms.join(' or ')+')':'';};
export function themeQueries(seed, style = "") {
  const theme = commanderTheme(seed), requested = requestedIntent(style),
    tribes = [...new Set([...requested.tribes,...(theme.tribes.length?theme.tribes:theme.roles.some(r=>THEMES.includes(r))?[]:creatureTypes(seed))])],
    explicit = roleQuery(requested.roles),
    support = roleQuery(theme.roles.filter(r=>THEMES.includes(r))),
    other = requested.other.length?'('+requested.other.map(w=>`t:"${w}" or o:"${w}"`).join(' or ')+')':'';
  // Separate requests keep a popular generic support pool from crowding actual
  // payoff subjects out of the provider's first page. No subtype-slot truncation.
  return [...new Set([...requested.tribes.map(tribeQuery),explicit,other,...tribes.map(tribeQuery),support].filter(Boolean))];
}
export function themeQuery(seed, style = "") {
  const queries = themeQueries(seed,style);
  return queries.length === 1 ? queries[0] : queries.length ? '('+queries.join(' or ')+')' : '';
}
function seedIntent(seeds, style = "") {
  const requested=requestedIntent(style), themes=seeds.map(commanderTheme);
  return {tokenKinds:[...new Set(themes.flatMap(t=>t.tokenKinds))],tags:[...new Set([...requested.roles,...themes.flatMap(t=>t.roles.filter(r=>THEMES.includes(r)))])],subs:[...new Set([...requested.tribes,...themes.flatMap((t,i)=>t.tribes.length?t.tribes:t.roles.some(r=>THEMES.includes(r))?[]:creatureTypes(seeds[i]))])],requested};
}
function styleFit(c, requested) {
  return requested.tribes.some(t=>tribalSupport(c,t)) || themeSupport(c,{roles:requested.roles}).length > 0 || requested.other.some(w=>new RegExp('\\b'+w+'s?\\b','i').test(typeText(c)+' '+rulesText(c)));
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
export function buildDeck({ format, seeds = [], base = [], catalog, available = () => 0, price = (c) => null, budget = Infinity, colors = null, commander = null, completionFirst = false, easy = false, preferred = () => 0, requestedStyle = "", goal = "strongest", suggestedCards = [], excludedCards = [] }) {
  const f = formatOf(format);
  if (f.id === "limited") throw Error("Limited decks come from the cards you open — build those by hand.");
  if ((!Number.isFinite(budget) && budget!==Infinity) || budget < 0) throw Error("Enter a budget of $0 or more.");
  const size = f.size,
    lead = f.commander ? commander || seeds.find((s) => canLead(s, f)) : null;
  if (f.commander && !lead) throw Error(`${f.name} decks need a card that can lead them (${f.commander === "planeswalker" ? "a planeswalker" : "a legendary creature"}).`);
  const excludedKeys=new Set(excludedCards.map(cardKey)),
    legalStatus = (c) => legalityIn(c, f),
    isLegal = (c) => !excludedKeys.has(cardKey(c?.name)) && functionalIn(c,f) && (!f.legality || ["legal", "restricted"].includes(legalStatus(c))),
    maxCopies = (c) => effectiveCopyLimit(c,f);
  // Colors: the leader's identity, else the seeds', else the base list's.
  let deckColors = colors || (lead ? ident(lead) : [...new Set([...seeds, ...base.map((b) => catalog[cardKey(b.name)])].flatMap(ident))]);
  if (!deckColors.length) deckColors = ["C"];
  const intent = seedIntent(seeds,requestedStyle),
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
    if(c && !isLegal(c))throw Error(`${b.name} is illegal or nonfunctional in ${f.name}. Replace it before completing the list.`);
    if(c && b.qty>maxCopies(c))throw Error(`${b.name} exceeds this format’s copy limit. Review your list first.`);
    put(c || { name: b.name }, b.qty, "Already in your list");
  }
  const landTarget = Math.max(f.commander && size >= 100 ? 36 : Math.round(size * 0.4) - (f.commander ? 1 : 0), landsIn()),
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

  const pool = [...new Map(Object.values(catalog).filter((c) => c?.name && !isLand(c) && isLegal(c) && fitsColors(c, deckColors)).map((c) => [cardKey(c.name), c])).values()],
    scored = pool.map((c) => ({ c, s: -(easy?setupBurden('mtg',c)*3:0) + scoreCard(c, seedTags, seedSubs, { free: available(c.name) || preferred(c), size, tokenKinds:intent.tokenKinds, goal }) + goalCardPreference(c,goal,{suggested:suggestedCards.some(name=>cardKey(name)===cardKey(c.name))}) + (styleFit(c,intent.requested)?(goal === "theme"?16:8):0) }));
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
    const counts=new Map();for(const row of rows.values())for(const role of engineRoles(catalog[cardKey(row.name)] || {}))counts.set(role,(counts.get(role)||0)+row.qty*(role === "Ramp"?candidateRampWeight(catalog[cardKey(row.name)] || {}):1));
    const targets=f.commander?{Removal:8,Draw:10,Ramp:10,Wipe:3}:{Removal:6,Draw:6,Ramp:4,Wipe:2};
    const adaptive=x=>x.s+engineRoles(x.c).reduce((n,r)=>n+(targets[r]===undefined?0:(counts.get(r)||0)<targets[r]?3*(r === "Ramp"?candidateRampWeight(x.c):1):-3),0);
    remaining.sort((a,b)=>adaptive(b)-adaptive(a)||a.c.name.localeCompare(b.c.name));
    const {c}=remaining.shift();
    const left = spellTarget - nonland();
    if (left <= 0) break;
    const have = qtyOf(c);
    if (have >= maxCopies(c)) continue;
    const isSeed = seeds.some((s) => cardKey(s.name) === cardKey(c.name));
    if (!isSeed && (Number(c.cmc) || 0) >= 5 && heavy() >= Math.ceil(spellTarget * 0.15)) continue;
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
  const landPool = [...new Map(Object.values(catalog).filter((c) => c?.name && isLand(c) && !isBasic(c) && isLegal(c) && fitsColors(c, deckColors) && (c.produced_mana || []).filter((m) => deckColors.includes(m)).length >= Math.min(2, deckColors.length)).map((c) => [cardKey(c.name), c])).values()]
    .sort((a, b) => available(b.name) - available(a.name) || (a.edhrec_rank || 1e9) - (b.edhrec_rank || 1e9));
  const dualCap = deckColors.length > 1 ? Math.round(landTarget * 0.4) : 0;
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

  const cards = [...rows.values()].filter((r) => r.qty > 0),
    total = sumQty(cards),
    open = Math.max(0, size - total);
  if(total>size)throw Error("Generated deck exceeds its target; no version was applied.");
  if(open && !completionFirst){
    const economical=buildDeck({format,seeds,base,catalog,available,price,budget,colors,commander,completionFirst:true,easy,preferred,requestedStyle,goal,suggestedCards,excludedCards});
    const seedKept=seeds.every(seed=>isLand(seed)||economical.cards.some(r=>cardKey(r.name)===cardKey(seed.name)));
    if(seedKept && economical.open<open)return economical;
  }
  if (open) warnings.push(`${open} slots still open — raise the budget or add more cards to your collection.`);
  if(spent>budget+1e-6)warnings.push("Existing or required cards exceed the requested purchase budget; this is not an under-budget deck.");
  if (unknown) warnings.push(`${unknown} card${unknown > 1 ? "s have" : " has"} no current price.`);
  if(unknown)warnings.push("Purchase cost is unverified; unknown quotes are not free cards.");
  const owned=cards.reduce((a,r)=>a+Math.min(r.qty,stock(r.name)),0),knownSubtotal=Math.round(spent*1e6)/1e6,priceVerified=unknown===0;
  return {format:f.name,requestedStyle,goal,colors:deckColors,commander:lead?.name||"",cards,cost:priceVerified?knownSubtotal:null,knownSubtotal,unknown,unpricedCopies:unknown,priceVerified,priceBasis:"purchase",unpricedPurchaseCopies:unknown,withinBudget:priceVerified&&knownSubtotal<=budget+1e-6,budget,total,size,open,owned,warnings,lands:landsIn()};
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
  return [...new Map(Object.values(catalog).filter((c) => c?.name && !isLand(c) && functionalIn(c, f) && (!f.legality || ["legal", "restricted"].includes(legalityIn(c, f))) && fitsColors(c, colors)).map((c) => [cardKey(c.name), c])).values()];
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
