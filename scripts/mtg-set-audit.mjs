// Magic set-by-set audit: for every paper set, is each card in the app's set view, does it have
// art and a price, and do the app's role tags (removal, counterspell, board wipe, draw, ramp,
// discard) agree with Scryfall's community oracle tags?
// Usage: NODE_USE_ENV_PROXY=1 node scripts/mtg-set-audit.mjs <out-dir> [set codes…]
// Pages are cached in <out-dir>/cache so a rerun or a crash resumes without refetching.
import fs from "node:fs";
import path from "node:path";
import { scryfall, ROLE_TAGS as ROLES } from "./scryfall.mjs";
import { MTG_ROLE_RX as M, mtgRulesText } from "../deckpower.js";
import { engineRoles } from "../insights.js";

const OUT = process.argv[2] || "mtg-audit", ONLY = process.argv.slice(3).map((s) => s.toLowerCase());
const CACHE = path.join(OUT, "cache");
const { get, all } = scryfall(CACHE);

// Scryfall oracle tags for the roles the app scores. Each role maps to the tags that mean it.
const tagged = {};
for (const [role, tags] of Object.entries(ROLES)) {
  tagged[role] = new Set();
  for (const t of tags) for (const c of await all(`otag:${t} game:paper`, { unique: "cards" })) tagged[role].add(c.oracle_id);
  console.error(`tag ${role}: ${tagged[role].size}`);
}
// The app's two taggers: Deck Power (constructed) and the engine/insights roles (Commander).
const INS = { removal: "Removal", wipe: "Wipe", draw: "Draw", ramp: "Ramp" };
const ours = (c) => {
  const tx = mtgRulesText(c), er = engineRoles(c), out = {};
  for (const role of Object.keys(ROLES)) out[role] = { power: M[role].test(tx), engine: INS[role] ? er.includes(INS[role]) : null };
  return out;
};

const sets = (await get("https://api.scryfall.com/sets")).data
  .filter((s) => !s.digital && s.set_type !== "token" && s.card_count > 0 && (!ONLY.length || ONLY.includes(s.code)))
  .sort((a, b) => String(b.released_at).localeCompare(String(a.released_at)));
const report = { at: new Date().toISOString(), sets: [], roles: {} };
const seen = new Map(); // oracle_id → card, for role checks once per card
for (const s of sets) {
  // The same query the app's set page runs (app.js setCards).
  const cards = await all("e:" + s.code, { unique: "prints", order: "set", dir: "asc", include_extras: "true", include_variations: "true" });
  const noArt = cards.filter((c) => !(c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal) || /missing|placeholder/.test(c.image_status || "")),
    paper = cards.filter((c) => (c.games || []).includes("paper")),
    noPrice = paper.filter((c) => !(c.prices?.usd || c.prices?.usd_foil || c.prices?.usd_etched)),
    noLegal = cards.filter((c) => !c.legalities || !Object.keys(c.legalities).length);
  for (const c of cards) if (c.oracle_id && !seen.has(c.oracle_id) && !/Token|Emblem|Card|Scheme|Plane\b|Phenomenon|Vanguard|Conspiracy|Dungeon/.test(c.type_line || "") && c.layout !== "art_series") seen.set(c.oracle_id, { c, set: s.code });
  report.sets.push({
    code: s.code, name: s.name, type: s.set_type, released: s.released_at, expected: s.card_count, shown: cards.length,
    noArt: noArt.map((c) => c.collector_number + " " + c.name), noPrice: noPrice.length, noPriceSample: noPrice.slice(0, 8).map((c) => c.collector_number + " " + c.name), noLegal: noLegal.length,
  });
  console.error(`${s.code} ${s.name}: ${cards.length}/${s.card_count}${noArt.length ? ` · ${noArt.length} no art` : ""}${noPrice.length ? ` · ${noPrice.length} unpriced` : ""}`);
}
// Role agreement per card (once per oracle card), then rolled up per set and overall.
const perSet = new Map();
for (const role of Object.keys(ROLES)) report.roles[role] = { tagged: 0, power: { tp: 0, fp: 0, fn: 0, fpCards: [], fnCards: [] }, engine: INS[role] ? { tp: 0, fp: 0, fn: 0, fpCards: [], fnCards: [] } : null };
for (const { c, set } of seen.values()) {
  if (/\bLand\b/.test((c.type_line || "").split(" // ")[0])) continue;
  const o = ours(c), ps = perSet.get(set) || perSet.set(set, { cards: 0, miss: 0, extra: 0 }).get(set);
  ps.cards++;
  for (const role of Object.keys(ROLES)) {
    const truth = tagged[role].has(c.oracle_id), R = report.roles[role];
    if (truth) R.tagged++;
    for (const k of ["power", "engine"]) {
      if (o[role][k] == null) continue;
      const x = R[k], mine = o[role][k];
      if (truth && mine) x.tp++;
      else if (truth) { x.fn++; x.fnCards.push(c.name); if (k === "power") ps.miss++; }
      else if (mine) { x.fp++; x.fpCards.push(c.name); if (k === "power") ps.extra++; }
    }
  }
}
for (const row of report.sets) Object.assign(row, { roles: perSet.get(row.code) || null });
fs.writeFileSync(path.join(OUT, "mtg-audit.json"), JSON.stringify(report));
const pr = (x) => `precision ${Math.round((100 * x.tp) / Math.max(1, x.tp + x.fp))}% · recall ${Math.round((100 * x.tp) / Math.max(1, x.tp + x.fn))}%`;
for (const [role, R] of Object.entries(report.roles)) console.log(`${role} (${R.tagged} tagged): power ${pr(R.power)}${R.engine ? ` | engine ${pr(R.engine)}` : ""}`);
const bad = report.sets.filter((s) => s.shown !== s.expected || s.noArt.length);
console.log(`${report.sets.length} sets · ${seen.size} cards · ${bad.length} sets with count or art gaps · ${report.sets.reduce((a, s) => a + s.noPrice, 0)} unpriced paper prints`);
