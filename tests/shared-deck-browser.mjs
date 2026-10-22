// Hosted browser: real UI, synthetic cards/accounts, no external writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,makeSearchFixtures,noOverflow,capture} from './search-fixtures.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Shared UI browser verification runs in hosted CI only.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch({headless:true}),checks=[];
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390,height:900,evidenceLabel:'shared-deck'}),{page}=app;
  try{
   await page.evaluate(game=>{const S=window.__uiTestState,T=window.__uiTestTcg,b=document.createElement('button');if(game==='mtg'){b.dataset.act='buildFrom';b.dataset.name=Object.values(S.catalog).find(c=>c?.name)?.name;}else{b.dataset.act='tBuild';b.dataset.id=Object.values(T.cache[game]).find(c=>c?.name&&(!c.brief))?.id;}document.body.append(b);b.click();b.remove();},game);
   await page.locator('.deck-flow').waitFor();assert.equal(await page.locator('[data-flow-field="budget"]').inputValue(),'');
   assert.equal(await page.locator('[data-act="flowGenerate"]').count(),1);assert.equal(await page.locator('[data-act="flowSave"]').count(),0);
   for(const width of [320,390,540,768,1024]){
    await page.setViewportSize({width,height:900});await noOverflow(page,'#sheet',`${game} compact setup ${width}`);
    await page.locator('.deck-flow .settings-disclosure summary').click();await noOverflow(page,'#sheet',`${game} preferences ${width}`);await page.locator('.deck-flow .settings-disclosure summary').click();
    if(width===390)await capture(page,'shared-deck-setup-'+game);
   }
   await page.emulateMedia({reducedMotion:'reduce'});await page.addStyleTag({content:'html {font-size:24px!important}'});await page.setViewportSize({width:390,height:900});await noOverflow(page,'#sheet',`${game} enlarged text`);
   await page.locator('#sheet [data-act="closeSheet"]').first().click();assert.equal(await page.locator('#sheet[open]').count(),0);app.health();checks.push(game+' compact setup, touch layout and Back');
  }finally{await app.context.close();}
 }
 const state=makeSearchFixtures('mtg').state,accountFixture={user:null,profiles:{},rows:{},people:{},items:{},art:{},writes:[],storage:{'cardforge-v2':state}};
 const guest=await openSearchApp(browser,server.base,{game:'mtg',accountFixture,evidenceLabel:'shared-settings'}),page=guest.page;
 try{
  await page.locator('[data-act="menu"]').click();assert(await page.locator('[data-release-unread]').count()>0);
  await page.locator('#settingsTab-recovery').click();assert(await page.locator('[data-release-unread]').count()>0,'opening Settings or Downloads alone does not acknowledge notes');
  await page.locator('#settings-recovery details[data-release-item] summary').click();assert.equal(await page.locator('.release-dot').count(),0,'the actual release item clears all dots for this release');
  await page.locator('#settingsTab-account').click();const eye=page.locator('#settings-account .password-toggle').first();
  if(await eye.count()){await eye.click();assert.equal(await eye.getAttribute('aria-pressed'),'true');assert.equal(await eye.locator('svg').getAttribute('stroke'),'currentColor');await eye.click();assert.equal(await eye.getAttribute('aria-pressed'),'false');}
  guest.health();checks.push('Release acknowledgment only on actual item; visible accessible password control');
 }finally{await guest.context.close();}
}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/shared-deck-browser.json',JSON.stringify({checks,physicalAndroidDevice:false},null,2));await browser.close();await server.close();}
console.log('PASS: shared setup all games at five widths, enlarged text, reduced motion, release-dot acknowledgment and password SVG.');
