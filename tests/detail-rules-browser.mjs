// Detail / seller / Meta / Ideas real-shell regression for hosted CI only.
// No production provider, payment or AI traffic is permitted by the fixture.
// Run schema checks without any browser: --validate-fixtures.
import assert from 'node:assert/strict';
import {GAMES,WIDTHS,CARDS,DHELMISE_COVER,makeFixtures,validateFixtures,startServer,openApp,navigate,closeSheet,inventorySnapshot,noOverflow,capture,saveReport} from './detail-rules-fixtures.mjs';
import {sellerModels,presentationQuote} from '../pricing-presentation.js';

console.log(await validateFixtures());
const tcg=(game,card,ctx={})=>sellerModels(game,card,ctx,game==='mtg'?Object.entries(card.purchase_uris||{}):[]).find(r=>r.key==='tcgplayer');
assert.equal(tcg('mtg',CARDS.mtg[0],{priceFinish:'etched'}).url,'https://www.tcgplayer.com/product/43?Language=English&Printing=Etched+Foil');
assert.equal(tcg('ptcg',CARDS.ptcg[0],{priceFinish:'holofoil'}).url,'https://www.tcgplayer.com/product/222?Language=English&Printing=Holofoil');
assert.equal(tcg('ptcg',CARDS.ptcg[0],{priceFinish:'holofoil'}).value,5);
assert.equal(tcg('ptcg',CARDS.ptcg[0],{priceFinish:'reverse-holofoil'}).value,null);
assert.equal(presentationQuote('ptcg',CARDS.ptcg[0],'reverse-holofoil').value,null,'The selected reverse-holo quote must not borrow normal $2 or holo $5');
assert.equal(tcg('ygo',CARDS.ygo[0]).value,null,'Aggregate card reference must not masquerade as exact printing vendor amount');
assert.equal(tcg('ygo',CARDS.ygo[0],{priceEdition:'SET-001::Rare'}).value,null,'One available edition quote is not an explicit physical-edition selection');
assert.equal(tcg('ygo',CARDS.ygo[0],{priceEdition:'SET-001::Rare',priceYgoEdition:'unlimited'}).value,20,'Explicit Unlimited preserves the exact known $20 quote');
assert.equal(tcg('ygo',CARDS.ygo[0],{priceEdition:'SET-001::Rare',priceYgoEdition:'1st-edition'}).value,null,'An unavailable edition cannot borrow the single Unlimited quote');
assert.equal(tcg('ygo',CARDS.ygo[0],{priceEdition:'SET-001::Super Rare'}).value,null,'Multiple editions without selection cannot invent a printing amount');
assert.equal(tcg('ygo',CARDS.ygo[0],{priceEdition:'SET-001::Super Rare',priceYgoEdition:'1st-edition'}).value,31);
assert.equal(presentationQuote('ptcg',CARDS.ptcg[3],'normal').observedAt,'2020-01-01');
for(const card of CARDS.mtg.slice(1,4))assert.equal(tcg('mtg',card).value,null,'Missing, EUR-only and private quotes cannot become USD seller amounts');
if(process.argv.includes('--validate-fixtures')){
 // Verify the real renderer's face selection before spending a hosted browser
 // run. No fetch is available here; exit also cancels deferred watch work.
 globalThis.fetch=undefined;
 const {S}=await import('../store.js'),{cardSheet}=await import('../views.js'),fixtures=makeFixtures('mtg'),dual=CARDS.mtg[4];S.state=fixtures.state;S.catalog=fixtures.catalog;
 const {priceOverview}=await import('../workbench-ui.js'),unknownFinish=priceOverview('ptcg',CARDS.ptcg[0],{type:'tcard',game:'ptcg',id:CARDS.ptcg[0].id,priceFinish:'reverse-holofoil'});
 assert.match(unknownFinish,/Current quote unavailable for this selection\. Seller searches remain available\./,'The real renderer explains an unavailable selected finish without borrowing another quote');
 const before=JSON.stringify(S.state);
 for(const face of [0,1,0]){const html=cardSheet(dual,{type:'card',name:dual.name,entryId:'lot-mtg-4',face});assert.equal(html.match(/<div class="cs-card">[\s\S]*?<img class="card-img" src="([^"]+)"/)?.[1],dual.card_faces[face].image_uris.normal);assert.equal(html.match(/<img class="cs-art" src="([^"]+)"/)?.[1],dual.card_faces[face].image_uris.art_crop);assert(html.includes('<h2>'+dual.name+'</h2>'));assert(html.includes('Flip to '+dual.card_faces[face?0:1].name));}
 assert.equal(JSON.stringify(S.state),before,'Rendering either face preserves exact saved identity and all inventory data');console.log('Actual Magic cardSheet renders exact dawn/dusk/dawn card and hero images without changing identity. No browser or provider call.');process.exit(0);
}
const {chromium}=await import('playwright');
const server=await startServer();let browser,failure;const report=[];
async function openCard(page,game,index=0){
 await navigate(page,'#collection');await page.locator(`#content .lot-art[data-entry="lot-${game}-${index}"]`).click();
 await page.waitForFunction(({game,id,name})=>{const sheet=document.querySelector('#sheet'),s=window.__uiTestState.ui.sheetCtx;return sheet?.open&&s?.type===(game==='mtg'?'card':'tcard')&&(game==='mtg'?s.name===name:s.id===id)&&document.querySelector('#sheet .card-price-summary');},{game,id:CARDS[game][index].id,name:CARDS[game][index].name});
 assert.equal(await page.locator('#sheet .cs-title h2').innerText(),CARDS[game][index].name);
 assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.entryId),`lot-${game}-${index}`,'Collection detail retains exact saved lot identity');
}
async function select(page,selector,value){
 const control=page.locator(selector),label=await control.locator('option').evaluateAll((nodes,v)=>nodes.find(n=>n.value===v)?.label,value);assert(label,`Option ${value} exists in ${selector}`);await control.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();await page.waitForFunction(({selector,value})=>{const n=document.querySelector(selector),c=window.__uiTestState.ui.sheetCtx;const stored=selector.includes('historyYgoEdition')?c?.priceYgoEdition:selector.includes('historyEdition')?c?.priceEdition:c?.priceFinish;return n?.isConnected&&n.value===value&&stored===value&&[...n.options].find(o=>o.value===value)?.hasAttribute('selected');},{selector,value});
 // The selected HTML attribute is emitted only by the completed renderer.
 // Native selectedIndex changes alone cannot satisfy the predicate above.
}
async function jump(page,target){
 // Buy is now outbound. Prices remains the actual in-app entry; then explicitly
 // scroll to the unchanged lower seller list when that is the assertion target.
 await page.locator('.card-price-summary [data-act="cardPriceJump"][data-target="history"]').click();
 await page.waitForFunction(()=>{const n=document.querySelector('#card-history');return n?.isConnected&&document.activeElement===n&&document.querySelector('[data-act="cardTab"][data-tab="prices"]')?.getAttribute('aria-selected')==='true';});
 if(target==='sellers')await page.evaluate(async()=>{
  const {scrollDetailTarget}=await import('/pricing-presentation.js');
  const scroll=()=>scrollDetailTarget(document.querySelector('#sheetBody'),document.querySelector('#card-sellers'),true);
  scroll();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));scroll();
 });
 await page.waitForFunction(id=>{const n=document.querySelector('#card-'+id);return n?.isConnected&&document.activeElement===n&&document.querySelector('[data-act="cardTab"][data-tab="prices"]')?.getAttribute('aria-selected')==='true';},target);
 // Do not retain handles across async history/printing rerenders.
 try{await page.waitForFunction(id=>{const n=document.querySelector('#card-'+id),body=document.querySelector('#sheetBody'),head=body?.querySelector('.sheet-head'),tabs=body?.querySelector('.cs-tabs');if(!n?.isConnected||!head||!tabs)return false;const a=n.getBoundingClientRect(),h=head.getBoundingClientRect(),t=tabs.getBoundingClientRect();return a.top>=Math.max(h.bottom,t.bottom)-2&&a.top<innerHeight-20;},target);}catch(error){
  const geometry=await page.evaluate(id=>{const body=document.querySelector('#sheetBody'),target=document.querySelector('#card-'+id),head=body?.querySelector('.sheet-head'),tabs=body?.querySelector('.cs-tabs'),rect=n=>n?.getBoundingClientRect().toJSON();return {target:id,rect:rect(target),head:rect(head),headClass:head?.className,tabs:rect(tabs),tabsTop:body&&getComputedStyle(body).getPropertyValue('--card-tabs-top'),body:rect(body),scrollTop:body?.scrollTop,scrollHeight:body?.scrollHeight,clientHeight:body?.clientHeight,connected:target?.isConnected,focused:document.activeElement===target,card:window.__uiTestState.ui.sheetCtx?.id||window.__uiTestState.ui.sheetCtx?.name,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};},target).catch(e=>({diagnosticError:String(e)}));
  error.stack+='\nCurrent connected jump geometry: '+JSON.stringify(geometry);throw error;
 }
 assert.equal(await page.locator('#card-'+target).getAttribute('tabindex'),'-1');
 const order=await page.evaluate(()=>{const h=document.querySelector('#card-history'),s=document.querySelector('#card-sellers');return !!(h.compareDocumentPosition(s)&Node.DOCUMENT_POSITION_FOLLOWING);});assert(order,'Seller section comes after, not above, the graph');
 assert.equal(await page.locator('#card-sellers').count(),1,'No competing duplicate seller sections');
}
const row=(page,name)=>page.locator('#card-sellers .vendor-row').filter({has:page.locator('.vendor-copy b',{hasText:new RegExp('^'+name+'$')})});
async function seller(page,name,{href,amount,currency,action}){
 const r=row(page,name);assert.equal(await r.count(),1,`${name} has exactly one seller row`);if(href){const u=new URL(await r.getAttribute('href'));assert.equal(u.origin+u.pathname,href);}assert.equal(await r.locator('.vendor-quote strong').innerText(),amount);if(currency)assert.match(await r.locator('.vendor-quote small').innerText(),new RegExp('^'+currency+' · '));if(action)assert.match(await r.locator('.vendor-action').innerText(),new RegExp(action));assert.equal(await r.getAttribute('target'),'_blank');assert.match(await r.getAttribute('rel'),/noopener/);return r;
}
async function artSnapshot(page){return page.evaluate(()=>({hero:document.querySelector('.cs-banner .cs-art')?.getAttribute('src')||document.querySelector('.cs-banner img')?.getAttribute('src'),card:document.querySelector('.cs-card .card-img')?.getAttribute('src'),title:document.querySelector('.cs-title h2')?.textContent}));}
async function tab(page,id){
 // A.cardTab exposes aria-selected immediately, before its awaited recordQuote
 // commit and refreshSheet. Prices assertions require that completed render,
 // not the old panel which is about to be detached by the actual user action.
 if(id==='prices')await page.evaluate(()=>{window.__priceTabBefore={panel:document.querySelector('#card-sellers'),state:window.__uiTestState.state};});
 await page.locator(`#sheet [data-act="cardTab"][data-tab="${id}"]`).click();
 await page.waitForFunction(id=>{const button=document.querySelector(`#card-tab-${id}`);if(!button?.isConnected||button.getAttribute('aria-selected')!=='true')return false;if(id!=='prices')return true;const panel=document.querySelector('#card-sellers'),before=window.__priceTabBefore;return panel?.isConnected&&panel!==before.panel&&!before.panel.isConnected&&window.__uiTestState.state!==before.state&&window.__uiTestState.ui.sheetCtx?.tab==='prices';},id);
 if(id==='prices')await page.evaluate(()=>{delete window.__priceTabBefore;});
}
async function mainArt(page){
 await page.waitForFunction(()=>{const n=document.querySelector('#sheet[open] .cs-card .card-img');return n?.isConnected&&n.complete&&n.naturalWidth>0&&n.getClientRects().length>0;});
 assert.equal(await page.locator('#sheet .cd-zoom').first().getAttribute('data-name'),await page.locator('.cs-title h2').innerText());
}
async function tabsKeyboard(page){
 await tab(page,'overview');await page.locator('#card-tab-overview').focus();await page.keyboard.press('End');const last=await page.locator('.cs-tabs [role="tab"]').last().getAttribute('id');assert.equal(await page.evaluate(()=>document.activeElement.id),last);await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.id),'card-tab-overview');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.cs-tabs [role="tab"][aria-selected="true"]').count(),1);assert.equal(await page.locator('.cs-tabs [role="tab"][tabindex="0"]').count(),1);const controls=await page.locator('.cs-tabs [aria-selected="true"]').getAttribute('aria-controls');assert.equal(await page.locator('#'+controls).getAttribute('role'),'tabpanel');assert(await page.locator('#'+controls).isVisible());await tab(page,'overview');
}
// Browser checks run only in hosted CI. The new tab is wholly synthetic: no
// request ever reaches TCGplayer, a provider, a cart or an account.
async function outboundBuy(app,expected,{search=false,activation='click'}={}){
 const {page,context}=app,anchor=page.locator('.card-price-summary .card-buy-link'),calls=[];
 const before=await page.evaluate(()=>({url:location.href,tab:window.__uiTestState.ui.sheetCtx.tab||'overview',entry:window.__uiTestState.ui.sheetCtx.entryId})),inventory=await inventorySnapshot(page);
 const actual=await anchor.getAttribute('href');if(search||new URL(expected).search)assert.equal(actual,expected);else {const u=new URL(actual);assert.equal(u.origin+u.pathname,expected);assert.equal(u.searchParams.get('Language'),'English');}expected=actual;assert.equal(await anchor.getAttribute('target'),'_blank');assert.equal(await anchor.getAttribute('rel'),'noopener noreferrer');assert.equal(await anchor.getAttribute('referrerpolicy'),'no-referrer');assert.equal(await anchor.getAttribute('data-act'),null);
 assert.match(await anchor.innerText(),search?/Search TCGplayer/:/^Buy/);assert.match(await anchor.getAttribute('aria-label'),/opens in a new tab/);
 // Measure the final touch target, not the transient scale of entry motion.
 // Keep the 44px threshold; settle only finite animations on this control's ancestors.
 await anchor.evaluate(async n=>{
  const animations=[];
  for(let p=n;p;p=p.parentElement)animations.push(...p.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState)));
  await Promise.allSettled(animations.map(a=>a.finished));
 });
 // focus() reacquires a connected locator if detail hydration replaces the row.
 await anchor.focus();
 const focusState=await anchor.evaluate(n=>({focused:document.activeElement===n,height:n.getBoundingClientRect().height,active:document.activeElement?.outerHTML.slice(0,300)}));
 assert(focusState.focused&&focusState.height>=44,'Native Buy remains keyboard-focusable and at least a 44px touch target: '+JSON.stringify(focusState));
 const intercept=async route=>{const req=route.request();calls.push({url:req.url(),method:req.method(),referer:req.headers().referer||'',navigation:req.isNavigationRequest()});await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Synthetic retailer destination</title><link rel="icon" href="data:,"><p>Outbound link fixture only.</p>'});};
 await context.route('https://www.tcgplayer.com/**',intercept);
 try{
  const opened=context.waitForEvent('page');
  if(activation==='keyboard')await anchor.press('Enter');else if(activation==='touch')await anchor.tap();else await anchor.click();
  const popup=await opened;await popup.waitForURL(expected);await popup.waitForLoadState('domcontentloaded');
  assert.equal(await popup.evaluate(()=>window.opener),null,'Retailer cannot access the app window');await popup.close();
  assert.deepEqual(calls,[{url:expected,method:'GET',referer:'',navigation:true}]);
  assert.deepEqual(await page.evaluate(()=>({url:location.href,tab:window.__uiTestState.ui.sheetCtx.tab||'overview',entry:window.__uiTestState.ui.sheetCtx.entryId})),before,'Outbound Buy never switches the in-app Prices tab or current lot');
  assert.equal(await inventorySnapshot(page),inventory,'Outbound Buy never changes collection/deck/account data');
 }finally{await context.unroute('https://www.tcgplayer.com/**',intercept);}
}
async function currentDetail(app,game){
 const {page}=app,before=await inventorySnapshot(page);await openCard(page,game);await mainArt(page);await capture(page,`details-${game}-overview`);const art=await artSnapshot(page);assert(art.card,'Main card artwork is still present');await outboundBuy(app,'https://www.tcgplayer.com/product/'+({mtg:42,ptcg:111,ygo:555}[game]));await tabsKeyboard(page);
 for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await jump(page,'history');assert((await page.locator('#card-history .history-coverage').innerText()).length>20,'Graph has a readable non-hover summary');await jump(page,'sellers');await noOverflow(page,'#sheetBody',`${game} details ${width}px`);await capture(page,`details-${game}-${width}`);}
 await page.setViewportSize({width:844,height:390});await jump(page,'sellers');await noOverflow(page,'#sheetBody',`${game} detail short landscape`);assert(await page.locator('#sheet [data-act="closeSheet"]').isVisible());await capture(page,`details-${game}-landscape`);
 for(const width of [390,680,768,390]){await page.setViewportSize({width,height:1000});await jump(page,'sellers');await noOverflow(page,'#sheetBody',`${game} resized ${width}px`);}
 if(game==='mtg'){
  await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/42',amount:'$12.50',currency:'USD',action:'View listing'});await seller(page,'Cardmarket',{amount:'€9.30',currency:'EUR'});await seller(page,'Cardhoarder',{amount:'0.04 tix',currency:'TIX'});
  await select(page,'#sheet [data-change="cardPriceFinish"]','foil');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/42',amount:'$15.75',currency:'USD'});
  await select(page,'#sheet [data-change="cardPriceFinish"]','etched');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/43',amount:'$21.25',currency:'USD'});await seller(page,'Cardmarket',{amount:'Check price',action:'Search store'});await outboundBuy(app,'https://www.tcgplayer.com/product/43',{activation:'touch'});
 }else if(game==='ptcg'){
  await select(page,'#sheet [data-change="cardPriceFinish"]','normal');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/111',amount:'$2.00',currency:'USD'});
  await select(page,'#sheet [data-change="cardPriceFinish"]','holofoil');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/222',amount:'$5.00',currency:'USD'});assert.match(await page.locator('.price-version').innerText(),/Holofoil/);
  await select(page,'#sheet [data-change="cardPriceFinish"]','reverse-holofoil');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/333',amount:'Check price',action:'View listing'});assert.match(await page.locator('.price-version').innerText(),/Current quote unavailable for this selection\. Seller searches remain available\./);
  assert.match(await page.locator('.price-version').innerText(),/Sword & Shield[\s\S]*#9[\s\S]*EN[\s\S]*Reverse holo/,'The unavailable quote still belongs to the exact set, collector number, language and finish');
  const selected=await page.evaluate(async()=>{const ctx=window.__uiTestState.ui.sheetCtx,card=window.__uiTestTcg.cache.ptcg[ctx.id],{presentationQuote}=await import('/pricing-presentation.js');return {id:ctx.id,finish:ctx.priceFinish,value:presentationQuote('ptcg',card,ctx.priceFinish).value};});assert.deepEqual(selected,{id:CARDS.ptcg[0].id,finish:'reverse-holofoil',value:null});await outboundBuy(app,'https://www.tcgplayer.com/product/333',{activation:'touch'});
 }else{
  // Collection details restore the saved printing and edition, not the generic card reference.
  assert.deepEqual(await page.evaluate(()=>{const c=window.__uiTestState.ui.sheetCtx;return [c.priceEdition,c.priceYgoEdition];}),['SET-001::Rare','unlimited']);
  await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/555',amount:'$20.00',currency:'USD',action:'View listing'});assert.match(await page.locator('.price-version').innerText(),/SET-001 · Rare · Unlimited/);
  await select(page,'#sheet [data-change="historyEdition"]','');
  await seller(page,'TCGplayer',{amount:'Check price',action:'Search store'});assert.match(await page.locator('.price-version').innerText(),/Reference card/);assert.equal(await row(page,'YGOPRODeck').count(),0,'Research site is not presented as a seller');await outboundBuy(app,tcg('ygo',CARDS.ygo[0]).url,{search:true,activation:'touch'});
  await select(page,'#sheet [data-change="historyEdition"]','SET-001::Rare');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/555',amount:'Check price'});assert.equal(await page.locator('#sheet [data-change="historyYgoEdition"]').inputValue(),'','Reselecting a printing does not restore or infer its physical edition');assert.equal(await page.locator('#card-history').getAttribute('data-history-state'),'edition-required');assert.equal(await page.locator('#card-history .market-chart').count(),0,'No edition-selected graph exists before choosing an edition');
  await select(page,'#sheet [data-change="historyYgoEdition"]','unlimited');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/555',amount:'$20.00',currency:'USD'});assert.match(await page.locator('.price-version').innerText(),/SET-001 · Rare · Unlimited/);
  await select(page,'#sheet [data-change="historyEdition"]','SET-002::Common');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/556',amount:'$1.00',currency:'USD'});
  await select(page,'#sheet [data-change="historyEdition"]','SET-001::Super Rare');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/557',amount:'Check price'});
  await select(page,'#sheet [data-change="historyYgoEdition"]','1st-edition');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/557',amount:'$31.00',currency:'USD'});
  await select(page,'#sheet [data-change="historyYgoEdition"]','unlimited');await seller(page,'TCGplayer',{href:'https://www.tcgplayer.com/product/557',amount:'$11.00',currency:'USD'});await outboundBuy(app,'https://www.tcgplayer.com/product/557',{activation:'keyboard'});
 }
 // The selected finish/rarity above deliberately differs from the saved lot.
 assert.equal(await page.locator('details[data-detail-key="owned-lot"]').count(),0,'A different selected finish/rarity cannot inherit the saved lot private value');
 assert.doesNotMatch(await page.locator('#card-sellers').innerText(),/\$1\.75/,'A manual condition value is never a seller quote');
 if(game==='ygo'){
  await select(page,'#sheet [data-change="historyEdition"]','SET-001::Rare');
  await select(page,'#sheet [data-change="historyYgoEdition"]','unlimited');
 }else await select(page,'#sheet [data-change="cardPriceFinish"]',game==='mtg'?'nonfoil':'normal');
 assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.entryId),`lot-${game}-0`,'Restoring the exact saved version preserves its original lot ID');
 const lot=page.locator('details[data-detail-key="owned-lot"]');if(await lot.getAttribute('open')===null)await lot.locator('summary').click();assert.match(await lot.innerText(),/Lightly Played/);assert.match(await lot.innerText(),/\$1\.75/);
 await tab(page,'prices');
 const vendors=await page.locator('#card-sellers .vendor-row').evaluateAll(nodes=>nodes.map(n=>({name:n.querySelector('.vendor-copy b').textContent,href:n.getAttribute('href')})));assert(vendors.length>0);assert.equal(new Set(vendors.map(v=>v.name)).size,vendors.length,'Every vendor has a stable unique merchant identity');
 for(const vendor of vendors){const r=row(page,vendor.name);assert.equal(await r.count(),1);assert.equal(await r.getAttribute('href'),vendor.href,'Vendor identity and destination survive the prices refresh');await r.scrollIntoViewIfNeeded();await r.focus();const b=await r.evaluate((n,expected)=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {width:r.width,height:r.height,connected:n.isConnected,identity:n.querySelector('.vendor-copy b').textContent===expected.name&&n.getAttribute('href')===expected.href,focus:document.activeElement===n,hit:hit===n||n.contains(hit)};},vendor);assert(b.connected&&b.identity&&b.focus&&b.hit&&b.height>=44,`Vendor row is current, correctly identified, focusable, unobstructed and at least 44px: ${JSON.stringify(b)}`);}
 await tab(page,'overview');await mainArt(page);assert.deepEqual(await artSnapshot(page),art,'Price changes preserve hero, main card art and identity');
 assert.equal(await inventorySnapshot(page),before,'Buy/Prices, tabs, ranges, finish, resize and source selection cannot change saved lot identity, condition, values, quantities or decks');
 if(game!=='ygo')await outboundBuy(app,'https://www.tcgplayer.com/product/'+(game==='mtg'?42:111),{activation:'keyboard'});
 // Visible keyboard-accessible edit action, with no long-press requirement.
 await page.locator('.personal-price-edit').focus();assert.equal(await page.locator('.personal-price-edit').evaluate(n=>n===document.activeElement),true);await closeSheet(page);
 report.push(`${game}: exact vendor/currency/finish/product; direct isolated Buy + separate Prices; graph then sellers; 320/390/768/1440/2560 plus landscape/fold; keyboard tabs; main art and exact saved lots unchanged.`);
}
async function missingQuotes(app,game){
 const {page}=app,before=await inventorySnapshot(page),unknown=game==='ygo'?2:1,personal=game==='ptcg'?2:3;
 await openCard(page,game,unknown);const unknownBuy=tcg(game,CARDS[game][unknown]);await outboundBuy(app,unknownBuy.url,{search:!unknownBuy.direct,activation:'keyboard'});assert.match(await page.locator('.card-price-summary').innerText(),/No quote yet|Price unknown/);await jump(page,'sellers');const rows=await page.locator('#card-sellers .vendor-quote strong').allTextContents();assert(rows.length>0);assert(rows.every(t=>t==='Check price'),'Unknown quotes never invent an amount or stock availability');await closeSheet(page);
 await openCard(page,game,personal);assert.match(await page.locator('.card-price-summary').innerText(),/\$987\.65/);assert.match(await page.locator('.card-price-summary').innerText(),/private value|not a seller/i);await jump(page,'sellers');assert.doesNotMatch(await page.locator('#card-sellers').innerText(),/987\.65/);assert((await page.locator('#card-sellers .vendor-quote strong').allTextContents()).every(t=>t==='Check price'));await closeSheet(page);
 if(game==='mtg'){await openCard(page,game,2);assert.match(await page.locator('.card-price-summary').innerText(),/€9\.30/);await jump(page,'sellers');await seller(page,'TCGplayer',{amount:'Check price'});await seller(page,'Cardmarket',{amount:'€9.30',currency:'EUR'});assert.doesNotMatch(await row(page,'TCGplayer').innerText(),/9\.30/);await closeSheet(page);}
 if(game==='ptcg'){await openCard(page,game,3);assert.match(await page.locator('.card-price-summary').innerText(),/Last observed 2020-01-01/);await jump(page,'sellers');assert.match(await row(page,'TCGplayer').innerText(),/Last observed 2020-01-01/);assert.match(await page.locator('.price-version').innerText(),/not a current offer/);await closeSheet(page);}
 if(game==='mtg'){await openCard(page,game,4);await mainArt(page);const first=await artSnapshot(page);await page.locator('[data-act="flipFace"]').click();await page.waitForFunction(()=>{const n=document.querySelector('#sheet[open] .cs-card .card-img'),ctx=window.__uiTestState.ui.sheetCtx;return n?.isConnected&&n.complete&&n.naturalWidth>0&&n.src.endsWith('/dual-dusk.png')&&ctx.face===1&&ctx.entryId==='lot-mtg-4';});const back=await artSnapshot(page);assert.notEqual(back.card,first.card);assert.equal(back.hero,CARDS.mtg[4].card_faces[1].image_uris.art_crop);assert.equal(back.title,first.title,'Flipping changes face artwork, not printing identity');await page.locator('[data-act="flipFace"]').click();await page.waitForFunction(()=>{const n=document.querySelector('#sheet[open] .cs-card .card-img'),ctx=window.__uiTestState.ui.sheetCtx;return n?.isConnected&&n.complete&&n.naturalWidth>0&&n.src.endsWith('/dual-dawn.png')&&ctx.face===0&&ctx.entryId==='lot-mtg-4';});assert.deepEqual(await artSnapshot(page),first);await closeSheet(page);}
 assert.equal(await inventorySnapshot(page),before);report.push(`${game}: unknown and private values never become seller quotes${game==='mtg'?'; EUR remains only EUR':''}${game==='ptcg'?'; dated quote is explicitly not current':''}.`);
}
async function ideaActionLabels(page,game,width){
 await page.locator('.build-own').evaluate(n=>Promise.all(n.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
 const buttons=await page.locator('.build-own .actions > .btn').evaluateAll(nodes=>nodes.map(button=>{const r=button.getBoundingClientRect(),p=button.closest('.build-own').getBoundingClientRect(),walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()&&!n.parentElement.closest('svg,[aria-hidden="true"]')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}),text=[];while(walker.nextNode()){const range=document.createRange();range.selectNodeContents(walker.currentNode);text.push(...[...range.getClientRects()].map(rect=>rect.toJSON()));}return {label:button.textContent.trim(),rect:r.toJSON(),panel:p.toJSON(),text,scroll:button.scrollWidth,client:button.clientWidth,fontSize:parseFloat(getComputedStyle(button).fontSize)};}));
 assert.equal(buttons.length,2,'Both original build actions remain available');
 assert.match(buttons[0].label,/Use my whole collection$/);assert.match(buttons[1].label,/Pick cards to build around$/);
 for(const button of buttons){
  assert(button.rect.left>=button.panel.left&&button.rect.right<=button.panel.right&&button.scroll<=button.client+1,`${game} Ideas ${width}: build action fits its panel`);
  assert(button.rect.height>=42&&button.fontSize>=15,`Wrapping preserves original full-sized readable actions: ${JSON.stringify(button)}`);
  assert(button.text.length>0,'The action retains visible text');
  for(const r of button.text)assert(r.left>=button.rect.left-.5&&r.right<=button.rect.right+.5&&r.top>=button.rect.top-.5&&r.bottom<=button.rect.bottom+.5,`${game} Ideas ${width}: complete action text is contained without clipping ${JSON.stringify(button)}`);
 }
}
async function deckArt(app,game){
 const {page}=app,before=await inventorySnapshot(page);await navigate(page,'#decks/inspiration');
 if(game==='ptcg'){
  const card=page.locator('.arch').filter({has:page.locator('b',{hasText:/^Dhelmise$/})}),none=page.locator('.arch').filter({has:page.locator('b',{hasText:/^No supplied cover$/})});
  await card.waitFor();assert(await card.isDisabled());assert.equal(await card.getAttribute('data-key'),'');assert.match(await card.innerText(),/0 in Top 8/);assert.match(await card.locator('.arch-list-state').innerText(),/No published list available/);
  assert.equal(await card.locator('.arch-art img').getAttribute('src'),DHELMISE_COVER.imageLarge,'Supplied lower-place exact cover URL, not an invented mascot');
  await page.waitForFunction(()=>{const card=[...document.querySelectorAll('.arch')].find(n=>n.querySelector('b')?.textContent==='Dhelmise'),img=card?.querySelector('.arch-art img');return img?.isConnected&&img.complete&&img.naturalWidth>0&&!img.hidden;});
  assert.match(await none.getAttribute('class'),/no-cover/);assert(await none.locator('.arch-art-fallback').isVisible());assert(await none.locator('.arch-art-state').isVisible());assert(await none.isDisabled());assert.equal(await none.locator('img').count(),0,'No supplied art stays an honest fallback');
  for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await noOverflow(page,'#content',`Pokémon Meta ${width}`);await capture(page,`meta-ptcg-${width}`);}
 }
 await navigate(page,'#decks/ideas');
 if(game!=='mtg'){
  const tile=page.locator('.collection-ideas-grid > .collection-idea').first();await tile.waitFor();const open=tile.locator('.idea-card-open[data-act="tCard"]'),build=tile.locator('[data-act="tBuildMulti"]');
  const contracts=await tile.evaluate(n=>({id:n.querySelector('[data-act="tCard"]').dataset.id,ids:n.querySelector('[data-act="tBuildMulti"]').dataset.ids}));
  assert(CARDS[game].some(c=>c.id===contracts.id));assert(contracts.ids.split(',').every(id=>CARDS[game].some(c=>c.id===id)));assert((await open.getAttribute('aria-label')).length>5);
  for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await noOverflow(page,'#content',`${game} Ideas ${width}`);await ideaActionLabels(page,game,width);const shape=await tile.locator('.idea-row-art').boundingBox();assert(shape.width>shape.height,`${game} uses a landscape crop at ${width}px`);assert.equal(await open.getAttribute('data-id'),contracts.id);assert.equal(await build.getAttribute('data-ids'),contracts.ids);if(game==='ptcg')assert.equal(await tile.locator('.idea-row-art.pk-crop').count(),1);await capture(page,`ideas-${game}-${width}`);}
  await open.click();await page.waitForFunction(id=>window.__uiTestState.ui.sheetCtx?.id===id&&document.querySelector('#sheet').open,contracts.id);await closeSheet(page);assert.equal(await build.getAttribute('data-ids'),contracts.ids,'Opening card does not change Build seed IDs');
 }
 assert.equal(await inventorySnapshot(page),before);report.push(`${game}: deck browsing preserves inventory; ${game==='ptcg'?'Dhelmise lower-place supplied cover keeps 0 Top 8, no clickable list, and honest no-art fallback; ':''}${game==='mtg'?'existing Magic Ideas preserved':'Ideas crop and original card/Build IDs stable across five widths'}.`);
}
async function historyRace(app){
 // Run the actual price jump with motion and glass both disabled. A pending
 // history response must not steal a newer card, target or keyboard focus.
 const before=await inventorySnapshot(app.page),gate=app.hold(u=>u.pathname.endsWith('/market-history')&&u.searchParams.get('id')===CARDS.ptcg[0].id);await openCard(app.page,'ptcg');await gate.seen;await jump(app.page,'sellers');await closeSheet(app.page);await openCard(app.page,'ptcg',1);const oldResponse=app.page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname.endsWith('/market-history')&&u.searchParams.get('id')===CARDS.ptcg[0].id;});gate.release();await oldResponse;await app.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await jump(app.page,'history');assert.equal(await app.page.locator('.cs-title h2').innerText(),CARDS.ptcg[1].name);assert.equal(await app.page.evaluate(()=>window.__uiTestState.ui.sheetCtx.id),CARDS.ptcg[1].id);assert.equal(await inventorySnapshot(app.page),before);await capture(app.page,'details-reduced-motion-history-race');report.push('Reduced motion, glass disabled and late history A → newer card B retain B and saved data.');
}
try{
 browser=await chromium.launch();const failures=[];
 const runScenario=async(name,game,run,options={})=>{let app;try{app=await openApp(browser,server.base,{game,...options});await run(app,game);await app.close();}catch(error){failures.push({name,error});console.error('FAIL: '+name+'\n'+String(error.stack||error));if(app){await capture(app.page,'details-'+name+'-failure').catch(()=>{});await app.context.close();}}};
 // Each scenario has a fresh, deterministic app context. A failed Magic flip
 // cannot hide Pokémon/Yu-Gi-Oh pricing or any game's independent deck art.
 // Preserve every original assertion and make every captured stack fatal.
 for(const game of GAMES)for(const [name,run] of [['current',currentDetail],['missing-quotes',missingQuotes],['deck-art',deckArt]])await runScenario(game+'-'+name,game,run);
 await runScenario('reduced-motion-history-race','ptcg',historyRace,{reducedMotion:'reduce',glass:false});
 if(failures.length)throw new AggregateError(failures.map(f=>f.error),failures.map(f=>f.name+': '+String(f.error.stack||f.error)).join('\n\n'));
 console.log('PASS: '+report.join('\nPASS: '));
}catch(error){failure=error;throw error;}finally{await saveReport('detail-rules-browser',report,failure);await browser?.close();await server.close();}
