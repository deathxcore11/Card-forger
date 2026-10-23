// Actual application and construction pipeline with synthetic card/provider data.
// No live AI calls, account writes, real art or price claims.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,noOverflow,inventorySnapshot} from './search-fixtures.mjs';
import {ASK_BUILD_CARDS,KCI,SAI} from './ai-deck-build-fixtures.mjs';
import {cardKey} from '../core.js';
const cards=ASK_BUILD_CARDS.map(c=>({...c,image_uris:Object.fromEntries(Object.entries(c.image_uris).map(([k,v])=>[k,v.replace('detail-fixtures.invalid','search-fixtures.invalid')]))})),sai=cards.find(c=>c.name===SAI.name);
const {chromium}=await import(process.env.CARDSTASHY_PLAYWRIGHT_MODULE||'playwright');
const server=await startServer(),browser=await chromium.launch({headless:true,...(process.env.CARDSTASHY_CHROMIUM_PATH?{executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{} )}),checks=[];
await mkdir('test-results',{recursive:true});
try{
 for(const width of [390,1440]){
  const app=await openSearchApp(browser,server.base,{game:'mtg',width,height:1000,reducedMotion:'no-preference',evidenceLabel:'deck-build-presentation',prepareFixtures:f=>{for(const c of cards)f.catalog[cardKey(c.name)]=structuredClone(c);},providerOverride:url=>{
   if(url.hostname!=='api.scryfall.com')return;
   if(url.pathname==='/cards/search')return {data:(url.searchParams.get('q')||'').includes('is:commander')?[sai]:cards,has_more:false};
   if(url.pathname==='/cards/named')return cards.find(c=>c.name===(url.searchParams.get('exact')||url.searchParams.get('fuzzy')))||KCI;
  }});
  try{
   const {page}=app,before=await inventorySnapshot(page);
   await page.evaluate(name=>{const b=document.createElement('button');b.dataset.act='buildFrom';b.dataset.name=name;document.body.append(b);b.click();b.remove();},KCI.name);
   await page.locator('[data-flow-field="format"]').selectOption('Commander');await page.locator('[data-flow-field="budget"]').fill('200');await page.locator('[data-flow-field="theme"]').selectOption('Artifacts');
   const gate=app.hold(u=>u.hostname==='api.scryfall.com'&&u.pathname==='/cards/search');
   await page.locator('[data-act="flowGenerate"]').click();await Promise.race([gate.seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('Build search did not start')),15000))]);
   const overlay=page.locator('#sheet .build-overlay');await overlay.waitFor();assert.match(await overlay.innerText(),/Your deck is being built/);assert.equal(await overlay.locator('.stashy-logo.brand-loading').count(),1);assert.equal(await page.locator('.deck-flow [data-flow-field]').count(),0,'no editable hidden build form behind progress');
   const motion=()=>overlay.locator('.brand-card').first().evaluate(n=>getComputedStyle(n).animationName);
   assert.notEqual(await motion(),'none');await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await motion(),'none');await noOverflow(page,'#sheet','build overlay '+width);
   await page.screenshot({path:`test-results/deck-building-${width}.png`,fullPage:false,animations:'allow'});
   await overlay.locator('[data-act="flowCancelBuild"]').click();gate.release();await page.getByText('Build cancelled. Your choices are unchanged.').waitFor();assert.equal(await page.locator('[data-flow-field="budget"]').inputValue(),'200');assert.equal(await page.locator('.build-overlay').count(),0);assert.equal(await page.locator('[data-flow-result]').count(),0);
   await page.locator('[data-act="flowGenerate"]').click();await page.locator('[data-flow-result]').waitFor({timeout:60000});assert.equal(await page.locator('.build-overlay').count(),0,'completed build opens the deck automatically');
   const result=page.locator('[data-flow-result]');assert.equal(await result.locator('.cs-hero .cs-art').count(),1);assert.match(await result.locator('.cs-title').innerText(),/Krark-Clan Ironworks/);assert.match(await result.innerText(),/Generated deck · Complete · structure checked/);
   const rows=await result.locator('.deck-compact-row').evaluateAll(ns=>ns.map(n=>({name:n.dataset.flowName,qty:Number(n.dataset.flowQty)})));assert.equal(rows.reduce((n,r)=>n+r.qty,0),100);assert.equal(rows.find(r=>r.name===KCI.name).qty,1);assert.equal(rows.find(r=>r.name===SAI.name).qty,1);assert(await result.locator('.deck-printing').count()>0);assert.equal(await result.locator('.deck-compact-row .row-thumb').count(),rows.length);await noOverflow(page,'#sheet','generated deck '+width);
   await result.locator('.deck-flow-cards').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/deck-built-${width}.png`,fullPage:false,animations:'allow'});
   assert.equal(await inventorySnapshot(page),before,'generation never auto-saves or changes the collection');
   await result.locator('[data-act="flowEdit"]').click();await page.locator('[data-flow-field="budget"]').fill('0');await page.locator('[data-act="flowGenerate"]').click();await page.waitForFunction(()=>document.querySelector('.deck-flow:not([aria-busy]) [data-act="flowGenerate"]'));assert.equal(await page.locator('.build-overlay').count(),0);assert.match(await page.locator('.deck-flow [role="status"]').innerText(),/cap|complete|budget|could|slots/i);assert.equal(await page.locator('[data-flow-field="budget"]').inputValue(),'0');
   app.health();checks.push({width,animatedLogo:true,reducedMotion:true,cancelAndLateResponse:true,automaticResult:true,sharedDeckRows:true,errorReturnsToChoices:true,noAutosave:true});
  }finally{app.releaseAll();await app.context.close();}
 }
}finally{await writeFile('test-results/deck-build-presentation-browser.json',JSON.stringify({checks,physicalAndroidDevice:false},null,2));await browser.close();await server.close();}
console.log('PASS: real build progress, animated brand/reduced motion, cancellation, automatic result, shared deck design, error recovery and no autosave.');
