// Yu-Gi-Oh! set-by-set audit: for every set YGOPRODeck lists, does the set page load every card,
// does each card have art and a price, can its printings be priced on TCGplayer (set matched to
// a TCGplayer group), and does it carry the data the deck tools read (stats, format pool, banlist)?
// Usage: NODE_USE_ENV_PROXY=1 node scripts/ygo-set-audit.mjs <out-dir>
import fs from "node:fs";
import path from "node:path";
import { normalizeYgo } from "../ygo.js";

const OUT = process.argv[2] || "ygo-audit";
fs.mkdirSync(OUT, { recursive: true });
const HEAD = { headers: { "User-Agent": "CardStashy/3.59 (set audit)", Accept: "application/json" } };
async function get(url, file) {
  const f = path.join(OUT, file);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const r = await fetch(url, { ...HEAD, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw Error(url + " → HTTP " + r.status);
  const d = await r.json();
  fs.writeFileSync(f, JSON.stringify(d));
  return d;
}
const cards = (await get("https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes", "cards.json")).data;
const sets = await get("https://db.ygoprodeck.com/api/v7/cardsets.php", "sets.json");
const groups = (await get("https://tcgcsv.com/tcgplayer/2/groups", "groups.json")).results;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const groupOf = new Map();
for (const g of groups) groupOf.set(norm(g.name), (groupOf.get(norm(g.name)) || 0) + 1);

const bySet = new Map();
const issues = { noArt: [], noPrice: [], dataGaps: [], poolGaps: [] };
for (const raw of cards) {
  const c = normalizeYgo(raw);
  if (!raw.card_images?.length) issues.noArt.push(c.name);
  const gap = [];
  if (c.category === "Monster") {
    if (!c.attribute) gap.push("attribute");
    if (!c.race) gap.push("type");
    if (c.atk == null && !/\?/.test(raw.atk)) gap.push("ATK");
    if (c.level == null) gap.push(/link/i.test(c.frame) ? "link rating" : "level");
  } else if (/Spell|Trap/.test(c.category) && !c.race) gap.push("property");
  if (!c.text) gap.push("text");
  if (gap.length) issues.dataGaps.push(c.name + ": " + gap.join(", "));
  // Released in the TCG but missing the "TCG" format pool: the app would call it not legal there.
  const tcgDate = raw.misc_info?.[0]?.tcg_date;
  if (tcgDate && !c.pools.includes("TCG") && c.category !== "Token" && c.category !== "Skill") issues.poolGaps.push(c.name + " (TCG " + tcgDate + ")");
  for (const s of raw.card_sets || []) {
    const row = bySet.get(s.set_name) || bySet.set(s.set_name, { codes: new Set(), cards: new Set(), unpricedPrints: 0, prints: 0 }).get(s.set_name);
    row.codes.add(s.set_code);
    row.cards.add(c.id);
    row.prints++;
    if (!(Number(s.set_price) > 0)) row.unpricedPrints++;
  }
  if (!(c.prices.usd > 0) && c.category !== "Token" && c.category !== "Skill" && raw.card_sets?.length) issues.noPrice.push(c.name);
}
const report = { at: new Date().toISOString(), totals: { cards: cards.length, ...Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])) }, samples: Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.slice(0, 40)])), sets: [] };
for (const s of sets) {
  const row = bySet.get(s.set_name);
  report.sets.push({
    code: s.set_code, name: s.set_name, date: s.tcg_date || "", expected: s.num_of_cards, shown: row ? row.codes.size : 0, cards: row ? row.cards.size : 0,
    prints: row?.prints || 0, unpricedPrints: row?.unpricedPrints || 0, tcgGroup: groupOf.get(norm(s.set_name)) === 1,
  });
}
fs.writeFileSync(path.join(OUT, "ygo-audit.json"), JSON.stringify(report));
const S = report.sets, sum = (k) => S.reduce((a, s) => a + s[k], 0);
console.log(`${S.length} sets · ${cards.length} cards · ${S.filter((s) => s.shown < s.expected).length} sets missing cards (${sum("expected") - S.reduce((a, s) => a + Math.min(s.shown, s.expected), 0)} cards) · ${S.filter((s) => !s.shown).length} empty sets`);
console.log(`art missing ${issues.noArt.length} · cards with no price ${issues.noPrice.length} · printings with no price ${sum("unpricedPrints")} of ${sum("prints")} · sets with no TCGplayer group ${S.filter((s) => !s.tcgGroup).length}`);
console.log(`data gaps ${issues.dataGaps.length} · TCG cards missing the TCG pool ${issues.poolGaps.length}`);
