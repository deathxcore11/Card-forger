import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,CARDS,ISO,capture,noOverflow} from './search-fixtures.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true','Real UI and touch checks are hosted-CI only');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const results=[];let failure;
function seed(fixtures){
 fixtures.state.settings.displayModes=Object.fromEntries(['mtg','ptcg','ygo'].map(game=>[game,{collection:'gallery',search:'gallery',set:'gallery',deck:'gallery'}]));
 for(const game of ['mtg','ptcg','ygo']){
  const side=game==='mtg'?fixtures.state:fixtures.state.tcg[game];
  side.collection=CARDS[game].slice(0,4).map((c,i)=>{
   const base=game==='mtg'?{printingId:c.id,printingVerified:true,finish:'nonfoil',set:c.set,collectorNumber:c.collector_number}:{cardId:c.id,key:'id:'+c.id,...(game==='ptcg'?{variant:c.variants[0].key}:{printing:c.sets[0].code,rarity:c.sets[0].rarity})};
   const e={...base,id:`display-${game}-${i}`,name:c.name,qty:i===2?2:1,condition:i===3?'Damaged':i===0?'Near Mint':'Lightly Played',language:'en',addedAt:ISO};
   if(i===1)e.conditionQuotes=[{...base,condition:e.condition,language:'en',currency:'USD',price:5.67,source:'Fixture condition provider',priceType:'market-reference',priceStatus:'current',checkedAt:ISO,observedAt:ISO,validUntil:'2026-10-18T12:00:00.000Z'}];
   if(i===2)Object.assign(e,{manualValue:25,manualValueCondition:'Lightly Played'});
   if(game==='mtg')fixtures.state.printings[c.id]=c;
   return e;
  });
 }
}
const apply=async(page,size)=>page.evaluate(async size=>(await import('/grid-settings.js')).applyGridSize(size),size);
const columns=page=>page.locator('#content .display-list').first().evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);
const protectedState=page=>page.evaluate(()=>{const s=window.__uiTestState.state,pick=e=>({id:e.id,qty:e.qty,condition:e.condition,manualValue:e.manualValue,printingId:e.printingId,variant:e.variant,finish:e.finish});return JSON.stringify({mtg:s.collection.map(pick),ptcg:s.tcg.ptcg.collection.map(pick),ygo:s.tcg.ygo.collection.map(pick),decks:s.decks,myPrices:s.myPrices});});
async function gesture(page,session,{ratio=1.8,cancel=false,hold=0}={}){
 await page.evaluate(()=>window.scrollTo(0,0));
 const rect=await page.locator('#content .lot-art').first().boundingBox();assert(rect);const x=rect.x+rect.width/2,y=rect.y+Math.min(rect.height/2,150);
 const points=d=>[{x:x-d/2,y,id:1},{x:x+d/2,y,id:2}];
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(50)});
 if(hold){await page.waitForTimeout(hold);assert.equal(await page.locator('dialog[open]').count(),0,'pinch never triggers a long-press card menu');}
 for(let i=1;i<=5;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(50*(1+(ratio-1)*i/5))});await page.waitForTimeout(20);}
 await session.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
}
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390,height:844,prepareFixtures:seed,evidenceLabel:'display-'+game});const {page}=app;
  try{
   const body=await readFile(new URL(`./frame-art/${game}.${game==='ptcg'?'webp':'jpg'}`,import.meta.url));
   await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(r.resourceType()==='image'&&(u.hostname==='search-fixtures.invalid'||u.origin===server.base&&u.pathname.startsWith('/img/')))return route.fulfill({contentType:game==='ptcg'?'image/webp':'image/jpeg',body});return route.fallback();});
   await app.context.route('**/api/prices/conditions?*',route=>{const id=new URL(route.request().url()).searchParams.get('id'),entry=app.fixtures.state[game==='mtg'?'collection':'unused']?.find(e=>e.printingId===id)||app.fixtures.state.tcg[game]?.collection.find(e=>e.cardId===id);return route.fulfill({json:{status:entry?.conditionQuotes?.length?'available':'unpriced',quotes:entry?.conditionQuotes||[]}});});
   await page.locator('.bottom-nav [data-nav="collection"]').tap();await page.locator('#content .display-list .lot').first().waitFor();
   const before=await protectedState(page);
   assert.equal(await page.locator('#content [data-price-origin="personal"]').count(),1,'only the manually entered lot gets a badge');
   const custom=page.locator('.lot').filter({has:page.locator('[data-price-origin="personal"]')});assert.match(await custom.innerText(),/\$50\.00/);
   const condition=page.locator('.lot').filter({has:page.locator('[data-entry="display-'+game+'-1"]')});assert.equal(await condition.locator('[data-price-origin]').count(),0);assert.match(await condition.innerText(),/\$5\.67/);
   assert.match(await condition.locator('.condition-badge').getAttribute('data-condition-info'),/Condition quote.*included/);
   // Settings uses actual controls; grid changes cannot change the underlying view.
   await page.locator('[data-act="menu"]').tap();await page.locator('#settingsTab-app').tap();
   await page.locator('.grid-size-control label:has([value="large"])').tap();await page.waitForFunction(()=>document.documentElement.dataset.gridSize==='large');
   assert.equal(await page.evaluate(()=>localStorage.getItem('cardstashy-grid-size')),'large');
   await page.locator('[data-change="setGridPinch"]').check();await noOverflow(page,'#settingsDialog',game+' grid controls',true);
   await page.keyboard.press('Escape');assert.equal(await columns(page),1);
   const session=await app.context.newCDPSession(page);
   await gesture(page,session,{ratio:.6,hold:650});assert.equal(await page.evaluate(()=>document.documentElement.dataset.gridSize),'medium');assert.equal(await columns(page),2);
   await gesture(page,session,{ratio:.6});assert.equal(await page.evaluate(()=>document.documentElement.dataset.gridSize),'small');assert.equal(await columns(page),3);
   await gesture(page,session,{ratio:1.7,cancel:true});assert.equal(await page.evaluate(()=>document.documentElement.dataset.gridSize),'small','canceled gesture leaves preference unchanged');
   await gesture(page,session,{ratio:1.7});assert.equal(await page.evaluate(()=>document.documentElement.dataset.gridSize),'medium');
   assert.equal(await page.locator('dialog[open]').count(),0,'pinch cannot accidentally open or edit a card');
   assert.equal(await protectedState(page),before,'pinch and settings never alter copies, condition, printing or custom prices');
   await page.reload();await page.locator('#app.ready').waitFor();await page.locator('#content .display-list').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.dataset.gridSize),'medium','size survives reload');assert.equal(await page.evaluate(()=>document.documentElement.dataset.gridPinch),'on');
   for(const mode of ['light','dark','aura']){
    await page.evaluate(async mode=>(await import('/settings-theme.js')).applyTheme(mode),mode);
    for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:844});
     const sizes={};for(const size of ['small','medium','large']){await apply(page,size);await noOverflow(page,'#content',`${game} ${mode} ${width} ${size}`,true);sizes[size]=await columns(page);}
     assert(sizes.small>=sizes.medium&&sizes.medium>=sizes.large,JSON.stringify({game,mode,width,sizes}));
    }
    await page.setViewportSize({width:390,height:844});await apply(page,'medium');await capture(page,`synthetic-search-collection-display-${game}-${mode}`);
   }
   // Default/off mode doesn't intercept native pinch; one-finger events remain free.
   const defaults=await page.evaluate(async()=>{const m=await import('/grid-settings.js');m.applyGridPinch(false);const grid=document.querySelector('#content .display-list'),target=grid.querySelector('.lot-art'),touch=(id,x)=>({identifier:id,target,clientX:x,clientY:300});const e=new Event('touchstart',{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:[touch(1,100),touch(2,160)]});target.dispatchEvent(e);m.applyGridPinch(true);const single=new Event('touchstart',{bubbles:true,cancelable:true});Object.defineProperty(single,'touches',{value:[touch(1,100)]});target.dispatchEvent(single);return {nativePinchPrevented:e.defaultPrevented,singleScrollPrevented:single.defaultPrevented};});assert.deepEqual(defaults,{nativePinchPrevented:false,singleScrollPrevented:false});
   await page.locator('[data-change="tCollTab"]').count();
   await page.locator('[data-act="'+(game==='mtg'?'collTab':'tCollTab')+'"][data-id="value"]').click();await page.locator('.collection-value-page').waitFor();
   await page.locator('.value-price-sources summary').click();
   assert.match(await page.locator('[data-value-source="condition"]').innerText(),/\$5\.67/);assert.match(await page.locator('[data-value-source="personal"]').innerText(),/\$50\.00/);assert.match(await page.locator('[data-value-source="unpriced"]').innerText(),/Excluded/);
   await capture(page,`synthetic-search-collection-sources-${game}`);
   assert.equal(await protectedState(page),before);app.health();results.push({game,modes:['light','dark','aura'],widths:[320,390,768,1440],customCopies:2,customTotal:50,conditionQuote:5.67,touch:'native CDP multi-touch, long-hold cancellation, spread/pinch, canceled gesture, click suppression, persistence',browserZoom:'default pinch path and single-finger scrolling are not prevented'});
  }catch(error){error.fixtureDiagnostics=app.diagnostics();throw error;}finally{await app.context.close();}
 }
}catch(error){failure=error;throw error;}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/collection-display-browser.json',JSON.stringify({status:failure?'failed':'passed',results,error:failure?.stack,diagnostics:failure?.fixtureDiagnostics,evidence:'Hosted Chromium touch emulation; synthetic lots/prices and pinned unchanged real artwork. No physical-device or live-price accuracy claim.'},null,2));await browser.close();await server.close();}
console.log('PASS: price source labels, exact condition quotes, Settings sizes, native multi-touch safety and all-game/theme/size regression.');
