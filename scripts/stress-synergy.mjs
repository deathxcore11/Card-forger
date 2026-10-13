// Stress test for the Play guide and pairing tags on real card samples.
// Usage: node scripts/stress-synergy.mjs <sample-dir>
// The sample dir holds Scryfall search pages (mtg_*.json), YGOPRODeck's cardinfo (ygo.json) and
// TCGdex card files (ptcg/*.json). Reports per game: role coverage, synergy-tag coverage, and how
// many cards find ≥3 strong pairings inside the sample pool — plus examples of cards with nothing.
import fs from "node:fs";
import path from "node:path";
import { playGuide } from "../guide.js";
import { tagsFor, rankPairs } from "../pairing.js";
import { normalizeYgo } from "../ygo.js";
import { normalizePtcg } from "../ptcg.js";

const dir = process.argv[2];
const TRIVIAL = /^(name:|ptype:|attr:|race:|sub:|kind:|arch:|type:)/;
function load() {
  const mtg = fs.readdirSync(dir).filter((f) => f.startsWith("mtg_")).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f))).data || []);
  let ygo = JSON.parse(fs.readFileSync(path.join(dir, "ygo.json"))).data.map(normalizeYgo);
  // A spread sample of Yu-Gi-Oh! cards.
  ygo = ygo.filter((_, i) => i % 20 === 0);
  const ptcg = fs.readdirSync(path.join(dir, "ptcg")).map((f) => { try { return normalizePtcg(JSON.parse(fs.readFileSync(path.join(dir, "ptcg", f)))); } catch { return null; } }).filter((c) => c && !c.pocket);
  return { mtg, ygo, ptcg };
}
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0) + "%";
export function report(game, cards, { examples = 8 } = {}) {
  let role = 0, tag = 0, need = 0, pair3 = 0, any3 = 0;
  const bare = [];
  for (const c of cards) {
    const g = playGuide(game, c), T = tagsFor(game, c);
    const nt = [...T.needs].filter((x) => !TRIVIAL.test(x)), pt = [...T.provides].filter((x) => !TRIVIAL.test(x));
    if (g.roles.length) role++;
    if (nt.length || pt.length) tag++;
    if (nt.length) need++;
    const all = rankPairs(game, c, cards.map((card) => ({ card })), { max: 20 }),
      strong = all.filter((p) => !p.fallback).length;
    if (strong >= 3) pair3++;
    if (all.length >= 3) any3++;
    if (!g.roles.length && !nt.length && !pt.length) bare.push(c);
  }
  const n = cards.length;
  console.log(`${game.padEnd(5)} ${String(n).padStart(4)} cards · role ${pct(role, n)} · synergy tag ${pct(tag, n)} · needs-tag ${pct(need, n)} · ≥3 strong pairs in pool ${pct(pair3, n)} · ≥3 pairs incl. "also works with" ${pct(any3, n)}`);
  const text = (c) => (game === "mtg" ? c.type_line + " | " + (c.oracle_text || c.card_faces?.map((f) => f.oracle_text).join(" / ") || "") : game === "ygo" ? c.typeLine + " | " + c.text : c.typeLine + " | " + [c.effect, ...(c.abilities || []).map((a) => a.effect), ...(c.attacks || []).map((a) => a.name + ": " + a.effect)].join(" / "));
  for (const c of bare.filter((_, i) => i % Math.max(1, Math.floor(bare.length / examples)) === 0).slice(0, examples)) console.log("   · " + c.name + " — " + String(text(c)).replace(/\s+/g, " ").slice(0, 150));
  return { n, role: role / n, tag: tag / n, need: need / n, pair3: pair3 / n };
}
if (dir) {
  const { mtg, ygo, ptcg } = load();
  report("mtg", mtg); report("ygo", ygo); report("ptcg", ptcg);
}
