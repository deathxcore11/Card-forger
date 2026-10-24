// Actual application and construction pipeline with synthetic card/provider data.
// No live AI calls, account writes, real art or price claims.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,noOverflow,inventorySnapshot} from './search-fixtures.mjs';
import {ASK_BUILD_CARDS,ASK_BUILD_ARGS,KCI,SAI} from './ai-deck-build-fixtures.mjs';
import {checkDeckViews} from './deck-viewer-checks.mjs';
import {priceWatchFixtureRequest} from './detail-rules-fixtures.mjs';
import {cardKey} from '../core.js';
const cards=ASK_BUILD_CARDS.map(c=>({...c,image_uris:Object.fromEntries(Object.entries(c.image_uris).map(([k,v])=>[k,v.replace('detail-fixtures.invalid','search-fixtures.invalid')]))})),sai=cards.find(c=>c.name===SAI.name);
const {chromium}=await import(process.env.CARDSTASHY_PLAYWRIGHT_MODULE||'playwright');
const server=await startServer(),browser=await chromium.launch({headless:true,...(process.env.CARDSTASHY_CHROMIUM_PATH?{executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage',...(process.env.CARDSTASHY_CHROMIUM_DISABLE_GPU==='1'?['--disable-gpu']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])]}:{} )}),checks=[];
await mkdir('test-results',{recursive:true});
const publicPriceRegistrations=[];
async function mockPublicPriceRegistration(app){
 await app.context.route('**/api/prices/watch',async route=>{
  const request=route.request(),body=request.postDataJSON();
  const watch=priceWatchFixtureRequest(server.base,new URL(request.url()),request.method(),body,{knownMtgIds:cards.map(c=>c.id),headers:request.headers()});
  assert(watch,'only the existing public card-ID registration is admitted; no credentials or private workspace fields');
  publicPriceRegistrations.push(watch);
  await route.fulfill({status:watch.status,contentType:'application/json',body:JSON.stringify(watch.response)});
 });
}
async function visibleProgress(overlay,label){
 const parts=await overlay.evaluate(async root=>Promise.all([
  ['logo','.build-brand .stashy-logo'],['title','.build-pop > b'],['status','[role="status"]'],['cancel','[data-act="flowCancelBuild"]']
 ].map(([part,selector])=>new Promise(resolve=>{
  const node=root.querySelector(selector);if(!node)return resolve({part,missing:true});
  const observer=new IntersectionObserver(([entry])=>{observer.disconnect();const r=entry.boundingClientRect;resolve({part,ratio:entry.intersectionRatio,width:r.width,height:r.height});},{threshold:[0,1]});observer.observe(node);
 }))));
 for(const part of parts)assert(!part.missing&&part.width>0&&part.height>0&&part.ratio>=.99,`${label}: progress content survives viewport and ancestor clipping: ${JSON.stringify(part)}`);
 return parts;
}
try{
 for(const {width,glass} of [320,390,1440].flatMap(width=>[false,true].map(glass=>({width,glass})))){
  const suffix=glass?'-glass':'';
  const app=await openSearchApp(browser,server.base,{game:'mtg',width,height:1000,glass,reducedMotion:'no-preference',evidenceLabel:'deck-build-presentation',prepareFixtures:f=>{for(const c of cards)f.catalog[cardKey(c.name)]=structuredClone(c);},providerOverride:url=>{
   if(url.hostname!=='api.scryfall.com')return;
   if(url.pathname==='/cards/search')return {data:(url.searchParams.get('q')||'').includes('is:commander')?[sai]:cards,has_more:false};
   if(url.pathname==='/cards/named')return cards.find(c=>c.name===(url.searchParams.get('exact')||url.searchParams.get('fuzzy')))||KCI;
  }});
  try{
   await mockPublicPriceRegistration(app);
   const {page}=app,before=await inventorySnapshot(page);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('glass')),glass,'test uses default glass or explicit solid surfaces');
   await page.evaluate(name=>{const b=document.createElement('button');b.dataset.act='buildFrom';b.dataset.name=name;document.body.append(b);b.click();b.remove();},KCI.name);
   await page.locator('[data-flow-field="format"]').selectOption('Commander');await page.locator('[data-flow-field="budget"]').fill('200');await page.locator('[data-flow-field="theme"]').selectOption('Artifacts');
   const gate=app.hold(u=>u.hostname==='api.scryfall.com'&&u.pathname==='/cards/search');
   await page.locator('[data-act="flowGenerate"]').click();await Promise.race([gate.seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('Build search did not start')),15000))]);
   const overlay=page.locator('#sheet .build-overlay');await overlay.waitFor();assert.match(await overlay.innerText(),/Your deck is being built/);assert.equal(await overlay.locator('.stashy-logo.brand-loading').count(),1);assert.equal(await page.locator('.deck-flow [data-flow-field]').count(),0,'no editable hidden build form behind progress');
   const motion=()=>overlay.locator('.brand-card').first().evaluate(n=>getComputedStyle(n).animationName);
   assert.notEqual(await motion(),'none');await overlay.locator('.build-pop').evaluate(n=>Promise.all(n.getAnimations().filter(a=>Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished)));await visibleProgress(overlay,`normal motion ${width}${suffix}`);await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await motion(),'none');await visibleProgress(overlay,`reduced motion ${width}${suffix}`);await noOverflow(page,'#sheet','build overlay '+width+suffix);
   if(glass||width===390)await overlay.locator('.build-pop').screenshot({path:`test-results/deck-building-${width}${suffix}.png`,animations:'allow',timeout:10000});
   await overlay.locator('[data-act="flowCancelBuild"]').click();gate.release();await page.getByText('Build cancelled. Your choices are unchanged.').waitFor();assert.equal(await page.locator('[data-flow-field="budget"]').inputValue(),'200');assert.equal(await page.locator('.build-overlay').count(),0);assert.equal(await page.locator('[data-flow-result]').count(),0);
   await page.locator('[data-act="flowGenerate"]').click();await page.locator('[data-flow-result]').waitFor({timeout:60000});assert.equal(await page.locator('.build-overlay').count(),0,'completed build opens the deck automatically');
   const result=page.locator('[data-flow-result]');assert.equal(await result.locator('.cs-hero .cs-art').count(),1);assert.match(await result.locator('.cs-title').innerText(),/Krark-Clan Ironworks/);assert.match(await result.innerText(),/Reviewable draft · complete list · structure checked/);assert.match(await result.innerText(),/Some request checks remain unmet or unverified/);assert.doesNotMatch(await result.innerText(),/Generated deck · Complete · structure checked/);
   const rows=await result.locator('.deck-compact-row').evaluateAll(ns=>ns.map(n=>({name:n.dataset.flowName,qty:Number(n.dataset.flowQty)})));assert.equal(rows.reduce((n,r)=>n+r.qty,0),100);assert.equal(rows.find(r=>r.name===KCI.name).qty,1);assert.equal(rows.find(r=>r.name===SAI.name).qty,1);assert(await result.locator('.deck-printing').count()>0);assert.equal(await result.locator('.deck-compact-row .row-thumb').count(),rows.length);await noOverflow(page,'#sheet','generated deck '+width);
   await checkDeckViews(page,{root:'#sheet .deck-viewer',label:`generated-${width}${suffix}`,screenshots:width===390&&!glass});
   const download=page.waitForEvent('download');await result.locator('[data-act="flowExport"]').click();const exported=await download;
   const text=await (await import('node:fs/promises')).readFile(await exported.path(),'utf8');for(const row of rows)assert(text.split('\n').includes(`${row.qty} ${row.name}`),'export remains exact after layout preference saves');
   const exactId=await result.getAttribute('data-flow-result');await result.locator('[data-act="flowCard"]').first().click();await page.locator('#sheet .cs-card').waitFor();await page.locator('#sheet [data-act="sheetHistoryBack"]').click();await result.waitFor();assert.equal(await result.getAttribute('data-flow-result'),exactId,'card Back retains the exact result after all view switches');

   assert.equal(await result.locator('[data-flow-budget]').inputValue(),'','budget rebuild begins blank');
   assert.match(await result.locator('[data-act="flowAdjust"]').innerText(),/Rebuild with budget/);
   const order=await result.evaluate(n=>{const ai=n.querySelector('[data-act="flowCoach"]'),cards=n.querySelector('.deck-flow-cards');return {before:!!(ai.compareDocumentPosition(cards)&Node.DOCUMENT_POSITION_FOLLOWING),logo:!!ai.querySelector('.stashy-logo')};});assert.deepEqual(order,{before:true,logo:true});
   await page.locator('#sheetBody').evaluate(n=>n.scrollTop=0);if(width===390)await page.screenshot({path:`test-results/deck-built-header-${width}${suffix}.png`,fullPage:false,animations:'allow'});
   await result.locator('[data-act="flowAdjust"]').click();assert.match(await result.locator('[data-flow-status]').innerText(),/Enter a dollar budget/);assert.equal(await page.locator('.build-overlay').count(),0,'blank budget does not silently remove the cap');
   const oldId=await result.getAttribute('data-flow-result');await result.locator('[data-flow-budget]').fill('200');await result.locator('[data-act="flowAdjust"]').click();await page.waitForFunction(id=>{const n=document.querySelector('[data-flow-result]');return n&&n.dataset.flowResult!==id;},oldId);assert.equal(await result.locator('[data-flow-budget]').inputValue(),'');assert.equal(await page.locator('.build-overlay').count(),0);
   await result.locator('.deck-flow-cards').scrollIntoViewIfNeeded();if(width===390)await page.screenshot({path:`test-results/deck-built-${width}${suffix}.png`,fullPage:false,animations:'allow'});
   assert.equal(await inventorySnapshot(page),before,'generation never auto-saves or changes the collection');
   await result.locator('[data-act="flowEdit"]').click();await page.locator('[data-flow-field="budget"]').fill('0');await page.locator('[data-act="flowGenerate"]').click();await page.waitForFunction(()=>document.querySelector('.deck-flow:not([aria-busy]) [data-act="flowGenerate"]'));assert.equal(await page.locator('.build-overlay').count(),0);assert.match(await page.locator('.deck-flow [role="status"]').innerText(),/cap|complete|budget|could|slots/i);assert.equal(await page.locator('[data-flow-field="budget"]').inputValue(),'0');
   app.health();checks.push({width,glass,progressContentFullyVisible:true,animatedLogo:true,reducedMotion:true,cancelAndLateResponse:true,automaticResult:true,sharedDeckRows:true,errorReturnsToChoices:true,noAutosave:true});
  }finally{app.releaseAll();await app.context.close();}
 }
 const aiApp=await openSearchApp(browser,server.base,{game:'mtg',width:390,height:1000,evidenceLabel:'ai-build-popup',prepareFixtures:f=>{for(const c of cards)f.catalog[cardKey(c.name)]=structuredClone(c);},providerOverride:url=>{if(url.hostname==='api.scryfall.com'&&url.pathname==='/cards/search')return {data:(url.searchParams.get('q')||'').includes('is:commander')?[sai]:cards,has_more:false};}});
 try{
  let calls=0,aiArgs=ASK_BUILD_ARGS;await aiApp.context.route('**/api/ai/ask',route=>{if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:'{"available":true}'});calls++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({calls:[{type:'function_call',call_id:'popup-'+calls,name:'build_deck',arguments:JSON.stringify(aiArgs)}]})});});
  const page=aiApp.page;await page.locator('[data-act="askOpen"]').first().click();await page.locator('.ask-dialog[open]').waitFor();
  const gate=aiApp.hold(u=>u.hostname==='api.scryfall.com'&&u.pathname==='/cards/search');
  await page.locator('.ask-input').fill('Build a Commander artifact deck around "Krark-Clan Ironworks" under $200');await page.locator('.ask-send').click();
  await page.locator('.ask-dialog .build-overlay').waitFor();await Promise.race([gate.seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('AI build did not reach provider')),15000))]);
  assert.match(await page.locator('.ask-dialog .build-overlay').innerText(),/Your deck is being built/);assert.equal(await page.locator('.ask-dialog .build-overlay .brand-loading').count(),1);await noOverflow(page,'.ask-dialog','AI build popup');
  await page.screenshot({path:'test-results/ai-deck-building-phone.png',fullPage:false,animations:'allow'});gate.release();await page.locator('#sheet[open] [data-flow-result]').waitFor({timeout:60000});assert.equal(await page.locator('.build-overlay').count(),0);assert.equal(calls,1);assert.equal(await page.locator('.ask-dialog[open]').count(),0);const previousId=await page.locator('[data-flow-result]').getAttribute('data-flow-result');await checkDeckViews(page,{root:'#sheet .deck-viewer',label:'ai-390'});await page.locator('#sheet [data-act="closeSheet"]').click();await page.locator('.ask-dialog[open]').waitFor();assert.equal(await page.locator('.ask-dialog [data-flow-result]').count(),0,'chat retains a compact receipt instead of the interactive list');const receipt=page.locator('.ask-dialog [data-ask-show]').filter({hasText:'Open deck'});await receipt.waitFor();
  aiArgs={...ASK_BUILD_ARGS,format:'Modern'};const cancelled=aiApp.hold(u=>u.hostname==='api.scryfall.com'&&u.pathname==='/cards/search'&&(u.searchParams.get('q')||'').includes('f:modern'));
  await page.locator('.ask-input').fill('Build a Modern artifact deck around "Krark-Clan Ironworks" under $200');await page.locator('.ask-send').click();await page.locator('.ask-dialog .build-overlay').waitFor();await Promise.race([cancelled.seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('Second AI build did not reach provider')),15000))]);await page.locator('.ask-dialog .build-overlay button').click();await page.getByText('Build cancelled. Nothing was saved.',{exact:true}).waitFor();cancelled.release();assert.equal(await page.locator('.build-overlay').count(),0);assert.equal(await page.locator('.ask-dialog [data-flow-result]').count(),0,'cancel does not embed the previous deck in chat');assert.equal(await receipt.count(),1,'cancel preserves the earlier receipt');assert.equal(await page.locator('.ask-dialog .ask-input').evaluate(n=>!!n.closest('[inert]')),false);assert.equal(calls,2);await receipt.click();await page.locator('#sheet[open] [data-flow-result]').waitFor();assert.equal(await page.locator('[data-flow-result]').getAttribute('data-flow-result'),previousId,'cancelled replacement cannot overwrite the earlier deck');aiApp.health();checks.push({actualAskBuildPopup:true,twoMockedModelCalls:true,separateSheetAfterCompletion:true,cancelPreservesEarlierExactDeck:true});
 }finally{aiApp.releaseAll();await aiApp.context.close();}
}finally{await writeFile('test-results/deck-build-presentation-browser.json',JSON.stringify({checks,publicPriceRegistrations,physicalAndroidDevice:false},null,2));await browser.close();await server.close();}
console.log('PASS: real build progress, animated brand/reduced motion, cancellation, automatic result, shared deck design, error recovery and no autosave.');
