// Seeded, simplified solitaire models using the supplied list and recognized
// printed effects. These do not implement every card or full game rules and
// cannot establish real winning turns, matchup strength or win probabilities.
import { rng } from "./deckaudit.js";
import { mtgManaSourceProfile } from "./mtg-mana-sources.js";

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

// Each pool entry is one mana unit with its possible colors. A flexible source
// cannot pay two colored pips at once. Unsupported alternative costs stay outside
// this basic payment model rather than being claimed as fully simulated rules.
export function spendMana(pool, pips, cost) {
  if(pool.length<cost)return null;
  const needs=[...pips].sort((a,b)=>pool.filter(x=>x.includes(a)).length-pool.filter(x=>x.includes(b)).length);
  const used=new Set();
  const assign=i=>{
    if(i===needs.length)return true;
    const choices=pool.map((colors,k)=>({colors,k})).filter(x=>!used.has(x.k)&&x.colors.includes(needs[i])).sort((a,b)=>a.colors.length-b.colors.length);
    for(const {k} of choices){used.add(k);if(assign(i+1))return true;used.delete(k);}return false;
  };
  if(!assign(0))return null;
  const left=pool.filter((_,i)=>!used.has(i));
  left.sort((a,b)=>a.length-b.length);left.splice(0,Math.max(0,cost-needs.length));
  return left;
}

// Count only unconditional own draw on resolving this spell / its own ETB.
// Cycling, channel and other activations are alternative actions, not cast
// bonuses. A later upkeep, death or attack trigger is not simulated as an ETB.
export function mtgCastDraw(c) {
  const tx = lc(c?.oracle_text || (c?.card_faces || []).map(f => f.oracle_text || "").join("\n")),
    spell = /\b(?:Instant|Sorcery)\b/.test(c?.type_line || ""),
    name = lc(c?.name).split(",")[0].replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),
    ownEntry = new RegExp(`^when (?:this (?:creature|artifact|enchantment|permanent)|${name || "~"}) enters(?: the battlefield)?\\b`);
  let draw = 0;
  for (const line of tx.split("\n").map(s => s.replace(/\([^)]*\)/g, "").trim())) {
    if (/^cycling\b|^channel\b|:|\bwould draw\b|instead of drawing|choose one/.test(line)) continue;
    if (!spell && !ownEntry.test(line) && !/^when you cast this spell,/.test(line)) continue;
    if (/^whenever|^at the beginning|^when (?!you cast this spell,)/.test(line) && !ownEntry.test(line)) continue;
    const effect = line.replace(/^when[^,]*,\s*/, "");
    for (const clause of effect.split(".")) {
      if (/\bif\b|\bunless\b|\bwhen\b|\bwhenever\b|\bmay\b/.test(clause)) continue;
      if (/(?:opponent|player|controller)(?: each)? draws?/.test(clause) && !/\byou(?: and [^,.]+)?(?: each)? draw/.test(clause)) continue;
      const n = clause.match(/\bdraw (a|an|one|two|three|\d+) cards?\b/);
      if (n) draw += ({a:1, an:1, one:1, two:2, three:3}[n[1]] ?? Number(n[1]));
    }
  }
  return draw;
}

// A bounded casting check, not an attachment/effect simulator. Unknown enchant
// restrictions must not become unconditional permission to spend mana on an Aura.
export function mtgAuraTargetProfile(c) {
  const face=c?.card_faces?.[0]||c||{}, type=face.type_line||c?.type_line||"";
  if(!/\bAura\b/.test(type))return {aura:false,status:"not-aura"};
  const lines=lc(face.oracle_text||c?.oracle_text).replace(/\([^)]*\)/g,"").split("\n").map(s=>s.trim()).filter(s=>/^enchant\b/.test(s));
  if(lines.length!==1)return {aura:true,status:"unmodeled",reason:"Aura enchant restriction is missing or not uniquely recognized."};
  const evidence=lines[0], text=evidence.replace(/^enchant\s+/,"").replace(/\.$/,""),
    control=text.endsWith(" you control")?"self":text.endsWith(" an opponent controls")?"opponent":"any",
    target=text.replace(/ (?:you control|an opponent controls)$/,""),
    terms=target.split(" or ").map(s=>s.match(/^(?:(nonlegendary|legendary|nonland|noncreature|nonartifact|nonenchantment) )?(artifact|creature|enchantment|land|planeswalker|battle|permanent)$/));
  if(terms.some(t=>!t))return {aura:true,status:"unmodeled",evidence,reason:"Aura target qualifiers are outside the supported permanent-type/controller check."};
  return {aura:true,status:"supported",evidence,control,terms:terms.map(t=>({qualifier:t[1]||"",type:t[2]}))};
}
const auraTargetStatus=(profile,permanents=[])=>{
  if(!profile.aura)return {status:"not-aura",castable:true};
  if(profile.status!=="supported")return {status:"unmodeled",castable:false,reason:profile.reason};
  let unresolved=false;
  for(let i=0;i<permanents.length;i++){
    const entry=permanents[i],card=entry.card||entry,controller=entry.controller||"self",face=card.card_faces?.[0]||card,
      type=lc(face.type_line||card.type_line).split(/—| -- /)[0],text=lc(face.oracle_text||card.oracle_text).replace(/\([^)]*\)/g,"");
    if(profile.control!=="any"&&profile.control!==controller)continue;
    if(!/\b(?:artifact|creature|enchantment|land|planeswalker|battle)\b/.test(type))continue;
    const has=t=>new RegExp("\\b"+t+"\\b").test(type);
    if(!profile.terms.some(t=>(t.type==="permanent"||has(t.type))&&(!t.qualifier||(t.qualifier.startsWith("non")?!has(t.qualifier.slice(3)):has(t.qualifier)))))continue;
    // Own hexproof/ward do not stop one's own Aura. Conditional/granted target
    // restrictions and protection need a fuller state model, so omit that host.
    if(/(?:^|\n)\s*shroud\s*(?:\n|$)/.test(text)||/(?:^|\n)this (?:creature|permanent) (?:can't|cannot) be enchanted\.?(?:\n|$)/.test(text))continue;
    if(entry.targetingUnmodeled||/\bshroud\b|\bprotection from\b|can't be (?:the target|enchanted)|cannot be (?:the target|enchanted)/.test(text)||(controller!=="self"&&/\bhexproof\b|\bward\b/.test(text))){unresolved=true;continue;}
    return {status:"eligible",castable:true,targetIndex:i};
  }
  return unresolved?{status:"unmodeled",castable:false,reason:"A matching host has targetability/protection conditions not resolved by this model."}:{status:"no-target",castable:false,reason:"No modeled permanent satisfies this Aura's enchant restriction."};
};
export const mtgAuraTargetStatus=(c,permanents=[])=>auraTargetStatus(mtgAuraTargetProfile(c),permanents);

// rows: [{ qty, c }] with Scryfall card objects. opts: { size, commander (card), plan }
export function mtgGoldfish(rows, { size = 60, commander = null, plan = "Midrange", runs = 1000, seed = 11 } = {}) {
  const boundedConstructed = !commander && size < 99;
  const model = (c) => {
    const type = String(c.type_line || ""),
      text = lc(c.oracle_text || (c.card_faces || []).map((f) => f.oracle_text).join("\n")),
      land = /\bLand\b/.test(type.split(" // ")[0]),
      creature = /Creature/.test(type),
      pw = parseInt(c.power, 10),
      manaSource = mtgManaSourceProfile(c,{commanderIdentity:commander?.color_identity});
    return {
      name: c.name,
      card:c,
      aura:mtgAuraTargetProfile(c),
      changesAuraTargeting:/enchanted [^.\n]*(?:(?:has|gains) [^.\n]*(?:shroud|protection)|(?:can't|cannot) be (?:the target|enchanted)|loses all abilities|becomes? (?:an? |a |the )?)/.test(text),
      permanent:/\b(?:Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/.test(type.split(" // ")[0]),
      cmc: Number(c.cmc) || 0,
      pips: [...String(c.mana_cost || c.card_faces?.[0]?.mana_cost || "").matchAll(/\{([WUBRGC])\}/g)].map(m=>m[1]),
      manaSource,
      colors: manaSource.colors,
      land,
      creature,
      legendary: /\bLegendary\b/.test(type),
      walker: /Planeswalker/.test(type),
      power: creature ? (Number.isFinite(pw) ? pw : 2) : 0,
      haste: /\bhaste\b/.test(text),
      dork: !land && creature && /\{t\}(?:,[^:]*)?: add /.test(text),
      rock: !land && !creature && /Artifact/.test(type) && /\{t\}(?:,[^:]*)?: add /.test(text),
      rampLand: !land && /search your library for (?:a|an|up to \w+|two) (?:basic )?(?:land|plains|island|swamp|mountain|forest)[^.]*onto the battlefield|put (?:a|up to \w+) land cards? [^.]*onto the battlefield/.test(text),
      draw: !land ? boundedConstructed ? mtgCastDraw(c) : (/draws? (two|2) cards/.test(text) ? 2 : /draws? (three|3) cards/.test(text) ? 3 : /\bdraws? a card/.test(text) ? 1 : 0) : 0,
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
    dealtBy = new Map(), unmodeledAuras = new Map(),
    samples = [];
  if (deck.length < 20) return null;
  const hasTop = deck.some((c) => c.cmc >= 5), hasAura=deck.some(c=>c.aura.aura),
    unmodeledMana=[...new Map(deck.filter(c=>c.land||c.dork||c.rock).filter(c=>c.manaSource.conditional.length||c.manaSource.unknown).map(c=>[c.name,{name:c.name,...c.manaSource}])).values()],
    manaLimits=unmodeledMana.length?["Only verified unconditional tap/intrinsic mana outputs enter this simplified pool. Filter input costs, required creatures, chosen-type spending restrictions, fetches and other state-dependent mana routes are not executed; their useful conditional outputs may be underestimated.", "Entry-tapped timing, multiple mana per source and full mana-ability sequencing are not simulated."]:[],
    auraLimits=["Aura casts require a modeled host matching supported printed permanent-type/controller restrictions. Unknown qualifiers or host protection are not assumed legal.","No opposing permanents are present in this solitaire model. Aura attachment effects, granted target restrictions, created hosts and full state-based actions remain unmodeled."];
  for(const c of deck)if(c.aura.status==="unmodeled")unmodeledAuras.set(c.name,{name:c.name,reason:c.aura.reason});
  for (let run = 0; run < runs; run++) {
    const lib = shuffle(deck.slice(), r),
      hand = lib.splice(0, 7),
      log = run < 400 ? [] : null;
    let lands = 0, extra = 0, nextExtra = 0, board = [], damage = 0, kill = null, cmdrCast = null, spent = 0, avail = 0, castEach = 0, bigCast = false;
    const landMana=[],extraMana=[],nextMana=[],permanents=[];
    const canCastAura=c=>{
      const status=auraTargetStatus(c.aura,permanents);
      if(status.status==="unmodeled")unmodeledAuras.set(c.name,{name:c.name,reason:status.reason});
      return status.castable;
    };
    for (let t = 1; t <= maxT; t++) {
      if (t > 1 && lib.length) hand.push(lib.shift());
      extra += nextExtra;
      nextExtra = 0;
      extraMana.push(...nextMana.splice(0));
      const did = [];
      const li = hand.findIndex((c) => c.land);
      if (li >= 0) {
        lands++;
        if (hand[li].colors.length) landMana.push(hand[li].colors);
        permanents.push({card:hand[li].card,controller:"self"});
        did.push(hand.splice(li, 1)[0].name);
      }
      let pool=[...landMana,...extraMana],mana = pool.length;
      const startMana = mana;
      let castAny = false;
      // Commander first when it fits, then the biggest spells that fit (greedy, like a goldfish).
      if (cmdr && cmdrCast == null && spendMana(pool,cmdr.pips,cmdr.cmc) && canCastAura(cmdr)) {
        pool=spendMana(pool,cmdr.pips,cmdr.cmc);
        mana -= cmdr.cmc;
        cmdrCast = t;
        board.push({ ...cmdr, summoned: t });
        if(cmdr.permanent)permanents.push({card:cmdr.card,controller:"self"});
        did.push(cmdr.name + " (commander)");
        castAny = true;
      }
      for (let again = true; again; ) {
        again = false;
        const order = hand.map((c, i) => [c, i]).filter(([c]) => !c.land && spendMana(pool,c.pips,c.cmc) && canCastAura(c)).sort((a, b) => b[0].cmc - a[0].cmc || (b[0].dork || b[0].rock) - (a[0].dork || a[0].rock));
        if (!order.length) break;
        const [c, i] = order[0];
        const auraTarget=c.aura.aura?auraTargetStatus(c.aura,permanents):null;
        hand.splice(i, 1);
        pool=spendMana(pool,c.pips,c.cmc);
        mana -= c.cmc;
        castAny = true;
        if (c.cmc >= 5) bigCast = true;
        did.push(c.name);
        // Do not invent later legal targets after an Aura changes a host's
        // targetability/type in ways this bounded model does not execute.
        if(c.changesAuraTargeting&&auraTarget?.targetIndex!=null)permanents[auraTarget.targetIndex].targetingUnmodeled=true;
        if (c.rock && c.colors.length) { extra++; mana++; extraMana.push(c.colors);pool.push(c.colors); }
        if (c.dork && c.colors.length) { nextExtra++;nextMana.push(c.colors); }
        if (c.rampLand) {
          const li2 = lib.findIndex((x) => x.land);
          if (li2 >= 0) { const land=lib.splice(li2,1)[0];lands++;if (land.colors.length) landMana.push(land.colors);permanents.push({card:land.card,controller:"self"}); }
        }
        for (let k = 0; k < c.draw && lib.length; k++) hand.push(lib.shift());
        if (c.creature || c.walker) {
          // Recasting a legend still resolves its ETB, but does not leave two
          // same-name legends attacking. Keep the established identical body.
          if (!boundedConstructed || !c.legendary || !board.some(b => b.legendary && b.name === c.name)) {board.push({ ...c, summoned: t });permanents.push({card:c.card,controller:"self"});}
        }else if(c.permanent)permanents.push({card:c.card,controller:"self"});
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
    ...(unmodeledMana.length?{manaSources:{status:'partial',excluded:unmodeledMana,limitations:manaLimits},limitations:manaLimits}:{}),
    ...(hasAura?{auraCasting:{status:unmodeledAuras.size?"partial":"bounded",unmodeled:[...unmodeledAuras.values()],limitations:auraLimits},...(!boundedConstructed?{limitations:[...manaLimits,...auraLimits]}:{})}:{}),
    ...(boundedConstructed ? {limitations:[...manaLimits,"Simplified printed-power combat and recognized direct damage against no blockers, not a measured win rate.", "Does not execute cycling/channel, activated abilities, conditional token production, copy triggers, combat support, or full attack restrictions.", "Same-name legendary bodies do not stack; recast ETBs still resolve. Other state-based rules are not fully simulated.",...(hasAura?auraLimits:[])], modeledDraw:rows.filter(r => r.c && !/\bLand\b/.test(r.c.type_line || "")).map(r => ({name:r.c.name, qty:r.qty, castDraw:mtgCastDraw(r.c)}))} : {}),
    headline: cmdr
      ? (unmodeledMana.length ? `With conditional mana routes omitted, modeled commander turn is ${median(cmdrTurn) ?? "unresolved"}; full commander timing is not evaluated.` : `Commander lands on turn ${median(cmdrTurn) ?? "—"} in a typical game; ${Math.round(avg(dmg6))} damage to one opponent by turn 6.`)
      : boundedConstructed ? (killT ? `Among simplified damage-model trials reaching 20 damage, the median is turn ${killT}; this is not a forecast of a real winning turn.` : "The simplified damage model does not reach 20 damage by turn 10 in these trials. Unmodeled abilities and routes are not evaluated here.") : killT
        ? `A typical goldfish kill is turn ${killT}${target ? ` (a ${String(plan).split(" ")[0].toLowerCase()} deck wants turn ${target} or sooner)` : ""}.`
        : "Most games don't deal 20 damage by turn 10: this list wins slowly, through something other than combat.",
    turnDist: cmdr ? null : { label: boundedConstructed ? "Modeled turn reaching 20 damage, no blockers" : "Turn the goldfish dies (20 damage, no blockers)", d, maxT },
    metrics: [
      { label: "Mana used, turns 1–4", value: avg(spent4), pct: true, note: "of the mana you had", good: 0.75 },
      { label: "A play on turns 2, 3 and 4", value: curveOuts.filter(Boolean).length / runs, pct: true, good: 0.5 },
      ...(hasTop ? [{ label: "Top end (5+ mana) cast by turn 10", value: topEnd.filter(Boolean).length / runs, pct: true, good: 0.6 }] : []),
      { label: "Flooded (8+ lands by turn 10)", value: flood.filter(Boolean).length / runs, pct: true, bad: true, good: 0.2 },
      { label: "Screwed (3 or fewer lands by turn 10)", value: screw.filter(Boolean).length / runs, pct: true, bad: true, good: 0.08 },
      ...(cmdr ? [{ label: "Commander cast by turn 4", value: cmdrTurn.filter((t) => t && t <= 4).length / runs, pct: true, good: 0.6 }] : []),
    ],
    winCon: boundedConstructed ? (winners.length ? `Modeled combat/direct damage comes from ${winners.map((w) => `${w.name} (${Math.round(w.share * 100)}%)`).join(", ")}.` : "No damage output was executed by this simplified model; unmodeled routes remain unverified.") : winners.length
      ? `Damage comes from ${winners.map((w) => `${w.name} (${Math.round(w.share * 100)}%)`).join(", ")}.`
      : "No card deals damage on its own; this list needs a combo, alternate win or a long game.",
    endgame: boundedConstructed ? (hasTop ? `Printed mana-value 5+ cards: ${names(deck.filter((c) => c.cmc >= 5).filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i).slice(0, 5))}. Paid abilities and long-game engines still need separate review.` : "No printed mana-value 5+ cards. This does not rule out expensive activated/alternative abilities or repeatable long-game engines.") : hasTop ? `Its late game: ${names(deck.filter((c) => c.cmc >= 5).filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i).slice(0, 5))}.` : "No 5+ mana cards: it has to win before the opponent's late game arrives.",
    samples: boundedConstructed ? [typical && {title:`Model sample${typical.kill ? ` · 20 damage at turn ${typical.kill}` : ""}`,log:typical.log},worst && worst!==typical && {title:`Slower model sample${worst.kill ? ` · 20 damage at turn ${worst.kill}` : " · below 20 damage by turn 10"}`,log:worst.log}].filter(Boolean) : [typical && { title: `Typical game${typical.kill ? ` · wins turn ${typical.kill}` : ""}`, log: typical.log }, worst && worst !== typical && { title: `A bad draw${worst.kill ? ` · wins turn ${worst.kill}` : " · no kill by turn 10"}`, log: worst.log }].filter(Boolean),
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
      best = (c.attacks || []).map((a) => ({ name: a.name, cost: (a.cost || []).length, types: (a.cost || []).filter(x=>x!=="Colorless"), dmg: parseInt(String(a.damage).replace(/\D/g, ""), 10) || 0 })).sort((a, b) => b.dmg - a.dmg)[0];
    return {
      name: c.name,
      pokemon: c.category === "Pokemon",
      basic: !!c.basicPokemon,
      stage: c.stage || "",
      from: c.evolveFrom || "",
      energy: c.category === "Energy",
      energyType: c.basicEnergy ? c.name.replace(/^Basic | Energy$/g, "") : "Unresolved special Energy",
      supporter: sup(c),
      draw: c.category === "Trainer" && /draw/.test(tx) ? (/draw 7|draw seven/.test(tx) ? 7 : /draw (\d)/.test(tx) ? Number(tx.match(/draw (\d)/)[1]) : 4) : 0,
      shuffleHand: /shuffle (?:your|their) hand|puts it on the bottom/.test(tx),
      discardHand: /discard your hand/.test(tx),
      searchBasic: c.category === "Trainer" && /search your deck for (?:up to \w+ |a |\d )?basic pokémon/.test(tx),
      searchAny: c.category === "Trainer" && /search your deck for (?:a|up to \w+|\d) pokémon/.test(tx) && !/basic pokémon/.test(tx),
      searchDiscard: Number(tx.match(/discard (\d+) (?:other )?cards? from your hand/)?.[1] || 0),
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
    need = atkCard.attack.cost,
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
      let supporterUsed = false;
      if (lib.length) hand.push(lib.shift());
      // Supporter (not on the first turn when going first): draw when the hand is thin or missing pieces.
      if (t > 1) {
        const si = hand.findIndex((c) => c.supporter && c.draw);
        const missing = chain.some((n) => !field.some((f) => f.name === n) && !hand.some((c) => c.name === n));
        if (si >= 0 && (hand.length <= 5 || missing)) {
          const s = hand.splice(si, 1)[0];
          supporterUsed = true;
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
        if (c.supporter && (t === 1 || supporterUsed)) continue;
        // Pay the printed cost before searching. A generic Pokémon search does
        // not automatically cost two discards; Ultra Ball's explicit cost does.
        if (hand.length - 1 < c.searchDiscard) continue;
        const wantBasic = !field.some((f) => f.name === chain[0]) && !hand.some((h) => h.name === chain[0]);
        const nextPiece = chain.find((n, k) => k > 0 && !hand.some((h) => h.name === n) && !field.some((f) => f.name === n));
        const got = wantBasic ? take((x) => x.name === chain[0]) : c.searchAny && nextPiece ? take((x) => x.name === nextPiece) : c.searchBasic ? take((x) => x.basic) : null;
        if (!got) continue;
        hand.splice(i, 1);
        if(c.supporter)supporterUsed=true;
        // Ultra Ball-style: discard two cards, the least useful first (spare Energy, then filler).
        if (c.searchDiscard)
          for (let k = 0; k < c.searchDiscard; k++) {
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
          field.push({ name: b.name, card: b, since: t, energy: [] });
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
      const unmet = target ? [...atkCard.attack.types] : [];
      for (const tp of target?.energy || []) { const k=unmet.indexOf(tp); if(k>=0)unmet.splice(k,1); }
      let ei = hand.findIndex((c) => c.energy && unmet.includes(c.energyType));
      if(ei<0)ei=hand.findIndex(c=>c.energy);
      if (target && ei >= 0) {
        const attached=hand.splice(ei, 1)[0];
        target.energy.push(attached.energyType);
        did.push(`attach Energy to ${target.name}`);
      }
      const ai = hand.findIndex((c) => c.accel && (!c.supporter || t > 1 && !supporterUsed));
      const accelerated = target && ai >= 0 ? take(x=>x.energy) : null;
      if (accelerated) {
        const a = hand.splice(ai, 1)[0];
        if(a.supporter)supporterUsed=true;
        target.energy.push(accelerated.energyType);
        did.push(`${a.name}: +1 Energy`);
      }
      // Attack (not on turn 1 when going first).
      const ready = t > 1 && field.find((f) => {
        if(f.name!==atkName || f.energy.length<need)return false;
        const available=[...f.energy];
        return atkCard.attack.types.every(tp=>{const k=available.indexOf(tp);if(k<0)return false;available.splice(k,1);return true;});
      });
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
    endgame: (line ? `Its line is ${chain.join(" → ")}. Review recovery and replacement Basics after a Knock Out.` : `${atkName} is a Basic; replacing it still requires access to another copy and enough Energy.`) + " This simplified model checks Basic Energy types. Special Energy, Pokémon Abilities, attack restrictions and opponent interaction are not fully resolved.",
    samples: [pick && { title: `Typical game${pick.first ? ` · first attack turn ${pick.first}` : ""}`, log: pick.log }, worst && worst !== pick && { title: `A bad draw${worst.first ? ` · first attack turn ${worst.first}` : " · no attack by turn 6"}`, log: worst.log }].filter(Boolean),
    speed: firstT == null ? 0.1 : Math.max(0, Math.min(1, 1 - (firstT - 2) / 3)),
  };
}

/* ======================= Yu-Gi-Oh! ======================= */

// Yu-Gi-Oh! can't be played out without an opponent's interruptions, so the goldfish reads each
// opening hand the way a player would: can it start, can it play through a hand trap, what does
// it hold for the opponent's turn, and what is dead. tagged: [{ qty, c, tags:Set }]; extra: [{ qty, c }]
export function ygoGoldfish(tagged, extra = [], { runs = 1000, seed = 17, handSize = 5 } = {}) {
  const deck = expand(tagged.filter((r) => r.c).map((r) => ({ qty: r.qty, card: {
    name: r.c.name, tags: r.tags, atk: r.c.atk,
    sharedLimit: /you can only (?:use|activate)[^.]*"[^"]+"[^.]*once per turn|you can only activate 1 "[^"]+" per turn/i.test(r.c.text || ""),
  } })));
  if (deck.length < 20) return null;
  const r = rng(seed),
    out = { full: 0, through1: 0, fragile: 0, interOnly: 0, brick: 0 },
    samples = [];
  for (let run = 0; run < runs; run++) {
    const h = shuffle(deck.slice(), r).slice(0, handSize),
      n = (k) => h.filter((c) => c.tags.has(k)).length,
      starters = n("starter"),
      ext = n("extender"),
      inter = n("handtrap") + n("negate"),
      dead = n("brick") + n("garnet"),
      // Each physical card is one resource, even if it has both tags. A named
      // once-per-turn restriction prevents duplicate copies being independent outs.
      seen = new Set(),
      continuations = h.filter(c => c.tags.has("starter") || c.tags.has("extender")).filter(c=>{
        const name=lc(c.name);if(c.sharedLimit&&seen.has(name))return false;
        seen.add(name);return true;
      }).length;
    let kind;
    if (starters && continuations >= 2 && inter) kind = "full";
    else if (starters && continuations >= 2) kind = "through1";
    else if (starters) kind = "fragile";
    else if (inter >= 2) kind = "interOnly";
    else kind = "brick";
    out[kind]++;
    if (samples.length < 40) samples.push({ kind, h, starters, ext, inter, dead, continuations });
  }
  const P = (k) => out[k] / runs,
    plan = (s) => {
      const st = s.h.filter((c) => c.tags.has("starter")),
        ex = s.h.filter((c) => c.tags.has("extender")),
        it = s.h.filter((c) => c.tags.has("handtrap") || c.tags.has("negate")),
        dd = s.h.filter((c) => c.tags.has("brick") || c.tags.has("garnet"));
      const lines = [];
      if (st.length) lines.push(`Open with ${st[0].name}: it searches or starts the combo.`);
      if (s.continuations >= 2) lines.push("The hand has a separate potential continuation. Its summon conditions, shared resources and the opponent's interruption still need validation.");
      if (it.length) lines.push(`Hold ${names(it)} for the opponent's turn.`);
      if (!st.length && !it.length) lines.push("No starter and nothing to stop the opponent: this hand passes with little on board.");
      if (dd.length) lines.push(`${names(dd)} ${dd.length > 1 ? "do" : "does"} nothing from the hand here.`);
      return lines;
    };
  const LABEL = { full: "Starter, separate potential continuation and interaction", through1: "Starter and separate potential continuation", fragile: "Starter without a recognized independent continuation", interOnly: "No recognized starter, but 2+ interaction", brick: "No recognized starter, little interaction" };
  const show = ["full", "fragile", "brick"].map((k) => samples.find((s) => s.kind === k)).filter(Boolean);
  const bosses = extra.filter((x) => x.c).map((x) => x.c).sort((a, b) => (b.atk || 0) - (a.atk || 0)).slice(0, 3),
    beaters = tagged.filter((x) => x.c?.atk >= 2500).map((x) => x.c).slice(0, 3);
  return {
    game: "ygo",
    runs,
    headline: `${Math.round((P("full") + P("through1")) * 100)}% of ${handSize}-card first-turn hands contain a starter and a separate potential continuation after supported shared-use limits; ${Math.round(P("brick") * 100)}% have no recognized starter and little interaction. This does not prove a legal combo through an interruption.`,
    outcomes: Object.keys(LABEL).map((k) => ({ label: LABEL[k], p: P(k), kind: k })),
    metrics: [
      { label: "Starter + separate potential continuation", value: P("full") + P("through1"), pct: true, good: 0.65 },
      { label: "Starter, continuation and interaction", value: P("full"), pct: true, good: 0.45 },
      { label: "Bricks", value: P("brick"), pct: true, bad: true, good: 0.08 },
    ],
    winCon: bosses.length ? `Ends on its Extra Deck: ${bosses.map((b) => `${b.name}${b.atk ? ` (${b.atk} ATK)` : ""}`).join(", ")}.` : beaters.length ? `Wins through big Main Deck monsters: ${names(beaters)}.` : "No Extra Deck boss and no big beaters: it's unclear how this list closes a game.",
    endgame: extra.length ? "Listed Extra Deck options need their actual materials and summon conditions; size alone does not establish follow-up plays." : "No Extra Deck options are listed; a Main Deck plan may still be valid.",
    samples: show.map((s) => ({ title: LABEL[s.kind], hand: s.h.map((c) => c.name), log: plan(s).map((text, i) => ({ t: i + 1, text })) })),
    speed: Math.max(0, Math.min(1, (P("full") + P("through1")) / 0.65)),
  };
}
