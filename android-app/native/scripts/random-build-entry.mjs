// The site's random deck builder for the native app: app.js's own wiring (deckPipeline, resolve,
// randomBuildSeed, playRandomProducer) around the web modules, bundled unchanged for QuickJS.
import {createDeckPipeline} from 'WEB/deck-pipeline.js';
import {S, meta, inv, priceOf, cacheCard} from 'WEB/store.js';
import {createScryfallClient} from 'WEB/scryfall-client.js';
import {formatOf} from 'WEB/formats.js';
import {createRandomDeckProducer, RANDOM_DECK_FORMATS} from 'WEB/play-opponent-build.js';
import {createRandomDeckQueue} from 'WEB/play-random-queue.js';
import {mtgPower, shownPower} from 'WEB/power.js';

// app.js:475-484, verbatim.
const api = createScryfallClient();
async function resolve(name, fuzzy = false, refresh = false) {
  if (!String(name || "").trim()) throw Error("No card name given.");
  const c = meta(name);
  if (c && !refresh) return c;
  const d = await api("/cards/named?" + new URLSearchParams({ [fuzzy ? "fuzzy" : "exact"]: name }));
  return cacheCard(d, [name]);
}
// Play builds Magic only; the other games' sources are not part of this bundle.
const T = {SOURCES: {ygo: {formats: []}, ptcg: {formats: []}}};
// app.js deckPipeline and randomBuildSeed, verbatim.
const deckPipeline=createDeckPipeline({S,T,api,resolve,cacheCard,meta,priceOf,inv,tcgCtx:null});
const randomBuildSeed=async request=>{if(request.game!=='mtg')return deckPipeline.resolveSeed(request);const f=formatOf(request.format),theme=String(request.theme||'').replace(/[^\p{L}\p{N} '-]/gu,'').slice(0,80);return cacheCard(await api('/cards/random?'+new URLSearchParams({q:`${f.legality?'f:'+f.legality:'game:paper'} -t:land ${f.commander?'is:commander':''} ${theme?`(t:"${theme}" or o:"${theme}")`:''}`})));};
const playRandomProducer=createRandomDeckProducer({pipeline:deckPipeline,pickSeed:randomBuildSeed});

// app.js playRandomQueue: one finished deck waits per format (bracket, style, power), built in the background one at a time and
// again after each is taken; scope is the signed-in account (app.js readScope), idle is the app's (no match on the table, app in front).
let scope = null, idle = true;
const playRandomQueue = createRandomDeckQueue({produce: playRandomProducer, readScope: () => scope, idle: () => idle});
// A finished deck as the app reads it: the site's Power number with it (power.js shownPower, as the Play deck chip shows).
const withPower = deck => deck && {...deck, power: shownPower(mtgPower({...deck, id: 'construction'}))};

// Play's Build a deck (Randall 5 Nov: Random deck does what the website's Build a deck does): Deck Forge's producer around the card
// the player chose (🎲 New card is app.js randomBuildSeed, as the site's flowRandom; Change card resolves a name as app.js resolve), with
// the site's Build a deck choices (deck-experience.js: theme, match mode, simpler plans) carried into the pipeline's request.
const chosenProducer = ({seedCard, seed, theme, matchMode, easy}) => createRandomDeckProducer({
  pipeline: {...deckPipeline, build: (r, o) => deckPipeline.build({...r, ...(theme ? {theme} : {}), ...(matchMode ? {matchMode} : {}), ...(easy ? {easy: true} : {})}, o)},
  pickSeed: async () => seedCard || await resolve(seed, true),
});
const chosen = a => !!(a.seedCard || a.seed || a.theme || a.matchMode || a.easy);

// Calls whose answer comes later (a card from Scryfall): the app passes an id, and takeDone() hands back each finished one.
const done = [];
const calls = {
  // deck-experience.js A.flowRandom: a random build-around for the format (and theme), as app.js randomBuildSeed picks it.
  card: a => randomBuildSeed({game: 'mtg', format: a.format, theme: a.theme || '', randomSeed: Math.floor(Math.random() * 1e9)}),
  // Change card: the name the player typed, as app.js resolve finds it.
  named: a => resolve(String(a.name || ''), true),
};

let job = 0, result = null;
globalThis.RandomBuild = {
  formats: () => JSON.stringify(RANDOM_DECK_FORMATS),
  // deck-experience.js themes.mtg (copied from the site's file at bundle time): Build a deck's Theme choices.
  themes: () => JSON.stringify(DECK_THEMES.mtg || []),
  call(id, name, json) {
    Promise.resolve().then(() => { if (!calls[name]) throw Error('unknown call ' + name); return calls[name](JSON.parse(json || '{}')); }).then(value => { done.push({id, ok: true, value}); }, e => { done.push({id, ok: false, error: String(e && e.message || e)}); });
  },
  takeDone() { return done.length ? JSON.stringify(done.splice(0)) : ''; },
  // The account the queued decks belong to; a new one drops them (play-random-queue.js check).
  scope(json) { scope = JSON.parse(json); },
  idle(on) { idle = !!on; },
  // app.js warmPlayRandom: these requests ({format, targetBracket, deckStyle, power}) start building in the background.
  warm(json) { playRandomQueue.warm(JSON.parse(json)); },
  // Ready decks for a format (play-random-queue.js peek), as Quick Play's pool reads them.
  peek(format) { return JSON.stringify(playRandomQueue.peek(format).map(withPower)); },
  // play-opponent-build.js createPracticeOpponentBuilder build(): a deck the queue already finished is handed over at once, one it
  // is still building is awaited, else one is built now and the queue refills; status lines and the result are read with poll().
  start(json) {
    const a = JSON.parse(json), ask = {format: a.format, targetBracket: a.targetBracket ?? null, deckStyle: a.deckStyle || 'classic', ...(a.power === 'strong' ? {power: 'strong'} : {})};
    const me = ++job, current = () => me === job, tag = a.ticket ?? null; result = {busy: true, status: 'Choosing a build-around…', deck: null, error: null, ticket: tag};
    (async () => {
      if (chosen(a)) {
        const deck = await chosenProducer(a)(ask, {current, onStatus: m => { if (current()) result.status = String(m); }});
        if (!current()) return;
        result = {busy: false, status: '', deck: withPower(deck), error: deck ? null : 'cancelled', ticket: tag};
        return;
      }
      let deck = playRandomQueue.take(ask);
      if (!deck && playRandomQueue.pending(ask)) { result = {...result, status: 'Finishing your next deck…'}; await playRandomQueue.pending(ask); if (!current()) return; deck = playRandomQueue.take(ask); }
      if (!deck) { deck = await playRandomProducer(ask, {current, onStatus: m => { if (current()) result.status = String(m); }}); if (!current()) return; playRandomQueue.warm([ask]); }
      result = {busy: false, status: '', deck: withPower(deck), error: deck ? null : 'cancelled', ticket: tag};
    })().catch(e => { if (current()) result = {busy: false, status: '', deck: null, error: String(e && e.message || e), trace: String(e && e.stack || ''), ticket: tag}; });
  },
  cancel() { job++; result = {busy: false, status: 'Build cancelled.', deck: null, error: null}; },
  poll() { return JSON.stringify(result); },
};
// For the WebView's Build a deck (deck-flow-entry.mjs): the same pipeline and seed picker, and its calls join these.
export {deckPipeline, randomBuildSeed, calls as flowCalls};
