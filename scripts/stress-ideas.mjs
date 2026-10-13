// Prototypes five ways to improve synergy tags and measures each on real card samples, before
// any change ships. Usage: node scripts/stress-ideas.mjs <sample-dir>  (see stress-synergy.mjs)
import fs from "node:fs";
import path from "node:path";
import { playGuide } from "../guide.js";
import { tagsFor, rankPairs } from "../pairing.js";
import { normalizeYgo } from "../ygo.js";
import { normalizePtcg } from "../ptcg.js";

const dir = process.argv[2];
const mtg = fs.readdirSync(dir).filter((f) => f.startsWith("mtg_")).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f))).data || []);
const ygoAll = JSON.parse(fs.readFileSync(path.join(dir, "ygo.json"))).data.map(normalizeYgo);
const ygo = ygoAll.filter((_, i) => i % 20 === 0);
const ptcg = fs.readdirSync(path.join(dir, "ptcg")).map((f) => { try { return normalizePtcg(JSON.parse(fs.readFileSync(path.join(dir, "ptcg", f)))); } catch { return null; } }).filter((c) => c && !c.pocket);
const SAMPLES = { mtg, ygo, ptcg };
const add = (T, p = [], n = []) => ({ provides: new Set([...T.provides, ...p.filter(Boolean)]), needs: new Set([...T.needs, ...n.filter(Boolean)]) });
const txt = (g, c) => (g === "mtg" ? (c.oracle_text || c.card_faces?.map((f) => f.oracle_text).join(" ") || "") : g === "ygo" ? c.text || "" : [c.effect, ...(c.abilities || []).map((a) => a.effect), ...(c.attacks || []).map((a) => a.effect)].join(" ")) || "";

/* Idea 1 — structured mechanics from card data (frames, card classes, keyword lists). */
function i1(g, c) {
  const T = tagsFor(g, c), t = txt(g, c);
  if (g === "ygo") {
    const tl = c.typeLine || "", lvl = Number(c.level) || 0, main = c.category === "Monster" && !c.extra;
    const frame = (tl.match(/Ritual|Fusion|Synchro|Xyz|Link|Pendulum|Flip|Spirit|Gemini|Toon|Union|Normal/) || [""])[0].toLowerCase();
    return add(T,
      [frame && c.category === "Monster" && "frame:" + frame, main && lvl && "level:" + lvl, /Ritual Spell/.test(tl) && "ritualspell", c.category === "Spell" && /Fusion Summon/.test(t) && "fusionspell", /tuner/i.test(tl) && "tuner"],
      [frame === "ritual" && "ritualspell", frame === "fusion" && "fusionspell", frame === "synchro" && "tuner", frame === "xyz" && lvl && "level:" + lvl, /Ritual Spell/.test(tl) && "frame:ritual", c.category === "Spell" && /Fusion Summon/.test(t) && "frame:fusion", /\bNormal Monsters?\b/.test(t) && "frame:normal", /\bFLIP\b|face-down Defense/.test(t) && c.category !== "Monster" && "frame:flip", /\bToon\b/.test(t) && !/Toon/.test(tl) && "frame:toon", /\bGemini\b/.test(t) && !/Gemini/.test(tl) && "frame:gemini", /\bPendulum\b/.test(t) && !/Pendulum/.test(tl) && "frame:pendulum"]);
  }
  if (g === "ptcg") {
    const tl = c.typeLine || "";
    return add(T,
      [c.category === "Energy" && !c.basicEnergy && "special_energy", /Stadium/.test(tl) && "stadium", /Tool/.test(tl) && "tool", c.category === "Pokemon" && (c.abilities || []).length && "ability", /Fossil/i.test(c.name) && "fossil"],
      [/Special Energy/.test(t) && "special_energy", /Stadium/.test(t) && !/Stadium/.test(tl) && "stadium", /Pokémon Tool/.test(t) && "tool", /\bFossil\b/.test(t) && "fossil", /Pokémon with an Ability|Pokémon that has an Ability/.test(t) && "ability"]);
  }
  const kw = new Set(c.keywords || []);
  return add(T,
    [["Treasure", "Food", "Clue", "Investigate", "Blood"].some((k) => kw.has(k)) && "artifact", kw.has("Mill") && "mill", kw.has("Surveil") && "mill"],
    [(kw.has("Kicker") || kw.has("Multikicker")) && "ramp", kw.has("Convoke") && "token", kw.has("Improvise") && "artifact", kw.has("Ninjutsu") && "evasive", kw.has("Delirium") && "mill"]);
}

/* Idea 2 — roles from stats and structure (attackers, pivots, support Pokémon, boss monsters, vanilla beaters). */
function rolesI2(g, c) {
  const r = playGuide(g, c).roles.length;
  if (r) return r;
  if (g === "ptcg" && c.category === "Pokemon") return 1; // attacker / support / pivot / evolution step — always derivable
  if (g === "ygo" && c.category === "Monster") return 1; // beater (ATK), boss (extra), material (level/tuner)
  if (g === "mtg" && /Creature/.test(c.type_line || "")) return 1; // beater / blocker by P/T vs cost
  return 0;
}

/* Idea 3 — named-group tags (owner Trainers "Misty's", Team Rocket, YGO name families without an archetype). */
function i3(g, c) {
  const T = tagsFor(g, c), t = txt(g, c);
  if (g === "ptcg") {
    const own = (c.name || "").match(/^([A-Z][\w.]+(?: [A-Z][\w.]+)?)'s /)?.[1];
    const ment = [...t.matchAll(/\b([A-Z][\w.]+(?: [A-Z][\w.]+)?)'s Pokémon\b/g)].map((m) => m[1]);
    return add(T, [own && "group:" + own], ment.map((m) => "group:" + m));
  }
  if (g === "ygo" && !c.archetype) {
    const fam = (c.name || "").split(/[\s-]/)[0];
    return add(T, [fam && fam.length > 3 && "fam:" + fam], [...t.matchAll(/"([^"]+)" (?:monster|card)s?/g)].map((m) => "fam:" + m[1].split(/[\s-]/)[0]));
  }
  return T;
}

/* Idea 4 — interaction & tempo roles (hate, tool/energy removal, battle tricks, disruption). */
const I4 = {
  mtg: /destroy target (artifact|enchantment)|exile (target|all) cards? from (a|target|all) graveyard|can't (attack|block)|gets \+\d+\/\+\d+ until end of turn|return target [^.]* to (its|their) owner's hand|tap target/i,
  ygo: /inflict \d+ damage|cannot (attack|activate)|change [^.]* battle position|gains? \d+ ATK|negate the attack|return [^.]* to the hand/i,
  ptcg: /discard (a|an|all|\d+) (pokémon tool|special energy|stadium|energy)[^.]*opponent|opponent[^.]*discard|move (a|an|\d+) [^.]*energy|put \d+ damage counters|your opponent shuffles|look at your face-down prize/i,
};
const rolesI4 = (g, c) => playGuide(g, c).roles.length || (I4[g].test(txt(g, c)) ? 1 : 0);

/* Idea 5 — tournament co-occurrence packages (only cards that appear in recent top lists). */
function i5Coverage(g) {
  let names = new Set();
  if (g === "ptcg") for (const f of fs.readdirSync(dir).filter((f) => /^lim_.*\.json$/.test(f))) for (const p of JSON.parse(fs.readFileSync(path.join(dir, f))) || []) for (const k of ["pokemon", "trainer", "energy"]) for (const c of p.decklist?.[k] || []) names.add(c.name);
  if (g === "ygo") { const ids = new Set(); for (const f of fs.readdirSync(dir).filter((f) => /^ygodecks_/.test(f))) for (const d of JSON.parse(fs.readFileSync(path.join(dir, f))) || []) for (const z of ["main_deck", "extra_deck"]) for (const id of JSON.parse(d[z] || "[]")) ids.add(String(id)); return SAMPLES.ygo.filter((c) => ids.has(String(c.id))).length / SAMPLES.ygo.length; }
  return g === "ptcg" ? SAMPLES.ptcg.filter((c) => names.has(c.name)).length / SAMPLES.ptcg.length : SAMPLES.mtg.filter((c) => c.edhrec_rank && c.edhrec_rank < 2000).length / SAMPLES.mtg.length;
}

const TRIV = /^(name:|ptype:|attr:|race:|sub:|kind:|arch:|type:|level:|frame:normal)/;
function measure(g, tagsFn) {
  const cards = SAMPLES[g], pool = cards.map((card) => ({ card }));
  let tag = 0, pair3 = 0, pairs = 0;
  for (const c of cards) {
    const T = tagsFn(g, c);
    if ([...T.needs, ...T.provides].some((x) => !TRIV.test(x))) tag++;
    const strong = rankPairs(g, c, pool, { max: 20, tagsFn }).filter((p) => !p.fallback);
    pairs += strong.length;
    if (strong.length >= 3) pair3++;
  }
  return { tag: tag / cards.length, pair3: pair3 / cards.length, avg: pairs / cards.length };
}
const P = (x) => Math.round(x * 100) + "%";
// Precision check: a few new strong pairs an idea creates that the baseline didn't, for eyeballing.
function newPairs(g, tagsFn, k = 5) {
  const cards = SAMPLES[g], pool = cards.map((card) => ({ card })), out = [];
  for (const c of cards) {
    if (out.length >= k) break;
    const base = new Set(rankPairs(g, c, pool, { max: 20 }).filter((p) => !p.fallback).map((p) => p.card.name));
    const now = rankPairs(g, c, pool, { max: 20, tagsFn }).filter((p) => !p.fallback && !base.has(p.card.name));
    if (now.length) out.push(`${c.name} → ${now[0].card.name} (${now[0].reasons.slice(0, 2).join("; ")})`);
  }
  return out;
}
for (const g of ["mtg", "ygo", "ptcg"]) {
  const base = measure(g, tagsFor), one = measure(g, i1), three = measure(g, i3);
  const roleBase = SAMPLES[g].filter((c) => playGuide(g, c).roles.length).length / SAMPLES[g].length;
  console.log(`\n== ${g} (${SAMPLES[g].length} cards)`);
  console.log(`baseline           tag ${P(base.tag)} · ≥3 strong pairs ${P(base.pair3)} · avg strong ${base.avg.toFixed(1)} · roles ${P(roleBase)}`);
  console.log(`1 structured mech  tag ${P(one.tag)} · ≥3 strong pairs ${P(one.pair3)} · avg strong ${one.avg.toFixed(1)}`);
  for (const s of newPairs(g, i1)) console.log("     + " + s);
  console.log(`2 structural roles roles ${P(SAMPLES[g].filter((c) => rolesI2(g, c)).length / SAMPLES[g].length)}`);
  console.log(`3 named groups     tag ${P(three.tag)} · ≥3 strong pairs ${P(three.pair3)} · avg strong ${three.avg.toFixed(1)}`);
  for (const s of newPairs(g, i3, 3)) console.log("     + " + s);
  console.log(`4 interaction roles roles ${P(SAMPLES[g].filter((c) => rolesI4(g, c)).length / SAMPLES[g].length)}`);
  console.log(`5 tournament packages coverage ${P(i5Coverage(g))} of sampled cards appear in recent top lists${g === "mtg" ? " (Magic: EDHREC top 2000 as proxy)" : ""}`);
}
