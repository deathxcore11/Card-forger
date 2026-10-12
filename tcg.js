// Yu-Gi-Oh! and Pokémon: collection, search, sets and deck building, sharing one
// set of screens. Each game's data, rules and formats come from its adapter.
import { S, uid } from "./store.js";
import { esc, usd, empty, bar, options, segmented } from "./ui.js";
import { GAMES, GAME_ICON, GAME_IDS, blankGame, gameOf } from "./games.js";
import { ygoSource, ygoImageDirect, YGO_TYPES, YGO_ATTRIBUTES } from "./ygo.js";
import { ptcgSource, PTCG_TYPES } from "./ptcg.js";

export const SOURCES = { ygo: ygoSource, ptcg: ptcgSource };
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
    coll: { q: "", sort: "value", set: "" },
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
  cache[card.game][card.id] = card;
  saveCacheSoon();
  return card;
};
// Full card with prices no older than a day.
export async function ensureCard(g, id, force = false) {
  const c = cache[g][id];
  if (c && !c.brief && !force && Date.now() - new Date(c.fetchedAt).getTime() < PRICE_TTL) return c;
  try {
    return remember(await SOURCES[g].get(id));
  } catch (e) {
    if (c) return c;
    throw e;
  }
}
// Load details for many cards, a few at a time, calling `tick` as they arrive.
export async function ensureMany(g, ids, tick = () => {}, force = false) {
  const queue = [...new Set(ids)].filter((id) => force || !cache[g][id] || cache[g][id].brief || Date.now() - new Date(cache[g][id].fetchedAt).getTime() > PRICE_TTL);
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      await ensureCard(g, id, force).catch(() => {});
      if (++done % 8 === 0) tick(done);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  tick(done);
  return done;
}

const price = (c) => c?.prices?.usd ?? null;
const imgTag = (c, cls = "card-img", large = false) => {
  if (!c) return `<span class="${cls} img-missing" aria-hidden="true">◇</span>`;
  const src = large ? c.imageLarge || c.image : c.image;
  if (!src) return `<span class="${cls} img-missing" aria-hidden="true">◇</span>`;
  const fallback = c.game === "ygo" ? ygoImageDirect(c.id, !large) : "";
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="${fallback ? `if(!this.dataset.f){this.dataset.f=1;this.src='${esc(fallback)}'}else ` : ""}this.remove()">`;
};

/* ---------- ownership & value ---------- */

const keyOf = (g, c) => SOURCES[g].ownKey(c);
export function ownedMap(g, s = S.state) {
  const m = new Map();
  for (const e of gs(g, s).collection) m.set(e.key, (m.get(e.key) || 0) + e.qty);
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
function entryPrice(c, e) {
  if (!c) return null;
  if (c.game === "ygo" && e.printing) {
    const s = c.sets?.find((x) => x.code === e.printing && x.rarity === (e.rarity || x.rarity));
    if (s?.price) return s.price;
  }
  if (c.game === "ptcg" && e.variant) {
    const v = c.variants?.find((x) => x.key === e.variant);
    if (v?.usd) return v.usd;
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
  return `<section class="binders" aria-label="Your games">${GAME_IDS.map((g) => {
    const v = g === "mtg" ? null : collectionValue(g),
      mtgCopies = g === "mtg" ? S.state.collection.reduce((a, e) => a + e.qty, 0) : 0,
      decks = g === "mtg" ? S.state.decks.length : gs(g).decks.length;
    return `<button class="binder b-${g} ${g === active ? "on" : ""}" data-act="setGame" data-game="${g}" aria-pressed="${g === active}"><span class="binder-icon">${GAME_ICON[g]}</span><b>${esc(GAMES[g].short)}</b><small>${g === "mtg" ? mtgCopies : v.copies} cards · ${decks} deck${decks === 1 ? "" : "s"}</small></button>`;
  }).join("")}</section>`;
}

const formatsOf = (g) => SOURCES[g].formats;
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

/* ---------- home ---------- */

export function tcgHome() {
  const g = game(),
    G = GAMES[g],
    v = collectionValue(g),
    st = gs(g),
    recent = st.decks.slice(-6).reverse();
  return `${gameBinders(g)}
  <section class="hero"><p class="eyebrow">${esc(G.name)}</p><h1>${v.copies ? "Your binder" : "Start your binder"}</h1><p class="muted small">${esc(G.tagline)}. Card data and daily prices from ${esc(G.source)}.</p></section>
  <div class="kpis">
    <button class="kpi" data-act="go" data-to="#collection"><b>${usd(v.total, 0)}</b><span>collection value${v.unpriced ? ` · ${v.unpriced} unpriced` : ""}</span></button>
    <button class="kpi" data-act="go" data-to="#collection"><b>${v.copies}</b><span>cards owned</span></button>
    <button class="kpi" data-act="go" data-to="#decks"><b>${st.decks.length}</b><span>decks</span></button>
  </div>
  <div class="quick">
    <button class="quick-btn primary" data-act="go" data-to="#search"><span>⌕</span><b>Find cards</b><small>Search, filter by set, type, format and price</small></button>
    <button class="quick-btn" data-act="tNewDeck"><span>＋</span><b>New deck</b><small>${esc(formatsOf(g).slice(0, 3).map((f) => f.name).join(", "))}…</small></button>
    <button class="quick-btn" data-act="tImport"><span>↥</span><b>Import a deck</b><small>${g === "ygo" ? ".ydk file or a text list" : "Pokémon TCG Live list or text"}</small></button>
    <button class="quick-btn" data-act="go" data-to="#sets"><span>◈</span><b>Browse sets</b><small>Every set, newest first, with your completion</small></button>
  </div>
  ${recent.length ? `<div class="section-head"><h2>Your decks</h2><button class="link" data-act="go" data-to="#decks">All decks →</button></div><div class="tdeck-list">${recent.map((d) => deckTile(g, d)).join("")}</div>` : empty("No decks yet", `Start a ${esc(G.short)} deck from scratch or import a list. Cardforge checks it against the format’s rules and your collection.`, `<button class="btn" data-act="tNewDeck">New deck</button><button class="btn ghost" data-act="tImport">Import</button>`)}`;
}

function deckTile(g, d) {
  const s = deckStats(g, d),
    f = formatOf(g, d.format),
    cover = cardOf(g, (d.zones.main || [])[0]?.cardId),
    issues = SOURCES[g].validate(d, (id) => cardOf(g, id), f);
  return `<button class="tdeck" data-act="go" data-to="#tdeck/${esc(d.id)}">${imgTag(cover, "tdeck-art")}<span class="tdeck-body"><b class="ellip">${esc(d.name)}</b><small>${esc(f.name)} · ${s.total} cards</small><small>${s.total ? Math.round((s.owned / s.total) * 100) : 0}% owned · ${usd(s.buy, 0)} to finish</small>${issues.length ? `<span class="tag bad">${issues.length} to fix</span>` : s.total ? `<span class="tag ok">Legal</span>` : ""}</span></button>`;
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
  if (U.sort === "price") list = [...list].sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
  const filters =
    g === "ygo"
      ? `<label>Card type<select data-change="tFilter" data-field="type">${options([["", "Any"], ...YGO_TYPES.map((x) => [x, x])], U.f.type || "")}</select></label>
         <label>Attribute<select data-change="tFilter" data-field="attribute">${options([["", "Any"], ...YGO_ATTRIBUTES.map((x) => [x, x])], U.f.attribute || "")}</select></label>`
      : `<label>Card type<select data-change="tFilter" data-field="category">${options([["", "Any"], ["Pokemon", "Pokémon"], ["Trainer", "Trainer"], ["Energy", "Energy"]], U.f.category || "")}</select></label>
         <label>Energy type<select data-change="tFilter" data-field="type">${options([["", "Any"], ...PTCG_TYPES.map((x) => [x, x])], U.f.type || "")}</select></label>`;
  return `<div class="page-head"><h1>Search ${esc(GAMES[g].short)}</h1><button class="btn ghost small" data-act="go" data-to="#sets">◈ Browse sets</button></div>
  <div class="searchbar"><input type="search" value="${esc(U.q)}" placeholder="${g === "ygo" ? "Card name, e.g. Dark Magician" : "Card name, e.g. Charizard"}" data-input="tQ" data-enter="tSearch" aria-label="Search cards" autocomplete="off"><button class="btn" data-act="tSearch" ${U.busy ? "disabled" : ""}>${U.busy ? "…" : "Search"}</button></div>
  <details class="filters" ${Object.values(U.f).some(Boolean) || U.maxPrice ? "open" : ""}><summary>Filters${Object.values(U.f).some(Boolean) || U.maxPrice ? " · on" : ""}</summary><div class="grid2">
    ${filters}
    <label>Legal in<select data-change="tFilter" data-field="format">${options([["", "Any format"], ...formatsOf(g).map((x) => [x.id, x.name])], fid)}</select></label>
    <label>Sort<select data-change="tSort">${options([...(g === "ygo" ? [["name", "Name"], ["new", "Newest"]] : [["new", "Newest"], ["name", "Name"]]), ["price", "Price: high to low"]], U.sort)}</select></label>
    <label class="span2">Max price $<input type="number" min="0" step="0.5" value="${esc(U.maxPrice)}" placeholder="Any" data-change="tMax"></label>
  </div></details>
  ${U.error ? `<div class="note warn">${esc(U.error)}</div>` : ""}
  ${U.f.set ? `<p class="small">Set: <b>${esc(U.f.setName || U.f.set)}</b> <button class="link small" data-act="tFilterClear" data-field="set">✕ clear</button></p>` : ""}
  ${
    list.length
      ? `<p class="muted small">${U.total ? U.total.toLocaleString() : list.length + (U.more ? "+" : "")} cards · prices are daily market estimates · “new” = no market price yet</p><div class="card-grid">${list
          .map((c) => {
            const own = ownedOf(g, c, m),
              p = price(c);
            return `<button class="grid-card" data-act="tCard" data-id="${esc(c.id)}">${imgTag(c)}<span class="grid-meta"><span class="ellip">${esc(c.name)}</span><span>${c.brief ? "…" : p === null ? "new" : usd(p)}</span></span>${own ? `<span class="owned-badge">×${own}</span>` : ""}</button>`;
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

export function tcgCardSheet(c, sctx = {}) {
  const g = c.game,
    own = ownedOf(g, c),
    decks = gs(g).decks,
    deck = sctx.deckId ? decks.find((d) => d.id === sctx.deckId) : null,
    p = c.prices || {};
  return `<div class="sheet-head"><h2>${esc(c.name)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="cd">
    <div class="cd-img">${imgTag(c, "card-img", true)}</div>
    <div class="cd-info">
      <p class="small muted">${esc(c.typeLine || "")}</p>
      ${c.set ? `<button class="cd-set" data-act="tSet" data-id="${esc(c.set.id)}"><div><b>${esc(c.set.name)} <span class="set-go">›</span></b><small>#${esc(c.set.number || "")}${c.set.total ? "/" + c.set.total : ""}${c.rarity ? " · " + esc(c.rarity) : ""}</small></div></button>` : ""}
      <div class="cd-prices">${p.usd !== undefined && p.usd !== null ? `<span class="price-pill"><small>Market</small><b>${usd(p.usd)}</b></span>` : `<span class="price-pill unknown"><small>Market</small><b>${c.brief ? "…" : "Unknown"}</b></span>`}${p.eur ? `<span class="price-pill"><small>Cardmarket</small><b>€${p.eur.toFixed(2)}</b></span>` : ""}</div>
      ${p.others?.length ? `<p class="small muted">${p.others.map(([k, v]) => `${esc(k)} ${usd(v)}`).join(" · ")}</p>` : ""}
      <p class="foot">${esc(p.source || "")}${p.updated ? " · updated " + esc(new Date(p.updated).toLocaleDateString()) : c.fetchedAt ? " · checked " + esc(new Date(c.fetchedAt).toLocaleDateString()) : ""}</p>
    </div>
  </div>
  ${c.stats?.length ? `<div class="stat-grid">${c.stats.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(String(v))}</b></div>`).join("")}</div>` : ""}
  ${c.text ? `<section class="cd-text"><p class="oracle">${esc(c.text)}</p>${c.illustrator ? `<div class="small muted right">🖌 ${esc(c.illustrator)}</div>` : ""}</section>` : ""}
  ${legalChips(g, c)}
  <p class="small own-line">${own ? `<b class="ok-text">You own ${own}</b>` : "Not in your collection"}</p>
  <div class="actions wrap">
    <button class="btn" data-act="tOwn" data-id="${esc(c.id)}">＋ Add to collection</button>
    ${decks.length ? `<div class="inline-pick"><select id="tToDeck" aria-label="Deck">${options(decks.map((d) => [d.id, d.name]), deck?.id || decks.at(-1).id)}</select><button class="btn ghost" data-act="tAddToDeck" data-id="${esc(c.id)}">Add to deck</button></div>` : `<button class="btn ghost" data-act="tNewDeck">Start a deck</button>`}
  </div>
  ${
    c.game === "ygo" && c.sets?.length
      ? `<section class="prints"><h3>Printings & set prices</h3><div class="list compact">${c.sets
          .slice()
          .sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
          .map((s) => `<button class="mini-row" data-act="tSetByName" data-name="${esc(s.name)}"><span class="ellip"><b>${esc(s.code)}</b> · ${esc(s.name)} <small class="muted">${esc(s.rarity || "")}</small></span><span class="small">${s.price ? usd(s.price) : "—"}</span></button>`)
          .join("")}</div></section>`
      : ""
  }
  ${c.game === "ptcg" && c.variants?.length ? `<section class="prints"><h3>Prices by version</h3><div class="list compact">${c.variants.map((v) => `<div class="mini-row"><span>${esc(v.label)}</span><span class="small">${v.usd ? usd(v.usd) : "—"}</span></div>`).join("")}</div></section>` : ""}
  <div class="links research"><span class="muted small">Buy or research</span>${SOURCES[g].buy(c).map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(l)} ↗</a>`).join("")}</div>
  <p class="foot">Opening a store never changes your collection.</p>`;
}

export function tcgAddSheet(c) {
  const g = c.game,
    opts = g === "ygo" ? c.sets?.map((s) => [s.code + "|" + s.rarity, `${s.code} · ${s.rarity}${s.price ? " · " + usd(s.price) : ""}`]) || [] : c.variants?.map((v) => [v.key, `${v.label}${v.usd ? " · " + usd(v.usd) : ""}`]) || [];
  return `<div class="sheet-head"><h2>Add to collection</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <div class="build-seed">${imgTag(c, "mini-art")}<div><b>${esc(c.name)}</b><small class="muted">${esc(c.typeLine || "")}</small></div><span></span></div>
  <div class="grid2">
    <label>Copies<input id="tQty" type="number" min="1" max="999" value="1"></label>
    <label>Condition<select id="tCond">${options(["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"].map((x) => [x, x]), "Near Mint")}</select></label>
    ${opts.length ? `<label class="span2">${g === "ygo" ? "Printing (set code · rarity)" : "Version"}<select id="tPrint">${options([["", g === "ygo" ? "Not sure / any printing" : "Not sure"], ...opts], "")}</select></label>` : ""}
    <label class="span2">Where it lives<input id="tLoc" maxlength="100" placeholder="Binder, deck box…"></label>
  </div>
  <button class="btn block" data-act="tOwnSave" data-id="${esc(c.id)}">Add to collection</button>`;
}

/* ---------- collection ---------- */

export function tcgCollection() {
  const g = game(),
    U = ui(g).coll,
    st = gs(g),
    v = collectionValue(g),
    q = U.q.trim().toLowerCase();
  let rows = st.collection.map((e) => ({ e, c: cardOf(g, e.cardId) }));
  const setNames = [...new Set(rows.map((x) => setLabel(x)).filter(Boolean))].sort();
  if (q) rows = rows.filter((x) => x.e.name.toLowerCase().includes(q));
  if (U.set) rows = rows.filter((x) => setLabel(x) === U.set);
  const val = (x) => (entryPrice(x.c, x.e) ?? -1) * x.e.qty;
  rows.sort(U.sort === "name" ? (a, b) => a.e.name.localeCompare(b.e.name) : U.sort === "recent" ? (a, b) => String(b.e.addedAt).localeCompare(String(a.e.addedAt)) : U.sort === "set" ? (a, b) => setLabel(a).localeCompare(setLabel(b)) || a.e.name.localeCompare(b.e.name) : (a, b) => val(b) - val(a));
  return `<div class="page-head"><h1>Collection</h1><button class="btn ghost small" data-act="go" data-to="#search">＋ Add cards</button></div>
  <div class="kpis small"><div class="kpi"><b>${usd(v.total, 0)}</b><span>estimated value</span></div><div class="kpi"><b>${v.copies}</b><span>cards</span></div><div class="kpi"><b>${st.collection.length}</b><span>entries</span></div></div>
  ${st.collection.length ? `<div class="toolbar"><input type="search" value="${esc(U.q)}" placeholder="Search your cards" data-input="tCollQ" aria-label="Search collection"><select data-change="tCollSet" aria-label="Set">${options([["", "All sets"], ...setNames.map((x) => [x, x])], U.set)}</select><select data-change="tCollSort" aria-label="Sort">${options([["value", "Value"], ["name", "Name"], ["set", "Set"], ["recent", "Recently added"]], U.sort)}</select></div>
  <div class="row between"><span class="muted small">${rows.length} shown${v.unpriced ? ` · ${v.unpriced} without a price` : ""}</span><button class="btn ghost small" data-act="tRefreshPrices">⟳ Refresh prices</button></div>
  <div class="list">${rows
    .map(({ e, c }) => {
      const p = entryPrice(c, e);
      return `<div class="lot"><button class="lot-art" data-act="tCard" data-id="${esc(e.cardId)}">${imgTag(c)}</button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(e.cardId)}">${esc(e.name)}</button><span class="lot-sub">${esc(setLabel({ e, c }) || "")}${e.printing ? " · " + esc(e.printing) : ""}${e.rarity ? " · " + esc(e.rarity) : ""}${e.variant ? " · " + esc(c?.variants?.find((v) => v.key === e.variant)?.label || e.variant) : ""}${e.condition && e.condition !== "Near Mint" ? " · " + esc(e.condition) : ""}</span></div><div class="lot-side"><span class="price">${p === null ? "—" : usd(p * e.qty)}</span><span class="stepper"><button data-act="tEntryQty" data-id="${esc(e.id)}" data-delta="-1" aria-label="One fewer">−</button><b>${e.qty}</b><button data-act="tEntryQty" data-id="${esc(e.id)}" data-delta="1" aria-label="One more">＋</button></span></div></div>`;
    })
    .join("")}</div>`
  : empty(`No ${esc(GAMES[g].short)} cards yet`, "Search for a card and tap “Add to collection”, or import a list.", `<button class="btn" data-act="go" data-to="#search">Find cards</button><button class="btn ghost" data-act="tImportColl">Paste a list</button>`)}
  ${st.collection.length ? `<div class="actions wrap"><button class="btn ghost small" data-act="tImportColl">↥ Paste a list</button><button class="btn ghost small" data-act="tExportColl">↓ Export CSV</button></div>` : ""}`;
}
const setLabel = ({ e, c }) => (c?.game === "ptcg" ? c?.set?.name || "" : (c?.sets?.find((s) => s.code === e.printing)?.name || ""));

/* ---------- decks ---------- */

export function tcgDecks() {
  const g = game(),
    st = gs(g);
  return `<div class="page-head"><h1>Decks</h1><div class="row"><button class="btn small" data-act="tImport">↥ Import</button><button class="btn ghost small" data-act="tNewDeck">＋ New</button></div></div>
  ${st.decks.length ? `<div class="tdeck-list">${st.decks.slice().reverse().map((d) => deckTile(g, d)).join("")}</div>` : empty("No decks yet", `Pick a format and start adding cards — Cardforge checks deck size, copy limits and the banlist as you go.`, `<button class="btn" data-act="tNewDeck">New deck</button><button class="btn ghost" data-act="tImport">Import a list</button>`)}`;
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
  return `<section class="deck-hero">${imgTag(cover, "hero-art", true)}<div class="hero-shade"></div><div class="hero-body">
    <div class="row between"><button class="icon light" data-act="go" data-to="#decks" aria-label="Back">←</button><button class="icon light" data-act="tDeckMenu" data-id="${esc(d.id)}" aria-label="Deck options">⋯</button></div>
    <h1>${esc(d.name)}</h1><p><button class="chip dark fmt-chip" data-act="tDeckMenu" data-id="${esc(d.id)}">${esc(GAMES[g].short)} · ${esc(f.name)}</button></p>
    <button class="review-badge ${issues.length ? "bad" : "ok"}" data-act="tIssues">${issues.length ? `● ${issues.length} to fix` : s.total ? "✓ Legal in " + esc(f.name) : "Add cards to check legality"}</button>
    <div class="hero-stats"><span><b>${zoneCount("main")}</b>${g === "ygo" ? "main" : "/60 cards"}</span>${g === "ygo" ? `<span><b>${zoneCount("extra")}</b>extra</span>` : ""}<span><b>${s.total ? Math.round((s.owned / s.total) * 100) : 0}%</b>owned</span><span><b>${usd(s.buy, 0)}</b>to finish</span></div>
  </div></section>
  <div class="searchbar deck-add"><input type="search" value="${esc(A.q)}" placeholder="Add a card by name" data-input="tDeckQ" data-enter="tDeckFind" aria-label="Add a card" autocomplete="off"><button class="btn" data-act="tDeckFind" ${A.busy ? "disabled" : ""}>${A.busy ? "…" : "Find"}</button></div>
  ${A.results.length ? `<div class="add-results">${A.results.map((c) => `<div class="mini-row">${imgTag(c, "mini-art")}<span class="ellip">${esc(c.name)}<small class="muted"> ${esc(c.set?.name || c.typeLine || "")}</small></span><button class="btn small" data-act="tDeckAdd" data-id="${esc(c.id)}" data-deck="${esc(d.id)}">＋</button></div>`).join("")}<button class="link small" data-act="tDeckAddClose">Close results</button></div>` : ""}
  ${f.note ? `<p class="small muted">${esc(f.note)}</p>` : ""}
  <div id="tIssuesPanel">${issues.length ? `<section class="panel issues-panel"><h3>To fix</h3><ul class="issues">${issues.map((i) => `<li>${esc(i.text)}</li>`).join("")}</ul></section>` : ""}</div>
  ${zones
    .map(([z, label, rule]) => {
      const rows = s.rows.filter((x) => x.zone === z);
      return `<div class="section-head"><h2>${label} <span class="muted small">${zoneCount(z)} · ${rule}</span></h2></div>${
        rows.length
          ? `<div class="list">${rows
              .sort((a, b) => (a.c?.category || "").localeCompare(b.c?.category || "") || a.r.name.localeCompare(b.r.name))
              .map(({ r, c, need }) => {
                const lim = c ? SOURCES[g].limit(c, f) : 3;
                return `<div class="lot deck-row ${need ? "short" : ""}"><button class="lot-art" data-act="tCard" data-id="${esc(r.cardId)}" data-deck="${esc(d.id)}">${imgTag(c)}<span class="art-price">${usd(price(c))}</span></button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(r.cardId)}" data-deck="${esc(d.id)}">${esc(r.name)}</button><span class="lot-sub">${esc(c?.typeLine?.split(" · ")[0] || "")}${lim === 0 ? ' <span class="tag bad">Forbidden</span>' : lim === 1 && g === "ygo" ? ' <span class="tag warn">Limited</span>' : lim === 2 ? ' <span class="tag warn">Semi-Limited</span>' : ""}${c && SOURCES[g].legality(c, f) === "not_legal" ? ' <span class="tag bad">Not legal</span>' : ""}</span><span class="own ${need ? "no" : "yes"}">${need ? "Need " + need : "Owned"}</span></div><div class="lot-side"><span class="stepper"><button data-act="tDeckQty" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}" data-delta="-1" aria-label="One fewer">−</button><b>${r.qty}</b><button data-act="tDeckQty" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}" data-delta="1" aria-label="One more">＋</button></span>${g === "ygo" ? `<button class="link small" data-act="tDeckMove" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}">${z === "side" ? "→ deck" : "→ side"}</button>` : ""}</div></div>`;
              })
              .join("")}</div>`
          : `<p class="muted small">Empty.</p>`
      }`;
    })
    .join("")}
  <section class="panel">${s.total ? `<div class="row between"><span>${s.total - s.owned} cards to get</span><b>${usd(s.buy)}${s.unknown ? ` + ${s.unknown} unpriced` : ""}</b></div>` : ""}
  <div class="actions wrap"><button class="btn ghost small" data-act="tDeckCopyMissing" data-id="${esc(d.id)}">Copy shopping list</button><button class="btn ghost small" data-act="tDeckExport" data-id="${esc(d.id)}">↓ Export ${SOURCES[g].exportExt === "ydk" ? ".ydk" : "list"}</button><button class="btn ghost small" data-act="tDeckRefresh" data-id="${esc(d.id)}">⟳ Refresh prices</button></div>
  <p class="foot">Owned counts every copy in your ${esc(GAMES[g].short)} collection${g === "ptcg" ? " (Pokémon by exact card; Trainers and Energy by name; basic Energy assumed owned)" : ""}. Prices are daily market estimates.</p></section>`;
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

export function tcgSets() {
  const g = game(),
    U = ui(g).sets,
    q = U.q.trim().toLowerCase(),
    list = U.list.filter((s) => !q || s.name.toLowerCase().includes(q) || String(s.code).toLowerCase() === q),
    owned = ownedBySet(g);
  return `<div class="page-head"><h1>${esc(GAMES[g].short)} sets</h1></div>
  <div class="searchbar"><input type="search" value="${esc(U.q)}" placeholder="Find a set by name or code" data-input="tSetsQ" aria-label="Find a set" autocomplete="off"></div>
  ${U.error ? `<div class="note warn">${esc(U.error)} <button class="link" data-act="tSetsReload">Try again</button></div>` : ""}
  ${U.busy && !U.list.length ? `<p class="muted center pad">Loading every set…</p>` : ""}
  <div class="set-list">${list
    .slice(0, U.limit)
    .map((s) => `<button class="set-row" data-act="tSet" data-id="${esc(s.id)}">${s.image ? `<img class="set-logo" src="${esc(s.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span class="set-row-main"><b class="ellip">${esc(s.name)}</b><small class="muted">${esc(s.code)}${s.series ? " · " + esc(s.series) : ""}${s.date ? " · " + esc(s.date) : ""}</small></span><span class="set-row-count">${owned.get(s.id) ? `<b class="ok-text">${owned.get(s.id)}</b>/` : ""}${s.count}</span></button>`)
    .join("")}</div>
  ${list.length > U.limit ? `<button class="btn ghost block" data-act="tSetsMore">Show more · ${list.length - U.limit} left</button>` : ""}`;
}
function ownedBySet(g) {
  const m = new Map();
  for (const e of gs(g).collection) {
    const c = cardOf(g, e.cardId),
      id = g === "ptcg" ? c?.set?.id : e.printing ? ui(g).sets.list.find((s) => e.printing.startsWith(s.code + "-"))?.id : null;
    if (id) m.set(id, (m.get(id) || 0) + 1);
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
  return `<div class="set-hero">${info?.image ? `<img class="set-logo big" src="${esc(info.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<div class="set-hero-main"><button class="link small" data-act="go" data-to="#sets">← All sets</button><h1>${esc(info?.name || U.id)}</h1><p class="muted small">${info ? `${esc(info.code)}${info.series ? " · " + esc(info.series) : ""}${info.date ? " · " + esc(info.date) : ""} · ${info.count} cards` : ""}</p></div></div>
  ${U.error ? `<div class="note warn">${esc(U.error)}</div>` : ""}
  ${U.cards.length ? `<div class="panel tight"><div class="row between"><span>You own <b>${ownedCount}</b> of ${U.cards.length}</span><b>${Math.round((ownedCount / U.cards.length) * 100)}%</b></div>${bar(ownedCount / U.cards.length, "good")}</div>` : ""}
  <div class="set-controls">${segmented("tSetFilter", U.filter, [["all", "All"], ["owned", "Owned"], ["missing", "Missing"]])}<select data-change="tSetSort" aria-label="Sort">${options([["number", "Set order"], ["price", "Price: high to low"], ["name", "Name"]], U.sort)}</select></div>
  <p class="muted small">${U.busy ? "Loading cards and prices…" : `${list.length} shown · prices are daily market estimates`}</p>
  <div class="card-grid set-grid">${list
    .slice(0, U.limit)
    .map((c) => `<button class="grid-card ${own(c) ? "own" : ""}" data-act="tCard" data-id="${esc(c.id)}">${imgTag(c)}<span class="grid-meta"><span class="ellip">${c.set?.number ? "#" + esc(c.set.number) + " " : ""}${esc(c.name)}</span><span>${c.brief ? "…" : price(c) === null ? "—" : usd(price(c))}</span></span>${own(c) ? `<span class="owned-badge">×${own(c)}</span>` : ""}</button>`)
    .join("")}</div>
  ${list.length > U.limit ? `<button class="btn ghost block" data-act="tSetMore">Show more · ${list.length - U.limit} left</button>` : ""}`;
}

/* ---------- import parsing ---------- */

export function parseLines(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^(#|\/\/|Pokémon:|Pokemon:|Trainer:|Energy:|Total Cards)/i.test(line)) continue;
    const m = line.match(/^(\d+)\s*x?\s+(.+?)$/i);
    out.push(m ? { qty: Number(m[1]), name: m[2].trim() } : { qty: 1, name: line });
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
      const r = await SOURCES[G].search({ q: U.q, ...U.f, sort: U.sort === "price" ? (G === "ygo" ? "name" : "new") : U.sort, page: U.page });
      for (const x of r.cards) remember(x);
      U.results.push(...r.cards);
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
  A.tMore = () => {
    ui().search.page++;
    runSearch(true);
  };
  C.tFilter = (t) => {
    const U = ui().search;
    U.f[t.dataset.field] = t.value;
    if (t.dataset.field !== "format" || g() === "ygo") runSearch();
    else render();
  };
  A.tFilterClear = (t) => {
    const U = ui().search;
    delete U.f[t.dataset.field];
    delete U.f.setName;
    runSearch();
  };
  C.tSort = (t) => {
    const U = ui().search,
      before = U.sort;
    U.sort = t.value;
    if (t.value === "price" || (before === "price" && t.value !== "name" && t.value !== "new")) render();
    else runSearch();
  };
  C.tMax = (t) => {
    ui().search.maxPrice = t.value === "" ? "" : String(Math.max(0, Number(t.value) || 0));
    render();
  };

  // card sheet
  A.tCard = async (t) => {
    const G = g(),
      id = t.dataset.id,
      sctx = { type: "tcard", game: G, id, deckId: t.dataset.deck || (S.ui.view === "tdeck" ? S.ui.tdeckId : null) };
    const known = cardOf(G, id);
    openSheet(known ? tcgCardSheet(known, sctx) : `<div class="sheet-head"><h2>Loading…</h2><button class="icon" data-act="closeSheet">✕</button></div>`, sctx);
    try {
      const card = await ensureCard(G, id);
      if (S.ui.sheetCtx === sctx) openSheet(tcgCardSheet(card, sctx), sctx, document.querySelector("#sheetBody").scrollTop);
    } catch (e) {
      if (S.ui.sheetCtx === sctx) openSheet(`<div class="sheet-head"><h2>Couldn’t load card</h2><button class="icon" data-act="closeSheet">✕</button></div><div class="note warn">${esc(e.message)}</div>`, sctx);
    }
  };
  A.tOwn = (t) => {
    const card = cardOf(g(), t.dataset.id);
    if (card) openSheet(tcgAddSheet(card), { type: "tadd", id: card.id });
  };
  A.tOwnSave = async (t) => {
    const G = g(),
      card = cardOf(G, t.dataset.id),
      qty = Math.max(1, Math.min(999, Math.floor(Number(document.querySelector("#tQty").value) || 1))),
      pr = document.querySelector("#tPrint")?.value || "",
      [printing, rarity] = G === "ygo" && pr ? pr.split("|") : ["", ""];
    await mutate(
      (st) => {
        const same = st.collection.find((e) => e.cardId === card.id && (e.printing || "") === printing && (e.variant || "") === (G === "ptcg" ? pr : "") && e.condition === document.querySelector("#tCond").value);
        if (same) same.qty += qty;
        else st.collection.push({ id: uid(), cardId: card.id, name: card.name, key: SOURCES[G].ownKey(card), qty, printing, rarity, variant: G === "ptcg" ? pr : "", condition: document.querySelector("#tCond").value, location: document.querySelector("#tLoc").value.trim().slice(0, 100), addedAt: new Date().toISOString() });
      },
      { msg: `Added ${qty}× ${card.name}.` },
    );
    closeSheet();
  };
  A.tEntryQty = async (t) => {
    const delta = Number(t.dataset.delta);
    await mutate((st) => {
      const e = st.collection.find((x) => x.id === t.dataset.id);
      if (!e) return;
      e.qty += delta;
      if (e.qty < 1) st.collection = st.collection.filter((x) => x !== e);
    });
  };
  I.tCollQ = (t) => {
    ui().coll.q = t.value;
    c.rerenderKeepingFocus();
  };
  C.tCollSet = (t) => {
    ui().coll.set = t.value;
    render();
  };
  C.tCollSort = (t) => {
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
      rows = [["Quantity", "Name", "Set", "Printing", "Rarity/Version", "Condition", "Price USD"]];
    for (const e of gs(G).collection) {
      const card = cardOf(G, e.cardId);
      rows.push([e.qty, e.name, setLabel({ e, c: card }), e.printing || card?.set?.number || "", e.rarity || e.variant || "", e.condition || "", entryPrice(card, e) ?? ""]);
    }
    download(`Cardforge_${GAMES[G].short.replace(/\W/g, "")}_collection.csv`, rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n", "text/csv");
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
    zone = zone || SOURCES[g()].zoneFor(card);
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
  A.tDeckAddClose = () => {
    ui().deckAdd.results = [];
    render();
  };
  A.tDeckAdd = async (t) => {
    const G = g(),
      card = await ensureCard(G, t.dataset.id).catch(() => cardOf(G, t.dataset.id));
    await mutate((st) => addToDeck(st, t.dataset.deck, card), { msg: `${card.name} added.` });
  };
  A.tDeckQty = async (t) => {
    const delta = Number(t.dataset.delta);
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck),
        list = d?.zones[t.dataset.zone] || [],
        row = list.find((r) => r.cardId === t.dataset.id);
      if (!row) return;
      row.qty += delta;
      if (row.qty < 1) d.zones[t.dataset.zone] = list.filter((r) => r !== row);
    });
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
    });
  };
  A.tIssues = () => document.querySelector("#tIssuesPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  A.tDeckMenu = (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id);
    openSheet(
      `<div class="sheet-head"><h2>Deck options</h2><button class="icon" data-act="closeSheet">✕</button></div>
      <div class="grid2"><label class="span2">Name<input id="tDmName" maxlength="100" value="${esc(d.name)}"></label><label class="span2">Format<select id="tDmFormat">${options(formatsOf(G).map((f) => [f.id, f.name]), d.format)}</select></label></div>
      <button class="btn block" data-act="tDeckSave" data-id="${esc(d.id)}">Save</button>
      <div class="menu-list"><button data-act="tDeckExport" data-id="${esc(d.id)}">↓ Export ${SOURCES[G].exportExt === "ydk" ? ".ydk" : "list"}</button><button data-act="tDeckCopy" data-id="${esc(d.id)}">⧉ Copy list</button><button data-act="tDeckDup" data-id="${esc(d.id)}">⧉ Duplicate</button><button class="danger" data-act="tDeckDelete" data-id="${esc(d.id)}">✕ Delete deck</button></div>`,
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
    if (!confirm("Delete this deck? Your collection isn’t affected.")) return;
    await mutate((st) => (st.decks = st.decks.filter((x) => x.id !== t.dataset.id)), { msg: "Deck deleted." });
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
  A.tDeckCopyMissing = (t) => {
    const G = g(),
      d = gs(G).decks.find((x) => x.id === t.dataset.id),
      s = deckStats(G, d),
      lines = s.rows.filter((x) => x.need).map((x) => `${x.need} ${x.r.name}`);
    if (!lines.length) return toast("You own every card in this deck.");
    copyText(lines.join("\n"), `Copied ${lines.length} cards — paste into TCGplayer Mass Entry or a store’s list.`);
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
    document.querySelector("#tImpText").value = await f.text();
    document.querySelector("#tImpName").value = f.name.replace(/\.[^.]+$/, "");
  };
  // Resolve "qty name" lines to cards; returns { rows: [{card, qty}], missed: [name] }.
  const resolveLines = async (G, lines, status) => {
    const rows = [],
      missed = [];
    let i = 0;
    for (const l of lines) {
      status(`Matching ${++i}/${lines.length}…`);
      const name = G === "ptcg" ? ptcglName(l.name) : l.name;
      try {
        const card = /^[a-z0-9.]+-[A-Za-z0-9]+$/.test(name) && G === "ptcg" ? await ensureCard(G, name) : await SOURCES[G].byName(name);
        if (card) rows.push({ card: remember(card), qty: l.qty });
        else missed.push(name);
      } catch {
        missed.push(name);
      }
    }
    return { rows, missed };
  };
  A.tImpDeck = async (t) => {
    const G = g(),
      text = document.querySelector("#tImpText").value,
      status = (m) => (document.querySelector("#tImpStatus").textContent = m),
      done = busy(t, "Importing…");
    try {
      const d = { id: uid(), name: document.querySelector("#tImpName").value.trim().slice(0, 100) || "Imported deck", format: document.querySelector("#tImpFormat").value, zones: { main: [], extra: [], side: [] }, createdAt: new Date().toISOString() };
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
        const r = await resolveLines(G, lines, status);
        missed = r.missed;
        let zone = null;
        for (const { card, qty } of r.rows) {
          const z = SOURCES[G].zoneFor(card);
          const row = (d.zones[z] ||= []).find((x) => x.cardId === card.id);
          if (row) row.qty += qty;
          else d.zones[z].push({ cardId: card.id, name: card.name, qty });
          void zone;
        }
      }
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
      lines = parseLines(document.querySelector("#tImpText").value),
      status = (m) => (document.querySelector("#tImpStatus").textContent = m),
      done = busy(t, "Importing…");
    try {
      if (!lines.length) throw Error("Paste a list first.");
      const r = await resolveLines(G, lines, status);
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
  const SETS_KEY = (G) => "cardforge-" + G + "-sets-v1";
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
  I.tSetsQ = (t) => {
    ui().sets.q = t.value;
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
