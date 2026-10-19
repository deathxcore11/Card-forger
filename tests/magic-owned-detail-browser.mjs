// Hosted actual-app identity regression. Public printing identifiers plus
// synthetic prices/ownership/art URLs; no real user data or external requests.
import assert from 'node:assert/strict';
import {startServer,openApp,closeSheet,navigate,capture,saveReport} from './detail-rules-fixtures.mjs';
import {magicOwnedDetail} from '../magic-owned-detail.js';
import {blank} from '../store.js';
const NAME='Chishiro, the Shattered Blade',ORACLE='c98a4af3-3e58-4927-9a60-d2664cf0b139';
const card=(id,number,finishes,prices,name=NAME,set='nec')=>({id,name,oracle_id:name===NAME?ORACLE:'fixture-other-oracle',set,set_name:'Neon Dynasty Commander',collector_number:number,lang:'en',finishes,prices,full:true,layout:'normal',rarity:'mythic',type_line:'Legendary Creature — Snake Samurai',oracle_text:'A deterministic identity fixture.',mana_cost:'{2}{R}{G}',cmc:4,colors:['R','G'],color_identity:['R','G'],power:'4',toughness:'4',legalities:{commander:'legal'},released_at:'2022-02-18',image_uris:Object.fromEntries(['normal','small','art_crop'].map(k=>[k,`https://detail-fixtures.invalid/owned-${id}.svg`]))});
const etched=card('3305c70f-188a-4c01-b605-d583ded84e18','77',['etched'],{usd_etched:'.44'}),extended=card('eaacd338-1040-4d61-977e-7c97d0f26724','73',['nonfoil'],{usd:'2.25'}),regular=card('bffa36ac-137d-481c-b1b7-76a88ef15d54','1',['nonfoil','foil'],{usd:'.92',usd_foil:'3.15'}),other=card('owned-other-foil','456',['foil'],{usd_foil:'8.25'},'Different printed family','tst');
etched.frame_effects=['legendary','inverted','etched'];
const cards=[etched,extended,regular,other],lot=(id,c,finish,more={})=>({id,name:c.name,printingId:c.id,printingVerified:true,set:c.set,collectorNumber:c.collector_number,finish,condition:'Near Mint',language:'en',qty:1,location:'Exact fixture',addedAt:'2026-10-17T12:00:00Z',...more});
const lots=[lot('owned-77',etched,'etched'),lot('owned-77-worn',etched,'etched',{condition:'Damaged',manualValue:.2,manualValueCondition:'Damaged'}),lot('owned-73',extended,'nonfoil'),lot('owned-1-foil',regular,'foil'),lot('owned-1-regular',regular,'nonfoil'),lot('owned-other',other,'foil'),{id:'owned-legacy',name:NAME,qty:1,finish:'foil',condition:'Near Mint',printingVerified:false,location:'Exact fixture'}];
const state=blank();state.collection=lots;state.printings=Object.fromEntries(cards.map(c=>[c.id,c]));
for(const entry of lots.slice(0,-1)){const resolved=magicOwnedDetail(state,entry.id);assert.equal(resolved.status,'ready');assert.equal(resolved.card.id,entry.printingId);assert.equal(resolved.finish,entry.finish);}
assert.equal(magicOwnedDetail(state,'owned-legacy').status,'blocked');
if(process.argv.includes('--validate-fixtures')){console.log('PASS: NEC001/073/077, distinct foil/etched/regular finishes, duplicate-condition lots, second family and explicit unresolved legacy fixture. No browser/server/network started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Actual-app owned identity QA is hosted-only. Use --validate-fixtures locally.');
const {chromium}=await import('playwright');const server=await startServer(),browser=await chromium.launch(),checks=[];
const protectedState=page=>page.evaluate(()=>{const s=window.__uiTestState.state;return JSON.stringify({collection:s.collection,printings:s.printings,decks:s.decks,myPrices:s.myPrices,wishlist:s.wishlist,valueHistory:s.valueHistory,tcg:s.tcg,binders:s.settings.binders});});
const shown=page=>page.evaluate(()=>{const c=window.__uiTestState.ui.sheetCtx;return {id:c?.print?.id,number:c?.print?.collector_number,finish:c?.priceFinish,entry:c?.entryId,condition:c?.condition};});
async function verify(page,entry){
 await page.waitForFunction(id=>window.__uiTestState.ui.sheetCtx?.entryId===id&&window.__uiTestState.ui.sheetCtx?.print?.id,entry.id);
 const detail=await shown(page);assert.equal(detail.id,entry.printingId);assert.equal(detail.finish,entry.finish);assert.equal(detail.condition,entry.condition);
 const expected=cards.find(c=>c.id===entry.printingId);assert.equal(detail.number,expected.collector_number);
 await page.waitForFunction(src=>{const i=document.querySelector('#sheet .cd-zoom img.card-img');return i?.complete&&i.naturalWidth>0&&i.currentSrc===src;},expected.image_uris.normal);
 assert.equal(await page.locator('#sheet .finish-preview [aria-pressed="true"]').getAttribute('data-finish'),entry.finish);
 assert.match(await page.locator('#sheet .cs-meta').innerText(),new RegExp('#'+expected.collector_number+'\\b'));
 assert.equal(await page.locator('#sheet .card-price-reference > strong').innerText(),'$'+Number(expected.prices[entry.finish==='nonfoil'?'usd':'usd_'+entry.finish]).toFixed(2),'market quote belongs to this exact saved printing and finish');
 return detail;
}
try{
 for(const width of [390,320,1440]){let app;try{
  app=await openApp(browser,server.base,{game:'mtg',width,height:1000,reducedMotion:'reduce'});const {page,context}=app;
  let held=null;
  await context.route('https://api.scryfall.com/**',async route=>{
   const u=new URL(route.request().url());if(route.request().method()!=='GET')return route.fallback();
   const exact=cards.find(c=>u.pathname==='/cards/'+c.id);if(exact){if(held&&exact.id===etched.id){const h=held;held=null;h.started();await h.wait;}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(exact)});}
   if(u.pathname==='/cards/search'&&(u.searchParams.get('q')||'').includes(ORACLE))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:cards.filter(c=>c.oracle_id===ORACLE),has_more:false,total_cards:3})});
   return route.fallback();
  });
  // openApp already awaits app.ready and active game/account adoption; no pending viewSave is triggered before seeding.
  await page.evaluate(async({cards,lots})=>{const {validateWorkspace}=await import('/confidence.js');const S=window.__uiTestState;S.state.collection=structuredClone(lots);S.state.printings=Object.fromEntries(cards.map(c=>[c.id,c]));for(const c of cards)S.catalog[c.name.toLowerCase()]=c;S.state.settings.binders=[{id:'exact-owned',game:'mtg',title:'Exact saved copies',rule:'location',value:'Exact fixture'}];S.state=validateWorkspace(S.state);S.ui.q.coll='';S.ui.collFilter='all';dispatchEvent(new Event('cardstashy-rerender'));},{cards,lots});
  const before=await protectedState(page);
  for(const entry of lots.slice(0,-1)){await page.locator(`.lot-art[data-entry="${entry.id}"]`).click();await verify(page,entry);await closeSheet(page);}
  await page.locator('.lot-art[data-entry="owned-77"]').click();await verify(page,lots[0]);await capture(page,`magic-owned-detail-${width}-etched`);
  await page.locator('#sheet .cd-zoom').click();await page.waitForFunction(src=>{const i=document.querySelector('dialog.zoom .zoom-img');return i?.complete&&i.naturalWidth&&i.currentSrc===src;},etched.image_uris.normal);assert.equal(await page.locator('dialog.zoom .zoom-img').getAttribute('data-entry'),'owned-77');await page.locator('dialog.zoom [data-z="close"]').click();
  // A sibling copy-details button must open that saved lot's printing, not the current image.
  await page.locator('[data-act="cardOwnedDetails"][data-lot="owned-1-foil"]').click();await page.locator('#sheet .quick-card-heading').waitFor();assert.equal(await page.locator('#sheet .quick-card-heading img').getAttribute('src'),regular.image_uris.normal);await closeSheet(page);
  await page.locator('.lot-art[data-entry="owned-77-worn"]').click({button:'right'});await page.locator('#sheet .quick-card-heading').waitFor();assert.equal(await page.locator('#sheet .quick-card-heading img').getAttribute('src'),etched.image_uris.normal);assert.equal(await page.locator('select[data-change="quickLot"]').inputValue(),'owned-77-worn');assert.equal(await page.locator('#quickLotValue').inputValue(),'0.2');await closeSheet(page);
  // Collection's price click and explicit return stay on the saved printing.
  await page.locator('[data-act="buyCard"][data-lot="owned-77"]').click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.type==='buy');assert.equal((await page.evaluate(()=>window.__uiTestState.ui.sheetCtx)).print.id,etched.id);await page.locator('[data-act="buyBack"]').click();await verify(page,lots[0]);await closeSheet(page);
  await navigate(page,'#collection/binders');await page.locator('[data-act="openBinder"][data-binder="exact-owned"]').click();await page.locator('.pocket-open[data-entry="owned-77"]').click();await verify(page,lots[0]);await page.locator('#sheet [data-history-back]').click();await page.locator('.pocket-open[data-entry="owned-77"]').waitFor();await closeSheet(page);
  await navigate(page,'#collection/value');await page.locator('.value-lot[data-entry="owned-77"]').click();await verify(page,lots[0]);await closeSheet(page);
  await navigate(page,'#collection/cards');await page.locator('.lot-art[data-entry="owned-legacy"]').click();assert.match(await page.locator('#sheetBody').innerText(),/exact printing.*needs review/i);assert.equal(await page.locator('#sheet .cd-zoom img').count(),0);assert.equal(await page.locator('#sheet .card-price-summary').count(),0);await capture(page,`magic-owned-detail-${width}-legacy-unresolved`);await closeSheet(page);
  assert.equal(await protectedState(page),before,'all read-only detail routes preserve owned data and manual values');
  // Absent/conflicting exact cache never borrows #001's tile, Binder, Value art or quote.
  for(const conflict of [false,true]){
   await page.evaluate(({id,wrong,conflict})=>{const s=window.__uiTestState.state;if(conflict)s.printings[id]=wrong;else delete s.printings[id];dispatchEvent(new Event('cardstashy-rerender'));},{id:etched.id,wrong:regular,conflict});
   await navigate(page,'#collection/cards');assert.equal(await page.locator('.lot-art[data-entry="owned-77"] img').count(),0);
   assert.equal(await page.locator('[data-act="buyCard"][data-lot="owned-77"]').innerText(),'—');
   await navigate(page,'#collection/binders');await page.locator('[data-act="openBinder"][data-binder="exact-owned"]').click();assert.equal(await page.locator('.pocket-open[data-entry="owned-77"] img').count(),0);await closeSheet(page);
   await navigate(page,'#collection/value');assert.equal(await page.locator('.value-lot[data-entry="owned-77"]').count(),0);assert.equal(await page.locator('.value-lot[data-entry="owned-77-worn"] img').count(),0);assert.match(await page.locator('.value-lot[data-entry="owned-77-worn"]').innerText(),/0\.20/);
  }
  await navigate(page,'#collection/cards');
  // A delayed exact fetch must not replace a different detail opened in the meantime.
  let start,release;const seen=new Promise(r=>start=r),wait=new Promise(r=>release=r);held={started:start,wait};
  await page.evaluate(id=>{delete window.__uiTestState.state.printings[id];dispatchEvent(new Event('cardstashy-rerender'));},etched.id);
  await page.locator('.lot-art[data-entry="owned-77"]').click();await seen;assert.match(await page.locator('#sheetBody').innerText(),/exact saved printing/);assert.equal(await page.locator('#sheet .cd-zoom img').count(),0);await closeSheet(page);
  await page.locator('.lot-art[data-entry="owned-1-foil"]').click();await verify(page,lots[3]);
  const completed=page.waitForResponse(r=>r.url()==='https://api.scryfall.com/cards/'+etched.id);release();await (await completed).finished();
  // Drain the browser task/microtask queue after the exact response was consumed.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.print?.collector_number==='1');assert.equal((await shown(page)).finish,'foil');await closeSheet(page);
  app.health();checks.push({width,collectionSixLots:true,exactArtFinishSetAndPrice:true,zoom:true,copyDetailsCrossPrinting:true,longPressCondition:true,buyReturn:true,binderBack:true,value:true,legacyFailClosed:true,missingConflictingCacheArtAndPrice:true,lateFetchIsolated:true,readOnlyStatePreserved:true});
 }catch(error){if(app)await capture(app.page,`magic-owned-detail-${width}-failure`).catch(()=>{});throw error;}finally{if(app)await app.context.close();}}
 await saveReport('magic-owned-detail-browser',checks);
}catch(error){await saveReport('magic-owned-detail-browser',checks,error);throw error;}finally{await browser.close();await server.close();}
