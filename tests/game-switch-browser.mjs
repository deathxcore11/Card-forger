// Run only in approved hosted CI: node tests/game-switch-browser.mjs
// Safe local schema check: node tests/game-switch-browser.mjs --validate-fixtures
// Transitions use actual header clicks or Chromium Input.dispatchTouchEvent.
// No DOM event constructors, setGame calls, screenshots or live providers.
import assert from 'node:assert/strict';
import {
  GAMES, PAIRS, METHODS, BASE_ROWS, WIDTHS, EVIDENCE, SEARCH, SET_IDS,
  sourceHash, targetHash, finishFor, validateGameSwitchFixtures, makeScannerLifecycleFixture, makeManualReviewFixture, COLLISION_ID,
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
  await page.waitForFunction(({game, hash}) => document.body.dataset.game === game && window.__uiTestTcg.game() === game && location.hash === hash, {game, hash});
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
    await page.locator('#settingsTab-backup').click();
    assert.equal(await page.locator('#settingsTab-backup').getAttribute('aria-selected'), 'true');
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
  if (row.settings) assert.equal(await page.locator('#settingsTab-backup').getAttribute('aria-selected'), 'true', 'Settings subsection survives');
  if (view === 'rules') assert.equal(await page.locator('[data-learning-root]').getAttribute('data-game'), pair.to, 'Rules use target-game context');
}

// Choose a physically hittable safe background in the real UI, never add a
// test-only gesture surface or disable pointer events on production controls.
async function safePoint(page, dx, {carousel = false} = {}) {
  if (carousel) await page.locator('[data-home-community]').scrollIntoViewIfNeeded();
  else await page.evaluate(() => scrollTo(0, 0));
  await frames(page);
  const point = await page.evaluate(({dx, carousel}) => {
    const root = document.querySelector(carousel ? '[data-home-community]' : '#content'), r = root.getBoundingClientRect();
    const blocked = 'input,textarea,select,button,a,label,summary,[role="slider"],[contenteditable="true"],[draggable="true"],.deck-tile,[data-hold-card],.zoom-stage,.cam-wrap,.cam-stage,.scan-stage,.crop-wrap,canvas,video,.scan-batch-strip,.scan-confirm,[data-no-game-swipe]';
    const left = Math.max(26, r.left + 8), right = Math.min(innerWidth - 26, r.right - 8);
    for (let y = Math.max(r.top + 10, document.querySelector('header')?.getBoundingClientRect().bottom || 0, 80); y < Math.min(r.bottom - 10, innerHeight - 90); y += 6) {
      for (let x = left; x <= right; x += 8) {
        if (x + dx < left || x + dx > right) continue;
        const target = document.elementFromPoint(x, y);
        if (!target || !root.contains(target) || target.closest(blocked) || !carousel && target.closest('[data-home-gesture]')) continue;
        let scroller = false;
        for (let el = target; el && el !== root; el = el.parentElement) if (el.scrollWidth > el.clientWidth + 8 && /auto|scroll/.test(getComputedStyle(el).overflowX)) scroller = true;
        if (!scroller) return {x, y, tag: target.tagName, id: target.id, carousel: !!target.closest('[data-home-community]')};
      }
    }
    return null;
  }, {dx, carousel});
  assert(point, 'A real safe swipe background is physically reachable at this viewport');
  assert.equal(point.carousel, carousel); return point;
}
async function trustedSwipe(app, dx, {carousel = false} = {}) {
  const {page, context} = app, point = await safePoint(page, dx, {carousel});
  const start = await page.evaluate(() => window.__gameSwitchAudit.touches.length);
  const session = await context.newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 1}]});
    for (let i = 1; i <= 6; i++) {
      await delay(24);
      await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x + dx * i / 6, y: point.y, radiusX: 4, radiusY: 4, force: 1, id: 1}]});
    }
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  } finally {await session.detach();}
  const events = await page.evaluate(start => window.__gameSwitchAudit.touches.slice(start), start);
  assert(events.length >= 3 && events.every(e => e.trusted), 'Protocol injection produced trusted browser touch events');
  assert.equal(events[0].type, 'touchstart'); assert.equal(events.at(-1).type, 'touchend');
  assert(events.some(e => e.type === 'touchmove')); assert.equal(events[0].carousel, carousel, 'Touch hit the intended real region');
  return {point, events};
}
async function switchGame(app, pair, row, method) {
  if (method === 'header') {assert.equal(await tab(app.page, pair.to).count(), 1); await tab(app.page, pair.to).click();}
  else await trustedSwipe(app, pair.dx);
  await waitRoute(app.page, pair.to, targetHash(row, pair.to));
}
async function semanticCase(app, pair, row, method) {
  await prepare(app, pair, row);
  const before = await savedSnapshot(app.page), searches = await searchSnapshots(app.page), history = await historySnapshot(app.page);
  await switchGame(app, pair, row, method); await assertTarget(app.page, pair, row);
  const after = await historySnapshot(app.page);
  assert.equal(after.length, history.length + 1, 'Exactly one browser entry per game change, including unchanged hashes');
  assert.equal(after.pushes, history.pushes + 1, 'The game transition pushes exactly once');
  assert.equal(await savedSnapshot(app.page), before, 'Saved collection/decks/versions/wishlist/binders/locations/scans are byte-equivalent except settings game/save timestamp');
  assert.deepEqual(await searchSnapshots(app.page), searches, 'All per-game queries, filters, loaded results and paging survive without copying');
  return {hash: after.hash, historyDelta: after.length - history.length};
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
  const initial = await historySnapshot(app.page), before = await savedSnapshot(app.page), indicator = app.page.locator('[data-home-community] .community-position');
  const positions = [];
  for (const dx of [-120, 120, 120, -120]) {
    const prior = await indicator.innerText(); positions.push(prior);
    await trustedSwipe(app, dx, {carousel: true}); await frames(app.page);
    assert.notEqual(await indicator.innerText(), prior, 'Trusted touch changes the carousel slide, including boundary wrap');
    const state = await historySnapshot(app.page);
    assert.equal(state.game, game); assert.equal(state.hash, '#home'); assert.equal(state.length, initial.length); assert.equal(state.pushes, initial.pushes);
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
async function nestedHistoryCase(app, game, kind) {
  const {page} = app, target = GAMES[(GAMES.indexOf(game) + 1) % GAMES.length], third = GAMES[(GAMES.indexOf(game) + 2) % GAMES.length];
  const row = kind === 'set' ? {set:true,target:'#sets'} : {deckTab:'versions',collision:true,target:'#decks/mine'};
  await prepare(app, {from:game}, row);
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
  return {game,kind,resource:source.hash,sameHash:parent,reloadTraversal:true};
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
  // One narrowly scoped synthetic failure keeps the already-saved capture queued.
  // Retrying the real Add action after switching must reuse its capture identity.
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
  assert((await batchRows(page)).some(row=>row.id===fixture.reviewId),'Failed removal retains a retryable capture');
  await tab(page,target).click();await waitRoute(page,target,'#scan');await tab(page,game).click();await waitRoute(page,game,'#scan');
  await page.locator(`.scan-batch-thumb[data-id="${fixture.reviewId}"]`).click();await review.waitFor();
  await review.getByRole('button',{name:'Add to collection',exact:true}).click();await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);
  assert.deepEqual(await collections(page),once,'Retry after switching is idempotent: no duplicate lot or extra quantity');
  assert.deepEqual(await batchRows(page),afterSwitch.filter(row=>row.id!==fixture.reviewId),'Other games and interrupted queue rows remain byte-equivalent');
  const persisted=await page.evaluate(async()=>{const s=await(await import('/storage.js')).readRecord('cardforge-v2');return Object.fromEntries(['mtg','ygo','ptcg'].map(g=>[g,(g==='mtg'?s:s.tcg[g]).collection]));});
  assert.deepEqual(persisted,once,'Exactly-once collection result is durable');
  const audit=await page.evaluate(()=>window.__gameSwitchAudit);assert.equal(audit.cameraCalls,0);assert.equal(audit.ocrCalls,0);
  return {game,editedReviewPreserved:true,interruptedRows:2,queueRemovalFailures:1,savedCopies:qty,duplicateLots:0};
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
  await page.locator('#settings-backup .settings-disclosure summary').click();
  await page.locator('input[data-change="restoreBackup"]').setInputFiles({name:'synthetic-workspace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});
  // This is the genuine confirmation, including its asynchronous close animation.
  await page.locator('dialog.cf-dialog[open] [value="ok"]').click();await waitRoute(page,importGame,'#settings');
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.authorName),marker);
  assert.equal((await historySnapshot(page)).state.cardstashy.game,importGame);
  await page.goBack();await waitRoute(page,other,'#collection/cards');
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.authorName),marker,'Back changes the visit, never revives pre-import workspace data');
  await page.goForward();await waitRoute(page,importGame,'#settings');
  await page.locator('#settingsTab-backup').click();await page.locator('#settings-backup .settings-disclosure summary').click();
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
  for (const game of GAMES) await run(`carousel-isolation-${game}`, {game}, app => carouselCase(app, game));
} catch (error) {failures.push({label: 'suite', phase: 'setup/run', error});}
finally {
  try {await browser?.close();} catch (error) {failures.push({label: 'suite', phase: 'browser cleanup', error});}
  try {await server?.close();} catch (error) {failures.push({label: 'suite', phase: 'server cleanup', error});}
  await saveReport(outcomes, failures);
}
if (failures.length) throw new AggregateError(failures.map(f => f.error), `${failures.length} failures in hosted game-switch acceptance; see test-results/game-switch-browser.json`);
assert.equal(outcomes.length,311,'The complete bounded hosted matrix ran');
console.log(`${outcomes.length} hosted game-switch scenarios passed. ${EVIDENCE}`);
