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
   for(const width of [320,390,768,1024,1440,390]){
    await page.setViewportSize({width,height:900});
    for(const tab of ['account','backup','app']){
     await page.locator('#settingsTab-'+tab).click();await noOverflow(page,'#settingsDialog',`${game} ${tab} ${width}`);
    }
    if([390,768].includes(width))await capture(page,`synthetic-search-settings-${game}-${width}`);
   }
   await page.locator('#settingsTab-app').focus();await page.keyboard.press('Home');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsTab-account');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#settingsDialog').open);
   assert.equal(await field.inputValue(),'Keep my search');assert(await page.evaluate(()=>window.__settingsBackground===document.querySelector('#content').firstElementChild));
   await page.locator('[data-act="menu"]').click();await page.goBack();await page.waitForFunction(()=>!document.querySelector('#settingsDialog').open);
   assert.equal(page.url(),url);assert.equal(await inventorySnapshot(page),original);assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.game),game);
   app.health();console.log(`PASS: ${game} Settings modal, keyboard, Back, fold resize, draft and inventory preservation`);
  }finally{await app.context.close();}
 }
}finally{await browser.close();await server.close();}
