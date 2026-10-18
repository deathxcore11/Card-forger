import { formatOf, canLead, legalityIn } from "./formats.js";
import { tcgFallback, myPrice } from "./mtg-tcgprice.js";

// Called millions of times while building and scoring decks: normalised names are remembered.
const keyMemo = new Map();
export const cardKey = (s) => {
  const raw = String(s || "");
  let k = keyMemo.get(raw);
  if (k === undefined) {
    k = cardKeyRaw(raw);
    if (keyMemo.size > 20000) keyMemo.clear();
    keyMemo.set(raw, k);
  }
  return k;
};
const cardKeyRaw = (s) =>
  String(s || "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
export const sumQty = (items) =>
  items.reduce((a, c) => a + (Number(c.qty) || 0), 0);
export const rulesText = (c) =>
  c?.oracle_text ||
  c?.card_faces?.map((f) => f.oracle_text || "").join("\n") ||
  "";
export const typeText = (c) => c?.type_line || "";
export const isLand = (c) => /\bLand\b/.test(typeText(c).split(" // ")[0]);
export const isBasic = (c) => /^Basic(?: Snow)? Land/.test(typeText(c));
export const commanderEligible = (c) =>
  !!c &&
  (/Legendary.*Creature/.test(typeText(c)) ||
    /can be your commander/i.test(rulesText(c)));
export function roles(c) {
  const text = rulesText(c).toLowerCase(),
    t = typeText(c),
    out = [];
  if (isLand(c)) return ["Land"];
  if (
    /add (?:\{|one mana|two mana|three mana)|search your library for (?:a |up to .*?)(?:basic )?land|spells .*cost .*less/.test(
      text,
    )
  )
    out.push("Ramp");
  if (
    /draw (?:a |one |two |three |x |\d)|exile the top .*?(?:play|cast)|you may (?:play|cast).*top/.test(
      text,
    )
  )
    out.push("Draw");
  if (
    /destroy target|exile target|counter target|destroy all|exile all|deals .*damage to (?:any|target)/.test(
      text,
    )
  )
    out.push("Interaction");
  if (/hexproof|indestructible|protection from|change the target/.test(text))
    out.push("Protection");
  if (/create .*token|populate/.test(text)) out.push("Tokens");
  if (/graveyard|dies|sacrifice/.test(text)) out.push("Graveyard");
  if (/instant|sorcery/.test(text) && !isLand(c)) out.push("Spells");
  if (/Dragon/.test(t) || /dragon/.test(text)) out.push("Dragons");
  if (/artifact/.test(text) || /Artifact/.test(t)) out.push("Artifacts");
  if (/gain .*life|lifelink/.test(text)) out.push("Lifegain");
  if (/landfall|land .*enters|lands? .*graveyard/.test(text))
    out.push("Landfall");
  if (/Creature/.test(t)) out.push("Creature");
  return [...new Set(out.length ? out : ["Utility"])];
}
export function inventory(entries, name, decks = [], excludeId) {
  const k = cardKey(name),
    items = entries.filter((x) => cardKey(x.name) === k),
    owned = sumQty(items),
    external = items.reduce((a, c) => a + (c.reserved || 0), 0),
    allocated = decks
      .filter((d) => d.locked && d.id !== excludeId)
      .reduce(
        (a, d) =>
          a +
          [...(Array.isArray(d.cards) ? d.cards : []), ...(Array.isArray(d.side) ? d.side : [])]
            .filter((c) => c && cardKey(c.name) === k && Number.isInteger(c.qty) && c.qty > 0 && c.qty <= 100000)
            .reduce((s, c) => s + c.qty, 0),
        0,
      );
  return {
    owned,
    reserved: external + allocated,
    available: Math.max(0, owned - external - allocated),
  };
}
export function mergeDeckCard(deck, name, qty = 1) {
  const clone = { ...deck, cards: deck.cards.map((x) => ({ ...x })) },
    k = cardKey(name),
    c = clone.cards.find((x) => cardKey(x.name) === k);
  if (c) c.qty += qty;
  else clone.cards.push({ name, qty });
  clone.cards = clone.cards.filter((x) => x.qty > 0);
  return clone;
}
export function identityFits(c, commander) {
  if (!c || !commander) return false;
  const allowed = new Set(commander.color_identity || []);
  return (c.color_identity || []).every((x) => allowed.has(x));
}
export function aggregateCards(cards) {
  const map = new Map();
  for (const c of cards) {
    const k = cardKey(c.name);
    if (map.has(k)) map.get(k).qty += c.qty;
    else map.set(k, { ...c });
  }
  return [...map.values()];
}
// One physical pool serves both zones; the same owned copy cannot be in main and side.
export const physicalRequirements = (deck) => aggregateCards([...(deck.cards || []), ...(deck.side || [])]);
export function effectiveCopyLimit(card, format) {
  if (legalityIn(card, format) === "restricted") return 1;
  if (isBasic(card) || /any number of cards named/i.test(rulesText(card))) return Infinity;
  const printed = rulesText(card).match(/up to (\w+) (?:of )?cards named/i)?.[1]?.toLowerCase();
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return printed ? words[printed] || Number(printed) || format.copies : format.copies;
}
export function gaps(deck, entries, decks) {
  return physicalRequirements(deck)
    .map((c) => ({ ...c, ...inventory(entries, c.name, decks, deck.id) }))
    .map((c) => ({ ...c, missing: Math.max(0, c.qty - c.available) }));
}
export function cardPrice(c, finish = "nonfoil") {
  const p =
    c?.prices?.[
      finish === "foil"
        ? "usd_foil"
        : finish === "etched"
          ? "usd_etched"
          : "usd"
    ];
  if (p !== null && p !== undefined && p !== "" && Number.isFinite(Number(p))) return Number(p);
  // Unpriced on Scryfall: TCGplayer's price for the same product, then the player's own price.
  return tcgFallback(c, finish)?.value ?? myPrice(c, finish);
}
// A name-based deck can use another available finish when a printing has no regular price.
// Physical collection lots still use cardPrice with their exact finish.
export function namePrice(card, quote = (finish) => cardPrice(card, finish)) {
  for (const finish of ["nonfoil", "foil", "etched"]) {
    if (finish !== "nonfoil" && Array.isArray(card?.finishes) && !card.finishes.includes(finish)) continue;
    const value = quote(finish);
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  }
  return null;
}
export function validateDeck(deck, catalog, entries, decks = []) {
  const f = formatOf(deck),
    issues = [],
    target = f.size,
    count = sumQty(deck.cards),
    comm = f.commander ? catalog[cardKey(deck.commander)] : null;
  if (f.exact ? count !== target : count < target)
    issues.push({
      kind: "count",
      text: f.exact
        ? `${count}/${target} cards. ${count < target ? target - count + " slots remain." : count - target + " cards over."}`
        : `${count} cards. ${f.name} needs at least ${target}; ${target - count} to go.`,
    });
  if (f.commander) {
    if(f.id==="paupercommander"&&comm&&typeof comm.pdhCommander!=="boolean")issues.push({kind:"unverified",text:"Commander eligibility has not been verified for Pauper Commander."});
    else if (!canLead(comm, f))
      issues.push({
        kind: "commander",
        text: f.commander === "planeswalker" ? "Choose a planeswalker as your Oathbreaker." : `Choose a card that can lead a ${f.name} deck.`,
      });
    if (!deck.cards.some((c) => cardKey(c.name) === cardKey(deck.commander)))
      issues.push({
        kind: "commander",
        text: "Commander is not included in deck count.",
      });
  }
  for (const c of aggregateCards(deck.cards)) {
    const m = catalog[cardKey(c.name)];
    if (!m) {
      issues.push({
        kind: "unverified",
        text: c.name + ": card data not resolved.",
      });
      continue;
    }
    if (f.commander && comm && !identityFits(m, comm))
      issues.push({
        kind: "color",
        text: c.name + ": outside commander color identity.",
      });
    const leader=f.id==="paupercommander"&&cardKey(c.name)===cardKey(deck.commander);
    const legal = leader?(m.pdhCommander===true?"legal":m.pdhCommander===false?"not_legal":null):legalityIn(m, f);
    if(f.legality&&legal===null)issues.push({kind:"unverified",text:`${c.name}: legality data not loaded.`});
    if (legal === "banned" || legal === "not_legal")
      issues.push({
        kind: "legality",
        text: c.name + ": " + (legal === "banned" ? "banned" : "not legal") + " in " + f.name + ".",
      });
    const limit = effectiveCopyLimit(m, f);
    if (c.qty > limit) issues.push({
      kind: limit === 1 && legal !== "restricted" ? "singleton" : "copies",
      text: c.name + (legal === "restricted" ? ": restricted in " + f.name + " — one copy only." : `: more than ${limit} copies.`),
    });
  }
  // Sideboard: at most 15 cards, legal in the format, and the copy limit counts main + side.
  const side = aggregateCards(deck.side || []).filter((r) => r.qty > 0),
    sideN = side.reduce((a, r) => a + r.qty, 0);
  if (sideN > 15)
    issues.push({ kind: "sideboard", text: `Sideboard has ${sideN} cards; the limit is 15.` });
  for (const r of side) {
    const m = catalog[cardKey(r.name)];
    if (!m) { issues.push({ kind: "unverified", text: r.name + " (sideboard): card data not resolved." }); continue; }
    const leader=f.id==="paupercommander"&&cardKey(c.name)===cardKey(deck.commander);
    const legal = leader?(m.pdhCommander===true?"legal":m.pdhCommander===false?"not_legal":null):legalityIn(m, f);
    if(f.legality&&legal===null)issues.push({kind:"unverified",text:`${r.name}: legality data not loaded.`});
    if (legal === "banned" || legal === "not_legal")
      issues.push({ kind: "legality", text: `${r.name} (sideboard): ${legal === "banned" ? "banned" : "not legal"} in ${f.name}.` });
    const inMain = (deck.cards || []).filter((c) => cardKey(c.name) === cardKey(r.name)).reduce((a, c) => a + c.qty, 0);
    const limit = effectiveCopyLimit(m, f);
    if (inMain + r.qty > limit)
      issues.push({ kind: "copies", text: `${r.name}: ${inMain + r.qty} copies across main deck and sideboard; ${f.name} allows ${limit}${legal === "restricted" ? " (restricted)" : ""}.` });
  }
  const missing = gaps(deck, entries, decks).reduce((a, c) => a + c.missing, 0);
  return {
    count,
    target,
    issues,
    missing,
    ready: issues.length === 0 && missing === 0,
  };
}
export function deckStats(deck, catalog) {
  let lands = 0,
    spellQty = 0,
    manaTotal = 0,
    unknown = 0;
  const counts = { Ramp: 0, Draw: 0, Interaction: 0, Protection: 0, Tokens: 0 },
    curve = [0, 0, 0, 0, 0, 0, 0];
  for (const c of deck.cards) {
    const m = catalog[cardKey(c.name)] || (/^(?:Snow-Covered )?(?:Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(c.name) ? {name:c.name,type_line:"Basic Land"} : null);
    if (!m) {
      unknown += c.qty;
      continue;
    }
    if (isLand(m)) lands += c.qty;
    else {
      spellQty += c.qty;
      manaTotal += (Number(m.cmc) || 0) * c.qty;
      curve[Math.min(6, Math.floor(Number(m.cmc) || 0))] += c.qty;
    }
    for (const r of roles(m)) if (r in counts) counts[r] += c.qty;
  }
  return {
    lands,
    avg: spellQty ? manaTotal / spellQty : null,
    counts,
    curve,
    unknown,
  };
}
export function discover(entries, catalog, decks = [], includeUnowned = false) {
  return Object.values(catalog)
    .filter(commanderEligible)
    .filter(
      (c) => includeUnowned || inventory(entries, c.name, decks).owned > 0,
    )
    .map((comm) => {
      const support = Object.values(catalog).filter(
        (c) =>
          cardKey(c.name) !== cardKey(comm.name) &&
          identityFits(c, comm) &&
          !isLand(c) &&
          c.legalities?.commander === "legal" &&
          inventory(entries, c.name, decks).available > 0,
      );
      const own = inventory(entries, comm.name, decks),
        r = roles(comm),
        theme = support.filter((c) =>
          roles(c).some(
            (x) =>
              r.includes(x) &&
              !["Creature", "Utility", "Interaction"].includes(x),
          ),
        ).length;
      return {
        card: comm,
        support: support.length,
        theme,
        owned: own.owned,
        available: own.available,
        score: support.length + theme * 2,
      };
    })
    .sort(
      (a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name),
    );
}
export function suggestDeck(deck, entries, catalog, decks = []) {
  const commander = catalog[cardKey(deck.commander)];
  if (deck.format === "Commander" && !commanderEligible(commander))
    throw Error("Choose a verified commander first.");
  const target = deck.format === "Commander" ? 100 : 60,
    wantedLands = deck.format === "Commander" ? 37 : 24,
    chosen = [],
    seen = new Set();
  if (commander) {
    chosen.push({ name: commander.name, qty: 1 });
    seen.add(cardKey(commander.name));
  }
  const pool = Object.values(catalog).filter(
    (c) =>
      inventory(entries, c.name, decks, deck.id).available > 0 &&
      !seen.has(cardKey(c.name)) &&
      (deck.format !== "Commander" ||
        (identityFits(c, commander) && c.legalities?.commander === "legal")),
  );
  const wantedRoles = {
    Ramp: deck.format === "Commander" ? 10 : 6,
    Draw: deck.format === "Commander" ? 10 : 6,
    Interaction: 8,
    Protection: 3,
  };
  const ordered = pool
    .filter((c) => !isLand(c))
    .sort((a, b) => {
      const score = (c) =>
        (roles(c).includes(deck.strategy) ? 4 : 0) +
        roles(c).filter((r) => r in wantedRoles).length * 2 -
        Math.max(0, (c.cmc || 0) - 4) * 0.35;
      return score(b) - score(a) || a.name.localeCompare(b.name);
    });
  for (const c of ordered) {
    if (sumQty(chosen) >= target - wantedLands) break;
    const inv = inventory(entries, c.name, decks, deck.id),
      qty =
        deck.format === "Commander" &&
        !/any number of cards named/i.test(rulesText(c))
          ? 1
          : Math.min(inv.available, deck.format === "Commander" ? target : 4);
    chosen.push({
      name: c.name,
      qty: Math.min(qty, target - wantedLands - sumQty(chosen)),
    });
    seen.add(cardKey(c.name));
  }
  for (const c of pool
    .filter(isLand)
    .sort((a, b) => Number(isBasic(b)) - Number(isBasic(a)))) {
    if (
      chosen
        .filter((x) => isLand(catalog[cardKey(x.name)]))
        .reduce((a, c) => a + c.qty, 0) >= wantedLands
    )
      break;
    const existingLands = chosen
        .filter((x) => isLand(catalog[cardKey(x.name)]))
        .reduce((a, c) => a + c.qty, 0),
      qty =
        deck.format === "Commander" && !isBasic(c)
          ? 1
          : inventory(entries, c.name, decks, deck.id).available;
    chosen.push({
      name: c.name,
      qty: Math.min(qty, wantedLands - existingLands, target - sumQty(chosen)),
    });
  }
  return { ...deck, cards: chosen.filter((x) => x.qty > 0) };
}
export function shoppingCost(items, catalog, shipping = 0, tax = 0) {
  let subtotal = 0,
    unknown = 0;
  for (const i of items) {
    const p =
      i.priceOverride ??
      cardPrice(catalog[cardKey(i.name)], i.finish || "nonfoil");
    if (p === null || p === undefined) unknown += i.qty;
    else subtotal += p * i.qty;
  }
  return { subtotal, unknown, total: (subtotal + shipping) * (1 + tax / 100) };
}
export function drawHand(cards, n = 7, random = Math.random) {
  const pool = cards.flatMap((c) =>
    Array.from({ length: c.qty }, () => c.name),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { hand: pool.slice(0, n), library: pool.slice(n) };
}
export function atLeastLands(total, lands, draws, min) {
  if (total < 1 || draws > total || min > draws || lands > total) return null;
  const comb = (n, k) => {
    if (k < 0 || k > n) return 0;
    let x = 1;
    for (let i = 1; i <= Math.min(k, n - k); i++) x = (x * (n - i + 1)) / i;
    return x;
  };
  let p = 0;
  for (let k = min; k <= Math.min(lands, draws); k++)
    p += (comb(lands, k) * comb(total - lands, draws - k)) / comb(total, draws);
  return p;
}
export const exportDeck = (cards) =>
  cards
    .filter((c) => c.qty > 0)
    .map((c) => `${c.qty} ${c.name}`)
    .join("\n");
// A whole deck as text, with its sideboard under the "Sideboard" header that Arena, MTGO and most
// sites read.
export const exportDeckText = (d) => exportDeck(d.cards || []) + ((d.side || []).some((r) => r.qty > 0) ? "\n\nSideboard\n" + exportDeck(d.side) : "");

