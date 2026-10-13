// Goldfish: play the exact list out 1,000 times against an empty board, turn by turn, with each
// game's real turn structure. It shows what the hands actually do: how fast the deck develops,
// where its damage comes from, how it closes the game, and what goes wrong. Sample games are
// narrated with real card names. Seeded, so the same list always plays the same games.
// It is a solitaire test: no opponent, no interaction. It measures raw speed and consistency.
import { rng } from "./deckaudit.js";

const lc = (s) => String(s || "").toLowerCase();
const shuffle = (a, r) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const expand = (rows) => rows.flatMap((r) => Array.from({ length: r.qty }, () => r.card));
const dist = (vals, maxT) => {
  const d = Array(maxT + 1).fill(0);
  for (const v of vals) d[v == null || v > maxT ? maxT : v - 1]++;
  return d.map((n) => n / Math.max(1, vals.length));
};
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const top = (m, n = 4) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const names = (list) => list.map((c) => c.name).join(", ");

/* ======================= Magic ======================= */

// rows: [{ qty, c }] with Scryfall card objects. opts: { size, commander (card), plan }
export function mtgGoldfish(rows, { size = 60, commander = null, plan = "Midrange", runs = 1000, seed = 11 } = {}) {
  const model = (c) => {
    const type = String(c.type_line || ""),
      text = lc(c.oracle_text || (c.card_faces || []).map((f) => f.oracle_text).join("\n")),
      land = /\bLand\b/.test(type.split(" // ")[0]),
      creature = /Creature/.test(type),
      pw = parseInt(c.power, 10);
    return {
      name: c.name,
      cmc: Number(c.cmc) || 0,
      land,
      creature,
      walker: /Planeswalker/.test(type),
      power: creature ? (Number.isFinite(pw) ? pw : 2) : 0,
      haste: /\bhaste\b/.test(text),
      dork: !land && creature && /\{t\}(?:,[^:]*)?: add /.test(text),
      rock: !land && !creature && /Artifact/.test(type) && /\{t\}(?:,[^:]*)?: add /.test(text),
      rampLand: !land && /search your library for (?:a|an|up to \w+|two) (?:basic )?(?:land|plains|island|swamp|mountain|forest)[^.]*onto the battlefield|put (?:a|up to \w+) land cards? [^.]*onto the battlefield/.test(text),
      draw: !land ? (/draws? (two|2) cards/.test(text) ? 2 : /draws? (three|3) cards/.test(text) ? 3 : /\bdraws? a card/.test(text) ? 1 : 0) : 0,
      burn: !land && !creature ? Number((text.match(/deals? (\d+) damage to (?:any target|each opponent|target player|target opponent)/) || [])[1] || 0) : 0,
      inter: !land && /(?:destroy|exile) target|counter target|deals? \d+ damage to (?:any target|target creature)|fights? target/.test(text),
    };
  };
  const deck = expand(rows.filter((r) => r.c).map((r) => ({ qty: r.qty, card: model(r.c) }))),
    cmdr = commander ? model(commander) : null,
    life = cmdr ? 40 : 20,
    maxT = 10,
    r = rng(seed),
    kills = [], cmdrTurn = [], spent4 = [], curveOuts = [], dmg6 = [], topEnd = [], flood = [], screw = [],
    dealtBy = new Map(),
    samples = [];
  if (deck.length < 20) return null;
  const hasTop = deck.some((c) => c.cmc >= 5);
  for (let run = 0; run < runs; run++) {
    const lib = shuffle(deck.slice(), r),
      hand = lib.splice(0, 7),
      log = run < 400 ? [] : null;
    let lands = 0, extra = 0, nextExtra = 0, board = [], damage = 0, kill = null, cmdrCast = null, spent = 0, avail = 0, castEach = 0, bigCast = false;
    for (let t = 1; t <= maxT; t++) {
      if (t > 1 && lib.length) hand.push(lib.shift());
      extra += nextExtra;
      nextExtra = 0;
      const did = [];
      const li = hand.findIndex((c) => c.land);
      if (li >= 0) {
        lands++;
        did.push(hand.splice(li, 1)[0].name);
      }
      let mana = lands + extra;
      const startMana = mana;
      let castAny = false;
      // Commander first when it fits, then the biggest spells that fit (greedy, like a goldfish).
      if (cmdr && cmdrCast == null && mana >= cmdr.cmc) {
        mana -= cmdr.cmc;
        cmdrCast = t;
        board.push({ ...cmdr, summoned: t });
        did.push(cmdr.name + " (commander)");
        castAny = true;
      }
      for (let again = true; again; ) {
        again = false;
        const order = hand.map((c, i) => [c, i]).filter(([c]) => !c.land && c.cmc <= mana).sort((a, b) => b[0].cmc - a[0].cmc || (b[0].dork || b[0].rock) - (a[0].dork || a[0].rock));
        if (!order.length) break;
        const [c, i] = order[0];
        hand.splice(i, 1);
        mana -= c.cmc;
        castAny = true;
        if (c.cmc >= 5) bigCast = true;
        did.push(c.name);
        if (c.rock) (extra++, mana++);
        if (c.dork) nextExtra++;
        if (c.rampLand) {
          const li2 = lib.findIndex((x) => x.land);
          if (li2 >= 0) (lands++, lib.splice(li2, 1));
        }
        for (let k = 0; k < c.draw && lib.length; k++) hand.push(lib.shift());
        if (c.creature || c.walker) board.push({ ...c, summoned: t });
        if (c.burn) {
          damage += c.burn;
          dealtBy.set(c.name, (dealtBy.get(c.name) || 0) + c.burn);
        }
        again = true;
      }
      if (t <= 4) {
        spent += startMana - mana;
        avail += startMana;
      }
      if (t >= 2 && t <= 4 && castAny) castEach++;
      // Combat: everything that's been on the battlefield since last turn (or has haste) attacks.
      let swing = 0;
      for (const b of board)
        if (b.power && (b.summoned < t || b.haste)) {
          swing += b.power;
          dealtBy.set(b.name, (dealtBy.get(b.name) || 0) + b.power);
        }
      damage += swing;
      if (swing) did.push(`attack for ${swing}`);
      if (log) log.push({ t, text: did.length ? did.join(" · ") : "nothing to play", total: damage });
      if (t === 6) dmg6.push(damage);
      if (kill == null && damage >= life) kill = t;
    }
    kills.push(kill);
    if (cmdr) cmdrTurn.push(cmdrCast);
    spent4.push(avail ? spent / avail : 0);
    curveOuts.push(castEach === 3);
    topEnd.push(bigCast);
    const lands7 = lands;
    flood.push(lands7 >= 8);
    screw.push(lands7 <= 3);
    if (log) samples.push({ kill, log: log.slice(0, 7) });
  }
  const killT = median(kills),
    d = dist(kills, maxT),
    winners = top(dealtBy, 4).map(([n, v]) => ({ name: n, share: v / Math.max(1, [...dealtBy.values()].reduce((a, b) => a + b, 0)) }));
  // Pick a typical game (closest to the median kill) and the worst one for the narration.
  const pick = (want) => samples.find((s) => s.kill === want) || samples[0],
    typical = pick(killT),
    worst = samples.filter((s) => s.kill == null || s.kill > (killT ?? 99)).sort((a, b) => (b.kill ?? 99) - (a.kill ?? 99))[0];
  const target = cmdr ? null : { Aggro: 5, Midrange: 6, Control: 8, Ramp: 6 }[String(plan).split(" ")[0]] ?? 6;
  return {
    game: "mtg",
    runs,
    headline: cmdr
      ? `Commander lands on turn ${median(cmdrTurn) ?? "—"} in a typical game; ${Math.round(avg(dmg6))} damage to one opponent by turn 6.`
      : killT
        ? `A typical goldfish kill is turn ${killT}${target ? ` (a ${String(plan).split(" ")[0].toLowerCase()} deck wants turn ${target} or sooner)` : ""}.`
        : "Most games don't deal 20 damage by turn 10: this list wins slowly, through something other than combat.",
    turnDist: cmdr ? null : { label: "Turn the goldfish dies (20 damage, no blockers)", d, maxT },
    metrics: [
      { label: "Mana used, turns 1–4", value: avg(spent4), pct: true, note: "of the mana you had", good: 0.75 },
      { label: "A play on turns 2, 3 and 4", value: curveOuts.filter(Boolean).length / runs, pct: true, good: 0.5 },
      ...(hasTop ? [{ label: "Top end (5+ mana) cast by turn 10", value: topEnd.filter(Boolean).length / runs, pct: true, good: 0.6 }] : []),
      { label: "Flooded (8+ lands by turn 10)", value: flood.filter(Boolean).length / runs, pct: true, bad: true, good: 0.2 },
      { label: "Screwed (3 or fewer lands by turn 10)", value: screw.filter(Boolean).length / runs, pct: true, bad: true, good: 0.08 },
      ...(cmdr ? [{ label: "Commander cast by turn 4", value: cmdrTurn.filter((t) => t && t <= 4).length / runs, pct: true, good: 0.6 }] : []),
    ],
    winCon: winners.length
      ? `Damage comes from ${winners.map((w) => `${w.name} (${Math.round(w.share * 100)}%)`).join(", ")}.`
      : "No card deals damage on its own; this list needs a combo, alternate win or a long game.",
    endgame: hasTop ? `Its late game: ${names(deck.filter((c) => c.cmc >= 5).filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i).slice(0, 5))}.` : "No 5+ mana cards: it has to win before the opponent's late game arrives.",
    samples: [typical && { title: `Typical game${typical.kill ? ` · wins turn ${typical.kill}` : ""}`, log: typical.log }, worst && worst !== typical && { title: `A bad draw${worst.kill ? ` · wins turn ${worst.kill}` : " · no kill by turn 10"}`, log: worst.log }].filter(Boolean),
    speed: cmdr ? null : killT == null ? 0.2 : Math.max(0, Math.min(1, 1 - (killT - (target || 6)) / 4)),
  };
}

/* ======================= Pokémon ======================= */

// main: [{ qty, c }] Pokémon card objects. opts: { attacker, line: { base, mid, top, two } }
export function ptcgGoldfish(main, { attacker = null, line = null, runs = 1000, seed = 13 } = {}) {
  const sup = (c) => c.category === "Trainer" && (/Supporter/.test(c.typeLine || "") || /^(?:iono|professor's research|boss's orders|lillie's determination|arven|judge|carmine|crispin|briar|cynthia|marnie|n)$/i.test(c.name)),
    text = (c) => lc((c.effect || c.text || "") + " " + (c.abilities || []).map((a) => a.effect).join(" "));
  const model = (c) => {
    const tx = text(c),
      best = (c.attacks || []).map((a) => ({ name: a.name, cost: (a.cost || []).length, dmg: parseInt(String(a.damage).replace(/\D/g, ""), 10) || 0 })).sort((a, b) => b.dmg - a.dmg)[0];
    return {
      name: c.name,
      pokemon: c.category === "Pokemon",
      basic: !!c.basicPokemon,
      stage: c.stage || "",
      from: c.evolveFrom || "",
      energy: c.category === "Energy",
      supporter: sup(c),
      draw: c.category === "Trainer" && /draw/.test(tx) ? (/draw 7|draw seven/.test(tx) ? 7 : /draw (\d)/.test(tx) ? Number(tx.match(/draw (\d)/)[1]) : 4) : 0,
      shuffleHand: /shuffle (?:your|their) hand|puts it on the bottom/.test(tx),
      discardHand: /discard your hand/.test(tx),
      searchBasic: c.category === "Trainer" && /search your deck for (?:up to \w+ |a |\d )?basic pokémon/.test(tx),
      searchAny: c.category === "Trainer" && /search your deck for (?:a|up to \w+|\d) pokémon/.test(tx) && !/basic pokémon/.test(tx),
      candy: /^rare candy$/i.test(c.name),
      accel: c.category === "Trainer" && /attach [^.]*energy[^.]*from your (?:deck|discard pile)/.test(tx),
      attack: best || null,
    };
  };
  const deck = expand(main.filter((r) => r.c).map((r) => ({ qty: r.qty, card: model(r.c) })));
  if (deck.length < 30 || !deck.some((c) => c.basic)) return null;
  if (!deck.some((c) => c.attack)) return null;
  let atkName = attacker || deck.filter((c) => c.attack).sort((a, b) => b.attack.dmg - a.attack.dmg)[0]?.name,
    atkCard = deck.find((c) => c.name === atkName && c.attack) || deck.filter((c) => c.attack).sort((a, b) => b.attack.dmg - a.attack.dmg)[0],
    need = atkCard.attack.cost || 1,
    _n = (atkName = atkCard.name),
    chain = line && line.top === atkName ? [line.base, line.two ? line.mid : null, line.top].filter(Boolean) : atkCard?.basic ? [atkName] : atkCard?.from ? [atkCard.from, atkName] : [atkName],
    maxT = 6,
    r = rng(seed),
    firstAtk = [], attacks5 = [], mulls = [], dmgTot = [], deadTurns = [],
    samples = [];
  for (let run = 0; run < runs; run++) {
    let lib, hand, m = 0;
    for (;;) {
      lib = shuffle(deck.slice(), r);
      hand = lib.splice(0, 7);
      if (hand.some((c) => c.basic)) break;
      m++;
      if (m > 6) break;
    }
    mulls.push(m);
    lib.splice(0, 6); // Prizes
    const field = [], // { name, stageIdx, since, energy }
      log = run < 400 ? [] : null;
    let first = null, nAtk = 0, dmg = 0, dead = 0;
    const take = (pred) => {
      const i = lib.findIndex(pred);
      return i >= 0 ? lib.splice(i, 1)[0] : null;
    };
    const lineIdx = (name) => chain.indexOf(name);
    for (let t = 1; t <= maxT; t++) {
      const did = [];
      if (lib.length) hand.push(lib.shift());
      // Supporter (not on the first turn when going first): draw when the hand is thin or missing pieces.
      if (t > 1) {
        const si = hand.findIndex((c) => c.supporter && c.draw);
        const missing = chain.some((n) => !field.some((f) => f.name === n) && !hand.some((c) => c.name === n));
        if (si >= 0 && (hand.length <= 5 || missing)) {
          const s = hand.splice(si, 1)[0];
          if (s.discardHand || s.shuffleHand) {
            if (s.shuffleHand) lib.push(...hand.splice(0));
            else hand.splice(0);
          }
          for (let k = 0; k < s.draw && lib.length; k++) hand.push(lib.shift());
          did.push(`${s.name} (draw ${s.draw})`);
        }
      }
      // Search: Basic of the line first, then the next missing piece.
      for (const c of hand.filter((x) => x.searchBasic || x.searchAny)) {
        const i = hand.indexOf(c);
        if (i < 0) continue;
        const wantBasic = !field.some((f) => f.name === chain[0]) && !hand.some((h) => h.name === chain[0]);
        const nextPiece = chain.find((n, k) => k > 0 && !hand.some((h) => h.name === n) && !field.some((f) => f.name === n));
        const got = wantBasic ? take((x) => x.name === chain[0]) : c.searchAny && nextPiece ? take((x) => x.name === nextPiece) : c.searchBasic ? take((x) => x.basic) : null;
        if (!got) continue;
        hand.splice(i, 1);
        // Ultra Ball-style: discard two cards, the least useful first (spare Energy, then filler).
        if (c.searchAny)
          for (let k = 0; k < 2 && hand.length; k++) {
            const j = Math.max(0, hand.findIndex((x) => !x.pokemon && !x.supporter && !x.candy));
            hand.splice(j, 1);
          }
        hand.push(got);
        did.push(`${c.name} → ${got.name}`);
      }
      // Bench every Basic (up to 6 in play).
      for (let i = hand.length - 1; i >= 0 && field.length < 6; i--)
        if (hand[i].basic) {
          const b = hand.splice(i, 1)[0];
          field.push({ name: b.name, card: b, since: t, energy: 0 });
          did.push(`play ${b.name}`);
        }
      // Evolve (not on a Pokémon's first turn, never on turn 1), Rare Candy from turn 2.
      for (const f of field) {
        if (f.since >= t || t === 1) continue;
        // Rare Candy straight to the Stage 2 when both are in hand; otherwise evolve normally.
        const ci = hand.findIndex((c) => c.candy),
          k = lineIdx(f.name);
        if (ci >= 0 && line?.two && k === 0 && chain.length === 3) {
          const si = hand.findIndex((c) => c.name === chain[2]);
          if (si >= 0) {
            const e = hand.splice(si, 1)[0];
            hand.splice(hand.findIndex((c) => c.candy), 1);
            did.push(`Rare Candy: ${f.name} → ${e.name}`);
            Object.assign(f, { name: e.name, card: e, since: t });
            continue;
          }
        }
        const ei = hand.findIndex((c) => c.from === f.name);
        if (ei >= 0) {
          const e = hand.splice(ei, 1)[0];
          did.push(`evolve ${f.name} → ${e.name}`);
          Object.assign(f, { name: e.name, card: e, since: t });
        }
      }
      // Energy: one attachment a turn, to the most developed member of the line; plus acceleration.
      const target = field.filter((f) => lineIdx(f.name) >= 0 || f.name === atkName).sort((a, b) => lineIdx(b.name) - lineIdx(a.name))[0] || field[0];
      const ei = hand.findIndex((c) => c.energy);
      if (target && ei >= 0) {
        hand.splice(ei, 1);
        target.energy++;
        did.push(`attach Energy to ${target.name}`);
      }
      const ai = hand.findIndex((c) => c.accel);
      if (target && ai >= 0 && take((x) => x.energy)) {
        const a = hand.splice(ai, 1)[0];
        target.energy++;
        did.push(`${a.name}: +1 Energy`);
      }
      // Attack (not on turn 1 when going first).
      const ready = t > 1 && field.find((f) => f.name === atkName && f.energy >= need);
      if (ready) {
        nAtk++;
        dmg += atkCard.attack.dmg;
        if (first == null) first = t;
        did.push(`${atkName} attacks: ${atkCard.attack.name} for ${atkCard.attack.dmg}`);
      } else if (t > 1) dead++;
      if (log) log.push({ t, text: did.length ? did.join(" · ") : "nothing useful to do" });
    }
    firstAtk.push(first);
    attacks5.push(nAtk);
    dmgTot.push(dmg);
    deadTurns.push(dead);
    if (log) samples.push({ first, log });
  }
  const firstT = median(firstAtk),
    pick = samples.find((s) => s.first === firstT) || samples[0],
    worst = samples.filter((s) => s.first == null || s.first > (firstT ?? 99)).sort((a, b) => (b.first ?? 99) - (a.first ?? 99))[0];
  return {
    game: "ptcg",
    runs,
    headline: firstT ? `${atkName} attacks on turn ${firstT} in a typical game (going first, no attacks on turn 1).` : `${atkName} usually isn't attacking by turn ${maxT}: the setup is too slow or missing pieces.`,
    turnDist: { label: `First attack with ${atkName}`, d: dist(firstAtk, maxT), maxT },
    metrics: [
      { label: "Attacking by turn 2", value: firstAtk.filter((t) => t && t <= 2).length / runs, pct: true, good: 0.5 },
      { label: "Attacking by turn 3", value: firstAtk.filter((t) => t && t <= 3).length / runs, pct: true, good: 0.8 },
      { label: "Attacks in the first 6 turns", value: avg(attacks5), good: 3.5 },
      { label: "Turns with no attack (turns 2–6)", value: avg(deadTurns), bad: true, good: 1.5 },
      { label: "Mulligans per game", value: avg(mulls), bad: true, good: 0.2 },
    ],
    winCon: atkCard?.attack ? `${atkName}: ${atkCard.attack.name}, ${atkCard.attack.dmg} damage for ${need} Energy. About ${Math.round(avg(dmgTot))} damage in the first 6 turns of a goldfish.` : "No attacker with printed damage found.",
    endgame: line ? `Its line is ${chain.join(" → ")}. Late game depends on rebuilding it: keep recovery (Night Stretcher, Super Rod) and a second Basic on the Bench.` : `${atkName} is a Basic, so it can be replaced quickly once Knocked Out.`,
    samples: [pick && { title: `Typical game${pick.first ? ` · first attack turn ${pick.first}` : ""}`, log: pick.log }, worst && worst !== pick && { title: `A bad draw${worst.first ? ` · first attack turn ${worst.first}` : " · no attack by turn 6"}`, log: worst.log }].filter(Boolean),
    speed: firstT == null ? 0.1 : Math.max(0, Math.min(1, 1 - (firstT - 2) / 3)),
  };
}

/* ======================= Yu-Gi-Oh! ======================= */

// Yu-Gi-Oh! can't be played out without an opponent's interruptions, so the goldfish reads each
// opening hand the way a player would: can it start, can it play through a hand trap, what does
// it hold for the opponent's turn, and what is dead. tagged: [{ qty, c, tags:Set }]; extra: [{ qty, c }]
export function ygoGoldfish(tagged, extra = [], { runs = 1000, seed = 17 } = {}) {
  const deck = expand(tagged.filter((r) => r.c).map((r) => ({ qty: r.qty, card: { name: r.c.name, tags: r.tags, atk: r.c.atk } })));
  if (deck.length < 20) return null;
  const r = rng(seed),
    out = { full: 0, through1: 0, fragile: 0, interOnly: 0, brick: 0 },
    samples = [];
  for (let run = 0; run < runs; run++) {
    const h = shuffle(deck.slice(), r).slice(0, 5),
      n = (k) => h.filter((c) => c.tags.has(k)).length,
      starters = n("starter"),
      ext = n("extender"),
      inter = n("handtrap") + n("negate"),
      dead = n("brick") + n("garnet");
    let kind;
    if (starters && starters + ext >= 2 && inter) kind = "full";
    else if (starters && starters + ext >= 2) kind = "through1";
    else if (starters) kind = "fragile";
    else if (inter >= 2) kind = "interOnly";
    else kind = "brick";
    out[kind]++;
    if (samples.length < 40) samples.push({ kind, h, starters, ext, inter, dead });
  }
  const P = (k) => out[k] / runs,
    plan = (s) => {
      const st = s.h.filter((c) => c.tags.has("starter")),
        ex = s.h.filter((c) => c.tags.has("extender")),
        it = s.h.filter((c) => c.tags.has("handtrap") || c.tags.has("negate")),
        dd = s.h.filter((c) => c.tags.has("brick") || c.tags.has("garnet"));
      const lines = [];
      if (st.length) lines.push(`Open with ${st[0].name}: it searches or starts the combo.`);
      if (st.length > 1 || ex.length) lines.push(`If it's stopped, ${[...st.slice(1), ...ex].map((c) => c.name).join(" or ")} starts a second line.`);
      if (it.length) lines.push(`Hold ${names(it)} for the opponent's turn.`);
      if (!st.length && !it.length) lines.push("No starter and nothing to stop the opponent: this hand passes with little on board.");
      if (dd.length) lines.push(`${names(dd)} ${dd.length > 1 ? "do" : "does"} nothing from the hand here.`);
      return lines;
    };
  const LABEL = { full: "Full combo plus interaction", through1: "Combo with a backup line", fragile: "One starter, folds to a single hand trap", interOnly: "No combo, but 2+ interaction (going second)", brick: "Brick: no starter, little interaction" };
  const show = ["full", "fragile", "brick"].map((k) => samples.find((s) => s.kind === k)).filter(Boolean);
  const bosses = extra.filter((x) => x.c).map((x) => x.c).sort((a, b) => (b.atk || 0) - (a.atk || 0)).slice(0, 3),
    beaters = tagged.filter((x) => x.c?.atk >= 2500).map((x) => x.c).slice(0, 3);
  return {
    game: "ygo",
    runs,
    headline: `${Math.round((P("full") + P("through1")) * 100)}% of 5-card hands can start a combo and keep going if one card is stopped; ${Math.round(P("brick") * 100)}% are bricks.`,
    outcomes: Object.keys(LABEL).map((k) => ({ label: LABEL[k], p: P(k), kind: k })),
    metrics: [
      { label: "Plays through one interruption", value: P("full") + P("through1"), pct: true, good: 0.65 },
      { label: "Combo and a hand trap in the same hand", value: P("full"), pct: true, good: 0.45 },
      { label: "Bricks", value: P("brick"), pct: true, bad: true, good: 0.08 },
    ],
    winCon: bosses.length ? `Ends on its Extra Deck: ${bosses.map((b) => `${b.name}${b.atk ? ` (${b.atk} ATK)` : ""}`).join(", ")}.` : beaters.length ? `Wins through big Main Deck monsters: ${names(beaters)}.` : "No Extra Deck boss and no big beaters: it's unclear how this list closes a game.",
    endgame: extra.length < 8 ? "Too few Extra Deck options to keep making plays after the first combo is answered." : "A full Extra Deck gives it follow-up plays once the first board is broken.",
    samples: show.map((s) => ({ title: LABEL[s.kind], hand: s.h.map((c) => c.name), log: plan(s).map((text, i) => ({ t: i + 1, text })) })),
    speed: Math.max(0, Math.min(1, (P("full") + P("through1")) / 0.65)),
  };
}
