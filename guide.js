// Play guide for any card: what it does, when to play it, what it works with, and cards that pair
// well. Built from the card's own rules text and stats (all three games) plus the tournament lists
// CardStashy has cached — a starting point for new players, not expert strategy.

import { FORMATS } from "./formats.js";
import { PTCG_FORMATS, ptcgLegality } from "./ptcg.js";
import { YGO_FORMATS, ygoLimit, ygoLegality } from "./ygo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nameKey = (n) => String(n || "").split(" // ")[0].toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
const BASIC = /^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$|^(?:basic )?(?:grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy) energy$/i;

/* ---------- Magic ---------- */

// [id, test(text, card), label, what it means, when to use it, synergy note, Scryfall query for cards that feed it]
const MTG_RULES = [
  ["counter", /counter target (spell|activated|ability)/, "Counterspell", "Stops a spell or ability before it resolves.", "Keep mana open on your opponent's turn and save it for the spell that would beat you — a sweeper, a bomb or a combo piece. If they play around it, use your mana at the end of their turn instead.", "", ""],
  ["wipe", /(destroy|exile) all|deals \d+ damage to each (creature|player)|all creatures get -/, "Board wipe", "Clears many creatures at once.", "Wait until your opponent has committed more to the board than you have. Hold back your own creatures the turn before you cast it.", "Pairs with indestructible or hexproof creatures, planeswalkers, and cards that return creatures afterward.", "o:indestructible t:creature"],
  ["removal", /(destroy|exile) target (creature|permanent|artifact|enchantment|planeswalker|nonland)|deals \d+ damage to (any target|target creature)|target creature gets -\d+\/-\d+|fights? (another )?target/, "Removal", "Answers one threat.", "Save it for the threat that matters most — a creature that wins games, draws cards or makes combos work — rather than the first thing you see.", "", ""],
  ["tutor", /search your library for an? (?!basic land|land)[^.]*card/, "Tutor", "Finds a specific card from your deck.", "Fetch whatever solves your current problem: removal when behind, a finisher when ahead, a combo piece when you can win.", "Best with a few powerful cards worth finding.", ""],
  ["ramp", /add \{|search your library for (a|up to \w+) (basic )?lands?|put (a|up to \w+) lands? card|additional land/, "Ramp", "Gives you more mana sooner.", "Play it early (turns 1–3) so you can cast your expensive cards a turn or two ahead of schedule.", "Pairs with expensive spells and cards with big mana costs or X costs.", "(cmc>=6 or o:\"{X}\") -t:land"],
  ["loot", /discard a card[^.]*\. if you do, draw|draw a card, then discard|draw (two|three) cards, then discard/, "Card filtering", "Swaps cards you don't need for new ones.", "Discard extra lands late in the game and keep lands early. It also fills your graveyard on purpose.", "Pairs with madness, flashback and graveyard cards — what you discard can still be used.", "(keyword:madness or keyword:flashback or o:\"from your graveyard\")"],
  ["draw", /draws? (a|two|three|\w+) cards?/, "Card draw", "Gets you more cards.", "Use it when the board is stable or at the end of your opponent's turn, so you don't fall behind on board.", "", ""],
  ["tokens", /create[^.]*token/, "Token maker", "Makes extra creatures or objects.", "Tokens are great for blocking, sacrificing and going wide. Play it before a turn you plan to attack with everything.", "Pairs with anthems (\"creatures you control get +1/+1\") and token doublers.", "(o:\"creatures you control get +\" or o:\"twice that many\")"],
  ["counters", /\+1\/\+1 counter/, "+1/+1 counters", "Grows creatures permanently.", "Put counters on evasive or hard-to-kill creatures so they keep their value.", "Pairs with proliferate and counter doublers.", "(keyword:proliferate or o:\"additional +1/+1 counter\")"],
  ["aristocrats", /whenever (a|another) creature (you control )?dies|sacrifice (a|another) creature/, "Sacrifice & death", "Gets value when creatures die.", "Sacrifice creatures that are about to die anyway — blocked, targeted by removal, or tokens.", "Pairs with token makers and other sacrifice outlets.", "(o:\"sacrifice a creature:\" or (o:create o:token t:creature))"],
  ["artifacts", /whenever (an|another) artifact[^.]*enters|artifacts? you control|for each artifact/, "Artifacts", "Rewards you for having artifacts.", "Play it first, then the artifacts — each one that enters afterward adds value. Cheap artifacts and Treasure/Clue/Food tokens count.", "Pairs with cards that make Treasure, Clues or Food and with cheap artifacts.", "(o:\"create a treasure\" or o:\"create a clue\" or o:\"create a food\" or (t:artifact cmc<=1))"],
  ["enchantments", /whenever you cast an enchantment|enchantments? you control|constellation/, "Enchantments", "Rewards you for enchantments.", "Play it before your other enchantments so each one adds value.", "Pairs with cheap enchantments and Auras.", "t:enchantment cmc<=2"],
  ["spells", /whenever you cast an? (instant|sorcery|noncreature)|instant (and|or) sorcery (cards|spells)|prowess|magecraft/, "Spells matter", "Rewards casting instants and sorceries.", "Play it first, then chain cheap spells in the same turn for the most value.", "Pairs with cheap instants and sorceries, especially ones that draw cards.", "(t:instant or t:sorcery) cmc<=2 (o:draw or o:damage)"],
  ["landfall", /land[^.]* enters the battlefield under your control|landfall|whenever a land you control enters/, "Landfall", "Triggers whenever a land enters.", "Hold land drops until after it's on the battlefield. Fetch lands give two triggers.", "Pairs with extra land drops and land-search cards.", "(o:\"play an additional land\" or (o:\"search your library for\" o:land t:land))"],
  ["graveyard", /from your graveyard|mill|cards? in your graveyard/, "Graveyard", "Uses cards from your graveyard.", "Fill the graveyard first with milling, looting or trades, then cash in later.", "Pairs with self-mill and discard effects.", "(o:\"mill\" or o:\"surveil\") -t:land"],
  ["lifegain", /whenever you gain life|gain \d+ life|lifelink/, "Life gain", "Gains life or rewards gaining it.", "Life buys time against aggressive decks. Rewards for gaining life stack up across many small gains.", "Pairs with lifelink creatures and \"whenever you gain life\" payoffs.", "(o:\"whenever you gain life\" or keyword:lifelink)"],
  ["etb", /when [^.]* enters/, "Enters effect", "Does something when it enters.", "Get the effect again by flickering it (exile and return) or returning it to your hand.", "Pairs with blink and bounce effects.", "(o:\"exile\" o:\"return\" o:\"to the battlefield\" (t:instant or t:creature))"],
  ["equip", /equipped creature|equip \{/, "Equipment", "Makes a creature stronger.", "Put it on evasive or hard-to-kill creatures. It stays when the creature dies.", "Pairs with flying or hexproof creatures.", "(keyword:flying or keyword:hexproof) t:creature cmc<=3"],
  ["aura", /enchant creature/, "Aura", "Boosts or controls one creature.", "Put it on a creature with hexproof or ward if you can — if the creature dies, the Aura goes too.", "Pairs with hexproof creatures and enchantment rewards.", "keyword:hexproof t:creature"],
  ["protect", /(hexproof|indestructible|protection from)[^.]*until end of turn|gains? (hexproof|indestructible)/, "Protection", "Saves your creatures.", "Hold it until your opponent targets your best creature or casts a board wipe.", "", ""],
  ["trick", /^(?=[\s\S]*instant)[\s\S]*target creature (you control )?gets \+\d/, "Combat trick", "A surprise boost during combat.", "Cast it after blockers are declared so your opponent can't react.", "", ""],
];
const MTG_KEYWORDS = {
  Flying: "Flying — only creatures with flying or reach can block it, so it's a reliable attacker.",
  Haste: "Haste — it can attack the turn you play it. Cast it before combat.",
  Flash: "Flash — you can cast it at instant speed. Wait for your opponent's end of turn, or ambush an attacker.",
  Vigilance: "Vigilance — it attacks without tapping, so it can still block next turn.",
  Deathtouch: "Deathtouch — any damage it deals kills a creature. A great blocker.",
  Lifelink: "Lifelink — damage it deals also gains you that much life.",
  Trample: "Trample — extra damage beyond what blockers absorb goes through to the player.",
  "First strike": "First strike — it deals combat damage before creatures without it.",
  "Double strike": "Double strike — it deals combat damage twice. Pump effects count double.",
  Hexproof: "Hexproof — your opponent can't target it, which makes it a safe home for Auras and Equipment.",
  Ward: "Ward — spells targeting it cost more, so it's harder to remove.",
  Indestructible: "Indestructible — damage and \"destroy\" effects can't kill it; exile still can.",
  Menace: "Menace — it can only be blocked by two or more creatures.",
  Reach: "Reach — it can block fliers.",
  Cascade: "Cascade — casting it casts a cheaper spell from your deck for free.",
  Flashback: "Flashback — you can cast it again from your graveyard.",
};

function mtgGuide(c) {
  const faces = c.card_faces?.length ? c.card_faces : [c],
    text = faces.map((f) => f.oracle_text || "").join("\n").toLowerCase(),
    type = faces.map((f) => f.type_line || "").join(" // ") || c.type_line || "",
    cmc = Number(c.cmc) || 0,
    power = Number(faces[0]?.power) || 0;
  let roles = MTG_RULES.filter(([, re]) => re.test(text)).map(([id, , label, what, when, syn, query]) => ({ id, label, what, when, syn, query }));
  // Looting already covers drawing; a wipe already covers removal.
  if (roles.some((r) => r.id === "loot")) roles = roles.filter((r) => r.id !== "draw");
  if (roles.some((r) => r.id === "wipe")) roles = roles.filter((r) => r.id !== "removal");
  const tips = [];
  if (/Creature/.test(type)) {
    if (cmc <= 2) tips.push("A cheap creature — play it early to start pressuring or to have a blocker.");
    else if (power >= 5 || cmc >= 6) tips.push("A big threat — play it when the board is clear or your opponent is low on answers.");
  }
  if (/Land/.test(type) && !roles.length) tips.push("A land — play one land each turn; it's what lets you cast everything else.");
  if (/Legendary/.test(type) && /Creature/.test(type)) tips.push("Legendary creature — you can also build a Commander deck around it.");
  if (/Planeswalker/.test(type)) tips.push("Planeswalker — use an ability each turn; protect it from attacks with your creatures.");
  for (const k of c.keywords || []) if (MTG_KEYWORDS[k]) tips.push(MTG_KEYWORDS[k]);
  const kind = /Instant/.test(type) ? "instant" : /Sorcery/.test(type) ? "sorcery" : /Creature/.test(type) ? "creature" : /Land/.test(type) ? "land" : /Artifact/.test(type) ? "artifact" : /Enchantment/.test(type) ? "enchantment" : /Planeswalker/.test(type) ? "planeswalker" : "card";
  const timing = kind === "instant" ? "Instant: cast it any time, even on your opponent's turn." : kind === "sorcery" ? "Sorcery: cast it on your own turn when nothing else is happening." : kind === "land" ? "" : `Costs ${cmc} mana — usually played around turn ${Math.max(1, Math.min(7, Math.round(cmc)))}.`;
  return { roles, tips: [timing, ...tips].filter(Boolean), kind };
}

/* ---------- Yu-Gi-Oh! ---------- */

const YGO_RULES = [
  ["handtrap", /(\(quick effect\)|during either player's turn)[^.]*discard this card|you can discard this card[^.]*;|from your hand[^.]*\(quick effect\)/, "Hand trap", "Activated from your hand on your opponent's turn.", "Keep it in hand and wait: use it on your opponent's first big searcher or Special Summon so their combo stops early.", "Runs in almost any deck; draw it with card draw rather than searching for it."],
  ["negate", /negate (the|that|its) (activation|effect|summon)|negate the activation/, "Negation", "Stops an effect or summon.", "Save it for the key card of your opponent's turn — usually their first starter or their final boss monster.", ""],
  ["search", /add (1|one|up to \w+)[^.]*from your deck to your hand/, "Searcher / starter", "Adds a card from your Deck to your hand.", "Play it early in your turn — it's often the first card of a combo and makes your hand more consistent.", "Find what it can search and count how many outs you run."],
  ["ss", /special summon (this card|1|up to)/, "Extender", "Special Summons monsters.", "Use it to get material for Synchro, Xyz or Link summons in the same turn.", "Pairs with Extra Deck monsters that need the materials it brings out."],
  ["wipe", /destroy all|banish all|send all/, "Board wipe", "Clears the field.", "Use it when your opponent has more on the field than you, ideally before you set up your own board.", ""],
  ["removal", /(destroy|banish|return)[^.]*(1|one|target|up to \w+)[^.]*(card|monster)[^.]* (your )?opponent|target (1|one) card your opponent controls/, "Removal", "Removes an opponent's card.", "Aim it at the card that stops your plays (a negate or a boss monster) before you start your combo.", ""],
  ["mill", /send[^.]*from your deck to the (gy|graveyard)/, "Deck-to-GY", "Sends cards from your Deck to the GY.", "Choose cards that have effects in the GY, so the send is also a play.", "Pairs with cards that activate from the GY."],
  ["gy", /if this card is (sent|in) (to )?the (gy|graveyard)|banish this card from your (gy|graveyard)/, "GY effect", "Works from the Graveyard too.", "Getting it destroyed or discarded is fine — plan to use its GY effect afterward.", ""],
  ["protect", /cannot be destroyed|unaffected by|cannot be targeted/, "Protection", "Hard to remove.", "A safe place to put your strongest effects or equips.", ""],
  ["draw", /draw (1|2|one|two|\w+) cards?/, "Draw", "Draws cards.", "Use it early to dig for starters and hand traps.", ""],
];
function ygoGuide(c) {
  const text = String(c.text || "").toLowerCase(),
    roles = YGO_RULES.filter(([, re]) => re.test(text)).map(([id, , label, what, when, syn]) => ({ id, label, what, when, syn })),
    tips = [],
    t = String(c.typeLine || "");
  if (c.category === "Monster") {
    if (c.extra) tips.push(`An Extra Deck monster (${t.match(/Fusion|Synchro|Xyz|Link/)?.[0] || "Extra Deck"}) — check its summoning requirements on the card and plan which materials you'll use.`);
    else if (Number(c.level) >= 7) tips.push(`Level ${c.level} — needs two Tributes to Normal Summon, so it usually needs a Special Summon effect.`);
    else if (Number(c.level) >= 5) tips.push(`Level ${c.level} — needs one Tribute to Normal Summon.`);
    if (/tuner/i.test(t)) tips.push("Tuner — combine with non-Tuners to Synchro Summon.");
    if (/pendulum/i.test(t)) tips.push("Pendulum — can be placed in a Pendulum Zone to summon several monsters at once.");
    if (Number(c.atk) >= 2500) tips.push(`${c.atk} ATK — strong enough to beat most monsters in battle.`);
  } else if (c.category === "Spell") {
    tips.push(/quick-play/i.test(t + c.race) ? "Quick-Play Spell — can be used on your opponent's turn if Set first." : /field/i.test(t + c.race) ? "Field Spell — stays out and affects every turn; search it early." : /continuous/i.test(t + c.race) ? "Continuous Spell — keeps working while face-up." : "Spell — play it on your turn, usually before summoning.");
  } else if (c.category === "Trap") {
    tips.push(/counter/i.test(t + c.race) ? "Counter Trap — Set it and respond to your opponent's play." : "Trap — Set it face-down first; it can be activated starting your opponent's next turn.");
  }
  return { roles, tips };
}

/* ---------- Pokémon ---------- */

const PTCG_RULES = [
  ["search", /search your deck for/, "Search", "Finds cards in your deck.", "Use it early to set up your Pokémon and find the pieces of your plan.", ""],
  ["draw", /draw (a card|\d+ cards|cards until)/, "Draw", "Draws cards.", "Use it when your hand is small, before playing other Trainers.", ""],
  ["switch", /switch (your|in|out)|switch it with|to your bench|your active pokémon with 1 of your benched/, "Switching", "Moves Pokémon between Active and Bench.", "Use it to escape a bad matchup or a Special Condition, or to bring your attacker forward.", ""],
  ["accel", /attach[^.]*energy[^.]*from your (deck|discard|hand)|(deck|discard pile) for[^.]*energy[\s\S]*attach/, "Energy acceleration", "Attaches extra Energy.", "Use it on the Pokémon you'll attack with next, so it's ready a turn sooner.", "Pairs with attackers that need a lot of Energy."],
  ["heal", /heal \d+ damage|heal all damage/, "Healing", "Removes damage.", "Heal a Pokémon that's about to be Knocked Out to waste your opponent's attack.", ""],
  ["disrupt", /your opponent (shuffles|discards|reveals)|discard (an|\d+) energy from your opponent|your opponent's active pokémon is now/, "Disruption", "Slows your opponent.", "Use it when your opponent has just set up — it costs them a turn.", ""],
  ["gust", /switch in 1 of your opponent's benched|your opponent switches/, "Gust", "Pulls an opponent's Benched Pokémon forward.", "Use it to Knock Out a key support Pokémon or one about to evolve.", ""],
  ["devolve", /devolve/, "Devolve", "Turns one of your evolved Pokémon back into an earlier stage and returns the Evolution card to your hand.", "Use it to replay an Evolution whose Ability triggers “when you play this Pokémon from your hand to evolve”, or to pull a valuable Evolution card back to hand. Damage counters stay on the Pokémon — if the lower stage has less HP, it can be Knocked Out.", "Pairs with Evolution Pokémon that have evolve-trigger Abilities."],
  ["evolve", /evolves from that pokémon|skipping the stage 1|search your deck for[^.]*evolves from|evolution card/, "Evolution support", "Helps you evolve faster or find Evolution cards.", "Use it on the turn you want your Stage 2 out — usually turn 2 when you're going second.", "Pairs with Stage 2 Pokémon."],
  ["spread", /put \d+ damage counters on[^.]*bench|damage to each of your opponent's/, "Spread damage", "Damages several Pokémon at once.", "Spread damage sets up multiple Knock Outs next turn — aim at Benched Pokémon with low HP.", ""],
  ["recover", /from your discard pile into your hand|shuffle[^.]* from your discard pile into your deck/, "Recovery", "Gets cards back from the discard pile.", "Save it for later in the game when key cards are gone.", ""],
];
function ptcgGuide(c) {
  const text = [c.effect, ...(c.abilities || []).map((a) => a.effect), ...(c.attacks || []).map((a) => a.effect)].join("\n").toLowerCase(),
    roles = PTCG_RULES.filter(([, re]) => re.test(text)).map(([id, , label, what, when, syn]) => ({ id, label, what, when, syn })),
    tips = [],
    t = String(c.typeLine || "");
  if (c.category === "Pokemon") {
    if (/\b(ex|EX|GX|V|VMAX|VSTAR)\b/.test(c.name)) tips.push("Rule Box Pokémon — your opponent takes extra Prize cards when it's Knocked Out, so protect it and don't trade it away cheaply.");
    if (c.stage === "Stage2") tips.push(`Stage 2 — evolves from ${c.evolveFrom || "a Stage 1"}. Rare Candy lets you skip the Stage 1 and evolve straight from the Basic.`);
    else if (c.stage === "Stage1") tips.push(`Stage 1 — evolves from ${c.evolveFrom || "a Basic Pokémon"}; play the Basic first and evolve next turn.`);
    else tips.push("Basic Pokémon — you can put it straight onto your Bench or start with it.");
    if ((c.abilities || []).length) tips.push(`Ability “${c.abilities[0].name}” — works without attacking; most abilities are used on your turn from the Bench too.`);
    const big = [...(c.attacks || [])].sort((a, b) => (b.cost?.length || 0) - (a.cost?.length || 0))[0];
    if (big?.cost?.length) tips.push(`Its biggest attack “${big.name}” needs ${big.cost.length} Energy${big.damage ? ` for ${big.damage} damage` : ""} — plan your attachments a few turns ahead.`);
    if (Number(c.retreat) >= 3) tips.push(`Retreat cost ${c.retreat} — heavy; pair it with switching cards.`);
    else if (c.retreat === 0) tips.push("Free retreat — a good pivot to start Active.");
  } else if (c.category === "Trainer") {
    const kind = (t.match(/Supporter|Item|Stadium|Tool/i) || [""])[0];
    tips.push(kind === "Supporter" ? "Supporter — only one per turn, so pick the one that fits the turn best." : kind === "Stadium" ? "Stadium — stays in play for both players until replaced." : kind === "Tool" ? "Pokémon Tool — attach to a Pokémon; it stays until the Pokémon leaves." : "Item — play as many as you like during your turn.");
  } else if (c.category === "Energy") tips.push(c.basicEnergy ? "Basic Energy — attach one per turn to power attacks." : "Special Energy — has an extra effect; check whether it can be discarded or blocked.");
  return { roles, tips };
}

export function playGuide(game, card) {
  if (!card) return { roles: [], tips: [] };
  return game === "mtg" ? mtgGuide(card) : game === "ygo" ? ygoGuide(card) : ptcgGuide(card);
}

/* ---------- Pairs well: cards seen alongside it in tournament lists ---------- */

// cached: allCachedMeta(); returns [{ name, id?, share, lists }] — the share of lists with this card that also run it.
export function playedAlongside(game, card, cached, max = 8) {
  const k = nameKey(card?.name),
    id = String(card?.id || ""),
    counts = new Map(),
    names = new Map();
  let lists = 0,
    all = 0;
  const overall = new Map();
  for (const [dataKey, entry] of Object.entries(cached || {})) {
    const decks = entry?.data?.decks || [];
    if (game === "mtg" ? !dataKey.startsWith("mtg:") : dataKey !== game) continue;
    for (const d of decks) {
      const cards =
        game === "mtg" ? [...(d.main || []), ...(d.commanders || [])].map((r) => ({ key: nameKey(r.name), name: r.name }))
        : game === "ygo" ? [...(d.main || []), ...(d.extra || [])].map((x) => ({ key: String(x), id: String(x) }))
        : (d.list || []).map((r) => ({ key: nameKey(r.name), name: r.name }));
      all++;
      for (const key of new Set(cards.map((x) => x.key))) overall.set(key, (overall.get(key) || 0) + 1);
      if (!cards.some((x) => x.key === (game === "ygo" ? id : k))) continue;
      lists++;
      for (const x of new Map(cards.map((x) => [x.key, x])).values()) {
        if (x.key === (game === "ygo" ? id : k) || (x.name && BASIC.test(x.name))) continue;
        counts.set(x.key, (counts.get(x.key) || 0) + 1);
        names.set(x.key, x);
      }
    }
  }
  if (!lists) return { lists: 0, cards: [] };
  return {
    lists,
    // Partners first: cards much more common next to this one than in decks overall (lift), so
    // format-wide staples that every deck plays don't crowd out the real combos.
    cards: [...counts]
      .map(([key, n]) => ({ ...names.get(key), share: (n / lists) * 100, overall: ((overall.get(key) || n) / Math.max(1, all)) * 100, n }))
      .filter((x) => x.n >= Math.min(2, lists))
      .sort((a, b) => b.share - b.overall - (a.share - a.overall) || b.share - a.share)
      .slice(0, max),
  };
}

/* ---------- Rules: turn rules for this kind of card, and copies allowed per format ---------- */

const MTG_SHOWN = ["standard", "pioneer", "modern", "legacy", "vintage", "pauper", "commander"];
export function cardRules(game, c) {
  const turn = [],
    limits = [];
  if (game === "mtg") {
    const type = c.type_line || c.card_faces?.[0]?.type_line || "",
      text = (c.oracle_text || c.card_faces?.map((f) => f.oracle_text).join(" ") || "").toLowerCase(),
      basic = /Basic Land/.test(type),
      any = /a deck can have any number of cards named/.test(text),
      upTo = text.match(/a deck can have up to (\w+) cards named/)?.[1];
    if (/Land/.test(type)) turn.push("You can play one land per turn, on your own turn.");
    else if (/Instant/.test(type) || (c.keywords || []).includes("Flash")) turn.push("Instant speed: cast it any time you have priority, including your opponent's turn.");
    else turn.push("Sorcery speed: cast it on your own turn, in a main phase, when nothing else is waiting to resolve.");
    if (/Creature/.test(type) && !(c.keywords || []).includes("Haste")) turn.push("Summoning sickness: it can't attack or use {T} abilities the turn it comes in.");
    if (/Planeswalker/.test(type)) turn.push("Planeswalkers: one loyalty ability per turn, on your turn at sorcery speed.");
    if (/Equipment/.test(type)) turn.push("Equip only at sorcery speed; it stays on the battlefield if the creature leaves.");
    if (/Legendary/.test(type)) turn.push("Legend rule: if you control two with the same name, you keep one.");
    for (const id of MTG_SHOWN) {
      const f = FORMATS.find((x) => x.id === id);
      if (!f) continue;
      const st = c.legalities?.[f.legality];
      if (!st) continue;
      limits.push([f.name, st === "banned" ? "Banned" : st === "not_legal" ? "Not legal" : st === "restricted" ? "1 (restricted)" : basic || any ? "Any number" : upTo ? `Up to ${upTo}` : f.copies === 1 ? "1 (singleton)" : `Up to ${f.copies}`]);
    }
    return { turn, limits, deck: "60-card formats: at least 60 cards, 15-card sideboard. Commander: exactly 100 cards, one of each (basics excepted)." };
  }
  if (game === "ygo") {
    const t = String(c.typeLine || "") + " " + String(c.race || "");
    if (c.category === "Monster") {
      if (c.extra) turn.push("Extra Deck monsters are Special Summoned from the Extra Deck by meeting their requirements (they don't go in your hand).");
      else turn.push("One Normal Summon or Set per turn. Level 5–6 needs 1 Tribute, Level 7+ needs 2. Special Summons don't count toward that limit.");
    } else if (c.category === "Spell") turn.push(/quick-play/i.test(t) ? "Quick-Play Spell: from your hand on your turn, or Set it and use it on either turn (not the turn it was Set)." : /field/i.test(t) ? "Field Spell: one per player; playing a new one replaces yours." : "Spells are activated from your hand during your own Main Phase.");
    else if (c.category === "Trap") turn.push("Traps must be Set first and can be activated from the next turn on (either player's turn), unless the card says otherwise.");
    for (const f of YGO_FORMATS.filter((x) => ["tcg", "ocg", "goat", "md"].includes(x.id))) {
      const leg = ygoLegality(c, f),
        n = ygoLimit(c, f);
      limits.push([f.name, leg === "not_legal" ? "Not in this card pool" : n === 0 ? "Forbidden" : n === 1 ? "1 (Limited)" : n === 2 ? "2 (Semi-Limited)" : "Up to 3"]);
    }
    return { turn, limits, deck: "Main Deck 40–60 cards, Extra Deck and Side Deck up to 15 each; at most 3 copies of a card across all three." };
  }
  const kind = String(c.typeLine || "").match(/Supporter|Item|Stadium|Tool/i)?.[0] || "";
  if (c.category === "Trainer") {
    if (kind === "Supporter") turn.push("Supporter: only one per turn. The player who goes first can't play a Supporter on their first turn.");
    else if (kind === "Stadium") turn.push("Stadium: one per turn, and not one with the same name as the Stadium already in play. It stays until another replaces it.");
    else if (kind === "Tool") turn.push("Pokémon Tool: play as many as you like, but each Pokémon can hold only one Tool.");
    else turn.push("Item: play as many as you like during your turn.");
  } else if (c.category === "Pokemon") {
    turn.push(c.stage === "Basic" ? "Put Basic Pokémon onto your Bench any time on your turn (Bench limit: 5)." : "Evolve on your turn, but not on your first turn or on a Pokémon that came into play this turn — and once per Pokémon per turn.");
    turn.push("Attach one Energy from your hand per turn. Attacking ends your turn; the player going first can't attack on their first turn.");
  } else if (c.category === "Energy") turn.push("You can attach one Energy card from your hand per turn.");
  for (const f of PTCG_FORMATS.filter((x) => x.id !== "unlimited")) {
    const leg = ptcgLegality(c, f);
    limits.push([f.name, leg !== "legal" ? (f.noRuleBox && c.ruleBox ? "Not allowed (Rule Box)" : "Not legal") : c.basicEnergy ? "Any number" : c.aceSpec ? "1 — and only 1 ACE SPEC per deck" : c.radiant ? "1 — and only 1 Radiant per deck" : f.copies === 1 ? "1 (singleton)" : `Up to ${f.copies} with this name`]);
  }
  return { turn, limits, deck: "Exactly 60 cards; at most 4 with the same name (basic Energy unlimited); 1 ACE SPEC and 1 Radiant Pokémon per deck." };
}

/* ---------- Rendering ---------- */

/**
 * opts: { alongside, alongsideAttrs(x), alongsideName(x), complements: [{name, attrs, image}] | null,
 *         complementsLoading, complementsNote, extra }
 */
export function guideHtml(game, card, g, opts = {}) {
  const roleBlock = g.roles.length
    ? `<div class="guide-roles">${g.roles.map((r) => `<span class="chip guide-chip">${esc(r.label)}</span>`).join("")}</div>
      <p class="guide-what">${esc(g.roles.map((r) => r.what).join(" "))}</p>`
    : `<p class="guide-what muted">No special effect detected — judge it by its stats and cost.</p>`;
  const when = [...g.roles.map((r) => r.when), ...g.tips].filter(Boolean);
  const syn = g.roles.map((r) => r.syn).filter(Boolean);
  const al = opts.alongside;
  return `<section class="guide-sec"><h3>What it does</h3>${roleBlock}</section>
  ${when.length ? `<section class="guide-sec"><h3>How and when to play it</h3><ul class="guide-list">${when.slice(0, 7).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : ""}
  ${syn.length ? `<section class="guide-sec"><h3>Synergies</h3><ul class="guide-list">${syn.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : ""}
  ${al?.cards?.length ? `<section class="guide-sec"><h3>Played alongside it <span class="muted small">in ${al.lists} tournament list${al.lists === 1 ? "" : "s"} · partners first</span></h3><div class="list compact">${al.cards.map((x) => `<button class="mini-row" ${opts.alongsideAttrs(x)}><span class="ellip">${esc(opts.alongsideName(x))}</span><span class="small muted">${Math.round(x.share)}% of them${x.overall < x.share - 5 ? ` · ${Math.round(x.overall)}% overall` : ""}</span></button>`).join("")}</div></section>` : ""}
  ${opts.complements !== undefined ? `<section class="guide-sec"><h3>Cards that pair well</h3>${opts.complementsLoading ? `<p class="muted small">Finding cards that work with it…</p>` : opts.complements?.length ? `<div class="pair-list">${opts.complements.map((x) => `<button class="pair-row" ${x.attrs}>${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="pair-noimg"></span>`}<span class="pair-txt"><b>${esc(x.name)}</b>${x.reasons?.length ? `<small>${esc(x.reasons.slice(0, 3).join(" · "))}</small>` : ""}</span>${x.score ? `<span class="pair-score" title="Pairing score">${x.score}</span>` : ""}</button>`).join("")}</div>${opts.complementsNote ? `<p class="foot">${esc(opts.complementsNote)}</p>` : ""}` : `<p class="muted small">${esc(opts.complementsNote || "Nothing specific found.")}</p>`}</section>` : ""}
  ${rulesHtml(opts.rules)}
  ${opts.extra || ""}
  <p class="foot">This guide is generated from the card's rules text, its stats and the tournament lists on this device — a starting point, not expert strategy.</p>`;
}

function rulesHtml(r) {
  if (!r) return "";
  return `<section class="guide-sec"><h3>Rules for this card</h3><ul class="guide-list">${r.turn.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    ${r.limits.length ? `<p class="list-head">Copies allowed per deck</p><div class="guide-limits">${r.limits.map(([f, n]) => `<span><small>${esc(f)}</small><b class="${/Banned|Forbidden|Not/.test(n) ? "bad" : ""}">${esc(n)}</b></span>`).join("")}</div>` : ""}
    <p class="small muted">${esc(r.deck)}</p></section>`;
}

// The Scryfall search for cards that feed this card's strongest synergy, within its colors.
export function mtgComplementQuery(card, g = mtgGuide(card)) {
  // Triggers ("whenever an artifact enters…") say more about a card's deck than side effects do.
  const PRIORITY = ["artifacts", "enchantments", "spells", "landfall", "aristocrats", "tokens", "counters", "lifegain", "graveyard", "etb", "equip", "aura", "loot", "ramp", "wipe"];
  const r = [...g.roles].filter((x) => x.query).sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id))[0];
  if (!r) return null;
  const id = (card.color_identity || []).join("") || "c";
  return { label: r.label, q: `${r.query} id<=${id} -!"${card.name.split(" // ")[0]}" -t:basic` };
}
