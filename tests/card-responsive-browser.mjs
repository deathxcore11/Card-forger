// Actual app/dialog checks, authorized hosted CI only. No private reference media.
// The local path validates data without importing Playwright or starting a server.
import assert from 'node:assert/strict';
import {GAMES,CARDS,validateFixtures,startServer,openApp,navigate,closeSheet,inventorySnapshot,noOverflow,capture,saveReport} from './detail-rules-fixtures.mjs';
console.log(await validateFixtures());
if(process.argv.includes('--validate-fixtures'))process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Responsive browser execution is restricted to hosted GitHub Actions. Use --validate-fixtures locally.');
const {chromium}=await import('playwright');
const server=await startServer();let browser,failure;const report=[];
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function turn(page,beta,gamma){await page.evaluate(({beta,gamma})=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta,gamma})),{beta,gamma});await frame(page);}
async function openCard(page,game,scrollToCard=true){
 await page.locator(`#content .lot-art[data-entry="lot-${game}-0"]`).click();
 await page.waitForFunction(({game,name})=>{const c=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&!c?.detailsBusy&&!c?.printsBusy&&(game!=='ygo'||!window.__uiTestTcg.ui(game).sets.busy)&&c?.entryId==='lot-'+game+'-0'&&document.querySelector('#sheet .cs-title h2')?.textContent===name;},{game,name:CARDS[game][0].name});
 // Let the real cached TCG ensureCard/openSheet continuation complete, then use
 // only connected production nodes. No substitute card markup is injected.
 await frame(page);await page.waitForFunction(()=>{const im=document.querySelector('#sheet .cs-card .card-img');return im?.complete&&im.naturalWidth>0;});
 if(scrollToCard)await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);
}
async function noBrokenActionWords(page,scope){
 const broken=await page.locator(scope).evaluate(root=>{
  const found=[];for(const button of root.querySelectorAll('.btn')){
   if(!button.getClientRects().length)continue;const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);let text;
   while((text=walker.nextNode()))for(const word of text.textContent.matchAll(/[\p{L}\p{N}]+/gu)){
    if(word[0].length<3)continue;const range=document.createRange();range.setStart(text,word.index);range.setEnd(text,word.index+word[0].length);
    const rows=new Set([...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>Math.round(r.top)));if(rows.size>1)found.push({button:button.textContent,word:word[0]});
   }
  }return found;
 });assert.deepEqual(broken,[],'Action labels must wrap between words, never inside Compare/Another/collection');
}
async function remember(page){return page.evaluate(()=>{
 const body=document.querySelector('#sheetBody'),card=body.querySelector('.cs-card');window.__mountedDetail={dialog:document.querySelector('#sheet'),body,card,generation:body.detailMountGeneration,context:window.__uiTestState.ui.sheetCtx,title:body.querySelector('.cs-title h2').textContent,art:card.querySelector('img').src,tab:body.querySelector('[role=tab][aria-selected=true]').id,identity:body.dataset.detailIdentity,choice:JSON.stringify([...body.querySelectorAll('select[data-change="historyEdition"],select[data-change="historyYgoEdition"],select[data-change="cardPriceFinish"]')].map(n=>[n.dataset.change,n.value])),top:body.scrollTop};return {top:body.scrollTop};
});}
async function sameMounted(page){return page.evaluate(()=>{
 const old=window.__mountedDetail,body=document.querySelector('#sheetBody');return {same:old.dialog===document.querySelector('#sheet')&&old.body===body&&old.generation===body.detailMountGeneration&&old.card===body.querySelector('.cs-card')&&old.context===window.__uiTestState.ui.sheetCtx,identity:body.dataset.detailIdentity===old.identity,title:body.querySelector('.cs-title h2').textContent===old.title,art:body.querySelector('.cs-card img').src===old.art,tab:body.querySelector('[role=tab][aria-selected=true]').id===old.tab,choice:JSON.stringify([...body.querySelectorAll('select[data-change="historyEdition"],select[data-change="historyYgoEdition"],select[data-change="cardPriceFinish"]')].map(n=>[n.dataset.change,n.value]))===old.choice,top:body.scrollTop};
});}
async function resizeInPlace(page,game,label){
 const original=await remember(page);assert(original.top>0,'Start at a nonzero reading position, not a trivial top-of-dialog check');
 for(const [width,height] of [[768,1000],[1024,1000],[844,390],[390,1000]]){
  await page.setViewportSize({width,height});await frame(page);const state=await sameMounted(page);
  assert.deepEqual({...state,top:undefined},{same:true,identity:true,title:true,art:true,tab:true,choice:true,top:undefined},`${game} ${label} ${width}: exact mounted card, printing controls and selected tab survive`);
  assert(state.top>0,`${game} ${label} ${width}: resize does not reset reading position`);
  await noOverflow(page,'#sheetBody',`${game} ${label} ${width}`);await noBrokenActionWords(page,'#sheetBody');
  await capture(page,`card-responsive-${game}-${label}-${width}x${height}`);
 }
 // Returning to the original geometry should not lose the reading position.
 const end=await sameMounted(page);assert(Math.abs(end.top-original.top)<=4,`${game} ${label}: round-trip scroll ${original.top} → ${end.top}`);
}
async function choose(page,selector,value){
 const control=page.locator(selector),label=await control.locator('option').evaluateAll((options,v)=>options.find(o=>o.value===v)?.label,value);assert(label);
 await control.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();
 await page.waitForFunction(({selector,value})=>{const n=document.querySelector(selector);return n?.value===value&&[...n.options].find(o=>o.value===value)?.hasAttribute('selected');},{selector,value});await frame(page);
}
async function scrollLifecycle(page,game){
 // A wheel event on the actual scroll surface establishes new reading intent.
 // Returning to a previously visited geometry must not replay its obsolete top.
 await page.evaluate(()=>{document.querySelector('#sheetBody').scrollTop=100;});await frame(page);await remember(page);
 await page.setViewportSize({width:844,height:390});await frame(page);
 const body=page.locator('#sheetBody'),box=await body.boundingBox();assert(box);
 const goal=await body.evaluate(n=>Math.min(n.scrollTop+800,n.scrollHeight-n.clientHeight));assert(goal>200);
 await page.mouse.move(box.x+box.width*.75,box.y+box.height*.75);await page.mouse.wheel(0,800);
 await page.waitForFunction(goal=>Math.abs(document.querySelector('#sheetBody').scrollTop-goal)<=4,goal);await frame(page);
 const latest=await body.evaluate(n=>n.scrollTop);assert(latest>200);
 await page.setViewportSize({width:390,height:1000});await frame(page);
 let state=await sameMounted(page);assert(state.same&&state.identity&&state.tab&&state.choice,game+': user scrolling and rotating retain the same mounted dialog');
 const expected=await body.evaluate((n,latest)=>Math.min(latest,n.scrollHeight-n.clientHeight),latest);
 assert(Math.abs(state.top-expected)<=4,`${game}: latest landscape reading position ${latest}, not old portrait100, survives rotation (${state.top})`);
 // Seed a different portrait position, close in landscape, and reopen the exact
 // same card/tab. #sheetBody persists but this is a fresh content lifetime.
 const seeded=await body.evaluate(n=>(n.scrollTop=Math.min(600,n.scrollHeight-n.clientHeight),n.scrollTop));assert(seeded>100);await frame(page);
 await page.setViewportSize({width:844,height:390});await frame(page);
 await page.evaluate(()=>{const b=document.querySelector('#sheetBody');window.__closedDetail={body:b,card:b.querySelector('.cs-card'),generation:b.detailMountGeneration,identity:b.dataset.detailIdentity};});
 await closeSheet(page);await openCard(page,game,false);
 const reopened=await body.evaluate(n=>({sameBody:n===window.__closedDetail.body,newGeneration:n.detailMountGeneration>window.__closedDetail.generation,newCard:n.querySelector('.cs-card')!==window.__closedDetail.card,sameIdentity:n.dataset.detailIdentity===window.__closedDetail.identity,top:n.scrollTop}));
 assert.deepEqual(reopened,{sameBody:true,newGeneration:true,newCard:true,sameIdentity:true,top:0},game+': close/reopen starts the same card at0 in a fresh mount');
 await remember(page);await page.setViewportSize({width:390,height:1000});await frame(page);state=await sameMounted(page);
 assert(state.same&&state.identity&&state.tab&&state.choice);assert.equal(state.top,0,`${game}: rotation after close/reopen must not restore stale${seeded}`);
 await capture(page,`card-responsive-${game}-reopen-scroll`);
}
async function scenario(game){
 const app=await openApp(browser,server.base,{game,width:390,height:1000}),{page,context}=app;
 try{
  const inventory=await inventorySnapshot(page);await turn(page,30,0);await openCard(page,game);
  assert.equal(await page.locator('dialog.zoom').count(),0,'First open has never visited enlarged artwork');
  const card=page.locator('#sheet .cs-card .cd-img');await turn(page,40,12);
  assert(await card.evaluate(n=>n.classList.contains('gyro')&&n.style.getPropertyValue('--tx')!=='0deg'),'Actual first-open card responds to phone motion without zoom round trip');
  const session=await context.newCDPSession(page),box=await card.boundingBox();assert(box);
  const x=box.x+box.width*.2,y=box.y+Math.min(box.height*.3,70);
  // The real touch stream targets the mounted artwork, then cancels, so it cannot
  // accidentally click Enlarge and mask the first-open regression.
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await frame(page);
  const touch=await card.evaluate(n=>({tx:n.style.getPropertyValue('--tx'),shine:n.classList.contains('shine-once'),transform:getComputedStyle(n).transform}));assert.notEqual(touch.tx,'0deg');assert(!touch.shine);assert.notEqual(touch.transform,'none');
  await turn(page,55,25);assert.equal(await card.evaluate(n=>n.style.getPropertyValue('--tx')),touch.tx,'Phone sample cannot steal transform from active finger');
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await turn(page,60,30);assert(await card.evaluate(n=>n.classList.contains('gyro')));assert.equal(await page.locator('dialog.zoom').count(),0);
  // Reproduce the entrance-animation timing directly on the same real surface.
  await card.evaluate(n=>{n.classList.add('shine-once');const r=n.getBoundingClientRect();n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:r.left+r.width*.2,clientY:r.top+r.height*.2}));});
  assert(!await card.evaluate(n=>n.classList.contains('shine-once')));await card.dispatchEvent('pointercancel',{pointerType:'touch'});
  await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);
  if(game==='ygo'){
   const stat=await page.locator('#sheet .cs-card-side .stat-grid').evaluate(n=>({cols:getComputedStyle(n).gridTemplateColumns.split(' ').length,height:n.getBoundingClientRect().height,count:n.children.length}));assert.equal(stat.cols,2);assert.equal(stat.count,6);assert(stat.height<260,'Six stats no longer form a giant one-stat column');
  }
  await noBrokenActionWords(page,'#sheetBody');
  const largeText=await page.addStyleTag({content:'.card-actions .btn { font-size:18.75px; } .cs-card-side .stat-grid b { font-size:18.75px; }'});await page.setViewportSize({width:320,height:1000});await frame(page);await noOverflow(page,'#sheetBody',game+' larger text');await noBrokenActionWords(page,'#sheetBody');await capture(page,`card-responsive-${game}-larger-text`);await largeText.evaluate(n=>n.remove());await page.setViewportSize({width:390,height:1000});await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);await resizeInPlace(page,game,'overview');
  await scrollLifecycle(page,game);
  // A deliberately selected non-default pricing/printing option must survive the
  // exact same resize round trip while its tab is active.
  await page.evaluate(()=>{window.__beforeResponsivePrices=document.querySelector('#card-sellers');});await page.locator('#card-tab-prices').click();await page.waitForFunction(()=>document.querySelector('#card-tab-prices')?.getAttribute('aria-selected')==='true'&&window.__uiTestState.ui.sheetCtx?.tab==='prices'&&!window.__beforeResponsivePrices.isConnected);await frame(page);
  if(game==='ygo'){await choose(page,'#sheet [data-change="historyEdition"]','SET-001::Super Rare');await choose(page,'#sheet [data-change="historyYgoEdition"]','1st-edition');}
  else await choose(page,'#sheet [data-change="cardPriceFinish"]',game==='mtg'?'foil':'holofoil');
  await page.locator('#sheet #card-sellers').scrollIntoViewIfNeeded();await frame(page);await resizeInPlace(page,game,'selected-printing');
  await closeSheet(page);
  // Actual reused surface audit, not a blanket cosmetic redesign.
  for(const hash of ['#home','#collection','#search','#sets','#decks']){
   await navigate(page,hash);await frame(page);
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await frame(page);await noOverflow(page,'#content',`${game} ${hash} ${width}`);await noBrokenActionWords(page,'#content');}
  }
  await navigate(page,'#decks/ideas');await page.locator('#content [data-act="learnGame"]').first().click();await page.locator('#sheet[open] [data-learning-root]').waitFor();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await frame(page);await noOverflow(page,'#sheetBody',`${game} learning ${width}`);await noBrokenActionWords(page,'#sheetBody');}
  if(game==='ygo'){
   await page.setViewportSize({width:390,height:1000});await page.locator('#sheet [data-learn-start]').click();await page.locator('#sheet .learn-turn-body [data-rule-reference]').click();
   const passage=page.locator('#sheet [data-rule-entry="0-p20"]');await passage.waitFor();const visible=await passage.locator(':scope > .rule-source-text').innerText();assert(visible.startsWith('Turn Structure'));assert(!visible.startsWith('How\nTo\nPlay'));assert(visible.includes('The player who goes first cannot draw during the Draw Phase of their first turn.'));
   await passage.locator('summary').click();assert((await passage.locator('details .rule-source-text').innerText()).startsWith('How\nTo\nPlay\nHow\nTo\nPlay'),'Full canonical extraction is still accessible');
   assert.match(await page.locator('#sheet [data-rule-destination] a[data-source-kind="pdf"]').getAttribute('href'),/#page=20$/);await noOverflow(page,'#sheetBody','Exact YGO page 20');await capture(page,'card-responsive-ygo-source-text');
  }
  assert.equal(await inventorySnapshot(page),inventory,'Presentation/format viewing never changes inventory or deck data');
  report.push(`${game}: actual first-open touch and simulated phone orientation, no zoom detour, compact stats, intact action words, same mounted dialog 390→768→1024→844 landscape→390, latest user scroll across geometries, fresh close/reopen scroll lifetime, selected printing/tab/scroll, and actual Home/Collection/Search/Sets/Decks roots.`);
  await app.close();
 }catch(error){await capture(page,`card-responsive-${game}-failure`).catch(()=>{});await context.close();throw error;}
}
try{
 browser=await chromium.launch();const failures=[];for(const game of GAMES)try{await scenario(game);}catch(error){failures.push(error);report.push(game+': '+String(error.stack||error));}
 const reduced=await openApp(browser,server.base,{game:'ygo',reducedMotion:'reduce'});try{await openCard(reduced.page,'ygo');await turn(reduced.page,30,0);await turn(reduced.page,50,20);assert.equal(await reduced.page.locator('#sheet .cd-img').evaluate(n=>n.classList.contains('gyro')),false);await reduced.close();}catch(error){await reduced.context.close();failures.push(error);}
 if(failures.length)throw new AggregateError(failures,'Actual responsive-card regressions failed');
}catch(error){failure=error;throw error;}finally{await saveReport('card-responsive-browser',report,failure);await browser?.close();await server.close();}
