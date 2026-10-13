// Every deck format CardStashy builds for, with its deck-construction rules.
// `legality` is the Scryfall legalities key (banned/restricted lists come from
// Scryfall's card data, so they stay current without app updates).
//   size     – required deck size; `exact` means exactly that many, otherwise a minimum
//   copies   – max copies of a non-basic card (1 = singleton)
//   commander – null, or what may lead the deck: "legend" (legendary creature or
//               "can be your commander"), "planeswalker" (Oathbreaker), "creature" (Pauper Commander)
//   life     – starting life total
export const FORMATS = [
  // Paper constructed
  { id: "standard", name: "Standard", legality: "standard", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed" },
  { id: "pioneer", name: "Pioneer", legality: "pioneer", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed" },
  { id: "modern", name: "Modern", legality: "modern", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed" },
  { id: "legacy", name: "Legacy", legality: "legacy", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed" },
  { id: "vintage", name: "Vintage", legality: "vintage", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed", note: "Restricted cards: one copy each." },
  { id: "pauper", name: "Pauper", legality: "pauper", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed", note: "Commons only." },
  { id: "premodern", name: "Premodern", legality: "premodern", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed" },
  { id: "oldschool", name: "Old School", legality: "oldschool", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed" },
  { id: "penny", name: "Penny Dreadful", legality: "penny", size: 60, copies: 4, sideboard: 15, life: 20, group: "Constructed" },
  // Commander family
  { id: "commander", name: "Commander", legality: "commander", size: 100, exact: true, copies: 1, commander: "legend", life: 40, group: "Commander" },
  { id: "duel", name: "Duel Commander", legality: "duel", size: 100, exact: true, copies: 1, commander: "legend", life: 20, group: "Commander" },
  { id: "predh", name: "PreDH", legality: "predh", size: 100, exact: true, copies: 1, commander: "legend", life: 40, group: "Commander" },
  { id: "paupercommander", name: "Pauper Commander", legality: "paupercommander", size: 100, exact: true, copies: 1, commander: "creature", life: 30, group: "Commander", note: "Commander: an uncommon creature. Other cards: commons." },
  { id: "oathbreaker", name: "Oathbreaker", legality: "oathbreaker", size: 60, exact: true, copies: 1, commander: "planeswalker", life: 20, group: "Commander", note: "Leader: a planeswalker (your Oathbreaker). Add its signature spell to the list." },
  // MTG Arena / digital
  { id: "brawl", name: "Brawl", legality: "brawl", size: 100, exact: true, copies: 1, commander: "brawl", life: 25, group: "Arena", note: "Arena's 100-card Brawl. A planeswalker can lead too." },
  { id: "standardbrawl", name: "Standard Brawl", legality: "standardbrawl", size: 60, exact: true, copies: 1, commander: "brawl", life: 25, group: "Arena" },
  { id: "historic", name: "Historic", legality: "historic", size: 60, copies: 4, sideboard: 15, life: 20, group: "Arena" },
  { id: "timeless", name: "Timeless", legality: "timeless", size: 60, copies: 4, sideboard: 15, life: 20, group: "Arena" },
  { id: "alchemy", name: "Alchemy", legality: "alchemy", size: 60, copies: 4, sideboard: 15, life: 20, group: "Arena" },
  { id: "gladiator", name: "Gladiator", legality: "gladiator", size: 100, exact: true, copies: 1, life: 30, group: "Arena" },
  // Casual
  { id: "casual60", name: "60-card casual", legality: null, size: 60, copies: 4, life: 20, group: "Casual" },
  { id: "limited", name: "Limited (40-card)", legality: null, size: 40, copies: Infinity, life: 20, group: "Casual", note: "Draft or sealed: any number of copies of cards you opened." },
];

const BY_NAME = new Map(FORMATS.map((f) => [f.name.toLowerCase(), f]));
const BY_ID = new Map(FORMATS.map((f) => [f.id, f]));

// Unknown or old values fall back to 60-card casual so nothing breaks.
export const formatOf = (deckOrName) => {
  const v = typeof deckOrName === "string" ? deckOrName : deckOrName?.format;
  return BY_NAME.get(String(v || "").toLowerCase()) || BY_ID.get(String(v || "").toLowerCase()) || BY_ID.get("casual60");
};
export const FORMAT_NAMES = FORMATS.map((f) => f.name);
export const isFormatName = (v) => BY_NAME.has(String(v || "").toLowerCase());

// Formats where one card leads the deck from the command zone.
export const hasCommander = (d) => !!formatOf(d).commander;
// 100-card, legendary-creature-led formats the Commander tools (brackets, upgrade lab, planner) were built for.
export const isCommanderLike = (d) => {
  const f = formatOf(d);
  return !!f.commander && f.size === 100 && f.commander !== "planeswalker";
};

const type = (c) => c?.type_line || c?.card_faces?.[0]?.type_line || "";
const text = (c) => [c?.oracle_text, ...(c?.card_faces || []).map((x) => x.oracle_text)].filter(Boolean).join("\n");

// Whether `c` may lead a deck of this format.
export function canLead(c, f) {
  if (!c || !f.commander) return false;
  const t = type(c),
    legendCreature = /\bLegendary\b/.test(t) && /\bCreature\b/.test(t),
    says = /can be your commander/i.test(text(c));
  if (f.commander === "legend") return legendCreature || says;
  if (f.commander === "planeswalker") return /\bPlaneswalker\b/.test(t);
  if (f.commander === "creature") return /\bCreature\b/.test(t) || says;
  if (f.commander === "brawl") return legendCreature || says || (/\bLegendary\b/.test(t) && /\bPlaneswalker\b/.test(t));
  return false;
}

// "legal" | "banned" | "restricted" | "not_legal" | null (no list for this format / no data).
export const legalityIn = (c, f) => (f.legality && c?.legalities ? c.legalities[f.legality] || "not_legal" : null);

export const LEGALITY_WORD = { legal: "Legal", banned: "Banned", restricted: "Restricted", not_legal: "Not legal" };

export const sizeLabel = (f) => (f.exact ? `${f.size} cards` : `${f.size}+ cards`) + (f.copies === 1 ? ", singleton" : "");
