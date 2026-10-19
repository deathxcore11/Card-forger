// Hosted actual-app QA, not a replica of set/detail controls. No external
// requests are forwarded and no account or production state is used.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer,openApp,closeSheet,noOverflow} from './detail-rules-fixtures.mjs';
import {CELEBRATIONS_RAW,CELEBRATIONS_RELEASE,CELEBRATIONS_EXPECTED,CELEBRATIONS_LOTS,CELEBRATIONS_HISTORY,CELEBRATIONS_SVG,CELEBRATIONS_SOURCE_DATE,CELEBRATIONS_EVIDENCE} from './celebrations-fixtures.mjs';
import {CLASSIC_RAW,CLASSIC_RELEASE} from './classic-collection-fixtures.mjs';
import {normalizePtcg} from '../ptcg.js';
import {setCardFacets} from '../set-list-ui.js';
import {tcgCardSheet,tcgSet,cache,ui} from '../tcg.js';
import {S,blank} from '../store.js';
import {blankGame} from '../games.js';
import {artworkSources} from '../artwork.js';
import {resolveFinish} from '../finish-effects.js';
const cards=CELEBRATIONS_RAW.map(normalizePtcg);
assert.equal(cards.length,25);assert.equal(new Set(cards.map(c=>c.id)).size,25);assert.deepEqual(setCardFacets(cards,'ptcg').finishes,['holofoil']);
for(const [i,c] of cards.entries()){const e=CELEBRATIONS_EXPECTED[i];assert.equal(c.set.number,e.number);assert.equal(c.set.total,e.total);assert.equal(c.variants[0].productId,e.productId);assert.equal(c.variants[0].finish,'holofoil');assert.equal(c.prices.usd,20+i);assertModel(resolveFinish('ptcg',c,{priceFinish:'holofoil'}),e);if(!e.cardmarketVerified){assert.equal(c.prices.eur,null);assert.equal(c.cmProduct,null);}}
S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:blankGame(),ygo:blankGame()};ui('ptcg').sets.list=[CELEBRATIONS_RELEASE];Object.assign(ui('ptcg').set,{id:CELEBRATIONS_RELEASE.id,info:CELEBRATIONS_RELEASE,cards,loaded:true,finish:'holofoil',q:'',rarity:'',sort:'number',filter:'all',limit:120,contents:{completeness:'complete'}});for(const c of cards)cache.ptcg[c.id]=c;
assert.equal((tcgSet().match(/data-act="tCard"/g)||[]).length,25);for(const [i,c] of cards.entries()){const html=tcgCardSheet(c,{tab:'prices',priceFinish:c.variants[0].key,setId:'cel25',setVariant:c.variants[0].key});assert(html.includes(CELEBRATIONS_EXPECTED[i].display));assert(!html.includes('<span class="pt-label">Normal</span>'));assert(html.includes(i===22?'Finish preview unavailable for this printing.':'approximate'));assert(!html.includes('987.65'));}
if(process.argv.includes('--validate-fixtures')){console.log('PASS: synthetic25 actual-app inputs, exact regular identities, Holofoil facet, five unverified Cardmarket quotes withheld, 24 approximate/one unavailable models. Browser not started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Run browser QA only in approved hosted CI; --validate-fixtures is offline.');
const {chromium}=await import('playwright'),out=resolve('test-results/celebrations');await mkdir(out,{recursive:true});
const result={commit:process.env.GITHUB_SHA||null,evidence:CELEBRATIONS_EVIDENCE,checks:[],screenshots:[],captures:[],viewports:[390,1440],matrix:{detail:0,zoom:0,gallery:0},physicalFoilAccuracy:'not-verified',approximationPolicy:'24 labeled approximations, one unavailable',productionDeployment:false};
let server,browser,current;
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const saved=page=>page.evaluate(()=>JSON.stringify({collection:window.__uiTestState.state.tcg.ptcg.collection,history:window.__uiTestState.state.tcg.ptcg.valueHistory}));
async function capture(page,name){const file=name+'.png';await frames(page);await page.screenshot({path:resolve(out,file),fullPage:false,animations:'disabled'});result.screenshots.push(file);result.captures.push({file,kind:'viewport',viewport:page.viewportSize()});}
async function captureRegion(page,selector,name){
 const region=page.locator(selector);assert.equal(await region.count(),1);await region.scrollIntoViewIfNeeded();await frames(page);
 const box=await region.evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,visible:!!n.getClientRects().length&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'};});
 assert(box.visible&&box.width>0&&box.height>0&&box.left>=-1&&box.right<=box.viewportWidth+1&&box.top>=-1&&box.bottom<=box.viewportHeight+1,name+' target must be visible inside actual viewport: '+JSON.stringify(box));
 await capture(page,name);result.captures.at(-1).region={selector,...box};
}
async function captureTile(page,tile,name){
 const file=name+'.png';
 // Browser 'if needed' scrolling ignores persistent chrome. A real centered
 // scroll must expose the tile and its number/price label without hiding nav.
 await tile.evaluate(n=>n.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await frames(page);
 const visible=await tile.evaluate(n=>{const r=n.getBoundingClientRect(),points=[[.5,.04],[.5,.5],[.5,.96],[.12,.88],[.88,.88]].map(([x,y])=>{const px=r.left+r.width*x,py=r.top+r.height*y,hit=document.elementFromPoint(px,py);return {x:px,y:py,clear:!!hit&&n.contains(hit),hit:hit?hit.tagName+'.'+hit.className:null};});return {id:n.dataset.id,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,points};});
 assert(visible.width>0&&visible.height>0&&visible.top>=0&&visible.bottom<=visible.viewportHeight&&visible.left>=0&&visible.right<=visible.viewportWidth&&visible.points.every(p=>p.clear),name+' must be genuinely visible, not behind fixed navigation: '+JSON.stringify(visible));
 await tile.screenshot({path:resolve(out,file),animations:'disabled'});result.screenshots.push(file);result.captures.push({file,kind:'actual-gallery-tile',viewport:page.viewportSize(),visibility:visible});
}
async function waitCard(page,id){await page.waitForFunction(id=>{const s=window.__uiTestState.ui.sheetCtx,b=document.querySelector('#sheetBody');return document.querySelector('#sheet')?.open&&s?.id===id&&!s.previewBusy&&b?.querySelector('.cd-img img')?.naturalWidth>0;},id);await frames(page);}
async function cardProof(page,e,motion){
 await page.locator('#sheetBody .cd-img').scrollIntoViewIfNeeded();
 await page.waitForFunction(reduce=>{const el=document.querySelector('#sheetBody .cd-img');return el&&el.querySelectorAll('.finish-overlay').length===(reduce?0:1);},motion==='reduce');
 const data=await page.evaluate(()=>{const b=document.querySelector('#sheetBody'),ctx=window.__uiTestState.ui.sheetCtx,el=b.querySelector('.cd-img'),m=JSON.parse(el.dataset.finishModel),notice=b.querySelector('.finish-preview [role=status]'),img=el.querySelector('img');return {id:ctx.id,number:b.querySelector('.cs-meta')?.innerText||'',finish:[...b.querySelectorAll('.finish-preview [data-finish]')].map(n=>({key:n.dataset.finish,label:n.innerText})),notice:notice?.innerText,noticeVisible:!!notice?.getClientRects().length&&getComputedStyle(notice).display!=='none',model:m,layers:el.querySelectorAll('.finish-layer,.finish-pattern').length,overlays:el.querySelectorAll('.finish-overlay').length,image:{decoded:img.complete&&img.naturalWidth>0,src:img.currentSrc},generation:b.detailMountGeneration};});
 assert.equal(data.id,e.id);assert(data.number.includes(e.display),e.id+' printed number');assert.equal(data.finish.length,1);assert.equal(data.finish[0].label,'Holofoil');assertModel(data.model,e);assert.equal(data.layers,motion==='reduce'?0:e.layerCount+Number(e.pattern));assert.equal(data.model.status,e.id==='cel25-23'?'unknown':'approximate');assert.match(data.notice,e.id==='cel25-23'?/Finish preview unavailable/:/approximate/);assert(data.noticeVisible);assert(data.image.decoded);assert.equal(data.image.src,artworkSources(cards.find(c=>c.id===e.id),true)[0],'exact per-card source URL is fulfilled only with synthetic SVG');assert.equal(data.overlays,motion==='reduce'?0:1);return data;
}
function assertModel(model,e){assert.equal(model.printingId,e.id);assert.equal(model.effect,e.effect);assert.equal(model.layers.length,e.layerCount);if(e.layerCount){assert.equal(model.layers[0].mask,e.mask);assert.equal(model.layers[0].material,e.material);assert.equal(model.source,`https://assets.pokemon.com/assets/cms2/img/cards/web/CEL25/CEL25_EN_${e.number}.png`);}}
async function install(app){
 const {context,page}=app,requests=[],writes=[];
 await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url()),json=body=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  const classic=u.hostname==='api.tcgdex.net'||u.origin===new URL(page.url()).origin&&u.pathname.startsWith('/api/prices/')&&/^cel25(?:cc)?-/.test(u.searchParams.get('id')||'');
  if(!classic)return route.fallback();requests.push(req.method()+' '+u.href);if(!['GET','HEAD'].includes(req.method())){writes.push(req.method()+' '+u.href);return route.abort();}
  if(u.hostname==='api.tcgdex.net'){
   if(u.pathname==='/v2/en/cards')return json(CELEBRATIONS_RAW);
   if(u.pathname.startsWith('/v2/en/cards/'))return json([...CELEBRATIONS_RAW,...CLASSIC_RAW].find(c=>u.pathname.endsWith(c.id))||{});
   if(u.pathname==='/v2/en/sets')return json([{...CELEBRATIONS_RELEASE,cardCount:{official:25,total:25}}]);
   if(u.pathname==='/v2/en/sets/cel25')return json({...CELEBRATIONS_RELEASE,cardCount:{official:25,total:25},cards:CELEBRATIONS_RAW});
   if(u.pathname==='/v2/en/sets/cel25cc')return json({...CLASSIC_RELEASE,cardCount:{official:25,total:25},cards:CLASSIC_RAW});
   return json([]);
  }
  const id=u.searchParams.get('id'),finish=u.searchParams.get('finish');
  if(['/api/prices/recent','/api/prices/archive'].includes(u.pathname))return json({game:'ptcg',cardId:id,finish,series:[],notice:'No recorded exact-product history in this synthetic fixture.'});
  return json({cardId:id,quotes:[],series:[],updatedAt:null,checkedAt:new Date().toISOString()});
 });
 const artURLs=new Set([...cards,...CLASSIC_RAW.map(normalizePtcg)].flatMap(c=>[...artworkSources(c,true),...artworkSources(c,false)]).map(u=>new URL(u,page.url()).href));
 await context.route('**/*',route=>artURLs.has(route.request().url())&&route.request().resourceType()==='image'?route.fulfill({status:200,contentType:'image/svg+xml',body:CELEBRATIONS_SVG}):route.fallback());
 await page.evaluate(async({raws,release,lots,history,classic})=>{
  const S=window.__uiTestState,T=window.__uiTestTcg,{normalizePtcg}=await import('/ptcg.js'),now=new Date().toISOString();
  const cs=raws.map(r=>({...normalizePtcg(r),fetchedAt:now,printPriceSchema:1}));for(const c of [...cs,...classic.map(normalizePtcg)])T.cache.ptcg[c.id]=c;const watched=JSON.parse(localStorage.getItem('cardstashy-watch-sent-v1')||'{}');for(const c of [...cs,...classic])watched['ptcg:'+c.id]=Date.now();localStorage.setItem('cardstashy-watch-sent-v1',JSON.stringify(watched));
  S.state.tcg.ptcg.collection=structuredClone(lots);S.state.tcg.ptcg.valueHistory=structuredClone(history);S.state.tcg.ptcg.decks=[];S.state.tcg.ptcg.wishlist=[];
  T.ui('ptcg').sets.list=[release];Object.assign(T.ui('ptcg').set,{id:release.id,info:release,cards:cs,loaded:true,busy:false,finish:'',q:'',rarity:'',sort:'number',filter:'all',limit:120,contents:{completeness:'complete'}});
  window.__celebrationsFixture={raws,release,ids:cs.map(c=>c.id)};location.hash='#set/cel25';
 },{raws:CELEBRATIONS_RAW,release:CELEBRATIONS_RELEASE,lots:CELEBRATIONS_LOTS,history:CELEBRATIONS_HISTORY,classic:CLASSIC_RAW});
 await page.waitForFunction(()=>window.__uiTestState.ui.view==='set'&&document.querySelectorAll('#content .set-grid>[data-act=tCard]').length===25);return {requests,writes};
}
try{
 server=await startServer();browser=await chromium.launch();
 for(const motion of ['no-preference','reduce']){
  const app=current=await openApp(browser,server.base,{game:'ptcg',width:390,height:1050,reducedMotion:motion,hash:'#collection'}),{page}=app,traffic=await install(app),before=await saved(page);
  const tiles=page.locator('#content .set-grid>[data-act=tCard]');
  const ids=await tiles.evaluateAll(ns=>ns.map(n=>n.dataset.id));assert.deepEqual(ids.slice().sort(),CELEBRATIONS_EXPECTED.map(e=>e.id).sort());
  assert.deepEqual(await page.locator('[data-change=tSetFinish] option').evaluateAll(ns=>ns.map(n=>[n.value,n.textContent])),[['','All versions'],['holofoil','Holofoil']]);
  await page.locator('[data-change=tSetFinish]').selectOption('holofoil');await page.waitForFunction(()=>window.__uiTestTcg.ui('ptcg').set.finish==='holofoil'&&[...document.querySelectorAll('#content .set-grid>[data-act=tCard]')].every(n=>n.dataset.setVariant==='holofoil'));assert.equal(await tiles.count(),25);assert.match(await page.locator('.list-bar').innerText(),/25 shown/);
  assert.deepEqual((await tiles.evaluateAll(ns=>ns.map(n=>n.dataset.id))).sort(),CELEBRATIONS_EXPECTED.map(e=>e.id).sort());
  assert.equal(await page.locator('[data-act=viewSave][data-area=set][data-mode=gallery]').getAttribute('aria-checked'),'true');
  for(const e of CELEBRATIONS_EXPECTED){const tile=page.locator(`#content .set-grid>[data-id="${e.id}"]`);await tile.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForFunction(({id,reduce,layers})=>{const n=document.querySelector(`#content .set-grid>[data-id="${id}"]`),i=n?.querySelector('img');return i?.complete&&i.naturalWidth>0&&n.querySelectorAll('.finish-layer,.finish-pattern').length===(reduce?0:layers);},{id:e.id,reduce:motion==='reduce',layers:e.layerCount+Number(e.pattern)});const row=await tile.evaluate(n=>({id:n.dataset.id,model:JSON.parse(n.dataset.finishModel),surface:n.dataset.finishSurface,overlays:n.querySelectorAll('.finish-overlay').length,layers:n.querySelectorAll('.finish-layer,.finish-pattern').length,number:n.querySelector('.grid-meta').textContent}));assert.equal(row.id,e.id);assertModel(row.model,e);assert.equal(row.surface,'large');assert.equal(row.overlays,motion==='reduce'||!e.layerCount?0:1);assert.equal(row.layers,motion==='reduce'?0:e.layerCount+Number(e.pattern));assert(row.number.includes('#'+e.number));result.matrix.gallery++;result.checks.push({phase:'all25-gallery',motion,viewport:390,...row});await captureTile(page,tile,e.id+'-'+motion+'-gallery');}
  await page.evaluate(()=>scrollTo(0,0));
  for(const width of [390,1440]){await page.setViewportSize({width,height:1050});await noOverflow(page,'#content','Celebrations set '+motion+' '+width,true);await capture(page,'set-'+motion+'-'+width);}
  await page.setViewportSize({width:390,height:1050});
  for(const [i,e] of CELEBRATIONS_EXPECTED.entries()){
   await page.locator(`#content .set-grid>[data-id="${e.id}"]`).click();await waitCard(page,e.id);
   const proof=await cardProof(page,e,motion);result.matrix.detail++;await capture(page,e.id+'-'+motion+'-detail');await captureRegion(page,'#sheetBody .finish-preview',e.id+'-'+motion+'-finish-status');
   // Finish click is the real app handler. Require a new mount, not old success.
   const gen=proof.generation;await page.locator('#sheetBody .finish-preview [data-finish]').click();await page.waitForFunction(gen=>document.querySelector('#sheetBody').detailMountGeneration>gen,gen);await waitCard(page,e.id);await cardProof(page,e,motion);
   await page.locator('#sheetBody [data-act=zoomCard]').click();await page.waitForFunction(()=>document.querySelector('dialog.zoom img')?.naturalWidth>0);await page.waitForFunction(reduce=>document.querySelectorAll('dialog.zoom .finish-overlay').length===(reduce?0:1),motion==='reduce');
   const zoom=await page.locator('dialog.zoom .zoom-card-surface').evaluate(n=>({model:JSON.parse(n.dataset.finishModel),layers:n.querySelectorAll('.finish-layer,.finish-pattern').length,image:n.querySelector('img')?.naturalWidth>0}));assert.equal(zoom.model.printingId,e.id);assertModel(zoom.model,e);assert.equal(zoom.layers,motion==='reduce'?0:e.layerCount+Number(e.pattern));assert(zoom.image);result.matrix.zoom++;result.checks.push({phase:'all25-zoom',motion,id:e.id,viewport:390,layers:zoom.layers,model:zoom.model});await capture(page,e.id+'-'+motion+'-zoom');await page.locator('dialog.zoom [data-z=close]').click();await page.waitForFunction(()=>!document.querySelector('dialog.zoom'));
   await page.locator('#sheetBody [data-act=cardTab][data-tab=prices]').click();await frames(page);
   await page.locator('#sheetBody .market-details summary').click();
   const labels=await page.locator('#sheetBody .market-details .pt-label').allTextContents();assert(labels.length>=1);assert(labels.every(l=>l==='Holofoil'),e.id+' only physical Holofoil price labels');
   const seller=page.locator('#sheetBody .market-sellers a[href*="tcgplayer.com/product/"]').first();assert.equal(new URL(await seller.getAttribute('href')).pathname,'/product/'+e.productId);const observedUSD=await seller.locator('.vendor-quote strong').innerText();assert.equal(observedUSD,'$'+(20+i).toFixed(2));assert((await page.locator('#sheetBody .cs-meta').innerText()).includes(observedUSD));
   assert(!((await page.locator('#sheetBody').innerText()).includes('987.65')),'unverified EUR amount never displayed');assert.match(await page.locator('#sheetBody .cs-meta').innerText(),/stale/i);assert.match(await page.locator('#sheetBody .market-sellers').innerText(),/Source updated 2020-01-01/);
   const cm=await page.locator('#sheetBody .market-sellers').evaluate(n=>[...n.querySelectorAll('a')].filter(a=>/cardmarket\.com/.test(a.href)).map(a=>({href:a.href,text:a.innerText})));
   assert.equal(cm.length,1,'one Cardmarket destination, not a vacuous no-direct pass');
   if(!e.cardmarketVerified){assert(cm.every(a=>!a.href.includes('idProduct=')&&!a.href.includes('/Products/Singles/')),'unverified CM must use search only');assert(!(await page.locator('#sheetBody .market-sellers').innerText()).includes('€987.65'));}else assert(cm.some(a=>a.href.includes('idProduct='+e.cmProduct)),'verified CM direct product');
   result.checks.push({phase:'all25-actual-detail',motion,viewport:390,id:e.id,printed:e.display,exactProduct:e.productId,observedUSD,cardmarketDestinations:cm,model:proof.model,layers:proof.layers,overlays:proof.overlays,notice:proof.notice,image:proof.image,approximate:e.id!=='cel25-23',cardmarketVerified:e.cardmarketVerified,savedStateUnchanged:before===await saved(page)});assert.equal(await saved(page),before);
   if([0,4,10,22,23,24].includes(i)){await captureRegion(page,'#sheetBody .cs-meta',e.id+'-'+motion+'-quote-status');await captureRegion(page,'#sheetBody .market-sellers',e.id+'-'+motion+'-prices');await captureRegion(page,'#sheetBody .market-details',e.id+'-'+motion+'-market-details');}
   await closeSheet(page);assert.equal(await tiles.count(),25);
  }
  // Real search/filter events, held legacy facet, and repeat open/close.
  await page.locator('[data-input=tSetQ]').fill('Pikachu VMAX');await page.waitForFunction(()=>document.querySelectorAll('#content .set-grid>[data-act=tCard]').length===2);assert.deepEqual((await tiles.evaluateAll(ns=>ns.map(n=>n.dataset.id))).sort(),['cel25-7','cel25-9']);await page.locator('[data-input=tSetQ]').fill('');await page.waitForFunction(()=>document.querySelectorAll('#content .set-grid>[data-act=tCard]').length===25);
  await page.evaluate(()=>{window.__uiTestTcg.ui('ptcg').set.finish='label:Holofoil';dispatchEvent(new Event('cardstashy-rerender'));});await frames(page);assert.equal(await page.locator('[data-change=tSetFinish]').inputValue(),'holofoil');assert.equal(await tiles.count(),25);
  await page.locator('#content .set-grid>[data-id="cel25-5"]').click();await waitCard(page,'cel25-5');
  await page.locator('#sheetBody [data-act=zoomCard]').click();await page.waitForFunction(()=>document.querySelector('dialog.zoom img')?.naturalWidth>0);await page.waitForFunction(reduce=>document.querySelectorAll('dialog.zoom .finish-layer,dialog.zoom .finish-pattern').length===(reduce?0:1),motion==='reduce');assert.equal(await page.locator('dialog.zoom .finish-layer,dialog.zoom .finish-pattern').count(),motion==='reduce'?0:1);await capture(page,'zoom-'+motion);
  await page.locator('dialog.zoom [data-z=close]').click();await page.waitForFunction(()=>!document.querySelector('dialog.zoom'));
  await page.emulateMedia({reducedMotion:motion==='reduce'?'no-preference':'reduce'});await frames(page);if(motion!=='reduce')await page.waitForFunction(()=>!document.querySelector('#sheetBody .finish-overlay'));await cardProof(page,CELEBRATIONS_EXPECTED[4],motion==='reduce'?'no-preference':'reduce');await page.emulateMedia({reducedMotion:motion});await frames(page);
  await closeSheet(page);assert.equal(await saved(page),before);
  // Browser execution of shared cache/history boundaries with synthetic old data.
  const guards=await page.evaluate(async()=>{
   const T=window.__uiTestTcg,{pokemonCatalogueCard,CELEBRATIONS_CARDS}=await import('/pokemon-set-evidence.js'),{presentationQuote,compactPriceSummary}=await import('/pricing-presentation.js'),{historyKey,validateHistory,reviewedLastObservedQuote}=await import('/shared-history.js'),{applyFallbackPrices}=await import('/ptcg.js'),{conditionRequest}=await import('/condition-feed.js');
   return CELEBRATIONS_CARDS.map(e=>{const c=T.cardOf('ptcg',e.id),old={...structuredClone(c),variants:[{key:'normal',finish:'holofoil',label:'Normal',productId:e.productId,usd:987.65}],prices:{usd:987.65},setContext:{game:'ptcg',cardId:c.id,releaseId:'cel25',status:'resolved',variantKey:'normal',referencePrice:987.65,price:987.65}},lot={cardId:e.id,variant:'normal',productId:e.productId,condition:'Near Mint',manualValue:12.34,manualValueCondition:'Near Mint',manualValueCurrency:'USD'},before=JSON.stringify({old,lot}),q={game:'ptcg',cardId:c.id,finish:'holofoil',selectionVerified:true},history=p=>({game:'ptcg',cardId:c.id,finish:'holofoil',series:[{source:'Synthetic',currency:'USD',finish:'holofoil',subtype:'Holofoil',productId:p,points:[{date:'2020-01-01',value:1}]}]});let wrong=false,unbound=false;try{validateHistory(history(999),q);}catch{wrong=true;}try{validateHistory(history(undefined),q);}catch{unbound=true;}const last=reviewedLastObservedQuote(c,history(e.productId)),fallbackCard=structuredClone(c);for(const v of fallbackCard.variants)for(const k of ['usd','market','mid','low'])v[k]=null;fallbackCard.prices.usd=null;return {id:e.id,projected:pokemonCatalogueCard(old).prices.usd,reference:presentationQuote('ptcg',old,'reference').value,manual:T.entryPrice(old,lot),automatic:T.entryPrice(old,{...lot,manualValue:null}),condition:conditionRequest(old,lot,'ptcg'),fallback:applyFallbackPrices(fallbackCard,{name:e.name,number:e.number,set:{name:'Celebrations'},tcgplayer:{prices:{normal:{market:9}}}}),wrong,unbound,accepted:validateHistory(history(e.productId),q).series.length,key:historyKey(q),lastProduct:last?.productId,badLastWithheld:!compactPriceSummary('ptcg',old,{},{...last,productId:999,value:987.65}).includes('987.65'),unchanged:JSON.stringify({old,lot})===before};});
  });for(const [i,g] of guards.entries()){const e=CELEBRATIONS_EXPECTED[i];assert.deepEqual(g,{id:e.id,projected:null,reference:null,manual:12.34,automatic:null,condition:null,fallback:false,wrong:true,unbound:true,accepted:1,key:'ptcg|'+e.id+'|holofoil|product:'+e.productId,lastProduct:e.productId,badLastWithheld:true,unchanged:true});}result.checks.push({phase:'all25-browser-shared-guards',motion,guards});
  // The saved mismatched lot is opened through the real Collection entry action.
  await page.evaluate(()=>{location.hash='#collection';});await page.waitForFunction(()=>window.__uiTestState.ui.view==='collection');await page.locator('[data-act=tCard][data-entry="celebrations-wrong-saved-manual"]').first().click();await waitCard(page,'cel25-5');assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.savedProductId),250319);assert.equal(await saved(page),before);await captureRegion(page,'#sheetBody .cs-meta','saved-identity-'+motion);await closeSheet(page);
  // Classic remains a separate identity control, not a second set repair.
  await page.evaluate(release=>{const T=window.__uiTestTcg;T.ui('ptcg').sets.list.push(release);Object.assign(T.ui('ptcg').set,{id:release.id,info:release,cards:[T.cardOf('ptcg','cel25cc-CC020')],finish:'holofoil',loaded:true,busy:false,q:'',contents:{completeness:'partial'}});location.hash='#set/cel25cc';},CLASSIC_RELEASE);await page.waitForFunction(()=>document.querySelector('#content [data-id="cel25cc-CC020"]'));await page.locator('#content [data-id="cel25cc-CC020"]').click();await waitCard(page,'cel25cc-CC020');assert.match(await page.locator('#sheetBody .cs-meta').innerText(),/#113\/114/);assert.match(await page.locator('#sheetBody .finish-preview [role=status]').innerText(),/unavailable/);const control=await page.locator('#sheetBody .cd-img').evaluate(n=>JSON.parse(n.dataset.finishModel));assert.equal(control.effect,'unknown');assert.equal(control.printingId,'cel25cc-CC020');await captureRegion(page,'#sheetBody .finish-preview','classic-control-'+motion);await closeSheet(page);assert.equal(await saved(page),before);result.checks.push({phase:'classic-disambiguation-control',motion,id:'cel25cc-CC020',number:'113/114',effect:'unknown'});
  assert.deepEqual(traffic.writes,[]);assert(!traffic.requests.some(s=>s.includes('supabase')));app.health();await app.context.close();current=null;
 }
 assert.deepEqual(result.matrix,{detail:50,zoom:50,gallery:50});result.status='passed';console.log('PASS: actual full25 set/detail/prices, filters, saved identities, product/history guards, 24 labeled approximations/one unavailable, real zoom and normal/reduced-motion transitions. Synthetic artwork is not physical foil proof.');
}catch(error){result.status='failed';result.error=String(error.stack||error);if(current)await capture(current.page,'failure').catch(()=>{});throw error;}
finally{await writeFile(resolve(out,'results.json'),JSON.stringify({...result,generatedAt:new Date().toISOString()},null,2));await current?.context.close();await browser?.close();await server?.close();}
