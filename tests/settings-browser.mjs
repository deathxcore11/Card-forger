import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {artworkSources} from '../artwork.js';
import {startServer,openSearchApp,noOverflow,capture,inventorySnapshot,CARDS} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright');
const sources=JSON.parse(await readFile(new URL('./frame-art/sources.json',import.meta.url)));
const pinned=Object.fromEntries(await Promise.all(['mtg','ptcg','ygo'].map(async game=>[game,{source:sources[game][0],file:`tests/frame-art/${game}.${sources[game][1]}`,type:game==='ptcg'?'image/webp':'image/jpeg',bytes:await readFile(new URL(`./frame-art/${game}.${sources[game][1]}`,import.meta.url))}])));
const evidence='Synthetic cards, prices, inventory and provider responses. Pinned publisher artwork from tests/frame-art is substituted only for visual-fit/Light-header contrast checks; it does not match or prove synthetic card identity, live prices, provider availability or real-device behavior.';
const headerChecks=[];let failure;
const rgb=value=>{const n=String(value).match(/[\d.]+/g)?.map(Number);assert(n&&n.length>=3,'computed RGB color: '+value);return n;};
const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const server=await startServer(),browser=await chromium.launch({headless:true});
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390}),{page}=app;
  try{
   const artHits=new Set(),artURLs=new Set(CARDS[game].filter(c=>c.name.startsWith('Alpha fixture')).flatMap(c=>[...artworkSources(c,true),...artworkSources(c,false),c.art,c.artDirect,c.image,c.imageLarge,...Object.values(c.image_uris||{})].filter(Boolean)).map(url=>new URL(url,server.base).href));
   for(const url of artURLs)await page.route(url,async route=>{await route.fulfill({contentType:pinned[game].type,body:pinned[game].bytes});artHits.add(route.request().url());});
   const field=page.locator(game==='mtg'?'#dbTerm':'[data-input="tQ"]');await field.fill('Keep my search');
   const original=await inventorySnapshot(page),url=page.url();
   await page.evaluate(()=>window.__settingsBackground=document.querySelector('#content').firstElementChild);
   await page.locator('[data-act="menu"]').click();
   assert(await page.locator('#settingsDialog').evaluate(n=>n.matches(':modal')));
   assert.equal(page.url(),url);assert.equal(await page.locator('#settingsDialog [data-act="setGame"]').count(),0);
   assert.deepEqual(await page.locator('.settings-tabs [role=tab]').allTextContents(),['Account','Recovery','App Help & Info','App Settings']);
   for(const theme of ['dark','light']) {
   await page.locator('#settingsTab-app').click();await page.locator('#settingsTheme-'+theme).check();
   assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   assert.equal(await page.evaluate(()=>localStorage.getItem('cardstashy-theme')||'dark'),theme);
   assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),theme==='light'?'#f3f5f8':'#0f1115');
   // The setting does not flatten artwork or require glass to be switched off.
   for(const glass of [true,false]) {
    await page.locator('[data-change="setGlass"]').setChecked(glass);
    assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('glass')),glass);
    await noOverflow(page,'#settingsDialog',`${game} ${theme} glass=${glass}`);
   }
   for(const width of [320,390,768,1024,1440,390]){
    await page.setViewportSize({width,height:900});
    for(const tab of ['account','recovery','info','app']){
     await page.locator('#settingsTab-'+tab).click();
     assert.equal(await page.locator('.settings-pane:not([hidden])').getAttribute('id'),'settings-'+tab);
     assert.equal(await page.locator('.settings-tabs [tabindex="0"]').getAttribute('id'),'settingsTab-'+tab);
     assert.equal(await page.locator('.settings-tabs [aria-selected="true"]').count(),1);
     await noOverflow(page,'#settingsDialog',`${game} ${tab} ${width}`);
    }
    if([390,768].includes(width))await capture(page,`synthetic-search-settings-${game}-${theme}-${width}`);
    const rail=await page.locator('.settings-tabs').evaluate(n=>({scroll:n.scrollWidth,client:n.clientWidth,overflow:getComputedStyle(n).overflowX}));
    assert.equal(rail.overflow,'auto');if(width===320)assert(rail.scroll>rail.client,'all four labels remain readable in a horizontal rail');
   }
   assert.equal(await inventorySnapshot(page),original,'appearance leaves all games and saved quantities unchanged');
   }
   await page.locator('#settingsTab-account').click();await page.locator('#settings-account [data-act="settingsTab"][data-id="recovery"]').click();await noOverflow(page,'#settingsDialog',game+' recovery');
   await page.locator('#settingsTab-app').focus();await page.keyboard.press('Home');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-account');
   await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-recovery');
   await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-app');
   await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-account');
   await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-app');
   await page.locator('#settingsTab-info').click();assert(await page.locator('.settings-tour[data-act="replayTour"]').isVisible());
   await page.locator('#infoQuery').fill('scan');assert(await page.locator('#info-scan').isVisible());
   await page.locator('#settingsTab-app').click();assert(await page.locator('[data-act="resetOnboarding"]').isVisible());
   await page.locator('#settingsTheme-light').check();
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#settingsDialog').open);
   assert.equal(await field.inputValue(),'Keep my search');assert(await page.evaluate(()=>window.__settingsBackground===document.querySelector('#content').firstElementChild));
   await page.locator('[data-act="menu"]').click();await page.goBack();await page.waitForFunction(()=>!document.querySelector('#settingsDialog').open);
   assert.equal(page.url(),url);assert.equal(await inventorySnapshot(page),original);assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.game),game);
   // Inspect the underlying all-game search and actual card sheet in light mode.
   await field.fill('Alpha');await field.press('Enter');
   await page.waitForFunction(g=>{const u=g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search;return !u.busy&&u.results.length>0;},game);
   if(game==='ptcg')await page.waitForFunction(()=>!window.__uiTestTcg.ui('ptcg').search.detailsBusy);
   await page.locator('#content .card-grid > .grid-card').first().waitFor();
   await capture(page,`synthetic-search-theme-light-${game}-search-390`);
   await page.locator('#content .card-grid > .grid-card').first().click();await page.locator('#sheet[open] .cs-title').waitFor();
   for(const width of [390,1440]){
    await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody',`${game} light card ${width}`);
    await page.waitForFunction(()=>{const img=document.querySelector('.cs-banner .cs-hero img');return img?.complete&&img.naturalWidth>0;});
    const header=await page.locator('.cs-banner > .cs-title').evaluate(async title=>{
     const {applyTheme}=await import('/settings-theme.js'),hero=title.parentElement.querySelector('.cs-hero'),box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
     const geometry=()=>({title:box(title),hero:box(hero),mask:getComputedStyle(hero).maskImage});
     const light=geometry(),backing=getComputedStyle(title,'::before'),img=hero.querySelector('img');
     const result={geometry:light,backing:{color:backing.backgroundColor,content:backing.content,pointerEvents:backing.pointerEvents},ink:[...title.querySelectorAll('h2,.type-line,.hp,.lvl')].map(n=>({tag:n.className||n.tagName,color:getComputedStyle(n).color})),owned:[...title.querySelectorAll('.card-owned-summary')].map(n=>({ink:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor})),image:{src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight}};
     applyTheme('dark',{persist:false});result.dark={geometry:geometry(),backing:getComputedStyle(title,'::before').content};applyTheme('light',{persist:false});return result;
    });
    assert(artHits.has(header.image.src),'header must display intercepted pinned artwork');assert.deepEqual(header.geometry,header.dark.geometry,'Light backing changes no hero/title geometry or art mask');assert.equal(header.dark.backing,'none','Dark title remains unchanged');assert.equal(header.backing.content,'""');assert.equal(header.backing.pointerEvents,'none');
    const backing=rgb(header.backing.color),alpha=backing[3]??1,worst=backing.slice(0,3).map(v=>v*alpha+255*(1-alpha));assert(alpha>=.84);
    for(const ink of header.ink)assert(contrast(rgb(ink.color),worst)>=4.5,`${game} ${width} ${ink.tag} contrast on worst-case pure-white art`);
    for(const badge of header.owned)assert(contrast(rgb(badge.ink),rgb(badge.background))>=4.5,'Owned badge keeps contrasting dark ink');
    headerChecks.push({game,width,source:pinned[game].source,file:pinned[game].file,...header});
    await capture(page,`synthetic-search-theme-light-${game}-card-${width}`);
   }
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#sheet').open);assert.equal(await inventorySnapshot(page),original,'light-mode card inspection does not change saved lots');
   await page.setViewportSize({width:390,height:900});
   await page.reload();await page.locator('#app.ready').waitFor();
   assert.equal(await page.locator('html').getAttribute('data-theme'),'light','theme survives reload');
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-app').click();assert(await page.locator('#settingsTheme-light').isChecked());
   await page.locator('#settingsTheme-dark').check();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.locator('[data-act="closeSettings"]').click();
   app.health();console.log(`PASS: ${game} four Settings tabs, light/dark reload, glass parity, keyboard, Back, fold resize, draft and inventory preservation`);
  }finally{await app.context.close();}
 }
}catch(error){failure=String(error.stack||error);throw error;}finally{const out=new URL('../test-results/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('synthetic-search-settings-theme-evidence.json',out),JSON.stringify({status:failure?'failed':'passed',evidence,headerChecks,...(failure?{error:failure}:{})},null,2));await browser.close();await server.close();}
