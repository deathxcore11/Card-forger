import {myPrintingPrice,myPrice,tcgFallback} from './mtg-tcgprice.js';
import {magicOwnedCard} from './magic-owned-detail.js';
import {printedCardColors} from './magic-card-color.js';
import {recordValueObservation} from './value-history.js';
import {conditionValue} from './condition-value.js';
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
  inCommandZone,
} from "./core.js";
import { commanderTheme, tribalSupport, themeSupport } from "./planner.js";
import { mtgTagged, mtgTagsReady } from "./mtg-tags.js";
import { mtgResourceProfile } from "./mtg-effects.js";
import { commanderCriteria } from "./commander-criteria.js";

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

// Roles depend only on the card, and the builder asks for the same cards thousands of times.
const roleMemo = new WeakMap();
export function engineRoles(c) {
  if (!c) return [];
  if (typeof c === "object" && roleMemo.has(c)) return roleMemo.get(c);
  const roles = engineRolesRaw(c);
  if (typeof c === "object" && mtgTagsReady()) roleMemo.set(c, roles);
  return roles;
}
function engineRolesRaw(c) {
  const text = lower(c),
    out = [];
  if (isLand(c)) return ["Land"];
  // Scryfall's community tags add what the text patterns miss (mtg-tags.js).
  const resource = mtgResourceProfile(c);
  // Explicit filtering is not net acceleration, even if a community tag is broad.
  if (resource.acceleration || (!resource.effects.some(e=>["mana-filter","land-exchange"].includes(e.kind) || e.controller && e.controller !== "self") && (mtgTagged(c, "ramp") || resource.status === "unsupported" && RAMP.some((r) => r.test(text))))) out.push("Ramp");
  if (DRAW.some((r) => r.test(text)) || mtgTagged(c, "draw")) out.push("Draw");
  if (REMOVAL.some((r) => r.test(text)) || mtgTagged(c, "removal") || mtgTagged(c, "counter")) out.push("Removal");
  if (WIPE.some((r) => r.test(text)) || mtgTagged(c, "wipe")) out.push("Wipe");
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
  if(/tap a nonland permanent for mana/i.test(rulesText(commander))) return {
    label:'Nonland mana engine',
    test:c=>!!c&&!isLand(c)&&cardKey(c.name)!==cardKey(commander.name)&&(/(?:add \{|add (?:one|two|three|an amount)|untap (?:target|this)|activated abilities)/i.test(rulesText(c)) || /non-human creature/i.test(rulesText(c)))
  };
  const theme = commanderTheme(commander),
    focus = theme.roles.filter(r => ["Tokens","Counters","Graveyard","Spells","Artifacts","Lifegain","Landfall","Dragons"].includes(r)),
    eligible = c => !!c && !isLand(c) && cardKey(c.name) !== cardKey(commander.name),
    primary = c => eligible(c) && (theme.tribe ? tribalSupport(c,theme.tribe) : themeSupport(c,theme).length > 0),
    support = c => eligible(c) ? themeSupport(c,theme) : [];
  if (!theme.tribe && !focus.length) return null;
  return {
    // These are supported tribal participants/payoffs, not a printed-creature count.
    label: theme.tribe ? theme.tribe + " support" : focus.join(" / "),
    tribe: theme.tribe,
    theme,
    test: primary,
    supportLabels: focus,
    supportTest: c => support(c).length > 0,
    classify(c) {
      return {primary:primary(c), support:support(c)};
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

const MANA_COLORS = ["W", "U", "B", "R", "G"];
const emptyPips = () => Object.fromEntries(MANA_COLORS.map(k => [k, 0]));
export const manaColorName = (k) => ({ W: "white", U: "blue", B: "black", R: "red", G: "green" })[k] || k;

// A basic-land guideline needs a payment plan, not Commander color identity.
// Count a hybrid symbol once. Its allocation is one possible plan, never a claim
// that both printed colors are required (CR 107.4e). This does not change scores.
export function manaPaymentProfile(entries, sources = {}) {
  const required = emptyPips(), pips = emptyPips(), cards = [], flexible = [], notes = [];
  let complete = true;
  for (const { card: c, qty } of entries) {
    const faces = c.card_faces || [], front = faces[0];
    // Split halves and two spell faces are choices, not simultaneous costs.
    // Do not guess a preferred half or quietly recommend a partial basic split.
    const landFrontSpellBack = c.layout === "modal_dfc" && /\bLand\b/.test(front?.type_line || "") && faces.slice(1).some(f => !/\bLand\b/.test(f.type_line || "")),
      alternateSpells = c.layout === "split" || landFrontSpellBack || (c.layout === "modal_dfc" && faces.length > 1 && faces.every(f => !/\bLand\b/.test(f.type_line || ""))),
      cost = front ? front.mana_cost : c.mana_cost;
    if (alternateSpells || typeof cost === "string" && cost.includes("//")) {
      complete = false;
      notes.push(`${c.name}: alternative spell costs ${faces.map(f => /\bLand\b/.test(f.type_line || "") ? "a land face" : f.mana_cost ?? "unknown cost").join(" or ") || cost}; choose a casting plan before using a basic-land split.`);
      continue;
    }
    if (typeof cost !== "string" || cost.replace(/\{[^}]+\}/g, "").trim()) {
      complete = false;
      notes.push(`${c.name}: casting-cost data is missing or unsupported; load card data before using a basic-land split.`);
      continue;
    }
    if (front && ["transform", "modal_dfc", "adventure"].includes(c.layout))
      notes.push(`${c.name}: this guideline uses the front-face cost ${cost || "(no mana cost)"}, not the other face or its activated abilities.`);
    const contribution = { name: c.name, qty, cost, required: emptyPips(), allocated: emptyPips(), flexible: [] };
    cards.push(contribution);
    for (const match of String(cost).matchAll(/\{([^}]+)\}/g)) {
      const symbol = match[0], value = match[1];
      if (MANA_COLORS.includes(value)) {
        required[value] += qty;
        contribution.required[value] += qty;
      } else if (/^[WUBRG]\/[WUBRG]$/.test(value)) {
        const colors = value.split("/");
        flexible.push({ symbol, colors, qty, contribution });
        contribution.flexible.push(symbol);
      } else if (/^(?:[WUBRG](?:\/[WUBRG])?\/P|2\/[WUBRG])$/.test(value)) {
        const colors = value.split("/").filter(k => MANA_COLORS.includes(k)).map(manaColorName);
        const payment = value.endsWith("/P")
          ? `${colors.join(" or ")} mana or 2 life`
          : `${colors[0]} mana or two mana of any type`;
        notes.push(`${c.name} ${symbol}: payable with ${payment}; its optional color is not forced into the basic-land split.`);
      } else if (value === "C" || value === "S") {
        notes.push(`${c.name} ${symbol}: ${value === "C" ? "colorless" : "snow"} mana needs separate sources; this colored-basic guideline does not check them.`);
      } else if (!/^(?:\d+|X|Y|Z)$/.test(value)) {
        complete = false;
        notes.push(`${c.name} ${symbol}: this mana symbol is not modeled by the basic-land guideline.`);
      }
    }
  }
  Object.assign(pips, required);
  for (const item of flexible) {
    const { colors, qty, contribution } = item;
    // Other required spell colors give a stable plan. For hybrid-only colors,
    // preserve existing sources; with no evidence, show an explicitly even plan.
    const hardTotal = colors.reduce((n, k) => n + required[k], 0),
      sourceTotal = colors.reduce((n, k) => n + (sources[k] || 0), 0),
      weights = hardTotal ? required : sourceTotal ? sources : Object.fromEntries(colors.map(k => [k, 1])),
      total = colors.reduce((n, k) => n + (weights[k] || 0), 0);
    for (const k of colors) {
      const amount = qty * (weights[k] || 0) / total;
      pips[k] += amount;
      contribution.allocated[k] += amount;
    }
  }
  for (const c of cards.filter(c => c.flexible.length)) {
    const choices = [...new Set(c.flexible)].map(s => `${s} accepts ${s.slice(1, -1).split("/").map(manaColorName).join(" or ")}`).join("; "),
      used = MANA_COLORS.filter(k => c.allocated[k] > 0).map(manaColorName).join(" / ");
    notes.push(`${c.name} ${c.cost}: ${choices}. Each symbol is counted once; this estimate allocates it to ${used}. Other payment choices remain legal.`);
  }
  return { pips, required, cards, notes: [...new Set(notes)], complete };
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
    manaEntries = [],
    manaSourceNotes = [],
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
      manaEntries.push({ card: { name: row.name }, qty: row.qty });
      continue;
    }
    if (isLand(c)) {
      counts.Lands += row.qty;
      const produced = new Set((Array.isArray(c.produced_mana) ? c.produced_mana : []).filter(k => k in sources));
      // Basic land subtypes intrinsically supply their color, including snow
      // basics and older/partial records with an empty produced_mana array.
      if (isBasic(c))
        for (const [land, color] of Object.entries({ Plains: "W", Island: "U", Swamp: "B", Mountain: "R", Forest: "G" }))
          if (new RegExp("\\b" + land + "\\b").test(typeText(c) + " " + c.name)) produced.add(color);
      if (!isBasic(c) && (!Array.isArray(c.produced_mana) || !c.produced_mana.length))
        manaSourceNotes.push(`${c.name}: no mana production is listed in the cached source data; it is not counted in the colored-source comparison.`);
      for (const color of produced) sources[color] += row.qty;
      if (c.layout === "modal_dfc" && c.card_faces?.slice(1).some(f => !/\bLand\b/.test(f.type_line || "")))
        manaEntries.push({ card: c, qty: row.qty });
      continue;
    }
    const isCommander = inCommandZone(deck,c.name);
    if (!isCommander) {
      nonland += row.qty;
      mvTotal += (Number(c.cmc) || 0) * row.qty;
      curve[Math.min(7, Math.floor(Number(c.cmc) || 0))] += row.qty;
    }
    manaEntries.push({ card: c, qty: row.qty });
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
    criteria = fmt === "Commander" ? commanderCriteria(deck,catalog,{roles:engineRoles,synergy:syn}) : null,
    parts = [];
  if (criteria) {
    // Demand follows curve and the commander, not a universal ten-ramp quota.
    // Mana engines/outlets are kept explicit; no high-ramp hard cap is applied.
    targets.Ramp = criteria.resources.demand;
    targets.Lands = Math.max(30,Math.min(40,Math.round(31 + (avg ?? 3)*1.5 - Math.min(3,criteria.resources.efficientRamp/8))));
  }
  for (const k of Object.keys(targets)) {
    if ((k === "Synergy" && (!syn || criteria)) || targets[k]===0) continue;
    const target = targets[k],
      count = criteria && k === "Ramp" ? criteria.resources.effectiveRamp : criteria && k === "Draw" ? criteria.resources.draw.effective : counts[k],
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
      hint: criteria && ["Ramp","Draw"].includes(k) ? HINTS[k] + " Effective units account for recognized costs and conditions; they are heuristic contributions, not physical copies." : HINTS[k],
      ...(criteria && ["Ramp","Draw"].includes(k) ? {rawCount:counts[k],effectiveCount:count,countBasis:"Effective resource units; see printed costs and prerequisites"} : {}),
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
  const mana = manaPaymentProfile(manaEntries, sources),
    pips = mana.pips,
    weight = parts.reduce((a, p) => a + p.weight, 0),
    score = Math.round(
      (parts.reduce((a, p) => a + p.ratio * p.weight, 0) / weight) * 100,
    );
  mana.notes.unshift(...manaSourceNotes);
  if (criteria) criteria.structure.score = score;
  return {
    score,
    criteria,
    parts,
    counts,
    byRole,
    curve,
    avg,
    pips,
    mana,
    sources,
    unknown,
    total,
    nonland,
    synergyLabel: syn?.label || null,
    archetype: archetype?.label || (fmt === "Commander" ? "Commander role balance" : "General constructed role balance"),
    scoreKind: criteria ? "Structural build heuristic; plan support is separate; not a win rate" : "Build-health heuristic; not a win rate",
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
    if (commanderCard && inCommandZone(deck,row.name))
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
    side: (deck.side || []).map((c) => ({ name: c.name, qty: c.qty })),
    ...extra,
  };
}

export function withSnapshot(deck, label, extra) {
  const versions = [...(deck.versions || [])],
    last = versions[versions.length - 1];
  // Sideboard changes count as a new version too (older versions without one had an empty board).
  if (last && JSON.stringify(last.cards) === JSON.stringify(deck.cards) && JSON.stringify(last.side || []) === JSON.stringify((deck.side || []).map((c) => ({ name: c.name, qty: c.qty }))))
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

export function lotValuation(e, catalog, printings = {}) {
  const c = magicOwnedCard(e,printings[e.printingId]),
    bound = e.printingVerified===true && !!e.printingId && ['nonfoil','foil','etched'].includes(e.finish||'nonfoil'),
    quotes = bound?[...(c?.conditionQuotes||[]),...(e.conditionQuotes||[])]:[],
    reference=c?cardPrice(c,e.finish||'nonfoil'):bound&&!printings[e.printingId]?myPrintingPrice(e.printingId,e.finish||'nonfoil'):null;
  // Saved physical lots never inherit a same-name sibling or a different finish.
  // A compatible private value survives; provider quotes need saved exact identity.
  const value=conditionValue(reference,e,quotes);
  if(value.kind==='reference'&&value.price!==null){
    const raw=c?.prices?.[{nonfoil:'usd',foil:'usd_foil',etched:'usd_etched'}[e.finish||'nonfoil']];
    const publicPrice=raw!==null&&raw!==undefined&&String(raw).trim()!==''&&Number.isFinite(Number(raw));
    if(c?!publicPrice&&!tcgFallback(c,e.finish||'nonfoil')&&myPrice(c,e.finish||'nonfoil')!==null:bound&&myPrintingPrice(e.printingId,e.finish||'nonfoil')!==null)return {...value,kind:'manual-reference'};
  }
  return value;
}

export const lotPrice=(e,catalog,printings={})=>lotValuation(e,catalog,printings).price;

export function collectionValue(entries, catalog, printings = {}, decks = []) {
  let total = 0,
    unpriced = 0;
  const lots = [],
    colors = { W: 0, U: 0, B: 0, R: 0, G: 0, Multi: 0, Colorless: 0, Unknown: 0 },
    owned = new Map(),
    used = new Map();
  for (const e of entries) {
    const p = lotPrice(e, catalog, printings),
      c = magicOwnedCard(e,printings[e.printingId]);
    owned.set(cardKey(e.name), (owned.get(cardKey(e.name)) || 0) + e.qty);
    if (p === null || p === undefined) {
      unpriced += e.qty;
      continue;
    }
    const v = p * e.qty;
    total += v;
    lots.push({ entry: e, unit: p, value: v });
    const id = printedCardColors(c);
    colors[id === null ? "Unknown" : id.length > 1 ? "Multi" : id.length ? id[0] : "Colorless"] += v;
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
      related = entries.filter(e=>cardKey(e.name)===k),
      values = related.map(e=>({qty:e.qty,p:lotPrice(e,catalog,printings)})),
      unit = values.some(x=>x.p==null)?null:values.reduce((n,x)=>n+x.p*x.qty,0)/Math.max(1,qty);
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

export function recordValuePoint(history = [], total, copies, coverage = null) {
  return recordValueObservation(history, total, copies, coverage);
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
