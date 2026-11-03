// The site's random deck builder for the native app: app.js's own wiring (deckPipeline, resolve,
// randomBuildSeed, playRandomProducer) around the web modules, bundled unchanged for QuickJS.
import {createDeckPipeline} from 'WEB/deck-pipeline.js';
import {S, meta, inv, priceOf, cacheCard} from 'WEB/store.js';
import {createScryfallClient} from 'WEB/scryfall-client.js';
import {formatOf} from 'WEB/formats.js';
import {createRandomDeckProducer} from 'WEB/play-opponent-build.js';
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

let job = 0, result = null;
globalThis.RandomBuild = {
  // Starts one Play random build (createRandomDeckProducer); status lines and the result are read back with poll().
  start(json) {
    const ask = JSON.parse(json), me = ++job; result = {busy: true, status: 'Choosing a build-around…', deck: null, error: null};
    playRandomProducer(ask, {current: () => me === job, onStatus: m => { if (me === job) result.status = String(m); }})
      .then(deck => { if (me !== job) return; result = {busy: false, status: '', deck: deck && {...deck, power: shownPower(mtgPower({...deck, id: 'construction'}))}, error: deck ? null : 'cancelled'}; },
            e => { if (me !== job) return; result = {busy: false, status: '', deck: null, error: String(e && e.message || e), trace: String(e && e.stack || '')}; });
  },
  cancel() { job++; result = {busy: false, status: 'Build cancelled.', deck: null, error: null}; },
  poll() { return JSON.stringify(result); },
};
