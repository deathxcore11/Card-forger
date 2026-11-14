// The site's random deck builder for the native app: app.js's own wiring (deckPipeline, resolve,
// randomBuildSeed, playRandomProducer) around the web modules, bundled unchanged for QuickJS.
import {createDeckPipeline} from 'WEB/deck-pipeline.js';
import {S, meta, inv, priceOf, cacheCard} from 'WEB/store.js';
import {createScryfallClient} from 'WEB/scryfall-client.js';
import {formatOf} from 'WEB/formats.js';
import {createRandomDeckProducer, RANDOM_DECK_FORMATS} from 'WEB/play-opponent-build.js';
import {createRandomDeckQueue} from 'WEB/play-random-queue.js';
import {mtgPower, shownPower} from 'WEB/power.js';
import {capturePracticeDeckContext} from 'WEB/play-deck-context.js';
import {metaState, loadMeta as loadMetaData} from 'WEB/meta.js';
import {cardKey as key} from 'WEB/core.js';
import {loadMtgTags, mtgTagsReady, setMtgTags} from 'WEB/mtg-tags.js';
import {engineRoles} from 'WEB/insights.js';

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
// The app keeps finished decks between launches (gap audit G1): [kept] is what the queue holds ready, by its key, and [onFile] the decks
// read back at start, which the producer hands over at once instead of building. A taken deck leaves [kept]; a new account drops both.
const kept = new Map(), onFile = new Map();
let keptDirty = false;
const keptProducer = (request, o) => {
  const k = playRandomQueue.key(request);
  if (onFile.has(k)) { const deck = onFile.get(k); onFile.delete(k); kept.set(k, {request, deck}); keptDirty = true; return Promise.resolve(deck); }
  return playRandomProducer(request, o).then(deck => { if (deck && o?.current?.() !== false) { kept.set(k, {request, deck}); keptDirty = true; } return deck; });
};
const playRandomQueue = createRandomDeckQueue({produce: keptProducer, readScope: () => scope, idle: () => idle});
const keptTake = request => { if (kept.delete(playRandomQueue.key(request))) keptDirty = true; };
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

// app.js resolveNames, verbatim but for saveCatalogSoon (this bundle keeps its catalog in memory): card data 75 names a request.
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
      // A batch the database couldn't be reached for gets one more pass after a cooldown.
      if (e?.network && !retried.has(i)) { retried.add(i); progress("The card database is busy; trying again…"); await new Promise((r) => setTimeout(r, 4000)); i -= 75; continue; }
      failed.push(...chunk);
    }
  }
  if(!current())return {failed,matched,total:wanted.length,cancelled:true};
  return { failed, matched, total: wanted.length };
}

// Calls whose answer comes later (a card from Scryfall): the app passes an id, and takeDone() hands back each finished one.
const done = [];
const calls = {
  // deck-experience.js A.flowRandom: a random build-around for the format (and theme), as app.js randomBuildSeed picks it.
  card: a => randomBuildSeed({game: 'mtg', format: a.format, theme: a.theme || '', randomSeed: Math.floor(Math.random() * 1e9)}),
  // Change card: the name the player typed, as app.js resolve finds it.
  named: a => resolve(String(a.name || ''), true),
  // Quick Play (app.js A.playFindOpponent): the format's tournament data first (bounded wait, as the site waits for it), then each
  // deck's quickContext, capturePracticeDeckContext(deck).practiceContext: the same Power and bracket the Collection shows. The site
  // reads them from the catalog it already has; here the decks' card data is loaded first (app.js resolveNames).
  quickContext: async a => {
    const fmt = String(a.format || ''), metaKey = 'mtg:' + (fmt === 'Commander' ? 'EDH' : fmt), decks = a.decks || [];
    await Promise.race([metaState(metaKey).data ? null : loadMetaData(metaKey).catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
    // Scryfall's role tags (mtg-tags.js), which the site has loaded by the time it rates a deck; QuickJS has no location, so it reads
    // the same file itself.
    if (!mtgTagsReady()) await (typeof location !== 'undefined' ? loadMtgTags() : fetch('https://cardstashy.com/mtg-tags.json').then(r => r.ok ? r.json() : null).then(d => { if (d) setMtgTags(d); }).catch(() => {}));
    const leader = d => [d.commander, ...(d.commanders || [])].map(c => typeof c === 'string' ? c : c?.name);
    await resolveNames(decks.flatMap(d => [...leader(d), ...[...(d.cards || []), ...(d.side || [])].map(r => typeof r === 'string' ? r : r?.name)]).filter(Boolean));
    return decks.map(d => { try { const c = capturePracticeDeckContext(d).practiceContext; return {power: c.power.value, bracket: c.bracket?.value ?? null}; } catch (e) { return {power: null, bracket: null, error: String(e && e.message || e)}; } });
  },
  // Deck Bench (the app's deck editor): quickContext's Power and bracket for the deck being edited, and deck-viewer.js stackSummary's
  // roles (deck-viewer.js deckCardAttrs: insights.js engineRoles without Land, by copies, main deck only, in the list's order).
  benchContext: async a => {
    const [ctx] = await calls.quickContext({format: a.format, decks: [a.deck]});
    const counts = new Map(), cards = {};
    for (const r of a.deck.cards || []) { const c = meta(r.name); if (!c) continue; const roles = c.type_line ? engineRoles(c).filter(role => role !== 'Land') : []; cards[r.name] = roles; for (const role of roles) counts.set(role, (counts.get(role) || 0) + (Number(r.qty) || 0)); }
    return {...ctx, roles: [...counts], cards};
  },
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
  scope(json) { const next = JSON.parse(json); if (JSON.stringify(next) !== JSON.stringify(scope)) { if (scope !== null) { kept.clear(); onFile.clear(); keptDirty = true; } } scope = next; },
  // The ready decks to keep on the device ([{request, deck}]), when they changed since the last ask; '' when not.
  keptChanged() { if (!keptDirty) return ''; keptDirty = false; return JSON.stringify([...kept.values()]); },
  // The decks kept from the last launch: the next warm() for their request hands them over without building. Returns how many.
  restore(json) { const list = JSON.parse(json || '[]'); for (const e of list) if (e && e.request && e.deck) onFile.set(playRandomQueue.key(e.request), e.deck); return String(onFile.size); },
  // How many restored decks still wait to be handed to the queue.
  onFile() { return String(onFile.size); },
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
      let deck = playRandomQueue.take(ask); if (deck) keptTake(ask);
      if (!deck && playRandomQueue.pending(ask)) { result = {...result, status: 'Finishing your next deck…'}; await playRandomQueue.pending(ask); if (!current()) return; deck = playRandomQueue.take(ask); if (deck) keptTake(ask); }
      if (!deck) { deck = await playRandomProducer(ask, {current, onStatus: m => { if (current()) result.status = String(m); }}); if (!current()) return; playRandomQueue.warm([ask]); }
      result = {busy: false, status: '', deck: withPower(deck), error: deck ? null : 'cancelled', ticket: tag};
    })().catch(e => { if (current()) result = {busy: false, status: '', deck: null, error: String(e && e.message || e), trace: String(e && e.stack || ''), ticket: tag}; });
  },
  cancel() { job++; result = {busy: false, status: 'Build cancelled.', deck: null, error: null}; },
  poll() { return JSON.stringify(result); },
};
// For the WebView's Build a deck (deck-flow-entry.mjs): the same pipeline and seed picker, and its calls join these.
export {deckPipeline, randomBuildSeed, calls as flowCalls};
