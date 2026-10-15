// Deck Power: a game- and format-aware rating for all three games.
// Each game is judged by how competitive decks in THAT game and format are built:
//   • Magic constructed (Standard, Pioneer, Modern…): mana vs. curve (Karsten), redundancy
//     (4-ofs), interaction and threat density for the deck's plan, card flow, color sources.
//   • Magic Commander keeps the Commander engine score (insights.js).
//   • Yu-Gi-Oh!: 40-card focus, starters/searchers, extenders, hand traps & negates,
//     brick risk, Extra Deck use, 3-of consistency.
//   • Pokémon: Basic count (mulligan odds), draw Supporters, search Items, Energy fit,
//     evolution lines, 4-of consistency.
// When cached tournament results exist for the format, the list is matched against real
// placing decks; a close match to a proven list is scored mostly on that evidence.
// Pure functions. Not a win-rate prediction.

import { simulate, poolOf, has as hasTag, countTag, atLeastOne, allIn, evidence } from "./deckaudit.js";
import { mtgGoldfish, ptcgGoldfish, ygoGoldfish } from "./goldfish.js";
import { mtgTagged } from "./mtg-tags.js";

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lc = (s) => String(s || "").toLowerCase();

export function powerGrade(score, from = "") {
  if (from === "rogue") return score >= 55 ? "Rogue · casual tier" : "Casual";
  return score >= 90 ? "Tournament-ready" : score >= 80 ? "Competitive" : score >= 68 ? "Solid" : score >= 55 ? "Playable" : score >= 40 ? "Rough" : "Unfinished";
}

const finish = (parts) => {
  const w = parts.reduce((a, p) => a + p.weight, 0) || 1;
  return Math.round((parts.reduce((a, p) => a + clamp(p.ratio) * p.weight, 0) / w) * 100);
};
const part = (key, label, count, target, ratio, weight, hint, fix = "") => ({ key, label, count, target, ratio: clamp(ratio), weight, hint, fix });
// Deal-breakers: flaws no amount of consistency makes up for (a deck that can't cast its spells,
// an attacker that can't attack, searchers with nothing to search). Each caps the score and says why.
const capScore = (raw, caps) => {
  const list = caps.filter(Boolean).sort((a, b) => a.max - b.max);
  return { score: Math.min(raw, list[0]?.max ?? 100), caps: list.filter((c) => c.max < raw) };
};

/* ======================= Magic constructed ======================= */

const M = {
  removal: /(?:destroy|exile) target (?:creature|artifact|enchantment|planeswalker|battle|permanent|nonland permanent|nonland|attacking|blocking|tapped|creature or|artifact or|noncreature)|deals? (?:\d+|x|that much) damage to (?:any target|target creature|target planeswalker|target attacking|another target|each opponent and up to)|target creature (?:an opponent controls )?gets -\d+\/-\d+|fights? (?:target|another target|up to one target)|bites? |(?:target|each) opponent sacrifices|return target (?:nonland permanent|creature)[^.]* to (?:its|their) owner'?s? hand/,
  counter: /counter target (?:spell|creature spell|noncreature spell|activated|triggered)/,
  discard: /target (?:opponent|player) (?:reveals their hand|discards)|look at target opponent's hand/,
  wipe: /(?:destroy|exile) (?:all|each) (?:other )?(?:creatures|nonland permanents|artifacts|enchantments|permanents|nontoken)|all (?:other )?creatures get -\d+\/-\d+|deals? \d+ damage to each (?:creature|other creature)/,
  draw: /\bdraws? (?:a|an|one|two|three|x|that many|\d+) (?:additional )?cards?|exile the top .*?you may (?:play|cast)|\binvestigate\b|look at the top .*put (?:one|two|that card|it|any number) into your hand|\bsurveil\b|\bscry [2-9]|\bexplores?\b|\bdiscover \d|\bconnives?\b/,
  ramp: /\{t\}(?:,[^:]*)?: add |\badd (?:\{[wubrgc]\}|one mana|two mana|three mana|x mana|mana of any)|search your library for (?:a|an|up to \w+|two) (?:basic )?(?:land|plains|island|swamp|mountain|forest)|put (?:a|up to \w+|two) (?:basic )?land cards? .*onto the battlefield|you may (?:play an additional land|put a land card from your hand onto the battlefield)|create (?:a|an|one|two|\w+) treasure/,
  landfall: /landfall|whenever a land (?:you control )?enters|land enters the battlefield under your control|play an additional land|lands? you control/,
  tokens: /create (?:a|an|one|two|three|x|\w+) .*token/,
  spells: /whenever you cast (?:an instant|a noncreature|an instant or sorcery)|prowess|magecraft/,
  sac: /sacrifice (?:another|a creature|an artifact)|whenever (?:another )?creature you control dies/,
  gy: /from your graveyard|mill|escape|flashback|unearth|delve/,
};
export const MTG_ROLE_RX = M;
// A card has a role when its text matches the pattern or Scryfall's community tags say so.
const role = (c, k) => M[k].test(text(c)) || mtgTagged(c, k),
  interacts = (c) => role(c, "removal") || role(c, "counter") || role(c, "discard") || role(c, "wipe");
export const mtgRulesText = (c) => text(c);
const text = (c) => lc(c?.oracle_text || (c?.card_faces || []).map((f) => f.oracle_text || "").join("\n"));
const type = (c) => String(c?.type_line || "");
const isLandC = (c) => /\bLand\b/.test(type(c).split(" // ")[0]);
const isBasicC = (c) => /^Basic(?: Snow)? Land/.test(type(c));
const legendary = (c) => /Legendary/.test(type(c));

export function mtgConstructedPower(deck, catalog, key, size = 60) {
  const rows = [];
  let unknown = 0;
  const agg = new Map();
  for (const r of deck.cards || []) agg.set(key(r.name), { name: r.name, qty: (agg.get(key(r.name))?.qty || 0) + r.qty });
  for (const r of agg.values()) {
    const c = catalog[key(r.name)];
    if (!c) unknown += r.qty;
    rows.push({ ...r, c });
  }
  const known = rows.filter((r) => r.c),
    lands = known.filter((r) => isLandC(r.c)),
    spells = known.filter((r) => !isLandC(r.c)),
    nLand = lands.reduce((a, r) => a + r.qty, 0),
    nSpell = spells.reduce((a, r) => a + r.qty, 0),
    avg = nSpell ? spells.reduce((a, r) => a + (Number(r.c.cmc) || 0) * r.qty, 0) / nSpell : 0,
    has = (re) => spells.filter((r) => (typeof re === "string" ? role(r.c, re) : re.test(text(r.c)))),
    qty = (list) => list.reduce((a, r) => a + r.qty, 0),
    creatures = qty(spells.filter((r) => /Creature/.test(type(r.c)))),
    walkers = qty(spells.filter((r) => /Planeswalker/.test(type(r.c)))),
    interaction = qty(spells.filter((r) => interacts(r.c))),
    flow = qty(has("draw")),
    ramp = qty(has("ramp")),
    big = qty(spells.filter((r) => Number(r.c.cmc) >= 5)),
    scale = size / 60,
    // Damage straight to the opponent wins games too (Burn): it counts toward the ways to win.
    burn = qty(spells.filter((r) => !/Creature/.test(type(r.c)) && /deals? (?:\d+|x) damage to (?:any target|each opponent|target player|target opponent|each player)/.test(text(r.c)))),
    // Threat quality: a creature with rules text does something; a vanilla body is judged on its
    // stats for its cost (a 2/1 for 2 is filler, a 3/3 for 2 is fine).
    quality = (c) => {
      if (!/Creature/.test(type(c))) return 1;
      const pw = parseInt(c.power, 10) || 0, tg = parseInt(c.toughness, 10) || 0, mv = Number(c.cmc) || 0,
        stat = clamp((pw + tg) / (2 * mv + 1.5)), words = text(c).replace(/\([^)]*\)/g, "").trim();
      return words.length > 24 ? 1 : words ? clamp(stat * 1.2) : stat;
    },
    creatureRows = spells.filter((r) => /Creature/.test(type(r.c))),
    threatQ = creatureRows.length ? creatureRows.reduce((a, r) => a + quality(r.c) * r.qty, 0) / Math.max(1, creatures) : 1;
  // Plan detection
  const themes = Object.entries({ Landfall: M.landfall, Tokens: M.tokens, Spells: M.spells, Sacrifice: M.sac, Graveyard: M.gy })
    .map(([k, re]) => [k, qty(spells.filter((r) => re.test(text(r.c))))])
    .sort((a, b) => b[1] - a[1]);
  const theme = themes[0][1] >= 8 * scale ? themes[0][0] : null;
  const plan =
    avg <= 2.4 && creatures >= 14 * scale ? "Aggro"
    : interaction >= 12 * scale && creatures <= 12 * scale ? "Control"
    : (ramp >= 7 * scale && big >= 4 * scale) || theme === "Landfall" ? "Ramp"
    : "Midrange";
  const T = {
    Aggro: { inter: 4, threats: 18, flow: 2, curve: 2.3 },
    Midrange: { inter: 8, threats: 14, flow: 4, curve: 3.0 },
    Control: { inter: 12, threats: 4, flow: 8, curve: 3.3 },
    Ramp: { inter: 5, threats: 10, flow: 3, curve: 3.6 },
  }[plan];
  // Karsten: lands ≈ 19.59 + 1.90·avgMV − 0.28·(cheap draw/ramp) for 60 cards.
  const cheapHelp = qty(spells.filter((r) => Number(r.c.cmc) <= 2 && (role(r.c, "draw") || role(r.c, "ramp")))),
    // Landfall decks play extra lands on purpose: every land is a trigger.
    idealLands = Math.round((19.59 + 1.9 * avg - 0.28 * Math.min(cheapHelp, 12) + (theme === "Landfall" ? 3.5 : 0)) * scale),
    nonLegendSpells = spells.filter((r) => !legendary(r.c)),
    redundant = qty(nonLegendSpells.filter((r) => r.qty >= 3)) + qty(spells.filter((r) => legendary(r.c) && r.qty >= 2)),
    redundancy = nSpell ? redundant / nSpell : 0;
  // Colors: pips per color vs sources per color (Karsten wants ~14+ sources for a main color in 60).
  const pips = {}, src = {};
  // Hybrid and Phyrexian symbols ({G/U}, {R/P}) can be paid other ways, so they don't demand a color.
  for (const r of spells) for (const m of (r.c.mana_cost || r.c.card_faces?.[0]?.mana_cost || "").match(/\{[^}]+\}/g) || []) if (!m.includes("/")) for (const col of "WUBRG") if (m.includes(col)) pips[col] = (pips[col] || 0) + r.qty;
  // Mana rocks, dorks and filters (Chromatic Star, Llanowar Elves) are color sources too.
  for (const r of spells) {
    const tx = text(r.c);
    const listed = (r.c.produced_mana || []).filter((x) => "WUBRG".includes(x));
    if (!listed.length && !role(r.c, "ramp") && !/add one mana of any color|add \{[wubrg]\}/.test(tx)) continue;
    const cols = listed.length ? listed.join("") : /any color/.test(tx) ? "WUBRG" : [...new Set((tx.match(/add [^.]*/)?.[0] || "").match(/\{([wubrg])\}/g) || [])].map((x) => x[1].toUpperCase()).join("");
    for (const col of cols) src[col] = (src[col] || 0) + r.qty * 0.5;
  }
  for (const r of lands) for (const m of r.c.produced_mana || (isBasicC(r.c) ? [{ Plains: "W", Island: "U", Swamp: "B", Mountain: "R", Forest: "G" }[r.c.name]] : [])) if (m) src[m] = (src[m] || 0) + r.qty;
  // How much of the deck needs each color: share of spell copies with that color in their cost.
  const needers = {};
  for (const r of spells) for (const col of new Set(((r.c.mana_cost || r.c.card_faces?.[0]?.mana_cost || "").match(/\{[^}/]+\}/g) || []).join("").replace(/[^WUBRG]/g, ""))) needers[col] = (needers[col] || 0) + r.qty;
  const share = (k) => (needers[k] || 0) / Math.max(1, nSpell);
  const colors = Object.keys(pips),
    pipTotal = colors.reduce((a, k) => a + pips[k], 0),
    colorRatio = colors.length === 0 ? (nLand ? 1 : 0) : Math.min(...colors.map((k) => clamp((src[k] || 0) / Math.max(1, Math.round((share(k) >= 0.4 ? 14 : share(k) >= 0.15 ? 9 : 5) * scale))))),
    wincons = qty(spells.filter((r) => /win the game|each opponent loses/.test(text(r.c)))),
    threats = Math.round(creatures * threatQ) + walkers + (plan === "Control" ? wincons : 0) + Math.round(burn / 2),
    themeCount = theme ? themes[0][1] + (theme === "Landfall" ? ramp : 0) : 0;
  const parts = [
    part("Mana", "Mana base", nLand, idealLands, 1 - Math.abs(nLand - idealLands) / 5, 18, `With an average spell cost of ${avg.toFixed(2)}, about ${idealLands} lands hit your drops on time.`),
    part("Curve", "Curve for the plan", avg.toFixed(2), "≤ " + T.curve, 1 - Math.max(0, avg - T.curve) / 1.2, 14, `${plan} decks want their spells to average ${T.curve} or less.`),
    part("Consistency", "Consistency (3–4 copies)", Math.round(redundancy * 100) + "%", "70%", redundancy / 0.7, 16, "Competitive lists run their key cards as 4-ofs so they show up every game.", "Cut 1-of and 2-of cards and play more copies of your best ones."),
    part("Interaction", "Interaction", interaction, Math.round(T.inter * scale), interaction / Math.max(1, T.inter * scale), 14, "Removal, counters and discard that stop your opponent’s plan.", "Removal"),
    part("Threats", plan === "Control" ? "Win conditions" : "Threat density", threats, Math.round(T.threats * scale), threats / Math.max(1, T.threats * scale), 14, plan === "Control" ? "Control needs a few ways to actually win." : "Enough threats that removal can’t answer them all."),
    part("Flow", "Card flow", flow, Math.round(T.flow * scale), flow / Math.max(1, T.flow * scale), 8, "Draw, scry, surveil and explore keep you hitting what you need.", "Draw"),
  ];
  // Lands with no listed colors (fetches, utility lands) count as half a source of every color.
  const flexLands = qty(lands.filter((r) => !isBasicC(r.c) && !(r.c.produced_mana || []).length)),
    starved = colors.filter((k) => share(k) >= 0.25 && (src[k] || 0) + flexLands / 2 < 1),
    need = (k) => Math.round((share(k) >= 0.4 ? 14 : share(k) >= 0.15 ? 9 : 5) * scale),
    // A color only one or two cards ask for is a light splash (a 1-of Krang in a blue deck), not a
    // mana base that's broken: it doesn't trigger the "far short" cap.
    thin = colors.filter((k) => (needers[k] || 0) > 2 && (src[k] || 0) + flexLands / 2 < need(k) / 2);
  const caps = [
    starved.length ? { key: "Colors", max: 35, label: "Can't cast its spells", why: `The spells need ${starved.map((k) => ({ W: "white", U: "blue", B: "black", R: "red", G: "green" })[k]).join(" and ")} mana and no land makes it. Most games this deck does nothing.` } : null,
    !starved.length && thin.length ? { key: "Colors", max: 62, label: "Color sources far short", why: `Fewer than half the ${thin.map((k) => ({ W: "white", U: "blue", B: "black", R: "red", G: "green" })[k]).join("/")} sources the spells need: many hands can't cast what they draw.` } : null,
    !creatures && !walkers && !wincons && burn < 8 && !qty(spells.filter((r) => /create [^.]*creature token|\bvehicle\b|becomes? an? (?:\d+\/\d+ )?[^.]*creature/i.test(text(r.c) + " " + type(r.c)))) ? { key: "Threats", max: 45, label: "No way to win", why: "No creatures, planeswalkers, burn or alternate win conditions: the deck can stop the opponent but never finish a game." } : null,
    creatures >= 8 && threatQ < 0.7 ? { key: "Threats", max: Math.round(40 + 30 * threatQ), label: "Filler threats", why: `Most creatures are bodies with no abilities and weak stats for their cost (${Math.round(threatQ * 100)}% of a fair rate). Any deck with real cards outclasses them.` } : null,
  ];
  // Plan coherence (Gavin Verhey's rule: build a deck with a mission, not a pile). Every card
  // should serve the plan; cards that pull the other way are named, linear strategies need a
  // critical mass of their pieces, and "good stuff" midrange needs cards that out-value.
  const pw = (c) => parseInt(c.power, 10) || 0, tg = (c) => parseInt(c.toughness, 10) || 0;
  // Life gain is the plan when the deck pays it off ("whenever you gain life").
  const lifePlan = qty(spells.filter((r) => /whenever you gain life|if you gained life|for each life you gained|life total|you gained \d+ or more life/.test(text(r.c)))) >= 4,
    cheapens = (c) => /costs? \{?\d*\}? ?less|costs? \w+ less|\b(?:warp|evoke|delve|convoke|affinity|emerge|foretell|prototype|ninjutsu|dash|plot|improvise|offspring|disguise|blitz|bestow|channel|adventure)\b|cycling|without paying/.test(text(c)) || (c.card_faces || []).length > 1;
  const lifeOnly = (r) => !lifePlan && !/Creature|Land|Planeswalker/.test(type(r.c)) && /gain (?:\d+|x|that much) life/.test(text(r.c)) && !/damage|destroy|exile|counter target|draw|create|token|\+\d+\/\+\d+|search|loses? \d+ life/.test(text(r.c)),
    trick = (tx) => /target creature(?: you control)? gets \+\d+\/\+\d+ until end of turn/.test(tx) && !/draw|fights?|destroy|exile/.test(tx),
    defensive = (c) => /Creature/.test(type(c)) && (/\bdefender\b/.test(text(c)) || (pw(c) <= 1 && tg(c) >= 4)),
    offPlanWhy = {
      Aggro: (r) => lifeOnly(r) ? "gains life instead of pressing damage" : !/Creature/.test(type(r.c)) && role(r.c, "wipe") && !/(?:creatures|nonland permanents) (?:you don't control|your opponents control)/.test(text(r.c)) ? "a board wipe kills your own attackers" : defensive(r.c) ? "a defensive body that doesn't attack" : Number(r.c.cmc) >= 5 && !cheapens(r.c) && big > 4 * scale ? "too slow for a deck that wants to win by turn 5" : role(r.c, "counter") && Number(r.c.cmc) >= 3 && !cheapens(r.c) ? "holding up mana instead of attacking" : "",
      Control: (r) => trick(text(r.c)) ? "a combat trick: control rarely attacks" : /Creature/.test(type(r.c)) && Number(r.c.cmc) <= 2 && quality(r.c) < 1 ? "a small beater that trades poorly late" : "",
      Ramp: (r) => trick(text(r.c)) ? "a combat trick: ramp wants big threats, not tempo" : lifeOnly(r) ? "gains life without advancing the plan" : "",
      Midrange: (r) => lifeOnly(r) ? "gains life without affecting the board" : defensive(r.c) ? "a wall that doesn't pressure or generate value" : "",
    }[plan],
    offPlan = spells.map((r) => ({ r, why: offPlanWhy(r) })).filter((x) => x.why),
    offN = qty(offPlan.map((x) => x.r)),
    // Linear strategies: payoffs that care about a creature type, instants/sorceries or artifacts.
    PL = { Elf: "Elves", Dwarf: "Dwarves", Wolf: "Wolves", Merfolk: "Merfolk", Faerie: "Faeries", Fungus: "Fungi", Ally: "Allies", Mouse: "Mice", Sphinx: "Sphinxes", Fox: "Foxes" },
    plural = (t) => PL[t] || t + "s",
    subs = new Map();
  const NOT_TRIBE = /^(?:Sorcery|Instant|Adventure|Equipment|Aura|Saga|Vehicle|Food|Treasure|Clue|Role|Case|Room|Class|Shrine|Omen)$/;
  for (const r of creatureRows) for (const t of ((type(r.c).split(" // ")[0].split("—")[1]) || "").trim().split(/\s+/).filter((x) => x && !NOT_TRIBE.test(x))) subs.set(t, (subs.get(t) || 0) + r.qty);
  const linear = [];
  for (const [t] of [...subs].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    const re = new RegExp(`\\b(?:${lc(t)}|${lc(plural(t))})\\b(?: (?:you control|spells?|creatures?|cards?))|each other ${lc(t)}|other ${lc(plural(t))}`),
      payRows = spells.filter((r) => re.test(text(r.c))),
      payoffs = payRows.length >= 3 ? qty(payRows) : 0,
      members = qty(creatureRows.filter((r) => new RegExp(`\\b${t}\\b`).test(type(r.c)) || /changeling/.test(text(r.c))));
    if (payoffs >= 4) linear.push({ name: t + " tribal", payoffs, enablers: members, target: Math.round(18 * scale), unit: plural(t) });
  }
  const instSorc = qty(spells.filter((r) => /Instant|Sorcery/.test(type(r.c)))),
    spellPay = has(M.spells).length >= 2 ? qty(has(M.spells)) : 0;
  // Prowess and "noncreature spell" payoffs count every noncreature spell (and Adventures).
  const nonCre = /noncreature|prowess/.test(has(M.spells).map((r) => text(r.c)).join(" ")),
    nonCreN = qty(spells.filter((r) => !/Creature/.test(type(r.c).split(" // ")[0]) || (r.c.card_faces || []).some((f) => /Instant|Sorcery/.test(f.type_line || ""))));
  if (spellPay >= 4) linear.push({ name: "Spells", payoffs: spellPay, enablers: nonCre ? nonCreN : instSorc, target: Math.round(20 * scale), unit: nonCre ? "noncreature spells" : "instants and sorceries" });
  const artRows = spells.filter((r) => /artifacts? you control|whenever (?:an|another) artifact|for each artifact|affinity for artifacts|metalcraft|improvise/.test(text(r.c))),
    artPay = artRows.length >= 3 ? qty(artRows) : 0,
    arts = qty(known.filter((r) => /Artifact/.test(type(r.c)) || /create [^.]*(?:artifact|treasure|food|clue|blood|map|powerstone|gold)/.test(text(r.c))));
  if (artPay >= 4) linear.push({ name: "Artifacts", payoffs: artPay, enablers: arts, target: Math.round(16 * scale), unit: "artifacts" });
  const lin = linear.sort((a, b) => a.enablers / a.target - b.enablers / b.target)[0],
    // Midrange "good stuff": wins by trading 1-for-1 then pulling ahead with 2-for-1s.
    value = qty(spells.filter((r) => role(r.c, "draw") || walkers && /Planeswalker/.test(type(r.c)) || /Creature/.test(type(r.c)) && /when (?:this creature|.{0,40}) enters[^.]*(?:draw|destroy|exile|create|return|deals?|search|counter)/.test(text(r.c))));
  parts.push({ ...part("Plan", `Plan · ${plan}`, offN ? `${offN} off-plan` : "on plan", "0 off-plan", 1 - offN / Math.max(4, nSpell * 0.2), 12, `Every card should serve the ${plan.toLowerCase()} plan. Cards that pull the other way slow your clock or waste slots.`),
    cards: offPlan.slice(0, 8).map((x) => ({ name: `${x.r.name} — ${x.why}`, qty: x.r.qty })),
    why: offN ? `${offN} card${offN === 1 ? "" : "s"} work against a ${plan.toLowerCase()} plan: ${offPlan.slice(0, 3).map((x) => `${x.r.name} (${x.why})`).join("; ")}. Swap them for cards that do what the deck is trying to do.` : `Every spell serves the ${plan.toLowerCase()} plan.` });
  if (lin) parts.push({ ...part("Critical", `Critical mass · ${lin.name}`, `${lin.enablers} ${lin.unit}`, `${lin.target}+`, lin.enablers / lin.target, 10, "Linear decks get better with every matching card and fall apart below a threshold."),
    why: lin.enablers >= lin.target ? `${lin.enablers} ${lin.unit} feed ${lin.payoffs} payoffs: dense enough that the payoffs work most games.` : `${lin.payoffs} cards pay off ${lin.unit}, but only ${lin.enablers} are in the deck. Linear decks need about ${lin.target}; below that the payoffs are blank cards half the time.` });
  else if (plan === "Midrange" && !theme) parts.push({ ...part("Value", "Card advantage", value, Math.round(10 * scale), value / (10 * scale), 8, "Good-stuff midrange wins by out-valuing: cards that replace themselves or answer something while adding a body."),
    why: `${value} cards generate extra value (draw, enters-the-battlefield removal or tokens, planeswalkers). Midrange with no synergy needs about ${Math.round(10 * scale)} to grind the opponent out.` });
  caps.push(offN / Math.max(1, nSpell) > 0.3 ? { key: "Plan", max: 62, label: "No clear plan", why: `${offN} of ${nSpell} spells pull against the ${plan.toLowerCase()} plan. A deck that tries to do two things does neither well.` } : null);
  caps.push(lin && lin.enablers < lin.target * 0.7 ? { key: "Critical", max: 66, label: "Below critical mass", why: `Built around ${lin.unit} with only ${lin.enablers} of them: the ${lin.payoffs} payoffs do little most games.` } : null);
  if (colors.length > 0) parts.push(part("Colors", "Color sources", colors.map((k) => `${k} ${Math.round(src[k] || 0)}`).join(" · "), "enough per color", colorRatio, 8, "Main colors want about 14 sources in 60 cards, splashes about 9."));
  if (theme) parts.push(part("Synergy", "Synergy · " + theme, themeCount, Math.round(10 * scale), themeCount / (10 * scale), 8, `Cards that feed the ${theme.toLowerCase()} plan.`));
  // Shuffled games of this list: keepable 7s, land drops, an early play, interaction in hand.
  const tagOf = (r) => {
    const s = new Set(), tx = text(r.c);
    if (isLandC(r.c)) s.add("land");
    else {
      if (Number(r.c.cmc) <= 2) s.add("cheap");
      if (interacts(r.c)) s.add("inter");
      if (role(r.c, "draw")) s.add("draw");
      if (role(r.c, "ramp")) s.add("ramp");
    }
    return s;
  };
  const tagged = known.map((r) => ({ ...r, tags: tagOf(r) })),
    lo = size >= 99 ? 3 : 2, hi = size >= 99 ? 5 : 5;
  const sim = simulate(poolOf(tagged), (a) => {
    const h7 = a.slice(0, 7), l7 = countTag(h7, "land"), d9 = a.slice(0, 9), d10 = a.slice(0, 10), d12 = a.slice(0, 12);
    return { keep: l7 >= lo && l7 <= hi, t3: countTag(d9, "land") >= 3, t4: countTag(d10, "land") >= 4, flood: countTag(d12, "land") >= 8, early: hasTag(a.slice(0, 8), "cheap"), inter: hasTag(a.slice(0, 8), "inter") };
  }, { depth: 14 });
  const Sx = (k) => sim[k] || 0, Pc = (x) => Math.round(x * 100) + "%";
  parts.push({ ...part("Keep", "Keepable opening hands", Pc(Sx("keep")), "85%+", Sx("keep") / 0.85, 10, `Share of opening 7s with ${lo}–${hi} lands.`), why: `${Pc(1 - Sx("keep"))} of opening hands have too few or too many lands and should be mulliganed.` });
  // Goldfish: play it out turn by turn; aggro and midrange are judged on speed, control on mana use.
  const gold = mtgGoldfish(known.map((r) => ({ qty: r.qty, c: r.c })), { size, plan });
  if (gold) {
    const ctl = plan === "Control";
    parts.push({ ...part("Goldfish", ctl ? "Goldfish: mana use" : "Goldfish speed", ctl ? Math.round(gold.metrics[0].value * 100) + "%" : gold.turnDist && gold.speed != null ? `turn ${gold.headline.match(/turn (\d+)/)?.[1] || "10+"}` : "—", ctl ? "75%+" : `turn ${{ Aggro: 5, Midrange: 6, Ramp: 6 }[plan] || 6}`, ctl ? gold.metrics[0].value / 0.75 : gold.speed, 8, "1,000 games played out against an empty board: how fast the deck actually closes."), why: gold.headline });
  }
  const names = (re) => evidence(spells.filter((r) => re.test(text(r.c))));
  const ev = { Mana: evidence(lands), Interaction: evidence(spells.filter((r) => interacts(r.c))), Flow: evidence(has("draw")), Threats: evidence(spells.filter((r) => /Creature|Planeswalker/.test(type(r.c)))), Consistency: evidence(spells.filter((r) => r.qty <= 2 && !legendary(r.c))), Curve: evidence(spells.filter((r) => Number(r.c.cmc) >= 5)) };
  const whyOf = {
    Mana: theme === "Landfall" && Math.abs(nLand - idealLands) <= 2 ? `${nLand} lands: right for a landfall deck, where extra lands are triggers rather than flood.` : nLand < idealLands ? `${nLand} lands for an average spell cost of ${avg.toFixed(2)}: you'll miss land drops. Karsten's numbers say about ${idealLands}.` : `${nLand} lands where about ${idealLands} is right: you'll draw extra lands instead of spells.`,
    Curve: `Spells average ${avg.toFixed(2)} mana; a ${plan.toLowerCase()} deck wants ${T.curve} or less. The 5+ drops listed are the first to look at.`,
    Consistency: `Only ${Math.round(redundancy * 100)}% of spells are 3–4-ofs. The 1–2-ofs listed show up in a minority of games.`,
    Interaction: `${interaction} cards that interact. ${plan} decks want about ${Math.round(T.inter * scale)} so the opponent's best threats don't just win.`,
    Threats: `${threats} ${plan === "Control" ? "win conditions" : "threats"}${threatQ < 0.95 ? ` (creatures counted by quality: ${Math.round(threatQ * 100)}% of a fair rate)` : ""}${burn ? `, with ${burn} burn spells counted as half a threat each` : ""}; about ${Math.round(T.threats * scale)} keeps pressure on after removal.`,
    Flow: `${flow} draw/selection cards; ${plan} wants about ${Math.round(T.flow * scale)} to find what it needs.`,
    Colors: `Color sources: ${colors.map((k) => `${k} ${Math.round(src[k] || 0)}`).join(", ")}. A main color wants about 14 sources in 60 and a splash about 9.`,
    Synergy: `${themeCount} cards feed the ${theme?.toLowerCase()} plan; about ${Math.round(10 * scale)} makes it reliable.`,
  };
  for (const x of parts) {
    if (ev[x.key]) x.cards = ev[x.key];
    if (whyOf[x.key]) x.why = whyOf[x.key];
  }
  const roles = new Map(), LABEL = { land: "Land", cheap: "", inter: "Interaction", draw: "Card flow", ramp: "Ramp" };
  for (const r of tagged) roles.set(key(r.name), [...r.tags].map((k) => LABEL[k]).filter(Boolean));
  const capped = capScore(finish(parts), caps);
  return {
    score: capped.score,
    caps: capped.caps,
    parts,
    goldfish: gold,
    sims: [
      { label: "Keepable opening 7", p: Sx("keep"), target: 0.85, note: `${lo}–${hi} lands` },
      { label: "3rd land drop on time", p: Sx("t3"), target: 0.8, note: "3+ lands in 9 cards (on the draw)" },
      { label: "4th land drop on time", p: Sx("t4"), target: avg >= 3 ? 0.7 : 0.55, note: "4+ lands in 10 cards" },
      { label: "Flooded by turn 5", p: Sx("flood"), target: 0.12, lower: true, note: "8+ lands in first 12 cards" },
      { label: "A play by turn 2", p: Sx("early"), target: plan === "Aggro" ? 0.95 : 0.85, note: "spell costing 2 or less in 8 cards" },
      { label: "Interaction in opening hand", p: Sx("inter"), target: plan === "Aggro" ? 0.4 : 0.7, note: "8 cards" },
    ],
    roles,
    profile: [["Lands", nLand], ["Creatures", creatures], ["Interaction", interaction], ["Card flow", flow], ["Avg cost", avg.toFixed(2)]],
    plan: plan + (theme ? " · " + theme : ""),
    stats: { lands: nLand, idealLands, avg, interaction, threats, flow, ramp, redundancy, creatures },
    unknown,
    lens: `${plan} lens for a ${size}-card constructed deck — no Commander targets.`,
  };
}

/* ======================= Yu-Gi-Oh! ======================= */

const Y = {
  search: /add (?:1|one|2|two|up to \w+)[^.]*from your deck(?: or (?:gy|graveyard))? to your hand/,
  // Sends from the Deck to the GY: a starter when the deck's monsters trigger on it (Shaddoll…).
  mill: /send (?:1|one)([^.]*?)from your deck to the (?:gy|graveyard)/,
  milled: /if this card is sent[^.:;]*to the (?:gy|graveyard)/,
  extend: /special summon (?:this card|1|one|up to \w+)/,
  handtrap: /(?:\(quick effect\)|during either player's turn|during your opponent's turn)[^.]*(?:discard this card|send this card from your hand)|you can discard this card[^.]*;|from your hand[^.]*\(quick effect\)/,
  negate: /negate (?:the|that|its) (?:activation|effect|summon)|negate the activation/,
  removal: /(?:destroy|banish|return|send)[^.]*(?:1|one|target|up to \w+)[^.]*(?:card|monster)[^.]*(?:your )?opponent|target (?:1|one) card your opponent controls|destroy all|banish all/,
  breaker: /^(?:harpie's feather duster|lightning storm|evenly matched|dark ruler no more|forbidden droplet|triple tactics t(?:alent|hrust)|raigeki|heavy storm|kaiju|.*kaiju|dimension shifter|droll & lock bird|nibiru, the primal being|super polymerization|ultimate slayer|sanctifire)/,
  draw: /draw (?:1|2|one|two|\w+) cards?/,
  garnet: /(?:if|when) this card is (?:sent|banished|special summoned|excavated) from (?:the|your) deck|(?:can only|you can) special summon this card from your deck|cannot be normal summoned\/set/,
};

export function ygoPower(rows, f = {}) {
  // rows: [{ c, qty, zone, id? }]
  const main = rows.filter((r) => r.zone === "main" && r.c),
    extra = rows.filter((r) => r.zone === "extra" && r.c),
    Nall = rows.filter((r) => r.zone === "main").reduce((a, r) => a + r.qty, 0),
    unknown = Nall - main.reduce((a, r) => a + r.qty, 0),
    N = main.reduce((a, r) => a + r.qty, 0) + unknown,
    E = extra.reduce((a, r) => a + r.qty, 0),
    t = (r) => lc(r.c.text),
    nm = (r) => lc(r.c.name),
    tag = new Map(),
    give = (r, k) => (tag.get(r) || tag.set(r, new Set()).get(r)).add(k);
  // A searcher only starts anything if the deck runs what it searches for.
  const RACE = /\b(warrior|spellcaster|dragon|zombie|machine|fiend|fairy|beast-warrior|winged beast|beast|aqua|pyro|rock|plant|insect|thunder|dinosaur|sea serpent|reptile|psychic|wyrm|cyberse|illusion)\b monster/,
    ATTR = /\b(dark|light|water|fire|earth|wind)\b monster/,
    raceKnown = main.some((r) => r.c.race);
  const finds = (r) => {
    const m = t(r).match(/add (?:1|one|2|two|up to \w+)([^.]*?)from your deck(?: or gy| or graveyard)? to your hand/);
    if (!m) return true;
    const what = m[1], others = main.filter((x) => x !== r && x.c.name !== r.c.name),
      quoted = [...String(r.c.text || "").slice(m.index).matchAll(/"([^"]+)"/g)].slice(0, 3).map((x) => lc(x[1])).filter((qn) => what.includes(qn));
    if (quoted.length) return others.some((x) => quoted.some((qn) => nm(x).includes(qn) || lc(x.c.archetype) === qn || t(x).includes(`"${qn}"`) && lc(x.c.archetype).includes(qn)));
    if (/field spell/.test(what)) return others.some((x) => /field/i.test(x.c.typeLine || "") || /field/i.test(x.c.race || ""));
    if (/ritual/.test(what)) return others.some((x) => /ritual/i.test(x.c.typeLine || "") || /ritual/i.test(x.c.race || ""));
    const lv = Number(what.match(/level (\d+) or lower/)?.[1] || 99), race = what.match(RACE)?.[1], attr = what.match(ATTR)?.[1];
    if ((race || attr) && raceKnown) return others.some((x) => x.c.category === "Monster" && (!race || lc(x.c.race) === race) && (!attr || lc(x.c.attribute) === attr) && (Number(x.c.level) || 0) <= lv);
    return true;
  };
  // A Deck-to-GY sender starts the turn only if what it can send has a "sent to the GY" effect.
  const feeds = (r) => {
    const m = t(r).match(Y.mill);
    if (!m) return false;
    const what = m[1], race = what.match(/\b(warrior|spellcaster|dragon|zombie|machine|fiend|fairy|beast-warrior|winged beast|beast|aqua|pyro|rock|plant|insect|thunder|dinosaur|sea serpent|reptile|psychic|wyrm|cyberse|illusion)\b/)?.[1], attr = what.match(/\b(dark|light|water|fire|earth|wind)\b/)?.[1],
      quoted = [...what.matchAll(/"([^"]+)"/g)].map((x) => lc(x[1]));
    return main.some((x) => x !== r && x.c.name !== r.c.name && Y.milled.test(t(x)) && (!/monster/.test(what) || x.c.category === "Monster") &&
      (!race || lc(x.c.race) === race) && (!attr || lc(x.c.attribute) === attr) && (!quoted.length || quoted.some((qn) => nm(x).includes(qn) || lc(x.c.archetype) === qn)));
  };
  const deadSearch = [];
  for (const r of main) {
    tag.set(r, new Set());
    const txt = t(r);
    if (Y.search.test(txt)) {
      if (finds(r)) give(r, "starter");
      else deadSearch.push(r);
    } else if (feeds(r)) give(r, "starter");
    if (r.c.category === "Monster" && Y.extend.test(txt)) give(r, "extender");
    if (Y.handtrap.test(txt)) give(r, "handtrap");
    else if (Y.negate.test(txt)) give(r, "negate");
    if (Y.removal.test(txt) || Y.breaker.test(nm(r))) give(r, "breaker");
    if (Y.draw.test(txt) && r.c.category === "Spell") give(r, "draw");
    if (r.c.category === "Monster" && Number(r.c.level) >= 7 && !/special summon|cannot be normal summoned/.test(txt) && !/ritual/i.test(r.c.typeLine || "")) give(r, "brick");
    else if (Y.garnet.test(txt) && !tag.get(r).has("starter") && !tag.get(r).has("handtrap")) give(r, "garnet");
  }
  const by = (k) => main.filter((r) => tag.get(r).has(k)),
    q = (list) => list.reduce((a, r) => a + r.qty, 0),
    starters = by("starter"), extenders = by("extender"), hts = by("handtrap"), negs = by("negate"), breakers = by("breaker"), bricks = by("brick"), garnets = by("garnet"),
    inter = [...hts, ...negs],
    triples = main.filter((r) => r.qty >= 3),
    archetypes = new Map();
  for (const r of main) if (r.c.archetype) archetypes.set(r.c.archetype, (archetypes.get(r.c.archetype) || 0) + r.qty);
  const lead = [...archetypes].sort((a, b) => b[1] - a[1])[0],
    focus = lead ? lead[1] / Math.max(1, N) : 0,
    engine = main.filter((r) => (lead && r.c.archetype === lead[0]) || tag.get(r).has("starter") || tag.get(r).has("extender")),
    nonEngine = main.filter((r) => !engine.includes(r)),
    minMain = f.main?.[0] || 40;
  // Shuffled games of this exact list: 5 cards going first, 6 going second.
  const pool = poolOf(main.map((r) => ({ qty: r.qty, tags: tag.get(r), name: r.c.name })));
  const sim = simulate(pool, (a) => {
    const h5 = a.slice(0, 5), h6 = a.slice(0, 6),
      st = hasTag(h5, "starter"), it5 = hasTag(h5, "handtrap") || hasTag(h5, "negate");
    return {
      open: st,
      full: st && it5,
      second: hasTag(h6, "handtrap") || hasTag(h6, "negate") || hasTag(h6, "breaker"),
      brick: !st && countTag(h5, "brick") + countTag(h5, "garnet") >= 2,
      dead: !st && !hasTag(h5, "extender") && !it5,
    };
  });
  const S = (k) => sim[k] || 0, P = (x) => Math.round(x * 100) + "%";
  const parts = [
    { ...part("Size", "Main Deck size", N, minMain, N < minMain ? 0 : 1 - (N - minMain) / 15, 12, "Every card over 40 lowers the odds of opening your best cards.", "Trim to 40 by cutting your weakest 1-ofs."),
      why: N < minMain ? `${N} cards is under the ${minMain}-card minimum, so the deck isn't legal yet.` : `${N} cards: each of your ${q(starters)} starters shows up less often than at 40. Cutting ${N - minMain} card${N - minMain === 1 ? "" : "s"} raises your starter odds to ${P(atLeastOne(minMain, q(starters), 5))}.` },
    { ...part("Starters", "Opens a starter", P(S("open")), "88%+", S("open") / 0.88, 16, `Share of 5-card hands with a card that searches or starts your combo (${q(starters)} starters in ${N}).`),
      cards: evidence(starters), why: deadSearch.length ? `${P(S("open"))} of hands open a starter. ${deadSearch.map((r) => r.c.name).slice(0, 3).join(", ")} ${deadSearch.length > 1 ? "search" : "searches"} for cards the deck doesn't run, so ${deadSearch.length > 1 ? "they don't" : "it doesn't"} count.` : q(starters) ? `Only ${P(S("open"))} of hands going first have a starter. Competitive lists sit at 85–90%; that usually means 12–15 one-card starters at 40.` : "No card searches or starts a combo, so most hands just play whatever they drew." },
    { ...part("Extenders", "Extenders", q(extenders), 6, q(extenders) / 6, 8, "Monsters that Special Summon themselves keep the combo going after a hand trap."),
      cards: evidence(extenders), why: `${q(extenders)} extender${q(extenders) === 1 ? "" : "s"}. One Ash Blossom or Nibiru on your starter ends the turn unless you have a second line.` },
    { ...part("Interaction", "Hand traps & negates", q(inter), 9, q(inter) / 9, 12, "Cards that stop the opponent's combo from your hand or field."),
      cards: evidence(inter), why: `${q(inter)} interaction card${q(inter) === 1 ? "" : "s"}. Going second against a combo deck you need about 9 (Ash Blossom, Infinite Impermanence, Maxx "C"…) to stop them before they finish.` },
    { ...part("Second", "Going-second hand", P(S("second")), "85%+", S("second") / 0.85, 10, "Share of 6-card hands with a hand trap, negate or board breaker."),
      why: `${P(S("second"))} of hands going second can interact at all; the other ${P(1 - S("second"))} just watch the opponent build a board.` },
    { ...part("Ideal", "Starter + interaction", P(S("full")), "60%+", S("full") / 0.6, 8, "Going first: a starter and a card to protect or disrupt, in the same 5."),
      why: `Only ${P(S("full"))} of 5-card hands have both a starter and interaction, the hand top players want going first.` },
    { ...part("Removal", "Board breakers", q(breakers), 4, q(breakers) / 4, 8, "Ways to clear an established board when going second."),
      cards: evidence(breakers), why: `${q(breakers)} board breaker${q(breakers) === 1 ? "" : "s"}. Against a full board with negates you want 3–5: Harpie's Feather Duster, Lightning Storm, Evenly Matched, Kaijus, Dark Ruler No More.` },
    { ...part("Consistency", "3-of consistency", Math.round((q(triples) / Math.max(1, N)) * 100) + "%", "55%", q(triples) / Math.max(1, N) / 0.55, 8, "Maxed copies of key cards make every hand look the same."),
      cards: evidence(main.filter((r) => r.qty < 3 && (tag.get(r).has("starter") || tag.get(r).has("handtrap")))), why: "Key cards are run at 1–2 copies, so many games you never see them. The cards listed are starters or hand traps under 3 copies." },
    { ...part("Focus", lead ? "Focus · " + lead[0] : "Archetype focus", Math.round(focus * 100) + "%", "35%+", focus / 0.35, 6, "Most competitive decks are built around one archetype's engine."),
      why: lead ? `${lead[0]} is ${Math.round(focus * 100)}% of the deck. Below about a third, the engine doesn't show up reliably.` : "No archetype holds the deck together, so cards rarely search or support each other." },
    { ...part("Bricks", "Dead draws", q(bricks) + q(garnets), "≤ 2", 1 - Math.max(0, q(bricks) + q(garnets) - 2) / 6, 6, "Cards that do nothing when drawn: big monsters you can't summon, or cards meant to be sent from the Deck."),
      cards: evidence([...bricks, ...garnets]), why: `${q(bricks) + q(garnets)} cards are dead in hand. ${P(S("brick"))} of hands have two of them and no starter.` },
  ];
  // Decks whose main deck summons from the Extra Deck (Xyz, Rank-Up, Fusion, Synchro, Link) are
  // crippled without one; for them an empty Extra Deck is a major hole, not a minor gap.
  const needsExtra = main.some((r) => /xyz|rank-up|fusion summon|synchro|link summon|extra deck/.test(t(r))),
    sideN = rows.filter((r) => r.zone === "side").reduce((a, r) => a + r.qty, 0);
  // Can the main deck actually summon what's in the Extra Deck? Xyz need monsters of their Level,
  // Synchro need a Tuner, named Fusion materials must be in the deck.
  const mons = main.filter((r) => r.c.category === "Monster"),
    levelFix = mons.some((r) => /treated as (?:a )?level|becomes? level|change (?:its|their) levels?|declare a level|level of/.test(t(r))),
    usable = (c) => {
      const tx = lc(c.text), fr = lc((c.frame || "") + " " + (c.typeLine || ""));
      if (/xyz/.test(fr)) {
        const m = tx.match(/(\d+)\+? level (\d+) monsters/);
        return !m || levelFix || q(mons.filter((r) => Number(r.c.level) === Number(m[2]))) >= 3;
      }
      if (/synchro/.test(fr)) return mons.some((r) => /tuner/i.test(r.c.typeLine || "")) || /non-tuner/.test(tx) === false;
      if (/fusion/.test(fr)) {
        const names = [...String(c.text || "").split(/\n|\./)[0].matchAll(/"([^"]+)"/g)].map((x) => lc(x[1]));
        return !names.length || names.some((n) => main.some((r) => nm(r).includes(n) || lc(r.c.archetype) === n));
      }
      return true;
    },
    dead = extra.filter((r) => !usable(r.c)),
    Eok = E - q(dead);
  if (f.extra) parts.push({ ...part("Extra", "Extra Deck", dead.length ? `${Eok} usable of ${E}` : E, f.extra, (Eok / f.extra) ** (needsExtra ? 1.5 : 1), needsExtra ? 16 : 6, needsExtra ? "This deck's engine summons from the Extra Deck, so a full one is the deck." : "A full Extra Deck gives you more lines and answers."), cards: evidence(dead.length ? dead : extra), why: dead.length ? `${q(dead)} Extra Deck card${q(dead) === 1 ? "" : "s"} can't be summoned with this Main Deck (no monsters of the right Level, no Tuner, or named materials it doesn't run): ${dead.slice(0, 4).map((r) => r.c.name).join(", ")}${dead.length > 4 ? "…" : ""}.` : needsExtra ? `Only ${E} of ${f.extra} Extra Deck cards, but the main deck is built to summon from it (Xyz, Rank-Up, Fusion, Synchro or Link). Without backups and generic Extra Deck tools, one negate or a missing piece ends the turn.` : `${f.extra - E} Extra Deck slot${f.extra - E === 1 ? "" : "s"} empty: free lines and outs you aren't using.` });
  if (f.side) parts.push({ ...part("Side", "Side Deck", sideN, f.side, Math.min(1, sideN / f.side), 4, "Fifteen cards to swap in for games 2 and 3 against the decks you expect."), why: sideN ? `${sideN} of ${f.side} Side Deck cards: fewer answers to bring in after game 1.` : "No Side Deck. Tournament matches are best of three; without one you can't adapt for games 2 and 3." });
  const gold = ygoGoldfish(main.map((r) => ({ qty: r.qty, c: r.c, tags: tag.get(r) })), extra.map((r) => ({ qty: r.qty, c: r.c })));
  if (gold) parts.push({ ...part("Goldfish", "Plays through interruption", Math.round(gold.metrics[0].value * 100) + "%", "65%+", gold.speed, 0, "1,000 opening hands read like a player would: can it start, and keep going after a hand trap?"), why: gold.headline });
  const roles = new Map(),
    LABEL = { starter: "Starter", extender: "Extender", handtrap: "Hand trap", negate: "Negate", breaker: "Breaker", draw: "Draw", brick: "Brick", garnet: "Dead draw" };
  for (const r of main) roles.set(String(r.id ?? r.c.id ?? r.c.name), [...tag.get(r)].map((k) => LABEL[k]));
  const caps = [
    (q(starters) < 4 || S("open") < 0.5) && (focus < 0.25 || q(deadSearch) >= 6) ? { key: "Starters", max: 50, label: "No engine", why: `Nothing in the deck searches or starts a combo${deadSearch.length ? ` (${deadSearch.map((r) => r.c.name).slice(0, 3).join(", ")} search for cards it doesn't run)` : ""} ${focus < 0.25 ? " and no archetype holds it together" : ""}. Hand traps and staples stop the opponent but can't win on their own.` } : null,
    q(deadSearch) >= 6 && q(starters) >= 4 ? { key: "Starters", max: 70, label: "Searchers with nothing to search", why: `${q(deadSearch)} cards search for cards this deck doesn't run: ${deadSearch.slice(0, 4).map((r) => r.c.name).join(", ")}. They're dead draws, not starters.` } : null,
    needsExtra && !E ? { key: "Extra", max: 55, label: "No Extra Deck", why: "The engine summons from the Extra Deck (Xyz, Synchro, Fusion or Link), and the Extra Deck is empty: its combos have nothing to make." } : null,
    needsExtra && E && Eok / E < 0.4 ? { key: "Extra", max: 65, label: "Extra Deck it can't use", why: `The engine summons from the Extra Deck, but ${q(dead)} of ${E} cards there can't be made from this Main Deck.` } : null,
  ];
  const capped = capScore(finish(parts), caps);
  return {
    score: capped.score,
    caps: capped.caps,
    parts,
    goldfish: gold,
    plan: lead ? lead[0] + " engine" : "Unfocused",
    unknown,
    stats: { N, E, starters: q(starters), extenders: q(extenders), handtraps: q(hts), negates: q(negs), breakers: q(breakers), startOdds: S("open"), second: S("second"), engine: q(engine), nonEngine: q(nonEngine) },
    profile: [["Engine", `${q(engine)} cards`], ["Non-engine", `${q(nonEngine)} cards`], ["Starters", q(starters)], ["Hand traps", q(hts)], ["Extra Deck", `${E}/${f.extra || 15}`]],
    sims: [
      { label: "Going first: opens a starter", p: S("open"), target: 0.88, note: "5 cards" },
      { label: "Going first: starter + interaction", p: S("full"), target: 0.6, note: "5 cards" },
      { label: "Going second: can interact", p: S("second"), target: 0.85, note: "6 cards · hand trap, negate or breaker" },
      { label: "Bricked hand", p: S("brick"), target: 0.05, lower: true, note: "no starter, 2+ dead cards" },
      { label: "Nothing to do", p: S("dead"), target: 0.05, lower: true, note: "no starter, extender or interaction" },
    ],
    roles,
    lens: `${f.name || "Yu-Gi-Oh!"} lens: 40-card combo consistency and interaction.`,
  };
}

/* ======================= Pokémon ======================= */

const P = {
  draw: /draw (?:\d+|a|cards? until|until you have)|shuffle your hand into your deck and draw|draws a card for each/,
  search: /search your deck for/,
  gust: /switch (?:in )?1 of your opponent's benched pokémon|your opponent switches their active pokémon with/,
  switch: /switch your active pokémon with 1 of your benched|switch out your active|switch your active pokémon/,
  recovery: /from your discard pile into your hand|shuffle .* from your discard pile into your deck|from your discard pile to your hand/,
  accel: /attach (?:up to \w+ |a |an |\d+ )?(?:basic )?(?:\w+ )?energy (?:cards? )?from your (?:deck|discard pile|hand) to/,
  disrupt: /each player shuffles their hand|your opponent shuffles their hand|discard an energy from your opponent|your opponent can't play any item/,
};
const SUPPORTER = /^(?:iono|professor's research|boss's orders|lillie's determination|arven|judge|carmine|crispin|briar|jacq|penny|irida|cyllene|colress's tenacity|peonia|raihan|kieran|black belt's training|lana's aid|janine's secret art|morty's conviction|eri|clavell|giacomo|ciphermaniac's codebreaking|grand tree|hilda|dawn|lacey|brock's scouting|team rocket's (?:petrel|ariana|proton|archer|giovanni)|cynthia|marnie|n|sada's vitality|turo's scenario|professor turo's scenario)$/i;

const ETYPE = { G: "Grass", R: "Fire", W: "Water", L: "Lightning", P: "Psychic", F: "Fighting", D: "Darkness", M: "Metal" };
// Damage an attack can reasonably deal: "30×" and "60+" scale, so count them above their printed number.
// Damage an attack can reasonably deal in a real game. Printed numbers undersell scaling attacks:
// "30×" for each Energy or card in hand, "60+" with a bonus, attacks that place damage counters
// (Alakazam) or hit any Pokémon for a fixed amount (Fezandipiti ex) all count for what they do.
const MULT = (eff) => (/cards? in (?:your|their) hand/.test(eff) ? 7 : /prize/.test(eff) ? 3 : /damage counters? on (?:this|your)|bench/.test(eff) ? 5 : 4);
export const attackDamage = (a) => {
  const t = String(a?.damage ?? ""), eff = lc(a?.effect), n = parseInt(t.replace(/\D/g, "")) || 0;
  if (/[×x]/.test(t)) return Math.min(n * MULT(eff), 340);
  if (/\+/.test(t)) {
    const bonus = Number(eff.match(/(\d+) more damage/)?.[1] || n / 2);
    // "For each" scales; a one-off "if …" bonus only applies some of the time.
    return Math.min(n + (/for each/.test(eff) ? bonus * (MULT(eff) - 1) : /\bif\b/.test(eff) ? bonus * 0.5 : bonus), 340);
  }
  if (n) return n;
  const fixed = Number(eff.match(/does (\d+) damage to (?:1|one|each|2|two)/)?.[1] || 0),
    counters = Number(eff.match(/put (\d+) damage counters?/)?.[1] || 0) * 10;
  return Math.min(Math.max(fixed, counters * (/for each/.test(eff) ? MULT(eff) : 1)), 340);
};
// Best attack, doubled when an Ability lets it attack twice (Festival Lead); attacks this Pokémon
// can only use as a copy of another don't count.
export const attackReach = (c, names = null) => {
  const best = Math.max(0, ...(c?.attacks || []).map(attackDamage)),
    // "If Festival Grounds is in play…": only counts when the deck runs that card.
    met = (a) => { const need = String(a.effect || "").match(/if ([A-Z][^,.]*?) is in play/)?.[1]; return !need || !names || names.has(need.toLowerCase()); },
    twice = (c?.abilities || []).some((a) => met(a) && /attack twice|attack it has twice|use (?:this|its) attack (?:again|twice)|may attack (?:an additional|again)|attack again/i.test(a.effect || ""));
  return twice ? Math.min(best * 2, 340) : best;
};
// Damage an attack spreads to the opponent's Bench (Dragapult ex's Phantom Dive: 6 counters), which
// softens the next Pokémon it has to Knock Out.
export const attackSpread = (c) => Math.max(0, ...(c?.attacks || []).map((a) => {
  const e = lc(a.effect);
  if (!/bench/.test(e) || !/opponent/.test(e)) return 0;
  const counters = Number(e.match(/put (\d+) damage counters?/)?.[1] || 0) * 10, each = Number(e.match(/(\d+) damage to each of your opponent'?s benched/)?.[1] || 0) * 2, one = Number(e.match(/(\d+) damage to 1 of your opponent'?s benched/)?.[1] || 0);
  return Math.min(Math.max(counters, each, one), 200);
}));
// Energy types an Ability needs attached before it works ("if this Pokémon has any Darkness Energy attached").
export const abilityEnergy = (c) => [...new Set((c?.abilities || []).flatMap((a) => [...String(a.effect || "").matchAll(/(?:has|have) (?:any |at least \w+ )?(?:\{([GRWLPFDM])\}|(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal)) Energy attached/gi)].map((m) => ETYPE[m[1]?.toUpperCase()] || m[2][0].toUpperCase() + m[2].slice(1).toLowerCase())))];

export function ptcgPower(rows, f = {}) {
  const main = rows.filter((r) => r.c),
    unknown = rows.filter((r) => !r.c).reduce((a, r) => a + r.qty, 0),
    // Size counts every card in the list, even ones whose details haven't loaded yet.
    N = main.reduce((a, r) => a + r.qty, 0) + unknown,
    lcText = (r) => lc(r.c.effect || r.c.text || ""),
    abil = (r) => (r.c.abilities || []).map((a) => lc(a.effect)).join(" "),
    isTrainer = (r) => r.c.category === "Trainer",
    supporter = (r) => isTrainer(r) && (/Supporter/.test(r.c.typeLine || "") || SUPPORTER.test(r.c.name)),
    tag = new Map();
  for (const r of main) {
    const s = new Set(), tx = isTrainer(r) ? lcText(r) : "", ab = abil(r), any = tx + " " + ab;
    if (r.c.basicPokemon) s.add("basic");
    if (r.c.category === "Energy") s.add("energy");
    if (supporter(r)) s.add("supporter");
    if ((isTrainer(r) || ab) && P.draw.test(any)) s.add("draw");
    if ((isTrainer(r) || ab) && P.search.test(any) && !/search your deck for (?:up to \w+ )?(?:basic )?\w* ?energy/.test(any)) s.add("search");
    if (P.gust.test(any)) s.add("gust");
    if (isTrainer(r) && P.switch.test(tx) && !P.gust.test(tx)) s.add("switch");
    if (r.c.category === "Pokemon" && r.c.retreat === 0) s.add("pivot");
    if (isTrainer(r) && P.recovery.test(tx)) s.add("recovery");
    if (P.accel.test(any) || P.accel.test(lc(r.c.text || ""))) s.add("accel");
    if (P.disrupt.test(any)) s.add("disrupt");
    if (/^rare candy$/i.test(r.c.name)) s.add("candy");
    tag.set(r, s);
  }
  const by = (k) => main.filter((r) => tag.get(r).has(k)),
    q = (list) => list.reduce((a, r) => a + r.qty, 0),
    named = (n) => q(main.filter((r) => r.c.name === n)),
    basics = q(by("basic")),
    pokemon = q(main.filter((r) => r.c.category === "Pokemon")),
    trainers = q(main.filter(isTrainer)),
    energy = q(by("energy")),
    draws = by("draw"), searches = by("search"), gusts = by("gust"), switches = [...by("switch"), ...by("pivot")], recs = by("recovery"), sups = by("supporter"), accel = by("accel"),
    quads = main.filter((r) => r.qty >= 3 && !r.c.basicEnergy),
    names = new Set(main.map((r) => r.c.name)),
    broken = main.filter((r) => r.c.evolveFrom && !names.has(r.c.evolveFrom)),
    candy = q(by("candy")),
    aces = main.filter((r) => r.c.aceSpec),
    radiants = main.filter((r) => r.c.radiant),
    needTypes = [...new Set(main.flatMap((r) => r.c.attackCosts || []))],
    energyTypes = new Set(main.filter((r) => r.c.category === "Energy").map((r) => (r.c.basicEnergy ? r.c.name.replace(/^Basic | Energy$/g, "") : "Special"))),
    missingTypes = needTypes.filter((tp) => !energyTypes.has(tp)),
    // Abilities that only work with a type of Energy attached (Munkidori needs Darkness).
    deadAbility = energyTypes.has("Special") ? [] : main.filter((r) => abilityEnergy(r.c).some((tp) => !energyTypes.has(tp))),
    energyFit = !missingTypes.length || energyTypes.has("Special") ? 1 : 0.4,
    mull = 1 - atLeastOne(N, basics, 7),
    ruleBox = main.filter((r) => r.c.ruleBox);
  // Evolution lines: Basic-Stage 1-Stage 2 counts for each evolved Pokémon.
  const byName = new Map(main.filter((r) => r.c.category === "Pokemon").map((r) => [r.c.name, r]));
  const lines = main
    .filter((r) => r.c.category === "Pokemon" && /Stage ?2/.test(r.c.stage || "") || (r.c.category === "Pokemon" && /Stage ?1/.test(r.c.stage || "") && !main.some((x) => x.c.evolveFrom === r.c.name)))
    .map((top) => {
      const two = /2/.test(top.c.stage),
        mid = two ? top.c.evolveFrom : null,
        base = two ? byName.get(mid)?.c.evolveFrom || "" : top.c.evolveFrom;
      const nb = named(base), nm = mid ? named(mid) : 0, nt = top.qty;
      const thin = two ? nb < 4 || nt < 3 || nm + Math.min(candy, 4) < nt + 2 : nb < 3 || nt < 2;
      return { top: top.c.name, base, mid, two, counts: two ? [nb, nm, nt] : [nb, nt], thin, text: (two ? [nb, nm, nt] : [nb, nt]).join("-") };
    });
  // Attackers that copy another Pokémon's attack (N's Zoroark ex, Mew ex) hit as hard as the best
  // attack they can copy in this deck.
  const copies = (c) => (c.attacks || []).some((a) => /choose 1 of (?:your |the )?(?:benched |opponent's )?[^.]*attacks?[^.]*use it|use (?:it|that attack) as this attack/i.test(a.effect || ""));
  const deckNames = new Set(main.map((r) => lc(r.c.name))),
    ownReach = new Map(main.map((r) => [r, attackReach(r.c, deckNames)])),
    copyReach = Math.max(0, ...main.filter((r) => r.c.category === "Pokemon" && !copies(r.c)).map((r) => ownReach.get(r)));
  const dmg = (r) => (copies(r.c) ? Math.max(ownReach.get(r), Math.min(copyReach, 340)) : ownReach.get(r)),
    // The deck can only attack with what its Energy pays for (Special Energy may provide any type).
    costOf = (r) => [...new Set((r.c.attacks || []).filter((a) => attackDamage(a) === attackReach(r.c) || attackDamage(a) * 2 === attackReach(r.c)).flatMap((a) => a.cost || []).filter((x) => x !== "Colorless"))],
    payable = (r) => energyTypes.has("Special") || costOf(r).every((tp) => energyTypes.has(tp)),
    attackers = main.filter((r) => r.c.category === "Pokemon").sort((a, b) => payable(b) - payable(a) || dmg(b) - dmg(a) || (b.c.ruleBox ? 1 : 0) - (a.c.ruleBox ? 1 : 0) || /2/.test(b.c.stage || "") - /2/.test(a.c.stage || "") || b.qty - a.qty),
    mainAtk = attackers[0],
    line = mainAtk ? lines.find((l) => l.top === mainAtk.c.name) : null;
  // Shuffled games: mulligan until a Basic, set 6 Prizes, draw for turn 1 and turn 2.
  const pool = poolOf(main.map((r) => ({ qty: r.qty, tags: tag.get(r), name: r.c.name })));
  const piece = (n) => (c) => c.name === n;
  const sim = simulate(pool, (a) => {
    const h7 = a.slice(0, 7);
    if (!hasTag(h7, "basic")) return null;
    const t1 = [...h7, a[13]].filter(Boolean), t2 = [...t1, a[14]].filter(Boolean);
    const out = hasTag(t1, "draw") || hasTag(t1, "search"),
      sup = hasTag(t1, "supporter") && t1.some((c) => c.tags.has("supporter") && c.tags.has("draw"));
    let setup = true;
    if (line) {
      const need = [line.base, line.two ? null : line.top, line.two ? line.top : null].filter(Boolean),
        miss = need.filter((n) => !t2.some(piece(n))).length + (line.two && !t2.some(piece(line.mid)) && !hasTag(t2, "candy") ? 1 : 0);
      setup = miss <= countTag(t2, "search");
    } else if (mainAtk) setup = t1.some(piece(mainAtk.c.name)) || hasTag(t1, "search");
    return { out, sup, setup, energy: !needTypes.length || hasTag(t1, "energy") || hasTag(t1, "accel") };
  }, { depth: 16 });
  const S = (k) => sim[k] || 0, Pc = (x) => Math.round(x * 100) + "%";
  // Single key cards that can be stuck in the Prizes.
  const prizeRisk = main
    .filter((r) => r.qty <= 2 && !r.c.basicEnergy && (tag.get(r).size || r === mainAtk))
    .map((r) => ({ name: r.c.name, qty: r.qty, p: allIn(N, r.qty, 6) }))
    .sort((a, b) => b.p - a.p);
  const thin = lines.filter((l) => l.thin);
  const parts = [
    { ...part("Size", "Deck size", N, 60, N === 60 ? 1 : 0, 8, "Pokémon decks are exactly 60 cards."), why: `${N} cards. The deck must be exactly 60 to be legal.` },
    { ...part("Basics", "Basic Pokémon", basics, "10–14", 1 - Math.max(0, mull - 0.12) / 0.25, 10, `${Pc(mull)} of opening hands have no Basic (a mulligan).`),
      cards: evidence(by("basic")), why: `${basics} Basics means ${Pc(mull)} of games start with a mulligan, giving your opponent free cards. Most lists play 10–14.` },
    { ...part("Draw", "Draw power", q(draws), 8, q(draws) / 8, 14, "Supporters and Abilities that refill your hand (Iono, Professor's Research, Bibarel…).", "Draw"),
      cards: evidence(draws), why: `${q(draws)} draw cards. Without a steady draw engine you run out of things to do by turn 3; competitive lists play 8+ draw Supporters, often backed by a draw Ability.` },
    { ...part("Start", "Turn-1 draw or search", Pc(S("out")), "90%+", S("out") / 0.9, 10, "Share of games with a draw or search card in your first 8 cards (after mulligans and Prizes)."),
      why: `${Pc(1 - S("out"))} of games start with no draw or search card at all, so you're stuck with your opening hand.` },
    { ...part("Search", "Search", q(searches), 8, q(searches) / 8, 12, "Ultra Ball, Nest Ball, Buddy-Buddy Poffin and search Abilities find your attackers on time."),
      cards: evidence(searches), why: `${q(searches)} search cards. Your evolution pieces and attackers arrive by luck instead of on schedule.` },
    { ...part("Setup", line ? `Setup · ${line.top}` : mainAtk ? `Setup · ${mainAtk.c.name}` : "Setup", Pc(S("setup")), line?.two ? "55%+" : "75%+", S("setup") / (line?.two ? 0.55 : 0.75), 10,
      line ? `Chance to have every piece of ${line.top} (or Rare Candy and search to cover it) by your second turn.` : "Chance to find your main attacker by turn 1."),
      why: `Only ${Pc(S("setup"))} of games have your ${line?.top || mainAtk?.c.name || "main attacker"} line ready by turn 2${line?.two ? " (Basic, Stage 2, and Stage 1 or Rare Candy)" : ""}. More search, a thicker line or more Rare Candy fixes this.` },
    { ...part("Lines", "Evolution lines", broken.length ? broken.length + " broken" : thin.length ? thin.map((l) => l.text).join(", ") : lines.length ? lines.map((l) => l.text).join(", ") : "none", "4-3-3 or 4-2-3 + Candy", broken.length ? 0.2 : Math.max(0.35, 1 - 0.2 * thin.length), 8, "Every Stage 1/2 needs the card it evolves from, in enough copies to survive a Prize or a knockout."),
      cards: [...broken.map((r) => ({ name: `${r.c.name} (no ${r.c.evolveFrom})`, qty: r.qty })), ...thin.map((l) => ({ name: `${l.top} line ${l.text}`, qty: l.counts.at(-1) }))],
      why: broken.length ? `${broken.map((r) => r.c.name).join(", ")} can't be played: the card ${broken.length > 1 ? "they evolve" : "it evolves"} from isn't in the deck.` : `Thin line${thin.length > 1 ? "s" : ""}: ${thin.map((l) => `${l.top} ${l.text}`).join(", ")}. One prized or knocked-out Basic and the line is gone. Standard shapes are 4-3-3 (or 4-2-3 with 4 Rare Candy) and 4-3.` },
    { ...part("Gust", "Gust", q(gusts), 3, q(gusts) / 3, 8, "Pulling up a Benched Pokémon wins prize races (Boss's Orders, Counter Catcher, Prime Catcher)."),
      cards: evidence(gusts), why: `${q(gusts)} gust card${q(gusts) === 1 ? "" : "s"}. You can only take the Prize your opponent offers you; most lists play 3–4.` },
    { ...part("Switch", "Switching", q(switches), 2, switches.length ? q(switches) / 2 : 0.3, 5, "Switch, Escape Rope or a free-retreat Pokémon to get out of the Active Spot."),
      cards: evidence(switches), why: `${q(switches)} ways to switch. A stuck Active Pokémon or Special Condition costs you a whole turn.` },
    { ...part("Recovery", "Recovery", q(recs), 2, q(recs) / 2, 5, "Night Stretcher, Super Rod and friends bring back knocked-out attackers."),
      cards: evidence(recs), why: `${q(recs)} recovery card${q(recs) === 1 ? "" : "s"}. Once your attackers are knocked out, they're gone for good.` },
    { ...part("Energy", "Energy", energy, needTypes.length ? needTypes.join("/") : "any", energyFit * (deadAbility.length ? 0.6 : 1) * (energy >= 6 || !needTypes.length ? 1 : energy / 6) * (S("energy") >= 0.75 || !needTypes.length ? 1 : S("energy") / 0.75) * (energy > 16 ? Math.max(0.2, 1 - (energy - 16) / 12) : 1), 8, `Enough of the right Energy for your attacks. ${Pc(S("energy"))} of games have Energy or acceleration by turn 1.`),
      cards: evidence([...by("energy"), ...accel, ...deadAbility]), why: missingTypes.length ? `Attacks need ${missingTypes.join(", ")} Energy, which the deck doesn't run.` : deadAbility.length ? `${deadAbility.map((r) => `${r.c.name}'s Ability needs ${abilityEnergy(r.c).join("/")} Energy attached`).join("; ")}, and the deck runs none, so ${deadAbility.length > 1 ? "those cards do" : "it does"} nothing.` : energy > 16 ? `${energy} Energy is far more than any attacker needs. Competitive lists run 8–14; every extra one is a Trainer you don't draw.` : `${energy} Energy: ${Pc(1 - S("energy"))} of games have none (and no acceleration) on turn 1.` },
    { ...part("Consistency", "4-of consistency", Math.round((q(quads) / Math.max(1, N)) * 100) + "%", "55%", q(quads) / Math.max(1, N) / 0.55, 6, "Key Trainers and Basics as 3–4-ofs."),
      cards: evidence(main.filter((r) => r.qty <= 2 && (tag.get(r).has("draw") || tag.get(r).has("search")))), why: "Draw and search cards run as 1–2-ofs. Those are the cards every competitive list maxes out." },
    { ...part("Ace", "ACE SPEC", aces.length ? aces.map((r) => r.c.name).join(", ") : "none", "1", q(aces) > 1 ? 0 : aces.length ? 1 : 0.6, 3, "One ACE SPEC (Prime Catcher, Master Ball, Unfair Stamp…) is a free power boost."),
      why: q(aces) > 1 ? `${q(aces)} ACE SPEC cards: only 1 is allowed.` : "No ACE SPEC. Every deck may play one, and most play one." },
  ];
  // Win plan: a deck needs an attacker that can take Prizes against today's 200-330 HP ex Pokémon,
  // in enough copies to keep attacking after one is Knocked Out. Consistency can't make up for it.
  // Every Pokémon that hits close to as hard as the main attacker counts: decks often share the
  // job between two or three attackers (Mewtwo ex and friends) instead of 4 of one.
  const reach = mainAtk ? dmg(mainAtk) : 0,
    team = attackers.filter((r) => payable(r) && dmg(r) >= Math.max(110, reach * 0.45)),
    atkQty = mainAtk ? Math.max(line ? line.counts.at(-1) : mainAtk.qty, q(team)) : 0,
    // Recovery (Night Stretcher, Super Rod) brings a Knocked Out attacker back.
    lives = atkQty + Math.min(2, Math.floor(q(recs) / 2)),
    // Single-Prize swarm: many cheap attackers make the opponent take six Knock Outs instead of three.
    swarm = q(attackers.filter((r) => payable(r) && !r.c.ruleBox && dmg(r) >= 30 && r.c.category === "Pokemon")) >= 10,
    cost = mainAtk ? Math.min(...(mainAtk.c.attacks || []).filter((a) => attackDamage(a) === reach).map((a) => (a.cost || []).length), 9) : 9,
    atkRatio = Math.max(swarm ? 0.8 : 0, clamp(reach / 200) * (lives >= 3 ? 1 : lives === 2 ? 0.8 : 0.55) * (cost <= 3 || accel.length ? 1 : 0.85));
  // Only judged when attack details have loaded; brief search results carry none.
  const atkKnown = main.some((r) => r.c.category === "Pokemon" && Array.isArray(r.c.attacks));
  if (atkKnown) parts.push({ ...part("Attacker", mainAtk ? `Attacker · ${mainAtk.c.name}` : "Attacker", mainAtk ? `${reach} dmg · ${atkQty} attacker${atkQty === 1 ? "" : "s"}` : "none", "200+ dmg · 3+", atkRatio, 16, "The Pokémon that takes your Prizes: how hard it hits, how many copies, how much Energy it needs."),
    cards: mainAtk ? evidence([mainAtk]) : [],
    why: !mainAtk ? "No Pokémon in the list attacks for real damage." : swarm && reach < 160 ? `A single-Prize swarm: ${q(attackers.filter((r) => payable(r) && !r.c.ruleBox && dmg(r) >= 30))} small attackers, so the opponent needs six Knock Outs. ${mainAtk.c.name} hits hardest at ${reach}; against 200+ HP ex Pokémon it needs two hits or more each.` : reach < 120 ? `Your hardest hitter is ${mainAtk.c.name} for ${reach}. Most competitive decks Knock Out a 200+ HP ex in one or two attacks; at ${reach} a game takes ${Math.ceil(240 / Math.max(10, reach))}+ attacks per ex, and the deck has no other way to win.` : `${mainAtk.c.name} hits for ${reach}${team.length > 1 ? ` (with ${team.filter((r) => r !== mainAtk).map((r) => r.c.name).slice(0, 2).join(", ")})` : ""}${atkQty < 3 ? ` but only ${atkQty} attacker${atkQty === 1 ? "" : "s"} in the deck, so one Knock Out leaves ${atkQty === 1 ? "none" : "one"}` : ""}${cost > 3 ? `, and needs ${cost} Energy` : ""}.` });
  if (q(radiants) > 1) parts.push({ ...part("Radiant", "Radiant limit", q(radiants), "≤ 1", 0, 6, "Only one Radiant Pokémon per deck."), why: `${q(radiants)} Radiant Pokémon: only 1 is allowed.` });
  const gold = ptcgGoldfish(main.map((r) => ({ qty: r.qty, c: r.c })), { attacker: mainAtk?.c.name, line });
  if (gold) parts.push({ ...part("Goldfish", "Goldfish speed", gold.headline.match(/turn (\d+)/)?.[1] ? `turn ${gold.headline.match(/turn (\d+)/)[1]}` : "6+", "turn 2", gold.speed, 0, "1,000 games played out: draw, search, bench, evolve, attach, attack, until the main attacker swings."), why: gold.headline });
  const LABEL = { basic: "Basic", supporter: "Supporter", draw: "Draw", search: "Search", gust: "Gust", switch: "Switch", pivot: "Free retreat", recovery: "Recovery", accel: "Accel", disrupt: "Disruption", candy: "Candy", energy: "" };
  const roles = new Map();
  for (const r of main) roles.set(String(r.id ?? r.c.id ?? r.c.name), [...(r === mainAtk ? ["Main attacker"] : []), ...[...tag.get(r)].map((k) => LABEL[k]).filter(Boolean)]);
  const multi = q(ruleBox.filter((r) => !r.c.basicPokemon || dmg(r) >= 100));
  // A consistent deck with nothing to win with is still not a strong deck.
  // The hardest hitter the list is built around, whether or not the Energy can pay for it.
  const star = main.filter((r) => r.c.category === "Pokemon").sort((a, b) => dmg(b) - dmg(a))[0],
    stranded = star && !payable(star) && dmg(star) >= 120 && (!mainAtk || !payable(mainAtk) || reach < dmg(star) * 0.6) ? star : null,
    cantPay = stranded ? costOf(stranded).filter((tp) => !energyTypes.has(tp)) : [];
  const caps = [
    atkKnown && atkRatio < 1 && !swarm ? { key: "Attacker", max: Math.round(55 + 40 * atkRatio), label: reach < 120 ? "No real attacker" : "Attacker too thin", why: parts.find((x) => x.key === "Attacker")?.why } : null,
    cantPay.length ? { key: "Energy", max: 45, label: "Main attacker can't attack", why: `${stranded?.c.name}'s attack needs ${cantPay.join(" and ")} Energy and the deck runs none, so its best attacker never attacks.` } : null,
    line && !swarm && q(team.filter((r) => r.c.name !== line.top)) < 2 && (line.counts[0] < 3 || line.counts.at(-1) < 2 || (line.two && line.counts[1] + Math.min(candy, 4) < 3)) ? { key: "Lines", max: 62, label: "Main line too thin", why: `${line.top} is on a ${line.text} line${line.two && !candy ? " with no Rare Candy" : ""}. One prized or Knocked Out piece and the deck has no attacker; lists run 4-3-3, or 4-2-3 with Rare Candy.` } : null,
    deadAbility.length ? { key: "Energy", max: 85, label: "Abilities that can't work", why: `${deadAbility.map((r) => r.c.name).join(", ")} need${deadAbility.length > 1 ? "" : "s"} Energy the deck doesn't run.` } : null,
  ];
  const capped = capScore(finish(parts), caps);
  return {
    score: capped.score,
    caps: capped.caps,
    parts,
    goldfish: gold,
    // For matchups: who takes the Prizes, how hard, and what it's weak to.
    attacker: mainAtk ? { name: mainAtk.c.name, reach, spread: attackSpread(mainAtk.c), prize: mainAtk.c.prize ?? (mainAtk.c.ruleBox ? 2 : 1), hp: Number(mainAtk.c.hp) || 0, types: mainAtk.c.types || [], weak: (mainAtk.c.weak || []).map((w) => w.type), ruleBox: !!mainAtk.c.ruleBox, lives, gust: q(gusts), disrupt: q(by("disrupt")), swarm } : null,
    plan: mainAtk ? mainAtk.c.name + (line ? ` · ${line.text} line` : "") : "Pokémon deck",
    stats: { N, basics, pokemon, trainers, energy, mull },
    unknown,
    profile: [["Pokémon", pokemon], ["Trainers", trainers], ["Energy", energy], ["Supporters", q(sups)], ["Prize plan", multi >= 4 ? "Two-prize attackers" : ruleBox.length ? "Mixed" : "Single-prize"]],
    sims: [
      { label: "Mulligan", p: mull, target: 0.15, lower: true, note: "no Basic in opening 7 (exact)" },
      { label: "Draw or search on turn 1", p: S("out"), target: 0.9, note: "first 8 cards, after Prizes" },
      { label: "Draw Supporter on turn 1", p: S("sup"), target: 0.75, note: "Iono, Professor's Research…" },
      { label: line ? `${line.top} ready by turn 2` : "Main attacker by turn 1", p: S("setup"), target: line?.two ? 0.55 : 0.75, note: line ? `${line.text} line, search covers missing pieces` : "" },
      ...(needTypes.length ? [{ label: "Energy on turn 1", p: S("energy"), target: 0.75, note: "Energy or acceleration in first 8" }] : []),
      ...prizeRisk.slice(0, 3).map((x) => ({ label: `${x.name} all prized`, p: x.p, target: 0.05, lower: true, note: `${x.qty} cop${x.qty === 1 ? "y" : "ies"} · exact` })),
    ],
    roles,
    lens: `${f.name || "Standard"} lens: opening, draw, search, setup speed and prize-race tools.`,
  };
}

/* ======================= Meta match (all games) ======================= */

// Weighted overlap between two lists: Σ min(qty) / Σ max(qty), over non-basic cards.
export function overlap(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let num = 0, den = 0;
  for (const k of keys) {
    const x = a.get(k) || 0, y = b.get(k) || 0;
    num += Math.min(x, y);
    den += Math.max(x, y);
  }
  return den ? num / den : 0;
}

// mine: Map(key→qty). metaDecks: [{ key, name/archetype, rank, place, rows: Map(key→qty), labels: Map(key→name) }]
// Like overlap, but a card counts by how specific it is to a deck: generic staples that most
// placing lists play (Ultra Ball, Ash Blossom, Fable of the Fallen…) count for little, so two
// lists only "match" when they share the cards that make an archetype what it is.
export function coreOverlap(a, b, spread) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let num = 0, den = 0;
  for (const k of keys) {
    const w = 1 - 0.9 * (spread.get(k) || 0), x = a.get(k) || 0, y = b.get(k) || 0;
    num += w * Math.min(x, y);
    den += w * Math.max(x, y);
  }
  return den ? num / den : 0;
}
export function metaMatch(mine, metaDecks, archetypes = []) {
  let best = null;
  // How widely each card is played across archetypes (not lists, so one popular deck's own cards
  // aren't mistaken for staples).
  const archOf = (d) => d.archetype || d.name, byArch = new Map();
  for (const d of metaDecks) for (const k of d.rows.keys()) (byArch.get(k) || byArch.set(k, new Set()).get(k)).add(archOf(d));
  const nArch = new Set(metaDecks.map(archOf)).size,
    spread = new Map([...byArch].map(([k, set]) => [k, nArch > 2 ? (set.size - 1) / (nArch - 1) : 0]));
  for (const d of metaDecks) {
    const s = coreOverlap(mine, d.rows, spread);
    if (!best || s > best.sim || (s === best.sim && d.rank < best.deck.rank)) best = { sim: s, deck: d };
  }
  if (!best) return null;
  // The deck's family: lists with the same archetype name, and lists that are mostly the same cards
  // under another name ("Elfnote" and "Ars Magna Elfnote").
  const arch = archetypes.find((a) => a.name === best.deck.archetype || a.id === best.deck.archetype || a.name === best.deck.name) || null,
    named = metaDecks.filter((d) => (d.archetype || d.name) === (best.deck.archetype || best.deck.name)),
    sameArch = metaDecks.filter((d) => named.includes(d) || coreOverlap(d.rows, best.deck.rows, spread) >= 0.55),
    // Core cards come from lists of the same archetype name (when there are enough of them):
    // a close cousin's signature card isn't this deck's core.
    coreLists = named.length >= 3 ? named : sameArch,
    bestRank = Math.min(...sameArch.map((d) => d.rank || 99)),
    missing = [], extra = [];
  for (const [k, n] of best.deck.rows) {
    const mineN = mine.get(k) || 0;
    if (n > mineN) missing.push({ key: k, name: best.deck.labels.get(k) || k, qty: n - mineN });
  }
  for (const [k, n] of mine) {
    const theirs = best.deck.rows.get(k) || 0;
    if (n > theirs) extra.push({ key: k, qty: n - theirs });
  }
  missing.sort((a, b) => b.qty - a.qty);
  extra.sort((a, b) => b.qty - a.qty);
  // The archetype's core: cards nearly every list of it plays that other archetypes don't. Missing
  // one (Karn in Tron) breaks the deck even if the rest of the list matches.
  // Playing too few copies counts too: one Karn where the lists play four draws it a quarter as
  // often. "Short" is half or less of what the archetype's lists usually play.
  // How often lists of other decks play a card: a hand trap or Boss's Orders is everywhere.
  const others = metaDecks.filter((d) => !sameArch.includes(d)), fieldRate = new Map();
  for (const d of others) for (const k of d.rows.keys()) fieldRate.set(k, (fieldRate.get(k) || 0) + 1 / others.length);
  const core = [], short = [], singleton = [...best.deck.rows.values()].every((n) => n <= 1);
  for (const [k, n] of best.deck.rows) {
    const plays = coreLists.map((d) => d.rows.get(k) || 0).filter((x) => x > 0),
      inArch = plays.length / Math.max(1, coreLists.length);
    // Singleton formats (Commander): a 1-of every list of the archetype plays is core too.
    // …and isn't a field-wide staple (a hand trap or Boss's Orders that most decks play).
    if (!(inArch >= 0.8 && (n >= 2 || (singleton && coreLists.length >= 3)) && (spread.get(k) || 0) <= 0.5 && (fieldRate.get(k) || 0) < 0.35)) continue;
    const usual = plays.sort((a, b) => a - b)[Math.floor(plays.length / 2)] || n, have = mine.get(k) || 0;
    // How specific to this deck the card is (a Karn nobody else plays: 1; a card a fifth of other
    // decks run: about 0.6), so a missing generic card costs less than a missing signature card.
    const unique = Math.max(0.3, 1 - 2 * (fieldRate.get(k) || 0));
    if (!have) core.push({ key: k, name: best.deck.labels.get(k) || k, qty: usual, unique });
    else if (usual >= 2 && have * 2 <= usual) short.push({ key: k, name: best.deck.labels.get(k) || k, qty: usual, have, unique });
  }
  // What the family usually plays (cards in at least half its lists, at their usual count). A fresh
  // list is compared with that as well as with single lists, and every copy short of it costs
  // something, staples included: four Boss's Orders, the hand traps, Sol Ring.
  const consensus = new Map(), counted = new Set([...core, ...short].map((x) => x.key));
  const allKeys = new Set(sameArch.flatMap((d) => [...d.rows.keys()]));
  for (const k of allKeys) {
    const plays = sameArch.map((d) => d.rows.get(k) || 0).filter((x) => x > 0);
    if (plays.length / Math.max(1, sameArch.length) >= 0.5) consensus.set(k, plays.sort((a, b) => a - b)[Math.floor(plays.length / 2)]);
  }
  const consSim = sameArch.length >= 2 ? coreOverlap(mine, consensus, spread) : 0;
  if (consSim > best.sim) best = { sim: consSim, deck: best.deck };
  // Shortfall against a reference list: weighted by how widely the family plays each card.
  // Measured against the family's consensus and against the closest real list, and the smaller one
  // counts: a list that matches a real placing list isn't charged for another variant's choices.
  const shortfallVs = (ref, minIn) => {
    let total = 0;
    const out = [];
    for (const [k, usual] of ref) {
      if (counted.has(k)) continue;
      const inArch = sameArch.filter((d) => d.rows.get(k)).length / Math.max(1, sameArch.length);
      if (inArch < minIn) continue;
      const have = mine.get(k) || 0, miss = Math.max(0, usual - have) / usual;
      if (!miss) continue;
      total += miss * ((spread.get(k) || 0) <= 0.5 ? 1 : 0.7) * Math.min(1, inArch + 0.1);
      out.push({ key: k, name: best.deck.labels.get(k) || sameArch.find((d) => d.labels?.get(k))?.labels.get(k) || k, qty: usual, have });
    }
    return { total, out };
  };
  const vsFamily = shortfallVs(consensus, 0.6), vsList = shortfallVs(best.deck.rows, 0.3),
    pickRef = vsList.total <= vsFamily.total ? vsList : vsFamily,
    deficit = pickRef.total, thinned = pickRef.out;
  thinned.sort((a, b) => (b.qty - b.have) / b.qty - (a.qty - a.have) / a.qty);
  const share = arch?.share ?? sameArch.length / Math.max(1, metaDecks.length),
    finishQ = bestRank <= 1 ? 1 : bestRank <= 2 ? 0.9 : bestRank <= 4 ? 0.8 : bestRank <= 8 ? 0.7 : bestRank <= 32 ? 0.55 : 0.45,
    metaScore = Math.round(72 + 28 * clamp(0.55 * finishQ + 0.45 * clamp(share / 0.12))),
    weight = clamp((best.sim - 0.35) / 0.45);
  return { sim: best.sim, deck: best.deck, archetype: best.deck.archetype || best.deck.name, share, bestRank, lists: sameArch.length, missing: missing.slice(0, 10), extra: extra.slice(0, 10), metaScore, weight, coreMissing: core.slice(0, 6), coreShort: short.slice(0, 6), deficit, thinned: thinned.slice(0, 8) };
}

// Deck Power is always judged against the field, never in a vacuum. A list can be built well
// and still be outclassed by every deck people actually win with. So:
//   • no tournament data for this game/format yet → build check only, capped at 70 ("Solid");
//   • a close copy of a placing archetype → mostly that archetype's results (finish, share);
//   • anything else (rogue or off-meta) → its build, pulled toward how much of it the field
//     actually plays, and capped at 74: "Competitive" has to be earned with results.
// mine: Map(key→qty) of non-basic cards. decks: the placing lists for this game and format.
export const BUILD_CAP = 70, ROGUE_CAP = 62;
export function metaContext({ build, mine, decks = [], match = null, loaded = false, formatOk = true, archetypes = [] }) {
  if (!loaded || !formatOk || !decks.length)
    return { score: build, from: "build", capped: false, reason: !loaded ? "unloaded" : !formatOk ? "format" : "empty" };
  // How much of this list the field plays: each card's share of placing lists, weighted by copies.
  const lists = decks.length,
    seen = new Map();
  for (const d of decks) for (const k of d.rows.keys()) seen.set(k, (seen.get(k) || 0) + 1);
  let tot = 0, w = 0;
  const unplayed = [];
  for (const [k, n] of mine) {
    const rate = (seen.get(k) || 0) / lists;
    tot += Math.min(1, rate / 0.25) * n;
    w += n;
    if (!rate) unplayed.push({ key: k, qty: n });
  }
  const presence = w ? tot / w : 0,
    played = w ? 1 - unplayed.reduce((a, x) => a + x.qty, 0) / w : 0,
    field = [...archetypes].sort((a, b) => (b.share || 0) - (a.share || 0)).slice(0, 4);
  if (match && match.sim >= 0.35) {
    const k = clamp((match.sim - 0.35) / 0.45),
      broken = (match.coreMissing || []).reduce((a, x) => a + (x.unique ?? 1), 0),
      thin = (match.coreShort || []).reduce((a, x) => a + (1 - x.have / x.qty) * (x.unique ?? 1), 0),
      // Each missing core piece costs the borrowed tournament credit: it's no longer that deck.
      // Too few copies of one costs in proportion to the copies cut.
      // Copies short of what the archetype usually plays, and cards no placing list plays (filler),
      // cost in proportion; the list is judged, not just the archetype's results.
      shortfall = Math.min(30, (match.deficit || 0) * 5),
      filler = Math.max(0, 1 - played - 0.12) * 45,
      metaScore = match.metaScore - Math.min(50, broken * 28 + thin * 28) - shortfall - filler,
      mixed = Math.round(build * (1 - k) * 0.5 + Math.min(build, ROGUE_CAP) * (1 - k) * 0.5 + metaScore * k),
      // Never far above how well the list itself is built (mana, curve, interaction, consistency).
      score = Math.min(mixed, build + 18);
    return { score: Math.max(0, Math.min(100, score)), from: k >= 0.75 && broken < 0.3 && thin < 0.3 && shortfall < 5 ? "meta" : "mixed", presence, played, unplayed, field, lists, coreMissing: match.coreMissing || [], coreShort: match.coreShort || [], thinned: shortfall >= 3 ? match.thinned || [] : [], shortfall, filler };
  }
  // Off-meta: mostly what the field says about these cards, then how well it's built. A pile of
  // staples around an engine nobody plays lands in casual territory (about 45–60).
  const rogue = Math.round(Math.min(ROGUE_CAP, build * 0.45 + (20 + 40 * presence) * 0.55));
  return { score: build, fieldEstimate: rogue, from: "rogue", capped: false, presence, played, unplayed, field, lists };
}

export function blend(heur, match) {
  if (!match || match.weight <= 0) return { score: heur, from: "build" };
  return { score: Math.round(heur * (1 - match.weight) + Math.max(heur, match.metaScore) * match.weight), from: match.weight >= 0.75 ? "meta" : "mixed" };
}

export const placeText = (r) => (r <= 1 ? "1st" : r === 2 ? "2nd" : r <= 4 ? "Top 4" : r <= 8 ? "Top 8" : r <= 16 ? "Top 16" : r <= 32 ? "Top 32" : "5-0 league / listed");

/* ======================= Tournament upgrades ======================= */

// What lists of the same archetype play that this list doesn't (and what it plays that they don't).
// mine: Map(key→qty). lists: placing decks of the matched archetype (rows: Map(key→qty), labels).
export function archetypeUpgrades(mine, lists) {
  if (!lists?.length) return { lists: 0, adds: [], cuts: [] };
  const stats = new Map();
  for (const d of lists)
    for (const [k, n] of d.rows) {
      const s = stats.get(k) || { key: k, name: d.labels?.get(k) || k, lists: 0, copies: 0 };
      s.lists++;
      s.copies += n;
      stats.set(k, s);
    }
  const adds = [],
    cuts = [];
  for (const s of stats.values()) {
    const share = s.lists / lists.length,
      typical = Math.max(1, Math.round(s.copies / s.lists)),
      have = mine.get(s.key) || 0;
    if (share >= 0.4 && have < typical) adds.push({ key: s.key, name: s.name, share, typical, have, need: typical - have });
  }
  for (const [k, n] of mine) {
    const s = stats.get(k),
      share = s ? s.lists / lists.length : 0;
    if (share < 0.15) cuts.push({ key: k, qty: n, share });
  }
  adds.sort((a, b) => b.share - a.share || b.need - a.need);
  cuts.sort((a, b) => a.share - b.share || b.qty - a.qty);
  return { lists: lists.length, adds: adds.slice(0, 24), cuts: cuts.slice(0, 16) };
}
