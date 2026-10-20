// Actual controllers and retained local state; no live account or provider writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startServer,openSearchApp,CARDS,inventorySnapshot,noOverflow} from './search-fixtures.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser execution is hosted-only.');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
fs.mkdirSync('test-results',{recursive:true});const results=[];
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:1440,height:1000,prepareFixtures:f=>{
   const cards=CARDS[game].slice(0,4),st=game==='mtg'?f.state:f.state.tcg[game];
   st.decks=['first','target'].map(id=>({id:'menu-'+id,name:id==='target'?'Lampent · Standard · Upgraded · up to $25.00':'Another saved deck',format:game==='mtg'?'Standard':game==='ptcg'?'standard':'tcg',...(game==='mtg'?{cards:cards.map(c=>({name:c.name,qty:1})),side:[]}:{zones:{main:cards.map(c=>({cardId:c.id,name:c.name,qty:1})),side:[],extra:[]}})}));
  }});const {page}=app;
  try{
   const before=await inventorySnapshot(page);
   await page.locator('[data-nav="decks"]:visible').first().click();
   const tile=page.locator('.deck-tile').filter({has:page.locator(`[data-deck-box="${game}:menu-target"]`)});
   await tile.click({button:'right'});await page.locator('.context-deck').waitFor();
   assert.match(await page.locator('.context-head h2').innerText(),/Lampent/);
   assert.equal(await page.locator('.context-shortcuts button').count(),4);
   assert.equal(await page.locator('[data-act="tileOptions"]').count(),0,'No second deck-options menu');
   const actionNames=game==='mtg'?['deckShare','deckCopy','deckExport','deckDup','deckDelete']:['tShare','tDeckCopy','tDeckExport','tDeckDup','tDeckDelete'];
   for(const act of actionNames)assert.equal(await page.locator(`.context-menu [data-act="${act}"]`).count(),1);
   for(const theme of ['dark','light']){
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody',`${game} deck ${theme} ${width}`);
     assert(await page.locator('.context-menu').evaluate(n=>![...n.querySelectorAll('button')].some(b=>b.textContent.includes('undefined'))));
     if([390,1440].includes(width))await page.screenshot({path:`test-results/context-menu-deck-${game}-${theme}-${width}.png`});
    }
   }
   await page.locator('.context-edit > summary').first().click();await page.locator(game==='mtg'?'#dmName':'#tDmName').waitFor({state:'visible'});
   assert.match(await page.locator(game==='mtg'?'#dmName':'#tDmName').inputValue(),/Lampent/);
   await page.setViewportSize({width:320,height:1000});await noOverflow(page,'#sheetBody',game+' expanded edit');
   await page.locator('.context-edit > summary').first().click();
   await page.locator('.context-shortcuts [data-tab="cards"]').click();
   await page.waitForFunction(()=>location.hash.includes('menu-target')&&!document.querySelector('#sheet').open);
   await page.locator('[data-nav="decks"]:visible').first().click();await tile.focus();await page.keyboard.press('Shift+F10');await page.locator('.context-deck').waitFor();await page.keyboard.press('Escape');await page.locator('#sheet[open]').waitFor({state:'hidden'});
   await tile.scrollIntoViewIfNeeded();const box=await tile.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.locator('.context-deck').waitFor();await page.mouse.up();await page.locator('.context-close').click();
   await page.locator('[data-nav="collection"]:visible').first().click();
   const card=page.locator('#content [data-act="'+(game==='mtg'?'card':'tCard')+'"]:visible').first();await card.click({button:'right'});await page.locator('.context-card').waitFor();
   assert.equal(await page.locator('.card-action-list .context-action').count(),5);
   assert.equal(await page.locator('.quick-owned').count(),1);
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody',game+' card '+width);if([390,1440].includes(width))await page.screenshot({path:`test-results/context-menu-card-${game}-${width}.png`});}
   await page.locator('[data-act="quickCompare"]').click();await page.locator('#compareTray').waitFor();await page.locator('[data-act="cancelCardCompare"]').click();
   assert.equal(await inventorySnapshot(page),before,'Opening, editing without Save, navigating and comparing cannot modify saved data');
   assert.deepEqual(await page.evaluate(()=>window.__fixtureSensitiveWrites),[]);app.health();results.push({game,status:'PASS'});
  }catch(e){await page.screenshot({path:`test-results/context-menu-${game}-failure.png`});throw e;}finally{await app.context.close();}
 }
}finally{fs.writeFileSync('test-results/context-menu-report.json',JSON.stringify(results,null,2));await browser.close();await server.close();}
console.log('PASS: all-game unified deck/card menus, correct target, grouped actions, expandable editing, right-click/long-press/keyboard, responsive bounds, no unintended saved-data writes.');
