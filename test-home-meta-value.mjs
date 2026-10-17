import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { S, blank } from './store.js';
import { collectionValue as magicValue, recordValuePoint } from './insights.js';
import * as T from './tcg.js';
import { home as magicHome, decks as magicDecks } from './views.js';
import { metaState, DEFAULT_MTG_META_FORMAT } from './meta.js';
import { homeValue, homeValueCoverage, homeValueComparison, homeValueModel, refreshHomeValue, homeMetaSlides, homeMetaCarousel, homeMetaKey, attachHomeMeta, refreshHomeCommunity, homeMetaSnapshot } from './home-ui.js';
import { metaDeckSlides, communityState } from './community-feed.js';

const now = Date.parse('2026-10-17T12:00:00Z'), day = '2026-10-16';
const point = { date: day, total: 1499.46, copies: 34, ...homeValueCoverage({ unpriced: 0 }) };
const current = { total: 1499.88, copies: 34, decks: 2, unpriced: 0 };
assert.deepEqual(homeValueComparison(current, [point], now), { delta: .42, date: day, direction: 'up' });
for (const game of ['mtg', 'ygo', 'ptcg']) {
  const html = homeValue({ ...current, game, history: [point], now });
  assert.match(html, /\$1,499\.88/); assert.match(html, /↑ \+\$0\.42 · total change since Oct 16, 2026/);
  assert.match(html, /includes copies, recorded values and available prices/);
  assert.match(html, /Estimated value · USD/); assert.match(html, /data-to="#collection\/value"/);
  assert.doesNotMatch(html, /\(\+0\.0%\)|market gain|live market/i);
}
assert.equal(homeValueComparison({ ...current, total: 1000 }, [point], now).direction, 'down');
assert.equal(homeValueComparison({ ...current, total: point.total }, [point], now).direction, 'flat', 'zero only from a genuine comparable pair');
assert.equal(homeValueComparison({ ...current, copies: 35, total: 1509.88 }, [point], now).delta, 10.42, 'added holdings are explicitly collection-total change');
assert.equal(homeValueComparison({ ...current, copies: 30, total: 1490 }, [point], now).delta, -9.46, 'removed holdings are not described as market losses');
for (const history of [[], [{ date: day, total: 1499.46, copies: 34 }], [{ ...point, unpriced: 1 }], [{ ...point, currency: 'EUR' }], [{ ...point, basis: 'generic-card' }], [{ ...point, date: '2026-10-18' }], [{ ...point, date: '2026-02-30' }], [{ ...point, total: NaN }], [point, { ...point, date: '2026-10-16', unpriced: 4 }]]) {
  assert.equal(homeValueComparison(current, history, now), null, 'no inferred/foreign/partial/malformed/future baseline');
  assert.equal(homeValueModel({ ...current, history, now }).movement, '');
}
for (const unpriced of [1, 34]) assert.equal(homeValueComparison({ ...current, total: 900, unpriced }, [point], now), null, 'coverage loss cannot masquerade as a price loss');
assert.equal(homeValueModel({ ...current, total: 0, unpriced: 34 }).amount, '—');
assert.equal(homeValueModel({ ...current, total: null }).amount, '—');
assert.equal(homeValueModel({ ...current, total: 0 }).amount, '$0.00', 'a genuinely priced zero remains zero');
assert.equal(homeValueModel({ ...current, unpriced: 1 }).note, 'Known subtotal · 1 unpriced');
const hist = recordValuePoint([point], 1500, 34, homeValueCoverage({ unpriced: 0 }));
assert.deepEqual(hist[0], point, 'history is retained, not migrated by inference');
assert.equal(hist.at(-1).currency, 'USD'); assert.equal(hist.at(-1).unpriced, 0);

// Run the actual in-place painter against a narrow DOM. Node identity is never
// replaced, including when its value button or the unrelated search has focus.
const leaf = () => ({ textContent: '', hidden: false });
const leaves = Object.fromEntries(['amount','note','copies','decks','movement','explanation'].map(key => [`[data-value-${key}]`, leaf()]));
const valueNode = { isConnected: true, querySelector: key => leaves[key] };
const valueRoot = { querySelector: () => valueNode };
const doc = { body: { dataset: { view: 'home', game: 'mtg' } }, activeElement: { searchText: 'Keep my search' } };
assert(refreshHomeValue('mtg', valueRoot, { ...current, history: [point], now }, doc));
assert.equal(leaves['[data-value-amount]'].textContent, '$1,499.88');
assert.equal(doc.activeElement.searchText, 'Keep my search');
assert.equal(leaves['[data-value-movement]'].hidden, false);
refreshHomeValue('mtg', valueRoot, { ...current, total: 15, unpriced: 33, history: [point], now }, doc);
assert.equal(leaves['[data-value-amount]'].textContent, '$15.00'); assert.equal(leaves['[data-value-movement]'].hidden, true);
valueNode.isConnected = false;
assert.equal(refreshHomeValue('mtg', valueRoot, current, doc), false);
valueNode.isConnected = true; doc.body.dataset.game = 'ygo';
assert.equal(refreshHomeValue('mtg', valueRoot, current, doc), false);
doc.body.dataset.game = 'mtg'; doc.body.dataset.view = 'collection';
assert.equal(refreshHomeValue('mtg', valueRoot, current, doc), false);

// Price model integration: actual existing per-lot condition/currency resolver,
// not a second Home pricing implementation or a synthetic hardcoded subtotal.
S.state = blank(); S.state.tcg = { ygo: { collection: [], decks: [] }, ptcg: { collection: [], decks: [] } };
S.catalog = { bolt: { id: 'exact-mtg', name: 'Bolt', prices: { usd: '10' }, conditionQuotes: [] } };
for (const game of ['mtg','ygo','ptcg']) {
  const card = game === 'mtg' ? S.catalog.bolt : { game, id: `exact-${game}`, name: 'Fixture', prices: { usd: 10 }, variants: [{ key: 'normal', usd: 10 }], conditionQuotes: [] };
  if (game !== 'mtg') T.cache[game][card.id] = card;
  const entry = { id: `lot-${game}`, cardId: card.id, name: card.name, qty: 2, condition: 'Lightly Played', ...(game === 'ptcg' ? { variant: 'normal' } : {}) };
  const state = game === 'mtg' ? S.state : S.state.tcg[game]; state.collection = [entry];
  const value = () => game === 'mtg' ? magicValue(state.collection, S.catalog) : T.collectionValue(game);
  assert.equal(value().total, 0); assert.equal(value().unpriced, 2);
  const quote = { cardId: card.id, condition: 'Lightly Played', currency: 'USD', price: 7.25, priceStatus: 'current', validUntil: '2099-01-01', ...(game === 'ptcg' ? { variant: 'normal' } : {}) };
  entry.conditionQuotes = [{ ...quote, currency: 'EUR' }]; assert.equal(value().unpriced, 2, 'wrong currency is never converted or substituted');
  entry.conditionQuotes = [quote]; assert.equal(value().total, 14.5); assert.equal(value().unpriced, 0);
  entry.qty = 3; assert.equal(value().total, 21.75, 'local lot edits immediately affect the same resolver');
  entry.manualValue = 5.01; entry.manualValueCondition = 'Lightly Played'; assert.equal(value().total, 15.03);
  entry.condition = 'Damaged'; assert.equal(value().unpriced, 3, 'wrong-condition manual/quote values do not leak');
}

const deck = (game, suffix = 'a') => ({ key: `${game}:${suffix}`, name: `${game === 'ptcg' ? 'Pikachu ex' : game} list ${suffix}`, date: day, place: 'Top 8', event: 'Published tournament',
  url: game === 'mtg' ? `https://www.mtgo.com/decklist/${suffix}` : game === 'ygo' ? `https://ygoprodeck.com/deck/${suffix}` : `https://play.limitlesstcg.com/tournament/t/player/${suffix}/decklist`,
  ...(game === 'mtg' ? { cover: 'Lightning Bolt', main: [{ name: 'Lightning Bolt', qty: 4 }], commanders: [] } : game === 'ygo' ? { cover: '89631139', main: ['89631139'], extra: [], side: [] } : { list: [{ name: 'Pikachu ex', set: 'SSP', number: '57', qty: 4, kind: 'Pokemon' }] }) });
const source = { mtg: 'Magic Online', ygo: 'YGOPRODeck Tournament Meta Decks', ptcg: 'Limitless' };
for (const game of ['mtg','ygo','ptcg']) {
  const data = { source: source[game], fetchedAt: now, decks: ['a','b','c','d','e','f','g'].map(s => deck(game,s)) };
  Object.assign(metaState(homeMetaKey(game)), { data, at: now, error: '' });
  const slides = homeMetaSlides(game); assert.equal(slides.length, 6);
  assert.equal(slides[0].deckKey, data.decks[0].key); assert.equal(slides[0].artwork.deckKey, data.decks[0].key);
  assert.equal(slides[0].url, data.decks[0].url); assert.equal(slides[0].source, source[game]);
  const html = homeMetaCarousel(game), sharedLower = T.quickTiles(game);
  assert.equal((sharedLower.match(/class="home-meta"/g) || []).length,1,`${game}: exactly one shared full-width lower Meta rail`);
  assert.doesNotMatch(sharedLower,/class="quick"|quick-btn/,`${game}: no legacy split Deck ideas/Meta shortcut grid`);
  assert.match(html, /data-home-gesture="carousel"/); assert.match(html, /data-meta-toggle/); assert.match(html, /data-meta-step="-1"/);
  assert.doesNotMatch(html, /Build from my cards|Surprise me/); assert.match(html, /data-key=".+:a"/); assert.match(html, game === 'mtg' ? /data-act="mtgProven"/ : /data-act="tMetaDeck"/);
  assert.doesNotMatch(html, /quick-btn|#1|global rank|win rate/);
  assert.match(html, game === 'ygo' ? /List submitted/ : /Event date/);
  metaState(homeMetaKey(game)).data = { ...data, decks: [deck(game,'new')] };
  assert.equal(homeMetaSlides(game)[0].deckKey, `${game}:new`);
  assert.doesNotMatch(homeMetaCarousel(game), /data-key=".+:a"/, 'fresh results replace old slides, never append old lists');
  assert.equal(metaDeckSlides(game,{ data: { decks:[{...deck(game), url:'https://evil.invalid/a'}] } },homeMetaKey(game),now).length,0);
}
// Actual Home renderers: one shared discovery surface for every progress state.
// Saved continuation remains useful, but collection-only users have no second
// competing discovery card. Rendering never changes inventory or saves a deck.
const savedState=S.state;
for(const game of ['mtg','ygo','ptcg']) for(const progress of ['new','cards','saved']) {
  S.state=blank(); S.state.settings.game=game;
  S.state.tcg={ygo:{collection:[],decks:[]},ptcg:{collection:[],decks:[]}};
  const state=game==='mtg'?S.state:S.state.tcg[game];
  if(progress!=='new') state.collection=[{name:'Bolt',cardId:`exact-${game}`,qty:3}];
  if(progress==='saved') state.decks=game==='mtg'?[{id:'continue',name:'Keep this saved plan',format:'standard',cards:[],side:[]}]:[{id:'continue',name:'Keep this saved plan',format:game==='ygo'?'advanced':'standard',zones:{main:[],extra:[],side:[]}}];
  const before=JSON.stringify(S.state), html=game==='mtg'?magicHome():T.tcgHome();
  assert.equal((html.match(/data-home-discovery=/g)||[]).length,1,`${game}/${progress}: one unified discovery section`);
  assert.equal((html.match(/data-act="homeRandomDeck"/g)||[]).length,0);
  assert.equal((html.match(/>Build from my cards<\/button>/g)||[]).length,0);
  assert.equal((html.match(/data-home-value=/g)||[]).length,1);
  assert.equal((html.match(/data-home-community=/g)||[]).length,1);
  assert.doesNotMatch(html,/class="home-discover"|home-deal|Discover decks your cards support|>Random deck</);
  const order=['class="home-overview"', 'data-home-resume=', 'class="home-meta"', 'data-home-community='].map(token=>html.indexOf(token));
  assert(order.every((position,i)=>position>=0 && (!i || position>order[i-1])), 'value, resume, Meta, then news');
  assert.doesNotMatch(html,/home-deck-section|home-start|homeQ|homeRandomDeck|Build from my cards/);
  assert.match(html,/data-home-resume=/);
  if(progress==='saved')assert.match(html,/Choose a deck/,'an unrecorded deck is not falsely called recently worked');
  if(progress==='new')assert.match(html,/No saved decks yet/);
  assert.equal(JSON.stringify(S.state),before,'presentation does not create decks or edit collection');
}
S.state=savedState;
S.ui.mtgMeta = { format: 'Pioneer' };
assert.equal(homeMetaKey('mtg'),'mtg:Pioneer');
metaState('mtg:Pioneer').data = { source:'Magic Online', decks:[deck('mtg','pioneer')] };
assert.match(homeMetaCarousel('mtg'), /data-format="Pioneer"/);
delete S.ui.mtgMeta;

// Minimal event/clock DOM verifies the real delegated carousel controller.
function carouselDom(game, reduced = false) {
  Object.assign(metaState(homeMetaKey(game)),{ data:{ source:source[game],decks:[deck(game),deck(game,'b')] },at:now,error:'' });
  const listeners = {}, docListeners = {}, timers = new Map(); let id = 0, mutation, motionChange;
  const attrs = node => Object.assign(node,{ setAttribute(key,value){this[key]=value;} });
  const stage = attrs({ innerHTML:'', contains(target){return target?.stage === true;} });
  const toggle = attrs({ textContent:'Pause', dataset:{}, closest(s){return s === '[data-meta-toggle]' ? this : s === '[data-home-meta]' ? node : null;} });
  const arrow = attrs({ dataset:{metaStep:'1'}, closest(s){return s === '[data-meta-step]' ? this : s === '[data-home-meta]' ? node : null;} });
  const sourceLink = { stage:true,closest:s=>s === '[data-home-meta]' ? node : null };
  const position = { textContent:'' };
  const node = { dataset:{homeMeta:game},isConnected:true,contains:target=>[toggle,arrow,sourceLink].includes(target) || target?.stage === true,querySelector:s=>s==='.home-meta-stage'?stage:s==='[data-meta-toggle]'?toggle:s==='[data-home-meta-open]'?opener():position,querySelectorAll:()=>[toggle,arrow] };
  let current = node;
  const root = { querySelector:()=>current,addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:key=>delete listeners[key] };
  const documentRef = { body:{dataset:{view:'home',game}},hidden:false,activeElement:null,addEventListener:(key,fn)=>docListeners[key]=fn,removeEventListener:key=>delete docListeners[key] };
  const motion = { matches:reduced,addEventListener:(key,fn)=>motionChange=fn,removeEventListener:()=>motionChange=null };
  const view = { matchMedia:()=>motion,setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key),MutationObserver:class {constructor(fn){mutation=fn;}observe(){}disconnect(){mutation=null;}} };
  const cleanup = attachHomeMeta(root,{documentRef,view});
  const tick = () => {const batch=[...timers.values()];timers.clear();for(const fn of batch)fn();};
  const event = (name,target,extra={}) => listeners[name]?.({target,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){},...extra});
  const opener = () => {
    const html = stage.innerHTML, data = name => html.match(new RegExp(`data-${name}="([^"]*)"`))?.[1];
    return { stage: true, get isConnected(){return node.isConnected && stage.innerHTML === html;}, dataset:{key:data('key'),format:data('format'),homeMetaOpen:data('home-meta-open')}, closest:s=>s==='[data-home-meta]'?node:null };
  };
  return {opener,node,stage,toggle,arrow,sourceLink,documentRef,listeners,docListeners,motion,timers,tick,event,cleanup,mutate:()=>mutation?.(),motionChange:()=>motionChange?.(),unmount(){current=null;node.isConnected=false;mutation?.();}};
}
for (const game of ['mtg','ygo','ptcg']) {
  const app = carouselDom(game); assert.equal(app.timers.size,1); assert.match(app.stage.innerHTML,/data-meta-deck=".+:a"/);
  app.tick(); assert.match(app.stage.innerHTML,/data-meta-deck=".+:b"/);
  app.event('mouseover',app.arrow,{relatedTarget:null}); assert.equal(app.timers.size,0);
  app.event('mouseout',app.arrow,{relatedTarget:null}); assert.equal(app.timers.size,1);
  app.documentRef.hidden=true;app.docListeners.visibilitychange();assert.equal(app.timers.size,0);
  app.documentRef.hidden=false;app.docListeners.visibilitychange();assert.equal(app.timers.size,1);
  app.documentRef.activeElement=app.arrow;app.event('focusin',app.arrow);assert.equal(app.timers.size,0);assert.equal(app.toggle.textContent,'Resume');
  app.event('click',app.arrow);assert.match(app.stage.innerHTML,/data-meta-deck=".+:a"/);assert.equal(app.documentRef.activeElement,app.arrow);
  app.documentRef.activeElement=app.toggle;app.event('focusin',app.toggle);app.event('click',app.toggle);assert.equal(app.toggle.textContent,'Pause');assert.equal(app.timers.size,0,'resume waits until focus leaves controls');
  app.documentRef.activeElement=null;app.event('focusout',app.toggle);app.tick();assert.equal(app.timers.size,1);
  app.documentRef.activeElement=app.sourceLink;app.event('focusin',app.sourceLink);
  metaState(homeMetaKey(game)).data.decks=[deck(game,'fresh')];app.mutate();assert.match(app.stage.innerHTML,/data-meta-deck=".+:a"/,'focused deck is not detached on fresh data');
  app.documentRef.activeElement=null;app.event('focusout',app.sourceLink);app.tick();assert.match(app.stage.innerHTML,/data-meta-deck=".+:fresh"/);
  assert.equal(app.toggle.disabled,true);app.unmount();assert.equal(app.timers.size,0);app.cleanup();assert.equal(Object.keys(app.listeners).length,0);
}
const reduced = carouselDom('mtg',true); assert.equal(reduced.timers.size,0); assert.equal(reduced.toggle.textContent,'Motion paused'); assert.equal(reduced.toggle.disabled,true);
reduced.event('click',reduced.arrow);assert.match(reduced.stage.innerHTML,/data-meta-deck="mtg:b"/,'manual arrows remain available with reduced motion');reduced.cleanup();
const stale = carouselDom('ygo');stale.unmount();const before=stale.stage.innerHTML;stale.tick();assert.equal(stale.stage.innerHTML,before);stale.cleanup();

// Exercise production app hooks without importing the DOM application or starting
// any browser. An async quote completion paints only the current mounted glance.
const appSource = fs.readFileSync('app.js','utf8');
const metaInitializer=appSource.match(/^const mtgMetaFormat = .*;$/m)?.[0];
assert(metaInitializer,'exercise the actual Meta/emblem format initializer');
assert.equal(DEFAULT_MTG_META_FORMAT,'Modern','retain the established Meta default');
const previousDeckTab=S.ui.decksTab,workspaceBeforeFormat=JSON.stringify(S.state);
S.ui.decksTab='inspiration';
for(const format of [undefined,'Modern','Standard','Pioneer','EDH']){
  if(format)S.ui.mtgMeta={format};else delete S.ui.mtgMeta;
  const selected=S.ui.mtgMeta,expected=format || DEFAULT_MTG_META_FORMAT,beforeKey=homeMetaKey('mtg'),cached=metaState(beforeKey).data;
  assert.equal(beforeKey,`mtg:${expected}`);
  metaState(beforeKey).data=null;
  assert(magicDecks().includes(`class="chip pick on" data-act="mtgMetaFormat" data-id="${expected}"`),'Meta and Home agree before emblem initialization');
  metaState(beforeKey).data=cached;
  assert.equal(S.ui.mtgMeta,selected,'rendering does not invent or overwrite a selection');
  assert.equal(vm.runInNewContext(metaInitializer+'\nmtgMetaFormat();',{S,DEFAULT_MTG_META_FORMAT}),expected);
  assert.equal(homeMetaKey('mtg'),beforeKey,'emblem initialization cannot switch the Home source');
  if(selected)assert.equal(S.ui.mtgMeta,selected,'an explicit selected format remains the same object');
}
delete S.ui.mtgMeta;S.ui.decksTab=previousDeckTab;
assert.equal(JSON.stringify(S.state),workspaceBeforeFormat,'format initialization does not change saved decks or collection');
const start=appSource.indexOf('function refreshHomeValueGlance() {'),end=appSource.indexOf('\nfunction afterLocalSave()',start);
assert(start>0&&end>start);
let painted=[];
const context={S,T,useMyPrices(){},collectionValue:magicValue,refreshHomeValue:(...args)=>painted.push(args),$:()=>valueRoot};
for(const game of ['mtg','ptcg','ygo']){
 S.state.settings.game=game;S.ui.view='home';vm.runInNewContext(appSource.slice(start,end)+';refreshHomeValueGlance();',context);
 assert.equal(painted.at(-1)[0],game);assert.equal(painted.at(-1)[2].unpriced,3);
}
S.ui.view='collection';const prior=painted.length;vm.runInNewContext(appSource.slice(start,end)+';refreshHomeValueGlance();',context);assert.equal(painted.length,prior);
assert.match(appSource,/if\(changed\)refreshHomeValueGlance\(\);if\(current\(\)\)done/,'async exact quote changes paint Home even when the original Collection request lost its view');
assert.match(appSource,/function afterLocalSave\(\) \{\n  refreshHomeValueGlance\(\);/);
assert.match(appSource,/onSharedPrices\(\(\) => \{\n  refreshHomeValueGlance\(\);/);
assert.match(appSource,/cardstashy-rerender.*refreshHomeValueGlance/);

// Execute the actual action consumers and full spec builders against replaced
// caches, not just a resolver facsimile. Retained source/rows must be exact.
const tcgSource = fs.readFileSync('tcg.js','utf8');
for (const game of ['mtg','ygo','ptcg']) {
  const app = carouselDom(game), target = app.opener(), old = metaState(homeMetaKey(game)).data, oldDeck=old.decks.find(d=>d.key===target.dataset.key);
  app.documentRef.activeElement = target; app.event('focusin', target);
  const opened = [], notices = [], common = {
    A:{}, S, metaState, provenBuildSequence:0, homeMetaSnapshot:(t,g)=>homeMetaSnapshot(t,g,app.documentRef),
    toast:text=>notices.push(text), esc:x=>String(x || ''), key:x=>String(x).toLowerCase(),
    meta:()=>null, inv:()=>({owned:0}), namePrice:()=>null, priceOf:()=>null,
    mtgMetaFormat:()=>homeMetaKey('mtg').slice(4), MTG_META_FORMATS:[],
    tcgCtx:{openProven:spec=>opened.push(spec)}, c:{openProven:spec=>opened.push(spec)},
    g:()=>game, ownedMap:()=>new Map(), cardOf:()=>null, price:()=>null, cleanName:x=>x,
    pkByPrinting:new Map(), pkRequest:r=>({...r,key:r.name.toLowerCase()}), isBasicEnergyName:()=>false,
  };
  const code = game === 'mtg'
    ? appSource.slice(appSource.indexOf('A.mtgProven = (t) => {'), appSource.indexOf('\nA.copyRef ='))
    : tcgSource.slice(tcgSource.indexOf('  const tcgProvenSpec = '), tcgSource.indexOf('  A.tMuSee = ')) +
      tcgSource.slice(tcgSource.indexOf('  A.tMetaDeck = '), tcgSource.indexOf('  // Budget versions of a tournament deck:'));
  vm.runInNewContext(code,common);
  const activate = t => common.A[game === 'mtg' ? 'mtgProven' : 'tMetaDeck'](t);
  const replacement = deck(game,'replacement');
  // Reuse the same key once to prove identity is the rendered dataset, not just
  // a fresh lookup which could quietly open different cards under that key.
  replacement.key = target.dataset.key; replacement.name = 'Different unseen list';
  if(game==='mtg')replacement.main=[{name:'Different card',qty:1}];
  else if(game==='ygo')replacement.main=['99999999'];
  else replacement.list=[{name:'Different Pokemon',set:'OBF',number:'1',qty:1,kind:'Pokemon'}];
  metaState(homeMetaKey(game)).data = { source:'New source', decks:[replacement] };
  app.mutate(); activate(target);
  assert.equal(opened.length,1); assert.equal(opened[0].title,oldDeck.name);
  assert.equal(opened[0].sourceUrl,oldDeck.url); assert.equal(opened[0].listsFn().length,2);
  const oldRows=JSON.stringify(opened[0].rowsFn());
  replacement.key=`${game}:replacement`;
  // A real replacement removes the old key entirely. It must remain actionable
  // while its visible opener is still focused, without cache reinsertion.
  app.mutate(); activate(target);
  assert.equal(opened.length,2); assert.equal(opened[1].key,target.dataset.key);
  assert.equal(opened[1].sourceUrl,oldDeck.url); assert.equal(JSON.stringify(opened[1].rowsFn()),oldRows);
  assert.equal(app.documentRef.activeElement,target); assert(target.isConnected);
  assert(app.stage.innerHTML.includes(oldDeck.url));
  assert.equal(metaState(homeMetaKey(game)).data.decks.length,1);
  assert.equal(metaState(homeMetaKey(game)).data.decks[0].key,`${game}:replacement`);
  // Close/cancel the inspector, release focus, and adopt only the new snapshot.
  app.documentRef.activeElement=null; app.event('focusout',target); app.tick();
  const currentTarget=app.opener(); activate(currentTarget);
  assert.equal(opened.length,3); assert.equal(opened[2].key,`${game}:replacement`);
  assert.equal(opened[2].sourceUrl,replacement.url); assert.equal(opened[2].listsFn().length,1);
  assert.notEqual(JSON.stringify(opened[2].rowsFn()),oldRows,'new visible list opens its different actual cards');
  assert(!target.isConnected); activate(target); assert.equal(opened.length,3,'detached old opener is cancelled, not substituted');
  app.documentRef.body.dataset.game = game === 'mtg' ? 'ygo' : 'mtg';
  activate(currentTarget); assert.equal(opened.length,3,'old-game action cannot open');
  app.documentRef.body.dataset.game = game;
  if(game === 'mtg') { S.ui.mtgMeta={format:'Pioneer'}; activate(currentTarget); assert.equal(opened.length,3,'old-format action cannot open'); delete S.ui.mtgMeta; }
  app.unmount(); activate(currentTarget); assert.equal(opened.length,3,'unmounted snapshot cannot open');
  assert(notices.length>=3,'cancelled stale actions explain what to do, never silently substitute'); app.cleanup();
}

// Follow the retained inspector's actual downstream Build around it action.
// The inspector, not Home's now-replaced token or the global cache, owns this
// bounded snapshot through async seed resolution and into the builder.
for (const game of ['ygo','ptcg']) for (const replacementKind of ['removed','reused'])
for (const outcome of ['success','direct-entry','close','native-close','newer-inspector','game-change','remount','close-reopen','late-error']) {
  const app=carouselDom(game),opener=app.opener(),oldData=metaState(game).data,oldDeck=oldData.decks.find(d=>d.key===opener.dataset.key);
  app.documentRef.activeElement=opener;app.event('focusin',opener);
  const replacement=deck(game,'unseen');replacement.name='Unseen replacement';
  if(replacementKind==='reused')replacement.key=oldDeck.key;
  if(game==='ygo')replacement.main=['99999999'];else replacement.list=[{name:'Unseen Pokemon',qty:1,set:'OBF',number:'1',kind:'Pokemon'}];
  const card={id:game==='ygo'?'89631139':'old-pikachu',name:game==='ygo'?'Original dragon':'Pikachu ex',archetype:'Original engine',category:'Pokemon'};
  metaState(game).data={source:'New provider snapshot',decks:[replacement],top:[{id:card.id,name:card.name,pct:100}]};
  app.mutate();
  let resolve,reject,activeGame=game,button,closed=0,done=0;
  const pending=new Promise((yes,no)=>{resolve=yes;reject=no;}),calls=[],builds=[],notices=[],opened=[];
  const sheet={open:true,contains:t=>t===button && t.isConnected};
  const state={ui:{sheetCtx:null},state:{settings:{}}};
  const context={
    A:{},S:state,proven:{spec:null},metaState,g:()=>activeGame,
    homeMetaSnapshot:(t,g)=>homeMetaSnapshot(t,g,app.documentRef),
    toast:text=>notices.push(text),esc:x=>String(x || ''),cleanName:x=>x,
    ownedMap:()=>new Map(),cardOf:(g,id)=>id===card.id?card:null,price:()=>null,
    pkByPrinting:new Map(),pkRequest:r=>({...r,key:r.name.toLowerCase()}),isBasicEnergyName:()=>false,
    document:{querySelector:()=>sheet},busy:()=>()=>{done++;},
    metaZones:(g,d)=>{calls.push({g,d});return pending;},
    buildable:()=>[{id:game==='ygo'?'tcg':'standard'}],tcgBuildSheet:()=>'',
    openSheet:(html,ctx)=>{state.ui.sheetCtx=ctx;sheet.open=true;},runTBuild:()=>builds.push(state.ui.tbuild),
  };
  context.closeSheet=()=>{closed++;context.cancelProvenBuild();sheet.open=false;state.ui.sheetCtx=null;};
  context.c={openProven:spec=>{opened.push(spec);context.proven.spec=spec;state.ui.sheetCtx={type:'proven',key:spec.key};}};
  const lifecycle=tcgSource.slice(tcgSource.indexOf('let provenBuildSequence = '),tcgSource.indexOf('const PROVEN_BUDGETS = ')).replace('export function','function');
  const specs=tcgSource.slice(tcgSource.indexOf('  const tcgProvenSpec = '),tcgSource.indexOf('  A.tMuSee = '));
  const actions=tcgSource.slice(tcgSource.indexOf('  A.tMetaDeck = '),tcgSource.indexOf('  // Build from the cards you own:'));
  const builder=tcgSource.slice(tcgSource.indexOf('  const openBuild = '),tcgSource.indexOf('  A.tOptimizeDeck = '));
  vm.runInNewContext(lifecycle+specs+builder+actions,context);
  if(outcome==='direct-entry')metaState(game).data=oldData;
  context.A.tMetaDeck(outcome==='direct-entry'?{dataset:{key:oldDeck.key}}:opener);
  if(outcome==='direct-entry')metaState(game).data={source:'New provider snapshot',decks:[replacement],top:[{id:card.id,name:card.name,pct:100}]};
  const spec=context.proven.spec,origin=state.ui.sheetCtx;
  assert.equal(spec.sourceUrl,oldDeck.url);assert.equal(spec.buildMeta.data.source,oldData.source);
  assert.deepEqual(spec.buildMeta.data.decks.map(d=>d.key),oldData.decks.map(d=>d.key));
  button={isConnected:true,dataset:{key:oldDeck.key,provenBuild:spec.extraActions.match(/data-proven-build="([^"]+)"/)[1]}};
  app.documentRef.activeElement=null;app.event('focusout',opener);app.tick();
  assert.equal(homeMetaSnapshot(opener,game,app.documentRef),null,'Home token is retired while the exact inspector remains active');
  const loading=context.A.tMetaBuild(button);await context.A.tMetaBuild(button);
  assert.equal(calls.length,1,'duplicate inspector build clicks share one bounded seed resolution');
  assert.equal(calls[0].d.key,oldDeck.key);assert.equal(calls[0].d.url,oldDeck.url);
  assert.equal(JSON.stringify(game==='ygo'?calls[0].d.main:calls[0].d.list),JSON.stringify(game==='ygo'?oldDeck.main:oldDeck.list));
  if(['close','close-reopen','late-error'].includes(outcome)){context.cancelProvenBuild();sheet.open=false;state.ui.sheetCtx=null;}
  if(outcome==='close-reopen'){sheet.open=true;state.ui.sheetCtx=origin;}
  if(outcome==='native-close')sheet.open=false;
  if(outcome==='newer-inspector'){context.cancelProvenBuild();context.proven.spec={...spec};state.ui.sheetCtx={type:'proven',key:spec.key};}
  if(outcome==='game-change')activeGame=game==='ygo'?'ptcg':'ygo';
  if(outcome==='remount'){context.cancelProvenBuild();button.isConnected=false;}
  outcome==='late-error'?reject(Error('late provider failure')):resolve({zones:{main:[{cardId:card.id,qty:4}],extra:[],side:[]}});
  await loading;
  assert.equal(done,1);assert.deepEqual(notices,[],'cancelled async resolution never toasts into newer UI');
  if(['success','direct-entry'].includes(outcome)){
    assert.equal(closed,1);assert.equal(builds.length,1);assert.equal(builds[0].seed,card.id);
    assert.equal(builds[0].metaKey,oldDeck.key);assert.equal(builds[0].metaSnapshot.game,game);
    assert.equal(builds[0].metaSnapshot.data,spec.buildMeta.data,'actual openBuild carries original comparison dataset/source, not the latest cache');
    assert.equal(builds[0].metaSnapshot.data.source,oldData.source);
    assert.equal(builds[0].metaSnapshot.data.top?.length || 0,0,'current-cache staple labels cannot erase original signatures');
  }else{assert.equal(closed,0);assert.equal(builds.length,0,'cancelled/replaced inspector cannot close or replace newer UI');}
  assert.equal(metaState(game).data.decks[0],replacement,'retained list was never added to global cache');
  button.isConnected=false;await context.A.tMetaBuild(button);assert.equal(calls.length,1,'detached action has no authority');
  app.cleanup();
}
assert.match(appSource,/if \(S.ui.sheetCtx !== ctx \|\| !dlg.open\) T.cancelProvenBuild\(\);/);
assert.match(appSource,/function closeSheet\(rememberRoute=true\) \{\n  T.cancelProvenBuild\(\);/);
assert.match(appSource,/if \(\$\("#sheet"\).open\) return;\n  T.cancelProvenBuild\(\);/,'queued old close event cannot retire the newer inspector');
assert.match(tcgSource,/const meta = B.metaSnapshot\?\.game === G \? B.metaSnapshot.data : await metaFor\(G\)/,'builder consumes selected snapshot; ordinary direct builders still use current Meta');

// Shared in-flight requests must reach a newly subscribed Home mount even with
// zero/one starting lists (there is no automatic rotation to hide this race).
const deferred = () => { let resolve,reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; };
const liveMount = game => {
  const stage={innerHTML:'initial',contains:()=>false}, position={textContent:''};
  const mount={paints:0,html:'initial'};
  mount.community={isConnected:true,contains:()=>false,set outerHTML(html){mount.paints++;mount.html=html;}};
  mount.meta={dataset:{homeMeta:game},isConnected:true,querySelector:s=>s==='.home-meta-stage'?stage:position,querySelectorAll:()=>[]};
  mount.stage=stage; mount.disconnect=()=>{mount.community.isConnected=false;mount.meta.isConnected=false;};return mount;
};
let requestEpoch=10;
for(const game of ['mtg','ygo','ptcg']) for(const initial of [0,1]) {
  metaState(homeMetaKey(game)).data={source:source[game],decks:initial?[deck(game)]:[]};
  const news=deferred(),decks=deferred(),calls={news:0,decks:0},first=liveMount(game);
  let currentMount=first;
  const root={querySelector:s=>s.includes('data-home-community')?currentMount?.community:currentMount?.meta};
  const documentRef={body:{dataset:{view:'home',game}},activeElement:null};
  const options={now:now+(requestEpoch++)*86400000,documentRef,loadNews:()=>{calls.news++;return news.promise;},loadDecks:()=>{calls.decks++;return decks.promise;}};
  const loading=refreshHomeCommunity(game,root,options); await Promise.resolve();
  first.disconnect(); documentRef.body.dataset.view='collection';currentMount=null;
  const second=liveMount(game);currentMount=second;documentRef.body.dataset.view='home';
  assert.equal(refreshHomeCommunity(game,root,options),loading,'return subscribes without replacing the provider promise');
  assert.equal(refreshHomeCommunity(game,root,options),loading,'repeat render stays bounded');
  const newsSource={mtg:{sourceId:'wizards',url:'https://magic.wizards.com/en/news/announcements/arriving'},ygo:{sourceId:'konami',url:'https://www.yugioh-card.com/en/news/arriving'},ptcg:{sourceId:'pokeguardian',url:'https://www.pokeguardian.com/3412574_arriving'}}[game];
  communityState(game).data={items:[{game,...newsSource,kind:'news',title:'Arriving current story',source:'Original publisher',publishedAt:day,fetchedAt:new Date().toISOString()}],status:'ready'};
  news.resolve(); await new Promise(r=>setImmediate(r));
  assert.match(second.html,/Arriving current story/,'news is not held hostage by pending decks');
  metaState(homeMetaKey(game)).data={source:source[game],decks:[deck(game,'arriving')]};decks.resolve();await loading;
  assert.match(second.stage.innerHTML,/data-meta-deck=".+:arriving"/);
  assert(second.stage.innerHTML.includes(deck(game,'arriving').url));
  assert.equal(first.paints,0);assert.equal(first.stage.innerHTML,'initial');
  assert.deepEqual(calls,{news:1,decks:1});
  const paints=second.paints; await refreshHomeCommunity(game,root,options);assert.equal(second.paints,paints,'settled request releases subscriptions and keeps daily backoff');
}
// Cancellation rejects old mounts, old games, and changed Magic formats. A
// rejected shared request still does not launch duplicates or touch a new mount.
for(const cancellation of ['unmount','game','format','reject']) {
  const game='mtg', pending=deferred(),mount=liveMount(game);let currentMount=mount;
  const documentRef={body:{dataset:{view:'home',game}},activeElement:null};
  const root={querySelector:s=>s.includes('data-home-community')?currentMount?.community:currentMount?.meta};
  const options={now:now+(requestEpoch++)*86400000,loadNews:()=>pending.promise,loadDecks:()=>pending.promise,documentRef};
  const loading=refreshHomeCommunity(game,root,options);
  if(cancellation==='game')documentRef.body.dataset.game='ygo';
  else if(cancellation==='format')S.ui.mtgMeta={format:'Pioneer'};
  else {mount.disconnect();currentMount=liveMount(game);}
  cancellation==='reject'?pending.reject(Error('offline fixture')):pending.resolve();await loading;
  assert.equal(mount.paints,0);assert.equal(currentMount.paints,0);
  assert.equal(currentMount.stage.innerHTML,'initial');delete S.ui.mtgMeta;
}
console.log('PASS: all-game exact Home totals/valuation, retained exact rendered-list actions after real cache replacement, original source/rows, focus/cancel/unmount, zero/one-slide remount subscriptions, exact downstream inspector/build snapshots, pending close/reopen/replacement cancellation, shared all-game unified discovery composition, saved continuation, original random action and carousel controls.');

// Loading, empty and unavailable states must remain distinct in the normal suite.
await import('./test-home-meta-loading.mjs');
