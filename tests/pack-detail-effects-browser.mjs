import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CARDS,SETS,LOB,ISO,startServer,openSearchApp,inventorySnapshot} from './search-fixtures.mjs';
import {noOverflow} from './detail-rules-fixtures.mjs';
import {normalizePtcg} from '../ptcg.js';
const bearticRaw=JSON.parse(fs.readFileSync(new URL('./fixtures/beartic-sv10.5b-026.json',import.meta.url)));
const beartic={...normalizePtcg(bearticRaw),fetchedAt:ISO,printPriceSchema:1};
const cases=[{game:'mtg',card:CARDS.mtg[0],set:SETS.mtg[0]},
 {game:'ptcg',card:beartic,set:{...bearticRaw.set,releaseDate:'2025-07-18'}},
 {game:'ygo',card:CARDS.ygo.find(c=>c.id==='89631139'),set:LOB}];
assert(beartic.variants.some(v=>v.key==='holofoil'));
assert(!beartic.variants.some(v=>v.key==='normal'),'Beartic has no invented Normal finish');
if(process.argv.includes('--validate-fixtures')){console.log('PASS: same exact Magic/Pokémon/Yu-Gi-Oh! printing/foil through set entry and pack inspect; actual modal/sensor/inventory regression fixture.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted CI only');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
fs.mkdirSync('test-results',{recursive:true});const report={status:'FAIL',cases:[],limits:'Synthetic touch/sensor events in hosted Chromium, not physical-device verification.'};let app;
try{
 for(const {game,card,set} of cases)for(const width of [390,768,1440]){
  app=await openSearchApp(browser,server.base,{game,width,height:1000,hasTouch:true,reducedMotion:'no-preference',evidenceLabel:'pack-detail-'+game,
   prepareFixtures:fixtures=>{if(game==='ptcg')fixtures.cache.ptcg[card.id]=card;},
   providerOverride:url=>{
    if(url.pathname==='/data/mtg-boosters/fxa.json')return {status:404,body:{error:'Synthetic booster uses fallback sampler'}};
    if(game==='ptcg'&&url.hostname==='api.tcgdex.net'){
     if(url.pathname==='/v2/en/cards/'+card.id)return {body:bearticRaw};
     if(url.pathname==='/v2/en/cards'&&url.searchParams.get('name')?.includes('Beartic'))return {body:[bearticRaw]};
    }
    if(game==='ptcg'&&url.hostname==='assets.tcgdex.net'&&url.pathname.includes('/sv/sv10.5b/'))return {contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#245877"/><text x="20" y="60" fill="white">SYNTHETIC BEARTIC ART</text></svg>'};
   }});
  const {page}=app,before=await inventorySnapshot(page);
  await page.evaluate(async({game,card,set})=>{
   const {S}=await import('/store.js'),T=await import('/tcg.js'),{packButton}=await import('/set-experience.js'),{esc}=await import('/ui.js');
   S.ui.view='set';
   if(game==='mtg')Object.assign(S.ui.set,{code:set.code,info:{...set,card_count:1},cards:[card],loaded:true,busy:false,error:''});
   else{
    if(game==='ptcg')T.ui(game).sets.list.push(set);
    const scoped=T.setContextCard(game,card,set,T.ui(game).sets.list);
    Object.assign(T.ui(game).set,{id:set.id,info:set,cards:[scoped],loaded:true,busy:false,error:'',contents:{completeness:'complete'}});
   }
   S.ui.packFeatured={game,id:card.id,name:card.name,date:'2026-10-17',card,...(game==='ygo'?{rarity:'Ultra Rare'}:{})};
   const attrs=game==='mtg'?`data-act="card" data-name="${esc(card.name)}" data-set-finish="foil"`:`data-act="tCard" data-game="${game}" data-id="${esc(card.id)}" data-set-id="${esc(set.id)}" ${game==='ptcg'?'data-set-variant="holofoil"':'data-printing="LOB-001::Ultra Rare"'}`;
   document.querySelector('#content').innerHTML=`<button ${attrs} data-set-i="0">Inspect set card</button>${packButton(game,set,{ready:true})}`;
  },{game,card,set});
  const settleDetails=async()=>{
   await page.waitForFunction(game=>{const c=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&c&&(game==='mtg'?c.type==='card'&&!c.detailsBusy&&!c.printsBusy:c.type==='tcard'&&!c.previewBusy);},game);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  };
  await page.locator('[data-set-i="0"]').click();await settleDetails();
  const detail=page.locator('#sheetBody .cd-img');await detail.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await detail.locator('.finish-overlay').waitFor();
  const fromSet=await detail.getAttribute('data-finish-model');
  await page.locator('#sheet [data-act="closeSheet"]').click();
  await page.locator('[data-act="openSetPack"]').click();await page.locator('[data-pack="open"]').click();
  await page.locator('.pack-card').first().click();
  const pack=page.locator('.pack-dialog');const pulls=await pack.locator('.pack-card').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')));
  await page.locator('.pack-face .finish-overlay').waitFor();
  await page.locator('.pack-focus-card').click();await settleDetails();await detail.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await detail.locator('.finish-overlay').waitFor();
  assert.equal(await detail.getAttribute('data-finish-model'),fromSet,'Pack details use the identical printing/finish model as the set');
  assert(await pack.evaluate(n=>n.classList.contains('pack-under')&&n.open));
  assert(await page.evaluate(()=>[...document.querySelectorAll('dialog[open]')].at(-1).classList.contains('pack-dialog')),'Regression keeps pack later in DOM order');
  assert(await page.evaluate(async()=>{const {motionCard}=await import('/feel.js');return motionCard()===document.querySelector('#sheetBody .cd-img');}));
  await page.waitForFunction(()=>!document.querySelector('.pack-face .finish-overlay'));
  await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:30,gamma:0})));
  await page.waitForTimeout(50);
  await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:42,gamma:12})));
  await page.waitForFunction(()=>{const c=document.querySelector('#sheetBody .cd-img');return c.classList.contains('gyro')&&parseFloat(c.style.getPropertyValue('--tx'))>0;});
  await detail.hover();await page.mouse.move((await detail.boundingBox()).x+20,(await detail.boundingBox()).y+40);
  assert(await detail.evaluate(n=>n.classList.contains('tilting')),'Pointer interaction remains available');
  await noOverflow(page,'#sheetBody',`${game} pack card details ${width}`);
  await page.screenshot({path:`test-results/finish-effects-pack-detail-${game}-${width}.png`,fullPage:true,animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.finish-overlay'));
  await page.emulateMedia({reducedMotion:'no-preference'});await detail.locator('.finish-overlay').waitFor();
  await page.locator('#sheet [data-act="closeSheet"]').click();await page.waitForFunction(()=>!document.querySelector('.pack-dialog').classList.contains('pack-under'));
  await page.locator('.pack-face .finish-overlay').waitFor();
  assert.deepEqual(await pack.locator('.pack-card').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label'))),pulls,'Closing details resumes the same pulls and reveal state');
  assert.deepEqual(await inventorySnapshot(page),before,'Opening/tilting/closing pack details never changes saved inventory');
  await page.locator('[data-pack="close"]').click();
  assert.deepEqual(app.diagnostics().errors,[]);report.cases.push({game,width,printingId:card.id,result:'PASS'});
  await app.context.close();app=null;
 }
 report.status='PASS';console.log('PASS: pack details retain exact set foil, foreground overlay, gyro/pointer input, reduced motion, same-pack resume and inventory at phone/tablet/desktop widths.');
}finally{fs.writeFileSync('test-results/finish-effects-pack-detail-report.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
