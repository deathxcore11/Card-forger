// Actual app/renderer, deterministic providers and synthetic art. Hosted browser only.
import assert from 'node:assert/strict';
import {CARDS,RAW,ISO,makeFixtures,startServer,openApp,capture,saveReport,inventorySnapshot} from './detail-rules-fixtures.mjs';
import {validateWorkspace} from '../confidence.js';
const card=CARDS.ygo[0],id=card.id;
const printing=(code,rarity)=>({name:'Saved identity layout fixture',code,rarity,price:1.4});
card.sets=[printing('SET-001',"Collector's Rare"),printing('SET-002','Ultra Rare'),printing('SET-002','Common'),printing('SET-003','Ultra Rare'),printing('SET-003','Ultra Rare')];
RAW.ygo[0].card_sets=card.sets.map(p=>({set_name:p.name,set_code:p.code,set_rarity:p.rarity,set_price:'1.40'}));
const lot=(key,printing,rarity,edition='1st-edition')=>({id:key,cardId:id,key:'id:'+id,name:card.name,qty:1,condition:'Near Mint',language:'en',printing,rarity,edition,addedAt:ISO,manualValue:1.4,manualValueCondition:'Near Mint',manualValueCurrency:'USD'});
const lots=[lot('saved-ultra','SET-002','Ultra Rare'),lot('saved-common','SET-002','Common'),lot('saved-collector','SET-001',"Collector's Rare"),lot('saved-missing','MISSING-001','Ultra Rare'),lot('saved-ambiguous','SET-003','Ultra Rare'),lot('saved-unlimited','SET-002','Ultra Rare','unlimited')];
const fixture=makeFixtures('ygo');fixture.state.tcg.ygo.collection=structuredClone(lots);
assert.deepEqual(validateWorkspace(structuredClone(fixture.state)).tcg.ygo.collection.map(e=>[e.id,e.printing,e.rarity,e.edition]),lots.map(e=>[e.id,e.printing,e.rarity,e.edition]));
assert.equal(card.sets[0].rarity,"Collector's Rare");assert.equal(card.sets.filter(p=>p.code==='SET-003'&&p.rarity==='Ultra Rare').length,2);
if(process.argv.includes('--validate-fixtures')){console.log('PASS: saved Ultra/cache-first CR, Common, Collector, missing/ambiguous and edition fixture identities survive actual workspace validation; no browser/server started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted browser only; use --validate-fixtures locally.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const report=[];let app,error;
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const selector=id=>`.display-list > .lot:has(> .lot-art[data-entry="${id}"])`;
async function checkIdentity(page){
 for(const [key,badge,flair,effect]of [['saved-ultra','UR','yr3','ygo-ultra'],['saved-unlimited','UR','yr3','ygo-ultra'],['saved-common','C','yr0','plain'],['saved-collector','CR','yr4','unknown'],['saved-missing',null,null,'unknown'],['saved-ambiguous',null,null,'unknown']]){
  const row=page.locator(selector(key)),art=row.locator('.lot-art');await row.waitFor();
  assert.equal(await row.getAttribute('data-rarity-flair'),flair,key+' exact rim');assert.equal(await row.getAttribute('data-tier'),'t0',key+' $1.40 frame is independent of rarity');
  assert.equal(await art.getAttribute('data-finish-effect'),effect,key+' supported exact finish');
  const actualBadges=await row.locator('.tset small').allTextContents();assert.deepEqual(actualBadges,badge?[badge,badge]:[],key+' both tile/row badges use owned identity');
  if(!badge){assert.match(await row.innerText(),/Printing not verified/);assert.equal(await row.locator('.finish-overlay').count(),0,key+' no borrowed shine');}
 }
}
async function measure(page,mode,width){
 await page.setViewportSize({width,height:1000});await frame(page);
 const art=page.locator(selector('saved-ultra')).locator('.lot-art');await art.scrollIntoViewIfNeeded();
 if(mode==='gallery')await art.locator('.finish-auto').waitFor();
 const data=await page.evaluate(({selector,mode,width})=>{
  const row=document.querySelector(selector),art=row.querySelector('.lot-art'),img=art.querySelector('img'),overlay=art.querySelector('.finish-overlay'),rect=n=>n?.getBoundingClientRect().toJSON(),s=getComputedStyle(art);
  return {mode,width,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,row:rect(row),art:rect(art),image:rect(img),imageFit:getComputedStyle(img).objectFit,imageReady:img.complete&&img.naturalWidth>0,overlay:rect(overlay),border:s.borderTopColor,borderWidth:s.borderTopWidth,radius:s.borderTopLeftRadius,overflow:s.overflow,priceTier:getComputedStyle(row).getPropertyValue('--tier').trim(),overlayRadius:overlay&&getComputedStyle(overlay).borderTopLeftRadius,overlayOverflow:overlay&&getComputedStyle(overlay).overflow,masks:overlay?[...overlay.querySelectorAll('.finish-layer')].map(n=>getComputedStyle(n).clipPath):[],tap:rect(row.querySelector('.stepper button'))};
 },{selector:selector('saved-ultra'),mode,width});
 const inside=(a,b,tol=2)=>a&&b&&a.left>=b.left-tol&&a.right<=b.right+tol&&a.top>=b.top-tol&&a.bottom<=b.bottom+tol;
 assert(data.documentWidth<=width+2,JSON.stringify(data));assert(data.imageReady,'Synthetic image decoded');assert(inside(data.art,data.row),'Art stays within row');assert(inside(data.image,data.art),'Image is contained by art bounds');
 assert.equal(data.border,'rgb(227, 185, 88)','Thin Ultra rim stays gold');assert.equal(data.borderWidth,'2px');assert.equal(data.priceTier,'#9aa3ad','Thick low-price frame stays grey');assert.equal(data.overflow,'hidden');assert.notEqual(data.radius,'0px');assert(data.tap.width>=24&&data.tap.height>=24,'Quantity tap target >=24px');
 if(mode==='gallery'){assert(inside(data.overlay,data.image,3),'Finish overlay remains inside exact displayed art');assert.equal(data.overlayOverflow,'hidden');assert.notEqual(data.overlayRadius,'0px');assert.equal(data.masks.length,2);assert(data.masks.every(p=>p&&p!=='none'),'Art/title masks are applied');}
 report.push(data);await capture(page,`synthetic-ygo-saved-${mode}-${width}`);
}
try{
 app=await openApp(browser,server.base,{game:'ygo',width:390});const {page}=app;
 // Deliberate synthetic fixture setup before taking the no-mutation snapshot.
 await page.evaluate(lots=>{window.__uiTestState.state.tcg.ygo.collection=lots;},lots);
 await page.locator('#content [data-act="viewSave"][data-mode="gallery"]').click();await page.waitForFunction(()=>document.querySelector('#content.view-gallery'));
 await checkIdentity(page);const before=await inventorySnapshot(page);
 for(const width of [320,390,768,1440,390])await measure(page,'gallery',width);
 await page.locator('#content [data-act="viewSave"][data-mode="compact"]').click();await page.waitForFunction(()=>document.querySelector('#content.view-compact'));
 for(const width of [320,390,768,1440,390])await measure(page,'compact',width);
 assert.equal(await inventorySnapshot(page),before,'Resizing and presentation controls never mutate saved identities/quantities');
 // Actual persisted application reload, including separate first/unlimited lots.
 await page.reload();await page.locator('#app.ready').waitFor();await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});await checkIdentity(page);
 assert.equal(await inventorySnapshot(page),before,'Saved/reopened editions and quantities remain distinct');
 assert.equal(await page.evaluate(id=>window.__uiTestTcg.cache.ygo[id].sets[0].rarity,id),"Collector's Rare",'Generic cache order was preserved');
 app.health();console.log('PASS: actual collection saved badge/rim/finish identity, no borrowed fallback, grey price frame, persisted editions and measured 320/390/768/1440 resize/mask/bounds/radius/tap geometry. Synthetic art is layout evidence only.');
}catch(e){error=e;if(app)await capture(app.page,'synthetic-ygo-saved-failure');throw e;}
finally{await saveReport('synthetic-ygo-saved-presentation',report,error);await app?.context.close();await browser.close();await server.close();}
