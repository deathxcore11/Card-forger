import {openCapturedCard} from './scanner-review-controls.mjs';
// HOSTED ONLY. Real app scanner review -> existing printing picker -> review.
// Every queued card, camera pixel, catalogue response and screenshot is synthetic.
// This checks UI/lifecycle/identity, not OCR or physical-camera recognition.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAMES,CARDS,PRINT_IDS,MAGIC_PRINTS,POKEMON_PRINTS,UNIQUE,RESULTS,validateSearchFixtures,startServer,openSearchApp,inventorySnapshot,noOverflow,capture} from './search-fixtures.mjs';

// Public identity tokens, synthetic metadata/art only. This pack is compiled for
// evidence checks, never installed, so the manual UI must use the real cold-pack
// createScannerLookup -> tcg.scanMatch -> exact-code adapter path.
const YGO_CODE_FIXTURE={schema:1,game:'ygo',rows:[
  ['42566602','Coral Dragon','LEHD-ENB38','Ultra Rare','Legendary Hero Decks','Synchro Tuner Effect Monster'],
  ['89631139','Blue-Eyes White Dragon','LOB-EN001','Ultra Rare','Legend of Blue Eyes White Dragon','Normal Monster']
]};
// The same pure production boundary is exercised by Node fixture validation and
// hosted Chromium. No Tesseract/OCR accuracy is implied by injecting these reads.
async function ygoCodeGuardSnapshot(raw){
  const {ygoCodeReadings}=await import('../scan.js'),{compileCatalog,lookupCatalog}=await import('../scan-catalog.js');
  const {scannerNumberParts}=await import('../scanner-lookup.js'),{scanIdentifierEvidence}=await import('../scan-signals.js');
  const {textVerifiedMatch}=await import('../scancam.js'),{resolvedEntry}=await import('../scan-batch.js');
  const pack=compileCatalog(raw);
  return ['LEHD-ENB38','LOB-EN0O1','38','B38'].map(code=>{
    const read={name:code==='LOB-EN0O1'?'Blue-Eyes White Dragon':'Coral Dragon',code},cands=lookupCatalog(pack,read).cands;
    return {code,read,readings:ygoCodeReadings(code),parts:scannerNumberParts('ygo',code),evidence:scanIdentifierEvidence('ygo',read),
      forcedVerified:cands.map(c=>textVerifiedMatch('ygo',{...c,exact:true},read)),
      entry:resolvedEntry({id:'synthetic-code-'+code,qty:3},'ygo',cands,read,c=>textVerifiedMatch('ygo',c,read),{finish:'unlimited',finishConfirmed:true})};
  });
}
function assertYgoCodeGuards(rows){
  assert.deepEqual(rows.map(x=>x.code),['LEHD-ENB38','LOB-EN0O1','38','B38']);
  const [literal,corrected,...suffixes]=rows;
  assert.equal(literal.entry.cands.length,1);assert.equal(literal.entry.cands[0].name,'Coral Dragon');assert.equal(literal.entry.cands[0].id,'42566602');assert.equal(literal.entry.cands[0].print,'LEHD-ENB38|Ultra Rare');
  assert.deepEqual(literal.forcedVerified,[true]);assert.equal(literal.entry.status,'ready');
  assert.deepEqual(corrected.readings,[{raw:'LOB-EN0O1',code:'LOB-EN001',corrected:true}]);assert.equal(corrected.evidence.identifierUncertain,true);assert.equal(corrected.entry.cands[0].print,'LOB-EN001|Ultra Rare');
  for(const row of [corrected,...suffixes]){
    assert(row.entry.cands.length,`${row.code} retains review candidates`);assert(row.entry.cands.every(c=>c.exact===false),`${row.code} is not exact`);
    assert(row.forcedVerified.every(value=>value===false),`${row.code} cannot verify even with an adversarial exact flag`);
    assert.equal(row.entry.read.code,row.code);assert.equal(row.entry.status,'review');assert.equal(row.entry.printingVerified,false);assert.equal(row.entry.finish,'');
  }
  for(const row of suffixes){assert.equal(row.parts,null);assert.deepEqual(row.evidence.observations,[]);}
}
const matrix=['All three games use an inline printing carousel, set/number/rarity filters and branded AI help without switching the global game','Inline selection leaves capture/original/quantity/condition/language/location unchanged','Exact selected card/release/variant/edition remains review-only, not fabricated OCR evidence','320/390/768px inline art and controls fit without overflow','Late AI response cannot mutate another capture','Live synthetic camera returns without duplicate capture or collection write','Production manual full-code UI lookup resolves LEHD-ENB38 to Coral Dragon without replacing the lookup adapter','Corrected LOB-EN0O1 and suffix-only 38/B38 retain raw evidence and remain review-only; suffix manual lookup is rejected'];
console.log(await validateSearchFixtures());
assertYgoCodeGuards(await ygoCodeGuardSnapshot(YGO_CODE_FIXTURE));
if(process.argv.includes('--validate-fixtures')){
  for(const game of GAMES)assert(CARDS[game].find(card=>card.id===PRINT_IDS[game]));
  assert.equal(CARDS.ptcg.find(card=>card.id===POKEMON_PRINTS[1].id).variants[0].key,'firstEdition');
  assert(UNIQUE.id);assert.equal(MAGIC_PRINTS[0].oracle_id,MAGIC_PRINTS[1].oracle_id);
  console.log(JSON.stringify({kind:'hosted-only-synthetic-scanner-printing-review',matrix,limitations:['No real OCR or photographed-card accuracy claim.','No local browser, provider request, screenshot or server started.','No private/user photographs.','Manual UI and browser persistence assertions require hosted CI; local validation checks production parser/evidence/queue guards only.','Public catalogue identity metadata and exact-code HTTP responses are synthetic fixtures; the production manual lookup adapter is not replaced.']},null,2));
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
const ready=async page=>{await page.locator('.printing-picker').waitFor();if(await page.locator('.printing-picker-modern').count())await page.locator('[data-act="printingPickerView"][data-id="grid"]').click();await page.locator('.printing-picker-results[aria-busy="false"]').waitFor();await frame(page);};
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
  if(game==='mtg')for(const viewport of [{width:320,height:568},{width:390,height:844}]){
    await app.page.setViewportSize(viewport);await frame(app.page);
    // Judge settled layout rather than the first two frames of page entrance.
    // No scrolling, forced click, hidden overlay or changed production styles.
    await app.page.evaluate(()=>document.fonts.ready);
    await app.page.waitForFunction(()=>!document.querySelector('#content').getAnimations({subtree:true}).some(a=>a.animationName==='page-in'&&a.playState==='running'),null,{timeout:2000});
    const reach=await app.page.getByRole('button',{name:'Start camera',exact:true}).evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,height:innerHeight,hit:hit?.tagName+'.'+hit?.className,reachable:r.top>=0&&r.bottom<=innerHeight&&(hit===n||n.contains(hit))};});
    assert(reach.reachable,'Start camera remains reachable on the compact idle screen: '+JSON.stringify(reach));
    await capture(app.page,`synthetic-search-scanner-idle-${viewport.width}`);
    if(viewport.width===320){
      await app.page.evaluate(()=>{window.__scannerReviewTest.media=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Synthetic permission denial','NotAllowedError');};});
      await app.page.getByRole('button',{name:'Start camera',exact:true}).click();
      await app.page.locator('#scanStatus').filter({hasText:'Camera permission was declined'}).waitFor();
      const disjoint=await app.page.evaluate(()=>{const a=document.querySelector('.scan-go').getBoundingClientRect(),b=document.querySelector('#scanStatus').getBoundingClientRect();return a.bottom<=b.top&&b.bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top;});
      assert(disjoint,'Permission guidance stays below the start button and above navigation');
      await capture(app.page,'synthetic-search-scanner-permission-320');
      await app.page.evaluate(()=>{navigator.mediaDevices.getUserMedia=window.__scannerReviewTest.media;});
    }

  }
  await app.page.getByRole('button',{name:'Start camera',exact:true}).click();
  await app.page.waitForFunction(()=>document.querySelector('#scanVideo')?.videoWidth===320);
  if(game==='mtg'){
    for(const viewport of [{width:320,height:568},{width:390,height:844},{width:673,height:840},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900},{width:844,height:390}]){
      await app.page.setViewportSize(viewport);await frame(app.page);
      const layout=await app.page.evaluate(()=>{
        const box=n=>n.getBoundingClientRect(),camera=box(document.querySelector('.cam-wrap')),header=box(document.querySelector('.topbar')),nav=document.querySelector('.bottom-nav'),bottom=getComputedStyle(nav).display==='none'?innerHeight:box(nav).top,pile=box(document.querySelector('.scan-pile'));
        const hit=n=>{const r=box(n),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return target===n||n.contains(target);};
        return {cameraHeight:camera.height,available:bottom-header.bottom,cameraTop:camera.top,headerBottom:header.bottom,cameraBottom:camera.bottom,bottom,pileBottom:pile.bottom,pileRight:pile.right,width:innerWidth,clear:[...document.querySelectorAll('.scan-pile,#scanCaptureBtn,.scan-toolbar button,.cam-rail button')].every(hit),overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert(layout.cameraHeight>=layout.available*.95,'The camera fills the usable shell: '+JSON.stringify(layout));
      assert(layout.cameraTop>=layout.headerBottom-1&&layout.cameraBottom<=layout.bottom+1,'Header and navigation remain visible');
      assert(layout.pileBottom<=layout.bottom&&layout.pileRight>layout.width*.8,'Capture pile stays at the lower right');
      assert(layout.clear&&!layout.overflow,'Camera controls stay physically reachable without horizontal overflow: '+JSON.stringify(layout));
      assert.equal((await queue(app.page)).length,2,'Resizing retains both captures');
      await capture(app.page,`synthetic-search-scanner-camera-${viewport.width}`);
    }
    await app.page.setViewportSize({width:390,height:844});await frame(app.page);
  }
  await openCapturedCard(app.page,'synthetic-capture-A');
  await app.page.locator('.scan-confirm').waitFor();return queue(app.page);
}
async function readyInline(page){
  await page.locator('.scan-inline-printings .printing-carousel[aria-busy="false"]').waitFor();await frame(page);
  assert.equal(await page.locator('#sheet[open]').count(),0,'Printing review stays in the original scanner panel');
}
async function reviewScenario(app,game){
  const {page}=app,initial=await seed(app,game),beforeState=await inventorySnapshot(page);await readyInline(page);
  assert.equal(await page.locator('#scanMatchNumber').count(),1);
  assert.equal(await page.getByRole('button',{name:'Identify with AI',exact:true}).count(),1);
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:920});await frame(page);await noOverflow(page,'.scan-confirm',`${game} inline ${width}`);
    const art=await page.locator('.scan-inline-printings .printing-slide.is-current .printing-slide-art').boundingBox();assert(art.height>=180&&art.width>140,'Art is the main preview');
    await capture(page,`synthetic-search-scanner-${game}-inline-${width}`);
  }
  await page.setViewportSize({width:390,height:920});
  const choices=await page.locator('[data-change="scanBrowseFilter"][data-field="set"] option').evaluateAll(nodes=>nodes.map(n=>({value:n.value,label:n.label})));
  const wanted=game==='mtg'?MAGIC_PRINTS[1].set:game==='ptcg'?CARDS.ptcg.find(c=>c.id===PRINT_IDS.ptcg).set.id:UNIQUE.id;
  assert(choices.some(x=>x.value===wanted),`${game} exact set is available`);
  await select(page,'[data-change="scanBrowseFilter"][data-field="set"]',wanted);
  const state=await page.evaluate(()=>{const b=window.__uiTestState.ui.scan.confirm.inline;return b.rows.filter(r=>r.releaseId===b.filters.set).map(r=>({key:r.key,cardId:r.cardId,finish:r.finish,variant:r.variantKey,edition:r.edition,releaseId:r.releaseId,selectable:r.selectable}));});
  const row=state.find(r=>r.selectable&&(game==='mtg'?r.cardId===MAGIC_PRINTS[1].id&&r.finish==='foil':game==='ptcg'?r.cardId===PRINT_IDS.ptcg&&r.variant==='holofoil':r.edition==='1st-edition'));
  assert(row,`${game} exact printing exists`);
  const groups=await page.evaluate(()=>{const q=window.__uiTestState.ui.scan.confirm;return q.inline.rows.filter(r=>r.releaseId===q.inline.filters.set).map(r=>({key:r.key,number:r.number,total:r.total,rarity:r.rarity}));});
  const details=groups.find(r=>r.key===row.key);
  await select(page,'[data-change="scanBrowseFilter"][data-field="number"]',details.number+(details.total?'/'+details.total:''));
  if(details.rarity)await select(page,'[data-change="scanBrowseFilter"][data-field="rarity"]',details.rarity);
  const variant=page.locator('.scan-inline-printings .printing-slide.is-current [data-change="scanBrowseVariant"]');
  if(await variant.count())await select(page,'.scan-inline-printings .printing-slide.is-current [data-change="scanBrowseVariant"]',row.key);
  await page.locator(`.scan-inline-printings [data-act="scanBrowseChoose"][data-key=${JSON.stringify(row.key)}]`).click();await frame(page);
  const after=await queue(page),chosen=after[0].cands[0];
  assert.deepEqual(metadata(after[0]),metadata(initial[0]));assert.deepEqual(after[1],initial[1]);
  assert.equal(chosen.id,row.cardId);assert.equal(chosen.exact,false);assert.equal(chosen.printingConfirmed,true);
  assert.equal(chosen.printingSelection.releaseId,row.releaseId);assert.equal(after[0].finish,game==='mtg'?'foil':game==='ptcg'?'holofoil':'1st-edition');
  assert.equal(await inventorySnapshot(page),beforeState);assert.equal(await page.locator('#sheet[open]').count(),0);
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.game),'mtg');
  await capture(page,`synthetic-search-scanner-${game}-selected-inline`);
  // An unreadable photo is friendly and leaves the existing catalogue selection intact.
  await page.route('**/api/ai/identify-card',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({game,readable:false,name:'',number:'',set:''})}));
  await page.getByRole('button',{name:'Identify with AI',exact:true}).click();
  await page.locator('.scan-ai-message').filter({hasText:'clearer photo'}).waitFor();
  assert.equal((await queue(page))[0].cands[0].id,row.cardId);assert.equal(await inventorySnapshot(page),beforeState);
  await act(page,'scanDismiss').click();await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);
  assert.equal((await queue(page)).length,2);assert.equal(await page.evaluate(()=>window.__scannerReviewTest.ocrCalls),0);
  const playing=await page.locator('#scanVideo').evaluate(video=>video.srcObject===window.__scannerReviewTest.stream&&!video.paused);assert(playing,'Same camera continues after inline review');
}
async function lateCancelledScenario(app){
 const {page}=app;await seed(app,'mtg');await readyInline(page);
 let release,seen;const started=new Promise(r=>seen=r),gate=new Promise(r=>release=r);
 await page.route('**/api/ai/identify-card',async route=>{seen();await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({game:'mtg',readable:true,name:'Fixture',number:'123',set:'one'})}).catch(()=>{});});
 await page.getByRole('button',{name:'Identify with AI',exact:true}).click();await bounded(started,'Held AI photo read');
 await act(page,'scanDismiss').click();await openCapturedCard(page,'synthetic-capture-B');await readyInline(page);
 const before=await queue(page);release();await frame(page);
 assert.deepEqual(await queue(page),before);assert.equal(await page.evaluate(()=>window.__uiTestState.ui.scan.confirm.batchId),'synthetic-capture-B');assert.equal(await page.locator('#sheet[open]').count(),0);
}
async function seedYgoCodeMetadata(page){
  const guards=await page.evaluate(ygoCodeGuardSnapshot,YGO_CODE_FIXTURE);assertYgoCodeGuards(guards);
  const installed=await page.evaluate(async({raw,guards})=>{
    const T=window.__uiTestTcg,{normalizeYgoSets}=await import('/ygo.js'),{initCatalog}=await import('/scan-catalog.js');
    // Only public catalogue data is seeded. App handlers, parser, lookup adapter,
    // candidate hydration, printing picker and persistence guards stay intact.
    for(const row of guards.slice(0,2)){
      const card=row.entry.cands[0].card,previous=T.cache.ygo[card.id];
      T.cache.ygo[card.id]={...previous,...card,sets:[...(previous?.sets||[]).filter(p=>p.code!==card.sets[0].code),...card.sets],artSchema:1,printPriceSchema:1,fetchedAt:new Date().toISOString()};
    }
    const release=normalizeYgoSets([{set_code:'LEHD',set_name:raw.rows[0][4],tcg_date:'2018-10-05',num_of_cards:1}])[0];
    T.ui('ygo').sets.list=[...T.currentYgoCatalogue().filter(s=>s.id!==release.id),release];
    return !!await initCatalog('ygo');
  },{raw:YGO_CODE_FIXTURE,guards});
  assert.equal(installed,false,'The real manual adapter must take the no-installed-pack route');
  return guards;
}
async function ygoManualFullCodeScenario(app){
  const {page}=app,initial=await seed(app,'ygo');await readyInline(page);await seedYgoCodeMetadata(page);
  const before=await inventorySnapshot(page),codeRequests=[];
  await page.route('https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?*',async route=>{
    const req=route.request(),url=new URL(req.url()),record={method:req.method(),url:url.href,settled:false,fixture:'synthetic-full-code-identity'};
    codeRequests.push(record);app.requests.push(record);
    const allowed=req.method()==='GET'&&url.searchParams.toString()==='setcode=LEHD-ENB38';
    try{await route.fulfill({status:allowed?200:451,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(allowed?{id:42566602,set_code:'LEHD-ENB38',set_rarity:'Ultra Rare'}:{error:'Unmapped code blocked; no provider call forwarded.'})});}finally{record.settled=true;}
  });
  await page.locator('#scanMatchName').fill('Coral Dragon');await page.locator('#scanMatchNumber').fill('LEHD-ENB38');
  await page.locator('.scan-confirm [data-act="scanFind"]').click();
  await page.waitForFunction(()=>{const s=window.__uiTestState.ui.scan;return !s.lookup&&(s.confirm?.error||s.cands?.some(c=>c.id==='42566602'));});
  const state=await page.evaluate(()=>({error:window.__uiTestState.ui.scan.confirm.error,cands:window.__uiTestState.ui.scan.cands,finish:window.__uiTestState.ui.scan.confirm.finish}));
  assert.equal(state.error,'');assert.equal(state.cands.length,1);assert.equal(state.cands[0].id,'42566602');assert.equal(state.cands[0].name,'Coral Dragon');assert.equal(state.cands[0].print,'LEHD-ENB38|Ultra Rare');
  assert.equal(state.cands[0].exact,false);assert.equal(state.cands[0].printingConfirmed,false);assert.equal(state.finish,'');
  assert.deepEqual(codeRequests.map(r=>[r.method,r.url]),[['GET','https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=LEHD-ENB38']]);
  await readyInline(page);
  assert.match(await page.locator('.scan-inline-printings .printing-slide.is-current').innerText(),/Coral Dragon/);
  assert.match(await page.locator('.scan-inline-printings .printing-slide.is-current').innerText(),/LEHD-ENB38/);
  const after=await queue(page);assert.deepEqual(metadata(after[0]),metadata(initial[0]));assert.deepEqual(after[1],initial[1]);
  assert.equal(after[0].status,'review');assert.equal(after[0].printingVerified,false);assert.equal(after[0].finish,'');assert.equal(after[0].cands[0].print,'LEHD-ENB38|Ultra Rare');
  assert(await act(page,'scanConfirm').isDisabled(),'Manual lookup cannot auto-enable saving without printing/edition review');
  await capture(page,'synthetic-search-scanner-ygo-manual-full-code');
  for(const suffix of ['38','B38']){
    const previous=await queue(page);await page.locator('#scanMatchNumber').fill(suffix);await page.locator('.scan-confirm [data-act="scanFind"]').click();
    await page.locator('.scan-confirm-error').filter({hasText:'Enter the full bottom code'}).waitFor();
    assert.deepEqual(await queue(page),previous,`${suffix} cannot mutate or verify the queued capture`);assert(await act(page,'scanConfirm').isDisabled());
  }
  assert.equal(codeRequests.length,1,'Suffix-only attempts never reach the exact-code provider endpoint');
  assert.equal(await inventorySnapshot(page),before);assert.equal(await page.evaluate(()=>window.__uiTestState.state.settings.game),'mtg');
  assert.equal(await page.evaluate(()=>window.__scannerReviewTest.ocrCalls),0);
}
async function ygoUncertainCodeScenario(app){
  const {page}=app;await seed(app,'ygo');await readyInline(page);const guards=await seedYgoCodeMetadata(page),before=await inventorySnapshot(page);
  await act(page,'scanDismiss').click();await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);
  await page.evaluate(rows=>{
    const batch=window.__scannerReviewTest.batch,template=batch.loadBatch()[0];
    batch.saveBatch(rows.map(({entry},i)=>({...template,...entry,captureRevision:'synthetic-code-revision-'+i,defaults:{finish:'unlimited',finishConfirmed:true},selectedIndex:-1})));
  },guards.slice(1));
  const initial=await queue(page);
  for(const [i,guard] of guards.slice(1).entries()){
    await openCapturedCard(page,guard.entry.id);await readyInline(page);
    const current=(await queue(page))[i];assert.deepEqual(metadata(current),metadata(initial[i]));
    assert.equal(current.status,'review');assert.equal(current.printingVerified,false);assert.equal(current.finish,'');assert(current.cands.every(c=>c.exact===false));
    const evidence=await page.evaluate(async()=>{const s=window.__uiTestState.ui.scan,{textVerifiedMatch}=await import('/scancam.js');return {read:s.read,finish:s.confirm.finish,verified:s.cands.map(c=>textVerifiedMatch('ygo',{...c,exact:true},s.read))};});
    assert.equal(evidence.read.code,guard.code);assert.equal(evidence.finish,'');assert(evidence.verified.length&&evidence.verified.every(v=>v===false));
    assert(await act(page,'scanConfirm').isDisabled(),'Uncertain OCR/suffix input cannot enable Add to collection');
    assert.equal(await act(page,'scanBatchSave').count(),0,'Uncertain entries are not exposed as ready matches');
    await capture(page,`synthetic-search-scanner-ygo-review-${i===0?'corrected-ocr':i===1?'suffix-38':'suffix-b38'}`);
    await act(page,'scanDismiss').click();await page.waitForFunction(()=>!window.__uiTestState.ui.scan.confirm);
    assert.equal(await inventorySnapshot(page),before);
  }
  const final=await queue(page);assert.equal(final.length,3);assert(final.every(row=>row.status==='review'&&!row.printingVerified&&!row.finish));
  assert.equal(await page.evaluate(()=>window.__scannerReviewTest.ocrCalls),0,'Synthetic OCR strings are injected only at the production evidence boundary');
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
  await run('mtg-late-ai-a-to-b','mtg',lateCancelledScenario);
  await run('ygo-manual-full-code','ygo',ygoManualFullCodeScenario);
  await run('ygo-uncertain-code-review','ygo',ygoUncertainCodeScenario);
}catch(error){record('runner','setup',error);}
finally{try{await browser?.close();}catch(error){record('runner','browser cleanup',error);}try{await server?.close();}catch(error){record('runner','server cleanup',error);}}
await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,'scanner-printing-browser.json'),JSON.stringify({kind:'synthetic-scanner-printing-review',matrix,outcomes,status:failures.length?'failed':'passed',limitations:['No physical-camera or OCR-accuracy claim.','All card data, images, camera pixels and collection fixtures are synthetic.','Code evidence uses injected text and production parsing/verification; manual full-code lookup uses real UI/app adapters with an intercepted public identity response, not a live provider.'],failures:failures.map(({label,phase,error})=>({label,phase,stack:error.stack}))},null,2));
if(failures.length){const error=new AggregateError(failures.map(f=>f.error),`${failures.length} scanner-printing UI regression error(s)`);error.stack+='\n'+failures.map(f=>`${f.label}/${f.phase}: ${f.error.stack}`).join('\n');throw error;}
