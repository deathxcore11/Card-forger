import {referenceQuote,referenceLabel} from './price-reference.js';
import {brandMark} from './brand.js';
import {conditionValue,conditionValueNote,conditionName} from './condition-value.js';
import { aiReviewPanel } from './ai-review.js';
import { myPrice } from "./mtg-tcgprice.js";
import { ask, askText } from "./dialog.js";
import { buyOnTcgplayer, massLines } from "./buy.js";
import {effectText,ruleText} from './rule-dex.js';
import {editionPrice} from './ygo-prices.js';
import {buildOverlay} from './build-overlay.js';
import { tierCardHtml } from './tier-card.js';
import {bestBudgetDecks,purchaseCost,comparePower,swappedZones,sameCardLogic,budgetComparisonHtml,refineCandidates,towardDeck,spendUp,cardQuality,budgetNotes,variantsFrom,fillOpen,difficultyOf} from './deck-optimizer.js';
import {collectionOrder} from "./collection-order.js";
import {POKEMON_SET_ART} from "./pokemon-set-art.js";
import { recordCardPrice, trackedQuote, priceHistoryHtml, alertsPanel, alertStatus } from "./pricehist.js";
import { lineChart, skeletonGrid } from "./ui.js";
import { installNudge } from "./install.js";
import { rankByName } from "./catalog-tools.js";
import {setRowContent} from './set-list-ui.js';
import {artworkHTML,artworkSources,pokemonArtCrop} from "./artwork.js";
import { tierOf, tierAttrs, tierStyle, tierGem } from "./tier.js";
import {viewControl,selectionControl,selectionMark,selectionTray,historyPanel,quoteModel,priceOverview,quoteWarning} from "./workbench-ui.js";
import { locationPicker, rememberLocation } from "./collection-locations.js";
import { zoneCountLabel } from "./deck-safety.js";
import { binderShelf } from "./binders.js";
import { emblemChips, rowEmblem, hasEmblem, impactScore, tradeAdvice, tradeAdviceHtml, deckEmblems, deckEmblemHtml, cardMetaUsage, cardMetaTab, playRate } from "./importance.js";
import { attackReach, abilityEnergy, ygoPower, ptcgPower } from "./deckpower.js";
import { matchupsTab, fieldStore, computeMatchups, celebrate, calibrateField } from "./matchups-ui.js";
import { profileOf, simulateMatchup, gamePlan, recordOf, blend, listSig, forList, realMatchup, trustedSim, matchupBlock, canBorrowResults } from "./matchup.js";
import { haptic } from "./feel.js";
import { tileChrome } from "./tiles.js";
// Yu-Gi-Oh! and Pokémon: collection, search, sets and deck building, sharing one
// set of screens. Each game's data, rules and formats come from its adapter.
import { S, uid } from "./store.js";
import { esc, usd, empty, bar, options, segmented } from "./ui.js";
import { GAMES, GAME_ICON, GAME_COLOR, GAME_IDS, blankGame, gameOf } from "./games.js";
import { ICON, actionIcon } from "./icons.js";
import { tcgCompareSheet } from "./tcgcompare.js";
import { tradePanel } from "./trade.js";
import { sharePayloadTcg, encodeShare } from "./share.js";
import { factBox, factsFor } from "./facts.js";
import { ygoEmblems, energyIcon, attackLine, tcgSetBadge, ygoPrintBadge, pkRarity, pkSetSymbol } from "./emblems.js";
import { buildYgo, buildPtcg, YGO_STAPLES, PTCG_STAPLES, PTCG_SUPPORT_BASICS, energyName } from "./tcgbuild.js";
import { ygoSource, ygoImageDirect, YGO_TYPES, YGO_ATTRIBUTES, YGO_RACES, YGO_SPELL_KINDS, YGO_TRAP_KINDS } from "./ygo.js";
import { ptcgSource, PTCG_TYPES, PTCG_RARITIES, PTCG_STAGES, plainText } from "./ptcg.js";
import { loadMeta, metaState, ptcgIcon, allCachedMeta, cleanName } from "./meta.js";
import { tcgPower, powerPanel, powerChip, shownPower, asShown, powerReadiness } from "./power.js";
import { playGuide, playedAlongside, guideHtml, cardRules } from "./guide.js";
import { rankPairs, ygoTags, ptcgTags } from "./pairing.js";
import { nameCandidates, scanCandidateMatches, ygoSetCodes, ygoPasscodes, ptcgNumbers, similarity, scanNameKey, textPhrases, attackNames } from "./scan.js";
import { adaptList, ownedDraft, engineOf, similarLists, swapPool, costToFinish, unpricedCopies } from "./adapt.js";
export { metaState, similarLists };
export async function loadTradeCards(g){const st=gs(g);const ids=[...new Set([...st.collection,...st.wishlist,...st.decks.flatMap(d=>Object.values(d.zones||{}).flat())].map(e=>e.cardId))].filter(id=>id && (!cardOf(g,id)||cardOf(g,id).brief || (g==='ygo' && cardOf(g,id).printPriceSchema!==1)));await ensureMany(g,ids,()=>{},false,true);}

export const SOURCES = { ygo: ygoSource, ptcg: ptcgSource };
// (exported for the rules page)
export const TCG_CACHE = "cardforge-tcg-cache-v1";
export const cache = { ygo: {}, ptcg: {} };
const PRICE_TTL = 24 * 3600 * 1000;

export const game = () => (GAMES[S.state.settings?.game] ? S.state.settings.game : "mtg");
export const isTcg = () => game() !== "mtg";
export const gs = (g = game(), s = S.state) => s.tcg?.[g] || blankGame();
export const cardOf = (g, id) => cache[g][id] || null;

// Per-game screen state (never saved).
const UI = {};
export const ui = (g = game()) =>
  (UI[g] ||= {
    search: { q: "", f: {}, sort: g === "ygo" ? "name" : "new", maxPrice: "", page: 0, results: [], more: false, busy: false, error: "", ran: false },
    sets: { list: [], busy: false, error: "", q: "", limit: 80 },
    set: { id: "", info: null, cards: [], busy: false, error: "", filter: "all", sort: "number", limit: 120 },
    coll: { limit: 120, q: "", sort: "set-order", set: "", kind: "", rarity: "" },
    deckAdd: { q: "", results: [], busy: false },
  });

/* ---------- card data ---------- */

let ctx = null,
  cacheTimer = null;
const saveCacheSoon = () => {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => ctx?.writeRecord(TCG_CACHE, cache).catch(() => {}), 1500);
};
export async function loadCache(readRecord) {
  try {
    const rec = await readRecord(TCG_CACHE);
    if (rec) for (const g of Object.keys(cache)) Object.assign(cache[g], rec[g] || {});
  } catch {}
}
const remember = (card) => {
  const prev = cache[card.game][card.id];
  if (card.brief && prev && !prev.brief) return prev;
  if (!card.brief) recordCardPrice(card.game, card);
  cache[card.game][card.id] = card;
  saveCacheSoon();
  return card;
};
export function needsCardRefresh(g,c,printings=false){
 const time=Date.parse(c?.fetchedAt);
 return !c||c.brief||!Number.isFinite(time)||time>Date.now()+300000||Date.now()-time>=PRICE_TTL||
 (g==='ptcg'&&(c.variantSchema!==9||c.priceFallbackSchema!==3))||
 (g==='ygo'&&(c.artSchema!==1||(printings&&c.printPriceSchema!==1)));
}
// Full card with prices no older than a day.
export async function ensureCard(g, id, force = false,printings=true) {
  const c = cache[g][id];
  if (!force&&!needsCardRefresh(g,c,printings)) return c;
  try {
    return remember(await SOURCES[g].get(id,{printings}));
  } catch (e) {
    if (c) return c;
    throw e;
  }
}
// Load details for many cards, a few at a time, calling `tick` as they arrive.
export async function ensureMany(g, ids, tick = () => {}, force = false,printings=false) {
  const queue = [...new Set(ids)].filter(id=>force||needsCardRefresh(g,cache[g][id],printings));
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      await ensureCard(g, id, force,printings).catch(() => {});
      if (++done % 8 === 0) tick(done);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  tick(done);
  return done;
}

// A store's price, else the player's own (press and hold a price; only they see it).
const price = (c) => c?.prices?.usd ?? myPrice(c);
// Emblems shown on a card: Yu-Gi-Oh! Level/Attribute or Spell/Trap property; Pokémon energy type.
export const gameEmblems = (c) => (!c || c.brief ? "" : c.game === "ygo" ? ygoEmblems(c) : `<span class="emblems">${(c.types || []).map((t) => energyIcon(t)).join("")}${c.hp ? `<span class="hp">HP ${esc(c.hp)}</span>` : ""}</span>`);
// Search tiles stay light: the type emblem plus set/rarity symbols. HP and codes are on the card page.
const tileBadges = (c) => tileChrome(c?.game, c);
// Rarity/price tier (tier.js). Yu-Gi-Oh! rarity lives on the printing you own, when known.
const tcgTier = (c, e = null, p = undefined) => tierOf(c?.game, e?.rarity || c?.rarity || "", p === undefined ? price(c) : p);
const rowBadges = (c) => (!c || c.brief ? "" : `${gameEmblems(c)}${tcgSetBadge(c)} `);
const imgTag = (c,cls="card-img",large=false) => artworkHTML(c,cls,large);

// A printed variant can share art, but that is not proof of its stamp/finish.
export function variantArtwork(card, variant = {}) {
  const exact = !!variant.image;
  return { image:variant.image || card.image || "", imageLarge:variant.imageLarge || variant.image || card.imageLarge || card.image || "", imageId:variant.id || card.id, exact,
    label:exact ? "Variant image" : "Reference art: the main card picture" };
}
export function variantArtThumb(card, variant = {}, attrs = "") {
  const a = variantArtwork(card,variant),
    urls = [...new Set([variant.image, a.image, ...artworkSources(card), card.game === "ygo" ? ygoImageDirect(a.imageId) : ""].filter(Boolean))];
  return `<button class="variant-art" data-act="tVariantArt" data-id="${esc(card.id)}" ${attrs} aria-label="View ${esc(variant.label || card.name)} artwork"><span class="variant-art-frame">${urls.length ? `<img src="${esc(urls[0])}" data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="${esc(card.name)} — ${esc(a.label)}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="art-unavailable-label">Image unavailable</span>`}</span></button>`;
}

// Trade tab: fair swaps from your collection and wishlist (trade.js).
function tcgTradePanel(g, c, own, ctx={}) {
  const st = gs(g),
    byId = new Map();
  for (const e of st.collection) {
    const card = cardOf(g, e.cardId),
      exact = entryPrice(card,e), p = exact ?? (ctx.tradeOptions?.valuation==='reference' ? (card?.sets?.find(x=>x.code===e.printing && (!e.rarity||x.rarity===e.rarity))?.price ?? price(card)) : null);
    const x = byId.get(e.id) || { key: e.id, cardKey:e.cardId, name: e.name + (e.printing ? " · "+e.printing : "") + (e.edition ? " · "+e.edition : ""), price: p, qty: 0, art: imgTag(card, "mini-art"), open: `data-act="tCard" data-id="${esc(e.cardId)}"` };
    x.qty += e.qty;
    if (p != null && (x.price == null || p > x.price)) x.price = p;
    byId.set(e.id, x);
  }
  const wish = st.wishlist.map((w) => {
    const card = cardOf(g, w.cardId);
    return { key: w.cardId, name: w.name, price: price(card), art: imgTag(card, "mini-art"), open: `data-act="tCard" data-id="${esc(w.cardId)}"` };
  });
  const needs=new Map();for(const d of st.decks){const counts=new Map();for(const zone of Object.values(d.zones || {}))for(const r of zone)counts.set(r.cardId,{...r,qty:r.qty+(counts.get(r.cardId)?.qty||0)});for(const r of counts.values()){
   const card=cardOf(g,r.cardId),have=card ? ownedOf(g,card) : st.collection.filter(e=>e.cardId===r.cardId).reduce((a,e)=>a+e.qty,0),qty=Math.max(0,r.qty-have);if(!qty||r.cardId===c.id)continue;
   const old=needs.get(r.cardId);needs.set(r.cardId,{key:r.cardId,name:r.name,price:price(card),qty:Math.max(qty,old?.qty||0),priority:2,deckName:d.name,art:imgTag(card,'mini-art'),open:`data-act="tCard" data-id="${esc(r.cardId)}"`});
  }}
  const targetEntries=st.collection.filter(e=>e.cardId===c.id),selected=targetEntries.find(e=>e.id===(ctx.tradeOptions?.targetEntry || ctx.entryId)),targetPrice=selected?entryPrice(c,selected):price(c);
  const targetPicker=g==='ygo' && targetEntries.length?`<label>Value my printing<select data-change="tradeOption" data-field="targetEntry">${options([['','Card reference · edition unspecified'],...targetEntries.map(e=>[e.id,[e.printing,e.rarity,e.edition].filter(Boolean).join(' · ') || e.name])],selected?.id || '')}</select></label>`:'';
  return targetPicker+tradePanel({ key:c.id,name:c.name,price:targetPrice,owned:own>0 },[...byId.values()],wish,{...ctx.tradeOptions,needs:[...needs.values()],game:g,collectionCount:st.collection.length});
}

// A stat on the card page. The regulation mark gets what it means for you, not just a letter.
function statCell(c, k, v) {
  if (k !== "Regulation") return `<div><small>${esc(k)}</small><b>${esc(String(v))}</b></div>`;
  const where = c.legal?.standard ? ["ok-text", "Playable in Standard"] : c.legal?.expanded ? ["warn-text", "Rotated out of Standard · Expanded only"] : ["muted", "Not tournament legal"];
  return `<div class="stat-reg"><small>Regulation mark</small><b>${esc(String(v))}</b><span class="${where[0]}">${where[1]}</span></div>`;
}
function regulationHelp(c) {
  return `<details class="stat-help"><summary>What’s a regulation mark?</summary><p>The small letter in the bottom-left corner of the card (${esc(c.regulationMark)} here). Tournaments use it to decide which cards are allowed: <b>Standard</b> only allows the newest few letters and drops the oldest one each year, while <b>Expanded</b> allows much older cards. For casual games with friends, it doesn’t matter at all.</p></details>`;
}

// Already in the collection: − count + right there. Not yet: an Add button.
const variantEntries = (g, c, v) => gs(g).collection.filter((e) => e.cardId === c.id && (e.variant || "normal") === (v.key || "normal"));
function variantOwnControl(g, c, v) {
  const n = variantEntries(g, c, v).reduce((t, e) => t + e.qty, 0);
  return n
    ? `<span class="stepper owned" title="In your collection"><button data-act="tVariantQty" data-id="${esc(c.id)}" data-print="${esc(v.key)}" data-delta="-1" aria-label="One fewer ${esc(v.label)}">−</button><b>${n}</b><button data-act="tVariantQty" data-id="${esc(c.id)}" data-print="${esc(v.key)}" data-delta="1" aria-label="One more ${esc(v.label)}">＋</button></span>`
    : `<button class="btn ghost small" data-act="tOwn" data-id="${esc(c.id)}" data-print="${esc(v.key)}" aria-label="Add ${esc(v.label)}">Add</button>`;
}

/* ---------- ownership & value ---------- */

// Basic Energy is one card per type whatever the printing: TCGdex names most "Water Energy" and a
// few special printings "Basic Water Energy", so both count as the same card you own.
const sameCard = (k) => String(k || "").replace(/^name:Basic (\w+ Energy)$/, "name:$1");
// The set a shopping line names: Pokémon, the card's own set; Yu-Gi-Oh!, its cheapest printing.
const massSet = (g, c) => {
  if (!c) return {};
  // Pokémon: the card's set by name, its TCGdex set id as a code ("svp", "sve"), and Basic Energy
  // falls back to the Scarlet & Violet Energy set (any printing is legal).
  // TCGplayer lists Basic Energy as "Basic Fighting Energy" and promos with their number
  // ("Iron Crown ex - 146"), so energy lines use that name and promo lines add the number.
  if (g === "ptcg") {
    if (c.basicEnergy) return { name: "Basic " + String(c.name || "").replace(/^Basic /, ""), set: "Scarlet & Violet Energy", code: "SVE" };
    const setId = c.set?.id || String(c.id || "").replace(/-[^-]+$/, ""), num = String(c.set?.number || String(c.id || "").split("-").pop() || "");
    return { set: c.set?.name, code: setId, ...(/p$/i.test(setId) && num ? { num: /^\d+$/.test(num) ? String(Number(num)) : num } : {}) };
  }
  const sets = (c.sets || []).filter((x) => x.name), best = [...sets].filter((x) => x.price > 0).sort((a, b) => a.price - b.price)[0] || sets[0];
  return best ? { set: best.name, code: String(best.code || "").split("-")[0] } : {};
};
const keyOf = (g, c) => sameCard(SOURCES[g].ownKey(c));
export function ownedMap(g, s = S.state) {
  const m = new Map();
  for (const e of gs(g, s).collection) m.set(sameCard(e.key), (m.get(sameCard(e.key)) || 0) + e.qty);
  return m;
}
const ownedOf = (g, c, m = ownedMap(g)) => (c ? m.get(keyOf(g, c)) || 0 : 0);

export function collectionValue(g, s = S.state) {
  let total = 0,
    unpriced = 0,
    copies = 0;
  for (const e of gs(g, s).collection) {
    copies += e.qty;
    const c = cardOf(g, e.cardId),
      p = entryPrice(c, e);
    if (p === null) unpriced += e.qty;
    else total += p * e.qty;
  }
  return { total, unpriced, copies };
}
// Price for the exact printing/variant when known (Yu-Gi-Oh! set price, Pokémon variant).
export const persistQuoteCache=()=>saveCacheSoon();
export function entryPrice(c,e){return conditionValue(referenceEntryPrice(c,e),e,[...(c?.conditionQuotes||[]),...(e.conditionQuotes||[])]).price;}
function referenceEntryPrice(c, e) {
  if (!c) return null;
  if (c.game === "ygo" && e.edition) {
    const set=c.sets?.find(s=>s.code===e.printing && (!e.rarity || s.rarity===e.rarity));
    return editionPrice(set,e.edition);
  }
  if (c.game === "ygo" && e.printing) {
    const s = c.sets?.find((x) => x.code === e.printing && x.rarity === (e.rarity || x.rarity));
    if (s?.price) return s.price;
  }
  if (c.game === "ptcg" && e.variant) {
    const v = c.variants?.find((x) => x.key === e.variant);
    return v?.usd ?? null; // never substitute Unlimited for Shadowless/First Edition
  }
  return price(c);
}

function deckStats(g, d) {
  const m = ownedMap(g),
    used = new Map(),
    rows = [];
  let total = 0,
    buy = 0,
    unknown = 0,
    owned = 0,
    value = 0;
  for (const zone of ["main", "extra", "side"])
    for (const r of d.zones?.[zone] || []) {
      const c = cardOf(g, r.cardId),
        k = c ? keyOf(g, c) : "id:" + r.cardId,
        have = Math.max(0, (m.get(k) || 0) - (used.get(k) || 0)),
        got = Math.min(have, r.qty),
        p = price(c),
        free = c?.basicEnergy;
      used.set(k, (used.get(k) || 0) + got);
      total += r.qty;
      owned += free ? r.qty : got;
      const need = free ? 0 : r.qty - got;
      if (p !== null) value += p * r.qty;
      if (need) p === null ? (unknown += need) : (buy += p * need);
      rows.push({ zone, r, c, need, got });
    }
  return { total, owned, buy, unknown, value, rows };
}

/* ---------- shared pieces ---------- */

export function gameBinders(active = game()) {
  return `<section class="game-choice-list" aria-label="Your games">${GAME_IDS.map((g) => {
    const v = g === "mtg" ? null : collectionValue(g),
      mtgCopies = g === "mtg" ? S.state.collection.reduce((a, e) => a + e.qty, 0) : 0,
      decks = g === "mtg" ? S.state.decks.length : gs(g).decks.length;
    return `<button class="game-choice gc-${g}" style="--game-color:${GAME_COLOR[g]}" data-act="setGame" data-game="${g}" aria-pressed="${g===active}"><span class="game-choice-icon">${GAME_ICON[g]}</span><span><b>${esc(GAMES[g].name)}</b><small>${g === "mtg" ? mtgCopies : v.copies} cards · ${decks} decks</small></span><span class="game-choice-check" aria-hidden="true">${g===active ? ICON.check : ""}</span></button>`;
  }).join("")}</section>`;
}

export const formatsOf = (g) => SOURCES[g].formats;
const formatOf = (g, id) => formatsOf(g).find((f) => f.id === id) || formatsOf(g)[0];

function legalChips(g, c) {
  return `<div class="legal">${formatsOf(g)
    .map((f) => {
      const l = SOURCES[g].legality(c, f),
        lim = g === "ygo" ? SOURCES.ygo.limit(c, f) : null,
        label = l === "banned" ? "Forbidden" : l === "limited" ? "Limited" : l === "semi" ? "Semi-Limited" : l === "not_legal" ? "" : "";
      return `<span class="lg ${l === "legal" ? "yes" : l === "not_legal" ? "no" : l === "banned" ? "ban" : "res"}" title="${esc(f.name)}${lim !== null && l !== "not_legal" ? ` · up to ${lim}` : ""}">${esc(f.name)}${label ? " · " + label : ""}</span>`;
    })
    .join("")}</div>`;
}

/* ---------- art hero (all games) ---------- */

const HERO_KEY = "cardforge-hero-v1";
const today = () => new Date().toISOString().slice(0, 10);
export const heroState = {};
const readHero = () => {
  try {
    const h = JSON.parse(localStorage.getItem(HERO_KEY) || "null");
    return h?.date === today() ? h : { date: today() };
  } catch {
    return { date: today() };
  }
};
// Today's art for a game: your newest deck's lead card, else a "card of the day".
export function heroFor(g, deckArt = null) {
  if (deckArt) return deckArt;
  return heroState[g] || readHero()[g] || null;
}
export function homeHero(g, title, deckArt = null, compact = false) {
  const h = heroFor(g, deckArt),
    G = GAMES[g];
  return `<section class="home-hero ${g} ${compact ? "compact" : ""}" id="homeHero">${h?.art && g === "ptcg" ? pokemonArtCrop(null, "hh-art", h.art) : h?.art ? `<img class="hh-art" src="${esc(h.art)}" alt="" referrerpolicy="no-referrer" onerror="${h.artDirect ? `if(!this.dataset.f){this.dataset.f=1;this.src='${esc(h.artDirect)}'}else ` : ""}this.remove()">` : ""}<div class="hh-shade"></div>
    <div class="hh-body"><p class="eyebrow">${esc(G.name)}</p><h1>${title}</h1>
      <div class="hh-search"><input id="homeQ" type="search" data-suggest="${g}" placeholder="Search ${esc(G.short)} cards" data-enter="homeSearch" aria-label="Search ${esc(G.short)} cards" autocomplete="off"><button class="btn" data-act="homeSearch">Search</button><button class="ask-launch" data-act="askOpen" aria-label="Ask AI"><span aria-hidden="true">✦</span>Ask</button></div>
      ${h?.name ? `<button class="hh-credit" ${g === "mtg" ? `data-act="card" data-name="${esc(h.name)}"` : `data-act="tCard" data-id="${esc(h.id)}"`}>${h.deck ? "From your deck" : "Card of the day"} · <b>${esc(h.name)}</b> ›</button>` : ""}
    </div></section>`;
}
// Fetch today's card for a game once per day (cached on the device).
export async function loadHero(g, mtgRandom) {
  if (heroState[g] || readHero()[g]) return false;
  const pickDay = (n) => Number(today().replace(/-/g, "")) % n;
  let h = null;
  if (g === "mtg") {
    const c = await mtgRandom();
    h = { name: c.name, art: c.image_uris?.art_crop || c.card_faces?.[0]?.image_uris?.art_crop || "" };
  } else if (g === "ygo") {
    const list = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?staple=yes&misc=yes").then((r) => r.json());
    const c = remember((await import("./ygo.js")).normalizeYgo(list.data[pickDay(list.data.length)]));
    h = { id: c.id, name: c.name, art: c.art, artDirect: c.artDirect };
  } else {
    const list = await fetch("https://api.tcgdex.net/v2/en/cards?rarity=eq:Special%20illustration%20rare").then((r) => r.json());
    const c = list[pickDay(list.length)];
    h = { id: c.id, name: c.name, art: c.image + "/high.webp" };
  }
  heroState[g] = h;
  try {
    const all = readHero();
    all[g] = h;
    localStorage.setItem(HERO_KEY, JSON.stringify(all));
  } catch {}
  return true;
}

/* ---------- home ---------- */

// Big game tiles on first use; once any game has cards or decks, a compact switch.
export function gameSwitch(active = game()) {
  const used = GAME_IDS.some((g) => (g === "mtg" ? S.state.collection.length || S.state.decks.length : gs(g).collection.length || gs(g).decks.length));
  if (!used) return gameBinders(active);
  // Once you're using the app, the header's game picker switches games; Home doesn't repeat it.
  return "";
}
// Saved searches, per game, on this device.
const SAVED_KEY = "cardforge-saved-searches-v1";
export const savedSearches = (g) => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "{}")[g] || [];
  } catch {
    return [];
  }
};
export function setSavedSearches(g, list) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) || "{}");
    all[g] = list.slice(0, 12);
    localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  } catch {}
}
const START_KEY = "cardforge-start-hidden-v1";
export const startHidden = (g) => {
  try {
    return !!JSON.parse(localStorage.getItem(START_KEY) || "{}")[g];
  } catch {
    return false;
  }
};
export function setStartHidden(g, hidden) {
  try {
    const all = JSON.parse(localStorage.getItem(START_KEY) || "{}");
    all[g] = hidden;
    localStorage.setItem(START_KEY, JSON.stringify(all));
  } catch {}
}
// The one thing to do next, based on progress: add cards → find a deck → finish your deck.
export function nextCard({ eyebrow = "Next step", title, text = "", stats = [], art = "", artHtml = "", actions = "" }) {
  return `<section class="next-card">${artHtml ? `<div class="nc-art">${artHtml}</div>` : art ? `<div class="nc-art" style="background-image:url('${esc(art)}')"></div>` : ""}<div class="nc-body"><p class="eyebrow">${esc(eyebrow)}</p><h2>${title}</h2>${text ? `<p class="muted small">${text}</p>` : ""}${stats.length ? `<div class="nc-stats">${stats.map(([v, l]) => `<span><b>${v}</b><small>${esc(l)}</small></span>`).join("")}</div>` : ""}<div class="actions wrap">${actions}</div></div></section>`;
}
function tcgNext(g) {
  const st = gs(g),
    lead = st.decks.at(-1);
  if (!st.collection.length && !st.decks.length)
    return nextCard({ title: "Add your collection", text: `Paste a list of the ${esc(GAMES[g].short)} cards you own, or search and add them one by one. Then CardStashy shows what you can build.`, actions: `<button class="btn" data-act="tImportColl">↥ Paste a list</button><button class="btn ghost" data-act="go" data-to="#search">⌕ Find cards</button><button class="btn ghost" data-act="go" data-to="#decks/inspiration">🏆 Browse meta decks</button>` });
  if (!lead)
    return nextCard({ title: "Discover decks your cards support", text: `${st.collection.reduce((a, e) => a + e.qty, 0)} cards in your binder. See the ${g === "ygo" ? "archetypes" : "Pokémon"} you can build around and the tournament decks you’re closest to.`, actions: `<button class="btn" data-act="go" data-to="#decks/ideas">✧ Deck ideas from my cards</button>` });
  const s = deckStats(g, lead),
    f = formatOf(g, lead.format),
    issues = SOURCES[g].validate(lead, (id) => cardOf(g, id), f),
    cover = cardOf(g, (lead.zones.main || [])[0]?.cardId),
    missing = Math.max(0, s.total - s.owned);
  return nextCard({
    eyebrow: "Continue your deck",
    title: esc(lead.name),
    art: cover && g === "ygo" ? cover.artDirect : "",
    artHtml: cover && g === "ptcg" ? pokemonArtCrop(cover, "nc-pk") : "",
    stats: [[`${s.total}`, f.name], [`${missing}`, "missing copies"], [usd(s.buy, 0), "to finish"], [issues.length ? `${issues.length}` : "✓", issues.length ? "to fix" : "legal"]],
    text: issues.length ? `Next: ${esc(issues[0].text)}` : missing ? "Everything checks out — buy or add the missing copies to finish." : "Complete and legal. Playtest it or start another.",
    actions: `<button class="btn" data-act="go" data-to="#tdeck/${esc(lead.id)}">Open deck</button><button class="btn ghost" data-act="go" data-to="#decks/ideas">✧ More ideas</button>`,
  });
}

// The same shortcuts, in the same order, for every game.
// skipIdeas: the Next step card is already offering Deck ideas, so the tile would repeat it.
export function quickTiles(g, skipIdeas = false) {
  const mtg = g === "mtg",
    tile = (act, to, icon, title, sub, cls = "") => `<button class="quick-btn ${cls}" data-act="${act}" ${to ? `data-to="${to}"` : ""}><span>${icon}</span><b>${title}</b><small>${sub}</small></button>`;
  return `<div class="quick">
    ${skipIdeas ? "" : tile("go", "#decks/ideas", "✧", "Deck ideas", mtg ? "Commanders your cards support" : "Build from your collection")}
    ${tile("go", "#decks/inspiration", "🏆", "Meta decks", mtg ? "Tournament decks, precons and shared lists, with what you own" : "Today’s tournament decks, with what you own")}
    </div>`;
}
export const randomTools = (g) =>
  g === "mtg"
    ? `<div class="random-tools"><button class="btn ghost" data-act="dbRandom">🎲 Random card</button><button class="btn ghost" data-act="randomDeck">🎲 Random deck</button></div>`
    : `<div class="random-tools"><button class="btn ghost" data-act="tRandomCard">🎲 Random card</button><button class="btn ghost" data-act="randomDeckOptions">🎲 Random deck</button></div>`;
// "Start here" for a game with no cards or no decks yet (Magic has its own in views.js).
function tcgStartPath(g) {
  const st = gs(g),
    hasCards = st.collection.length > 0,
    hasDeck = st.decks.length > 0;
  if (hasCards && hasDeck) return "";
  const step = (n, done, title, text, actions) =>
    done
      ? `<li class="step done"><span class="step-n" aria-hidden="true">✓</span><div><b>${title}</b></div></li>`
      : `<li class="step"><span class="step-n" aria-hidden="true">${n}</span><div><b>${title}</b><p class="muted small">${text}</p><div class="actions wrap">${actions}</div></div></li>`;
  return `<section class="panel start"><div class="row between"><p class="eyebrow">Start here · about 5 minutes</p><button class="link small" data-act="hideStart" data-game="${g}">Hide</button></div><h2>Three steps to your first deck</h2><ol class="steps">
    ${step(1, hasCards, "Add the cards you own", `Paste a list (one card per line, like “3 ${g === "ygo" ? "Ash Blossom & Joyous Spring" : "Ultra Ball"}”) or search and add cards one by one.`, `<button class="btn small" data-act="tImportColl">Add my cards</button>`)}
    ${step(2, hasDeck, "Pick a deck to aim for", `Copy a tournament deck, build from your own cards at any budget, or import a list.`, `<button class="btn small" data-act="go" data-to="#decks/ideas">Find deck ideas</button>`)}
    ${step(3, false, "See what’s missing and what it costs", "Each deck shows what you own, what you need, the price to finish, and anything that breaks the format’s rules.", hasDeck ? `<button class="btn small" data-act="go" data-to="#tdeck/${esc(st.decks.at(-1).id)}">Open my deck</button>` : `<span class="muted small">Unlocks after step 2.</span>`)}
  </ol><p class="foot">Everything is saved on this device. Export a backup in Settings any time.</p></section>`;
}

export function tcgHome() {
  const g = game(),
    G = GAMES[g],
    v = collectionValue(g),
    st = gs(g),
    recent = st.decks.slice(-6).reverse();
  const lead = st.decks.at(-1),
    leadCard = lead ? cardOf(g, (lead.zones.main || [])[0]?.cardId) : null,
    deckArt = leadCard ? { id: leadCard.id, name: leadCard.name, art: g === "ygo" ? leadCard.art : leadCard.imageLarge, artDirect: g === "ygo" ? leadCard.artDirect : "", deck: true } : null;
  const onboarding = !(st.collection.length && st.decks.length),
    fresh = !st.collection.length && !st.decks.length;
  return `${homeHero(g, v.copies ? "Welcome back." : "Let’s build from your cards.", deckArt, !fresh)}
  ${installNudge(v.copies)}
  ${fresh && !startHidden(g) ? tcgStartPath(g) : tcgNext(g)}
  ${onboarding ? "" : `<div class="kpis">
    <button class="kpi" data-act="go" data-to="#collection"><b data-count="${Math.round(v.total)}" data-money="1">${usd(v.total, 0)}</b><span>collection value${v.unpriced ? ` · ${v.unpriced} unpriced` : ""}</span></button>
    <button class="kpi" data-act="go" data-to="#collection"><b>${v.copies}</b><span>cards owned</span></button>
    <button class="kpi" data-act="go" data-to="#decks"><b>${st.decks.length}</b><span>decks</span></button>
  </div>`}
  ${quickTiles(g, !!gs(g).collection.length && !gs(g).decks.length)}
  ${recent.length ? `<section class="home-deck-section"><div class="section-head"><h2>Deck shelf</h2><button class="link" data-act="go" data-to="#decks">All decks →</button></div><div class="deck-grid">${recent.map((d) => deckTile(g, d)).join("")}</div></section>` : ""}
  <p class="muted small">${esc(G.tagline)}. Card data and daily prices from ${esc(G.source)}.</p>`;
}

// Yu-Gi-Oh! has true artwork crops (through the Worker's image cache, then the source).
const ygoCropArt = (c) => {
  const urls = [`img/ygo/a/${encodeURIComponent(c.id)}.jpg`, `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(c.id)}.jpg`, c.imageLarge || c.image].filter(Boolean);
  return `<img class="tile-card-art cropped" src="${esc(urls[0])}" data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer">`;
};
function deckTile(g, d) {
  const s = deckStats(g, d),
    f = formatOf(g, d.format),
    cover = cardOf(g, (d.zones.main || [])[0]?.cardId),
    issues = SOURCES[g].validate(d, (id) => cardOf(g, id), f),
    main = (d.zones.main || []).reduce((a, r) => a + r.qty, 0),
    owned = s.total ? s.owned / s.total : 0,
    pw = s.total ? tcgPower(g, d, f, (id) => cardOf(g, id)) : null;
  // Same art tile as Magic decks: card art, format chip, power, owned, value, cost to finish.
  return `<button class="deck-tile tcg-tile tile-${g}" data-act="go" data-to="#tdeck/${esc(d.id)}">
    <span class="tile-art">${g === "ygo" && cover ? ygoCropArt(cover) : g === "ptcg" && cover ? pokemonArtCrop(cover, "tile-pk") : imgTag(cover, "tile-card-art", true)}</span>
    <span class="tile-shade"></span>
    <span class="tile-top"><span class="chip dark">${esc(f.name)}</span>${issues.length ? `<span class="chip dark bad-chip">${issues.length} to fix</span>` : s.total ? `<span class="chip dark ok-chip">Legal</span>` : ""}</span>
    <span class="tile-body">
      <b>${esc(d.name)}</b>
      <small>${esc(pw?.plan || GAMES[g].short)} · ${main}${g === "ygo" ? " main" : "/60"}</small>
      <span class="tile-stats">${pw ? powerChip(pw) : ""}<span><em>${Math.round(owned * 100)}%</em> owned</span><span><em>${usd(s.value, 0)}</em> value</span>${s.total - s.owned ? `<span><em>${usd(s.buy, 0)}</em> to finish</span>` : ""}</span>
      ${bar(owned, "thin")}
    </span>
  </button>`;
}

/* ---------- search ---------- */

export function tcgSearch() {
  const g = game(),
    U = ui(g).search,
    m = ownedMap(g),
    max = U.maxPrice === "" ? null : Number(U.maxPrice),
    fid = U.f.format || "",
    f = fid ? formatOf(g, fid) : null;
  let list = U.results.map((c) => cardOf(g, c.id) || c);
  if (max !== null) list = list.filter((c) => price(c) !== null && price(c) <= max);
  if (f && g === "ptcg") list = list.filter((c) => c.brief || SOURCES.ptcg.legality(c, f) === "legal");
  if (U.own) list = list.filter((c) => (U.own === "owned" ? ownedOf(g, c, m) > 0 : !ownedOf(g, c, m)));
  if (U.sort === "price") list = [...list].sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
  // Low to high: cards without a price go last, never counted as free.
  if (U.sort === "priceAsc") list = [...list].sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity));
  const st = U.f.type || "",
    kinds = st === "Spell Card" ? YGO_SPELL_KINDS : st === "Trap Card" ? YGO_TRAP_KINDS : YGO_RACES,
    filters =
      g === "ygo"
        ? `<label>Card type<select data-change="tFilter" data-field="type">${options([["", "Any"], ...YGO_TYPES.map((x) => [x, x])], st)}</select></label>
         <label>Attribute<select data-change="tFilter" data-field="attribute">${options([["", "Any"], ...YGO_ATTRIBUTES.map((x) => [x, x])], U.f.attribute || "")}</select></label>
         <label>${st === "Spell Card" ? "Spell kind" : st === "Trap Card" ? "Trap kind" : "Monster type"}<select data-change="tFilter" data-field="race">${options([["", "Any"], ...kinds.map((x) => [x, x])], kinds.includes(U.f.race) ? U.f.race : "")}</select></label>
         ${/Spell|Trap/.test(st) ? "" : `<label>Level / Rank<select data-change="tFilter" data-field="level">${options([["", "Any"], ...Array.from({ length: 13 }, (_, i) => [String(i + 1), String(i + 1)])], U.f.level || "")}</select></label>`}`
        : `<label>Card type<select data-change="tFilter" data-field="category">${options([["", "Any"], ["Pokemon", "Pokémon"], ["Trainer", "Trainer"], ["Energy", "Energy"]], U.f.category || "")}</select></label>
         <label>Energy type<select data-change="tFilter" data-field="type">${options([["", "Any"], ...PTCG_TYPES.map((x) => [x, x])], U.f.type || "")}</select></label>
         <label>Rarity<select data-change="tFilter" data-field="rarity">${options([["", "Any"], ...PTCG_RARITIES.map((x) => [x, x])], U.f.rarity || "")}</select></label>
         <label>Stage<select data-change="tFilter" data-field="stage">${options([["", "Any"], ...PTCG_STAGES], U.f.stage || "")}</select></label>
         <label>HP at least<select data-change="tFilter" data-field="hp">${options([["", "Any"], ...[60, 100, 150, 200, 250, 300].map((x) => [String(x), String(x)])], U.f.hp || "")}</select></label>`,
    sorts =
      g === "ygo"
        ? [["name", "Name"], ["new", "Newest"], ["atkDesc", "ATK: high to low"], ["defDesc", "DEF: high to low"], ["levelDesc", "Level: high to low"], ["priceAsc", "Price: low to high"], ["price", "Price: high to low"]]
        : [["new", "Newest"], ["name", "Name"], ["priceAsc", "Price: low to high"], ["price", "Price: high to low"]];
  const L = (list, v) => (list.find((x) => x[0] === v) || [v, v])[1],
    chips = [
      ...Object.entries(U.f)
        .filter(([k, v]) => v && !["setName"].includes(k))
        .map(([k, v]) => [k, k === "set" ? `Set: ${U.f.setName || v}` : k === "format" ? `Legal in ${formatOf(g, v).name}` : k === "hp" ? `HP ${v}+` : k === "level" ? `Level ${v}` : k === "stage" ? (PTCG_STAGES.find((x) => x[0] === v) || [v, v])[1] : k === "category" ? (v === "Pokemon" ? "Pokémon" : v) : k === "archetype" ? `Archetype: ${v}` : v]),
      ...(U.maxPrice !== "" ? [["maxPrice", `Under ${usd(Number(U.maxPrice))}`]] : []),
      ...(U.own ? [["own", U.own === "owned" ? "Owned" : "Not owned"]] : []),
      ...(U.sort && U.sort !== (g === "ygo" ? "name" : "new") ? [["sort", `Sort: ${L(sorts, U.sort)}`]] : []),
    ];
  return `<div class="page-head"><h1>Search cards</h1>${viewControl(g,"search")}<div class="search-tools"><button class="chip tool-chip" data-act="tCompareOpen" aria-label="Compare cards">${actionIcon("compare")}<span>Compare</span></button><button class="chip tool-chip" data-act="go" data-to="#sets" aria-label="Browse sets">◈ Sets</button><button class="chip tool-chip" data-act="tRandomCard" aria-label="Random card">🎲 Random</button></div></div>
  <div class="searchbar search-query"><input type="search" data-suggest="${g}" value="${esc(U.q)}" placeholder="${g === "ygo" ? "Card name, e.g. Dark Magician" : "Card name, e.g. Charizard"}" data-input="tQ" data-enter="tSearch" aria-label="Search cards" autocomplete="off"><button class="btn" data-act="tSearch" ${U.busy ? "disabled" : ""}>${U.busy ? "…" : "Search"}</button><button class="ask-launch" data-act="askOpen" aria-label="Ask AI"><span aria-hidden="true">✦</span>Ask</button></div>
  ${chips.length ? `<div class="filter-chips" aria-label="Active filters">${chips.map(([k, l]) => `<button class="fchip" data-act="tChip" data-field="${esc(k)}" aria-label="Remove ${esc(l)}">${esc(l)} <span aria-hidden="true">×</span></button>`).join("")}<button class="link small" data-act="tClear">Clear all</button></div>` : ""}
  ${savedSearches(g).length ? `<div class="saved-searches"><span class="muted small">Saved:</span>${savedSearches(g).map((x, i) => `<span class="schip"><button data-act="tSaved" data-i="${i}">${esc(x.label)}</button><button data-act="tSavedDel" data-i="${i}" aria-label="Delete saved search ${esc(x.label)}">×</button></span>`).join("")}</div>` : ""}
  <details class="filters"><summary>Filters${chips.length ? ` · ${chips.length} on` : ""}</summary><div class="grid2">
    <label>Show<select data-change="tOwnFilter">${options([["", "All cards"], ["owned", "Cards I own"], ["missing", "Cards I don’t own"]], U.own || "")}</select></label>
    ${filters}
    <label>Legal in<select data-change="tFilter" data-field="format">${options([["", "Any format"], ...formatsOf(g).map((x) => [x.id, x.name])], fid)}</select></label>
    <label>Sort<select data-change="tSort">${options(sorts, U.sort)}</select></label>
    <label${g === "ygo" ? "" : ' class="span2"'}>Max price $<input type="number" min="0" step="0.5" value="${esc(U.maxPrice)}" placeholder="Any" data-change="tMax"></label>
  </div></details>
  ${U.error ? `<div class="note warn">${esc(U.error)}</div>` : ""}
  ${U.f.set ? `<p class="small">Set: <b>${esc(U.f.setName || U.f.set)}</b> <button class="link small" data-act="tFilterClear" data-field="set">✕ clear</button></p>` : ""}
  ${U.f.archetype ? `<p class="small">Archetype: <b>${esc(U.f.archetype)}</b> <button class="link small" data-act="tFilterClear" data-field="archetype">✕ clear</button></p>` : ""}
  ${U.busy && !list.length ? skeletonGrid() : ""}
  ${
    list.length
      ? `<div class="row between"><p class="muted small">${U.total ? U.total.toLocaleString() : list.length + (U.more ? "+" : "")} cards · daily market prices</p><button class="link small" data-act="tSaveSearch">☆ Save this search</button></div><div class="card-grid">${list
          .map((c) => {
            const own = ownedOf(g, c, m),
              p = price(c);
            return `<button class="grid-card" data-act="tCard" data-id="${esc(c.id)}" ${tierAttrs(tcgTier(c))}>${imgTag(c)}${tileBadges(c)}<span class="grid-meta"><span class="ellip">${esc(c.name)}</span><span>${c.brief ? "…" : p === null ? "—" : usd(p)}</span></span>${own ? `<span class="owned-badge">×${own}</span>` : ""}</button>`;
          })
          .join("")}</div>${U.more ? `<button class="btn ghost block" data-act="tMore" ${U.busy ? "disabled" : ""}>Load more</button>` : ""}`
      : U.ran && !U.busy
        ? empty("No cards found", "Try a shorter name or clear a filter.")
        : U.busy
          ? `<p class="muted center pad">Searching…</p>`
          : `<p class="muted small">Search by name, or leave it blank and pick filters. ${g === "ptcg" ? "Pokémon TCG Pocket (digital) cards are left out." : ""}</p>`
  }`;
}

/* ---------- card sheet ---------- */

const RULES_LINKS = {
  ygo: [["Official card database (Konami)", (c) => `https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&keyword=${encodeURIComponent(c.name)}&stype=1&rp=10`], ["YGOPRODeck card page", (c) => c.url || `https://ygoprodeck.com/card-database/?name=${encodeURIComponent(c.name)}`]],
  ptcg: [["Official rules & rulings (Pokémon)", () => "https://www.pokemon.com/us/play-pokemon/about/pokemon-tcg-rules"], ["Limitless card search", (c) => `https://limitlesstcg.com/cards?q=${encodeURIComponent(c.name)}`]],
};
const eur = (v) => (v ? "€" + Number(v).toFixed(2) : "—");

export function tcgCardSheet(c, sctx = {}) {
  const g = c.game,
    tab = sctx.tab && sctx.tab !== "trade" ? sctx.tab : "overview", // Trade tab retired for now
    own = ownedOf(g, c),
    decks = gs(g).decks,
    deck = sctx.deckId ? decks.find((d) => d.id === sctx.deckId) : null,
    p = c.prices || {},
    f = deck ? formatOf(g, deck.format) : null,
    wished = gs(g).wishlist.some((w) => w.cardId === c.id),
    heroSrc = g === "ygo" ? c.art || c.imageLarge : artworkSources(c,true)[0],
    heroFallback = g === "ygo" ? c.artDirect || "" : "";
  const overview = `
    <div class="cs-card"><div class="cd-art-stack"><div class="cd-img"><button class="cd-zoom" data-hold-card="true" data-id="${esc(c.id)}" data-entry="${esc(sctx.entryId||'')}" data-act="zoomCard" data-src="${esc(artworkSources(c,true)[0] || "")}" data-hi="${esc(g === "ygo" ? ygoImageDirect(c.id, false) : c.imageLarge || "")}" data-fallback="${esc(artworkSources(c,true)[1] || "")}" data-art="${esc(g === "ygo" ? c.artDirect || "" : "")}" data-name="${esc(c.name)}" aria-label="Enlarge ${esc(c.name)}">${imgTag(c, "card-img", true)}<span class="zoom-badge" aria-hidden="true">${ICON.zoom}</span></button></div></div>
      <div class="cs-card-side">${alertStatus(g,trackedQuote(g,c)?.id,c.name)}
        <p class="small own-line">${own ? `<b class="ok-text">You own ${own}</b>` : "Not in your collection"}</p>
        ${deck ? `<p class="small deck-legal ${SOURCES[g].legality(c, f) === "legal" ? "ok-text" : "bad-text"}">${SOURCES[g].legality(c, f) === "legal" ? "✓ Legal" : "● Not allowed"} in ${esc(f.name)} <span class="muted">(${esc(deck.name)})</span></p>` : ""}
        ${c.stats?.length ? `<div class="stat-grid">${c.stats.filter(([k]) => g !== "ptcg" || !["HP", "Type", "Weakness", "Resistance", "Retreat"].includes(k)).map(([k, v]) => statCell(c, k, v)).join("")}</div>${c.regulationMark ? regulationHelp(c) : ""}` : ""}
      </div></div>
    ${quoteWarning(c)}
    <div class="card-actions">
      <div class="ca-main"><button class="btn" data-act="tOwn" data-id="${esc(c.id)}">＋ Add to collection</button><button class="btn ghost" data-act="tWish" data-id="${esc(c.id)}">${wished ? "♥ On wishlist" : "♡ Wishlist"}</button></div>
      <div class="ca-more"><button class="btn ghost small" data-act="tBuild" data-id="${esc(c.id)}">⚒ Build decks</button><button class="btn ghost small" data-act="tCompareFrom" data-id="${esc(c.id)}">⇄ Compare</button>${sctx.random ? `<button class="btn ghost small" data-act="tRandomCard">🎲 Another</button>` : ""}</div>
    </div>
    ${decks.length ? `<div class="inline-pick"><select id="tToDeck" aria-label="Deck">${options(decks.map((d) => [d.id, d.name]), deck?.id || decks.at(-1).id)}</select><button class="btn ghost" data-act="tAddToDeck" data-id="${esc(c.id)}">Add to deck</button></div>` : ""}
    ${factBox(factsFor(c), c.id)}`;
  // Same art-first rows as Magic's Versions: thumbnail, set mark, set name, code, Buy, price box.
  const artworkGallery = g === "ygo" && c.artworks?.length ? `<section class="variant-gallery"><h3>Available artwork</h3><p class="foot">These are the source’s artwork scans. Set code, rarity and edition are not mapped to individual images.</p><div class="artwork-grid">${c.artworks.map((a,i) => `<div class="artwork-item">${variantArtThumb(c,a,`data-art="${esc(a.id)}"`)}<span>${esc(a.label)} ${i+1}</span></div>`).join("")}</div></section>` : "";
  const thumb = `<img class="print-thumb" src="${esc(c.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" ${g === "ygo" ? `onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${esc(ygoImageDirect(c.id))}'}else this.remove()"` : `onerror="this.remove()"`}>`;
  const versions =
    g === "ygo"
      ? c.sets?.length
        ? `<div class="print-list">${c.sets
            .slice()
            .sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
            .map(
              (s) => `<div class="print">
        <button class="print-main" data-act="tSetByName" data-name="${esc(s.name)}">${thumb}<span class="print-name"><span class="ellip"><b>${esc(s.name)}</b><small>${ygoPrintBadge(s)} ${esc(s.rarity || "")} · reference art</small></span></span></button>
        <span class="print-prices"><a class="pp buy" href="${s.url || `https://www.tcgplayer.com/search/yugioh/product?productLineName=yugioh&q=${encodeURIComponent(s.code+' '+s.rarity)}`}" target="_blank" rel="noopener noreferrer" aria-label="Buy the ${esc(s.code)} printing">Buy</a><span class="pp"><small>reference</small>${s.quotes?.length ? s.quotes.map(q=>`<span class="printing-quote"><small>${esc(q.edition)} · ${referenceLabel(referenceQuote(q)?.kind)}</small>${usd(referenceQuote(q)?.value)}</span>`).join("") : s.price ? usd(s.price) : "Unavailable"}</span></span>
      </div>`,
            )
            .join("")}</div><p class="foot">${c.sets.length} printings, priciest first. Thumbnails are reference art; inspect the seller’s edition and rarity. Tap a printing to open its set.</p>${artworkGallery}`
        : `<p class="muted small">No printings listed.</p>${artworkGallery}`
      : c.set
        ? `<div class="print-list"><div class="print on">
        <button class="print-main" data-act="tSet" data-id="${esc(c.set.id)}">${thumb}<span class="print-name">${pkSetSymbol(c.set)}<span class="ellip"><b>${esc(c.set.name)}</b><small>${esc((c.set.id || "").toUpperCase())} #${esc(c.set.number || "")}${c.set.total ? "/" + c.set.total : ""} · ${pkRarity(c.rarity)} ${esc(c.rarity || "")}</small></span></span></button>
        <span class="print-prices"><a class="pp buy" href="${esc(SOURCES.ptcg.buy(c)[0]?.[1] || "#")}" target="_blank" rel="noopener noreferrer">Buy</a><span class="pp"><small>reference</small>${usd(p.usd)}</span></span>
      </div></div><div class="list compact">${(c.variants || []).map(v => `<div class="variant-row">${variantArtThumb(c,v,`data-variant="${esc(v.key)}"`)}<div class="variant-copy"><b>${esc(v.label)}</b><small class="muted">${esc(variantArtwork(c,v).label)}</small><span>${v.usd == null ? "Price unavailable" : usd(v.usd)}</span></div><span class="variant-actions">${v.productId ? `<a class="link small" href="https://www.tcgplayer.com/product/${encodeURIComponent(v.productId)}" target="_blank" rel="noopener noreferrer">Seller ↗</a>` : ""}${variantOwnControl(g, c, v)}</span></div>`).join("")}</div><p class="foot">Check the edition and finish on the seller's page before buying.</p><p class="foot">Pokémon reprints are separate cards with their own number. <button class="link small" data-act="tOtherPrintings" data-name="${esc(c.name)}">See every “${esc(c.name)}” →</button></p>`
        : "";
  const prices =
    g === "ptcg"
      ? `${c.variants?.length ? `<div class="price-table"><div class="pt-head"><span>TCGplayer (USD)</span><b>Low</b><b>Mid</b><b>Market</b></div>${c.variants.map((v) => `<div class="pt-row"><span class="pt-label">${esc(v.label)}</span><span>${usd(v.low)}</span><span>${usd(v.mid)}</span><span><b>${usd(v.market)}</b></span></div>`).join("")}</div>` : `<p class="muted small">No TCGplayer price yet.</p>`}
        ${c.cardmarket && (c.cardmarket.trend || c.cardmarket.avg) ? `<div class="price-table"><div class="pt-head"><span>Cardmarket (EUR)</span><b>Low</b><b>Average</b><b>Trend</b></div><div class="pt-row"><span class="pt-label">Normal</span><span>${eur(c.cardmarket.low)}</span><span>${eur(c.cardmarket.avg)}</span><span><b>${eur(c.cardmarket.trend)}</b></span></div>${c.cardmarket.holoTrend ? `<div class="pt-row"><span class="pt-label">Holo / reverse</span><span>${eur(c.cardmarket.holoLow)}</span><span>${eur(c.cardmarket.holoAvg)}</span><span><b>${eur(c.cardmarket.holoTrend)}</b></span></div>` : ""}</div>` : ""}`
      : `<div class="price-table" style="--cols:1"><div class="pt-head"><span>Store</span><b>Price</b></div>
        <div class="pt-row"><span class="pt-label">TCGplayer market</span><span><b>${usd(p.usd)}</b></span></div>
        <div class="pt-row"><span class="pt-label">Cardmarket</span><span><b>${eur(p.eur)}</b></span></div>
        ${(p.others || []).map(([k, v]) => `<div class="pt-row"><span class="pt-label">${esc(k)}</span><span><b>${usd(v)}</b></span></div>`).join("")}</div>
        <p class="small">Each printing has its own price — see <button class="link small" data-act="cardTab" data-tab="versions">Versions</button>.</p>`;
  const buy = `<div class="links research"><span class="muted small">Buy</span>${SOURCES[g].buy(c).map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(l)} ↗</a>`).join("")}</div>`;
  const rulings = `<p class="small">${g === "ygo" ? "Konami publishes card rulings in its official database rather than as data, so they open there." : "Pokémon rulings are published by The Pokémon Company rather than as data, so they open there."}</p>
    <div class="list compact">${RULES_LINKS[g].map(([l, u]) => `<a class="mini-row store" href="${esc(u(c))}" target="_blank" rel="noopener noreferrer"><span>${esc(l)}</span><span class="small">↗</span></a>`).join("")}</div>
    <button class="btn ghost small" data-act="go" data-to="#rules">${esc(GAMES[g].short)} rules reference →</button>`;
  const legal = `${legalChips(g, c)}<p class="foot">${g === "ygo" ? "Forbidden = 0 copies, Limited = 1, Semi-Limited = 2, otherwise 3. Banlists from YGOPRODeck." : "Standard/Expanded legality from TCGdex; Gym Leader Challenge also bans Rule Box Pokémon."} <button class="link small" data-act="go" data-to="#rules">Banlists & format rules →</button></p>`;
  return `<div class="sheet-head overlay"><span></span><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="cs-banner ${!artworkSources(c, true).length && !heroSrc ? "no-art" : ""}"><div class="cs-hero ${g}">${g === "ptcg" ? pokemonArtCrop(c, "cs-art") : heroSrc ? `<img class="cs-art" src="${esc(heroSrc)}" alt="${esc(c.name)}" referrerpolicy="no-referrer" onerror="${heroFallback ? `if(!this.dataset.f){this.dataset.f=1;this.src='${esc(heroFallback)}'}else ` : ""}this.remove()">` : ""}<div class="cs-shade"></div></div>
  <div class="cs-title"><div><h2>${esc(c.name)}</h2><p class="type-line">${esc(c.typeLine || "")}</p></div>${gameEmblems(c)}</div></div>
  ${emblemChips(g, c)}
  <div class="cs-meta">
    ${g === "ygo" ? ygoSetRow(c) : ""}
    ${c.set ? `<button class="cd-set" data-act="tSet" data-id="${esc(c.set.id)}">${pkSetSymbol(c.set, "pks big")}<div><b>${esc(c.set.name)} <span class="set-go">›</span></b><small>#${esc(c.set.number || "")}${c.set.total ? "/" + c.set.total : ""}${c.rarity ? ` · ${pkRarity(c.rarity)} ${esc(c.rarity)}` : ""}</small></div></button>` : c.archetype ? `<button class="cd-set" data-act="tArchetype" data-name="${esc(c.archetype)}"><div><b>${esc(c.archetype)} <span class="set-go">›</span></b><small>Archetype · ${c.sets?.length || 0} printings</small></div></button>` : ""}
    <div class="cd-prices"><button class="price-pill${p.usd == null && !lastQuote(g, c) && myPrice(c) == null && !c.brief ? " unknown" : ""}" data-act="tBuyDirect" data-hold="tMyPriceSet" data-game="${g}" data-id="${esc(c.id)}" aria-label="Buy on TCGplayer. Press and hold to set your own price."><small>${referenceLabel(p.referenceKind)}${p.referenceVariantLabel ? ` · ${esc(p.referenceVariantLabel)}` : ""}</small><b>${p.usd !== null && p.usd !== undefined ? usd(p.usd) : c.brief ? "…" : lastQuote(g, c) ? usd(lastQuote(g, c).value) : myPrice(c) != null ? usd(myPrice(c)) : "No price yet"}</b>${p.usd == null && lastQuote(g, c) ? `<small class="pill-note">last quote ${esc(lastQuote(g, c).date)}${lastQuote(g, c).finish ? " · " + esc(lastQuote(g, c).finish) : ""}</small>` : myPrice(c) != null ? `<small class="pill-note">${p.usd == null ? "Your price" : "yours " + usd(myPrice(c))}</small>` : ""}<span class="buy-hint">${p.usd == null && !lastQuote(g, c) ? "Find sellers ›" : "Buy ›"}</span></button>${p.eur ? `<button class="price-pill" data-act="cardTab" data-tab="prices"><small>Cardmarket</small><b>€${p.eur.toFixed(2)}</b></button>` : ""}<p class="price-gap small muted">Tap a price to buy on TCGplayer. Press and hold it, or <button class="link small" data-act="tMyPriceSet" data-game="${g}" data-id="${esc(c.id)}">set your price</button>; only you see it. Every printing's price is under Prices.</p></div>
    ${p.usd == null && !p.eur && !c.brief ? `<p class="price-gap small muted">Stores haven't listed a price for this card yet. That's normal for new sets and rarely sold cards; it fills in when sales start.</p>` : ""}
  </div>
  ${g === "ptcg" && !c.brief ? pokemonText(c) : c.text ? `<section class="cd-text effect-card ygo"><p class="eyebrow effect-label">${c.frame==='normal'?'Lore · Flavour text':'Chaincraft · Card effect'}</p>${c.frame==='normal'?`<blockquote class="flavor">${esc(c.text)}</blockquote>`:`<div class="oracle">${effectText(g,c.text)}</div>`}${c.illustrator ? `<div class="small muted right">🖌 ${esc(c.illustrator)}</div>` : ""}</section>` : ""}
  ${tabs(tab, [["overview", "Overview"], ["meta", "Meta"], ["guide", "Play guide"], ["versions", "Versions"], ["prices", "Prices"], ["rulings", "Rulings"], ["legal", "Legality"]])}
  ${panel("overview", tab, overview)}
  ${panel("meta", tab, tcgCardMeta(g, c))}
  ${panel("guide", tab, tcgCardGuide(g, c))}
  ${panel("versions", tab, versions)}
  ${tab === "trade" ? panel("trade", tab, tcgTradePanel(g, c, own, sctx)) : ""}
  ${panel("prices", tab, priceOverview(g,c,sctx,SOURCES[g].buy(c)) + `<details class="market-details"><summary>Market details · sources & finishes</summary>` + prices + `<p class="foot">${esc(p.source || "")}${p.updated ? " · updated " + esc(new Date(p.updated).toLocaleDateString()) : c.fetchedAt ? " · checked " + esc(new Date(c.fetchedAt).toLocaleDateString()) : ""}. Condition prices and stock are on the store’s page.</p>` + buy + `</details>`)}
  ${panel("rulings", tab, rulings)}
  ${panel("legal", tab, legal)}`;
}
// The card's Play guide tab: what it does, when to play it, synergies and cards that pair well.
function tcgCardGuide(g, c) {
  const cache = S.ui.guide?.[g + ":" + c.id];
  return guideHtml(g, c, playGuide(g, c), {
    alongside: playedAlongside(g, c, allCachedMeta()),
    alongsideAttrs: (x) => (g === "ygo" ? `data-act="tCard" data-id="${esc(x.id)}"` : `data-act="tFindName" data-name="${esc(x.name)}"`),
    alongsideName: (x) => (g === "ygo" ? cardOf(g, x.id)?.name || "Card #" + x.id : x.name),
    complements: cache?.cards || [],
    complementsLoading: !cache || cache.loading,
    complementsNote: cache?.note || "",
    rules: cardRules(g, c),
  });
}
// The card's Meta tab: where it's played, the tournament decks that play it, and decks to build around it.
function tcgCardMeta(g, c) {
  const M = metaState(g);
  return cardMetaTab(g, c, cardMetaUsage(g, c), {
    deckAttrs: (set, d) => `data-act="tMetaDeck" data-key="${esc(d.key)}"`,
    buildAttrs: `data-act="tBuild" data-id="${esc(c.id)}"`,
    loadAttrs: M.data && Date.now() - M.at < 12 * 3600e3 ? "" : `data-act="cardMetaLoad" data-key="${g}"`,
    loadLabel: g === "ygo" ? "Load recent Yu-Gi-Oh! tournament decks" : "Load recent Pokémon tournament decks",
    busy: M.busy,
    extra: g === "ygo" && c.archetype ? `<button class="btn ghost" data-act="tArchetype" data-name="${esc(c.archetype)}">More ${esc(c.archetype)} cards</button>` : "",
  }) + `<p class="foot">${g === "ygo" ? "Recent tournament top decks from YGOPRODeck." : "Top 8 lists from recent big Standard events on Limitless."}</p>`;
}
// Pokémon card text laid out like the card: abilities, attacks with Energy costs, then the bottom strip.
function pokemonText(c) {
  const strip = [
    c.weak?.length ? `<span>Weakness ${c.weak.map((w) => energyIcon(w.type, "sm") + esc(w.value)).join(" ")}</span>` : "",
    c.resist?.length ? `<span>Resistance ${c.resist.map((w) => energyIcon(w.type, "sm") + esc(w.value)).join(" ")}</span>` : "",
    c.retreat !== null && c.retreat !== undefined && c.category === "Pokemon" ? `<span>Retreat ${c.retreat ? Array(c.retreat).fill(energyIcon("Colorless", "sm")).join("") : "0"}</span>` : "",
  ].filter(Boolean);
  return `<section class="cd-text pk effect-card ptcg"><p class="eyebrow effect-label">Battlecraft · Abilities & attacks</p>
    ${(c.abilities || []).map((a) => `<div class="pk-ability"><span class="pk-tag">${esc(a.type)}</span> <b>${esc(a.name)}</b><p>${ruleText("ptcg",plainText(a.effect))}</p></div>`).join("")}
    ${(c.attacks || []).map((a) => `<div class="pk-attack"><div class="row between"><span class="row">${attackLine(a.cost)}<b>${esc(a.name)}</b></span>${a.damage !== "" ? `<b class="dmg">${esc(a.damage)}</b>` : ""}</div>${a.effect ? `<p>${ruleText("ptcg",plainText(a.effect))}</p>` : ""}</div>`).join("")}
    ${c.effect ? `<p class="oracle">${ruleText("ptcg",plainText(c.effect))}</p>` : ""}
    ${!c.attacks?.length && !c.abilities?.length && !c.effect && c.text ? `<div class="oracle">${effectText(g,c.text)}</div>` : ""}
    ${strip.length ? `<div class="pk-strip">${strip.join("")}</div>` : ""}
    ${c.flavor ? `<blockquote class="flavor"><small class="eyebrow">Flavour</small>${esc(c.flavor)}</blockquote>` : ""}
    ${c.illustrator ? `<div class="small muted right">🖌 ${esc(c.illustrator)}</div>` : ""}
  </section>`;
}
const tabs = (tab, items) => `<nav class="cs-tabs" role="tablist">${items.map(([id, label]) => `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? "on" : ""}" data-act="cardTab" data-tab="${id}">${label}</button>`).join("")}</nav>`;
const panel = (id, tab, html) => `<div class="cs-panel" data-tab="${id}" ${id === tab ? "" : "hidden"}>${html}</div>`;

export function tcgAddSheet(c, preset = "") {
  const g = c.game,
    opts = g === "ygo" ? c.sets?.map((s) => [s.code + "|" + s.rarity, `${s.code} · ${s.rarity}${s.price ? " · " + usd(s.price) : ""}`]) || [] : c.variants?.map((v) => [v.key, `${v.label}${v.usd ? " · " + usd(v.usd) : ""}`]) || [];
  return `<div class="sheet-head"><h2>Add to collection</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="build-seed">${imgTag(c, "mini-art")}<div><b>${esc(c.name)}</b><small class="muted">${esc(c.typeLine || "")}</small></div><span></span></div>
  <div class="grid2">
    <label>Copies<input id="tQty" type="number" min="1" max="999" value="1"></label>
    <label>Condition<select id="tCond" aria-label="Condition">${options(["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"].map((x) => [x, x]), "Near Mint")}</select></label>
    ${opts.length ? `<label class="span2">${g === "ygo" ? "Printing (set code · rarity)" : "Version"}<select id="tPrint">${options([["", g === "ygo" ? "Not sure / any printing" : "Not sure"], ...opts], opts.some((o) => o[0] === preset) ? preset : "")}</select></label>` : ""}
    ${g === "ygo" ? `<label class="span2">Edition<select id="tEdition">${options([["", "Not sure"], ["1st-edition", "First Edition"], ["unlimited", "Unlimited"], ["limited", "Limited Edition"]], "")}</select></label><p class="foot span2">Set prices do not distinguish editions. An edition-specific value stays unknown; verify it with the seller.</p>` : `<p class="foot span2">Versions without a price are still collectible. The source image may represent a different edition; confirm stamps and borders yourself.</p>`}
    ${locationPicker(S.state,g,"tLoc")}
  </div>
  <section id="conditionPricePreview" class="condition-price-preview" role="status" aria-label="Selected condition value"></section>
  <details class="more" open><summary>Value for this condition</summary><label>Your value per copy (USD, optional)<input id="lotManualValue" type="number" min="0" step="0.01" placeholder="No condition quote"></label><p class="foot">Reference amounts in Version describe that printing, not its condition. Played or damaged copies without a matching quote are excluded from totals unless you enter a value.</p></details>
  <button class="btn block" data-act="tOwnSave" data-id="${esc(c.id)}">Add to collection</button>`;
}

// Yu-Gi-Oh!: the set a card comes from, like Magic and Pokémon — your printing if you own one,
// otherwise its first release. Tapping opens the whole set's card list.
let ygoSetDates = null;
const ygoSetIndex = () => {
  if (ygoSetDates) return ygoSetDates;
  try {
    const list = ui("ygo").sets.list.length ? ui("ygo").sets.list : JSON.parse(localStorage.getItem("cardforge-ygo-sets-v1") || "null")?.list || [];
    if (list.length) ygoSetDates = new Map(list.map((x) => [x.name, x]));
  } catch {}
  return ygoSetDates || new Map();
};
function ygoSetRow(c) {
  if (!c.sets?.length) return "";
  const idx = ygoSetIndex(),
    mine = gs("ygo").collection.find((e) => e.cardId === c.id && e.printing),
    dated = c.sets.map((s) => ({ ...s, date: idx.get(s.name)?.date || "" })),
    pick = (mine && dated.find((s) => s.code === mine.printing)) || dated.filter((s) => s.date).sort((a, b) => a.date.localeCompare(b.date))[0] || dated[0],
    prefix = String(pick.code).split("-")[0];
  return `<button class="cd-set" data-act="tSetByName" data-name="${esc(pick.name)}"><img class="ygo-pack" src="https://images.ygoprodeck.com/images/sets/${esc(encodeURIComponent(prefix))}.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ygo-pack none',textContent:'${esc(prefix)}'}))"><div><b>${esc(pick.name)} <span class="set-go">›</span></b><small>${ygoPrintBadge(pick)} ${esc(pick.rarity || "")}${pick.date ? " · " + esc(pick.date.slice(0, 4)) : ""}${mine ? " · your printing" : c.sets.length > 1 ? ` · first of ${c.sets.length} printings` : ""}</small></div></button>`;
}

/* ---------- collection ---------- */

// Collection value over time (one point a day, kept on this device), top cards and alerts.
const VALUE_KEY = (g) => `cardstashy-value-hist-${g}`;
export function trackTcgValue(g, v = collectionValue(g)) {
  if (!gs(g).collection.length) return [];
  let h = [];
  try {
    h = JSON.parse(localStorage.getItem(VALUE_KEY(g)) || "[]");
  } catch {}
  const day = new Date().toISOString().slice(0, 10);
  h = h.filter((x) => x.date !== day);
  h.push({ date: day, total: Math.round(v.total * 100) / 100, copies: v.copies });
  h = h.slice(-365);
  try {
    localStorage.setItem(VALUE_KEY(g), JSON.stringify(h));
  } catch {}
  return h;
}
function tcgValueView(g) {
  const st = gs(g),
    v = collectionValue(g),
    hist = trackTcgValue(g, v),
    m = new Map();
  for (const e of st.collection) {
    const c = cardOf(g, e.cardId), p = entryPrice(c, e);
    if (p != null) m.set(e.id, { e, c, each: p, total: p * e.qty });
  }
  const top = [...m.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  const tabs = segmented("tCollTab", "value", [["cards", "Cards"], ["binders", "Binders"], ["value", "Value"]]);
  if (!st.collection.length) return `<div class="page-head"><h1>Collection</h1></div>${tabs}<section class="empty"><h3>No value to track yet</h3><p>Add cards and CardStashy records your collection value once a day so you can watch it change.</p></section>${alertsPanel(g)}`;
  return `<div class="page-head"><h1>Collection</h1></div>${tabs}
  <section class="panel"><p class="eyebrow">Your collection value</p><p class="big" data-count="${v.total.toFixed(2)}" data-money="1">${usd(v.total)}</p><p class="muted small">${v.copies} cards${v.unpriced ? ` · ${v.unpriced} without a price` : ""}</p>${lineChart(hist)}</section>
  <section class="panel"><h3>Most valuable</h3><div class="list compact">${top.map((x) => `<button class="mini-row" data-act="tCard" data-id="${esc(x.e.cardId)}"><span class="ellip">${x.e.qty > 1 ? x.e.qty + "× " : ""}${esc(x.e.name)}</span><b>${usd(x.total)}</b></button>`).join("")}</div></section>
  ${tcgTradeAdvice(g)}
  ${alertsPanel(g)}`;
}
export function tcgCollection() {
  const g = game(),
    U = ui(g).coll,
    st = gs(g),
    v = collectionValue(g),
    q = U.q.trim().toLowerCase();
  if (U.tab === "wishlist") (U.tab = "cards"), (U.show = "wanted");
  // Wanted cards live in the collection too: greyed out until you own one.
  const ownedIds = new Set(st.collection.map((e) => e.cardId)),
    wantRows = st.wishlist.filter((w) => !ownedIds.has(w.cardId)).map((w) => ({ w, c: cardOf(g, w.cardId), e: { id: "w:" + w.id, cardId: w.cardId, name: w.name, qty: 0, addedAt: w.addedAt || "" } })),
    show = U.show || "all",
    wantTotal = wantRows.reduce((a, x) => a + (price(x.c) ?? 0) * (x.w.qty || 1), 0);
  let rows = [...(show === "wanted" ? [] : st.collection.map((e) => ({ e, c: cardOf(g, e.cardId) }))), ...(show === "owned" ? [] : wantRows)];
  const setNames = [...new Set(rows.map((x) => setLabel(x)).filter(Boolean))].sort();
  if (q) rows = rows.filter((x) => [x.e.name,x.e.location,setLabel(x)].join(" ").toLowerCase().includes(q));
  if (U.set) rows = rows.filter((x) => setLabel(x) === U.set);
  const rarityOf = (x) => x.e.rarity || x.c?.rarity || "",
    rarities = [...new Set(st.collection.map((e) => rarityOf({ e, c: cardOf(g, e.cardId) })).filter(Boolean))].sort(),
    kinds = g === "ygo" ? [["meta", "★ Meta & staples"], ["Monster", "Monsters"], ["Spell", "Spells"], ["Trap", "Traps"], ["extra", "Extra Deck"], ...YGO_ATTRIBUTES.map((a) => ["attr:" + a, a])] : [["meta", "★ Meta & staples"], ["Pokemon", "Pokémon"], ["Trainer", "Trainers"], ["Energy", "Energy"], ...PTCG_TYPES.map((t) => ["type:" + t, t + " type"])],
    kindOk = (c, k) => !k || (!!c && (k === "meta" ? hasEmblem(g, c) : k === "extra" ? !!c.extra : k.startsWith("attr:") ? c.attribute === k.slice(5) : k.startsWith("type:") ? (c.types || []).includes(k.slice(5)) : c.category === k));
  if (U.kind) rows = rows.filter((x) => kindOk(x.c, U.kind));
  if (U.rarity) rows = rows.filter((x) => rarityOf(x) === U.rarity);
  const val = (x) => (x.w ? price(x.c) ?? -1 : (entryPrice(x.c, x.e) ?? -1) * x.e.qty);
  const orderOf=x=>({name:x.e.name,set:setLabel(x),number:g==='ptcg'?x.c?.set?.number:x.e.printing?.split('-').at(-1),date:g==='ptcg'?x.c?.released || ui(g).sets.list.find(s=>s.id===x.c?.set?.id)?.date || POKEMON_SET_ART[x.c?.set?.id]?.date:ygoSetIndex().get(setLabel(x))?.date || x.c?.released});
  rows.sort(U.sort === "set-order" ? (a,b)=>collectionOrder(orderOf(a),orderOf(b)) : U.sort === "impact" ? (a, b) => impactScore(g, b.c) - impactScore(g, a.c) || val(b) - val(a) : U.sort === "name" ? (a, b) => a.e.name.localeCompare(b.e.name) : U.sort === "recent" ? (a, b) => String(b.e.addedAt).localeCompare(String(a.e.addedAt)) : U.sort === "set" ? (a, b) => setLabel(a).localeCompare(setLabel(b)) || a.e.name.localeCompare(b.e.name) : U.sort === "rarity" ? (a, b) => rarityOf(a).localeCompare(rarityOf(b)) || a.e.name.localeCompare(b.e.name) : (a, b) => val(b) - val(a));
  if (U.tab === "value") return tcgValueView(g);
  if (U.tab === "binders") return `<div class="page-head"><h1>Collection</h1><button class="btn ghost small" data-act="go" data-to="#search">＋ Add cards</button></div>${segmented("tCollTab","binders",[["cards","Cards"],["binders","Binders"],["value","Value"]])}${binderShelf(st.collection.map(entry=>({entry,card:cardOf(g,entry.cardId),image:cardOf(g,entry.cardId)?.variants?.find(v=>v.key===entry.variant)?.image || cardOf(g,entry.cardId)?.image || "",game:g})),g,S.state.settings.binders || [])}`;
  return `<div class="page-head"><h1>Collection</h1><div class="head-actions">${viewControl(g,"collection")}${selectionControl(g)}<button class="btn ghost small" data-act="go" data-to="#search">＋ Add cards</button></div></div>
  ${segmented("tCollTab", "cards", [["cards", "Cards"], ["binders", "Binders"], ["value", "Value"]])}
  ${st.collection.length || wantRows.length ? `<div class="coll-summary"><button class="cs-value" data-act="tCollTab" data-id="value" aria-label="See collection value"><b data-count="${Math.round(v.total)}" data-money="1">${usd(v.total, 0)}</b><span>${v.copies} card${v.copies === 1 ? "" : "s"}${wantRows.length ? ` · ${wantRows.length} wanted` : ""}${Math.min(rows.length, U.limit || 120) < rows.length ? ` · showing ${Math.min(rows.length, U.limit || 120)} of ${rows.length}` : rows.length !== st.collection.length + wantRows.length ? ` · showing ${rows.length}` : ""}${v.unpriced ? ` · ${v.unpriced} unpriced` : ""}</span></button><button class="icon" data-act="tRefreshPrices" aria-label="Refresh prices">${actionIcon("refresh")}</button></div>` : ""}
  ${st.collection.length || wantRows.length ? `<div class="coll-tools"><input type="search" value="${esc(U.q)}" placeholder="Search your cards" data-input="tCollQ" aria-label="Search collection"><div class="filter-pills"><select data-change="tCollSet" aria-label="Set">${options([["", "All sets"], ...setNames.map((x) => [x, x])], U.set)}</select><select data-change="tCollKind" data-field="kind" aria-label="Kind">${options([["", "All kinds"], ...kinds], U.kind)}</select>${rarities.length > 1 ? `<select data-change="tCollKind" data-field="rarity" aria-label="Rarity">${options([["", "All rarities"], ...rarities.map((x) => [x, x])], U.rarity)}</select>` : ""}${wantRows.length ? `<select data-change="tCollKind" data-field="show" aria-label="Show">${options([["all", "Owned + wanted"], ["owned", "Owned"], ["wanted", `Wanted · ${wantRows.length}`]], show)}</select>` : ""}<select data-change="tCollSort" aria-label="Sort">${options([["set-order","Set year · card number"], ["value", "Value"], ["impact", "Deck-building value"], ["name", "Name"], ["set", "Set"], ["rarity", "Rarity"], ["recent", "Recently added"]], U.sort)}</select></div></div>
  <div class="list display-list deal">${rows.slice(0,U.limit || 120)
    .map(({ e, c, w }, i) => {
      if (w) return wantedLot(g, w, c, i);
      const p = entryPrice(c, e);
      const t = tcgTier(c, e, p);
      return `<div class="lot" data-tier="${t.key}" style="--i:${Math.min(i, 24)};${tierStyle(t)}">${selectionMark(g,e.id)}<button class="lot-art" data-act="tCard" data-id="${esc(e.cardId)}" data-entry="${esc(e.id)}" aria-label="Open ${esc(e.name)}">${imgTag(c)}${tileBadges(c)}${tierGem(t)}</button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(e.cardId)}" data-entry="${esc(e.id)}">${esc(e.name)}${rowEmblem(g, c)}</button><span class="lot-sub">${rowBadges(c)}${esc(setLabel({ e, c }) || "")}${e.printing ? " · " + esc(e.printing) : ""}${e.rarity ? " · " + esc(e.rarity) : ""}${e.variant ? " · " + esc(c?.variants?.find((v) => v.key === e.variant)?.label || e.variantLabel || e.variant) : ""}${e.edition ? " · " + esc({"1st-edition":"First Edition",unlimited:"Unlimited",limited:"Limited Edition"}[e.edition] || e.edition) : ""}${e.condition && e.condition !== "Near Mint" ? " · " + esc(e.condition) : ""}${e.location ? " · " + esc(e.location) : ""}</span></div><div class="lot-side"><button class="price link" data-act="marketOpen" data-game="${g}" data-id="${esc(e.cardId)}" data-finish="${esc(e.variant||"reference")}" aria-label="Price history and sellers for ${esc(e.name)}">${p === null ? "—" : usd(p * e.qty)}</button>${e.condition&&e.condition!=="Near Mint"?`<small class="condition-value-note">${esc(conditionValueNote(e,[...(c?.conditionQuotes||[]),...(e.conditionQuotes||[])]))}</small>`:""}<span class="stepper"><button data-act="tEntryQty" data-id="${esc(e.id)}" data-delta="-1" aria-label="One fewer">−</button><b>${e.qty}</b><button data-act="tEntryQty" data-id="${esc(e.id)}" data-delta="1" aria-label="One more">＋</button></span></div></div>`;
    })
    .join("")}</div>${selectionTray(g)}${!rows.length ? empty("No matching cards", "Try a different search or filter.") : ""}${rows.length > (U.limit || 120) ? `<button class="btn ghost block" data-act="tCollMore">Load more · ${rows.length-(U.limit || 120)} remaining</button>` : ""}`
  : empty(`No ${esc(GAMES[g].short)} cards yet`, "Search for a card and tap “Add to collection”, or import a list.", `<button class="btn" data-act="go" data-to="#search">Find cards</button><button class="btn ghost" data-act="tImportColl">Paste a list</button>`)}
  ${st.collection.length || wantRows.length ? `<div class="actions wrap">${wantRows.length ? `<button class="btn ghost small" data-act="tWishCopy">Copy wanted list · ${usd(wantTotal, 0)}</button>` : ""}<button class="btn ghost small" data-act="tImportColl">↥ Paste a list</button><button class="btn ghost small" data-act="tExportColl">↓ Export CSV</button></div>` : ""}`;
}
// A card you want but don't own: same row, greyed out in an empty sleeve. Touch it and the
// colour peeks through; "Got it" adds it with the usual details, × drops it from the list.
function wantedLot(g, w, c, i) {
  const p = price(c);
  const t = tcgTier(c, null, p);
  return `<div class="lot wanted" data-tier="${t.key}" style="--i:${Math.min(i, 24)};${tierStyle(t)}"><button class="lot-art" data-act="tCard" data-id="${esc(w.cardId)}" aria-label="Open ${esc(w.name)} (wanted, not owned)">${imgTag(c)}${tileBadges(c)}<span class="want-tag" aria-hidden="true">${actionIcon("heart")}Wanted</span></button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(w.cardId)}">${esc(w.name)}</button><span class="lot-sub"><span class="want-chip">Not owned</span>${rowBadges(c)}${esc(c?.set?.name || "")}</span></div><div class="lot-side"><span class="price">${p == null ? "—" : usd(p)}</span><span class="want-actions"><button class="btn small want-got" data-act="tOwn" data-id="${esc(w.cardId)}">＋ Got it</button><button class="want-x" data-act="tWish" data-id="${esc(w.cardId)}" aria-label="Remove ${esc(w.name)} from wishlist">×</button></span></div></div>`;
}
// Owned cards worth trading or holding, from tournament play rates (see importance.js).
function tcgTradeAdvice(g) {
  const st = gs(g),
    used = new Map(),
    items = new Map();
  for (const d of st.decks) for (const z of Object.values(d.zones || {})) for (const r of z || []) used.set(r.cardId, (used.get(r.cardId) || 0) + r.qty);
  for (const e of st.collection) {
    const x = items.get(e.cardId) || { key: e.cardId, name: e.name, card: cardOf(g, e.cardId), qty: 0, inDecks: used.get(e.cardId) || 0, price: entryPrice(cardOf(g, e.cardId), e) };
    const p=entryPrice(cardOf(g,e.cardId),e);x.value=(x.value||0)+(p??0)*e.qty;x.unpriced=!!x.unpriced||p==null;
    x.qty += e.qty;x.price=x.unpriced?null:x.value/x.qty;
    items.set(e.cardId, x);
  }
  return tradeAdviceHtml(g, tradeAdvice(g, [...items.values()]), (x) => `data-act="tCard" data-id="${esc(x.key)}"`, (p) => usd(p));
}
const setLabel = ({ e, c }) => (c?.game === "ptcg" ? c?.set?.name || "" : (c?.sets?.find((s) => s.code === e.printing)?.name || ""));

/* ---------- decks ---------- */

export function tcgDecks() {
  const g = game(),
    st = gs(g),
    tab = ["ideas", "inspiration"].includes(S.ui.decksTab) ? S.ui.decksTab : "mine";
  return `<div class="page-head"><h1>Decks</h1><div class="row"><button class="btn small" data-act="tImport">↥ Import</button><button class="btn ghost small" data-act="tNewDeck">＋ New</button></div></div>
  <div class="random-tools"><button class="btn ghost small" data-act="learnGame">How to play · keywords</button></div>
  ${segmented("decksTab", tab, [["mine", "My decks"], ["ideas", "Ideas"], ["inspiration", "Meta decks"]])}
  <div class="random-tools"><button class="btn ghost small" data-act="randomDeckOptions">🎲 Random deck</button></div>
  ${tab === "ideas" ? ideasView(g) : tab === "inspiration" ? metaView(g) : st.decks.length ? `<div class="deck-grid">${st.decks.slice().reverse().map((d) => deckTile(g, d)).join("")}</div>` : empty("No decks yet", `Pick a format and start adding cards, build from cards you own in Ideas, or copy a tournament deck from Meta decks.`, `<button class="btn" data-act="decksTab" data-id="ideas">✧ Ideas from my cards</button><button class="btn ghost" data-act="decksTab" data-id="inspiration">🏆 Meta decks</button>`)}`;
}

/* ---------- meta & ideas ---------- */

const isBasicEnergyName = (n) => /^(Basic )?(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal) Energy$/i.test(n);
// How much of a tournament list you already own, and (Yu-Gi-Oh!) what the rest costs.
export function metaOwned(g, d, m = ownedMap(g)) {
  let have = 0,
    total = 0,
    cost = 0,
    unpriced = 0;
  if (g === "ygo") {
    const counts = new Map();
    for (const id of [...d.main, ...d.extra]) counts.set(id, (counts.get(id) || 0) + 1);
    for (const [id, qty] of counts) {
      const own = Math.min(qty, m.get("id:" + id) || 0),
        card = cardOf("ygo", id);
      have += own;
      total += qty;
      if (qty > own) {
        if (price(card) === null) unpriced++;
        else cost += (qty - own) * price(card);
      }
    }
    return { have, total, pct: total ? have / total : 0, cost: unpriced ? null : cost };
  }
  const byName = new Map();
  for (const e of gs(g).collection) byName.set(e.name.toLowerCase(), (byName.get(e.name.toLowerCase()) || 0) + e.qty);
  for (const r of d.list) {
    total += r.qty;
    const name=r.name.toLowerCase().replace(/^basic /, "");
    const owned=isBasicEnergyName(r.name) ? [...byName].filter(([n])=>n.replace(/^basic /, "") === name).reduce((n,[,qty])=>n+qty,0) : byName.get(name) || 0;
    have += Math.min(r.qty,owned);
  }
  return { have, total, pct: total ? have / total : 0, cost: null };
}

const familyOf = (name) =>
  String(name)
    .replace(/^(Mega|Radiant|Shining|Dark|Light|Alolan|Galarian|Hisuian|Paldean)\s+/i, "")
    .replace(/^\S+'s\s+/, "")
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.X|δ|Prime|LEGEND|[XY])$/u, "")
    .trim();
const flatName = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Groups in your collection that could anchor a deck: archetypes (Yu-Gi-Oh!) or Pokémon
// families (Pokémon), strongest first, with how often they show up in current tournament decks.
export function collectionGroups(g) {
  const st = gs(g),
    meta = metaState(g).data,
    groups = new Map();
  for (const e of st.collection) {
    const card = cardOf(g, e.cardId);
    if (!card || card.brief) continue;
    let key = "";
    if (g === "ygo") key = card.archetype;
    else if (card.category === "Pokemon") {
      // Walk back to the Basic you own (Dragapult ex → Drakloak → Dreepy) so a family stays together.
      let root = card,
        hops = 0;
      while (root.evolveFrom && hops++ < 3) {
        const prev = st.collection.map((x) => cardOf(g, x.cardId)).find((x) => x && x.name === root.evolveFrom);
        if (!prev) break;
        root = prev;
      }
      key = familyOf(root.name);
    }
    if (!key) continue;
    const x = groups.get(key) || { key, name: key, ids: [], names: new Set(), copies: 0, value: 0, cover: card, stage: -1 };
    x.names.add(familyOf(card.name));
    // Name the family after its most evolved card you own.
    const stage = { Basic: 0, Stage1: 1, Stage2: 2 }[card.stage] ?? 0;
    if (g === "ptcg" && stage > x.stage) {
      x.stage = stage;
      x.name = familyOf(card.name);
    }
    if (!x.ids.includes(card.id)) x.ids.push(card.id);
    x.copies += e.qty;
    x.value += (price(card) || 0) * e.qty;
    if ((price(card) || 0) > (price(x.cover) || 0)) x.cover = card;
    groups.set(key, x);
  }
  for (const x of groups.values()) {
    if (g === "ygo") {
      const n = (meta?.decks || []).filter((d) => d.name.toLowerCase().includes(x.name.toLowerCase())).length;
      x.metaText = n ? `In ${n} of ${meta.decks.length} recent top decks` : "";
      x.score = x.ids.length + x.copies / 3 + n * 2;
    } else {
      const fam = [...x.names].map(flatName),
        share = (meta?.archetypes || []).filter((a) => a.icons.some((i) => fam.includes(flatName(i.split("-")[0]))) || fam.some((f) => flatName(a.name).includes(f))).reduce((a, b) => a + b.share, 0);
      x.metaText = share ? `${Math.round(share * 1000) / 10}% of players at recent events` : "";
      x.score = x.ids.length * 2 + x.copies / 2 + share * 100;
    }
  }
  return [...groups.values()].filter((x) => x.ids.length >= (g === "ygo" ? 2 : 1)).sort((a, b) => b.score - a.score);
}

const metaStatus = (g, M) =>
  M.busy && !M.data
    ? `<p class="muted small center pad">Loading what’s winning right now…</p>`
    : M.error && !M.data
      ? `<div class="note warn">${esc(M.error)} <button class="link" data-act="tMetaRefresh">Try again</button></div>`
      : "";

function metaDeckRow(g, d, m) {
  const o = metaOwned(g, d, m),
    cover = g === "ygo" ? cardOf("ygo", d.cover) : null;
  return `<button class="meta-row" data-act="tMetaDeck" data-key="${esc(d.key)}">
    <span class="meta-art">${g === "ygo" ? (cover ? imgTag(cover, "mini-art") : `<img class="mini-art" src="${esc(ygoImageDirect(d.cover))}" alt="" loading="lazy" referrerpolicy="no-referrer">`) : d.icons.map((i) => `<img class="pk-icon" src="${esc(ptcgIcon(i))}" alt="" loading="lazy" onerror="this.remove()">`).join("")}</span>
    <span class="meta-main"><b class="ellip">${esc(d.name)}</b><small class="muted ellip">${esc(d.place)} · ${esc(cleanName(d.event))}${d.players ? ` · ${d.players} players` : ""}</small>
      <span class="meta-own">${bar(o.pct)}<small>${Math.round(o.pct * 100)}% owned${o.cost !== null && o.pct < 1 ? ` · ${usd(o.cost, 0)} to finish` : ""}</small></span></span></button>`;
}

function ideasView(g) {
  const st = gs(g),
    M = metaState(g),
    m = ownedMap(g),
    groups = collectionGroups(g),
    closest = (M.data?.decks || [])
      .map((d) => ({ d, o: metaOwned(g, d, m) }))
      .sort((a, b) => b.o.pct - a.o.pct)
      .slice(0, 5);
  if (!st.collection.length)
    return `${empty("Ideas come from your cards", `Add the ${esc(GAMES[g].short)} cards you own and CardStashy finds the ${g === "ygo" ? "archetypes" : "Pokémon"} they support, matches them against today’s tournament decks, and builds lists at every budget.`, `<button class="btn" data-act="tImportColl">↥ Paste a list</button><button class="btn ghost" data-act="go" data-to="#search">Find cards</button><button class="btn ghost" data-act="decksTab" data-id="inspiration">🏆 Meta decks</button>`)}`;
  return `<section class="panel build-own"><h3>Build from my cards</h3><p class="muted small">Start from one card or your whole binder and see a deck at every budget, from cards you own to no limit.</p>
    <div class="actions wrap"><button class="btn" data-act="tBuildAuto">⚒ Use my whole collection</button><button class="btn ghost" data-act="tPickSeeds">☑ Pick cards to build around</button></div></section>
  ${groups.length ? `<div class="section-head"><h2>${g === "ygo" ? "Archetypes you own" : "Pokémon you can build around"}</h2></div><div class="list">${groups
    .slice(0, 12)
    .map((x) => `<div class="lot idea-row"><button class="lot-art" data-act="tCard" data-id="${esc(x.cover.id)}">${imgTag(x.cover)}</button><div class="lot-info"><b class="lot-name">${esc(x.name)}</b><span class="lot-sub">${x.ids.length} card${x.ids.length === 1 ? "" : "s"} · ${x.copies} cop${x.copies === 1 ? "y" : "ies"}${x.metaText ? ` · <span class="ok-text">${esc(x.metaText)}</span>` : ""}</span></div><div class="lot-side"><button class="btn small" data-act="tBuildMulti" data-ids="${esc(x.ids.join(","))}">⚒ Build</button></div></div>`)
    .join("")}</div>` : `<p class="muted small">Loading your cards’ details… If this stays empty, open your Collection once so CardStashy can read them.</p>`}
  <div class="section-head"><h2>Tournament decks you’re closest to</h2><button class="link" data-act="decksTab" data-id="inspiration">All meta decks →</button></div>
  ${metaStatus(g, M)}${closest.length ? `<div class="list">${closest.map(({ d }) => metaDeckRow(g, d, m)).join("")}</div>` : ""}`;
}

function metaView(g) {
  const M = metaState(g),
    m = ownedMap(g),
    data = M.data;
  if (!data) return metaStatus(g, M) || `<p class="muted small center pad">Loading what’s winning right now…</p>`;
  const top = data.top.slice(0, 12);
  return `<p class="muted small">${esc(data.source)} · updated ${esc(new Date(M.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))} <button class="link small" data-act="tMetaRefresh">⟳ Refresh</button></p>
  ${M.error ? `<p class="small warn-text">${esc(M.error)}</p>` : ""}
  <div class="section-head"><h2>Top decks right now</h2></div>
  <div class="arch-grid">${data.archetypes
    .slice(0, 8)
    .map((a) => {
      const best = data.decks.find((d) => d.key === a.best),
        art = g === "ygo" && best?.cover ? `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(best.cover)}.jpg` : "";
      return `<button class="arch ${art ? "has-art" : ""}" data-act="tMetaDeck" data-key="${esc(a.best)}" ${a.best ? "" : "disabled"}>${art ? `<img class="arch-art" src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span class="arch-icons">${g === "ptcg" ? a.icons.map((i) => `<img class="pk-icon" src="${esc(ptcgIcon(i))}" alt="" loading="lazy" onerror="this.remove()">`).join("") : ""}</span><b class="ellip">${esc(a.name)}</b><small>${g === "ptcg" ? `${(a.share * 100).toFixed(1)}% of players · ${a.top8} in Top 8` : `${a.count} top finish${a.count === 1 ? "" : "es"}`}</small>${bar(a.share / (data.archetypes[0]?.share || 1))}</button>`;
    })
    .join("")}</div>
  <div class="section-head"><h2>Most played cards</h2></div>
  <div class="chips wrap">${top.map((t) => `<button class="chip" ${g === "ygo" ? `data-act="tCard" data-id="${esc(t.id)}"` : `data-act="tOtherPrintings" data-name="${esc(t.name)}"`}>${esc(t.name)} <span class="muted">${Math.round(t.pct)}%</span></button>`).join("")}</div>
  <div class="section-head"><h2>Recent top lists</h2></div>
  <div class="list">${data.decks.slice(0, 40).map((d) => metaDeckRow(g, d, m)).join("")}</div>
  <p class="foot">${g === "ygo" ? "Lists from YGOPRODeck’s Tournament Meta Decks (WCQ Regionals, YCS and more)." : "Top 8 lists from the biggest recent Standard events on Limitless."} “Owned” matches your collection${g === "ptcg" ? " by card name; basic Energy counts as owned" : ""}.</p>`;
}

/* ---------- closest proven deck (shared by all three games) ---------- */
// spec: { g, title, sub, evidence, sourceUrl, sourceLabel, attribution, rows, lists, generic(key),
//         load(keys, status) → fills prices/owned, save(rows, label), cardAttrs(row) }
export const proven = { spec: null, mode: "original", budget: 0, busy: false, msg: "" };
const PROVEN_BUDGETS = [25, 50, 100, 200, 400];
export function provenModel(spec) {
  const others = spec.lists || [],
    similar = similarLists(spec.rows, others),
    // The mana base isn't the engine: lands still only give way to cheaper lands (adaptList keepKinds).
    engine = engineOf(spec.rows.filter((r) => r.kind !== "land"), similar, spec.generic || (() => false)),
    pool = swapPool(spec.rows, similar),
    full = costToFinish(spec.rows);
  return { similar, engine, pool, full };
}
export function provenSheetHtml() {
  const base = proven.spec;
  if (!base) return "";
  const spec = { ...base, rows: base.rowsFn ? base.rowsFn() : base.rows, lists: base.listsFn ? base.listsFn() : base.lists };
  proven.current = spec;
  const M = provenModel(spec),
    mode = proven.mode,
    chips = PROVEN_BUDGETS.filter((b) => b < M.full),
    budget = chips.includes(proven.budget) ? proven.budget : chips.filter((b) => b <= M.full / 2).at(-1) ?? chips[0] ?? 0,
    total = spec.rows.reduce((a, r) => a + r.qty, 0),
    have = spec.rows.reduce((a, r) => a + Math.min(r.qty, r.owned || 0), 0),
    unpriced = unpricedCopies(spec.rows),
    thumb = (r) => {
      const u = spec.imageFor?.(r);
      return u ? `<img class="row-thumb" src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'row-thumb img-missing'}))">` : `<span class="row-thumb img-missing" aria-hidden="true"></span>`;
    },
    row = (r, extra = "") =>
      `<button class="mini-row art-row" ${spec.cardAttrs ? spec.cardAttrs(r) : ""}>${thumb(r)}<span class="ellip">${r.qty}× ${esc(r.name)}${r.swappedIn ? ` <span class="tag">swap</span>` : ""}${M.engine.has(r.key) && mode !== "draft" ? ` <span class="tag ok">engine</span>` : ""}${rowEmblem(spec.g, { name: r.name, id: r.key })}</span><span class="small ${r.owned >= r.qty ? "ok-text" : "muted"}">${extra || (r.owned >= r.qty ? "✓ owned" : r.owned ? `${r.owned}/${r.qty} · ${r.price != null ? usd((r.qty - r.owned) * r.price) : "—"}` : r.price != null ? usd(r.qty * r.price) : "—")}</span></button>`;
  let body = "";
  if (mode === "original") {
    body = `<div class="list compact">${spec.rows.map((r) => row(r)).join("")}</div>`;
  } else if (mode === "budget") {
    const a = adaptList({ rows: spec.rows, pool: M.pool, engine: M.engine, budget, similarCount: M.similar.length });
    proven.last = a;
    body = `${chips.length ? `<div class="fmt-chips">${chips.map((b) => `<button class="chip pick ${b === budget ? "on" : ""}" data-act="provenBudget" data-b="${b}">≤ ${usd(b, 0)}</button>`).join("")}</div>` : `<p class="small ok-text">This list already costs little to finish — no adaptation needed.</p>`}
      ${(() => {
        const cards = a.rows.reduce((x, r) => x + r.qty, 0),
          KIND = { land: "Lands", creature: "Creatures", spell: "Other spells", commander: "Commander", Monster: "Monsters", Spell: "Spells", Trap: "Traps", Extra: "Extra Deck", Pokemon: "Pokémon", Trainer: "Trainers", Energy: "Energy", card: "Other" },
          changed = Object.keys({ ...a.kinds.before, ...a.kinds.after }).filter((k) => (a.kinds.before[k] || 0) !== (a.kinds.after[k] || 0)),
          status = a.open ? `Draft — ${a.open} slot${a.open === 1 ? "" : "s"} still required` : a.unpriced ? "Budget adaptation — total not confirmed" : a.fits ? `Budget adaptation — fits ${usd(budget, 0)}` : "Budget adaptation — over budget";
        return `<div class="note ${a.fits ? "" : "warn"}"><b>${status}</b>
          <ul class="facts-list">
            <li>${cards}/${total} cards${a.open ? ` · <b>${a.open} slot${a.open === 1 ? "" : "s"} open</b>` : ""}</li>
            <li>${usd(a.cost, 0)} known subtotal${a.unpriced ? ` · <b>${a.unpriced} cop${a.unpriced === 1 ? "y" : "ies"} unpriced</b> — complete purchase cost unavailable` : ""} <span class="muted">(was ${usd(M.full, 0)})</span></li>
            <li>${changed.length ? changed.map((k) => `${KIND[k] || k} ${a.kinds.before[k] || 0} → ${a.kinds.after[k] || 0}`).join(" · ") : "Same card-type mix as the original"} · lands are never cut</li>
          </ul>
          ${!a.underBudget ? (a.engineCost >= a.cost / 2 ? `<small><b>Can’t reach ${usd(budget, 0)} without breaking the deck:</b> its engine alone costs ${usd(a.engineCost, 0)} to finish${a.engineTop.length ? ` (${a.engineTop.map((r) => `${esc(r.name)} ${usd(Math.max(0, r.qty - (r.owned || 0)) * (r.price ?? 0), 0)}`).join(", ")})` : ""}.</small><br>` : `<small><b>Stopped at ${usd(a.cost, 0)}:</b> the remaining cards are cheap, lands, or have no cheaper card of the same type in similar lists.</small><br>`) : ""}
          <small>An adaptation of a tournament list — not tested in an event. ${M.similar.length ? `Swaps come from ${M.similar.length} similar list${M.similar.length === 1 ? "" : "s"}.` : "No similar lists in the data, so expensive cards are left as open slots."} <b>Not checked:</b> ${spec.g === "mtg" ? "mana colors, " : ""}opening-hand consistency and card roles after the swaps.</small></div>`;
      })()}
      ${a.swaps.length ? `<p class="list-head">Changes</p><ul class="swaps">${a.swaps.map((s) => `<li><span class="bad-text">−${s.qty} ${esc(s.out)}</span> ${s.in ? `→ <span class="ok-text">+${s.qty} ${esc(s.in)}</span>` : "→ <b>open slot</b>"} <small class="muted">saves ${usd(s.saved, 0)} · ${esc(s.why)}</small></li>`).join("")}</ul>` : ""}
      ${M.engine.size ? `<p class="small muted">Kept the engine: ${esc(spec.rows.filter((r) => M.engine.has(r.key)).map((r) => r.name).slice(0, 8).join(", "))}${M.engine.size > 8 ? "…" : ""}</p>` : ""}
      <p class="list-head">Adapted list</p><div class="list compact">${a.rows.map((r) => row(r)).join("")}</div>`;
  } else {
    const d = ownedDraft(spec.rows);
    body = `<div class="note ${d.open ? "warn" : ""}"><b>${d.open ? `Draft — ${d.open} slot${d.open === 1 ? "" : "s"} open` : "Ready — you own every card"}</b>${d.open ? ` · you own ${total - d.open} of ${total}` : ""}</div>
      ${d.rows.length ? `<p class="list-head">Cards you own <span class="muted">${total - d.open}</span></p><div class="list compact">${d.rows.map((r) => row(r, "✓ owned")).join("")}</div>` : `<p class="muted small">You don’t own any cards from this list yet.</p>`}
      ${d.open ? `<p class="list-head">To finish · cheapest first <span class="muted">${usd(d.cost, 0)}${d.unpriced ? ` + ${d.unpriced} unpriced` : ""}</span></p><div class="list compact">${d.missing.map((r) => row({ ...r, owned: 0 })).join("")}</div>` : ""}`;
  }
  // Magic tournament lists keep their sideboard: shown in every mode and saved with every version.
  const side = base.sideRowsFn ? base.sideRowsFn() : [];
  if (side.length) {
    const sn = side.reduce((a, r) => a + r.qty, 0),
      sc = side.reduce((a, r) => a + Math.max(0, r.qty - Math.min(r.qty, r.owned || 0)) * (r.price || 0), 0);
    body += `<details class="group side-group" ${mode === "original" ? "open" : ""}><summary><span>Sideboard <em>${sn}</em></span><span class="muted small">${usd(sc, 0)} to finish</span></summary><p class="small muted">Saved with ${mode === "original" ? "the deck" : "every version"} as the tournament player ran it. Swap these in between games.</p><div class="list compact">${side.map((r) => row(r)).join("")}</div></details>`;
  }
  const hero = spec.heroFor?.(spec.rows);
  return `<div class="sheet-head overlay"><span></span><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="cs-hero compact ${spec.g}">${hero ? `<img class="cs-art" src="${esc(hero)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<div class="cs-shade"></div></div>
  <div class="cs-title"><div><h2>${esc(spec.title)}</h2><p class="type-line">🏆 ${spec.sub}</p></div></div>
  <p class="evidence small">${spec.evidence}</p>
  <div class="proven-sum"><span><b>You own ${have} of ${total}</b> · ${have >= total ? "complete ✓" : `<b>${usd(M.full, 0)}</b> to finish${unpriced ? ` + ${unpriced} unpriced` : ""}`}</span>${have < total && mode !== "budget" ? `<button class="btn small" data-act="provenMode" data-id="budget">Cheapest way in ›</button>` : ""}</div>
  ${bar(total ? have / total : 0)}
  ${segmented("provenMode", mode, [["original", "Original"], ["budget", "Budget adaptation"], ["draft", "My cards draft"]])}
  ${proven.busy ? buildOverlay(proven.msg, { title: "Fitting the tournament deck", note: "Matching the winning list to your cards and budget, card by card. This can take up to a minute." }) : proven.msg ? `<p class="small warn-text" role="status">${esc(proven.msg)}</p>` : ""}
  ${body}
  <div class="actions wrap sheet-actions"><button class="btn" data-act="provenSave">${mode === "original" ? "Save original list" : mode === "budget" ? "Save adaptation" : "Save draft"}</button>${spec.sourceUrl ? `<a class="btn ghost" href="${esc(spec.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(spec.sourceLabel || "Source")} ↗</a>` : ""}${spec.extraActions || ""}</div>
  ${spec.attribution ? `<p class="foot">${spec.attribution}</p>` : ""}`;
}

export function tcgPickSheet() {
  const g = game(),
    st = gs(g),
    seen = new Set(),
    rows = st.collection
      .map((e) => ({ e, c: cardOf(g, e.cardId) }))
      .filter(({ c }) => c && !c.brief && !seen.has(c.id) && seen.add(c.id) && !c.basicEnergy)
      .sort((a, b) => a.c.name.localeCompare(b.c.name));
  return `<div class="sheet-head"><h2>Pick cards to build around</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <p class="muted small">Choose one card or many. ${g === "ygo" ? "Their archetypes (up to 3) form the deck’s core." : "Each Pokémon brings its evolution line (up to 3 lines); Trainers you pick are included."}</p>
  <input type="search" class="block" placeholder="Filter your cards" data-input="tSeedQ" aria-label="Filter your cards" autocomplete="off">
  <div class="list compact seed-list">${rows.map(({ c, e }) => `<label class="seed-row mini-row" data-name="${esc(c.name.toLowerCase())}"><span class="row"><input type="checkbox" value="${esc(c.id)}" data-change="tSeedToggle">${imgTag(c, "seed-thumb")}<span class="ellip">${esc(c.name)}</span></span><small class="muted">×${e.qty}</small></label>`).join("") || `<p class="muted small">Your cards are still loading — open your Collection once, then try again.</p>`}</div>
  <div class="sheet-foot"><button class="btn block" id="seedGo" data-act="tSeedGo" data-ids="" disabled>Pick cards to build around</button></div>`;
}

export function tcgDeck(id) {
  const g = game(),
    d = gs(g).decks.find((x) => x.id === id);
  if (!d) return empty("Deck not found", "It may have been deleted, or it belongs to another game.", `<button class="btn" data-act="go" data-to="#decks">Back to decks</button>`);
  const f = formatOf(g, d.format),
    s = deckStats(g, d),
    issues = SOURCES[g].validate(d, (x) => cardOf(g, x), f),
    A = ui(g).deckAdd,
    zones = g === "ygo" ? [["main", "Main Deck", `${f.main[0]}–${f.main[1]}`], ["extra", "Extra Deck", `0–${f.extra}`], ["side", "Side Deck", `0–${f.side}`]] : [["main", "Deck", "60"]],
    zoneCount = (z) => (d.zones[z] || []).reduce((a, r) => a + r.qty, 0),
    cover = cardOf(g, (d.zones.main || [])[0]?.cardId);
  const tab = S.ui.tdeckTab?.[d.id] || "cards";
  return `<section class="deck-hero">${g === "ptcg" && cover ? pokemonArtCrop(cover, "hero-art") : imgTag(cover, "hero-art", true)}<div class="hero-shade"></div><div class="hero-body">
    <div class="row between"><button class="icon light" data-act="go" data-to="#decks" aria-label="Back">←</button><button class="icon light" data-act="tDeckMenu" data-id="${esc(d.id)}" aria-label="Deck options">⋯</button></div>
    <h1>${esc(d.name)}</h1><p><button class="chip dark fmt-chip" data-act="tDeckMenu" data-id="${esc(d.id)}">${esc(GAMES[g].short)} · ${esc(f.name)}</button></p>
    <button class="review-badge ${issues.length ? "bad" : "ok"}" data-act="tIssues" data-deck="${esc(d.id)}">${issues.length ? `● ${issues.length} to fix` : s.total ? "✓ Legal in " + esc(f.name) : "Add cards to check legality"}</button>
    <div class="hero-stats"><span><b>${zoneCount("main")}</b>${g === "ygo" ? "main" : "/60 cards"}</span><span><b>${s.total ? Math.round((s.owned / s.total) * 100) : 0}%</b>owned</span><span><b>${usd(s.buy, 0)}${s.unknown ? "+" : ""}</b>to finish${s.unknown ? " · some unpriced" : ""}</span>${s.total ? `<button data-act="tDeckTab" data-deck="${esc(d.id)}" data-id="insights"><b>${shownPower(tcgPower(g, d, f, (x) => cardOf(g, x)))}</b>power</button>` : ""}</div>
  </div></section>
  <nav class="tabs" role="tablist">${[["cards", "Cards"], ["insights", "Power"], ["matchups", "Matchups"], ["upgrade", "Upgrade lab"], ["playtest", "Playtest"], ["versions", "Versions"]].map(([id, l]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? "on" : ""}" data-act="tDeckTab" data-deck="${esc(d.id)}" data-id="${id}">${l}</button>`).join("")}</nav>
  <div class="deck-body">${tab === "insights" ? deckInsights(g, d, f, s) : tab === "matchups" ? deckMatchupsT(g, d, f) : tab === "upgrade" ? deckUpgradeTab(g, d, f, s) : tab === "playtest" ? deckPlaytest(g, d, f) : tab === "versions" ? deckVersions(g, d) : deckCardsTab(g, d, f, s, issues)}</div>`;
}

// Meta / staple tally for the deck, and owned staples that could replace no-emblem cards.
// Pokémon swaps stay among Trainers (Pokémon lines and Energy are the deck's core); Yu-Gi-Oh!
// never cuts archetype cards or the Extra Deck.
function tcgDeckEmblems(g, d) {
  const rows = [],
    inDeck = new Set();
  for (const z of ["main", "extra"])
    for (const r of d.zones[z] || []) {
      inDeck.add(r.cardId);
      rows.push({ key: r.cardId, name: cardOf(g, r.cardId)?.name || r.name || "", card: cardOf(g, r.cardId), qty: r.qty, zone: z });
    }
  const spares = new Map();
  for (const e of gs(g).collection) if (!inDeck.has(e.cardId)) {
    const x = spares.get(e.cardId) || { key: e.cardId, name: e.name, card: cardOf(g, e.cardId), spare: 0 };
    x.spare += e.qty;
    spares.set(e.cardId, x);
  }
  const res = deckEmblems(g, rows, [...spares.values()], {
    fits: (c) => (g === "ygo" ? !c.extra : true),
    sameSlot: (a, b) => (g === "ptcg" ? a.category === "Trainer" && b.category === "Trainer" : a.category === b.category),
    protect: (r) => r.zone !== "main" || (g === "ygo" && !!r.card?.archetype) || (g === "ptcg" && r.card?.category !== "Trainer"),
  });
  return deckEmblemHtml(g, res, {
    cardAttrs: (x) => `data-act="tCard" data-id="${esc(x.key)}"`,
    swapAttrs: (s) => `data-act="tDeckEmbSwap" data-deck="${esc(d.id)}" data-out="${esc(s.out.key)}" data-in="${esc(s.in.key)}"`,
  });
}
function deckCardsTab(g, d, f, s, issues) {
  const A = ui(g).deckAdd,
    zones = g === "ygo" ? [["main", "Main Deck", `${f.main[0]}–${f.main[1]}`], ["extra", "Extra Deck", `0–${f.extra}`], ["side", "Side Deck", `0–${f.side}`]] : [["main", "Deck", "60"]],
    zoneCount = (z) => (d.zones[z] || []).reduce((a, r) => a + r.qty, 0);
  return `${viewControl(g,"deck")}<div class="searchbar deck-add"><input type="search" value="${esc(A.q)}" placeholder="Add a card by name" data-input="tDeckQ" data-enter="tDeckFind" aria-label="Add a card" autocomplete="off"><button class="btn" data-act="tDeckFind" ${A.busy ? "disabled" : ""}>${A.busy ? "…" : "Find"}</button></div>
  ${A.results.length ? `<div class="add-results">${A.results.map((c) => `<div class="mini-row">${imgTag(c, "mini-art")}<span class="ellip">${esc(c.name)}<small class="muted"> ${esc(c.set?.name || c.typeLine || "")}</small></span><button class="btn small" data-act="tDeckAdd" data-id="${esc(c.id)}" data-deck="${esc(d.id)}">＋</button></div>`).join("")}<button class="link small" data-act="tDeckAddClose">Close results</button></div>` : ""}
  ${f.note ? `<p class="small muted">${esc(f.note)}</p>` : ""}
  ${tcgDeckEmblems(g, d)}
  <div id="tIssuesPanel">${issues.length ? `<details class="panel issues-panel"><summary>Rules review · ${issues.length} to fix</summary><ul class="issues">${issues.map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul></details>` : ""}</div>
  ${zones
    .map(([z, label, rule]) => {
      const rows = s.rows.filter((x) => x.zone === z);
      return `<div class="section-head"><h2>${label} <span class="muted small">${zoneCount(z)} · ${rule}</span></h2></div>${
        rows.length
          ? `<div class="list display-list">${rows
              .sort((a, b) => (a.c?.category || "").localeCompare(b.c?.category || "") || a.r.name.localeCompare(b.r.name))
              .map(({ r, c, need }) => {
                const lim = c ? SOURCES[g].limit(c, f) : 3;
                const t = tcgTier(c);
                return `<div class="lot deck-row ${need ? "short" : ""}" data-tier="${t.key}" style="${tierStyle(t)}"><button class="lot-art" data-act="tCard" data-id="${esc(r.cardId)}" data-deck="${esc(d.id)}" aria-label="Open ${esc(r.name)}">${imgTag(c)}${tileBadges(c)}<span class="art-price">${usd(price(c))}</span></button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(r.cardId)}" data-deck="${esc(d.id)}">${esc(r.name)}</button><span class="lot-sub">${rowBadges(c)}${lim === 0 ? ' <span class="tag bad">Forbidden</span>' : lim === 1 && g === "ygo" ? ' <span class="tag warn">Limited</span>' : lim === 2 ? ' <span class="tag warn">Semi-Limited</span>' : ""}${c && SOURCES[g].legality(c, f) === "not_legal" ? ' <span class="tag bad">Not legal</span>' : ""}</span><span class="own ${need ? "no" : "yes"}">${need ? "Need " + need : "Owned"}</span></div><div class="lot-side"><span class="stepper"><button data-act="tDeckQty" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}" data-delta="-1" aria-label="One fewer">−</button><b>${r.qty}</b><button data-act="tDeckQty" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}" data-delta="1" aria-label="One more">＋</button></span>${g === "ygo" ? `<button class="link small" data-act="tDeckMove" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}">${z === "side" ? "→ deck" : "→ side"}</button>` : ""}</div></div>`;
              })
              .join("")}</div>`
          : `<p class="muted small">Empty.</p>`
      }`;
    })
    .join("")}
  <section class="panel">${s.total ? `<div class="row between"><span>${s.total - s.owned} cards to get</span><b>${usd(s.buy)}${s.unknown ? ` + ${s.unknown} unpriced` : ""}</b></div>` : ""}
  <div class="actions wrap">${g === "ptcg" && s.total > s.owned ? `<button class="btn small" data-act="tDeckCheapest" data-id="${esc(d.id)}" title="Same cards, cheapest legal printings">Cheapest printings</button>` : ""}${s.total > s.owned ? `<button class="btn ghost small" data-act="tDeckCopyMissing" data-id="${esc(d.id)}">${actionIcon("bag")}<span>Buy on TCGplayer</span></button>` : ""}<button class="btn ghost small" data-act="tDeckExport" data-id="${esc(d.id)}">↓ Export ${SOURCES[g].exportExt === "ydk" ? ".ydk" : "list"}</button><button class="btn ghost small" data-act="tDeckRefresh" data-id="${esc(d.id)}">⟳ Refresh prices</button></div>
  <p class="foot">Owned counts every copy in your ${esc(GAMES[g].short)} collection${g === "ptcg" ? " (Pokémon by exact card; Trainers and Energy by name)" : ""}. Prices are daily market estimates.</p></section>`;
}

/* ----- deck insights: composition and real probability math ----- */

// Chance of drawing at least one of `k` copies in `n` cards from a deck of `N`.
export const atLeastOne = (N, k, n) => {
  if (k <= 0 || N <= 0) return 0;
  let none = 1;
  for (let i = 0; i < n; i++) none *= Math.max(0, N - k - i) / (N - i);
  return 1 - none;
};
const pctTxt = (x) => Math.round(x * 100) + "%";

// Matchups: this deck against the decks winning now, with each game's own rules.
const META_FORMAT = { ygo: "tcg", ptcg: "standard" };
export const tcgFieldKey = (g) => g + ":" + META_FORMAT[g] + "|" + (metaState(g)?.at || 0);
const muStateT = (g, d) => ((S.ui.mu ||= {})[g + ":" + d.id] ||= { first: true });
const tRows = (g, zone) => (zone || []).map((r) => ({ qty: r.qty, c: cardOf(g, r.cardId), name: r.name })).filter((r) => r.c);
const tPower = (g, f, main, extra = []) => (g === "ygo" ? ygoPower([...main.map((r) => ({ ...r, zone: "main" })), ...extra.map((r) => ({ ...r, zone: "extra" }))], f) : ptcgPower(main, f));
// The calibration of the field archetype this deck copies (see calibrateField), else 0.
const myBiasFor = (p, field) => { const m = p?.match; if (!canBorrowResults(p)) return 0; const f = (field || []).find((x) => String(x.name).toLowerCase() === String(m.archetype).toLowerCase()); return f?.bias || 0; };
function deckMatchupsT(g, d, f) {
  const st = muStateT(g, d),
    base = { prefix: "tMu", gameName: g === "ygo" ? "Yu-Gi-Oh!" : "Pokémon", game: g, state: st, runKey: g + ":" + d.id,
      modelNote: g === "ygo" ? "going first opens a combo against the other side's hand traps; going second breaks boards" : "a Prize race: first attack, attacks per Knock Out against their HP and Weakness, Prize values and disruption",
      // Pokémon odds come from real results, validated against 8,469 Limitless matches.
      footNote: g === "ygo" ? "Yu-Gi-Oh! has no public round-by-round results to test these odds against. Tests on real Pokémon and Magic matches showed simulated odds are overconfident, so only part of the simulated lean is shown here. Your own logged games count for more as you add them." : g === "ptcg" ? "Odds come from real online results (Limitless, the biggest events of the last 3 weeks): the two archetypes' head-to-head record, pulled toward each deck's overall results when there are few games, then nudged by a Prize-race simulation. Tested on 8,469 real matches, this predicted better than the simulation alone, which was badly overconfident. Your own logged games count for more as you add them." : "" };
  if ((d.format || META_FORMAT[g]) !== META_FORMAT[g]) return matchupsTab({ ...base, unsupported: `Tournament results cover ${g === "ygo" ? "TCG Advanced" : "Standard"} only. Switch this deck's format to compare it with the field.` });
  const main = tRows(g, d.zones?.main), need = g === "ygo" ? 40 : 60, have = main.reduce((a, r) => a + r.qty, 0);
  if (have < need) return matchupsTab({ ...base, unsupported: `Finish the deck first: matchups compare complete lists (this one has ${have} of ${need}).` });
  const key = tcgFieldKey(g);
  if (!st.field || st.fieldKey !== key) { const cached = metaState(g)?.data ? fieldStore.get(key) : null; if (cached) { st.field = cached; st.fieldKey = key; } }
  if (!st.field?.length || st.fieldKey !== key) return matchupsTab({ ...base, field: [], fieldLabel: g === "ygo" ? "in TCG Advanced" : "in Standard" });
  const extra = tRows(g, d.zones?.extra), side = tRows(g, d.zones?.side),
    assessment = tcgPower(g, d, f, (x) => cardOf(g, x)),
    blocked = matchupBlock(assessment),
    me = profileOf(g, assessment, main, extra);
  if (blocked) return matchupsTab({ ...base, unsupported: blocked });
  if (!me) return matchupsTab({ ...base, unsupported: "This deck's cards are still loading. Open the Power tab once, then come back." });
  const lead = Object.entries(main.reduce((a, r) => (r.c.archetype ? ((a[r.c.archetype] = (a[r.c.archetype] || 0) + r.qty), a) : a), {})).sort((a, b) => b[1] - a[1])[0]?.[0],
    protect = (r) => !!lead && r.c.archetype === lead,
    reprofile = (rs) => profileOf(g, tPower(g, f, rs, extra), rs, extra),
    sims = computeMatchups(key + "|" + d.id + "|" + JSON.stringify(d.zones), st.field, me, (op, win) => gamePlan(g, me, op, { main, side, protect, reprofile, sim: win }), (a, b) => simulateMatchup(g, a, b), myBiasFor(tcgPower(g, d, f, (x) => cardOf(g, x)), st.field)),
    results = d.results || [],
    sig = listSig(d.zones),
    { current, earlier } = forList(results, sig),
    field = (g === "ptcg" ? realResults(sims, tcgPower(g, d, f, (x) => cardOf(g, x))) : sims.map((m) => ({ ...m, sim: trustedSim(g, m.sim) }))).map((m) => { const rec = recordOf(current, m.name); return { ...m, rec, shown: blend(m.sim.win, rec), open: st.openName === m.name }; }),
    tot = field.reduce((a, m) => a + (m.share || 0), 0) || 1;
  return matchupsTab({ ...base, field, sig, earlier: earlier.length, fieldWin: field.reduce((a, m) => a + m.shown * (m.share || 0), 0) / tot, record: recordOf(current), history: [...results].sort((a, b) => String(b.at).localeCompare(String(a.at))) });
}

// Pokémon: the number comes from real results (realMatchup in matchup.js, validated on 8,469
// Limitless matches); the simulation only nudges it and explains the matchup.
function realResults(sims, p) {
  const R = metaState("ptcg")?.data?.results, mine = canBorrowResults(p) ? p.match.archetype : null;
  return sims.map((m) => {
    const real = realMatchup(R, mine, m.name, m.sim.win), shift = real.win - m.sim.win, c = (x) => Math.max(0.03, Math.min(0.97, x + shift));
    const line = !R ? `Recent online results aren't loaded, so this is the simulation pulled most of the way to even: on its own it was overconfident when tested against real matches.`
      : mine && mine.toLowerCase() === String(m.name).toLowerCase() ? `Mirror match: even by definition, so the deck that plays better and draws better wins.`
      : real.n ? `Real results: ${mine} went ${real.w}–${real.n - real.w} against ${m.name} in ${real.n} online matches (Limitless, last 3 weeks).`
      : mine ? `No recorded games between these decks yet, so this rests on each deck's overall results.`
      : `This exact list cannot safely borrow an archetype's record. This is a conservative baseline using ${m.name}'s overall results, not a validated forecast for your deck.`;
    return { ...m, sim: { ...m.sim, model: m.sim.win, win: real.win, onPlay: c(m.sim.onPlay), onDraw: c(m.sim.onDraw), real, reasons: [line, `The game simulation leans ${Math.round(m.sim.win * 100)}%; it only nudges this number, because real results predict matches better.`, ...m.sim.reasons] } };
  });
}

// AI coach hooks: owned cards that could join this deck, and the app's own re-score of a swap.
export function tcgCoachHooks(g, d, f, pw) {
  return {
    candidates: () => {
      const rows = Object.values(d.zones || {}).flat(), inDeck = new Set(rows.map((r) => cardOf(g, r.cardId)?.name || r.name));
      const seen = new Set(), owned = [];
      for (const e of gs(g).collection) { const c = cardOf(g, e.cardId); if (c && !inDeck.has(c.name) && !seen.has(c.name) && !c.basicEnergy) { seen.add(c.name); owned.push(c); } }
      const top = [...(d.zones.main || [])].sort((a, b) => b.qty - a.qty).map((r) => cardOf(g, r.cardId)).find((c) => c && (g === "ygo" ? !/Spell|Trap/.test(c.typeLine || c.type || "") : c.category === "Pokemon"));
      const ranked = top ? rankPairs(g, top, owned.map((card) => ({ card, owned: true })), { max: 40 }).map((x) => x.card) : [];
      // Only cards the deck can legally play in its format: the same deck check Power uses.
      const had = new Set(powerReadiness(g, d, f, (x) => cardOf(g, x)).issues), legal = (c) => !powerReadiness(g, { ...d, zones: { ...d.zones, main: [...(d.zones.main || []), { cardId: c.id, name: c.name, qty: 1 }] } }, f, (x) => cardOf(g, x)).issues.some((i) => !had.has(i) && i.includes(c.name));
      return [...ranked, ...owned.filter((c) => !ranked.includes(c))].filter(legal).slice(0, 60);
    },
    probe: (card) => tcgPower(g, { ...d, id: d.id + "~probe", zones: { ...d.zones, main: [...(d.zones.main || []), { cardId: card.id, name: card.name, qty: 1 }] } }, f, (x) => cardOf(g, x)).parts,
    // The decks this list would face: the top archetypes in the app's tournament data, each with
    // its most-played cards across that archetype's placing lists.
    field: () => {
      const data = metaState(g).data, byName = g === "ptcg" ? new Map(Object.values(cache.ptcg).map((c) => [c.name, c])) : null;
      return (data?.archetypes || []).filter((a) => a.share > 0).slice(0, 8).map((a) => {
        const id = a.id || a.name, lists = (data.decks || []).filter((x) => (g === "ptcg" ? x.archetype === id : x.name === a.name)), by = new Map();
        for (const l of lists) for (const r of g === "ygo" ? (l.main || []).map((cid) => ({ key: String(cid), qty: 1 })) : (l.list || []).filter((x) => !/^(?:basic )?\w+ energy$/i.test(x.name)).map((x) => ({ key: x.name, qty: x.qty }))) by.set(r.key, (by.get(r.key) || 0) + r.qty);
        return { name: a.name || id, share: a.share, lists: lists.length, rows: [...by].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, n]) => { const c = g === "ygo" ? cardOf(g, k) : byName.get(k); return { name: c?.name || k, qty: Math.max(1, Math.round(n / Math.max(1, lists.length))), c }; }) };
      }).filter((f) => f.rows.length).slice(0, 5);
    },
    rescore: (out, add) => {
      if (out.zone === "side") throw Error("main deck only");
      const p2 = tcgPower(g, { ...swappedZones(d, out.zone, out.row.cardId, add), id: d.id + "~coach" }, f, (x) => cardOf(g, x));
      return { before: shownPower(pw), after: shownPower(p2), beforeIssues: pw.readiness?.issues, issues: p2.readiness?.issues, beforeParts: pw.parts, afterParts: p2.parts };
    },
  };
}

function deckInsights(g, d, f, s) {
  const main = (d.zones.main || []).map((r) => ({ r, c: cardOf(g, r.cardId) })),
    N = main.reduce((a, x) => a + x.r.qty, 0),
    top = [...s.rows].filter((x) => x.c && price(x.c)).sort((a, b) => price(b.c) - price(a.c)).slice(0, 5);
  if (!N) return `<p class="muted pad">Add cards to see composition and odds.</p>`;
  const pw = tcgPower(g, d, f, (x) => cardOf(g, x)),
    powerHtml = aiReviewPanel(g, d, x => cardOf(g, x), pw, tcgCoachHooks(g, d, f, pw)) + powerPanel(pw, { loadAct: `data-act="tMetaRefresh"`, cardAct: (x) => (x.id || g === "ygo" ? `data-act="tCard" data-id="${esc(x.id || x.key)}"` : `data-act="tDeckFindName" data-name="${esc(x.name)}"`) });
  const bars = (items) => `<div class="comp">${items.map(([label, n, total, note]) => `<div class="meter"><span>${esc(label)}</span>${bar(total ? n / total : 0)}<b>${n}</b></div>${note ? `<p class="foot">${note}</p>` : ""}`).join("")}</div>`;
  // Each card's role comes from the Deck Power engine, so the table shows why a card matters.
  const roleChips = (id) => (pw.roles?.get(String(id)) || []).map((r) => `<span class="role-chip">${esc(r)}</span>`).join(""),
    oddsRow = (x, hands) => `<tr><td><button class="link odds-name" data-act="tCard" data-id="${esc(x.r.cardId)}">${esc(x.r.name)}</button><span class="role-chips">${roleChips(x.r.cardId)}</span></td><td class="num">${x.r.qty}</td>${hands.map((n) => `<td class="num">${pctTxt(atLeastOne(N, x.r.qty, n))}</td>`).join("")}</tr>`;
  const valuePanel = `<section class="panel"><h3>Most valuable cards</h3><div class="list compact">${top.map((x) => `<button class="mini-row" data-act="tCard" data-id="${esc(x.r.cardId)}"><span class="ellip">${x.r.qty}× ${esc(x.r.name)}</span><span class="small">${usd(price(x.c) * x.r.qty)}</span></button>`).join("") || '<p class="muted small">No prices yet.</p>'}</div><p class="foot">Deck value ${usd(s.value)} · ${usd(s.buy)} still to buy.</p></section>`;
  if (g === "ygo") {
    const kind = (c) => c?.category || "Monster",
      count = (k) => main.filter((x) => kind(x.c) === k).reduce((a, x) => a + x.r.qty, 0),
      levels = Array(12).fill(0);
    for (const x of main) if (x.c?.category === "Monster" && x.c.level) levels[Math.min(12, x.c.level) - 1] += x.r.qty;
    const extraKinds = {};
    for (const r of d.zones.extra || []) {
      const fr = (cardOf(g, r.cardId)?.frame || "other").replace("_pendulum", "");
      extraKinds[fr] = (extraKinds[fr] || 0) + r.qty;
    }
    return `${powerHtml}<section class="panel"><h3>Main Deck · ${N} cards</h3>${bars([["Monsters", count("Monster"), N], ["Spells", count("Spell"), N], ["Traps", count("Trap"), N]])}
      ${Object.keys(extraKinds).length ? `<p class="small">Extra Deck: ${Object.entries(extraKinds).map(([k, n]) => `${n} ${esc(k[0].toUpperCase() + k.slice(1))}`).join(" · ")}</p>` : ""}</section>
    <section class="panel"><h3>Monster levels</h3>${levelChart(levels)}<p class="foot">Level 5–6 monsters need 1 Tribute, 7+ need 2, unless their text says otherwise.</p></section>
    <section class="panel"><h3>Card by card</h3>
      <p class="muted small">Chance to draw at least one copy (exact odds). Going first you draw 5; going second, 6. Labels show each card's job in the deck; the hand simulation above combines them.</p>
      <table class="metrics"><thead><tr><th>Card</th><th class="num">Qty</th><th class="num" title="Going first: 5 cards">1st (5)</th><th class="num" title="Going second: 6 cards">2nd (6)</th></tr></thead><tbody>${main.sort((a, b) => b.r.qty - a.r.qty || a.r.name.localeCompare(b.r.name)).map((x) => oddsRow(x, [5, 6])).join("")}</tbody></table>
    </section>${valuePanel}`;
  }
  // Pokémon
  const cat = (k) => main.filter((x) => (x.c?.category || "Pokemon") === k).reduce((a, x) => a + x.r.qty, 0),
    basics = main.filter((x) => x.c?.basicPokemon).reduce((a, x) => a + x.r.qty, 0),
    names = new Set(main.map((x) => x.r.name)),
    hasCandy = main.some((x) => /^Rare Candy$/i.test(x.r.name)),
    broken = main.filter((x) => x.c?.evolveFrom && !names.has(x.c.evolveFrom)),
    energyTypes = new Set(main.filter((x) => x.c?.category === "Energy").flatMap((x) => (x.c.basicEnergy ? [x.r.name.replace(/^Basic | Energy$/g, "")] : ["Special"]))),
    needTypes = [...new Set(main.flatMap((x) => x.c?.attackCosts || []))].filter((t) => !energyTypes.has(t)),
    mull = 1 - atLeastOne(N, basics, 7);
  return `${powerHtml}<section class="panel"><h3>${N} cards</h3>${bars([["Pokémon", cat("Pokemon"), N], ["Trainers", cat("Trainer"), N], ["Energy", cat("Energy"), N]])}<p class="foot">Many competitive decks run roughly 12–20 Pokémon, 30–40 Trainers and 8–14 Energy — a guideline, not a rule.</p></section>
  <section class="panel"><h3>Opening hand</h3>
    <p><b>${basics}</b> Basic Pokémon → <b class="${mull > 0.2 ? "warn-text" : "ok-text"}">${pctTxt(mull)}</b> chance an opening 7 has none (a mulligan; your opponent may draw a card).</p>
    ${broken.length ? `<div class="note warn">${broken.map((x) => `${esc(x.r.name)} evolves from <b>${esc(x.c.evolveFrom)}</b>, which isn’t in the deck${x.c.stage === "Stage2" && hasCandy ? " (Rare Candy can skip it, but you still need the Basic)" : ""}.`).join("<br>")}</div>` : `<p class="small ok-text">✓ Every evolution has the card it evolves from.</p>`}
    ${needTypes.length ? `<div class="note warn">Attacks need ${needTypes.map(esc).join(", ")} Energy, but the deck has no basic ${needTypes.map(esc).join("/")} Energy.</div>` : ""}
  </section>
  <section class="panel"><h3>Card by card</h3><p class="muted small">Chance to have at least one copy (exact odds). Six cards go to your Prizes, so a single copy is prized about ${pctTxt(6 / Math.max(N, 1))} of games. Labels show each card's job in the deck.</p>
    <table class="metrics"><thead><tr><th>Card</th><th class="num">Qty</th><th class="num" title="Opening hand of 7">In 7</th><th class="num" title="By turn 2: 9 cards">By T2</th></tr></thead><tbody>${main.sort((a, b) => b.r.qty - a.r.qty || a.r.name.localeCompare(b.r.name)).filter((x) => !x.c?.basicEnergy).map((x) => oddsRow(x, [7, 9])).join("")}</tbody></table></section>${valuePanel}`;
}
function levelChart(levels) {
  const max = Math.max(1, ...levels);
  return `<div class="curve">${levels.map((n, i) => `<div class="curve-col"><div class="curve-bars"><span class="cb" style="height:${(n / max) * 100}%"><em>${n || ""}</em></span></div><small>${i + 1}</small></div>`).join("")}</div>`;
}

/* ----- playtest: sample hands with each game's opening rules ----- */

function deckPlaytest(g, d, f) {
  const h = S.ui.thand?.deckId === d.id ? S.ui.thand : null,
    N = (d.zones.main || []).reduce((a, r) => a + r.qty, 0);
  const hand = h ? `<div class="hand">${h.hand.map((id) => `<button class="hand-card" data-act="tCard" data-id="${esc(id)}">${imgTag(cardOf(g, id))}</button>`).join("")}</div>` : "";
  return `<section class="panel"><div class="row between"><h3>Sample hand</h3><span class="muted small">${N} cards</span></div>
    <div class="actions wrap">${g === "ygo" ? `<button class="btn" data-act="tDraw" data-deck="${esc(d.id)}" data-n="5">Going first (5)</button><button class="btn ghost" data-act="tDraw" data-deck="${esc(d.id)}" data-n="6">Going second (6)</button>` : `<button class="btn" data-act="tDraw" data-deck="${esc(d.id)}" data-n="7">Draw opening 7</button>`}<button class="btn ghost" data-act="tDrawOne" ${h?.library.length ? "" : "disabled"}>Draw a card</button></div>
    ${h ? `<p class="small">${h.hand.length} in hand${h.mulls ? ` · ${h.mulls} mulligan${h.mulls > 1 ? "s" : ""} (no Basic Pokémon) — your opponent may draw ${h.mulls}` : ""}${h.prizes ? ` · ${h.prizes.length} Prize cards set aside` : ""} · ${h.library.length} left in deck</p>${hand}${h.prizes ? `<details class="small"><summary>Peek at Prizes</summary><div class="hand">${h.prizes.map((id) => `<button class="hand-card" data-act="tCard" data-id="${esc(id)}">${imgTag(cardOf(g, id))}</button>`).join("")}</div></details>` : ""}` : `<p class="muted small">${g === "ygo" ? "Shuffles the Main Deck and draws your opening hand." : "Shuffles, draws 7, mulligans automatically if there’s no Basic Pokémon, then sets aside 6 Prize cards."}</p>`}
  </section>`;
}

/* ----- versions: snapshots of the list ----- */

const flat = (zones) => {
  const m = new Map();
  for (const z of ["main", "extra", "side"]) for (const r of zones?.[z] || []) m.set(z + ":" + r.cardId, { ...r, z });
  return m;
};
export function diffZones(a, b) {
  const A = flat(a),
    B = flat(b),
    added = [],
    removed = [];
  for (const [k, r] of B) {
    const before = A.get(k)?.qty || 0;
    if (r.qty > before) added.push({ ...r, qty: r.qty - before });
  }
  for (const [k, r] of A) {
    const after = B.get(k)?.qty || 0;
    if (r.qty > after) removed.push({ ...r, qty: r.qty - after });
  }
  return { added, removed };
}
/* ----- Upgrade lab (Pokémon / Yu-Gi-Oh!): what placing lists of the same archetype play ----- */
const upgradeLoads = new Set();
function deckUpgradeTab(g, d, f, s) {
  if (!s.total) return `<p class="muted pad">Add cards first; the Upgrade lab compares your list with tournament decks.</p>`;
  const pw = tcgPower(g, d, f, (x) => cardOf(g, x)),
    m = ownedMap(g),
    U = pw.upgrades,
    meta = metaState(g).data,
    cardFor = (x) => (g === "ygo" ? cardOf(g, x.key) : Object.values(cache.ptcg).find(c=>c.name.toLowerCase()===x.name.toLowerCase() && SOURCES.ptcg.legality(c,f)==="legal")),
    addBtn = (x) => (g === "ygo" ? `data-act="tDeckAdd" data-id="${esc(x.key)}" data-deck="${esc(d.id)}" data-upgrade="1"` : `data-act="tDeckAddName" data-name="${esc(x.name)}" data-deck="${esc(d.id)}" data-upgrade="1"`),
    row = (x, extra) => {
      const c = cardFor(x), p = c ? price(c) : null, own = c ? ownedOf(g, c, m) : 0;
      return `<div class="mini-row upgrade-row">${c ? imgTag(c, "mini-art") : `<span class="mini-art img-missing">◇</span>`}<span class="ellip"><b>${esc(x.name)}</b><small class="muted">${extra}</small></span><span class="upgrade-side">${p != null ? `<small>${usd(p)}</small>` : ""}${own ? `<small class="ok-text">own ${own}</small>` : ""}<button class="btn small" ${addBtn(x)}>Review swap</button></span></div>`;
    };
  // Yu-Gi-Oh! suggestions arrive as card ids: load their pictures and prices once.
  if (g === "ygo") {
    const want = [...(U?.adds || []).map((x) => x.key), ...((meta?.top || []).slice(0, 30).map((x) => String(x.id)))].filter((id) => id && !cardOf(g, id) && !upgradeLoads.has(id));
    if (want.length) { want.forEach((id) => upgradeLoads.add(id)); ensureMany(g, want).then(() => globalThis.dispatchEvent?.(new Event("cardstashy-rerender"))); }
  }
  if (!pw.metaLoaded) return `<section class="panel"><h3>Upgrade lab</h3><button class="btn" data-act="tOptimizeDeck" data-deck="${esc(d.id)}">Compare budget builds</button><p class="muted small">Load recent tournament decks to see what lists like yours play.</p><button class="btn" data-act="tMetaRefresh">Load tournament decks</button></section>`;
  const staples = g === "ygo" ? (meta?.top || []).filter((x) => x.pct >= 20) : (meta?.top || []).filter((x) => x.kind === "Trainer" && x.pct >= 30);
  const inDeck = new Set([...(d.zones.main || []), ...(d.zones.extra || [])].flatMap((r) => [String(r.cardId), (cardOf(g, r.cardId)?.name || r.name || "").toLowerCase()]));
  const stapleRows = staples.filter((x) => !(U?.adds || []).some(a=>a.key===String(x.id || x.name)||a.name.toLowerCase()===String(x.name).toLowerCase())).filter((x) => !inDeck.has(String(x.id || "")) && !inDeck.has(String(x.name).toLowerCase())).slice(0, 12)
    .map((x) => row({ key: String(x.id || x.name), name: x.name }, `${Math.round(x.pct)}% of tournament decks · usually ${Math.max(1, Math.round(x.avg || 1))}`)).join("");
  const addCost = U ? U.adds.reduce((a, x) => { const c = cardFor(x), p = c ? price(c) : null, own = c ? ownedOf(g, c, m) : 0; return a + (p != null ? p * Math.max(0, x.need - own) : 0); }, 0) : 0;
  return `<section class="panel"><p class="eyebrow">Upgrade lab</p><button class="btn" data-act="tOptimizeDeck" data-deck="${esc(d.id)}">Compare budget builds</button><p class="foot">Your current list and complete tournament candidates compete at each budget using Power. Save the version you prefer.</p><h2>${U ? `Make it play like ${esc(pw.match.archetype)}` : "Format staples"}</h2>
    <p class="muted small">${U ? `Compared with ${U.lists} placing ${esc(pw.match.archetype)} list${U.lists === 1 ? "" : "s"} (your list is ${Math.round(pw.match.sim * 100)}% the same). Power now: <b>${pw.score}</b>.` : "Your list doesn’t closely match a tournament archetype yet, so here are the cards most tournament decks in this format play."}</p></section>
  ${U && U.adds.length ? `<section class="panel"><div class="row between"><h3>Add · played by most ${esc(pw.match.archetype)} lists</h3>${addCost ? `<span class="small">≈ ${usd(addCost, 0)} to buy</span>` : ""}</div><div class="list compact">${U.adds.map((x) => row(x, `${Math.round(x.share * 100)}% of lists · they run ${x.typical}, you run ${x.have}`)).join("")}</div></section>` : ""}
  ${U && U.cuts.length ? `<section class="panel"><h3>Consider cutting</h3><p class="muted small">Cards few or none of the placing lists play. Keep them if they’re part of your own plan.</p><div class="list compact">${U.cuts.map((x) => `<div class="mini-row"><span class="ellip">${x.qty}× ${esc(x.name)}</span><small class="muted">${Math.round(x.share * 100)}% of lists</small></div>`).join("")}</div></section>` : ""}
  ${stapleRows ? `<section class="panel"><h3>${U ? "Format staples you’re not playing" : "Most-played cards"}</h3><div class="list compact">${stapleRows}</div></section>` : ""}
  <p class="foot">From ${esc(meta?.source || "recent tournament results")}. Adding a card changes the deck only; it never adds to your collection. Save a version first to compare Power before and after.</p>`;
}

function deckVersions(g, d) {
  const vs = (d.versions || []).slice().reverse();
  return `<section class="panel"><div class="row between"><h3>Versions</h3><button class="btn small" data-act="tSnap" data-deck="${esc(d.id)}">Save a version now</button></div>
    <p class="muted small">A snapshot of the list you can compare against or go back to. Restoring saves the current list first.</p>
    ${vs.length ? `<div class="list">${vs.map((v) => {
      const df = diffZones(v.zones, d.zones),
        n = ["main", "extra", "side"].reduce((a, z) => a + (v.zones[z] || []).reduce((b, r) => b + r.qty, 0), 0);
      return `<div class="version"><div class="row between"><b>${esc(v.label)}</b><small class="muted">${esc(new Date(v.at).toLocaleString())} · ${n} cards</small></div>
        ${(() => { try { const f = formatOf(g, d.format), a = tcgPower(g, { ...d, zones: v.zones, id: d.id + ":v" + v.id }, f, (x) => cardOf(g, x)).score, b = tcgPower(g, d, f, (x) => cardOf(g, x)).score; return `<p class="small">Power then <b>${a}</b> → now <b class="${b > a ? "up" : b < a ? "down" : ""}">${b}</b></p>`; } catch { return ""; } })()}
        <p class="small">${df.added.length || df.removed.length ? `Since then: <span class="up">+${df.added.reduce((a, r) => a + r.qty, 0)}</span> <span class="down">−${df.removed.reduce((a, r) => a + r.qty, 0)}</span>` : "Same as now."}</p>
        ${df.added.length || df.removed.length ? `<details class="small"><summary>What changed</summary>${df.added.map((r) => `<div class="up">+${r.qty} ${esc(r.name)}</div>`).join("")}${df.removed.map((r) => `<div class="down">−${r.qty} ${esc(r.name)}</div>`).join("")}</details>` : ""}
        <div class="actions"><button class="btn ghost small" data-act="tRestore" data-deck="${esc(d.id)}" data-id="${esc(v.id)}">Restore</button><button class="link small danger" data-act="tDelVersion" data-deck="${esc(d.id)}" data-id="${esc(v.id)}">Delete</button></div></div>`;
    }).join("")}</div>` : `<p class="muted small">No versions yet.</p>`}</section>`;
}

export function tcgNewDeckSheet() {
  const g = game();
  return `<div class="sheet-head"><h2>New ${esc(GAMES[g].short)} deck</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="grid2"><label class="span2">Name<input id="tDeckName" maxlength="100" placeholder="My deck"></label>
  <label class="span2">Format<select id="tDeckFormat">${options(formatsOf(g).map((f) => [f.id, f.name]), formatsOf(g)[0].id)}</select></label></div>
  <button class="btn block" data-act="tNewDeckSave">Create deck</button>`;
}

export function tcgImportSheet(mode = "deck") {
  const g = game();
  return `<div class="sheet-head"><h2>${mode === "deck" ? "Import a deck" : "Paste cards you own"}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <p class="muted small">${g === "ygo" ? (mode === "deck" ? "Upload or paste a .ydk file (YGOPRODeck, EDOPro, Master Duel tools), or a list like “3 Ash Blossom & Joyous Spring”." : "One card per line: “3 Dark Magician”. Card names must match exactly.") : mode === "deck" ? "Paste a Pokémon TCG Live list (“4 Pikachu ex SVI 63”) or lines like “4 Nest Ball”. Cards are matched by name to their newest printing." : "One card per line: “2 Charizard ex” or a TCGdex id like “sv03.5-025”."}</p>
  <textarea id="tImpText" rows="9" placeholder="${g === "ygo" ? "#main&#10;89631139&#10;…" : "Pokémon: 12&#10;4 Pikachu ex SVI 63&#10;…"}"></textarea>
  ${mode === "deck" ? `<label class="btn ghost file">Upload a file<input type="file" accept=".ydk,.txt" data-change="tImpFile" hidden></label><div class="grid2"><label>Name<input id="tImpName" maxlength="100" value="Imported deck"></label><label>Format<select id="tImpFormat">${options(formatsOf(g).map((f) => [f.id, f.name]), formatsOf(g)[0].id)}</select></label></div>` : ""}
  <p id="tImpStatus" class="muted small" role="status"></p>
  <button class="btn block" data-act="${mode === "deck" ? "tImpDeck" : "tImpColl"}">Import</button>`;
}

/* ---------- sets ---------- */

export function setKind(name) {
  return /structure|starter|deck/i.test(name) ? "decks" : /promo|tournament|championship|prize|pack.*(?:ots|astral)|ots.*pack/i.test(name) ? "promos" : /tin|collection|legendary|duelist|gold|anniversary|reprint/i.test(name) ? "collections" : "boosters";
}
export function tcgSets() {
  const g = game(),
    U = ui(g).sets,
    q = U.q.trim().toLowerCase(),
    list = U.list.filter((s) => (!q || [s.name,s.code,s.date,s.series].some(v => String(v || "").toLowerCase().includes(q))) && (!U.kind || U.kind === "all" || setKind(s.name) === U.kind)).sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")) || a.name.localeCompare(b.name)),
    owned = ownedBySet(g);
  return `<div class="page-head"><h1>${esc(GAMES[g].short)} sets</h1></div>
  <div class="searchbar"><input type="search" value="${esc(U.q)}" placeholder="Find a set by name or code" data-input="tSetsQ" aria-label="Find a set" autocomplete="off"></div>
  ${U.list.length ? `<div class="set-catalog-status"><span>${list.length.toLocaleString()} sets · ${g === "ptcg" ? "TCGdex" : "YGOPRODeck"}</span><button class="link small" data-act="tSetsReload" ${U.busy?"disabled":""}>${U.busy?"Refreshing…":"Refresh sets"}</button></div>` : ""}
  ${U.error ? `<div class="note warn">${esc(U.error)} <button class="link" data-act="tSetsReload">Try again</button></div>` : ""}
  ${U.busy && !U.list.length ? `<p class="muted center pad">Loading every set…</p>` : ""}
  ${g === "ygo" ? `<div class="set-controls"><select data-change="tSetKind" aria-label="Set category">${options([["all","All releases"],["boosters","Booster releases"],["decks","Starter & Structure Decks"],["collections","Collections & reprints"],["promos","Promos & tournaments"]],U.kind || "all")}</select><p class="muted small">Grouped by release year · categories inferred from release names</p></div>` : ""}
  <div class="set-list">${list
    .slice(0, U.limit)
    .map((s,i,shown) => `${i === 0 || String(shown[i-1].date || "").slice(0,4) !== String(s.date || "").slice(0,4) ? `<h2 class="year">${esc(String(s.date || "").slice(0,4) || "Date unavailable")}</h2>` : ""}<button class="set-row" data-act="tSet" data-id="${esc(s.id)}">${setRowContent({name:s.name,code:s.code,image:s.image,symbol:g === "ptcg"?pkSetSymbol(s):'',detail:[s.series,s.date].filter(Boolean).join(' · '),count:s.count,owned:owned.get(s.id)||0})}</button>`)
    .join("")}</div>
  ${U.list.length && !list.length ? empty("No sets match", "Try a set name or code, or refresh the catalogue.") : ""}
  ${list.length > U.limit ? `<button class="btn ghost block" data-act="tSetsMore">Show more · ${list.length - U.limit} left</button>` : ""}
  ${g === "ptcg" ? `<p class="foot">Set and rarity symbols from <a href="https://pokesymbols.com" target="_blank" rel="noopener">pokesymbols.com</a>.</p>` : ""}`;
}
function ownedBySet(g) {
  const m = new Map(), seen = new Set();
  for (const e of gs(g).collection) {
    const c = cardOf(g, e.cardId),
      id = g === "ptcg" ? c?.set?.id : e.printing ? ui(g).sets.list.find((s) => e.printing.startsWith(s.code + "-"))?.id : null;
    if (id && !seen.has(id+":"+e.cardId)){seen.add(id+":"+e.cardId);m.set(id, (m.get(id) || 0) + 1);}
  }
  return m;
}

export function tcgSet() {
  const g = game(),
    U = ui(g).set,
    info = U.info,
    m = ownedMap(g);
  let list = U.cards.map((c) => cardOf(g, c.id) || c);
  const own = (c) => ownedOf(g, c, m);
  const ownedCount = list.filter(own).length;
  if (U.filter !== "all") list = list.filter((c) => (U.filter === "owned" ? own(c) : !own(c)));
  if (U.sort === "price") list = [...list].sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
  else if (U.sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="set-hero">${info?.image ? `<img class="set-logo big" src="${esc(info.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<div class="set-hero-main"><button class="link small" data-act="go" data-to="#sets">← All sets</button><h1>${g === "ptcg" && info ? pkSetSymbol(info, "pks big") + " " : ""}${esc(info?.name || U.id)}</h1><p class="muted small">${info ? `${esc(info.code)}${info.series ? " · " + esc(info.series) : ""}${info.date ? " · " + esc(info.date) : ""} · ${info.count} cards` : ""}</p></div></div>
  ${U.error ? `<div class="note warn">${esc(U.error)}</div>` : ""}
  ${U.cards.length ? `<div class="panel tight"><div class="row between"><span>You own <b>${ownedCount}</b> of ${U.cards.length}</span><b>${Math.round((ownedCount / U.cards.length) * 100)}%</b></div>${bar(ownedCount / U.cards.length, "good")}</div>` : ""}
  <div class="set-controls">${segmented("tSetFilter", U.filter, [["all", "All"], ["owned", "Owned"], ["missing", "Missing"]])}<select data-change="tSetSort" aria-label="Sort">${options([["number", "Set order"], ["price", "Price: high to low"], ["name", "Name"]], U.sort)}</select></div>
  ${!U.busy && !U.error && !U.cards.length ? `<section class="panel mu-empty"><div class="mu-empty-mark" aria-hidden="true">◇</div><h3>No card list for this set yet</h3><p class="muted">${esc(info?.name || "This set")} is listed${info?.cardCount?.total || info?.cardCount?.official ? ` with ${info.cardCount.total || info.cardCount.official} cards` : ""}, but the card database (TCGdex) doesn't have its cards yet. They'll appear here when it adds them; you can still search for these cards by name.</p></section>` : `<div class="list-bar"><p class="muted small">${U.busy ? "Loading cards and prices…" : `${list.length} shown · prices are daily market estimates`}</p>${viewControl(g, "set")}</div>`}
  <div class="card-grid set-grid">${list
    .slice(0, U.limit)
    .map((c) => `<button class="grid-card ${own(c) ? "own" : ""}" data-act="tCard" data-id="${esc(c.id)}" ${tierAttrs(tcgTier(c))}>${imgTag(c)}${tileBadges(c)}<span class="grid-meta"><span class="ellip">${c.set?.number ? "#" + esc(c.set.number) + " " : ""}${esc(c.name)}</span><span>${c.brief ? "…" : price(c) === null ? "—" : usd(price(c))}</span></span>${own(c) ? `<span class="owned-badge">×${own(c)}</span>` : ""}</button>`)
    .join("")}</div>
  ${list.length > U.limit ? `<button class="btn ghost block" data-act="tSetMore">Show more · ${list.length - U.limit} left</button>` : ""}`;
}

/* ---------- deck generator sheet ---------- */

// An incomplete version is a draft: say so, and name the cheapest way to finish it.
export function draftPath(tiers, i, label) {
  const t = tiers[i],
    open = t.size - t.total;
  if (open <= 0) return "";
  const next = tiers.findIndex((x, j) => j !== i && x.total >= x.size && (x.budget ?? Infinity) > (t.budget ?? -1));
  return `<p class="small draft-path">To finish: ${next >= 0 ? `the “${esc(label(tiers[next]))}” version fills every slot for ${usd(tiers[next].cost)}` : `add ${open} card${open === 1 ? "" : "s"} you own, or raise the budget`}.</p>`;
}
export const TCG_TIERS = { ygo: [0, 10, 25, 50, 100, Infinity], ptcg: [0, 10, 25, 50, 100, Infinity] };
const tcgBudgets = B => [...new Set([...TCG_TIERS[B.game],...(B.custom!==undefined && B.custom!=="" && Number.isFinite(Number(B.custom))?[Math.max(0,Number(B.custom))]:[])])].sort((a,b)=>a-b);
const tierName = (t) => (t.meta ? "Tournament list" : t.variant ? `${t.variant}${t.coversText ? ` · ${t.coversText}` : ""}` : t.budget === 0 ? "Your cards only" : t.budget === Infinity ? "No budget limit" : "Up to $" + t.budget);
const buildable = (g, c) => (c ? formatsOf(g).filter((f) => SOURCES[g].legality(c, f) !== "not_legal" && SOURCES[g].limit(c, f) > 0 && (g === "ygo" || c.category === "Pokemon")) : []);

export function tcgBuildSheet() {
  const B = S.ui.tbuild,
    g = B.game,
    seed = cardOf(g, B.seed),
    fmts = buildable(g, seed),
    tiers = B.results[B.format];
  return `<div class="sheet-head"><h2 class="build-heading">${brandMark("brand-idle")}<span>Build decks</span></h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  ${(B.seeds?.length || 1) > 1
    ? `<div class="build-seed multi"><div class="seed-strip">${B.seeds.slice(0, 8).map((id) => imgTag(cardOf(g, id), "mini-art")).join("")}</div><div><small class="muted">Built around</small><b>${B.seeds.length} of your cards</b><small class="muted">${esc([...new Set(B.seeds.map((id) => cardOf(g, id)?.archetype || "").filter(Boolean))].slice(0, 3).join(", ") || seed?.name || "")}</small></div></div>`
    : `<div class="build-seed">${imgTag(seed, "mini-art")}<div><small class="muted">Built around</small><b>${esc(seed?.name || "")}</b><small class="muted">${esc(seed?.archetype ? "Archetype: " + seed.archetype : seed?.typeLine || "")}</small></div><button class="btn ghost small" data-act="tRandomDeck" ${B.busy ? "disabled" : ""}>🎲 Random card</button></div>`}
  <p class="muted small">${g === "ygo" ? "Builds a legal deck from the archetype, then adds the hand traps, draw and removal today’s tournament decks play most — your cards first, at each budget, plus a recent tournament list when one plays your card." : "Builds the evolution line, adds the Trainers and support Pokémon today’s top decks play, and the Energy your attacks need — your cards first, at each budget, plus a recent tournament list when one plays your card. Basic Energy is assumed owned."}</p>
  <div class="fmt-chips">${fmts.map((f) => `<button class="chip pick ${f.id === B.format ? "on" : ""}" ${B.busy?"disabled":""} data-act="tBuildFormat" data-format="${f.id}">${esc(f.name)}</button>`).join("") || `<span class="muted small">${g === "ptcg" ? "Pick a Pokémon (not a Trainer or Energy) to build around." : "This card isn’t legal in any format."}</span>`}</div>
  <label class="custom-budget">Purchase budget $<input type="number" min="0" max="100000" step="1" value="${esc(B.custom ?? '')}" placeholder="Blank = unlimited" ${B.busy?'disabled':''} data-change="tBuildCustom"></label>
  ${B.busy ? buildOverlay(B.msg) : B.msg ? `<p class="small ${B.error ? "warn-text" : "muted"}" role="status">${esc(B.msg)}</p>` : ""}
  ${!B.busy && B.evidence ? `<p class="evidence small">${esc(B.evidence)}</p>` : ""}
  ${tiers ? `<div class="tiers">${tiers.map((t, i) => {
    const f = formatOf(g, B.format),
      all = t.zones.main.concat(t.zones.extra || []),
      owned = all.reduce((a, r) => a + Math.min(r.qty, ownedOf(g, cardOf(g, r.cardId))), 0),
      issues = SOURCES[g].validate({ zones: t.zones }, (id) => cardOf(g, id), f),
      // Each game's own card groups, in the order players read a list.
      groupOf = (card, zone) => g === "ygo" ? (zone === "extra" ? "Extra Deck" : card?.category === "Spell" ? "Spells" : card?.category === "Trap" ? "Traps" : "Monsters") : card?.category === "Trainer" ? "Trainers" : card?.category === "Energy" ? "Energy" : "Pokémon",
      order = g === "ygo" ? ["Monsters", "Spells", "Traps", "Extra Deck"] : ["Pokémon", "Trainers", "Energy"],
      groups = Object.fromEntries(order.map((k) => [k, []]));
    for (const [zone, rows] of [["main", t.zones.main], ["extra", t.zones.extra || []]])
      for (const r of rows) {
        const card = cardOf(g, r.cardId), have = Math.min(r.qty, ownedOf(g, card)), basic = !!card?.basicEnergy;
        const need = basic ? 0 : Math.max(0, r.qty - have), tt = tcgTier(card);
        // The same card tile as the deck page: art with price, set and type badges, owned or needed.
        const tile = `<div class="lot deck-row tier-row ${need ? "short" : ""}" data-tier="${tt.key}" style="${tierStyle(tt)}"><button class="lot-art" data-act="tCard" data-id="${esc(r.cardId)}" aria-label="Open ${esc(r.name)}">${imgTag(card)}${tileBadges(card)}<span class="art-price">${usd(price(card))}</span></button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(r.cardId)}">${esc(r.name)}</button><span class="lot-sub">${rowBadges(card)}${r.why ? `<small class="muted">${esc(r.why)}</small>` : ""}</span><span class="own ${need ? "no" : "yes"}">${need ? "Need " + need : basic && !have ? "Basic Energy" : "Owned"}</span></div><div class="lot-side"><span class="tier-qty">×${r.qty}</span></div></div>`;
        groups[groupOf(card, zone)].push({ qty: r.qty, name: r.name, tile, need, art: imgTag(card, "mini-art"), act: `data-act="tCard" data-id="${esc(r.cardId)}"`, why: r.why || "", status: basic ? "basic" : have >= r.qty ? "✓ Owned" : `Need ${r.qty - have}`, ok: basic || have >= r.qty });
      }
    for (const k of order) groups[k].sort((x, y) => y.qty - x.qty || x.name.localeCompare(y.name));
    return tierCardHtml({
      title: `${t.total < t.size ? `Draft — ${t.size - t.total} slot${t.size - t.total === 1 ? "" : "s"} open · ` : ""}${t.meta ? `🏆 ${esc(t.label)}` : esc(tierName(t))}`,
      format: f.name,
      legal: issues.length ? { ok: false, text: issues.length + " to fix" } : { ok: true, text: "Legal" },
      cost: t.cost, unknown: t.unknown, difficulty: t.difficulty, power: t.power, powerKind: t.powerKind, engine: t.engine,
      sizeText: zoneCountLabel(g, t.total, f), extraText: g === "ygo" ? `${(t.zones.extra || []).reduce((a, r) => a + r.qty, 0)} extra` : "",
      owned: all.length ? owned / all.reduce((a, r) => a + r.qty, 0) : 0,
      evidence: t.proven ? `Tournament candidate · ${t.label}` : "", warnings: t.warnings.filter((w) => !/slots? still open/.test(w)),
      notes: budgetComparisonHtml(t, i, "tTierAlternative") + draftPath(tiers, i, tierName),
      open: B.openTier === i,
      groups: order.map((name) => ({ name, rows: groups[name] })),
      toggle: `data-act="tTier" data-i="${i}"`, save: `data-act="tTierSave" data-i="${i}"`, saveLabel: "Save as deck",
      buy: `data-act="tTierBuy" data-i="${i}"`, need: order.reduce((a, k) => a + groups[k].reduce((b, r) => b + r.need, 0), 0),
      more: [
        { icon: "sword", label: "Save and see matchups", note: "How it does against the decks winning now", attrs: `data-act="tTierSaveGo" data-i="${i}" data-to="matchups"` },
        { icon: "cardStack", label: "Save and playtest", note: "Draw opening hands", attrs: `data-act="tTierSaveGo" data-i="${i}" data-to="playtest"` },
        { icon: "copy", label: "Copy deck list", note: g === "ptcg" ? "Pokémon TCG Live format" : "Paste into any deck site", attrs: `data-act="tTierCopy" data-i="${i}"` },
      ],
    });
  }).join("")}</div>${tiers.length > 1 ? `<button class="btn ghost block" data-act="tTierSaveAll">Save all ${tiers.length} versions</button>` : ""}` : ""}
  <p class="foot">Built from your cards first, then what today's tournament decks play. A strong start, not a tuned tournament list. Prices are daily estimates.</p>`;
}

/* ---------- shared deck page (#shared/… for Yu-Gi-Oh! and Pokémon) ---------- */

export function tcgSharedPage(sd) {
  const g = sd.game,
    m = ownedMap(g),
    f = formatOf(g, sd.format),
    rows = ["main", "extra", "side"].flatMap((z) => (sd.zones[z] || []).map((r) => ({ z, r, c: cardOf(g, r.cardId) }))),
    total = rows.reduce((a, x) => a + x.r.qty, 0),
    own = rows.reduce((a, x) => a + Math.min(x.r.qty, x.c ? ownedOf(g, x.c, m) : 0), 0),
    cost = rows.reduce((a, x) => a + Math.max(0, x.r.qty - (x.c ? ownedOf(g, x.c, m) : 0)) * (price(x.c) ?? 0), 0),
    issues = SOURCES[g].validate({ zones: sd.zones }, (id) => cardOf(g, id), f),
    cover = rows[0]?.c;
  return `<section class="deck-hero">${g === "ptcg" && cover ? pokemonArtCrop(cover, "hero-art") : imgTag(cover, "hero-art", true)}<div class="hero-shade"></div><div class="hero-body">
    <div class="row between"><button class="icon light" data-act="go" data-to="#home" aria-label="Home">←</button><span class="chip dark">Shared ${esc(GAMES[g].short)} deck</span></div>
    <h1>${esc(sd.name)}</h1><p><span class="chip dark">${esc(f.name)}</span>${sd.author ? ` · by <b>${esc(sd.author)}</b>` : ""}</p>
    <div class="hero-stats"><span><b>${total}</b>cards</span><span><b>${total ? Math.round((own / total) * 100) : 0}%</b>you own</span><span><b>${usd(cost, 0)}</b>to finish</span><span><b class="${issues.length ? "warn-text" : ""}">${issues.length ? issues.length + " issues" : "Legal"}</b>${esc(f.name)}</span></div></div></section>
  <div class="actions wrap share-actions"><button class="btn" data-act="tSharedBuild">Make my version</button></div>
  ${sd.about ? `<section class="panel"><h3>About this deck</h3><p class="about">${esc(sd.about)}</p></section>` : ""}
  ${issues.length ? `<section class="panel issues-panel"><h3>Rules check (${esc(f.name)})</h3><ul class="issues">${issues.map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul></section>` : ""}
  ${["main", "extra", "side"].filter((z) => (sd.zones[z] || []).length).map((z) => `<div class="section-head"><h2>${z === "main" ? (g === "ygo" ? "Main Deck" : "Deck") : z === "extra" ? "Extra Deck" : "Side Deck"}</h2></div><div class="card-grid">${rows.filter((x) => x.z === z).map((x) => { const have = x.c ? ownedOf(g, x.c, m) : 0; return `<button class="grid-card ${have >= x.r.qty ? "own" : ""}" data-act="tCard" data-id="${esc(x.r.cardId)}">${imgTag(x.c)}${tileBadges(x.c)}<span class="grid-meta"><span class="ellip">${x.r.qty}× ${esc(x.r.name)}</span><span>${have >= x.r.qty ? "owned" : usd(price(x.c))}</span></span></button>`; }).join("")}</div>`).join("")}
  <p class="foot">The person who shared this can’t see your collection, and the link doesn’t include theirs.</p>`;
}

/* ---------- import parsing ---------- */

export function parseLines(text) {
  if(String(text).length > 2e6) throw Error("Use a list under 2 MB.");
  if(/^Quantity,Name,/i.test(String(text).trim())) throw Error("This is a collection backup CSV. Keep it for reference; paste quantity and card-name lines here.");
  const out = []; let zone = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    const header=line.match(/^\[?(main(?:board| deck)?|extra(?: deck)?|side(?:board| deck)?)\]?:?$/i);
    if(header){zone=header[1].toLowerCase().startsWith("side")?"side":header[1].toLowerCase().startsWith("extra")?"extra":"main";continue;}
    if (!line || /^(#|\/\/|Pokémon:|Pokemon:|Trainer:|Energy:|Total Cards)/i.test(line)) continue;
    const m = line.match(/^(\d+)\s*x?\s+(.+?)$/i);
    const row=m ? { qty: Number(m[1]), name: m[2].trim() } : { qty: 1, name: line };
    if(zone) row.zone=zone; out.push(row);
  }
  return out;
}
// PTCGL lines end with "SET NUMBER"; keep the name only.
export const ptcglName = (name) => name.replace(/\s+[A-Z0-9-]{2,6}\s+[A-Za-z0-9-]{1,6}$/, "").trim();
export function parseYdk(text) {
  const zones = { main: [], extra: [], side: [] };
  let zone = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "#main") zone = "main";
    else if (line === "#extra") zone = "extra";
    else if (line === "!side") zone = "side";
    else if (zone && /^\d+$/.test(line)) zones[zone].push(String(Number(line)));
  }
  return zones.main.length || zones.extra.length || zones.side.length ? zones : null;
}

/* ---------- actions ---------- */

// No current catalogue price, but the price history has dated quotes for this exact product:
// show the latest one with its date and finish, so the headline and the chart never disagree.
const QUOTES = new Map();
function lastQuote(g, c) {
  if (g !== "ptcg" || !c?.id || c.brief) return null;
  if (QUOTES.has(c.id)) return QUOTES.get(c.id);
  QUOTES.set(c.id, null);
  fetch(`api/prices/recent?game=ptcg&id=${encodeURIComponent(c.id)}&finish=reference`, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const s = (d?.series || []).map((x) => ({ x, last: x.points?.at(-1) })).filter((x) => x.last).sort((a, b) => b.last.date.localeCompare(a.last.date))[0];
      if (!s) return;
      QUOTES.set(c.id, { value: s.last.value, date: s.last.date, finish: String(s.x.label || "").split(" · ").at(-1) });
      if (document.querySelector("#sheet[open]")) ctx?.refreshSheet?.();
    })
    .catch(() => {});
  return null;
}

export function registerTcg(c) {
  ctx = c;
  const { A, C, I, commit, render, openSheet, closeSheet, toast, go, download, copyText, busy } = c;
  const g = () => game();
  const mutate = (fn, opts) =>
    commit((s) => {
      s.tcg = s.tcg || {};
      s.tcg[g()] = s.tcg[g()] || blankGame();
      return fn(s.tcg[g()], s);
    }, opts);

  A.setGame = async (t) => {
    const id = t.dataset.game;
    if (!GAMES[id] || id === game()) return;
    await commit((s) => (s.settings.game = id), { rerender: false });
    document.body.dataset.game = id;
    closeSheet();
    const v = S.ui.view;
    go(["deck", "tdeck", "set", "shared"].includes(v) ? "#home" : "#" + (v === "settings" ? "settings" : v));
    render();
  };
  A.hideStart = (t) => {
    setStartHidden(t.dataset.game, true);
    toast("Hidden. The next step stays on Home.");
    render();
  };
  A.gameMenu = () =>
    openSheet(`<div class="sheet-head"><h2>Choose a game</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p class="muted small">Each game keeps its own collection, decks and formats.</p>${gameBinders(game())}`, { type: "game" });

  // search
  const runSearch = async (append = false) => {
    const G = g(),
      U = ui(G).search;
    if (U.busy) return;
    U.busy = true;
    U.error = "";
    U.ran = true;
    if (!append) {
      U.page = 0;
      U.results = [];
    }
    render();
    try {
      const r = await SOURCES[G].search({ q: U.q, ...U.f, sort: U.sort === "price" || U.sort === "priceAsc" ? (G === "ygo" ? "name" : "new") : U.sort, page: U.page });
      for (const x of r.cards) remember(x);
      U.results.push(...(append || (U.sort && U.sort !== (G === "ygo" ? "name" : "new")) ? r.cards : rankByName(r.cards, U.q || "")));
      U.more = r.more;
      U.total = r.total;
      if (G === "ptcg") ensureMany(G, r.cards.map((x) => x.id), () => S.ui.view === "search" && game() === G && render());
    } catch (e) {
      U.error = e.message;
    } finally {
      U.busy = false;
      render();
    }
  };
  I.tQ = (t) => (ui().search.q = t.value);
  A.tSearch = () => runSearch();
  A.tMore = async () => {
    const U=ui().search;if(U.busy)return;
    const previous=U.page;U.page++;
    await runSearch(true);
    if(U.error)U.page=previous; // A retry requests the failed page, never skips cards.
  };
  C.tFilter = (t) => {
    const U = ui().search;
    U.f[t.dataset.field] = t.value;
    if (t.dataset.field === "type" && g() === "ygo") delete U.f.race;
    runSearch();
  };
  A.tFilterClear = (t) => {
    const U = ui().search;
    delete U.f[t.dataset.field];
    delete U.f.setName;
    runSearch();
  };
  C.tSort = (t) => {
    const U = ui().search;
    U.sort = t.value;
    // Price sorts the cards already loaded; the others ask the database for a new order.
    if (t.value === "price" || t.value === "priceAsc") render();
    else runSearch();
  };
  C.tOwnFilter = (t) => {
    ui().search.own = t.value;
    render();
  };
  A.tChip = (t) => {
    const U = ui().search,
      k = t.dataset.field;
    if (k === "maxPrice") U.maxPrice = "";
    else if (k === "own") U.own = "";
    else if (k === "sort") U.sort = g() === "ygo" ? "name" : "new";
    else {
      delete U.f[k];
      if (k === "set") delete U.f.setName;
      if (k === "type") delete U.f.race;
    }
    if (k === "maxPrice" || k === "own") return render();
    if (U.q.trim() || Object.values(U.f).some(Boolean)) runSearch();
    else {
      Object.assign(U, { results: [], ran: false, error: "" });
      render();
    }
  };
  A.tClear = () => {
    const U = ui().search;
    Object.assign(U, { f: {}, maxPrice: "", own: "", sort: g() === "ygo" ? "name" : "new" });
    if (U.q.trim()) runSearch();
    else {
      Object.assign(U, { results: [], ran: false, error: "" });
      render();
    }
  };
  A.tSaveSearch = () => {
    const G = g(),
      U = ui(G).search,
      parts = [U.q.trim() && `“${U.q.trim().slice(0, 24)}”`, ...Object.entries(U.f).filter(([k, v]) => v && k !== "setName").map(([k, v]) => (k === "set" ? U.f.setName || v : k === "format" ? formatOf(G, v).name : v)), U.maxPrice !== "" && `under $${U.maxPrice}`].filter(Boolean),
      label = parts.join(" · ").slice(0, 60) || "Search";
    setSavedSearches(G, [{ label, q: U.q, f: structuredClone(U.f), maxPrice: U.maxPrice, own: U.own || "", sort: U.sort }, ...savedSearches(G).filter((x) => x.label !== label)]);
    toast("Search saved.");
    render();
  };
  A.tSaved = (t) => {
    const G = g(),
      x = savedSearches(G)[Number(t.dataset.i)],
      U = ui(G).search;
    if (!x) return;
    Object.assign(U, { q: x.q || "", f: { ...x.f }, maxPrice: x.maxPrice || "", own: x.own || "", sort: x.sort || U.sort });
    runSearch();
  };
  A.tSavedDel = (t) => {
    const list = savedSearches(g());
    list.splice(Number(t.dataset.i), 1);
    setSavedSearches(g(), list);
    render();
  };
  C.tMax = (t) => {
    ui().search.maxPrice = t.value === "" ? "" : String(Math.max(0, Number(t.value) || 0));
    render();
  };

  // card sheet
  A.tCard = async (t) => {
    const G = g(),
      id = t.dataset.id,
      sctx = { type: "tcard", game: G, id, entryId:t.dataset.entry || "",random: !!t.dataset.random, deckId: t.dataset.deck || (S.ui.view === "tdeck" ? S.ui.tdeckId : null) };
    const known = cardOf(G, id);
    openSheet(known ? tcgCardSheet(known, sctx) : `<div class="sheet-head"><h2>Loading…</h2><button class="icon" data-act="closeSheet">✕</button></div>`, sctx);
    try {
      const card = await ensureCard(G, id);
      if (S.ui.sheetCtx === sctx) openSheet(tcgCardSheet(card, sctx), sctx, document.querySelector("#sheetBody").scrollTop);
      // The set row shows a card's first release; that needs the set list's dates (loaded once).
      if (G === "ygo" && !ygoSetIndex().size)
        loadSets("ygo").then(() => S.ui.sheetCtx === sctx && openSheet(tcgCardSheet(cardOf(G, id), sctx), sctx, document.querySelector("#sheetBody").scrollTop)).catch(() => {});
    } catch (e) {
      if (S.ui.sheetCtx === sctx) openSheet(`<div class="sheet-head"><h2>Couldn’t load card</h2><button class="icon" data-act="closeSheet">✕</button></div><div class="note warn">${esc(e.message)}</div>`, sctx);
    }
  };
  // ----- random -----
  let randomBusy = false;
  A.tRandomCard = async () => {
    if (randomBusy) return;
    randomBusy = true;
    const G = g();
    toast("Picking a random card…");
    try {
      const card = remember(await SOURCES[G].random());
      await A.tCard({ dataset: { id: card.id, random: "1" } });
    } catch (e) {
      toast(e.message);
    } finally {
      randomBusy = false;
    }
  };
  // A random deck: a random archetype (Yu-Gi-Oh!) or Standard-legal Pokémon, then the deck builder.
  A.tRandomDeck = async (t = {dataset:{}}) => {
    if (randomBusy) return;
    randomBusy = true;
    const G = g(), chosen = formatOf(G,t.dataset.format), theme = String(t.dataset.theme || "").trim();
    toast(G === "ygo" ? "Picking a random archetype…" : "Picking a random Pokémon…");
    try {
      let seed;
      if (G === "ygo") {
        let result;
        if(theme){
          result=await SOURCES.ygo.search({archetype:theme,format:chosen.id,size:100}).catch(()=>({cards:[]}));
          if(!result.cards.length)result=await SOURCES.ygo.search({race:theme,format:chosen.id,size:100}).catch(()=>({cards:[]}));
          if(!result.cards.length)result=await SOURCES.ygo.search({q:theme,format:chosen.id,size:100});
        }else result=await SOURCES.ygo.randomArchetype();
        const {cards}=result;
        cards.forEach(remember);
        const tcgOk = (c) => SOURCES.ygo.legality(c, chosen) !== "not_legal" && SOURCES.ygo.limit(c, chosen) > 0;
        const monsters = cards.filter((c) => c.category === "Monster" && !c.extra);
        const pool = monsters.filter(tcgOk);
        if(!pool.length)throw Error("No legal build-around found for that format and theme. Try another theme or leave it blank.");
        seed = pool[Math.floor(Math.random() * pool.length)];
      } else {
        const result = await SOURCES.ptcg.search({category:"Pokemon",format:chosen.id,...(theme ? {type:theme} : {}),size:100});
        const pool=[...result.cards];
        for(let attempts=0;pool.length && attempts<8;attempts++){
          const index=Math.floor(Math.random()*pool.length),brief=pool.splice(index,1)[0],card=remember(await SOURCES.ptcg.get(brief.id));
          if(card.category === "Pokemon" && SOURCES.ptcg.legality(card,chosen)!=="not_legal" && SOURCES.ptcg.limit(card,chosen)>0){seed=card;break;}
        }
        if(!seed)throw Error("No legal Pokémon found for that format and type. Try another type or leave it blank.");
      }
      openBuild(G,[seed.id],"",null,chosen.id);
    } catch (e) {
      toast(e.message);
    } finally {
      randomBusy = false;
    }
  };
  A.tVariantArt = (t) => {
    const card = cardOf(g(),t.dataset.id);
    if (!card) return;
    const v = t.dataset.art ? card.artworks?.find(a => a.id === t.dataset.art) : card.variants?.find(v => v.key === t.dataset.variant);
    const a = variantArtwork(card,v || {});
    const chosen = { ...card, id:a.imageId, image:a.image, imageLarge:a.imageLarge };
    openSheet(`<div class="sheet-head"><h2>${esc(card.name)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p>${esc(v?.label || "Card artwork")}</p><div class="variant-art-large">${imgTag(chosen,"card-img",true)}</div><p class="foot">${esc(a.label)}${card.game === "ygo" ? " · The source does not map this artwork to a specific set code or edition." : " · Confirm stamps, borders and finish on your physical card."}</p>`,{type:"variant-art",id:card.id});
  };
  // Compare two cards (same as Magic's Compare).
  const cmp = () => (ui().compare ||= [null, null]);
  A.tCompareOpen = () => openSheet(tcgCompareSheet(g(), cmp()), { type: "tcompare" });
  A.tCompareFrom = (t) => {
    ui().compare = [cardOf(g(), t.dataset.id) || null, null];
    A.tCompareOpen();
  };
  A.tCompareClear = (t) => {
    cmp()[Number(t.dataset.i)] = null;
    A.tCompareOpen();
  };
  A.tCompareLookup = async (t) => {
    const i = Number(t.dataset.i),
      G = g(),
      q = (document.getElementById("tcmp" + i)?.value || "").trim();
    if (!q) return;
    const r = await SOURCES[G].search({ q, size: 20 }).catch(() => null),
      hit = rankByName(r?.cards || [], q)[0];
    if (!hit) return toast("No card with that name.");
    cmp()[i] = (await ensureCard(G, hit.id).catch(() => null)) || hit;
    A.tCompareOpen();
  };
  A.tOwn = (t) => {
    const card = cardOf(g(), t.dataset.id);
    if (card) openSheet(tcgAddSheet(card, t.dataset.print || ""), { type: "tadd", id: card.id });
  };
  // Every card name for a game, kept on the device (two weeks) for spelling-tolerant scan matching.
  // Downloaded only when a scanned name doesn't match exactly.
  const NAMES_KEY = (G) => `cardforge-names-${G}-v1`;
  let nameIdx = {};
  const nameIndex = async (G, status = () => {}) => {
    if (nameIdx[G]) return nameIdx[G];
    try {
      const c = JSON.parse(localStorage.getItem(NAMES_KEY(G)) || "null");
      if (c?.list?.length && Date.now() - c.at < 14 * 864e5) return (nameIdx[G] = c.list);
    } catch {}
    status(`Downloading the ${GAMES[G].short} card name list (once, ~3 MB)…`);
    const list =
      G === "ygo"
        ? [...new Set(((await (await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php")).json()).data || []).map((x) => x.name))]
        : [...new Set(((await (await fetch("https://api.tcgdex.net/v2/en/cards")).json()) || []).filter((x) => !/^(A\d|P-A)/.test(x.id)).map((x) => x.name))];
    nameIdx[G] = list;
    try {
      localStorage.setItem(NAMES_KEY(G), JSON.stringify({ at: Date.now(), list }));
    } catch {}
    return list;
  };
  const closestNames = (list, n, k = 3) =>
    list
      .map((name) => ({ name, sc: similarity(name, n) }))
      .filter((x) => x.sc >= 0.68)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, k)
      .map((x) => x.name);

  // A scan candidate for the scanner's list.
  const scanCand = (G, card, why, exact, print = "", m = ownedMap(G)) => {
    remember(card);
    const ps = G === "ygo" && print ? card.sets?.find((x) => `${x.code}|${x.rarity}` === print) : null;
    return { id: card.id, name: card.name, image: G === "ygo" ? ygoImageDirect(card.id, false) : card.imageLarge, sub: G === "ygo" ? (ps ? `${ps.name} · ${ps.code} · ${ps.rarity}` : card.typeLine) : `${card.set?.name || ""} · #${card.set?.number || ""}${card.set?.total ? "/" + card.set.total : ""} · ${card.rarity || ""}`, why, exact, print, owned: ownedOf(G, card, m), card };
  };
  // Every printing of a scanned card's name with a small picture, for matching the artwork.
  c.scanPrintings = async (G, cand) => {
    if (G !== "ptcg") return [];
    const r = await SOURCES.ptcg.search({ q: cand.name, size: 400 }).catch(() => ({ cards: [] }));
    // Pictures from hosts that allow reading pixels (TCGdex, or the Pokémon TCG API fallback).
    return r.cards
      // A different suffix means a different card, not a printing of the same card.
      .filter((b) => scanNameKey(b.name) === scanNameKey(cand.name))
      .sort((a, b) => (b.name === cand.name) - (a.name === cand.name))
      .map((b) => ({ id: b.id, thumb: artworkSources(b).find((u) => /tcgdex\.net|images\.pokemontcg\.io/.test(u)) || "" }))
      .filter((b) => b.thumb)
      .slice(0, 120);
  };
  // No readable name: Yu-Gi-Oh! from phrases of the card text, Pokémon from attack names.
  c.scanByText = async (G, full) => {
    const tally = new Map(),
      add = (name, w) => tally.set(name, (tally.get(name) || 0) + w);
    if (G === "ygo")
      for (const ph of textPhrases(full, 10)) {
        if ([...tally.values()].some((w) => w >= 0.3)) break;
        const r = await SOURCES.ygo.search({ text: ph, size: 10 }).catch(() => null);
        if (r?.cards?.length && r.total <= 8) for (const x of r.cards) add(x.name, 1 / r.total);
      }
    else
      for (const atk of attackNames(full)) {
        const u = "https://api.pokemontcg.io/v2/cards?" + new URLSearchParams({ q: `attacks.name:"${atk.replace(/"/g, "")}"`, select: "name,attacks", pageSize: "60" });
        const d = await fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const hits = (d?.data || []).filter((x) => (x.attacks || []).some((a) => similarity(a.name, atk) >= 0.85));
        // That catalogue writes "Mewtwo-GX"; TCGdex writes "Mewtwo GX".
        for (const x of hits) add(x.name.replace(/-(GX|EX)\b/g, " $1"), 1 / hits.length);
      }
    return [...tally].sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 5);
  };
  c.scanCandById = async (G, id, why, exact) => {
    const card = await ensureCard(G, id).catch(() => null);
    return card ? scanCand(G, card, why, exact) : null;
  };
  // Scanner matching (the scanner itself is scancam.js): exact printing codes first, then names.
  c.scanMatch = async (read, lang, manual = false, status = () => {}, G0 = "") => {
    const G = G0 || g(),
      out = [],
      seen = new Set(),
      tried = [],
      m = ownedMap(G),
      push = (card, why, exact, print = "") => {
        if (!card || seen.has(card.id) || out.length >= 3) return;
        seen.add(card.id);
        out.push(scanCand(G, card, why, exact, print, m));
      };
    const all = `${read.code}\n${read.full}`,
      names = manual ? [read.name] : nameCandidates(G, read.name || read.full);
    if (G === "ygo") {
      // Japanese/other-region codes (DUNE-JP001) also try the English printing (DUNE-EN001).
      const codes = ygoSetCodes(manual ? read.name : all).flatMap((c) => [c, c.replace(/-([A-Z]{1,2})(\d{3})$/, "-EN$2")]).filter((c, i, a) => a.indexOf(c) === i);
      for (const code of codes.slice(0, 4)) {
        tried.push(code);
        const info = await fetch("https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=" + encodeURIComponent(code)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (info?.id) push(await ensureCard("ygo", String(info.id)).catch(() => null), `Set code ${info.set_code}`, true, `${info.set_code}|${info.set_rarity}`);
      }
      if (!manual) for (const id of ygoPasscodes(all)) push(await ensureCard("ygo", id).catch(() => null), "Passcode " + id, false);
      for (const n of names) {
        if (out.length >= 3) break;
        if (out.some((o) => scanNameKey(o.name).includes(scanNameKey(n)))) continue;
        tried.push(n);
        push(await SOURCES.ygo.byName(n).catch(() => null), "Name match", false);
      }
      // Misread names ("DAR MACICTAN" → Dark Magician): closest spellings from the full name list.
      const misread = names.filter((x) => x.replace(/[^a-z]/gi, "").length >= 5).slice(0, 2);
      if (!out.length && misread.length) {
        const list = await nameIndex("ygo", status).catch(() => []);
        for (const n of misread) for (const name of closestNames(list, n)) if (out.length < 3) push(await SOURCES.ygo.byName(name).catch(() => null), `Closest name to “${n}”`, false);
      }
    } else {
      const nums = manual ? [] : ptcgNumbers(all);
      for (const n of names.slice(0, 3))
        for (const x of nums) {
          tried.push(`${n} #${x.num}`);
          for (const h of await SOURCES.ptcg.byNameNumber(n, x.num).catch(() => [])) {
            const card = await ensureCard("ptcg", h.id).catch(() => null);
            if (scanCandidateMatches(card, n, [x])) push(card, `Card #${x.num}/${x.total}`, true);
          }
        }
      for (const n of names) {
        if (out.length >= 3) break;
        if (out.some((o) => scanNameKey(o.name).includes(scanNameKey(n)))) continue;
        tried.push(n);
        // Exact-ish names first; for misreads, search the first word's start and rank by spelling.
        // A substring hit ("wel" → Swellow) is not identification: whole-name matches only, unless typed.
        let hits = (await SOURCES.ptcg.search({ q: n, size: 6 }).catch(() => ({ cards: [] }))).cards.filter((b) => manual || scanCandidateMatches(b, n));
        if (!hits.length && n.replace(/[^a-z]/gi, "").length >= 5) {
          const list = await nameIndex("ptcg", status).catch(() => []);
          for (const name of closestNames(list, n, 2)) hits.push(...(await SOURCES.ptcg.search({ q: name, size: 4 }).catch(() => ({ cards: [] }))).cards.filter((b) => b.name === name));
        }
        for (const b of hits.slice(0, 3 - out.length)) push(await ensureCard("ptcg", b.id).catch(() => null), "Same name. Check the number", false);
      }
    }
    return { cands: out, tried };
  };
  // Save a whole scan session at once: Pokémon finish → variant, Yu-Gi-Oh! finish → edition.
  c.scanAddMany = async (items) => {
    const G = g(),
      n = items.reduce((a, x) => a + x.qty, 0);
    await mutate(
      (st) => {
        for (const it of items) {
          const card = it.cand.card,
            [printing, rarity] = it.cand.print ? it.cand.print.split("|") : ["", ""];
          st.collection.push({ id: uid(), cardId: card.id, name: card.name, key: SOURCES[G].ownKey(card), qty: it.qty, printing, rarity, variant: G === "ptcg" && it.finish && it.finish !== "normal" ? it.finish : "", variantLabel: G === "ptcg" ? card.variants?.find((v) => v.key === it.finish)?.label || "" : "", edition: G === "ygo" && it.finish === "1st-edition" ? "1st-edition" : "", condition: it.condition || "Near Mint", language: it.lang || "en", location: it.location || "", addedAt: new Date().toISOString(), source: "scan" });
        }
      },
      { undo: `Added ${n} scanned card${n === 1 ? "" : "s"}.` },
    );
  };
  c.scanPrice = (cand, finish) => {
    const card = cand.card;
    if (!card) return null;
    const v = card.variants?.find((x) => x.key === finish);
    return v?.usd ?? price(card) ?? null;
  };
  c.scanAdd = async (cand) => {
    const G = g(),
      card = cand.card,
      [printing, rarity] = cand.print ? cand.print.split("|") : ["", ""];
    await mutate(
      (st) => {
        st.collection.push({ id: uid(), cardId: card.id, name: card.name, key: SOURCES[G].ownKey(card), qty: 1, printing, rarity, variant: "", condition: "Near Mint", location: "", addedAt: new Date().toISOString(), source: "scan" });
      },
      { undo: `Added 1 × ${card.name}${printing ? ` (${printing})` : ""}.` },
    );
  };

  A.tOwnSave = async (t) => {
    const rawValue=document.querySelector("#lotManualValue")?.value||"",manualValue=rawValue===""?null:Number(rawValue);
    if(manualValue!==null&&(!Number.isFinite(manualValue)||manualValue<0))return toast("Enter a non-negative value or leave it blank.");
    const G = g(),
      card = cardOf(G, t.dataset.id),
      qty = Math.max(1, Math.min(999, Math.floor(Number(document.querySelector("#tQty").value) || 1))),
      pr = document.querySelector("#tPrint")?.value || "",
      [printing, rarity] = G === "ygo" && pr ? pr.split("|") : ["", ""],
      edition = G === "ygo" ? document.querySelector("#tEdition")?.value || "" : "",
      variantLabel = G === "ptcg" ? card.variants?.find(v => v.key === pr)?.label || pr : "";
    await mutate(
      (st,state) => {
        const location=rememberLocation(state,G,document.querySelector("#tLoc").value,{createBinder:document.querySelector("#tLocPicker")?.value === "binder:new"});
        const same = st.collection.find((e) => e.cardId === card.id && (e.printing || "") === printing && (e.variant || "") === (G === "ptcg" ? pr : "") && (e.edition || "") === edition && (e.rarity || "") === rarity && (e.manualValue??null)===manualValue && e.condition === document.querySelector("#tCond").value && String(e.location || "").trim() === location);
        if (same) same.qty += qty;
        else st.collection.push({ id: uid(), cardId: card.id, name: card.name, key: SOURCES[G].ownKey(card), qty, printing, rarity, edition, variantLabel, variant: G === "ptcg" ? pr : "", manualValue,manualValueCondition:conditionName(document.querySelector("#tCond").value), condition: document.querySelector("#tCond").value, location, addedAt: new Date().toISOString() });
      },
      { msg: `Added ${qty}× ${card.name}.` },
    );
    closeSheet();
  };
  // − / + on a version you own: changes the copy you already have (one undo per tap).
  A.tVariantQty = async (t) => {
    const G = g(), c = cardOf(G, t.dataset.id), d = Number(t.dataset.delta);
    if (!c) return;
    const v = (c.variants || []).find((x) => x.key === t.dataset.print) || { key: t.dataset.print };
    const id = variantEntries(G, c, v).at(-1)?.id;
    if (!id) return;
    await mutate((st) => {
      const e = st.collection.find((x) => x.id === id);
      if (!e) return;
      e.qty += d;
      if (e.qty <= 0) st.collection = st.collection.filter((x) => x.id !== id);
    }, { undo: `${d > 0 ? "Added" : "Removed"} 1 × ${c.name} (${v.label || v.key}).` });
    c.refreshSheet?.();
  };
  A.tEntryQty = async (t) => {
    const delta = Number(t.dataset.delta);
    await mutate((st) => {
      const e = st.collection.find((x) => x.id === t.dataset.id);
      if (!e) return;
      e.qty += delta;
      if (e.qty < 1) st.collection = st.collection.filter((x) => x !== e);
    }, delta < 0 ? { undo: `−1 ${gs(g()).collection.find((x) => x.id === t.dataset.id)?.name || "card"}` } : {});
  };
  A.tCollMore = () => { ui().coll.limit = (ui().coll.limit || 120) + 120; render(); };
  I.tCollQ = (t) => {
    ui().coll.limit = 120;
    ui().coll.q = t.value;
    c.rerenderKeepingFocus();
  };
  C.tCollSet = (t) => {
    ui().coll.limit = 120;
    ui().coll.set = t.value;
    render();
  };
  C.tCollKind = (t) => {
    ui().coll.limit = 120;
    ui().coll[t.dataset.field] = t.value;
    render();
  };
  C.tCollSort = (t) => {
    ui().coll.limit = 120;
    ui().coll.sort = t.value;
    render();
  };
  A.tRefreshPrices = async (t) => {
    const G = g(),
      done = busy(t, "Refreshing…");
    try {
      const n = await ensureMany(G, gs(G).collection.map((e) => e.cardId), () => {}, true);
      render();
      toast(`Prices refreshed for ${n} cards.`);
    } finally {
      done();
    }
  };
  A.tExportColl = () => {
    const G = g(),
      rows = [["Quantity", "Name", "Set", "Printing", "Rarity/Version", "Edition", "Condition", "Price USD"]];
    for (const e of gs(G).collection) {
      const card = cardOf(G, e.cardId);
      rows.push([e.qty, e.name, setLabel({ e, c: card }), e.printing || card?.set?.number || "", e.rarity || e.variantLabel || e.variant || "", e.edition || "", e.condition || "", entryPrice(card, e) ?? ""]);
    }
    download(`CardStashy_${GAMES[G].short.replace(/\W/g, "")}_collection.csv`, rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n", "text/csv");
  };

  A.tCollTab = (t) => {
    ui().coll.tab = t.dataset.id;
    go("#collection/" + t.dataset.id);
    render();
  };
  A.tWish = async (t) => {
    const G = g(),
      card = cardOf(G, t.dataset.id);
    let added = false;
    await mutate((st) => {
      if (st.wishlist.some((w) => w.cardId === t.dataset.id)) st.wishlist = st.wishlist.filter((w) => w.cardId !== t.dataset.id);
      else {
        st.wishlist.push({ id: uid(), cardId: t.dataset.id, name: card?.name || t.dataset.id, qty: 1, addedAt: new Date().toISOString() });
        added = true;
      }
    }, { msg: "" });
    toast(added ? `${card?.name || "Card"} added to your wishlist.` : "Removed from wishlist.");
  };
  A.tWishCopy = () => copyText(gs(g()).wishlist.map((w) => `${w.qty || 1} ${w.name}`).join("\n"), "Wishlist copied.");
  // Search for every card in an archetype (Yu-Gi-Oh!) or every printing of a name (Pokémon).
  A.tArchetype = (t) => {
    const U = ui().search;
    U.q = "";
    U.f = { archetype: t.dataset.name, setName: "Archetype: " + t.dataset.name };
    closeSheet();
    go("#search");
    runSearch();
  };
  A.tOtherPrintings = (t) => {
    const U = ui().search;
    U.q = t.dataset.name;
    U.f = {};
    closeSheet();
    go("#search");
    runSearch();
  };

  // decks
  A.tNewDeck = () => openSheet(tcgNewDeckSheet(), { type: "tnew" });
  A.tNewDeckSave = async () => {
    const d = { id: uid(), name: document.querySelector("#tDeckName").value.trim().slice(0, 100) || "New deck", format: document.querySelector("#tDeckFormat").value, zones: { main: [], extra: [], side: [] }, createdAt: new Date().toISOString() };
    await mutate((st) => st.decks.push(d), { msg: "Deck created. Add cards with the search box." });
    closeSheet();
    go("#tdeck/" + d.id);
  };
  const addToDeck = (st, deckId, card, zone, n = 1) => {
    const d = st.decks.find((x) => x.id === deckId);
    if (!d) return null;
    if (!card) throw Error("Load the card’s details before adding it.");
    zone = zone || SOURCES[g()].zoneFor(card);
    const f=formatOf(g(),d.format), limit=SOURCES[g()].limit(card,f), totalCopies=["main","extra","side"].reduce((a,z)=>a+(d.zones[z] || []).filter(r=>r.name===card.name).reduce((a,r)=>a+r.qty,0),0), cap=g()==="ygo"?(zone==="main"?f.main[1]:f[zone]):60;
    if(g()==="ygo" && zone==="extra" && !card.extra)throw Error("Only Extra Deck monsters belong in this zone.");
    if(g()==="ygo" && zone==="main" && card.extra) throw Error("This monster belongs in the Extra Deck.");
    if(SOURCES[g()].legality(card,f)==="not_legal")throw Error("This printing is not legal in the selected format.");
    if(limit===0)throw Error("This card is forbidden in the selected format.");
    if(totalCopies+n>limit)throw Error(`This format allows ${limit} copies of ${card.name}.`);
    if((d.zones[zone] || []).reduce((a,r)=>a+r.qty,0)+n>cap)throw Error(`${zone} deck is full (${cap} cards maximum). Make a cut before adding.`);
    const list = (d.zones[zone] ||= []),
      row = list.find((r) => r.cardId === card.id);
    if (row) row.qty += n;
    else list.push({ cardId: card.id, name: card.name, qty: n });
    return d;
  };
  A.tAddToDeck = async (t) => {
    const card = cardOf(g(), t.dataset.id),
      deckId = document.querySelector("#tToDeck").value;
    await mutate((st) => addToDeck(st, deckId, card), { msg: `${card.name} added.` });
  };
  I.tDeckQ = (t) => (ui().deckAdd.q = t.value);
  A.tDeckFind = async () => {
    const G = g(),
      A2 = ui(G).deckAdd;
    if (!A2.q.trim()) return;
    A2.busy = true;
    render();
    try {
      const r = await SOURCES[G].search({ q: A2.q, size: 12 });
      A2.results = r.cards.slice(0, 12).map(remember);
      if (G === "ptcg") ensureMany(G, A2.results.map((x) => x.id), () => S.ui.view === "tdeck" && render());
      if (!A2.results.length) toast("No cards found.");
    } catch (e) {
      toast(e.message);
    } finally {
      A2.busy = false;
      render();
    }
  };
  const reviewUpgrade = (card,deckId) => {
    const G=g(),d=gs(G).decks.find(x=>x.id===deckId);if(!d||!card)return;
    const f=formatOf(G,d.format),zone=SOURCES[G].zoneFor(card),rows=d.zones[zone] || [];
    if(SOURCES[G].legality(card,f)!=="legal")return toast("This printing is not legal in the selected format.");
    const total=rows.reduce((a,r)=>a+r.qty,0),target=G==='ptcg'?60:zone==='main'?f.main[0]:f[zone];
    const before=tcgPower(G,d,f,id=>cardOf(G,id));
    const ranked=rows.filter(r=>r.cardId!==card.id).map(r=>{
      const next=swappedZones(d,zone,r.cardId,card),issues=SOURCES[G].validate(next,id=>cardOf(G,id),f).filter(x=>x.level==='bad');
      if(issues.length)return null;const after=tcgPower(G,next,f,id=>cardOf(G,id));return {r,after,delta:after.score-before.score};
    }).filter(Boolean).sort((a,b)=>comparePower(b.after,a.after));
    const actions=ranked.map(({r,after,delta})=>`<button class="btn ghost" data-act="tUpgradeSwap" data-deck="${esc(d.id)}" data-in="${esc(card.id)}" data-out="${esc(r.cardId)}" data-zone="${zone}">Cut 1× ${esc(r.name)} → ${esc(card.name)} <span class="small ${delta>0?"ok-text":delta<0?"warn-text":"muted"}">Power ${before.score} → ${after.score} · ${delta>0?"+":""}${delta.toFixed(1)}${after.engine?.unmappedNeeds?` · ${after.engine.unmappedNeeds} unrecognized requirements`:""}</span></button>`).join('');
    openSheet(`<div class="sheet-head"><h2>Review upgrade</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p>Add 1× <b>${esc(card.name)}</b> to ${esc(d.name)}.</p><p class="muted small">${total} cards in ${zone}. Ranked with the same Power and engine checks as your deck. A neutral or lower estimate is a trade-off, not a claimed upgrade. Choose one copy to cut. Each swap preserves the count and saves a version you can restore.</p><div class="card-action-list">${actions}</div>${total<target?`<button class="btn" data-act="tDeckAdd" data-deck="${esc(d.id)}" data-id="${esc(card.id)}">Fill one open slot (${target-total} open)</button>`:''}`,{type:'upgrade',id:card.id});
  };
  A.tUpgradeSwap = async t => {
    const G=g(),card=cardOf(G,t.dataset.in);if(!card)return toast("Load this card again before swapping.");
    await mutate(st=>{
      const d=st.decks.find(x=>x.id===t.dataset.deck);if(!d)throw Error("Deck no longer exists.");
      const before=structuredClone(d),zone=t.dataset.zone,row=d.zones[zone]?.find(r=>r.cardId===t.dataset.out);
      if(!row||row.qty<1)throw Error("The cut is no longer in this deck. Review the upgrade again.");
      const beforeIssues=SOURCES[G].validate(d,x=>cardOf(G,x),formatOf(G,d.format)).filter(x=>x.level==='bad').map(x=>x.text);
      try {
        row.qty--;d.zones[zone]=d.zones[zone].filter(r=>r.qty>0);addToDeck(st,d.id,card,zone);
        const newIssues=SOURCES[G].validate(d,x=>cardOf(G,x),formatOf(G,d.format)).filter(x=>x.level==='bad'&&!beforeIssues.includes(x.text));
        if(newIssues.length)throw Error(newIssues[0].text);
        (d.versions ||= []).push({id:uid(),label:'Before upgrade swap',at:Date.now(),zones:before.zones});
      }catch(e){Object.assign(d,before);throw e;}
    },{undo:`Swapped one copy for ${card.name}.`});closeSheet();
  };
  // Resolve an exact legal printing before reviewing the swap.
  A.tDeckAddName = async (t) => {
    const G = g(),
      r = await SOURCES[G].search({ q: t.dataset.name, size: 8 }).catch(() => ({ cards: [] })),
      hit = r.cards.find((x) => x.name.toLowerCase() === String(t.dataset.name).toLowerCase() && SOURCES[G].legality(x,formatOf(G,gs(G).decks.find(d=>d.id===t.dataset.deck)?.format)) === "legal");
    if (!hit) return toast("Couldn’t find that card right now.");
    const card = await ensureCard(G, hit.id).catch(() => remember(hit));
    if(t.dataset.upgrade)return reviewUpgrade(card,t.dataset.deck);
    await mutate((st) => addToDeck(st, t.dataset.deck, card), { msg: `${card.name} added.` });
  };
  // From the Power panel: look up a card the tournament list plays, ready to add.
  A.tDeckFindName = async (t) => {
    const G = g();
    ui(G).deckAdd.q = t.dataset.name || "";
    if (S.ui.tdeckId) (S.ui.tdeckTab ||= {})[S.ui.tdeckId] = "cards";
    await A.tDeckFind();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  A.tDeckAddClose = () => {
    ui().deckAdd.results = [];
    render();
  };
  A.tDeckAdd = async (t) => {
    const G = g(),
      card = await ensureCard(G, t.dataset.id).catch(() => cardOf(G, t.dataset.id));
    if(!card)return toast("Couldn’t load this card right now.");
    if(t.dataset.upgrade)return reviewUpgrade(card,t.dataset.deck);
    await mutate((st) => addToDeck(st, t.dataset.deck, card), { msg: `${card.name} added.` });
  };
  // Open a card from a name (Play guide lists from tournament decks, which only carry names).
  A.tFindName = async (t) => {
    const G = g(),
      r = await SOURCES[G].search({ q: t.dataset.name, size: 8 }).catch(() => ({ cards: [] })),
      hit = r.cards.find((x) => x.name.toLowerCase() === t.dataset.name.toLowerCase()) || r.cards[0];
    if (hit) A.tCard({ dataset: { id: hit.id } });
    else toast("Couldn’t find that card right now.");
  };
  // Play guide: rank cards that pair well (pairing.js). Candidates: Yu-Gi-Oh! — its archetype,
  // cards named in its text, the race/attribute it supports; Pokémon — its evolution line, role
  // Trainers for what it needs, Pokémon of the types it needs; both — tournament partners.
  const PTCG_ROLE_CARDS = { stage2: ["Rare Candy"], evolution: ["Rare Candy"], switching: ["Switch", "Escape Rope"], energy_accel: ["Earthen Vessel"], basic: ["Nest Ball", "Buddy-Buddy Poffin"] };
  c.guideLoad = async (G, card) => {
    const k = G + ":" + card.id;
    S.ui.guide ||= {};
    if (S.ui.guide[k]) return;
    S.ui.guide[k] = { loading: true };
    const cands = [],
      byName = async (n) => {
        const r = await SOURCES[G].search({ q: n, size: 8 }).catch(() => ({ cards: [] }));
        return r.cards.find((x) => x.name.toLowerCase() === n.toLowerCase()) || null;
      },
      owned = new Set(gs(G).collection.map((e) => e.cardId)),
      add = (c, extra = {}) => c && cands.push({ card: c, owned: owned.has(c.id), ...extra });
    try {
      const al = playedAlongside(G, card, allCachedMeta(), 12);
      if (G === "ygo") {
        const T = ygoTags(card),
          jobs = [];
        if (card.archetype) jobs.push(SOURCES.ygo.search({ archetype: card.archetype, size: 30 }));
        for (const q of T.quoted.slice(0, 2)) jobs.push(SOURCES.ygo.search({ archetype: q, size: 20 }), SOURCES.ygo.search({ q, size: 12 }));
        // Cards whose text names this card, and support for its race and attribute.
        jobs.push(SOURCES.ygo.search({ text: card.name, size: 24 }));
        if (card.category === "Monster" && card.race) jobs.push(SOURCES.ygo.search({ text: card.race, size: 24 }));
        if (card.category === "Monster" && card.attribute) jobs.push(SOURCES.ygo.search({ text: card.attribute, size: 24 }));
        const need = [...T.needs].find((n) => n.startsWith("race:") || n.startsWith("attr:"));
        if (need) jobs.push(SOURCES.ygo.search(need.startsWith("race:") ? { race: need.slice(5), size: 30 } : { attribute: need.slice(5), size: 30 }));
        for (const r of await Promise.all(jobs.map((j) => j.catch(() => ({ cards: [] }))))) for (const x of r.cards) add(x);
        const ids = al.cards.map((x) => x.id).filter(Boolean);
        const got = ids.length ? await SOURCES.ygo.byIds(ids).catch(() => []) : [];
        for (const x of got || []) {
          const a = al.cards.find((y) => y.id === String(x.id));
          add(x, { lift: Math.max(0, (a?.share || 0) - (a?.overall || 0)), share: a?.share || 0 });
        }
        // Fallback: the format's most-played cards (hand traps, generic staples) go in almost any deck.
        if (rankPairs("ygo", card, cands).filter((x) => !x.fallback).length < 4) {
          const top = (metaState("ygo").data?.top || []).slice(0, 12);
          const staples = top.length ? await SOURCES.ygo.byIds(top.map((x) => x.id)).catch(() => []) : [];
          for (const x of staples || []) {
            const tp = top.find((y) => String(y.id) === String(x.id));
            add(x, { fallback: true, why: `format staple — in ${Math.round(tp?.pct || 0)}% of top decks` });
          }
        }
      } else {
        const T = ptcgTags(card),
          names = new Set();
        if (card.evolveFrom) names.add(card.evolveFrom);
        for (const n of T.needs) for (const x of PTCG_ROLE_CARDS[n] || []) names.add(x);
        if (card.stage === "Stage2") names.add("Rare Candy");
        // Basic Energy for the types its attacks need.
        for (const n of T.needs) if (n.startsWith("type:")) names.add(`Basic ${n.slice(5)} Energy`);
        // Two steps down the line: a Stage 2's Basic (Gardevoir ex → Kirlia → Ralts).
        const line = new Set([card.evolveFrom].filter(Boolean));
        if (card.stage === "Stage2" && card.evolveFrom) {
          const mid = await byName(card.evolveFrom).then((b) => b && ensureCard("ptcg", b.id)).catch(() => null);
          if (mid?.evolveFrom) names.add(mid.evolveFrom), line.add(mid.evolveFrom);
        }
        const briefs = (await Promise.all([...names].map(byName))).filter(Boolean);
        // What it evolves into, and cards whose text names it (its own support cards).
        const [into, named] = await Promise.all([card.category === "Pokemon" ? SOURCES.ptcg.evolutions(card.name).catch(() => []) : [], SOURCES.ptcg.mentioning(card.name.replace(/ ex$/, "")).catch(() => [])]);
        briefs.push(...into.slice(0, 3), ...named.slice(0, 8));
        for (const b of into) line.add(b.name);
        const type = [...T.needs].find((n) => n.startsWith("type:"));
        if (type) briefs.push(...(await SOURCES.ptcg.search({ type: type.slice(5), category: "Pokemon", format: "standard", size: 10 }).catch(() => ({ cards: [] }))).cards);
        const alBriefs = (await Promise.all(al.cards.slice(0, 8).map((x) => byName(x.name)))).map((b, i) => b && { b, a: al.cards[i] }).filter(Boolean);
        const full = async (b) => (b.brief ? await ensureCard("ptcg", b.id).catch(() => null) : b);
        // Trainers that support its type ("Psychic Pokémon"), and — for cards that need Evolution
        // Pokémon (Devolution Spray, Rare Candy…) — recent Evolution Pokémon, checked for Abilities.
        const legal = card.legal?.standard ? "standard" : card.legal?.expanded ? "expanded" : "";
        if (card.category === "Pokemon") for (const ty of (card.types || []).slice(0, 1)) briefs.push(...(await SOURCES.ptcg.mentioning(`${ty} Pokémon`).catch(() => [])).slice(0, 8));
        if (T.needs.has("evolution") || T.needs.has("evolve_trigger") || T.needs.has("stage2")) {
          const [s1, s2] = await Promise.all([SOURCES.ptcg.byStage("Stage1", legal).catch(() => []), SOURCES.ptcg.byStage("Stage2", legal).catch(() => [])]);
          briefs.push(...(T.needs.has("stage2") ? [] : s1.slice(0, 12)), ...s2.slice(0, 12));
        }
        for (const b of (await Promise.all(briefs.slice(0, 44).map(full)))) add(b, { line: !!b && line.has(b.name) });
        for (const { b, a } of alBriefs) add(await full(b), { lift: Math.max(0, a.share - a.overall), share: a.share });
        // Fallback: the most-played Trainers in recent tournament decks fit almost any deck.
        if (rankPairs("ptcg", card, cands).filter((x) => !x.fallback).length < 4) {
          const top = (metaState("ptcg").data?.top || []).filter((x) => x.kind === "Trainer" && x.name !== card.name).slice(0, 8);
          const hits = (await Promise.all(top.map((x) => byName(x.name)))).map((b, i) => b && { b, x: top[i] }).filter(Boolean);
          for (const { b, x } of hits) add(await full(b), { fallback: true, why: `format staple — in ${Math.round(x.pct)}% of top decks` });
        }
      }
    } catch {}
    const ranked = rankPairs(G, card, cands, { max: 10 });
    S.ui.guide[k] = {
      cards: ranked.map((p) => ({ name: p.card.name, image: p.card.image || "", attrs: `data-act="tCard" data-id="${esc(p.card.id)}"`, reasons: p.reasons, score: p.score, fallback: p.fallback })),
      note: ranked.length ? "Ranked by how well they fit (what each card needs and gives), tournament pairings and what you own." : "No strong pairings found yet — check the cards played alongside it, or Build decks around it.",
    };
    c.refreshSheet?.();
  };
  A.tDeckEmbSwap = async (t) => {
    const G = g(),
      add = cardOf(G, t.dataset.in);
    if (!add) return;
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck),
        row = d?.zones.main?.find((r) => r.cardId === t.dataset.out);
      if (!row) return;
      row.qty--;
      if (row.qty < 1) d.zones.main = d.zones.main.filter((r) => r !== row);
      addToDeck(st, d.id, add, "main", 1);
    }, { undo: `Swapped ${cardOf(G, t.dataset.out)?.name || "a card"} for ${add.name}.` });
  };
  A.tDeckQty = async (t) => {
    const delta = Number(t.dataset.delta);
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck),
        list = d?.zones[t.dataset.zone] || [],
        row = list.find((r) => r.cardId === t.dataset.id);
      if (!row) return;
      if(delta>0) { addToDeck(st,d.id,cardOf(g(),row.cardId),t.dataset.zone,delta); return; }
      row.qty += delta;
      if (row.qty < 1) d.zones[t.dataset.zone] = list.filter((r) => r !== row);
    }, delta < 0 ? { undo: `−1 ${cardOf(g(), t.dataset.id)?.name || "card"}` } : {});
  };
  A.tDeckMove = async (t) => {
    const G = g();
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck),
        from = t.dataset.zone,
        list = d.zones[from] || [],
        row = list.find((r) => r.cardId === t.dataset.id);
      if (!row) return;
      row.qty--;
      if (row.qty < 1) d.zones[from] = list.filter((r) => r !== row);
      const card = cardOf(G, row.cardId) || { id: row.cardId, name: row.name },
        to = from === "side" ? SOURCES[G].zoneFor(card) : "side";
      addToDeck(st, d.id, card, to);
    }, { undo: `Moved ${cardOf(G, t.dataset.id)?.name || "card"} ${t.dataset.zone === "side" ? "out of" : "to"} the Side Deck.` });
  };
  A.tIssues = (t) => {
    (S.ui.tdeckTab ||= {})[t.dataset.deck] = "cards";
    render();
    setTimeout(() => { const panel=document.querySelector("#tIssuesPanel"); const details=panel?.querySelector("details"); if(details)details.open=true; panel?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 50);
  };
  // ----- matchups -----
  const muDeck = () => gs(g()).decks.find((x) => x.id === S.ui.tdeckId);
  A.tMuRun = async () => {
    const G = g(), d = muDeck();
    if (!d) return;
    const st = muStateT(G, d), f = formatOf(G, META_FORMAT[G]);
    if (st.busy) return;
    const msg = (m) => { st.msg = m; const el = document.querySelector(".build-overlay [role=status]"); if (el) el.textContent = m; };
    Object.assign(st, { busy: true, error: "", msg: "Loading tournament results…" });
    render();
    try {
      const data = await metaFor(G);
      const archs = (data?.archetypes || []).filter((a) => a.share > 0).slice(0, 8),
        lists = archs.map((a) => ({ a, list: data.decks.find((x) => x.key === a.best) })).filter((x) => x.list);
      if (!lists.length) throw Error("No tournament decks to compare with right now.");
      const field = [];
      for (const [i, { a, list }] of lists.entries()) {
        msg(`Loading ${a.name} · ${i + 1} of ${lists.length}`);
        const { zones } = await metaZones(G, list, (m) => msg(`${a.name} · ${m}`), { cheap: false });
        const main = tRows(G, zones.main), extra = tRows(G, zones.extra);
        if (!main.length) continue;
        const prof = profileOf(G, tPower(G, f, main, extra), main, extra);
        if (prof) field.push({ key: list.key, name: a.name, share: a.share, art: G === "ygo" ? (list.cover ? `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(list.cover)}.jpg` : "") : a.icons?.[0] ? ptcgIcon(a.icons[0]) : "", profile: prof });
      }
      calibrateField(field, (a, b, o) => simulateMatchup(G, a, b, o));
      st.field = field;
      st.fieldKey = tcgFieldKey(G);
      fieldStore.set(st.fieldKey, field);
      haptic("success");
    } catch (e) {
      st.error = e.message || "Couldn't load the field.";
    } finally {
      st.busy = false;
      render();
    }
  };
  A.tMuFirst = (t) => { muStateT(g(), muDeck()).first = t.dataset.v !== "second"; render(); };
  A.tMuLog = async (t) => {
    const G = g(), d = muDeck(), st = muStateT(G, d),
      opp = t.dataset.opp || document.querySelector("#tMuOtherName")?.value.trim();
    if (!opp) return;
    st.openName = t.dataset.opp || null;
    if (t.dataset.res === "W") { haptic("success"); celebrate(t); }
    const game = { at: new Date().toISOString(), opp, res: t.dataset.res, first: st.first !== false, sig: listSig(d.zones) };
    await mutate((s2) => { const x = s2.decks.find((y) => y.id === d.id); (x.results ||= []).push(game); }, { msg: `${game.res === "W" ? "Win" : game.res === "L" ? "Loss" : "Draw"} vs ${opp} logged.` });
  };
  A.tMuUndo = async (t) => {
    const d = muDeck();
    await mutate((s2) => { const x = s2.decks.find((y) => y.id === d.id); x.results = (x.results || []).filter((r) => r.at !== t.dataset.at); }, { msg: "Game removed." });
  };
  A.tDeckTab = (t) => {
    (S.ui.tdeckTab ||= {})[t.dataset.deck] = t.dataset.id;
    render();
  };
  C.tStarter = async (t) => {
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck),
        set = new Set(d.starters || []);
      t.checked ? set.add(t.dataset.id) : set.delete(t.dataset.id);
      d.starters = [...set];
    });
  };
  // Sample hands follow each game's opening rules.
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  A.tDraw = (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.deck),
      pile = () => shuffle((d.zones.main || []).flatMap((r) => Array(r.qty).fill(r.cardId))),
      n = Number(t.dataset.n);
    let library = pile(),
      hand = library.splice(0, n),
      mulls = 0,
      prizes = null;
    if (G === "ptcg") {
      const hasBasic = (ids) => ids.some((id) => cardOf(G, id)?.basicPokemon);
      if (!hasBasic(library.concat(hand))) return toast("This deck has no Basic Pokémon, so it can’t start a game.");
      while (!hasBasic(hand) && mulls < 20) {
        mulls++;
        library = pile();
        hand = library.splice(0, 7);
      }
      prizes = library.splice(0, 6);
    }
    S.ui.thand = { deckId: d.id, library, hand, mulls, prizes };
    render();
  };
  A.tDrawOne = () => {
    const h = S.ui.thand;
    if (h?.library.length) h.hand.push(h.library.shift());
    render();
  };
  A.tSnap = async (t) => {
    const label = await askText("Name this version", "Version " + ((gs(g()).decks.find((x) => x.id === t.dataset.deck)?.versions || []).length + 1));
    if (label === null) return;
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck);
      d.versions = [...(d.versions || []), { id: uid(), at: new Date().toISOString(), label: label.trim().slice(0, 60) || "Version", zones: structuredClone(d.zones) }].slice(-30);
    }, { msg: "Version saved." });
  };
  A.tRestore = async (t) => {
    if (!await ask("Restore this version? The current list is saved as a version first.")) return;
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck),
        v = (d.versions || []).find((x) => x.id === t.dataset.id);
      if (!v) return;
      d.versions = [...d.versions, { id: uid(), at: new Date().toISOString(), label: "Before restoring “" + v.label + "”", zones: structuredClone(d.zones) }].slice(-30);
      d.zones = structuredClone(v.zones);
    }, { msg: "Version restored." });
  };
  A.tDelVersion = async (t) => {
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck);
      d.versions = (d.versions || []).filter((v) => v.id !== t.dataset.id);
    });
  };
  // Share links work for every game; the link carries only the deck.
  A.tShare = async (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id),
      author = S.state.settings.authorName || "",
      link = location.origin + location.pathname + "#shared/" + (await encodeShare(sharePayloadTcg(G, d, { author, about: d.about || "" })));
    openSheet(`<div class="sheet-head"><h2>Share this deck</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
      <p class="muted small">Anyone with the link sees the full list with card art, and how much of it they own. Your collection is never included.</p>
      <div class="share-link"><input id="shareLink" readonly value="${esc(link)}" aria-label="Share link"><div class="actions wrap"><button class="btn" data-act="tShareCopy">Copy link</button>${navigator.share ? `<button class="btn ghost" data-act="tShareNative">Share…</button>` : ""}<a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Preview ↗</a></div></div>`, { type: "tshare", link, name: d.name });
  };
  A.tSharedBuild = async () => {
    const sd = S.ui.shared.deck;
    if (!sd?.game) return;
    const d = { id: uid(), name: sd.name + " · my version", format: sd.format, zones: structuredClone(sd.zones), about: sd.about, source: { kind: "Shared deck", author: sd.author, url: location.href.length <= 2000 ? location.href : "" }, createdAt: new Date().toISOString() };
    await commit((s) => {
      s.settings.game = sd.game;
      s.tcg = s.tcg || {};
      s.tcg[sd.game] = s.tcg[sd.game] || blankGame();
      s.tcg[sd.game].decks.push(d);
    }, { msg: "Your version is ready. Your collection is unchanged." });
    go("#tdeck/" + d.id);
  };
  // ----- deck generator -----
  const nameLookups=new Map();
  // The same card at its lowest cost, legal in f: an owned printing first, else the cheapest
  // printing with the same game text (alternate arts and reprints play identically).
  const legalIn = (f) => Object.assign((c) => SOURCES.ptcg.legality(c, f) === "legal", { key: f.id });
  const ptcgCheapest = async (card, f) => {
    if (!card) return card;
    const m = ownedMap("ptcg"), best = await SOURCES.ptcg.cheapestPrint(card, { legal: legalIn(f), owned: (c) => ownedOf("ptcg", c, m) });
    return remember(best);
  };
  const ptcgBest = (name,f) => {
    const key=name.toLowerCase()+"|"+f.id;
    if(nameLookups.has(key))return nameLookups.get(key);
    const task=(async()=>ptcgCheapest(await (async()=>{
      const cached=Object.values(cache.ptcg).filter(c=>!c.brief && c.name.toLowerCase()===name.toLowerCase() && SOURCES.ptcg.legality(c,f)==="legal").sort((a,b)=>(a.prices?.usd ?? Infinity)-(b.prices?.usd ?? Infinity));
      if(cached.length)return await ensureCard("ptcg",cached[0].id).catch(()=>cached[0]);
      const r=await SOURCES.ptcg.search({q:name,size:24}).catch(()=>({cards:[]}));
      const exact=r.cards.filter(x=>x.name.toLowerCase()===name.toLowerCase()).slice(0,8);
      for(const b of exact){const c=await ensureCard("ptcg",b.id).catch(()=>null);if(c&&SOURCES.ptcg.legality(c,f)==="legal")return c;}
      return null;
    })(),f))();
    nameLookups.set(key,task);task.finally(()=>nameLookups.delete(key));return task;
  };
  // Sliding six-worker queue: one slow lookup doesn't block the next batch.
  const inBatches = async (items,n,fn) => {
    const out=new Array(items.length);let next=0;
    await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{
      while(next<items.length){const i=next++;out[i]=await fn(items[i]);}
    }));return out;
  };
  const metaFor = (G) => loadMeta(G).catch(() => null);
  // Generic cards the current tournament decks play most (outside the deck's own archetype).
  const ygoMetaStaples = async (meta, pool) => {
    const top = (meta?.top || []).filter((t) => t.pct >= 10 && !pool.has(t.id)).slice(0, 36);
    if (top.length < 8) return null;
    const have = top.filter((t) => cardOf("ygo", t.id)),
      need = top.filter((t) => !cardOf("ygo", t.id)).map((t) => t.id);
    if (need.length) (await SOURCES.ygo.byIds(need).catch(() => [])).forEach(remember);
    void have;
    return top.map((t) => cardOf("ygo", t.id)).filter(Boolean);
  };
  const ptcgMetaTrainers = (meta) => (meta?.top || []).filter((t) => t.kind === "Trainer" && t.pct >= 25).slice(0, 24).map((t) => [t.name, Math.max(1, Math.min(4, Math.round(t.avg)))]);
  const ptcgMetaBasics = (meta) => (meta?.top || []).filter((t) => t.kind === "Pokemon" && t.pct >= 35).map((t) => t.name);
  const BASIC_TYPES = /^(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal) Energy$/;
  // A tournament list → deck zones of real card ids.
  // cheap: swap each card for its cheapest legal printing (decks you'll buy); Matchups only needs
  // what the cards do, so it skips that step.
  const metaZones = async (G, d, status = () => {}, { cheap = true } = {}) => {
    const zones = { main: [], extra: [], side: [] },
      put = (z, card, qty) => {
        const row = zones[z].find((r) => r.cardId === card.id);
        if (row) row.qty += qty;
        else zones[z].push({ cardId: card.id, name: card.name, qty });
      };
    if (G === "ygo") {
      const need = [...new Set([...(d.main || []), ...(d.extra || []), ...(d.side || [])])].filter((id) => !cardOf("ygo", id));
      if (need.length) {
        status(`Loading ${need.length} cards…`);
        (await SOURCES.ygo.byIds(need)).forEach(remember);
      }
      for (const z of ["main", "extra", "side"]) for (const id of d[z] || []) if (cardOf("ygo", id)) put(z, cardOf("ygo", id), 1);
      return { zones, missed: [...new Set([...(d.main||[]),...(d.extra||[]),...(d.side||[])])].filter(id=>!cardOf("ygo",id)) };
    }
    const std = formatOf("ptcg", "standard"),
      any = formatOf("ptcg", "unlimited"),
      missed = [];
    let n = 0;
    const got = await inBatches(d.list, 6, async (x) => {
      // The list's exact printing is often a full art; the deck gets the same card's cheapest legal
      // printing (or the one you own).
      const listed = BASIC_TYPES.test(x.name) ? await ptcgBest(energyName(x.name.replace(/ Energy$/, "")), any) : await SOURCES.ptcg.tournamentCard(x).catch(()=>null);
      const card = cheap && listed && !BASIC_TYPES.test(x.name) ? await ptcgCheapest(listed, SOURCES.ptcg.legality(listed, std) === "legal" ? std : any) : listed;
      status(`Matching cards ${++n}/${d.list.length}…`);
      if (!card) missed.push(x.name);
      return card ? { card: remember(card), qty: x.qty } : null;
    });
    for (const r of got.filter(Boolean)) put("main", r.card, r.qty);
    return { zones, missed };
  };
  const bestMetaDeckFor = (G, meta, seeds) => {
    const names = seeds.map((s) => s.name.toLowerCase()),
      hits = (d) => (G === "ygo" ? seeds.filter((s) => d.main.includes(s.id) || d.extra.includes(s.id)).length : d.list.filter((r) => names.includes(r.name.toLowerCase())).length);
    return (meta?.decks || [])
      .map((d) => ({ d, n: hits(d) }))
      .filter((x) => x.n === seeds.length)
      .sort((a, b) => b.n - a.n || a.d.rank - b.d.rank)[0]?.d;
  };
  // One evolution line; the first (main) line gets more copies.
  // A Basic or Stage 1 that evolves is built toward its evolution: the meta's pick first, then a
  // Pokémon ex, then the hardest hitter. Impidimp builds Grimmsnarl, not a deck of Impidimp.
  const climb = async (card, f, metaNames, depth = 0) => {
    if (depth > 1 || card.ruleBox || card.stage === "Stage2") return card;
    const ev = await SOURCES.ptcg.evolutions(card.name).catch(() => []);
    const legal = (await Promise.all(ev.slice(0, 6).map((e) => ptcgBest(e.name, f).catch(() => null)))).filter((x) => x && x.evolveFrom === card.name);
    if (!legal.length) return card;
    legal.sort((a, b) => metaNames.has(b.name) - metaNames.has(a.name) || !!b.ruleBox - !!a.ruleBox || attackReach(b) - attackReach(a));
    return climb(legal[0], f, metaNames, depth + 1);
  };
  const lineFor = async (seed, f, main) => {
    const line = [],
      w = main ? [4, 2, 3, 4] : [3, 2, 2, 2];
    if (seed.stage === "Stage2") {
      const s1 = await ptcgBest(seed.evolveFrom, f),
        b = s1?.evolveFrom ? await ptcgBest(s1.evolveFrom, f) : null;
      if (b) line.push({ card: b, want: w[0] });
      if (s1) line.push({ card: s1, want: w[1] });
      line.push({ card: seed, want: w[2] });
    } else if (seed.stage === "Stage1") {
      const b = await ptcgBest(seed.evolveFrom, f);
      if (b) line.push({ card: b, want: w[0] });
      line.push({ card: seed, want: w[3] });
    } else line.push({ card: seed, want: seed.ruleBox ? Math.min(3, w[0]) : w[0] });
    return f.copies === 1 ? line.map((x) => ({ ...x, want: 1 })) : line;
  };
  const runTBuild = async () => {
    const B = S.ui.tbuild,
      G = B.game,
      f = formatOf(G, B.format),
      seed = cardOf(G, B.seed),
      status = (m) => {
        B.msg = m;
        const el = document.querySelector("#sheetBody [role=status]");
        if (el) el.textContent = m;
      };
    if (!seed || B.busy) return;
    B.busy = true;
    B.error = false;
    B.openTier = null;
    B.evidence = "";
    c.refreshSheet();
    try {
      const m = ownedMap(G),
        owned = (card) => ownedOf(G, card, m),
        priceOf = (card) => price(card),
        seeds = (B.seeds || [B.seed]).map((id) => cardOf(G, id)).filter(Boolean);
      status("Checking what tournament decks play right now…");
      const meta = await metaFor(G),budgets=tcgBudgets(B);
      let results = [], upPool = [];
      if (G === "ygo") {
        const archs = [...new Set(seeds.map((x) => x.archetype).filter(Boolean))].slice(0, 3);
        status(archs.length ? `Loading ${archs.join(", ")}…` : "Loading…");
        const arch = (await Promise.all(archs.map((a) => SOURCES.ygo.search({ archetype: a, size: 100 }).then((r) => r.cards).catch(() => [])))).flat().map(remember);
        // Staples: what tournament lists playing these cards run, else the format's most played.
        const poolIds = new Set(arch.map((x) => x.id)),
          seedIds = new Set(seeds.map((x) => x.id)),
          matching = (meta?.decks || []).filter((d) => [...d.main, ...d.extra].some((id) => seedIds.has(id) || poolIds.has(id)));
        let staples = null;
        if (matching.length >= 2) {
          status(`Loading staples from ${matching.length} tournament lists that play ${archs[0] || seed.name}…`);
          const freq = new Map();
          for (const d of matching) for (const id of new Set(d.main)) if (!poolIds.has(id) && !seedIds.has(id)) freq.set(id, (freq.get(id) || 0) + 1);
          const ids = [...freq].filter(([, n]) => n / matching.length >= 0.25).sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 30);
          const need = ids.filter((id) => !cardOf("ygo", id));
          if (need.length) (await SOURCES.ygo.byIds(need).catch(() => [])).forEach(remember);
          staples = ids.map((id) => cardOf("ygo", id)).filter(Boolean);
          B.evidence = `Staples from ${matching.length} tournament lists that play ${archs[0] || seed.name}.`;
        }
        if (!staples?.length) {
          status("Loading staples from current tournament decks…");
          staples = await ygoMetaStaples(meta, poolIds);
          B.evidence = staples ? `No recent tournament list plays ${archs[0] || seed.name}, so staples are the format’s most played generic cards — check they suit the engine.` : "";
        }
        if (!staples?.length) staples = (await SOURCES.ygo.byNames(YGO_STAPLES).catch(() => [])).map(remember).sort((a, b) => YGO_STAPLES.indexOf(a.name) - YGO_STAPLES.indexOf(b.name));
        results = budgets.map((budget) => ({ budget, ...buildYgo({ f, seed, seeds, archetype: arch, staples, limit: SOURCES.ygo.limit, legal: SOURCES.ygo.legality, owned, price: priceOf, budget }) }));
        upPool = [...staples, ...arch];
      } else {
        const line = [];
        let climbNote = "";
        for (const [i, p] of seeds.filter((x) => x.category === "Pokemon").slice(0, 3).entries()) {
          status(`Finding the evolution line for ${p.name}…`);
          const top = i === 0 ? await climb(p, f, new Set((meta?.decks || []).flatMap((d) => (d.list || []).filter((r) => r.kind === "Pokemon").map((r) => r.name)))) : p;
          if (top !== p) climbNote = `${p.name} evolves into ${top.name}, so the deck is built to attack with ${top.name}.`;
          for (const x of await lineFor(top, f, i === 0)) if (!line.some((y) => y.card.id === x.card.id)) line.push(x);
        }
        // Enough Basic Pokémon (about 10) that most opening hands have one — the meta's favourites first.
        status("Adding support Pokémon…");
        let basics = line.filter((x) => x.card.basicPokemon).reduce((a, x) => a + x.want, 0);
        const lineTypes = new Set(line.flatMap((x) => x.card.attackCosts || []));
        for (const n of [...new Set([...ptcgMetaBasics(meta), ...PTCG_SUPPORT_BASICS])]) {
          if (basics >= 10) break;
          const card = await ptcgBest(n, f);
          // Skip support whose Ability needs an Energy type this deck won't run (Munkidori without Darkness).
          if (card?.basicPokemon && !line.some((y) => y.card.id === card.id) && abilityEnergy(card).every((t) => lineTypes.has(t))) {
            const want = f.copies === 1 ? 1 : Math.min(2, 10 - basics);
            line.push({ card, want });
            basics += want;
          }
        }
        const chosen = seeds.filter((x) => x.category === "Trainer").map((card) => ({ card, want: f.copies === 1 ? 1 : Math.min(4, Math.max(2, owned(card))) }));
        const lineNames = new Set(line.map((x) => x.card.name.toLowerCase())),
          matching = (meta?.decks || []).filter((d) => d.list.some((r) => r.kind === "Pokemon" && lineNames.has(r.name.toLowerCase())) && seeds.some((x) => d.list.some((r) => r.name.toLowerCase() === x.name.toLowerCase())));
        let metaT = ptcgMetaTrainers(meta);
        if (matching.length >= 2) {
          const freq = new Map();
          for (const d of matching) for (const r of d.list) if (r.kind === "Trainer") freq.set(r.name, { n: (freq.get(r.name)?.n || 0) + 1, copies: (freq.get(r.name)?.copies || 0) + r.qty });
          const own = [...freq].filter(([, v]) => v.n / matching.length >= 0.3).sort((a, b) => b[1].n - a[1].n).map(([name, v]) => [name, Math.max(1, Math.min(4, Math.round(v.copies / v.n)))]);
          // Top up a short list with the format's most played Trainers.
          metaT = [...own, ...metaT.filter(([n]) => !own.some(([m]) => m === n))].slice(0, Math.max(own.length, 18));
          B.evidence = `Trainers from ${matching.length} Top 8 lists that play ${seed.name}.`;
        } else B.evidence = metaT.length >= 8 ? `No recent Top 8 list plays ${seed.name}, so Trainers are the format’s most played — check they suit the deck.` : "";
        if (climbNote) B.evidence = (climbNote + " " + (B.evidence || "")).trim();
        const wanted = [...(line.some((x) => x.card.stage === "Stage2") && !metaT.some(([n]) => n === "Rare Candy") ? [["Rare Candy", 4]] : []), ...(metaT.length >= 8 ? metaT : PTCG_STAPLES)].filter(([n]) => !chosen.some((x) => x.card.name === n));
        status(`Finding Trainers ${metaT.length >= 8 ? "today’s top decks play" : "staples"} legal in ${f.name}…`);
        const got = await inBatches(wanted, 6, ([n, want]) => ptcgBest(n, f).then((card) => (card ? { card, want: f.copies === 1 ? 1 : want } : null)));
        const trainers = [...chosen, ...got.filter(Boolean)];
        const types = [...new Set(line.flatMap((x) => x.card.attackCosts || []))].filter((t) => t in { Grass: 1, Fire: 1, Water: 1, Lightning: 1, Psychic: 1, Fighting: 1, Darkness: 1, Metal: 1 });
        const energy = (await Promise.all((types.length ? types : (seed.types || []).slice(0, 1)).slice(0, 2).map((t) => ptcgBest(energyName(t), formatOf("ptcg", "unlimited"))))).filter(Boolean);
        results = budgets.map((budget) => ({ budget, ...buildPtcg({ line, trainers, energy, owned: (card) => (card.basicEnergy ? 99 : owned(card)), price: priceOf, budget }) }));
        upPool = trainers.map((x) => x.card);
      }
      // Tournament decks compete for every affordable tier, rather than being a disconnected extra row.
      const proven=[];
      const formatMeta=meta && f.id === (G==='ygo'?'tcg':'standard');
      const matches=formatMeta ? (meta.decks || []).filter(d=>seeds.every(seed=>G==='ygo'?[...(d.main||[]),...(d.extra||[])].includes(seed.id):(d.list||[]).some(r=>r.name.toLowerCase()===seed.name.toLowerCase()))).sort((a,b)=>(a.rank||99)-(b.rank||99)).slice(0,4) : [];
      for(const mt of matches){
        status(`Evaluating tournament candidate ${proven.length+1}/${matches.length}…`);
        const {zones,missed}=await metaZones(G,mt,status);
        if(missed.length)continue;
        proven.push({proven:mt.key,source:{kind:'Tournament list',url:mt.url,description:mt.event},label:`${mt.place || 'Placing list'} · ${mt.event || mt.name}`,zones,total:zones.main.reduce((a,r)=>a+r.qty,0),size:G==='ygo'?f.main[0]:60,warnings:[]});
      }
      const base=B.baseDeck ? gs(G).decks.find(d=>d.id===B.baseDeck && d.format===f.id) : null;
      if(base)proven.push({...structuredClone(base),label:'Your current deck',total:base.zones.main.reduce((a,r)=>a+r.qty,0),size:G==='ygo'?f.main[0]:60,warnings:[]});
      const rows=d=>Object.values(d.zones).flat(),evaluate=d=>tcgPower(G,{...d,id:'builder:'+G,format:f.id},f,id=>cardOf(G,id)),cost=d=>purchaseCost(rows(d),{owned:r=>cardOf(G,r.cardId)?.basicEnergy?r.qty:owned(cardOf(G,r.cardId)),price:r=>priceOf(cardOf(G,r.cardId))});
      const seedKeys=new Set(seeds.map(s=>s.id)),targets=[...proven,...results.slice(-1)];
      const candidates=await refineCandidates([...results,...proven],{evaluate,cost,status,rounds:2,maxNeighbors:12,
       accept:d=>!SOURCES[G].validate(d,id=>cardOf(G,id),f).some(x=>x.level==='bad'),
       neighbors:d=>targets.flatMap(target=>towardDeck(d,target,{protectedKeys:seedKeys,zoneOf:r=>G==='ptcg'?cardOf(G,r.cardId)?.category:'main'}))});
      results=bestBudgetDecks(candidates,budgets,{
        evaluate,cost,
        accept:d=>seeds.every(seed=>rows(d).some(r=>r.cardId===seed.id || (G==='ptcg' && sameCardLogic(G,cardOf(G,r.cardId),seed))))
      }).map((winner,i)=>winner || results[i]);
      // Spend toward each budget: stronger cards for the same deck until it's within $10 of the
      // budget, as long as Power holds. Yu-Gi-Oh! keeps its archetype engine; Pokémon keeps its
      // Pokémon and Energy and upgrades Trainers.
      const engineArch = G === "ygo" ? seed.archetype || "" : "",
        trows = (d) => (d.zones.main || []).map((r) => ({ key: r.cardId, zone: "main", qty: r.qty, card: cardOf(G, r.cardId) || { name: r.name, id: r.cardId } })),
        tswap = (d, w, card, n) => { let out = d; for (let k = 0; k < n; k++) out = swappedZones(out, "main", w.key, card); return { ...out, proven: null }; },
        // Never trade away what makes the deck run: Rare Candy in a Stage 2 deck, and any card most
        // tournament lists play (a core staple), besides the engine itself.
        tprotect = (r) => seedKeys.has(r.key) || playRate(G, r.card) >= 25 || (G === "ptcg" ? r.card?.category !== "Trainer" || /^Rare Candy$/i.test(r.card?.name || "") : !!engineArch && r.card?.archetype === engineArch),
        tquality = (card) => cardQuality(playRate(G, card), priceOf(card)),
        accept2 = (d) => !SOURCES[G].validate(d, (id) => cardOf(G, id), f).some((x) => x.level === "bad");
      for (const [i, t] of results.entries()) {
        if (!t?.zones || !budgets[i]) continue;
        // First fill any open slots with the best affordable cards the budget allows.
        const mainCount = (d) => (d.zones.main || []).reduce((a, r) => a + r.qty, 0),
          deckSize = G === "ygo" ? f.main[0] : 60;
        if (mainCount(t) < deckSize) {
          // A part-built deck always fails the size rule; only refuse cards that add a new problem.
          const bad = (d) => SOURCES[G].validate(d, (id) => cardOf(G, id), f).filter((x) => x.level === "bad" && !/\b(?:cards?|Main Deck)\b[^.]*\b(?:needs?|has|must|exactly)\b|\bneeds? \d+|\b\d+ cards?\b/i.test(x.text)).length,
            baseBad = bad(t);
          const filled = fillOpen(t, budgets[i], { pool: upPool, quality: tquality, count: mainCount, size: deckSize, cost, tolerance:0, accept: (d) => bad(d) <= baseBad, maxCopies: (card) => SOURCES[G].limit(card, f), have: (d, card) => (d.zones.main || []).filter((r) => r.cardId === card.id).reduce((a, r) => a + r.qty, 0), add: (d, card) => { const main = structuredClone(d.zones.main || []), hit = main.find((r) => r.cardId === card.id); if (hit) hit.qty++; else main.push({ cardId: card.id, name: card.name, qty: 1 }); return { ...d, zones: { ...d.zones, main }, proven: null }; } });
          if (filled !== t) {
            const pw = evaluate(filled);
            results[i] = { ...filled, total: mainCount(filled), open: Math.max(0, deckSize - mainCount(filled)), assessment: pw, power: pw.score };
          }
        }
        const t2 = results[i];
        const up = await spendUp(t2, budgets[i], { pool: upPool, quality: tquality, rows: trows, swap: tswap, cost, evaluate, accept: accept2, protect: tprotect, tolerance:0, maxCopies: (card) => SOURCES[G].limit(card, f), status });
        if (up.swaps.length) results[i] = { ...t2, ...up.deck, cost: up.cost, assessment: up.power, power: up.power.score, upgrades: up.swaps };
        // Yu-Gi-Oh!: a fuller Extra Deck is the next best use of the money (more lines and outs).
        if (G === "ygo" && budgets[i]) {
          let d = results[i];
          const cap = budgets[i],
            ext = upPool.filter((x) => x?.extra && SOURCES.ygo.legality(x, f) !== "not_legal").sort((a, b) => tquality(b) - tquality(a)),
            added = [];
          for (const x of ext) {
            const extra = d.zones.extra || [], n = extra.reduce((a, r) => a + r.qty, 0);
            if (n >= (f.extra || 15)) break;
            const have = extra.filter((r) => r.cardId === x.id).reduce((a, r) => a + r.qty, 0);
            if (have >= SOURCES.ygo.limit(x, f)) continue;
            const next = { ...d, zones: { ...d.zones, extra: have ? extra.map((r) => (r.cardId === x.id ? { ...r, qty: r.qty + 1 } : r)) : [...extra, { cardId: x.id, name: x.name, qty: 1 }] } },
              q = cost(next);
            if (q.unknown || q.cost > cap || !accept2(next)) continue;
            d = { ...next, cost: q.cost };
            added.push(x.name);
          }
          if (added.length) {
            const pw = evaluate(d);
            results[i] = { ...d, assessment: pw, power: pw.score, upgrades: [...(results[i].upgrades || []), ...added.map((n) => ({ out: "empty Extra Deck slot", in: n, n: 1 }))] };
          }
        }
      }
      results = variantsFrom(budgetNotes(results.map((t) => t && asShown(t)), budgets), budgets, (d) => difficultyOf((d.zones?.main || []).map((r) => { const card = cardOf(G, r.cardId); return { qty: r.qty, text: !card || card.basicEnergy ? null : card.text || card.effect || "" }; })));
      B.evidence += ` Compared ${candidates.length} candidates with Power, legality, engine readiness and your purchase cost. Higher budgets retain the best affordable lower-budget candidate.`;
      B.results[B.format] = results;
      B.msg = `${results.length} budget versions · ${proven.filter(x=>x.proven).length} complete tournament candidates evaluated.`;
    } catch (e) {
      B.msg = e.message;
      B.error = true;
    } finally {
      B.busy = false;
      c.refreshSheet();
    }
  };
  const openBuild = (G, ids, metaKey = "",baseDeck=null,requestedFormat="") => {
    const cards = ids.map((id) => cardOf(G, id)).filter(Boolean);
    // Pokémon decks are built around Pokémon; put them first.
    cards.sort((a, b) => (G === "ptcg" ? (b.category === "Pokemon") - (a.category === "Pokemon") : 0));
    const fmts = buildable(G, cards[0]);
    S.ui.tbuild = { game: G, seed: cards[0]?.id, seeds: cards.map((x) => x.id), format: baseDeck?.format || fmts.find(f=>f.id===requestedFormat)?.id || fmts[0]?.id || "",baseDeck:baseDeck?.id, results: {}, busy: false, msg: "", openTier: null, metaKey };
    openSheet(tcgBuildSheet(), { type: "tbuild" });
    if (fmts.length) runTBuild();
  };
  A.tOptimizeDeck = async t => {
    const G=g(),d=gs(G).decks.find(x=>x.id===t.dataset.deck);if(!d)return;
    await ensureMany(G,Object.values(d.zones || {}).flat().map(r=>r.cardId));
    const anchors=d.zones.main.filter(r=>{const card=cardOf(G,r.cardId);return G==='ptcg'?card?.category==='Pokemon':card?.category==='Monster' && !!card.archetype;}).sort((a,b)=>b.qty-a.qty);
    const anchor=anchors[0] || d.zones.main[0];if(!anchor)return;
    openBuild(G,[anchor.cardId],"",d);
  };
  A.tBuild = async (t) => {
    const G = g(),
      card = await ensureCard(G, t.dataset.id);
    openBuild(G, [card.id]);
  };
  // Build around several cards at once (e.g. everything you own from one archetype).
  A.tBuildMulti = async (t) => {
    const G = g(),
      ids = String(t.dataset.ids || "").split(",").filter(Boolean).slice(0, 60);
    if (!ids.length) return toast("Pick at least one card.");
    const done = busy(t, "Loading…");
    try {
      await ensureMany(G, ids.slice(0, 12));
      openBuild(G, ids);
    } finally {
      done();
    }
  };
  A.tBuildFormat = (t) => {
    const B = S.ui.tbuild;
    B.format = t.dataset.format;
    if (B.results[B.format]) c.refreshSheet();
    else runTBuild();
  };
  C.tBuildCustom = t => {
    const B=S.ui.tbuild;if(B.busy)return;
    B.custom=t.value===''?'':String(Math.max(0,Math.min(100000,Number(t.value)||0)));
    B.results={};runTBuild();
  };
  A.tTierAlternative = t => {
    const B=S.ui.tbuild,n=B.results[B.format]?.[Number(t.dataset.i)]?.nextUpgrade;if(!n)return;
    B.results[B.format].push({...n,nextUpgrade:null,explanation:'Outside the original budget. Review the actual purchase total before saving.',warnings:[...(n.warnings || [])]});
    B.openTier=B.results[B.format].length-1;c.refreshSheet();
  };
  A.tTier = (t) => {
    const B = S.ui.tbuild,
      i = Number(t.dataset.i);
    B.openTier = B.openTier === i ? null : i;
    c.refreshSheet();
    // Bring the opened list into view so it's clear what happened.
    if (B.openTier === i)
      requestAnimationFrame(() => {
        const tier = document.querySelectorAll("#sheetBody .tier")[i],
          body = document.getElementById("sheetBody"),
          head = body?.querySelector(".sheet-head");
        if (tier && body) body.scrollTo({ top: body.scrollTop + tier.getBoundingClientRect().top - body.getBoundingClientRect().top - (head?.offsetHeight || 64) - 8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
  };
  A.tTierSave = async (t) => {
    const B = S.ui.tbuild,
      tier = B.results[B.format][Number(t.dataset.i)],
      seed = cardOf(B.game, B.seed),
      many = (B.seeds?.length || 1) > 1 ? ` + ${B.seeds.length - 1} more` : "",
      d = { id: uid(), name: `${seed.name}${many} · ${formatOf(B.game, B.format).name} · ${tierName(tier).toLowerCase()}`, format: B.format, zones: structuredClone(tier.zones), createdAt: new Date().toISOString(), source: tier.source || { kind: tier.meta || tier.proven ? "Tournament list" : "Generated" } };
    await mutate((st) => st.decks.push(d), { msg: `Saved “${d.name}” to your decks.` });
  };
  const tierDeck = (i) => {
    const B = S.ui.tbuild, tier = B.results[B.format]?.[Number(i)], seed = cardOf(B.game, B.seed);
    if (!tier || !seed) return null;
    const many = (B.seeds?.length || 1) > 1 ? ` + ${B.seeds.length - 1} more` : "";
    return { tier, d: { id: uid(), name: `${seed.name}${many} · ${formatOf(B.game, B.format).name} · ${tierName(tier).toLowerCase()}`, format: B.format, zones: structuredClone(tier.zones), createdAt: new Date().toISOString(), source: tier.source || { kind: "Generated", description: `Built by CardStashy around ${seed.name}.` } } };
  };
  // Save, then open the new deck on the tab you asked for (Matchups, Playtest).
  A.tTierSaveGo = async (t) => {
    const x = tierDeck(t.dataset.i);
    if (!x) return;
    await mutate((st) => st.decks.push(x.d), { msg: `Saved “${x.d.name}”.` });
    (S.ui.tdeckTab ||= {})[x.d.id] = t.dataset.to;
    closeSheet();
    go("#tdeck/" + x.d.id);
  };
  A.tTierCopy = (t) => {
    const x = tierDeck(t.dataset.i), G = S.ui.tbuild.game;
    if (x) copyText(SOURCES[G].exportText(x.d, (id) => cardOf(G, id)), "Deck list copied.");
  };
  // The cards this version needs that you don't own, copied for TCGplayer's Mass Entry.
  A.tTierBuy = async (t) => {
    const x = tierDeck(t.dataset.i), G = S.ui.tbuild.game;
    if (!x) return;
    const m = ownedMap(G), rows = [];
    for (const r of [...x.tier.zones.main, ...(x.tier.zones.extra || [])]) {
      const c = cardOf(G, r.cardId), need = c?.basicEnergy ? 0 : Math.max(0, r.qty - ownedOf(G, c, m));
      if (need) rows.push({ qty: need, name: r.name, ...massSet(G, c) });
    }
    const lines = await massLines(G, rows);
    if (!(await buyOnTcgplayer(G, lines))) toast("You own every card in this version.");
  };
  A.tTierSaveAll = async () => {
    const B = S.ui.tbuild,
      tiers = B.results[B.format] || [],
      seed = cardOf(B.game, B.seed),
      many = (B.seeds?.length || 1) > 1 ? ` + ${B.seeds.length - 1} more` : "",
      ds = tiers.map((tier) => ({ id: uid(), name: `${seed.name}${many} · ${formatOf(B.game, B.format).name} · ${tierName(tier).toLowerCase()}`, format: B.format, zones: structuredClone(tier.zones), createdAt: new Date().toISOString(), source: tier.source || { kind: tier.meta || tier.proven ? "Tournament list" : "Generated" } }));
    await mutate((st) => st.decks.push(...ds), { msg: `Saved ${ds.length} decks to My decks.` });
  };

  // ----- meta decks & ideas -----
  let metaCardsLoading = false;
  // Load the meta (and, for Yu-Gi-Oh!, the cards in it, for names and prices).
  c.loadMeta = async (G, force = false) => {
    const M = metaState(G);
    if (M.busy) return;
    const p = loadMeta(G, force).catch(() => null);
    setTimeout(render, 0);
    const data = await p;
    render();
    if (G === "ygo" && data && !metaCardsLoading) {
      const need = [...new Set(data.decks.flatMap((d) => [...d.main, ...d.extra]))].filter((id) => !cardOf("ygo", id));
      if (need.length) {
        metaCardsLoading = true;
        try {
          (await SOURCES.ygo.byIds(need)).forEach(remember);
        } catch {}
        metaCardsLoading = false;
        if (S.ui.view === "decks" && game() === "ygo") render();
      }
    }
  };
  A.tMetaRefresh = () => c.loadMeta(g(), true);
  // ----- closest proven deck -----
  const refreshProven = () => S.ui.sheetCtx?.type === "proven" && openSheet(provenSheetHtml(), S.ui.sheetCtx, document.querySelector("#sheetBody")?.scrollTop || 0);
  c.refreshProven = refreshProven;
  c.openProven = async (spec) => {
    Object.assign(proven, { spec, mode: "original", budget: 0, busy: true, msg: "Loading prices…", last: null });
    const sctx = { type: "proven", key: spec.key };
    openSheet(provenSheetHtml(), sctx);
    try {
      await spec.load?.((m) => {
        proven.msg = m;
        const el = document.querySelector("#sheetBody [role=status]");
        if (el) el.textContent = m;
      });
      proven.msg = "";
    } catch (e) {
      proven.msg = "Some prices couldn’t load: " + e.message;
    } finally {
      proven.busy = false;
      if (S.ui.sheetCtx === sctx) refreshProven();
    }
  };
  A.provenMode = (t) => {
    proven.mode = t.dataset.id;
    refreshProven();
  };
  A.provenBudget = (t) => {
    proven.budget = Number(t.dataset.b);
    refreshProven();
  };
  A.provenSave = async (t) => {
    const spec = proven.current;
    if (!spec) return;
    const rows = proven.mode === "budget" ? proven.last?.rows || spec.rows : proven.mode === "draft" ? ownedDraft(spec.rows).rows : spec.rows,
      label = proven.mode === "budget" ? "budget adaptation" : proven.mode === "draft" ? "my cards draft" : "original";
    if (!rows.length) return toast("Nothing to save yet — you don’t own any of these cards.");
    const done = busy(t, "Saving…");
    try {
      await spec.save(rows, label);
    } catch (e) {
      toast(e.message);
    } finally {
      done();
    }
  };

  const pkByName = new Map();
  const tcgProvenSpec = (G, d) => {
    const meta = metaState(G).data,
      m = ownedMap(G),
      genericKeys = new Set((meta?.top || []).filter((x) => x.pct >= 30).map((x) => (G === "ygo" ? x.id : x.name)));
    let rowsOf, save, load, evidence, attribution;
    if (G === "ygo") {
      rowsOf = (deck) => {
        const counts = new Map();
        for (const id of [...deck.main, ...deck.extra]) counts.set(id, (counts.get(id) || 0) + 1);
        return [...counts].map(([id, qty]) => {
          const card = cardOf("ygo", id);
          return { key: id, name: card?.name || "Card " + id, qty, kind: card ? (card.extra ? "Extra" : card.category) : "?", price: card ? price(card) : null, owned: m.get("id:" + id) || 0, zone: card?.extra ? "extra" : "main", core: !!card?.archetype, group: card?.archetype || "" };
        });
      };
      load = async (status) => {
        const need = [...new Set(meta.decks.flatMap((x) => [...x.main, ...x.extra]))].filter((id) => !cardOf("ygo", id));
        if (need.length) {
          status(`Loading ${need.length} cards…`);
          (await SOURCES.ygo.byIds(need)).forEach(remember);
        }
      };
      save = async (rows, label) => {
        const zones = { main: [], extra: [], side: [] };
        for (const r of rows) zones[r.zone === "extra" ? "extra" : "main"].push({ cardId: r.key, name: r.name, qty: r.qty });
        const deck = { id: uid(), name: `${d.name} · ${label}`.slice(0, 100), format: "tcg", zones, createdAt: new Date().toISOString(), source: { kind: label === "original" ? "Tournament list" : "Adapted tournament list", author: d.player, url: d.url } };
        await mutate((st) => st.decks.push(deck), { msg: `Saved “${deck.name}”.` });
        closeSheet();
        go("#tdeck/" + deck.id);
      };
      evidence = `Tournament-backed · Advanced (TCG) · ${esc(d.place)} at ${esc(cleanName(d.event))}${d.players ? ` (${d.players} players)` : ""} · compared with ${meta.decks.length} recent top lists`;
      attribution = `Decklists from <a href="https://ygoprodeck.com/category/format/tournament%20meta%20decks" target="_blank" rel="noopener">YGOPRODeck Tournament Meta Decks</a>. Prices are TCGplayer market estimates.`;
    } else {
      const byName = new Map();
      for (const e of gs(G).collection) byName.set(e.name.toLowerCase(), (byName.get(e.name.toLowerCase()) || 0) + e.qty);
      rowsOf = (deck) =>
        deck.list.map((r) => {
          const basic = isBasicEnergyName(r.name),
            card = pkByName.get(r.name);
          return { key: r.name, name: r.name, qty: r.qty, kind: r.kind, price: basic ? 0 : card ? price(card) : null, owned: basic ? r.qty : byName.get(r.name.toLowerCase()) || 0, core: r.kind === "Pokemon" };
        });
      const resolve = async (names, status) => {
        const std = formatOf("ptcg", "standard"),
          any = formatOf("ptcg", "unlimited"),
          todo = [...new Set(names)].filter((n) => !pkByName.has(n));
        let i = 0;
        await inBatches(todo, 6, async (n) => {
          const card = isBasicEnergyName(n) ? await ptcgBest(energyName(n.replace(/^Basic /, "").replace(/ Energy$/, "")), any) : (await ptcgBest(n, std)) || (await SOURCES.ptcg.byName(n).catch(() => null));
          pkByName.set(n, card ? remember(card) : null);
          status(`Matching cards ${++i}/${todo.length}…`);
        });
      };
      load = async (status) => {
        const sim = similarLists(rowsOf(d), meta.decks.map(rowsOf));
        await resolve([...d.list.map((r) => r.name), ...swapPool(rowsOf(d), sim).map((r) => r.name)], status);
      };
      save = async (rows, label) => {
        await resolve(rows.map((r) => r.name), () => {});
        const zones = { main: [], extra: [], side: [] },
          missed = [];
        for (const r of rows) {
          const card = pkByName.get(r.name);
          if (!card) missed.push(r.name);
          else {
            const row = zones.main.find((x) => x.cardId === card.id);
            if (row) row.qty += r.qty;
            else zones.main.push({ cardId: card.id, name: card.name, qty: r.qty });
          }
        }
        const deck = { id: uid(), name: `${d.name} · ${label}`.slice(0, 100), format: "standard", zones, createdAt: new Date().toISOString(), source: { kind: label === "original" ? "Tournament list" : "Adapted tournament list", author: d.player, url: d.url } };
        await mutate((st) => st.decks.push(deck), { msg: missed.length ? `Saved. Not found: ${missed.slice(0, 3).join(", ")}` : `Saved “${deck.name}”.` });
        closeSheet();
        go("#tdeck/" + deck.id);
      };
      evidence = `Tournament-backed · Standard · ${esc(d.place)} at ${esc(cleanName(d.event))} (${d.players} players) · compared with ${meta.decks.length} Top 8 lists from ${meta.events?.length || "recent"} events in the last 21 days`;
      attribution = `Decklists from <a href="https://play.limitlesstcg.com" target="_blank" rel="noopener">Limitless</a>. Prices are TCGplayer market estimates; basic Energy counts as owned.`;
    }
    return {
      g: G,
      key: d.key,
      title: d.name,
      sub: `${esc(d.place)} · ${esc(cleanName(d.event))}${d.players ? ` · ${d.players} players` : ""}${d.player ? ` · ${esc(d.player)}` : ""}${d.date ? ` · ${esc(d.date)}` : ""}`,
      evidence,
      attribution,
      sourceUrl: d.url,
      sourceLabel: G === "ygo" ? "YGOPRODeck" : "Limitless",
      rowsFn: () => rowsOf(d),
      listsFn: () => meta.decks.map(rowsOf),
      generic: (k) => genericKeys.has(k),
      load,
      save,
      imageFor: (r) => (G === "ygo" ? (cardOf("ygo", r.key)?.image ? ygoImageDirect(r.key) : "") : pkByName.get(r.name)?.image || ""),
      heroFor: (rows) => {
        if (G === "ygo") {
          const id = d.cover || rows.find((r) => r.core)?.key;
          return id ? `https://images.ygoprodeck.com/images/cards_cropped/${encodeURIComponent(id)}.jpg` : "";
        }
        const top = rows.filter((r) => r.kind === "Pokemon").map((r) => pkByName.get(r.name)).find((x) => x?.ruleBox) || rows.map((r) => pkByName.get(r.name)).find(Boolean);
        return top?.imageLarge || "";
      },
      cardAttrs: (r) => (G === "ygo" ? `data-act="tCard" data-id="${esc(r.key)}"` : pkByName.get(r.name) ? `data-act="tCard" data-id="${esc(pkByName.get(r.name).id)}"` : `data-act="tOtherPrintings" data-name="${esc(r.name)}"`),
      extraActions: `<button class="btn ghost" data-act="tMetaBuild" data-key="${esc(d.key)}">⚒ Build around it</button>`,
    };
  };
  A.tMuSee = async (t) => {
    const G = g();
    if (!metaState(G).data) await metaFor(G);
    if (!metaState(G).data?.decks?.some((x) => x.key === t.dataset.key)) return toast("That tournament list is no longer in the current results. Simulate again to refresh the field.");
    A.tMetaDeck(t);
  };
  A.tMetaDeck = (t) => {
    const G = g(),
      d = metaState(G).data?.decks.find((x) => x.key === t.dataset.key);
    if (d) c.openProven(tcgProvenSpec(G, d));
  };
  // Budget versions of a tournament deck: build around its signature cards.
  A.tMetaBuild = async (t) => {
    const G = g(),
      d = metaState(G).data?.decks.find((x) => x.key === t.dataset.key);
    if (!d) return;
    const done = busy(t, "Loading…");
    try {
      const { zones } = await metaZones(G, d);
      const meta = metaState(G).data,
        common = new Set((meta?.top || []).filter((x) => x.pct >= 25).map((x) => (G === "ygo" ? x.id : x.name))),
        sig = zones.main
          .map((r) => cardOf(G, r.cardId))
          .filter((card) => card && !common.has(G === "ygo" ? card.id : card.name) && (G === "ygo" ? card.archetype : card.category === "Pokemon"))
          .slice(0, 8);
      if (!sig.length) throw Error("Couldn’t find this deck’s signature cards.");
      closeSheet();
      openBuild(G, sig.map((x) => x.id), d.key);
    } catch (e) {
      toast(e.message);
    } finally {
      done();
    }
  };
  // Build from the cards you own: your strongest group, or the cards you pick.
  A.tBuildAuto = (t) => {
    const top = collectionGroups(g())[0];
    if (!top) return toast("Add some cards to your collection first.");
    t.dataset.ids = top.ids.join(",");
    A.tBuildMulti(t);
  };
  A.tPickSeeds = () => {
    S.ui.seedPick = new Set();
    openSheet(tcgPickSheet(), { type: "tpick" });
  };
  C.tSeedToggle = (t) => {
    const set = (S.ui.seedPick ||= new Set());
    if (t.checked) set.add(t.value);
    else set.delete(t.value);
    const b = document.querySelector("#seedGo");
    if (b) {
      b.textContent = set.size ? `⚒ Build with ${set.size} card${set.size === 1 ? "" : "s"}` : "Pick cards to build around";
      b.dataset.ids = [...set].join(",");
      b.disabled = !set.size;
    }
  };
  I.tSeedQ = (t) => {
    const q = t.value.trim().toLowerCase();
    for (const row of document.querySelectorAll(".seed-row")) row.hidden = !!q && !row.dataset.name.includes(q);
  };
  A.tSeedGo = (t) => {
    closeSheet();
    A.tBuildMulti(t);
  };
  A.tShareCopy = () => copyText(S.ui.sheetCtx?.link || "", "Link copied.");
  A.tShareNative = async () => {
    try {
      await navigator.share({ title: S.ui.sheetCtx?.name || "Deck", url: S.ui.sheetCtx?.link });
    } catch {}
  };
  A.tDeckMenu = (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id);
    openSheet(
      `<div class="sheet-head"><h2>Deck options</h2><button class="icon" data-act="closeSheet">✕</button></div>
      <div class="grid2"><label class="span2">Name<input id="tDmName" maxlength="100" value="${esc(d.name)}"></label><label class="span2">Format<select id="tDmFormat">${options(formatsOf(G).map((f) => [f.id, f.name]), d.format)}</select></label></div>
      <button class="btn block" data-act="tDeckSave" data-id="${esc(d.id)}">Save</button>
      <div class="menu-list"><button data-act="tShare" data-id="${esc(d.id)}">🔗 Share this deck (link)</button><button data-act="tDeckExport" data-id="${esc(d.id)}">↓ Export ${SOURCES[G].exportExt === "ydk" ? ".ydk" : "list"}</button><button data-act="tDeckCopy" data-id="${esc(d.id)}">⧉ Copy list</button><button data-act="tDeckDup" data-id="${esc(d.id)}">⧉ Duplicate</button><button class="danger" data-act="tDeckDelete" data-id="${esc(d.id)}">✕ Delete deck</button></div>`,
      { type: "tdeckmenu" },
    );
  };
  A.tDeckSave = async (t) => {
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.id);
      d.name = document.querySelector("#tDmName").value.trim().slice(0, 100) || d.name;
      d.format = document.querySelector("#tDmFormat").value;
    }, { msg: "Saved." });
    closeSheet();
  };
  A.tDeckDup = async (t) => {
    const d = structuredClone(gs(g()).decks.find((x) => x.id === t.dataset.id));
    d.id = uid();
    d.name += " (copy)";
    await mutate((st) => st.decks.push(d), { msg: "Duplicated." });
    closeSheet();
    go("#tdeck/" + d.id);
  };
  A.tDeckDelete = async (t) => {
    if (!await ask("Delete this deck? Your collection isn’t affected.")) return;
    const name = gs(g()).decks.find((x) => x.id === t.dataset.id)?.name || "deck";
    await mutate((st) => (st.decks = st.decks.filter((x) => x.id !== t.dataset.id)), { undo: `Deleted ${name}.` });
    closeSheet();
    go("#decks");
  };
  const listText = (d) => ["main", "extra", "side"].flatMap((z) => ((d.zones[z] || []).length ? [z === "main" ? "Main" : z === "extra" ? "Extra" : "Side", ...d.zones[z].map((r) => `${r.qty} ${r.name}`), ""] : [])).join("\n");
  A.tDeckCopy = (t) => copyText(listText(gs(g()).decks.find((x) => x.id === t.dataset.id)), "Decklist copied.");
  A.tDeckExport = (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id);
    download(d.name.replace(/[^a-z0-9]+/gi, "_") + "." + SOURCES[G].exportExt, SOURCES[G].exportText(d, (id) => cardOf(G, id)));
  };
  A.tDeckCopyMissing = async (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id),
      s = deckStats(G, d),
      rows = s.rows.filter((x) => x.need).map((x) => ({ qty: x.need, name: x.r.name, ...massSet(G, x.c || (G === "ptcg" ? { id: x.r.cardId, name: x.r.name, basicEnergy: /^(Basic )?\w+ Energy$/.test(x.r.name) } : null)) }));
    if (!rows.length) return toast("You own every card in this deck.");
    buyOnTcgplayer(G, await massLines(G, rows));
  };
  // Pokémon decks hold exact printings: swap each card for its cheapest printing with the same
  // game text that is legal in the deck's format (an owned printing wins). Versions keep the old list.
  A.tDeckCheapest = async (t) => {
    const G = g(), d = gs(G).decks.find((x) => x.id === t.dataset.id);
    if (G !== "ptcg" || !d) return;
    const f = formatOf(G, d.format), done = busy(t, "Finding cheaper printings…");
    try {
      const rows = (d.zones.main || []).filter((r) => cardOf(G, r.cardId)),
        swaps = new Map();
      let saved = 0;
      for (const r of rows) {
        const c = cardOf(G, r.cardId), best = await ptcgCheapest(c, f);
        if (best && best.id !== c.id && SOURCES.ptcg.legality(best, f) === "legal" && (best.name === c.name || (best.basicEnergy && c.basicEnergy))) { swaps.set(r.cardId, best); saved += ((c.prices?.usd ?? 0) - (best.prices?.usd ?? 0)) * r.qty; }
      }
      if (!swaps.size) return toast("Every card is already its cheapest legal printing.");
      await mutate((s2) => {
        const x = s2.decks.find((y) => y.id === d.id), main = new Map();
        x.versions = [...(x.versions || []), { id: uid(), at: new Date().toISOString(), label: "Before cheapest printings", zones: structuredClone(x.zones) }].slice(-30);
        for (const r of x.zones.main || []) {
          const b = swaps.get(r.cardId), id = b ? b.id : r.cardId, row = main.get(id);
          if (row) row.qty += r.qty; else main.set(id, { ...r, cardId: id, name: b ? b.name : r.name });
        }
        x.zones.main = [...main.values()];
      }, { msg: `${swaps.size} card${swaps.size === 1 ? "" : "s"} switched to the same card's cheapest printing${saved > 0.5 ? ` · about ${usd(saved, 0)} less` : ""}. The old list is in Versions.` });
    } finally {
      done();
    }
  };
  A.tDeckRefresh = async (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id),
      done = busy(t, "Refreshing…");
    try {
      await ensureMany(G, ["main", "extra", "side"].flatMap((z) => (d.zones[z] || []).map((r) => r.cardId)), () => {}, true);
      render();
      toast("Prices refreshed.");
    } finally {
      done();
    }
  };

  // import
  A.tImport = () => openSheet(tcgImportSheet("deck"), { type: "timport" });
  A.tImportColl = () => openSheet(tcgImportSheet("coll"), { type: "timport" });
  C.tImpFile = async (t) => {
    const f = t.files[0];
    if (!f) return;
    if (f.size > 2e6) return toast("Use a file under 2 MB.");
    const token=S.ui.sheetCtx, text=await f.text();
    if(S.ui.sheetCtx !== token) return;
    const input=document.querySelector("#tImpText"), name=document.querySelector("#tImpName");
    if(input) input.value=text;
    if(name) name.value=f.name.replace(/\.[^.]+$/, "");
  };
  // Resolve "qty name" lines to cards; returns { rows: [{card, qty}], missed: [name] }.
  const resolveLines = async (G, lines, status, active) => {
    if (lines.some(l => !Number.isSafeInteger(l.qty) || l.qty < 1 || l.qty > 100000)) throw Error("Use a positive whole-number quantity for each card.");
    const results = new Array(lines.length), pending = new Map(); let next = 0, completed = 0;
    await Promise.all(Array.from({length:Math.min(6,lines.length)},async()=>{
      while(next < lines.length && active()) {
        const i=next++, l=lines[i], name=G === "ptcg" ? ptcglName(l.name) : l.name;
        if(!pending.has(name)) pending.set(name,(async()=>{
          const cached=Object.values(cache[G]).find(c=>!c.brief && c.name === name);
          return cached || (/^[a-z0-9.]+-[A-Za-z0-9]+$/.test(name) && G === "ptcg" ? ensureCard(G,name) : SOURCES[G].byName(name));
        })().catch(()=>null));
        const card=await pending.get(name); results[i]=card ? {card:remember(card),qty:l.qty,zone:l.zone} : {missing:name};
        status(`Matching ${++completed}/${lines.length}…`);
      }
    }));
    if(!active()) throw Error("Import cancelled.");
    return {rows:results.filter(r=>r?.card),missed:results.filter(r=>r?.missing).map(r=>r.missing)};
  };
  const importGuard = (G) => {
    const token=S.ui.sheetCtx, node=document.querySelector("#tImpStatus");
    const active=()=>S.ui.sheetCtx === token && g() === G;
    return {active,status:m=>{if(active() && node) node.textContent=m;}};
  };
  const requireComplete = (rows, missed) => {
    if(missed.length) throw Error(`Nothing saved: ${missed.length} unmatched entries. Correct these names and retry: ${missed.slice(0,5).join(", ")}`);
    if(!rows.length) throw Error("No cards matched. Nothing saved.");
  };
  A.tImpDeck = async (t) => {
    const G = g(),
      text = document.querySelector("#tImpText").value,
      {status,active} = importGuard(G),
      done = busy(t, "Importing…");
    try {
      const d = { id: uid(), name: document.querySelector("#tImpName").value.trim().slice(0, 100) || "Imported deck", format: document.querySelector("#tImpFormat").value, zones: { main: [], extra: [], side: [] }, createdAt: new Date().toISOString() };
      if(text.length > 2e6) throw Error("Use a list under 2 MB.");
      const ydk = G === "ygo" ? parseYdk(text) : null;
      let missed = [];
      if (ydk) {
        const ids = [...new Set([...ydk.main, ...ydk.extra, ...ydk.side])];
        status(`Loading ${ids.length} cards…`);
        await ensureMany(G, ids, (n) => status(`Loading cards ${n}/${ids.length}…`));
        for (const z of ["main", "extra", "side"])
          for (const id of ydk[z]) {
            const card = cardOf(G, id);
            if (!card) {
              missed.push(id);
              continue;
            }
            const row = d.zones[z].find((r) => r.cardId === id);
            if (row) row.qty++;
            else d.zones[z].push({ cardId: id, name: card.name, qty: 1 });
          }
      } else {
        const lines = parseLines(text);
        if (!lines.length) throw Error("Paste a list first.");
        const r = await resolveLines(G, lines, status, active);
        missed = r.missed;
        for (const { card, qty, zone } of r.rows) {
          const z = zone || SOURCES[G].zoneFor(card);
          const row = (d.zones[z] ||= []).find((x) => x.cardId === card.id);
          if (row) row.qty += qty;
          else d.zones[z].push({ cardId: card.id, name: card.name, qty });
        }
      }
      if(!active()) return;
      requireComplete(Object.values(d.zones).flat(), missed);
      await mutate((st) => st.decks.push(d), { msg: missed.length ? `Imported. ${missed.length} not found: ${missed.slice(0, 3).join(", ")}` : "Deck imported. Your collection is unchanged." });
      closeSheet();
      go("#tdeck/" + d.id);
    } catch (e) {
      status(e.message);
    } finally {
      done();
    }
  };
  A.tImpColl = async (t) => {
    const G = g(),
      text = document.querySelector("#tImpText").value,
      {status,active} = importGuard(G),
      done = busy(t, "Importing…");
    try {
      const lines=parseLines(text);
      if (!lines.length) throw Error("Paste a list first.");
      const r = await resolveLines(G, lines, status, active);
      if(!active()) return;
      requireComplete(r.rows,r.missed);
      await mutate((st) => {
        for (const { card, qty } of r.rows) st.collection.push({ id: uid(), cardId: card.id, name: card.name, key: SOURCES[G].ownKey(card), qty, printing: "", rarity: "", variant: "", condition: "Near Mint", location: "", addedAt: new Date().toISOString() });
      }, { msg: `Added ${r.rows.length} cards.${r.missed.length ? ` Not found: ${r.missed.slice(0, 3).join(", ")}` : ""}` });
      closeSheet();
    } catch (e) {
      status(e.message);
    } finally {
      done();
    }
  };

  // sets
  const SETS_KEY = (G) => "cardforge-" + G + "-sets-v2";
  const loadSets = async (G, force = false) => {
    const U = ui(G).sets;
    if (U.busy) return;
    try {
      const cached = JSON.parse(localStorage.getItem(SETS_KEY(G)) || "null");
      if (cached?.list?.length) {
        U.list = cached.list;
        if (!force && Date.now() - cached.at < 3 * 864e5) return void setTimeout(render, 0);
      }
    } catch {}
    U.busy = true;
    U.error = "";
    render();
    try {
      U.list = await SOURCES[G].sets();
      try {
        localStorage.setItem(SETS_KEY(G), JSON.stringify({ at: Date.now(), list: U.list }));
      } catch {}
    } catch (e) {
      U.error = e.message;
    } finally {
      U.busy = false;
      render();
    }
  };
  c.loadSets = loadSets;
  C.tSetKind = t => {ui().sets.kind=t.value;ui().sets.limit=120;render();};
  I.tSetsQ = (t) => {
    ui().sets.q = t.value;
    ui().sets.limit = 120;
    c.rerenderKeepingFocus();
  };
  A.tSetsMore = () => {
    ui().sets.limit += 120;
    render();
  };
  A.tSetsReload = () => loadSets(g(), true);
  A.tSet = (t) => {
    closeSheet();
    go("#set/" + encodeURIComponent(t.dataset.id));
  };
  A.tSetByName = async (t) => {
    const G = g();
    if (!ui(G).sets.list.length) await loadSets(G);
    const s = ui(G).sets.list.find((x) => x.name === t.dataset.name);
    closeSheet();
    if (s) go("#set/" + encodeURIComponent(s.id));
    else {
      ui(G).search.f = { set: t.dataset.name, setName: t.dataset.name };
      go("#search");
      runSearch();
    }
  };
  c.openSet = async (id) => {
    const G = g(),
      U = ui(G).set;
    if (U.id === id) return;
    Object.assign(U, { id, info: null, cards: [], busy: true, error: "", filter: "all", limit: 120 });
    if (!ui(G).sets.list.length) await loadSets(G);
    U.info = ui(G).sets.list.find((s) => s.id === id) || { id, name: id, code: id, count: 0 };
    render();
    try {
      U.cards = (await SOURCES[G].setCards(U.info)).map(remember);
      render();
      if (G === "ptcg") await ensureMany(G, U.cards.slice(0, 120).map((x) => x.id), () => S.ui.view === "set" && render());
    } catch (e) {
      U.error = e.message;
    } finally {
      U.busy = false;
      render();
    }
  };
  A.tSetFilter = (t) => {
    ui().set.filter = t.dataset.id;
    render();
  };
  C.tSetSort = (t) => {
    ui().set.sort = t.value;
    render();
  };
  A.tSetMore = () => {
    const G = g(),
      U = ui(G).set;
    U.limit += 120;
    render();
    if (G === "ptcg") ensureMany(G, U.cards.slice(0, U.limit).map((x) => x.id), () => render());
  };
}
