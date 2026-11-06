// Collection's Build a deck for the native app's WebView (RandomBuild.kt; Randall 5 Nov 23:18Z: Random Commander and Random deck in
// Collection › Decks do what the website's do). deck-experience.js runs here as app.js wires it (open, flowRandom, flowGenerate,
// flowAdjust, flowSave's checks, flowExport) on the random builder's own deckPipeline, so a deck builds at Chrome's speed; the page
// draws the site's own setup and result markup (deckSetupMarkup, deckResultMarkup) into a detached element and reads them back as
// data for the native screens. Only Magic: the bundle carries no Yu-Gi-Oh! or Pokémon sources (those still open the website).
import {deckPipeline, randomBuildSeed, flowCalls} from './random-build-entry.mjs';
import {deckSetupMarkup, deckResultMarkup} from 'WEB/deck-experience.js';
import {S} from 'WEB/store.js';
import {exportDeckText} from 'WEB/core.js';
import {customBudget} from 'WEB/ui.js';
import {setupModel as setupOf, resultModel as resultOf} from './deck-flow-models.mjs';


// The signed-in workspace the build reads (app.js inv / priceOf: what is owned, the player's own prices), handed over by the app.
function workspace(w) {
  for (const k of ['collection', 'decks', 'myPrices', 'priceChoices', 'settings']) if (w && k in w) S.state[k] = w[k];
}

// deck-experience.js open(): the request it starts from (the format's default, the saved preferences, then what the button asked).
function opened(request, prefs) {
  const game = 'mtg', formats = deckPipeline.formats[game], fallback = formats.find(f => f.id === 'standard') || formats[0];
  return {game, format: fallback.name, budget: '', budgetBasis: 'total', budgetMode: 'cap', preferOwned: true, ...(prefs || {}), ...request};
}

// deckResultMarkup as data: deckShell's hero, the notes before Save, the actions, the construction line, the loop and mechanic
// details, each zone's rows (the card picture from the row's card), Edit choices / Export list and "Deck plan, checks & pricing".
const results = new Map();
let sequence = 0;
function register(result) { const id = 'deck-result-' + (++sequence); results.set(id, {result, saved: false}); while (results.size > 30) results.delete(results.keys().next().value); return id; }
const setupModel = (request, status = '', error = false) => setupOf(request, status, error, deckSetupMarkup, deckPipeline.formats);
const resultModel = id => resultOf(id, results.get(id), deckResultMarkup);

let current = 0, status = '';
const live = me => () => me === current;
flowCalls.flowWorkspace = a => { workspace(a); return true; };
// open(): the setup for a request ({commanderLock, format}) and the player's saved preferences.
flowCalls.flowOpen = a => setupModel(opened(a.request || {}, a.prefs));
// A request the player edited (read()): its setup again, without building, with a status line ([error]: its warning style).
flowCalls.flowSetup = a => setupModel(a.request, a.status || '', !!a.error);
// A.flowRandom: a new build-around for the request (randomBuildSeed), then the setup around it.
flowCalls.flowRandom = async a => {
  const me = ++current;
  const r = {...a.request, seed: '', seedCard: null, seedCards: [], ygoPurchaseSelections: {}, ptcgPurchaseSelections: {}, randomSeed: Math.floor(Math.random() * 1e9)};
  const card = await randomBuildSeed(r);
  if (me !== current) return {cancelled: true};
  return setupModel({...r, seed: card.name, seedCard: card, seedCards: [card]});
};
// A.flowGenerate: the build with its live status; a finished deck is registered and read back as the result page.
flowCalls.flowGenerate = async a => {
  const me = ++current; status = 'Finding a coherent plan…';
  const result = await deckPipeline.build(a.request, {current: live(me), onStatus: m => { if (me === current) status = String(m); }});
  if (me !== current) return {cancelled: true};
  status = '';
  return result.ok ? {ok: true, model: resultModel(register(result))} : {ok: false, message: result.message, setup: setupModel(a.request, result.message, true)};
};
// A.flowAdjust's first step: customBudget's check of the amount typed, before anything builds (its message when it fails).
flowCalls.flowBudget = a => { customBudget(a.budget); return true; };
// A.flowAdjust: Rebuild with budget (customBudget checks the amount), from the previous deck and its estimate.
flowCalls.flowAdjust = async a => {
  const item = results.get(a.id); if (!item) throw Error('Your account or collection changed. Rebuild before opening this deck.');
  const budget = customBudget(a.budget);
  const me = ++current; status = 'Finding cards for your updated budget…';
  const result = await deckPipeline.build({...item.result.request, budget, previousDeck: item.result.deck, previousBudget: item.result.request.budget, previousEstimate: item.result.pricing.estimate},
    {current: live(me), onStatus: m => { if (me === current) status = String(m); }});
  if (me !== current) return {cancelled: true};
  status = '';
  return result.ok ? {ok: true, model: resultModel(register(result))} : {ok: false, message: result.message};
};
// A.flowSave's check (pipeline.recheck) and what app.js save() writes; the app's Collection engine writes it to My decks.
flowCalls.flowSaveData = a => {
  const item = results.get(a.id); if (!item) throw Error('Your account or collection changed. Rebuild before saving.');
  if (!deckPipeline.recheck(item.result)) throw Error('The list no longer passes its checks. Rebuild before saving.');
  return {deck: item.result.deck, request: item.result.request};
};
flowCalls.flowSaved = a => { const item = results.get(a.id); if (item) item.saved = true; return item ? resultModel(a.id) : null; };
// A.flowExport: the list as text (exportDeckText).
flowCalls.flowExport = a => { const item = results.get(a.id); if (!item) throw Error('This deck is no longer available.'); return {text: exportDeckText(item.result.deck)}; };
// A.flowCancelBuild.
globalThis.DeckFlow = {cancel() { current++; status = ''; }, status: () => status};
