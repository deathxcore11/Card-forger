import {
  cardKey,
  sumQty,
  roles,
  rulesText,
  typeText,
  isLand,
  isBasic,
  commanderEligible,
  identityFits,
  inventory,
  cardPrice,
  deckStats,
  aggregateCards,
} from "./core.js";
import { MTG_VOCABULARY, tribePattern } from './mtg-vocabulary.js';
import { mtgEffectProfile } from './mtg-effects.js';
// Theme inference uses effect clauses, not timing restrictions or card names.
// It is deliberately narrower than the general-purpose raw role tags.
export const CREATURE_THEMES = MTG_VOCABULARY['creature-types'];
const escapePattern = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const themeMemo=new WeakMap();
export function intentText(c) {
  return rulesText(c)
    .replace(/\([^)]*\)/g, " ")
    .replace(/(?:activate|cast)[^.\n]*(?:as a sorcery|any time you could cast a sorcery)[^.\n]*\.?/gi, " ");
}
export function creatureTypes(c) {
  const lines = c?.card_faces?.length ? c.card_faces.map(f => f.type_line || "") : typeText(c).split(" // ");
  return [...new Set(lines.filter(t => /\b(?:Creature|Kindred|Tribal)\b/.test(t)).flatMap(t => {
    const suffix=(t.split('—')[1]||'').trim();
    return CREATURE_THEMES.filter(type=>new RegExp('(?:^|\\s)'+escapePattern(type)+'(?:$|\\s)').test(suffix));
  }))];
}
function namedEffectText(c) {
  let text = intentText(c);
  const names = [c?.name, ...(c?.card_faces || []).map(f => f.name)].filter(Boolean).flatMap(n => n.split(" // "));
  for (const name of names.sort((a,b) => b.length-a.length)) text = text.replace(new RegExp(escapePattern(name), "gi"), "this card");
  return text;
}
// A type's appearance in a name, protection clause or removal target is not a
// tribal payoff. Return evidence for supported subjects and owned token makers.
export function tribeEvidence(c, tribe) {
  const t = tribePattern(tribe), text = namedEffectText(c), out = [];
  const subject = new RegExp("\\b" + t + "s?(?: (?:creature|permanent|spell|card)s?)? (?:you control|you cast|in your graveyard|enter|dies|die|spells? you cast)", "i");
  const trigger = new RegExp("(?:whenever|when) (?:another |one or more |a |an |other )?(?:[A-Z][a-z]+ or )?" + t + "s?\\b[^.\\n]*(?:you control|enters|dies|attacks)", "i");
  const token = new RegExp("(?:you )?create[^.\\n]*\\b" + t + "\\b[^.\\n]*creature tokens?", "i");
  for (const clause of text.split(/[.\n]/)) {
    if (/opponent|its controller|their controller|each player|target player/i.test(clause)) continue;
    if (subject.test(clause) || trigger.test(clause)) out.push({kind:"payoff", text:clause.trim()});
    else if (token.test(clause)) out.push({kind:"token", text:clause.trim()});
    else if (new RegExp("search your library for[^.]*\\b"+t+"\\b", "i").test(clause)) out.push({kind:"search",text:clause.trim()});
  }
  return out;
}
export function commanderTheme(c) {
  const signature=rulesText(c)+'|'+typeText(c),cached=c&&themeMemo.get(c);
  if(cached?.signature===signature)return cached.value;
  const text = intentText(c),
    candidates = [...new Set([...CREATURE_THEMES, ...creatureTypes(c)])].filter(t=>new RegExp('\\b'+tribePattern(t)+'\\b','i').test(text)),
    evidence = candidates.map(tribe => ({tribe,evidence:tribeEvidence(c,tribe)})).filter(x => x.evidence.length)
      .sort((a,b) => b.evidence.reduce((n,e)=>n+(e.kind === "payoff"?3:1),0)-a.evidence.reduce((n,e)=>n+(e.kind === "payoff"?3:1),0) || a.tribe.localeCompare(b.tribe)),
    tribes = evidence.filter(x => x.evidence.some(e => e.kind !== "token")).map(x => x.tribe),
    inferred = roles({...c, oracle_text:text}).filter(r => !["Creature","Utility","Interaction","Dragons"].includes(r));
  // Paying a sacrifice cost alone does not establish a graveyard payoff.
  if (!/graveyard|dies|\bmill\b|(?:when|whenever)[^.]*sacrific/i.test(text)) {
    const index=inferred.indexOf("Graveyard"); if(index>=0) inferred.splice(index,1);
  }
  if(inferred.includes("Lifegain")&&!themeSupport(c,{roles:["Lifegain"]}).length)inferred.splice(inferred.indexOf("Lifegain"),1);
  if (tribes.includes("Dragon")) inferred.push("Dragons");
  if (/\+1\/\+1 counters?|proliferate|put[^.]*counter on each/i.test(text)) inferred.push("Counters");
  const tokenKinds = [
    ...(/create[^.\n]*creature tokens?|populate|creature tokens? you control/i.test(text)?["creature"]:[]),
    ...["Treasure","Clue","Food","Blood","Map","Powerstone","Gold"].filter(t=>new RegExp("\\b"+t+" tokens?","i").test(text)).map(t=>t.toLowerCase()),
  ];
  const value={tribe:tribes[0] || null, tribes, roles:[...new Set(inferred)], tokenKinds, evidence};
  if(c&&typeof c==='object')themeMemo.set(c,{signature,value});
  return value;
}
// Direct tribal participation is distinct from a separate useful support plan.
export function tribalSupport(c, tribe) {
  if (!c || isLand(c) || !tribe) return false;
  const creature = /\bCreature\b/.test(typeText(c) || c?.card_faces?.[0]?.type_line || ""),
    text = intentText(c);
  if (creature && (creatureTypes(c).some(t => t.toLowerCase() === tribe.toLowerCase()) || /\bchangeling\b|(?:is|are) every creature type/i.test(text))) return true;
  if (/creatures you control (?:are every creature type|have changeling)|(?:equipped|enchanted) creature is every creature type/i.test(text)) return true;
  return tribeEvidence(c,tribe).length > 0;
}
export function fitsTypeRestrictions(c,{creatureTypesOnly=[],excludedSubtypes=[]}={}) {
  const types=creatureTypes(c),creature=/\bCreature\b/.test(typeText(c)||(c?.card_faces||[]).map(f=>f.type_line||'').join(' // ')),
    allTypes=creature&&/^(?:changeling\b|this (?:card|creature) is every creature type)/im.test(intentText(c));
  return !excludedSubtypes.some(t=>allTypes||types.includes(t))&&(!creature||!creatureTypesOnly.length||allTypes||creatureTypesOnly.some(t=>types.includes(t)));
}
export function themeSupport(c, theme) {
  if (!c || isLand(c)) return [];
  const text = intentText(c), types = typeText(c) || (c.card_faces || []).map(f => f.type_line || "").join(" // "), out = [];
  const ownsTokens = text.split(/[.\n]/).some(clause => !/opponent|its controller|their controller|each player|target player/i.test(clause) && /create[^.]*creature tokens?|populate|creature tokens? you control/i.test(clause));
  if (theme.roles.includes("Tokens")) {
    const kinds=theme.tokenKinds?.length?theme.tokenKinds:["creature"];
    if(kinds.includes("creature") && ownsTokens) out.push("Creature-token support");
    for(const kind of kinds.filter(k=>k!=="creature"))if(new RegExp("\\b"+kind+"(?: tokens?)?\\b","i").test(text))out.push(kind[0].toUpperCase()+kind.slice(1)+"-token support");
    if(!out.length && /(?:if|whenever) (?:one or more|you (?:would )?create)[^.]*tokens?|twice that many[^.]*tokens?/i.test(text))out.push("Token support");
  }
  if (theme.roles.includes("Counters") && /proliferate|\+1\/\+1 counters?|one or more counters? would be put on|additional counter/i.test(text)) out.push("Counter support");
  const tests = {
    Graveyard:/graveyard|dies|mill|sacrifice/i,
    Spells:/instant|sorcery|magecraft|prowess/i,
    Artifacts:/artifact/i,
    Landfall:/landfall|land enters|lands? you control/i,
    Dragons:/dragon/i,
  };
  const effects=mtgEffectProfile(c);
  if(theme.roles.includes('Lifegain')&&[...effects.provides,...effects.needs].some(e=>e.tag==='lifegain'))out.push('Lifegain support');
  if(theme.roles.includes('Lifelink')&&effects.provides.some(e=>e.tag==='lifelink'))out.push('Lifelink support');
  for (const role of theme.roles) if (tests[role]?.test(text+" "+types)) out.push(role+" support");
  return out;
}

export function complexity(c) {
  const text = rulesText(c),
    flags = [];
  if (/search your library|choose one|choose two|choose three/i.test(text))
    flags.push("Choices / searches");
  if (/whenever|at the beginning|when .*enters/i.test(text))
    flags.push("Triggered abilities");
  if (/graveyard|exile.*(?:cast|play)|cast.*exile/i.test(text))
    flags.push("Extra zones");
  if (/copy|additional turn|additional combat|storm|cascade/i.test(text))
    flags.push("Stack / sequencing");
  return {
    level:
      flags.length >= 3
        ? "More involved"
        : flags.length >= 1
          ? "Some bookkeeping"
          : "Straightforward",
    weight: flags.length,
    flags,
  };
}
export function completionPlan(
  deck,
  collection,
  decks,
  catalog,
  { budget = 25, landTarget = 36, preferOwned = true, simple = true, price = cardPrice } = {},
) {
  const quote = c => { const value = price(c); return value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "") && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null; };
  const commander = catalog[cardKey(deck.commander)];
  if (deck.format !== "Commander" || !commanderEligible(commander))
    throw Error("Choose a verified single commander before filling slots.");
  if ((budget !== Infinity && !Number.isFinite(budget)) || budget < 0 || (budget !== Infinity && budget > 100000))
    throw Error("Enter a valid missing-card budget.");
  if (!Number.isInteger(landTarget) || landTarget < 30 || landTarget > 42)
    throw Error("Choose a land target between 30 and 42.");
  if (sumQty(deck.cards) > 100)
    throw Error("This draft is over 100 cards. Trim it before filling slots.");
  if (deck.cards.some((c) => !catalog[cardKey(c.name)]))
    throw Error("Resolve existing card data before filling slots.");
  const theme = commanderTheme(commander),
    cards = aggregateCards(deck.cards).map((c) => ({ ...c })),
    additions = [],
    wanted = { Ramp: 10, Draw: 8, Interaction: 8, Protection: 3 },
    pool = Object.values(catalog).filter(
      (c) => c.legalities?.commander === "legal" && identityFits(c, commander),
    );
  const quantityByName = new Map(cards.map((c) => [cardKey(c.name), c.qty])),
    rowByName = new Map(cards.map((c) => [cardKey(c.name), c])),
    roleCache = new Map(),
    complexityCache = new Map(),
    cachedRoles = (c) => {
      if (!roleCache.has(c)) roleCache.set(c, roles(c));
      return roleCache.get(c);
    },
    cachedComplexity = (c) => {
      if (!complexityCache.has(c)) complexityCache.set(c, complexity(c));
      return complexityCache.get(c);
    },
    stockCache = new Map(),
    stock = (c) => {
      const k = cardKey(c.name);
      if (!stockCache.has(k))
        stockCache.set(
          k,
          inventory(collection, c.name, decks, deck.id).available,
        );
      return stockCache.get(k);
    };
  const cardCost = (c, qty) => {
    const missing = Math.max(0, qty - stock(c)),
      price = quote(c);
    return {
      cost: missing ? (price === null ? Infinity : missing * price) : 0,
      unknown: missing && price === null,
    };
  };
  let costCache;
  const totalCost = () => {
    if (costCache === undefined)
      costCache = cards.reduce(
        (a, r) => a + cardCost(catalog[cardKey(r.name)], r.qty).cost,
        0,
      );
    return costCache;
  };
  const count = () => sumQty(cards),
    stats = () => deckStats({ ...deck, cards }, catalog);
  const used = (c) => quantityByName.has(cardKey(c.name));
  function canAdd(c) {
    if (count() >= 100 || (used(c) && !isBasic(c))) return false;
    const existing = quantityByName.get(cardKey(c.name)) || 0,
      currentCost = cardCost(c, existing).cost,
      nextCost = cardCost(c, existing + 1).cost,
      extra = nextCost - currentCost;
    // No cap is not a $0 price claim: verified cards may be proposed with an
    // unknown quote, while the resulting purchase estimate remains unverified.
    return (budget === Infinity && quote(c) === null) || (
      Number.isFinite(extra) &&
      (extra === 0 || totalCost() + extra <= budget + 0.000001)
    );
  }
  function add(c, reason) {
    costCache = undefined;
    let row = rowByName.get(cardKey(c.name));
    if (row) row.qty++;
    else {
      row = { name: c.name, qty: 1 };
      cards.push(row);
      rowByName.set(cardKey(c.name), row);
    }
    quantityByName.set(cardKey(c.name), row.qty);
    const prior = additions.find((a) => cardKey(a.name) === cardKey(c.name));
    if (prior) prior.qty++;
    else
      additions.push({
        name: c.name,
        qty: 1,
        reason,
        complexity: cachedComplexity(c).level,
        price: quote(c),
        available: stock(c),
      });
  }
  if (!used(commander)) {
    if (count() >= 100) throw Error("No open slot for your commander.");
    if (!canAdd(commander))
      throw Error(
        "Your missing commander cannot fit the budget, or has no price.",
      );
    add(commander, "Your selected commander.");
  }
  const spellPool = [...new Map(pool.filter((c) => !isLand(c)).map(c => [cardKey(c.name), c])).values()];
  const colored = commander.color_identity || [],
      colorBasics = {
        W: "Plains",
        U: "Island",
        B: "Swamp",
        R: "Mountain",
        G: "Forest",
      },
      basicNames = colored.length
        ? colored.map((c) => colorBasics[c])
        : ["Wastes"];
  while (count() < 100 && stats().lands < landTarget) {
    const landPool = pool.filter(
      (c) =>
        isLand(c) &&
        canAdd(c) &&
        (isBasic(c) ? basicNames.includes(c.name) : stock(c) > 0),
    );
    landPool.sort((a, b) => {
      const score = (c) =>
        (isBasic(c) ? 3 : 4) +
        (stock(c) > (quantityByName.get(cardKey(c.name)) || 0) ? 8 : 0) -
        (quantityByName.get(cardKey(c.name)) || 0) * 0.7;
      return score(b) - score(a) || a.name.localeCompare(b.name);
    });
    if (!landPool.length) break;
    add(
      landPool[0],
      isBasic(landPool[0])
        ? "Basic mana source; color balance needs a mana-symbol review."
        : "Owned land within commander color identity.",
    );
  }
  while (count() < 100 - Math.max(0, landTarget - stats().lands)) {
    const current = stats();
    let ranked = spellPool
      .filter(canAdd)
      .map((c) => {
        const r = cachedRoles(c),
          themeFit =
            theme.tribe &&
            new RegExp("\\b" + theme.tribe + "\\b", "i").test(typeText(c)),
          needed = r.filter(
            (role) =>
              wanted[role] && (current.counts[role] || 0) < wanted[role],
          );
        const owned = stock(c) > 0,
          price = quote(c),
          popular = c.edhrec_rank
            ? Math.max(0, 3 - Math.log10(c.edhrec_rank + 1) * 0.6)
            : 0;
        const score =
          needed.reduce(
            (s, role) =>
              s + 6 + (wanted[role] - (current.counts[role] || 0)) * 0.4,
            0,
          ) +
          (themeFit ? 10 : 0) +
          (deck.strategy !== "Auto" && r.includes(deck.strategy) ? 6 : 0) +
          r.filter((role) => theme.roles.includes(role)).length * 2 +
          (preferOwned && owned ? 8 : 0) +
          popular -
          Math.max(0, (c.cmc || 0) - 4) * 1.3 -
          (simple ? cachedComplexity(c).weight * 1.8 : 0) -
          (owned ? 0 : Math.min(price || 0, 10) * 0.2);
        const reasons = [
          ...(themeFit ? [theme.tribe + " theme"] : []),
          ...needed.map((role) => role + " gap"),
          ...(owned ? ["available in your collection"] : []),
        ];
        return {
          c,
          score,
          reason:
            reasons.join(" · ") ||
            "Playable card in your commander’s color identity",
        };
      })
      .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
    if (!ranked.length) break;
    // Reserve enough money for the cheapest remaining unique spells instead
    // of spending the entire budget on the first high-scoring card.
    const need = 100 - count(), costs = ranked.map(x => ({name: x.c.name, cost: stock(x.c) > 0 ? 0 : quote(x.c)})).sort((a,b) => a.cost - b.cost);
    if (costs.length >= need && Number.isFinite(totalCost())) {
      const cheapest = costs.slice(0, need), sum = cheapest.reduce((n,x) => n + x.cost, 0), included = new Set(cheapest.map(x => x.name));
      const affordable = ranked.filter(x => {
        const price = stock(x.c) > 0 ? 0 : quote(x.c);
        const reserve = included.has(x.c.name) ? sum - price : sum - cheapest.at(-1).cost;
        return totalCost() + price + reserve <= budget + .000001;
      });
      if (affordable.length) ranked = affordable;
    }
    add(ranked[0].c, ranked[0].reason);
  }
  const cost = totalCost(), landCount = stats().lands,
    unpricedPurchaseCopies = cards.reduce((n, r) => { const c = catalog[cardKey(r.name)]; return n + (quote(c) === null ? Math.max(0, r.qty - stock(c)) : 0); }, 0),
    basicCandidates = basicNames.map(name => {
      const card = catalog[cardKey(name)];
      return { name, loaded: !!card, legal: !!card && pool.includes(card), price: card ? quote(card) : null, available: card ? stock(card) : 0, listed: quantityByName.get(cardKey(name)) || 0 };
    }),
    missingBasics = basicCandidates.filter(c => !c.loaded).map(c => c.name),
    unpricedBasics = basicCandidates.filter(c => c.loaded && c.price === null && c.available <= c.listed).map(c => c.name),
    invalidBasics = basicCandidates.filter(c => c.loaded && !c.legal).map(c => c.name),
    landWarnings = landCount >= landTarget ? [] : [
      ...(missingBasics.length ? [`Basic land details are unavailable for ${missingBasics.join(", ")}. Retry card data; a larger budget alone cannot fix missing data.`] : []),
      ...(unpricedBasics.length ? [`No purchase price is available for ${unpricedBasics.join(", ")}. Unowned lands with unknown prices were not assumed free; retry their price data.`] : []),
      ...(invalidBasics.length ? [`Basic land legality or color data needs review for ${invalidBasics.join(", ")}.`] : []),
      ...(!missingBasics.length && !unpricedBasics.length && !invalidBasics.length ? ["The remaining land copies do not fit the purchase budget and available ownership."] : []),
    ];
  return {
    deck: { ...deck, cards },
    additions,
    open: 100 - count(),
    cost: Number.isFinite(cost) ? cost : null,
    unpriced: !Number.isFinite(cost),
    theme,
    diagnostics: { target: 100, total: count(), missingCards: 100 - count(), landTarget, lands: landCount, missingLands: Math.max(0, landTarget - landCount), unpricedPurchaseCopies, purchaseEstimateVerified: Number.isFinite(cost), basicCandidates, landWarnings },
    stats: stats(),
    warnings: [
      ...landWarnings,
      ...(count() < 100
        ? [
            "This remains an incomplete draft: not enough eligible, priced or owned candidates could be added. Review the data and budget warnings before retrying.",
          ]
        : []),
      ...(!Number.isFinite(cost)
        ? [
            budget === Infinity ? `${unpricedPurchaseCopies} unowned card copies have no purchase price. The list uses verified card identities with no spending cap; its total purchase cost is unverified, not free.` : "An existing missing card has no price; purchased additions were excluded.",
          ]
        : []),
      ...(Number.isFinite(cost) && cost > budget
        ? [
            "The existing draft already exceeds the missing-card budget; only free owned additions were allowed.",
          ]
        : []),
      "Prices are available reference quotes, not a complete market search; missing quotes remain unverified.",
      "Recommendations use text heuristics and broad EDHREC popularity ranks when available. They are not measured win rates or verified combos.",
    ],
  };
}
