import {brandMark} from './brand.js';
import {conditionValueNote} from './condition-value.js';
import { aiReviewPanel } from './ai-review.js';
import { rankPairs } from "./pairing.js";
import { APP_VERSION } from "./config.js";
import { matchupsTab, fieldStore, computeMatchups } from "./matchups-ui.js";
import { profileOf, simulateMatchup, gamePlan, recordOf, blend, listSig, forList, simulatePod, podProfile, trustedSim, matchupBlock, canBorrowResults } from "./matchup.js";
import { mtgConstructedPower } from "./deckpower.js";
import { isCommanderLike } from "./formats.js";
import { mtgMetaKey } from "./power.js";
import {buildOverlay} from "./build-overlay.js";
import { tierCardHtml } from "./tier-card.js";
import { atLeastOne } from "./deckaudit.js";
import {budgetComparisonHtml} from './deck-optimizer.js';
import {effectText} from './rule-dex.js';
import {collectionOrder} from "./collection-order.js";
import { hapticsOn } from "./feel.js";
import { tradePanel } from "./trade.js";
import { skeletonGrid } from "./ui.js";
import { trackedQuote, priceHistoryHtml, alertsPanel, alertStatus } from "./pricehist.js";
import { installNudge } from "./install.js";
import {setRowContent} from './set-list-ui.js';
import { playGuide, playedAlongside, guideHtml, cardRules } from "./guide.js";
import { ICON, actionIcon } from "./icons.js";
import { tierOf, tierAttrs, tierStyle, tierGem } from "./tier.js";
import { emblemChips, rowEmblem, hasEmblem, impactScore, tradeAdvice, tradeAdviceHtml, deckEmblems, deckEmblemHtml, cardMetaUsage, cardMetaTab } from "./importance.js";
import { tileChrome } from "./tiles.js";
import {viewControl,selectionControl,selectionMark,selectionTray,historyPanel,quoteModel,priceOverview} from "./workbench-ui.js";
import { binderShelf } from "./binders.js";
// Screen renderers. Each returns HTML for #content; interaction is wired by
// data-act / data-change / data-input attributes handled centrally in app.js.
import { metaState, MTG_META_FORMATS, allCachedMeta } from "./meta.js";
import { mtgPower, powerPanel, powerChip, shownPower, powerReadiness } from "./power.js";
import { factBox, factsFor } from "./facts.js";
import { tcgFallback, myPrice, ensureTcgPrices } from "./mtg-tcgprice.js";
import { S, meta, inv, deckById, currentDeck, priceOf } from "./store.js";
import {
  esc, usd, pct, signed, art, cardImage, img, manaCost, colorDots, segmented,
  options, bar, ring, curveChart, lineChart, empty, setBadge, sym, symbolText, setIconUrl,
} from "./ui.js";
import {
  cardKey as key, sumQty, rulesText, typeText, isLand, validateDeck,
  atLeastLands, aggregateCards, commanderEligible, isBasic, cardPrice,
} from "./core.js";
import { deckComparison, comparisonTotals } from "./deck-flow.js";
import { printingState } from "./confidence.js";
import { complexity } from "./planner.js";
import {
  engineProfile, engineRoles, goldfish, scoreGrade, diffCards, deckValue,
  collectionValue, recordValuePoint, lotPrice, swapImpact, applySwapsToCards, cardSig,
} from "./insights.js";
import { bracketEstimate, manaBase, isOut, deckReview, explainSwap, podSpeed } from "./extras.js";
import { buildability, rankBuildable } from "./share.js";
import { formatsFor } from "./builder.js";
import { gameBinders, gameSwitch, homeHero, quickTiles, randomTools, draftPath, nextCard, startHidden, savedSearches } from "./tcg.js";
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
    hist = recordValuePoint(st.valueHistory || [], value.total, value.copies),
    prev = hist.length > 1 ? hist[hist.length - 2] : null,
    change = prev ? value.total - prev.total : null,
    active = deckById(st.activeDeck),
    others = st.decks.filter((d) => d !== active).slice(-8).reverse(),
    onboarding = !(st.collection.length && st.decks.length);
  const fresh = !st.collection.length && !st.decks.length,
    lead = active || st.decks.at(-1);
  // One next step for where you are; the 3-step guide only for brand-new users (and it can be hidden).
  return `${homeHero("mtg", copies ? "Welcome back." : "Let’s build from your cards.", mtgDeckArt(active), !fresh)}${installNudge(copies)}
  ${st.example ? `<div class="note warn">Example data is loaded. Reset it in Settings before adding real cards.</div>` : ""}
  ${fresh && !startHidden("mtg") ? startPath() : mtgNext(lead, copies)}
  ${onboarding ? "" : `<div class="kpis">
    <button class="kpi" data-act="go" data-to="#collection/value"><b data-count="${Math.round(value.total)}" data-money="1">${usd(value.total, 0)}</b><span>collection value${change !== null ? ` <em class="${change >= 0 ? "up" : "down"}">${signed(change, (x) => usd(x, 0))}</em>` : ""}</span></button>
    <button class="kpi" data-act="go" data-to="#collection"><b>${copies}</b><span>cards owned</span></button>
    <button class="kpi" data-act="go" data-to="#decks"><b>${st.decks.length}</b><span>decks</span></button>
  </div>`}
  ${quickTiles("mtg", !!S.state.collection.length && !S.state.decks.length)}
  ${others.length ? `<section class="home-deck-section"><div class="section-head"><h2>Deck shelf</h2><button class="link" data-act="go" data-to="#decks">All decks →</button></div><div class="shelf">${others.map((d) => deckTile(d)).join("")}</div></section>` : ""}
  ${
    value.spare.length && value.spareValue > 0
      ? `<button class="banner" data-act="go" data-to="#collection/value"><span><b>${usd(value.spareValue, 0)}</b> sits in ${sumQty(value.spare)} cards no deck uses</span><span class="muted">Trade binder →</span></button>`
      : ""
  }
  `;
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
function mtgNext(d, copies) {
  if (!d && !copies)
    return nextCard({ title: "Add your collection", text: "Paste a list or upload a ManaBox, Moxfield, Archidekt or CSV export — or scan cards with your camera. Then CardStashy shows what you can build.", actions: `<button class="btn" data-act="importCollection">↥ Import a list</button><button class="btn ghost" data-act="go" data-to="#scan">▧ Scan</button><button class="btn ghost" data-act="loadExample">Explore an example</button>` });
  if (!d)
    return nextCard({ title: "Discover decks your cards support", text: `${copies} cards in your collection. See the commanders they support and the decks — precons, shared lists and tournament results — you can almost build.`, actions: `<button class="btn" data-act="go" data-to="#decks/ideas">✧ Deck ideas</button><button class="btn ghost" data-act="go" data-to="#decks/inspiration">🏆 Meta decks</button>` });
  const t = totalsFor(d),
    f = formatOf(d),
    r = deckReview(d, S.catalog, S.state.collection, S.state.decks);
  return nextCard({
    eyebrow: "Continue your deck",
    title: esc(d.name),
    art: coverOf(d),
    stats: [[`${t.copies}/${f.size}`, f.name], [`${t.missing}`, "missing copies"], [`${usd(t.pricedGap, 0)}${t.unpriced ? "+" : ""}`, "to finish"], [r.length ? `${r.length}` : "✓", r.length ? "to review" : "reviewed"]],
    text: r.length ? `Next: ${esc(r[0].title)}` : t.missing ? "Nothing to review — get the missing copies to finish." : t.copies < f.size ? `${f.size - t.copies} slots still open.` : "Complete. Playtest it or start another.",
    actions: `<button class="btn" data-act="go" data-to="#deck/${esc(d.id)}/cards">Open deck</button>${t.missing ? `<button class="btn ghost" data-act="go" data-to="#deck/${esc(d.id)}/shop">Shop missing</button>` : ""}`,
  });
}
function startPath() {
  const st = S.state,
    hasCards = st.collection.length > 0,
    hasDeck = st.decks.length > 0;
  if (hasCards && hasDeck) return "";
  const step = (n, done, title, text, actions) =>
    done
      ? `<li class="step done"><span class="step-n" aria-hidden="true">✓</span><div><b>${title}</b></div></li>`
      : `<li class="step"><span class="step-n" aria-hidden="true">${n}</span><div><b>${title}</b><p class="muted small">${text}</p><div class="actions wrap">${actions}</div></div></li>`;
  return `<section class="panel start"><div class="row between"><p class="eyebrow">Start here · about 5 minutes</p><button class="link small" data-act="hideStart" data-game="mtg">Hide</button></div><h2>Three steps to your first deck</h2><ol class="steps">
    ${step(1, hasCards, "Add the cards you own", "Paste a list or upload a ManaBox, Moxfield, Archidekt or CSV export. Or scan cards with your camera.", `<button class="btn small" data-act="importCollection">Add my cards</button>`)}
    ${step(2, hasDeck, "Pick a deck to aim for", "Import a list you like, start from a commander, or browse precons and shared decks to see what you can almost build.", `<button class="btn small" data-act="go" data-to="#decks/ideas">Find deck ideas</button>`)}
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
      <small>${esc(formatOf(d).commander ? d.commander || "No commander yet" : mtgPower(d).plan)} · ${t.copies}/${target}</small>
      <span class="tile-stats">${powerChip(mtgPower(d))}<span><em>${Math.round(owned * 100)}%</em> owned</span><span><em>${usd(v.total, 0)}</em> value</span>${t.missing ? `<span><em>${usd(t.pricedGap, 0)}</em> to finish</span>` : ""}</span>
      ${bar(owned, "thin")}
    </span>
  </button>`;
}

/* ---------- Search ---------- */

const COLOR_ID = [["W", "White"], ["U", "Blue"], ["B", "Black"], ["R", "Red"], ["G", "Green"], ["WU", "Azorius WU"], ["UB", "Dimir UB"], ["BR", "Rakdos BR"], ["RG", "Gruul RG"], ["GW", "Selesnya GW"], ["WB", "Orzhov WB"], ["UR", "Izzet UR"], ["BG", "Golgari BG"], ["RW", "Boros RW"], ["GU", "Simic GU"], ["WUBRG", "All five"], ["C", "Colorless"]];
const MTG_SORTS = [["", "Best match"], ["name", "Name"], ["usdAsc", "Price: low to high"], ["usd", "Price: high to low"], ["released", "Newest"], ["cmc", "Mana value"], ["edhrec", "Most played (EDHREC)"], ["rarity", "Rarity"]];
// Every active filter as a removable chip, so nothing restricts results invisibly.
export function mtgFilterChips(f) {
  const L = (list, v) => (list.find((x) => x[0] === v) || [v, v])[1],
    chips = [];
  if (f.fits) chips.push(["fits", `Fits ${f.fits}`]);
  if (f.format) chips.push(["format", `Legal in ${ALL_FORMATS.find((x) => x.legality === f.format)?.name || f.format}`]);
  if (f.color) chips.push(["color", `Identity within ${L(COLOR_ID, f.color)}`]);
  if (f.cardColor) chips.push(["cardColor", `Color: ${{ W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", M: "Multicolor", C: "Colorless" }[f.cardColor]}`]);
  if (f.type) chips.push(["type", f.type]);
  if (f.rarity) chips.push(["rarity", f.rarity[0].toUpperCase() + f.rarity.slice(1)]);
  if (f.mv) chips.push(["mv", `Mana value ${f.mv}`]);
  if (f.set) chips.push(["set", `Set ${f.set.toUpperCase()}`]);
  if (f.maxPrice) chips.push(["maxPrice", `Under ${usd(Number(f.maxPrice))}`]);
  if (f.own) chips.push(["own", f.own === "owned" ? "Owned" : "Not owned"]);
  if (f.sort) chips.push(["sort", `Sort: ${L(MTG_SORTS, f.sort)}`]);
  return chips;
}
export const chipRow = (chips, act, clearAct) =>
  chips.length ? `<div class="filter-chips" aria-label="Active filters">${chips.map(([k, l]) => `<button class="fchip" data-act="${act}" data-field="${esc(k)}" aria-label="Remove ${esc(l)}">${esc(l)} <span aria-hidden="true">×</span></button>`).join("")}<button class="link small" data-act="${clearAct}">Clear all</button></div>` : "";
export const savedRow = (list, runAct, delAct) =>
  list.length ? `<div class="saved-searches"><span class="muted small">Saved:</span>${list.map((x, i) => `<span class="schip"><button data-act="${runAct}" data-i="${i}">${esc(x.label)}</button><button data-act="${delAct}" data-i="${i}" aria-label="Delete saved search ${esc(x.label)}">×</button></span>`).join("")}</div>` : "";

export function search() {
  const db = S.ui.db,
    f = db.filters,
    deck = currentDeck(),
    chips = mtgFilterChips(f),
    shown = db.results.filter((c) => (f.own === "owned" ? inv(c.name).owned > 0 : f.own === "missing" ? !inv(c.name).owned : true));
  return `<div class="page-head"><h1>Search cards</h1>${viewControl("mtg","search")}<div class="search-tools"><button class="chip tool-chip" data-act="compareOpen" aria-label="Compare cards">${actionIcon("compare")}<span>Compare</span></button><button class="chip tool-chip" data-act="go" data-to="#sets" aria-label="Browse sets">◈ Sets</button><button class="chip tool-chip" data-act="dbRandom" aria-label="Random card">🎲 Random</button></div></div>
  <div class="searchbar search-query"><input id="dbTerm" type="search" data-suggest="mtg" value="${esc(db.term)}" placeholder="Card name, or words like “draw a card”" data-input="dbTerm" data-enter="dbSearch" aria-label="Search all cards" autocomplete="off"><button class="btn" data-act="dbSearch" ${db.busy ? "disabled" : ""}>${db.busy ? "…" : "Search"}</button><button class="ask-launch" data-act="askOpen" aria-label="Ask AI"><span aria-hidden="true">✦</span>Ask</button></div>
  ${chipRow(chips, "dbChip", "dbClear")}
  ${savedRow(savedSearches("mtg"), "dbSaved", "dbSavedDel")}
  <details class="filters"><summary>Filters${chips.length ? ` · ${chips.length} on` : ""}</summary>
    <p class="list-head">Everyday</p><div class="grid2">
    <label>Show<select data-change="dbFilter" data-field="own">${options([["", "All cards"], ["owned", "Cards I own"], ["missing", "Cards I don’t own"]], f.own || "")}</select></label>
    <label>Max price $<input type="number" min="0" step="0.5" value="${esc(f.maxPrice)}" data-change="dbFilter" data-field="maxPrice" placeholder="Any"></label>
    <label>Type<select data-change="dbFilter" data-field="type">${options([["", "Any"], ...["creature", "instant", "sorcery", "artifact", "enchantment", "land", "planeswalker", "legendary creature"].map((x) => [x, x])], f.type)}</select></label>
    <label>Sort<select data-change="dbFilter" data-field="sort">${options(MTG_SORTS, f.sort || "")}</select></label>
    ${deck ? `<button class="btn ghost small span2" data-act="dbFitDeck">Only cards that fit “${esc(deck.name.slice(0, 28))}”</button>` : ""}
    </div>
    <p class="list-head">Colors &amp; format</p><div class="grid2">
    <label>Card color<select data-change="dbFilter" data-field="cardColor">${options([["", "Any"], ["W", "White"], ["U", "Blue"], ["B", "Black"], ["R", "Red"], ["G", "Green"], ["M", "Multicolor"], ["C", "Colorless"]], f.cardColor || "")}</select></label>
    <label title="Commander rules: every mana symbol on the card must be within these colors">Commander identity within<select data-change="dbFilter" data-field="color">${options([["", "Any"], ...COLOR_ID], f.color)}</select></label>
    <label class="span2">Legal in<select data-change="dbFilter" data-field="format">${options([["", "Any format"], ...ALL_FORMATS.filter((x) => x.legality).map((x) => [x.legality, x.name])], f.format)}</select></label>
    </div>
    <details class="advanced"><summary>Advanced</summary><div class="grid2">
    <label>Rarity<select data-change="dbFilter" data-field="rarity">${options([["", "Any"], ["common", "Common"], ["uncommon", "Uncommon"], ["rare", "Rare"], ["mythic", "Mythic"], ["special", "Special"]], f.rarity || "")}</select></label>
    <label>Mana value<select data-change="dbFilter" data-field="mv">${options([["", "Any"], ...["0", "1", "2", "3", "4", "5", "6", "7+"].map((x) => [x, x])], f.mv || "")}</select></label>
    <label class="span2">Set code<input value="${esc(f.set || "")}" placeholder="e.g. FDN" maxlength="6" data-change="dbFilter" data-field="set" autocapitalize="characters"></label>
    </div><p class="foot">The search box also takes Scryfall syntax, e.g. <code>t:angel o:draw id&lt;=w</code>.</p></details>
  </details>
  <div class="row between"><span class="muted small">${db.results.length ? `${db.total.toLocaleString()} cards${f.own ? ` · ${shown.length} ${f.own === "owned" ? "owned" : "not owned"} on this page` : ""}` : "Live from Scryfall"}</span>${db.term.trim() || chips.length ? `<button class="link small" data-act="dbSave">☆ Save this search</button>` : ""}</div>
  ${db.error ? `<div class="note warn">${esc(db.error)}</div>` : db.note && db.results.length ? `<p class="small muted">${esc(db.note)}</p>` : ""}
  ${f.own && db.results.length && !shown.length ? `<p class="small muted">None of the cards on this page are ${f.own === "owned" ? "in your collection" : "missing from your collection"}. ${db.next ? "Load more, or " : ""}<button class="link small" data-act="dbChip" data-field="own">show all</button>.</p>` : ""}
  ${db.busy && !db.results.length ? skeletonGrid() : ""}
  ${
    db.results.length
      ? `<div class="card-grid">${shown
          .map((c) => {
            const own = inv(c.name).owned;
            return `<button class="grid-card" data-act="card" data-name="${esc(c.name)}" ${tierAttrs(tierOf("mtg", c.rarity, c.prices?.usd ?? c.prices?.usd_foil))}>${img(cardImage(c), c.name, "card-img")}${tileChrome("mtg", c)}<span class="grid-meta"><span class="ellip">${esc(c.name)} ${setBadge(c)}</span><span>${usd(c.prices?.usd ?? c.prices?.usd_foil)}</span></span>${own ? `<span class="owned-badge">×${own}</span>` : ""}</button>`;
          })
          .join("")}</div>${db.next ? `<button class="btn ghost block" data-act="dbMore" ${db.busy ? "disabled" : ""}>Load more</button>` : ""}`
      : `<div class="hints"><p class="muted small">Try:</p>${[["Cheap card draw", "o:\"draw a card\" usd<1"], ["Angels", "t:angel"], ["Red legends", "t:legendary t:creature id=r"], ["Token makers", "o:\"create\" o:token"]]
          .map(([l, q]) => `<button class="chip" data-act="dbTry" data-q="${esc(q)}">${esc(l)}</button>`)
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
// What the card sheet shows for a finish: Scryfall's price, else TCGplayer's for the same product,
// else the player's own (long-press). Each says where it came from.
const quoteOfFinish = (p, f) => {
  const v = priceOfFinish(p, f);
  if (v != null) return { value: Number(v), note: "" };
  const t = tcgFallback(p, f);
  if (t) return { value: t.value, note: t.kind === "market" ? "TCGplayer market reference" : t.kind === "mid" ? "Median listing estimate" : "Lowest listing estimate" };
  // Cardmarket (Europe) often prices old and foreign printings US stores don't; shown in euros.
  const eur = f === "etched" ? null : Number(p?.prices?.[f === "foil" ? "eur_foil" : "eur"]);
  if (eur > 0) return { value: eur, cur: "EUR", note: "Cardmarket" };
  const m = myPrice(p, f);
  return m != null ? { value: m, note: "Your price" } : null;
};
const pricePill = (shown, f) => {
  const q = quoteOfFinish(shown, f), mine = myPrice(shown, f), extra = mine != null && q?.note !== "Your price" ? `yours ${usd(mine)}` : q?.note;
  const shownValue = q.cur === "EUR" ? "€" + q.value.toFixed(2) : usd(q.value);
  return `<button class="price-pill ${f}" data-act="buyDirect" data-hold="myPriceSet" data-finish="${f}" aria-label="Buy ${esc(FINISH[f])} on TCGplayer — ${shownValue}. Press and hold to set your own price."><small>${FINISH[f]}</small><b>${shownValue}</b>${extra ? `<small class="pill-note">${esc(extra)}</small>` : ""}<span class="buy-hint">Buy ›</span></button>`;
};

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

// The card's Play guide tab: what it does, when to play it, synergies and cards that pair well.
function mtgCardGuide(c) {
  const g = playGuide("mtg", c),
    cache = S.ui.guide?.["mtg:" + c.name];
  return guideHtml("mtg", c, g, {
    alongside: playedAlongside("mtg", c, allCachedMeta()),
    alongsideAttrs: (x) => `data-act="card" data-name="${esc(x.name)}"`,
    alongsideName: (x) => x.name,
    complements: cache?.cards || [],
    complementsLoading: !cache || cache.loading,
    complementsNote: cache?.note || "",
    rules: cardRules("mtg", c),
  });
}

// The card's Meta tab: where it's played, the decks that play it, and decks to build around it.
function mtgCardMeta(c) {
  const fmt = S.ui.mtgMeta?.format || "Modern",
    M = metaState("mtg:" + fmt),
    usage = cardMetaUsage("mtg", c),
    label = (MTG_META_FORMATS.find((f) => f[0] === fmt) || [fmt, fmt])[1],
    slug = c.name.toLowerCase().split(" // ")[0].replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cardMetaTab("mtg", c, usage, {
    deckAttrs: (set, d) => `data-act="mtgProven" data-format="${esc(set.format)}" data-key="${esc(d.key)}"`,
    buildAttrs: `data-act="buildFrom" data-name="${esc(c.name)}"`,
    loadAttrs: M.data && Date.now() - M.at < 12 * 3600e3 ? "" : `data-act="cardMetaLoad" data-key="mtg:${esc(fmt)}"`,
    loadLabel: `Load ${label} tournament results`,
    busy: M.busy,
    extra: `<a class="btn ghost" href="https://edhrec.com/cards/${esc(slug)}" target="_blank" rel="noopener">Commander decks on EDHREC ↗</a>`,
  }) + `<p class="foot">From the tournament results you’ve opened on Meta decks (${esc(usage.loaded.join(", ") || "none yet")}). Open other formats there to add them.</p>`;
}

export function cardSheet(c, ctx = {}) {
  const name = c.name,
    shown = ctx.print || c, // the printing currently being looked at
    tab = ctx.tab && ctx.tab !== "trade" ? ctx.tab : "overview", // Trade tab retired for now
    i = inv(name),
    inDecks = S.state.decks.filter((d) => d.cards.some((x) => key(x.name) === key(name))),
    deck = ctx.deckId ? deckById(ctx.deckId) : null,
    row = deck?.cards.find((x) => key(x.name) === key(name)),
    roles = engineRoles(c),
    faces = facesOf(shown),
    face = ctx.face && faces[ctx.face] ? ctx.face : 0,
    imgFaces = shown.card_faces?.filter((f) => f.image_uris),
    image = imgFaces?.length > 1 ? imgFaces[face]?.image_uris?.normal : cardImage(shown),
    // A placeholder scan (foreign printing shown in English with a banner, display commanders)
    // borrows the clean art of a printing with the same illustration for the hero.
    clean = shown.image_status === "placeholder" ? (ctx.prints || []).find((p) => p.illustration_id && p.illustration_id === shown.illustration_id && p.image_status === "highres_scan" && p.image_uris?.art_crop) : null,
    heroArt = (imgFaces?.length > 1 ? imgFaces[face]?.image_uris?.art_crop : null) || art(clean || shown),
    chosen = S.state.priceChoices?.[key(name)],
    legal = c.legalities || {},
    prints = ctx.prints || null,
    src = MTG_SOURCES.find((x) => x[0] === (ctx.source || "tcgplayer")) || MTG_SOURCES[0];
  ensureTcgPrices([shown]);
  const finishes = ["nonfoil", "foil", "etched"].filter((f) => quoteOfFinish(shown, f));
  const overview = `
    <div class="cs-card">
      <div class="cd-art-stack"><div class="cd-img"><button class="cd-zoom" data-hold-card="true" data-entry="${esc(ctx.entryId||ctx.entry||'')}" data-act="zoomCard" data-src="${esc(image || "")}" data-hi="${esc(imgFaces?.length > 1 ? imgFaces[face]?.image_uris?.png || "" : shown.image_uris?.png || "")}" data-art="${esc(heroArt || "")}" data-name="${esc(name)}" aria-label="Enlarge ${esc(name)}">${img(image, name, "card-img")}<span class="zoom-badge" aria-hidden="true">${ICON.zoom}</span></button></div>${imgFaces?.length > 1 ? `<button class="btn ghost small block" data-act="flipFace">↻ Flip to ${esc(imgFaces[face ? 0 : 1].name)}</button>` : ""}</div>
      <div class="cs-card-side">${alertStatus("mtg",trackedQuote("mtg",shown)?.id,name)}
        <p class="small own-line">${i.owned ? `<b class="ok-text">You own ${i.owned}</b> · ${i.available} free${i.reserved ? ` · ${i.reserved} reserved` : ""}` : "Not in your collection"}${inDecks.length ? ` · in ${inDecks.map((d) => esc(d.name)).join(", ")}` : ""}</p>
        <div class="chips">${roles.map((r) => `<span class="chip role-${r.toLowerCase()}">${r}</span>`).join("")}${c.edhrec_rank ? `<span class="chip">EDHREC #${Number(c.edhrec_rank).toLocaleString()}</span>` : ""}${c.reserved ? `<span class="chip">Reserved List</span>` : ""}${c.game_changer ? `<span class="chip warn">Game Changer</span>` : ""}</div>
        ${deck ? deckLegalLine(c, deck) : ""}
      </div>
    </div>
    ${row ? `<div class="panel tight"><div class="row between"><b>In ${esc(deck.name)}</b><span class="stepper"><button data-act="deckQty" data-name="${esc(name)}" data-delta="-1" aria-label="One fewer">−</button><b>${row.qty}</b><button data-act="deckQty" data-name="${esc(name)}" data-delta="1" aria-label="One more">＋</button></span></div>${key(name) !== key(deck.commander) ? `<button class="link danger small" data-act="deckRemove" data-name="${esc(name)}">Remove from deck</button>` : ""}</div>` : ""}
    <div class="card-actions">
      <div class="ca-main"><button class="btn" data-act="own" data-name="${esc(name)}">＋ Add to collection</button><button class="btn ghost" data-act="wish" data-name="${esc(name)}">♡ Wishlist</button></div>
      <div class="ca-more">${isLand(c) ? "" : `<button class="btn ghost small" data-act="buildFrom" data-name="${esc(name)}">⚒ Build decks</button>`}<button class="btn ghost small" data-act="compareFrom" data-name="${esc(name)}">⇄ Compare</button>${ctx.random ? `<button class="btn ghost small" data-act="dbRandom">🎲 Another</button>` : ""}</div>
    </div>
    ${S.state.decks.length ? `<div class="inline-pick"><select id="toDeck" aria-label="Deck to add to">${options(S.state.decks.map((d) => [d.id, d.name]), deck?.id || S.state.activeDeck)}</select><button class="btn ghost" data-act="addToDeck" data-name="${esc(name)}">Add to deck</button></div>` : ""}
    ${factBox(factsFor(c, prints), c.oracle_id || name)}
    <div class="links research"><span class="muted small">Research</span>
      <a href="${esc(c.scryfall_uri || "https://scryfall.com/search?q=" + encodeURIComponent(name))}" target="_blank" rel="noopener">Scryfall ↗</a>
      <a href="https://edhrec.com/cards/${esc(name.toLowerCase().split(" // ")[0].replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}" target="_blank" rel="noopener">EDHREC ↗</a>
      <button class="link" data-act="buyCard">Where to buy ›</button>
    </div>`;
  const pricesTab = `${priceOverview("mtg",shown,ctx,Object.entries(shown.purchase_uris||{}))}<details class="market-details"><summary>Market details · sources & finishes</summary>
    <div class="src-row" role="tablist" aria-label="Price source">${MTG_SOURCES.map(([id, label]) => `<button class="chip pick ${id === src[0] ? "on" : ""}" data-act="priceSource" data-src="${id}">${esc(label)}</button>`).join("")}</div>
    <div class="price-table" style="--cols:${Object.keys(src[3]).length}"><div class="pt-head"><span></span>${Object.keys(src[3]).map((f) => `<b class="${f}">${FINISH[f]}</b>`).join("")}</div>
      <div class="pt-row"><span class="pt-label">${esc(shown.set_name || "This printing")} <small class="muted">${esc((shown.set || "").toUpperCase())} #${esc(shown.collector_number || "?")}</small></span>${Object.values(src[3]).map((k) => `<span>${money(shown.prices?.[k], src[2])}</span>`).join("")}</div>
    </div>
    <p class="foot">${esc(src[1])} ${src[2] === "TIX" ? "price for Magic Online tickets" : "market estimate"} from Scryfall, updated daily${shown.checkedAt ? " · checked " + esc(new Date(shown.checkedAt).toLocaleDateString()) : ""}. Condition prices (NM, LP…) and stock are on the store’s page.</p>
    ${prints ? `<p class="small">Across ${prints.length} printings: <b class="ok-text">${usd(cheapest(prints))}</b> cheapest · <b>${usd(dearest(prints))}</b> priciest <button class="link small" data-act="cardTab" data-tab="versions">Compare all →</button></p>` : ""}
    ${chosen ? `<p class="small">Your shopping price: <b>${usd(chosen.price)}</b> · ${esc(chosen.label)}</p>` : ""}
    <div class="actions wrap"><button class="btn" data-act="buyCard" data-finish="${finishes[0] || "nonfoil"}">Buy this printing ›</button>${shown.purchase_uris?.[src[0]] ? `<a class="btn ghost" href="${esc(shown.purchase_uris[src[0]])}" target="_blank" rel="noopener noreferrer">${esc(src[1])} listing ↗</a>` : ""}</div></details>`;
  const rulings = ctx.rulings
    ? ctx.rulings.length
      ? `<ul class="rulings">${ctx.rulings.map((r) => `<li><p>${symbolText(r.comment)}</p><small class="muted">${esc(r.source === "wotc" ? "Wizards of the Coast" : "Scryfall")} · ${esc(r.published_at || "")}</small></li>`).join("")}</ul>`
      : `<p class="muted small">No official rulings for this card. The <button class="link" data-act="go" data-to="#rules">Magic rules reference</button> covers the general rules.</p>`
    : `<p class="muted small" id="rulingsLoading">Loading official rulings…</p>`;
  const legality = `${deck ? deckLegalLine(c, deck) : ""}
    <div class="legal">${ALL_FORMATS.filter((f) => f.legality).map((f) => legalChip(f, legal)).join("")}</div>
    <p class="foot">From Scryfall’s current data. Green = legal, red = banned, gold = restricted. <button class="link small" data-act="go" data-to="#rules">Banned lists & format rules →</button></p>`;
  return `<div class="sheet-head overlay">${S.ui.sheetBack ? `<button class="icon" data-act="sheetBack" aria-label="Back to deck idea">←</button>` : "<span></span>"}<button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="cs-banner"><div class="cs-hero mtg">${img(heroArt, name, "cs-art")}<div class="cs-shade"></div></div>
  <div class="cs-title"><div><h2>${esc(name)}</h2><p class="type-line">${esc(faces[face]?.type_line || typeText(shown))}</p></div>${manaCost(faces[face] || shown)}</div></div>
  ${emblemChips("mtg", c)}
  <div class="cs-meta">
    <button class="cd-set" data-act="set" data-code="${esc(shown.set || "")}" ${shown.set ? "" : "disabled"} aria-label="See every card in ${esc(shown.set_name || "this set")}">${setIcon(shown.set, shown.rarity, 24)}<div><b>${esc(shown.set_name || (shown.set || "").toUpperCase())} <span class="set-go">›</span></b><small>${esc((shown.set || "").toUpperCase())} #${esc(shown.collector_number || "?")} · ${esc(RARITY[shown.rarity] || shown.rarity || "")}${shown.released_at ? " · " + esc(shown.released_at.slice(0, 4)) : ""}</small></div></button>
    <div class="cd-prices">${
      finishes.length
        ? finishes.map((f) => pricePill(shown, f)).join("") + `<p class="price-gap small muted">Tap a price to buy on TCGplayer. Press and hold it, or <button class="link small" data-act="myPriceSet" data-finish="${finishes[0]}">set your price</button>; only you see it.</p>`
        : `<button class="price-pill unknown" data-act="buyDirect" data-hold="myPriceSet" data-finish="nonfoil" aria-label="Find sellers on TCGplayer. Press and hold to set your own price."><small>Price</small><b>No price yet</b><span class="buy-hint">Find sellers ›</span></button><p class="price-gap small muted">No store prices this printing yet. Tap to see TCGplayer listings. Press and hold, or <button class="link small" data-act="myPriceSet" data-finish="nonfoil">set your price</button>; only you see it.</p>`
    }</div>
  </div>
  ${faces
    .map(
      (f, n) => `<section class="cd-text effect-card mtg">
      <p class="eyebrow effect-label">Spellcraft · Rules text</p>${faces.length > 1 ? `<div class="row between"><b>${esc(f.name)}</b>${manaCost(f)}</div><p class="type-line">${esc(f.type_line || "")}</p>` : ""}
      ${f.oracle_text ? `<div class="oracle">${effectText("mtg",f.oracle_text)}</div>` : ""}
      ${f.flavor_text ? `<blockquote class="flavor"><small class="eyebrow">Flavour</small>${esc(f.flavor_text)}</blockquote>` : ""}
      <div class="row between small muted">${f.power !== undefined && f.power !== null ? `<span class="pt">${esc(f.power)}/${esc(f.toughness)}</span>` : shown.loyalty && !n ? `<span class="pt">Loyalty ${esc(shown.loyalty)}</span>` : "<span></span>"}${f.artist || shown.artist ? `<span>🖌 ${esc(f.artist || shown.artist)}</span>` : ""}</div>
    </section>`,
    )
    .join("")}
  ${!c.full ? `<p class="muted small center" id="cardLoading">Loading flavor text and printings…</p>` : ""}
  ${cardTabs(tab, [["overview", "Overview"], ["meta", "Meta"], ["guide", "Play guide"], ["versions", `Versions${prints ? " · " + prints.length : ""}`], ["prices", "Prices"], ["rulings", "Rulings"], ["legal", "Legality"]])}
  ${cardPanel("overview", tab, overview)}
  ${cardPanel("meta", tab, mtgCardMeta(c))}
  ${cardPanel("guide", tab, mtgCardGuide(c))}
  ${cardPanel("versions", tab, `<section class="prints">${prints ? printList(prints, shown, name, chosen) : `<p class="muted small">Loading every printing…</p>`}</section>`)}
  ${cardPanel("prices", tab, pricesTab)}
  ${tab === "trade" ? cardPanel("trade", tab, mtgTradePanel(name, shown, ctx)) : ""}
  ${cardPanel("rulings", tab, rulings)}
  ${cardPanel("legal", tab, legality)}`;
}

// Trade tab: fair swaps from your collection and wishlist (trade.js).
function mtgTradePanel(name, shown, ctx={}) {
  const st = S.state,
    byName = new Map();
  // One offer item per physical lot: the same card in different printings or finishes is
  // worth different amounts, so copies are never priced at the most expensive printing.
  for (const e of st.collection) {
    if (!(e.qty > 0) || key(e.name) === key(name)) continue;
    const p = lotPrice(e, S.catalog, st.printings),
      pr = e.printingVerified ? st.printings?.[e.printingId] : null,
      label = [pr?.set_name || pr?.set?.toUpperCase?.() || "", e.finish && e.finish !== "nonfoil" ? e.finish : "", e.condition && e.condition !== "NM" ? e.condition : ""].filter(Boolean).join(" · "),
      k = [key(e.name), e.printingId || "", e.finish || "nonfoil", e.condition || ""].join("|"),
      x = byName.get(k) || { key: k, name: e.name + (label ? ` (${label})` : ""), price: p, qty: 0, art: img(cardImage(pr || meta(e.name)), e.name, "mini-art"), open: `data-act="card" data-name="${esc(e.name)}"` };
    x.qty += e.qty;
    byName.set(k, x);
  }
  const wish = st.wishlist.map((w) => ({ key: key(w.name), name: w.name, price: priceOf(w.name), art: img(cardImage(meta(w.name)), w.name, "mini-art"), open: `data-act="card" data-name="${esc(w.name)}"` }));
  const p = Number(priceOfFinish(shown, "nonfoil")) || priceOf(name);
  const needMap=new Map();for(const d of st.decks)for(const r of aggregateCards(d.cards)){
   const k=key(r.name),qty=Math.max(0,r.qty-inv(r.name).available);if(!qty||k===key(name))continue;
   const old=needMap.get(k),card=meta(r.name);needMap.set(k,{key:k,name:r.name,price:priceOf(r.name),qty:Math.max(qty,old?.qty||0),priority:engineRoles(card).some(x=>['Ramp','Draw','Synergy'].includes(x))?3:2,deckName:d.name,art:img(cardImage(card),r.name,'mini-art'),open:`data-act="card" data-name="${esc(r.name)}"`});
  }
  return tradePanel({ key: key(name), name, price: p > 0 ? p : null, owned: inv(name).owned > 0 }, [...byName.values()], wish, {...ctx.tradeOptions,needs:[...needMap.values()]});
}

const allPrices = (prints) => prints.flatMap((p) => ["nonfoil", "foil", "etched"].map((f) => Number(priceOfFinish(p, f))).filter((x) => x > 0));
const cheapest = (prints) => (allPrices(prints).length ? Math.min(...allPrices(prints)) : null);
const dearest = (prints) => (allPrices(prints).length ? Math.max(...allPrices(prints)) : null);

function printList(prints, shown, name, chosen) {
  if (!prints.length) return `<p class="muted small">No paper printings found.</p>`;
  return `<div class="print-list">${prints
    .map((p, i) => {
      const fin = ["nonfoil", "foil", "etched"].filter((f) => p.finishes?.includes(f) || priceOfFinish(p, f));
      return `<div class="print ${p.id === shown.id ? "on" : ""}">
        <button class="print-main" data-act="viewPrint" data-i="${i}">${img(p.image_uris?.small || p.card_faces?.[0]?.image_uris?.small, p.set_name, "print-thumb")}<span class="print-name">${setIcon(p.set, p.rarity, 16)}<span class="ellip"><b>${esc(p.set_name)}</b><small>${esc(p.set.toUpperCase())} #${esc(p.collector_number)} · ${esc((p.released_at || "").slice(0, 4))}${p.promo ? " · promo" : ""}${p.full_art ? " · full art" : ""}${(p.frame_effects || []).includes("showcase") ? " · showcase" : ""}${(p.frame_effects || []).includes("extendedart") ? " · extended" : ""}${p.border_color === "borderless" ? " · borderless" : ""}</small></span></span></button>
        <span class="print-prices"><button class="pp buy" data-act="buyCard" data-i="${i}" data-finish="${fin[0] || "nonfoil"}" aria-label="Buy the ${esc(p.set_name)} printing">Buy</button>${fin.length ? fin.map((f) => `<button class="pp ${chosen?.id === p.id && chosen?.finish === f ? "on" : ""}" data-act="choosePrint" data-i="${i}" data-finish="${f}" data-name="${esc(name)}" title="Use this price for shopping"><small>${f === "nonfoil" ? "reg" : f}</small>${usd(priceOfFinish(p, f))}</button>`).join("") : '<span class="muted small">—</span>'}</span>
      </div>`;
    })
    .join("")}</div><p class="foot">Tap a printing for its art and details, or a price to use it. Foil effects may not show in the picture.</p>`;
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
    list = st.list.filter((x) => !x.digital && (st.all || MAIN_TYPES.has(x.set_type)) && (!q || x.name.toLowerCase().includes(q) || x.code.includes(q))),
    years = new Map();
  for (const x of list) {
    const y = (x.released_at || "Upcoming").slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(x);
  }
  return `<div class="page-head"><h1>Magic sets</h1></div>
  <div class="searchbar"><input type="search" value="${esc(st.q)}" placeholder="Find a set by name or code" data-input="setsSearch" aria-label="Find a set" autocomplete="off"></div>
  <div class="set-catalog-toolbar"><span class="muted small">${st.list.length ? `${list.length.toLocaleString()} sets · Scryfall` : ""}</span><button class="link small" data-act="setsReload" ${st.busy?"disabled":""}>${st.busy?"Refreshing…":"Refresh sets"}</button><label class="check small"><input type="checkbox" data-change="setsAll" ${st.all ? "checked" : ""}> Promos, tokens & extras</label></div>
  ${st.error ? `<div class="note warn">${esc(st.error)} <button class="link" data-act="setsReload">Try again</button></div>` : ""}
  ${!st.list.length && st.busy ? `<p class="muted center pad">Loading every set…</p>` : ""}
  ${[...years]
    .map(([y, xs]) => `<h2 class="year">${esc(y)}</h2><div class="set-list">${xs.map(x => `<button class="set-row" data-act="set" data-code="${esc(x.code)}">${setRowContent({name:x.name,code:x.code.toUpperCase(),image:x.icon || setIconUrl(x.code),symbol:`<span class="set-icon" style="--icon:url('${esc(x.icon || setIconUrl(x.code))}')" aria-hidden="true"></span>`,detail:[SET_TYPES[x.set_type]||x.set_type,x.released_at].filter(Boolean).join(' · '),count:x.card_count})}</button>`).join("")}</div>`)
    .join("")}
  ${st.list.length && !list.length ? empty("No sets match", "Try another name, or include promos and extras.") : ""}`;
}

export function setPage() {
  const st = S.ui.set,
    info = st.info,
    owned = ownedPrintings(),
    q = st.q.trim().toLowerCase(),
    ownedOf = (c) => owned.get(c.set + "#" + String(c.collector_number).toLowerCase()) || 0,
    price = (c) => Number(["nonfoil", "foil", "etched"].map((f) => cardPrice(c, f)).find((v) => v != null) ?? NaN),
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
  <div class="list-bar"><p class="muted small">${st.busy ? `Loading ${all.length ? all.length + " of " + (st.total || "…") : ""} cards…` : all.length ? `${list.length.toLocaleString()} match · Scryfall prices, TCGplayer's where Scryfall has none` : ""}</p>${viewControl("mtg", "set")}</div>
  <div class="card-grid set-grid">${list
    .slice(0, st.limit)
    .map((c) => {
      const i = all.indexOf(c),
        n = ownedOf(c),
        other = !n && inv(c.name).owned;
      return `<button class="grid-card ${n ? "own" : ""}" data-act="card" data-name="${esc(c.name)}" data-set-i="${i}" ${tierAttrs(tierOf("mtg", c.rarity, Number.isFinite(price(c)) ? price(c) : null))}>${img(cardImage(c, "normal"), c.name, "card-img")}${tileChrome("mtg", c)}<span class="grid-meta"><span class="ellip">#${esc(c.collector_number)} ${esc(c.name)}</span><span>${Number.isFinite(price(c)) ? usd(price(c)) : "—"}</span></span>${n ? `<span class="owned-badge">×${n}</span>` : other ? `<span class="owned-badge other" title="You own a different printing">other ed.</span>` : ""}</button>`;
    })
    .join("")}</div>
  ${list.length > st.limit ? `<button class="btn ghost block" data-act="setMore">Show more · ${(list.length - st.limit).toLocaleString()} left</button>` : ""}
  ${!st.busy && st.loaded && !list.length ? empty("No cards match", "Change the filters above.") : ""}`;
}

/* ---------- Deck generator (every format) ---------- */

const tierLabel = (t) => (t.variant ? `${t.variant}${t.coversText ? ` · ${t.coversText}` : ""}` : t.budget===Infinity ? "No budget limit" : t.budget ? `Up to $${t.budget}${t.upTo ? "–" + t.upTo : ""}` : "Your cards only");

function tierCard(t, i, mode, tierList = null) {
  const p = t.power == null ? engineProfile({ format: t.format, commander: t.commander, cards: t.cards }, S.catalog) : null,
    shown = S.ui.build.openTier === i,
    groups = { Creatures: [], Spells: [], Lands: [], Other: [] };
  for (const r of t.cards) {
    const c = meta(r.name),
      g = !c ? "Other" : isLand(c) ? "Lands" : /\bCreature\b/.test(typeText(c)) ? "Creatures" : "Spells",
      free = Math.min(r.qty, S.ui.build.avail?.(r.name) ?? 0),
      basic = isBasic(c) || /^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/.test(r.name);
    const need = basic ? 0 : Math.max(0, r.qty - free), tt = tierOf("mtg", c?.rarity || "", priceOf(r.name)), why = r.why === "Already in your list" ? "Kept in this version" : r.why || "";
    // The same card tile as the deck page: art with price, set and mana, owned or needed.
    const tile = `<div class="lot deck-row tier-row ${need ? "short" : ""}" data-tier="${tt.key}" style="${tierStyle(tt)}"><button class="lot-art" data-act="card" data-name="${esc(r.name)}" aria-label="Open ${esc(r.name)}">${img(cardImage(c), r.name)}${c ? tileChrome("mtg", c) : ""}<span class="art-price">${usd(priceOf(r.name))}</span></button><div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(r.name)}">${esc(r.name)}</button><span class="lot-sub">${manaCost(c)}${why ? `<small class="muted">${esc(why)}</small>` : ""}</span><span class="own ${need ? "no" : "yes"}">${need ? "Need " + need : basic && !free ? "Basic land" : "Owned"}</span></div><div class="lot-side"><span class="tier-qty">×${r.qty}</span></div></div>`;
    groups[g].push({ qty: r.qty, name: r.name, tile, need, art: img(art(c), r.name, "mini-art"), act: `data-act="card" data-name="${esc(r.name)}"`, why, status: basic ? "basic" : free >= r.qty ? "✓ Owned" : `Need ${r.qty - free}`, ok: basic || free >= r.qty });
  }
  for (const k of Object.keys(groups)) groups[k].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  return tierCardHtml({
    title: `${t.total < t.size ? `Draft — ${t.size - t.total} slot${t.size - t.total === 1 ? "" : "s"} open · ` : ""}${esc(tierLabel(t))}`,
    format: t.format,
    legal: t.total < t.size ? { ok: false, text: "Incomplete" } : { ok: true, text: "Legal" },
    cost: t.cost, unknown: t.unknown, difficulty: t.difficulty, power: t.power ?? shownPower(p), powerKind: t.powerKind, engine: t.engine,
    sizeText: `${t.total}/${t.size} cards`, owned: t.total ? t.owned / t.total : 0,
    evidence: t.proven ? `Tournament candidate · ${t.label}` : "", warnings: t.warnings.filter((w) => !/slots? still open/.test(w)),
    notes: budgetComparisonHtml(t, i, "tierAlternative") + (tierList ? draftPath(tierList, i, tierLabel) : ""),
    open: shown,
    groups: ["Creatures", "Spells", "Lands", "Other"].map((name) => ({ name, rows: groups[name] })),
    toggle: `data-act="tierToggle" data-i="${i}"`,
    save: mode === "fill" ? `data-act="tierApply" data-i="${i}"` : `data-act="tierSave" data-i="${i}"`,
    saveLabel: mode === "fill" ? "Use this version" : "Save as deck",
    buy: `data-act="tierBuy" data-i="${i}"`, need: Object.values(groups).flat().reduce((a, r) => a + r.need, 0),
    more: mode === "fill" ? [{ icon: "copy", label: "Copy deck list", note: "Paste into any deck site", attrs: `data-act="tierCopy" data-i="${i}"` }] : [
      { icon: "sword", label: "Save and see matchups", note: "How it does against the decks winning now", attrs: `data-act="tierSaveGo" data-i="${i}" data-to="matchups"` },
      { icon: "cardStack", label: "Save and playtest", note: "Draw opening hands", attrs: `data-act="tierSaveGo" data-i="${i}" data-to="playtest"` },
      { icon: "copy", label: "Copy deck list", note: "Arena / MTGO text", attrs: `data-act="tierCopy" data-i="${i}"` },
    ],
  });
}

export function buildSheet() {
  const B = S.ui.build,
    seed = meta(B.seed),
    fmts = seed ? formatsFor(seed, ALL_FORMATS) : [],
    tiers = B.results[B.format] || null;
  return `<div class="sheet-head"><h2 class="build-heading">${brandMark("brand-idle")}<span>Build decks</span></h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="build-seed">${img(art(seed), B.seed, "mini-art")}<div><small class="muted">Built around</small><b>${esc(B.seed)}</b>${seed ? colorDots(seed) : ""}</div><button class="btn ghost small" data-act="buildRandom" data-format="${esc(B.format)}">🎲 Random card</button></div>
  <p class="muted small">Pick a format for a complete, legal deck at each budget, using your cards first. Basic lands count as owned.</p>
  <div class="fmt-chips">${fmts.map((f) => `<button class="chip pick ${f.name === B.format ? "on" : ""}" ${B.busy?"disabled":""} data-act="buildFormat" data-format="${esc(f.name)}">${esc(f.name)}</button>`).join("") || '<span class="muted small">This card isn’t legal in any constructed format.</span>'}</div>
  <label class="custom-budget">Purchase budget $<input id="buildCustom" type="number" min="0" max="100000" step="1" value="${esc(B.custom ?? "")}" placeholder="Blank = unlimited" ${B.busy?"disabled":""} data-change="buildCustom"></label>
  ${B.busy ? buildOverlay(B.msg) : B.msg ? `<p class="small ${B.error ? "warn-text" : "muted"}" role="status">${esc(B.msg)}</p>` : ""}
  ${tiers ? `<div class="tiers">${tiers.map((t, i) => tierCard(t, i, "build", tiers)).join("")}</div>${tiers.length > 1 ? `<button class="btn ghost block" data-act="tierSaveAll">Save all ${tiers.length} versions</button>` : ""}` : ""}
  <p class="foot">Built from your cards first, then what today's tournament decks play. A strong start, not a tuned tournament list. Prices are daily estimates.</p>`;
}

function fillAnyPanel(d, fm, count) {
  const B = S.ui.build,
    tiers = B.fillDeck === d.id ? B.results.__fill : null;
  return `<section class="panel"><p class="eyebrow">${esc(fm.name)}</p><button class="btn ghost" data-act="optimizeMtgDeck">Compare budget builds</button><h2>${count < fm.size ? `Fill ${fm.size - count} open slots` : "Complete this list"}</h2>
  <p class="muted small">Keeps every card you chose, then completes the deck with ${esc(fm.name)}-legal cards in its colors — your cards first, then the best affordable ones. One version per budget.</p>
  ${count > fm.size ? `<div class="notice warn">${count - fm.size} cards above the ${fm.size}-card consistency target. <button class="btn ghost small" data-act="reviewTrim">Review cuts</button></div>` : ""}
  ${count === fm.size ? `<button class="btn" data-act="suggestFormatUpgrades" ${B.busy ? "disabled" : ""}>Find paired upgrades</button><p class="muted small">Same-role spell swaps within your $${esc(d.budget ?? 25)} purchase budget. Suggestions are heuristics, not measured win rates.</p>` : ""}
  ${B.fillDeck === d.id && B.formatSwaps?.length ? `<div class="list">${B.formatSwaps.map((swap,i)=>`<article class="panel"><div class="swap-art-pair"><div>${img(art(meta(swap.cardOut)),swap.cardOut,"mini-art")}<small class="muted">OUT</small><b>${esc(swap.cardOut)}</b></div><span aria-hidden="true">→</span><div>${img(art(meta(swap.cardIn)),swap.cardIn,"mini-art")}<small class="ok-text">IN</small><b>${esc(swap.cardIn)}</b></div></div><p class="small muted">${esc(swap.reason)}</p><button class="btn ghost small" data-act="applyFormatUpgrade" data-i="${i}">Swap 1 copy · ${usd(swap.cost)} to buy</button></article>`).join("")}</div>` : ""}
  <div class="actions"><button class="btn" data-act="fillAny" ${B.busy || count > fm.size ? "disabled" : ""}>${B.busy && B.fillDeck === d.id ? "Building…" : tiers ? "↻ Rebuild" : "Build versions"}</button></div>
  ${B.busy && B.fillDeck === d.id ? buildOverlay(B.msg, { title: "Building your deck versions", note: "Filling the open slots at each budget, then checking every version with Deck Power. This can take up to a minute." }) : B.fillDeck === d.id && B.msg ? `<p class="small muted" role="status">${esc(B.msg)}</p>` : ""}
  </section>
  ${tiers ? `<div class="tiers">${tiers.map((t, i) => tierCard(t, i, "fill", tiers)).join("")}</div>` : ""}`;
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
  ${historyPanel(quoteModel("mtg",p,finish),ctx.range || "30")}
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
  return `<div class="page-head"><h1>Collection</h1><div class="head-actions">${S.ui.collTab === "cards" ? viewControl("mtg","collection")+selectionControl("mtg") : ""}<button class="btn small" data-act="addCard">＋ Add</button><button class="icon" data-act="collMenu" aria-label="More collection actions">⋯</button></div></div>
  ${segmented("collTab", tab === "wishlist" ? "cards" : tab, [["cards", "Cards"], ["binders", "Binders"], ["value", "Value"]])}
  ${tab === "binders" ? binderShelf(S.state.collection.map(entry => { const c=(entry.printingVerified && S.state.printings?.[entry.printingId]) || meta(entry.name); return {entry,card:c,image:cardImage(c),game:"mtg"}; }),"mtg",S.state.settings.binders || []) : tab === "value" ? collectionValueView() : collectionCards(tab === "wishlist")}`;
}

function collectionCards(wantedOnly = false) {
  const st = S.state;
  if (wantedOnly) S.ui.collFilter = "wanted";
  const wanted = wishlistItems();
  if (!st.collection.length && !wanted.length)
    return empty("Start with the cards in front of you", "Add one card, scan it, or import a ManaBox / Moxfield / CSV export. Nothing counts as owned until you add it.", `<button class="btn" data-act="addCard">Add a card</button><button class="btn ghost" data-act="importCollection">Import a list</button>`);
  const value = collectionValue(st.collection, S.catalog, st.printings, []);
  return `<p class="summary-line"><b>${sumQty(st.collection)}</b> copies · <b>${new Set(st.collection.map((e) => key(e.name))).size}</b> names · <b data-count="${Math.round(value.total)}" data-money="1">${usd(value.total, 0)}</b>${value.unpriced ? ` <span class="muted">(${value.unpriced} unpriced)</span>` : ""}${wanted.length ? ` · <b>${wanted.length}</b> wanted` : ""}</p>
  <div class="searchbar want-add"><input id="wishName" placeholder="Add a card you want" data-enter="wishAdd" data-suggest="mtg" aria-label="Add a card to your wishlist"><button class="btn ghost" data-act="wishAdd">${actionIcon("heart")}<span>Want</span></button></div>
  <div class="toolbar"><input type="search" value="${esc(S.ui.q.coll)}" placeholder="Search name, set, binder…" data-input="collSearch" aria-label="Search collection"><select data-change="collSort" aria-label="Sort">${options([["set-order","Set year · card number"], ["name", "A–Z"], ["value", "Value ↓"], ["impact", "Deck-building value"], ["recent", "Recent"], ["color", "Color"], ["mv", "Mana value"]], S.ui.collSort)}</select><select data-change="collFilter" aria-label="Filter">${options([["all", "Owned + wanted"], ["owned", "Owned only"], ["wanted", "Wanted"], ["meta", "★ Meta & staples"], ["spare", "Not in a deck"], ["review", "Printing to review"], ["foil", "Foils"], ["unpriced", "Unpriced"]], S.ui.collFilter)}</select></div>
  <div id="collList">${collectionList()}</div>`;
}

// Owned cards worth trading or holding, from tournament play rates (see importance.js).
function mtgTradeAdvice() {
  const st = S.state,
    used = new Map(),
    items = new Map();
  for (const d of st.decks) for (const c of aggregateCards(d.cards)) used.set(key(c.name), Math.max(used.get(key(c.name)) || 0, c.qty));
  for (const e of st.collection) {
    const k = key(e.name),
      x = items.get(k) || { key: k, name: e.name, card: meta(e.name), qty: 0, inDecks: used.get(k) || 0, price: lotPrice(e, S.catalog, st.printings) };
    const p=lotPrice(e,S.catalog,st.printings);x.value=(x.value||0)+(p??0)*e.qty;x.unpriced=!!x.unpriced||p==null;
    x.qty += e.qty;x.price=x.unpriced?null:x.value/x.qty;
    items.set(k, x);
  }
  return tradeAdviceHtml("mtg", tradeAdvice("mtg", [...items.values()]), (x) => `data-act="card" data-name="${esc(x.name)}"`, (p) => usd(p));
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
      case "meta": return hasEmblem("mtg", meta(e.name));
      case "review": return !e.printingVerified;
      case "foil": return e.finish !== "nonfoil";
      case "unpriced": return lotPrice(e, S.catalog, st.printings) === null;
    }
    return true;
  });
  // Wanted cards (wishlist copies you don't own yet) sit in the same list, greyed out.
  const f = S.ui.collFilter;
  if (f === "wanted") list = [];
  if (f === "all" || f === "wanted" || !f)
    list = list.concat(wishlistItems().filter((w) => !q || w.name.toLowerCase().includes(q)).map((w, i) => ({ id: "w:" + w.id, name: w.name, qty: 0, wanted: w })));
  const val = (e) => (e.wanted ? priceOf(e.name, e.wanted.finish) ?? -1 : (lotPrice(e, S.catalog, st.printings) ?? -1) * e.qty),
    colorRank = (e) => {
      const id = meta(e.name)?.color_identity || [];
      return id.length > 1 ? 6 : id.length ? "WUBRG".indexOf(id[0]) : 5;
    };
  const orderOf=e=>{const c=(e.printingVerified&&st.printings?.[e.printingId]) || meta(e.name);return {name:e.name,set:e.set || c?.set_name || '',number:e.collectorNumber || c?.collector_number,date:e.set?S.ui.sets.list.find(s=>s.code===e.set)?.released_at || (c?.set===e.set?c.released_at:''):c?.released_at || ''};};
  list.sort((a, b) =>
    S.ui.collSort === 'set-order' ? collectionOrder(orderOf(a),orderOf(b))
    : S.ui.collSort === "value" ? val(b) - val(a)
    : S.ui.collSort === "impact" ? impactScore("mtg", meta(b.name)) - impactScore("mtg", meta(a.name)) || val(b) - val(a)
    : S.ui.collSort === "recent" ? (order.get(b.id) ?? -1) - (order.get(a.id) ?? -1)
    : S.ui.collSort === "color" ? colorRank(a) - colorRank(b) || a.name.localeCompare(b.name)
    : S.ui.collSort === "mv" ? (meta(a.name)?.cmc ?? 99) - (meta(b.name)?.cmc ?? 99) || a.name.localeCompare(b.name)
    : a.name.localeCompare(b.name),
  );
  const total = list.length;
  list = list.slice(0, S.ui.collLimit);
  if (!total) return `<p class="muted center pad">No cards match.</p>`;
  return `<div class="list display-list deal">${list
    .map((e, i) => {
      if (e.wanted) {
        const c = meta(e.name),
          p = priceOf(e.name, e.wanted.finish);
        const t = tierOf("mtg", c?.rarity, p);
        return `<div class="lot wanted" data-tier="${t.key}" style="--i:${Math.min(i, 24)};${tierStyle(t)}"><button class="lot-art" data-act="card" data-name="${esc(e.name)}" aria-label="Open ${esc(e.name)} (wanted, not owned)">${img(cardImage(c), e.name)}${c ? tileChrome("mtg", c) : ""}<span class="want-tag" aria-hidden="true">${actionIcon("heart")}Wanted</span></button><div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(e.name)}">${esc(e.name)}</button><span class="lot-sub"><span class="want-chip">${e.wanted.need > 1 ? `Need ${e.wanted.need}` : "Not owned"}</span>${manaCost(c)}${S.state.decks.some((d) => d.cards.some((x) => key(x.name) === key(e.name))) ? "<span>In a deck</span>" : ""}</span></div><div class="lot-side"><span class="price">${usd(p === null ? null : p * e.wanted.need)}</span><span class="want-actions"><button class="btn small want-got" data-act="own" data-name="${esc(e.name)}">＋ Got it</button><button class="want-x" data-act="wishRemove" data-id="${esc(e.wanted.id)}" aria-label="Remove ${esc(e.name)} from wishlist">×</button></span></div></div>`;
      }
      const c = (e.printingVerified && st.printings?.[e.printingId]) || meta(e.name),
        unit = lotPrice(e, S.catalog, st.printings);
      const t = tierOf("mtg", c?.rarity, unit);
      return `<div class="lot" data-tier="${t.key}" style="--i:${Math.min(i, 24)};${tierStyle(t)}">${selectionMark("mtg",e.id)}
        <button class="lot-art" data-act="card" data-name="${esc(e.name)}" data-entry="${esc(e.id)}" aria-label="Open ${esc(e.name)}">${img(cardImage(c), e.name)}${c ? tileChrome("mtg", c) : ""}${tierGem(t)}</button>
        <div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(e.name)}" data-entry="${esc(e.id)}">${esc(e.name)}${rowEmblem("mtg", c)} ${setBadge(e.printingVerified ? c : {set:e.set,set_name:e.setName,collector_number:e.collectorNumber}, {physical:true,unspecified:!e.set&&!e.printingVerified})}</button>
          <span class="lot-sub">${manaCost(c)}<span>${esc((e.set || e.setName || "Any printing").toUpperCase())}${e.collectorNumber ? " #" + esc(e.collectorNumber) : ""}${e.finish !== "nonfoil" ? ` · <b class="foil">${esc(e.finish)}</b>` : ""}${e.condition && e.condition !== "Near Mint" ? " · " + esc(e.condition) : ""}${e.location ? " · " + esc(e.location) : ""}</span></span>
          ${e.lookupFailed ? `<button class="tag warn" data-act="editLot" data-id="${e.id}">Not found — tap to fix name</button>` : !c ? `<span class="tag muted">Looking up…</span>` : ""}
        </div>
        <div class="lot-side"><button class="price link" data-act="buyCard" data-name="${esc(e.name)}" data-lot="${esc(e.id)}" data-finish="${esc(e.finish||"nonfoil")}" aria-label="Price history and sellers for ${esc(e.name)}">${usd(unit === null ? null : unit * e.qty)}</button>${e.condition&&e.condition!=="Near Mint"?`<small class="condition-value-note">${esc(conditionValueNote(e,e.conditionQuotes||[]))}</small>`:""}
          <span class="stepper"><button data-act="qty" data-id="${e.id}" data-delta="-1" aria-label="Remove one">−</button><b>${e.qty}</b><button data-act="qty" data-id="${e.id}" data-delta="1" aria-label="Add one">＋</button></span>
          <button class="link small" data-act="editLot" data-id="${e.id}">Edit</button>
        </div>
      </div>`;
    })
    .join("")}</div>${selectionTray("mtg")}${total > list.length ? `<button class="btn ghost block" data-act="collMore">Show more (${total - list.length})</button>` : ""}`;
}

function collectionValueView() {
  const st = S.state,
    v = collectionValue(st.collection, S.catalog, st.printings, st.decks),
    hist = recordValuePoint(st.valueHistory || [], v.total, v.copies),
    colorNames = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", Multi: "Multicolor", Colorless: "Colorless" },
    maxColor = Math.max(1, ...Object.values(v.colors));
  if (!st.collection.length) return empty("No value to track yet", "Add cards and CardStashy records your collection value once a day so you can watch it change.");
  return `<section class="panel">
    <div class="row between"><div><p class="eyebrow">Your collection value</p><p class="big" data-count="${v.total.toFixed(2)}" data-money="1">${usd(v.total)}</p><p class="muted small">${v.copies} copies${v.unpriced ? ` · ${v.unpriced} without a price` : ""}</p></div><button class="btn ghost small" data-act="refreshPrices">↻ Refresh prices</button></div>
    ${lineChart(hist)}
  </section>
  <section class="panel"><h3>By color</h3>${Object.entries(v.colors)
    .filter(([, x]) => x > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, x]) => `<div class="meter"><span>${colorNames[k]}</span>${bar(x / maxColor, "c-" + k)}<b>${usd(x, 0)}</b></div>`)
    .join("")}</section>
  ${mtgTradeAdvice()}
  ${alertsPanel("mtg")}
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
  <div class="random-tools"><button class="btn ghost small" data-act="learnGame">How to play · keywords</button></div>
  ${segmented("decksTab", tab, [["mine", "My decks"], ["ideas", "Ideas"], ["inspiration", "Meta decks"]])}<div class="random-tools"><button class="btn ghost small" data-act="randomDeck" aria-label="Random Commander deck">🎲 Random Commander</button><button class="btn ghost small" data-act="randomDeckOptions" aria-label="Random deck in any format">🎲 Random deck</button></div>
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
  return `<section class="panel build-own"><h3>Build from my cards</h3><p class="muted small">Find commanders and strategies your collection supports, then explore complete plans at your budget.</p>
  <div class="toolbar"><button class="btn" data-act="analyze" ${I.busy ? "disabled" : ""}>${I.busy ? "Analyzing…" : I.cache.length ? "↻ Re-analyze" : "Analyze my collection"}</button><label class="check"><input type="checkbox" data-change="ideasOwned" ${I.ownedOnly ? "checked" : ""}> Owned commanders only</label>${plans.length > 1 ? `<select data-change="ideaFilter" aria-label="Strategy">${options([["all", "All strategies"], ...plans.map((p) => [p, p])], I.filter)}</select>` : ""}</div></section>
  ${I.busy ? buildOverlay(I.msg, { title: "Reading your collection", note: "Checking which commanders and strategies your cards already support. Large collections can take a minute.", id: "ideasMsg" }) : I.msg ? `<p class="muted small" role="status">${esc(I.msg)}</p>` : ""}
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
          ? empty("Ideas come from your cards", "Add your collection and CardStashy finds the commanders and strategies it already supports. No collection yet? Try the example, or browse decks you can almost build.", `<button class="btn" data-act="importCollection">↥ Import collection</button><button class="btn ghost" data-act="loadExample">Try example collection</button><button class="btn ghost" data-act="go" data-to="#decks/inspiration">✧ Explore starter decks</button>`)
          : empty("Find what your cards want to be", "Analysis loads card data for your whole collection in a few batched requests, then tries every legendary creature you own as a commander.")
  }`;
}

// Recent tournament results through the site's Worker: Magic Online (constructed), EDHTop16 (Commander),
// TopDeck.gg when a key is set. Matched against your cards.
const scryArt = (name) => (name ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=art_crop` : "");
const SOURCE_CREDIT = {
  "Magic Online (official decklists)": `Decklists from <a href="https://www.mtgo.com/decklists" target="_blank" rel="noopener">Magic Online</a> (Wizards of the Coast).`,
  "EDHTop16 (competitive Commander)": `Data from <a href="https://edhtop16.com" target="_blank" rel="noopener">EDHTop16</a>, powered by <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a>.`,
  "TopDeck.gg": `Data provided by <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a>.`,
};
function tournamentPanel() {
  const fmt = S.ui.mtgMeta?.format || "Modern",
    M = metaState("mtg:" + fmt),
    data = M.data,
    edh = fmt === "EDH",
    label = (MTG_META_FORMATS.find((f) => f[0] === fmt) || [fmt, fmt])[1],
    chips = `<div class="fmt-chips">${MTG_META_FORMATS.map(([id, name]) => `<button class="chip pick ${id === fmt ? "on" : ""}" data-act="mtgMetaFormat" data-id="${esc(id)}">${esc(name)}</button>`).join("")}</div>`;
  let body;
  if (!data && M.busy) body = `<p class="muted small">Loading recent ${esc(label)} results…</p>`;
  else if (!data && M.error) body = `<div class="note warn">${esc(M.error)} <button class="link" data-act="mtgMetaReload">Try again</button></div>`;
  else if (!data) body = `<p class="muted small">Loading…</p>`;
  else {
    const c = data.coverage || {},
      decks = data.decks.slice(0, 30),
      when = new Date(data.fetchedAt || M.at).toLocaleDateString([], { month: "short", day: "numeric" });
    const counts =
      c.challenges !== undefined
        ? `${c.challenges} Challenge${c.challenges === 1 ? "" : "s"} (${c.players.toLocaleString()} entries, ${c.challengeLists} ranked lists published)${c.leagues ? ` + ${c.leagueLists} League 5-0 lists from ${c.leagues} League${c.leagues === 1 ? "" : "s"} (field size not published)` : ""}`
        : `${c.events} event${c.events === 1 ? "" : "s"}${c.players ? ` · ${c.players.toLocaleString()} entries` : ""} · ${data.decks.length} published list${data.decks.length === 1 ? "" : "s"}`;
    body = `<p class="evidence small">Tournament-backed · ${esc(label)} · ${edh ? "last month" : `last ${data.days} days`} · ${counts} · ${esc(data.source)} · updated ${esc(when)}${data.stale ? " · <span class=\"warn-text\">showing the last good data</span>" : ""}<br>${esc(data.shareNote || "Shares are of the published lists shown here — not overall popularity or win rate.")}${data.labelNote ? " " + esc(data.labelNote) : ""}</p>
      ${
        data.decks.length || data.archetypes.length
          ? `<div class="section-head"><h2>${edh ? "Top commanders" : "Top decks right now"}</h2><button class="link small" data-act="mtgMetaReload">⟳ Refresh</button></div><div class="arch-grid">${data.archetypes
              .slice(0, 8)
              .map((a) => {
                const art = a.art || scryArt(a.cover);
                return `<button class="arch ${art ? "has-art" : ""}" data-act="mtgProven" data-key="${esc(a.best)}" ${a.best ? "" : "disabled"}>${art ? `<img class="arch-art" src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span class="arch-icons"></span><b class="clamp2">${esc(a.name)}</b><small>${edh ? `${(a.share * 100).toFixed(1)}% of entries · ${a.conversion !== null ? Math.round(a.conversion * 100) + "% top-cut rate" : ""}` : `${a.lists} list${a.lists === 1 ? "" : "s"} · ${Math.round(a.share * 100)}%`}</small>${bar(a.share / (data.archetypes[0]?.share || 1))}</button>`;
              })
              .join("")}</div>
      <div class="section-head"><h2>Recent top lists</h2></div><div class="list">${decks
        .map((d) => {
          const names = [...d.commanders, ...d.main],
            total = names.reduce((a, r) => a + r.qty, 0),
            have = names.reduce((a, r) => a + Math.min(r.qty, inv(r.name).owned), 0),
            cost = names.reduce((a, r) => a + Math.max(0, r.qty - inv(r.name).owned) * (Number(meta(r.name)?.prices?.usd) || 0), 0),
            priced = names.every((r) => meta(r.name) || r.land),
            cover = d.art || scryArt(d.cover);
          return `<button class="meta-row" data-act="mtgProven" data-key="${esc(d.key)}"><span class="meta-art">${cover ? `<img class="mini-art" src="${esc(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span><span class="meta-main"><b class="ellip">${esc(d.name)}</b><small class="muted ellip">${esc(d.place)} · ${esc(d.event)}${d.players ? ` · ${d.players} players` : ""}${d.record ? " · " + esc(d.record) : ""}</small><span class="meta-own">${bar(total ? have / total : 0)}<small>${total ? Math.round((have / total) * 100) : 0}% owned${priced && have < total ? ` · ${usd(cost, 0)} to finish` : ""}</small></span></span></button>`;
        })
        .join("")}</div>`
          : `<p class="muted small">No ${esc(label)} events with published lists recently. Try another format.</p>`
      }
      <p class="foot">${SOURCE_CREDIT[data.source] || ""}</p>`;
  }
  return `<section class="panel"><h3>Tournament results</h3><p class="muted small">Recent tournament lists, matched against your cards. Open one for the original, a budget version, or a draft from your cards.</p>${chips}${body}</section>`;
}

function inspirationView() {
  const st = S.state,
    q = S.ui.q.ref.toLowerCase(),
    refs = (st.references || []).filter((d) => [d.name, d.commander, d.source?.author, d.source?.website].some((v) => (v || "").toLowerCase().includes(q)));
  return `${tournamentPanel()}${finderPanel()}
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
  <p class="muted small">Decks ranked by what it costs to finish them from your collection.${noCards ? " <b>Add your collection first</b>, until then every card counts as missing." : ""}</p>
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
        ${sc.skipped ? `<small class="warn-text">Assumes you have ${sc.skipped} basic lands — not counted from your collection</small>` : ""}
        ${sc.missing ? `<details><summary class="small">Missing cards${top ? ` · priciest: ${top}` : ""}</summary><div class="list compact">${sc.need.map((n) => `<button class="mini-row" data-act="card" data-name="${esc(n.name)}"><span class="ellip">${n.qty > 1 ? n.qty + "× " : ""}${esc(n.name)}</span><span class="small">${n.price === null ? "Unknown" : usd(n.price * n.qty)}</span></button>`).join("")}</div></details>` : `<p class="small ok-text">You own every card.</p>`}
        <div class="actions wrap"><button class="btn small" data-act="finderBuild" data-kind="${x.kind}" data-id="${esc(x.id)}">Make my version</button>${x.kind === "precon" ? `<button class="btn ghost small" data-act="finderSave" data-id="${esc(x.id)}">Save</button>` : ""}</div>
      </div></article>`;
    })
    .join("")}</div>
  ${list.length > F.limit ? `<button class="btn ghost block" data-act="finderMore">Show more</button>` : ""}
  ${all.length && !list.length ? `<p class="muted small">No decks match — raise the price limit or clear the filters.</p>` : ""}
  <p class="foot">Prices are Scryfall estimates. Making your own copy doesn't change your collection.</p></section>`;
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
      <div class="hero-stats"><span><b class="${(fm.exact ? sumQty(d.cards) === target : sumQty(d.cards) >= target) ? "" : "warn-text"}">${sumQty(d.cards)}/${target}</b>cards</span><span><b>${shownPower(mtgPower(d))}</b>power</span>${br ? `<span><b>${br.bracket}</b>bracket est.</span>` : ""}<span><b>${d.budget !== null ? usd(d.budget, 0) : "—"}</b>budget</span></div>
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
    </ul><p class="foot">Calculated by CardStashy from the list and card text — simulations and estimates, not win rates.</p></section>
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
    tabs = [["cards", "Cards"], ["engine", "Power"], ["matchups", "Matchups"], ["upgrade", "Upgrade lab"], ["versions", "Versions"], ["playtest", "Playtest"], ["shop", t.missing ? `Shop · ${t.missing}` : "Shop"]];
  return `<section class="deck-hero">${img(coverOf(d), d.name, "hero-art")}<div class="hero-shade"></div>
    <div class="hero-body">
      <div class="row between"><button class="icon light" data-act="go" data-to="#decks" aria-label="Back to decks">←</button><button class="icon light" data-act="deckMenu" aria-label="Deck options">⋯</button></div>
      <h1>${esc(d.name)}</h1>
      <p>${fm.commander ? colorDots(meta(d.commander)) + " " + esc(d.commander || "No commander yet") + " · " : ""}<button class="chip dark fmt-chip" data-act="deckMenu" title="${esc(sizeLabel(fm))}${fm.note ? " · " + esc(fm.note) : ""}">${esc(fm.name)}</button>${d.locked ? ' · <span class="chip dark">Assembled</span>' : ""}</p>
      ${reviewBadge(d)}
      <div class="hero-stats">
        <span><b class="${(fm.exact ? t.copies === target : t.copies >= target) ? "" : "warn-text"}">${t.copies}/${target}</b>cards</span>
        <span><b>${t.copies ? Math.round((t.covered / t.copies) * 100) : 0}%</b>owned</span>
        <span><b>${usd(t.pricedGap, 0)}${t.unpriced ? "+" : ""}</b>to finish${t.unpriced ? " · some unpriced" : ""}</span>
        <button data-act="deckTab" data-id="engine"><b>${shownPower(mtgPower(d))}</b>power</button>
      </div>
    </div>
  </section>
  <nav class="tabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? "on" : ""}" data-act="deckTab" data-id="${id}">${l}</button>`).join("")}</nav>
  ${fm.commander && !canLead(meta(d.commander), fm) && tab !== "upgrade" ? `<button class="note warn block-note" data-act="deckTab" data-id="upgrade">⚠ No ${fm.commander === "planeswalker" ? "Oathbreaker" : "commander"} set — tap to choose one so colors and synergy are checked.</button>` : ""}
  <div class="deck-body" data-tab="${tab}">${{ cards: deckCards, engine: deckEngine, matchups: deckMatchups, upgrade: deckUpgrade, versions: deckVersions, playtest: deckPlaytest, shop: deckShop }[tab](d, t)}</div>`;
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
  <p class="foot">Refresh before an event. Guidelines are rules of thumb, not requirements.</p>`;
}

const CATS = ["Commander", "Creatures", "Planeswalkers", "Artifacts", "Enchantments", "Instants", "Sorceries", "Battles", "Lands", "Unresolved"];

// Meta / staple tally for the deck, and owned staples that could replace no-emblem cards.
function mtgDeckEmblems(d) {
  const f = formatOf(d),
    cmd = hasCommander(d) && d.commander ? meta(d.commander) : null,
    ident = new Set(cmd?.color_identity || []),
    rows = aggregateCards(d.cards).map((c) => ({ key: key(c.name), name: c.name, card: meta(c.name), qty: c.qty })),
    inDeck = new Set(rows.map((r) => r.key)),
    seen = new Set(),
    spares = [];
  for (const e of S.state.collection) {
    const k = key(e.name);
    if (inDeck.has(k) || seen.has(k)) continue;
    seen.add(k);
    spares.push({ key: k, name: e.name, card: meta(e.name), spare: inv(e.name).available });
  }
  const isCreature = (c) => /Creature/.test(typeText(c) || "");
  const res = deckEmblems("mtg", rows, spares, {
    fits: (c) => (!f.legality || legalityIn(c, f) === "legal") && (!cmd || (c.color_identity || []).every((x) => ident.has(x))) && !isLand(c),
    sameSlot: (a, b) => isCreature(a) === isCreature(b),
    protect: (r) => isLand(r.card) || (cmd && key(r.name) === key(d.commander)),
  });
  return deckEmblemHtml("mtg", res, {
    cardAttrs: (x) => `data-act="card" data-name="${esc(x.name)}"`,
    swapAttrs: (s) => `data-act="deckEmbSwap" data-out="${esc(s.out.name)}" data-in="${esc(s.in.name)}"`,
  });
}

function deckCards(d, t) {
  const target = formatOf(d).size;
  return `${viewControl("mtg","deck")}<div class="add-row"><input id="deckAddName" placeholder="Add a card by name" data-enter="deckAdd" aria-label="Card name to add" autocomplete="off"><button class="btn" data-act="deckAdd">Add</button></div>
  <div class="cover-line"><span><b>${t.covered}</b>/${t.copies} owned${t.missing ? ` · <b>${t.missing}</b> missing · <b>${usd(t.pricedGap)}</b>${t.unpriced ? "+" : ""} to finish` : " · everything owned ✓"}</span>${t.copies < target ? (d.format === "Commander" ? `<button class="link" data-act="deckTab" data-id="upgrade">Fill ${target - t.copies} slots →</button>` : `<button class="link" data-act="formatSearch">Find ${esc(formatOf(d).name)} cards →</button>`) : ""}</div>
  ${bar(t.copies ? t.covered / t.copies : 0)}
  <div class="toolbar"><input type="search" value="${esc(S.ui.q.deck)}" placeholder="Search this deck" data-input="deckSearch" aria-label="Search deck"><select data-change="deckFilter" aria-label="Show">${options([["all", "All"], ["missing", "Missing"], ["owned", "Owned"], ["unresolved", "Unresolved"]], S.ui.deckFilter)}</select><select data-change="deckSort" aria-label="Group by">${options([["type", "By type"], ["mv", "By mana value"], ["role", "By role"], ["price", "By price"]], S.ui.deckSort)}</select></div>
  ${mtgDeckEmblems(d)}
  <div id="deckList">${deckList(d)}</div>
  ${mtgSideboard(d)}
  ${t.missing ? `<div class="sticky-bar"><span><b>${t.missing}</b> to get · ${usd(t.pricedGap, 0)}</span><span><button class="btn ghost small" data-act="deckTab" data-id="shop">Shop</button><button class="btn small" data-act="acquire">I got cards</button></span></div>` : ""}`;
}

// Matchups: this deck against the decks winning in its format, then the games you log.
export const mtgFieldKey = (d) => { const mk = mtgMetaKey(d); return mk ? mk + "|" + (metaState(mk)?.at || 0) : null; };
function deckMatchups(d) {
  const fm = formatOf(d), mk = mtgMetaKey(d),
    st = ((S.ui.mu ||= {})[d.id] ||= { first: true }),
    base = { prefix: "mu", gameName: "Magic", state: st, modelNote: "both decks' played-out clocks race, slowed by the removal and counters each side draws", runKey: "mtg:" + d.id,
      footNote: "Tested on 4,045 real Magic Online Top 8 matches, neither the game simulation nor archetype records predicted winners better than a coin flip, so each matchup shows as about even until you log your own games, which count for more as you add them. The sideboard plans and the reasons under each deck are the useful part: they come from both lists." };
  const blocked = matchupBlock(mtgPower(d));
  if (blocked) return matchupsTab({ ...base, unsupported: blocked });
  if (isCommanderLike(d)) return commanderPods(d, fm, mk, st, base);
  if (!mk) return matchupsTab({ ...base, unsupported: `There are no tournament results for ${fm.name} in the data. Matchups work for Standard, Pioneer, Modern, Legacy, Vintage, Pauper and Premodern.` });
  if (sumQty(d.cards) < fm.size) return matchupsTab({ ...base, unsupported: `Finish the deck first: matchups compare complete ${fm.size}-card lists (this one has ${sumQty(d.cards)}).` });
  const fkey = mtgFieldKey(d);
  if (!st.field || st.fieldKey !== fkey) { const cached = metaState(mk)?.data ? fieldStore.get(fkey) : null; if (cached) { st.field = cached; st.fieldKey = fkey; } }
  if (!st.field?.length || st.fieldKey !== fkey) return matchupsTab({ ...base, field: [], fieldLabel: `in ${fm.name}` });
  const rows = d.cards.map((r) => ({ qty: r.qty, c: meta(r.name) })).filter((r) => r.c),
    side = (d.side || []).map((r) => ({ qty: r.qty, c: meta(r.name), name: r.name })),
    me = profileOf("mtg", mtgPower(d), rows),
    reprofile = (rs) => profileOf("mtg", mtgConstructedPower({ cards: rs.map((r) => ({ name: r.c.name, qty: r.qty })) }, S.catalog, key, fm.size), rs);
  if (!me) return matchupsTab({ ...base, unsupported: "This deck's cards are still loading. Open the Power tab once, then come back." });
  const sims = computeMatchups(fkey + "|" + JSON.stringify([d.cards, d.side || []]), st.field, me, (op, win) => gamePlan("mtg", me, op, { main: rows, side, reprofile, sim: win }), (a, b) => simulateMatchup("mtg", a, b), mtgBias(mtgPower(d), st.field)).map((m) => ({ ...m, sim: trustedSim("mtg", m.sim) })),
    results = d.results || [];
  return matchupsTab({ ...base, ...fieldSummary(sims, results, st, mtgListSig(d)) });
}
// Commander: four-player pods against the decks winning Commander tournaments (cEDH). Your deck
// and three of them, seats shuffled; an even share is 25%. Speed comes from each list's bracket
// and speed cards (podSpeed), so a precon isn't treated like a tournament deck.
const podMemo = new Map();
function commanderPods(d, fm, mk, st, base) {
  const pod = { ...base, pod: true, modelNote: "each deck's kill turn from its bracket, fast mana and tutors, the table aiming its answers at whoever is ahead", fieldLabel: "in Commander tournaments (cEDH)" };
  if (!mk) return matchupsTab({ ...pod, unsupported: "Commander tournament results aren't loaded yet." });
  if (sumQty(d.cards) < fm.size) return matchupsTab({ ...pod, unsupported: `Finish the deck first: pods compare complete ${fm.size}-card decks (this one has ${sumQty(d.cards)}).` });
  const fkey = mtgFieldKey(d);
  if (!st.field || st.fieldKey !== fkey) { const cached = metaState(mk)?.data ? fieldStore.get(fkey) : null; if (cached?.every((f) => f.shift != null)) { st.field = cached; st.fieldKey = fkey; } }
  if (!st.field?.length || st.fieldKey !== fkey) return matchupsTab({ ...pod, field: [] });
  const rows = d.cards.map((r) => ({ qty: r.qty, c: meta(r.name) })).filter((r) => r.c), p = mtgPower(d),
    // The same 100-card goldfish and counts the field's decks are measured with.
    cp = mtgConstructedPower(d, S.catalog, key, fm.size),
    me = podProfile(profileOf("mtg", { ...p, goldfish: cp.goldfish, stats: cp.stats }, rows), podSpeed(d, S.catalog));
  if (!me) return matchupsTab({ ...pod, unsupported: "This deck's cards are still loading. Open the Power tab once, then come back." });
  // A copy of a field archetype keeps that archetype's calibration.
  const twin = p.match?.sim >= 0.6 ? st.field.find((f) => String(f.name).toLowerCase() === String(p.match.archetype).toLowerCase()) : null;
  const sig = fkey + "|" + JSON.stringify(d.cards) + "|" + (twin?.shift ?? 0);
  if (!podMemo.has(sig)) podMemo.set(sig, simulatePod(me, st.field, { shift: twin?.shift ?? 0 }));
  const res = podMemo.get(sig);
  if (!res) return matchupsTab({ ...pod, unsupported: "Couldn't simulate pods for this deck." });
  const sims = st.field.map((f) => ({ ...f, sim: { win: res.per.get(f) ?? res.win, onPlay: res.seats[0], onDraw: res.seats[3], reasons: res.reasons }, plan: null }));
  return matchupsTab({ ...pod, ...fieldSummary(sims, d.results || [], st, mtgListSig(d)), podWin: res.win, seats: res.seats, speed: me.speed });
}
// The calibration of the field archetype this deck copies (see calibrateField), else 0.
const mtgBias = (p, field) => { const m = p?.match; if (!canBorrowResults(p)) return 0; const f = (field || []).find((x) => String(x.name).toLowerCase() === String(m.archetype).toLowerCase()); return f?.bias || 0; };
export const mtgListSig = (d) => listSig({ main: d.cards, side: d.side || [] });
// Only games played with this exact list feed the numbers; earlier lists stay in the history.
export function fieldSummary(sims, results, st, sig) {
  const { current, earlier } = forList(results, sig),
    field = sims.map((m) => { const rec = recordOf(current, m.name); return { ...m, rec, shown: blend(m.sim.win, rec), open: st.openName === m.name }; }),
    tot = field.reduce((a, m) => a + (m.share || 0), 0) || 1;
  return { field, sig, earlier: earlier.length, fieldWin: field.reduce((a, m) => a + m.shown * (m.share || 0), 0) / tot, record: recordOf(current), history: [...results].sort((a, b) => String(b.at).localeCompare(String(a.at))) };
}

// The sideboard: up to 15 cards swapped in between games. Not part of the main-deck count,
// Deck Power or the shopping total above; its own cost is shown here.
function mtgSideboard(d) {
  const side = (d.side || []).filter((r) => r.qty > 0);
  if (!side.length) return "";
  const n = sumQty(side),
    rows = side.map((r) => { const c = meta(r.name), own = Math.min(r.qty, inv(r.name).owned || 0), price = c ? Number(c.prices?.usd ?? c.prices?.usd_foil) || 0 : 0; return { ...r, c, own, cost: (r.qty - own) * price }; }),
    cost = rows.reduce((a, r) => a + r.cost, 0),
    need = rows.reduce((a, r) => a + r.qty - r.own, 0),
    unpriced = rows.filter((r) => r.qty > r.own && !(r.cost > 0)).reduce((a, r) => a + r.qty - r.own, 0),
    // Unpriced isn't owned: say what's missing even when it has no price yet.
    status = !need ? "all owned ✓" : `${need} to get${cost ? " · " + usd(cost, 0) : ""}${unpriced ? ` · ${unpriced} unpriced` : ""}`;
  return `<details class="group side-group" open><summary><span>Sideboard <em>${n}</em>${n > 15 ? ` <span class="warn-text small">· over 15</span>` : ""}</span><span class="muted small">${status}</span></summary>
    <p class="small muted">Swapped in between games. Not counted in the ${esc(String(formatOf(d).size))}-card deck${n > 15 ? "; tournament sideboards are at most 15 cards" : ""}.</p>
    <div class="list compact">${rows.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)).map((r) => `<button class="mini-row art-row" data-act="card" data-name="${esc(r.name)}">${img(art(r.c), r.name, "mini-art")}<span class="ellip">${r.qty}× ${esc(r.name)}</span><span class="small ${r.own >= r.qty ? "ok-text" : "warn-text"}">${r.own >= r.qty ? "✓ Owned" : `Need ${r.qty - r.own}`}</span></button>`).join("")}</div></details>`;
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
      return `<details class="group" open><summary><span>${esc(g)} <em>${sumQty(list)}</em></span><span class="muted small">${usd(val)}</span></summary><div class="list display-list">${list.map((r) => deckRow(r,d)).join("")}</div></details>`;
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
    ok = r.missing === 0,
    t = tierOf("mtg", c?.rarity, r.price ?? c?.prices?.usd ?? c?.prices?.usd_foil);
  return `<div class="lot deck-row ${ok ? "" : "short"}" data-tier="${t.key}" style="${tierStyle(t)}">
    <button class="lot-art" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${img(cardImage(c), r.name)}${c ? tileChrome("mtg", c) : ""}<span class="art-price">${usd(r.price)}</span></button>
    <div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${esc(r.name)} ${setBadge(c)}</button>
      <span class="lot-sub">${manaCost(c) || (c ? "" : '<span class="tag warn">Unresolved</span>')}${legalTag(c, d)}</span>
      <span class="own ${ok ? "yes" : "no"}">${ok ? "Owned" : r.covered ? `${r.covered}/${r.qty} owned · need ${r.missing}` : "Need " + r.missing}${r.reserved ? ` · ${r.reserved} in other decks` : ""}</span>
    </div>
    <div class="lot-side">${r.category === "Commander" ? `<span class="chip">Commander</span>` : `<span class="stepper"><button data-act="deckQty" data-name="${esc(r.name)}" data-delta="-1" aria-label="One fewer ${esc(r.name)}">−</button><b>${r.qty}</b><button data-act="deckQty" data-name="${esc(r.name)}" data-delta="1" aria-label="One more ${esc(r.name)}">＋</button></span>`}</div>
  </div>`;
}

function deckGridCard(r) {
  const c = meta(r.name);
  return `<button class="grid-card ${r.missing ? "short" : ""}" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(currentDeck().id)}">${img(cardImage(c), r.name, "card-img")}${c ? tileChrome("mtg", c) : ""}<span class="grid-set">${setBadge(c)}</span><span class="grid-meta"><span>${r.qty > 1 ? r.qty + "× " : ""}${r.missing ? "need " + r.missing : "owned"}</span><span>${usd(r.price)}</span></span></button>`;
}

/* Engine */

// Card by card: exact odds to see each card, with its job in the deck (same table as Pokémon and
// Yu-Gi-Oh!, Magic's own draws: opening 7, and 9 cards by turn 3 on the draw).
function mtgCardByCard(d, pw) {
  const rows = aggregateCards(d.cards).filter((r) => !/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(r.name)),
    N = sumQty(d.cards) - (formatOf(d).commander && d.commander ? 1 : 0);
  if (!rows.length || !N) return "";
  const pct = (x) => Math.round(x * 100) + "%",
    chips = (name) => (pw.roles?.get(key(name)) || []).map((r) => `<span class="role-chip">${esc(r)}</span>`).join("");
  return `<section class="panel"><h3>Card by card</h3><p class="muted small">Chance to see at least one copy (exact odds): in your opening 7, and by turn 3 on the draw (9 cards). Labels show each card's job in the deck.</p>
    <table class="metrics"><thead><tr><th>Card</th><th class="num">Qty</th><th class="num" title="Opening hand of 7">In 7</th><th class="num" title="By turn 3 on the draw: 9 cards">By T3</th></tr></thead><tbody>${rows
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
      .map((r) => `<tr><td><button class="link odds-name" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${esc(r.name)}</button><span class="role-chips">${chips(r.name)}</span></td><td class="num">${r.qty}</td><td class="num">${pct(atLeastOne(N, r.qty, 7))}</td><td class="num">${pct(atLeastOne(N, r.qty, 9))}</td></tr>`)
      .join("")}</tbody></table></section>`;
}
function mtgMostValuable(d) {
  const top = aggregateCards(d.cards).map((r) => ({ ...r, p: priceOf(r.name) })).filter((r) => r.p).sort((a, b) => b.p * b.qty - a.p * a.qty).slice(0, 5);
  if (!top.length) return "";
  return `<section class="panel"><h3>Most valuable cards</h3><div class="list compact">${top.map((r) => `<button class="mini-row" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}"><span class="ellip">${r.qty}× ${esc(r.name)}</span><span class="small">${usd(r.p * r.qty)}</span></button>`).join("")}</div></section>`;
}

// AI coach hooks: owned cards that could join this deck, and the app's own re-score of a swap.
export function mtgCoachHooks(d, pw) {
  return {
    candidates: () => {
      const f = formatOf(d), inDeck = new Set(d.cards.map((r) => key(r.name))), ident = isCommanderLike(d) || f.commander ? meta(d.commander)?.color_identity : null;
      const owned = [...new Set(S.state.collection.map((e) => e.name))].map(meta).filter((c) => c && !inDeck.has(key(c.name)) && !isBasic(c) && (!f.legality || ["legal", "restricted"].includes(legalityIn(c, f))) && (!ident || (c.color_identity || []).every((x) => ident.includes(x))));
      const target = meta(d.commander) || aggregateCards(d.cards).map((r) => meta(r.name)).filter((c) => c && !isLand(c)).sort((a, b) => (d.cards.find((r) => r.name === b.name)?.qty || 0) - (d.cards.find((r) => r.name === a.name)?.qty || 0))[0];
      const ranked = target ? rankPairs("mtg", target, owned.map((card) => ({ card, owned: true })), { max: 30 }).map((x) => x.card) : [];
      // Lands and role cards for Power's weak areas join the pool; Power itself then probes them.
      const roles = engineRoles, weak = new Set((pw.parts || []).filter((x) => x.ratio < 0.9).map((x) => x.key));
      const fits = owned.filter((c) => ((weak.has("Lands") || weak.has("Mana")) && isLand(c)) || roles(c).some((r) => weak.has(r)));
      // Only cards the deck can legally play: the same deck check Power uses, card by card.
      const had = new Set(powerReadiness("mtg", d, f, meta).issues), legal = (c) => !powerReadiness("mtg", { ...d, cards: [...d.cards, { name: c.name, qty: 1 }] }, f, meta).issues.some((i) => !had.has(i) && i.includes(c.name));
      return [...new Set([...fits.slice(0, 30), ...ranked, ...owned])].filter(legal).slice(0, 60);
    },
    probe: (card) => mtgPower({ ...d, id: d.id + "~probe", cards: [...d.cards, { name: card.name, qty: 1 }] }).parts,
    // The decks this list would face: the top archetypes in the app's tournament data, each with
    // its most-played cards across that archetype's placing lists.
    field: () => {
      const mk = mtgMetaKey(d), data = mk ? metaState(mk).data : null;
      return (data?.archetypes || []).filter((a) => a.share > 0).slice(0, 8).map((a) => {
        const lists = (data.decks || []).filter((x) => (x.archetype || x.name) === a.name), by = new Map();
        for (const l of lists) for (const r of [...(l.main || []), ...(l.commanders || []).map((x) => (typeof x === "string" ? { name: x, qty: 1 } : x))]) if (!/^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$/i.test(r.name)) by.set(r.name, (by.get(r.name) || 0) + r.qty);
        return { name: a.name, share: a.share, lists: lists.length, rows: [...by].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([name, n]) => ({ name, qty: Math.max(1, Math.round(n / Math.max(1, lists.length))), c: meta(name) })) };
      }).filter((f) => f.rows.length).slice(0, 5);
    },
    rescore: (out, add) => {
      if (out.zone !== "main") throw Error("main deck only");
      const p2 = mtgPower({ ...d, id: d.id + "~coach", cards: applySwapsToCards(d.cards, [{ cut: out.row.name, add: add.name }]) });
      return { before: shownPower(pw), after: shownPower(p2), beforeIssues: pw.readiness?.issues, issues: p2.readiness?.issues, beforeParts: pw.parts, afterParts: p2.parts };
    },
  };
}

function deckEngine(d) {
  const p = engineProfile(d, S.catalog),
    v = validateDeck(d, S.catalog, S.state.collection, S.state.decks),
    issues = v.issues.filter((i) => i.kind !== "count"),
    colorTotal = Object.values(p.pips).reduce((a, b) => a + b, 0),
    srcTotal = Object.values(p.sources).reduce((a, b) => a + b, 0),
    colors = Object.keys(p.pips).filter((k) => p.pips[k] > 0 || p.sources[k] > 0);
  const pw = mtgPower(d);
  return `${aiReviewPanel("mtg", d, meta, pw, mtgCoachHooks(d, pw))}${powerPanel(pw, { loadAct: pw.metaKey ? `data-act="deckMetaLoad" data-key="${esc(pw.metaKey)}"` : "", findAct: (x) => `data-act="findRole" data-role="${esc(x.fix)}"`, cardAct: (x) => `data-act="card" data-name="${esc(x.name)}"` })}
  ${p.unknown ? `<div class="note warn">${p.unknown} cards have no card data yet, so they aren’t counted. <button class="link" data-act="refreshDeck">Load card data</button></div>` : ""}
  ${d.format === "Commander" ? bracketPanel(d) : ""}  <section class="panel"><div class="row between"><h3>Mana curve</h3><span class="muted small">avg ${p.avg === null ? "—" : p.avg.toFixed(2)} · ${p.counts.Lands} lands</span></div>${curveChart(p.curve)}</section>
  ${
    colors.length
      ? `<section class="panel"><h3>Color balance</h3><p class="muted small">Share of colored mana symbols in your spells vs. share of lands that make that color.</p>${colors
          .map((k) => `<div class="meter two"><span>${sym(k)}</span><span class="pair">${bar(colorTotal ? p.pips[k] / colorTotal : 0, "c-" + k)}${bar(srcTotal ? p.sources[k] / srcTotal : 0, "c-" + k + " faint")}</span><b class="small">${pct(colorTotal ? p.pips[k] / colorTotal : 0)} need · ${pct(srcTotal ? p.sources[k] / srcTotal : 0)} make</b></div>`)
          .join("")}</section>`
      : ""
  }
  ${manaBasePanel(d, p)}
  ${mtgCardByCard(d, pw)}
  ${mtgMostValuable(d)}
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
  <details><summary class="small"><b>What CardStashy counted</b></summary>
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
  return `<section class="panel pick-commander"><p class="eyebrow">One quick step</p><h2>Which card is your commander?</h2><p class="muted small">This deck doesn’t have a commander set, so CardStashy can’t tell your colors. Tap it below.</p>
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
  return `<section class="panel"><p class="eyebrow">Step 1</p><h2>Fill ${open} open slots</h2><p class="muted small">Keeps your picks and fills what the deck is short on, cards you own first. Budget covers what you'd buy.</p>
  <div class="chips">${[0, 10, 25, 50, 100].map((n) => `<button class="chip pick ${F.budget === n ? "on" : ""}" data-act="fillBudget" data-v="${n}">${n ? "$" + n : "Owned only"}</button>`).join("")}</div>
  <label class="custom-budget">Custom purchase budget ($)<input type="number" min="0" max="100000" step="0.01" value="${F.budget}" data-change="fillCustom" aria-label="Custom slot-filling budget"></label>
  <div class="grid2"><label>Target lands<input type="number" min="30" max="42" value="${F.lands}" data-change="fill" data-field="lands"></label><label class="check"><input type="checkbox" data-change="fill" data-field="simple" ${F.simple ? "checked" : ""}> Prefer simpler cards</label></div>
  <button class="btn block" data-act="fillRun" ${F.busy ? "disabled" : ""}>${F.busy ? "Working…" : "Recommend cards"}</button>
  ${F.busy ? buildOverlay(F.msg, { title: "Finding cards for your deck", note: "Searching ramp, draw, removal, lands and budget picks in your colors, then filling the open slots. This can take up to a minute.", id: "fillMsg" }) : `<p class="muted small" role="status" id="fillMsg">${esc(F.msg)}</p>`}
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
    trade !== null ? `<div class="imp" title="For reference only — not subtracted from what you spend"><small>Cut cards’ value (ref.)</small><b>${usd(trade)}</b></div>` : "",
  ].join("");
}

function swapPanel(d) {
  const U = S.ui.upgrade,
    plans = U.deckId === d.id ? U.plans : {},
    plan = plans[U.budget];
  return `<section class="panel"><p class="eyebrow">${sumQty(d.cards) < 100 ? "Step 2" : "Upgrade lab"}</p><h2>One-for-one upgrades</h2><button class="btn" data-act="optimizeMtgDeck">Compare budget builds</button><p class="muted small">Pick a budget to see suggested swaps, what each one changes, and what it costs.</p>
  <div class="chips">${[0, 10, 25, 50, 100].map((n) => `<button class="chip pick ${U.budget === n ? "on" : ""}" data-act="upBudget" data-v="${n}">${n ? "$" + n : "My cards ($0)"}</button>`).join("")}</div>
  <label class="custom-budget">Custom upgrade budget ($)<input type="number" min="0" max="100000" step="0.01" value="${U.budget}" data-change="upCustom" aria-label="Custom upgrade budget"></label>
  <label class="check small"><input type="checkbox" data-change="upTrade" ${U.tradeIn ? "checked" : ""}> Show what the cut cards are worth (reference only — never subtracted from what you spend)</label>
  <div class="row between"><label class="check"><input type="checkbox" data-change="upSimple" ${U.simple ? "checked" : ""}> Prefer simpler cards</label><button class="btn" data-act="upRun" ${U.busy ? "disabled" : ""}>${U.busy ? "Working…" : Object.keys(plans).length ? "↻ Refresh" : "Find upgrades"}</button></div>
  ${U.busy ? buildOverlay(U.msg, { title: "Comparing upgrades", note: "Testing one-for-one swaps at each budget and keeping only the ones that make the deck stronger. This can take up to a minute.", id: "upMsg" }) : `<p class="muted small" role="status" id="upMsg">${esc(U.msg)}</p>`}
  ${Object.keys(plans).length ? budgetLadder(d, plans) : ""}
  </section>
  ${plan ? swapResults(d, plan) : ""}`;
}

function budgetLadder(d, plans) {
  const base = mtgPower(d).score;
  return `<table class="metrics ladder"><thead><tr><th>Budget</th><th class="num">Swaps</th><th class="num">Spend</th><th class="num">Power</th><th class="num">Per $</th></tr></thead><tbody>${Object.keys(plans).map(Number).sort((a,b)=>a-b)
    .filter((b) => plans[b])
    .map((b) => {
      const p = plans[b],
        after = p.powerAfter ?? mtgPower({ ...d, cards: applySwapsToCards(d.cards, p.swaps) }).score,
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
          <button class="swap-card out" data-act="card" data-name="${esc(s.cut)}">${img(art(cut), s.cut, "swap-art")}<small>OUT</small><b>${esc(s.cut)}</b><span class="swap-mana">${manaCost(cut)}</span>${showTrade ? `<span class="muted small">ref. value ${usd(imp.cutValue)}</span>` : ""}</button>
          <span class="swap-arrow" aria-hidden="true">→</span>
          <button class="swap-card in" data-act="card" data-name="${esc(s.add)}">${img(art(add), s.add, "swap-art")}<small>IN</small><b>${esc(s.add)}</b><span class="swap-mana">${manaCost(add)}</span><span class="small">${s.owned ? '<b class="ok-text">You own a free copy</b>' : `Buy for <b>${usd(s.cost)}</b>`}</span></button>
        </div>
        <ul class="swap-why">${why.lines.map((l) => `<li class="${l.kind}"><span aria-hidden="true">${sign[l.kind]}</span>${esc(l.text)}</li>`).join("")}</ul>
        <p class="swap-choose small">${esc(why.choose)}</p>
        <div class="swap-facts"><span>Power <b class="${(s.powerAfter-s.powerBefore) > 0 ? "up" : ""}">${s.powerBefore ?? base} → ${s.powerAfter ?? base + imp.delta}</b></span><span>${s.owned ? "Cost <b>$0</b>" : `Cost <b>${usd(s.cost)}</b>`}</span><span class="chip">${esc(s.complexity === "Straightforward" ? "Simple to play" : s.complexity)}</span></div>
      </article>`;
    })
    .join("")}</div>
  <div class="sticky-summary" id="upSummary">${upgradeSummary(d, plan)}</div>`;
}

export function upgradeSummary(d, plan) {
  const sel = [...S.ui.upgrade.selected].map((i) => plan.swaps[i]).filter(Boolean),
    before = {...engineProfile(d,S.catalog),score:mtgPower(d).score},
    after = {...engineProfile({ ...d, cards: applySwapsToCards(d.cards, sel) }, S.catalog),score:mtgPower({...d,cards:applySwapsToCards(d.cards,sel)}).score},
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
  <div class="actions wrap"><button class="btn" data-act="copyShopping" data-src="deck">${actionIcon("bag")}<span>Buy on TCGplayer</span></button><button class="btn ghost" data-act="exportMissing">↓ .txt</button><button class="btn ghost" data-act="acquire">I got cards</button><button class="btn ghost" data-act="proxies" data-scope="missing">🖨 Print proxies of missing</button></div>
  <p class="foot">Tap a card → Printings to price a specific edition. Reference prices from Scryfall; check the seller’s condition and shipping.</p></section>`;
}

/* ---------- Scan ---------- */

/* ---------- Settings ---------- */

/* ---------- Account ---------- */

const when = (iso) => (iso ? new Date(iso).toLocaleString() : "never");

export function signedOutAccount(a, mode = "login") {
  const selected = ["login","signup","reset"].includes(mode) ? mode : "login";
  return `<section class="panel account auth-card"><div class="settings-card-heading"><span class="settings-icon" aria-hidden="true">◈</span><div><p class="eyebrow">PRIVATE SYNC</p><h2>Your account</h2></div></div><p class="muted small">Keep your collection and decks with you across devices.</p>
  ${a.providers.google ? `<button class="btn ghost block" data-act="signGoogle">Continue with Google</button><div class="auth-divider"><span>or use email</span></div>` : ""}
  ${a.authNotice ? `<p class="note warn" role="alert">${esc(a.authNotice)}</p>` : ""}
  ${a.providers.email ? `<nav class="auth-tabs" role="tablist" aria-label="Account access">${[["login","Log in"],["signup","Create account"]].map(([id,label]) => `<button role="tab" id="authTab-${id}" aria-controls="auth-${id}" aria-selected="${selected === id}" data-act="authTab" data-mode="${id}">${label}</button>`).join("")}</nav>
  <div id="authFeedback" class="auth-feedback ${esc(S.ui.authFeedback?.tone || "error")}" role="alert" aria-live="polite" ${S.ui.authFeedback?.message ? "" : "hidden"}>${esc(S.ui.authFeedback?.message || "")}</div>
  <div id="auth-login" class="auth-pane" role="tabpanel" aria-labelledby="authTab-login" ${selected === "login" ? "" : "hidden"}>
    <form data-auth-action="signPassword">
    <label class="field">Email address<input id="signEmail" name="email" required type="email" autocomplete="username" placeholder="you@example.com" aria-label="Login email address"></label>
    <label class="field">Password<input id="signPassword" name="password" required type="password" autocomplete="current-password" placeholder="Your password"></label>
    <button class="btn block" type="submit">Log in</button></form>
    <button class="link auth-secondary" data-act="authTab" data-mode="reset">Forgot password?</button>
    <details class="settings-disclosure"><summary>Email me a link instead</summary><p class="foot">Use the login email above. Open the link in this browser.</p><button class="btn ghost block" data-act="signEmail">Send sign-in link</button></details>
  </div>
  <div id="auth-signup" class="auth-pane" role="tabpanel" aria-labelledby="authTab-signup" ${selected === "signup" ? "" : "hidden"}>
    <form data-auth-action="createAccount">
    <label class="field">Email address<input id="signupEmail" name="email" required type="email" autocomplete="email" placeholder="you@example.com" aria-label="Account email address"></label>
    <label class="field">Password<input id="signupPassword" name="password" required type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters"></label>
    <label class="field">Confirm password<input id="signupConfirm" name="password_confirmation" required type="password" autocomplete="new-password" placeholder="Enter it again"></label>
    <button class="btn block" type="submit">Create account</button></form><p class="foot">${a.providers.confirmationRequired===false ? "Create your account, then start syncing." : "Confirm your email to finish registering. Your browser saving a password does not mean registration succeeded."}</p>${a.providers.confirmationRequired===false ? "" : `<button class="link small" type="button" data-act="resendConfirm">Didn’t get the email? Resend confirmation email</button>`}
  </div>
  <div id="auth-reset" class="auth-pane" ${selected === "reset" ? "" : "hidden"}><h3>Reset your password</h3><p class="muted small">Enter your account email to request a reset link.</p><label class="field">Email address<input id="resetEmail" type="email" autocomplete="email" placeholder="you@example.com" data-enter="forgotPassword"></label><button class="btn block" data-act="forgotPassword">Send reset link</button><button class="link auth-secondary" data-act="authTab" data-mode="login">Back to log in</button></div>` : `<p class="muted small">Email sign-in is disabled for this site.</p>`}
  <p class="auth-privacy"><span aria-hidden="true">◇</span> Your collection is private. Device saving works without an account.</p>
  <details class="settings-disclosure"><summary>Help with email links</summary><p class="foot">Check your spam folder and open links in the requesting browser. If no email arrives, the site’s email-delivery service may need configuration.</p></details></section>`;
}

export function accountPanel() {
  const a = cloudInfo();
  if (!a.configured)
    return `<section class="panel account"><h3>Account</h3><p class="muted small">Accounts aren’t switched on for this site yet, so everything is saved on this device. Export a backup to move it to another phone or computer.</p></section>`;
  if (!a.ready)
    return `<section class="panel account"><h3>Account</h3><p class="muted small">${a.status.state === "error" ? esc(a.status.msg) : "Connecting…"}</p></section>`;
  if (a.recoveringPassword && a.user)
    return `<section class="panel account"><h3>Choose a new password</h3><p class="muted small">Your reset link was accepted. Set a password for your CardStashy account.</p><label class="field">New password<input id="resetPassword" type="password" autocomplete="new-password" minlength="8"></label><label class="field">Confirm password<input id="resetConfirm" type="password" autocomplete="new-password" data-enter="finishPasswordReset"></label><button class="btn block" data-act="finishPasswordReset">Save new password</button><button class="link small" data-act="signOut">Cancel and sign out</button></section>`;
  if (!a.user) return signedOutAccount(a, S.ui.authMode || "login");
  const pr = a.profile || {},
    st = a.status,
    label = { synced: "Synced", syncing: "Syncing…", error: "Sync paused", decide: "Needs your decision", offline: "Offline — will sync when you’re back online", local: "Account sync not confirmed" }[st.state] || "Account sync not confirmed";
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
    <button class="link small" data-act="accountResetPassword">Reset / set password</button> · <button class="link small" data-act="signOut">Sign out</button> <span class="muted small">— your data stays on this device.</span>
    <details class="settings-disclosure settings-danger"><summary>Delete account</summary><p class="foot">Permanently deletes your CardStashy account and the collection, decks and profile synced to it. You can keep or erase this device's copy afterwards. <a href="delete-account.html" target="_blank" rel="noopener">How account deletion works</a></p><button class="btn ghost danger" data-act="deleteAccount">Delete my account</button></details></section>`;
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
  <p class="muted small">${p.kind === "conflict" ? "Your account was updated on another device while this device also had changes. Pick one copy to keep." : "This device and your account both have cards, and they’re different."} The copy you don’t keep is downloaded as a backup file, so nothing is lost. CardStashy doesn’t merge copies automatically, so cards are never counted twice.</p>
  <div class="sync-compare">${side("This device", L, "Saved " + when(L.saved))}${C ? side("Your account", C, "Saved " + when(p.cloud.updated_at) + (p.cloud.device ? " · " + esc(p.cloud.device) : "")) : ""}</div>
  <div class="actions wrap"><button class="btn" data-act="syncChoice" data-choice="account">Keep the account copy</button><button class="btn ghost" data-act="syncChoice" data-choice="device">Keep this device’s copy</button></div>
  <button class="link small" data-act="syncChoice" data-choice="later">Decide later (sync stays paused)</button>`;
}

export function settings() {
  const st = S.state, tab = ["account","backup","app"].includes(S.ui.settingsTab) ? S.ui.settingsTab : "account";
  const saved = esc(st.lastSavedAt ? new Date(st.lastSavedAt).toLocaleString() : "Not yet");
  return `<div class="settings-page"><header class="settings-header"><p class="eyebrow">YOUR WORKSPACE</p><h1>Settings</h1><p class="muted">Your account, your data, your preferences.</p></header>
  <nav class="settings-tabs" role="tablist" aria-label="Settings sections">${[["account","Account"],["backup","Backup & data"],["app","App & sources"]].map(([id,label]) => `<button id="settingsTab-${id}" role="tab" aria-controls="settings-${id}" aria-selected="${id===tab}" data-act="settingsTab" data-id="${id}">${label}</button>`).join("")}</nav>
  <button class="btn ghost small settings-tour" data-act="replayTour">▶ Replay the welcome tour</button>
  <div id="settings-account" class="settings-pane" role="tabpanel" aria-labelledby="settingsTab-account" ${tab === "account" ? "" : "hidden"}><div class="settings-account-layout">${accountPanel()}<aside class="settings-aside"><span class="settings-status-dot"></span><b>Saved on this device</b><p class="muted small">${cloudInfo().user ? "Your account adds a private cloud copy." : "You can keep building without signing in."}</p><span class="small muted">Last saved<br>${saved}</span><button class="link" data-act="settingsTab" data-id="backup">Manage backups →</button></aside></div></div>
  <div id="settings-backup" class="settings-pane" role="tabpanel" aria-labelledby="settingsTab-backup" ${tab === "backup" ? "" : "hidden"}><section class="panel settings-card"><div class="settings-card-heading"><span class="settings-icon" aria-hidden="true">↓</span><div><p class="eyebrow">YOUR DATA</p><h2>Keep a backup</h2></div></div><p class="muted small">Download a copy of your collection, decks and settings.</p><button class="btn" data-act="exportBackup">Download backup</button><p class="foot">Last saved: ${saved}</p><details class="settings-disclosure"><summary>Restore or check a backup</summary><div class="actions wrap"><label class="btn ghost">Restore file<input type="file" accept=".json" data-change="restoreBackup" hidden></label><label class="btn ghost">Check file<input type="file" accept=".json" data-change="checkBackup" hidden></label></div><p id="backupCheck" class="muted small" role="status"></p><button class="link" data-act="undoRestore">Use the automatic recovery copy</button></details></section>
  <section class="panel settings-card"><h3>Device storage</h3><p id="storageDetail" class="muted small">Checking…</p><button class="btn ghost" data-act="persist">Keep data on this device</button></section>
  <details class="settings-disclosure settings-danger"><summary>Start over or load examples</summary><p class="foot">Export a backup first. One recovery copy is kept on this device.</p><div class="actions wrap"><button class="btn ghost danger" data-act="reset">Clear this device</button><button class="btn ghost" data-act="loadExample">Load example data</button></div></details></div>
  <div id="settings-app" class="settings-pane" role="tabpanel" aria-labelledby="settingsTab-app" ${tab === "app" ? "" : "hidden"}><section class="panel settings-card"><div class="settings-card-heading"><div><p class="eyebrow">APPEARANCE</p><h2>Glass &amp; art backdrop</h2></div></div><label class="check"><input type="checkbox" data-change="setGlass" ${(() => { try { return localStorage.getItem("cardstashy-glass") !== "off"; } catch { return true; } })() ? "checked" : ""}> Frosted glass panels over a blurred copy of the game's featured art</label><p class="foot">Turn it off for plain solid panels (a little lighter on older phones).</p><label class="check"><input type="checkbox" data-change="setHaptics" ${hapticsOn() ? "checked" : ""}> Vibration when you tap, add or remove cards</label><p class="foot">On iPhone this uses the system tap (iOS 18 or later). Animations follow your phone’s “Reduce motion” setting.</p></section><section class="panel settings-card"><div class="settings-card-heading"><span class="settings-icon" aria-hidden="true">＋</span><div><p class="eyebrow">TAKE IT WITH YOU</p><h2>Install CardStashy</h2></div></div><p class="muted small">Open it from your home screen. Saved collections and decks work offline.</p><button class="btn" data-act="install">Install app</button><details class="settings-disclosure"><summary>Android installation help</summary><p class="foot">In Chrome, open ⋮ → Add to Home screen or Install app. Searches and updated prices need internet.</p></details></section>
  <details class="settings-disclosure settings-source"><summary>Card databases & prices</summary><ul class="sources"><li><b>Magic:</b> Scryfall card data, images and reference prices; MTGJSON precon lists.</li><li><b>Pokémon:</b> TCGdex card data and images, with supplied TCGplayer and Cardmarket prices.</li><li><b>Yu-Gi-Oh!:</b> YGOPRODeck card data, alternate art, printings and reference prices.</li><li><b>Imports:</b> Supported text and CSV exports from deck and collection tools.</li></ul><p class="foot">Prices are estimates; check edition, condition and shipping with the seller.</p></details>
  <details class="settings-disclosure settings-source"><summary>About CardStashy</summary><p class="foot">Scores and test games are estimates, not win rates. CardStashy is an independent fan app, not affiliated with or endorsed by the publishers. Magic: The Gathering is a trademark of Wizards of the Coast; Yu-Gi-Oh! of Konami; Pokémon of Nintendo, Creatures and GAME FREAK. Cards and art belong to their owners.</p><span class="settings-version">Version ${APP_VERSION}</span></details></div></div>`;
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
  ${open.busy ? buildOverlay(open.msg, { title: "Building this deck", note: "Finding cards in your commander's colors at your budget, then filling all 100 slots, lands included. This can take up to a minute.", id: "ideaMsg" }) : `<p class="muted small" id="ideaMsg" role="status">${esc(open.msg || (open.budget ? "" : "Owned-only starters can be incomplete. Choose a purchase budget to build the full deck, including lands."))}</p>`}
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
  <p class="foot">Nothing changes until you tap a button. Buy sends only the cards you don't own to TCGplayer.</p>
  <div class="idea-actions">
    <button class="btn small" data-act="ideaSaveAll">Save as deck</button>
    <span class="row"><button class="btn ghost small" data-act="ideaBuy" title="Copy buy list">🛒 Buy</button><button class="btn ghost small" data-act="ideaWish" title="Add ticked to wishlist">♡</button><button class="btn ghost small" data-act="ideaOwn" title="I own the ticked cards">＋ Own</button></span>
  </div>`;
}
