// Public retained art + synthetic finish selection. No physical foil claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizePtcg} from '../ptcg.js';
import {resolveFinish,FINISH_MASKS} from '../finish-effects.js';
import {startServer,openSearchApp,inventorySnapshot,noOverflow} from './search-fixtures.mjs';
const ids=['sm11-6','sm11-7','sm11-9'];
const originals=ids.map(id=>JSON.parse(fs.readFileSync(`tests/fixtures/${id}-finish.json`)));
// Current sm11-6 provider snapshot lacks reverse availability. Preserve it above;
// reproduce the user's selected reverse only in this explicitly synthetic fixture.
const sources=originals.map(s=>({...s,variants:{normal:true,reverse:true},variants_detailed:[{type:'normal',size:'standard',variantId:'fixture-normal'},{type:'reverse',size:'standard',variantId:'fixture-reverse'}],pricing:undefined}));
for(const [i,s]of sources.entries()){
 const c=normalizePtcg(s),p=resolveFinish('ptcg',c,{priceFinish:'reverse-holofoil'});
 assert.equal(p.layers[0].mask,i===2?'pk-sm-evolved-surround':'pk-sm-surround');
 assert.equal(resolveFinish('ptcg',c,{priceFinish:'normal'}).layers.length,0);
}
assert.equal(normalizePtcg(originals[0]).variants.some(v=>v.finish==='reverse-holofoil'),false,'Retained provider limitation stays explicit');
if(process.argv.includes('--validate-fixtures')){console.log('PASS: SM geometry fixtures; original source availability retained separately from synthetic selected reverse.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted CI only');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
fs.mkdirSync('test-results',{recursive:true});
const report={candidateSha:process.env.GITHUB_SHA,status:'FAIL',cases:[],scroll:[],limits:'Hosted touch emulation; source artwork with synthetic reverse choices. Not physical phone/foil proof or whole-catalogue coverage.'};let app;
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settle=page=>page.evaluate(()=>new Promise((resolve,reject)=>{const root=document.querySelector('#sheetBody');let quiet;const timeout=setTimeout(()=>{observer.disconnect();reject(Error('Detail did not settle'));},4000);const ready=()=>{clearTimeout(quiet);quiet=setTimeout(()=>{observer.disconnect();clearTimeout(timeout);resolve();},250);};const observer=new MutationObserver(ready);observer.observe(root,{childList:true,subtree:true});ready();}));
async function pan(page,context,x,y,dx,dy,{cancel=false}={}){
 const cdp=await context.newCDPSession(page);
 await page.evaluate(()=>{window.__foldTouches=[];window.__foldTouchAbort?.abort();window.__foldTouchAbort=new AbortController();for(const t of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(t,e=>window.__foldTouches.push({type:e.type,trusted:e.isTrusted}),{passive:true,capture:true,signal:window.__foldTouchAbort.signal});});
 try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*n/10,y:y+dy*n/10,id:1}]});await frame(page);}await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await frame(page);}
 finally{await cdp.detach();}
 const events=await page.evaluate(()=>window.__foldTouches);assert(events.some(e=>e.type==='touchmove')&&events.every(e=>e.trusted),'Trusted touch stream reached the page');return events;
}
const background=page=>page.evaluate(()=>({x:scrollX,y:scrollY,bodyX:document.body.scrollLeft,bodyY:document.body.scrollTop,anchor:document.querySelector('#content').getBoundingClientRect().top}));
async function pixelRegions(page,a,b){return page.evaluate(async({a,b})=>{async function read(s){const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return {w:c.width,h:c.height,d:x.getImageData(0,0,c.width,c.height).data};}const x=await read(a),y=await read(b);const zones={art:[.08,.10,.92,.47],topEdge:[.2,.10,.8,.12],leftEdge:[.071,.18,.08,.44],caption:[.2,.481,.8,.5],belowFrame:[.2,.512,.8,.522],body:[.2,.6,.8,.8]};return Object.fromEntries(Object.entries(zones).map(([key,r])=>{let sum=0,n=0,changed=0;for(let j=Math.ceil(x.h*r[1]);j<Math.floor(x.h*r[3]);j++)for(let i=Math.ceil(x.w*r[0]);i<Math.floor(x.w*r[2]);i++){const k=(j*x.w+i)*4;const delta=Math.abs(x.d[k]-y.d[k])+Math.abs(x.d[k+1]-y.d[k+1])+Math.abs(x.d[k+2]-y.d[k+2]);sum+=delta;if(delta>3)changed++;n++;}return [key,{mean:sum/(n*3),changedFraction:changed/n}];}));},{a:a.toString('base64'),b:b.toString('base64')});}
try{
 const extras=Array.from({length:28},(_,i)=>({...sources[0],id:'fold-fixture-'+i,name:'Sewaddle fixture '+i}));const search=[...extras.slice(0,12),...sources,...extras.slice(12)];
 app=await openSearchApp(browser,server.base,{game:'ptcg',width:768,height:900,evidenceLabel:'foil-fold',prepareFixtures:f=>{for(const s of search)f.cache.ptcg[s.id]=normalizePtcg(s);},providerOverride:(u,r)=>{
  if(r.resourceType()==='image')for(const s of originals)if(u.href.startsWith(s.image)||u.pathname.includes('/'+s.id+'.'))return {body:fs.readFileSync(`tests/frame-art/${s.id}.webp`),contentType:'image/webp'};
  if(u.hostname==='api.tcgdex.net'&&u.pathname==='/v2/en/cards')return search;
  if(u.hostname==='api.tcgdex.net'&&u.pathname.startsWith('/v2/en/cards/'))return search.find(s=>u.pathname.endsWith('/'+s.id));
 }});
 const {page,context}=app;await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('[data-act="menu"]').tap();await page.locator('#settingsTab-app').tap();await page.locator('[data-change="setGlass"]').check();await page.locator('[data-act="closeSettings"]').click();
 const q=page.locator('[data-input="tQ"]');await q.fill('Sewaddle');await q.press('Enter');const before=await inventorySnapshot(page);
 for(const id of ids){
  await page.locator(`#content [data-act="tCard"][data-id="${id}"]`).first().click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.previewBusy===false);await page.locator('#sheetBody [data-finish="reverse-holofoil"]').click();
  for(const width of [390,692,768,1024,1440]){
   await page.setViewportSize({width,height:1000});await settle(page);await page.evaluate(()=>document.querySelector('#sheetBody [data-finish-surface="detail"]').scrollIntoView({block:'center',behavior:'instant'}));await frame(page);await page.locator('#sheetBody .finish-layer').waitFor();await page.mouse.move(0,0);await noOverflow(page,'#sheetBody',id+' '+width);
   await page.waitForFunction(()=>!document.querySelector('#sheet').getAnimations({subtree:true}).some(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState)));
   await page.evaluate(()=>{window.__foilSteady=null;});await page.waitForFunction(()=>{const s=document.querySelector('#sheetBody [data-finish-surface="detail"]'),light=s?.querySelector('.finish-spotlight');if(!light)return false;const r=s.getBoundingClientRect(),v=JSON.stringify([s.style.cssText,r.x,r.y,r.width,r.height,getComputedStyle(light).opacity]),old=window.__foilSteady,now=performance.now();if(!old||old.value!==v){window.__foilSteady={value:v,at:now};return false;}return now-old.at>200;});
   const geometry=await page.evaluate(()=>{const s=document.querySelector('#sheetBody [data-finish-surface="detail"]'),a=s.querySelector('img').getBoundingClientRect(),b=s.querySelector('.finish-overlay').getBoundingClientRect();return {dx:Math.abs(a.left-b.left),dy:Math.abs(a.top-b.top),dw:Math.abs(a.width-b.width),dh:Math.abs(a.height-b.height),model:JSON.parse(s.dataset.finishModel)};});assert(Math.max(geometry.dx,geometry.dy,geometry.dw,geometry.dh)<2,'Overlay follows image after fold/resize');
   const photo=hidden=>page.evaluate(hidden=>{const s=document.querySelector('#sheetBody [data-finish-surface="detail"]');for(const n of s.querySelectorAll('.finish-layer,.finish-pattern'))n.style.visibility=hidden?'hidden':'';const r=s.querySelector('img').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};},hidden);
   const box=await photo(true),plain=await page.screenshot({clip:box,animations:'disabled',path:`test-results/foil-fold-${id}-${width}-plain.png`});await photo(false);const foil=await page.screenshot({clip:box,animations:'disabled',path:`test-results/foil-fold-${id}-${width}.png`}),pixels=await pixelRegions(page,plain,foil);
   console.log('PIXEL DIAGNOSTIC',id,width,JSON.stringify({geometry,pixels}));report.cases.push({id,width,geometry,pixels});
   // A clipped blend layer changes raster compositing of a few image pixels:
   // retained baseline vs foil differs by mean .00455/255, not a painted region.
   // Bound both intensity and area; the old mask below must still fail clearly.
   for(const zone of ['art','topEdge','leftEdge','caption'])assert(pixels[zone].mean<.05&&pixels[zone].changedFraction<.01,`${id} ${width}: ${zone} excluded within subpixel compositing tolerance`);assert(pixels.body.mean>1&&pixels.belowFrame.mean>1,'Foil reaches the field immediately below the frame');
   if(id==='sm11-6'&&width===768){
    const old=await page.evaluate(mask=>{const n=document.querySelector('#sheetBody .finish-layer'),old=n.style.clipPath;n.style.clipPath=mask;return old;},FINISH_MASKS['pk-standard-surround']);const oldShot=await page.screenshot({clip:box,animations:'disabled',path:'test-results/foil-fold-sewaddle-old-mask.png'});const negative=await pixelRegions(page,plain,oldShot);assert(negative.topEdge.mean>1&&negative.leftEdge.mean>1,'Old mask visibly paints inside the illustration');assert(negative.belowFrame.mean<.05,'Old mask leaves an unfoiled gap below the frame');await page.evaluate(mask=>document.querySelector('#sheetBody .finish-layer').style.clipPath=mask,old);report.oldMaskControl=negative;
   }

  }
  await page.locator('#sheetBody [data-act="closeSheet"]').first().click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);
 }
 // Keep a long, nonzero-scrolled real Search page behind the modal. Test both
 // edges, the backdrop, cancel, nested zoom, and resize without changing route.
 for(const size of [{width:692,height:768},{width:768,height:900},{width:1024,height:700}]){
  await page.setViewportSize(size);const opener=page.locator('#content [data-act="tCard"][data-id="sm11-6"]').first();await opener.scrollIntoViewIfNeeded();const prior=await background(page);assert(prior.y>0,'Background starts away from top');await opener.click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.previewBusy===false);await settle(page);const locked=await background(page);assert.deepEqual(locked,prior,'Opening preserves page position');
  const body=page.locator('#sheetBody');await body.evaluate(n=>n.scrollTop=250);await frame(page);const middle=await body.evaluate(n=>n.scrollTop);const r=await body.boundingBox();await pan(page,context,r.x+r.width*.75,r.y+r.height*.75,0,-140);await page.waitForFunction(top=>document.querySelector('#sheetBody').scrollTop>top,middle);assert.deepEqual(await background(page),locked,'Scrolling detail never scrolls Search');
  await body.evaluate(n=>n.scrollTop=n.scrollHeight);await frame(page);await pan(page,context,r.x+r.width*.75,r.y+r.height*.75,0,-140);assert.deepEqual(await background(page),locked,'Bottom boundary cannot chain');
  await pan(page,context,2,100,0,140);assert.deepEqual(await background(page),locked,'Backdrop cannot scroll background');assert.equal(await page.locator('#sheet').evaluate(n=>n.style.transform),'','Backdrop cannot drag the sheet');
  await body.evaluate(n=>n.scrollTop=0);await frame(page);const title=await page.locator('#sheetBody .sheet-head').boundingBox();await pan(page,context,title.x+title.width/2,title.y+12,0,35,{cancel:true});assert.equal(await page.locator('#sheet').evaluate(n=>n.style.transform),'','Cancelled gesture clears sheet transform');assert.deepEqual(await background(page),locked);
  await page.setViewportSize({width:390,height:844});await settle(page);await page.setViewportSize(size);await settle(page);assert.deepEqual(await background(page),locked,'Unfold restores background position');
  await page.evaluate(()=>document.querySelector('#sheetBody .cd-zoom').scrollIntoView({block:'center',behavior:'instant'}));await page.locator('#sheetBody .cd-zoom').click();await page.locator('dialog.zoom[open]').waitFor();await page.locator('dialog.zoom [data-z="in"]').click();await page.locator('dialog.zoom [data-z="close"]').click();assert(await page.locator('#sheet').evaluate(n=>n.open),'Nested zoom preserves parent modal');assert.deepEqual(await background(page),locked);
  await page.locator('#sheetBody [data-act="closeSheet"]').first().click();await page.waitForFunction(()=>!document.documentElement.classList.contains('sheet-open'));assert.deepEqual(await background(page),locked,'Close returns to same background position');await page.mouse.move(10,200);await page.mouse.wheel(0,180);await page.waitForFunction(y=>scrollY!==y,locked.y);report.scroll.push({...size,background:locked,inside:true,boundary:true,backdrop:true,cancel:true,fold:true,nested:true,restored:true});
 }
 assert.equal(await inventorySnapshot(page),before);app.health();report.status='PASS';
}catch(e){report.error=e.stack;report.diagnostics=app?.diagnostics();if(app)await app.page.screenshot({path:'test-results/foil-fold-failure.png'}).catch(()=>{});throw e;}
finally{fs.writeFileSync('test-results/foil-fold-browser.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
