// Matchups: a deck against the decks winning right now, simulated a couple of thousand times
// with each game's own rules, then corrected by the player's own logged results.
//   • Magic: two clocks racing. Each side's played-out kill turn, slowed by the removal and
//     counters the other side draws by then; card flow decides games that go long.
//   • Pokémon: a Prize race. First attack from the goldfish, attacks per Knock Out from damage
//     against the other attacker's HP (doubled on Weakness), Knock Outs from its Prize value,
//     gust to pick off the last Prizes, and the other side's disruption (Iono) costing turns.
//   • Yu-Gi-Oh!: the first turn decides most games. Going first: open a combo, get through the
//     other side's hand traps, then survive their board breakers. Going second: the mirror.
// The constants are modelling assumptions and the UI says so. Pure functions, seeded, so the
// same two lists always give the same numbers.

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const lc = (s) => String(s || "").toLowerCase();
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const q = (rows) => rows.reduce((a, r) => a + (r.qty || 0), 0);
// A turn from a goldfish distribution: index i is turn i+1, the last bucket is "later".
const sampleTurn = (d, maxT, r) => {
  const tot = d.reduce((a, x) => a + x, 0) || 1;
  let x = r() * tot, acc = 0;
  for (let i = 0; i < d.length; i++) {
    acc += d[i];
    if (x <= acc) return i >= maxT ? maxT + 1 + Math.floor(r() * 3) : i + 1;
  }
  return maxT + 2;
};
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
// Chance a hand of n cards from a deck of N holds at least one of k copies.
const atLeast = (N, k, n) => { if (k <= 0) return 0; let p = 1; for (let i = 0; i < n; i++) p *= (N - k - i) / (N - i); return clamp(1 - p); };

/* ---------- profiles: what a deck brings to a matchup ---------- */

const text = (c) => lc(c?.oracle_text || (c?.card_faces || []).map((f) => f.oracle_text || "").join("\n") || c?.text || c?.effect || "");
const typeOf = (c) => String(c?.type_line || c?.typeLine || "");

function mtgFeatures(rows) {
  const k = (re) => q(rows.filter((r) => r.c && re.test(text(r.c))));
  const nonland = rows.filter((r) => r.c && !/\bLand\b/.test(typeOf(r.c).split(" // ")[0]));
  const colors = {};
  for (const r of nonland) for (const col of new Set((r.c.mana_cost || "").replace(/[^WUBRG]/g, ""))) colors[col] = (colors[col] || 0) + r.qty;
  return {
    creatures: q(nonland.filter((r) => /Creature/.test(typeOf(r.c)))),
    noncreature: q(nonland.filter((r) => !/Creature/.test(typeOf(r.c)))),
    artifacts: q(rows.filter((r) => r.c && /Artifact/.test(typeOf(r.c)))),
    enchantments: q(rows.filter((r) => r.c && /Enchantment/.test(typeOf(r.c)))),
    gy: k(/from your graveyard|escape|flashback|delve|unearth|mill|disturb|reanimat/),
    fliers: q(nonland.filter((r) => /Creature/.test(typeOf(r.c)) && /\bflying\b/.test(text(r.c)))),
    colors: Object.entries(colors).filter(([, n]) => n >= 6).map(([col]) => col),
  };
}
function ygoFeatures(rows, extra) {
  const k = (re) => q(rows.filter((r) => r.c && re.test(text(r.c))));
  return {
    gy: k(/\bgy\b|graveyard/),
    extraUse: q(extra) + k(/from (?:the|your) extra deck/),
    st: q(rows.filter((r) => r.c && /Spell|Trap/.test(r.c.category || ""))),
    starters: k(/add (?:1|one|up to \w+)[^.]*from your deck to your hand/),
    monsters: q(rows.filter((r) => r.c && r.c.category === "Monster")),
  };
}

// p: the deck's Deck Power result; rows: [{ qty, c }] main deck (and extra for Yu-Gi-Oh!).
// Quality used by the race: the Engine score, but never above what the field says about the list
// (a pile no placing list resembles is judged by that, not by a tidy curve of vanilla creatures).
const quality = (p) => {
  const c = p?.ctx || {}, heur = p.heuristic ?? p.score ?? 70,
    field = c.from === "rogue" ? c.fieldEstimate : c.from === "meta" || c.from === "mixed" ? c.score : null;
  return field != null ? Math.min(heur, field) : heur;
};
export function profileOf(game, p, rows = [], extra = []) {
  if (!p) return null;
  if (game === "mtg") {
    const td = p.goldfish?.turnDist, st = p.stats || {};
    if (!td) return null;
    return { game, score: quality(p), clock: td.d, maxT: td.maxT, inter: st.interaction || 0, threats: st.threats || 0, flow: st.flow || 0, plan: String(p.plan || "Midrange").split(" ")[0], size: Math.max(40, q(rows) || 60), features: mtgFeatures(rows) };
  }
  if (game === "ptcg") {
    const a = p.attacker, td = p.goldfish?.turnDist;
    if (!a || !td) return null;
    return { game, score: quality(p), clock: td.d, maxT: td.maxT, name: a.name, reach: Math.max(10, a.reach || 10), spread: a.spread || 0, hp: a.hp || 200, types: a.types || [], weak: a.weak || [], prize: a.prize || (a.ruleBox ? 2 : 1), lives: a.lives || 1, gust: a.gust || 0, disrupt: a.disrupt || 0, swarm: !!a.swarm };
  }
  const st = p.stats || {};
  return {
    game,
    score: quality(p),
    open: st.startOdds ?? 0.5,
    second: st.second ?? 0.5,
    through: p.goldfish?.metrics?.[0]?.value ?? 0.4,
    breakRate: atLeast(st.N || 40, st.breakers || 0, 6),
    inter: (st.handtraps || 0) + (st.negates || 0),
    features: ygoFeatures(rows, extra),
  };
}

/* ---------- simulations ---------- */

function mtgGame(me, op, first, r) {
  const base = sampleTurn(me.clock, me.maxT, r), opBase = sampleTurn(op.clock, op.maxT, r);
  // Answers each side has drawn by the time the other would win; a threat-dense deck shrugs off
  // single answers, a deck with a few threats loses more to each one.
  const drawn = (inter, size, turns) => { const e = (inter / size) * (7 + turns); return Math.floor(e) + (r() < e - Math.floor(e) ? 1 : 0); };
  const per = (threats) => 1.1 * (1 - Math.min(0.5, threats / 48));
  const slowMe = drawn(op.inter, op.size, base) * per(me.threats),
    slowOp = drawn(me.inter, me.size, opBase) * per(op.threats);
  // Card quality and blocking: the race alone lets a pile of vanilla creatures "goldfish" past
  // combo and control. A deck built far below a solid one (Engine under 75) is slowed for it.
  const weak = (s) => Math.max(0, 75 - (s ?? 70)) / 12;
  let tm = base + slowMe + weak(me.score), to = opBase + slowOp + weak(op.score);
  // Long games go to the deck that draws more cards.
  if (tm > 9 && to > 9) { const edge = (me.flow - op.flow) / 12; return r() < clamp(0.5 + edge, 0.15, 0.85); }
  return { win: first ? tm <= to : tm < to, tm, to, slowMe, slowOp, base, opBase };
}
function ptcgGame(me, op, first, r) {
  // Bench damage from earlier attacks softens the next target: about 60% of each attack's spread
  // lands on the Pokémon it has to Knock Out next.
  const hitsOn = (a, b) => { const dmg = a.reach * (b.weak.some((t) => a.types.includes(t)) ? 2 : 1) + (a.spread || 0) * 0.6; return Math.max(1, Math.ceil(b.hp / Math.max(10, dmg))); };
  const race = (a, b, goesFirst) => {
    let start = sampleTurn(a.clock, a.maxT, r);
    if (!goesFirst && start > 1 && r() < 0.35) start -= 1; // going second can attack on turn 1
    const hits = hitsOn(a, b), kos = Math.ceil(6 / b.prize);
    let t = start + kos * hits - 1 - (a.gust >= 3 && hits > 1 ? 1 : 0);
    // Spread damage also Knocks Out benched support Pokémon (about 150 HP) over a game: each such
    // Knock Out is one or two more Prizes, so the race ends sooner.
    if (a.spread > 0) {
      let prizes = 0, onTarget = 0, bench = 0, turn = start;
      const dmg = a.reach * (b.weak.some((x) => a.types.includes(x)) ? 2 : 1);
      while (prizes < 6 && turn < start + 20) {
        onTarget += dmg; bench += a.spread;
        if (onTarget >= b.hp) { prizes += b.prize; onTarget = a.spread * 0.4; }
        if (bench >= 150 && prizes < 6) { prizes += r() < 0.4 ? 2 : 1; bench -= 150; }
        if (prizes < 6) turn += 1;
      }
      t = Math.min(t, turn - (a.gust >= 3 ? 1 : 0));
    }
    if (r() < Math.min(0.6, b.disrupt * 0.08)) t += 1; // Iono / Unfair Stamp costs a turn
    return { t, hits, kos, start };
  };
  const m = race(me, op, first), o = race(op, me, !first);
  // Running out of attackers: they Knock Out one of mine every `o.hits` turns once they start.
  const myLosses = Math.floor(Math.max(0, m.t - o.start + 1) / o.hits), opLosses = Math.floor(Math.max(0, o.t - m.start + 1) / m.hits);
  const tm = m.t + (myLosses >= me.lives && !me.swarm ? 2 : 0), to = o.t + (opLosses >= op.lives && !op.swarm ? 2 : 0);
  return { win: first ? tm <= to : tm < to, tm, to, hits: m.hits, kos: m.kos, opHits: o.hits, opKos: o.kos, start: m.start, opStart: o.start };
}
function ygoGame(me, op, first, r) {
  const A = first ? me : op, B = first ? op : me;
  let aWins;
  if (r() < A.open) {
    const interrupted = r() < B.second * 0.85,
      stands = !interrupted || r() < A.through;
    if (stands) {
      const broken = r() < B.breakRate * 0.65;
      aWins = broken ? r() > B.open * 0.75 : r() < 0.88;
    } else aWins = r() < 0.5 - 0.25 * B.open + 0.25 * A.through;
  } else aWins = r() > 0.3 + 0.62 * B.open; // A bricks: B wins if B can actually do something
  return { win: first ? aWins : !aWins };
}

const GAME = { mtg: mtgGame, ptcg: ptcgGame, ygo: ygoGame };

export function simulateMatchup(game, me, op, { runs = 2000, seed = 7 } = {}) {
  if (!me || !op) return null;
  const r = rng(seed), play = [], draw = [], log = [];
  for (let i = 0; i < runs; i++) {
    const first = i % 2 === 0, g = GAME[game](me, op, first, r), w = typeof g === "boolean" ? g : g.win;
    (first ? play : draw).push(w ? 1 : 0);
    if (typeof g === "object") log.push(g);
  }
  // The race leaves out blocking, card quality and play skill, so its extremes are pulled toward
  // even, and the better-built deck (Engine score) gets a small edge.
  const tilt = 0.16 * Math.tanh(((me.score ?? 70) - (op.score ?? 70)) / 20),
    // Less pulling toward even when one side is far worse built (a pile against a tournament deck).
    gap = Math.min(1, Math.abs((me.score ?? 70) - (op.score ?? 70)) / 40),
    cal = (x) => clamp(0.5 + (x - 0.5) * (0.72 + 0.25 * gap) + tilt, 0.03, 0.97),
    onPlay = cal(avg(play)), onDraw = cal(avg(draw));
  return { win: (onPlay + onDraw) / 2, onPlay, onDraw, runs, reasons: reasonsFor(game, me, op, log) };
}

const pc = (x) => Math.round(x * 100) + "%";
function reasonsFor(game, me, op, log) {
  const L = log.filter((g) => g.tm != null || g.hits != null);
  if (game === "mtg" && L.length) {
    const a = median(L.map((g) => g.base)), b = median(L.map((g) => g.opBase)), sm = avg(L.map((g) => g.slowMe)), so = avg(L.map((g) => g.slowOp));
    return [
      a === b ? `Both decks close around turn ${a} on their own.` : a < b ? `You're faster: you close around turn ${a}, they need until turn ${b}.` : `They're faster: they close around turn ${b}, you need until turn ${a}.`,
      sm >= 0.4 ? `Their ${op.inter} answers cost you about ${sm.toFixed(1)} turn${sm >= 1.5 ? "s" : ""} per game.` : `Their interaction (${op.inter} cards) barely slows you.`,
      so >= 0.4 ? `Your ${me.inter} answers cost them about ${so.toFixed(1)} turn${so >= 1.5 ? "s" : ""}.` : me.inter < 6 ? `You have little interaction (${me.inter}) to slow them down.` : `Your answers rarely slow their clock.`,
    ];
  }
  if (game === "ptcg" && L.length) {
    const g = L[0], weakHit = op.weak.some((t) => me.types.includes(t)), weakTaken = me.weak.some((t) => op.types.includes(t));
    return [
      `Your ${me.name} needs ${g.hits} attack${g.hits === 1 ? "" : "s"} per Knock Out on their ${op.name} (${op.hp} HP)${weakHit ? ", hitting its Weakness" : ""}; ${g.kos} Knock Outs take your 6 Prizes${op.prize === 2 ? " (they're 2-Prize Pokémon)" : ""}.`,
      `Their ${op.name} needs ${g.opHits} attack${g.opHits === 1 ? "" : "s"} per Knock Out on yours${weakTaken ? ", hitting your Weakness" : ""}; they need ${g.opKos} Knock Outs.`,
      `You attack first around turn ${median(L.map((x) => x.start))}, they do around turn ${median(L.map((x) => x.opStart))}.`,
    ];
  }
  if (game === "ygo")
    return [
      `Going first you open a combo ${pc(me.open)} of the time and play through a hand trap ${pc(me.through)}; they can interrupt ${pc(op.second)}.`,
      `Going second you can interact ${pc(me.second)} of the time and hold a board breaker ${pc(me.breakRate)}.`,
      `They open ${pc(op.open)} going first and break boards ${pc(op.breakRate)} going second.`,
    ];
  return [];
}

/* ---------- your results ---------- */

export const sameOpp = (a, b) => lc(a).replace(/[^a-z0-9]+/g, " ").trim() === lc(b).replace(/[^a-z0-9]+/g, " ").trim();
// A short fingerprint of an exact list (main deck, extra/side, quantities). Each logged game keeps
// the fingerprint of the list it was played with, so a changed deck isn't credited (or blamed)
// for games an earlier version played. Games logged before fingerprints count as an earlier list.
export function listSig(zones) {
  const norm = Object.entries(zones || {}).map(([z, rows]) => z + ":" + (rows || []).map((r) => String(r.cardId ?? r.name).toLowerCase() + "×" + r.qty).sort().join(",")).sort().join("|");
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) h = Math.imul(h ^ norm.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
export const forList = (results = [], sig) => ({ current: results.filter((g) => g.sig === sig), earlier: results.filter((g) => g.sig !== sig) });
export function recordOf(results = [], opp = null) {
  const list = opp == null ? results : results.filter((x) => sameOpp(x.opp, opp));
  const w = list.filter((x) => x.res === "W").length, l = list.filter((x) => x.res === "L").length, d = list.filter((x) => x.res === "D").length;
  return { w, l, d, n: w + l + d, rate: w + l + d ? (w + d * 0.5) / (w + l + d) : null };
}
// The simulation counts as six games; every game you log moves the estimate toward your record.
export const SIM_WEIGHT = 6;
export const blend = (sim, rec) => (sim == null ? rec.rate : rec.n ? (sim * SIM_WEIGHT + rec.w + rec.d * 0.5) / (SIM_WEIGHT + rec.n) : sim);

/* ---------- game plan: sideboard (Magic, Yu-Gi-Oh!) or Prize plan (Pokémon) ---------- */

const MTG_SIDE = [
  { re: /exile[^.]*(?:target player's|an opponent's|each opponent's|opponents'|all) graveyards?|exile all (?:cards|creature cards) from|would be put into an opponent's graveyard|graveyards? (?:can't|don't)|cards in graveyards can't/, ok: (f) => f.gy >= 8, why: "they play from the graveyard" },
  { re: /destroy (?:target|all|each|up to \w+ target) (?:noncreature )?artifacts?|artifacts? your opponents control/, ok: (f) => f.artifacts >= 10, why: "they rely on artifacts" },
  { re: /destroy (?:target|all|each) (?:artifact or )?enchantments?|enchantments? your opponents control/, ok: (f) => f.enchantments >= 8, why: "they rely on enchantments" },
  { re: /destroy all creatures|deals? \d+ damage to each (?:creature|other creature)|all (?:other )?creatures get -|each creature gets -/, ok: (f, p) => f.creatures >= 20 || p.plan === "Aggro", why: "they go wide with creatures" },
  { re: /counter target (?:noncreature |instant or sorcery )?spell/, ok: (f, p) => f.noncreature >= 18 || p.plan === "Control", why: "their key cards are spells" },
  { re: /you gain \d+ life|lifelink/, ok: (f, p) => p.plan === "Aggro", why: "they race you on damage" },
  { re: /target (?:player|opponent) (?:reveals|discards)|look at target opponent's hand/, ok: (f, p) => p.plan === "Control" || f.noncreature >= 20, why: "it strips their answers or combo pieces" },
  { re: /creature with flying|flying creature|reach/, ok: (f) => f.fliers >= 8, why: "they win in the air" },
  { re: /(?:destroy|exile) target creature|deals? \d+ damage to target creature/, ok: (f) => f.creatures >= 16, why: "they're creature-heavy" },
];
const MTG_COLOR = { W: "white", U: "blue", B: "black", R: "red", G: "green" };

function sideIn(game, side, op) {
  const out = [];
  for (const r of side) {
    if (!r.c) continue;
    const tx = text(r.c);
    let why = "";
    if (game === "mtg") {
      const hit = MTG_SIDE.find((x) => x.re.test(tx) && x.ok(op.features, op));
      const hoser = op.features.colors.find((col) => { const c = MTG_COLOR[col]; return new RegExp(`(?:target|each|a|an|all) ${c} (?:spell|permanent|creature)s?|if (?:it's|it is|that spell is|the target is) ${c}|protection from ${c}|${c} spells? (?:your opponents cast|can't)|counter target ${c}|destroy target ${c}`).test(tx); });
      why = hoser ? `they're ${MTG_COLOR[hoser]}` : hit?.why || "";
    } else {
      const f = op.features;
      why = /\bgy\b|graveyard/.test(tx) && /banish|cannot/.test(tx) && f.gy >= 10 ? "they use the GY"
        : /extra deck/.test(tx) && /negate|cannot special summon|banish|destroy/.test(tx) && f.extraUse >= 10 ? "they summon from the Extra Deck"
        : /destroy all spells? (?:and|&) traps?|destroy (?:1|one|up to \w+) (?:spell|trap|spell\/trap)|banish .*spell/.test(tx) && f.st >= 12 ? "they play many Spells and Traps"
        : /from (?:the|their) deck to (?:the|their) hand|added (?:from the deck|to the hand)/.test(tx) && /cannot|negate/.test(tx) && f.starters >= 9 ? "they search a lot"
        : /destroy all monsters|tribute 1 monster your opponent controls|special summon this card .*to your opponent's field|destroy all cards your opponent controls/.test(tx) ? "breaks their board going second"
        : "";
    }
    if (why) out.push({ name: r.c.name || r.name, qty: r.qty, why });
  }
  return out.sort((a, b) => b.qty - a.qty).slice(0, 6);
}
function sideOut(game, main, op, n, protect) {
  if (!n) return [];
  const f = op.features, cand = [];
  for (const r of main) {
    if (!r.c || protect(r)) continue;
    const tx = text(r.c), t = typeOf(r.c);
    if (game === "mtg") {
      if (/\bLand\b/.test(t.split(" // ")[0])) continue;
      const why = /(?:destroy|exile) target creature|deals? \d+ damage to target creature/.test(tx) && f.creatures < 10 ? "few creatures to aim it at"
        : /destroy all creatures|damage to each creature/.test(tx) && f.creatures < 14 ? "they don't go wide"
        : /counter target/.test(tx) && op.plan === "Aggro" && Number(r.c.cmc) >= 3 ? "too slow against their curve"
        : /you gain \d+ life/.test(tx) && !/Creature/.test(t) && op.plan !== "Aggro" ? "life gain doesn't matter here"
        : op.plan === "Aggro" && Number(r.c.cmc) >= 5 && !/Creature/.test(t) ? "too slow against aggro"
        : op.plan === "Control" && /(?:destroy|exile) target creature/.test(tx) ? "control has few creatures"
        : "";
      if (why) cand.push({ name: r.c.name, qty: r.qty, why });
    } else {
      const why = /\(quick effect\)[^.]*discard this card/.test(tx) && f.starters < 6 ? "they search too little for it to land"
        : /destroy all spells? (?:and|&) traps?/.test(tx) && f.st < 8 ? "they play few Spells and Traps"
        : "";
      if (why) cand.push({ name: r.c.name, qty: r.qty, why });
    }
  }
  const picked = [];
  let left = n;
  for (const x of cand.sort((a, b) => b.qty - a.qty)) { if (left <= 0) break; const k = Math.min(x.qty, left); picked.push({ ...x, qty: k }); left -= k; }
  // Not enough clearly-dead cards: cut the most expensive non-core spells (Magic) or the
  // non-engine 1-ofs (Yu-Gi-Oh!).
  if (left > 0) {
    const pool = main.filter((r) => r.c && !protect(r) && !picked.some((x) => x.name === r.c.name) && (game === "mtg" ? !/\bLand\b/.test(typeOf(r.c).split(" // ")[0]) : true))
      .sort((a, b) => (game === "mtg" ? (Number(b.c.cmc) || 0) - (Number(a.c.cmc) || 0) : a.qty - b.qty));
    for (const r of pool) { if (left <= 0) break; const k = Math.min(r.qty, left); picked.push({ name: r.c.name, qty: k, why: game === "mtg" ? "the slowest flexible slot" : "a flexible non-engine slot" }); left -= k; }
  }
  return picked;
}

// me/op: profiles. main/side: [{ qty, c }]. protect(row): engine cards never cut.
// reprofile(rows): the deck's profile after a swap, to show what siding is worth.
export function gamePlan(game, me, op, { main = [], side = [], protect = () => false, reprofile = null, sim = null } = {}) {
  if (game === "ptcg") {
    const weakHit = op.weak.some((t) => me.types.includes(t)), weakTaken = me.weak.some((t) => op.types.includes(t)),
      hits = Math.max(1, Math.ceil(op.hp / Math.max(10, me.reach * (weakHit ? 2 : 1)))),
      lines = [
        `Lead with ${me.name}: ${hits} attack${hits === 1 ? "" : "s"} Knock Out a ${op.hp} HP ${op.name}${weakHit ? " (it hits their Weakness)" : ""}.`,
        op.prize === 2 ? "They're built on 2-Prize Pokémon: three Knock Outs win. Save gust for a damaged ex to skip a turn." : "They play single-Prize Pokémon: you need six Knock Outs, so keep a second attacker ready on the Bench.",
        weakTaken ? `${op.name} hits your ${me.name}'s Weakness: spread your attackers and don't power up two at once in front of it.` : "",
        op.disrupt >= 3 ? `They run ${op.disrupt} hand-disruption cards (Iono and friends): keep searchers on the Bench once you take a Prize lead.` : "",
      ].filter(Boolean);
    return { kind: "prize", lines };
  }
  const ins = sideIn(game, side, op),
    n = ins.reduce((a, x) => a + x.qty, 0),
    outs = sideOut(game, main, op, n, protect);
  let after = null;
  if (n && reprofile && sim != null) {
    const outLeft = new Map(outs.map((x) => [x.name, x.qty])),
      rows = main.map((r) => { const k = Math.min(r.qty, outLeft.get(r.c?.name) || 0); outLeft.set(r.c?.name, (outLeft.get(r.c?.name) || 0) - k); return { ...r, qty: r.qty - k }; }).filter((r) => r.qty > 0);
    for (const x of ins) { const s = side.find((r) => (r.c?.name || r.name) === x.name); if (s) rows.push({ ...s, qty: x.qty }); }
    const p2 = reprofile(rows),
      m2 = p2 && simulateMatchup(game, p2, op, { runs: 1200 });
    after = m2?.win ?? null;
  }
  // A swap the simulation says makes things worse isn't a plan: keep the main deck.
  if (after != null && sim != null && after < sim - 0.005) return { kind: "side", ins: [], outs: [], after: null, empty: !side.length, worse: true };
  return { kind: "side", ins, outs, after, empty: !side.length };
}

/* ---------- Commander: four-player pods ---------- */
// Your deck and three decks from the field (picked by how often they're played), seats shuffled.
// Each deck races its own goldfish kill turn. The table spends its answers on whoever is closest
// to winning (the "archenemy"); everyone else is only lightly slowed. Earliest kill wins, ties to
// the earlier seat; games that drag on go to the deck that draws more. An even share is 25%.
// `shift` (turns, negative = faster) is each field deck's calibration: placing decks win about
// their share against the rest of the field, and the shift stands in for kills the goldfish
// can't see (a combo on turn 3).
// A pod profile: the deck's goldfish spread, centred on the turn its bracket and speed cards say it
// ends games (see podSpeed in extras.js).
export function podProfile(profile, speed) {
  if (!profile || !speed) return profile;
  const d = profile.clock, tot = d.reduce((a, x) => a + x, 0) || 1;
  let acc = 0, med = profile.maxT + 2;
  for (let i = 0; i < d.length; i++) if ((acc += d[i]) >= tot / 2) { med = i >= profile.maxT ? profile.maxT + 2 : i + 1; break; }
  return { ...profile, anchor: speed.turn - med, speed };
}
function podGame(players, r) {
  const drawn = (inter, size, turns) => { const e = (inter / size) * (7 + turns); return Math.floor(e) + (r() < e - Math.floor(e) ? 1 : 0); };
  const per = (threats) => 1.1 * (1 - Math.min(0.5, threats / 48));
  const weak = (s) => Math.max(0, 75 - (s ?? 70)) / 12;
  const base = players.map((p) => Math.max(2, sampleTurn(p.profile.clock, p.profile.maxT, r) + (p.profile.anchor || 0) + (p.shift || 0) + (p.profile.anchor == null ? weak(p.profile.score) : 0)));
  // The table's biggest threat: the fastest deck; a tie is broken at random, not by seat.
  const fastest = base.map((t, i) => (t === Math.min(...base) ? i : -1)).filter((i) => i >= 0), lead = fastest[Math.floor(r() * fastest.length)];
  const end = players.map((p, i) => base[i] + players.reduce((a, q, j) => (j === i ? a : a + drawn(q.profile.inter, q.profile.size, base[i]) * per(p.profile.threats) * (i === lead ? 1 : 0.3)), 0) + i * 0.01);
  if (end.every((t) => t > 12)) {
    const w = players.map((p) => Math.max(1, (p.profile.flow || 0) + 4)), tot = w.reduce((a, x) => a + x, 0);
    let x = r() * tot;
    for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return { winner: i, end, lead, long: true };
    return { winner: 0, end, lead, long: true };
  }
  return { winner: end.indexOf(Math.min(...end)), end, lead, long: false };
}
const pickByShare = (field, r) => {
  const tot = field.reduce((a, f) => a + (f.share || 0.01), 0);
  let x = r() * tot;
  for (const f of field) if ((x -= f.share || 0.01) < 0) return f;
  return field[field.length - 1];
};
export function simulatePod(me, field, { runs = 3000, seed = 11, shift = 0, exclude = null } = {}) {
  const pool = field.filter((f) => f !== exclude && f.profile);
  if (!me || pool.length < 1) return null;
  const r = rng(seed), per = new Map(), seat = [0, 0, 0, 0], seatN = [0, 0, 0, 0], mine = [], others = [];
  let wins = 0, archenemy = 0, answered = 0;
  for (let i = 0; i < runs; i++) {
    const opps = [pickByShare(pool, r), pickByShare(pool, r), pickByShare(pool, r)], mySeat = i % 4;
    const players = [...opps.map((f) => ({ profile: f.profile, shift: f.shift || 0, f }))];
    players.splice(mySeat, 0, { profile: me, shift, me: true });
    const g = podGame(players, r), won = players[g.winner].me ? 1 : 0;
    wins += won; seat[mySeat] += won; seatN[mySeat]++;
    if (g.lead === mySeat) archenemy++;
    mine.push(g.end[mySeat]); others.push(Math.min(...g.end.filter((_, j) => j !== mySeat)));
    for (const f of new Set(opps)) { const s = per.get(f) || per.set(f, { w: 0, n: 0 }).get(f); s.w += won; s.n++; }
  }
  // The race leaves out politics, blockers and play skill: pull extremes toward an even 25%.
  const cal = (x) => clamp(0.25 + (x - 0.25) * 0.85, 0.02, 0.9);
  const win = cal(wins / runs), mt = median(mine), ot = median(others);
  return {
    win, seats: seat.map((w, i) => cal(w / Math.max(1, seatN[i]))), runs,
    per: new Map([...per].map(([f, s]) => [f, cal(s.w / Math.max(1, s.n))])),
    reasons: [
      mt <= ot ? `You close around turn ${Math.round(mt)}; the fastest other deck at the table around turn ${Math.round(ot)}.` : `The fastest other deck at the table closes around turn ${Math.round(ot)}; you around turn ${Math.round(mt)}.`,
      `You're the table's biggest threat in ${Math.round((archenemy / runs) * 100)}% of games, so three players aim their answers at you there.`,
      me.inter >= 10 ? `Your ${me.inter} answers slow whoever is ahead.` : `Only ${me.inter} answers: you can't stop the fastest deck at the table on your own.`,
    ],
  };
}
// Each field deck's turn shift so it wins about 25% of pods against the rest of the field.
export function calibratePods(field, { runs = 700 } = {}) {
  for (const f of field) f.shift = 0;
  for (let pass = 0; pass < 2; pass++)
    for (const f of field) {
      let best = 0, gap = Infinity;
      for (let s = -6; s <= 3; s++) {
        const p = simulatePod(f.profile, field, { runs, seed: 5, shift: s, exclude: f });
        if (p && Math.abs(p.win - 0.25) < gap) { gap = Math.abs(p.win - 0.25); best = s; }
      }
      f.shift = best;
    }
  return field;
}

/* ---------- Real results (Pokémon) ---------- */
// Validated on 8,469 matches from 30 Limitless events, scored on events each model hadn't seen
// (Brier score; a coin flip is 0.250, lower is better):
//   simulated odds alone 0.290 (overconfident: "18%" sides won 47%), pulled toward 50% 0.249,
//   each archetype's overall results 0.248, head-to-head results between the two archetypes
//   0.246 (best), plus a small nudge from the simulation 0.2463.
// So the number comes from real results: the two archetypes' head-to-head record, pulled toward
// their overall strength when there are few games, nudged a little by the simulation.
const keyOf = (s) => lc(s).trim();
export function realMatchup(results, me, op, sim = 0.5) {
  if (!results?.arch) return { win: clamp(0.5 + 0.12 * (sim - 0.5), 0.03, 0.97), w: 0, n: 0, source: "model" };
  const W = results.arch, H = results.h2h || {};
  const rate = (a) => { const [w, n] = W[keyOf(a)] || [0, 0]; return (w + 5) / (n + 10); };
  const ra = me ? rate(me) : 0.5, rb = rate(op), base = ra / (ra + rb);
  const [w, n] = me && keyOf(me) !== keyOf(op) ? H[keyOf(me) + "|" + keyOf(op)] || [0, 0] : [0, 0];
  const h2h = me && keyOf(me) === keyOf(op) ? 0.5 : (w + 12 * base) / (n + 12);
  return { win: clamp(h2h + 0.06 * (sim - 0.5), 0.03, 0.97), w, n, base, source: n ? "h2h" : "overall" };
}
// Round-by-round results to the tallies realMatchup reads: [deckA, deckB, 1 if A won else 0].
export function tallyResults(games) {
  const arch = {}, h2h = {}, add = (o, k, won) => { const x = (o[k] ||= [0, 0]); x[0] += won; x[1]++; };
  for (const [a, b, y] of games) {
    const A = keyOf(a), B = keyOf(b);
    add(arch, A, y); add(arch, B, 1 - y);
    if (A !== B) { add(h2h, A + "|" + B, y); add(h2h, B + "|" + A, 1 - y); }
  }
  return { arch, h2h, games: games.length };
}
