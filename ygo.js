import { parseCollectorQuery, ygoCodeCandidates } from "./collector-search.js";
import {ygoRarity} from './ygo-identity.js';
import {applyYgoPrices} from './ygo-prices.js';
// Yu-Gi-Oh! adapter. Data: YGOPRODeck (db.ygoprodeck.com) — card text, every
// printing with set rarity and price, TCG/OCG/GOAT banlists, and prices from
// TCGplayer, Cardmarket, eBay, Amazon and CoolStuffInc (refreshed daily).
const API = "https://db.ygoprodeck.com/api/v7";

// A set code is a printing prefix, not a release identity: LOB, SDY and CT10
// each occur on more than one catalogue release. Keep exact names and dates.
export const YGO_SET_CACHE_KEY = "cardforge-ygo-sets-v3";
export const YGO_SET_LEGACY_CACHE_KEY = "cardforge-ygo-sets-v2";
const releaseText = (value) => String(value ?? "").normalize("NFC").trim();
const releasePart = (value) => encodeURIComponent(releaseText(value)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const positiveCount = (value) => ["number", "string"].includes(typeof value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const setFields = (set) => ({
  code: releaseText(set?.set_code ?? set?.code),
  name: releaseText(set?.set_name ?? set?.name),
  date: releaseText(set?.tcg_date ?? set?.date),
});
export function ygoSetId(set) {
  const { code, date, name } = setFields(set);
  // Invalid Unicode is not repaired into a potentially colliding release name.
  try { return code && name ? "ygo:" + [code, date, name].map(releasePart).join(":") : ""; }
  catch { return ""; }
}

// English TCG checklist sizes checked against Konami on 2026-10-17. These
// assertions are scoped to these exact metadata records, never every product
// sharing the prefix. num_of_cards is retained separately as provider rows.
const OFFICIAL_SET_COUNTS = [
  { code: "LOB", names: ["Legend of Blue Eyes White Dragon"], dates: ["2002-03-08"], count: 126, productId: "11101000" },
  { code: "LOB", names: ["Legend of Blue Eyes White Dragon (25th Anniversary Edition)", "Legend of Blue Eyes White Dragon (LC01 25th Anniversary Edition)"], dates: ["2023-04-20", "2023-04-21"], count: 126, productId: "2000001240000" },
  { code: "LOB", names: ["Legend of Blue Eyes White Dragon", "Legend of Blue Eyes White Dragon (25th Anniversary Edition)"], dates: ["2023-07-13", "2023-07-14"], count: 126, url: "https://www.yugioh-card.com/en/products/lob/" },
  { code: "SDY", names: ["Starter Deck: Yugi"], dates: ["2002-03-29"], count: 50, productId: "13301000" },
];
const officialSetCount = ({ code, name, date }) => OFFICIAL_SET_COUNTS.find((s) => s.code === code && s.names.includes(name) && s.dates.includes(date));
const providerSetImage = (value) => {
  if (!value) return "";
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
};

export function normalizeYgoSet(raw) {
  const fields = setFields(raw), id = ygoSetId(fields);
  if (!id) return null;
  const official = officialSetCount(fields), expectedUniqueCards = official?.count ?? null;
  return {
    catalogSchema: 3,
    id,
    legacyId: fields.code,
    ...fields,
    image: providerSetImage(raw.set_image ?? raw.image),
    // Compatibility field is a unique-card count only, never the regional /
    // printing-row total that older caches labelled as "cards".
    count: expectedUniqueCards,
    expectedUniqueCards,
    printingCount: positiveCount(raw.num_of_cards ?? raw.printingCount ?? (raw.catalogSchema === 3 ? null : raw.count)),
    loadedUniqueCards: null,
    completeness: "unknown",
    providerNameAmbiguous: raw.providerNameAmbiguous === true,
    provenance: {
      catalog: { source: "YGOPRODeck", url: API + "/cardsets.php", printingCountField: "num_of_cards" },
      expectedUniqueCards: official ? {
        source: "Konami Yu-Gi-Oh! TCG",
        url: official.url || `https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&pid=${official.productId}&request_locale=en&rp=99999`,
        productId: official.productId || null,
        locale: "en",
        scope: "English TCG checklist",
        verifiedAt: "2026-10-17",
      } : null,
    },
  };
}

export function normalizeYgoSets(rows) {
  const releases = new Map();
  for (const raw of Array.isArray(rows) ? rows : []) {
    const set = normalizeYgoSet(raw);
    if (!set) continue;
    const previous = releases.get(set.id);
    if (previous) {
      // Duplicate copies of the same metadata record do not add another set or
      // inflate its count. Choose fields deterministically, independent of order.
      set.printingCount = positiveCount(Math.max(previous.printingCount || 0, set.printingCount || 0));
      set.image = [previous.image, set.image].filter(Boolean).sort()[0] || "";
      set.providerNameAmbiguous ||= previous.providerNameAmbiguous;
    }
    releases.set(set.id, set);
  }
  const names = new Map();
  for (const set of releases.values()) {
    const key = JSON.stringify([set.code, set.name]);
    names.set(key, (names.get(key) || 0) + 1);
  }
  return [...releases.values()].map((set) => ({ ...set, providerNameAmbiguous: set.providerNameAmbiguous || names.get(JSON.stringify([set.code, set.name])) > 1 }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function migrateYgoSetCache(cache) {
  if (!cache || !Array.isArray(cache.list)) return null;
  const list = normalizeYgoSets(cache.list);
  if (!list.length) return null;
  return {
    schema: 3,
    at: Number.isFinite(cache.at) && cache.at >= 0 ? cache.at : 0,
    list,
    needsRefresh: cache.schema !== 3 || cache.needsRefresh === true || cache.list.some((s) => s?.catalogSchema !== 3 || s?.id !== ygoSetId(s)),
  };
}

// Old #set/LOB links are still supported, but resolve to a chooser when a code
// names multiple releases. Never let catalogue order select an anniversary.
export function resolveYgoSet(list, idOrName) {
  const rows = Array.isArray(list) ? list : [], query = releaseText(idOrName);
  // Filter metadata before materializing full release/provenance objects. A
  // caller resolving one link should not re-sort and clone the whole catalogue.
  let matches = query.startsWith("ygo:") ? rows.filter((s) => ygoSetId(s) === query) : [];
  if (!matches.length && query) matches = rows.filter((s) => setFields(s).name === query);
  if (!matches.length && query && !query.startsWith("ygo:")) matches = rows.filter((s) => setFields(s).code.toUpperCase() === query.toUpperCase());
  const candidates = normalizeYgoSets(matches);
  for (const candidate of candidates) if (!candidate.providerNameAmbiguous) {
    candidate.providerNameAmbiguous = rows.some((row) => {
      const fields = setFields(row);
      return fields.code === candidate.code && fields.name === candidate.name && fields.date !== candidate.date && Boolean(ygoSetId(row));
    });
  }
  return { status: candidates.length === 1 ? "resolved" : candidates.length ? "ambiguous" : "missing", set: candidates.length === 1 ? candidates[0] : null, candidates };
}

export function ygoSetPrintings(card, set) {
  const { code, name } = setFields(set);
  if (!code || !name) return [];
  return (card?.sets || []).filter((p) => releaseText(p.name) === name && (releaseText(p.code) === code || releaseText(p.code).startsWith(code + "-")));
}

// Set views get their own context, without pruning / reordering card.sets or
// changing deck ownership, inventory keys, generic prices, editions or artwork.
export function summarizeYgoSetContents(set, rows, { paginationComplete = true, loadedAt = null, loadError = "", paginationReason = "" } = {}) {
  const release = normalizeYgoSet(set);
  if (!release) throw Error("Choose a specific Yu-Gi-Oh! release before loading its cards.");
  const byId = new Map(), rowCounts = new Map();
  let excludedRows = 0;
  for (const card of Array.isArray(rows) ? rows : []) {
    if (!card?.id) { excludedRows++; continue; }
    const id = String(card.id), previous = byId.get(id);
    rowCounts.set(id, (rowCounts.get(id) || 0) + 1);
    const copy = { ...card, id, sets: (card.sets || []).map((p) => ({ ...p })) };
    delete copy.setContext;
    if (previous) {
      // Repeated / regional provider rows count as one card, while every distinct
      // printing remains available for a later explicit printing selection.
      const seen = new Set(previous.sets.map((p) => JSON.stringify(p)));
      copy.sets = [...previous.sets];
      for (const p of card.sets || []) if (!seen.has(JSON.stringify(p))) {
        copy.sets.push({ ...p });
        seen.add(JSON.stringify(p));
      }
    }
    byId.set(id, copy);
  }
  const cards = [...byId.values()].flatMap((card) => {
    const printings = ygoSetPrintings(card, release).map((p) => ({ ...p }));
    if (!printings.length) { excludedRows += rowCounts.get(card.id); return []; }
    return [{ ...card, setContext: { releaseId: release.id, name: release.name, code: release.code, date: release.date, printings, printingAmbiguous: release.providerNameAmbiguous || printings.length !== 1, releaseAmbiguous: release.providerNameAmbiguous, edition: "unknown" } }];
  });
  const loadedUniqueCards = cards.length, expectedUniqueCards = release.expectedUniqueCards;
  let completeness = "unknown", coverageReason = "expected-count-unknown";
  if (!paginationComplete || loadError) { completeness = "partial"; coverageReason = paginationReason || "provider-pagination-incomplete"; }
  else if (release.providerNameAmbiguous) { coverageReason = "provider-release-date-ambiguous"; }
  else if (expectedUniqueCards !== null) {
    completeness = loadedUniqueCards === expectedUniqueCards ? "complete" : loadedUniqueCards < expectedUniqueCards ? "partial" : "unknown";
    coverageReason = loadedUniqueCards === expectedUniqueCards ? "loaded-count-matches-official" : loadedUniqueCards < expectedUniqueCards ? "fewer-than-expected" : "count-exceeds-expected";
  }
  return {
    cards,
    releaseId: release.id,
    expectedUniqueCards,
    printingCount: release.printingCount,
    loadedUniqueCards,
    completeness,
    paginationComplete: Boolean(paginationComplete && !loadError),
    coverageReason,
    loadError,
    excludedRows,
    provenance: {
      ...release.provenance,
      membership: { source: "YGOPRODeck", url: API + "/cardinfo.php?cardset=" + encodeURIComponent(release.name), match: "exact-release-name-and-code", loadedAt },
    },
  };
}

const EXTRA = new Set(["fusion", "synchro", "xyz", "link", "fusion_pendulum", "synchro_pendulum", "xyz_pendulum"]);
const BAN = { Forbidden: "banned", Limited: "limited", "Semi-Limited": "semi" };
const num = (v) => (v === undefined || v === null || v === "" || Number(v) <= 0 ? null : Number(v));

// Images go through this site's own image route (cached by Cloudflare) as YGOPRODeck
// asks apps not to hotlink; the page falls back to the original if the route is missing.
export const ygoImage = (id, small = true) => `img/ygo/${small ? "s/" : ""}${encodeURIComponent(id)}.jpg`;
export const ygoImageDirect = (id, small = true) => `https://images.ygoprodeck.com/images/cards${small ? "_small" : ""}/${encodeURIComponent(id)}.jpg`;

// YGOPRODeck sometimes lists one printing twice under two spellings ("Starfoil" and "Starfoil Rare").
// Normalised they are the same set, code and rarity; two identical rows would make the printing ambiguous,
// so keep one, preferring the row with a price and then the canonical spelling.
function uniquePrintings(rows) {
  const out = new Map();
  for (const row of rows) {
    const key = row.code + "::" + row.rarity + "::" + row.name, prev = out.get(key);
    if (!prev || (prev.price === null && row.price !== null) || (prev.price === row.price && prev.rarityRaw !== prev.rarity && row.rarityRaw === row.rarity)) out.set(key, row);
  }
  return [...out.values()];
}
export function normalizeYgo(c) {
  const p = c.card_prices?.[0] || {},
    type = c.type || "",
    category = /Spell/.test(type) ? "Spell" : /Trap/.test(type) ? "Trap" : /Skill/.test(type) ? "Skill" : /Token/.test(type) ? "Token" : "Monster",
    stats = [];
  if (category === "Monster") {
    if (c.attribute) stats.push(["Attribute", c.attribute]);
    if (c.level != null && String(c.level).trim() !== "" && !/link/i.test(c.frameType+" "+type)) stats.push([/xyz/i.test(c.frameType) ? "Rank" : "Level", c.level]);
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
    cardType: c.type || "",
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
    sets: uniquePrintings((c.card_sets || []).map((s) => ({ code: s.set_code, name: s.set_name, rarity: ygoRarity(s.set_rarity), rarityRaw:s.set_rarity, price: num(s.set_price) }))),
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
// Rules authority is distinct from provider card-pool / ban-status data.
export const YGO_FORMAT_RULES = Object.freeze({
  edison: Object.freeze({version:'edison-organizer-hand.checked-2026-10-19',checkedAt:'2026-10-19',source:'https://www.edisonformat.com/edison-rule-differences.html',initialHandSource:'https://www.edisonformat.com/uploads/1/3/4/1/134149181/yugioh5dsofficialrulebook.pdf',scope:'Initial hand 5; the first player draws in their first Draw Phase. This hand-rule evidence does not supply the missing Edison banlist.'}),
  goat: Object.freeze({version:'goat-organizer.checked-2026-10-19',checkedAt:'2026-10-19',source:'https://www.goatformat.com/basics.html',scope:'Original organizer Main/Fusion sizes. Intermediate Side sizes and online-platform caps are variant-dependent; provider GOAT pool/ban status is not an independently refreshed historical list.'}),
  speed: Object.freeze({version:'KDE-US-Speed-Duel-Addendum-1.2',effectiveAt:'2022-03-11',checkedAt:'2026-10-19',source:'https://www.yugioh-card.com/en/downloads/penalty_guide/Speed_Duel_Addendum_1.2_KDE-US.pdf',drawSource:'https://img.yugioh-card.com/eu/wp-content/uploads/2022/07/Speed_Duel_Guide_EN.pdf',scope:'KDE-US constructed baseline: Main 20–30, Extra/Side at most 6, optional initial Skill. Printing logo and event-specific restrictions are not certified by provider pool membership.'}),
});
export const YGO_FORMATS = [
  { id: "tcg", name: "Advanced (TCG)", main: [40, 60], extra: 15, side: 15, pool: "TCG", ban: "tcg" },
  { id: "traditional", name: "Traditional (TCG)", main: [40, 60], extra: 15, side: 15, pool: "TCG", ban: "tcg", traditional: true },
  { id: "ocg", name: "OCG", main: [40, 60], extra: 15, side: 15, pool: "OCG", ban: "ocg" },
  { id: "goat", name: "GOAT", main: [40, Infinity], extra: Infinity, side: 15, firstTurnCards:6, secondTurnCards:6, pool: "GOAT", ban: "goat", rules:YGO_FORMAT_RULES.goat },
  { id: "edison", name: "Edison", main: [40, 60], extra: 15, side: 15, firstTurnCards:6, secondTurnCards:6, pool: "Edison", rules:YGO_FORMAT_RULES.edison, note: "Edison's own list isn't in the data; card pool only." },
  { id: "md", name: "Master Duel", main: [40, 60], extra: 15, side: 15, pool: "Master Duel", note: "Master Duel's banlist isn't in the data; card pool only." },
  { id: "speed", name: "Speed Duel", main: [20, 30], extra: 6, side: 6, firstTurnCards:4, secondTurnCards:5, pool: "Speed Duel", rules:YGO_FORMAT_RULES.speed },
  { id: "dl", name: "Duel Links", main: [20, 30], extra: 8, side: 8, pool: "Duel Links", note: "Duel Links' limited list isn't in the data; card pool only." },
  { id: "casual", name: "Casual", main: [40, 60], extra: 15, side: 15 },
];

export const ygoZoneRange = (f, zone) => zone === 'main' ? (Number.isFinite(f.main[1]) ? `${f.main[0]}–${f.main[1]}` : `${f.main[0]}+ (no maximum)`) : Number.isFinite(f[zone]) ? `0–${f[zone]}` : 'No maximum';
const poolKey = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
// How many copies a format allows.
export function ygoLimit(card, f) {
  if (!f.ban) return 3;
  const s = card.ban?.[f.ban];
  if (s === "banned") return f.traditional ? 1 : 0;
  return s === "limited" ? 1 : s === "semi" ? 2 : 3;
}
export function ygoLegality(card, f) {
  if (f.pool && (!Array.isArray(card.pools) || !card.pools.length)) return 'unknown';
  if (f.pool && !card.pools.some(pool => poolKey(pool) === poolKey(f.pool))) return "not_legal";
  if (f.ban && (!card.ban || !Object.hasOwn(card.ban, f.ban) || ![null,'banned','limited','semi'].includes(card.ban[f.ban]))) return 'unknown';
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
  if (main < f.main[0] || main > f.main[1]) issues.push({ level: "bad", text: `Main Deck has ${main} cards; ${f.name} needs ${ygoZoneRange(f,'main')}.` });
  if (extra > f.extra) issues.push({ level: "bad", text: `Extra Deck has ${extra}; the limit is ${f.extra}.` });
  if (side > f.side) issues.push({ level: "bad", text: `Side Deck has ${side}; the limit is ${f.side}.` });
  if(f.note)issues.push({level:"pending",text:f.note});
  if (f.id === 'goat') {
    if (side > 0 && side < 15) issues.push({level:'pending',text:`GOAT Side Deck has ${side} cards: original rules use 0 or 15, while many events relax this. The intended Side Deck variant has not been verified.`});
    issues.push({level:'warn',text:'GOAT uses original organizer rules with no Main/Fusion maximum; online-platform caps and event variants are not assumed. Historical pool and ban status come from the card provider.'});
  }
  if (f.id === 'speed') {
    issues.push({level:'warn',text:'Speed Duel checks cover constructed sizes and provider card-pool membership only. The physical Speed Duel logo and any event-specific Forbidden & Limited list still need verification; no universal list is assumed.'});
    const declared = [deck.skill,deck.skillCard,deck.skillCards,deck.skills,deck.sideSkills,z.skill,z.skills].some(v => Array.isArray(v) ? v.length > 0 : Boolean(v));
    if (declared) issues.push({level:'pending',text:'A Speed Duel Skill is declared, but the initial Skill designation and complete Skill rules are not represented by this deck editor. Skills are optional; a Skill-free deck does not need one.'});
  }
  const totals = new Map();
  for (const zone of ["main", "extra", "side"])
    for (const r of z[zone] || []) {
      totals.set(r.cardId, (totals.get(r.cardId) || 0) + r.qty);
      const c = cardOf(r.cardId);
      if (!c) {issues.push({level:"pending",text:`${r.qty}× ${r.name||r.cardId}: card details not loaded.`});continue;}
      if (c.brief || !c.name || !c.category) issues.push({level:'pending',text:`${r.name || r.cardId}: complete card identity and rules data need verification.`});
      if(ygoLegality(c,f)==='unknown')issues.push({level:"pending",text:`${c.name}: format pool or ban-status data not verified.`});
      if (f.id === 'speed' && c.category === 'Skill') {
        issues.push({level:'pending',text:`${c.name}: Skill selection/rules are not fully represented. Side Deck Skills count toward the six-card Side Deck limit.`});
        if (zone !== 'side') issues.push({level:'bad',text:`${c.name}: the initial Skill must be separate from the Main and Extra Decks.`});
      }
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

// Normalize category-dependent controls at both the UI and adapter boundary.
// Incompatible hidden fields must never survive a saved search or direct caller.
export function normalizeYgoSearch(spec = {}) {
  const out = { ...spec };
  const nonMonster = /Spell|Trap|Skill|Token/.test(out.type || ""), link = /Link/.test(out.type || "");
  const races = out.type === "Spell Card" ? YGO_SPELL_KINDS : out.type === "Trap Card" ? YGO_TRAP_KINDS : YGO_RACES;
  if (out.race && !races.includes(out.race) && (out.type || [...YGO_SPELL_KINDS, ...YGO_TRAP_KINDS].includes(out.race))) delete out.race;
  if (nonMonster) for (const key of ["attribute", "level", "atk", "def"]) delete out[key];
  if (link) for (const key of ["level", "def"]) delete out[key];
  if ((nonMonster && /^(atk|def|level)/.test(out.sort || "")) || (link && /^(def|level)/.test(out.sort || ""))) out.sort = "name";
  return out;
}
// Provider guide: https://portal.ygoprodeck.com/api-guide/ (checked 2026-10-17).
// Query formats and misc_info.formats are different documented lists. OCG is
// membership data, not a supported format query; Edison is documented in neither.
const searchPoolKey = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const YGO_SEARCH_POOLS = new Set(["tcg", "ocg", "master duel", "goat", "ocg goat", "duel links", "rush duel", "speed duel"]);
const YGO_SEARCH_QUERY_FORMATS = new Set(["tcg", "goat", "ocg goat", "speed duel", "master duel", "rush duel", "duel links", "genesys"]);
export const ygoSearchFormatSupported = format => !format?.pool || YGO_SEARCH_POOLS.has(searchPoolKey(format.pool));
export function ygoSearchFormatLabel(format) {
  if (!format?.pool) return "All cards · no legality check";
  if (!ygoSearchFormatSupported(format)) return format.name + " · verification unavailable";
  return format.ban ? "Legal in " + format.name : "Card pool: " + format.name;
}
export function ygoSearchEligibility(card, format) {
  if (!format) return "legal";
  if (!ygoSearchFormatSupported(format)) return "unknown";
  // This projection is Search-only: leave source records and deck helpers
  // unchanged, while accepting documented lowercase and older cached casing.
  const pools = Array.isArray(card.pools) ? card.pools.map(searchPoolKey).filter(Boolean) : [];
  if (format.pool && !pools.length) return "unknown";
  return ygoLegality({ ...card, pools }, { ...format, pool:searchPoolKey(format.pool) });
}

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
  async search(spec = {}) {
    const { q = "", text = "", type = "", attribute = "", race = "", level = "", format = "", set = "", archetype = "", sort = "name", page = 0, size = 60, paging = null } = normalizeYgoSearch(spec);
    // A printed code ("BLZD-EN010", "blzd 10", "en010 blzd") finds that card exactly; otherwise search by name.
    const collector = !page && !text ? parseCollectorQuery("ygo", q) : null;
    if (collector) {
      for (const code of ygoCodeCandidates(collector)) {
        const hit = await get("/cardsetsinfo.php", { setcode: code }).catch(() => null);
        if (!hit?.id) continue;
        const d = await get("/cardinfo.php", { id: hit.id, misc: "yes" }).catch(() => null);
        const cards = (d?.data || []).map(normalizeYgo);
        if (cards.length) return { cards, total: cards.length, more: false, printing: hit.set_code };
      }
    }
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
    const selectedPool = searchPoolKey(YGO_FORMATS.find(x => x.id === format)?.pool), pool = YGO_SEARCH_QUERY_FORMATS.has(selectedPool) ? selectedPool : "";
    if (race) p.race = race;
    if (level) p.level = level;
    if (pool) p.format = pool;
    if (desc) {
      const total = paging?.sort === p.sort && Number.isSafeInteger(paging.total) && paging.total >= 0 ? paging.total : Number((await get("/cardinfo.php", { ...p, num: 1, offset: 0 })).meta?.total_rows) || 0,
        end = Math.max(0, total - page * size),
        start = Math.max(0, end - size);
      if (!end) return { cards: [], total, more: false, paging: { sort:p.sort, total } };
      const d = await get("/cardinfo.php", { ...p, num: end - start, offset: start });
      return { cards: (d.data || []).map(normalizeYgo).reverse(), total, more: start > 0, paging: { sort:p.sort, total } };
    }
    const d = await get("/cardinfo.php", p);
    return { cards: (d.data || []).map(normalizeYgo), total: d.meta?.total_rows ?? (d.data || []).length, more: Number(d.meta?.rows_remaining) > 0 };
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
  async archetypeNames() {
    archetypes ||= get("/archetypes.php").then((d) => (Array.isArray(d) ? d : []).map((a) => a.archetype_name)).catch((e) => ((archetypes = null), Promise.reject(e)));
    return [...await archetypes].filter(n=>typeof n==='string'&&n.trim()).sort();
  },
  // Cards of a random archetype with enough members to build around.
  async randomArchetype() {
    const names = await this.archetypeNames();
    for (let i = 0; i < 5; i++) {
      const name = names[Math.floor(Math.random() * names.length)];
      const r = await this.search({ archetype: name, size: 100 });
      if (r.cards.filter((c) => c.category === "Monster" && !c.extra).length >= 3) return { name, cards: r.cards };
    }
    throw Error("Couldn’t find a random archetype. Try again.");
  },
  async sets() {
    const d = await get("/cardsets.php");
    if (!Array.isArray(d)) throw Error("Yu-Gi-Oh! set catalogue returned an invalid response.");
    return normalizeYgoSets(d);
  },
  async setContents(set) {
    const release = normalizeYgoSet(set);
    if (!release) throw Error("Choose a specific Yu-Gi-Oh! release before loading its cards.");
    const out = [], seenPages = new Set();
    let paginationComplete = false, loadError = "", paginationReason = "provider-page-limit";
    for (let page = 0; page < 20; page++) {
      try {
        const d = await get("/cardinfo.php", { cardset: release.name, num: 100, offset: page * 100, misc: "yes" });
        if (!Array.isArray(d.data)) throw Error("Yu-Gi-Oh! card list returned an invalid response.");
        const fingerprint = JSON.stringify(d.data.map((c) => [c.id, c.card_sets]));
        if (d.data.length && seenPages.has(fingerprint)) { paginationReason = "provider-repeated-page"; break; }
        seenPages.add(fingerprint);
        out.push(...d.data.map(normalizeYgo));
        const remaining = d.meta?.rows_remaining;
        if (remaining != null ? Number(remaining) === 0 : d.data.length < 100) {
          paginationComplete = true;
          paginationReason = "";
          break;
        }
        if (!d.data.length) { paginationReason = "provider-empty-page"; break; }
      } catch (e) {
        if (!out.length) throw e;
        // Keep usable earlier pages, but never describe them as a full checklist.
        // Do not retry denied / unavailable providers or substitute a prefix union.
        loadError = e.message || "Yu-Gi-Oh! card list temporarily unavailable.";
        paginationReason = "provider-request-failed";
        break;
      }
    }
    return summarizeYgoSetContents(release, out, { paginationComplete, loadError, paginationReason, loadedAt: new Date().toISOString() });
  },
  async setCards(set) {
    // Existing callers still receive an array. Set-page callers use setContents
    // so partial provider coverage never becomes an incorrect 100% progress bar.
    return (await this.setContents(set)).cards;
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
