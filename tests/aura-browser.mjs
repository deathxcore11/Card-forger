import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,inventorySnapshot,capture,noOverflow} from './search-fixtures.mjs';
import {AURA_CARD} from '../aura.js';
assert.equal(process.env.GITHUB_ACTIONS,'true','Actual app browser QA runs only on hosted CI');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const results=[];let failure;
const source=page=>page.locator('#ambient .aura-art.on').getAttribute('data-src');
const waitArt=page=>page.waitForFunction(()=>document.querySelector('#ambient .aura-art.on')?.dataset.src);
const theme=async(page,value)=>page.evaluate(async value=>(await import('/settings-theme.js')).applyTheme(value),value);
try {
 for(const game of ['mtg','ptcg','ygo']) {
  const app=await openSearchApp(browser,server.base,{game,width:1440,height:1000,hasTouch:false,evidenceLabel:'aura-'+game});const {page}=app;
  try {
   const ext=game==='ptcg'?'webp':'jpg',body=await readFile(new URL(`./frame-art/${game}.${ext}`,import.meta.url));
   const colorful=await readFile(new URL(game==='mtg'?'../test-fixtures/finish-effects/chishiro-nec77.png':game==='ptcg'?'../review/assets/charizard-vmax.png':'../test-fixtures/finish-effects/dracotail-lukias.jpg',import.meta.url));
   // Real, unchanged public illustration bytes; synthetic cards/prices/providers.
   // This checks rendering, not the fixture's card-to-art identity or live delivery.
   let hits=0;
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.resourceType()==='image'&&!url.pathname.endsWith('.svg')&&(url.origin!==server.base||url.pathname.startsWith('/img/'))){hits++;const color=/002|alpha-2|99010001/.test(url.href);return route.fulfill({contentType:color?(game==='ygo'?'image/jpeg':'image/png'):(ext==='webp'?'image/webp':'image/jpeg'),body:color?colorful:body});}
    return route.fallback();
   });
   await page.emulateMedia({reducedMotion:'no-preference'});
   const before=await inventorySnapshot(page);
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-app').click();
   await page.locator('label:has(#settingsTheme-aura)').click();
   await page.waitForFunction(()=>document.documentElement.dataset.theme==='aura');
   assert.equal(await page.evaluate(()=>localStorage.getItem('cardstashy-theme')),'aura');
   await noOverflow(page,'#settingsDialog','Aura Settings '+game,true);
   await page.keyboard.press('Escape');
   const field=page.locator(game==='mtg'?'#dbTerm':'[data-input="tQ"]');await field.fill('Alpha');await field.press('Enter');
   const cards=page.locator('#content').locator(AURA_CARD);await cards.first().waitFor();assert(await cards.count()>=2);
   await cards.first().locator('img').evaluate(img=>img.decode());
   await cards.first().hover();await page.waitForTimeout(350);await waitArt(page);
   const quiet=await source(page),count=await page.locator('.aura-art').count();assert.equal(count,2);
   await capture(page,`synthetic-search-aura-${game}-quiet`);
   const networkBefore=hits;
   await page.keyboard.press('Tab');await cards.nth(1).focus();await page.waitForTimeout(350);await page.waitForFunction(url=>document.querySelector('.aura-art.on')?.dataset.src!==url,quiet);
   await page.waitForTimeout(1050);assert.equal(await page.locator('.aura-art').count(),2);assert.equal(hits,networkBefore,'focus selections add no image requests');
   await capture(page,`synthetic-search-aura-${game}-colorful`);
   // Touch-style pointer movement cannot select atmosphere.
   const selected=await source(page);
   await cards.first().dispatchEvent('pointerover',{pointerType:'touch',bubbles:true});await page.waitForTimeout(350);assert.equal(await source(page),selected);
   await cards.first().click();await page.waitForFunction(()=>document.querySelector('#sheet[open][data-card-popup="true"]'));
   await waitArt(page);await page.waitForTimeout(1200);
   const modal=await source(page);assert(modal);
   const foreground=await page.locator('#sheetBody .card-img').first().evaluate(n=>({src:n.currentSrc,filter:getComputedStyle(n).filter}));assert.equal(foreground.filter,'none');
   await page.keyboard.press('Escape');await page.waitForTimeout(400);assert.equal(await source(page),modal,'closing retains last actual viewed atmosphere');
   for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});await noOverflow(page,'#content',`Aura ${game} ${width}`,true);
    const geometry=await page.locator('#ambient').evaluate(n=>({pointer:getComputedStyle(n).pointerEvents,width:n.getBoundingClientRect().width,screen:innerWidth}));assert.equal(geometry.pointer,'none');assert.equal(geometry.width,geometry.screen);
   }
   await page.emulateMedia({reducedMotion:'reduce'});
   const motion=await page.locator('.aura-art').first().evaluate(n=>({animation:getComputedStyle(n).animationName,transition:getComputedStyle(n).transitionDuration}));assert.deepEqual(motion,{animation:'none',transition:'0s'});
   await capture(page,`synthetic-search-aura-${game}-mobile-reduced-motion`);
   await page.evaluate(()=>{location.hash='#home';});await page.waitForFunction(()=>document.body.dataset.view==='home');
   await page.locator('#homeHero .hh-art').waitFor();await waitArt(page);
   const home=await page.locator('#homeHero .hh-art').evaluate(n=>{const img=n.matches('img')?n:n.querySelector('img');return img.currentSrc||img.src;});
   await page.waitForFunction(url=>document.querySelector('.aura-art.on')?.dataset.src===url,home);
   const next=game==='mtg'?'ptcg':'mtg';await page.locator(`#game-tab-${next}`).click();await page.waitForFunction(g=>document.body.dataset.game===g,next);
   await page.waitForTimeout(100);const afterSwitch=await page.locator('.aura-art.on').count()?await source(page):'';
   assert(!afterSwitch||afterSwitch!==modal,'game switch never retains prior modal art');
   for(const mode of ['light','dark','aura','dark']) {
    await theme(page,mode);await page.waitForTimeout(30);assert.equal(await page.locator('.aura-art').count(),mode==='aura'?2:0,'theme exit frees all canvas resources');
   }
   assert.equal(await inventorySnapshot(page),before,'appearance never mutates collections or decks');app.health();
   results.push({game,widths:[320,390,768,1440],foreground,motion,maxCanvases:count,backdropBitmapPixels:2*256*192,artworkRequestsObserved:hits,checks:'settings, keyboard dwell, touch isolation/open, modal close memory, Home reset, game reset, theme cleanup, foreground pixels, layout, reduced motion'});
  } finally { await app.context.close(); }
 }

 // Separate touch hardware emulation: actual taps select, scrolling and touch
 // pointer movement do not. No hover capability is enabled for this path.
 for(const game of ['mtg','ptcg','ygo']) {
  const app=await openSearchApp(browser,server.base,{game,width:390,height:844,evidenceLabel:'aura-touch-'+game});
  const {page}=app;
  try {
   const before=await inventorySnapshot(page);await theme(page,'aura');
   const field=page.locator(game==='mtg'?'#dbTerm':'[data-input="tQ"]');await field.fill('Alpha');await field.press('Enter');
   const cards=page.locator('#content').locator(AURA_CARD);await cards.first().waitFor();
   const initial=await page.locator('.aura-art.on').count()?await source(page):'';
   await cards.first().dispatchEvent('pointerover',{pointerType:'touch',bubbles:true});
   await page.evaluate(()=>window.scrollBy(0,100));await page.waitForTimeout(350);
   assert.equal(await page.locator('.aura-art.on').count()?await source(page):'',initial,'touch browsing leaves the backdrop alone');
   await cards.first().tap();await page.waitForFunction(()=>document.querySelector('#sheet[open][data-card-popup="true"]'));await waitArt(page);
   const selected=await source(page);await page.locator('#sheetBody [data-act="closeSheet"]').first().tap();await page.waitForTimeout(350);
   assert.equal(await source(page),selected,'touch close retains viewed artwork');
   await capture(page,`synthetic-search-aura-${game}-touch-selection`);
   assert.equal(await inventorySnapshot(page),before);app.health();results.push({game,touch:true,checks:'real emulated tap, touch pointer isolation, scroll isolation, explicit close retention'});
  } finally {await app.context.close();}
 }

} catch(error){failure=error;throw error;} finally {
 await mkdir('test-results',{recursive:true});await writeFile('test-results/aura-browser.json',JSON.stringify({status:failure?'failed':'passed',results,error:failure?.stack,evidence:'Hosted Chromium emulation. Real unchanged pinned artwork with synthetic provider data. No physical-device, live-provider, GPU-frame-time or heap profiling claim.'},null,2));
 await browser.close();await server.close();
}
console.log('PASS: Aura actual-app integration across all three games, modes, pointer paths, memory/reset rules and responsive sizes.');
