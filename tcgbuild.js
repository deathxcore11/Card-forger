// Deck generators for Yu-Gi-Oh! and Pokémon. Pure assembly (no network) so the
// rules can be tested; tcg.js fetches the candidate cards and calls these.
// Picks prefer cards you own and stay inside a purchase budget.

// Widely played cards. Each is only used if it is legal (and within its copy limit)
// in the chosen format, so banlist and rotation changes are respected automatically.
export const YGO_STAPLES = [
  "Ash Blossom & Joyous Spring", "Maxx \"C\"", "Infinite Impermanence", "Effect Veiler", "Ghost Ogre & Snow Rabbit",
  "Called by the Grave", "Pot of Prosperity", "Triple Tactics Talent", "Forbidden Droplet", "Dark Ruler No More",
  "Lightning Storm", "Harpie's Feather Duster", "Raigeki", "Monster Reborn", "Nibiru, the Primal Being",
  "Droll & Lock Bird", "Crossout Designator", "Pot of Desires", "Book of Moon", "Solemn Judgment", "Cosmic Cyclone", "Twin Twisters",
];
// Basic Pokémon that support many decks; added (if legal) so an opening hand rarely has no Basic.
export const PTCG_SUPPORT_BASICS = ["Fezandipiti ex", "Budew", "Lillie's Clefairy ex", "Dunsparce", "Tatsugiri", "Squawkabilly ex", "Manaphy", "Mew ex", "Duskull"];
export const PTCG_STAPLES = [
  ["Professor's Research", 4], ["Iono", 4], ["Lillie's Determination", 3], ["Boss's Orders", 3], ["Arven", 3],
  ["Ultra Ball", 4], ["Nest Ball", 3], ["Buddy-Buddy Poffin", 3], ["Earthen Vessel", 2], ["Pokégear 3.0", 2],
  ["Super Rod", 1], ["Night Stretcher", 2], ["Switch", 2], ["Counter Catcher", 1], ["Energy Retrieval", 1], ["Pal Pad", 1],
  ["Prime Catcher", 1], ["Hilda", 2], ["Crispin", 2], ["Dawn", 2],
];
const TYPE_ENERGY = { Grass: "Grass", Fire: "Fire", Water: "Water", Lightning: "Lightning", Psychic: "Psychic", Fighting: "Fighting", Darkness: "Darkness", Metal: "Metal" };
export const energyName = (t) => `Basic ${TYPE_ENERGY[t] || t} Energy`;

// Shared budget-aware picker: take up to `want` copies, fewer if money runs out.
function picker({ owned, price, budget, filler = 0.15 }) {
  let spent = 0;
  const used = new Map();
  return {
    get spent() {
      return spent;
    },
    take(card, want, slotsAfter = 0, min = 1) {
      const have = used.get(card.id) || 0,
        free = Math.max(0, owned(card) - have),
        p = price(card);
      for (let n = want; n >= min; n--) {
        const buy = Math.max(0, n - free),
          cost = buy ? (p === null ? Infinity : buy * p) : 0;
        if (cost !== Infinity && spent + cost + slotsAfter * filler <= budget + 1e-6) {
          spent += cost;
          used.set(card.id, have + n);
          return n;
        }
      }
      return 0;
    },
  };
}
const rowsOf = (m) => [...m.values()].filter((r) => r.qty > 0);
const add = (m, c, n, why) => {
  if (!n) return;
  const r = m.get(c.id);
  if (r) r.qty += n;
  else m.set(c.id, { cardId: c.id, name: c.name, qty: n, why });
};

/**
 * Yu-Gi-Oh!: an archetype core plus legal staples.
 * opts: f (format), seed, archetype (cards), staples (cards), limit(card, f), legal(card, f),
 *       owned(card), price(card), budget
 */
export function buildYgo({ f, seed, archetype = [], staples = [], limit, legal, owned, price, budget }) {
  const ok = (c) => legal(c, f) !== "not_legal" && limit(c, f) > 0,
    pick = picker({ owned, price, budget, filler: 0.25 }),
    main = new Map(),
    extra = new Map(),
    target = f.main[0],
    count = (m) => rowsOf(m).reduce((a, r) => a + r.qty, 0),
    lvl = (c) => (c.category === "Monster" ? (c.level || 4) : 0),
    order = (c) => (c.id === seed.id ? -1 : c.category === "Monster" ? (lvl(c) <= 4 ? 0 : 3) : c.category === "Spell" ? 1 : 2);
  // Balanced core: archetype monsters first, then the archetype's own Spells and Traps, then staples.
  const core = archetype.filter((c) => ok(c) && !c.extra).sort((a, b) => order(a) - order(b) || (b.atk || 0) - (a.atk || 0));
  if (!seed.extra && ok(seed) && !core.some((c) => c.id === seed.id)) core.unshift(seed);
  const monsters = core.filter((c) => c.category === "Monster"),
    support = core.filter((c) => c.category !== "Monster"),
    monsterCap = Math.min(target - 18, 18),
    supportCap = monsterCap + Math.min(support.length * 3, 9);
  for (const [list, cap] of [[monsters, monsterCap], [support, supportCap]])
    for (const c of list) {
      if (count(main) >= cap) break;
      const want = Math.min(limit(c, f), c.id === seed.id || order(c) < 2 ? 3 : 2, cap - count(main));
      add(main, c, pick.take(c, want, target - count(main) - want), c.id === seed.id ? "Your build-around card" : c.category === "Monster" ? "Archetype monster" : "Archetype " + c.category.toLowerCase());
    }
  for (const c of staples.filter(ok)) {
    if (count(main) >= target) break;
    const want = Math.min(limit(c, f), 3, target - count(main));
    add(main, c, pick.take(c, want, target - count(main) - want), "Staple");
  }
  const ex = archetype.filter((c) => ok(c) && c.extra);
  if (seed.extra && ok(seed) && !ex.some((c) => c.id === seed.id)) ex.unshift(seed);
  for (const c of ex) {
    if (count(extra) >= f.extra) break;
    add(extra, c, pick.take(c, Math.min(limit(c, f), c.id === seed.id ? 2 : 1, f.extra - count(extra))), c.id === seed.id ? "Your build-around card" : "Archetype Extra Deck");
  }
  const total = count(main),
    warnings = [];
  if (total < target) warnings.push(`${target - total} Main Deck slots still open — raise the budget or add cards you own.`);
  if (monsters.length + support.length < 6) warnings.push("Small archetype: most of the deck is general-purpose cards. Add your own engine cards.");
  return { zones: { main: rowsOf(main), extra: rowsOf(extra), side: [] }, cost: pick.spent, total, size: target, warnings };
}

/**
 * Pokémon: the evolution line, legal Trainer staples, and basic Energy to exactly 60.
 * opts: line ([{card, want}] Basic → Stage 2), trainers ([{card, want}]), energy (cards), owned, price, budget
 */
export function buildPtcg({ line = [], trainers = [], energy = [], owned, price, budget }) {
  const pick = picker({ owned, price, budget, filler: 0.1 }),
    deck = new Map(),
    count = () => rowsOf(deck).reduce((a, r) => a + r.qty, 0),
    energyTarget = energy.length ? (line.some((x) => x.card.stage === "Stage2") ? 9 : 11) : 0;
  for (const { card, want } of line) add(deck, card, pick.take(card, want, 60 - count() - want), card.stage === "Basic" ? "Basic Pokémon" : "Evolution");
  for (const { card, want } of trainers) {
    const room = 60 - energyTarget - count();
    if (room <= 0) break;
    const n = Math.min(want, room);
    add(deck, card, pick.take(card, n, 60 - count() - n), "Trainer staple");
  }
  // Basic Energy is cheap and unlimited: fill to 60, split across the types the attacks need.
  let left = 60 - count();
  energy.forEach((e, i) => {
    const n = Math.round(left / (energy.length - i));
    add(deck, e, n, "Basic Energy");
    left -= n;
  });
  const total = count(),
    warnings = [];
  if (total < 60) warnings.push(`${60 - total} slots still open.`);
  if (!line.length) warnings.push("No Pokémon line found for this card.");
  return { zones: { main: rowsOf(deck), extra: [], side: [] }, cost: pick.spent, total, size: 60, warnings };
}
