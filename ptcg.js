import {applyProductPrices} from "./pokemon-prices.js";
import {POKEMON_SET_ART} from './pokemon-set-art.js';
import {pokemonFallback} from "./artwork.js";
// Pokémon TCG adapter. Data: TCGdex (api.tcgdex.net) — every physical card and set,
// Standard/Expanded legality, regulation marks, and daily TCGplayer (USD) and
// Cardmarket (EUR) prices per variant. Pokémon TCG Pocket (digital) cards are excluded.
const API = "https://api.tcgdex.net/v2/en";

const isPocket = (c) => /\/tcgp\//.test(c?.image || "") || c?.set?.id?.startsWith?.("A") && /^[A-Z]\d/.test(c.set.id) || /^P-A/.test(c?.id || "");
const n = (v) => (typeof v === "number" && v > 0 ? v : null);
export const ptcgImage = (base, size = "low") => (base ? /\.(webp|png|jpe?g)(?:\?|$)/i.test(base) ? base : `${base}/${size}.webp` : "");

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
    // A plain finish TCGdex knows nothing more about (no price, no product) is the same version
    // as the per-finish price below: key it by finish so the two merge instead of listing twice.
    const bare = !special && !bucket && !d.pricing && !d.thirdParty?.tcgplayer;
    const key = !special && bucket ? bucket : bare ? wanted[0] : "detail:" + (d.variantId || JSON.stringify([d.type,d.subtype,d.stamp,d.size]));
    const label = [first ? "First Edition" : "", d.subtype ? title(d.subtype) : "", ...(d.stamp || []).filter(x => x !== "1st-edition").map(title), d.size && d.size !== "standard" ? title(d.size) : "", {holo:"Holofoil",reverse:"Reverse Holo",normal:"Normal"}[d.type] || title(d.type || "Version")].filter(Boolean).join(" · ");
    out.set(key, { key, label, usd:n(q.marketPrice) ?? n(q.midPrice), low:n(q.lowPrice), mid:n(q.midPrice), market:n(q.marketPrice), productId:q.productId || d.thirdParty?.tcgplayer, cmProduct:d.thirdParty?.cardmarket, detailed:true, image: typeof d.image === "string" ? (/[.](?:webp|png|jpe?g)(?:[?]|$)/i.test(d.image) ? d.image : ptcgImage(d.image)) : "", imageLarge: typeof d.image === "string" ? (/[.](?:webp|png|jpe?g)(?:[?]|$)/i.test(d.image) ? d.image : ptcgImage(d.image,"high")) : "" });
  }
  for (const v of legacy) {
    const have = out.get(v.key);
    if (!have) out.set(v.key,v);
    else if (have.usd == null && !have.productId) out.set(v.key,{ ...have, ...v, label: have.label, image: have.image, imageLarge: have.imageLarge });
  }
  // Older/incomplete responses still expose version availability flags.
  for (const [flag,key,label] of [["normal","normal","Normal"],["holo","holofoil","Holofoil"],["reverse","reverse-holofoil","Reverse Holo"]]) {
    if (c.variants?.[flag] && ![...out.values()].some(v => v.key === key || v.label.endsWith(label))) out.set(key,{key,label,usd:null});
  }
  if (c.variants?.firstEdition && ![...out.values()].some(v => /First Edition|1st Ed/i.test(v.label))) out.set("firstEdition",{key:"firstEdition",label:"First Edition · finish unconfirmed",usd:null});
  if (c.variants?.wPromo && ![...out.values()].some(v => /W Promo/i.test(v.label))) out.set("wPromo",{key:"wPromo",label:"W Promo",usd:null});
  return [...out.values()];
}

// Second price source: the Pokémon TCG API's TCGplayer prices for the same card — same name,
// same collector number and the same set name, or nothing (never another printing's price).
const PTCG_API_KEYS = { normal: "normal", holofoil: "holofoil", reverseHolofoil: "reverse-holofoil", "1stEditionHolofoil": "1st-edition-holofoil", "1stEditionNormal": "1st-edition", unlimitedHolofoil: "unlimited-holofoil", unlimitedNormal: "unlimited" };
const setKey = (x) => String(x || "").toLowerCase().replace(/pok[eé]mon|[^a-z0-9]/g, "");
export function applyFallbackPrices(c, hit) {
  const tp = hit?.tcgplayer?.prices || {};
  let filled = false;
  for (const [k, v] of Object.entries(tp)) {
    const usd = n(v?.market) ?? n(v?.mid);
    if (usd == null) continue;
    const key = PTCG_API_KEYS[k] || k,
      variant = c.variants?.find((x) => x.key === key);
    if (variant && variant.usd == null) {
      variant.usd = usd;
      variant.fallback = true;
      filled = true;
    } else if (!variant && !c.variants?.some((x) => x.usd != null)) {
      (c.variants ||= []).push({ key, label: VARIANT_LABEL[key] || key, usd, fallback: true });
      filled = true;
    }
  }
  if (!filled) return false;
  const best = c.variants.find((v) => v.key === "normal" && v.usd) || c.variants.find((v) => v.usd);
  c.prices.usd = best?.usd ?? null;
  c.prices.source = "TCGplayer market (USD, via the Pokémon TCG API)";
  c.prices.updated = hit.tcgplayer?.updatedAt || c.prices.updated;
  if (c.sets?.[0]) c.sets[0].price = c.prices.usd;
  return true;
}
// One lookup at a time with a short gap (a list of unpriced cards must not flood the service),
// and each card asked at most once per session.
let fillChain = Promise.resolve(), ptcgApiFails = 0;
const fillAsked = new Map();
function fillPrices(c) {
  if(fillAsked.has(c.id))return fillAsked.get(c.id).then(done=>{c.prices=done.prices;c.variants=done.variants;c.sets=done.sets;});
  const run=fillChain.then(()=>fillPricesNow(c)).catch(()=>{}).then(()=>c);
  fillAsked.set(c.id,run);
  fillChain=run.then(()=>new Promise(ok=>setTimeout(ok,250)));
  return run.finally(()=>fillAsked.delete(c.id));
}
async function fillPricesNow(c) {
  if(c.variants?.some(v=>v.productId&&v.usd==null)){
   try{const r=await fetch('api/prices/pokemon?'+new URLSearchParams({id:c.id}),{signal:AbortSignal.timeout?.(15000)});if(r.ok&&applyProductPrices(c,await r.json())&&c.variants.every(v=>v.usd!=null))return;}catch{}
  }
  const num = String(c.set?.number || "").replace(/^0+(?=\d)/, "");
  if (!c.name || !num) return;
  // The Pokémon TCG API is a backup source that is often down (HTTP 500): after two failures it is
  // skipped for the rest of the session instead of slowing every card that has no price.
  let d = null;
  if (ptcgApiFails < 2) {
    const u = "https://api.pokemontcg.io/v2/cards?" + new URLSearchParams({ q: `name:"${c.name.replace(/"/g, "")}" number:${num}`, select: "name,number,set,tcgplayer", pageSize: "20" });
    d = await fetch(u, { signal: AbortSignal.timeout?.(6000) }).then((r) => (r.ok ? r.json() : (ptcgApiFails++, null))).catch(() => (ptcgApiFails++, null));
  }
  const hit = (d?.data || []).find((x) => setKey(x.set?.name) === setKey(c.set?.name));
  if (hit && applyFallbackPrices(c, hit)) return;
  // Last: the dated TCGplayer market quotes kept for this exact product (same product id), when
  // the newest is from the last three weeks. The card page shows the same quote and date.
  const products = new Set((c.variants || []).map((v) => String(v.productId || "")).filter(Boolean));
  if (!products.size) return;
  const h = await fetch("api/prices/recent?" + new URLSearchParams({ game: "ptcg", id: c.id, finish: "reference" }), { signal: AbortSignal.timeout?.(10000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  for (const sr of h?.series || []) {
    const last = sr.points?.at(-1), v = c.variants.find((x) => String(x.productId) === String(sr.productId) && x.usd == null);
    if (!v || !(last?.value > 0) || Date.now() - Date.parse(last.date) > 21 * 864e5) continue;
    Object.assign(v, { usd: last.value, market: last.value, historyQuote: last.date });
  }
  const best = c.variants.find((v) => v.key === "normal" && v.usd != null) || c.variants.find((v) => v.usd != null);
  if (best && c.prices.usd == null) {
    c.prices.usd = best.usd;
    c.prices.source = "TCGplayer market (USD), latest dated quote";
    c.prices.updated = best.historyQuote || c.prices.updated;
    if (c.sets?.[0]) c.sets[0].price = c.prices.usd;
  }
}

// Newer TCGdex text carries markup for energy symbols ("<span class=\"energy-symbol Fire\" …>Fire</span>"):
// keep the words, drop the tags.
export const plainText = (t) => String(t ?? "").replace(/<span[^>]*\btitle="([^"]+)"[^>]*>[^<]*<\/span>/gi, "$1").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
export function normalizePtcg(c) {
  const tp = c.pricing?.tcgplayer || {},
    cm = c.pricing?.cardmarket || {},
    variants = pokemonVariants(c),
    best = variants.find((v) => v.key === "normal" && v.usd) || variants.find((v) => v.usd) || null,
    stats = [];
  if (c.hp) stats.push(["HP", c.hp]);
  if (c.types?.length) stats.push(["Type", c.types.join(" / ")]);
  if (c.stage) stats.push(["Stage", String(c.stage).replace(/^Stage(\d)/, "Stage $1")]);
  if (c.evolveFrom) stats.push(["Evolves from", c.evolveFrom]);
  if (c.weaknesses?.length) stats.push(["Weakness", c.weaknesses.map((w) => w.type + " " + (w.value || "")).join(", ")]);
  if (c.resistances?.length) stats.push(["Resistance", c.resistances.map((w) => w.type + " " + (w.value || "")).join(", ")]);
  if (c.retreat !== undefined) stats.push(["Retreat", c.retreat]);
  if (c.regulationMark) stats.push(["Regulation", c.regulationMark]);
  const text = [
    ...(c.abilities || []).map((a) => `${a.type || "Ability"}: ${a.name}\n${plainText(a.effect)}`),
    ...(c.attacks || []).map((a) => `[${(a.cost || []).join(" · ") || "—"}] ${a.name}${a.damage ? " — " + a.damage : ""}${a.effect ? "\n" + plainText(a.effect) : ""}`),
    plainText(c.effect),
    c.description && !c.attacks ? plainText(c.description) : "",
  ].filter(Boolean).join("\n\n");
  return {
    game: "ptcg",
    variantSchema: 8,
    released:c.set?.releaseDate || "",
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
    abilities: (c.abilities || []).map((a) => ({ type: a.type || "Ability", name: a.name, effect: plainText(a.effect) })),
    attacks: (c.attacks || []).map((a) => ({ cost: a.cost || [], name: a.name, damage: a.damage ?? "", effect: plainText(a.effect) })),
    effect: plainText(c.effect),
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
    // Only the eight (nine with Fairy) basic types are Basic Energy; TCGdex marks a few Special
    // Energy (Telepathic Psychic Energy, Growing Grass Energy) "Normal" too.
    basicEnergy: c.category === "Energy" && c.energyType === "Normal" && /^(?:Basic )?(?:Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$/.test(c.name || ""),
    basicPokemon: c.category === "Pokemon" && c.stage === "Basic",
    aceSpec: /ACE SPEC/i.test(c.rarity || ""),
    radiant: /^Radiant /.test(c.name),
    ruleBox: c.category === "Pokemon" && RULE_BOX.test(c.name),
    prize: prizeValue(c),
    image: ptcgImage(c.image, "low") || pokemonFallback(c),
    imageLarge: ptcgImage(c.image, "high") || pokemonFallback(c),
    pocket: isPocket(c),
    fetchedAt: new Date().toISOString(),
  };
}

// A search hit before details load (no price yet).
const ptcgImageAsset = url => /\.(?:png|webp|jpe?g)(?:\?|$)/i.test(url) ? url : url+".webp";
const brief = (c) => ({ game: "ptcg", id: c.id, name: c.name, image: ptcgImage(c.image, "low") || pokemonFallback(c), imageLarge: ptcgImage(c.image, "high") || pokemonFallback(c), brief: true, prices: {}, sets: [], stats: [], pocket: isPocket(c) });

export const PTCG_FORMATS = [
  { id: "standard", name: "Standard", legal: "standard", copies: 4 },
  { id: "expanded", name: "Expanded", legal: "expanded", copies: 4 },
  { id: "unlimited", name: "Unlimited", copies: 4 },
  { id: "glc", name: "Gym Leader Challenge", legal: "expanded", copies: 1, noRuleBox: true, note: "Singleton, Expanded-legal, no Rule Box Pokémon. All Pokémon should share one type (not checked)." },
];

export function ptcgLegality(c, f) {
  if (c.pocket) return "not_legal";
  // Basic Energy is legal in every format, whatever set it was printed in.
  if (c.basicEnergy) return "legal";
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

// Prizes the opponent takes when this Pokémon is Knocked Out: Mega Evolution Pokémon ex, VMAX,
// V-UNION and TAG TEAM give 3; ex, EX, GX, V and VSTAR give 2; everything else (Radiant, Prism
// Star, BREAK, plain Pokémon) gives 1.
export function prizeValue(c) {
  if ((c?.category || "Pokemon") !== "Pokemon") return 1;
  const n = String(c?.name || "");
  if (/^Mega .+ ex$/.test(n) || /\bVMAX\b|V-UNION/.test(n) || (/&/.test(n) && /\bGX\b/.test(n))) return 3;
  if (/\b(ex|EX|GX|V|VSTAR)\b/.test(n) || /^M .+-EX$/.test(n)) return 2;
  return 1;
}
// What a card does in a game, without its art, rarity or set: printings with the same signature
// are the same card for deck building. Every game field is compared as data, damage modifiers
// (30+ vs 30×), resistance and Prize value included; only the wording's spacing and quote style is
// normalised.
const sigText = (s) => String(s ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
export const playSig = (c) => JSON.stringify([
  sigText(c.name), c.category, c.stage || "", c.hp ?? null, (c.types || []).join("/"), sigText(c.evolveFrom), c.retreat ?? null,
  (c.weak || []).map((w) => w.type + " " + sigText(w.value)), (c.resist || []).map((w) => w.type + " " + sigText(w.value)),
  (c.abilities || []).map((a) => [sigText(a.type), sigText(a.name), sigText(a.effect)]),
  (c.attacks || []).map((a) => [(a.cost || []).join(","), sigText(a.name), sigText(a.damage), sigText(a.effect)]),
  sigText(c.effect), sigText(c.energyType), !!c.aceSpec, !!c.radiant, prizeValue(c),
  // Older cached cards without the structured fields fall back to the full text.
  c.attacks || c.abilities ? "" : sigText(c.text),
]);
const cheapMemo = new Map();
// Candidate printings for the cheapest-printing check: TCGdex's own data only (no slow price
// backfill); printings without a TCGdex price simply rank last.
const liteCards = new Map();
const getCard = (id) => {
  if (!liteCards.has(id)) liteCards.set(id, get("/cards/" + encodeURIComponent(id)).then((d) => (d ? normalizePtcg(d) : null)).catch(() => null));
  return liteCards.get(id);
};
const SET_ALIAS = { rc: { from: "bw11", prefix: /^RC\d/ } };
// Listed by TCGdex with no cards in any source (Jumbo cards, Sample, W Promotional): left out of
// the set list rather than shown as a set that never fills in.
const NO_CARDS = new Set(["jumbo", "sp", "wp"]);
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

const firstPerName = (list) => {
  const seen = new Set();
  return list.filter((c) => !seen.has(c.name) && seen.add(c.name));
};
export const ptcgSource = {
  game: "ptcg",
  formats: PTCG_FORMATS,
  // TCGdex can't sort by release date, so fetch every match once, order it by each
  // set's real release order, and page through it here.
  async search({ q = "", category = "", type = "", set = "", rarity = "", stage = "", hp = "", format = "", sort = "new", page = 0, size = 48 }) {
    // Empty search browses the complete physical-card catalogue, paged below.
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
    const c = normalizePtcg(d);
    // No price from TCGdex (common for new sets): ask the Pokémon TCG API, which also carries
    // TCGplayer market prices.
    if (c.prices.usd == null) await fillPrices(c);
    return c;
  },
  // Exact printing from a scan: name plus collector number (053 or 53).
  // Pokémon that evolve from this one (TCGdex filters on evolveFrom), one per name.
  async evolutions(name) {
    const d = await get("/cards", { evolveFrom: name, "pagination:itemsPerPage": 40 });
    return firstPerName((d || []).map(brief).filter((c) => !c.pocket));
  },
  // Evolution Pokémon of a stage, newest first, legal in a format (for the Play guide's broader search).
  async byStage(stage, legal = "") {
    const d = await get("/cards", { stage, ...(legal ? { ["legal." + legal]: "true" } : {}), "sort:field": "updated", "sort:order": "DESC", "pagination:itemsPerPage": 40 });
    return firstPerName((d || []).map(brief).filter((c) => !c.pocket));
  },
  // Cards whose rules text mentions this name (Trainer effects and Pokémon attacks), one per name.
  async mentioning(name) {
    const d = await get("/cards", { effect: "like:" + name, "pagination:itemsPerPage": 40 });
    return firstPerName((d || []).map(brief).filter((c) => !c.pocket && c.name !== name));
  },
  async tournamentCard(row) {
    if(!row.set || !row.number)return null;
    const candidates=await this.byNameNumber(row.name,String(row.number));
    for(const brief of candidates.filter(c=>c.name.toLowerCase()===row.name.toLowerCase())){
      const setId=brief.id.slice(0,brief.id.lastIndexOf('-'));
      const set=await get('/sets/'+encodeURIComponent(setId)).catch(()=>null);
      // TCGdex keeps the printed set code under abbreviation.official ("TWM" for sv06).
      const codes=[set?.id,set?.tcgOnline,set?.abbreviation?.official,set?.abbreviation?.normal,typeof set?.abbreviation==="string"?set.abbreviation:null,set?.abbreviations?.official].filter(Boolean).map(x=>String(x).toLowerCase());
      // Only one printing with that name and number: it's the card, whatever the set code says.
      if(!codes.includes(String(row.set).toLowerCase())&&candidates.length>1)continue;
      const card=await this.get(brief.id);if(card.name.toLowerCase()===row.name.toLowerCase())return card;
    }return null;
  },
  async byNameNumber(name, num) {
    const tries = [...new Set([num, String(Number(num)), String(Number(num)).padStart(3, "0")])];
    for (const n of tries) {
      const d = (await get("/cards", { name, localId: n })) || [];
      // TCGdex matches localId loosely ("053" also finds "SWSH153"); keep exact numbers only.
      const hits = d.map(brief).filter((c) => !c.pocket && tries.includes(c.id.slice(c.id.lastIndexOf("-") + 1)));
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
    // The complete catalogue survives a missing series response; series only enrich it.
    const catalogue = await get("/sets");
    if (!Array.isArray(catalogue) || !catalogue.length) throw Error("Pokémon set catalogue unavailable. Try again.");
    const series = ((await get("/series").catch(() => [])) || []).filter(s => s.id !== "tcgp");
    const details = await Promise.allSettled(series.map(s => get("/series/" + s.id)));
    const enriched = new Map();let order=0;
    for (const result of details) if(result.status === "fulfilled" && result.value){
      const sd=result.value;
      for(const st of sd.sets || []) enriched.set(st.id,{...st,series:sd.name,seriesDate:sd.releaseDate || "",order:order++});
    }
    return catalogue.filter(st => !/^(?:[A-Z]\d|P-A)/.test(st.id) && !NO_CARDS.has(st.id)).map((st,i) => {
      const extra=enriched.get(st.id)||{}, art=POKEMON_SET_ART[st.id]||{}, data={...extra,...st};
      return {id:st.id,name:st.name,code:st.id.toUpperCase(),count:data.cardCount?.total ?? data.cardCount?.official ?? 0,date:data.releaseDate || art.date || "",series:extra.series || art.series || "Other sets",seriesDate:extra.seriesDate || "",order:extra.order ?? i,image:data.logo ? ptcgImageAsset(data.logo) : art.logo || "",symbol:data.symbol ? ptcgImageAsset(data.symbol) : art.symbol || ""};
    }).sort((a,b)=>String(b.date||b.seriesDate).localeCompare(String(a.date||a.seriesDate))||b.order-a.order);

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
    let d = await get("/sets/" + encodeURIComponent(set.id));
    // Subsets TCGdex lists empty but files inside their parent set (Radiant Collection RC1–RC25
    // are Legendary Treasures cards): show the parent's cards with that prefix.
    const alias = SET_ALIAS[set.id];
    if (alias && !d?.cards?.length) {
      const parent = await get("/sets/" + alias.from);
      if (parent) d = { ...parent, cards: (parent.cards || []).filter((c) => alias.prefix.test(c.localId)) };
    }
    return (d?.cards || []).map((c) => ({ ...brief({...c,set:{id:d.id,number:c.localId}}), set: { id: d.id, name: d.name, number: c.localId } }));
  },
  // The same card at the lowest cost: reprints and alternate arts with the same name and the same
  // game text (HP, attacks, abilities, retreat, rules) play identically, so a deck only needs the
  // cheapest one that is legal in the format, or one you already own. Basic Energy: any printing.
  async cheapestPrint(card, { legal = () => true, owned = () => 0 } = {}) {
    if (!card?.name) return card;
    const key = card.id + "|" + legal.key;
    if (cheapMemo.has(key)) return cheapMemo.get(key);
    const run = (async () => {
      // Basic Energy is named both "Water Energy" and "Basic Water Energy" depending on the set.
      const names = card.basicEnergy ? [card.name.replace(/^Basic /, ""), "Basic " + card.name.replace(/^Basic /, "")] : [card.name];
      const briefs = (await Promise.all(names.map((n) => get("/cards", { name: "eq:" + n }).catch(() => [])))).flat().filter((c) => c && !isPocket(c) && c.id !== card.id),
        rank = await setRank(),
        setOf = (id) => id.slice(0, id.lastIndexOf("-"));
      briefs.sort((a, b) => (rank.get(setOf(b.id)) ?? -1) - (rank.get(setOf(a.id)) ?? -1));
      const full = [];
      for (let i = 0; i < Math.min(briefs.length, card.basicEnergy ? 16 : 12); i += 6)
        full.push(...(await Promise.all(briefs.slice(i, i + 6).map((b) => getCard(b.id).catch(() => null)))));
      const sig = playSig(card),
        same = [card, ...full].filter((c) => c && legal(c) && (card.basicEnergy ? c.basicEnergy : playSig(c) === sig)),
        // Owned printings first, except Basic Energy: owning any one covers them all, so the deck
        // shows the plain cheap printing rather than a gold one you happen to have.
        mine = card.basicEnergy ? [] : same.filter((c) => owned(c) > 0),
        rare = (c) => { const i = PTCG_RARITIES.indexOf(c.rarity); return i < 0 ? 50 : i; },
        cost = (c) => c.prices?.usd ?? Infinity;
      // Prefer printings with a picture (some trainer-kit and promo scans are missing).
      const pool = mine.length ? mine : same.filter((c) => c.image).length ? same.filter((c) => c.image) : same;
      // Never trade a legal card for an illegal one: the original stays when nothing else qualifies.
      const best = pool.sort((a, b) => cost(a) - cost(b) || rare(a) - rare(b))[0] || card;
      return best;
    })().catch(() => card);
    cheapMemo.set(key, run);
    return run;
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
