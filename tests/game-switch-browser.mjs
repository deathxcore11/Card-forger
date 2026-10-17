// Run only in approved hosted CI: node tests/game-switch-browser.mjs
// Safe local schema check: node tests/game-switch-browser.mjs --validate-fixtures
// Transitions use actual header clicks or Chromium Input.dispatchTouchEvent.
// No DOM event constructors, direct setGame calls or live providers.
// Representative synthetic screenshots are captured only by approved hosted CI.
import assert from 'node:assert/strict';
import {cheapestQuery} from '../mtg-cheap.js';
import {
  GAMES, PAIRS, METHODS, BASE_ROWS, WIDTHS, EVIDENCE, SEARCH, SET_IDS, CARDS, SWIPE_BLOCKED_SELECTOR, captureNavigation,
  sourceHash, targetHash, finishFor, carouselPages, validateGameSwitchFixtures, makeScannerLifecycleFixture, makeManualReviewFixture, COLLISION_ID,
  startServer, openGameSwitchApp, frames, savedSnapshot, searchSnapshots, historySnapshot, saveReport,
} from './game-switch-fixtures.mjs';

console.log(await validateGameSwitchFixtures());
if (process.argv.includes('--validate-fixtures')) process.exit(0);
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Browser execution is approved-hosted-CI only. Use --validate-fixtures locally.');
const {chromium} = await import('playwright');
const outcomes = [], failures = [];
let browser, server;
const delay = ms => new Promise(r => setTimeout(r, ms));
const tab = (page, game) => page.locator(`#gameTabs [role="tab"][data-game="${game}"]`);
const read = page => page.evaluate(() => {
  const S = window.__uiTestState, T = window.__uiTestTcg, g = T.game();
  return {game: g, savedGame: S.state.settings.game, bodyGame: document.body.dataset.game, view: S.ui.view, bodyView: document.body.dataset.view,
    hash: location.hash, coll: g === 'mtg' ? S.ui.collTab : T.ui(g).coll.tab || 'cards', show: g === 'mtg' ? '' : T.ui(g).coll.show,
    decks: S.ui.decksTab, deckId: S.ui.deckId, tdeckId: S.ui.tdeckId, tsetId: S.ui.tsetId, sharedCode: S.ui.shared?.code,
    selected: [...document.querySelectorAll('#gameTabs [aria-selected="true"]')].map(n => n.dataset.game),
    labelledBy: document.querySelector('#content')?.getAttribute('aria-labelledby'),
    busySearch: g === 'mtg' ? S.ui.db.busy : T.ui(g).search.busy};
});
async function waitRoute(page, game, hash) {
  try {await page.waitForFunction(({game, hash}) => document.body.dataset.game === game && window.__uiTestTcg.game() === game && location.hash === hash && !document.querySelector('#content').inert && document.querySelector('#content').getAttribute('aria-busy')!=='true', {game, hash});}
  catch(error){error.stack+='\nRoute/touch diagnostics: '+JSON.stringify({expected:{game,hash},actual:await read(page),touches:await page.evaluate(()=>window.__gameSwitchAudit.touches.slice(-12))});throw error;}
  await frames(page);
}
async function prepare(app, pair, row) {
  const {page} = app, hash = sourceHash(row, pair.from, app.fixtures);
  await page.evaluate(({g, wanted, collision}) => {
    if (wanted && g !== 'mtg') Object.assign(window.__uiTestTcg.ui(g).coll, {tab: 'cards', show: 'wanted'});
    if (collision && g === 'mtg') window.__uiTestState.state.activeDeck = 'synthetic-shared-deck-id';
  }, {g: pair.from, wanted: !!row.wanted, collision: !!row.collision});
  if (await page.evaluate(() => location.hash) !== hash) await page.evaluate(h => {location.hash = h;}, hash);
  await waitRoute(page, pair.from, hash);
  if (row.set) {
    await page.waitForFunction(({g, id}) => {const u = g === 'mtg' ? window.__uiTestState.ui.set : window.__uiTestTcg.ui(g).set; return !u.busy && u.cards.length > 0 && (g === 'mtg' ? u.code === id : u.id === id);}, {g: pair.from, id: SET_IDS[pair.from]});
  }
  if (row.shared) await page.waitForFunction(() => !!window.__uiTestState.ui.shared.deck && !window.__uiTestState.ui.shared.error);
  if (row.deckTab) {
    const action = pair.from === 'mtg' ? 'deckTab' : 'tDeckTab';
    const control = page.locator(`#content [data-act="${action}"][data-id="${row.deckTab}"]`).first();
    await control.waitFor();
    if (await control.getAttribute('aria-selected') !== 'true') await control.click();
    assert.equal(await control.getAttribute('aria-selected'), 'true', 'The real source deck subtab is active');
  }
  if (row.settings) {
    await page.locator('[data-act="settingsTab"][data-id="backup"]').click();
    assert.equal(await page.locator('#settingsTab-account').getAttribute('aria-selected'), 'true');
  }
  // Normalize and persist only the synthetic setup, before observing transitions.
  // This avoids confusing initial workspace migrations with navigation writes.
  await page.evaluate(async () => {await (await import('/storage.js')).writeRecord('cardforge-v2', window.__uiTestState.state);});
  await frames(page); app.health();
  return hash;
}
async function assertTarget(page, pair, row) {
  const expected = targetHash(row, pair.to), s = await read(page), [view, sub] = expected.slice(1).split('/');
  assert.equal(s.game, pair.to); assert.equal(s.savedGame, pair.to); assert.equal(s.bodyGame, pair.to);
  assert.deepEqual(s.selected, [pair.to], 'Exactly one accessible game tab selected');
  assert.equal(s.labelledBy, 'game-tab-' + pair.to); assert.equal(s.hash, expected);
  assert.equal(s.view, view); assert.equal(s.bodyView, view);
  if (view === 'collection') assert.equal(s.coll, sub, 'Collection semantic tab transfers');
  if (row.wanted && pair.to !== 'mtg') assert.equal(s.show, 'wanted', 'Wishlist maps to the real TCG Wanted filter');
  if (view === 'decks') assert.equal(s.decks, sub, 'Decks semantic tab transfers');
  assert(!s.deckId && !s.tdeckId && !s.tsetId && !s.sharedCode, 'Active source resource pointers and share tokens are cleared, not reinterpreted');
  assert.equal(s.busySearch, false, 'No obsolete busy flag survives the switch');
  if (row.search) {
    const control = page.locator(pair.to === 'mtg' ? '#dbTerm' : '[data-input="tQ"]');
    assert.equal(await control.inputValue(), SEARCH[pair.to].q, 'The target uses its own saved query');
    assert((await page.locator('#content .card-grid > .grid-card').count()) > 0, 'Saved target result cards render');
  }
  if (row.sets || row.set) {
    const actual = await page.getByRole('searchbox', {name: 'Find a set', exact: true}).inputValue();
    assert.equal(actual, pair.to === 'ygo' ? 'Legend' : pair.to === 'ptcg' ? 'Search B' : 'Search A', 'Target catalogue keeps its own filter');
  }
  if (row.scan) {
    await page.getByRole('heading', {name: 'Scan', exact: true}).waitFor();
    const scan = await page.evaluate(async g => ({prefs: (await import('/scansession.js')).loadPrefs(g), camera: window.__gameSwitchAudit.cameraCalls, ocr: window.__gameSwitchAudit.ocrCalls, confirm: !!window.__uiTestState.ui.scan.confirm, camOn: !!window.__uiTestState.ui.scan.camOn}), pair.to);
    assert.equal(scan.prefs.finish, finishFor(pair.to)); assert.equal(scan.prefs.lockSet, 'synthetic-lock-' + pair.to);
    assert.equal(scan.camera, 0); assert.equal(scan.ocr, 0); assert.equal(scan.confirm, false); assert.equal(scan.camOn, false);
    assert.equal(await page.locator('.scan-batch-thumb').count(), 3, 'All original mixed-game captures stay reviewable');
  }
  if (row.settings) assert.equal(await page.locator('#settingsTab-account').getAttribute('aria-selected'), 'true', 'Settings subsection survives');
  if (view === 'rules') assert.equal(await page.locator('[data-learning-root]').getAttribute('data-game'), pair.to, 'Rules use target-game context');
}

// Choose a physically hittable safe background in the real UI, never add a
// test-only gesture surface or disable pointer events on production controls.
async function settledContent(page) {
  await page.waitForFunction(()=>{const root=document.querySelector('#content');return root&&!root.inert&&root.getAttribute('aria-busy')!=='true'&&root.getAnimations({subtree:true}).every(a=>a.playState==='finished'||a.playState==='idle'||!Number.isFinite(a.effect?.getComputedTiming().iterations));});
  await frames(page);
}
async function safePoint(page, dx, {carousel = false} = {}) {
  if (carousel) await page.locator('[data-home-community]').scrollIntoViewIfNeeded();
  else await page.evaluate(() => scrollTo(0, 0));
  await settledContent(page);
  // A one-pixel padding gap is not a real touch surface: Chromium may retarget
  // the contact to an adjacent button. Require clear space around the whole path.
  const point = await page.evaluate(({dx, carousel, blocked}) => {
    const root=document.querySelector(carousel?'[data-home-community]':'#content'),r=root.getBoundingClientRect();
    const left=Math.max(32,r.left+12),right=Math.min(innerWidth-32,r.right-12);
    const eligible=(x,y)=>{const target=document.elementFromPoint(x,y);if(!target||!root.contains(target)||target.closest(blocked)||!carousel&&target.closest('[data-home-gesture],.home-hero'))return null;
      for(let el=target;el&&el!==root;el=el.parentElement)if(el.scrollWidth>el.clientWidth+8&&/auto|scroll/.test(getComputedStyle(el).overflowX))return null;
      return target;
    };
    for(let y=Math.max(r.top+18,(document.querySelector('.topbar')?.getBoundingClientRect().bottom||0)+18,80);y<Math.min(r.bottom-18,innerHeight-100);y+=6)for(let x=left;x<=right;x+=8){
      if(x+dx<left||x+dx>right)continue;
      const path=Array.from({length:7},(_,i)=>x+dx*i/6);
      if(!path.every(px=>[-10,0,10].every(ox=>[-10,0,10].every(oy=>eligible(px+ox,y+oy)))))continue;
      const target=eligible(x,y);return {x,y,tag:target.tagName,id:target.id,className:target.className,carousel:!!target.closest('[data-home-community]')};
    }
    return null;
  }, {dx, carousel, blocked:SWIPE_BLOCKED_SELECTOR});
  assert(point, 'A real clear swipe background is physically reachable at this viewport');
  assert.equal(point.carousel, carousel); return point;
}
async function trustedSwipe(app, dx, {carousel = false, afterFirstMove} = {}) {
  const {page,context}=app,point=await safePoint(page,dx,{carousel});
  const start=await page.evaluate(()=>window.__gameSwitchAudit.touches.length),session=await context.newCDPSession(page);
  let events;
  try {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,radiusX:4,radiusY:4,force:1,id:1}]});
    await page.waitForFunction(start=>window.__gameSwitchAudit.touches.length>start,start);
    const first=await page.evaluate(start=>window.__gameSwitchAudit.touches[start],start);
    assert(first.trusted&&first.type==='touchstart'&&first.inContent&&!first.blocked&&first.carousel===carousel&&(carousel||!first.isolated),'Trusted touch hit a permitted real region: '+JSON.stringify({point,first}));
    for(let i=1;i<=6;i++){
      await delay(24);
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+dx*i/6,y:point.y,radiusX:4,radiusY:4,force:1,id:1}]});
      if(i===1&&afterFirstMove)await afterFirstMove();
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(start=>window.__gameSwitchAudit.touches.slice(start).some(e=>e.type==='touchend'||e.type==='touchcancel'),start);
    events=await page.evaluate(start=>window.__gameSwitchAudit.touches.slice(start),start);
  } catch(error){error.stack+='\nTrusted touch diagnostics: '+JSON.stringify({point,events:await page.evaluate(start=>window.__gameSwitchAudit.touches.slice(start),start)});throw error;}
  finally {await session.detach();}
  assert(events.length>=3&&events.every(e=>e.trusted),'Protocol injection produced trusted browser touch events: '+JSON.stringify({point,events}));
  assert.equal(events[0].type,'touchstart');assert.equal(events.at(-1).type,'touchend');
  assert(events.some(e=>e.type==='touchmove'));assert.equal(events[0].carousel,carousel,'Touch hit the intended real region');
  assert(!events.some(e=>e.type==='touchcancel'),'The input remained an uninterrupted real touch gesture');
  return {point,events};
}
async function switchGame(app, pair, row, method, touchOptions) {
  let gesture;
  if (method === 'header') {assert.equal(await tab(app.page, pair.to).count(), 1); await tab(app.page, pair.to).click();}
  else gesture=await trustedSwipe(app, pair.dx, touchOptions);
  await waitRoute(app.page, pair.to, targetHash(row, pair.to));
  return gesture;
}
async function bottomNavEvidence(page) {
  const geometry=await page.locator('.bottom-nav').evaluate(nav=>({width:innerWidth,nav:nav.getBoundingClientRect().toJSON(),scroll:nav.scrollWidth,client:nav.clientWidth,
    buttons:[...nav.querySelectorAll('button')].map(button=>{const rect=button.getBoundingClientRect(),labelNodes=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()),label=labelNodes.map(n=>n.textContent.trim()).join(''),labels=labelNodes.flatMap(node=>{const range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()].map(r=>r.toJSON());}),icon=button.querySelector('span').getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return {label,font:getComputedStyle(button).fontSize,rect:rect.toJSON(),labels,icon:icon.toJSON(),scroll:button.scrollWidth,client:button.clientWidth,hit:!!hit&&(hit===button||button.contains(hit))};})}));
  assert.deepEqual(geometry.buttons.map(b=>b.label),['Community','Collection','Search','Decks','Scan'],'All five full section labels remain visible');
  assert(geometry.scroll<=geometry.client+1&&geometry.nav.right<=geometry.width+.5,'Bottom navigation itself fits the viewport');
  for(const button of geometry.buttons){
    assert.equal(button.font,'11px','Full bottom labels retain the established readable type size');
    assert(Math.abs(button.rect.width-geometry.width/5)<.5,'All five equal targets keep their full track width');
    assert(button.rect.width>=44&&button.rect.height>=44&&button.rect.left>=-.5&&button.rect.right<=geometry.width+.5&&button.hit,'Every bottom navigation target is full-sized, visible and physically reachable: '+JSON.stringify(button));
    assert(button.scroll<=button.client+1,'Bottom navigation content does not overflow its track: '+JSON.stringify(button));
    for(const rect of [button.icon,...button.labels])assert(rect.left>=button.rect.left-.5&&rect.right<=button.rect.right+.5&&rect.top>=button.rect.top-.5&&rect.bottom<=button.rect.bottom+.5,'Full icon and readable label stay inside their own target: '+JSON.stringify(button));
  }
  return {filename:await captureNavigation(page,`bottom-nav-${geometry.width}`),geometry};
}
async function semanticCase(app, pair, row, method) {
  // Keep the existing R13 identity and route assertions. Delay only its exact
  // synthetic price response, then allow the real app's background render to
  // replace the original touch target between trusted move1 and touchend.
  const refresh=row.id==='R13'&&pair.from==='mtg'&&pair.to==='ygo'&&method==='touch'?
    app.hold(url=>url.hostname==='api.scryfall.com'&&url.pathname==='/cards/search'&&url.searchParams.get('q')===cheapestQuery(CARDS.mtg[0].name)):null;
  await prepare(app, pair, row);
  if(refresh)await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Expected exact synthetic cheapest-printing request was not issued')),8000);refresh.seen.then(()=>{clearTimeout(timeout);resolve();},reject);});
  const bottomNavigation=row.id==='R01'&&pair.from==='mtg'&&pair.to==='ygo'&&method==='header'&&[320,390].includes(app.page.viewportSize().width)?await bottomNavEvidence(app.page):undefined;
  const before = await savedSnapshot(app.page), searches = await searchSnapshots(app.page), history = await historySnapshot(app.page);
  const gesture=await switchGame(app, pair, row, method,refresh?{afterFirstMove:async()=>{
    refresh.release();
    await app.page.waitForFunction(()=>window.__gameSwitchTouchTarget?.isConnected===false,null,{timeout:2000});
    assert.equal((await historySnapshot(app.page)).hash,history.hash,'Only a same-route background render detached the target');
  }}:undefined); await assertTarget(app.page, pair, row);
  if(refresh){
    assert(gesture.events.some(e=>e.type==='touchmove'&&e.connected===false),'Real trusted moves continued on the detached original target');
    assert.equal(gesture.events.at(-1).connected,false,'Real touchend reached the detached target rather than a fabricated replacement');
  }
  const after = await historySnapshot(app.page);
  assert.equal(after.length, history.length + 1, 'Exactly one browser entry per game change, including unchanged hashes');
  assert.equal(after.pushes, history.pushes + 1, 'The game transition pushes exactly once');
  assert.equal(await savedSnapshot(app.page), before, 'Saved collection/decks/versions/wishlist/binders/locations/scans are byte-equivalent except settings game/save timestamp');
  assert.deepEqual(await searchSnapshots(app.page), searches, 'All per-game queries, filters, loaded results and paging survive without copying');
  return {hash: after.hash, historyDelta: after.length - history.length,...(bottomNavigation?{bottomNavigation}:{}),...(refresh?{detachedGesture:gesture}:{})};
}
async function historyCase(app, pair, method) {
  const row = BASE_ROWS.find(r => r.search);
  const original = await prepare(app, pair, row), before = await savedSnapshot(app.page), filters = await searchSnapshots(app.page);
  const initial = await historySnapshot(app.page); await switchGame(app, pair, row, method);
  const switched = await historySnapshot(app.page); assert.equal(switched.hash, original, 'History case actually has unchanged hash');
  await app.page.goBack(); await waitRoute(app.page, pair.from, original);
  assert.equal((await historySnapshot(app.page)).length, initial.length + 1);
  assert.equal((await historySnapshot(app.page)).pushes, switched.pushes, 'Back must not push another entry');
  assert.deepEqual((await read(app.page)).selected, [pair.from]);
  assert.deepEqual(await searchSnapshots(app.page), filters);
  await app.page.goForward(); await waitRoute(app.page, pair.to, original); await assertTarget(app.page, pair, row);
  assert.equal((await historySnapshot(app.page)).pushes, switched.pushes, 'Forward must not push another entry');
  assert.equal(await savedSnapshot(app.page), before);
  await app.page.reload(); await app.page.locator('#app.ready').waitFor();
  await app.page.evaluate(async () => {window.__uiTestState = (await import('/store.js')).S; window.__uiTestTcg = await import('/tcg.js');});
  await waitRoute(app.page, pair.to, original);
  await app.page.goBack(); await waitRoute(app.page, pair.from, original);
  await app.page.goForward(); await waitRoute(app.page, pair.to, original);
  assert.equal((await historySnapshot(app.page)).length, switched.length, 'Reload and traversal retain the same navigation entries');
  return {sameHash: original, reloadTraversal: true};
}
async function carouselCase(app, game) {
  const initial = await historySnapshot(app.page), before = await savedSnapshot(app.page), expected=carouselPages(game);
  const snapshot=()=>app.page.locator(`[data-home-community="${game}"]`).evaluate(node=>({position:node.querySelector('.community-position').textContent,ids:[...node.querySelectorAll('.community-stage [data-slide-id]')].map(row=>row.dataset.slideId)}));
  const positions = [await snapshot()];assert.deepEqual(positions[0],expected[0],'The first page contains the exact first three validated stories');
  // Forward, backward, backward boundary wrap, forward boundary wrap.
  for (const [dx,index] of [[-120,1],[120,0],[120,1],[-120,0]]) {
    const prior=positions.at(-1);
    await trustedSwipe(app, dx, {carousel: true}); await frames(app.page);
    const current=await snapshot();positions.push(current);
    assert.notEqual(current.position,prior.position,'Trusted touch changes the editorial page, including boundary wrap');
    assert.deepEqual(current,expected[index],'The exact page range and story/source IDs follow the trusted swipe');
    const state = await historySnapshot(app.page);
    assert.equal(state.game, game); assert.equal(state.hash, '#home'); assert.equal(state.length, initial.length); assert.equal(state.pushes, initial.pushes);
    assert.equal(await savedSnapshot(app.page), before,'Each carousel gesture preserves all saved game data');
    await delay(460); // Next independent input is outside carousel click suppression.
  }
  assert.equal(await savedSnapshot(app.page), before); return {positions};
}

// These bounded cases exercise the actual shell and handlers, not controller mocks.
const batchRows = page => page.evaluate(async () => (await import('/scan-batch.js')).loadBatch());
const collections = page => page.evaluate(() => Object.fromEntries(['mtg','ygo','ptcg'].map(g => [g, structuredClone((g === 'mtg' ? window.__uiTestState.state : window.__uiTestState.state.tcg[g]).collection)])));
async function dirtyFormCase(app, game) {
  const {page} = app, other = GAMES[(GAMES.indexOf(game) + 1) % GAMES.length], row = {hash:'#decks/mine',target:'#decks/mine'};
  await prepare(app, {from:game}, row);
  // Create a genuine previous-game entry, then return to the form's owning game.
  await tab(page, other).click(); await waitRoute(page, other, row.hash);
  await tab(page, game).click(); await waitRoute(page, game, row.hash);
  const initial = await historySnapshot(page), before = await savedSnapshot(page), name = `Unsaved ${game} fixture deck`;
  await page.locator(`#content [data-act="${game === 'mtg' ? 'newDeck' : 'tNewDeck'}"]`).first().click();
  const field = page.locator(game === 'mtg' ? '#ndName' : '#tDeckName');
  await field.fill(name);
  assert.equal(await page.locator('#sheet').evaluate(node => node.matches(':modal')), true, 'The real dirty editor is a native modal');
  await field.press('ArrowRight'); // Editing keys must not become game-tab keys.
  assert.equal((await read(page)).game, game);
  // Browser traversal is allowed while a modal is open; the app must reject it
  // without persisting the other game, dismissing the form or losing typed data.
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('Finish saving or close the current edit'));
  await page.waitForFunction(({game,id}) => history.state?.cardstashy?.entryId === id && document.body.dataset.game === game,
    {game,id:initial.state.cardstashy.entryId});
  assert.equal(await field.inputValue(), name);
  assert.equal(await page.locator('#sheet').evaluate(node => node.open), true);
  const blocked = await historySnapshot(page);
  assert.equal(blocked.hash, initial.hash); assert.equal(blocked.length, initial.length); assert.equal(blocked.pushes, initial.pushes);
  assert.equal(await savedSnapshot(page), before, 'Blocked navigation never saves or discards the dirty deck');
  await page.locator('#sheet [data-act="closeSheet"]').first().click();
  await page.waitForFunction(() => !document.querySelector('#sheet').open);
  await tab(page, other).click(); await waitRoute(page, other, row.hash);
  assert.equal(await savedSnapshot(page), before, 'Closing a draft then switching cannot silently create a deck');
  return {game, nativeModal:true, blockedTraversal:true, preservedUnsavedName:true};
}
async function deckHeaderEvidence(app) {
  const {page}=app,original=page.viewportSize(),evidence=[];
  for(const width of [320,390,768,900,1440]){
    await page.setViewportSize({width,height:original.height});await page.evaluate(()=>scrollTo(0,0));await settledContent(page);
    await page.waitForFunction(()=>{const header=document.querySelector('.topbar');return Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shell-header-height'))-header.getBoundingClientRect().height)<1.1;});
    assert.equal(await page.locator('#gameTabs [role="tab"]').count(),3);
    for(const game of GAMES){
      const control=tab(page,game);assert(await control.isVisible(),'The '+game+' header tab is visible inside the deck workspace');
      const rect=await control.boundingBox();assert(rect.width>=44&&rect.height>=44&&rect.x>=-.5&&rect.x+rect.width<=width+.5,'Each game tab is a contained, full-size touch target');
      const label=await control.evaluate(button=>{const name=button.querySelector('.game-tab-name'),range=document.createRange();range.selectNodeContents(name);return {text:name.textContent,rect:button.getBoundingClientRect().toJSON(),labelRects:[...range.getClientRects()].map(r=>r.toJSON()),scroll:name.scrollWidth,client:name.clientWidth};});
      assert.equal(label.text,{mtg:'Magic',ygo:'Yu-Gi-Oh!',ptcg:'Pokémon'}[game],'Game names are complete, never abbreviated to fit');
      assert(label.scroll<=label.client+1&&label.labelRects.length>0,'The full game name fits its label box');
      for(const r of label.labelRects)assert(r.left>=label.rect.left-.5&&r.right<=label.rect.right+.5&&r.top>=label.rect.top-.5&&r.bottom<=label.rect.bottom+.5,'No game label is clipped by its tab: '+JSON.stringify(label));
    }
    const initial=await page.evaluate(()=>{const h=document.querySelector('.topbar'),tabs=document.querySelector('#content > .tabs'),active=tabs.querySelector('[aria-selected="true"]'),content=document.querySelector('#content');return {header:h.getBoundingClientRect().toJSON(),tabs:tabs.getBoundingClientRect().toJSON(),active:active?.getBoundingClientRect().toJSON(),activeId:active?.dataset.id,railLeft:tabs.scrollLeft,display:getComputedStyle(h).display,width:innerWidth,root:document.documentElement.scrollWidth,content:content.scrollWidth,client:content.clientWidth,workspaceHeight:content.scrollHeight};});
    assert.equal(initial.display,'grid','Deck retains the shared responsive header grid');
    assert.equal(initial.activeId,'versions','The meaningful selected Versions tab is retained');
    assert(initial.active.left>=initial.tabs.left-.5&&initial.active.right<=initial.tabs.right+.5,'The selected tab remains fully visible after each live resize: '+JSON.stringify(initial));
    assert(initial.root<=width+2&&initial.content<=initial.client+2,'Deck header and workspace retain horizontal containment: '+JSON.stringify(initial));
    assert(initial.tabs.top>=initial.header.bottom-1,'Deck subtabs start below, not under, the game header');
    const filename=await captureNavigation(page,`deck-header-${width}`);
    await page.evaluate(()=>{const tabs=document.querySelector('#content .tabs'),header=document.querySelector('.topbar');scrollTo(0,scrollY+tabs.getBoundingClientRect().top-header.getBoundingClientRect().height+80);});await frames(page);
    const sticky=await page.evaluate(()=>{const h=document.querySelector('.topbar').getBoundingClientRect(),tabs=document.querySelector('#content .tabs'),r=tabs.getBoundingClientRect(),button=tabs.querySelector('[aria-selected="true"]'),b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {headerBottom:h.bottom,top:r.top,bottom:r.bottom,activeId:button.dataset.id,active:b.toJSON(),rail:r.toJSON(),railLeft:tabs.scrollLeft,hit:!!hit&&(hit===button||button.contains(hit)),hitTarget:hit?.id||hit?.className||hit?.tagName,scrollY};});
    assert(sticky.top>=sticky.headerBottom-1,'Sticky deck subtabs stay beneath the measured header after scrolling: '+JSON.stringify(sticky));
    assert(sticky.hit,'The active deck subtab stays physically reachable below the header: '+JSON.stringify(sticky));
    evidence.push({width,filename,headerHeight:initial.header.height,workspaceHeight:initial.workspaceHeight,sticky});
  }
  await page.setViewportSize(original);await page.evaluate(()=>scrollTo(0,0));await settledContent(page);return evidence;
}
async function nestedHistoryCase(app, game, kind) {
  const {page} = app, target = GAMES[(GAMES.indexOf(game) + 1) % GAMES.length], third = GAMES[(GAMES.indexOf(game) + 2) % GAMES.length];
  const row = kind === 'set' ? {set:true,target:'#sets'} : {deckTab:'versions',collision:true,target:'#decks/mine'};
  await prepare(app, {from:game}, row);
  const headerEvidence=game==='mtg'&&kind==='deck'?await deckHeaderEvidence(app):undefined;
  const source = await historySnapshot(page), before = await savedSnapshot(page), parent = row.target;
  await tab(page, target).click(); await waitRoute(page, target, parent);
  const middle = await historySnapshot(page);
  await tab(page, third).click(); await waitRoute(page, third, parent);
  const last = await historySnapshot(page);
  assert.equal(last.hash, middle.hash, 'Two destination games actually share the same hash');
  assert.equal(last.length, source.length + 2); assert.equal(last.pushes, source.pushes + 2);
  const assertSource = async () => {
    await waitRoute(page, game, source.hash);
    assert.equal((await historySnapshot(page)).state.cardstashy.entryId, source.state.cardstashy.entryId);
    if (kind === 'set') {
      await page.waitForFunction(({game,id}) => {const S=window.__uiTestState,T=window.__uiTestTcg,u=game==='mtg'?S.ui.set:T.ui(game).set;return S.ui.view==='set'&&!u.busy&&u.cards.length>0&&(game==='mtg'?u.code===id:S.ui.tsetId===id&&u.id===id);}, {game,id:SET_IDS[game]});
      assert((await page.locator('#content').innerText()).includes(game==='ygo'?'Legend of Blue Eyes':'Synthetic Search A'), 'Original game-specific set detail is visible');
    } else {
      const state=await read(page);assert.equal(game==='mtg'?state.deckId:state.tdeckId,COLLISION_ID);
      assert((await page.locator('#content').innerText()).includes(`Synthetic ${game} collision deck`));
      assert.equal(await page.locator(`#content [data-act="${game==='mtg'?'deckTab':'tDeckTab'}"][data-id="versions"]`).getAttribute('aria-selected'),'true');
    }
  };
  await page.goBack(); await waitRoute(page,target,parent);
  assert.equal((await historySnapshot(page)).state.cardstashy.entryId,middle.state.cardstashy.entryId);
  await page.goBack(); await assertSource();
  await page.goForward(); await waitRoute(page,target,parent);
  await page.goForward(); await waitRoute(page,third,parent);
  assert.equal((await historySnapshot(page)).pushes,last.pushes,'Resource and same-hash traversal never push replacement entries');
  assert.equal(await savedSnapshot(page),before);
  // Reload the final same-hash game entry, then traverse back to the resource again.
  await page.reload();await page.locator('#app.ready').waitFor();
  await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});
  await page.goBack();await waitRoute(page,target,parent);await page.goBack();await assertSource();
  await page.goForward();await waitRoute(page,target,parent);await page.goForward();await waitRoute(page,third,parent);
  assert.equal((await historySnapshot(page)).length,last.length);
  return {game,kind,resource:source.hash,sameHash:parent,reloadTraversal:true,...(headerEvidence?{headerEvidence}:{})};
}
async function scannerLifecycleCase(app, game) {
  const {page}=app,target=GAMES[(GAMES.indexOf(game)+1)%GAMES.length],fixture=makeScannerLifecycleFixture(game);
  await page.evaluate(async rows=>{(await import('/scan-batch.js')).saveBatch(rows);},fixture.rows);
  await prepare(app,{from:game},{hash:'#scan',target:'#scan'});
  const initialCollections=await collections(page),initialRows=await batchRows(page);
  await page.locator(`.scan-batch-thumb[data-id="${fixture.reviewId}"]`).click();
  const review=page.locator('.scan-confirm');await review.waitFor();
  await review.getByRole('button',{name:'More copies',exact:true}).click();
  await review.locator('.scan-review-more summary').click();
  await review.getByRole('button',{name:'Moderately Played',exact:true}).click();
  await review.getByRole('combobox',{name:'Scanned card language',exact:true}).click();
  await page.locator('.glass-select-menu[open]').getByRole('option',{name:'German',exact:true}).click();
  const edited=await batchRows(page),savedReview=edited.find(row=>row.id===fixture.reviewId),qty=savedReview.qty;
  assert.equal(qty,initialRows.find(row=>row.id===fixture.reviewId).qty+1);assert.equal(savedReview.condition,'Moderately Played');assert.equal(savedReview.lang,'de');
  assert.equal(savedReview.finish,finishFor(game));
  await tab(page,target).click();await waitRoute(page,target,'#scan');
  const afterSwitch=await batchRows(page);
  assert.deepEqual(afterSwitch,edited.map(row=>['captured','reading'].includes(row.status)?{...row,status:'unresolved',reason:'Reading interrupted · retry'}:row),'Only interrupted queue status changes; original pixels, identities and edited review fields survive');
  assert.deepEqual(await collections(page),initialCollections,'Switching and editing a review never saves a card');
  assert.equal(await page.locator('.scan-confirm').count(),0,'Target scan is idle, not the source review');
  await tab(page,game).click();await waitRoute(page,game,'#scan');
  await page.locator(`.scan-batch-thumb[data-id="${fixture.reviewId}"]`).click();await review.waitFor();
  assert.equal(Number(await review.getByLabel('Copies to save',{exact:true}).innerText()),qty);
  assert.equal(await review.locator('[data-change="scanConfirmLanguage"]').inputValue(),'de');
  await review.locator('.scan-review-more summary').click();
  assert.equal(await review.getByRole('button',{name:'Moderately Played',exact:true}).getAttribute('aria-pressed'),'true');
  // One narrowly scoped removal failure leaves the old durable queue intact.
  // saveBatch intentionally keeps the attempted post-removal state in memory;
  // reload must recover the durable capture and retry its original identity.
  await page.evaluate(id=>{
    const native=Storage.prototype.setItem;let fail=true;
    Storage.prototype.setItem=function(key,value){
      if(this===localStorage&&key==='cardstashy-scan-batch-v1'&&fail&&!JSON.parse(value).some(row=>row.id===id)){
        fail=false;window.__gameSwitchAudit.queueRemovalFailures=(window.__gameSwitchAudit.queueRemovalFailures||0)+1;
        throw new DOMException('Synthetic one-shot queue persistence failure','QuotaExceededError');
      }
      return native.call(this,key,value);
    };
  },fixture.reviewId);
  await review.getByRole('button',{name:'Add to collection',exact:true}).click();
  await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);
  const once=await collections(page),savedLot=once[game].find(row=>row.scanCaptureId===fixture.reviewId);
  assert(savedLot);assert.equal(savedLot.qty,qty);assert.equal(savedLot.condition,'Moderately Played');assert.equal(savedLot.language,'de');assert.equal(savedLot.location,savedReview.location);
  for(const g of GAMES)assert.deepEqual(once[g].filter(row=>row.scanCaptureId!==fixture.reviewId),initialCollections[g]);
  assert.equal(Object.values(once).flat().filter(row=>row.scanCaptureId===fixture.reviewId).length,1);
  assert.equal(await page.evaluate(()=>window.__gameSwitchAudit.queueRemovalFailures),1);
  const removal=await page.evaluate(async()=>{const batch=await import('/scan-batch.js');return {memory:batch.loadBatch(),durable:JSON.parse(localStorage.getItem('cardstashy-scan-batch-v1')),healthy:batch.batchStorageHealthy()};});
  assert.equal(removal.healthy,false,'Failed persistence is not represented as durable success');
  assert.deepEqual(removal.memory,afterSwitch.filter(row=>row.id!==fixture.reviewId),'In-memory fallback contains the attempted post-removal queue, preserving every other capture');
  assert.deepEqual(removal.durable,afterSwitch,'Failed storage removal retains the complete durable capture, pixels, revision and edited fields');
  await page.reload();await page.locator('#app.ready').waitFor();
  await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});
  await waitRoute(page,game,'#scan');
  assert.deepEqual(await batchRows(page),afterSwitch,'Reload recovers the original durable capture for a real retry');
  assert.deepEqual(await collections(page),once,'The saved lot is already durable before any retry');
  await tab(page,target).click();await waitRoute(page,target,'#scan');await tab(page,game).click();await waitRoute(page,game,'#scan');
  await page.locator(`.scan-batch-thumb[data-id="${fixture.reviewId}"]`).click();await review.waitFor();
  await review.getByRole('button',{name:'Add to collection',exact:true}).click();await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);
  assert.deepEqual(await collections(page),once,'Retry after switching is idempotent: no duplicate lot or extra quantity');
  assert.deepEqual(await batchRows(page),afterSwitch.filter(row=>row.id!==fixture.reviewId),'Other games and interrupted queue rows remain byte-equivalent');
  const persisted=await page.evaluate(async()=>{const s=await(await import('/storage.js')).readRecord('cardforge-v2');return Object.fromEntries(['mtg','ygo','ptcg'].map(g=>[g,(g==='mtg'?s:s.tcg[g]).collection]));});
  assert.deepEqual(persisted,once,'Exactly-once collection result is durable');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('cardstashy-scan-batch-v1'))),afterSwitch.filter(row=>row.id!==fixture.reviewId),'Successful retry removes only the same capture durably');
  assert.equal(await page.evaluate(async()=>(await import('/scan-batch.js')).batchStorageHealthy()),true);
  const audit=await page.evaluate(()=>window.__gameSwitchAudit);assert.equal(audit.cameraCalls,0);assert.equal(audit.ocrCalls,0);
  return {game,editedReviewPreserved:true,interruptedRows:2,queueRemovalFailures:1,durableReloadRetry:true,savedCopies:qty,duplicateLots:0};
}

async function workspaceReplacementCase(app, game) {
  const {page}=app,other=GAMES[(GAMES.indexOf(game)+1)%3],importGame=GAMES[(GAMES.indexOf(game)+2)%3];
  await prepare(app,{from:game},{hash:'#collection/cards'});
  const original=await collections(page),lot='fixture-lot-'+game;
  await page.locator(`#content [data-act="${game==='mtg'?'qty':'tEntryQty'}"][data-id="${lot}"][data-delta="-1"]`).click();
  await page.waitForFunction(({game,lot,qty})=>{const s=window.__uiTestState.state;return (game==='mtg'?s:s.tcg[game]).collection.find(r=>r.id===lot)?.qty===qty;},{game,lot,qty:original[game][0].qty-1});
  await tab(page,other).click();await waitRoute(page,other,'#collection/cards');
  await page.locator('#toast [data-act="undo"]').click();await waitRoute(page,game,'#collection/cards');
  assert.deepEqual(await collections(page),original,'Actual Undo restores source data and selected game together');
  assert.equal((await historySnapshot(page)).state.cardstashy.game,game);
  await tab(page,other).click();await waitRoute(page,other,'#collection/cards');
  await prepare(app,{from:other},{hash:'#settings',settings:true});
  const marker='Imported fixture '+importGame,next=await page.evaluate(()=>structuredClone(window.__uiTestState.state));
  next.settings.game=importGame;next.settings.authorName=marker;
  await page.locator('#settings-backup .settings-disclosure > summary').filter({hasText:/^Restore or check a backup$/}).click();
  await page.locator('input[data-change="restoreBackup"]').setInputFiles({name:'synthetic-workspace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});
  // This is the genuine confirmation, including its asynchronous close animation.
  await page.locator('dialog.cf-dialog[open] [value="ok"]').click();await waitRoute(page,importGame,'#settings');
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.authorName),marker);
  assert.equal((await historySnapshot(page)).state.cardstashy.game,importGame);
  await page.goBack();await waitRoute(page,other,'#collection/cards');
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.authorName),marker,'Back changes the visit, never revives pre-import workspace data');
  await page.goForward();await waitRoute(page,importGame,'#settings');
  await page.locator('#settingsTab-account').click();await page.locator('[data-act="settingsTab"][data-id="backup"]').click();await page.locator('#settings-backup .settings-disclosure > summary').filter({hasText:/^Restore or check a backup$/}).click();
  await page.locator('[data-act="undoRestore"]').click();await page.locator('dialog.cf-dialog[open] [value="ok"]').click();
  await waitRoute(page,other,'#settings');assert.deepEqual(await collections(page),original);
  assert.notEqual(await page.evaluate(()=>window.__uiTestState.state.settings.authorName),marker);
  const current=await read(page),history=await historySnapshot(page);
  assert.deepEqual(current.selected,[other]);assert.equal(history.state.cardstashy.game,other);
  assert.equal(await page.evaluate(async()=> (await(await import('/storage.js')).readRecord('cardforge-v2')).settings.game),other);
  return {game,actualUndo:true,confirmedBackup:true,confirmedRecovery:true,historyDoesNotReviveOldData:true};
}
async function foreignSharedCopyCase(app,target) {
  const {page}=app,hash='#shared/'+app.fixtures.shared[target];
  await prepare(app,{from:'mtg'},{hash,shared:false});
  await page.waitForFunction(g=>window.__uiTestState.ui.shared.deck?.game===g,target);
  const before=await page.evaluate(()=>structuredClone(window.__uiTestState.state));
  await page.locator('#content [data-act="tSharedBuild"]').click();
  await page.waitForFunction(g=>document.body.dataset.game===g&&location.hash.startsWith('#tdeck/'),target);
  const s=await read(page),after=await page.evaluate(()=>structuredClone(window.__uiTestState.state)),copy=after.tcg[target].decks.at(-1);
  assert.equal(s.hash,'#tdeck/'+copy.id);assert.equal(s.tdeckId,copy.id);assert.equal(after.tcg[target].decks.length,before.tcg[target].decks.length+1);
  assert.deepEqual(after.decks,before.decks);assert.deepEqual(after.tcg[target].decks.slice(0,-1),before.tcg[target].decks);
  for(const g of GAMES.filter(g=>g!=='mtg'&&g!==target))assert.deepEqual(after.tcg[g],before.tcg[g]);
  await page.goBack();await waitRoute(page,target,'#decks/inspiration');
  await page.goBack();await waitRoute(page,'mtg',hash);
  await page.goForward();await waitRoute(page,target,'#decks/inspiration');
  await page.goForward();await waitRoute(page,target,'#tdeck/'+copy.id);
  assert.equal(await page.evaluate(g=>window.__uiTestState.state.tcg[g].decks.length,target),before.tcg[target].decks.length+1);
  return {target,ownedCopy:copy.id,savedExactlyOnce:true,sourceSharedHistory:true};
}
async function manualScannerDraftCase(app,game) {
  const {page}=app,target=GAMES[(GAMES.indexOf(game)+1)%3];
  await page.evaluate(draft=>Object.assign(window.__uiTestState.ui.scan,draft),makeManualReviewFixture(game));
  await prepare(app,{from:game},{hash:'#scan'});
  const before=await collections(page),rows=await batchRows(page),review=page.locator('.scan-confirm');await review.waitFor();
  await review.getByRole('button',{name:'More copies',exact:true}).click();
  await review.locator('.scan-review-more summary').click();
  await review.getByRole('button',{name:'Heavily Played',exact:true}).click();
  await review.getByRole('combobox',{name:'Scanned card language',exact:true}).click();
  await page.locator('.glass-select-menu[open]').getByRole('option',{name:'French',exact:true}).click();
  const edited=await page.evaluate(()=>{const s=window.__uiTestState.ui.scan;return {i:s.confirm.i,ids:s.cands.map(c=>c.id),read:s.read,finish:s.confirm.finish};});
  await tab(page,target).click();await waitRoute(page,target,'#scan');assert.equal(await review.count(),0);
  await tab(page,game).click();await waitRoute(page,game,'#scan');await review.waitFor();
  const restored=await page.evaluate(()=>{const s=window.__uiTestState.ui.scan;return {i:s.confirm.i,ids:s.cands.map(c=>c.id),read:s.read,finish:s.confirm.finish,qty:s.confirm.qty,condition:s.confirm.condition,lang:s.confirm.lang,batch:s.confirm.batchId||null};});
  assert.deepEqual(restored,{...edited,qty:4,condition:'Heavily Played',lang:'fr',batch:null});
  assert.equal(Number(await review.getByLabel('Copies to save',{exact:true}).innerText()),4);
  assert.deepEqual(await batchRows(page),rows);assert.deepEqual(await collections(page),before);
  await review.getByRole('button',{name:'Scan again',exact:true}).click();
  await tab(page,target).click();await waitRoute(page,target,'#scan');await tab(page,game).click();await waitRoute(page,game,'#scan');
  assert.equal(await review.count(),0,'Explicitly cleared manual draft is not resurrected');
  assert.deepEqual(await batchRows(page),rows);assert.deepEqual(await collections(page),before);
  return {game,manualReviewRetained:true,noFabricatedCapture:true,explicitDismissalRetained:true};
}

async function run(label, options, fn) {
  let app, result, error;
  try {app = await openGameSwitchApp(browser, server.base, options); result = await fn(app);}
  catch (e) {error = e; failures.push({label, phase: 'scenario', error: e});}
  finally {
    if (app) {
      app.releaseAll();
      try {app.health();} catch (e) {e.fixtureDiagnostics = app.diagnostics(); failures.push({label, phase: 'network/app health', error: e}); error ||= e;}
      try {await app.close();} catch (e) {failures.push({label, phase: 'cleanup', error: e}); error ||= e;}
    }
  }
  outcomes.push({label, status: error ? 'failed' : 'passed', ...(result || {})});
  console.log(`${error ? 'FAIL' : 'PASS'} ${label}${error ? '\n' + error.stack : ''}`);
}
try {
  server = await startServer(); browser = await chromium.launch();
  // Run the highest-risk coupled lifecycle cases before the broad route matrix.
  for (const game of GAMES) {
    await run(`workspace-undo-restore-history-${game}`, {game}, app => workspaceReplacementCase(app,game));
    await run(`manual-scanner-review-draft-${game}`, {game}, app => manualScannerDraftCase(app,game));
    await run(`dirty-editor-blocks-game-history-${game}`, {game}, app => dirtyFormCase(app,game));
    for (const kind of ['set','deck']) await run(`nested-${kind}-same-hash-history-${game}`, {game}, app => nestedHistoryCase(app,game,kind));
    await run(`scanner-review-queue-exactly-once-${game}`, {game}, app => scannerLifecycleCase(app,game));
  }
  for(const target of ['ygo','ptcg'])await run(`foreign-shared-copy-${target}`,{game:'mtg'},app=>foreignSharedCopyCase(app,target));
  // Independent contexts bound the matrix and avoid source-game cache leakage
  // between cases. Continue after failures so a single pair cannot mask others.
  for (const pair of PAIRS) for (const method of METHODS) {
    for (const row of BASE_ROWS) await run(`${row.id}-${pair.from}-${pair.to}-${method}-390`, {game: pair.from}, app => semanticCase(app, pair, row, method));
    for (const row of [{id: 'shared', shared: true, target: '#decks/inspiration'}, {id: 'deck-id-collision', deckTab: 'versions', collision: true, target: '#decks/mine'}]) {
      await run(`${row.id}-${pair.from}-${pair.to}-${method}`, {game: pair.from}, app => semanticCase(app, pair, row, method));
    }
    await run(`same-hash-history-${pair.from}-${pair.to}-${method}`, {game: pair.from}, app => historyCase(app, pair, method));
  }
  const representative = BASE_ROWS.filter(r => ['R01', 'R02', 'R04', 'R12', 'R15', 'R16'].includes(r.id));
  for (const width of WIDTHS.filter(w => w !== 390)) for (const [i, row] of representative.entries()) {
    const pair = PAIRS[i % PAIRS.length];
    for (const method of METHODS) await run(`responsive-${row.id}-${pair.from}-${pair.to}-${method}-${width}`, {game: pair.from, width}, app => semanticCase(app, pair, row, method));
  }
  for (const game of GAMES) await run(`carousel-isolation-${game}`, {game,carouselNews:true}, app => carouselCase(app, game));
} catch (error) {failures.push({label: 'suite', phase: 'setup/run', error});}
finally {
  try {await browser?.close();} catch (error) {failures.push({label: 'suite', phase: 'browser cleanup', error});}
  try {await server?.close();} catch (error) {failures.push({label: 'suite', phase: 'server cleanup', error});}
  await saveReport(outcomes, failures);
}
if (failures.length) throw new AggregateError(failures.map(f => f.error), `${failures.length} failures in hosted game-switch acceptance; see test-results/game-switch-browser.json`);
assert.equal(outcomes.length,311,'The complete bounded hosted matrix ran');
console.log(`${outcomes.length} hosted game-switch scenarios passed. ${EVIDENCE}`);
