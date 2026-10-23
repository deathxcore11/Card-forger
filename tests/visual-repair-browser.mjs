import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startServer,openApp,inventorySnapshot} from './detail-rules-fixtures.mjs';
import {noOverflow} from './detail-rules-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Hosted browser QA only.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const failures=[];
const cases=[
 ['ygo','hot-red-dragon-abyss','hot-red-dragon-abyss.jpg','ygo-art','holo','HSRD-EN041::Ultra Rare'],
 ['ygo','psy-framegear-gamma','psy-framegear-gamma.jpg','ygo-art','holo','HSRD-EN031::Ultra Rare'],
 ['ygo','psy-framelord-omega','psy-framelord-omega.jpg','ygo-art','secret','HSRD-EN035::Secret Rare'],
 ['ygo','dracotail-lukias','dracotail-lukias.jpg','ygo-broad','starlight','JUSH-EN001::Starlight Rare'],
 ['ptcg','mantine-swsh1','mantine-swsh1.png','pk-swsh-surround','rainbow','reverse-holofoil'],
 ['ptcg','swsh4.5sv-SV107','charizard-vmax.png','card','micro'],
 ['ptcg','me02.5-022','mega-charizard.png','card','rainbow'],
 ['ptcg','cel25-10','zekrom.png','pk-cel-art','holo']];
try{for(const [game,id,file,mask,material,selection] of cases){
 const app=await openApp(browser,server.base,{game,width:390}),{page,context}=app;
 try{
  const raw=JSON.parse(await readFile('test-fixtures/finish-effects/'+id+'.json','utf8'));
  // Source-bound anniversary masks require the actual measured URL and bytes.
  const imageUrl=id==='cel25-10'?raw.image+'/high.webp':'https://visual-regression.invalid/'+file;
  const bytes=await readFile(id==='cel25-10'?'tests/fixtures/anniversary-frames/cel25-10-high.webp':'test-fixtures/finish-effects/'+file);
  if(id==='cel25-10')await context.route(imageUrl,route=>route.fulfill({contentType:'image/webp',body:bytes}));
  await context.route('https://visual-regression.invalid/**',route=>route.fulfill({contentType:file.endsWith('png')?'image/png':'image/jpeg',body:bytes}));
  await context.route(url=>url.hostname==='api.tcgdex.net'&&url.pathname==='/v2/en/cards',route=>route.fulfill({contentType:'application/json',body:'[]'}));
  await context.route(url=>url.hostname==='api.tcgdex.net'&&url.pathname.endsWith('/cards/'+id),route=>route.fulfill({contentType:'application/json',body:JSON.stringify(raw)}));
  await context.route('https://images.ygoprodeck.com/**',route=>route.fulfill({contentType:'image/jpeg',body:bytes}));
  const before=await inventorySnapshot(page);
  await page.evaluate(async({game,raw,imageUrl,selection})=>{
   const T=await import('/tcg.js'),adapter=await import(game==='ptcg'?'/ptcg.js':'/ygo.js'),c=game==='ptcg'?adapter.normalizePtcg(raw):adapter.normalizeYgo(raw);
   c.image=c.imageLarge=imageUrl;
   c.brief=false;c.fetchedAt=new Date().toISOString();c.printPriceSchema=1;
   if(game==='ptcg')for(const v of c.variants){v.image=c.image;v.imageLarge=c.image;}
   T.cache[game][c.id]=c;
   T.ui(game).sets.list=[{id:game==='ptcg'?c.set.id:'JUSH',name:'Source printing fixture'}];
   const opener=document.createElement('button');opener.id='real-printing-opener';opener.textContent='Open source printing';Object.assign(opener.dataset,{act:'tCard',game,id:c.id,setVariant:game==='ptcg'?(selection||c.variants[0].key):'',printing:game==='ygo'?selection:''});document.querySelector('#content').prepend(opener);
  },{game,raw,imageUrl,selection});
  await page.locator('#real-printing-opener').click();
  await page.waitForFunction(game=>{const ctx=window.__uiTestState.ui.sheetCtx;return ctx?.type==='tcard'&&ctx.game===game&&(game!=='ptcg'||ctx.previewBusy===false);},game);
  const card=page.locator('#sheet .cd-img');await card.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await card.locator('.finish-overlay:not([hidden])').waitFor();
  const model=await card.evaluate(n=>JSON.parse(n.dataset.finishModel));assert(model.layers.some(l=>l.mask===mask&&l.material===material),id+' correct source-specific treatment');
  assert.equal(await page.locator('[data-finish-toggle]').count(),0);
  await page.mouse.move(0,0);await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:30,gamma:0})));
  await page.waitForFunction(()=>document.querySelector('#sheet .cd-img').classList.contains('gyro'));
  const first=await card.evaluate(n=>n.style.getPropertyValue('--mx'));
  await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:38,gamma:12})));
  await page.waitForFunction(first=>document.querySelector('#sheet .cd-img').style.getPropertyValue('--mx')!==first,first);
  assert.equal(await card.locator('.finish-spotlight').count(),1,'Neutral soft tilt light exists independently of the material');
  for(const width of [320,390,673,768,1024,1440]){
   await page.setViewportSize({width,height:1050});await card.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await card.evaluate(async n=>{await Promise.all(n.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
   const overflow=await page.locator('#sheetBody').evaluate(root=>{if(root.scrollWidth<=root.clientWidth+2)return null;const box=root.getBoundingClientRect();return [...root.querySelectorAll('*')].filter(n=>n.getClientRects().length&&!n.closest('.cs-tabs,.card-printing-mini-rail,[hidden]')).map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.tagName,cls:n.className,left:r.left,right:r.right,width:r.width,scroll:n.scrollWidth,client:n.clientWidth,transform:s.transform};}).filter(r=>r.right>box.right+.5||r.left<box.left-.5).slice(0,30);});if(overflow)console.log('OVERFLOW',id,width,JSON.stringify(overflow));await noOverflow(page,'#sheetBody',id+' '+width);
   const geometry=await card.locator('img').first().evaluate(img=>{const s=getComputedStyle(img),w=img.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),h=img.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);return {fit:s.objectFit,error:Math.abs(w/h-img.naturalWidth/img.naturalHeight)};});assert.equal(geometry.fit,'contain');assert(geometry.error<.003,id+' keeps the complete source aspect ratio');
   assert(await page.locator('#sheet .card-buy-link > span:first-child').evaluate(n=>{const c=document.createElement('canvas').getContext('2d'),s=getComputedStyle(n);c.font=s.font;return Math.max(...n.textContent.split(/\s+/).map(w=>c.measureText(w).width))<=n.getBoundingClientRect().width+1;}),'Seller words never break across lines');
   await page.screenshot({path:'test-results/finish-effects-real-'+id.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+width+'.png',fullPage:false});
  }
  // Repeated tab/price repaint and zoom must retain exactly the same finish.
  for(let pass=0;pass<3;pass++){
   await page.locator('#sheet [data-act="cardTab"][data-tab="prices"]').first().click();
   await page.locator('#sheet [data-act="cardTab"][data-tab="overview"]').first().click();
   await card.scrollIntoViewIfNeeded();await card.locator('.finish-overlay:not([hidden])').waitFor();
   assert.equal(await card.evaluate(n=>JSON.parse(n.dataset.finishModel).key),model.key);
  }
  await page.locator('#sheet .cd-zoom').click();await page.locator('.zoom-card-surface .finish-overlay').waitFor();
  await page.screenshot({path:'test-results/finish-effects-real-'+id+'-zoom.png',fullPage:false});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.zoom-card-surface'));
  assert.equal(await inventorySnapshot(page),before);
  console.log('PASS: real printing '+id+' correct region/material, soft moving gyro light, responsive full card.');
 }catch(error){await page.screenshot({path:'test-results/finish-effects-real-failure-'+id+'.png',fullPage:false});failures.push(error);}finally{await context.close();}
}if(failures.length)throw new AggregateError(failures,'Source printing stress checks failed');}finally{await browser.close();await server.close();}
