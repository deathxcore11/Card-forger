import {openTabletop} from './tabletop.js';
import {INFO_TOPICS,findInfo} from './app-info.js';
import {attachHomeSearch,homeIntent,rankHomeCards,homeQueries,placeGlobalSearch,searchEmblem} from './home-search.js';
import {catalogState,catalogCandidate} from './scan-catalog.js';
import {createSettingsDialog} from './settings-dialog.js';
import { normalizeHomeDeckActivity, recordHomeDeckWork } from "./home-deck-activity.js";
import { syncGameTabs, attachGameTabs, attachHomeCommunity, refreshHomeCommunity, isHomeRevealCurrent, homeDeckReveal, refreshHomeValue, homeValueCoverage, homeMetaSnapshot } from "./home-ui.js";
import {attachRuleLearning} from './rule-learning.js';
import {loadConditionQuotes,applyConditionQuotes,conditionRequest,CONDITION_IDENTITY} from './condition-feed.js';
import {createConditionRefreshScheduler,conditionCursorKey,selectConditionLots,changedConditionLots,conditionLotIdentity} from './condition-refresh-scheduler.js';
import {brandMark} from './brand.js';
import {ownedCardLots,quickQuantity} from './quick-quantity.js';
import {conditionName,conditionValue,conditionPriceHtml} from './condition-value.js';
import { showAiReview } from './ai-review.js';
import { openAsk, clearAskConversations } from './ai-ask.js';
import { openRulesAsk, closeRulesAsk, clearRulesConversations } from './ai-rules.js';
import { makeAskTools } from './ai-tools.js';
import { ask, askText } from "./dialog.js";
import { attachHomeSwipe } from "./home-swipe.js";
import { routeSegments, normalizeRoute, gameSwitchRoute, historyEntry, createNavigationQueue } from "./game-navigation.js";
import { useMyPrices, myPriceKey, ensureTcgPrices } from "./mtg-tcgprice.js";
import { buyOnTcgplayer, massLines } from "./buy.js";
import {applySwapsToCards} from './insights.js';
import {showRuleHint,dismissRuleHint} from './rule-dex.js';
import {bestBudgetDecks,purchaseCost,comparePower,refineCandidates,towardDeck,spendUp,cardQuality} from './deck-optimizer.js';
import { playRate } from './importance.js';
import { budgetNotes, variantsFrom, difficultyOf } from './deck-optimizer.js';
import {attachCardGestures, CompareSelection, cardActionButtons, HOLD_MS, moved as movedFrom} from './card-actions.js';
import {tcgCompareSheet} from './tcgcompare.js';
import {artworkHTML} from './artwork.js';
import {attachAutomaticBrowse} from './auto-browse.js';
import { createPrintingPicker } from "./printing-picker.js";
import { createScannerPrintingPicker } from "./scanner-printing.js";
import {SheetHistory,BROWSE_TYPES,sheetKey} from "./sheet-history.js";
import {handleArtworkError} from "./artwork.js";
import {selectedFinish,detailIdentity,captureDetailState,restoreDetailState,rememberDetailViewport,restoreDetailViewport,detailTabKey,createDetailJump} from "./pricing-presentation.js";
import {modeFor,registerWorkbench,quoteModel,recordQuote} from "./workbench-ui.js";
import { locationPicker, rememberLocation, chooseLocation } from "./collection-locations.js";
import { captureAuthFields, restoreAuthFields, authFeedback } from "./auth-form.js";
import { formatUpgrades, applyFormatSwap } from "./format-upgrades.js";
import { cutToTarget } from "./deck-safety.js";
import { binderPage, binderMatches, BINDER_COLORS, attachBinderDrag, animateTurn, binderFavorites, MAX_FAVORITES } from "./binders.js";
// CardStashy controller: persistence, routing, sheets and every user action.
// Screens live in views.js; deck/collection math in core.js, planner.js,
// strategy.js, deck-flow.js and insights.js.
import { metaState, loadMeta as loadMetaData, MTG_META_FORMATS, DEFAULT_MTG_META_FORMAT, allCachedMeta } from "./meta.js";
import { mtgPower, mtgMetaKey, asShown, shownPower } from "./power.js";
import { playedAlongside } from "./guide.js";
import { mtgPairQueries, rankPairs, edhPop } from "./pairing.js";
import { nextFact } from "./facts.js";
import { S, STORAGE, CATALOG_RECORD, RECOVERY, blank, uid, meta, inv, deckById, currentDeck, priceOf, cacheCard, slim } from "./store.js";
import { $, $$, esc, safeHref, usd, img, art, cardImage, options, segmented, customBudget, registerSetIcons, captureDisclosures, restoreDisclosures } from "./ui.js";
import * as V from "./views.js";
import { refreshCheapest, cheapestKnown } from "./mtg-cheap.js";
import { readRecord, writeRecord, writeRecords, persistenceStatus, requestPersistence } from "./storage.js";
import {
  cardKey as key, sumQty, typeText, rulesText, isLand, commanderEligible, mergeDeckCard,
  cardPrice, namePrice, drawHand, exportDeck, exportDeckText, aggregateCards, inventory,
} from "./core.js";
import {
  parseImport, previewImport, applyImport, printingState, importErrorsCSV, exportCollectionCSV,
  validateWorkspace, backupEnvelope, deckRowsFromImport,
} from "./confidence.js";
import { parseDeckImport, acquireMissing } from "./deck-flow.js";
import { profileOf, simulateMatchup, podProfile, calibratePods } from "./matchup.js";
import { mtgConstructedPower } from "./deckpower.js";
import { fieldStore, celebrate, calibrateField } from "./matchups-ui.js";
import { completionPlan, commanderTheme } from "./planner.js";
import { sourceCredit, mtgjsonDeck, collectionIdeas, upgradeSuggestions, applyUpgradeSwaps } from "./strategy.js";
import { searchQuery, rankByName, magicFilterError, hasMagicSearchQuery, magicSearchSpec, scryfallSearchPath, mergeMagicCards, loadMagicPrintingPage, captureSearchFocus, restoreSearchFocus } from "./catalog-tools.js";
import { promptInstall, dismissInstall, onInstallable, isIOS } from "./install.js";
import { attachGlassSelects } from "./glass-select.js";
import { attachSuggest } from "./suggest.js";
import { shouldTour, openTour, resetOnboarding, markGuide, guidePrompt } from "./tour.js";
import { tourScenes } from "./tour-scenes.js";
import { haptic, hapticFor, flyToCollection, countUp, ripple, setHaptics, attachGestures, attachTilt } from "./feel.js";
import { alertSheet, setAlert, onAlert, alertText, priceSeries } from "./pricehist.js";
import { onSharedPrices, watchCards } from "./sharedprices.js";
import { mtgCollector, nameCandidates, textPhrases } from "./scan.js";
import { registerScanner, scanView } from "./scancam.js";
import { newGame, proxyList, proxySheetHTML, podSpeed } from "./extras.js";
import { sharePayload, encodeShare, decodeShare } from "./share.js";
import { FORMATS, formatOf, hasCommander, canLead, sizeLabel } from "./formats.js";
import { buildTiers, formatsFor, themeQuery, BUDGET_TIERS, upgradePool, copyLimit, fitFor } from "./builder.js";
import * as T from "./tcg.js";
import { rulesPage, learnSheet } from "./rules.js";
import { GAMES, GAME_ICON, GAME_COLOR } from "./games.js";
import { ICON, actionIcon, decorateGlyphs } from "./icons.js";
import { openZoom, zoomCardOptions } from "./zoom.js";
import { initCloud, cloudInfo, isEmptyWorkspace, statusLabel, scheduleSync, signInGoogle, signInEmail, signInPassword, createAccount, requestPasswordReset, finishPasswordReset, signOut, detachDeviceSync, saveProfile, resolvePending, syncNow, resendConfirmation, deleteAccount } from "./cloud.js";
import { withSnapshot, collectionValue, recordValuePoint, cardSig, engineProfile, swapImpact, lotPrice } from "./insights.js";

/* =========================================================
   Persistence
   ========================================================= */

const stripCache = (s) => {
  const { cache, ...keep } = s;
  void cache;
  return keep;
};
const normalize = (s) => normalizeHomeDeckActivity(stripCache({ ...blank(), ...validateWorkspace(s) }));

function setSaveStatus(text, cls = "") {
  const el = $("#saveStatus");
  if (el) {
    el.textContent = text;
    el.className = "save-status " + cls;
  }
  // The brand mark doubles as the save/sync light: syncing spins, problems turn red.
  const mark = $(".brand .mark");
  if (mark) {
    mark.dataset.state = cls === "bad" ? "bad" : /sync|sav|upload/i.test(text) && !/synced|saved/i.test(text) ? "busy" : cls === "ok" || /synced|saved/i.test(text) ? "ok" : "";
    mark.title = text;
  }
}
// Glass look: frosted surfaces over a blurred copy of the game's daily-card art.
// The art is remembered per game so every screen shares the same backdrop.
const AMBIENT_KEY = "cardstashy-ambient-v1",
  GLASS_KEY = "cardstashy-glass";
const glassOn = () => {
  try {
    return localStorage.getItem(GLASS_KEY) !== "off";
  } catch {
    return true;
  }
};
function updateAmbient() {
  const g = document.body.dataset.game || "mtg",
    art = $("#ambient .amb-art");
  if (!art) return;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(AMBIENT_KEY) || "{}") || {};
  } catch {}
  const hero = $("#homeHero .hh-art");
  const src = hero && !hero.hidden && hero.currentSrc ? hero.currentSrc : hero?.getAttribute("src");
  if (src && saved[g] !== src) {
    saved[g] = src;
    try {
      localStorage.setItem(AMBIENT_KEY, JSON.stringify(saved));
    } catch {}
  }
  const url = saved[g] || "";
  if (art.dataset.src !== url) {
    art.dataset.src = url;
    art.style.backgroundImage = url ? `url("${url.replace(/"/g, "%22")}")` : "none";
  }
  document.body.classList.toggle("glass", glassOn());
}
// Emoji / stock symbols in any template become drawn icons (icons.js), right after each change.
let glyphQueued = false;
const glyphObserver = typeof MutationObserver !== "undefined" ? new MutationObserver(() => {
  if (glyphQueued) return;
  glyphQueued = true;
  requestAnimationFrame(() => {
    glyphQueued = false;
    const g = document.body.dataset.game || "mtg";
    decorateGlyphs($("#app"), g);
    decorateGlyphs($("#sheetBody"), g);
  });
}) : null;
// Shell icons are drawn once from icons.js so the nav, settings and brand share one style.
function decorateShell() {
  for (const b of $$(".bottom-nav [data-nav]")) {
    const span = b.querySelector("span");
    if(span&&b.dataset.nav==="search")span.innerHTML=searchEmblem();
    else if(span&&b.dataset.nav==="community")span.innerHTML='<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/></svg>';
    else if (span && ICON[b.dataset.nav]) span.innerHTML = ICON[b.dataset.nav];
  }
  const gear = $('.topbar [data-act="menu"]');
  if (gear) gear.innerHTML = ICON.settings;
  const mark = $(".brand .mark");
  if (mark) mark.innerHTML = brandMark("brand-idle");
  glyphObserver?.observe(document.body, { childList: true, subtree: true });
}

// Saved locally; when signed in, the account copy follows a few seconds later.
function refreshHomeValueGlance() {
  if (S.ui.view !== 'home') return;
  useMyPrices(S.state.myPrices);
  const game = T.game(), state = game === 'mtg' ? S.state : T.gs(game);
  const value = game === 'mtg' ? collectionValue(state.collection, S.catalog, state.printings, state.decks) : T.collectionValue(game);
  refreshHomeValue(game, $('#content'), { ...value, decks: state.decks.length, history: game === 'mtg' ? state.valueHistory : T.readTcgValueHistory(game) });
}
function afterLocalSave() {
  refreshHomeValueGlance();
  if (cloudInfo().user) {
    setSaveStatus(...statusLabel());
    scheduleSync();
  } else setSaveStatus("Saved on this device", "ok");
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
    .then(() => (afterLocalSave(), true))
    .catch(() => {
      setSaveStatus("Not saved", "bad");
      toast("Couldn’t save on this device. Export a backup from Settings.");
      return false;
    });
}

// Transactional change: mutate a copy, validate, write, then swap in.
// The state before the last undoable change (deck edits, removals, deletions).
let lastUndo = null;
let commitQueue = Promise.resolve();
let conditionWorkspaceRevision = 0;
let workspaceTransition = null;
function queueWorkspaceWrite(transaction) {
  const result = commitQueue.then(transaction, transaction);
  commitQueue = result.catch(() => {});
  return result;
}
// A replacement joins the same queue as edits, so no older edit can revive a cleared
// workspace. Recovery captures the latest committed state, not the state before waiting.
function replaceWorkspace(next, { recovery = false, clearRecovery = false, stamp = false, notify = false, guard = null, kind = "replace" } = {}) {
  return queueWorkspaceWrite(async () => {
    if (guard && !await guard()) return false;
    const value = typeof next === "function" ? next() : next;
    if (typeof next === "function" && value == null) return false;
    const valid = normalize(structuredClone(value));
    if (stamp) valid.lastSavedAt = new Date().toISOString();
    const records = [[STORAGE, valid]];
    if (clearRecovery) records.unshift([RECOVERY, blank()]);
    else if (typeof recovery === "function" ? recovery(S.state) : recovery) records.unshift([RECOVERY, stripCache(S.state)]);
    const transition = workspaceTransition?.begin(valid, {kind});
    try { await writeRecords(records); }
    catch (error) { workspaceTransition?.failed(transition); throw error; }
    S.state = valid;
    conditionWorkspaceRevision++;
    lastUndo = null;
    workspaceTransition?.finished(transition);
    if (notify) afterLocalSave();
    return true;
  });
}
async function commit(fn, { msg = "", recovery = false, rerender = true, enrich = true, undo = "", guard = null, navigationWrite = false, recordDeckWork = true } = {}) {
  const transaction = async () => {
    // Confirm against the latest committed state, without allowing another queued edit to pass.
    if (guard && !await guard(S.state)) return;
    const before = undo ? structuredClone(stripCache(S.state)) : null;
    const previous = S.state;
    const next = structuredClone(stripCache(S.state));
    const out = fn(next);
    const valid = normalize(next);
    if (recordDeckWork && !navigationWrite) recordHomeDeckWork(previous, valid);
    valid.lastSavedAt = new Date().toISOString();
    const records = [[STORAGE, valid]];
    if (recovery) records.unshift([RECOVERY, stripCache(S.state)]);
    const transition = !navigationWrite && valid.settings.game !== previous.settings.game ? workspaceTransition?.begin(valid) : null;
    try { await writeRecords(records); }
    catch (error) { workspaceTransition?.failed(transition); throw error; }
    S.state = valid;
    workspaceTransition?.finished(transition);
    const changedLots = changedConditionLots(previous, valid);
    if (changedLots.length) setTimeout(() => refreshChangedConditions(changedLots), 0);
    afterLocalSave();
    saveCatalogSoon();
    if (rerender) {
      render();
      refreshSheet();
    }
    // Feel it: a removal buzzes twice, anything else gets the success beat; an added card flies
    // into Collection from where you tapped.
    const said = msg || undo;
    if (said) {
      const removed = /^(−|-|Removed|Deleted|Cleared|Undid)/.test(said);
      haptic(removed ? "warn" : "success");
      if (/^Added\b/.test(said)) flyToCollection(lastActTarget);
    }
    if (undo) {
      lastUndo = { state: before, label: undo };
      toast(msg || undo, { undo: true });
    } else if (msg) toast(msg);
    if (enrich) setTimeout(autoEnrich, 50);
    return out;
  };
  return queueWorkspaceWrite(transaction);
}
const safely = (p) => Promise.resolve(p).catch((e) => toast(e.message || String(e)));

/* =========================================================
   Card data (Scryfall)
   ========================================================= */

let apiChain = Promise.resolve(),
  lastActTarget = null;
function api(path, options = {}) {
  const op = async () => {
    if (options.signal?.aborted) throw Error("Card lookup cancelled.");
    await new Promise((r) => setTimeout(r, 110));
    if (options.signal?.aborted) throw Error("Card lookup cancelled.");
    const ctl = new AbortController(),
      cancel = () => ctl.abort(),
      timer = setTimeout(() => ctl.abort(), 16000);
    options.signal?.addEventListener?.("abort", cancel, {once:true});
    try {
      // Busy (429) or a dropped connection: wait a moment and try again, twice, before giving up.
      let r, d;
      for (let attempt = 0; ; attempt++) {
        try {
          r = await fetch("https://api.scryfall.com" + path, {
            ...options,
            headers: { Accept: "application/json", ...options.headers },
            signal: ctl.signal,
          });
          if ((r.status === 429 || r.status >= 500) && attempt < 2) throw Object.assign(Error("busy"), { retry: true });
          d = await r.json();
          break;
        } catch (e) {
          if (e.name === "AbortError" || attempt >= 2) throw e.retry ? Error("The card database is busy. Try again in a moment.") : e;
          await new Promise((ok) => setTimeout(ok, attempt ? 1500 : 600));
        }
      }
      if (!r.ok) throw Object.assign(Error(d.details || "Card database unavailable."),{status:r.status});
      return d;
    } catch (e) {
      throw Object.assign(Error(e.name === "AbortError" ? options.signal?.aborted ? "Card lookup cancelled." : "Card lookup timed out. Check your connection and try again." : e.message),{status:e.status});
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener?.("abort", cancel);
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
      for (const n of chunk) if (!matched.has(key(n))) failed.push(n);
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
      { enrich: false, recordDeckWork: false },
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
  const ui = S.ui.sets, screen=navigationStamp();
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
    if (navigationCurrent(screen) && !document.activeElement?.matches?.("input:not([data-input=setsSearch]), textarea, select")) render();
  }
}

// Every printing in a set, straight from Scryfall, so new sets appear as soon as Scryfall has them.
const setCache = new Map();
async function loadSet(code) {
  const st = S.ui.set, generation = (st.generation || 0) + 1, screen=navigationStamp();
  st.generation = generation;
  const current = () => S.ui.set === st && st.code === code && st.generation === generation && navigationCurrent(screen);
  if (setCache.has(code)) {
    Object.assign(st, setCache.get(code), { loaded: true, busy: false });
    return render();
  }
  st.busy = true;
  st.error = "";
  st.complete = false;
  st.cards = [];
  try {
    const info = await api("/sets/" + encodeURIComponent(code));
    if(!current())return;
    st.info = info;
    if(T.game() === "mtg" && S.ui.view === "set")render();
    let path = "/cards/search?" + new URLSearchParams({ q: "e:" + code, unique: "prints", order: "set", dir: "asc", include_extras: "true", include_variations: "true" });
    const cards = new Map();
    for (let page = 0; path && page < 30 && current(); page++) {
      const d = await api(path);
      if(!current())return;
      st.total = d.total_cards || st.total;
      for(const c of d.data || [])if(c.id && c.set === code)cards.set(c.id,slim(c));
      st.cards = [...cards.values()];
      path = d.has_more && d.next_page ? new URL(d.next_page).pathname + new URL(d.next_page).search : null;
      if(T.game() === "mtg" && S.ui.view === "set")render();
    }
    if (current()) {
      st.loaded = true;
      st.complete = !path;
      if(st.complete)setCache.set(code, { info: st.info, cards: st.cards, total: st.total, complete: true });
      else st.error = "The provider list is incomplete. Refresh to try again.";
      ensureTcgPrices(st.cards);
    }
  } catch (e) {
    if(current()){
      st.error = st.cards.length ? "Some cards didn’t load: " + e.message : e.message;
      st.loaded = !!st.cards.length;
    }
  } finally {
    if(current()){
      st.busy = false;
      if(T.game() === "mtg" && S.ui.view === "set")render();
    }
  }
}

/* =========================================================
   Shared deck links and the "almost build" finder
   ========================================================= */
async function openShared(code) {
  const sh = S.ui.shared, screen=navigationStamp();
  const current=()=>navigationCurrent(screen)&&S.ui.shared===sh&&sh.code===code&&S.ui.view==="shared";
  Object.assign(sh, { code, deck: null, error: "" });
  try {
    const deck = await decodeShare(code);
    if (!current()) return;
    sh.deck = deck;
    render();
    if (deck.game) {
      // Yu-Gi-Oh! / Pokémon: load every card by id, then redraw.
      await T.ensureMany(deck.game, ["main", "extra", "side"].flatMap((z) => (deck.zones[z] || []).map((r) => r.cardId)), () => current() && render());
      if (current()) render();
      return;
    }
    const r = await resolveNames(deck.cards.map((c) => c.name).concat(deck.commander || []));
    if (r.total && current()) render();
  } catch (e) {
    if (current()) sh.error = e.message;
    if (current()) render();
  }
}
// Link back to a shared deck for attribution; very long links fall back to the site address.
const sharedSourceURL = () => (location.href.length <= 2000 ? location.href : location.origin + location.pathname);

const PRECON_RECORD = "cardforge-precons-v1";
async function loadPreconCache() {
  const F = S.ui.finder,screen=navigationStamp();
  F.cacheLoaded = true;
  try {
    const rec = await readRecord(PRECON_RECORD);
    if (rec?.decks?.length) {
      F.precons = rec.decks;
      if(navigationCurrent(screen))render();
      const names = rec.decks.flatMap((d) => d.cards.map((c) => c.name)).filter((n) => !meta(n));
      if (names.length && navigator.onLine) {
        await resolveNames(names);
        if (navigationCurrent(screen) && S.ui.view === "decks") render();
      }
    }
  } catch {}
}

/* =========================================================
   Toast, sheet, download
   ========================================================= */

let toastTimer;
const TOAST_OK = `<svg class="toast-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>`;
function toast(text, { undo = false } = {}) {
  const t = $("#toast"),
    ok = /^(Added|Saved|On the list|Alert saved|Copied|List copied|Switched|Moved|Updated|\+)/.test(text);
  t.innerHTML = `${ok ? TOAST_OK : ""}<span>${esc(text)}</span>${undo ? `<button class="toast-undo" data-act="undo">Undo</button>` : ""}`;
  t.classList.toggle("ok", ok);
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.toggle("has-action", undo);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show", "has-action"), undo ? 7000 : 3800);
}

let binderDragCleanup = null, lastSheetStep = "";
const sheetTrail=new SheetHistory(), routeTrail=[];
let restoringSheet=false,pendingRoute=null;
function sheetSnapshot(){
 const ctx=S.ui.sheetCtx;if(!ctx||!BROWSE_TYPES.has(ctx.type))return null;
 return {ctx,html:$("#sheetBody").innerHTML,detailState:captureDetailState($("#sheetBody")),scroll:$("#sheetBody").scrollTop,route:location.hash,game:T.game(),pageScroll:window.scrollY,
   proven:ctx.type === "proven"?{...T.proven}:null,build:ctx.type === "tbuild"?{...T.ui(T.game()).build}:null};
}
function restoreSheet(snapshot){
 if(snapshot.proven)Object.assign(T.proven,snapshot.proven);
 if(snapshot.build)Object.assign(T.ui(snapshot.game).build,snapshot.build);
 restoringSheet=true;
 try{openSheet(snapshot.html,snapshot.ctx,snapshot.scroll);refreshSheet();wireSheetBack();restoreDetailState($("#sheetBody"),snapshot.detailState);}
 finally{restoringSheet=false;}
}
function wireSheetBack(){
 const head=$("#sheetBody")?.querySelector?.(".sheet-head");if(!head)return;
 let button=head.querySelector('[data-history-back]');
 if(!sheetTrail.length){if(button){if(button.dataset.originalAct){button.dataset.act=button.dataset.originalAct;button.setAttribute("aria-label",button.dataset.originalLabel||"Back");delete button.dataset.historyBack;delete button.dataset.originalAct;delete button.dataset.originalLabel;}else button.remove();}return;}
 if(!button){button=head.querySelector('[data-act="buyBack"],[data-act="marketBack"],[data-act="sheetBack"]');if(button){button.dataset.originalAct=button.dataset.act;button.dataset.originalLabel=button.getAttribute("aria-label")||"Back";}else{button=document.createElement("button");button.className="icon";button.innerHTML=ICON.back;head.prepend(button);}button.dataset.act="sheetHistoryBack";button.dataset.historyBack="1";button.setAttribute("aria-label","Back to previous card or deck");}
}

function wireRouteBack(){
 const main=$("#content");if(!main||!routeTrail.length||main.querySelector?.('[data-act="routeHistoryBack"]'))return;
 const saved=routeTrail.at(-1);if(saved.game!==T.game()){routeTrail.length=0;return;}
 const button=document.createElement("button");button.className="link browse-return";button.dataset.act="routeHistoryBack";button.textContent="← Back to "+(saved.ctx.name || "previous card or deck");main.prepend(button);
}
// Release projections belong to the current card, never to the global cache or another game.
function contextTcgCard(game, id, ctx = S.ui.sheetCtx) {
  if (!["ptcg", "ygo"].includes(game)) return null;
  const card = T.cardOf(game, id);
  if (!card || (card.game && card.game !== game)) return null;
  const contextId = ctx?.id ?? ctx?.card?.id;
  const scoped = ["tcard", "tadd", "market"].includes(ctx?.type) && ctx.game === game && String(contextId) === String(id);
  const membership = ctx?.setMembership;
  const source = scoped && membership?.membership === "set-response" && membership.game === game && String(membership.cardId) === String(id) && membership.releaseId === ctx.setId ? {...card,setContext:membership} : card;
  return scoped && (ctx.setId || ctx.setReleaseUnverified) ? T.setContextCard(game, source, ctx.setId, game === "ygo" ? T.currentYgoCatalogue() : T.ui(game).sets.list, {variantKey:ctx.setVariant || "",unverifiedRelease:!!ctx.setReleaseUnverified}) : card;
}
const detailContextIdentity=ctx=>detailIdentity(ctx,ctx?.type==="card"?ctx.print||meta(ctx.name):null);
function openSheet(html, ctx = null, scrollTop = 0) {
  dismissRuleHint();
  if (S.ui.sheetCtx !== ctx || $("#sheetBody")?.dataset?.detailIdentity !== detailContextIdentity(ctx)) dismissRulesGuide();
  const dlg = $("#sheet");
  if (S.ui.sheetCtx !== ctx || !dlg.open) T.cancelProvenBuild();
  const detailState = dlg.open && S.ui.sheetCtx === ctx && !!detailContextIdentity(ctx) && $("#sheetBody").dataset.detailIdentity === detailContextIdentity(ctx) ? captureDetailState($("#sheetBody")) : null;
  const cardPopup = ["card","tcard"].includes(ctx?.type);
  const enteringCard = cardPopup && (!dlg.open || sheetKey(S.ui.sheetCtx) !== sheetKey(ctx));
  dlg.dataset.cardPopup = String(cardPopup);
  if(!restoringSheet && $("#sheet").open)sheetTrail.push(sheetSnapshot(),ctx);
  pendingRoute=null;
  binderDragCleanup?.(); binderDragCleanup=null;
  const stepKey = [ctx?.type,ctx?.tab,ctx?.id || ctx?.name,ctx?.finish].join(":");
  S.ui.sheetCtx = ctx;
  $("#sheetBody").detailMountGeneration = ($("#sheetBody").detailMountGeneration || 0) + 1;
  $("#sheetBody").innerHTML = html;
  $("#sheetBody").dataset.detailIdentity = detailContextIdentity(ctx);
  if (lastSheetStep && lastSheetStep !== stepKey) {
    $("#sheetBody").classList.remove("sheet-step");
    void $("#sheetBody").offsetWidth;
    $("#sheetBody").classList.add("sheet-step");
  }
  lastSheetStep = stepKey;
  if (!dlg.open) {
    // Remember what opened the sheet so focus can return there, and stop the page behind from scrolling.
    sheetReturn = document.activeElement;
    document.documentElement?.classList.add("sheet-open");
    dlg.showModal();
  }
  if (enteringCard && !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches && dlg.animate) {
    for (const animation of dlg.getAnimations?.() || []) if (animation.id === "card-popup-enter") animation.cancel();
    const animation = dlg.animate([{ opacity:0,transform:"translateY(18px) scale(.975)" },{ opacity:1,transform:"translateY(0) scale(1)" }],{duration:280,easing:"cubic-bezier(.16,1,.3,1)"});
    animation.id = "card-popup-enter";
  }
  $("#sheetBody").scrollTop = scrollTop;
  sheetScrolled();
  refreshConditionPrice();
  wireSheetBack();
  if (detailState) { restoreDetailState($("#sheetBody"),detailState); sheetScrolled(); }
  if (!sheetScrollWired) {
    sheetScrollWired = true;
    $("#sheetBody").addEventListener?.("scroll", sheetScrolled, { passive: true });
    // Fold/rotate in place: only recompute sticky-header clearance, not content.
    window.addEventListener?.("resize", () => {
      const body = $("#sheetBody"), ctx = S.ui.sheetCtx;
      if ($("#sheet").open && ["card","tcard"].includes(ctx?.type)) {
        restoreDetailViewport(body, detailContextIdentity(ctx) + ":" + (ctx.tab || "overview"), `${window.innerWidth}x${window.innerHeight}`, body.detailMountGeneration);
      }
      sheetScrolled();
    }, { passive: true });
  }
  if (ctx?.type === "binder") binderDragCleanup = attachBinderDrag($("#sheetBody"),(delta,how)=>A.binderPage({dataset:{page:String(ctx.page+delta)},how}));
}
// Emblems (meta staple, flexible staple…) come from cached tournament data. Fetch the current
// game's data quietly in the background once per session if it's missing or older than 12 hours.
const warmed = new Set();
function warmEmblems() {
  const screen=navigationStamp(), g = T.game(),
    k = g === "mtg" ? "mtg:" + mtgMetaFormat() : g;
  if (warmed.has(k)) return;
  warmed.add(k);
  const M = metaState(k);
  if (M.busy || (M.data && Date.now() - M.at < 12 * 3600e3)) return;
  setTimeout(() => loadMetaData(k).then(() => {
    // Home refreshes its own data in place. An emblem fetch must not replace a
    // carousel under an active touch; cached emblems appear on the next natural render.
    if (navigationCurrent(screen) && S.ui.view !== "home" && !document.querySelector("input:focus, textarea:focus") && !$("#sheet").open) render();
  }).catch(() => {}), 2500);
}
let sheetReturn = null,
  sheetScrollWired = false;
// Past the hero art, the floating ✕ gets a solid bar with the title, so it never sits on top of text.
function sheetScrolled() {
  const body = $("#sheetBody"),
    head = body?.querySelector?.(".sheet-head.overlay");
  if (!head) return;
  const ctx = S.ui.sheetCtx;
  if ($("#sheet").open && ["card","tcard"].includes(ctx?.type)) rememberDetailViewport(body, detailContextIdentity(ctx) + ":" + (ctx.tab || "overview"), `${window.innerWidth}x${window.innerHeight}`, body.detailMountGeneration);
  const on = body.scrollTop > 110;
  if (on && !head.querySelector(".sh-title")) {
    const t = document.createElement("b");
    t.className = "sh-title";
    t.textContent = body.querySelector("h2")?.textContent || "";
    head.firstElementChild?.after(t);
  }
  head.classList.toggle("scrolled", on);
  body.style?.setProperty?.("--card-tabs-top",Math.max(0,on?head.getBoundingClientRect().bottom-body.getBoundingClientRect().top:0)+"px");
}
function closeSheet(rememberRoute=true) {
  T.cancelProvenBuild();
  if (S.ui.sheetCtx?.type === "printing-picker") printingPicker.abandon();
  dismissRulesGuide();
  pendingRoute=rememberRoute && $("#sheet").open ? sheetSnapshot() : null;
  if(pendingRoute)pendingRoute.at=Date.now();
  sheetTrail.clear();
  binderDragCleanup?.(); binderDragCleanup=null;
  const dlg = $("#sheet");
  if (dlg.open) dlg.close();
  S.ui.sheetCtx = null;
}
function refreshSheet() {
  const ctx = S.ui.sheetCtx;
  if (!ctx || !$("#sheet").open) return;
  if (["card","tcard","buy"].includes(ctx.type)) {
    const c = ctx.type === "card" ? ctx.print || meta(ctx.name) : ctx.type === "tcard" ? contextTcgCard(ctx.game,ctx.id,ctx) : ctx.print;
    if (!c && ctx.type !== "buy") return;
    const body = $("#sheetBody"), saved = body.dataset.detailIdentity === detailContextIdentity(ctx) ? captureDetailState(body) : null;
    body.detailMountGeneration = (body.detailMountGeneration || 0) + 1;
    body.innerHTML = ctx.type === "card" ? V.cardSheet(c,ctx) : ctx.type === "tcard" ? T.tcgCardSheet(c,ctx) : V.buySheet(ctx);
    body.dataset.detailIdentity = detailContextIdentity(ctx);
    wireSheetBack();
    restoreDetailState(body,saved);
    sheetScrolled();
    return;
  }
  if (ctx.type === "idea") return openIdea(ctx.i);
  if (ctx.type === "proven") return tcgCtx.refreshProven?.();
  if (ctx.type === "tbuild") {
    const top = $("#sheetBody").scrollTop;
    $("#sheetBody").innerHTML = T.tcgBuildSheet();
    $("#sheetBody").scrollTop = top;
    return;
  }
  if (ctx.type === "build") {
    const top = $("#sheetBody").scrollTop;
    $("#sheetBody").innerHTML = V.buildSheet();
    $("#sheetBody").scrollTop = top;
    return;
  }
  if (ctx.type === "review") {
    const top = $("#sheetBody").scrollTop;
    $("#sheetBody").innerHTML = V.deckReviewSheet(deckById(ctx.deckId) || currentDeck());
    $("#sheetBody").scrollTop = top;
    return;
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
    download("CardStashy_List.txt", text + "\n");
    toast("Clipboard blocked — downloaded as a text file instead.");
  }
}
const fileSafe = (s) => String(s).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "deck";

/* =========================================================
   Routing
   ========================================================= */

const VIEWS = ["home", "search", "collection", "decks", "deck", "scan", "settings", "sets", "set", "shared", "tdeck", "rules"];

function parseHash() {
  const segments = routeSegments(location.hash);
  const [v, a, b] = segments;
  const ui = S.ui,
    prev = ui.view + ui.deckId;
  ui.view = VIEWS.includes(v) ? v : "home";
  if (ui.view === "collection" && ["cards", "binders", "value", "wishlist"].includes(a)) {
    ui.collTab = a;
    if(T.isTcg()) { T.ui().coll.tab = a === "wishlist" ? "cards" : a; if(a === "wishlist")T.ui().coll.show="wanted"; }
  }
  if (ui.view === "shared" && a !== ui.shared.code) openShared(a);
  if (ui.view === "tdeck") { ui.tdeckId = a; if (b && ["cards","insights","matchups","upgrade","versions","playtest","rules"].includes(b)) (ui.tdeckTab ||= {})[T.game()+":"+a]=b; }
  if (ui.view === "set" && T.isTcg()) {
    if (!a) ui.view = "sets";
    else ui.tsetId = a;
  } else if (ui.view === "set") {
    if (!a) ui.view = "sets";
    else if (a.toLowerCase() !== ui.set.code) ui.set = { ...ui.set, code: a.toLowerCase(), info: null, cards: [], total: 0, loaded: false, busy: false, error: "", q: "", filter: "all", rarity: "all", finish: "all", complete: false, limit: 120 };
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
    if (["cards", "engine", "matchups", "upgrade", "versions", "playtest", "shop", "rules"].includes(b)) ui.deckTab = b;
    if (id && id !== S.state.activeDeck && deckById(id)) {
      S.state.activeDeck = id;
      save();
    }
  }
  return prev !== ui.view + ui.deckId;
}

function go(hash) {
  if(normalizeRoute(hash)==="#settings"){settingsPopup.open();return Promise.resolve(true);}
  if(pendingRoute && Date.now()-pendingRoute.at<500 && pendingRoute.route!==hash && pendingRoute.game===T.game()){routeTrail.push(pendingRoute);if(routeTrail.length>12)routeTrail.shift();}pendingRoute=null;
  return navigate({ game: activeEntry?.game || T.game(), hash: normalizeRoute(hash), mode: "push" });
}

const autoLoaded = new Set();
let browseCleanup=null;
function attachBrowseObserver() {
 browseCleanup?.();
 browseCleanup=attachAutomaticBrowse($("#content"),{
  Observer:typeof IntersectionObserver === "undefined"?null:IntersectionObserver,
  dispatch:button=>A[button.dataset.act]?.(button),
  blocked:()=>!!document.querySelector?.('dialog[open]'),
  errorFor:action=>action === "dbMore"?S.ui.db.error:action === "setMore"?S.ui.set.error:action === "tMore"?T.ui(T.game()).search.error:action === "tSetMore"?T.ui(T.game()).set.error:action === "tSetsMore"?T.ui(T.game()).sets.error:false
 });
}

const autoMeta = new Set();
const savedDeckMetaRequests = new Map();
let lastPageKey = "";
const cheapChecked = new Set();
let tcgCheckedFor = "";
const disclosureStates=new Map();
let rulesGuideOrigin = null;
function currentRulesOrigin() {
  const game = T.game(), view = S.ui.view;
  const deck = view === "deck" && game === "mtg" ? deckById(S.ui.deckId) : view === "tdeck" && game !== "mtg" ? T.gs(game).decks.find(d => d.id === S.ui.tdeckId) : null;
  return { game, route: location.hash, deckFormat: deck?.format || "" };
}
function dismissRulesGuide() { closeRulesAsk(); dismissRuleHint(); rulesGuideOrigin = null; }
function render() {
  if(settingsPopup?.isOpen){settingsPopup.refresh();return;}
  if (navigationPending && !navigationInstalling) return;
  const screen = navigationStamp();
  if (rulesGuideOrigin && JSON.stringify(currentRulesOrigin()) !== JSON.stringify(rulesGuideOrigin)) dismissRulesGuide();
  if(S.ui.view==='collection'){setTimeout(refreshCollectionConditions,0);if(T.game()==='mtg')setTimeout(()=>refreshMagicCollectionPrices().catch(()=>{}),0);}
  useMyPrices(S.state.myPrices);
  // Owned printings Scryfall leaves unpriced get TCGplayer's price (once per collection size).
  if (S.ui.view === "collection" && String(S.state.collection.length)+":"+Math.floor(Date.now()/86400000) !== tcgCheckedFor) {
    tcgCheckedFor = String(S.state.collection.length)+":"+Math.floor(Date.now()/86400000);
    ensureTcgPrices(S.state.collection.map((e) => (e.printingVerified && S.state.printings?.[e.printingId]) || null).filter(Boolean));
  }
  const authFields=S.ui.view === "settings" && !cloudInfo().user ? captureAuthFields(document) : [];
  // Ordinary unsaved profile fields survive Settings→Settings game changes.
  // Authentication remains in the existing render-local path, never history/storage.
  const profileFields=S.ui.view === "settings" ? ["pfName","pfUser","pfBio"].flatMap(id=>{const field=$("#"+id);return field?[{id,value:field.value}]:[];}) : [];
  browseCleanup?.();
  const ui = S.ui;
  // The scanner keeps its camera stream across renders (or stops it when you leave the page).
  setTimeout(() => navigationCurrent(screen) && scanCtx.afterRender?.(), 0);
  warmEmblems();
  setTimeout(updateAmbient, 0);
  for (const b of $$("[data-nav]")) b.classList.toggle("on", b.dataset.nav === (ui.view === "deck" ? "decks" : ui.view === "set" || ui.view === "sets" ? "search" : ui.view));
  document.body.dataset.view = ui.view;
  const g = T.game();
  const content=$('#content'),previousDisclosureKey=content?.dataset?.disclosureKey;
  if(previousDisclosureKey)disclosureStates.set(previousDisclosureKey,captureDisclosures(content));
  if(disclosureStates.size>100)disclosureStates.delete(disclosureStates.keys().next().value);
  const disclosureKey=[g,ui.view,ui.deckId,ui.tdeckId,ui.set?.code,ui.tsetId,ui.collTab,ui.decksTab,ui.deckTab,...(ui.view === "collection" && g !== "mtg" ? [T.ui(g).coll.tab || "cards"] : [])].join(':');
  const searchFocus=["home","search","collection"].includes(ui.view) && previousDisclosureKey === disclosureKey ? captureSearchFocus(content) : null;
  if (searchFocus?.key === "id:dbTerm") searchFocus.value = ui.db.term;
  if(content?.dataset)content.dataset.disclosureKey=disclosureKey;
  const priorSectionRail=previousDisclosureKey === disclosureKey ? readSectionTabRail(content) : null;
  document.body.dataset.game = g;
  document.body.style?.setProperty("--game-color", GAME_COLOR[g]);
  syncGameTabs($("#gameTabs"), g);
  $(".brand-home")?.setAttribute?.("aria-current",ui.view==="home"?"page":"false");
  content?.setAttribute?.("aria-labelledby", `game-tab-${g}`);
  const views = {
    home: V.home, search: V.search, collection: V.collection, decks: V.decks,
    deck: V.deckPage, scan: () => scanView("mtg", "Magic"), settings: V.settings, sets: V.setsPage, set: V.setPage, shared: V.sharedPage,
  };
  // Yu-Gi-Oh! and Pokémon share their own screens; Magic keeps its full set.
  const tcgViews = {
    home: T.tcgHome, search: T.tcgSearch, collection: T.tcgCollection, decks: T.tcgDecks, tdeck: () => T.tcgDeck(ui.tdeckId), sets: T.tcgSets, set: T.tcgSet,
    deck: T.tcgDecks,
    scan: () => scanView(g, GAMES[g].short),
  };
  if (g !== "mtg" && ui.view === "deck") ui.view = "decks";
  if (ui.view === "home") setTimeout(() => navigationCurrent(screen) && heroArt(g), 0);
  $("#content").className="";
  if (ui.view === "rules") {
    $("#content").innerHTML = rulesPage(g, ui.rules[g] || (ui.rules[g] = { list: "", busy: false, error: "", data: {} }));
    restoreDisclosures(content,disclosureStates.get(disclosureKey));
    return;
  }
  if (ui.view === "shared" && ui.shared.deck?.game) {
    $("#content").innerHTML = T.tcgSharedPage(ui.shared.deck);
    restoreDisclosures(content,disclosureStates.get(disclosureKey));
    return;
  }
  $("#content").innerHTML = (g !== "mtg" && tcgViews[ui.view] ? tcgViews[ui.view] : views[ui.view] || V.home)();
  restoreDisclosures(content,disclosureStates.get(disclosureKey));
  content.dataset.disclosureKey=disclosureKey;
  restoreSearchFocus(content,searchFocus);
  placeGlobalSearch(g,ui.view);
  const guideKey={collection:"save",decks:"build",scan:"scan"}[ui.view];
  if(guideKey)content.insertAdjacentHTML?.("afterbegin",guidePrompt(guideKey));
  if(introPending)setTimeout(safeIntro,100);
  restoreSectionTabRail(content,priorSectionRail);
  if (ui.view === "home") refreshHomeCommunity(g, content).catch(() => {});
  if(!cloudInfo().user)restoreAuthFields(document,authFields);
  for(const {id,value} of profileFields){const field=$("#"+id);if(field)field.value=value;}
  const displayArea=["deck","tdeck"].includes(ui.view)?"deck":ui.view === "search"?"search":ui.view === "set"?"set":ui.view === "collection" && (g === "mtg" ? ui.collTab === "wishlist" : T.ui(g).coll.tab === "wishlist")?"wishlist":ui.view === "collection" && (g === "mtg" ? ui.collTab === "cards" : !T.ui(g).coll.tab || T.ui(g).coll.tab === "cards")?"collection":null;
  $("#content").className=displayArea ? "view-"+modeFor(g,displayArea) : "";
  if (comparison.active && comparison.game !== g) { comparison.cancel(); updateCompareTray(); }
  // A new page (not a refresh of the same one) glides in; totals count up.
  const pageKey = [g, ui.view, ui.collTab, ui.decksTab, ui.deckTab, g === "mtg" ? "" : T.ui(g).coll.tab, g === "mtg" ? "" : ui.tdeckTab?.[g+":"+ui.tdeckId]].join(":");
  if (pageKey !== lastPageKey) {
    lastPageKey = pageKey;
    $("#content").classList.add("page-enter");
    if (navDir) $("#content").classList.add(navDir === "back" ? "page-back" : "page-fwd");
    setTimeout(() => countUp($("#content")), 60);
  }
  attachBrowseObserver();
  // A Magic deck's costs use each card's cheapest legal printing: check them once per session.
  if (ui.view === "deck" && g === "mtg" && currentDeck() && !cheapChecked.has(currentDeck().id)) {
    const d = currentDeck();
    cheapChecked.add(d.id);
    refreshCheapest([...d.cards, ...(d.side || [])].map((r) => r.name).filter((n) => !/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(n)), { api, key, limit: 80 }).then((n) => n && navigationCurrent(screen) && render()).catch(() => {});
  }
  // Deck Power needs the field: load tournament results once per format, the first time a
  // Power tab opens without them.
  const metaBtn = $("#content [data-autoload-meta]");
  if (metaBtn && !autoMeta.has(metaBtn.dataset.autoloadMeta)) {
    autoMeta.add(metaBtn.dataset.autoloadMeta);
    setTimeout(() => metaBtn.isConnected && metaBtn.click(), 50);
  }
  // Matchups start simulating the first time the tab opens (once per deck per session).
  const runBtn = $("#content [data-autorun]");
  if (runBtn && !autoMeta.has("run:" + runBtn.dataset.autorun)) {
    autoMeta.add("run:" + runBtn.dataset.autorun);
    setTimeout(() => runBtn.isConnected && runBtn.click(), 80);
  }
  // Deck tiles lead with the Competitive score, so load each Magic format's tournament results
  // once when the deck list or Home shows decks in it.
  if (g === "mtg" && ["decks", "home"].includes(ui.view)) {
    const origin = { view: ui.view, route: disclosureKey, root: content, mount: content.firstElementChild, state: S.state, sheet: ui.sheetCtx };
    const current = () => navigationCurrent(screen) && T.game() === "mtg" && S.ui.view === origin.view && S.state === origin.state && S.ui.sheetCtx === origin.sheet &&
      $("#content") === origin.root && content.isConnected && content.firstElementChild === origin.mount && content.dataset.disclosureKey === origin.route;
    // Only noninteractive score leaves change. Search, deck buttons, value and
    // discovery controls remain mounted even when this shares Home's request.
    const paint = () => { if (current()) V.refreshDeckScores(content); };
    for (const k of new Set(S.state.decks.map((d) => mtgMetaKey(d)).filter(Boolean))) {
      const M = metaState(k), pending = savedDeckMetaRequests.get(k);
      if (pending) { pending.current = current; pending.paint = paint; continue; }
      if (M?.data || autoMeta.has(k)) continue;
      const request = { current, paint };
      savedDeckMetaRequests.set(k, request); autoMeta.add(k);
      setTimeout(() => {
        if (!request.current()) { savedDeckMetaRequests.delete(k); autoMeta.delete(k); return; }
        // Home may have started the same provider in its earlier microtask.
        // Subscribe to that promise; never launch a second request for it.
        const active = metaState(k);
        Promise.resolve(active.busy && active.promise ? active.promise : loadMetaData(k))
          .then(() => request.paint()).catch(() => {}).finally(() => savedDeckMetaRequests.delete(k));
      }, 200);
    }
  }
  if (ui.view === "settings") storageDetail();
  if (g !== "mtg") {
    const SU = T.ui(g).sets;
    if (["sets","collection"].includes(ui.view) && !SU.list.length && !SU.busy && !SU.error) setTimeout(() => navigationCurrent(screen) && tcgCtx.loadSets?.(g), 0);
    if (ui.view === "set" && ui.tsetId && T.ui(g).set.id !== ui.tsetId) { const id=ui.tsetId; setTimeout(() => navigationCurrent(screen) && tcgCtx.openSet?.(id, false, g), 0); }
    // Ideas, Meta decks and Deck Power need the current tournament meta.
    const MS = T.metaState(g);
    if ((ui.view === "tdeck" || (ui.view === "decks" && (!ui.decksTab || ["ideas", "inspiration", "mine"].includes(ui.decksTab)))) && !MS.busy && T.metaNeedsRefresh(g) && !autoLoaded.has("meta" + g + MS.at)) {
      autoLoaded.add("meta" + g + MS.at);
      setTimeout(() => navigationCurrent(screen) && tcgCtx.loadMeta?.(g), 0);
    }
    // Load card data and prices for what's on screen.
    const ids = ui.view === "collection" && (!T.ui(g).coll.tab || T.ui(g).coll.tab === "cards") ? [...document.querySelectorAll(".lot-art[data-id]")].map(e=>e.dataset.id) : ui.view === "collection" || (ui.view === "decks" && ui.decksTab === "ideas") ? T.gs(g).collection.map((e) => e.cardId) : ui.view === "tdeck" ? (T.gs(g).decks.find((d) => d.id === ui.tdeckId)?.zones ? ["main", "extra", "side"].flatMap((z) => T.gs(g).decks.find((d) => d.id === ui.tdeckId).zones[z].map((r) => r.cardId)) : []) : ui.view === "home" || ui.view === "decks" ? T.gs(g).decks.flatMap((d) => (d.zones.main || []).slice(0, 1).map((r) => r.cardId)) : [];
    const missing = ids.filter(id=>T.needsCardRefresh(g,T.cardOf(g,id)));
    const k = g + ui.view + Math.floor(Date.now()/3600000) + ":" + [...new Set(missing)].sort().join(",");
    if (missing.length && navigator.onLine && !autoLoaded.has(k)) {
      autoLoaded.add(k);
      T.ensureMany(g, missing, () => {}).then(() => navigationCurrent(screen) && (S.ui.view === "home" ? refreshHomeValueGlance() : render()));
    }
    return;
  }
  const deck = ui.view === "deck" ? currentDeck() : null;
  // Deck Power compares constructed lists with recent tournament decks for the same format.
  const mk = deck ? mtgMetaKey(deck) : null;
  if (mk && navigator.onLine && !autoLoaded.has("meta" + mk)) {
    const MS = metaState(mk);
    if (!MS.busy && (!MS.data || Date.now() - MS.at > 12 * 3600e3)) {
      autoLoaded.add("meta" + mk);
      loadMetaData(mk).then(() => navigationCurrent(screen) && render()).catch(() => {});
    }
  }
  if (deck && navigator.onLine && !autoLoaded.has(deck.id) && deck.cards.some((c) => !meta(c.name))) {
    autoLoaded.add(deck.id);
    resolveNames(deck.cards.map((c) => c.name)).then((r) => {
      if (r.total && navigationCurrent(screen)) render();
    });
  }
  if (ui.view === "decks" && ui.decksTab === "inspiration" && !ui.finder.cacheLoaded) loadPreconCache();
  if (ui.view === "decks" && ui.decksTab === "inspiration") loadMtgMeta();
  if (["sets","collection"].includes(ui.view) && !ui.sets.list.length && !ui.sets.busy && !ui.sets.error) loadSetIndex(true);
  if (ui.view === "set" && !ui.set.loaded && !ui.set.busy && !ui.set.error) loadSet(ui.set.code);
  if (ui.view === "decks" && ui.decksTab === "ideas" && !ui.ideas.cache.length && !ui.ideas.busy && !ui.ideas.ran) {
    ui.ideas.ran = true;
    setTimeout(() => navigationCurrent(screen) && buildIdeas(), 30);
  }
}

const tcgCtx = {};

// Every page remembers where you were. Going back (the browser's back, or a link to the page you
// came from, like "All sets") returns you to that spot instead of the top; going forward starts a
// new page at the top. Lists that fill in after the page draws (set grids, results) are waited for.
try { history.scrollRestoration = "manual"; } catch {}
const scrollMem = new Map();
let navDir = "", scrollRestore = 0;

function restoreScroll(top) {
  const run = ++scrollRestore, until = Date.now() + 2500;
  const stop = () => { scrollRestore++; off(); };
  const off = () => { for (const e of ["wheel", "touchstart", "keydown", "pointerdown"]) removeEventListener(e, stop, true); };
  for (const e of ["wheel", "touchstart", "keydown", "pointerdown"]) addEventListener(e, stop, { capture: true, once: true, passive: true });
  const step = () => {
    if (run !== scrollRestore) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, Math.min(top, Math.max(0, max)));
    if (max >= top - 2 || Date.now() > until) return off();
    requestAnimationFrame(step);
  };
  step();
}
// Public hashes stay compatible; entry metadata is the source of truth for the game.
let activeEntry = null, entrySequence = 0, navigationPending = false, navigationInstalling = false, suspendedGame = null, navigationReady = false, workspaceVisitRevision = 0;
const entryOrigins = new Map();
let rollbackHistoryId=null;
const makeEntry = (game, route, index) => ({ version:1, game, route, entryId:Date.now().toString(36)+"-"+(++entrySequence), index });
const navigationStamp = () => ({ revision:navigation.revision, workspace:workspaceVisitRevision, game:T.game(), hash:location.hash });
const navigationCurrent = stamp => stamp.revision === navigation.revision && stamp.workspace === workspaceVisitRevision && stamp.game === T.game() && stamp.hash === location.hash;
function rememberScroll() { if(activeEntry) { scrollMem.set(activeEntry.entryId,window.scrollY); if(scrollMem.size>100)scrollMem.delete(scrollMem.keys().next().value); } }
function replaceEntry(entry) { history.replaceState({...history.state,cardstashy:entry},"",entry.route); }
function gameChangeBlocked() {
  const chooser=S.ui.sheetCtx?.type === "game";
  return !!document.querySelector('#resetPassword')?.value || !!document.querySelector('#resetConfirm')?.value || !!document.querySelector('.tour, .zoom-overlay, [role="dialog"]') || [...document.querySelectorAll('dialog[open]')].some(d => !(chooser && d.id === "sheet") && !d.matches?.("dialog.cf-dialog.closing"));
}
function suspendGame(target, workspace = false, kind = "") {
  if(suspendedGame){
    // A pending Undo may retain its source camera. A later game change or
    // unrelated replacement revokes that exception even before installation.
    if(target!==suspendedGame || workspace&&kind!=="undo")scanCtx.stopCamera?.();
    return true;
  }
  if(scanCtx.beforeGameChange?.(activeEntry?.game || T.game(),target,{workspace,kind}) === false)return false;
  suspendedGame=activeEntry?.game || T.game();
  dbInvalidate(false);
  if(T.isTcg())T.invalidateTcgSearch(T.game());
  if(S.ui.set?.busy) { S.ui.set.generation=(S.ui.set.generation||0)+1; S.ui.set.busy=false; }
  tcgCtx.invalidateNavigation?.();
  endHold(); heldTarget=null; browseCleanup?.(); browseCleanup=null;
  return true;
}
function clearGameContext() {
  closeSheet(false); sheetReturn=null; sheetTrail.clear(); routeTrail.length=0; pendingRoute=null;
  quickCard=null; comparison.cancel(); updateCompareTray(); S.ui.sheetBack=null;
  S.ui.deckId=null; S.ui.tdeckId=null; S.ui.tsetId=null;
  S.ui.shared={...S.ui.shared,code:"",deck:null,error:""};
}
function installNavigation(intent) {
    const old=activeEntry, changedGame=old && old.game!==intent.game;
    const origin=entryOrigins.get(old?.entryId), returningParent=!changedGame && origin?.game===intent.game && origin.route===intent.hash ? origin : null;
    if(changedGame)clearGameContext();
    else if(S.ui.sheetCtx?.type === "printing-picker")closeSheet(false);
    dismissRulesGuide();
    if(intent.mode === "push") {
      rememberScroll();
      if(old)replaceEntry({...old,scroll:window.scrollY});
      activeEntry=makeEntry(intent.game,intent.hash,(old?.index || 0)+1);
      history.pushState({...history.state,cardstashy:activeEntry},"",intent.hash);
      if(old)entryOrigins.set(activeEntry.entryId,old);
      if(entryOrigins.size>100)entryOrigins.delete(entryOrigins.keys().next().value);
    } else {
      activeEntry=intent.entry || makeEntry(intent.game,intent.hash,old?.index || 0);
      replaceEntry(activeEntry);
    }
    if(intent.wanted && intent.game!=="mtg")T.ui(intent.game).coll.show="wanted";
    if(suspendedGame){scanCtx.afterGameChange?.(intent.game);suspendedGame=null;}
    navDir=returningParent || intent.mode === "pop" && old && activeEntry.index<old.index ? "back" : "fwd";
    parseHash();
    navigationInstalling=true;
    try{render();}finally{navigationInstalling=false;navDir="";}
    if(intent.mode === "pop")restoreScroll(scrollMem.get(activeEntry.entryId) ?? activeEntry.scroll ?? 0);
    else if(returningParent)restoreScroll(scrollMem.get(returningParent.entryId) ?? returningParent.scroll ?? 0);
    else {scrollRestore++;window.scrollTo({top:0});}
}
const navigation = createNavigationQueue({
  readGame:T.game,
  persistGame:(game,current) => commit(s => {s.settings.game=game;}, {rerender:false,enrich:false,navigationWrite:true,guard:current}),
  pending:value => { navigationPending=value; const content=$("#content"); if(content){content.inert=value;content.setAttribute("aria-busy",String(value));} },
  install:installNavigation,
  failed:async (error,intent) => {
    // A superseded write may have completed. Reconcile to the still-visible game.
    if(activeEntry && T.game()!==activeEntry.game) {
      try{await commit(s=>{s.settings.game=activeEntry.game;},{rerender:false,enrich:false,navigationWrite:true});}
      catch{S.state.settings.game=activeEntry.game;}
    }
    if(suspendedGame){scanCtx.afterGameChange?.(suspendedGame);suspendedGame=null;}
    if(activeEntry) {
      restoreActiveHistory(intent);
    }
    navigationInstalling=true;try{render();}finally{navigationInstalling=false;}
    toast("Couldn’t switch games. Your current page and drafts are still here. "+(error.message || "Please try again."));
  },
});
// Undo/import/recovery/account adoption owns the workspace, including its game.
// Pause navigation while its existing serialized storage transaction settles.
// Older intents retire only on success; a failure lets the prior visit/intents resume.
workspaceTransition = {
  begin(next, {kind = "replace"} = {}) {
    if(!navigationReady)return null;
    if(gameChangeBlocked())throw Error("Close the current edit before replacing the workspace.");
    // Legacy/blank workspaces intentionally omit game; resolve like T.game()
    // without adding or rewriting a saved setting during adoption.
    const source=activeEntry?.game || T.game(), target=GAMES[next.settings?.game] ? next.settings.game : "mtg";
    if(!suspendGame(target,true,kind))throw Error("Finish saving your scans before replacing the workspace.");
    const ticket=navigation.pause(); workspaceVisitRevision++;
    const route=source===target ? {game:target,hash:activeEntry?.route || normalizeRoute(location.hash)} : gameSwitchRoute(gameContext(source),target);
    return {ticket,source,route};
  },
  finished(transition) {
    if(!transition)return;
    const {ticket,route}=transition;
    // A newer user tab/link/traversal owns the destination. It must apply against
    // the adopted workspace, not let an older game write revive prior settings.
    try {
      if(!navigation.hasNewer(ticket)) {
        clearGameContext(); entryOrigins.clear();
        installNavigation({...route,mode:"workspace",entry:makeEntry(route.game,route.hash,activeEntry?.index || 0)});
      }
    } finally {navigation.resume(ticket,true);}
  },
  failed(transition) {
    if(!transition)return;
    if(!navigation.hasWork && suspendedGame) {scanCtx.afterGameChange?.(suspendedGame);suspendedGame=null;}
    navigation.resume(transition.ticket);
    if(!navigation.busy)render();
  },
};
function gameContext(source=activeEntry?.game || T.game()) {
  return {game:source,hash:activeEntry?.route || location.hash,view:S.ui.view,collectionTab:source==='mtg'?S.ui.collTab:T.ui(source).coll.tab,collectionShow:source==='mtg'?'':T.ui(source).coll.show,decksTab:S.ui.decksTab,origin:S.ui.sheetCtx?.origin};
}
function restoreActiveHistory(intent) {
  const distance=intent.mode === "pop" ? activeEntry?.index-intent.entry?.index : 0;
  if(Number.isInteger(distance)&&distance) {
    if(rollbackHistoryId===intent.entry?.entryId)return;
    rollbackHistoryId=intent.entry?.entryId;history.go(distance);
  } else if(activeEntry)replaceEntry(activeEntry);
}
function navigate(intent) {
  if(!navigationReady)return Promise.resolve(false);
  const current=activeEntry || {game:T.game(),route:normalizeRoute(location.hash)};
  intent.hash=normalizeRoute(intent.hash);
  if(!navigation.busy && current.game===intent.game && current.route===intent.hash && !["pop","boot"].includes(intent.mode)) {render();return Promise.resolve(false);}
  if(intent.game!==current.game && (gameChangeBlocked() || !suspendGame(intent.game))) {
    if(intent.mode === "pop") {
      restoreActiveHistory(intent);
    }
    toast("Finish saving or close the current edit before switching games.");return Promise.resolve(false);
  }
  if(current.route!==intent.hash && !navigation.busy && !suspendedGame) {
    dbInvalidate(false); if(T.isTcg())T.invalidateTcgSearch(T.game());
    tcgCtx.invalidateNavigation?.();
    if(S.ui.set?.busy){S.ui.set.generation=(S.ui.set.generation||0)+1;S.ui.set.busy=false;}
  }
  return navigation.request(intent);
}
function switchGame(game) {
  if(!GAMES[game])return Promise.resolve(false);
  const source=activeEntry?.game || T.game();
  if(game===source && !navigation.busy)return Promise.resolve(false);
  const context=gameContext(source);
  const target=game===source ? {game,hash:activeEntry.route} : gameSwitchRoute(context,game);
  return navigate({...target,mode:game===source?'replace':'push'});
}
function applyHistory() {
  if(settingsPopup.historyChanged())return;
  if(!navigationReady)return;
  const hash=normalizeRoute(location.hash), known=historyEntry(history.state,hash);
  if(known?.entryId===activeEntry?.entryId)rollbackHistoryId=null;
  else if(known?.entryId===rollbackHistoryId)return;
  if(known && known.entryId===activeEntry?.entryId && known.route===activeEntry.route && !navigation.busy)return;
  rememberScroll();
  const entry=known || makeEntry(activeEntry?.game || T.game(),hash,(activeEntry?.index || 0)+1);
  // popstate and hashchange can describe the same traversal while its game write waits.
  if(navigationPending && pendingHistoryId===entry.entryId)return;
  pendingHistoryId=entry.entryId;
  void navigate({game:entry.game,hash,entry,mode:known?'pop':'legacy'}).finally(()=>{if(pendingHistoryId===entry.entryId)pendingHistoryId=null;});
}
let pendingHistoryId=null;
window.addEventListener("popstate",applyHistory);
window.addEventListener("hashchange",applyHistory);
// App links use the same history path, including same-hash game changes.
document.addEventListener("click",e=>{
  const a=e.target.closest?.('a[href^="#"]');
  if(!a || a.tagName!=="A" || e.defaultPrevented || e.button>0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)return;
  e.preventDefault();go(a.getAttribute('href'));
},true);
// Old page actions cannot mutate a newly committed game's workspace while a write waits.
for(const name of ['click','input','change'])document.addEventListener(name,e=>{
  if(navigationPending && !e.target.closest?.('#gameTabs,[data-act="setGame"],a[href^="#"],[data-nav]')){e.preventDefault();e.stopImmediatePropagation();}
},true);

/* =========================================================
   Event delegation
   ========================================================= */

const A = {}; // click actions
A.aiDeckReview = t => showAiReview(t.dataset.ai, render);
const C = {}; // change handlers
C.chooseLocation = t => chooseLocation(t);
const I = {}; // input handlers
function restoreSheetHistory() { const saved=sheetTrail.pop(); if(saved)restoreSheet(saved); else closeSheet(false); }
const printingPicker = createPrintingPicker({ A, C, I, openSheet, getContext:()=>S.ui.sheetCtx, getBody:()=>$("#sheetBody"), back:restoreSheetHistory });
registerWorkbench({A,C,commit,render,openSheet,closeSheet,refreshSheet,toast,
 getGame:T.game,
 getCard:(g,e,context)=>g === "mtg" ? (e.printingVerified && S.state.printings?.[e.printingId]) || (context?.print && key(context.print.name) === key(e.name) ? context.print : meta(e.name)) : contextTcgCard(g,e.cardId,context || null),
 links:(g,c)=>g === "mtg" ? Object.entries(c.purchase_uris||{}).map(([name,url])=>[name,url]) : T.SOURCES[g].buy(c),
 zoneFor:(g,c)=>T.SOURCES[g].zoneFor(c),ownKey:(g,c)=>T.SOURCES[g].ownKey(c)
});

// Yu-Gi-Oh! and Pokémon actions (tcg.js).
setTimeout(() => Object.assign(tcgCtx, { A, C, I, commit, render, openSheet, closeSheet, refreshSheet, toast, go, download, copyText, busy, rerenderKeepingFocus, writeRecord, invalidateMagicSearch: () => dbInvalidate(false), switchGame, navigationStamp, navigationCurrent, openPrintingPicker: printingPicker.open }) && (T.registerTcg(tcgCtx), registerCardMenus()), 0);

// Press and hold (data-hold="action"): runs that action instead of the tap's, with a haptic tick.
let holdTimer = null, heldTarget = null, holdAt = null;
const endHold = () => { clearTimeout(holdTimer); holdTimer = null; };
document.addEventListener("pointerdown", (e) => {
  const t = e.target.closest("[data-hold]");
  if (!t || t.disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
  endHold();
  holdAt = [e.clientX, e.clientY];
  holdTimer = setTimeout(() => { holdTimer = null; heldTarget = t; haptic("success"); safely(A[t.dataset.hold]?.(t)); }, 550);
});
// A drag of more than a few pixels is a scroll, not a hold.
document.addEventListener("pointermove", (e) => { if (holdTimer && Math.hypot(e.clientX - holdAt[0], e.clientY - holdAt[1]) > 10) endHold(); }, true);
for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, endHold, true);
document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-hold]")) e.preventDefault(); });
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (heldTarget && heldTarget === t) { heldTarget = null; e.preventDefault(); return; }
  heldTarget = null;
  if (!t || t.disabled) return;
  const fn = A[t.dataset.act];
  if (!fn) return;
  if (t.tagName === "A" && t.getAttribute("href")) return;
  e.preventDefault();
  lastActTarget = t;
  haptic(hapticFor(t.dataset.act, t));
  safely(fn(t, e));
});
const comparison = new CompareSelection();
let quickCard = null, compareBusy = false;
function updateCompareTray() {
  let tray = document.querySelector("#compareTray");
  if (!comparison.active) { tray?.remove(); document.body.classList.remove("choosing-compare"); return; }
  if (!tray) { tray = document.createElement("aside"); tray.id = "compareTray"; tray.className = "compare-tray"; tray.setAttribute("aria-label", "Choose cards to compare"); document.body.append(tray); }
  document.body.classList.add("choosing-compare");
  const first = comparison.cards[0];
  tray.innerHTML = `<div>${first ? artworkHTML(first,"compare-thumb") : actionIcon("compare")}<span><b>${first ? esc(first.name) : "Compare cards"}</b><small>${first ? "Tap another card to compare" : "Tap your first card"}</small></span></div><button class="icon" data-act="cancelCardCompare" aria-label="Cancel comparison">${actionIcon("close")}</button>`;
}
async function resolveActionCard(t) {
  const game = T.game(), dataset = {...t.dataset}, origin = S.ui.sheetCtx, route = location.hash, screen=navigationStamp();
  const matchingSheet = game === "mtg" ? origin?.type === "card" && key(origin.name) === key(dataset.name) : origin?.game === game && String(origin.id) === String(dataset.id);
  let card, setId=dataset.setId || (matchingSheet ? origin.setId : "") || "",setMembership=matchingSheet?origin.setMembership:null,setVariant=dataset.setVariant || dataset.setFinish || (matchingSheet ? origin.setVariant || origin.priceFinish : "") || "";
  if (game === "mtg") {
    const entry = S.state.collection.find(e => e.id === dataset.entry);
    card = entry?.printingVerified ? S.state.printings?.[entry.printingId] : null;
    if(dataset.setI !== undefined){
      const selected=S.ui.set.cards[Number(dataset.setI)];
      if(!selected || key(selected.name)!==key(dataset.name) || selected.set!==S.ui.set.code)return null;
      card=selected;setId=selected.set;
    }
    card ||= matchingSheet && origin.print ? origin.print : meta(dataset.name);
    card ||= await resolve(dataset.name, true);
  } else {
    if(!setMembership && setId && T.ui(game).set.info?.id===setId){
      const membership=T.ui(game).set.cards.find(c=>String(c.id)===String(dataset.id))?.setContext;
      if(membership?.membership==='set-response'&&membership.game===game&&String(membership.cardId)===String(dataset.id)&&membership.releaseId===setId)setMembership={...membership};
    }
    card = await T.ensureCard(game, dataset.id);
    if(setId)card=T.setContextCard(game,setMembership?{...card,setContext:setMembership}:card,setId,T.ui(game).sets.list,{variantKey:setVariant});
    if(card?.setContext?.membership==='set-response')setMembership={...card.setContext};
  }
  if (!navigationCurrent(screen) || T.game() !== game || location.hash !== route || S.ui.sheetCtx !== origin) return null;
  if(setId)dataset.setId=setId;
  if(setVariant)dataset.setVariant=setVariant;
  return {game,card,dataset,setId,setMembership,setVariant,priceEdition:matchingSheet?origin.priceEdition||origin.edition||"":"",priceYgoEdition:matchingSheet?origin.priceYgoEdition||origin.ygoEdition||"":""};
}
// Keep quick +/- and manual values on the exact set slot that opened the menu.
// Other screens retain their existing gameplay/name-equivalent ownership behavior.
function quickCardLots(ref,entries) {
  if(!ref.setId)return ownedCardLots(entries,ref.card);
  if(ref.game==='mtg')return entries.filter(e=>Number(e.qty)>0&&e.printingVerified&&e.printingId===ref.card.id&&(!ref.setVariant||(e.finish||'nonfoil')===ref.setVariant));
  const release={...ref.card.setContext,id:ref.setId};
  return entries.filter(e=>T.ownedInSet(ref.game,ref.card,release,[e],T.ui(ref.game).sets.list)>0&&(!ref.setVariant||ref.setVariant==='reference'||ref.game!=='ptcg'||e.variant===ref.setVariant)&&(!ref.priceEdition||ref.game!=='ygo'||e.printing+'::'+e.rarity===ref.priceEdition)&&(!ref.priceYgoEdition||ref.game!=='ygo'||e.edition===ref.priceYgoEdition));
}

function startCardCompare(game, first = null) {
  comparison.start(game,first); closeSheet(false); updateCompareTray();
  if (!["search","set","collection","deck","tdeck"].includes(S.ui.view)) go("#search");
  toast(first ? "Tap the second card. Scroll normally to find it." : "Tap two cards to compare. You can browse or search.");
}
async function pickCompareCard(t) {
  if (compareBusy) return; compareBusy = true;
  try {
    const ref = await resolveActionCard(t); if (!ref) return;
    const result = comparison.pick(ref.game,ref.card);
    if (result === "duplicate") return toast("Choose a different card for the second slot.");
    updateCompareTray();
    if (result === "ready") {
      if (ref.game === "mtg") { S.ui.compare = [...comparison.cards]; openSheet(V.compareSheet(),{type:"compare"}); }
      else { T.ui(ref.game).compare = [...comparison.cards]; openSheet(tcgCompareSheet(ref.game,comparison.cards),{type:"tcompare"}); }
    }
  } finally { compareBusy = false; }
}
async function cardQuickMenu(t) {
  t?.closest?.("dialog.zoom")?.querySelector('[data-z="close"]')?.click();
  const ref = t?.quickRef || await resolveActionCard(t); if (!ref) return;
  quickCard = ref; haptic("tap");
  const st = ref.game === "mtg" ? S.state : T.gs(ref.game);
  const lots=quickCardLots(ref,st.collection);ref.selectedLot=lots.some(e=>e.id===ref.selectedLot)?ref.selectedLot:lots.some(e=>e.id===ref.dataset.entry)?ref.dataset.entry:lots[0]?.id;
  if(ref.selectedLot)ref.dataset.entry=ref.selectedLot;
  const wished = st.wishlist.some(w => ref.game === "mtg" ? key(w.name) === key(ref.card.name) : w.cardId === ref.card.id);
  openSheet(`<div class="sheet-head"><h2>Card actions</h2><button class="icon" data-act="closeSheet" aria-label="Close">${actionIcon("close")}</button></div><div class="quick-card-heading">${artworkHTML(ref.card,"quick-card-thumb")}<div><b>${esc(ref.card.name)}</b><small>${esc(ref.card.set_name || ref.card.set?.name || ref.card.typeLine || "")}</small></div></div>${cardActionButtons({game:ref.game,wished,existing:lots.length>0,quantityHtml:quickQuantity(lots,ref.selectedLot,ref.qtyBusy),second:comparison.active && comparison.cards.length>0})}`,{type:"card-actions",game:ref.game,id:ref.card.id,setId:ref.setId||"",setMembership:ref.setMembership,setVariant:ref.setVariant,priceEdition:ref.priceEdition,priceYgoEdition:ref.priceYgoEdition});
}
// Hold a deck or binder tile for its quick actions, the same gesture as holding a card.
// Every action is also reachable inside the deck or binder; this is a shortcut, not a hiding place.
function tileMenu(tile) {
  haptic("tap");
  const to = tile.dataset.to || "", m = to.match(/^#(t?deck)\/(.+)$/);
  if (m) {
    const tcg = m[1] === "tdeck", id = decodeURIComponent(m[2]),
      d = tcg ? T.gs(T.game()).decks.find((x) => x.id === id) : S.state.decks.find((x) => x.id === id);
    if (!d) return;
    const tabs = tcg ? [["cards", "Cards"], ["insights", "Power"], ["matchups", "Matchups"], ["playtest", "Playtest"]] : [["cards", "Cards"], ["engine", "Power"], ["matchups", "Matchups"], ["playtest", "Playtest"]];
    openSheet(`<div class="sheet-head"><h2>${esc(d.name)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
      <div class="menu-list tile-menu">${tabs.map(([tab, label]) => `<button data-act="tileOpen" data-deck="${esc(id)}" data-tcg="${tcg ? 1 : ""}" data-tab="${tab}">${actionIcon({ cards: "cardStack", engine: "trophy", insights: "trophy", matchups: "sword", playtest: "random" }[tab] || "decks")}<span>${label}</span></button>`).join("")}
      <button data-act="tileOptions" data-deck="${esc(id)}" data-tcg="${tcg ? 1 : ""}">${actionIcon("more")}<span>Deck options<small>Rename, format, budget, versions, export, delete</small></span></button></div>`, { type: "tileMenu" });
    return;
  }
  if (tile.dataset.binder) {
    openSheet(`<div class="sheet-head"><h2>Binder</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
      <div class="menu-list tile-menu"><button data-act="openBinder" data-game="${esc(tile.dataset.game || "")}" data-binder="${esc(tile.dataset.binder)}">${actionIcon("binder")}<span>Open binder</span></button><button data-act="editBinder" data-binder="${esc(tile.dataset.binder)}">${actionIcon("brush")}<span>Edit cover and cards</span></button></div>`, { type: "tileMenu" });
  }
}
A.tileOpen = (t) => {
  closeSheet(false);
  if (t.dataset.tcg) { (S.ui.tdeckTab ||= {})[T.game()+":"+t.dataset.deck] = t.dataset.tab; go("#tdeck/" + t.dataset.deck); }
  else go(`#deck/${t.dataset.deck}/${t.dataset.tab}`);
};
A.tileOptions = (t) => {
  closeSheet(false);
  if (t.dataset.tcg) A.tDeckMenu({ dataset: { id: t.dataset.deck } });
  else { S.ui.deckId = t.dataset.deck; A.deckMenu(); }
};
function attachTileHolds(root = document) {
  let press = null, timer = null;
  const TILE = ".deck-tile, .stash-binder[data-binder]",
    clear = () => { clearTimeout(timer); press?.tile.classList.remove("holding"); };
  root.addEventListener("pointerdown", (e) => {
    const tile = e.target.closest?.(TILE);
    if (!tile || e.button !== 0) { press = null; return; }
    press = { x: e.clientX, y: e.clientY, tile, held: false };
    const mine = press;
    setTimeout(() => mine === press && !mine.moved && tile.classList.add("holding"), 140);
    timer = setTimeout(() => { if (mine !== press || mine.moved) return; mine.held = true; tile.classList.remove("holding"); tileMenu(tile); }, HOLD_MS);
  }, { passive: true });
  root.addEventListener("pointermove", (e) => { if (press && movedFrom(press, e)) { press.moved = true; clear(); } }, { passive: true });
  root.addEventListener("pointerup", clear, { passive: true });
  root.addEventListener("pointercancel", () => { if (press) press.moved = true; clear(); }, { passive: true });
  root.addEventListener("click", (e) => { if (press?.held && e.target.closest?.(TILE)) { e.preventDefault(); e.stopImmediatePropagation(); } press = null; }, true);
  root.addEventListener("contextmenu", (e) => { const tile = e.target.closest?.(TILE); if (!tile) return; e.preventDefault(); clear(); tileMenu(tile); });
}
function registerCardMenus() {
  attachTileHolds();
  A.cancelCardCompare = () => { comparison.cancel(); updateCompareTray(); };
  A.compareOpen = A.tCompareOpen = () => startCardCompare(T.game());
  A.compareReset = () => startCardCompare("mtg");
  A.compareFrom = async t => { const ref = await resolveActionCard(t); if(ref)startCardCompare(ref.game,ref.card); };
  A.tCompareFrom = A.compareFrom;
  A.tCompareClear = t => { const G=T.game(), other=T.ui(G).compare?.[1-Number(t.dataset.i)]; startCardCompare(G,other); };
  A.quickCompare = () => {
    if (!quickCard || quickCard.game !== T.game()) return;
    if (comparison.active && comparison.game === quickCard.game) { closeSheet(false); return safely(pickCompareCard({dataset:quickCard.dataset})); }
    startCardCompare(quickCard.game,quickCard.card);
  };
  C.quickLot=t=>{if(quickCard){quickCard.selectedLot=t.value;cardQuickMenu({quickRef:quickCard});}};
  A.quickQty=async t=>{
    const ref=quickCard;if(!ref||ref.qtyBusy||ref.game!==T.game()||![-1,1].includes(Number(t.dataset.delta)))return;
    const lots=quickCardLots(ref,(ref.game==='mtg'?S.state:T.gs(ref.game)).collection),lot=lots.find(e=>e.id===ref.selectedLot)||lots[0];if(!lot)return;
    ref.qtyBusy=true;await cardQuickMenu({quickRef:ref});
    try{await A[ref.game==='mtg'?'qty':'tEntryQty']({dataset:{id:lot.id,delta:t.dataset.delta}});}finally{ref.qtyBusy=false;if(quickCard===ref&&S.ui.sheetCtx?.type==='card-actions')await cardQuickMenu({quickRef:ref});}
  };
  A.quickValueSave=async()=>{
    const ref=quickCard;if(!ref||ref.qtyBusy||ref.game!==T.game())return;const input=document.querySelector('#quickLotValue'),raw=input?.value||'',value=raw===''?null:Number(raw);
    if(value!==null&&(!Number.isFinite(value)||value<0))return toast('Enter a non-negative value or leave it blank.');
    const selectedLot=ref.selectedLot;
    await commit(state=>{const st=ref.game==='mtg'?state:state.tcg[ref.game],e=quickCardLots(ref,st.collection).find(x=>x.id===selectedLot);if(e){e.manualValue=value;e.manualValueCondition=conditionName(e.condition);}}, {undo:'Updated this copy’s value.'});
    if(quickCard===ref)await cardQuickMenu({quickRef:ref});
  };
  A.quickOwn = () => {
    if (!quickCard || quickCard.game !== T.game()) return;
    const {game,card} = quickCard;
    if (game === "mtg") addSheet(null,{card,name:card.name,set:card.set,number:card.collector_number,finish:quickCard.setVariant||undefined});
    else A.tOwn({dataset:{id:card.id,setId:quickCard.setId||"",setVariant:quickCard.setVariant||"",print:(quickCard.priceEdition||"").replace("::","|"),edition:quickCard.priceYgoEdition||""},setMembership:quickCard.setMembership});
  };
  A.quickWish = async () => {
    if (!quickCard || quickCard.game !== T.game()) return;
    const {game,card} = quickCard;
    await A[game === "mtg" ? "wish" : "tWish"]({dataset:{name:card.name,id:card.id}}); closeSheet(false);
  };
  A.quickDeck = () => {
    if (!quickCard || quickCard.game !== T.game()) return;
    const decks=(quickCard.game === "mtg" ? S.state : T.gs(quickCard.game)).decks;
    openSheet(`<div class="sheet-head"><h2>Add to deck</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p class="muted small">${esc(quickCard.card.name)} · Choose a deck</p><div class="card-action-list">${decks.map(d=>`<button data-act="quickDeckSave" data-deck="${esc(d.id)}"><span>${esc(d.name)}<small>${esc(d.format || "")}</small></span>${ICON.back}</button>`).join("")}</div>${!decks.length?'<p>Create your first deck, then add cards from this menu.</p>':''}<button class="btn ghost" data-act="${quickCard.game === "mtg" ? "newDeck" : "tNewDeck"}">Create a deck</button>`,{type:"card-deck-picker"});
  };
  A.quickDeckSave = async t => {
    if (!quickCard || quickCard.game !== T.game()) return;
    const {game,card}=quickCard;
    await A[game === "mtg" ? "addToDeck" : "tDeckAdd"]({dataset:{name:card.name,id:card.id,deck:t.dataset.deck}}); closeSheet(false);
  };
  A.quickBinder = () => {
    if (!quickCard || quickCard.game !== T.game()) return;
    const binders=(S.state.settings.binders || []).filter(b=>b.game===quickCard.game && b.rule==="location");
    openSheet(`<div class="sheet-head"><h2>${quickCard.dataset.entry ? "Move to binder" : "Add to binder"}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p class="muted small">Choose a physical binder for ${esc(quickCard.card.name)}. Filtered binders include matching cards automatically.</p><div class="card-action-list">${binders.map(b=>`<button data-act="quickBinderSave" data-binder="${esc(b.id)}"><span class="binder-swatch" style="--binder-color:${/^#[a-f0-9]{6}$/i.test(b.color)?b.color:'#7d75bb'}"></span><span>${esc(b.title)}</span></button>`).join("")}</div><button class="btn ghost" data-act="quickBinderNew">Create a binder</button>`,{type:"card-binder-picker"});
  };
  A.quickBinderSave = async t => {
    if (!quickCard || quickCard.game !== T.game()) return;
    const {game,card,dataset}=quickCard,b=(S.state.settings.binders || []).find(b=>b.id===t.dataset.binder && b.game===game && b.rule==="location"); if(!b)return;
    if (dataset.entry) {
      await commit(s=>{const st=game==="mtg"?s:s.tcg[game],e=st.collection.find(e=>e.id===dataset.entry);if(!e)throw Error("This collection entry no longer exists.");e.location=rememberLocation(s,game,b.value);},{undo:"Moved card to binder",msg:`Moved to ${b.title}.`});closeSheet(false);return;
    }
    A.quickOwn(); const picker=document.querySelector(game==="mtg"?"#addLocationPicker":"#tLocPicker");
    if(picker){picker.value="location:"+b.value;chooseLocation(picker);}
  };
  A.quickBinderNew = () => { A.quickOwn(); const picker=document.querySelector(quickCard.game==="mtg"?"#addLocationPicker":"#tLocPicker");if(picker){picker.value="binder:new";chooseLocation(picker);} };
}
attachCardGestures({onSelect:target=>{
 const lot=target.closest?.('.lot'),input=lot?.querySelector?.('.batch-mark input');if(!input)return false;
 if(target.closest?.('label,input,select,.stepper,.lot-side'))return false;
 const button=target.closest?.('button');if(button&&!['card','tCard'].includes(button.dataset.act))return false;
 input.checked=!input.checked;C.batchToggle(input);return true;
},onHold:t=>safely(cardQuickMenu(t)),onPick:t=>safely(pickCompareCard(t)),choosing:()=>comparison.active});

document.addEventListener("pointerdown", ripple, { passive: true });
attachGestures({ closeSheet: () => A.closeSheet() });
// One shared shell measurement keeps sticky section tabs below the responsive
// game header through live viewport/fold changes without fixing workspace height.
function readSectionTabRail(content) {
  const rail=content?.querySelector?.(":scope > .tabs"),active=rail?.querySelector('[aria-selected="true"]');
  if(!rail||!active)return null;
  const box=rail.getBoundingClientRect(),tab=active.getBoundingClientRect();
  return {rail,active:active.dataset.id,left:rail.scrollLeft,width:box.width,visible:tab.left>=box.left-.5&&tab.right<=box.right+.5};
}
let sectionRailMemory=null;
function restoreSectionTabRail(content,previous=null) {
  const state=readSectionTabRail(content);if(!state){sectionRailMemory=null;return;}
  const rail=state.rail,active=rail.querySelector('[aria-selected="true"]');
  if(previous?.active===state.active){
    rail.scrollLeft=previous.left;
    // A visitor who deliberately scrolled away from the active item keeps that
    // position through same-section refreshes and viewport changes.
    if(!previous.visible){sectionRailMemory=readSectionTabRail(content);return;}
  }
  const box=rail.getBoundingClientRect(),tab=active.getBoundingClientRect();
  if(tab.left<box.left)rail.scrollLeft+=tab.left-box.left;
  else if(tab.right>box.right)rail.scrollLeft+=tab.right-box.right;
  sectionRailMemory=readSectionTabRail(content);
}
function observeShellHeader(header = document.querySelector(".topbar"), root = document.documentElement, view = window) {
  if (!header || !root) return () => {};
  let previous = -1, previousWidth = -1;
  const content=root.ownerDocument?.getElementById("content");
  const trackRail=event=>{if(event.target===content?.querySelector?.(":scope > .tabs"))sectionRailMemory=readSectionTabRail(content);};
  content?.addEventListener("scroll",trackRail,true);
  const measure = () => {
    const box=header.getBoundingClientRect(),height=Math.max(0,Math.ceil(box.height));
    if(Number.isFinite(box.width)&&box.width!==previousWidth){
      previousWidth=box.width;
      const rail=content?.querySelector?.(":scope > .tabs");
      restoreSectionTabRail(content,sectionRailMemory?.rail===rail?sectionRailMemory:null);
    }
    if (Number.isFinite(height) && height !== previous) {
      previous = height;
      root.style.setProperty("--shell-header-height", `${height}px`);
    }
  };
  measure();
  const observer = typeof view.ResizeObserver === "function" ? new view.ResizeObserver(measure) : null;
  if (observer) observer.observe(header);
  else view.addEventListener("resize", measure, { passive: true });
  return () => { observer?.disconnect(); content?.removeEventListener("scroll",trackRail,true); if (!observer) view.removeEventListener("resize", measure); };
}
attachGameTabs($("#gameTabs"));
attachHomeCommunity($("#content"));
attachHomeSwipe($("#content"), {
  enabled: () => !navigationPending && !comparison.active && !document.documentElement.classList.contains("sheet-open") && !gameChangeBlocked(),
  context: () => JSON.stringify([navigation.revision,workspaceVisitRevision,activeEntry?.entryId,location.hash]),
  current: () => S.state.settings.game || "mtg",
  switchGame: id => A.setGame({ dataset: { game: id } }),
});
attachTilt();
// Fold-out ⋯ menus close when you pick something or tap anywhere else.
document.addEventListener("click", (e) => {
  for (const m of document.querySelectorAll("details.tier-more[open]")) if (!m.contains(e.target) || e.target.closest(".tier-more-menu button")) m.open = false;
}, true);
// One rule for every card frame: a row or tile without its own tier takes it from its card
// picture, which always carries that exact printing's price (ui.js tierRing).
let tierQueued = false;
const tierSync = () => {
  tierQueued = false;
  for (const el of document.querySelectorAll(".lot:not([data-tier]), .grid-card:not([data-tier])")) {
    const i = el.querySelector("img[data-tier]");
    if (!i) continue;
    el.dataset.tier = i.dataset.tier;
    el.style.setProperty("--tier", i.style.getPropertyValue("--tier"));
  }
};
if (typeof MutationObserver !== "undefined") new MutationObserver(() => { if (!tierQueued) { tierQueued = true; requestAnimationFrame(tierSync); } }).observe(document.body, { childList: true, subtree: true });
attachRuleLearning();
attachSuggest();
attachGlassSelects();
const conditionScheduler=createConditionRefreshScheduler();
function conditionCardFor(entry,game){
 const card=game==='mtg'?(entry.printingVerified&&S.state.printings?.[entry.printingId])||meta(entry.name):T.cardOf(game,entry.cardId);
 return card&&!card.brief&&!(game==='mtg'&&entry.printingVerified&&card.id!==entry.printingId)?card:null;
}
function conditionSelectionAllowed(card,entry,game){
 if(!card?.id||card.brief||!conditionRequest(card,entry,game))return false;
 // The provider key cannot encode dated YGO releases. Preserve both the raw
 // code/rarity collision guard and the scoped release proof before scheduling.
 if(game==='ygo'){
  if(entry.setReleaseUnverified)return false;
  const raw=T.cardOf(game,card.id)||card;
  const matches=(raw?.sets||[]).filter(p=>p.code===entry.printing&&(!entry.rarity||p.rarity===entry.rarity));
  if(matches.length>1)return false;
  if(entry.setReleaseId){
   const scoped=T.setContextCard(game,raw,entry.setReleaseId,T.currentYgoCatalogue());
   if(scoped?.setContext?.status!=='resolved'||scoped.setContext.printings.filter(p=>p.code===entry.printing&&p.rarity===entry.rarity&&!p.releasePriceAmbiguous).length!==1)return false;
  }
 }
 return true;
}
function fetchConditionValue(card,entry,game,done,options={}){
 const selected={...entry},workspaceRevision=conditionWorkspaceRevision;
 if(navigator.onLine===false)return Promise.resolve({changed:false,status:'deferred',reason:'offline'});
 if(!conditionSelectionAllowed(card,selected,game))return Promise.resolve({changed:false,status:'deferred',reason:'unverified-selection'});
 const current=()=>workspaceRevision===conditionWorkspaceRevision&&conditionSelectionAllowed(card,selected,game)&&(!options.current||options.current());
 const identityMatches=q=>CONDITION_IDENTITY.every(k=>String(q[k]||'')===String(selected[k]||''));
 const cached=[...new Map([...(card.conditionQuotes||[]),...(selected.conditionQuotes||[])].filter(identityMatches).map(q=>[JSON.stringify(q),q])).values()];
 const value=conditionValue(null,selected,cached);
 if(value.kind==='manual')return Promise.resolve({changed:false,status:'manual'});
 const request=value.kind==='condition-quote'?Promise.resolve({changed:false,status:'available',rawQuotes:cached,reused:true}):
  conditionScheduler.request(conditionRequest(card,selected,game),()=>conditionSelectionAllowed(card,selected,game)?loadConditionQuotes({...card,conditionQuotes:[...(card.conditionQuotes||[])]},selected,game):{changed:false,status:'deferred',reason:'unverified-selection'},{...options,current});
 return request.then(async result=>{
  if(workspaceRevision!==conditionWorkspaceRevision)return {changed:false,status:'deferred',reason:'workspace-changed'};
  if(!conditionSelectionAllowed(card,selected,game))return {changed:false,status:'deferred',reason:'unverified-selection'};
  let changed=false;
  if(['available','unpriced','unmapped'].includes(result.status)){
   // A shared request returns unbound response rows. Bind each caller separately,
   // including another serialized capture or a saved lot created while it ran.
   const rawQuotes=result.rawQuotes||result.quotes||[];
   changed=applyConditionQuotes(card,selected,rawQuotes).changed||!!result.changed;
   await queueWorkspaceWrite(async()=>{
    if(workspaceRevision!==conditionWorkspaceRevision||!conditionSelectionAllowed(card,selected,game))return;
    const canonical=conditionCardFor(selected,game);
    if(canonical&&canonical.id===card.id)changed=applyConditionQuotes(canonical,selected,rawQuotes).changed||changed;
    const quotes=applyConditionQuotes({conditionQuotes:[]},selected,rawQuotes).quotes;
    const lots=game==='mtg'?S.state.collection:T.gs(game).collection;
    let saved=false;
    for(const lot of lots)if((game==='mtg'?key(lot.name)===key(card.name):lot.cardId===card.id)&&
     !lot.setReleaseUnverified&&(!selected.setReleaseId||lot.setReleaseId===selected.setReleaseId)&&identityMatches(lot)&&
     conditionSelectionAllowed(card,lot,game)&&JSON.stringify(lot.conditionQuotes||[])!==JSON.stringify(quotes)){
      lot.conditionQuotes=quotes;saved=true;
    }
    if(changed){if(game==='mtg'){S.catalogDirty=true;saveCatalogSoon();}else T.persistQuoteCache();}
    if(saved){changed=true;await save();}
   });
  }
  const output={...result,changed};if(changed)refreshHomeValueGlance();if(current())done?.(output);return output;
 });
}
function refreshChangedConditions(changed){
 for(const {game,entry} of changed){
  const identity=conditionLotIdentity(entry),current=()=>{
   const lots=game==='mtg'?S.state.collection:T.gs(game).collection;
   return lots.some(lot=>lot.id===entry.id&&conditionLotIdentity(lot)===identity);
  };
  if(!current())continue;
  const card=conditionCardFor(entry,game);
  if(card)void fetchConditionValue(card,entry,game,result=>{if(result.changed&&S.ui.view==='collection'&&T.game()===game)render();},{source:'saved',current});
 }
}
let magicPriceRefresh=null;
const magicPriceAttempts=new Map();
async function refreshMagicCollectionPrices(force=false){
 if(magicPriceRefresh)return magicPriceRefresh;
 if(!navigator.onLine)return;
 const now=Date.now(),cards=new Map();
 for(const e of S.state.collection){
  const c=(e.printingVerified&&S.state.printings?.[e.printingId])||meta(e.name);
  if(!c?.id)continue;
  const time=Date.parse(c.checkedAt);
  if(force||((!Number.isFinite(time)||now-time>=86400000)&&now-(magicPriceAttempts.get(c.id)||0)>=3600000))cards.set(c.id,c);
 }
 const ids=[...cards.keys()].slice(0,force?5000:150);
 if(!ids.length)return;
 ids.forEach(id=>magicPriceAttempts.set(id,now));
 magicPriceRefresh=(async()=>{
  let changed=false;
  for(let i=0;i<ids.length;i+=75){
   try{
    const data=await api('/cards/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifiers:ids.slice(i,i+75).map(id=>({id}))})});
    for(const c of data.data||[]){
     const old=cards.get(c.id);if(!old)continue;
     const fresh=slim({...c,conditionQuotes:old.conditionQuotes,checkedAt:new Date().toISOString()});
     if(S.state.printings?.[c.id])S.state.printings[c.id]=fresh;
     if(meta(c.name)?.id===c.id)cacheCard(fresh);
     changed=true;
    }
   }catch{}
  }
  if(changed){saveCatalogSoon();trackValue();await save();if(S.ui.view==='collection')render();}
 })();
 try{await magicPriceRefresh;}finally{magicPriceRefresh=null;}
}
function refreshCollectionConditions(){
 if(S.ui.view!=='collection'||!conditionScheduler.canScheduleCollection()||navigator.onLine===false)return;
 const game=T.game(),lots=game==='mtg'?S.state.collection:T.gs(game).collection,visibleIds=new Set();
 for(const node of document.querySelectorAll('#content [data-entry]')){
  const rect=node.getBoundingClientRect();if(rect.height>0&&rect.bottom>0&&rect.top<innerHeight)visibleIds.add(node.dataset.entry);
 }
 let cursor='';try{cursor=localStorage.getItem(conditionCursorKey(game))||'';}catch{}
 const eligible=entry=>{
  const card=conditionCardFor(entry,game);if(!conditionSelectionAllowed(card,entry,game))return false;
  if(['manual','condition-quote'].includes(conditionValue(null,entry,[...(card.conditionQuotes||[]),...(entry.conditionQuotes||[])]).kind))return false;
  return !conditionScheduler.has(conditionRequest(card,entry,game));
 };
 const selected=selectConditionLots(lots,{cursor,visibleIds,eligible});
 try{if(selected.cursor)localStorage.setItem(conditionCursorKey(game),selected.cursor);}catch{}
 for(const entry of selected.entries){
  const card=conditionCardFor(entry,game),identity=conditionLotIdentity(entry);
  void fetchConditionValue(card,entry,game,result=>{if(result.changed&&S.ui.view==='collection'&&T.game()===game)render();},{source:'collection',current:()=>S.ui.view==='collection'&&T.game()===game&&
   (game==='mtg'?S.state.collection:T.gs(game).collection).some(lot=>lot.id===entry.id&&conditionLotIdentity(lot)===identity)});
 }
}
// Collection filtering updates only its list, without a full app render.
for(const event of ['input','change'])document.addEventListener(event,e=>{
 if(S.ui.view==='collection'&&e.target.closest?.('#content'))setTimeout(refreshCollectionConditions,0);
});
function refreshConditionPrice(){
 const node=$("#conditionPricePreview"),ctx=S.ui.sheetCtx;if(!node||!ctx)return;
 const raw=$("#lotManualValue")?.value??'',manualValue=raw===''?null:Number(raw);
 let entry,price,sourceCard,sourceGame;
 if(ctx.type==='tadd'){
  const game=ctx.game;if(!['ptcg','ygo'].includes(game)||game!==T.game())return;const card=contextTcgCard(game,ctx.id,ctx),pr=$("#tPrint")?.value||'',[printing,rarity]=game==='ygo'?pr.split('|'):['',''];
  entry={cardId:card?.id,...(ctx.setId?{setReleaseId:ctx.setId}:{}),condition:$("#tCond")?.value,variant:game==='ptcg'?pr:'',printing:printing||'',rarity:rarity||'',edition:$("#tEdition")?.value||'',manualValue,manualValueCondition:conditionName($("#tCond")?.value)};
  const exact = !ctx.setId || (card?.setContext?.status === 'resolved' && (game !== 'ygo' || card.setContext.printings.filter(p=>p.code===printing&&p.rarity===rarity&&!p.releasePriceAmbiguous).length === 1 && (T.cardOf(game,ctx.id)?.sets||[]).filter(p=>p.code===printing&&p.rarity===rarity).length === 1));
  price=exact?T.entryPrice(card,entry):conditionValue(null,entry,[]).price;
  if(exact){sourceCard=card;sourceGame=game;}
 }else if(ctx.type==='add'){
  const card=(ctx.entry?.printingVerified&&S.state.printings?.[ctx.entry.printingId])||ctx.lookup;entry={...ctx.entry,condition:$("#addCondition")?.value,finish:$("#addFinish")?.value,language:$("#addLanguage")?.value,manualValue,manualValueCondition:conditionName($("#addCondition")?.value)};
  price=conditionValue(cardPrice(card,entry.finish),entry,card?.conditionQuotes||[]).price;
  const set=$('#addSet')?.value?.trim().toLowerCase(),number=$('#addNumber')?.value?.trim();
  if((set&&set!==String(card?.set||'').toLowerCase())||(number&&number!==String(card?.collector_number||'')))price=null;
  else {sourceCard=card;sourceGame='mtg';}
 }else return;
 node.innerHTML=conditionPriceHtml(price,entry,[...(sourceCard?.conditionQuotes||[]),...(entry.conditionQuotes||[])]);
 const selectionKey=JSON.stringify([...CONDITION_IDENTITY.map(k=>entry[k]||''),entry.condition||'']);node.conditionSelectionKey=selectionKey;
 const current=()=>node.isConnected&&S.ui.sheetCtx===ctx&&node.conditionSelectionKey===selectionKey;
 if(sourceCard){
  if(price==null)node.innerHTML=conditionPriceHtml(price,entry,[],{status:'loading'});
  Promise.resolve(fetchConditionValue(sourceCard,entry,sourceGame,null,{source:'search',current})).then(result=>{
   if(!current()||!result)return;
   const quotes=[...(sourceCard.conditionQuotes||[]),...(entry.conditionQuotes||[])],fresh=conditionValue(price,entry,quotes).price;
   node.innerHTML=conditionPriceHtml(fresh,entry,quotes,result);
  });
 }
}
document.addEventListener("change",e=>{if(e.target.matches?.("#addCondition,#addFinish,#addLanguage,#tCond,#tPrint,#tEdition")){for(const n of document.querySelectorAll("#lotManualValue,#quickLotValue"))n.value="";refreshConditionPrice();}});
document.addEventListener("input",e=>{if(e.target.matches?.('#addSet,#addNumber')){if($('#lotManualValue'))$('#lotManualValue').value='';refreshConditionPrice();}else if(e.target.id==='lotManualValue')refreshConditionPrice();});
document.addEventListener("submit",e=>{
 const form=e.target.closest?.('[data-auth-action]');if(!form)return;
 e.preventDefault();const action=A[form.dataset.authAction];if(action)safely(action(form.querySelector('button[type="submit"]')));
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
  if (e.target.id === "sheet") A.closeSheet();
});
$("#sheet").addEventListener("cancel", (e) => {
  if (S.ui.sheetCtx?.type === "printing-picker") { e.preventDefault(); printingPicker.cancel(); }
});
$("#sheet").addEventListener("close", () => {
  // close() queues its event. A selection can already have opened the next sheet
  // by the time it arrives; that older event must not clear the new session.
  if ($("#sheet").open) return;
  T.cancelProvenBuild();
  printingPicker.abandon();
  sheetTrail.clear();
  binderDragCleanup?.(); binderDragCleanup=null;
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
A.closeSheet = () => S.ui.sheetCtx?.type === "printing-picker" ? printingPicker.cancel() : closeSheet(false);
A.sheetHistoryBack = () => S.ui.sheetCtx?.type === "printing-picker" ? printingPicker.cancel() : restoreSheetHistory();
A.routeHistoryBack=()=>{const saved=routeTrail.pop();if(!saved || saved.game!==T.game())return;closeSheet(false);go(saved.route);setTimeout(()=>{if(location.hash!==saved.route)return;restoreSheet(saved);window.scrollTo(0,saved.pageScroll);},0);};
document.addEventListener?.("error",handleArtworkError,true);
if(typeof MutationObserver !== "undefined"){
 new MutationObserver(()=>wireSheetBack()).observe($("#sheetBody"),{childList:true,subtree:true});
 new MutationObserver(()=>wireRouteBack()).observe($("#content"),{childList:true});
}
function binderRows(game, location = null) {
  const collection = game === "mtg" ? S.state.collection : T.gs(game).collection;
  return collection.filter(entry=>location === null || String(entry.location || "").trim()===location).map(entry=>{
    const c = game === "mtg" ? (entry.printingVerified && S.state.printings?.[entry.printingId]) || meta(entry.name) : T.cardOf(game,entry.cardId);
    const variant = c?.variants?.find(v=>v.key===entry.variant);
    return {entry,card:c,game,image:game === "mtg" ? cardImage(c) : variant?.image || c?.image || "",version:variant?.label || entry.variantLabel || [entry.set || c?.set?.id,entry.finish,entry.edition].filter(Boolean).join(" · ")};
  });
}
const binderById = id => (S.state.settings.binders || []).find(b=>b.id===id);
function showBinder(data,direction="next",keepScroll=false) {
  const b=binderById(data.binder), rows=b?binderRows(b.game).filter(r=>binderMatches(r,b)):binderRows(data.game,data.location);
  data.page=Math.max(0,Math.min(Math.max(0,Math.ceil(rows.length/9)-1),data.page));
  openSheet(binderPage(rows,b?.title || data.location || "Unsorted cards",data.page,direction,b),data,keepScroll?$("#sheetBody").scrollTop:0);
}
A.openBinder = t => {
  const game=t.dataset.game, b=binderById(t.dataset.binder);
  if (!["mtg","ptcg","ygo"].includes(game) || game !== T.game() || !b || b.game!==game) return;
  showBinder({type:"binder",game,location:t.dataset.location || "",binder:b?.id || "",page:0});
};
A.binderPage = t => {
  const data=S.ui.sheetCtx; if(data?.type!=="binder")return;
  const page=Number(t.dataset.page)||0, old=$("#sheetBody .stash-pocket-page");
  // Finish a turn still in flight before starting the next one.
  $("#sheetBody").querySelectorAll(".stash-leaf").forEach(x=>x.remove());
  const leaf=old?.cloneNode(true);
  showBinder({...data,page},page<data.page?"previous":"next",true);
  if(S.ui.sheetCtx?.page!==data.page) animateTurn($("#sheetBody"),leaf,page<data.page?-1:1,t.how||{});
};
function binderEditor(b=null) {
  const game=b?.game || T.game(), value=b?.value || "", returnPage=S.ui.sheetCtx?.type === "binder"?S.ui.sheetCtx.page:0;
  openSheet(`<div class="sheet-head"><h2>${b?"Binder settings":"New binder"}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><label class="field">Binder name<input id="binderTitle" maxlength="60" value="${esc(b?.title || "")}" placeholder="Fire Pokémon, rare finds, land library…"></label><label class="field">Cards to include<select id="binderRule" data-change="binderRule">${options([["all","All my cards"],["set","A specific set"],["rare","Rare cards and above"],["rarity","An exact rarity"],["type","Card type"],["color","Color / energy / attribute"],["location","Cards placed in this binder"]],b?.rule || "location")}</select></label><label class="field" id="binderValueLabel"><span id="binderValueCaption">Filter value</span><input id="binderValue" maxlength="100" value="${esc(value)}" placeholder="e.g. base1, Rare, Fire, Land, W, LIGHT"></label><p id="binderFilterHint" class="foot">Set: use its code (Pokémon base1, Magic FDN, Yu-Gi-Oh! LOB). Type examples: Land, Creature, Trainer, Spell. Color examples: Fire, Water, W, U, B, R, G, DARK.</p><details class="binder-appearance"><summary>Cover appearance</summary><label class="field">Cover color<input id="binderColor" type="color" value="${esc(b?.color || BINDER_COLORS[(S.state.settings.binders || []).length % BINDER_COLORS.length])}"></label><label class="field">Background image URL (optional)<input id="binderBackground" type="url" value="${esc(b?.background?.startsWith("https:")?b.background:"")}" placeholder="https://…"></label><input id="binderBgData" type="hidden" value="${esc(b?.background?.startsWith("data:")?b.background:"")}"><label class="btn ghost file">Upload cover image<input type="file" accept="image/jpeg,image/png,image/webp" data-change="binderImage" hidden></label><span id="binderImageStatus" class="muted small">${b?.background?.startsWith("data:")?"Uploaded cover saved":""}</span><button class="link small" data-act="clearBinderImage">Clear image</button><p class="foot">Use an HTTPS image link or upload a photo. Star an owned card inside the binder to place it in the cover’s clear pocket.</p></details><button class="btn block" data-act="saveBinder" data-binder="${esc(b?.id || "")}" data-game="${esc(game)}">Save binder</button>${b?`<button class="link danger" data-act="removeBinder" data-binder="${esc(b.id)}">Delete binder</button><p class="foot">Your cards stay in the collection.</p>`:""}`,{type:"binder-editor",id:b?.id || "",returnPage});
  C.binderRule($("#binderRule"));
}
A.newBinder = ()=>binderEditor();
A.editBinder = t => {const b=binderById(t.dataset.binder);if(b)binderEditor(b);};
C.binderRule = t => {
 $("#binderValueLabel").hidden=["all","rare"].includes(t.value);
 const hints={location:["Location name (optional)","Leave blank to use the binder name. Assign cards here using Where it lives."],set:["Set code","Use the exact set code: Pokémon base1, Magic FDN, or Yu-Gi-Oh! LOB."],type:["Card type","Examples: Land, Creature, Trainer or Spell."],color:["Color / energy / attribute","Examples: Fire, Water, W, U, B, R, G or DARK."],rarity:["Rarity","Use the exact rarity name shown on your cards."]};
 if($("#binderValueCaption"))$("#binderValueCaption").textContent=(hints[t.value]||["Filter value"])[0];
 if($("#binderFilterHint")){ $("#binderFilterHint").hidden=!hints[t.value];$("#binderFilterHint").textContent=hints[t.value]?.[1]||""; }
};
C.binderImage = async t => {
  const file=t.files?.[0];if(!file)return;if(file.size>10*1024*1024)throw Error("Choose an image under 10 MB.");
  const bitmap=await createImageBitmap(file);try{const canvas=document.createElement("canvas"),ratio=Math.min(1,800/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);const image=canvas.toDataURL("image/jpeg",.7);if(image.length>350000)throw Error("That cover is too large. Try a simpler or smaller image.");if(!$("#binderBgData"))return;$("#binderBgData").value=image;$("#binderBackground").value="";$("#binderImageStatus").textContent="Cover image ready · saved when you save the binder";}finally{bitmap.close();}
};
A.clearBinderImage = ()=>{if($("#binderBgData"))$("#binderBgData").value="";if($("#binderBackground"))$("#binderBackground").value="";if($("#binderImageStatus"))$("#binderImageStatus").textContent="";};
A.saveBinder = async t => {
  const title=$("#binderTitle").value.trim(),rule=$("#binderRule").value,game=t.dataset.game,value=rule==='set'?(game==='ygo'?$("#binderValue").value.trim().toUpperCase():$("#binderValue").value.trim().toLowerCase()):$("#binderValue").value.trim() || (rule === "location"?title:""),color=$("#binderColor").value,background=$("#binderBgData")?.value || $("#binderBackground").value.trim();
  if(!title)throw Error("Give your binder a name.");
  if(!["all","rare"].includes(rule)&&!value)throw Error("Enter the set, rarity, type, color or location to match.");
  if(!/^#[0-9a-f]{6}$/i.test(color))throw Error("Choose a valid cover color.");
  if(background && !background.startsWith("data:")){let url;try{url=new URL(background);}catch{throw Error("Use a valid HTTPS image URL.");}if(url.protocol!=="https:")throw Error("Background images must use HTTPS.");}
  if(background.startsWith("data:") && (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(background) || background.length>350000)) throw Error("Choose a smaller JPEG, PNG or WebP cover image.");
  const old=binderById(t.dataset.binder), b={id:old?.id || uid(),game,title,rule,value,color,background,featured:old?.featured || "",favorites:binderFavorites(old)};
  const returnPage=S.ui.sheetCtx?.returnPage || 0;
  await commit(st=>{st.settings.binders ||= [];if(b.rule === "location")rememberLocation(st,game,b.value);const at=st.settings.binders.findIndex(x=>x.id===b.id);if(at<0)st.settings.binders.push(b);else st.settings.binders[at]=b;},{rerender:false});
  closeSheet(); if(game==="mtg")S.ui.collTab="binders";else T.ui(game).coll.tab="binders";go("#collection/binders");render();if(old)setTimeout(()=>{if(T.game()===game)showBinder({type:"binder",game,binder:b.id,page:returnPage});},0);toast("Binder saved. Owned quantities are unchanged.");
};
A.removeBinder = async t => {
 const b=binderById(t.dataset.binder);if(!b || b.game!==T.game())return;
 await commit(st=>{st.settings.binders=(st.settings.binders || []).filter(x=>x.id!==b.id);},{rerender:false,enrich:false,undo:`Deleted binder “${b.title}”. Your cards stay in the collection.`});
 closeSheet();render();
};
A.featureBinderCard = async t => {
  const data=S.ui.sheetCtx,b=binderById(data?.binder);if(!b)return;
  const rows=binderRows(b.game).filter(r=>binderMatches(r,b)),id=t.dataset.entry;if(!rows.some(r=>r.entry.id===id))return;
  const fav=binderFavorites(b),on=fav.includes(id);
  if(!on&&fav.length>=MAX_FAVORITES)return toast(`A cover shows up to ${MAX_FAVORITES} cards. Unstar one first.`);
  await commit(st=>{const target=st.settings.binders.find(x=>x.id===b.id);target.favorites=on?fav.filter(x=>x!==id):[...fav,id];target.featured=target.favorites[0]||"";},{rerender:false});
  render();showBinder({...data},"next",true);
  toast(on?"Removed from the cover.":`On the cover · ${fav.length+1}/${MAX_FAVORITES}`);
};
A.collTab = (t) => go("#collection/" + t.dataset.id);
A.decksTab = (t) => go("#decks/" + t.dataset.id);
A.deckTab = (t) => {
  closeSheet();
  go("#deck/" + currentDeck().id + "/" + t.dataset.id);
};
/* ---------- Matchups (Magic) ---------- */
const muState = (d) => ((S.ui.mu ||= {})[d.id] ||= { first: true });
A.muRun = async () => {
  const d = currentDeck(), mk = d && mtgMetaKey(d);
  if (!d || !mk) return;
  const st = muState(d);
  if (st.busy) return;
  const msg = (m) => { st.msg = m; const el = $(".build-overlay [role=status]"); if (el) el.textContent = m; };
  Object.assign(st, { busy: true, error: "", msg: "Loading tournament results…" });
  render();
  try {
    const data = await loadMetaData(mk);
    const archs = (data?.archetypes || []).filter((a) => a.share > 0).slice(0, 8),
      lists = archs.map((a) => ({ a, list: data.decks.find((x) => x.key === a.best) || data.decks.find((x) => (x.archetype || x.name) === a.name) })).filter((x) => x.list?.main?.length);
    if (!lists.length) throw Error("No tournament decks to compare with right now.");
    await resolveNames([...new Set(lists.flatMap((x) => x.list.main.map((r) => r.name)))], (m) => msg("Loading the field's cards · " + m));
    const field = [];
    for (const [i, { a, list }] of lists.entries()) {
      msg(`Simulating against ${a.name} · ${i + 1} of ${lists.length}`);
      await new Promise((r) => setTimeout(r, 16));
      // Commander lists: 100 cards with their commanders, paced by bracket and speed cards.
      const edh = mk === "mtg:EDH", cards = edh ? [...list.main, ...(list.commanders || []).map((r) => (typeof r === "string" ? { name: r, qty: 1 } : r))] : list.main,
        rows = cards.map((r) => ({ qty: r.qty, c: meta(r.name) })).filter((r) => r.c),
        base = profileOf("mtg", mtgConstructedPower({ cards }, S.catalog, key, edh ? 100 : 60), rows),
        prof = edh ? podProfile(base, podSpeed({ cards }, S.catalog)) : base;
      const cover = meta(a.cover || "");
      if (prof) field.push({ key: list.key, format: mk.slice(4), name: a.name, share: a.share, art: cover?.image_uris?.art_crop || cover?.card_faces?.[0]?.image_uris?.art_crop || (a.cover ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(a.cover)}&format=image&version=art_crop` : ""), profile: prof });
    }
    if (mk === "mtg:EDH") { calibratePods(field); for (const f of field) f.bias = 0; }
    else calibrateField(field, (a, b, o) => simulateMatchup("mtg", a, b, o));
    st.field = field;
    st.fieldKey = V.mtgFieldKey(d);
    fieldStore.set(st.fieldKey, field);
    haptic("success");
  } catch (e) {
    st.error = e.message || "Couldn't load the field.";
  } finally {
    st.busy = false;
    render();
    setTimeout(() => countUp($("#content")), 60);
  }
};
// Their list, in the same deck window as Meta decks (the field may be cached from an earlier visit).
A.muSee = async (t) => {
  const mk = "mtg:" + t.dataset.format;
  if (!metaState(mk).data) await loadMetaData(mk).catch(() => null);
  if (!metaState(mk).data?.decks?.some((x) => x.key === t.dataset.key)) return toast("That tournament list is no longer in the current results. Simulate again to refresh the field.");
  A.mtgProven(t);
};
A.muFirst = (t) => { const d = currentDeck(); muState(d).first = t.dataset.v !== "second"; render(); };
// Log a game: one tap, kept on the deck (and synced with your account).
async function logGame(t, save) {
  const opp = t.dataset.opp || $("#" + t.dataset.act.replace(/Log$/, "") + "OtherName")?.value.trim();
  if (!opp) { toast("Type their deck first."); return null; }
  return { at: new Date().toISOString(), opp, res: t.dataset.res, first: save.first !== false, sig: V.mtgListSig(currentDeck()) };
}
A.muLog = async (t) => {
  const d = currentDeck(), st = muState(d), g = await logGame(t, st);
  if (!g) return;
  st.openName = t.dataset.opp || null;
  if (g.res === "W") { haptic("success"); celebrate(t); }
  await commit((s) => { const x = s.decks.find((y) => y.id === d.id); (x.results ||= []).push(g); }, { msg: `${g.res === "W" ? "Win" : g.res === "L" ? "Loss" : "Draw"} vs ${g.opp} logged.` });
};
A.muUndo = async (t) => {
  const d = currentDeck();
  await commit((s) => { const x = s.decks.find((y) => y.id === d.id); x.results = (x.results || []).filter((g) => g.at !== t.dataset.at); }, { msg: "Game removed." });
};
let settingsBaseState=null;
const settingsPopup=createSettingsDialog({beforeOpen:()=>{settingsBaseState=S.state;},dialog:$("#settingsDialog"),markup:()=>`<header class="settings-dialog-head"><div><p class="eyebrow">ALL THREE GAMES</p><h2 id="settingsDialogTitle">Settings</h2></div><button class="icon" data-act="closeSettings" aria-label="Close settings">${ICON.close||'✕'}</button></header>${V.settings({popup:true})}`,afterPaint:()=>{if(S.ui.settingsTab==='backup')storageDetail();},afterClose:scroll=>{if(settingsBaseState!==S.state)render();window.scrollTo({top:scroll,behavior:'instant'});setTimeout(safeIntro,50);}});
A.menu = () => settingsPopup.open();
A.closeSettings = () => settingsPopup.close();

/* =========================================================
   Card sheet, compare, printings
   ========================================================= */

A.card = async (t) => {
  const screen=navigationStamp();
  S.ui.sheetBack = S.ui.sheetCtx?.type === "idea" && $("#sheet").open ? { type: "idea", i: S.ui.sheetCtx.i } : null;
  const name = t.dataset.name,
    ctx = { type: "card", name, entryId:t.dataset.entry||"", deckId: t.dataset.deck || (S.ui.view === "deck" ? currentDeck()?.id : null), random: !!t.dataset.random };
  const print = t.printing || (t.dataset.setI !== undefined ? S.ui.set.cards[Number(t.dataset.setI)] : null);
  if (print?.id && key(print.name) === key(name) && (t.printing ? typeof print.set === "string" : print.set === S.ui.set.code)) {
    ctx.print = print;
    ctx.setId = print.set;
    ctx.priceFinish = selectedFinish("mtg",print,t.dataset.setFinish);
  }
  if(t.dataset.setI !== undefined && !ctx.print)return toast("This set changed. Open the card again.");
  let c = ctx.print || meta(name);
  if (!c) {
    openSheet(`<div class="sheet-head"><h2>${esc(name)}</h2><button class="icon" data-act="closeSheet">✕</button></div><p class="muted">Loading card data…</p>`, ctx);
    try {
      c = await resolve(name, true);
      if(!navigationCurrent(screen) || S.ui.sheetCtx !== ctx || T.game() !== "mtg" || !$("#sheet").open)return;
    } catch (e) {
      if(!navigationCurrent(screen) || S.ui.sheetCtx !== ctx || T.game() !== "mtg" || !$("#sheet").open)return;
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
  if (ctx.detailsBusy) return;
  let c = ctx.print || meta(ctx.name);
  const screen=navigationStamp(), still = () => navigationCurrent(screen) && S.ui.sheetCtx === ctx && $("#sheet").open;
  ctx.detailsBusy = true;
  const oldDetailsError = ctx.detailsError;
  ctx.detailsError = "";
  if (!ctx.prints || ctx.printsError === oldDetailsError) ctx.printsError = "";
  try {
    if (c?.id && !c.full) {
      const full = await api("/cards/" + encodeURIComponent(c.id));
      if (!still()) {
        ctx.detailsError = ctx.printsError = "Extra details paused. Retry to finish loading this card.";
        return;
      }
      if (full.id !== c.id) throw Error("The card database returned a different printing. Retry this card’s details.");
      if(ctx.print){
        // Exact-printing enrichment stays in this sheet. It cannot replace the
        // name-wide default used by decks and the rest of the collection.
        if(full.id !== c.id)return;
        c = slim({ ...full, full: true, checkedAt: new Date().toISOString() });
        if(ctx.print.id === c.id)ctx.print = c;
      }else{
        c = cacheCard({ ...full, full: true }, [ctx.name]);
        saveCatalogSoon();
      }
      if (still()) refreshSheet();
    }
    if (!c?.oracle_id) return;
    if (!still()) return;
    // Hydrating a selected printing must not replace an already paged version list.
    if (!Array.isArray(ctx.prints)) await loadMagicVersions(ctx);

  } catch (e) {
    ctx.detailsError = ctx.printsError = e.message;
  } finally {
    ctx.detailsBusy = false;
    if (still()) refreshSheet();
  }
}
// Versions load one honest page at a time; a retry retains already verified printings.
async function loadMagicVersions(ctx, next = false) {
  if (ctx?.type !== "card" || ctx.printsBusy || (next && !ctx.printsNext)) return;
  const card = ctx.print || meta(ctx.name), cursor = next ? ctx.printsNext : null;
  const screen=navigationStamp(), still = () => navigationCurrent(screen) && S.ui.sheetCtx === ctx && $("#sheet").open && T.game() === "mtg";
  if (!still()) return;
  const token = Symbol("magic-versions");
  ctx.printsRequest = token; ctx.printsBusy = true; ctx.printsError = "";
  refreshSheet();
  try {
    const page = await loadMagicPrintingPage(card, { cursor, request: api });
    if (!still() || ctx.printsRequest !== token) return;
    const pages = [...(next ? ctx.printsPages || [] : []), ...(cursor ? [cursor] : [])];
    const repeated = page.nextCursor && pages.includes(page.nextCursor);
    ctx.prints = mergeMagicCards(next ? ctx.prints || [] : [], page.cards, { printings: true });
    ctx.printsNext = repeated ? null : page.nextCursor;
    ctx.printsComplete = !repeated && page.complete;
    ctx.printsTotal = page.total;
    ctx.printsPages = pages;
    ctx.pricesAt = new Date().toISOString();
    if (repeated) ctx.printsError = "The card database repeated a printing page. Showing the verified printings loaded so far.";
    ensureTcgPrices(page.cards);
  } catch (e) {
    if (still() && ctx.printsRequest === token) ctx.printsError = e.message;
  } finally {
    if (ctx.printsRequest === token) {
      ctx.printsBusy = false;
      if (!still() && !ctx.prints) ctx.printsError = "Printing lookup paused. Retry to load this card’s printings.";
      if (still()) refreshSheet();
    }
  }
}
A.viewPrint = (t) => {
  const ctx = S.ui.sheetCtx;
  if (!ctx?.prints) return;
  const print = ctx.prints[Number(t.dataset.i)];
  if (!print) return;
  ctx.print = print;
  ctx.setId = print.set || "";
  ctx.priceFinish = selectedFinish("mtg",print,ctx.priceFinish);
  ctx.entryId = ""; delete ctx.entry;
  ctx.setVariant = ctx.priceFinish;
  ctx.face = 0;
  refreshSheet();
  $("#sheetBody").scrollTo({ top: 0, behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
};
A.magicVersionsMore = () => {
  const ctx = S.ui.sheetCtx;
  if (ctx?.type !== "card" || ctx.detailsBusy) return;
  const card = ctx.print || meta(ctx.name);
  if (ctx.printsNext) return loadMagicVersions(ctx, true);
  return !card?.full ? loadCardExtras(ctx) : loadMagicVersions(ctx);
};
A.magicPrintings = () => {
  const ctx = S.ui.sheetCtx, card = ctx?.print || meta(ctx?.name);
  if (ctx?.type !== "card" || T.game() !== "mtg" || !card?.oracle_id) return toast("This card's verified Magic identity is not loaded yet. Try again in a moment.");
  return printingPicker.open({ game: "mtg", card, parentContext: ctx,
    loadPage: ({cursor, signal}) => loadMagicPrintingPage(card, { cursor, signal, request: api }),
    onSelect: (selection, parent) => {
      if (S.ui.sheetCtx !== parent || T.game() !== "mtg" || selection.card.oracle_id !== card.oracle_id) return;
      parent.print = selection.card;
      parent.setId = selection.releaseId;
      parent.priceFinish = selection.finish;
      // Viewing another printing/finish is not editing the lot that opened it.
      // Do not let artwork long-press or quantity actions inherit that old lot.
      parent.entryId = ""; delete parent.entry;
      parent.setVariant = selection.finish;
      parent.face = 0;
      refreshSheet();
    }
  });
};
A.flipFace = () => {
  const ctx = S.ui.sheetCtx;
  ctx.face = ctx.face ? 0 : 1;
  refreshSheet();
};
A.setCommander = async (t) => {
  const name = t?.dataset?.name || $("#cmdName")?.value.trim();
  if (!name) return toast("Tap a card or type a name.");
  const c = await resolve(name, true),
    fm = formatOf(currentDeck());
  if (!canLead(c, fm)) return toast(`${c.name} can’t lead a ${fm.name} deck.`);
  await editDeck((d) => ({ ...d, commander: c.name, name: d.name === "Imported deck" ? c.name.split(",")[0] + " deck" : d.name, cards: d.cards.some((x) => key(x.name) === key(c.name)) ? d.cards : [{ name: c.name, qty: 1 }, ...d.cards] }), { msg: c.name + " is now your commander." });
};

// Search pre-filtered to cards legal in this deck's format.
A.formatSearch = () => {
  const f = formatOf(currentDeck());
  S.ui.db.filters = { color: "", type: "", format: f.legality || "", maxPrice: "" };
  dbInvalidate();
  go("#search");
};

/* ---------- deck generator (every format) ---------- */
const poolCache = new Set();
// Fetch the cards a generator can choose from: format-legal, in the deck's colors.
async function loadFormatPool(f, colors, seed, progress) {
  const ci = colors.filter((c) => c !== "C").join("").toLowerCase() || "c",
    fq = f.legality ? "f:" + f.legality : "game:paper",
    theme = seed ? themeQuery(seed) : "",
    key = f.id + "|" + ci + "|" + theme;
  const basics = (colors.length ? colors : ["C"]).map(c=>({W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest",C:"Wastes"})[c]).filter(Boolean);
  for (const name of basics) await resolve(name).catch(()=>{});
  if (poolCache.has(key)) return;
  const queries = [
    ...(theme ? [["cards for its theme", `${fq} id<=${ci} -t:land ${theme}`]] : []),
    ["the format’s staples", `${fq} id<=${ci} -t:land`],
    ["budget picks", `${fq} id<=${ci} -t:land usd<=0.5`],
    ["efficient interaction", `${fq} id<=${ci} -t:land cmc<=3 (o:destroy or o:exile or o:counter)`],
    ["card flow", `${fq} id<=${ci} -t:land cmc<=3 (o:draw or o:search)`],
    ...(ci.length > 1 ? [["lands", `${fq} id<=${ci} t:land -t:basic`]] : []),
  ];
  for (const [label, q] of queries) {
    progress(`Finding ${label}…`);
    try {
      // One printing per card, the cheapest (any printing plays the same in a deck).
      const r = await api("/cards/search?" + new URLSearchParams({ q: q + " prefer:usd-low", unique: "cards", order: "edhrec" }));
      for (const c of r.data || []) cacheCard(c);
    } catch {}
  }
  for (const b of colors.map((c) => ({ W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" })[c]).filter(Boolean)) await resolve(b).catch(() => {});
  saveCatalogSoon();
  poolCache.add(key);
}
const tierList = () => [...new Set([...BUDGET_TIERS, ...(S.ui.build.custom !== "" && Number.isFinite(Number(S.ui.build.custom)) ? [Math.max(0, Number(S.ui.build.custom))] : [])])].sort((a, b) => a - b);
const buildMsg = (m) => {
  S.ui.build.msg = m;
  const el = $("#sheetBody [role=status]");
  if (el) el.textContent = m;
};
async function runBuild() {
  const B = S.ui.build,
    f = formatOf(B.format),
    seed = meta(B.seed);
  if (!seed || B.busy) return;
  B.busy = true;
  B.error = false;
  B.openTier = null;
  refreshSheet();
  try {
    const colors = seed.color_identity?.length ? seed.color_identity : ["C"];
    await loadFormatPool(f, colors, seed, buildMsg);
    buildMsg("Building versions…");
    B.avail = V.availability();
    let candidates=buildTiers({format:f.name,seeds:[seed],catalog:S.catalog,available:B.avail,price:c=>priceOf(c.name)},tierList());
    const baseline=B.baseDeck?deckById(B.baseDeck):null;if(baseline && formatOf(baseline).name===f.name)candidates.push({...baseline,total:sumQty(baseline.cards),size:f.size,warnings:[]});
    const mk=mtgMetaKey({format:f.name}),data=mk?await loadMetaData(mk).catch(()=>metaState(mk).data):null;
    const matching=(data?.decks || []).filter(d=>[...(d.commanders||[]),...(d.main||[])].some(r=>key(r.name)===key(seed.name))).slice(0,4);
    for(const d of matching){
      const commanders=(d.commanders||[]).map(r=>typeof r==='string'?{name:r,qty:1}:r);
      if(f.commander && !commanders.some(r=>key(r.name)===key(seed.name)))continue;
      const cards=aggregateCards([...commanders,...(d.main||[])]);await resolveNames(cards.map(r=>r.name));
      candidates.push({proven:d.key,source:sourceCredit({kind:'Tournament list',url:d.url,description:d.event}),label:d.event || d.name,format:f.name,commander:commanders[0]?.name || '',cards,total:sumQty(cards),size:f.size,warnings:[]});
    }
    const cost=d=>purchaseCost(d.cards,{key:r=>key(r.name),owned:r=>/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(r.name)?r.qty:B.avail(r.name),price:r=>priceOf(r.name)});
    const evaluate=d=>mtgPower({...d,id:'builder:mtg'}),targets=[...candidates.filter(d=>d.proven),...candidates.slice(-1)],protectedKeys=new Set([seed.name]);
    candidates=await refineCandidates(candidates,{evaluate,cost,status:buildMsg,rounds:2,maxNeighbors:12,
      accept:d=>!evaluate(d).readiness?.provisional,
      neighbors:d=>targets.flatMap(target=>towardDeck(d,target,{protectedKeys,zoneOf:r=>/\bLand\b/.test(meta(r.name)?.type_line || '')?'land':'spell'}))});
    let tiers=bestBudgetDecks(candidates,tierList(),{evaluate,cost});
    // Spend toward each budget: stronger cards for the same plan until the list is within $10 of
    // the budget, as long as Power holds. The best version found (no limit) is the reference.
    // The field's own cards are the first place to look for stronger options in these colors.
    if(data?.decks?.length){
      const freq=new Map();for(const d of data.decks)for(const r of [...(d.main||[]),...(d.side||[])])if(!/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(r.name))freq.set(r.name,(freq.get(r.name)||0)+1);
      const names=[...freq].sort((a,b)=>b[1]-a[1]).slice(0,120).map(([n])=>n).filter(n=>!meta(n));
      if(names.length){buildMsg(`Loading ${names.length} tournament cards to compare…`);await resolveNames(names).catch(()=>{});}
    }
    const pool=upgradePool(f.name,S.catalog,colors),isLandName=n=>/\bLand\b/.test(meta(n)?.type_line || ''),
      fit=fitFor([seed],f.size),quality=c=>cardQuality(playRate('mtg',c),priceOf(c.name),fit(c))+(f.commander && c.edhrec_rank?Math.max(0,4-Math.log10(c.edhrec_rank)):0),
      mrows=d=>d.cards.map(r=>({key:key(r.name),zone:isLandName(r.name)?'land':'spell',qty:r.qty,card:meta(r.name) || {name:r.name}})),
      mswap=(d,w,c,n)=>{const cards=structuredClone(d.cards),out=cards.find(r=>key(r.name)===w.key);if(!out || out.qty<n)throw Error('swap');out.qty-=n;const hit=cards.find(r=>key(r.name)===key(c.name));if(hit)hit.qty+=n;else cards.push({name:c.name,qty:n,why:'Upgrade for this budget'});return {...d,cards:cards.filter(r=>r.qty>0),proven:null,label:d.label};};
    const budgets=tierList();
    for(const [i,t] of tiers.entries()){
      if(!t || !budgets[i])continue;
      buildMsg(`Spending toward ${budgets[i]===Infinity?'the best version':'$'+budgets[i]}…`);
      const protect=r=>r.zone==='land' || r.key===key(seed.name) || (!!t.commander && r.key===key(t.commander)) || playRate('mtg',r.card)>=25;
      const up=await spendUp(t,budgets[i],{pool,quality,rows:mrows,swap:mswap,cost,evaluate,protect,maxCopies:c=>copyLimit(c,f.name),tolerance:0,status:buildMsg});
      if(up.swaps.length)tiers[i]={...t,...up.deck,cost:up.cost,assessment:up.power,power:up.power.score,upgrades:up.swaps};
    }
    tiers=variantsFrom(budgetNotes(tiers.map(t=>t&&asShown(t)),budgets),budgets,d=>difficultyOf(d.cards.map(r=>{const c=meta(r.name);return {qty:r.qty,text:!c || /\bLand\b/.test(c.type_line || '')?null:c.oracle_text || (c.card_faces || []).map(x=>x.oracle_text || '').join(' ')};})));
    B.results[f.name]=tiers.filter(Boolean).map((winner,i)=>{const d=winner;return {...d,owned:d.cards.reduce((n,r)=>n+Math.min(r.qty,/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(r.name)?r.qty:B.avail(r.name)),0)};});
    B.msg = `${B.results[f.name].length} budget versions · compared ${candidates.length} decks using Power, legality and purchase cost.`;
  } catch (e) {
    B.msg = e.message;
    B.error = true;
  } finally {
    B.busy = false;
    refreshSheet();
  }
  // After the versions are on screen: check the cheapest legal printing of the priciest cards they
  // use (it can only lower what they cost), then refresh the prices shown.
  const names = [...new Set((B.results[f.name] || []).flatMap((t) => t.cards.map((r) => r.name)))].filter((n) => !/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(n)).sort((a, b) => (priceOf(b) ?? 0) - (priceOf(a) ?? 0));
  if (names.length) refreshCheapest(names, { api, key, limit: 40 }).then((n) => n && S.ui.sheetCtx?.type === "build" && refreshSheet()).catch(() => {});
}
// Tutorials run in a separate modal with disposable example data. Existing
// card forms and the camera screen stay mounted underneath it.
const tourArt = () => ({game:T.game(),scenes:tourScenes(T.game()),cssUrl:new URL('./style.css',import.meta.url).href});
let introPending=false;
const safeIntro=()=>{if(!introPending||S.ui.view!=='home'||document.querySelector('dialog[open]'))return;introPending=false;openTour(tourArt());};
A.replayTour = (t) => openTour({...tourArt(),lesson:t?.dataset?.lesson||'',choose:!t?.dataset?.lesson,onTry:key=>{
 if(S.ui.view==='scan'||$('#sheet')?.open){toast('Your current task is still open. Close it when you’re ready to try the example.');return;}
 settingsPopup.close();
 if(key==='tabletop')A.tabletop();else go(({find:'#home',save:'#collection',scan:'#scan',build:'#decks/inspiration'})[key]||'#home');
}});
A.tabletop=()=>openTabletop({game:T.game(),confirm:ask,judge:game=>A.askRules({dataset:{game}})});
A.dismissGuide=t=>{markGuide(t.dataset.id);t.closest('[data-guide]')?.remove();};
A.resetOnboarding=async()=>{if(!await ask('Reset guide history? Only tutorials will reset. Your cards, decks, account and preferences stay saved.'))return;resetOnboarding();introPending=true;toast('Guides reset. The introduction will return on Home when you finish your current task.');};
A.helpOpen=t=>{const id=t?.dataset?.id||'start';if(!INFO_TOPICS.some(x=>x.id===id))return;S.ui.settingsTab='info';settingsPopup.open();A.settingsTab({dataset:{id:'info'}});const topic=document.getElementById('info-'+id);if(topic){topic.hidden=false;topic.open=true;topic.querySelector('summary')?.focus();topic.scrollIntoView({block:'nearest'});}};
A.infoGo=t=>{const topic=INFO_TOPICS.find(x=>x.id===t.dataset.id);if(!topic)return;if(topic.id==='tabletop')return A.tabletop();if(topic.route==='#settings')return A.settingsTab({dataset:{id:'account'}});settingsPopup.close();go(topic.route);};
document.addEventListener('input',e=>{if(e.target.id!=='infoQuery')return;const matches=new Set(findInfo(e.target.value).map(t=>t.id)),root=e.target.closest('.info-centre');root.querySelectorAll('[data-info-topic]').forEach(n=>n.hidden=!matches.has(n.dataset.infoTopic));root.querySelector('#infoCount').textContent=matches.size+' topics';root.querySelector('.info-empty').hidden=matches.size>0;});
// Ask AI: the in-app assistant. Its tools are the app's own functions, run here on the device.
let askTools = null;
A.askRules = (button) => {
  const scope = button?.closest?.('[data-learning-root]');
  const game = button?.dataset?.game || scope?.dataset?.game || T.game();
  const origin = currentRulesOrigin();
  const format = button?.dataset?.ruleFormat ?? scope?.dataset?.ruleFormat ?? (origin.game === game ? origin.deckFormat : "");
  let cards = [], references = [];
  const context = button?.closest?.('[data-rule-card-context]')?.dataset?.ruleCardContext;
  if (context) { const card = JSON.parse(context); if (card.game === game) cards = [card]; }
  if (button?.dataset?.rulesReferences) references = JSON.parse(button.dataset.rulesReferences);
  const trigger = button?.closest?.(".rule-glass") ? dismissRuleHint() || button : button;
  openRulesAsk({ game, format, cards, references, trigger });
  rulesGuideOrigin = origin;
};
A.askOpen = (options={}) => {
  askTools ||= makeAskTools({ S, T, A, go, navigationStamp, navigationCurrent, esc, api, resolve, cacheCard, loadSetIndex, loadMetaData, metaState, MTG_META_FORMATS, allMeta: () => Object.fromEntries(Object.entries(allCachedMeta()).map(([k, v]) => [k, v.data])), priceOf, inv, meta, collectionValue, lotPrice, mtgPower, shownPower, tcgCtx,
    openMtgBuild: (seed, fmt, budget) => { Object.assign(S.ui.build, { baseDeck: null, seed, results: {}, msg: "", openTier: null, format: formatOf(fmt).name, custom: budget ? String(budget) : "" }); openSheet(V.buildSheet(), { type: "build" }); runBuild(); },
    openTcgBuild: async (g, id, budget, format) => { await A.tBuild({ dataset: { id, format } }); if (budget) C.tBuildCustom({ value: String(budget) }); } });
  openAsk({ game: T.game(), prefill:typeof options.query==='string'?options.query:'', tools: askTools, show: (s) => safely(askTools.open(s)) });
};
A.buildFrom = async (t) => {
  const c = meta(t.dataset.name) || (await resolve(t.dataset.name, true)),
    B = S.ui.build,
    options = formatsFor(c, FORMATS),
    ctxDeck = deckById(S.ui.sheetCtx?.deckId),
    deckFmt = ctxDeck ? formatOf(ctxDeck).name : "";
  Object.assign(B, { baseDeck:null,seed: c.name, results: {}, msg: "", openTier: null, format: (options.find((f) => f.name === deckFmt) || options[0])?.name || "" });
  openSheet(V.buildSheet(), { type: "build" });
  if (B.format) runBuild();
};
A.optimizeMtgDeck = async () => {
 const d=currentDeck();if(!d)return;await resolveNames(d.cards.map(r=>r.name));
 const seed=d.commander || [...d.cards].filter(r=>!isLand(meta(r.name))).sort((a,b)=>b.qty-a.qty)[0]?.name;if(!seed)return;
 Object.assign(S.ui.build,{seed,baseDeck:d.id,results:{},format:formatOf(d).name,openTier:null,msg:''});openSheet(V.buildSheet(),{type:'build'});runBuild();
};
A.tierAlternative = t => {
 const B=S.ui.build,n=B.results[B.format]?.[Number(t.dataset.i)]?.nextUpgrade;if(!n)return;
 B.results[B.format].push({...n,owned:n.cards.reduce((sum,r)=>sum+Math.min(r.qty,/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(r.name)?r.qty:B.avail(r.name)),0),nextUpgrade:null,explanation:'Outside the original budget. Review the actual purchase total before saving.',warnings:[...(n.warnings || [])]});
 B.openTier=B.results[B.format].length-1;refreshSheet();
};
A.buildFormat = (t) => {
  const B = S.ui.build;
  B.format = t.dataset.format;
  B.openTier = null;
  if (B.results[B.format]) refreshSheet();
  else runBuild();
};
C.buildCustom = (t) => {
  const B = S.ui.build;if(B.busy)return;
  B.custom = t.value === "" ? "" : String(Math.max(0, Math.min(100000, Number(t.value) || 0)));
  B.results = {};
  runBuild();
};
// A random build-around card that's legal (and can lead, if needed) in the chosen format.
A.learnGame = (t) => openSheet(learnSheet(t?.dataset?.game || T.game()), {type:"learn-game"});
let homeRevealPending = null, homePickBusy = null;
A.homeRandomDeck = () => A.randomDeckOptions({ dataset: { home: "1" } });
A.homeBuildReveal = () => {
 const pending = homeRevealPending;
 if (!pending || !isHomeRevealCurrent(pending.origin, { game:T.game(), view:S.ui.view, sheet:S.ui.sheetCtx, open:$("#sheet").open })) return;
 // The Magic builder owns one mutable state object until its current run settles.
 // Keep this revealed card retryable instead of relabelling an in-flight deck.
 if (pending.origin.game === "mtg" && S.ui.build.busy) return toast("Your current Magic build is still running. Try this card again when it finishes.");
 homeRevealPending = null;
 return pending.start();
};
A.randomDeckOptions = (t) => {
 homeRevealPending = null;
 const g=T.game(),formats=g === "mtg" ? FORMATS.filter(f=>f.id !== "limited") : T.formatsOf(g);
 openSheet(`<div class="sheet-head"><h2>Discover a deck</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p class="muted">Choose a format. Leave the theme blank for a surprise.</p><label>Format<select id="randomFormat" required>${options([["","Choose a format"],...formats.map(f=>[f.id,f.name])],"")}</select></label><label>Optional theme or card type<input id="randomTheme" maxlength="80" placeholder="${g === "mtg" ? "Dragons, artifacts, graveyard…" : g === "ygo" ? "An archetype or monster type…" : "Fire, Water, Psychic…"}"></label><button class="btn block" data-act="randomDeckStart">Find my deck</button>`,{type:"random-deck-options",game:g,homeReveal:t?.dataset?.home === "1"});
};
A.randomDeckStart = async (t) => {
 const g=T.game(),id=$("#randomFormat")?.value,theme=$("#randomTheme")?.value.trim() || "";
 const f=(g === "mtg" ? FORMATS : T.formatsOf(g)).find(f=>f.id===id);
 if(!f)return toast("Choose a format first.");
 const picker = S.ui.sheetCtx, origin = { game:g, view:S.ui.view, sheet:picker };
 if (homePickBusy?.picker === picker) return;
 const pickRequest = { picker };
 const homePickCurrent = () => isHomeRevealCurrent(origin, { game:T.game(), view:S.ui.view, sheet:S.ui.sheetCtx, open:$("#sheet").open });
 const onPick = picker?.homeReveal ? (card, format, start) => {
   if (!homePickCurrent()) return;
   const context = { type:"home-deck-reveal", game:g, name:card.name, id:card.id };
   homeRevealPending = { origin:{ ...origin, sheet:context }, start };
   openSheet(homeDeckReveal({ name:card.name, format, imageHtml:artworkHTML(card, "home-reveal-card", true) }), context);
 } : null;
 const done = busy(t, "Finding your build-around…"); homePickBusy = pickRequest;
 try {
   if(g === "mtg") return await A.buildRandom({dataset:{format:f.id,theme},onPick});
   return await A.tRandomDeck({dataset:{format:f.id,theme},onPick,homePickCurrent:onPick ? homePickCurrent : null});
 } finally { if (homePickBusy === pickRequest) homePickBusy = null; done(); }
};
A.buildRandom = async (t) => {
  const B = S.ui.build,
    f = formatOf(t.dataset.format || B.format || "Standard"),
    lead = f.commander === "planeswalker" ? " t:planeswalker" : f.commander ? " is:commander" : "",
    theme = String(t.dataset.theme || "").replace(/[^\p{L}\p{N} '-]/gu, "").slice(0,80),
    q = `${f.legality ? "f:" + f.legality : "game:paper"} -t:land -t:basic${lead}${theme ? ` (t:"${theme}" or o:"${theme}")` : ""}`;
  if (B.busy && !t.onPick) return toast("Your current Magic build is still running. Try again when it finishes.");
  if (!t.onPick && (!$("#sheet").open || S.ui.sheetCtx?.type !== "build")) {
    Object.assign(B, { seed: "", results: {}, msg: "Picking a random card…", format: f.name });
    openSheet(V.buildSheet(), { type: "build" });
  }
  const c = cacheCard(await api("/cards/random?" + new URLSearchParams({ q })));
  const start = () => {
    if (B.busy) return toast("Your current Magic build is still running. Try again when it finishes.");
    Object.assign(B, { baseDeck:null,seed:c.name,results:{},format:f.name,openTier:null });
    if (t.onPick) openSheet(V.buildSheet(), { type:"build" });
    return runBuild();
  };
  if (t.onPick) return t.onPick(c, f.name, start);
  return start();
};
A.tierToggle = (t) => {
  const B = S.ui.build,
    i = Number(t.dataset.i);
  B.openTier = B.openTier === i ? null : i;
  if (S.ui.sheetCtx?.type === "build") refreshSheet();
  else render();
};
function generatedDeck(t, seedName) {
  return withSnapshot({ id: uid(), name: `${seedName.split(",")[0]} · ${t.format} · ${t.budget===Infinity?"unlimited":t.budget ? "$" + t.budget : "my cards"}`, format: t.format, commander: t.commander, strategy: "Auto", budget: t.budget===Infinity?null:t.budget, locked: false, cards: t.cards.map((r) => ({ name: r.name, qty: r.qty })), versions: [], source: t.source || sourceCredit({ kind: "Generated", description: `Generated by CardStashy around ${seedName} with ${t.budget===Infinity?"an unlimited":`a $${t.budget}`} budget.` }) }, "Generated");
}
A.tierSave = async (t) => {
  const B = S.ui.build,
    tier = B.results[B.format]?.[Number(t.dataset.i)];
  if (!tier) return;
  await resolveNames(tier.cards.map(r=>r.name));
  const d = generatedDeck(tier, B.seed);
  await commit((s) => s.decks.push(d), { msg: `Saved “${d.name}”. Find it in My decks.` });
};
// Magic shopping lines name the printing the deck is priced at (the cheapest legal one when known).
async function buyMtg(items) {
  const rows = aggregateCards(items).filter((r) => r.qty > 0).map((r) => {
    const low = cheapestKnown(key(r.name)), c = meta(r.name);
    const priced = low?.usd != null && low.set;
    return { qty: r.qty, name: r.name.split(" // ")[0], set: priced ? low.setName : c?.set_name, code: priced ? low.set : c?.set, num: priced ? low.cn : c?.collector_number };
  });
  return buyOnTcgplayer("mtg", await massLines("mtg", rows));
}
A.tierSaveGo = async (t) => {
  const B = S.ui.build, tier = B.results[B.format]?.[Number(t.dataset.i)];
  if (!tier) return;
  await resolveNames(tier.cards.map(r=>r.name));
  const d = generatedDeck(tier, B.seed);
  await commit((s) => s.decks.push(d), { msg: `Saved “${d.name}”.` });
  closeSheet();
  go(`#deck/${d.id}/${t.dataset.to}`);
};
A.tierCopy = (t) => {
  const B = S.ui.build, tier = B.results[B.format]?.[Number(t.dataset.i)];
  if (tier) copyText(exportDeckText({ cards: tier.cards, side: tier.side || [] }), "Deck list copied.");
};
// The cards this version needs that you don't own (basic lands aside), for TCGplayer's Mass Entry.
A.tierBuy = async (t) => {
  const B = S.ui.build, tier = B.results[B.format]?.[Number(t.dataset.i)];
  if (!tier) return;
  const rows = tier.cards.filter((r) => !/^(?:Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(r.name)).map((r) => ({ qty: r.qty - Math.min(r.qty, B.avail?.(r.name) ?? 0), name: r.name })).filter((r) => r.qty > 0);
  if (!(await buyMtg(rows))) toast("You own every card in this version.");
};
A.tierSaveAll = async () => {
  const B = S.ui.build,
    tiers = B.results[B.format] || [];
  const ds = tiers.map((t) => generatedDeck(t, B.seed));
  await commit((s) => s.decks.push(...ds), { msg: `Saved ${ds.length} decks to My decks.` });
};
// Non-Commander decks: complete the current list at several budgets.
A.suggestFormatUpgrades = async () => {
 const d=currentDeck(),B=S.ui.build,f=formatOf(d);if(B.busy)return;
 B.busy=true;B.fillDeck=d.id;B.msg="Finding same-role, lower-cost spells…";render();
 try{await resolveNames(d.cards.map(r=>r.name));const seeds=d.cards.map(r=>meta(r.name)).filter(c=>c&&!isLand(c));const colors=[...new Set(seeds.flatMap(c=>c.color_identity||[]))];
 await loadFormatPool(f,colors.length?colors:["C"],seeds[0],m=>{B.msg=m;render();});
 B.formatSwaps=formatUpgrades(d,S.catalog,{budget:Number.isFinite(Number(d.budget))?Number(d.budget):25,available:V.availability(),price:c=>priceOf(c.name),evaluate:next=>mtgPower(next)});B.swapSignature=JSON.stringify(d.cards);
 B.msg=B.formatSwaps.length?"Review each trade-off. Applying one swap preserves your card count and saves the previous version.":"No conservative same-role swaps found. Try a wider card pool; a lower mana value alone does not prove an upgrade.";
 }catch(e){B.msg=e.message;}finally{B.busy=false;render();}
};
A.applyFormatUpgrade = async t => {
 const B=S.ui.build,d=currentDeck(),swap=B.formatSwaps?.[Number(t.dataset.i)];if(!swap||B.fillDeck!==d.id||B.swapSignature!==JSON.stringify(d.cards))throw Error("Your deck changed. Refresh suggestions first.");
 const cards=applyFormatSwap(d,swap,S.catalog);await editDeck(d=>withSnapshot({...withSnapshot(d,"Before suggested swap"),cards},"Reviewed spell swap"),{msg:"One card in, one card out. Previous list saved in Versions."});B.formatSwaps=null;render();
};
A.reviewTrim = async () => {
  const d=currentDeck(); await resolveNames(d.cards.map(r=>r.name));
  const review=cutToTarget(d,S.catalog);
  openSheet(`<div class="sheet-head"><h2>Review consistency cuts</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p class="muted">${review.total} → ${review.target} cards. Constructed Magic can allow more than 60. These are curve-based suggestions, not a tournament verdict.</p><div class="list">${review.cuts.map(r=>`<div class="mini-row">${img(art(meta(r.name)),r.name,"mini-art")}<span>${r.qty}× ${esc(r.name)}<small class="muted">${esc(r.reason)}</small></span></div>`).join("")}</div><button class="btn block" data-act="applyTrim" data-deck="${esc(d.id)}">Apply reviewed cuts</button>`,{type:"trim",deck:d.id,signature:JSON.stringify(d.cards),review});
};
A.applyTrim = async t => {
  const ctx=S.ui.sheetCtx, d=currentDeck();
  if(ctx?.type!=="trim" || ctx.deck!==d.id || ctx.signature!==JSON.stringify(d.cards))throw Error("The deck changed. Review the cuts again.");
  await editDeck(d=>withSnapshot({...withSnapshot(d,"Before consistency cuts"),cards:ctx.review.cards},"Consistency cuts"),{msg:"Cuts applied. Your previous list is saved in Versions."});closeSheet();
};
A.fillAny = async () => {
  const d = currentDeck(),
    B = S.ui.build,
    f = formatOf(d);
  if (B.busy) return;
  Object.assign(B, { busy: true, fillDeck: d.id, msg: "Loading card data…", openTier: null });
  render();
  try {
    await resolveNames(d.cards.map((c) => c.name));
    const spells = aggregateCards(d.cards).map((r) => ({ r, c: meta(r.name) })).filter((x) => x.c && !isLand(x.c)).sort((a, b) => b.r.qty - a.r.qty),
      lead = hasCommander(d) ? meta(d.commander) : null,
      seeds = [...(lead ? [lead] : []), ...spells.slice(0, 4).map((x) => x.c)].filter(Boolean),
      colors = lead ? lead.color_identity || [] : [...new Set(spells.flatMap((x) => x.c.color_identity || []))];
    if (!seeds.length) throw Error("Add at least one non-land card first — the deck is built around it.");
    await loadFormatPool(f, colors.length ? colors : ["C"], seeds[0], (m) => {
      B.msg = m;
      render();
    });
    B.avail = V.availability();
    B.results.__fill = buildTiers({ format: f.name, seeds, base: d.cards, catalog: S.catalog, available: B.avail, price: (c) => priceOf(c.name), colors: colors.length ? colors : null, commander: lead }, tierList());
    B.msg = "Each version keeps your cards and completes the deck. Pick one to apply — the current list is saved in Versions first.";
  } catch (e) {
    B.msg = e.message;
  } finally {
    B.busy = false;
    render();
  }
};
A.tierApply = async (t) => {
  const tier = S.ui.build.results.__fill?.[Number(t.dataset.i)];
  if (!tier) return;
  await editDeck((d) => withSnapshot({ ...withSnapshot(d, "Before filling"), cards: tier.cards.map((r) => ({ name: r.name, qty: r.qty })) }, `Filled at ${tier.budget ? "$" + tier.budget : "$0"}`), { msg: "Deck updated. The previous list is in Versions." });
  S.ui.build.results.__fill = null;
  render();
};

/* ---------- account ---------- */
A.settingsTab = (t) => {
  const tab = t.dataset.id;
  if (!["account","backup","app","info"].includes(tab)) return;
  S.ui.settingsTab = tab;
  if (tab === "backup") storageDetail();
  for (const pane of document.querySelectorAll(".settings-pane")) pane.hidden = pane.id !== "settings-" + tab;
  for (const button of document.querySelectorAll('[data-act="settingsTab"][role="tab"]')) button.setAttribute("aria-selected",String(button.dataset.id === tab || button.dataset.id === "account" && tab === "backup"));
};
document.addEventListener('keydown',e=>{
  const tab=e.target.closest?.('[data-act="settingsTab"][role="tab"]');
  if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')],i=tabs.indexOf(tab);
  const next=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
  e.preventDefault();A.settingsTab(next);next.focus();
});
A.authTab = (t) => {
  const mode = t.dataset.mode;
  if (!["login","signup","reset"].includes(mode)) return;
  S.ui.authMode = mode;
  S.ui.authFeedback=null;authFeedback(document,"");
  const email = $("#signEmail")?.value || "", field = mode === "signup" ? $("#signupEmail") : mode === "reset" ? $("#resetEmail") : null;
  if (field && !field.value) field.value = email;
  for (const pane of document.querySelectorAll(".auth-pane")) pane.hidden = pane.id !== "auth-" + mode;
  for (const button of document.querySelectorAll('[data-act="authTab"][role="tab"]')) button.setAttribute("aria-selected",String(button.dataset.mode === mode));
  document.querySelector("#auth-" + mode + " input")?.focus();
};
A.signGoogle = async (t) => {
  const done = busy(t, "Opening Google…");
  try {
    await signInGoogle();
  } finally {
    done();
  }
};
A.signEmail = async (t) => {
  const email = $("#signEmail")?.value.trim() || "",
    done = busy(t?.tagName === "BUTTON" ? t : $('[data-act="signEmail"]'), "Sending…");
  try {
    await signInEmail(email);
    toast("Check your email for the sign-in link. It opens CardStashy signed in.");
  } finally {
    done();
  }
};
let authSubmitting=false;
async function runAuth(t,loading,action) {
 if(authSubmitting)return;authSubmitting=true;authFeedback(document,"");S.ui.authFeedback=null;
 const done=busy(t,loading);
 try{const message=await action();for(const id of ["signPassword","signupPassword","signupConfirm"]){const field=$("#"+id);if(field)field.value="";}S.ui.authFeedback={message,tone:"success"};render();authFeedback(document,message,"success");}
 catch(e){const message=e.message || "Couldn’t connect. Please try again.";S.ui.authFeedback={message,tone:"error"};authFeedback(document,message,"error");}
 finally{authSubmitting=false;done();}
}
A.signPassword = t => runAuth(t,"Logging in…",async()=>{
 const email=$("#signEmail")?.value.trim() || "",password=$("#signPassword")?.value || "";
 await signInPassword(email,password);return "Signed in. Your private account is ready.";
});
A.createAccount = t => runAuth(t,"Creating account…",async()=>{
 const email=$("#signupEmail")?.value.trim() || "",password=$("#signupPassword")?.value || "",confirm=$("#signupConfirm")?.value || "";
 const data=await createAccount(email,password,confirm);
 if(data?.session)return "Account created. You’re signed in.";
 // Supabase hides existing accounts: an already-registered email comes back with no identities and no email is sent.
 if(data?.user && Array.isArray(data.user.identities) && !data.user.identities.length)return "That email already has an account. Log in, or use Forgot password.";
 return "Check your inbox and spam for the confirmation email (sender: Supabase Auth unless the site uses its own mail service). Nothing after a few minutes? Tap “Resend confirmation email”.";
});
A.resendConfirm = t => runAuth(t,"Sending…",async()=>{
 await resendConfirmation($("#signupEmail")?.value.trim() || $("#signEmail")?.value.trim() || "");
 return "Confirmation email sent again. Check spam and promotions too. Still nothing? The site's email service needs setting up (Supabase → Authentication → SMTP).";
});
A.forgotPassword = t => runAuth(t,"Sending…",async()=>{
 await requestPasswordReset($("#resetEmail")?.value.trim() || "");return "If an account exists, a reset link will arrive. Open it in this browser.";
});
A.accountResetPassword = async (t) => {
  const email = cloudInfo().user?.email || "", done = busy(t,"Sending…");
  try { await requestPasswordReset(email); toast("Check your email for a password-reset link. Open it in this browser."); } finally { done(); }
};
A.finishPasswordReset = async (t) => {
  const password = $("#resetPassword")?.value || "", confirmPassword = $("#resetConfirm")?.value || "";
  const done = busy(t?.tagName === "BUTTON" ? t : $('[data-act="finishPasswordReset"]'),"Saving…");
  try { await finishPasswordReset(password,confirmPassword); render(); toast("Password saved. You’re signed in."); }
  finally { for (const id of ["resetPassword","resetConfirm"]) if ($("#"+id)) $("#"+id).value = ""; done(); }
};
// Delete the account and everything synced to it (Google Play requires this in the app). Typed
// confirmation; then the player chooses whether this device's copy goes too.
A.deleteAccount = async (t) => {
  const email = cloudInfo().user?.email || "your account";
  const v = await askText(`This permanently deletes ${email} and the collection, decks and profile synced to it. It can't be undone. Type DELETE to confirm.`, "", { title: "Delete account", ok: "Delete account", danger: true });
  if (v === null) return;
  if (v.trim() !== "DELETE") return toast("Account not deleted. Type DELETE in capitals to confirm.");
  const done = busy(t, "Deleting…");
  try { await deleteAccount(); }
  catch (e) { done(); return toast(e.message || "Couldn't delete the account. Try again."); }
  done();
  if (await ask("Your account is deleted. Also erase the collection and decks saved on this device?", { ok: "Erase this device", cancel: "Keep on this device", danger: true })) {
    await replaceWorkspace(blank(), { clearRecovery: true });
  }
  go("#home");
  toast("Your account and its synced data were deleted.");
};
A.signOut = async () => {
  if (!await ask("Sign out? Your cards stay on this device; they just stop syncing.")) return;
  const result = await signOut();
  render();
  toast(result?.synced ? "Signed out. Your cards are saved on this device and your account." : "Signed out. Account sync was not confirmed. Keep this device copy or export a backup.");
};
A.syncNow = () => syncNow();
A.syncDecide = () => {
  const p = cloudInfo().pending;
  if (p) openSheet(V.syncDecideSheet(p, stripCache(S.state)), { type: "sync" });
};
A.syncChoice = async (t) => {
  const c = t.dataset.choice;
  if (c === "device" && cloudInfo().pending?.cloud && !await ask("Replace your account copy with this device’s? The account copy is downloaded as a backup first.")) return;
  closeSheet();
  await resolvePending(c);
  render();
  if (c === "account") toast("Loaded your account copy. This device’s previous data was downloaded as a backup.");
};
A.saveProfile = async (t) => {
  const done = busy(t, "Saving…");
  try {
    await saveProfile({ display_name: $("#pfName").value, username: $("#pfUser").value, bio: $("#pfBio").value });
    toast("Profile saved.");
  } finally {
    done();
  }
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
C.finderBasics = (t) => {
  S.ui.finder.basics = t.checked;
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
  await commit((s) => (s.references = [...(s.references || []), { id: uid(), name: d.name, format: d.format, commander: d.commander, strategy: d.strategy, about: d.about, locked: false, source: sharedCredit(d), cards: d.cards, side: d.side || [] }]), { msg: "Saved — find it under Decks → Find decks." });
};
A.sharedCopy = () => S.ui.shared.deck && copyText(exportDeckText(S.ui.shared.deck), "Decklist copied.");
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
    await navigator.share({ title: d?.name || "CardStashy deck", text: "Check out my deck on CardStashy", url: S.ui.sheetCtx.link });
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
  Object.assign(S.ui.set, { info: null, cards: [], loaded: false, busy: false, complete: false, error: "", generation: (S.ui.set.generation || 0) + 1 });
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
C.setFinish = (t) => {
  S.ui.set.finish = t.value;
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

/* ---------- home search & art ---------- */
const homeResultCache=new Map();
async function homeLookup(g,q){
 const k=g+':'+q.toLowerCase();if(homeResultCache.has(k))return homeResultCache.get(k);
 const cached=g==='mtg'?Object.values(S.catalog):Object.values(T.cache[g]||{}),pack=catalogState(g).pack;
 const local=[...cached];
 if(pack){const query=q.toLowerCase();for(const [name,indexes]of pack.names)if(name.includes(query)||name.startsWith(query.slice(0,3)))for(const i of indexes.slice(0,3))local.push(catalogCandidate(pack,i).card);}
 let cards=rankHomeCards(local,q),error=false,corrected=false;
 if(cards.length<5){try{
   if(g==='mtg'){
    let data;try{data=await api('/cards/search?'+new URLSearchParams({q:q+' game:paper',unique:'prints',order:'released'}));}catch(e){if(e.status!==404&&!/404|no cards|not found|zero results|didn.t match/i.test(e.message||''))throw e;data={data:[]};}
    if(!data.data?.length){try{const c=await api('/cards/named?'+new URLSearchParams({fuzzy:q}));data={data:[c]};corrected=true;}catch(e){if(e.status!==404&&!/404|no cards|not found|zero results|ambiguous|didn.t match/i.test(e.message||''))throw e;}}
    cards=rankHomeCards([...cards,...(data.data||[])],q);
   }else{
    let result=await T.SOURCES[g].search({q,size:7,page:0});
    if(!result.cards.length&&q.length>=5){result=await T.SOURCES[g].search({q:q.slice(0,3),size:40,page:0});corrected=true;}
    cards=rankHomeCards([...cards,...result.cards.map(c=>T.cardOf(g,c.id)||c)],q);
   }
  }catch{error=true;}}
 const result={cards,error,corrected};if(!error){homeResultCache.set(k,result);if(homeResultCache.size>40)homeResultCache.delete(homeResultCache.keys().next().value);}return result;
}
async function submitHome(q,mode){
 q=String(q||'').trim();if(!q)return;const g=T.game();homeQueries[g]=q;
 if((mode||homeIntent(q))==='ask'){
  if(/\b(?:rules?|ruling|resolve|stack|trigger|can i (?:cast|summon|attack|activate)|when can)\b/i.test(q)){
   A.askRules({dataset:{game:g}});const input=document.querySelector('.rules-ask-dialog .ask-input');if(input){input.value=q;input.focus();}return;
  }
  return A.askOpen({query:q});
 }
 if(T.isTcg()){T.ui().search.q=q;await go('#search');if(T.game()===g)A.tSearch();}
 else{S.ui.db.term=q;dbInvalidate();await go('#search');if(T.game()===g)A.dbSearch();}
}
A.homeSearch=()=>submitHome($('#homeQ')?.value);
window.matchMedia?.("(min-width:1200px)").addEventListener?.("change",()=>placeGlobalSearch(T.game(),S.ui.view));
const homeSearchController=attachHomeSearch({game:T.game,lookup:homeLookup,submit:submitHome,open:async(g,c)=>{
 if(T.game()!==g)return;
 if(g==='mtg'){
  if(c.oracle_text!==undefined||c.card_faces?.some(f=>f.oracle_text!==undefined))return A.card({dataset:{name:c.name},printing:c});
  const ctx={type:'card',name:c.name,searchPrintingId:c.id};
  openSheet(`<div class="sheet-head"><h2>${esc(c.name)}</h2><button class="icon" data-act="closeSheet">✕</button></div><p class="muted">Loading this printing…</p>`,ctx);
  const still=()=>S.ui.sheetCtx===ctx&&$('#sheet').open&&T.game()===g;
  try{const print=await api('/cards/'+encodeURIComponent(c.id));if(!still())return;if(print.id!==c.id||key(print.name)!==key(c.name))throw Error('The source returned a different printing. Please try again.');return A.card({dataset:{name:c.name},printing:slim({...print,full:true})});}
  catch(e){if(still())$('#sheetBody').innerHTML=`<div class="sheet-head"><h2>${esc(c.name)}</h2><button class="icon" data-act="closeSheet">✕</button></div><p class="note warn">${esc(e.message)}</p>`;}return;
 }

 return A.tCard({dataset:{id:String(c.id),game:g}});
}});
// A daily feature opens its actual printing, never a name-wide/default deck card.
A.homeDailyCard = async (t) => {
  const g = t.dataset.game, h = T.heroFor(g);
  if (S.ui.view !== "home" || T.game() !== g) return;
  if (!h || h.id !== t.dataset.id || h.date !== t.dataset.date) return heroArt(g);
  if (g !== "mtg") return A.tCard({ dataset: { id: h.id, game: g } });
  if (h.printing) return A.card({ dataset: { name: h.name }, printing: h.printing });
  // Existing v1 caches retained only art; its proved ID can load the exact print.
  const ctx = { type: "card", name: h.name, dailyId: h.id };
  openSheet(`<div class="sheet-head"><h2>${esc(h.name)}</h2><button class="icon" data-act="closeSheet">✕</button></div><p class="muted">Loading this printing…</p>`, ctx);
  const still = () => S.ui.sheetCtx === ctx && $("#sheet").open && S.ui.view === "home" && T.game() === g;
  try {
    const print = await api("/cards/" + encodeURIComponent(h.id));
    if (!still()) return;
    if (print.id !== h.id || key(print.name) !== key(h.name) || typeof print.set !== "string") throw Error("The card source returned a different printing. Please try again.");
    return A.card({ dataset: { name: h.name }, printing: slim({ ...print, full: true }) });
  } catch (e) {
    if (still()) $("#sheetBody").innerHTML = `<div class="sheet-head"><h2>${esc(h.name)}</h2><button class="icon" data-act="closeSheet">✕</button></div><div class="note warn">${esc(e.message)}</div>`;
  }
};

// Only update the daily art/action. Never replace value, resume, carousel, focus or scroll.
function paintHomeHero(g) {
  if (S.ui.view !== "home" || T.game() !== g) return;
  const el = $("#homeHero"), h = T.heroFor(g);
  if (!el || el.dataset.game !== g || el.dataset.dailyDate === (h?.date || "") && el.dataset.dailyId === (h?.id || "")) return;
  const template = document.createElement("template");
  template.innerHTML = T.homeHero(g, "");
  const next = template.content.firstElementChild;
  const oldArt = el.querySelector(".hh-art"), newArt = next.querySelector(".hh-art");
  if (oldArt) newArt ? oldArt.replaceWith(newArt) : oldArt.remove();
  else if (newArt) el.prepend(newArt);
  for (const selector of [".hh-credit"]) {
    const old = el.querySelector(selector), fresh = next.querySelector(selector);
    if (old && fresh) {
      // Keep the focused button node; only its exact-card identity/content changes.
      for (const attr of [...old.attributes]) old.removeAttribute(attr.name);
      for (const attr of [...fresh.attributes]) old.setAttribute(attr.name, attr.value);
      old.innerHTML = fresh.innerHTML;
    } else if (old) old.remove();
    else if (fresh) {
      el.querySelector(".hh-credits")?.remove();
      el.querySelector(".hh-body").append(next.querySelector(".hh-credits"));
    }
  }
  if (!h) el.querySelector(".hh-credits")?.remove();
  el.dataset.dailyDate = h?.date || "";
  el.dataset.dailyId = h?.id || "";
  el.classList.toggle("has-art", !!h?.art);
  el.classList.toggle("no-art", !h?.art);
  updateAmbient();
}
let heroRolloverTimer = null;
function scheduleHeroRollover() {
  clearTimeout(heroRolloverTimer);
  if (document.hidden || S.ui.view !== "home") return;
  heroRolloverTimer = setTimeout(() => heroArt(T.game()), 86400000 - Date.now() % 86400000 + 20);
  heroRolloverTimer?.unref?.();
}
function heroArt(g) {
  const screen=navigationStamp();
  if (S.ui.view !== "home" || T.game() !== g) return;
  scheduleHeroRollover();
  paintHomeHero(g); // Clear yesterday's art even if today's provider is offline.
  return T.loadHero(g, () => api("/cards/random?" + new URLSearchParams({ q: "game:paper is:hires (rarity:mythic or rarity:rare) -is:digital" })))
    .then(() => navigationCurrent(screen) && paintHomeHero(g))
    .catch(() => {});
}
// Suspended/mobile tabs recheck the day when foregrounded, not only on navigation.
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.ui.view === "home") heroArt(T.game()); });
window.addEventListener("focus", () => { if (S.ui.view === "home") heroArt(T.game()); });

/* ---------- rules reference ---------- */
A.rulesList = async (t) => {
  const screen=navigationStamp();
  const g = T.game(),
    R = (S.ui.rules[g] ||= { list: "", busy: false, error: "", data: {} }),
    id = t.dataset.id;
  R.list = id;
  if (R.data[id] || R.busy) return render();
  R.busy = true;
  R.error = "";
  render();
  try {
    if (g === "ygo") {
      const cards = await T.SOURCES.ygo.banlist(id),
        word = { banned: "Forbidden", limited: "Limited", semi: "Semi-Limited" };
      for (const c of cards) T.cache.ygo[c.id] = c;
      R.data[id] = cards.filter((c) => c.ban?.[id]).map((c) => ({ id: c.id, name: c.name, status: word[c.ban[id]], image: c.image }));
    } else {
      const rows = [];
      let path = "/cards/search?" + new URLSearchParams({ q: `banned:${id} or restricted:${id}`, unique: "cards", order: "name" });
      for (let page = 0; path && page < 5; page++) {
        const d = await api(path).catch((e) => (/didn’t match|No cards/i.test(e.message) ? { data: [] } : Promise.reject(e)));
        for (const c of d.data || []) {
          cacheCard(c);
          rows.push({ name: c.name, status: c.legalities?.[id] === "restricted" ? "Restricted" : "Banned", image: c.image_uris?.art_crop || c.card_faces?.[0]?.image_uris?.art_crop || "" });
        }
        path = d.has_more && d.next_page ? new URL(d.next_page).pathname + new URL(d.next_page).search : null;
      }
      R.data[id] = rows;
    }
  } catch (e) {
    R.error = "Couldn’t load the list: " + e.message;
  } finally {
    R.busy = false;
    if(navigationCurrent(screen))render();
  }
};

/* ---------- card page tabs ---------- */
A.ruleHint = showRuleHint;
A.cardTab = async (t) => {
  const ctx = S.ui.sheetCtx;
  if (!["card","tcard"].includes(ctx?.type) || !["overview","meta","guide","versions","prices","rulings","legal","trade"].includes(t.dataset.tab)) return;
  ctx.tab = t.dataset.tab;
  for (const b of $$("#sheetBody .cs-tabs [data-tab]")) {
    const on = b.dataset.tab === ctx.tab;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", on);
    b.tabIndex = on ? 0 : -1;
  }
  for (const p of $$("#sheetBody .cs-panel")) {
    p.hidden = p.dataset.tab !== ctx.tab;
    if (!p.hidden) { p.classList.remove("tab-enter"); void p.offsetWidth; p.classList.add("tab-enter"); }
  }
  // The Trade tab is built on demand (it reads your whole collection), so draw it now.
  if(ctx.tab=== "trade" && ctx.type=== "tcard"){await T.loadTradeCards(ctx.game);if(S.ui.sheetCtx!==ctx)return;refreshSheet();}
  if (ctx.tab === "trade" && !$('#sheetBody .cs-panel[data-tab="trade"]')) refreshSheet();
  // The Play guide looks up cards that pair well the first time it's opened.
  if (ctx.tab === "guide") {
    if (ctx.type === "card") mtgGuideLoad(meta(ctx.name));
    else if (ctx.type === "tcard") tcgCtx.guideLoad?.(ctx.game, contextTcgCard(ctx.game, ctx.id, ctx));
  }
  // Keep the reader’s vertical place when switching pills; the bar stays sticky.
  if(ctx.tab === "prices" && ["card","tcard"].includes(ctx.type)){
    const g=ctx.type === "card"?"mtg":ctx.game,c=ctx.type === "card"?ctx.print||meta(ctx.name):contextTcgCard(g,ctx.id,ctx);
    await commit(s=>recordQuote(s,quoteModel(g,c,selectedFinish(g,c,ctx.priceFinish),ctx.priceEdition,ctx.priceYgoEdition)),{rerender:false,enrich:false});
    if(S.ui.sheetCtx === ctx)refreshSheet();
  }
  sheetScrolled();
  // Official rulings load the first time the tab opens.
  if (ctx.tab === "rulings" && ctx.type === "card" && !ctx.rulings) {
    const c = ctx.print || meta(ctx.name);
    try {
      const r = await api("/cards/" + encodeURIComponent(c.id) + "/rulings");
      ctx.rulings = r.data || [];
    } catch {
      ctx.rulings = [];
    }
    if (S.ui.sheetCtx === ctx) refreshSheet();
  }
};
const jumpToCardPrices = createDetailJump({
  getContext:()=>S.ui.sheetCtx,identityOf:detailContextIdentity,isOpen:()=>$("#sheet").open,getBody:()=>$("#sheetBody"),
  showPrices:()=>A.cardTab({dataset:{tab:"prices"}}),refreshOffsets:sheetScrolled,
  reducedMotion:()=>!!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
});
A.cardPriceJump = t => {
  const ctx = S.ui.sheetCtx;
  if (!["card","tcard"].includes(ctx?.type)) return;
  if (t.dataset.finish) {
    const g=ctx.type==="card"?"mtg":ctx.game,c=ctx.type==="card"?ctx.print||meta(ctx.name):contextTcgCard(g,ctx.id,ctx);
    ctx.priceFinish=selectedFinish(g,c,t.dataset.finish);
    if(ctx.setId && g === "ptcg")ctx.setVariant=ctx.priceFinish;
  }
  return jumpToCardPrices(t.dataset.target);
};
// Automatic-activation card tabs: range/finish buttons use ordinary pressed-button semantics.
document.addEventListener("keydown", e => {
  const tab=e.target.closest?.('.cs-tabs [role="tab"]');
  if (!tab || !$("#sheetBody").contains(tab)) return;
  const tabs=$$("#sheetBody .cs-tabs [role=tab]"), index=detailTabKey(e.key,tabs.indexOf(tab),tabs.length);
  if (index===null) return;
  e.preventDefault();tabs[index].focus({preventScroll:true});tabs[index].scrollIntoView?.({block:"nearest",inline:"nearest",behavior:"auto"});
  safely(A.cardTab(tabs[index]));
});
const resizeCardSheet=()=>{if(["card","tcard","buy","market"].includes(S.ui.sheetCtx?.type))sheetScrolled();};
globalThis.addEventListener?.("resize",resizeCardSheet,{passive:true});
globalThis.visualViewport?.addEventListener?.("resize",resizeCardSheet,{passive:true});
A.priceSource = (t) => {
  const ctx = S.ui.sheetCtx;
  if (!ctx) return;
  ctx.source = t.dataset.src;
  refreshSheet();
};

/* ---------- buy this card ---------- */
let buyRequestToken = 0;
A.buyCard = async (t) => {
  const request=++buyRequestToken,origin=S.ui.sheetCtx,originGame=T.game(),originRoute=location.hash;
  let back = S.ui.sheetCtx?.type === "card" && $("#sheet").open ? S.ui.sheetCtx : null;
  const backScroll = back ? $("#sheetBody").scrollTop : 0;
  let print;
  if(t.dataset.lot){const lot=S.state.collection.find(e=>e.id === t.dataset.lot); if(!lot)return; print=(lot.printingVerified && S.state.printings?.[lot.printingId]) || meta(lot.name); back={type:"card",name:lot.name,entryId:lot.id};}
  else if (back) {
    print = t.dataset.i !== undefined && back.prints ? back.prints[Number(t.dataset.i)] : back.print || meta(back.name);
  } else {
    const c = meta(t.dataset.name) || (await resolve(t.dataset.name, true));
    back = { type: "card", name: c.name, deckId: t.dataset.deck || null };
    print = c;
  }
  const fromPrints = back.prints && back.prints.includes(print);
  const ctx = { type: "buy", entryId: back.entryId, name: back.name, deckId: back.deckId, print, finish: selectedFinish("mtg",print,t.dataset.finish || back.priceFinish), asOf: fromPrints ? back.pricesAt : print?.checkedAt, back, backScroll };
  await commit(s=>recordQuote(s,quoteModel("mtg",print,ctx.finish)),{rerender:false,enrich:false});
  if(request!==buyRequestToken||S.ui.sheetCtx!==origin||T.game()!==originGame||location.hash!==originRoute)return;
  openSheet(V.buySheet(ctx), ctx);
};
// Card sheet purchase actions reveal the matched sellers without opening a store.
const sheetPrint = () => { const ctx = S.ui.sheetCtx; return ctx?.type === "card" ? ctx.print || meta(ctx.name) : null; };
A.buyDirect = t => A.cardPriceJump({dataset:{target:"sellers",finish:t.dataset.finish}});
// Press and hold a price: the player's own price for this printing and finish. Saved with their
// data, shown only to them, and only counted where no store prices the card.
A.myPriceSet = async (t) => {
  const print = sheetPrint();
  if (!print) return;
  const finish = t.dataset.finish || "nonfoil", k = myPriceKey(print, finish), cur = S.state.myPrices?.[k]?.price;
  const label = { nonfoil: "", foil: " (foil)", etched: " (etched)" }[finish] || "";
  const v = await askText(`Your price for ${print.name}${label}. Only you see it; leave empty to remove.`, cur != null ? String(cur) : "", { title: "Set your price" });
  if (v === null) return;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  if (v.trim() && !(n >= 0 && Number.isFinite(n))) return toast("Enter a price like 12.50");
  await commit((s) => {
    s.myPrices ||= {};
    if (v.trim()) s.myPrices[k] = { price: Math.round(n * 100) / 100, name: print.name, set: print.set, number: print.collector_number, finish, at: new Date().toISOString() };
    else delete s.myPrices[k];
  }, { rerender: false, enrich: false });
  useMyPrices(S.state.myPrices);
  toast(v.trim() ? `Your price saved: ${usd(Math.round(n * 100) / 100)}` : "Your price removed");
  refreshSheet();
};
// Pokémon / Yu-Gi-Oh! reuse the same selected-version seller jump as Magic.
A.tBuyDirect = t => {
  const ctx=S.ui.sheetCtx;
  if(ctx?.type!=="tcard"||ctx.game!==t.dataset.game||ctx.id!==t.dataset.id)return;
  return A.cardPriceJump({dataset:{target:"sellers",finish:t.dataset.finish}});
};
A.tMyPriceSet = async (t) => {
  const ctx = S.ui.sheetCtx, g = t.dataset.game;
  if(ctx?.type !== "tcard" || ctx.game !== g || String(ctx.id) !== String(t.dataset.id))return;
  const c = contextTcgCard(g,t.dataset.id,ctx);
  if (!c) return;
  const identity = detailContextIdentity(ctx), k = myPriceKey(c,"nonfoil",ctx);
  if(!k)return toast("Choose a verified printing before recording its private value.");
  const cur = S.state.myPrices?.[k]?.price;
  const selected = quoteModel(g,c,selectedFinish(g,c,ctx.priceFinish),ctx.priceEdition,ctx.priceYgoEdition);
  const v = await askText(`Your price for ${c.name}${c.setContext?" · "+c.setContext.name+" · "+(selected?.label||"Selected version"):""}. Only you see it; leave empty to remove.`, cur != null ? String(cur) : "", { title: "Set your price" });
  if (v === null || S.ui.sheetCtx !== ctx || detailContextIdentity(ctx) !== identity || myPriceKey(contextTcgCard(g,t.dataset.id,ctx),"nonfoil",ctx) !== k) return;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  if (v.trim() && !(n >= 0 && Number.isFinite(n))) return toast("Enter a price like 12.50");
  await commit((s) => {
    s.myPrices ||= {};
    if (v.trim()) s.myPrices[k] = { price: Math.round(n * 100) / 100, name: c.name, game: g, ...(c.setContext?{releaseId:c.setContext.releaseId,printing:selected?.edition||"",rarity:selected?.rarity||"",finish:selected?.finish||"",edition:selected?.selectedEdition||""}:{}), at: new Date().toISOString() };
    else delete s.myPrices[k];
  }, { rerender: false, enrich: false });
  useMyPrices(S.state.myPrices);
  toast(v.trim() ? `Your price saved: ${usd(Math.round(n * 100) / 100)}` : "Your price removed");
  refreshSheet();
};
A.buyFinish = async (t) => {
  const ctx = S.ui.sheetCtx;
  if (ctx?.type !== "buy") return;
  ctx.finish = selectedFinish("mtg",ctx.print,t.dataset.finish);
  await commit(s=>recordQuote(s,quoteModel("mtg",ctx.print,ctx.finish)),{rerender:false,enrich:false});
  if(S.ui.sheetCtx === ctx) refreshSheet();
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
A.buyCompare = () => {
  const ctx = S.ui.sheetCtx;
  if (ctx?.back) ctx.back.tab = "versions";
  backToCard(".cs-tabs");
};

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
  const id = t.dataset.deck || $("#toDeck")?.value,
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
  const lookup = entry ? (entry.printingVerified && S.state.printings?.[entry.printingId]) || meta(entry.name) : preset.card || null;
  S.ui.sheetCtx = { type: "add", entry, lookup };
  openSheet(
    `<div class="sheet-head"><h2>${entry ? "Edit card" : "Add to collection"}</h2><button class="icon" data-act="closeSheet">✕</button></div>
    ${entry ? "" : segmented("addMode", "one", [["one", "One card"], ["list", "Paste or upload a list"]])}
    <div class="searchbar"><input id="addName" value="${esc(entry?.name || lookup?.name || preset.name || "")}" placeholder="Card name, e.g. Sol Ring" data-enter="addLookup" autocomplete="off" aria-label="Card name"><button class="btn ghost" data-act="addLookup">Look up</button></div>
    <div id="addPreview">${lookup ? addPreview(lookup) : '<p class="muted small">Look up the card, check the picture, then save.</p>'}</div>
    <div class="grid2">
      <label>Copies<input id="addQty" type="number" min="1" max="100000" value="${entry?.qty || preset.qty || 1}"></label>
      <label>Finish<select id="addFinish">${options([["nonfoil", "Nonfoil"], ["foil", "Foil"], ["etched", "Etched"]], entry?.finish || preset.finish || "nonfoil")}</select></label>
      <label>Condition<select id="addCondition" aria-label="Condition">${options(["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"].map((x) => [x, x]), entry?.condition || "Near Mint")}</select></label>
      <label>Language<select id="addLanguage">${options([["en", "English"], ["ja", "Japanese"], ["de", "German"], ["fr", "French"], ["es", "Spanish"], ["it", "Italian"], ["pt", "Portuguese"], ["ru", "Russian"], ["ko", "Korean"], ["zhs", "Chinese (S)"], ["zht", "Chinese (T)"]], entry?.language || "en")}</select></label>
      ${locationPicker(S.state,"mtg","addLocation",entry ? entry.location || "" : preset.location ?? null)}
    </div>
    <details class="more" ${entry?.set || preset.set ? "open" : ""}><summary>Exact printing (optional)</summary><div class="grid2"><label>Set code<input id="addSet" placeholder="e.g. CMM" value="${esc(entry?.set || preset.set || "")}"></label><label>Collector #<input id="addNumber" value="${esc(entry?.collectorNumber || preset.number || "")}"></label></div><p class="muted small">Leave blank if unsure — CardStashy never guesses an edition.</p></details>
    <section id="conditionPricePreview" class="condition-price-preview" role="status" aria-label="Selected condition value"></section>
    <details class="more" open><summary>Value for this condition</summary><label>Your value per copy (USD, optional)<input id="lotManualValue" type="number" min="0" step="0.01" value="${Number.isFinite(entry?.manualValue)?entry.manualValue:''}" placeholder="No condition quote"></label><p class="foot">A played or damaged copy without a matching quote is excluded from value totals. Enter your own value to include it.</p></details>
    <p id="addError" class="error" role="alert"></p>
    <div class="actions"><button class="btn" data-act="addSave" ${lookup ? "" : "disabled"} id="addSaveBtn">${entry ? "Save changes" : "Add to collection"}</button><button class="link small" data-act="addSaveRaw">Save without lookup</button>${entry ? `<button class="link small danger" data-act="addDelete">Delete</button>` : ""}</div>`,
    S.ui.sheetCtx,
  );
}
const addPreview = (c) =>
  `<div class="add-preview">${img(cardImage(c, "small") || cardImage(c), c.name, "card-img")}<div><b>${esc(c.name)}</b><p class="muted small">${esc(typeText(c))}</p><p class="small">Reference ${usd(cardPrice(c))} · ${esc((c.set || "").toUpperCase())}</p></div></div>`;

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
  addSheet(null, { card: print || meta(name), name, qty: row?.missing || 1, set: print?.set?.toUpperCase(), number: print?.collector_number, finish: ctx?.type === "buy" ? ctx.finish : print && ctx?.priceFinish ? selectedFinish("mtg",print,ctx.priceFinish) : null });
};
A.addLookup = async () => {
  const ctx = S.ui.sheetCtx;
  if(ctx?.type !== "add")return;
  const name = $("#addName").value.trim();
  if (!name) return;
  $("#addError").textContent = "";
  $("#addPreview").innerHTML = '<p class="muted small">Looking up…</p>';
  if($("#lotManualValue"))$("#lotManualValue").value="";
  try {
    const c = await resolve(name, true);
    if(S.ui.sheetCtx !== ctx)return;
    if(ctx.lookup && key(ctx.lookup.name) !== key(c.name)){ $("#addSet").value=""; $("#addNumber").value=""; }
    ctx.lookup = c;
    $("#addName").value = c.name;
    $("#addPreview").innerHTML = addPreview(c);
    $("#addSaveBtn").disabled = false;
    refreshConditionPrice();
  } catch (e) {
    if(S.ui.sheetCtx !== ctx)return;
    ctx.lookup = null;
    $("#addPreview").innerHTML = "";
    $("#addError").textContent = e.message;
    $("#addSaveBtn").disabled = true;
    refreshConditionPrice();
  }
};
A.addSave = () => saveLot(false);
A.addSaveRaw = () => saveLot(true);
A.addDelete = async () => {
  const e = S.ui.sheetCtx?.entry;
  if (!e || !await ask(`Delete ${e.qty}× ${e.name} from your collection?`)) return;
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
  const rawValue=$("#lotManualValue")?.value||"",manualValue=rawValue===""?null:Number(rawValue);
  if(manualValue!==null&&(!Number.isFinite(manualValue)||manualValue<0))return(err.textContent="Enter a non-negative value or leave it blank.");
  const e = {
    ...(editing || {}),
    manualValue,manualValueCondition:conditionName($("#addCondition").value),
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
        e.location=rememberLocation(s,"mtg",e.location,{createBinder:$("#addLocationPicker")?.value === "binder:new"});
        s.collection = editing ? s.collection.map((x) => (x.id === e.id ? e : x)) : [...s.collection, e];
        s.example = false;
        s.printings = { ...s.printings, ...(S.pendingPrintings || {}) };
      },
      { msg: editing ? "Saved." : `${qty}× ${name} added.` },
    );
    S.pendingPrintings = null;
    if(S.ui.sheetCtx === ctx)closeSheet();
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
  await commit((s) => {
    const x = s.collection.find((y) => y.id === id);
    if (!x) return;
    x.qty = Math.max(0, x.qty + delta);
    x.reserved = Math.min(x.reserved || 0, x.qty);
    s.collection = s.collection.filter((y) => y.qty > 0);
  }, {
    undo: delta < 0 ? `−1 ${e.name}` : "",
    guard: async (s) => {
      const current = s.collection.find((x) => x.id === id);
      return !!current && (current.qty + delta > 0 || await ask(`Remove ${current.name} from your collection?`));
    },
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
A.exportCSV = () => download("CardStashy_Collection.csv", exportCollectionCSV(S.state.collection), "text/csv");
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
    await refreshMagicCollectionPrices(true);
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
  if (!items.length) return toast("Nothing to buy.");
  buyMtg(items);
};
A.exportMissing = () => {
  const d = currentDeck();
  download(`CardStashy_${fileSafe(d.name)}_missing.txt`, exportDeck(missingList(d)) + "\n");
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
A.impErrors = () => download("CardStashy_Import_Errors.csv", importErrorsCSV(impDraft.errors), "text/csv");
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
    if (mode === "replace-all" && !await ask("Replace your whole collection? A recovery copy is kept, but export a backup first.")) return;
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

// Every format, grouped (Constructed · Commander · Arena · Casual).
function formatSelect(id, current) {
  const groups = [...new Set(FORMATS.map((f) => f.group))];
  return `<select id="${id}" data-format-select>${groups.map((g) => `<optgroup label="${g}">${FORMATS.filter((f) => f.group === g).map((f) => `<option value="${esc(f.name)}" ${formatOf(current).name === f.name ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</optgroup>`).join("")}</select>`;
}
const formatInfo = (name) => {
  const f = formatOf(name);
  return `${esc(sizeLabel(f))}${f.commander ? " · led by " + (f.commander === "planeswalker" ? "a planeswalker" : f.commander === "creature" ? "a creature" : "a legendary creature") : ""} · ${f.life} life${f.legality ? " · banned list checked" : ""}${f.note ? " · " + esc(f.note) : ""}`;
};
// Show or hide the commander field as the format changes.
document.addEventListener("change", (e) => {
  if (!e.target.matches?.("[data-format-select]")) return;
  const f = formatOf(e.target.value),
    row = e.target.id === "ndFormat" ? $("#ndCommanderRow") : e.target.id === "dImpFormat" ? $("#dImpCommanderRow") : null;
  if (row) {
    row.hidden = !f.commander;
    const label = row.firstChild;
    if (label && label.nodeType === 3) label.textContent = f.commander === "planeswalker" ? "Oathbreaker" : "Commander";
  }
  if (e.target.id === "ndFormat" && $("#ndFormatInfo")) $("#ndFormatInfo").innerHTML = formatInfo(f.name);
});

A.newDeck = (t) => {
  const commander = t?.dataset?.commander || "";
  openSheet(
    `<div class="sheet-head"><h2>New deck</h2><button class="icon" data-act="closeSheet">✕</button></div>
    <div class="grid2">
      <label class="span2">Format${formatSelect("ndFormat", "Commander")}</label>
      <p class="span2 muted small" id="ndFormatInfo">${formatInfo("Commander")}</p>
      <label class="span2" id="ndCommanderRow">Commander<input id="ndCommander" value="${esc(commander)}" placeholder="e.g. Giada, Font of Hope" autocomplete="off"></label>
      <label class="span2">Deck name<input id="ndName" maxlength="100" placeholder="Optional"></label>
      <label>Budget $<input id="ndBudget" type="number" min="0" value="${S.state.settings.budget || 25}"></label>
    </div>
    <p id="ndError" class="error" role="alert"></p>
    <button class="btn block" data-act="newDeckSave">Create deck</button>
    <p class="muted small">Commander formats: single commander only (partners and backgrounds aren’t supported yet).</p>`,
    { type: "newDeck" },
  );
};
A.newDeckSave = async (t) => {
  const done = busy(t, "Checking…"),
    format = $("#ndFormat").value,
    cn = $("#ndCommander").value.trim();
  try {
    let c = null;
    const fm = formatOf(format);
    if (fm.commander) {
      if (!cn) throw Error(fm.commander === "planeswalker" ? "Enter your Oathbreaker (a planeswalker)." : "Enter a commander.");
      c = await resolve(cn, true);
      if (!canLead(c, fm)) throw Error(`${c.name} can’t lead a ${fm.name} deck.`);
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
    go(`#deck/${d.id}/${c && format === "Commander" ? "upgrade" : "cards"}`);
    toast(c && format === "Commander" ? "Deck created. Fill the open slots from your collection here." : `${formatOf(format).name} deck created.`);
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
      <label>Format${formatSelect("dImpFormat", preset.format || "Commander")}</label>
      <label id="dImpCommanderRow">Commander<input id="dImpCommander" value="${esc(preset.commander || "")}" placeholder="Read from the list"></label>
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
    commander: hasCommander(format) ? $("#dImpCommander").value.trim() : "",
    strategy: "Auto",
    budget: S.state.settings.budget || 25,
    locked: false,
    source: sourceCredit({ url: $("#dImpURL").value, author: $("#dImpAuthor").value, description: $("#dImpDesc").value, kind: $("#dImpKind").value }),
    cards: deckRowsFromImport(dImp.cards.map((c) => ({ name: meta(c.name)?.name || c.name, qty: c.qty }))),
    // Commander has no sideboard; every other format keeps the imported one.
    side: hasCommander(format) ? [] : (dImp.side || []).map((c) => ({ name: meta(c.name)?.name || c.name, qty: c.qty })),
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
  ${dImp.side?.length ? `<p class="muted small">${hasCommander(d.format) ? `${sumQty(dImp.side)} sideboard cards left out (Commander has no sideboard).` : `+ ${sumQty(dImp.side)}-card sideboard, saved with the deck.`}</p>` : ""}
  ${dImp.excluded ? `<p class="muted small">${dImp.excluded} maybeboard cards left out.</p>` : ""}
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
    // A list without a commander that's around 60 cards isn't a Commander deck; let the user pick the exact format.
    if (!dImp.commander && $("#dImpFormat").value === "Commander" && sumQty(dImp.cards) <= 80) {
      $("#dImpFormat").value = sumQty(dImp.cards) <= 45 ? "Limited (40-card)" : "60-card casual";
      $("#dImpFormat").dispatchEvent(new Event("change", { bubbles: true }));
      $("#dImpStatus").textContent = "No commander found — set to " + $("#dImpFormat").value + ". Pick Standard, Modern or another format above to check legality.";
    }
    dImpBusy = true;
    const btn = busy($("#dImpPreviewBtn"), "Loading…");
    drawDeckImport();
    const r = await resolveNames([...dImp.cards, ...(dImp.side || [])].map((c) => c.name), (m) => ($("#dImpStatus").textContent = m));
    // A list without a commander section: guess a legendary creature if there's exactly one.
    if (!$("#dImpCommander").value && hasCommander($("#dImpFormat").value)) {
      const legends = dImp.cards.filter((c) => canLead(meta(c.name), formatOf($("#dImpFormat").value)));
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
      if (!canLead(c, formatOf(d))) throw Error(`${c.name} can’t lead a ${formatOf(d).name} deck.`);
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
      if (!await ask(`Replace the cards in ${old.name}? The old list is kept in Versions.`)) return;
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
    <div class="grid2"><label class="span2">Name<input id="dmName" maxlength="100" value="${esc(d.name)}"></label><label class="span2">Format${formatSelect("dmFormat", d.format)}</label><label>Budget $<input id="dmBudget" type="number" min="0" value="${d.budget ?? 25}"></label><label>Focus<select id="dmStrategy">${options(["Auto", "Tokens", "Dragons", "Graveyard", "Spells", "Artifacts", "Lifegain", "Landfall", "Creature"].map((x) => [x, x]), d.strategy || "Auto")}</select></label></div>
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
    </div>${d.source ? `<p class="muted small">Source: ${esc(d.source.kind || "")} · ${esc(d.source.website || "")}${d.source.author ? " · by " + esc(d.source.author) : ""}${d.source.url ? ` · <a href="${esc(safeHref(d.source.url))}" target="_blank" rel="noopener noreferrer">original ↗</a>` : ""}</p>` : ""}`,
    { type: "deckMenu" },
  );
};
const editDeck = (fn, opts = {}) => {
  const id = currentDeck().id;
  return commit((s) => {
    const i = s.decks.findIndex((x) => x.id === id);
    s.decks[i] = fn(s.decks[i]) || s.decks[i];
  }, opts);
};
A.deckSaveInfo = async () => {
  const format = formatOf($("#dmFormat")?.value).name,
    name = $("#dmName").value.trim(),
    budget = Math.max(0, Number($("#dmBudget").value) || 0),
    strategy = $("#dmStrategy").value;
  await editDeck((d) => ({ ...d, name: name || d.name, budget, strategy, format, commander: hasCommander(format) ? d.commander : "" }), { msg: "Saved." });
  closeSheet();
};
// Play guide (Magic): rank cards that pair well — synergy searches on Scryfall plus the cards
// tournament lists run with it, scored by pairing.js (needs/provides, lift, popularity, owned).
async function mtgGuideLoad(c) {
  if (!c) return;
  const k = "mtg:" + c.name;
  S.ui.guide ||= {};
  if (S.ui.guide[k]) return;
  S.ui.guide[k] = { loading: true };
  const qs = mtgPairQueries(c),
    results = await Promise.all(qs.map((q) => api("/cards/search?" + new URLSearchParams({ q: q.q, order: "edhrec", unique: "cards" })).catch(() => null))),
    cands = [];
  for (const r of results) for (const x of (r?.data || []).slice(0, 30)) {
    cacheCard(x);
    cands.push({ card: x, pop: edhPop(x.edhrec_rank), owned: inv(x.name).owned > 0 });
  }
  const al = playedAlongside("mtg", c, allCachedMeta(), 15);
  for (const x of al.cards) {
    const card = meta(x.name);
    if (card) cands.push({ card, lift: Math.max(0, x.share - x.overall), share: x.share, pop: edhPop(card.edhrec_rank), owned: inv(card.name).owned > 0 });
  }
  // Fallback for cards with few links: the most-played cards in its colors (every card gets some).
  if (rankPairs("mtg", c, cands).filter((x) => !x.fallback).length < 4) {
    const id = (c.color_identity || []).join("") || "c",
      r = await api("/cards/search?" + new URLSearchParams({ q: `id<=${id} -t:basic -!"${c.name.split(" // ")[0]}" ${/Land/.test(c.type_line || "") ? "" : "-t:land"}`, order: "edhrec", unique: "cards" })).catch(() => null);
    for (const x of (r?.data || []).slice(0, 12)) {
      cacheCard(x);
      cands.push({ card: x, pop: edhPop(x.edhrec_rank), owned: inv(x.name).owned > 0, fallback: true, why: `staple in its colors${x.edhrec_rank ? ` (EDHREC #${Number(x.edhrec_rank).toLocaleString()})` : ""}` });
    }
  }
  const ranked = rankPairs("mtg", c, cands);
  S.ui.guide[k] = {
    cards: ranked.map((p) => ({ name: p.card.name, image: p.card.image_uris?.small || p.card.card_faces?.[0]?.image_uris?.small || "", attrs: `data-act="card" data-name="${esc(p.card.name)}"`, reasons: p.reasons, score: p.score, fallback: p.fallback })),
    note: ranked.length ? "Ranked by how well they fit (what each card needs and gives), tournament pairings, popularity and what you own." : results.some((r) => !r) ? "Couldn’t reach Scryfall right now." : "No strong pairings found in its text — try Build decks around it.",
  };
  refreshSheet();
}
// Settings → Appearance: glass panels and the art backdrop.
C.setGlass = (t) => {
  try {
    localStorage.setItem(GLASS_KEY, t.checked ? "on" : "off");
  } catch {}
  updateAmbient();
};
// Tap a card image: full-screen, high-resolution, zoomable.
A.zoomCard = (t) => openZoom(zoomCardOptions(t));
// Card sheet Meta tab: fetch tournament results, then redraw the open sheet.
A.deckMetaLoad = (t) => {
  const p = loadMetaData(t.dataset.key).catch(() => toast("Couldn’t load tournament results right now."));
  render();
  p.finally(() => render());
};
A.cardMetaLoad = (t) => {
  const k = t.dataset.key;
  const p = loadMetaData(k).catch(() => toast("Couldn’t load tournament results right now."));
  refreshSheet();
  p.finally(() => refreshSheet());
};
// Swap a no-emblem card for an owned staple (suggested on the deck page).
A.deckEmbSwap = (t) =>
  editDeck(
    (d) => {
      const out = d.cards.find((c) => key(c.name) === key(t.dataset.out));
      if (!out) return d;
      const cards = d.cards.map((c) => (c === out ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0);
      return mergeDeckCard({ ...d, cards }, t.dataset.in, 1);
    },
    { undo: `Swapped ${t.dataset.out} for ${t.dataset.in}.` },
  );
C.deckLock = (t) => editDeck((d) => ({ ...d, locked: t.checked }), { msg: t.checked ? "Copies reserved for this deck." : "Reservation released." });
A.snapshot = async () => {
  const label = await askText("Name this version", "Version " + ((currentDeck().versions || []).length + 1));
  if (label === null) return;
  const before = (currentDeck().versions || []).length;
  await editDeck((d) => withSnapshot(d, label || "Snapshot"));
  toast((currentDeck().versions || []).length > before ? "Version saved." : "No changes since the last version.");
};
A.deckCopy = () => copyText(exportDeckText(currentDeck()), "Decklist copied.");
A.deckExport = () => download(`CardStashy_${fileSafe(currentDeck().name)}.txt`, exportDeckText(currentDeck()) + "\n");
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
  if (!await ask(`Delete ${d.name}? Your collection is not affected.`)) return;
  await commit((s) => {
    s.decks = s.decks.filter((x) => x.id !== d.id);
    if (s.activeDeck === d.id) s.activeDeck = s.decks[0]?.id || null;
  }, { undo: `Deleted ${d.name}.` });
  closeSheet();
  go("#decks");
};
A.refreshDeck = async (t) => {
  const d = currentDeck(),
    done = busy(t, "Refreshing…");
  try {
    const r = await resolveNames(d.cards.map((c) => c.name), (m) => toast(m), true);
    await editDeck((x) => ({ ...x, cards: x.cards.map((c) => ({ ...c, name: r.matched.get(key(c.name)) || c.name })) }), { recordDeckWork: false });
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
  await editDeck((x) => mergeDeckCard(x, name, delta), delta < 0 ? { undo: `−1 ${name}` } : {});
};
A.deckRemove = async (t) => {
  await editDeck((d) => ({ ...d, cards: d.cards.filter((c) => key(c.name) !== key(t.dataset.name)) }), { undo: `Removed ${t.dataset.name}.` });
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
    <div class="grid2">${locationPicker(S.state,"mtg","acqLoc",mode === "purchase" ? "Deck: " + d.name : null,"Store them in")}<label>Finish<select id="acqFinish">${options([["nonfoil", "Nonfoil"], ["foil", "Foil"], ["etched", "Etched"]], "nonfoil")}</select></label><label>Condition<select id="acqCond">${options(["Near Mint", "Lightly Played", "Moderately Played"].map((x) => [x, x]), "Near Mint")}</select></label></div>
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
        for(const p of picked)p.location=rememberLocation(s,"mtg",p.location,{createBinder:$("#acqLocPicker")?.value === "binder:new"});
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

function dbInvalidate(clear = true) {
  const db = S.ui.db;
  db.generation = (db.generation || 0) + 1;
  db.abort?.abort();
  db.abort = null;
  db.busy = false;
  if (clear) Object.assign(db, { results: [], total: 0, next: null, note: "", error: "", submitted: null, pages: [] });
}
I.dbTerm = (t) => {
  if (S.ui.db.term === t.value) return;
  const redraw = S.ui.db.busy || S.ui.db.results.length || S.ui.db.next || S.ui.db.error || S.ui.db.note;
  S.ui.db.term = t.value;
  dbInvalidate();
  if (redraw) render();
};
// Every provider query is an immutable snapshot; replacements can supersede in-flight work.
const dbHasQuery = () => hasMagicSearchQuery(S.ui.db.term, S.ui.db.filters);
C.dbFilter = (t) => {
  const f = S.ui.db.filters;
  f[t.dataset.field] = t.value;
  if (["format", "color"].includes(t.dataset.field)) delete f.fits;
  if (dbHasQuery()) return dbSearch();
  dbInvalidate();
  render();
};
A.dbChip = (t) => {
  const f = S.ui.db.filters,
    k = t.dataset.field;
  if (k === "fits") {
    delete f.fits;
    f.format = "";
    f.color = "";
  } else f[k] = "";
  if (!dbHasQuery()) { dbInvalidate(); return render(); }
  return dbSearch();
};
A.dbClear = () => {
  S.ui.db.filters = { color: "", type: "", format: "", maxPrice: "" };
  if (S.ui.db.term.trim()) return dbSearch();
  else {
    dbInvalidate();
    render();
  }
};
// Cards that fit the active deck: its format's legality and its commander's color identity.
A.dbFitDeck = () => {
  const d = currentDeck();
  if (!d) return;
  const f = formatOf(d),
    comm = d.commander ? meta(d.commander) : null,
    F = S.ui.db.filters;
  F.format = f.legality || "";
  F.color = comm ? (comm.color_identity?.length ? comm.color_identity.join("") : "C") : "";
  F.fits = d.name.slice(0, 24);
  return dbSearch();
};
A.dbSave = () => {
  const error = magicFilterError(S.ui.db.filters);
  if (error) return toast(error);
  const db = S.ui.db,
    chips = V.mtgFilterChips(db.filters).filter(([k]) => k !== "sort"),
    label = [db.term.trim() && `“${db.term.trim().slice(0, 24)}”`, ...chips.map(([, l]) => l)].filter(Boolean).join(" · ").slice(0, 60) || "Search",
    list = T.savedSearches("mtg").filter((x) => x.label !== label);
  T.setSavedSearches("mtg", [{ label, term: db.term, filters: structuredClone(db.filters) }, ...list]);
  toast("Search saved.");
  render();
};
A.dbSaved = (t) => {
  const x = T.savedSearches("mtg")[Number(t.dataset.i)];
  if (!x) return;
  S.ui.db.term = x.term || "";
  S.ui.db.filters = { color: "", type: "", format: "", maxPrice: "", ...x.filters };
  return dbSearch();
};
A.dbSavedDel = (t) => {
  const list = T.savedSearches("mtg");
  list.splice(Number(t.dataset.i), 1);
  T.setSavedSearches("mtg", list);
  render();
};
A.dbSearch = () => dbSearch();
A.dbMore = () => dbSearch(true);
A.undo = async () => {
  let label = "";
  const restored = await replaceWorkspace(() => {
    if (!lastUndo) return null;
    label = lastUndo.label;
    return lastUndo.state;
  }, { stamp: true, notify: true, kind: "undo" });
  if (!restored) return toast("Nothing to undo.");
  render();
  refreshSheet();
  toast(`Undone: ${label.replace(/\.$/, "")}.`);
};
A.nextFact = (t) => nextFact(t);
A.dbRandom = async () => {
  const db = S.ui.db, generation = db.generation;
  if (db.randomBusy || T.game() !== "mtg") return;
  db.randomBusy = true;
  try {
    const card = await api("/cards/random?" + new URLSearchParams({q:"game:paper"}));
    if (S.ui.db !== db || db.generation !== generation || T.game() !== "mtg") return;
    const c = cacheCard(card); saveCatalogSoon();
    await A.card({dataset:{name:c.name,random:"1"}});
  } finally { db.randomBusy = false; }
};
let randomDeckBusy=false,lastRandomCommander="";
A.randomDeck=async()=>{
  const screen=navigationStamp();
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
    if(!navigationCurrent(screen))return;
    lastRandomCommander=S.ui.ideas.cache[index].commander.name;
    S.ui.ideas.open=null;S.ui.ideas.sel=new Set();openIdea(index);
    saveCatalogSoon();
  }finally{randomDeckBusy=false;}
};
A.dbTry = (t) => {
  S.ui.db.term = t.dataset.q;
  return dbSearch();
};
async function dbSearch(next = false) {
  const db = S.ui.db;
  if (T.game() !== "mtg") return;
  if (next && (db.busy || !db.next || !db.submitted)) return;
  let spec;
  if (next) spec = db.submitted;
  else {
    dbInvalidate();
    try { spec = magicSearchSpec(db.term, db.filters); }
    catch (e) { db.error = e.message; if (S.ui.view === "search") render(); return; }
    db.submitted = spec;
  }
  const generation = db.generation, cursor = next ? db.next : null, abort = new AbortController(), screen=navigationStamp();
  db.abort = abort;
  const current = () => S.ui.db === db && db.generation === generation && db.submitted === spec && T.game() === "mtg" && navigationCurrent(screen);
  db.busy = true;
  db.error = "";
  if (S.ui.view === "search") render();
  try {
    let d, note = next ? db.note || "" : "", requestPath;
    if (next) {
      requestPath = scryfallSearchPath(cursor);
      if (db.pages?.includes(requestPath)) throw Error("The card database repeated a page. Search again to refresh the results.");
      d = await api(requestPath, {signal:abort.signal});
    } else {
      const run = term => api("/cards/search?" + new URLSearchParams({ q: searchQuery(term, spec.filters), unique: "cards", order: spec.order, dir: spec.dir }), {signal:abort.signal});
      try { d = await run(spec.term); }
      catch (e) {
        if (!current()) return;
        const words = spec.term;
        if (spec.syntax || !words.includes(" ") || !/didn.t match any cards|no cards found/i.test(e.message)) throw e;
        d = await run(`o:"${words.replace(/"/g, "")}"`);
        note = `No card names match “${words}”, so these are cards whose text says it.`;
      }
    }
    if (!current()) return;
    if (!Array.isArray(d?.data)) throw Error("The card database returned an incomplete response. Try again.");
    let continuation = d.has_more ? d.next_page : null;
    if (d.has_more && !continuation) throw Error("The card database did not return its next page. Try again.");
    if (continuation) continuation = scryfallSearchPath(continuation);
    const pages = [...(db.pages || []), ...(requestPath ? [requestPath] : [])];
    const repeated = continuation && pages.includes(continuation);
    for (const c of d.data) cacheCard(c);
    const cards = mergeMagicCards(next ? db.results : [], d.data);
    db.results = !next && !spec.filters.sort && !note ? rankByName(cards, spec.term) : cards;
    db.total = Number(d.total_cards) || (next ? db.total : 0) || db.results.length;
    db.next = repeated ? null : continuation;
    db.pages = pages;
    db.note = note;
    if (repeated) db.error = "The card database repeated a page. Showing the unique cards loaded so far; search again to refresh.";
  } catch (e) {
    if (!current()) return;
    db.error = /didn.t match any cards|no cards found/i.test(e.message) ? "No cards match that search." : e.message;
    // Failed pagination preserves its cursor and loaded cards for an explicit retry.
  } finally {
    if (current()) {
      db.busy = false;
      db.abort = null;
      saveCatalogSoon();
      if (S.ui.view === "search") render();
    }
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
      const el = $("#ideasMsg") || $("#content .muted.small[role=status]");
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
  if (!await ask(`Add ${sumQty(picked)} cards to your collection as cards you own?`)) return;
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
  buyMtg(list);
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
// ----- Magic tournament results (TopDeck.gg via the Worker) -----
const mtgMetaFormat = () => (S.ui.mtgMeta ||= { format: DEFAULT_MTG_META_FORMAT }).format;
function loadMtgMeta(force = false) {
  const screen=navigationStamp(), key = "mtg:" + mtgMetaFormat(),
    M = metaState(key);
  if (M.busy || (!force && (M.data || M.error) && (M.data ? Date.now() - M.at < 12 * 3600e3 : true))) return;
  loadMetaData(key, force)
    .then(async (data) => {
      if(navigationCurrent(screen))render();
      // Card data (prices, art, types) for the lists on screen.
      const names = [...new Set(data.decks.slice(0, 30).flatMap((d) => [...d.commanders, ...d.main].map((r) => r.name)))];
      if ((await resolveNames(names)).total && navigationCurrent(screen)) render();
    })
    .catch(() => navigationCurrent(screen) && render());
  setTimeout(()=>navigationCurrent(screen)&&render(), 0);
}
A.mtgMetaFormat = (t) => {
  S.ui.mtgMeta = { format: t.dataset.id };
  render();
  loadMtgMeta();
};
A.mtgMetaReload = () => loadMtgMeta(true);
A.mtgProven = (t) => {
  const captured = t.dataset.homeMetaOpen !== undefined ? homeMetaSnapshot(t, "mtg") : null;
  if (t.dataset.homeMetaOpen !== undefined && !captured) return toast("This Home list has changed. Choose the current visible list.");
  // From a card's Meta tab, the deck may be from another format than the one on Meta decks.
  if (t.dataset.format && metaState("mtg:" + t.dataset.format).data) (S.ui.mtgMeta ||= {}).format = t.dataset.format;
  const fmt = captured ? captured.metaKey.slice(4) : mtgMetaFormat(),
    data = captured?.data || metaState("mtg:" + fmt).data,
    d = captured?.deck || data?.decks.find((x) => x.key === t.dataset.key);
  if (!d) return;
  const appFormat = fmt === "EDH" ? "Commander" : fmt,
    kindOf = (name) => {
      const tl = meta(name)?.type_line || meta(name)?.card_faces?.[0]?.type_line || "";
      return /Land/.test(tl) ? "land" : /Creature/.test(tl) ? "creature" : tl ? "spell" : "card";
    },
    rowsOf = (deck) => [...deck.commanders.map((r) => ({ ...r, commander: true })), ...deck.main].map((r) => ({ key: key(r.name), name: r.name, qty: r.qty, kind: r.commander ? "commander" : r.land ? "land" : kindOf(r.name), price: namePrice(meta(r.name), (finish) => priceOf(r.name, finish)), owned: inv(r.name).owned, core: r.commander })),
    all = data.decks.map(rowsOf),
    seen = new Map();
  for (const l of all) for (const k of new Set(l.map((r) => r.key))) seen.set(k, (seen.get(k) || 0) + 1);
  const label = (MTG_META_FORMATS.find((f) => f[0] === fmt) || [fmt, fmt])[1];
  tcgCtx.openProven({
    g: "mtg",
    key: d.key,
    title: d.name,
    sub: `${esc(d.place)} · ${esc(d.event)} · ${d.players} players${d.player ? " · " + esc(d.player) : ""}${d.record ? " · " + esc(d.record) : ""}${d.date ? " · " + esc(d.date) : ""}`,
    evidence: `Tournament-backed · ${esc(label)} · ${fmt === "EDH" ? "last month" : `last ${data.days} days`} · compared with ${data.decks.length} lists from ${data.coverage?.events || 0} events · ${esc(data.source)}`,
    attribution: `${{ "Magic Online (official decklists)": `Decklist from <a href="https://www.mtgo.com/decklists" target="_blank" rel="noopener">Magic Online</a> (Wizards of the Coast).`, "EDHTop16 (competitive Commander)": `Data from <a href="https://edhtop16.com" target="_blank" rel="noopener">EDHTop16</a>, powered by TopDeck.gg.` }[data.source] || `Data provided by <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a>.`} Prices are Scryfall’s TCGplayer estimates.`,
    sourceUrl: d.url || d.eventUrl,
    sourceLabel: data.source.startsWith("Magic Online") ? "Magic Online event" : data.source.startsWith("EDHTop16") ? "Decklist" : "TopDeck.gg event",
    rowsFn: () => rowsOf(d),
    // The 15-card sideboard travels with the list (not in Commander, which has none).
    sideRowsFn: () => (fmt === "EDH" ? [] : (d.side || []).map((r) => ({ key: key(r.name), name: r.name, qty: r.qty, kind: kindOf(r.name), price: namePrice(meta(r.name), (finish) => priceOf(r.name, finish)), owned: Math.max(0, inv(r.name).owned - sumQty([...d.commanders, ...d.main].filter((m) => key(m.name) === key(r.name)))) }))),
    listsFn: () => data.decks.map(rowsOf),
    // Format staples played across unrelated decks aren't this deck's engine.
    generic: (k) => (seen.get(k) || 0) / Math.max(1, data.decks.length) >= 0.3,
    load: async (status) => {
      const sim = T.similarLists(rowsOf(d), data.decks.map(rowsOf));
      const names = [...new Set([...rowsOf(d), ...sim.flat(), ...(d.side || [])].map((r) => r.name))];
      const refresh = names.filter((name) => { const c = meta(name); return !c || namePrice(c) === null || !c.checkedAt || Date.now() - new Date(c.checkedAt).getTime() > 86400000; });
      const result = await resolveNames(refresh, status, true);
      await ensureTcgPrices(names.map(meta).filter(Boolean), { retry: true });
      return result;
    },
    save: async (rows, labelText) => {
      const commander = rows.find((r) => r.kind === "commander")?.name || "";
      const deck = withSnapshot({ id: uid(), name: `${d.name} · ${labelText}`.slice(0, 100), format: appFormat, commander, strategy: "Auto", budget: S.state.settings.budget ?? 25, locked: false, cards: rows.map((r) => ({ name: r.name, qty: r.qty })), side: fmt === "EDH" ? [] : (d.side || []).map((r) => ({ name: r.name, qty: r.qty })), versions: [], source: sourceCredit({ kind: labelText === "original" ? "Tournament list" : "Adapted tournament list", author: d.player, website: "TopDeck.gg", url: d.eventUrl || d.url, description: `${d.place} at ${d.event} (${d.players} players).` }) }, labelText === "original" ? "From TopDeck.gg" : "Adapted from a tournament list");
      await commit((s) => {
        s.decks.push(deck);
        s.activeDeck = deck.id;
      }, { msg: `Saved “${deck.name}”.` });
      closeSheet();
      go(`#deck/${deck.id}/cards`);
    },
    cardAttrs: (r) => `data-act="card" data-name="${esc(r.name)}"`,
    imageFor: (r) => meta(r.name)?.image_uris?.small || meta(r.name)?.card_faces?.[0]?.image_uris?.small || "",
    heroFor: (rows) => {
      if (d.art) return d.art;
      const c = meta((rows.find((r) => r.kind === "commander") || rows.find((r) => r.kind === "creature") || rows.find((r) => r.kind !== "land") || rows[0])?.name);
      return c?.image_uris?.art_crop || c?.card_faces?.[0]?.image_uris?.art_crop || (d.cover ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(d.cover)}&format=image&version=art_crop` : "");
    },
  });
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
  download(`CardStashy_${fileSafe(r.name)}.txt`, exportDeckText(r) + "\n");
};
A.deleteRef = async (t) => {
  if (!await ask("Remove this saved idea?")) return;
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
    const basePower=mtgPower(d);
    for (const b of [...new Set([0, 10, 25, 50, 100, U.budget])]) {
      const plan = upgradeSuggestions(d, S.state.collection, S.state.decks, S.catalog, { budget: b, simple: U.simple, maxSwaps: 8 });
      // Evaluate the evolving list: a collection of individually good swaps can still conflict.
      let next=d;
      plan.swaps=plan.swaps.filter(s=>{
        const trial={...next,cards:applySwapsToCards(next.cards,[s])},before=mtgPower(next),after=mtgPower(trial);
        if(comparePower(after,before)<=0)return false;
        s.powerBefore=before.score;s.powerAfter=after.score;next=trial;return true;
      });plan.powerBefore=basePower.score;plan.powerAfter=mtgPower(next).score;
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
C.upTrade = (t) => {
  S.ui.upgrade.tradeIn = t.checked;
  render();
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
  buyMtg(buy);
};
A.upApply = async () => {
  const U = S.ui.upgrade,
    d = currentDeck(),
    swaps = pickedSwaps();
  if (!swaps.length) return toast("Tick at least one swap.");
  if (U.base !== JSON.stringify(d.cards)) return toast("The deck changed — find upgrades again.");
  const result = applyUpgradeSwaps(d, swaps, S.state.collection, S.state.decks, S.catalog, U.budget),
    budgetLabel = U.budget ? "$" + U.budget : "$0";
  if(comparePower(mtgPower(result.deck),mtgPower(d))<0)return toast("These selected swaps lower Power together. Review the combination before applying.");
  let beforeId;
  await editDeck((x) => {
    const before = withSnapshot(x, "Before " + budgetLabel + " upgrade");
    beforeId = before.versions.at(-1).id;
    return withSnapshot(
      { ...before, cards: result.deck.cards, upgradeHistory: [...(x.upgradeHistory || []), { date: new Date().toISOString(), budget: U.budget, swaps, estimatedSpend: result.spent }] },
      `${budgetLabel} upgrade · ${swaps.length} swap${swaps.length > 1 ? "s" : ""}`,
      { spent: result.spent },
    );
  }, { rerender: false, undo: `Applied ${swaps.length} swap${swaps.length > 1 ? "s" : ""}. Here’s your before → after.` });
  U.plans = {};
  U.selected = new Set();
  S.ui.versions = { a: beforeId, b: "current" };
  go(`#deck/${d.id}/versions`);
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
  if (!v || !await ask(`Restore “${v.label}”? Your current list is saved as a version first.`)) return;
  await editDeck((x) => ({ ...withSnapshot(x, "Before restoring " + v.label), cards: structuredClone(v.cards), side: structuredClone(v.side || []) }), { msg: "Version restored." });
};
A.deleteVer = async (t) => {
  if (!await ask("Delete this saved version?")) return;
  await editDeck((x) => ({ ...x, versions: (x.versions || []).filter((v) => v.id !== t.dataset.id) }));
};

/* Playtest */

const library = (d) => d.cards.filter((c) => !hasCommander(d) || key(c.name) !== key(d.commander));
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
  const d = currentDeck(),
    note = { id: uid(), deckId: d.id, sig: cardSig(d.cards), date: new Date().toLocaleDateString(), author: "", table: "", result: $("#logResult").value, turn: Number($("#logTurn").value) || null, note: $("#logNote").value.trim().slice(0, 1000) };
  await commit((s) => s.notes.push(note), { msg: "Game saved." });
};

/* ---------- life tracker ---------- */
A.lifeStart = (t) => {
  S.ui.life = newGame(Number(t.dataset.n) || 4, formatOf(currentDeck()).life);
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
A.lifeEnd = async () => {
  if (!await ask("End this game without logging it?")) return;
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

// Matching for the scanner (Magic). The scanner itself lives in scancam.js and is shared by all games.
const mtgScanCand = (c, why, exact) => {
  cacheCard(c);
  return { id: c.id, name: c.name, image: c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || "", sub: `${c.set_name} · ${c.set.toUpperCase()} #${c.collector_number}`, why, exact, owned: inv(c.name).owned, card: c };
};
// Every paper printing of a scanned card, with a small picture for matching the artwork.
async function mtgScanPrintings(cand) {
  const oid = cand.card?.oracle_id;
  if (!oid) return [];
  const r = await api("/cards/search?" + new URLSearchParams({ q: `oracleid:${oid} game:paper`, unique: "prints", order: "released", dir: "desc" })).catch(() => null);
  return (r?.data || [])
    .map((c) => ({ id: c.id, thumb: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || "", card: c }))
    .filter((p) => p.thumb);
}
// No readable name: find the card from phrases of its rules or flavour text. A phrase that
// matches only a few cards is a strong hint; names hinted by several phrases come first.
async function mtgScanByText(phrases, full = "") {
  const ps = [...new Set(phrases.map((x) => x.replace(/["’]/g, "").trim()).filter(Boolean))];
  if (!ps.length) return [];
  // One search for every phrase at once; each card is then scored by the phrases its own text
  // contains, rare phrases counting most (a misread phrase simply matches nothing).
  const r = await api("/cards/search?" + new URLSearchParams({ q: `game:paper (${ps.map((x) => `o:"${x}" or ft:"${x}"`).join(" or ")})`, unique: "cards" })).catch(() => null);
  if (!r?.data?.length || r.total_cards > 175) return [];
  const text = (c) => [c.oracle_text, c.flavor_text, ...(c.card_faces || []).flatMap((f) => [f.oracle_text, f.flavor_text])].filter(Boolean).join(" ").toLowerCase().replace(/[’']/g, ""),
    texts = r.data.map((c) => [c.name, text(c)]),
    df = Object.fromEntries(ps.map((x) => [x, texts.filter(([, t]) => t.includes(x.toLowerCase())).length])),
    // A card usually names itself in its text ("Lightning Bolt deals 3 damage"): those first.
    said = (n) => n.split(" // ").some((f) => f.length > 3 && scanKey(full).includes(scanKey(f)));
  return texts
    .map(([n, t]) => [n, ps.reduce((sc, x) => sc + (t.includes(x.toLowerCase()) ? 1 / df[x] : 0), 0)])
    .filter(([, sc]) => sc > 0)
    .sort((x, y) => said(y[0]) - said(x[0]) || y[1] - x[1])
    .map((x) => x[0])
    .slice(0, 5);
}
const scanKey = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
async function mtgScanMatch(read, lang, manual = false, prefs = {}, control = null) {
  const lookup=(key,fn)=>Promise.resolve().then(()=>control?control.run(JSON.stringify(["mtg",...key]),fn):fn()).catch(e=>{if(control&&/^SCAN_/.test(e.code||""))throw e;return null;});
  const out = [],
    seen = new Set(),
    tried = [],
    push = (c, why, exact) => {
      if (!c?.name || seen.has(c.id) || out.length >= 3) return;
      seen.add(c.id);
      out.push(mtgScanCand(c, why, exact));
    };
  let limited=false;
  try {
  // The set code + collector number at the bottom identify the exact printing.
  const at = manual ? null : mtgCollector(`${read.code}\n${read.full}`);
  if (at) {
    tried.push(`${at.set.toUpperCase()} #${at.number}`);
    for (const l of lang.includes("jpn") ? ["ja", ""] : [""]) {
      const c = await lookup(["printing",at.set,at.number,l],()=>api(`/cards/${encodeURIComponent(at.set)}/${encodeURIComponent(at.number)}${l ? "/" + l : ""}`));
      if (c?.name) {
        push(c, `Set ${at.set.toUpperCase()} #${at.number}`, true);
        break;
      }
    }
  }
  // Then plausible names from the name strip, one at a time (never the whole noisy string).
  for (const n of manual ? [read.name] : nameCandidates("mtg", read.name || read.full)) {
    if (out.length >= 3) break;
    // A piece of a name already found ("Elves" after Llanowar Elves) would only add noise.
    if (out.some((o) => key(o.name).includes(key(n)))) continue;
    tried.push(n);
    // Lock set: look the name up in that set first.
    const locked = prefs.lockSet ? await lookup(["name",n,prefs.lockSet],()=>api("/cards/named?" + new URLSearchParams({ fuzzy: n, set: prefs.lockSet }))) : null;
    let c = locked || (await lookup(["name",n],()=>api("/cards/named?" + new URLSearchParams({ fuzzy: n }))));
    // Ignore promos: prefer the regular printing of the same card.
    if (c && prefs.ignorePromos && (c.promo || c.set_type === "promo")) {
      const r = await lookup(["regular",c.name],()=>api("/cards/search?" + new URLSearchParams({ q: `!"${c.name}" -is:promo -st:promo`, order: "released", dir: "desc" })));
      if (r?.data?.[0]) c = r.data[0];
    }
    // A short fragment ("wel") is not identification: closest-spelling hits need a real word.
    if (c?.name && (key(c.name) === key(n) || manual || key(n).length >= 5)) push(c, key(c.name) === key(n) ? "Name match" : `Closest name to “${n}”`, false);
  }
  }catch(e){if(!control||e.code!=="SCAN_BUDGET"||!out.length)throw e;limited=true;}
  return { cands: limited?out.map(c=>({...c,exact:false})):out, tried,...(limited?{budgetLimited:true}:{}) };
}
async function mtgScanAdd(cand) {
  const c = cand.card;
  await commit(
    (s) => {
      s.collection.push({ id: uid(), name: c.name, qty: 1, set: c.set.toUpperCase(), setName: c.set_name, collectorNumber: c.collector_number, finish: "nonfoil", language: c.lang || "en", condition: "Near Mint", location: "", reserved: 0, printingId: cand.exact ? c.id : null, oracleId: c.oracle_id, printingVerified: !!cand.exact, nameVerified: true, raw: { acquisition: "Scanned" } });
    },
    { undo: `Added 1 × ${c.name}${cand.exact ? ` (${c.set.toUpperCase()} #${c.collector_number})` : ""}.` },
  );
}
// Save a whole scan session at once (one undo), with each row's finish, condition, language and quantity.
async function mtgScanAddMany(items) {
  if (!Array.isArray(items) || !items.length || items.some((it) => {
    const c = it.cand?.card;
    return !c?.id || !c.name || (it.cand.game && it.cand.game !== "mtg") ||
      !(it.cand.exact || it.cand.printingConfirmed) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 100000 ||
      !["nonfoil", "foil", "etched"].includes(it.finish) || !c.finishes?.includes(it.finish) ||
      (it.captureId != null && (typeof it.captureId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(it.captureId)));
  })) throw Error("Confirm each card's exact printing and finish before saving this scan batch.");
  const n = items.reduce((t, x) => t + x.qty, 0);
  await commit(
    (s) => {
      for (const it of items) {
        const c = it.cand.card, captureId = it.captureId || "";
        const prior = captureId && [...s.collection, ...Object.values(s.tcg || {}).flatMap(g => g.collection || [])].find(e => e.scanCaptureId === captureId);
        if (prior) {
          if (prior.printingId !== c.id || prior.finish !== it.finish || prior.qty !== it.qty || prior.language !== (it.lang || c.lang || "en") || prior.condition !== (it.condition || "Near Mint")) throw Error("This capture is already saved with different details. Check its collection entry before trying again.");
          continue;
        }
        s.printings ||= {};
        s.printings[c.id] = slim({ ...c, conditionQuotes: c.conditionQuotes || s.printings[c.id]?.conditionQuotes });
        s.collection.push({ id: uid(), scanCaptureId: captureId, name: c.name, qty: it.qty, set: c.set.toUpperCase(), setName: c.set_name, collectorNumber: c.collector_number, finish: it.finish, language: it.lang || c.lang || "en", condition: it.condition || "Near Mint", location: it.location || "", reserved: 0, printingId: c.id, oracleId: c.oracle_id, printingVerified: !!(it.cand.exact || it.cand.printingConfirmed), nameVerified: true, raw: { acquisition: "Scanned" } });
      }
    },
    { undo: `Added ${n} scanned card${n === 1 ? "" : "s"}.` },
  );
}
const mtgScanPrice = (cand, finish, selection = {}) => {
  const card=cand.card,p=card?.prices||{},v=finish==="foil"?p.usd_foil:finish==="etched"?p.usd_etched:p.usd;
  return conditionValue(v==null||v===""?null:Number(v),{...selection,printingId:card?.id||"",finish},card?.conditionQuotes||[]).price;
};
const scannerPrintingPicker = createScannerPrintingPicker({
  openPicker: config => printingPicker.open(config), requestMagic: api, sources: T.SOURCES,
  ensureCard: (g,id) => T.ensureCard(g,id,false,false),
  getCatalogue: g => g === "mtg" ? [] : g === "ygo" ? T.currentYgoCatalogue() : T.ui(g).sets.list,
  loadCatalogue: async g => { await tcgCtx.loadSets(g); return g === "ygo" ? T.currentYgoCatalogue() : T.ui(g).sets.list; },
  projectCard: (g,c,r,catalogue,options) => T.setContextCard(g,c,r,catalogue,options)
});
const scanCtx = {
  A,
  C,
  openSheet: (...x) => openSheet(...x),
  closeSheet: () => closeSheet(),
  addMany: (g, items) => (g === "mtg" ? mtgScanAddMany(items) : tcgCtx.scanAddMany(items, g)),
  priceOf: (g, cand, finish, selection = {}) => (g === "mtg" ? mtgScanPrice(cand, finish, selection) : tcgCtx.scanPrice?.(cand, finish, selection) ?? null),
  requestConditionPrice: (g,cand,finish,selection,done,current) => {
    const card=cand.card;
    if(!card||!finish||cand.localReference||cand.detailsOnly||!(cand.exact||cand.printingConfirmed))return;
    const [printing,rarity]=String(cand.print||'').split('|');
    const entry=g==='mtg'?{...selection,printingId:card.id,printingVerified:true,finish}:
      {...selection,cardId:card.id,...(g==='ptcg'?{variant:finish}:{printing:printing||'',rarity:rarity||'',edition:finish,setReleaseId:cand.setReleaseId||'',setReleaseUnverified:!!cand.setReleaseUnverified})};
    return fetchConditionValue(card,entry,g,done,{source:'review',current});
  },
  openPrintingPicker: config => scannerPrintingPicker.open(config),
  setOf: (g, cand) => (g === "mtg" ? cand.card?.set || "" : g === "ygo" ? String(cand.print || "").split("|")[0].split("-")[0] : cand.card?.set?.id || ""),
  numberOf: (g, cand) => (g === "mtg" ? cand.card?.collector_number || "" : g === "ygo" ? String(cand.print || "").split("|")[0] : cand.card?.set?.number || ""),
  render: () => render(),
  toast: (m) => toast(m),
  game: () => T.game(),
  match: (g, read, lang, manual, status, prefs = {}, control = null) => (g === "mtg" ? mtgScanMatch(read, lang, manual, prefs, control) : tcgCtx.scanMatch(read, lang, manual, status, g, control)),
  add: (g, c) => (g === "mtg" ? mtgScanAdd(c) : tcgCtx.scanAdd(c)),
  byText: (g, full) => (g === "mtg" ? mtgScanByText(textPhrases(full, 12), full) : tcgCtx.scanByText?.(g, full) ?? []),
  printings: (g, cand) => (g === "mtg" ? mtgScanPrintings(cand) : tcgCtx.scanPrintings?.(g, cand) ?? []),
  candById: async (g, id, why, exact, options = {}) => (g === "mtg" ? api("/cards/" + encodeURIComponent(id)).then((c) => mtgScanCand(c, why, exact)).catch(() => null) : tcgCtx.scanCandById?.(g, id, why, exact, options) ?? null),
  candOf: async (g, p, why, exact) => (g === "mtg" ? (p.card ? mtgScanCand(p.card, why, exact) : null) : tcgCtx.scanCandById?.(g, p.id, why, exact) ?? null),
  details: (g, c) => (g === "mtg" ? A.card({ dataset: { name: c.name } }) : A.tCard({ dataset: { id: c.id } })),
};
registerScanner(scanCtx);

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
  download("CardStashy_Backup_" + new Date().toISOString().slice(0, 10) + ".json", backupPayload(), "application/json");
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
    if (!await ask(`Replace everything here with ${sumQty(next.collection)} cards and ${next.decks.length} decks from the backup? The current data is kept as a recovery copy.`)) return;
    for (const [k, c] of Object.entries(cache)) if (!S.catalog[k]) S.catalog[k] = slim(c);
    S.catalogDirty = true;
    await replaceWorkspace(next, { recovery: true });
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
  if (!await ask(`Switch to the recovery copy (${sumQty(next.collection)} cards, ${next.decks.length} decks)? What you have now becomes the recovery copy.`)) return;
  await replaceWorkspace(next, { recovery: true });
  render();
  toast("Recovery copy restored.");
};
A.reset = async () => {
  if (!await ask("Clear this device and sign out? Any existing account copy stays separate. A recovery copy is kept here; export a backup first if your latest changes have not synced.")) return;
  if (cloudInfo().user) await signOut();
  detachDeviceSync();
  clearAskConversations();
  clearRulesConversations();
  rulesGuideOrigin = null;
  await replaceWorkspace(blank(), { recovery: true });
  go("#home");
};
A.loadExample = async () => {
  const hasData = [S.state, ...Object.values(S.state.tcg || {})].some((game) => ["collection", "decks", "wishlist", "references", "notes"].some((field) => game[field]?.length));
  if (hasData && !await ask("Replace all collections, decks, wishlists and notes across every game with example data? Your current workspace becomes the recovery copy.")) return;
  const names = ["Krenko, Mob Boss", "Goblin Instigator", "Sol Ring", "Arcane Signet", "Talrand, Sky Summoner", "Counterspell", "Mountain", "Island"];
  const st = blank();
  st.example = true;
  st.collection = names.filter((n) => meta(n)).map((n) => ({ id: uid(), name: n, qty: ["Mountain", "Island"].includes(n) ? 12 : 1, set: "", collectorNumber: "", finish: "nonfoil", condition: "Near Mint", language: "en", location: "Example", reserved: 0, printingVerified: false, raw: {} }));
  await replaceWorkspace(st, { recovery: true, notify: true });
  go("#collection");
};
A.persist = async () => {
  toast((await requestPersistence()) ? "The browser will keep your data. Still export backups." : "The browser declined. Export backups regularly.");
  storageDetail();
};
A.install = async () => {
  if (!(await promptInstall())) toast(isIOS() ? "In Safari, tap Share, then Add to Home Screen." : "Use your browser menu, then Add to Home screen.");
  if (S.ui.view === "home") render();
};
// Price alerts (all games).
A.priceAlert = (t) => {
  const { game: g, id, name } = t.dataset;
  const card=g==='mtg'?meta(name):T.cardOf(g,String(id).split('|')[0]),finish=String(id).split('|')[1] || (g==='mtg'?'nonfoil':'reference'),value=priceSeries(g,id).at(-1)?.[1] ?? quoteModel(g,card,finish)?.value ?? null;
  openSheet(alertSheet(g, id, name || "This card", value), { type: "alert", back:S.ui.sheetCtx });
};
A.priceAlertSave = async (t) => {
  const { game: g, id, name } = t.dataset,
    num = (x) => (x === "" || x == null || !(Number(x) > 0) || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100),
    below = num($("#alertBelow")?.value),
    above = num($("#alertAbove")?.value);
  const error=$("#priceAlertError"),alertCtx=S.ui.sheetCtx;
  if(below==null&&above==null){if(error)error.textContent="Enter a price above $0 in either field.";$("#alertBelow")?.focus();return;}
  if(below!=null&&above!=null&&below>=above){if(error)error.textContent="The lower price must be less than the upper price.";return;}
  setAlert(g, id, name, { below, above });
  // Ask once, while the tap counts as permission to ask.
  if (globalThis.Notification?.permission === "default") void Notification.requestPermission().catch(() => {});
  if(S.ui.sheetCtx===alertCtx){if(alertCtx?.back&&['card','tcard','buy','market'].includes(alertCtx.back.type)){openSheet('',alertCtx.back);refreshSheet();}else closeSheet();}
  toast("Alert saved. Checked while you use the app; no background monitoring.");
  render();
};
A.priceAlertClear = (t) => {
  setAlert(t.dataset.game, t.dataset.id, "", {});
  closeSheet();
  toast("Alert removed.");
  render();
};
onAlert((f) => {
  toast(alertText(f));
  try {
    if (globalThis.Notification?.permission === "granted") new Notification("CardStashy price alert", { body: alertText(f), icon: "icon-192.png", tag: `${f.game}:${f.id}` });
  } catch {}
});
C.setHaptics = (t) => {
  setHaptics(t.checked);
  if (t.checked) haptic("success");
};
A.installLater = () => {
  dismissInstall();
  render();
};
onInstallable(() => S.ui.view === "home" && render());
async function storageDetail() {
  const s = await persistenceStatus(),
    el = $("#storageDetail");
  if (el) el.textContent = `${s.backend} · ${s.persistent ? "protected from cleanup" : "may be cleared by the browser if storage runs low"}${s.usage !== undefined ? ` · ${(s.usage / 1048576).toFixed(1)} MB used` : ""}.`;
}

/* =========================================================
   Boot
   ========================================================= */

function trackValue() {
  for (const g of ["ptcg", "ygo"]) T.trackTcgValue?.(g);
  const v = collectionValue(S.state.collection, S.catalog, S.state.printings, []);
  if (!S.state.collection.length) return;
  S.state.valueHistory = recordValuePoint(S.state.valueHistory, v.total, v.copies, homeValueCoverage(v));
}

// Background loads in game modules ask for a redraw.
globalThis.addEventListener?.("cardstashy-rerender", () => S.ui.view === "home" ? refreshHomeValueGlance() : render());
// Shared daily prices arrive in the background: redraw whichever price chart is open.
onSharedPrices(() => {
  refreshHomeValueGlance();
  const ctx = S.ui.sheetCtx;
  if (!ctx || !$("#sheet")?.open) return;
  if (ctx.type === "market") A.marketRange?.({ dataset: { range: ctx.range || "30" } });
  else if (["card", "tcard", "buy"].includes(ctx.type)) refreshSheet();
});
// Owned Magic and Yu-Gi-Oh! cards get daily server-side price history (sent at most every 20 days).
function watchCollectionPrices() {
  try {
    watchCards("mtg", S.state.collection.map((e) => e.printingId || meta(e.name)?.id).filter(Boolean));
    watchCards("ygo", (S.state.tcg?.ygo?.collection || []).map((e) => e.cardId).filter(Boolean));
  } catch {}
}
async function boot() {
  setTimeout(watchCollectionPrices, 8000);
  // The reference catalog never holds up the first screen: on a slow connection the app opens
  // with saved cards and adds the catalog when it arrives.
  const addRef = (ref) => { for (const c of ref?.cards || []) if (!S.catalog[key(c.name)] || (S.catalog[key(c.name)].checkedAt || "") < ref.snapshot_date) S.catalog[key(c.name)] = slim({ ...c, checkedAt: ref.snapshot_date }); };
  try {
    const r = await fetch("catalog.json", { signal: AbortSignal.timeout(2500) });
    if (r.ok) addRef(await r.json());
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") fetch("catalog.json").then((r) => (r.ok ? r.json() : null)).then((late) => { if (late) { addRef(late); if (S.ui.view === "home") refreshHomeValueGlance(); else render(); } }).catch(() => {});
  }
  try {
    const cat = await readRecord(CATALOG_RECORD);
    if (cat && typeof cat === "object") Object.assign(S.catalog, cat);
  } catch {}
  await T.loadCache(readRecord);
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
        S.state.collection = Object.values(legacy.collection).filter((c) => c.qty > 0).map((c) => ({ id: uid(), name: c.name, qty: c.qty, set: "", collectorNumber: "", finish: "nonfoil", condition: "Near Mint", language: "en", location: "Earlier CardStashy", reserved: c.reserved || 0, printingVerified: false, raw: {} }));
    } catch {}
  }
  const restored=historyEntry(history.state,location.hash);
  if(restored)S.state.settings.game=restored.game;
  activeEntry=restored || makeEntry(T.game(),normalizeRoute(location.hash),0);
  replaceEntry(activeEntry);
  trackValue();
  await save();
  // No navigation may write the blank workspace while boot is reading storage.
  // Re-read history after the await: a Back/Forward during startup owns this visit.
  const latest=historyEntry(history.state,location.hash);
  navigationReady=true;
  decorateShell();
  await navigate({game:latest?.game || T.game(),hash:normalizeRoute(location.hash),entry:latest || makeEntry(T.game(),normalizeRoute(location.hash),0),mode:"boot"});
  loadSetIndex(); // cached set symbols first; refreshes from Scryfall every few days
  render();
  // First visit opens automatically; replay is available in Settings.
  {
    const cards = S.state.collection.length + ["ptcg", "ygo"].reduce((n, g) => n + T.gs(g).collection.length, 0),
      decks = S.state.decks.length + ["ptcg", "ygo"].reduce((n, g) => n + T.gs(g).decks.length, 0);
    if (shouldTour({ cards, decks }) && !location.hash.startsWith("#shared")) setTimeout(() => openTour(tourArt()), 600);
  }
  observeShellHeader();
  $("#app").classList.add("ready");
  initCloud({
    accountChanged: () => { clearAskConversations(); clearRulesConversations(); rulesGuideOrigin = null; },
    passwordRecovery: () => { S.ui.settingsTab = "account"; go("#settings"); },
    getState: () => stripCache(S.state),
    // Replace this device's workspace with the account copy.
    apply: async (data) => {
      const owner = cloudInfo().user?.id;
      const applied = await replaceWorkspace(data, {
        recovery: (state) => !isEmptyWorkspace(state),
        // Account changes while this operation waits must not load the old account.
        guard: () => !!owner && cloudInfo().user?.id === owner,
      });
      if (!applied) return;
      render();
      setTimeout(autoEnrich, 200);
    },
    backup: async (state, label, file) => {
      await writeRecord(RECOVERY, state).catch(() => {});
      if (file) download(`CardStashy_Backup_${fileSafe(label)}_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backupEnvelope(state)), "application/json");
    },
    status: ([text, cls]) => setSaveStatus(text, cls),
    changed: () => {
      if (S.ui.view === "settings") render();
    },
    decide: (p) => openSheet(V.syncDecideSheet(p, stripCache(S.state)), { type: "sync" }),
  }).catch(() => {});
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  // Scryfall role tags arrive after first paint; redraw Magic pages so Deck Power counts them.
  // TCGplayer prices for printings Scryfall leaves unpriced arrive in the background.
  window.addEventListener("cf:tcg-prices", () => { refreshHomeValueGlance(); if (S.ui.sheetCtx?.type === "card" && $("#sheet").open) refreshSheet(); else if (S.ui.view !== "home") render(); });
  window.addEventListener("cf:mtg-tags", () => { if ((S.state.settings?.game || "mtg") === "mtg") render(); });
  window.addEventListener("online", () => {
    setSaveStatus("Online", "ok");
    autoEnrich();
  });
  setTimeout(autoEnrich, 400);
  window.addEventListener("offline", () => setSaveStatus("Offline", "bad"));
}

boot().catch((e) => {
  $("#content").innerHTML = `<section class="empty"><h3>CardStashy couldn’t open your saved data</h3><p>${esc(e.message)}</p><p class="muted small">Nothing was deleted. Close other CardStashy tabs and retry.</p><button class="btn" onclick="location.reload()">Retry</button></section>`;
});

C.tradeOption=t=>{const ctx=S.ui.sheetCtx;if(!['card','tcard'].includes(ctx?.type))return;const f=t.dataset.field;if(!['mode','tolerance','credit','valuation','targetEntry'].includes(f))return;ctx.tradeOptions ||= {};ctx.tradeOptions[f]=['mode','valuation','targetEntry'].includes(f)?t.value:Number(t.value);refreshSheet();};
