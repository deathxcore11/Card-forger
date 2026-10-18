// HOSTED ONLY. Actual app Search, scanner review/save and collection scheduler.
// Mocked synthetic quotes do NOT prove a deployed key or paid provider is live.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAMES,MAGIC_PRINTS,RESULTS,validateSearchFixtures,startServer,capture,noOverflow} from './search-fixtures.mjs';
import {EVIDENCE,LP,MP,quote,available,primary,manyLots,validateConditionFixtures,openConditionApp,frames,advance,waitUntil,settle,select,navigate,seedLots,seedReviews,openReview,reviewState,savedLots,protectedState} from './condition-refresh-fixtures.mjs';
const matrix=[
 'All three games: actual Search add forms and scanner review use the same condition endpoint and exact identity fields.',
 'LP initially unavailable, then fresh mocked quote; same-product second capture and changed condition reuse cached response.',
 '>100 synthetic holdings: newly scanned tail saves before delayed quote; changed tail and visible collection get prioritized.',
 'Active collection cursor advances beyond the first100; automatic work stays capped and no all-holdings flood occurs.',
 'At most2 overlapping requests, paced starts, exact-request deduplication, and no paid/provider retries.',
 'Wrong printing, finish, language, edition and currency remain unavailable.',
 'No key, provider outage and rate-limit responses preserve captures and holdings.',
 'Delayed A/B, dismissal, printing, condition, finish and language changes cannot misbind or reopen review.'
];
console.log(await validateSearchFixtures());console.log(await validateConditionFixtures());
if(process.argv.includes('--validate-fixtures')){console.log(JSON.stringify({kind:'hosted-only-synthetic-condition-refresh',matrix,evidence:EVIDENCE},null,2));process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Condition browser tests are hosted-only. Locally use --validate-fixtures; do not start browser/server.');
const {chromium}=await import('playwright');
const outcomes=[],failures=[];let browser,server;
const act=(page,name)=>page.locator(`[data-act="${name}"]`);
const conditionRequests=(app,match=()=>true)=>app.condition.records.filter(r=>match(r.params));
const waitRequest=(app,match=()=>true)=>waitUntil(()=>conditionRequests(app,match).length>0,'Expected actual app condition request');
const waitPrice=(page,price)=>page.waitForFunction(p=>window.__uiTestState.ui.scan.confirm?.price===p,price);
const collectionCore=rows=>rows.map(row=>{const {conditionQuotes,...rest}=row;return rest;});
async function moreControls(page){const details=page.locator('.scan-review-more');if(!await details.evaluate(n=>n.open))await details.locator('summary').click();}
async function condition(page,value){await moreControls(page);await page.locator(`[data-act="scanConfirmCondition"][data-condition="${value}"]`).click();await frames(page);}
async function expectIdentity(row,game){
 assert.equal(row.game,game);assert.equal(row.id,primary(game).id);assert(!Object.hasOwn(row,'condition'),'One source fetch returns all conditions, not one paid request per condition');
 if(game==='mtg')assert.equal(row.finish,'nonfoil');
 if(game==='ptcg')assert.equal(row.variant,'normal');
 if(game==='ygo'){assert.equal(row.printing,'FXX-001');assert.equal(row.rarity,'Ultra Rare');assert.equal(row.edition,'1st-edition');}
}
async function reviewAvailable(app,game){
 const {page}=app,before=collectionCore(await savedLots(page,game)),globalGame=await page.evaluate(()=>window.__uiTestState.state.settings.game);
 await seedReviews(page,game);await openReview(page);await waitRequest(app,p=>p.game===game&&p.id===primary(game).id);
 assert.equal((await reviewState(page)).price,null,'LP is absent before the mocked response, never a Near Mint reference');assert.match(await page.locator('.scan-review-more').innerText(),/Price unavailable/);
 await expectIdentity(conditionRequests(app,p=>p.game===game).at(-1).params,game);assert.equal(conditionRequests(app,p=>p.game===game).at(-1).params.language,'en');app.condition.release();await settle(app);await waitPrice(page,7.25);
 assert.match(await page.locator('.scan-review-more').innerText(),/7\.25/);await noOverflow(page,'.scan-confirm',`${game} condition review 390px`);await capture(page,`synthetic-search-condition-${game}-fresh-lp`);
 const count=app.condition.records.length;await condition(page,MP);assert.equal((await reviewState(page)).price,3.5);await advance(page);assert.equal(app.condition.records.length,count,'Changing only condition reuses all-condition response');
 await act(page,'scanDismiss').click();await openReview(page,1);await waitPrice(page,7.25);assert.equal(app.condition.records.length,count,'A separately serialized second capture reuses cached exact quote');
 assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.game),globalGame,'Mixed-game condition review never changes the global game');assert.deepEqual(collectionCore(await savedLots(page,game)),before,'Viewing/caching quotes never saves another capture');assert.equal(await page.evaluate(()=>window.__conditionReview.ocrCalls),0);
}
async function searchPath(app,game,{recovery=false}={}){
 const {page}=app,name=primary(game).name,query=page.locator(game==='mtg'?'#dbTerm':'[data-input="tQ"]');await query.fill(name);await query.press('Enter');
 await page.waitForFunction(g=>!(g==='mtg'?window.__uiTestState.ui.db:window.__uiTestTcg.ui(g).search).busy,game);if(game==='ptcg')await page.waitForFunction(()=>!window.__uiTestTcg.ui('ptcg').search.detailsBusy);
 const tile=game==='mtg'?page.locator('#content .grid-card').filter({hasText:name}).first():page.locator(`#content .grid-card[data-id="${primary(game).id}"]`);await tile.click();await page.locator('#sheet[open]').waitFor();if(game==='mtg')await page.waitForFunction(()=>!window.__uiTestState.ui.sheetCtx.printsBusy&&Array.isArray(window.__uiTestState.ui.sheetCtx.prints));
 await page.locator(`#sheet [data-act="${game==='mtg'?'own':'tOwn'}"]`).first().click();await page.locator('#conditionPricePreview').waitFor();
 await select(page,game==='mtg'?'#addCondition':'#tCond',LP);
 if(game==='ptcg')await select(page,'#tPrint','normal');
 if(game==='ygo'){await select(page,'#tPrint','FXX-001|Ultra Rare');await select(page,'#tEdition','1st-edition');}
 const exact=p=>p.game===game&&p.id===primary(game).id&&(game!=='ygo'||p.printing==='FXX-001'&&p.edition==='1st-edition')&&(game!=='ptcg'||p.variant==='normal');
 // Editing source dimensions may have queued their prior exact identities. The
 // final one must be reached without bypassing production scheduler pacing.
 for(let i=0;i<6&&!conditionRequests(app,exact).length;i++){app.condition.release();await advance(page);await settle(app);}
 await waitRequest(app,exact);await expectIdentity(conditionRequests(app,exact).at(-1).params,game);app.condition.release();await settle(app);
 if(recovery){
  const preview=page.locator('#conditionPricePreview');
  await preview.getByText('Provider is slowing lookups',{exact:true}).waitFor();
  assert.match(await preview.innerText(),/Synthetic temporary provider limit/,'The exact provider reason survives the scheduler');
  assert.match(await preview.locator('.condition-reference').innerText(),/Reference price/,'A known market price stays visible during an outage');
  assert.match(await preview.innerText(),/excluded from your total/,'A reference is not relabeled as a played-condition quote');
  assert.equal(await page.locator('#lotManualValue').getAttribute('placeholder'),'No market quote — enter value');
  await capture(page,'synthetic-search-condition-reference-paused');
  const before=app.condition.records.length;app.condition.respond(()=>available());
  await act(page,'retryConditionPrice').click();await advance(page);await settle(app);
  await waitUntil(()=>app.condition.records.length===before+1,'One explicit retry rechecks the exact version');
 }
 await page.waitForFunction(()=>/\$7\.25/.test(document.querySelector('#conditionPricePreview')?.textContent||''));const count=app.condition.records.length;
 await select(page,game==='mtg'?'#addCondition':'#tCond',MP);await page.waitForFunction(()=>/\$3\.50/.test(document.querySelector('#conditionPricePreview')?.textContent||''));await advance(page);assert.equal(app.condition.records.length,count);
 const preview=page.locator('#conditionPricePreview'),manual=page.locator('#lotManualValue');
 assert.equal(await preview.locator('.condition-price-amount').innerText(),'$3.50');
 assert.equal(await manual.getAttribute('placeholder'),'Enter custom value (optional)');
 if(game!=='mtg')assert.doesNotMatch((await page.locator('#tPrint option').allTextContents()).join(' '),/\$/,'Printing choices identify versions without competing prices');
 await manual.fill('75.50');await frames(page);
 assert.equal(await preview.locator('.condition-price-amount').innerText(),'$75.50');assert.equal(await preview.locator('.condition-price-kind').innerText(),'Custom');assert.match(await preview.locator('.condition-market-secondary').innerText(),/\$3\.50/);
 for(const width of [320,390,768]){await page.setViewportSize({width,height:950});await frames(page);await noOverflow(page,'#sheet',`${game} custom price ${width}px`);}
 await page.setViewportSize({width:390,height:950});await capture(page,`synthetic-search-condition-${game}-custom-comparison`);
 await manual.fill('');await frames(page);assert.equal(await preview.locator('.condition-price-amount').innerText(),'$3.50');assert.equal(await preview.locator('.condition-market-secondary').count(),0);assert.equal(app.condition.records.length,count,'Typing and clearing a custom value reuses the condition bundle');
 await capture(page,`synthetic-search-condition-${game}-search-parity`);
}
async function savedTail(app){
 const {page}=app;await seedLots(page);const original=await savedLots(page),protectedBefore=await protectedState(page);await seedReviews(page,'mtg');await openReview(page);await waitRequest(app,p=>p.id===primary('mtg').id);
 assert.equal((await reviewState(page)).price,null);await act(page,'scanConfirm').click();await page.waitForFunction(()=>window.__uiTestState.state.collection.length===151&&!window.__uiTestState.ui.scan.confirm);
 const saved=await savedLots(page),tail=saved.at(-1);assert.equal(tail.scanCaptureId,'synthetic-condition-capture-0');assert.equal(tail.printingId,primary('mtg').id);assert.equal(tail.condition,LP);assert.equal(tail.qty,2);assert.equal(app.condition.records[0].settled,false,'Saving completes while price is held');assert.deepEqual(collectionCore(saved.slice(0,150)),collectionCore(original));
 app.condition.release();await settle(app);await page.waitForFunction(()=>window.__uiTestState.state.collection.at(-1).conditionQuotes?.some(q=>q.condition==='Lightly Played'&&q.price===7.25));
 assert.equal(await protectedState(page),protectedBefore);assert.equal(await reviewState(page),null,'Late saved-capture quote does not reopen review');assert.equal(app.condition.records.length,1,'Saving and review share one exact request');
 // Edit that same appended lot through its real Collection Edit action. New
 // finish needs another exact quote, while save remains nonblocking.
 await page.evaluate(name=>{window.__uiTestState.ui.q.coll=name;},tail.name);await navigate(page,'collection');await act(page,'editLot').filter({hasText:'Edit'}).last().click();await select(page,'#addFinish','foil');await select(page,'#addCondition',MP);
 await act(page,'addSave').click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);await advance(page);await waitRequest(app,p=>p.id===tail.printingId&&p.finish==='foil');
 const changed=(await savedLots(page)).find(row=>row.id===tail.id);assert.equal(changed.finish,'foil');assert.equal(changed.condition,MP);assert.equal(changed.qty,2);assert.deepEqual(collectionCore((await savedLots(page)).slice(0,150)),collectionCore(original));
 app.condition.release();await settle(app);await page.waitForFunction(id=>window.__uiTestState.state.collection.find(row=>row.id===id)?.conditionQuotes?.some(q=>q.finish==='foil'&&q.condition==='Moderately Played'&&q.price===3.5),tail.id);
}
async function collectionBounds(app){
 const {page}=app,{lots}=await seedLots(page,{filter:'Synthetic condition lot 149',cursor:'synthetic-lot-099'}),before=collectionCore(await savedLots(page));await navigate(page,'collection');
 for(let i=0;i<10;i++){await advance(page);await settle(app);}
 const records=conditionRequests(app),ids=records.map(row=>row.params.id);assert(records.length>0&&records.length<=8,`Automatic work bounded to8, not150, got ${records.length}`);assert(ids.includes('synthetic-condition-149'),'Filtered visible tail after index100 is prioritized');assert(ids.some(id=>Number(id.split('-').at(-1))>=100&&id!=='synthetic-condition-149'),'Fair active cursor advances past first100 independently of visible tail');
 assert.equal(new Set(records.map(r=>r.url)).size,records.length,'No duplicate exact-version fetch');assert.deepEqual(collectionCore(await savedLots(page)),before);assert.equal((await savedLots(page)).length,lots.length);
 const count=records.length;await page.getByLabel('Search collection',{exact:true}).fill('');await navigate(page,'search');await navigate(page,'collection');for(let i=0;i<3;i++)await advance(page);await settle(app);assert.equal(app.condition.records.length,count,'Renders/navigation do not reset automatic page allowance');
 const cursor=await page.evaluate(()=>localStorage.getItem('cardstashy-condition-cursor:mtg'));assert(cursor&&cursor!=='synthetic-lot-099','Fair progress persists for the next session');
 const gaps=records.slice(1).map((r,i)=>r.startedAt-records[i].startedAt);assert(gaps.every(ms=>ms>=7900),`Endpoint starts remain paced, observed ${gaps}`);await capture(page,'synthetic-search-condition-large-collection-bounded');
}
async function delayedIsolation(app,kind){
 const {page}=app;await seedReviews(page,'mtg',{cards:[primary('mtg'),structuredClone(MAGIC_PRINTS[1])]});await openReview(page);await waitRequest(app);const first=app.condition.records[0],before=collectionCore(await savedLots(page));
 if(kind==='dismiss'){await act(page,'scanDismiss').click();app.condition.release();await settle(app);assert.equal(await reviewState(page),null);assert.equal(await page.locator('.scan-confirm').count(),0);}
 if(kind==='capture'){
  await act(page,'scanDismiss').click();await openReview(page,1);await advance(page);await waitRequest(app,p=>p.id===MAGIC_PRINTS[1].id);const expected=await reviewState(page);assert.equal(expected.price,null);
  app.condition.release(row=>row===first);await waitUntil(()=>first.settled,'A response');await frames(page);assert.deepEqual(await reviewState(page),expected,'A response cannot change B review');app.condition.release();await settle(app);await waitPrice(page,7.25);
 }
 if(kind==='condition'){
  await condition(page,'Damaged');app.condition.respond(()=>available({quotes:[quote()]}));app.condition.release();await settle(app);assert.equal((await reviewState(page)).condition,'Damaged');assert.equal((await reviewState(page)).price,null,'Late LP response is not current Damaged quote');await condition(page,LP);await waitPrice(page,7.25);assert.equal(app.condition.records.length,1);
 }
 if(kind==='finish'||kind==='language'){
  if(kind==='finish')await select(page,'[data-change="scanConfirmFinish"]','foil');else{await moreControls(page);await select(page,'[data-change="scanConfirmLanguage"]','ja');}
  await advance(page);await waitRequest(app,p=>kind==='finish'?p.finish==='foil':p.language==='ja');const expected=await reviewState(page);assert.equal(expected.price,null);app.condition.release(row=>row===first);await waitUntil(()=>first.settled,'Old identity response');await frames(page);assert.deepEqual(await reviewState(page),expected,'Late quote for old finish/language cannot update new selection');
  await act(page,'scanDismiss').click();app.condition.release();await settle(app);assert.equal(await reviewState(page),null,'New identity late response also stays dismissed');
 }
 if(kind==='printing'){
  await act(page,'scanChangePrinting').click();await page.locator('[data-act="printingPickerView"][data-id="grid"]').click();await page.locator('.printing-picker-results[aria-busy="false"]').waitFor();const selected=await page.locator('.printing-picker-choice').evaluateAll((nodes,id)=>nodes.map(node=>({...node.dataset})).find(row=>row.cardId===id&&JSON.parse(row.key)[5]==='foil'),MAGIC_PRINTS[1].id);assert(selected,'Existing picker exposes exact second printing foil row');await page.locator(`.printing-picker-choice[data-key=${JSON.stringify(selected.key)}]`).click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);await advance(page);await waitRequest(app,p=>p.id===MAGIC_PRINTS[1].id);const expected=await reviewState(page);assert.equal(expected.cardId,MAGIC_PRINTS[1].id);app.condition.release(row=>row===first);await waitUntil(()=>first.settled,'Old printing response');await frames(page);assert.deepEqual(await reviewState(page),expected);app.condition.release();await settle(app);
 }
 assert.deepEqual(collectionCore(await savedLots(page)),before);assert.equal(await page.evaluate(()=>window.__conditionReview.ocrCalls),0);
}
async function unavailable(app,status){
 const {page}=app;await seedReviews(page,'mtg');const before=await page.evaluate(()=>window.__conditionReview.batch.loadBatch());await openReview(page);await waitRequest(app);await settle(app);assert.equal((await reviewState(page)).price,null);assert.match(await page.locator('.scan-review-more').innerText(),/Price unavailable/);
 await condition(page,MP);await act(page,'scanDismiss').click();await openReview(page,1);await advance(page);assert.equal(app.condition.records.length,1,'Missing key/provider/rate-limit is not retried for another capture or condition');assert.equal((await reviewState(page)).price,null);
 const after=await page.evaluate(()=>window.__conditionReview.batch.loadBatch());assert.equal(after.length,2);assert.equal(after[0].originalShot,before[0].originalShot);assert.equal(after[1].originalShot,before[1].originalShot);assert.equal(after[0].captureRevision,before[0].captureRevision);
 // The terminal provider outcome never blocks an explicit save of an otherwise
 // reviewed printing. It remains honestly unpriced in collection.
 await act(page,'scanConfirm').click();await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);const lot=(await savedLots(page)).find(x=>x.scanCaptureId==='synthetic-condition-capture-1');assert(lot);assert.equal(lot.condition,LP);assert(!lot.conditionQuotes?.length);await capture(page,`synthetic-search-condition-${status}-saved-unpriced`);
}
async function invalidQuotes(app,field){
 const {page}=app;await seedReviews(page,'mtg');await openReview(page);await waitRequest(app);await settle(app);assert.equal((await reviewState(page)).price,null,`A conflicting ${field} quote cannot be relabeled to match current identity`);assert.match(await page.locator('.scan-review-more').innerText(),/Price unavailable/);
}
function record(label,phase,error){failures.push({label,phase,error});return {phase,stack:error.stack};}
async function run(label,game,fn,options={}){
 let app;const result={scenario:label,game,status:'passed',errors:[]};
 try{app=await openConditionApp(browser,server.base,{game,label,...options});await fn(app);}catch(error){result.errors.push(record(label,app?'assertions':'bootstrap',error));}
 finally{if(app){app.condition.release();app.releaseAll();try{await settle(app);app.condition.health();app.health();}catch(error){result.errors.push(record(label,'safety',error));}if(result.errors.length)try{await capture(app.page,`synthetic-search-condition-failure-${label}`,{settle:false});}catch(error){result.errors.push(record(label,'screenshot',error));}result.conditionRequests=app.condition.records;result.maxConditionConcurrency=app.condition.maxActive;result.diagnostics=app.diagnostics();try{await app.context.close();}catch(error){result.errors.push(record(label,'cleanup',error));}}if(result.errors.length)result.status='failed';outcomes.push(result);console.log(`${result.status.toUpperCase()}: ${label}`);}
}
try{
 server=await startServer();browser=await chromium.launch();
 for(const game of GAMES){await run(`${game}-review-fresh-cached`,game,app=>reviewAvailable(app,game),{hold:true,...(game==='ptcg'?{game:'mtg'}:{})});await run(`${game}-search-path`,game,app=>searchPath(app,game),{hold:false});}
 await run('mtg-paused-reference-retry','mtg',app=>searchPath(app,'mtg',{recovery:true}),{response:()=>({status:'rate_limited',reason:'provider_rate',notice:'Synthetic temporary provider limit',retryAfterMs:60000,quotes:[]})});
 await run('mtg-save-change-tail','mtg',savedTail,{hold:true});await run('mtg-visible-fair-bounds','mtg',collectionBounds);
 for(const kind of ['capture','dismiss','condition','finish','language','printing'])await run(`mtg-late-${kind}`,'mtg',app=>delayedIsolation(app,kind),{hold:true});
 for(const status of ['not-configured','unavailable','rate-limited'])await run(`mtg-${status}`,'mtg',app=>unavailable(app,status),{response:()=>({status:status.replaceAll('-','_'),quotes:[],...(status==='rate-limited'?{httpStatus:429}:{})})});
 for(const [field,value]of Object.entries({printingId:'wrong-printing',finish:'foil',language:'ja',edition:'1st-edition',currency:'EUR'}))await run(`mtg-reject-${field.toLowerCase()}`,'mtg',app=>invalidQuotes(app,field),{response:()=>available({quotes:[quote(LP,999,{[field]:value})]})});
}catch(error){record('runner','setup',error);}
finally{try{await browser?.close();}catch(error){record('runner','browser cleanup',error);}try{await server?.close();}catch(error){record('runner','server cleanup',error);}}
await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'condition-refresh-browser.json'),JSON.stringify({generatedAt:new Date().toISOString(),kind:'synthetic-hosted-condition-refresh',evidence:EVIDENCE,matrix,outcomes,status:failures.length?'failed':'passed',failures:failures.map(({label,phase,error})=>({label,phase,stack:error.stack}))},null,2));
if(failures.length){const error=new AggregateError(failures.map(f=>f.error),`${failures.length} condition-refresh hosted regression error(s)`);error.stack+='\n'+failures.map(f=>`${f.label}/${f.phase}: ${f.error.stack}`).join('\n');throw error;}
