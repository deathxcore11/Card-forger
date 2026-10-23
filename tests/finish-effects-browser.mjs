// Hosted real-app integration. Art is explicitly synthetic, not mask-calibration evidence.
import assert from 'node:assert/strict';
import {CARDS,startServer,openApp,closeSheet,inventorySnapshot,capture} from './detail-rules-fixtures.mjs';
import {noOverflow} from './detail-rules-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Finish browser QA runs only in hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch();
// Resizing a just-opened sheet can sample a finite entrance/transform transition.
// Record both states, then retain the original strict overflow assertion unchanged.
async function settleSheetGeometry(page,label){
 const sample=()=>{const root=document.querySelector('#sheetBody'),r=root.getBoundingClientRect();return {scroll:root.scrollWidth,client:root.clientWidth,animations:document.querySelector('#sheet').getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState)).map(a=>({name:a.animationName||a.transitionProperty||'',state:a.playState})),outside:[...root.querySelectorAll('*')].filter(n=>{const b=n.getBoundingClientRect();return b.width&&b.right>r.right+2;}).slice(0,12).map(n=>({tag:n.tagName,class:n.className,transform:getComputedStyle(n).transform,right:n.getBoundingClientRect().right}))};};
 const before=await page.evaluate(sample);
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>!document.querySelector('#sheet').getAnimations({subtree:true}).some(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState)),null,{timeout:5000});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const after=await page.evaluate(sample);console.log('Sheet geometry readiness',label,JSON.stringify({before,after}));
}

// An opaque diagnostic foil proves paint order without relying on a particular card mask.
// Remove it before the normal screenshots; it never edits the renderer or saved data.
async function assertBadgesAboveFoil(page,tile,label){
 await tile.locator('.finish-overlay').waitFor();
 await tile.evaluate(n=>{const f=n.querySelector('.finish-overlay'),probe=document.createElement('span');probe.dataset.badgeFoilProbe='';probe.style.cssText='position:absolute;inset:0;background:rgb(255,0,255);pointer-events:none';f.append(probe);});
 try{
  for(const kind of ['.tile-emb','.tile-set']){
   const badge=tile.locator('.tile-chrome '+kind);if(!await badge.count()||!await badge.isVisible())continue;
   const b=await badge.boundingBox(),png=await page.screenshot({clip:{x:b.x+b.width*.25,y:b.y+b.height*.25,width:b.width*.5,height:b.height*.5},animations:'disabled'});
   const covered=await page.evaluate(async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let covered=0;for(let i=0;i<d.length;i+=4)if(d[i]>235&&d[i+1]<20&&d[i+2]>235)covered++;return covered/(c.width*c.height);},png.toString('base64'));
   assert(covered<.01,`${label} ${kind}: foil cannot paint over UI badges (${covered})`);
  }
 }finally{await tile.evaluate(n=>n.querySelector('[data-badge-foil-probe]')?.remove());}
}

try{for(const game of ['ygo','ptcg','mtg']){
 const app=await openApp(browser,server.base,{game,width:390}),{page}=app;
 try{
  // Deliberately seed a foil-owned fixture before the user-flow snapshot.
  if(game==='mtg')await page.evaluate(()=>{window.__uiTestState.state.collection[0].finish='foil';});
  if(game==='ptcg')await page.evaluate(()=>{const S=window.__uiTestState,T=window.__uiTestTcg,c=Object.values(T.cache.ptcg).find(c=>c.id==='sv08-002'),base=S.state.tcg.ptcg.collection.find(e=>e.cardId===c.id);S.state.tcg.ptcg.collection=S.state.tcg.ptcg.collection.filter(e=>e.cardId!==c.id);for(const variant of ['normal','holofoil','reverse-holofoil'])S.state.tcg.ptcg.collection.push({...base,id:'owned-'+variant,variant});});
  await page.evaluate(()=>{window.__finishBeforeModeState=window.__uiTestState.state;});
  await page.locator('#content [data-act="viewSave"][data-mode="gallery"]').click();
  await page.waitForFunction(game=>window.__uiTestState.state!==window.__finishBeforeModeState&&window.__uiTestState.state.settings.displayModes?.[game]?.collection==='gallery',game);
  if(game==='ptcg'){

   // The fixture deliberately changed owned quantities outside an app commit.
   // Seed its observation explicitly; view-mode changes must not create history.
   await page.evaluate(()=>{const T=window.__uiTestTcg;T.trackTcgValue("ptcg",T.collectionValue("ptcg"),window.__uiTestState.state);});
   await page.waitForFunction(()=>{const side=window.__uiTestState.state.tcg.ptcg,point=side.valueHistory?.find(p=>p.date===new Date().toISOString().slice(0,10));return point?.copies===side.collection.reduce((n,e)=>n+e.qty,0);});
   const snapshot=await inventorySnapshot(page);
   for(const [variant,effect,mask] of [['normal','plain',null],['holofoil','ptcg-holo','pk-sv-art'],['reverse-holofoil','ptcg-reverse','pk-sv-surround']]){
    const tile=page.locator(`#content .lot-art[data-entry="owned-${variant}"]`);await tile.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));const model=await tile.evaluate(n=>JSON.parse(n.dataset.finishModel));assert.equal(model.key,variant);assert.equal(model.effect,effect);
    if(mask){assert(model.layers.some(l=>l.mask===mask));await tile.locator('.finish-auto').waitFor();assert.equal(await tile.locator('.finish-auto').evaluate(n=>getComputedStyle(n).animationName),'finish-gallery-light');await assertBadgesAboveFoil(page,tile,game+' '+variant);}else assert.equal(await tile.locator('.finish-overlay').count(),0,'Owned nonfoil has no automatic foil shine');
    await tile.click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx.previewBusy===false);assert.equal(await page.locator('#sheet .cd-img').evaluate(n=>JSON.parse(n.dataset.finishModel).key),variant,'Detail opens with this copy’s saved finish');await page.locator('#sheet [data-finish="'+(variant==='normal'?'holofoil':'normal')+'"]').click();await closeSheet(page);assert.equal(await inventorySnapshot(page),snapshot,'Preview choice never edits any saved copy');
   }
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-app').click();const setting=page.locator('#settings-app [data-change="setFinishEffects"]');await setting.uncheck();await page.waitForFunction(()=>!document.querySelector('.finish-overlay'));await setting.check();await page.locator('[data-act="closeSettings"]').click();
   await page.locator('#content .lot-art[data-entry="owned-holofoil"]').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await page.locator('#content .lot-art[data-entry="owned-holofoil"] .finish-auto').waitFor();await page.screenshot({path:'test-results/finish-effects-ptcg-owned-variants.png',fullPage:false});
  }
  const opener=page.locator(`#content .lot-art[data-entry="lot-${game}-0"]`);
  if(game!=='ptcg'){
   await opener.locator('.finish-auto').waitFor();
   await assertBadgesAboveFoil(page,opener,game);
   const initial=await opener.locator('.finish-auto').evaluate(n=>({position:getComputedStyle(n).getPropertyValue('--finish-x'),animation:getComputedStyle(n).animationName}));
   assert.equal(initial.animation,'finish-gallery-light','Visible foil grids animate before any hover or tilt');
   await page.waitForFunction(({selector,position})=>{const n=document.querySelector(selector);return n&&getComputedStyle(n).getPropertyValue('--finish-x')!==position;},{selector:`#content .lot-art[data-entry="lot-${game}-0"] .finish-auto`,position:initial.position});
   await capture(page,`finish-effects-${game}-automatic-grid`);
   await page.setViewportSize({width:390,height:320});await page.locator('#content .lot-art').last().evaluate(n=>n.scrollIntoView({block:'end',behavior:'instant'}));
   await page.waitForFunction(game=>{const n=document.querySelector(`#content .lot-art[data-entry="lot-${game}-0"]`);return n.getBoundingClientRect().bottom<=0&&!n.querySelector('.finish-overlay');},game);
   await opener.scrollIntoViewIfNeeded();await opener.locator('.finish-auto').waitFor();
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForFunction(()=>!document.querySelector('.finish-overlay'));
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await opener.locator('.finish-auto').waitFor();
   await page.setViewportSize({width:390,height:1000});
  }
  await opener.hover();
  assert.equal(await opener.evaluate(n=>getComputedStyle(n,'::before').display),'none','Legacy color-dodge hover rings cannot cover collection cards');
  await capture(page,`finish-effects-${game}-collection-hover`);await opener.click();
  await page.waitForFunction(()=>!document.querySelector('#content .finish-overlay'));
  await page.waitForFunction(()=>{const c=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&!c?.detailsBusy&&!c?.printsBusy;});
  const before=await inventorySnapshot(page),preview=page.locator('#sheet .finish-preview');await preview.waitFor();
  assert.equal(await preview.locator('.finish-choice-rail').evaluate(n=>getComputedStyle(n).flexWrap),'nowrap','All games use the same bounded swipe rail');
  assert.equal(await preview.locator('.rarity-swatch').count(),await preview.locator('.finish-choice-rail button').count(),'Each available finish has its own material swatch');
  if(game!=='ygo')await preview.locator(`[data-finish="${game==='mtg'?'foil':'reverse-holofoil'}"]`).click();
  const selection=await page.evaluate(()=>JSON.stringify((c=>[c.type,c.game,c.id,c.print?.id,c.priceFinish,c.setVariant,c.priceEdition,c.priceYgoEdition])(window.__uiTestState.ui.sheetCtx)));
  for(const width of [320,390,673,768,1024,1440]){
   await page.setViewportSize({width,height:1000});await preview.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await settleSheetGeometry(page,`${game} finish ${width}`);await noOverflow(page,'#sheetBody',`${game} finish ${width}`);
   await capture(page,`finish-effects-${game}-${width}`);
  }
  await page.locator('#sheet .cd-img').scrollIntoViewIfNeeded();
  if(game==='mtg'){
   await page.locator('#sheet .finish-overlay').waitFor();
   const geometry=await page.locator('#sheet .cd-img').evaluate(n=>{const a=n.querySelector('img').getBoundingClientRect(),b=n.querySelector('.finish-overlay').getBoundingClientRect();return {inside:b.left>=a.left-2&&b.right<=a.right+2&&b.top>=a.top-2&&b.bottom<=a.bottom+2,ratio:b.width/b.height};});
   assert(geometry.inside,'Overlay stays inside image element');
   await page.mouse.move(0,0);
   await page.evaluate(()=>{window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:30,gamma:0}));});
   await page.waitForFunction(()=>document.querySelector('#sheet .cd-img')?.classList.contains('gyro'));
   const initial=await page.locator('#sheet .finish-overlay').evaluate(n=>getComputedStyle(n).getPropertyValue('--finish-x'));
   await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:40,gamma:14})));
   await page.waitForFunction(initial=>getComputedStyle(document.querySelector('#sheet .finish-overlay')).getPropertyValue('--finish-x')!==initial,initial);
   const light=await page.locator('#sheet .cd-img').evaluate(n=>({pointer:n.style.getPropertyValue('--mx'),foil:getComputedStyle(n.querySelector('.finish-overlay')).getPropertyValue('--finish-x'),animation:getComputedStyle(n.querySelector('.finish-overlay')).animationName,spot:getComputedStyle(n.querySelector('.finish-layer'),'::after').backgroundImage}));
   assert(Math.abs(parseFloat(light.pointer)-parseFloat(light.foil))<0.000001,'Gyroscope spotlight and foil use the same coordinates within CSS serialization precision');assert.equal(light.animation,'none','Detail foil follows tilt without a competing automatic grid loop');assert.match(light.spot,/radial-gradient/);
   await capture(page,'finish-effects-mtg-gyro-light');
  }
  // Controls alter preview state only; a deliberate toggle never changes ownership.
  await page.evaluate(async()=>{const f=await import('/finish-preview.js');f.setFinishEffects(!f.finishEffectsOn());});assert.equal(await page.locator('#sheet .finish-overlay').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify((c=>[c.type,c.game,c.id,c.print?.id,c.priceFinish,c.setVariant,c.priceEdition,c.priceYgoEdition])(window.__uiTestState.ui.sheetCtx))),selection);
  await page.evaluate(async()=>{const f=await import('/finish-preview.js');f.setFinishEffects(!f.finishEffectsOn());});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('#sheet .finish-overlay'));
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await inventorySnapshot(page),before,'Finish preview does not edit collection, private prices or decks');
  if(game==='mtg'){
   await page.locator('#sheet .cd-img').scrollIntoViewIfNeeded();await page.locator('#sheet .cd-zoom').click();
   await page.locator('.zoom-card-surface .finish-overlay').waitFor();await capture(page,'finish-effects-mtg-zoom');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.zoom-card-surface'));
  }
  await closeSheet(page);await page.waitForFunction(()=>!document.querySelector('#sheet .finish-overlay'));
  for(const mode of ['compact','symbols']){await page.locator(`#content [data-act="viewSave"][data-mode="${mode}"]`).click();await page.waitForFunction(()=>!document.querySelector('#content .finish-overlay'));}
  app.health();console.log(`PASS: ${game} real finish controls, 320/390/673/768/1024/1440px, off/reduced-motion/cleanup and unchanged ownership.`);
 }catch(e){await capture(page,`finish-effects-${game}-failure`);throw e;}finally{await app.context.close();}
}}finally{await browser.close();await server.close();}
