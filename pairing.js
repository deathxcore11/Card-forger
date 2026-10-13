// Pairing: which cards go well with a card, and why.
//
// 1. Tags — every card *provides* things (an artifact, a token, a Tuner, a Fire Pokémon, an
//    Evolution) and *needs* things (rewards for artifacts, a Tuner for its Synchro, evolved
//    Pokémon to devolve). Both come from the card's rules text, types and stats.
// 2. Candidates — gathered per game from searches built from those tags (Scryfall queries,
//    the archetype / race / attribute, the evolution line), plus cards tournament lists run with it.
// 3. Score — for each candidate:
//      3 × (what the card needs that the candidate provides)
//    + 2 × (what the candidate needs that the card provides)
//    + 4 same archetype / evolution line + 2 named in the card's text
//    + tournament lift (how much more often they appear together than apart)
//    + popularity (EDHREC rank or meta play rate) + 0.75 if you own it.
//    Every point comes with a reason, so the list explains itself.

export const TAG_LABEL = {
  artifact: "artifacts", enchantment: "enchantments", token: "tokens", counters: "+1/+1 counters", spell: "cheap instants & sorceries",
  discard: "discarding", mill: "a stocked graveyard", lifegain: "life gain", sac_outlet: "a sacrifice outlet", fodder: "creatures to sacrifice",
  etb: "enters effects", blink: "flicker", extra_land: "extra land drops", evasive: "evasive creatures", ramp: "extra mana", big: "big spells",
  tuner: "Tuner", evolution: "Evolution Pokémon", basic: "Basic Pokémon", stage2: "Stage 2 Pokémon", supporter: "Supporters", rulebox: "Pokémon ex / V",
  tool: "Pokémon Tools", special_energy: "Special Energy", stadium: "Stadiums", ability: "Pokémon with Abilities", fossil: "Fossils", ritualspell: "a Ritual Spell", fusionspell: "a Fusion Spell", evolve_trigger: "evolve-trigger Abilities", switching: "switching", energy_accel: "Energy acceleration", searcher: "deck search",
};

const set = (...xs) => new Set(xs.filter(Boolean));
const words = (s) => String(s || "").toLowerCase();

/* ---------- Magic ---------- */

// Creature subtypes after the dash: "Creature — Human Artificer" → Human, Artificer.
const creatureTypes = (type) => (/Creature|Tribal|Kindred/.test(type) ? (type.split("—")[1] || "").trim().split(/\s+/).filter(Boolean) : []);
const NOT_TYPES = new Set(["Each", "Other", "Target", "Nontoken", "Token", "Legendary", "Attacking", "Blocking", "Creature", "Noncreature", "Artifact", "Enchantment", "Instant", "Sorcery", "Land", "Planeswalker", "Return", "Exile", "Destroy", "When", "Whenever", "All", "Tapped", "Untapped", "Your", "Their", "Choose", "Put", "Copy", "Cast", "Search", "Draw", "Discard", "Create", "Sacrifice", "This", "That", "Those", "These", "Another", "Up", "Any", "Basic", "Snow", "Equipped", "Enchanted", "Commander", "Historic", "Permanent", "Spell", "Card", "Colorless", "White", "Blue", "Black", "Red", "Green", "Multicolored", "Monocolored"]);
export function mtgTags(c) {
  const faces = c?.card_faces?.length ? c.card_faces : [c || {}],
    t = words(faces.map((f) => f.oracle_text || "").join("\n")),
    type = faces.map((f) => f.type_line || "").join(" ") || c?.type_line || "",
    kw = new Set(c?.keywords || []),
    creature = /Creature/.test(type);
  const provides = set(
    (/Artifact/.test(type) || /create[^.]*(treasure|clue|food|blood|map|powerstone|artifact)/.test(t)) && "artifact",
    /Enchantment/.test(type) && "enchantment",
    /create[^.]*token/.test(t) && "token",
    /create[^.]*creature token/.test(t) && "fodder",
    /put[^.]*\+1\/\+1 counter/.test(t) && "counters",
    /Instant|Sorcery/.test(type) && (Number(c?.cmc) || 0) <= 2 && "spell",
    /discard a card/.test(t) && /draw/.test(t) && "discard",
    /\bmill|surveil|into your graveyard/.test(t) && "mill",
    (/gain \d+ life/.test(t) || kw.has("Lifelink")) && "lifegain",
    /sacrifice (a|another) (creature|artifact|permanent)[^.]*:/.test(t) && "sac_outlet",
    creature && /when [^.]* enters/.test(t) && "etb",
    /exile[^.]*return[^.]*to the battlefield/.test(t) && "blink",
    /play an additional land|search your library for[^.]*land[^.]*onto the battlefield/.test(t) && "extra_land",
    creature && ["Flying", "Hexproof", "Menace", "Shroud"].some((k) => kw.has(k)) && "evasive",
    /add \{/.test(t) && !/Land/.test(type) && "ramp",
    (Number(c?.cmc) >= 6 || /\{x\}/.test(words(c?.mana_cost))) && "big",
    ...creatureTypes(type).map((s) => "sub:" + s),
  );
  const needs = set(
    /whenever (an|another) artifact[^.]*enters|for each artifact|artifacts? you control|affinity for artifacts|improvise|metalcraft/.test(t) && "artifact",
    /whenever you cast an enchantment|constellation|enchantments? you control/.test(t) && "enchantment",
    /creature tokens? you control|whenever (a|one or more) (creature )?tokens?|creatures you control get \+/.test(t) && "token",
    /with a \+1\/\+1 counter|for each \+1\/\+1 counter|proliferate/.test(t) && "counters",
    /whenever you cast an? (instant|sorcery|noncreature)|prowess|magecraft/.test(t) && "spell",
    (kw.has("Madness") || kw.has("Flashback") || /whenever you discard/.test(t)) && "discard",
    /from your graveyard|delirium|threshold|escape/.test(t) && "mill",
    /whenever you gain life/.test(t) && "lifegain",
    /whenever (a|another) creature (you control )?dies/.test(t) && "sac_outlet",
    /whenever (a|another) creature (you control )?dies|sacrifice (a|another) creature/.test(t) && "fodder",
    /exile[^.]*return[^.]*to the battlefield/.test(t) && "etb",
    /landfall|whenever a land[^.]*enters/.test(t) && "extra_land",
    /equipped creature|enchant creature/.test(t) && "evasive",
    Number(c?.cmc) >= 6 && "ramp",
    // Tribal payoffs: "other Elves you control", "Human spells".
    ...[...new Set([...(faces.map((f) => f.oracle_text || "").join(" ").matchAll(/\b([A-Z][a-z]+?)s? (?:you control|creatures?|spells?|cards?)\b/g))].map((m) => m[1]))].filter((s) => s.length > 2 && !NOT_TYPES.has(s)).map((s) => "sub:" + s),
  );
  return { provides, needs };
}

export const MTG_PROVIDE_Q = {
  artifact: '(o:"create a treasure" or o:"create a clue" or o:"create a food" or (t:artifact cmc<=2))',
  enchantment: "t:enchantment cmc<=2", token: 'o:create o:"creature token"', fodder: 'o:create o:"creature token"',
  counters: 'o:put o:"+1/+1 counter"', spell: "(t:instant or t:sorcery) cmc<=2 (o:draw or o:damage)", discard: 'o:"discard a card" o:draw',
  mill: "(o:mill or o:surveil)", lifegain: '(keyword:lifelink or o:"gain 3 life")', sac_outlet: 'o:"sacrifice a creature:"',
  etb: 't:creature o:"when" o:"enters"', blink: 'o:exile o:return o:"to the battlefield"', extra_land: '(o:"play an additional land" or (o:"search your library for a basic land" o:battlefield))',
  evasive: "t:creature (keyword:flying or keyword:hexproof) cmc<=3", ramp: '(o:"add {" or o:"search your library for a basic land") cmc<=3 -t:land',
};
export const MTG_NEED_Q = {
  artifact: '(o:"whenever an artifact you control enters" or o:"for each artifact you control")', enchantment: 'o:"whenever you cast an enchantment"',
  token: 'o:"creatures you control get +1/+1"', fodder: 'o:"sacrifice a creature"', counters: '(o:"for each +1/+1 counter" or keyword:proliferate)',
  spell: '(o:"whenever you cast an instant or sorcery" or keyword:prowess or keyword:magecraft)', discard: '(keyword:madness or keyword:flashback or o:"whenever you discard")',
  mill: "(o:delirium or o:threshold or keyword:escape)", lifegain: 'o:"whenever you gain life"', sac_outlet: 'o:"whenever another creature you control dies"',
  etb: 'o:exile o:return o:"to the battlefield"', extra_land: '(keyword:landfall or o:"whenever a land you control enters")', evasive: "(t:equipment or (t:aura o:\"enchant creature\"))",
  ramp: '(cmc>=6 or o:"{X}") -t:land', big: '(o:"add {" or o:"search your library for a basic land") cmc<=3 -t:land',
};
// Up to three Scryfall searches: cards that give it what it needs, then payoffs for what it provides.
export function mtgPairQueries(c, tags = mtgTags(c), max = 4) {
  const id = (c.color_identity || []).join("") || "c",
    tail = ` id<=${id} -!"${String(c.name).split(" // ")[0]}" -t:basic`,
    out = [];
  for (const n of tags.needs) {
    if (MTG_PROVIDE_Q[n]) out.push({ tag: n, side: "needs", q: MTG_PROVIDE_Q[n] + tail });
    else if (n.startsWith("sub:")) out.push({ tag: n, side: "needs", q: `t:"${n.slice(4)}"` + tail });
  }
  for (const p of tags.provides) if (MTG_NEED_Q[p] && !["big", "ramp", "evasive", "etb"].includes(p)) out.push({ tag: p, side: "provides", q: MTG_NEED_Q[p] + tail });
  // Payoffs for its creature type ("other Elves you control get +1/+1").
  const sub = [...tags.provides].find((p) => p.startsWith("sub:"));
  if (sub) out.push({ tag: sub, side: "provides", q: `(o:"${sub.slice(4)}s you control" or o:"other ${sub.slice(4)}" or o:"${sub.slice(4)} spells" or o:"${sub.slice(4)} creatures")` + tail });
  return out.slice(0, max);
}

/* ---------- Yu-Gi-Oh! ---------- */

const ATTRS = ["LIGHT", "DARK", "WATER", "FIRE", "EARTH", "WIND", "DIVINE"];
const RACES = ["Spellcaster", "Dragon", "Zombie", "Warrior", "Beast-Warrior", "Beast", "Winged Beast", "Fiend", "Fairy", "Insect", "Dinosaur", "Reptile", "Fish", "Sea Serpent", "Aqua", "Pyro", "Thunder", "Rock", "Plant", "Machine", "Psychic", "Wyrm", "Cyberse", "Illusion", "Divine-Beast"];
const frameOf = (c) => ((c?.typeLine || "").match(/Ritual|Fusion|Synchro|Xyz|Link|Pendulum|Flip|Spirit|Gemini|Toon|Union|Normal/i) || [""])[0].toLowerCase();
export function ygoTags(c) {
  const text = String(c?.text || ""),
    quoted = [...text.matchAll(/"([^"]{3,40})"/g)].map((m) => m[1]).filter((q) => q !== c?.name);
  const provides = set(
    c?.category === "Monster" && c.attribute && "attr:" + c.attribute,
    c?.category === "Monster" && c.race && "race:" + c.race,
    /tuner/i.test(c?.typeLine || "") && "tuner",
    c?.archetype && "arch:" + c.archetype,
    c?.category !== "Monster" && c?.category && "kind:" + c.category,
    // Mechanics from the card frame.
    c?.category === "Monster" && frameOf(c) && "frame:" + frameOf(c),
    c?.category === "Monster" && !c.extra && Number(c.level) && "level:" + Number(c.level),
    /Ritual Spell/.test(c?.typeLine || "") && "ritualspell",
    c?.category === "Spell" && /Fusion Summon/.test(text) && "fusionspell",
  );
  const needs = set(
    ...ATTRS.filter((a) => new RegExp(`\\b${a}\\b`).test(text) && a !== c?.attribute).map((a) => "attr:" + a),
    ...RACES.filter((r) => new RegExp(`\\b${r}\\b`).test(text) && r !== c?.race).map((r) => "race:" + r),
    /\bTuner\b/.test(text) && !/tuner/i.test(c?.typeLine || "") && "tuner",
    ...quoted.map((q) => "named:" + q),
    frameOf(c) === "ritual" && "ritualspell",
    frameOf(c) === "fusion" && "fusionspell",
    frameOf(c) === "synchro" && "tuner",
    frameOf(c) === "xyz" && Number(c.level) && "level:" + Number(c.level),
    /Ritual Spell/.test(c?.typeLine || "") && "frame:ritual",
    c?.category === "Spell" && /Fusion Summon/.test(text) && "frame:fusion",
    /\bNormal Monsters?\b/.test(text) && "frame:normal",
    /\bToon\b/.test(text) && frameOf(c) !== "toon" && "frame:toon",
    /\bGemini\b/.test(text) && frameOf(c) !== "gemini" && "frame:gemini",
    /\bPendulum\b/.test(text) && frameOf(c) !== "pendulum" && "frame:pendulum",
    /\bFLIP\b/.test(text) && c?.category !== "Monster" && "frame:flip",
  );
  return { provides, needs, quoted };
}

/* ---------- Pokémon ---------- */

const PK_TYPES = ["Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Dragon", "Fairy", "Colorless"];
const isBasicEnergy = (c) => c?.basicEnergy || /^(Basic )?(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$/.test(c?.name || "");
const ownerOf = (name) => String(name || "").match(/^([A-Z][\w.]+(?: [A-Z][\w.]+)?)'s /)?.[1] || "";
export function ptcgTags(c) {
  const all = [c?.effect, ...(c?.abilities || []).map((a) => a.effect), ...(c?.attacks || []).map((a) => a.effect)].join("\n"),
    t = words(all),
    trainer = String(c?.typeLine || "").match(/Supporter|Item|Stadium|Tool/i)?.[0] || "";
  const provides = set(
    // A Pokémon's own type is a weak hint (see rankPairs); Energy cards provide the type.
    ...(c?.category === "Pokemon" ? (c.types || []).map((x) => "ptype:" + x) : (c?.types || []).map((x) => "type:" + x)),
    c?.category === "Energy" && isBasicEnergy(c) && "type:" + /^(?:Basic )?(\w+) Energy$/.exec(c.name)[1],
    /Stage[12]/.test(c?.stage || "") && "evolution",
    c?.stage === "Stage2" && "stage2",
    c?.category === "Pokemon" && c?.stage === "Basic" && "basic",
    /\b(ex|EX|GX|V|VMAX|VSTAR)\b/.test(c?.name || "") && "rulebox",
    trainer === "Supporter" && "supporter",
    trainer === "Tool" && "tool",
    /when you play this pokémon from your hand to evolve/.test(t) && "evolve_trigger",
    // Switching your own Pokémon (not gusting the opponent's).
    c?.category === "Trainer" && /switch (your active|this pokémon|out your)|your active pokémon with 1 of your benched|switch it with 1 of your benched/.test(t) && "switching",
    /attach[^.]*energy[^.]*from your (deck|discard|hand)/.test(t) && "energy_accel",
    /search your deck/.test(t) && "searcher",
    c?.name && "name:" + c.name,
    c?.category === "Energy" && !isBasicEnergy(c) && "special_energy",
    /Stadium/.test(c?.typeLine || "") && "stadium",
    c?.category === "Pokemon" && (c.abilities || []).length && "ability",
    /fossil/i.test(c?.name || "") && "fossil",
    // Named groups: "Team Rocket's …", "Misty's …".
    ownerOf(c?.name) && "group:" + ownerOf(c.name),
  );
  const needs = set(
    ...PK_TYPES.filter((x) => new RegExp(`\\b${x} Energy`).test(all) && !(c?.types || []).includes(x)).map((x) => "type:" + x),
    ...(c?.category !== "Pokemon" ? PK_TYPES.filter((x) => new RegExp(`\\b${x} Pokémon`).test(all)).map((x) => "ptype:" + x) : []),
    ...(c?.category === "Pokemon" ? (c.attacks || []).flatMap((a) => a.cost || []).filter((x) => x !== "Colorless").map((x) => "type:" + x) : []),
    /devolve|evolved pokémon|evolution pokémon/.test(t) && "evolution",
    /devolve/.test(t) && "evolve_trigger",
    /stage 2/.test(t) && "stage2",
    /basic pokémon/.test(t) && c?.category === "Trainer" && "basic",
    /supporter card/.test(t) && "supporter",
    /pokémon (ex|v)\b|rule box/.test(t) && "rulebox",
    /pokémon tool/.test(t) && c?.category !== "Trainer" && "tool",
    c?.category === "Pokemon" && Number(c.retreat) >= 3 && "switching",
    c?.category === "Pokemon" && (c.attacks || []).some((a) => (a.cost || []).length >= 3) && "energy_accel",
    c?.evolveFrom && "name:" + c.evolveFrom,
    /special energy/.test(t) && "special_energy",
    /stadium/.test(t) && !/Stadium/.test(c?.typeLine || "") && "stadium",
    /pokémon (with|that has) an ability/.test(t) && "ability",
    /\bfossil\b/.test(t) && "fossil",
    ...[...all.matchAll(/\b([A-Z][\w.]+(?: [A-Z][\w.]+)?)'s Pokémon\b/g)].map((m) => "group:" + m[1]),
  );
  return { provides, needs };
}

/* ---------- Scoring ---------- */

// Broad categories (any Evolution Pokémon, any DARK monster, any Basic) are real but loose links:
// they score 1 and land in the "Also works with" tier unless something specific links the cards.
const WEAK = (n) => /^(evolution|basic|ptype:|attr:|race:|level:|fusionspell|frame:(fusion|normal|pendulum|flip))/.test(n);

const textOf = (game, c) =>
  (game === "mtg" ? (c?.card_faces?.length ? c.card_faces.map((f) => f.oracle_text || "").join("\n") : c?.oracle_text || "") : [c?.effect, ...(c?.abilities || []).map((a) => a.effect), ...(c?.attacks || []).map((a) => a.effect)].join("\n")).toLowerCase();

export const tagsFor = (game, c) => (game === "mtg" ? mtgTags(c) : game === "ygo" ? ygoTags(c) : ptcgTags(c));
const label = (tag) => {
  const [k, v] = tag.split(":");
  if (v) return k === "frame" ? `${v[0].toUpperCase() + v.slice(1)} monsters` : k === "level" ? `Level ${v} monsters` : k === "group" ? `${v}'s cards` : k === "ptype" ? `${v} Pokémon` : k === "sub" ? `${v} creatures` : k === "attr" ? `${v} monsters` : k === "race" ? `${v} monsters` : k === "type" ? `${v} type` : k === "arch" ? `“${v}”` : k === "named" ? `“${v}”` : k === "name" ? v : v;
  return TAG_LABEL[tag] || tag;
};

/**
 * target: the card. cands: [{ card, lift?: points, pop?: 0–2, owned?: bool, source? }]
 * Returns the best `max`, each with { card, score, reasons[] }.
 */
export function rankPairs(game, target, cands, { max = 9, tagsFn = tagsFor } = {}) {
  const T = tagsFn(game, target),
    tName = String(target?.name || ""),
    seen = new Set(),
    out = [];
  for (const x of cands) {
    const c = x.card;
    if (!c?.name || c.name === tName || seen.has(c.name)) continue;
    seen.add(c.name);
    const C = tagsFn(game, c),
      reasons = [];
    let score = 0;
    const gives = [...T.needs].filter((n) => C.provides.has(n) || (n.startsWith("named:") && (c.name.includes(n.slice(6)) || c.archetype === n.slice(6))));
    const uses = [...C.needs].filter((n) => T.provides.has(n) || (n.startsWith("named:") && (tName.includes(n.slice(6)) || target.archetype === n.slice(6))));
    for (const n of gives) {
      score += WEAK(n) ? 1 : n.startsWith("named:") ? 2 + 3 : n.startsWith("name:") ? 4 + 3 : 3;
      reasons.push(n.startsWith("name:") ? `evolution line — it evolves from ${n.slice(5)}` : n.startsWith("named:") ? `named in its text` : n.startsWith("type:") ? `${n.slice(5)} Energy for its attacks` : `gives it ${label(n)}`);
    }
    for (const n of uses) {
      score += WEAK(n) ? 1 : n.startsWith("name:") ? 4 + 2 : n.startsWith("named:") ? 2 + 2 : 2;
      reasons.push(n.startsWith("name:") ? `evolution line — evolves from it` : n.startsWith("named:") ? `its text names this card` : `uses its ${label(n)}`);
    }
    // Cards that name each other in their rules text belong together.
    if (game !== "ygo") {
      const tt = textOf(game, target),
        ct = textOf(game, c),
        base = (n) => String(n).split(" // ")[0].replace(/ (ex|V|VMAX|VSTAR|GX)$/, "");
      if (ct.includes(base(tName).toLowerCase()) && base(tName).length > 3) {
        score += 4;
        reasons.push("its text names this card");
      } else if (tt.includes(base(c.name).toLowerCase()) && base(c.name).length > 3) {
        score += 4;
        reasons.push("named in its text");
      }
    } else if (T.quoted?.includes(c.name)) score += 3;
    if (game === "ptcg" && ownerOf(tName) && ownerOf(tName) === ownerOf(c.name)) {
      score += 3;
      reasons.push(`both ${ownerOf(tName)}'s cards`);
    }
    if (game === "ptcg" && target.category === "Pokemon" && c.category === "Pokemon" && (c.types || []).some((x) => (target.types || []).includes(x))) {
      score += 1;
      reasons.push(`same type (${(c.types || []).find((x) => (target.types || []).includes(x))})`);
    }
    if (game === "ygo" && target.archetype && c.archetype === target.archetype) {
      score += 4;
      reasons.push(`same archetype (${target.archetype})`);
    }
    if (x.line && !reasons.some((r) => /evolution line/.test(r))) {
      score += 5;
      reasons.push("evolution line");
    }
    if (x.why) reasons.push(x.why);
    if (x.lift) {
      score += Math.min(7, x.lift / 10);
      reasons.push(`played with it in tournaments (${Math.round(x.share)}% of its lists)`);
    }
    if (x.pop) score += x.pop;
    if (x.owned) {
      score += 0.75;
      reasons.push("you own it");
    }
    // A card needs a real link — a fit, the archetype or tournament pairing. Popularity and
    // ownership only break ties between linked cards.
    const strong = [...gives, ...uses].some((n) => !WEAK(n)),
      weakOnly = !strong && (gives.length || uses.length);
    const linked = strong || weakOnly || x.line || x.fallback || reasons.some((r) => /names|named|^both /.test(r)) || (game === "ygo" && target.archetype && c.archetype === target.archetype) || x.lift >= 5;
    if (!linked || (score < 2 && !x.fallback && !weakOnly)) continue;
    out.push({ card: c, score: Math.round(score * 10) / 10, reasons, source: x.source || "", fallback: !strong && !x.line && !(x.lift >= 5) && !reasons.some((r) => /names|named|archetype|^both /.test(r)) && (!!x.fallback || !!weakOnly), loose: !!weakOnly && !x.fallback });
  }
  // Real links first, then labeled fallbacks.
  // At most five loose links, so labeled staples still get room.
  let loose = 0;
  return out
    .sort((a, b) => a.fallback - b.fallback || b.score - a.score)
    .filter((p) => !(p.fallback && p.loose) || ++loose <= 5)
    .slice(0, max);
}

// EDHREC rank → 0–2 popularity points (rank 1 ≈ 2, rank 10,000 ≈ 0.4).
export const edhPop = (rank) => (rank ? Math.max(0, Math.min(2, 2 - Math.log10(rank) / 2.5)) : 0);
