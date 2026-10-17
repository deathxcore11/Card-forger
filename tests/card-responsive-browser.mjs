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
 const app=await openApp(browser,server.base,{game,width:1024,height:1000,hash:'#home'}),{page,context}=app,calls=[];
 try{
  // Intercept only this lookup using each real provider's autocomplete shape.
  // The mounted Home input and production suggestion lifecycle are unchanged.
  await context.route(url=>game==='mtg'?url.hostname==='api.scryfall.com'&&url.pathname==='/cards/autocomplete':game==='ptcg'?url.hostname==='api.tcgdex.net'&&url.pathname==='/v2/en/cards'&&url.searchParams.has('name'):url.hostname==='db.ygoprodeck.com'&&url.pathname.endsWith('/cardinfo.php')&&url.searchParams.has('fname'),async route=>{
   const request=route.request(),url=new URL(request.url()),query=url.searchParams.get(game==='mtg'?'q':game==='ptcg'?'name':'fname');calls.push({method:request.method(),url:request.url(),query});
   const names=['Fold query first','Fold query second'],body=game==='mtg'?{data:names}:game==='ptcg'?names.map((name,i)=>({id:'fold-'+i,name})):{data:names.map(name=>({name}))};
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  const search=page.locator('#homeQ');await search.fill('Fold query');await page.locator('#suggestBox [role=option]').first().waitFor();await page.locator('#suggestBox').evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));await search.press('ArrowDown');
  await page.evaluate(()=>{const input=document.querySelector('#homeQ'),box=document.querySelector('#suggestBox');window.__focusedSuggestion={input,box,options:[...box.children],value:input.value,active:input.getAttribute('aria-activedescendant')};});
  for(const [width,height] of [[320,1000],[768,1000],[844,390],[1024,1000]]){
   await page.setViewportSize({width,height});await frame(page);
   const state=await page.evaluate(()=>{
    const old=window.__focusedSuggestion,input=document.querySelector('#homeQ'),box=document.querySelector('#suggestBox'),a=input.getBoundingClientRect(),b=box?.getBoundingClientRect(),viewport=document.documentElement.clientWidth,w=Math.min(a.width,viewport);
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
async function openCard(page,game,scrollToCard=true){
 await page.locator(`#content .lot-art[data-entry="lot-${game}-0"]`).click();
 await page.waitForFunction(({game,name})=>{const c=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&!c?.detailsBusy&&!c?.printsBusy&&(game!=='ygo'||!window.__uiTestTcg.ui(game).sets.busy)&&c?.entryId==='lot-'+game+'-0'&&document.querySelector('#sheet .cs-title h2')?.textContent===name;},{game,name:CARDS[game][0].name});
 // Let the real cached TCG ensureCard/openSheet continuation complete, then use
 // only connected production nodes. No substitute card markup is injected.
 await frame(page);await page.waitForFunction(()=>{const im=document.querySelector('#sheet .cs-card .card-img');return im?.complete&&im.naturalWidth>0;});
 if(scrollToCard)await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);
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
async function cardColumns(page,game,stacked){
 const geometry=await page.locator('#sheet .cs-card').evaluate(root=>{
  const art=root.querySelector('.cd-art-stack'),side=root.querySelector('.cs-card-side'),a=art.getBoundingClientRect(),s=side.getBoundingClientRect(),grid=side.querySelector('.stat-grid');
  const cellOverflow=[...side.querySelectorAll('.stat-grid > div > *')].filter(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return r.left<p.left-2||r.right>p.right+2||n.scrollWidth>n.clientWidth+2;}).map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON(),client:n.clientWidth,scroll:n.scrollWidth}));
  return {cols:getComputedStyle(root).gridTemplateColumns.split(' ').length,art:a.toJSON(),side:s.toJSON(),artWidth:parseFloat(getComputedStyle(art).width),artClient:art.clientWidth,artScroll:art.scrollWidth,overlap:Math.min(a.right,s.right)-Math.max(a.left,s.left)>2&&Math.min(a.bottom,s.bottom)-Math.max(a.top,s.top)>2,statCols:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:null,cellOverflow};
 });
 assert.equal(geometry.cols,stacked?1:2,`${game}: extreme zoom stacks while ordinary 320px keeps the two-column card ${JSON.stringify(geometry)}`);
 assert(!geometry.overlap&&geometry.artScroll<=geometry.artClient+2,`${game}: real artwork and stats cannot overlap ${JSON.stringify(geometry)}`);
 if(geometry.statCols!==null)assert.equal(geometry.statCols,2,`${game}: retain compact two-column stats`);
 if(stacked){assert(geometry.artWidth<=220.5);assert.deepEqual(geometry.cellOverflow,[],`${game}: real stat content remains inside its own cell`);await noBrokenActionWords(page,'#sheetBody','.btn,.cs-card-side .stat-grid small,.cs-card-side .stat-grid b,.cs-card-side .stat-grid span');}
 report.push(`${game} ${stacked?'320px at 125%':'320px at 100%'} actual card: ${JSON.stringify(geometry)}`);
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
  const largeText=await page.addStyleTag({content:'.card-actions .btn { font-size:18.75px; } .cs-card-side .stat-grid b { font-size:18.75px; }'});await page.setViewportSize({width:320,height:1000});await frame(page);await noOverflow(page,'#sheetBody',game+' larger text');await noBrokenActionWords(page,'#sheetBody');await capture(page,`card-responsive-${game}-larger-text`);await largeText.evaluate(n=>n.remove());
  await frame(page);await cardColumns(page,game,false);
  // Keep the generic long-label tilt stress test, and independently exercise
  // each real production card (including Pokémon's actual full-row .stat-reg).
  const priorZoom=await page.evaluate(()=>document.body.style.zoom);
  try{
   await page.evaluate(()=>{document.body.style.zoom='1.25';});await frame(page);await noOverflow(page,'#sheetBody',game+' actual 320px at 125%');await cardColumns(page,game,true);await noBrokenActionWords(page,'#sheetBody');await capture(page,`card-responsive-${game}-zoom125`);
  }finally{await page.evaluate(value=>{document.body.style.zoom=value;},priorZoom);}
  await frame(page);await cardColumns(page,game,false);await page.setViewportSize({width:390,height:1000});await page.locator('#sheet .cs-card').scrollIntoViewIfNeeded();await frame(page);await resizeInPlace(page,game,'overview');
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
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await frame(page);await noOverflow(page,'#content',`${game} ${hash} ${width}`,true);await noBrokenActionWords(page,'#content');}
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
 }catch(error){await capture(page,`card-responsive-${game}-failure`).catch(()=>{});await context.close();throw error;}
}
try{
 browser=await chromium.launch();const failures=[];for(const game of GAMES)for(const check of [focusedSuggestions,scenario])try{await check(game);}catch(error){failures.push(error);report.push(game+' '+check.name+': '+String(error.stack||error));}
 const reduced=await openApp(browser,server.base,{game:'ygo',reducedMotion:'reduce'});try{await openCard(reduced.page,'ygo');await turn(reduced.page,30,0);await turn(reduced.page,50,20);assert.equal(await reduced.page.locator('#sheet .cd-img').evaluate(n=>n.classList.contains('gyro')),false);await reduced.close();}catch(error){await reduced.context.close();failures.push(error);}
 if(failures.length)throw new AggregateError(failures,'Actual responsive-card regressions failed');
}catch(error){failure=error;throw error;}finally{await saveReport('card-responsive-browser',report,failure);await browser?.close();await server.close();}
