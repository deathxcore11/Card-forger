// Builds mtg-synergy.json: the payoff cards for three directional links the Play guide knows
// (a spell that hits one creature, instants/sorceries being cast, Expend). Found by Scryfall
// text searches and checked against the rules text below; no AI, nothing guessed.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/mtg-synergy.mjs [cache-dir]   (rerun per set)
import fs from "node:fs";
import { scryfall } from "./scryfall.mjs";

const { all } = scryfall(process.argv[2] || ".cache/scryfall");
const LINKS = {
  creature_burn: { q: 'o:"targets only a single creature" game:paper', rx: /instant or sorcery spell you control that targets only a single creature/i, why: "triggers when your spell targets only one creature and damages it" },
  cast_spell: { q: '(o:"whenever you cast an instant or sorcery" or o:"copy that spell" or o:"gains deathtouch and lifelink") game:paper', rx: /whenever you cast an? instant or sorcery spell|whenever you cast a spell, if it'?s the first (?:instant|sorcery)|copy that spell|that spell gains deathtouch/i, why: "pays you for casting instants and sorceries", types: /Creature|Artifact|Enchantment|Planeswalker/ },
  expend: { q: 'o:"whenever you expend" game:paper', rx: /whenever you expend \d/i, why: "triggers when you spend your 4th or 8th mana on spells in a turn" },
};
const out = { source: "Scryfall text search, checked against rules text", at: new Date().toISOString().slice(0, 10), links: {} };
for (const [tag, L] of Object.entries(LINKS)) {
  const seen = new Map();
  for (const c of await all(L.q, { unique: "cards" })) {
    const t = (c.card_faces?.length ? c.card_faces.map((f) => f.oracle_text || "").join("\n") : c.oracle_text || "");
    if (!L.rx.test(t) || (L.types && !L.types.test(c.type_line || "")) || seen.has(c.name)) continue;
    seen.set(c.name, { n: c.name, id: c.id, ci: (c.color_identity || []).join(""), r: c.edhrec_rank || 99999, t: c.type_line.split(" — ")[0] });
  }
  out.links[tag] = { why: L.why, cards: [...seen.values()].sort((a, b) => a.r - b.r).slice(0, 12) };
  console.log(tag, seen.size);
}
fs.writeFileSync(new URL("../mtg-synergy.json", import.meta.url), JSON.stringify(out));
