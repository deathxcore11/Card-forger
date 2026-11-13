// The site's Collection Home for the native app: app.js's own wiring (normalize, resolveNames) and the Home models
// (views.js home(), home-ui.js) around the web modules, bundled unchanged for QuickJS (CollectionEngine.kt).
// Nothing is decided here: every number, list and order comes from the site's functions; this file only calls them
// and hands their models to the app instead of HTML.
import {S, blank, meta, cacheCard, slim, inv, uid} from 'WEB/store.js';
import {cardKey, typeText, cardPrice, mergeDeckCard, exportDeckText, exportDeck, sumQty, aggregateCards, physicalRequirements} from 'WEB/core.js';
import {validateWorkspace, parseImport, previewImport, printingState, exportCollectionCSV, importErrorsCSV, applyImport, deckRowsFromImport, backupEnvelope} from 'WEB/confidence.js';
import {recoverySummary} from 'WEB/recovery-store.js';
import {normalizeHomeDeckActivity, recordHomeDeckWork} from 'WEB/home-deck-activity.js';
import {collectionValue, recordValuePoint, withSnapshot} from 'WEB/insights.js';
import {homeValueCoverage, homeValueModel, homeMetaKey, homeMetaSlides, homeMetaArticle, homeMetaCarousel, homeDeckShelf, homeCommunity, featureArticle} from 'WEB/home-ui.js';
import {heroFor, loadHero, homeHero, homeToday} from './tcg-daily-hero.mjs';
import {dailyDetails, todaySetMarkup, todayPackMarkup} from 'WEB/home-today.js';
import {hintPool, SEARCH_PROMPT} from 'WEB/search-hints.js';
import {useMyPrices, ensureTcgPrices} from 'WEB/mtg-tcgprice.js';
import {formatOf, FORMATS, hasCommander, canLead, verifyLeader, sizeLabel} from 'WEB/formats.js';
import {art, esc, registerSetIcons, usd, options as htmlOptions, safeHref, segmented} from 'WEB/ui.js';
import {rankHomeCards, homeResultRow} from 'WEB/home-search.js';
import {recentSearches, rememberSearch} from 'WEB/suggest.js';
import {privateKey as scopedKey} from 'WEB/account-scope.js';
import {createScryfallClient} from 'WEB/scryfall-client.js';
import {loadMeta, metaState, allCachedMeta} from 'WEB/meta.js';
import {mtgMetaKey} from 'WEB/power.js';
import {loadCommunity, communitySlides} from 'WEB/community-feed.js';
import {loadPulse} from 'WEB/news-pulse.js';
import {collection as collectionPage, decks as decksView, deckPage as deckView, cardSheet as cardView, buySheet as buyView, setsPage as setsView, setPage as setView, rowsFor} from 'WEB/views.js';
import {loadMagicPrintingPage, mergeMagicCards, searchQuery, rankByName, magicFilterError, hasMagicSearchQuery, magicSearchSpec, scryfallSearchPath} from 'WEB/catalog-tools.js';
import {search as searchView, mtgFilterChips, compareSheet as compareSheetView} from 'WEB/views.js';
import {tcgCompareSheet} from 'WEB/tcgcompare.js';
import {magicOwnedDetail, magicOwnedContext, magicOwnedCurrent, magicOwnedCard} from 'WEB/magic-owned-detail.js';
import {scanView, registerScanner} from 'WEB/scancam.js';
import {addScannedEntry} from 'WEB/collection-stack.js';
import {createScannerLookup} from 'WEB/scanner-lookup.js';
import {mtgCollector, nameCandidates, textPhrases} from 'WEB/scan.js';
import {cloudInfo} from 'WEB/cloud.js';
import {createMtgWikiPageController, mtgWikiPageMarkup} from 'WEB/mtg-wiki-ui.js';
import {sharedBinderRows, sharedBinderValue, sharedDeckCopy, showcaseItem, repairOwnShowcase} from 'WEB/community-profile.js';
import {binderPage, coverImages, binderMatches, binderFavorites, binderCoverState, BINDER_COLORS, MAX_FAVORITES} from 'WEB/binders.js';
import {selectPreviewFinish, finishAttrs} from 'WEB/finish-preview.js';
import {selectedFinish, quoteForContext, conditionBuyLink} from 'WEB/pricing-presentation.js';
import {conditionName, conditionValue, conditionPriceHtml, conditionManualPlaceholder, lastKnownConditionQuote, conditionQuoteTiming} from 'WEB/condition-value.js';
import {configureConditionAuth, clearConditionAttempts, forgetConditionAttempt, loadConditionQuotes, applyConditionQuotes, conditionRequest, conditionQuoteEntry, CONDITION_IDENTITY} from 'WEB/condition-feed.js';
import {createConditionRefreshScheduler, changedConditionLots, conditionLotIdentity} from 'WEB/condition-refresh-scheduler.js';
import {locationPicker, rememberLocation} from 'WEB/collection-locations.js';
import {acquireMissing, parseDeckImport} from 'WEB/deck-flow.js';
import {alerts as priceAlerts, alertFor, setAlert, onAlert, alertText, priceSeries, recordCardPrice} from 'WEB/pricehist.js';
import {sharedPoints, loadSharedPoints, mergePoints} from 'WEB/sharedprices.js';
import {cardDiscoverySpec} from 'WEB/card-discovery.js';
import {ruleCardContext} from 'WEB/rule-dex.js';
import {quoteModel, recordQuote, HISTORY_RANGES, modeFor, selectionState, registerWorkbench} from 'WEB/workbench-ui.js';
import {setHistoryRefresh} from 'WEB/shared-history.js';
import {loadSharedHistory} from 'WEB/shared-history.js';
import {playedAlongside} from 'WEB/guide.js';
import {mtgPairQueries, rankPairs, edhPop} from 'WEB/pairing.js';
import {ICON, actionIcon} from 'WEB/icons.js';
import {contextAction, contextHeader, deckContextShortcuts} from 'WEB/card-actions.js';
import {deckBoxMarkup, deckBoxFields, boxAppearance} from 'WEB/deck-box.js';
import {registerTcg, tcgSets as tcgSetsView, tcgSet as tcgSetView, ui as tcgUi, cardOf as tcgCardOf, SOURCES as tcgSources, cache as tcgCache, ensureCard as tcgEnsureCard, gs as tcgGs, tcgCardSheet, setContextCard as tcgSetContextCard, currentYgoCatalogue as tcgYgoCatalogue, trackTcgValue, tcgSearch as tcgSearchView, savedSearches, setSavedSearches, collectionValue as tcgCollectionValue, persistQuoteCache as tcgPersistQuoteCache, entryPrice as tcgEntryPrice, referenceEntryPrice as tcgReferenceEntryPrice, tcgHome, tcgCollection, tcgDecks, tcgDeck, readTcgValueHistory, loadCache as tcgLoadCache, ensureMany as tcgEnsureMany, needsCardRefresh as tcgNeedsRefresh} from 'WEB/tcg.js';
import {adjustOwnedLot} from 'WEB/quick-quantity.js';
import {workspaceSig, isEmptyWorkspace} from 'WEB/cloud.js';
import {mergeAccountWorkspaces, workspaceContentSig} from 'WEB/sync-merge.js';
import {packArtUrl, samplePack, packSize, packRarity, packFinishes, packPrice, trustedPackPrice, packRevealHaptic, packFinishLabel, packNeedsHydration, godPackText, collectorText, packRandom, ptcgSetRarities, rollYgoPrinting, packHitFinish} from 'WEB/pack-preview.js';
import {loadMtgBooster, mtgBoosterCards, drawMtgBooster, mtgGodPackPicks, GOD_PACK_ODDS as MTG_GOD_ODDS} from 'WEB/mtg-boosters.js';
import {COLLECTOR_ODDS, collectorPicks, PLAY_FORMATS} from 'WEB/play-econ-rules.js';
import {TIERS, priceTier} from 'WEB/tier.js';
import {packEligible, setImageUrl, setArtworkSources} from 'WEB/set-experience.js';
import {packTemplateArt, packArtSources} from 'WEB/pack-wrappers.js';
import {pkCatalogueSymbolSources, pkRarity} from 'WEB/emblems.js';
import {rarityKind} from 'WEB/rarity-emblem.js';
import {cardImage, img as imgHtml} from 'WEB/ui.js';
import {artworkHTML, artworkSources} from 'WEB/artwork.js';
import {deckCardCategory} from 'WEB/deck-viewer.js';
import {massEntryUrl} from 'WEB/buy.js';
import {interactiveRules, attachRuleLearning, openRuleReference} from 'WEB/rule-learning.js';
import {rulesPage, learnSheet} from 'WEB/rules.js';
import {showRuleHint} from 'WEB/rule-dex.js';
import {rollDice, warChestMarkup, chestResume} from 'WEB/war-chest.js';
import {profileOf, simulateMatchup, podProfile, calibratePods} from 'WEB/matchup.js';
import {fieldStore, calibrateField} from 'WEB/matchups-ui.js';
import {mtgConstructedPower} from 'WEB/deckpower.js';
import {podSpeed, newGame, proxyList, proxySheetHTML} from 'WEB/extras.js';
import {formatUpgrades, applyFormatSwap} from 'WEB/format-upgrades.js';
import {upgradeSuggestions, sourceCredit, mtgjsonDeck, collectionIdeas} from 'WEB/strategy.js';
import {applySwapsToCards, cardSig} from 'WEB/insights.js';
import {redealCoachHand} from 'WEB/ai-review.js';
import {comparePower, bestBudgetDecks, purchaseCost, refineCandidates, towardDeck, spendUp, cardQuality, budgetNotes, variantsFrom, difficultyOf} from 'WEB/deck-optimizer.js';
import {playRate} from 'WEB/importance.js';
import {forgeOptions, newForgeSeed} from 'WEB/deck-forge.js';
import {refreshCheapest} from 'WEB/mtg-cheap.js';
import {themeQueries, buildTiers, BUDGET_TIERS, upgradePool, copyLimit, fitFor} from 'WEB/builder.js';
import {findCheapestPrinting} from 'WEB/mtg-cheap.js';
import {commanderTheme, completionPlan} from 'WEB/planner.js';
import {ideaSheet as ideaSheetView} from 'WEB/views.js';
import {inventory} from 'WEB/core.js';
import {customBudget} from 'WEB/ui.js';
import {cheapestKnown} from 'WEB/mtg-cheap.js';
import {buyOnTcgplayer, massLines} from 'WEB/buy.js';
import {metaNeedsRefresh} from 'WEB/meta.js';
import {metaBrowseKey, provenSheetHtml, proven, similarLists} from 'WEB/tcg.js';
import {homeMetaSnapshot} from 'WEB/home-ui.js';
import {MTG_META_FORMATS, DEFAULT_MTG_META_FORMAT} from 'WEB/meta.js';
import {namePrice} from 'WEB/core.js';
import {createDeckPipeline} from 'WEB/deck-pipeline.js';
import {deckSetupMarkup, deckResultMarkup} from 'WEB/deck-experience.js';
import * as TcgAll from 'WEB/tcg.js';
import {setupModel as flowSetupOf, resultModel as flowResultOf, useDocument as flowUseDocument, draw as flowDraw} from '../scripts/deck-flow-models.mjs';
import {mtgPower, asShown, shownPower} from 'WEB/power.js';
import {lotPrice} from 'WEB/insights.js';
import {makeAskTools} from 'WEB/ai-tools.js';
import {planQuery, fixChoices, gameOfLabel} from 'WEB/answer-search.js';
import {answerFor, answerAbout} from 'WEB/answer-run.js';
import {readGameWikiArticle} from 'WEB/mtg-wiki-client.js';
import {judgeAnswer, findCardNames} from 'WEB/judge-search.js';
import {loadRulePack} from 'WEB/rule-corpus.js';
import {PTCG_GLOSSARY, YGO_GLOSSARY} from 'WEB/game-glossary-data.js';
import {JUDGE_EXAMPLES} from 'WEB/judge-examples.js';
import {ENGINE_CARD_NAMES_FILE} from 'WEB/play-engine-names.js';
// mtg-tags.js loads its tags lazily, and Power is worked out without them until they arrive, then all over again (power.js's
// signature carries mtgTagsReady()). The engine starts with the same file the site fetches, so each deck's Power is worked out
// once, and the Power keep's entries from the last visit still match.
import {setMtgTags} from 'WEB/mtg-tags.js';
import mtgTagsData from 'WEB/mtg-tags.json';
setMtgTags(mtgTagsData);
import {mtgFieldKey, availability as deckAvailability, buildSheet} from 'WEB/views.js';
import {shareSheet as shareSheetView} from 'WEB/views.js';
import {preconList as preconListView, deckReviewSheet as deckReviewSheetView} from 'WEB/views.js';
import {sharePayload, sharePayloadTcg} from 'WEB/share.js';
import {commanderEligible, isLand, drawHand} from 'WEB/core.js';
import {currentDeck, priceOf} from 'WEB/store.js';
import '../scripts/web-bytes.mjs';
import {VOID, unescape, tree, classes, all, one, cls, tagIs, text, turnedRect, icon, svgIn, sources, SITE, abs, picture} from '../scripts/site-json.mjs';
import {Document as SiteDocument, Event as SiteEvent, serialize as domJson, byId as domById, tap as domTap, type as domType} from '../scripts/site-dom.mjs';

// The browser storage the site keeps between visits, kept by the app (CollectionEngine.store, the device's preferences): the bundle's
// localStorage lives in memory, so the keys the site reads back on a later visit are handed to the app as they change (each pump's
// "stored") and put back when the bundle starts (Collection.storeLoad). meta.js's tournament cache (cardforge-meta-v1: 12 hours, the
// offline copy and Pokémon's one art-schema refresh) is what the Decks page's Ideas and Meta decks read; app.js's precon records
// (cardforge-precons-v1, writeRecord: the Meta tab's precon list, kept between visits) the same; the site keeps S.ui.ideas itself
// for the session only (store.js), so no other Ideas key exists to keep.
// Home's header and rails paint from what the site keeps too (tcg.js HERO_KEY: today's Card of the Day per game; news-pulse.js and
// community-feed.js their last feed), so a launch shows them at once instead of after the network.
// pricehist.js's saved prices (cardstashy-price-hist-v1: a point per card when its price moves 2% or a week passes) are what search's
// price memory answers from ("what went up in my collection this week"), so the app keeps them between launches as the site does.
const KEPT_KEYS = new Set(['cardforge-meta-v1', 'cardforge-precons-v1', 'cardforge-hero-v2', 'cardforge-pulse-v2', 'cardforge-community-v3', 'cardstashy-price-hist-v1']);
// app.js A.openSetPack's today's-pack claim (cardstashy-today-pack:<game>:<date>:<id>): the Card of the Day comes once a day.
// pricehist.js's price alerts (cardstashy-price-alerts-v1): the site keeps them per account (account-scope.js privateKey); the app
// keeps one list per signed-in account the same way (Collection.alertOwner), under ALERTS::app:<account>, and on this device.
const ALERTS = 'cardstashy-price-alerts-v1';
let alertOwner = 'guest';
const alertKey = k => (String(k) === ALERTS ? ALERTS + '::app:' + alertOwner : String(k));
const kept = k => KEPT_KEYS.has(k) || k.startsWith('cardstashy-today-pack:') || k.startsWith(ALERTS + '::app:');
const keptDirty = new Set();
const keptStore = globalThis.localStorage, keptSet = keptStore.setItem, keptRemove = keptStore.removeItem, keptGet = keptStore.getItem;
keptStore.getItem = k => keptGet.call(keptStore, alertKey(k));
keptStore.setItem = (k, v) => { k = alertKey(k); keptSet.call(keptStore, k, v); if (kept(k)) keptDirty.add(k); };
keptStore.removeItem = k => { k = alertKey(k); keptRemove.call(keptStore, k); if (kept(k)) keptDirty.add(k); };
// app.js onAlert: an alert set off by a price seen now; the app shows alertText as its toast (each pump's "alerts").
let alertsFired = [], alertRun = null;
onAlert(f => { alertsFired.push({game: f.game, id: f.id, name: f.name, usd: f.usd, text: alertText(f)}); });
{
  const pump = globalThis.__host.pump;
  globalThis.__host.pump = now => {
    let out = pump(now);
    if (alertsFired.length) { out = out.slice(0, -1) + ',"alerts":' + JSON.stringify(alertsFired) + '}'; alertsFired = []; }
    if (!keptDirty.size) return out;
    const stored = {}; for (const k of keptDirty) stored[k] = keptGet.call(keptStore, k); keptDirty.clear();
    return out.slice(0, -1) + ',"stored":' + JSON.stringify(stored) + '}';
  };
}

// app.js:193-198, verbatim.
const stripCache = (s) => {
  const { cache, ...keep } = s;
  void cache;
  return keep;
};
const normalize = (s) => normalizeHomeDeckActivity(stripCache({ ...blank(), ...validateWorkspace(s) }));
const key = cardKey;

const api = createScryfallClient();
// app.js resolve (489-495), verbatim.
async function resolve(name, fuzzy = false, refresh = false) {
  if (!String(name || "").trim()) throw Error("No card name given.");
  const c = meta(name);
  if (c && !refresh) return c;
  const d = await api("/cards/named?" + new URLSearchParams({ [fuzzy ? "fuzzy" : "exact"]: name }));
  return cacheCard(d, [name]);
}
// app.js resolveNames (497-527), verbatim but for the progress line and the catalog save (the app keeps the catalog).
async function resolveNames(names, progress = () => {}, refresh = false, current = () => true) {
  const wanted = [...new Map(names.filter(Boolean).map((n) => [key(n), n])).values()].filter((n) => refresh || !meta(n)),
    failed = [],
    matched = new Map(),
    retried = new Set();
  for (let i = 0; i < wanted.length; i += 75) {
    if(!current())return {failed,matched,total:wanted.length,cancelled:true};
    const chunk = wanted.slice(i, i + 75);
    progress(`Loading card data ${Math.min(i + 75, wanted.length)}/${wanted.length}…`);
    try {
      const r = await api("/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk.map((name) => ({ name: name.split(" // ")[0] })) }),
      });
      if(!current())return {failed,matched,total:wanted.length,cancelled:true};
      for (const c of r.data || []) {
        const aliases = chunk.filter((n) => key(n) === key(c.name) || key(n.split(" // ")[0]) === key(c.name.split(" // ")[0]) || c.card_faces?.some((f) => key(f.name) === key(n)));
        cacheCard(c, aliases);
        for (const a of aliases) matched.set(key(a), c.name);
      }
      for (const n of chunk) if (!matched.has(key(n))) failed.push(n);
    } catch (e) {
      if(!current())return {failed,matched,total:wanted.length,cancelled:true};
      if (e?.network && !retried.has(i)) { retried.add(i); progress("The card database is busy; trying again…"); await new Promise((r) => setTimeout(r, 4000)); i -= 75; continue; }
      failed.push(...chunk);
    }
  }
  if(!current())return {failed,matched,total:wanted.length,cancelled:true};
  return { failed, matched, total: wanted.length };
}

// views.js:108-115, verbatim: the deck tile's cover.
const coverRank = (c) => /\b(Creature|Planeswalker)\b/.test(c.type_line || "") ? 0 : /\bLand\b/.test(c.type_line || "") ? 2 : 1;
const coverOf = (d) => {
  const lead = meta(d.commander);
  if (lead && art(lead)) return art(lead);
  const pool = d.cards.map((c) => meta(c.name)).filter((c) => c && art(c));
  return art(pool.reduce((best, c) => (!best || coverRank(c) < coverRank(best) ? c : best), null));
};

// The site's Home markup, read back into models: every word, date, link and picture is what the site's own builders
// put in the page (home-ui.js, tcg.js, community-art.js); the app only lays them out. A small tree reader, no DOM.
// community-art.js communityArtwork: the picture, what it is, its credit, and the one fallback the site would try.
function artOf(n) {
  const box = n && (cls('community-art')(n) ? n : one(n, cls('community-art'))); if (!box) return null;
  const img = one(box, tagIs('img'));
  return {src: img?.attrs.src || '', kind: box.attrs['data-art-kind'] || '', state: box.attrs['data-art-state'] || '', credit: text(one(box, cls('community-art-credit'))),
    caption: text(one(box, cls('community-art-fallback'))), fallback: box.attrs['data-art-fallback'] || '', fallbackLabel: box.attrs['data-art-fallback-label'] || '', theme: !!one(box, cls('community-art-theme'))};
}
const link = n => n ? {label: text(n), href: n.attrs.href || '', to: n.attrs['data-to'] || '', act: n.attrs['data-act'] || ''} : null;

// home-ui.js homeDeckShelf, with views.js / tcg.js's describe (format name and cover art). Yu-Gi-Oh! and Pokémon read it from tcg.js
// tcgHome itself (its describe: formatOf's name, and the cover as ygoCropArt or pokemonArtCrop), with the game open.
// A cover's picture: its address and fallbacks (data-art-sources), and "pokemon" when it is the card's art window (.pk-crop).
const coverPic = n => { const img = one(n, tagIs('img')); return img ? {art: abs(img.attrs.src || ''), sources: sources(img).map(abs), crop: one(n, cls('pk-crop')) ? 'pokemon' : ''} : {art: null, sources: [], crop: ''}; };
function shelf(game) {
  const describe = deck => ({format: formatOf(deck).name, artHTML: coverOf(deck) ? `<img src="${coverOf(deck).replace(/"/g, '&quot;')}">` : ''});
  const t = game === 'mtg' ? tree(homeDeckShelf(game, describe)) : (tcgFocus(game, 'home'), tree(tcgHome())), head = one(t, cls('home-shelf-heading'));
  const lead = one(t, cls('home-personal-resume')) || one(t, cls('home-resume')), resume = cls('home-resume')(lead || {}) ? lead : one(lead, cls('home-resume'));
  const row = n => ({id: n.attrs['data-home-personal-deck'] || '', name: text(one(n, tagIs('b'))), line: text(one(n, tagIs('small'))), ...coverPic(n), to: n.attrs['data-to'] || ''});
  return {title: text(one(head, tagIs('h2'))), all: link(one(head, tagIs('button'))),
    lead: lead && {id: resume?.attrs['data-resume-deck'] || resume?.attrs['data-home-deck-pick'] || '', empty: cls('home-resume-empty')(resume || {}),
      eyebrow: text(one(resume, cls('eyebrow'))), name: text(one(resume, tagIs('h2'))), line: text(all(resume, tagIs('p')).filter(p => !cls('eyebrow')(p)).pop()),
      action: link(one(resume, n => n.tag === 'button' && !cls('home-resume-open')(n))), to: one(resume, cls('home-resume-open'))?.attrs['data-to'] || '',
      ...(cls('home-personal-resume')(lead) ? coverPic(lead) : {art: null, sources: [], crop: ''})},
    decks: all(t, n => cls('home-personal-deck')(n) && n.tag === 'button').map(row)};
}

// home-ui.js homeMetaCarousel / homeMetaArticle: every slide as the site words it, or its loading / empty card.
function metaRail(game) {
  const slides = homeMetaSlides(game), shell = tree(homeMetaCarousel(game)), head = one(shell, cls('home-meta-heading'));
  const card = (slide, i) => {
    const a = one(tree(homeMetaArticle(game, slide, i, slides.length)), tagIs('article'));
    return {key: a.attrs['data-meta-deck'] || '', state: a.attrs['data-meta-state'] || 'ready', eyebrow: text(one(a, cls('eyebrow'))), title: text(one(a, tagIs('h3'))),
      result: text(one(a, cls('home-meta-result'))), source: text(one(a, cls('home-meta-source'))), method: text(one(a, cls('home-meta-method'))), note: slide ? '' : text(one(one(a, cls('home-meta-copy')), tagIs('p'))),
      original: one(a, cls('home-meta-original'))?.attrs.href || '', explore: link(one(a, n => n.tag === 'button' && n.attrs['data-act'] === 'go')), art: artOf(a),
      format: slide ? (game === 'mtg' ? slide.metaKey.slice(4) : game === 'ptcg' ? 'Standard' : 'TCG') : ''};
  };
  return {title: text(one(head, tagIs('h2'))), all: link(one(head, tagIs('button'))), slides: slides.length ? slides.map(card) : [card(null, 0)], empty: !slides.length, interval: 8000};
}

// home-ui.js homeCommunity / featureArticle: the news cards, their sources and the status line.
function newsRail(game) {
  const slides = slidesFor(game), shell = tree(homeCommunity(game));
  const card = (slide, i) => {
    const a = one(tree(featureArticle(game, slide, i, slides.length)), tagIs('article')), open = one(a, cls('community-open'));
    return {id: a.attrs['data-slide-id'] || '', kind: slide?.kind || '', chips: all(one(a, cls('community-pills')), cls('chip')).map(text), title: text(one(a, tagIs('h3'))), href: open?.attrs.href || '',
      summary: text(one(a, cls('community-summary'))), source: all(one(a, cls('community-source')), tagIs('span')).map(text), details: all(one(a, cls('community-context')), tagIs('p')).map(text),
      detailsLabel: text(one(one(a, cls('community-context')), tagIs('summary'))), unavailable: text(one(a, n => n.tag === 'p' && cls('muted')(n))), art: artOf(a), textOnly: cls('feature-text-only')(a)};
  };
  return {title: text(one(one(shell, cls('section-head')), tagIs('h2'))), note: text(one(shell, cls('community-heading-note'))), status: text(one(shell, cls('community-status'))),
    links: all(one(shell, cls('community-source-links')), tagIs('a')).map(link), pageSize: 3, slides: slides.length ? slides.map(card) : [card(null, 0)], empty: !slides.length};
}

// home-ui.js slidesFor, verbatim: news and events only (deck discovery has its own rail).
function slidesFor(g) { return communitySlides(g, { metaState: metaState(homeMetaKey(g)), metaKey: homeMetaKey(g), format: g === 'mtg' ? homeMetaKey(g).slice(4) : undefined }).filter(slide => slide.kind !== 'deck' && slide.kind !== 'link' && slide.category !== 'decks').sort((a, b) => Number(a.kind === 'link') - Number(b.kind === 'link')); }

// tcg.js homeHero / homeToday and home-today.js dailyDetails: the Card of the Day art, name, set and rarity.
const today = new Map();
function hero(game) {
  const h = heroFor(game), hh = tree(homeHero(game)), d = h && today.get(h.id + '|' + h.date);
  const set = d?.set ? tree(todaySetMarkup(game, d.set, {rarity: d.rarity})) : null;
  // home-today.js todayPackMarkup: the set's real booster pack, its pictures best first (the img's onerror walk); any after the
  // first is drawn as the generic wrapper (.pack-generic: crimp bands, the art inset). None when the set has no pack.
  const pk = d?.set ? one(tree(todayPackMarkup(game, d.set, {cardImage: d.image})), cls('today-pack')) : null, pkImg = pk && one(pk, tagIs('img'));
  let pkSrc = []; try { pkSrc = JSON.parse(pkImg?.attrs['data-sources'] || '[]'); } catch {}
  return {eyebrow: text(one(hh, cls('eyebrow'))), title: text(one(hh, tagIs('h1'))), prompt: one(hh, tagIs('input'))?.attrs.placeholder || '',
    // The hero's picture as homeHero draws it: Yu-Gi-Oh!'s is the site's own crop (img/ygo/a/…) then the direct one; Pokémon's the card's art window.
    card: h ? {id: h.id, name: h.name, date: h.date, art: abs(one(hh, tagIs('img'))?.attrs.src || h.art || ''), artDirect: h.artDirect || '', sources: sources(one(hh, tagIs('img'))).map(abs),
      crop: one(hh, cls('pk-crop')) ? 'pokemon' : '', label: text(one(one(tree(homeToday(game)), cls('hh-credit')), tagIs('span'))),
      set: set ? text(one(set, cls('today-set-name'))) : '', setCode: set ? one(set, cls('today-set-name'))?.attrs['data-code'] || one(set, cls('today-set-name'))?.attrs['data-id'] || '' : '',
      // home-today.js setAction: Yu-Gi-Oh!'s link names its set (A.tSetByName finds it).
      setName: set ? one(set, cls('today-set-name'))?.attrs['data-name'] || '' : '', rarity: set ? text(one(set, cls('today-rarity'))) : '',
      pack: pk ? {label: pk.attrs['aria-label'] || '', sources: pkSrc.map((u, i) => ({src: u && u !== '#' ? abs(u) : '', generic: i > 0})).filter(x => x.src)} : null} : null};
}
function loadToday(game) {
  return loadHero(game).catch(() => false).then(() => { const h = heroFor(game); if (!h) return; return dailyDetails(game, h).then(d => { if (d) today.set(h.id + '|' + h.date, d); }, () => {}); });
}

// set-experience.js setAtmosphere: the set's art, then its fallbacks (the img's onerror walks them in order).
const setArt = img => { try { return JSON.parse(img?.attrs['data-set-art-sources'] || '[]').map(u => abs(u)); } catch { return []; } };
const selectOf = sel => sel && {name: sel.attrs['data-change'] || '', label: sel.attrs['aria-label'] || '', options: all(sel, tagIs('option')).map(o => ({value: o.attrs.value ?? text(o), label: text(o), on: o.attrs.selected !== undefined}))};
// Words with their weight, in order (the summary line's <b> runs).
const runs = n => { const out = []; const walk = (x, bold, muted) => { for (const k of x.kids || []) { if (k.text !== undefined) { const t = k.text.replace(/\s+/g, ' '); if (t) out.push({t, b: bold, m: muted}); } else if (k.tag !== 'svg') walk(k, bold || k.tag === 'b' || k.tag === 'strong', muted || cls('muted')(k)); } }; walk(n, false, false);
  return out.reduce((a, r) => { const last = a[a.length - 1]; if (last && last.b === r.b && last.m === r.m) last.t += r.t; else a.push({...r}); return a; }, []).map((r, i, a) => ({...r, t: i === 0 ? r.t.replace(/^\s+/, '') : i === a.length - 1 ? r.t.replace(/\s+$/, '') : r.t})); };

// views.js collection() / collectionList(): the Cards tab as the site draws it, row by row.
// ui.js tileChrome on a row's art: the colour emblems (mana symbols) and the set symbol in its rarity, docked at the foot
// (the gallery shows it; the list views hide it).
function lotChrome(n) {
  const c = one(one(n, cls('lot-art')), cls('tile-chrome')); if (!c) return null; const set = one(c, cls('set-icon')), imp = one(c, cls('imp-tile'));
  return {emb: all(one(c, cls('tile-emb')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
    set: set ? {src: ((/url\('([^']+)'\)/.exec(set.attrs.style || '') || [])[1] || ''), rarity: (classes(set).find(x => x.startsWith('r-')) || 'r-common').slice(2), title: one(c, cls('tset'))?.attrs.title || ''} : null,
    imp: imp ? icon(svgIn(imp)) : null};
}
function lotRow(n) {
  const art = one(n, cls('lot-art')), img = one(art, tagIs('img')), name = one(n, cls('lot-name')), badge = one(name, cls('set-badge')), sub = one(n, cls('lot-sub')),
    emb = one(name, cls('imp-row')), tag = one(n, cls('tag')), step = one(n, cls('stepper')), cond = one(n, cls('condition-badge')), origin = one(n, cls('price-origin'));
  const tierColor = (/--tier:\s*([^;]+)/.exec(n.attrs.style || '') || [])[1] || 'transparent';
  let finish = null; try { finish = JSON.parse(art?.attrs['data-finish-model'] || 'null'); } catch {}
  const subRuns = []; for (const k of sub?.kids || []) { if (!k.tag || cls('mana')(k)) continue; if (cls('want-chip')(k)) continue;
    for (const r of runs({kids: [k]})) subRuns.push({t: r.t, foil: false}); const foil = one(k, cls('foil')); if (foil) { const all = subRuns.map(r => r.t).join(''), ft = text(foil), at = all.lastIndexOf(ft); if (at >= 0) { subRuns.length = 0; subRuns.push({t: all.slice(0, at), foil: false}, {t: ft, foil: true}, {t: all.slice(at + ft.length), foil: false}); } } }
  return {id: name?.attrs['data-entry'] || (one(n, n => n.attrs['data-act'] === 'wishRemove')?.attrs['data-id'] ? 'w:' + one(n, n => n.attrs['data-act'] === 'wishRemove').attrs['data-id'] : ''), name: name?.attrs['data-name'] || text(name),
    wanted: cls('wanted')(n), tier: n.attrs['data-tier'] || 'tn', tierColor: tierColor.trim(), picture: picture(img), alt: img?.attrs.alt || '', fallback: img ? '' : text(art),
    finish: finish && {key: finish.key || '', effect: finish.effect || art?.attrs['data-finish-effect'] || '', printingId: finish.printingId || '', status: finish.status || ''},
    emblem: emb && {title: emb.attrs.title || '', icon: icon(svgIn(emb))},
    set: badge && {code: (badge.attrs['data-code'] || '').toUpperCase(), rarity: (classes(badge).find(c => c.startsWith('r-')) || 'r-common').slice(2), unknown: cls('unknown')(badge), label: text(badge), title: badge.attrs.title || ''},
    mana: all(one(sub, cls('mana')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
    sub: subRuns.filter(r => r.t), wantChip: text(one(sub, cls('want-chip'))), wishId: one(n, x => x.attrs['data-act'] === 'wishRemove')?.attrs['data-id'] || '',
    tag: tag && {text: text(tag), warn: cls('warn')(tag), act: tag.attrs['data-act'] || ''},
    price: text(one(n, cls('price'))), condition: cond && {code: text(cond), info: cond.attrs['data-condition-info'] || ''}, origin: origin ? text(origin) : '',
    qty: step ? Number(text(one(step, tagIs('b')))) || 0 : 0, edit: !!one(n, x => x.attrs['data-act'] === 'editLot' && cls('link')(x)), got: text(one(n, cls('want-got'))),
    // The copy's printing when it shows a finish: the app draws that foil from it (finish-preview.js reads the same record).
    print: finish && finish.key && finish.key !== 'nonfoil' && finish.printingId ? S.state.printings?.[finish.printingId] || null : null,
    chrome: lotChrome(n), wantTag: text(one(art, cls('want-tag'))),
    // workbench-ui.js selectionMark: while Select is on, the lot's tick (checked when it is chosen).
    mark: (() => { const i = one(n, x => x.tag === 'input' && x.attrs['data-change'] === 'batchToggle'); return i ? {on: i.attrs.checked !== undefined, aria: i.attrs['aria-label'] || ''} : null; })()};
}
// workbench-ui.js selectionTray: "n selected", Move / Add to deck / Wishlist / Compare (disabled with none chosen) and Clear.
const trayModel = t => t && {count: text(one(t, tagIs('b'))), aria: t.attrs['aria-label'] || '',
  buttons: all(t, x => x.tag === 'button' && x.attrs['data-act'] === 'batchAction').map(b => ({kind: b.attrs['data-kind'] || '', label: text(b), disabled: b.attrs.disabled !== undefined})),
  clear: text(one(t, x => x.attrs['data-act'] === 'batchClear'))};
// workbench-ui.js registerWorkbench: the site's Select handlers (A.batchStart, C.batchToggle, A.batchClear, A.batchAction, A.batchApply)
// with app.js's getCard / zoneFor / ownKey. The app has no DOM: its sheet is read from the html A.batchAction opens, its fields
// come back with the tap (siteRun's querySelector), and the redraw is the app's. History refresh stays the engine's (none).
const WA = {}, WC = {};
let workbenchOn = false, batchGame = '', batchSheetOut = null;
function workbenchReady() {
  if (workbenchOn) return; workbenchOn = true;
  registerWorkbench({A: WA, C: WC, commit, render() {}, openSheet: (html, ctx) => { batchSheetOut = {html, ctx}; }, closeSheet() {}, refreshSheet() {},
    toast: text => { if (text) toasts.push({text: String(text), undo: false}); },
    getGame: () => batchGame || 'mtg',
    getCard: (g, e) => { if (g === 'mtg') return (e.printingVerified && S.state.printings?.[e.printingId]) || meta(e.name); const c = tcgCardOf(g, e.cardId); return c && (!c.game || c.game === g) ? c : null; },
    links: (g, c) => g === 'mtg' ? Object.entries(c.purchase_uris || {}).map(([name, url]) => [name, url]) : tcgSources[g].buy(c),
    zoneFor: (g, c) => tcgSources[g].zoneFor(c), ownKey: (g, c) => tcgSources[g].ownKey(c)});
  setHistoryRefresh(() => {});
}
// The Cards tab's Select (a page control: the list is read again after it): on and off, one lot's tick (v = "id\n1" or "id\n0"), Clear.
const batchActs = G => ({
  select: () => { workbenchReady(); WA.batchStart({dataset: {game: G}}); },
  mark: v => { workbenchReady(); const at = String(v).lastIndexOf('\n'); WC.batchToggle({dataset: {game: G, id: String(v).slice(0, at)}, checked: String(v).slice(at + 1) === '1'}); },
  clear: () => { workbenchReady(); WA.batchClear({dataset: {game: G}}); },
});
// A.batchAction's sheet for the tray's [kind], read back: Move (locationPicker), Add to deck (the decks), Wishlist, or Compare (each
// chosen card's picture, type, rules text, facts and where it lives); or the site's toast when it refuses (more than four to compare).
function batchSheetModel(G, kind) {
  workbenchReady(); batchGame = G; batchSheetOut = null; const kept = toasts; toasts = [];
  try { WA.batchAction({dataset: {game: G, kind}}); } finally { batchGame = ''; }
  const out = batchSheetOut; batchSheetOut = null;
  const said = toasts; toasts = kept;
  if (!out) return {toast: said.map(t => t.text).join(' ')};
  const t = tree(out.html), head = one(t, cls('sheet-head')), ctx = out.ctx || {};
  if (ctx.type === 'batch-compare') return {kind: 'compare', title: text(one(head, tagIs('h2'))),
    cards: all(one(t, cls('batch-compare')), tagIs('article')).map(a => { const ps = all(a, x => x.tag === 'p' && x.kids !== undefined && !cls('small')(x));
      const img = one(a, tagIs('img'));
      // img[data-tier]: a 2 outline inside the picture in its price tier's colour (t0 #8b939c), 6 corners; t3 to t5 glow.
      return {picture: picture(img), tier: img?.attrs['data-tier'] || '', tierColor: ((/--tier:\s*([^;]+)/.exec(img?.attrs.style || '') || [])[1] || '').trim(),
        name: text(one(a, tagIs('h3'))), type: text(ps[0]), text: text(ps[1]),
        facts: all(one(a, cls('compare-facts')), tagIs('div')).map(f => [text(one(f, tagIs('dt'))), text(one(f, tagIs('dd')))]), where: text(one(a, x => x.tag === 'p' && cls('small')(x)))}; })};
  const deck = one(t, x => x.tag === 'select' && x.attrs.id === 'batchDeck'), go = one(t, x => x.attrs['data-act'] === 'batchApply');
  const picker = one(t, cls('location-picker'));
  return {kind: ctx.kind, title: text(one(head, tagIs('h2'))), ids: ctx.ids || [], text: text(one(t, x => x.tag === 'p' && !cls('foot')(x) && !cls('location-hint')(x) && x !== one(picker, tagIs('p')))),
    location: picker ? locationModelOf(picker) : null,
    deck: deck && {label: (one(t, x => x.tag === 'label' && one(x, y => y === deck))?.kids || []).filter(k => k.text !== undefined).map(k => k.text).join('').trim(), options: all(deck, tagIs('option')).map(o => [o.attrs.value ?? '', text(o)]),
      selected: (all(deck, tagIs('option')).find(o => o.attrs.selected !== undefined) || all(deck, tagIs('option'))[0])?.attrs.value ?? ''},
    none: text(one(t, x => x.tag === 'p' && /Create a deck first/.test(text(x)))), button: {label: text(go), disabled: go?.attrs.disabled !== undefined}};
}
// app.js A.collMenu (Magic Collection's ⋯), verbatim: its title, its buttons ([act, words]) and the line it writes progress into.
const COLL_MENU_HTML = `<div class="sheet-head"><h2>Collection</h2><button class="icon" data-act="closeSheet">✕</button></div><div class="menu-list">
    <button data-act="importCollection">↥ Import a list or CSV</button>
    <button data-act="exportCSV">↓ Export CSV (ManaBox-style)</button>
    <button data-act="retryLookups">⟳ Retry cards that weren’t found</button>
    <button data-act="refreshPrices">$ Refresh all prices</button>
    <button data-act="verifyAll">✓ Verify exact printings</button>
  </div><p class="muted small" id="collMenuMsg"></p>`;
function collMenuModel() {
  const t = tree(COLL_MENU_HTML);
  return {title: text(one(one(t, cls('sheet-head')), tagIs('h2'))), items: all(one(t, cls('menu-list')), tagIs('button')).map(b => ({act: b.attrs['data-act'], ...glyph(text(b))}))};
}
// app.js verifyLot (5544): the printing checked (verifyPhysical, verifiedLot); a bare name is looked up instead; what went wrong is the review.
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
// app.js importCollectionSheet (5698), verbatim: the sheet's words and fields, read by the app; impDraft as app.js keeps it.
let impDraft = null, impBusy = false, impError = '';
function importCollectionHtml() {
  return `<div class="sheet-head"><h2>Import cards you own</h2><button class="icon" data-act="closeSheet">✕</button></div>
    ${segmented("addMode", "list", [["one", "One card"], ["list", "Paste or upload a list"]])}
    <p class="muted small">Paste “4 Lightning Bolt” lines, or upload a ManaBox / Moxfield / Deckbox CSV. You’ll review everything before it’s saved.</p>
    <textarea id="impText" rows="6" data-input="impText" placeholder="1 Sol Ring&#10;4 Lightning Bolt (2X2) 117&#10;— or a CSV with Name, Quantity, Set code…"></textarea>
    <label class="btn ghost file">Choose .txt / .csv<input type="file" accept=".txt,.csv" data-change="impFile" hidden></label>
    <div class="grid2"><label>Source name<input id="impSource" value="My collection import" maxlength="100"></label><label>How to apply<select id="impMode">${htmlOptions([["append", "Add to my collection"], ["replace-source", "Replace earlier import with this name"], ["replace-all", "Replace entire collection"]], "append")}</select></label></div>
    <p id="impError" class="error" role="alert"></p>
    <div class="actions"><button class="btn ghost" data-act="impPreview">Preview</button><button class="btn" data-act="impApply" id="impApply" disabled>Import</button></div>
    <div id="impPreview"></div>`;
}
const unent = v => String(v ?? '').replace(/&#10;/g, '\n').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function importSheetModel() {
  impDraft = null; impBusy = false; impError = '';
  const t = tree(importCollectionHtml()), seg = one(t, cls('seg')), area = one(t, tagIs('textarea')), file = one(t, cls('file'));
  const labels = all(one(t, cls('grid2')), tagIs('label')), mode = one(t, x => x.tag === 'select' && x.attrs.id === 'impMode'), acts = all(one(t, cls('actions')), tagIs('button'));
  const direct = l => (l?.kids || []).filter(k => k.text !== undefined).map(k => k.text).join('').trim();
  return {title: text(one(one(t, cls('sheet-head')), tagIs('h2'))),
    seg: all(seg, tagIs('button')).map(b => ({id: b.attrs['data-id'] || '', label: text(b), on: cls('on')(b) || b.attrs['aria-selected'] === 'true'})),
    hint: text(one(t, x => x.tag === 'p' && cls('muted')(x))), placeholder: unent(area?.attrs.placeholder), file: direct(file),
    accept: one(file, tagIs('input'))?.attrs.accept || '',
    source: {label: direct(labels[0]), value: unent(one(labels[0], tagIs('input'))?.attrs.value), max: Number(one(labels[0], tagIs('input'))?.attrs.maxlength) || 100},
    mode: {label: direct(labels[1]), options: all(mode, tagIs('option')).map(o => [o.attrs.value ?? '', text(o)]), selected: (all(mode, tagIs('option')).find(o => o.attrs.selected !== undefined) || all(mode, tagIs('option'))[0])?.attrs.value ?? ''},
    preview: text(acts[0]), apply: text(acts[1]), ...importModel()};
}
// app.js drawImport, as data: the summary line (copies, rows, lines skipped with their download, the source), the two warnings, Check
// names & printings, the first 400 rows (a tick, "qty× name", set, number and finish, the review, Pick printing when several match)
// and how many more; Import's words and whether it can be pressed. [error]: #impError.
function importModel() {
  if (!impDraft) return {draft: null, error: impError, applyLabel: 'Import', applyDisabled: true};
  const sel = impDraft.lots.filter((e) => e.include !== false);
  return {error: impError, applyLabel: `Import ${sumQty(sel)} cards`, applyDisabled: impBusy || !sel.length || sel.some((e) => !e.name),
    draft: {total: impDraft.total, rows: impDraft.lots.length, skipped: impDraft.errors.length ? `${impDraft.errors.length} lines skipped` : '', source: impDraft.source,
      repeated: impDraft.repeated ? "You imported this exact file before. Importing again adds these cards a second time. Use “Replace earlier import” if they’re the same physical cards." : '',
      overlapping: impDraft.overlappingLots ? `${impDraft.overlappingLots} rows match cards already in your collection — they may be the same physical cards.` : '',
      verify: impBusy ? "Checking…" : "Check names & printings", verifyDisabled: impBusy,
      lots: impDraft.lots.slice(0, 400).map((e, i) => ({i, include: e.include !== false, line: `${e.qty}× ${e.name || "Unknown"}`,
        meta: [e.set || "", e.collectorNumber || "", e.finish !== "nonfoil" ? e.finish || '' : ""].join(' ').replace(/\s+$/, ''), review: e.review || '',
        candidates: e.candidates?.length ? [["", "Pick printing"], ...e.candidates.map((c, j) => [String(j), `${c.set.toUpperCase()} #${c.collector_number}`])] : []})),
      more: impDraft.lots.length > 400 ? `…and ${impDraft.lots.length - 400} more rows.` : ''}};
}
// tcg.js tcgImportSheet("coll") (Paste a list), read from the site's own sheet: title, the game's hint, the box's example, Import.
function tcgImportSheetModel(G) {
  tcgFocus(G, 'collection'); let html = ''; const was = tcgSheetHook; tcgSheetHook = h => { html = String(h || ''); };
  try { TA.tImportColl({dataset: {}}); } finally { tcgSheetHook = was; }
  const t = tree(html), area = one(t, tagIs('textarea'));
  return {title: text(one(one(t, cls('sheet-head')), tagIs('h2'))), hint: text(one(t, x => x.tag === 'p' && cls('muted')(x) && x.attrs.id !== 'tImpStatus')),
    placeholder: unent(area?.attrs.placeholder), rows: Number(area?.attrs.rows) || 9, button: text(one(t, x => x.attrs['data-act'] === 'tImpColl'))};
}
// A deck's share sheet as data (views.js shareSheet for Magic, tcg.js A.tShare's for the other games): its title, the words under
// it, the creator and note fields (Magic), the note on what is and isn't shared, the Create / Update link button, and once there is a
// link: the link (the app's: share.js encodeShare's "z." as the browser makes it), its buttons and the foot. [copied] and [native]:
// what app.js A.shareCopy / A.shareNative (tcg.js A.tShareCopy / A.tShareNative) say and share.
function shareModel(html, link, game, name) {
  const t = tree(html), direct = l => (l?.kids || []).filter(k => k.text !== undefined).map(k => k.text).join('').trim();
  const raw = n => unent((n?.kids || []).map(k => k.text ?? '').join(''));
  const fields = all(t, x => x.tag === 'label' && cls('field')(x)).map(l => {
    const f = one(l, x => x.tag === 'input' || x.tag === 'textarea');
    return {label: direct(l), small: text(one(l, tagIs('span'))), id: f?.attrs.id || '', value: f?.tag === 'textarea' ? raw(f) : unent(f?.attrs.value),
      placeholder: unent(f?.attrs.placeholder), max: Number(f?.attrs.maxlength) || 0, rows: Number(f?.attrs.rows) || 0};
  });
  const note = one(t, cls('note')), box = one(t, cls('share-link')), parts = [];
  for (const k of note?.kids || []) { if (k.text !== undefined) parts.push({t: unent(k.text)}); else if (k.tag === 'br') parts.push({br: true}); else parts.push({t: text(k), b: k.tag === 'b'}); }
  const mtg = game === 'mtg';
  return {title: text(one(one(t, cls('sheet-head')), tagIs('h2'))), intro: text(one(t, x => x.tag === 'p' && cls('muted')(x))), fields, note: parts,
    make: text(one(t, x => x.attrs['data-act'] === 'shareMake')), link: box ? link : '',
    actions: box ? all(one(box, cls('actions')), x => x.tag === 'button' || x.tag === 'a').map(b => ({act: b.attrs['data-act'] || (b.tag === 'a' ? 'preview' : ''), label: text(b), ghost: cls('ghost')(b)})) : [],
    foot: text(one(box, cls('foot'))), copied: mtg ? "Link copied — paste it anywhere." : "Link copied.",
    native: mtg ? {title: name || "CardStashy deck", text: "Check out my deck on CardStashy"} : {title: name || "Deck", text: ""}};
}
// app.js's handlers for the Cards tab's controls (C.collSort, C.collDirection, C.collFilter, I.collSearch, A.collMore), verbatim
// but for the redraw, which is the app's.
const cardsAct = {
  sort: v => { S.ui.collSort = v; S.ui.collDirection = undefined; S.ui.collLimit = 120; },
  direction: v => { S.ui.collDirection = v; S.ui.collLimit = 120; },
  filter: v => { S.ui.collFilter = v; },
  search: v => { S.ui.q.coll = v; S.ui.collLimit = 120; },
  more: () => { S.ui.collLimit += 200; },
  // workbench-ui.js A.viewSave for area "collection": the account's settings.displayModes (the app keeps the choice too).
  view: v => { if (['gallery', 'compact', 'symbols'].includes(v)) ((S.state.settings.displayModes ||= {}).mtg ||= {}).collection = v; },
  ...batchActs('mtg'),
};
function cardsPage(game, o = {}) {
  const ui = S.ui;
  if (o.sort) ui.collSort = o.sort; if (o.direction) ui.collDirection = o.direction; if (o.filter) ui.collFilter = o.filter;
  if (o.q !== undefined) ui.q.coll = String(o.q); if (o.limit) ui.collLimit = Number(o.limit) || 120;
  ui.collTab = 'cards';
  const t = tree(collectionPage()), head = one(t, cls('page-head')), seg = one(t, cls('seg')), empty = one(t, cls('empty'));
  const view = one(head, cls('view-switch')), batch = one(head, x => x.attrs['data-act'] === 'batchStart'), menu = one(head, x => x.attrs['data-act'] === 'collMenu');
  const tools = one(t, cls('coll-tools')), search = one(tools, x => x.tag === 'input'), list = one(t, cls('display-list')), more = one(t, x => x.attrs['data-act'] === 'collMore');
  return {game, mode: modeFor(game, 'collection'), title: text(one(head, tagIs('h1'))), banner: picture(one(head, cls('page-hero-img'))), bannerCard: head?.attrs['data-banner-card'] || '',
    views: view ? all(view, tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})) : [],
    select: batch && {label: text(batch), aria: batch.attrs['aria-label'] || '', icon: icon(svgIn(batch)), on: cls('on')(batch)}, menu: menu && {label: text(menu), aria: menu.attrs['aria-label'] || ''},
    tray: trayModel(one(t, cls('batch-tray'))),
    tabs: all(seg, tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))})),
    empty: empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), mark: text(one(empty, cls('empty-mark'))), actions: all(empty, tagIs('button')).map(b => ({label: text(b), act: b.attrs['data-act'] || '', ghost: cls('ghost')(b)}))},
    summary: runs(one(t, cls('summary-line')) || {kids: []}),
    sort: selectOf(one(tools, x => x.tag === 'select' && x.attrs['data-change'] === 'collSort')), direction: selectOf(one(tools, x => x.tag === 'select' && /dir/i.test(x.attrs['data-change'] || ''))),
    search: search && {value: search.attrs.value || '', placeholder: search.attrs.placeholder || '', label: search.attrs['aria-label'] || ''},
    filter: selectOf(one(tools, x => x.tag === 'select' && x.attrs['data-change'] === 'collFilter')),
    rows: list ? all(list, x => cls('lot')(x) && x.tag === 'div').map(lotRow) : [], none: list ? '' : text(one(one(t, tagIs('div')), x => x.tag === 'p' && cls('center')(x))) || text(one(t, x => x.tag === 'p' && cls('pad')(x))),
    more: more ? {label: text(more), count: Number((/\((\d+)\)/.exec(text(more)) || [])[1]) || 0} : null,
    // icons.js decorateGlyphs: a button whose only text is −, ＋ or ⋯ shows ICON.minus / plus / more; LEAD ＋ and the wishlist tag use plus and heart.
    glyphs: Object.fromEntries(["minus", "plus", "more", "heart"].map(k => [k, icon(svgIn(tree(ICON[k])))]))};
}

// tcg.js tcgCollection(): a Yu-Gi-Oh! or Pokémon collection's Cards tab, read into cardsPage's model. The game's own filters
// (set, kind, rarity, owned or wishlist) come as [filters]; the value line over the list as [summary]; each row keeps its card's id.
// A Yu-Gi-Oh! or Pokémon lot's .lot-sub in order: the game's emblems (energy discs, level stars, attribute, as svg), the set badge
// (.tset: set symbol and rarity mark as img, its bold code and small number, its rarity tone) and the words after it.
function subPieces(n) {
  const out = [];
  const walk = (x, st) => { for (const k of x.kids || []) {
    if (k.text !== undefined) { const t = k.text.replace(/\s+/g, ' '); if (t.trim() || (t === ' ' && out.length)) out.push({k: 't', t, b: st.b, s: st.s, tone: st.tone, set: st.set, strong: st.strong}); continue; }
    if (!k.tag || k.attrs?.hidden !== undefined || cls('sr-only')(k)) continue;
    if (k.tag === 'svg') { out.push({k: 'svg', icon: icon(k), label: k.attrs['aria-label'] || text(one(k, tagIs('title'))), set: st.set}); continue; }
    if (k.tag === 'img') { out.push({k: 'img', src: abs(k.attrs.src || ''), alt: k.attrs.alt || '', ink: cls('ink')(k), set: st.set}); continue; }
    const c = classes(k), tset = c.includes('tset');
    if (tset) out.push({k: 'set', title: k.attrs.title || '', tone: ['secret', 'ultra', 'super', 'rare', 'common'].find(x => c.includes(x)) || ''});
    walk(k, {b: st.b || k.tag === 'b' || k.tag === 'strong', s: st.s || k.tag === 'small', tone: c.find(x => /^rx-/.test(x) && x !== 'rx-code') || st.tone, set: st.set || tset,
      // .hp and .lvl: 13 px, 800, in the text colour (the rest of the line is the muted 12 px).
      strong: st.strong || c.includes('hp') || c.includes('lvl')});
  } };
  walk(n || {kids: []}, {b: false, s: false, tone: '', set: false, strong: false});
  return out;
}
const tcgSelectOf = sel => { const m = selectOf(sel); if (m && sel.attrs['data-field']) m.name += ':' + sel.attrs['data-field']; return m; };
function tcgCardsPage(G, o = {}) {
  tcgFocus(G, 'collection'); const U = tcgUi(G).coll; if (o.limit) U.limit = Number(o.limit) || 120; U.tab = 'cards';
  const t = tree(tcgCollection()), head = one(t, cls('page-head')), seg = one(t, cls('seg')), empty = one(t, cls('empty'));
  const view = one(head, cls('view-switch')), batch = one(head, x => x.attrs['data-act'] === 'batchStart');
  const tools = one(t, cls('coll-tools')), search = one(tools, x => x.tag === 'input'), list = one(t, cls('display-list')), more = one(t, x => x.attrs['data-act'] === 'tCollMore');
  const sum = one(t, cls('coll-summary')), refresh = one(sum, x => x.attrs['data-act'] === 'tRefreshPrices');
  return {game: G, mode: modeFor(G, 'collection'), title: text(one(head, tagIs('h1'))), banner: picture(one(head, cls('page-hero-img'))), bannerCard: head?.attrs['data-banner-card'] || '',
    views: view ? all(view, tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})) : [],
    select: batch && {label: text(batch), aria: batch.attrs['aria-label'] || '', icon: icon(svgIn(batch)), on: cls('on')(batch)}, menu: null,
    tray: trayModel(one(t, cls('batch-tray'))),
    tabs: all(seg, tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))})),
    empty: empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), mark: text(one(empty, cls('empty-mark'))), actions: all(empty, tagIs('button')).map(b => ({label: text(b), act: b.attrs['data-act'] || '', ghost: cls('ghost')(b)}))},
    // .coll-summary: the collection's value (its button opens Value), copies and wishlist, then the refresh button.
    summary: sum ? runs({kids: (one(sum, cls('cs-value'))?.kids || [])}) : [], refresh: refresh ? {aria: refresh.attrs['aria-label'] || '', icon: icon(svgIn(refresh))} : null,
    sort: selectOf(one(tools, x => x.tag === 'select' && x.attrs['data-change'] === 'tCollSort')), direction: selectOf(one(tools, x => x.tag === 'select' && x.attrs['data-change'] === 'tCollDirection')),
    search: search && {value: search.attrs.value || '', placeholder: search.attrs.placeholder || '', label: search.attrs['aria-label'] || ''},
    filter: null, filters: all(one(tools, cls('filter-pills')), tagIs('select')).map(tcgSelectOf),
    rows: list ? all(list, x => cls('lot')(x) && x.tag === 'div').map(n => { const r = lotRow(n), nm = one(n, cls('lot-name')), x = one(n, cls('want-x'));
      // The lot's foil as finish-preview.js gives it (tcg.js's .lot-art data-finish-model): the copy's variant or rarity, drawn by the app's foil layer.
      return {...r, cardId: nm?.attrs['data-id'] || '', wishId: x?.attrs['data-id'] || r.wishId, sub: [], pieces: subPieces(one(n, cls('lot-sub'))),
        tcgFinish: tcgFinishOf(one(n, cls('lot-art')), tcgCardOf(G, nm?.attrs['data-id'] || ''))}; }) : [], none: '',
    more: more ? {label: text(more), count: Number((/·\s*(\d+)\s+remaining/.exec(text(more)) || [])[1]) || 0} : null,
    actions: all(one(t, x => cls('actions')(x) && cls('wrap')(x)), tagIs('button')).map(button),
    glyphs: Object.fromEntries(["minus", "plus", "more", "heart"].map(k => [k, icon(svgIn(tree(ICON[k])))]))};
}
// tcg.js's handlers for the Cards tab's controls (C.tCollSort, C.tCollDirection, I.tCollQ, C.tCollSet, C.tCollKind, A.tCollMore), the site's own.
const tcgCardsAct = {
  sort: v => TC.tCollSort({value: v}), direction: v => TC.tCollDirection({value: v}), search: v => TI.tCollQ({value: v}), more: () => TA.tCollMore(),
  // A filter select, by the name tcgSelectOf gave it (data-change, then :data-field).
  filter: v => { const at = v.indexOf('='), name = v.slice(0, at), value = v.slice(at + 1), [change, field] = name.split(':');
    if (change === 'tCollSet') TC.tCollSet({value}); else if (change === 'tCollKind') TC.tCollKind({value, dataset: {field}}); else throw Error('unknown filter ' + name); },
  // workbench-ui.js A.viewSave for area "collection": the game's own settings.displayModes.
  view: v => { if (['gallery', 'compact', 'symbols'].includes(v)) ((S.state.settings.displayModes ||= {})[tcgGame()] ||= {}).collection = v; },
  select: () => batchActs(tcgGame()).select(), mark: v => batchActs(tcgGame()).mark(v), clear: () => batchActs(tcgGame()).clear(),
};

// ---- Collection › Value (views.js collectionValueView, tcg.js tcgValueView; value-page.js, pricehist.js alertsPanel, importance.js
// tradeAdviceHtml): the page the site draws, read into blocks in its order. The chart keeps the svg's own numbers (its view box,
// the grid's y and labels, each line's two ends, each point and gap), so the app draws the site's plot.
const nums = s => (String(s || '').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
const bgColors = s => (String(s || '').match(/#[0-9a-f]{3,8}\b/gi) || []);
function valueChartModel(n) {
  if (!n) return null;
  if (cls('value-chart-empty')(n)) return {empty: true, title: text(one(n, tagIs('h3'))), text: text(one(n, tagIs('p')))};
  const head = one(n, cls('value-section-head')), svg = one(n, tagIs('svg')), ch = one(n, cls('value-chart-change')), det = one(n, cls('value-history-details'));
  const grid = all(svg, cls('value-chart-grid')), axis = all(svg, cls('value-chart-axis'));
  return {title: text(one(head, tagIs('h3'))), count: text(one(head, tagIs('span'))),
    change: ch && {dir: ['up', 'down', 'flat'].find(d => cls(d)(ch)) || 'flat', amount: text(one(ch, tagIs('strong'))), label: text(one(ch, tagIs('span')))},
    periods: all(n, cls('value-chart-period')).map(text), range: runs(one(n, cls('value-chart-range')) || {kids: []}),
    vb: nums(svg?.attrs.viewbox), desc: text(one(svg, tagIs('desc'))),
    grid: grid.map((g, i) => ({y: Number(g.attrs.y1) || 0, x1: Number(g.attrs.x1) || 0, x2: Number(g.attrs.x2) || 0, label: text(axis[i])})),
    lines: all(svg, cls('value-chart-line')).map(p => { const [x1, y1, x2, y2] = nums(p.attrs.d); return {x1, y1, x2, y2, partial: p.attrs['data-value-series'] === 'partial'}; }),
    points: all(svg, cls('value-chart-point')).map(c => ({x: Number(c.attrs.cx), y: Number(c.attrs.cy), r: Number(c.attrs.r) || 4, status: ['partial', 'legacy', 'complete'].find(s => cls(s)(c)) || 'complete', title: text(one(c, tagIs('title')))})),
    gaps: all(svg, cls('value-chart-gap')).map(p => { const [x, y] = nums(p.attrs.d); return {x: x + 3, y: y + 3, title: text(one(p, tagIs('title')))}; }),
    dates: all(one(n, cls('value-chart-dates')), tagIs('span')).map(text),
    legend: all(one(n, cls('value-chart-legend')), tagIs('span')).map(s => { const i = one(s, tagIs('i')); return {kind: (i?.attrs.class || '').trim(), mark: text(i), label: text(s).slice(text(i).length).trim()}; }),
    note: text(one(n, cls('value-chart-note'))),
    history: det && {summary: text(one(det, tagIs('summary'))), rows: all(det, tagIs('li')).map(li => ({date: text(one(li, tagIs('time'))), total: text(one(li, tagIs('strong'))), label: text(one(li, tagIs('span')))}))}};
}
function valueSourcesModel(n) {
  if (!n) return null;
  return {summary: text(one(n, tagIs('summary'))), rows: all(n, x => x.tag === 'div' && x.attrs['data-value-source']).map(d => { const dt = one(d, tagIs('dt')), sm = one(dt, tagIs('small'));
    return {key: d.attrs['data-value-source'], label: text(dt).slice(0, text(dt).length - text(sm).length).trim(), copies: text(sm), value: text(one(d, tagIs('dd')))}; }), foot: text(one(n, cls('foot')))};
}
const miniRows = n => all(n, cls('mini-row')).map(b => ({name: text(one(b, cls('ellip'))), price: text(one(b, tagIs('b'))) || '', note: text(one(b, tagIs('small'))), act: b.attrs['data-act'] || '', data: attrsOf(b)}));
function valueBlock(n, G) {
  if (cls('value-overview')(n)) {
    const main = one(n, cls('value-overview-main')), lab = one(main, cls('value-game-label')), btn = one(n, cls('value-refresh'));
    return {k: 'overview', label: text(lab), icon: icon(svgIn(lab)), amount: text(one(main, cls('value-amount'))), coverage: text(one(main, cls('value-coverage'))),
      copies: text((main.kids || []).find(k => k.tag === 'p' && cls('small')(k))), refresh: btn && {label: glyph(text(btn)).label, act: btn.attrs['data-act'] || ''},
      saved: text(one(n, x => x.attrs?.['data-value-saved-note'] !== undefined)), chart: valueChartModel(one(n, cls('value-chart'))),
      sources: valueSourcesModel(one(n, cls('value-price-sources'))), sourceNote: text(one(n, cls('value-source-note')))};
  }
  if (cls('value-composition')(n)) {
    const head = one(n, cls('value-section-head'));
    return {k: 'composition', title: text(one(head, tagIs('h3'))), tag: text(one(head, tagIs('span'))),
      meters: all(n, cls('value-meter')).map(m => { const dot = one(one(m, cls('value-meter-name')), tagIs('i')), bar = one(one(m, cls('value-meter-track')), tagIs('i'));
        return {name: text(one(m, cls('value-meter-name'))), colors: bgColors(dot?.attrs.style), total: text((m.kids || []).find(k => k.tag === 'b')), width: widthOf(bar) / 100, copies: text(one(m, tagIs('small')))}; }),
      empty: text((n.kids || []).find(k => k.tag === 'p' && cls('muted')(k))), note: text(one(n, cls('value-chart-note')))};
  }
  if (cls('advice')(n)) {
    const sum = one(n, tagIs('summary')), groups = []; let head = '';
    for (const k of n.kids || []) { if (!k.tag) continue; if (cls('list-head')(k)) head = text(k);
      else if (cls('list')(k)) groups.push({head, rows: all(k, cls('adv-row')).map(b => { const imp = one(b, cls('imp-row')), sp = one(one(b, cls('ellip')), tagIs('span'));
        return {name: text(one(sp, tagIs('b'))), emblem: imp && {title: imp.attrs.title || '', icon: icon(svgIn(imp))}, note: text(one(b, tagIs('small'))),
          price: text((b.kids || []).find(x => x.tag === 'span' && cls('small')(x))), act: b.attrs['data-act'] || '', data: attrsOf(b)}; })}); }
    return {k: 'advice', title: text(one(sum, tagIs('b'))), tag: text(one(sum, tagIs('span'))), groups, foot: text(one(n, cls('foot')))};
  }
  if (cls('value-top')(n)) {
    const head = one(n, cls('value-section-head'));
    return {k: 'top', title: text(one(head, tagIs('h3'))), tag: text(one(head, tagIs('span'))), empty: text(one(one(n, cls('value-lots')), cls('muted'))),
      lots: all(n, cls('value-lot')).map(b => { const art = one(b, cls('value-lot-art')), img = one(art, tagIs('img')); let finish = null; try { finish = JSON.parse(art?.attrs['data-finish-model'] || 'null'); } catch {}
        const print = G === 'mtg' && finish && finish.key && finish.key !== 'nonfoil' && finish.printingId ? S.state.printings?.[finish.printingId] || null : null;
        return {name: text(one(b, tagIs('strong'))), details: text(one(b, cls('value-lot-details'))), copies: text(one(b, cls('value-lot-copies'))), total: text(one(b, cls('value-lot-total'))),
          origin: text(one(b, cls('price-origin'))), picture: picture(img), fallback: img ? '' : text(art), aria: b.attrs['aria-label'] || '', act: b.attrs['data-act'] || '', data: attrsOf(b),
          finish: finish && {key: finish.key || '', effect: finish.effect || art?.attrs['data-finish-effect'] || '', printingId: finish.printingId || ''}, print,
          // Yu-Gi-Oh! and Pokémon: value-page.js's finishAttrs on the lot's card (its id is the model's printingId).
          ...(G !== 'mtg' && finish ? {tcgFinish: tcgFinishOf(art, tcgCardOf(G, finish.printingId || ''))} : {})}; })};
  }
  if (n.tag === 'p' && cls('foot')(n)) return {k: 'foot', text: text(n)};
  if (cls('panel')(n)) {
    // pricehist.js alertsPanel, or views.js's Trade binder (its heading in a .row with Copy list).
    const row = (n.kids || []).find(k => k.tag && cls('row')(k)), copy = one(n, x => x.attrs?.['data-act'] === 'copySpare');
    if (row) return {k: 'spare', title: text(one(row, tagIs('h3'))), line: text(one(row, tagIs('p'))), copy: copy && {label: text(copy), act: 'copySpare'}, rows: miniRows(n),
      empty: text(one(one(n, cls('list')), cls('muted')))};
    return {k: 'alerts', title: text(one(n, tagIs('h3'))), rows: miniRows(n), empty: text((n.kids || []).find(k => k.tag === 'p' && cls('muted')(k)))};
  }
  return null;
}
function valuePage(G) {
  let html;
  if (G === 'mtg') { mtgFocus(); S.ui.collTab = 'value'; try { html = collectionPage(); } finally { S.ui.collTab = 'cards'; } }
  else { tcgFocus(G, 'collection'); const U = tcgUi(G).coll; U.tab = 'value'; try { html = tcgCollection(); } finally { U.tab = 'cards'; } }
  const t = tree(html), page = one(t, cls('collection-value-page')), empty = one(t, cls('empty'));
  const kids = page ? page.kids || [] : (t.kids || []).filter(k => k.tag && cls('panel')(k));
  return {game: G, accent: styleVar(page, 'value-accent'), empty: empty && !page ? {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), mark: text(one(empty, cls('empty-mark')))} : null,
    blocks: kids.filter(k => k.tag).map(k => valueBlock(k, G)).filter(Boolean)};
}

// ---- Collection › Binders (binders.js binderShelf / binderPage, app.js binderRows, showBinder, binderEditor). A binder is a
// saved filter over the collection (settings.binders); its pages are the matching lots, nine to a page.
// app.js binderRows, verbatim but for the game's card lookup (tcg.js cardOf).
function binderRows(game, location = null) {
  const collection = game === 'mtg' ? S.state.collection : tcgGs(game).collection;
  return collection.filter(entry => location === null || String(entry.location || '').trim() === location).map(entry => {
    const c = game === 'mtg' ? magicOwnedCard(entry, S.state.printings?.[entry.printingId]) : tcgCardOf(game, entry.cardId);
    const variant = c?.variants?.find(v => v.key === entry.variant);
    return {entry, card: c, game, owned: true, image: game === 'mtg' ? cardImage(c) : variant?.image || c?.image || '', version: variant?.label || entry.variantLabel || [entry.set || c?.set?.id, entry.finish, entry.edition].filter(Boolean).join(' · ')};
  });
}
const binderById = id => (S.state.settings.binders || []).find(b => b.id === id);
function binderFocus(G) { if (G === 'mtg') mtgFocus(); else tcgFocus(G, 'collection'); }
// The shelf as views.js collection() / tcg.js tcgCollection() draw it with the Binders tab open.
function binderShelfModel(G) {
  let html;
  if (G === 'mtg') { mtgFocus(); S.ui.collTab = 'binders'; try { html = collectionPage(); } finally { S.ui.collTab = 'cards'; } }
  else { tcgFocus(G, 'collection'); const U = tcgUi(G).coll; U.tab = 'binders'; try { html = tcgCollection(); } finally { U.tab = 'cards'; } }
  const t = tree(html), shelf = one(t, cls('binder-shelf')), head = one(shelf, cls('row')), empty = one(shelf, cls('binder-empty-state')), add = one(head, x => x.attrs['data-act'] === 'newBinder');
  return {game: G, eyebrow: text(one(head, cls('eyebrow'))), title: text(one(head, tagIs('h2'))), add: add && glyph(text(add)),
    line: text((shelf?.kids || []).find(k => k.tag === 'p' && cls('muted')(k))),
    empty: empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), button: text(one(empty, tagIs('button')))},
    // app.js tileMenu: holding a binder offers Open binder and Edit cover and cards (actionIcon binder / brush).
    hold: {title: 'Binder', items: [['openBinder', 'binder', 'Open binder'], ['editBinder', 'brush', 'Edit cover and cards']].map(([act, ic, label]) => ({act, label, icon: icon(svgIn(tree(ICON[ic] || '')))}))},
    binders: all(shelf, cls('stash-binder')).map(b => { const win = one(b, cls('stash-window')), bg = one(b, cls('stash-custom-background')), lab = one(b, cls('stash-binder-label'));
      return {id: b.attrs['data-binder'] || '', color: styleVar(b, 'binder'), background: bg?.attrs.src || '', cover: text(one(b, cls('stash-cover-title'))),
        n: Number((classes(win).find(c => /^w\d$/.test(c)) || 'w1').slice(1)),
        slots: all(win, cls('stash-slot')).map(s => { const img = one(s, tagIs('img')); return cls('only')(s) ? {empty: true, only: true} : cls('empty')(s) || !img ? {empty: true} : {starred: cls('starred')(s), picture: picture(img)}; }),
        title: text(one(lab, tagIs('b'))), subtitle: text(one(lab, tagIs('small'))), hint: text(one(lab, cls('stash-open-hint')))}; })};
}
// app.js showBinder (the account's own binders): its rows, the page clamped, binderPage read into pockets; the pages either side
// (.stash-under) come with it, so the page being dragged shows the real next one underneath.
function binderModel(G, id, page = 0) {
  binderFocus(G);
  const b = binderById(id);
  if (!b || b.game !== G) return {gone: true};
  const allRows = binderRows(b.game), rows = allRows.filter(r => binderMatches(r, b)), pages = Math.max(1, Math.ceil(rows.length / 9));
  const at = Math.max(0, Math.min(pages - 1, Number(page) || 0));
  const t = tree(binderPage(rows, b.title, at, 'next', b, {collectionRows: allRows}));
  return binderParse(G, t, b.id, b.color || '', at, pages);
}
// A friend's shared binder (app.js showBinder with data.sharedItem): binders.js binderPage, read-only, over the item's own cards
// (community-profile.js sharedBinderRows), its pockets opening A.sharedCard, then sharedBinderValue's reference subtotal.
let sharedItem = null, sharedPrint = null, dailyPrint = null;
function sharedBinderModel(item, page = 0) {
  binderFocus(item.game); sharedItem = item;
  const rows = sharedBinderRows(item), pages = Math.max(1, Math.ceil(rows.length / 9));
  const at = Math.max(0, Math.min(pages - 1, Number(page) || 0));
  const t = tree(binderPage(rows, item.title, at, 'next', {color: item.appearance?.color}, {readOnly: true, cardAttrs: r => `data-act="sharedCard" data-index="${r.index}"`}) + sharedBinderValue(item));
  const v = one(t, cls('community-binder-value'));
  return {...binderParse(item.game, t, item.key, item.appearance?.color || '', at, pages), shared: true,
    value: v && {total: text(one(v, tagIs('strong'))), line: text(one(v, tagIs('span'))), note: text(one(v, tagIs('small')))}};
}
function binderParse(G, t, id, color, at, pages) {
  const head = one(t, cls('sheet-head')), tools = one(t, cls('stash-page-tools')), notice = one(t, cls('binder-cover-notice')), opts = one(tools, x => x.attrs['data-act'] === 'editBinder');
  const pocketOf = p => { const btn = one(p, cls('pocket-open')), star = one(p, cls('pocket-star')), img = one(btn, tagIs('img')), im = one(btn, cls('pocket-image')); let finish = null; try { finish = JSON.parse(im?.attrs['data-finish-model'] || 'null'); } catch {}
    const entry = btn?.attrs['data-entry'] || '';
    return {entry, name: text(one(btn, tagIs('b'))), version: text(one(btn, tagIs('small'))), qty: text(one(btn, cls('pocket-qty'))), aria: btn?.attrs['aria-label'] || '',
      act: btn?.attrs['data-act'] || '', data: attrsOf(btn), picture: picture(img), fallback: img ? '' : text(im), starred: cls('starred')(p),
      star: star && {on: cls('on')(star), aria: star.attrs['aria-label'] || ''},
      finish: finish && {key: finish.key || '', effect: finish.effect || im?.attrs['data-finish-effect'] || '', printingId: finish.printingId || ''},
      print: G === 'mtg' && finish && finish.key && finish.key !== 'nonfoil' && finish.printingId ? S.state.printings?.[finish.printingId] || null : null,
      // Yu-Gi-Oh! and Pokémon: binders.js's finishAttrs on the pocket's card (its id is the model's printingId).
      ...(G !== 'mtg' && finish ? {tcgFinish: tcgFinishOf(im, tcgCardOf(G, finish.printingId || ''))} : {})}; };
  const pageNode = one(t, cls('stash-pocket-page'));
  const under = dir => { const u = one(t, x => cls('stash-under')(x) && x.attrs['data-under'] === String(dir)); return u ? all(u, cls('stash-pocket')).map(p => { const img = one(p, tagIs('img')); return img ? {picture: picture(img)} : {empty: true}; }) : null; };
  const turn = all(one(t, cls('stash-turn-bar')), tagIs('button'));
  const setLink = one(t, x => x.attrs['data-act'] === 'go' && /^#set\//.test(x.attrs['data-to'] || ''));
  return {game: G, id, color, page: at, pages, eyebrow: text(one(head, cls('eyebrow'))), title: text(one(head, tagIs('h2'))),
    options: opts && text(opts), count: text(one(tools, cls('stash-page-count'))),
    notice: notice && {lines: all(notice, cls('foot')).map(text), button: text(one(notice, tagIs('button')))},
    pockets: (pageNode?.kids || []).filter(k => k.tag && cls('stash-pocket')(k)).map(p => cls('empty-pocket')(p) ? {empty: true, mark: text(p)} : pocketOf(p)),
    next: under(1), prev: under(-1),
    back: turn[0] && {label: text(turn[0]), off: turn[0].attrs.disabled !== undefined, aria: turn[0].attrs['aria-label'] || ''},
    forward: turn[1] && {label: text(turn[1]), off: turn[1].attrs.disabled !== undefined, aria: turn[1].attrs['aria-label'] || ''},
    dots: all(one(t, cls('stash-dots')), tagIs('i')).length,
    none: text(one(t, x => x.tag === 'p' && cls('center')(x))), set: setLink && {label: text(setLink), code: decodeURIComponent((setLink.attrs['data-to'] || '').slice(5))},
    foot: text((t.kids || []).filter(k => k.tag === 'p' && cls('foot')(k)).at(-1))};
}
// app.js binderEditor and C.binderRule: the sheet's fields (a new binder, or one to change) and the caption and hint each rule shows.
const BINDER_HINTS = {location: ['Location name (optional)', 'Leave blank to use the binder name. Assign cards here using Where it lives.'], set: ['Set code', 'Use the exact set code: Pokémon base1, Magic FDN, or Yu-Gi-Oh! LOB.'], type: ['Card type', 'Examples: Land, Creature, Trainer or Spell.'], color: ['Color / energy / attribute', 'Examples: Fire, Water, W, U, B, R, G or DARK.'], rarity: ['Rarity', 'Use the exact rarity name shown on your cards.']};
const BINDER_RULES = [['all', 'All my cards'], ['set', 'A specific set'], ['rare', 'Rare cards and above'], ['rarity', 'An exact rarity'], ['type', 'Card type'], ['color', 'Color / energy / attribute'], ['location', 'Cards placed in this binder']];
function binderEditModel(G, id) {
  binderFocus(G);
  const b = id ? binderById(id) : null;
  return {game: b?.game || G, id: b?.id || '', heading: b ? 'Binder settings' : 'New binder', title: b?.title || '', rule: b?.rule || 'location', value: b?.value || '',
    color: b?.color || BINDER_COLORS[(S.state.settings.binders || []).length % BINDER_COLORS.length], colors: BINDER_COLORS,
    background: b?.background?.startsWith('https:') ? b.background : '', uploaded: !!b?.background?.startsWith('data:'), bgData: b?.background?.startsWith('data:') ? b.background : '',
    rules: BINDER_RULES.map(([value, label]) => ({value, label})), hints: Object.fromEntries(Object.entries(BINDER_HINTS).map(([k, [caption, hint]]) => [k, {caption, hint}])),
    noValue: ['all', 'rare'], placeholder: 'Fire Pokémon, rare finds, land library…', valuePlaceholder: 'e.g. base1, Rare, Fire, Land, W, LIGHT', fallbackCaption: 'Filter value'};
}

// icons.js decorateGlyphs: a label that starts with one of these and a space wears that icon in its place (LEAD, as the site has it).
const LEAD = { "▲": "warn", "●": "stop", "⚔": "sword", "☠": "poison", "🎲": "random", "⚒": "build", "✧": "ideas", "🏆": "trophy", "⇄": "compare", "♡": "heart", "♥": "heartOn", "＋": "plus", "+": "plus", "↥": "import", "↓": "export", "⟳": "refresh", "↻": "flip", "⧉": "copy", "🔗": "link", "🖨": "print", "📷": "camera", "◈": "pack", "☆": "bookmark", "▦": "collection", "📖": "book", "◷": "history", "🛒": "bag", "⌕": "search", "☑": "pick", "⚠": "warn", "🖌": "brush", "✓": "check", "←": "back", "‹": "back", "▧": "scan" };
const glyph = s => { const m = /^(\s*)(\S)\uFE0F?[ \u00a0](?=\S)/u.exec(s); return m && LEAD[m[2]] && ICON[LEAD[m[2]]] ? {icon: icon(svgIn(tree(ICON[LEAD[m[2]]]))), label: s.slice(m[0].length)} : {icon: null, label: s}; };
// style.css .wc-open svg: an outline, 1.8 wide, round ends.
const WC_SVG = {fill: 'none', stroke: 'currentColor', sw: 1.8, cap: 'round', join: 'round'};
// Its data-id (decksTab's tab), data-format (Create a <format> deck), data-deck and data-home (Random deck from the Decks page) go
// with it, as the site's handler reads them off the button.
const button = b => { const g = glyph(text(b)); return {label: g.label, act: b.attrs['data-act'] || '', ghost: cls('ghost')(b), chest: cls('wc-open')(b), aria: b.attrs['aria-label'] || '', icon: icon(svgIn(b), cls('wc-open')(b) ? WC_SVG : {}) || g.icon,
  id: b.attrs['data-id'] || '', format: b.attrs['data-format'] || '', deck: b.attrs['data-deck'] || '', home: b.attrs['data-home'] || '', to: b.attrs['data-to'] || ''}; };
const widthOf = n => Number((/width:\s*([\d.]+)%/.exec(n?.attrs?.style || '') || [])[1]) || 0;

// views.js deckTile: cover art, format chip and its emblem, the deck box (power.js / deck-box.js), colour identity, name, size line,
// power chip, owned share and what is left to find, and the owned bar.
function deckTileModel(n) {
  const to = n.attrs['data-to'] || '', fmt = one(n, cls('deck-format-emblem')), box = one(n, cls('deck-box')), body = one(n, cls('tile-body')), chip = one(n, cls('power-chip'));
  const owned = one(n, cls('tile-owned')), find = one(n, cls('tile-find')), em = text(one(chip, tagIs('em')));
  const cover = one(one(n, cls('tile-art')), tagIs('img'));
  // ui.js img / tierRing: the cover card's price tier rings the art.
  return {id: decodeURIComponent(to.replace(/^#deck\//, '')), to, wide: cls('wide')(n), cover: picture(cover), tier: cover?.attrs['data-tier'] || '', tierColor: ((/--tier:\s*([^;]+)/.exec(cover?.attrs.style || '') || [])[1] || '').trim(),
    format: {name: text(fmt), icon: icon(svgIn(fmt))},
    box: box && {color: ((/--deck-box-color:\s*([^;]+)/.exec(box.attrs.style || '') || [])[1] || '').trim(), cards: all(one(box, cls('deck-box-cards')), tagIs('img')).map(i => i.attrs.src || '')},
    dots: all(one(n, cls('dots')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
    name: text(one(body, tagIs('b'))), line: text(one(body, tagIs('small'))),
    power: chip && {value: em, label: text(chip).slice(em.length).trim(), level: ((/\bp-(hi|mid|lo)\b/.exec(chip.attrs.class || '') || [])[1]) || 'mid', title: chip.attrs.title || ''},
    owned: text(one(owned, tagIs('em'))), ownedText: text(owned).slice(text(one(owned, tagIs('em'))).length).trim(),
    find: text(one(find, tagIs('em'))), findText: text(find).slice(text(one(find, tagIs('em'))).length).trim(),
    bar: widthOf(one(one(body, cls('bar')), tagIs('span'))) / 100};
}

// views.js decks(), My decks: the page head, its tabs and tools, and every deck as deckTile draws it. [o] = {q} as I.shelfSearch sets it.
function decksPage(game, o = {}) {
  const ui = S.ui;
  // [o.tab]: the head, tabs and tools as the site draws them with that tab open (Ideas and Meta decks keep the head's buttons); the
  // tab is put back to My decks after, so nothing else reads it.
  const tab = ['ideas', 'inspiration'].includes(o.tab) ? o.tab : 'mine';
  ui.decksTab = tab; if (o.q !== undefined) ui.q.shelf = String(o.q);
  let html; try { html = decksView(); } finally { ui.decksTab = 'mine'; }
  const mine = tab === 'mine';
  const t = tree(html), head = one(t, cls('page-head')), empty = one(t, cls('empty')), search = one(one(t, cls('toolbar')), tagIs('input')), list = one(t, x => x.attrs.id === 'shelfList');
  return {game, title: text(one(head, tagIs('h1'))), actions: all(one(head, cls('head-actions')), tagIs('button')).map(button),
    tabs: all(one(t, cls('seg')), tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))})),
    tools: all(one(t, cls('random-tools')), tagIs('button')).map(button),
    search: search && {value: search.attrs.value || '', placeholder: search.attrs.placeholder || '', label: search.attrs['aria-label'] || ''},
    tiles: mine ? all(t, x => cls('deck-tile')(x)).map(deckTileModel) : [],
    none: list ? text(one(list, x => x.tag === 'p')) : '', tab,
    empty: mine && empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), mark: text(one(empty, cls('empty-mark'))), actions: all(empty, tagIs('button')).map(button)}};
}


// tcg.js deckTile, a Yu-Gi-Oh! or Pokémon deck: its cover (ygoCropArt's cropped art, or pokemonArtCrop's art window), format chip and
// deck box, the legality chip, name, plan and size, power, then every stat as the tile words it (owned, value, to finish), and the bar.
function tcgDeckTileModel(n) {
  const to = n.attrs['data-to'] || '', top = one(n, cls('tile-top')), stack = one(top, cls('deck-format-stack')), box = one(n, cls('deck-box')), body = one(n, cls('tile-body'));
  const chip = one(n, cls('power-chip')), em = text(one(chip, tagIs('em'))), check = (top?.kids || []).find(k => k.tag && cls('chip')(k));
  const stats = (one(body, cls('tile-stats'))?.kids || []).filter(k => k.tag === 'span' && !cls('power-chip')(k)).map(k => { const v = text(one(k, tagIs('em'))); return {value: v, label: text(k).slice(v.length).trim()}; });
  return {id: decodeURIComponent(to.replace(/^#tdeck\//, '')), to, cover: null, ...coverPic(one(n, cls('tile-art'))), tier: '', tierColor: '',
    format: {name: text(one(stack, cls('chip'))), icon: null},
    box: box && {color: ((/--deck-box-color:\s*([^;]+)/.exec(box.attrs.style || '') || [])[1] || '').trim(), cards: all(one(box, cls('deck-box-cards')), tagIs('img')).map(i => i.attrs.src || '')},
    dots: [], check: check ? {text: text(check), tone: cls('bad-chip')(check) ? 'bad' : cls('warn')(check) ? 'warn' : cls('ok-chip')(check) ? 'ok' : ''} : null,
    name: text(one(body, tagIs('b'))), line: text(one(body, tagIs('small'))),
    power: chip && {value: em, label: text(chip).slice(em.length).trim(), level: ((/\bp-(hi|mid|lo)\b/.exec(chip.attrs.class || '') || [])[1]) || 'mid', title: chip.attrs.title || ''},
    stats, bar: widthOf(one(one(body, cls('bar')), tagIs('span'))) / 100};
}
// tcg.js tcgDecks(), My decks of a Yu-Gi-Oh! or Pokémon collection, in decksPage's model.
function tcgDecksPage(G, o = {}) {
  const tab = ['ideas', 'inspiration'].includes(o.tab) ? o.tab : 'mine', mine = tab === 'mine';
  tcgFocus(G, 'decks'); S.ui.decksTab = tab;
  let html; try { html = tcgDecks(); } finally { S.ui.decksTab = 'mine'; }
  const t = tree(html), head = one(t, cls('page-head')), empty = one(t, cls('empty'));
  return {game: G, title: text(one(head, tagIs('h1'))), actions: all(one(head, cls('row')), tagIs('button')).map(button),
    tabs: all(one(t, cls('seg')), tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))})),
    tools: all(one(t, cls('random-tools')), tagIs('button')).map(button), search: null,
    tiles: mine ? all(t, x => cls('deck-tile')(x)).map(tcgDeckTileModel) : [], none: '', tab,
    empty: mine && empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p'))), mark: text(one(empty, cls('empty-mark'))), actions: all(empty, tagIs('button')).map(button)}};
}

// views.js deckPage(), the Cards tab: deckShell's hero (deck-viewer.js), the actions under it, the deck tabs, the card toolbar,
// the cards as deckRow / mtgSideboard draw them, the emblem panel (importance.js deckEmblemHtml) and "Take it to the table".
const DECK_VIEWS = ['stacks', 'gallery', 'symbols', 'compact'];
const tierOfNode = n => ({tier: n?.attrs?.['data-tier'] || 'tn', tierColor: ((/--tier:\s*([^;]+)/.exec(n?.attrs?.style || '') || [])[1] || '').trim()});
const lead = b => { const g = glyph(text(b)); return {label: g.label, icon: icon(svgIn(b)) || g.icon}; };
function deckRowModel(n) {
  const r = lotRow(n), own = one(n, cls('own')), side = one(n, cls('lot-side')), chip = one(side, cls('chip')), sub = one(n, cls('lot-sub'));
  return {...r, id: n.attrs['data-deck-name'] || r.name, name: n.attrs['data-deck-name'] || r.name, sub: [], tag: null,
    qty: Number(n.attrs['data-deck-qty']) || r.qty, zone: n.attrs['data-deck-zone'] || 'main', category: n.attrs['data-deck-category'] || 'Unresolved',
    roles: (n.attrs['data-deck-roles'] || '').split(',').filter(Boolean), short: cls('short')(n),
    own: own ? {text: text(own), yes: cls('yes')(own)} : null,
    legal: all(sub, cls('tag')).map(t => ({text: text(t), bad: cls('bad')(t)})),
    chip: chip ? text(chip) : '', stepper: !!one(side, cls('stepper')),
    // ui.js tileChrome on the art: the colour emblems (mana symbols) and the set symbol in its rarity, docked at the foot.
    chrome: lotChrome(n)};
}
function miniRowModel(n) {
  const img = one(n, tagIs('img')), small = one(n, x => x.tag === 'span' && cls('small')(x));
  return {name: n.attrs['data-deck-name'] || n.attrs['data-name'] || '', qty: Number(n.attrs['data-deck-qty']) || 0, zone: n.attrs['data-deck-zone'] || 'side',
    category: n.attrs['data-deck-category'] || 'Unresolved', roles: (n.attrs['data-deck-roles'] || '').split(',').filter(Boolean),
    picture: picture(img), ...tierOfNode(img), label: text(one(n, cls('ellip'))), own: small ? {text: text(small), ok: cls('ok-text')(small)} : null};
}
// deck-viewer.js stackList / stackSummary, which rebuild the list in the page: the same piles as data. Cards group by their type in
// GROUP_ORDER, six to a pile; a group's heading hides when it is the list's only type and the list's own heading already names it.
const GROUP_ORDER = ['Commander', 'Creatures', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Enchantments', 'Battles', 'Lands', 'Pokémon', 'Trainers', 'Energy', 'Monsters', 'Spells', 'Traps', 'Unresolved'];
function stacksOf(rows, heading) {
  const groups = new Map();
  rows.forEach((r, i) => { const c = r.category || 'Unresolved'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(i); });
  let piles = 0;
  const out = [...groups].sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)).map(([category, idx]) => {
    const pile = []; for (let i = 0; i < idx.length; i += 6) pile.push(idx.slice(i, i + 6)); piles += pile.length;
    return {category, count: idx.reduce((n, i) => n + (Number(rows[i].qty) || 0), 0), hidden: groups.size === 1 && heading.trim().startsWith(category), piles: pile};
  });
  return {groups: out, piles};
}
const deckAct = {
  // app.js I.deckSearch, A.deckChip, C.deckSort and workbench-ui.js A.deckView (the account's settings.displayModes[game].deck).
  search: v => { S.ui.q.deck = String(v); },
  filter: v => { S.ui.deckFilter = v || 'all'; },
  sort: v => { S.ui.deckSort = v; },
  view: v => { if (DECK_VIEWS.includes(v)) ((S.state.settings.displayModes ||= {}).mtg ||= {}).deck = v; },
};
// app.js route(): opening another deck clears the deck search.
function deckOpen(id) { if (id !== S.ui.deckId) { S.ui.q.deck = ''; S.ui.deckId = id; } }
// deck-viewer.js deckShell, as views.js deckPage and tcg.js tcgDeck both fill it: the hero (art, ← and ⋯, the eyebrow chips and the
// rules review, the name, the stats and the owned bar), the actions under it, a warning (Magic's .note, a TCG draft's .ds-status) and the
// deck's tabs. A Pokémon hero is pokemonArtCrop's art window (crop "pokemon").
function shellOf(t, game) {
  const hero = one(t, cls('ds-hero')), nav = one(hero, cls('ds-nav')), menu = one(nav, cls('ds-menu')), brow = one(hero, cls('deck-hero-eyebrow'));
  const eyebrow = (brow?.kids || []).filter(k => k.tag).map(k => cls('review-badge')(k) ? {kind: 'review', level: ['bad', 'warn', 'ok'].find(c => cls(c)(k)) || 'warn', ...lead(k), act: k.attrs['data-act'] || ''}
    : cls('dots')(k) ? {kind: 'dots', label: k.attrs['aria-label'] || '', dots: all(k, tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''}))}
    : {kind: 'chip', label: text(k), title: k.attrs.title || '', badge: cls('ds-badge')(k)});
  const art = (hero?.kids || []).find(k => k.tag && cls('hero-art')(k)), artImg = art?.tag === 'img' ? art : one(art, tagIs('img'));
  const status = one(t, cls('ds-status'));
  return {hero: {art: artImg ? {...picture(artImg), crop: cls('pk-crop')(art) ? 'pokemon' : ''} : null, back: !!one(nav, cls('icon')), menu: menu ? {label: menu.attrs['aria-label'] || '', title: menu.attrs.title || '', act: menu.attrs['data-act'] || ''} : null,
      eyebrow, title: text(one(hero, tagIs('h1'))), line: text(one(hero, cls('ds-line'))),
      stats: all(one(hero, cls('ds-stats')), cls('ds-stat')).map(x => ({value: text(one(x, tagIs('b'))), label: text(one(x, x => x.tag === 'span' && !cls('ds-stat')(x))), warn: cls('warn')(x), button: x.tag === 'button', act: x.attrs['data-act'] || '', id: x.attrs['data-id'] || ''})),
      owned: one(hero, cls('ds-bar')) ? widthOf(one(one(hero, cls('ds-bar')), tagIs('i'))) / 100 : null},
    // desktop-play.js syncDesktopPlayEntries: on every touch device Magic's Practice plate shows (the page draws it hidden until then).
    actions: all(one(t, cls('ds-actions')), tagIs('button')).map(b => ({label: text({kids: b.kids}), act: b.attrs['data-act'] || '', id: b.attrs['data-id'] || '', primary: cls('ds-primary')(b), plate: cls('cs-plate')(b),
      shown: b.attrs['data-desktop-play-entry'] === 'practice' ? game === 'mtg' : b.attrs.hidden === undefined})),
    note: (() => { const n = one(t, x => cls('note')(x) && cls('warn')(x) && x.tag === 'div'); return n ? {text: text({kids: (n.kids || []).filter(k => k.tag !== 'p')}), lines: all(n, tagIs('p')).map(text)}
      : status ? {text: text(status), lines: []} : null; })(),
    tabs: all(one(t, x => x.tag === 'nav' && cls('tabs')(x)), tagIs('button')).map(b => ({key: b.attrs['data-id'], label: text(b), on: b.attrs['aria-selected'] === 'true', icon: icon(svgIn(b))}))};
}
// importance.js deckEmblemHtml: the meta and staple tally, then each owned staple that could replace a card with no emblem.
// [outKey] / [inKey]: the Swap button's data-out / data-in (Magic's card names, a Yu-Gi-Oh! or Pokémon card's id).
const emblemsOf = embS => embS ? {tally: all(one(embS, cls('emb-tally')), cls('emb-count')).map(x => { const b = text(one(x, tagIs('b'))); return {kind: (classes(x).find(c => c.startsWith('imp-')) || '').slice(4), icon: icon(svgIn(x)), count: b, label: text(x).slice(b.length).trim()}; }),
  none: text(one(one(embS, cls('emb-tally')), cls('muted'))), head: text(one(embS, cls('list-head'))),
  swaps: all(embS, cls('emb-swap')).map(x => { const [o, i] = all(x, x => x.tag === 'button' && cls('link')(x)); const btn = one(x, x => cls('btn')(x));
    return {out: o?.attrs['data-name'] || text(o), in: i?.attrs['data-name'] || text(i), outKey: btn?.attrs['data-out'] || '', inKey: btn?.attrs['data-in'] || '', inIcon: icon(svgIn(i)), button: text(btn), why: text(one(x, cls('emb-why')))}; }),
  foot: text(one(embS, cls('foot')))} : null;
// [tab]: the tab open (A.deckTab, S.ui.deckTab); any other than Cards draws its body as a panel (mtgDeckPanel), the page round it from here.
function deckPageModel(game, id, tab = 'cards') {
  const ui = S.ui;
  deckOpen(id);
  ui.deckTab = tab;
  const t = tree(deckView()), hero = one(t, cls('ds-hero'));
  if (!hero) { const e = one(t, cls('empty')); return {game, id, missing: {title: text(one(e, tagIs('h3'))), text: text(one(e, tagIs('p')))}}; }
  const viewer = one(t, cls('deck-viewer')), list = one(viewer, x => x.attrs.id === 'deckList'), toolbar = one(t, cls('deck-toolbar'));
  const groups = all(list, x => x.tag === 'details' && cls('group')(x) && !cls('side-group')(x)).map(g => {
    const sum = one(g, tagIs('summary')), first = one(sum, tagIs('span')), em = one(first, tagIs('em'));
    const rows = all(one(g, x => x.attrs['data-deck-list'] !== undefined), x => cls('deck-row')(x)).map(deckRowModel);
    const heading = text(first);
    return {name: heading.slice(0, heading.length - text(em).length).trim(), count: text(em), rows, stacks: stacksOf(rows, heading)};
  });
  const sideG = one(viewer, cls('side-group')), sideSum = one(sideG, tagIs('summary')), sideFirst = one(sideSum, tagIs('span'));
  const sideRows = all(sideG, cls('mini-row')).map(miniRowModel);
  const embS = one(t, cls('deck-emb')), foot = one(t, cls('deck-table-footer')), footP = one(foot, tagIs('p'));
  // stackSummary: the roles of the main deck's cards, counted by copies.
  const roles = new Map();
  for (const r of groups.flatMap(g => g.rows)) if (r.zone !== 'side') for (const role of r.roles) roles.set(role, (roles.get(role) || 0) + (Number(r.qty) || 0));
  const cmdNote = one(t, x => cls('block-note')(x));
  return {game, id, format: (S.state.decks || []).find(d => String(d.id) === String(id))?.format || '', view: viewer?.attrs['data-deck-view'] || 'gallery',
    ...shellOf(t, game),
    commanderNote: cmdNote ? {text: text(cmdNote).replace(/^⚠\s*/, ''), act: cmdNote.attrs['data-act'] || '', id: cmdNote.attrs['data-id'] || ''} : null,
    search: (() => { const i = one(toolbar, tagIs('input')); return i && {value: i.attrs.value || '', placeholder: i.attrs.placeholder || '', label: i.attrs['aria-label'] || ''}; })(),
    chips: all(one(toolbar, cls('deck-chips')), tagIs('button')).map(b => { const c = text(one(b, tagIs('b'))); const l = text(b); return {id: b.attrs['data-id'], label: c ? l.slice(0, l.length - c.length).trim() : l, count: c, on: cls('on')(b)}; }),
    group: selectOf(one(toolbar, x => x.tag === 'select')),
    add: (() => { const b = one(toolbar, cls('deck-add-toggle')); return b ? {...lead(b), title: b.attrs.title || ''} : null; })(),
    views: all(one(toolbar, cls('deck-view-switch')), tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})),
    groups, none: groups.length ? '' : text(one(list, x => x.tag === 'p')),
    roles: [...roles].map(([role, count]) => ({role, count})),
    side: sideG ? {count: text(one(sideFirst, tagIs('em'))), over: text(one(sideFirst, cls('warn-text'))).replace(/^·\s*/, ''), status: text(one(sideSum, cls('muted'))),
      text: text(one(sideG, x => x.tag === 'p')), rows: sideRows, stacks: stacksOf(sideRows, text(sideFirst))} : null,
    emblems: emblemsOf(embS),
    table: foot ? {title: text(one(foot, tagIs('h3'))), line: runs(footP || {kids: []}), bar: widthOf(one(one(foot, cls('bar')), tagIs('span'))) / 100,
      actions: all(one(foot, cls('deck-table-actions')), tagIs('button')).map(b => ({label: text(b), act: b.attrs['data-act'] || '', ghost: cls('ghost')(b)}))} : null,
    glyphs: Object.fromEntries(["minus", "plus", "more", "back"].map(k => [k, icon(svgIn(tree(ICON[k])))]))};
}

// tcg.js tcgDeck(), a Yu-Gi-Oh! or Pokémon deck's page on its Cards tab (deckCardsTab), in deckPageModel's shape: the same deckShell
// parts, then the deck view switch, "Add a card by name" and what it found, the format's note, the emblem panel, the rules review,
// each zone as its heading (Deck / Main Deck, Extra Deck, Side Deck with count and rule) and its rows, and the panel under them
// (what is left to get and its cost, the price tools, the foot).
function tcgDeckRow(n) {
  const r = deckRowModel(n), nm = one(n, cls('lot-name')), sub = one(n, cls('lot-sub')), side = one(n, cls('lot-side')), art = one(n, cls('lot-art')), less = one(side, x => x.attrs['data-act'] === 'tDeckQty'), move = one(side, x => x.attrs['data-act'] === 'tDeckMove');
  // The Yu-Gi-Oh! purchase identity a row may carry (deckActionRow): passed back with the row's ± and move as the site's buttons carry it.
  const row = less ? Object.fromEntries(['data-row-index', 'data-purchase-identity'].filter(k => less.attrs[k] !== undefined).map(k => [k === 'data-row-index' ? 'rowIndex' : 'purchaseIdentity', less.attrs[k]])) : {};
  return {...r, cardId: nm?.attrs['data-id'] || '', price: text(one(art, cls('art-price'))),
    // .lot-sub in order, the legality tags left to [legal]: the game's emblems, the set badge, the purchase note.
    pieces: subPieces({kids: (sub?.kids || []).filter(k => !(k.tag && cls('tag')(k)))}), tchrome: tcgChromeOf(one(art, cls('tile-chrome'))),
    tcgFinish: tcgFinishOf(art, tcgCardOf(tcgGame(), nm?.attrs['data-id'] || '')), move: move ? text(move) : '', row,
    // What its A.tCard hands the card page (purchaseRowAttrs): Pokémon's purchase variant, Yu-Gi-Oh!'s printing and edition.
    open: Object.fromEntries([['data-set-variant', 'setVariant'], ['data-printing', 'printing'], ['data-edition', 'edition']].filter(([a]) => nm?.attrs[a] !== undefined).map(([a, k]) => [k, nm.attrs[a]])),
    // Deck Bench: what tints the row's strip, the card's own Attribute (Yu-Gi-Oh!) or types (Pokémon).
    tint: tcgTint(tcgCardOf(tcgGame(), nm?.attrs['data-id'] || ''))};
}
const tcgTint = c => !c ? [] : c.game === 'ygo' ? [c.category === 'Monster' ? c.attribute || '' : c.category || ''].filter(Boolean)
  : (c.types?.length ? c.types : [String(c.name || '').match(/^(?:Basic )?(\w+) Energy$/)?.[1] || c.category || '']).filter(Boolean);
/**
 * Deck Bench's browser for a Yu-Gi-Oh! or Pokémon deck: the game's collection, a tile per card (tcg.js gs(G).collection by cardId),
 * its picture as the site draws it (artwork.js artworkHTML), its type group (deck-viewer.js deckCardCategory), copies owned, and the
 * format's copy limit for it (SOURCES[G].limit, which addToDeck checks: -1 when there is none, basic Energy).
 */
function tcgBenchPool(G, id) {
  tcgFocus(G, 'tdeck'); S.ui.tdeckId = id; tdeckAt = [G, id];
  const st = tcgGs(G), d = st.decks.find(x => x.id === id), fs = tcgSources[G].formats, f = fs.find(x => x.id === d?.format) || fs[0];
  const by = new Map();
  for (const e of st.collection || []) { if (!(Number(e.qty) > 0)) continue; const k = String(e.cardId), o = by.get(k) || {id: k, name: e.name || '', own: 0}; o.own += Number(e.qty); by.set(k, o); }
  return [...by.values()].map(o => tcgTileOf(G, tcgCardOf(G, o.id), f, o));
}
// One browser tile for card [c] (or [o]'s id and name while the card is not known): picture, type group, the format's limit and word.
function tcgTileOf(G, c, f, o = {}) {
    const p = c ? picture(one(tree(artworkHTML(c)), tagIs('img'))) : null, lim = c ? tcgSources[G].limit(c, f) : 3;
    // addToDeck refuses a printing not legal in the format; the deck rows' own tags (deckCardsTab) say why.
    const legal = !c || tcgSources[G].legality(c, f) !== 'not_legal';
    const tag = !legal ? 'Not legal' : lim === 0 ? 'Forbidden' : lim === 1 && G === 'ygo' ? 'Limited' : lim === 2 ? 'Semi-Limited' : '';
    return {id: String(c?.id ?? o.id), name: c?.name || o.name || '', image: p?.src || c?.image || '', sources: p?.sources || [], category: c ? deckCardCategory(c) : 'Unresolved', extra: !!c?.extra,
      level: Number(c?.level) || 0, basic: !!c?.basicEnergy, limit: Number.isFinite(lim) ? lim : -1, legal, tag, tagBad: !legal || lim === 0, own: o.own || 0, tint: tcgTint(c)};
}

// ---------------------------------------------------------------- All cards, shelf by shelf (Randall 6-7 Nov: "only when you pick All")
// The Bench's All cards for a Yu-Gi-Oh! or Pokémon deck, a shelf at a time so thousands of cards never load at once: first "For this
// deck", the format's tournament staples the list doesn't play (tcg.js deckUpgradeTab's rule: Yu-Gi-Oh! cards in 20 %+ of top decks,
// Pokémon Trainers in 30 %+, from meta.js), then each set newest first (tcg.js loadSets), its cards only when the app asks for that shelf
// (SOURCES[G].setCards, as the set page loads them). The app pumps the lookups with settle() and reads shelvesModel / shelfModel.
const shelfWork = new Map();
const shelfDeck = (G, id) => { const st = tcgGs(G), d = st.decks.find(x => x.id === id), fs = tcgSources[G].formats; return {d, f: fs.find(x => x.id === d?.format) || fs[0]}; };
const shelfOwned = G => { const m = new Map(); for (const e of tcgGs(G).collection || []) if (Number(e.qty) > 0) m.set(String(e.cardId), (m.get(String(e.cardId)) || 0) + Number(e.qty)); return m; };
function shelvesStart(G, id) {
  tcgCtx.loadSets(G).catch(() => {});
  const {d} = shelfDeck(G, id);
  // power.js judges against these fields only: Pokémon data is Standard, Yu-Gi-Oh! data is TCG Advanced.
  const formatOk = G === 'ptcg' ? (d?.format || 'standard') === 'standard' : (d?.format || 'tcg') === 'tcg';
  const k = 'fit|' + G + '|' + id;
  if (!formatOk || shelfWork.get(k)?.busy) return;
  const w = {busy: true, error: '', rows: null}; shelfWork.set(k, w);
  (async () => {
    const data = await loadMeta(G).catch(() => metaState(G).data);
    const inDeck = new Set([...(d?.zones?.main || []), ...(d?.zones?.extra || [])].flatMap(r => [String(r.cardId), String(tcgCardOf(G, r.cardId)?.name || r.name || '').toLowerCase()]));
    const top = (data?.top || []).filter(x => G === 'ygo' ? x.pct >= 20 : x.kind === 'Trainer' && x.pct >= 30)
      .filter(x => !inDeck.has(String(x.id || '')) && !inDeck.has(String(x.name).toLowerCase())).slice(0, 16);
    const rows = [];
    if (G === 'ygo') { const want = top.map(x => String(x.id)).filter(i => i && !tcgCardOf(G, i)); if (want.length) await tcgEnsureMany(G, want).catch(() => {});
      for (const x of top) { const c = tcgCardOf(G, String(x.id)); if (c) rows.push({c, why: `${Math.round(x.pct)}% of top decks`}); } }
    else for (const x of top) {
      // tcg.js deckUpgradeTab's cardFor: a Pokémon staple's printing the cache knows that is legal in the deck's format; one not known
      // yet is looked up by name and kept only when legal.
      const {f} = shelfDeck(G, id);
      let c = Object.values(tcgCache.ptcg).find(v => v.name?.toLowerCase() === x.name.toLowerCase() && !v.pocket && tcgSources.ptcg.legality(v, f) === 'legal');
      if (!c) { c = await tcgSources.ptcg.byName(x.name).catch(() => null); if (c && (c.pocket || tcgSources.ptcg.legality(c, f) !== 'legal')) c = null; }
      if (c) rows.push({c, why: `${Math.round(x.pct)}% of top decks`});
    }
    w.rows = rows;
  })().catch(e => { w.error = e?.message || 'Tournament decks could not load.'; }).finally(() => { w.busy = false; });
}
function shelvesModel(G, id) {
  const {f} = shelfDeck(G, id), U = tcgUi(G).sets, own = shelfOwned(G), today = new Date().toISOString().slice(0, 10), fit = shelfWork.get('fit|' + G + '|' + id);
  const sets = (U.list || []).filter(s => s?.id && s.date && String(s.date).slice(0, 10) <= today && !(Number(s.count) > 0 && Number(s.count) < 10))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(s => ({id: String(s.id), name: s.name || '', code: String(s.code || s.id).toUpperCase(), date: String(s.date).slice(0, 10), count: Number(s.count) || 0}));
  return {busy: !!U.busy, error: U.error || '', sets,
    fit: fit ? {busy: !!fit.busy, error: fit.error, tiles: (fit.rows || []).map(({c, why}) => ({...tcgTileOf(G, c, f, {own: own.get(String(c.id)) || 0}), why})).filter(t => t.legal)} : null};
}
function shelfStart(G, id, setId) {
  const k = 'set|' + G + '|' + setId, have = shelfWork.get(k);
  if (have && (have.busy || have.cards)) return;
  const w = {busy: true, error: '', cards: null}; shelfWork.set(k, w);
  (async () => {
    if (!tcgUi(G).sets.list.length) await tcgCtx.loadSets(G);
    const info = tcgUi(G).sets.list.find(s => String(s.id) === String(setId));
    if (!info) throw Error('This set could not be found.');
    const cards = await tcgSources[G].setCards(info);
    // Each card once (a set lists reprints and rarities as rows), as the set page keeps them in tcg.js's card cache.
    const seen = new Set(); w.cards = [];
    // Kept as the card itself, not the set's view of it (setContext: the set page's own price and printing), as the set page keeps it.
    for (const c of cards) { if (!c?.id || c.pocket || seen.has(String(c.id))) continue; seen.add(String(c.id));
      const {setContext, ...card} = c; if (!tcgCardOf(G, c.id) || (tcgCardOf(G, c.id).brief && !card.brief)) tcgCache[G][c.id] = card; w.cards.push(String(c.id)); }
    // tcg.js tcgSearch: a Pokémon format that checks card text (legal sets, no Rule Box) can't judge a brief card, so its details are
    // fetched (ensureMany, as the search's hydrateSearch does) and the shelf shows each card once they are in.
    const {f} = shelfDeck(G, id);
    if (shelfNeedsDetails(G, f)) { const want = w.cards.filter(i => tcgCardOf(G, i)?.brief); if (want.length) await tcgEnsureMany(G, want, () => {}).catch(() => {}); }
  })().catch(e => { w.error = e?.message || 'This set could not load.'; }).finally(() => { w.busy = false; });
}
const shelfNeedsDetails = (G, f) => G === 'ptcg' && !!(f && (f.legal || f.noRuleBox));
function shelfModel(G, id, setId) {
  const w = shelfWork.get('set|' + G + '|' + setId); if (!w) return {busy: false, error: '', tiles: null};
  const {f} = shelfDeck(G, id), own = shelfOwned(G), details = shelfNeedsDetails(G, f);
  return {busy: !!w.busy, error: w.error, tiles: w.cards ? w.cards.filter(i => !details || !tcgCardOf(G, i)?.brief)
    .map(i => tcgTileOf(G, tcgCardOf(G, i), f, {id: i, own: own.get(i) || 0})).filter(t => t.legal || !t.name) : null};
}
// [tab]: the tab open (A.tDeckTab keeps it in S.ui.tdeckTab); left out, the one open stays. Any other than Cards draws its body
// as a panel (deckPanel); the page model then carries the hero, actions and tabs.
function tcgDeckPageModel(G, id, tab) {
  tcgFocus(G, 'tdeck'); S.ui.tdeckId = id; if (tab) (S.ui.tdeckTab ||= {})[G + ':' + id] = tab;
  const t = tree(tcgDeck(id)), hero = one(t, cls('ds-hero'));
  if (!hero) { const e = one(t, cls('empty')); return {game: G, id, missing: {title: text(one(e, tagIs('h3'))), text: text(one(e, tagIs('p')))}}; }
  const body = one(t, cls('deck-body')), viewer = one(body, cls('deck-viewer')), add = one(body, cls('deck-add')), addIn = one(add, tagIs('input')), addBtn = one(add, tagIs('button'));
  const found = one(body, cls('add-results')), issues = one(one(body, x => x.attrs.id === 'tIssuesPanel'), tagIs('details'));
  const groups = []; let open = null;
  for (const k of viewer?.kids || []) {
    if (!k.tag) continue;
    if (cls('section-head')(k)) { const h = one(k, tagIs('h2')), em = one(h, tagIs('span')), all_ = text(h); open = {name: all_.slice(0, all_.length - text(em).length).trim(), count: text(em), rows: [], none: ''}; groups.push(open); continue; }
    if (!open) continue;
    if (k.attrs['data-deck-list'] !== undefined) open.rows = all(k, x => cls('deck-row')(x)).map(tcgDeckRow);
    else if (k.tag === 'p') open.none = text(k);
  }
  for (const g of groups) g.stacks = stacksOf(g.rows, g.name);
  const roles = new Map();
  for (const r of groups.flatMap(g => g.rows)) if (r.zone !== 'side') for (const role of r.roles) roles.set(role, (roles.get(role) || 0) + (Number(r.qty) || 0));
  // The price panel closes the tab (the staples panel, section.panel.deck-emb, sits above the zones).
  const panel = (body?.kids || []).find(k => k.tag === 'section' && cls('panel')(k) && !cls('deck-emb')(k)), sum = one(panel, cls('row'));
  const d = tcgGs(G).decks.find(x => x.id === id);
  return {game: G, id, format: d?.format || '', view: viewer?.attrs['data-deck-view'] || 'gallery', ...shellOf(t, G),
    commanderNote: null, search: null, chips: [], group: null, add: null,
    views: all(one(body, cls('deck-view-switch')), tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})),
    viewLabel: text(one(one(body, cls('deck-view-toolbar')), x => x.tag === 'span')),
    find: add ? {value: addIn?.attrs.value || '', placeholder: addIn?.attrs.placeholder || '', label: addIn?.attrs['aria-label'] || '', button: text(addBtn), busy: addBtn?.attrs.disabled !== undefined} : null,
    found: found ? {rows: all(found, cls('mini-row')).map(r => { const e = one(r, cls('ellip')), sm = one(e, tagIs('small')), b = one(r, tagIs('button'));
      return {id: b?.attrs['data-id'] || '', name: text(e).slice(0, text(e).length - text(sm).length).trim(), sub: text(sm), picture: picture(one(r, tagIs('img')))}; }), close: text(one(found, cls('link')))} : null,
    formatNote: text((body?.kids || []).find(k => k.tag === 'p' && cls('small')(k) && cls('muted')(k)) || {kids: []}),
    emblems: emblemsOf(one(body, cls('deck-emb'))),
    issues: issues ? {summary: text(one(issues, tagIs('summary'))), items: all(issues, tagIs('li')).map(text)} : null,
    groups, none: '', roles: [...roles].map(([role, count]) => ({role, count})), side: null, table: null,
    panel: panel ? {left: text(one(sum, tagIs('span'))), right: text(one(sum, tagIs('b'))),
      actions: all(one(panel, cls('actions')), tagIs('button')).map(b => ({...button(b), id: b.attrs['data-id'] || '', title: b.attrs.title || '', primary: !cls('ghost')(b)})),
      foot: text(one(panel, cls('foot')))} : null,
    glyphs: Object.fromEntries(["minus", "plus", "more", "back"].map(k => [k, icon(svgIn(tree(ICON[k])))]))};
}
// tcg.js's handlers for the deck page's controls: deck-viewer.js A.deckView (the game's own settings.displayModes), I.tDeckQ, A.tDeckFind
// (a search: the results land on the page when the card source answers) and A.tDeckAddClose.
const tcgDeckAct = {
  view: v => { if (DECK_VIEWS.includes(v)) ((S.state.settings.displayModes ||= {})[tcgGame()] ||= {}).deck = v; },
  q: v => TI.tDeckQ({value: String(v)}),
  find: v => { if (v != null && v !== '') TI.tDeckQ({value: String(v)}); TA.tDeckFind(); },
  close: () => TA.tDeckAddClose(),
};

// ---------------------------------------------------------------- A card's page (views.js cardSheet, the Collection lens)
// app.js A.card opens the sheet on a context (S.ui.sheetCtx); loadCardExtras, loadMagicVersions, mtgGuideLoad and the
// rulings lookup fill it in the background; A.cardTab, A.flipFace, A.cardFinishPreview, A.viewPrint and A.priceSource
// change it. Ported here as the site has them, with the sheet's redraw left to the app (refreshSheet is its repaint).
let sheet = null;
const still = ctx => S.ui.sheetCtx === ctx;
// app.js A.card (3554-3615): [o] = {name, entry, deck}, as the tapped tile's data-name / data-entry / data-deck.
function cardOpen(o) {
  const name = String(o.name || ''), entryId = String(o.entry || ''), deckId = o.deck ? String(o.deck) : null, setI = o.setI == null || o.setI === '' ? null : Number(o.setI);
  const as = JSON.stringify([name, entryId, deckId, setI, o.setFinish || '', o.pack ?? '', o.pack != null ? pack?.stamp : '', !!o.random, o.shared ? sharedPrint?.id || '' : '', o.daily ? dailyPrint?.id || '' : '']);
  if (sheet && sheet.openedAs === as && S.ui.sheetCtx === sheet) return sheet;
  const ctx = {type: 'card', name, entryId, deckId, random: !!o.random, openedAs: as};
  sheet = S.ui.sheetCtx = ctx;
  buyCtx = null;
  // A.sharedCard: A.card with the friend's printing (t.printing), as A.sharedCard found it.
  if (o.shared) { const print = sharedPrint; if (print?.id && key(print.name) === key(name)) { ctx.print = print; ctx.setId = print.set; ctx.priceFinish = selectedFinish('mtg', print, ''); } return ctx; }
  // A.homeDailyCard: A.card with the Card of the Day's printing (t.printing), as homeDailyCard found it.
  if (o.daily) { const print = dailyPrint; if (print?.id && key(print.name) === key(name)) { ctx.print = print; ctx.setId = print.set; ctx.priceFinish = selectedFinish('mtg', print, ''); } return ctx; }
  // A set page's tile (data-set-i, data-set-finish): that printing, priced in the finish the page shows (A.card).
  // A pulled card from Open Pack (pack-preview.js onDetails → A.card with t.printing): its own printing, in the finish it came out in.
  if (o.pack != null && o.pack !== '') {
    const print = pack?.picks?.[Number(o.pack)];
    if (print?.id && key(print.name) === key(name) && typeof print.set === 'string') { ctx.print = print; ctx.setId = print.set; ctx.priceFinish = selectedFinish('mtg', print, o.setFinish || ''); }
    else { ctx.ownedNotice = 'This pack changed. Open the card again.'; ctx.blocked = true; }
    return ctx;
  }
  if (setI != null) {
    const print = S.ui.set.cards[setI];
    if (print?.id && key(print.name) === key(name) && print.set === S.ui.set.code) { ctx.print = print; ctx.setId = print.set; ctx.priceFinish = selectedFinish('mtg', print, o.setFinish || ''); }
    else { ctx.ownedNotice = 'This set changed. Open the card again.'; ctx.blocked = true; }
    return ctx;
  }
  if (entryId) {
    const owned = magicOwnedDetail(S.state, entryId, name);
    if (!owned.identity) { ctx.ownedNotice = owned.reason; ctx.blocked = true; return ctx; }
    Object.assign(ctx, magicOwnedContext(owned));
    if (owned.status === 'loading') ctx.ownedLoading = owned.identity;
    else if (owned.status !== 'ready') ctx.blocked = true;
  }
  return ctx;
}
// The saved copy's exact printing, fetched when the device has not cached it (A.card's entry branch).
async function ownedLoad(ctx) {
  const id = ctx.ownedLoading; if (!id) return;
  try {
    const full = await api('/cards/' + encodeURIComponent(id.printingId));
    if (!still(ctx)) return;
    if (!magicOwnedCurrent(S.state, id)) { ctx.ownedNotice = 'This saved copy changed. Reopen it from your collection.'; ctx.blocked = true; return; }
    const owned = magicOwnedDetail(S.state, ctx.entryId, ctx.name, full);
    if (owned.status !== 'ready') throw Error(owned.reason);
    Object.assign(ctx, magicOwnedContext({...owned, card: slim({...full, full: true, checkedAt: new Date().toISOString()})}));
  } catch (e) { if (still(ctx)) { ctx.ownedNotice = e.message; ctx.blocked = true; } }
  finally { delete ctx.ownedLoading; }
}
// app.js loadCardExtras (3616-3660): the full card (flavor text, artist), then its printings.
async function cardExtras(ctx) {
  if (ctx.detailsBusy) return;
  let c = ctx.print || meta(ctx.name);
  const owned = ctx.ownedDetail, requestedPrint = ctx.print?.id, ok = () => still(ctx) && (!requestedPrint || ctx.print?.id === requestedPrint) && (!owned || ctx.ownedDetail === owned && magicOwnedCurrent(S.state, owned));
  ctx.detailsBusy = true;
  const oldDetailsError = ctx.detailsError;
  ctx.detailsError = '';
  if (!ctx.prints || ctx.printsError === oldDetailsError) ctx.printsError = '';
  try {
    if (c?.id && !c.full) {
      const full = await api('/cards/' + encodeURIComponent(c.id));
      if (!ok()) { ctx.detailsError = ctx.printsError = 'Extra details paused. Retry to finish loading this card.'; return; }
      if (full.id !== c.id) throw Error('The card database returned a different printing. Retry this card’s details.');
      if (owned) { const exact = magicOwnedDetail(S.state, owned.entryId, ctx.name, full); if (exact.status !== 'ready') throw Error(exact.reason); }
      if (ctx.print) { c = slim({...full, full: true, checkedAt: new Date().toISOString()}); if (ctx.print.id === c.id) ctx.print = c; }
      else c = cacheCard({...full, full: true}, [ctx.name]);
    }
    if (!c?.oracle_id || !ok()) return;
    if (!Array.isArray(ctx.prints)) await magicVersions(ctx);
  } catch (e) { ctx.detailsError = ctx.printsError = e.message; }
  finally { ctx.detailsBusy = false; }
}
// app.js loadMagicVersions (3662-3698), first page or the next one.
async function magicVersions(ctx, next = false) {
  if (ctx?.type !== 'card' || ctx.printsBusy || (next && !ctx.printsNext)) return;
  const card = ctx.print || meta(ctx.name), cursor = next ? ctx.printsNext : null;
  const token = Symbol('magic-versions');
  ctx.printsRequest = token; ctx.printsBusy = true; ctx.printsError = '';
  try {
    const page = await loadMagicPrintingPage(card, {cursor, request: api});
    if (!still(ctx) || ctx.printsRequest !== token) return;
    const pages = [...(next ? ctx.printsPages || [] : []), ...(cursor ? [cursor] : [])];
    const repeated = page.nextCursor && pages.includes(page.nextCursor);
    ctx.prints = mergeMagicCards(next ? ctx.prints || [] : [], page.cards, {printings: true});
    ctx.printsNext = repeated ? null : page.nextCursor;
    ctx.printsComplete = !repeated && page.complete;
    ctx.printsTotal = page.total;
    ctx.printsPages = pages;
    ctx.pricesAt = new Date().toISOString();
    if (repeated) ctx.printsError = 'The card database repeated a printing page. Showing the verified printings loaded so far.';
    ensureTcgPrices(page.cards);
  } catch (e) { if (still(ctx) && ctx.printsRequest === token) ctx.printsError = e.message; }
  finally { if (ctx.printsRequest === token) { ctx.printsBusy = false; if (!still(ctx) && !ctx.prints) ctx.printsError = 'Printing lookup paused. Retry to load this card’s printings.'; } }
}
// app.js mtgGuideLoad (6159-6190), verbatim but for the redraw.
async function mtgGuideLoad(c) {
  if (!c) return;
  const k = 'mtg:' + c.name;
  S.ui.guide ||= {};
  if (S.ui.guide[k]) return;
  S.ui.guide[k] = {loading: true};
  const qs = mtgPairQueries(c),
    results = await Promise.all(qs.map((q) => api('/cards/search?' + new URLSearchParams({q: q.q, order: 'edhrec', unique: 'cards'})).catch(() => null))),
    cands = [];
  for (const r of results) for (const x of (r?.data || []).slice(0, 30)) {
    cacheCard(x);
    cands.push({card: x, pop: edhPop(x.edhrec_rank), owned: inv(x.name).owned > 0});
  }
  const al = playedAlongside('mtg', c, allCachedMeta(), 15);
  for (const x of al.cards) {
    const card = meta(x.name);
    if (card) cands.push({card, lift: Math.max(0, x.share - x.overall), share: x.share, pop: edhPop(card.edhrec_rank), owned: inv(card.name).owned > 0});
  }
  if (rankPairs('mtg', c, cands).filter((x) => !x.fallback).length < 4) {
    const id = (c.color_identity || []).join('') || 'c',
      r = await api('/cards/search?' + new URLSearchParams({q: `id<=${id} -t:basic -!"${c.name.split(' // ')[0]}" ${/Land/.test(c.type_line || '') ? '' : '-t:land'}`, order: 'edhrec', unique: 'cards'})).catch(() => null);
    for (const x of (r?.data || []).slice(0, 12)) {
      cacheCard(x);
      cands.push({card: x, pop: edhPop(x.edhrec_rank), owned: inv(x.name).owned > 0, fallback: true, why: `staple in its colors${x.edhrec_rank ? ` (EDHREC #${Number(x.edhrec_rank).toLocaleString()})` : ''}`});
    }
  }
  const ranked = rankPairs('mtg', c, cands);
  S.ui.guide[k] = {
    cards: ranked.map((p) => ({name: p.card.name, image: p.card.image_uris?.small || p.card.card_faces?.[0]?.image_uris?.small || '', attrs: `data-act="card" data-name="${esc(p.card.name)}"`, reasons: p.reasons, score: p.score, fallback: p.fallback})),
    note: ranked.length ? 'Ranked by how well they fit (what each card needs and gives), tournament pairings, popularity and what you own.' : results.some((r) => !r) ? 'Couldn’t reach Scryfall right now.' : 'No strong pairings found in its text or tournament lists.',
  };
}
// app.js A.cardTab's lookups (5039-5084): the Play guide's pairings and official rulings, and the Prices tab's quote record.
async function cardTabLoads(ctx) {
  if (ctx.tab === 'guide') {
    mtgGuideLoad(meta(ctx.name));
    if (!ctx.rulings && !ctx.rulingsBusy) {
      const c = ctx.print || meta(ctx.name);
      ctx.rulingsBusy = true;
      try { const r = await api('/cards/' + encodeURIComponent(c.id) + '/rulings'); if (still(ctx)) ctx.rulings = r.data || []; }
      catch { if (still(ctx)) ctx.rulings = []; }
      finally { ctx.rulingsBusy = false; }
    }
  }
  // workbench-ui.js historyPanel asks shared-history.js requestHistory for the shown quote's series as it draws; that only
  // loads where there is a window, so the app starts the same load here (it keeps its own dedupe and cache times).
  if (ctx.tab === 'prices') { const c = ctx.print || meta(ctx.name); if (c) await loadSharedHistory(quoteForContext('mtg', c, ctx)).catch(() => {}); }
}
// app.js loadSetIndex (617-656): the official set list (names, sizes, symbols), cached for a day; the site loads it on its
// Collection and Sets pages, so a card opened from there names its set and counts the set's cards.
const SET_INDEX = 'cardforge-sets-v1';
async function loadSetIndex(force = false) {
  const ui = S.ui.sets;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(SET_INDEX) || 'null'); } catch {}
  if (cached?.sets?.length) { ui.list = cached.sets; ui.checkedAt = Number(cached.at) || 0; registerSetIcons(Object.fromEntries(cached.sets.map((x) => [x.code, x.icon]))); }
  const fresh = cached?.sets?.length && Number(cached.at) > 0 && Date.now() >= cached.at && Date.now() - cached.at < 864e5;
  if (ui.busy) return;
  if (fresh && !force) { ui.error = ''; return; }
  ui.busy = true; ui.error = '';
  try {
    const r = await api('/sets');
    if (!Array.isArray(r.data) || !r.data.length || r.data.some(x => !x?.code || !x?.name)) throw Error('The source returned an empty or invalid set catalogue. Try again.');
    const sets = r.data.map((x) => ({code: x.code, parent_set_code: x.parent_set_code || '', name: x.name, released_at: x.released_at || '', set_type: x.set_type, card_count: x.card_count, digital: !!x.digital, icon: x.icon_svg_uri}));
    ui.list = sets; ui.checkedAt = Date.now();
    registerSetIcons(Object.fromEntries(sets.map((x) => [x.code, x.icon])));
    try { localStorage.setItem(SET_INDEX, JSON.stringify({at: ui.checkedAt, sets})); } catch {}
  } catch (e) { ui.error = e.message + (ui.list.length ? ' Showing the last checked catalogue.' : ''); }
  finally { ui.busy = false; }
}
// app.js loadSet / loadSetCards (661-735): every printing in a set, straight from Scryfall, page by page (a failed page keeps the
// pages before it, and Try again resumes from it); the redraws are the app's (it pumps this with settle()).
const setCache = new Map();
function loadSet(code, {join = false, resume = false} = {}) {
  const st = S.ui.set; if (join && st.code === code && st.busy && st.loadPromise) return st.loadPromise;
  const job = loadSetCards(code, {resume}); st.loadPromise = job; return job.finally(() => { if (st.loadPromise === job) st.loadPromise = null; });
}
async function loadSetCards(code, {resume = false} = {}) {
  const st = S.ui.set, generation = (st.generation || 0) + 1;
  st.generation = generation;
  const current = () => S.ui.set === st && st.code === code && st.generation === generation;
  if (setCache.has(code)) { Object.assign(st, setCache.get(code), {loaded: true, busy: false, error: '', pagination: null}); return; }
  st.busy = true; st.error = ''; st.complete = false;
  const continuing = resume && st.pagination?.code === code && st.pagination.path;
  if (!continuing) { st.cards = []; st.total = 0; st.info = null; st.loaded = false; st.pagination = null; }
  try {
    if (!st.info) { const info = await api('/sets/' + encodeURIComponent(code)); if (!current()) return; st.info = info; }
    const cursor = continuing ? st.pagination : {code, path: '/cards/search?' + new URLSearchParams({q: 'e:' + code, unique: 'prints', order: 'set', dir: 'asc', include_extras: 'true', include_variations: 'true'}), seen: []};
    st.pagination = cursor;
    const cards = new Map(st.cards.map(c => [c.id, c]));
    const incomplete = () => Error('The provider list is incomplete. Try again to finish loading this set.');
    while (cursor.path && current()) {
      if (cursor.seen.length >= 30) { st.pagination = null; throw incomplete(); }
      // (one declaration per await: the bundle's QuickJS guard only knows that shape inside try/finally)
      const path = cursor.path;
      const d = await api(path);
      if (!current()) return;
      if (!Array.isArray(d.data) || typeof d.has_more !== 'boolean') throw incomplete();
      let next = null;
      if (d.has_more) {
        let url; try { url = new URL(d.next_page); } catch { throw incomplete(); }
        if (url.origin !== 'https://api.scryfall.com' || url.pathname !== '/cards/search' || url.username || url.password || url.hash) throw incomplete();
        next = url.pathname + url.search;
        if (next === path || cursor.seen.includes(next)) throw incomplete();
      }
      if (Number.isInteger(d.total_cards) && d.total_cards >= 0) st.total = d.total_cards;
      for (const c of d.data) if (c.id && c.set === code) cards.set(c.id, slim(c));
      st.cards = [...cards.values()];
      cursor.seen.push(path); cursor.path = next;
    }
    if (current()) {
      if (st.total !== st.cards.length) { st.pagination = null; throw incomplete(); }
      st.loaded = true; st.complete = true; st.pagination = null;
      setCache.set(code, {info: st.info, cards: st.cards, total: st.total, complete: true});
      ensureTcgPrices(st.cards);
    }
  } catch (e) {
    if (current()) { st.error = st.cards.length ? 'Some cards didn’t load: ' + e.message : e.message; st.loaded = !!st.cards.length; }
  } finally { if (current()) st.busy = false; }
}
// app.js's set browser and set page handlers (4545-4600), verbatim but for the redraw, which is the app's.
const updateSetBrowser = (key, value) => { S.ui.sets[key] = value; S.ui.sets.limit = 80; };
const setsAct = {
  search: v => { S.ui.sets.q = v; S.ui.sets.limit = 80; },
  family: v => updateSetBrowser('family', v), type: v => updateSetBrowser('family', v), release: v => updateSetBrowser('release', v),
  year: v => updateSetBrowser('year', v), sort: v => updateSetBrowser('sort', v),
  more: () => { S.ui.sets.limit = (S.ui.sets.limit || 80) + 80; },
  reset: () => { const st = S.ui.sets; for (const key of ['family', 'release', 'year', 'sort']) delete st[key]; st.q = ''; st.all = false; st.limit = 80; },
  reload: () => { S.ui.sets.error = ''; loadSetIndex(true); },
};
const setAct = {
  search: v => { S.ui.set.q = v; S.ui.set.limit = 120; },
  filter: v => { S.ui.set.filter = v; S.ui.set.limit = 120; },
  finish: v => { S.ui.set.finish = v; S.ui.set.limit = 120; },
  rarity: v => { S.ui.set.rarity = v; S.ui.set.limit = 120; },
  sort: v => { S.ui.set.sort = v; },
  more: () => { S.ui.set.limit += 240; },
  reload: () => { setCache.delete(S.ui.set.code); loadSet(S.ui.set.code, {resume: true}); },
  // workbench-ui.js A.viewSave for the set page: the app keeps the choice for this visit (the website saves it to the account).
  view: v => { if (['gallery', 'compact', 'symbols'].includes(v)) ((S.state.settings.displayModes ||= {}).mtg ||= {}).set = v; },
};
// app.js route() for #set/<code>: a new code starts the page afresh.
function setOpen(code) {
  const ui = S.ui; code = String(code || '').toLowerCase(); ui.lens = '';
  if (code !== ui.set.code) ui.set = {...ui.set, code, info: null, cards: [], total: 0, loaded: false, busy: false, error: '', q: '', filter: 'all', rarity: 'all', finish: 'all', complete: false, limit: 120};
}
// Yu-Gi-Oh! and Pokémon sets: tcg.js registerTcg(ctx) installs the site's own handlers (A / C / I) and loaders (ctx.loadSets,
// ctx.openSet); the app's side of ctx has no DOM, sheets or toasts, and its redraw is the app's (settle repaints). The site keys
// these pages to the open game (settings.game) and route (S.ui.view, S.ui.tsetId), so a set page holds them while it is open and
// Magic's pages hand them back.
const TA = {}, TC = {}, TI = {}, tcgCtx = {};
let tcgWent = '', tdeckAt = null;
let tcgOn = false, tcgPrev, setsGame = 'mtg', setGame = 'mtg';
// tcg.js takes openSheet / closeSheet once (registerTcg), so they forward: the Add to collection sheet listens while it opens and saves.
let tcgSheetHook = () => {}, tcgCloseHook = () => {};
// tcg.js takes download and copyText from its context once (registerTcg), so they reach through here: siteRun puts its stand-ins in.
const tcgHooks = {download() {}, copyText() {}};
function tcgReady() {
  if (tcgOn) return; tcgOn = true;
  Object.assign(tcgCtx, {A: TA, C: TC, I: TI, commit, render() {}, openSheet: (html, ctx) => ctx?.type === 'proven' ? provenSheetOpen(ctx) : ctx?.type === 'tbuild' ? tbuildOpen() : tcgSheetHook(html, ctx), closeSheet: () => { provenSheetShut(); tbuildShut(); tcgCloseHook(); },
    // The Build decks sheet draws again (runTBuild's refresh, A.tTierAlternative) when it is the panel open.
    refreshSheet() { if (panel?.tbuild) panel.redraw(); else if (!S.ui.tbuild?.busy) tbuildHold(null, false); }, toast: text => { if (text) toasts.push({text: String(text), undo: false}); }, download: (...a) => tcgHooks.download(...a),
    copyText: (...a) => tcgHooks.copyText(...a), busy: () => () => {},
    // The route a handler goes to (A.tSetByName's #set/<id>), for the app to follow.
    go(h) { tcgWent = String(h || ''); }, rerenderKeepingFocus() {}, writeRecord: async () => {}, navigationStamp: () => null, navigationCurrent: () => true,
    // app.js's openDeckFlow (deckExperience.open): the request goes to the app, which opens its Build a deck on it (flowTcgCalls).
    openDeckFlow: request => flowAskedFor(request)});
  registerTcg(tcgCtx);
  // c.openProven loads as the sheet opens; its status lines look up the page after each await (provenRun).
  const openProven = tcgCtx.openProven;
  tcgCtx.openProven = spec => provenRun(() => openProven(spec));
}
function tcgFocus(G, view, id = '') {
  tcgReady(); const st = S.state.settings ||= {};
  if (tcgPrev === undefined) tcgPrev = st.game ?? null;
  st.game = G; S.ui.view = view; if (view === 'set') S.ui.tsetId = id;
}
function mtgFocus() {
  if (tcgPrev === undefined) return;
  const st = S.state.settings ||= {}; if (tcgPrev === null) delete st.game; else st.game = tcgPrev; tcgPrev = undefined;
}
const tcgGame = () => S.state.settings?.game;
// app.js route()'s "Load card data and prices for what's on screen" for a Yu-Gi-Oh! / Pokémon view: Home and Decks the first card of
// each deck, the Cards tab its shown lots (the first [limit]), a deck page all of its zones.
function tcgScreenCards(g, view, o = {}) {
  const st = tcgGs(g);
  const ids = view === 'cards' ? (o.ids || []) : view === 'tdeck' ? (() => { const d = st.decks.find(x => x.id === o.id); return d?.zones ? ['main', 'extra', 'side'].flatMap(z => (d.zones[z] || []).map(r => r.cardId)) : []; })()
    : view === 'collection' ? st.collection.map(e => e.cardId) : st.decks.flatMap(d => (d.zones?.main || []).slice(0, 1).map(r => r.cardId));
  const missing = [...new Set(ids.filter(id => tcgNeedsRefresh(g, tcgCardOf(g, id))))];
  if (missing.length) tcgEnsureMany(g, missing, () => {}).catch(() => {});
  // A Yu-Gi-Oh! lot saved with its release reads its printing, foil and price through the release list (tcg.js savedYgoPresentation,
  // entryValuation). Only the card page and the Sets tab loaded that list, so until one of them had been opened the Cards tab drew
  // such a lot plain with a dash for its price (Randall 12 Nov, 0.4.66). Any Yu-Gi-Oh! screen now asks for it once.
  if (g === 'ygo' && !tcgUi(g).sets.list.length && st.collection.some(e => e.setReleaseId)) tcgCtx.loadSets(g).catch(() => {});
}
// tcg.js's set browser and set page handlers, as the site wires them (data-act / data-change / data-input).
const tcgSetsAct = {
  search: v => TI.tSetsQ({value: v}), family: v => TA.tSetsFamily({dataset: {value: v}}), type: v => TC.tSetsType({value: v}),
  release: v => TC.tSetsRelease({value: v}), year: v => TC.tSetsYear({value: v}), sort: v => TC.tSetsSort({value: v}),
  more: () => TA.tSetsMore(), reset: () => TA.tSetsReset(), reload: () => TA.tSetsReload(),
};
const tcgSetAct = {
  search: v => TI.tSetQ({value: v}), filter: v => TA.tSetFilter({dataset: {id: v}}), rarity: v => TC.tSetRarity({value: v}),
  finish: v => TC.tSetFinish({value: v}), edition: v => TC.tSetEdition({value: v}), sort: v => TC.tSetSort({value: v}),
  more: () => TA.tSetMore(), reload: () => TA.tSetRetry(), details: () => TA.tSetDetails(),
  // workbench-ui.js A.viewSave (data-area set): the game's own set view.
  view: v => { if (['gallery', 'compact', 'symbols'].includes(v)) ((S.state.settings.displayModes ||= {})[setGame] ||= {}).set = v; },
};
// views.js setsPage(): the browser's search, families and filters, then the sets by year (set-list-ui.js setRowContent tiles).
const setProgressModel = p => p ? {label: text(one(one(p, cls('set-tile-progress-label')), tagIs('span'))) || text(one(p, x => x.tag === 'p' && !cls('set-progress-caption')(x))),
  eyebrow: text(one(p, cls('eyebrow'))), pct: text(one(p, x => x.tag === 'b' || x.tag === 'strong')), fill: (() => { const f = one(one(p, cls('set-progress-track')), tagIs('span')); return f ? Number((/scaleX\(([\d.e-]+)\)/.exec(f.attrs.style || '') || [])[1]) || 0 : null; })(),
  caption: text(one(p, cls('set-progress-caption'))) || text(one(p, tagIs('small')))} : null;
function setRowModel(n) {
  const atm = one(n, cls('set-atmosphere')), media = one(n, cls('set-media')), main = one(n, cls('set-row-main')), b = one(main, tagIs('b')), det = one(main, cls('set-row-detail')), count = one(n, cls('set-row-count'));
  // The release's mark: Magic's set symbol; Yu-Gi-Oh!'s set code on a plate over its quiet art (set-media-ygo); Pokémon's set symbol
  // and the two places it may come from, then its code (set-media-pokemon-symbol).
  const mimg = one(media, tagIs('img')), kind = cls('set-media-ygo')(media) ? 'ygo' : cls('set-media-pokemon-symbol')(media) ? 'pokemon' : '';
  const images = mimg ? [mimg.attrs.src, mimg.attrs['data-symbol-next'], mimg.attrs['data-symbol-last']].filter(Boolean).map(abs) : [];
  return {code: n.attrs['data-code'] || n.attrs['data-id'] || '', kind, atmosphere: setArt(one(atm, tagIs('img'))), image: images[0] || '', images, emblem: text(one(media, cls('set-ygo-emblem'))),
    fallback: text(one(media, cls('set-art-code'))),
    icon: urlIn(styleVar(one(b, cls('set-icon')), 'icon')), name: text(one(b, x => x.tag === 'span' && !cls('set-icon')(x))), mark: text(one(det, cls('set-code-mark'))),
    detail: text(one(det, x => x.tag === 'span' && !cls('set-code-mark')(x))), count: text(one(count, tagIs('b'))), units: all(count, tagIs('small')).map(text), unknown: !!one(count, cls('count-unknown')),
    progress: setProgressModel(one(n, cls('set-tile-progress')))};
}
function setsPageModel(G = 'mtg') {
  const t = tree(G === 'mtg' ? setsView() : tcgSetsView()), head = one(t, cls('page-head')), ctl = one(t, cls('set-browser-controls')), search = one(ctl, x => x.tag === 'input'), more = one(ctl, cls('set-browser-more'));
  const note = one(t, x => cls('note')(x) && cls('warn')(x)), secs = all(t, cls('set-year-section')), flat = one(t, cls('set-browser-flat')), last = one(t, x => x.attrs['data-act'] === 'setsMore' || x.attrs['data-act'] === 'tSetsMore'), empty = one(t, cls('empty'));
  return {eyebrow: text(one(head, cls('eyebrow'))), title: text(one(head, tagIs('h1'))),
    search: search && {value: search.attrs.value || '', placeholder: search.attrs.placeholder || '', label: search.attrs['aria-label'] || ''},
    quick: all(one(ctl, cls('set-browser-quick')), tagIs('button')).map(b => ({value: b.attrs['data-value'] || '', label: text(b), on: cls('on')(b), icon: icon(svgIn(b))})),
    filters: more ? {label: text(one(one(more, tagIs('summary')), x => x.tag === 'span' && !cls('label-ico')(x))), icon: icon(svgIn(one(more, tagIs('summary')))), count: text(one(more, cls('filters-count'))), open: more.attrs.open !== undefined,
      selects: all(one(more, cls('set-browser-facets')), tagIs('label')).map(l => { const sel = one(l, tagIs('select')); return {...selectOf(sel), title: text({kids: (l.kids || []).filter(k => k !== sel)})}; }),
      status: text(one(one(more, cls('set-browser-summary')), tagIs('p'))), buttons: all(one(more, cls('set-browser-summary')), tagIs('button')).map(press), freshness: text(one(more, cls('set-browser-freshness')))} : null,
    error: note ? {text: text({kids: (note.kids || []).filter(k => k.tag !== 'button')}), retry: press(one(note, tagIs('button')))} : null,
    loading: text(one(t, x => x.tag === 'p' && cls('center')(x) && cls('pad')(x))),
    sections: secs.length ? secs.map(s => ({year: text(one(s, tagIs('h2'))), count: text(one(one(s, cls('set-year-heading')), tagIs('span'))), rows: all(s, cls('set-row')).map(setRowModel)}))
      : flat ? [{year: '', count: '', rows: all(flat, cls('set-row')).map(setRowModel)}] : [],
    empty: empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p')))}, more: last ? text(last) : '', busy: !!(G === 'mtg' ? S.ui.sets : tcgUi(G).sets).busy, game: G,
    foot: text(one(t, cls('foot')))};
}
// views.js setPage(): the set's hero (its art, symbol, name, line, your progress, the pack simulator), the toolbar, the cards.
function setTileModel(n) {
  const img = one(n, cls('card-img')) || one(n, tagIs('img')), c = one(n, cls('tile-chrome')), meta = one(n, cls('grid-meta')), badge = one(n, cls('owned-badge'));
  let finish = null; try { finish = JSON.parse(n.attrs['data-finish-model'] || 'null'); } catch {}
  const set = one(c, cls('set-icon')), imp = one(c, cls('imp-tile')), i = Number(n.attrs['data-set-i']), spans = (meta?.kids || []).filter(k => k.tag === 'span');
  return {name: n.attrs['data-name'] || '', i, picture: picture(img), alt: img?.attrs.alt || '', fallback: img ? '' : text(one(n, cls('img-missing'))), ...tierOfNode(n),
    finish: finish && {key: finish.key || '', effect: finish.effect || n.attrs['data-finish-effect'] || '', printingId: finish.printingId || '', status: finish.status || ''},
    chrome: c ? {emb: all(one(c, cls('tile-emb')), tagIs('img')).map(x => ({src: x.attrs.src || '', alt: x.attrs.alt || ''})),
      set: set ? {src: urlIn(set.attrs.style || ''), rarity: (classes(set).find(x => x.startsWith('r-')) || 'r-common').slice(2), title: one(c, cls('tset'))?.attrs.title || ''} : null, imp: imp ? icon(svgIn(imp)) : null} : null,
    label: text(spans[0]), price: text(spans[1]), badge: badge ? {text: text(badge), other: cls('other')(badge), title: badge.attrs.title || ''} : null, own: cls('own')(n), missing: cls('play-missing')(n),
    print: finish?.key && finish.key !== 'nonfoil' ? S.ui.set.cards?.[i] || null : null};
}
// A Yu-Gi-Oh! or Pokémon card of the set grid (tcg.js tcgSet): its art and finish (finish-preview.js reads data-finish-model), the
// tile chrome (tiles.js: Level and Attribute, or energy types; the set code and rarity code, or the set and rarity symbols), the
// number and name, the price and what kind of price it is, and what you own. The card itself opens the site's card page (tCard).
// tiles.js tileChrome on a Yu-Gi-Oh! or Pokémon picture (.tile-chrome): the emblems (Level / Rank star and number, Attribute or energy
// orbs) and the set badge (Yu-Gi-Oh!'s set code and rarity code; Pokémon's set and rarity symbols).
function tcgChromeOf(c) {
  if (!c) return null;
  const pk = x => x ? [x.attrs.src, x.attrs['data-direct']].filter(Boolean).map(abs) : [];
  const ts = one(one(c, cls('tile-set')), cls('tset')), rx = one(ts, cls('rx-code')), pks = one(ts, cls('pks')), pkr = one(ts, cls('pkr')), rar = one(ts, cls('rar'));
  const emb = (one(one(c, cls('tile-emb')), cls('emblems'))?.kids || []).filter(k => k.tag).map(k => k.tag === 'svg' ? {icon: icon(k)}
    : cls('lvl')(k) ? {icon: icon(svgIn(k)), text: text(k), label: k.attrs['aria-label'] || ''} : cls('more')(k) || cls('hp')(k) ? {text: text(k)} : {icon: icon(svgIn(k)), text: text(k)});
  return {emb, set: ts ? {tone: classes(ts).find(x => ['secret', 'ultra', 'super', 'rare', 'common'].includes(x)) || '', code: text(one(ts, tagIs('b'))),
    rarity: rx ? {text: text(rx), kind: (classes(rx).find(x => x.startsWith('rx-') && x !== 'rx-code') || 'rx-common').slice(3)} : null,
    symbol: pk(pks), mark: pkr ? {src: pk(pkr), ink: cls('ink')(pkr), alt: pkr.attrs.alt || ''} : rar ? {text: text(rar), gold: cls('gold')(rar)} : null,
    title: ts.attrs.title || ''} : null,
    // importance.js tileEmblem: the meta / staple mark at the dock's right.
    imp: (x => x ? icon(svgIn(x)) : null)(one(c, cls('imp-tile')))};
}
// finish-preview.js's model on a Yu-Gi-Oh! or Pokémon picture (data-finish-model): the recipe, its masks, the Level-star foil, the frame.
function tcgFinishOf(n, card) {
  let f = null; try { f = JSON.parse(n?.attrs['data-finish-model'] || 'null'); } catch {}
  return f && {key: f.key || '', effect: f.effect || n.attrs['data-finish-effect'] || '', status: f.status || '', stars: Number(f.stars) || 0,
    treatment: f.treatment || '', mask: f.layers?.[0]?.mask || '', clip: f.overlayProfiles?.[0]?.mask || '', frame: String(card?.frame || card?.cardType || card?.typeLine || '')};
}
function tcgTileModel(n, G) {
  const img = one(n, cls('card-img')) || one(n, tagIs('img')), c = one(n, cls('tile-chrome')), meta = one(n, cls('grid-meta')), badge = one(n, cls('owned-badge'));
  let f = null; try { f = JSON.parse(n.attrs['data-finish-model'] || 'null'); } catch {}
  const spans = (meta?.kids || []).filter(k => k.tag === 'span'), pr = spans[1], id = n.attrs['data-id'] || '';
  const card = tcgCardOf(G, id);
  const printing = n.attrs['data-printing'] || '';
  // What the tile hands A.tCard: the set it was opened from, the finish the page prices, Yu-Gi-Oh!'s printing and edition.
  const open = {setId: n.attrs['data-set-id'] || '', setVariant: n.attrs['data-set-variant'] || '', printing, edition: n.attrs['data-edition'] || ''};
  return {id, act: n.attrs['data-act'] || '', open, name: img?.attrs.alt || '', picture: picture(img), fallback: img ? '' : text(one(n, cls('img-missing'))), ...tierOfNode(n),
    finish: f && {key: f.key || '', effect: f.effect || n.attrs['data-finish-effect'] || '', status: f.status || '', stars: Number(f.stars) || 0,
      treatment: f.treatment || '', mask: f.layers?.[0]?.mask || '', clip: f.overlayProfiles?.[0]?.mask || '', source: abs(typeof f.source === 'string' && /^https?:/.test(f.source) ? f.source : ''),
      rarity: n.attrs['data-printed-rarity'] || '', code: printing.split('::')[0] || '', date: f.printingRelease?.date || '', frame: String(card?.frame || card?.cardType || card?.typeLine || '')},
    chrome: tcgChromeOf(c),
    label: text(spans[0]), price: text({kids: (pr?.kids || []).filter(k => k.tag !== 'small')}), priceNote: text(one(pr, tagIs('small'))), priceTitle: pr?.attrs.title || '',
    badge: badge ? {text: text(badge), other: cls('other')(badge), title: badge.attrs.title || ''} : null, own: cls('own')(n), printing, edition: n.attrs['data-edition'] || ''};
}
function setPageModel(G = 'mtg') {
  const st = G === 'mtg' ? S.ui.set : tcgUi(G).set, t = tree(G === 'mtg' ? setView() : tcgSetView()), hero = one(t, cls('set-hero')), main = one(hero, cls('set-hero-main')), tb = one(t, cls('set-card-toolbar')), ctr = one(tb, cls('set-controls'));
  const note = one(t, x => cls('note')(x) && cls('warn')(x)), grid = one(t, cls('set-grid')), search = one(tb, x => x.tag === 'input'), more = one(t, x => x.attrs['data-act'] === 'setMore' || x.attrs['data-act'] === 'tSetMore'), empty = one(t, cls('empty'));
  const view = one(ctr, cls('view-switch')), pack = one(hero, cls('set-open-pack')), logo = one(hero, cls('set-logo')), h1 = one(main, tagIs('h1')), pks = one(h1, cls('pks'));
  // Yu-Gi-Oh! and Pokémon: what the card list covers (p.set-coverage-note, with its Refresh) and how the prices were picked (details).
  const cover = all(t, cls('set-coverage-note')), cnote = cover.find(x => x.tag === 'p'), cdet = cover.find(x => x.tag === 'details');
  return {code: G === 'mtg' ? st.code : S.ui.tsetId || '', game: G, title: text(h1), line: text(one(main, x => x.tag === 'p')), back: press(one(main, tagIs('button'))),
    atmosphere: setArt(one(one(hero, cls('set-atmosphere')), tagIs('img'))), icon: urlIn(styleVar(one(hero, cls('set-icon')), 'icon')),
    logo: logo ? abs(logo.attrs.src || '') : '', symbol: pks ? [pks.attrs.src, pks.attrs['data-direct'], (/src="([^"]+)"/.exec(pks.attrs['data-fb'] || '') || [])[1]].filter(Boolean).map(abs) : [],
    coverage: cnote ? {text: text({kids: (cnote.kids || []).filter(k => k.tag !== 'button')}), button: press(one(cnote, tagIs('button')))} : null,
    details: cdet ? {summary: text(one(cdet, tagIs('summary'))), text: text(one(cdet, tagIs('p'))), open: cdet.attrs.open !== undefined} : null,
    progress: setProgressModel(one(hero, cls('set-collection-progress'))), pack: pack ? {label: text({kids: (pack.kids || []).filter(k => k.tag !== 'span')}), sub: text(one(pack, tagIs('span'))), disabled: pack.attrs.disabled !== undefined, act: pack.attrs['data-act'] || ''} : null,
    error: note ? {text: text({kids: (note.kids || []).filter(k => k.tag !== 'button')}), retry: press(one(note, tagIs('button')))} : null,
    search: search && {value: search.attrs.value || '', placeholder: search.attrs.placeholder || '', label: search.attrs['aria-label'] || ''},
    filters: all(one(ctr, cls('seg')), tagIs('button')).map(b => ({id: b.attrs['data-id'] || '', label: text(b), on: cls('on')(b)})),
    selects: all(ctr, tagIs('select')).map(selectOf),
    views: view ? all(view, tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})) : [],
    mode: (all(view, tagIs('button')).find(b => b.attrs['aria-checked'] === 'true')?.attrs['data-mode']) || 'gallery',
    results: text(one(t, cls('set-results'))), tiles: grid ? all(grid, cls('grid-card')).map(n => G === 'mtg' ? setTileModel(n) : tcgTileModel(n, G)) : [],
    more: more ? text(more) : '', empty: empty && {title: text(one(empty, tagIs('h3'))), text: text(one(empty, tagIs('p')))}, busy: !!st.busy, loaded: !!st.loaded};
}

// ---------------------------------------------------------------- Search (the site's #search: views.js search(), tcg.js tcgSearch())
// app.js's Magic search (6424-6640), verbatim but for the redraw (the app's), A.card (the app opens the card page: searchWent says
// which) and the screen stamps (the app has one search page). Yu-Gi-Oh! and Pokémon run tcg.js's own handlers (TA / TC / TI).
let searchGame = 'mtg', searchWent = null;
function dbInvalidate(clear = true) {
  const db = S.ui.db;
  db.generation = (db.generation || 0) + 1;
  db.abort?.abort();
  db.abort = null;
  db.busy = false;
  if (clear) Object.assign(db, { results: [], total: 0, next: null, note: "", error: "", submitted: null, pages: [] });
}
const dbHasQuery = () => hasMagicSearchQuery(S.ui.db.term, S.ui.db.filters);
const DB = {
  dbTerm(t) {
    if (S.ui.db.term === t.value) return;
    S.ui.db.term = t.value;
    dbInvalidate();
  },
  dbFilter(t) {
    const f = S.ui.db.filters;
    f[t.dataset.field] = t.value;
    if (["format", "color"].includes(t.dataset.field)) delete f.fits;
    if (dbHasQuery()) return dbSearch();
    dbInvalidate();
  },
  // Color chips toggle: tapping the selected color clears it.
  dbColorChip(t) {
    const f = S.ui.db.filters;
    f.cardColor = f.cardColor === t.dataset.value ? "" : t.dataset.value;
    if (dbHasQuery()) return dbSearch();
    dbInvalidate();
  },
  dbChip(t) {
    const f = S.ui.db.filters,
      k = t.dataset.field;
    if (k === "fits") {
      delete f.fits;
      f.format = "";
      f.color = "";
    } else f[k] = "";
    if (!dbHasQuery()) { dbInvalidate(); return; }
    return dbSearch();
  },
  dbClear() {
    S.ui.db.filters = { color: "", type: "", format: "", maxPrice: "" };
    if (S.ui.db.term.trim()) return dbSearch();
    else dbInvalidate();
  },
  dbSave() {
    const error = magicFilterError(S.ui.db.filters);
    if (error) { toasts.push({text: error, undo: false}); return; }
    const db = S.ui.db,
      chips = mtgFilterChips(db.filters).filter(([k]) => k !== "sort"),
      label = [db.term.trim() && `“${db.term.trim().slice(0, 24)}”`, ...chips.map(([, l]) => l)].filter(Boolean).join(" · ").slice(0, 60) || "Search",
      list = savedSearches("mtg").filter((x) => x.label !== label);
    setSavedSearches("mtg", [{ label, term: db.term, filters: structuredClone(db.filters) }, ...list]);
    toasts.push({text: "Search saved.", undo: false});
  },
  dbSaved(t) {
    const x = savedSearches("mtg")[Number(t.dataset.i)];
    if (!x) return;
    S.ui.db.term = x.term || "";
    S.ui.db.filters = { color: "", type: "", format: "", maxPrice: "", ...x.filters };
    return dbSearch();
  },
  dbSavedDel(t) {
    const list = savedSearches("mtg");
    list.splice(Number(t.dataset.i), 1);
    setSavedSearches("mtg", list);
  },
  dbSearch: () => dbSearch(),
  dbMore: () => dbSearch(true),
  async dbRandom() {
    const db = S.ui.db, generation = db.generation;
    if (db.randomBusy || searchGame !== 'mtg') return;
    db.randomBusy = true;
    try {
      const card = await api("/cards/random?" + new URLSearchParams({q:"game:paper"}));
      if (S.ui.db !== db || db.generation !== generation || searchGame !== 'mtg') return;
      const c = cacheCard(card); saveCatalogSoon();
      searchWent = {act: 'card', name: c.name, random: '1'};
    } catch (e) { toasts.push({text: e.message, undo: false}); }
    finally { db.randomBusy = false; }
  },
  dbTry(t) {
    S.ui.db.term = t.dataset.q;
    return dbSearch();
  },
};
async function dbSearch(next = false) {
  const db = S.ui.db;
  if (next && (db.busy || !db.next || !db.submitted)) return;
  let spec;
  if (next) spec = db.submitted;
  else {
    dbInvalidate();
    try { spec = magicSearchSpec(db.term, db.filters); }
    catch (e) { db.error = e.message; return; }
    db.submitted = spec;
  }
  const generation = db.generation, cursor = next ? db.next : null, abort = new AbortController();
  db.abort = abort;
  const current = () => S.ui.db === db && db.generation === generation && db.submitted === spec;
  db.busy = true;
  db.error = "";
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
        // No printing with that set code and number: the words may be a name after all ("2 goblin").
        if (spec.collector && /didn.t match any cards|no cards found/i.test(e.message)) {
          d = await run(spec.typed).catch(() => { throw Error(`No card numbered ${spec.collector.number} in set ${spec.collector.set.toUpperCase()}.`); });
          if (!current()) return;
          note = `No card numbered ${spec.collector.number} in set ${spec.collector.set.toUpperCase()}, so these are cards named “${spec.typed}”.`;
        } else {
        const words = spec.term, none = err => /didn.t match any cards|no cards found/i.test(err?.message || "");
        if (spec.syntax || !none(e)) throw e;
        // No card is called that: the words may be an artist's name, then words from the cards' text.
        d = await run(`a:"${words.replace(/"/g, "")}"`).catch(err => { if (none(err)) return null; throw err; });
        if (!current()) return;
        if (d) note = `No card names match “${words}”, so these are cards illustrated by ${words}.`;
        else {
          if (!words.includes(" ")) throw e;
          d = await run(`o:"${words.replace(/"/g, "")}"`);
          note = `No card names match “${words}”, so these are cards whose text says it.`;
        }
        }
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
    }
  }
}
// One control of the search page, the way the site's event delegation hands it over: a press (data-act and its dataset), a select's
// change or an input's value (data-change / data-input / data-enter, the element's dataset). tcg.js's A.tCard and A.tRandomCard open
// the card page, which is the app's: searchWent says which card.
async function searchPress(act, data = {}) {
  const t = {dataset: data.dataset || {}, value: data.value ?? ''};
  searchWent = null;
  if (searchGame === 'mtg') { mtgFocus(); if (!DB[act]) throw Error('unknown search control ' + act); return DB[act](t); }
  tcgFocus(searchGame, 'search');
  if (act === 'tRandomCard') {
    const open = TA.tCard;
    TA.tCard = async x => { searchWent = {act: 'tCard', ...x.dataset}; };
    try { return await TA.tRandomCard(); } finally { TA.tCard = open; }
  }
  const h = TA[act] || TC[act] || TI[act];
  if (!h) throw Error('unknown search control ' + act);
  return h(t);
}
// A card of the results (views.js search's grid-card, data-act="card" data-name; tcg.js's tCard tiles as on a set page).
function searchTileModel(n, i, G) {
  if (G !== 'mtg') return tcgTileModel(n, G);
  const m = setTileModel(n), name = n.attrs['data-name'] || '';
  return {...m, i, print: m.finish?.key && m.finish.key !== 'nonfoil' ? S.ui.db.results.find(c => c.name === name) || null : null};
}
// A field of the Filters (details.filters): a select (data-change, with data-field) or an input, under its label's words.
function searchField(l) {
  const sel = one(l, tagIs('select')), inp = one(l, tagIs('input')), words = text({kids: (l.kids || []).filter(k => k !== sel && k !== inp)});
  const base = {label: words, title: l.attrs.title || '', span2: cls('span2')(l)};
  if (sel) return {...base, kind: 'select', act: sel.attrs['data-change'] || '', field: sel.attrs['data-field'] || '', options: all(sel, tagIs('option')).map(o => ({value: o.attrs.value ?? text(o), label: text(o), on: o.attrs.selected !== undefined}))};
  if (inp) return {...base, kind: 'input', act: inp.attrs['data-change'] || '', field: inp.attrs['data-field'] || '', value: inp.attrs.value || '', placeholder: inp.attrs.placeholder || '',
    type: inp.attrs.type || 'text', max: inp.attrs.maxlength || '', caps: inp.attrs.autocapitalize === 'characters'};
  return null;
}
// The page as it reads, top to bottom: each part of the markup a block the app draws in the same order.
function searchPageModel(G = 'mtg') {
  const t = tree(G === 'mtg' ? searchView() : tcgSearchView()), blocks = [];
  let title = '', views = [], mode = 'gallery', tile = 0;
  for (const n of (t.kids || []).filter(k => k.tag)) {
    const c = cls;
    if (c('page-head')(n)) {
      title = text(one(n, tagIs('h1')));
      const view = one(n, c('view-switch'));
      views = view ? all(view, tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})) : [];
      mode = views.find(v => v.on)?.mode || 'gallery';
    } else if (c('searchbar')(n)) {
      const inp = one(n, tagIs('input')), ask = one(n, c('ask-launch'));
      blocks.push({kind: 'search', value: inp?.attrs.value || '', placeholder: inp?.attrs.placeholder || '', label: inp?.attrs['aria-label'] || '',
        input: inp?.attrs['data-input'] || '', enter: inp?.attrs['data-enter'] || '', ask: ask ? {act: ask.attrs['data-act'] || '', label: text(ask), aria: ask.attrs['aria-label'] || ''} : null});
    } else if (c('search-tools')(n)) blocks.push({kind: 'tools', items: all(n, tagIs('button')).map(press)});
    else if (c('filter-chips')(n)) {
      const btns = all(n, tagIs('button'));
      blocks.push({kind: 'chips', items: btns.filter(c('fchip')).map(b => ({label: text(one(b, c('fchip-label'))), aria: b.attrs['aria-label'] || '', act: b.attrs['data-act'] || '', field: b.attrs['data-field'] || ''})),
        clear: press(btns.find(b => !c('fchip')(b)))});
    } else if (c('saved-searches')(n)) blocks.push({kind: 'saved', label: text(one(n, c('muted'))),
      items: all(n, c('schip')).map(s => { const [run, del] = all(s, tagIs('button')); return {label: text(run), act: run?.attrs['data-act'] || '', i: run?.attrs['data-i'] || '', del: del?.attrs['data-act'] || '', delAria: del?.attrs['aria-label'] || ''}; })});
    else if (n.tag === 'details' && c('filters')(n)) {
      const sum = one(n, tagIs('summary')), adv = one(n, x => x.tag === 'details' && c('advanced')(x)), pips = one(n, c('filter-pips'));
      const outer = all(n, tagIs('label')).filter(l => !adv || !all(adv, tagIs('label')).includes(l));
      blocks.push({kind: 'filters', label: text(one(sum, x => x.tag === 'span' && !c('label-ico')(x) && !c('filters-chev')(x))), icon: icon(svgIn(one(sum, c('label-ico')) || sum)),
        count: text({kids: (one(sum, c('filters-count'))?.kids || []).filter(k => k.text !== undefined)}), open: n.attrs.open !== undefined,
        heading: pips ? text(one(n, c('list-head'))) : '',
        pips: pips ? all(pips, tagIs('button')).map(b => ({value: b.attrs['data-value'] || '', label: b.attrs['aria-label'] || '', on: b.attrs['aria-pressed'] === 'true', act: b.attrs['data-act'] || ''})) : [],
        fields: outer.map(searchField).filter(Boolean),
        advanced: adv ? {label: text(one(adv, tagIs('summary'))), open: adv.attrs.open !== undefined, fields: all(adv, tagIs('label')).map(searchField).filter(Boolean), foot: text(one(adv, c('foot')))} : null});
    } else if (c('row')(n) && c('between')(n)) {
      const b = one(n, tagIs('button'));
      blocks.push({kind: 'count', text: text(one(n, x => (x.tag === 'span' || x.tag === 'p'))), save: press(b)});
    } else if (c('skeleton-grid')(n)) blocks.push({kind: 'loading', count: all(n, c('skel-card')).length});
    else if (c('card-grid')(n)) blocks.push({kind: 'tiles', tiles: all(n, c('grid-card')).map(x => searchTileModel(x, tile++, G))});
    else if (c('hints')(n)) blocks.push({kind: 'hints', label: text(one(n, tagIs('p'))), items: all(n, tagIs('button')).map(b => ({label: text(b), act: b.attrs['data-act'] || '', q: b.attrs['data-q'] || ''}))});
    else if (c('search-fan')(n)) blocks.push({kind: 'fan', title: text(one(n, tagIs('h2'))), text: text(one(n, tagIs('p'))),
      cards: all(n, c('search-fan-card')).map(b => { const img = one(b, tagIs('img')); return {act: b.attrs['data-act'] || '', name: b.attrs['data-name'] || '', id: b.attrs['data-id'] || '', aria: b.attrs['aria-label'] || '', i: Number((/--i:\s*(-?[\d.]+)/.exec(b.attrs.style || '') || [])[1] || 0), picture: picture(img), alt: img?.attrs.alt || ''}; })});
    else if (c('empty')(n)) blocks.push({kind: 'empty', title: text(one(n, tagIs('h3'))), text: text(one(n, tagIs('p')))});
    else if (n.tag === 'button') blocks.push({kind: 'more', ...press(n)});
    else if (c('note')(n) || c('foot')(n) || c('muted')(n) || c('small')(n)) {
      // The words before a button inline in it (e.g. "… Load more, or [show all].") and the words after it, in order.
      const kids = n.kids || [], bi = kids.findIndex(k => k.tag === 'button'), b = bi < 0 ? one(n, tagIs('button')) : kids[bi];
      blocks.push({kind: 'note', text: text({kids: bi < 0 ? kids : kids.slice(0, bi)}), after: bi < 0 ? '' : text({kids: kids.slice(bi + 1)}), warn: c('warn')(n), note: c('note')(n), foot: c('foot')(n), small: c('small')(n),
        center: c('center')(n), pad: c('pad')(n), button: press(b)});
    }
  }
  const U = G === 'mtg' ? S.ui.db : tcgUi(G).search;
  return {game: G, title, views, mode, blocks, busy: !!U.busy, term: G === 'mtg' ? U.term || '' : U.q || ''};
}

// suggest.js on the search box (data-suggest): your recent searches while it is empty, the matching cards as you type,
// through app.js homeLookup (attachSuggest({lookup: homeLookup})), each row as home-search.js homeResultRow draws it.
// app.js homeLookup (4619-4636), verbatim but for the scanner's offline catalogue (scan-catalog.js catalogState(g).pack):
// the app has no scanner yet, so it is idle, as it is on the site until that catalogue is downloaded.
const homeResultCache = new Map();
async function homeLookup(g, q) {
 const k=g+':'+q.toLowerCase();if(homeResultCache.has(k))return homeResultCache.get(k);
 const cached=g==='mtg'?Object.values(S.catalog):Object.values(tcgCache[g]||{});
 const local=[...cached];
 let cards=rankHomeCards(local,q,7,{byName:g==='mtg'}),error=false,corrected=false;
 if(cards.length<5){try{
   if(g==='mtg'){
    let data;try{data=await api('/cards/search?'+new URLSearchParams({q:q+' game:paper',unique:'prints',order:'released'}));}catch(e){if(e.status!==404&&!/404|no cards|not found|zero results|didn.t match/i.test(e.message||''))throw e;data={data:[]};}
    if(!data.data?.length){try{const c=await api('/cards/named?'+new URLSearchParams({fuzzy:q}));data={data:[c]};corrected=true;}catch(e){if(e.status!==404&&!/404|no cards|not found|zero results|ambiguous|didn.t match/i.test(e.message||''))throw e;}}
    cards=rankHomeCards([...cards,...(data.data||[])],q,7,{byName:true});
   }else{
    let result=await tcgSources[g].search({q,size:7,page:0});
    if(!result.cards.length&&q.length>=5){result=await tcgSources[g].search({q:q.slice(0,3),size:40,page:0});corrected=true;}
    cards=rankHomeCards([...cards,...result.cards.map(c=>tcgCardOf(g,c.id)||c)],q);
   }
  }catch{error=true;}}
 const result={cards,error,corrected};if(!error){homeResultCache.set(k,result);if(homeResultCache.size>40)homeResultCache.delete(homeResultCache.keys().next().value);}return result;
}
// A suggestion row (homeResultRow's .lot.home-result): the card's art, name, its set line and the price.
function suggestRow(g, c, i) {
  const b = one(tree(homeResultRow(g, c, i)), tagIs('button')), im = one(b, tagIs('img'));
  return {name: c.name, art: im ? abs(im.attrs.src || '') : '', sub: text(one(b, cls('lot-sub'))), price: text(one(b, cls('price')))};
}
let suggestOut = null, suggestTicket = 0;
function suggestStart(g, q) {
  const my = ++suggestTicket; suggestOut = null;
  if (!String(q || '').trim()) { suggestOut = {q: '', recent: true, items: recentSearches(g).map(name => ({name}))}; return; }
  (async () => { let items; try { items = (await homeLookup(g, q)).cards; } catch { items = []; } if (my === suggestTicket) suggestOut = {q, recent: false, items: (items || []).map((c, i) => suggestRow(g, c, i))}; })();
}

// The sheet's own controls, as app.js handles them; the redraw is the app's.
const cardAct = {
  tab: v => {
    const ctx = sheet; if (!['overview', 'meta', 'guide', 'prices', 'rulings', 'legal'].includes(v)) return;
    ctx.tab = ['legal', 'rulings'].includes(v) ? 'guide' : v;
    // The site records the quote it shows (workbench-ui.js recordQuote) in the account's market history; the app's
    // copy of the workspace is not saved back, so this only lives for this visit.
    if (ctx.tab === 'prices') { const c = ctx.print || meta(ctx.name); recordQuote(S.state, quoteModel('mtg', c, selectedFinish('mtg', c, ctx.priceFinish), ctx.priceEdition, ctx.priceYgoEdition)); }
  },
  face: () => { sheet.face = sheet.face ? 0 : 1; },
  finish: v => {
    const ctx = sheet, card = ctx.print || meta(ctx.name);
    if (!selectPreviewFinish('mtg', card, ctx, v)) return;
    if (ctx.ownedDetail && ctx.priceFinish !== magicOwnedDetail(S.state, ctx.entryId).finish) { ctx.entryId = ''; delete ctx.entry; delete ctx.ownedDetail; delete ctx.condition; delete ctx.language; }
  },
  // A.viewPrint (3699-3714): one of Overview's other printings.
  print: v => {
    const ctx = sheet; if (!ctx?.prints) return;
    const print = ctx.prints[Number(v)]; if (!print) return;
    ctx.print = print; ctx.setId = print.set || '';
    ctx.priceFinish = selectedFinish('mtg', print, ctx.priceFinish);
    ctx.entryId = ''; delete ctx.entry; delete ctx.ownedDetail; delete ctx.condition; delete ctx.language;
    ctx.setVariant = ctx.priceFinish; ctx.face = 0;
  },
  // A.priceSource / A.marketRange act on the open sheet (S.ui.sheetCtx): the price sheet when it stands over the page.
  source: v => { sheetOn().source = v; },
  // workbench-ui.js A.marketRange and C.marketSource ([v] = {key, source}, the select's data-key and value).
  range: v => { if (HISTORY_RANGES.some(([r]) => r === v)) sheetOn().priceRange = v; },
  // The Cards list's price (data-act="buyCard" data-lot): "Buy this card" over the copy's page; its ← (A.buyBack) and
  // "Compare cheaper printings" (A.buyCompare: the page's Overview, at its printings) go back to the page.
  buy: () => { buyOpen(); },
  buyBack: () => { buyShut(); },
  buyCompare: () => { if (buyOn()) sheet.tab = 'overview'; buyShut(); sheet.jump = 'printings'; },
  historySource: v => { const {key, source} = JSON.parse(v); (S.ui.historySource ||= {})[key] = source; },
  more: () => { const ctx = sheet; const c = ctx.print || meta(ctx.name); if (ctx.printsNext) magicVersions(ctx, true); else if (!c?.full) cardExtras(ctx); else magicVersions(ctx); },
};

// app.js A.buyCard (5149), its saved-copy branch (the Cards list's price), verbatim but for openSheet: the copy's page (sheet, opened
// on its entry) is A.buyCard's back; its exact printing is the one the page loaded (A.buyCard fetches it the same way when the device
// lacks it). The quote it shows is recorded (recordQuote) for this visit, as the page's Prices tab records it.
let buyCtx = null;
const buyOn = () => !!buyCtx && buyCtx.back === sheet && S.ui.sheetCtx === buyCtx;
const sheetOn = () => buyOn() ? buyCtx : sheet;
function buyOpen() {
  const back = sheet; buyCtx = null; if (!back?.entryId) return;
  const owned = magicOwnedDetail(S.state, back.entryId, back.name, back.ownedDetail && back.print?.id === back.ownedDetail.printingId ? back.print : undefined);
  if (owned.status !== 'ready' || !magicOwnedCurrent(S.state, owned.identity)) { back.toast = owned.reason || 'This saved copy changed. Reopen it from your collection.'; return; }
  const print = owned.card;
  const ctx = {type: 'buy', entryId: back.entryId, ownedDetail: back.ownedDetail, name: back.name, deckId: back.deckId, print, finish: selectedFinish('mtg', print, back.priceFinish),
    condition: back.condition, language: back.language, asOf: print?.checkedAt, back, backScroll: 0};
  recordQuote(S.state, quoteModel('mtg', print, ctx.finish));
  buyCtx = S.ui.sheetCtx = ctx;
}
// app.js backToCard: the page again (its context is the sheet's).
function buyShut() { if (buyCtx && S.ui.sheetCtx === buyCtx) S.ui.sheetCtx = buyCtx.back; buyCtx = null; }
// views.js buySheet read back: its head, the card (picture, set symbol and name, code · number · language · finish), the version
// it prices (workbench-ui.js priceWorkbench: .price-version), the price blocks the Prices tab reads (pricesModel), the actions and foot.
function buyModel(ctx) {
  const t = tree(buyView(ctx)), head = one(t, cls('sheet-head')), card = one(t, cls('buy-card')), id = one(card, cls('buy-id')), sp = all(id, tagIs('span')).filter(x => cls('small')(x));
  const icon = one(sp[0], cls('set-icon')), v = one(t, cls('price-version'));
  return {title: text(one(head, tagIs('h2'))), back: one(head, x => x.attrs['data-act'] === 'buyBack')?.attrs['aria-label'] || '',
    thumb: abs(one(card, cls('buy-thumb'))?.attrs.src || ''), name: text(one(id, tagIs('b'))),
    set: {icon: urlIn(styleVar(icon, 'icon')), title: icon?.attrs.title || '', rarity: (classes(icon || {attrs: {}}).find(c => c.startsWith('r-')) || '').slice(2), name: text({kids: (sp[0]?.kids || []).filter(k => k !== icon)})},
    line: text(sp[1]),
    version: v ? {eyebrow: text(one(v, cls('eyebrow'))), title: text(one(v, tagIs('b'))), line: text(one(v, tagIs('span'))), foot: text(one(v, cls('foot')))} : null,
    prices: pricesModel(t),
    actions: all(one(t, x => cls('actions')(x)), tagIs('button')).map(press),
    foot: text((t.kids || []).filter(k => k.tag === 'p' && cls('foot')(k)).pop())};
}

// views.js cardSheet() read into a model, block by block as the site draws it.
const styleVar = (n, v) => ((new RegExp('--' + v + ':\\s*([^;]+)').exec(n?.attrs?.style || '') || [])[1] || '').trim();
const urlIn = s => (/url\(['"]?([^'")]+)['"]?\)/.exec(s || '') || [])[1] || '';
const attrsOf = n => Object.fromEntries(Object.entries(n?.attrs || {}).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [k.slice(5), v]));
// A tap target: what it says, its icon (an svg inside, or a LEAD glyph) and the site's data-* attributes, so the app can hand the
// same press to the site (or do it itself where it is native).
const press = n => { if (!n) return null; const g = glyph(text(n)); const p = {label: g.label, icon: icon(svgIn(n)) || g.icon, act: n.attrs['data-act'] || '', data: attrsOf(n), href: n.attrs.href || '', aria: n.attrs['aria-label'] || '', title: n.attrs.title || '',
  ghost: cls('ghost')(n), small: cls('small')(n), link: cls('link')(n), on: cls('on')(n) || n.attrs['aria-pressed'] === 'true', disabled: n.attrs.disabled !== undefined};
  for (const k of Object.keys(p)) if (!p[k] || k === 'data' && !Object.keys(p[k]).length) delete p[k]; return p; };
// Rules text with its symbols and rule words in order: {t} words, {sym} a mana symbol, {rule} a tappable rule word.
const richRuns = n => { const out = []; const walk = (x, b, i) => { for (const k of x.kids || []) {
  if (k.text !== undefined) { const t = k.text.replace(/\s+/g, ' '); if (t) { const last = out[out.length - 1]; if (last && last.t !== undefined && last.b === b && last.i === i) last.t += t; else out.push({t, b, i}); } }
  else if (k.tag === 'img') out.push({sym: k.attrs.src || '', alt: k.attrs.alt || '', title: k.attrs.title || ''});
  // A rule word takes its line's weight (font: inherit), bold inside a Yu-Gi-Oh! condition.
  else if (k.tag === 'button' && cls('rule-word')(k)) out.push({rule: k.attrs['data-rule'] || '', label: text(k), b, i});
  // effectText's logic-condition (style.css 2579: weight 650) reads as bold.
  else if (k.tag !== 'svg') walk(k, b || k.tag === 'b' || k.tag === 'strong' || cls('logic-condition')(k), i || k.tag === 'i' || k.tag === 'em'); } };
  walk(n || {kids: []}, false, false);
  if (out[0]?.t !== undefined) out[0].t = out[0].t.replace(/^\s+/, ''); const z = out[out.length - 1]; if (z?.t !== undefined) z.t = z.t.replace(/\s+$/, '');
  return out.filter(r => r.t === undefined || r.t); };
// A guide or meta block, as a list of typed pieces in the order the site draws them.
function blocks(sec) {
  const out = [];
  for (const k of sec?.kids || []) {
    if (!k.tag) { const t = (k.text || '').trim(); if (t) out.push({kind: 'text', runs: [{t}]}); continue; }
    if (k.tag === 'h3') { const sub = one(k, cls('muted')); out.push({kind: 'title', text: text({kids: (k.kids || []).filter(x => x !== sub)}), sub: text(sub)}); }
    else if (k.tag === 'ol' || k.tag === 'ul') out.push({kind: k.tag === 'ol' ? 'steps' : 'list', items: all(k, tagIs('li')).map(li => ({runs: richRuns(li), foot: text(one(li, tagIs('small')))}))});
    else if (cls('guide-along')(k)) out.push({kind: 'along', rows: all(k, cls('guide-along-row')).map(r => ({name: text(one(r, cls('ellip'))), pct: text(one(r, tagIs('b'))), fill: widthOf(one(r, tagIs('i'))) / 100, press: press(r)}))});
    else if (cls('pair-list')(k)) out.push({kind: 'pairs', rows: all(k, cls('pair-row')).map(r => ({name: text(one(one(r, cls('pair-txt')), tagIs('b'))), why: text(one(one(r, cls('pair-txt')), tagIs('small'))), image: abs(one(r, tagIs('img'))?.attrs.src || ''),
      score: text(one(r, cls('pair-score'))), owned: cls('owned')(r), press: press(r)}))});
    else if (cls('guide-limits')(k)) out.push({kind: 'limits', rows: (k.kids || []).filter(x => x.tag).map(x => ({level: ['ok', 'warn', 'bad'].find(c => cls(c)(x)) || '', formats: text(one(x, tagIs('small'))), copies: text(one(x, tagIs('b')))}))});
    else if (cls('guide-rulings')(k)) out.push({kind: 'rulings', head: text(one(k, cls('list-head'))), items: all(k, tagIs('li')).map(li => ({runs: richRuns(one(li, tagIs('p'))), source: text(one(li, tagIs('small')))})),
      note: text(one(k, x => x.tag === 'p' && cls('muted')(x))), ...(one(k, cls('guide-link')) ? {links: all(k, cls('guide-link')).map(a => ({...press(a), label: text(one(a, tagIs('span')))}))} : {})});
    else if (cls('guide-roles')(k)) out.push({kind: 'roles', items: (k.kids || []).filter(x => x.tag).map(x => ({label: text(x), main: cls('main')(x)}))});
    else if (cls('list')(k) && cls('compact')(k)) out.push({kind: 'rows', rows: all(k, cls('mini-row')).map(r => ({title: text(one(one(r, cls('ellip')), tagIs('b'))), line: text(one(one(r, cls('ellip')), tagIs('small'))), go: text(one(r, cls('link'))), press: press(r)}))});
    else if (k.tag === 'p' && cls('list-head')(k)) out.push({kind: 'head', text: text(k)});
    else if (k.tag === 'p' && cls('foot')(k)) out.push({kind: 'foot', text: text(k)});
    else if (k.tag === 'p' && cls('eyebrow')(k)) out.push({kind: 'eyebrow', text: text(k)});
    else if (k.tag === 'p') out.push({kind: 'text', runs: richRuns(k), muted: cls('muted')(k), small: cls('small')(k), lead: cls('guide-what')(k)});
    else if (k.tag === 'div' && (cls('actions')(k) || cls('row')(k) || cls('guide-rule-links')(k) || cls('chips')(k))) out.push({kind: 'buttons', items: (k.kids || []).filter(x => x.tag === 'button' || x.tag === 'a').map(x => ({...press(x), chip: cls('chip')(x)}))});
    else if (k.tag === 'details') out.push({kind: 'more', summary: text(one(k, tagIs('summary'))), blocks: blocks({kids: (k.kids || []).filter(x => x.tag !== 'summary')})});
    else if (k.tag === 'section' || k.tag === 'div') out.push({kind: 'group', cls: k.attrs.class || '', blocks: blocks(k)});
  }
  return out;
}
// Prices: workbench-ui.js priceOverview (the hero, your copy, a quote warning, historyPanel, pricing-presentation.js sellerRows)
// and views.js's Market details, each read as the site draws it.
const toneOf = n => ['ok', 'warn', 'bad'].find(t => cls(t + '-text')(n)) || '';
// A line with its bold parts, tones and buttons in order: {t, b, tone} words, {press} a control.
const inlineRuns = n => { const out = []; const walk = (x, b, tone) => { for (const k of x.kids || []) {
  if (k.text !== undefined) { const t = k.text.replace(/\s+/g, ' '); if (t) out.push({t, b, tone}); }
  else if (k.tag === 'button' || k.tag === 'a') out.push({press: press(k)});
  else if (k.tag !== 'svg') walk(k, b || k.tag === 'b' || k.tag === 'strong', toneOf(k) || tone); } };
  walk(n || {kids: []}, false, '');
  if (out[0]?.t !== undefined) out[0].t = out[0].t.replace(/^\s+/, ''); const z = out[out.length - 1]; if (z?.t !== undefined) z.t = z.t.replace(/\s+$/, '');
  return out.filter(r => r.t === undefined || r.t); };
const optionsOf = sel => all(sel, tagIs('option')).map(o => ({value: o.attrs.value ?? text(o), label: text(o), on: o.attrs.selected !== undefined}));
const pathPoints = d => { const n = (d || '').match(/-?\d+(?:\.\d+)?/g) || []; const out = []; for (let i = 0; i + 1 < n.length; i += 2) out.push([Number(n[i]), Number(n[i + 1])]); return out; };
const tableOf = table => ({cols: all(one(table, cls('pt-head')), tagIs('b')).map(x => ({finish: x.attrs.class || '', label: text(x)})),
  rows: all(table, cls('pt-row')).map(r => { const l = one(r, cls('pt-label')), sm = one(l, tagIs('small'));
    return {label: text({kids: (l?.kids || []).filter(x => x !== sm)}), sub: text(sm), cells: (r.kids || []).filter(x => x.tag === 'span' && x !== l).map(text)}; })});
const tableCorner = table => text((one(table, cls('pt-head'))?.kids || []).find(k => k.tag === 'span'));
function pricesModel(p) {
  const hero = one(p, cls('price-hero')), fresh = one(hero, cls('price-fresh'));
  const copy = c => { const l = one(c, cls('price-copy-label')), v = one(c, cls('price-copy-value'));
    return {label: text(one(l, tagIs('small'))), title: text(one(l, tagIs('b'))), value: text(one(v, tagIs('b'))), note: text(one(v, tagIs('small'))), foot: text(one(c, cls('foot'))), private: cls('price-private')(c)}; };
  const warn = one(p, cls('quote-warning'));
  // historyPanel, piece by piece in the order it draws them.
  const h = one(p, x => x.attrs.id === 'card-history'), history = h ? {state: h.attrs['data-history-state'] || '', source: h.attrs['data-history-source-state'] || '', blocks: []} : null;
  for (const k of h?.kids || []) {
    if (!k.tag) continue;
    const b = history.blocks;
    if (k.tag === 'h3') b.push({kind: 'title', text: text(k)});
    else if (cls('market-section-head')(k)) { const l = one(k, cls('history-latest')); b.push({kind: 'head', title: text(one(k, tagIs('h3'))), value: text(one(l, tagIs('b'))), label: text(one(l, tagIs('small')))}); }
    else if (cls('history-identity')(k)) b.push({kind: 'identity', text: text(k)});
    else if (cls('history-status')(k)) b.push({kind: cls('foot')(k) ? 'footStatus' : 'status', text: text(k)});
    else if (k.tag === 'label') { const sel = one(k, tagIs('select')); b.push({kind: 'source', label: text({kids: (k.kids || []).filter(x => x !== sel)}), key: sel?.attrs['data-key'] || '', options: optionsOf(sel)}); }
    else if (cls('history-ranges')(k)) b.push({kind: 'ranges', aria: k.attrs['aria-label'] || '', items: all(k, tagIs('button')).map(x => ({range: x.attrs['data-range'] || '', label: text(x), on: cls('on')(x)}))});
    else if (k.tag === 'svg') { const line = one(k, x => x.tag === 'path' && x.attrs.fill === 'none'); b.push({kind: 'chart', aria: k.attrs['aria-label'] || '', points: pathPoints(line?.attrs.d), dots: !!one(k, tagIs('circle'))}); }
    else if (cls('row')(k) && cls('muted')(k)) b.push({kind: 'dates', items: all(k, tagIs('span')).map(text)});
    else if (cls('row')(k)) { const c = one(k, tagIs('b')); b.push({kind: 'range', text: text(one(k, cls('muted'))), change: c ? {text: text(c), tone: toneOf(c)} : null}); }
    else if (cls('history-start')(k)) b.push({kind: 'single', aria: k.attrs['aria-label'] || '', runs: inlineRuns(k)});
    else if (cls('history-empty')(k)) b.push({kind: 'empty', text: text(k)});
    else if (k.tag === 'button') b.push({kind: 'button', press: press(k)});
    else if (cls('history-coverage')(k)) b.push({kind: 'coverage', text: text(k)});
    else if (cls('history-attribution')(k)) { const a = one(k, tagIs('a')); b.push({kind: 'attribution', text: text(a), href: a?.attrs.href || ''}); }
    else if (k.tag === 'details') { const sel = one(k, tagIs('select')), ins = one(k, cls('history-inspector'));
      b.push({kind: 'about', summary: text(one(k, tagIs('summary'))), inspect: ins ? {label: text({kids: (ins.kids || []).filter(x => x !== sel)}), options: optionsOf(sel)} : null,
        foots: (k.kids || []).filter(x => x.tag === 'p').map(text)}); }
    else if (k.tag === 'p') b.push({kind: 'text', text: text(k)});
  }
  const sellers = one(p, cls('market-sellers')), list = one(sellers, cls('vendor-list'));
  const details = (p.kids || []).find(k => k.tag === 'details' && cls('market-details')(k)), table = one(details, cls('price-table'));
  const plist = one(details, cls('print-list')), dk = (details?.kids || []).filter(k => k.tag), printsFoot = plist ? dk[dk.indexOf(plist) + 1] : null;
  return {
    hero: hero ? {eyebrow: text(one(hero, cls('eyebrow'))), value: text(one(hero, cls('price-hero-value'))), id: text(one(hero, cls('price-hero-id'))), rarity: text(one(hero, cls('printing-rarity-label'))),
      fresh: fresh ? {text: text(fresh), state: ['fresh', 'stale', 'unknown'].find(c => cls(c)(fresh)) || 'unknown', title: fresh.attrs.title || ''} : null,
      notes: (hero.kids || []).filter(k => k.tag === 'p').map(text), ...(one(hero, cls('price-selectors')) ? {pickers: pickers(one(hero, cls('price-selectors'))).selects} : {})} : null,
    copies: all(p, cls('price-copy')).map(copy),
    warning: warn ? {summary: text(one(warn, tagIs('summary'))), text: text(one(warn, tagIs('p')))} : null,
    history,
    sellers: sellers ? {title: text(one(sellers, tagIs('h3'))), sub: text(one(one(sellers, cls('market-section-head')), tagIs('span'))), foot: text((sellers.kids || []).find(k => k.tag === 'p' && cls('foot')(k))),
      rows: all(list, cls('vendor-row')).map(a => { const c = one(a, cls('vendor-copy')), q = one(a, cls('vendor-quote'));
        return {name: text(one(c, tagIs('b'))), scope: text(one(c, x => x.tag === 'small' && !cls('vendor-provenance')(x))), provenance: text(one(c, cls('vendor-provenance'))),
          value: text(one(q, tagIs('strong'))), unit: text(one(q, tagIs('small'))), action: text(one(q, cls('vendor-action'))), href: a.attrs.href || '', aria: a.attrs['aria-label'] || ''}; }),
      empty: text(one(list, tagIs('p')))} : null,
    details: details ? {summary: text(one(details, tagIs('summary'))), sources: all(one(details, cls('src-row')), tagIs('button')).map(press),
      table: table ? tableOf(table) : null,
      // Yu-Gi-Oh! and Pokémon name each table's source in its corner (Store, TCGplayer (USD), Cardmarket (EUR)); Pokémon has two.
      ...(all(details, cls('price-table')).some(x => tableCorner(x)) ? {tables: all(details, cls('price-table')).map(x => ({corner: tableCorner(x), ...tableOf(x)}))} : {}),
      lines: (details.kids || []).filter(k => k.tag === 'p' && !(plist && k === printsFoot)).map(k => ({foot: cls('foot')(k), runs: inlineRuns(k)})),
      ...(plist ? {printings: {head: text(one(details, cls('price-printings-head'))), foot: text(printsFoot), rows: all(plist, cls('print')).map(r => { const m = one(r, cls('print-main')), nm = one(m, cls('print-name')), sm = one(nm, tagIs('small')), ts = one(sm, cls('tset')), pr = one(r, cls('print-prices'));
        const buy = one(pr, cls('buy')), ref = (pr?.kids || []).find(k => k.tag === 'span' && cls('pp')(k));
        return {press: press(m), thumb: abs(one(m, cls('print-thumb'))?.attrs.src || ''), name: text(one(nm, tagIs('b'))), tset: ts ? tsetOf(ts) : null, line: text({kids: (sm?.kids || []).filter(k => k !== ts)}),
          buy: buy ? {label: text(buy), href: buy.attrs.href || '', aria: buy.attrs['aria-label'] || ''} : null, refLabel: text((ref?.kids || []).find(k => k.tag === 'small')),
          quotes: all(ref, cls('printing-quote')).map(q => ({label: text(one(q, tagIs('small'))), value: text({kids: (q.kids || []).filter(k => k.tag !== 'small')})})),
          value: one(ref, cls('printing-quote')) ? '' : text({kids: (ref?.kids || []).filter(k => k.tag !== 'small')})}; })}} : {})} : null,
  };
}
function cardPageModel(ctx) {
  if (!ctx) return {missing: true};
  const c = ctx.print || meta(ctx.name);
  if (ctx.blocked || !c) return {name: ctx.name, notice: ctx.ownedNotice || '', loading: !ctx.blocked, deck: ctx.deckId || ''};
  const m = sheetModel(tree(cardView(c, ctx)));
  if (m.overview?.card) m.overview.card.printingsShown = ctx.print?.id || c.id || '';
  const buy = buyCtx && buyCtx.back === ctx && S.ui.sheetCtx === buyCtx ? buyModel(buyCtx) : null, jump = ctx.jump || '', toast = ctx.toast || ''; delete ctx.jump; delete ctx.toast;
  return {game: 'mtg', name: ctx.name, deck: ctx.deckId || '', entry: ctx.entryId || '', ...m, buy, jump, toast,
    // The card the picture is drawn from (finish-preview.js reads the same record): the app's foil needs its frame and finishes.
    shown: (({prices, legalities, purchase_uris, related_uris, all_parts, prints_search_uri, rulings_uri, ...rest}) => rest)(ctx.print || c),
    busy: !!(ctx.detailsBusy || ctx.printsBusy || ctx.rulingsBusy || ctx.ownedLoading || S.ui.guide?.['mtg:' + c.name]?.loading),
    glyphs: sheetGlyphs()};
}
const sheetGlyphs = () => Object.fromEntries(['minus', 'plus', 'close', 'back', 'heart', 'heartOn'].map(k => [k, ICON[k] ? icon(svgIn(tree(ICON[k]))) : null]));
// views.js cardSheet (Magic) or tcg.js tcgCardSheet (Yu-Gi-Oh!, Pokémon): the two draw the same sheet, so one reading serves both. The parts
// only a Yu-Gi-Oh! or Pokémon card has (its emblems, set badge, archetype, printing and edition pickers, Pokémon's text, the stat grid, every
// printing's price) are read where they appear and left out where they don't.
function sheetModel(t) {
  const title = one(t, cls('cs-title')), typeP = one(title, cls('type-line')), owned = one(typeP, cls('card-owned-summary')), heroArt = one(one(t, cls('cs-hero')), cls('cs-art')), embs = one(title, cls('emblems'));
  const head = {art: abs((heroArt?.tag === 'img' ? heroArt : one(heroArt, tagIs('img')))?.attrs.src || ''), title: text(one(title, tagIs('h2'))),
    type: text({kids: (typeP?.kids || []).filter(k => k !== owned)}), owned: owned ? {label: text(owned), aria: owned.attrs['aria-label'] || ''} : null,
    mana: all(one(title, cls('mana')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || '', title: i.attrs.title || ''})), back: !!one(one(t, cls('sheet-head')), x => x.attrs['data-act'] === 'sheetBack'),
    // artwork.js pokemonArtCrop: Pokémon's banner is the card picture cropped to its art window.
    ...(heroArt && cls('pk-crop')(heroArt) ? {crop: 'pokemon'} : {}), ...(embs ? {emblems: embRow(embs)} : {})};
  const tabs = all(one(t, cls('cs-tabs')), tagIs('button')).map(b => ({key: b.attrs['data-tab'], label: text(b), on: cls('on')(b), icon: icon(svgIn(b))}));
  const tab = tabs.find(x => x.on)?.key || 'overview';
  // .cs-overview-head: emblems, the set and its progress, the quick price.
  const oh = one(t, cls('cs-overview-head')), setB = one(oh, cls('card-set-summary')), setI = one(setB, cls('set-icon')), setName = one(one(setB, cls('card-set-identity')), tagIs('b'));
  const prog = one(setB, cls('set-collection-progress')), bar = one(prog, x => x.attrs.role === 'progressbar') || one(prog, cls('set-progress-track')), fill = one(bar, tagIs('span'));
  const setImg = one(one(setB, cls('card-set-identity')), tagIs('img')), setSmall = one(one(setB, cls('card-set-identity')), tagIs('small'));
  const qa = one(oh, cls('card-price-actions'));
  const price = qa ? {buy: (b => b && {brand: text(one(b, cls('card-buy-brand'))), label: text({kids: (b.kids || []).filter(k => !cls('card-buy-brand')(k))}), href: b.attrs.href || '', title: b.attrs.title || '', aria: b.attrs['aria-label'] || ''})(one(qa, cls('card-buy-link'))),
    ref: (b => b && {value: text(one(b, tagIs('strong'))), label: text(one(b, tagIs('span'))), finish: text(one(b, tagIs('small'))), press: press(b)})(one(qa, cls('card-price-reference'))),
    mine: press(one(qa, cls('personal-price-edit'))), add: press(one(qa, cls('card-add-collection'))),
    note: text(one(one(oh, cls('card-price-summary')), x => x.tag === 'p'))} : null;
  const overviewHead = {
    emblems: all(one(oh, cls('imp-chips')), cls('imp-chip')).map(x => ({kind: (classes(x).find(c => c.startsWith('imp-') && c !== 'imp-chip') || '').slice(4), icon: icon(svgIn(x)), title: text(one(x, tagIs('b'))), line: text(one(x, tagIs('small')))})),
    set: setB ? {code: setB.attrs['data-code'] || '', act: setB.attrs['data-act'] || '', rarity: (classes(setI).find(c => c.startsWith('r-')) || 'r-common').slice(2), icon: urlIn(styleVar(setI, 'icon')), iconTitle: setI?.attrs.title || '',
      name: text({kids: (setName?.kids || []).filter(k => !cls('set-go')(k))}), go: !!one(setName, cls('set-go')), line: text(one(one(setB, cls('card-set-identity')), tagIs('small'))),
      progress: prog ? {eyebrow: text(one(prog, cls('eyebrow'))), label: text(one(one(one(prog, cls('set-progress-top')), tagIs('span')), x => x.tag === 'span' && !cls('eyebrow')(x))), pct: text(one(prog, tagIs('strong'))),
        // Yu-Gi-Oh!'s unverified card total draws no bar (tcg.js setProgress), only the count and its caption.
        fill: Number(styleVar(fill, 'progress-to')) || 0, track: !!bar, caption: text(one(prog, cls('set-progress-caption')))} : null,
      ...(setImg ? {picture: {src: [setImg.attrs.src, setImg.attrs['data-direct']].filter(Boolean).map(abs), kind: classes(setImg).find(x => ['ygo-pack', 'pks', 'set-logo'].includes(x)) || '', alt: setImg.attrs.alt || ''}} : {}),
      ...(one(setSmall, x => cls('tset')(x) || x.tag === 'img') ? {parts: lineParts(setSmall)} : {}), ...(setI ? {} : {press: press(setB)})} : null,
    price, ...(one(oh, cls('card-archetype')) ? {archetype: press(one(oh, cls('card-archetype')))} : {})};
  // Overview: the card, its finishes, its other printings; then the rules text and what you do with it.
  const ov = one(t, x => x.attrs.id === 'card-panel-overview'), pv = one(ov, cls('ygo-price-preview')), stack = one(ov, cls('cd-art-stack')), cdImg = one(stack, cls('cd-img')), zoom = one(cdImg, cls('cd-zoom')), img = one(zoom, tagIs('img'));
  let finishModel = null; try { finishModel = JSON.parse(cdImg?.attrs['data-finish-model'] || 'null'); } catch {}
  const fp = one(stack, cls('finish-preview')), pp = one(stack, cls('card-printing-preview')), flip = one(stack, x => x.attrs['data-act'] === 'flipFace');
  // Yu-Gi-Oh!'s pictures are the site's own (img/ygo/…): whole addresses, as the app loads them.
  const card = {image: abs(img?.attrs.src || ''), sources: sources(img).map(abs), tier: styleVar(img, 'tier'), tierKey: img?.attrs['data-tier'] || '', zoom: zoom ? {src: abs(zoom.attrs['data-src'] || ''), hi: abs(zoom.attrs['data-hi'] || ''), art: abs(zoom.attrs['data-art'] || ''), aria: zoom.attrs['aria-label'] || ''} : null,
    finish: finishModel && {key: finishModel.key || '', label: finishModel.label || '', effect: finishModel.effect || cdImg?.attrs['data-finish-effect'] || ''},
    // A Yu-Gi-Oh! or Pokémon card's foil as finish-preview.js models it (tcgTileModel's reading): the recipe, its masks, the Level-star foil.
    ...(finishModel?.game && finishModel.game !== 'mtg' ? {tcgFinish: {effect: finishModel.effect || cdImg?.attrs['data-finish-effect'] || '', treatment: finishModel.treatment || '', mask: finishModel.layers?.[0]?.mask || '',
      clip: finishModel.overlayProfiles?.[0]?.mask || '', stars: Number(finishModel.stars) || 0}} : {}),
    flip: flip ? press(flip) : null,
    finishes: fp ? {label: text(one(fp, x => cls('small')(x) && cls('muted')(x) && !cls('finish-choice-hint')(x))), chips: all(fp, x => cls('finish-choice-chip')(x) || cls('ygo-rarity-chip')(x)).map(b => ({finish: b.attrs['data-finish'] || '', label: text(b), on: cls('on')(b),
      swatch: (classes(one(b, cls('rarity-swatch'))).find(c => c.startsWith('rarity-swatch-')) || '').slice(14), ...(b.attrs['data-act'] !== 'cardFinish' ? {press: press(b)} : {})})), foot: text(one(fp, cls('foot')))} : null,
    profile: press(one(stack, cls('card-profile-photo'))),
    printings: pp ? {title: text(one(pp, tagIs('h3'))), more: press(one(one(pp, cls('row')), tagIs('button'))),
      rows: all(pp, cls('card-printing-mini')).map(b => ({i: b.attrs['data-i'] !== undefined ? Number(b.attrs['data-i']) : -1, picture: picture(one(b, tagIs('img'))), name: text(one(b, tagIs('b'))), num: text(one(b, tagIs('small'))), aria: b.attrs['aria-label'] || '', on: cls('on')(b) || b.attrs['aria-current'] !== undefined,
        // img[data-tier] (style.css 2287): a 2 px ring in the price tier's colour inside the picture's box (#9aa3ad unless it says).
        ...(one(b, tagIs('img'))?.attrs['data-tier'] ? {tierKey: one(b, tagIs('img')).attrs['data-tier'], tier: styleVar(one(b, tagIs('img')), 'tier') || '#9aa3ad'} : {}),
        ...(b.attrs['data-i'] === undefined ? {press: press(b)} : {})})),
      notes: (pp.kids || []).filter(k => k.tag === 'p' && !cls('foot')(k)).map(k => ({text: text(k), retry: press(one(k, tagIs('button')))})).filter(n => n.text || n.retry), foot: text(one(pp, x => x.tag === 'p' && cls('foot')(x)))} : null,
  };
  const side = one(ov, cls('cs-card-side')), readable = one(side, cls('cs-readable')), disc = one(readable, cls('card-discovery'));
  const faces = all(readable, x => x.tag === 'section' && cls('cd-text')(x)).map(s => {
    const multi = cls('pk')(s) ? null : one(s, x => cls('row')(x) && cls('between')(x) && !cls('small')(x)), fl = one(s, cls('flavor')), foot = one(s, x => cls('row')(x) && cls('small')(x)), artist = one(foot, cls('card-artist')) || one(s, cls('card-artist'));
    return {eyebrow: text(one(s, cls('effect-label'))), name: text(one(multi, tagIs('b'))), mana: all(one(multi, cls('mana')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
      type: multi ? text(one(s, x => x.tag === 'p' && cls('type-line')(x))) : '', lines: all(one(s, cls('oracle')), cls('effect-line')).map(richRuns),
      flavor: fl ? {label: text(one(fl, tagIs('small'))), text: text({kids: (fl.kids || []).filter(k => k.tag !== 'small')})} : null,
      pt: text(one(foot, cls('pt'))), artist: artist ? {name: text(one(artist, tagIs('button'))) || text(artist).replace(/^🖌\s*/u, ''), press: press(one(artist, tagIs('button')))} : null,
      ...(cls('pk')(s) ? {pk: pkText(s)} : {}), ...(one(s, cls('logic-condition')) ? {logic: true} : {})};
  });
  const loading = one(readable, x => x.attrs.id === 'cardLoading');
  const deckPanel = one(side, x => cls('panel')(x) && cls('tight')(x)), legal = one(side, cls('deck-legal')), sec = one(side, cls('cs-secondary')), fact = one(sec, cls('fact'));
  const actions = one(side, cls('card-secondary-actions')), groups = one(actions, cls('owned-groups')), ca = one(actions, cls('card-actions'));
  const overview = {card, discovery: disc ? {summary: text(one(disc, tagIs('summary'))), text: text(one(disc, tagIs('p'))), chips: all(disc, tagIs('button')).map(press)} : null, faces,
    loading: loading ? {text: text({kids: (loading.kids || []).filter(k => k.tag !== 'button')}), retry: press(one(loading, tagIs('button')))} : null,
    rulesEntry: press(one(one(readable, cls('card-rules-entry')), tagIs('button'))),
    alert: (b => b && {title: text(one(b, tagIs('b'))), line: text(one(b, tagIs('small'))), press: press(b)})(one(side, cls('watch-status'))),
    // Magic's line sits under the rules text; tcg.js puts it, muted, at the head of the collection and deck actions.
    own: text(one(side, cls('own-line'))), ownInActions: !!one(one(side, cls('card-secondary-actions')), cls('own-line')), ownMuted: cls('muted')(one(side, cls('own-line')) || {attrs: {}}),
    legal: legal ? {level: ['ok-text', 'warn-text', 'bad-text'].find(c => cls(c)(legal))?.replace('-text', '') || '', ...(g => ({icon: g.icon, runs: runs({kids: [{text: g.label}]})}))(glyph(text({kids: (legal.kids || []).filter(k => !cls('muted')(k))}))),
      deck: text(one(legal, cls('muted')))} : null,
    deck: deckPanel ? {title: text(one(one(deckPanel, cls('row')), tagIs('b'))), qty: Number(text(one(one(deckPanel, cls('stepper')), tagIs('b')))) || 0,
      steps: all(one(deckPanel, cls('stepper')), tagIs('button')).map(press), remove: press(one(deckPanel, x => x.attrs['data-act'] === 'deckRemove'))} : null,
    chips: all(one(sec, cls('chips')), cls('chip')).map(x => ({label: text(x), role: (classes(x).find(k => k.startsWith('role-')) || '').slice(5), warn: cls('warn')(x)})),
    fact: fact ? {label: text(one(fact, cls('fact-label'))), text: rawText(all(fact, tagIs('p')).find(x => x.attrs.hidden === undefined) || one(fact, tagIs('p'))),
      ...(all(fact, tagIs('p')).length > 1 ? {all: all(fact, tagIs('p')).map(rawText), next: press(one(fact, x => x.attrs['data-act'] === 'nextFact'))} : {})} : null,
    ...(one(sec, cls('stat-grid')) ? {stats: (one(sec, cls('stat-grid')).kids || []).filter(k => k.tag).map(k => { const note = (k.kids || []).find(x => x.tag === 'span');
      return {label: text(one(k, tagIs('small'))), value: text(one(k, tagIs('b'))), wide: k.attrs['data-stat-wide'] === 'true', ...(note ? {note: text(note), tone: toneOf(note) || (cls('muted')(note) ? 'muted' : '')} : {})}; })} : {}),
    ...(one(sec, cls('stat-help')) ? {statHelp: {summary: text(one(one(sec, cls('stat-help')), tagIs('summary'))), runs: richRuns(one(one(sec, cls('stat-help')), tagIs('p')))}} : {}),
    research: {label: text(one(one(sec, cls('research')), cls('muted'))), links: (one(sec, cls('research'))?.kids || []).filter(k => k.tag === 'a' || k.tag === 'button').map(press)},
    owned: groups ? {aria: groups.attrs['aria-label'] || '', groups: all(groups, cls('owned-group')).map(g => ({lot: g.attrs['data-owned-group'] || '', label: text(one(g, cls('owned-group-label'))),
      qty: Number(text(one(one(g, cls('owned-copy-details')), tagIs('b')))) || 0, steps: all(one(g, cls('owned-pill')), x => x.tag === 'button' && x.attrs['data-act'] === 'cardOwnedQty').map(press), details: press(one(g, cls('owned-copy-details')))}))} : null,
    main: all(one(ca, cls('ca-main')), x => x.tag === 'button' || x.tag === 'a').map(press), more: all(one(ca, cls('ca-more')), x => x.tag === 'button' || x.tag === 'a').map(press)};
  const panel = id => one(t, x => x.attrs.id === 'card-panel-' + id);
  const metaP = panel('meta'), guideP = panel('guide'), guide = one(guideP, cls('card-guide')), pricesP = panel('prices');
  return {tab, head, tabs, overviewHead, overview: pv ? {...overview, selectors: pickers(pv)} : overview,
    meta: metaP ? {sections: all(metaP, cls('meta-use')).map(blocks), foot: text((metaP.kids || []).find(k => k.tag === 'p' && cls('foot')(k)))} : null,
    prices: pricesP ? pricesModel(pricesP) : null,
    guide: guide ? {sections: (guide.kids || []).filter(k => k.tag).map(k => ({cls: k.attrs.class || '', panel: cls('guide-panel')(k), hero: cls('guide-hero')(k), blocks: k.tag === 'p' ? [{kind: cls('foot')(k) ? 'foot' : 'text', text: text(k), runs: richRuns(k)}] : blocks(k)}))} : null};
}
// Text as written, hidden parts included (a fact the site keeps for "Another fact ›").
const rawText = n => { if (!n) return ''; const walk = x => x.text !== undefined ? x.text : x.tag === 'svg' ? '' : (x.kids || []).map(walk).join(''); return walk(n).replace(/\s+/g, ' ').trim(); };
// emblems.js gameEmblems: Yu-Gi-Oh!'s Level / Rank star or Link rating and Attribute orb, a Spell or Trap's property; Pokémon's energy orbs and HP.
const embRow = n => (n?.kids || []).filter(k => k.tag).map(k => { if (k.tag === 'svg') return {icon: icon(k), label: k.attrs['aria-label'] || ''};
  const lm = one(k, cls('link-mark'));
  return cls('lvl')(k) ? {icon: icon(svgIn(k)), text: text({kids: (k.kids || []).filter(x => x !== lm)}), mark: text(lm), label: k.attrs['aria-label'] || ''} : {text: text(k), hp: cls('hp')(k)}; });
// A line with Yu-Gi-Oh!'s set badge (emblems.js tcgSetBadge: code and rarity code) or Pokémon's rarity symbol among its words.
const tsetOf = k => { const rx = one(k, cls('rx-code'));
  return {tone: classes(k).find(x => ['secret', 'ultra', 'super', 'rare', 'common'].includes(x)) || '', code: text(one(k, tagIs('b'))),
    rarity: rx ? {text: text(rx), kind: (classes(rx).find(x => x.startsWith('rx-') && x !== 'rx-code') || 'rx-common').slice(3)} : null, title: k.attrs.title || ''}; };
const lineParts = n => { const out = []; for (const k of n?.kids || []) {
  if (k.text !== undefined) { const t = k.text.replace(/\s+/g, ' '); if (t.trim()) out.push({t}); }
  else if (cls('tset')(k)) out.push({tset: tsetOf(k)});
  else if (k.tag === 'img') out.push({img: [k.attrs.src, k.attrs['data-direct']].filter(Boolean).map(abs), alt: k.attrs.alt || '', ink: cls('ink')(k), kind: k.attrs.class || ''});
  else if (k.tag !== 'svg') { const t = text(k); if (t) out.push({t, b: k.tag === 'b'}); } }
  return out; };
// workbench-ui.js's Printing & rarity and Edition pickers (ygoPreviewSelectors, the price hero's .price-selectors).
const pickers = n => ({selects: all(n, tagIs('label')).filter(l => one(l, tagIs('select'))).map(l => { const sel = one(l, tagIs('select'));
  return {title: text({kids: (l.kids || []).filter(x => x !== sel)}), name: sel.attrs['data-change'] || '', aria: sel.attrs['aria-label'] || '', options: optionsOf(sel)}; }),
  foot: text((n.kids || []).find(k => k.tag === 'p' && cls('foot')(k)))});
// A line of Pokémon text with its energy orbs in place: {t} words, {icon, label} an orb.
const orbRuns = n => { const out = []; const walk = x => { for (const k of x.kids || []) {
  if (k.text !== undefined) { const t = k.text.replace(/\s+/g, ' '); if (t) out.push({t}); }
  else if (k.tag === 'svg') out.push({icon: icon(k), label: k.attrs['aria-label'] || ''});
  else walk(k); } }; walk(n || {kids: []}); if (out[0]?.t) out[0].t = out[0].t.replace(/^\s+/, ''); const z = out[out.length - 1]; if (z?.t) z.t = z.t.replace(/\s+$/, ''); return out.filter(r => !r.t || r.t.length); };
// tcg.js pokemonText: Evolves from, the Abilities and attacks (with their Energy costs and damage), the card's own rules text, then the
// Weakness / Resistance / Retreat strip.
function pkText(s) {
  const evo = one(s, cls('card-evolution'));
  return {evolves: evo ? {label: text(one(evo, cls('muted'))), name: text(one(evo, tagIs('b')))} : null,
    abilities: all(s, cls('pk-ability')).map(a => ({tag: text(one(a, cls('pk-tag'))), name: text((a.kids || []).find(k => k.tag === 'b')), runs: richRuns(one(a, tagIs('p')))})),
    attacks: all(s, cls('pk-attack')).map(a => { const r = one(a, cls('row')), name = one(one(r, cls('row')), x => x.tag === 'b');
      return {costs: all(one(r, cls('costs')), tagIs('svg')).map(x => ({icon: icon(x), label: x.attrs['aria-label'] || ''})), name: text(name), damage: text(one(r, cls('dmg'))), runs: richRuns(one(a, tagIs('p')))}; }),
    rules: (s.kids || []).filter(k => cls('oracle')(k)).map(k => k.tag === 'p' ? [richRuns(k)] : all(k, cls('effect-line')).map(richRuns)).flat(),
    strip: all(one(s, cls('pk-strip')), tagIs('span')).filter(x => !cls('energy-txt')(x)).map(orbRuns)};
}

let job = 0, status = {busy: false, step: '', error: null};
const json = v => JSON.stringify(v);

// Open Pack (the set page's simulator): app.js A.openSetPack and pack-preview.js openPackPreview's draw, its fill and the
// reads each pulled card's reveal is made of (tierOf, feelOf, packFinishes), without the dialog, which the app draws.
// Nothing here touches the account: the preview adds nothing to the collection.
const PACK_FEELS = ['pack-reveal', 'pack-tier-1', 'pack-tier-2', 'pack-tier-3', 'pack-tier-4', 'pack-tier-5'];
const PACK_RARITY_FEEL = ['pack-reveal', 'pack-reveal', 'pack-tier-2', 'pack-tier-3', 'pack-tier-4'];
let pack = null, packWant = null, todayGo = null, setDone = true, todayLoad = true;
const packScreen = G => G === 'mtg' ? S.ui.set : tcgUi(G).set;
const packRelease = G => G === 'mtg' ? S.ui.set.code : tcgUi(G).set.id;
async function packStart(P) {
  const game = P.game, screen = packScreen(game), set = screen.info, release = packRelease(game);
  if (!packEligible(game, set) || screen.busy || screen.error || !screen.loaded) throw Error('Wait for this set to finish loading.');
  const isCurrent = () => pack === P && packRelease(game) === release;
  let cards = screen.cards;
  // Pull rates need every Pokémon card's rarity; summaries without one are filled from TCGdex first.
  if (game === 'ptcg' && cards.some(c => !c.rarity)) { const map = await ptcgSetRarities(screen.id, set?.cardCount?.total || set?.count || cards.length).catch(() => new Map()); if (!isCurrent()) return false; cards = cards.map(c => c.rarity || !map.has(String(c.id)) ? c : {...c, rarity: map.get(String(c.id))}); }
  // Magic packs use the set's real booster sheets when they are baked (all cards they can give are fetched once); otherwise the era's pack table.
  let booster = null;
  if (game === 'mtg') { const data = await loadMtgBooster(screen.code); if (!isCurrent()) return false; if (data) { const map = await mtgBoosterCards(data, cards).catch(() => null); if (!isCurrent()) return false; if (map?.size) booster = {data, cards: map}; } }
  // openPackPreview: only a Yu-Gi-Oh! card keeps the release it was listed under (its printing), with the pack's date standing in.
  // app.js A.openSetPack: today's pack guarantees the Card of the Day on its first opening each day; after that it opens with the
  // set's normal pull rates like any other pack. openPackPreview then strips (or, for Yu-Gi-Oh!, rolls) the hit's printing.
  const want = P.want, dayKey = want && `cardstashy-today-pack:${game}:${want.date}:${want.id}`; let firstToday = !!want; try { if (dayKey && localStorage.getItem(dayKey)) firstToday = false; } catch {}
  const found = firstToday && want?.game === game ? cards.find(c => String(c.id) === String(want.id)) || (game === 'mtg' ? cards.find(c => c.name === want.name) || want.card || null : null) : null;
  let featured = found && want.rarity ? {...found, featuredRarity: want.rarity} : found;
  if (game !== 'ygo') { cards = cards.map(({setContext, ...c}) => c); if (featured) { const {setContext, ...f} = featured; featured = f; } }
  const inRelease = c => c?.setContext?.releaseId ? {...c, setContext: {...c.setContext, game: 'ygo', cardId: c.id, status: 'resolved', date: c.setContext.date || set?.date || ''}} : c;
  if (game === 'ygo') { cards = cards.map(inRelease); featured = featured && rollYgoPrinting(inRelease(featured), packRandom, featured.featuredRarity); }
  Object.assign(P, {featured, dayKey: featured ? dayKey : '', set, cards, booster, release, size: packSize(game, set), complete: game === 'mtg' ? screen.cards.length === set.card_count : screen.contents?.completeness === 'complete'});
  return true;
}
// openPackPreview's draw().
function packDraw(P) {
  const {game, cards, booster, size, set} = P;
  const collectorRoll = p => game === 'mtg' && packRandom() < COLLECTOR_ODDS ? collectorPicks(p) : p;
  if (!booster) return collectorRoll(samplePack(game, cards, size, packRandom, set));
  const p = collectorRoll(drawMtgBooster(booster.data, booster.cards, packRandom));
  return packRandom() < MTG_GOD_ODDS[p.collector ? 'collector' : 'regular'] && mtgGodPackPicks(booster.data, booster.cards, p.length, packRandom) || p;
}
// openPackPreview's fill(): pulled shiny slots load their full card in the background and pick up their holo before they are seen.
function packFill(P) {
  const game = P.game, hydrate = game === 'ptcg' ? c => tcgSources.ptcg.get(String(c.id), {prices: true}) : null;
  if (!hydrate) return;
  const n = ++P.deal, now = P.picks;
  now.forEach((c, i) => {
    const hit = !!P.featured && c === P.featured;
    if (!packNeedsHydration(game, c, hit)) return;
    Promise.resolve().then(() => hydrate(c)).then(full => {
      if (pack !== P || n !== P.deal || !full || String(full.id) !== String(c.id)) return;
      const {setContext, ...rest} = full; now[i] = {...c, ...rest, name: c.name, rarity: c.rarity || full.rarity, packSlot: c.packSlot}; P.ctxs[i] = (hit && packHitFinish(game, now[i])) || packFinishes(game, [now[i]])[0]; P.stamp++;
    }).catch(() => {});
  });
}
function packDeal(P) {
  let picks = packDraw(P);
  // openPackPreview: today's pack — the Card of the Day takes the hit's place (the first pack only; "again" draws as usual).
  const featured = !P.dealt ? P.featured : null, {game, cards, size, set} = P;
  if (featured) picks = P.booster ? [...picks.slice(0, -1).filter(c => String(c.id) !== String(featured.id)), featured] : [...samplePack(game, cards.filter(c => String(c.id) !== String(featured.id)), size - 1, packRandom, set).slice(0, size - 1), featured];
  P.picks = picks; if (!P.picks.length) throw Error('Load this set’s cards first.');
  P.ctxs = packFinishes(P.game, P.picks);
  // The featured hit comes out in its foil when it has one.
  if (featured) { const f = packHitFinish(game, featured); if (f) P.ctxs[picks.length - 1] = f; }
  P.dealt = true; P.stamp++; packFill(P);
  // Today's guaranteed pull is claimed only once the pack has actually opened.
  if (featured && P.dayKey) try { localStorage.setItem(P.dayKey, '1'); } catch {}
}
// One pulled card as the reveal reads it: its picture, rarity and finish, its price tier (tierOf: the collection's border colours,
// unpriced grey) and the size of its flip (feelOf: its trusted price or its rarity, whichever is bigger).
function packPickModel(P, i) {
  const game = P.game, c = P.picks[i], pulled = P.ctxs[i] || {}, rarity = packRarity(game, c), price = packPrice(game, c, pulled), trusted = trustedPackPrice(game, c, pulled);
  const byPrice = packRevealHaptic(trusted), byRarity = PACK_RARITY_FEEL[Math.min(4, rarity.rank)];
  const feel = PACK_FEELS.indexOf(byRarity) > PACK_FEELS.indexOf(byPrice) ? byRarity : byPrice, tier = price ? TIERS[priceTier(price)] : null;
  const art = game === 'mtg' ? cardImage(c, 'normal') : c.imageLarge || c.image || '';
  // A Magic pull that is one of this set page's cards opens as that tile does (data-set-i); a bonus-sheet card opens its own printing.
  const setI = game === 'mtg' && c.set === S.ui.set.code ? S.ui.set.cards.findIndex(x => x.id === c.id) : -1;
  return {id: String(c.id ?? ''), name: c.name || '', image: abs(setImageUrl(art)), rarity: rarity.label, rank: rarity.rank,
    finish: game === 'mtg' ? pulled.finish || '' : pulled.priceFinish || '', finishLabel: packFinishLabel(game, pulled, rarity.label),
    tier: tier ? tier.key : 'tn', tierColor: tier ? tier.color : '#8b939c', level: PACK_FEELS.indexOf(feel),
    worth: trusted || price || 0, setI, card: game === 'mtg' ? c : null, ...(game === 'mtg' ? {} : packTcgPick(P, c, pulled))};
}
// A Yu-Gi-Oh! or Pokémon pull: its foil (finishAttrs(game, c, ctx, 'pack'), as the dialog's face reads it, in tcgTileModel's shape)
// and how pack-preview.js onDetails opens it (A.tCard's dataset: the set, the finish it came out in, a Yu-Gi-Oh! printing).
function packTcgPick(P, c, pulled) {
  const game = P.game, i = one(tree(`<i ${finishAttrs(game, c, pulled, 'pack')}></i>`), tagIs('i'));
  let f = null; try { f = JSON.parse(i?.attrs['data-finish-model'] || 'null'); } catch {}
  // rarity-emblem.js rarityEmblem(game, label): the pill's colour family, and Pokémon's printed rarity mark (img.pkr or span.rar).
  const label = packRarity(game, c).label, mk = game === 'ptcg' ? tree(pkRarity(label)) : null, img = one(mk, cls('pkr')), rar = one(mk, cls('rar'));
  const rx = {kind: rarityKind(game, label), mark: img ? {src: [img.attrs.src, img.attrs['data-direct']].filter(Boolean).map(abs), ink: cls('ink')(img), alt: img.attrs.alt || ''}
    : rar ? {text: text(rar), gold: cls('gold')(rar)} : null};
  return {rx, tcgFinish: f && {effect: f.effect || i.attrs['data-finish-effect'] || '', treatment: f.treatment || '', mask: f.layers?.[0]?.mask || '', clip: f.overlayProfiles?.[0]?.mask || '',
      stars: Number(f.stars) || 0, frame: String(c.frame || c.cardType || c.typeLine || '')},
    open: {game, id: String(c.id), setId: String(P.set?.id ?? ''), ...(pulled.priceFinish ? {setVariant: pulled.priceFinish} : {}),
      ...(game === 'ygo' && c.setContext?.printing ? {printing: c.setContext.printing.code + '::' + c.setContext.printing.rarity} : {})}};
}
// A Yu-Gi-Oh! or Pokémon pack's looks (openPackPreview): its emblem (setEmblems), its template art (packTemplateArt: the art, its
// focus, Pokémon's logo, Yu-Gi-Oh!'s set code), the pictures behind it (packArtSources, then setArtworkSources) and the card back.
function packTcgLook(P) {
  const {game, set} = P, tpl = packTemplateArt(game, set);
  return {emblems: (game === 'ptcg' ? pkCatalogueSymbolSources(set) : []).map(abs),
    template: tpl && {art: abs(String(tpl.art).replace(/^\.\//, '')), x: tpl.x, y: tpl.y, logo: abs(tpl.logo || ''), sub: tpl.sub || ''},
    sources: [...packArtSources(game, set, packArtUrl(game, set)), ...setArtworkSources(game, set, P.picks?.[0])].filter(Boolean).map(abs),
    back: abs(`/img/back/${game}.jpg`)};
}
// ---------------------------------------------------------------- a Yu-Gi-Oh! or Pokémon card's page (tcg.js tcgCardSheet)
// tcg.js A.tCard (tcg.js:2349) without the DOM: the sheet's context as the site builds it from the pressed element's dataset (o), then
// the full card (ensureCard), Pokémon's other printings (an exact-name search, newest first) and the game's set list (ctx.loadSets).
let tsheet = null;
function tcardOpen(o) {
  const G = o.game === 'ptcg' ? 'ptcg' : 'ygo', id = String(o.id || '');
  const as = JSON.stringify([G, id, o.entry || '', o.setId || '', o.setVariant || '', o.printing || '', o.edition || '', o.deck || '', o.pack ?? '', !!o.random]);
  tcgFocus(G, S.ui.view || 'set', S.ui.tsetId || '');
  if (tsheet && tsheet.openedAs === as && S.ui.sheetCtx === tsheet) return tsheet;
  const lot = o.entry ? tcgGs(G).collection.find(e => e.id === o.entry && String(e.cardId) === id) : null,
    setId = o.setId || (G === 'ygo' ? lot?.setReleaseId : '') || '', setReleaseUnverified = !!(G === 'ygo' && lot?.setReleaseUnverified),
    sctx = {type: 'tcard', game: G, id, setId, setReleaseUnverified, previewBusy: G === 'ptcg', previewMore: null, previewError: '', setVariant: o.setVariant || lot?.variant || '', priceFinish: o.setVariant || lot?.variant || '',
      priceEdition: G === 'ygo' ? (o.printing || (lot?.printing && lot?.rarity ? lot.printing + '::' + lot.rarity : '')) : '', priceYgoEdition: G === 'ygo' ? (o.edition || lot?.edition || '') : '',
      entryId: lot?.id || '', savedVariant: lot?.variant || '', savedProductId: lot?.productId || '', random: !!o.random, deckId: o.deck || null, openedAs: as};
  if (G === 'ygo' && o.ygoPurchase === '1' && Object.hasOwn(o, 'edition')) sctx.ygoEditionExplicit = true;
  const sourceMembership = tcgUi(G).set.info?.id === sctx.setId ? tcgUi(G).set.cards.find(card => card.id === id)?.setContext : null;
  if (sourceMembership?.membership === 'set-response' && sourceMembership.game === G && sourceMembership.cardId === id && sourceMembership.releaseId === sctx.setId) sctx.setMembership = {...sourceMembership};
  tsheet = S.ui.sheetCtx = sctx;
  return sctx;
}
// tcg.js remember() for a search's brief printings: a card already known in full stays the full one; a new one joins the cache.
const rememberPrint = c => { const prev = tcgCache[c.game]?.[c.id]; if (c.brief && prev && !prev.brief) return prev; if (tcgCache[c.game] && !prev) tcgCache[c.game][c.id] = c; return c; };
async function tcardLoad(sctx) {
  const G = sctx.game, still = () => tsheet === sctx && S.ui.sheetCtx === sctx;
  try {
    const card = await tcgEnsureCard(G, sctx.id);
    if (!still()) return;
    if (G === 'ptcg') {
      sctx.previewBusy = true;
      try {
        const result = await tcgSources.ptcg.search({q: card.name, sort: 'new', page: 0, exactName: true});
        if (!still()) return;
        if (!Array.isArray(result?.cards)) throw Error('The printing database returned an invalid result.');
        sctx.previewPrints = result.cards.filter(p => p?.id && p.game === 'ptcg' && String(p.name || '').normalize('NFC').toLowerCase() === card.name.normalize('NFC').toLowerCase()).map(rememberPrint);
        sctx.previewMore = !!result.more; sctx.previewError = '';
      } catch (e) { if (still()) sctx.previewError = e.message || 'Printings could not load.'; }
      finally { if (still()) sctx.previewBusy = false; }
    }
    if (!tcgUi(G).sets.list.length) await tcgCtx.loadSets(G).catch(() => {});
    if (still()) await tcardTabLoads(sctx);
  } catch (e) { if (still()) sctx.error = e.message || 'Couldn’t load card'; }
}
// app.js contextTcgCard (829-838): the card as this sheet shows it, projected into the set it was opened from.
function contextTcgCard(game, id, ctx = tsheet) {
  if (!['ptcg', 'ygo'].includes(game)) return null;
  const card = tcgCardOf(game, id);
  if (!card || (card.game && card.game !== game)) return null;
  const contextId = ctx?.id ?? ctx?.card?.id;
  const scoped = ['tcard', 'tadd', 'market'].includes(ctx?.type) && ctx.game === game && String(contextId) === String(id);
  const membership = ctx?.setMembership;
  const source = scoped && membership?.membership === 'set-response' && membership.game === game && String(membership.cardId) === String(id) && membership.releaseId === ctx.setId ? {...card, setContext: membership} : card;
  return scoped && (ctx.setId || ctx.setReleaseUnverified) ? tcgSetContextCard(game, source, ctx.setId, game === 'ygo' ? tcgYgoCatalogue() : tcgUi(game).sets.list, {variantKey: ctx.setVariant || '', unverifiedRelease: !!ctx.setReleaseUnverified}) : card;
}
// The sheet's own controls, as app.js (cardTab, cardFinishPreview, ygoPickRarity, cardPriceJump) and workbench-ui.js (historyEdition,
// historyYgoEdition and their overview twins, marketRange, marketSource) handle them; the redraw is the app's.
const ygoPrinting = (sctx, v) => { sctx.priceEdition = v; sctx.priceYgoEdition = ''; sctx.ygoPrintingExplicit = true; sctx.ygoEditionExplicit = false; delete sctx.ygoPriceDefault; };
const ygoEdition = (sctx, v) => { sctx.priceYgoEdition = v; sctx.ygoEditionExplicit = true; delete sctx.ygoPriceDefault; };
const tcardAct = {
  tab: v => {
    const sctx = tsheet; if (!['overview', 'meta', 'guide', 'prices', 'rulings', 'legal'].includes(v)) return;
    sctx.tab = ['legal', 'rulings'].includes(v) ? 'guide' : v;
    // As the Magic sheet: the quote shown is recorded in the account's market history for this visit only (the app's copy isn't saved back).
    if (sctx.tab === 'prices') { const c = contextTcgCard(sctx.game, sctx.id, sctx); if (c) recordQuote(S.state, quoteModel(sctx.game, c, selectedFinish(sctx.game, c, sctx.priceFinish), sctx.priceEdition, sctx.priceYgoEdition)); }
  },
  finish: v => { const sctx = tsheet, c = contextTcgCard(sctx.game, sctx.id, sctx); if (c) selectPreviewFinish(sctx.game, c, sctx, v); },
  rarity: v => { const sctx = tsheet; if (sctx.game === 'ygo' && v) ygoPrinting(sctx, v); },
  // A picker's change: {name: its data-change, value}.
  select: v => {
    const sctx = tsheet, {name, value} = JSON.parse(v);
    if (['historyEdition', 'ygoPreviewPrinting'].includes(name)) { if (name === 'historyEdition' || sctx.game === 'ygo') ygoPrinting(sctx, value); }
    else if (['historyYgoEdition', 'ygoPreviewEdition'].includes(name)) { if (name === 'historyYgoEdition' || sctx.game === 'ygo') ygoEdition(sctx, value); }
  },
  jump: v => {
    const sctx = tsheet, G = sctx.game, c = contextTcgCard(G, sctx.id, sctx);
    if (v && c) { sctx.priceFinish = selectedFinish(G, c, v); if (sctx.setId && G === 'ptcg') sctx.setVariant = sctx.priceFinish; }
    tcardAct.tab('prices');
  },
  range: v => { if (HISTORY_RANGES.some(([r]) => r === v)) tsheet.priceRange = v; },
  historySource: v => { const {key, source} = JSON.parse(v); (S.ui.historySource ||= {})[key] = source; },
};
// What the open tab looks up as it opens: the Play guide's pairings (tcg.js guideLoad), the shown quote's price history.
async function tcardTabLoads(sctx) {
  const G = sctx.game, c = contextTcgCard(G, sctx.id, sctx); if (!c) return;
  if (sctx.tab === 'guide') await tcgCtx.guideLoad?.(G, c);
  if (sctx.tab === 'prices') await loadSharedHistory(quoteForContext(G, c, sctx)).catch(() => {});
}
// The sheet as tcgCardSheet draws it now (it settles the Yu-Gi-Oh! printing and edition into the context as the site's redraw does).
function tcardModel() {
  const sctx = tsheet; if (!sctx) return {missing: true};
  const G = sctx.game, c = tcgCardOf(G, sctx.id);
  if (!c) return {game: G, id: sctx.id, name: '', loading: !sctx.error, notice: sctx.error || ''};
  const m = sheetModel(tree(tcgCardSheet(c, sctx)));
  if (m.overview?.card?.tcgFinish) m.overview.card.tcgFinish.frame = String(c.frame || c.cardType || c.typeLine || '');
  return {game: G, id: String(c.id), name: c.name, deck: sctx.deckId || '', entry: sctx.entryId || '', setId: sctx.setId || '', ...m, notice: sctx.error || '',
    busy: !!(sctx.previewBusy || c.brief || S.ui.guide?.[G + ':' + c.id]?.loading), glyphs: sheetGlyphs()};
}
const tcardHtml = () => { const sctx = tsheet, c = sctx && tcgCardOf(sctx.game, sctx.id); return c ? tcgCardSheet(c, sctx) : ''; };
function packModel() {
  const P = pack; if (!P) return {};
  const {game, set} = P, picks = P.picks || [], lines = picks.map(c => `1 ${c.name}`), n = lines.reduce((a, l) => a + (parseInt(l, 10) || 1), 0);
  return {game, code: game === 'mtg' ? String(set?.code || P.release || '') : String(P.release ?? ''), name: set?.name || '', busy: !!P.busy, error: P.error || '', stamp: P.stamp,
    note: P.booster ? 'Free preview drawn from this set’s real booster sheets and pull rates (MTGJSON). Nothing is added to your collection.' : 'Free preview with approximate pull rates, not a real booster. Nothing is added to your collection.',
    done: picks.godPack ? godPackText(game) : picks.collector ? collectorText(picks) : '',
    picks: picks.map((_, i) => packPickModel(P, i)),
    ...(game === 'mtg' ? {} : packTcgLook(P)),
    // buy.js buyOnTcgplayer(game, lines, {what: 'preview cards; check exact printings'}): the list is copied, then TCGplayer's Mass Entry.
    shop: {lines, title: 'Shopping list copied', text: `${n} preview cards; check exact printings (${lines.length} line${lines.length === 1 ? '' : 's'}) are on your clipboard. On TCGplayer, paste them into Mass Entry and tap Add to cart.`,
      failTitle: 'Couldn\'t copy', failText: 'Your browser blocked the clipboard. On TCGplayer, open Mass Entry and type the list, or copy it from the deck page.', ok: 'Open TCGplayer', cancel: 'Done', url: massEntryUrl(game)}};
}

/* ---------- Account writes ---------- */
// app.js commit (423-476): the change runs on a copy of the workspace, is validated (normalize), observed (trackValue,
// recordHomeDeckWork), stamped, then becomes the workspace. What the site does after that is the app's: the device write and
// the account sync (cloud.js pushNow and its merge, WorkspaceSync.kt over saved()), the toast, haptics and redraw. One write at
// a time, as queueWorkspaceWrite: QuickJS has one thread and every write here is a chain link.
let lastUndo = null, writes = Promise.resolve(), commits = 0, toasts = [], asked = '', made = '', valueHistoryReady = false;
// The workspace as the account keeps it: a Yu-Gi-Oh! or Pokémon page borrows settings.game while it is open (tcgFocus), and the
// player's own choice is what is saved.
function saveable(s = S.state) {
  const out = stripCache(s);
  if (tcgPrev === undefined) return out;
  const settings = {...out.settings}; if (tcgPrev === null) delete settings.game; else settings.game = tcgPrev;
  return {...out, settings};
}
function commit(fn, {msg = '', undo = '', guard = null, navigationWrite = false, recordDeckWork = true, observeValue = true, valueGames = null} = {}) {
  const transaction = async () => {
    // Confirm against the latest committed state, without allowing another queued edit to pass.
    if (guard && !await guard(S.state)) return;
    const before = undo ? structuredClone(saveable(S.state)) : null;
    const previous = S.state;
    const next = structuredClone(stripCache(S.state));
    const out = fn(next);
    const valid = normalize(next);
    if (valueHistoryReady && !navigationWrite && observeValue) trackValue(valid, previous, valueGames);
    if (recordDeckWork && !navigationWrite) recordHomeDeckWork(previous, valid);
    valid.lastSavedAt = new Date().toISOString();
    S.state = valid;
    commits++;
    const changedLots = changedConditionLots(previous, valid);
    if (changedLots.length) setTimeout(() => refreshChangedConditions(changedLots), 0);
    useMyPrices(S.state.myPrices); // app.js render(): the account's own prices count in every value
    if (undo) { lastUndo = {state: before, label: undo}; toasts.push({text: msg || undo, undo: true}); } else if (msg) toasts.push({text: msg, undo: false});
    return out;
  };
  const result = writes.then(transaction, transaction);
  writes = result.catch(() => {});
  return result;
}
commit.scoped = () => commit;
// app.js trackValue (7711-7725), verbatim but for tcg.js's own exports in place of T.*. A game is observed only when every saved
// card's data is here (the site keeps its whole catalog on the device; the app fills it as pages are visited, and Yu-Gi-Oh! and
// Pokémon Home are not in the app yet): a partial total would write a false dip into the account's value history.
function trackValue(state = S.state, previous = null, valueGames = null) {
  if (!valueHistoryReady) return;
  useMyPrices(state.myPrices);
  try {
    const changed = (a,b) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
    const known = g => (state.tcg?.[g]?.collection || []).every(e => tcgCardOf(g, e.cardId));
    for (const g of ["ptcg", "ygo"]) if ((valueGames?.includes(g) || previous && changed(previous.tcg?.[g]?.collection, state.tcg?.[g]?.collection)) && known(g)) trackTcgValue(g, tcgCollectionValue(g, state), state);
    if (!valueGames?.includes("mtg") && (valueGames || previous && !changed(previous.collection,state.collection) && !changed(previous.myPrices,state.myPrices))) return;
    if (!state.collection.every(e => (e.printingVerified && state.printings?.[e.printingId]) || meta(e.name))) return;
    const v = collectionValue(state.collection, S.catalog, state.printings, []);
    if (!state.collection.length && !state.valueHistory?.length) return;
    state.valueHistory = recordValuePoint(state.valueHistory, v.total, v.copies, homeValueCoverage(v));
  } finally { useMyPrices(S.state.myPrices); }
}
// dialog.js ask: the app shows the question and taps again with confirmed when the player says yes.
const ask = (question, confirmed) => { if (confirmed) return true; asked = question; return false; };
const ownedQuantityBusy = new Set();
// ---------------------------------------------------------------- A deck's ⋯ menu (app.js A.deckMenu 6108), as the site draws it
// app.js formatSelect (5864), verbatim.
function formatSelect(id, current) {
  const groups = [...new Set(FORMATS.map((f) => f.group))];
  return `<select id="${id}" data-format-select>${groups.map((g) => `<optgroup label="${g}">${FORMATS.filter((f) => f.group === g).map((f) => `<option value="${esc(f.name)}" ${formatOf(current).name === f.name ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</optgroup>`).join("")}</select>`;
}
// ---------------------------------------------------------------- New deck (app.js A.newDeck 5885) and Import a deck (deckImportSheet 5943)
// app.js formatInfo (5868), verbatim.
const formatInfo = (name) => {
  const f = formatOf(name);
  return `${esc(sizeLabel(f))}${f.commander ? " · led by " + (f.commander === "planeswalker" ? "a planeswalker" : f.commander === "creature" ? "a creature" : "a legendary creature") : ""} · ${f.life} life${f.legality ? " · banned list checked" : ""}${f.note ? " · " + esc(f.note) : ""}`;
};
// A formatSelect read back: its optgroups ({group, options [[value, label]]}) and the one chosen.
function formatsOf(sel) {
  const opts = all(sel, tagIs('option'));
  return {groups: all(sel, tagIs('optgroup')).map(g => ({group: g.attrs.label || '', options: all(g, tagIs('option')).map(o => [o.attrs.value ?? text(o), text(o)])})),
    selected: (opts.find(o => o.attrs.selected !== undefined) || opts[0])?.attrs.value ?? ''};
}
// What app.js's change listener on [data-format-select] (5871) does for each format: the commander row shown when the format has
// a commander, its label "Oathbreaker" for a planeswalker one, and New deck's line under the format (#ndFormatInfo).
const formatRows = () => Object.fromEntries(FORMATS.map(f => [f.name, {commander: !!f.commander, label: f.commander === "planeswalker" ? "Oathbreaker" : "Commander", info: text(tree(`<p>${formatInfo(f.name)}</p>`))}]));
// A label's words without its field's.
const labelWords = (l) => text({kids: (l?.kids || []).filter(k => k.text !== undefined)});
// app.js A.newDeck's sheet, verbatim.
function newDeckHtml(commander = "") {
  return `<div class="sheet-head"><h2>New deck</h2><button class="icon" data-act="closeSheet">✕</button></div>
    <div class="grid2">
      <label class="span2">Format${formatSelect("ndFormat", "Commander")}</label>
      <p class="span2 muted small" id="ndFormatInfo">${formatInfo("Commander")}</p>
      <label class="span2" id="ndCommanderRow">Commander<input id="ndCommander" value="${esc(commander)}" placeholder="e.g. Giada, Font of Hope" autocomplete="off"></label>
      <label class="span2">Deck name<input id="ndName" maxlength="100" placeholder="Optional"></label>
      <label>Budget $<input id="ndBudget" type="number" min="0" value="${S.state.settings.budget || 25}"></label>
    </div>
    <p id="ndError" class="error" role="alert"></p>
    <button class="btn block" data-act="newDeckSave">Create deck</button>
    <p class="muted small">Commander formats: single commander only (partners and backgrounds aren’t supported yet).</p>`;
}
function newDeckModel(commander) {
  const t = tree(newDeckHtml(commander)), byId = id => one(t, n => n.attrs?.id === id), labels = all(one(t, cls('grid2')), tagIs('label'));
  const fmt = formatsOf(byId('ndFormat')), field = (l) => { const i = one(l, tagIs('input')); return {label: labelWords(l), value: i?.attrs.value || '', placeholder: i?.attrs.placeholder || '', max: Number(i?.attrs.maxlength || 0)}; };
  return {title: text(one(t, tagIs('h2'))), formatLabel: labelWords(labels[0]), formats: fmt.groups, format: fmt.selected, info: text(byId('ndFormatInfo')),
    commander: field(labels[1]), name: field(labels[2]), budget: field(labels[3]), save: text(one(t, cls('btn'))), busy: "Checking…",
    foot: text(all(t, x => x.tag === 'p' && cls('muted')(x)).at(-1)), rows: formatRows()};
}
// app.js deckImportSheet's sheet, verbatim but for currentDeck(): the deck it was opened for ([deck]).
function deckImportHtml(preset = {}, deck = null) {
  const options = htmlOptions;
  return `<div class="sheet-head"><h2>${preset.destination === "library" ? "Save a deck idea" : "Import a deck"}</h2><button class="icon" data-act="closeSheet">✕</button></div>
    <p class="muted small">Paste a list (Moxfield, Archidekt, ManaBox: Export → Text) or upload .txt / .csv / MTGJSON .json. Importing never changes your collection.</p>
    <textarea id="dImpText" rows="7" data-input="dImpText" placeholder="Commander&#10;1 Giada, Font of Hope&#10;&#10;Deck&#10;1 Sol Ring&#10;30 Plains">${esc(preset.text || "")}</textarea>
    <label class="btn ghost file">Upload a file<input type="file" accept=".txt,.csv,.json,.dek" data-change="dImpFile" hidden></label>
    <div class="grid2">
      <label>Deck name<input id="dImpName" maxlength="100" value="${esc(preset.name || "Imported deck")}"></label>
      <label>Format${formatSelect("dImpFormat", preset.format || "Commander")}</label>
      <label id="dImpCommanderRow">Commander<input id="dImpCommander" value="${esc(preset.commander || "")}" placeholder="Read from the list"></label>
      <label>Save as<select id="dImpDest">${options([["new", "New deck"], ...(deck ? [["replace", "Replace " + deck.name.slice(0, 24)]] : []), ["library", "Idea (inspiration)"]], preset.destination || "new")}</select></label>
    </div>
    <details class="more" ${preset.url ? "open" : ""}><summary>Credit the creator (optional)</summary><div class="grid2"><label class="span2">Original link<input id="dImpURL" type="url" value="${esc(preset.url || "")}" placeholder="https://moxfield.com/decks/…"></label><label>Author<input id="dImpAuthor" maxlength="100" value="${esc(preset.author || "")}"></label><label>Kind<select id="dImpKind">${options(["User export", "Community deck", "Purchased precon", "MTGJSON precon"].map((x) => [x, x]), preset.kind || "User export")}</select></label><label class="span2">Notes<textarea id="dImpDesc" rows="2" maxlength="3000">${esc(preset.description || "")}</textarea></label></div></details>
    <p id="dImpStatus" class="muted small" role="status"></p>
    <div class="actions"><button class="btn ghost" data-act="dImpPreview" id="dImpPreviewBtn">Preview & match</button><button class="btn" data-act="dImpSave" id="dImpSave" disabled>Save deck</button></div>
    <div id="dImpResults"></div>`;
}
// The import in progress (app.js dImp, dImpBusy) and the deck the sheet replaces (its currentDeck() when it opened).
let dImp = null, dImpBusy = false, dImpDeck = null;
function deckImportModel(preset = {}, deckId = null) {
  if (deckId != null) S.ui.deckId = deckId;
  dImp = null; dImpDeck = currentDeck()?.id ?? null;
  const t = tree(deckImportHtml(preset, deckOf(dImpDeck))), byId = id => one(t, n => n.attrs?.id === id), grids = all(t, cls('grid2'));
  const labels = all(grids[0], tagIs('label')), credit = all(grids[1], tagIs('label')), area = byId('dImpText'), fmt = formatsOf(byId('dImpFormat'));
  const input = (l) => { const i = one(l, x => x.tag === 'input' || x.tag === 'textarea'); return {label: labelWords(l), value: i?.tag === 'textarea' ? text({kids: i.kids}) : i?.attrs.value || '', placeholder: i?.attrs.placeholder || '', max: Number(i?.attrs.maxlength || 0)}; };
  const select = (l) => { const sel = one(l, tagIs('select')); return {label: labelWords(l), options: all(sel, tagIs('option')).map(o => [o.attrs.value ?? text(o), text(o)]), selected: formatsOf(sel).selected}; };
  const acts = all(one(t, cls('actions')), tagIs('button'));
  return {title: text(one(t, tagIs('h2'))), intro: text(one(t, x => x.tag === 'p' && cls('muted')(x))), text: (area.kids || []).map(k => k.text ?? '').join(''),
    placeholder: area.attrs.placeholder || '', rows: Number(area.attrs.rows || 7), upload: labelWords(one(t, cls('file'))), accept: one(one(t, cls('file')), tagIs('input'))?.attrs.accept || '',
    name: input(labels[0]), formatLabel: labelWords(labels[1]), formats: fmt.groups, format: fmt.selected, commander: input(labels[2]),
    dest: {label: labelWords(labels[3]), options: all(byId('dImpDest'), tagIs('option')).map(o => [o.attrs.value ?? '', text(o)]), selected: formatsOf(byId('dImpDest')).selected},
    credit: {summary: text(one(t, tagIs('summary'))), open: one(t, cls('more'))?.attrs.open !== undefined, url: input(credit[0]), author: input(credit[1]), kind: select(credit[2]), notes: {...input(credit[3]), rows: Number(byId('dImpDesc')?.attrs.rows || 2)}},
    preview: text(acts[0]), previewBusy: "Loading…", save: text(acts[1]), saving: "Saving…", rowsOf: formatRows()};
}
// app.js dImpCandidate (5974), verbatim but for the fields: [f] is the form as typed ({name, format, commander, dest, url, author, desc, kind}).
function dImpCandidate(f) {
  const format = f.format;
  return {
    id: f.dest === "replace" ? deckOf(dImpDeck)?.id : "preview",
    name: String(f.name || '').trim() || "Imported deck",
    format,
    commander: hasCommander(format) ? String(f.commander || '').trim() : "",
    strategy: "Auto",
    budget: S.state.settings.budget || 25,
    locked: false,
    source: sourceCredit({ url: f.url || '', author: f.author || '', description: f.desc || '', kind: f.kind || 'User export' }),
    cards: deckRowsFromImport(dImp.cards.map((c) => ({ name: meta(c.name)?.name || c.name, qty: c.qty }))),
    // Commander has no sideboard; every other format keeps the imported one.
    side: hasCommander(format) ? [] : (dImp.side || []).map((c) => ({ name: meta(c.name)?.name || c.name, qty: c.qty })),
  };
}
// app.js drawDeckImport (5995): #dImpResults as the site writes it, read back ({kpis [[value, label]], notes [{text, warn}], rows
// [{text, need, missing}]}), or the candidate's error for #dImpStatus.
function drawDeckImport(f) {
  if (!dImp) return {results: null};
  let d;
  try { d = dImpCandidate(f); } catch (e) { return {status: e.message, results: null}; }
  const rows = rowsFor(d),
    t = rows.reduce((a, r) => ({ copies: a.copies + r.qty, covered: a.covered + r.covered, missing: a.missing + r.missing, gap: a.gap + (r.price ?? 0) * r.missing }), { copies: 0, covered: 0, missing: 0, gap: 0 }),
    unresolved = rows.filter((r) => !meta(r.name));
  const html = `<div class="kpis small"><div class="kpi"><b>${t.copies}</b><span>cards</span></div><div class="kpi"><b>${t.covered}</b><span>you own</span></div><div class="kpi"><b>${usd(t.gap, 0)}</b><span>to finish</span></div></div>
  ${dImp.side?.length ? `<p class="muted small">${hasCommander(d.format) ? `${sumQty(dImp.side)} sideboard cards left out (Commander has no sideboard).` : `+ ${sumQty(dImp.side)}-card sideboard, saved with the deck.`}</p>` : ""}
  ${dImp.excluded ? `<p class="muted small">${dImp.excluded} maybeboard cards left out.</p>` : ""}
  ${dImp.errors.length ? `<div class="note warn">${dImp.errors.length} lines skipped: ${dImp.errors.slice(0, 3).map((e) => esc("line " + e.line)).join(", ")}</div>` : ""}
  ${unresolved.length ? `<div class="note warn">Not recognized: ${unresolved.slice(0, 8).map((r) => esc(r.name)).join(", ")}${unresolved.length > 8 ? "…" : ""}. You can save anyway and fix them later.</div>` : ""}
  <div class="list compact">${rows
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => `<div class="mini-row"><span class="ellip">${r.qty > 1 ? r.qty + "× " : ""}${esc(r.name)}</span><span class="small ${r.missing ? "warn-text" : "ok-text"}">${r.missing ? "need " + r.missing : "owned"}</span></div>`)
    .join("")}</div>`;
  const tr = tree(html);
  return {results: {kpis: all(tr, cls('kpi')).map(k => [text(one(k, tagIs('b'))), text(one(k, tagIs('span')))]),
    notes: all(tr, x => (x.tag === 'p' && cls('muted')(x)) || cls('note')(x)).map(n => ({text: text(n), warn: cls('warn')(n)})),
    rows: all(tr, cls('mini-row')).map(r => { const sp = all(r, tagIs('span')); return {text: text(sp[0]), need: text(sp[1]), missing: cls('warn-text')(sp[1] || {attrs: {}})}; })}};
}
// A.deckMenu's sheet, verbatim but for options (ui.js options, imported as htmlOptions here).
function deckMenuHtml(d) {
  const options = htmlOptions;
  const count=(d.cards||[]).reduce((n,r)=>n+(Number(r.qty)||0),0),images=(d.cards||[]).map(r=>cardImage(meta(r.name))).filter(Boolean);
  return `<div class="context-menu context-deck">${contextHeader({kind:'Magic deck',name:d.name,meta:[formatOf(d.format).name,`${count} cards`].join(' · '),art:deckBoxMarkup(d,{images})})}
    ${deckContextShortcuts(d.id)}
    <details class="context-edit"><summary>${ICON.settings}<span>Edit deck<small>Name, format, budget & appearance</small></span>${ICON.chevron}</summary><div class="context-edit-body">
    <div class="grid2"><label class="span2">Name<input id="dmName" maxlength="100" value="${esc(d.name)}"></label><label class="span2">Format${formatSelect("dmFormat", d.format)}</label><label>Budget $<input id="dmBudget" type="number" min="0" value="${d.budget ?? 25}"></label><label>Focus<select id="dmStrategy">${options(["Auto", "Tokens", "Dragons", "Graveyard", "Spells", "Artifacts", "Lifegain", "Landfall", "Creature"].map((x) => [x, x]), d.strategy || "Auto")}</select></label></div>
    ${deckBoxFields(d,(d.cards||[]).map(r=>({name:r.name,image:cardImage(meta(r.name))})))}
    <button class="btn block context-save" data-act="deckSaveInfo">Save changes</button></div></details>
    <div class="context-group" aria-label="Share and export">
      ${contextAction('deckShare','share','Share deck',{hint:'Send a link'})}
      ${contextAction('deckCopy','copy','Copy decklist')}
      ${contextAction('deckExport','export','Export decklist',{hint:'Text file (.txt)'})}
      ${contextAction('deckToPlay','play','Copy to Play',{hint:'Missing cards stay greyed there'})}
    </div>
    <div class="context-group" aria-label="Manage deck">
      ${contextAction('snapshot','history','Save a version')}
      ${contextAction('deckDup','decks','Duplicate deck')}
      ${contextAction('refreshDeck','refresh','Refresh cards & prices')}
    </div>
    <details class="context-edit context-tools"><summary>${actionIcon('more')}<span>More deck tools<small>Reserve copies, import & playtest printing</small></span>${ICON.chevron}</summary><div class="context-edit-body">
      <label class="check toggle"><input type="checkbox" data-change="deckLock" ${d.locked ? "checked" : ""}><span><b>Assembled</b><small>Reserve these copies for this deck.</small></span></label>
      ${contextAction('proxies','print','Print playtest proxies',{attrs:'data-scope="all"'})}
      ${contextAction('deckBought','cardStack','Add deck to collection',{hint:'Add the cards you bought'})}
      ${contextAction('importDeck','import','Re-import / replace list')}
    </div></details>
    <div class="context-group context-danger">${contextAction('deckDelete','close','Delete deck',{danger:true})}</div>
    ${d.source ? `<p class="context-source muted small">Source: ${esc(d.source.kind || "")} · ${esc(d.source.website || "")}${d.source.author ? " · by " + esc(d.source.author) : ""}${d.source.url ? ` · <a href="${esc(safeHref(d.source.url))}" target="_blank" rel="noopener noreferrer">original</a>` : ""}</p>` : ""}</div>`;
}
// The menu read off that markup: the head (the deck box, kind, name, meta), the shortcuts, Edit deck's form, the groups of actions,
// More deck tools (Assembled and its actions), Delete, and the source line.
function deckMenuModel(id) {
  const d = deckOf(id);
  if (!d) return {missing: true};
  return menuModelOf(tree(deckMenuHtml(d)), d, {name: 'dmName', format: 'dmFormat'});
}
// tcg.js A.tDeckMenu (a Yu-Gi-Oh! or Pokémon deck's ⋯ menu), the site's own: the sheet it opens is caught and read as the Magic one is.
// It has no budget, focus or More deck tools; its format is one plain list.
function tcgDeckMenuModel(G, id) {
  tcgFocus(G, 'tdeck'); S.ui.tdeckId = id;
  const d = tcgGs(G).decks.find(x => String(x.id) === String(id));
  if (!d) return {missing: true};
  let html = ''; const was = tcgSheetHook; tcgSheetHook = h => { html = String(h || ''); };
  try { TA.tDeckMenu({dataset: {id: d.id}}); } finally { tcgSheetHook = was; }
  return {...menuModelOf(tree(html), d, {name: 'tDmName', format: 'tDmFormat'}), game: G};
}
function menuModelOf(t, d, ids) {
  const head = one(t, cls('context-head')), box = one(head, cls('deck-box'));
  const action = b => ({act: b.attrs['data-act'] || '', label: text({kids: (one(b, tagIs('span'))?.kids || []).filter(k => k.tag !== 'small')}), hint: text(one(b, tagIs('small'))),
    icon: icon(svgIn(b)), danger: cls('danger')(b), tab: b.attrs['data-tab'] || '', scope: b.attrs['data-scope'] || ''});
  const summary = det => { const sm = one(det, tagIs('summary')), svgs = all(sm, tagIs('svg')); return {title: text({kids: (one(sm, tagIs('span'))?.kids || []).filter(k => k.tag !== 'small')}), hint: text(one(sm, tagIs('small'))), icon: icon(svgs[0]), chev: icon(svgs[svgs.length - 1])}; };
  const [edit, tools] = all(t, x => x.tag === 'details' && cls('context-edit')(x));
  const field = idv => one(edit, x => x.attrs.id === idv);
  const labelOf = n => text({kids: (n?.kids || []).filter(k => k.text !== undefined)});
  const fmt = field(ids.format), boxS = one(edit, cls('deck-box-settings')), lock = tools ? one(tools, cls('toggle')) : null;
  const groupsOf = all(fmt, tagIs('optgroup')), plain = groupsOf.length ? [] : [{group: '', options: all(fmt, tagIs('option')).map(o => [o.attrs.value ?? text(o), text(o)])}];
  const source = one(t, cls('context-source'));
  return {id: String(d.id), name: d.name,
    head: {kind: text(one(head, cls('context-kicker'))), name: text(one(head, tagIs('h2'))), meta: text(one(one(head, cls('context-identity')), tagIs('p'))), close: icon(svgIn(one(head, cls('context-close')))),
      box: box && {color: ((/--deck-box-color:\s*([^;]+)/.exec(box.attrs.style || '') || [])[1] || '').trim(), cards: all(one(box, cls('deck-box-cards')), tagIs('img')).map(i => i.attrs.src || '')}},
    shortcuts: all(one(t, cls('context-shortcuts')), tagIs('button')).map(action),
    edit: {...summary(edit), labels: all(one(edit, cls('grid2')), tagIs('label')).map(labelOf),
      name: field(ids.name)?.attrs.value || '', max: Number(field(ids.name)?.attrs.maxlength || 100),
      formats: [...groupsOf.map(g => ({group: g.attrs.label || '', options: all(g, tagIs('option')).map(o => [o.attrs.value ?? text(o), text(o)])})), ...plain],
      format: (all(fmt, tagIs('option')).find(o => o.attrs.selected !== undefined)?.attrs.value) || '',
      budget: field('dmBudget')?.attrs.value || '', strategy: field('dmStrategy') ? selectOf(field('dmStrategy')) : null,
      box: {summary: text(one(boxS, tagIs('summary'))), labels: all(boxS, tagIs('label')).map(labelOf), color: field('deckBoxColor')?.attrs.value || '', image: selectOf(field('deckBoxImage')), foot: text(one(boxS, cls('foot')))},
      save: text(one(edit, cls('context-save')))},
    groups: all(t, x => cls('context-group')(x) && !cls('context-danger')(x)).map(g => ({aria: g.attrs['aria-label'] || '', actions: all(g, tagIs('button')).map(action)})),
    tools: tools ? {...summary(tools), lock: {on: one(lock, tagIs('input'))?.attrs.checked !== undefined, title: text(one(lock, tagIs('b'))), hint: text(one(lock, tagIs('small')))},
      actions: all(tools, x => x.tag === 'button' && cls('context-action')(x)).map(action)} : null,
    danger: all(one(t, cls('context-danger')), tagIs('button')).map(action),
    source: source ? {text: text({kids: (source.kids || []).filter(k => k.tag !== 'a')}).replace(/\s*·\s*$/, ''), link: one(source, tagIs('a'))?.attrs.href || '', linkText: text(one(source, tagIs('a')))} : null,
    // app.js A.snapshot's suggested name.
    version: 'Version ' + ((d.versions || []).length + 1)};
}
// A site handler run as the site runs it, with what the browser would give it standing in:
// - dialog.js ask / askText: the dialog it opens is read (title, words, buttons) and the run stops there. The app asks the player,
//   and Yes taps again (confirmed); each question answered Yes in this tap's chain is then answered Yes again as it opens.
// - buy.js copyPlain (the clipboard), tcg.js copyText, window.open (Mass Entry): kept for the app, which copies and opens them.
// - document.querySelector for a form's fields ([vals]).
const SITE_ASKED = {siteAsked: true};
let siteAsk = null, siteYes = [], siteCopied = null, siteOpened = '', siteDownload = null, siteText = {}, actStep = '', siteRecovery = null;
function siteDialogs() {
  const el = () => { const ls = {}; return {value: '', ls, addEventListener(t, f) { (ls[t] ||= []).push(f); }, focus() {}, select() {}, setAttribute() {}, classList: {add() {}}, close() {}, remove() {}}; };
  return {body: {append() {}}, createElement() {
    let html = ''; const parts = {}, d = el();
    Object.defineProperty(d, 'innerHTML', {set(h) { html = String(h); }, get() { return html; }});
    d.querySelector = sel => (parts[sel] ||= el());
    d.showModal = () => {
      const t = tree(html), btns = all(t, tagIs('button')), field = one(t, tagIs('input'));
      const q = {question: text(one(t, cls('cf-dialog-msg'))), title: text(one(t, cls('cf-dialog-title'))), cancel: text(btns[0]), ok: text(btns[1]), danger: cls('danger')(btns[1] || {attrs: {}})};
      if (!siteYes.includes(q.question)) { siteAsk = q; throw SITE_ASKED; }
      if (field) parts.input.value = field.attrs.value || '';
      for (const f of parts.form?.ls.submit || []) f({preventDefault() {}});
    };
    return d; }};
}
async function siteRun(fn, d = {}, vals = {}) {
  if (!d.confirmed) siteYes = []; else if (siteAsk) siteYes.push(siteAsk.question);
  siteAsk = null; siteCopied = null; siteOpened = ''; siteDownload = null; siteText = {};
  const was = {document: globalThis.document, navigator: globalThis.navigator, window: globalThis.window, copy: tcgHooks.copyText, download: tcgHooks.download};
  const put = (k, v) => Object.defineProperty(globalThis, k, {value: v, writable: true, configurable: true});
  // A field the handler reads ([vals]), or one it writes words into (a status line: [vals] gives it as null-free ''), kept in siteText.
  put('document', {...siteDialogs(), querySelector: q => vals[q] == null ? null : {value: String(vals[q]), set textContent(t) { siteText[q] = String(t ?? ''); actStep = siteText[q]; }, get textContent() { return siteText[q] ?? ''; }}});
  put('navigator', {...(was.navigator || {}), clipboard: {writeText: async t => { siteCopied = String(t); }}});
  put('window', Object.assign(Object.create(was.window || null), {open: u => { siteOpened = String(u || ''); }}));
  tcgHooks.copyText = async (t, msg) => { siteCopied = String(t); if (msg) toasts.push({text: String(msg), undo: false}); return true; };
  tcgHooks.download = (name, text, type) => { siteDownload = {name: String(name), text: String(text), type: String(type || 'text/plain')}; };
  // The stand-ins stay while the handler runs: its questions can come after an await (buy.js asks once the list is copied).
  try { await fn(); } catch (e) { if (e !== SITE_ASKED) throw e; }
  finally {
    for (const k of ['document', 'navigator', 'window']) { if (was[k] === undefined) delete globalThis[k]; else put(k, was[k]); }
    tcgHooks.copyText = was.copy; tcgHooks.download = was.download;
  }
  if (siteAsk) asked = siteAsk.question;
}
// store.js deckById, and app.js scopedEditDeck for the deck with that id: it throws when the deck went away before the write ran.
const deckOf = (id) => (id == null ? null : S.state.decks.find((x) => String(x.id) === String(id)) || null);
const editDeckOf = (id) => (fn, opts = {}) => commit((s) => { const i = s.decks.findIndex((x) => x.id === id); if (i < 0) throw Error('This deck is no longer available.'); s.decks[i] = fn(s.decks[i]) || s.decks[i]; }, opts);
// The site's handlers for the Collection taps that save to the account: app.js's closures line for line (their DOM halves, the
// button's busy state and the pill's pulse, are the app's), tcg.js's through registerTcg. [d] is the tapped button's dataset.
// power.js memo's keep between visits (see export-collection-engine.mjs): a deck's Power by a hash of the site's signature for it,
// the newest POWER_KEEP kept. Values go through JSON as the site's cache would hand them on (plain data).
const POWER_KEEP = 400;
const powerKeep = globalThis.__powerKeep = {map: new Map(), dirty: false,
  hash(s) { let a = 0x811c9dc5, b = 0x01000193 ^ s.length; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 15); } return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36) + '.' + s.length.toString(36); },
  get(h) { const v = this.map.get(h); if (v === undefined) return undefined; this.map.delete(h); this.map.set(h, v); return JSON.parse(JSON.stringify(v)); },
  // Only a value JSON carries whole (no Infinity / NaN, no gaps in arrays): anything else is worked out again next time.
  put(h, v) { try { let whole = true; const t = JSON.stringify(v, (k, x) => { if ((typeof x === 'number' && !Number.isFinite(x)) || (Array.isArray(x) && x.includes(undefined))) whole = false; return x; });
    if (whole && t !== undefined) { this.map.set(h, JSON.parse(t)); this.dirty = true; } } catch {} }};
const writeActs = {
  // app.js A.compareSwap (5353): the second compared card in for the first in the open deck, with a snapshot to compare in Versions.
  async compareSwap() {
    const [a, b] = S.ui.compare || [], d = currentDeck();
    if (!a || !b || !d) return;
    if (key(a.name) === key(d.commander)) { toasts.push({text: "Change commanders by starting a new deck.", undo: false}); return; }
    await commit((s) => {
      const i = s.decks.findIndex((x) => x.id === d.id);
      let deck = withSnapshot(s.decks[i], "Before swapping " + a.name);
      deck = mergeDeckCard(mergeDeckCard(deck, a.name, -1), b.name, 1);
      s.decks[i] = deck;
    }, {msg: `Swapped ${a.name} → ${b.name}. Compare in Versions.`});
  },
  // The Scanner (its WebView engine, ScanWeb.kt) saving a batch: app.js scanCtx.addMany / add, here where the workspace is. [items]
  // as scancam.js passes them ({cand, qty, finish, condition, lang, location, captureId}); [single]: app.js mtgScanAdd / c.scanAdd.
  async scanAddMany(d) {
    scanReady();
    const g = d.game || 'mtg', items = d.items || [];
    if (items.length === 1 && items[0].single) return g === 'mtg' ? mtgScanAdd(items[0].cand) : tcgCtx.scanAdd(items[0].cand);
    return g === 'mtg' ? mtgScanAddMany(items) : tcgCtx.scanAddMany(items, g);
  },
  // The scanner's "Add to" chips: app.js scanCtx.rememberLocation.
  async scanRemember(d) { scanReady(); await scanCtx.rememberLocation(d.game || 'mtg', d.name || '', {createBinder: !!d.createBinder}); },
  // A review's condition price: app.js scanCtx.requestConditionPrice's fetchConditionValue; [made] its result and the quotes it keeps.
  async scanCondition(d) {
    const r = await new Promise(ok => { const p = fetchConditionValue(d.card, d.entry, d.game, x => ok(x), {source: 'review', current: () => true, retry: !!d.retry}); Promise.resolve(p).then(v => ok(v)); });
    made = JSON.stringify({...(r || {}), quotes: d.card?.conditionQuotes || null});
  },
  // app.js A.cardWishlist (4770): one toggle for the card page and the hold menu, by the game's identity rule (Magic by name,
  // Pokémon and Yu-Gi-Oh! by card id). Only the wishlist changes. (The site first checks the tap is for the open game: here the
  // page that sent it is the open game's.)
  async cardWishlist(d) {
    const game = d.game, name = d.name, id = d.id;
    const matches = w => game === 'mtg' ? key(w.name) === key(name) : String(w.cardId) === String(id), current = game === 'mtg' ? S.state : tcgGs(game);
    const adding = !current.wishlist.some(matches);
    await commit(state => { const st = game === 'mtg' ? state : state.tcg[game];
      st.wishlist = st.wishlist.filter(w => !matches(w));
      if (adding) st.wishlist.push({id: uid(), name, ...(game === 'mtg' ? {finish: 'nonfoil'} : {cardId: id}), qty: 1, addedAt: new Date().toISOString()});
    }, {enrich: false, undo: adding ? 'Added to wishlist.' : 'Removed from wishlist.'});
  },
  // app.js openSetPack's onWishlist (4538), the pack simulator's Wishlist all: every card of the pack open now joins the open game's
  // wishlist unless it is there already (Magic by name, Pokémon and Yu-Gi-Oh! by card id). [d.deal]: the pack it was tapped on.
  async packWishlist(d) {
    const P = pack; if (!P?.picks?.length || (d.deal != null && Number(d.deal) !== P.deal)) throw Error("Your workspace changed. Please reopen the preview.");
    const game = P.game, cards = P.picks, isCurrent = () => pack === P && P.picks === cards;
    const saved = await commit(state => { const st = game === 'mtg' ? state : state.tcg[game]; for (const c of cards) { const exists = st.wishlist.some(w => game === 'mtg' ? key(w.name) === key(c.name) : String(w.cardId) === String(c.id)); if (!exists) st.wishlist.push({id: uid(), name: c.name, ...(game === 'mtg' ? {finish: 'nonfoil'} : {cardId: String(c.id)}), qty: 1, addedAt: new Date().toISOString()}); } return true; }, {enrich: false, guard: () => isCurrent()});
    if (saved !== true) throw Error("Your workspace changed. Reopen this preview.");
  },
  // app.js A.cardOwnedQty (4751): ± one copy of a saved version on a card's page.
  async cardOwnedQty(d) {
    const game = d.game, id = d.lot, delta = Number(d.delta);
    if (![-1, 1].includes(delta) || ownedQuantityBusy.has(id)) return;
    const workspace = game === 'mtg' ? S.state : S.state.tcg[game], lot = workspace?.collection.find(e => e.id === id); if (!lot) return;
    ownedQuantityBusy.add(id);
    try {
      await commit(state => adjustOwnedLot(game === 'mtg' ? state : state.tcg[game], id, delta), {undo: delta < 0 ? `−1 ${lot.name}` : '', guard: state => !!(game === 'mtg' ? state : state.tcg[game])?.collection.find(e => e.id === id)});
    } finally { ownedQuantityBusy.delete(id); }
  },
  // app.js A.qty (5560): the Cards tab's − and + on a Magic lot; taking the last copy asks first.
  async qty(d) {
    const id = d.id, delta = Number(d.delta), e = S.state.collection.find(x => x.id === id);
    if (!e) return;
    await commit(s => {
      const x = s.collection.find(y => y.id === id);
      if (!x) return;
      x.qty = Math.max(0, x.qty + delta);
      x.reserved = Math.min(x.reserved || 0, x.qty);
      s.collection = s.collection.filter(y => y.qty > 0);
    }, {
      undo: delta < 0 ? `−1 ${e.name}` : '',
      guard: async s => {
        const current = s.collection.find(x => x.id === id);
        return !!current && (current.qty + delta > 0 || ask(`Remove ${current.name} from your collection?`, d.confirmed));
      },
    });
  },
  // app.js A.wishRemove (5688): the × on a wanted card.
  async wishRemove(d) { await commit(s => (s.wishlist = s.wishlist.filter(w => w.id !== d.id))); },
  // tcg.js A.tEntryQty and A.tWish, the site's own handlers, for a Yu-Gi-Oh! or Pokémon lot (the game's page holds settings.game).
  async tEntryQty(d) { tcgFocus(d.game, S.ui.view || 'collection'); await TA.tEntryQty({dataset: d}); },
  async tWish(d) { tcgFocus(d.game, S.ui.view || 'collection'); await TA.tWish({dataset: d}); },
  // tcg.js A.tDeckQty, A.tDeckMove, A.tDeckAdd and A.tDeckEmbSwap, the site's own, on a Yu-Gi-Oh! or Pokémon deck's page ([d].deck): a row's
  // − / ＋ and → side / → deck (data-zone, data-id, Yu-Gi-Oh!'s data-row-index and data-purchase-identity), a found card's ＋, a staple's Swap.
  async tDeckQty(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck; await TA.tDeckQty({dataset: d}); },
  async tDeckMove(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck; await TA.tDeckMove({dataset: d}); },
  async tDeckAdd(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck; await TA.tDeckAdd({dataset: d}); },
  async tDeckEmbSwap(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck; await TA.tDeckEmbSwap({dataset: d}); },
  // tcg.js A.tDeckSave, the ⋯ menu's Save changes: its form (#tDmName, #tDmFormat and deck-box.js readDeckBox's two) as the app has it.
  async tDeckSave(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck;
    await siteRun(() => TA.tDeckSave({dataset: {id: d.deck}}), d, {'#tDmName': d.name, '#tDmFormat': d.format, '#deckBoxColor': d.color, '#deckBoxImage': d.image}); },
  // tcg.js A.tDeckDup: the copy is made and its page opened (go: the app follows made).
  async tDeckDup(d) { tcgFocus(d.game, 'tdeck'); tcgWent = '';
    await siteRun(() => TA.tDeckDup({dataset: {id: d.deck}}), d);
    if (tcgWent.startsWith('#tdeck/')) made = decodeURIComponent(tcgWent.slice(7)); },
  // tcg.js A.tDeckDelete: asked first, then the deck goes (Undo on the toast).
  async tDeckDelete(d) { tcgFocus(d.game, 'tdeck'); await siteRun(() => TA.tDeckDelete({dataset: {id: d.deck}}), d); },
  // The price panel: tcg.js A.tDeckRefresh (every card's data and price read again), A.tDeckCheapest (Pokémon: each card to its
  // cheapest legal printing, the old list kept in Versions) and A.tDeckCopyMissing (Buy on TCGplayer: buy.js copies the list and
  // asks before Mass Entry opens; a Yu-Gi-Oh! exact-printing list asks first whether to keep its checklist).
  async tDeckRefresh(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck; await siteRun(() => TA.tDeckRefresh({dataset: {id: d.deck}}), d); },
  async tDeckCheapest(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck; await siteRun(() => TA.tDeckCheapest({dataset: {id: d.deck}}), d); },
  // app.js A.newDeckSave (5902): [d] {format, commander, name, budget} as typed; busy "Checking…" while the commander is looked up
  // and checked. Saved, the deck opens (made: {id, tab}) with the site's toast; an error goes under the form (#ndError, siteText).
  async newDeckSave(d) {
    siteText = {};
    const format = String(d.format || ''), cn = String(d.commander || '').trim();
    try {
      let c = null;
      const fm = formatOf(format);
      if (fm.commander) {
        if (!cn) throw Error(fm.commander === "planeswalker" ? "Enter your Oathbreaker (a planeswalker)." : "Enter a commander.");
        c = await resolve(cn, true);
        await verifyLeader(c,fm,api);
        if (!canLead(c, fm)) throw Error(`${c.name} can’t lead a ${fm.name} deck.`);
      }
      const deck = {
        id: uid(),
        name: String(d.name || '').trim() || (c ? c.name.split(",")[0] + " deck" : "New deck"),
        format,
        commander: c?.name || "",
        strategy: "Auto",
        budget: Math.max(0, Number(d.budget) || 0),
        locked: false,
        cards: c ? [{ name: c.name, qty: 1 }] : [],
        versions: [],
      };
      await commit((s) => {
        s.decks.push(deck);
        s.activeDeck = deck.id;
      });
      made = JSON.stringify({id: deck.id, tab: c && format === "Commander" ? "upgrade" : "cards"});
      toasts.push({text: c && format === "Commander" ? "Deck created. Fill the open slots from your collection here." : `${formatOf(format).name} deck created.`, undo: false});
    } catch (e) { siteText['#ndError'] = String(e?.message || e); }
  },
  // app.js A.dImpPreview (6020): the list read (MTGJSON or text), its names looked up, the form's name, commander and format filled as
  // the site fills them. Saves nothing: made is {form, status, results, ready} for the sheet; progress comes as the act's step.
  async dImpPreview(f) {
    siteText = {};
    if (dImpBusy) return;
    const form = {...f}, raw = String(form.text ?? '');
    let status = '';
    try {
      dImp = /^\s*\{/.test(raw) ? mtgjsonDeck(JSON.parse(raw)) : parseDeckImport(raw);
      if (dImp.multipleCommanders) throw Error("This deck has two commanders; pairs aren’t supported yet.");
      if (dImp.cards.length > 1000) throw Error("That’s more than 1000 different cards — use collection import instead.");
      if (dImp.name && form.name === "Imported deck") form.name = dImp.name;
      if (!form.commander && dImp.commander) form.commander = dImp.commander;
      // A list without a commander that's around 60 cards isn't a Commander deck; let the user pick the exact format.
      if (!dImp.commander && form.format === "Commander" && sumQty(dImp.cards) <= 80) {
        form.format = sumQty(dImp.cards) <= 45 ? "Limited (40-card)" : "60-card casual";
        status = "No commander found — set to " + form.format + ". Pick Standard, Modern or another format above to check legality.";
      }
      dImpBusy = true;
      const r = await resolveNames([...dImp.cards, ...(dImp.side || [])].map((c) => c.name), (m) => { actStep = status = String(m); });
      // A list without a commander section: guess a legendary creature if there's exactly one.
      if (!form.commander && hasCommander(form.format)) {
        const legends = dImp.cards.filter((c) => canLead(meta(c.name), formatOf(form.format)));
        if (legends.length === 1) form.commander = meta(legends[0].name).name;
      }
      status = r.failed.length ? `${r.failed.length} names weren’t found.` : "Matched against your collection.";
    } catch (e) {
      dImp = null;
      status = String(e?.message || e);
    } finally {
      dImpBusy = false;
    }
    const drawn = drawDeckImport(form);
    made = JSON.stringify({form, status: drawn.status ?? status, results: drawn.results, ready: !!dImp});
  },
  // app.js A.dImpSave (6051): [f] the form. Saved, made is where the site goes next ({go: "deck", id, tab} or {go: "inspiration"});
  // Replace asks first; an error goes in #dImpStatus (siteText).
  async dImpSave(f) {
    siteText = {};
    if (!dImp || dImpBusy) return;
    try {
      const d = dImpCandidate(f),
        dest = f.dest;
      if (d.name === "Imported deck" && d.commander) d.name = d.commander.split(",")[0] + " deck";
      if (d.commander) {
        const c = await resolve(d.commander, true);
        await verifyLeader(c,formatOf(d),api);
        if (!canLead(c, formatOf(d))) throw Error(`${c.name} can’t lead a ${formatOf(d).name} deck.`);
        d.commander = c.name;
        if (!d.cards.some((x) => key(x.name) === key(c.name))) d.cards.unshift({ name: c.name, qty: 1 });
      }
      if (dest === "library") {
        d.id = uid();
        await commit((s) => (s.references = [...(s.references || []), d]), { msg: "Saved to Inspiration. No cards added to your collection." });
        made = JSON.stringify({go: "inspiration"});
        return;
      }
      if (dest === "replace") {
        const old = deckOf(dImpDeck);
        if (!old) throw Error('This deck is no longer available.');
        if (!ask(`Replace the cards in ${old.name}? The old list is kept in Versions.`, f.confirmed)) return;
        await commit((s) => {
          const i = s.decks.findIndex((x) => x.id === old.id);
          const snap = withSnapshot(s.decks[i], "Before re-import");
          // The imported list replaces every zone, including an empty sideboard. This importer
          // reads one commander, so an earlier partner pairing must not survive the replacement.
          const { commanders, ...rest } = snap;
          void commanders;
          s.decks[i] = withSnapshot({ ...rest, name: d.name, format: d.format, commander: d.commander, source: d.source, cards: d.cards, side: d.side }, "Re-imported");
        });
        made = JSON.stringify({go: "deck", id: old.id, tab: "versions"});
        return;
      }
      d.id = uid();
      const deck = withSnapshot(d, "Imported");
      await commit((s) => {
        s.decks.push(deck);
        s.activeDeck = deck.id;
      }, { msg: "Deck imported. Your collection is unchanged." });
      made = JSON.stringify({go: "deck", id: deck.id, tab: "cards"});
    } catch (e) { siteText['#dImpStatus'] = String(e?.message || e); }
  },
  // app.js A.acqConfirm (6383), the acquire sheet's Add to collection: [d] {deck, mode, picked [{name, qty}] (the ticked rows),
  // location (#acqLoc), picker (#acqLocPicker), finish, cond}. Its error goes under the sheet's list (#acqError, siteText); saved, the
  // app closes the sheet (made "closed").
  async acqConfirm(d) {
    siteText = {};
    const deck = deckOf(d.deck); if (!deck) throw Error('This deck is no longer available.');
    try {
      const picked = (d.picked || []).map((p) => ({ name: String(p.name), qty: Number(p.qty), location: String(d.location ?? '').trim() }));
      if (!picked.length) throw Error("Tick the cards you have.");
      const extra = { finish: d.finish || "nonfoil", condition: d.cond || "Near Mint", language: "en" };
      const n = commits;
      await commit(
        (s) => {
          for(const p of picked)p.location=rememberLocation(s,"mtg",p.location,{createBinder:d.picker === "binder:new"});
          if (d.mode === "purchase") {
            for (const p of picked) {
              if (!Number.isInteger(p.qty) || p.qty < 1) throw Error("Check the quantity for " + p.name);
              s.collection.push({ id: uid(), name: p.name, qty: p.qty, set: "", collectorNumber: "", printingId: null, printingVerified: false, nameVerified: !!meta(p.name), reserved: 0, location: p.location, raw: { acquisition: "Bought as a deck", deckId: deck.id }, ...extra });
            }
          } else {
            const before = new Set(s.collection.map((e) => e.id));
            s.collection = acquireMissing(deck, s.collection, s.decks, S.catalog, picked, uid).map((e) => (before.has(e.id) ? e : { ...e, ...extra }));
          }
          s.example = false;
        },
        { msg: `${sumQty(picked)} cards added to your collection.` },
      );
      if (commits > n) made = 'closed';
    } catch (e) { siteText['#acqError'] = String(e?.message || e); }
  },
  // The Build decks sheet's versions (tcg.js A.tTierSave, A.tTierSaveAll, A.tTierSaveGo, A.tTierCopy, A.tTierBuy), on the sheet's builds
  // (S.ui.tbuild): saved to the game's decks; Save and see matchups / playtest closes the sheet and opens the new deck on that tab (made
  // {deck, tab}); Copy deck list copies; Buy copies the missing cards and asks before Mass Entry opens.
  // views.js buildSheet's versions for Magic (app.js A.tierSave, A.tierSaveAll, A.tierSaveGo, A.tierCopy, A.tierBuy 4074-4139), verbatim but
  // for go (made {deck, tab}) and closeSheet (the sheet's panel).
  async tierSave(d) { mtgFocus(); const B = S.ui.build, tier = B.results[B.format]?.[Number(d.i)]; if (!tier) return;
    await resolveNames(tier.cards.map(r=>r.name)); const dk = generatedDeck(tier, B.seed);
    await commit((s) => s.decks.push(dk), { msg: `Saved “${dk.name}”. Find it in My decks.` }); },
  async tierSaveGo(d) { mtgFocus(); const B = S.ui.build, tier = B.results[B.format]?.[Number(d.i)]; if (!tier) return;
    await resolveNames(tier.cards.map(r=>r.name)); const dk = generatedDeck(tier, B.seed);
    await commit((s) => s.decks.push(dk), { msg: `Saved “${dk.name}”.` });
    tbuildShut(); made = JSON.stringify({deck: dk.id, tab: d.to || ''}); },
  async tierCopy(d) { mtgFocus(); await siteRun(async () => { const B = S.ui.build, tier = B.results[B.format]?.[Number(d.i)];
    if (tier) await tcgHooks.copyText(exportDeckText({ cards: tier.cards, side: tier.side || [] }), "Deck list copied."); }, d); },
  async tierBuy(d) { mtgFocus(); await siteRun(async () => { const B = S.ui.build, tier = B.results[B.format]?.[Number(d.i)]; if (!tier) return;
    const rows = tier.cards.map((r) => ({ qty: r.qty - Math.min(r.qty, tier.preparedByAsk ? tier.availableCopies?.[key(r.name)] ?? 0 : B.avail?.(r.name) ?? 0), name: r.name })).filter((r) => r.qty > 0);
    if (!(await buyMtg(rows))) toasts.push({text: "You own every card in this version.", undo: false}); }, d); },
  async tierSaveAll(d) { mtgFocus(); const B = S.ui.build, tiers = B.results[B.format] || [];
    const ds = tiers.map((t) => generatedDeck(t, B.seed));
    await commit((s) => s.decks.push(...ds), { msg: `Saved ${ds.length} decks to My decks.` }); },
  async tTierSave(d) { tcgFocus(d.game, S.ui.view || 'tdeck'); await siteRun(() => TA.tTierSave({dataset: {i: d.i}}), d); },
  async tTierSaveAll(d) { tcgFocus(d.game, S.ui.view || 'tdeck'); await siteRun(() => TA.tTierSaveAll({dataset: {}}), d); },
  async tTierSaveGo(d) { tcgFocus(d.game, S.ui.view || 'tdeck'); tcgWent = '';
    await siteRun(() => TA.tTierSaveGo({dataset: {i: d.i, to: d.to}}), d);
    if (tcgWent.startsWith('#tdeck/')) made = JSON.stringify({deck: decodeURIComponent(tcgWent.slice(7)), tab: d.to || ''}); },
  async tTierCopy(d) { tcgFocus(d.game, S.ui.view || 'tdeck'); await siteRun(() => TA.tTierCopy({dataset: {i: d.i}}), d); },
  async tTierBuy(d) { tcgFocus(d.game, S.ui.view || 'tdeck'); await siteRun(() => TA.tTierBuy({dataset: {i: d.i}}), d); },
  async tDeckCopyMissing(d) { tcgFocus(d.game, 'tdeck'); S.ui.tdeckId = d.deck; await siteRun(() => TA.tDeckCopyMissing({dataset: {id: d.deck}}), d); },
  // tcg.js A.tOwnSave, the site's own: it reads its form from the page (#tQty, #tCond…), so the form as the app has it stands in for
  // those fields while the handler reads them (before its first await); it closes the sheet when saved (made: "closed").
  async tOwnSave(d) {
    const ctx = taddCtx;
    if (!ctx) { toasts.push({text: 'Reopen Add to collection before saving this card.', undo: false}); return; }
    tcgFocus(ctx.game, S.ui.view || 'collection'); S.ui.sheetCtx = ctx;
    const f = d.form || {}, vals = {'#tQty': f.qty, '#tPrint': f.print, '#tEdition': f.edition, '#tCond': f.condition, '#tLanguage': f.language, '#tLoc': f.location, '#tLocPicker': f.picker, '#lotManualValue': f.value};
    let closed = false; tcgCloseHook = () => { closed = true; };
    const was = globalThis.document;
    globalThis.document = {querySelector: q => vals[q] == null ? null : {value: String(vals[q])}};
    let saving;
    try { saving = TA.tOwnSave({dataset: {id: ctx.id, ...(d.setId ? {setId: d.setId} : {})}}); } finally { if (was === undefined) delete globalThis.document; else globalThis.document = was; }
    try { await saving; } finally {
      tcgCloseHook = () => {};
      if (closed) { if (S.ui.sheetCtx === ctx) S.ui.sheetCtx = taddPrev; if (taddCtx === ctx) { taddCtx = taddPrev = null; priceRun = null; } made = 'closed'; }
    }
  },
  // ---- A deck's cards (app.js 6216-6300). The site edits the open deck (scopedEditDeck: currentDeck() when tapped); the app names it
  // in [d].deck, as the deck page or the card page opened from it has it.
  // app.js A.deckQty (6288): the − and ＋ on a deck's card, on the deck page and in the card page's "In <deck>" panel.
  async deckQty(d) {
    const name = d.name, delta = Number(d.delta), deck = deckOf(d.deck);
    const row = deck?.cards.find((c) => key(c.name) === key(name));
    if (!row) return;
    if (delta < 0 && row.qty === 1 && key(name) === key(deck.commander)) { toasts.push({text: 'That’s your commander.', undo: false}); return; }
    await editDeckOf(deck.id)((x) => mergeDeckCard(x, name, delta), delta < 0 ? { undo: `−1 ${name}` } : {});
  },
  // app.js A.deckRemove (6297): the card page's Remove from deck (the app closes the page, as closeSheet).
  async deckRemove(d) {
    await editDeckOf(deckOf(d.deck)?.id)((x) => ({ ...x, cards: x.cards.filter((c) => key(c.name) !== key(d.name)) }), { undo: `Removed ${d.name}.` });
  },
  // app.js A.deckEmbSwap (6216): swap a no-emblem card for an owned staple.
  async deckEmbSwap(d) {
    await editDeckOf(deckOf(d.deck)?.id)(
      (x) => {
        const out = x.cards.find((c) => key(c.name) === key(d.out));
        if (!out) return x;
        const cards = x.cards.map((c) => (c === out ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0);
        return mergeDeckCard({ ...x, cards }, d.in, 1);
      },
      { undo: `Swapped ${d.out} for ${d.in}.` },
    );
  },
  // app.js A.deckAdd (6278): the deck page's "Add a card by name" ([d].name: what was typed), looked up as the site looks it up.
  async deckAdd(d) {
    const edit = editDeckOf(deckOf(d.deck)?.id), name = String(d.name || '').trim();
    if (!name) return;
    const c = await resolve(name, true);
    await edit((x) => mergeDeckCard(x, c.name, 1), { msg: `${c.name} added.` });
  },
  // app.js A.addToDeck (5358): a card page's Add to deck, into the deck picked ([d].deck).
  async addToDeck(d) {
    const id = d.deck, x = deckOf(id), name = d.name;
    if (!x) return;
    await commit((s) => {
      const i = s.decks.findIndex((y) => y.id === x.id);
      s.decks[i] = mergeDeckCard(s.decks[i], name, 1);
    }, { msg: `Added to ${x.name}.` });
  },
  // ---- The ⋯ menu (app.js 6143-6262); [d].deck names the deck, the form's values ride in [d] as the site reads them off the sheet.
  // app.js A.deckSaveInfo: Edit deck's Save changes (readDeckBox: the box colour and cover).
  async deckSaveInfo(d) {
    const edit = editDeckOf(deckOf(d.deck)?.id);
    const format = formatOf(d.format).name, name = String(d.name || '').trim(), budget = Math.max(0, Number(d.budget) || 0), strategy = d.strategy, boxAppearance_ = boxAppearance({color: d.color, image: d.image});
    await edit((x) => ({ ...x, name: name || x.name, budget, strategy, format, boxAppearance: boxAppearance_, commander: hasCommander(format) ? x.commander : "" }), { msg: "Saved." });
  },
  // app.js C.deckLock: More deck tools' Assembled.
  async deckLock(d) { const on = d.checked === true || d.checked === 'true'; await editDeckOf(deckOf(d.deck)?.id)((x) => ({ ...x, locked: on }), { msg: on ? "Copies reserved for this deck." : "Reservation released." }); },
  // app.js A.snapshot: Save a version, named as the player said ([d].label; the app asks askText's question first).
  async snapshot(d) {
    const x = deckOf(d.deck), edit = editDeckOf(x?.id);
    const before = (x?.versions || []).length;
    await edit((y) => withSnapshot(y, d.label || "Snapshot"));
    toasts.push({text: (deckOf(d.deck)?.versions || []).length > before ? "Version saved." : "No changes since the last version.", undo: false});
  },
  // app.js A.coachSwap: one copy of [d].cut out and one of [d].add in (a coach swap on the Power page), the list before it saved as a version.
  async coachSwap(d) {
    const x = deckOf(d.deck), edit = editDeckOf(x?.id);
    if (!x || !x.cards.some((r) => r.name === d.cut)) throw Error("Your deck changed. Open Power again.");
    await resolveNames([d.add]);
    const cards = applySwapsToCards(x.cards, [{ cut: d.cut, add: d.add }]);
    await edit((y) => withSnapshot({ ...withSnapshot(y, "Before coach swap"), cards }, "Coach swap"), { msg: `${d.add} in, ${d.cut} out. Previous list saved in Versions.` });
  },
  // app.js A.restoreVer (7222): asked first; the current list saved as a version, then the version's lists.
  async restoreVer(d) {
    const x = deckOf(d.deck), edit = editDeckOf(x?.id), v = (x?.versions || []).find((y) => y.id === d.id);
    if (!v || !ask(`Restore “${v.label}”? Your current list is saved as a version first.`, d.confirmed)) return;
    await edit((y) => ({ ...withSnapshot(y, "Before restoring " + v.label), cards: structuredClone(v.cards), side: structuredClone(v.side || []) }), { msg: "Version restored." });
  },
  // app.js A.deleteVer (7229).
  async deleteVer(d) {
    const x = deckOf(d.deck), edit = editDeckOf(x?.id);
    if (!ask("Delete this saved version?", d.confirmed)) return;
    await edit((y) => ({ ...y, versions: (y.versions || []).filter((v) => v.id !== d.id) }));
  },
  // app.js A.logGame (7254): the War Chest's Log a game, its result, turn and note as the panel had them.
  async logGame(d) {
    const x = deckOf(d.deck); if (!x) return;
    const note = { id: uid(), deckId: x.id, sig: cardSig(x.cards), date: new Date().toLocaleDateString(), author: "", table: "", result: String(d.result ?? ''), turn: Number(d.turn) || null, note: String(d.note ?? '').trim().slice(0, 1000) };
    await commit((s) => s.notes.push(note), { msg: "Game saved." });
  },
  // app.js A.lifeLog (7292): the life tracker's game, logged against the open deck; the tracker closes.
  async lifeLog(d) {
    const x = deckOf(d.deck), g = S.ui.life;
    if (!x || !g) return;
    const opp = g.players.slice(1).map((p) => p.name).join(", ");
    S.ui.life = null;
    await commit((s) => {
      s.notes.push({ id: uid(), deckId: x.id, sig: cardSig(x.cards), date: new Date().toLocaleDateString(), author: "", table: opp, result: String(d.result ?? ''), turn: g.turn, note: `${g.players.length}-player game vs ${opp}`.slice(0, 1000) });
    }, { msg: "Game saved to the log." });
  },
  // app.js A.deleteNote (7323).
  async deleteNote(d) { await commit((s) => (s.notes = s.notes.filter((n) => n.id !== d.id))); },
  // app.js A.shareMake (4490): the creator name and the deck's note saved as typed (no redraw, no lookups); then the app asks
  // shareOpen for the payload, makes the link and asks again for the sheet that shows it.
  async shareMake(d) {
    mtgFocus();
    const author = String(d.author ?? '').trim().slice(0, 60), about = String(d.about ?? '').trim().slice(0, 1500);
    await commit((s) => { s.settings.authorName = author; const x = s.decks.find((y) => y.id === d.deck); if (x) x.about = about; });
  },
  // A.deckShare / tcg.js A.tShare: the share sheet ([made]: {payload, sheet}), the payload share.js's for the deck as saved (Magic's
  // with the creator and note A.shareMake kept; the other games' with the account's creator name and the deck's note, as A.tShare
  // passes them). Android's browser has navigator.share, so the sheet has its Share… button.
  async shareOpen(d) {
    const game = d.game || 'mtg', link = String(d.link || ''), nav = globalThis.navigator;
    const put = (k, v) => Object.defineProperty(globalThis, k, {value: v, writable: true, configurable: true});
    let html = '', payload = null, name = '';
    put('navigator', {...(nav || {}), share: async () => {}});
    try {
      if (game === 'mtg') {
        mtgFocus(); const x = deckOf(d.deck); if (!x) throw Error('This deck is no longer available.');
        name = x.name; payload = sharePayload(x, {author: S.state.settings.authorName || '', about: x.about || ''}); html = shareSheetView(x, link);
      } else {
        tcgFocus(game, 'tdeck'); S.ui.tdeckId = d.deck;
        const x = (S.state.tcg?.[game]?.decks || []).find((y) => y.id === d.deck); if (!x) throw Error('This deck is no longer available.');
        name = x.name; payload = sharePayloadTcg(game, x, {author: S.state.settings.authorName || '', about: x.about || ''});
        const was = tcgSheetHook; tcgSheetHook = h => { html = String(h || ''); };
        try { await TA.tShare({dataset: {id: d.deck}}); } finally { tcgSheetHook = was; }
      }
    } finally { if (nav === undefined) delete globalThis.navigator; else put('navigator', nav); }
    made = JSON.stringify({payload: JSON.stringify(payload), sheet: shareModel(html, link, game, name)});
  },
  // app.js A.deckDup: the copy, made the active deck; the app opens it ([made]).
  async deckDup(d) {
    const x = deckOf(d.deck); if (!x) return;
    const copy = { ...structuredClone(x), id: uid(), name: x.name + " (copy)", locked: false };
    await commit((s) => { s.decks.push(copy); s.activeDeck = copy.id; }, { msg: "Duplicated." });
    made = copy.id;
  },
  // app.js deckExperience save (1674): a Build a deck result ([d] {deck, request}, the WebView's flowSaveData) saved as a new deck,
  // named after its build-around and format, with its first version; the app opens it ([made]).
  // Yu-Gi-Oh! and Pokémon's (the engine's own flowSaveData): {..., format, createdAt} into that game's decks, as app.js save() writes it.
  async deckGenerated(d) {
    const r = d.request || {}, id = uid(), name = (r.seedCard?.name || d.deck?.buildAround || 'My deck') + ' · ' + r.formatName;
    if (!d.deck || !['mtg', 'ygo', 'ptcg'].includes(r.game)) throw Error('Your workspace changed. Rebuild this deck.');
    const deck = r.game === 'mtg' ? withSnapshot({...structuredClone(d.deck), id, name, budget: r.budget, versions: []}, 'Generated') : {...structuredClone(d.deck), id, name, format: r.format, createdAt: new Date().toISOString()};
    await commit((s) => { if (r.game === 'mtg') s.decks.push(deck); else { s.tcg ||= {}; s.tcg[r.game] ||= tcgGs(r.game); s.tcg[r.game].decks.push(deck); } }, { msg: 'Saved to My decks.' });
    made = id;
  },
  // tcg.js A.tAddToDeck: a Yu-Gi-Oh! or Pokémon card page's Add to deck (A.cardDeckPicker's Deck <select> is [d].deck).
  async tAddToDeck(d) { tcgFocus(d.game, S.ui.view || 'search'); await siteRun(() => TA.tAddToDeck({dataset: {id: String(d.id)}}), d, {'#tToDeck': d.deck}); },
  // tcg.js A.tBuild on a card page (⚒ Build decks): its openDeckFlow request comes back as [made], for the app's Build a deck.
  async tBuildCard(d) {
    tcgFocus(d.game, S.ui.view || 'search'); flowAskPanel = null; flowAsked = null;
    // siteRun: tcg.js checks the open #sheet before and after it loads the card (none here; the card page is the app's).
    await siteRun(() => TA.tBuild({dataset: {id: String(d.id)}}), d);
    if (flowAsked) made = JSON.stringify(flowAsked);
  },
  // tcg.js A.tSeedGo (the app's Pick cards sheet, its ticked ids): A.tBuildMulti, whose openDeckFlow request comes back as [made].
  async tSeedGo(d) {
    tcgFocus(d.game, 'decks'); flowAskPanel = null; flowAsked = null;
    await TA.tBuildMulti({dataset: {ids: String(d.ids || '')}});
    if (flowAsked) made = JSON.stringify(flowAsked);
  },
  // tcg.js A.tMetaBuild from the tournament deck sheet: its ⚒ Build around it, in the sheet the site checks it is in; the request as [made].
  async tMetaBuild(d) {
    const spec = proven.spec, G = spec?.g;
    if (!spec?.buildMeta || S.ui.sheetCtx?.type !== 'proven' || G === 'mtg') throw Error('This deck changed. Open it again.');
    tcgFocus(G, S.ui.view === 'home' ? 'home' : 'decks'); flowAskPanel = null; flowAsked = null;
    provenDoc.body.innerHTML = `<dialog id="sheet" open><button data-act="tMetaBuild" data-key="${esc(spec.buildMeta.deck.key)}" data-proven-build="${esc(spec.buildMeta.token)}"></button></dialog>`;
    const t = provenDoc.querySelector('[data-act="tMetaBuild"]');
    await provenRun(() => TA.tMetaBuild(t));
    provenDoc.body.innerHTML = '';
    if (flowAsked) made = JSON.stringify(flowAsked);
  },
  // app.js A.deckDelete: asked first; the app goes back to the decks.
  async deckDelete(d) {
    const x = deckOf(d.deck); if (!x) return;
    if (!ask(`Delete ${x.name}? Your collection is not affected.`, d.confirmed)) return;
    await commit((s) => { s.decks = s.decks.filter((y) => y.id !== x.id); if (s.activeDeck === x.id) s.activeDeck = s.decks[0]?.id || null; }, { undo: `Deleted ${x.name}.` });
  },
  // app.js A.refreshDeck: every card looked up again (resolveNames, refresh), renamed to what Scryfall calls it.
  async refreshDeck(d) {
    const x = deckOf(d.deck), edit = editDeckOf(x?.id); if (!x) return;
    const r = await resolveNames(x.cards.map((c) => c.name), (m) => toasts.push({text: String(m), undo: false}), true);
    await edit((y) => ({ ...y, cards: y.cards.map((c) => ({ ...c, name: r.matched.get(key(c.name)) || c.name })) }), { recordDeckWork: false });
    toasts.push({text: r.failed.length ? `${r.failed.length} cards not found: ${r.failed.slice(0, 3).join(", ")}` : "Card data and prices refreshed.", undo: false});
  },
  // app.js saveLot: the add sheet's Add to collection / Save changes ([d]: the form; unverified: Save without lookup). Its words go
  // back as the error, shown under the form.
  async addSave(d) {
    const ctx = addCtx, unverified = !!d.unverified,
      editing = ctx?.entry,
      name = unverified ? String(d.name || '').trim() : ctx?.lookup?.name;
    if (!name) throw Error('Look up or type a card name first.');
    const qty = Number(d.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000) throw Error('Copies must be a whole number from 1 to 100000.');
    const rawValue = d.value || '', manualValue = rawValue === '' ? null : Number(rawValue);
    if (manualValue !== null && (!Number.isFinite(manualValue) || manualValue < 0)) throw Error('Enter a non-negative value or leave it blank.');
    const e = {
      ...(editing || {}),
      manualValue, manualValueCondition: conditionName(d.condition),
      id: editing?.id || uid(),
      name,
      qty,
      set: String(d.set || '').trim(),
      collectorNumber: String(d.number || '').trim(),
      finish: d.finish,
      language: d.language,
      condition: d.condition,
      location: String(d.location || '').trim(),
      reserved: Math.min(editing?.reserved || 0, qty),
      printingId: null,
      printingVerified: false,
      raw: editing?.raw || {},
    };
    delete e.lookupFailed;
    const createBinder = d.picker === 'binder:new';
    if (!unverified && e.set && e.collectorNumber) {
      const c = await verifyPhysical(e);
      if (addCtx !== ctx) return;
      if (key(c.name) !== key(name)) throw Error(`That set and number is ${c.name}, not ${name}.`);
      Object.assign(e, verifiedLot(e, c));
    } else if (!unverified) e.nameVerified = true;
    await commit(
      (s) => {
        e.location = rememberLocation(s, 'mtg', e.location, {createBinder});
        s.collection = editing ? s.collection.map((x) => (x.id === e.id ? e : x)) : [...s.collection, e];
        s.example = false;
        s.printings = { ...s.printings, ...(S.pendingPrintings || {}) };
      },
      { msg: editing ? 'Saved.' : `${qty}× ${name} added.`, guard: () => addCtx === ctx },
    );
    if (addCtx !== ctx) return;
    S.pendingPrintings = null;
    addCtx = null;
  },
  // app.js A.addDelete: the edit sheet's Delete, asked first.
  async addDelete(d) {
    const e = addCtx?.entry;
    if (!e || !ask(`Delete ${e.qty}× ${e.name} from your collection?`, d.confirmed)) return;
    await commit((s) => (s.collection = s.collection.filter((x) => x.id !== e.id)), { msg: 'Removed from collection.' });
    addCtx = null;
  },
  // app.js A.refreshPrices (Collection's ⋯ menu, Value's Refresh prices): every owned card's data read again, then its toast.
  async refreshPrices() {
    const say = text => toasts.push({text, undo: false});
    try {
      const r = await refreshMagicCollectionPrices(true);
      if (r.cancelled) return;
      if (r.offline) return say("You’re offline. Saved prices have been kept.");
      if (!r.total) return say("No cards to refresh.");
      if (r.refreshed) say(`Price data refreshed for ${r.refreshed} ${r.refreshed===1?'card':'cards'}.${r.failed?` ${r.failed} ${r.failed===1?'lookup':'lookups'} failed; saved prices were kept.`:''}${r.skipped?` ${r.skipped} cards were not checked.`:''}`);
      else say("Couldn’t refresh prices. Saved prices have been kept.");
    } catch { say("Couldn’t finish refreshing prices. Please try again."); }
  },
  // tcg.js A.tRefreshPrices: the Yu-Gi-Oh! or Pokémon collection's prices read again (Cards' refresh button, Value's Refresh prices).
  async tRefreshPrices(d) { tcgFocus(d.game, 'collection'); await siteRun(() => TA.tRefreshPrices({dataset: {}}), d); },
  // workbench-ui.js A.batchApply: the chosen lots moved (where they live, a new binder made for them), copied into a deck's draft,
  // or wished for, as the sheet that opened them said ([ids], [kind]); the sheet's fields come back as the site reads them.
  async batchApply(d) {
    workbenchReady(); if (d.game && d.game !== 'mtg') tcgFocus(d.game, 'collection'); else mtgFocus();
    const ctx = {type: 'batch-action', game: d.game || 'mtg', kind: d.kind, ids: JSON.parse(d.ids || '[]')}, prev = S.ui.sheetCtx;
    selectionState(ctx.game); S.ui.sheetCtx = ctx; batchGame = ctx.game;
    try { await siteRun(() => WA.batchApply(), d, {'#batchLocation': d.location ?? '', '#batchDeck': d.deck ?? '', '#batchLocationPicker': d.picker ?? ''}); }
    finally { batchGame = ''; if (S.ui.sheetCtx === ctx) S.ui.sheetCtx = prev; }
  },
  // app.js A.saveBinder: the editor's fields checked as the site checks them, then the binder saved (a location binder remembers
  // its place). [d]: game, binder (its id when changing one), title, rule, value, color, background (an HTTPS link), bgData (an upload).
  async saveBinder(d) {
    const game = d.game, rule = String(d.rule || 'location'), title = String(d.title || '').trim(), raw = String(d.value || '').trim();
    const value = rule === 'set' ? (game === 'ygo' ? raw.toUpperCase() : raw.toLowerCase()) : raw || (rule === 'location' ? title : '');
    const color = String(d.color || ''), background = String(d.bgData || '') || String(d.background || '').trim();
    if (!title) throw Error('Give your binder a name.');
    if (!['all', 'rare'].includes(rule) && !value) throw Error('Enter the set, rarity, type, color or location to match.');
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw Error('Choose a valid cover color.');
    if (background && !background.startsWith('data:')) { let url; try { url = new URL(background); } catch { throw Error('Use a valid HTTPS image URL.'); } if (url.protocol !== 'https:') throw Error('Background images must use HTTPS.'); }
    if (background.startsWith('data:') && (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(background) || background.length > 350000)) throw Error('Choose a smaller JPEG, PNG or WebP cover image.');
    const old = binderById(d.binder), b = {id: old?.id || uid(), game, title, rule, value, color, background, featured: old?.featured || '', favorites: binderFavorites(old)};
    await commit(st => { st.settings.binders ||= []; if (b.rule === 'location') rememberLocation(st, game, b.value); const at = st.settings.binders.findIndex(x => x.id === b.id); if (at < 0) st.settings.binders.push(b); else st.settings.binders[at] = b; });
    made = b.id;
    toasts.push({text: 'Binder saved. Owned quantities are unchanged.', undo: false});
  },
  // app.js A.removeBinder: gone from the shelf (Undo brings it back); the cards stay.
  async removeBinder(d) {
    const b = binderById(d.binder); if (!b || b.game !== d.game) return;
    await commit(st => { st.settings.binders = (st.settings.binders || []).filter(x => x.id !== b.id); }, {observeValue: false, undo: `Deleted binder “${b.title}”. Your cards stay in the collection.`});
  },
  // app.js A.featureBinderCard: a pocket's ★ puts its card on the clear cover (up to nine) or takes it off, checked again as it saves.
  async featureBinderCard(d) {
    const b = binderById(d.binder); if (!b || b.game !== d.game) return;
    const allRows = binderRows(b.game), rows = allRows.filter(r => binderMatches(r, b)), id = d.entry; if (!rows.some(r => r.entry.id === id)) return;
    const remove = binderCoverState(b, rows, allRows).favorites.includes(id);
    let plan, refused = '';
    const saved = await commit(st => { const target = st.settings.binders.find(x => x.id === b.id); target.favorites = plan.next; target.featured = target.favorites[0] || ''; return true; }, {observeValue: false, guard: st => {
      const target = st.settings.binders?.find(x => x.id === b.id && x.game === b.game); if (!target) return false;
      const all = binderRows(target.game), matched = all.filter(r => binderMatches(r, target)); if (!matched.some(r => r.entry.id === id)) return false;
      const {favorites, unavailable, references} = binderCoverState(target, matched, all), on = favorites.includes(id);
      if (remove !== on) return false;
      if (!remove && references.length >= MAX_FAVORITES) { refused = unavailable.length ? `All ${MAX_FAVORITES} saved cover slots are used, including ${unavailable.length} unavailable. Unstar a card or remove unavailable cover selections first.` : `A cover shows up to ${MAX_FAVORITES} cards. Unstar one first.`; return false; }
      plan = {next: remove ? references.filter(x => x !== id) : [...references, id], count: favorites.length + (remove ? -1 : 1)}; return true;
    }});
    const said = refused || (saved ? (remove ? 'Removed from the cover.' : `On the cover · ${plan.count}/${MAX_FAVORITES}`) : '');
    if (said) toasts.push({text: said, undo: false});
  },
  // app.js A.clearUnavailableBinderFavorites: only the cover choices whose cards are gone are dropped.
  async clearUnavailableBinderFavorites(d) {
    const b = binderById(d.binder); if (!b || b.game !== d.game) return;
    const allRows = binderRows(b.game), rows = allRows.filter(r => binderMatches(r, b)), {unavailable} = binderCoverState(b, rows, allRows);
    if (!unavailable.length) return;
    let remove;
    await commit(st => { const target = st.settings.binders.find(x => x.id === b.id); target.favorites = binderFavorites(target).filter(id => !remove.includes(id)); target.featured = target.favorites[0] || ''; return true; },
      {observeValue: false, undo: 'Removed unavailable cover selections. Your collection is unchanged.', guard: st => {
        const target = st.settings.binders?.find(x => x.id === b.id && x.game === b.game); if (!target) return false;
        const all = binderRows(target.game), still = binderCoverState(target, all.filter(r => binderMatches(r, target)), all).unavailable;
        remove = unavailable.filter(id => still.includes(id)); return remove.length > 0; }});
  },
  // app.js A.retryLookups (Collection's ⋯ menu): the cards whose lookup failed are looked up again (the app runs the lookups after).
  async retryLookups() {
    await commit((s) => s.collection.forEach((e) => delete e.lookupFailed), { msg: "Looking cards up again…" });
  },
  // app.js A.verifyAll (Collection's ⋯ menu): each lot with a printing id, or a set and collector number, checked against Scryfall
  // (verifyLot), "Checking i/n…" said as it goes (#collMenuMsg), then saved.
  async verifyAll() {
    const list = S.state.collection.filter((e) => !e.printingVerified && (e.printingId || ((e.set || e.setName) && e.collectorNumber)));
    if (!list.length) return toasts.push({text: "No records have set + collector number to verify. Edit a card to add them.", undo: false});
    const updated = new Map();
    for (let i = 0; i < list.length; i++) {
      actStep = `Checking ${i + 1}/${list.length}…`;
      updated.set(list[i].id, await verifyLot(list[i]));
    }
    await commit((s) => {
      s.collection = s.collection.map((e) => updated.get(e.id) || e);
      s.printings = { ...s.printings, ...(S.pendingPrintings || {}) };
    }, { msg: "Verification saved." });
    S.pendingPrintings = null;
  },
  // app.js A.impVerify: the import's names and printings checked (its progress in #impError), the rows marked with what was found.
  async impVerify() {
    if (!impDraft || impBusy) return;
    impBusy = true;
    try {
      const names = impDraft.lots.filter((e) => e.include !== false && !e.printingId && !(e.set && e.collectorNumber)).map((e) => e.name);
      const r = await resolveNames(names, (m) => (actStep = impError = String(m)));
      for (let i = 0; i < impDraft.lots.length; i++) {
        const e = impDraft.lots[i];
        if (e.include === false) continue;
        if (e.printingId || (e.set && e.collectorNumber)) {
          const checked = await verifyLot(e);
          impDraft.lots[i] = checked;
        } else if (r.matched.has(key(e.name))) impDraft.lots[i] = { ...e, name: r.matched.get(key(e.name)), nameVerified: true, review: "Name verified" };
        else if (meta(e.name)) impDraft.lots[i] = { ...e, nameVerified: true, review: "Name verified" };
        else impDraft.lots[i] = { ...e, review: "Name not found" };
      }
    } finally {
      impBusy = false;
      impError = "";
    }
  },
  // app.js A.impApply: the reviewed rows saved ([d] mode: append, replace-source or replace-all, which asks first and keeps a recovery
  // copy; source: the import's name), the import remembered; then the sheet closes and Collection › Cards opens (made: "imported").
  async impApply(d) {
    if (!impDraft || impBusy) return;
    const draft = impDraft, attemptId = draft.attemptId, rows = draft.lots.filter((e) => e.include !== false),
      mode = String(d.mode || 'append'), sourceKey = String(d.source || '').trim();
    const applied = (s) => !!attemptId && (s.importHistory || []).some((h) => h.attemptId === attemptId);
    impBusy = true; impError = '';
    try {
      if (!sourceKey) throw Error("Give this import a source name.");
      if (mode === "replace-all" && !ask("Replace your whole collection? A recovery copy is kept, but export a backup first.", d.confirmed)) return;
      if (applied(S.state)) { made = 'imported'; return; }
      if (mode === "replace-all") siteRecovery = JSON.stringify(stripCache(S.state));
      await commit((s) => {
        const lots = rows.map((e) => {
          const { candidates, review, rawRows, include, ...lot } = e;
          void candidates, void review, void rawRows, void include;
          return lot;
        });
        s.collection = applyImport(s.collection, { ...draft, lots }, mode, sourceKey, uid);
        s.importHistory = [...(s.importHistory || []), { id: uid(), attemptId, hash: draft.hash, sourceKey, mode, date: new Date().toISOString(), qty: sumQty(rows) }].slice(-200);
        s.printings = { ...s.printings, ...(S.pendingPrintings || {}) };
        s.example = false;
      }, { msg: `${sumQty(rows)} cards imported.`, guard: (s) => !applied(s) });
      S.pendingPrintings = null;
      made = 'imported';
    } catch (e) {
      impError = e.message;
    } finally {
      impBusy = false;
    }
  },
  // tcg.js A.tImpColl (Paste a list): the lines matched exactly, the cards added; its words go to #tImpStatus (texts) and it closes
  // the sheet once saved (made: "closed").
  async tImpColl(d) {
    tcgFocus(d.game, 'collection'); const prev = S.ui.sheetCtx, ctx = {type: 'timport'}, was = tcgCloseHook; let closed = false;
    S.ui.sheetCtx = ctx; tcgCloseHook = () => { closed = true; };
    try { await siteRun(() => TA.tImpColl({dataset: {}}), d, {'#tImpText': d.text ?? '', '#tImpStatus': ''}); if (closed) made = 'closed'; }
    finally { tcgCloseHook = was; if (S.ui.sheetCtx === ctx) S.ui.sheetCtx = prev; }
  },
  // tcg.js A.tExportColl: the Yu-Gi-Oh! or Pokémon collection as a CSV, saved as the site downloads it (downloaded).
  async tExportColl(d) { tcgFocus(d.game, 'collection'); await siteRun(() => TA.tExportColl({dataset: {}}), d); },
  // tcg.js A.tWishCopy: the wishlist copied as "qty name" lines.
  async tWishCopy(d) { tcgFocus(d.game, 'collection'); await siteRun(() => TA.tWishCopy({dataset: {}}), d); },
  // app.js A.copySpare: Value's Trade binder list (owned cards no deck uses), copied.
  async copySpare() {
    const v = collectionValue(S.state.collection, S.catalog, S.state.printings, S.state.decks);
    siteCopied = exportDeck(v.spare.map((x) => ({ name: x.name, qty: x.qty })));
    toasts.push({text: 'Trade binder list copied.', undo: false});
  },
};

/* ---------- Condition prices (app.js 3006-3085) ---------- */
// The site's condition feed (/api/prices/conditions) with the account's token; quotes it brings back are kept on the matching
// lots and saved, as app.js does. A save made here outside a tap (bgSaves) is written to the device by the app (CollectionWrites).
let conditionToken = '', conditionWorkspaceRevision = 0, bgSaves = 0;
configureConditionAuth(async () => conditionToken);
let conditionScheduler = createConditionRefreshScheduler();
const queueWorkspaceWrite = fn => { const r = writes.then(fn, fn); writes = r.catch(() => {}); return r; };
// app.js save({queued: true}): the workspace was changed in place (a lot's quotes); stamped, and the app writes it.
const saveInPlace = () => { S.state.lastSavedAt = new Date().toISOString(); bgSaves++; };
function conditionCardFor(entry,game){
 const card=game==='mtg'?(entry.printingVerified&&S.state.printings?.[entry.printingId])||meta(entry.name):tcgCardOf(game,entry.cardId);
 return card&&!card.brief&&!(game==='mtg'&&entry.printingVerified&&card.id!==entry.printingId)?card:null;
}
function conditionSelectionAllowed(card,entry,game){
 if(!card?.id||card.brief||!conditionRequest(card,entry,game))return false;
 if(game==='ygo'){
  if(entry.setReleaseUnverified)return false;
  const raw=tcgCardOf(game,card.id)||card;
  const matches=(raw?.sets||[]).filter(p=>p.code===entry.printing&&(!entry.rarity||p.rarity===entry.rarity));
  if(matches.length>1)return false;
  if(entry.setReleaseId){
   const scoped=tcgSetContextCard(game,raw,entry.setReleaseId,tcgYgoCatalogue());
   if(scoped?.setContext?.status!=='resolved'||scoped.setContext.printings.filter(p=>p.code===entry.printing&&p.rarity===entry.rarity&&!p.releasePriceAmbiguous).length!==1)return false;
  }
 }
 return true;
}
function fetchConditionValue(card,entry,game,done,options={}){
 const selected=conditionQuoteEntry(card,entry),workspaceRevision=conditionWorkspaceRevision;
 if(globalThis.navigator?.onLine===false)return Promise.resolve({changed:false,status:'deferred',reason:'offline'});
 if(!conditionSelectionAllowed(card,selected,game))return Promise.resolve({changed:false,status:'deferred',reason:'unverified-selection'});
 const current=()=>workspaceRevision===conditionWorkspaceRevision&&conditionSelectionAllowed(card,selected,game)&&(!options.current||options.current());
 const identityMatches=q=>{const resolved=conditionQuoteEntry(card,q);return CONDITION_IDENTITY.every(k=>String(resolved[k]||'')===String(selected[k]||''));};
 const cached=[...new Map([...(card.conditionQuotes||[]),...(selected.conditionQuotes||[])].filter(identityMatches).map(q=>[JSON.stringify(q),q])).values()];
 const value=conditionValue(null,selected,cached);
 if(value.kind==='manual'&&!options.retry)return Promise.resolve({changed:false,status:'manual'});
 const request=value.kind==='condition-quote'&&!options.retry?Promise.resolve({changed:false,status:'available',rawQuotes:cached,reused:true}):
  conditionScheduler.request(conditionRequest(card,selected,game),()=>{
   if(!conditionSelectionAllowed(card,selected,game))return {changed:false,status:'deferred',reason:'unverified-selection'};
   if(options.retry)forgetConditionAttempt(conditionRequest(card,selected,game));
   return loadConditionQuotes({...card,conditionQuotes:[...(card.conditionQuotes||[])]},selected,game);
  },{...options,current});
 return request.then(async result=>{
  if(workspaceRevision!==conditionWorkspaceRevision)return {changed:false,status:'deferred',reason:'workspace-changed'};
  if(!conditionSelectionAllowed(card,selected,game))return {changed:false,status:'deferred',reason:'unverified-selection'};
  let changed=false;
  if(['available','unpriced','unmapped'].includes(result.status)||result.rawQuotes?.length){
   const rawQuotes=result.rawQuotes||result.quotes||[];
   changed=applyConditionQuotes(card,selected,rawQuotes).changed||!!result.changed;
   await queueWorkspaceWrite(async()=>{
    if(workspaceRevision!==conditionWorkspaceRevision||!conditionSelectionAllowed(card,selected,game))return;
    const canonical=conditionCardFor(selected,game);
    if(canonical&&canonical.id===card.id)changed=applyConditionQuotes(canonical,selected,rawQuotes).changed||changed;
    const lots=game==='mtg'?S.state.collection:tcgGs(game).collection;
    let saved=false;
    for(const lot of lots)if((game==='mtg'?key(lot.name)===key(card.name):lot.cardId===card.id)&&
     !lot.setReleaseUnverified&&(!selected.setReleaseId||lot.setReleaseId===selected.setReleaseId)&&identityMatches(lot)&&
     conditionSelectionAllowed(card,lot,game)){
      const holder={conditionQuotes:lot.conditionQuotes||[]};
      if(applyConditionQuotes(holder,selected,rawQuotes).changed){lot.conditionQuotes=holder.conditionQuotes;saved=true;}
    }
    if(changed){if(game==='mtg')S.catalogDirty=true;else tcgPersistQuoteCache();}
    if(saved){changed=true;saveInPlace();}
   });
  }
  const output={...result,changed};if(current())done?.(output);return output;
 });
}
function refreshChangedConditions(changed){
 for(const {game,entry} of changed){
  const identity=conditionLotIdentity(entry),current=()=>{
   const lots=game==='mtg'?S.state.collection:tcgGs(game).collection;
   return lots.some(lot=>lot.id===entry.id&&conditionLotIdentity(lot)===identity);
  };
  if(!current())continue;
  const card=conditionCardFor(entry,game);
  if(card)void fetchConditionValue(card,entry,game,()=>{},{source:'saved',current});
 }
}

/* ---------- Add to collection / Edit card (app.js addSheet 5374, A.own 5403, A.addLookup, saveLot 5450, A.addDelete) ---------- */
let addCtx = null, addSeq = 0;
// app.js addPreview, read back: the picture as ui.js img() makes it (its price tier's ring), the name, type line and reference.
const addPreview = c => {
  const i = one(tree(imgHtml(cardImage(c, 'small') || cardImage(c), c.name, 'card-img')), tagIs('img'));
  return {img: i?.attrs.src || '', tierKey: i?.attrs['data-tier'] || '', tier: styleVar(i, 'tier'), name: c.name, type: typeText(c), line: `Reference ${usd(cardPrice(c))} · ${(c.set || '').toUpperCase()}`};
};
const ADD_FINISHES = [['nonfoil', 'Nonfoil'], ['foil', 'Foil'], ['etched', 'Etched']];
const ADD_CONDITIONS = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'].map(x => [x, x]);
const ADD_LANGUAGES = [['en', 'English'], ['ja', 'Japanese'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ru', 'Russian'], ['ko', 'Korean'], ['zhs', 'Chinese (S)'], ['zht', 'Chinese (T)']];
// collection-locations.js locationPicker, read back: its label, choices, the one chosen, the name box and its hint.
function locationModel(state, game, value) { return locationModelOf(tree(locationPicker(state, game, 'addLocation', value))); }
function locationModelOf(t) {
  const sel = one(t, tagIs('select')), input = one(t, tagIs('input'));
  const opts = all(sel, tagIs('option'));
  return {label: text(one(t, tagIs('label'))), options: opts.map(o => [o.attrs.value ?? '', text(o)]), selected: (opts.find(o => o.attrs.selected !== undefined) || opts[0])?.attrs.value ?? '',
    input: input?.attrs.value || '', placeholder: input?.attrs.placeholder || '', hint: text(one(t, cls('location-hint')))};
}
function addSheetModel(entry = null, preset = {}) {
  const lookup = entry ? (entry.printingVerified && S.state.printings?.[entry.printingId]) || meta(entry.name) : preset.card || null;
  addCtx = {type: 'add', entry, lookup, id: ++addSeq};
  return {ctx: addCtx.id, editing: !!entry, title: entry ? 'Edit card' : 'Add to collection', name: entry?.name || lookup?.name || preset.name || '',
    preview: lookup ? addPreview(lookup) : null, empty: 'Look up the card, check the picture, then save.',
    qty: String(entry?.qty || preset.qty || 1), finish: entry?.finish || preset.finish || 'nonfoil', condition: entry?.condition || 'Near Mint', language: entry?.language || 'en',
    finishes: ADD_FINISHES, conditions: ADD_CONDITIONS, languages: ADD_LANGUAGES,
    location: locationModel(S.state, 'mtg', entry ? entry.location || '' : preset.location ?? null),
    set: entry?.set || preset.set || '', number: entry?.collectorNumber || preset.number || '', printOpen: !!(entry?.set || preset.set),
    value: Number.isFinite(entry?.manualValue) ? String(entry.manualValue) : '', canSave: !!lookup,
    save: entry ? 'Save changes' : 'Add to collection'};
}
// app.js A.own: "Got it" (and the card page's Add to collection): the sheet filled with the card, the printing being looked at
// and the copies a deck is missing. [fromCard]: the card page is the open sheet (S.ui.sheetCtx).
function ownPreset(name, fromCard) {
  const ctx = fromCard ? S.ui.sheetCtx : null, d = ctx?.deckId ? S.state.decks.find(x => String(x.id) === String(ctx.deckId)) : null,
    row = d ? rowsFor(d).find(r => key(r.name) === key(name)) : null,
    print = ctx?.print && key(ctx.print.name) === key(name) ? ctx.print : null;
  return {card: print || meta(name), name, qty: row?.missing || 1, set: print?.set?.toUpperCase(), number: print?.collector_number,
    finish: ctx?.type === 'buy' ? ctx.finish : print && ctx?.priceFinish ? selectedFinish('mtg', print, ctx.priceFinish) : null};
}
// condition-value.js conditionPriceHtml, read back block by block.
function conditionModel(html) {
  return (tree(html).kids || []).filter(n => n.tag).map(n => {
    const c = classes(n);
    if (n.tag === 'small' && c.includes('condition-reference')) { const b = one(n, tagIs('b')); return {k: 'ref', b: text(b), text: text({kids: n.kids.filter(x => x !== b)})}; }
    if (n.tag === 'small') return {k: 'label', text: text(n)};
    if (c.includes('condition-price-hero')) { const kind = one(n, cls('condition-price-kind')); return {k: 'hero', amount: text(one(n, cls('condition-price-amount'))), kind: text(kind), custom: classes(kind).includes('is-custom')}; }
    if (c.includes('condition-price-state')) return {k: 'state', text: text(n)};
    if (c.includes('condition-price-meta')) return {k: 'meta', text: text(n)};
    if (n.tag === 'p') return {k: 'desc', text: text(n)};
    if (c.includes('condition-market-secondary')) return {k: 'compare', b: text(one(n, tagIs('b'))), text: text(one(n, tagIs('small')))};
    if (c.includes('condition-retry')) return {k: 'retry', text: text(n)};
    if (n.tag === 'a') return {k: 'buy', text: text(n), url: n.attrs.href || ''};
    return {k: 'desc', text: text(n)};
  });
}
// app.js refreshConditionPrice for the add sheet ([f]: the form as it stands): painted at once, then again when the feed answers.
function conditionPreview(f, retry, run) {
  const ctx = addCtx; if (!ctx) return;
  const raw = f.value ?? '', manualValue = raw === '' ? null : Number(raw);
  let price, sourceCard = null, reference = null;
  const card = (ctx.entry?.printingVerified && S.state.printings?.[ctx.entry.printingId]) || ctx.lookup;
  const entry = {...ctx.entry, condition: f.condition, finish: f.finish, language: f.language, manualValue, manualValueCondition: conditionName(f.condition)};
  price = conditionValue(cardPrice(card, entry.finish), {...entry, manualValue: null}, card?.conditionQuotes || []).price;
  const set = String(f.set || '').trim().toLowerCase(), number = String(f.number || '').trim();
  if ((set && set !== String(card?.set || '').toLowerCase()) || (number && number !== String(card?.collector_number || ''))) price = null;
  else { sourceCard = card; reference = cardPrice(card, entry.finish); }
  const referenceInfo = {reference, referenceLabel: 'Reference price', retryAction: sourceCard ? 'retryConditionPrice' : '', buyLink: sourceCard ? conditionBuyLink('mtg', sourceCard, entry) : null};
  const paint = (value, quotes, lookup) => { run.blocks = conditionModel(conditionPriceHtml(value, entry, quotes, lookup)); run.placeholder = conditionManualPlaceholder(entry, quotes, lookup); };
  paint(price, [...(sourceCard?.conditionQuotes || []), ...(entry.conditionQuotes || [])], referenceInfo);
  if (!sourceCard) { run.done = true; return; }
  const current = () => addCtx === ctx && run === priceRun;
  if (price == null) paint(price, [...(sourceCard.conditionQuotes || []), ...(entry.conditionQuotes || [])], {...referenceInfo, status: 'loading'});
  Promise.resolve(fetchConditionValue(sourceCard, entry, 'mtg', null, {source: 'search', current, retry})).then(result => {
    if (current() && result) {
      const quotes = [...(sourceCard.conditionQuotes || []), ...(entry.conditionQuotes || [])], fresh = conditionValue(price, {...entry, manualValue: null}, quotes).price;
      paint(fresh, quotes, {...referenceInfo, ...result});
    }
  }).finally(() => { run.done = true; });
}
let priceRun = null, lookupRun = null, setsIndex = null;

/* ---------- The card page's condition switch (Randall 6 Nov): the printing the Prices tab shows, in each condition ----------
 * The same lookup as the add sheet (app.js refreshConditionPrice + fetchConditionValue over the site's /api/prices/conditions): one
 * request answers every condition, conditionValue reads each, and Near Mint without a quote falls back to the reference price, as the
 * site values a lot. A condition with no quote says so (never a made-up discount). */
const COND_CODES = [['NM', 'Near Mint'], ['LP', 'Lightly Played'], ['MP', 'Moderately Played'], ['HP', 'Heavily Played'], ['DMG', 'Damaged']];
let condRun = null;
function condSelection(game) {
  if (game === 'mtg') {
    // The buy sheet prices the saved copy (its printing, finish, condition and language); the card page, the printing it shows.
    const b = buyOn() ? buyCtx : null, ctx = b || sheet; if (!ctx) return null;
    const card = ctx.print || meta(ctx.name); if (!card || card.brief) return null;
    const lot = b || ctx.entry || null, finish = b ? b.finish : selectedFinish('mtg', card, ctx.priceFinish) || 'nonfoil';
    const entry = {name: card.name, printingId: card.id, printingVerified: true, set: card.set, number: card.collector_number, finish, language: lot?.language || 'en'};
    return {card, entry, start: lot?.condition, reference: cardPrice(card, finish)};
  }
  const ctx = tsheet; if (!ctx || ctx.game !== game) return null;
  const card = contextTcgCard(game, ctx.id, ctx); if (!card || card.brief) return null;
  const [printing, rarity] = game === 'ygo' ? String(ctx.priceEdition || '').split('::') : ['', ''];
  const lot = ctx.entryId ? tcgGs(game).collection.find(e => e.id === ctx.entryId) : null;
  let entry = {cardId: card.id, ...(ctx.setId ? {setReleaseId: ctx.setId} : {}), language: lot?.language || 'en', variant: game === 'ptcg' ? (selectedFinish('ptcg', card, ctx.priceFinish) || '') : '',
    printing: printing || '', rarity: rarity || '', edition: game === 'ygo' ? (ctx.priceYgoEdition || '') : ''};
  entry = conditionQuoteEntry(card, entry);
  let reference = tcgReferenceEntryPrice(card, entry);
  if (reference == null && game === 'ygo') { const m = (card.sets || []).filter(p => p.code === printing && p.rarity === rarity); if (m.length === 1) reference = m[0].price ?? null; }
  // The lookup prices one exact version: a Yu-Gi-Oh! printing and rarity, a Pokémon variant (not the market reference).
  const need = game === 'ygo' && (!entry.printing || !entry.rarity) ? 'Choose a printing above to see its price in each condition.'
    : game === 'ptcg' && (!entry.variant || entry.variant === 'reference') ? 'Choose a version above (such as Holofoil) to see its price in each condition.' : '';
  return {card, entry, start: lot?.condition, reference, need};
}
function condModel() {
  const r = condRun; if (!r) return {};
  const sel = r.sel, quotes = sel ? [...(sel.card.conditionQuotes || [])] : [];
  const rows = COND_CODES.map(([code, name]) => {
    const entry = sel ? {...sel.entry, condition: name} : null, v = sel ? conditionValue(name === 'Near Mint' ? sel.reference : null, entry, quotes) : {price: null, kind: 'unpriced-condition'};
    const old = sel && v.price == null ? lastKnownConditionQuote(entry, quotes) : null, q = v.quote || old;
    const buy = sel ? conditionBuyLink(r.game, sel.card, entry) : null;
    return {code, name, price: v.price == null ? '' : usd(v.price), kind: v.kind, old: old ? usd(old.price) : '',
      source: q?.source || (v.kind === 'reference' ? 'Reference price' : ''), when: q ? conditionQuoteTiming(q) : '', type: q?.priceType || '',
      // condition-value.js conditionPriceHtml's link: only a direct product link, with the condition chosen.
      buy: buy?.direct && buy.url ? {href: buy.url, label: 'Find this condition on TCGplayer'} : null};
  });
  return {game: r.game, entry: sel?.entry || null, done: r.done, status: r.status || '', notice: r.notice || '', start: r.start, busy: !r.done, rows};
}

/* ---------- A Yu-Gi-Oh! or Pokémon card's Add to collection (tcg.js A.tOwn 2479, tcgAddSheet, A.tOwnSave 2733; app.js refreshConditionPrice) ---------- */
let taddCtx = null, taddPrev = null;
// tcg.js tcgAddSheet, read back: the card, each field as the site fills it (in its order), its note, where it lives, the custom value, the button.
function taddModel(html, ctx) {
  const t = tree(html), seed = one(t, cls('build-seed')), grid = one(t, cls('grid2')), more = one(t, tagIs('details')), save = one(t, x => x.attrs['data-act'] === 'tOwnSave');
  const fields = all(grid, tagIs('label')).filter(l => !cls('location-picker')(l) && one(l, x => x.tag === 'select' || x.tag === 'input')).map(l => {
    const f = one(l, x => x.tag === 'select' || x.tag === 'input'), opts = all(f, tagIs('option'));
    return {id: f.attrs.id || '', label: text({kids: (l.kids || []).filter(k => k !== f)}), span: cls('span2')(l), kind: f.tag,
      value: f.tag === 'input' ? f.attrs.value || '' : (opts.find(o => o.attrs.selected !== undefined) || opts[0])?.attrs.value ?? '',
      options: opts.map(o => [o.attrs.value ?? '', text(o)]), min: f.attrs.min || '', max: f.attrs.max || ''};
  });
  const img = one(seed, tagIs('img'));
  return {ctx: ctx.taddId, game: ctx.game, title: text(one(t, tagIs('h2'))),
    card: {img: img?.attrs.src ? abs(img.attrs.src) : '', name: text(one(seed, tagIs('b'))), type: text(one(seed, tagIs('small')))},
    fields, foot: text(one(grid, cls('foot'))), location: locationModel(S.state, ctx.game, null),
    more: more ? {title: text(one(more, tagIs('summary'))), open: more.attrs.open !== undefined, label: text({kids: (one(more, tagIs('label'))?.kids || []).filter(k => k.tag !== 'input')}),
      placeholder: one(more, tagIs('input'))?.attrs.placeholder || '', help: text(one(more, cls('foot')))} : null,
    save: text(save), setId: save?.attrs['data-set-id'] || ''};
}
// app.js refreshConditionPrice, its "tadd" side ([f]: the form as it stands): painted at once, then again when the feed answers.
function taddPreview(f, retry, run) {
  const ctx = taddCtx; if (!ctx) { run.done = true; return; }
  const game = ctx.game, raw = f.value ?? '', manualValue = raw === '' ? null : Number(raw);
  const card = contextTcgCard(game, ctx.id, ctx), pr = f.print || '', [printing, rarity] = game === 'ygo' ? pr.split('|') : ['', ''];
  let entry = {cardId: card?.id, ...(ctx.setId ? {setReleaseId: ctx.setId} : {}), condition: f.condition, language: f.language || 'en', variant: game === 'ptcg' ? pr : '', printing: printing || '', rarity: rarity || '',
    edition: f.edition || '', manualValue, manualValueCondition: conditionName(f.condition)};
  entry = conditionQuoteEntry(card, entry);
  const exact = !ctx.setId || (card?.setContext?.status === 'resolved' && (game !== 'ygo' || card.setContext.printings.filter(p => p.code === printing && p.rarity === rarity && !p.releasePriceAmbiguous).length === 1
    && (tcgCardOf(game, ctx.id)?.sets || []).filter(p => p.code === printing && p.rarity === rarity).length === 1));
  let price = exact ? tcgEntryPrice(card, {...entry, manualValue: null}) : null, sourceCard = null, reference = null, referenceLabel = 'Reference price';
  if (exact) {
    sourceCard = card; reference = tcgReferenceEntryPrice(card, entry);
    if (reference == null && game === 'ygo') { const matches = (card.sets || []).filter(p => p.code === printing && p.rarity === rarity); if (matches.length === 1) { reference = matches[0].price ?? null; referenceLabel = 'Set reference · edition unverified'; } }
  }
  const referenceInfo = {reference, referenceLabel, retryAction: sourceCard ? 'retryConditionPrice' : '', buyLink: sourceCard ? conditionBuyLink(game, sourceCard, entry) : null};
  const paint = (value, quotes, lookup) => { run.blocks = conditionModel(conditionPriceHtml(value, entry, quotes, lookup)); run.placeholder = conditionManualPlaceholder(entry, quotes, lookup); };
  paint(price, [...(sourceCard?.conditionQuotes || []), ...(entry.conditionQuotes || [])], referenceInfo);
  if (!sourceCard) { run.done = true; return; }
  const current = () => taddCtx === ctx && run === priceRun;
  if (price == null) paint(price, [...(sourceCard.conditionQuotes || []), ...(entry.conditionQuotes || [])], {...referenceInfo, status: 'loading'});
  Promise.resolve(fetchConditionValue(sourceCard, entry, game, null, {source: 'search', current, retry})).then(result => {
    if (current() && result) {
      const quotes = [...(sourceCard.conditionQuotes || []), ...(entry.conditionQuotes || [])], fresh = conditionValue(price, {...entry, manualValue: null}, quotes).price;
      paint(fresh, quotes, {...referenceInfo, ...result});
    }
  }).finally(() => { run.done = true; });
}
async function verifyPhysical(e) {
  if (e.printingId) return S.state.printings?.[e.printingId] || (await api('/cards/' + encodeURIComponent(e.printingId)));
  let set = e.set?.trim();
  if (!set && e.setName) {
    if (!setsIndex) setsIndex = (await api('/sets')).data;
    const m = setsIndex.find((s) => key(s.name) === key(e.setName));
    if (!m) throw Error('Set name not recognized; enter a set code.');
    set = m.code;
  }
  if (set && e.collectorNumber)
    return api(`/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(e.collectorNumber)}/${encodeURIComponent(e.language || 'en')}`).catch(() =>
      api(`/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(e.collectorNumber)}`),
    );
  if (set && e.name) {
    const r = await api('/cards/search?' + new URLSearchParams({ q: `!"${e.name.replace(/"/g, '')}" set:${set} game:paper`, unique: 'prints' }));
    if (r.total_cards !== 1) {
      e.candidates = r.data.slice(0, 30);
      throw Error('Several printings match. Pick one.');
    }
    return r.data[0];
  }
  throw Error('Exact printing needs a set code and collector number.');
}
function verifiedLot(e, c) {
  if (e.name && key(e.name) !== key(c.name)) throw Error('That printing is ' + c.name + '; check the name.');
  if (e.set && e.set.toLowerCase() !== c.set.toLowerCase()) throw Error('Printing ID and set disagree.');
  if (e.collectorNumber && String(e.collectorNumber) !== String(c.collector_number)) throw Error('Printing ID and collector number disagree.');
  if (e.finish && Array.isArray(c.finishes) && !c.finishes.includes(e.finish)) throw Error(`This printing doesn’t come in ${e.finish}.`);
  const copy = slim({ ...c, checkedAt: c.checkedAt || new Date().toISOString() });
  S.pendingPrintings = { ...(S.pendingPrintings || {}), [c.id]: copy };
  if (!meta(c.name)) cacheCard(c);
  return {
    ...e, name: c.name, printingId: c.id, oracleId: c.oracle_id, set: c.set.toUpperCase(), setName: c.set_name,
    collectorNumber: c.collector_number, language: c.lang || e.language || 'en', printingVerified: true, nameVerified: true,
  };
}

// app.js refreshMagicCollectionPrices (3085), run as the site runs it on the Magic Collection view: each saved card whose data is a day
// old (an hour between tries; [force]: all of them, and the names never matched) is read again from Scryfall in batches of 75, at most
// 150 a pass. Fresh data brings today's prices and the printing's TCGplayer product number, which the condition prices and "Find
// this condition on TCGplayer" key on. The catalog takes it (the app saves it), and the printings saved with lots are rewritten
// (a save outside a tap: bgSaves). The account or workspace changing (a load) retires the pass.
let magicPriceRefresh = null;
const magicPriceAttempts = new Map();
async function refreshMagicCollectionPrices(force = false) {
  const rev = conditionWorkspaceRevision, current = () => rev === conditionWorkspaceRevision;
  const result = {total: 0, refreshed: 0, failed: 0, skipped: 0, cancelled: false, committed: false, offline: false};
  const pending = magicPriceRefresh;
  if (pending?.current()) {
    const previous = await pending.promise;
    if (force && !pending.force && current()) return refreshMagicCollectionPrices(true);
    return previous;
  }
  const now = Date.now(), requests = new Map();
  for (const e of S.state.collection) {
    const c = (e.printingVerified && S.state.printings?.[e.printingId]) || meta(e.name);
    if (!c?.id) {
      if (force && e.name) { const token = 'name:' + key(e.name); requests.set(token, {token, name: e.name, identifier: {name: e.name.split(' // ')[0]}}); }
      continue;
    }
    const time = Date.parse(c.checkedAt), token = 'id:' + c.id;
    if (force || ((!Number.isFinite(time) || now - time >= 86400000) && now - (magicPriceAttempts.get(c.id) || 0) >= 3600000)) requests.set(token, {token, card: c, identifier: {id: c.id}});
  }
  const queue = [...requests.values()].slice(0, force ? 5000 : 150);
  result.total = requests.size; result.skipped = result.total - queue.length;
  if (!queue.length) return result;
  const job = {force, current, promise: null};
  magicPriceRefresh = job;
  job.promise = (async () => {
    const updated = new Map();
    for (let i = 0; i < queue.length && current(); i += 75) {
      const batch = queue.slice(i, i + 75);
      batch.forEach(r => { if (r.card) magicPriceAttempts.set(r.card.id, now); });
      try {
        const data = await api('/cards/collection', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({identifiers: batch.map(r => r.identifier)})});
        if (!current()) break;
        const matched = new Set();
        for (const c of data.data || []) {
          const names = new Set([c.name, c.name?.split(' // ')[0], ...(c.card_faces || []).map(f => f.name)].filter(Boolean).map(key));
          const matches = batch.filter(r => r.card ? r.card.id === c.id : names.has(key(r.name)) || names.has(key(r.name.split(' // ')[0])));
          if (!c.id || !matches.length) continue;
          const old = matches.find(r => r.card)?.card;
          const fresh = slim({...c, conditionQuotes: old?.conditionQuotes, checkedAt: new Date().toISOString()});
          updated.set(c.id, fresh);
          const aliases = matches.filter(r => r.name).map(r => r.name);
          if (aliases.length || meta(c.name)?.id === c.id) cacheCard(fresh, aliases);
          matches.forEach(r => matched.add(r.token));
        }
        result.refreshed += matched.size; result.failed += batch.length - matched.size;
      } catch { if (current()) result.failed += batch.length; }
    }
    result.cancelled = !current();
    if (result.cancelled) return result;
    if (updated.size) {
      result.committed = await commit(s => {
        for (const [id, fresh] of updated) if (s.printings?.[id]) s.printings[id] = {...fresh, conditionQuotes: s.printings[id].conditionQuotes || fresh.conditionQuotes};
        return true;
      }, {guard: current, recordDeckWork: false, valueGames: ['mtg']}) === true;
      if (result.committed) bgSaves++;
      result.cancelled = !current();
    }
    return result;
  })();
  try { return await job.promise; } finally { if (magicPriceRefresh === job) magicPriceRefresh = null; }
}
let pricesRun = null;

let acting = null;
// A tab of the site's markup with its own listeners, in a small DOM (site-dom.mjs): the Rules tab is rule-learning.js
// interactiveRules with attachRuleLearning on it, as tcg.js's deck page draws it (format: the deck's), and app.js's click
// handling over the page (A.ruleHint = rule-dex.js showRuleHint, whose glass opens over it). Taps and typing reach the same
// listeners; the markup as they leave it goes back to the app. A data-act this page doesn't run here goes to the app (acted).
let panel = null, ruleUnder = null;
function panelRun(f) {
  const was = {document: globalThis.document, window: globalThis.window};
  globalThis.document = panel.doc; globalThis.window = {innerWidth: 390, innerHeight: 844, document: panel.doc, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; }, getComputedStyle: () => ({})};
  try { return f(); } finally { for (const k of ['document', 'window']) { if (was[k] === undefined) delete globalThis[k]; else globalThis[k] = was[k]; } }
}
// app.js A.askRules: the rules chat's context from the pressed button (its game and format, else its learning section's; the card the
// rule glass is about; the rule it shows), handed to the app, which opens Ask a Judge with it (gap audit H4).
function judgeContextOf(t) {
  const scope = t?.closest?.('[data-learning-root]'), game = t?.dataset?.game || scope?.dataset?.game || TcgAll.game();
  const format = t?.dataset?.ruleFormat ?? scope?.dataset?.ruleFormat ?? '';
  let cards = [], references = [];
  const raw = t?.closest?.('[data-rule-card-context]')?.dataset?.ruleCardContext;
  if (raw) { try { const c = JSON.parse(raw); if (c.game === game) cards = [c]; } catch {} }
  if (t?.dataset?.rulesReferences) { try { references = JSON.parse(t.dataset.rulesReferences); } catch {} }
  return {game, format, cards, references};
}
// What the site asks its page for (window events): the tab drawn again (the coach's swaps have landed, cards have loaded), or the
// matchup odds run by themselves the first time Power opens. Here the open panel answers.
globalThis.Event ||= class { constructor(type) { this.type = type; } };
globalThis.dispatchEvent = e => {
  const p = panel, t = e?.type;
  if (!p?.redraw) return true;
  try {
    if (t === 'cardstashy-rerender') p.redraw();
    else if (t === 'cardstashy-want-matchups' && /^(deck\|mtg\||playpower\|)/.test(p.key)) p.acts.muRun?.();
    else if (t === 'cardstashy-want-tmatchups' && p.key.startsWith('tdeck|')) p.acts.tMuRun?.();
  } catch (err) { toasts.push({text: err?.message || String(err), undo: false}); }
  return true;
};
const PANEL_ACTS = {ruleHint: t => showRuleHint(t), askRules: t => { panel.acted = {act: 'askRules', data: {...t.dataset, judge: JSON.stringify(judgeContextOf(t))}}; }};
// [acts]: the page's own data-act handlers for this panel (a deck tab's, TDECK_ACTS), before the shared ones.
function panelOpen(key, html, attach, acts = {}) {
  if (panel?.key === key) return;
  const doc = new SiteDocument(), host = doc.createElement('div');
  panel = {key, doc, host, acted: null, acts, toasts: []};
  doc.body.append(host);
  // app.js's document click: the nearest data-act, unless disabled, runs its handler (the ones this page has here).
  doc.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    const fn = panel.acts[t.dataset.act] || PANEL_ACTS[t.dataset.act];
    if (t.localName === 'a' && t.getAttribute('href')) return;
    e.preventDefault();
    // What a handler toasts (tcg.js ctx.toast) goes to the app with the panel.
    const n0 = toasts.length, was = toasts;
    if (fn) fn(t, e); else panel.acted = {act: t.dataset.act, data: {...t.dataset}};
    if (was === toasts) panel.toasts.push(...toasts.splice(n0));
  });
  // app.js's document change: a control's data-change handler (C.<name>), the ones this page has here.
  doc.addEventListener('change', e => {
    const t = e.target.closest?.('[data-change]'); if (!t) return;
    const fn = panel.acts['C.' + t.dataset.change]; if (fn) fn(t, e);
  });
  // app.js's document input: a field's data-input handler (I.<name>), the ones this page has here.
  doc.addEventListener('input', e => {
    const t = e.target.closest?.('[data-input]'); if (!t) return;
    const fn = panel.acts['I.' + t.dataset.input]; if (fn) fn(t, e);
  });
  panelRun(() => { host.innerHTML = html; attach?.(host); });
}
// A field's id from a model before the panel drew again (each draw gives every node a new id; a letter typed meanwhile carries the old
// one): its listener (data-input / data-change, its value) and its place among those, so panelType still reaches the same field.
const panelFields = new Map();
const keepFields = () => {
  if (panelFields.size > 4000) panelFields.clear();
  const seen = {};
  for (const n of panel.doc.querySelectorAll('[data-input],[data-change]')) {
    const attr = n.hasAttribute('data-input') ? 'data-input' : 'data-change', val = n.getAttribute(attr), k = attr + '=' + val;
    panelFields.set(n._id, {attr, val, nth: seen[k] = (seen[k] ?? -1) + 1});
  }
};
const fieldNow = id => { const f = panelFields.get(id); return f ? panel.doc.querySelectorAll('[' + f.attr + ']').filter(x => x.getAttribute(f.attr) === f.val)[f.nth] || null : null; };
const panelModel = () => { const reveal = panel.doc.reveals.splice(0); const acted = panel.acted; panel.acted = null; keepFields();
  if (panel.tbuild) return json({key: panel.key, sheet: buildSheetModel(panel.host.querySelector('#sheetBody') || panel.host, panel.mbuild), acted, toasts: panel.toasts.splice(0).map(t => t.text)});
  return json({key: panel.key, body: domJson(panel.doc.body, el => icon(svgIn(tree(el.outerHTML))), el => picture(one(tree(el.outerHTML), tagIs('img')))),
    reveal: reveal.length ? reveal[reveal.length - 1] : null, acted, toasts: panel.toasts.splice(0).map(t => t.text)}); };
// What app.js attaches to a deck tab's body once it is drawn: the Rules tab's rule-learning.js listeners.
const PANEL_ATTACH = {rules: host => attachRuleLearning(host)};
// A deck tab's data-acts as app.js and tcg.js run them on the page (their render() draws the page again: here the tab's body,
// panel.redraw). War Chest (app.js chestTool): Dice & coin writes its roll in the chest, Draw a hand brings #chestDraw into view,
// Goldfish opens Power; Game Night, Share table, Table Spirit, Deck journal, Ask the Judge and Card lookup go to the app (acted).
// The sample hand: tcg.js A.tDraw and A.tDrawOne.
const TDECK_ACTS = {
  chestTool: t => {
    const tool = t.dataset.tool;
    if (tool === 'dice') { const n = panel.doc.querySelector('[data-chest-result]'); if (n) n.textContent = rollDice(); return; }
    if (tool === 'draw') return panel.doc.getElementById('chestDraw')?.scrollIntoView({behavior: 'smooth', block: 'start'});
    if (tool === 'goldfish') { panel.acted = {act: 'tDeckTab', data: {deck: S.ui.tdeckId, id: 'insights'}}; return; }
    panel.acted = {act: 'chestTool', data: {tool}};
  },
  tDraw: t => { TA.tDraw(t); panel.redraw(); },
  tDrawOne: t => { TA.tDrawOne(t); panel.redraw(); },
  // Power (tcg.js tcgPowerPage): Simulate matchups is A.tMuRun, Load tournament decks A.tMetaRefresh, each drawing the tab
  // again as it starts and as it ends. A.tMuRun's progress line also looks for the site's build overlay (document.querySelector)
  // after each await, when the tap's panelRun has handed document back, so this panel's document stays in place until it ends.
  tMuRun: t => tcgPanelAsync(() => TA.tMuRun(t)),
  tMetaRefresh: t => tcgPanelAsync(() => TA.tMetaRefresh(t)),
  // Upgrade lab's Compare budget builds (tcg.js A.tOptimizeDeck): the Build decks sheet over the tab (tbuildOpen).
  tOptimizeDeck: t => tcgPanelAsync(() => TA.tOptimizeDeck(t)),
};
function tcgPanelAsync(f) {
  const p0 = panel, doc = p0.doc;
  let mine = false;
  const p = Promise.resolve().then(() => { if (!('document' in globalThis)) { globalThis.document = doc; mine = true; } });
  let run;
  try { run = Promise.resolve(f()); } catch (e) { run = Promise.reject(e); }
  panel.redraw();
  return Promise.all([p, run]).catch(e => toasts.push({text: e?.message || String(e), undo: false})).finally(() => {
    if (mine && globalThis.document === doc) delete globalThis.document;
    if (panel === p0) panel.redraw();
  });
}
// tcg.js tcgDeck with [tab] open: its .deck-body, as the page draws it, becomes the panel, fresh each time the tab opens (as A.tDeckTab draws the page again).
function tcgDeckPanel(G, id, tab) {
  tcgFocus(G, 'tdeck'); S.ui.tdeckId = id; (S.ui.tdeckTab ||= {})[G + ':' + id] = tab;
  const d = tcgGs(G).decks.find(x => x.id === id), key = ['tdeck', G, id, tab, d?.format || ''].join('|');
  panel = null;
  const body = () => { const box = new SiteDocument().createElement('div'); box.innerHTML = tcgDeck(id); return box.querySelector('.deck-body')?.innerHTML || ''; };
  const attach = host => PANEL_ATTACH[tab]?.(host);
  panelOpen(key, body(), attach, TDECK_ACTS);
  panel.redraw = () => { tcgFocus(G, 'tdeck'); S.ui.tdeckId = id; panelRun(() => { panel.host.innerHTML = body(); attach(panel.host); }); };
}


// ---- A Magic deck's tabs (views.js deckPage with S.ui.deckTab): Power is one view now (powerHub; Matchups and Upgrade lab fold into it).
// Its data-acts as app.js runs them, render() being the tab drawn again (panel.redraw); what the site leaves to a sheet or the AI goes to the app.
const muState = (d) => ((S.ui.mu ||= {})[d.id] ||= { first: true }); // app.js:3469
const poolCache = new Set(); // app.js:3757
// app.js saveCatalogSoon: the app keeps the catalog (Collection.catalog()).
function saveCatalogSoon() {}
// app.js A.muRun (3470-3509), verbatim but for render() (the tab drawn again) and the overlay's status line, haptic and count-up (the app's).
async function mtgMuRun() {
  const d = currentDeck(), mk = d && mtgMetaKey(d);
  if (!d || !mk) return;
  const st = muState(d);
  if (st.busy) return;
  const msg = (m) => { st.msg = m; };
  Object.assign(st, { busy: true, error: "", msg: "Loading tournament results…" });
  panel.redraw();
  try {
    const data = await loadMeta(mk);
    const archs = (data?.archetypes || []).filter((a) => a.share > 0).slice(0, 8),
      lists = archs.map((a) => ({ a, list: data.decks.find((x) => x.key === a.best) || data.decks.find((x) => (x.archetype || x.name) === a.name) })).filter((x) => x.list?.main?.length);
    if (!lists.length) throw Error("No tournament decks to compare with right now.");
    await resolveNames([...new Set(lists.flatMap((x) => x.list.main.map((r) => r.name)))], (m) => msg("Loading the field's cards · " + m));
    const field = [];
    for (const [i, { a, list }] of lists.entries()) {
      msg(`Simulating against ${a.name} · ${i + 1} of ${lists.length}`);
      await new Promise((r) => setTimeout(r, 16));
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
    st.fieldKey = mtgFieldKey(d);
    fieldStore.set(st.fieldKey, field);
  } catch (e) {
    st.error = e.message || "Couldn't load the field.";
  } finally {
    st.busy = false;
    panel.redraw();
  }
}
// app.js loadFormatPool (3759-3796), verbatim.
async function loadFormatPool(f, colors, seed, progress) {
  const ci = colors.filter((c) => c !== "C").join("").toLowerCase() || "c",
    fq = f.legality ? "f:" + f.legality : "game:paper",
    themes = seed ? themeQueries(seed) : [],
    theme = themes.join("|"),
    key = f.id + "|" + ci + "|" + theme;
  const basics = (colors.length ? colors : ["C"]).map(c=>({W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest",C:"Wastes"})[c]).filter(Boolean);
  for (const name of basics) {
    progress(`Checking ${name} printing quotes…`);
    const current = await resolve(name).catch(() => null);
    try {
      const { card } = await findCheapestPrinting(name, { api, format: f.legality, reference: current, basicOnly: true });
      if (card && (!current || cardPrice(current) === null || cardPrice(card) < cardPrice(current) || (f.legality && !["legal", "restricted"].includes(current.legalities?.[f.legality])))) cacheCard(card);
    } catch {}
  }
  if (poolCache.has(key)) return;
  const queries = [
    ...themes.map(query => ["cards for its plan", `${fq} id<=${ci} -t:land ${query}`]),
    ["the format’s staples", `${fq} id<=${ci} -t:land`],
    ["budget picks", `${fq} id<=${ci} -t:land usd<=0.5`],
    ["efficient interaction", `${fq} id<=${ci} -t:land cmc<=3 (o:destroy or o:exile or o:counter)`],
    ["card flow", `${fq} id<=${ci} -t:land cmc<=3 (o:draw or o:search)`],
    ...(ci.length > 1 ? [["lands", `${fq} id<=${ci} t:land -t:basic`]] : []),
  ];
  for (const [label, q] of queries) {
    progress(`Finding ${label}…`);
    try {
      const r = await api("/cards/search?" + new URLSearchParams({ q: q + " prefer:usd-low", unique: "cards", order: "edhrec" }));
      for (const c of r.data || []) cacheCard(c);
    } catch {}
  }
  for (const b of colors.map((c) => ({ W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" })[c]).filter(Boolean)) await resolve(b).catch(() => {});
  saveCatalogSoon();
  poolCache.add(key);
}
// app.js loadCandidates (7013-7058), verbatim.
async function loadCandidates(d, cap, progress) {
  if (!d.commander) throw Error("Choose this deck’s commander first.");
  const comm = await resolve(d.commander, true);
  if (!commanderEligible(comm)) throw Error("Pick a valid single commander first (⋯ → re-import, or start a new deck).");
  const ci = (comm.color_identity || []).join("").toLowerCase() || "c",
    theme = commanderTheme(comm),
    base = `game:paper legal:commander id<=${ci}${cap === Infinity ? "" : ` usd<=${Math.max(0.25, cap)}`}`,
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
      const r = await api("/cards/search?" + new URLSearchParams({ q: `${base} ${q} prefer:usd-low`, unique: "cards", order: label.startsWith("budget") ? "usd" : "edhrec", dir:"asc" }));
      for (const c of r.data.slice(0, label.startsWith("budget") ? 140 : 60)) {
        cacheCard(c);
        loaded++;
      }
    } catch {
      failed++;
    }
  }
  const basics = [];
  for (const name of (comm.color_identity?.length ? comm.color_identity : ["C"]).map(c => ({ W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" })[c])) {
    let card = null, lookupFailed = false;
    progress(`Checking ${name} data and price…`);
    try { card = await resolve(name); } catch { lookupFailed = true; }
    try {
      const { card: priced } = await findCheapestPrinting(name, { api, reference: card, format: "commander", basicOnly: true });
      if (priced && (!card || cardPrice(card) === null || cardPrice(priced) < cardPrice(card) || card.legalities?.commander !== "legal")) { card = cacheCard(priced); loaded++; }
      lookupFailed = false;
    } catch { lookupFailed = true; }
    if (lookupFailed) failed++;
    basics.push({ name, loaded: !!card, priced: priceOf(name) !== null, price: priceOf(name), lookupFailed });
  }
  return { loaded, failed, basics };
}
// app.js library (7237): what a hand is drawn from (the commander stays out).
const mtgLibrary = (d) => d.cards.filter((c) => !hasCommander(d) || key(c.name) !== key(d.commander));
const MDECK_ACTS = {
  ...TDECK_ACTS,
  // Upgrade lab's Compare budget builds (app.js A.optimizeMtgDeck): the Build decks sheet over the tab (mbuildOpen).
  optimizeMtgDeck: () => tcgPanelAsync(() => optimizeMtgDeck()),
  // Versions (app.js C.verA / C.verB 7214): the two lists compared.
  'C.verA': t => { S.ui.versions.a = t.value; panel.redraw(); },
  'C.verB': t => { S.ui.versions.b = t.value; panel.redraw(); },
  // War Chest's Draw a hand (app.js A.draw7, A.mull, A.drawOne 7238-7253), verbatim but for render().
  draw7: () => { const d = currentDeck(); S.ui.hand = { ...drawHand(mtgLibrary(d)), deckId: d.id, mulls: 0 }; panel.redraw(); },
  mull: () => { const d = currentDeck(), m = (S.ui.hand?.mulls || 0) + 1; S.ui.hand = { ...drawHand(mtgLibrary(d)), deckId: d.id, mulls: m }; panel.redraw(); },
  drawOne: () => { const h = S.ui.hand; if (h?.library.length) h.hand.push(h.library.shift()); panel.redraw(); },
  // The life tracker (app.js A.lifeStart, A.lifeTurn, A.lifeAdj 7262-7280), verbatim but for render().
  lifeStart: t => { S.ui.life = newGame(Number(t.dataset.n) || 4, formatOf(currentDeck()).life); panel.redraw(); },
  lifeTurn: t => { const g = S.ui.life; if (g) g.turn = Math.max(1, g.turn + Number(t.dataset.delta)); panel.redraw(); },
  lifeAdj: t => {
    const pl = S.ui.life?.players[Number(t.dataset.i)]; if (!pl) return;
    const field = t.dataset.field, delta = Number(t.dataset.delta), before = pl[field];
    pl[field] = field === "life" ? before + delta : Math.max(0, before + delta);
    if (field === "cmd") pl.life -= pl.cmd - before;
    panel.redraw();
  },
  // Saves go to the app's writes (restoreVer, deleteVer, deleteNote, logGame; snapshot asks for a name there first).
  // app.js C.lifeName (7282): a player's name as typed (24 at most, kept when cleared).
  'C.lifeName': t => { const pl = S.ui.life?.players[Number(t.dataset.i)]; if (pl) pl.name = t.value.trim().slice(0, 24) || pl.name; },
  // app.js A.lifeEnd (7286): asked first (the app asks, then panelDone('lifeEnd')).
  lifeEnd: () => { panel.acted = {act: 'lifeEnd', data: {question: "End this game without logging it?"}}; },
  // app.js chestTool's goldfish for Magic: the deck's Power tab (A.deckTab engine).
  chestTool: t => { if (t.dataset.tool === 'goldfish') { panel.acted = {act: 'tDeckTab', data: {id: 'engine'}}; return; } TDECK_ACTS.chestTool(t); },
  snapshot: () => { panel.acted = {act: 'snapshot', data: {version: "Version " + ((currentDeck()?.versions || []).length + 1)}}; },
  logGame: () => { const v = q => panel.doc.querySelector(q)?.value ?? '';
    panel.acted = {act: 'logGame', data: {result: v('#logResult'), turn: v('#logTurn'), note: v('#logNote')}}; },
  muRun: () => { mtgMuRun(); },
  // The coach on the Power page (app.js A.coachRedeal, A.amPick, A.coachSwap): another opening hand; an opponent's read opened under
  // its row (the website opens its matchup sheet; here it reads in place, from the same simulation); a swap saved by the app's write.
  coachRedeal: t => { redealCoachHand(t.dataset.ai); panel.redraw(); },
  amPick: t => { const d = currentDeck(); if (!d) return; const st = muState(d); st.read = st.read === t.dataset.name ? null : t.dataset.name; panel.redraw(); },
  coachSwap: t => { panel.acted = {act: 'coachSwap', data: {cut: t.dataset.cut, add: t.dataset.add}}; },
  // app.js A.suggestFormatUpgrades (4141-4149), verbatim but for render().
  suggestFormatUpgrades: () => { (async () => {
    const d=currentDeck(),B=S.ui.build,f=formatOf(d);if(B.busy)return;
    B.busy=true;B.fillDeck=d.id;B.msg="Finding same-role, lower-cost spells…";panel.redraw();
    try{await resolveNames(d.cards.map(r=>r.name));const seeds=d.cards.map(r=>meta(r.name)).filter(c=>c&&!isLand(c));const colors=[...new Set(seeds.flatMap(c=>c.color_identity||[]))];
    await loadFormatPool(f,colors.length?colors:["C"],seeds[0],m=>{B.msg=m;});
    B.formatSwaps=formatUpgrades(d,S.catalog,{budget:Number.isFinite(Number(d.budget))?Number(d.budget):25,available:deckAvailability(),price:c=>priceOf(c.name),evaluate:next=>mtgPower(next)});B.swapSignature=JSON.stringify(d.cards);
    B.msg=B.formatSwaps.length?"Review each trade-off. Applying one swap preserves your card count and saves the previous version.":"No conservative same-role swaps found. Try a wider card pool; a lower mana value alone does not prove an upgrade.";
    }catch(e){B.msg=e.message;}finally{B.busy=false;panel.redraw();}
  })(); },
  // app.js A.applyFormatUpgrade (4151-4155): one copy swapped, the list before it kept in Versions.
  applyFormatUpgrade: t => { (async () => {
    const B=S.ui.build,d=currentDeck(),swap=B.formatSwaps?.[Number(t.dataset.i)];
    if(!swap||B.fillDeck!==d.id||B.swapSignature!==JSON.stringify(d.cards)){toasts.push({text:"Your deck changed. Refresh suggestions first.",undo:false});return;}
    const cards=applyFormatSwap(d,swap,S.catalog);await editDeckOf(d.id)(d=>withSnapshot({...withSnapshot(d,"Before suggested swap"),cards},"Reviewed spell swap"),{msg:"One card in, one card out. Previous list saved in Versions."});B.formatSwaps=null;panel.redraw();
  })().catch(e => toasts.push({text: e.message, undo: false})); },
  // app.js A.upRun (7121-7163), verbatim but for render() and the #upMsg line (the tab drawn again shows U.msg).
  upRun: () => { (async () => {
    const U = S.ui.upgrade, d = currentDeck();
    if (U.busy) return;
    U.busy = true; U.deckId = d.id; U.plans = {}; U.selected = new Set();
    panel.redraw();
    const msg = (m) => { U.msg = m; };
    try {
      const r = await resolveNames([...d.cards.map((c) => c.name), ...S.state.collection.map((c) => c.name)], msg);
      const unresolved = d.cards.filter((c) => !meta(c.name));
      if (unresolved.length) throw Error("Fix unrecognized cards first: " + unresolved.slice(0, 3).map((c) => c.name).join(", "));
      const c = await loadCandidates(d, Math.max(50, U.budget), msg);
      const basePower=mtgPower(d);
      for (const b of [...new Set([0, 10, 25, 50, 100, U.budget])]) {
        const plan = upgradeSuggestions(d, S.state.collection, S.state.decks, S.catalog, { budget: b, simple: U.simple, maxSwaps: 8 });
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
      panel.redraw();
    }
  })(); },
};
// views.js deckPage with [tab] open: its .deck-body becomes the panel, fresh each time the tab opens (A.deckTab draws the page again).
function mtgDeckPanel(id, tab) {
  mtgFocus(); deckOpen(id); S.ui.deckTab = tab;
  const d = (S.state.decks || []).find(x => String(x.id) === String(id)), key = ['deck', 'mtg', id, tab, d?.format || ''].join('|');
  panel = null;
  // "Pick any other deck" (A.amOpen) is the website's matchup sheet: left out here until the app has its own picker.
  const body = () => { const box = new SiteDocument().createElement('div'); box.innerHTML = deckView(); const page = box.querySelector('.deck-body'); for (const x of [...(page?.querySelectorAll('[data-act="amOpen"]') || [])]) x.remove(); return page?.innerHTML || ''; };
  const attach = host => PANEL_ATTACH[tab]?.(host);
  panelOpen(key, body(), attach, MDECK_ACTS);
  panel.redraw = () => { mtgFocus(); deckOpen(id); S.ui.deckTab = tab; panelRun(() => { panel.host.innerHTML = body(); attach(panel.host); }); };
}

// ---- A Play deck's Power tab (Randall's card 6 Nov 18:53Z: "Power tab, Play-safe"): views.js deckPage's Power view (powerHub) for a
// Play deck, drawn as the Collection draws it but for a deck that never joins the Collection: the deck stands in S.state.decks only
// while the page is drawn or one of its taps runs (synchronously, so no save can see it), and the Upgrades card is left out, since
// its swaps read the Collection and its builds carry prices. Play stays price-free.
const PLAY_POWER_ID = 'play-power';
let playDeck = null;
function withPlayDeck(f) {
  if (!playDeck) return f();
  const keep = S.state.decks, was = S.ui.deckId;
  S.state.decks = [...(keep || []).filter(x => x.id !== PLAY_POWER_ID), playDeck]; S.ui.deckId = PLAY_POWER_ID;
  try { return f(); } finally { S.state.decks = keep; S.ui.deckId = was; }
}
function playPowerBody() {
  return withPlayDeck(() => {
    mtgFocus(); S.ui.deckTab = 'engine';
    const box = new SiteDocument().createElement('div'); box.innerHTML = deckView();
    const body = box.querySelector('.deck-body'); if (!body) return '';
    for (const card of [...body.querySelectorAll('.pwp-card')]) if (card.querySelector('h3')?.textContent.trim() === 'Upgrades') card.remove();
    for (const x of [...body.querySelectorAll('[data-act="amOpen"]')]) x.remove();
    return body.innerHTML;
  });
}
function playPowerPanel(json) {
  const o = JSON.parse(json), rows = (o.cards || []).filter(r => r?.name && !r.board);
  const lead = (o.cards || []).find(r => r?.board === 'commander');
  playDeck = {id: PLAY_POWER_ID, name: o.name || 'Play deck', format: o.format || 'Standard', cards: rows.map(r => ({name: r.name, qty: Number(r.qty) || 1})),
    ...(lead ? {commander: lead.name} : {}), results: []};
  const key = 'playpower|' + (o.format || '') + '|' + JSON.stringify(playDeck.cards) + '|' + (lead?.name || '');
  if (panel?.key === key) return;
  panel = null;
  const acts = Object.fromEntries(Object.entries(MDECK_ACTS).map(([k, f]) => [k, (...a) => withPlayDeck(() => f(...a))]));
  panelOpen(key, playPowerBody(), host => PANEL_ATTACH.engine?.(host), acts);
  const mine = panel;
  panel.redraw = () => { if (panel !== mine) return; panelRun(() => { panel.host.innerHTML = playPowerBody(); PANEL_ATTACH.engine?.(panel.host); }); };
  // Cards the Collection has never seen load first (app.js refreshDeck), then the page is drawn again with them counted.
  const names = playDeck.cards.map(r => r.name).concat(lead ? [lead.name] : []).filter(n => !meta(n));
  if (names.length) resolveNames(names, () => {}, false, () => panel === mine).then(() => mine.redraw()).catch(() => {});
}

// ---- The Rules page (app.js route #rules: rulesPage with S.ui.rules[g]) as a panel of the site's markup, its interactive rules attached
// (attachRuleLearning) and A.rulesList ported verbatim (render() is the page drawn again; T = tcg.js). How to play · keywords
// (A.learnGame: learnSheet) is a panel of its own; Tabletop, Ask a Judge, a banned card's page and the official documents go to the app.
function rulesBody(g) { const R = ((S.ui.rules ||= {})[g] ||= {list: '', busy: false, error: '', data: {}}); return rulesPage(g, R); }
const RULES_ACTS = {
  async rulesList(t) {
    const mine = panel, render = () => mine.redraw();
    const T = TcgAll;
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
      if (panel === mine) render();
    }
  },
};
function rulesPagePanel(g) {
  if (g === 'mtg') mtgFocus(); else tcgFocus(g, 'rules');
  const key = 'rulespage|' + g;
  if (panel?.key === key) return;
  panel = null;
  panelOpen(key, rulesBody(g), host => attachRuleLearning(host), RULES_ACTS);
  const mine = panel;
  panel.redraw = () => { if (panel !== mine) return; if (g === 'mtg') mtgFocus(); else tcgFocus(g, 'rules'); panelRun(() => { panel.host.innerHTML = rulesBody(g); attachRuleLearning(panel.host); }); };
}
// A.learnGame: learnSheet (Learn <game>, the interactive rules, Formats & official rules) as a panel.
function learnPanel(g) {
  const key = 'learn|' + g;
  if (panel?.key === key) return;
  panel = null;
  panelOpen(key, learnSheet(g), host => attachRuleLearning(host));
}

// ---- The Wiki page (app.js route #wiki[/<topic>[/search]]: V.wikiPage(controller.state), the game's createMtgWikiPageController
// routed before the draw and mounted after it) as a panel of the site's markup. The controller's navigate is app.js go('#wiki/…'):
// here it goes to the app (acted wikiRoute), which keeps the history and opens the route (wikiPage) as go() would. Its data-acts are
// app.js A.mtgWikiPick / mtgWikiHome / mtgWikiRetry / mtgWikiDailyRetry / mtgWikiCancel; Ask about this (A.mtgWikiAsk) goes to the
// app with the words it would ask about. An article's card links (card, wikiCard, wikiCards) and source decks (wikiDeck) go to the app.
const wikiPages = {};
function wikiCtrl(g) {
  const key = 'wiki|' + g;
  return wikiPages[g] ||= createMtgWikiPageController({game: g, active: () => panel?.key === key, root: () => panel?.key === key ? panel.host : null,
    navigate: (topic, {query = false} = {}) => { if (panel?.key === key) panel.acted = {act: 'wikiRoute', data: {topic: topic || '', query: query ? 'true' : ''}}; return true; }});
}
const WIKI_ACTS = g => ({
  mtgWikiPick: t => wikiCtrl(g).lookup(t.dataset.wikiTopic),
  mtgWikiHome: () => wikiCtrl(g).home(),
  mtgWikiRetry: () => wikiCtrl(g).retry(),
  mtgWikiDailyRetry: () => wikiCtrl(g).daily(true),
  mtgWikiCancel: () => wikiCtrl(g).cancelLookup(),
  mtgWikiAsk: () => { panel.acted = {act: 'mtgWikiAsk', data: {text: panel.doc.querySelector('#wikiQ')?.value.trim() || wikiCtrl(g).state.topic || ''}}; },
});
function wikiPagePanel(g, topic, query) {
  const key = 'wiki|' + g, c = wikiCtrl(g);
  if (panel?.key !== key) {
    // app.js render(): a controller not on screen stops its lookups.
    for (const [k, x] of Object.entries(wikiPages)) if (k !== g) x.cancel();
    panel = null;
    panelOpen(key, '', null, WIKI_ACTS(g));
    const mine = panel;
    panel.redraw = () => { if (panel !== mine) return; panelRun(() => { panel.host.innerHTML = mtgWikiPageMarkup(c.state); c.mount(); }); };
  }
  panelRun(() => c.route(topic || '', {query: !!query}));
  panel.redraw();
}

// ---- The Scan page (app.js route #scan: scancam.js scanView with S.ui.scan) as a panel of the site's markup, run by the site's own
// handlers: registerScanner(scanCtx) with app.js's scanCtx (7329–7486) below. Its A / C / I are this panel's acts; render() draws the
// panel again and then runs ctx.afterRender, as app.js render() does (setTimeout 0). A sheet it opens (Scanner settings) is in the
// panel's page (#sheet); the printing picker goes to the app (acted). The camera and the text reader are the app's, not a browser's.
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
        s.printings ||= {};
        s.printings[c.id] = slim({ ...c, conditionQuotes: c.conditionQuotes || s.printings[c.id]?.conditionQuotes });
        addScannedEntry(s, "mtg", { id: uid(), scanCaptureId: captureId, name: c.name, qty: it.qty, set: c.set.toUpperCase(), setName: c.set_name, collectorNumber: c.collector_number, finish: it.finish, language: it.lang || c.lang || "en", condition: it.condition || "Near Mint", location: it.location || "", reserved: 0, printingId: c.id, oracleId: c.oracle_id, printingVerified: !!(it.cand.exact || it.cand.printingConfirmed), nameVerified: true, raw: { acquisition: "Scanned" } });
      }
    },
    { undo: `Added ${n} scanned card${n === 1 ? "" : "s"}.` },
  );
}
const mtgScanPrice = (cand, finish, selection = {}) => {
  const card=cand.card,p=card?.prices||{},v=finish==="foil"?p.usd_foil:finish==="etched"?p.usd_etched:p.usd;
  return conditionValue(v==null||v===""?null:Number(v),{...selection,printingId:card?.id||"",finish},card?.conditionQuotes||[]).price;
};
const SA = {}, SC = {}, SI = {};
let scanOn = false;
const scanRender = () => { if (!panel?.scan) return; const mine = panel; panel.redraw(); Promise.resolve().then(() => { if (panel === mine) panelRun(() => scanCtx.afterRender?.()); }); };
const scanCtx = {
  A: SA,
  C: SC,
  I: SI,
  // A sheet the scanner opens (Scanner settings): its markup and context go to the app with the panel, which shows it over the page.
  // index.html's <dialog id="sheet" class="sheet"><div id="sheetBody"> (app.js openSheet), in the panel's page after its body: the
  // app draws it over the page; its taps and changes reach the scanner's handlers like the page's.
  openSheet: (html, c = null) => { if (!panel?.scan) return; S.ui.sheetCtx = c; panelRun(() => {
    let d = panel.doc.getElementById('sheet');
    if (!d) { d = panel.doc.createElement('dialog'); d.id = 'sheet'; d.className = 'sheet'; d.setAttribute('aria-label', 'Details'); d.innerHTML = '<div id="sheetBody" data-audit-scroll></div>'; panel.doc.body.append(d); }
    d.setAttribute('open', ''); panel.doc.getElementById('sheetBody').innerHTML = html; }); },
  closeSheet: () => { S.ui.sheetCtx = null; if (panel?.scan) panelRun(() => panel.doc.getElementById('sheet')?.remove()); },
  addMany: (g, items) => (g === "mtg" ? mtgScanAddMany(items) : tcgCtx.scanAddMany(items, g)),
  priceOf: (g, cand, finish, selection = {}) => (g === "mtg" ? mtgScanPrice(cand, finish, selection) : tcgCtx.scanPrice?.(cand, finish, selection) ?? null),
  requestConditionPrice: (g,cand,finish,selection,done,current,options={}) => {
    const card=cand.card;
    if(!card||!finish||cand.localReference||cand.detailsOnly||!(cand.exact||cand.printingConfirmed))return {status:'deferred',reason:'unverified-selection',notice:'Confirm the exact printing before checking its condition price.'};
    const [printing,rarity]=String(cand.print||'').split('|');
    const entry=g==='mtg'?{...selection,printingId:card.id,printingVerified:true,finish}:
      {...selection,cardId:card.id,...(g==='ptcg'?{variant:finish}:{printing:printing||'',rarity:rarity||'',edition:finish,setReleaseId:cand.setReleaseId||'',setReleaseUnverified:!!cand.setReleaseUnverified})};
    return fetchConditionValue(card,entry,g,done,{source:'review',current,retry:!!options.retry});
  },
  // app.js scannerPrintingPicker.open (the printing picker sheet): the app's printing picker, asked for with the config.
  openPrintingPicker: config => { if (panel?.scan) panel.acted = {act: 'scanPrintingPicker', data: {game: config?.game || '', name: config?.name || config?.card?.name || ''}}; return Promise.resolve(null); },
  inlinePrinting: true,
  setOf: (g, cand) => (g === "mtg" ? cand.card?.set || "" : g === "ygo" ? String(cand.print || "").split("|")[0].split("-")[0] : cand.card?.set?.id || ""),
  numberOf: (g, cand) => (g === "mtg" ? cand.card?.collector_number || "" : g === "ygo" ? String(cand.print || "").split("|")[0] : cand.card?.set?.number || ""),
  render: () => scanRender(),
  toast: (m) => { if (m) toasts.push({text: String(m), undo: false}); },
  game: () => tcgGame() || 'mtg',
  match: (g, read, lang, manual, status, prefs = {}, control = null) => (g === "mtg" ? mtgScanMatch(read, lang, manual, prefs, control) : tcgCtx.scanMatch(read, lang, manual, status, g, control)),
  add: (g, c) => (g === "mtg" ? mtgScanAdd(c) : tcgCtx.scanAdd(c)),
  byText: (g, full) => (g === "mtg" ? mtgScanByText(textPhrases(full, 12), full) : tcgCtx.scanByText?.(g, full) ?? []),
  printings: (g, cand) => (g === "mtg" ? mtgScanPrintings(cand) : tcgCtx.scanPrintings?.(g, cand) ?? []),
  candById: async (g, id, why, exact, options = {}) => (g === "mtg" ? api("/cards/" + encodeURIComponent(id), {signal:options.signal}).then((c) => mtgScanCand(c, why, exact)).catch(() => null) : tcgCtx.scanCandById?.(g, id, why, exact, options) ?? null),
  candOf: async (g, p, why, exact) => (g === "mtg" ? (p.card ? mtgScanCand(p.card, why, exact) : null) : tcgCtx.scanCandById?.(g, p.id, why, exact) ?? null),
  // A card's page: the app opens it (acted card / tCard).
  details: (g, c) => { if (panel?.scan) panel.acted = g === "mtg" ? {act: 'card', data: {name: c.name}} : {act: 'tCard', data: {id: c.id, game: g}}; },
};
scanCtx.aiAccount=()=>!!cloudInfo().user;
scanCtx.rememberLocation=(g,name,{createBinder=false}={})=>commit(s=>{rememberLocation(s,g,name,{createBinder});},{rerender:false});
scanCtx.lookupCandidates=createScannerLookup({requestMagic:api,sources:tcgSources,candById:scanCtx.candById,match:scanCtx.match});
function scanReady() { if (scanOn) return; scanOn = true; tcgReady(); registerScanner(scanCtx); }
// [state]: what S.ui.scan holds for the screen shown (camera on, the review of a capture…), for the shots; [card]: a Magic card whose
// Scryfall card is the review's candidate (mtgScanCand).
function scanPanel(g, state = {}, card = '') {
  scanReady();
  if (g === 'mtg') mtgFocus(); else tcgFocus(g, 'scan');
  S.ui.view = 'scan';
  S.ui.scan = {mode: 'live', cands: [], ...(S.ui.scan || {}), ...state};
  const name = {mtg: 'Magic', ptcg: 'Pokémon', ygo: 'Yu-Gi-Oh!'}[g];
  panel = null;
  const acts = {};
  for (const [k, f] of Object.entries(SA)) acts[k] = (t, e) => f(t, e);
  for (const [k, f] of Object.entries(SC)) acts['C.' + k] = (t, e) => f(t, e);
  for (const [k, f] of Object.entries(SI)) acts['I.' + k] = (t, e) => f(t, e);
  // app.js A.closeSheet: the sheet's ✕.
  acts.closeSheet = () => scanCtx.closeSheet();
  panelOpen('scan|' + g, scanView(g, name), null, acts);
  const mine = panel; mine.scan = g;
  panel.redraw = () => { if (panel !== mine) return; panelRun(() => { panel.host.innerHTML = scanView(g, name); }); };
  if (card && g === 'mtg') api('/cards/named?' + new URLSearchParams({exact: card})).then(c => {
    S.ui.scan.cands = [mtgScanCand(c, 'Set ' + c.set.toUpperCase() + ' #' + c.collector_number, true)];
    mine.redraw();
  }).catch(e => toasts.push({text: e.message, undo: false}));
  Promise.resolve().then(() => { if (panel === mine) panelRun(() => scanCtx.afterRender?.()); });
}

// ---- Collection › Decks › Ideas (views.js decks() / tcg.js tcgDecks() with S.ui.decksTab = 'ideas'): the tab's body, everything after
// .random-tools, as a panel of the site's markup run by the site's handlers (app.js's "Ideas, references, precons" block, ported below
// verbatim with render() being the panel drawn again). The head, tabs and tools are Collection.decks(game, {tab}).
// What the site leaves to a sheet or another page goes to the app (acted): openIdea / saveIdea (the idea sheet, Collection.ideaSheet),
// importCollection, loadExample (writeActs.loadExample), go, decksTab, and Yu-Gi-Oh! / Pokémon's tCard, tImportColl, tBuildAuto,
// tPickSeeds, tBuildMulti and tMetaDeck.
const $ideas = sel => (panel?.decks === 'mtg' ? panel.doc.querySelector(sel) : null);
const ideasRender = () => { if (panel?.decks === 'mtg' && panel.tab === 'ideas') panel.redraw(); };
// app.js buildIdeas (6649), verbatim but for render().
function buildIdeas() {
  const I2 = S.ui.ideas;
  try {
    I2.cache = collectionIdeas(S.state.collection, S.state.decks, S.catalog, { includeUnowned: !I2.ownedOnly });
    if (!I2.cache.length && S.state.collection.length)
      I2.msg = S.state.collection.some((e) => !meta(e.name)) ? "Some cards have no card data yet — tap Analyze to load them." : "No legendary creatures in your collection yet. Untick “Owned commanders only” to include ones you’ve looked up.";
  } catch (e) {
    I2.msg = e.message;
  }
  ideasRender();
}
const IA = {};
// app.js A.analyze (6660), verbatim but for render() and $(): the status line is the panel's #ideasMsg. The names it corrects are
// saved as the site's commit saves them (the app writes them to the device and the account once the tap settles: bgSaves).
IA.analyze = async () => {
  const I2 = S.ui.ideas;
  if (I2.busy) return;
  I2.busy = true;
  ideasRender();
  try {
    const r = await resolveNames(S.state.collection.map((e) => e.name), (m) => {
      I2.msg = m;
      const el = $ideas("#ideasMsg") || $ideas(".muted.small[role=status]");
      if (el) el.textContent = m;
    });
    await commit((s) => {
      for (const e of s.collection) if (r.matched.has(key(e.name))) Object.assign(e, { name: r.matched.get(key(e.name)), nameVerified: true });
    }, { rerender: false });
    bgSaves++;
    I2.msg = `${new Set(S.state.collection.map((e) => key(e.name))).size - r.failed.length} card names have data${r.failed.length ? ` · ${r.failed.length} not found` : ""}.`;
    I2.busy = false;
    buildIdeas();
  } finally {
    I2.busy = false;
    ideasRender();
  }
};
const DECKS_ACTS = {
  // app.js's dispatcher toasts a failed A.analyze; it lands after the click, so it goes to the panel that started it (when still open).
  analyze: () => { const p = panel; IA.analyze().catch(e => { const t = {text: e?.message || String(e), undo: false}; if (panel === p && p) p.toasts.push(t); else toasts.push(t); }); },
  // app.js C.ideasOwned, C.ideaFilter, A.ideasMore (6683-6694).
  'C.ideasOwned': (t) => {
    S.ui.ideas.ownedOnly = t.checked;
    buildIdeas();
  },
  'C.ideaFilter': (t) => {
    S.ui.ideas.filter = t.value;
    ideasRender();
  },
  ideasMore: () => {
    S.ui.ideas.limit += 12;
    ideasRender();
  },
  // app.js A.openIdea and A.saveIdea (6710, 6846): the selection starts empty and the sheet opens (the app's IdeaSheet); Save as deck
  // says what to check first.
  openIdea: t => { S.ui.ideas.sel = new Set(); panel.acted = {act: 'openIdea', data: {i: String(Number(t.dataset.i))}}; },
  saveIdea: t => { S.ui.ideas.sel = new Set(); panel.acted = {act: 'openIdea', data: {i: String(Number(t.dataset.i))}};
    toasts.push({text: "Review the card count and warnings before saving this list. Incomplete lists are saved only as drafts.", undo: false}); },
  // tcg.js's Ideas: Tournament decks you're closest to's Try again (A.tMetaRefresh), its own panel kept while it loads.
  tMetaRefresh: t => tcgPanelAsync(() => TA.tMetaRefresh(t)),
  // tcg.js's Build from my cards: ⚒ Use my whole collection (A.tBuildAuto) and an archetype's ⚒ Build (A.tBuildMulti) end in
  // openDeckFlow (acted, the app's Build a deck); ☑ Pick cards to build around (A.tPickSeeds) is the app's sheet (Collection.seedPick).
  tBuildAuto: t => { flowAskPanel = panel; return tcgPanelAsync(() => TA.tBuildAuto(t)); },
  tBuildMulti: t => { flowAskPanel = panel; return tcgPanelAsync(() => TA.tBuildMulti(t)); },
  tPickSeeds: () => { panel.acted = {act: 'tPickSeeds', data: {game: panel.decks}}; },
};
// ---- Collection › Decks › Meta decks (views.js inspirationView for Magic, tcg.js metaView for Yu-Gi-Oh! and Pokémon): the tab's body
// as a panel (decksPanel with 'inspiration'), run by app.js's / tcg.js's own handlers below, render() being the panel drawn again.
// A tournament deck opens the sheet the app draws (MetaDeckSheet, Collection.provenModel); what the site leaves to another page or
// sheet goes to the app (acted): Magic's Save a deck idea, Export, Remove, the precon list and its Preview, a card (card / tCard /
// tOtherPrintings), Yu-Gi-Oh! / Pokémon's Create a <format> deck (tNewDeck).
const metaRender = () => { if (panel?.decks === 'mtg' && panel.tab === 'inspiration') panel.redraw(); };
// app.js mtgMetaFormat / loadMtgMeta (6858-6872), verbatim but for render() and navigationStamp (the panel open is the screen).
const mtgMetaFormat = () => (S.ui.mtgMeta ||= { format: DEFAULT_MTG_META_FORMAT }).format;
function loadMtgMeta(force = false) {
  const screen = panel, key = "mtg:" + mtgMetaFormat(),
    M = metaState(key);
  const current = () => panel === screen;
  if (M.busy || (!force && (M.data || M.error) && (M.data ? Date.now() - M.at < 12 * 3600e3 : true))) return;
  loadMeta(key, force)
    .then(async (data) => {
      if (current()) metaRender();
      // Card data (prices, art, types) for the lists on screen.
      const names = [...new Set(data.decks.slice(0, 30).flatMap((d) => [...d.commanders, ...d.main].map((r) => r.name)))];
      if ((await resolveNames(names)).total && current()) metaRender();
    })
    .catch(() => current() && metaRender());
  setTimeout(() => current() && metaRender(), 0);
}
// app.js readRecord / writeRecord for the checked precons ('cardforge-precons-v1'): the site keeps them in IndexedDB; here they are
// the bundle's kept storage (KEPT_KEYS), which the app keeps on the device.
const readRecord = async (k) => { try { return JSON.parse(globalThis.localStorage.getItem(k) || 'null'); } catch { return null; } };
const writeRecord = async (k, v) => { globalThis.localStorage.setItem(k, JSON.stringify(v)); };
// app.js loadPreconCache (759-775), verbatim but for render().
const PRECON_RECORD = "cardforge-precons-v1";
async function loadPreconCache() {
  const F = S.ui.finder, screen = panel;
  F.cacheLoaded = true;
  try {
    const rec = await readRecord(PRECON_RECORD);
    if (rec?.decks?.length) {
      F.precons = rec.decks;
      if (panel === screen) metaRender();
      const names = rec.decks.flatMap((d) => d.cards.map((c) => c.name)).filter((n) => !meta(n));
      if (names.length && (globalThis.navigator?.onLine ?? true)) {
        await resolveNames(names);
        if (panel === screen) metaRender();
      }
    }
  } catch {}
}
// app.js fetchJSON (6966).
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
// What a deck sheet's save or Make my version leaves for the app to open (app.js go("#deck/<id>/cards")).
const goDeck = (id) => { if (panel) panel.acted = {act: 'go', data: {to: `#deck/${id}/cards`}}; };
// app.js A.copyRef (6946), verbatim but for go().
async function copyRef(t) {
  const r = S.state.references.find((x) => x.id === t.dataset.id),
    d = withSnapshot({ ...structuredClone(r), id: uid(), name: r.name + " · my version", locked: false, versions: [] }, "From " + (r.source?.author || r.source?.website || "inspiration"));
  await commit((s) => {
    s.decks.push(d);
    s.activeDeck = d.id;
  });
  bgSaves++;
  goDeck(d.id);
}
// app.js preconCredit / makeMyVersion (4438-4446), verbatim but for go().
const preconCredit = (p) => sourceCredit({ url: "https://mtgjson.com/api/v5/decks/" + p.file, author: "Wizards of the Coast", kind: "MTGJSON precon", description: "Preconstructed deck list from MTGJSON." });
async function makeMyVersion(base, source, label) {
  const d = withSnapshot({ id: uid(), name: base.name + " · my version", format: base.format || "Commander", commander: base.commander || "", strategy: base.strategy || "Auto", budget: base.budget ?? S.state.settings.budget ?? 25, locked: false, about: base.about || "", source, cards: base.cards.map((c) => ({ name: c.name, qty: c.qty })), versions: [] }, label);
  await commit((s) => {
    s.decks.push(d);
    s.activeDeck = d.id;
  }, { msg: "Your version is ready. Your collection is unchanged." });
  bgSaves++;
  goDeck(d.id);
}
// A tap that saves or loads after it returns: what it toasts goes with the panel that started it.
const panelLater = (f) => { const p = panel; Promise.resolve().then(f).catch(e => { const t = {text: e?.message || String(e), undo: false}; if (panel === p && p) p.toasts.push(t); else toasts.push(t); }); };
Object.assign(DECKS_ACTS, {
  // app.js A.mtgMetaFormat / A.mtgMetaReload (6873-6878).
  mtgMetaFormat: (t) => {
    S.ui.mtgMeta = { format: t.dataset.id };
    metaRender();
    loadMtgMeta();
  },
  mtgMetaReload: () => loadMtgMeta(true),
  // app.js A.mtgProven: the tournament deck's sheet (the app's MetaDeckSheet).
  mtgProven: (t) => { provenOpened = false; mtgProven(t); if (provenOpened) panel.acted = {act: 'proven', data: {}}; },
  // tcg.js A.tMetaFormat (3915): its load (c.loadMeta, when the format has a feed) keeps this panel and draws it as it ends.
  tMetaFormat: (t) => {
    tcgFocus(panel.decks, 'decks');
    const was = tcgCtx.loadMeta; let p = null;
    tcgCtx.loadMeta = (...a) => (p = was(...a));
    try { TA.tMetaFormat(t); } finally { tcgCtx.loadMeta = was; }
    if (p) tcgPanelAsync(() => p); else panel.redraw();
  },
  tMetaRefresh: t => { tcgFocus(panel.decks, 'decks'); return tcgPanelAsync(() => TA.tMetaRefresh(t)); },
  // tcg.js A.tMetaDeck (4151): the sheet, as Magic's.
  tMetaDeck: (t) => { tcgFocus(panel.decks, 'decks'); provenOpened = false; provenRun(() => TA.tMetaDeck(t)); if (provenOpened) panel.acted = {act: 'proven', data: {}}; },
  // app.js's finder (4349-4372, 4375-4469), verbatim but for render().
  'C.finderMax': (t) => {
    S.ui.finder.max = t.value === "" ? "" : String(Math.max(0, Number(t.value) || 0));
    metaRender();
  },
  'C.finderColors': (t) => {
    S.ui.finder.colors = t.value;
    metaRender();
  },
  'C.finderBasics': (t) => {
    S.ui.finder.basics = t.checked;
    metaRender();
  },
  'C.finderSort': (t) => {
    S.ui.finder.sort = t.value;
    metaRender();
  },
  'I.finderSearch': (t) => {
    S.ui.finder.q = t.value;
    metaRender();
  },
  finderMore: () => {
    S.ui.finder.limit += 12;
    metaRender();
  },
  // A.finderPrecons (Commander precons; Play's constructed check is not on this page).
  finderPrecons: () => panelLater(async () => {
    const F = S.ui.finder,
      P = S.ui.precon;
    if (F.busy) return;
    F.busy = true;
    F.msg = "Loading the precon list…";
    metaRender();
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
        metaRender();
        try {
          const p = mtgjsonDeck(await fetchJSON("https://mtgjson.com/api/v5/decks/" + d.fileName.replace(/\.json$/, "") + ".json"));
          F.precons.push({ file: d.fileName, name: p.name || d.name, commander: p.commander, ...(p.multipleCommanders ? { commanders: p.commanders.map((name) => ({ name, qty: 1 })) } : {}), released: d.releaseDate || "", format: "Commander", cards: p.cards.map((c) => ({ name: c.name, qty: c.qty })) });
        } catch {}
      }
      F.msg = "Loading prices…";
      metaRender();
      await resolveNames(F.precons.flatMap((p) => p.cards.map((c) => c.name)));
      await writeRecord(PRECON_RECORD, { at: new Date().toISOString(), decks: F.precons }).catch(() => {});
      F.msg = next.length ? `${F.precons.length} precons checked` : F.msg;
    } catch (e) {
      F.msg = "Couldn’t reach MTGJSON (" + e.message + ")";
    } finally {
      F.busy = false;
      metaRender();
    }
  }),
  finderBuild: (t) => panelLater(async () => {
    if (t.dataset.kind === "saved") return copyRef(t);
    const p = S.ui.finder.precons.find((x) => x.file === t.dataset.id);
    if (p) await makeMyVersion(p, preconCredit(p), "From precon " + p.name);
  }),
  finderSave: (t) => panelLater(async () => {
    const p = S.ui.finder.precons.find((x) => x.file === t.dataset.id);
    if (!p) return;
    await commit((s) => (s.references = [...(s.references || []), { id: uid(), name: p.name, format: "Commander", commander: p.commander, strategy: "Auto", locked: false, source: preconCredit(p), cards: p.cards }]), { msg: "Saved to your decks to watch." });
    bgSaves++;
    metaRender();
  }),
  copyRef: (t) => panelLater(() => copyRef(t)),
  // app.js I.refSearch (6850): the saved ideas filtered as typed.
  'I.refSearch': (t) => {
    S.ui.q.ref = t.value;
    metaRender();
  },
});
// Magic's Saved decks and Precons (app.js A.loadPrecons 6976, I.preconSearch 6993, A.previewPrecon 6997), verbatim but for render() (the
// panel drawn again), $("#preconList") (the panel's) and deckImportSheet: Preview hands the app the sheet's preset (acted previewPrecon),
// whose own Preview & match then runs as A.dImpPreview does. Save a deck idea (importReference), Export (exportRef) and Remove
// (deleteRef, asked first) go to the app (acted): the import sheet, and writeActs.exportRef / writeActs.deleteRef.
Object.assign(DECKS_ACTS, {
  loadPrecons: () => panelLater(async () => {
    const P = S.ui.precon;
    P.busy = true;
    P.msg = "Loading…";
    metaRender();
    try {
      const j = await fetchJSON("https://mtgjson.com/api/v5/DeckList.json");
      P.index = (j.data || []).filter((d) => typeof d.fileName === "string" && typeof d.name === "string");
      P.msg = `${P.index.length} products. Search by the name on the box.`;
    } catch (e) {
      P.msg = "Couldn’t reach MTGJSON (" + e.message + "). You can still upload a precon’s .json or text list with “Save a deck idea”.";
    } finally {
      P.busy = false;
      metaRender();
    }
  }),
  'I.preconSearch': (t) => {
    S.ui.q.precon = t.value;
    const box = panel.doc.querySelector("#preconList");
    if (box) panelRun(() => { box.innerHTML = preconListView(); });
  },
  previewPrecon: (t) => {
    const f = t.dataset.file, p0 = panel;
    if (!/^[A-Za-z0-9_.-]+$/.test(f)) return void p0.toasts.push({text: "Invalid product.", undo: false});
    p0.toasts.push({text: "Loading decklist…", undo: false});
    panelLater(async () => {
      const url = "https://mtgjson.com/api/v5/decks/" + f.replace(/\.json$/, "") + ".json",
        payload = await fetchJSON(url),
        p = mtgjsonDeck(payload);
      // The site opens the sheet whatever happened meanwhile: the panel showing now takes it (the tab's under the War Chest, given on close).
      const to = panel === p0 ? p0 : panel?.chest ? chestUnder : panel || p0;
      if (to) to.acted = {act: 'previewPrecon', data: {preset: JSON.stringify({ text: JSON.stringify(payload), name: p.name, commander: p.commander, format: p.commander ? "Commander" : "60-card casual", url, author: "Wizards of the Coast", kind: "MTGJSON precon", destination: "library", description: "Preconstructed deck list from MTGJSON." })}};
    });
  },
});
// app.js fileSafe (1030), verbatim.
const fileSafe = (s) => String(s).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "deck";
// app.js A.exportRef / A.deleteRef (6956-6964), verbatim but for download() (the app saves the file) and ask() (the app asks first).
Object.assign(writeActs, {
  async exportRef(d) {
    const r = S.state.references.find((x) => x.id === d.id);
    siteDownload = {name: `CardStashy_${fileSafe(r.name)}.txt`, text: exportDeckText(r) + "\n", type: 'text/plain'};
  },
  async deleteRef(d) {
    if (!ask("Remove this saved idea?", d.confirmed)) return;
    await commit((s) => (s.references = s.references.filter((x) => x.id !== d.id)));
  },
});

// ---- Yu-Gi-Oh! and Pokémon's Import a deck and New deck (tcg.js A.tImport / A.tNewDeck: tcgImportSheet("deck"), tcgNewDeckSheet), read
// from the site's own sheets; their buttons are the site's A.tImpDeck and A.tNewDeckSave (writeActs below), every field they read
// from the page handed in.
function tcgSheetTree(G, run) {
  tcgFocus(G, 'decks'); let html = ''; const was = tcgSheetHook; tcgSheetHook = h => { html = String(h || ''); };
  try { run(); } finally { tcgSheetHook = was; }
  return tree(html);
}
const selectOptions = (sel) => { const opts = all(sel, tagIs('option'));
  return {options: opts.map(o => [o.attrs.value ?? '', text(o)]), selected: (opts.find(o => o.attrs.selected !== undefined) || opts[0])?.attrs.value ?? ''}; };
function tcgDeckImportSheetModel(G) {
  const t = tcgSheetTree(G, () => TA.tImport({dataset: {}}));
  const area = one(t, tagIs('textarea')), file = one(t, cls('file')), labels = all(one(t, cls('grid2')), tagIs('label'));
  const name = one(labels[0], tagIs('input')), fmt = one(labels[1], tagIs('select'));
  return {title: text(one(one(t, cls('sheet-head')), tagIs('h2'))), close: one(one(t, cls('sheet-head')), tagIs('button'))?.attrs['aria-label'] || 'Close',
    hint: text(one(t, x => x.tag === 'p' && cls('muted')(x) && x.attrs.id !== 'tImpStatus')),
    placeholder: unent(area?.attrs.placeholder), rows: Number(area?.attrs.rows) || 9,
    upload: labelWords(file), accept: one(file, tagIs('input'))?.attrs.accept || '',
    name: {label: labelWords(labels[0]), value: unent(name?.attrs.value), max: Number(name?.attrs.maxlength) || 100},
    format: {label: labelWords(labels[1]), ...selectOptions(fmt)},
    button: text(one(t, x => x.attrs['data-act'] === 'tImpDeck'))};
}
function tcgNewDeckSheetModel(G, format) {
  const t = tcgSheetTree(G, () => TA.tNewDeck({dataset: format ? {format: String(format)} : {}}));
  const labels = all(one(t, cls('grid2')), tagIs('label')), name = one(labels[0], tagIs('input')), fmt = one(labels[1], tagIs('select'));
  return {title: text(one(one(t, cls('sheet-head')), tagIs('h2'))), close: one(one(t, cls('sheet-head')), tagIs('button'))?.attrs['aria-label'] || 'Close',
    name: {label: labelWords(labels[0]), placeholder: name?.attrs.placeholder || '', max: Number(name?.attrs.maxlength) || 100},
    format: {label: labelWords(labels[1]), ...selectOptions(fmt)},
    button: text(one(t, x => x.attrs['data-act'] === 'tNewDeckSave'))};
}
// The run of A.tImpDeck / A.tNewDeckSave: S.ui.sheetCtx their sheet's (importGuard checks it), closeSheet seen, go("#tdeck/<id>") kept
// for the app ({go: "tdeck", id, game}); the import's words land in #tImpStatus (texts).
async function tcgDeckSheetRun(d, type, fn, vals) {
  tcgFocus(d.game, 'decks'); tcgWent = '';
  const prev = S.ui.sheetCtx, ctx = {type}, was = tcgCloseHook;
  S.ui.sheetCtx = ctx; tcgCloseHook = () => {};
  try { await siteRun(fn, d, vals); }
  finally { tcgCloseHook = was; if (S.ui.sheetCtx === ctx) S.ui.sheetCtx = prev; }
  if (/^#tdeck\//.test(tcgWent)) made = JSON.stringify({go: 'tdeck', id: decodeURIComponent(tcgWent.slice(7)), game: d.game});
}
Object.assign(writeActs, {
  // tcg.js A.tImpDeck: [d] {game, text (#tImpText), name (#tImpName), format (#tImpFormat)}.
  async tImpDeck(d) { await tcgDeckSheetRun(d, 'timport', () => TA.tImpDeck({dataset: {}}), {'#tImpText': d.text ?? '', '#tImpName': d.name ?? '', '#tImpFormat': d.format ?? '', '#tImpStatus': ''}); },
  // tcg.js A.tNewDeckSave: [d] {game, name (#tDeckName), format (#tDeckFormat)}.
  async tNewDeckSave(d) { await tcgDeckSheetRun(d, 'tnew', () => TA.tNewDeckSave({dataset: {}}), {'#tDeckName': d.name ?? '', '#tDeckFormat': d.format ?? ''}); },
});

// ---- Magic's Deck review sheet (app.js A.deckReview 5261: openSheet(V.deckReviewSheet(d), {type: "review", deckId})), read from the
// site's own markup: its intro (● / ▲ in their colours), the items (level, title, chip, detail, the cards, the action) or the empty
// state, and the foot. Its actions: card, deckTab, refreshDeck (writeActs) and the Search ones (reviewSearch).
function deckReviewModel(id) {
  const d = deckOf(id); if (!d) return {missing: true};
  mtgFocus(); S.ui.deckId = d.id; S.ui.sheetCtx = {type: "review", deckId: d.id};
  const t = tree(deckReviewSheetView(d)), head = one(t, cls('sheet-head'));
  const intro = one(t, x => x.tag === 'p' && cls('muted')(x) && !cls('foot')(x));
  const parts = n => (n?.kids || []).map(k => k.text !== undefined ? {text: k.text} : {text: text(k), tone: cls('bad-text')(k) ? 'bad' : cls('warn-text')(k) ? 'warn' : ''}).filter(x => x.text);
  const items = all(t, cls('review-item')).map(n => {
    const main = one(n, cls('review-main')), row = one(main, cls('row')), ps = (main?.kids || []).filter(k => k.tag === 'p');
    const cards = ps.find(p => !cls('muted')(p)), btn = (main?.kids || []).find(k => k.tag === 'button');
    return {level: cls('bad')(n) ? 'bad' : 'warn', title: text(one(row, tagIs('b'))), chip: text(one(row, cls('chip'))), detail: text(ps.find(p => cls('muted')(p))),
      cards: all(cards, tagIs('button')).map(b => b.attrs['data-name'] || text(b)),
      more: cards ? text({kids: (cards.kids || []).filter(k => k.text !== undefined)}).replace(/^[,\s]+/, '').replace(/^(?:,\s*)+/, '').trim().replace(/^.*?(\+\d+ more)$/, '$1') : '',
      action: btn ? {act: btn.attrs['data-act'] || '', id: btn.attrs['data-id'] || '', role: btn.attrs['data-role'] || '', label: text(btn)} : null};
  });
  const emptyBox = one(t, cls('empty'));
  return {deck: d.id, title: text(one(head, tagIs('h2'))), close: one(head, tagIs('button'))?.attrs['aria-label'] || 'Close',
    intro: intro ? parts(intro) : [], items,
    empty: emptyBox ? {mark: text(one(emptyBox, cls('empty-mark'))), title: text(one(emptyBox, tagIs('h3'))), text: text(one(emptyBox, tagIs('p')))} : null,
    foot: text(one(t, cls('foot')))};
}
// app.js A.findRole (6340) and A.formatSearch (3749) for the review's deck, verbatim but for currentDeck() (the sheet's deck), closeSheet
// and go("#search") (the app closes the sheet and opens its Search tab): the search they leave ({term, filters}), findRole's started.
function reviewSearch(kind, deckId, role) {
  const d = deckOf(deckId); if (!d) return {missing: true};
  mtgFocus(); searchGame = 'mtg'; S.ui.deckId = d.id;
  if (kind === 'formatSearch') {
    const f = formatOf(d);
    S.ui.db.filters = { color: "", type: "", format: f.legality || "", maxPrice: "" };
    dbInvalidate();
  } else {
    const comm = meta(d.commander),
      ci = (comm?.color_identity || []).join("").toLowerCase() || "c",
      theme = comm ? commanderTheme(comm) : null,
      q = {
        Ramp: '(o:"add {" or o:"search your library for a basic land" or o:"treasure token") -t:land',
        Draw: '(o:"draw a card" or o:"draw two" or o:"draws a card") -t:land',
        Removal: '(o:"destroy target" or o:"exile target" or o:"counter target")',
        Wipe: '(o:"destroy all" or o:"exile all" or o:"each creature")',
        Protection: "(o:hexproof or o:indestructible or o:\"phase out\") -t:land",
        Synergy: theme?.tribe ? "(t:" + theme.tribe + " or o:" + theme.tribe + ")" : "o:token",
      }[role];
    S.ui.db.term = `${q} id<=${ci}`;
    S.ui.db.filters = { color: "", type: "", format: "commander", maxPrice: "" };
    S.ui.sheetCtx = null;
    dbSearch().catch(e => toasts.push({text: e?.message || 'Search failed.', undo: false}));
  }
  return {term: S.ui.db.term, filters: S.ui.db.filters};
}

// ---- The War Chest from the Decks head (app.js A.warChest 3920: war-chest.js openWarChest, its own window over the page), drawn by the
// app as such a window over a panel of warChestMarkup({resume: chestResume(game)}): Dice & coin writes its roll in the chest (the
// window's click listener); every other tool closes the window and goes to the app (acted chestTool: app.js chestTool). The tab's
// panel under it comes back as it was when the window closes (warChestClose).
let chestUnder = null;
const CHEST_ACTS = {
  chestTool: t => {
    const tool = t.dataset.tool;
    if (tool === 'dice') { const n = panel.doc.querySelector('[data-chest-result]'); if (n) n.textContent = rollDice(); return; }
    panel.acted = {act: 'chestTool', data: {tool}};
  },
};
function warChestOpen(G) {
  if (panel?.chest) panel = chestUnder;
  chestUnder = panel; panel = null;
  panelOpen('chest|' + G, `<div class="war-chest-dialog" aria-label="The War Chest">${warChestMarkup({resume: chestResume(G)})}</div>`, null, CHEST_ACTS);
  panel.chest = true; panel.redraw = () => {};
}

// ---- Compare budget builds (tcg.js A.tOptimizeDeck: openBuild with the deck, the Build decks sheet tcgBuildSheet while runTBuild fills
// it), drawn by the app (TierBuildSheet) from the sheet's markup (buildSheetModel). The sheet is a panel over the deck tab's, as the War
// Chest's window: its taps reach the site's handlers here, and closing it (tcg.js closeSheet) brings the tab's panel back. What saves,
// copies or opens a store (tTierSave, tTierSaveAll, tTierSaveGo, tTierCopy, tTierBuy) goes to the app, which runs it as a write.
let tbuildUnder = null;
const TBUILD_ACTS = {
  closeSheet: () => tbuildShut(),
  tBuildFormat: t => tcgPanelAsync(() => TA.tBuildFormat(t)),
  'C.tBuildCustom': t => tcgPanelAsync(() => TC.tBuildCustom(t)),
  // A.tTier, but for its scroll (requestAnimationFrame over the page): the app brings the opened list into view (model openTier).
  tTier: t => { const B = S.ui.tbuild, i = Number(t.dataset.i); B.openTier = B.openTier === i ? null : i; panel.redraw(); },
  tTierAlternative: t => { TA.tTierAlternative(t); },
  // A.tRandomDeck: a random card, then openBuild without a deck: the app's Build a deck on its request (openDeckFlow).
  tRandomDeck: t => { flowAskPanel = panel; return tcgPanelAsync(() => TA.tRandomDeck(t)); },
};
for (const k of ['tTierSave', 'tTierSaveAll', 'tTierSaveGo', 'tTierCopy', 'tTierBuy', 'tCard'])
  TBUILD_ACTS[k] = t => { panel.acted = {act: k, data: {...t.dataset}}; };
function tbuildOpen() {
  if (panel?.tbuild) return;
  const G = S.ui.tbuild?.game; if (!G) return;
  tbuildUnder = panel; panel = null;
  // #sheetBody: runTBuild writes its progress into the overlay's status line there as it goes.
  panelOpen('tbuild|' + G + '|' + (S.ui.tbuild.baseDeck || S.ui.tbuild.seed || ''), `<div id="sheetBody">${TcgAll.tcgBuildSheet()}</div>`, null, TBUILD_ACTS);
  panel.tbuild = true;
  const p = panel;
  p.redraw = () => { if (!S.ui.tbuild) return; tcgFocus(S.ui.tbuild.game, S.ui.view || 'tdeck'); panelRun(() => { p.host.innerHTML = `<div id="sheetBody">${TcgAll.tcgBuildSheet()}</div>`; }); tbuildHold(p, S.ui.tbuild.busy); };
  tbuildHold(p, S.ui.tbuild.busy);
}
// runTBuild isn't awaited by the handler that starts it (openBuild, A.tBuildFormat), and its status line looks up the page after each
// await: while it runs, the sheet's document stands in for the page's (as tcgPanelAsync does for a tab's).
let tbuildHeld = null;
function tbuildHold(p, on) {
  if (on) { globalThis.document = p.doc; tbuildHeld = p.doc; }
  else if (!on && tbuildHeld && globalThis.document === tbuildHeld) { delete globalThis.document; tbuildHeld = null; }
}
function tbuildShut() {
  if (!panel?.tbuild) return;
  const was = panel; panel = tbuildUnder; tbuildUnder = null;
  // What the sheet handed the app as it closed goes with the panel under it.
  if (panel) { panel.acted ||= was.acted; panel.toasts.push(...was.toasts); panel.redraw?.(); }
}
// The sheet's markup as the app draws it: tcg.js tcgBuildSheet and views.js buildSheet (tier-card.js tierCardHtml for each version).
function buildSheetModel(root, mtg = false) {
  const q = (el, s) => el?.querySelector(s), qa = (el, s) => el ? el.querySelectorAll(s) : [];
  const words = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const has = (el, c) => !!el?.classList?.contains(c);
  const svgOf = el => { const s = q(el, 'svg'); return s ? icon(svgIn(tree(s.outerHTML))) : null; };
  const btn = el => el ? {id: el._id, label: words(el), disabled: el.disabled, icon: svgOf(el)} : null;
  const art = el => el ? (el.localName === 'img' ? el.getAttribute('src') : q(el, 'img')?.getAttribute('src')) || '' : '';
  const seedEl = q(root, '.build-seed'), multi = has(seedEl, 'multi'), info = seedEl && [...seedEl.children].find(x => x.localName === 'div' && !has(x, 'seed-strip'));
  const smalls = qa(info, 'small');
  const seed = seedEl ? {multi, art: multi ? '' : art(seedEl.querySelector(':scope > img') || q(seedEl, '.mini-art')), strip: multi ? qa(q(seedEl, '.seed-strip'), 'img').map(i => i.getAttribute('src') || '') : [],
    label: words(smalls[0]), name: words(q(info, 'b')), sub: words(smalls[1]), dots: qa(q(info, '.dots'), 'img').map(i => ({src: i.getAttribute('src') || '', alt: i.getAttribute('alt') || ''})), random: btn(q(seedEl, 'button'))} : null;
  const intro = [...root.children].find(x => x.localName === 'p' && has(x, 'muted') && has(x, 'small'));
  const chips = q(root, '.fmt-chips'), budget = q(root, '.custom-budget'), field = q(budget, 'input');
  const overlay = q(root, '.build-overlay'), status = [...root.querySelectorAll(':scope > p[role=status]')][0];
  const evidence = [...root.children].find(x => x.localName === 'p' && has(x, 'evidence'));
  const tiers = qa(q(root, '.tiers'), 'article.tier').map((a, i) => {
    const head = q(a, '.tier-head'), chipEls = qa(q(head, '.tier-chips'), '.chip');
    const stats = qa(q(a, '.tier-stats'), ':scope > span').map(s => ({value: words(q(s, 'b')), text: words(s).slice(words(q(s, 'b')).length).trim(), warn: has(s, 'warn-text'), diff: q(s, '.diff-tag')?.getAttribute('class')?.replace('diff-tag', '').trim() || ''}));
    const fill = q(q(a, '.bar'), 'span')?.getAttribute('style')?.match(/width:\s*([\d.]+)%/)?.[1];
    const notes = [...a.children].filter(x => x.localName === 'p').map(p => ({text: words(p), warn: has(p, 'warn-text'), evidence: has(p, 'evidence'), path: has(p, 'draft-path'), explain: has(p, 'budget-explanation')}));
    const next = q(a, 'details.budget-next');
    const groups = qa(a, 'details.tier-group').map(gd => ({name: words(q(q(gd, 'summary'), 'span')), count: words(q(q(gd, 'summary'), 'b')),
      rows: qa(gd, '.tier-row, .upgrade-card-row').map(r => {
        const open = q(r, '.lot-name') || r, sub = q(r, '.lot-sub');
        // A Yu-Gi-Oh! / Pokémon version's tile is the deck page's row (tcg.js deckRow's .lot), read as the deck page reads it (tcgDeckRow).
        const lot = has(r, 'lot') ? one(tree(r.outerHTML), cls('lot')) : null;
        return {id: open._id, act: open.getAttribute('data-act') || '', card: lot ? (mtg ? deckRowModel(lot) : tcgDeckRow(lot)) : null, name: words(q(r, '.lot-name')) || words(q(r, '.ellip')), art: abs(art(q(r, '.lot-art') || r)),
          price: words(q(r, '.art-price')), qty: words(q(r, '.tier-qty')), why: words(q(sub, 'small.muted')) || words(q(q(r, '.ellip'), 'small')),
          own: words(q(r, '.own')) || words([...qa(r, ':scope > span')].pop()), ok: has(q(r, '.own'), 'yes') || has([...qa(r, ':scope > span')].pop(), 'ok-text'),
          note: words(q(sub, '.purchase-note, .ygo-purchase-note')), data: {...(open.dataset || {})}};
      })}));
    const acts = q(a, '.tier-actions'), more = q(acts, 'details.tier-more');
    const plain = qa(acts, ':scope > button');
    return {i, on: has(a, 'on'), meta: has(a, 'meta'), title: words(q(head, 'b')), chips: chipEls.map(c => ({text: words(c), ok: has(c, 'ok'), warn: has(c, 'warn')})),
      stats, owned: fill == null ? null : Number(fill) / 100, notes,
      next: next ? {summary: words(q(next, 'summary')), lines: qa(next, 'p').map(words), review: btn(q(next, 'button'))} : null, groups,
      save: btn(plain.find(b => has(b, 'tier-save'))), buy: btn(plain.find(b => (b.getAttribute('data-act') || '').endsWith('ierBuy'))),
      toggle: btn(plain.find(b => /^(tTier|tierToggle)$/.test(b.getAttribute('data-act') || ''))),
      more: qa(q(more, '.tier-more-menu'), 'button').map(b => ({id: b._id, label: words(q(b, 'b')), note: words(q(b, 'small')), icon: svgOf(b)}))};
  });
  const saveAll = [...root.querySelectorAll(':scope > button.block')][0];
  return {title: words(q(q(root, '.sheet-head'), 'h2')), close: q(root, '.sheet-head [data-act=closeSheet]')?._id ?? null, seed, intro: words(intro),
    formats: qa(chips, 'button').map(b => ({id: b._id, label: words(b), on: has(b, 'on'), disabled: b.disabled})), formatsEmpty: words(q(chips, 'span')),
    budget: field ? {id: field._id, label: words(budget).trim(), value: field.getAttribute('value') || '', placeholder: field.getAttribute('placeholder') || '', disabled: field.disabled} : null,
    busy: overlay ? {title: words(q(overlay, 'b')), msg: words(q(overlay, '[role=status]')), note: words(q(overlay, 'small'))} : null,
    status: status ? {text: words(status), warn: has(status, 'warn-text')} : null, evidence: words(evidence),
    tiers, saveAll: btn(saveAll), foot: words([...root.querySelectorAll(':scope > p.foot')][0]), openTier: (mtg ? S.ui.build?.openTier : S.ui.tbuild?.openTier) ?? null};
}

// ---- Magic's Compare budget builds (app.js A.optimizeMtgDeck 3977: S.ui.build on the deck, openSheet(V.buildSheet(), {type: "build"}),
// runBuild 3802-3943), the same sheet as Yu-Gi-Oh! and Pokémon's here: a panel over the Power tab's that the app draws (TierBuildSheet).
// runBuild, tierList, buildMsg, A.buildRandom, A.tierToggle, A.tierAlternative, A.buildFormat and C.buildCustom are app.js's, verbatim but
// for refreshSheet (the sheet's panel drawn again) and $ (document.querySelector over the sheet's document while it builds).
const $ = s => globalThis.document?.querySelector(s) ?? null;
function mtgRefreshSheet() { if (panel?.mbuild) panel.redraw(); else if (!S.ui.build?.busy) tbuildHold(null, false); }
const tierList = () => [...new Set([...BUDGET_TIERS, ...(S.ui.build.custom !== "" && Number.isFinite(Number(S.ui.build.custom)) ? [Math.max(0, Number(S.ui.build.custom))] : [])])].sort((a, b) => a - b);
const buildMsg = (m) => {
  S.ui.build.msg = m;
  const el = $("#sheetBody [role=status]");
  if (el) el.textContent = m;
};
async function runBuild() {
  const refreshSheet = mtgRefreshSheet;
  const B = S.ui.build,
    f = formatOf(B.format),
    seed = meta(B.seed);
  if (!seed || B.busy) return;
  B.busy = true;
  B.error = false;
  B.openTier = null;
  refreshSheet();
  try {
    if(f.id==="paupercommander"){await verifyLeader(seed,f,api);if(!canLead(seed,f))throw Error(`${seed.name} is not a verified Pauper Commander leader.`);saveCatalogSoon();}
    const colors = seed.color_identity?.length ? seed.color_identity : ["C"];
    await loadFormatPool(f, colors, seed, buildMsg);
    buildMsg("Building versions…");
    B.avail = deckAvailability();
    let candidates=buildTiers({format:f.name,seeds:[seed],catalog:S.catalog,available:B.avail,price:c=>priceOf(c.name),...(B.forgeFor===seed.name?forgeOptions(B.forge):{})},tierList());
    const baseline=B.baseDeck?deckOf(B.baseDeck):null;if(baseline && formatOf(baseline).name===f.name)candidates.push({...baseline,total:sumQty(baseline.cards),size:f.size,warnings:[]});
    const mk=mtgMetaKey({format:f.name}),data=mk?await loadMeta(mk).catch(()=>metaState(mk).data):null;
    const matching=(data?.decks || []).filter(d=>[...(d.commanders||[]),...(d.main||[])].some(r=>key(r.name)===key(seed.name))).slice(0,4);
    for(const d of matching){
      const commanders=(d.commanders||[]).map(r=>typeof r==='string'?{name:r,qty:1}:r);
      if(f.commander && !commanders.some(r=>key(r.name)===key(seed.name)))continue;
      const cards=aggregateCards([...commanders,...(d.main||[])]);await resolveNames(cards.map(r=>r.name));
      candidates.push({proven:d.key,source:sourceCredit({kind:'Tournament list',url:d.url,description:d.event}),label:d.event || d.name,format:f.name,commander:commanders[0]?.name || '',cards,total:sumQty(cards),size:f.size,warnings:[]});
    }
    const cost=d=>purchaseCost(d.cards,{key:r=>key(r.name),owned:r=>B.avail(r.name),price:r=>priceOf(r.name)});
    const evaluate=d=>mtgPower({...d,id:'builder:mtg'}),targets=[...candidates.filter(d=>d.proven),...candidates.slice(-1)],protectedKeys=new Set([seed.name]);
    candidates=await refineCandidates(candidates,{evaluate,cost,status:buildMsg,rounds:2,maxNeighbors:12,
      accept:d=>!evaluate(d).readiness?.provisional,
      neighbors:d=>targets.flatMap(target=>towardDeck(d,target,{protectedKeys,zoneOf:r=>/\bLand\b/.test(meta(r.name)?.type_line || '')?'land':'spell'}))});
    let tiers=bestBudgetDecks(candidates,tierList(),{evaluate,cost});
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
    B.results[f.name]=tiers.filter(Boolean).map((winner,i)=>{const d=winner;return {...d,owned:d.cards.reduce((n,r)=>n+Math.min(r.qty,B.avail(r.name)),0)};});
    B.msg = `${B.results[f.name].length} budget versions · compared ${candidates.length} decks using Power, legality and purchase cost. Prices are known eligible quotes from checked printings, not a complete market search.`;
  } catch (e) {
    B.msg = e.message;
    B.error = true;
  } finally {
    B.busy = false;
    refreshSheet();
  }
  const names = [...new Set((B.results[f.name] || []).flatMap((t) => t.cards.map((r) => r.name)))].sort((a, b) => (priceOf(b) ?? 0) - (priceOf(a) ?? 0));
  if (names.length) refreshCheapest(names, { api, key, limit: 40, format: f.legality, reference: meta }).then((n) => n && panel?.mbuild && refreshSheet()).catch(() => {});
}
// app.js A.optimizeMtgDeck (3977), verbatim but for openSheet (the sheet's panel, mbuildOpen).
async function optimizeMtgDeck() {
  const d=currentDeck();if(!d)return;await resolveNames(d.cards.map(r=>r.name));
  const seed=d.commander || [...d.cards].filter(r=>!isLand(meta(r.name))).sort((a,b)=>b.qty-a.qty)[0]?.name;if(!seed)return;
  Object.assign(S.ui.build,{seed,baseDeck:d.id,results:{},format:formatOf(d).name,openTier:null,msg:''});mbuildOpen();runBuild();
}
// app.js A.buildRandom (4031), without its Home pick (onPick): the sheet is open, so a random card in the format starts a build.
async function buildRandom(t) {
  const B = S.ui.build,
    f = formatOf(t.dataset.format || B.format || "Standard"),
    lead = f.id==="paupercommander"?" is:paupercommander":f.commander === "planeswalker" ? " t:planeswalker" : f.commander ? " is:commander" : "",
    theme = String(t.dataset.theme || "").replace(/[^\p{L}\p{N} '-]/gu, "").slice(0,80),
    q = `${f.id==="paupercommander"?"game:paper":f.legality ? "f:" + f.legality : "game:paper"} -t:land -t:basic${lead}${theme ? ` (t:"${theme}" or o:"${theme}")` : ""}`;
  if (B.busy) return toasts.push({text: "Your current Magic build is still running. Try again when it finishes.", undo: false});
  const c = cacheCard(await api("/cards/random?" + new URLSearchParams({ q })));
  if(f.id==="paupercommander"){c.pdhCommander=true;c.pdhCommanderCheckedAt=new Date().toISOString();saveCatalogSoon();}
  if (B.busy) return toasts.push({text: "Your current Magic build is still running. Try again when it finishes.", undo: false});
  Object.assign(B, { baseDeck:null,seed:c.name,results:{},format:f.name,openTier:null,forge:{power:'casual',variation:'varied',seed:newForgeSeed()},forgeFor:c.name });
  return runBuild();
}
const MBUILD_ACTS = {
  closeSheet: () => tbuildShut(),
  // A.buildFormat / C.buildCustom (3985-3996).
  buildFormat: t => { const B = S.ui.build; B.format = t.dataset.format; B.openTier = null; if (B.results[B.format]) mtgRefreshSheet(); else return tcgPanelAsync(() => runBuild()); },
  'C.buildCustom': t => { const B = S.ui.build; if (B.busy) return; B.custom = t.value === "" ? "" : String(Math.max(0, Math.min(100000, Number(t.value) || 0))); B.results = {}; return tcgPanelAsync(() => runBuild()); },
  buildRandom: t => tcgPanelAsync(() => buildRandom(t)),
  // A.tierToggle (4064): the app brings the opened list into view (model openTier).
  tierToggle: t => { const B = S.ui.build, i = Number(t.dataset.i); B.openTier = B.openTier === i ? null : i; mtgRefreshSheet(); },
  // A.tierAlternative (3982).
  tierAlternative: t => { const B=S.ui.build,n=B.results[B.format]?.[Number(t.dataset.i)]?.nextUpgrade;if(!n)return;
    B.results[B.format].push({...n,owned:n.cards.reduce((sum,r)=>sum+Math.min(r.qty,B.avail(r.name)),0),nextUpgrade:null,explanation:'Outside the original budget. Review the actual purchase total before saving.',warnings:[...(n.warnings || [])]});
    B.openTier=B.results[B.format].length-1;mtgRefreshSheet(); },
};
for (const k of ['tierSave', 'tierSaveAll', 'tierSaveGo', 'tierCopy', 'tierBuy', 'card'])
  MBUILD_ACTS[k] = t => { panel.acted = {act: k, data: {...t.dataset}}; };
function mbuildOpen() {
  if (panel?.tbuild) return;
  tbuildUnder = panel; panel = null;
  const body = () => `<div id="sheetBody">${buildSheet()}</div>`;
  panelOpen('tbuild|mtg|' + (S.ui.build.baseDeck || S.ui.build.seed || ''), body(), null, MBUILD_ACTS);
  const p = panel; p.tbuild = true; p.mbuild = true;
  p.redraw = () => { mtgFocus(); panelRun(() => { p.host.innerHTML = body(); }); tbuildHold(p, S.ui.build.busy); };
  tbuildHold(p, S.ui.build.busy);
}
// app.js generatedDeck (4071), verbatim.
function generatedDeck(t, seedName) {
  return withSnapshot({ id: uid(), name: `${t.unverifiedConstraints?.length?"Draft · ":""}${seedName.split(",")[0]} · ${t.format} · ${t.budget===Infinity?"unlimited":t.budget ? "$" + t.budget : "my cards"}`, format: t.format, commander: t.commander, goal:t.goal || "strongest", requestedStyle:t.requestedStyle || "", goalVerified:t.goalVerified === true, unverifiedConstraints:[...(t.unverifiedConstraints||[])], requiredCards:[...(t.requiredCards||[])], excludedCards:[...(t.excludedCards||[])], requestedColors:[...(t.requestedColors||[])], strategy: "Auto", budget: t.budget===Infinity?null:t.budget, locked: false, cards: t.cards.map((r) => ({ name: r.name, qty: r.qty })), versions: [], source: t.source || sourceCredit({ kind: "Generated", description: `Generated by CardStashy around ${seedName} with ${t.budget===Infinity?"an unlimited":`a $${t.budget}`} budget.${t.unverifiedConstraints?.length?" Unverified draft: infinite combos were not checked; the player explicitly allowed this uncertainty.":""}` }) }, "Generated");
}

// ---- The tournament deck's sheet (tcg.js provenSheetHtml, c.openProven and its handlers 3918-3992; app.js A.mtgProven 6879), the sheet
// the app draws (MetaDeckSheet). tcg.js's sheet code reads the page (#sheetBody's status line, its scroll) after its awaits, so while one
// is open or loading a document stands in (provenRun): an empty one, where those lookups find nothing.
let provenOpened = false, provenMade = '';
const provenDoc = new SiteDocument();
let provenLive = 0;
const provenDocIn = () => { if (provenLive > 0 && globalThis.document === undefined) globalThis.document = provenDoc; };
function provenRun(f) {
  provenLive++; provenDocIn(); Promise.resolve().then(provenDocIn);
  const done = () => { if (--provenLive === 0 && globalThis.document === provenDoc) delete globalThis.document; };
  let r;
  try { r = f(); } catch (e) { done(); throw e; }
  if (r && typeof r.then === 'function') return Promise.resolve(r).finally(done);
  done(); return r;
}
// tcg.js openSheet / closeSheet for the sheet (registerTcg's ctx): its context is the one open (S.ui.sheetCtx), as the site's openSheet sets it.
// provenKept: the sheet's context while a card's page opened from it is on top (app.js sheetTrail's snapshot, wireSheetBack's ←).
let provenKept = null;
function provenSheetOpen(ctx) { S.ui.sheetCtx = provenKept = ctx; provenOpened = true; }
function provenSheetShut() { if (S.ui.sheetCtx?.type === 'proven') { S.ui.sheetCtx = null; provenKept = null; } }
// app.js A.mtgProven (6879-6944), verbatim but for closeSheet and go in save (the deck the app opens next: provenMade).
function mtgProven(t) {
  tcgReady();
  const captured = t.dataset.homeMetaOpen !== undefined ? homeMetaSnapshot(t, "mtg") : null;
  if (t.dataset.homeMetaOpen !== undefined && !captured) return toasts.push({text: "This Home list has changed. Choose the current visible list.", undo: false});
  // From a card's Meta tab, the deck may be from another format than the one on Meta decks.
  if (t.dataset.format && metaState("mtg:" + t.dataset.format).data) (S.ui.mtgMeta ||= {}).format = t.dataset.format;
  const fmt = captured ? captured.metaKey.slice(4) : t.metaSnapshot?.format || mtgMetaFormat(),
    data = captured?.data || t.metaSnapshot?.data || metaState("mtg:" + fmt).data,
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
    evidence: `Tournament-backed · ${esc(label)} · last ${data.days} days · compared with ${data.decks.length} lists from ${data.coverage?.events || 0} events · ${esc(data.source)}`,
    attribution: `${{ "Magic Online (official decklists)": `Decklist from <a href="https://www.mtgo.com/decklists" target="_blank" rel="noopener">Magic Online</a> (Wizards of the Coast).`, "MTGTop8 (competitive Commander)": `Decklist from <a href="https://www.mtgtop8.com/format?f=cEDH" target="_blank" rel="noopener">MTGTop8</a>; most events are reported through TopDeck.gg.` }[data.source] || `Data provided by <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a>.`} Prices are Scryfall’s TCGplayer estimates.`,
    sourceUrl: d.url || d.eventUrl,
    formatLabel: `Magic · ${label}`,
    sourceLabel: data.source.startsWith("Magic Online") ? "Magic Online event" : data.source.startsWith("MTGTop8") ? "MTGTop8 event" : "TopDeck.gg event",
    rowsFn: () => rowsOf(d),
    // The 15-card sideboard travels with the list (not in Commander, which has none).
    sideRowsFn: () => (fmt === "EDH" ? [] : (d.side || []).map((r) => ({ key: key(r.name), name: r.name, qty: r.qty, kind: kindOf(r.name), price: namePrice(meta(r.name), (finish) => priceOf(r.name, finish)), owned: Math.max(0, inv(r.name).owned - sumQty([...d.commanders, ...d.main].filter((m) => key(m.name) === key(r.name)))) }))),
    listsFn: () => data.decks.map(rowsOf),
    // Format staples played across unrelated decks aren't this deck's engine.
    generic: (k) => (seen.get(k) || 0) / Math.max(1, data.decks.length) >= 0.3,
    load: async (status) => {
      const sim = similarLists(rowsOf(d), data.decks.map(rowsOf));
      const names = [...new Set([...rowsOf(d), ...sim.flat(), ...(d.side || [])].map((r) => r.name))];
      const refresh = names.filter((name) => { const c = meta(name); return !c || namePrice(c) === null || !c.checkedAt || Date.now() - new Date(c.checkedAt).getTime() > 86400000; });
      const result = await resolveNames(refresh, status, true);
      await ensureTcgPrices(names.map(meta).filter(Boolean), { retry: true });
      return result;
    },
    save: async (rows, labelText) => {
      // Keep every declared commander (partners, backgrounds); `commander` stays the first for older readers.
      const commanders = rows.filter((r) => r.kind === "commander").map((r) => ({ name: r.name, qty: r.qty })),
        commander = commanders[0]?.name || "";
      const site = data.source.startsWith("MTGTop8") ? "MTGTop8" : data.source.startsWith("Magic Online") ? "Magic Online" : "TopDeck.gg";
      const deck = withSnapshot({ id: uid(), name: `${d.name} · ${labelText}`.slice(0, 100), format: appFormat, commander, ...(commanders.length > 1 ? { commanders } : {}), strategy: "Auto", budget: S.state.settings.budget ?? 25, locked: false, cards: rows.map((r) => ({ name: r.name, qty: r.qty })), side: fmt === "EDH" ? [] : (d.side || []).map((r) => ({ name: r.name, qty: r.qty })), versions: [], source: sourceCredit({ kind: labelText === "original" ? "Tournament list" : "Adapted tournament list", author: d.player, website: site, url: d.eventUrl || d.url, description: `${d.place} at ${d.event} (${d.players} players).` }) }, labelText === "original" ? `From ${site}` : "Adapted from a tournament list");
      await commit((s) => {
        s.decks.push(deck);
        s.activeDeck = deck.id;
      }, { msg: `Saved “${deck.name}”.` });
      provenSheetShut();
      provenMade = JSON.stringify({go: "deck", id: deck.id, tab: "cards"});
    },
    cardAttrs: (r) => `data-act="card" data-name="${esc(r.name)}"`,
    printingFor: (r) => meta(r.name),
    imageFor: (r) => cardImage(meta(r.name)),
    heroFor: (rows) => {
      if (d.art) return d.art;
      const c = meta((rows.find((r) => r.kind === "commander") || rows.find((r) => r.kind === "creature") || rows.find((r) => r.kind !== "land") || rows[0])?.name);
      return c?.image_uris?.art_crop || c?.card_faces?.[0]?.image_uris?.art_crop || (d.cover ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(d.cover)}&format=image&version=art_crop` : "");
    },
  });
}
// tcg.js provenSheetHtml read back in the order the sheet shows it: deckShell's hero and stats (shellOf), its actions (the source is a
// link), Retry prices, the build overlay or status line, a save's error, Original / Budget / My cards, then the deck viewer's blocks
// (notes, budget chips, list heads, changes, rows, the sideboard), ⚒ Build around it and the evidence and attribution feet.
function provenSheetModel() {
  const spec = proven.spec;
  if (!spec || S.ui.sheetCtx?.type !== 'proven') return {missing: true};
  const g = spec.g;
  const t = tree(provenRun(() => provenSheetHtml())), sh = shellOf(t, g), head = one(t, cls('ds-head'));
  const tone = n => cls('ok-text')(n) ? 'ok' : cls('warn-text')(n) ? 'warn' : cls('bad-text')(n) ? 'bad' : 'muted';
  const linksOf = n => { const out = []; const walk = x => { for (const k of x?.kids || []) { if (k.tag === 'a') out.push({text: text(k), href: k.attrs.href || ''}); else if (k.tag) walk(k); } }; walk(n); return out; };
  const rowOf = r => {
    const img = one(r, cls('row-thumb')), copy = one(r, cls('deck-compact-copy')), right = (r.kids || []).filter(k => k.tag).at(-1), emb = one(copy, cls('imp-row'));
    return {name: r.attrs['data-deck-name'] || '', qty: Number(r.attrs['data-deck-qty']) || 0, zone: r.attrs['data-deck-zone'] || 'main', category: r.attrs['data-deck-category'] || 'Unresolved',
      act: r.attrs['data-act'] || '', cardName: r.attrs['data-name'] || '', id: r.attrs['data-id'] || '', index: r.attrs['data-index'] ?? '',
      art: img?.tag === 'img' ? picture(img) : null, label: text(one(copy, tagIs('b'))), set: text(one(copy, cls('set-badge'))), setRarity: (classes(one(copy, cls('set-badge')) || {}).find(x => x.startsWith('r-')) || 'r-common').slice(2), rarity: text(one(one(copy, cls('deck-printing')), cls('tag'))),
      tags: (copy?.kids || []).filter(k => k.tag && cls('tag')(k)).map(k => ({text: text(k), ok: cls('ok')(k)})),
      emblem: emb ? {title: emb.attrs.title || '', icon: icon(svgIn(emb))} : null,
      right: right && right !== copy ? {text: text(right), tone: tone(right)} : null};
  };
  const blockOf = k => {
    if (k.attrs['data-deck-list'] !== undefined) return {k: 'rows', rows: all(k, cls('mini-row')).map(rowOf)};
    if (cls('note')(k)) { const b = (k.kids || []).find(x => x.tag === 'b');
      return {k: 'note', warn: cls('warn')(k), title: text(b), rest: text({kids: (k.kids || []).filter(x => x !== b && !(x.tag && ['p', 'ul', 'small', 'br'].includes(x.tag)))}),
        paras: all(k, tagIs('p')).map(text), items: all(k, tagIs('li')).map(text), smalls: (k.kids || []).filter(x => x.tag === 'small').map(s => ({bold: text(one(s, tagIs('b'))), text: text(s)}))}; }
    if (cls('fmt-chips')(k)) return {k: 'chips', chips: all(k, tagIs('button')).map(b => ({label: text(b), b: b.attrs['data-b'] || '', on: cls('on')(b)}))};
    if (k.tag === 'p' && cls('list-head')(k)) { const c = one(k, cls('muted')); const all_ = text(k); return {k: 'head', text: c ? all_.slice(0, all_.length - text(c).length).trim() : all_, count: text(c)}; }
    if (cls('swaps')(k)) return {k: 'swaps', items: all(k, tagIs('li')).map(li => ({out: text(one(li, cls('bad-text'))), into: text(one(li, cls('ok-text'))), open: !one(li, cls('ok-text')), note: text(one(li, tagIs('small')))}))};
    if (k.tag === 'details' && cls('side-group')(k)) { const sum = one(k, tagIs('summary')), first = one(sum, tagIs('span'));
      return {k: 'side', open: k.attrs.open !== undefined, title: text({kids: (first?.kids || []).filter(x => x.tag !== 'em')}), count: text(one(first, tagIs('em'))), price: text(one(sum, cls('muted'))),
        text: text(one(k, tagIs('p'))), rows: all(k, cls('mini-row')).map(rowOf)}; }
    if (k.tag === 'p') return {k: 'text', text: text(k), tone: tone(k)};
    return null;
  };
  const viewer = one(t, cls('deck-viewer')), toolbar = one(viewer, cls('deck-view-toolbar')), sw = one(toolbar, cls('deck-view-switch'));
  const overlay = one(head, cls('build-overlay')), status = one(head, x => x.tag === 'p' && x.attrs.role === 'status' && !cls('build-overlay')(x) && cls('warn-text')(x)), alert = one(head, x => x.attrs.role === 'alert');
  const extra = one(t, cls('sheet-actions'));
  return {game: g, key: spec.key, mode: proven.mode, busy: !!proven.busy, hero: sh.hero, back: icon(svgIn(tree(ICON.back))),
    actions: (one(head, cls('ds-actions'))?.kids || []).filter(k => k.tag).map(b => ({label: text(b), act: b.attrs['data-act'] || '', id: b.attrs['data-id'] || '', primary: cls('ds-primary')(b),
      disabled: b.attrs.disabled !== undefined, href: b.tag === 'a' ? b.attrs.href || '' : ''})),
    retry: (() => { const r = one(t, cls('ds-retry')); return r ? {label: text(r)} : null; })(),
    overlay: overlay ? {title: text(one(overlay, tagIs('b'))), msg: text(one(overlay, x => x.attrs.role === 'status')), note: text(one(overlay, tagIs('small')))} : null,
    status: text(status), alert: text(alert),
    versions: all(one(head, cls('ds-versions')), tagIs('button')).map(b => ({id: b.attrs['data-id'] || '', label: text(b), on: b.attrs['aria-selected'] === 'true'})),
    view: viewer?.attrs['data-deck-view'] || 'gallery', viewLabel: text(one(toolbar, tagIs('span'))),
    views: all(sw, tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})),
    blocks: (viewer?.kids || []).filter(k => k.tag && k !== toolbar).map(blockOf).filter(Boolean),
    extra: all(extra, tagIs('button')).map(b => ({label: text(b), act: b.attrs['data-act'] || '', key: b.attrs['data-key'] || ''})),
    feet: (one(t, cls('ds-page'))?.kids || t.kids || []).filter(k => k.tag === 'p' && cls('foot')(k)).map(p => ({text: text(p), links: linksOf(p)}))};
}
// app.js createCommunity's showcaseChoices (4682), verbatim (T = tcg.js): every binder and deck on this device as the snapshot a friend
// would see, for Choose binders / decks, the preview and repairOwnShowcase.
function showcaseChoices() {
  tcgReady(); const T = TcgAll;
  const result=[];
  for(const b of S.state.settings.binders||[])result.push({key:'binder:'+b.id,kind:'binder',game:b.game,title:b.title,appearance:{color:b.color,background:b.background,cover:coverImages(binderRows(b.game).filter(r=>binderMatches(r,b)),binderFavorites(b),binderRows(b.game)).map(c=>c.image)},cards:binderRows(b.game).filter(r=>binderMatches(r,b)).map(r=>({id:r.card?.id||r.entry.cardId||r.entry.printingId,name:r.entry.name,qty:r.entry.qty,image:r.image,set:r.card?.set_name||r.card?.set?.name,number:r.card?.collector_number||r.card?.set?.number,version:r.version,referenceUSD:r.card?.prices?.usd??null}))});
  for(const game of ['mtg','ptcg','ygo'])for(const d of (game==='mtg'?S.state:T.gs(game)).decks){
   const rows=game==='mtg'?[...(d.cards||[]).map(r=>({...r,zone:'main'})),...(d.side||[]).map(r=>({...r,zone:'side'}))]:['main','extra','side'].flatMap(z=>(d.zones?.[z]||[]).map(r=>({...r,zone:z})));
   result.push({key:'deck:'+game+':'+d.id,kind:'deck',game,title:d.name,format:d.format,commander:d.commander,deckSchema:1,appearance:d.boxAppearance,cards:rows.map(r=>{const c=game==='mtg'?meta(r.name):T.cardOf(game,r.cardId);return {id:c?.id||r.cardId,name:c?.name||r.name,qty:r.qty,image:cardImage(c)||c?.image,set:c?.set_name||c?.set?.name,number:c?.collector_number||c?.set?.number,zone:r.zone};})});
  }
  return result;
}
// app.js openSharedShowcase's deck (4696): the shared deck in the proven deck sheet (tcg.js sharedDeckSheet), its Save to my decks an
// independent copy (community-profile.js sharedDeckCopy) saved to the item's game, then the site's toast.
function sharedDeckOpen(item) {
  const G = item.game; sharedItem = item; tcgReady();
  if (G === 'mtg') mtgFocus(); else tcgFocus(G, 'decks');
  provenOpened = false;
  return tcgCtx.openProven({g: item.game, key: item.key, title: item.title, sharedItem: item, rows: item.cards.map((c, i) => ({key: String(i), name: c.name, qty: c.qty, owned: 0, price: c.referenceUSD})), save: async () => {
    const deck = sharedDeckCopy(item, uid());
    await commit(state => { (item.game === 'mtg' ? state : state.tcg[item.game]).decks.push(deck); }, {enrich: false});
    toasts.push({text: 'Saved to My decks. Your copy is ready to edit.', undo: false});
  }});
}
// app.js A.sharedCard (4701): a shared card's page. Magic finds the printing the friend shared (this device's printings or catalog,
// else the card service); Yu-Gi-Oh! and Pokémon open the card by its id. [made]: {game, id, name} for the page the app opens.
Object.assign(writeActs, {
  async sharedCard(d) {
    const item = sharedItem, c = item?.cards[Number(d.index)];
    if (!c) return;
    sharedPrint = null;
    if (item.game === 'mtg') {
      let printing = Object.values(S.state.printings || {}).find(p => p.id === c.id) || Object.values(S.catalog || {}).find(p => p.id === c.id);
      if (!printing && c.id) try { printing = slim(await api('/cards/' + encodeURIComponent(c.id))); } catch { throw Error('This printing could not load. Please try again.'); }
      sharedPrint = printing || null;
    }
    made = JSON.stringify({game: item.game, id: String(c.id || ''), name: c.name || ''});
  },
});
// app.js A.homeDailyCard (Magic): the Card of the Day opens in the exact printing Home shows, its printing kept with the hero or, for an
// older kept hero with only its art, loaded by its proved id. [made]: {game, id, name} for the page the app opens.
Object.assign(writeActs, {
  async homeDailyCard() {
    const h = heroFor('mtg');
    dailyPrint = null;
    if (!h) return;
    if (h.printing) dailyPrint = h.printing;
    else {
      const print = await api('/cards/' + encodeURIComponent(h.id));
      if (print.id !== h.id || key(print.name) !== key(h.name) || typeof print.set !== 'string') throw Error('The card source returned a different printing. Please try again.');
      dailyPrint = slim({...print, full: true});
    }
    made = JSON.stringify({game: 'mtg', id: String(h.id || ''), name: h.name || ''});
  },
});
// app.js A.provenSave (tcg.js 3966) as a saving tap: the deck the site opens next (#deck/<id>/cards, #tdeck/<id>) is what the app opens.
Object.assign(writeActs, {
  async provenSave() {
    const spec = proven.spec;
    if (!spec || S.ui.sheetCtx?.type !== 'proven') return;
    const G = spec.g;
    tcgReady();
    if (G === 'mtg') mtgFocus(); else tcgFocus(G, S.ui.view === 'home' ? 'home' : 'decks');
    provenMade = ''; tcgWent = '';
    await provenRun(() => TA.provenSave({dataset: {}}));
    if (provenMade) { made = provenMade; provenMade = ''; }
    else if (/^#tdeck\//.test(tcgWent)) made = JSON.stringify({go: 'tdeck', id: decodeURIComponent(tcgWent.slice(7)), game: G});
  },
});
// app.js route()'s side effects for #decks/<tab> (1281-1320): Yu-Gi-Oh! / Pokémon load the tournament meta when it is missing or stale
// (once per snapshot) and, on Ideas, every collection card still missing its data (T.ensureMany); Magic's Ideas build once a session
// when there is nothing yet (ui.ideas.ran).
const decksAutoLoaded = new Set();
function decksRouteLoads(G, tab) {
  if (G !== 'mtg') {
    const metaKey = tab === 'inspiration' ? metaBrowseKey(G) : G, MS = metaState(metaKey);
    if (!MS.busy && metaNeedsRefresh(metaKey) && !decksAutoLoaded.has('meta' + metaKey + MS.at)) {
      decksAutoLoaded.add('meta' + metaKey + MS.at);
      setTimeout(() => { const p0 = panel; Promise.resolve(tcgCtx.loadMeta?.(G, false, metaKey)).catch(() => {}).finally(() => { if (panel === p0) panel?.redraw?.(); }); if (panel === p0) panel?.redraw?.(); }, 0);
    }
    if (tab === 'ideas') {
      const ids = tcgGs(G).collection.map((e) => e.cardId), missing = ids.filter(id => tcgNeedsRefresh(G, tcgCardOf(G, id)));
      const k = G + 'decks' + Math.floor(Date.now() / 3600000) + ':' + [...new Set(missing)].sort().join(',');
      if (missing.length && !decksAutoLoaded.has(k)) {
        decksAutoLoaded.add(k);
        const p0 = panel;
        tcgEnsureMany(G, missing, () => {}).then(() => { if (panel === p0) panel.redraw(); }, () => {});
      }
    }
    return;
  }
  const ui = S.ui;
  // app.js route() 1313-1314: Meta decks reads the checked precons once, then the format's tournament results.
  if (tab === "inspiration" && !ui.finder.cacheLoaded) loadPreconCache();
  if (tab === "inspiration") loadMtgMeta();
  if (tab === "ideas" && !ui.ideas.cache.length && !ui.ideas.busy && !ui.ideas.ran) {
    ui.ideas.ran = true;
    setTimeout(() => { if (panel?.decks === 'mtg' && panel.tab === 'ideas') buildIdeas(); }, 30);
  }
}
// The Decks page with [tab] open, cut after .random-tools: the panel, drawn afresh each time the tab opens (A.decksTab routes there).
function decksPanel(G, tab) {
  const mtg = !G || G === 'mtg';
  const body = () => {
    let html;
    if (mtg) { mtgFocus(); S.ui.decksTab = tab; try { html = decksView(); } finally { S.ui.decksTab = 'mine'; } }
    else { tcgFocus(G, 'decks'); S.ui.decksTab = tab; try { html = tcgDecks(); } finally { S.ui.decksTab = 'mine'; } }
    const box = new SiteDocument().createElement('div'); box.innerHTML = html;
    const kids = [...box.children], at = kids.findIndex(k => k.classList?.contains?.('random-tools') || String(k.getAttribute?.('class') || '').split(/\s+/).includes('random-tools'));
    return kids.slice(at + 1).map(k => k.outerHTML).join('');
  };
  panel = null;
  panelOpen(['decks', mtg ? 'mtg' : G, tab].join('|'), body(), null, DECKS_ACTS);
  panel.decks = mtg ? 'mtg' : G; panel.tab = tab;
  panel.redraw = () => { panelRun(() => { panel.host.innerHTML = body(); }); };
  decksRouteLoads(mtg ? 'mtg' : G, tab);
}

// ---- The deck idea sheet (views.js ideaSheet, app.js openIdea and its handlers 6697-6850), the sheet the app draws (IdeaSheet).
// app.js ideaDeck / openIdea, verbatim but for openSheet: the sheet is drawn from ideaSheetModel() whenever the app reads it.
function ideaDeck() {
  const I2 = S.ui.ideas;
  return I2.open?.custom || I2.cache[I2.open?.i]?.deck;
}
function openIdea(i) {
  const I2 = S.ui.ideas;
  // The sheet drawn again: #ideaSelCount is the markup's own words once more (C.ideaPick's text lasts until the next render).
  ideaSelWords = null;
  if (I2.open?.i !== i) I2.open = { i, budget: I2.defaultBudget ?? Infinity, custom: null, diagnostics: null, busy: false, initialized: false, msg: "Loading a complete proposed deck, including lands…" };
  I2.sel = I2.sel && I2.open.i === i ? I2.sel : new Set();
  S.ui.sheetCtx = { type: "idea", i };
  if (!I2.open.initialized) {
    I2.open.initialized = true;
    Promise.resolve().then(() => { if (S.ui.sheetCtx?.type === "idea" && I2.open?.i === i) IA.ideaBudget({dataset:{v:String(I2.open.budget)}}).catch(e => toasts.push({text: e?.message || String(e), undo: false})); });
  }
}
// app.js A.ideaCustomBudget (6720): [raw] is #ideaCustomBudget's value.
IA.ideaCustomBudget = async (raw) => {
 const value=String(raw).trim() ? customBudget(raw) : Infinity;
 S.ui.ideas.defaultBudget=value;
 await IA.ideaBudget({dataset:{v:String(value)}});
};
// app.js A.ideaBudget (6728), verbatim but for toast() and the sheet drawn again (the app reads the model as it changes).
IA.ideaBudget = async (t) => {
  const I2 = S.ui.ideas,
    o = I2.open,
    idea = I2.cache[o.i],
    budget = Number(t.dataset.v);
  if (o.busy) return;
  if ((budget !== Infinity && !Number.isFinite(budget)) || budget < 0 || (budget !== Infinity && budget > 100000)) return void toasts.push({text: "Choose a purchase budget from $0 to $100,000, or No cap.", undo: false});
  o.budget = budget;
  I2.defaultBudget = budget;
  o.diagnostics = null;
  o.error = "";
  I2.sel = new Set();
  if (!budget) {
    o.custom = null;
    return openIdea(o.i);
  }
  o.busy = true;
  o.custom = null;
  o.msg = "Finding cards to buy…";
  openIdea(o.i);
  try {
    const base = { ...idea.deck, budget, id: "idea-preview", cards: [{ name: idea.commander.name, qty: 1 }] };
    const loaded = await loadCandidates(base, budget, (m) => {
      o.msg = m;
    });
    const plan = completionPlan(base, S.state.collection, S.state.decks, S.catalog, { budget, landTarget: 36, preferOwned: true, simple: false, price: c => priceOf(c.name) });
    o.diagnostics = { ...plan.diagnostics, candidateLoads: loaded, warnings: plan.warnings.filter(w => !/heuristic|measured win rates/i.test(w)) };
    if (loaded.failed) o.diagnostics.warnings.push(`${loaded.failed} card-data lookups failed. Retry data before assuming the budget is the problem.`);
    o.custom = { ...idea.deck, budget: budget === Infinity ? null : budget, budgetBasis: "purchase", cards: plan.deck.cards, buildDiagnostics: o.diagnostics };
    o.msg = `${plan.open ? "Incomplete draft" : "Complete 100-card list"}: ${plan.cost == null ? "purchase cost unverified" : `${usd(plan.cost)} for new copies currently listed`}${plan.open ? `; ${plan.open} slots still open` : ""}. Purchase budget: ${budget === Infinity ? "no cap" : usd(budget)}.`;
  } catch (e) {
    o.error = e.message || "The deck could not be built.";
    o.msg = `Build failed: ${o.error} No completed list is available to save.`;
  } finally {
    o.busy = false;
    saveCatalogSoon();
    if (S.ui.sheetCtx?.type === "idea" && S.ui.ideas.open === o) openIdea(o.i);
  }
};
// app.js C.ideaPick and A.ideaSelect (6770-6783).
IA.ideaPick = (t) => {
  const sel = S.ui.ideas.sel;
  if (t.checked) sel.add(t.dataset.name);
  else sel.delete(t.dataset.name);
  ideaSelWords = sel.size ? `${sel.size} selected` : "Nothing selected";
};
IA.ideaSelect = (t) => {
  const d = ideaDeck(),
    rows = rowsFor({ ...d, id: "idea-preview" });
  S.ui.ideas.sel = new Set(t.dataset.mode === "missing" ? rows.filter((r) => r.missing).map((r) => r.name) : t.dataset.mode === "all" ? rows.map((r) => r.name) : []);
  openIdea(S.ui.ideas.open.i);
};
// What C.ideaPick wrote into #ideaSelCount until the sheet is drawn again ("Nothing selected" at none).
let ideaSelWords = null;
const ideaPicked = () => {
  const d = ideaDeck(),
    sel = S.ui.ideas.sel;
  return aggregateCards(d.cards).filter((c) => sel.has(c.name));
};
// views.js ideaSheet's markup, read back in the order the sheet shows it.
function ideaSheetModel() {
  const I2 = S.ui.ideas, o = I2.open, idea = o && I2.cache[o.i];
  if (!idea || S.ui.sheetCtx?.type !== 'idea') return {missing: true};
  const t = tree(ideaSheetView(idea, ideaDeck(), o, I2.sel || new Set()));
  const words = n => text(n);
  const btn = b => b && {...press(b), disabled: b.attrs.disabled !== undefined};
  const blocks = [];
  for (const k of t.kids || []) {
    if (!k.tag) continue;
    if (cls('sheet-head')(k)) continue;
    if (cls('idea-hero')(k)) blocks.push({k: 'hero', art: picture(one(k, tagIs('img'))), plan: words(one(k, cls('chip')))});
    else if (cls('impact')(k)) blocks.push({k: 'impact', tiles: all(k, cls('imp')).map(x => ({label: words(one(x, tagIs('small'))), value: words(one(x, tagIs('b')))}))});
    else if (k.tag === 'p' && cls('eyebrow')(k)) blocks.push({k: 'eyebrow', text: words(k)});
    else if (k.tag === 'p' && cls('warn-text')(k)) blocks.push({k: 'warn', text: words(k)});
    else if (k.tag === 'p' && cls('foot')(k)) blocks.push({k: 'foot', text: words(k)});
    else if (k.tag === 'p' && k.attrs.id === 'ideaMsg') blocks.push({k: 'status', text: words(k)});
    else if (k.tag === 'button') blocks.push({k: 'save', ...btn(k)});
    else if (cls('note')(k)) blocks.push({k: 'note', text: words(k)});
    else if (cls('chips')(k)) blocks.push({k: 'chips', chips: all(k, tagIs('button')).map(b => ({...btn(b), v: b.attrs['data-v'] || ''}))});
    else if (cls('custom-budget-row')(k)) { const l = one(k, tagIs('label')), i = one(k, tagIs('input'));
      blocks.push({k: 'custom', label: labelWords(l), value: i?.attrs.value || '', placeholder: i?.attrs.placeholder || '', disabled: i?.attrs.disabled !== undefined, button: btn(one(k, tagIs('button')))}); }
    else if (cls('build-overlay')(k)) blocks.push({k: 'overlay', title: words(one(k, tagIs('b'))), msg: words(one(k, x => x.attrs.role === 'status')), note: words(one(k, tagIs('small')))});
    else if (cls('sel-bar')(k)) blocks.push({k: 'selbar', count: ideaSelWords ?? words(one(k, x => x.attrs.id === 'ideaSelCount')), buttons: all(k, tagIs('button')).map(b => ({...btn(b), mode: b.attrs['data-mode'] || ''}))});
    else if (cls('deck-viewer')(k)) {
      const view = one(k, cls('deck-view-switch'));
      blocks.push({k: 'cards', view: k.attrs['data-deck-view'] || 'gallery', viewLabel: words(one(one(k, cls('deck-view-toolbar')), tagIs('span'))),
        views: view ? all(view, tagIs('button')).map(b => ({mode: b.attrs['data-mode'], label: b.attrs['aria-label'] || b.attrs.title || '', on: b.attrs['aria-checked'] === 'true', icon: icon(svgIn(b))})) : [],
        groups: all(k, x => x.tag === 'details' && cls('group')(x)).map(g => { const sum = one(g, tagIs('summary')), first = one(sum, tagIs('span')), em = one(first, tagIs('em'));
          const head = words(first);
          return {name: head.slice(0, head.length - words(em).length).trim(), count: words(em), price: words(one(sum, cls('muted'))),
            rows: all(g, cls('pick-row')).map(r => { const box = one(r, tagIs('input')), main = one(r, cls('pick-main')), copy = one(main, cls('deck-compact-copy')), st = one(copy, tagIs('small')), side = one(r, cls('pick-side'));
              return {name: box?.attrs['data-name'] || '', label: words(one(copy, tagIs('b'))), picked: box?.attrs.checked !== undefined, aria: box?.attrs['aria-label'] || '',
                art: picture(one(main, tagIs('img'))), set: words(one(copy, cls('set-badge'))), rarity: words(one(copy, cls('tag'))),
                status: words(st), short: cls('short')(r), mana: all(one(side, cls('mana')), tagIs('img')).map(i => ({src: i.attrs.src || '', alt: i.attrs.alt || ''})),
                price: words(one(side, tagIs('b')))}; })};
        })});
    }
    else if (cls('inline-pick')(k)) { const sel = one(k, tagIs('select')); blocks.push({k: 'deckpick', label: sel?.attrs['aria-label'] || '', options: optionsOf(sel), button: btn(one(k, tagIs('button')))}); }
    else if (cls('idea-actions')(k)) blocks.push({k: 'actions', buttons: all(k, tagIs('button')).map(btn)});
  }
  const head = one(t, cls('sheet-head'));
  return {i: o.i, title: words(one(head, tagIs('h2'))), close: one(head, tagIs('button'))?.attrs['aria-label'] || 'Close', busy: !!o.busy, error: o.error || '', blocks};
}
// app.js's writes from the idea sheet and the Ideas tab (6789-6845, 7607), verbatim but for toast(), $() (the app sends the fields:
// [d.deck] #ideaDeckPick), closeSheet and go (made: the deck to open, or the page).
Object.assign(writeActs, {
  async ideaSaveAll(d) {
    if(S.ui.ideas.open?.busy)return void toasts.push({text: "Wait for the deck preview.", undo: false});
    if(S.ui.ideas.open?.error)return void toasts.push({text: "The build failed. Retry before saving a draft.", undo: false});
    const idea = S.ui.ideas.cache[S.ui.ideas.open.i],
      preview = structuredClone(ideaDeck()), count = sumQty(preview.cards), incomplete = count !== 100, needsReview = !!mtgPower(preview).readiness?.provisional,
      deck = withSnapshot({ ...preview, id: uid(), name: idea.commander.name.split(",")[0] + " · " + idea.plan, versions: [] }, incomplete ? "Started incomplete draft from a deck idea" : needsReview ? "Started draft needing deck checks" : "Started from a deck idea");
    await commit((s) => {
      s.decks.push(deck);
      s.activeDeck = deck.id;
    }, { msg: incomplete ? `Saved incomplete draft (${count}/100 cards).` : needsReview ? "Saved draft (100/100 cards; deck checks need review)." : "Saved complete 100-card list as a new deck." });
    if (S.ui.sheetCtx?.type === 'idea') S.ui.sheetCtx = null;
    made = JSON.stringify({go: "deck", id: deck.id, tab: "cards"});
  },
  async ideaToDeck(d) {
    const picked = ideaPicked(),
      id = d.deck,
      dk = deckOf(id);
    if (!picked.length) return void toasts.push({text: "Tick some cards first.", undo: false});
    if (!dk) return void toasts.push({text: "Pick a deck.", undo: false});
    await commit((s) => {
      const i = s.decks.findIndex((x) => x.id === id);
      let deck = withSnapshot(s.decks[i], "Before adding from an idea");
      for (const c of picked) if (!deck.cards.some((x) => key(x.name) === key(c.name))) deck = mergeDeckCard(deck, c.name, c.qty);
      s.decks[i] = deck;
    }, { msg: `${picked.length} cards added to ${dk.name}.` });
  },
  async ideaWish() {
    const picked = ideaPicked();
    if (!picked.length) return void toasts.push({text: "Tick some cards first.", undo: false});
    await commit((s) => {
      for (const c of picked) {
        const own = inventory(s.collection, c.name, s.decks).available;
        if (!s.wishlist.some((w) => key(w.name) === key(c.name))) s.wishlist.push({ id: uid(), name: c.name, qty: own + c.qty, finish: "nonfoil" });
      }
    }, { msg: `${picked.length} cards added to your wishlist.` });
  },
  async ideaOwn(d) {
    const picked = ideaPicked();
    if (!picked.length) return void toasts.push({text: "Tick the cards you own.", undo: false});
    if (!ask(`Add ${sumQty(picked)} cards to your collection as cards you own?`, d.confirmed)) return;
    await commit((s) => {
      for (const c of picked) s.collection.push({ id: uid(), name: c.name, qty: c.qty, set: "", collectorNumber: "", finish: "nonfoil", language: "en", condition: "Near Mint", location: "", reserved: 0, printingId: null, printingVerified: false, nameVerified: !!meta(c.name), raw: { acquisition: "Added from deck idea" } });
    }, { msg: `${sumQty(picked)} cards added to your collection.` });
  },
  // app.js A.ideaBuy (6838) and buyMtg (4084): the shopping list copied, then TCGplayer's Mass Entry (buy.js asks first).
  async ideaBuy(d) {
    await siteRun(async () => {
      const dk = ideaDeck(),
        rows = rowsFor({ ...dk, id: "idea-preview" }),
        sel = S.ui.ideas.sel,
        list = rows.filter((r) => r.missing && (!sel.size || sel.has(r.name))).map((r) => ({ name: r.name, qty: r.missing }));
      if (!list.length) return void toasts.push({text: "You already own everything selected.", undo: false});
      await buyMtg(list);
    }, d, {});
  },
  // app.js A.loadExample (7607): asks before replacing anything, then the example collection replaces every game's workspace (the old
  // one kept as the recovery copy, app.js replaceWorkspace) and Collection opens (made).
  async loadExample(d) {
    const hasData = [S.state, ...Object.values(S.state.tcg || {})].some((game) => ["collection", "decks", "wishlist", "references", "notes"].some((field) => game[field]?.length));
    if (hasData && !ask("Replace all collections, decks, wishlists and notes across every game with example data? Your current workspace becomes the recovery copy.", d.confirmed)) return;
    const names = ["Krenko, Mob Boss", "Goblin Instigator", "Sol Ring", "Arcane Signet", "Talrand, Sky Summoner", "Counterspell", "Mountain", "Island"];
    const st = blank();
    st.example = true;
    st.collection = names.filter((n) => meta(n)).map((n) => ({ id: uid(), name: n, qty: ["Mountain", "Island"].includes(n) ? 12 : 1, set: "", collectorNumber: "", finish: "nonfoil", condition: "Near Mint", language: "en", location: "Example", reserved: 0, printingVerified: false, raw: {} }));
    await queueWorkspaceWrite(async () => {
      siteRecovery = JSON.stringify(stripCache(S.state));
      const valid = normalize(structuredClone(st));
      if (tcgPrev !== undefined) valid.settings.game = S.state.settings?.game;
      S.state = valid; conditionWorkspaceRevision++; lastUndo = null; commits++;
      useMyPrices(S.state.myPrices);
    });
    made = JSON.stringify({go: "collection"});
  },
});
// app.js buyMtg (4084), verbatim but for toast(); copyText is app.js copyText (the clipboard, siteRun's).
async function buyMtg(items) {
  const rows = [];
  for (const r of aggregateCards(items).filter(r => r.qty > 0)) {
    const choice = S.state.priceChoices?.[key(r.name)], c = meta(r.name);
    if (choice) {
      let chosen = choice.set && choice.cn ? { id: choice.id, name: r.name, set: choice.set, set_name: choice.setName, collector_number: choice.cn } : S.state.printings?.[choice.id] || (c?.id === choice.id ? c : null);
      if (!chosen && choice.id) {
        try { chosen = await api("/cards/" + encodeURIComponent(choice.id)); } catch {}
      }
      if (!chosen?.set || !chosen.collector_number || key(chosen.name) !== key(r.name) || chosen.id !== choice.id) {
        toasts.push({text: `The selected printing for ${r.name} needs verification. Choose it again before creating its shopping list; no other printing was substituted.`, undo: false});
        return true;
      }
      rows.push({ qty: r.qty, name: r.name.split(" // ")[0], set: chosen.set_name, code: chosen.set, num: chosen.collector_number, finish: choice.finish || "nonfoil" });
    } else {
      const low = cheapestKnown(key(r.name)), priced = low?.usd != null && low.set && (cardPrice(c) === null || low.usd <= cardPrice(c));
      rows.push({ qty: r.qty, name: r.name.split(" // ")[0], set: priced ? low.setName : c?.set_name, code: priced ? low.set : c?.set, num: priced ? low.cn : c?.collector_number, finish: "nonfoil" });
    }
  }
  // This app's Mass Entry serializer cannot transmit foil/etched finishes.
  // Preserve the requested finish in a checklist instead of silently losing it.
  if (rows.some(r => r.finish !== "nonfoil")) {
    await appCopyText(rows.map(r => `${r.qty} ${r.name}${r.code ? ` [${r.code.toUpperCase()}]${r.num ? " " + r.num : ""}` : ""} · ${r.finish}`).join("\n"), "Exact printing/finish checklist copied. Match these finishes at the seller; no cart was opened or purchase made.");
    return true;
  }
  return buyOnTcgplayer("mtg", await massLines("mtg", rows));
}
// app.js copyText (1021): siteRun's clipboard always takes it, so the download fallback never runs here.
async function appCopyText(t, msg) {
  await navigator.clipboard.writeText(t);
  toasts.push({text: String(msg), undo: false});
}


// ---- Build a deck for Yu-Gi-Oh! and Pokémon (deck-experience.js, as app.js wires it: createDeckExperience over createDeckPipeline with
// tcg.js as T). Magic's runs in the WebView (deck-flow-entry.mjs); the other games' run here, where tcg.js and the workspace already
// are, with the same calls (flowOpen, flowSetup, flowRandom, flowGenerate, flowBudget, flowAdjust, flowSaveData, flowSaved,
// flowExport) and the same setup and result models (deck-flow-models.mjs). tcg.js's c.openDeckFlow (openBuild, A.tBuild) hands its
// request to the app (acted openDeckFlow), which opens the native Build a deck on it.
let flowPipeline = null;
flowUseDocument(new SiteDocument());
const flowPipe = () => { tcgReady(); return flowPipeline ||= createDeckPipeline({S, T: TcgAll, api, resolve, resolveNames, cacheCard, meta, priceOf, inv, tcgCtx}); };
const flowResults = new Map(), flowThemes = {};
let flowSeq = 0, flowCurrent = 0, flowStatus = '', flowRun = null;
// Where openDeckFlow's request goes: the panel that was tapped (acted openDeckFlow) or, for a write act, [made].
let flowAskPanel = null, flowAsked = null;
function flowAskedFor(request) {
  flowAsked = request;
  if (flowAskPanel && panel === flowAskPanel) panel.acted = {act: 'openDeckFlow', data: {request: JSON.stringify(request)}};
  flowAskPanel = null;
}
const flowRegister = result => { const id = 'tdeck-result-' + (++flowSeq); flowResults.set(id, {result, saved: false}); while (flowResults.size > 30) flowResults.delete(flowResults.keys().next().value); return id; };
const flowSetup = (request, status = '', error = false) => flowSetupOf(request, status, error, deckSetupMarkup, flowPipe().formats, flowThemes[request.game]);
const flowResult = id => flowResultOf(id, flowResults.get(id), deckResultMarkup);
// tcg.js runs keyed to the open game (settings.game): the request's.
const flowGame = r => { const G = r?.game; if (G === 'ygo' || G === 'ptcg') tcgFocus(G, S.ui.view === 'home' ? 'home' : 'decks'); return G; };
const flowLive = me => () => me === flowCurrent;
// deck-experience.js open(): the format's default (ygo tcg, ptcg standard), the saved preferences, then the button's request; Yu-Gi-Oh!'s
// archetypes load into Theme (pipeline.themes), or the site's line when they can't.
const flowOpened = (request, prefs) => { const game = request.game, formats = flowPipe().formats[game], fallback = formats.find(f => f.id === ({ygo: 'tcg', ptcg: 'standard'}[game])) || formats[0];
  return {game, format: fallback.id, budget: '', budgetBasis: 'total', budgetMode: 'cap', preferOwned: true, ...(prefs || {}), ...request}; };
const flowTcgCalls = {
  flowWorkspace: () => true,
  async flowOpen(a) {
    const r = flowOpened(a.request || {}, a.prefs); flowGame(r);
    if (r.game === 'ygo' && !flowThemes.ygo) { try { flowThemes.ygo = await flowPipe().themes('ygo'); } catch { return flowSetup(r, 'Archetypes could not load. You can still build around your card, or reopen to retry.'); } }
    return flowSetup(r);
  },
  flowSetup: a => { flowGame(a.request); return flowSetup(a.request, a.status || '', !!a.error); },
  // A.flowRandom (app.js randomBuildSeed: the pipeline's resolveSeed for these games).
  async flowRandom(a) {
    const me = ++flowCurrent; flowGame(a.request);
    const r = {...a.request, seed: '', seedCard: null, seedCards: [], ygoPurchaseSelections: {}, ptcgPurchaseSelections: {}, randomSeed: Math.floor(Math.random() * 1e9)};
    const card = await flowPipe().resolveSeed(r);
    if (me !== flowCurrent) return {cancelled: true};
    return flowSetup({...r, seed: card.name, seedCard: card, seedCards: [card]});
  },
  async flowGenerate(a) {
    const me = ++flowCurrent; flowStatus = 'Finding a coherent plan…'; flowGame(a.request);
    const result = await flowPipe().build(a.request, {current: flowLive(me), onStatus: m => { if (me === flowCurrent) flowStatus = String(m); }});
    if (me !== flowCurrent) return {cancelled: true};
    flowStatus = '';
    return result.ok ? {ok: true, model: flowResult(flowRegister(result))} : {ok: false, message: result.message, setup: flowSetup(a.request, result.message, true)};
  },
  flowBudget: a => { customBudget(a.budget); return true; },
  async flowAdjust(a) {
    const item = flowResults.get(a.id); if (!item) throw Error('Your account or collection changed. Rebuild before opening this deck.');
    const budget = customBudget(a.budget), me = ++flowCurrent; flowStatus = 'Finding cards for your updated budget…'; flowGame(item.result.request);
    const result = await flowPipe().build({...item.result.request, budget, previousDeck: item.result.deck, previousBudget: item.result.request.budget, previousEstimate: item.result.pricing.estimate},
      {current: flowLive(me), onStatus: m => { if (me === flowCurrent) flowStatus = String(m); }});
    if (me !== flowCurrent) return {cancelled: true};
    flowStatus = '';
    return result.ok ? {ok: true, model: flowResult(flowRegister(result))} : {ok: false, message: result.message};
  },
  flowSaveData(a) {
    const item = flowResults.get(a.id); if (!item) throw Error('Your account or collection changed. Rebuild before saving.');
    if (!flowPipe().recheck(item.result)) throw Error('The list no longer passes its checks. Rebuild before saving.');
    return {deck: item.result.deck, request: item.result.request};
  },
  flowSaved: a => { const item = flowResults.get(a.id); if (item) item.saved = true; return item ? flowResult(a.id) : null; },
  // A.flowExport for these games: "qty name [zone]" lines, Pokémon's with [id · variant].
  flowExport(a) {
    const item = flowResults.get(a.id); if (!item) throw Error('This deck is no longer available.'); const r = item.result;
    return {text: r.rows.map(row => `${row.qty} ${row.name}${row.zone !== 'main' ? ' [' + row.zone + ']' : ''}${r.request.game === 'ptcg' ? ' [' + row.id + (row.selection?.variant ? ' · ' + row.selection.variant : '') + ']' : ''}`).join('\n')};
  },
};
// tcg.js A.tPickSeeds' sheet (tcgPickSheet) as data: the intro, the filter's placeholder, the player's cards (id, name, picture, ×qty)
// and the empty line; the app keeps the ticks (C.tSeedToggle) and filters by name (I.tSeedQ), then builds with them (A.tSeedGo).
function seedPickModel(G) {
  tcgFocus(G, 'decks');
  const host = flowDraw(TcgAll.tcgPickSheet()), q = sel => host.querySelector(sel);
  const text = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  return {title: text(q('.sheet-head h2')), intro: text(q('p.muted.small')), placeholder: q('input[type=search]')?.getAttribute('placeholder') || '',
    rows: host.querySelectorAll('.seed-row').map(l => ({id: l.querySelector('input')?.getAttribute('value') || '', name: text(l.querySelector('.ellip')), qty: text(l.querySelector('small')),
      art: l.querySelector('img')?.getAttribute('src') || '', key: l.dataset.name || ''})),
    empty: text(q('.seed-list > p')), go: text(q('#seedGo'))};
}

// ---- Compare cards (gap audit H1): app.js A.compareOpen / compareFrom / compareReset / compareLookup / compareSwap and tcg.js
// A.tCompareOpen / tCompareFrom / tCompareClear / tCompareLookup with their sheets (views.js compareSheet, tcgcompare.js
// tcgCompareSheet), read back as data. The pair is the site's own (S.ui.compare, tcg.js ui(g).compare).
let compareRun = null;
const cmpPair = G => (G === 'mtg' ? (S.ui.compare ||= [null, null]) : (tcgUi(G).compare ||= [null, null]));
function compareModelOf(G) {
  const pair = cmpPair(G), html = G === 'mtg' ? compareSheetView() : tcgCompareSheet(G, pair), t = tree(html);
  const sides = all(one(t, cls('cmp')), cls('cmp-side')).map((n, i) => {
    if (cls('pick')(n)) return {empty: true, i};
    const c = pair[i] || {}, spans = all(n, x => x.tag === 'span' && !cls('chip')(x) && !(x.attrs.class || '').includes('mana') && text(x));
    return {i, name: text(one(n, tagIs('b'))), picture: picture(one(n, tagIs('img'))), id: G === 'mtg' ? '' : String(c.id ?? ''),
      lines: spans.filter(x => !cls('chips')(x)).map(text).filter(Boolean), chips: all(n, cls('chip')).map(text),
      facts: all(one(n, cls('cmp-facts')), tagIs('div')).map(f => [text(one(f, tagIs('dt'))), text(one(f, tagIs('dd')))]),
      effects: text(one(one(n, cls('cmp-effects')), tagIs('p')))};
  });
  const panel = one(t, cls('panel')), swap = one(panel, x => x.attrs['data-act'] === 'compareSwap');
  return {game: G, title: text(one(one(t, cls('sheet-head')), tagIs('h2'))), sides, verdict: text(one(panel, tagIs('p'))), swap: swap ? text(swap) : '',
    foot: text(one(t, cls('foot'))), clear: !!one(t, x => x.attrs['data-act'] === 'compareReset') || pair.some(Boolean)};
}
// ---- The app's own lookups (ai-tools.js makeAskTools: plain app code, no AI). The search box's answer card reads them, and a
// tapped tile runs tools.open, whose moves (A.card, A.tCard, go, the draft builders) come back to the app as where to go (askDest).
// The AI chat that once sat on top of them (Ask CardStashy, /api/ai/ask) is gone.
let askRun = null, askDest = null, askToolsSet = null;
function askTools() {
  if (askToolsSet) return askToolsSet;
  tcgReady();
  const dest = d => { askDest = d; return true; };
  const A = {
    card: t => dest({to: 'card', game: 'mtg', name: t?.dataset?.name || '', id: t?.printing?.id || ''}),
    tCard: t => dest({to: 'card', game: t?.dataset?.game || TcgAll.game(), id: String(t?.dataset?.id || ''), setId: t?.dataset?.setId || ''}),
    // The tournament deck's sheet (A.mtgProven / tA.tMetaDeck), opened here as Home's is (provenHome); the app draws it (MetaDeckHost).
    mtgProven: t => { toasts = []; provenOpened = false; mtgFocus(); mtgProven(t); return dest({to: 'meta', game: 'mtg'}); },
    tMetaDeck: async t => { const g = TcgAll.game(); toasts = []; provenOpened = false; tcgFocus(g, 'home'); await provenRun(() => TA.tMetaDeck(t)); return dest({to: 'meta', game: g}); },
    helpOpen: t => dest({to: 'help', id: t?.dataset?.id || ''}),
    wikiOpen: t => dest({to: 'wiki', game: t?.dataset?.game || TcgAll.game(), topic: t?.dataset?.topic || ''}),
    setGame: t => { askFocus(t?.dataset?.game || 'mtg'); return true; },
  };
  askToolsSet = makeAskTools({S, T: TcgAll, A, go: hash => dest({to: 'route', hash: String(hash || '')}), toast: text => { if (text) toasts.push({text: String(text), undo: false}); },
    esc, api, resolve, resolveNames, cacheCard, loadSetIndex, loadMetaData: loadMeta, metaState, MTG_META_FORMATS,
    allMeta: () => Object.fromEntries(Object.entries(allCachedMeta()).map(([k, v]) => [k, v.data])), priceOf, inv, meta, collectionValue, lotPrice, mtgPower, shownPower, tcgCtx,
    // app.js openTcgBuild: A.tBuild on the card, whose openDeckFlow request the app's Build a deck opens (as tMetaBuild's does).
    openTcgBuild: async (g, id, budget, format) => {
      tcgFocus(g, 'decks'); flowAskPanel = null; flowAsked = null;
      await TA.tBuild({dataset: {id: String(id), format}, initialBudget: budget > 0 ? budget : ''});
      return dest(flowAsked ? {to: 'build', game: g, request: flowAsked} : {to: 'none'});
    },
    // app.js openMtgDraft opens the drafted list in the site's build sheet; the app opens its Build a deck on the same request
    // (the build-around or commander, format and budget), as the site's own deck builder (deckExperience) does for Ask today.
    // The deck builder run inside search (ai-tools.js build_now): the same pipeline the Build a deck page runs.
    buildFlow: (request, options) => flowPipe().build(request, options),
    openMtgDraft: draft => dest({to: 'build', game: 'mtg', request: {game: 'mtg', seed: draft.commander || draft.buildAround || '', format: draft.format || 'Standard',
      budget: Number.isFinite(draft.budget) ? draft.budget : ''}})});
  return askToolsSet;
}
function askFocus(G) { tcgReady(); tcgFocus(G, S.ui.view || 'search'); }
function askShowRun(s) {
  askDest = null; const run = askRun = {done: false};
  (async () => { askFocus(s?.game || TcgAll.game()); await askTools().open(s); })().then(() => { run.done = true; run.dest = askDest; }, e => { run.done = true; run.error = String(e?.message || e); });
}
// ---- The search box answers questions (Randall 13 Nov: one search, no AI): answer-search.js reads the typed words into one of
// the app's own lookups (the same ai-tools.js lookups Ask ran), answer-run.js fills the answer card from what it returns. Nothing
// is posted to /api/ai. The app draws the card ({read chips, say, fact, quote, tiles, buttons, source}); a tile is opened by
// askShow as before, a button says where the app goes ({to: show | wiki | route | search | discover | judge}).
let answerOut = null, answerTicket = 0;
function answerTile(s, i) {
  let b = null; try { b = one(tree(askTools().preview(s, i, {compact: s.kind === 'card'})), tagIs('button')); } catch {}
  if (!b) return {show: s, title: s.label || s.ref || '', lines: [], price: '', art: '', label: ''};
  let show = s; try { show = JSON.parse(b.attrs['data-ask-show']) || s; } catch {}
  const im = one(b, tagIs('img'));
  return {show, title: text(one(b, tagIs('b'))) || s.label || '', lines: all(b, tagIs('small')).map(text).filter(Boolean), price: text(one(b, tagIs('em'))) || text(one(b, cls('art-price'))),
    art: im ? abs(im.attrs.src || '') : '', label: b.attrs['aria-label'] || ''};
}
function answerDest(b, plan) {
  const g = plan.game;
  if (b.item) return {to: 'show', show: b.item};
  if (b.judge) return {to: 'judge', game: g, text: plan.P.raw};
  if (b.build) return {to: 'build', game: b.build.game || g, request: b.build};
  if (b.discover) { if (g !== 'mtg') return {to: 'discover', game: g, kind: b.discover.kind, value: b.discover.value};
    const spec = b.discover.kind === 'artist' ? {q: 'a:"' + b.discover.value + '"'} : cardDiscoverySpec(g, b.discover.kind, b.discover.value);
    return spec?.q ? {to: 'search', game: g, q: spec.q, sort: ''} : {to: 'none'}; }
  if (b.search) return {to: 'search', game: g, q: b.search.q, sort: b.search.order === 'usd' ? (b.search.dir === 'asc' ? 'usdAsc' : 'usd') : ''};
  if (b.route && /^#wiki\//.test(b.route)) return {to: 'wiki', game: g, topic: decodeURIComponent(b.route.slice(6))};
  return {to: 'route', game: g, hash: b.route || ''};
}
function answerModel(q, plan, a) {
  const read = (plan.read || []).map(c => ({label: c.label, kind: c.kind, choices: c.fix && (c.kind === 'format' || c.kind === 'game') ? fixChoices(plan, c.kind) : []}));
  const base = {q, game: plan.game, intent: plan.intent, hand: plan.hand || '', read};
  if (!a) return {...base, state: 'none'};
  let n = 0; const tile = s => answerTile(s, n++);
  return {...base, state: 'done', answer: {ok: !!a.ok, say: a.say || '', strong: a.strong || '', wiki: a.say === 'From the wiki page', fact: a.fact || null, quote: a.quote || '',
    // The other asks on the same line sit under the first answer, one per line, in the note's own style.
    note: [a.note || '', ...[...(a.vs || []), ...(a.also || [])].map(x => x.ask + ': ' + x.text)].filter(Boolean).join('\n'), source: a.source || '',
    miss: a.miss || '', ask: a.ask ? {ask: a.ask.ask, choices: (a.ask.choices || []).map(c => ({label: c.name, show: {kind: 'set', game: plan.game, ref: String(c.id || c.code), label: c.name}}))} : null,
    items: (a.items || []).map(tile), moreLabel: a.moreLabel || 'Also', more: (a.more || []).map(tile),
    // Rows (a deck's cards, the cards that break a format, price moves), a progress bar, and the "Ask more" chips, each a whole question.
    rows: (a.rows || []).map(r => ({label: r.label, value: r.value || '', tone: r.tone || ''})), meter: a.meter ? {pct: Math.max(0, Math.min(100, Number(a.meter.pct) || 0)), label: a.meter.label || ''} : null,
    follow: (a.follow || []).map(f => ({label: f.label, q: f.q})),
    buttons: (a.buttons || []).map(b => ({label: b.label, dest: answerDest(b, plan)})), others: (a.others || []).map(t => ({label: t, dest: {to: 'wiki', game: plan.game, topic: t}}))}};
}
// app.js homeAnswer.plan / run, with the open screen's set and card handed in by the app ([o] = {fix: {format, game}, set: {id, code, name}, card: {name}}).
function answerPlan(g0, q, o = {}) {
  const fix = o.fix || {}, g = gameOfLabel(fix.game) || g0, mtg = g === 'mtg';
  tcgReady();
  const sets = (mtg ? S.ui.sets.list : tcgUi(g).sets?.list) || [];
  return {g, mtg, sets, plan: planQuery(q, {game: g, about: answerAbout(), myDecks: (mtg ? S.state.decks : TcgAll.gs(g).decks).map(d => d.name), fix: {format: fix.format, game: gameOfLabel(fix.game) || undefined}, formatLast: {mtg: S.ui.mtgMeta?.format || undefined},
    sets: sets.filter(x => !x.digital).map(x => ({id: mtg ? x.code : x.id, code: x.code || x.id, name: x.name})), screen: {set: o.set || null, card: o.card || null}})};
}
function answerStart(g0, q, o = {}) {
  const my = ++answerTicket; answerOut = null;
  if (!String(q || '').trim()) { answerOut = {q: '', state: 'none'}; return; }
  (async () => {
    let {g, mtg, sets, plan} = answerPlan(g0, q, o);
    // A question about sets needs the set list: it is loaded once, then the words are read again.
    if (!sets.length && (/\bset\b|\bsets\b|\bcome out\b|\bcame out\b|\breleased?\b|\bcards? in\b/i.test(q) || plan.intent === 'unknown' || plan.call?.pick === 'maybe')) {
      try { if (mtg) await loadSetIndex(); else await tcgCtx.loadSets(g); } catch {}
      if (my !== answerTicket) return;
      plan = answerPlan(g0, q, o).plan;
    }
    if (!plan.call && !plan.missing?.length && plan.intent !== 'unknown') { answerOut = answerModel(q, plan, null); return; }
    answerOut = {...answerModel(q, plan, null), state: 'loading'};
    let a = null;
    try {
      if (plan.game !== 'mtg') askFocus(plan.game);
      a = await answerFor(plan, askTools(), {
        current: () => my === answerTicket,
        // A rules question: the rulebook kept in the app, read by judge-search.js (no AI).
        judge: async (game, question) => judgeAnswer(await loadRulePack(game), question, {glossary: game === 'ptcg' ? PTCG_GLOSSARY : game === 'ygo' ? YGO_GLOSSARY : []}),
        wikiArticle: async (game, title) => { const d = await readGameWikiArticle(game, title); return d?.status === 'available' ? d.article : null; },
        cardSearch: async ({game, q, order, dir, limit}) => {
          if (game !== 'mtg') return [];
          const d = await api('/cards/search?' + new URLSearchParams({q: q + ' game:paper', order, dir, unique: 'cards'})).catch(e => { globalThis.__answerError = String(e?.message || e); return e?.status === 404 ? {data: []} : null; });
          if (!d) return null; // the card database did not answer: said as that, never as "nothing matched"
          return (d?.data || []).slice(0, limit || 3).map(c => { cacheCard(c); return {name: c.name, price: Number(c.prices?.usd) || null}; });
        }});
    } catch { a = {ok: false, miss: 'That lookup failed. Check your connection and try again.', items: [], more: [], buttons: []}; }
    if (my !== answerTicket) return;
    // An answer that is still working (the deck builder making a deck): shown at once as it stands, finished when the build lands.
    if (a?.finish) {
      answerOut = {...answerModel(q, plan, a), state: 'loading'};
      const b = await Promise.resolve().then(() => a.finish()).catch(() => null);
      if (my !== answerTicket) return;
      if (b) a = b; else { a = {...a, rows: [], note: 'The deck builder could not finish this one. Open it to build the deck.'}; }
    }
    answerOut = answerModel(q, plan, a);
  })().catch(e => { globalThis.__lastError = String(e?.stack || e); if (my === answerTicket) answerOut = {q, state: 'none'}; });
}
// "See them all in Search" for Magic: the words and the sort set on the Search page as app.js homeAnswer.act does, and the search started.
function answerSearch(q, sort) {
  mtgFocus(); searchGame = 'mtg';
  S.ui.db.term = String(q || ''); S.ui.db.filters = sort ? {sort} : {};
  dbInvalidate();
  dbSearch().catch(e => toasts.push({text: e?.message || 'Search failed.', undo: false}));
  return {term: S.ui.db.term, filters: S.ui.db.filters};
}
// ---- Ask a Judge, no AI (judge-search.js): the question is read into the rulebook's own terms and answered with the exact rule
// text from the rulebook kept in the app, as the site's judge-ui.js does. Nothing is sent to an AI service; a card named in the
// question brings its printed text, and its official rulings when the network is there (a miss just leaves them out).
const JUDGE_NAMES = {mtg: 'Magic', ptcg: 'Pokémon', ygo: 'Yu-Gi-Oh!'};
let judge = null, judgeNames = null;
const judgeRuleNumber = (game, r) => game === 'mtg' ? r.number : 'Page ' + (String(r.number).match(/p(\d+)$/)?.[1] || r.number);
const judgeRuleHead = (game, r) => game === 'mtg' ? (r.heading || '') : String(r.heading || '').replace(/\s*·\s*PDF page \d+$/, '');
const judgeDate = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); return m ? `${JUDGE_MONTHS[+m[2] - 1]}${m[3] ? ' ' + +m[3] + ',' : ''} ${m[1]}` : String(v || ''); };
const JUDGE_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
function judgeLine(e) {
  if (e.kind === 'question') return {who: 'me', text: e.text};
  if (e.kind === 'error') return {who: 'error', text: e.text};
  const a = e.answer, sure = a.status === 'answered';
  const rules = [a.lead, ...a.rules].filter(Boolean).slice(0, 3).map((r, n) => ({number: judgeRuleNumber(a.game, r), heading: judgeRuleHead(a.game, r), text: r.focus && r.focus !== r.text ? r.focus : r.text,
    whole: r.focus && r.focus !== r.text ? r.text : '', lead: n === 0 && sure, reference: r.reference, title: [judgeRuleNumber(a.game, r), judgeRuleHead(a.game, r)].filter(Boolean).join(' · '), quote: r.text}));
  const cards = (a.cards || []).filter(c => c.text || c.rulings.length).map(c => ({name: c.name, text: c.text, rulings: c.rulings.map(r => ({label: 'Official ruling' + (r.date ? ' · ' + judgeDate(r.date) : ''), text: r.text})),
    note: !c.rulings.length && c.rulingCount ? `This card has ${c.rulingCount} official ruling${c.rulingCount === 1 ? '' : 's'}; none match these words.` : ''}));
  return {who: 'judge', status: !rules.length && !cards.length ? 'none' : a.status, read: a.read, rules, cards,
    rulesLabel: sure ? '' : cards.length ? 'Rules for what these cards do' : 'Closest rules I found',
    terms: (a.terms || []).map(t => ({label: t.label, def: [t.def, ...(t.points || [])].join(' '), ours: !!t.ours})),
    foot: (a.edition ? `${a.edition.title}, ${judgeDate(a.edition.date)}. ` : '') + 'At an event, the judge there has the final say.',
    missTitle: 'That isn’t in the rulebook', missText: 'I only answer from the rules. Try naming a keyword, a step of the turn, or what happened at the table.', examples: (JUDGE_EXAMPLES[a.game] || []).slice(0, 2)};
}
function judgeModelOf() {
  const s = judge; if (!s) return {open: false};
  return {open: true, game: s.game, eyebrow: `${JUDGE_NAMES[s.game]} rulebook · offline`, title: 'Ask a Judge', placeholder: 'Ask about a rule, keyword or card…',
    hello: 'What happened at the table?', blurb: 'Name a keyword, a step of the turn or a card. You get the exact rule, with its number.',
    cards: s.cards.map(c => ({name: c.name})), examples: JUDGE_EXAMPLES[s.game] || [], lines: s.entries.map(judgeLine), busy: !!s.busy};
}
// A card the Judge shows: its printed text from the app's card data, and its official rulings if they can be read now.
async function judgeCard(name) {
  const c = meta(name) || await resolve(name).catch(() => null); if (!c) return null;
  const text = [c.oracle_text, ...(c.card_faces || []).map(f => f.oracle_text)].filter(Boolean).join('\n');
  const r = c.id ? await api('/cards/' + encodeURIComponent(c.id) + '/rulings').catch(() => null) : null;
  return {name: c.name, text, keywords: c.keywords || [], rulings: (r?.data || []).map(x => ({date: x.published_at || '', text: x.comment || ''}))};
}
// The card names the app ships (the list the play engine accepts), read once.
function judgeNameList() {
  return judgeNames ||= fetch(ENGINE_CARD_NAMES_FILE).then(r => r.ok ? r.text() : '').then(t => new Set(String(t).split('\n').map(n => n.trim().toLowerCase()).filter(Boolean))).catch(() => new Set());
}
// The answer for one question: the rulebook, the cards (the ones the Judge was opened on, then names typed in the question), the rules.
async function judgeWork(s, question) {
  const pack = await loadRulePack(s.game), cards = [];
  for (const c of s.cards) {
    let full = null;
    if (s.game === 'mtg' && !c.rulings) full = await judgeCard(c.name).catch(() => null);
    cards.push(full || c);
  }
  s.cards = cards.slice();
  if (s.game === 'mtg') {
    const names = await judgeNameList(), found = findCardNames(question, names, pack);
    for (const f of found) {
      if (cards.some(c => c.name.toLowerCase() === f.name)) continue;
      const card = await judgeCard(f.name).catch(() => null);
      if (card) cards.push(card);
    }
  }
  return judgeAnswer(pack, question, {format: s.format, cards, glossary: s.game === 'ptcg' ? PTCG_GLOSSARY : s.game === 'ygo' ? YGO_GLOSSARY : []});
}
function judgeAsk(text) {
  const s = judge, question = String(text || '').trim().slice(0, 400);
  if (!s || !question || s.busy) return;
  s.entries.push({kind: 'question', text: question});
  s.busy = judgeWork(s, question).then(
    answer => { s.busy = null; if (judge === s) s.entries.push({kind: 'answer', answer}); },
    e => { s.busy = null; globalThis.__lastError = String(e?.stack || e); if (judge === s) s.entries.push({kind: 'error', text: e?.message || 'The rulebook could not be opened.'}); });
}
// ---------------------------------------------------------------- Settings > Backup (gap audit S1): app.js 7564-7670
// app.js backupPayload (7564), verbatim but for saveable() (the player's own settings.game, as the account keeps it).
function backupPayload() {
  const st = saveable(), names = new Set();
  for (const e of st.collection) names.add(key(e.name));
  for (const d of [...st.decks, ...(st.references || [])]) for (const c of d.cards) names.add(key(c.name));
  for (const w of st.wishlist) names.add(key(w.name));
  const cache = {};
  for (const n of names) if (S.catalog[n]) cache[n] = S.catalog[n];
  return JSON.stringify({ ...backupEnvelope(st), cache });
}
// app.js readBackup (7625): [text] is the picked file's words (the app checks its size first too, as file.size).
function readBackup(text) {
  if (String(text).length > 60e6) throw Error("Backup is larger than 60 MB.");
  const raw = JSON.parse(text);
  return { next: normalize(raw), cache: raw.cache && typeof raw.cache === "object" ? raw.cache : {} };
}
// app.js replaceWorkspace (391) with recovery, notify and stamp: the copy it replaces is the recovery copy (siteRecovery, which the
// app keeps in this device's Earlier saves before writing the new one).
function replaceWith(next) {
  return queueWorkspaceWrite(async () => {
    siteRecovery = JSON.stringify(saveable());
    const valid = normalize(structuredClone(next));
    valid.lastSavedAt = new Date().toISOString();
    if (tcgPrev !== undefined) valid.settings.game = S.state.settings?.game;
    S.state = valid; conditionWorkspaceRevision++; lastUndo = null; commits++;
    useMyPrices(S.state.myPrices);
  });
}
// app.js C.checkBackup (7630): the line under the buttons.
function checkBackup(text) {
  try {
    const { next } = readBackup(text);
    return `✓ Valid backup: ${recoverySummary(next).copies} card copies, ${recoverySummary(next).decks} decks across all games, exported ${next.exportedAt ? new Date(next.exportedAt).toLocaleString() : "date unknown"}.`;
  } catch (e) {
    return "✕ Not a valid backup: " + e.message;
  }
}
Object.assign(writeActs, {
  // app.js C.restoreBackup (7638), signed in (the app saves only to an account): [d.text] the picked file.
  async restoreBackup(d) {
    try {
      const { next, cache } = readBackup(d.text);
      if (!ask(`Replace the workspace across all games with ${recoverySummary(next).copies} card copies and ${recoverySummary(next).decks} decks from this backup? The restored workspace will sync to your other devices. Your current data is saved as a recovery copy first.`, d.confirmed)) return;
      for (const [k, c] of Object.entries(cache)) if (!S.catalog[k]) S.catalog[k] = slim(c);
      S.catalogDirty = true;
      await replaceWith(next);
      toasts.push({text: "Backup restored.", undo: false});
    } catch (e) {
      toasts.push({text: "Restore failed — nothing changed. " + e.message, undo: false});
    }
  },
  // app.js A.restoreRecovery (7593): [d.text] a recovery copy's workspace, [d.at] when it was saved.
  async restoreRecovery(d) {
    try {
      const state = JSON.parse(d.text), summary = recoverySummary(state);
      if (!ask(`Restore ${summary.copies} card copies, ${summary.decks} decks and ${summary.wishlist} wishlist entries across all games from ${new Date(d.at).toLocaleString()}? This replaces this account's current workspace and will sync to your other devices. Your current workspace will be saved as another recovery copy first.`, d.confirmed)) return;
      await replaceWith(state);
      toasts.push({text: 'Recovery copy restored. Your previous workspace remains in Recovery.', undo: false});
    } catch (error) {
      toasts.push({text: 'Recovery could not be restored. ' + error.message, undo: false});
    }
  },
});

// ---- Card art saved once (Randall 13 Nov: "Put this saved pop in on art"): every picture a Collection tile, deck row or wishlist
// row draws, for every game, by the site's own choice of picture (ui.js cardImage for a Magic printing, artwork.js artworkSources
// for a Yu-Gi-Oh! or Pokémon card): the app saves each once on the phone and draws it from there (art/ArtKeep.kt). Decks first.
function artKeepList() {
  const out = [], seen = new Set(), add = u => { u = abs(u || ''); if (u && !seen.has(u)) { seen.add(u); out.push(u); } };
  const mtgCard = e => (e.printingId && S.state.printings?.[e.printingId]) || meta(e.name);
  for (const d of S.state.decks || []) for (const c of d.cards || []) { try { add(cardImage(mtgCard(c))); } catch {} }
  for (const e of S.state.collection || []) { try { add(cardImage(magicOwnedCard(e, S.state.printings?.[e.printingId]))); } catch {} }
  for (const w of S.state.wishlist || []) { try { add(cardImage(mtgCard(w))); } catch {} }
  for (const G of ['ygo', 'ptcg']) {
    let st; try { st = tcgGs(G); } catch { continue; }
    const ids = [...(st.decks || []).flatMap(d => Object.values(d.zones || {}).flat()), ...(st.collection || []), ...(st.wishlist || [])].map(e => e?.cardId).filter(Boolean);
    for (const id of ids) { try { const c = tcgCardOf(G, id); if (c) add(artworkSources(c)[0]); } catch {} }
  }
  return out;
}
globalThis.Collection = {
  // Card art saved once: every picture the player's decks, collection and wishlist draw (artKeepList).
  artKeep() { return json({urls: artKeepList()}); },
  // ---- Ask a Judge (gap audit H4) ----
  // Opens the rules chat with the site's context ({game, format, cards, references}: app.js A.askRules), kept per context as the site keeps it.
  judgeOpen(o) { const c = JSON.parse(o || '{}'), game = JUDGE_NAMES[c.game] ? c.game : 'mtg'; judge = {game, format: c.format || '', cards: (c.cards || []).filter(x => x?.name).slice(0, 4).map(x => ({name: x.name, text: x.text || ''})), entries: [], busy: null}; if (c.question) judgeAsk(c.question); return json(judgeModelOf()); },
  judgeModel() { return json(judgeModelOf()); },
  judgeFormat(f) { if (judge) judge.format = String(f || ''); return json(judgeModelOf()); },
  judgeSend(text) { judgeAsk(text); return json(judgeModelOf()); },
  judgeNew() { if (judge) judge = {...judge, cards: [], entries: [], busy: null}; return json(judgeModelOf()); },
  judgeDropCards() { if (judge) judge.cards = []; return json(judgeModelOf()); },
  judgeClose() { judge = null; return '{}'; },
  // Settings > Backup: the backup file's words (app.js backupPayload) and Check file's line (C.checkBackup).
  backupPayload() { return backupPayload(); },
  backupCheck(text) { return checkBackup(text); },
  // ---- Compare cards (gap audit H1) ----
  // A tapped tile (its data-ask-show): the site's tools.open; askShowDone() says where the app goes ({dest}) once it is worked out.
  askShow(item) { let s = null; try { s = JSON.parse(item); } catch {} if (!s) return '{}'; askShowRun(s); return '{}'; },
  askShowDone() { return json(askRun || {done: true}); },
  compareModel(G) { return json(compareModelOf(G)); },
  // A.compareFrom / tCompareFrom, as the app's hold menu: the card fills the first empty side (a full pair starts again from it).
  // [ref] is the Magic card's name, or a Yu-Gi-Oh! / Pokémon card id; compareDone() says when it is in.
  compareFrom(G, ref) {
    const run = compareRun = {done: false};
    (async () => {
      const card = G === 'mtg' ? (meta(ref) || await resolve(ref, true)) : (tcgCardOf(G, ref) || await tcgEnsureCard(G, ref));
      const pair = cmpPair(G), i = pair.findIndex(x => !x);
      if (i < 0) { pair[0] = card; pair[1] = null; } else pair[i] = card;
    })().then(() => { run.done = true; }, e => { run.done = true; run.error = String(e?.message || e); });
    return '{}';
  },
  // A.compareLookup / tCompareLookup: side [i] from the typed name; the site's "No card with that name." when nothing matches.
  compareLookup(G, i, q) {
    const run = compareRun = {done: false}; q = String(q || '').trim(); i = Number(i);
    (async () => {
      if (!q) return;
      if (G === 'mtg') { cmpPair(G)[i] = await resolve(q, true); return; }
      const r = await tcgSources[G].search({q, size: 20}).catch(() => null), hit = rankByName(r?.cards || [], q)[0];
      if (!hit) throw Error("No card with that name.");
      cmpPair(G)[i] = (await tcgEnsureCard(G, hit.id).catch(() => null)) || hit;
    })().then(() => { run.done = true; }, e => { run.done = true; run.error = String(e?.message || e); });
    return '{}';
  },
  compareDone() { return json(compareRun || {done: true}); },
  // A.compareReset ([i] < 0) or tCompareClear (one side).
  compareClear(G, i) { i = Number(i); const pair = cmpPair(G); if (i < 0) { pair[0] = pair[1] = null; } else pair[i] = null; return json(compareModelOf(G)); },
  // ---- Price alerts (pricehist.js, app.js A.priceAlert / priceAlertSave / priceAlertClear) ----
  // The signed-in account whose alerts the site's code reads and writes ('guest' signed out).
  alertOwner(user) { alertOwner = String(user || 'guest'); return '{}'; },
  // pricehist.js alertSheet's model for card [id] of game [g]: the price now as A.priceAlert finds it (the card's price history,
  // else its quote), the two numbers the sheet's fields start with (an alert's own, else 15 % under and 25 % over), and the card's
  // price history series for the line.
  alertOpen(g, id, name) {
    id = String(id || '');
    let value = priceSeries(g, id).at(-1)?.[1] ?? null, quote = null;
    try { const card = g === 'mtg' ? meta(name) : tcgCardOf(g, id.split('|')[0]), finish = id.split('|')[1] || (g === 'mtg' ? 'nonfoil' : 'reference');
      quote = card ? quoteModel(g, card, finish) : null; if (value == null) value = quote?.value ?? null; } catch {}
    const a = alertFor(g, id), fill = (own, f) => (a ? (own ?? '') : value != null ? (value * f).toFixed(2) : '');
    // The line: this device's own price checks merged with the site's shared daily prices (sharedprices.js, as the card page's
    // history merges them: the server's point wins on the same day); the shared ones asked for when none are here yet.
    const shared = quote ? sharedPoints(quote) : [], sharedAsked = !!quote && !shared.length && (g === 'mtg' || g === 'ygo');
    if (sharedAsked) loadSharedPoints(quote);
    const series = mergePoints(priceSeries(g, id).map(([date, v]) => ({date, value: v})), shared).map(p => [p.date, Number(p.value)]);
    return json({game: g, id, name: name || 'This card', price: value, exists: !!a, below: String(fill(a?.below, .85)), above: String(fill(a?.above, 1.25)),
      hintBelow: value != null ? (value * .85).toFixed(2) : 'e.g. 5.00', hintAbove: value != null ? (value * 1.25).toFixed(2) : 'e.g. 20.00',
      series, sharedAsked});
  },
  // A.priceAlertSave with the two fields' text: its error line, or the alert saved and its toast.
  alertSave(g, id, name, belowText, aboveText) {
    const num = (x) => (x === "" || x == null || !(Number(x) > 0) || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100) / 100),
      below = num(belowText), above = num(aboveText);
    if (below == null && above == null) return json({error: "Enter a price above $0 in either field."});
    if (below != null && above != null && below >= above) return json({error: "The lower price must be less than the upper price."});
    setAlert(g, String(id), name, {below, above});
    return json({ok: true, toast: "Alert saved. Checked while you use the app; no background monitoring."});
  },
  // A.priceAlertClear.
  alertClear(g, id) { setAlert(g, String(id), "", {}); return json({ok: true, toast: "Alert removed."}); },
  // Every alert of this account (the daily check's list).
  alertList() { return json({alerts: priceAlerts()}); },
  // The app's daily check (gap audit H2 step 4, new beyond the site, which checks only while open): each alerted card's price
  // fetched now and recorded as the site records a price it sees (recordCardPrice: pricehist.js checkAlerts, once a day per card);
  // what it sets off comes out in the pumps' "alerts". alertCheckPoll() says when it is done.
  alertCheck() {
    const run = alertRun = {done: false, checked: 0, failed: 0};
    (async () => {
      for (const a of priceAlerts()) {
        const id = String(a.id || '').split('|')[0]; if (!id) continue;
        try {
          if (a.game === 'mtg') recordCardPrice('mtg', await api('/cards/' + encodeURIComponent(id)));
          else await tcgEnsureCard(a.game, id, true);
          run.checked++;
        } catch { run.failed++; }
      }
    })().finally(() => { run.done = true; });
    return '{}';
  },
  alertCheckPoll() { return json(alertRun || {done: true, checked: 0, failed: 0}); },
  // What the app kept of the site's browser storage (KEPT_KEYS), put back when the bundle starts.
  storeLoad(keptJson) { const o = keptJson ? JSON.parse(keptJson) : {}; for (const [k, v] of Object.entries(o)) if (kept(k) && typeof v === 'string') keptSet(k, v); },
  // The account's workspace row data (cloud.js), normalized as app.js loads it; [catalogJson] is the app's saved catalog.
  load(workspaceJson, catalogJson) {
    // No account copy (signed out, or a row never set up): app.js starts from store.js blank().
    const ws = workspaceJson ? JSON.parse(workspaceJson) : null;
    S.state = ws && Object.keys(ws).length ? normalize(ws) : blank();
    // A Yu-Gi-Oh! or Pokémon page borrowed the old copy's settings.game (tcgFocus): this copy's own choice is the one to keep; the
    // next such page borrows it again.
    tcgPrev = undefined;
    S.catalog = catalogJson ? JSON.parse(catalogJson) : {};
    // cloud.js reconciled: the account's copy is here, so value observations may be recorded (app.js valueHistoryReady).
    valueHistoryReady = !!ws; lastUndo = null;
    // A new copy of the workspace (app.js account switch): pending condition answers are for the old one.
    conditionWorkspaceRevision++; addCtx = null; bgSaves = 0;
    useMyPrices(S.state.myPrices); // app.js render(): the account's own prices count in every value
    return json({copies: S.state.collection.reduce((n, e) => n + (Number(e.qty) || 0), 0), decks: S.state.decks.length});
  },
  // app.js autoEnrich's name lookups (collection, decks, saved lists, wishlist): fills the catalog; poll() reads progress.
  enrich() {
    const st = S.state, me = ++job;
    const names = [...st.collection.filter((e) => !e.lookupFailed).map((e) => e.name), ...st.decks.flatMap((d) => d.cards.map((c) => c.name)),
      ...(st.references || []).flatMap((d) => d.cards.map((c) => c.name)), ...st.wishlist.map((w) => w.name)].filter((n) => n && !meta(n));
    status = {busy: true, step: '', error: null};
    resolveNames(names, m => { if (me === job) status.step = String(m); }, false, () => me === job)
      .then(r => { if (me === job) status = {busy: false, step: '', error: null, failed: r.failed.length, total: r.total}; },
            e => { if (me === job) status = {busy: false, step: '', error: String(e && e.message || e)}; });
  },
  // The feeds Home shows (tcg.js loadHero + home-today.js dailyDetails, meta.js loadMeta, community-feed.js loadCommunity, news-pulse.js loadPulse).
  // [deckId]: the open deck page also fetches its own format's tournament decks (app.js route: Deck Power and the emblems
  // compare against them), when they are missing or older than 12 hours.
  // Only the Card of the Day and today's set (the launch warm-up): todayDone() says when they're in.
  today(game) { todayLoad = false; loadToday(game).finally(() => { todayLoad = true; }); },
  todayDone() { return json({done: todayLoad}); },
  feeds(game, deckId) {
    if (game && game !== 'mtg') tcgScreenCards(game, 'home');
    loadToday(game);
    loadMeta(homeMetaKey(game)).catch(() => {});
    const deck = deckId ? S.state.decks.find(d => String(d.id) === String(deckId)) : null, mk = deck ? mtgMetaKey(deck) : null;
    if (mk) { const M = metaState(mk); if (!M.busy && (!M.data || Date.now() - M.at > 12 * 3600e3)) loadMeta(mk).catch(() => {}); }
    Promise.allSettled([loadCommunity(game), loadPulse(game)]);
  },
  // One of the site's saving taps (writeActs) with the tapped button's dataset; actPoll() reads how it ended once the app has
  // pumped its chain: {done, error, ask (a question to put to the player first), toasts [{text, undo}], writes (commits made)}.
  act(kind, dataJson) {
    if (!writeActs[kind]) throw Error('unknown write ' + kind);
    const run = acting = {done: false}; toasts = []; asked = ''; made = ''; actStep = ''; siteRecovery = null; const n = commits;
    Promise.resolve().then(() => writeActs[kind](JSON.parse(dataJson || '{}'))).then(
      () => { Object.assign(run, {done: true, ask: asked, toasts, writes: commits - n, made, ...(asked && siteAsk?.question === asked ? {asking: siteAsk} : {}),
        ...(siteCopied != null ? {copied: siteCopied} : {}), ...(siteOpened ? {opened: siteOpened} : {}), ...(siteDownload ? {downloaded: siteDownload} : {}),
        texts: siteText, ...(siteRecovery ? {recovery: siteRecovery} : {})}); siteCopied = null; siteOpened = ''; siteDownload = null; siteRecovery = null; },
      e => { Object.assign(run, {done: true, error: String(e?.message || e), ask: '', toasts, writes: commits - n}); });
  },
  // The Scanner's WebView engine starts from the workspace (owned counts, saved places, scan preferences): S.state as it is.
  scanWorkspace() { return json({collection: S.state.collection, settings: S.state.settings, locations: S.state.locations, binders: S.state.binders, tcg: S.state.tcg}); },
  actPoll() { return json(acting ? (acting.done ? acting : {...acting, step: actStep}) : {done: true, writes: 0, toasts: []}); },
  // The account's sign-in for the condition feed (cloud.js access token), set by the app before the add sheet asks.
  auth(token) { conditionToken = token || ''; },
  // The add sheet (app.js addSheet): [o] {entry: lot id} to edit, {own: name, fromCard} for Got it, or {} for an empty one.
  addOpen(o) {
    const d = JSON.parse(o || '{}');
    if (d.entry) { const e = S.state.collection.find(x => x.id === d.entry); if (!e) return json({error: 'This card is no longer in your collection.'}); return json(addSheetModel(e)); }
    return json(addSheetModel(null, d.own ? ownPreset(d.own, !!d.fromCard) : {}));
  },
  // app.js closeSheet: the sheet [id] opened is gone (a newer one is left alone).
  // What Build a deck reads from the workspace (app.js inv and priceOf: what is owned, the player's own prices), for the WebView.
  // Build a deck for Yu-Gi-Oh! and Pokémon (flowTcgCalls): [name] with its JSON args starts; flowPoll() says how it ended
  // ({done, value} or {done, error}) and the pipeline's live line (status) while it builds.
  flow(name, aJson) {
    const f = flowTcgCalls[name], me = {done: false};
    flowRun = me;
    if (!f) { me.done = true; me.error = 'Unknown step ' + name; return; }
    try { Promise.resolve(f(JSON.parse(aJson || '{}'))).then(v => { me.done = true; me.value = v ?? null; }, e => { me.done = true; me.error = e?.message || String(e); }); }
    catch (e) { me.done = true; me.error = e?.message || String(e); }
  },
  flowPoll() { const r = flowRun || {done: true, value: null}; return json(r.done ? r : {done: false, status: flowStatus}); },
  flowCancel() { flowCurrent++; flowStatus = ''; },
  // tcg.js A.tPickSeeds: the sheet as data (seedPickModel).
  seedPick(game) { return json(seedPickModel(game)); },
  flowWorkspace() { const s = stripCache(S.state); return json({collection: s.collection, decks: s.decks, myPrices: s.myPrices ?? null, priceChoices: s.priceChoices ?? null, settings: s.settings}); },
  // app.js A.deckMenu (6108): the ⋯ menu of deck [id] (deckMenuModel).
  deckMenu(id) { return json(deckMenuModel(id)); },
  // tcg.js A.tDeckMenu: a Yu-Gi-Oh! or Pokémon deck's ⋯ menu.
  tdeckMenu(game, id) { return json(tcgDeckMenuModel(game, id)); },
  // tcg.js A.tDeckCopy (listText: Main / Extra / Side with "qty name" lines) and A.tDeckExport (the game's own export, .ydk or .txt).
  tdeckText(game, id) {
    const d = tcgGs(game).decks.find(x => String(x.id) === String(id)); if (!d) return '{}';
    const listText = (d) => ["main", "extra", "side"].flatMap((z) => ((d.zones[z] || []).length ? [z === "main" ? "Main" : z === "extra" ? "Extra" : "Side", ...d.zones[z].map((r) => `${r.qty} ${r.name}`), ""] : [])).join("\n");
    return json({text: listText(d), export: tcgSources[game].exportText(d, (x) => tcgCardOf(game, x)), file: d.name.replace(/[^a-z0-9]+/gi, "_") + "." + tcgSources[game].exportExt});
  },
  // app.js A.newDeck's sheet ([commander]: data-commander, prefilled).
  newDeck(commander) { return json(newDeckModel(commander || '')); },
  // app.js deckImportSheet: [preset] (A.importReference: {destination: "library", kind: "Community deck"}), [deck] the deck the ⋯ menu's
  // Re-import is for (else the site's currentDeck()).
  deckImport(presetJson, deck) { return json(deckImportModel(JSON.parse(presetJson || '{}'), deck || null)); },
  // app.js I.dImpText: typing in the list clears the preview (Save deck waits for Preview & match again).
  deckImportText() { dImp = null; return '{}'; },
  // The change listener's drawDeckImport (6104): the format, commander or destination changed ([f] the form).
  deckImportDraw(formJson) { return json(drawDeckImport(JSON.parse(formJson || '{}'))); },
  // app.js A.proxies (7305): deck [id]'s playtest proxy sheet (extras.js proxySheetHTML), every card for [scope] "all" (but basics),
  // else the copies it is missing; the page the site opens in a new window ({html, title, file}), or the toast when there's none.
  proxies(id, scope) {
    const d = deckOf(id); if (!d) return '{}';
    const all = scope === "all",
      rows = all ? aggregateCards(d.cards) : rowsFor(d).filter((r) => r.missing).map((r) => ({ name: r.name, qty: r.missing })),
      cards = proxyList(rows, S.catalog);
    if (!cards.length) return json({toast: all ? "No non-basic cards to print." : "Nothing missing — no proxies needed."});
    const title = `${d.name} — ${all ? "deck" : "missing cards"} proxies`;
    return json({html: proxySheetHTML(title, cards), title, file: (String(d.name).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "deck") + "_proxies.html"});
  },
  // app.js acquireSheet(mode) (6365): A.acquire's "Cards I got" ([mode] "missing": the copies the deck is missing, none ticked) and
  // A.deckBought's "Add the whole deck to my collection" ("purchase": every card of the deck and its side, all ticked), with its
  // where-to-store picker (#acqLoc, the deck's name offered for a bought deck), finish and condition.
  acquire(id, mode) {
    const d = deckOf(id); if (!d) return json({missing: true});
    const purchase = mode === "purchase",
      rows = purchase ? physicalRequirements(d).map((r) => ({ name: r.name, qty: r.qty, max: r.qty })) : rowsFor(d).filter((r) => r.missing).map((r) => ({ name: r.name, qty: r.missing, max: r.missing }));
    return json({mode: purchase ? "purchase" : "missing", title: purchase ? "Add the whole deck to my collection" : "Cards I got",
      intro: purchase ? "For a precon or deck you bought: every card below is added as new copies, on top of what you already own." : "Tick the cards you now physically have. They’ll be added to your collection and the shopping gap updates.",
      location: locationModelOf(tree(locationPicker(S.state, "mtg", "acqLoc", purchase ? "Deck: " + d.name : null, "Store them in"))),
      finishes: [["nonfoil", "Nonfoil"], ["foil", "Foil"], ["etched", "Etched"]], finish: "nonfoil",
      conditions: ["Near Mint", "Lightly Played", "Moderately Played"].map((x) => [x, x]), condition: "Near Mint",
      all: "Select all", none: "Select none", rows: rows.map((r) => ({...r, on: purchase})), save: "Add to collection", saving: "Saving…"});
  },
  // app.js A.deckToPlay (6238)'s list for playEcon.saveDeck: the deck's format if Play plays it (else Commander for a Commander-like
  // one, else Standard), the commander first, each other row at least one copy, a sideboard row marked. The app sends it (Progress.saveDeck).
  deckPlay(id) {
    const d = deckOf(id); if (!d) return '{}';
    const fmt=PLAY_FORMATS.includes(d.format)?d.format:/commander|edh/i.test(d.format||'')?'Commander':'Standard';
    const cards=[...(d.commander?[{name:d.commander,qty:1}]:[]),...(d.cards||[]).filter(r=>r.name&&r.name!==d.commander).map(r=>({name:r.name,qty:Math.max(1,r.qty|0),...(r.zone==='side'||r.board==='side'?{board:'side'}:{})}))];
    return json({name:(d.name||'Deck').slice(0,80),format:fmt,cards});
  },
  // app.js A.deckCopy / A.deckExport: the decklist as the site writes it (core.js exportDeckText) and the file it saves (fileSafe).
  deckText(id) { const d = deckOf(id); return json(d ? {text: exportDeckText(d), file: `CardStashy_${String(d.name).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "deck"}.txt`} : {}); },
  // app.js A.cardDeckPicker (4782): the decks a card page's Add to deck offers ([id, name]), and the one its <select> shows first.
  deckPick(game) {
    const decks = game === 'mtg' ? S.state.decks : tcgGs(game).decks, want = String((game === 'mtg' ? S.state.activeDeck : decks.at(-1)?.id) ?? '');
    const list = decks.map(d => [String(d.id), d.name]);
    return json({decks: list, selected: list.some(o => o[0] === want) ? want : list[0]?.[0] || ''});
  },
  addClose(id) { if (addCtx && addCtx.id === id) { addCtx = null; priceRun = lookupRun = null; } },
  // tcg.js A.tOwn: a Yu-Gi-Oh! or Pokémon card's Add to collection ([o]: the pressed button's dataset and its game), on the card page's
  // context when it is that card's (its release, finish and edition); the sheet becomes the open one until it closes (tAddClose).
  tAddOpen(o) {
    const d = JSON.parse(o || '{}'), G = d.game === 'ptcg' ? 'ptcg' : 'ygo';
    tcgFocus(G, S.ui.view || 'collection');
    let opened = null; tcgSheetHook = (html, ctx) => { opened = {html, ctx}; };
    try { TA.tOwn({dataset: Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'game'))}); } finally { tcgSheetHook = () => {}; }
    if (!opened?.ctx) return json({error: 'This card is no longer available. Reopen it and try again.'});
    opened.ctx.taddId = ++addSeq;
    if (S.ui.sheetCtx !== taddCtx || !taddCtx) taddPrev = S.ui.sheetCtx;
    taddCtx = S.ui.sheetCtx = opened.ctx;
    return json(taddModel(opened.html, opened.ctx));
  },
  // app.js closeSheet for it: the page under it is the open sheet again.
  tAddClose(id) { if (taddCtx && taddCtx.taddId === id) { if (S.ui.sheetCtx === taddCtx) S.ui.sheetCtx = taddPrev; taddCtx = taddPrev = null; priceRun = null; } },
  tAddPrice(f, retry) { const run = priceRun = {done: false, blocks: [], placeholder: ''}; taddPreview(JSON.parse(f || '{}'), !!retry, run); },
  // app.js A.addLookup: the name looked up (resolve, fuzzy); lookupPoll() reads {done, name, preview, clearPrint} or {done, error}.
  addLookup(name) {
    const ctx = addCtx, run = lookupRun = {done: false};
    if (!ctx) { run.done = true; return; }
    Promise.resolve().then(() => resolve(String(name || '').trim(), true)).then(c => {
      if (addCtx !== ctx) return;
      const clearPrint = !!(ctx.lookup && key(ctx.lookup.name) !== key(c.name));
      ctx.lookup = c;
      Object.assign(run, {name: c.name, preview: addPreview(c), clearPrint});
    }, e => { if (addCtx !== ctx) return; ctx.lookup = null; run.error = String(e?.message || e); }).finally(() => { run.done = true; });
  },
  lookupPoll() { return json(lookupRun || {done: true}); },
  // app.js refreshConditionPrice ([f]: condition, finish, language, set, number, value as the form has them; retry: Refresh price).
  addPrice(f, retry) { const run = priceRun = {done: false, blocks: [], placeholder: ''}; conditionPreview(JSON.parse(f || '{}'), !!retry, run); },
  pricePoll() { return json(priceRun || {done: true, blocks: [], placeholder: ''}); },
  // Saves made outside a tap since the last ask (a lot's condition quotes): the app writes the workspace when this is above 0.
  bg() { const n = bgSaves; bgSaves = 0; return n; },
  // app.js refreshMagicCollectionPrices on the Magic Collection view ([force]: Refresh card data); pricesPoll() reads {done, result}.
  pricesRefresh(force) { const run = pricesRun = {done: false}; refreshMagicCollectionPrices(!!force).then(r => { run.result = r; }, e => { run.error = String(e?.message || e); }).finally(() => { run.done = true; }); },
  pricesPoll() { return json(pricesRun || {done: true}); },
  // app.js A.undo (6514): the state before the last undoable change comes back through the same write (replaceWorkspace).
  undo() {
    if (!lastUndo) return json({writes: 0, toasts: [{text: 'Nothing to undo.', undo: false}]});
    const label = lastUndo.label, valid = normalize(structuredClone(lastUndo.state));
    valid.lastSavedAt = new Date().toISOString();
    if (tcgPrev !== undefined) valid.settings.game = S.state.settings?.game;
    S.state = valid; lastUndo = null; useMyPrices(S.state.myPrices);
    return json({writes: 1, toasts: [{text: `Undone: ${label.replace(/\.$/, '')}.`, undo: false}]});
  },
  // The workspace as the account keeps it, for this device's copy and the push.
  saved() { return JSON.stringify(saveable()); },
  // cloud.js pushNow's no-op check and decideSync's guard: the fingerprint of what would be pushed, and whether it is empty.
  syncInfo() { const s = saveable(); return json({sig: workspaceSig(s), empty: isEmptyWorkspace(s)}); },
  sigOf(dataJson) { return workspaceSig(JSON.parse(dataJson)); },
  // cloud.js act(): the account moved on while this device had edits; sync-merge.js combines the three copies (the last synced
  // one, this device's, the account's) and the result becomes this device's copy, to push next. [baseJson] null: no trusted
  // baseline (mergeAccountWorkspaces' own rule then applies).
  mergeIn(baseJson, cloudJson) {
    const local = saveable(), remote = JSON.parse(cloudJson), trusted = baseJson ? JSON.parse(baseJson) : null;
    const merged = mergeAccountWorkspaces(trusted, local, remote);
    const authored = workspaceContentSig(local) !== workspaceContentSig(trusted || remote);
    const held = S.state.settings?.game, valid = normalize(merged.state);
    if (tcgPrev !== undefined) valid.settings.game = held;
    S.state = valid; lastUndo = null; useMyPrices(S.state.myPrices);
    return json({conflicts: merged.conflicts, notice: authored ? (merged.conflicts.length ? 'Your account copy is active. This device’s other edits are saved in Recovery.' : 'Changes from both devices were combined. The previous device copy is saved in Recovery.') : ''});
  },
  poll() { return json(status); },
  // tcg.js loadCache / its saved record (TCG_CACHE): the Yu-Gi-Oh! and Pokémon card data this device has, kept between visits.
  tcgCacheLoad(raw) { tcgReady(); let rec = null; try { rec = raw ? JSON.parse(raw) : null; } catch {} return tcgLoadCache(async () => rec); },
  tcgCache() { return json(tcgCache); },
  // tcg.js A.tSetByName (the Card of the Day's Yu-Gi-Oh! set): the set list if it is not here yet, then the set it names; the app pumps
  // it and reads setWent() for the #set/<id> it went to.
  setByName(game, name) { tcgFocus(game, 'home'); tcgWent = ''; setDone = false; Promise.resolve(TA.tSetByName({dataset: {name}})).catch(() => {}).finally(() => { setDone = true; }); },
  setPoll() { return json({done: setDone || !!tcgWent}); },
  setWent() { const m = /^#set\/(.+)$/.exec(tcgWent); return m ? decodeURIComponent(m[1]) : ''; },
  // The deck page's Rules tab (tcg.js: interactiveRules(g, {format: d.format})), and taps and typing on whatever panel is open.
  rules(game, format) { panelOpen('rules|' + game + '|' + (format || ''), interactiveRules(game, {format: format || ''}), host => attachRuleLearning(host)); return panelModel(); },
  // A Yu-Gi-Oh! or Pokémon deck's tab other than Cards (tcg.js A.tDeckTab): its body as a panel; the page itself comes from deck() with opts.tab.
  /** A Play deck's Power tab ([deck]: {name, format, cards}), Play-safe (no Upgrades, no prices); read again with panelModel. */
  playPower(deck) { playPowerPanel(deck); return panelModel(); },
  /** The Rules page for [game] (#rules); read again with panelModel. */
  rulesPage(game) { rulesPagePanel(game || 'mtg'); return panelModel(); },
  // A judge's citation (gap audit H4): rule-learning.js openRuleReference on the Rules page's learning section, as the page's own
  // "Open exact rule" does; the rule arrives through panelModel. {opened: false} when the page has no such section or the reference is unreadable.
  ruleOpen(ref) {
    let r = null; try { r = JSON.parse(ref); } catch {}
    const root = panel?.key?.startsWith('rulespage|') ? panel.host.querySelector('[data-learning-root]') : null;
    if (!root || !r || r.game !== root.dataset.game) return json({opened: false});
    panelRun(() => { openRuleReference(root, r).catch(() => {}); });
    return panelModel();
  },
  /** How to play · keywords (A.learnGame: learnSheet) for [game]. */
  learnGame(game) { learnPanel(game || 'mtg'); return panelModel(); },
  // The Scan page's markup for a screen (scanPanel).
  scanPage(game, state, card) { scanPanel(game || 'mtg', state ? JSON.parse(state) : {}, card || ''); return panelModel(); },
  // The Wiki page at its route (#wiki, #wiki/<topic>, #wiki/<topic>/search: [query]).
  wikiPage(game, topic, query) { wikiPagePanel(game || 'mtg', topic || '', query === true || query === 'true'); return panelModel(); },
  // A search field's Enter (the form's submit, as the browser sends it).
  panelSubmit(id) { const el = panel && (domById(panel.doc.documentElement, Number(id)) || fieldNow(Number(id))); const form = el?.closest?.('form');
    if (form) panelRun(() => form.dispatchEvent(new SiteEvent('submit', {bubbles: true, cancelable: true}))); return panel ? panelModel() : '{}'; },
  deckPanel(game, id, tab) { if (game === 'mtg') mtgDeckPanel(id, tab); else tcgDeckPanel(game, id, tab); return panelModel(); },
  panelModel() { return panel ? panelModel() : '{}'; },
  // The open tab drawn again from the account as it is now (a save made from it: Versions' Restore, a logged game).
  // What the app runs on the open tab once the player said yes (app.js A.lifeEnd after its ask).
  panelDone(kind) { if (kind === 'lifeEnd') { S.ui.life = null; panel?.redraw?.(); } return panel ? panelModel() : '{}'; },
  panelRedraw() { if (panel?.redraw) panel.redraw(); return panel ? panelModel() : '{}'; },
  panelTap(id) { const el = panel && domById(panel.doc.documentElement, Number(id)); if (el) panelRun(() => domTap(el)); return panel ? panelModel() : '{}'; },
  // A checkbox's tick ([value] "true" or "false": app.js's change handlers read its checked, C.ideasOwned) or another field's value.
  panelType(id, value) { const el = panel && (domById(panel.doc.documentElement, Number(id)) || fieldNow(Number(id)));
    if (el) panelRun(() => { if (el.localName === 'input' && el.getAttribute('type') === 'checkbox') { el.checked = String(value) === 'true'; el.dispatchEvent(new SiteEvent('change', {bubbles: true})); } else domType(el, value); });
    return panel ? panelModel() : '{}'; },
  // The Decks page's Ideas (or Meta decks) tab body as such a panel (decksPanel), with its route's loads started.
  decksPanel(game, tab) { decksPanel(game || 'mtg', tab === 'inspiration' ? 'inspiration' : 'ideas'); return panelModel(); },
  // Yu-Gi-Oh! / Pokémon's Import a deck (tcg.js A.tImport) and New deck (A.tNewDeck, [format]: the button's data-format) sheets; their
  // buttons run through act('tImpDeck') / act('tNewDeckSave').
  tDeckImportSheet(game) { return json(tcgDeckImportSheetModel(game)); },
  tNewDeckSheet(game, format) { return json(tcgNewDeckSheetModel(game, format || '')); },
  // Magic's Deck review sheet for deck [id] (app.js A.deckReview), read again after each save (app.js refreshSheet).
  deckReview(id) { return json(deckReviewModel(id)); },
  // The review's Find {role} cards (A.findRole, [role]) and Find {format} cards (A.formatSearch): the search they leave for the Search tab.
  reviewSearch(kind, deckId, role) { return json(reviewSearch(kind, deckId, role || '')); },
  // The War Chest window from the Decks head (app.js A.warChest) over the open panel; warChestClose brings that panel back.
  warChest(game) { warChestOpen(game || 'mtg'); return panelModel(); },
  // The Build decks sheet closed by the app (its ✕ is the site's closeSheet, a tap): the panel under it.
  tbuildClose() { tbuildShut(); return panel ? panelModel() : '{}'; },
  warChestClose() { if (panel?.chest) { panel = chestUnder; chestUnder = null; panel?.redraw?.(); } return panel ? panelModel() : '{}'; },
  // icons.js decorateGlyphs: the icon each leading glyph wears (↻ Re-analyze, ⚒ Build, 🏆 Meta decks…), for the panel's words.
  glyphs() { return json(Object.fromEntries(Object.entries(LEAD).filter(([, k]) => ICON[k]).map(([g, k]) => [g, icon(svgIn(tree(ICON[k])))]))); },
  // The deck idea sheet for idea [i] of the Ideas tab (app.js openIdea: it builds at the remembered budget as it opens); IDEA_MODEL
  // reads it again as the build goes; ideaDo runs one of its controls; ideaClose is closeSheet.
  ideaSheet(i) { mtgFocus(); ideaSelWords = null; const n = Number(i); if (!S.ui.ideas.cache[n]) return json({missing: true}); openIdea(n); return json(ideaSheetModel()); },
  ideaModel() { const m = ideaSheetModel(); const said = toasts.splice(0).map(t => t.text); return json({...m, toasts: said}); },
  ideaDo(kind, value) {
    mtgFocus(); toasts = [];
    const o = S.ui.ideas.open; if (!o || S.ui.sheetCtx?.type !== 'idea') return json({missing: true});
    const v = String(value ?? '');
    const run = f => { try { const r = f(); if (r?.then) r.catch(e => toasts.push({text: e?.message || String(e), undo: false})); } catch (e) { toasts.push({text: e?.message || String(e), undo: false}); } };
    if (kind === 'budget') { ideaSelWords = null; run(() => IA.ideaBudget({dataset: {v}})); }
    else if (kind === 'custom') { ideaSelWords = null; run(() => IA.ideaCustomBudget(v)); }
    else if (kind === 'pick') { const {name, on} = JSON.parse(v); IA.ideaPick({checked: !!on, dataset: {name: String(name)}}); }
    else if (kind === 'select') { ideaSelWords = null; IA.ideaSelect({dataset: {mode: v}}); }
    // deck-viewer.js's view switch (A.deckView): the account's Magic deck view.
    else if (kind === 'view') { if (DECK_VIEWS.includes(v)) ((S.state.settings.displayModes ||= {}).mtg ||= {}).deck = v; }
    return Collection.ideaModel();
  },
  ideaClose() { if (S.ui.sheetCtx?.type === 'idea') S.ui.sheetCtx = null; ideaSelWords = null; },
  // The tournament deck's sheet (tcg.js provenSheetHtml) as the app draws it (MetaDeckSheet), read again with settle() while it loads
  // (PROVEN_MODEL); provenDo runs one of its controls (A.provenMode "mode", A.provenBudget "budget", A.provenRetry "retry", the deck
  // view "view"); its save is the write provenSave; provenClose is closeSheet.
  provenModel() { const m = provenSheetModel(); const said = toasts.splice(0).map(t => t.text); return json({...m, toasts: said}); },
  provenDo(kind, value) {
    if (!proven.spec || S.ui.sheetCtx?.type !== 'proven') return json({missing: true});
    toasts = [];
    const v = String(value ?? ''), G = proven.spec.g;
    tcgReady(); if (G !== 'mtg') tcgFocus(G, S.ui.view === 'home' ? 'home' : 'decks');
    const run = f => { try { const r = provenRun(f); if (r?.then) r.catch(e => toasts.push({text: e?.message || String(e), undo: false})); } catch (e) { toasts.push({text: e?.message || String(e), undo: false}); } };
    if (kind === 'mode') run(() => TA.provenMode({dataset: {id: v}}));
    else if (kind === 'budget') run(() => TA.provenBudget({dataset: {b: v}}));
    else if (kind === 'retry') run(() => TA.provenRetry());
    // deck-viewer.js's view switch (A.deckView): the account's deck view for the sheet's game.
    else if (kind === 'view') { if (DECK_VIEWS.includes(v)) ((S.state.settings.displayModes ||= {})[G] ||= {}).deck = v; }
    return Collection.provenModel();
  },
  provenClose() { provenSheetShut(); provenKept = null; },
  // app.js A.sheetHistoryBack from a card's page the sheet opened: the sheet's context again (its snapshot), then its model.
  provenBack() { if (provenKept && proven.spec && S.ui.sheetCtx?.type !== 'proven') S.ui.sheetCtx = provenKept; return Collection.provenModel(); },
  // Home's Community Meta decks card (home-meta-open, data-act mtgProven / tMetaDeck): that deck's sheet, from the list Home shows
  // (homeMetaKey's snapshot, as homeMetaSnapshot captures it on the site).
  provenHome(game, key) {
    toasts = []; provenOpened = false;
    const mk = homeMetaKey(game), data = metaState(mk).data;
    // app.js A.mtgProven / tcg.js A.tMetaDeck (data-home-meta-open): a list no longer in Home's snapshot is not opened.
    if (!data || !(data.decks || []).some(d => String(d.key) === String(key))) return json({missing: true, toasts: ['This Home list has changed. Choose the current visible list.']});
    if (game === 'mtg') { mtgFocus(); mtgProven({dataset: {key: String(key), format: mk.slice(4)}, metaSnapshot: {format: mk.slice(4), data}}); }
    else { tcgFocus(game, 'home'); provenRun(() => TA.tMetaDeck({dataset: {key: String(key), metaKey: mk}})); }
    return Collection.provenModel();
  },
  catalog() { return json(S.catalog); },
  // The Power keep (export-collection-engine.mjs): what this device worked out before, and what to save for next time.
  powerLoad(raw) { try { const o = JSON.parse(raw || '{}'); for (const [k, v] of Object.entries(o)) powerKeep.map.set(k, v); } catch {} powerKeep.dirty = false; },
  powerSave() { if (!powerKeep.dirty) return ''; powerKeep.dirty = false; return json(Object.fromEntries([...powerKeep.map].slice(-POWER_KEEP))); },
  // search-hints.js hintPool: the names and questions the search field fades through (the player's own cards mixed in).
  hints(game) { return json({prompt: SEARCH_PROMPT, first: 4000, every: 4200, fade: 260, pool: hintPool(game, game === 'mtg' ? S.state.collection.map(e => e.name) : (S.state.tcg?.[game]?.collection || []).map(e => e.name))}); },
  // views.js home() / tcg.js tcgHome(), section by section, as models.
  // views.js collection(): the Cards tab, [optsJson] = {sort, direction, filter, q, limit} as the site's controls set them.
  cards(game, optsJson) { const o = optsJson ? JSON.parse(optsJson) : {}; if (game && game !== 'mtg') { const m = tcgCardsPage(game, o); tcgScreenCards(game, 'cards', {ids: m.rows.map(r => r.cardId).filter(Boolean)}); return json(m); } mtgFocus(); return json(cardsPage(game, o)); },
  // One of the page's controls, as the site handles it (cardsAct), then the page again.
  // views.js decks(), My decks; [optsJson] = {q} (I.shelfSearch).
  decks(game, optsJson) { const o = optsJson ? JSON.parse(optsJson) : {}; if (game && game !== 'mtg') { const m = tcgDecksPage(game, o); tcgScreenCards(game, 'decks'); return json(m); } mtgFocus(); return json(decksPage(game, o)); },
  // views.js deckPage(), the Cards tab of deck [id]; deckDo applies one of its controls as the site's handler does (deckAct), then draws it again.
  // [opts] = {search, filter, sort, view}: the controls as the app last left them, applied before the page draws.
  deck(game, id, opts) { if (game && game !== 'mtg') { tcgFocus(game, 'tdeck'); S.ui.tdeckId = id; const o = opts ? JSON.parse(opts) : {}; if (o.view != null) tcgDeckAct.view(o.view);
    tdeckAt = [game, id]; tcgScreenCards(game, 'tdeck', {id}); return json(tcgDeckPageModel(game, id, o.tab || 'cards')); }
    mtgFocus(); deckOpen(id); const o = opts ? JSON.parse(opts) : {}; for (const k of Object.keys(deckAct)) if (o[k] != null) deckAct[k](o[k]); return json(deckPageModel(game, id, o.tab || 'cards')); },
  // Deck Bench (the app's deck editor) in Collection: its card browser, the collection's cards by name (cardKey, as the site keys a
  // card), the copies owned summed over their lots, each with its picture (ui.js cardImage), mana value, type line and colours.
  benchPool(game, id) {
    if (game && game !== 'mtg') return json(tcgBenchPool(game, id));
    mtgFocus(); deckOpen(id);
    const by = new Map();
    for (const e of S.state.collection || []) { if (!(Number(e.qty) > 0)) continue; const k = cardKey(e.name), o = by.get(k) || {name: e.name, own: 0}; o.own += Number(e.qty); by.set(k, o); }
    return json([...by.values()].map(o => { const c = meta(o.name); return c ? {name: c.name, image: cardImage(c) || '', cmc: Number(c.cmc) || 0,
      type: c.type_line || c.card_faces?.[0]?.type_line || '', colors: c.colors || c.card_faces?.[0]?.colors || [], own: o.own} : null; }).filter(Boolean));
  },
  // All cards, shelf by shelf, for a Yu-Gi-Oh! or Pokémon deck (shelvesStart above): the set list and "For this deck", then one set's cards.
  shelvesStart(game, id) { shelvesStart(game, id); return json(shelvesModel(game, id)); },
  shelvesModel(game, id) { return json(shelvesModel(game, id)); },
  shelfStart(game, id, setId) { shelfStart(game, id, setId); return json(shelfModel(game, id, setId)); },
  shelfModel(game, id, setId) { return json(shelfModel(game, id, setId)); },
  // The open Yu-Gi-Oh! or Pokémon deck page again (after settle: a search's results, prices and card data that came in).
  tdeckModel() { if (!tdeckAt) return '{}'; const [g, id] = tdeckAt; return json(tcgDeckPageModel(g, id)); },
  deckDo(game, id, kind, value) { if (game && game !== 'mtg') { if (!tcgDeckAct[kind]) throw Error('unknown deck control ' + kind); tcgFocus(game, 'tdeck'); S.ui.tdeckId = id; tdeckAt = [game, id]; tcgDeckAct[kind](value); return json(tcgDeckPageModel(game, id)); }
    if (!deckAct[kind]) throw Error('unknown deck control ' + kind); mtgFocus(); deckOpen(id); deckAct[kind](value); return json(deckPageModel(game, id)); },
  // Collection › Binders for [game]: the shelf, one binder's page, the editor's fields (binderShelfModel, binderModel, binderEditModel).
  binders(game) { return json(binderShelfModel(game || 'mtg')); },
  binder(game, id, page) { return json(binderModel(game || 'mtg', id, page)); },
  // Choose binders / decks: showcaseChoices as showcaseItem cleans each (community-profile.js shareResults and the preview).
  showcaseChoices() { return json(showcaseChoices().map(showcaseItem)); },
  // createCommunity's refresh: each of your shared items repaired from this device where its cards still match (repairOwnShowcase);
  // [items] the overview's; the answer lists only the ones that changed, {i, item}, for the app to share again.
  showcaseRepair(items) { const choices = showcaseChoices(); return json(JSON.parse(items).map((item, i) => { const r = repairOwnShowcase(item, choices); return r !== item ? {i, item: r} : null; }).filter(Boolean)); },
  // community-profile.js showItem: the item as showcaseItem cleans it, then app.js openSharedShowcase.
  sharedBinder(item, page) { return json(sharedBinderModel(showcaseItem(JSON.parse(item)), page)); },
  sharedDeck(item) { provenRun(() => sharedDeckOpen(showcaseItem(JSON.parse(item)))); return Collection.provenModel(); },
  binderEdit(game, id) { return json(binderEditModel(game || 'mtg', id || '')); },
  // Collection › Value for [game] (valuePage).
  value(game) { return json(valuePage(game || 'mtg')); },
  // Magic Collection's ⋯ menu (app.js A.collMenu) and what its buttons give the app: Export CSV's file (A.exportCSV's download).
  collMenu() { return json(collMenuModel()); },
  exportCSV() { return json({name: "CardStashy_Collection.csv", text: exportCollectionCSV(S.state.collection), type: "text/csv"}); },
  // The import sheet (app.js importCollectionSheet) and its taps: the text changed (I.impText), Preview ([hash]: the text's SHA-256,
  // A.impPreview's digest, worked out by the app), a row's tick (C.impUse), a printing picked (C.impPrinting), the skipped lines' file
  // (A.impErrors); Check names & printings and Import run through act (impVerify, impApply) and importModel reads the sheet after.
  importSheet() { return json(importSheetModel()); },
  importModel() { return json(importModel()); },
  importText() { if (!impBusy) { impDraft = null; impError = ''; } return json(importModel()); },
  importPreview(raw, hash) {
    impError = '';
    try {
      const parsed = parseImport(String(raw ?? ''));
      impDraft = previewImport(parsed, S.state.collection, String(hash), S.state.importHistory || []);
      impDraft.attemptId = uid();
      for (const e of impDraft.lots) { e.include = true; e.review = printingState(e); }
    } catch (e) { impError = e.message; }
    return json(importModel());
  },
  importUse(i, on) { if (impDraft?.lots[Number(i)]) impDraft.lots[Number(i)].include = !!on; return json(importModel()); },
  importPrinting(i, j) {
    const say = []; if (j === '' || !impDraft) return json({...importModel(), toast: ''});
    const n = Number(i), e = impDraft.lots[n];
    try { impDraft.lots[n] = { ...verifiedLot(e, e.candidates[Number(j)]), candidates: [], review: "Printing selected" }; } catch (x) { say.push(x.message); }
    return json({...importModel(), toast: say.join(' ')});
  },
  importErrors() { return json(impDraft ? {name: "CardStashy_Import_Errors.csv", text: importErrorsCSV(impDraft.errors), type: "text/csv"} : null); },
  importClose() { impDraft = null; impBusy = false; impError = ''; },
  // app.js closeSheet over tcg.js's Import a deck / New deck while A.tImpDeck runs: S.ui.sheetCtx null, so its importGuard's active()
  // fails and nothing is saved (the site's own check before mutate).
  tDeckSheetClose() { if (S.ui.sheetCtx?.type === 'timport' || S.ui.sheetCtx?.type === 'tnew') S.ui.sheetCtx = null; },
  // Yu-Gi-Oh! and Pokémon's Paste a list (tcg.js tcgImportSheet "coll"); Import runs through act('tImpColl').
  tImportSheet(game) { return json(tcgImportSheetModel(game)); },
  // The Select tray's sheet for [kind] (batchSheetModel); its button saves through act('batchApply').
  batchSheet(game, kind) { if (game && game !== 'mtg') tcgFocus(game, 'collection'); else mtgFocus(); return json(batchSheetModel(game || 'mtg', kind)); },
  cardsDo(game, kind, value) {
    if (game && game !== 'mtg') { if (!tcgCardsAct[kind]) throw Error('unknown Cards control ' + kind); tcgFocus(game, 'collection'); tcgCardsAct[kind](value); return json(tcgCardsPage(game)); }
    if (!cardsAct[kind]) throw Error('unknown Cards control ' + kind); mtgFocus(); cardsAct[kind](value); return json(cardsPage(game)); },
  // views.js cardSheet(): a card's page; [opts] = {name, entry, deck} as the tapped tile has them. cardLoad starts its lookups
  // (the app pumps them with settle()); cardDo applies one of its controls (cardAct).
  // [opts.back] "idea:<i>": opened from the deck idea sheet (app.js A.card's S.ui.sheetBack): the page offers "Back to deck idea".
  card(game, opts) { mtgFocus(); const o = JSON.parse(opts); const b = /^idea:(\d+)$/.exec(String(o.back || ''));
    S.ui.sheetBack = b ? {type: 'idea', i: Number(b[1])} : null; const ctx = cardOpen(o); return json(cardPageModel(ctx)); },
  cardModel() { return sheet ? json(cardPageModel(sheet)) : '{}'; },
  // app.js A.ruleHint (rule-dex.js showRuleHint) from a rule word in a card page's text: the glass over the page, read as a panel
  // (SiteGlass). It has a panel of its own; whatever panel was open (a deck's tab under the page) comes back when it closes.
  ruleGlass(game, rule) {
    const page = game === 'mtg' ? (sheet && (sheet.print || meta(sheet.name)) ? tree(cardView(sheet.print || meta(sheet.name), sheet)) : null) : (tsheet ? tree(tcardHtml()) : null);
    const raw = one(page, x => x.attrs?.['data-rule-card-context'] !== undefined)?.attrs['data-rule-card-context'] || '';
    if (!panel?.key?.startsWith('rulehint|')) ruleUnder = panel;
    panel = null;
    panelOpen('rulehint|' + game + '|' + rule, `<div${raw ? ` data-rule-card-context="${esc(raw)}"` : ''}><button type="button" class="rule-word" data-act="ruleHint" data-game="${esc(game)}" data-rule="${esc(rule)}">${esc(rule)}</button></div>`);
    panelRun(() => showRuleHint(panel.host.querySelector('button')));
    return panelModel();
  },
  /** The card page's condition switch: starts the condition lookup for the printing shown ([retry]: ask the feed again). Read with condModel. */
  conditions(game, retry) {
    const sel = condSelection(game), wait = !sel || !!sel.need, run = condRun = {game, sel, done: wait, status: !sel ? 'unpriced' : sel.need ? 'pick' : 'loading',
      notice: !sel ? 'Open an exact printing to see condition prices.' : sel.need || '',
      start: conditionName(sel?.start) };
    if (!wait) Promise.resolve(fetchConditionValue(sel.card, {...sel.entry, condition: run.start}, game, null, {source: 'search', retry: !!retry, current: () => condRun === run}))
      .then(res => { if (condRun !== run) return; run.status = res?.status || 'unavailable'; run.notice = res?.notice || (res?.reason === 'offline' ? 'You are offline. Saved prices are still shown.' : ''); })
      .catch(() => { if (condRun === run) run.status = 'unavailable'; })
      .finally(() => { if (condRun === run) run.done = true; });
    return json(condModel());
  },
  condModel() { return json(condModel()); },
  ruleGlassClose() { if (panel?.key?.startsWith('rulehint|')) { panel = ruleUnder || null; ruleUnder = null; } return panel ? panelModel() : '{}'; },
  cardHtml() { const ctx = sheet, c = ctx && (ctx.print || meta(ctx.name)); return c ? cardView(c, ctx) : ''; },
  tcard(opts) { tcgReady(); const o = JSON.parse(opts); if (o.pack != null && o.pack !== '') { const pick = pack?.picks?.[Number(o.pack)]; if (pick) Object.assign(o, {game: pack.game, id: String(pick.id), setId: String(pack.set?.id ?? '')}); } tcardOpen(o); return json(tcardModel()); },
  tcardLoad() { const sctx = tsheet; if (sctx) tcardLoad(sctx); },
  tcardHtml,
  tcardModel() { return json(tcardModel()); },
  tcardDo(kind, value) { if (!tcardAct[kind] || !tsheet) throw Error('unknown card control ' + kind); tcardAct[kind](value); if (['tab', 'finish', 'rarity', 'select', 'jump'].includes(kind)) tcardTabLoads(tsheet).catch(() => {}); return json(tcardModel()); },
  cardLoad() { const ctx = sheet; if (!ctx) return; (async () => { if (ctx.ownedLoading) await ownedLoad(ctx); if (!ctx.blocked && still(ctx)) { if (!(ctx.print || meta(ctx.name))) await resolveNames([ctx.name], () => {}, false, () => still(ctx)).catch(() => {}); await Promise.all([cardExtras(ctx), cardTabLoads(ctx), loadSetIndex()]); } })(); },
  // A.cardTab starts the tab's lookups (the guide's pairings and rulings, the price history); a finish or printing changes the quote.
  cardDo(kind, value) { if (!cardAct[kind] || !sheet) throw Error('unknown card control ' + kind); cardAct[kind](value); if (['tab', 'finish', 'print'].includes(kind)) cardTabLoads(sheet).catch(() => {}); return json(cardPageModel(sheet)); },
  // The Search tab (views.js search(), tcg.js tcgSearch()) for [game]: the page as it stands, the search as last left. searchDo hands
  // one control to the site's own handler ([data] = {dataset, value}); a search runs on (the app pumps it with settle() and reads
  // searchModel), and searchWent then says which card a press opened (Random), for the app's card page.
  search(game) {
    searchGame = game || 'mtg'; searchWent = null;
    if (searchGame === 'mtg') mtgFocus(); else tcgFocus(searchGame, 'search');
    return json(searchPageModel(searchGame));
  },
  searchModel() { if (searchGame !== 'mtg') tcgFocus(searchGame, 'search'); return json(searchPageModel(searchGame)); },
  searchDo(act, dataJson) {
    const d = dataJson ? JSON.parse(dataJson) : {};
    if (act === 'viewSave') { const m = d.dataset?.mode; if (['gallery', 'compact', 'symbols'].includes(m)) ((S.state.settings.displayModes ||= {})[searchGame] ||= {}).search = m; }
    // The handler's own part runs now (the page answers at once); what it then waits on (a lookup) settles in the app's settle().
    else searchPress(act, d).catch(e => toasts.push({text: e?.message || 'Search failed.', undo: false}));
    return json(searchPageModel(searchGame));
  },
  searchWent() { const w = searchWent; searchWent = null; return json(w); },
  // app.js A.ruleCards for Yu-Gi-Oh! and Pokémon (a card page's artist, type, archetype, attribute and ability chips): the game's
  // search set to the chip's filters (card-discovery.js cardDiscoverySpec), then run (tcg.js A.tSearch), or the loaded cards matched
  // for a Pokémon ability or text. Its error line when the chip names nothing the site can search.
  discoverySearch(G, kind, value) {
    // tcg.js A.tArchetype (a Yu-Gi-Oh! card's archetype line, "More <archetype> cards"): the search page on that archetype, a list of its
    // cards (gap audit card head): its own filter and words, as the site sets them before runSearch.
    if (kind === 'tArchetype' && G !== 'mtg' && value) {
      searchGame = G; tcgFocus(G, 'search');
      TcgAll.invalidateTcgSearch(G, true); const U = tcgUi(G).search;
      Object.assign(U, {q: '', f: {archetype: value, setName: 'Archetype: ' + value}, discoveryNote: ''});
      Promise.resolve(TA.tSearch()).catch(e => toasts.push({text: e?.message || 'Search failed.', undo: false}));
      return json(searchPageModel(G));
    }
    const spec = cardDiscoverySpec(G, kind, value);
    if (!spec || G === 'mtg') return json({error: 'Reopen this card in its game before searching.'});
    searchGame = G; tcgFocus(G, 'search');
    TcgAll.invalidateTcgSearch(G, true); const U = tcgUi(G).search;
    Object.assign(U, {q: '', f: spec.filters, own: '', maxPrice: '', sort: G === 'ygo' ? 'name' : 'new', discoveryNote: ''});
    if (spec.loadedAbility || spec.loadedText) {
      const key = (spec.loadedAbility || spec.loadedText).toLocaleLowerCase();
      const cards = Object.values(tcgCache[G]).filter(c => !c.brief && (spec.loadedAbility ? c.abilities?.some(a => a.name?.toLocaleLowerCase() === key) : ruleCardContext(G, c).text.toLocaleLowerCase().includes(key)));
      Object.assign(U, {results: cards, ran: true, total: cards.length, more: false, busy: false, error: '', discoveryNote: `${spec.label}. Loaded card data only; this is not a complete catalogue search. Shared text or an Ability name does not prove the same effect or a working combo.`});
    } else Promise.resolve(TA.tSearch()).catch(e => toasts.push({text: e?.message || 'Search failed.', undo: false}));
    return json(searchPageModel(G));
  },
  searchToasts() { const t = toasts.map(x => x.text); toasts = []; return json(t); },
  // tcg.js's saved searches live in this device's storage (cardforge-saved-searches-v1): the app keeps them between visits.
  // suggest.js keeps each game's recent searches (cardstashy-recent-<game>) the same way: both go back and forth as one object.
  searchSaved() {
    let saved = '{}'; try { saved = localStorage.getItem('cardforge-saved-searches-v1') || '{}'; } catch {}
    return JSON.stringify({saved, recent: Object.fromEntries(['mtg', 'ygo', 'ptcg'].map(g => [g, recentSearches(g)]))});
  },
  searchSavedSet(raw) {
    let o = {}; try { o = JSON.parse(raw || '{}') || {}; } catch {}
    try { localStorage.setItem('cardforge-saved-searches-v1', typeof o.saved === 'string' ? o.saved : '{}'); } catch {}
    for (const g of ['mtg', 'ygo', 'ptcg']) try { localStorage.setItem(scopedKey(`cardstashy-recent-${g}`), JSON.stringify(Array.isArray(o.recent?.[g]) ? o.recent[g] : [])); } catch {}
  },
  // The suggestion list under the box: searchSuggest starts it for what is typed (the app pumps it with settle()), searchSuggestModel
  // reads it ({q, recent, items}, null while it looks); searchRemember is suggest.js's Enter (and a picked suggestion).
  searchSuggest(game, q) { suggestStart(game || 'mtg', q); return json(suggestOut); },
  searchSuggestModel() { return json(suggestOut); },
  searchRemember(game, q) { rememberSearch(game || 'mtg', q); },
  // Words handed over from Home's box are a new search: a filter an earlier page left on ("Legal in Commander" from a deck's
  // review) does not narrow it, as app.js submitHome clears it on the site.
  searchFresh(game) { if ((game || 'mtg') === 'mtg') { S.ui.db.filters = {color: '', type: '', format: '', maxPrice: ''}; dbInvalidate(); } },
  // The answer card over the suggestions: searchAnswer reads what is typed and starts its lookup ([opts] = {fix, set, card}; the app
  // pumps it with settle()); searchAnswerModel reads it (null while the words are read, state 'none' | 'loading' | 'done').
  searchAnswer(game, q, opts) { let o = {}; try { o = JSON.parse(opts || '{}') || {}; } catch {} answerStart(game || 'mtg', q, o); return json(answerOut); },
  searchAnswerModel() { return json(answerOut); },
  // Whether the words are a question the app answers ('answer'), one it can't ('miss': the plain search still runs) or a plain search ('none').
  searchAsks(game, q) { const p = String(q || '').trim() ? answerPlan(game || 'mtg', q).plan : null; return !p ? 'none' : p.call?.pick === 'maybe' || p.intent === 'unknown' ? 'miss' : p.call || p.missing?.length ? 'answer' : 'none'; },
  searchAnswerSearch(q, sort) { return json(answerSearch(q, sort || '')); },
  // views.js setsPage(), every set: [opts] = {q, family, release, year, sort} as the app last left them. setsLoad starts the
  // set list's lookup (app.js loadSetIndex; the app pumps it with settle()); setsDo applies a control (setsAct).
  sets(game, opts) {
    const o = opts ? JSON.parse(opts) : {}; setsGame = game || 'mtg';
    if (setsGame === 'mtg') mtgFocus(); else tcgFocus(setsGame, 'sets');
    const U = setsGame === 'mtg' ? S.ui.sets : tcgUi(setsGame).sets;
    for (const k of ['q', 'family', 'release', 'year', 'sort']) if (o[k] != null) U[k] = o[k];
    return json(setsPageModel(setsGame));
  },
  setsModel() { if (setsGame !== 'mtg') tcgFocus(setsGame, 'sets'); return json(setsPageModel(setsGame)); },
  setsLoad() { if (setsGame === 'mtg') loadSetIndex().catch(() => {}); else tcgCtx.loadSets(setsGame).catch(() => {}); },
  setsDo(kind, value) {
    const act = setsGame === 'mtg' ? setsAct : tcgSetsAct; if (!act[kind]) throw Error('unknown sets control ' + kind);
    if (setsGame !== 'mtg') tcgFocus(setsGame, 'sets');
    act[kind](value); return json(setsPageModel(setsGame));
  },
  // views.js setPage() / tcg.js tcgSet(), one set's cards (#set/<code or id>); setLoad fetches them (app.js loadSet, tcg.js
  // ctx.openSet), setDo applies a control (setAct, tcgSetAct).
  set(game, code) {
    setGame = game || 'mtg';
    if (setGame === 'mtg') { mtgFocus(); setOpen(code); } else tcgFocus(setGame, 'set', String(code));
    return json(setPageModel(setGame));
  },
  setModel() {
    if (setGame !== 'mtg') { if (!S.ui.tsetId) return '{}'; tcgFocus(setGame, 'set', S.ui.tsetId); return json(setPageModel(setGame)); }
    return S.ui.set.code ? json(setPageModel()) : '{}';
  },
  setLoad() {
    if (setGame !== 'mtg') { tcgFocus(setGame, 'set', S.ui.tsetId); tcgCtx.openSet(S.ui.tsetId, false, setGame).catch(() => {}); return; }
    const st = S.ui.set; loadSetIndex().catch(() => {}); if (!st.loaded && !st.busy) loadSet(st.code, {join: true}).catch(() => {});
  },
  setDo(kind, value) {
    const act = setGame === 'mtg' ? setAct : tcgSetAct; if (!act[kind]) throw Error('unknown set control ' + kind);
    if (setGame !== 'mtg') tcgFocus(setGame, 'set', S.ui.tsetId);
    act[kind](value); return json(setPageModel(setGame));
  },
  // tcg.js tcgSet's raw page, for checking the model against it.
  // Open Pack on the open set page (A.openSetPack): packOpen starts the draw (the booster sheets, then the pack; the app pumps it
  // with settle() and reads packModel), packAgain opens a new sealed pack from the same set, packClose drops it.
  packOpen(game) {
    const G = game || 'mtg'; if (G === 'mtg') mtgFocus(); else tcgFocus(G, 'set', S.ui.tsetId);
    // Today's pack (todayPack): the Card of the Day the Home tap asked for, taken by the next pack opened in its game (A.openSetPack's S.ui.packFeatured).
    const want = packWant?.game === G ? packWant : null; packWant = null;
    const P = pack = {game: G, busy: true, error: '', deal: 0, stamp: 0, want};
    packStart(P).then(ok => { if (!ok || pack !== P) return; packDeal(P); P.busy = false; }, e => { if (pack !== P) return; P.busy = false; P.error = e?.message || 'Could not open this preview.'; });
    return json(packModel());
  },
  packModel() { return json(packModel()); },
  // app.js A.homeTodayPack, up to the set: today's set (its pack's set when the card is from a bonus sheet), and the Card of the Day
  // the next pack in that set pulls; the app then opens that set's page and its Open Pack. todayWent is {game, set, name} or {error}.
  todayPack(game) {
    todayGo = null; packWant = null;
    // Home's refresh loads the Card of the Day (tcg.js loadHero); a tap before it has (a launch painted from what was kept) loads it first.
    const h0 = heroFor(game);
    (h0 ? Promise.resolve(h0) : loadHero(game).catch(() => false).then(() => heroFor(game))).then(h => {
    if (!h) { todayGo = {error: 'Today’s set could not load. Try opening the pack again.'}; return; }
    return dailyDetails(game, h).then(d => {
      const set = d?.set?.pack || d?.set; if (!set) throw Error('Today’s set could not load. Try opening the pack again.');
      packWant = {game, id: h.id, name: h.name, date: h.date, rarity: d.rarity || '', card: d.set?.pack ? d.card : null};
      todayGo = {game, set: game === 'mtg' ? set.code : game === 'ptcg' ? set.id : '', name: set.name || ''};
    }); }).catch(e => { todayGo = {error: e?.message || 'Could not load today’s pack. Try again.'}; });
  },
  todayWent() { return json(todayGo || {}); },
  todayPoll() { return json({done: !!todayGo}); },
  packAgain() { const P = pack; if (!P || P.busy || !P.cards) return json(packModel()); packDeal(P); return json(packModel()); },
  packClose() { pack = null; },
  setHtml() { return setGame === 'mtg' ? setView() : tcgSetView(); },
  setsHtml() { return setsGame === 'mtg' ? setsView() : tcgSetsView(); },
  home(game) {
    if (game && game !== 'mtg') {
      // tcg.js tcgHome: the game's value (collectionValue, its own history), no example note.
      tcgFocus(game, 'home'); const st = tcgGs(game), v = tcgCollectionValue(game);
      return json({game, hero: hero(game), value: homeValueModel({game, ...v, decks: st.decks.length, history: readTcgValueHistory(game)}), example: '', shelf: shelf(game), meta: metaRail(game), news: newsRail(game)});
    }
    mtgFocus(); const st = S.state, value = collectionValue(st.collection, S.catalog, st.printings, st.decks);
    return json({game, hero: hero(game), value: homeValueModel({ game, ...value, decks: st.decks.length, history: st.valueHistory }),
      example: st.example ? 'Example data is loaded. Reset it in Settings before adding real cards.' : '', shelf: shelf(game), meta: metaRail(game), news: newsRail(game)});
  },
};
