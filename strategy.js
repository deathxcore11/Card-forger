import {
  cardKey,
  sumQty,
  roles,
  rulesText,
  typeText,
  isLand,
  commanderEligible,
  identityFits,
  inventory,
  cardPrice,
  deckStats,
  mergeDeckCard,
  aggregateCards,
} from "./core.js";
import { commanderTheme, complexity, completionPlan } from "./planner.js";
import { deckComparison, comparisonTotals } from "./deck-flow.js";
export function safeSourceURL(value) {
  if (!String(value || "").trim()) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Error("Use a complete source link beginning with https://.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Use a normal public website link without credentials.");
  return url.href;
}
export function sourceCredit({
  url = "",
  author = "",
  description = "",
  kind = "User export",
} = {}) {
  const clean = safeSourceURL(url);
  return {
    url: clean,
    website: clean
      ? new URL(clean).hostname.replace(/^www\./, "")
      : "Local export",
    author: String(author).trim().slice(0, 100),
    description: String(description).trim().slice(0, 3000),
    kind,
    importedAt: new Date().toISOString(),
  };
}
export function mtgjsonDeck(payload) {
  const d = payload?.data || payload;
  if (!d || !Array.isArray(d.mainBoard))
    throw Error(
      "This is not an MTGJSON deck file. Use a text/CSV deck export, or an individual MTGJSON deck JSON.",
    );
  const cards = aggregateCards(
    d.mainBoard.map((c) => ({ name: c.name, qty: c.count })),
  );
  for (const c of d.commander || [])
    if (!cards.some((r) => cardKey(r.name) === cardKey(c.name)))
      cards.push({ name: c.name, qty: c.count || 1 });
  for (const c of cards)
    if (
      typeof c.name !== "string" ||
      !c.name ||
      !Number.isInteger(c.qty) ||
      c.qty < 1 ||
      c.qty > 100000
    )
      throw Error("Invalid deck card in JSON.");
  return {
    name: d.name || "Imported precon",
    cards,
    commander: d.commander?.[0]?.name || "",
    commanders: (d.commander || []).map((c) => c.name).filter(Boolean),
    excluded: sumQty((d.sideBoard || []).map((c) => ({ qty: c.count || 0 }))),
    errors: [],
    total: sumQty(cards),
    source: "MTGJSON deck",
    multipleCommanders: (d.commander || []).length > 1,
  };
}
const targetRoles = { Ramp: 10, Draw: 8, Interaction: 8, Protection: 3 };
export function fitExplanation(c, comm, stats, strategy = "Auto") {
  const theme = commanderTheme(comm),
    r = roles(c),
    tribal =
      !!theme.tribe &&
      new RegExp("\\b" + theme.tribe + "\\b", "i").test(typeText(c)),
    needed = r.filter(
      (role) =>
        targetRoles[role] && (stats.counts[role] || 0) < targetRoles[role],
    ),
    focus = r.includes(strategy) && strategy !== "Auto",
    score =
      (tribal ? 5 : 0) +
      needed.length * 7 +
      r.filter((x) => theme.roles.includes(x)).length * 3 +
      (focus ? 4 : 0) +
      Math.min(3, r.filter((x) => targetRoles[x]).length * 1.5) -
      Math.max(0, (c.cmc || 0) - 4) * 1.5;
  return {
    score,
    reasons: [
      ...(tribal ? [theme.tribe + " theme"] : []),
      ...needed.map((role) => role.toLowerCase() + " gap"),
      ...(focus ? [strategy.toLowerCase() + " plan"] : []),
    ],
    roles: r,
    complexity: complexity(c),
  };
}
export function collectionIdeas(
  collection,
  decks,
  catalog,
  { includeUnowned = false } = {},
) {
  const results = [];
  for (const c of [
    ...new Map(
      Object.values(catalog)
        .filter(commanderEligible)
        .map((c) => [cardKey(c.name), c]),
    ).values(),
  ]
    .filter(
      (c) => includeUnowned || inventory(collection, c.name, decks).owned > 0,
    )
    .slice(0, 36)) {
    const own = inventory(collection, c.name, decks);
    if (!includeUnowned && !own.owned) continue;
    const theme = commanderTheme(c),
      focus = [
        ...(theme.tribe ? ["Tribal"] : []),
        ...theme.roles.filter((r) =>
          [
            "Tokens",
            "Graveyard",
            "Spells",
            "Artifacts",
            "Lifegain",
            "Landfall",
          ].includes(r),
        ),
        "Value",
      ].slice(0, 3);
    for (const plan of [...new Set(focus)]) {
      const d = {
        id: "idea:" + c.id + ":" + plan,
        name: c.name + " · " + (plan === "Tribal" ? theme.tribe : plan),
        format: "Commander",
        commander: c.name,
        strategy: plan === "Tribal" || plan === "Value" ? "Auto" : plan,
        budget: 0,
        locked: false,
        cards: [{ name: c.name, qty: 1 }],
      };
      let completed;
      try {
        completed = completionPlan(d, collection, decks, catalog, {
          budget: 0,
          preferOwned: true,
          simple: plan === "Value",
        });
      } catch {
        continue;
      }
      const rows = deckComparison(completed.deck, collection, decks, catalog),
        totals = comparisonTotals(rows),
        themeCards = completed.deck.cards
          .filter((r) => {
            const m = catalog[cardKey(r.name)];
            return (
              !isLand(m) &&
              (plan === "Tribal"
                ? new RegExp("\\b" + theme.tribe + "\\b", "i").test(typeText(m))
                : plan === "Value"
                  ? roles(m).some((x) => targetRoles[x])
                  : roles(m).includes(plan))
            );
          })
          .reduce((n, r) => n + r.qty, 0);
      results.push({
        commander: c,
        deck: completed.deck,
        plan,
        owned: own.owned,
        available: totals.covered,
        slots: sumQty(completed.deck.cards),
        open: completed.open,
        themeCards,
        score: totals.covered + themeCards * 1.5,
        reason:
          plan === "Tribal"
            ? theme.tribe + " creatures supported by commander text"
            : plan === "Value"
              ? "A simpler mix of mana, draw and interaction"
              : plan + " effects recognized in your available cards",
        difficulty:
          plan === "Graveyard" || plan === "Spells"
            ? "More sequencing"
            : "Some bookkeeping",
      });
    }
  }
  return results.sort(
    (a, b) => b.score - a.score || a.deck.name.localeCompare(b.deck.name),
  );
}
export function upgradeSuggestions(
  deck,
  collection,
  decks,
  catalog,
  { budget = 25, simple = false, maxSwaps = 6 } = {},
) {
  const comm = catalog[cardKey(deck.commander)];
  if (deck.format !== "Commander" || !commanderEligible(comm))
    throw Error("Upgrades currently support verified single-commander decks.");
  const stats = deckStats(deck, catalog),
    cuts = deck.cards.filter(
      (r) =>
        cardKey(r.name) !== cardKey(deck.commander) &&
        catalog[cardKey(r.name)] &&
        !isLand(catalog[cardKey(r.name)]),
    ),
    used = new Set(deck.cards.map((r) => cardKey(r.name))),
    incoming = Object.values(catalog).filter(
      (c) =>
        !used.has(cardKey(c.name)) &&
        !isLand(c) &&
        c.legalities?.commander === "legal" &&
        identityFits(c, comm),
    ),
    pairs = [],
    cutData = cuts.map((c) => ({
      row: c,
      old: catalog[cardKey(c.name)],
      fit: fitExplanation(catalog[cardKey(c.name)], comm, stats, deck.strategy),
    }));
  for (const add of incoming) {
    const stock = inventory(collection, add.name, decks, deck.id),
      price = cardPrice(add),
      cost = stock.available > 0 ? 0 : price;
    if (cost === null || cost > budget) continue;
    const af = fitExplanation(add, comm, stats, deck.strategy);
    for (const data of cutData) {
      const cut = data.row,
        old = data.old,
        cf = data.fit,
        // Every core job the cut does that the new card doesn't. Losing one the deck is
        // short on costs more than losing one it has plenty of.
        lost = cf.roles.filter((role) => targetRoles[role] && !af.roles.includes(role)),
        lostScarce = lost.filter((role) => (stats.counts[role] || 0) <= targetRoles[role]),
        gainsJob = af.roles.some((role) => targetRoles[role] && !cf.roles.includes(role)),
        improvement =
          af.score -
          cf.score -
          lostScarce.length * 9 -
          (lost.length - lostScarce.length) * 4 +
          (simple ? (cf.complexity.weight - af.complexity.weight) * 2 : 0);
      if (improvement < 2) continue;
      // A creature-type match alone never justifies cutting a card that does a real job.
      if (lost.length && !gainsJob) continue;
      const gainRole = af.reasons.length
          ? af.reasons.join(", ")
          : "lower curve or stronger recognized utility",
        curve =
          (old.cmc || 0) > (add.cmc || 0)
            ? `Mana value ${old.cmc || 0} → ${add.cmc || 0}.`
            : "Mana value does not decrease.";
      pairs.push({
        add: add.name,
        cut: cut.name,
        qty: 1,
        cost,
        owned: stock.available > 0,
        score: improvement,
        role: af.roles.filter((r) => targetRoles[r]).join(" / ") || "Theme",
        reason: `Adds ${gainRole}. ${curve} Review the cut’s unique abilities before replacing it.`,
        complexity: af.complexity.level,
        oldPrice: cardPrice(old),
        price,
      });
    }
  }
  pairs.sort(
    (a, b) =>
      b.score - a.score || a.cost - b.cost || a.add.localeCompare(b.add),
  );
  let spent = 0;
  const selected = [],
    adds = new Set(),
    removed = new Set();
  for (const p of pairs) {
    if (
      adds.has(cardKey(p.add)) ||
      removed.has(cardKey(p.cut)) ||
      spent + p.cost > budget + 0.00001
    )
      continue;
    selected.push(p);
    adds.add(cardKey(p.add));
    removed.add(cardKey(p.cut));
    spent += p.cost;
    if (selected.length === maxSwaps) break;
  }
  return {
    swaps: selected,
    spent,
    budget,
    stats,
    base: JSON.stringify(deck.cards),
    count: sumQty(deck.cards),
  };
}
export function applyUpgradeSwaps(
  deck,
  swaps,
  collection,
  decks,
  catalog,
  budget,
) {
  let next = { ...deck, cards: deck.cards.map((c) => ({ ...c })) },
    spent = 0;
  const added = new Set(),
    removed = new Set(),
    comm = catalog[cardKey(deck.commander)];
  for (const swap of swaps) {
    if (added.has(cardKey(swap.add)) || removed.has(cardKey(swap.cut)))
      throw Error("Each addition and cut must be unique.");
    const old = next.cards.find((c) => cardKey(c.name) === cardKey(swap.cut)),
      candidate = catalog[cardKey(swap.add)];
    if (
      !old ||
      cardKey(swap.cut) === cardKey(deck.commander) ||
      !candidate ||
      isLand(candidate) ||
      candidate.legalities?.commander !== "legal" ||
      !identityFits(candidate, comm) ||
      next.cards.some((c) => cardKey(c.name) === cardKey(swap.add))
    )
      throw Error("This swap is no longer valid. Regenerate suggestions.");
    const stock = inventory(collection, swap.add, decks, deck.id),
      cost = stock.available ? 0 : cardPrice(candidate);
    if (cost === null) throw Error("An addition is now unpriced.");
    spent += cost;
    if (spent > budget + 0.00001)
      throw Error("Selected additions exceed this upgrade budget.");
    next = mergeDeckCard(mergeDeckCard(next, swap.cut, -1), swap.add, 1);
    added.add(cardKey(swap.add));
    removed.add(cardKey(swap.cut));
  }
  if (sumQty(next.cards) !== sumQty(deck.cards))
    throw Error("Swap must preserve deck size.");
  return { deck: next, spent };
}
