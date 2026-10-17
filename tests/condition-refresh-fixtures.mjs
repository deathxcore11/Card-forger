// Synthetic condition refresh helpers. Importing/validating this module starts
// no browser, server, OCR, provider request, or camera. Existing Search fixtures
// supply the real app shell and fail-closed network routing.
import assert from 'node:assert/strict';
import {CARDS,PRINT_IDS,MAGIC_PRINTS,UNIQUE,NOW,ISO,openSearchApp} from './search-fixtures.mjs';
export const EVIDENCE='SYNTHETIC CONDITION QUOTES ONLY. Hosted app/UI regression evidence, not live provider, API-key, paid-budget, physical-camera, or OCR proof. Every card, capture and quote is synthetic.';
export const LP='Lightly Played', MP='Moderately Played';
export const quote=(condition=LP,price=7.25,extra={})=>({condition,price,currency:'USD',source:'Synthetic condition fixture (not live)',observedAt:ISO,validUntil:new Date(NOW+86400000).toISOString(),priceStatus:'current',...extra});
export const available=(extra={})=>({status:'available',quotes:[quote(),quote(MP,3.5),quote('Damaged',1.25)],...extra});
export const primary=game=>structuredClone(CARDS[game].find(c=>c.id===PRINT_IDS[game]));
export function candidate(game,card=primary(game)){
 return {id:card.id,name:card.name,game,card,exact:true,printingConfirmed:true,sub:'Synthetic condition review',...(game==='ygo'?{print:'FXX-001|Ultra Rare',setReleaseId:UNIQUE.id,releaseName:UNIQUE.name,setReleaseUnverified:false,printingAmbiguous:false}:{})};
}
export const finish=game=>game==='mtg'?'nonfoil':game==='ptcg'?'normal':'1st-edition';
export function manyLots(count=150){
 const cards=Array.from({length:count},(_,i)=>({...structuredClone(MAGIC_PRINTS[0]),id:`synthetic-condition-${String(i).padStart(3,'0')}`,name:`Synthetic condition lot ${String(i).padStart(3,'0')}`,oracle_id:`synthetic-condition-oracle-${i}`,collector_number:String(i+1),checkedAt:ISO,conditionQuotes:[]}));
 const lots=cards.map((c,i)=>({id:`synthetic-lot-${String(i).padStart(3,'0')}`,name:c.name,qty:1,printingId:c.id,printingVerified:true,nameVerified:true,set:c.set.toUpperCase(),collectorNumber:c.collector_number,finish:'nonfoil',condition:LP,language:'en',location:'Synthetic test binder',addedAt:ISO,raw:{}}));
 return {cards,lots};
}
export async function validateConditionFixtures(){
 const {cards,lots}=manyLots();assert(lots.length>100);assert.equal(new Set(cards.map(c=>c.id)).size,150);assert.equal(new Set(lots.map(c=>c.id)).size,150);assert(lots.every((lot,i)=>lot.printingId===cards[i].id));
 for(const game of ['mtg','ptcg','ygo']){const c=candidate(game);assert(c.card.id);assert(finish(game));if(game==='ygo'){assert.equal(c.print,'FXX-001|Ultra Rare');assert.equal(c.setReleaseId,UNIQUE.id);}}
 assert.equal(available().quotes.find(q=>q.condition===LP).price,7.25);assert(available().quotes.every(q=>q.currency==='USD'&&Date.parse(q.validUntil)>NOW));
 return 'PASS: 150 unique synthetic lots, all-game exact review identities, LP/MP/USD quotes and hosted-only fixture contract. No browser/server/network started.';
}
export async function openConditionApp(browser,base,{game='mtg',label='condition',response=()=>available(),hold=false}={}){
 // Install the hosted clock before app modules capture Date.now/setTimeout.
 // Search's synthetic Date wrapper then retains its known fixture epoch while
 // all production pacing timers are still driven by the same Playwright clock.
 const clockedBrowser={newContext:async options=>{
  const context=await browser.newContext(options),newPage=context.newPage.bind(context);
  context.newPage=async()=>{const page=await newPage();await page.clock.install({time:new Date(NOW)});return page;};return context;
 }};
 const app=await openSearchApp(clockedBrowser,base,{game,width:390,height:920,evidenceLabel:label});
 const records=[],gates=[],errors=[];let active=0,maxActive=0,responder=response,holdNext=hold;
 // A later exact route overrides Search's generic empty price fixture. All
 // other requests remain guarded by the existing fail-closed fixture router.
 await app.context.route(base+'/api/prices/conditions?*',async route=>{
  const req=route.request(),url=new URL(req.url()),row={url:url.href,params:Object.fromEntries(url.searchParams),method:req.method(),startedAt:await app.page.evaluate(()=>Date.now()),settled:false};records.push(row);
  if(req.method()!=='GET'){errors.push('Non-GET condition request');await route.fulfill({status:403,json:{status:'unavailable',quotes:[]}});row.settled=true;return;}
  active++;maxActive=Math.max(maxActive,active);
  let release;const wait=new Promise(r=>release=r),held=typeof holdNext==='function'?holdNext(url):holdNext;
  if(held){gates.push({row,release});row.held=true;}
  try{
   if(held)await wait;
   const result=await responder(url,row),status=result.httpStatus||200;const body={...result};delete body.httpStatus;
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  }catch(error){if(!/closed|cancel|abort/i.test(String(error)))errors.push(error.stack||String(error));}
  finally{active--;row.settled=true;}
 });
 // Physical edit/save re-verifies the exact set+number via Scryfall. This is
 // the same synthetic printing as the existing Search fixture, never network.
 await app.context.route(/^https:\/\/api\.scryfall\.com\/cards\/fxa\/1(?:\/en)?$/,async route=>{
  if(route.request().method()!=='GET'){errors.push('Non-GET printing verification');return route.abort();}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(primary('mtg'))});
 });
 return {...app,condition:{records,errors,get maxActive(){return maxActive;},get active(){return active;},respond(fn){responder=fn;},hold(value=true){holdNext=value;},release(match=()=>true){for(const gate of gates)if(match(gate.row))gate.release();},health(){assert.deepEqual(errors,[]);assert(maxActive<=2,`At most two condition requests in flight, saw ${maxActive}`);assert(records.every(row=>row.method==='GET'));}}};
}
export async function frames(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
export async function advance(page,ms=8100){await page.clock.fastForward(ms);await frames(page);}
export async function waitUntil(fn,label,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,15));}assert.fail(label+' timed out');}
export async function settle(app){await waitUntil(()=>app.condition.records.every(r=>r.settled),'Mock condition responses settling');await frames(app.page);}
export async function select(page,selector,value){const control=page.locator(selector),label=await control.locator('option').evaluateAll((nodes,v)=>nodes.find(node=>node.value===v)?.label,value);assert(label,`${selector} has option ${value}`);await control.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();await frames(page);}
export async function navigate(page,to){await page.locator(to==='home'?'.brand-home':`[data-act="go"][data-to="#${to}"]:visible`).first().click();await page.waitForFunction(v=>window.__uiTestState.ui.view===v,to);await frames(page);}
export async function seedLots(page,{count=150,filter='',cursor=''}={}){
 const data=manyLots(count);await page.evaluate(async({data,filter,cursor})=>{
  const {S}=await import('/store.js'),{cardKey}=await import('/core.js');S.state.collection=data.lots;S.state.printings=Object.fromEntries(data.cards.map(c=>[c.id,c]));for(const c of data.cards)S.catalog[cardKey(c.name)]=c;
  S.ui.q.coll=filter;S.ui.collSort='name';S.ui.collLimit=120;localStorage.setItem('cardstashy-condition-cursor:mtg',cursor);
  // Match Search's ordinary synthetic watch-cache setup for these extra IDs.
  // Keep the fail-closed POST guard intact; no watch submission is permitted.
  const watched=JSON.parse(localStorage.getItem('cardstashy-watch-sent-v1')||'{}'),now=Date.now();
  for(const card of data.cards)watched['mtg:'+card.id]=now;
  localStorage.setItem('cardstashy-watch-sent-v1',JSON.stringify(watched));
  // Persist only synthetic fixtures through the app's ordinary local storage.
  await (await import('/storage.js')).writeRecords([['cardforge-v2',S.state],['cardforge-catalog-v1',S.catalog]]);
 },{data,filter,cursor});return data;
}
export async function seedReviews(page,game,{cards=[primary(game),primary(game)],condition=LP,lang='en',selectedFinish=finish(game)}={}){
 const candidates=cards.map(card=>candidate(game,card));
 await page.evaluate(async({game,candidates,condition,lang,selectedFinish})=>{
  const batch=await import('/scan-batch.js'),prefs=await import('/scansession.js'),S=window.__uiTestState;
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=336;const x=canvas.getContext('2d');x.fillStyle='#214057';x.fillRect(0,0,240,336);x.fillStyle='#fff';x.font='14px sans-serif';x.fillText('SYNTHETIC CONDITION FIXTURE',8,40);x.fillText('NOT A REAL CARD PHOTO',8,310);const shot=canvas.toDataURL('image/png');
  batch.saveBatch(candidates.map((c,i)=>({id:`synthetic-condition-capture-${i}`,captureRevision:`synthetic-condition-revision-${i}`,game,selectedGame:game,at:123+i,originalShot:shot,shot,status:'review',qty:2,condition,lang,finish:selectedFinish,location:'Synthetic binder',read:{name:c.name,code:'Synthetic queued review, not OCR'},cands:[c],selectedIndex:0})));
  prefs.savePrefs(game,{sounds:false,haptics:false,auto:false});S.ui.scan.auto=false;
  window.__conditionReview={batch,ocrCalls:0};window.Tesseract={createWorker:async()=>({setParameters:async()=>{},terminate:async()=>{},recognize:async()=>{window.__conditionReview.ocrCalls++;throw Error('Condition tests do not run OCR');}})};
 },{game,candidates,condition,lang,selectedFinish});
 if(game==='ygo'){
  // Sets is reached from Search, not a Home shortcut. Use both real controls
  // so catalogue loading still runs through the production navigation queue.
  await navigate(page,'search');await navigate(page,'sets');await page.waitForFunction(()=>window.__uiTestTcg.currentYgoCatalogue().length>0);
 }
 await navigate(page,'scan');return candidates;
}
export async function openReview(page,index=0){await page.locator(`.scan-batch-thumb[data-id="synthetic-condition-capture-${index}"]`).click();await page.locator('.scan-confirm').waitFor();await frames(page);}
export async function reviewState(page){return page.evaluate(()=>{const q=window.__uiTestState.ui.scan.confirm,c=window.__uiTestState.ui.scan.cands?.[q?.i??0];return q?{capture:q.batchId,revision:q.captureRevision,price:q.price,condition:q.condition,language:q.lang,finish:q.finish,cardId:c?.card?.id,game:q.game,saving:q.saving}:null;});}
export async function savedLots(page,game='mtg'){return page.evaluate(g=>structuredClone((g==='mtg'?window.__uiTestState.state:window.__uiTestState.state.tcg[g]).collection),game);}
export async function protectedState(page){return page.evaluate(()=>{const s=window.__uiTestState.state;return JSON.stringify({decks:s.decks,wishlist:s.wishlist,myPrices:s.myPrices,priceChoices:s.priceChoices,otherGames:s.tcg});});}
