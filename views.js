// Screen renderers. Each returns HTML for #content; interaction is wired by
// data-act / data-change / data-input attributes handled centrally in app.js.
import { factBox, factsFor } from "./facts.js";
import { S, meta, inv, deckById, currentDeck, priceOf } from "./store.js";
import {
  esc, usd, pct, signed, art, cardImage, img, manaCost, colorDots, segmented,
  options, bar, ring, curveChart, lineChart, empty, setBadge, sym, symbolText, setIconUrl,
} from "./ui.js";
import {
  cardKey as key, sumQty, rulesText, typeText, isLand, validateDeck,
  atLeastLands, aggregateCards, commanderEligible, isBasic,
} from "./core.js";
import { deckComparison, comparisonTotals } from "./deck-flow.js";
import { printingState } from "./confidence.js";
import { complexity } from "./planner.js";
import {
  engineProfile, engineRoles, goldfish, scoreGrade, diffCards, deckValue,
  collectionValue, lotPrice, swapImpact, applySwapsToCards, cardSig,
} from "./insights.js";
import { bracketEstimate, manaBase, isOut, deckReview, explainSwap } from "./extras.js";
import { buildability, rankBuildable } from "./share.js";
import { formatsFor } from "./builder.js";
import { gameBinders, homeHero, quickTiles, randomTools } from "./tcg.js";
import { FORMATS as ALL_FORMATS, formatOf, hasCommander, canLead, legalityIn, LEGALITY_WORD, sizeLabel } from "./formats.js";
import { cloudInfo, summarize } from "./cloud.js";

/* ---------- shared deck math ---------- */

export function rowsFor(d) {
  return deckComparison(d, S.state.collection, S.state.decks, S.catalog).map((r) => ({
    ...r,
    price: priceOf(r.name),
  }));
}
export function totalsFor(d) {
  return comparisonTotals(rowsFor(d));
}
export function goldfishFor(d, cards = d.cards, tag = "") {
  const sig = d.id + "|" + tag + "|" + JSON.stringify(cards) + "|" + d.commander;
  if (!S.ui.gold.has(sig)) {
    if (S.ui.gold.size > 40) S.ui.gold.clear();
    S.ui.gold.set(sig, goldfish({ ...d, cards }, S.catalog));
  }
  return S.ui.gold.get(sig);
}
const coverOf = (d) =>
  art(meta(d.commander) || d.cards.map((c) => meta(c.name)).find((c) => art(c)));

/* ---------- Home ---------- */

export function home() {
  const st = S.state,
    copies = sumQty(st.collection),
    value = collectionValue(st.collection, S.catalog, st.printings, st.decks),
    hist = st.valueHistory || [],
    prev = hist.length > 1 ? hist[hist.length - 2] : null,
    change = prev ? value.total - prev.total : null,
    active = deckById(st.activeDeck),
    others = st.decks.filter((d) => d !== active).slice(-8).reverse(),
    onboarding = !(st.collection.length && st.decks.length);
  // New users get one guided panel; the regular shortcuts and empty states would only repeat it.
  if (onboarding)
    return `${homeHero("mtg", "Let’s build from your cards.", mtgDeckArt(active))}${gameBinders("mtg")}
  ${st.example ? `<div class="note warn">Example data is loaded. Reset it in Settings before adding real cards.</div>` : ""}
  ${startPath()}
  ${active ? `<div class="section-head"><h2>Continue building</h2></div>${deckTile(active, true)}` : ""}
  ${randomTools("mtg")}
  ${quickTiles("mtg")}
  ${glossary()}`;
  return `${homeHero("mtg", copies ? "Welcome back." : "Let’s build from your cards.", mtgDeckArt(active))}${gameBinders("mtg")}
  ${st.example ? `<div class="note warn">Example data is loaded. Reset it in Settings before adding real cards.</div>` : ""}
  <div class="kpis">
    <button class="kpi" data-act="go" data-to="#collection/value"><b>${usd(value.total, 0)}</b><span>collection value${change !== null ? ` <em class="${change >= 0 ? "up" : "down"}">${signed(change, (x) => usd(x, 0))}</em>` : ""}</span></button>
    <button class="kpi" data-act="go" data-to="#collection"><b>${copies}</b><span>cards owned</span></button>
    <button class="kpi" data-act="go" data-to="#decks"><b>${st.decks.length}</b><span>decks</span></button>
  </div>
  ${randomTools("mtg")}
  ${quickTiles("mtg")}
  ${active ? `<div class="section-head"><h2>Continue building</h2></div>${deckTile(active, true)}` : ""}
  ${
    others.length
      ? `<div class="section-head"><h2>Deck shelf</h2><button class="link" data-act="go" data-to="#decks">All decks →</button></div><div class="shelf">${others.map((d) => deckTile(d)).join("")}</div>`
      : !active
        ? empty("Your shelf is empty", "Import a list from Moxfield, Archidekt or ManaBox. Cardforge matches it against your collection and shows the gap.", `<button class="btn" data-act="importDeck">Import a deck</button><button class="btn ghost" data-act="newDeck">Start from a commander</button>`)
        : ""
  }
  ${
    value.spare.length && value.spareValue > 0
      ? `<button class="banner" data-act="go" data-to="#collection/value"><span><b>${usd(value.spareValue, 0)}</b> sits in ${sumQty(value.spare)} cards no deck uses</span><span class="muted">Trade binder →</span></button>`
      : ""
  }
  ${glossary()}`;
}

const glossary = () => `<details class="glossary"><summary>New to Commander? 60-second glossary</summary><dl>
    <dt>100 cards, one copy each</dt><dd>Your commander plus 99 others. Basic lands are the main exception to the one-copy rule.</dd>
    <dt>Color identity</dt><dd>Every card must fit inside your commander’s colors.</dd>
    <dt>Ramp · Draw · Removal</dt><dd>Extra mana, more cards, and answers to threats. Most decks want about 10 · 10 · 8 of them.</dd>
    <dt>Engine score</dt><dd>A 0–100 build-health check of those ingredients plus synergy and curve. It is not a win rate.</dd>
    <dt>Owned vs. deck</dt><dd>A deck is a plan. Your collection is what you physically own. Importing a deck never adds cards to your collection.</dd>
  </dl></details>`;

// The active deck's commander art leads the Home banner.
function mtgDeckArt(d) {
  const c = d ? meta(d.commander) || d.cards.map((x) => meta(x.name)).find((x) => art(x)) : null;
  return c && art(c) ? { name: c.name, art: art(c), deck: true } : null;
}

// Three steps for a new visitor; disappears once they have cards and a deck.
function startPath() {
  const st = S.state,
    hasCards = st.collection.length > 0,
    hasDeck = st.decks.length > 0;
  if (hasCards && hasDeck) return "";
  const step = (n, done, title, text, actions) =>
    done
      ? `<li class="step done"><span class="step-n" aria-hidden="true">✓</span><div><b>${title}</b></div></li>`
      : `<li class="step"><span class="step-n" aria-hidden="true">${n}</span><div><b>${title}</b><p class="muted small">${text}</p><div class="actions wrap">${actions}</div></div></li>`;
  return `<section class="panel start"><p class="eyebrow">Start here · about 5 minutes</p><h2>Three steps to your first deck</h2><ol class="steps">
    ${step(1, hasCards, "Add the cards you own", "Paste a list or upload a ManaBox, Moxfield, Archidekt or CSV export. Or scan cards with your camera.", `<button class="btn small" data-act="importCollection">↥ Import collection</button><button class="btn ghost small" data-act="go" data-to="#scan">▧ Scan</button><button class="link small" data-act="loadExample">Try an example collection</button>`)}
    ${step(2, hasDeck, "Pick a deck to aim for", "Import a list you like, start from a commander, or browse precons and shared decks to see what you can almost build.", `<button class="btn small" data-act="go" data-to="#decks/inspiration">✧ Find decks I can almost build</button><button class="btn ghost small" data-act="importDeck">Import a deck</button>`)}
    ${step(3, false, "See what’s missing and what it costs", "Each deck shows what you own, what you need, the price to finish, and a review of anything off.", hasDeck ? `<button class="btn small" data-act="go" data-to="#deck/active/cards">Open my deck</button>` : `<span class="muted small">Unlocks after step 2.</span>`)}
  </ol><p class="foot">Everything is saved on this device. Export a backup in Settings any time.</p></section>`;
}

export function deckTile(d, wide = false) {
  const t = totalsFor(d),
    p = engineProfile(d, S.catalog),
    v = deckValue(d.cards, S.catalog, S.state.priceChoices),
    cover = coverOf(d),
    target = formatOf(d).size,
    owned = t.copies ? t.covered / t.copies : 0;
  return `<button class="deck-tile ${wide ? "wide" : ""}" data-act="go" data-to="#deck/${esc(d.id)}">
    <span class="tile-art">${img(cover, d.name)}</span>
    <span class="tile-shade"></span>
    <span class="tile-top"><span class="chip dark">${esc(formatOf(d).name)}</span>${colorDots(meta(d.commander))}</span>
    <span class="tile-body">
      <b>${esc(d.name)}</b>
      <small>${esc(d.commander || "No commander")} · ${t.copies}/${target}</small>
      <span class="tile-stats"><span><em>${p.score}</em> engine</span><span><em>${Math.round(owned * 100)}%</em> owned</span><span><em>${usd(v.total, 0)}</em> value</span>${t.missing ? `<span><em>${usd(t.pricedGap, 0)}</em> to finish</span>` : ""}</span>
      ${bar(owned, "thin")}
    </span>
  </button>`;
}

/* ---------- Search ---------- */

export function search() {
  const db = S.ui.db,
    f = db.filters;
  return `<div class="page-head"><h1>Search cards</h1><span class="row"><button class="btn ghost small" data-act="go" data-to="#sets">◈ Browse sets</button><button class="btn ghost small" data-act="dbRandom">🎲 Random card</button></span></div>
  <div class="searchbar"><input id="dbTerm" type="search" value="${esc(db.term)}" placeholder="Name, or Scryfall syntax like t:angel o:draw" data-input="dbTerm" data-enter="dbSearch" aria-label="Search all cards" autocomplete="off"><button class="btn" data-act="dbSearch" ${db.busy ? "disabled" : ""}>${db.busy ? "…" : "Search"}</button></div>
  <details class="filters" ${f.color || f.type || f.maxPrice || f.rarity || f.mv || f.set || f.sort ? "open" : ""}><summary>Filters${f.color || f.type || f.maxPrice || f.format || f.rarity || f.mv || f.set ? " · on" : ""}</summary><div class="grid2">
    <label>Fits colors<select data-change="dbFilter" data-field="color">${options([["", "Any"], ["W", "White"], ["U", "Blue"], ["B", "Black"], ["R", "Red"], ["G", "Green"], ["WU", "Azorius WU"], ["UB", "Dimir UB"], ["BR", "Rakdos BR"], ["RG", "Gruul RG"], ["GW", "Selesnya GW"], ["WB", "Orzhov WB"], ["UR", "Izzet UR"], ["BG", "Golgari BG"], ["RW", "Boros RW"], ["GU", "Simic GU"], ["C", "Colorless"]], f.color)}</select></label>
    <label>Type<select data-change="dbFilter" data-field="type">${options([["", "Any"], ...["creature", "instant", "sorcery", "artifact", "enchantment", "land", "planeswalker", "legendary creature"].map((x) => [x, x])], f.type)}</select></label>
    <label>Legal in<select data-change="dbFilter" data-field="format">${options([["", "Any format"], ...ALL_FORMATS.filter((x) => x.legality).map((x) => [x.legality, x.name])], f.format)}</select></label>
    <label>Rarity<select data-change="dbFilter" data-field="rarity">${options([["", "Any"], ["common", "Common"], ["uncommon", "Uncommon"], ["rare", "Rare"], ["mythic", "Mythic"], ["special", "Special"]], f.rarity || "")}</select></label>
    <label>Mana value<select data-change="dbFilter" data-field="mv">${options([["", "Any"], ...["0", "1", "2", "3", "4", "5", "6", "7+"].map((x) => [x, x])], f.mv || "")}</select></label>
    <label>Set code<input value="${esc(f.set || "")}" placeholder="e.g. FDN" maxlength="6" data-change="dbFilter" data-field="set" autocapitalize="characters"></label>
    <label>Sort<select data-change="dbFilter" data-field="sort">${options([["", "Best match"], ["name", "Name"], ["usd", "Price: high to low"], ["released", "Newest"], ["cmc", "Mana value"], ["edhrec", "Most played (EDHREC)"], ["rarity", "Rarity"]], f.sort || "")}</select></label>
    <label class="span2">Max price $<input type="number" min="0" step="0.5" value="${esc(f.maxPrice)}" data-change="dbFilter" data-field="maxPrice" placeholder="Any"></label>
  </div><p class="foot">Change filters, then tap Search.</p></details>
  <div class="row between"><span class="muted small">${db.results.length ? `${db.total.toLocaleString()} cards` : "Live from Scryfall"}</span></div>
  ${db.error ? `<div class="note warn">${esc(db.error)}</div>` : ""}
  ${
    db.results.length
      ? `<div class="card-grid">${db.results
          .map((c) => {
            const own = inv(c.name).owned;
            return `<button class="grid-card" data-act="card" data-name="${esc(c.name)}">${img(cardImage(c), c.name, "card-img")}<span class="grid-meta"><span class="ellip">${esc(c.name)} ${setBadge(c)}</span><span>${usd(c.prices?.usd ?? c.prices?.usd_foil)}</span></span>${own ? `<span class="owned-badge">×${own}</span>` : ""}</button>`;
          })
          .join("")}</div>${db.next ? `<button class="btn ghost block" data-act="dbMore" ${db.busy ? "disabled" : ""}>Load more</button>` : ""}`
      : `<div class="hints"><p class="muted small">Try:</p>${["t:angel id<=w", "o:\"draw a card\" id<=w usd<1", "t:legendary t:creature id=r", "is:commander o:token"]
          .map((q) => `<button class="chip" data-act="dbTry" data-q="${esc(q)}">${esc(q)}</button>`)
          .join("")}</div>`
  }`;
}

/* ---------- Card sheet ---------- */

const RARITY = { common: "Common", uncommon: "Uncommon", rare: "Rare", mythic: "Mythic", special: "Special", bonus: "Bonus" };
// Legality chips on a card: the common paper formats up front, everything else one tap away.
function deckLegalLine(c, deck) {
  const f = formatOf(deck),
    l = legalityIn(c, f);
  if (!l) return "";
  return `<p class="small deck-legal ${l === "legal" ? "ok-text" : l === "restricted" ? "warn-text" : "bad-text"}">${l === "legal" ? "✓" : l === "restricted" ? "▲" : "●"} ${esc(LEGALITY_WORD[l])} in ${esc(f.name)} <span class="muted">(${esc(deck.name)})</span>${l === "restricted" ? " — one copy only" : ""}</p>`;
}
const MAIN_LEGAL = ["standard", "pioneer", "modern", "legacy", "vintage", "pauper", "commander", "brawl"];
const legalChip = (f, legal) => `<span class="lg ${legal[f.legality] === "legal" ? "yes" : legal[f.legality] === "restricted" ? "res" : legal[f.legality] === "banned" ? "ban" : "no"}" title="${esc(f.name)}: ${esc(LEGALITY_WORD[legal[f.legality]] || "Not legal")}">${esc(f.name)}${legal[f.legality] === "banned" ? " · banned" : legal[f.legality] === "restricted" ? " · 1 copy" : ""}</span>`;

export const setIcon = (code, rarity = "common", size = 18) =>
  code
    ? `<span class="set-icon r-${esc(rarity || "common")}" style="--icon:url('${esc(setIconUrl(code))}');width:${size}px;height:${size}px" title="${esc(String(code).toUpperCase())} · ${esc(RARITY[rarity] || rarity || "")}" aria-hidden="true"></span>`
    : "";

const FINISH = { nonfoil: "Regular", foil: "Foil", etched: "Etched" };
const priceOfFinish = (p, f) => p?.prices?.[f === "nonfoil" ? "usd" : "usd_" + f] ?? null;

function facesOf(c) {
  return c.card_faces?.length && !c.oracle_text ? c.card_faces : [c];
}

// Tabs shared by every game's card page.
export const cardTabs = (tab, items) =>
  `<nav class="cs-tabs" role="tablist">${items.map(([id, label]) => `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? "on" : ""}" data-act="cardTab" data-tab="${id}">${label}</button>`).join("")}</nav>`;
export const cardPanel = (id, tab, html) => `<div class="cs-panel" data-tab="${id}" ${id === tab ? "" : "hidden"}>${html}</div>`;

// Price sources Scryfall reports, per finish.
const MTG_SOURCES = [
  ["tcgplayer", "TCGplayer", "USD", { nonfoil: "usd", foil: "usd_foil", etched: "usd_etched" }],
  ["cardmarket", "Cardmarket", "EUR", { nonfoil: "eur", foil: "eur_foil" }],
  ["cardhoarder", "Cardhoarder (MTGO)", "TIX", { nonfoil: "tix" }],
];
const money = (v, cur) => (v === null || v === undefined || v === "" ? "—" : cur === "USD" ? usd(v) : cur === "EUR" ? "€" + Number(v).toFixed(2) : Number(v).toFixed(2) + " tix");

export function cardSheet(c, ctx = {}) {
  const name = c.name,
    shown = ctx.print || c, // the printing currently being looked at
    tab = ctx.tab || "overview",
    i = inv(name),
    inDecks = S.state.decks.filter((d) => d.cards.some((x) => key(x.name) === key(name))),
    deck = ctx.deckId ? deckById(ctx.deckId) : null,
    row = deck?.cards.find((x) => key(x.name) === key(name)),
    roles = engineRoles(c),
    faces = facesOf(shown),
    face = ctx.face && faces[ctx.face] ? ctx.face : 0,
    imgFaces = shown.card_faces?.filter((f) => f.image_uris),
    image = imgFaces?.length > 1 ? imgFaces[face]?.image_uris?.normal : cardImage(shown),
    heroArt = (imgFaces?.length > 1 ? imgFaces[face]?.image_uris?.art_crop : null) || art(shown),
    chosen = S.state.priceChoices?.[key(name)],
    legal = c.legalities || {},
    prints = ctx.prints || null,
    src = MTG_SOURCES.find((x) => x[0] === (ctx.source || "tcgplayer")) || MTG_SOURCES[0];
  const finishes = ["nonfoil", "foil", "etched"].filter((f) => priceOfFinish(shown, f));
  const overview = `
    <div class="cs-card">
      <div class="cd-img">${img(image, name, "card-img")}${imgFaces?.length > 1 ? `<button class="btn ghost small block" data-act="flipFace">↻ Flip to ${esc(imgFaces[face ? 0 : 1].name)}</button>` : ""}</div>
      <div class="cs-card-side">
        <p class="small own-line">${i.owned ? `<b class="ok-text">You own ${i.owned}</b> · ${i.available} free${i.reserved ? ` · ${i.reserved} reserved` : ""}` : "Not in your collection"}${inDecks.length ? ` · in ${inDecks.map((d) => esc(d.name)).join(", ")}` : ""}</p>
        <div class="chips">${roles.map((r) => `<span class="chip role-${r.toLowerCase()}">${r}</span>`).join("")}${c.edhrec_rank ? `<span class="chip">EDHREC #${Number(c.edhrec_rank).toLocaleString()}</span>` : ""}${c.reserved ? `<span class="chip">Reserved List</span>` : ""}${c.game_changer ? `<span class="chip warn">Game Changer</span>` : ""}</div>
        ${deck ? deckLegalLine(c, deck) : ""}
      </div>
    </div>
    ${row ? `<div class="panel tight"><div class="row between"><b>In ${esc(deck.name)}</b><span class="stepper"><button data-act="deckQty" data-name="${esc(name)}" data-delta="-1" aria-label="One fewer">−</button><b>${row.qty}</b><button data-act="deckQty" data-name="${esc(name)}" data-delta="1" aria-label="One more">＋</button></span></div>${key(name) !== key(deck.commander) ? `<button class="link danger small" data-act="deckRemove" data-name="${esc(name)}">Remove from deck</button>` : ""}</div>` : ""}
    <div class="actions wrap">
      <button class="btn" data-act="own" data-name="${esc(name)}">＋ I own this</button>
      <button class="btn ghost" data-act="wish" data-name="${esc(name)}">♡ Wishlist</button>
      <button class="btn ghost" data-act="compareFrom" data-name="${esc(name)}">⇄ Compare</button>
      ${isLand(c) ? "" : `<button class="btn ghost" data-act="buildFrom" data-name="${esc(name)}">⚒ Build decks</button>`}
      ${ctx.random ? `<button class="btn ghost" data-act="dbRandom">🎲 Another</button>` : ""}
    </div>
    ${S.state.decks.length ? `<div class="inline-pick"><select id="toDeck" aria-label="Deck to add to">${options(S.state.decks.map((d) => [d.id, d.name]), deck?.id || S.state.activeDeck)}</select><button class="btn ghost" data-act="addToDeck" data-name="${esc(name)}">Add to deck</button></div>` : ""}
    ${factBox(factsFor(c, prints), c.oracle_id || name)}
    <div class="links research"><span class="muted small">Research</span>
      <a href="${esc(c.scryfall_uri || "https://scryfall.com/search?q=" + encodeURIComponent(name))}" target="_blank" rel="noopener">Scryfall ↗</a>
      <a href="https://edhrec.com/cards/${esc(name.toLowerCase().split(" // ")[0].replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}" target="_blank" rel="noopener">EDHREC ↗</a>
      <button class="link" data-act="buyCard">Where to buy ›</button>
    </div>`;
  const pricesTab = `
    <div class="src-row" role="tablist" aria-label="Price source">${MTG_SOURCES.map(([id, label]) => `<button class="chip pick ${id === src[0] ? "on" : ""}" data-act="priceSource" data-src="${id}">${esc(label)}</button>`).join("")}</div>
    <div class="price-table" style="--cols:${Object.keys(src[3]).length}"><div class="pt-head"><span></span>${Object.keys(src[3]).map((f) => `<b class="${f}">${FINISH[f]}</b>`).join("")}</div>
      <div class="pt-row"><span class="pt-label">${esc(shown.set_name || "This printing")} <small class="muted">${esc((shown.set || "").toUpperCase())} #${esc(shown.collector_number || "?")}</small></span>${Object.values(src[3]).map((k) => `<span>${money(shown.prices?.[k], src[2])}</span>`).join("")}</div>
    </div>
    <p class="foot">${esc(src[1])} ${src[2] === "TIX" ? "price for Magic Online tickets" : "market estimate"} from Scryfall, updated daily${shown.checkedAt ? " · checked " + esc(new Date(shown.checkedAt).toLocaleDateString()) : ""}. Condition prices (NM, LP…) and stock are on the store’s page.</p>
    ${prints ? `<p class="small">Across ${prints.length} printings: <b class="ok-text">${usd(cheapest(prints))}</b> cheapest · <b>${usd(dearest(prints))}</b> priciest <button class="link small" data-act="cardTab" data-tab="versions">Compare all →</button></p>` : ""}
    ${chosen ? `<p class="small">Your shopping price: <b>${usd(chosen.price)}</b> · ${esc(chosen.label)}</p>` : ""}
    <div class="actions wrap"><button class="btn" data-act="buyCard" data-finish="${finishes[0] || "nonfoil"}">Buy this printing ›</button>${shown.purchase_uris?.[src[0]] ? `<a class="btn ghost" href="${esc(shown.purchase_uris[src[0]])}" target="_blank" rel="noopener noreferrer">${esc(src[1])} listing ↗</a>` : ""}</div>`;
  const rulings = ctx.rulings
    ? ctx.rulings.length
      ? `<ul class="rulings">${ctx.rulings.map((r) => `<li><p>${symbolText(r.comment)}</p><small class="muted">${esc(r.source === "wotc" ? "Wizards of the Coast" : "Scryfall")} · ${esc(r.published_at || "")}</small></li>`).join("")}</ul>`
      : `<p class="muted small">No official rulings for this card. The <button class="link" data-act="go" data-to="#rules">Magic rules reference</button> covers the general rules.</p>`
    : `<p class="muted small" id="rulingsLoading">Loading official rulings…</p>`;
  const legality = `${deck ? deckLegalLine(c, deck) : ""}
    <div class="legal">${ALL_FORMATS.filter((f) => f.legality).map((f) => legalChip(f, legal)).join("")}</div>
    <p class="foot">From Scryfall’s current data. Green = legal, red = banned, gold = restricted. <button class="link small" data-act="go" data-to="#rules">Banned lists & format rules →</button></p>`;
  return `<div class="sheet-head overlay">${S.ui.sheetBack ? `<button class="icon" data-act="sheetBack" aria-label="Back to deck idea">←</button>` : "<span></span>"}<button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="cs-hero">${img(heroArt, name, "cs-art")}<div class="cs-shade"></div></div>
  <div class="cs-title"><div><h2>${esc(name)}</h2><p class="type-line">${esc(faces[face]?.type_line || typeText(shown))}</p></div>${manaCost(faces[face] || shown)}</div>
  <div class="cs-meta">
    <button class="cd-set" data-act="set" data-code="${esc(shown.set || "")}" ${shown.set ? "" : "disabled"} aria-label="See every card in ${esc(shown.set_name || "this set")}">${setIcon(shown.set, shown.rarity, 24)}<div><b>${esc(shown.set_name || (shown.set || "").toUpperCase())} <span class="set-go">›</span></b><small>${esc((shown.set || "").toUpperCase())} #${esc(shown.collector_number || "?")} · ${esc(RARITY[shown.rarity] || shown.rarity || "")}${shown.released_at ? " · " + esc(shown.released_at.slice(0, 4)) : ""}</small></div></button>
    <div class="cd-prices">${
      finishes.length
        ? finishes.map((f) => `<button class="price-pill ${f}" data-act="buyCard" data-finish="${f}" aria-label="Buy ${esc(FINISH[f])} — estimated ${usd(priceOfFinish(shown, f))}"><small>${FINISH[f]}</small><b>${usd(priceOfFinish(shown, f))}</b><span class="buy-hint">Buy ›</span></button>`).join("")
        : `<button class="price-pill unknown" data-act="buyCard" data-finish="nonfoil"><small>Price</small><b>Unknown</b><span class="buy-hint">Find sellers ›</span></button>`
    }</div>
  </div>
  ${faces
    .map(
      (f, n) => `<section class="cd-text">
      ${faces.length > 1 ? `<div class="row between"><b>${esc(f.name)}</b>${manaCost(f)}</div><p class="type-line">${esc(f.type_line || "")}</p>` : ""}
      ${f.oracle_text ? `<p class="oracle">${symbolText(f.oracle_text)}</p>` : ""}
      ${f.flavor_text ? `<p class="flavor">${esc(f.flavor_text)}</p>` : ""}
      <div class="row between small muted">${f.power !== undefined && f.power !== null ? `<span class="pt">${esc(f.power)}/${esc(f.toughness)}</span>` : shown.loyalty && !n ? `<span class="pt">Loyalty ${esc(shown.loyalty)}</span>` : "<span></span>"}${f.artist || shown.artist ? `<span>🖌 ${esc(f.artist || shown.artist)}</span>` : ""}</div>
    </section>`,
    )
    .join("")}
  ${!c.full ? `<p class="muted small center" id="cardLoading">Loading flavor text and printings…</p>` : ""}
  ${cardTabs(tab, [["overview", "Overview"], ["versions", `Versions${prints ? " · " + prints.length : ""}`], ["prices", "Prices"], ["rulings", "Rulings"], ["legal", "Legality"]])}
  ${cardPanel("overview", tab, overview)}
  ${cardPanel("versions", tab, `<section class="prints">${prints ? printList(prints, shown, name, chosen) : `<p class="muted small">Loading every printing…</p>`}</section>`)}
  ${cardPanel("prices", tab, pricesTab)}
  ${cardPanel("rulings", tab, rulings)}
  ${cardPanel("legal", tab, legality)}`;
}

const allPrices = (prints) => prints.flatMap((p) => ["nonfoil", "foil", "etched"].map((f) => Number(priceOfFinish(p, f))).filter((x) => x > 0));
const cheapest = (prints) => (allPrices(prints).length ? Math.min(...allPrices(prints)) : null);
const dearest = (prints) => (allPrices(prints).length ? Math.max(...allPrices(prints)) : null);

function printList(prints, shown, name, chosen) {
  if (!prints.length) return `<p class="muted small">No paper printings found.</p>`;
  return `<div class="print-list">${prints
    .map((p, i) => {
      const fin = ["nonfoil", "foil", "etched"].filter((f) => priceOfFinish(p, f));
      return `<div class="print ${p.id === shown.id ? "on" : ""}">
        <button class="print-main" data-act="viewPrint" data-i="${i}">${img(p.image_uris?.small || p.card_faces?.[0]?.image_uris?.small, p.set_name, "print-thumb")}<span class="print-name">${setIcon(p.set, p.rarity, 16)}<span class="ellip"><b>${esc(p.set_name)}</b><small>${esc(p.set.toUpperCase())} #${esc(p.collector_number)} · ${esc((p.released_at || "").slice(0, 4))}${p.promo ? " · promo" : ""}${p.full_art ? " · full art" : ""}${(p.frame_effects || []).includes("showcase") ? " · showcase" : ""}${(p.frame_effects || []).includes("extendedart") ? " · extended" : ""}${p.border_color === "borderless" ? " · borderless" : ""}</small></span></span></button>
        <span class="print-prices"><button class="pp buy" data-act="buyCard" data-i="${i}" data-finish="${fin[0] || "nonfoil"}" aria-label="Buy the ${esc(p.set_name)} printing">Buy</button>${fin.length ? fin.map((f) => `<button class="pp ${chosen?.id === p.id && chosen?.finish === f ? "on" : ""}" data-act="choosePrint" data-i="${i}" data-finish="${f}" data-name="${esc(name)}" title="Use this price for shopping"><small>${f === "nonfoil" ? "reg" : f}</small>${usd(priceOfFinish(p, f))}</button>`).join("") : '<span class="muted small">—</span>'}</span>
      </div>`;
    })
    .join("")}</div><p class="foot">Tap a printing to see its art, flavor text and artist. Tap a price to use it for your shopping totals, or Buy for store links to that exact printing.</p>`;
}

/* ---------- Sets ---------- */

const SET_TYPES = {
  expansion: "Expansion", core: "Core set", masters: "Masters", commander: "Commander", draft_innovation: "Draft innovation",
  funny: "Un-set", starter: "Starter", box: "Box set", duel_deck: "Duel Decks", from_the_vault: "From the Vault",
  spellbook: "Spellbook", premium_deck: "Premium deck", arsenal: "Arsenal", planechase: "Planechase", archenemy: "Archenemy",
  masterpiece: "Masterpiece", promo: "Promo", token: "Tokens", memorabilia: "Memorabilia", alchemy: "Alchemy", minigame: "Minigame", treasure_chest: "Treasure chest", vanguard: "Vanguard",
};
const MAIN_TYPES = new Set(["expansion", "core", "masters", "commander", "draft_innovation", "funny", "starter", "box", "duel_deck", "from_the_vault", "spellbook", "premium_deck", "arsenal", "planechase", "archenemy"]);

// Owned copies by exact printing (SET#number) across the collection.
function ownedPrintings() {
  const m = new Map();
  for (const e of S.state.collection)
    if (e.set && e.collectorNumber) {
      const k = String(e.set).toLowerCase() + "#" + String(e.collectorNumber).toLowerCase();
      m.set(k, (m.get(k) || 0) + (Number(e.qty) || 0));
    }
  return m;
}

export function setsPage() {
  const st = S.ui.sets,
    q = st.q.trim().toLowerCase(),
    list = st.list.filter((x) => !x.digital && (st.all || MAIN_TYPES.has(x.set_type)) && (!q || x.name.toLowerCase().includes(q) || x.code === q)),
    years = new Map();
  for (const x of list) {
    const y = (x.released_at || "Upcoming").slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(x);
  }
  return `<div class="page-head"><h1>All sets</h1></div>
  <div class="searchbar"><input type="search" value="${esc(st.q)}" placeholder="Find a set by name or code" data-input="setsSearch" aria-label="Find a set" autocomplete="off"></div>
  <div class="row between"><span class="muted small">${st.list.length ? `${list.length.toLocaleString()} sets · updated from Scryfall` : ""}</span><label class="check small"><input type="checkbox" data-change="setsAll" ${st.all ? "checked" : ""}> Promos, tokens & extras</label></div>
  ${st.error ? `<div class="note warn">${esc(st.error)} <button class="link" data-act="setsReload">Try again</button></div>` : ""}
  ${!st.list.length && st.busy ? `<p class="muted center pad">Loading every set…</p>` : ""}
  ${[...years]
    .map(([y, xs]) => `<h2 class="year">${esc(y)}</h2><div class="set-list">${xs.map((x) => `<button class="set-row" data-act="set" data-code="${esc(x.code)}"><span class="set-icon big" style="--icon:url('${esc(x.icon || setIconUrl(x.code))}')" aria-hidden="true"></span><span class="set-row-main"><b class="ellip">${esc(x.name)}</b><small class="muted">${esc(x.code.toUpperCase())} · ${esc(SET_TYPES[x.set_type] || x.set_type)} · ${esc(x.released_at || "")}</small></span><span class="set-row-count">${x.card_count}</span></button>`).join("")}</div>`)
    .join("")}
  ${st.list.length && !list.length ? empty("No sets match", "Try another name, or include promos and extras.") : ""}`;
}

export function setPage() {
  const st = S.ui.set,
    info = st.info,
    owned = ownedPrintings(),
    q = st.q.trim().toLowerCase(),
    ownedOf = (c) => owned.get(c.set + "#" + String(c.collector_number).toLowerCase()) || 0,
    price = (c) => Number(c.prices?.usd ?? c.prices?.usd_foil ?? c.prices?.usd_etched ?? NaN),
    all = st.cards,
    ownedCount = all.filter((c) => ownedOf(c)).length;
  let list = all.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (st.rarity === "all" || c.rarity === st.rarity) && (st.filter === "all" || (st.filter === "owned" ? ownedOf(c) : !ownedOf(c))));
  if (st.sort === "price") list = list.slice().sort((a, b) => (price(b) || -1) - (price(a) || -1));
  else if (st.sort === "name") list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
  const rarities = [...new Set(all.map((c) => c.rarity))];
  return `<div class="set-hero">${info ? `<span class="set-icon huge" style="--icon:url('${esc(info.icon_svg_uri || setIconUrl(info.code))}')" aria-hidden="true"></span>` : ""}
    <div class="set-hero-main"><button class="link small" data-act="go" data-to="#sets">← All sets</button>
      <h1>${esc(info?.name || st.code.toUpperCase())}</h1>
      <p class="muted small">${info ? `${esc(info.code.toUpperCase())} · ${esc(SET_TYPES[info.set_type] || info.set_type || "")} · ${esc(info.released_at || "")} · ${info.card_count} cards` : ""}</p>
    </div></div>
  ${st.error ? `<div class="note warn">${esc(st.error)} <button class="link" data-act="setReload">Try again</button></div>` : ""}
  ${all.length ? `<div class="panel tight"><div class="row between"><span>You own <b>${ownedCount}</b> of ${all.length} printings</span><b>${pct(all.length ? ownedCount / all.length : 0)}</b></div>${bar(all.length ? ownedCount / all.length : 0, "good")}</div>` : ""}
  <div class="searchbar"><input type="search" value="${esc(st.q)}" placeholder="Search this set" data-input="setSearch" aria-label="Search this set" autocomplete="off"></div>
  <div class="set-controls">${segmented("setFilter", st.filter, [["all", "All"], ["owned", "Owned"], ["missing", "Missing"]])}
    <select data-change="setRarity" aria-label="Rarity">${options([["all", "All rarities"], ...["common", "uncommon", "rare", "mythic", "special", "bonus"].filter((r) => rarities.includes(r)).map((r) => [r, RARITY[r]])], st.rarity)}</select>
    <select data-change="setSort" aria-label="Sort">${options([["number", "Set order"], ["price", "Price: high to low"], ["name", "Name"]], st.sort)}</select></div>
  <p class="muted small">${st.busy ? `Loading ${all.length ? all.length + " of " + (st.total || "…") : ""} cards…` : all.length ? `${list.length.toLocaleString()} match · prices are Scryfall estimates` : ""}</p>
  <div class="card-grid set-grid">${list
    .slice(0, st.limit)
    .map((c) => {
      const i = all.indexOf(c),
        n = ownedOf(c),
        other = !n && inv(c.name).owned;
      return `<button class="grid-card ${n ? "own" : ""}" data-act="card" data-name="${esc(c.name)}" data-set-i="${i}">${img(cardImage(c, "normal"), c.name, "card-img")}<span class="grid-meta"><span class="ellip">#${esc(c.collector_number)} ${esc(c.name)}</span><span>${Number.isFinite(price(c)) ? usd(price(c)) : "—"}</span></span>${n ? `<span class="owned-badge">×${n}</span>` : other ? `<span class="owned-badge other" title="You own a different printing">other ed.</span>` : ""}</button>`;
    })
    .join("")}</div>
  ${list.length > st.limit ? `<button class="btn ghost block" data-act="setMore">Show more · ${(list.length - st.limit).toLocaleString()} left</button>` : ""}
  ${!st.busy && st.loaded && !list.length ? empty("No cards match", "Change the filters above.") : ""}`;
}

/* ---------- Deck generator (every format) ---------- */

const tierLabel = (t) => (t.budget ? `Up to $${t.budget}${t.upTo ? "–" + t.upTo : ""}` : "Your cards only");

function tierCard(t, i, mode) {
  const p = engineProfile({ format: t.format, commander: t.commander, cards: t.cards }, S.catalog),
    shown = S.ui.build.openTier === i,
    groups = {};
  for (const r of t.cards) {
    const c = meta(r.name),
      g = !c ? "Other" : isLand(c) ? "Lands" : /\bCreature\b/.test(typeText(c)) ? "Creatures" : "Spells";
    (groups[g] = groups[g] || []).push(r);
  }
  return `<article class="tier ${shown ? "on" : ""}">
    <div class="row between"><b>${esc(tierLabel(t))}</b><span class="chip">${esc(t.format)}</span></div>
    <div class="tier-stats"><span><b>${usd(t.cost)}</b> to buy</span><span><b>${t.total}/${t.size}</b> cards</span><span><b>${t.total ? Math.round((t.owned / t.total) * 100) : 0}%</b> owned</span><span><b>${p.score}</b> engine</span></div>
    ${bar(t.total ? t.owned / t.total : 0, "thin")}
    ${t.warnings.map((w) => `<p class="small warn-text">${esc(w)}</p>`).join("")}
    ${shown ? ["Creatures", "Spells", "Lands", "Other"].filter((g) => groups[g]).map((g) => `<p class="list-head">${g} <span class="muted">${groups[g].reduce((a, r) => a + r.qty, 0)}</span></p><div class="list compact">${groups[g].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)).map((r) => { const free = Math.min(r.qty, S.ui.build.avail?.(r.name) ?? 0), basic = isBasic(meta(r.name)) || /^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/.test(r.name); return `<button class="mini-row" data-act="card" data-name="${esc(r.name)}"><span class="ellip">${r.qty}× ${esc(r.name)} <small class="muted">${esc(r.why || "")}</small></span><span class="small ${basic || free >= r.qty ? "ok-text" : "warn-text"}">${basic ? "basic" : free >= r.qty ? "owned" : `buy ${r.qty - free}`}</span></button>`; }).join("")}</div>`).join("") : ""}
    <div class="actions wrap"><button class="btn ghost small" data-act="tierToggle" data-i="${i}">${shown ? "Hide list" : "See all " + t.total + " cards"}</button>${mode === "fill" ? `<button class="btn small" data-act="tierApply" data-i="${i}">Use this version</button>` : `<button class="btn small" data-act="tierSave" data-i="${i}">Save as deck</button>`}</div>
  </article>`;
}

export function buildSheet() {
  const B = S.ui.build,
    seed = meta(B.seed),
    fmts = seed ? formatsFor(seed, ALL_FORMATS) : [],
    tiers = B.results[B.format] || null;
  return `<div class="sheet-head"><h2>Build decks</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="build-seed">${img(art(seed), B.seed, "mini-art")}<div><small class="muted">Built around</small><b>${esc(B.seed)}</b>${seed ? colorDots(seed) : ""}</div><button class="btn ghost small" data-act="buildRandom" data-format="${esc(B.format)}">🎲 Random card</button></div>
  <p class="muted small">Pick a format. Cardforge builds a complete, legal deck at each budget — using your cards first, then the best-fitting affordable cards it can find. Basic lands are assumed owned.</p>
  <div class="fmt-chips">${fmts.map((f) => `<button class="chip pick ${f.name === B.format ? "on" : ""}" data-act="buildFormat" data-format="${esc(f.name)}">${esc(f.name)}</button>`).join("") || '<span class="muted small">This card isn’t legal in any constructed format.</span>'}</div>
  <label class="custom-budget">Also build at $<input id="buildCustom" type="number" min="0" max="100000" step="1" value="${esc(B.custom ?? "")}" placeholder="any amount" data-change="buildCustom"></label>
  ${B.busy ? `<p class="muted small" role="status">${esc(B.msg || "Building…")}</p>` : B.msg ? `<p class="small ${B.error ? "warn-text" : "muted"}" role="status">${esc(B.msg)}</p>` : ""}
  ${tiers ? `<div class="tiers">${tiers.map((t, i) => tierCard(t, i, "build")).join("")}</div>${tiers.length > 1 ? `<button class="btn ghost block" data-act="tierSaveAll">Save all ${tiers.length} versions</button>` : ""}` : ""}
  <p class="foot">Picks favor your cards, the build-around card’s themes and creature types, removal and card draw, a playable curve, and cards widely played (EDHREC rank). It’s a strong starting list, not a tuned tournament deck. Prices are Scryfall estimates; legality comes from Scryfall’s current data.</p>`;
}

function fillAnyPanel(d, fm, count) {
  const B = S.ui.build,
    tiers = B.fillDeck === d.id ? B.results.__fill : null;
  return `<section class="panel"><p class="eyebrow">${esc(fm.name)}</p><h2>${count < fm.size ? `Fill ${fm.size - count} open slots` : "Rebuild around this list"}</h2>
  <p class="muted small">Keeps every card you chose, then completes the deck with ${esc(fm.name)}-legal cards in its colors — your cards first, then the best affordable ones. One version per budget.</p>
  <div class="actions"><button class="btn" data-act="fillAny" ${B.busy ? "disabled" : ""}>${B.busy && B.fillDeck === d.id ? "Building…" : tiers ? "↻ Rebuild" : "Build versions"}</button></div>
  ${B.fillDeck === d.id && B.msg ? `<p class="small muted" role="status">${esc(B.msg)}</p>` : ""}
  </section>
  ${tiers ? `<div class="tiers">${tiers.map((t, i) => tierCard(t, i, "fill")).join("")}</div>` : ""}`;
}

/* ---------- Buy this card ---------- */

const STORES_EXACT = { tcgplayer: "TCGplayer", cardmarket: "Cardmarket" };
const nameSearch = (name) => [
  ["TCGplayer", "https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=" + encodeURIComponent(name)],
  ["Card Kingdom", "https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=" + encodeURIComponent(name)],
  ["Cardmarket", "https://www.cardmarket.com/en/Magic/Products/Search?searchString=" + encodeURIComponent(name)],
];

export function buySheet(ctx) {
  const p = ctx.print || meta(ctx.name) || { name: ctx.name },
    name = ctx.name,
    have = ["nonfoil", "foil", "etched"].filter((f) => (p.finishes || ["nonfoil"]).includes(f) || priceOfFinish(p, f)),
    finish = have.includes(ctx.finish) ? ctx.finish : have[0] || "nonfoil",
    est = priceOfFinish(p, finish),
    eur = p.prices?.[finish === "nonfoil" ? "eur" : "eur_" + finish] ?? null,
    asOf = ctx.asOf || p.checkedAt,
    exact = Object.entries(STORES_EXACT).filter(([k]) => p.purchase_uris?.[k]),
    prints = ctx.back?.prints || [],
    low = cheapest(prints),
    i = inv(name);
  return `<div class="sheet-head"><button class="icon" data-act="buyBack" aria-label="Back to card details">←</button><h2>Buy this card</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="buy-card">${img(p.image_uris?.small || p.card_faces?.[0]?.image_uris?.small, name, "buy-thumb")}<div class="buy-id">
    <b>${esc(name)}</b>
    <span class="small">${p.set ? setIcon(p.set, p.rarity, 14) : ""} ${esc(p.set_name || "Printing not recorded")}</span>
    <span class="small muted">${p.set ? `${esc(p.set.toUpperCase())} #${esc(p.collector_number || "?")} · ` : ""}${esc((p.lang || "en").toUpperCase())} · ${esc(FINISH[finish])}</span>
  </div></div>
  ${have.length > 1 ? `<div class="seg" role="tablist" aria-label="Finish">${have.map((f) => `<button role="tab" aria-selected="${f === finish}" class="${f === finish ? "on" : ""}" data-act="buyFinish" data-finish="${f}">${FINISH[f]}</button>`).join("")}</div>` : ""}
  <section class="panel tight buy-est"><div class="row between"><span class="muted small">Estimated price</span><b class="buy-price">${est === null ? "Unknown" : usd(est)}</b></div>
    <p class="small muted">${est === null ? "Scryfall has no current USD price for this printing and finish." : `Scryfall reference price (USD, ${esc(FINISH[finish].toLowerCase())})`}${eur !== null ? ` · Cardmarket trend €${esc(Number(eur).toFixed(2))}` : ""}${asOf ? ` · as of ${esc(new Date(asOf).toLocaleDateString())}` : ""}. Sellers set their own prices, condition and shipping — check the listing.</p>
  </section>
  <h3>This exact printing</h3>
  ${
    exact.length
      ? `<div class="list compact">${exact.map(([k, label]) => `<a class="mini-row store" href="${esc(p.purchase_uris[k])}" target="_blank" rel="noopener noreferrer"><span><b>${label}</b><small class="muted"> · ${esc(p.set ? p.set.toUpperCase() + " #" + p.collector_number : "this printing")}</small></span><span class="btn ghost small">View listing ↗</span></a>`).join("")}</div>${finish !== "nonfoil" ? `<p class="foot">Choose ${esc(FINISH[finish].toLowerCase())} on the listing page.</p>` : ""}`
      : `<p class="muted small">No direct listing link for this printing. Use a name search below, then pick the set.</p>`
  }
  <h3>Search by card name</h3>
  <p class="foot">These show every printing, not just this one.</p>
  <div class="links">${nameSearch(name).map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${l} ↗</a>`).join("")}</div>
  <div class="actions wrap">
    <button class="btn ghost" data-act="buyCompare">Compare cheaper printings${low !== null && est !== null && low < est ? ` · from ${usd(low)}` : ""}</button>
    <button class="btn" data-act="own" data-name="${esc(name)}">＋ Add to collection</button>
  </div>
  <p class="foot">${i.owned ? `You own ${i.owned}. ` : ""}Opening a store never changes your collection — use “Add to collection” after the card arrives. Stock and shipping are only on the seller’s site.</p>`;
}

/* ---------- Compare two cards ---------- */

export function compareSheet() {
  const [a, b] = S.ui.compare,
    d = currentDeck(),
    side = (c, i) =>
      c
        ? `<div class="cmp-side">${img(cardImage(c), c.name, "card-img")}<b>${esc(c.name)}</b>${manaCost(c)}<span class="muted small">MV ${c.cmc} · ${usd(priceOf(c.name))}</span><div class="chips">${engineRoles(c).map((r) => `<span class="chip">${r}</span>`).join("") || '<span class="muted small">No core role</span>'}</div><span class="small">${inv(c.name).available} free in collection</span><span class="small muted">${complexity(c).level}</span></div>`
        : `<div class="cmp-side pick"><input id="cmp${i}" placeholder="Card name" data-enter="compareLookup" data-i="${i}"><button class="btn ghost" data-act="compareLookup" data-i="${i}">Look up</button></div>`;
  let verdict = "";
  if (a && b) {
    const lines = [],
      dm = (b.cmc || 0) - (a.cmc || 0),
      dp = (priceOf(b.name) ?? 0) - (priceOf(a.name) ?? 0),
      ra = engineRoles(a),
      rb = engineRoles(b);
    lines.push(dm === 0 ? "Same mana value." : `${esc(b.name)} costs ${Math.abs(dm)} ${dm < 0 ? "less" : "more"} mana.`);
    lines.push(`Price difference ${signed(dp, (x) => usd(x))}.`);
    const gained = rb.filter((r) => !ra.includes(r)),
      lost = ra.filter((r) => !rb.includes(r));
    if (gained.length) lines.push("Gains: " + gained.join(", ") + ".");
    if (lost.length) lines.push("Loses: " + lost.join(", ") + ".");
    if (d && d.cards.some((x) => key(x.name) === key(a.name)) && !d.cards.some((x) => key(x.name) === key(b.name))) {
      const imp = swapImpact(d, { cut: a.name, add: b.name, cost: inv(b.name, d.id).available ? 0 : priceOf(b.name) || 0 }, S.catalog);
      lines.push(`In <b>${esc(d.name)}</b>: engine score ${signed(imp.delta)}.`);
      verdict = `<div class="panel tight"><p>${lines.join(" ")}</p><button class="btn" data-act="compareSwap">Swap into ${esc(d.name)}</button></div>`;
    } else verdict = `<div class="panel tight"><p>${lines.join(" ")}</p></div>`;
  }
  return `<div class="sheet-head"><h2>Compare cards</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><div class="cmp">${side(a, 0)}<div class="cmp-vs">vs</div>${side(b, 1)}</div>${verdict}${a || b ? `<button class="link" data-act="compareReset">Clear</button>` : ""}`;
}

/* ---------- Collection ---------- */

export function collection() {
  const tab = S.ui.collTab;
  return `<div class="page-head"><h1>Collection</h1><div class="head-actions"><button class="btn small" data-act="addCard">＋ Add</button><button class="icon" data-act="collMenu" aria-label="More collection actions">⋯</button></div></div>
  ${segmented("collTab", tab, [["cards", "Cards"], ["value", "Value"], ["wishlist", "Wishlist"]])}
  ${tab === "value" ? collectionValueView() : tab === "wishlist" ? wishlistView() : collectionCards()}`;
}

function collectionCards() {
  const st = S.state;
  if (!st.collection.length)
    return empty("Start with the cards in front of you", "Add one card, scan it, or import a ManaBox / Moxfield / CSV export. Nothing counts as owned until you add it.", `<button class="btn" data-act="addCard">Add a card</button><button class="btn ghost" data-act="importCollection">Import a list</button>`);
  const value = collectionValue(st.collection, S.catalog, st.printings, []);
  return `<p class="summary-line"><b>${sumQty(st.collection)}</b> copies · <b>${new Set(st.collection.map((e) => key(e.name))).size}</b> names · <b>${usd(value.total, 0)}</b>${value.unpriced ? ` <span class="muted">(${value.unpriced} unpriced)</span>` : ""}</p>
  <div class="toolbar"><input type="search" value="${esc(S.ui.q.coll)}" placeholder="Search name, set, binder…" data-input="collSearch" aria-label="Search collection"><select data-change="collSort" aria-label="Sort">${options([["name", "A–Z"], ["value", "Value ↓"], ["recent", "Recent"], ["color", "Color"], ["mv", "Mana value"]], S.ui.collSort)}</select><select data-change="collFilter" aria-label="Filter">${options([["all", "All"], ["spare", "Not in a deck"], ["review", "Printing to review"], ["foil", "Foils"], ["unpriced", "Unpriced"]], S.ui.collFilter)}</select></div>
  <div id="collList">${collectionList()}</div>`;
}

export function collectionList() {
  const st = S.state,
    q = S.ui.q.coll.toLowerCase(),
    used = new Map();
  for (const d of st.decks) for (const c of aggregateCards(d.cards)) used.set(key(c.name), (used.get(key(c.name)) || 0) + c.qty);
  const order = new Map(st.collection.map((e, i) => [e.id, i]));
  let list = st.collection.filter((e) => {
    if (q && ![e.name, e.set, e.setName, e.location].some((v) => (v || "").toLowerCase().includes(q))) return false;
    switch (S.ui.collFilter) {
      case "spare": return !used.has(key(e.name));
      case "review": return !e.printingVerified;
      case "foil": return e.finish !== "nonfoil";
      case "unpriced": return lotPrice(e, S.catalog, st.printings) === null;
    }
    return true;
  });
  const val = (e) => (lotPrice(e, S.catalog, st.printings) ?? -1) * e.qty,
    colorRank = (e) => {
      const id = meta(e.name)?.color_identity || [];
      return id.length > 1 ? 6 : id.length ? "WUBRG".indexOf(id[0]) : 5;
    };
  list.sort((a, b) =>
    S.ui.collSort === "value" ? val(b) - val(a)
    : S.ui.collSort === "recent" ? order.get(b.id) - order.get(a.id)
    : S.ui.collSort === "color" ? colorRank(a) - colorRank(b) || a.name.localeCompare(b.name)
    : S.ui.collSort === "mv" ? (meta(a.name)?.cmc ?? 99) - (meta(b.name)?.cmc ?? 99) || a.name.localeCompare(b.name)
    : a.name.localeCompare(b.name),
  );
  const total = list.length;
  list = list.slice(0, S.ui.collLimit);
  if (!total) return `<p class="muted center pad">No cards match.</p>`;
  return `<div class="list">${list
    .map((e) => {
      const c = (e.printingVerified && st.printings?.[e.printingId]) || meta(e.name),
        unit = lotPrice(e, S.catalog, st.printings);
      return `<div class="lot">
        <button class="lot-art" data-act="card" data-name="${esc(e.name)}" aria-label="Open ${esc(e.name)}">${img(art(c), e.name)}</button>
        <div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(e.name)}">${esc(e.name)} ${setBadge(e.printingVerified ? c : {set:e.set,set_name:e.setName,collector_number:e.collectorNumber}, {physical:true,unspecified:!e.set&&!e.printingVerified})}</button>
          <span class="lot-sub">${manaCost(c)}<span>${esc((e.set || e.setName || "Any printing").toUpperCase())}${e.collectorNumber ? " #" + esc(e.collectorNumber) : ""}${e.finish !== "nonfoil" ? ` · <b class="foil">${esc(e.finish)}</b>` : ""}${e.condition && e.condition !== "Near Mint" ? " · " + esc(e.condition) : ""}${e.location ? " · " + esc(e.location) : ""}</span></span>
          ${e.lookupFailed ? `<button class="tag warn" data-act="editLot" data-id="${e.id}">Not found — tap to fix name</button>` : !c ? `<span class="tag muted">Looking up…</span>` : ""}
        </div>
        <div class="lot-side"><span class="price">${usd(unit === null ? null : unit * e.qty)}</span>
          <span class="stepper"><button data-act="qty" data-id="${e.id}" data-delta="-1" aria-label="Remove one">−</button><b>${e.qty}</b><button data-act="qty" data-id="${e.id}" data-delta="1" aria-label="Add one">＋</button></span>
          <button class="link small" data-act="editLot" data-id="${e.id}">Edit</button>
        </div>
      </div>`;
    })
    .join("")}</div>${total > list.length ? `<button class="btn ghost block" data-act="collMore">Show more (${total - list.length})</button>` : ""}`;
}

function collectionValueView() {
  const st = S.state,
    v = collectionValue(st.collection, S.catalog, st.printings, st.decks),
    hist = st.valueHistory || [],
    first = hist[0],
    colorNames = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", Multi: "Multicolor", Colorless: "Colorless" },
    maxColor = Math.max(1, ...Object.values(v.colors));
  if (!st.collection.length) return empty("No value to track yet", "Add cards and Cardforge records your collection value once a day so you can watch it change.");
  return `<section class="panel">
    <div class="row between"><div><p class="eyebrow">Estimated value</p><p class="big">${usd(v.total)}</p><p class="muted small">${v.copies} copies${v.unpriced ? ` · ${v.unpriced} without a price` : ""}${first && first.total && first.date !== new Date().toISOString().slice(0, 10) ? ` · ${signed(v.total - first.total, (x) => usd(x))} since ${esc(first.date)}` : ""}</p></div><button class="btn ghost small" data-act="refreshPrices">↻ Refresh prices</button></div>
    ${lineChart(hist)}
  </section>
  <section class="panel"><h3>By color</h3>${Object.entries(v.colors)
    .filter(([, x]) => x > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, x]) => `<div class="meter"><span>${colorNames[k]}</span>${bar(x / maxColor, "c-" + k)}<b>${usd(x, 0)}</b></div>`)
    .join("")}</section>
  <section class="panel"><h3>Most valuable</h3><div class="list compact">${v.top
    .map((t) => `<button class="mini-row" data-act="card" data-name="${esc(t.entry.name)}"><span class="ellip">${t.entry.qty > 1 ? t.entry.qty + "× " : ""}${esc(t.entry.name)}${t.entry.finish !== "nonfoil" ? ` <b class="foil">${esc(t.entry.finish)}</b>` : ""}</span><b>${usd(t.value)}</b></button>`)
    .join("")}</div></section>
  <section class="panel"><div class="row between"><div><h3>Trade binder</h3><p class="muted small">Owned cards no deck uses: ${sumQty(v.spare)} copies · ${usd(v.spareValue)}</p></div>${v.spare.length ? `<button class="btn ghost small" data-act="copySpare">Copy list</button>` : ""}</div><div class="list compact">${v.spare
    .slice(0, 30)
    .map((t) => `<button class="mini-row" data-act="card" data-name="${esc(t.name)}"><span class="ellip">${t.qty > 1 ? t.qty + "× " : ""}${esc(t.name)}</span><b>${usd(t.value)}</b></button>`)
    .join("") || '<p class="muted small">Every card you own is used by a deck.</p>'}</div></section>
  <p class="foot">Scryfall reference prices for the printing and finish you recorded (or a default printing). Real offers vary by condition and seller.</p>`;
}

export function wishlistItems() {
  return S.state.wishlist
    .map((w) => ({ ...w, need: Math.max(0, w.qty - inv(w.name).available) }))
    .filter((w) => w.need > 0);
}

function wishlistView() {
  const items = wishlistItems(),
    st = S.state,
    sub = items.reduce((a, w) => a + (priceOf(w.name, w.finish) ?? 0) * w.need, 0),
    total = (sub + (items.length ? Number(st.settings.shipping) : 0)) * (1 + Number(st.settings.tax) / 100);
  return `<div class="searchbar"><input id="wishName" placeholder="Add a card to your wishlist" data-enter="wishAdd" aria-label="Wishlist card"><button class="btn" data-act="wishAdd">Add</button></div>
  ${
    items.length
      ? `<div class="list">${items
          .map((w) => {
            const c = meta(w.name),
              p = priceOf(w.name, w.finish);
            return `<div class="lot"><button class="lot-art" data-act="card" data-name="${esc(w.name)}">${img(art(c), w.name)}</button><div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(w.name)}">${esc(w.name)}</button><span class="lot-sub">Need ${w.need}${S.state.decks.some((d) => d.cards.some((x) => key(x.name) === key(w.name))) ? " · used in a deck" : ""}</span></div><div class="lot-side"><span class="price">${usd(p === null ? null : p * w.need)}</span><button class="link small danger" data-act="wishRemove" data-id="${w.id}">Remove</button></div></div>`;
          })
          .join("")}</div>
        <section class="panel">${costBlock(sub, total, st.settings.budget, "wishlist budget")}<div class="actions wrap"><button class="btn" data-act="copyShopping" data-src="wish">Copy list</button><a class="btn ghost" href="https://www.tcgplayer.com/massentry" target="_blank" rel="noopener">TCGplayer Mass Entry ↗</a></div></section>`
      : empty("Nothing on your wishlist", "Add cards you want. Copies you already own are subtracted automatically.")
  }`;
}

export function costBlock(sub, total, budget, label) {
  const st = S.state;
  return `<div class="cost"><span>Cards</span><b>${usd(sub)}</b></div>
  <div class="cost"><label>Shipping $<input type="number" min="0" step="0.01" value="${st.settings.shipping}" data-change="setting" data-field="shipping"></label><label>Tax %<input type="number" min="0" max="100" step="0.1" value="${st.settings.tax}" data-change="setting" data-field="tax"></label></div>
  <div class="cost total"><span>Estimated total</span><b>${usd(total)}</b></div>
  ${budget !== undefined && budget !== null ? `<p class="small ${total > budget ? "warn-text" : "ok-text"}">${total > budget ? usd(total - budget) + " over" : usd(budget - total) + " under"} your ${usd(budget, 0)} ${label}.</p>` : ""}`;
}

/* ---------- Decks ---------- */

export function decks() {
  const tab = S.ui.decksTab;
  return `<div class="page-head"><h1>Decks</h1><div class="head-actions"><button class="btn small" data-act="importDeck">↥ Import</button><button class="btn small ghost" data-act="newDeck">＋ New</button></div></div>
  ${segmented("decksTab", tab, [["mine", "My decks"], ["ideas", "Ideas"], ["inspiration", "Find decks"]])}<div class="random-tools"><button class="btn ghost small" data-act="randomDeck">🎲 Random Commander deck</button><button class="btn ghost small" data-act="buildRandom" data-format="Standard">⚒ Random deck · any format</button></div>
  ${tab === "ideas" ? ideasView() : tab === "inspiration" ? inspirationView() : myDecks()}`;
}

function myDecks() {
  const st = S.state;
  if (!st.decks.length)
    return empty("No decks yet", "Import a decklist to see artwork, what you already own and what it costs to finish — or start a fresh draft around a commander.", `<button class="btn" data-act="importDeck">Import a deck</button><button class="btn ghost" data-act="newDeck">New draft</button>`);
  const q = S.ui.q.shelf.toLowerCase(),
    list = st.decks.filter((d) => [d.name, d.commander].some((v) => (v || "").toLowerCase().includes(q)));
  return `${st.decks.length > 4 ? `<div class="toolbar"><input type="search" value="${esc(S.ui.q.shelf)}" placeholder="Search decks…" data-input="shelfSearch" aria-label="Search decks"></div>` : ""}<div id="shelfList" class="deck-grid">${list.map((d) => deckTile(d)).join("") || '<p class="muted">No decks match.</p>'}</div>`;
}

export function shelfList() {
  const q = S.ui.q.shelf.toLowerCase();
  return S.state.decks.filter((d) => [d.name, d.commander].some((v) => (v || "").toLowerCase().includes(q))).map((d) => deckTile(d)).join("") || '<p class="muted">No decks match.</p>';
}

function ideasView() {
  const I = S.ui.ideas,
    visible = I.cache.filter((i) => I.filter === "all" || i.plan === I.filter),
    plans = [...new Set(I.cache.map((i) => i.plan))];
  return `<p class="muted">Commanders and strategies your <b>owned</b> cards can already support, ranked by how much of a 100-card deck you could build today for $0.</p>
  <div class="toolbar"><button class="btn" data-act="analyze" ${I.busy ? "disabled" : ""}>${I.busy ? "Analyzing…" : I.cache.length ? "↻ Re-analyze" : "Analyze my collection"}</button><label class="check"><input type="checkbox" data-change="ideasOwned" ${I.ownedOnly ? "checked" : ""}> Owned commanders only</label>${plans.length > 1 ? `<select data-change="ideaFilter" aria-label="Strategy">${options([["all", "All strategies"], ...plans.map((p) => [p, p])], I.filter)}</select>` : ""}</div>
  ${I.msg ? `<p class="muted small" role="status">${esc(I.msg)}</p>` : ""}
  ${
    visible.length
      ? `<div class="deck-grid">${visible
          .slice(0, I.limit)
          .map((i) => {
            const idx = I.cache.indexOf(i);
            return `<article class="idea"><button class="idea-art" data-act="openIdea" data-i="${idx}" aria-label="See the full ${esc(i.commander.name)} deck">${img(art(i.commander), i.commander.name)}<span class="chip dark">${esc(i.plan)}</span><span class="chip dark see">${i.slots === 100 ? "View all 100 cards →" : "Build a full 100-card deck →"}</span></button><div class="idea-body"><button class="idea-title" data-act="openIdea" data-i="${idx}">${esc(i.commander.name)}</button><small>${esc(i.reason)}</small><div class="row between small"><span><b>${i.available}</b>/100 from your cards</span><span>${i.themeCards} on-plan</span></div>${bar(i.available / 100, "thin")}<div class="actions"><button class="btn small" data-act="openIdea" data-i="${idx}">View deck</button><button class="btn small ghost" data-act="saveIdea" data-i="${idx}">Save as deck</button></div></div></article>`;
          })
          .join("")}</div>${visible.length > I.limit ? `<button class="btn ghost block" data-act="ideasMore">Show more</button>` : ""}`
      : I.cache.length
        ? `<p class="muted">No ideas match this filter.</p>`
        : !S.state.collection.length
          ? empty("Ideas come from your cards", "Add your collection and Cardforge finds the commanders and strategies it already supports. No collection yet? Try the example, or browse decks you can almost build.", `<button class="btn" data-act="importCollection">↥ Import collection</button><button class="btn ghost" data-act="loadExample">Try example collection</button><button class="btn ghost" data-act="go" data-to="#decks/inspiration">✧ Explore starter decks</button>`)
          : empty("Find what your cards want to be", "Analysis loads card data for your whole collection in a few batched requests, then tries every legendary creature you own as a commander.")
  }`;
}

function inspirationView() {
  const st = S.state,
    q = S.ui.q.ref.toLowerCase(),
    refs = (st.references || []).filter((d) => [d.name, d.commander, d.source?.author, d.source?.website].some((v) => (v || "").toLowerCase().includes(q)));
  return `${finderPanel()}
  <h2 class="section-title">Saved decks</h2><p class="muted">Save decks you admire — community lists, shared links or precons — with credit to the creator. Match them to your cards and build your own version.</p>
  <div class="toolbar"><button class="btn" data-act="importReference">↥ Save a deck idea</button>${(st.references || []).length > 3 ? `<input type="search" value="${esc(S.ui.q.ref)}" placeholder="Search saved ideas…" data-input="refSearch">` : ""}</div>
  <div class="deck-grid">${refs
    .map((d) => {
      const t = comparisonTotals(rowsFor({ ...d, id: "reference:" + d.id }));
      return `<article class="idea"><div class="idea-art">${img(coverOf(d), d.name)}<span class="chip dark">${esc(d.source?.kind || d.format)}</span></div><div class="idea-body"><b>${esc(d.name)}</b><small>${esc(d.commander || "")}${d.source?.author ? " · by " + esc(d.source.author) : ""}${d.source?.website ? " · " + esc(d.source.website) : ""}</small><div class="row between small"><span><b>${t.covered}</b>/${t.copies} owned</span><span>${usd(t.pricedGap, 0)} to finish</span></div>${bar(t.copies ? t.covered / t.copies : 0, "thin")}<div class="actions wrap"><button class="btn small" data-act="copyRef" data-id="${esc(d.id)}">Build my version</button>${d.source?.url ? `<a class="link small" href="${esc(d.source.url)}" target="_blank" rel="noopener noreferrer">Original ↗</a>` : ""}<button class="link small" data-act="exportRef" data-id="${esc(d.id)}">Export</button><button class="link small danger" data-act="deleteRef" data-id="${esc(d.id)}">Remove</button></div></div></article>`;
    })
    .join("")}</div>
  <section class="panel"><h3>Precons</h3><p class="muted small">Find a preconstructed Commander deck by product name (MTGJSON), preview it against your collection, then save it.</p><div class="toolbar"><button class="btn ghost" data-act="loadPrecons" ${S.ui.precon.busy ? "disabled" : ""}>${S.ui.precon.index.length ? "Reload list" : "Load precon list"}</button>${S.ui.precon.index.length ? `<input type="search" value="${esc(S.ui.q.precon)}" placeholder="Product or deck name…" data-input="preconSearch">` : ""}</div>${S.ui.precon.msg ? `<p class="muted small">${esc(S.ui.precon.msg)}</p>` : ""}<div id="preconList">${preconList()}</div></section>`;
}

/* ---------- Decks I can almost build ---------- */

// Free copies per card (owned minus copies reserved or locked in assembled decks), computed once.
export function availability() {
  const owned = new Map(),
    held = new Map();
  for (const e of S.state.collection) {
    const k = key(e.name);
    owned.set(k, (owned.get(k) || 0) + e.qty);
    held.set(k, (held.get(k) || 0) + (e.reserved || 0));
  }
  for (const d of S.state.decks) if (d.locked) for (const c of d.cards) held.set(key(c.name), (held.get(key(c.name)) || 0) + c.qty);
  return (name) => Math.max(0, (owned.get(key(name)) || 0) - (held.get(key(name)) || 0));
}

// "Assume I have basic lands" (on by default): basics are left out of cost and ownership, and shown separately.
const basic = (n) => S.ui.finder.basics && isBasic(meta(n));

export function finderCandidates() {
  const avail = availability(),
    out = [];
  for (const d of S.state.references || [])
    out.push({ kind: "saved", id: d.id, deck: d, source: d.source?.kind === "Shared deck" ? `Shared by ${d.source.author || "a player"}` : d.source?.kind === "MTGJSON precon" ? "Precon" : d.source?.author ? `by ${d.source.author}` : "Saved deck" });
  const savedNames = new Set((S.state.references || []).map((d) => key(d.name)));
  for (const p of S.ui.finder.precons) if (!savedNames.has(key(p.name))) out.push({ kind: "precon", id: p.file, deck: p, source: `Precon · ${p.released?.slice(0, 4) || ""}` });
  for (const x of out) {
    x.score = buildability(x.deck, avail, (n) => priceOf(n), basic);
    x.identity = meta(x.deck.commander)?.color_identity || [];
  }
  return out;
}

function finderPanel() {
  const F = S.ui.finder,
    all = finderCandidates(),
    list = rankBuildable(all, { maxCost: F.max === "" ? null : Number(F.max), query: F.q, colors: F.colors, sort: F.sort }),
    noCards = !S.state.collection.length;
  return `<section class="panel finder"><p class="eyebrow">Find decks</p><h2>Decks you can almost build</h2>
  <p class="muted small">Precons, shared decks and decks you’ve saved, ranked by what it would cost to finish them from your collection. Copies locked in assembled decks don’t count as free.${noCards ? " <b>Add your collection first</b> — until then every card counts as missing." : ""}</p>
  <div class="finder-controls">
    <label>Max to finish $<input type="number" min="0" step="5" value="${esc(F.max)}" placeholder="Any" data-change="finderMax"></label>
    <label>Colors<select data-change="finderColors">${options([["", "Any"], ["W", "White"], ["U", "Blue"], ["B", "Black"], ["R", "Red"], ["G", "Green"]], F.colors)}</select></label>
    <label>Sort<select data-change="finderSort">${options([["cost", "Cheapest to finish"], ["owned", "Most owned"]], F.sort)}</select></label>
    <label class="check span-all"><input type="checkbox" data-change="finderBasics" ${F.basics ? "checked" : ""}> Assume I have basic lands <span class="muted">(lands are listed separately)</span></label>
    <label class="span-all">Commander or deck<input type="search" value="${esc(F.q)}" placeholder="e.g. Atraxa, tokens" data-input="finderSearch" autocomplete="off"></label>
  </div>
  <div class="row between wrap"><span class="muted small">${all.length ? `${list.length} of ${all.length} decks` : "No decks checked yet"}${F.msg ? " · " + esc(F.msg) : ""}</span><button class="btn ghost small" data-act="finderPrecons" ${F.busy ? "disabled" : ""}>${F.busy ? "Checking…" : F.precons.length ? "Check 10 more precons" : "Check the 10 newest precons"}</button></div>
  <div class="finder-list">${list
    .slice(0, F.limit)
    .map((x) => {
      const sc = x.score,
        top = sc.need.slice(0, 3).map((n) => esc(n.name)).join(", ");
      return `<article class="finder-item"><div class="finder-art">${img(art(meta(x.deck.commander)) || art(meta(x.deck.cards[0]?.name)), x.deck.name)}</div><div class="finder-main">
        <div class="row between"><b class="ellip">${esc(x.deck.name)}</b><span class="chip">${esc(x.source)}</span></div>
        <small class="muted ellip">${colorDots(meta(x.deck.commander))} ${esc(x.deck.commander || "")}</small>
        <div class="row between small"><span><b>${pct(sc.ratio)}</b> owned · need ${sc.missing}</span><span><b>${sc.missing ? usd(sc.cost) : "$0"}</b>${sc.unknown ? ` <span class="muted">+ ${sc.unknown} unknown</span>` : ""} to finish</span></div>
        ${bar(sc.ratio, "thin")}
        ${sc.skipped ? `<small class="muted">Plus ${sc.skipped} basic lands, assumed owned</small>` : ""}
        ${sc.missing ? `<details><summary class="small">Missing cards${top ? ` · priciest: ${top}` : ""}</summary><div class="list compact">${sc.need.map((n) => `<button class="mini-row" data-act="card" data-name="${esc(n.name)}"><span class="ellip">${n.qty > 1 ? n.qty + "× " : ""}${esc(n.name)}</span><span class="small">${n.price === null ? "Unknown" : usd(n.price * n.qty)}</span></button>`).join("")}</div></details>` : `<p class="small ok-text">You own every card.</p>`}
        <div class="actions wrap"><button class="btn small" data-act="finderBuild" data-kind="${x.kind}" data-id="${esc(x.id)}">Make my version</button>${x.kind === "precon" ? `<button class="btn ghost small" data-act="finderSave" data-id="${esc(x.id)}">Save</button>` : ""}</div>
      </div></article>`;
    })
    .join("")}</div>
  ${list.length > F.limit ? `<button class="btn ghost block" data-act="finderMore">Show more</button>` : ""}
  ${all.length && !list.length ? `<p class="muted small">No decks match — raise the price limit or clear the filters.</p>` : ""}
  <p class="foot">Prices are Scryfall estimates; “unknown” means no current price. Making your version copies the list with credit to its source — your collection doesn’t change.</p></section>`;
}

/* ---------- Shared deck page (#shared/…) ---------- */

export function sharedPage() {
  const sh = S.ui.shared;
  if (sh.error) return empty("Can’t open this deck", esc(sh.error), `<button class="btn" data-act="go" data-to="#home">Go home</button>`);
  if (!sh.deck) return `<p class="muted center pad">Opening shared deck…</p>`;
  const d = { ...sh.deck, id: "shared" },
    avail = availability(),
    sc = buildability(d, avail, (n) => priceOf(n), basic),
    p = engineProfile(d, S.catalog),
    br = d.format === "Commander" ? bracketEstimate(d, S.catalog) : null,
    fm = formatOf(d),
    v = validateDeck(d, S.catalog, [], []),
    rules = v.issues.filter((i) => i.kind !== "unverified"),
    target = fm.size,
    g = goldfishFor(d),
    lands = p.counts.Lands,
    nonCmd = sumQty(d.cards.filter((c) => !fm.commander || key(c.name) !== key(d.commander))),
    odds = nonCmd >= 7 ? atLeastLands(nonCmd, lands, 7, 3) : null,
    groups = {};
  for (const c of aggregateCards(d.cards)) {
    const m = meta(c.name),
      t = key(c.name) === key(d.commander) ? "Commander" : !m ? "Unresolved" : isLand(m) ? "Lands" : (["Creature", "Planeswalker", "Artifact", "Enchantment", "Instant", "Sorcery", "Battle"].find((x) => typeText(m).includes(x)) || "Other") + "s";
    (groups[t] = groups[t] || []).push(c);
  }
  const order = ["Commander", "Creatures", "Planeswalkers", "Artifacts", "Enchantments", "Instants", "Sorcerys", "Battles", "Others", "Lands", "Unresolved"];
  return `<section class="deck-hero">${img(art(meta(d.commander)) || art(meta(d.cards[0]?.name)), d.name, "hero-art")}<div class="hero-shade"></div>
    <div class="hero-body"><div class="row between"><button class="icon light" data-act="go" data-to="#home" aria-label="Home">←</button><span class="chip dark">Shared deck</span></div>
      <h1>${esc(d.name)}</h1>
      <p>${fm.commander ? colorDots(meta(d.commander)) + " " + esc(d.commander || "") + " · " : ""}<span class="chip dark">${esc(fm.name)}</span>${d.author ? ` · by <b>${esc(d.author)}</b>` : ""}</p>
      <div class="hero-stats"><span><b class="${sumQty(d.cards) === target ? "" : "warn-text"}">${sumQty(d.cards)}/${target}</b>cards</span><span><b>${p.score}</b>engine</span>${br ? `<span><b>${br.bracket}</b>bracket est.</span>` : ""}<span><b>${d.budget !== null ? usd(d.budget, 0) : "—"}</b>budget</span></div>
    </div></section>
  <div class="actions wrap share-actions"><button class="btn" data-act="sharedBuild">Make my version</button><button class="btn ghost" data-act="sharedSave">Save to Inspiration</button><button class="btn ghost" data-act="sharedCopy">Copy list</button></div>
  ${d.about ? `<section class="panel"><h3>About this deck</h3><p class="about">${esc(d.about)}</p><p class="foot">Written by ${esc(d.author || "the person who shared it")}.</p></section>` : ""}
  <section class="panel"><div class="row between"><h3>Match against my collection</h3><span class="chip ${sc.missing ? "" : "ok"}">${pct(sc.ratio)} owned</span></div>
    ${S.state.collection.length ? `<div class="kpis small"><div class="kpi"><b>${sc.owned}</b><span>you own</span></div><div class="kpi"><b>${sc.missing}</b><span>missing</span></div><div class="kpi"><b>${usd(sc.cost, 0)}</b><span>to finish${sc.unknown ? ` · ${sc.unknown} unknown` : ""}</span></div></div>${bar(sc.ratio, "good")}` : `<p class="muted small">Add your collection to see what you already own. <button class="link" data-act="importCollection">Import collection</button></p>`}
    <p class="foot">Counts only your free copies${sc.skipped ? ` and assumes you have the ${sc.skipped} basic lands (change this under Decks → Find decks)` : ""}. The person who shared this can’t see your collection, and their link doesn’t include theirs.</p></section>
  <section class="panel"><h3>Automated checks</h3>
    <ul class="checks">
      <li class="${rules.length ? "bad-text" : "ok-text"}">${rules.length ? `● ${rules.length} rules issue${rules.length > 1 ? "s" : ""}: ${esc(rules.slice(0, 3).map((i) => i.text).join(" "))}` : "✓ Card count, colors, legality and copy limits pass"}</li>
      <li>Lands <b>${lands}</b> · ramp <b>${p.counts.Ramp}</b> · draw <b>${p.counts.Draw}</b> · removal <b>${p.counts.Removal}</b> · average mana value <b>${p.avg === null ? "—" : p.avg.toFixed(2)}</b></li>
      ${odds !== null ? `<li>${pct(odds)} of opening hands have 3+ lands</li>` : ""}
      ${g ? `<li>Test games: ${pct(g.landsBy4)} hit 4 lands by turn 4${g.commander ? ` · commander on curve ${pct(g.commander.onCurve ?? 0)}` : ""}</li>` : ""}
      ${br ? `<li>Bracket estimate <b>${br.bracket} · ${esc(br.name)}</b>${br.reasons.length ? ` (${esc(br.reasons.join(", "))})` : ""}</li>` : ""}
    </ul><p class="foot">Calculated by Cardforge from the list and card text — simulations and estimates, not win rates.</p></section>
  <section class="panel"><h3>Full list</h3>${order
    .filter((t) => groups[t])
    .map((t) => `<p class="list-head">${t === "Sorcerys" ? "Sorceries" : t} <span class="muted">${sumQty(groups[t])}</span></p><div class="list compact">${groups[t]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => {
        const have = Math.min(c.qty, avail(c.name));
        return `<button class="mini-row" data-act="card" data-name="${esc(c.name)}"><span class="row ellip">${manaCost(meta(c.name))}<span class="ellip">${c.qty > 1 ? c.qty + "× " : ""}${esc(c.name)}</span></span><span class="small ${S.state.collection.length ? (have >= c.qty ? "ok-text" : "warn-text") : "muted"}">${S.state.collection.length ? (have >= c.qty ? "owned" : "need " + (c.qty - have)) : usd(priceOf(c.name))}</span></button>`;
      })
      .join("")}</div>`)
    .join("")}</section>`;
}

export function shareSheet(d, link = "") {
  return `<div class="sheet-head"><h2>Share this deck</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <p class="muted small">Anyone with the link can view the list, match it against their own collection and make their own version. No account needed.</p>
  <label class="field">Shown as creator<input id="shareAuthor" maxlength="60" value="${esc(S.state.settings.authorName || "")}" placeholder="Your name or handle"></label>
  <label class="field">About this deck <span class="muted small">(optional)</span><textarea id="shareAbout" rows="5" maxlength="1500" placeholder="How it wins, what to keep in an opening hand, weak spots, budget swaps…">${esc(d.about || "")}</textarea></label>
  <div class="note"><b>What’s shared:</b> deck name, commander, format, focus, budget, your note and the card list.<br><b>Never shared:</b> your collection, which cards you own, values or play log.</div>
  <button class="btn block" data-act="shareMake">${link ? "Update link" : "Create link"}</button>
  ${link ? `<div class="share-link"><input id="shareLink" readonly value="${esc(link)}" aria-label="Share link"><div class="actions wrap"><button class="btn" data-act="shareCopy">Copy link</button>${typeof navigator !== "undefined" && navigator.share ? `<button class="btn ghost" data-act="shareNative">Share…</button>` : ""}<a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Preview ↗</a></div><p class="foot">${link.length.toLocaleString()} characters. The link holds the list itself, so changes you make later need a new link.</p></div>` : ""}`;
}

export function preconList() {
  const q = S.ui.q.precon.toLowerCase();
  if (!S.ui.precon.index.length) return "";
  return `<div class="list compact">${S.ui.precon.index
    .filter((d) => /commander/i.test(d.type || "") || q)
    .filter((d) => (d.name + " " + d.code + " " + d.type).toLowerCase().includes(q))
    .sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")))
    .slice(0, 30)
    .map((d) => `<button class="mini-row" data-act="previewPrecon" data-file="${esc(d.fileName)}"><span class="ellip">${esc(d.name)} <span class="muted">· ${esc(d.code)} ${esc((d.releaseDate || "").slice(0, 4))}</span></span><span class="link">Preview</span></button>`)
    .join("") || '<p class="muted small">No match.</p>'}</div>`;
}

/* ---------- Deck page ---------- */

export function deckPage() {
  const d = currentDeck();
  if (!d) return empty("Deck not found", "It may have been deleted.", `<button class="btn" data-act="go" data-to="#decks">Back to decks</button>`);
  const t = totalsFor(d),
    p = engineProfile(d, S.catalog),
    v = deckValue(d.cards, S.catalog, S.state.priceChoices),
    fm = formatOf(d),
    target = fm.size,
    tab = S.ui.deckTab,
    tabs = [["cards", "Cards"], ["engine", "Engine"], ["upgrade", "Upgrade lab"], ["versions", "Versions"], ["playtest", "Playtest"], ["shop", t.missing ? `Shop · ${t.missing}` : "Shop"]];
  return `<section class="deck-hero">${img(coverOf(d), d.name, "hero-art")}<div class="hero-shade"></div>
    <div class="hero-body">
      <div class="row between"><button class="icon light" data-act="go" data-to="#decks" aria-label="Back to decks">←</button><button class="icon light" data-act="deckMenu" aria-label="Deck options">⋯</button></div>
      <h1>${esc(d.name)}</h1>
      <p>${fm.commander ? colorDots(meta(d.commander)) + " " + esc(d.commander || "No commander yet") + " · " : ""}<button class="chip dark fmt-chip" data-act="deckMenu" title="${esc(sizeLabel(fm))}${fm.note ? " · " + esc(fm.note) : ""}">${esc(fm.name)}</button>${d.locked ? ' · <span class="chip dark">Assembled</span>' : ""}</p>
      ${reviewBadge(d)}
      <div class="hero-stats">
        <span><b class="${t.copies === target ? "" : "warn-text"}">${t.copies}/${target}</b>cards</span>
        <span><b>${t.copies ? Math.round((t.covered / t.copies) * 100) : 0}%</b>owned</span>
        <span><b>${usd(v.total, 0)}</b>value</span>
        <button data-act="deckTab" data-id="engine"><b>${p.score}</b>engine</button>
      </div>
    </div>
  </section>
  <nav class="tabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? "on" : ""}" data-act="deckTab" data-id="${id}">${l}</button>`).join("")}</nav>
  ${fm.commander && !canLead(meta(d.commander), fm) && tab !== "upgrade" ? `<button class="note warn block-note" data-act="deckTab" data-id="upgrade">⚠ No ${fm.commander === "planeswalker" ? "Oathbreaker" : "commander"} set — tap to choose one so colors and synergy are checked.</button>` : ""}
  <div class="deck-body" data-tab="${tab}">${{ cards: deckCards, engine: deckEngine, upgrade: deckUpgrade, versions: deckVersions, playtest: deckPlaytest, shop: deckShop }[tab](d, t)}</div>`;
}

function reviewBadge(d) {
  const r = deckReview(d, S.catalog, S.state.collection, S.state.decks),
    bad = r.some((x) => x.level === "bad");
  return r.length
    ? `<button class="review-badge ${bad ? "bad" : "warn"}" data-act="deckReview">${bad ? "●" : "▲"} ${r.length} to review</button>`
    : `<button class="review-badge ok" data-act="deckReview">✓ Nothing to review</button>`;
}

export function deckReviewSheet(d) {
  const r = deckReview(d, S.catalog, S.state.collection, S.state.decks);
  return `<div class="sheet-head"><h2>Deck review</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  ${
    r.length
      ? `<p class="muted small">${r.length} thing${r.length > 1 ? "s" : ""} worth a look in ${esc(d.name)}. <span class="bad-text">●</span> breaks a rule · <span class="warn-text">▲</span> worth reviewing.</p>
  <div class="review-list">${r
    .map(
      (x) => `<div class="review-item ${x.level}"><span class="review-icon" aria-hidden="true">${x.level === "bad" ? "●" : "▲"}</span><div class="review-main">
      <div class="row between"><b>${esc(x.title)}</b><span class="chip">${x.level === "bad" ? "Rule" : x.heuristic ? "Guideline" : "Check"}</span></div>
      <p class="small muted">${esc(x.detail)}</p>
      ${x.cards?.length ? `<p class="small">${x.cards.slice(0, 8).map((n) => `<button class="link" data-act="card" data-name="${esc(n)}" data-deck="${esc(d.id)}">${esc(n)}</button>`).join(", ")}${x.cards.length > 8 ? ` +${x.cards.length - 8} more` : ""}</p>` : ""}
      ${x.action ? `<button class="btn ghost small" data-act="${x.action.act}"${x.action.id ? ` data-id="${x.action.id}"` : ""}${x.action.role ? ` data-role="${x.action.role}"` : ""}>${esc(x.action.label)} →</button>` : ""}
    </div></div>`,
    )
    .join("")}</div>`
      : `<div class="empty"><div class="empty-mark" aria-hidden="true">✓</div><h3>Nothing to review</h3><p>Card count, colors, legality and copy limits pass${sumQty(d.cards) >= formatOf(d).size * 0.9 ? ", and land, ramp, draw and removal counts are in normal ranges" : ""}.</p></div>`
  }
  <p class="foot">Rules checks use cached card data — refresh before an event. Guidelines are common deckbuilding rules of thumb, not requirements; plenty of good decks break them on purpose.</p>`;
}

const CATS = ["Commander", "Creatures", "Planeswalkers", "Artifacts", "Enchantments", "Instants", "Sorceries", "Battles", "Lands", "Unresolved"];

function deckCards(d, t) {
  const target = formatOf(d).size;
  return `<div class="add-row"><input id="deckAddName" placeholder="Add a card by name" data-enter="deckAdd" aria-label="Card name to add" autocomplete="off"><button class="btn" data-act="deckAdd">Add</button></div>
  <div class="cover-line"><span><b>${t.covered}</b>/${t.copies} owned${t.missing ? ` · <b>${t.missing}</b> missing · <b>${usd(t.pricedGap)}</b>${t.unpriced ? "+" : ""} to finish` : " · everything owned ✓"}</span>${t.copies < target ? (d.format === "Commander" ? `<button class="link" data-act="deckTab" data-id="upgrade">Fill ${target - t.copies} slots →</button>` : `<button class="link" data-act="formatSearch">Find ${esc(formatOf(d).name)} cards →</button>`) : ""}</div>
  ${bar(t.copies ? t.covered / t.copies : 0)}
  <div class="toolbar"><input type="search" value="${esc(S.ui.q.deck)}" placeholder="Search this deck" data-input="deckSearch" aria-label="Search deck"><select data-change="deckFilter" aria-label="Show">${options([["all", "All"], ["missing", "Missing"], ["owned", "Owned"], ["unresolved", "Unresolved"]], S.ui.deckFilter)}</select><select data-change="deckSort" aria-label="Group by">${options([["type", "By type"], ["mv", "By mana value"], ["role", "By role"], ["price", "By price"]], S.ui.deckSort)}</select><button class="icon" data-act="deckGrid" aria-label="Toggle grid">${S.ui.deckGrid ? "☰" : "▦"}</button></div>
  <div id="deckList">${deckList(d)}</div>
  ${t.missing ? `<div class="sticky-bar"><span><b>${t.missing}</b> to get · ${usd(t.pricedGap, 0)}</span><span><button class="btn ghost small" data-act="deckTab" data-id="shop">Shop</button><button class="btn small" data-act="acquire">I got cards</button></span></div>` : ""}`;
}

export function deckList(d = currentDeck()) {
  const q = S.ui.q.deck.toLowerCase();
  let rows = rowsFor(d).filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q)) &&
      (S.ui.deckFilter === "all" ||
        (S.ui.deckFilter === "missing" && r.missing > 0) ||
        (S.ui.deckFilter === "owned" && r.missing === 0) ||
        (S.ui.deckFilter === "unresolved" && !meta(r.name))),
  );
  let groups;
  const mv = (r) => meta(r.name)?.cmc ?? 99;
  if (S.ui.deckSort === "mv") {
    groups = new Map();
    for (const r of rows.sort((a, b) => mv(a) - mv(b) || a.name.localeCompare(b.name))) {
      const c = meta(r.name),
        g = r.category === "Commander" ? "Commander" : c && isLand(c) ? "Lands" : !c ? "Unresolved" : "Mana value " + Math.min(7, c.cmc) + (c.cmc >= 7 ? "+" : "");
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(r);
    }
  } else if (S.ui.deckSort === "role") {
    groups = new Map();
    for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) {
      const c = meta(r.name),
        g = r.category === "Commander" ? "Commander" : !c ? "Unresolved" : isLand(c) ? "Lands" : engineRoles(c)[0] || "Threats & synergy";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(r);
    }
  } else if (S.ui.deckSort === "price") {
    groups = new Map([["By price", rows.sort((a, b) => (b.price ?? -1) - (a.price ?? -1))]]);
  } else {
    groups = new Map(CATS.map((c) => [c, rows.filter((r) => r.category === c).sort((a, b) => mv(a) - mv(b) || a.name.localeCompare(b.name))]));
  }
  const html = [...groups]
    .filter(([, list]) => list.length)
    .map(([g, list]) => {
      const val = list.reduce((a, r) => a + (r.price ?? 0) * r.qty, 0);
      return `<details class="group" open><summary><span>${esc(g)} <em>${sumQty(list)}</em></span><span class="muted small">${usd(val)}</span></summary><div class="${S.ui.deckGrid ? "card-grid" : "list"}">${list.map((r) => (S.ui.deckGrid ? deckGridCard(r) : deckRow(r, d))).join("")}</div></details>`;
    })
    .join("");
  return html || `<p class="muted center pad">No cards match.</p>`;
}

// Flags a card that breaks the deck's format: banned, not legal, or restricted.
function legalTag(c, d) {
  const l = c ? legalityIn(c, formatOf(d)) : null;
  return l === "banned" ? '<span class="tag bad">Banned</span>' : l === "not_legal" ? '<span class="tag bad">Not legal</span>' : l === "restricted" ? '<span class="tag warn">Restricted</span>' : "";
}

function deckRow(r, d) {
  const c = meta(r.name),
    ok = r.missing === 0;
  return `<div class="lot deck-row ${ok ? "" : "short"}">
    <button class="lot-art" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${img(art(c), r.name)}<span class="art-price">${usd(r.price)}</span></button>
    <div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${esc(r.name)} ${setBadge(c)}</button>
      <span class="lot-sub">${manaCost(c) || (c ? "" : '<span class="tag warn">Unresolved</span>')}${legalTag(c, d)}</span>
      <span class="own ${ok ? "yes" : "no"}">${ok ? "Owned" : r.covered ? `${r.covered}/${r.qty} owned · need ${r.missing}` : "Need " + r.missing}${r.reserved ? ` · ${r.reserved} in other decks` : ""}</span>
    </div>
    <div class="lot-side">${r.category === "Commander" ? `<span class="chip">Commander</span>` : `<span class="stepper"><button data-act="deckQty" data-name="${esc(r.name)}" data-delta="-1" aria-label="One fewer ${esc(r.name)}">−</button><b>${r.qty}</b><button data-act="deckQty" data-name="${esc(r.name)}" data-delta="1" aria-label="One more ${esc(r.name)}">＋</button></span>`}</div>
  </div>`;
}

function deckGridCard(r) {
  const c = meta(r.name);
  return `<button class="grid-card ${r.missing ? "short" : ""}" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(currentDeck().id)}">${img(cardImage(c), r.name, "card-img")}<span class="grid-set">${setBadge(c)}</span><span class="grid-meta"><span>${r.qty > 1 ? r.qty + "× " : ""}${r.missing ? "need " + r.missing : "owned"}</span><span>${usd(r.price)}</span></span></button>`;
}

/* Engine */

function deckEngine(d) {
  const p = engineProfile(d, S.catalog),
    g = goldfishFor(d),
    v = validateDeck(d, S.catalog, S.state.collection, S.state.decks),
    issues = v.issues.filter((i) => i.kind !== "count"),
    colorTotal = Object.values(p.pips).reduce((a, b) => a + b, 0),
    srcTotal = Object.values(p.sources).reduce((a, b) => a + b, 0),
    colors = Object.keys(p.pips).filter((k) => p.pips[k] > 0 || p.sources[k] > 0);
  return `<section class="panel score-panel">${ring(p.score)}<div><p class="eyebrow">Engine score</p><h2>${scoreGrade(p.score)}</h2><p class="muted small">How well the deck covers the ingredients most Commander decks need: lands, ramp, draw, answers, synergy and a castable curve. It is a build-health check, not a win-rate prediction.</p></div></section>
  ${p.unknown ? `<div class="note warn">${p.unknown} cards have no card data yet, so they aren’t counted. <button class="link" data-act="refreshDeck">Load card data</button></div>` : ""}
  ${d.format === "Commander" ? bracketPanel(d) : ""}
  <section class="panel"><h3>Ingredients</h3>${p.parts
    .map((x) => {
      const low = x.ratio < 0.75;
      return `<div class="ingredient"><div class="row between"><span><b>${esc(x.label)}</b> <span class="muted small">${esc(x.hint)}</span></span><span class="${low ? "warn-text" : ""}">${esc(String(x.count))}<span class="muted">/${esc(String(x.target))}</span></span></div>${bar(x.ratio, low ? "warn" : "good")}${low && ["Ramp", "Draw", "Removal", "Wipe", "Protection", "Synergy"].includes(x.key) ? `<button class="link small" data-act="findRole" data-role="${x.key}">Find ${x.key.toLowerCase()} cards in your colors →</button>` : ""}</div>`;
    })
    .join("")}</section>
  <section class="panel"><div class="row between"><h3>Mana curve</h3><span class="muted small">avg ${p.avg === null ? "—" : p.avg.toFixed(2)} · ${p.counts.Lands} lands</span></div>${curveChart(p.curve)}</section>
  ${
    colors.length
      ? `<section class="panel"><h3>Color balance</h3><p class="muted small">Share of colored mana symbols in your spells vs. share of lands that make that color.</p>${colors
          .map((k) => `<div class="meter two"><span>${sym(k)}</span><span class="pair">${bar(colorTotal ? p.pips[k] / colorTotal : 0, "c-" + k)}${bar(srcTotal ? p.sources[k] / srcTotal : 0, "c-" + k + " faint")}</span><b class="small">${pct(colorTotal ? p.pips[k] / colorTotal : 0)} need · ${pct(srcTotal ? p.sources[k] / srcTotal : 0)} make</b></div>`)
          .join("")}</section>`
      : ""
  }
  ${manaBasePanel(d, p)}
  <section class="panel"><div class="row between"><h3>Test games</h3><span class="muted small">${g ? g.games.toLocaleString() + " simulated" : ""}</span></div>
  ${g ? goldfishTable(g) + `<p class="foot">Solitaire “goldfish” games: shuffle, mulligan 0–1 or 6–7 land hands, play a land and cast what you can for ${g.turns} turns. No opponents; colors are ignored. Useful for comparing versions of the same deck.</p>` : `<p class="muted">Add at least 20 cards with card data to simulate games.</p>`}
  </section>
  <details class="panel"><summary><b>Key cards by role</b></summary>${Object.entries(p.byRole)
    .filter(([, l]) => l.length)
    .map(([r, l]) => `<p class="small"><b>${r}:</b> ${l.map((n) => `<button class="link" data-act="card" data-name="${esc(n)}" data-deck="${esc(d.id)}">${esc(n)}</button>`).join(", ")}</p>`)
    .join("") || '<p class="muted small">No roles recognized yet.</p>'}</details>
  <details class="panel" ${issues.length ? "" : ""}><summary><b>Rules checks</b> <span class="chip ${issues.length ? "warn" : "ok"}">${issues.length ? issues.length + " to fix" : "pass"}</span></summary><ul class="issues">${issues.slice(0, 40).map((i) => `<li>${esc(i.text)}</li>`).join("") || "<li>Color identity, legality and copy limits pass.</li>"}</ul><p class="foot">Single commander only. Legality comes from cached card data — refresh before an event.</p></details>`;
}

const nameLinks = (names, d) =>
  names.map((n) => `<button class="link" data-act="card" data-name="${esc(n)}" data-deck="${esc(d.id)}">${esc(n)}</button>`).join(", ");

function bracketPanel(d) {
  const b = bracketEstimate(d, S.catalog),
    f = b.found,
    line = (label, list, hint = "") =>
      list.length ? `<p class="small"><b>${label} (${list.length}):</b> ${nameLinks([...new Set(list)], d)}${hint ? ` <span class="muted">${hint}</span>` : ""}</p>` : "";
  return `<section class="panel bracket-panel"><div class="bracket-head"><span class="bracket-num b${b.bracket}" aria-hidden="true">${b.bracket}</span><div><p class="eyebrow">Commander bracket estimate</p><h2>Bracket ${b.bracket} · ${esc(b.name)}</h2><p class="muted small">${esc(b.text)}</p></div></div>
  <div class="bracket-scale" role="img" aria-label="Bracket ${b.bracket} of 5">${[1, 2, 3, 4, 5].map((n) => `<span class="${n === b.bracket ? "on" : n < b.bracket ? "past" : ""}">${n}</span>`).join("")}</div>
  <p class="small">${b.reasons.length ? "Why: " + esc(b.reasons.join(" · ")) + "." : "No Game Changers, mass land denial or stacked tutors and extra turns found."}${b.lower.length ? ` To reach bracket ${b.bracket - 1}: ${esc(b.lower.join(", "))}.` : ""}</p>
  ${b.unknown ? `<p class="small warn-text">${b.unknown} cards have no card data yet and weren’t checked.</p>` : ""}
  <details><summary class="small"><b>What Cardforge counted</b></summary>
    ${line("Game Changers", f.gameChangers)}${line("Tutors", f.tutors)}${line("Extra turns", f.extraTurns)}${line("Mass land denial", f.landDenial)}${line("Fast mana", f.fastMana, "(not a bracket rule, but it speeds a deck up)")}
    ${Object.values(f).every((l) => !l.length) ? '<p class="muted small">Nothing flagged.</p>' : ""}
  </details>
  <p class="foot">A floor from card text, not a verdict. Two-card infinite combos and how you play the deck also count, so use this to start your Rule 0 talk.</p></section>`;
}

function manaBasePanel(d, p) {
  const m = manaBase(d, S.catalog, p.pips);
  if (!m.lands) return "";
  const rows = m.changes
    .map((x) => {
      const diff = x.want - x.now;
      return `<div class="mb-row">${sym(x.color)}<span>${esc(x.land)}</span><span class="num">${x.now}</span><span class="num muted">→</span><span class="num"><b>${x.want}</b></span><span class="num small ${diff ? (diff > 0 ? "up" : "down") : "muted"}">${diff ? signed(diff) : "ok"}</span></div>`;
    })
    .join("");
  return `<section class="panel"><div class="row between"><h3>Mana base</h3><span class="muted small">${m.lands} lands · ${m.basicCount} basic</span></div>
  ${m.basicCount && rows ? `<p class="muted small">Your ${m.basicCount} basics split by the colored mana symbols in your spells.</p><div class="mb-table"><div class="mb-row head"><span></span><span>Basic</span><span class="num">Now</span><span></span><span class="num">Suggested</span><span></span></div>${rows}</div>${m.off ? "" : '<p class="small ok-text">Your basics already match your spells.</p>'}` : '<p class="muted small">No basic lands in this list, so there is nothing to rebalance.</p>'}
  ${m.tapped.length ? `<p class="small ${m.tooManyTapped ? "warn-text" : "muted"}">${m.tapped.length} land${m.tapped.length > 1 ? "s" : ""} always enter tapped${m.tooManyTapped ? " — that’s a lot; each one can cost you a turn-one or turn-two play" : ""}: ${nameLinks([...new Set(m.tapped)], d)}</p>` : ""}
  </section>`;
}

export function goldfishTable(g, b = null) {
  // [label, getter, higherIsBetter, kind]
  const rows = [
    ["Land drop on time (4 lands by turn 4)", (x) => x.landsBy4, true, "pct"],
    ["Stuck on ≤2 lands on turn 3", (x) => x.screw3, false, "pct"],
    ["Ramp cast by turn 3", (x) => x.earlyRamp, true, "pct"],
    ["Mana used, turns 1–" + g.turns, (x) => x.efficiency, true, "pct"],
  ];
  if (g.commander) {
    rows.unshift(["Commander cast on curve (turn " + Math.max(1, g.commander.cmc) + ")", (x) => x.commander?.onCurve ?? null, true, "pct"]);
    rows.push(["Average commander turn", (x) => x.commander?.avgTurn ?? null, false, "num"]);
  }
  rows.push(["Average mulligans", (x) => x.mulligans, false, "num"]);
  const fmt = (n, kind) => (n === null || n === undefined ? "—" : kind === "pct" ? pct(n) : n.toFixed(2));
  return `<table class="metrics">${b ? '<thead><tr><th></th><th class="num">Before</th><th class="num">After</th><th class="num">Δ</th></tr></thead>' : ""}<tbody>${rows
    .map(([label, f, higher, kind]) => {
      const now = f(g),
        before = b ? f(b) : null,
        delta = b && now !== null && before !== null ? now - before : null,
        tiny = delta === null || Math.abs(delta) < (kind === "pct" ? 0.005 : 0.005),
        cls = tiny ? "" : (delta > 0) === higher ? "up" : "down",
        shown = tiny ? "" : kind === "pct" ? signed(Math.round(delta * 100), (x) => x + " pts") : signed(Number(delta.toFixed(2)));
      return `<tr><td>${label}</td>${b ? `<td class="num muted">${fmt(before, kind)}</td>` : ""}<td class="num"><b>${fmt(now, kind)}</b></td>${b ? `<td class="num ${cls}">${shown}</td>` : ""}</tr>`;
    })
    .join("")}</tbody></table>`;
}

/* Upgrade lab */

export function commanderPicker(d) {
  const fm = formatOf(d),
    legends = aggregateCards(d.cards).map((c) => meta(c.name)).filter((c) => c && canLead(c, fm));
  return `<section class="panel pick-commander"><p class="eyebrow">One quick step</p><h2>Which card is your commander?</h2><p class="muted small">This deck doesn’t have a commander set, so Cardforge can’t tell your colors. Tap it below.</p>
  ${legends.length ? `<div class="list compact">${legends.map((c) => `<button class="mini-row" data-act="setCommander" data-name="${esc(c.name)}"><span class="row">${img(art(c), c.name, "mini-art")}<span class="ellip"><b>${esc(c.name)}</b></span></span>${colorDots(c)}</button>`).join("")}</div>` : `<p class="small">No legendary creatures were found in this list.</p>`}
  <div class="searchbar"><input id="cmdName" placeholder="Or type the commander’s name" data-enter="setCommander"><button class="btn ghost" data-act="setCommander">Set</button></div></section>`;
}

function deckUpgrade(d) {
  const fm = formatOf(d),
    target = fm.size,
    count = sumQty(d.cards);
  if (fm.commander && !canLead(meta(d.commander), fm)) return commanderPicker(d);
  if (d.format !== "Commander") return fillAnyPanel(d, fm, count);
  return `${count < target ? fillPanel(d, target - count) : ""}${swapPanel(d)}`;
}

function fillPanel(d, open) {
  const F = S.ui.fill,
    plan = F.deckId === d.id ? F.plan : null;
  return `<section class="panel"><p class="eyebrow">Step 1</p><h2>Fill ${open} open slots</h2><p class="muted small">Keeps every card you chose. Adds lands and the ingredients your deck is short on, preferring cards you own. The budget covers cards you’d have to buy.</p>
  <div class="chips">${[0, 10, 25, 50, 100].map((n) => `<button class="chip pick ${F.budget === n ? "on" : ""}" data-act="fillBudget" data-v="${n}">${n ? "$" + n : "Owned only"}</button>`).join("")}</div>
  <label class="custom-budget">Custom purchase budget ($)<input type="number" min="0" max="100000" step="0.01" value="${F.budget}" data-change="fillCustom" aria-label="Custom slot-filling budget"></label>
  <div class="grid2"><label>Target lands<input type="number" min="30" max="42" value="${F.lands}" data-change="fill" data-field="lands"></label><label class="check"><input type="checkbox" data-change="fill" data-field="simple" ${F.simple ? "checked" : ""}> Prefer simpler cards</label></div>
  <button class="btn block" data-act="fillRun" ${F.busy ? "disabled" : ""}>${F.busy ? "Working…" : "Recommend cards"}</button>
  <p class="muted small" role="status" id="fillMsg">${esc(F.msg)}</p>
  ${plan ? fillResults(d, plan) : ""}</section>`;
}

function fillResults(d, plan) {
  const before = engineProfile(d, S.catalog),
    after = engineProfile(plan.deck, S.catalog);
  return `<div class="impact">${impactCells(before, after, { cost: plan.cost })}</div>
  <div class="list compact">${plan.additions
    .map((a) => `<button class="mini-row" data-act="card" data-name="${esc(a.name)}"><span class="ellip">${a.qty > 1 ? a.qty + "× " : ""}${esc(a.name)} <span class="muted small">· ${esc(a.reason)}</span></span><b>${a.available > 0 ? "owned" : usd(a.price)}</b></button>`)
    .join("")}</div>
  ${plan.warnings.filter((w) => !/heuristic/i.test(w)).map((w) => `<p class="small warn-text">${esc(w)}</p>`).join("")}
  <button class="btn block" data-act="fillApply">Add ${sumQty(plan.additions)} cards to deck</button><p class="foot">A version of your current list is saved first, so you can compare or undo.</p>`;
}

function impactCells(a, b, { cost = null, trade = null } = {}) {
  const cell = (label, x, y, higher = true, fmt = (n) => n) => {
    const delta = typeof x === "number" && typeof y === "number" ? y - x : null,
      cls = !delta ? "" : (delta > 0) === higher ? "up" : "down";
    return `<div class="imp"><small>${label}</small><b>${fmt(y)}</b>${delta ? `<em class="${cls}">${signed(Number(delta.toFixed(2)))}</em>` : ""}</div>`;
  };
  return [
    cell("Engine", a.score, b.score),
    cell("Ramp", a.counts.Ramp, b.counts.Ramp),
    cell("Draw", a.counts.Draw, b.counts.Draw),
    cell("Removal", a.counts.Removal, b.counts.Removal),
    a.synergyLabel ? cell("Synergy", a.counts.Synergy, b.counts.Synergy) : "",
    cell("Avg MV", a.avg === null ? 0 : Number(a.avg.toFixed(2)), b.avg === null ? 0 : Number(b.avg.toFixed(2)), false),
    cost !== null ? `<div class="imp"><small>Spend</small><b>${usd(cost)}</b></div>` : "",
    trade !== null ? `<div class="imp"><small>Cuts’ est. value</small><b>${usd(trade)}</b></div>` : "",
  ].join("");
}

function swapPanel(d) {
  const U = S.ui.upgrade,
    plans = U.deckId === d.id ? U.plans : {},
    plan = plans[U.budget];
  return `<section class="panel"><p class="eyebrow">${sumQty(d.cards) < 100 ? "Step 2" : "Upgrade lab"}</p><h2>One-for-one upgrades</h2><p class="muted small">Pick a budget. Cardforge proposes cuts and replacements and explains each trade-off: what the deck gains, what it gives up, and what it costs to buy. These are rules of thumb from card text — you know your playgroup best.</p>
  <div class="chips">${[0, 10, 25, 50, 100].map((n) => `<button class="chip pick ${U.budget === n ? "on" : ""}" data-act="upBudget" data-v="${n}">${n ? "$" + n : "My cards ($0)"}</button>`).join("")}</div>
  <label class="custom-budget">Custom upgrade budget ($)<input type="number" min="0" max="100000" step="0.01" value="${U.budget}" data-change="upCustom" aria-label="Custom upgrade budget"></label>
  <label class="check small"><input type="checkbox" data-change="upTrade" ${U.tradeIn ? "checked" : ""}> Show what the cut cards are worth (if you plan to sell or trade them)</label>
  <div class="row between"><label class="check"><input type="checkbox" data-change="upSimple" ${U.simple ? "checked" : ""}> Prefer simpler cards</label><button class="btn" data-act="upRun" ${U.busy ? "disabled" : ""}>${U.busy ? "Working…" : Object.keys(plans).length ? "↻ Refresh" : "Find upgrades"}</button></div>
  <p class="muted small" role="status" id="upMsg">${esc(U.msg)}</p>
  ${Object.keys(plans).length ? budgetLadder(d, plans) : ""}
  </section>
  ${plan ? swapResults(d, plan) : ""}`;
}

function budgetLadder(d, plans) {
  const base = engineProfile(d, S.catalog).score;
  return `<table class="metrics ladder"><thead><tr><th>Budget</th><th class="num">Swaps</th><th class="num">Spend</th><th class="num">Engine</th><th class="num">Per $</th></tr></thead><tbody>${Object.keys(plans).map(Number).sort((a,b)=>a-b)
    .filter((b) => plans[b])
    .map((b) => {
      const p = plans[b],
        after = engineProfile({ ...d, cards: applySwapsToCards(d.cards, p.swaps) }, S.catalog).score,
        gain = after - base;
      return `<tr class="${b === S.ui.upgrade.budget ? "on" : ""}" data-act="upBudget" data-v="${b}"><td>${b ? "$" + b : "$0"}</td><td class="num">${p.swaps.length}</td><td class="num">${usd(p.spent)}</td><td class="num">${after} <em class="${gain > 0 ? "up" : ""}">${signed(gain)}</em></td><td class="num">${p.spent > 0 ? (gain / p.spent).toFixed(2) : gain > 0 ? "free" : "—"}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

function swapResults(d, plan) {
  const p = engineProfile(d, S.catalog),
    base = p.score,
    targets = Object.fromEntries(p.parts.map((x) => [x.key, x.target])),
    sel = S.ui.upgrade.selected,
    showTrade = S.ui.upgrade.tradeIn,
    comm = meta(d.commander);
  if (!plan.swaps.length)
    return `<section class="panel">${empty("No clear upgrades at this budget", "Nothing in reach improves the deck without giving up something it relies on. Try a higher budget, or load card data for your collection so owned cards can be suggested.")}</section>`;
  const sign = { gain: "+", lose: "−", same: "=" };
  return `<div class="swap-list">${plan.swaps
    .map((s, i) => {
      const add = meta(s.add),
        cut = meta(s.cut),
        imp = swapImpact(d, s, S.catalog, base),
        why = explainSwap(cut, add, comm, p.counts, targets);
      return `<article class="swap ${sel.has(i) ? "on" : ""}">
        <label class="swap-check"><input type="checkbox" data-change="upPick" data-i="${i}" ${sel.has(i) ? "checked" : ""}> Use this swap</label>
        <div class="swap-pair">
          <button class="swap-card out" data-act="card" data-name="${esc(s.cut)}">${img(art(cut), s.cut, "swap-art")}<small>OUT</small><b>${esc(s.cut)}</b><span class="swap-mana">${manaCost(cut)}</span>${showTrade ? `<span class="muted small">est. value ${usd(imp.cutValue)}</span>` : ""}</button>
          <span class="swap-arrow" aria-hidden="true">→</span>
          <button class="swap-card in" data-act="card" data-name="${esc(s.add)}">${img(art(add), s.add, "swap-art")}<small>IN</small><b>${esc(s.add)}</b><span class="swap-mana">${manaCost(add)}</span><span class="small">${s.owned ? '<b class="ok-text">You own a free copy</b>' : `Buy for <b>${usd(s.cost)}</b>`}</span></button>
        </div>
        <ul class="swap-why">${why.lines.map((l) => `<li class="${l.kind}"><span aria-hidden="true">${sign[l.kind]}</span>${esc(l.text)}</li>`).join("")}</ul>
        <p class="swap-choose small">${esc(why.choose)}</p>
        <div class="swap-facts"><span>Engine score <b class="${imp.delta > 0 ? "up" : ""}">${base} → ${base + imp.delta}</b></span><span>${s.owned ? "Cost <b>$0</b>" : `Cost <b>${usd(s.cost)}</b>`}</span><span class="chip">${esc(s.complexity === "Straightforward" ? "Simple to play" : s.complexity)}</span></div>
      </article>`;
    })
    .join("")}</div>
  <div class="sticky-summary" id="upSummary">${upgradeSummary(d, plan)}</div>`;
}

export function upgradeSummary(d, plan) {
  const sel = [...S.ui.upgrade.selected].map((i) => plan.swaps[i]).filter(Boolean),
    before = engineProfile(d, S.catalog),
    after = engineProfile({ ...d, cards: applySwapsToCards(d.cards, sel) }, S.catalog),
    spend = sel.reduce((a, s) => a + (s.cost || 0), 0),
    trade = sel.reduce((a, s) => a + (priceOf(s.cut) ?? 0), 0);
  if (!sel.length) return `<p class="small center">Tick the swaps you like to see before → after.</p>`;
  return `<p class="eyebrow">Before → after · ${sel.length} swap${sel.length > 1 ? "s" : ""}</p><div class="impact">${impactCells(before, after, { cost: spend, trade: S.ui.upgrade.tradeIn ? trade : null })}</div><div class="actions"><button class="btn ghost small" data-act="upExport">↓ Buy list</button><button class="btn small" data-act="upApply">Apply ${sel.length}</button></div>`;
}

/* Versions */

function deckVersions(d) {
  const versions = d.versions || [];
  if (!versions.length)
    return `${empty("No saved versions yet", "Versions are saved automatically before imports, upgrades and slot-filling — or save one now. Then compare any two side by side.", `<button class="btn" data-act="snapshot">Save current version</button>`)}`;
  const V = S.ui.versions,
    pick = (id) => (id === "current" || !id ? { id: "current", label: "Current", cards: d.cards, date: null } : versions.find((v) => v.id === id)),
    A = pick(V.a && versions.some((v) => v.id === V.a) ? V.a : versions[0].id),
    B = pick(V.b === "current" || !versions.some((v) => v.id === V.b) ? "current" : V.b),
    choices = [...versions.map((v) => [v.id, `${v.label} · ${new Date(v.date).toLocaleDateString()}`]), ["current", "Current deck"]],
    pa = engineProfile({ ...d, cards: A.cards }, S.catalog),
    pb = engineProfile({ ...d, cards: B.cards }, S.catalog),
    ga = goldfishFor(d, A.cards, "A"),
    gb = goldfishFor(d, B.cards, "B"),
    va = deckValue(A.cards, S.catalog, S.state.priceChoices),
    vb = deckValue(B.cards, S.catalog, S.state.priceChoices),
    oa = comparisonTotals(rowsFor({ ...d, cards: A.cards })),
    ob = comparisonTotals(rowsFor({ ...d, cards: B.cards })),
    diff = diffCards(A.cards, B.cards),
    inCost = diff.added.reduce((a, c) => a + (priceOf(c.name) ?? 0) * c.qty, 0),
    outValue = diff.removed.reduce((a, c) => a + (priceOf(c.name) ?? 0) * c.qty, 0),
    games = (cards) => {
      const sig = cardSig(cards),
        n = S.state.notes.filter((x) => x.deckId === d.id && x.sig === sig);
      return n.length ? `${n.filter((x) => x.result === "Win").length}–${n.filter((x) => x.result === "Loss").length}` : "—";
    },
    row = (label, x, y, higher = true, fmt = (n) => n) => {
      const delta = typeof x === "number" && typeof y === "number" ? y - x : null,
        cls = !delta ? "" : higher === null ? "" : (delta > 0) === higher ? "up" : "down";
      return `<tr><td>${label}</td><td class="num muted">${fmt(x)}</td><td class="num"><b>${fmt(y)}</b></td><td class="num ${cls}">${delta ? signed(Number(delta.toFixed(2)), (n) => fmt(n)) : ""}</td></tr>`;
    };
  return `<section class="panel"><div class="grid2"><label>Before<select data-change="verA">${options(choices, A.id)}</select></label><label>After<select data-change="verB">${options(choices, B.id)}</select></label></div></section>
  <section class="panel"><h3>Side by side</h3><table class="metrics"><thead><tr><th></th><th class="num">Before</th><th class="num">After</th><th class="num">Δ</th></tr></thead><tbody>
    ${row("Engine score", pa.score, pb.score)}
    ${row("Cards", sumQty(A.cards), sumQty(B.cards), null)}
    ${row("Lands", pa.counts.Lands, pb.counts.Lands, null)}
    ${row("Ramp", pa.counts.Ramp, pb.counts.Ramp)}
    ${row("Draw", pa.counts.Draw, pb.counts.Draw)}
    ${row("Removal", pa.counts.Removal, pb.counts.Removal)}
    ${row("Board wipes", pa.counts.Wipe, pb.counts.Wipe)}
    ${row("Protection", pa.counts.Protection, pb.counts.Protection)}
    ${pa.synergyLabel ? row("Synergy", pa.counts.Synergy, pb.counts.Synergy) : ""}
    ${row("Avg mana value", pa.avg === null ? 0 : Number(pa.avg.toFixed(2)), pb.avg === null ? 0 : Number(pb.avg.toFixed(2)), false)}
    ${row("Deck value", Number(va.total.toFixed(2)), Number(vb.total.toFixed(2)), null, (n) => usd(n))}
    ${row("Owned copies", oa.covered, ob.covered)}
    ${row("Still to buy", Number(oa.pricedGap.toFixed(2)), Number(ob.pricedGap.toFixed(2)), false, (n) => usd(n))}
    <tr><td>Recorded games (W–L)</td><td class="num muted">${games(A.cards)}</td><td class="num"><b>${games(B.cards)}</b></td><td></td></tr>
  </tbody></table></section>
  <section class="panel"><h3>Mana curve</h3><p class="muted small"><span class="key old"></span> before <span class="key"></span> after</p>${curveChart(pb.curve, pa.curve)}</section>
  ${ga && gb ? `<section class="panel"><h3>Test games</h3>${goldfishTable(gb, ga)}<p class="foot">Both versions play the same ${gb.games.toLocaleString()} shuffles, so differences come from the cards, not luck.</p></section>` : ""}
  <section class="panel"><div class="row between"><h3>What changed</h3><span class="muted small">${diff.added.length + diff.removed.length ? `in ${usd(inCost)} · out ${usd(outValue)}` : ""}</span></div>
  ${
    diff.added.length + diff.removed.length
      ? `<div class="diff"><div><p class="eyebrow down">Out · ${sumQty(diff.removed)}</p>${diff.removed.map((c) => `<button class="mini-row" data-act="card" data-name="${esc(c.name)}"><span class="ellip">${c.qty > 1 ? c.qty + "× " : ""}${esc(c.name)}</span><span class="muted">${usd(priceOf(c.name))}</span></button>`).join("") || '<p class="muted small">—</p>'}</div><div><p class="eyebrow up">In · ${sumQty(diff.added)}</p>${diff.added.map((c) => `<button class="mini-row" data-act="card" data-name="${esc(c.name)}"><span class="ellip">${c.qty > 1 ? c.qty + "× " : ""}${esc(c.name)}</span><span class="muted">${usd(priceOf(c.name))}</span></button>`).join("") || '<p class="muted small">—</p>'}</div></div>`
      : `<p class="muted small">These two versions have the same cards.</p>`
  }</section>
  <section class="panel"><div class="row between"><h3>History</h3><button class="btn ghost small" data-act="snapshot">Save current</button></div><div class="list compact">${versions
    .slice()
    .reverse()
    .map((v) => `<div class="mini-row"><span class="ellip"><b>${esc(v.label)}</b> <span class="muted small">${new Date(v.date).toLocaleString()} · ${sumQty(v.cards)} cards${v.spent ? " · " + usd(v.spent) + " planned" : ""}</span></span><span class="row"><button class="link small" data-act="restoreVer" data-id="${v.id}">Restore</button><button class="link small danger" data-act="deleteVer" data-id="${v.id}" aria-label="Delete version">✕</button></span></div>`)
    .join("")}</div></section>`;
}

/* Playtest */

function deckPlaytest(d) {
  const cards = d.cards.filter((c) => !hasCommander(d) || key(c.name) !== key(d.commander)),
    p = engineProfile(d, S.catalog),
    total = sumQty(cards),
    odds = total >= 7 ? atLeastLands(total, p.counts.Lands, 7, 3) : null,
    hand = S.ui.hand?.deckId === d.id ? S.ui.hand : null,
    notes = S.state.notes.filter((n) => n.deckId === d.id).slice().reverse(),
    wins = notes.filter((n) => n.result === "Win").length,
    losses = notes.filter((n) => n.result === "Loss").length;
  return `${lifePanel()}<section class="panel"><div class="row between"><h3>Opening hand</h3><span class="muted small">${odds === null ? "" : pct(odds) + " of hands have 3+ lands"}</span></div>
  <div class="actions"><button class="btn" data-act="draw7" ${total < 7 ? "disabled" : ""}>${hand ? "New hand" : "Draw 7"}</button><button class="btn ghost" data-act="mull" ${hand ? "" : "disabled"}>Mulligan</button><button class="btn ghost" data-act="drawOne" ${hand?.library.length ? "" : "disabled"}>Draw a card</button></div>
  ${hand ? `<p class="small">${hand.hand.filter((n) => isLand(meta(n))).length} lands · turn ${Math.max(1, hand.hand.length - 6)}${hand.mulls ? ` · mulligan ${hand.mulls} (bottom ${hand.mulls})` : ""}</p><div class="hand">${hand.hand.map((n) => `<button class="hand-card" data-act="card" data-name="${esc(n)}">${img(cardImage(meta(n)), n, "card-img")}</button>`).join("")}</div>` : `<p class="muted small">${total < 7 ? "Add more cards to draw a hand." : "The commander stays in the command zone."}</p>`}
  </section>
  <section class="panel"><div class="row between"><h3>Game log</h3><span class="chip">${wins}W · ${losses}L</span></div>
  <div class="log-form"><select id="logResult" aria-label="Result">${options([["Win", "Win"], ["Loss", "Loss"], ["Learning game", "Learning"]], "Win")}</select><input id="logTurn" type="number" min="1" max="40" placeholder="Turn" aria-label="Ending turn"><input id="logNote" placeholder="What worked or stalled?" maxlength="1000" aria-label="Note"><button class="btn" data-act="logGame">Save</button></div>
  <p class="foot">Games are tagged with the current deck version, so Versions can show real results next to the simulations.</p>
  ${notes.map((n) => `<div class="note-row"><span class="chip ${n.result === "Win" ? "ok" : n.result === "Loss" ? "warn" : ""}">${esc(n.result)}</span><span class="ellip small">${esc(n.date)}${n.turn ? " · T" + n.turn : ""} ${n.note ? "· " + esc(n.note) : ""}</span><button class="link small danger" data-act="deleteNote" data-id="${n.id}" aria-label="Delete game">✕</button></div>`).join("")}
  </section>`;
}

function lifePanel() {
  const g = S.ui.life;
  if (!g)
    return `<section class="panel"><div class="row between"><h3>Life tracker</h3><span class="muted small">Commander damage · poison · turns</span></div>
    <div class="actions wrap">${[2, 3, 4, 5, 6].map((n) => `<button class="btn ${n === 4 ? "" : "ghost"} small" data-act="lifeStart" data-n="${n}">${n} players</button>`).join("")}</div></section>`;
  return `<section class="panel life"><div class="row between"><h3>Turn ${g.turn}</h3><div class="row"><button class="btn ghost small" data-act="lifeTurn" data-delta="-1" aria-label="Previous turn">−</button><button class="btn small" data-act="lifeTurn" data-delta="1">Next turn</button></div></div>
  <div class="life-grid n${g.players.length}">${g.players
    .map((pl, i) => {
      const out = isOut(pl),
        step = (field, delta, label) => `<button data-act="lifeAdj" data-i="${i}" data-field="${field}" data-delta="${delta}" aria-label="${label}">${delta > 0 ? "+" : "−"}${Math.abs(delta) === 1 ? "" : Math.abs(delta)}</button>`;
      return `<div class="life-card ${out ? "out" : ""} ${i ? "" : "me"}"><input class="life-name" value="${esc(pl.name)}" data-change="lifeName" data-i="${i}" aria-label="Player name" maxlength="24">
      <div class="life-main">${step("life", -5, "Lose 5 life")}${step("life", -1, "Lose 1 life")}<b class="life-total" aria-live="polite">${pl.life}</b>${step("life", 1, "Gain 1 life")}${step("life", 5, "Gain 5 life")}</div>
      <div class="life-sub"><span>⚔ ${step("cmd", -1, "Remove commander damage")}<b class="${pl.cmd >= 15 ? "warn-text" : ""}">${pl.cmd}</b>${step("cmd", 1, "Add commander damage")}</span><span>☠ ${step("poison", -1, "Remove poison")}<b class="${pl.poison >= 7 ? "warn-text" : ""}">${pl.poison}</b>${step("poison", 1, "Add poison")}</span></div>
      ${out ? `<span class="chip warn life-out">Out</span>` : ""}</div>`;
    })
    .join("")}</div>
  <p class="foot">⚔ is commander damage taken and also comes off life; 21 from one commander is lethal. ☠ is poison; 10 is lethal.</p>
  <div class="actions wrap"><button class="btn small" data-act="lifeLog" data-result="Win">I won · log it</button><button class="btn ghost small" data-act="lifeLog" data-result="Loss">I lost · log it</button><button class="btn ghost small danger" data-act="lifeEnd">End without logging</button></div></section>`;
}

/* Shop */

function deckShop(d, t) {
  const rows = rowsFor(d).filter((r) => r.missing),
    sub = rows.reduce((a, r) => a + (r.price ?? 0) * r.missing, 0),
    st = S.state,
    total = (sub + (rows.length ? Number(st.settings.shipping) : 0)) * (1 + Number(st.settings.tax) / 100);
  if (!rows.length) return empty("You own every card in this deck", "Nothing to buy. Mark the deck as assembled from the ⋯ menu to reserve these copies so other decks can’t borrow them.");
  return `<div class="list">${rows
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
    .map((r) => {
      const c = meta(r.name);
      return `<div class="lot"><button class="lot-art" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${img(art(c), r.name)}</button><div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${esc(r.name)}</button><span class="lot-sub">Need ${r.missing}${S.state.priceChoices?.[key(r.name)] ? " · " + esc(S.state.priceChoices[key(r.name)].label) : ""}</span></div><div class="lot-side"><button class="price buy-link" data-act="buyCard" data-name="${esc(r.name)}" data-deck="${esc(d.id)}" aria-label="Buy ${esc(r.name)}">${r.price === null ? "Unknown" : usd(r.price * r.missing)} ›</button></div></div>`;
    })
    .join("")}</div>
  <section class="panel">${costBlock(sub, total, d.budget, "deck budget")}${t.unpriced ? `<p class="small warn-text">${t.unpriced} copies have no price and aren’t included.</p>` : ""}
  <div class="actions wrap"><button class="btn" data-act="copyShopping" data-src="deck">Copy list</button><a class="btn ghost" href="https://www.tcgplayer.com/massentry" target="_blank" rel="noopener">TCGplayer Mass Entry ↗</a><button class="btn ghost" data-act="exportMissing">↓ .txt</button><button class="btn ghost" data-act="acquire">I got cards</button><button class="btn ghost" data-act="proxies" data-scope="missing">🖨 Print proxies of missing</button></div>
  <p class="foot">Tap a card → Printings to price a specific edition. Reference prices from Scryfall; check the seller’s condition and shipping.</p></section>`;
}

/* ---------- Scan ---------- */

export function scan(scanNames) {
  const s = S.ui.scan,
    names = scanNames(s.text);
  return `<div class="page-head"><h1>Scan a card</h1></div>
  <section class="panel">
    ${s.url ? `<img class="scan-preview" src="${s.url}" alt="Card photo">` : `<div class="scan-drop"><b>One card, flat and well lit</b><span class="muted small">Fill the frame. Keep the name sharp and avoid foil glare.</span></div>`}
    <div class="actions"><label class="btn">📷 Camera<input type="file" accept="image/*" capture="environment" data-change="scanFile" hidden></label><label class="btn ghost">Upload<input type="file" accept="image/*" data-change="scanFile" hidden></label>${s.url ? `<button class="btn ghost" data-act="scanClear">Clear</button>` : ""}</div>
    ${s.url ? `<div class="row between"><label class="check"><input type="checkbox" data-change="scanCrop" ${s.crop === "title" ? "checked" : ""}> Read the top of the card only</label><button class="btn" data-act="scanRead" ${s.busy ? "disabled" : ""}>${s.busy ? "Reading…" : "Read name"}</button></div>` : ""}
    <p class="muted small" id="scanStatus" role="status">${esc(s.status)}</p>
  </section>
  ${
    s.url || s.match
      ? `<section class="panel"><h3>Confirm the card</h3><div class="searchbar"><input id="scanName" value="${esc(s.match?.name || names[0] || "")}" placeholder="Card name" data-enter="scanMatch"><button class="btn ghost" data-act="scanMatch">Find</button></div>${names.length > 1 ? `<div class="chips">${names.map((n) => `<button class="chip" data-act="scanPick" data-name="${esc(n)}">${esc(n)}</button>`).join("")}</div>` : ""}${s.match ? `<div class="scan-match">${img(cardImage(s.match), s.match.name, "card-img")}<div><b>${esc(s.match.name)}</b><p class="muted small">${esc(typeText(s.match))}</p><button class="btn" data-act="own" data-name="${esc(s.match.name)}">＋ Add to collection</button></div></div>` : ""}</section>`
      : ""
  }
  <p class="foot">Text recognition runs on your phone; only the card name is looked up online. The first scan downloads the reader (~5 MB).</p>`;
}

/* ---------- Settings ---------- */

/* ---------- Account ---------- */

const when = (iso) => (iso ? new Date(iso).toLocaleString() : "never");

export function accountPanel() {
  const a = cloudInfo();
  if (!a.configured)
    return `<section class="panel account"><h3>Account</h3><p class="muted small">Accounts aren’t switched on for this site yet, so everything is saved on this device. Export a backup to move it to another phone or computer.</p></section>`;
  if (!a.ready)
    return `<section class="panel account"><h3>Account</h3><p class="muted small">${a.status.state === "error" ? esc(a.status.msg) : "Connecting…"}</p></section>`;
  if (!a.user)
    return `<section class="panel account"><p class="eyebrow">Optional</p><h3>Sign in to save across devices</h3>
    <p class="muted small">Your collection and decks sync privately to your account — only you can see them. You can keep using Cardforge without signing in; your data stays on this device either way.</p>
    ${a.providers.google ? `<button class="btn block" data-act="signGoogle">Continue with Google</button>` : ""}
    <div class="searchbar email-row"><input id="signEmail" type="email" autocomplete="email" placeholder="you@example.com" aria-label="Email address" data-enter="signEmail"><button class="btn ghost" data-act="signEmail">Email me a link</button></div>
    <p class="foot">We’ll email a one-time sign-in link — no password. Signing in never deletes what’s on this device: if your account already has data, you choose which copy to keep, and the other is saved as a backup file.</p></section>`;
  const pr = a.profile || {},
    st = a.status,
    label = { synced: "Synced", syncing: "Syncing…", error: "Sync paused", decide: "Needs your decision", offline: "Offline — will sync when you’re back online", local: "Synced" }[st.state] || "Synced";
  return `<section class="panel account"><div class="account-head">${pr.avatar_url ? `<img class="avatar" src="${esc(pr.avatar_url)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((pr.display_name || a.user.email || "?").slice(0, 1).toUpperCase())}</span>`}<div><b>${esc(pr.display_name || a.user.email)}</b><small class="muted">${esc(a.user.email || "")}${pr.username ? " · @" + esc(pr.username) : ""}</small></div></div>
    <div class="sync-line ${st.state}"><span><b>${label}</b>${st.state === "synced" && st.at ? ` · ${esc(when(st.at))}` : ""}</span><button class="btn ghost small" data-act="syncNow">Sync now</button></div>
    ${st.state === "error" && st.msg ? `<p class="small bad-text">${esc(st.msg)} Your cards are still saved on this device.</p>` : ""}
    ${a.pending ? `<button class="btn block" data-act="syncDecide">Choose which copy to keep</button>` : ""}
    <details><summary class="small"><b>Profile</b></summary>
      <label class="field">Display name<input id="pfName" maxlength="60" value="${esc(pr.display_name || "")}"></label>
      <label class="field">Username <span class="muted small">(for sharing later)</span><input id="pfUser" maxlength="30" value="${esc(pr.username || "")}" placeholder="letters, numbers, _"></label>
      <label class="field">Bio<textarea id="pfBio" rows="2" maxlength="500">${esc(pr.bio || "")}</textarea></label>
      <button class="btn small" data-act="saveProfile">Save profile</button>
    </details>
    <p class="foot">Private: only you can read your account copy. Cards and decks are saved on this device first, then synced a few seconds later.</p>
    <button class="link small" data-act="signOut">Sign out</button> <span class="muted small">— your data stays on this device.</span></section>`;
}

// Shown when both this device and the account have data, or when they changed separately.
export function syncDecideSheet(p, local) {
  const L = summarize(local),
    C = p.cloud ? summarize(p.cloud.data) : null,
    side = (title, x, extra) => `<div class="sync-side"><p class="eyebrow">${title}</p><b>${x.copies.toLocaleString()} cards</b><span class="small">${x.names.toLocaleString()} different · ${x.decks} decks · ${x.wishlist} wishlist</span><span class="small muted">${extra}</span></div>`;
  if (p.kind === "offer")
    return `<div class="sheet-head"><h2>Save this device to your account?</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
    <p class="muted small">Your account is empty. Upload what’s on this device so it’s available everywhere you sign in.</p>
    ${side("This device", L, "Saved " + when(L.saved))}
    <div class="actions"><button class="btn" data-act="syncChoice" data-choice="device">Upload to my account</button><button class="btn ghost" data-act="syncChoice" data-choice="later">Not now</button></div>
    <p class="foot">Nothing on this device is removed.</p>`;
  return `<div class="sheet-head"><h2>${p.kind === "conflict" ? "Changed in two places" : "Which copy should we keep?"}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <p class="muted small">${p.kind === "conflict" ? "Your account was updated on another device while this device also had changes. Pick one copy to keep." : "This device and your account both have cards, and they’re different."} The copy you don’t keep is downloaded as a backup file, so nothing is lost. Cardforge doesn’t merge copies automatically, so cards are never counted twice.</p>
  <div class="sync-compare">${side("This device", L, "Saved " + when(L.saved))}${C ? side("Your account", C, "Saved " + when(p.cloud.updated_at) + (p.cloud.device ? " · " + esc(p.cloud.device) : "")) : ""}</div>
  <div class="actions wrap"><button class="btn" data-act="syncChoice" data-choice="account">Keep the account copy</button><button class="btn ghost" data-act="syncChoice" data-choice="device">Keep this device’s copy</button></div>
  <button class="link small" data-act="syncChoice" data-choice="later">Decide later (sync stays paused)</button>`;
}

export function settings() {
  const st = S.state;
  return `<div class="page-head"><h1>Settings & backup</h1></div>
  ${accountPanel()}
  <section class="panel"><h3>Backup</h3><p class="muted small">${cloudInfo().user ? "Your collection is saved on this device and synced to your account. Backup files are still a good idea before big changes." : "Your collection lives in this browser on this website address. Export a backup before switching phones or browsers — or sign in above to sync."}</p>
  <div class="actions wrap"><button class="btn" data-act="exportBackup">↓ Export backup</button><label class="btn ghost">Restore backup<input type="file" accept=".json" data-change="restoreBackup" hidden></label><label class="btn ghost">Check a backup<input type="file" accept=".json" data-change="checkBackup" hidden></label></div>
  <p id="backupCheck" class="muted small"></p>
  <p class="small">Last saved: ${esc(st.lastSavedAt ? new Date(st.lastSavedAt).toLocaleString() : "not yet")}</p>
  <button class="link" data-act="undoRestore">Restore the automatic recovery copy</button></section>
  <section class="panel"><h3>Storage</h3><p id="storageDetail" class="muted small">Checking…</p><button class="btn ghost" data-act="persist">Ask the browser to keep my data</button></section>
  <section class="panel"><h3>Install</h3><p class="muted small">In Chrome on Android: ⋮ menu → <b>Add to Home screen</b> / <b>Install app</b>. Your collection and decks work offline; searches and prices need internet.</p><button class="btn ghost" data-act="install">Install Cardforge</button></section>
  <section class="panel"><h3>Data sources</h3><ul class="sources">
    <li><b>Scryfall</b> — card data, images and reference USD prices (live).</li>
    <li><b>MTGJSON</b> — precon product lists.</li>
    <li><b>ManaBox, Moxfield, Archidekt, TCGplayer, Deckbox</b> — import their text or CSV exports.</li>
    <li><b>TCGplayer Mass Entry</b> — paste shopping lists to buy.</li>
  </ul><p class="foot">Engine score, upgrade picks and test games are transparent rules and simulations based on card text, not AI predictions or win rates. Magic: The Gathering © Wizards of the Coast. Cardforge is an independent fan tool.</p></section>
  <section class="panel"><h3>Start over</h3><p class="muted small">Keeps one recovery copy on this device. Export a backup first.</p><div class="actions wrap"><button class="btn ghost danger" data-act="reset">Start empty</button><button class="btn ghost" data-act="loadExample">Load example data</button></div></section>`;
}

/* ---------- Deck idea sheet ---------- */
export function ideaSheet(idea, deck, open, sel) {
  const d = { ...deck, id: "idea-preview" },
    rows = rowsFor(d),
    t = comparisonTotals(rows),
    p = engineProfile(d, S.catalog),
    v = deckValue(d.cards, S.catalog, S.state.priceChoices),
    byCat = new Map(CATS.map((c) => [c, rows.filter((r) => r.category === c)]));
  return `<div class="sheet-head"><h2>${esc(idea.commander.name)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="idea-hero">${img(art(idea.commander), idea.commander.name)}<span class="chip dark">${esc(idea.plan)}</span></div>
  <div class="impact"><div class="imp"><small>Cards</small><b>${t.copies}/100</b></div><div class="imp"><small>You own</small><b>${t.covered}</b></div><div class="imp"><small>To buy</small><b>${usd(t.pricedGap, 0)}</b></div><div class="imp"><small>Engine</small><b>${p.score}</b></div></div>
  <p class="eyebrow">Build it with</p>
  <button class="btn block" data-act="ideaSaveAll" ${open.busy ? "disabled" : ""}>Save entire ${t.copies}-card deck, including lands</button>
  ${t.copies < 100 ? `<div class="note warn">${100-t.copies} slots remain. Increase the budget or retry card data; this is not a complete 100-card list yet.</div>` : ""}
  <div class="chips">${[0, 25, 50, 100].map((n) => `<button class="chip pick ${open.budget === n ? "on" : ""}" data-act="ideaBudget" data-v="${n}" ${open.busy ? "disabled" : ""}>${n ? "+ $" + n + " of new cards" : "Only my cards"}</button>`).join("")}</div>
  <div class="custom-budget-row"><label>Custom purchase budget ($)<input id="ideaCustomBudget" type="number" min="0" max="100000" step="0.01" value="${open.budget}" ${open.busy?"disabled":""}></label><button class="btn ghost" data-act="ideaCustomBudget" ${open.busy?"disabled":""}>Build with this budget</button></div>
  <p class="foot">Dollar budget and deck size are different: lands are included in the 100-card deck. Shipping and tax are separate.</p>
  <p class="muted small" id="ideaMsg" role="status">${esc(open.busy ? open.msg || "Working…" : open.msg || (open.budget ? "" : "Owned-only starters can be incomplete. Choose a purchase budget to build the full deck, including lands."))}</p>
  <div class="row between sel-bar"><span class="small" id="ideaSelCount">${sel.size ? sel.size + " selected" : "Tick cards to act on them"}</span><span class="row"><button class="link small" data-act="ideaSelect" data-mode="missing">Missing</button><button class="link small" data-act="ideaSelect" data-mode="all">All</button><button class="link small" data-act="ideaSelect" data-mode="none">None</button></span></div>
  ${[...byCat]
    .filter(([, l]) => l.length)
    .map(
      ([cat, list]) => `<details class="group" open><summary><span>${esc(cat)} <em>${sumQty(list)}</em></span><span class="muted small">${usd(list.reduce((a, r) => a + (r.price ?? 0) * r.qty, 0))}</span></summary><div class="list compact">${list
        .sort((a, b) => (meta(a.name)?.cmc ?? 99) - (meta(b.name)?.cmc ?? 99) || a.name.localeCompare(b.name))
        .map((r) => `<div class="pick-row ${r.missing ? "short" : ""}"><input type="checkbox" data-change="ideaPick" data-name="${esc(r.name)}" ${sel.has(r.name) ? "checked" : ""} aria-label="Select ${esc(r.name)}"><button class="pick-main" data-act="card" data-name="${esc(r.name)}">${img(art(meta(r.name)), r.name, "mini-art")}<span class="ellip"><b>${r.qty > 1 ? r.qty + "× " : ""}${esc(r.name)} ${setBadge(meta(r.name))}</b><small class="${r.missing ? "warn-text" : "ok-text"}">${r.missing ? "Need " + r.missing : "Owned"}</small></span></button><span class="pick-side">${manaCost(meta(r.name))}<b>${usd(r.price)}</b></span></div>`)
        .join("")}</div></details>`,
    )
    .join("")}
  ${S.state.decks.length ? `<div class="inline-pick"><select id="ideaDeckPick" aria-label="Deck">${options(S.state.decks.map((x) => [x.id, x.name]), S.state.activeDeck)}</select><button class="btn ghost" data-act="ideaToDeck">Add ticked to deck</button></div>` : ""}
  <p class="foot">Nothing is bought or added until you tap a button. “Buy” copies only cards you don’t own (all missing ones if nothing is ticked) for TCGplayer Mass Entry.</p>
  <div class="idea-actions">
    <button class="btn small" data-act="ideaSaveAll">Save as deck</button>
    <span class="row"><button class="btn ghost small" data-act="ideaBuy" title="Copy buy list">🛒 Buy</button><button class="btn ghost small" data-act="ideaWish" title="Add ticked to wishlist">♡</button><button class="btn ghost small" data-act="ideaOwn" title="I own the ticked cards">＋ Own</button></span>
  </div>`;
}
