import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CARDS,SETS,startServer,openSearchApp,inventorySnapshot,noOverflow} from './search-fixtures.mjs';
const card=CARDS.mtg[0];
assert(card.finishes.includes('foil'));
if(process.argv.includes('--validate-fixtures')){console.log('PASS: same exact Magic printing/foil through set entry and pack inspect; actual modal/sensor/inventory regression fixture.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted CI only');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
fs.mkdirSync('test-results',{recursive:true});const report={status:'FAIL',cases:[],limits:'Synthetic touch/sensor events in hosted Chromium, not physical-device verification.'};let app;
try{
 for(const width of [390,768,1440]){
  app=await openSearchApp(browser,server.base,{game:'mtg',width,height:1000,hasTouch:true,reducedMotion:'no-preference',evidenceLabel:'pack-detail',providerOverride:url=>url.pathname==='/data/mtg-boosters/fxa.json'?{status:404,body:{error:'Synthetic booster uses fallback sampler'}}:undefined});
  const {page}=app,before=await inventorySnapshot(page);
  await page.evaluate(async({card,set})=>{
   const {S}=await import('/store.js'),{packButton}=await import('/set-experience.js'),{esc}=await import('/ui.js');
   S.ui.view='set';Object.assign(S.ui.set,{code:set.code,info:{...set,card_count:1},cards:[card],loaded:true,busy:false,error:''});
   S.ui.packFeatured={game:'mtg',id:card.id,name:card.name,date:'2026-10-17',card};
   document.querySelector('#content').innerHTML=`<button data-act="card" data-name="${esc(card.name)}" data-set-i="0" data-set-finish="foil">Inspect set card</button>${packButton('mtg',set,{ready:true})}`;
  },{card,set:SETS.mtg[0]});
  await page.locator('[data-set-i="0"]').click();
  const detail=page.locator('#sheetBody .cd-img');await detail.scrollIntoViewIfNeeded();await detail.locator('.finish-overlay').waitFor();
  const fromSet=await detail.getAttribute('data-finish-model');
  await page.locator('#sheet [data-act="closeSheet"]').click();
  await page.locator('[data-act="openSetPack"]').click();await page.locator('[data-pack="open"]').click();
  await page.locator('.pack-card').first().click();
  const pack=page.locator('.pack-dialog');const pulls=await pack.locator('.pack-card').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')));
  await page.locator('.pack-face .finish-overlay').waitFor();
  await page.locator('.pack-focus-card').click();await detail.scrollIntoViewIfNeeded();await detail.locator('.finish-overlay').waitFor();
  assert.equal(await detail.getAttribute('data-finish-model'),fromSet,'Pack details use the identical printing/finish model as the set');
  assert(await pack.evaluate(n=>n.classList.contains('pack-under')&&n.open));
  assert(await page.evaluate(()=>[...document.querySelectorAll('dialog[open]')].at(-1).classList.contains('pack-dialog')),'Regression keeps pack later in DOM order');
  assert(await page.evaluate(async()=>{const {motionCard}=await import('/feel.js');return motionCard()===document.querySelector('#sheetBody .cd-img');}));
  await page.waitForFunction(()=>!document.querySelector('.pack-face .finish-overlay'));
  await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:30,gamma:0})));
  await page.waitForTimeout(50);
  await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:42,gamma:12})));
  await page.waitForFunction(()=>{const c=document.querySelector('#sheetBody .cd-img');return c.classList.contains('gyro')&&parseFloat(c.style.getPropertyValue('--tx'))>0;});
  await detail.hover();await page.mouse.move((await detail.boundingBox()).x+20,(await detail.boundingBox()).y+40);
  assert(await detail.evaluate(n=>n.classList.contains('tilting')),'Pointer interaction remains available');
  await noOverflow(page,'#sheetBody',`pack card details ${width}`);
  await page.screenshot({path:`test-results/finish-effects-pack-detail-${width}.png`,fullPage:true,animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.finish-overlay'));
  await page.emulateMedia({reducedMotion:'no-preference'});await detail.locator('.finish-overlay').waitFor();
  await page.locator('#sheet [data-act="closeSheet"]').click();await page.waitForFunction(()=>!document.querySelector('.pack-dialog').classList.contains('pack-under'));
  await page.locator('.pack-face .finish-overlay').waitFor();
  assert.deepEqual(await pack.locator('.pack-card').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label'))),pulls,'Closing details resumes the same pulls and reveal state');
  assert.deepEqual(await inventorySnapshot(page),before,'Opening/tilting/closing pack details never changes saved inventory');
  await page.locator('[data-pack="close"]').click();
  assert.deepEqual(app.diagnostics().errors,[]);report.cases.push({width,printingId:card.id,result:'PASS'});
  await app.context.close();app=null;
 }
 report.status='PASS';console.log('PASS: pack details retain exact set foil, foreground overlay, gyro/pointer input, reduced motion, same-pack resume and inventory at phone/tablet/desktop widths.');
}finally{fs.writeFileSync('test-results/finish-effects-pack-detail-report.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
