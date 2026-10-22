import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {startServer,openSetsApp,LOB} from './sets-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution requires hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch(),checks=[];
try{
 for(const game of ['mtg','ptcg','ygo'])for(const width of [360,390,768,1024,1440]){
  const id=game==='mtg'?'fxa':game==='ptcg'?'fixturea':LOB.id;
  const app=await openSetsApp(browser,server.base,{game,width,hash:'#set/'+encodeURIComponent(id)}),{page}=app;
  try{
   await page.locator('.set-grid>.grid-card').first().waitFor();
   await page.waitForFunction(game=>{const s=game==='mtg'?window.__uiTestState.ui.set:window.__uiTestTcg.ui(game).set;return !s.busy;},game);
   const before=await page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,window.__uiTestState.state.decks,window.__uiTestState.state.tcg]));
   assert.equal(await page.locator('.set-overview>.set-collection-progress').count(),1);
   assert.equal(await page.locator('.set-card-toolbar .view-switch').count(),1);
   const geometry=await page.evaluate(()=>{
    const box=s=>document.querySelector(s).getBoundingClientRect(),search=box('.set-card-toolbar .searchbar'),controls=box('.set-controls');
    return {searchBottom:search.bottom,controlsTop:controls.top,overflow:document.documentElement.scrollWidth-innerWidth,frame:getComputedStyle(document.documentElement).getPropertyValue('--grid-frame-width').trim()};
   });
   assert(geometry.controlsTop>=geometry.searchBottom-1,JSON.stringify(geometry));assert(geometry.overflow<=1,JSON.stringify(geometry));assert.equal(geometry.frame,'3.75px');
   const input=page.locator('[aria-label="Search this set"]');await input.fill('NO-RESULT-FIXTURE');await page.waitForFunction(()=>!document.querySelector('.set-grid>.grid-card'));await input.fill('');await page.locator('.set-grid>.grid-card').first().waitFor();
   for(const mode of ['compact','symbols','gallery']){
    await page.locator(`.set-card-toolbar [data-mode="${mode}"]`).click();await page.waitForFunction(m=>document.querySelector('#content').classList.contains('view-'+m),mode);
    assert.equal(await page.locator(`.set-card-toolbar [data-mode="${mode}"]`).getAttribute('aria-checked'),'true');
   }
   const after=await page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,window.__uiTestState.state.decks,window.__uiTestState.state.tcg]));assert.equal(after,before,'Browsing cannot mutate collection or decks');
   await page.screenshot({path:`test-results/compact-set-${game}-${width}.png`,fullPage:true,animations:'disabled'});
   app.health();checks.push({game,width,...geometry,result:'pass'});
  }finally{await app.context.close();}
 }
 console.log('PASS: compact set panels, search, views and overflow at 15 game/viewport combinations. Synthetic artwork; no Android runtime claim.');
}finally{await writeFile('test-results/compact-set-report.json',JSON.stringify(checks,null,2));await browser.close();await server.close();}
