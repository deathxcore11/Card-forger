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
export function commanderTheme(c) {
  const text = rulesText(c),
    types = [
      "Angel",
      "Dragon",
      "Goblin",
      "Zombie",
      "Elf",
      "Vampire",
      "Dinosaur",
      "Merfolk",
      "Sliver",
      "Wizard",
      "Human",
      "Spirit",
      "Knight",
      "Soldier",
      "Cat",
      "Dog",
      "Demon",
      "Faerie",
      "Bird",
      "Squirrel",
      "Saproling",
    ];
  const tribe = types.find((t) =>
    new RegExp("\\b" + t + "s?\\b", "i").test(text),
  );
  return {
    tribe: tribe || null,
    roles: roles(c).filter(
      (r) => !["Creature", "Utility", "Interaction"].includes(r),
    ),
  };
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
  { budget = 25, landTarget = 36, preferOwned = true, simple = true } = {},
) {
  const commander = catalog[cardKey(deck.commander)];
  if (deck.format !== "Commander" || !commanderEligible(commander))
    throw Error("Choose a verified single commander before filling slots.");
  if (!Number.isFinite(budget) || budget < 0 || budget > 100000)
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
      price = cardPrice(c);
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
    return (
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
        price: cardPrice(c),
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
  while (count() < 100 && stats().lands < landTarget) {
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
  while (count() < 100) {
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
          price = cardPrice(c),
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
    const need = 100 - count(), costs = ranked.map(x => ({name: x.c.name, cost: stock(x.c) > 0 ? 0 : cardPrice(x.c)})).sort((a,b) => a.cost - b.cost);
    if (costs.length >= need && Number.isFinite(totalCost())) {
      const cheapest = costs.slice(0, need), sum = cheapest.reduce((n,x) => n + x.cost, 0), included = new Set(cheapest.map(x => x.name));
      const affordable = ranked.filter(x => {
        const price = stock(x.c) > 0 ? 0 : cardPrice(x.c);
        const reserve = included.has(x.c.name) ? sum - price : sum - cheapest.at(-1).cost;
        return totalCost() + price + reserve <= budget + .000001;
      });
      if (affordable.length) ranked = affordable;
    }
    add(ranked[0].c, ranked[0].reason);
  }
  const cost = totalCost();
  return {
    deck: { ...deck, cards },
    additions,
    open: 100 - count(),
    cost: Number.isFinite(cost) ? cost : null,
    unpriced: !Number.isFinite(cost),
    theme,
    stats: stats(),
    warnings: [
      ...(stats().lands < landTarget
        ? [
            "Land target could not be met within your budget and available candidates.",
          ]
        : []),
      ...(count() < 100
        ? [
            "Not enough legal, priced or owned candidates to fill every slot. Increase the budget or load more candidates.",
          ]
        : []),
      ...(!Number.isFinite(cost)
        ? [
            "An existing missing card has no price; purchased additions were excluded.",
          ]
        : []),
      ...(Number.isFinite(cost) && cost > budget
        ? [
            "The existing draft already exceeds the missing-card budget; only free owned additions were allowed.",
          ]
        : []),
      "Recommendations use text heuristics and broad EDHREC popularity ranks when available. They are not measured win rates or verified combos.",
    ],
  };
}
