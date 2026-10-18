// Actual app/dialog checks, authorized hosted CI only. No private reference media.
// The local path validates data without importing Playwright or starting a server.
import assert from 'node:assert/strict';
import {GAMES,CARDS,validateFixtures,startServer,openApp,navigate,closeSheet,inventorySnapshot,detailHistoryContext,detailHistoryReady,collectionControlGeometry,collectionRowGeometry,detailMotionState,noOverflow,capture,saveReport} from './detail-rules-fixtures.mjs';
console.log(await validateFixtures());
if(process.argv.includes('--validate-fixtures'))process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Responsive browser execution is restricted to hosted GitHub Actions. Use --validate-fixtures locally.');
const {chromium}=await import('playwright');
const server=await startServer();let browser,failure;const report=[];
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const portrait={width:390,height:600};
async function settledScroll(page){
 await page.evaluate(()=>{window.__responsiveScrollSample=null;});
 await page.waitForFunction(()=>{
  const n=document.querySelector('#sheetBody'),now=performance.now(),value=[n.scrollTop,n.scrollHeight,n.clientHeight].join(':'),old=window.__responsiveScrollSample;
  if(!old||old.value!==value){window.__responsiveScrollSample={value,since:now};return false;}
  return now-old.since>=150;
 });
 return page.locator('#sheetBody').evaluate(n=>({top:n.scrollTop,max:Math.max(0,n.scrollHeight-n.clientHeight),scrollHeight:n.scrollHeight,clientHeight:n.clientHeight}));
}
async function focusedSuggestions(game){
 const app=await openApp(browser,server.base,{game,width:1024,height:1000,hash:'#search'}),{page,context}=app,calls=[];
 try{
  // Intercept only this lookup using each real provider's autocomplete shape.
  // The mounted Search input and production suggestion lifecycle are unchanged.
  await context.route(url=>game==='mtg'?url.hostname==='api.scryfall.com'&&url.pathname==='/cards/autocomplete':game==='ptcg'?url.hostname==='api.tcgdex.net'&&url.pathname==='/v2/en/cards'&&url.searchParams.has('name'):url.hostname==='db.ygoprodeck.com'&&url.pathname.endsWith('/cardinfo.php')&&url.searchParams.has('fname'),async route=>{
   const request=route.request(),url=new URL(request.url()),query=url.searchParams.get(game==='mtg'?'q':game==='ptcg'?'name':'fname');calls.push({method:request.method(),url:request.url(),query});
   const names=['Fold query first','Fold query second'],body=game==='mtg'?{data:names}:game==='ptcg'?names.map((name,i)=>({id:'fold-'+i,name})):{data:names.map(name=>({name}))};
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  const search=page.locator('#content .search-query input[data-suggest]');await search.fill('Fold query');await page.locator('#suggestBox [role=option]').first().waitFor();await page.locator('#suggestBox').evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));await search.press('ArrowDown');
  await page.evaluate(()=>{const input=document.querySelector('#content .search-query input[data-suggest]'),box=document.querySelector('#suggestBox');window.__focusedSuggestion={input,box,options:[...box.children],value:input.value,active:input.getAttribute('aria-activedescendant')};});
  for(const [width,height] of [[320,1000],[768,1000],[844,390],[1024,1000]]){
   await page.setViewportSize({width,height});await frame(page);
   const state=await page.evaluate(()=>{
    const old=window.__focusedSuggestion,input=document.querySelector('#content .search-query input[data-suggest]'),box=document.querySelector('#suggestBox'),a=input.getBoundingClientRect(),b=box?.getBoundingClientRect(),viewport=document.documentElement.clientWidth,w=Math.min(a.width,viewport);
    return {same:input===old.input&&box===old.box&&old.options.every((n,i)=>n===box?.children[i]),focused:document.activeElement===input,value:input.value===old.value,active:input.getAttribute('aria-activedescendant')===old.active&&!!box?.querySelector('#'+old.active+'.on'),input:a.toJSON(),box:b?.toJSON(),viewport,documentWidth:document.documentElement.scrollWidth,expected:{left:Math.max(0,Math.min(a.left,viewport-w)),top:a.bottom+6,width:w}};
   });
   assert(state.same&&state.focused&&state.value&&state.active,`${game} ${width}x${height}: same focused input, popup, options, query and selected option ${JSON.stringify(state)}`);
   assert(state.box&&Math.abs(state.box.left-state.expected.left)<=1&&Math.abs(state.box.top-state.expected.top)<=1&&Math.abs(state.box.width-state.expected.width)<=1,`${game}: popup reanchors to current input ${JSON.stringify(state)}`);
   assert(state.box.left>=-.5&&state.box.right<=state.viewport+.5&&state.documentWidth<=state.viewport+2,`${game}: focused popup fits viewport, not hidden document overflow ${JSON.stringify(state)}`);
   assert.deepEqual(calls.map(({method,query})=>({method,query})),[{method:'GET',query:'Fold query'}],'Fold/rotation keeps exactly one read-only lookup for the unchanged query, never a write or duplicate request');
   await capture(page,`card-responsive-${game}-focused-popup-${width}x${height}`);
  }
  await search.blur();await page.locator('#suggestBox').waitFor({state:'detached'});assert.equal(await search.inputValue(),'Fold query');assert.deepEqual(calls.map(({method,query})=>({method,query})),[{method:'GET',query:'Fold query'}]);
  report.push(`${game}: same focused autocomplete input/listbox/options/keyboard selection through 1024→320→768→844 landscape→1024, strict input/viewport geometry, ordinary blur cleanup and exactly one provider lookup.`);
  await app.close();
 }catch(error){await capture(page,`card-responsive-${game}-focused-popup-failure`).catch(()=>{});await context.close();throw error;}
}
async function turn(page,beta,gamma){await page.evaluate(({beta,gamma})=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta,gamma})),{beta,gamma});await frame(page);}
async function openCard(page,game,scrollToCard=true,onInitial=null,gesture='mouse'){
 await page.evaluate(async()=>{window.__responsivePricing ||= await import('/pricing-presentation.js');window.__responsiveHistory ||= await import('/shared-history.js');window.__responsiveStore ||= await import('/store.js');window.__responsiveFeel ||= await import('/feel.js');});
 if(onInitial)await page.evaluate(()=>{window.__openingPointer=[];window.__openingPointerAbort?.abort();window.__openingPointerAbort=new AbortController();for(const type of ['pointerover','pointermove','pointerdown','pointerup','pointerout','pointercancel','scroll'])document.addEventListener(type,e=>{const card=e.target.closest?.('.cd-img,.lot-art');window.__openingPointer.push({type,trusted:e.isTrusted,pointer:e.pointerType,id:e.pointerId,buttons:e.buttons,x:e.clientX,y:e.clientY,card:card?.className||null,connected:card?.isConnected,top:card?.getBoundingClientRect().top});},{capture:true,passive:true,signal:window.__openingPointerAbort.signal});});
 if(game!=='mtg')assert.equal(await page.evaluate(({game,id})=>window.__uiTestTcg.needsCardRefresh(game,window.__uiTestTcg.cardOf(game,id),true),{game,id:CARDS[game][0].id}),false,'This cached first-open fixture has genuine complete current card data, not an ignored provider hydration');
 const opener=page.locator(`#content .lot-art[data-entry="lot-${game}-0"]`);if(gesture==='touch')await opener.tap();else await opener.click();
 await page.waitForFunction(({game,name})=>{const c=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&!c?.detailsBusy&&!c?.printsBusy&&(game!=='ygo'||!window.__uiTestTcg.ui(game).sets.busy)&&c?.entryId==='lot-'+game+'-0'&&document.querySelector('#sheet .cs-title h2')?.textContent===name;},{game,name:CARDS[game][0].name});
 // Cached ensureCard still has an awaited continuation. History has another
 // real refreshSheet continuation, even while the Overview panel is selected.
 await frame(page);await page.waitForFunction(()=>{const im=document.querySelector('#sheet .cs-card .card-img');return im?.complete&&im.naturalWidth>0;});
 const pending=await page.evaluate(detailHistoryContext,game);
 assert.equal(pending.game,game);assert.equal(pending.id,CARDS[game][0].id);assert.equal(pending.entry,'lot-'+game+'-0');
 if(onInitial)await onInitial();
 await page.waitForFunction(detailHistoryReady);
 // sharedHistory.set is followed by the synchronous real refresh callback;
 // this next polling task therefore observes its completed mount replacement.
 await page.waitForFunction(()=>{const im=document.querySelector('#sheet .cs-card .card-img');return im?.isConnected&&im.complete&&im.naturalWidth>0;});
 const ready=await page.evaluate(()=>{const old=window.__openingDetail,body=document.querySelector('#sheetBody');window.__readyDetail={ctx:old.ctx,body,card:body.querySelector('.cs-card'),generation:body.detailMountGeneration,identity:body.dataset.detailIdentity};return {key:old.key,generation:body.detailMountGeneration,status:window.__responsiveHistory.sharedHistory.get(old.key).status};});
 if(scrollToCard)await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);
 assert(await page.evaluate(()=>{const old=window.__readyDetail,body=document.querySelector('#sheetBody');return old.ctx===window.__uiTestState.ui.sheetCtx&&old.body===body&&old.card===body.querySelector('.cs-card')&&old.card.isConnected&&old.generation===body.detailMountGeneration&&old.identity===body.dataset.detailIdentity;}),'Completed exact history mount remains connected through the original scroll, without retry/reopen');
 report.push(`${game} real detail readiness: ${JSON.stringify({pending,ready})}`);
}
async function noBrokenActionWords(page,scope,selector='.btn'){
 const broken=await page.locator(scope).evaluate((root,selector)=>{
  const found=[];for(const button of root.querySelectorAll(selector)){
   if(!button.getClientRects().length)continue;const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);let text;
   while((text=walker.nextNode()))for(const word of text.textContent.matchAll(/[\p{L}\p{N}]+/gu)){
    if(word[0].length<3)continue;const range=document.createRange();range.setStart(text,word.index);range.setEnd(text,word.index+word[0].length);
    const rows=new Set([...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>Math.round(r.top)));if(rows.size>1)found.push({button:button.textContent,word:word[0]});
   }
  }return found;
 },selector);assert.deepEqual(broken,[],'Labels must wrap between words, never inside Compare/Another/collection or card stat words');
}
async function conditionCollection(game){
 const app=await openApp(browser,server.base,{game,width:320,height:1000}),{page,context}=app,selector='#content .display-list > .lot:has(.condition-badge[data-condition="Lightly Played"])',row=page.locator(selector),allRows=page.locator('#content .display-list > .lot');
 try{
  const inventory=await inventorySnapshot(page);
  const badge=page.locator('.condition-badge[data-condition="Lightly Played"]').first();await badge.focus();await page.locator('#condition-info-tip').waitFor();assert.match(await page.locator('#condition-info-tip').innerText(),/Lightly Played.*Your value/);await page.keyboard.press('Escape');await badge.click();await page.locator('#condition-info-tip').waitFor();const tip=await page.locator('#condition-info-tip').boundingBox();assert(tip.x>=0&&tip.x+tip.width<=320);await page.keyboard.press('Escape');assert.equal(await inventorySnapshot(page),inventory,'Condition information never changes the saved value or quantity');
assert.equal(await row.count(),1,'The real Collection fixture includes its condition-priced lot');assert.equal(await allRows.count(),CARDS[game].length);
  // Quantity controls can be enhanced from glyphs to decorative SVGs; their
  // accessible action names and quantity remain the stable identity contract.
  const snapshot=()=>allRows.evaluateAll(nodes=>nodes.map(n=>({id:n.querySelector('.lot-art').dataset.entry,metadata:n.querySelector('.lot-sub').textContent.replace(/\s+/g,' ').trim(),icons:[...n.querySelectorAll('.lot-sub svg.emb')].map(x=>({role:x.getAttribute('role'),label:x.getAttribute('aria-label'),title:x.querySelector('title')?.textContent,hidden:x.getAttribute('aria-hidden'),parentLabel:x.parentElement.getAttribute('aria-label')})),note:n.querySelector('.condition-badge[data-condition="Lightly Played"]')?.dataset.conditionInfo||null,price:n.querySelector('.price').textContent,quantity:n.querySelector('.stepper b').textContent,actions:[...n.querySelectorAll('.lot-side button')].map(b=>[b.dataset.act,b.dataset.act==='qty'?b.getAttribute('aria-label'):b.textContent,b.getAttribute('aria-label')])}))),original=await snapshot();
  if(game!=='mtg'){const label=game==='ptcg'?'Grass Energy':'LIGHT attribute';assert(original.find(n=>n.note).icons.some(n=>n.role==='img'&&n.label===label&&n.title===label),'The real condition fixture retains its exact accessible Energy/attribute emblem, not just non-rendering title text');}
  const measureRow=async(item,mode,batch,width,previous=false)=>{
   const targetSelector=`#content .display-list > .lot:has(> .lot-art[data-entry="${item.id}"])`;
   await noOverflow(page,targetSelector,`${game} ${mode} ${item.id} ${width} batch ${batch}`,true);
   // Resolve, scroll instantly and measure one exact current node in a single
   // task. No remote row handle survives a stability or animation await.
   const geometry=await page.evaluate(collectionRowGeometry,{id:item.id,game,mode,batch,width,previous,scroll:true});
   assert(geometry.identity.connected&&geometry.identity.current&&geometry.identity.rootConnected&&geometry.identity.unique===1,'Geometry belongs to the exact connected current Collection row');assert.deepEqual(geometry.identity.data,item,'The atomically measured row retains its exact owned metadata, values and actions');
   assert(geometry.identity.scroll.visible&&geometry.identity.scroll.same,'The exact current row is genuinely visible after native scrolling, not hidden or detached');
   if(geometry.identity.previous)assert.deepEqual(geometry.identity.previous,{connected:false,replaced:true},'The real viewSave render replaces the prior node; the strict probe measures its current counterpart');
   assert.deepEqual(geometry.bad,[],`${game} ${mode} ${width} ${item.id}: real visible words fit intact ${JSON.stringify(geometry)}`);return geometry;
  };
  for(const mode of ['compact','symbols']){
   await page.evaluate(selector=>{const nodes=document.querySelectorAll(selector);if(nodes.length!==1||!nodes[0].isConnected)throw Error('Unique connected prior condition row required');window.__conditionPriorRow=nodes[0];},selector);await page.locator(`#content [data-act="viewSave"][data-mode="${mode}"]`).click();await page.waitForFunction(mode=>!window.__conditionPriorRow.isConnected&&document.querySelector('#content').classList.contains('view-'+mode),mode);
   for(const batch of [false,true]){
    if(batch){await page.locator('#content [data-act="batchStart"]').click();await row.locator(':scope > .batch-mark').waitFor();assert.equal(await allRows.locator(':scope > .batch-mark').count(),original.length,'Every owned row participates in the batch layout audit');}
    for(const width of [320,390,560,768,1100]){
     await page.setViewportSize({width,height:1000});await frame(page);
     assert.deepEqual(await snapshot(),original,'Reflow preserves every row metadata/condition word, price, quantity and action');
     // Non-condition batch rows must be measured too: the former 3/5 placement
     // created an implicit fourth symbols track and stretched their steppers.
     for(const item of original.filter(item=>batch||item.note)){
      const geometry=await measureRow(item,mode,batch,width,!!item.note&&!batch&&width===320);
      assert(geometry.words>=1,'Visible printing, condition badge, value and action text is audited; full condition details are checked in the tooltip');assert.deepEqual(geometry.bad,[],`${game} ${mode} ${width} ${item.id}: real visible words fit intact ${JSON.stringify(geometry)}`);
      assert.equal(!!geometry.mark,batch);assert.equal(!!geometry.art,mode==='compact');
      const columns=(mode==='compact'?2:1)+(batch?1:0)+(width>480?1:0);assert.equal(geometry.cols,columns,'Narrow rows retain only the correct explicit artwork/batch columns; wide layout is unchanged');
      assert(Number.isFinite(geometry.contentWidth)&&geometry.contentWidth>0,'Measure the actual row content box, not the viewport or a collapsed intrinsic track');
      if(batch){assert.equal(geometry.containerName,'collection-batch');assert.equal(geometry.containerType,'inline-size');if(width===768)assert(geometry.contentWidth<=480,'The tablet viewport really contains narrow Collection cells');if([560,1100].includes(width))assert(geometry.contentWidth>480,'Roomy one-/two-column cells independently exercise unchanged side placement');}
      const footer=width<=480||(batch&&geometry.contentWidth<=480);
      if(footer)assert(geometry.side.top>=Math.max(geometry.info.bottom,geometry.art?.bottom||0,geometry.mark?.bottom||0)-2&&Math.abs(geometry.side.left-geometry.contentLeft)<=2&&Math.abs(geometry.side.right-geometry.contentRight)<=2&&geometry.info.width>0&&Math.abs(geometry.info.right-geometry.contentRight)<=2&&Math.abs(geometry.info.left-(geometry.art?.right??geometry.mark?.right??geometry.contentLeft)-((geometry.art||geometry.mark)?geometry.columnGap:0))<=2,'Narrow actual cells give metadata the remaining real width and actions a full-width second row');
      else assert(geometry.side.left>=geometry.info.right-2,'Genuinely roomy cells retain their original side column');
      for(const control of geometry.controls)assert(control.rect.width>0&&control.rect.height>0&&control.rect.left>=geometry.side.left-2&&control.rect.right<=geometry.side.right+2&&control.rect.top>=geometry.side.top-2&&control.rect.bottom<=geometry.side.bottom+2,`Actions remain visibly inside their row ${JSON.stringify(control)}`);
      for(const stepper of geometry.steppers)assert(stepper.height<=stepper.buttonHeight+stepper.chrome+2,'Quantity control is not stretched to the metadata row height');
      for(let i=0;i<geometry.footer.length;i++)for(const other of geometry.footer.slice(i+1)){const a=geometry.footer[i];assert(!(Math.min(a.right,other.right)-Math.max(a.left,other.left)>2&&Math.min(a.bottom,other.bottom)-Math.max(a.top,other.top)>2),'Price, quantity, edit and note do not overlap');}
      report.push(`${game} condition/batch ${mode} ${width} batch ${batch} ${item.id}: ${JSON.stringify(geometry)}`);
     }
     if(batch&&[768,1100].includes(width)){await measureRow(original.find(item=>item.note),mode,batch,width);await capture(page,`card-responsive-${game}-batch-${mode}-${width}`);}
     if(width===320){await measureRow(original.find(item=>item.note),mode,batch,width);await capture(page,`card-responsive-${game}-condition-${mode}${batch?'-batch':''}`);if(batch){await measureRow(original.at(-1),mode,batch,width);await capture(page,`card-responsive-${game}-all-batch-${mode}`);}}
    }
    if(batch){await page.locator('#content [data-act="batchStart"]').click();await row.locator(':scope > .batch-mark').waitFor({state:'detached'});}
   }
  }
  assert.equal(await inventorySnapshot(page),inventory,'Changing view/selection mode never changes card quantities, values or inventory');await app.close();
 }catch(error){await capture(page,`card-responsive-${game}-condition-failure`).catch(()=>{});await context.close();throw error;}
}
async function cardColumns(page,game,stacked){
 const geometry=await page.locator('#sheet .cs-card').evaluate(root=>{
  const art=root.querySelector('.cd-art-stack'),side=root.querySelector('.cs-card-side'),a=art.getBoundingClientRect(),s=side.getBoundingClientRect(),grid=side.querySelector('.stat-grid');
  const cellOverflow=[...side.querySelectorAll('.stat-grid > div > *')].filter(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return r.left<p.left-2||r.right>p.right+2||n.scrollWidth>n.clientWidth+2;}).map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON(),client:n.clientWidth,scroll:n.scrollWidth}));
  return {cols:getComputedStyle(root).gridTemplateColumns.split(' ').length,art:a.toJSON(),side:s.toJSON(),artWidth:parseFloat(getComputedStyle(art).width),artClient:art.clientWidth,artScroll:art.scrollWidth,overlap:Math.min(a.right,s.right)-Math.max(a.left,s.left)>2&&Math.min(a.bottom,s.bottom)-Math.max(a.top,s.top)>2,statCols:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:null,cellOverflow};
 });
 assert.equal(geometry.cols,1,`${game}: phone and extreme zoom stack the full card and actions ${JSON.stringify(geometry)}`);assert(geometry.artWidth<=(stacked?220.5:310.5));
 assert(!geometry.overlap&&geometry.artScroll<=geometry.artClient+2,`${game}: real artwork and stats cannot overlap ${JSON.stringify(geometry)}`);
 if(geometry.statCols!==null)assert.equal(geometry.statCols,2,`${game}: retain compact two-column stats`);
 if(stacked){assert(geometry.artWidth<=220.5);assert.deepEqual(geometry.cellOverflow,[],`${game}: real stat content remains inside its own cell`);await noBrokenActionWords(page,'#sheetBody','.btn,.cs-card-side .stat-grid small,.cs-card-side .stat-grid b,.cs-card-side .stat-grid span');}
 report.push(`${game} ${stacked?'320px at 125%':'320px at 100%'} actual card: ${JSON.stringify(geometry)}`);
}
async function collectionRail(page,context,game,width,expectedSort){
 const rail=page.locator('#content .coll-tools > .filter-pills');
 if(!await rail.count()){assert.equal(game,'mtg','TCG Collection must retain its real filter rail');return null;}
 assert(['ptcg','ygo'].includes(game));assert.equal(await rail.count(),1);
 await page.locator('#content').evaluate(async root=>{for(;;){const a=root.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState));if(!a.length)break;await Promise.all(a.map(a=>a.finished.catch(()=>{})));}});
 const snapshot=()=>rail.locator(':scope > select').evaluateAll(nodes=>nodes.map(n=>({change:n.dataset.change,field:n.dataset.field||'',value:n.value,label:n.getAttribute('aria-label')})));
 const controls=await snapshot();assert(controls.length>=3);assert.equal(controls.filter(n=>n.change==='tCollSort').length,1);
 for(const n of controls)assert.equal(n.label,n.change==='tCollSet'?'Set':n.change==='tCollSort'?'Sort':({kind:'Kind',rarity:'Rarity',show:'Show'})[n.field],'Every real filter has its expected nonempty accessible name');
 const originalSort=controls.find(n=>n.change==='tCollSort').value;if(expectedSort!==undefined)assert.equal(originalSort,expectedSort,'Selected sort survives same-page fold/rotation');
 const keyboard=async()=>{
  // A real click establishes the preceding input, then trusted Tab reaches every
  // native select. Never focus/scroll an offscreen select programmatically.
  await page.locator('#content .coll-tools > input').click();
  await page.evaluate(()=>{if(window.__railKeyHandler)document.removeEventListener('keydown',window.__railKeyHandler,true);window.__railKeys=[];window.__railKeyHandler=e=>{if(e.key==='Tab')window.__railKeys.push({trusted:e.isTrusted,key:e.key});};document.addEventListener('keydown',window.__railKeyHandler,true);});
  const measured=[];
  for(const control of await snapshot()){
   await page.keyboard.press('Tab');await frame(page);
   const state=await rail.evaluate(collectionControlGeometry);
   assert(state.inside&&state.change===control.change&&state.field===control.field&&state.value===control.value&&state.accessible&&state.accessible===control.label&&!state.disabled&&state.tabIndex>=0,`Tab reaches the actual accessible selected control ${JSON.stringify(state)}`);
   assert(state.rail.left>=-.5&&state.rail.right<=width+.5&&/^(auto|scroll)$/.test(state.overflow),'Known Collection rail stays locally bounded');
   assert(state.rect.left>=state.rail.left-2&&state.rect.right<=state.rail.right+2&&state.hit,`Keyboard reveals each complete trigger without document scrolling sideways ${JSON.stringify(state)}`);
   assert(state.label&&state.selectedWordWidth<=state.labelWidth+2&&(!state.nowrap||state.selectedTextWidth<=state.labelWidth+2)&&state.requiredTextHeight<=state.labelHeight+2&&!state.ellipsis&&state.scrollWidth<=state.clientWidth+2&&state.scrollHeight<=state.clientHeight+2,`Selected label has intact word space and full height, not hidden clipping ${JSON.stringify(state)}`);measured.push(state);
  }
  const events=await page.evaluate(()=>{document.removeEventListener('keydown',window.__railKeyHandler,true);delete window.__railKeyHandler;return window.__railKeys;});assert.equal(events.length,measured.length);assert(events.every(e=>e.trusted),'Rail keyboard path uses one trusted Tab per control');return measured;
 };
 const keys=await keyboard();
 // Return to the first control using keyboard navigation, not scrollLeft writes.
 for(let i=1;i<controls.length;i++)await page.keyboard.press('Shift+Tab');await frame(page);
 const initial=await rail.evaluate(n=>({left:n.scrollLeft,max:n.scrollWidth-n.clientWidth,rect:n.getBoundingClientRect().toJSON()}));
 let touch=null;
 if(initial.max>2){
  const point=await rail.evaluate(n=>{const r=n.getBoundingClientRect(),x=r.right-28,y=r.bottom-1,hit=document.elementFromPoint(x,y);window.__railTouch=[];window.__railTouchAbort?.abort();window.__railTouchAbort=new AbortController();for(const type of ['touchstart','touchmove','touchend'])n.addEventListener(type,e=>window.__railTouch.push({type,trusted:e.isTrusted,inside:n.contains(e.target)}),{passive:true,signal:window.__railTouchAbort.signal});return {x,y,inside:!!hit&&n.contains(hit)};});
  assert(point.inside,'Trusted pan starts on the actual visible Collection rail');
  const cdp=await context.newCDPSession(page),distance=Math.min(220,initial.rect.width-60);let ended=false;
  try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:7}]});
   for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-distance*i/8,y:point.y,id:7}]});await frame(page);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});ended=true;
  }finally{if(!ended)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});await cdp.detach();await page.evaluate(()=>{window.__railTouchAbort?.abort();delete window.__railTouchAbort;});}
  await page.waitForFunction(before=>document.querySelector('#content .filter-pills').scrollLeft>before+10,initial.left);
  await page.evaluate(()=>{window.__railScrollSample=null;});await page.waitForFunction(()=>{const left=document.querySelector('#content .filter-pills').scrollLeft,now=performance.now(),old=window.__railScrollSample;if(!old||old.left!==left){window.__railScrollSample={left,since:now};return false;}return now-old.since>=100;});
  touch=await rail.evaluate(n=>({left:n.scrollLeft,events:window.__railTouch,game:document.body.dataset.game,view:document.body.dataset.view,hash:location.hash}));
  assert(touch.left>initial.left+10&&touch.events.some(e=>e.type==='touchstart')&&touch.events.some(e=>e.type==='touchmove')&&touch.events.some(e=>e.type==='touchend')&&touch.events.every(e=>e.trusted&&e.inside),`Actual trusted pan moved the local rail ${JSON.stringify(touch)}`);
  assert.equal(touch.game,game);assert.equal(touch.view,'collection');assert.equal(touch.hash,'#collection','Rail gesture never leaks into game/route swipe');
  assert.equal(await page.locator('.glass-select-menu[open]').count(),0,'Pan is not a select activation');
 }
 assert.deepEqual(await snapshot(),controls,'Keyboard access and horizontal pan preserve all current selected filter values');
 await noOverflow(page,'#content',`${game} Collection ${width} original selected state`,true,{game,width,controls});
 const sort=rail.locator('select[data-change="tCollSort"]'),target=await sort.evaluate(n=>{const a=n.getBoundingClientRect(),r=n.parentElement.getBoundingClientRect(),x=a.left+a.width/2,y=a.top+a.height/2;return {x,y,full:a.left>=r.left-2&&a.right<=r.right+2,hit:document.elementFromPoint(x,y)===n,rect:a.toJSON(),rail:r.toJSON(),value:n.value};});
 assert(target.full&&target.hit,`Sort is genuinely fully reachable before tapping, without locator auto-scroll ${JSON.stringify(target)}`);await page.touchscreen.tap(target.x,target.y);
 const menu=page.locator('.glass-select-menu[open]');await menu.waitFor();
 const options=await sort.evaluate(n=>[...n.options].map(o=>({value:o.value,label:o.label}))),selected=options.find(o=>o.value===originalSort);
 const selectedOption=menu.locator('[role=option][aria-selected=true]');assert.equal(await selectedOption.count(),1);assert.equal(await selectedOption.locator('span').first().textContent(),selected.label);assert.equal(await selectedOption.locator('span').last().textContent(),'✓');assert.equal(await selectedOption.locator('span').last().getAttribute('aria-hidden'),'true');assert.equal(await menu.getAttribute('aria-label'),'Sort');
 const selectedGeometry=await selectedOption.evaluate(n=>{const menu=n.closest('dialog'),m=menu.getBoundingClientRect(),r=n.getBoundingClientRect(),label=n.querySelector('span'),l=label.getBoundingClientRect();return {menu:m.toJSON(),row:r.toJSON(),label:l.toJSON(),viewport:innerHeight,labelClient:label.clientWidth,labelScroll:label.scrollWidth};});
 assert(selectedGeometry.menu.top>=-.5&&selectedGeometry.menu.bottom<=selectedGeometry.viewport+.5&&selectedGeometry.row.top>=selectedGeometry.menu.top-2&&selectedGeometry.row.bottom<=selectedGeometry.menu.bottom+2&&selectedGeometry.label.left>=selectedGeometry.row.left-2&&selectedGeometry.label.right<=selectedGeometry.row.right+2&&selectedGeometry.label.top>=selectedGeometry.row.top-2&&selectedGeometry.label.bottom<=selectedGeometry.row.bottom+2&&selectedGeometry.labelScroll<=selectedGeometry.labelClient+2,`Selected menu row and its complete label are visibly contained ${JSON.stringify(selectedGeometry)}`);
 await noOverflow(page,'.glass-select-menu[open]',game+' reachable Collection choices');await noBrokenActionWords(page,'.glass-select-menu[open]','.glass-select-options button');
 // A non-default choice exercises the actual render path; subsequent widths
 // must retain it, and its newly rendered rail must remain keyboard reachable.
 const next=expectedSort===undefined?'name':originalSort,index=options.findIndex(o=>o.value===next);assert(index>=0);
 await page.keyboard.press('Home');for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await menu.waitFor({state:'detached'});
 await page.waitForFunction(value=>document.querySelector('#content select[data-change="tCollSort"]')?.value===value,next);
 const afterKeys=await keyboard(),after=await snapshot();assert.equal(after.find(n=>n.change==='tCollSort').value,next);assert.deepEqual(after.filter(n=>n.change!=='tCollSort'),controls.filter(n=>n.change!=='tCollSort'),'Sort does not change the other selected filters');
 assert.deepEqual(await page.evaluate(()=>({game:document.body.dataset.game,uiGame:window.__uiTestState.state.settings.game,view:window.__uiTestState.ui.view,hash:location.hash})),{game,uiGame:game,view:'collection',hash:'#collection'},'Keyboard/touch selection preserves the current game and route');
 report.push(`${game} Collection ${width}: ${JSON.stringify({initial,keyboard:keys,touch,afterKeyboard:afterKeys,selected:after})}`);
 await capture(page,`card-responsive-${game}-collection-rail-${width}`);
 return {game,width,controls:after};
}
async function remember(page){return page.evaluate(()=>{
 const body=document.querySelector('#sheetBody'),card=body.querySelector('.cs-card');window.__mountedDetail={dialog:document.querySelector('#sheet'),body,card,generation:body.detailMountGeneration,context:window.__uiTestState.ui.sheetCtx,title:body.querySelector('.cs-title h2').textContent,art:card.querySelector('img').src,tab:body.querySelector('[role=tab][aria-selected=true]').id,identity:body.dataset.detailIdentity,choice:JSON.stringify([...body.querySelectorAll('select[data-change="historyEdition"],select[data-change="historyYgoEdition"],select[data-change="cardPriceFinish"]')].map(n=>[n.dataset.change,n.value])),top:body.scrollTop};return {top:body.scrollTop};
});}
async function sameMounted(page){return page.evaluate(()=>{
 const old=window.__mountedDetail,body=document.querySelector('#sheetBody');return {same:old.dialog===document.querySelector('#sheet')&&old.body===body&&old.generation===body.detailMountGeneration&&old.card===body.querySelector('.cs-card')&&old.context===window.__uiTestState.ui.sheetCtx,identity:body.dataset.detailIdentity===old.identity,title:body.querySelector('.cs-title h2').textContent===old.title,art:body.querySelector('.cs-card img').src===old.art,tab:body.querySelector('[role=tab][aria-selected=true]').id===old.tab,choice:JSON.stringify([...body.querySelectorAll('select[data-change="historyEdition"],select[data-change="historyYgoEdition"],select[data-change="cardPriceFinish"]')].map(n=>[n.dataset.change,n.value]))===old.choice,top:body.scrollTop};
});}
async function resizeInPlace(page,game,label){
 // A compact real overview can fit completely at 390x1000. Use a genuinely
 // scrollable phone viewport, not fake filler or scrollIntoView's valid top0.
 await page.setViewportSize(portrait);await settledScroll(page);
 const setup=await page.locator('#sheetBody').evaluate(n=>{const max=n.scrollHeight-n.clientHeight;n.scrollTop=Math.min(max,Math.max(180,n.scrollTop));return {max,top:n.scrollTop};});
 assert(setup.max>0,`${game} ${label}: real content must be scrollable ${JSON.stringify(setup)}`);await settledScroll(page);
 const original=await remember(page);assert(original.top>0,'Start at a nonzero reading position, not a trivial top-of-dialog check');
 for(const [width,height] of [[768,1000],[1024,1000],[844,390],[390,1000],[portrait.width,portrait.height]]){
  await page.setViewportSize({width,height});const scroll=await settledScroll(page),state=await sameMounted(page),expected=Math.min(original.top,scroll.max);
  assert.deepEqual({...state,top:undefined},{same:true,identity:true,title:true,art:true,tab:true,choice:true,top:undefined},`${game} ${label} ${width}: exact mounted card, printing controls and selected tab survive`);
  assert(Math.abs(state.top-expected)<=4,`${game} ${label} ${width}x${height}: preserve reading intent or legitimate content-fit clamp ${JSON.stringify({original:original.top,expected,...scroll})}`);
  report.push(`${game} ${label} ${width}x${height}: ${JSON.stringify({original:original.top,expected,...scroll})}`);
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
 await page.setViewportSize(portrait);await page.evaluate(()=>{document.querySelector('#sheetBody').scrollTop=100;});await settledScroll(page);await remember(page);
 await page.setViewportSize({width:844,height:390});const before=await settledScroll(page),body=page.locator('#sheetBody');
 const point=await body.evaluate(n=>{
  const r=n.getBoundingClientRect(),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom),checked=[];
  for(const fy of [.45,.6,.75,.9,.3])for(const fx of [.7,.5,.3,.88,.12]){
   const x=left+(right-left)*fx,y=top+(bottom-top)*fy,hit=document.elementFromPoint(x,y);let nested=false;
   for(let p=hit;p&&p!==n;p=p.parentElement){const style=getComputedStyle(p);if(/auto|scroll/.test(style.overflowY)&&p.scrollHeight>p.clientHeight+2)nested=true;}
   checked.push({x,y,hit:hit?.tagName+'.'+hit?.className,nested});
   if(hit&&n.contains(hit)&&!nested&&!hit.closest('.cs-tabs,button,input,select,textarea,a,summary')){
    window.__responsiveWheel=null;n.addEventListener('wheel',e=>{window.__responsiveWheel={trusted:e.isTrusted,deltaY:e.deltaY,inside:n.contains(e.target),target:e.target.tagName+'.'+e.target.className};},{once:true,capture:true,passive:true});
    return {x,y,hit:hit.tagName+'.'+hit.className,body:r.toJSON()};
   }
  }return {checked};
 });
 assert(Number.isFinite(point.x),`${game}: find actual visible nonnested scrolling surface ${JSON.stringify(point)}`);assert(before.max>200,`${game}: landscape must have reachable content ${JSON.stringify(before)}`);
 await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,800);
 let after;
 try{await page.waitForFunction(top=>document.querySelector('#sheetBody').scrollTop>top+20,before.top);after=await settledScroll(page);}
 catch(error){report.push(`${game} failed trusted wheel: ${JSON.stringify({before,point,observed:await body.evaluate(n=>({top:n.scrollTop,max:n.scrollHeight-n.clientHeight,wheel:window.__responsiveWheel}))})}`);throw error;}
 const wheel=await page.evaluate(()=>window.__responsiveWheel),latest=after.top;
 report.push(`${game} trusted wheel: ${JSON.stringify({before,point,wheel,after})}`);
 assert(wheel?.trusted&&wheel.inside&&wheel.deltaY===800,`${game}: actual trusted wheel reached the verified sheet ${JSON.stringify(wheel)}`);assert(latest>200);
 // Crossing the real 110px sticky-title threshold can change native anchoring.
 // The observed settled user position, not guessed oldTop+800, is the intent.
 await page.setViewportSize(portrait);await settledScroll(page);
 let state=await sameMounted(page);assert(state.same&&state.identity&&state.tab&&state.choice,game+': user scrolling and rotating retain the same mounted dialog');
 const expected=await body.evaluate((n,latest)=>Math.min(latest,n.scrollHeight-n.clientHeight),latest);
 assert(Math.abs(state.top-expected)<=4,`${game}: latest landscape reading position ${latest}, not old portrait100, survives rotation (${state.top})`);
 await page.setViewportSize({width:844,height:390});await settledScroll(page);state=await sameMounted(page);
 assert(state.same&&state.identity&&state.tab&&state.choice);assert(Math.abs(state.top-latest)<=4,`${game}: returning to the user's landscape geometry restores actual latest${latest}, not obsolete100 (${state.top})`);
 await page.setViewportSize(portrait);await settledScroll(page);
 // Seed a different portrait position, close in landscape, and reopen the exact
 // same card/tab. #sheetBody persists but this is a fresh content lifetime.
 const seeded=await body.evaluate(n=>(n.scrollTop=Math.min(600,n.scrollHeight-n.clientHeight),n.scrollTop));assert(seeded>100);await frame(page);
 await page.setViewportSize({width:844,height:390});await frame(page);
 await page.evaluate(()=>{const b=document.querySelector('#sheetBody');window.__closedDetail={body:b,card:b.querySelector('.cs-card'),generation:b.detailMountGeneration,identity:b.dataset.detailIdentity};});
 await closeSheet(page);await openCard(page,game,false);
 const reopened=await body.evaluate(n=>({sameBody:n===window.__closedDetail.body,newGeneration:n.detailMountGeneration>window.__closedDetail.generation,newCard:n.querySelector('.cs-card')!==window.__closedDetail.card,sameIdentity:n.dataset.detailIdentity===window.__closedDetail.identity,top:n.scrollTop}));
 assert.deepEqual(reopened,{sameBody:true,newGeneration:true,newCard:true,sameIdentity:true,top:0},game+': close/reopen starts the same card at0 in a fresh mount');
 await remember(page);await page.setViewportSize(portrait);await settledScroll(page);state=await sameMounted(page);
 assert(state.same&&state.identity&&state.tab&&state.choice);assert.equal(state.top,0,`${game}: rotation after close/reopen must not restore stale${seeded}`);
 await capture(page,`card-responsive-${game}-reopen-scroll`);
}
async function scenario(game){
 const app=await openApp(browser,server.base,{game,width:390,height:1000}),{page,context}=app;
 try{
  const inventory=await inventorySnapshot(page);await turn(page,30,0);
  const held=game==='ptcg'?app.hold(url=>url.origin===server.base&&url.pathname==='/api/prices/archive'&&url.searchParams.get('game')==='ptcg'&&url.searchParams.get('id')===CARDS.ptcg[0].id&&url.searchParams.get('finish')==='normal'):null;
  try{await openCard(page,game,true,held?async()=>{
   let timeout;try{await Promise.race([held.seen,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('The exact initial Pokémon archive request was not observed')),15000);})]);}finally{clearTimeout(timeout);}
   assert.equal(await page.locator('dialog.zoom').count(),0);
   const before=await page.evaluate(()=>{const old=window.__openingDetail,card=old.card.querySelector('.cd-img'),r=card.getBoundingClientRect();window.__heldInitial={ctx:old.ctx,body:old.body,card,generation:old.body.detailMountGeneration,identity:old.identity};return {rect:r.toJSON(),foreground:window.__responsiveFeel.motionCard()===card,foregroundDialog:[...document.querySelectorAll('dialog[open]')].at(-1)?.id,hover:card.matches(':hover'),hovered:[...document.querySelectorAll(':hover')].slice(-4).map(n=>n.tagName+'.'+n.className),gyro:card.classList.contains('gyro'),tx:card.style.getPropertyValue('--tx'),pointer:window.__openingPointer};});report.push('ptcg held before original scroll: '+JSON.stringify(before));
   // Preserve the original first-open visibility setup while the exact history
   // response is still held. Scrolling also ends any mouse-owned hover transform.
   await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);await turn(page,35,6);
   const initial=await page.evaluate(()=>{const old=window.__heldInitial,body=document.querySelector('#sheetBody'),card=body.querySelector('.cs-card .cd-img'),r=card.getBoundingClientRect(),sheet=body.getBoundingClientRect();return {connected:card.isConnected,same:card===old.card&&body===old.body&&old.ctx===window.__uiTestState.ui.sheetCtx&&body.detailMountGeneration===old.generation&&body.dataset.detailIdentity===old.identity,foreground:window.__responsiveFeel.motionCard()===card,foregroundDialog:[...document.querySelectorAll('dialog[open]')].at(-1)?.id,visible:r.bottom>Math.max(0,sheet.top)&&r.top<Math.min(innerHeight,sheet.bottom)&&r.right>0&&r.left<innerWidth,rect:r.toJSON(),hover:card.matches(':hover'),hovered:[...document.querySelectorAll(':hover')].slice(-4).map(n=>n.tagName+'.'+n.className),pointer:window.__openingPointer,gyro:card.classList.contains('gyro'),tx:card.style.getPropertyValue('--tx'),history:window.__responsiveHistory.sharedHistory.get(window.__openingDetail.key)?.checked||null,generation:body.detailMountGeneration};});
   assert(initial.same&&initial.foreground&&initial.foregroundDialog==='sheet'&&initial.visible,`Held initial card stays mounted and is actually visible in the foreground ${JSON.stringify(initial)}`);
   assert(initial.connected&&initial.gyro&&initial.tx!=='0deg'&&!initial.history,`Initial cached card tilts before its held history response can replace it ${JSON.stringify(initial)}`);report.push('ptcg held initial tilt: '+JSON.stringify(initial));held.release();
  }:null,held?'touch':'mouse');}finally{held?.release();}
  if(held){
   const replacement=await page.evaluate(()=>{const old=window.__heldInitial,body=document.querySelector('#sheetBody'),card=body.querySelector('.cs-card .cd-img');window.__motionProof={ctx:old.ctx,body,card,generation:body.detailMountGeneration,identity:body.dataset.detailIdentity};return {sameContext:old.ctx===window.__uiTestState.ui.sheetCtx,sameBody:body===old.body,sameIdentity:body.dataset.detailIdentity===old.identity,newMount:body.detailMountGeneration>old.generation,newCard:card!==old.card,oldDetached:!old.card.isConnected,connected:card.isConnected};});
   assert.deepEqual(replacement,{sameContext:true,sameBody:true,sameIdentity:true,newMount:true,newCard:true,oldDetached:true,connected:true});
   const probe=async label=>{const value=await page.evaluate(detailMotionState);report.push('ptcg replacement '+label+': '+JSON.stringify(value));assert(value.same&&value.connected&&value.foreground&&value.foregroundDialog==='sheet'&&value.visible,`Exact replacement is visible and foreground throughout ${label}: ${JSON.stringify(value)}`);return value;};
   const before=await probe('before calibration');assert(before.pointer.some(e=>e.type==='pointerdown'&&e.pointer==='touch'&&e.trusted&&e.card?.includes('lot-art')),'The held phone case genuinely opens with trusted touch, not a stationary mouse hover');
   await turn(page,45,15);const calibrated=await probe('calibrated');assert(calibrated.gyro&&Number.isFinite(parseFloat(calibrated.tx))&&Number.isFinite(parseFloat(calibrated.ty)),'Replacement binds its own resting angle; zero is valid for calibration');
   await turn(page,55,28);const moved=await probe('distinct sample');assert(moved.gyro&&moved.tx!=='0deg'&&moved.tx!==calibrated.tx,'A different orientation moves the same replacement mount after calibration, without enlarged artwork');
   // Independently preserve genuine desktop pointer ownership. A sensor event
   // cannot steal its transform; exiting the card resumes this same mount.
   const {x,y}=await page.evaluate(()=>{const card=window.__motionProof.card,r=card.getBoundingClientRect(),body=document.querySelector('#sheetBody').getBoundingClientRect(),rail=document.querySelector('#sheet .cs-tabs').getBoundingClientRect();const top=Math.max(r.top,body.top,rail.bottom),bottom=Math.min(r.bottom,body.bottom,innerHeight);if(bottom-top<44)throw Error('Replacement card must expose a usable pointer surface below navigation');const x=r.left+r.width*.2,y=top+Math.min(40,(bottom-top)/2);return {x,y};});
   assert(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.cd-img')===window.__motionProof.card,{x,y}),'Mouse proof hits the actual visible replacement card');
   await page.mouse.move(x,y);await frame(page);const owned=await probe('mouse owned');assert(owned.hover&&owned.pointer.some(e=>e.type==='pointermove'&&e.pointer==='mouse'&&e.trusted&&e.card?.includes('cd-img')),'Trusted mouse owns the real replacement card');assert(Number.isFinite(parseFloat(owned.tx))&&owned.tx!=='0deg'&&(owned.tx!==moved.tx||owned.ty!==moved.ty),'Trusted mouse movement actually changes the preceding sensor transform');
   await turn(page,60,35);const suppressed=await probe('sensor while mouse owned');assert.equal(suppressed.tx,owned.tx);assert.equal(suppressed.ty,owned.ty,'Sensor cannot overwrite either mouse-owned axis');
   await page.mouse.move(1,1);await turn(page,65,40);const resumed=await probe('mouse exit');assert(!resumed.hover&&resumed.gyro&&resumed.tx!=='0deg'&&resumed.tx!==owned.tx&&resumed.pointer.some(e=>e.type==='pointerout'&&e.pointer==='mouse'&&e.trusted&&e.card?.includes('cd-img')),'Trusted exit resumes phone motion on the exact same mount');
   report.push('ptcg real history replacement tilt: '+JSON.stringify(replacement));
  }
  await page.evaluate(()=>{window.__openingPointerAbort?.abort();delete window.__openingPointerAbort;});
  assert.equal(await page.locator('dialog.zoom').count(),0,'First open has never visited enlarged artwork');
  const card=page.locator('#sheet .cs-card .cd-img');await turn(page,40,12);
  assert(await card.evaluate(n=>n.classList.contains('gyro')&&n.style.getPropertyValue('--tx')!=='0deg'),'Actual first-open card responds to phone motion without zoom round trip');
  const session=await context.newCDPSession(page),box=await card.boundingBox();assert(box);
  const {x,y}=await card.evaluate(card=>{const r=card.getBoundingClientRect(),body=document.querySelector('#sheetBody').getBoundingClientRect(),rail=document.querySelector('#sheet .cs-tabs').getBoundingClientRect(),top=Math.max(r.top,body.top,rail.bottom),bottom=Math.min(r.bottom,body.bottom,innerHeight);if(bottom-top<44)throw Error('Card must expose a usable touch surface below navigation');return {x:r.left+r.width*.2,y:top+Math.min(70,(bottom-top)/2)};});
  assert(await card.evaluate((card,{x,y})=>document.elementFromPoint(x,y)?.closest('.cd-img')===card,{x,y}),'Trusted touch hits the visible interactive card, not its sticky navigation');
  // The real touch stream targets the mounted artwork, then cancels, so it cannot
  // accidentally click Enlarge and mask the first-open regression.
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await frame(page);
  const touch=await card.evaluate(n=>({tx:n.style.getPropertyValue('--tx'),shine:n.classList.contains('shine-once'),tilting:n.classList.contains('tilting'),transform:getComputedStyle(n).transform}));assert(touch.tilting,'Trusted finger owns the card before the sensor sample');assert.notEqual(touch.tx,'0deg');assert(!touch.shine);assert.notEqual(touch.transform,'none');
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
  const largeText=await page.addStyleTag({content:'.card-actions .btn { font-size:18.75px; } .cs-card-side .stat-grid b { font-size:18.75px; }'});await page.setViewportSize({width:320,height:1000});await frame(page);await noOverflow(page,'#sheetBody',game+' larger text');await noBrokenActionWords(page,'#sheetBody');await capture(page,`card-responsive-${game}-larger-text`);await largeText.evaluate(n=>n.remove());
  await frame(page);await cardColumns(page,game,false);
  // Keep the generic long-label tilt stress test, and independently exercise
  // each real production card (including Pokémon's actual full-row .stat-reg).
  const priorZoom=await page.evaluate(()=>document.body.style.zoom);
  try{
   await page.evaluate(()=>{document.body.style.zoom='1.25';});await frame(page);await noOverflow(page,'#sheetBody',game+' actual 320px at 125%');await cardColumns(page,game,true);await noBrokenActionWords(page,'#sheetBody');
   for(const [selector,suffix]of [['.cd-art-stack','-art'],['.cs-card-side',''],['.card-actions','-actions']]){await page.locator('#sheet '+selector).scrollIntoViewIfNeeded();await frame(page);await capture(page,`card-responsive-${game}-zoom125${suffix}`);}
  }finally{await page.evaluate(value=>{document.body.style.zoom=value;},priorZoom);}
  await frame(page);await cardColumns(page,game,false);await page.setViewportSize({width:390,height:1000});await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);await resizeInPlace(page,game,'overview');
  await scrollLifecycle(page,game);
  // A deliberately selected non-default pricing/printing option must survive the
  // exact same resize round trip while its tab is active.
  await page.evaluate(()=>{window.__beforeResponsivePrices=document.querySelector('#card-sellers');});await page.locator('#card-tab-prices').click();await page.waitForFunction(()=>document.querySelector('#card-tab-prices')?.getAttribute('aria-selected')==='true'&&window.__uiTestState.ui.sheetCtx?.tab==='prices'&&!window.__beforeResponsivePrices.isConnected);await frame(page);
  if(game==='ygo'){await choose(page,'#sheet [data-change="historyEdition"]','SET-001::Super Rare');await choose(page,'#sheet [data-change="historyYgoEdition"]','1st-edition');}
  else await choose(page,'#sheet [data-change="cardPriceFinish"]',game==='mtg'?'foil':'holofoil');
  await page.evaluate(()=>document.querySelector('#sheet #card-sellers').scrollIntoView({block:'nearest',behavior:'instant'}));await frame(page);await resizeInPlace(page,game,'selected-printing');
  await closeSheet(page);
  // Actual reused surface audit, not a blanket cosmetic redesign.
  for(const hash of ['#home','#collection','#search','#sets','#decks']){
   await navigate(page,hash);await frame(page);let railAudit=null;
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await frame(page);if(hash==='#collection')railAudit=await collectionRail(page,context,game,width,railAudit?.controls.find(n=>n.change==='tCollSort')?.value);await noOverflow(page,'#content',`${game} ${hash} ${width}`,true,railAudit);await noBrokenActionWords(page,'#content');}
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
  report.push(`${game}: actual first-open touch and simulated phone orientation, no zoom detour, compact stats, intact action words, same mounted dialog 390x600→768→1024→844 landscape→390x1000→390x600 with exact clamp/roundtrip, actual latest trusted user scroll across geometries, fresh close/reopen scroll lifetime, selected printing/tab/scroll, and actual Home/Collection/Search/Sets/Decks roots.`);
  await app.close();
 }catch(error){await page.evaluate(()=>{window.__openingPointerAbort?.abort();delete window.__openingPointerAbort;}).catch(()=>{});await capture(page,`card-responsive-${game}-failure`).catch(()=>{});await context.close();throw error;}
}
try{
 browser=await chromium.launch();const failures=[];for(const game of GAMES)for(const check of [focusedSuggestions,scenario,conditionCollection])try{await check(game);}catch(error){failures.push(error);report.push(game+' '+check.name+': '+String(error.stack||error));}
 const reduced=await openApp(browser,server.base,{game:'ygo',reducedMotion:'reduce'});try{await openCard(reduced.page,'ygo');await turn(reduced.page,30,0);await turn(reduced.page,50,20);assert.equal(await reduced.page.locator('#sheet .cd-img').evaluate(n=>n.classList.contains('gyro')),false);await reduced.close();}catch(error){await reduced.context.close();failures.push(error);}
 if(failures.length)throw new AggregateError(failures,'Actual responsive-card regressions failed');
}catch(error){failure=error;throw error;}finally{await saveReport('card-responsive-browser',report,failure);await browser?.close();await server.close();}
