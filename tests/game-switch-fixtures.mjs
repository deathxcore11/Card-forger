import {RELEASE} from '../release-record.js';
// Hosted real-shell fixtures. Import/validation never starts a server, browser,
// screenshot, camera, OCR worker or provider request. All records are synthetic.
import assert from 'node:assert/strict';
import {readdir, mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateWorkspace} from '../confidence.js';
import {artworkSources} from '../artwork.js';
import {pkCatalogueSymbolSources, pkRarity} from '../emblems.js';
import {sharePayload, sharePayloadTcg, decodeShare} from '../share.js';
import {SUPABASE} from '../config.js';
import {communityState, communitySlides} from '../community-feed.js';
import {communityPage} from '../home-ui.js';
import {COMMUNITY_ILLUSTRATIONS} from '../community-art.js';
import {
  ROOT, RESULTS, NOW, ISO, CARDS, RAW, SETS, RELEASES, LOB, UNIQUE, GROUP_IDS,
  makeSearchFixtures, providerFixture as searchProvider, startServer,
} from './search-fixtures.mjs';

export {ROOT, RESULTS, NOW, ISO, CARDS, GROUP_IDS, startServer};
export const GAMES = ['mtg', 'ygo', 'ptcg'];
const LOCAL_TAB_JPEGS = ['/game-tab-mtg.jpg', '/game-tab-ptcg.jpg'];
export const PAIRS = GAMES.flatMap(from => GAMES.filter(to => to !== from).map(to => ({
  from, to, dx: GAMES[(GAMES.indexOf(from) + 1) % GAMES.length] === to ? -120 : 120,
})));
export const METHODS = ['header', 'touch'];
export const WIDTHS = [320, 390, 768, 1440];
export const EVIDENCE = 'SYNTHETIC GAME-NAVIGATION FIXTURES. Real application shell with intercepted provider responses and trusted Chromium protocol touch input. No real collection, credentials, paid providers, physical camera, OCR-accuracy or live-artwork claim. Browser/server execution is restricted to approved hosted CI. Representative synthetic header screenshots are captured only in approved hosted CI.';
export const SWIPE_BLOCKED_SELECTOR = 'input,textarea,select,button,a,label,summary,[role="slider"],[contenteditable="true"],[draggable="true"],.deck-tile,[data-hold-card],.zoom-stage,.cam-wrap,.cam-stage,.scan-stage,#cropWrap,.crop-wrap,canvas,video,.scan-batch-strip,.scan-confirm,.hh-art-link,.hh-credit,[data-no-game-swipe],.lot';
// Exact rendered fixture identities only. Do not wildcard either provider or proxy.
export function pokemonSymbolFixtureUrls(base) {
  const sources=SETS.ptcg.flatMap(pkCatalogueSymbolSources);
  for(const rarity of new Set(CARDS.ptcg.map(c=>c.rarity).filter(Boolean))) {
    const html=pkRarity(rarity);
    for(const match of html.matchAll(/(?:src|data-direct)="([^"]+)"/g))sources.push(match[1]);
  }
  return [...new Set(sources.map(source=>new URL(source,base+'/').href))];
}
export const COLLISION_ID = 'synthetic-shared-deck-id';
export const SET_IDS = {mtg: 'fxa', ptcg: 'fxa', ygo: LOB.id};
export const DECK_TABS = {
  mtg: ['cards', 'versions', 'engine', 'matchups', 'upgrade', 'playtest', 'shop', 'rules'],
  ygo: ['cards', 'versions', 'insights', 'matchups', 'upgrade', 'playtest', 'rules'],
  ptcg: ['cards', 'versions', 'insights', 'matchups', 'upgrade', 'playtest', 'rules'],
};
export const SEARCH = {
  mtg: {q: 'Alpha', f: {color: 'G', type: 'creature', format: 'commander', maxPrice: '25', set: 'fxa', rarity: 'common'}, sort: 'name'},
  ptcg: {q: 'Beta', f: {category: 'Pokemon', type: 'Grass', stage: 'Basic', rarity: 'Common', format: 'standard', set: 'fxb'}, sort: 'new', maxPrice: '37', own: 'missing'},
  ygo: {q: 'Saved', f: {type: 'Effect Monster', attribute: 'LIGHT', race: 'Dragon', level: '8', format: 'tcg', set: 'FXX'}, sort: 'atkDesc', maxPrice: '49', own: ''},
};
export const BASE_ROWS = [
  {id: 'R01', hash: '#home', target: '#home'},
  {id: 'R02', hash: '#search', target: '#search', search: true},
  {id: 'R03', hash: '#collection', target: '#collection/cards'},
  {id: 'R04', hash: '#collection/cards', target: '#collection/cards'},
  {id: 'R05', hash: '#collection/binders', target: '#collection/binders'},
  {id: 'R06', hash: '#collection/value', target: '#collection/value'},
  {id: 'R07', hash: '#collection/cards', wanted: true},
  {id: 'R08', hash: '#decks', target: '#decks/mine'},
  {id: 'R09', hash: '#decks/mine', target: '#decks/mine'},
  {id: 'R10', hash: '#decks/ideas', target: '#decks/ideas'},
  {id: 'R11', hash: '#decks/inspiration', target: '#decks/inspiration'},
  {id: 'R12', deckTab: 'cards', target: '#decks/mine'},
  {id: 'R13', deckTab: 'versions', target: '#decks/mine'},
  {id: 'R14', hash: '#sets', target: '#sets', sets: true},
  {id: 'R15', set: true, target: '#sets'},
  {id: 'R16', hash: '#scan', target: '#scan', scan: true},
  {id: 'R17', hash: '#rules', target: '#rules'},
  {id: 'R18', hash: '#settings', target: '#settings', settings: true},
];
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#214057"/><text x="20" y="60" fill="white" font-size="24">SYNTHETIC NAVIGATION FIXTURE</text><text x="20" y="820" fill="white" font-size="24">NOT REAL CARD ART</text></svg>';
const SHOT = 'data:image/svg+xml;base64,' + Buffer.from(SVG).toString('base64');
const SCAN_KEY = 'cardstashy-scan-batch-v1';
const PREFS_KEY = 'cardstashy-scan-prefs-v1';
export const finishFor = g => ({mtg: 'foil', ptcg: 'holofoil', ygo: '1st-edition'})[g];
export const deckId = g => `synthetic-${g}-deck`;
export const targetHash = (row, to) => row.wanted ? to === 'mtg' ? '#collection/wishlist' : '#collection/cards' : row.target;
export function sourceHash(row, game, fixtures) {
  if (row.shared) return '#shared/' + fixtures.shared[game];
  if (row.deckTab) return (game === 'mtg' ? '#deck/' : '#tdeck/') + (row.collision ? COLLISION_ID : deckId(game)) + (game === 'mtg' ? '/' + row.deckTab : '');
  if (row.set) return '#set/' + encodeURIComponent(SET_IDS[game]);
  return row.wanted && game === 'mtg' ? '#collection/wishlist' : row.hash;
}
function deck(game, id, card) {
  return {id, name: `Synthetic ${game} ${id === COLLISION_ID ? 'collision' : 'source-only'} deck`, locked: false, versions: [],
    ...(game === 'mtg' ? {format: 'Standard', commander: '', cards: [{name: card.name, qty: 4}], side: []}
      : {format: game === 'ygo' ? 'tcg' : 'standard', zones: {main: [{cardId: card.id, name: card.name, qty: 3}], extra: [], side: []}})};
}
// Only carousel-isolation cases need multiple editorial pages. Keep all other
// navigation fixtures unchanged; these are synthetic articles, not live claims.
function carouselNewsFixture(game) {
  const sourceId={mtg:'wizards',ygo:'konami',ptcg:'pokeguardian'}[game];
  const prefix={mtg:'https://magic.wizards.com/en/news/announcements/synthetic-navigation-story-',ygo:'https://www.yugioh-card.com/en/news/synthetic-navigation-story-',ptcg:'https://www.pokeguardian.com/3412574_synthetic-navigation-story-'}[game];
  return {game,status:'ready',fetchedAt:ISO,checkedAt:ISO,items:[1,2,3,4].map(i=>({game,sourceId,kind:'news',title:`Synthetic ${game} navigation story ${i}`,url:prefix+i,publishedAt:'2026-10-16',fetchedAt:ISO}))};
}
export function carouselPages(game) {
  const ids=carouselNewsFixture(game).items.map(row=>row.url),total=ids.length;
  return [{position:`1–3 / ${total}`,ids:ids.slice(0,3)},{position:`4–${total} / ${total}`,ids:ids.slice(3)}];
}
export function makeGameSwitchFixtures(game = 'mtg', {carouselNews = false} = {}) {
  const f = makeSearchFixtures(game), {state, storage} = f;
  state.settings.binders = GAMES.map(g => ({id: `synthetic-binder-${g}`, game: g, title: `Synthetic ${g} binder`, rule: 'all', color: '#176b69', favorites: []}));
  state.settings.locations = ['Synthetic binder'];
  state.notes = [{id: 'synthetic-note', text: 'This sentinel must never change during navigation.'}];
  const shared = {};
  for (const g of GAMES) {
    const s = g === 'mtg' ? state : state.tcg[g], c = CARDS[g][0];
    s.decks = [deck(g, deckId(g), c), deck(g, COLLISION_ID, c)];
    s.wishlist = [{name: c.name, qty: 2, ...(g === 'mtg' ? {} : {cardId: c.id, key: `id:${c.id}`})}];
    const payload = g === 'mtg' ? sharePayload(s.decks[0]) : sharePayloadTcg(g, s.decks[0]);
    shared[g] = 'j.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
    storage['cardstashy-scan-session-v1-' + g] = [{id: `synthetic-session-${g}`, name: c.name, game: g, cardId: c.id, qty: 3, finish: finishFor(g), condition: 'Lightly Played', lang: 'ja', price: null, at: NOW}];
  }
  state.activeDeck = deckId('mtg');
  storage[SCAN_KEY] = GAMES.map((g, i) => ({id: `synthetic-capture-${g}`, captureRevision: `synthetic-revision-${g}`, game: g, selectedGame: g,
    at: NOW + i, status: 'review', shot: SHOT, originalShot: SHOT, qty: 2 + i, condition: 'Lightly Played', lang: 'ja', finish: finishFor(g), location: 'Synthetic binder',
    read: {name: CARDS[g][0].name, code: 'Synthetic unresolved printing'}, cands: [{id: CARDS[g][0].id, name: CARDS[g][0].name, game: g, card: CARDS[g][0], exact: false}], selectedIndex: 0}));
  storage[PREFS_KEY] = {shared: {sounds: false, haptics: false, qty: 3, condition: 'Lightly Played', lang: 'ja'},
    ...Object.fromEntries(GAMES.map(g => [g, {finish: finishFor(g), finishConfirmed: true, lockSet: 'synthetic-lock-' + g}]))};
  storage['cardforge-community-v2'] = storage['cardforge-community-v1'];
  if(carouselNews){const entry={at:NOW,data:carouselNewsFixture(game)};storage['cardforge-community-v2'][game]=entry;storage['cardforge-community-v3']={[game]:entry};}
  storage['cardforge-precons-v1'] = {at: NOW, decks: []};
  return {...f, shared};
}

// Persisted queue state is synthetic setup; all review/edit/switch/save actions
// in the hosted case use the real shell and scanner handlers.
export function makeScannerLifecycleFixture(game) {
  assert(GAMES.includes(game));
  const rows=structuredClone(makeGameSwitchFixtures(game).storage[SCAN_KEY]);
  const review=rows.find(row=>row.game===game),card=review.cands[0].card;
  if(game==='ygo')review.cands[0].print=card.sets[0].code+'|'+card.sets[0].rarity;
  const readingId='synthetic-reading-'+game,capturedId='synthetic-waiting-'+game;
  rows.push(...[[readingId,'reading'],[capturedId,'captured']].map(([id,status])=>({...structuredClone(review),id,captureRevision:id+'-revision',status,cands:[],read:{},finish:'',selectedIndex:-1})));
  return {rows,reviewId:review.id,readingId,capturedId};
}

// Manual name lookup has no capture ID. Seed only its bounded UI result;
// hosted review controls, navigation and explicit dismissal remain real actions.
export function makeManualReviewFixture(game) {
  const row=makeScannerLifecycleFixture(game).rows.find(row=>row.game===game);
  return {mode:'photo',url:null,rot:0,crop:null,auto:false,busy:false,status:'Synthetic manual lookup review',camOn:false,
    cands:structuredClone(row.cands),read:{name:row.cands[0].name,code:'',full:''},
    confirm:{game,i:0,qty:3,condition:'Lightly Played',lang:'ja',finish:finishFor(game),price:null,saving:false,error:'',editing:true}};
}

// Reuse the Search adapter contract, but add exact Set identities rather than
// let its generic Search response accidentally answer a release-detail read.
export function providerFixture(url) {
  const h = url.hostname, p = url.pathname;
  if (h === 'api.scryfall.com' && p.startsWith('/sets/')) return SETS.mtg.find(s => s.code === decodeURIComponent(p.split('/').at(-1)));
  if (h === 'api.scryfall.com' && p === '/cards/search' && /\be:/.test(url.searchParams.get('q') || '')) {
    const code = url.searchParams.get('q').match(/\be:([^\s]+)/)?.[1], rows = RAW.mtg.filter(c => c.set === code);
    return {object: 'list', data: rows, has_more: false, total_cards: rows.length};
  }
  if (h === 'db.ygoprodeck.com' && p.endsWith('/cardinfo.php') && url.searchParams.has('cardset')) {
    const rows = RAW.ygo.filter(c => c.card_sets.some(s => s.set_name === url.searchParams.get('cardset')));
    return {data: rows, meta: {total_rows: rows.length, rows_remaining: 0}};
  }
  return searchProvider(url);
}
export async function validateGameSwitchFixtures() {
  const tabStyle = await readFile(resolve(ROOT, 'game-tabs.css'), 'utf8');
  for (const path of LOCAL_TAB_JPEGS) {
    assert(tabStyle.includes(`url('.${path}')`), 'Exact local tab artwork is referenced by the current stylesheet');
    assert.deepEqual([...(await readFile(resolve(ROOT, path.slice(1)))).subarray(0, 3)], [255, 216, 255], 'Exact local tab artwork remains a JPEG');
  }
  const symbolBase='http://127.0.0.1:41279',symbols=pokemonSymbolFixtureUrls(symbolBase);
  assert.deepEqual(symbols.slice().sort(),[
    ...['synthetic-search-a','synthetic-search-b'].flatMap(slug=>[`${symbolBase}/img/pks/s/${slug}.png`,`https://pokesymbols.com/images/tcg/sets/symbols/${slug}.png`]),
    ...['common','rare'].flatMap(slug=>[`${symbolBase}/img/pks/r/${slug}.png`,`https://pokesymbols.com/images/tcg/rarities/${slug}.png`]),
  ].sort(),'Only exact symbols rendered by these synthetic cards/sets are allowed');
  for(const bad of [`${symbolBase}/img/pks/s/real-set.png`,'https://pokesymbols.com/images/tcg/rarities/unmapped.png'])assert(!symbols.includes(bad));
  const swipeSource=await readFile(resolve(ROOT,'home-swipe.js'),'utf8'),productionBlocked=swipeSource.match(/target\.closest\?\.\('([^']+)'\)/)?.[1];
  assert(productionBlocked,'Production swipe exclusions remain inspectable');
  for(const selector of productionBlocked.split(','))assert(selector==='[data-home-gesture]'||SWIPE_BLOCKED_SELECTOR.split(',').includes(selector),'Fixture refuses every production-excluded gesture target: '+selector);
  assert.equal(PAIRS.length, 6); assert.equal(new Set(PAIRS.map(p => p.from + ':' + p.to)).size, 6);
  assert.equal(BASE_ROWS.length * PAIRS.length * METHODS.length, 216);
  for (const g of GAMES) {
    const f = makeGameSwitchFixtures(g), checked = validateWorkspace(structuredClone(f.state));
    assert.equal(checked.settings.game, g); assert.equal(checked.settings.binders.length, 3);
    for (const gg of GAMES) {
      const s = gg === 'mtg' ? checked : checked.tcg[gg];
      assert.equal(s.decks.length, 2); assert(s.decks.some(d => d.id === COLLISION_ID));
      assert(s.decks.some(d => d.id === deckId(gg))); assert.equal(s.wishlist[0].qty, 2);
      const decoded = await decodeShare(f.shared[gg]); assert.equal(decoded.name, s.decks[0].name);
      assert(GROUP_IDS[gg][SEARCH[gg].q].length > 0);
      assert.equal(f.storage[PREFS_KEY][gg].lockSet, 'synthetic-lock-' + gg);
      assert.equal(f.storage[SCAN_KEY].find(r => r.game === gg).captureRevision, 'synthetic-revision-' + gg);
    }
    assert.equal(f.storage[SCAN_KEY].length, 3); assert.equal(checked.myPrices['89631139:nonfoil'].price, 987.65);
  }
  for(const g of GAMES) {
    const fixture=makeGameSwitchFixtures(g,{carouselNews:true}),state=communityState(g),saved={...state};
    try {
      Object.assign(state,{data:fixture.storage['cardforge-community-v3'][g].data,at:NOW,error:''});
      const slides=communitySlides(g,{now:NOW,metaState:{data:{decks:[],events:[]}}}).filter(row=>row.kind!=='deck'&&row.kind!=='link'&&row.category!=='decks').sort((a,b)=>Number(a.kind==='link')-Number(b.kind==='link'));
      const expected=carouselPages(g),page=communityPage(g,slides);
      assert.equal(slides.filter(row=>row.kind==='news').length,4,'Every distinct synthetic story survives real provenance/date validation');
      assert.equal(new Set(slides.map(row=>row.id)).size,slides.length);
      assert.deepEqual(slides.map(row=>row.id),expected.flatMap(page=>page.ids));
      assert.equal(page.pages,2);assert.equal(page.position,expected[0].position);assert.deepEqual(page.slides.map(row=>row.id),expected[0].ids);
      assert.equal(makeGameSwitchFixtures(g).storage['cardforge-community-v3'],undefined,'Multi-page news is opt-in only, preserving the other navigation cases');
    } finally {Object.assign(state,saved);}
  }
  for(const g of GAMES) {
    const f=makeScannerLifecycleFixture(g),review=f.rows.find(row=>row.id===f.reviewId);
    const manual=makeManualReviewFixture(g);assert.equal(manual.confirm.game,g);assert.equal(manual.confirm.batchId,undefined);assert.equal(manual.confirm.captureRevision,undefined);assert.equal(manual.cands[0].card.id,review.cands[0].card.id);
    assert.equal(f.rows.length,5);assert.equal(new Set(f.rows.map(row=>row.id)).size,5);
    assert.equal(f.rows.find(row=>row.id===f.readingId).status,'reading');assert.equal(f.rows.find(row=>row.id===f.capturedId).status,'captured');
    assert.equal(review.game,g);assert.equal(review.finish,finishFor(g));assert(review.originalShot&&review.captureRevision&&review.cands[0].card.id);
    if(g==='ygo')assert(review.cands[0].print.includes('|'));
    else assert((g==='mtg'?review.cands[0].card.finishes:review.cands[0].card.variants.map(v=>v.key)).includes(review.finish));
  }
  assert(providerFixture(new URL('https://api.scryfall.com/cards/search?q=e%3Afxa')).data.every(c => c.set === 'fxa'));
  assert.equal(providerFixture(new URL('https://api.scryfall.com/sets/fxa')).code, 'fxa');
  assert.equal(providerFixture(new URL('https://unknown-provider.invalid/')), undefined);
  assert.equal(targetHash(BASE_ROWS.find(r => r.wanted), 'ygo'), '#collection/cards');
  assert.equal(targetHash(BASE_ROWS.find(r => r.wanted), 'mtg'), '#collection/wishlist');
  return 'PASS: 216 base route/pair/mechanism cells, exact deck collision IDs, shared links, per-game search/filter sentinels, mixed-game scan drafts, interrupted queue/retry fixtures, durable record sentinels and opt-in exact two-page editorial fixtures validate. No browser/server/network/screenshot started.';
}

export const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
export async function openGameSwitchApp(browser, base, {game = 'mtg', width = 390, height = 844, reducedMotion = 'reduce', carouselNews = false} = {}) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Game-switch browser fixtures are approved-hosted-CI only');
  assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, hasTouch: true, reducedMotion, serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC'});
  const page = await context.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(15000);
  const fixtures = makeGameSwitchFixtures(game,{carouselNews}), errors = [], unexpected = [], writes = [], requests = [], gates = [];
  const staticPaths = new Set((await readdir(ROOT, {withFileTypes: true})).filter(d => d.isFile() && /\.(?:js|css|html|json|svg|png|ico|webmanifest)$/.test(d.name)).map(d => '/' + d.name));
  for (const path of LOCAL_TAB_JPEGS) staticPaths.add(path);
  for (const dir of ['rulebooks', 'scanidx']) for (const d of await readdir(resolve(ROOT, dir), {withFileTypes: true})) if (d.isFile()) staticPaths.add('/' + dir + '/' + d.name);
  staticPaths.add('/');
  const images = new Set([...pokemonSymbolFixtureUrls(base),...Object.values(COMMUNITY_ILLUSTRATIONS).map(x=>new URL(x.url,base+'/').href)]);
  for (const c of Object.values(CARDS).flat()) {
    const urls = [...artworkSources(c, false), ...artworkSources(c, true), ...Object.values(c.image_uris || {}), c.image, c.imageLarge, c.art, c.artDirect];
    for (const u of urls.filter(u => typeof u === 'string' && u)) images.add(new URL(u, base + '/').href);
  }
  for (const g of GAMES) images.add(`https://search-fixtures.invalid/hero-${g}.svg`);
  for (const id of SETS.mtg.map(s => s.code)) images.add(`https://svgs.scryfall.io/sets/${id}.svg`);
  for (const id of SETS.ptcg.map(s => s.id)) for (const kind of ['symbol', 'logo']) images.add(`https://images.pokemontcg.io/${id}/${kind}.png`);
  for (const code of RELEASES.map(s => s.code)) images.add(`https://images.ygoprodeck.com/images/sets/${encodeURIComponent(code)}.jpg`);
  for (const symbol of ['W', 'U', 'B', 'R', 'G', 'C', 'X', 'Y', 'Z', 'T', 'Q', 'S', 'E', ...Array.from({length: 21}, (_, i) => String(i))]) images.add(`https://svgs.scryfall.io/card-symbols/${symbol}.svg`);
  const history = new URL('/functions/v1/market-history', SUPABASE.url);
  const historyBody = u => ({game: u.searchParams.get('game'), cardId: u.searchParams.get('id'), finish: u.searchParams.get('finish'), series: [], points: []});
  const diagnostics = () => ({errors: [...errors], unexpected: [...unexpected], writes: [...writes], requests: requests.map(r => ({...r}))});
  const health = () => {assert.deepEqual(errors, [], 'No app or console errors'); assert.deepEqual(unexpected, [], 'Every request was explicitly mapped; none forwarded externally'); assert.deepEqual(writes, [], 'No network mutations or paid calls');};
  try {
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.on('console', msg => {if (msg.type() === 'error') errors.push('console.error: ' + msg.text());});
    assert.equal(typeof context.routeWebSocket, 'function', 'Hosted runner supports fail-closed WebSocket routing');
    await context.routeWebSocket('**/*', ws => {unexpected.push('WEBSOCKET ' + ws.url()); ws.close();});
    await context.route('**/*', async route => {
      const req = route.request(), u = new URL(req.url()), record = {method: req.method(), url: u.href, type: req.resourceType(), settled: false}; requests.push(record);
      const fulfill = async (body, type = 'application/json', status = 200) => {
        try {await route.fulfill({status, contentType: type, headers: {'access-control-allow-origin': '*'}, body: type === 'application/json' ? JSON.stringify(body) : body});}
        catch (e) {if (!/closed|abort|cancel/i.test(String(e))) errors.push(e.stack || String(e)); else record.cancelled = true;}
        finally {record.settled = true;}
      };
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {writes.push(`${req.method()} ${u.href}`); return fulfill({error: 'Mutation forbidden in navigation fixtures'}, 'application/json', 403);}
      for (const gate of gates) if (!gate.used && gate.match(u, req)) {gate.used = true; gate.started(); await gate.wait;}
      if (images.has(u.href)) return fulfill(SVG, 'image/svg+xml');
      if (u.hostname === 'fonts.googleapis.com' && /^\/css2?$/.test(u.pathname)) return fulfill('/* Synthetic fixtures use system fonts. */', 'text/css');
      if (u.origin === history.origin && u.pathname === history.pathname) return fulfill(historyBody(u));
      if (u.origin === base) {
        if (u.pathname === '/catalog.json') return fulfill({cards: [], snapshot_date: '2000-01-01'});
        if (u.pathname === '/api/meta/curation') return fulfill({game:u.searchParams.get('game'),format:u.searchParams.get('format'),status:'unavailable',rankedIds:[],annotations:[]});
        if (u.pathname === '/api/releases/current') return fulfill(RELEASE);
        if (u.pathname === '/api/community') return fulfill(fixtures.storage['cardforge-community-v2'][u.searchParams.get('game')]?.data || {items: [], status: 'unavailable'});
        if (['/api/prices/recent', '/api/prices/archive'].includes(u.pathname)) return fulfill(historyBody(u));
        if (['/api/prices/pokemon', '/api/prices/yugioh', '/api/prices/yugioh-set', '/api/prices/conditions', '/api/prices/mtg'].includes(u.pathname)) return fulfill({status: 'unavailable', quotes: [], cards: [], products: [], variants: [], prices: {}, printings: [], partial: false});
        if (/^\/api\/meta\/(?:mtg|ygo|ptcg)(?:\/[a-zA-Z0-9_-]+)?$/.test(u.pathname)) return fulfill({events: [], decks: [], archetypes: [], top: []});
        if (staticPaths.has(u.pathname)) {record.settled = true; return route.continue();}
      }
      const body = providerFixture(u); if (body !== undefined) return fulfill(body);
      unexpected.push(`${req.method()} ${u.href}`); return fulfill({error: 'Unexpected request blocked; no external traffic forwarded'}, 'application/json', 451);
    });
    await page.addInitScript(({storage, now, swipeBlocked}) => {
      const NativeDate = Date, offset = now - NativeDate.now();
      globalThis.Date = class extends NativeDate {constructor(...args) {super(...(args.length ? args : [NativeDate.now() + offset]));} static now() {return NativeDate.now() + offset;}};
      // Preserve genuine Date progression so trusted swipes retain real duration.
      if (!localStorage.getItem('game-switch-fixtures-installed')) {
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, JSON.stringify(v));
        localStorage.setItem('cardstashy-tour-v1', 'done'); localStorage.setItem('cardstashy-glass', 'off');
        localStorage.setItem('game-switch-fixtures-installed', '1');
      }
      window.__gameSwitchAudit = {pushes: [], replaces: [], touches: [], cameraCalls: 0, ocrCalls: 0, ocrWarmups: 0};
      for (const method of ['pushState', 'replaceState']) {
        const native = history[method].bind(history);
        history[method] = (...args) => {window.__gameSwitchAudit[method === 'pushState' ? 'pushes' : 'replaces'].push({url: String(args[2] || location.href), state: structuredClone(args[0])}); return native(...args);};
      }
      const recordTouch=e=>{
        const t=e.touches[0]||e.changedTouches[0];
        window.__gameSwitchAudit.touches.push({type:e.type,trusted:e.isTrusted,x:t?.clientX,y:t?.clientY,target:e.target.id||e.target.className||e.target.tagName,carousel:!!e.target.closest?.('[data-home-community]'),blocked:!!e.target.closest?.(swipeBlocked),isolated:!!e.target.closest?.('[data-home-gesture]'),inContent:!!e.target.closest?.('#content'),connected:e.target.isConnected,at:performance.now()});
      };
      let releaseTouchTarget=()=>{};
      for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>{
        recordTouch(e);
        if(type==='touchstart'){
          releaseTouchTarget();const target=e.target;window.__gameSwitchTouchTarget=target;
          const detached=event=>{if(!target.isConnected&&!event.composedPath().includes(document))recordTouch(event);if(['touchend','touchcancel'].includes(event.type))releaseTouchTarget();};
          for(const kind of ['touchmove','touchend','touchcancel'])target.addEventListener(kind,detached,{capture:true,passive:true});
          releaseTouchTarget=()=>{for(const kind of ['touchmove','touchend','touchcancel'])target.removeEventListener(kind,detached,true);releaseTouchTarget=()=>{};};
        }else if(type==='touchend'||type==='touchcancel')releaseTouchTarget();
      },{capture:true,passive:true});
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {window.__gameSwitchAudit.cameraCalls++; throw Error('Camera acquisition is forbidden in idle navigation tests');};
      window.Tesseract = {createWorker: async () => {window.__gameSwitchAudit.ocrWarmups++; return {setParameters:async()=>{},terminate:async()=>{},recognize:async()=>{window.__gameSwitchAudit.ocrCalls++;throw Error('Recognition is forbidden in idle navigation tests');}};}};
    }, {storage: fixtures.storage, now: NOW, swipeBlocked: SWIPE_BLOCKED_SELECTOR});
    await page.goto(base + '/#home'); await page.locator('#app.ready').waitFor();
    await page.evaluate(async ({search, cards, sets, releases}) => {
      const S = (await import('/store.js')).S, T = await import('/tcg.js');
      window.__uiTestState = S; window.__uiTestTcg = T;
      for (const g of ['mtg', 'ptcg', 'ygo']) {
        const spec = search[g], results = cards[g].filter(c => c.name.startsWith(spec.q + ' fixture'));
        if (g === 'mtg') Object.assign(S.ui.db, {term: spec.q, filters: {...spec.f}, sort: spec.sort, results, next: null, total: results.length, busy: false, error: ''});
        else Object.assign(T.ui(g).search, {q: spec.q, f: {...spec.f}, sort: spec.sort, maxPrice: spec.maxPrice, own: spec.own, results, total: results.length, page: 1, more: false, busy: false, error: '', ran: true, submitted: {q: spec.q, f: {...spec.f}, sort: spec.sort}});
        const catalogue = g === 'mtg' ? S.ui.sets : T.ui(g).sets;
        Object.assign(catalogue, {list: g === 'ygo' ? releases : g === 'mtg' ? sets.mtg : sets.ptcg.map(s => ({...s, date: s.releaseDate, count: s.cardCount.total})), busy: false, error: '', q: g === 'ygo' ? 'Legend' : g === 'ptcg' ? 'Search B' : 'Search A', sort: g === 'ptcg' ? 'old' : 'new'});
      }
      S.ui.ideas.ran = true; S.ui.finder.cacheLoaded = true;
    }, {search: SEARCH, cards: CARDS, sets: SETS, releases: RELEASES});
    await page.waitForFunction(g => document.body.dataset.game === g && window.__uiTestState.state.settings.game === g, game);
    return {page, context, fixtures, requests, health, diagnostics,
      hold(match) {let started, release; const seen = new Promise(r => started = r), wait = new Promise(r => release = r); gates.push({match, started, release, wait, used: false}); return {seen, release};},
      releaseAll() {for (const gate of gates) gate.release();},
      async close() {for (const gate of gates) gate.release(); await context.close();},
    };
  } catch (error) {error.fixtureDiagnostics = diagnostics(); for (const gate of gates) gate.release(); await context.close(); throw error;}
}

export async function captureNavigation(page, name) {
  assert.equal(process.env.GITHUB_ACTIONS,'true','Synthetic navigation screenshots are hosted-only');
  await mkdir(RESULTS,{recursive:true});
  const filename='game-switch-'+name+'.png';
  await page.screenshot({path:resolve(RESULTS,filename),fullPage:true,animations:'disabled'});
  return filename;
}

export async function savedSnapshot(page) {
  return page.evaluate(async () => {
    const pick = state => {const s = structuredClone(state); delete s.settings.game; delete s.lastSavedAt; return s;};
    const S = window.__uiTestState, saved = await (await import('/storage.js')).readRecord('cardforge-v2');
    const {privateKey}=await import('/account-scope.js');
    const scan = Object.fromEntries(['cardstashy-scan-batch-v1','cardstashy-scan-prefs-v1',...['mtg','ptcg','ygo'].map(g=>'cardstashy-scan-session-v1-'+g)].map(k=>[k,localStorage.getItem(privateKey(k))]));
    return JSON.stringify({state: pick(S.state), saved: pick(saved), scan});
  });
}
export async function searchSnapshots(page) {
  return page.evaluate(() => Object.fromEntries(['mtg', 'ptcg', 'ygo'].map(g => {
    const s = g === 'mtg' ? window.__uiTestState.ui.db : window.__uiTestTcg.ui(g).search;
    return [g, {q: s.term ?? s.q, f: s.filters ?? s.f, sort: s.sort, maxPrice: s.maxPrice, own: s.own, ids: s.results.map(c => String(c.id)), next: s.next, more: s.more, page: s.page}];
  })));
}
export async function historySnapshot(page) {
  return page.evaluate(() => ({length: history.length, hash: location.hash, state: structuredClone(history.state), pushes: window.__gameSwitchAudit.pushes.length, game: window.__uiTestTcg.game(), scroll: scrollY}));
}
export async function saveReport(outcomes, failures) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Hosted evidence only');
  await mkdir(RESULTS, {recursive: true});
  await writeFile(resolve(RESULTS, 'game-switch-browser.json'), JSON.stringify({generatedAt: new Date().toISOString(), evidence: EVIDENCE, baseCaseCount: 216, lifecycleCaseCount: 20, expectedCaseCount: 311,
    status: failures.length ? 'failed' : 'passed', outcomes, failures: failures.map(f => ({label: f.label, phase: f.phase, stack: f.error.stack, diagnostics: f.error.fixtureDiagnostics})),
    limits: ['No physical camera, actual OCR, price service or external provider traffic.', 'Live/pending camera/OCR and commit rejection remain pure lifecycle tests; these shell cases seed durable interrupted rows rather than simulate recognition.', 'Dirty-form shell coverage is a real unsaved deck editor blocked by browser traversal, not an exhaustive auth/form matrix.'],
  }, null, 2));
}
