import {applyYgoPrices} from './ygo-prices.js';
// Yu-Gi-Oh! adapter. Data: YGOPRODeck (db.ygoprodeck.com) — card text, every
// printing with set rarity and price, TCG/OCG/GOAT banlists, and prices from
// TCGplayer, Cardmarket, eBay, Amazon and CoolStuffInc (refreshed daily).
const API = "https://db.ygoprodeck.com/api/v7";

const EXTRA = new Set(["fusion", "synchro", "xyz", "link", "fusion_pendulum", "synchro_pendulum", "xyz_pendulum"]);
const BAN = { Forbidden: "banned", Limited: "limited", "Semi-Limited": "semi" };
const num = (v) => (v === undefined || v === null || v === "" || Number(v) <= 0 ? null : Number(v));

// Images go through this site's own image route (cached by Cloudflare) as YGOPRODeck
// asks apps not to hotlink; the page falls back to the original if the route is missing.
export const ygoImage = (id, small = true) => `img/ygo/${small ? "s/" : ""}${encodeURIComponent(id)}.jpg`;
export const ygoImageDirect = (id, small = true) => `https://images.ygoprodeck.com/images/cards${small ? "_small" : ""}/${encodeURIComponent(id)}.jpg`;

export function normalizeYgo(c) {
  const p = c.card_prices?.[0] || {},
    type = c.type || "",
    category = /Spell/.test(type) ? "Spell" : /Trap/.test(type) ? "Trap" : /Skill/.test(type) ? "Skill" : /Token/.test(type) ? "Token" : "Monster",
    stats = [];
  if (category === "Monster") {
    if (c.attribute) stats.push(["Attribute", c.attribute]);
    if (c.level !== undefined) stats.push([/xyz/i.test(c.frameType) ? "Rank" : "Level", c.level]);
    if (c.linkval !== undefined) stats.push(["Link", c.linkval]);
    if (c.scale !== undefined) stats.push(["Scale", c.scale]);
    stats.push(["ATK", c.atk ?? "?"]);
    if (c.def !== undefined && c.linkval === undefined) stats.push(["DEF", c.def ?? "?"]);
  }
  if (c.race) stats.push([category === "Monster" ? "Type" : "Property", c.race]);
  if (c.archetype) stats.push(["Archetype", c.archetype]);
  const misc = c.misc_info?.[0] || {};
  return {
    game: "ygo",
    artSchema: 1,
    artworks: (c.card_images || []).map(a => ({ id:String(a.id), image:ygoImage(a.id), imageLarge:ygoImage(a.id,false), label:String(a.id) === String(c.id) ? "Default artwork" : "Alternate artwork" })),
    id: String(c.id),
    name: c.name,
    category,
    typeLine: c.humanReadableCardType || type,
    text: c.pend_desc ? `[Pendulum] ${c.pend_desc}\n\n${c.monster_desc || c.desc}` : c.desc || "",
    stats,
    extra: EXTRA.has(c.frameType),
    frame: c.frameType || "",
    attribute: c.attribute || "",
    race: c.race || "",
    misc: { tcgDate: misc.tcg_date || "", ocgDate: misc.ocg_date || "", views: misc.views || 0, mdRarity: misc.md_rarity || "", formats: misc.formats || [] },
    level: c.level ?? c.linkval ?? null,
    atk: c.atk ?? null,
    def: c.linkval === undefined ? c.def ?? null : null,
    link: c.linkval ?? null,
    archetype: c.archetype || "",
    sets: (c.card_sets || []).map((s) => ({ code: s.set_code, name: s.set_name, rarity: s.set_rarity, price: num(s.set_price) })),
    prices: {
      usd: num(p.tcgplayer_price),
      eur: num(p.cardmarket_price),
      others: [["eBay", num(p.ebay_price)], ["Amazon", num(p.amazon_price)], ["CoolStuffInc", num(p.coolstuffinc_price)]].filter(([, v]) => v),
      source: "TCGplayer market (USD) · Cardmarket (EUR)",
    },
    ban: { tcg: BAN[c.banlist_info?.ban_tcg] || null, ocg: BAN[c.banlist_info?.ban_ocg] || null, goat: BAN[c.banlist_info?.ban_goat] || null },
    pools: misc.formats || [],
    released: misc.tcg_date || misc.ocg_date || "",
    image: ygoImage(c.id),
    art: `img/ygo/a/${encodeURIComponent(c.id)}.jpg`,
    artDirect: `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(c.id)}.jpg`,
    imageLarge: ygoImage(c.id, false),
    url: c.ygoprodeck_url || "",
    fetchedAt: new Date().toISOString(),
  };
}

// Deck formats. `pool` is the card pool name YGOPRODeck reports; `ban` the banlist.
export const YGO_FORMATS = [
  { id: "tcg", name: "Advanced (TCG)", main: [40, 60], extra: 15, side: 15, pool: "TCG", ban: "tcg" },
  { id: "traditional", name: "Traditional (TCG)", main: [40, 60], extra: 15, side: 15, pool: "TCG", ban: "tcg", traditional: true },
  { id: "ocg", name: "OCG", main: [40, 60], extra: 15, side: 15, pool: "OCG", ban: "ocg" },
  { id: "goat", name: "GOAT", main: [40, 60], extra: 15, side: 15, pool: "GOAT", ban: "goat" },
  { id: "edison", name: "Edison", main: [40, 60], extra: 15, side: 15, pool: "Edison", note: "Edison's own list isn't in the data; card pool only." },
  { id: "md", name: "Master Duel", main: [40, 60], extra: 15, side: 15, pool: "Master Duel", note: "Master Duel's banlist isn't in the data; card pool only." },
  { id: "speed", name: "Speed Duel", main: [20, 30], extra: 5, side: 5, pool: "Speed Duel" },
  { id: "dl", name: "Duel Links", main: [20, 30], extra: 8, side: 8, pool: "Duel Links", note: "Duel Links' limited list isn't in the data; card pool only." },
  { id: "casual", name: "Casual", main: [40, 60], extra: 15, side: 15 },
];

// How many copies a format allows.
export function ygoLimit(card, f) {
  if (!f.ban) return 3;
  const s = card.ban?.[f.ban];
  if (s === "banned") return f.traditional ? 1 : 0;
  return s === "limited" ? 1 : s === "semi" ? 2 : 3;
}
export function ygoLegality(card, f) {
  if (f.pool && card.pools?.length && !card.pools.includes(f.pool)) return "not_legal";
  const s = f.ban ? card.ban?.[f.ban] : null;
  if (s === "banned") return f.traditional ? "limited" : "banned";
  return s || "legal";
}

export function validateYgo(deck, cardOf, f) {
  const issues = [],
    z = deck.zones || {},
    count = (zone) => (z[zone] || []).reduce((a, r) => a + r.qty, 0),
    main = count("main"),
    extra = count("extra"),
    side = count("side");
  if (main < f.main[0] || main > f.main[1]) issues.push({ level: "bad", text: `Main Deck has ${main} cards; ${f.name} needs ${f.main[0]}–${f.main[1]}.` });
  if (extra > f.extra) issues.push({ level: "bad", text: `Extra Deck has ${extra}; the limit is ${f.extra}.` });
  if (side > f.side) issues.push({ level: "bad", text: `Side Deck has ${side}; the limit is ${f.side}.` });
  const totals = new Map();
  for (const zone of ["main", "extra", "side"])
    for (const r of z[zone] || []) {
      totals.set(r.cardId, (totals.get(r.cardId) || 0) + r.qty);
      const c = cardOf(r.cardId);
      if (!c) continue;
      if (zone === "main" && c.extra) issues.push({ level: "bad", text: `${c.name} is an Extra Deck monster — move it to the Extra Deck.` });
      if (zone === "extra" && !c.extra) issues.push({ level: "bad", text: `${c.name} can’t go in the Extra Deck.` });
    }
  for (const [id, n] of totals) {
    const c = cardOf(id);
    if (!c) continue;
    const lim = ygoLimit(c, f),
      leg = ygoLegality(c, f);
    if (leg === "not_legal") issues.push({ level: "bad", text: `${c.name} isn’t available in ${f.name}.` });
    else if (n > lim) issues.push({ level: "bad", text: lim === 0 ? `${c.name} is Forbidden in ${f.name}.` : `${c.name}: ${n} copies, ${f.name} allows ${lim}${c.ban?.[f.ban] ? ` (${c.ban[f.ban] === "semi" ? "Semi-Limited" : c.ban[f.ban] === "limited" ? "Limited" : "Forbidden"})` : ""}.` });
  }
  return issues;
}

export const YGO_TYPES = ["Effect Monster", "Normal Monster", "Ritual Effect Monster", "Fusion Monster", "Synchro Monster", "XYZ Monster", "Link Monster", "Pendulum Effect Monster", "Spell Card", "Trap Card"];
export const YGO_ATTRIBUTES = ["DARK", "LIGHT", "EARTH", "WATER", "FIRE", "WIND", "DIVINE"];
export const YGO_RACES = ["Aqua", "Beast", "Beast-Warrior", "Cyberse", "Dinosaur", "Divine-Beast", "Dragon", "Fairy", "Fiend", "Fish", "Illusion", "Insect", "Machine", "Plant", "Psychic", "Pyro", "Reptile", "Rock", "Sea Serpent", "Spellcaster", "Thunder", "Warrior", "Winged Beast", "Wyrm", "Zombie"];
export const YGO_SPELL_KINDS = ["Normal", "Quick-Play", "Continuous", "Equip", "Field", "Ritual"];
export const YGO_TRAP_KINDS = ["Normal", "Continuous", "Counter"];

export const looseName = (q) =>
  String(q)
    .trim()
    .split(/[\s\-'’,.:!&]+/)
    .filter(Boolean)
    .join("%");

async function get(path, params) {
  // "%" in a fuzzy name is a wildcard for YGOPRODeck. It travels as "%25": sent raw, "%Ba" in
  // "A%Bao" was decoded as a byte and names like A Bao A Qu found nothing.
  const qs = params ? Object.entries(params).map(([k, v]) => k + "=" + (k === "fname" ? String(v).split("%").map(encodeURIComponent).join("%25") : encodeURIComponent(v))).join("&") : "";
  const r = await fetch(API + path + (qs ? "?" + qs : ""), { headers: { Accept: "application/json" } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    if (/No card matching/i.test(d.error || "")) return { data: [], meta: { total_rows: 0 } };
    throw Error(d.error || "Yu-Gi-Oh! card database unavailable.");
  }
  return d;
}

let randomTotal = 14000,
  archetypes = null;

export const ygoSource = {
  game: "ygo",
  formats: YGO_FORMATS,
  async search({ q = "", text = "", type = "", attribute = "", race = "", level = "", format = "", set = "", archetype = "", sort = "name", page = 0, size = 60 }) {
    // YGOPRODeck sorts stats low to high only, so "high to low" pages from the end and reverses.
    const desc = /^(atk|def|level)Desc$/.test(sort),
      p = { num: size, offset: page * size, misc: "yes", sort: desc ? sort.slice(0, -4) : ["new", "atk", "def", "level"].includes(sort) ? sort : "name" };
    // Names use hyphens, apostrophes and commas inconsistently ("Blue-Eyes", "Ash Blossom & Joyous Spring"),
    // so match each word in order, whatever sits between them.
    if (q.trim()) p.fname = looseName(q);
    // Card text search (used by the Play guide: cards that name this card or support its race).
    if (text) p.desc = text;
    if (type) p.type = type;
    if (attribute) p.attribute = attribute;
    if (set) p.cardset = set;
    if (archetype) p.archetype = archetype;
    const pool = { TCG: "tcg", GOAT: "goat", "Speed Duel": "speed duel", "Master Duel": "master duel", "Duel Links": "duel links", Edison: "edison" }[YGO_FORMATS.find((x) => x.id === format)?.pool];
    if (race) p.race = race;
    if (level) p.level = level;
    if (pool) p.format = pool;
    if (desc) {
      const total = (await get("/cardinfo.php", { ...p, num: 1, offset: 0 })).meta?.total_rows || 0,
        end = Math.max(0, total - page * size),
        start = Math.max(0, end - size);
      if (!end) return { cards: [], total, more: false };
      const d = await get("/cardinfo.php", { ...p, num: end - start, offset: start });
      return { cards: (d.data || []).map(normalizeYgo).reverse(), total, more: start > 0 };
    }
    const d = await get("/cardinfo.php", p);
    return { cards: (d.data || []).map(normalizeYgo), total: d.meta?.total_rows ?? (d.data || []).length, more: !!d.meta?.rows_remaining };
  },
  async get(id,{printings=true}={}) {
    const d = await get("/cardinfo.php", { id, misc: "yes" });
    if (!d.data?.[0]) throw Error("Card not found.");
    const card=normalizeYgo(d.data[0]);
    if(printings)try{
      // A card printed in many sets is priced over a few requests (the Worker answers "partial").
      for(let i=0;i<10;i++){const r=await fetch("api/prices/yugioh?id="+encodeURIComponent(card.id)+(i?"&more="+i:""),{signal:AbortSignal.timeout(20000)});if(!r.ok)break;const body=await r.json();applyYgoPrices(card,body);if(!body.partial){card.printPriceSchema=1;break;}}
    }catch{}
    return card;
  },
  // Every card on a banlist ("tcg", "ocg" or "goat").
  async banlist(list) {
    const d = await get("/cardinfo.php", { banlist: list, misc: "yes", sort: "name" });
    return (d.data || []).map(normalizeYgo);
  },
  async byNames(names) {
    if (!names.length) return [];
    const d = await get("/cardinfo.php", { name: names.join("|"), misc: "yes" });
    return (d.data || []).map(normalizeYgo);
  },
  // Many cards by passcode, 50 per request.
  async byIds(list) {
    const out = [],
      uniq = [...new Set(list.map(String))];
    for (let i = 0; i < uniq.length; i += 50) {
      const d = await get("/cardinfo.php", { id: uniq.slice(i, i + 50).join(","), misc: "yes" });
      out.push(...(d.data || []).map(normalizeYgo));
    }
    return out;
  },
  async byName(name) {
    const d = await get("/cardinfo.php", { name, misc: "yes" });
    return d.data?.[0] ? normalizeYgo(d.data[0]) : null;
  },
  // A random real card (no tokens or Skill cards), from a random offset in the full list.
  async random() {
    for (let i = 0; i < 4; i++) {
      const d = await get("/cardinfo.php", { num: 1, offset: Math.floor(Math.random() * randomTotal), sort: "id", misc: "yes" });
      if (d.meta?.total_rows) randomTotal = d.meta.total_rows;
      const c = d.data?.[0];
      if (c && !/token|skill/i.test(c.frameType || c.type || "")) return normalizeYgo(c);
    }
    throw Error("Couldn’t pick a random card. Try again.");
  },
  // Cards of a random archetype with enough members to build around.
  async randomArchetype() {
    archetypes ||= get("/archetypes.php").then((d) => (Array.isArray(d) ? d : []).map((a) => a.archetype_name)).catch((e) => ((archetypes = null), Promise.reject(e)));
    const names = await archetypes;
    for (let i = 0; i < 5; i++) {
      const name = names[Math.floor(Math.random() * names.length)];
      const r = await this.search({ archetype: name, size: 100 });
      if (r.cards.filter((c) => c.category === "Monster" && !c.extra).length >= 3) return { name, cards: r.cards };
    }
    throw Error("Couldn’t find a random archetype. Try again.");
  },
  async sets() {
    const d = await fetch(API + "/cardsets.php").then((r) => r.json());
    return (d || [])
      .map((s) => ({ id: s.set_code, name: s.set_name, code: s.set_code, count: s.num_of_cards, date: s.tcg_date || "", image: "" }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },
  async setCards(set) {
    const out = [];
    for (let page = 0; page < 20; page++) {
      const d = await get("/cardinfo.php", { cardset: set.name, num: 100, offset: page * 100, misc: "yes" });
      out.push(...(d.data || []).map(normalizeYgo));
      if (!d.meta?.rows_remaining) break;
    }
    return out;
  },
  validate: validateYgo,
  legality: ygoLegality,
  limit: ygoLimit,
  zoneFor: (c) => (c.extra ? "extra" : "main"),
  ownKey: (c) => "id:" + c.id,
  buy(c) {
    const n = encodeURIComponent(c.name);
    return [
      ["TCGplayer", `https://www.tcgplayer.com/search/yugioh/product?productLineName=yugioh&q=${n}`],
      ["Cardmarket", `https://www.cardmarket.com/en/YuGiOh/Products/Search?searchString=${n}`],
      ["eBay", `https://www.ebay.com/sch/i.html?_nkw=${n}+yugioh`],
      ...(c.url ? [["YGOPRODeck", c.url]] : []),
    ];
  },
  // .ydk is the standard file used by YGOPRODeck, EDOPro and Master Duel deck tools.
  exportText(deck) {
    const ids = (zone) => (deck.zones[zone] || []).flatMap((r) => Array(r.qty).fill(r.cardId));
    return ["#created by CardStashy", "#main", ...ids("main"), "#extra", ...ids("extra"), "!side", ...ids("side")].join("\n") + "\n";
  },
  exportExt: "ydk",
};
