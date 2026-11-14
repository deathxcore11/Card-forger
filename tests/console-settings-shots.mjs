// Console Settings on the website at each size it is used at: the phone, the Fold open, a tablet and a desktop (the site
// has no Thor layout; the two-screen handhelds use the app). Pictures go to test-results/console-settings/. Synthetic fixtures (search-fixtures.mjs), signed out.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer,openSearchApp,noOverflow,RESULTS} from './search-fixtures.mjs';
const out=resolve(RESULTS,'console-settings');await mkdir(out,{recursive:true});
const SIZES=[['phone-390x844',390,844],['fold-884x796',884,796],['tablet-1280x800',1280,800],['desktop-1440x900',1440,900]];
const server=await startServer(),browser=await chromium.launch();
try{
 for(const [name,width,height] of SIZES){
  const {page,context}=await openSearchApp(browser,server.base,{game:'mtg',width,height,hasTouch:width<700});
  await page.locator('[data-act="menu"]').click();
  for(const tab of ['sound','app','account','recovery','info']){
   await page.locator('#settingsTab-'+tab).click();
   const pane=page.locator('#settings-'+tab);assert(await pane.isVisible(),tab+' shows');
   if(tab!=='account')assert.equal(await pane.locator('.c-list > .foot:visible:not(.settings-legal), .c-line .foot:visible').count(),0,tab+' has no description lines');
   await noOverflow(page,'#settingsDialog',`${name} ${tab}`);
   await page.screenshot({path:resolve(out,`${tab}-${name}.png`)});
  }
  // A level moves its number with it.
  await page.locator('#settingsTab-sound').click();
  const music=page.locator('#settings-sound [data-change="setMusicVolume"]');await music.fill('40');
  assert.equal(await page.locator('#settings-sound [data-cline="music"] .c-pct').textContent(),'40%');
  await context.close();
 }
 console.log('PASS: Console Settings at phone, Fold, tablet and desktop; no description lines; a level shows its number.');
}finally{await browser.close();await server.close?.();}
