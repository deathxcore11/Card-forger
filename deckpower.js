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

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lc = (s) => String(s || "").toLowerCase();

export function powerGrade(score) {
  return score >= 90 ? "Tournament-ready" : score >= 80 ? "Competitive" : score >= 68 ? "Solid" : score >= 55 ? "Playable" : score >= 40 ? "Rough" : "Unfinished";
}

const finish = (parts) => {
  const w = parts.reduce((a, p) => a + p.weight, 0) || 1;
  return Math.round((parts.reduce((a, p) => a + clamp(p.ratio) * p.weight, 0) / w) * 100);
};
const part = (key, label, count, target, ratio, weight, hint, fix = "") => ({ key, label, count, target, ratio: clamp(ratio), weight, hint, fix });

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
    has = (re) => spells.filter((r) => re.test(text(r.c))),
    qty = (list) => list.reduce((a, r) => a + r.qty, 0),
    creatures = qty(spells.filter((r) => /Creature/.test(type(r.c)))),
    walkers = qty(spells.filter((r) => /Planeswalker/.test(type(r.c)))),
    interaction = qty(has(M.removal)) + qty(has(M.counter)) + qty(has(M.discard)) + qty(has(M.wipe)),
    flow = qty(has(M.draw)),
    ramp = qty(has(M.ramp)),
    big = qty(spells.filter((r) => Number(r.c.cmc) >= 5)),
    scale = size / 60;
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
  const cheapHelp = qty(spells.filter((r) => Number(r.c.cmc) <= 2 && (M.draw.test(text(r.c)) || M.ramp.test(text(r.c))))),
    idealLands = Math.round((19.59 + 1.9 * avg - 0.28 * Math.min(cheapHelp, 12)) * scale),
    nonLegendSpells = spells.filter((r) => !legendary(r.c)),
    redundant = qty(nonLegendSpells.filter((r) => r.qty >= 3)) + qty(spells.filter((r) => legendary(r.c) && r.qty >= 2)),
    redundancy = nSpell ? redundant / nSpell : 0;
  // Colors: pips per color vs sources per color (Karsten wants ~14+ sources for a main color in 60).
  const pips = {}, src = {};
  for (const r of spells) for (const m of (r.c.mana_cost || r.c.card_faces?.[0]?.mana_cost || "").match(/\{[^}]+\}/g) || []) for (const col of "WUBRG") if (m.includes(col)) pips[col] = (pips[col] || 0) + r.qty;
  for (const r of lands) for (const m of r.c.produced_mana || (isBasicC(r.c) ? [{ Plains: "W", Island: "U", Swamp: "B", Mountain: "R", Forest: "G" }[r.c.name]] : [])) if (m) src[m] = (src[m] || 0) + r.qty;
  const colors = Object.keys(pips),
    pipTotal = colors.reduce((a, k) => a + pips[k], 0),
    colorRatio = colors.length <= 1 ? (nLand ? 1 : 0) : Math.min(...colors.map((k) => clamp((src[k] || 0) / Math.max(1, Math.round((pips[k] / pipTotal >= 0.4 ? 14 : 9) * scale))))),
    threats = plan === "Control" ? creatures + walkers + qty(spells.filter((r) => /win the game|each opponent loses/.test(text(r.c)))) : creatures + walkers,
    themeCount = theme ? themes[0][1] + (theme === "Landfall" ? ramp : 0) : 0;
  const parts = [
    part("Mana", "Mana base", nLand, idealLands, 1 - Math.abs(nLand - idealLands) / 5, 18, `With an average spell cost of ${avg.toFixed(2)}, about ${idealLands} lands hit your drops on time.`),
    part("Curve", "Curve for the plan", avg.toFixed(2), "≤ " + T.curve, 1 - Math.max(0, avg - T.curve) / 1.2, 14, `${plan} decks want their spells to average ${T.curve} or less.`),
    part("Consistency", "Consistency (3–4 copies)", Math.round(redundancy * 100) + "%", "70%", redundancy / 0.7, 16, "Competitive lists run their key cards as 4-ofs so they show up every game.", "Cut 1-of and 2-of cards and play more copies of your best ones."),
    part("Interaction", "Interaction", interaction, Math.round(T.inter * scale), interaction / Math.max(1, T.inter * scale), 14, "Removal, counters and discard that stop your opponent’s plan.", "Removal"),
    part("Threats", plan === "Control" ? "Win conditions" : "Threat density", threats, Math.round(T.threats * scale), threats / Math.max(1, T.threats * scale), 14, plan === "Control" ? "Control needs a few ways to actually win." : "Enough threats that removal can’t answer them all."),
    part("Flow", "Card flow", flow, Math.round(T.flow * scale), flow / Math.max(1, T.flow * scale), 8, "Draw, scry, surveil and explore keep you hitting what you need.", "Draw"),
  ];
  if (colors.length > 1) parts.push(part("Colors", "Color sources", colors.map((k) => `${k} ${src[k] || 0}`).join(" · "), "enough per color", colorRatio, 8, "Main colors want about 14 sources in 60 cards, splashes about 9."));
  if (theme) parts.push(part("Synergy", "Synergy · " + theme, themeCount, Math.round(10 * scale), themeCount / (10 * scale), 8, `Cards that feed the ${theme.toLowerCase()} plan.`));
  return {
    score: finish(parts),
    parts,
    plan: plan + (theme ? " · " + theme : ""),
    stats: { lands: nLand, idealLands, avg, interaction, threats, flow, ramp, redundancy, creatures },
    unknown,
    lens: `${plan} lens for a ${size}-card constructed deck — no Commander targets.`,
  };
}

/* ======================= Yu-Gi-Oh! ======================= */

const Y = {
  search: /add (?:1|one|up to \w+)[^.]*from your deck to your hand/,
  extend: /special summon (?:this card|1|one|up to \w+)/,
  handtrap: /(?:\(quick effect\)|during either player's turn|during your opponent's turn)[^.]*(?:discard this card|send this card from your hand)|you can discard this card[^.]*;|from your hand[^.]*\(quick effect\)/,
  negate: /negate (?:the|that|its) (?:activation|effect|summon)|negate the activation/,
  removal: /(?:destroy|banish|return|send)[^.]*(?:1|one|target|up to \w+)[^.]*(?:card|monster)[^.]*(?:your )?opponent|target (?:1|one) card your opponent controls|destroy all|banish all/,
  draw: /draw (?:1|2|one|two|\w+) cards?/,
};

export function ygoPower(rows, f = {}) {
  // rows: [{ c, qty, zone }]
  const main = rows.filter((r) => r.zone === "main" && r.c),
    extra = rows.filter((r) => r.zone === "extra" && r.c),
    N = main.reduce((a, r) => a + r.qty, 0),
    E = extra.reduce((a, r) => a + r.qty, 0),
    q = (pred) => main.filter(pred).reduce((a, r) => a + r.qty, 0),
    t = (r) => lc(r.c.text),
    starters = q((r) => Y.search.test(t(r)) || (r.c.category === "Spell" && /field/i.test(r.c.typeLine || "") && Y.search.test(t(r)))),
    extenders = q((r) => r.c.category === "Monster" && Y.extend.test(t(r))),
    handtraps = q((r) => Y.handtrap.test(t(r))),
    negates = q((r) => Y.negate.test(t(r)) && !Y.handtrap.test(t(r))),
    removal = q((r) => Y.removal.test(t(r))),
    bricks = q((r) => r.c.category === "Monster" && Number(r.c.level) >= 7 && !/special summon|cannot be normal summoned/.test(t(r)) && !/ritual/i.test(r.c.typeLine || "")),
    triples = q((r) => r.qty >= 3),
    archetypes = new Map();
  for (const r of main) if (r.c.archetype) archetypes.set(r.c.archetype, (archetypes.get(r.c.archetype) || 0) + r.qty);
  const lead = [...archetypes].sort((a, b) => b[1] - a[1])[0],
    focus = lead ? lead[1] / Math.max(1, N) : 0,
    // Chance to open at least one starter in 5 cards.
    open = (k) => {
      let none = 1;
      for (let i = 0; i < 5; i++) none *= Math.max(0, N - k - i) / Math.max(1, N - i);
      return 1 - none;
    },
    startOdds = open(starters + Math.round(extenders / 2)),
    minMain = f.main?.[0] || 40;
  const parts = [
    part("Size", "Main Deck size", N, minMain, N < minMain ? 0 : 1 - (N - minMain) / 15, 14, "Every card over 40 lowers the odds of opening your best cards.", "Trim to 40 by cutting your weakest 1-ofs."),
    part("Starters", "Starters & searchers", starters, 12, startOdds / 0.9, 20, `About ${Math.round(startOdds * 100)}% of opening hands contain a starter (aim for 85–90%).`),
    part("Extenders", "Extenders", extenders, 6, extenders / 6, 10, "Special-summoners that keep the combo going through a hand trap."),
    part("Interaction", "Hand traps & negates", handtraps + negates, 9, (handtraps + negates) / 9, 18, "Going second you need cards that stop the opponent’s combo from your hand."),
    part("Removal", "Board breakers", removal, 4, removal / 4, 8, "Ways to clear an established board when going second."),
    part("Consistency", "3-of consistency", Math.round((triples / Math.max(1, N)) * 100) + "%", "55%", triples / Math.max(1, N) / 0.55, 12, "Maxed copies of key cards make every hand look the same."),
    part("Focus", lead ? "Focus · " + lead[0] : "Archetype focus", Math.round(focus * 100) + "%", "35%+", focus / 0.35, 8, "Most competitive decks are built around one archetype’s engine."),
    part("Bricks", "Dead draws", bricks, "≤ 2", 1 - Math.max(0, bricks - 2) / 6, 6, "High-level monsters with no way to summon them clog your hand."),
  ];
  if (f.extra) parts.push(part("Extra", "Extra Deck", E, f.extra, E / f.extra, 6, "A full Extra Deck gives you more lines and answers."));
  return { score: finish(parts), parts, plan: lead ? lead[0] + " engine" : "Unfocused", stats: { N, E, starters, extenders, handtraps, negates, startOdds }, lens: `${f.name || "Yu-Gi-Oh!"} lens: 40-card combo consistency and interaction.` };
}

/* ======================= Pokémon ======================= */

const P = {
  draw: /draw (?:\d+|a|cards? until|until you have)|shuffle your hand into your deck and draw/,
  search: /search your deck for/,
  gust: /switch (?:in )?1 of your opponent's benched pokémon|your opponent switches their active pokémon with/,
  recovery: /from your discard pile into your hand|shuffle .* from your discard pile into your deck/,
};
export function ptcgPower(rows, f = {}) {
  const main = rows.filter((r) => r.c),
    N = main.reduce((a, r) => a + r.qty, 0),
    q = (pred) => main.filter(pred).reduce((a, r) => a + r.qty, 0),
    t = (r) => lc(r.c.text || r.c.effect || "") + " " + (r.c.abilities || []).map((a) => lc(a.effect)).join(" "),
    basics = q((r) => r.c.basicPokemon),
    pokemon = q((r) => r.c.category === "Pokemon"),
    trainers = q((r) => r.c.category === "Trainer"),
    energy = q((r) => r.c.category === "Energy"),
    draw = q((r) => (r.c.category === "Trainer" || r.c.abilities?.length) && P.draw.test(t(r))),
    search = q((r) => r.c.category === "Trainer" && P.search.test(t(r))),
    gust = q((r) => P.gust.test(t(r))),
    recovery = q((r) => r.c.category === "Trainer" && P.recovery.test(t(r))),
    quads = q((r) => r.qty >= 3 && !r.c.basicEnergy),
    names = new Set(main.map((r) => r.c.name)),
    broken = main.filter((r) => r.c.evolveFrom && !names.has(r.c.evolveFrom)).length,
    needTypes = [...new Set(main.flatMap((r) => r.c.attackCosts || []))],
    energyTypes = new Set(main.filter((r) => r.c.category === "Energy").map((r) => (r.c.basicEnergy ? r.c.name.replace(/^Basic | Energy$/g, "") : "Special"))),
    energyFit = !needTypes.length || needTypes.every((tp) => energyTypes.has(tp)) || energyTypes.has("Special") ? 1 : 0.4,
    mull = (() => {
      let none = 1;
      for (let i = 0; i < 7; i++) none *= Math.max(0, N - basics - i) / Math.max(1, N - i);
      return none;
    })(),
    attackers = main.filter((r) => r.c.category === "Pokemon" && !r.c.basicPokemon || r.c.ruleBox).sort((a, b) => b.qty - a.qty)[0];
  const parts = [
    part("Size", "Deck size", N, 60, N === 60 ? 1 : 0, 10, "Pokémon decks are exactly 60 cards."),
    part("Basics", "Basic Pokémon", basics, "8–12", 1 - Math.max(0, mull - 0.12) / 0.25, 16, `${Math.round(mull * 100)}% of opening hands have no Basic (a mulligan).`),
    part("Draw", "Draw power", draw, 8, draw / 8, 18, "Supporters and Abilities that refill your hand (Iono, Professor’s Research…).", "Draw"),
    part("Search", "Search", search, 8, search / 8, 16, "Ultra Ball, Nest Ball and friends find your attackers on time."),
    part("Gust", "Gust & switching", gust, 3, gust / 3, 10, "Pulling up a Benched Pokémon wins prize races (Boss’s Orders, Counter Catcher…)."),
    part("Consistency", "Consistency (3–4 copies)", Math.round((quads / Math.max(1, N)) * 100) + "%", "55%", quads / Math.max(1, N) / 0.55, 12, "Key Trainers and Basics as 4-ofs."),
    part("Energy", "Energy fit", energy, needTypes.length ? needTypes.join("/") : "any", energyFit * (energy >= 6 || !needTypes.length ? 1 : energy / 6), 10, "Enough of the right Energy for your attacks."),
    part("Lines", "Evolution lines", broken ? broken + " broken" : "complete", "complete", broken ? 0.3 : 1, 8, "Every Stage 1/2 needs the card it evolves from."),
  ];
  return { score: finish(parts), parts, plan: attackers ? attackers.c.name.replace(/ ex$/, " ex") + " deck" : "Pokémon deck", stats: { N, basics, pokemon, trainers, energy, mull }, lens: `${f.name || "Standard"} lens: opening, draw, search and prize-race tools.` };
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
export function metaMatch(mine, metaDecks, archetypes = []) {
  let best = null;
  for (const d of metaDecks) {
    const s = overlap(mine, d.rows);
    if (!best || s > best.sim || (s === best.sim && d.rank < best.deck.rank)) best = { sim: s, deck: d };
  }
  if (!best) return null;
  const arch = archetypes.find((a) => a.name === best.deck.archetype || a.id === best.deck.archetype || a.name === best.deck.name) || null,
    sameArch = metaDecks.filter((d) => (d.archetype || d.name) === (best.deck.archetype || best.deck.name)),
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
  const share = arch?.share ?? sameArch.length / Math.max(1, metaDecks.length),
    finishQ = bestRank <= 1 ? 1 : bestRank <= 2 ? 0.9 : bestRank <= 4 ? 0.8 : bestRank <= 8 ? 0.7 : bestRank <= 32 ? 0.55 : 0.45,
    metaScore = Math.round(72 + 28 * clamp(0.55 * finishQ + 0.45 * clamp(share / 0.12))),
    weight = clamp((best.sim - 0.35) / 0.45);
  return { sim: best.sim, deck: best.deck, archetype: best.deck.archetype || best.deck.name, share, bestRank, lists: sameArch.length, missing: missing.slice(0, 10), extra: extra.slice(0, 10), metaScore, weight };
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
