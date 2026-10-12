// Yu-Gi-Oh! and Pokémon: collection, search, sets and deck building, sharing one
// set of screens. Each game's data, rules and formats come from its adapter.
import { S, uid } from "./store.js";
import { esc, usd, empty, bar, options, segmented } from "./ui.js";
import { GAMES, GAME_ICON, GAME_IDS, blankGame, gameOf } from "./games.js";
import { sharePayloadTcg, encodeShare } from "./share.js";
import { factBox, factsFor } from "./facts.js";
import { ygoEmblems, energyIcon, attackLine, tcgSetBadge, ygoPrintBadge, pkRarity, pkSetSymbol } from "./emblems.js";
import { buildYgo, buildPtcg, YGO_STAPLES, PTCG_STAPLES, PTCG_SUPPORT_BASICS, energyName } from "./tcgbuild.js";
import { ygoSource, ygoImageDirect, YGO_TYPES, YGO_ATTRIBUTES, YGO_RACES, YGO_SPELL_KINDS, YGO_TRAP_KINDS } from "./ygo.js";
import { ptcgSource, PTCG_TYPES, PTCG_RARITIES, PTCG_STAGES } from "./ptcg.js";
import { loadMeta, metaState, ptcgIcon } from "./meta.js";
export { metaState };

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
    coll: { q: "", sort: "value", set: "", kind: "", rarity: "" },
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
// Emblems shown on a card: Yu-Gi-Oh! Level/Attribute or Spell/Trap property; Pokémon energy type.
export const gameEmblems = (c) => (!c || c.brief ? "" : c.game === "ygo" ? ygoEmblems(c) : `<span class="emblems">${(c.types || []).map((t) => energyIcon(t)).join("")}${c.hp ? `<span class="hp">HP ${esc(c.hp)}</span>` : ""}</span>`);
// Search tiles stay light: the type emblem plus set/rarity symbols. HP and codes are on the card page.
const tileBadges = (c) => (!c || c.brief ? "" : `<span class="tile-emb">${c.game === "ygo" ? ygoEmblems(c) : `<span class="emblems">${(c.types || []).map((t) => energyIcon(t)).join("")}</span>`}</span>${tcgSetBadge(c, true) ? `<span class="tile-set">${tcgSetBadge(c, true)}</span>` : ""}`);
const rowBadges = (c) => (!c || c.brief ? "" : `${gameEmblems(c)}${tcgSetBadge(c)} `);
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
export function homeHero(g, title, deckArt = null) {
  const h = heroFor(g, deckArt),
    G = GAMES[g];
  return `<section class="home-hero ${g}" id="homeHero">${h?.art ? `<img class="hh-art" src="${esc(h.art)}" alt="" referrerpolicy="no-referrer" onerror="${h.artDirect ? `if(!this.dataset.f){this.dataset.f=1;this.src='${esc(h.artDirect)}'}else ` : ""}this.remove()">` : ""}<div class="hh-shade"></div>
    <div class="hh-body"><p class="eyebrow">${esc(G.name)}</p><h1>${title}</h1>
      <div class="hh-search"><input id="homeQ" type="search" placeholder="Search ${esc(G.short)} cards" data-enter="homeSearch" aria-label="Search ${esc(G.short)} cards" autocomplete="off"><button class="btn" data-act="homeSearch">Search</button></div>
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

// The same shortcuts, in the same order, for every game.
export function quickTiles(g) {
  const mtg = g === "mtg",
    tile = (act, to, icon, title, sub, cls = "") => `<button class="quick-btn ${cls}" data-act="${act}" ${to ? `data-to="${to}"` : ""}><span>${icon}</span><b>${title}</b><small>${sub}</small></button>`;
  return `<div class="quick">
    ${tile("go", "#search", "⌕", "Find cards", "Search, filter by set, type, format and price", "primary")}
    ${tile("go", "#decks/ideas", "✧", "Deck ideas", mtg ? "Commanders your cards support" : "Build from one card, ten, or your whole collection")}
    ${tile("go", "#decks/inspiration", "🏆", mtg ? "Find decks" : "Meta decks", mtg ? "Precons & shared decks you can almost build" : "Today’s tournament decks, with what you own")}
    ${tile(mtg ? "importDeck" : "tImport", "", "↥", "Import a deck", mtg ? "Moxfield, Archidekt, ManaBox or text" : g === "ygo" ? ".ydk file or a text list" : "Pokémon TCG Live list or text")}
    ${tile(mtg ? "addCard" : "tImportColl", "", "＋", "Add cards", "One card or a whole list")}
    ${tile("go", "#sets", "◈", "Browse sets", "Every set, newest first, with your completion")}
    ${tile("go", "#collection", "▦", "Collection & wishlist", "Value, sets, prices, wishlist")}
    ${tile("go", "#rules", "📖", "Rules & banlists", mtg ? "Every format, core rules, live bans" : g === "ygo" ? "Formats, core rules, Forbidden & Limited" : "Formats, core rules, official rules")}
    ${mtg ? tile("go", "#scan", "▧", "Scan a card", "Photo → match → confirm") : ""}
  </div>`;
}
export const randomTools = (g) =>
  g === "mtg"
    ? `<div class="random-tools"><button class="btn ghost" data-act="dbRandom">🎲 Random card</button><button class="btn ghost" data-act="randomDeck">🎲 Random deck</button></div>`
    : `<div class="random-tools"><button class="btn ghost" data-act="tRandomCard">🎲 Random card</button><button class="btn ghost" data-act="tRandomDeck">🎲 Random deck</button></div>`;
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
  return `<section class="panel start"><p class="eyebrow">Start here · about 5 minutes</p><h2>Three steps to your first deck</h2><ol class="steps">
    ${step(1, hasCards, "Add the cards you own", `Paste a list (one card per line, like “3 ${g === "ygo" ? "Ash Blossom & Joyous Spring" : "Ultra Ball"}”) or search and add cards one by one.`, `<button class="btn small" data-act="tImportColl">↥ Paste a list</button><button class="btn ghost small" data-act="go" data-to="#search">⌕ Find cards</button>`)}
    ${step(2, hasDeck, "Pick a deck to aim for", `Copy a tournament deck, build from your own cards at any budget, or import a list.`, `<button class="btn small" data-act="go" data-to="#decks/inspiration">🏆 Meta decks I can almost build</button><button class="btn ghost small" data-act="go" data-to="#decks/ideas">✧ Ideas from my cards</button><button class="btn ghost small" data-act="tImport">Import a deck</button>`)}
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
  const onboarding = !(st.collection.length && st.decks.length);
  return `${homeHero(g, v.copies ? "Welcome back." : "Start your binder.", deckArt)}
  ${gameBinders(g)}
  ${tcgStartPath(g)}
  ${onboarding ? "" : `<div class="kpis">
    <button class="kpi" data-act="go" data-to="#collection"><b>${usd(v.total, 0)}</b><span>collection value${v.unpriced ? ` · ${v.unpriced} unpriced` : ""}</span></button>
    <button class="kpi" data-act="go" data-to="#collection"><b>${v.copies}</b><span>cards owned</span></button>
    <button class="kpi" data-act="go" data-to="#decks"><b>${st.decks.length}</b><span>decks</span></button>
  </div>`}
  ${randomTools(g)}
  ${quickTiles(g)}
  ${recent.length ? `<div class="section-head"><h2>Your decks</h2><button class="link" data-act="go" data-to="#decks">All decks →</button></div><div class="tdeck-list">${recent.map((d) => deckTile(g, d)).join("")}</div>` : ""}
  <p class="muted small">${esc(G.tagline)}. Card data and daily prices from ${esc(G.source)}.</p>`;
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
        ? [["name", "Name"], ["new", "Newest"], ["atkDesc", "ATK: high to low"], ["defDesc", "DEF: high to low"], ["levelDesc", "Level: high to low"], ["price", "Price: high to low"]]
        : [["new", "Newest"], ["name", "Name"], ["price", "Price: high to low"]];
  return `<div class="page-head"><h1>Search ${esc(GAMES[g].short)}</h1><span class="row"><button class="btn ghost small" data-act="go" data-to="#sets">◈ Browse sets</button><button class="btn ghost small" data-act="tRandomCard">🎲 Random card</button></span></div>
  <div class="searchbar"><input type="search" value="${esc(U.q)}" placeholder="${g === "ygo" ? "Card name, e.g. Dark Magician" : "Card name, e.g. Charizard"}" data-input="tQ" data-enter="tSearch" aria-label="Search cards" autocomplete="off"><button class="btn" data-act="tSearch" ${U.busy ? "disabled" : ""}>${U.busy ? "…" : "Search"}</button></div>
  <details class="filters" ${Object.values(U.f).some(Boolean) || U.maxPrice ? "open" : ""}><summary>Filters${Object.values(U.f).some(Boolean) || U.maxPrice ? " · on" : ""}</summary><div class="grid2">
    ${filters}
    <label>Legal in<select data-change="tFilter" data-field="format">${options([["", "Any format"], ...formatsOf(g).map((x) => [x.id, x.name])], fid)}</select></label>
    <label>Sort<select data-change="tSort">${options(sorts, U.sort)}</select></label>
    <label${g === "ygo" ? "" : ' class="span2"'}>Max price $<input type="number" min="0" step="0.5" value="${esc(U.maxPrice)}" placeholder="Any" data-change="tMax"></label>
  </div></details>
  ${U.error ? `<div class="note warn">${esc(U.error)}</div>` : ""}
  ${U.f.set ? `<p class="small">Set: <b>${esc(U.f.setName || U.f.set)}</b> <button class="link small" data-act="tFilterClear" data-field="set">✕ clear</button></p>` : ""}
  ${U.f.archetype ? `<p class="small">Archetype: <b>${esc(U.f.archetype)}</b> <button class="link small" data-act="tFilterClear" data-field="archetype">✕ clear</button></p>` : ""}
  ${
    list.length
      ? `<p class="muted small">${U.total ? U.total.toLocaleString() : list.length + (U.more ? "+" : "")} cards · prices are daily market estimates · “new” = no market price yet</p><div class="card-grid">${list
          .map((c) => {
            const own = ownedOf(g, c, m),
              p = price(c);
            return `<button class="grid-card" data-act="tCard" data-id="${esc(c.id)}">${imgTag(c)}${tileBadges(c)}<span class="grid-meta"><span class="ellip">${esc(c.name)}</span><span>${c.brief ? "…" : p === null ? "new" : usd(p)}</span></span>${own ? `<span class="owned-badge">×${own}</span>` : ""}</button>`;
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
    tab = sctx.tab || "overview",
    own = ownedOf(g, c),
    decks = gs(g).decks,
    deck = sctx.deckId ? decks.find((d) => d.id === sctx.deckId) : null,
    p = c.prices || {},
    f = deck ? formatOf(g, deck.format) : null,
    wished = gs(g).wishlist.some((w) => w.cardId === c.id),
    heroSrc = g === "ygo" ? c.art || c.imageLarge : c.imageLarge || c.image,
    heroFallback = g === "ygo" ? c.artDirect || "" : "";
  const overview = `
    <div class="cs-card"><div class="cd-img">${imgTag(c, "card-img", true)}</div>
      <div class="cs-card-side">
        <p class="small own-line">${own ? `<b class="ok-text">You own ${own}</b>` : "Not in your collection"}</p>
        ${deck ? `<p class="small deck-legal ${SOURCES[g].legality(c, f) === "legal" ? "ok-text" : "bad-text"}">${SOURCES[g].legality(c, f) === "legal" ? "✓ Legal" : "● Not allowed"} in ${esc(f.name)} <span class="muted">(${esc(deck.name)})</span></p>` : ""}
        ${c.stats?.length ? `<div class="stat-grid">${c.stats.filter(([k]) => g !== "ptcg" || !["HP", "Type", "Weakness", "Resistance", "Retreat"].includes(k)).map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(String(v))}</b></div>`).join("")}</div>` : ""}
      </div></div>
    <div class="actions wrap">
      <button class="btn" data-act="tOwn" data-id="${esc(c.id)}">＋ Add to collection</button>
      <button class="btn ghost" data-act="tWish" data-id="${esc(c.id)}">${wished ? "♥ On wishlist" : "♡ Wishlist"}</button>
      <button class="btn ghost" data-act="tBuild" data-id="${esc(c.id)}">⚒ Build decks</button>
      ${sctx.random ? `<button class="btn ghost" data-act="tRandomCard">🎲 Another</button>` : ""}
    </div>
    ${decks.length ? `<div class="inline-pick"><select id="tToDeck" aria-label="Deck">${options(decks.map((d) => [d.id, d.name]), deck?.id || decks.at(-1).id)}</select><button class="btn ghost" data-act="tAddToDeck" data-id="${esc(c.id)}">Add to deck</button></div>` : `<button class="btn ghost" data-act="tNewDeck">Start a deck</button>`}
    ${factBox(factsFor(c), c.id)}`;
  const versions =
    g === "ygo"
      ? c.sets?.length
        ? `<div class="list compact">${c.sets
            .slice()
            .sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
            .map((s) => `<button class="mini-row" data-act="tSetByName" data-name="${esc(s.name)}"><span class="ellip">${ygoPrintBadge(s)} ${esc(s.name)} <small class="muted">${esc(s.rarity || "")}</small></span><span class="small">${s.price ? usd(s.price) : "—"}</span></button>`)
            .join("")}</div><p class="foot">${c.sets.length} printings. Tap one to see the whole set.</p>`
        : `<p class="muted small">No printings listed.</p>`
      : c.set
        ? `<div class="list compact"><button class="mini-row" data-act="tSet" data-id="${esc(c.set.id)}"><span class="ellip">${pkSetSymbol(c.set)} <b>${esc(c.set.name)}</b> · #${esc(c.set.number || "")} <small class="muted">${esc(c.rarity || "")}</small></span><span class="small">${usd(p.usd)}</span></button></div><p class="foot">Pokémon reprints are separate cards with their own number. <button class="link small" data-act="tOtherPrintings" data-name="${esc(c.name)}">See every “${esc(c.name)}” →</button></p>`
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
  <div class="cs-hero ${g}">${heroSrc ? `<img class="cs-art" src="${esc(heroSrc)}" alt="${esc(c.name)}" referrerpolicy="no-referrer" onerror="${heroFallback ? `if(!this.dataset.f){this.dataset.f=1;this.src='${esc(heroFallback)}'}else ` : ""}this.remove()">` : ""}<div class="cs-shade"></div></div>
  <div class="cs-title"><div><h2>${esc(c.name)}</h2><p class="type-line">${esc(c.typeLine || "")}</p></div>${gameEmblems(c)}</div>
  <div class="cs-meta">
    ${c.set ? `<button class="cd-set" data-act="tSet" data-id="${esc(c.set.id)}">${pkSetSymbol(c.set, "pks big")}<div><b>${esc(c.set.name)} <span class="set-go">›</span></b><small>#${esc(c.set.number || "")}${c.set.total ? "/" + c.set.total : ""}${c.rarity ? ` · ${pkRarity(c.rarity)} ${esc(c.rarity)}` : ""}</small></div></button>` : c.archetype ? `<button class="cd-set" data-act="tArchetype" data-name="${esc(c.archetype)}"><div><b>${esc(c.archetype)} <span class="set-go">›</span></b><small>Archetype · ${c.sets?.length || 0} printings</small></div></button>` : ""}
    <div class="cd-prices"><button class="price-pill" data-act="cardTab" data-tab="prices"><small>Market</small><b>${p.usd !== null && p.usd !== undefined ? usd(p.usd) : c.brief ? "…" : "New"}</b><span class="buy-hint">Prices ›</span></button>${p.eur ? `<button class="price-pill" data-act="cardTab" data-tab="prices"><small>Cardmarket</small><b>€${p.eur.toFixed(2)}</b></button>` : ""}</div>
  </div>
  ${g === "ptcg" && !c.brief ? pokemonText(c) : c.text ? `<section class="cd-text"><p class="oracle">${esc(c.text)}</p>${c.illustrator ? `<div class="small muted right">🖌 ${esc(c.illustrator)}</div>` : ""}</section>` : ""}
  ${tabs(tab, [["overview", "Overview"], ["versions", "Versions"], ["prices", "Prices"], ["rulings", "Rulings"], ["legal", "Legality"]])}
  ${panel("overview", tab, overview)}
  ${panel("versions", tab, versions)}
  ${panel("prices", tab, prices + `<p class="foot">${esc(p.source || "")}${p.updated ? " · updated " + esc(new Date(p.updated).toLocaleDateString()) : c.fetchedAt ? " · checked " + esc(new Date(c.fetchedAt).toLocaleDateString()) : ""}. Condition prices and stock are on the store’s page.</p>` + buy)}
  ${panel("rulings", tab, rulings)}
  ${panel("legal", tab, legal)}`;
}
// Pokémon card text laid out like the card: abilities, attacks with Energy costs, then the bottom strip.
function pokemonText(c) {
  const strip = [
    c.weak?.length ? `<span>Weakness ${c.weak.map((w) => energyIcon(w.type, "sm") + esc(w.value)).join(" ")}</span>` : "",
    c.resist?.length ? `<span>Resistance ${c.resist.map((w) => energyIcon(w.type, "sm") + esc(w.value)).join(" ")}</span>` : "",
    c.retreat !== null && c.retreat !== undefined && c.category === "Pokemon" ? `<span>Retreat ${c.retreat ? Array(c.retreat).fill(energyIcon("Colorless", "sm")).join("") : "0"}</span>` : "",
  ].filter(Boolean);
  return `<section class="cd-text pk">
    ${(c.abilities || []).map((a) => `<div class="pk-ability"><span class="pk-tag">${esc(a.type)}</span> <b>${esc(a.name)}</b><p>${esc(a.effect)}</p></div>`).join("")}
    ${(c.attacks || []).map((a) => `<div class="pk-attack"><div class="row between"><span class="row">${attackLine(a.cost)}<b>${esc(a.name)}</b></span>${a.damage !== "" ? `<b class="dmg">${esc(a.damage)}</b>` : ""}</div>${a.effect ? `<p>${esc(a.effect)}</p>` : ""}</div>`).join("")}
    ${c.effect ? `<p class="oracle">${esc(c.effect)}</p>` : ""}
    ${!c.attacks?.length && !c.abilities?.length && !c.effect && c.text ? `<p class="oracle">${esc(c.text)}</p>` : ""}
    ${strip.length ? `<div class="pk-strip">${strip.join("")}</div>` : ""}
    ${c.flavor ? `<p class="flavor">${esc(c.flavor)}</p>` : ""}
    ${c.illustrator ? `<div class="small muted right">🖌 ${esc(c.illustrator)}</div>` : ""}
  </section>`;
}
const tabs = (tab, items) => `<nav class="cs-tabs" role="tablist">${items.map(([id, label]) => `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? "on" : ""}" data-act="cardTab" data-tab="${id}">${label}</button>`).join("")}</nav>`;
const panel = (id, tab, html) => `<div class="cs-panel" data-tab="${id}" ${id === tab ? "" : "hidden"}>${html}</div>`;

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
  const rarityOf = (x) => x.e.rarity || x.c?.rarity || "",
    rarities = [...new Set(st.collection.map((e) => rarityOf({ e, c: cardOf(g, e.cardId) })).filter(Boolean))].sort(),
    kinds = g === "ygo" ? [["Monster", "Monsters"], ["Spell", "Spells"], ["Trap", "Traps"], ["extra", "Extra Deck"], ...YGO_ATTRIBUTES.map((a) => ["attr:" + a, a])] : [["Pokemon", "Pokémon"], ["Trainer", "Trainers"], ["Energy", "Energy"], ...PTCG_TYPES.map((t) => ["type:" + t, t + " type"])],
    kindOk = (c, k) => !k || (!!c && (k === "extra" ? !!c.extra : k.startsWith("attr:") ? c.attribute === k.slice(5) : k.startsWith("type:") ? (c.types || []).includes(k.slice(5)) : c.category === k));
  if (U.kind) rows = rows.filter((x) => kindOk(x.c, U.kind));
  if (U.rarity) rows = rows.filter((x) => rarityOf(x) === U.rarity);
  const val = (x) => (entryPrice(x.c, x.e) ?? -1) * x.e.qty;
  rows.sort(U.sort === "name" ? (a, b) => a.e.name.localeCompare(b.e.name) : U.sort === "recent" ? (a, b) => String(b.e.addedAt).localeCompare(String(a.e.addedAt)) : U.sort === "set" ? (a, b) => setLabel(a).localeCompare(setLabel(b)) || a.e.name.localeCompare(b.e.name) : U.sort === "rarity" ? (a, b) => rarityOf(a).localeCompare(rarityOf(b)) || a.e.name.localeCompare(b.e.name) : (a, b) => val(b) - val(a));
  if (U.tab === "wishlist") return tcgWishlist(g);
  return `<div class="page-head"><h1>Collection</h1><button class="btn ghost small" data-act="go" data-to="#search">＋ Add cards</button></div>
  ${segmented("tCollTab", "cards", [["cards", "My cards"], ["wishlist", `Wishlist · ${st.wishlist.length}`]])}
  <div class="kpis small"><div class="kpi"><b>${usd(v.total, 0)}</b><span>estimated value</span></div><div class="kpi"><b>${v.copies}</b><span>cards</span></div><div class="kpi"><b>${st.collection.length}</b><span>entries</span></div></div>
  ${st.collection.length ? `<div class="toolbar"><input type="search" value="${esc(U.q)}" placeholder="Search your cards" data-input="tCollQ" aria-label="Search collection"><select data-change="tCollSet" aria-label="Set">${options([["", "All sets"], ...setNames.map((x) => [x, x])], U.set)}</select><select data-change="tCollKind" data-field="kind" aria-label="Kind">${options([["", "All kinds"], ...kinds], U.kind)}</select>${rarities.length > 1 ? `<select data-change="tCollKind" data-field="rarity" aria-label="Rarity">${options([["", "All rarities"], ...rarities.map((x) => [x, x])], U.rarity)}</select>` : ""}<select data-change="tCollSort" aria-label="Sort">${options([["value", "Value"], ["name", "Name"], ["set", "Set"], ["rarity", "Rarity"], ["recent", "Recently added"]], U.sort)}</select></div>
  <div class="row between"><span class="muted small">${rows.length} shown${v.unpriced ? ` · ${v.unpriced} without a price` : ""}</span><button class="btn ghost small" data-act="tRefreshPrices">⟳ Refresh prices</button></div>
  <div class="list">${rows
    .map(({ e, c }) => {
      const p = entryPrice(c, e);
      return `<div class="lot"><button class="lot-art" data-act="tCard" data-id="${esc(e.cardId)}">${imgTag(c)}</button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(e.cardId)}">${esc(e.name)}</button><span class="lot-sub">${rowBadges(c)}${esc(setLabel({ e, c }) || "")}${e.printing ? " · " + esc(e.printing) : ""}${e.rarity ? " · " + esc(e.rarity) : ""}${e.variant ? " · " + esc(c?.variants?.find((v) => v.key === e.variant)?.label || e.variant) : ""}${e.condition && e.condition !== "Near Mint" ? " · " + esc(e.condition) : ""}</span></div><div class="lot-side"><span class="price">${p === null ? "—" : usd(p * e.qty)}</span><span class="stepper"><button data-act="tEntryQty" data-id="${esc(e.id)}" data-delta="-1" aria-label="One fewer">−</button><b>${e.qty}</b><button data-act="tEntryQty" data-id="${esc(e.id)}" data-delta="1" aria-label="One more">＋</button></span></div></div>`;
    })
    .join("")}</div>`
  : empty(`No ${esc(GAMES[g].short)} cards yet`, "Search for a card and tap “Add to collection”, or import a list.", `<button class="btn" data-act="go" data-to="#search">Find cards</button><button class="btn ghost" data-act="tImportColl">Paste a list</button>`)}
  ${st.collection.length ? `<div class="actions wrap"><button class="btn ghost small" data-act="tImportColl">↥ Paste a list</button><button class="btn ghost small" data-act="tExportColl">↓ Export CSV</button></div>` : ""}`;
}
function tcgWishlist(g) {
  const st = gs(g),
    rows = st.wishlist.map((w) => ({ w, c: cardOf(g, w.cardId) })),
    total = rows.reduce((a, x) => a + (price(x.c) ?? 0) * (x.w.qty || 1), 0);
  return `<div class="page-head"><h1>Collection</h1><button class="btn ghost small" data-act="go" data-to="#search">＋ Find cards</button></div>
  ${segmented("tCollTab", "wishlist", [["cards", "My cards"], ["wishlist", `Wishlist · ${st.wishlist.length}`]])}
  ${rows.length ? `<div class="kpis small"><div class="kpi"><b>${rows.length}</b><span>cards wanted</span></div><div class="kpi"><b>${usd(total, 0)}</b><span>to buy them all</span></div><div class="kpi"><b>${rows.filter((x) => (price(x.c) ?? 1e9) <= 1).length}</b><span>under $1</span></div></div>
  <div class="list">${rows
    .sort((a, b) => (price(b.c) ?? -1) - (price(a.c) ?? -1))
    .map(({ w, c }) => `<div class="lot"><button class="lot-art" data-act="tCard" data-id="${esc(w.cardId)}">${imgTag(c)}</button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(w.cardId)}">${esc(w.name)}</button><span class="lot-sub">${rowBadges(c)}${esc(c?.set?.name || "")}</span></div><div class="lot-side"><span class="price">${usd(price(c))}</span><button class="link small danger" data-act="tWish" data-id="${esc(w.cardId)}">Remove</button></div></div>`)
    .join("")}</div>
  <div class="actions wrap"><button class="btn ghost small" data-act="tWishCopy">Copy shopping list</button></div>`
  : empty("Your wishlist is empty", "Tap ♡ Wishlist on any card to keep track of what you want — with live prices.", `<button class="btn" data-act="go" data-to="#search">Find cards</button>`)}`;
}
const setLabel = ({ e, c }) => (c?.game === "ptcg" ? c?.set?.name || "" : (c?.sets?.find((s) => s.code === e.printing)?.name || ""));

/* ---------- decks ---------- */

export function tcgDecks() {
  const g = game(),
    st = gs(g),
    tab = ["ideas", "inspiration"].includes(S.ui.decksTab) ? S.ui.decksTab : "mine";
  return `<div class="page-head"><h1>Decks</h1><div class="row"><button class="btn small" data-act="tImport">↥ Import</button><button class="btn ghost small" data-act="tNewDeck">＋ New</button></div></div>
  ${segmented("decksTab", tab, [["mine", "My decks"], ["ideas", "Ideas"], ["inspiration", "Meta decks"]])}
  <div class="random-tools"><button class="btn ghost small" data-act="tRandomDeck">🎲 Random deck</button><button class="btn ghost small" data-act="tRandomCard">🎲 Random card</button></div>
  ${tab === "ideas" ? ideasView(g) : tab === "inspiration" ? metaView(g) : st.decks.length ? `<div class="tdeck-list">${st.decks.slice().reverse().map((d) => deckTile(g, d)).join("")}</div>` : empty("No decks yet", `Pick a format and start adding cards, build from cards you own in Ideas, or copy a tournament deck from Meta decks.`, `<button class="btn" data-act="decksTab" data-id="ideas">✧ Ideas from my cards</button><button class="btn ghost" data-act="decksTab" data-id="inspiration">🏆 Meta decks</button>`)}`;
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
    return { have, total, pct: total ? have / total : 0, cost: unpriced > 3 ? null : cost };
  }
  const byName = new Map();
  for (const e of gs(g).collection) byName.set(e.name.toLowerCase(), (byName.get(e.name.toLowerCase()) || 0) + e.qty);
  for (const r of d.list) {
    total += r.qty;
    have += isBasicEnergyName(r.name) ? r.qty : Math.min(r.qty, byName.get(r.name.toLowerCase()) || 0);
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
    <span class="meta-main"><b class="ellip">${esc(d.name)}</b><small class="muted ellip">${esc(d.place)} · ${esc(d.event)}${d.players ? ` · ${d.players} players` : ""}</small>
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
    return `${empty("Ideas come from your cards", `Add the ${esc(GAMES[g].short)} cards you own and Cardforge finds the ${g === "ygo" ? "archetypes" : "Pokémon"} they support, matches them against today’s tournament decks, and builds lists at every budget.`, `<button class="btn" data-act="tImportColl">↥ Paste a list</button><button class="btn ghost" data-act="go" data-to="#search">Find cards</button><button class="btn ghost" data-act="decksTab" data-id="inspiration">🏆 Meta decks</button>`)}`;
  return `<section class="panel build-own"><h3>Build from my cards</h3><p class="muted small">One card, ten or your whole binder — Cardforge keeps your cards, fills gaps with what today’s tournament decks play, and shows every budget from “cards I own” to “no limit”.</p>
    <div class="actions wrap"><button class="btn" data-act="tBuildAuto">⚒ Use my whole collection</button><button class="btn ghost" data-act="tPickSeeds">☑ Pick cards to build around</button></div></section>
  ${groups.length ? `<div class="section-head"><h2>${g === "ygo" ? "Archetypes you own" : "Pokémon you can build around"}</h2></div><div class="list">${groups
    .slice(0, 12)
    .map((x) => `<div class="lot idea-row"><button class="lot-art" data-act="tCard" data-id="${esc(x.cover.id)}">${imgTag(x.cover)}</button><div class="lot-info"><b class="lot-name">${esc(x.name)}</b><span class="lot-sub">${x.ids.length} card${x.ids.length === 1 ? "" : "s"} · ${x.copies} cop${x.copies === 1 ? "y" : "ies"}${x.metaText ? ` · <span class="ok-text">${esc(x.metaText)}</span>` : ""}</span></div><div class="lot-side"><button class="btn small" data-act="tBuildMulti" data-ids="${esc(x.ids.join(","))}">⚒ Build</button></div></div>`)
    .join("")}</div>` : `<p class="muted small">Loading your cards’ details… If this stays empty, open your Collection once so Cardforge can read them.</p>`}
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
    .map((a) => `<button class="arch" data-act="tMetaDeck" data-key="${esc(a.best)}" ${a.best ? "" : "disabled"}><span class="arch-icons">${g === "ptcg" ? a.icons.map((i) => `<img class="pk-icon" src="${esc(ptcgIcon(i))}" alt="" loading="lazy" onerror="this.remove()">`).join("") : ""}</span><b class="ellip">${esc(a.name)}</b><small>${g === "ptcg" ? `${(a.share * 100).toFixed(1)}% of players · ${a.top8} in Top 8` : `${a.count} top finish${a.count === 1 ? "" : "es"}`}</small>${bar(a.share / (data.archetypes[0]?.share || 1))}</button>`)
    .join("")}</div>
  <div class="section-head"><h2>Most played cards</h2></div>
  <div class="chips wrap">${top.map((t) => `<button class="chip" ${g === "ygo" ? `data-act="tCard" data-id="${esc(t.id)}"` : `data-act="tOtherPrintings" data-name="${esc(t.name)}"`}>${esc(t.name)} <span class="muted">${Math.round(t.pct)}%</span></button>`).join("")}</div>
  <div class="section-head"><h2>Recent top lists</h2></div>
  <div class="list">${data.decks.slice(0, 40).map((d) => metaDeckRow(g, d, m)).join("")}</div>
  <p class="foot">${g === "ygo" ? "Lists from YGOPRODeck’s Tournament Meta Decks (WCQ Regionals, YCS and more)." : "Top 8 lists from the biggest recent Standard events on Limitless."} “Owned” matches your collection${g === "ptcg" ? " by card name; basic Energy counts as owned" : ""}.</p>`;
}

export function tcgMetaSheet(g, d) {
  const m = ownedMap(g),
    o = metaOwned(g, d, m);
  let body;
  if (g === "ygo") {
    const zone = (title, list) => {
      const counts = new Map();
      for (const id of list) counts.set(id, (counts.get(id) || 0) + 1);
      return list.length
        ? `<p class="list-head">${title} <span class="muted">${list.length}</span></p><div class="list compact">${[...counts]
            .map(([id, qty]) => {
              const card = cardOf("ygo", id),
                own = Math.min(qty, m.get("id:" + id) || 0);
              return `<button class="mini-row" data-act="tCard" data-id="${esc(id)}"><span class="ellip">${qty}× ${card ? `${ygoEmblems(card)} ${esc(card.name)}` : "…"}</span><span class="small ${own >= qty ? "ok-text" : "muted"}">${own >= qty ? "✓ owned" : own ? `${own}/${qty}` : price(card) !== null ? usd(price(card) * qty) : ""}</span></button>`;
            })
            .join("")}</div>`
        : "";
    };
    body = zone("Main Deck", d.main) + zone("Extra Deck", d.extra) + zone("Side Deck", d.side);
  } else {
    const byName = new Map();
    for (const e of gs(g).collection) byName.set(e.name.toLowerCase(), (byName.get(e.name.toLowerCase()) || 0) + e.qty);
    body = ["Pokemon", "Trainer", "Energy"]
      .map((k) => {
        const rows = d.list.filter((r) => r.kind === k);
        return rows.length
          ? `<p class="list-head">${k === "Pokemon" ? "Pokémon" : k} <span class="muted">${rows.reduce((a, r) => a + r.qty, 0)}</span></p><div class="list compact">${rows
              .map((r) => {
                const own = isBasicEnergyName(r.name) ? r.qty : Math.min(r.qty, byName.get(r.name.toLowerCase()) || 0);
                return `<button class="mini-row" data-act="tOtherPrintings" data-name="${esc(r.name)}"><span class="ellip">${r.qty}× ${esc(r.name)} <small class="muted">${esc(r.set)} ${esc(r.number)}</small></span><span class="small ${own >= r.qty ? "ok-text" : "muted"}">${own >= r.qty ? "✓ owned" : own ? `${own}/${r.qty}` : ""}</span></button>`;
              })
              .join("")}</div>`
          : "";
      })
      .join("");
  }
  return `<div class="sheet-head"><h2>${esc(d.name)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <p class="muted small">🏆 ${esc(d.place)} · ${esc(d.event)}${d.players ? ` · ${d.players} players` : ""}${d.player ? ` · ${esc(d.player)}` : ""}${d.date ? ` · ${esc(d.date)}` : ""}</p>
  <div class="kpis small"><div class="kpi"><b>${Math.round(o.pct * 100)}%</b><span>you own</span></div><div class="kpi"><b>${o.have}/${o.total}</b><span>cards</span></div><div class="kpi"><b>${o.cost !== null ? usd(o.cost, 0) : "—"}</b><span>to finish</span></div></div>
  <div class="actions wrap"><button class="btn" data-act="tMetaSave" data-key="${esc(d.key)}">Save as my deck</button><button class="btn ghost" data-act="tMetaBuild" data-key="${esc(d.key)}">⚒ Budget versions</button>${d.url ? `<a class="btn ghost" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>` : ""}</div>
  <p class="small muted" id="metaStatus" role="status"></p>
  ${body}
  <p class="foot">“Budget versions” builds around this deck’s signature cards at every budget, starting with the cards you own.</p>`;
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
  return `<section class="deck-hero">${imgTag(cover, "hero-art", true)}<div class="hero-shade"></div><div class="hero-body">
    <div class="row between"><button class="icon light" data-act="go" data-to="#decks" aria-label="Back">←</button><button class="icon light" data-act="tDeckMenu" data-id="${esc(d.id)}" aria-label="Deck options">⋯</button></div>
    <h1>${esc(d.name)}</h1><p><button class="chip dark fmt-chip" data-act="tDeckMenu" data-id="${esc(d.id)}">${esc(GAMES[g].short)} · ${esc(f.name)}</button></p>
    <button class="review-badge ${issues.length ? "bad" : "ok"}" data-act="tIssues" data-deck="${esc(d.id)}">${issues.length ? `● ${issues.length} to fix` : s.total ? "✓ Legal in " + esc(f.name) : "Add cards to check legality"}</button>
    <div class="hero-stats"><span><b>${zoneCount("main")}</b>${g === "ygo" ? "main" : "/60 cards"}</span>${g === "ygo" ? `<span><b>${zoneCount("extra")}</b>extra</span>` : ""}<span><b>${s.total ? Math.round((s.owned / s.total) * 100) : 0}%</b>owned</span><span><b>${usd(s.buy, 0)}</b>to finish</span></div>
  </div></section>
  <nav class="tabs" role="tablist">${[["cards", "Cards"], ["insights", "Insights"], ["playtest", "Playtest"], ["versions", "Versions"]].map(([id, l]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? "on" : ""}" data-act="tDeckTab" data-deck="${esc(d.id)}" data-id="${id}">${l}</button>`).join("")}</nav>
  <div class="deck-body">${tab === "insights" ? deckInsights(g, d, f, s) : tab === "playtest" ? deckPlaytest(g, d, f) : tab === "versions" ? deckVersions(g, d) : deckCardsTab(g, d, f, s, issues)}</div>`;
}

function deckCardsTab(g, d, f, s, issues) {
  const A = ui(g).deckAdd,
    zones = g === "ygo" ? [["main", "Main Deck", `${f.main[0]}–${f.main[1]}`], ["extra", "Extra Deck", `0–${f.extra}`], ["side", "Side Deck", `0–${f.side}`]] : [["main", "Deck", "60"]],
    zoneCount = (z) => (d.zones[z] || []).reduce((a, r) => a + r.qty, 0);
  return `<div class="searchbar deck-add"><input type="search" value="${esc(A.q)}" placeholder="Add a card by name" data-input="tDeckQ" data-enter="tDeckFind" aria-label="Add a card" autocomplete="off"><button class="btn" data-act="tDeckFind" ${A.busy ? "disabled" : ""}>${A.busy ? "…" : "Find"}</button></div>
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
                return `<div class="lot deck-row ${need ? "short" : ""}"><button class="lot-art" data-act="tCard" data-id="${esc(r.cardId)}" data-deck="${esc(d.id)}">${imgTag(c)}<span class="art-price">${usd(price(c))}</span></button><div class="lot-info"><button class="lot-name" data-act="tCard" data-id="${esc(r.cardId)}" data-deck="${esc(d.id)}">${esc(r.name)}</button><span class="lot-sub">${rowBadges(c)}${lim === 0 ? ' <span class="tag bad">Forbidden</span>' : lim === 1 && g === "ygo" ? ' <span class="tag warn">Limited</span>' : lim === 2 ? ' <span class="tag warn">Semi-Limited</span>' : ""}${c && SOURCES[g].legality(c, f) === "not_legal" ? ' <span class="tag bad">Not legal</span>' : ""}</span><span class="own ${need ? "no" : "yes"}">${need ? "Need " + need : "Owned"}</span></div><div class="lot-side"><span class="stepper"><button data-act="tDeckQty" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}" data-delta="-1" aria-label="One fewer">−</button><b>${r.qty}</b><button data-act="tDeckQty" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}" data-delta="1" aria-label="One more">＋</button></span>${g === "ygo" ? `<button class="link small" data-act="tDeckMove" data-deck="${esc(d.id)}" data-zone="${z}" data-id="${esc(r.cardId)}">${z === "side" ? "→ deck" : "→ side"}</button>` : ""}</div></div>`;
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

/* ----- deck insights: composition and real probability math ----- */

// Chance of drawing at least one of `k` copies in `n` cards from a deck of `N`.
export const atLeastOne = (N, k, n) => {
  if (k <= 0 || N <= 0) return 0;
  let none = 1;
  for (let i = 0; i < n; i++) none *= Math.max(0, N - k - i) / (N - i);
  return 1 - none;
};
const pctTxt = (x) => Math.round(x * 100) + "%";

function deckInsights(g, d, f, s) {
  const main = (d.zones.main || []).map((r) => ({ r, c: cardOf(g, r.cardId) })),
    N = main.reduce((a, x) => a + x.r.qty, 0),
    top = [...s.rows].filter((x) => x.c && price(x.c)).sort((a, b) => price(b.c) - price(a.c)).slice(0, 5),
    starters = new Set(d.starters || []);
  if (!N) return `<p class="muted pad">Add cards to see composition and odds.</p>`;
  const bars = (items) => `<div class="comp">${items.map(([label, n, total, note]) => `<div class="meter"><span>${esc(label)}</span>${bar(total ? n / total : 0)}<b>${n}</b></div>${note ? `<p class="foot">${note}</p>` : ""}`).join("")}</div>`;
  const oddsRow = (x, hands) => `<tr><td><label class="check"><input type="checkbox" data-change="tStarter" data-deck="${esc(d.id)}" data-id="${esc(x.r.cardId)}" ${starters.has(x.r.cardId) ? "checked" : ""}> ${esc(x.r.name)}</label></td><td class="num">${x.r.qty}</td>${hands.map((n) => `<td class="num">${pctTxt(atLeastOne(N, x.r.qty, n))}</td>`).join("")}</tr>`;
  const starterK = main.filter((x) => starters.has(x.r.cardId)).reduce((a, x) => a + x.r.qty, 0);
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
    return `<section class="panel"><h3>Main Deck · ${N} cards</h3>${bars([["Monsters", count("Monster"), N], ["Spells", count("Spell"), N], ["Traps", count("Trap"), N]])}
      ${Object.keys(extraKinds).length ? `<p class="small">Extra Deck: ${Object.entries(extraKinds).map(([k, n]) => `${n} ${esc(k[0].toUpperCase() + k.slice(1))}`).join(" · ")}</p>` : ""}</section>
    <section class="panel"><h3>Monster levels</h3>${levelChart(levels)}<p class="foot">Level 5–6 monsters need 1 Tribute, 7+ need 2, unless their text says otherwise.</p></section>
    <section class="panel"><div class="row between"><h3>Opening-hand odds</h3>${starterK ? `<span class="chip ok">${pctTxt(atLeastOne(N, starterK, 5))} to open a starter</span>` : ""}</div>
      <p class="muted small">Chance to draw at least one copy. Going first you draw 5; going second you draw 6 on your first turn. Tick your <b>starters</b> (cards that begin your combo) to see the chance of opening one of them.</p>
      <table class="metrics"><thead><tr><th>Card</th><th class="num">Copies</th><th class="num">First (5)</th><th class="num">Second (6)</th></tr></thead><tbody>${main.sort((a, b) => b.r.qty - a.r.qty || a.r.name.localeCompare(b.r.name)).map((x) => oddsRow(x, [5, 6])).join("")}</tbody></table>
      ${starterK ? `<p class="small">With ${starterK} starter${starterK > 1 ? "s" : ""}: <b>${pctTxt(atLeastOne(N, starterK, 5))}</b> going first, <b>${pctTxt(atLeastOne(N, starterK, 6))}</b> going second. ${N > 40 ? `At 40 cards it would be ${pctTxt(atLeastOne(40, starterK, 5))}.` : ""}</p>` : ""}
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
  return `<section class="panel"><h3>${N} cards</h3>${bars([["Pokémon", cat("Pokemon"), N], ["Trainers", cat("Trainer"), N], ["Energy", cat("Energy"), N]])}<p class="foot">Many competitive decks run roughly 12–20 Pokémon, 30–40 Trainers and 8–14 Energy — a guideline, not a rule.</p></section>
  <section class="panel"><h3>Opening hand</h3>
    <p><b>${basics}</b> Basic Pokémon → <b class="${mull > 0.2 ? "warn-text" : "ok-text"}">${pctTxt(mull)}</b> chance an opening 7 has none (a mulligan; your opponent may draw a card).</p>
    ${broken.length ? `<div class="note warn">${broken.map((x) => `${esc(x.r.name)} evolves from <b>${esc(x.c.evolveFrom)}</b>, which isn’t in the deck${x.c.stage === "Stage2" && hasCandy ? " (Rare Candy can skip it, but you still need the Basic)" : ""}.`).join("<br>")}</div>` : `<p class="small ok-text">✓ Every evolution has the card it evolves from.</p>`}
    ${needTypes.length ? `<div class="note warn">Attacks need ${needTypes.map(esc).join(", ")} Energy, but the deck has no basic ${needTypes.map(esc).join("/")} Energy.</div>` : ""}
  </section>
  <section class="panel"><h3>Draw odds</h3><p class="muted small">Chance to have at least one copy in your opening 7. Six cards go to your Prizes — a single copy is prized about ${pctTxt(6 / Math.max(N, 1))} of games.</p>
    <table class="metrics"><thead><tr><th>Card</th><th class="num">Copies</th><th class="num">Opening 7</th><th class="num">By turn 2 (9)</th></tr></thead><tbody>${main.sort((a, b) => b.r.qty - a.r.qty || a.r.name.localeCompare(b.r.name)).filter((x) => !x.c?.basicEnergy).map((x) => oddsRow(x, [7, 9])).join("")}</tbody></table></section>${valuePanel}`;
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
function deckVersions(g, d) {
  const vs = (d.versions || []).slice().reverse();
  return `<section class="panel"><div class="row between"><h3>Versions</h3><button class="btn small" data-act="tSnap" data-deck="${esc(d.id)}">Save a version now</button></div>
    <p class="muted small">A snapshot of the list you can compare against or go back to. Restoring saves the current list first.</p>
    ${vs.length ? `<div class="list">${vs.map((v) => {
      const df = diffZones(v.zones, d.zones),
        n = ["main", "extra", "side"].reduce((a, z) => a + (v.zones[z] || []).reduce((b, r) => b + r.qty, 0), 0);
      return `<div class="version"><div class="row between"><b>${esc(v.label)}</b><small class="muted">${esc(new Date(v.at).toLocaleString())} · ${n} cards</small></div>
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
    .map((s) => `<button class="set-row" data-act="tSet" data-id="${esc(s.id)}">${s.image ? `<img class="set-logo" src="${esc(s.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span class="set-row-main"><b class="ellip">${g === "ptcg" ? pkSetSymbol(s) + " " : ""}${esc(s.name)}</b><small class="muted">${esc(s.code)}${s.series ? " · " + esc(s.series) : ""}${s.date ? " · " + esc(s.date) : ""}</small></span><span class="set-row-count">${owned.get(s.id) ? `<b class="ok-text">${owned.get(s.id)}</b>/` : ""}${s.count}</span></button>`)
    .join("")}</div>
  ${list.length > U.limit ? `<button class="btn ghost block" data-act="tSetsMore">Show more · ${list.length - U.limit} left</button>` : ""}
  ${g === "ptcg" ? `<p class="foot">Set and rarity symbols from <a href="https://pokesymbols.com" target="_blank" rel="noopener">pokesymbols.com</a>.</p>` : ""}`;
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
  return `<div class="set-hero">${info?.image ? `<img class="set-logo big" src="${esc(info.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<div class="set-hero-main"><button class="link small" data-act="go" data-to="#sets">← All sets</button><h1>${g === "ptcg" && info ? pkSetSymbol(info, "pks big") + " " : ""}${esc(info?.name || U.id)}</h1><p class="muted small">${info ? `${esc(info.code)}${info.series ? " · " + esc(info.series) : ""}${info.date ? " · " + esc(info.date) : ""} · ${info.count} cards` : ""}</p></div></div>
  ${U.error ? `<div class="note warn">${esc(U.error)}</div>` : ""}
  ${U.cards.length ? `<div class="panel tight"><div class="row between"><span>You own <b>${ownedCount}</b> of ${U.cards.length}</span><b>${Math.round((ownedCount / U.cards.length) * 100)}%</b></div>${bar(ownedCount / U.cards.length, "good")}</div>` : ""}
  <div class="set-controls">${segmented("tSetFilter", U.filter, [["all", "All"], ["owned", "Owned"], ["missing", "Missing"]])}<select data-change="tSetSort" aria-label="Sort">${options([["number", "Set order"], ["price", "Price: high to low"], ["name", "Name"]], U.sort)}</select></div>
  <p class="muted small">${U.busy ? "Loading cards and prices…" : `${list.length} shown · prices are daily market estimates`}</p>
  <div class="card-grid set-grid">${list
    .slice(0, U.limit)
    .map((c) => `<button class="grid-card ${own(c) ? "own" : ""}" data-act="tCard" data-id="${esc(c.id)}">${imgTag(c)}${tileBadges(c)}<span class="grid-meta"><span class="ellip">${c.set?.number ? "#" + esc(c.set.number) + " " : ""}${esc(c.name)}</span><span>${c.brief ? "…" : price(c) === null ? "—" : usd(price(c))}</span></span>${own(c) ? `<span class="owned-badge">×${own(c)}</span>` : ""}</button>`)
    .join("")}</div>
  ${list.length > U.limit ? `<button class="btn ghost block" data-act="tSetMore">Show more · ${list.length - U.limit} left</button>` : ""}`;
}

/* ---------- deck generator sheet ---------- */

export const TCG_TIERS = { ygo: [0, 25, 50, 100, 250, Infinity], ptcg: [0, 25, 50, 100, 200, Infinity] };
const tierName = (t) => (t.meta ? "Tournament list" : t.budget === 0 ? "Your cards only" : t.budget === Infinity ? "No budget limit" : "Up to $" + t.budget);
const buildable = (g, c) => (c ? formatsOf(g).filter((f) => SOURCES[g].legality(c, f) !== "not_legal" && SOURCES[g].limit(c, f) > 0 && (g === "ygo" || c.category === "Pokemon")) : []);

export function tcgBuildSheet() {
  const B = S.ui.tbuild,
    g = B.game,
    seed = cardOf(g, B.seed),
    fmts = buildable(g, seed),
    tiers = B.results[B.format];
  return `<div class="sheet-head"><h2>Build decks</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  ${(B.seeds?.length || 1) > 1
    ? `<div class="build-seed multi"><div class="seed-strip">${B.seeds.slice(0, 8).map((id) => imgTag(cardOf(g, id), "mini-art")).join("")}</div><div><small class="muted">Built around</small><b>${B.seeds.length} of your cards</b><small class="muted">${esc([...new Set(B.seeds.map((id) => cardOf(g, id)?.archetype || "").filter(Boolean))].slice(0, 3).join(", ") || seed?.name || "")}</small></div></div>`
    : `<div class="build-seed">${imgTag(seed, "mini-art")}<div><small class="muted">Built around</small><b>${esc(seed?.name || "")}</b><small class="muted">${esc(seed?.archetype ? "Archetype: " + seed.archetype : seed?.typeLine || "")}</small></div><span></span></div>`}
  <p class="muted small">${g === "ygo" ? "Builds a legal deck from the archetype, then adds the hand traps, draw and removal today’s tournament decks play most — your cards first, at each budget, plus a recent tournament list when one plays your card." : "Builds the evolution line, adds the Trainers and support Pokémon today’s top decks play, and the Energy your attacks need — your cards first, at each budget, plus a recent tournament list when one plays your card. Basic Energy is assumed owned."}</p>
  <div class="fmt-chips">${fmts.map((f) => `<button class="chip pick ${f.id === B.format ? "on" : ""}" data-act="tBuildFormat" data-format="${f.id}">${esc(f.name)}</button>`).join("") || `<span class="muted small">${g === "ptcg" ? "Pick a Pokémon (not a Trainer or Energy) to build around." : "This card isn’t legal in any format."}</span>`}</div>
  ${B.busy ? `<p class="muted small" role="status">${esc(B.msg || "Building…")}</p>` : B.msg ? `<p class="small ${B.error ? "warn-text" : "muted"}" role="status">${esc(B.msg)}</p>` : ""}
  ${tiers ? `<div class="tiers">${tiers.map((t, i) => {
    const owned = t.zones.main.concat(t.zones.extra).reduce((a, r) => a + Math.min(r.qty, ownedOf(g, cardOf(g, r.cardId))), 0),
      open = B.openTier === i,
      issues = SOURCES[g].validate({ zones: t.zones }, (id) => cardOf(g, id), formatOf(g, B.format));
    return `<article class="tier ${open ? "on" : ""} ${t.meta ? "meta" : ""}"><div class="row between"><b>${t.meta ? `🏆 ${esc(t.label)}` : tierName(t)}</b><span class="chip ${issues.length ? "warn" : "ok"}">${issues.length ? issues.length + " to fix" : "Legal"}</span></div>
      <div class="tier-stats"><span><b>${usd(t.cost)}</b> to buy</span><span><b>${t.total}/${t.size}</b> ${g === "ygo" ? "main" : "cards"}</span>${g === "ygo" ? `<span><b>${t.zones.extra.reduce((a, r) => a + r.qty, 0)}</b> extra</span>` : ""}<span><b>${t.total ? Math.round((owned / t.total) * 100) : 0}%</b> owned</span></div>
      ${t.warnings.map((w) => `<p class="small warn-text">${esc(w)}</p>`).join("")}
      ${open ? `<div class="card-grid small-grid">${t.zones.main.concat(t.zones.extra).map((r) => `<button class="grid-card" data-act="tCard" data-id="${esc(r.cardId)}">${imgTag(cardOf(g, r.cardId))}${tileBadges(cardOf(g, r.cardId))}<span class="grid-meta"><span class="ellip">${r.qty}× ${esc(r.name)}</span><span>${esc(r.why || "")}</span></span></button>`).join("")}</div>` : ""}
      <div class="actions wrap"><button class="btn ghost small" data-act="tTier" data-i="${i}">${open ? "Hide cards" : "See the cards"}</button><button class="btn small" data-act="tTierSave" data-i="${i}">Save as deck</button></div></article>`;
  }).join("")}</div>` : ""}
  <p class="foot">Generated lists follow simple, transparent rules and lean on what current tournament decks play; the tournament list is the real one. Prices are daily market estimates.</p>`;
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
  return `<section class="deck-hero">${imgTag(cover, "hero-art", true)}<div class="hero-shade"></div><div class="hero-body">
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
    if (t.value === "price") render();
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
      sctx = { type: "tcard", game: G, id, random: !!t.dataset.random, deckId: t.dataset.deck || (S.ui.view === "tdeck" ? S.ui.tdeckId : null) };
    const known = cardOf(G, id);
    openSheet(known ? tcgCardSheet(known, sctx) : `<div class="sheet-head"><h2>Loading…</h2><button class="icon" data-act="closeSheet">✕</button></div>`, sctx);
    try {
      const card = await ensureCard(G, id);
      if (S.ui.sheetCtx === sctx) openSheet(tcgCardSheet(card, sctx), sctx, document.querySelector("#sheetBody").scrollTop);
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
  A.tRandomDeck = async () => {
    if (randomBusy) return;
    randomBusy = true;
    const G = g();
    toast(G === "ygo" ? "Picking a random archetype…" : "Picking a random Pokémon…");
    try {
      let seed;
      if (G === "ygo") {
        const { cards } = await SOURCES.ygo.randomArchetype();
        cards.forEach(remember);
        const tcgOk = (c) => SOURCES.ygo.legality(c, formatsOf("ygo")[0]) !== "not_legal" && SOURCES.ygo.limit(c, formatsOf("ygo")[0]) > 0;
        const monsters = cards.filter((c) => c.category === "Monster" && !c.extra);
        const pool = monsters.filter(tcgOk).length ? monsters.filter(tcgOk) : monsters;
        seed = pool[Math.floor(Math.random() * pool.length)];
      } else seed = remember(await SOURCES.ptcg.randomPokemon());
      await A.tBuild({ dataset: { id: seed.id } });
    } catch (e) {
      toast(e.message);
    } finally {
      randomBusy = false;
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
  C.tCollKind = (t) => {
    ui().coll[t.dataset.field] = t.value;
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

  A.tCollTab = (t) => {
    ui().coll.tab = t.dataset.id;
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
  A.tIssues = (t) => {
    (S.ui.tdeckTab ||= {})[t.dataset.deck] = "cards";
    render();
    setTimeout(() => document.querySelector("#tIssuesPanel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
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
    const label = prompt("Name this version", "Version " + ((gs(g()).decks.find((x) => x.id === t.dataset.deck)?.versions || []).length + 1));
    if (label === null) return;
    await mutate((st) => {
      const d = st.decks.find((x) => x.id === t.dataset.deck);
      d.versions = [...(d.versions || []), { id: uid(), at: new Date().toISOString(), label: label.trim().slice(0, 60) || "Version", zones: structuredClone(d.zones) }].slice(-30);
    }, { msg: "Version saved." });
  };
  A.tRestore = async (t) => {
    if (!confirm("Restore this version? The current list is saved as a version first.")) return;
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
  const ptcgBest = async (name, f) => {
    const r = await SOURCES.ptcg.search({ q: name, size: 12 }).catch(() => ({ cards: [] }));
    const exact = r.cards.filter((x) => x.name.toLowerCase() === name.toLowerCase()).slice(0, 4);
    for (const b of exact) {
      const c = await ensureCard("ptcg", b.id).catch(() => null);
      if (c && SOURCES.ptcg.legality(c, f) === "legal") return c;
    }
    return null;
  };
  const inBatches = async (items, n, fn) => {
    const out = [];
    for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
    return out;
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
  const metaZones = async (G, d, status = () => {}) => {
    const zones = { main: [], extra: [], side: [] },
      put = (z, card, qty) => {
        const row = zones[z].find((r) => r.cardId === card.id);
        if (row) row.qty += qty;
        else zones[z].push({ cardId: card.id, name: card.name, qty });
      };
    if (G === "ygo") {
      const need = [...new Set([...d.main, ...d.extra, ...d.side])].filter((id) => !cardOf("ygo", id));
      if (need.length) {
        status(`Loading ${need.length} cards…`);
        (await SOURCES.ygo.byIds(need)).forEach(remember);
      }
      for (const z of ["main", "extra", "side"]) for (const id of d[z]) if (cardOf("ygo", id)) put(z, cardOf("ygo", id), 1);
      return { zones, missed: [] };
    }
    const std = formatOf("ptcg", "standard"),
      any = formatOf("ptcg", "unlimited"),
      missed = [];
    let n = 0;
    const got = await inBatches(d.list, 6, async (x) => {
      const card = BASIC_TYPES.test(x.name) ? await ptcgBest(energyName(x.name.replace(/ Energy$/, "")), any) : (await ptcgBest(x.name, std)) || (await SOURCES.ptcg.byName(x.name).catch(() => null));
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
      .filter((x) => x.n)
      .sort((a, b) => b.n - a.n || a.d.rank - b.d.rank)[0]?.d;
  };
  // One evolution line; the first (main) line gets more copies.
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
    c.refreshSheet();
    try {
      const m = ownedMap(G),
        owned = (card) => ownedOf(G, card, m),
        priceOf = (card) => price(card),
        seeds = (B.seeds || [B.seed]).map((id) => cardOf(G, id)).filter(Boolean);
      status("Checking what tournament decks play right now…");
      const meta = await metaFor(G);
      let results = [];
      if (G === "ygo") {
        const archs = [...new Set(seeds.map((x) => x.archetype).filter(Boolean))].slice(0, 3);
        status(archs.length ? `Loading ${archs.join(", ")}…` : "Loading…");
        const arch = (await Promise.all(archs.map((a) => SOURCES.ygo.search({ archetype: a, size: 100 }).then((r) => r.cards).catch(() => [])))).flat().map(remember);
        status("Loading staples from current tournament decks…");
        const staples = (await ygoMetaStaples(meta, new Set(arch.map((x) => x.id)))) || (await SOURCES.ygo.byNames(YGO_STAPLES).catch(() => [])).map(remember).sort((a, b) => YGO_STAPLES.indexOf(a.name) - YGO_STAPLES.indexOf(b.name));
        results = TCG_TIERS.ygo.map((budget) => ({ budget, ...buildYgo({ f, seed, seeds, archetype: arch, staples, limit: SOURCES.ygo.limit, legal: SOURCES.ygo.legality, owned, price: priceOf, budget }) }));
      } else {
        const line = [];
        for (const [i, p] of seeds.filter((x) => x.category === "Pokemon").slice(0, 3).entries()) {
          status(`Finding the evolution line for ${p.name}…`);
          for (const x of await lineFor(p, f, i === 0)) if (!line.some((y) => y.card.id === x.card.id)) line.push(x);
        }
        // Enough Basic Pokémon (about 10) that most opening hands have one — the meta's favourites first.
        status("Adding support Pokémon…");
        let basics = line.filter((x) => x.card.basicPokemon).reduce((a, x) => a + x.want, 0);
        for (const n of [...new Set([...ptcgMetaBasics(meta), ...PTCG_SUPPORT_BASICS])]) {
          if (basics >= 10) break;
          const card = await ptcgBest(n, f);
          if (card?.basicPokemon && !line.some((y) => y.card.id === card.id)) {
            const want = f.copies === 1 ? 1 : Math.min(2, 10 - basics);
            line.push({ card, want });
            basics += want;
          }
        }
        const chosen = seeds.filter((x) => x.category === "Trainer").map((card) => ({ card, want: f.copies === 1 ? 1 : Math.min(4, Math.max(2, owned(card))) }));
        const metaT = ptcgMetaTrainers(meta),
          wanted = [...(line.some((x) => x.card.stage === "Stage2") ? [["Rare Candy", 4]] : []), ...(metaT.length >= 8 ? metaT : PTCG_STAPLES)].filter(([n]) => !chosen.some((x) => x.card.name === n));
        status(`Finding Trainers ${metaT.length >= 8 ? "today’s top decks play" : "staples"} legal in ${f.name}…`);
        const got = await inBatches(wanted, 6, ([n, want]) => ptcgBest(n, f).then((card) => (card ? { card, want: f.copies === 1 ? 1 : want } : null)));
        const trainers = [...chosen, ...got.filter(Boolean)];
        const types = [...new Set(line.flatMap((x) => x.card.attackCosts || []))].filter((t) => t in { Grass: 1, Fire: 1, Water: 1, Lightning: 1, Psychic: 1, Fighting: 1, Darkness: 1, Metal: 1 });
        const energy = (await Promise.all((types.length ? types : (seed.types || []).slice(0, 1)).slice(0, 2).map((t) => ptcgBest(energyName(t), formatOf("ptcg", "unlimited"))))).filter(Boolean);
        results = TCG_TIERS.ptcg.map((budget) => ({ budget, ...buildPtcg({ line, trainers, energy, owned: (card) => (card.basicEnergy ? 99 : owned(card)), price: priceOf, budget }) }));
      }
      // A recent tournament list that plays your card(s), as its own version.
      const mt = meta && f.id === (G === "ygo" ? "tcg" : "standard") ? bestMetaDeckFor(G, meta, seeds) : null;
      if (mt) {
        status("Loading a tournament list that plays it…");
        const { zones } = await metaZones(G, mt, status),
          rows = [...zones.main, ...zones.extra],
          cost = rows.reduce((a, r) => {
            const card = cardOf(G, r.cardId);
            return a + Math.max(0, r.qty - (card?.basicEnergy ? 99 : owned(card))) * (price(card) ?? 0);
          }, 0);
        results.unshift({ budget: null, label: `Tournament list · ${mt.place}, ${mt.event}`, meta: mt.key, zones, cost, total: zones.main.reduce((a, r) => a + r.qty, 0), size: G === "ygo" ? f.main[0] : 60, warnings: [] });
      }
      B.results[B.format] = results;
      B.msg = `${results.length} versions${mt ? ", including a recent tournament list" : ""}${meta ? " · staples from current tournament decks" : ""}.`;
    } catch (e) {
      B.msg = e.message;
      B.error = true;
    } finally {
      B.busy = false;
      c.refreshSheet();
    }
  };
  const openBuild = (G, ids, metaKey = "") => {
    const cards = ids.map((id) => cardOf(G, id)).filter(Boolean);
    // Pokémon decks are built around Pokémon; put them first.
    cards.sort((a, b) => (G === "ptcg" ? (b.category === "Pokemon") - (a.category === "Pokemon") : 0));
    const fmts = buildable(G, cards[0]);
    S.ui.tbuild = { game: G, seed: cards[0]?.id, seeds: cards.map((x) => x.id), format: fmts[0]?.id || "", results: {}, busy: false, msg: "", openTier: null, metaKey };
    openSheet(tcgBuildSheet(), { type: "tbuild" });
    if (fmts.length) runTBuild();
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
  A.tTier = (t) => {
    const B = S.ui.tbuild,
      i = Number(t.dataset.i);
    B.openTier = B.openTier === i ? null : i;
    c.refreshSheet();
  };
  A.tTierSave = async (t) => {
    const B = S.ui.tbuild,
      tier = B.results[B.format][Number(t.dataset.i)],
      seed = cardOf(B.game, B.seed),
      many = (B.seeds?.length || 1) > 1 ? ` + ${B.seeds.length - 1} more` : "",
      d = { id: uid(), name: `${seed.name}${many} · ${formatOf(B.game, B.format).name} · ${tierName(tier).toLowerCase()}`, format: B.format, zones: structuredClone(tier.zones), createdAt: new Date().toISOString(), source: { kind: tier.meta ? "Tournament list" : "Generated" } };
    await mutate((st) => st.decks.push(d), { msg: `Saved “${d.name}” to your decks.` });
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
  A.tMetaDeck = async (t) => {
    const G = g(),
      d = metaState(G).data?.decks.find((x) => x.key === t.dataset.key);
    if (!d) return;
    const sctx = { type: "tmeta", key: d.key };
    openSheet(tcgMetaSheet(G, d), sctx);
    if (G === "ygo") {
      const need = [...new Set([...d.main, ...d.extra, ...d.side])].filter((id) => !cardOf("ygo", id));
      if (need.length) {
        (await SOURCES.ygo.byIds(need).catch(() => [])).forEach(remember);
        if (S.ui.sheetCtx === sctx) openSheet(tcgMetaSheet(G, d), sctx, document.querySelector("#sheetBody").scrollTop);
      }
    }
  };
  A.tMetaSave = async (t) => {
    const G = g(),
      d = metaState(G).data?.decks.find((x) => x.key === t.dataset.key),
      status = (m) => {
        const el = document.querySelector("#metaStatus");
        if (el) el.textContent = m;
      };
    if (!d) return;
    const done = busy(t, "Saving…");
    try {
      const { zones, missed } = await metaZones(G, d, status);
      const deck = { id: uid(), name: `${d.name} · ${d.place}, ${d.event}`.slice(0, 100), format: G === "ygo" ? "tcg" : "standard", zones, createdAt: new Date().toISOString(), source: { kind: "Tournament list", author: d.player, url: d.url } };
      await mutate((st) => st.decks.push(deck), { msg: missed.length ? `Saved. ${missed.length} not found: ${missed.slice(0, 3).join(", ")}` : "Saved to your decks. It shows what you own and what’s left to buy." });
      closeSheet();
      go("#tdeck/" + deck.id);
    } catch (e) {
      status(e.message);
    } finally {
      done();
    }
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
