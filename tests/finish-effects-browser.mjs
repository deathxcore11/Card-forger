// Hosted real-app integration. Art is explicitly synthetic, not mask-calibration evidence.
import assert from 'node:assert/strict';
import {CARDS,startServer,openApp,closeSheet,inventorySnapshot,capture} from './detail-rules-fixtures.mjs';
import {noOverflow} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Finish browser QA runs only in hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch();
try{for(const game of ['mtg','ptcg','ygo']){
 const app=await openApp(browser,server.base,{game,width:390}),{page}=app;
 try{
  const opener=page.locator(`#content .lot-art[data-entry="lot-${game}-0"]`);
  await opener.hover();
  assert.equal(await opener.evaluate(n=>getComputedStyle(n,'::before').display),'none','Legacy color-dodge hover rings cannot cover collection cards');
  await capture(page,`finish-effects-${game}-collection-hover`);await opener.click();
  await page.waitForFunction(()=>{const c=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&!c?.detailsBusy&&!c?.printsBusy;});
  const before=await inventorySnapshot(page),preview=page.locator('#sheet .finish-preview');await preview.waitFor();
  if(game!=='ygo')await preview.locator(`[data-finish="${game==='mtg'?'foil':'reverse-holofoil'}"]`).click();
  const selection=await page.evaluate(()=>JSON.stringify((c=>[c.type,c.game,c.id,c.print?.id,c.priceFinish,c.setVariant,c.priceEdition,c.priceYgoEdition])(window.__uiTestState.ui.sheetCtx)));
  for(const width of [320,390,673,768,1024,1440]){
   await page.setViewportSize({width,height:1000});await preview.scrollIntoViewIfNeeded();await noOverflow(page,'#sheetBody',`${game} finish ${width}`);
   await capture(page,`finish-effects-${game}-${width}`);
  }
  await page.locator('#sheet .cd-img').scrollIntoViewIfNeeded();
  if(game==='mtg'){
   await page.locator('#sheet .finish-overlay').waitFor();
   const geometry=await page.locator('#sheet .cd-img').evaluate(n=>{const a=n.querySelector('img').getBoundingClientRect(),b=n.querySelector('.finish-overlay').getBoundingClientRect();return {inside:b.left>=a.left-2&&b.right<=a.right+2&&b.top>=a.top-2&&b.bottom<=a.bottom+2,ratio:b.width/b.height};});
   assert(geometry.inside,'Overlay stays inside image element');
  }
  // Controls alter preview state only; a deliberate toggle never changes ownership.
  await preview.locator('[data-finish-toggle]').click();assert.equal(await page.locator('#sheet .finish-overlay').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify((c=>[c.type,c.game,c.id,c.print?.id,c.priceFinish,c.setVariant,c.priceEdition,c.priceYgoEdition])(window.__uiTestState.ui.sheetCtx))),selection);
  await preview.locator('[data-finish-toggle]').click();
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#sheet .finish-overlay').count(),0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await inventorySnapshot(page),before,'Finish preview does not edit collection, private prices or decks');
  if(game==='mtg'){
   await page.locator('#sheet .cd-img').scrollIntoViewIfNeeded();await page.locator('#sheet .cd-zoom').click();
   await page.locator('.zoom-card-surface .finish-overlay').waitFor();await capture(page,'finish-effects-mtg-zoom');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.zoom-card-surface'));
  }
  await closeSheet(page);await page.waitForFunction(()=>!document.querySelector('#sheet .finish-overlay'));
  app.health();console.log(`PASS: ${game} real finish controls, 320/390/673/768/1024/1440px, off/reduced-motion/cleanup and unchanged ownership.`);
 }catch(e){await capture(page,`finish-effects-${game}-failure`);throw e;}finally{await app.context.close();}
}}finally{await browser.close();await server.close();}
