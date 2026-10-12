// Cardforge controller: persistence, routing, sheets and every user action.
// Screens live in views.js; deck/collection math in core.js, planner.js,
// strategy.js, deck-flow.js and insights.js.
import { S, STORAGE, CATALOG_RECORD, RECOVERY, blank, uid, meta, inv, deckById, currentDeck, priceOf, cacheCard, slim } from "./store.js";
import { $, $$, esc, usd, img, cardImage, options, segmented, customBudget, registerSetIcons } from "./ui.js";
import * as V from "./views.js";
import { readRecord, writeRecord, writeRecords, persistenceStatus, requestPersistence } from "./storage.js";
import {
  cardKey as key, sumQty, typeText, rulesText, isLand, commanderEligible, mergeDeckCard,
  cardPrice, drawHand, exportDeck, aggregateCards, inventory,
} from "./core.js";
import {
  parseImport, previewImport, applyImport, printingState, importErrorsCSV, exportCollectionCSV,
  validateWorkspace, backupEnvelope, deckRowsFromImport,
} from "./confidence.js";
import { parseDeckImport, acquireMissing } from "./deck-flow.js";
import { completionPlan, commanderTheme } from "./planner.js";
import { sourceCredit, mtgjsonDeck, collectionIdeas, upgradeSuggestions, applyUpgradeSwaps } from "./strategy.js";
import { searchQuery, scanNames } from "./catalog-tools.js";
import { newGame, proxyList, proxySheetHTML } from "./extras.js";
import { sharePayload, encodeShare, decodeShare } from "./share.js";
import { withSnapshot, collectionValue, recordValuePoint, cardSig, engineProfile, swapImpact } from "./insights.js";

/* =========================================================
   Persistence
   ========================================================= */

const stripCache = (s) => {
  const { cache, ...keep } = s;
  void cache;
  return keep;
};
const normalize = (s) => stripCache({ ...blank(), ...validateWorkspace(s) });

function setSaveStatus(text, cls = "") {
  const el = $("#saveStatus");
  if (el) {
    el.textContent = text;
    el.className = "save-status " + cls;
  }
}

let catalogTimer;
function saveCatalogSoon() {
  if (!S.catalogDirty) return;
  clearTimeout(catalogTimer);
  catalogTimer = setTimeout(() => {
    S.catalogDirty = false;
    writeRecord(CATALOG_RECORD, S.catalog).catch(() => (S.catalogDirty = true));
  }, 1200);
}

function save() {
  S.state.lastSavedAt = new Date().toISOString();
  setSaveStatus("Saving…");
  saveCatalogSoon();
  return writeRecord(STORAGE, stripCache(S.state))
    .then(() => (setSaveStatus("Saved on this device", "ok"), true))
    .catch(() => {
      setSaveStatus("Not saved", "bad");
      toast("Couldn’t save on this device. Export a backup from Settings.");
      return false;
    });
}

// Transactional change: mutate a copy, validate, write, then swap in.
async function commit(fn, { msg = "", recovery = false, rerender = true, enrich = true } = {}) {
  const next = structuredClone(stripCache(S.state));
  const out = fn(next);
  const valid = normalize(next);
  valid.lastSavedAt = new Date().toISOString();
  const records = [[STORAGE, valid]];
  if (recovery) records.unshift([RECOVERY, stripCache(S.state)]);
  await writeRecords(records);
  S.state = valid;
  setSaveStatus("Saved on this device", "ok");
  saveCatalogSoon();
  if (rerender) {
    render();
    refreshSheet();
  }
  if (msg) toast(msg);
  if (enrich) setTimeout(autoEnrich, 50);
  return out;
}
const safely = (p) => Promise.resolve(p).catch((e) => toast(e.message || String(e)));

/* =========================================================
   Card data (Scryfall)
   ========================================================= */

let apiChain = Promise.resolve();
function api(path, options = {}) {
  const op = async () => {
    await new Promise((r) => setTimeout(r, 110));
    const ctl = new AbortController(),
      timer = setTimeout(() => ctl.abort(), 16000);
    try {
      const r = await fetch("https://api.scryfall.com" + path, {
        ...options,
        headers: { Accept: "application/json", ...options.headers },
        signal: ctl.signal,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.details || "Card database unavailable.");
      return d;
    } catch (e) {
      throw Error(e.name === "AbortError" ? "Card lookup timed out. Check your connection and try again." : e.message);
    } finally {
      clearTimeout(timer);
    }
  };
  const result = apiChain.then(op, op);
  apiChain = result.catch(() => {});
  return result;
}

async function resolve(name, fuzzy = false, refresh = false) {
  if (!String(name || "").trim()) throw Error("No card name given.");
  const c = meta(name);
  if (c && !refresh) return c;
  const d = await api("/cards/named?" + new URLSearchParams({ [fuzzy ? "fuzzy" : "exact"]: name }));
  return cacheCard(d, [name]);
}

async function resolveNames(names, progress = () => {}, refresh = false) {
  const wanted = [...new Map(names.filter(Boolean).map((n) => [key(n), n])).values()].filter((n) => refresh || !meta(n)),
    failed = [],
    matched = new Map();
  for (let i = 0; i < wanted.length; i += 75) {
    const chunk = wanted.slice(i, i + 75);
    progress(`Loading card data ${Math.min(i + 75, wanted.length)}/${wanted.length}…`);
    try {
      const r = await api("/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk.map((name) => ({ name: name.split(" // ")[0] })) }),
      });
      for (const c of r.data || []) {
        const aliases = chunk.filter((n) => key(n) === key(c.name) || key(n.split(" // ")[0]) === key(c.name.split(" // ")[0]) || c.card_faces?.some((f) => key(f.name) === key(n)));
        cacheCard(c, aliases);
        for (const a of aliases) matched.set(key(a), c.name);
      }
      for (const n of chunk) if (!meta(n)) failed.push(n);
    } catch {
      failed.push(...chunk);
    }
  }
  saveCatalogSoon();
  return { failed, matched, total: wanted.length };
}


/* =========================================================
   Automatic card lookup: exact printings (set + number) and names,
   batched 75 at a time. Runs on open, after imports and after edits.
   ========================================================= */
let enriching = false,
  enrichAgain = false;
async function autoEnrich() {
  if (enriching) return void (enrichAgain = true);
  if (!navigator.onLine) return;
  const st = S.state,
    lots = st.collection.filter((e) => !e.printingVerified && !e.lookupFailed && e.set && e.collectorNumber),
    names = [
      ...st.collection.filter((e) => !e.lookupFailed).map((e) => e.name),
      ...st.decks.flatMap((d) => d.cards.map((c) => c.name)),
      ...(st.references || []).flatMap((d) => d.cards.map((c) => c.name)),
      ...st.wishlist.map((w) => w.name),
    ].filter((n) => n && !meta(n));
  if (!lots.length && !names.length) return;
  enriching = true;
  const status = (m) => setSaveStatus(m);
  try {
    const found = new Map(); // lot id -> card
    const keyOf = (set, num) => String(set).toLowerCase() + "#" + String(num).toLowerCase();
    for (let i = 0; i < lots.length; i += 75) {
      const chunk = lots.slice(i, i + 75);
      status(`Looking up printings ${Math.min(i + 75, lots.length)}/${lots.length}…`);
      try {
        const r = await api("/cards/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: chunk.map((e) => ({ set: e.set.toLowerCase(), collector_number: String(e.collectorNumber) })) }),
        });
        const bySet = new Map((r.data || []).map((c) => [keyOf(c.set, c.collector_number), c]));
        for (const e of chunk) {
          const c = bySet.get(keyOf(e.set, e.collectorNumber));
          if (c) {
            found.set(e.id, c);
            if (!meta(c.name)) cacheCard(c, [e.name]);
            else S.catalog[key(e.name)] = S.catalog[key(e.name)] || meta(c.name);
          }
        }
      } catch {}
    }
    const r = names.length ? await resolveNames(names, status) : { matched: new Map(), failed: [] };
    const failed = new Set(r.failed.map(key));
    await commit(
      (s) => {
        for (const e of s.collection) {
          const c = found.get(e.id);
          if (c) {
            s.printings[c.id] = slim({ ...c, checkedAt: new Date().toISOString() });
            Object.assign(e, { name: c.name, printingId: c.id, oracleId: c.oracle_id, set: c.set.toUpperCase(), setName: c.set_name, collectorNumber: c.collector_number, printingVerified: true, nameVerified: true });
            delete e.lookupFailed;
          } else if (r.matched.has(key(e.name))) {
            e.name = r.matched.get(key(e.name));
            e.nameVerified = true;
            delete e.lookupFailed;
          } else if (failed.has(key(e.name)) && !meta(e.name)) e.lookupFailed = true;
        }
        for (const d of [...s.decks, ...(s.references || [])]) for (const c of d.cards) if (r.matched.has(key(c.name))) c.name = r.matched.get(key(c.name));
      },
      { enrich: false },
    );
    trackValue();
    await save();
    const bad = S.state.collection.filter((e) => e.lookupFailed).length;
    setSaveStatus(bad ? `${bad} cards not found` : "Cards up to date", bad ? "bad" : "ok");
  } catch (e) {
    setSaveStatus("Lookup paused", "bad");
  } finally {
    enriching = false;
    if (enrichAgain) {
      enrichAgain = false;
      setTimeout(autoEnrich, 200);
    }
  }
}

/* =========================================================
   Sets: index of every set (cached a few days) and full set lists
   ========================================================= */
const SET_INDEX = "cardforge-sets-v1";
async function loadSetIndex(force = false) {
  const ui = S.ui.sets;
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(SET_INDEX) || "null");
  } catch {}
  if (cached?.sets?.length) {
    ui.list = cached.sets;
    registerSetIcons(Object.fromEntries(cached.sets.map((x) => [x.code, x.icon])));
  }
  const fresh = cached && Date.now() - cached.at < 3 * 864e5;
  if ((fresh && !force) || (fresh && ui.list.length) || !navigator.onLine || ui.busy) return;
  ui.busy = true;
  ui.error = "";
  try {
    const r = await api("/sets"),
      sets = (r.data || []).map((x) => ({ code: x.code, name: x.name, released_at: x.released_at || "", set_type: x.set_type, card_count: x.card_count, digital: !!x.digital, icon: x.icon_svg_uri }));
    ui.list = sets;
    registerSetIcons(Object.fromEntries(sets.map((x) => [x.code, x.icon])));
    try {
      localStorage.setItem(SET_INDEX, JSON.stringify({ at: Date.now(), sets }));
    } catch {}
  } catch (e) {
    if (!ui.list.length) ui.error = e.message;
  } finally {
    ui.busy = false;
    // Redraw with the official set symbols, unless the user is typing somewhere.
    if (!document.activeElement?.matches?.("input:not([data-input=setsSearch]), textarea, select")) render();
  }
}

// Every printing in a set, straight from Scryfall, so new sets appear as soon as Scryfall has them.
const setCache = new Map();
async function loadSet(code) {
  const st = S.ui.set;
  if (setCache.has(code)) {
    Object.assign(st, setCache.get(code), { loaded: true, busy: false });
    return render();
  }
  st.busy = true;
  st.error = "";
  try {
    st.info = await api("/sets/" + encodeURIComponent(code));
    render();
    let path = "/cards/search?" + new URLSearchParams({ q: "e:" + code, unique: "prints", order: "set", dir: "asc", include_extras: "true", include_variations: "true" });
    for (let page = 0; path && page < 30 && S.ui.set.code === code; page++) {
      const d = await api(path);
      st.total = d.total_cards || st.total;
      st.cards.push(...(d.data || []).map((c) => slim(c)));
      path = d.has_more && d.next_page ? new URL(d.next_page).pathname + new URL(d.next_page).search : null;
      if (S.ui.view === "set") render();
    }
    if (S.ui.set.code === code) {
      st.loaded = true;
      setCache.set(code, { info: st.info, cards: st.cards, total: st.total });
    }
  } catch (e) {
    st.error = st.cards.length ? "Some cards didn’t load: " + e.message : e.message;
    st.loaded = !!st.cards.length;
  } finally {
    st.busy = false;
    if (S.ui.view === "set") render();
  }
}

/* =========================================================
   Shared deck links and the "almost build" finder
   ========================================================= */
async function openShared(code) {
  const sh = S.ui.shared;
  Object.assign(sh, { code, deck: null, error: "" });
  try {
    const deck = await decodeShare(code);
    if (sh.code !== code) return;
    sh.deck = deck;
    render();
    const r = await resolveNames(deck.cards.map((c) => c.name).concat(deck.commander || []));
    if (r.total && S.ui.view === "shared") render();
  } catch (e) {
    if (sh.code === code) sh.error = e.message;
    if (S.ui.view === "shared") render();
  }
}
// Link back to a shared deck for attribution; very long links fall back to the site address.
const sharedSourceURL = () => (location.href.length <= 2000 ? location.href : location.origin + location.pathname);

const PRECON_RECORD = "cardforge-precons-v1";
async function loadPreconCache() {
  const F = S.ui.finder;
  F.cacheLoaded = true;
  try {
    const rec = await readRecord(PRECON_RECORD);
    if (rec?.decks?.length) {
      F.precons = rec.decks;
      render();
      const names = rec.decks.flatMap((d) => d.cards.map((c) => c.name)).filter((n) => !meta(n));
      if (names.length && navigator.onLine) {
        await resolveNames(names);
        if (S.ui.view === "decks") render();
      }
    }
  } catch {}
}

/* =========================================================
   Toast, sheet, download
   ========================================================= */

let toastTimer;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3800);
}

function openSheet(html, ctx = null, scrollTop = 0) {
  S.ui.sheetCtx = ctx;
  $("#sheetBody").innerHTML = html;
  const dlg = $("#sheet");
  if (!dlg.open) {
    // Remember what opened the sheet so focus can return there, and stop the page behind from scrolling.
    sheetReturn = document.activeElement;
    document.documentElement?.classList.add("sheet-open");
    dlg.showModal();
  }
  $("#sheetBody").scrollTop = scrollTop;
}
let sheetReturn = null;
function closeSheet() {
  const dlg = $("#sheet");
  if (dlg.open) dlg.close();
  S.ui.sheetCtx = null;
}
function refreshSheet() {
  const ctx = S.ui.sheetCtx;
  if (!ctx || !$("#sheet").open) return;
  if (ctx.type === "idea") return openIdea(ctx.i);
  if (ctx.type === "buy" || ctx.type === "review") {
    const top = $("#sheetBody").scrollTop;
    $("#sheetBody").innerHTML = ctx.type === "buy" ? V.buySheet(ctx) : V.deckReviewSheet(deckById(ctx.deckId) || currentDeck());
    $("#sheetBody").scrollTop = top;
    return;
  }
  if (ctx.type === "card") {
    const c = meta(ctx.name),
      top = $("#sheetBody").scrollTop;
    if (c) $("#sheetBody").innerHTML = V.cardSheet(c, ctx);
    $("#sheetBody").scrollTop = top;
  }
}

function download(name, text, type = "text/plain") {
  const u = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}
async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    download("Cardforge_List.txt", text + "\n");
    toast("Clipboard blocked — downloaded as a text file instead.");
  }
}
const fileSafe = (s) => String(s).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "deck";

/* =========================================================
   Routing
   ========================================================= */

const LEGACY = {
  catalog: "search", builder: "deck", discover: "decks/ideas", library: "decks/inspiration",
  wishlist: "collection/wishlist", compare: "search", playtest: "deck/active/playtest",
  guides: "deck/active/engine", sources: "settings",
};
const VIEWS = ["home", "search", "collection", "decks", "deck", "scan", "settings", "sets", "set", "shared"];

function parseHash() {
  let h = decodeURIComponent(location.hash.slice(1) || "home");
  const head = h.split("/")[0];
  if (LEGACY[head]) h = LEGACY[head] + h.slice(head.length);
  const [v, a, b] = h.split("/");
  const ui = S.ui,
    prev = ui.view + ui.deckId;
  ui.view = VIEWS.includes(v) ? v : "home";
  if (ui.view === "collection" && ["cards", "value", "wishlist"].includes(a)) ui.collTab = a;
  if (ui.view === "shared" && a !== ui.shared.code) openShared(a);
  if (ui.view === "set") {
    if (!a) ui.view = "sets";
    else if (a.toLowerCase() !== ui.set.code) ui.set = { ...ui.set, code: a.toLowerCase(), info: null, cards: [], total: 0, loaded: false, error: "", q: "", filter: "all", rarity: "all", limit: 120 };
  }
  if (ui.view === "decks") ui.decksTab = ["mine", "ideas", "inspiration"].includes(a) ? a : "mine";
  if (ui.view === "deck") {
    const id = !a || a === "active" ? S.state.activeDeck : a;
    if (!deckById(id) && (!a || a === "active")) {
      ui.view = "decks";
      ui.decksTab = "mine";
      return true;
    }
    if (id !== ui.deckId) {
      ui.q.deck = "";
      ui.hand = null;
      ui.versions = { a: null, b: "current" };
    }
    ui.deckId = id;
    if (["cards", "engine", "upgrade", "versions", "playtest", "shop"].includes(b)) ui.deckTab = b;
    if (id && id !== S.state.activeDeck && deckById(id)) {
      S.state.activeDeck = id;
      save();
    }
  }
  return prev !== ui.view + ui.deckId;
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

const autoLoaded = new Set();
function render() {
  const ui = S.ui;
  for (const b of $$("[data-nav]")) b.classList.toggle("on", b.dataset.nav === (ui.view === "deck" ? "decks" : ui.view === "set" || ui.view === "sets" ? "search" : ui.view));
  document.body.dataset.view = ui.view;
  const views = {
    home: V.home, search: V.search, collection: V.collection, decks: V.decks,
    deck: V.deckPage, scan: () => V.scan(scanNames), settings: V.settings, sets: V.setsPage, set: V.setPage, shared: V.sharedPage,
  };
  $("#content").innerHTML = views[ui.view]();
  if (ui.view === "settings") storageDetail();
  const deck = ui.view === "deck" ? currentDeck() : null;
  if (deck && navigator.onLine && !autoLoaded.has(deck.id) && deck.cards.some((c) => !meta(c.name))) {
    autoLoaded.add(deck.id);
    resolveNames(deck.cards.map((c) => c.name)).then((r) => {
      if (r.total) render();
    });
  }
  if (ui.view === "decks" && ui.decksTab === "inspiration" && !ui.finder.cacheLoaded) loadPreconCache();
  if (ui.view === "sets" && !ui.sets.list.length && !ui.sets.busy && !ui.sets.error) loadSetIndex(true);
  if (ui.view === "set" && !ui.set.loaded && !ui.set.busy && !ui.set.error) loadSet(ui.set.code);
  if (ui.view === "decks" && ui.decksTab === "ideas" && !ui.ideas.cache.length && !ui.ideas.busy && !ui.ideas.ran) {
    ui.ideas.ran = true;
    setTimeout(() => buildIdeas(), 30);
  }
}

window.addEventListener("hashchange", () => {
  const changed = parseHash();
  render();
  if (changed) window.scrollTo({ top: 0 });
});

/* =========================================================
   Event delegation
   ========================================================= */

const A = {}; // click actions
const C = {}; // change handlers
const I = {}; // input handlers

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t || t.disabled) return;
  const fn = A[t.dataset.act];
  if (!fn) return;
  if (t.tagName === "A" && t.getAttribute("href")) return;
  e.preventDefault();
  safely(fn(t, e));
});
document.addEventListener("change", (e) => {
  const t = e.target.closest("[data-change]");
  if (t && C[t.dataset.change]) safely(C[t.dataset.change](t, e));
});
document.addEventListener("input", (e) => {
  const t = e.target.closest("[data-input]");
  if (t && I[t.dataset.input]) I[t.dataset.input](t, e);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = e.target.closest("[data-enter]");
  if (!t || !A[t.dataset.enter]) return;
  e.preventDefault();
  safely(A[t.dataset.enter](t, e));
});
$("#sheet").addEventListener("click", (e) => {
  if (e.target.id === "sheet") closeSheet();
});
$("#sheet").addEventListener("close", () => {
  S.ui.sheetCtx = null;
  document.documentElement?.classList.remove("sheet-open");
  // Return focus to the button that opened the sheet, or its re-rendered twin.
  const back = sheetReturn;
  sheetReturn = null;
  if (back?.isConnected) back.focus({ preventScroll: true });
  else if (back?.dataset?.act) {
    const sel = `[data-act="${back.dataset.act}"]` + (back.dataset.name ? `[data-name="${CSS.escape(back.dataset.name)}"]` : "");
    document.querySelector(sel)?.focus({ preventScroll: true });
  }
});

const busy = (btn, text) => {
  if (!btn) return () => {};
  const old = btn.textContent;
  btn.disabled = true;
  if (text) btn.textContent = text;
  return () => {
    if (btn.isConnected) {
      btn.disabled = false;
      btn.textContent = old;
    }
  };
};

/* ---------- navigation ---------- */

A.go = (t) => {
  closeSheet();
  go(t.dataset.to);
};
A.closeSheet = closeSheet;
A.collTab = (t) => go("#collection/" + t.dataset.id);
A.decksTab = (t) => go("#decks/" + t.dataset.id);
A.deckTab = (t) => {
  closeSheet();
  go("#deck/" + currentDeck().id + "/" + t.dataset.id);
};
A.menu = () =>
  openSheet(`<div class="sheet-head"><h2>More</h2><button class="icon" data-act="closeSheet">✕</button></div><div class="menu-list">
    <button data-act="go" data-to="#settings">⚙ Settings & backup</button>
    <button data-act="exportBackup">↓ Export backup now</button>
    <button data-act="go" data-to="#collection/wishlist">♡ Wishlist</button>
    <button data-act="go" data-to="#collection/value">$ Collection value</button>
    <button data-act="go" data-to="#decks/inspiration">✧ Find decks I can almost build</button>
    <button data-act="go" data-to="#sets">◈ Browse every set</button>
    <button data-act="compareOpen">⇄ Compare two cards</button>
  </div>`);

/* =========================================================
   Card sheet, compare, printings
   ========================================================= */

A.card = async (t) => {
  S.ui.sheetBack = S.ui.sheetCtx?.type === "idea" && $("#sheet").open ? { type: "idea", i: S.ui.sheetCtx.i } : null;
  const name = t.dataset.name,
    ctx = { type: "card", name, deckId: t.dataset.deck || (S.ui.view === "deck" ? currentDeck()?.id : null), random: !!t.dataset.random };
  const print = t.dataset.setI !== undefined ? S.ui.set.cards[Number(t.dataset.setI)] : null;
  if (print) {
    if (!meta(name)) cacheCard(print);
    ctx.print = print;
  }
  let c = meta(name);
  if (!c) {
    openSheet(`<div class="sheet-head"><h2>${esc(name)}</h2><button class="icon" data-act="closeSheet">✕</button></div><p class="muted">Loading card data…</p>`, ctx);
    try {
      c = await resolve(name, true);
    } catch (e) {
      $("#sheetBody").innerHTML = `<div class="sheet-head"><h2>${esc(name)}</h2><button class="icon" data-act="closeSheet">✕</button></div><div class="note warn">${esc(e.message)}</div><p class="muted small">Check the spelling. You can fix the name by removing this card and adding the correct one.</p>${ctx.deckId ? `<button class="link danger" data-act="deckRemove" data-name="${esc(name)}">Remove from deck</button>` : ""}`;
      return;
    }
  }
  ctx.name = c.name;
  openSheet(V.cardSheet(c, ctx), ctx);
  loadCardExtras(ctx);
};

// Full card (flavor text, artist) + every paper printing with prices, loaded in the background.
async function loadCardExtras(ctx) {
  let c = meta(ctx.name);
  const still = () => S.ui.sheetCtx === ctx && $("#sheet").open;
  try {
    if (c?.id && !c.full) {
      const full = await api("/cards/" + encodeURIComponent(c.id));
      c = cacheCard({ ...full, full: true }, [ctx.name]);
      saveCatalogSoon();
      if (still()) $("#sheetBody").innerHTML = V.cardSheet(c, ctx);
    }
    if (!c?.oracle_id) return;
    const prints = [];
    let path = "/cards/search?" + new URLSearchParams({ q: "oracleid:" + c.oracle_id + " game:paper", unique: "prints", order: "released", dir: "desc" });
    for (let page = 0; page < 3 && path; page++) {
      const d = await api(path);
      prints.push(...d.data);
      path = d.has_more && d.next_page ? new URL(d.next_page).pathname + new URL(d.next_page).search : null;
    }
    ctx.prints = prints;
    ctx.pricesAt = new Date().toISOString();
    S.ui.prints = prints;
    if (still()) refreshSheet();
  } catch (e) {
    ctx.prints = ctx.prints || [];
    if (still()) {
      refreshSheet();
      const l = $("#cardLoading");
      if (l) l.textContent = "Couldn’t load extra details: " + e.message;
    }
  }
}
A.viewPrint = (t) => {
  const ctx = S.ui.sheetCtx;
  if (!ctx?.prints) return;
  ctx.print = ctx.prints[Number(t.dataset.i)];
  ctx.face = 0;
  refreshSheet();
  $("#sheetBody").scrollTo({ top: 0, behavior: "smooth" });
};
A.flipFace = () => {
  const ctx = S.ui.sheetCtx;
  ctx.face = ctx.face ? 0 : 1;
  refreshSheet();
};
A.setCommander = async (t) => {
  const name = t?.dataset?.name || $("#cmdName")?.value.trim();
  if (!name) return toast("Tap a card or type a name.");
  const c = await resolve(name, true);
  if (!commanderEligible(c)) return toast(c.name + " can’t be a commander.");
  await editDeck((d) => ({ ...d, commander: c.name, name: d.name === "Imported deck" ? c.name.split(",")[0] + " deck" : d.name, cards: d.cards.some((x) => key(x.name) === key(c.name)) ? d.cards : [{ name: c.name, qty: 1 }, ...d.cards] }), { msg: c.name + " is now your commander." });
};

/* ---------- finder ---------- */
C.finderMax = (t) => {
  S.ui.finder.max = t.value === "" ? "" : String(Math.max(0, Number(t.value) || 0));
  render();
};
C.finderColors = (t) => {
  S.ui.finder.colors = t.value;
  render();
};
C.finderSort = (t) => {
  S.ui.finder.sort = t.value;
  render();
};
I.finderSearch = (t) => {
  S.ui.finder.q = t.value;
  rerenderKeepingFocus();
};
A.finderMore = () => {
  S.ui.finder.limit += 12;
  render();
};
// Download the next 10 Commander precons from MTGJSON and keep just their card lists.
A.finderPrecons = async () => {
  const F = S.ui.finder,
    P = S.ui.precon;
  if (F.busy) return;
  F.busy = true;
  F.msg = "Loading the precon list…";
  render();
  try {
    if (!P.index.length) {
      const j = await fetchJSON("https://mtgjson.com/api/v5/DeckList.json");
      P.index = (j.data || []).filter((d) => typeof d.fileName === "string" && typeof d.name === "string");
    }
    const have = new Set(F.precons.map((p) => p.file)),
      next = P.index
        .filter((d) => d.type === "Commander Deck" && !have.has(d.fileName) && /^[A-Za-z0-9_.-]+$/.test(d.fileName))
        .sort((a, b) => String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")))
        .slice(0, 10);
    if (!next.length) F.msg = "You’ve checked every Commander precon.";
    let i = 0;
    for (const d of next) {
      F.msg = `Checking ${++i}/${next.length}: ${d.name}…`;
      render();
      try {
        const p = mtgjsonDeck(await fetchJSON("https://mtgjson.com/api/v5/decks/" + d.fileName.replace(/\.json$/, "") + ".json"));
        F.precons.push({ file: d.fileName, name: p.name || d.name, commander: p.commander, released: d.releaseDate || "", format: "Commander", cards: p.cards.map((c) => ({ name: c.name, qty: c.qty })) });
      } catch {}
    }
    F.msg = "Loading prices…";
    render();
    await resolveNames(F.precons.flatMap((p) => p.cards.map((c) => c.name)));
    await writeRecord(PRECON_RECORD, { at: new Date().toISOString(), decks: F.precons }).catch(() => {});
    F.msg = next.length ? `${F.precons.length} precons checked` : F.msg;
  } catch (e) {
    F.msg = "Couldn’t reach MTGJSON (" + e.message + ")";
  } finally {
    F.busy = false;
    render();
  }
};
const preconCredit = (p) => sourceCredit({ url: "https://mtgjson.com/api/v5/decks/" + p.file, author: "Wizards of the Coast", kind: "MTGJSON precon", description: "Preconstructed deck list from MTGJSON." });
async function makeMyVersion(base, source, label) {
  const d = withSnapshot({ id: uid(), name: base.name + " · my version", format: base.format || "Commander", commander: base.commander || "", strategy: base.strategy || "Auto", budget: base.budget ?? S.state.settings.budget ?? 25, locked: false, about: base.about || "", source, cards: base.cards.map((c) => ({ name: c.name, qty: c.qty })), versions: [] }, label);
  await commit((s) => {
    s.decks.push(d);
    s.activeDeck = d.id;
  }, { msg: "Your version is ready. Your collection is unchanged." });
  go(`#deck/${d.id}/cards`);
}
A.finderBuild = async (t) => {
  if (t.dataset.kind === "saved") return A.copyRef(t);
  const p = S.ui.finder.precons.find((x) => x.file === t.dataset.id);
  if (p) await makeMyVersion(p, preconCredit(p), "From precon " + p.name);
};
A.finderSave = async (t) => {
  const p = S.ui.finder.precons.find((x) => x.file === t.dataset.id);
  if (!p) return;
  await commit((s) => (s.references = [...(s.references || []), { id: uid(), name: p.name, format: "Commander", commander: p.commander, strategy: "Auto", locked: false, source: preconCredit(p), cards: p.cards }]), { msg: "Saved to your decks to watch." });
};

/* ---------- shared decks ---------- */
const sharedCredit = (d) => sourceCredit({ url: sharedSourceURL(), author: d.author, description: d.about, kind: "Shared deck" });
A.sharedBuild = async () => {
  const d = S.ui.shared.deck;
  if (d) await makeMyVersion(d, sharedCredit(d), "From a deck shared by " + (d.author || "a player"));
};
A.sharedSave = async () => {
  const d = S.ui.shared.deck;
  if (!d) return;
  if ((S.state.references || []).some((r) => r.source?.url === sharedSourceURL())) return toast("Already in your saved decks.");
  await commit((s) => (s.references = [...(s.references || []), { id: uid(), name: d.name, format: d.format, commander: d.commander, strategy: d.strategy, about: d.about, locked: false, source: sharedCredit(d), cards: d.cards }]), { msg: "Saved — find it under Decks → Find decks." });
};
A.sharedCopy = () => S.ui.shared.deck && copyText(exportDeck(S.ui.shared.deck.cards), "Decklist copied.");
A.deckShare = () => {
  const d = currentDeck();
  if (d) openSheet(V.shareSheet(d), { type: "share", deckId: d.id });
};
A.shareMake = async () => {
  const ctx = S.ui.sheetCtx,
    author = $("#shareAuthor").value.trim().slice(0, 60),
    about = $("#shareAbout").value.trim().slice(0, 1500);
  await commit(
    (s) => {
      s.settings.authorName = author;
      const d = s.decks.find((x) => x.id === ctx.deckId);
      if (d) d.about = about;
    },
    { rerender: false, enrich: false },
  );
  const d = deckById(ctx.deckId),
    link = location.origin + location.pathname + "#shared/" + (await encodeShare(sharePayload(d, { author, about })));
  ctx.link = link;
  openSheet(V.shareSheet(d, link), ctx, $("#sheetBody").scrollTop);
};
A.shareCopy = () => copyText(S.ui.sheetCtx?.link || "", "Link copied — paste it anywhere.");
A.shareNative = async () => {
  const d = deckById(S.ui.sheetCtx?.deckId);
  try {
    await navigator.share({ title: d?.name || "Cardforge deck", text: "Check out my deck on Cardforge", url: S.ui.sheetCtx.link });
  } catch {}
};

/* ---------- sets ---------- */
A.set = (t) => {
  const code = t.dataset.code;
  if (!code) return;
  closeSheet();
  go("#set/" + encodeURIComponent(code.toLowerCase()));
};
I.setsSearch = (t) => {
  S.ui.sets.q = t.value;
  rerenderKeepingFocus();
};
C.setsAll = (t) => {
  S.ui.sets.all = t.checked;
  render();
};
A.setsReload = () => {
  S.ui.sets.error = "";
  loadSetIndex(true);
};
A.setReload = () => {
  setCache.delete(S.ui.set.code);
  Object.assign(S.ui.set, { info: null, cards: [], loaded: false, error: "" });
  render();
};
I.setSearch = (t) => {
  S.ui.set.q = t.value;
  S.ui.set.limit = 120;
  rerenderKeepingFocus();
};
A.setFilter = (t) => {
  S.ui.set.filter = t.dataset.id;
  S.ui.set.limit = 120;
  render();
};
C.setRarity = (t) => {
  S.ui.set.rarity = t.value;
  S.ui.set.limit = 120;
  render();
};
A.setMore = () => {
  S.ui.set.limit += 240;
  render();
};
C.setSort = (t) => {
  S.ui.set.sort = t.value;
  render();
};
// Re-render a list while the user types, keeping the cursor in the search box.
function rerenderKeepingFocus() {
  const el = document.activeElement,
    sel = el?.dataset?.input,
    pos = el?.selectionStart;
  render();
  if (sel) {
    const again = $(`[data-input="${sel}"]`);
    if (again) {
      again.focus();
      try {
        again.setSelectionRange(pos, pos);
      } catch {}
    }
  }
}

/* ---------- buy this card ---------- */
A.buyCard = async (t) => {
  let back = S.ui.sheetCtx?.type === "card" && $("#sheet").open ? S.ui.sheetCtx : null;
  const backScroll = back ? $("#sheetBody").scrollTop : 0;
  let print;
  if (back) {
    print = t.dataset.i !== undefined && back.prints ? back.prints[Number(t.dataset.i)] : back.print || meta(back.name);
  } else {
    const c = meta(t.dataset.name) || (await resolve(t.dataset.name, true));
    back = { type: "card", name: c.name, deckId: t.dataset.deck || null };
    print = c;
  }
  const fromPrints = back.prints && back.prints.includes(print);
  const ctx = { type: "buy", name: back.name, deckId: back.deckId, print, finish: t.dataset.finish || "nonfoil", asOf: fromPrints ? back.pricesAt : print?.checkedAt, back, backScroll };
  openSheet(V.buySheet(ctx), ctx);
};
A.buyFinish = (t) => {
  const ctx = S.ui.sheetCtx;
  if (ctx?.type !== "buy") return;
  ctx.finish = t.dataset.finish;
  refreshSheet();
};
function backToCard(scrollTo) {
  const ctx = S.ui.sheetCtx;
  if (ctx?.type !== "buy") return;
  const back = ctx.back,
    c = meta(back.name);
  if (!c) return closeSheet();
  openSheet(V.cardSheet(c, back), back, ctx.backScroll);
  if (!back.prints) loadCardExtras(back);
  if (scrollTo) $(scrollTo, $("#sheetBody"))?.scrollIntoView({ behavior: "smooth", block: "start" });
}
A.buyBack = () => backToCard();
A.buyCompare = () => backToCard(".prints");

/* ---------- deck review ---------- */
A.deckReview = () => {
  const d = currentDeck();
  if (d) openSheet(V.deckReviewSheet(d), { type: "review", deckId: d.id });
};

A.compareOpen = () => openSheet(V.compareSheet(), { type: "compare" });
A.compareFrom = (t) => {
  S.ui.compare = [meta(t.dataset.name), null];
  A.compareOpen();
};
A.compareReset = () => {
  S.ui.compare = [null, null];
  A.compareOpen();
};
A.compareLookup = async (t) => {
  const i = Number(t.dataset.i),
    v = $("#cmp" + i)?.value.trim();
  if (!v) return;
  const done = busy(t);
  try {
    S.ui.compare[i] = await resolve(v, true);
    A.compareOpen();
  } finally {
    done();
  }
};
A.compareSwap = async () => {
  const [a, b] = S.ui.compare,
    d = currentDeck();
  if (!a || !b || !d) return;
  if (key(a.name) === key(d.commander)) return toast("Change commanders by starting a new deck.");
  await commit(
    (s) => {
      const i = s.decks.findIndex((x) => x.id === d.id);
      let deck = withSnapshot(s.decks[i], "Before swapping " + a.name);
      deck = mergeDeckCard(mergeDeckCard(deck, a.name, -1), b.name, 1);
      s.decks[i] = deck;
    },
    { msg: `Swapped ${a.name} → ${b.name}. Compare in Versions.` },
  );
  closeSheet();
};

A.printings = async (t) => {
  const c = meta(t.dataset.name);
  if (!c?.oracle_id) return;
  const box = $("#printings");
  box.innerHTML = '<p class="muted small">Loading printings…</p>';
  try {
    const d = await api("/cards/search?" + new URLSearchParams({ q: "oracleid:" + c.oracle_id + " game:paper", unique: "prints", order: "usd", dir: "asc" }));
    const prints = d.data.filter((p) => p.prices && (p.prices.usd || p.prices.usd_foil || p.prices.usd_etched)).slice(0, 30);
    S.ui.prints = prints;
    const chosen = S.state.priceChoices?.[key(c.name)];
    box.innerHTML = `<p class="muted small">Cheapest first. Pick one to use its price for shopping totals.</p><div class="list compact">${prints
      .map((p, i) =>
        ["nonfoil", "foil", "etched"]
          .filter((f) => cardPrice(p, f) !== null)
          .map((f) => `<button class="mini-row ${chosen?.id === p.id && chosen?.finish === f ? "on" : ""}" data-act="choosePrint" data-i="${i}" data-finish="${f}" data-name="${esc(c.name)}"><span class="ellip">${esc(p.set_name)} <span class="muted small">${esc(p.set.toUpperCase())} #${esc(p.collector_number)} · ${f}</span></span><b>${usd(cardPrice(p, f))}</b></button>`)
          .join(""),
      )
      .join("") || '<p class="muted small">No priced printings.</p>'}</div>${chosen ? `<button class="link small" data-act="clearPrint" data-name="${esc(c.name)}">Use default price again</button>` : ""}`;
  } catch (e) {
    box.innerHTML = `<div class="note warn">${esc(e.message)}</div>`;
  }
};
A.choosePrint = async (t) => {
  const p = (S.ui.sheetCtx?.prints || S.ui.prints)?.[Number(t.dataset.i)],
    f = t.dataset.finish,
    name = t.dataset.name;
  if (!p) return;
  await commit((s) => {
    s.priceChoices = s.priceChoices || {};
    s.priceChoices[key(name)] = { price: cardPrice(p, f), finish: f, label: `${p.set.toUpperCase()} #${p.collector_number} · ${f}`, id: p.id, checkedAt: new Date().toISOString() };
  }, { msg: "Using that printing’s price. Ownership unchanged." });
};
A.clearPrint = async (t) => {
  await commit((s) => {
    if (s.priceChoices) delete s.priceChoices[key(t.dataset.name)];
  });
};

A.wish = async (t) => {
  const name = t.dataset.name,
    own = inventory(S.state.collection, name, S.state.decks).available;
  await commit((s) => {
    const w = s.wishlist.find((x) => key(x.name) === key(name));
    if (w) w.qty = Math.max(w.qty, own) + 1;
    else s.wishlist.push({ id: uid(), name, qty: own + 1, finish: "nonfoil" });
  }, { msg: "Added to wishlist." });
};

A.addToDeck = async (t) => {
  const id = $("#toDeck")?.value,
    d = deckById(id),
    name = t.dataset.name;
  if (!d) return;
  await commit((s) => {
    const i = s.decks.findIndex((x) => x.id === id);
    s.decks[i] = mergeDeckCard(s.decks[i], name, 1);
  }, { msg: `Added to ${d.name}.` });
};

/* =========================================================
   Add / edit a physical card
   ========================================================= */

function addSheet(entry = null, preset = {}) {
  const lookup = entry ? meta(entry.name) : preset.card || null;
  S.ui.sheetCtx = { type: "add", entry, lookup };
  openSheet(
    `<div class="sheet-head"><h2>${entry ? "Edit card" : "Add to collection"}</h2><button class="icon" data-act="closeSheet">✕</button></div>
    ${entry ? "" : segmented("addMode", "one", [["one", "One card"], ["list", "Paste or upload a list"]])}
    <div class="searchbar"><input id="addName" value="${esc(entry?.name || lookup?.name || preset.name || "")}" placeholder="Card name, e.g. Sol Ring" data-enter="addLookup" autocomplete="off" aria-label="Card name"><button class="btn ghost" data-act="addLookup">Look up</button></div>
    <div id="addPreview">${lookup ? addPreview(lookup) : '<p class="muted small">Look up the card, check the picture, then save.</p>'}</div>
    <div class="grid2">
      <label>Copies<input id="addQty" type="number" min="1" max="100000" value="${entry?.qty || preset.qty || 1}"></label>
      <label>Finish<select id="addFinish">${options([["nonfoil", "Nonfoil"], ["foil", "Foil"], ["etched", "Etched"]], entry?.finish || preset.finish || "nonfoil")}</select></label>
      <label>Condition<select id="addCondition">${options(["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"].map((x) => [x, x]), entry?.condition || "Near Mint")}</select></label>
      <label>Language<select id="addLanguage">${options([["en", "English"], ["ja", "Japanese"], ["de", "German"], ["fr", "French"], ["es", "Spanish"], ["it", "Italian"], ["pt", "Portuguese"], ["ru", "Russian"], ["ko", "Korean"], ["zhs", "Chinese (S)"], ["zht", "Chinese (T)"]], entry?.language || "en")}</select></label>
      <label class="span2">Where it lives<input id="addLocation" maxlength="100" placeholder="Binder A, red box…" value="${esc(entry?.location || preset.location || "")}"></label>
    </div>
    <details class="more" ${entry?.set || preset.set ? "open" : ""}><summary>Exact printing (optional)</summary><div class="grid2"><label>Set code<input id="addSet" placeholder="e.g. CMM" value="${esc(entry?.set || preset.set || "")}"></label><label>Collector #<input id="addNumber" value="${esc(entry?.collectorNumber || preset.number || "")}"></label></div><p class="muted small">Leave blank if unsure — Cardforge never guesses an edition.</p></details>
    <p id="addError" class="error" role="alert"></p>
    <div class="actions"><button class="btn" data-act="addSave" ${lookup ? "" : "disabled"} id="addSaveBtn">${entry ? "Save changes" : "Add to collection"}</button><button class="link small" data-act="addSaveRaw">Save without lookup</button>${entry ? `<button class="link small danger" data-act="addDelete">Delete</button>` : ""}</div>`,
    S.ui.sheetCtx,
  );
}
const addPreview = (c) =>
  `<div class="add-preview">${img(cardImage(c, "small") || cardImage(c), c.name, "card-img")}<div><b>${esc(c.name)}</b><p class="muted small">${esc(typeText(c))}</p><p class="small">${usd(cardPrice(c))} · ${esc((c.set || "").toUpperCase())}</p></div></div>`;

A.addCard = () => addSheet();
A.addMode = (t) => (t.dataset.id === "list" ? importCollectionSheet() : addSheet());
A.editLot = (t) => addSheet(S.state.collection.find((e) => e.id === t.dataset.id));
A.own = async (t) => {
  const ctx = S.ui.sheetCtx,
    name = t.dataset.name,
    d = ctx?.deckId ? deckById(ctx.deckId) : null,
    row = d ? V.rowsFor(d).find((r) => key(r.name) === key(name)) : null,
    // The printing being looked at (card details or Buy sheet), so the copy is saved as that edition.
    print = ctx?.print && key(ctx.print.name) === key(name) ? ctx.print : null;
  addSheet(null, { card: print || meta(name), name, qty: row?.missing || 1, set: print?.set?.toUpperCase(), number: print?.collector_number, finish: ctx?.type === "buy" ? ctx.finish : null });
};
A.addLookup = async () => {
  const name = $("#addName").value.trim();
  if (!name) return;
  $("#addError").textContent = "";
  $("#addPreview").innerHTML = '<p class="muted small">Looking up…</p>';
  try {
    const c = await resolve(name, true);
    S.ui.sheetCtx.lookup = c;
    $("#addName").value = c.name;
    $("#addPreview").innerHTML = addPreview(c);
    $("#addSaveBtn").disabled = false;
  } catch (e) {
    S.ui.sheetCtx.lookup = null;
    $("#addPreview").innerHTML = "";
    $("#addError").textContent = e.message;
    $("#addSaveBtn").disabled = true;
  }
};
A.addSave = () => saveLot(false);
A.addSaveRaw = () => saveLot(true);
A.addDelete = async () => {
  const e = S.ui.sheetCtx?.entry;
  if (!e || !confirm(`Delete ${e.qty}× ${e.name} from your collection?`)) return;
  await commit((s) => (s.collection = s.collection.filter((x) => x.id !== e.id)), { msg: "Removed from collection." });
  closeSheet();
};

async function saveLot(unverified) {
  const ctx = S.ui.sheetCtx,
    editing = ctx?.entry,
    name = unverified ? $("#addName").value.trim() : ctx?.lookup?.name,
    err = $("#addError");
  if (!name) return (err.textContent = "Look up or type a card name first.");
  const qty = Number($("#addQty").value);
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return (err.textContent = "Copies must be a whole number from 1 to 100000.");
  const e = {
    ...(editing || {}),
    id: editing?.id || uid(),
    name,
    qty,
    set: $("#addSet").value.trim(),
    collectorNumber: $("#addNumber").value.trim(),
    finish: $("#addFinish").value,
    language: $("#addLanguage").value,
    condition: $("#addCondition").value,
    location: $("#addLocation").value.trim(),
    reserved: Math.min(editing?.reserved || 0, qty),
    printingId: null,
    printingVerified: false,
    raw: editing?.raw || {},
  };
  delete e.lookupFailed;
  const done = busy($("#addSaveBtn"), "Saving…");
  try {
    if (!unverified && e.set && e.collectorNumber) {
      const c = await verifyPhysical(e);
      if (key(c.name) !== key(name)) throw Error(`That set and number is ${c.name}, not ${name}.`);
      Object.assign(e, verifiedLot(e, c));
    } else if (!unverified) e.nameVerified = true;
    await commit(
      (s) => {
        s.collection = editing ? s.collection.map((x) => (x.id === e.id ? e : x)) : [...s.collection, e];
        s.example = false;
        s.printings = { ...s.printings, ...(S.pendingPrintings || {}) };
      },
      { msg: editing ? "Saved." : `${qty}× ${name} added.` },
    );
    S.pendingPrintings = null;
    closeSheet();
  } catch (x) {
    err.textContent = x.message;
  } finally {
    done();
  }
}

let setsIndex = null;
function verifiedLot(e, c) {
  if (e.name && key(e.name) !== key(c.name)) throw Error("That printing is " + c.name + "; check the name.");
  if (e.set && e.set.toLowerCase() !== c.set.toLowerCase()) throw Error("Printing ID and set disagree.");
  if (e.collectorNumber && String(e.collectorNumber) !== String(c.collector_number)) throw Error("Printing ID and collector number disagree.");
  if (e.finish && Array.isArray(c.finishes) && !c.finishes.includes(e.finish)) throw Error(`This printing doesn’t come in ${e.finish}.`);
  const copy = slim({ ...c, checkedAt: c.checkedAt || new Date().toISOString() });
  S.pendingPrintings = { ...(S.pendingPrintings || {}), [c.id]: copy };
  if (!meta(c.name)) cacheCard(c);
  return {
    ...e, name: c.name, printingId: c.id, oracleId: c.oracle_id, set: c.set.toUpperCase(), setName: c.set_name,
    collectorNumber: c.collector_number, language: c.lang || e.language || "en", printingVerified: true, nameVerified: true,
  };
}
async function verifyPhysical(e) {
  if (e.printingId) return S.state.printings?.[e.printingId] || (await api("/cards/" + encodeURIComponent(e.printingId)));
  let set = e.set?.trim();
  if (!set && e.setName) {
    if (!setsIndex) setsIndex = (await api("/sets")).data;
    const m = setsIndex.find((s) => key(s.name) === key(e.setName));
    if (!m) throw Error("Set name not recognized; enter a set code.");
    set = m.code;
  }
  if (set && e.collectorNumber)
    return api(`/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(e.collectorNumber)}/${encodeURIComponent(e.language || "en")}`).catch(() =>
      api(`/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(e.collectorNumber)}`),
    );
  if (set && e.name) {
    const r = await api("/cards/search?" + new URLSearchParams({ q: `!"${e.name.replace(/"/g, "")}" set:${set} game:paper`, unique: "prints" }));
    if (r.total_cards !== 1) {
      e.candidates = r.data.slice(0, 30);
      throw Error("Several printings match. Pick one.");
    }
    return r.data[0];
  }
  throw Error("Exact printing needs a set code and collector number.");
}
async function verifyLot(e) {
  try {
    return { ...verifiedLot(e, await verifyPhysical(e)), review: "Exact printing verified", candidates: [] };
  } catch (error) {
    if (!e.printingId && !e.set && !e.setName && !e.collectorNumber && e.name) {
      try {
        const c = await resolve(e.name, true);
        return { ...e, name: c.name, nameVerified: true, printingVerified: false, review: "Name verified · printing unspecified" };
      } catch {}
    }
    return { ...e, review: error.message, printingVerified: false };
  }
}

/* collection list actions */

A.qty = async (t) => {
  const id = t.dataset.id,
    delta = Number(t.dataset.delta),
    e = S.state.collection.find((x) => x.id === id);
  if (!e) return;
  if (e.qty + delta <= 0 && !confirm(`Remove ${e.name} from your collection?`)) return;
  await commit((s) => {
    const x = s.collection.find((y) => y.id === id);
    x.qty = Math.max(0, x.qty + delta);
    x.reserved = Math.min(x.reserved || 0, x.qty);
    s.collection = s.collection.filter((y) => y.qty > 0);
  });
};
I.collSearch = (t) => {
  S.ui.q.coll = t.value;
  S.ui.collLimit = 120;
  $("#collList").innerHTML = V.collectionList();
};
C.collSort = (t) => {
  S.ui.collSort = t.value;
  $("#collList").innerHTML = V.collectionList();
};
C.collFilter = (t) => {
  S.ui.collFilter = t.value;
  $("#collList").innerHTML = V.collectionList();
};
A.collMore = () => {
  S.ui.collLimit += 200;
  $("#collList").innerHTML = V.collectionList();
};
A.collMenu = () =>
  openSheet(`<div class="sheet-head"><h2>Collection</h2><button class="icon" data-act="closeSheet">✕</button></div><div class="menu-list">
    <button data-act="importCollection">↥ Import a list or CSV</button>
    <button data-act="exportCSV">↓ Export CSV (ManaBox-style)</button>
    <button data-act="retryLookups">⟳ Retry cards that weren’t found</button>
    <button data-act="refreshPrices">$ Refresh all prices</button>
    <button data-act="verifyAll">✓ Verify exact printings</button>
  </div><p class="muted small" id="collMenuMsg"></p>`);
A.exportCSV = () => download("Cardforge_Collection.csv", exportCollectionCSV(S.state.collection), "text/csv");
A.retryLookups = async () => {
  await commit((s) => s.collection.forEach((e) => delete e.lookupFailed), { msg: "Looking cards up again…" });
};
A.loadAllData = async (t) => {
  const done = busy(t, "Loading…"),
    msg = (x) => ($("#collMenuMsg") ? ($("#collMenuMsg").textContent = x) : toast(x));
  try {
    const r = await resolveNames(S.state.collection.map((e) => e.name), msg);
    await commit((s) => {
      for (const e of s.collection) {
        const m = r.matched.get(key(e.name));
        if (m) {
          e.name = m;
          e.nameVerified = true;
        }
      }
    });
    msg(`${r.total - r.failed.length} cards loaded${r.failed.length ? `, ${r.failed.length} not found: ${r.failed.slice(0, 5).join(", ")}` : ""}.`);
  } finally {
    done();
  }
};
A.refreshPrices = async (t) => {
  const done = busy(t, "Refreshing…");
  try {
    const r = await resolveNames(S.state.collection.map((e) => e.name), (m) => toast(m), true);
    trackValue();
    await save();
    render();
    toast(`Prices refreshed for ${r.total - r.failed.length} cards.`);
  } finally {
    done();
  }
};
A.verifyAll = async (t) => {
  const done = busy(t, "Checking…"),
    list = S.state.collection.filter((e) => !e.printingVerified && (e.printingId || ((e.set || e.setName) && e.collectorNumber)));
  try {
    if (!list.length) return toast("No records have set + collector number to verify. Edit a card to add them.");
    const updated = new Map();
    for (let i = 0; i < list.length; i++) {
      if ($("#collMenuMsg")) $("#collMenuMsg").textContent = `Checking ${i + 1}/${list.length}…`;
      updated.set(list[i].id, await verifyLot(list[i]));
    }
    await commit((s) => {
      s.collection = s.collection.map((e) => updated.get(e.id) || e);
      s.printings = { ...s.printings, ...(S.pendingPrintings || {}) };
    }, { msg: "Verification saved." });
    S.pendingPrintings = null;
  } finally {
    done();
  }
};
A.copySpare = () => {
  const v = collectionValue(S.state.collection, S.catalog, S.state.printings, S.state.decks);
  copyText(exportDeck(v.spare.map((x) => ({ name: x.name, qty: x.qty }))), "Trade binder list copied.");
};

/* wishlist & shopping */

A.wishAdd = async () => {
  const input = $("#wishName"),
    name = input?.value.trim();
  if (!name) return;
  const c = await resolve(name, true);
  input.value = "";
  await A.wish({ dataset: { name: c.name } });
};
A.wishRemove = async (t) => commit((s) => (s.wishlist = s.wishlist.filter((w) => w.id !== t.dataset.id)));
C.setting = async (t) => {
  const f = t.dataset.field,
    v = Math.min(f === "tax" ? 100 : 100000, Math.max(0, Number(t.value) || 0));
  await commit((s) => (s.settings[f] = v));
};
function missingList(d) {
  return V.rowsFor(d).filter((r) => r.missing).map((r) => ({ name: r.name, qty: r.missing }));
}
A.copyShopping = (t) => {
  const items = t.dataset.src === "wish" ? V.wishlistItems().map((w) => ({ name: w.name, qty: w.need })) : missingList(currentDeck());
  copyText(exportDeck(items), `${sumQty(items)} cards copied — paste into TCGplayer Mass Entry.`);
};
A.exportMissing = () => {
  const d = currentDeck();
  download(`Cardforge_${fileSafe(d.name)}_missing.txt`, exportDeck(missingList(d)) + "\n");
};

/* =========================================================
   Collection import
   ========================================================= */

let impDraft = null,
  impBusy = false;
function importCollectionSheet() {
  impDraft = null;
  openSheet(
    `<div class="sheet-head"><h2>Import cards you own</h2><button class="icon" data-act="closeSheet">✕</button></div>
    ${segmented("addMode", "list", [["one", "One card"], ["list", "Paste or upload a list"]])}
    <p class="muted small">Paste “4 Lightning Bolt” lines, or upload a ManaBox / Moxfield / Deckbox CSV. You’ll review everything before it’s saved.</p>
    <textarea id="impText" rows="6" data-input="impText" placeholder="1 Sol Ring&#10;4 Lightning Bolt (2X2) 117&#10;— or a CSV with Name, Quantity, Set code…"></textarea>
    <label class="btn ghost file">Choose .txt / .csv<input type="file" accept=".txt,.csv" data-change="impFile" hidden></label>
    <div class="grid2"><label>Source name<input id="impSource" value="My collection import" maxlength="100"></label><label>How to apply<select id="impMode">${options([["append", "Add to my collection"], ["replace-source", "Replace earlier import with this name"], ["replace-all", "Replace entire collection"]], "append")}</select></label></div>
    <p id="impError" class="error" role="alert"></p>
    <div class="actions"><button class="btn ghost" data-act="impPreview">Preview</button><button class="btn" data-act="impApply" id="impApply" disabled>Import</button></div>
    <div id="impPreview"></div>`,
    { type: "import" },
  );
}
A.importCollection = importCollectionSheet;
I.impText = () => {
  if (impBusy) return;
  impDraft = null;
  $("#impPreview").innerHTML = "";
  $("#impApply").disabled = true;
};
C.impFile = async (t) => {
  const f = t.files[0];
  if (!f) return;
  if (f.size > 30e6) return toast("Use a file under 30 MB.");
  $("#impText").value = await f.text();
  $("#impSource").value = f.name.replace(/\.[^.]+$/, "");
  I.impText();
  await A.impPreview();
};
A.impPreview = async () => {
  try {
    const raw = $("#impText").value,
      parsed = parseImport(raw),
      buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
      hash = [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
    impDraft = previewImport(parsed, S.state.collection, hash, S.state.importHistory || []);
    for (const e of impDraft.lots) {
      e.include = true;
      e.review = printingState(e);
    }
    drawImport();
  } catch (e) {
    $("#impError").textContent = e.message;
  }
};
function drawImport() {
  if (!impDraft) return;
  $("#impError").textContent = "";
  const sel = impDraft.lots.filter((e) => e.include !== false);
  $("#impApply").disabled = impBusy || !sel.length || sel.some((e) => !e.name);
  $("#impApply").textContent = `Import ${sumQty(sel)} cards`;
  $("#impPreview").innerHTML = `<p class="small"><b>${impDraft.total}</b> copies · ${impDraft.lots.length} rows${impDraft.errors.length ? ` · <span class="warn-text">${impDraft.errors.length} lines skipped</span> <button class="link small" data-act="impErrors">download</button>` : ""} · ${esc(impDraft.source)}</p>
  ${impDraft.repeated ? `<div class="note warn">You imported this exact file before. Use “Replace earlier import” so cards aren’t counted twice.</div>` : ""}
  ${impDraft.overlappingLots ? `<div class="note warn">${impDraft.overlappingLots} rows match cards already in your collection — they may be the same physical cards.</div>` : ""}
  <div class="actions"><button class="btn ghost small" data-act="impVerify" ${impBusy ? "disabled" : ""}>${impBusy ? "Checking…" : "Check names & printings"}</button></div>
  <div class="list compact">${impDraft.lots
    .slice(0, 400)
    .map((e, i) => `<label class="mini-row"><span class="row"><input type="checkbox" data-change="impUse" data-i="${i}" ${e.include !== false ? "checked" : ""}><span class="ellip">${e.qty}× ${esc(e.name || "Unknown")} <span class="muted small">${esc(e.set || "")} ${esc(e.collectorNumber || "")} ${e.finish !== "nonfoil" ? esc(e.finish) : ""}</span></span></span><span class="muted small">${esc(e.review || "")}</span>${e.candidates?.length ? `<select data-change="impPrinting" data-i="${i}"><option value="">Pick printing</option>${e.candidates.map((c, j) => `<option value="${j}">${esc(c.set.toUpperCase())} #${esc(c.collector_number)}</option>`).join("")}</select>` : ""}</label>`)
    .join("")}${impDraft.lots.length > 400 ? `<p class="muted small">…and ${impDraft.lots.length - 400} more rows.</p>` : ""}</div>`;
}
C.impUse = (t) => {
  impDraft.lots[Number(t.dataset.i)].include = t.checked;
  drawImport();
};
C.impPrinting = (t) => {
  if (t.value === "") return;
  const i = Number(t.dataset.i),
    e = impDraft.lots[i];
  try {
    impDraft.lots[i] = { ...verifiedLot(e, e.candidates[Number(t.value)]), candidates: [], review: "Printing selected" };
  } catch (x) {
    toast(x.message);
  }
  drawImport();
};
A.impErrors = () => download("Cardforge_Import_Errors.csv", importErrorsCSV(impDraft.errors), "text/csv");
A.impVerify = async () => {
  if (!impDraft || impBusy) return;
  impBusy = true;
  drawImport();
  try {
    const names = impDraft.lots.filter((e) => e.include !== false && !e.printingId && !(e.set && e.collectorNumber)).map((e) => e.name);
    const r = await resolveNames(names, (m) => ($("#impError").textContent = m));
    for (let i = 0; i < impDraft.lots.length; i++) {
      const e = impDraft.lots[i];
      if (e.include === false) continue;
      if (e.printingId || (e.set && e.collectorNumber)) impDraft.lots[i] = await verifyLot(e);
      else if (r.matched.has(key(e.name))) impDraft.lots[i] = { ...e, name: r.matched.get(key(e.name)), nameVerified: true, review: "Name verified" };
      else if (meta(e.name)) impDraft.lots[i] = { ...e, nameVerified: true, review: "Name verified" };
      else impDraft.lots[i] = { ...e, review: "Name not found" };
    }
  } finally {
    impBusy = false;
    $("#impError").textContent = "";
    drawImport();
  }
};
A.impApply = async () => {
  if (!impDraft || impBusy) return;
  const rows = impDraft.lots.filter((e) => e.include !== false),
    mode = $("#impMode").value,
    sourceKey = $("#impSource").value.trim();
  try {
    if (!sourceKey) throw Error("Give this import a source name.");
    if (mode === "replace-all" && !confirm("Replace your whole collection? A recovery copy is kept, but export a backup first.")) return;
    await commit(
      (s) => {
        const lots = rows.map((e) => {
          const { candidates, review, rawRows, include, ...lot } = e;
          void candidates, void review, void rawRows, void include;
          return lot;
        });
        s.collection = applyImport(s.collection, { ...impDraft, lots }, mode, sourceKey, uid);
        s.importHistory = [...(s.importHistory || []), { id: uid(), hash: impDraft.hash, sourceKey, mode, date: new Date().toISOString(), qty: sumQty(rows) }].slice(-200);
        s.printings = { ...s.printings, ...(S.pendingPrintings || {}) };
        s.example = false;
      },
      { msg: `${sumQty(rows)} cards imported.`, recovery: mode === "replace-all" },
    );
    S.pendingPrintings = null;
    trackValue();
    closeSheet();
    go("#collection/cards");
  } catch (e) {
    $("#impError").textContent = e.message;
  }
};

/* =========================================================
   Decks: create, import, menu, edit
   ========================================================= */

A.newDeck = (t) => {
  const commander = t?.dataset?.commander || "";
  openSheet(
    `<div class="sheet-head"><h2>New deck</h2><button class="icon" data-act="closeSheet">✕</button></div>
    <div class="grid2">
      <label class="span2">Commander<input id="ndCommander" value="${esc(commander)}" placeholder="e.g. Giada, Font of Hope" autocomplete="off"></label>
      <label class="span2">Deck name<input id="ndName" maxlength="100" placeholder="Optional"></label>
      <label>Format<select id="ndFormat">${options([["Commander", "Commander"], ["60-card casual", "60-card casual"]], "Commander")}</select></label>
      <label>Budget $<input id="ndBudget" type="number" min="0" value="${S.state.settings.budget || 25}"></label>
    </div>
    <p id="ndError" class="error" role="alert"></p>
    <button class="btn block" data-act="newDeckSave">Create deck</button>
    <p class="muted small">Single commander only (partners and backgrounds aren’t supported yet).</p>`,
    { type: "newDeck" },
  );
};
A.newDeckSave = async (t) => {
  const done = busy(t, "Checking…"),
    format = $("#ndFormat").value,
    cn = $("#ndCommander").value.trim();
  try {
    let c = null;
    if (format === "Commander") {
      if (!cn) throw Error("Enter a commander.");
      c = await resolve(cn, true);
      if (!commanderEligible(c)) throw Error(c.name + " can’t be a commander.");
    }
    const d = {
      id: uid(),
      name: $("#ndName").value.trim() || (c ? c.name.split(",")[0] + " deck" : "New deck"),
      format,
      commander: c?.name || "",
      strategy: "Auto",
      budget: Math.max(0, Number($("#ndBudget").value) || 0),
      locked: false,
      cards: c ? [{ name: c.name, qty: 1 }] : [],
      versions: [],
    };
    await commit((s) => {
      s.decks.push(d);
      s.activeDeck = d.id;
    });
    closeSheet();
    go(`#deck/${d.id}/${c ? "upgrade" : "cards"}`);
    toast(c ? "Deck created. Fill the open slots from your collection here." : "Deck created.");
  } catch (e) {
    $("#ndError").textContent = e.message;
  } finally {
    done();
  }
};

let dImp = null,
  dImpBusy = false;
function deckImportSheet(preset = {}) {
  dImp = null;
  openSheet(
    `<div class="sheet-head"><h2>${preset.destination === "library" ? "Save a deck idea" : "Import a deck"}</h2><button class="icon" data-act="closeSheet">✕</button></div>
    <p class="muted small">Paste a list (Moxfield, Archidekt, ManaBox: Export → Text) or upload .txt / .csv / MTGJSON .json. Importing never changes your collection.</p>
    <textarea id="dImpText" rows="7" data-input="dImpText" placeholder="Commander&#10;1 Giada, Font of Hope&#10;&#10;Deck&#10;1 Sol Ring&#10;30 Plains">${esc(preset.text || "")}</textarea>
    <label class="btn ghost file">Upload a file<input type="file" accept=".txt,.csv,.json,.dek" data-change="dImpFile" hidden></label>
    <div class="grid2">
      <label>Deck name<input id="dImpName" maxlength="100" value="${esc(preset.name || "Imported deck")}"></label>
      <label>Commander<input id="dImpCommander" value="${esc(preset.commander || "")}" placeholder="Read from the list"></label>
      <label>Format<select id="dImpFormat">${options([["Commander", "Commander"], ["60-card casual", "60-card casual"]], preset.format || "Commander")}</select></label>
      <label>Save as<select id="dImpDest">${options([["new", "New deck"], ...(currentDeck() ? [["replace", "Replace " + currentDeck().name.slice(0, 24)]] : []), ["library", "Idea (inspiration)"]], preset.destination || "new")}</select></label>
    </div>
    <details class="more" ${preset.url ? "open" : ""}><summary>Credit the creator (optional)</summary><div class="grid2"><label class="span2">Original link<input id="dImpURL" type="url" value="${esc(preset.url || "")}" placeholder="https://moxfield.com/decks/…"></label><label>Author<input id="dImpAuthor" maxlength="100" value="${esc(preset.author || "")}"></label><label>Kind<select id="dImpKind">${options(["User export", "Community deck", "Purchased precon", "MTGJSON precon"].map((x) => [x, x]), preset.kind || "User export")}</select></label><label class="span2">Notes<textarea id="dImpDesc" rows="2" maxlength="3000">${esc(preset.description || "")}</textarea></label></div></details>
    <p id="dImpStatus" class="muted small" role="status"></p>
    <div class="actions"><button class="btn ghost" data-act="dImpPreview" id="dImpPreviewBtn">Preview & match</button><button class="btn" data-act="dImpSave" id="dImpSave" disabled>Save deck</button></div>
    <div id="dImpResults"></div>`,
    { type: "deckImport" },
  );
}
A.importDeck = () => deckImportSheet();
A.importReference = () => deckImportSheet({ destination: "library", kind: "Community deck" });
I.dImpText = () => {
  dImp = null;
  $("#dImpSave").disabled = true;
  $("#dImpResults").innerHTML = "";
};
C.dImpFile = async (t) => {
  const f = t.files[0];
  if (!f) return;
  if (f.size > 5e6) return toast("Use a file under 5 MB.");
  $("#dImpText").value = await f.text();
  $("#dImpName").value = f.name.replace(/\.[^.]+$/, "");
  I.dImpText();
  await A.dImpPreview();
};
function dImpCandidate() {
  const format = $("#dImpFormat").value;
  return {
    id: $("#dImpDest").value === "replace" ? currentDeck()?.id : "preview",
    name: $("#dImpName").value.trim() || "Imported deck",
    format,
    commander: format === "Commander" ? $("#dImpCommander").value.trim() : "",
    strategy: "Auto",
    budget: S.state.settings.budget || 25,
    locked: false,
    source: sourceCredit({ url: $("#dImpURL").value, author: $("#dImpAuthor").value, description: $("#dImpDesc").value, kind: $("#dImpKind").value }),
    cards: deckRowsFromImport(dImp.cards.map((c) => ({ name: meta(c.name)?.name || c.name, qty: c.qty }))),
  };
}
function drawDeckImport() {
  if (!dImp) return;
  let d;
  try {
    d = dImpCandidate();
  } catch (e) {
    $("#dImpStatus").textContent = e.message;
    return;
  }
  const rows = V.rowsFor(d),
    t = rows.reduce((a, r) => ({ copies: a.copies + r.qty, covered: a.covered + r.covered, missing: a.missing + r.missing, gap: a.gap + (r.price ?? 0) * r.missing }), { copies: 0, covered: 0, missing: 0, gap: 0 }),
    unresolved = rows.filter((r) => !meta(r.name));
  $("#dImpResults").innerHTML = `<div class="kpis small"><div class="kpi"><b>${t.copies}</b><span>cards</span></div><div class="kpi"><b>${t.covered}</b><span>you own</span></div><div class="kpi"><b>${usd(t.gap, 0)}</b><span>to finish</span></div></div>
  ${dImp.excluded ? `<p class="muted small">${dImp.excluded} sideboard / maybeboard cards left out.</p>` : ""}
  ${dImp.errors.length ? `<div class="note warn">${dImp.errors.length} lines skipped: ${dImp.errors.slice(0, 3).map((e) => esc("line " + e.line)).join(", ")}</div>` : ""}
  ${unresolved.length ? `<div class="note warn">Not recognized: ${unresolved.slice(0, 8).map((r) => esc(r.name)).join(", ")}${unresolved.length > 8 ? "…" : ""}. You can save anyway and fix them later.</div>` : ""}
  <div class="list compact">${rows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => `<div class="mini-row"><span class="ellip">${r.qty > 1 ? r.qty + "× " : ""}${esc(r.name)}</span><span class="small ${r.missing ? "warn-text" : "ok-text"}">${r.missing ? "need " + r.missing : "owned"}</span></div>`)
    .join("")}</div>`;
  $("#dImpSave").disabled = dImpBusy;
}
A.dImpPreview = async () => {
  if (dImpBusy) return;
  const raw = $("#dImpText").value;
  try {
    dImp = /^\s*\{/.test(raw) ? mtgjsonDeck(JSON.parse(raw)) : parseDeckImport(raw);
    if (dImp.multipleCommanders) throw Error("This deck has two commanders; pairs aren’t supported yet.");
    if (dImp.cards.length > 1000) throw Error("That’s more than 1000 different cards — use collection import instead.");
    if (dImp.name && $("#dImpName").value === "Imported deck") $("#dImpName").value = dImp.name;
    if (!$("#dImpCommander").value && dImp.commander) $("#dImpCommander").value = dImp.commander;
    dImpBusy = true;
    const btn = busy($("#dImpPreviewBtn"), "Loading…");
    drawDeckImport();
    const r = await resolveNames(dImp.cards.map((c) => c.name), (m) => ($("#dImpStatus").textContent = m));
    // A list without a commander section: guess a legendary creature if there's exactly one.
    if (!$("#dImpCommander").value && $("#dImpFormat").value === "Commander") {
      const legends = dImp.cards.filter((c) => commanderEligible(meta(c.name)));
      if (legends.length === 1) $("#dImpCommander").value = meta(legends[0].name).name;
    }
    $("#dImpStatus").textContent = r.failed.length ? `${r.failed.length} names weren’t found.` : "Matched against your collection.";
    btn();
  } catch (e) {
    dImp = null;
    $("#dImpStatus").textContent = e.message;
    $("#dImpResults").innerHTML = "";
  } finally {
    dImpBusy = false;
    if (dImp) drawDeckImport();
  }
};
A.dImpSave = async (t) => {
  if (!dImp || dImpBusy) return;
  const done = busy(t, "Saving…");
  try {
    const d = dImpCandidate(),
      dest = $("#dImpDest").value;
    if (d.name === "Imported deck" && d.commander) d.name = d.commander.split(",")[0] + " deck";
    if (d.commander) {
      const c = await resolve(d.commander, true);
      if (!commanderEligible(c)) throw Error(c.name + " can’t be a commander.");
      d.commander = c.name;
      if (!d.cards.some((x) => key(x.name) === key(c.name))) d.cards.unshift({ name: c.name, qty: 1 });
    }
    if (dest === "library") {
      d.id = uid();
      await commit((s) => (s.references = [...(s.references || []), d]), { msg: "Saved to Inspiration. No cards added to your collection." });
      closeSheet();
      return go("#decks/inspiration");
    }
    if (dest === "replace") {
      const old = currentDeck();
      if (!confirm(`Replace the cards in ${old.name}? The old list is kept in Versions.`)) return;
      await commit((s) => {
        const i = s.decks.findIndex((x) => x.id === old.id);
        const snap = withSnapshot(s.decks[i], "Before re-import");
        s.decks[i] = withSnapshot({ ...snap, name: d.name, format: d.format, commander: d.commander, source: d.source, cards: d.cards }, "Re-imported");
      });
      closeSheet();
      return go(`#deck/${old.id}/versions`);
    }
    d.id = uid();
    const deck = withSnapshot(d, "Imported");
    await commit((s) => {
      s.decks.push(deck);
      s.activeDeck = deck.id;
    }, { msg: "Deck imported. Your collection is unchanged." });
    closeSheet();
    go(`#deck/${deck.id}/cards`);
  } catch (e) {
    $("#dImpStatus").textContent = e.message;
  } finally {
    done();
  }
};
document.addEventListener("change", (e) => {
  if (["dImpFormat", "dImpCommander", "dImpDest"].includes(e.target.id)) drawDeckImport();
});

A.deckMenu = () => {
  const d = currentDeck();
  openSheet(
    `<div class="sheet-head"><h2>Deck options</h2><button class="icon" data-act="closeSheet">✕</button></div>
    <div class="grid2"><label class="span2">Name<input id="dmName" maxlength="100" value="${esc(d.name)}"></label><label>Budget $<input id="dmBudget" type="number" min="0" value="${d.budget ?? 25}"></label><label>Focus<select id="dmStrategy">${options(["Auto", "Tokens", "Dragons", "Graveyard", "Spells", "Artifacts", "Lifegain", "Landfall", "Creature"].map((x) => [x, x]), d.strategy || "Auto")}</select></label></div>
    <button class="btn block" data-act="deckSaveInfo">Save</button>
    <label class="check toggle"><input type="checkbox" data-change="deckLock" ${d.locked ? "checked" : ""}> <span><b>Assembled</b> — reserve these copies so other decks don’t count them as free</span></label>
    <div class="menu-list">
      <button data-act="snapshot">◷ Save a version now</button>
      <button data-act="deckCopy">⧉ Copy decklist</button>
      <button data-act="deckExport">↓ Download decklist (.txt)</button>
      <button data-act="refreshDeck">⟳ Refresh card data & prices</button>
      <button data-act="deckShare">🔗 Share this deck (link)</button>
      <button data-act="proxies" data-scope="all">🖨 Print playtest proxies (whole deck)</button>
      <button data-act="deckBought">✓ I bought this deck — add all cards to my collection</button>
      <button data-act="deckDup">⧉ Duplicate deck</button>
      <button data-act="importDeck">↥ Re-import / replace list</button>
      <button data-act="deckDelete" class="danger">✕ Delete deck</button>
    </div>${d.source ? `<p class="muted small">Source: ${esc(d.source.kind || "")} · ${esc(d.source.website || "")}${d.source.author ? " · by " + esc(d.source.author) : ""}${d.source.url ? ` · <a href="${esc(d.source.url)}" target="_blank" rel="noopener noreferrer">original ↗</a>` : ""}</p>` : ""}`,
    { type: "deckMenu" },
  );
};
const editDeck = (fn, opts) => {
  const id = currentDeck().id;
  return commit((s) => {
    const i = s.decks.findIndex((x) => x.id === id);
    s.decks[i] = fn(s.decks[i]) || s.decks[i];
  }, opts);
};
A.deckSaveInfo = async () => {
  await editDeck((d) => ({ ...d, name: $("#dmName").value.trim() || d.name, budget: Math.max(0, Number($("#dmBudget").value) || 0), strategy: $("#dmStrategy").value }), { msg: "Saved." });
  closeSheet();
};
C.deckLock = (t) => editDeck((d) => ({ ...d, locked: t.checked }), { msg: t.checked ? "Copies reserved for this deck." : "Reservation released." });
A.snapshot = async () => {
  const label = prompt("Name this version", "Version " + ((currentDeck().versions || []).length + 1));
  if (label === null) return;
  const before = (currentDeck().versions || []).length;
  await editDeck((d) => withSnapshot(d, label || "Snapshot"));
  toast((currentDeck().versions || []).length > before ? "Version saved." : "No changes since the last version.");
};
A.deckCopy = () => copyText(exportDeck(currentDeck().cards), "Decklist copied.");
A.deckExport = () => download(`Cardforge_${fileSafe(currentDeck().name)}.txt`, exportDeck(currentDeck().cards) + "\n");
A.deckDup = async () => {
  const d = currentDeck(),
    copy = { ...structuredClone(d), id: uid(), name: d.name + " (copy)", locked: false };
  await commit((s) => {
    s.decks.push(copy);
    s.activeDeck = copy.id;
  }, { msg: "Duplicated." });
  closeSheet();
  go("#deck/" + copy.id);
};
A.deckDelete = async () => {
  const d = currentDeck();
  if (!confirm(`Delete ${d.name}? Your collection is not affected.`)) return;
  await commit((s) => {
    s.decks = s.decks.filter((x) => x.id !== d.id);
    if (s.activeDeck === d.id) s.activeDeck = s.decks[0]?.id || null;
  }, { msg: "Deck deleted." });
  closeSheet();
  go("#decks");
};
A.refreshDeck = async (t) => {
  const d = currentDeck(),
    done = busy(t, "Refreshing…");
  try {
    const r = await resolveNames(d.cards.map((c) => c.name), (m) => toast(m), true);
    await editDeck((x) => ({ ...x, cards: x.cards.map((c) => ({ ...c, name: r.matched.get(key(c.name)) || c.name })) }));
    toast(r.failed.length ? `${r.failed.length} cards not found: ${r.failed.slice(0, 3).join(", ")}` : "Card data and prices refreshed.");
  } finally {
    done();
  }
};

A.deckAdd = async () => {
  const input = $("#deckAddName"),
    name = input.value.trim();
  if (!name) return;
  const c = await resolve(name, true);
  await editDeck((d) => mergeDeckCard(d, c.name, 1), { msg: `${c.name} added.` });
  const again = $("#deckAddName");
  if (again) again.focus();
};
A.deckQty = async (t) => {
  const name = t.dataset.name,
    delta = Number(t.dataset.delta),
    d = currentDeck() || deckById(S.ui.sheetCtx?.deckId);
  const row = d.cards.find((c) => key(c.name) === key(name));
  if (!row) return;
  if (delta < 0 && row.qty === 1 && key(name) === key(d.commander)) return toast("That’s your commander.");
  await editDeck((x) => mergeDeckCard(x, name, delta));
};
A.deckRemove = async (t) => {
  await editDeck((d) => ({ ...d, cards: d.cards.filter((c) => key(c.name) !== key(t.dataset.name)) }), { msg: "Removed from deck." });
  closeSheet();
};
I.deckSearch = (t) => {
  S.ui.q.deck = t.value;
  $("#deckList").innerHTML = V.deckList();
};
C.deckFilter = (t) => {
  S.ui.deckFilter = t.value;
  $("#deckList").innerHTML = V.deckList();
};
C.deckSort = (t) => {
  S.ui.deckSort = t.value;
  $("#deckList").innerHTML = V.deckList();
};
A.deckGrid = () => {
  S.ui.deckGrid = !S.ui.deckGrid;
  render();
};
I.shelfSearch = (t) => {
  S.ui.q.shelf = t.value;
  $("#shelfList").innerHTML = V.shelfList();
};

A.findRole = (t) => {
  const d = currentDeck(),
    comm = meta(d.commander),
    ci = (comm?.color_identity || []).join("").toLowerCase() || "c",
    theme = comm ? commanderTheme(comm) : null,
    q = {
      Ramp: '(o:"add {" or o:"search your library for a basic land" or o:"treasure token") -t:land',
      Draw: '(o:"draw a card" or o:"draw two" or o:"draws a card") -t:land',
      Removal: '(o:"destroy target" or o:"exile target" or o:"counter target")',
      Wipe: '(o:"destroy all" or o:"exile all" or o:"each creature")',
      Protection: "(o:hexproof or o:indestructible or o:\"phase out\") -t:land",
      Synergy: theme?.tribe ? "(t:" + theme.tribe + " or o:" + theme.tribe + ")" : "o:token",
    }[t.dataset.role];
  S.ui.db.term = `${q} id<=${ci}`;
  S.ui.db.filters = { color: "", type: "", format: "commander", maxPrice: "" };
  closeSheet();
  go("#search");
  dbSearch();
};

/* =========================================================
   Acquire cards (bought singles / whole product)
   ========================================================= */

let acqMode = "missing";
function acquireSheet(mode) {
  acqMode = mode;
  const d = currentDeck(),
    rows = mode === "purchase" ? aggregateCards(d.cards).map((r) => ({ name: r.name, qty: r.qty, max: r.qty })) : V.rowsFor(d).filter((r) => r.missing).map((r) => ({ name: r.name, qty: r.missing, max: r.missing }));
  openSheet(
    `<div class="sheet-head"><h2>${mode === "purchase" ? "Add the whole deck to my collection" : "Cards I got"}</h2><button class="icon" data-act="closeSheet">✕</button></div>
    <p class="muted small">${mode === "purchase" ? "For a precon or deck you bought: every card below is added as new copies, on top of what you already own." : "Tick the cards you now physically have. They’ll be added to your collection and the shopping gap updates."}</p>
    <div class="grid2"><label class="span2">Store them in<input id="acqLoc" maxlength="100" value="${esc(mode === "purchase" ? "Deck: " + d.name : "New arrivals")}"></label><label>Finish<select id="acqFinish">${options([["nonfoil", "Nonfoil"], ["foil", "Foil"], ["etched", "Etched"]], "nonfoil")}</select></label><label>Condition<select id="acqCond">${options(["Near Mint", "Lightly Played", "Moderately Played"].map((x) => [x, x]), "Near Mint")}</select></label></div>
    <div class="row between"><button class="link small" data-act="acqAll" data-on="1">Select all</button><button class="link small" data-act="acqAll" data-on="">Select none</button></div>
    <div class="list compact">${rows.map((r, i) => `<label class="mini-row"><span class="row"><input type="checkbox" class="acq-check" data-i="${i}" ${mode === "purchase" ? "checked" : ""}><span class="ellip">${esc(r.name)}</span></span><input type="number" class="acq-qty narrow" data-i="${i}" data-name="${esc(r.name)}" min="1" max="${r.max}" value="${r.qty}" aria-label="Copies of ${esc(r.name)}"></label>`).join("")}</div>
    <p id="acqError" class="error" role="alert"></p><button class="btn block" data-act="acqConfirm">Add to collection</button>`,
    { type: "acquire" },
  );
}
A.acquire = () => acquireSheet("missing");
A.deckBought = () => acquireSheet("purchase");
A.acqAll = (t) => $$(".acq-check").forEach((c) => (c.checked = !!t.dataset.on));
A.acqConfirm = async (t) => {
  const d = currentDeck(),
    done = busy(t, "Saving…");
  try {
    const picked = $$(".acq-check")
      .filter((c) => c.checked)
      .map((c) => {
        const q = $(`.acq-qty[data-i="${c.dataset.i}"]`);
        return { name: q.dataset.name, qty: Number(q.value), location: $("#acqLoc").value.trim() };
      });
    if (!picked.length) throw Error("Tick the cards you have.");
    const extra = { finish: $("#acqFinish").value, condition: $("#acqCond").value, language: "en" };
    await commit(
      (s) => {
        if (acqMode === "purchase") {
          for (const p of picked) {
            if (!Number.isInteger(p.qty) || p.qty < 1) throw Error("Check the quantity for " + p.name);
            s.collection.push({ id: uid(), name: p.name, qty: p.qty, set: "", collectorNumber: "", printingId: null, printingVerified: false, nameVerified: !!meta(p.name), reserved: 0, location: p.location, raw: { acquisition: "Bought as a deck", deckId: d.id }, ...extra });
          }
        } else {
          const before = new Set(s.collection.map((e) => e.id));
          s.collection = acquireMissing(d, s.collection, s.decks, S.catalog, picked, uid).map((e) => (before.has(e.id) ? e : { ...e, ...extra }));
        }
        s.example = false;
      },
      { msg: `${sumQty(picked)} cards added to your collection.` },
    );
    trackValue();
    closeSheet();
  } catch (e) {
    $("#acqError").textContent = e.message;
  } finally {
    done();
  }
};

/* =========================================================
   Search (Scryfall)
   ========================================================= */

I.dbTerm = (t) => (S.ui.db.term = t.value);
C.dbFilter = (t) => (S.ui.db.filters[t.dataset.field] = t.value);
A.dbSearch = () => dbSearch();
A.dbMore = () => dbSearch(true);
A.dbRandom = async () => {
  if(S.ui.db.busy)return;
  S.ui.db.busy=true;
  try{const c=cacheCard(await api("/cards/random?"+new URLSearchParams({q:"game:paper"})));saveCatalogSoon();await A.card({dataset:{name:c.name,random:"1"}});}
  finally{S.ui.db.busy=false;}
};
let randomDeckBusy=false,lastRandomCommander="";
A.randomDeck=async()=>{
  if(randomDeckBusy)return;
  randomDeckBusy=true;
  toast("Choosing a random Commander deck idea…");
  try{
    const candidates=S.ui.ideas.cache.filter(i=>i.commander.name!==lastRandomCommander);
    let index;
    if(candidates.length){const choice=candidates[Math.floor(Math.random()*candidates.length)];index=S.ui.ideas.cache.indexOf(choice);}
    else{
      const c=cacheCard(await api("/cards/random?"+new URLSearchParams({q:"game:paper legal:commander is:commander"})));
      if(!commanderEligible(c))throw Error("This random card is not a supported single commander. Try again.");
      const own=inv(c.name),deck={id:"random:"+c.id,name:c.name+" · random idea",format:"Commander",commander:c.name,strategy:"Auto",budget:25,locked:false,cards:[{name:c.name,qty:1}]};
      S.ui.ideas.cache.push({commander:c,deck,plan:"Random",owned:own.owned,available:Math.min(1,own.available),slots:1,open:99,themeCards:0,reason:"Random legal commander; review the generated plan",difficulty:"Review sequencing"});index=S.ui.ideas.cache.length-1;
    }
    lastRandomCommander=S.ui.ideas.cache[index].commander.name;
    S.ui.ideas.open=null;S.ui.ideas.sel=new Set();openIdea(index);
    saveCatalogSoon();
  }finally{randomDeckBusy=false;}
};
A.dbTry = (t) => {
  S.ui.db.term = t.dataset.q;
  dbSearch();
};
async function dbSearch(next = false, random = false) {
  const db = S.ui.db;
  if (db.busy) return;
  db.busy = true;
  db.error = "";
  if (S.ui.view === "search") render();
  try {
    let d;
    if (random) {
      const c = await api("/cards/random?" + new URLSearchParams({ q: "game:paper" + (db.filters.format ? " legal:" + db.filters.format : "") }));
      cacheCard(c);
      db.busy = false;
      render();
      return A.card({ dataset: { name: c.name, random: "1" } });
    }
    if (next) {
      const u = new URL(db.next);
      if (u.origin !== "https://api.scryfall.com") throw Error("Unexpected link.");
      d = await api(u.pathname + u.search);
    } else {
      if (!db.term.trim() && !db.filters.color && !db.filters.type) throw Error("Type a card name or pick a filter.");
      const syntax = /[:<>=]/.test(db.term);
      d = await api("/cards/search?" + new URLSearchParams({ q: searchQuery(db.term, db.filters), unique: "cards", order: syntax ? "edhrec" : "name" }));
    }
    for (const c of d.data) cacheCard(c);
    db.results = next ? [...db.results, ...d.data] : d.data;
    db.total = d.total_cards || db.results.length;
    db.next = d.has_more ? d.next_page : null;
  } catch (e) {
    db.error = /didn.t match any cards|no cards found/i.test(e.message) ? "No cards match that search." : e.message;
    if (!next) db.results = [];
  } finally {
    db.busy = false;
    saveCatalogSoon();
    if (S.ui.view === "search") render();
  }
}

/* =========================================================
   Ideas, references, precons
   ========================================================= */

function buildIdeas() {
  const I2 = S.ui.ideas;
  try {
    I2.cache = collectionIdeas(S.state.collection, S.state.decks, S.catalog, { includeUnowned: !I2.ownedOnly });
    if (!I2.cache.length && S.state.collection.length)
      I2.msg = S.state.collection.some((e) => !meta(e.name)) ? "Some cards have no card data yet — tap Analyze to load them." : "No legendary creatures in your collection yet. Untick “Owned commanders only” to include ones you’ve looked up.";
  } catch (e) {
    I2.msg = e.message;
  }
  if (S.ui.view === "decks") render();
}
A.analyze = async () => {
  const I2 = S.ui.ideas;
  if (I2.busy) return;
  I2.busy = true;
  render();
  try {
    const r = await resolveNames(S.state.collection.map((e) => e.name), (m) => {
      I2.msg = m;
      const el = $("#content .muted.small[role=status]");
      if (el) el.textContent = m;
    });
    await commit((s) => {
      for (const e of s.collection) if (r.matched.has(key(e.name))) Object.assign(e, { name: r.matched.get(key(e.name)), nameVerified: true });
    }, { rerender: false });
    I2.msg = `${new Set(S.state.collection.map((e) => key(e.name))).size - r.failed.length} card names have data${r.failed.length ? ` · ${r.failed.length} not found` : ""}.`;
    I2.busy = false;
    buildIdeas();
  } finally {
    I2.busy = false;
    render();
  }
};
C.ideasOwned = (t) => {
  S.ui.ideas.ownedOnly = t.checked;
  buildIdeas();
};
C.ideaFilter = (t) => {
  S.ui.ideas.filter = t.value;
  render();
};
A.ideasMore = () => {
  S.ui.ideas.limit += 12;
  render();
};

/* Deck idea → full list sheet */
function ideaDeck() {
  const I2 = S.ui.ideas;
  return I2.open?.custom || I2.cache[I2.open?.i]?.deck;
}
function openIdea(i) {
  const I2 = S.ui.ideas;
  if (I2.open?.i !== i) I2.open = { i, budget: I2.defaultBudget ?? S.state.settings.budget ?? 25, custom: null, busy: false, initialized: false, msg: "Loading a complete proposed deck, including lands…" };
  I2.sel = I2.sel && I2.open.i === i ? I2.sel : new Set();
  openSheet(V.ideaSheet(I2.cache[i], ideaDeck(), I2.open, I2.sel), { type: "idea", i });
  if (!I2.open.initialized) {
    I2.open.initialized = true;
    queueMicrotask(() => { if(S.ui.sheetCtx?.type === "idea" && I2.open?.i === i) safely(A.ideaBudget({dataset:{v:String(I2.open.budget)}})); });
  }
}
A.openIdea = (t) => {
  S.ui.ideas.sel = new Set();
  openIdea(Number(t.dataset.i));
};
A.sheetBack = () => {
  const b = S.ui.sheetBack;
  S.ui.sheetBack = null;
  if (b?.type === "idea") openIdea(b.i);
};
A.ideaCustomBudget = async () => {
 const value=customBudget($("#ideaCustomBudget").value);
 S.ui.ideas.defaultBudget=value;
 await A.ideaBudget({dataset:{v:String(value)}});
};
C.fillCustom = (t) => {S.ui.fill.budget=customBudget(t.value);S.ui.fill.plan=null;render();};
C.upCustom = (t) => {S.ui.upgrade.budget=customBudget(t.value);S.ui.upgrade.selected=new Set();render();};
A.ideaBudget = async (t) => {
  const I2 = S.ui.ideas,
    o = I2.open,
    idea = I2.cache[o.i],
    budget = Number(t.dataset.v);
  o.budget = budget;
  I2.sel = new Set();
  if (o.busy) return;
  if (!budget) {
    o.custom = null;
    return openIdea(o.i);
  }
  o.busy = true;
  o.msg = "Finding cards to buy…";
  openIdea(o.i);
  try {
    const base = { ...idea.deck, budget, id: "idea-preview", cards: [{ name: idea.commander.name, qty: 1 }] };
    await loadCandidates(base, budget, (m) => {
      o.msg = m;
      const el = $("#ideaMsg");
      if (el) el.textContent = m;
    });
    const plan = completionPlan(base, S.state.collection, S.state.decks, S.catalog, { budget, landTarget: 36, preferOwned: true, simple: false });
    o.custom = { ...idea.deck, budget, cards: plan.deck.cards };
    o.msg = `${usd(plan.cost)} of new cards picked${plan.open ? ` · ${plan.open} slots still open` : ""}.`;
  } catch (e) {
    o.msg = e.message;
  } finally {
    o.busy = false;
    saveCatalogSoon();
    if (S.ui.sheetCtx?.type === "idea" && S.ui.ideas.open === o) openIdea(o.i);
  }
};
C.ideaPick = (t) => {
  const sel = S.ui.ideas.sel;
  if (t.checked) sel.add(t.dataset.name);
  else sel.delete(t.dataset.name);
  const n = $("#ideaSelCount");
  if (n) n.textContent = sel.size ? `${sel.size} selected` : "Nothing selected";
};
A.ideaSelect = (t) => {
  const d = ideaDeck(),
    rows = V.rowsFor({ ...d, id: "idea-preview" });
  S.ui.ideas.sel = new Set(t.dataset.mode === "missing" ? rows.filter((r) => r.missing).map((r) => r.name) : t.dataset.mode === "all" ? rows.map((r) => r.name) : []);
  openIdea(S.ui.ideas.open.i);
};
const ideaPicked = () => {
  const d = ideaDeck(),
    sel = S.ui.ideas.sel;
  return aggregateCards(d.cards).filter((c) => sel.has(c.name));
};
A.ideaSaveAll = async () => {
  if(S.ui.ideas.open?.busy)return toast("Wait for the full deck preview.");
  const idea = S.ui.ideas.cache[S.ui.ideas.open.i],
    d = withSnapshot({ ...structuredClone(ideaDeck()), id: uid(), name: idea.commander.name.split(",")[0] + " · " + idea.plan, versions: [] }, "Started from a deck idea");
  await commit((s) => {
    s.decks.push(d);
    s.activeDeck = d.id;
  }, { msg: "Saved as a new deck." });
  closeSheet();
  go(`#deck/${d.id}/cards`);
};
A.ideaToDeck = async () => {
  const picked = ideaPicked(),
    id = $("#ideaDeckPick")?.value,
    d = deckById(id);
  if (!picked.length) return toast("Tick some cards first.");
  if (!d) return toast("Pick a deck.");
  await commit((s) => {
    const i = s.decks.findIndex((x) => x.id === id);
    let deck = withSnapshot(s.decks[i], "Before adding from an idea");
    for (const c of picked) if (!deck.cards.some((x) => key(x.name) === key(c.name))) deck = mergeDeckCard(deck, c.name, c.qty);
    s.decks[i] = deck;
  }, { msg: `${picked.length} cards added to ${d.name}.` });
};
A.ideaWish = async () => {
  const picked = ideaPicked();
  if (!picked.length) return toast("Tick some cards first.");
  await commit((s) => {
    for (const c of picked) {
      const own = inventory(s.collection, c.name, s.decks).available;
      if (!s.wishlist.some((w) => key(w.name) === key(c.name))) s.wishlist.push({ id: uid(), name: c.name, qty: own + c.qty, finish: "nonfoil" });
    }
  }, { msg: `${picked.length} cards added to your wishlist.` });
};
A.ideaOwn = async () => {
  const picked = ideaPicked();
  if (!picked.length) return toast("Tick the cards you own.");
  if (!confirm(`Add ${sumQty(picked)} cards to your collection as cards you own?`)) return;
  await commit((s) => {
    for (const c of picked) s.collection.push({ id: uid(), name: c.name, qty: c.qty, set: "", collectorNumber: "", finish: "nonfoil", language: "en", condition: "Near Mint", location: "", reserved: 0, printingId: null, printingVerified: false, nameVerified: !!meta(c.name), raw: { acquisition: "Added from deck idea" } });
  }, { msg: `${sumQty(picked)} cards added to your collection.` });
};
A.ideaBuy = () => {
  const d = ideaDeck(),
    rows = V.rowsFor({ ...d, id: "idea-preview" }),
    sel = S.ui.ideas.sel,
    list = rows.filter((r) => r.missing && (!sel.size || sel.has(r.name))).map((r) => ({ name: r.name, qty: r.missing }));
  if (!list.length) return toast("You already own everything selected.");
  copyText(exportDeck(list), `${sumQty(list)} cards copied — paste into TCGplayer Mass Entry.`);
};
A.saveIdea = (t) => {
  S.ui.ideas.sel = new Set();
  openIdea(Number(t.dataset.i));
  toast("Review the full list, then save the entire deck including lands.");
};

I.refSearch = (t) => {
  S.ui.q.ref = t.value;
  render();
  const el = $('[data-input="refSearch"]');
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
};
A.copyRef = async (t) => {
  const r = S.state.references.find((x) => x.id === t.dataset.id),
    d = withSnapshot({ ...structuredClone(r), id: uid(), name: r.name + " · my version", locked: false, versions: [] }, "From " + (r.source?.author || r.source?.website || "inspiration"));
  await commit((s) => {
    s.decks.push(d);
    s.activeDeck = d.id;
  });
  go(`#deck/${d.id}/cards`);
};
A.exportRef = (t) => {
  const r = S.state.references.find((x) => x.id === t.dataset.id);
  download(`Cardforge_${fileSafe(r.name)}.txt`, exportDeck(r.cards) + "\n");
};
A.deleteRef = async (t) => {
  if (!confirm("Remove this saved idea?")) return;
  await commit((s) => (s.references = s.references.filter((x) => x.id !== t.dataset.id)));
};
async function fetchJSON(url) {
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}
A.loadPrecons = async () => {
  const P = S.ui.precon;
  P.busy = true;
  P.msg = "Loading…";
  render();
  try {
    const j = await fetchJSON("https://mtgjson.com/api/v5/DeckList.json");
    P.index = (j.data || []).filter((d) => typeof d.fileName === "string" && typeof d.name === "string");
    P.msg = `${P.index.length} products. Search by the name on the box.`;
  } catch (e) {
    P.msg = "Couldn’t reach MTGJSON (" + e.message + "). You can still upload a precon’s .json or text list with “Save a deck idea”.";
  } finally {
    P.busy = false;
    render();
  }
};
I.preconSearch = (t) => {
  S.ui.q.precon = t.value;
  $("#preconList").innerHTML = V.preconList();
};
A.previewPrecon = async (t) => {
  const f = t.dataset.file;
  if (!/^[A-Za-z0-9_.-]+$/.test(f)) return toast("Invalid product.");
  toast("Loading decklist…");
  const url = "https://mtgjson.com/api/v5/decks/" + f.replace(/\.json$/, "") + ".json",
    payload = await fetchJSON(url),
    p = mtgjsonDeck(payload);
  deckImportSheet({ text: JSON.stringify(payload), name: p.name, commander: p.commander, format: p.commander ? "Commander" : "60-card casual", url, author: "Wizards of the Coast", kind: "MTGJSON precon", destination: "library", description: "Preconstructed deck list from MTGJSON." });
  await A.dImpPreview();
};

/* =========================================================
   Upgrade lab: fill open slots + one-for-one swaps
   ========================================================= */

async function loadCandidates(d, cap, progress) {
  if (!d.commander) throw Error("Choose this deck’s commander first.");
  const comm = await resolve(d.commander, true);
  if (!commanderEligible(comm)) throw Error("Pick a valid single commander first (⋯ → re-import, or start a new deck).");
  const ci = (comm.color_identity || []).join("").toLowerCase() || "c",
    theme = commanderTheme(comm),
    base = `game:paper legal:commander id<=${ci} usd<=${Math.max(0.25, cap)}`,
    queries = [
      ["ramp", '-t:land (o:"add {" or o:"search your library for a basic land" or o:"treasure token")'],
      ["card draw", '-t:land (o:"draw a card" or o:"draw two" or o:"draws a card")'],
      ["removal", '-t:land (o:"destroy target" or o:"exile target" or o:"counter target" or o:"destroy all")'],
      ["protection", "-t:land (o:indestructible or o:hexproof)"],
      [theme.tribe ? theme.tribe.toLowerCase() + "s" : "creatures", theme.tribe ? "t:" + theme.tribe : "t:creature cmc<=4"],
      ["lands", "t:land -t:basic (o:\"add {\" )"],
      ["budget creatures", "t:creature usd<=0.50"],
      ["budget support", "-t:land usd<=0.35"],
    ];
  let loaded = 0,
    failed = 0;
  for (const [label, q] of queries) {
    progress(`Finding ${label}…`);
    try {
      const r = await api("/cards/search?" + new URLSearchParams({ q: `${base} ${q}`, unique: "cards", order: label.startsWith("budget") ? "usd" : "edhrec", dir:"asc" }));
      for (const c of r.data.slice(0, label.startsWith("budget") ? 140 : 60)) {
        cacheCard(c);
        loaded++;
      }
    } catch {
      failed++;
    }
  }
  for (const b of (comm.color_identity?.length ? comm.color_identity : ["C"]).map((c) => ({ W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" })[c]))
    await resolve(b).catch(() => failed++);
  return { loaded, failed };
}

A.fillBudget = (t) => {
  S.ui.fill.budget = Number(t.dataset.v);
  S.ui.fill.plan = null;
  render();
};
C.fill = (t) => {
  const F = S.ui.fill;
  if (t.dataset.field === "lands") F.lands = Math.min(42, Math.max(30, Math.round(Number(t.value) || 36)));
  else F[t.dataset.field] = t.checked;
  F.plan = null;
};
A.fillRun = async () => {
  const F = S.ui.fill,
    d = currentDeck();
  if (F.busy) return;
  F.busy = true;
  F.deckId = d.id;
  F.plan = null;
  render();
  const msg = (m) => {
    F.msg = m;
    if ($("#fillMsg")) $("#fillMsg").textContent = m;
  };
  try {
    await resolveNames([...d.cards.map((c) => c.name), ...S.state.collection.map((c) => c.name)], msg);
    const c = await loadCandidates(d, F.budget || 0.5, msg);
    F.plan = completionPlan(d, S.state.collection, S.state.decks, S.catalog, { budget: F.budget, landTarget: F.lands, preferOwned: true, simple: F.simple });
    F.plan.base = JSON.stringify(d.cards);
    F.msg = `${c.loaded} candidates checked. ${F.plan.open ? F.plan.open + " slots still open — try a bigger budget." : "Review, then add."}`;
  } catch (e) {
    F.msg = e.message;
  } finally {
    F.busy = false;
    saveCatalogSoon();
    render();
  }
};
A.fillApply = async () => {
  const F = S.ui.fill,
    d = currentDeck();
  if (!F.plan || F.deckId !== d.id) return;
  if (F.plan.base !== JSON.stringify(d.cards)) return toast("The deck changed — run the recommendation again.");
  const label = `Filled ${sumQty(F.plan.additions)} slots (${F.budget ? "$" + F.budget : "owned only"})`;
  await editDeck((x) => withSnapshot({ ...withSnapshot(x, "Before filling slots"), cards: F.plan.deck.cards }, label, { spent: F.plan.cost || 0 }), { msg: "Cards added. Compare in Versions." });
  F.plan = null;
  S.ui.versions = { a: null, b: "current" };
};

A.upBudget = (t) => {
  S.ui.upgrade.budget = Number(t.dataset.v);
  S.ui.upgrade.selected = new Set();
  render();
};
C.upSimple = (t) => {
  S.ui.upgrade.simple = t.checked;
  S.ui.upgrade.plans = {};
};
A.upRun = async () => {
  const U = S.ui.upgrade,
    d = currentDeck();
  if (U.busy) return;
  U.busy = true;
  U.deckId = d.id;
  U.plans = {};
  U.selected = new Set();
  render();
  const msg = (m) => {
    U.msg = m;
    if ($("#upMsg")) $("#upMsg").textContent = m;
  };
  try {
    const r = await resolveNames([...d.cards.map((c) => c.name), ...S.state.collection.map((c) => c.name)], msg);
    const unresolved = d.cards.filter((c) => !meta(c.name));
    if (unresolved.length) throw Error("Fix unrecognized cards first: " + unresolved.slice(0, 3).map((c) => c.name).join(", "));
    const c = await loadCandidates(d, Math.max(50, U.budget), msg);
    const baseScore = engineProfile(d, S.catalog).score;
    for (const b of [...new Set([0, 10, 25, 50, 100, U.budget])]) {
      const plan = upgradeSuggestions(d, S.state.collection, S.state.decks, S.catalog, { budget: b, simple: U.simple, maxSwaps: 8 });
      // Drop swaps that would lower the engine score; keep neutral ones (they may fit the theme better).
      plan.swaps = plan.swaps.filter((s) => swapImpact(d, s, S.catalog, baseScore).delta >= 0);
      plan.spent = plan.swaps.reduce((a, s) => a + (s.cost || 0), 0);
      U.plans[b] = plan;
    }
    U.base = JSON.stringify(d.cards);
    U.msg = `${c.loaded} candidates compared${r.failed.length || c.failed ? " (some lookups failed)" : ""}. Read each cut before applying.`;
  } catch (e) {
    U.msg = e.message;
  } finally {
    U.busy = false;
    saveCatalogSoon();
    render();
  }
};
C.upPick = (t) => {
  const U = S.ui.upgrade,
    i = Number(t.dataset.i);
  if (t.checked) U.selected.add(i);
  else U.selected.delete(i);
  t.closest(".swap")?.classList.toggle("on", t.checked);
  const d = currentDeck();
  $("#upSummary").innerHTML = V.upgradeSummary(d, U.plans[U.budget]);
};
const pickedSwaps = () => {
  const U = S.ui.upgrade;
  return [...U.selected].map((i) => U.plans[U.budget]?.swaps[i]).filter(Boolean);
};
A.upExport = () => {
  const d = currentDeck(),
    buy = pickedSwaps().filter((s) => !inv(s.add, d.id).available).map((s) => ({ name: s.add, qty: 1 }));
  if (!buy.length) return toast("All selected additions are cards you already own.");
  copyText(exportDeck(buy), `${buy.length} cards copied for TCGplayer Mass Entry.`);
};
A.upApply = async () => {
  const U = S.ui.upgrade,
    d = currentDeck(),
    swaps = pickedSwaps();
  if (!swaps.length) return toast("Tick at least one swap.");
  if (U.base !== JSON.stringify(d.cards)) return toast("The deck changed — find upgrades again.");
  const result = applyUpgradeSwaps(d, swaps, S.state.collection, S.state.decks, S.catalog, U.budget),
    budgetLabel = U.budget ? "$" + U.budget : "$0";
  let beforeId;
  await editDeck((x) => {
    const before = withSnapshot(x, "Before " + budgetLabel + " upgrade");
    beforeId = before.versions.at(-1).id;
    return withSnapshot(
      { ...before, cards: result.deck.cards, upgradeHistory: [...(x.upgradeHistory || []), { date: new Date().toISOString(), budget: U.budget, swaps, estimatedSpend: result.spent }] },
      `${budgetLabel} upgrade · ${swaps.length} swap${swaps.length > 1 ? "s" : ""}`,
      { spent: result.spent },
    );
  }, { rerender: false });
  U.plans = {};
  U.selected = new Set();
  S.ui.versions = { a: beforeId, b: "current" };
  go(`#deck/${d.id}/versions`);
  toast("Swaps applied. Here’s your before → after.");
};

/* Versions */

C.verA = (t) => {
  S.ui.versions.a = t.value;
  render();
};
C.verB = (t) => {
  S.ui.versions.b = t.value;
  render();
};
A.restoreVer = async (t) => {
  const d = currentDeck(),
    v = (d.versions || []).find((x) => x.id === t.dataset.id);
  if (!v || !confirm(`Restore “${v.label}”? Your current list is saved as a version first.`)) return;
  await editDeck((x) => ({ ...withSnapshot(x, "Before restoring " + v.label), cards: structuredClone(v.cards) }), { msg: "Version restored." });
};
A.deleteVer = async (t) => {
  if (!confirm("Delete this saved version?")) return;
  await editDeck((x) => ({ ...x, versions: (x.versions || []).filter((v) => v.id !== t.dataset.id) }));
};

/* Playtest */

const library = (d) => d.cards.filter((c) => d.format !== "Commander" || key(c.name) !== key(d.commander));
A.draw7 = () => {
  const d = currentDeck();
  S.ui.hand = { ...drawHand(library(d)), deckId: d.id, mulls: 0 };
  render();
};
A.mull = () => {
  const d = currentDeck(),
    m = (S.ui.hand?.mulls || 0) + 1;
  S.ui.hand = { ...drawHand(library(d)), deckId: d.id, mulls: m };
  render();
};
A.drawOne = () => {
  const h = S.ui.hand;
  if (h?.library.length) h.hand.push(h.library.shift());
  render();
};
A.logGame = async () => {
  const d = currentDeck();
  await commit((s) => {
    s.notes.push({ id: uid(), deckId: d.id, sig: cardSig(d.cards), date: new Date().toLocaleDateString(), author: "", table: "", result: $("#logResult").value, turn: Number($("#logTurn").value) || null, note: $("#logNote").value.trim().slice(0, 1000) });
  }, { msg: "Game saved." });
};

/* ---------- life tracker ---------- */
A.lifeStart = (t) => {
  S.ui.life = newGame(Number(t.dataset.n) || 4, currentDeck()?.format === "Commander" ? 40 : 20);
  render();
};
A.lifeTurn = (t) => {
  const g = S.ui.life;
  if (g) g.turn = Math.max(1, g.turn + Number(t.dataset.delta));
  render();
};
A.lifeAdj = (t) => {
  const pl = S.ui.life?.players[Number(t.dataset.i)];
  if (!pl) return;
  const field = t.dataset.field,
    delta = Number(t.dataset.delta),
    before = pl[field];
  pl[field] = field === "life" ? before + delta : Math.max(0, before + delta);
  // Commander damage is also life loss.
  if (field === "cmd") pl.life -= pl.cmd - before;
  render();
};
C.lifeName = (t) => {
  const pl = S.ui.life?.players[Number(t.dataset.i)];
  if (pl) pl.name = t.value.trim().slice(0, 24) || pl.name;
};
A.lifeEnd = () => {
  if (!confirm("End this game without logging it?")) return;
  S.ui.life = null;
  render();
};
A.lifeLog = async (t) => {
  const d = currentDeck(),
    g = S.ui.life;
  if (!g) return;
  const opp = g.players.slice(1).map((p) => p.name).join(", ");
  S.ui.life = null;
  await commit((s) => {
    s.notes.push({ id: uid(), deckId: d.id, sig: cardSig(d.cards), date: new Date().toLocaleDateString(), author: "", table: opp, result: t.dataset.result, turn: g.turn, note: `${g.players.length}-player game vs ${opp}`.slice(0, 1000) });
  }, { msg: "Game saved to the log." });
};

/* ---------- proxies ---------- */
A.proxies = (t) => {
  const d = currentDeck() || deckById(S.ui.sheetCtx?.deckId);
  if (!d) return;
  const all = t.dataset.scope === "all",
    rows = all ? aggregateCards(d.cards) : V.rowsFor(d).filter((r) => r.missing).map((r) => ({ name: r.name, qty: r.missing })),
    cards = proxyList(rows, S.catalog);
  if (!cards.length) return toast(all ? "No non-basic cards to print." : "Nothing missing — no proxies needed.");
  const html = proxySheetHTML(`${d.name} — ${all ? "deck" : "missing cards"} proxies`, cards),
    w = window.open("", "_blank");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  } else {
    download(fileSafe(d.name) + "_proxies.html", html, "text/html");
    toast("Pop-up blocked — downloaded the proxy sheet instead. Open it and print.");
  }
};
A.deleteNote = async (t) => commit((s) => (s.notes = s.notes.filter((n) => n.id !== t.dataset.id)));

/* =========================================================
   Scan
   ========================================================= */

let ocrLoading;
C.scanFile = (t) => {
  const f = t.files[0],
    s = S.ui.scan;
  if (!f) return;
  if (!f.type.startsWith("image/")) return toast("Choose a photo.");
  if (s.url) URL.revokeObjectURL(s.url);
  Object.assign(s, { file: f, url: URL.createObjectURL(f), text: "", match: null, status: "Photo ready. Tap “Read name”." });
  render();
  A.scanRead();
};
C.scanCrop = (t) => (S.ui.scan.crop = t.checked ? "title" : "full");
A.scanClear = () => {
  const s = S.ui.scan;
  if (s.url) URL.revokeObjectURL(s.url);
  Object.assign(s, { file: null, url: null, text: "", match: null, status: "" });
  render();
};
function loadOCR() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!ocrLoading)
    ocrLoading = new Promise((ok, bad) => {
      const el = document.createElement("script");
      el.src = "vendor/tesseract.min.js";
      el.onload = () => ok(window.Tesseract);
      el.onerror = () => {
        ocrLoading = null;
        bad(Error("Text reader couldn’t load. Type the name instead."));
      };
      document.head.appendChild(el);
    });
  return ocrLoading;
}
A.scanRead = async () => {
  const s = S.ui.scan;
  if (!s.file || s.busy) return;
  s.busy = true;
  s.status = "Loading text reader…";
  render();
  let worker;
  try {
    const image = new Image();
    await new Promise((ok, bad) => {
      image.onload = ok;
      image.onerror = () => bad(Error("Couldn’t open that photo."));
      image.src = s.url;
    });
    const part = s.crop === "title" ? 0.22 : 1,
      ratio = Math.min(1, 1400 / image.naturalWidth),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * ratio);
    canvas.height = Math.round(image.naturalHeight * ratio * part);
    const ctx = canvas.getContext("2d");
    ctx.filter = "grayscale(1) contrast(1.4)";
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight * part, 0, 0, canvas.width, canvas.height);
    const T = await loadOCR();
    worker = await T.createWorker("eng", 1, {
      workerPath: new URL("vendor/worker.min.js", location.href).href,
      workerBlobURL: false,
      logger: (m) => {
        s.status = m.status + (typeof m.progress === "number" ? " · " + Math.round(m.progress * 100) + "%" : "");
        if ($("#scanStatus")) $("#scanStatus").textContent = s.status;
      },
    });
    s.text = (await worker.recognize(canvas)).data.text || "";
    const names = scanNames(s.text);
    s.status = names.length ? "Read it. Confirm the match below." : "Couldn’t read a name — try again with less glare, or type it.";
    if (names.length) {
      s.busy = false;
      await A.scanMatch({ dataset: { name: names[0] } });
    }
  } catch (e) {
    s.status = e.message;
  } finally {
    if (worker) await worker.terminate().catch(() => {});
    s.busy = false;
    if (S.ui.view === "scan") render();
  }
};
A.scanPick = (t) => A.scanMatch(t);
A.scanMatch = async (t) => {
  const s = S.ui.scan,
    name = (t?.dataset?.name || $("#scanName")?.value || "").trim();
  if (!name) return toast("Type the card name.");
  try {
    s.match = await resolve(name, true, false);
    s.status = "Check the picture matches your card.";
  } catch (e) {
    s.match = null;
    s.status = e.message;
  }
  if (S.ui.view === "scan") render();
};

/* =========================================================
   Settings & backup
   ========================================================= */

function backupPayload() {
  const names = new Set();
  for (const e of S.state.collection) names.add(key(e.name));
  for (const d of [...S.state.decks, ...(S.state.references || [])]) for (const c of d.cards) names.add(key(c.name));
  for (const w of S.state.wishlist) names.add(key(w.name));
  const cache = {};
  for (const n of names) if (S.catalog[n]) cache[n] = S.catalog[n];
  return JSON.stringify({ ...backupEnvelope(stripCache(S.state)), cache });
}
A.exportBackup = () => {
  download("Cardforge_Backup_" + new Date().toISOString().slice(0, 10) + ".json", backupPayload(), "application/json");
  toast("Backup downloaded. Keep it somewhere safe (Drive, email to yourself…).");
};
async function readBackup(file) {
  if (file.size > 60e6) throw Error("Backup is larger than 60 MB.");
  const raw = JSON.parse(await file.text());
  return { next: normalize(raw), cache: raw.cache && typeof raw.cache === "object" ? raw.cache : {} };
}
C.checkBackup = async (t) => {
  try {
    const { next } = await readBackup(t.files[0]);
    $("#backupCheck").textContent = `✓ Valid backup: ${sumQty(next.collection)} cards, ${next.decks.length} decks, exported ${next.exportedAt ? new Date(next.exportedAt).toLocaleString() : "date unknown"}.`;
  } catch (e) {
    $("#backupCheck").textContent = "✕ Not a valid backup: " + e.message;
  }
};
C.restoreBackup = async (t) => {
  try {
    const { next, cache } = await readBackup(t.files[0]);
    if (!confirm(`Replace everything here with ${sumQty(next.collection)} cards and ${next.decks.length} decks from the backup? The current data is kept as a recovery copy.`)) return;
    for (const [k, c] of Object.entries(cache)) if (!S.catalog[k]) S.catalog[k] = slim(c);
    S.catalogDirty = true;
    await writeRecords([[RECOVERY, stripCache(S.state)], [STORAGE, next]]);
    S.state = next;
    saveCatalogSoon();
    render();
    toast("Backup restored.");
  } catch (e) {
    toast("Restore failed — nothing changed. " + e.message);
  }
};
A.undoRestore = async () => {
  const raw = await readRecord(RECOVERY);
  if (!raw) return toast("No recovery copy yet.");
  const next = normalize(raw);
  if (!confirm(`Switch to the recovery copy (${sumQty(next.collection)} cards, ${next.decks.length} decks)? What you have now becomes the recovery copy.`)) return;
  await writeRecords([[RECOVERY, stripCache(S.state)], [STORAGE, next]]);
  S.state = next;
  render();
  toast("Recovery copy restored.");
};
A.reset = async () => {
  if (!confirm("Start empty? One recovery copy is kept on this device. Export a backup first if in doubt.")) return;
  await writeRecords([[RECOVERY, stripCache(S.state)], [STORAGE, blank()]]);
  S.state = blank();
  go("#home");
};
A.loadExample = async () => {
  if (S.state.collection.length && !confirm("Replace your data with example data? Your current data becomes the recovery copy.")) return;
  const names = ["Krenko, Mob Boss", "Goblin Instigator", "Sol Ring", "Arcane Signet", "Talrand, Sky Summoner", "Counterspell", "Mountain", "Island"];
  const st = blank();
  st.example = true;
  st.collection = names.filter((n) => meta(n)).map((n) => ({ id: uid(), name: n, qty: ["Mountain", "Island"].includes(n) ? 12 : 1, set: "", collectorNumber: "", finish: "nonfoil", condition: "Near Mint", language: "en", location: "Example", reserved: 0, printingVerified: false, raw: {} }));
  await writeRecords([[RECOVERY, stripCache(S.state)], [STORAGE, st]]);
  S.state = normalize(st);
  go("#collection");
};
A.persist = async () => {
  toast((await requestPersistence()) ? "The browser will keep your data. Still export backups." : "The browser declined. Export backups regularly.");
  storageDetail();
};
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
A.install = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
  } else toast("Use your browser menu → Add to Home screen.");
};
async function storageDetail() {
  const s = await persistenceStatus(),
    el = $("#storageDetail");
  if (el) el.textContent = `${s.backend} · ${s.persistent ? "protected from cleanup" : "may be cleared by the browser if storage runs low"}${s.usage !== undefined ? ` · ${(s.usage / 1048576).toFixed(1)} MB used` : ""}.`;
}

/* =========================================================
   Boot
   ========================================================= */

function trackValue() {
  const v = collectionValue(S.state.collection, S.catalog, S.state.printings, []);
  if (!S.state.collection.length) return;
  S.state.valueHistory = recordValuePoint(S.state.valueHistory, v.total, v.copies);
}

async function boot() {
  try {
    const r = await fetch("catalog.json");
    if (r.ok) {
      const ref = await r.json();
      for (const c of ref.cards) S.catalog[key(c.name)] = slim({ ...c, checkedAt: ref.snapshot_date });
    }
  } catch {}
  try {
    const cat = await readRecord(CATALOG_RECORD);
    if (cat && typeof cat === "object") Object.assign(S.catalog, cat);
  } catch {}
  const saved = await readRecord(STORAGE);
  if (saved) {
    if (saved.cache && typeof saved.cache === "object" && Object.keys(saved.cache).length) {
      for (const [k, c] of Object.entries(saved.cache)) if (!S.catalog[k] || (c?.checkedAt || "") > (S.catalog[k].checkedAt || "")) S.catalog[k] = slim(c);
      S.catalogDirty = true;
    }
    S.state = normalize(saved);
  } else {
    try {
      const legacy = JSON.parse(localStorage.getItem("cardforge-v1"));
      if (legacy?.sample === false && legacy.collection)
        S.state.collection = Object.values(legacy.collection).filter((c) => c.qty > 0).map((c) => ({ id: uid(), name: c.name, qty: c.qty, set: "", collectorNumber: "", finish: "nonfoil", condition: "Near Mint", language: "en", location: "Earlier Cardforge", reserved: c.reserved || 0, printingVerified: false, raw: {} }));
    } catch {}
  }
  trackValue();
  await save();
  parseHash();
  loadSetIndex(); // cached set symbols first; refreshes from Scryfall every few days
  render();
  $("#app").classList.add("ready");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  window.addEventListener("online", () => {
    setSaveStatus("Online", "ok");
    autoEnrich();
  });
  setTimeout(autoEnrich, 400);
  window.addEventListener("offline", () => setSaveStatus("Offline", "bad"));
}

boot().catch((e) => {
  $("#content").innerHTML = `<section class="empty"><h3>Cardforge couldn’t open your saved data</h3><p>${esc(e.message)}</p><p class="muted small">Nothing was deleted. Close other Cardforge tabs and retry.</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});
