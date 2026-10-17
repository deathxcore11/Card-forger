// Hosted real-app QA only. Local commands may use --validate-fixtures or --check.
// The guard precedes Playwright import and all server/browser startup.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer,openApp,navigate,closeSheet,noOverflow,capture,inventorySnapshot,isHistoryURL,emptyHistory,EXPECTED,VASM,WIDTHS,RESULTS} from './card-polish-fixtures.mjs';
import {validateFixtures,historyFixture,EDITIONS,PRINTING,staleStorage} from './ygo-history-fixtures.mjs';
import {canRequestExactYgoHistory,readExactYgoHistoryRequest} from '../ygo-history-identity.js';
console.log(await validateFixtures());
if(process.argv.includes('--validate-fixtures'))process.exit(0);
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Exact YGO history browser execution is restricted to the authorized hosted GitHub Actions job. Use --validate-fixtures for local checks.');
const {chromium}=await import('playwright');
const server=await startServer();let browser;const outcomes=[],failures=[];
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
// Match the upstream card-polish readiness and identity-locator repair. No
// visual position or transient ElementHandle is retained across hydration.
async function readyCatalogues(page){
 await page.waitForFunction(()=>{const S=window.__uiTestState,g=S.state.settings.game,shared=S.ui.sets,active=g==='mtg'?shared:window.__uiTestTcg.ui(g).sets;return !shared.busy&&(shared.list.length||shared.error)&&!active.busy&&(active.list.length||active.error);});
 const state=await page.evaluate(()=>{const S=window.__uiTestState,g=S.state.settings.game;return {shared:S.ui.sets.error,active:(g==='mtg'?S.ui.sets:window.__uiTestTcg.ui(g).sets).error};});assert.deepEqual(state,{shared:'',active:''});
}
async function readySet(page,game){
 await readyCatalogues(page);await page.waitForFunction(({game,id})=>{const S=window.__uiTestState,set=game==='mtg'?S.ui.set:window.__uiTestTcg.ui(game).set;return S.state.settings.game===game&&S.ui.view==='set'&&(game==='mtg'?set.code:set.id)===id&&set.loaded&&!set.busy&&!set.detailsBusy&&set.cards.length>0;},{game,id:EXPECTED[game].set});
 assert.equal(await page.evaluate(g=>(g==='mtg'?window.__uiTestState.ui.set:window.__uiTestTcg.ui(g).set).error,game),'');
}
async function openRelease(page,game='ygo'){
 await readyCatalogues(page);await navigate(page,'#set/'+encodeURIComponent(EXPECTED[game].set));await readySet(page,game);
}
async function openCard(page,id=EXPECTED.ygo.multiple,game='ygo'){
 await readySet(page,game);
 const selector=game==='mtg'?await page.evaluate(id=>{const cards=window.__uiTestState.ui.set.cards,i=cards.findIndex(c=>c.id===id);return i<0?null:`[data-set-i="${i}"][data-name=${JSON.stringify(cards[i].name)}]`;},id):`[data-id=${JSON.stringify(id)}][data-set-id=${JSON.stringify(EXPECTED[game].set)}]`;
 assert(selector);const tile=page.locator('#content .set-grid > .grid-card'+selector);await tile.waitFor();assert.equal(await tile.count(),1);assert.equal(await tile.evaluate((n,g)=>g==='mtg'?window.__uiTestState.ui.set.cards[Number(n.dataset.setI)]?.id:n.dataset.id,game),id);await tile.click();
 await page.waitForFunction(({game,id})=>{const ctx=window.__uiTestState.ui.sheetCtx;return document.querySelector('#sheet')?.open&&(game==='mtg'?ctx?.print?.id:ctx?.id)===id&&!!document.querySelector('.card-price-summary');},{game,id});
 assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.setId),EXPECTED[game].set);
 await page.evaluate(()=>{window.__historyBeforeTab={panel:document.querySelector('#card-history'),state:window.__uiTestState.state};});
 await page.locator('#card-tab-prices').click();
 await page.waitForFunction(()=>{const n=document.querySelector('#card-history'),before=window.__historyBeforeTab;return n?.isConnected&&n!==before.panel&&!before.panel.isConnected&&window.__uiTestState.state!==before.state&&document.querySelector('#card-tab-prices')?.getAttribute('aria-selected')==='true';});await frame(page);
}
async function select(page,selector,value){
 const control=page.locator(selector),label=await control.locator('option').evaluateAll((nodes,value)=>nodes.find(n=>n.value===value)?.label,value);assert(label,'An explicit option exists for '+value);
 await control.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();
 await page.waitForFunction(({selector,value})=>{const n=document.querySelector(selector);return n?.isConnected&&n.value===value&&[...n.options].find(o=>o.value===value)?.hasAttribute('selected');},{selector,value});await frame(page);
}
async function state(page,wanted){
 await page.waitForFunction(wanted=>document.querySelector('#card-history')?.dataset.historyState===wanted,wanted);
 if(wanted!=='ready'){assert.equal(await page.locator('#card-history .market-chart').count(),0);assert.equal(await page.locator('#card-history .history-empty').count(),1);assert.equal(await page.locator('#card-history .history-coverage').count(),0);}
 assert.doesNotMatch(await page.locator('#card-history').innerText(),/\$0\.00|\$999|check edition|Card-level reference/);
}
async function pick(page,edition='1st-edition'){
 await select(page,'[data-change="historyEdition"]',PRINTING);await state(page,'edition-required');assert.equal(await page.locator('[data-change="historyYgoEdition"]').inputValue(),'');
 await select(page,'[data-change="historyYgoEdition"]',edition);
}
function historyRequests(app){return app.requests.filter(r=>isHistoryURL(new URL(r.url)));}
function exactSafety(app){
 for(const req of historyRequests(app)){const url=new URL(req.url);assert(['/api/prices/archive','/api/prices/recent'].includes(url.pathname),'No generic Supabase history request');const q=readExactYgoHistoryRequest(url);assert(q&&canRequestExactYgoHistory(q));assert.equal(q.releaseId,VASM.id);assert.equal(q.currency,'USD');}
}
async function assertObservations(page,edition){
 await state(page,'ready');const labels=await page.locator('#card-history .history-identity').innerText();assert.match(labels,new RegExp(EDITIONS[edition].label));
 assert.match(await page.locator('#card-history .history-coverage').innerText(),/2 recorded quotes/);
 assert.match(await page.locator('#card-history .history-coverage').innerText(),new RegExp('Latest \\$'+EDITIONS[edition].values[1]+'\\.00'));
 assert.equal(await page.locator('#card-history .history-values option').count(),2);assert.equal(await page.locator('#card-history .market-chart').count(),1);
 assert.match(await page.locator('#card-price-selection').innerText(),/Current quote unavailable/,'History does not invent a current quote');
 assert.doesNotMatch(await page.locator('.card-price-reference strong').innerText(),/\$/);
}
async function editions(app){
 const {page}=app;await openRelease(page);const before=await inventorySnapshot(page);await openCard(page);await state(page,'printing-required');assert.equal(historyRequests(app).length,0);
 await select(page,'[data-change="historyEdition"]',PRINTING);await state(page,'edition-required');assert.equal(historyRequests(app).length,0);assert.equal(await page.locator('[data-change="historyYgoEdition"]').inputValue(),'');assert.match(await page.locator('#card-price-selection').innerText(),/not every printing has every edition/);
 await page.locator('#card-history [data-act="historyChoosePrinting"]').click();await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-change="historyYgoEdition"]'));
 for(const edition of Object.keys(EDITIONS)){
  await select(page,'[data-change="historyYgoEdition"]',edition);await assertObservations(page,edition);
  const calls=historyRequests(app).filter(r=>new URL(r.url).searchParams.get('selectedEdition')===edition);assert.equal(calls.length,2);for(const req of calls){const q=readExactYgoHistoryRequest(new URL(req.url));assert.equal(q.cardId,EXPECTED.ygo.multiple);assert.equal(q.edition,'VASM-EN001');assert.equal(q.rarity,'Super Rare');}
 }
 for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody','Exact edition/history '+width);await capture(page,'ygo-history-exact-'+width);}
 await page.setViewportSize({width:390,height:1000});await select(page,'[data-change="historyEdition"]','VASM-E001::Ultra Rare');await state(page,'edition-required');assert.equal(await page.locator('[data-change="historyYgoEdition"]').inputValue(),'','Changing printing clears physical edition');assert.equal(historyRequests(app).length,6);
 await select(page,'[data-change="historyEdition"]','');await state(page,'printing-required');assert.equal(historyRequests(app).length,6);assert.equal(await inventorySnapshot(page),before);exactSafety(app);
}
async function unavailable(app,wanted){const {page}=app;await openRelease(page);await openCard(page);await pick(page);await state(page,wanted);assert.equal(historyRequests(app).length,2);assert.equal(await page.locator('#card-history [data-act="historyChoosePrinting"]').count(),0,'An actual provider result is not an unresolved-selection CTA');exactSafety(app);await capture(page,'ygo-history-'+wanted);}
async function cachedOutage(app){
 const {page}=app;await openRelease(page);const before=await inventorySnapshot(page);await openCard(page);await pick(page);await assertObservations(page,'1st-edition');
 await page.waitForFunction(()=>document.querySelector('#card-history')?.dataset.historySourceState==='unavailable');assert.match(await page.locator('#card-history').innerText(),/History refresh is temporarily unavailable. Showing saved observations/);assert.equal(await inventorySnapshot(page),before);exactSafety(app);await capture(page,'ygo-history-saved-outage');
}
async function partialOutage(app,failed){
 const {page}=app;await openRelease(page);await openCard(page);await pick(page);await state(page,'ready');
 await page.waitForFunction(()=>document.querySelector('#card-history')?.dataset.historySourceState==='unavailable');assert.match(await page.locator('#card-history').innerText(),/Some history sources could not refresh/);
 assert.equal(await page.locator('[data-change="marketSource"] option').count(),2,'Both independent sources survive the partial outage');
 await select(page,'[data-change="marketSource"]','Synthetic '+failed+' provider · 1st Edition');
 assert.match(await page.locator('#card-history .history-identity').innerText(),new RegExp('Synthetic '+failed+' provider'));
 assert.match(await page.locator('#card-history .history-coverage').innerText(),new RegExp('Latest \\$'+(failed==='archive'?13:43)+'\\.00'));
 assert.equal(await page.locator('#card-history .history-values option').count(),2,'No dates or prices are merged across providers');exactSafety(app);
}
function deferredReply(){
 const held=[];let delayed=true,started;const pending=new Promise(resolve=>started=resolve);
 return {held,started:pending,reply:async url=>{if(delayed&&url.searchParams.get('selectedEdition')==='1st-edition')await new Promise(resolve=>{held.push(resolve);if(held.length===2)started();});return {body:historyFixture(url)};},release(){delayed=false;for(const resolve of held.splice(0))resolve();}};
}
async function delayed(app,gate,mode){
 const {page}=app;await openRelease(page);await openCard(page);await pick(page);await state(page,'loading');let timer;try{await Promise.race([gate.started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Both exact requests must reach the fixture')),15000);})]);}finally{clearTimeout(timer);}assert.equal(gate.held.length,2,'Both exact routes are outstanding');
 if(mode==='edition'){
  await select(page,'[data-change="historyYgoEdition"]','unlimited');await assertObservations(page,'unlimited');
 }else if(mode==='card'){
  await closeSheet(page);await openCard(page,EXPECTED.ygo.common);await state(page,'edition-required');
 }else await closeSheet(page);
 await page.evaluate(()=>{window.__historyBeforeLate={panel:document.querySelector('#card-history'),active:document.activeElement};});
 gate.release();await page.waitForFunction(async()=>{const {sharedHistory}=await import('/shared-history.js');return [...sharedHistory.values()].some(v=>v.selectedEdition==='1st-edition'&&v.status==='ready');});await frame(page);
 if(mode==='edition'){await assertObservations(page,'unlimited');assert.equal(await page.locator('[data-change="historyYgoEdition"]').inputValue(),'unlimited');}
 else if(mode==='card'){assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.id),EXPECTED.ygo.common);await state(page,'edition-required');}
 else {assert.equal(await page.locator('#sheet').evaluate(n=>n.open),false);assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx),null);}
 assert.equal(await page.evaluate(()=>document.querySelector('#card-history')===window.__historyBeforeLate.panel),true,'Late A response cannot rerender active B or closed sheet');assert.equal(await page.evaluate(()=>document.activeElement===window.__historyBeforeLate.active),true,'Late response cannot steal focus');exactSafety(app);
}
async function legacy(app,game){
 const {page}=app;await openRelease(page,game);await openCard(page,EXPECTED[game].unknown,game);await state(page,'empty');
 const requests=historyRequests(app);assert.equal(requests.length,game==='mtg'?2:3);assert(requests.some(r=>new URL(r.url).pathname==='/functions/v1/market-history'));
 for(const req of requests){const p=new URL(req.url).searchParams;assert.equal(p.get('game'),game);assert.equal(p.get('id'),EXPECTED[game].unknown);assert.equal(p.has('releaseId'),false);assert.equal(p.has('selectedEdition'),false);}
 assert.doesNotMatch(await page.locator('.card-price-reference strong').innerText(),/\$/);assert.equal(await page.locator('[data-change="historyYgoEdition"]').count(),0);
}
function fail(label,phase,error){const e=error instanceof Error?error:new Error(String(error));failures.push({label,phase,error:e});console.error('FAIL '+label+' '+phase+'\n'+e.stack);return {phase,stack:e.stack,diagnostics:e.fixtureDiagnostics||null};}
async function scenario(label,options,run){
 let app;const outcome={scenario:label,status:'passed',errors:[]};
 try{app=await openApp(browser,server.base,{game:'ygo',evidenceLabel:'history-'+label,historyReply:url=>({body:historyFixture(url)}),...options});await run(app);}catch(error){outcome.errors.push(fail(label,app?'assertions':'bootstrap',error));}
 finally{options.release?.();if(app){try{app.health();}catch(error){outcome.errors.push(fail(label,'network/application safety',error));}if(outcome.errors.length)try{await capture(app.page,'ygo-history-failure-'+label);}catch(error){outcome.errors.push(fail(label,'screenshot',error));}outcome.diagnostics=app.diagnostics();try{await app.context.close();}catch(error){outcome.errors.push(fail(label,'cleanup',error));}}if(outcome.errors.length)outcome.status='failed';outcomes.push(outcome);}
}
try{
 browser=await chromium.launch();await scenario('explicit-editions',{},editions);
 for(const game of ['mtg','ptcg'])await scenario(game+'-legacy',{game,historyReply:url=>({body:emptyHistory(url)})},app=>legacy(app,game));
 for(const status of ['unsupported','unavailable','empty'])await scenario(status,{historyReply:url=>({body:historyFixture(url,{status})})},app=>unavailable(app,status));
 for(const [key,value]of [['releaseId','ygo:VASM:2000-01-01:Wrong'],['edition','VASM-E001'],['rarity','Ultra Rare'],['currency','EUR'],['selectedEdition','unlimited']])for(const target of ['echo','seriesPatch'])await scenario('wrong-'+target+'-'+key,{historyReply:url=>({body:historyFixture(url,{[target]:{[key]:value}})})},app=>unavailable(app,'unavailable'));
 await scenario('wrong-subtype',{historyReply:url=>({body:historyFixture(url,{seriesPatch:{subtype:'Normal'}})})},app=>unavailable(app,'unavailable'));
 for(const [name,points]of [['no-points',[]],['zero-value',[{date:'2026-09-13',value:0}]]])await scenario(name,{historyReply:url=>({body:historyFixture(url,{points})})},app=>unavailable(app,'empty'));
 await scenario('cached-outage',{extraStorage:staleStorage(),historyReply:()=>({body:{error:'Synthetic outage'},status:503})},cachedOutage);
 for(const failed of ['archive','recent'])await scenario('partial-'+failed,{extraStorage:staleStorage({both:true}),historyReply:url=>url.pathname.endsWith(failed)?{body:{error:'Synthetic outage'},status:503}:{body:historyFixture(url)}},app=>partialOutage(app,failed));
 await scenario('partial-identity-rejection',{extraStorage:staleStorage({both:true}),historyReply:url=>({body:historyFixture(url,url.pathname.endsWith('recent')?{echo:{releaseId:'wrong'}}:{})})},app=>partialOutage(app,'recent'));
 for(const mode of ['edition','card','cancel']){const gate=deferredReply();await scenario('late-'+mode,{historyReply:gate.reply,release:gate.release},app=>delayed(app,gate,mode));}
}catch(error){fail('runner','initialization',error);}
finally{try{await browser?.close();}catch(error){fail('runner','browser cleanup',error);}try{await server.close();}catch(error){fail('runner','server cleanup',error);}}
await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'ygo-history-browser.json'),JSON.stringify({generatedAt:new Date().toISOString(),evidence:'Mock-only exact history in the real shell. No live/paid provider traffic or writes.',status:failures.length?'failed':'passed',widths:WIDTHS,scenarios:outcomes,failures:failures.map(f=>({scenario:f.label,phase:f.phase,stack:f.error.stack}))},null,2));
console.log(`Exact YGO history: ${outcomes.filter(o=>o.status==='passed').length} passed; ${outcomes.filter(o=>o.status==='failed').length} failed.`);
if(failures.length)throw new AggregateError(failures.map(f=>f.error),'Exact YGO history hosted browser checks failed');
