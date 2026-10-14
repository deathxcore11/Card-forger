import { functionalIn } from "./deck-safety.js";
// Format-aware deck generator: builds a full, legal deck around one or more
// seed cards, preferring cards you own and staying inside a purchase budget.
// Works for every constructed format in formats.js (60-card, singleton and
// command-zone formats). Scores are transparent rules of thumb, not predictions.
import { cardKey, rulesText, typeText, isLand, isBasic, roles, aggregateCards, sumQty } from "./core.js";
import { engineRoles } from "./insights.js";
import { formatOf, canLead, legalityIn } from "./formats.js";
import { splitBasics } from "./extras.js";

const BASIC = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" };
const THEMES = ["Tokens", "Graveyard", "Spells", "Dragons", "Artifacts", "Lifegain", "Landfall"];
const TIERS = [0, 10, 25, 50, 100, Infinity];
export const BUDGET_TIERS = TIERS;

// Creature types and similar subtypes on a card ("Goblin Warrior" → Goblin, Warrior).
export const subtypes = (c) =>
  (typeText(c).split(" // ")[0].split("—")[1] || "").trim().split(/\s+/).filter((w) => w.length > 2);

const ident = (c) => c?.color_identity || [];
export const fitsColors = (c, colors) => ident(c).every((x) => colors.includes(x));

// Search terms for the seed's theme, used to fetch candidates (Scryfall syntax).
export function themeQuery(seed) {
  const subs = subtypes(seed).filter((s) => /Creature|Kindred|Tribal/.test(typeText(seed))).slice(0, 2),
    tags = roles(seed).filter((r) => THEMES.includes(r)),
    terms = [
      ...subs.map((s) => `t:${s.toLowerCase()} or o:${s.toLowerCase()}`),
      ...tags.map((t) => ({ Tokens: 'o:token', Graveyard: 'o:graveyard', Spells: '(t:instant or t:sorcery or o:"instant or sorcery")', Dragons: "t:dragon", Artifacts: "o:artifact", Lifegain: 'o:"gain" o:life', Landfall: "o:landfall" })[t]),
    ];
  return terms.length ? "(" + terms.join(" or ") + ")" : "";
}

// How well a candidate fits the seed and a working deck. Higher is better.
export function scoreCard(c, seedTags, seedSubs, { free = 0, size = 60 } = {}) {
  const r = roles(c),
    e = engineRoles(c),
    cmc = Number(c.cmc) || 0,
    rank = size >= 100 ? c.edhrec_rank || null : null;
  let s = 0;
  s += r.filter((x) => seedTags.includes(x)).length * 3;
  s += subtypes(c).filter((x) => seedSubs.includes(x)).length * 4;
  if (seedSubs.some((x) => new RegExp("\\b" + x + "s?\\b", "i").test(rulesText(c)))) s += 2;
  if (e.includes("Removal")) s += 2.5;
  if (e.includes("Draw")) s += 1.5;
  if (e.includes("Ramp")) s += size >= 100 ? 2 : 0.5;
  if (e.includes("Wipe")) s += size >= 100 ? 1.5 : 0.5;
  if (/\bCreature\b/.test(typeText(c))) s += 1;
  s -= Math.max(0, cmc - (size >= 100 ? 4 : 3)) * 1.4;
  if (rank) s += Math.max(0, 3.5 - Math.log10(rank));
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
export function buildDeck({ format, seeds = [], base = [], catalog, available = () => 0, price = (c) => null, budget = 25, colors = null, commander = null }) {
  const f = formatOf(format);
  if (f.id === "limited") throw Error("Limited decks come from the cards you open — build those by hand.");
  if ((!Number.isFinite(budget) && budget!==Infinity) || budget < 0) throw Error("Enter a budget of $0 or more.");
  const size = f.size,
    lead = f.commander ? commander || seeds.find((s) => canLead(s, f)) : null;
  if (f.commander && !lead) throw Error(`${f.name} decks need a card that can lead them (${f.commander === "planeswalker" ? "a planeswalker" : "a legendary creature"}).`);
  const legalStatus = (c) => legalityIn(c, f),
    isLegal = (c) => functionalIn(c,f) && (!f.legality || ["legal", "restricted"].includes(legalStatus(c))),
    maxCopies = (c) => (isBasic(c) || /any number of cards named/i.test(rulesText(c)) ? Infinity : legalStatus(c) === "restricted" ? 1 : f.copies);
  // Colors: the leader's identity, else the seeds', else the base list's.
  let deckColors = colors || (lead ? ident(lead) : [...new Set([...seeds, ...base.map((b) => catalog[cardKey(b.name)])].flatMap(ident))]);
  if (!deckColors.length) deckColors = ["C"];
  const seedTags = [...new Set(seeds.flatMap((s) => roles(s).filter((r) => THEMES.includes(r))))],
    seedSubs = [...new Set(seeds.flatMap(subtypes))],
    rows = new Map(),
    warnings = [];
  let spent = 0,
    unknown = 0;
  const qtyOf = (c) => rows.get(cardKey(c.name))?.qty || 0,
    unitCost = (c) => price(c),
    // Cost of going from `have` to `want` copies, after using free owned copies.
    costFor = (c, have, want) => {
      const free = Math.max(0, available(c.name) - have),
        buy = Math.max(0, want - have - free),
        p = unitCost(c);
      return buy ? (p === null ? Infinity : buy * p) : 0;
    },
    put = (c, n, why) => {
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
    const extra = costFor(lead, 0, 1);
    if (extra === Infinity) unknown++;
    else spent += extra;
    put(lead, 1, "Leads the deck");
  }

  const pool = [...new Map(Object.values(catalog).filter((c) => c?.name && !isLand(c) && isLegal(c) && fitsColors(c, deckColors)).map((c) => [cardKey(c.name), c])).values()],
    scored = pool.map((c) => ({ c, s: scoreCard(c, seedTags, seedSubs, { free: available(c.name), size }) }));
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
  while(remaining.length){
    const counts=new Map();for(const row of rows.values())for(const role of engineRoles(catalog[cardKey(row.name)] || {}))counts.set(role,(counts.get(role)||0)+row.qty);
    const targets=f.commander?{Removal:8,Draw:10,Ramp:10,Wipe:3}:{Removal:6,Draw:6,Ramp:4,Wipe:2};
    const adaptive=x=>x.s+engineRoles(x.c).reduce((n,r)=>n+(targets[r]===undefined?0:(counts.get(r)||0)<targets[r]?3:-3),0);
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
      if (extra !== Infinity && spent + extra + reserve <= budget + 1e-6) {
        take = n;
        spent += extra;
        break;
      }
    }
    if (take) put(c, take, isSeed ? "Your build-around card" : reasonFor(c, seedTags, seedSubs, available(c.name) >= take));
  }

  // Second pass: fill any slots still open with the cheapest legal cards that fit.
  if (spellTarget - nonland() > 0) {
    const byPrice = scored
      .map((x) => ({ ...x, unit: available(x.c.name) > qtyOf(x.c) ? 0 : unitCost(x.c) }))
      .filter((x) => x.unit !== null)
      .sort((a, b) => a.unit - b.unit || b.s - a.s);
    for (const { c } of byPrice) {
      const left = spellTarget - nonland();
      if (left <= 0) break;
      const have = qtyOf(c),
        room = Math.min(maxCopies(c) - have, left, f.copies === 1 ? 1 : 4);
      for (let n = room; n >= 1; n--) {
        const extra = costFor(c, have, have + n);
        if (extra !== Infinity && spent + extra <= budget + 1e-6) {
          spent += extra;
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
    if (extra !== Infinity && spent + extra <= budget + 1e-6) {
      spent += extra;
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
    const real = deckColors.filter((x) => x !== "C");
    if (!real.length) put({ name: BASIC.C }, basicsNeeded, "Basic land");
    else {
      const split = Object.values(pips).some(Boolean) ? splitBasics(Object.fromEntries(real.map((k) => [k, pips[k] || 1])), basicsNeeded) : splitBasics(Object.fromEntries(real.map((k) => [k, 1])), basicsNeeded);
      for (const [k, n] of Object.entries(split)) if (n) put({ name: BASIC[k] }, n, "Basic land");
    }
  }

  const cards = [...rows.values()].filter((r) => r.qty > 0),
    total = sumQty(cards),
    open = Math.max(0, size - total);
  if(total>size)throw Error("Generated deck exceeds its target; no version was applied.");
  if (open) warnings.push(`${open} slots still open — raise the budget or add more cards to your collection.`);
  if (unknown) warnings.push(`${unknown} card${unknown > 1 ? "s have" : " has"} no current price.`);
  const owned = cards.reduce((a, r) => a + Math.min(r.qty, isBasic(catalog[cardKey(r.name)]) || BASIC_NAMES.has(r.name) ? r.qty : available(r.name)), 0);
  return { format: f.name, colors: deckColors, commander: lead?.name || "", cards, cost: spent, total, size, open, owned, warnings, lands: landsIn() };
}

const BASIC_NAMES = new Set(Object.values(BASIC));

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
  const tags = [...new Set(seeds.flatMap((s) => roles(s).filter((r) => THEMES.includes(r))))],
    subs = [...new Set(seeds.flatMap(subtypes))];
  return (c) => scoreCard(c, tags, subs, { size });
}
