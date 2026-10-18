// Real Collection DOM, synthetic 600x825 art: geometry evidence, not physical-foil fidelity.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startServer,openApp,closeSheet,capture,saveReport,noOverflow,RESULTS} from './detail-rules-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser QA runs only in hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch(),report=[];
try{for(const width of [320,390,768,1440]){
 const app=await openApp(browser,server.base,{game:'ptcg',width,isMobile:true}),{page}=app;
 try{
  await page.route(server.base+'/tests/shape-600x825.svg',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="825"><rect width="600" height="825" rx="24" fill="#ffe14d"/><rect x="48" y="81" width="504" height="310" fill="#315876"/><circle cx="300" cy="225" r="95" fill="#bb9274"/><text x="48" y="480" font-size="24">SYNTHETIC GEOMETRY FIXTURE</text></svg>'}));
  await page.evaluate(url=>{const T=window.__uiTestTcg,S=window.__uiTestState,c=T.cache.ptcg['swsh1-9'];c.set={...c.set,id:'cel25'};c.name='Synthetic Celebrations geometry';c.image=url;c.imageLarge=url;S.state.tcg.ptcg.collection.find(e=>e.cardId===c.id).variant='holofoil';},server.base+'/tests/shape-600x825.svg');
  const galleryButton=page.locator('#content [data-act="viewSave"][data-mode="gallery"]');await galleryButton.focus();await galleryButton.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#content.view-gallery .lot-art[data-entry="lot-ptcg-0"]'));
  await noOverflow(page,'#content','Pokémon surface gallery settled',true);
  const tile=page.locator('#content .lot-art[data-entry="lot-ptcg-0"]');await tile.scrollIntoViewIfNeeded();
  await tile.locator('.finish-overlay').waitFor();
  await page.waitForFunction(()=>{const n=document.querySelector('#content .lot-art[data-entry="lot-ptcg-0"] img.card-img');return n.complete&&n.naturalWidth===600;});
  const measureGeometry=n=>{const img=n.querySelector('img.card-img'),o=n.querySelector('.finish-overlay'),s=getComputedStyle(n),i=getComputedStyle(img),r=n.getBoundingClientRect(),ir=img.getBoundingClientRect(),or=o.getBoundingClientRect();return {padding:parseFloat(s.paddingTop),ratio:ir.width/ir.height,natural:img.naturalWidth/img.naturalHeight,fit:i.objectFit,top:ir.top-r.top,left:ir.left-r.left,right:r.right-ir.right,bottom:r.bottom-ir.bottom,frameRadius:s.borderTopLeftRadius,imageRadius:i.borderTopLeftRadius,glitterInset:getComputedStyle(n,'::after').inset,overlay:{x:or.left-ir.left,y:or.top-ir.top,w:or.width-ir.width,h:or.height-ir.height},opacity:getComputedStyle(o.querySelector('.finish-pattern')).opacity};};
  const geometry=await tile.evaluate(measureGeometry);
  assert.equal(geometry.padding,5);assert.equal(geometry.fit,'contain');assert(Math.abs(geometry.ratio-geometry.natural)<.002);assert(Math.abs(geometry.top-5)<.1);assert(Math.abs(geometry.left-5)<.1);assert(Math.abs(geometry.right-5)<.1);assert(Math.abs(geometry.bottom-5)<.1);assert.equal(geometry.glitterInset,'5px');for(const value of Object.values(geometry.overlay))assert(Math.abs(value)<1.1);assert.equal(geometry.opacity,'0.18');
  await tile.click();await page.locator('#sheet .cs-banner .cs-art').first().waitFor();
  // The context already requests no-preference. Diagnose Playwright's
  // per-page emulateMedia replacement on a separate page so it cannot clear
  // the real touch context's pointer media features before header assertions.
  const mediaProbe=await page.context().newPage();
  const mediaState=()=>({coarse:matchMedia('(pointer:coarse)').matches,fine:matchMedia('(pointer:fine)').matches,anyCoarse:matchMedia('(any-pointer:coarse)').matches,touchPoints:navigator.maxTouchPoints,ua:navigator.userAgent,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches});
  const mediaBefore=await mediaProbe.evaluate(mediaState);await mediaProbe.emulateMedia({reducedMotion:'no-preference'});const mediaAfter=await mediaProbe.evaluate(mediaState);await mediaProbe.close();
  console.log('Touch media diagnostic',JSON.stringify({width,mediaBefore,mediaAfter,main:await page.evaluate(mediaState)}));
  const hero=page.locator('#sheet .cs-banner .cs-art').first();
  const motion=await hero.evaluate(n=>{const a=n.getAnimations().find(a=>a.animationName==='header-breathe');return {name:getComputedStyle(n).animationName,scaleSupported:CSS.supports('scale','1.035'),running:a?.playState,coarse:matchMedia('(pointer:coarse)').matches};});
  assert.equal(motion.coarse,true,'Touch fixture exercises coarse pointer policy');assert.equal(motion.name,'header-breathe');assert.equal(motion.running,'running');
  await hero.evaluate(n=>{const a=n.getAnimations().find(a=>a.animationName==='header-breathe');a.pause();a.currentTime=10000;});
  const midway=await hero.evaluate(n=>getComputedStyle(n).scale);assert(Number(midway)>1);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await hero.evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});await closeSheet(page);
  const resizeChecks=[];
  if(width===320){
   for(const resizedWidth of [768,1024,1440,390,320]){
    await page.setViewportSize({width:resizedWidth,height:1000});
    await noOverflow(page,'#content','Pokémon live resize '+resizedWidth,true);
    await tile.waitFor({state:'visible'});
    await page.waitForFunction(()=>{const n=document.querySelector('#content .lot-art[data-entry="lot-ptcg-0"] img.card-img');return n?.complete&&n.naturalWidth===600;});
    await tile.locator('.finish-overlay').waitFor();
    const g=await tile.evaluate(measureGeometry);
    assert.equal(g.padding,5);assert(Math.abs(g.ratio-g.natural)<.002);assert(Math.abs(g.top-5)<.1);assert(Math.abs(g.left-5)<.1);assert(Math.abs(g.right-5)<.1);assert(Math.abs(g.bottom-5)<.1);assert.equal(g.glitterInset,'5px');for(const value of Object.values(g.overlay))assert(Math.abs(value)<1.1);
    resizeChecks.push({width:resizedWidth,geometry:g});
   }
  }
  await tile.waitFor({state:'visible'});
  assert.equal(await tile.locator('img.card-img').evaluate(n=>n.naturalWidth),600,'After detail close, captures still use the exact synthetic geometry image');
  const beforeCapture=await page.evaluate(mediaState);
  await capture(page,'pokemon-surface-after-'+width);
  const before=await page.addStyleTag({content:'#content.view-gallery .display-list .lot:not(.wanted) .lot-art[data-finish-game="ptcg"]{aspect-ratio:63/88;padding:5px;border-radius:12px}#content.view-gallery .display-list .lot:not(.wanted) .lot-art[data-finish-game="ptcg"]>img.card-img{height:100%;aspect-ratio:488/680;border-radius:7px}.finish-overlay[data-material-profile="line-holo"] .finish-pattern{background-image:repeating-linear-gradient(92deg,transparent 0 2px,#b5e7ff60 2px 2.7px,transparent 2.7px 8px);opacity:.46}'});
  await capture(page,'pokemon-surface-before-'+width);await before.evaluate(n=>n.remove());
  const afterCapture=await page.evaluate(mediaState);
  console.log('Screenshot touch diagnostic',JSON.stringify({width,beforeCapture,afterCapture}));
  const unchangedViews=[];
  for(const mode of ['compact','symbols']){
   const modeButton=page.locator(`#content [data-act="viewSave"][data-mode="${mode}"]`);await modeButton.focus();await modeButton.press('Enter');
   await page.waitForFunction(mode=>document.querySelector('#content')?.classList.contains('view-'+mode),mode);
   await noOverflow(page,'#content','Pokémon unchanged '+mode+' settled',true);
   const scope=await page.evaluate(()=>{const rules=[...document.styleSheets].filter(s=>!s.href||new URL(s.href).origin===location.origin).flatMap(s=>[...s.cssRules]).filter(r=>r.selectorText?.includes('[data-finish-game="ptcg"]'));return {ruleCount:rules.length,matchingRules:rules.filter(r=>document.querySelector(r.selectorText)).map(r=>r.selectorText)};});
   assert.equal(scope.ruleCount,5,'All five geometry rules inspected');assert.deepEqual(scope.matchingRules,[],mode+' must not match gallery-only geometry overrides');unchangedViews.push({mode,...scope});
  }
  report.push({width,geometry,motion,midway,mediaBefore,mediaAfter,beforeCapture,afterCapture,resizeChecks,unchangedViews,physicalPhoneVerified:false});
 }finally{await app.close();}
}
// Actual publisher-provided card pixels, not synthetic art, for frame-weight review.
// Values and ownership remain isolated fixtures; these images prove visual fit only.
const realArt = {
 ptcg: {url:'https://assets.tcgdex.net/en/base/base4/20/high.webp',type:'image/webp',name:'Zapdos · Base Set 2'},
 ygo: {url:'https://images.ygoprodeck.com/images/cards/89631139.jpg',type:'image/jpeg',name:'Blue-Eyes White Dragon'},
 mtg: {url:'https://api.scryfall.com/cards/cmr/133',metadata:true,type:'image/jpeg',name:'Miara, Thorn of the Glade'}
};
async function loadRealArt(art,game){
 const sources=JSON.parse(await readFile(new URL('./frame-art/sources.json',import.meta.url)));
 art.url=sources[game][0];art.bytes=await readFile(new URL('./frame-art/'+game+'.'+sources[game][1],import.meta.url));assert(art.bytes.length>5000);
}
for(const game of ['ptcg','mtg','ygo']){
 await loadRealArt(realArt[game],game);
 const app=await openApp(browser,server.base,{game,width:390,isMobile:true}),{page}=app;
 try{
  const art=realArt[game],url=server.base+'/tests/actual-frame-'+game;
  await page.route(url,r=>r.fulfill({status:200,contentType:art.type,body:art.bytes}));
  await page.evaluate(({game,url})=>{
   const S=window.__uiTestState,T=window.__uiTestTcg;
   if(game!=='mtg')for(const c of Object.values(T.cache[game])){c.image=url;c.imageLarge=url;}
   else for(const c of [...Object.values(S.catalog),...Object.values(S.state.printings||{})]){c.image_uris={...(c.image_uris||{}),normal:url,large:url,small:url};}
  },{game,url});
  const galleryButton=page.locator('#content [data-act="viewSave"][data-mode="gallery"]');await galleryButton.focus();await galleryButton.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#content.view-gallery .lot-art[data-entry]'));
  await page.waitForFunction(url=>{const img=document.querySelector('#content .lot-art[data-entry] img');return img?.complete&&img.naturalWidth>300&&img.currentSrc===url;},url);
  await noOverflow(page,'#content','Actual '+game+' initial gallery settled',true);
  const tile=page.locator('#content .lot-art[data-entry]').first();
  for(const width of [390,320,768,1440,390]){
   await page.setViewportSize({width,height:1000});
   await noOverflow(page,'#content','Actual '+game+' resized gallery settled',true);
   await tile.waitFor({state:'visible'});
   await page.waitForFunction(url=>{const img=document.querySelector('#content .lot-art[data-entry] img');return img?.complete&&img.naturalWidth>300&&img.currentSrc===url;},url);
   // Use the same public price-band color for a like-for-like visual comparison.
   await tile.evaluate(n=>n.closest('.lot').dataset.tier='t2');
   await noOverflow(page,'#content','Actual '+game+' frame '+width,true);
   const geometry=await tile.evaluate(n=>{const img=n.querySelector('img'),r=n.getBoundingClientRect(),i=img.getBoundingClientRect();return {padding:getComputedStyle(n).paddingTop,radius:getComputedStyle(n).borderTopLeftRadius,innerRadius:getComputedStyle(img).borderTopLeftRadius,left:i.left-r.left,right:r.right-i.right,top:i.top-r.top,bottom:r.bottom-i.bottom,ratio:i.width/i.height,natural:img.naturalWidth/img.naturalHeight,fit:getComputedStyle(img).objectFit};});
   assert.equal(geometry.padding,'5px','All games retain full shared frame weight');assert.equal(geometry.radius,'12px');assert.equal(geometry.innerRadius,'7px');
   if(game==='ptcg'){for(const side of ['left','right','top','bottom'])assert(Math.abs(geometry[side]-5)<.2,'No black internal moat '+side);assert(Math.abs(geometry.ratio-geometry.natural)<.002);assert.equal(geometry.fit,'contain');}
   await capture(page,'pokemon-actual-frame-'+game+'-'+width);
   const cornerShot=await tile.screenshot({path:RESULTS+'/pokemon-actual-corners-'+game+'-'+width+'.png'});
   const cornerPixels=await page.evaluate(async bytes=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'})),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);return [[2,2],[1,3],[3,1]].flatMap(([x,y])=>[[x,y],[c.width-1-x,y],[x,c.height-1-y],[c.width-1-x,c.height-1-y]]).map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));},Array.from(cornerShot));
   assert(cornerPixels.every(p=>Math.max(...p.slice(0,3))<110),'Rounded outer corners must show only dark background/soft glow, never a solid tier-colored cap: '+JSON.stringify(cornerPixels));
   const bounds=await tile.boundingBox();await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+bounds.height*.3);
   await tile.screenshot({path:RESULTS+'/pokemon-actual-tilt-'+game+'-'+width+'.png'});
   await page.mouse.move(0,0);
   report.push({game,width,actualArtSource:art.url,artName:art.name,geometry,cornerPixels,physicalPhoneVerified:false});
  }
 }finally{await app.close();}
}
await saveReport('pokemon-card-surface',report);
}catch(error){await saveReport('pokemon-card-surface',report,error);throw error;}finally{await browser.close();await server.close();}
