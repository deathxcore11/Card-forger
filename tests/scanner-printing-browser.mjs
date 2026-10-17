// HOSTED ONLY. Real app scanner review -> existing printing picker -> review.
// Every queued card, camera pixel, catalogue response and screenshot is synthetic.
// This checks UI/lifecycle/identity, not OCR or physical-camera recognition.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAMES,CARDS,PRINT_IDS,MAGIC_PRINTS,POKEMON_PRINTS,UNIQUE,RESULTS,validateSearchFixtures,startServer,openSearchApp,inventorySnapshot,noOverflow,capture} from './search-fixtures.mjs';

const matrix=['All three review games use the existing same-name printing picker without switching the global game','Cancel leaves capture/original/quantity/condition/language/location unchanged','Exact selected card/release/variant/edition remains review-only, not fabricated OCR evidence','Finish-unconfirmed Pokémon selection stays incomplete','Late cancelled Magic response cannot mutate another capture','Live synthetic camera returns without duplicate capture or collection write'];
console.log(await validateSearchFixtures());
if(process.argv.includes('--validate-fixtures')){
  for(const game of GAMES)assert(CARDS[game].find(card=>card.id===PRINT_IDS[game]));
  assert.equal(CARDS.ptcg.find(card=>card.id===POKEMON_PRINTS[1].id).variants[0].key,'firstEdition');
  assert(UNIQUE.id);assert.equal(MAGIC_PRINTS[0].oracle_id,MAGIC_PRINTS[1].oracle_id);
  console.log(JSON.stringify({kind:'hosted-only-synthetic-scanner-printing-review',matrix,limitations:['No real OCR or photographed-card accuracy claim.','No local browser, provider request, screenshot or server started.','No private/user photographs.']},null,2));
  process.exit(0);
}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted-only scanner printing QA. Use --validate-fixtures locally; never launch a local browser.');
const {chromium}=await import('playwright');
const outcomes=[],failures=[];
let browser,server;
const act=(page,name)=>page.locator(`[data-act="${name}"]`);
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const bounded=async(promise,label,timeout=30000)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(`${label} timed out`)),timeout))]);}finally{clearTimeout(timer);}};
const queue=page=>page.evaluate(()=>window.__scannerReviewTest.batch.loadBatch());
const metadata=row=>Object.fromEntries(['id','captureRevision','originalShot','shot','game','selectedGame','at','qty','condition','lang','location','read'].map(field=>[field,row[field]]));
const ready=async page=>{await page.locator('.printing-picker').waitFor();await page.locator('.printing-picker-results[aria-busy="false"]').waitFor();await frame(page);};
async function select(page,selector,value){
  const control=page.locator(selector),label=await control.locator('option').evaluateAll((nodes,v)=>nodes.find(node=>node.value===v)?.label,value);
  assert(label,`A real ${selector} option exists for ${value}`);await control.click();
  await page.locator('.glass-select-menu[open]').getByRole('option',{name:label,exact:true}).click();await frame(page);
}
async function seed(app,game){
  const card=CARDS[game].find(c=>c.id===PRINT_IDS[game]);
  await app.page.evaluate(async({game,card})=>{
    const batch=await import('/scan-batch.js'),prefs=await import('/scansession.js'),S=window.__uiTestState;
    const canvas=document.createElement('canvas');canvas.width=240;canvas.height=336;const x=canvas.getContext('2d');
    x.fillStyle='#214057';x.fillRect(0,0,240,336);x.fillStyle='#fff';x.font='14px sans-serif';x.fillText('SYNTHETIC REVIEW FIXTURE',10,40);x.fillText('NOT A REAL CARD PHOTO',10,310);
    const shot=canvas.toDataURL('image/png');
    const candidate={id:card.id,name:card.name,game,card,exact:false,sub:'Synthetic queued candidate'};
    const entry={id:'synthetic-capture-A',captureRevision:'synthetic-revision-A',game,selectedGame:'mtg',at:123,originalShot:shot,shot,status:'review',qty:3,condition:'Lightly Played',lang:'ja',location:'Synthetic binder',read:{name:card.name,code:'Unreadable synthetic code'},cands:[candidate],selectedIndex:0,finish:''};
    batch.saveBatch([entry,{...entry,id:'synthetic-capture-B',captureRevision:'synthetic-revision-B',qty:2}]);
    prefs.savePrefs('mtg',{sounds:false,haptics:false});prefs.savePrefs(game,{sounds:false,haptics:false});
    // The blank synthetic stream is never captured; production capture/review
    // handlers remain intact. OCR warmup is stubbed and recognition must not run.
    const h=window.__scannerReviewTest={batch,ocrCalls:0};
    window.Tesseract={createWorker:async()=>({setParameters:async()=>{},terminate:async()=>{},recognize:async()=>{h.ocrCalls++;throw Error('No capture/OCR is expected in printing-review UI tests.');}})};
    navigator.mediaDevices.getUserMedia=async()=>{
      const camera=document.createElement('canvas');camera.width=320;camera.height=480;const context=camera.getContext('2d');let tick=0;
      h.timer=setInterval(()=>{context.fillStyle=tick++%2?'#565656':'#575757';context.fillRect(0,0,320,480);},50);
      context.fillStyle='#565656';context.fillRect(0,0,320,480);return h.stream=camera.captureStream(20);
    };
    S.ui.scan.auto=false;
  },{game,card});
  await app.page.locator('[data-act="go"][data-to="#scan"]:visible').first().click();
  await app.page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
  await app.page.evaluate(()=>{window.__uiTestState.ui.scan.auto=false;});
  await app.page.getByRole('button',{name:'Start camera',exact:true}).click();
  await app.page.waitForFunction(()=>document.querySelector('#scanVideo')?.videoWidth===320);
  await app.page.locator('.scan-batch-thumb[data-id="synthetic-capture-A"]').click();
  await app.page.locator('.scan-confirm').waitFor();return queue(app.page);
}
async function openPicker(page){await act(page,'scanChangePrinting').click();await ready(page);}
async function choose(page,game){
  const rows=await page.locator('.printing-picker-choice').evaluateAll(nodes=>nodes.map(node=>({...node.dataset,disabled:node.disabled})));
  const row=rows.find(row=>!row.disabled&&(game==='mtg'?row.cardId===MAGIC_PRINTS[1].id&&JSON.parse(row.key)[5]==='foil':game==='ptcg'?row.cardId===PRINT_IDS.ptcg&&row.variant==='holofoil':row.releaseId===UNIQUE.id&&row.edition==='1st-edition'));
  assert(row,`${game} exact source-backed row is selectable`);
  await page.locator(`.printing-picker-choice[data-key=${JSON.stringify(row.key)}]`).click();
  await page.waitForFunction(()=>!document.querySelector('#sheet')?.open);await frame(page);return row;
}
async function reviewScenario(app,game){
  const {page}=app,initial=await seed(app,game),beforeState=await inventorySnapshot(page);
  await openPicker(page);assert.equal(await page.locator('.printing-picker').getAttribute('data-game'),game);
  assert.match(await page.locator('.printing-picker').innerText(),/Nothing (?:is )?added automatically/);
  await noOverflow(page,'#sheetBody',`${game} scanner printing picker 390px`);
  assert.equal(await page.locator(game==='ygo'?'#printingPickerEdition':'#printingPickerFinish').count(),1);
  assert.equal(await page.locator(game==='ygo'?'#printingPickerFinish':'#printingPickerEdition').count(),0);
  await select(page,'#printingPickerSort','number');await act(page,'printingPickerView').filter({hasText:'List'}).click();
  await capture(page,`synthetic-search-scanner-${game}-printing-picker`);
  await act(page,'printingPickerCancel').click();await page.waitForFunction(()=>!document.querySelector('#sheet')?.open);
  assert.deepEqual(await queue(page),initial,'Cancel changes no queued capture bytes');
  assert.equal(await page.evaluate(()=>window.__uiTestState.ui.scan.confirm.batchId),'synthetic-capture-A');
  await openPicker(page);const selected=await choose(page,game),after=await queue(page),row=after[0],chosen=row.cands[0];
  assert.deepEqual(metadata(row),metadata(initial[0]));assert.deepEqual(after[1],initial[1]);
  assert.equal(chosen.id,selected.cardId);assert.equal(chosen.exact,false);assert.equal(chosen.printingConfirmed,true);assert.equal(row.status,'review');
  assert.equal(chosen.printingSelection.releaseId,selected.releaseId);assert.equal(chosen.printingSelection.variantKey,selected.variant);assert.equal(chosen.printingSelection.edition,selected.edition);
  assert.equal(row.finish,game==='ygo'?'1st-edition':game==='ptcg'?'holofoil':'foil');
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.game),'mtg','mixed-game review never switches the global game');
  assert.equal(await inventorySnapshot(page),beforeState,'Selecting never writes collection');
  await noOverflow(page,'.scan-confirm',`${game} compact review 390px`);await capture(page,`synthetic-search-scanner-${game}-selected-review`);
  await act(page,'scanDismiss').click();await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);
  assert.equal((await queue(page)).length,2);assert.equal(await inventorySnapshot(page),beforeState);
  const playing=await page.locator('#scanVideo').evaluate(video=>({same:video.srcObject===window.__scannerReviewTest.stream,paused:video.paused,time:video.currentTime}));
  assert.equal(playing.same,true);assert.equal(playing.paused,false);await page.waitForTimeout(150);
  assert(await page.locator('#scanVideo').evaluate((video,time)=>video.currentTime>time,playing.time),'Same synthetic camera keeps playing');
  assert.equal(await page.evaluate(()=>window.__scannerReviewTest.ocrCalls),0,'Review does not generate another capture or OCR');
  assert.deepEqual((await queue(page)).map(row=>row.id),initial.map(row=>row.id));
  if(game==='ptcg'){
    await page.locator('.scan-batch-thumb[data-id="synthetic-capture-A"]').click();await openPicker(page);
    await page.locator(`.printing-picker-choice[data-card-id="${POKEMON_PRINTS[1].id}"][data-variant="firstEdition"]`).click();
    await page.waitForFunction(()=>!document.querySelector('#sheet')?.open);
    const coarse=(await queue(page))[0];assert.equal(coarse.finish,'');assert.equal(coarse.cands[0].printingSelection.variantKey,'firstEdition');
    assert.equal(await act(page,'scanConfirm').isEnabled(),false,'Edition-only source metadata cannot auto-ready or enable saving an assumed finish');
  }
  if(game==='ygo'){
    await page.locator('.scan-batch-thumb[data-id="synthetic-capture-A"]').click();await openPicker(page);
    const unknown=page.locator('.printing-picker-choice[data-edition=""][data-printing="LOB-001::Rare"]').first();
    const identity=await unknown.evaluate(node=>({...node.dataset}));await unknown.click();
    await page.waitForFunction(()=>!document.querySelector('#sheet')?.open);
    const pending=(await queue(page))[0];assert.equal(pending.cands[0].setReleaseId,identity.releaseId);assert.equal(pending.cands[0].print,'LOB-001|Rare');
    assert.equal(pending.finish,'');assert.equal(pending.cands[0].finishUnconfirmed,true);assert.equal(await act(page,'scanConfirm').isEnabled(),false,'A verified release does not imply Unlimited edition');
    await select(page,'[data-change="scanConfirmFinish"]','unlimited');
    assert.equal((await queue(page))[0].finish,'unlimited');assert.equal(await act(page,'scanConfirm').isEnabled(),true,'Only an explicit edition choice enables the final save');
    assert.equal(await inventorySnapshot(page),beforeState,'Choosing an edition still does not save automatically');
  }
}
async function lateCancelledScenario(app){
  const {page}=app,initial=await seed(app,'mtg'),match=url=>url.hostname==='api.scryfall.com'&&url.searchParams.get('q')?.includes('shared-fixture-oracle'),gate=app.hold(match);
  try{
    await act(page,'scanChangePrinting').click();await bounded(gate.seen,'Held printing page');
    await act(page,'printingPickerCancel').click();await page.waitForFunction(()=>!document.querySelector('#sheet')?.open);
    await act(page,'scanDismiss').click();await page.locator('.scan-batch-thumb[data-id="synthetic-capture-B"]').click();
    const before=await queue(page);gate.release();
    await bounded((async()=>{while(app.requests.some(row=>match(new URL(row.url))&&!row.settled))await new Promise(r=>setTimeout(r,10));})(),'Released/cancelled printing response');await frame(page);
    assert.deepEqual(await queue(page),before);assert.equal(before[0].originalShot,initial[0].originalShot);
    assert.equal(await page.evaluate(()=>window.__uiTestState.ui.scan.confirm.batchId),'synthetic-capture-B');
    assert.equal(await page.locator('.printing-picker').count(),0,'Late A lookup cannot reopen over B');
  }finally{gate.release();}
}
function record(label,phase,error){failures.push({label,phase,error});return {phase,stack:error.stack};}
async function run(label,game,fn){
  let app,before;const result={scenario:label,game,status:'passed',errors:[]};
  try{app=await openSearchApp(browser,server.base,{game:'mtg',width:390,height:920,evidenceLabel:label});before=await inventorySnapshot(app.page);await bounded(fn(app),label,60000);}
  catch(error){result.errors.push(record(label,app?'assertions':'bootstrap',error));}
  finally{
    if(app){
      try{assert.equal(await inventorySnapshot(app.page),before);assert.deepEqual(await app.page.evaluate(()=>window.__fixtureSensitiveWrites),[]);app.health();}catch(error){result.errors.push(record(label,'safety',error));}
      if(result.errors.length)try{await capture(app.page,`synthetic-search-scanner-failure-${label}`,{settle:false});}catch(error){result.errors.push(record(label,'screenshot',error));}
      result.diagnostics=app.diagnostics();app.releaseAll();try{await app.context.close();}catch(error){result.errors.push(record(label,'cleanup',error));}
    }
    if(result.errors.length)result.status='failed';outcomes.push(result);console.log(`${result.status.toUpperCase()}: ${label}`);
  }
}
try{
  server=await startServer();browser=await chromium.launch();
  for(const game of GAMES)await run(`${game}-scanner-printing-review`,game,app=>reviewScenario(app,game));
  await run('mtg-cancelled-a-to-b','mtg',lateCancelledScenario);
}catch(error){record('runner','setup',error);}
finally{try{await browser?.close();}catch(error){record('runner','browser cleanup',error);}try{await server?.close();}catch(error){record('runner','server cleanup',error);}}
await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'scanner-printing-browser.json'),JSON.stringify({kind:'synthetic-scanner-printing-review',matrix,outcomes,status:failures.length?'failed':'passed',limitations:['No physical-camera or OCR-accuracy claim.','All card data, images, camera pixels and collection fixtures are synthetic.'],failures:failures.map(({label,phase,error})=>({label,phase,stack:error.stack}))},null,2));
if(failures.length){const error=new AggregateError(failures.map(f=>f.error),`${failures.length} scanner-printing UI regression error(s)`);error.stack+='\n'+failures.map(f=>`${f.label}/${f.phase}: ${f.error.stack}`).join('\n');throw error;}
