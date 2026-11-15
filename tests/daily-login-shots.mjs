// The daily log-in pop-up on the website: phone, phone on its side, Fold, tablet and desktop. The day comes from a made-up
// login (the server's shape), so these pictures prove the layout, not the server's pay-out. Pictures: test-results/daily-login/.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer,openSearchApp,RESULTS} from './search-fixtures.mjs';
const out=resolve(RESULTS,'daily-login');await mkdir(out,{recursive:true});
const SIZES=[['phone-390x844',390,844],['phone-side-844x390',844,390],['fold-884x796',884,796],['tablet-1280x800',1280,800],['desktop-1440x900',1440,900]];
const DAYS={day4:{day:'2026-11-14',stamp:4,reward:{coins:300,packs:1},monthReward:{packs:2},fresh:true},day7:{day:'2026-11-17',stamp:7,reward:{seals:{m:1,r:1},packs:2},monthReward:{coins:500,seals:{u:2}},fresh:true}};
const server=await startServer(),browser=await chromium.launch();
try{
 for(const [name,width,height] of SIZES){
  const {page,context}=await openSearchApp(browser,server.base,{game:'mtg',width,height,hasTouch:width<700});
  for(const [day,login] of Object.entries(DAYS)){
   await page.evaluate(async l=>{const m=await import('./daily-login.js');window.__dl=m.showDailyLogin(l);},login);
   await page.waitForTimeout(1300);
   const box=await page.locator('.dl-sheet').boundingBox();
   assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`${name} ${day}: the pop-up fits the screen`);
   const medals=await page.locator('.dl-medal').evaluateAll(m=>m.map(e=>e.getBoundingClientRect().width));
   assert(medals.every(w=>w>=70),`${name} ${day}: no medal is a sliver (${medals})`);
   assert.equal(await page.evaluate(()=>document.activeElement?.className),'btn primary dl-claim',`${name} ${day}: Claim has focus`);
   await page.screenshot({path:resolve(out,`${day}-${name}.png`)});
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>window.__dl),true);
   assert.equal(await page.locator('.dl-host').count(),0,`${name} ${day}: Esc claims and closes`);
  }
  await context.close();
 }
 console.log('PASS: daily log-in pop-up fits phone, phone on its side, Fold, tablet and desktop; Claim has focus; Esc claims and closes.');
}finally{await browser.close();await server.close?.();}
