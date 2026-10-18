import assert from 'node:assert/strict';
import {startServer,openSearchApp,CARDS,noOverflow,capture} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
try{for(const game of ['mtg','ptcg','ygo']){const app=await openSearchApp(browser,server.base,{game,width:390}),{page}=app;
 try{
  const cards=CARDS[game].slice(0,6),deck={id:'box-fixture',name:'My card box',format:game==='mtg'?'Standard':game==='ygo'?'tcg':'standard',...(game==='mtg'?{cards:cards.map(c=>({name:c.name,qty:1})),side:[]}:{zones:{main:cards.map(c=>({cardId:c.id,qty:1})),extra:[],side:[]}})};
  await page.evaluate(({game,deck})=>{const s=window.__uiTestState.state;(game==='mtg'?s:s.tcg[game]).decks.push(deck);},{game,deck});
  const collection=await page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,window.__uiTestState.state.tcg]));
  await page.locator('[data-nav="decks"]:visible').first().click();const tile=page.locator('.deck-tile').filter({has:page.locator('[data-deck-box="'+game+':box-fixture"]')});await tile.waitFor();
  await page.emulateMedia({reducedMotion:'no-preference'});await tile.click();await page.locator('.deck-hero .deck-box-control').waitFor();assert.equal(await page.locator('.brand-breathing').first().evaluate(n=>getComputedStyle(n).animationName),'stashy-breathe');assert.equal(await page.locator('.deck-hero > .hero-art').evaluate(n=>getComputedStyle(n).animationDuration),'20s');await page.waitForFunction(()=>!document.querySelector('.deck-box-flight'));
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#content',`${game} deck box ${width}`);if([390,1440].includes(width))await capture(page,`synthetic-search-deck-box-${game}-${width}`);}
  await page.locator('.deck-hero .deck-box-control').click();await page.locator('.deck-box-settings summary').click();await page.locator('#deckBoxColor').fill('#337799');await page.locator('#deckBoxImage').selectOption({index:1});
  await page.locator(`[data-act="${game==='mtg'?'deckSaveInfo':'tDeckSave'}"]`).click();await page.locator('#sheet[open]').waitFor({state:'hidden'});
  assert.match(await page.locator('.deck-hero .deck-box-control').getAttribute('style'),/#337799/);
  await page.locator('.deck-hero [data-to="#decks"]').click();await page.locator('.deck-tile [data-deck-box]').waitFor();await page.waitForFunction(()=>!document.querySelector('.deck-box-flight'));assert.match(await page.locator('.deck-tile [data-deck-box]').getAttribute('style'),/#337799/);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.brand-breathing').first().evaluate(n=>getComputedStyle(n).animationName),'none','logo respects reduced motion');await tile.click();assert.equal(await page.locator('.deck-box-flight').count(),0);await page.reload();await page.locator('#app.ready').waitFor();await page.locator('.deck-hero .deck-box-control').waitFor();assert.match(await page.locator('.deck-hero .deck-box-control').getAttribute('style'),/#337799/);
  const after=await page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,...Object.values(window.__uiTestState.state.tcg).map(g=>g.collection)]));const before=JSON.parse(collection);assert.equal(after,JSON.stringify([before[0],...Object.values(before[1]).map(g=>g.collection)]),'box appearance never changes ownership');app.health();
  console.log(`PASS: ${game} editable deck box, menu identity, open/back cleanup, reduced motion, persistence and 320–1440px layout`);
 }catch(e){await capture(page,`synthetic-search-deck-box-${game}-failure`,{settle:false});throw e;}finally{await app.context.close();}
}}finally{await browser.close();await server.close();}
