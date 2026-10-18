import assert from 'node:assert/strict';
import {startServer,openSearchApp,noOverflow,capture,inventorySnapshot} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch({headless:true});
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390}),{page}=app;
  try{
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
   for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody',`${game} light card ${width}`);await capture(page,`synthetic-search-theme-light-${game}-card-${width}`);}
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
}finally{await browser.close();await server.close();}
