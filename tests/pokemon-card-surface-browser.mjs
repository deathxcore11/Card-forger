// Real Collection DOM, synthetic 600x825 art: geometry evidence, not physical-foil fidelity.
import assert from 'node:assert/strict';
import {startServer,openApp,closeSheet,capture,saveReport,noOverflow} from './detail-rules-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser QA runs only in hosted GitHub Actions.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch(),report=[];
try{for(const width of [320,390,768,1440]){
 const app=await openApp(browser,server.base,{game:'ptcg',width,isMobile:true}),{page}=app;
 try{
  await page.route(server.base+'/tests/shape-600x825.svg',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="825"><rect width="600" height="825" rx="24" fill="#ffe14d"/><rect x="48" y="81" width="504" height="310" fill="#315876"/><circle cx="300" cy="225" r="95" fill="#bb9274"/><text x="48" y="480" font-size="24">SYNTHETIC GEOMETRY FIXTURE</text></svg>'}));
  await page.evaluate(()=>{const T=window.__uiTestTcg,S=window.__uiTestState,c=T.cache.ptcg['swsh1-9'];c.set={...c.set,id:'cel25'};c.name='Synthetic Celebrations geometry';S.state.tcg.ptcg.collection.find(e=>e.cardId===c.id).variant='holofoil';});
  await page.locator('#content [data-act="viewSave"][data-mode="gallery"]').click();
  await page.waitForFunction(()=>document.querySelector('#content.view-gallery .lot-art[data-entry="lot-ptcg-0"]'));
  await noOverflow(page,'#content','Pokémon surface gallery settled',true);
  const tile=page.locator('#content .lot-art[data-entry="lot-ptcg-0"]');await tile.scrollIntoViewIfNeeded();
  await tile.locator('img.card-img').evaluate((n,url)=>{n.removeAttribute('srcset');n.src=url;},server.base+'/tests/shape-600x825.svg');
  await tile.locator('.finish-overlay').waitFor();
  await page.waitForFunction(()=>{const n=document.querySelector('#content .lot-art[data-entry="lot-ptcg-0"] img.card-img');return n.complete&&n.naturalWidth===600;});
  const geometry=await tile.evaluate(n=>{const img=n.querySelector('img.card-img'),o=n.querySelector('.finish-overlay'),s=getComputedStyle(n),i=getComputedStyle(img),r=n.getBoundingClientRect(),ir=img.getBoundingClientRect(),or=o.getBoundingClientRect();return {padding:parseFloat(s.paddingTop),ratio:ir.width/ir.height,natural:img.naturalWidth/img.naturalHeight,fit:i.objectFit,top:ir.top-r.top,left:ir.left-r.left,overlay:{x:or.left-ir.left,y:or.top-ir.top,w:or.width-ir.width,h:or.height-ir.height},opacity:getComputedStyle(o.querySelector('.finish-pattern')).opacity};});
  assert.equal(geometry.padding,2);assert.equal(geometry.fit,'contain');assert(Math.abs(geometry.ratio-geometry.natural)<.002);assert(Math.abs(geometry.top-2)<.1);assert(Math.abs(geometry.left-2)<.1);for(const value of Object.values(geometry.overlay))assert(Math.abs(value)<1.1);assert.equal(geometry.opacity,'0.18');
  await capture(page,'pokemon-surface-after-'+width);
  const before=await page.addStyleTag({content:'#content.view-gallery .display-list .lot:not(.wanted) .lot-art[data-finish-game="ptcg"]{aspect-ratio:63/88;padding:5px;border-radius:12px}#content.view-gallery .display-list .lot:not(.wanted) .lot-art[data-finish-game="ptcg"]>img.card-img{height:100%;aspect-ratio:488/680;border-radius:7px}.finish-overlay[data-material-profile="line-holo"] .finish-pattern{background-image:repeating-linear-gradient(92deg,transparent 0 2px,#b5e7ff60 2px 2.7px,transparent 2.7px 8px);opacity:.46}'});
  await capture(page,'pokemon-surface-before-'+width);await before.evaluate(n=>n.remove());
  await tile.click();await page.locator('#sheet .cs-banner .cs-art').first().waitFor();
  await page.emulateMedia({reducedMotion:'no-preference'});
  const hero=page.locator('#sheet .cs-banner .cs-art').first();
  const motion=await hero.evaluate(n=>{const a=n.getAnimations().find(a=>a.animationName==='header-breathe');return {name:getComputedStyle(n).animationName,scaleSupported:CSS.supports('scale','1.035'),running:a?.playState,coarse:matchMedia('(pointer:coarse)').matches};});
  assert.equal(motion.coarse,true,'Touch fixture exercises coarse pointer policy');assert.equal(motion.name,'header-breathe');assert.equal(motion.running,'running');
  await hero.evaluate(n=>{const a=n.getAnimations().find(a=>a.animationName==='header-breathe');a.pause();a.currentTime=10000;});
  const midway=await hero.evaluate(n=>getComputedStyle(n).scale);assert(Number(midway)>1);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await hero.evaluate(n=>getComputedStyle(n).animationName),'none');
  await closeSheet(page);
  const unchangedViews=[];
  for(const mode of ['compact','symbols']){
   await page.locator(`#content [data-act="viewSave"][data-mode="${mode}"]`).click();
   const scope=await page.evaluate(()=>{const rules=[...document.styleSheets].filter(s=>!s.href||new URL(s.href).origin===location.origin).flatMap(s=>[...s.cssRules]).filter(r=>r.selectorText?.includes('[data-finish-game="ptcg"]'));return {ruleCount:rules.length,matchingRules:rules.filter(r=>document.querySelector(r.selectorText)).map(r=>r.selectorText)};});
   assert.equal(scope.ruleCount,5,'All five geometry rules inspected');assert.deepEqual(scope.matchingRules,[],mode+' must not match gallery-only geometry overrides');unchangedViews.push({mode,...scope});
  }
  report.push({width,geometry,motion,midway,unchangedViews,physicalPhoneVerified:false});
 }finally{await app.close();}
}
await saveReport('pokemon-card-surface',report);
}catch(error){await saveReport('pokemon-card-surface',report,error);throw error;}finally{await browser.close();await server.close();}
