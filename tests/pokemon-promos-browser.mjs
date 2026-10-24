// Hosted real-app regression for exact promo identities and bounded foil masks.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer,openApp,closeSheet,noOverflow,RESULTS} from './detail-rules-fixtures.mjs';
import {artworkSources} from '../artwork.js';
import {chooseInlinePrinting} from './scanner-review-controls.mjs';
import {seedReviews,openReview} from './condition-refresh-fixtures.mjs';
import {PROMO_IDS,COSMOS_IDS,STAMPED_IDS,GM_KEY,PROMO_EVIDENCE,loadPromoFixtures,validatePromoFixtures,promoFile} from './pokemon-promos-fixtures.mjs';

const data=await loadPromoFixtures();console.log(validatePromoFixtures(data));
if(process.argv.includes('--validate-fixtures'))process.exit(0);
assert.equal(process.env.GITHUB_ACTIONS,'true','Promo UI QA is hosted-only. Locally use --validate-fixtures; do not start a browser/server.');
const {chromium}=await import('playwright');
const report={evidence:PROMO_EVIDENCE,checks:[],artRequests:[],providerRequests:[],unavailableArt:[],physicalPhoneVerified:false};
const inventorySnapshot=page=>page.evaluate(()=>{const s=window.__uiTestState.state;return JSON.stringify({collection:s.collection,printings:s.printings,decks:s.decks,wishlist:s.wishlist,myPrices:s.myPrices,priceChoices:s.priceChoices,valueHistory:s.valueHistory,tcg:s.tcg});});
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const shot=(page,name)=>page.screenshot({path:resolve(RESULTS,'pokemon-promos-'+name+'.png'),animations:'disabled',fullPage:false});
const rowId=id=>'promo-owned-'+id;
let server,browser,app,error,scannerTrace=false;
// Scanner diagnostics are observational only: no handler invocation, state
// mutation, forced click, animation suppression, or additional provider request.
async function scannerDiagnostic(page,phase){
 const sample=await page.evaluate(phase=>{
  const S=window.__uiTestState,s=S?.ui.scan,shape=n=>{if(!n)return null;const r=n.getBoundingClientRect(),c=getComputedStyle(n);return {tag:n.tagName,cls:n.className,act:n.dataset?.act||'',connected:n.isConnected,rect:r.toJSON(),display:c.display,position:c.position,visibility:c.visibility,opacity:c.opacity,transform:c.transform,animation:c.animation,overflow:c.overflow,pointerEvents:c.pointerEvents,disabled:!!n.disabled,text:n.textContent?.trim().slice(0,120)};};
  const selectors=['#app','#content','.scan-workspace','.scan-toolbar','.scan-panel','.scan-pile-tray','.scan-pile','.scan-pile-cards','.scan-confirm','.bottom-nav','#toast'];
  const pile=document.querySelector('.scan-pile'),r=pile?.getBoundingClientRect(),x=r?r.x+r.width/2:0,y=r?r.y+r.height/2:0;
  return {phase,at:Date.now(),view:S?.ui.view,bodyView:document.body.dataset.view,hash:location.hash,ready:document.readyState,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,visual:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null},scan:{mode:s?.mode||'live',camOn:!!s?.camOn,busy:!!s?.busy,batchSaving:!!s?.batchSaving,catalogInitGame:s?.catalogInitGame||'',catalogMeta:!!s?.catalogMeta,ocrWarm:!!s?.ocrWarm,status:s?.status||'',confirm:s?.confirm?{batchId:s.confirm.batchId,game:s.confirm.game,presented:s.confirm.presented,saving:s.confirm.saving}:null},batch:window.__conditionReview?.batch.loadBatch().map(e=>({id:e.id,game:e.game,status:e.status})),nodes:Object.fromEntries(selectors.map(key=>[key,shape(document.querySelector(key))])),hit:r?document.elementsFromPoint(x,y).slice(0,8).map(shape):[],animations:document.getAnimations().filter(a=>a.effect?.target?.closest?.('.scan-workspace')).map(a=>({state:a.playState,currentTime:a.currentTime,target:a.effect.target.className,timing:a.effect.getComputedTiming()})),mutations:window.__promoScannerDiagnostics?.mutations||[],events:window.__promoScannerDiagnostics?.events||[]};
 },phase);
 (report.scannerDiagnostics||=[]).push(sample);return sample;
}
async function observeScanner(page){
 await page.evaluate(()=>{
  const diagnostics=window.__promoScannerDiagnostics={mutations:[],events:[]},content=document.querySelector('#content');
  const describe=n=>({tag:n?.nodeName,cls:typeof n?.className==='string'?n.className:'',act:n?.dataset?.act||''});
  const observer=new MutationObserver(records=>{diagnostics.mutations.push(...records.slice(-100).map(r=>({at:Date.now(),target:describe(r.target),added:[...r.addedNodes].slice(0,4).map(describe),removed:[...r.removedNodes].slice(0,4).map(describe)})));if(diagnostics.mutations.length>100)diagnostics.mutations.splice(0,diagnostics.mutations.length-100);});
  observer.observe(content,{childList:true,subtree:true});
  for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{const button=e.target.closest?.('[data-act=scanBatchReview]');if(button&&diagnostics.events.length<30)diagnostics.events.push({at:Date.now(),type,target:describe(button),id:button.dataset.id||'',trusted:e.isTrusted});},true);
 });
}
async function settleDetail(page,id){
 await page.waitForFunction(id=>document.querySelector('#sheet')?.open&&window.__uiTestState.ui.sheetCtx?.id===id&&!window.__uiTestState.ui.sheetCtx?.previewBusy,id);
 await frames(page);assert.equal(await page.locator('#sheet .cs-title h2').innerText(),data.cards.find(c=>c.id===id).name);
}
async function openOwned(page,id,entryId=rowId(id)){
 const button=page.locator(`#content .lot-art[data-entry="${entryId}"]`);await button.scrollIntoViewIfNeeded();await button.click();await settleDetail(page,id);
}
async function selectFinish(page,key){
 const button=page.locator(`#sheet .finish-choice-rail [data-finish=${JSON.stringify(key)}]`);await button.scrollIntoViewIfNeeded();await button.click();
 await page.waitForFunction(key=>window.__uiTestState.ui.sheetCtx.priceFinish===key&&document.querySelector('.finish-choice-rail [aria-pressed="true"]')?.dataset.finish===key,key);await frames(page);
}
async function selected(page){return page.evaluate(async()=>{
 const S=window.__uiTestState,c=window.__uiTestTcg.cardOf('ptcg',S.ui.sheetCtx.id),ctx=S.ui.sheetCtx;
 const {quoteForContext}=await import('/pricing-presentation.js');const q=quoteForContext('ptcg',c,ctx);
 return {id:c.id,key:ctx.priceFinish,entry:ctx.entryId,model:JSON.parse(document.querySelector('#sheet .cd-img').dataset.finishModel),quote:{value:q.value,label:q.label,productId:q.variant?.productId??null,finish:q.finish},summary:document.querySelector('#sheet .card-price-reference').innerText,choices:[...document.querySelectorAll('#sheet .finish-choice-rail [data-finish]')].map(n=>({key:n.dataset.finish,label:n.textContent,selected:n.getAttribute('aria-pressed')}))};
});}
async function assertArtSurface(page,selector,id,expected){
 const host=page.locator(selector);await host.scrollIntoViewIfNeeded();
 await page.waitForFunction(({selector})=>{const n=document.querySelector(selector),i=n?.querySelector('img');return i?.complete&&i.naturalWidth>0&&n.querySelector('.finish-overlay');},{selector});await frames(page);
 const state=await host.evaluate(n=>{
  const img=n.querySelector('img'),overlay=n.querySelector('.finish-overlay'),model=JSON.parse(n.dataset.finishModel),r=img.getBoundingClientRect(),o=overlay.getBoundingClientRect();
  return {model,src:img.currentSrc,natural:{width:img.naturalWidth,height:img.naturalHeight},profile:overlay.dataset.materialProfile||'',layers:[...overlay.querySelectorAll('.finish-layer')].map(l=>({clip:l.style.clipPath,computedClip:getComputedStyle(l).clipPath})),pattern:overlay.querySelector('.finish-pattern')?.style.clipPath||'',geometry:{image:{x:r.x,y:r.y,width:r.width,height:r.height},overlay:{x:o.x,y:o.y,width:o.width,height:o.height}}};
 });
 assert(report.artRequests.some(row=>row.id===id&&row.url===state.src),'Rendered exact pinned art was intercepted for '+id);
 assert.equal(state.model.printingId,id);assert.equal(state.model.key,expected.key);
 assert.equal(state.model.status,expected.status||'approximate');assert.deepEqual(state.model.layers.map(l=>l.mask),expected.masks);
 if(expected.profile)assert.equal(state.profile,expected.profile);
 if(expected.reason)assert.match(state.model.reason,expected.reason);
 const {image:i,overlay:o}=state.geometry;for(const field of ['x','y','width','height'])assert(Math.abs(i[field]-o[field])<2,'Overlay and exact card art align: '+JSON.stringify(state.geometry));
 const masks=await page.evaluate(async()=>{const masks=(await import('/finish-effects.js')).FINISH_MASKS,probe=document.createElement('span');return Object.fromEntries(Object.entries(masks).map(([key,value])=>{probe.style.clipPath=value;return [key,probe.style.clipPath];}));});
 assert.deepEqual(state.layers.map(l=>l.clip),expected.masks.map(mask=>masks[mask]));
 if(id==='swsh3-161'&&expected.key==='reverse-holofoil'){
  assert.match(state.layers[0].clip,/^inset\(53% 8\.5% 13%(?: 8\.5%)?\)$/,'Exact conservative Trainer lower field, allowing equivalent CSS serialization');
  assert(0.53*state.natural.height>426,'Trainer lower-field mask begins below the reviewed artwork interior (y=426)');
 }
 return state;
}
async function assertNoInventoryChange(page,before,label){assert.equal(await inventorySnapshot(page),before,label+' does not change synthetic holdings, saved aliases, decks or other games');}
async function cardChoices(page,id){
 const expected=data.cards.find(c=>c.id===id).variants.filter(v=>!v.aliasOf).map(v=>v.key);
 await openOwned(page,id);const before=await inventorySnapshot(page);
 const actual=(await selected(page)).choices.map(v=>v.key);assert.deepEqual(actual.sort(),expected.slice().sort(),id+' has only real physical choices');
 await page.locator('#sheet [data-act="cardTab"][data-tab="versions"]').click();
 const versions=await page.locator('#card-panel-versions .variant-row [data-act="tOwn"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.print));
 assert.deepEqual(versions.sort(),expected.slice().sort(),id+' Versions has no phantom generic variant');
 await page.locator('#sheet [data-act="cardTab"][data-tab="prices"]').click();
 const prices=page.locator('#sheet [data-change="cardPriceFinish"]');assert.equal(await prices.count(),1,id+' has the real Prices finish selector');
 const priceKeys=await prices.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(v=>v&&v!=='reference'));assert.deepEqual(priceKeys.sort(),expected.slice().sort(),id+' Prices choices');
 await page.locator('#sheet [data-act="tOwn"]').first().click();await page.locator('#tPrint').waitFor();
 const add=await page.locator('#tPrint option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));assert.deepEqual(add.sort(),expected.slice().sort(),id+' Add choices');
 await closeSheet(page);await assertNoInventoryChange(page,before,id+' tab/add preview');
 report.checks.push({id,phase:'finish-versions-prices-add-choices',keys:expected,inventoryUnchanged:true});
}
try{
 server=await startServer();browser=await chromium.launch();app=await openApp(browser,server.base,{game:'ptcg',width:390,isMobile:true});const {page}=app;
 const rawById=new Map(data.raw.map(c=>[c.id,c]));
 // Exact public records are fulfilled locally. Every other route retains the
 // base harness's deny-all-external-write/unmapped-request guard.
 await app.context.route(/^https:\/\/api\.tcgdex\.net\/v2\/en\/cards(?:\/[^?]+)?(?:\?.*)?$/,async route=>{
  const request=route.request(),url=new URL(request.url());assert.equal(request.method(),'GET');report.providerRequests.push(url.href);
  const id=decodeURIComponent(url.pathname.split('/cards/')[1]||'');
  const name=(url.searchParams.get('name')||'').replace(/^eq:/,'').toLowerCase();
  const body=id?rawById.get(id):data.raw.filter(c=>!name||c.name.toLowerCase().includes(name));
  assert(body,'No unmatched card identity may borrow a fixture response: '+id);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const sets=[...new Map(data.raw.map(c=>[c.set.id,c.set])).values()];
 await app.context.route(/^https:\/\/api\.tcgdex\.net\/v2\/en\/sets(?:\/[^?]+)?(?:\?.*)?$/,async route=>{
  assert.equal(route.request().method(),'GET');const id=decodeURIComponent(new URL(route.request().url()).pathname.split('/sets/')[1]||'');
  const set=id?sets.find(s=>s.id===id):null;assert(!id||set,'Only fixture set identities may be read');
  await route.fulfill({status:200,json:id?{...set,cards:data.raw.filter(c=>c.set.id===id)}:sets});
 });
 await app.context.route(/^https:\/\/api\.pokemontcg\.io\/v2\/cards(?:\?.*)?$/,route=>route.fulfill({status:200,json:{data:[]}}));
 await app.context.route(server.base+'/api/prices/recent?*',route=>route.fulfill({status:200,json:{series:[],points:[]}}));
 // Historical source quotes only; no current fallback or condition quote is invented.
 await app.context.route(server.base+'/api/prices/pokemon?*',route=>route.fulfill({status:200,json:{prices:[],products:[],quotes:[]}}));
 await app.context.route(server.base+'/api/prices/conditions?*',route=>route.fulfill({status:200,json:{status:'unpriced',quotes:[],reason:'Synthetic isolation: no condition quote supplied'}}));
 const imageMap=new Map();
 for(const card of data.cards){
  const exact=new Set([card.image,card.imageLarge,...card.variants.flatMap(v=>[v.image,v.imageLarge])].filter(Boolean));
  for(const url of [...exact,...artworkSources(card,true),...artworkSources(card,false)])imageMap.set(new URL(url,server.base+'/').href,{id:card.id,exact:exact.has(url)});
 }
 for(const [url,{id,exact}]of imageMap){await app.context.route(url,async route=>{
  assert.equal(route.request().method(),'GET');const art=exact&&data.art[id];
  if(!art){report.unavailableArt.push({id,url});return route.fulfill({status:404,body:'No pinned exact image. Never substitute another card.'});}
  report.artRequests.push({id,url,source:art.source.source,sha256:art.source.sha256});return route.fulfill({status:200,contentType:'image/webp',body:art.bytes});
 });}
 await page.evaluate(async({raw,ids,cosmos,stamped,gm})=>{
  const {normalizePtcg}=await import('/ptcg.js'),S=window.__uiTestState,T=window.__uiTestTcg;
  const cards=raw.map(normalizePtcg);for(const c of cards){c.fetchedAt=new Date().toISOString();T.cache.ptcg[c.id]=c;}
  const lot=(c,key,id)=>({id,cardId:c.id,name:c.name,qty:1,variant:key,condition:'Near Mint',language:'en',location:'Synthetic promo fixture',addedAt:new Date().toISOString(),raw:{}});
  S.state.tcg.ptcg.collection=cards.map(c=>lot(c,cosmos.includes(c.id)?c.variants.find(v=>v.foil==='cosmos'&&!v.aliasOf).key:c.id==='swsh3-161'?'reverse-holofoil':c.variants.find(v=>!v.aliasOf).key,'promo-owned-'+c.id));
  for(const id of stamped){const c=cards.find(c=>c.id===id);S.state.tcg.ptcg.collection.push(lot(c,'holofoil','promo-alias-'+id));}
  const ponyta=cards.find(c=>c.id==='swshp-SWSH013');S.state.tcg.ptcg.collection.push(lot(ponyta,gm,'promo-general-mills'));
  S.state.tcg.ptcg.collection.push({...lot(ponyta,'holofoil','promo-conflicting-product'),productId:232767});
  S.state.tcg.ptcg.collection.push({...lot(ponyta,'holofoil','promo-conflicting-manual'),productId:232767,manualValue:.77,manualValueCondition:'Near Mint',manualValueCurrency:'USD'});
  S.state.tcg.ptcg.valueHistory=[];S.state.settings.displayModes={...S.state.settings.displayModes,ptcg:{...S.state.settings.displayModes?.ptcg,collection:'compact'}};
  const ui=T.ui('ptcg').coll;Object.assign(ui,{tab:'cards',q:'',set:'',kind:'',rarity:'',limit:120,show:'all'});
  window.__promoCards=cards;dispatchEvent(new Event('cardstashy-rerender'));
 },{raw:data.raw,ids:PROMO_IDS,cosmos:COSMOS_IDS,stamped:STAMPED_IDS,gm:GM_KEY});
 await page.locator(`#content .lot-art[data-entry="${rowId('swshp-SWSH032')}"]`).waitFor();await frames(page);
 const baseline=await inventorySnapshot(page);
 for(const id of PROMO_IDS)await cardChoices(page,id);
 await assertNoInventoryChange(page,baseline,'All 17 card choice checks');
 for(const id of [...COSMOS_IDS,'swsh3-161']){
  await openOwned(page,id);const card=data.cards.find(c=>c.id===id),key=id==='swsh3-161'?'reverse-holofoil':card.variants.find(v=>v.foil==='cosmos'&&!v.aliasOf).key;
  const expected={key,masks:[id==='swsh3-161'?'pk-swsh-trainer-field':'pk-swsh-art'],...(id==='swsh3-161'?{reason:/partial coverage/i}:{profile:'cosmos-holo',reason:/simulat|approximate/i})};
  await selectFinish(page,key);
  for(const width of [320,1440]){
   await page.setViewportSize({width,height:1000});await frames(page);const detail=await assertArtSurface(page,'#sheet .cd-img',id,expected);
   await noOverflow(page,'#sheetBody',`${id} exact finish detail ${width}`,true);await shot(page,`${promoFile(id)}-detail-${width}`);
   await page.locator('#sheet .cd-zoom').click();await page.locator('.zoom-card-surface').waitFor();const zoom=await assertArtSurface(page,'.zoom-card-surface [data-finish-surface="zoom"]',id,expected);
   await noOverflow(page,'dialog.zoom',`${id} exact finish zoom ${width}`,true);await shot(page,`${promoFile(id)}-zoom-${width}`);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.zoom-card-surface'));await settleDetail(page,id);
   assert.equal((await selected(page)).key,key,'Zoom close retains explicit finish');await assertNoInventoryChange(page,baseline,id+' detail/zoom');
   report.checks.push({id,phase:'exact-real-art-detail-and-zoom',width,detail,zoom,inventoryUnchanged:true});
  }
  if(id==='swsh3-161'){
   await selectFinish(page,'normal');const normal=await assertArtSurface(page,'#sheet .cd-img',id,{key:'normal',masks:[],status:'verified'});assert.equal(normal.model.effect,'plain');
   await selectFinish(page,'reverse-holofoil');assert.match((await selected(page)).model.reason,/partial coverage/i);
  }
  await closeSheet(page);await openOwned(page,id);assert.equal((await selected(page)).key,key,'Reopening restores saved exact finish, not last preview');await closeSheet(page);
 }
 await page.setViewportSize({width:390,height:1000});
 // Same card, distinct products: repeated preview switches change neither the
 // null General Mills quote nor the saved Cosmos lot.
 await openOwned(page,'swshp-SWSH013');
 for(const key of [GM_KEY,'holofoil',GM_KEY,'holofoil',GM_KEY]){
  await selectFinish(page,key);const state=await selected(page);
  assert.equal(state.quote.productId,key===GM_KEY?232767:206430);assert.equal(state.quote.value,key===GM_KEY?null:13.34);
  assert.match(state.quote.label,key===GM_KEY?/General Mills/i:/Cosmos/i);
  assert.match(state.summary,key===GM_KEY?/No quote yet/:/\$13\.34/);
  if(key===GM_KEY){assert.doesNotMatch(state.summary,/13\.34/);assert.notEqual(state.model.materialProfile,'cosmos-holo','General Mills does not borrow the Cosmos material');}else assert.equal(state.model.materialProfile,'cosmos-holo');
  report.checks.push({phase:'Ponyta-exact-product-null-isolation',state});
 }
 await shot(page,'Ponyta-General-Mills-unquoted-390');await closeSheet(page);
 await openOwned(page,'swshp-SWSH013','promo-general-mills');assert.equal((await selected(page)).key,GM_KEY);assert.equal((await selected(page)).quote.value,null);await closeSheet(page);
 for(const id of STAMPED_IDS){
  const card=data.cards.find(c=>c.id===id),alias=card.variants.find(v=>v.key==='holofoil');
  for(let repeat=0;repeat<2;repeat++){
   await openOwned(page,id,'promo-alias-'+id);const state=await selected(page);
   assert.equal(state.key,'holofoil','Saved compatibility key is never rewritten');assert.equal(state.quote.productId,alias.productId);assert.equal(state.quote.value,alias.usd);assert.equal(state.model.key,'holofoil');
   assert.equal(state.choices.length,card.variants.filter(v=>!v.aliasOf).length);assert.equal(state.choices.filter(v=>v.selected==='true').length,1);assert(state.choices.some(v=>v.key==='holofoil'&&v.selected==='true'));assert(!state.choices.some(v=>v.key===alias.aliasOf),'Requested alias replaces, never duplicates, its canonical choice');
   if(repeat===0)await shot(page,`${promoFile(id)}-legacy-alias-reopen-390`);await closeSheet(page);
   report.checks.push({id,phase:'legacy-alias-reopen',repeat,state});
  }
 }
 await assertNoInventoryChange(page,baseline,'Repeated preview switching and legacy alias reopening');
 // This malformed saved product must be quarantined, not silently rebound to Cosmos.
 const conflict=await page.evaluate(async()=>{const S=window.__uiTestState,T=window.__uiTestTcg,entry=S.state.tcg.ptcg.collection.find(e=>e.id==='promo-conflicting-product'),c=T.cardOf('ptcg',entry.cardId);return {price:T.entryPrice(c,entry),request:(await import('/condition-feed.js')).conditionRequest(c,entry,'ptcg'),entry:structuredClone(entry)};});
 assert.equal(conflict.price,null);assert.equal(conflict.request,null);assert.equal(conflict.entry.variant,'holofoil');assert.equal(conflict.entry.productId,232767);
 report.checks.push({phase:'conflicting-saved-product-isolation',conflict});
 await openOwned(page,'swshp-SWSH013','promo-conflicting-product');const conflictedDetail=await selected(page);assert.equal(conflictedDetail.quote.value,null);assert.equal(conflictedDetail.model.status,'unknown');assert.deepEqual(conflictedDetail.model.layers,[]);assert.match(conflictedDetail.summary,/No quote yet/);await closeSheet(page);
 const manualConflict=await page.evaluate(async()=>{const S=window.__uiTestState,T=window.__uiTestTcg,entry=S.state.tcg.ptcg.collection.find(e=>e.id==='promo-conflicting-manual'),c=T.cardOf('ptcg',entry.cardId);return {price:T.entryPrice(c,entry),request:(await import('/condition-feed.js')).conditionRequest(c,entry,'ptcg'),entry:structuredClone(entry)};});
 assert.equal(manualConflict.price,.77,'A valid private manual value survives product quarantine');assert.equal(manualConflict.request,null,'Manual value never authorizes a wrong-product condition request');
 const manualLabel=await page.locator('#content .lot-art[data-entry="promo-conflicting-manual"]').evaluate(n=>n.closest('.lot').querySelector('.price').textContent);assert.match(manualLabel,/\$0\.77/);
 report.checks.push({phase:'conflicting-product-manual-value-retained',manualConflict,conflictedDetail});
 // Promo patterns and unreviewed Trainer layouts show an approximate foil, labelled as such; the unmeasured
 // Trainer layout gets whole-card coverage, never a borrowed window.
 for(const id of ['swshp-SWSH074','swshp-SWSH251']){await openOwned(page,id);const state=await selected(page);assert.equal(state.model.status,'approximate');assert.match(state.model.reason,/approximate/);if(id==='swshp-SWSH251')assert.deepEqual(state.model.layers.map(l=>l.mask),['card']);await closeSheet(page);report.checks.push({id,phase:'approximate-control',state});}
 // Real scanner pile/inline printing UI, without camera, OCR, or Save.
 const scannerCards=data.cards.filter(c=>STAMPED_IDS.includes(c.id)||['swshp-SWSH013','swshp-SWSH220','swsh3-161'].includes(c.id));
 await mkdir(RESULTS,{recursive:true});await app.context.tracing.start({screenshots:true,snapshots:true,sources:true});scannerTrace=true;
 await observeScanner(page);await scannerDiagnostic(page,'before-seed');
 await seedReviews(page,'ptcg',{cards:scannerCards,condition:'Near Mint',selectedFinish:''});
 await scannerDiagnostic(page,'after-seed-navigation');
 assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),false,'Scanner regression runs with normal motion');
 // Observe past the ordinary 60 ms navigation count-up delay and 700 ms
 // animation, which used to replace this entire tray with its numeric count.
 await page.waitForTimeout(850);
 assert.equal(await page.locator('.scan-pile-tray').getAttribute('data-batch-count'),String(scannerCards.length));
 assert.equal(await page.locator('.scan-pile-tray[data-count]').count(),0);
 assert.equal(await page.locator('.scan-pile').count(),1,'Normal-motion animation must preserve the actual review button');
 assert.equal(await page.locator('.scan-pile').isEnabled(),true);
 for(const [i,card]of scannerCards.entries()){
  await scannerDiagnostic(page,'before-review-'+i);
  await openReview(page,i);await scannerDiagnostic(page,'after-review-'+i);await page.locator('.scan-inline-printings .printing-carousel[aria-busy="false"]').waitFor();
  const rows=await page.evaluate(id=>window.__uiTestState.ui.scan.confirm.inline.rows.filter(r=>r.cardId===id).map(r=>({key:r.key,variant:r.variantKey,productId:r.productId,selectable:r.selectable})),card.id);
  const expected=card.variants.filter(v=>!v.aliasOf).map(v=>v.key).sort();assert.deepEqual(rows.map(r=>r.variant).sort(),expected,'Scanner shows one row per physical version');assert.equal(new Set(rows.map(r=>r.key)).size,rows.length);assert(rows.every(r=>r.selectable));
  const actual=await page.evaluate(async card=>(await import('/scan-batch.js')).actualFinishes('ptcg',{card}),card);assert.deepEqual(actual.sort(),expected);
  const variantChips=page.locator('.scan-inline-printings .printing-slide.is-current .scan-chips [data-act="scanBrowseChoose"]');assert.equal(await variantChips.count(),rows.length,'Actual scanner presents each physical variant as a chip');
  const optionKeys=await variantChips.evaluateAll(nodes=>nodes.map(n=>n.dataset.key).filter(Boolean));assert.deepEqual(optionKeys.sort(),rows.map(r=>r.key).sort(),'Actual scanner DOM contains no alias-only extra choice');
  await chooseInlinePrinting(page,card.id,expected.at(-1));assert.equal(await page.evaluate(()=>window.__uiTestState.ui.scan.confirm.finish),expected.at(-1),'Actual scanner selection keeps the chosen exact finish');
  await noOverflow(page,'.scan-confirm',card.id+' scanner choices',true);await shot(page,`${promoFile(card.id)}-scanner-390`);await assertNoInventoryChange(page,baseline,'Scanner preview '+card.id);
  report.checks.push({id:card.id,phase:'actual-scanner-unique-choices',rows,inventoryUnchanged:true});
 }
 assert.equal(await page.evaluate(()=>window.__conditionReview.ocrCalls),0);await page.locator('[data-act="scanDismiss"]').first().click();
 await assertNoInventoryChange(page,baseline,'Complete promo suite');app.health();
 // Fresh isolated other-game instances prove the bounded Pokémon repair has
 // not changed ordinary Magic/YGO detail finish selection or owned payloads.
 if(scannerTrace){await app.context.tracing.stop({path:resolve(RESULTS,'pokemon-promos-scanner-trace.zip')});scannerTrace=false;}
 await app.context.close();app=null;
 for(const game of ['mtg','ygo']){
  const other=await openApp(browser,server.base,{game,width:390,isMobile:true});try{
   const before=await inventorySnapshot(other.page);await other.page.locator('#content .lot-art').first().click();await other.page.locator('#sheet .cd-img').waitFor();
   const model=await other.page.locator('#sheet .cd-img').evaluate(n=>JSON.parse(n.dataset.finishModel));assert.equal(model.game,game);assert(!model.layers.some(l=>l.mask==='pk-swsh-trainer-field'));assert.notEqual(model.materialProfile,'cosmos-holo');
   await closeSheet(other.page);await assertNoInventoryChange(other.page,before,game+' detail unaffected');other.health();report.checks.push({game,phase:'other-game-unaffected',model});
  }finally{await other.context.close();}
 }
 report.status='passed';console.log('PASS: exact promo art/detail/zoom, seven bounded Cosmos masks, partial Trainer reverse, all17 choice matrices, saved aliases, null quote isolation and no inventory mutation.');
}catch(caught){error=caught;report.status='failed';report.error=String(caught.stack||caught);if(app){await scannerDiagnostic(app.page,'failure').catch(()=>{});await shot(app.page,'failure').catch(()=>{});}throw caught;}
finally{if(scannerTrace&&app){await app.context.tracing.stop({path:resolve(RESULTS,'pokemon-promos-scanner-trace.zip')}).catch(()=>{});scannerTrace=false;}await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'pokemon-promos-browser.json'),JSON.stringify(report,null,2));if(app)await app.context.close();await browser?.close();await server?.close();}
