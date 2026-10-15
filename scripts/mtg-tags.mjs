// Builds mtg-tags.json: for each role the app scores, the paper cards Scryfall's community oracle
// tags give that role but the app's own text patterns (Deck Power and engine roles) miss. The app
// counts a card for a role when its pattern OR the tag says so, so only the misses need shipping.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/mtg-tags.mjs [cache-dir]   (rerun monthly / per set)
import fs from "node:fs";
import { scryfall, ROLE_TAGS } from "./scryfall.mjs";
import { MTG_ROLE_RX as M, mtgRulesText } from "../deckpower.js";
import { engineRoles } from "../insights.js";

const { all } = scryfall(process.argv[2] || ".cache/scryfall");
const INS = { removal: "Removal", counter: "Removal", wipe: "Wipe", draw: "Draw", ramp: "Ramp" };
const missed = (c, role) => !M[role].test(mtgRulesText(c)) || (INS[role] && !engineRoles(c).includes(INS[role]));
const roles = {};
for (const [role, tags] of Object.entries(ROLE_TAGS)) {
  const names = new Set();
  for (const t of tags) for (const c of await all(`otag:${t} game:paper`, { unique: "cards" })) if (missed(c, role)) names.add(c.name);
  roles[role] = [...names].sort();
  console.log(`${role}: ${roles[role].length}`);
}
fs.writeFileSync(new URL("../mtg-tags.json", import.meta.url), JSON.stringify({ source: "Scryfall oracle tags (tagger.scryfall.com)", at: new Date().toISOString().slice(0, 10), roles }));
