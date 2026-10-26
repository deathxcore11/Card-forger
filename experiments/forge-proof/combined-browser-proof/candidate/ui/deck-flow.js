import {
  cardKey,
  aggregateCards,
  physicalRequirements,
  inventory,
  cardPrice,
  typeText,
} from "./core.js";
import { parseImport } from "./confidence.js";
export function parseDeckImport(text) {
  let section = "main",
    commander = "",
    excluded = 0;
  const sideLines = [],
    lines = [],
    errors = [];
  const raw = String(text).replace(/^\uFEFF/, "");
  if (
    /(?:^|,)\s*"?(?:name|card name|card)"?\s*(?:,|$)/i.test(
      raw.split(/\r?\n/)[0],
    )
  ) {
    const p = parseImport(raw);
    return {
      ...p,
      cards: aggregateCards(p.rows.map((e) => ({ name: e.name, qty: e.qty }))),
      commander: "",
      excluded: 0,
    };
  }
  // MTGO .txt exports have no headings: the sideboard is the block after the last blank line.
  const blocks = raw.trim().split(/\r?\n\s*\r?\n/);
  const qtyOf = (b) => b.split(/\r?\n/).reduce((a, l) => a + (Number(l.trim().match(/^(\d+)\s/)?.[1]) || 0), 0);
  const headed = /^\s*\[?(?:commander|commanders|mainboard|main deck|maindeck|deck|sideboard|maybeboard|considering|companion)\]?:?\s*$/im.test(raw);
  let body = raw;
  if (!headed && blocks.length === 2 && qtyOf(blocks[0]) >= 40 && qtyOf(blocks[1]) > 0 && qtyOf(blocks[1]) <= 15) {
    body = blocks[0];
    for (const l of blocks[1].split(/\r?\n/)) if (/^\s*\d+\s*[xX]?\s+/.test(l)) sideLines.push(l.trim().replace(/\s+\[[^\]]+\]\s*$/, ""));
  }
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    const s = line.trim();
    if (!s || s.startsWith("//") || s.startsWith("#")) continue;
    const heading = s
      .replace(/^\[|\]$/g, "")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();
    if (
      /^(commander|commanders|mainboard|main deck|maindeck|deck|sideboard|maybeboard|considering|companion|creatures|artifacts|instants|sorceries|enchantments|lands|planeswalkers|battles)(?:\s*\(\d+\))?$/.test(
        heading,
      )
    ) {
      section = /^(sideboard|companion)/.test(heading)
        ? "side"
        : /^(maybeboard|considering)/.test(heading)
        ? "excluded"
        : /^command/.test(heading)
          ? "commander"
          : "main";
      continue;
    }
    if (section === "side") {
      const cleanedSide = s.replace(/\s+\[[^\]]+\]\s*$/, "");
      if (/^\d+\s*[xX]?\s+/.test(cleanedSide)) sideLines.push(cleanedSide);
      continue;
    }
    if (section === "excluded") {
      if (/^\d+\s/.test(s)) excluded += Number(s.match(/^\d+/)[0]);
      continue;
    }
    const cleaned = s.replace(/\s+\[[^\]]+\]\s*$/, "");
    if (!/^\d+\s*[xX]?\s+/.test(cleaned)) {
      errors.push({
        line: index + 1,
        reason: "Expected quantity + card name",
        raw: [line],
      });
      continue;
    }
    lines.push(cleaned);
    if (section === "commander" && !commander) {
      const p = parseImport(cleaned);
      commander = p.rows[0]?.name || "";
    }
  }
  if (!lines.length)
    throw Error(
      "No deck cards found. Export text or CSV from the source website and paste or upload it here.",
    );
  const p = parseImport(lines.join("\n")),
    sp = sideLines.length ? parseImport(sideLines.join("\n")) : { rows: [] };
  return {
    ...p,
    errors: [...errors, ...p.errors],
    cards: aggregateCards(p.rows.map((e) => ({ name: e.name, qty: e.qty }))),
    side: aggregateCards(sp.rows.map((e) => ({ name: e.name, qty: e.qty }))),
    commander,
    excluded,
  };
}
export function deckCategory(name, catalog, commander = "") {
  if (cardKey(name) === cardKey(commander)) return "Commander";
  const type = typeText(catalog[cardKey(name)]).split(" // ")[0];
  for (const [test, label] of [
    ["Creature", "Creatures"],
    ["Land", "Lands"],
    ["Planeswalker", "Planeswalkers"],
    ["Artifact", "Artifacts"],
    ["Enchantment", "Enchantments"],
    ["Instant", "Instants"],
    ["Sorcery", "Sorceries"],
    ["Battle", "Battles"],
  ])
    if (type.includes(test)) return label;
  return "Unresolved";
}
export function deckComparison(
  deck,
  collection,
  decks,
  catalog,
  { useReserved = false } = {},
) {
  return physicalRequirements(deck).map((c) => {
    const stock = inventory(collection, c.name, decks, deck.id),
      available = useReserved ? stock.owned : stock.available,
      covered = Math.min(c.qty, available),
      missing = Math.max(0, c.qty - available),
      price = cardPrice(catalog[cardKey(c.name)]);
    return {
      ...c,
      ...stock,
      available,
      covered,
      missing,
      price,
      category: deckCategory(c.name, catalog, deck.commander),
    };
  });
}
export function comparisonTotals(rows) {
  return rows.reduce(
    (a, c) => ({
      copies: a.copies + c.qty,
      covered: a.covered + c.covered,
      missing: a.missing + c.missing,
      pricedGap: a.pricedGap + (c.price === null ? 0 : c.price * c.missing),
      unpriced: a.unpriced + (c.price === null ? c.missing : 0),
    }),
    { copies: 0, covered: 0, missing: 0, pricedGap: 0, unpriced: 0 },
  );
}
export function acquireMissing(
  deck,
  collection,
  decks,
  catalog,
  selection,
  createId,
) {
  const rows = deckComparison(deck, collection, decks, catalog),
    added = [];
  for (const item of selection) {
    const match = rows.find((r) => cardKey(r.name) === cardKey(item.name));
    if (
      !match ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > match.missing
    )
      throw Error(
        "Acquired quantity must be between 1 and the current missing count for " +
          item.name +
          ".",
      );
    if (added.some((e) => cardKey(e.name) === cardKey(item.name)))
      throw Error("Duplicate acquired card.");
    added.push({
      id: createId(),
      name: match.name,
      qty: item.qty,
      set: "",
      collectorNumber: "",
      finish: "nonfoil",
      language: "en",
      condition: "Near Mint",
      location: item.location || "Acquired cards",
      reserved: 0,
      printingId: null,
      printingVerified: false,
      nameVerified: !!catalog[cardKey(item.name)],
      raw: { acquisition: "User-confirmed copies", deckId: deck.id },
    });
  }
  return [...collection, ...added];
}
