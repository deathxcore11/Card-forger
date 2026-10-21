// Hosted real-app QA. Local use is limited to --validate-fixtures or node --check.
// Guard precedes Playwright import and any server/browser start. Do not bypass it.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {WIDTHS,GAMES,SETS,VASM,MP25,CARDS,EXPECTED,SYMBOLS,ISO,ART_EVIDENCE,RESULTS,validateFixtures,startServer,openApp,navigate,closeSheet,noOverflow,capture,inventorySnapshot,isHistoryURL,assertSymbolMounts} from './card-polish-fixtures.mjs';

console.log(await validateFixtures());
if(process.argv.includes('--validate-fixtures'))process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Card-polish browser execution is restricted to the authorized hosted GitHub Actions job. Use --validate-fixtures for local checks.');
const {chromium}=await import('playwright');
const server=await startServer();let browser;const outcomes=[],failures=[],report=[ART_EVIDENCE];
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const tiles=page=>page.locator('#content .set-grid > .grid-card');
async function readyCatalogues(page){
 // Boot refreshes the shared Scryfall symbol index even in another game. Its
 // completion redraws the current page, so the game's own busy flag is not
 // enough to establish that initial catalogue hydration has finished.
 await page.waitForFunction(()=>{const S=window.__uiTestState,g=S.state.settings.game,shared=S.ui.sets,active=g==='mtg'?shared:window.__uiTestTcg.ui(g).sets;return !shared.busy&&(shared.list.length||shared.error)&&!active.busy&&(active.list.length||active.error);});
 const state=await page.evaluate(()=>{const S=window.__uiTestState,g=S.state.settings.game;return {shared:S.ui.sets.error,active:(g==='mtg'?S.ui.sets:window.__uiTestTcg.ui(g).sets).error};});assert.deepEqual(state,{shared:'',active:''},'Both real catalogue loads completed without a provider/schema error');
}
async function readyIndex(page){await readyCatalogues(page);await page.waitForFunction(()=>window.__uiTestState.ui.view==='sets');await page.locator('.set-year-section .set-row').first().waitFor();}
async function readySymbolIndex(page){
 await readyIndex(page);
 // The symbol-less synthetic release is intentionally unclassified, not a
 // released main booster. Exercise the real All sets control before checking
 // every fallback; do not promote invented fixture metadata into production.
 assert.equal(await page.locator('.set-row[data-id="synthetic-missing"]').count(),0,'Unknown synthetic release is not a default main booster');
 const all=page.locator('[data-act="tSetsFamily"][data-value="all"]');await all.click();
 await page.locator('.set-row[data-id="synthetic-missing"]').waitFor();
 assert.equal(await all.getAttribute('aria-pressed'),'true','Symbol coverage explicitly browses All sets');
 assert.equal(await page.locator('.set-row').count(),SETS.ptcg.length,'All source fixtures remain available for symbol coverage');
}
async function readySet(page,game,id=EXPECTED[game].set){await readyCatalogues(page);await page.waitForFunction(({game,id})=>{const S=window.__uiTestState,s=game==='mtg'?S.ui.set:window.__uiTestTcg.ui(game).set;return S.state.settings.game===game&&S.ui.view==='set'&&(game==='mtg'?s.code===id:s.id===id)&&s.loaded&&!s.busy&&!s.detailsBusy&&s.cards.length>0;},{game,id});assert.equal(await page.evaluate(g=>(g==='mtg'?window.__uiTestState.ui.set:window.__uiTestTcg.ui(g).set).error,game),'','Exact set finished loading without an error');await tiles(page).first().waitFor();}
async function openSet(page,game,id=EXPECTED[game].set){await navigate(page,'#set/'+encodeURIComponent(id));await readySet(page,game,id);}
async function cardTile(page,game,id,setId=EXPECTED[game].set){
 await readySet(page,game,setId);
 // Never retain a visual position across a rerender. TCG tiles expose exact
 // card/release IDs; Magic exposes the provider-array slot plus card name.
 const selector=game==='mtg'?await page.evaluate(id=>{const cards=window.__uiTestState.ui.set.cards,i=cards.findIndex(c=>c.id===id);return i<0?null:`[data-set-i="${i}"][data-name=${JSON.stringify(cards[i].name)}]`;},id):`[data-id=${JSON.stringify(id)}][data-set-id=${JSON.stringify(setId)}]`;
 assert(selector,`Exact ${game} card ${id} exists`);const target=page.locator('#content .set-grid > .grid-card'+selector);await target.waitFor();assert.equal(await target.count(),1,'One exact card/release tile');assert.equal(await target.evaluate((n,g)=>g==='mtg'?window.__uiTestState.ui.set.cards[Number(n.dataset.setI)]?.id:n.dataset.id,game),id);
 // Locator click/focus handles scrolling and reacquires the exact node if it
 // detaches. An eager scrollIntoViewIfNeeded pins a transient element instead.
 return target;
}
async function select(page,selector,value){
 const control=page.locator(selector);assert.equal(await control.count(),1,'One real control '+selector);const label=await control.locator('option').evaluateAll((nodes,v)=>nodes.find(n=>n.value===v)?.label,value);assert(label,'Provider-backed option '+value+' exists');
 await control.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();
 await page.waitForFunction(({selector,value})=>{const n=document.querySelector(selector);return n?.isConnected&&n.value===value&&[...n.options].find(o=>o.value===value)?.hasAttribute('selected');},{selector,value});await frame(page);
}
async function openCard(page,game,id,{keyboard=false,setId=EXPECTED[game].set}={}){
 const target=await cardTile(page,game,id,setId);if(keyboard){await target.focus();await page.keyboard.press('Enter');}else await target.click();await page.waitForFunction(({game,id})=>{const ctx=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&(game==='mtg'?ctx?.print?.id===id:ctx?.id===id)&&!!document.querySelector('.card-price-summary');},{game,id});
 assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.setId),setId,'Detail keeps exact release identity');
 await page.waitForFunction(()=>{const img=document.querySelector('#sheet .cs-card .card-img');return img?.complete&&img.naturalWidth>0;});
}
async function tab(page,id,{keyboard=false}={}){
 if(id==='prices')await page.evaluate(()=>{window.__polishTabBefore={panel:document.querySelector('#card-history'),state:window.__uiTestState.state};});
 const target=page.locator(`#card-tab-${id}`);if(keyboard){await target.focus();await page.keyboard.press('Enter');}else await target.click();await page.waitForFunction(id=>{if(document.querySelector('#card-tab-'+id)?.getAttribute('aria-selected')!=='true')return false;if(id!=='prices')return true;const old=window.__polishTabBefore,n=document.querySelector('#card-history');return n?.isConnected&&n!==old.panel&&!old.panel.isConnected&&window.__uiTestState.state!==old.state&&window.__uiTestState.ui.sheetCtx?.tab==='prices';},id);await frame(page);
}
async function activeQuote(page){return page.evaluate(()=>{const ctx=window.__uiTestState.ui.sheetCtx,g=ctx.game||'mtg';let card=g==='mtg'?ctx.print:window.__uiTestTcg.cardOf(g,ctx.id);if(g!=='mtg')card=window.__uiTestTcg.setContextCard(g,card,ctx.setId,window.__uiTestTcg.ui(g).sets.list);return window.__polishPricing.quoteForContext(g,card,ctx);});}
async function cacheSnapshot(page){return page.evaluate(()=>JSON.stringify(Object.fromEntries(['ygo','ptcg'].map(g=>[g,Object.fromEntries(Object.entries(window.__uiTestTcg.cache[g]).map(([id,c])=>[id,{id:c.id,sets:c.sets,prices:c.prices,setContext:c.setContext,rarity:c.rarity}]))]))));}
async function controlTargets(page,selectors,label){for(const selector of selectors){const elements=page.locator(selector);for(let i=0;i<await elements.count();i++){const n=elements.nth(i);if(!await n.isVisible())continue;const box=await n.boundingBox();assert(box&&box.width>=24&&box.height>=24,`${label}: usable >=24px control ${selector} ${JSON.stringify(box)}`);}}}
async function layout(page,scope,label,controls=[]){for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await frame(page);await noOverflow(page,scope,label+' '+width);await controlTargets(page,controls,label+' '+width);await capture(page,`card-polish-${label}-${width}`);}await page.setViewportSize({width:390,height:1000});}
async function clearance(page,target){
 try{await page.waitForFunction(selector=>{const n=document.querySelector(selector),body=document.querySelector('#sheetBody'),head=body?.querySelector('.sheet-head'),tabs=body?.querySelector('.cs-tabs');if(!n?.isConnected||!head||!tabs)return false;const r=n.getBoundingClientRect();return r.top>=Math.max(body.getBoundingClientRect().top,head.getBoundingClientRect().bottom,tabs.getBoundingClientRect().bottom)-2&&r.top<Math.min(innerHeight,body.getBoundingClientRect().bottom)-20;},target);}
 catch(error){error.stack+='\nClearance: '+JSON.stringify(await page.evaluate(selector=>{const rect=n=>n?.getBoundingClientRect().toJSON(),body=document.querySelector('#sheetBody');return {target:rect(document.querySelector(selector)),body:rect(body),head:rect(body?.querySelector('.sheet-head')),tabs:rect(body?.querySelector('.cs-tabs')),scrollTop:body?.scrollTop};},target));throw error;}
}
async function jump(page,target='history'){
 await page.locator(`.card-price-summary [data-act="cardPriceJump"][data-target="${target}"]`).click();await page.waitForFunction(id=>document.activeElement===document.querySelector('#card-'+id)&&document.querySelector('#card-tab-prices')?.getAttribute('aria-selected')==='true',target);await clearance(page,'#card-'+target);
}
async function historyState(page,state){await page.waitForFunction(state=>document.querySelector('#card-history')?.dataset.historyState===state,state);const history=page.locator('#card-history');assert.equal(await history.locator('.market-chart').count(),0,'Missing matching history never produces an invented graph');assert.equal(await history.locator('.history-empty').count(),1,'One concise empty-state paragraph');assert.equal(await history.locator('.history-coverage').count(),0,'No duplicated empty-state summary');return history;}
async function unobservedYgoHistory(page){
 const history=await historyState(page,'empty'),quote=await activeQuote(page);
 assert.equal(await history.getAttribute('data-history-source-state'),'empty','Both exact providers completed with matching empty history');
 assert.equal(await history.locator('.history-empty').innerText(),'No recorded quotes for this selection.');
 assert.equal(await history.locator('[data-act="historyChoosePrinting"]').count(),0,'A verified empty result is not unresolved printing selection');
 assert.equal(await page.evaluate(key=>window.__uiTestState.state.settings.marketHistory?.[key]??null,quote.key),null,'This exact selection has never been recorded locally');
 return history;
}
async function singleYgoObservation(page,edition,value){
 await page.waitForFunction(()=>{const n=document.querySelector('#card-history');return n?.dataset.historyState==='ready'&&n.dataset.historySourceState==='empty';});
 const history=page.locator('#card-history'),quote=await activeQuote(page),date=ISO.slice(0,10),price='$'+value.toFixed(2),summary=`One recorded price: ${price} on ${date}.`;
 const expected={game:'ygo',cardId:EXPECTED.ygo.edition,releaseId:MP25.id,edition:'MP25-EN003',rarity:'Starlight Rare',editionKey:'MP25-EN003::Starlight Rare',selectedEdition:edition,selectionVerified:true,currency:'USD',finish:'reference',source:'Synthetic exact-edition fixture',label:'MP25-EN003 · Starlight Rare · '+{'1st-edition':'1st Edition',unlimited:'Unlimited'}[edition],value};
 const stored=await page.evaluate(key=>window.__uiTestState.state.settings.marketHistory?.[key],quote.key);
 for(const [key,want]of Object.entries(expected)){assert.equal(quote[key],want,'Active observation identity '+key);assert.equal(stored?.[key],want,'Saved observation identity '+key);}
 assert.equal(stored.points.length,1,'Repeated checks on the same date cannot invent earlier observations');
 assert.equal(stored.points[0].date,date);assert.equal(stored.points[0].value,value);assert.equal(stored.points[0].observedAt.slice(0,10),date);assert.equal(stored.points[0].sourceAsOf,ISO);
 assert.equal(await history.locator('.market-chart').count(),1);assert.equal(await history.locator('.history-single-chart').count(),1);assert.equal(await history.locator('.market-chart:not(.history-single-chart),.market-chart path,.market-chart polyline').count(),0,'One real observation cannot become a historical trend');
 assert.equal(await history.locator('.market-chart circle').count(),1);assert.equal(await history.locator('.market-chart').getAttribute('aria-label'),summary+' No earlier history available');
 assert.equal(await history.locator('.history-empty').count(),0);assert.equal(await history.locator('.history-coverage').innerText(),'1 verified observation. '+summary);
 assert.equal(await history.locator('.history-identity').innerText(),quote.source+' · selected printing / device · USD\n'+quote.label);
 assert.equal(await history.locator('.history-values [data-change="marketPoint"] option').count(),1);assert.equal(await history.locator('.history-values [data-change="marketPoint"] option').textContent(),date+' · '+price);
 assert.equal(await history.locator('[data-act="historyChoosePrinting"]').count(),0);
 return history;
}
async function historySafety(app,editions=[]){
 const requests=app.requests.filter(r=>isHistoryURL(new URL(r.url)));
 const signature=req=>{const u=new URL(req.url);return JSON.stringify([req.method,u.origin+u.pathname,[...u.searchParams].sort(),req.settled]);};
 const expected=editions.flatMap(selectedEdition=>['archive','recent'].map(source=>signature({method:'GET',settled:true,url:server.base+'/api/prices/'+source+'?'+new URLSearchParams({game:'ygo',id:EXPECTED.ygo.edition,finish:'reference',edition:'MP25-EN003',rarity:'Starlight Rare',releaseId:MP25.id,selectedEdition,currency:'USD'})})));
 assert.deepEqual(requests.map(signature).sort(),expected.sort(),'Only one exact MP25 archive/recent pair per explicit physical edition; no generic, extra, duplicate or mismatched history requests');
}
async function failedSymbol(page,id){
 await page.waitForFunction(id=>{const slot=document.querySelector('[data-set-symbol-id="'+id+'"]'),img=slot?.querySelector('img.set-catalogue-symbol');return slot?.classList.contains('no-art')&&(!img||img.complete&&img.hidden&&img.onload===null&&img.onerror===null&&!img.dataset.symbolNext&&!img.dataset.symbolLast);},id);
 const row=page.locator('.set-row[data-id="'+id+'"]');assert(await row.locator('.set-media-fallback').isVisible());assert.equal(await row.locator('.set-art-code').innerText(),id.toUpperCase());assert(await row.locator('.set-art-code').isVisible(),'An actual readable code replaces failed/missing art');assert.equal(await row.locator('.set-media-fallback img,.set-media-fallback svg').count(),0);
}
async function symbolAttempts(app,key,{failed=true}={}){
 const id={normal:'sv08',broken:'sv03',missing:'synthetic-missing'}[key],expected=(failed?SYMBOLS[key]:SYMBOLS[key].slice(0,1)).map(u=>new URL(u,server.base+'/').href);
 const records=await app.page.evaluate(()=>window.__polishSymbolMounts());
 const mounts=assertSymbolMounts(records,id,expected,{failed});
 // Network requests may be coalesced across nodes, but never exceed the
 // actual observed mounts. DOM events prove order even for cached responses.
 for(const url of expected)assert(app.images.filter(u=>u===url).length<=mounts.length,key+': network attempts cannot exceed distinct image lifetimes');
 return mounts;
}

// Retired nodes may finish an already-pending request after removal. Their
// prefixes are revalidated above; only current terminal nodes must be unchanged.
const symbolIdentity=groups=>groups.map(mounts=>mounts.map(({mount,revision,retiredAt,connected,events})=>({mount,revision,retiredAt,connected,...(connected?{events}:{})})));

async function ygoFacets(app){
 const {page}=app;await readyIndex(page);await openSet(page,'ygo');const before=await inventorySnapshot(page),cache=await cacheSnapshot(page);
 assert.equal(await tiles(page).count(),4,'One tile per card, not per rarity/code');
 const multi=await cardTile(page,'ygo',EXPECTED.ygo.multiple);assert.equal(await multi.getAttribute('data-printing'),null);assert.equal(await multi.getAttribute('data-rarity-flair'),null);assert.equal(await multi.getAttribute('data-tier'),'tn');assert.doesNotMatch(await multi.innerText(),/\$999|\$888|OTHR/);
 const collector=await cardTile(page,'ygo',EXPECTED.ygo.unknown),common=await cardTile(page,'ygo',EXPECTED.ygo.common),known=await cardTile(page,'ygo',EXPECTED.ygo.known);
 assert.equal(await collector.getAttribute('data-tier'),'tn');assert.equal(await collector.getAttribute('data-rarity-flair'),'yr4');assert.equal(await common.getAttribute('data-rarity-flair'),'yr0');assert.equal(await known.getAttribute('data-tier'),'t2');assert.equal(await known.getAttribute('data-rarity-flair'),'yr3');assert.match(await known.innerText(),/\$12\.50/);
 const style=async n=>n.locator('.card-img').evaluate(img=>({border:getComputedStyle(img).borderTopColor,borderWidth:getComputedStyle(img).borderTopWidth,shadow:getComputedStyle(img).boxShadow}));assert.deepEqual(await style(collector),await style(common),'Rarity draws no second border: an unknown price keeps the same neutral frame');const mark=async n=>n.locator('.tset small').first().evaluate(e=>({cls:e.className,image:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).color}));const cm=await mark(collector);assert.match(cm.cls,/rx-collector/);assert.notDeepEqual(cm,await mark(common),'Unknown-price Collector rarity has a visibly distinct foil-lettered emblem, not a fabricated price tier');
 await layout(page,'#content','ygo-rarity-grid',['[data-change="tSetRarity"]','[data-act="tSetFilter"]']);
 await select(page,'[data-change="tSetRarity"]','Ultra Rare');const ambiguous=await cardTile(page,'ygo',EXPECTED.ygo.multiple);assert.equal(await ambiguous.getAttribute('data-printing'),null,'Same-rarity regional codes remain unresolved');assert.equal(await ambiguous.getAttribute('data-rarity-flair'),null,'Do not pick a regional code solely for flair');
 await select(page,'[data-change="tSetRarity"]','Super Rare');assert.equal(await tiles(page).count(),1);const selected=await cardTile(page,'ygo',EXPECTED.ygo.multiple);assert.equal(await selected.getAttribute('data-printing'),'VASM-EN001::Super Rare');assert.equal(await selected.getAttribute('data-rarity-flair'),'yr2');assert.equal(await selected.getAttribute('data-tier'),'tn');
 await openCard(page,'ygo',EXPECTED.ygo.multiple);assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.priceEdition),'VASM-EN001::Super Rare');assert.equal(await page.locator('#sheet .cd-img').first().getAttribute('data-rarity-flair'),'yr2');
 let q=await activeQuote(page);assert.equal(q.editionKey,'VASM-EN001::Super Rare');assert.equal(q.releaseId,VASM.id);assert.equal(q.selectedEdition,'');assert.equal(q.value,null);assert.doesNotMatch(await page.locator('.card-price-summary').innerText(),/\$999|\$888|1st Edition|Unlimited/);
 await tab(page,'prices');await historyState(page,'edition-required');assert.match(await page.locator('#card-history .history-empty').innerText(),/select an edition/i);assert.match(await page.locator('#card-price-selection').innerText(),/VASM-EN001.*Super Rare/s);assert.doesNotMatch(await page.locator('#sheetBody').innerText(),/\$999|\$888|OTHR-EN999/);await historySafety(app);
 assert.equal(await inventorySnapshot(page),before);assert.equal(await cacheSnapshot(page),cache,'Presentation must not rewrite generic cached price/rarity');await tab(page,'overview');await page.locator('#sheet [data-act="tOwn"]').first().click();await page.locator('#tPrint').waitFor();assert.equal(await page.locator('#tPrint').inputValue(),'VASM-EN001|Super Rare');assert.equal(await page.locator('#tEdition').inputValue(),'','No default First Edition or Unlimited');await page.locator('#tQty').fill('1');await page.locator('[data-act="tOwnSave"]').click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);
 const saved=await page.evaluate(()=>window.__uiTestState.state.tcg.ygo.collection.at(-1));assert.equal(saved.cardId,EXPECTED.ygo.multiple);assert.equal(saved.printing,'VASM-EN001');assert.equal(saved.rarity,'Super Rare');assert.equal(saved.edition,'');assert.equal(saved.setReleaseId,VASM.id);
 await page.reload();await page.locator('#app.ready').waitFor();await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});await readySet(page,'ygo');assert.deepEqual(await page.evaluate(()=>window.__uiTestState.state.tcg.ygo.collection.at(-1)),saved);assert.equal(await cacheSnapshot(page),cache);
 report.push('VASM multi-code/rarity ambiguity remains honest; a uniquely proven Super Rare facet survives tile → detail → prices → Add → persisted lot with no invented edition or generic-price borrowing.');
}

async function ygoSelection(app){
 const {page}=app;await readyIndex(page);await openSet(page,'ygo');await openCard(page,'ygo',EXPECTED.ygo.multiple);const before=await inventorySnapshot(page),cache=await cacheSnapshot(page);await tab(page,'prices');await historyState(page,'printing-required');assert.equal(await page.locator('#card-history [data-act="historyChoosePrinting"]').innerText(),'Select printing');
 for(const width of WIDTHS){
  await page.setViewportSize({width,height:1000});await jump(page);await historyState(page,'printing-required');await noOverflow(page,'#sheetBody','unresolved YGO history '+width);await controlTargets(page,['[data-act="historyChoosePrinting"]','[data-change="historyEdition"]'],'unresolved history '+width);await capture(page,'card-polish-ygo-printing-required-'+width);
  await page.locator('#card-history [data-act="historyChoosePrinting"]').click();await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-change="historyEdition"]'));await clearance(page,'[data-change="historyEdition"]');
 }
 await page.setViewportSize({width:390,height:1000});await select(page,'[data-change="historyEdition"]',"VASM-EN001::Collector's Rare");await historyState(page,'edition-required');assert.equal(await page.locator('#sheet .cd-img').first().getAttribute('data-rarity-flair'),'yr4');const q=await activeQuote(page);assert.equal(q.editionKey,"VASM-EN001::Collector's Rare");assert.equal(q.selectedEdition,'');assert.equal(q.value,null);await jump(page);await capture(page,'card-polish-ygo-edition-required');
 await select(page,'[data-change="historyEdition"]','VASM-E001::Ultra Rare');await historyState(page,'edition-required');assert.equal((await activeQuote(page)).editionKey,'VASM-E001::Ultra Rare');assert.equal(await page.locator('#sheet .cd-img').first().getAttribute('data-rarity-flair'),'yr3');
 await select(page,'[data-change="historyEdition"]','');await historyState(page,'printing-required');assert.equal(await page.locator('#sheet .cd-img').first().getAttribute('data-rarity-flair'),null,'Clearing the selection clears exact rarity flair');await historySafety(app);assert.equal(await inventorySnapshot(page),before);assert.equal(await cacheSnapshot(page),cache);
 // Follow the reported MP25 surface through real release loading and exact
 // provider-shaped edition data; never inject the selection or price into DOM.
 await closeSheet(page);await openSet(page,'ygo',MP25.id);const starlight=await cardTile(page,'ygo',EXPECTED.ygo.edition,MP25.id);assert.equal(await starlight.getAttribute('data-rarity-flair'),'yr4');assert.equal(await starlight.getAttribute('data-tier'),'t0');assert.match(await starlight.innerText(),/\$0.31–\$0.54/);assert.match(await starlight.innerText(),/Market range/);
 await select(page,'[data-change="tSetEdition"]','1st-edition');
 assert.equal(await (await cardTile(page,'ygo',EXPECTED.ygo.edition,MP25.id)).getAttribute('data-tier'),'t0');
 assert.match(await (await cardTile(page,'ygo',EXPECTED.ygo.edition,MP25.id)).innerText(),/\$0.54/);
 assert.equal(await (await cardTile(page,'ygo',EXPECTED.ygo.edition,MP25.id)).getAttribute('data-rarity-flair'),'yr4','Printed rarity survives a low market-price band');
 await capture(page,'card-polish-ygo-set-edition');
 await select(page,'[data-change="tSetEdition"]','');
 await openCard(page,'ygo',EXPECTED.ygo.edition,{setId:MP25.id});await page.waitForFunction(id=>window.__uiTestTcg.cache.ygo[id]?.sets?.find(p=>p.code==='MP25-EN003'&&p.rarity==='Starlight Rare')?.quotes?.length===2,EXPECTED.ygo.edition);
 // A provider-supported preview, not a claim about the owner's physical copy.
 assert(await page.locator('[data-change="ygoPreviewEdition"]').isVisible());assert.equal(await page.locator('[data-change="ygoPreviewEdition"]').inputValue(),'1st-edition');assert.match(await page.locator('.ygo-price-preview').innerText(),/1st Edition selected for this preview/);assert.match(await page.locator('.ygo-price-preview').innerText(),/USD references are not condition values/);assert.equal(await page.locator('.card-price-reference strong').innerText(),'$0.54');await historyState(page,'empty');
 await layout(page,'#sheetBody','ygo-supported-preview',['[data-change="ygoPreviewPrinting"]','[data-change="ygoPreviewEdition"]']);
 await select(page,'[data-change="ygoPreviewEdition"]','unlimited');assert.equal(await page.locator('.card-price-reference strong').innerText(),'$0.31');assert.match(await page.locator('.card-buy-link').getAttribute('href'),/Printing=Unlimited/);assert.doesNotMatch(await page.locator('.ygo-price-preview').innerText(),/selected for this preview/);await historyState(page,'empty');
 const requestedEditions=['1st-edition','unlimited'];await tab(page,'prices');
 // Opening Prices records the selected current quote. The providers are still
 // empty: only this exact Unlimited observation now exists on this device.
 const observedEditions=new Set(['unlimited']);await singleYgoObservation(page,'unlimited',.31);await capture(page,'card-polish-mp25-history-single-unlimited-open');
 for(const [edition,label,value]of [['','edition unspecified',null],['1st-edition','1st Edition',.54],['unlimited','Unlimited',.31],['limited','Limited',null],['','edition unspecified',null]]){
  if(await page.locator('[data-change="historyYgoEdition"]').inputValue()!==edition)await select(page,'[data-change="historyYgoEdition"]',edition);
  const quote=await activeQuote(page);assert.equal(quote.releaseId,MP25.id);assert.equal(quote.editionKey,'MP25-EN003::Starlight Rare');assert.equal(quote.selectedEdition,edition);assert.equal(quote.value,value);assert.equal(quote.currency,'USD');
  const badge=page.locator('#sheet .cd-set[data-act="tSet"]').first();assert.equal(await badge.getAttribute('data-id'),MP25.id);assert.match(await badge.innerText(),/MP25-EN003/);assert((await badge.innerText()).includes('Selected release · '+label),'Release badge and selected quote name the same explicit physical edition');
  assert.equal(await page.locator('.card-price-reference strong').innerText(),value===null?'No quote yet':'$'+value.toFixed(2));assert((await page.locator('.card-price-reference').innerText()).includes('MP25-EN003 · Starlight Rare · '+(edition?label:'Edition not specified')));
  assert.equal(await page.locator('#sheet .cd-img').first().getAttribute('data-rarity-flair'),'yr4','Starlight flair survives missing quote and clearing edition');
  if(!edition)await historyState(page,'edition-required');
  if(edition){
   if(!requestedEditions.includes(edition))requestedEditions.push(edition);
   if(observedEditions.has(edition))await singleYgoObservation(page,edition,value);
   else{await unobservedYgoHistory(page);await capture(page,'card-polish-mp25-history-empty-'+edition);}
   await jump(page);
   // A real Prices jump records a known quote, never an unavailable edition.
   if(value!==null){observedEditions.add(edition);await singleYgoObservation(page,edition,value);await capture(page,'card-polish-mp25-history-single-'+edition);}
   else{await unobservedYgoHistory(page);await capture(page,'card-polish-mp25-history-empty-after-jump-'+edition);}
  }
  await historySafety(app,requestedEditions);
 }
 await capture(page,'card-polish-mp25-edition-cleared');await historySafety(app,requestedEditions);assert.equal(await inventorySnapshot(page),before,'Browsing editions cannot alter saved copies');
 assert.deepEqual(await page.evaluate(({id,releaseId})=>Object.values(window.__uiTestState.state.settings.marketHistory||{}).filter(q=>q.game==='ygo'&&q.cardId===id&&q.releaseId===releaseId).map(q=>q.selectedEdition).sort(),{id:EXPECTED.ygo.edition,releaseId:MP25.id}),['1st-edition','unlimited'],'Only the two explicitly observed editions have device history; no Limited or unspecified-edition observations');
 report.push('Unresolved printing and physical edition are distinct, each has one empty message, Select printing focuses the real selector, and headings clear sticky chrome at all six widths.');
 report.push('Prices records exactly one dated device observation per selected available edition ($0.31 Unlimited, $0.54 First Edition); both exact remote histories remain empty, unobserved/unsupported selections remain empty, and no historical trend or owned copy is invented.');
}

async function knownPrice(app,game){
 const {page}=app;await readyIndex(page);await openSet(page,game);const known=await cardTile(page,game,EXPECTED[game].known);assert.equal(await known.getAttribute('data-tier'),'t2',game+' retains real $12.50 price tier');assert.match(await known.innerText(),/\$12\.50/);assert.equal(await known.locator('.card-img').getAttribute('data-tier'),'t2',game+' card image retains its genuine price border');if(game!=='ygo')assert.equal(await known.getAttribute('data-rarity-flair'),null,'YGO rarity styling cannot leak into another game');
 await openCard(page,game,EXPECTED[game].known);assert.equal(await page.locator('.card-price-reference strong').innerText(),'$12.50');assert.equal((await activeQuote(page)).value,12.5);await tab(page,'prices');
 // The app may record this one current provider check. It must never fabricate
 // earlier observations or connect an empty external response into a trend.
 assert.equal(await page.locator('#card-history .market-chart:not(.history-single-chart)').count(),0,'Empty fixture feeds cannot create a historical trend');
 if(game==='ygo')await historySafety(app);
 await layout(page,'#sheetBody',game+'-known-price',['[data-act="cardPriceJump"]','[data-act="cardTab"]']);await closeSheet(page);await openCard(page,game,EXPECTED[game].unknown);await tab(page,'prices');await historyState(page,game==='ygo'?'edition-required':'empty');
 const text=await page.locator('#card-history .history-empty').innerText();assert.match(text,game==='ygo'?/select an edition/i:/no|not|empty|available/i);assert.doesNotMatch(await page.locator('.card-price-reference strong').innerText(),/\$/);if(game!=='ygo'){assert(app.requests.some(r=>{const u=new URL(r.url);return isHistoryURL(u)&&u.searchParams.get('id')===EXPECTED[game].unknown;}),'Provider-empty state follows an actual matching provider request');}
 await jump(page);await capture(page,'card-polish-'+game+'-empty-history');report.push(game+': known $12.50 reference/t2 preserved; absent exact quote and empty history stay unknown, never $0 or a fabricated trend.');
}

async function pokemonSymbols(app){
 const {page}=app;await readySymbolIndex(page);const before=await inventorySnapshot(page),normal=page.locator('.set-row[data-id="sv08"]'),broken=page.locator('.set-row[data-id="sv03"]'),missing=page.locator('.set-row[data-id="synthetic-missing"]'),symbolLess=page.locator('.set-row[data-id="base1"]');
 for(const row of [normal,broken,missing,symbolLess]){await row.scrollIntoViewIfNeeded();assert.equal(await row.locator('.set-media-pokemon-symbol').count(),1);assert.equal(await row.locator('.set-row-main .pks').count(),0,'No duplicate tiny title symbol');}
 const img=normal.locator('img.set-catalogue-symbol');await page.waitForFunction(()=>{const n=document.querySelector('[data-set-symbol-id="sv08"] img.set-catalogue-symbol');return n?.complete&&n.naturalWidth>0&&!n.parentElement.classList.contains('no-art');});assert.equal(await img.getAttribute('src'),'img/pks/s/surging-sparks.png');
 const normalStyle=await img.evaluate(n=>({filter:getComputedStyle(n).filter,fit:getComputedStyle(n).objectFit,opacity:getComputedStyle(n).opacity}));assert.match(normalStyle.filter,/grayscale\(1\).*invert\(1\)/);assert.equal(normalStyle.fit,'contain');assert.equal(normalStyle.opacity,'1');
 for(const id of ['sv03','synthetic-missing','base1'])await failedSymbol(page,id);
 assert.equal(await symbolLess.locator('img.set-catalogue-symbol').count(),0,'A release known to have no expansion symbol must not create a speculative image');
 assert.equal(await missing.locator('img.set-catalogue-symbol').count(),1,'Missing provider metadata uses one bounded name-derived image, never duplicate images');
 const symbolBefore=symbolIdentity(await Promise.all([symbolAttempts(app,'normal',{failed:false}),symbolAttempts(app,'broken'),symbolAttempts(app,'missing')]));
 await layout(page,'#content','pokemon-white-symbols',['.set-row','[data-change="tSetsSort"]']);
 // Terminal DOM state, not a timed quiet period, proves fallback cannot loop.
 for(const id of ['sv03','synthetic-missing','base1'])await failedSymbol(page,id);assert.deepEqual(symbolIdentity(await Promise.all([symbolAttempts(app,'normal',{failed:false}),symbolAttempts(app,'broken'),symbolAttempts(app,'missing')])),symbolBefore,'Resizing preserves the SAME terminal image nodes and creates no retry loop');
 // layout() has just restored 390px from the widest viewport. Settle only
 // finite live motion before ONE geometry measurement, never retry inequality.
 // Hover translates a row; it does not scale it. Keep the real pointer state.
 await frame(page);const settled=await noOverflow(page,'#content','Settled Pokemon symbol slots',true);
 assert.deepEqual(symbolIdentity(await Promise.all([symbolAttempts(app,'normal',{failed:false}),symbolAttempts(app,'broken'),symbolAttempts(app,'missing')])),symbolBefore,'Finite-motion settlement cannot replace the terminal image nodes or restart their sources');
 const dimensions=await page.locator('.set-media-pokemon-symbol').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect(),row=n.closest('.set-row'),css=getComputedStyle(n),rowCss=getComputedStyle(row);return {id:n.dataset.setSymbolId,connected:n.isConnected,w:r.width,h:r.height,layoutWidth:n.offsetWidth,layoutHeight:n.offsetHeight,cssWidth:css.width,cssHeight:css.height,transform:css.transform,rowTransform:rowCss.transform,hovered:row.matches(':hover'),active:row.matches(':active')};}));
 const dimensionEvidence={width:settled.width,settlement:settled.settlement,slots:dimensions};
 assert.equal(dimensions.length,SETS.ptcg.length,'Every source fixture has a current symbol/code slot: '+JSON.stringify(dimensionEvidence));
 assert(dimensions.every(d=>d.connected&&d.w>0&&d.h>0&&d.w===dimensions[0].w&&d.h===dimensions[0].h),'All symbol/code slots have uniform dimensions: '+JSON.stringify(dimensionEvidence));
 report.push('Settled Pokemon symbol/code dimensions: '+JSON.stringify(dimensionEvidence));
 await openSet(page,'ptcg');await page.waitForFunction(()=>{const n=document.querySelector('.set-hero img.set-logo');return n?.complete&&n.naturalWidth>0;});const logoInfo=await page.locator('.set-hero img').evaluateAll(ns=>ns.filter(n=>!n.closest('.set-atmosphere[aria-hidden="true"]')).map(n=>({src:n.getAttribute('src'),filter:getComputedStyle(n).filter,complete:n.complete,width:n.naturalWidth,class:n.className})));const colored=logoInfo.find(x=>x.src==='https://assets.tcgdex.net/en/sv/sv08/logo.webp');assert(colored,'Inside-set detail retains authentic provider colored-logo URL');assert.equal(colored.filter,'none','Catalogue whitening cannot affect set-detail logo');assert(colored.complete&&colored.width>0,'The exact colored logo really decoded');
 await capture(page,'card-polish-pokemon-colored-set-logo');assert.equal(await inventorySnapshot(page),before);report.push('Pokemon catalogue uses a single uniform source-backed white symbol; exact-provider and missing-metadata fallback chains end in readable codes, Base Set creates no expansion-symbol image, and the in-set colored logo is unchanged.');
}
async function pokemonAllSymbolsFail(app){
 const {page}=app;await readySymbolIndex(page);for(const id of ['sv08','sv03','synthetic-missing','base1']){const row=page.locator('.set-row[data-id="'+id+'"]');await row.scrollIntoViewIfNeeded();await failedSymbol(page,id);}
 const before=await Promise.all(Object.keys(SYMBOLS).map(key=>symbolAttempts(app,key)));assert.equal(before.flat().filter(r=>r.connected).reduce((n,r)=>n+r.events.length,0),8,'The three CURRENT images exhaust exactly eight sources and disable handlers');assert.equal(await page.locator('[data-set-symbol-id="base1"] img').count(),0);await noOverflow(page,'#content','all symbols failed');await capture(page,'card-polish-pokemon-all-symbols-failed');assert.deepEqual(symbolIdentity(await Promise.all(Object.keys(SYMBOLS).map(key=>symbolAttempts(app,key)))),symbolIdentity(before),'Terminal images cannot restart or remount during layout');
}
async function magicCatalogue(app){
 const {page}=app;await readyIndex(page);const row=page.locator('.set-row[data-code="fdn"]');assert.equal(await row.locator('.set-media-pokemon-symbol,.set-catalogue-symbol').count(),0);const image=row.locator('.set-media > img');assert.equal(await image.getAttribute('src'),SETS.mtg[0].icon_svg_uri);const filter=await image.evaluate(n=>getComputedStyle(n).filter);assert.match(filter,/invert\(0\.9\)/,'Magic retains its established 90% invert treatment');assert.doesNotMatch(filter,/grayscale/,'Pokemon-only grayscale cannot change Magic');await layout(page,'#content','magic-catalogue-unchanged',['.set-row']);report.push('Magic keeps its original set emblem/layout path, with no Pokemon-only symbol wrapper or recoloring.');
}
async function reducedMotion(app){
 const {page}=app;await readyIndex(page);await openSet(page,'ygo');await openCard(page,'ygo',EXPECTED.ygo.unknown,{keyboard:true});await tab(page,'prices',{keyboard:true});await historyState(page,'edition-required');await jump(page);
 const motion=await page.locator('#sheet .cd-img[data-rarity-flair]').evaluateAll(ns=>ns.flatMap(n=>[n,...n.querySelectorAll('.card-img')].flatMap(el=>[null,'::before','::after'].map(pseudo=>{const s=getComputedStyle(el,pseudo);return {animation:s.animationName,duration:s.animationDuration,transition:s.transitionDuration};}))));
 assert(motion.length>0,'Selected rarity detail is present in reduced-motion mode');for(const m of motion){assert(m.animation==='none'||m.duration.split(',').every(t=>parseFloat(t)===0),'Reduced motion removes rarity animation '+JSON.stringify(m));}
 await noOverflow(page,'#sheetBody','Reduced motion selected rarity');await capture(page,'card-polish-reduced-motion');await historySafety(app);report.push('Reduced-motion and keyboard navigation retain exact rarity/printing without animated flair or obscured history headings.');
}

function failure(label,phase,error){const e=error instanceof Error?error:new Error(String(error));failures.push({label,phase,error:e});console.error('FAIL: '+label+' ('+phase+')\n'+e.stack);return {phase,stack:e.stack,diagnostics:e.fixtureDiagnostics||null};}
async function scenario(label,options,run){
 let app;const outcome={scenario:label,game:options.game,status:'passed',errors:[]};
 try{app=await openApp(browser,server.base,{...options,evidenceLabel:label});await run(app);}catch(error){outcome.errors.push(failure(label,app?'assertions':'bootstrap',error));}
 finally{if(app){try{app.health();}catch(error){outcome.errors.push(failure(label,'network/application safety',error));}if(outcome.errors.length)try{await capture(app.page,'card-polish-failure-'+label);}catch(error){outcome.errors.push(failure(label,'failure screenshot',error));}outcome.diagnostics=app.diagnostics();try{outcome.symbolMounts=await app.page.evaluate(()=>window.__polishSymbolMounts());}catch(error){outcome.symbolObservationError=String(error);}try{await app.context.close();}catch(error){outcome.errors.push(failure(label,'cleanup',error));}}if(outcome.errors.length)outcome.status='failed';outcomes.push(outcome);console.log(outcome.status.toUpperCase()+': '+label);}
}
try{
 browser=await chromium.launch();
 await scenario('ygo-unique-rarity-propagation',{game:'ygo'},ygoFacets);
 await scenario('ygo-printing-history-states',{game:'ygo'},ygoSelection);
 for(const game of GAMES)await scenario(game+'-known-price',{game},app=>knownPrice(app,game));
 await scenario('pokemon-catalogue-symbols',{game:'ptcg'},pokemonSymbols);
 await scenario('pokemon-all-symbols-failed',{game:'ptcg',failSymbols:true},pokemonAllSymbolsFail);
 await scenario('magic-catalogue-unchanged',{game:'mtg'},magicCatalogue);
 await scenario('ygo-reduced-motion',{game:'ygo',reducedMotion:'reduce'},reducedMotion);
}catch(error){failure('runner','initialization',error);}
finally{try{await browser?.close();}catch(error){failure('runner','browser cleanup',error);}try{await server.close();}catch(error){failure('runner','server cleanup',error);}}
await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'card-polish-browser.json'),JSON.stringify({generatedAt:new Date().toISOString(),artEvidence:ART_EVIDENCE,status:failures.length?'failed':'passed',widths:WIDTHS,checks:report,scenarios:outcomes,failures:failures.map(f=>({scenario:f.label,phase:f.phase,stack:f.error.stack}))},null,2));
console.log(`Card polish: ${outcomes.filter(o=>o.status==='passed').length} passed; ${outcomes.filter(o=>o.status==='failed').length} failed. ${failures.length} errors. All independent scenarios attempted.`);
if(failures.length){const aggregate=new AggregateError(failures.map(f=>f.error),'Card-polish hosted browser checks failed');aggregate.stack+='\n\n'+failures.map(f=>f.label+' / '+f.phase+'\n'+f.error.stack).join('\n\n');throw aggregate;}
console.log('PASS: '+report.join('\nPASS: '));
