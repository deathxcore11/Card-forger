// Card tiers: one colour scale for all three games, from the card's real rarity and its market
// price, whichever is higher. Grey, green, blue, purple, gold, and orange for cards over $1,000.
export const TIERS = [
  { key: "t0", label: "Common", color: "#9aa3ad" },
  { key: "t1", label: "Uncommon", color: "#4fd18b" },
  { key: "t2", label: "Rare", color: "#4aa3ff" },
  { key: "t3", label: "Epic", color: "#b46cff" },
  { key: "t4", label: "Legendary", color: "#ffc93c" },
  { key: "t5", label: "Grail", color: "#ff7a1a" },
];

// Price bands (USD): under $1, $1+, $5+, $25+, $100+, $1,000+.
export function priceTier(p) {
  const v = Number(p);
  if (!(v > 0)) return 0;
  return v >= 1000 ? 5 : v >= 100 ? 4 : v >= 25 ? 3 : v >= 5 ? 2 : v >= 1 ? 1 : 0;
}

// Printed rarity, read the way collectors rank it in each game.
export function rarityTier(game, rarity) {
  const r = String(rarity || "").toLowerCase();
  if (!r) return 0;
  if (game === "mtg") return { common: 0, uncommon: 1, rare: 2, mythic: 3, special: 3, bonus: 3 }[r] ?? 0;
  if (game === "ygo") {
    if (/secret|ultimate|ghost|starlight|collector|platinum|prismatic|quarter century|10000|gold|premium/.test(r)) return 4;
    if (/ultra/.test(r)) return 3;
    if (/super/.test(r)) return 2;
    if (/rare/.test(r) && !/short print/.test(r)) return 1;
    return 0;
  }
  // Pokémon
  if (/secret|special illustration|hyper|rainbow|gold|crown|shiny ultra|mega hyper|black white rare/.test(r)) return 4;
  if (/ultra|double|illustration|ace spec|radiant|amazing|shiny|full art|\bv\b|vmax|vstar|\bex\b|\bgx\b|prism|legend|break|lv\.x|trainer gallery/.test(r)) return 3;
  if (/holo|rare/.test(r)) return 2;
  if (/uncommon/.test(r)) return 1;
  return 0;
}

export function tierOf(game, rarity, price) {
  return TIERS[Math.max(rarityTier(game, rarity), priceTier(price))];
}

// Attributes for a card element: the tier class and its colour.
export const tierAttrs = (t) => `data-tier="${t.key}" style="--tier:${t.color}"`;
export const tierStyle = (t) => `--tier:${t.color}`;
// A small gem with the tier name, for the corner of a card.
export const tierGem = (t) => `<span class="tier-gem" title="${t.label} tier"><i aria-hidden="true"></i>${t.label}</span>`;
