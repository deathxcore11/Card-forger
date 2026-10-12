// Pokémon TCG adapter. Data: TCGdex (api.tcgdex.net) — every physical card and set,
// Standard/Expanded legality, regulation marks, and daily TCGplayer (USD) and
// Cardmarket (EUR) prices per variant. Pokémon TCG Pocket (digital) cards are excluded.
const API = "https://api.tcgdex.net/v2/en";

const isPocket = (c) => /\/tcgp\//.test(c?.image || "") || c?.set?.id?.startsWith?.("A") && /^[A-Z]\d/.test(c.set.id) || /^P-A/.test(c?.id || "");
const n = (v) => (typeof v === "number" && v > 0 ? v : null);
export const ptcgImage = (base, size = "low") => (base ? `${base}/${size}.webp` : "");

const RULE_BOX = /\b(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.X|Prism Star|◇|Tera)\b/;
const VARIANT_LABEL = { normal: "Normal", holofoil: "Holofoil", "reverse-holofoil": "Reverse holo", "1st-edition": "1st Edition", "1st-edition-holofoil": "1st Ed. holo", unlimited: "Unlimited", "unlimited-holofoil": "Unlimited holo" };

// Availability is independent of price. Detailed records include Shadowless,
// stamped promos, copyright runs and other versions omitted by pricing alone.
export function pokemonVariants(c) {
  const legacy = Object.entries(c.pricing?.tcgplayer || {}).filter(([,v]) => v && typeof v === "object" && "marketPrice" in v)
    .map(([key,v]) => ({ key, label: VARIANT_LABEL[key] || key, usd: n(v.marketPrice) ?? n(v.midPrice), low:n(v.lowPrice), mid:n(v.midPrice), market:n(v.marketPrice), productId:v.productId }));
  const out = new Map();
  const title = value => String(value).split("-").map(x => x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
  for (const d of c.variants_detailed || []) {
    const first = d.stamp?.includes("1st-edition"), finish = { holo:"holofoil", reverse:"reverse-holofoil", normal:"normal" }[d.type];
    const special = d.subtype && d.subtype !== "unlimited" || (d.stamp || []).some(x => x !== "1st-edition") || d.size && d.size !== "standard";
    const wanted = first ? [d.type === "holo" ? "1st-edition-holofoil" : "1st-edition"] : d.subtype === "unlimited" || c.variants?.firstEdition ? [d.type === "holo" ? "unlimited-holofoil" : "unlimited", finish] : [finish];
    const bucket = wanted.find(k => d.pricing?.tcgplayer?.[k]);
    const q = bucket ? d.pricing.tcgplayer[bucket] : {};
    const key = !special && bucket ? bucket : "detail:" + (d.variantId || JSON.stringify([d.type,d.subtype,d.stamp,d.size]));
    const label = [first ? "First Edition" : "", d.subtype ? title(d.subtype) : "", ...(d.stamp || []).filter(x => x !== "1st-edition").map(title), d.size && d.size !== "standard" ? title(d.size) : "", {holo:"Holofoil",reverse:"Reverse Holo",normal:"Normal"}[d.type] || title(d.type || "Version")].filter(Boolean).join(" · ");
    out.set(key, { key, label, usd:n(q.marketPrice) ?? n(q.midPrice), low:n(q.lowPrice), mid:n(q.midPrice), market:n(q.marketPrice), productId:q.productId || d.thirdParty?.tcgplayer, cmProduct:d.thirdParty?.cardmarket, detailed:true, image: typeof d.image === "string" ? (/[.](?:webp|png|jpe?g)(?:[?]|$)/i.test(d.image) ? d.image : ptcgImage(d.image)) : "", imageLarge: typeof d.image === "string" ? (/[.](?:webp|png|jpe?g)(?:[?]|$)/i.test(d.image) ? d.image : ptcgImage(d.image,"high")) : "" });
  }
  for (const v of legacy) if (!out.has(v.key)) out.set(v.key,v);
  // Older/incomplete responses still expose version availability flags.
  for (const [flag,key,label] of [["normal","normal","Normal"],["holo","holofoil","Holofoil"],["reverse","reverse-holofoil","Reverse Holo"]]) {
    if (c.variants?.[flag] && ![...out.values()].some(v => v.key === key || v.label.endsWith(label))) out.set(key,{key,label,usd:null});
  }
  if (c.variants?.firstEdition && ![...out.values()].some(v => /First Edition|1st Ed/i.test(v.label))) out.set("firstEdition",{key:"firstEdition",label:"First Edition · finish unconfirmed",usd:null});
  if (c.variants?.wPromo && ![...out.values()].some(v => /W Promo/i.test(v.label))) out.set("wPromo",{key:"wPromo",label:"W Promo",usd:null});
  return [...out.values()];
}

export function normalizePtcg(c) {
  const tp = c.pricing?.tcgplayer || {},
    cm = c.pricing?.cardmarket || {},
    variants = pokemonVariants(c),
    best = variants.find((v) => v.key === "normal" && v.usd) || variants.find((v) => v.usd) || null,
    stats = [];
  if (c.hp) stats.push(["HP", c.hp]);
  if (c.types?.length) stats.push(["Type", c.types.join(" / ")]);
  if (c.stage) stats.push(["Stage", c.stage]);
  if (c.evolveFrom) stats.push(["Evolves from", c.evolveFrom]);
  if (c.weaknesses?.length) stats.push(["Weakness", c.weaknesses.map((w) => w.type + " " + (w.value || "")).join(", ")]);
  if (c.resistances?.length) stats.push(["Resistance", c.resistances.map((w) => w.type + " " + (w.value || "")).join(", ")]);
  if (c.retreat !== undefined) stats.push(["Retreat", c.retreat]);
  if (c.regulationMark) stats.push(["Regulation", c.regulationMark]);
  const text = [
    ...(c.abilities || []).map((a) => `${a.type || "Ability"}: ${a.name}\n${a.effect || ""}`),
    ...(c.attacks || []).map((a) => `[${(a.cost || []).join(" · ") || "—"}] ${a.name}${a.damage ? " — " + a.damage : ""}${a.effect ? "\n" + a.effect : ""}`),
    c.effect || "",
    c.description && !c.attacks ? c.description : "",
  ].filter(Boolean).join("\n\n");
  return {
    game: "ptcg",
    variantSchema: 3,
    id: c.id,
    name: c.name,
    category: c.category || "Pokemon",
    typeLine: [c.category === "Pokemon" ? "Pokémon" : c.category, c.stage?.replace(/^Stage(\d)/, "Stage $1"), c.trainerType, c.energyType && c.energyType + " Energy", c.types?.join("/")].filter(Boolean).join(" · "),
    text,
    stats,
    rarity: c.rarity || "",
    illustrator: c.illustrator || "",
    set: c.set ? { id: c.set.id, name: c.set.name, number: c.localId, total: c.set.cardCount?.official, symbol: c.set.symbol || "" } : null,
    sets: c.set ? [{ code: c.set.id + " " + c.localId, name: c.set.name, rarity: c.rarity, price: best?.usd ?? null }] : [],
    variants,
    prices: { usd: best?.usd ?? null, eur: n(cm.trend) ?? n(cm.avg), others: [], source: "TCGplayer market (USD) · Cardmarket trend (EUR)", updated: tp.updated || cm.updated || null },
    cardmarket: { low: n(cm.low), avg: n(cm.avg), trend: n(cm.trend), avg30: n(cm.avg30), holoLow: n(cm["low-holo"]), holoAvg: n(cm["avg-holo"]), holoTrend: n(cm["trend-holo"]) },
    cmProduct: cm.idProduct || null,
    legal: { standard: !!c.legal?.standard, expanded: !!c.legal?.expanded },
    regulationMark: c.regulationMark || "",
    stage: c.stage || "",
    hp: c.hp || null,
    abilities: (c.abilities || []).map((a) => ({ type: a.type || "Ability", name: a.name, effect: a.effect || "" })),
    attacks: (c.attacks || []).map((a) => ({ cost: a.cost || [], name: a.name, damage: a.damage ?? "", effect: a.effect || "" })),
    effect: c.effect || "",
    weak: (c.weaknesses || []).map((w) => ({ type: w.type, value: w.value || "" })),
    resist: (c.resistances || []).map((w) => ({ type: w.type, value: w.value || "" })),
    retreat: c.retreat ?? null,
    dexId: c.dexId || [],
    printVariants: Object.entries(c.variants || {}).filter(([, v]) => v === true).map(([k]) => k),
    flavor: c.description || "",
    evolveFrom: c.evolveFrom || "",
    types: c.types || [],
    attackCosts: [...new Set((c.attacks || []).flatMap((a) => a.cost || []).filter((x) => x !== "Colorless"))],
    energyType: c.energyType || "",
    basicEnergy: c.category === "Energy" && c.energyType === "Normal",
    basicPokemon: c.category === "Pokemon" && c.stage === "Basic",
    aceSpec: /ACE SPEC/i.test(c.rarity || ""),
    radiant: /^Radiant /.test(c.name),
    ruleBox: c.category === "Pokemon" && RULE_BOX.test(c.name),
    image: ptcgImage(c.image, "low"),
    imageLarge: ptcgImage(c.image, "high"),
    pocket: isPocket(c),
    fetchedAt: new Date().toISOString(),
  };
}

// A search hit before details load (no price yet).
const brief = (c) => ({ game: "ptcg", id: c.id, name: c.name, image: ptcgImage(c.image, "low"), imageLarge: ptcgImage(c.image, "high"), brief: true, prices: {}, sets: [], stats: [], pocket: isPocket(c) });

export const PTCG_FORMATS = [
  { id: "standard", name: "Standard", legal: "standard", copies: 4 },
  { id: "expanded", name: "Expanded", legal: "expanded", copies: 4 },
  { id: "unlimited", name: "Unlimited", copies: 4 },
  { id: "glc", name: "Gym Leader Challenge", legal: "expanded", copies: 1, noRuleBox: true, note: "Singleton, Expanded-legal, no Rule Box Pokémon. All Pokémon should share one type (not checked)." },
];

export function ptcgLegality(c, f) {
  if (c.pocket) return "not_legal";
  if (f.legal && c.legal && !c.legal[f.legal]) return "not_legal";
  if (f.noRuleBox && c.ruleBox) return "not_legal";
  return "legal";
}

export function validatePtcg(deck, cardOf, f) {
  const issues = [],
    rows = deck.zones?.main || [],
    total = rows.reduce((a, r) => a + r.qty, 0);
  if (total !== 60) issues.push({ level: "bad", text: `${total}/60 cards. Pokémon decks are exactly 60.` });
  const byName = new Map();
  let ace = 0,
    radiant = 0,
    basics = 0;
  for (const r of rows) {
    const c = cardOf(r.cardId);
    if (!c) continue;
    if (!c.basicEnergy) byName.set(c.name, (byName.get(c.name) || 0) + r.qty);
    if (c.aceSpec) ace += r.qty;
    if (c.radiant) radiant += r.qty;
    if (c.basicPokemon) basics += r.qty;
    const leg = ptcgLegality(c, f);
    if (leg !== "legal") issues.push({ level: "bad", text: `${c.name} (${c.set?.name || c.id}) isn’t legal in ${f.name}${f.noRuleBox && c.ruleBox ? " — Rule Box Pokémon aren’t allowed" : ""}.` });
  }
  for (const [name, q] of byName) if (q > f.copies) issues.push({ level: "bad", text: `${q}× ${name}: ${f.name} allows ${f.copies} with the same name (basic Energy excepted).` });
  if (ace > 1) issues.push({ level: "bad", text: `${ace} ACE SPEC cards; only 1 is allowed.` });
  if (radiant > 1) issues.push({ level: "bad", text: `${radiant} Radiant Pokémon; only 1 is allowed.` });
  if (total && !basics) issues.push({ level: "bad", text: "No Basic Pokémon — a deck needs at least one to start the game." });
  return issues;
}

async function get(path, params) {
  const r = await fetch(API + path + (params ? "?" + new URLSearchParams(params) : ""), { headers: { Accept: "application/json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw Error("Pokémon card database unavailable (" + r.status + ").");
  return r.json();
}

const searchCache = new Map();
let rankPromise = null;
// Set id → position in release order (higher = newer), from the series list.
function setRank() {
  return (rankPromise ||= ptcgSource
    .sets()
    .then((list) => new Map(list.slice().reverse().map((s, i) => [s.id, i])))
    .catch(() => {
      rankPromise = null;
      return new Map();
    }));
}

// Physical-card rarities (TCG Pocket's diamond/star/crown rarities are left out).
export const PTCG_RARITIES = ["Common", "Uncommon", "Rare", "Rare Holo", "Double rare", "Ultra Rare", "Illustration rare", "Special illustration rare", "Hyper rare", "Mega Hyper Rare", "ACE SPEC Rare", "Shiny rare", "Shiny Ultra Rare", "Black White Rare", "Secret Rare", "Radiant Rare", "Amazing Rare", "Holo Rare V", "Holo Rare VMAX", "Holo Rare VSTAR", "Full Art Trainer", "Classic Collection", "Rare PRIME", "Rare Holo LV.X", "LEGEND", "Promo"];
export const PTCG_STAGES = [["Basic", "Basic"], ["Stage1", "Stage 1"], ["Stage2", "Stage 2"], ["MEGA", "Mega"], ["VMAX", "VMAX"], ["VSTAR", "VSTAR"], ["V-UNION", "V-UNION"], ["BREAK", "BREAK"], ["LEVEL-UP", "LV.X"], ["RESTORED", "Restored"], ["Baby", "Baby"]];
export const PTCG_TYPES = ["Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Darkness", "Metal", "Dragon", "Colorless", "Fairy"];

let standardPokemon = null,
  randomSets = null;

export const ptcgSource = {
  game: "ptcg",
  formats: PTCG_FORMATS,
  // TCGdex can't sort by release date, so fetch every match once, order it by each
  // set's real release order, and page through it here.
  async search({ q = "", category = "", type = "", set = "", rarity = "", stage = "", hp = "", format = "", sort = "new", page = 0, size = 48 }) {
    if (!q.trim() && !set && !type && !rarity && !stage) throw Error("Type a card name, or pick an energy type, rarity, stage or set.");
    const p = {},
      legal = PTCG_FORMATS.find((f) => f.id === format)?.legal;
    if (q.trim()) p.name = q.trim();
    if (category) p.category = category;
    if (type) p.types = type;
    if (set) p["set.id"] = set;
    if (rarity) p.rarity = "eq:" + rarity;
    if (stage) p.stage = "eq:" + stage;
    if (Number(hp) > 0) p.hp = "gte:" + Number(hp);
    if (legal) p["legal." + legal] = "true";
    const key = JSON.stringify(p);
    if (!searchCache.has(key)) {
      const [d, rank] = await Promise.all([get("/cards", p), setRank()]);
      const all = (d || []).map(brief).filter((c) => !c.pocket);
      searchCache.set(key, { all, rank });
    }
    const { all, rank } = searchCache.get(key),
      setOf = (id) => id.slice(0, id.lastIndexOf("-")),
      num = (id) => parseInt(id.slice(id.lastIndexOf("-") + 1), 10) || 0,
      sorted = [...all].sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name) || (rank.get(setOf(b.id)) ?? -1) - (rank.get(setOf(a.id)) ?? -1) : (a, b) => (rank.get(setOf(b.id)) ?? -1) - (rank.get(setOf(a.id)) ?? -1) || num(a.id) - num(b.id));
    return { cards: sorted.slice(page * size, (page + 1) * size), total: sorted.length, more: (page + 1) * size < sorted.length };
  },
  async get(id) {
    const d = await get("/cards/" + encodeURIComponent(id));
    if (!d) throw Error("Card not found.");
    return normalizePtcg(d);
  },
  // Exact printing from a scan: name plus collector number (053 or 53).
  async byNameNumber(name, num) {
    const tries = [...new Set([num, String(Number(num)), String(Number(num)).padStart(3, "0")])];
    for (const n of tries) {
      const d = (await get("/cards", { name, localId: n })) || [];
      const hits = d.map(brief).filter((c) => !c.pocket);
      if (hits.length) return hits;
    }
    return [];
  },
  async byName(name) {
    const d = (await get("/cards", { name: "eq:" + name, "sort:field": "id", "sort:order": "DESC", "pagination:itemsPerPage": 20 })) || [];
    const hit = d.map(brief).find((c) => !c.pocket);
    return hit ? this.get(hit.id) : null;
  },
  async sets() {
    const series = ((await get("/series")) || []).filter((s) => s.id !== "tcgp");
    const details = await Promise.all(series.map((s) => get("/series/" + s.id).catch(() => null)));
    const out = [];
    for (const sd of details.filter(Boolean))
      for (const st of sd.sets || []) out.push({ id: st.id, name: st.name, code: st.id.toUpperCase(), count: st.cardCount?.total || st.cardCount?.official || 0, date: "", series: sd.name, seriesDate: sd.releaseDate || "", image: st.logo ? st.logo + ".webp" : "", symbol: st.symbol ? st.symbol + ".webp" : "" });
    // Series come oldest-first with their sets in release order; show newest first.
    return out
      .map((x, i) => ({ ...x, order: i }))
      .sort((a, b) => String(b.seriesDate).localeCompare(String(a.seriesDate)) || b.order - a.order);
  },
  // A random card: a random set (weighted by size), then a random card in it.
  async random() {
    randomSets ||= this.sets().catch((e) => ((randomSets = null), Promise.reject(e)));
    const sets = (await randomSets).filter((x) => x.count > 0),
      total = sets.reduce((a, x) => a + x.count, 0);
    for (let i = 0; i < 4; i++) {
      let r = Math.random() * total,
        set = sets[0];
      for (const x of sets) if ((r -= x.count) < 0) {
        set = x;
        break;
      }
      const cards = (await this.setCards(set)).filter((c) => !c.pocket);
      if (cards.length) return this.get(cards[Math.floor(Math.random() * cards.length)].id);
    }
    throw Error("Couldn’t pick a random card. Try again.");
  },
  // A random Pokémon that is legal in Standard, to build a deck around.
  async randomPokemon() {
    standardPokemon ||= get("/cards", { "legal.standard": "true", category: "Pokemon" }).then((d) => (d || []).filter((c) => !isPocket(c))).catch((e) => ((standardPokemon = null), Promise.reject(e)));
    const list = await standardPokemon;
    if (!list.length) throw Error("Couldn’t load Standard Pokémon. Try again.");
    return this.get(list[Math.floor(Math.random() * list.length)].id);
  },
  async setCards(set) {
    const d = await get("/sets/" + encodeURIComponent(set.id));
    return (d?.cards || []).map((c) => ({ ...brief(c), set: { id: d.id, name: d.name, number: c.localId } }));
  },
  validate: validatePtcg,
  legality: ptcgLegality,
  limit: (c, f) => (c.basicEnergy ? Infinity : f.copies),
  zoneFor: () => "main",
  // Pokémon with the same name can have different attacks, so ownership matches the exact card;
  // Trainers and Energy match by name (any printing works the same).
  ownKey: (c) => (c.category === "Pokemon" ? "id:" + c.id : "name:" + c.name),
  buy(c) {
    const nm = encodeURIComponent(c.name),
      tp = c.variants?.find((v) => v.productId)?.productId;
    return [
      ...(tp ? [["TCGplayer (this card)", `https://www.tcgplayer.com/product/${tp}`]] : [["TCGplayer", `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${nm}`]]),
      ...(c.cmProduct ? [["Cardmarket (this card)", `https://www.cardmarket.com/en/Pokemon/Products?idProduct=${c.cmProduct}`]] : [["Cardmarket", `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${nm}`]]),
      ["eBay", `https://www.ebay.com/sch/i.html?_nkw=${nm}+pokemon+card`],
    ];
  },
  // Pokémon TCG Live / PTCGL-style text list.
  exportText(deck, cardOf) {
    const rows = (deck.zones.main || []).map((r) => ({ r, c: cardOf(r.cardId) })),
      part = (cat, label) => {
        const xs = rows.filter((x) => (x.c?.category || "Pokemon") === cat);
        return xs.length ? [`${label}: ${xs.reduce((a, x) => a + x.r.qty, 0)}`, ...xs.map((x) => `${x.r.qty} ${x.r.name} ${(x.c?.set?.id || "").toUpperCase()} ${x.c?.set?.number || ""}`.trim()), ""] : [];
      };
    return [...part("Pokemon", "Pokémon"), ...part("Trainer", "Trainer"), ...part("Energy", "Energy")].join("\n");
  },
  exportExt: "txt",
};
