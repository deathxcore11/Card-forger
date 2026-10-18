import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startServer,openApp,capture,inventorySnapshot} from './detail-rules-fixtures.mjs';
import {noOverflow} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Hosted browser QA only.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const cases=[['ptcg','swsh4.5sv-SV107','charizard-vmax.png','card','micro'],['ptcg','me02.5-022','mega-charizard.png','card','rainbow'],['ptcg','cel25-10','zekrom.png','pk-cel-art','holo'],['ygo','dracotail-lukias','dracotail-lukias.jpg','ygo-broad','starlight']];
try{for(const [game,id,file,mask,material] of cases){
 const app=await openApp(browser,server.base,{game,width:390}),{page,context}=app;
 try{
  const raw=JSON.parse(await readFile('test-fixtures/finish-effects/'+id+'.json','utf8')),bytes=await readFile('test-fixtures/finish-effects/'+file);
  await context.route('https://visual-regression.invalid/**',route=>route.fulfill({contentType:file.endsWith('png')?'image/png':'image/jpeg',body:bytes}));
  const before=await inventorySnapshot(page);
  await page.evaluate(async({game,raw,file})=>{
   const T=await import('/tcg.js'),adapter=await import(game==='ptcg'?'/ptcg.js':'/ygo.js'),c=game==='ptcg'?adapter.normalizePtcg(raw):adapter.normalizeYgo(raw);
   c.image=c.imageLarge='https://visual-regression.invalid/'+file;
   c.images=[{id:c.id,image:c.image,small:c.image,art:c.image}];
   if(game==='ptcg')for(const v of c.variants){v.image=c.image;v.imageLarge=c.image;}
   T.cache[game][c.id]=c;
   const ctx={type:'tcard',game,id:c.id,tab:'overview',priceFinish:game==='ptcg'?c.variants[0].key:'reference',priceEdition:game==='ygo'?'JUSH-EN001::Starlight Rare':''};
   window.__uiTestState.ui.sheetCtx=ctx;
   const sheet=document.querySelector('#sheet'),body=document.querySelector('#sheetBody');body.innerHTML=T.tcgCardSheet(c,ctx);sheet.showModal();
  },{game,raw,file});
  const card=page.locator('#sheet .cd-img');await card.scrollIntoViewIfNeeded();await card.locator('.finish-overlay').waitFor();
  const model=await card.evaluate(n=>JSON.parse(n.dataset.finishModel));assert(model.layers.some(l=>l.mask===mask&&l.material===material),id+' correct source-specific treatment');
  assert.equal(await page.locator('[data-finish-toggle]').count(),0);
  await page.mouse.move(0,0);await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:30,gamma:0})));
  await page.waitForFunction(()=>document.querySelector('#sheet .cd-img').classList.contains('gyro'));
  const first=await card.evaluate(n=>n.style.getPropertyValue('--mx'));
  await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:38,gamma:12})));
  await page.waitForFunction(first=>document.querySelector('#sheet .cd-img').style.getPropertyValue('--mx')!==first,first);
  assert.equal(await card.locator('.finish-spotlight').count(),1,'Neutral soft tilt light exists independently of the material');
  for(const width of [390,673,768,1440]){
   await page.setViewportSize({width,height:1050});await card.scrollIntoViewIfNeeded();await noOverflow(page,'#sheetBody',id+' '+width);
   await capture(page,'finish-effects-real-'+id.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+width);
  }
  assert.equal(await inventorySnapshot(page),before);
  console.log('PASS: real printing '+id+' correct region/material, soft moving gyro light, responsive full card.');
 }finally{await context.close();}
}}finally{await browser.close();await server.close();}
