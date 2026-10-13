import { hasCommander, isCommanderLike, formatOf } from "./formats.js";
// Deck engine analysis, goldfish simulation, version comparison and collection value.
// Pure functions: no DOM, no network. Everything here is a transparent heuristic,
// not a win-rate prediction.
import {
  cardKey,
  sumQty,
  rulesText,
  typeText,
  isLand,
  isBasic,
  cardPrice,
  aggregateCards,
} from "./core.js";
import { commanderTheme } from "./planner.js";

const lower = (c) => rulesText(c).toLowerCase();

/* ---------- Roles ---------- */

const RAMP = [
  /\{t\}(?:,[^:]*)?: add /,
  /\badd (?:\{[wubrgc]\}|one mana|two mana|three mana|x mana|mana of any|an amount of|that much)/,
  /search your library for (?:a|an|up to \w+|two) (?:basic )?(?:land|plains|island|swamp|mountain|forest|snow land)/,
  /put (?:a|up to \w+|two) (?:basic )?land cards? .*onto the battlefield/,
  /you may put a land card from your hand onto the battlefield/,
  /create (?:a|an|one|two|three|x|\w+) treasure tokens?/,
  /spells? (?:you cast )?cost(?:s)? \{\d\} less/,
];
const DRAW = [
  /\bdraws? (?:a|an|one|two|three|four|five|seven|x|that many|\d+) (?:additional )?cards?/,
  /\bdraw cards? equal to/,
  /exile the top .*?(?:you may|until end of turn,? you may) (?:play|cast)/,
  /\binvestigate\b/,
  /look at the top .*put (?:one|two|that card|it) into your hand/,
];
const REMOVAL = [
  /(?:destroy|exile) target (?:creature|artifact|enchantment|planeswalker|battle|permanent|nonland permanent|nonland|attacking|blocking|tapped|creature or|artifact or|noncreature)/,
  /counter target (?:spell|creature spell|noncreature spell|activated|triggered)/,
  /deals? (?:\d+|x|that much) damage to (?:any target|target creature|target planeswalker|target attacking|another target)/,
  /return target (?:nonland permanent|creature|artifact|enchantment|permanent)[^.]* to (?:its|their) owner'?s? hand/,
  /target creature (?:an opponent controls )?gets -\d+\/-\d+/,
  /fights? (?:target|another target|up to one target)/,
  /(?:target|each) (?:opponent|player) sacrifices/,
];
const WIPE = [
  /(?:destroy|exile) (?:all|each) (?:other )?(?:creatures|nonland permanents|artifacts|enchantments|permanents|nontoken|creature|non-?\w+ creatures|attacking)/,
  /all (?:other )?creatures get -\d+\/-\d+/,
  /deals? \d+ damage to each (?:creature|other creature|opponent and each creature)/,
  /return all (?:nonland permanents|creatures|other creatures)/,
  /each player sacrifices (?:all|half)/,
];
const PROTECTION = [
  /(?:gains?|have|has|gets?)[^.]{0,60}(?:hexproof|indestructible|shroud|protection from)/,
  /phases? out/,
  /can't be countered/,
  /counter target spell/,
  /regenerate target/,
];

export function engineRoles(c) {
  if (!c) return [];
  const text = lower(c),
    out = [];
  if (isLand(c)) return ["Land"];
  if (RAMP.some((r) => r.test(text))) out.push("Ramp");
  if (DRAW.some((r) => r.test(text))) out.push("Draw");
  if (REMOVAL.some((r) => r.test(text))) out.push("Removal");
  if (WIPE.some((r) => r.test(text))) out.push("Wipe");
  if (PROTECTION.some((r) => r.test(text))) out.push("Protection");
  return out;
}

export function rampKind(c) {
  const text = lower(c);
  if (
    /search your library for (?:a|an|up to \w+|two) (?:basic )?(?:land|plains|island|swamp|mountain|forest)|put (?:a|up to \w+|two) (?:basic )?land cards?|land card from your hand onto the battlefield/.test(
      text,
    )
  )
    return "land";
  if (/treasure/.test(text) && !/\{t\}(?:,[^:]*)?: add/.test(text))
    return "burst";
  return "rock";
}

export function synergyTest(commander) {
  if (!commander) return null;
  const theme = commanderTheme(commander),
    tribe = theme.tribe
      ? new RegExp("\\b" + theme.tribe + "s?\\b", "i")
      : null,
    focus = theme.roles.filter((r) =>
      [
        "Tokens",
        "Graveyard",
        "Spells",
        "Artifacts",
        "Lifegain",
        "Landfall",
        "Dragons",
      ].includes(r),
    );
  if (!tribe && !focus.length) return null;
  const roleTests = {
    Tokens: /create .*token|populate|tokens? you control/i,
    Graveyard: /graveyard|dies|mill|sacrifice/i,
    Spells: /instant|sorcery|magecraft|prowess/i,
    Artifacts: /artifact/i,
    Lifegain: /gain .*life|lifelink|whenever you gain life/i,
    Landfall: /landfall|land enters|lands? you control/i,
    Dragons: /dragon/i,
  };
  return {
    label: theme.tribe ? theme.tribe + "s" : focus.join(" / "),
    test(c) {
      if (!c || isLand(c) || cardKey(c.name) === cardKey(commander.name))
        return false;
      if (tribe && (tribe.test(typeText(c)) || tribe.test(rulesText(c))))
        return true;
      return focus.some((f) => roleTests[f]?.test(rulesText(c) + " " + typeText(c)));
    },
  };
}

/* ---------- Engine profile & score ---------- */

export const TARGETS = {
  Commander: {
    Lands: 36,
    Ramp: 10,
    Draw: 10,
    Removal: 8,
    Wipe: 3,
    Protection: 4,
    Synergy: 25,
  },
  "60-card casual": {
    Lands: 24,
    Ramp: 4,
    Draw: 6,
    Removal: 8,
    Wipe: 1,
    Protection: 2,
    Synergy: 20,
  },
};
const WEIGHTS = {
  Lands: 15,
  Ramp: 14,
  Draw: 14,
  Removal: 12,
  Wipe: 5,
  Protection: 5,
  Synergy: 17,
  Curve: 18,
};
const HINTS = {
  Lands: "Land count drives every early turn.",
  Ramp: "Mana rocks, dorks and land fetch get you ahead.",
  Draw: "Card flow keeps the engine running after turn five.",
  Removal: "Answers to the threat that beats you.",
  Wipe: "Resets when you fall behind on board.",
  Protection: "Keeps your commander or key piece alive.",
  Synergy: "Cards that actively feed your commander’s plan.",
  Curve: "Lower average cost = more plays per turn.",
};

export function detectArchetype(deck,catalog) {
 if(isCommanderLike(deck))return null;
 let auras=0,cheapCreatures=0,creatures=0,nonland=0,mv=0;
 for(const r of aggregateCards(deck.cards)){const c=catalog[cardKey(r.name)];if(!c||isLand(c))continue;nonland+=r.qty;mv+=(Number(c.cmc)||0)*r.qty;if(/Aura/.test(typeText(c)))auras+=r.qty;if(/Creature/.test(typeText(c))){creatures+=r.qty;if(Number(c.cmc)<=2)cheapCreatures+=r.qty;}}
 const avg=nonland?mv/nonland:Infinity;
 if(auras>=8&&creatures>=8&&avg<=2.5)return {label:"Aura aggro",test:c=>/Aura|Creature/.test(typeText(c))};
 if(cheapCreatures>=20&&avg<=2.5)return {label:"Low-curve creature aggro",test:c=>/Creature/.test(typeText(c))&&Number(c.cmc)<=3};
 return null;
}

export function engineProfile(deck, catalog) {
  const fmt = isCommanderLike(deck) ? "Commander" : "60-card casual",
    size = formatOf(deck).size,
    // 60-card targets, scaled for 40-card Limited and other non-60 sizes.
    archetype = detectArchetype(deck,catalog),
    targets = fmt === "Commander" || size === 60 ? {...TARGETS[fmt]} : Object.fromEntries(Object.entries(TARGETS[fmt]).map(([k, v]) => [k, k === "Curve" ? v : Math.max(1, Math.round((v * size) / 60))])),
    commander = catalog[cardKey(deck.commander)],
    syn = hasCommander(deck) ? synergyTest(commander) : archetype,
    counts = {
      Lands: 0,
      Ramp: 0,
      Draw: 0,
      Removal: 0,
      Wipe: 0,
      Protection: 0,
      Synergy: 0,
    },
    curve = [0, 0, 0, 0, 0, 0, 0, 0],
    pips = { W: 0, U: 0, B: 0, R: 0, G: 0 },
    sources = { W: 0, U: 0, B: 0, R: 0, G: 0 },
    byRole = {
      Ramp: [],
      Draw: [],
      Removal: [],
      Wipe: [],
      Protection: [],
      Synergy: [],
    };
  if(archetype)Object.assign(targets,{Lands:Math.round(size/3),Ramp:0,Draw:2,Wipe:0,Protection:4,Synergy:Math.round(size*.4)});
  let nonland = 0,
    mvTotal = 0,
    unknown = 0,
    total = 0;
  for (const row of aggregateCards(deck.cards)) {
    total += row.qty;
    const c = catalog[cardKey(row.name)];
    if (!c) {
      unknown += row.qty;
      continue;
    }
    if (isLand(c)) {
      counts.Lands += row.qty;
      for (const m of c.produced_mana || [])
        if (m in sources) sources[m] += row.qty;
      if (!c.produced_mana && isBasic(c)) {
        const b = { Plains: "W", Island: "U", Swamp: "B", Mountain: "R", Forest: "G" }[c.name];
        if (b) sources[b] += row.qty;
      }
      continue;
    }
    const isCommander = cardKey(c.name) === cardKey(deck.commander);
    if (!isCommander) {
      nonland += row.qty;
      mvTotal += (Number(c.cmc) || 0) * row.qty;
      curve[Math.min(7, Math.floor(Number(c.cmc) || 0))] += row.qty;
    }
    const cost = c.mana_cost || c.card_faces?.[0]?.mana_cost || "";
    for (const m of cost.match(/\{[^}]+\}/g) || [])
      for (const color of "WUBRG")
        if (m.includes(color)) pips[color] += row.qty;
    if (isCommander) continue;
    for (const r of engineRoles(c)) {
      counts[r] += row.qty;
      byRole[r].push(c.name);
    }
    if (syn?.test(c)) {
      counts.Synergy += row.qty;
      byRole.Synergy.push(c.name);
    }
  }
  const avg = nonland ? mvTotal / nonland : null,
    parts = [];
  for (const k of Object.keys(targets)) {
    if ((k === "Synergy" && !syn) || targets[k]===0) continue;
    const target = targets[k],
      count = counts[k],
      ratio =
        k === "Lands"
          ? Math.max(0, 1 - Math.abs(count - target) / 8)
          : Math.min(1, count / target);
    parts.push({
      key: k,
      label: k === "Synergy" ? "Synergy · " + syn.label : k,
      count,
      target,
      ratio,
      weight: WEIGHTS[k],
      hint: HINTS[k],
    });
  }
  const curveRatio =
    avg === null ? 0 : Math.max(0, Math.min(1, (4.5 - avg) / 1.5));
  parts.push({
    key: "Curve",
    label: "Curve",
    count: avg === null ? "—" : avg.toFixed(2),
    target: "≤ 3.0",
    ratio: curveRatio,
    weight: WEIGHTS.Curve,
    hint: HINTS.Curve,
  });
  const weight = parts.reduce((a, p) => a + p.weight, 0),
    score = Math.round(
      (parts.reduce((a, p) => a + p.ratio * p.weight, 0) / weight) * 100,
    );
  return {
    score,
    parts,
    counts,
    byRole,
    curve,
    avg,
    pips,
    sources,
    unknown,
    total,
    nonland,
    synergyLabel: syn?.label || null,
    archetype: archetype?.label || (fmt === "Commander" ? "Commander role balance" : "General constructed role balance"),
    scoreKind: "Build-health heuristic; not a win rate",
  };
}

export function scoreGrade(score) {
  return score >= 85
    ? "Tuned"
    : score >= 70
      ? "Solid"
      : score >= 55
        ? "Playable"
        : score >= 40
          ? "Rough"
          : "Unfinished";
}

/* ---------- Goldfish simulation ---------- */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function goldfish(deck, catalog, { games = 1000, turns = 6, seed = 7 } = {}) {
  const commanderCard =
      hasCommander(deck) ? catalog[cardKey(deck.commander)] : null,
    library = [];
  for (const row of aggregateCards(deck.cards)) {
    if (commanderCard && cardKey(row.name) === cardKey(commanderCard.name))
      continue;
    const c = catalog[cardKey(row.name)],
      roles = c ? engineRoles(c) : [],
      info = {
        land: !!c && isLand(c),
        cmc: c ? Number(c.cmc) || 0 : 3,
        ramp: roles.includes("Ramp") ? rampKind(c) : null,
        draw: roles.includes("Draw"),
      };
    for (let i = 0; i < row.qty; i++) library.push(info);
  }
  if (library.length < 20) return null;
  const random = rng(seed),
    cmdCmc = commanderCard ? Number(commanderCard.cmc) || 0 : null,
    freeMull = hasCommander(deck) ? 1 : 0;
  let mulls = 0,
    landsBy4 = 0,
    screw3 = 0,
    flood = 0,
    cmdOnCurve = 0,
    cmdLate = 0,
    cmdTurnSum = 0,
    cmdCastGames = 0,
    earlyRamp = 0,
    spentSum = 0,
    availSum = 0,
    playT2 = 0;
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  for (let g = 0; g < games; g++) {
    let deckCards, hand, m = 0;
    for (;;) {
      deckCards = shuffle(library.slice());
      hand = deckCards.splice(0, 7);
      const l = hand.filter((x) => x.land).length;
      if ((l >= 2 && l <= 5) || m >= 2) break;
      m++;
    }
    mulls += m;
    for (let b = 0; b < Math.max(0, m - freeMull); b++) {
      const lands = hand.filter((x) => x.land).length;
      let idx;
      if (lands > 3) idx = hand.findIndex((x) => x.land);
      else {
        idx = -1;
        let hi = -1;
        hand.forEach((x, i) => {
          if (!x.land && x.cmc > hi) {
            hi = x.cmc;
            idx = i;
          }
        });
        if (idx < 0) idx = 0;
      }
      deckCards.push(hand.splice(idx, 1)[0]);
    }
    let landsIn = 0,
      rocks = 0,
      pendingRocks = 0,
      pendingLands = 0,
      cmdTurn = null,
      rampSeen = false,
      spent = 0,
      avail = 0,
      castByT2 = false;
    for (let t = 1; t <= turns; t++) {
      rocks += pendingRocks;
      landsIn += pendingLands;
      pendingRocks = 0;
      pendingLands = 0;
      if (t > 1 && deckCards.length) hand.push(deckCards.shift());
      const li = hand.findIndex((x) => x.land);
      if (li >= 0) {
        hand.splice(li, 1);
        landsIn++;
      }
      let mana = landsIn + rocks,
        burst = 0;
      avail += mana;
      for (;;) {
        const pool = mana + burst;
        let pick = -1,
          pickScore = -Infinity;
        hand.forEach((x, i) => {
          if (x.land || x.cmc > pool) return;
          const s = x.ramp ? 100 - x.cmc : x.draw ? 40 + x.cmc : 10 + x.cmc;
          if (s > pickScore) {
            pickScore = s;
            pick = i;
          }
        });
        const canCmd = cmdCmc !== null && cmdTurn === null && cmdCmc <= pool;
        if (canCmd && (pick < 0 || !hand[pick].ramp || cmdCmc + hand[pick].cmc > pool)) {
          cmdTurn = t;
          mana -= cmdCmc;
          if (mana < 0) {
            burst += mana;
            mana = 0;
          }
          spent += cmdCmc;
          if (t <= 2) castByT2 = true;
          continue;
        }
        if (pick < 0) break;
        const x = hand.splice(pick, 1)[0];
        let cost = x.cmc;
        const fromMana = Math.min(mana, cost);
        mana -= fromMana;
        burst -= cost - fromMana;
        spent += x.cmc;
        if (t <= 2) castByT2 = true;
        if (x.ramp) {
          if (t <= 3) rampSeen = true;
          if (x.ramp === "land") pendingLands++;
          else if (x.ramp === "burst") burst += 1;
          else pendingRocks++;
        }
        if (x.draw && deckCards.length) hand.push(deckCards.shift());
      }
      if (t === 3 && landsIn < 3) screw3++;
      if (t === 4 && landsIn >= 4) landsBy4++;
    }
    if (hand.filter((x) => x.land).length >= 3 && landsIn >= 5) flood++;
    if (cmdCmc !== null && cmdTurn !== null) {
      cmdCastGames++;
      cmdTurnSum += cmdTurn;
      if (cmdTurn <= Math.max(1, cmdCmc)) cmdOnCurve++;
      if (cmdTurn <= Math.max(1, cmdCmc) + 1) cmdLate++;
    }
    if (rampSeen) earlyRamp++;
    if (castByT2) playT2++;
    spentSum += spent;
    availSum += avail;
  }
  const pct = (n) => n / games;
  return {
    games,
    turns,
    mulligans: mulls / games,
    landsBy4: pct(landsBy4),
    screw3: pct(screw3),
    flood: pct(flood),
    earlyRamp: pct(earlyRamp),
    playT2: pct(playT2),
    efficiency: availSum ? spentSum / availSum : 0,
    manaSpent: spentSum / games,
    commander:
      cmdCmc === null
        ? null
        : {
            cmc: cmdCmc,
            onCurve: pct(cmdOnCurve),
            byNextTurn: pct(cmdLate),
            avgTurn: cmdCastGames ? cmdTurnSum / cmdCastGames : null,
            castRate: pct(cmdCastGames),
          },
  };
}

/* ---------- Versions ---------- */

export function diffCards(fromCards, toCards) {
  const a = new Map(aggregateCards(fromCards).map((c) => [cardKey(c.name), c])),
    b = new Map(aggregateCards(toCards).map((c) => [cardKey(c.name), c])),
    added = [],
    removed = [];
  for (const [k, c] of b) {
    const before = a.get(k)?.qty || 0;
    if (c.qty > before) added.push({ name: c.name, qty: c.qty - before });
  }
  for (const [k, c] of a) {
    const after = b.get(k)?.qty || 0;
    if (c.qty > after) removed.push({ name: c.name, qty: c.qty - after });
  }
  const byName = (x, y) => x.name.localeCompare(y.name);
  return { added: added.sort(byName), removed: removed.sort(byName) };
}

export function snapshot(deck, label, extra = {}) {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ||
      "v" + Date.now() + Math.random().toString(16).slice(2),
    label: String(label || "Snapshot").slice(0, 80),
    date: new Date().toISOString(),
    commander: deck.commander || "",
    cards: deck.cards.map((c) => ({ name: c.name, qty: c.qty })),
    ...extra,
  };
}

export function withSnapshot(deck, label, extra) {
  const versions = [...(deck.versions || [])],
    last = versions[versions.length - 1];
  if (last && JSON.stringify(last.cards) === JSON.stringify(deck.cards))
    return { ...deck, versions };
  versions.push(snapshot(deck, label, extra));
  return { ...deck, versions: versions.slice(-40) };
}

/* ---------- Money ---------- */

export function deckValue(cards, catalog, choices = {}) {
  let total = 0,
    unpriced = 0;
  for (const c of aggregateCards(cards)) {
    const p =
      choices[cardKey(c.name)]?.price ?? cardPrice(catalog[cardKey(c.name)]);
    if (p === null || p === undefined) unpriced += c.qty;
    else total += p * c.qty;
  }
  return { total, unpriced };
}

export function lotPrice(e, catalog, printings = {}) {
  const c =
    (e.printingVerified && printings[e.printingId]) ||
    catalog[cardKey(e.name)];
  return cardPrice(c, e.finish || "nonfoil") ?? cardPrice(c);
}

export function collectionValue(entries, catalog, printings = {}, decks = []) {
  let total = 0,
    unpriced = 0;
  const lots = [],
    colors = { W: 0, U: 0, B: 0, R: 0, G: 0, Multi: 0, Colorless: 0 },
    owned = new Map(),
    used = new Map();
  for (const e of entries) {
    const p = lotPrice(e, catalog, printings),
      c = catalog[cardKey(e.name)];
    owned.set(cardKey(e.name), (owned.get(cardKey(e.name)) || 0) + e.qty);
    if (p === null || p === undefined) {
      unpriced += e.qty;
      continue;
    }
    const v = p * e.qty;
    total += v;
    lots.push({ entry: e, unit: p, value: v });
    const id = c?.color_identity || [];
    colors[id.length > 1 ? "Multi" : id.length ? id[0] : "Colorless"] += v;
  }
  for (const d of decks)
    for (const c of aggregateCards(d.cards))
      used.set(cardKey(c.name), (used.get(cardKey(c.name)) || 0) + c.qty);
  const spare = [];
  let spareValue = 0;
  for (const [k, qty] of owned) {
    const free = qty - (used.get(k) || 0);
    if (free <= 0) continue;
    const c = catalog[cardKey(k)],
      unit = cardPrice(c);
    const name =
      entries.find((e) => cardKey(e.name) === k)?.name || c?.name || k;
    spare.push({ name, qty: free, unit, value: unit === null ? null : unit * free });
    if (unit !== null) spareValue += unit * free;
  }
  spare.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  lots.sort((a, b) => b.value - a.value);
  return {
    total,
    unpriced,
    copies: sumQty(entries),
    top: lots.slice(0, 12),
    colors,
    spare,
    spareValue,
  };
}

export function recordValuePoint(history = [], total, copies) {
  const day = new Date().toISOString().slice(0, 10),
    list = (history || []).filter((h) => h.date !== day);
  list.push({ date: day, total: Math.round(total * 100) / 100, copies });
  return list.slice(-365);
}

/* ---------- Upgrade impact ---------- */

export function applySwapsToCards(cards, swaps) {
  const next = cards.map((c) => ({ ...c }));
  for (const s of swaps) {
    const cut = next.find((c) => cardKey(c.name) === cardKey(s.cut));
    if (cut) cut.qty -= 1;
    const add = next.find((c) => cardKey(c.name) === cardKey(s.add));
    if (add) add.qty += 1;
    else next.push({ name: s.add, qty: 1 });
  }
  return next.filter((c) => c.qty > 0);
}

export function swapImpact(deck, swap, catalog, baseScore) {
  const before =
      baseScore ?? engineProfile(deck, catalog).score,
    after = engineProfile(
      { ...deck, cards: applySwapsToCards(deck.cards, [swap]) },
      catalog,
    ).score,
    cutValue = cardPrice(catalog[cardKey(swap.cut)]) ?? 0,
    cost = swap.cost || 0;
  return {
    delta: after - before,
    cutValue,
    net: cost - cutValue,
    perDollar: cost > 0 ? (after - before) / cost : null,
  };
}

// Stable fingerprint of a card list (order-independent) used to tag game logs.
export function cardSig(cards) {
  const text = aggregateCards(cards)
    .map((c) => cardKey(c.name) + ":" + c.qty)
    .sort()
    .join("|");
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
