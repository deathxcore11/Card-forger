// Hosted-only actual app. Every AI response and provider is a synthetic fixture.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {startServer,openSearchApp,inventorySnapshot,CARDS,ISO} from './search-fixtures.mjs';
import {cleanMatchupRequest,validateMatchupAnalysis} from '../ai-matchup-core.js';
const player={id:'matchup-player-fixture',name:'Synthetic player deck',format:'Standard',cards:[{name:CARDS.mtg[0].name,qty:60}],side:[]};
const field={format:'Standard',source:'Synthetic hosted matchup source',updatedAt:ISO,fetchedAt:ISO,decks:[{key:'opponent-green',name:'Synthetic Green opponent',format:'Standard',main:[{name:CARDS.mtg[1].name,qty:60}],share:.5,date:ISO}]};
const response=()=>({summary:'Synthetic conditional coaching, not a played match.',outlook:'uncertain',confidence:'limited',assumptions:['Assume available mana and a functional draw.'],scenarios:['On the play','On the draw','After disruption'].map(title=>({title,setup:'A hypothetical board with usable mana.',plan:'Develop a threat while preserving another resource.',risk:'The opponent may have interaction.',lesson:'Keep a follow-up rather than commit everything.',cardIds:['p0','o0']})),coaching:[{title:'Plan for interaction',text:'Retain another threat before committing resources.',cardIds:['p0']}],recommendation:null,limitations:['Fixture evidence only; no actual game was played.']});
const EVIDENCE='Hosted local actual-app tests with synthetic cards, tournament data and intercepted AI responses. All non-fixture external calls fail closed. No paid provider, real account or real inventory is used. Pinned tests/frame-art/mtg.jpg publisher artwork is substituted into both synthetic deck images only as a visual-fit sample; it does not match or prove fixture card identity, live provider behavior or model quality.';
assert(player.cards.length&&field.decks[0].main.length);
if(process.argv.includes('--validate-fixtures')){console.log('PASS: synthetic Matchups fixture source, explicit local deck and hosted-only execution contract. No browser or network started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Matchups browser QA is hosted-only; use --validate-fixtures locally.');
const artSources=JSON.parse(await readFile(new URL('./frame-art/sources.json',import.meta.url))),artBytes=await readFile(new URL('./frame-art/mtg.jpg',import.meta.url));assert(artBytes.length>5000);
const artEvidence={file:'tests/frame-art/mtg.jpg',source:artSources.mtg[0],purpose:'Image substitution for visual fit only; synthetic card identities do not match this artwork.'};
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch({headless:true});
const out=new URL('../test-results/',import.meta.url),checks=[];
let app,hold=null,calls=0,heroArtEvidence=null;const artSubstitutions=[];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function matchupLayout(page,label){
 const root=await page.locator('#sheet[open] .am-sheet').count()?page.locator('#sheet .am-sheet'):page.locator('.am-root');
 const x=await root.evaluate(root=>({width:innerWidth,doc:document.documentElement.scrollWidth,scroll:root.scrollWidth,client:root.clientWidth,bad:[...root.querySelectorAll('button,input,summary,a')].filter(n=>n.getClientRects().length&&!n.closest('.am-scenario-choice,.cs-tabs')).filter(n=>{const r=n.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5;}).map(n=>n.textContent)}));
 assert(x.doc<=x.width+2&&x.scroll<=x.client+2,label+' no page/sheet overflow '+JSON.stringify(x));assert.deepEqual(x.bad,[],label+' controls fit');
}
async function reachable(page,locator,label){
 await locator.evaluate(node=>node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await frames(page);
 const hit=await locator.evaluate(node=>{const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,target=document.elementFromPoint(x,y),nav=document.querySelector('.bottom-nav'),nr=nav?.getBoundingClientRect();return {reachable:!!target&&(target===node||node.contains(target)),bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},viewport:{width:innerWidth,height:innerHeight},coveredBy:target?.className||target?.tagName,bottomLimit:node.closest('dialog[open]')?innerHeight:nav&&getComputedStyle(nav).display!=='none'?nr.top:innerHeight};});
 assert(hit.reachable&&hit.bounds.left>=0&&hit.bounds.right<=hit.viewport.width&&hit.bounds.top>=0&&hit.bounds.bottom<=hit.bottomLimit,label+' fully reachable without sticky/bottom-navigation obstruction: '+JSON.stringify(hit));
}
async function capture(page,name,{fullPage=true}={}){await mkdir(out,{recursive:true});await frames(page);await page.screenshot({path:new URL(`magic-matchups-${name}.png`,out).pathname,fullPage,animations:'disabled'});}
try{
 app=await openSearchApp(browser,server.base,{game:'mtg',width:390,height:1000,prepareFixtures:fixtures=>{fixtures.state.decks=[structuredClone(player)];fixtures.state.activeDeck=player.id;}});const {page}=app;
 for(const card of CARDS.mtg.slice(0,2))await page.route(card.image_uris.art_crop,async route=>{await route.fulfill({contentType:'image/jpeg',body:artBytes});artSubstitutions.push(route.request().url());});
 // Record exact synthetic payloads for any unexpected persistence, independently
 // of the shared no-sensitive-write guard. Never reset either guard after setup.
 await page.evaluate(()=>{
  const baseline=structuredClone(window.__uiTestState.state);let previous=baseline;
  window.__matchupPersistence={baseline,writesAttempted:[]};
  const record=(raw,key,backend)=>{if(key!=='cardforge-v2')return;const after=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);const before=previous;previous=after;window.__matchupPersistence.writesAttempted.push({backend,key,route:location.hash,changedFields:[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])),before,after});};
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){record(value,key,'indexedDB');return put.call(this,value,key);};
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){record(value,key,'localStorage');return set.call(this,key,value);};
 });
 await page.route('**/api/ai/matchup',async route=>{
  calls++;assert.equal(route.request().method(),'POST');const request=cleanMatchupRequest(route.request().postDataJSON());assert.equal(request.game,'mtg');const answer=response();validateMatchupAnalysis(answer,request);
  const gate=hold;if(gate){gate.started.resolve();await gate.release.promise;}
  try{await route.fulfill({contentType:'application/json',body:JSON.stringify({analysis:answer})});}catch(error){if(!/abort|closed|cancel|handled/i.test(String(error)))throw error;}finally{gate?.settled.resolve();}
 });
 await page.evaluate(async({player,field})=>{const {metaState}=await import('/meta.js');Object.assign(metaState('mtg:Standard'),{data:field,at:Date.now(),busy:false,error:''});Object.defineProperty(navigator.clipboard,'readText',{configurable:true,value:async()=>''});location.hash='#deck/'+player.id+'/matchups';},{player,field});
 await page.locator('.am-root').waitFor();const original=await inventorySnapshot(page);assert.equal(calls,0,'opening Matchups is not an AI request');
 await page.locator('.am-root [data-act="amOpen"]').click();
 await page.locator('#sheetBody [data-act="amColor"][data-id="G"]').click();await page.locator('#sheetBody [data-act="amSelect"]').click();
 await page.locator('#matchup-panel-decks:not([hidden])').waitFor();
 assert.match(await page.locator('#matchup-panel-decks .am-source').innerText(),/Synthetic hosted matchup source/);assert.equal(calls,0,'finding and previewing an opponent is not paid analysis');
 assert.equal(await inventorySnapshot(page),original);
 const panel=()=>page.locator('#sheetBody .cs-panel:not([hidden])');
 for(const mode of ['gallery','compact','symbols']){
  await panel().locator(`[data-act="amView"][data-mode="${mode}"]`).click();
  assert.equal(await panel().locator('.am-card-browser.view-'+mode).count(),1);
  assert.equal(await panel().locator('[data-act="deckQty"],[data-deck]').count(),0,'shared opponent rows are genuinely read-only');
  const visibleCard=panel().locator('[data-act="amCard"]:visible').first();
  assert(await visibleCard.count(),mode+' has a visible card drill-in action');
  await visibleCard.click();await page.locator('#sheetBody [data-act="sheetHistoryBack"]').waitFor();
  await page.locator('#sheetBody [data-act="sheetHistoryBack"]').first().click();
  await page.locator('#matchup-panel-decks:not([hidden])').waitFor();assert.equal(await panel().locator('.am-card-browser.view-'+mode).count(),1,'Back preserves view mode');
 }
 await capture(page,'shared-deck-preview-390',{fullPage:false});
 await page.locator('#sheetBody [data-act="amTab"][data-tab="analysis"]').click();await page.locator('#matchup-panel-analysis:not([hidden]) [data-act="amAnalyze"]').click();
 await page.locator('#matchup-panel-analysis .am-result').waitFor();assert.equal(calls,1);assert.equal(await page.locator('#matchup-panel-analysis .am-scenario').count(),1);assert.match(await panel().innerText(),/hypothetical/);assert.equal(await inventorySnapshot(page),original);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});await matchupLayout(page,'Magic Matchups sheet '+width);
  for(let scenario=0;scenario<3;scenario++){
   await page.locator(`#sheetBody [data-act="amScenario"][data-id="${scenario}"]`).click();
   assert.match(await panel().locator('.am-scenario h3').innerText(),new RegExp(response().scenarios[scenario].title));
   await matchupLayout(page,'selected scenario '+scenario+' at '+width);
  }
  await capture(page,'analysis-'+width,{fullPage:false});
  if(width===320){
   await reachable(page,panel().locator('.am-scenario h3'),'320px third scenario');await capture(page,'third-scenario-viewport-320',{fullPage:false});
   await panel().locator('.am-references>summary').first().click();
   await panel().locator('.am-references [data-act="amCard"]').first().scrollIntoViewIfNeeded();await frames(page);
   const scrollBefore=await page.locator('#sheetBody').evaluate(n=>n.scrollTop);
   await panel().locator('.am-references [data-act="amCard"]').first().click();await page.locator('#sheetBody [data-act="sheetHistoryBack"]').first().click();
   await page.locator('#matchup-panel-analysis:not([hidden])').waitFor();assert.match(await panel().locator('.am-scenario h3').innerText(),/After disruption/);
   const scrollAfter=await page.locator('#sheetBody').evaluate(n=>n.scrollTop);assert(Math.abs(scrollAfter-scrollBefore)<100,'Back restores analysis scroll near its previous position');
  }
 }
 await page.locator('#sheetBody [data-act="closeSheet"]').first().click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);
 await page.waitForFunction(()=>{const img=document.querySelector('.deck-hero>.hero-art');return img?.complete&&img.naturalWidth>0;});heroArtEvidence=await page.locator('.deck-hero>.hero-art').evaluate(img=>({src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight}));assert.equal(heroArtEvidence.src,CARDS.mtg[0].image_uris.art_crop);assert(artSubstitutions.includes(heroArtEvidence.src));
 await page.setViewportSize({width:390,height:1000});await page.locator('.am-root').scrollIntoViewIfNeeded();await matchupLayout(page,'compact main');assert.equal(await page.locator('.am-root .am-result,.am-root .am-controls,.am-root .display-list').count(),0,'main never expands into long setup/deck/analysis content');await capture(page,'compact-main-390',{fullPage:false});
 checks.push('Shared Setup/Decks/Analysis sheet, actual Gallery/Compact/List rows, read-only card drill-in/Back, three scenario tabs, four responsive widths and no saved mutations.');
 // Paste is a preview only. Edits invalidate a formerly usable preview.
 await page.locator('.am-root [data-act="amOpen"][data-tab="setup"]').click();await page.locator('#sheetBody [data-act="amPaste"]').click();await page.locator('#amImportText').fill(`60 ${CARDS.mtg[1].name}`);await page.locator('#amImportName').fill('Synthetic pasted opponent');
 assert(await page.locator('#amImportUse').isDisabled());await page.locator('[data-act="amImportPreview"]').click();await page.waitForFunction(()=>!document.querySelector('#amImportUse').disabled);assert.equal(await inventorySnapshot(page),original);assert.equal(calls,1);
 await page.locator('#amImportName').fill('Revised synthetic opponent');assert(await page.locator('#amImportUse').isDisabled());await page.locator('[data-act="amImportPreview"]').click();await page.waitForFunction(()=>!document.querySelector('#amImportUse').disabled);
 await capture(page,'paste-preview-390',{fullPage:false});await page.locator('#amImportUse').click();await page.locator('#matchup-panel-decks:not([hidden])').waitFor();assert.match(await page.locator('#matchup-panel-decks .am-source').innerText(),/Imported opponent/);assert.equal(await inventorySnapshot(page),original);assert.equal(calls,1,'using a pasted opponent never starts AI or saves a deck');
 checks.push('Paste matching and re-edit invalidate preview; Use returns to the shared deck sheet and changes no saved data.');
 await page.locator('#sheetBody [data-act="amTab"][data-tab="analysis"]').click();
 // Cancel an in-flight mocked request, then discard a response after navigation.
 hold={started:deferred(),release:deferred(),settled:deferred()};await panel().locator('[data-act="amAnalyze"]').click();await hold.started.promise;assert(await panel().locator('[data-act="amAnalyze"]').isDisabled());await page.locator('#sheetBody [data-act="amCancel"]').click();hold.release.resolve();await hold.settled.promise;hold=null;await frames(page);assert.equal(await panel().locator('.am-result').count(),0);assert.equal(await inventorySnapshot(page),original);
 hold={started:deferred(),release:deferred(),settled:deferred()};await panel().locator('[data-act="amAnalyze"]').click();await hold.started.promise;await page.evaluate(()=>{location.hash='#collection';});await page.waitForFunction(()=>document.body.dataset.view==='collection');hold.release.resolve();await hold.settled.promise;hold=null;await frames(page);
 await page.evaluate(id=>{location.hash='#deck/'+id+'/matchups';},player.id);await page.locator('.am-root').waitFor();await page.locator('.am-root [data-act="amOpen"][data-tab="analysis"]').click();assert.equal(await panel().locator('.am-result').count(),0,'navigation invalidates late response');assert.equal(await inventorySnapshot(page),original);
 await panel().locator('[data-act="amAnalyze"]').click();await panel().locator('.am-result').waitFor();assert.equal(await inventorySnapshot(page),original,'fresh request works after cancellation and navigation');
 checks.push('Cancel, disabled duplicate Analyze, navigation-stale response ignored and subsequent fresh Analyze succeeds.');
 assert.deepEqual(await page.evaluate(()=>window.__fixtureSensitiveWrites),[],'no persisted inventory writes');app.health();
 await writeFile(new URL('magic-matchups-browser.json',out),JSON.stringify({status:'passed',evidence:EVIDENCE,artEvidence,heroArtEvidence,artSubstitutions,checks,mockedAnalysisRequests:calls,persistence:await page.evaluate(()=>window.__matchupPersistence)},null,2));console.log('PASS: '+checks.join(' '));
}catch(error){let persistence;if(app)try{persistence=await app.page.evaluate(()=>window.__matchupPersistence);await capture(app.page,'failure');}catch{}await mkdir(out,{recursive:true});await writeFile(new URL('magic-matchups-browser.json',out),JSON.stringify({status:'failed',evidence:EVIDENCE,artEvidence,heroArtEvidence,artSubstitutions,checks,persistence,error:String(error.stack||error)},null,2));throw error;}
finally{hold?.release.resolve();await app?.context.close();await browser.close();await server.close();}
