import {POKEMON_VARIANT_SCHEMA,pokemonDetailedRecords,pokemonPhysicalFinish,syncPokemonVariantAliases} from './pokemon-variant-options.js';
import {pokemonPromoEvidence,pokemonPromoAliasMatches,pokemonPromoRootProduct} from './pokemon-promo-evidence.js';
import {referenceQuote} from './price-reference.js';
import {pokemonPrintedName,pokemonPrintedNameKey} from './pokemon-identity.js';
import {applyProductPrices} from "./pokemon-prices.js";
import {POKEMON_SET_ART} from './pokemon-set-art.js';
import {pokemonFallback} from "./artwork.js";
import {pokemonCatalogueFallback,pokemonCatalogueOverlay,pokemonCatalogueSet} from './pokemon-catalogue-supplement.js';
import {GLC_RULES,GLC_BANS,GLC_SHARED_NAMES} from './ptcg-glc-rules.js';
// Pokémon TCG adapter. Data: TCGdex (api.tcgdex.net) — every physical card and set,
// Standard/Expanded legality, regulation marks, and daily TCGplayer (USD) and
// Cardmarket (EUR) prices per variant. Pokémon TCG Pocket (digital) cards are excluded.
const API = "https://api.tcgdex.net/v2/en";

const isPocket = (c) => /\/tcgp\//.test(c?.image || "") || c?.set?.id?.startsWith?.("A") && /^[A-Z]\d/.test(c.set.id) || /^P-A/.test(c?.id || "");
const n = (v) => (typeof v === "number" && v > 0 ? v : null);
export const ptcgImage = (base, size = "low") => (base ? /\.(webp|png|jpe?g)(?:\?|$)/i.test(base) ? base : `${base}/${size}.webp` : "");

const RULE_BOX = /\b(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.X|Tera)\b/;
const hasAceSpec = c => c?.aceSpec === true || /ACE SPEC/i.test([c?.rarity,...(c?.subtypes || [])].join(' ')) || /You (?:can(?:not|['’]t)|may not) have more than (?:1|one) ACE SPEC card/i.test(c?.effect || '');
const hasRuleBox = c => c?.ruleBox === true || hasAceSpec(c) || /Prism Star|[◇♢]/i.test([c?.name,c?.rarity,...(c?.subtypes || [])].join(' ')) ||
  (c?.category === 'Pokemon' && (RULE_BOX.test(c?.name || '') || /^Radiant /i.test(c?.name || '') || c?.radiant === true));
const VARIANT_LABEL = { normal: "Normal", holofoil: "Holofoil", "reverse-holofoil": "Reverse holo", "1st-edition": "1st Edition", "1st-edition-holofoil": "1st Ed. holo", unlimited: "Unlimited", "unlimited-holofoil": "Unlimited holo" };

// Availability is independent of price. Detailed records include Shadowless,
// stamped promos, copyright runs and other versions omitted by pricing alone.
export function pokemonVariants(c) {
  const legacy = Object.entries(c.pricing?.tcgplayer || {}).filter(([,v]) => v && typeof v === "object" && "marketPrice" in v)
    .map(([key,v]) => ({ key, label: VARIANT_LABEL[key] || key, usd: referenceQuote(v)?.value??null, priceKind:referenceQuote(v)?.kind, low:n(v.lowPrice), mid:n(v.midPrice), market:n(v.marketPrice), productId:v.productId }));
  const out = new Map();
  const title = value => String(value).split("-").map(x => x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
  for (const record of pokemonDetailedRecords(c)) {
    const d=record.detail;
    const first = d.stamp?.includes("1st-edition"), finish = { holo:"holofoil", reverse:"reverse-holofoil", normal:"normal" }[d.type];
    const foil = typeof d.foil === "string" ? d.foil.trim() : "";
    const special = d.subtype && d.subtype !== "unlimited" || (d.stamp || []).some(x => x !== "1st-edition") || d.size && d.size !== "standard";
    const wanted = first ? [d.type === "holo" ? "1st-edition-holofoil" : "1st-edition"] : d.subtype === "unlimited" || c.variants?.firstEdition ? [d.type === "holo" ? "unlimited-holofoil" : "unlimited", finish] : [finish];
    const bucket = wanted.find(k => d.pricing?.tcgplayer?.[k]);
    // Patterned reverse products are sold in a Holofoil bucket, but remain
    // physically reverse foil. Never borrow another product's quote.
    const patterned = d.type === "reverse" && ["pokeball", "masterball"].includes(foil);
    const patternQuote = patterned ? d.pricing?.tcgplayer?.holofoil : null;
    const exactPatternQuote = patternQuote && d.thirdParty?.tcgplayer && String(patternQuote.productId) === String(d.thirdParty.tcgplayer) ? patternQuote : null;
    const bucketQuote = bucket ? d.pricing.tcgplayer[bucket] : null;
    const exactBucketQuote = bucketQuote&&(!d.thirdParty?.tcgplayer&&!foil||String(bucketQuote.productId)===String(d.thirdParty?.tcgplayer))?bucketQuote:null;
    const q = exactBucketQuote || exactPatternQuote || {};
    // A plain finish TCGdex knows nothing more about (no price, no product) is the same version
    // as the per-finish price below: key it by finish so the two merge instead of listing twice.
    const bare = !special && !bucket && !d.pricing && !d.thirdParty?.tcgplayer;
    const key = record.key;
    const foilLabel = {pokeball:"Poké Ball",masterball:"Master Ball"}[foil] || (foil ? title(foil) : "");
    const evidence=pokemonPromoEvidence(c.id,d.thirdParty?.tcgplayer);
    const label = [evidence?.label||"", first ? "First Edition" : "", d.subtype ? title(d.subtype) : "", ...(d.stamp || []).filter(x => x !== "1st-edition").map(x => x === "set-logo" ? "Set-logo stamped" : title(x)), d.size && d.size !== "standard" ? title(d.size) : "", {holo:"Holofoil",reverse:"Reverse Holo",normal:"Normal"}[d.type] || title(d.type || "Version"), foilLabel].filter(Boolean).join(" · ");
    if(out.has(key)){out.set(key,{key,label:"Version identity unconfirmed",finish:"",usd:null});continue;}
    out.set(key, { key, label, finish, foil, ...(exactPatternQuote && q === exactPatternQuote ? {pricePrinting:"Holofoil"} : {}), size:d.size||"standard", subtype:d.subtype||"", stamps:[...(d.stamp||[])], usd:referenceQuote(q)?.value??null, priceKind:referenceQuote(q)?.kind, low:n(q.lowPrice), mid:n(q.midPrice), market:n(q.marketPrice), productId:q.productId || d.thirdParty?.tcgplayer, cmProduct:d.thirdParty?.cardmarket, detailed:true, image: typeof d.image === "string" ? (/[.](?:webp|png|jpe?g)(?:[?]|$)/i.test(d.image) ? d.image : ptcgImage(d.image)) : "", imageLarge: typeof d.image === "string" ? (/[.](?:webp|png|jpe?g)(?:[?]|$)/i.test(d.image) ? d.image : ptcgImage(d.image,"high")) : "" });
  }
  for (const v of legacy) {
    const have = out.get(v.key);
    if (!have) {
      if(v.key==='holofoil'&&pokemonPromoRootProduct(c.id)&&String(v.productId)!==String(pokemonPromoRootProduct(c.id))){out.set(v.key,{key:v.key,label:'Version identity unconfirmed',usd:null});continue;}
      const candidates=[...out.values()].filter(x=>x.detailed&&x.productId&&String(x.productId)===String(v.productId)&&x.finish===pokemonPhysicalFinish(v)&&pokemonPromoAliasMatches(c.id,v,x));
      if(candidates.length===1){const canonical=candidates[0];if(canonical.usd==null)Object.assign(canonical,{usd:v.usd,priceKind:v.priceKind,low:v.low,mid:v.mid,market:v.market});out.set(v.key,{...canonical,key:v.key,aliasOf:canonical.key});}
      else out.set(v.key,v);
    }
    else if (have.usd == null && !have.productId && !/identity unconfirmed/i.test(have.label)) out.set(v.key,{ ...have, ...v, label: have.label, finish: have.finish, image: have.image, imageLarge: have.imageLarge });
  }
  // Older/incomplete responses still expose version availability flags.
  for (const [flag,key,label] of [["normal","normal","Normal"],["holo","holofoil","Holofoil"],["reverse","reverse-holofoil","Reverse Holo"]]) {
    if (c.variants?.[flag] && ![...out.values()].some(v => v.key === key || pokemonPhysicalFinish(v) === key || v.label.endsWith(label))) out.set(key,{key,label,usd:null});
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
  let filled = false;const updatedKeys=[];
  for (const [k, v] of Object.entries(tp)) {
    const ref=referenceQuote(v),usd=ref?.value;
    if (usd == null) continue;
    const key = PTCG_API_KEYS[k] || k,
      variant = c.variants?.find((x) => x.key === key);
    if (variant && variant.usd == null) {
      Object.assign(variant,{usd,market:n(v.market),mid:n(v.mid),low:n(v.low),priceKind:ref.kind});
      variant.fallback = true;updatedKeys.push(variant.key);
      filled = true;
    } else if (!variant && !c.variants?.some((x) => x.usd != null)) {
      (c.variants ||= []).push({ key, label: VARIANT_LABEL[key] || key, usd, priceKind:ref.kind, fallback: true });
      filled = true;
    }
  }
  if (!filled) return false;
  syncPokemonVariantAliases(c,updatedKeys);
  const best = c.variants.find((v) => v.key === "normal" && v.usd) || c.variants.find((v) => v.usd);
  c.prices.usd = best?.usd ?? null;
  c.prices.referenceKind=best?.priceKind||"market";
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
  if(c.prices?.usd==null||c.variants?.some(v=>v.productId&&v.usd==null)){
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
  syncPokemonVariantAliases(c);
  const best = c.variants.find((v) => v.key === "normal" && v.usd != null) || c.variants.find((v) => v.usd != null);
  if (best && c.prices.usd == null) {
    c.prices.usd = best.usd;
    c.prices.source = "TCGplayer market (USD), latest dated quote";
    c.prices.updated = best.historyQuote || c.prices.updated;
    if (c.sets?.[0]) c.sets[0].price = c.prices.usd;
  }
}

// Energy icons may be empty/nested elements or images. Read only explicit,
// recognized labels, never infer rules from an attack's cost or an icon URL.
const ENERGY_WORDS = ['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Dragon','Colorless','Fairy'];
function energyMarkupLabel(attributes) {
  const labels = [...attributes.matchAll(/\b(?:title|alt|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(m => m[1] ?? m[2] ?? m[3]);
  for (const label of labels) {
    const word = ENERGY_WORDS.find(w => new RegExp('^' + w + '(?: Energy)?$', 'i').test(label.trim()));
    if (word) return word;
  }
  const classes = attributes.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const tokens = (classes?.[1] || classes?.[2] || '').split(/\s+/);
  return tokens.includes('energy-symbol') ? ENERGY_WORDS.find(w => tokens.some(t => t.toLowerCase() === w.toLowerCase())) || '' : '';
}
export function plainText(t) {
  let text = String(t ?? '').replace(/<img\b([^>]*)\/?\s*>/gi, (_, attributes) => energyMarkupLabel(attributes));
  // Repeated passes handle a labelled icon nested inside an unlabelled span.
  for (let i = 0; i < 4; i++) text = text.replace(/<(span|i|abbr|svg)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_, tag, attributes, body) => energyMarkupLabel(attributes) || body);
  return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

const BROKEN_LUGIA_EFFECT = 'Discard a Energy card, a Energy card, and a Energy card attached to Lugia in order to use this attack.';
const LUGIA_EFFECT = 'Discard a Fire Energy card, a Water Energy card, and a Lightning Energy card attached to Lugia in order to use this attack.';
function normalizedAttack(card, attack) {
  const sourceEffect = String(attack.effect ?? ''), effect = plainText(sourceEffect);
  const corrected = card.id === 'neo1-9' && card.name === 'Lugia' && (!card.set?.id || card.set.id === 'neo1') &&
    (!card.localId || /^0*9$/.test(String(card.localId))) && attack.name === 'Elemental Blast' && effect === BROKEN_LUGIA_EFFECT;
  return {cost:attack.cost || [], name:attack.name, damage:attack.damage ?? '', effect:corrected ? LUGIA_EFFECT : effect,
    sourceEffect, ...(corrected ? {effectProvenance:{source:'Neo Genesis 9/111 printed card',
      url:'https://images.pokemontcg.io/neo1/9_hires.png',
      corroboratedBy:'https://www.tcgcollector.com/cards/979/lugia-neo-genesis-9-111',
      verified:'2026-10-18',correction:'Restored the printed Fire, Water and Lightning discard symbols.'}} : {}),
    ...(!corrected && /\ba\s+Energy\b/.test(effect) ? {effectIncomplete:true} : {})};
}

const catalogueSets = new Map();
function cardSet(c) {
  // TCGdex's card ID is set-id plus a collector token. Keep zeros and prefixes;
  // reject malformed/path-shaped IDs rather than inventing an unrelated set.
  const parsed = String(c.id || '').match(/^([A-Za-z0-9][A-Za-z0-9.-]*)-([A-Za-z]*\d+[A-Za-z]?)$/);
  const id = c.set?.id || parsed?.[1];
  if (!id) return null;
  const known = catalogueSets.get(id) || {}, set = pokemonCatalogueSet({...known,...c.set,id});
  return {id, name:set.name || '', number:String(c.localId ?? c.set?.number ?? parsed?.[2] ?? ''),
    total:set.cardCount?.official ?? set.total ?? set.count, symbol:set.symbol || '', releaseDate:set.releaseDate || set.date || ''};
}
export function normalizePtcg(c) {
  // TCGdex has no stage for many older EX/GX cards (Celebi-EX, Palkia GX). A Pokémon that
  // evolves from nothing is a Basic Pokémon.
  // V-UNION pieces and LEGEND halves aren't Basic Pokémon.
  if (c.category === "Pokemon" && !c.stage && !c.evolveFrom && !/V-UNION|\bLEGEND$/.test(c.name || "")) c = { ...c, stage: "Basic" };
  // Older trainers often have no type: read it from the rules text, as the card itself says.
  if (c.category === "Trainer" && !c.trainerType) {
    const t = plainText(c.effect || c.description || "");
    const type = /Technical Machine/i.test(c.name + " " + t) ? "Technical Machine" : /\bSupporter\b/i.test(t) ? "Supporter" : /\bStadium\b|stays in play when you play it/i.test(t) ? "Stadium" : /Pokémon Tool|Tool card/i.test(t) ? "Tool" : "Item";
    c = { ...c, trainerType: type };
  }
  // Basic Energy with no energy type (some trainer-kit printings).
  if (c.category === "Energy" && !c.energyType && /^(?:Basic )?(?:Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$/.test(c.name || "")) c = { ...c, energyType: "Normal" };
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
  const attacks = (c.attacks || []).map(a => normalizedAttack(c,a)), set = cardSet(c);
  const text = [
    ...(c.abilities || []).map((a) => `${a.type || "Ability"}: ${a.name}\n${plainText(a.effect)}`),
    ...attacks.map((a) => `[${a.cost.join(" · ") || "—"}] ${a.name}${a.damage ? " — " + a.damage : ""}${a.effect ? "\n" + a.effect : ""}${a.effectIncomplete ? '\nRules text may be incomplete; check the printed card.' : ''}`),
    plainText(c.effect),
    c.description && !c.attacks ? plainText(c.description) : "",
  ].filter(Boolean).join("\n\n");
  return {
    game: "ptcg",
    variantSchema: POKEMON_VARIANT_SCHEMA,
    priceFallbackSchema: 3,
    ...(c.catalogueProvenance?{catalogueProvenance:{...c.catalogueProvenance}}:{}),
    released:set?.releaseDate || "",
    id: c.id,
    name: c.name,
    category: c.category || "Pokemon",
    typeLine: [c.category === "Pokemon" ? "Pokémon" : c.category, c.stage?.replace(/^Stage(\d)/, "Stage $1"), c.trainerType, c.energyType && c.energyType + " Energy", c.types?.join("/")].filter(Boolean).join(" · "),
    text,
    stats,
    rarity: /^(none|null|unknown)$/i.test(c.rarity||"")?"":c.rarity || "",
    illustrator: c.illustrator || "",
    set,
    sets: set ? [{ code: set.id + " " + set.number, name: set.name, rarity: c.rarity, price: best?.usd ?? null }] : [],
    variants,
    prices: { usd: best?.usd ?? null, referenceKind:best?.priceKind||"market", eur: n(cm.trend) ?? n(cm.avg), others: [], source: "TCGplayer market (USD) · Cardmarket trend (EUR)", updated: tp.updated || cm.updated || null },
    cardmarket: { low: n(cm.low), avg: n(cm.avg), trend: n(cm.trend), avg30: n(cm.avg30), holoLow: n(cm["low-holo"]), holoAvg: n(cm["avg-holo"]), holoTrend: n(cm["trend-holo"]) },
    cmProduct: cm.idProduct || null,
    legal: { standard: typeof c.legal?.standard === 'boolean' ? c.legal.standard : null, expanded: typeof c.legal?.expanded === 'boolean' ? c.legal.expanded : null },
    regulationMark: c.regulationMark || "",
    stage: c.stage || "",
    hp: c.hp || null,
    abilities: (c.abilities || []).map((a) => ({ type: a.type || "Ability", name: a.name, effect: plainText(a.effect) })),
    attacks,
    rulesIncomplete:attacks.some(a => a.effectIncomplete),
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
    aceSpec: hasAceSpec(c),
    radiant: /^Radiant /.test(c.name),
    ruleBox: hasRuleBox(c),
    prize: prizeValue(c),
    image: ptcgImage(c.image, "low") || pokemonFallback(c),
    imageLarge: ptcgImage(c.image, "high") || pokemonFallback(c),
    pocket: isPocket(c),
    fetchedAt: new Date().toISOString(),
  };
}

// A search hit before details load (no price yet).
const ptcgImageAsset = url => /\.(?:png|webp|jpe?g)(?:\?|$)/i.test(url) ? url : url+".webp";
export function normalizePtcgBrief(c) {
  const set = cardSet(c);
  return {game:'ptcg',id:c.id,name:c.name,set,released:set?.releaseDate || '',
    ...(c.category ? {category:c.category} : {}), ...(c.rarity ? {rarity:c.rarity} : {}),
    ...(c.catalogueProvenance ? {catalogueProvenance:{...c.catalogueProvenance},variants:pokemonVariants(c)} : {}),
    image:ptcgImage(c.image,'low') || pokemonFallback(c),imageLarge:ptcgImage(c.image,'high') || pokemonFallback(c),
    brief:true,prices:{},sets:set ? [{code:set.id+' '+set.number,name:set.name,rarity:c.rarity,price:null}] : [],stats:[],pocket:isPocket(c)};
}
const brief = normalizePtcgBrief;

export const PTCG_FORMATS = [
  { id: "standard", name: "Standard", legal: "standard", copies: 4 },
  { id: "expanded", name: "Expanded", legal: "expanded", copies: 4 },
  { id: "unlimited", name: "Unlimited", copies: 4 },
  { id: "glc", name: "Gym Leader Challenge", copies: 1, noRuleBox: true, noAceSpec: true, sharedType: true, rules: GLC_RULES },
];

const glcCollectorKey = value => String(value || '').split('/')[0].trim().toUpperCase().replace(/^([A-Z]*)0+(?=\d)/,'$1');
const glcName = value => pokemonPrintedNameKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const glcSetKey = value => POKEMON_SET_ART[String(value || '').toLowerCase()]?.id || String(value || '').toLowerCase();
const glcCopyName = value => pokemonPrintedName(value).replace(/^(Boss's Orders)\s+\([^()]+\)$/i,'$1');
function glcPrinting(c) {
  const parsed = String(c.id || '').match(/^([A-Za-z0-9][A-Za-z0-9.-]*)-([A-Za-z]*\d+[A-Za-z]?)$/);
  const set = String(c.set?.id || parsed?.[1] || '').toLowerCase(), number = glcCollectorKey(c.set?.number || c.localId || parsed?.[2]);
  const conflict = parsed && (c.set?.id && glcSetKey(c.set.id) !== glcSetKey(parsed[1]) || (c.set?.number || c.localId) && number !== glcCollectorKey(parsed[2]));
  return { set, number, conflict };
}
// Unknown is intentionally not legal: missing identity, an old-print erratum or
// a modern commemorative reprint must not be certified from its release date.
export function glcCardEligibility(c) {
  if (!c || c.brief || !c.name || !['Pokemon','Trainer','Energy'].includes(c.category)) return {status:'unknown',reason:'card identity and complete rules data need verification'};
  if (c.pocket) return {status:'not_legal',reason:'Pokémon TCG Pocket cards are not part of this format'};
  if (hasAceSpec(c)) return {status:'not_legal',reason:'ACE SPEC cards are not allowed'};
  if (hasRuleBox(c)) return {status:'not_legal',reason:'Rule Box cards of any category are not allowed'};
  if (/cannot be used in (?:official )?tournaments/i.test([c.text,c.effect].join(' '))) return {status:'not_legal',reason:'this card is not permitted in tournament play'};
  if (c.basicEnergy) return {status:'legal',reason:'Basic Energy exception'};
  const printing = glcPrinting(c), name = glcName(c.name), ban = GLC_BANS.find(b => glcName(b.name) === name);
  if (printing.conflict) return {status:'unknown',reason:'card ID and set/collector identity conflict; verify the exact printing'};
  const release = c.released || c.set?.releaseDate;
  if (/^\d{4}-\d{2}-\d{2}/.test(release || '') && release.slice(0,10) > GLC_RULES.checkedAt) return {status:'unknown',reason:'release is later than the verified GLC rules snapshot; regional availability needs verification'};
  if (ban?.allVersions || ban?.printings?.some(([set,num]) => printing.set === set && printing.number === glcCollectorKey(num))) return {status:'not_legal',reason:`on the GLC ban list (effective ${ban.effectiveAt})`};
  if (ban && (!printing.set || !printing.number)) return {status:'unknown',reason:'exact set and collector number are required for GLC’s printing-specific ban list'};
  const classic = /^(?:cel25cc|cel25c)$/.test(printing.set) || /Celebrations.*Classic Collection/i.test(c.set?.name || '');
  if (classic) return ['reshiram','zekrom'].includes(name) ? {status:'legal',reason:'GLC FAQ permits these Black & White Classic Collection reprints'} : {status:'not_legal',reason:'the GLC FAQ excludes this Celebrations Classic Collection card'};
  if (/^(?:cl[bfv]|p-tcg-classic)/i.test(printing.set) || /Trading Card Game Classic|Pokémon TCG Classic/i.test(c.set?.name || '')) return {status:'unknown',reason:'TCG Classic functional reprint eligibility needs verification'};
  // A positive Expanded membership is usable as pool/reprint evidence only.
  // A negative is NOT a GLC ban; Delinquent and Hex Maniac are explicit examples.
  if (c.legal?.expanded === true) return {status:'legal',reason:'Black & White-onward pool or eligible reprint, with GLC’s own restrictions'};
  const known = POKEMON_SET_ART[printing.set] || Object.values(POKEMON_SET_ART).find(s => s.id === printing.set);
  if (known && ['Black & White','XY','Sun & Moon','Sword & Shield','Scarlet & Violet','Mega Evolution'].includes(known.series) && known.date <= GLC_RULES.checkedAt) return {status:'legal',reason:'identified Black & White-onward printing, with GLC’s own restrictions'};
  if (known && known.date < '2011-03-01' && c.category === 'Pokemon') return {status:'not_legal',reason:'Pokémon printing predates the Black & White card pool'};
  return {status:'unknown',reason:'Black & White-onward pool, regional release or older-print reprint eligibility needs verification'};
}

export function ptcgLegality(c, f) {
  if (f.id === 'glc') return glcCardEligibility(c).status;
  if (c.pocket) return "not_legal";
  // Basic Energy is legal in every format, whatever set it was printed in.
  if (c.basicEnergy) return "legal";
  if (f.legal && typeof c.legal?.[f.legal] !== 'boolean') return 'unknown';
  if (f.legal && !c.legal[f.legal]) return "not_legal";
  if (f.noRuleBox && c.ruleBox) return "not_legal";
  return "legal";
}

export function validatePtcg(deck, cardOf, f) {
  const issues = [],
    rows = deck.zones?.main || [],
    total = rows.reduce((a, r) => a + r.qty, 0);
  if (total !== 60) issues.push({ level: "bad", text: `${total}/60 cards. Pokémon decks are exactly 60.` });
  const byName = new Map();
  let commonTypes = null, missingBasicData = false;
  let ace = 0,
    radiant = 0,
    basics = 0;
  for (const r of rows) {
    const c = cardOf(r.cardId);
    if (!c) {missingBasicData = true;issues.push({level:"pending",text:`${r.qty}× ${r.name||r.cardId}: card details not loaded.`});continue;}
    if(c.brief || !c.category)missingBasicData = true;
    if(!c.basicEnergy&&f.legal&&typeof c.legal?.[f.legal]!=="boolean")issues.push({level:"pending",text:`${c.name}: format legality not loaded.`});
    const shared = f.id === 'glc' && GLC_SHARED_NAMES.find(group => group.some(n => pokemonPrintedNameKey(n) === pokemonPrintedNameKey(glcCopyName(c.name))));
    const name = shared ? shared.join(' / ') : pokemonPrintedName(c.name);
    if (!c.basicEnergy) byName.set(name, (byName.get(name) || 0) + r.qty);
    if (hasAceSpec(c)) ace += r.qty;
    if (c.radiant) radiant += r.qty;
    if (c.basicPokemon || c.category === 'Pokemon' && c.stage === 'Basic') basics += r.qty;
    if (f.sharedType && c.category === 'Pokemon') {
      const types = (Array.isArray(c.types) ? c.types : []).filter(t => ENERGY_WORDS.includes(t));
      if (!types.length) issues.push({level:'pending',text:`${c.name}: printed Pokémon type needs verification for GLC.`});
      else commonTypes = commonTypes === null ? new Set(types) : new Set(types.filter(t => commonTypes.has(t)));
    }
    const leg = ptcgLegality(c, f);
    if (f.id === 'glc' && leg !== 'legal') issues.push({level:leg === 'unknown' ? 'pending' : 'bad',text:`${c.name} (${c.set?.name || c.id}): ${glcCardEligibility(c).reason}.`});
    else if (leg === 'not_legal') issues.push({ level: "bad", text: `${c.name} (${c.set?.name || c.id}) isn’t legal in ${f.name}${f.noRuleBox && c.ruleBox ? " — Rule Box Pokémon aren’t allowed" : ""}.` });
  }
  if (commonTypes?.size === 0) issues.push({level:'bad',text:'GLC Pokémon must all share one printed type; these Pokémon have no common type (dual-type cards may match either printed type).'});
  for (const [name, q] of byName) if (q > f.copies) issues.push({ level: "bad", text: `${q}× ${name}: ${f.name} allows ${f.copies} with the same name (basic Energy excepted).` });
  if (ace > (f.noAceSpec ? 0 : 1)) issues.push({ level: "bad", text: f.noAceSpec ? `${ace} ACE SPEC cards; ${f.name} allows none.` : `${ace} ACE SPEC cards; only 1 is allowed.` });
  if (radiant > 1 && !f.noRuleBox) issues.push({ level: "bad", text: `${radiant} Radiant Pokémon; only 1 is allowed.` });
  if (total && !basics) issues.push({ level: missingBasicData ? 'pending' : "bad", text: missingBasicData ? 'A Basic Pokémon has not been verified in the unresolved card data.' : "No Basic Pokémon — a deck needs at least one to start the game." });
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
// Candidate printings for the cheapest-printing check: catalogue data only (no
// slow price backfill); supplements with unknown prices simply rank last.
const liteCards = new Map();
const getCard = (id) => {
  if (!liteCards.has(id)) liteCards.set(id, get("/cards/" + encodeURIComponent(id)).then(d => d || pokemonCatalogueFallback(id)).then((d) => (d ? normalizePtcg(d) : null)).catch(() => null));
  return liteCards.get(id);
};
const SET_ALIAS = { rc: { from: "bw11", prefix: /^RC\d/ } };
// Listed by TCGdex with no cards in any source (Jumbo cards, Sample, W Promotional): left out of
// the set list rather than shown as a set that never fills in.
const NO_CARDS = new Set(["jumbo", "sp", "wp"]);
const searchCache = new Map(), searchLoads = new Map();
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

// Trainer and Energy searches must not silently retain Pokémon-only filters.
export function normalizePtcgSearch(spec = {}) {
  const out = { ...spec };
  if (["Trainer", "Energy"].includes(out.category)) for (const key of ["type", "stage", "hp"]) delete out[key];
  return out;
}

let standardPokemon = null,
  randomSets = null;

const firstPerName = (list) => {
  const seen = new Set();
  return list.filter((c) => !seen.has(c.name) && seen.add(c.name));
};
const collectorKey = (number) => String(number ?? "").trim().toLowerCase().replace(/^0+(?=\d+$)/, "");
// Tournament exports sometimes omit "Basic" from the nine basic Energy types.
// Normalize only that prefix: Special Energy and every set/number stay distinct.
const printingName = value => String(value ?? '').normalize('NFC').trim().toLowerCase().replace(/^basic (?=(?:grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy) energy$)/,'');
const discoveryName = value => printingName(pokemonPrintedName(value));
function supplementMatches(card, spec = {}) {
  const {q = '',category = '',type = '',set = '',rarity = '',stage = '',hp = '',format = '',number = '',exactName = false} = normalizePtcgSearch(spec);
  const query = discoveryName(q), name = discoveryName(card.name), f = PTCG_FORMATS.find(f => f.id === format);
  if (query && !(exactName ? name === query : name.includes(query) || pokemonPrintedNameKey(card.name).includes(pokemonPrintedNameKey(q)))) return false;
  if (set && String(card.set?.id).toLowerCase() !== String(set).toLowerCase()) return false;
  if (number && collectorKey(card.localId) !== collectorKey(number)) return false;
  if (category && card.category !== category) return false;
  if (rarity && String(card.rarity).toLowerCase() !== String(rarity).toLowerCase()) return false;
  if (type && !card.types?.includes(type)) return false;
  if (stage && card.stage !== stage) return false;
  if (Number(hp) > 0 && !(Number(card.hp) >= Number(hp))) return false;
  if (format && !f) return false;
  if (f && ptcgLegality(normalizePtcg(card),f) !== 'legal') return false;
  return true;
}
// A name is not a printing identity. Keep this check shared by imports and
// tournament matching, including when only one provider candidate is returned.
export function ptcgPrintingMatches(card, row, set = card?.set) {
  if (!card || !row?.set || !row?.number || printingName(card.name) !== printingName(row.name)) return false;
  const split = String(card.id || "").lastIndexOf("-"),
    setId = card.set?.id || String(card.id || "").slice(0, split),
    number = card.set?.number ?? card.localId ?? String(card.id || "").slice(split + 1),
    codes = [setId, set?.id, set?.tcgOnline, set?.abbreviation?.official, set?.abbreviation?.normal, typeof set?.abbreviation === "string" ? set.abbreviation : null, set?.abbreviations?.official];
  return collectorKey(number) === collectorKey(row.number) && codes.some(code => code && String(code).toLowerCase() === String(row.set).toLowerCase());
}
export const ptcgSource = {
  game: "ptcg",
  formats: PTCG_FORMATS,
  // TCGdex can't sort by release date, so fetch every match once, order it by each
  // set's real release order, and page through it here.
  async search(spec = {}) {
    const { q = "", category = "", type = "", set = "", rarity = "", stage = "", hp = "", format = "", number = "", sort = "new", page = 0, size = 48, exactName = false } = normalizePtcgSearch(spec);
    // Empty search browses the complete physical-card catalogue, paged below.
    const p = {},
      legal = PTCG_FORMATS.find((f) => f.id === format)?.legal;
    if (q.trim()) p.name = exactName?pokemonPrintedName(q):q.trim();
    if (category) p.category = category;
    if (type) p.types = type;
    if (set) p["set.id"] = set;
    if (number) p.localId = number;
    if (rarity) p.rarity = "eq:" + rarity;
    if (stage) p.stage = "eq:" + stage;
    if (Number(hp) > 0) p.hp = "gte:" + Number(hp);
    if (legal) p["legal." + legal] = "true";
    const key = JSON.stringify([p,format,exactName]);
    if (!searchCache.has(key)) {
      if (!searchLoads.has(key)) {
        const pending = Promise.all([get("/cards", p), setRank()]).then(([d, rank]) => {
          if (d !== null && !Array.isArray(d)) throw Error("Pokémon card database returned an invalid list.");
          const all = pokemonCatalogueOverlay(d || [],card => supplementMatches(card,{q,category,type,set,rarity,stage,hp,format,number,exactName})).map(brief).filter(c => c.id && !c.pocket && (!number || collectorKey(c.set?.number) === collectorKey(number)));
          searchCache.set(key, { all, rank });
        }).finally(() => searchLoads.delete(key));
        searchLoads.set(key, pending);
      }
      await searchLoads.get(key);
    }
    const { all, rank } = searchCache.get(key),
      setOf = (id) => id.slice(0, id.lastIndexOf("-")),
      num = (id) => parseInt(id.slice(id.lastIndexOf("-") + 1), 10) || 0,
      nameKey = discoveryName,
      family = exactName ? all.filter(card => nameKey(card.name) === nameKey(q)) : all,
      sorted = [...family].sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name) || (rank.get(setOf(b.id)) ?? -1) - (rank.get(setOf(a.id)) ?? -1) || a.id.localeCompare(b.id) : (a, b) => (rank.get(setOf(b.id)) ?? -1) - (rank.get(setOf(a.id)) ?? -1) || num(a.id) - num(b.id) || a.id.localeCompare(b.id));
    return { cards: sorted.slice(page * size, (page + 1) * size), total: sorted.length, more: (page + 1) * size < sorted.length };
  },
  async get(id, {prices = true} = {}) {
    const d = await get("/cards/" + encodeURIComponent(id)) || pokemonCatalogueFallback(id);
    if (!d) throw Error("Card not found.");
    const c = normalizePtcg(d);
    // No price from TCGdex (common for new sets): ask the Pokémon TCG API, which also carries
    // TCGplayer market prices.
    if (prices && c.prices.usd == null && !c.catalogueProvenance) await fillPrices(c);
    // Recognition can use authoritative variants/stats without waiting on quote
    // enrichment. Such a result must not satisfy normal pricing cache freshness.
    if (!prices) c.priceFallbackSchema = 0;
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
    const queryName=String(row.name||'').replace(/^Basic (?=(?:Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$)/i,'');
    const candidates=await this.byNameNumber(queryName,String(row.number));
    for(const brief of candidates.filter(c=>printingName(c.name)===printingName(row.name))){
      const setId=brief.id.slice(0,brief.id.lastIndexOf('-'));
      const set=String(setId).toLowerCase()===String(row.set).toLowerCase()?{id:setId}:await get('/sets/'+encodeURIComponent(setId)).catch(()=>null);
      // TCGdex keeps the printed set code under abbreviation.official ("TWM" for sv06).
      if(!ptcgPrintingMatches(brief,row,set))continue;
      const card=await this.get(brief.id);if(card?.id===brief.id && ptcgPrintingMatches(card,row,set))return card;
    }return null;
  },
  async byNameNumber(name, num) {
    name=pokemonPrintedName(name);
    num = String(num).trim();
    const merged=hits=>pokemonCatalogueOverlay(hits,c=>supplementMatches(c,{q:name,number:num})).map(brief);
    const tries = [...new Set(/^\d+$/.test(num) ? [num, String(Number(num)), String(Number(num)).padStart(3, "0")] : [num, num.toUpperCase()])];
    for (const n of tries) {
      const d = (await get("/cards", { ...(name?{name}:{}), localId: n })) || [];
      // TCGdex matches localId loosely ("053" also finds "SWSH153"); keep exact numbers only.
      const hits = d.filter((c) => !isPocket(c) && collectorKey(c.localId ?? c.set?.number ?? c.id.slice(c.id.lastIndexOf("-") + 1)) === collectorKey(num));
      if (hits.length) return merged(hits);
    }
    return merged([]);
  },
  async byName(name) {
    const d = (await get("/cards", { name: "eq:" + name, "sort:field": "id", "sort:order": "DESC", "pagination:itemsPerPage": 20 })) || [];
    const hit = pokemonCatalogueOverlay(d,c=>supplementMatches(c,{q:name,exactName:true})).map(brief).find((c) => !c.pocket);
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
      const extra=enriched.get(st.id)||{}, art=POKEMON_SET_ART[st.id]||{}, data=pokemonCatalogueSet({...extra,...st});
      const result = {id:st.id,name:data.name,code:st.id.toUpperCase(),count:data.cardCount?.total ?? data.cardCount?.official ?? 0,date:data.releaseDate || art.date || "",series:extra.series || art.series || "Other sets",seriesDate:extra.seriesDate || "",order:extra.order ?? i,image:data.logo ? ptcgImageAsset(data.logo) : art.logo || "",symbol:data.symbol ? ptcgImageAsset(data.symbol) : art.symbol || ""};
      catalogueSets.set(st.id,result);
      return result;
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
    const release = pokemonCatalogueSet(d || set);
    if (release?.id) catalogueSets.set(release.id,release);
    return pokemonCatalogueOverlay((d?.cards || []).map(c => ({...c,set:{...release,...c.set}})),c => c.set?.id === set.id)
      .map(brief).filter(c => !c.pocket)
      .sort((a,b) => String(a.set?.number || '').localeCompare(String(b.set?.number || ''),undefined,{numeric:true}) || a.id.localeCompare(b.id));
  },
  // The same card at the lowest cost: reprints and alternate arts with the same name and the same
  // game text (HP, attacks, abilities, retreat, rules) play identically, so a deck only needs the
  // lowest verified quote among checked legal equivalents, or an owned printing.
  // The provider detail budget is bounded; incomplete coverage remains explicit.
  async cheapestPrint(card, { legal = () => true, owned = () => 0, known = [] } = {}) {
    if (!card?.name || card.setContext) return card; // An explicit set/finish selection is not a cheapest-print request.
    // Cache discovery, not the chosen printing: ownership, legality and cached
    // prices can change between requests without changing the original card ID.
    const key = printingName(card.name) + "|" + Boolean(card.basicEnergy);
    if (!cheapMemo.has(key)) cheapMemo.set(key, (async () => {
      let lookupFailed = false;
      // Basic Energy is named both "Water Energy" and "Basic Water Energy" depending on the set.
      const names = card.basicEnergy ? [card.name.replace(/^Basic /, ""), "Basic " + card.name.replace(/^Basic /, "")] : [card.name];
      const upstream = (await Promise.all(names.map((n) => get("/cards", { name: "eq:" + n }).catch(() => { lookupFailed = true; return []; })))).flat(),
        briefs = [...new Map(pokemonCatalogueOverlay(upstream,c => names.some(q => supplementMatches(c,{q,exactName:true}))).filter((c) => c && !isPocket(c)).map(c=>[c.id,c])).values()],
        rank = await setRank(),
        setOf = (id) => id.slice(0, id.lastIndexOf("-"));
      briefs.sort((a, b) => (rank.get(setOf(b.id)) ?? -1) - (rank.get(setOf(a.id)) ?? -1));
      const full = [], pending = briefs.filter(c=>c.id!==card.id), limit = Math.min(pending.length,card.basicEnergy ? 16 : 12);
      for (let i = 0; i < limit; i += 6)
        full.push(...await Promise.all(pending.slice(i,Math.min(i+6,limit)).map(b=>getCard(b.id).catch(()=>null))));
      if(full.some(c=>!c))lookupFailed=true;
      return {full:full.filter(Boolean),ids:briefs.map(c=>c.id),lookupFailed};
    })().catch(()=>({full:[],ids:[],lookupFailed:true})));
    const found = await cheapMemo.get(key), sig = playSig(card),
      checked = [...new Map([...found.full, ...known, card].filter(c=>c && !c.brief && printingName(c.name)===printingName(card.name)).map(c=>[c.id,c])).values()],
      same = checked.filter(c=>legal(c) && (card.basicEnergy ? c.basicEnergy : playSig(c)===sig)),
      mine = card.basicEnergy ? [] : same.filter(c=>owned(c)>0),
      rare = c => {const i=PTCG_RARITIES.indexOf(c.rarity);return i<0?50:i;},
      cost = c => {const p=c.prices?.usd;return p==null||typeof p==="boolean"||String(p).trim()===""||!Number.isFinite(Number(p))||Number(p)<0?Infinity:Number(p);},
      pool = mine.length ? mine : same,
      best = [...pool].sort((a,b)=>cost(a)-cost(b)||Number(!!b.image)-Number(!!a.image)||rare(a)-rare(b))[0] || card,
      checkedIds = new Set(checked.map(c=>c.id)), unchecked = found.ids.filter(id=>!checkedIds.has(id)).length;
    return {...best,printingComparison:{scope:'lowest-known-eligible-checked',checked:checked.length,eligible:same.length,unchecked,partial:found.lookupFailed||unchecked>0,ownedPreferred:mine.length>0,source:'TCGdex catalogue and available cached equivalents'}};
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
