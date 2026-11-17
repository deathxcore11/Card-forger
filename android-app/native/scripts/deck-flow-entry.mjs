// Collection's Build a deck for the native app's WebView (RandomBuild.kt; Randall 5 Nov 23:18Z: Random Commander and Random deck in
// Collection › Decks do what the website's do). deck-experience.js runs here as app.js wires it (open, flowRandom, flowGenerate,
// flowAdjust, flowSave's checks, flowExport) on the random builder's own deckPipeline, so a deck builds at Chrome's speed; the page
// draws the site's own setup and result markup (deckSetupMarkup, deckResultMarkup) into a detached element and reads them back as
// data for the native screens. Only Magic: the bundle carries no Yu-Gi-Oh! or Pokémon sources (those still open the website).
import {deckPipeline, randomBuildSeed, flowCalls} from './random-build-entry.mjs';
import {deckSetupMarkup, deckResultMarkup, bracketPower} from 'WEB/deck-experience.js';
import {cardJob} from 'WEB/builder.js';
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
function register(result) { const id = 'deck-result-' + (++sequence); results.set(id, {result, saved: false, group: 'type', tap: 'open', locked: new Set(), swap: null}); while (results.size > 30) results.delete(results.keys().next().value); return id; }
const setupModel = (request, status = '', error = false) => setupOf(request, status, error, deckSetupMarkup, deckPipeline.formats);
const resultModel = id => resultOf(id, results.get(id), deckResultMarkup);

let current = 0, status = '';
// deck-experience.js carry(): the Group, Tap and locked cards stay with the player through a rebuild or a swap.
function carry(id, item) { const next = results.get(id); next.group = item.group; next.tap = item.tap; next.locked = new Set(item.locked || []); return id; }
const itemOf = id => { const item = results.get(id); if (!item) throw Error('Your account or collection changed. Rebuild before opening this deck.'); return item; };
// A.flowPick: Bracket (its power with it), Plan or Power on the request; the setup again.
flowCalls.flowPick = a => {
  const r = {...a.request};
  if (a.field === 'bracket') { r.bracket = Number(a.value); r.power = bracketPower(Number(a.value)); }
  else if (a.field === 'plan' || a.field === 'power') r[a.field] = a.value;
  return setupModel(r);
};
// A.flowGroup / A.flowTap / A.flowSwapKeep: the result again with the switch moved.
flowCalls.flowGroup = a => { const item = itemOf(a.id); item.group = a.group === 'job' ? 'job' : 'type'; return resultModel(a.id); };
flowCalls.flowTap = a => { const item = itemOf(a.id); item.tap = a.tap === 'lock' || a.tap === 'swap' ? a.tap : 'open'; item.swap = null; return resultModel(a.id); };
flowCalls.flowSwapKeep = a => { const item = itemOf(a.id); item.swap = null; return resultModel(a.id); };
// A.flowCard in Lock or Swap: a card taps to lock (or unlock), or opens its Swap panel. {open: true} says the card opens as usual.
flowCalls.flowCardTap = a => {
  const item = itemOf(a.id), r = item.result, row = r.rows[Number(a.row)];
  const land = /\bLand\b/.test(String(row?.card?.type_line || '').split(' // ')[0]);
  if (r.request.game !== 'mtg' || !item.tap || item.tap === 'open' || !row || land || row.name === r.deck.commander) return {open: true};
  const key = row.zone + ':' + row.name;
  if (item.tap === 'lock') { if (item.locked.has(key)) item.locked.delete(key); else item.locked.add(key); }
  else item.swap = {name: row.name, zone: row.zone, qty: row.qty, job: cardJob(row.card), options: deckPipeline.swapOptions(r, row.name, row.zone)};
  return {open: false, model: resultModel(a.id)};
};
// A.flowSwapTake: the checked swap, or the panel again with why not.
flowCalls.flowSwapTake = a => {
  const item = itemOf(a.id), swap = item.swap, option = swap?.options[Number(a.option)]; if (!option) return resultModel(a.id);
  let updated; try { updated = deckPipeline.applySwap(item.result, swap.name, swap.zone, option.card); } catch (e) { updated = {ok: false, message: e.message}; }
  if (!updated.ok) { item.swap = {...swap, message: updated.message || 'That swap does not pass the deck checks. Your deck is unchanged.'}; return resultModel(a.id); }
  const id = register(updated); carry(id, item); results.get(id).locked.delete(swap.zone + ':' + swap.name);
  return resultModel(id);
};
// A.flowRetune: the deck again with another Plan or Power, from the previous deck (locks cleared, as the site does).
flowCalls.flowRetune = async a => {
  const item = itemOf(a.id), r = item.result;
  if (!['plan', 'power'].includes(a.field)) return {cancelled: true};
  const me = ++current; status = 'Rebuilding your deck…';
  const result = await deckPipeline.build({...r.request, closest: false, ...(a.field === 'plan' ? {plan: a.value} : {power: a.value, forge: r.request.forge ? {...r.request.forge, power: a.value} : undefined}),
    previousDeck: r.deck, previousBudget: r.request.budget, previousEstimate: r.pricing.estimate}, {current: live(me), onStatus: m => { if (me === current) status = String(m); }});
  if (me !== current) return {cancelled: true};
  status = '';
  if (!result.ok) return {ok: false, message: result.message};
  const id = register(result); carry(id, item); results.get(id).locked = new Set();
  return {ok: true, model: resultModel(id)};
};
// A.flowRebuildUnlocked: a build around the locked cards (a fresh variation), over the result.
flowCalls.flowRebuildUnlocked = async a => {
  const item = itemOf(a.id), r = item.result;
  const locked = [...item.locked].map(k => { const [zone, ...rest] = k.split(':'); return r.rows.find(row => row.zone === zone && row.name === rest.join(':')); }).filter(row => row && row.zone === 'main');
  const me = ++current; status = 'Finding cards around your locked cards…';
  const seed = Array.from({length: 6}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const result = await deckPipeline.build({...r.request, closest: false, locked_cards: locked.map(row => ({name: row.name, qty: row.qty})),
    forge: {...(r.request.forge || {}), power: r.request.forge?.power || r.request.power, variation: 'varied', seed}, previousDeck: r.deck, previousBudget: r.request.budget, previousEstimate: r.pricing.estimate},
    {current: live(me), onStatus: m => { if (me === current) status = String(m); }});
  if (me !== current) return {cancelled: true};
  status = '';
  if (!result.ok) return {ok: false, message: result.message};
  const id = register(result); carry(id, item); const next = results.get(id);
  next.locked = new Set([...next.locked].filter(k => result.rows.some(row => row.zone + ':' + row.name === k)));
  return {ok: true, model: resultModel(id)};
};
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
  const result = await deckPipeline.build({...item.result.request, budget, closest: false, previousDeck: item.result.deck, previousBudget: item.result.request.budget, previousEstimate: item.result.pricing.estimate},
    {current: live(me), onStatus: m => { if (me === current) status = String(m); }});
  if (me !== current) return {cancelled: true};
  status = '';
  return result.ok ? {ok: true, model: resultModel(carry(register(result), item))} : {ok: false, message: result.message};
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
