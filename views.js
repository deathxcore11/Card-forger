// Screen renderers. Each returns HTML for #content; interaction is wired by
// data-act / data-change / data-input attributes handled centrally in app.js.
import { S, meta, inv, deckById, currentDeck, priceOf } from "./store.js";
import {
  esc, usd, pct, signed, art, cardImage, img, manaCost, colorDots, segmented,
  options, bar, ring, curveChart, lineChart, empty, setBadge,
} from "./ui.js";
import {
  cardKey as key, sumQty, rulesText, typeText, isLand, validateDeck,
  atLeastLands, aggregateCards, commanderEligible,
} from "./core.js";
import { deckComparison, comparisonTotals } from "./deck-flow.js";
import { printingState } from "./confidence.js";
import { complexity } from "./planner.js";
import {
  engineProfile, engineRoles, goldfish, scoreGrade, diffCards, deckValue,
  collectionValue, lotPrice, swapImpact, applySwapsToCards, cardSig,
} from "./insights.js";

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
    others = st.decks.filter((d) => d !== active).slice(-8).reverse();
  return `<section class="hero">
    <p class="eyebrow">Your Magic workbench</p>
    <h1>${copies ? "Welcome back." : "Let’s build from your cards."}</h1>
  </section>
  ${st.example ? `<div class="note warn">Example data is loaded. Reset it in Settings before adding real cards.</div>` : ""}
  <div class="kpis">
    <button class="kpi" data-act="go" data-to="#collection/value"><b>${usd(value.total, 0)}</b><span>collection value${change !== null ? ` <em class="${change >= 0 ? "up" : "down"}">${signed(change, (x) => usd(x, 0))}</em>` : ""}</span></button>
    <button class="kpi" data-act="go" data-to="#collection"><b>${copies}</b><span>cards owned</span></button>
    <button class="kpi" data-act="go" data-to="#decks"><b>${st.decks.length}</b><span>decks</span></button>
  </div>
  <div class="random-tools"><button class="btn ghost" data-act="dbRandom">🎲 Random card</button><button class="btn ghost" data-act="randomDeck">🎲 Random deck</button></div>
  <div class="quick">
    <button class="quick-btn primary" data-act="importDeck"><span>↥</span><b>Import a deck</b><small>See what you own and what’s missing</small></button>
    <button class="quick-btn" data-act="addCard"><span>＋</span><b>Add cards</b><small>One card or a whole list</small></button>
    <button class="quick-btn" data-act="go" data-to="#decks/ideas"><span>✧</span><b>Deck ideas</b><small>Commanders your cards support</small></button>
    <button class="quick-btn" data-act="go" data-to="#scan"><span>▧</span><b>Scan a card</b><small>Photo → match → confirm</small></button>
  </div>
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
  <details class="glossary"><summary>New to Commander? 60-second glossary</summary><dl>
    <dt>100 cards, one copy each</dt><dd>Your commander plus 99 others. Basic lands are the main exception to the one-copy rule.</dd>
    <dt>Color identity</dt><dd>Every card must fit inside your commander’s colors.</dd>
    <dt>Ramp · Draw · Removal</dt><dd>Extra mana, more cards, and answers to threats. Most decks want about 10 · 10 · 8 of them.</dd>
    <dt>Engine score</dt><dd>A 0–100 build-health check of those ingredients plus synergy and curve. It is not a win rate.</dd>
    <dt>Owned vs. deck</dt><dd>A deck is a plan. Your collection is what you physically own. Importing a deck never adds cards to your collection.</dd>
  </dl></details>`;
}

export function deckTile(d, wide = false) {
  const t = totalsFor(d),
    p = engineProfile(d, S.catalog),
    v = deckValue(d.cards, S.catalog, S.state.priceChoices),
    cover = coverOf(d),
    target = d.format === "Commander" ? 100 : 60,
    owned = t.copies ? t.covered / t.copies : 0;
  return `<button class="deck-tile ${wide ? "wide" : ""}" data-act="go" data-to="#deck/${esc(d.id)}">
    <span class="tile-art">${img(cover, d.name)}</span>
    <span class="tile-shade"></span>
    <span class="tile-top"><span class="chip dark">${esc(d.format === "Commander" ? "Commander" : "60-card")}</span>${colorDots(meta(d.commander))}</span>
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
  return `<div class="page-head"><h1>Search cards</h1><button class="btn ghost small" data-act="dbRandom">🎲 Random card</button></div>
  <div class="searchbar"><input id="dbTerm" type="search" value="${esc(db.term)}" placeholder="Name, or Scryfall syntax like t:angel o:draw" data-input="dbTerm" data-enter="dbSearch" aria-label="Search all cards" autocomplete="off"><button class="btn" data-act="dbSearch" ${db.busy ? "disabled" : ""}>${db.busy ? "…" : "Search"}</button></div>
  <details class="filters" ${f.color || f.type || f.maxPrice ? "open" : ""}><summary>Filters${f.color || f.type || f.maxPrice || f.format ? " · on" : ""}</summary><div class="grid2">
    <label>Fits colors<select data-change="dbFilter" data-field="color">${options([["", "Any"], ["W", "White"], ["U", "Blue"], ["B", "Black"], ["R", "Red"], ["G", "Green"], ["WU", "Azorius WU"], ["UB", "Dimir UB"], ["BR", "Rakdos BR"], ["RG", "Gruul RG"], ["GW", "Selesnya GW"], ["WB", "Orzhov WB"], ["UR", "Izzet UR"], ["BG", "Golgari BG"], ["RW", "Boros RW"], ["GU", "Simic GU"], ["C", "Colorless"]], f.color)}</select></label>
    <label>Type<select data-change="dbFilter" data-field="type">${options([["", "Any"], ...["creature", "instant", "sorcery", "artifact", "enchantment", "land", "planeswalker", "legendary creature"].map((x) => [x, x])], f.type)}</select></label>
    <label>Legal in<select data-change="dbFilter" data-field="format">${options([["", "Any format"], ["commander", "Commander"], ["standard", "Standard"], ["pioneer", "Pioneer"], ["modern", "Modern"], ["pauper", "Pauper"], ["legacy", "Legacy"]], f.format)}</select></label>
    <label>Max price $<input type="number" min="0" step="0.5" value="${esc(f.maxPrice)}" data-change="dbFilter" data-field="maxPrice" placeholder="Any"></label>
  </div></details>
  <div class="row between"><span class="muted small">${db.results.length ? `${db.total.toLocaleString()} cards` : "Live from Scryfall"}</span><button class="btn ghost small" data-act="dbRandom">🎲 Random card</button></div>
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
const FORMATS = [["commander", "Commander"], ["standard", "Standard"], ["pioneer", "Pioneer"], ["modern", "Modern"], ["legacy", "Legacy"], ["vintage", "Vintage"], ["pauper", "Pauper"], ["brawl", "Brawl"]];

export const setIcon = (code, rarity = "common", size = 18) =>
  code
    ? `<span class="set-icon r-${esc(rarity || "common")}" style="--icon:url('https://svgs.scryfall.io/sets/${esc(String(code).toLowerCase())}.svg');width:${size}px;height:${size}px" title="${esc(String(code).toUpperCase())} · ${esc(RARITY[rarity] || rarity || "")}" aria-hidden="true"></span>`
    : "";

const priceOfFinish = (p, f) => p?.prices?.[f === "nonfoil" ? "usd" : "usd_" + f] ?? null;

function facesOf(c) {
  return c.card_faces?.length && !c.oracle_text ? c.card_faces : [c];
}

export function cardSheet(c, ctx = {}) {
  const name = c.name,
    shown = ctx.print || c, // the printing currently being looked at
    i = inv(name),
    inDecks = S.state.decks.filter((d) => d.cards.some((x) => key(x.name) === key(name))),
    deck = ctx.deckId ? deckById(ctx.deckId) : null,
    row = deck?.cards.find((x) => key(x.name) === key(name)),
    roles = engineRoles(c),
    faces = facesOf(shown),
    face = ctx.face && faces[ctx.face] ? ctx.face : 0,
    imgFaces = shown.card_faces?.filter((f) => f.image_uris),
    image = imgFaces?.length > 1 ? imgFaces[face]?.image_uris?.normal : cardImage(shown),
    chosen = S.state.priceChoices?.[key(name)],
    legal = c.legalities || {},
    prints = ctx.prints || null;
  const finishes = ["nonfoil", "foil", "etched"].filter((f) => priceOfFinish(shown, f));
  return `<div class="sheet-head">${S.ui.sheetBack ? `<button class="icon" data-act="sheetBack" aria-label="Back to deck idea">←</button>` : ""}<h2>${esc(name)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="cd">
    <div class="cd-img">
      ${img(image, name, "card-img")}
      ${imgFaces?.length > 1 ? `<button class="btn ghost small block" data-act="flipFace">↻ Flip to ${esc(imgFaces[face ? 0 : 1].name)}</button>` : ""}
    </div>
    <div class="cd-info">
      <div class="cd-set">${setIcon(shown.set, shown.rarity, 26)}<div><b>${esc(shown.set_name || (shown.set || "").toUpperCase())}</b><small>${esc((shown.set || "").toUpperCase())} #${esc(shown.collector_number || "?")} · ${esc(RARITY[shown.rarity] || shown.rarity || "")}${shown.released_at ? " · " + esc(shown.released_at.slice(0, 4)) : ""}</small></div></div>
      <div class="cd-prices">${
        finishes.length
          ? finishes.map((f) => `<span class="price-pill ${f}"><small>${f === "nonfoil" ? "Regular" : f === "foil" ? "Foil" : "Etched"}</small><b>${usd(priceOfFinish(shown, f))}</b></span>`).join("")
          : `<span class="muted small">No USD price for this printing</span>`
      }</div>
      ${prints ? `<p class="small muted">Across ${prints.length} printings: <b class="ok-text">${usd(cheapest(prints))}</b> cheapest · <b>${usd(dearest(prints))}</b> priciest</p>` : ""}
      ${chosen ? `<p class="small">Your shopping price: <b>${usd(chosen.price)}</b> · ${esc(chosen.label)}</p>` : ""}
    </div>
  </div>
  ${faces
    .map(
      (f) => `<section class="cd-text">
      <div class="row between"><b>${esc(f.name)}</b>${manaCost(f)}</div>
      <p class="type-line">${esc(f.type_line || typeText(shown))}</p>
      ${f.oracle_text ? `<p class="oracle">${esc(f.oracle_text)}</p>` : ""}
      ${f.flavor_text ? `<p class="flavor">${esc(f.flavor_text)}</p>` : ""}
      <div class="row between small muted">${f.power !== undefined && f.power !== null ? `<span class="pt">${esc(f.power)}/${esc(f.toughness)}</span>` : shown.loyalty ? `<span class="pt">Loyalty ${esc(shown.loyalty)}</span>` : "<span></span>"}${f.artist || shown.artist ? `<span>🖌 ${esc(f.artist || shown.artist)}</span>` : ""}</div>
    </section>`,
    )
    .join("")}
  ${!c.full ? `<p class="muted small center" id="cardLoading">Loading flavor text and printings…</p>` : ""}
  <div class="chips">${roles.map((r) => `<span class="chip role-${r.toLowerCase()}">${r}</span>`).join("")}${c.edhrec_rank ? `<span class="chip">EDHREC #${Number(c.edhrec_rank).toLocaleString()}</span>` : ""}${c.reserved ? `<span class="chip">Reserved List</span>` : ""}${c.game_changer ? `<span class="chip warn">Game Changer</span>` : ""}</div>
  <div class="legal">${FORMATS.map(([k, l]) => `<span class="lg ${legal[k] === "legal" ? "yes" : legal[k] === "restricted" ? "res" : legal[k] === "banned" ? "ban" : "no"}">${l}</span>`).join("")}</div>
  <p class="small own-line">${i.owned ? `<b class="ok-text">You own ${i.owned}</b> · ${i.available} free${i.reserved ? ` · ${i.reserved} reserved` : ""}` : "Not in your collection"}${inDecks.length ? ` · in ${inDecks.map((d) => esc(d.name)).join(", ")}` : ""}</p>
  ${
    row
      ? `<div class="panel tight"><div class="row between"><b>In ${esc(deck.name)}</b><span class="stepper"><button data-act="deckQty" data-name="${esc(name)}" data-delta="-1" aria-label="One fewer">−</button><b>${row.qty}</b><button data-act="deckQty" data-name="${esc(name)}" data-delta="1" aria-label="One more">＋</button></span></div>${key(name) !== key(deck.commander) ? `<button class="link danger small" data-act="deckRemove" data-name="${esc(name)}">Remove from deck</button>` : ""}</div>`
      : ""
  }
  <div class="actions wrap">
    <button class="btn" data-act="own" data-name="${esc(name)}">＋ I own this</button>
    <button class="btn ghost" data-act="wish" data-name="${esc(name)}">♡ Wishlist</button>
    <button class="btn ghost" data-act="compareFrom" data-name="${esc(name)}">⇄ Compare</button>
    ${commanderEligible(c) ? `<button class="btn ghost" data-act="newDeck" data-commander="${esc(name)}">Build around</button>` : ""}
    ${ctx.random ? `<button class="btn ghost" data-act="dbRandom">🎲 Another</button>` : ""}
  </div>
  ${S.state.decks.length ? `<div class="inline-pick"><select id="toDeck" aria-label="Deck to add to">${options(S.state.decks.map((d) => [d.id, d.name]), deck?.id || S.state.activeDeck)}</select><button class="btn ghost" data-act="addToDeck" data-name="${esc(name)}">Add to deck</button></div>` : ""}
  <section class="prints"><div class="row between"><h3>All printings & prices</h3>${prints ? `<span class="muted small">${prints.length}</span>` : ""}</div>
    ${prints ? printList(prints, shown, name, chosen) : `<p class="muted small">Loading…</p>`}
  </section>
  <details class="more"><summary>Research & buy</summary><div class="links">
    <a href="${esc(c.scryfall_uri || "https://scryfall.com/search?q=" + encodeURIComponent(name))}" target="_blank" rel="noopener">Scryfall ↗</a>
    <a href="https://edhrec.com/cards/${esc(name.toLowerCase().split(" // ")[0].replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}" target="_blank" rel="noopener">EDHREC ↗</a>
    <a href="https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encodeURIComponent(name)}" target="_blank" rel="noopener">TCGplayer ↗</a>
    <a href="https://www.cardkingdom.com/catalog/search?filter%5Bname%5D=${encodeURIComponent(name)}" target="_blank" rel="noopener">Card Kingdom ↗</a>
    <a href="https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(name)}" target="_blank" rel="noopener">Cardmarket ↗</a>
  </div></details>`;
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
        <span class="print-prices">${fin.length ? fin.map((f) => `<button class="pp ${chosen?.id === p.id && chosen?.finish === f ? "on" : ""}" data-act="choosePrint" data-i="${i}" data-finish="${f}" data-name="${esc(name)}" title="Use this price for shopping"><small>${f === "nonfoil" ? "reg" : f}</small>${usd(priceOfFinish(p, f))}</button>`).join("") : '<span class="muted small">—</span>'}</span>
      </div>`;
    })
    .join("")}</div><p class="foot">Tap a printing to see its art, flavor text and artist. Tap a price to use it for your shopping totals.</p>`;
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
  ${segmented("decksTab", tab, [["mine", "My decks"], ["ideas", "Ideas"], ["inspiration", "Inspiration"]])}<div class="random-tools"><button class="btn ghost small" data-act="randomDeck">🎲 Random deck</button></div>
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
        : empty("Find what your cards want to be", "Analysis loads card data for your whole collection in a few batched requests, then tries every legendary creature you own as a commander.")
  }`;
}

function inspirationView() {
  const st = S.state,
    q = S.ui.q.ref.toLowerCase(),
    refs = (st.references || []).filter((d) => [d.name, d.commander, d.source?.author, d.source?.website].some((v) => (v || "").toLowerCase().includes(q)));
  return `<p class="muted">Save decks you admire — community lists or precons — with credit to the creator. Match them to your cards and build your own version.</p>
  <div class="toolbar"><button class="btn" data-act="importReference">↥ Save a deck idea</button>${(st.references || []).length > 3 ? `<input type="search" value="${esc(S.ui.q.ref)}" placeholder="Search saved ideas…" data-input="refSearch">` : ""}</div>
  <div class="deck-grid">${refs
    .map((d) => {
      const t = comparisonTotals(rowsFor({ ...d, id: "reference:" + d.id }));
      return `<article class="idea"><div class="idea-art">${img(coverOf(d), d.name)}<span class="chip dark">${esc(d.source?.kind || d.format)}</span></div><div class="idea-body"><b>${esc(d.name)}</b><small>${esc(d.commander || "")}${d.source?.author ? " · by " + esc(d.source.author) : ""}${d.source?.website ? " · " + esc(d.source.website) : ""}</small><div class="row between small"><span><b>${t.covered}</b>/${t.copies} owned</span><span>${usd(t.pricedGap, 0)} to finish</span></div>${bar(t.copies ? t.covered / t.copies : 0, "thin")}<div class="actions wrap"><button class="btn small" data-act="copyRef" data-id="${esc(d.id)}">Build my version</button>${d.source?.url ? `<a class="link small" href="${esc(d.source.url)}" target="_blank" rel="noopener noreferrer">Original ↗</a>` : ""}<button class="link small" data-act="exportRef" data-id="${esc(d.id)}">Export</button><button class="link small danger" data-act="deleteRef" data-id="${esc(d.id)}">Remove</button></div></div></article>`;
    })
    .join("")}</div>
  <section class="panel"><h3>Precons</h3><p class="muted small">Find a preconstructed Commander deck by product name (MTGJSON), preview it against your collection, then save it.</p><div class="toolbar"><button class="btn ghost" data-act="loadPrecons" ${S.ui.precon.busy ? "disabled" : ""}>${S.ui.precon.index.length ? "Reload list" : "Load precon list"}</button>${S.ui.precon.index.length ? `<input type="search" value="${esc(S.ui.q.precon)}" placeholder="Product or deck name…" data-input="preconSearch">` : ""}</div>${S.ui.precon.msg ? `<p class="muted small">${esc(S.ui.precon.msg)}</p>` : ""}<div id="preconList">${preconList()}</div></section>`;
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
    target = d.format === "Commander" ? 100 : 60,
    tab = S.ui.deckTab,
    tabs = [["cards", "Cards"], ["engine", "Engine"], ["upgrade", "Upgrade lab"], ["versions", "Versions"], ["playtest", "Playtest"], ["shop", t.missing ? `Shop · ${t.missing}` : "Shop"]];
  return `<section class="deck-hero">${img(coverOf(d), d.name, "hero-art")}<div class="hero-shade"></div>
    <div class="hero-body">
      <div class="row between"><button class="icon light" data-act="go" data-to="#decks" aria-label="Back to decks">←</button><button class="icon light" data-act="deckMenu" aria-label="Deck options">⋯</button></div>
      <h1>${esc(d.name)}</h1>
      <p>${colorDots(meta(d.commander))} ${esc(d.commander || d.format)}${d.locked ? ' · <span class="chip dark">Assembled</span>' : ""}</p>
      <div class="hero-stats">
        <span><b class="${t.copies === target ? "" : "warn-text"}">${t.copies}/${target}</b>cards</span>
        <span><b>${t.copies ? Math.round((t.covered / t.copies) * 100) : 0}%</b>owned</span>
        <span><b>${usd(v.total, 0)}</b>value</span>
        <button data-act="deckTab" data-id="engine"><b>${p.score}</b>engine</button>
      </div>
    </div>
  </section>
  <nav class="tabs" role="tablist">${tabs.map(([id, l]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? "on" : ""}" data-act="deckTab" data-id="${id}">${l}</button>`).join("")}</nav>
  ${d.format === "Commander" && !commanderEligible(meta(d.commander)) && tab !== "upgrade" ? `<button class="note warn block-note" data-act="deckTab" data-id="upgrade">⚠ No commander set — tap to choose one so upgrades and synergy work.</button>` : ""}
  <div class="deck-body" data-tab="${tab}">${{ cards: deckCards, engine: deckEngine, upgrade: deckUpgrade, versions: deckVersions, playtest: deckPlaytest, shop: deckShop }[tab](d, t)}</div>`;
}

const CATS = ["Commander", "Creatures", "Planeswalkers", "Artifacts", "Enchantments", "Instants", "Sorceries", "Battles", "Lands", "Unresolved"];

function deckCards(d, t) {
  const target = d.format === "Commander" ? 100 : 60;
  return `<div class="add-row"><input id="deckAddName" placeholder="Add a card by name" data-enter="deckAdd" aria-label="Card name to add" autocomplete="off"><button class="btn" data-act="deckAdd">Add</button></div>
  <div class="cover-line"><span><b>${t.covered}</b>/${t.copies} owned${t.missing ? ` · <b>${t.missing}</b> missing · <b>${usd(t.pricedGap)}</b>${t.unpriced ? "+" : ""} to finish` : " · everything owned ✓"}</span>${t.copies < target ? `<button class="link" data-act="deckTab" data-id="upgrade">Fill ${target - t.copies} slots →</button>` : ""}</div>
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

function deckRow(r, d) {
  const c = meta(r.name),
    ok = r.missing === 0;
  return `<div class="lot deck-row ${ok ? "" : "short"}">
    <button class="lot-art" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${img(art(c), r.name)}<span class="art-price">${usd(r.price)}</span></button>
    <div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${esc(r.name)} ${setBadge(c)}</button>
      <span class="lot-sub">${manaCost(c) || (c ? "" : '<span class="tag warn">Unresolved</span>')}</span>
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
          .map((k) => `<div class="meter two"><span><i class="pip pip-${k}">${k}</i></span><span class="pair">${bar(colorTotal ? p.pips[k] / colorTotal : 0, "c-" + k)}${bar(srcTotal ? p.sources[k] / srcTotal : 0, "c-" + k + " faint")}</span><b class="small">${pct(colorTotal ? p.pips[k] / colorTotal : 0)} need · ${pct(srcTotal ? p.sources[k] / srcTotal : 0)} make</b></div>`)
          .join("")}</section>`
      : ""
  }
  <section class="panel"><div class="row between"><h3>Test games</h3><span class="muted small">${g ? g.games.toLocaleString() + " simulated" : ""}</span></div>
  ${g ? goldfishTable(g) + `<p class="foot">Solitaire “goldfish” games: shuffle, mulligan 0–1 or 6–7 land hands, play a land and cast what you can for ${g.turns} turns. No opponents; colors are ignored. Useful for comparing versions of the same deck.</p>` : `<p class="muted">Add at least 20 cards with card data to simulate games.</p>`}
  </section>
  <details class="panel"><summary><b>Key cards by role</b></summary>${Object.entries(p.byRole)
    .filter(([, l]) => l.length)
    .map(([r, l]) => `<p class="small"><b>${r}:</b> ${l.map((n) => `<button class="link" data-act="card" data-name="${esc(n)}" data-deck="${esc(d.id)}">${esc(n)}</button>`).join(", ")}</p>`)
    .join("") || '<p class="muted small">No roles recognized yet.</p>'}</details>
  <details class="panel" ${issues.length ? "" : ""}><summary><b>Rules checks</b> <span class="chip ${issues.length ? "warn" : "ok"}">${issues.length ? issues.length + " to fix" : "pass"}</span></summary><ul class="issues">${issues.slice(0, 40).map((i) => `<li>${esc(i.text)}</li>`).join("") || "<li>Color identity, legality and copy limits pass.</li>"}</ul><p class="foot">Single commander only. Legality comes from cached card data — refresh before an event.</p></details>`;
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
  const legends = aggregateCards(d.cards).map((c) => meta(c.name)).filter((c) => c && commanderEligible(c));
  return `<section class="panel pick-commander"><p class="eyebrow">One quick step</p><h2>Which card is your commander?</h2><p class="muted small">This deck doesn’t have a commander set, so Cardforge can’t tell your colors. Tap it below.</p>
  ${legends.length ? `<div class="list compact">${legends.map((c) => `<button class="mini-row" data-act="setCommander" data-name="${esc(c.name)}"><span class="row">${img(art(c), c.name, "mini-art")}<span class="ellip"><b>${esc(c.name)}</b></span></span>${colorDots(c)}</button>`).join("")}</div>` : `<p class="small">No legendary creatures were found in this list.</p>`}
  <div class="searchbar"><input id="cmdName" placeholder="Or type the commander’s name" data-enter="setCommander"><button class="btn ghost" data-act="setCommander">Set</button></div></section>`;
}

function deckUpgrade(d) {
  const target = d.format === "Commander" ? 100 : 60,
    count = sumQty(d.cards);
  if (d.format !== "Commander")
    return `<div class="note">Upgrade suggestions currently support single-commander decks. You can still use Versions and Engine for 60-card decks.</div>`;
  if (!commanderEligible(meta(d.commander))) return commanderPicker(d);
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
    trade !== null ? `<div class="imp"><small>Net after trade-in</small><b>${usd(trade)}</b></div>` : "",
  ].join("");
}

function swapPanel(d) {
  const U = S.ui.upgrade,
    plans = U.deckId === d.id ? U.plans : {},
    plan = plans[U.budget];
  return `<section class="panel"><p class="eyebrow">${sumQty(d.cards) < 100 ? "Step 2" : "Upgrade lab"}</p><h2>One-for-one upgrades</h2><p class="muted small">Pick a budget. Cardforge proposes cuts and replacements, then shows exactly what each swap does to the engine and what it costs after trading in the cut card.</p>
  <div class="chips">${[0, 10, 25, 50, 100].map((n) => `<button class="chip pick ${U.budget === n ? "on" : ""}" data-act="upBudget" data-v="${n}">${n ? "$" + n : "My cards ($0)"}</button>`).join("")}</div>
  <label class="custom-budget">Custom upgrade budget ($)<input type="number" min="0" max="100000" step="0.01" value="${U.budget}" data-change="upCustom" aria-label="Custom upgrade budget"></label>
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
  const base = engineProfile(d, S.catalog).score,
    sel = S.ui.upgrade.selected;
  if (!plan.swaps.length)
    return `<section class="panel">${empty("No clear upgrades at this budget", "Try a higher budget, or load card data for your collection so owned cards can be suggested.")}</section>`;
  return `<div class="swap-list">${plan.swaps
    .map((s, i) => {
      const add = meta(s.add),
        cut = meta(s.cut),
        imp = swapImpact(d, s, S.catalog, base);
      return `<article class="swap ${sel.has(i) ? "on" : ""}">
        <label class="swap-check"><input type="checkbox" data-change="upPick" data-i="${i}" ${sel.has(i) ? "checked" : ""}> Use this swap</label>
        <div class="swap-pair">
          <button class="swap-card out" data-act="card" data-name="${esc(s.cut)}">${img(art(cut), s.cut)}<small>OUT</small><b>${esc(s.cut)}</b><span>${manaCost(cut)}</span><span class="muted small">worth ${usd(imp.cutValue)}</span></button>
          <span class="swap-arrow">→</span>
          <button class="swap-card in" data-act="card" data-name="${esc(s.add)}">${img(art(add), s.add)}<small>IN</small><b>${esc(s.add)}</b><span>${manaCost(add)}</span><span class="small">${s.owned ? '<b class="ok-text">You own it</b>' : usd(s.cost)}</span></button>
        </div>
        <div class="swap-facts"><span>Engine <b class="${imp.delta > 0 ? "up" : imp.delta < 0 ? "down" : ""}">${signed(imp.delta)}</b></span><span>Cost <b>${usd(s.cost)}</b></span><span>Net after trade-in <b>${usd(imp.net)}</b></span><span>${esc(s.complexity)}</span></div>
        <p class="small muted">${esc(s.reason.replace(/ Review the cut’s unique abilities before replacing it\./, ""))}</p>
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
  return `<p class="eyebrow">Before → after · ${sel.length} swap${sel.length > 1 ? "s" : ""}</p><div class="impact">${impactCells(before, after, { cost: spend, trade: spend - trade })}</div><div class="actions"><button class="btn ghost small" data-act="upExport">↓ Buy list</button><button class="btn small" data-act="upApply">Apply ${sel.length}</button></div>`;
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
  const cards = d.cards.filter((c) => d.format !== "Commander" || key(c.name) !== key(d.commander)),
    p = engineProfile(d, S.catalog),
    total = sumQty(cards),
    odds = total >= 7 ? atLeastLands(total, p.counts.Lands, 7, 3) : null,
    hand = S.ui.hand?.deckId === d.id ? S.ui.hand : null,
    notes = S.state.notes.filter((n) => n.deckId === d.id).slice().reverse(),
    wins = notes.filter((n) => n.result === "Win").length,
    losses = notes.filter((n) => n.result === "Loss").length;
  return `<section class="panel"><div class="row between"><h3>Opening hand</h3><span class="muted small">${odds === null ? "" : pct(odds) + " of hands have 3+ lands"}</span></div>
  <div class="actions"><button class="btn" data-act="draw7" ${total < 7 ? "disabled" : ""}>${hand ? "New hand" : "Draw 7"}</button><button class="btn ghost" data-act="mull" ${hand ? "" : "disabled"}>Mulligan</button><button class="btn ghost" data-act="drawOne" ${hand?.library.length ? "" : "disabled"}>Draw a card</button></div>
  ${hand ? `<p class="small">${hand.hand.filter((n) => isLand(meta(n))).length} lands · turn ${Math.max(1, hand.hand.length - 6)}${hand.mulls ? ` · mulligan ${hand.mulls} (bottom ${hand.mulls})` : ""}</p><div class="hand">${hand.hand.map((n) => `<button class="hand-card" data-act="card" data-name="${esc(n)}">${img(cardImage(meta(n)), n, "card-img")}</button>`).join("")}</div>` : `<p class="muted small">${total < 7 ? "Add more cards to draw a hand." : "The commander stays in the command zone."}</p>`}
  </section>
  <section class="panel"><div class="row between"><h3>Game log</h3><span class="chip">${wins}W · ${losses}L</span></div>
  <div class="log-form"><select id="logResult" aria-label="Result">${options([["Win", "Win"], ["Loss", "Loss"], ["Learning game", "Learning"]], "Win")}</select><input id="logTurn" type="number" min="1" max="40" placeholder="Turn" aria-label="Ending turn"><input id="logNote" placeholder="What worked or stalled?" maxlength="1000" aria-label="Note"><button class="btn" data-act="logGame">Save</button></div>
  <p class="foot">Games are tagged with the current deck version, so Versions can show real results next to the simulations.</p>
  ${notes.map((n) => `<div class="note-row"><span class="chip ${n.result === "Win" ? "ok" : n.result === "Loss" ? "warn" : ""}">${esc(n.result)}</span><span class="ellip small">${esc(n.date)}${n.turn ? " · T" + n.turn : ""} ${n.note ? "· " + esc(n.note) : ""}</span><button class="link small danger" data-act="deleteNote" data-id="${n.id}" aria-label="Delete game">✕</button></div>`).join("")}
  </section>`;
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
      return `<div class="lot"><button class="lot-art" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${img(art(c), r.name)}</button><div class="lot-info"><button class="lot-name" data-act="card" data-name="${esc(r.name)}" data-deck="${esc(d.id)}">${esc(r.name)}</button><span class="lot-sub">Need ${r.missing}${S.state.priceChoices?.[key(r.name)] ? " · " + esc(S.state.priceChoices[key(r.name)].label) : ""}</span></div><div class="lot-side"><span class="price">${usd(r.price === null ? null : r.price * r.missing)}</span></div></div>`;
    })
    .join("")}</div>
  <section class="panel">${costBlock(sub, total, d.budget, "deck budget")}${t.unpriced ? `<p class="small warn-text">${t.unpriced} copies have no price and aren’t included.</p>` : ""}
  <div class="actions wrap"><button class="btn" data-act="copyShopping" data-src="deck">Copy list</button><a class="btn ghost" href="https://www.tcgplayer.com/massentry" target="_blank" rel="noopener">TCGplayer Mass Entry ↗</a><button class="btn ghost" data-act="exportMissing">↓ .txt</button><button class="btn ghost" data-act="acquire">I got cards</button></div>
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

export function settings() {
  const st = S.state;
  return `<div class="page-head"><h1>Settings & backup</h1></div>
  <section class="panel"><h3>Backup</h3><p class="muted small">Your collection lives in this browser on this website address. Export a backup before switching phones or browsers.</p>
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
