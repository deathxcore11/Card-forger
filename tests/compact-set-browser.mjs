import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {startServer,openSetsApp,LOB} from './sets-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution requires hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch(),checks=[];
const setVisit=(page,game)=>page.evaluate(game=>{const S=window.__uiTestState,set=game==='mtg'?S?.ui.set:window.__uiTestTcg?.ui(game).set;return {boot:window.__compactSetDocument,url:location.href,history:history.state?.cardstashy,game:document.body.dataset.game,savedGame:S?.state.settings.game,view:S?.ui.view,set:game==='mtg'?set?.code:set?.id,mode:S?.state.settings.displayModes?.[game]?.set,className:document.querySelector('#content')?.className,cards:[...document.querySelectorAll('.set-grid>.grid-card')].map(n=>n.dataset.id||n.dataset.name),busy:set?.busy};},game);
try{
 for(const game of ['mtg','ptcg','ygo'])for(const width of [360,390,768,1024,1440]){
  const id=game==='mtg'?'fxa':game==='ptcg'?'fixturea':LOB.id;
  const app=await openSetsApp(browser,server.base,{game,width,hash:'#set/'+encodeURIComponent(id)}),{page}=app;
  const navigations=[],documents=[],modes=[];let phase='load',visit;
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
   await page.evaluate(()=>window.__compactSetDocument=crypto.randomUUID());visit=await setVisit(page,game);assert.equal(visit.set,id);assert.equal(visit.view,'set');assert.equal(visit.game,game);assert(visit.cards.length>0);
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(frame.url());});
   page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents.push(request.url());});
   for(const mode of ['compact','symbols','gallery']){
    phase='view-'+mode;const control=page.locator(`.set-card-toolbar [data-mode="${mode}"]`),owner=await control.evaluate(n=>({type:n.type,form:!!n.form,ancestorForm:!!n.closest('form'),action:n.dataset.act,game:n.dataset.game,area:n.dataset.area}));assert.equal(owner.form,false,'view radio is not a form submit control');assert.equal(owner.ancestorForm,false);assert.deepEqual([owner.action,owner.game,owner.area],['viewSave',game,'set'],'the clicked control only changes this set’s display mode');
    // This action persists a presentation setting in the current document.
    // Verify its application result rather than awaiting a browser navigation.
    await control.click({noWaitAfter:true});await page.waitForFunction(({mode,game,boot,set,url})=>{const S=window.__uiTestState,current=game==='mtg'?S?.ui.set:window.__uiTestTcg?.ui(game).set;return window.__compactSetDocument===boot&&location.href===url&&document.body.dataset.game===game&&S?.state.settings.game===game&&S?.ui.view==='set'&&(game==='mtg'?current?.code:current?.id)===set&&S?.state.settings.displayModes?.[game]?.set===mode&&document.querySelector('#content')?.classList.contains('view-'+mode)&&document.querySelector(`.set-card-toolbar [data-mode="${mode}"]`)?.getAttribute('aria-checked')==='true';},{mode,game,boot:visit.boot,set:visit.set,url:visit.url});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const current=await setVisit(page,game);for(const key of ['boot','url','history','game','savedGame','view','set','cards'])assert.deepEqual(current[key],visit[key],mode+' preserves '+key);assert.deepEqual(navigations,[],'changing card view cannot navigate the main frame');assert.deepEqual(documents,[],'changing card view cannot submit a form or reload the document');assert.equal(await control.getAttribute('aria-checked'),'true');
    const first=page.locator('.set-grid>.grid-card').first();await first.scrollIntoViewIfNeeded();const layout=await first.evaluate(n=>{const box=x=>{const r=x.getBoundingClientRect();return {width:r.width,height:r.height};},image=n.querySelector('.card-img');return {card:box(n),image:box(image),imageDisplay:getComputedStyle(image).display,caption:n.querySelector('.grid-meta').textContent,overflow:document.documentElement.scrollWidth-innerWidth};});assert(layout.caption.trim());assert(layout.overflow<=1,mode+': '+JSON.stringify(layout));if(mode==='symbols')assert.equal(layout.imageDisplay,'none');else{assert(layout.image.width>0&&layout.image.height>layout.image.width,mode+' retains portrait art');if(mode==='compact'){assert(layout.image.width<=80,'compact view uses a small card thumbnail');assert(layout.card.width>layout.card.height,'compact view uses readable landscape rows');}else assert(layout.image.width>80,'gallery restores full card art');}modes.push({mode,owner,cardCount:current.cards.length,layout});
   }
   const after=await page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,window.__uiTestState.state.decks,window.__uiTestState.state.tcg]));assert.equal(after,before,'Browsing cannot mutate collection or decks');
   await page.screenshot({path:`test-results/compact-set-${game}-${width}.png`,fullPage:true,animations:'disabled'});
   app.health();checks.push({game,width,...geometry,result:'pass',sameDocument:true,sameRoute:true,navigations,documents,modes});
  }catch(error){checks.push({game,width,result:'fail',phase,error:error.stack,visit,state:await setVisit(page,game).catch(e=>({error:e.message})),navigations,documents,modes,diagnostics:app.diagnostics()});await page.screenshot({path:`test-results/compact-set-${game}-${width}-failure.png`,fullPage:true,animations:'disabled',timeout:10000}).catch(()=>{});throw error;
  }finally{await app.context.close();}
 }
 console.log('PASS: compact set panels, search, views and overflow at 15 game/viewport combinations. Synthetic artwork; no Android runtime claim.');
}finally{await writeFile('test-results/compact-set-report.json',JSON.stringify(checks,null,2));await browser.close();await server.close();}
