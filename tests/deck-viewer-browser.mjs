import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,CARDS,inventorySnapshot} from './search-fixtures.mjs';
import {checkDeckViews} from './deck-viewer-checks.mjs';
const local=process.argv.includes('--local');
assert(process.env.GITHUB_ACTIONS==='true'||local&&process.env.CARDSTASHY_LOCAL_BROWSER==='1','Use hosted CI or --local with CARDSTASHY_LOCAL_BROWSER=1.');
const {chromium}=await import(process.env.CARDSTASHY_PLAYWRIGHT_MODULE||'playwright');
const server=await startServer(),browser=await chromium.launch({headless:true,...(process.env.CARDSTASHY_CHROMIUM_PATH?{executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{} )}),checks=[];
await mkdir('test-results',{recursive:true});
try{
 for(const game of ['mtg','ptcg','ygo']){
  const cs=CARDS[game],main=cs.slice(0,4).map((c,i)=>({name:c.name,cardId:c.id,qty:i+1}));
  const deck={id:'four-views',name:'Four views fixture',format:game==='mtg'?'Standard':game==='ygo'?'tcg':'standard',...(game==='mtg'?{cards:main,side:[{...main[0],qty:2}]}:{zones:{main,extra:game==='ygo'?[{...main[1],qty:1}]:[],side:game==='ygo'?[{...main[0],qty:2}]:[]}})};
  const app=await openSearchApp(browser,server.base,{game,width:390,prepareFixtures:f=>(game==='mtg'?f.state:f.state.tcg[game]).decks.push(deck)});
  try{
   const {page}=app;await page.locator('[data-nav="decks"]:visible').first().click();await page.locator('.deck-tile').filter({hasText:deck.name}).click();
   await page.waitForLoadState('networkidle');
   const before=await inventorySnapshot(page);
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:1000});
    const rows=await checkDeckViews(page,{root:'#content .deck-viewer',controls:'#content',label:`saved-${game}-${width}`,screenshots:width===390||width===1440});
    assert.equal(rows.filter(r=>r.zone==='main').reduce((n,r)=>n+Number(r.qty),0),10);
    if(game!=='ptcg')assert.equal(rows.filter(r=>r.zone==='side').reduce((n,r)=>n+Number(r.qty),0),2);
    assert.equal(await inventorySnapshot(page),before,'layout changes never alter decks or ownership');
    checks.push({source:'saved',game,width,fourViews:true,exactCards:true,stableNodes:true,keyboard:true});
   }
   if(game==='mtg'){
    await page.setViewportSize({width:390,height:1000});await page.evaluate(async()=>{(await import('/settings-theme.js')).applyTheme('light',{persist:false});});
    await checkDeckViews(page,{root:'#content .deck-viewer',controls:'#content',label:'saved-mtg-light-390',screenshots:true});
    await page.evaluate(async()=>{(await import('/settings-theme.js')).applyTheme('dark',{persist:false});});checks.push({source:'saved',game,theme:'light',fourViews:true});
    assert.match(await page.locator('.ds-stats').innerText(),/10\/60/);
    await page.locator('[data-input="deckSearch"]').fill(cs[0].name);await page.locator('.deck-view-switch [data-mode="stacks"]').click();
    const filtered=await page.locator('#deckList [data-deck-card]').count();assert.equal(filtered,1);
    await page.locator('.deck-view-switch [data-mode="symbols"]').click();
    // The view is painted after the durable preference write completes. A
    // forced reload immediately after click can abort that pending write.
    await page.waitForFunction(()=>document.querySelector('#content .deck-viewer')?.dataset.deckView==='symbols'&&window.__uiTestState.state.settings.displayModes?.mtg?.deck==='symbols');
    assert.equal(await page.locator('#deckList [data-deck-card]').count(),filtered);
    await page.reload();await page.locator('#app.ready').waitFor();await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;});await page.waitForFunction(()=>document.querySelector('#content .deck-viewer')?.dataset.deckView==='symbols');
    checks.push({source:'saved',game,persistedAfterReload:true,filterSurvivesViewSwitch:true});
   }
   if(game==='mtg'){
    // Exercise the real tournament-deck action with an explicitly synthetic source.
    await page.evaluate(async ({cs,main})=>{
     const S=(await import('/store.js')).S,{metaState}=await import('/meta.js');
     const source={key:'view-meta',name:'Tournament layout fixture',commanders:[],main,side:[{...main[0],qty:2}],place:'1st',event:'Synthetic fixture',players:8,date:'2026-10-17'};
     Object.assign(metaState('mtg:Standard'),{at:Date.now(),data:{decks:[source],archetypes:[],source:'Magic Online (official decklists)',days:7,coverage:{events:1}}});S.ui.mtgMeta={format:'Standard'};
     const opener=document.createElement('button');Object.assign(opener.dataset,{act:'mtgProven',key:source.key,format:'Standard'});document.body.append(opener);opener.click();opener.remove();
    },{cs,main});
    await page.locator('#sheet[open] .deck-viewer').waitFor();await page.waitForFunction(async()=>!(await import('/tcg.js')).proven.busy);await page.waitForLoadState('networkidle');
    await page.setViewportSize({width:390,height:1000});
    const sourceRows=await checkDeckViews(page,{root:'#sheet .deck-viewer',label:'tournament-390',screenshots:true});
    assert.equal(sourceRows.filter(r=>r.zone==='main').reduce((n,r)=>n+Number(r.qty),0),10);assert.equal(sourceRows.filter(r=>r.zone==='side').reduce((n,r)=>n+Number(r.qty),0),2);
    await page.locator('#sheet .deck-view-switch [data-mode="symbols"]').click();await page.waitForFunction(()=>document.querySelector('#sheet .deck-viewer')?.dataset.deckView==='symbols');
    await page.locator('#sheet .deck-viewer [data-act="card"]').first().click();await page.locator('#sheet .cs-card').waitFor();await page.locator('#sheet [data-act="sheetHistoryBack"]').click();await page.locator('#sheet .deck-viewer[data-deck-view="symbols"]').waitFor();
    assert.equal(await page.evaluate(()=>window.__uiTestState.ui.sheetCtx.key),'view-meta','Back retains the exact tournament source');
    assert.equal(await page.locator('#sheet [data-deck-card]').count(),sourceRows.length);
    await page.locator('#sheet .deck-view-switch [data-mode="stacks"]').click();await page.locator('#sheet .deck-viewer[data-deck-view="stacks"]').waitFor();
    const stackedCard=page.locator('#sheet .deck-viewer [data-act="card"]').first();await stackedCard.hover({position:{x:12,y:12}});await stackedCard.click();await page.locator('#sheet .cs-card').waitFor();await page.locator('#sheet [data-act="sheetHistoryBack"]').click();await page.locator('#sheet .deck-viewer[data-deck-view="stacks"]').waitFor();
    await page.locator('#sheet .deck-view-switch [data-mode="compact"]').click();await page.locator('#sheet .deck-viewer[data-deck-view="compact"]').waitFor();
    assert.equal(await page.locator('#sheet [data-deck-list] > .deck-stack-group').count(),0,'Back-restored stacks unwrap when returning to Detailed list');
    assert.deepEqual(await page.locator('#sheet [data-deck-card]').evaluateAll(ns=>ns.map(n=>({name:n.dataset.deckName,qty:n.dataset.deckQty,zone:n.dataset.deckZone}))),sourceRows.map(({name,qty,zone})=>({name,qty,zone})),'Back-restored groups retain exact source order');
    checks.push({source:'tournament',actualOpenAndCardBack:true,mainAndSide:true,fourViews:true,stackBackRestoresOrder:true});
    // Renderer coverage for read-only shared snapshots and the older selection
    // proposal. It does not certify community networking or a game entry point.
    for(const kind of ['shared','idea']){
     await page.evaluate(async ({kind,game,cs,main})=>{
      const V=await import('/views.js'),{sharedDeckSheet}=await import('/shared-deck-view.js'),{syncDeckViewers}=await import('/deck-viewer.js');
      const html=kind==='shared'?sharedDeckSheet({sharedItem:{game,key:'shared-view',title:'Shared layout fixture',format:'Standard',deckSchema:1,cards:[...main.map((r,i)=>({...r,zone:'main',image:cs[i].image_uris.normal,referenceUSD:null})),{...main[0],zone:'side',qty:2,image:cs[0].image_uris.normal,referenceUSD:null}]}}):V.ideaSheet({commander:cs[0],plan:'Synthetic selection fixture'},{id:'proposal-view',name:'Selection fixture',format:'Commander',commander:cs[0].name,cards:main,side:[]},{budget:50,busy:false,msg:''},new Set([main[0].name]));
      document.querySelector('#sheetBody').innerHTML=html;syncDeckViewers();
     },{kind,game,cs,main});
     await checkDeckViews(page,{root:'#sheet .deck-viewer',label:kind+'-390',screenshots:true});
     if(kind==='idea')assert.equal(await page.locator('#sheet .deck-viewer input:checked').count(),1,'all four layouts preserve the selected card');
     checks.push({source:kind,rendererOnly:true,fourViews:true,stableSelections:true});
    }
   }
   app.health();
  }finally{await app.context.close();}
 }
}finally{await writeFile('test-results/deck-viewer-browser.json',JSON.stringify({checks,status:checks.length===17?'passed':'incomplete',syntheticArt:true,postDraftAndPractice:'NOT RUN — not implemented'},null,2));await browser.close();await server.close();}
console.log('PASS: four saved-deck layouts across three games and four widths; exact lists, zones, original nodes, keyboard, filters, persistence and unchanged ownership.');
