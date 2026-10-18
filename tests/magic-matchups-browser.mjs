// Hosted-only actual app. Every AI response and provider is a synthetic fixture.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,inventorySnapshot,CARDS,ISO} from './search-fixtures.mjs';
import {cleanMatchupRequest,validateMatchupAnalysis} from '../ai-matchup-core.js';
const player={id:'matchup-player-fixture',name:'Synthetic player deck',format:'Standard',cards:[{name:CARDS.mtg[0].name,qty:60}],side:[]};
const field={format:'Standard',source:'Synthetic hosted matchup source',updatedAt:ISO,fetchedAt:ISO,decks:[{key:'opponent-green',name:'Synthetic Green opponent',format:'Standard',main:[{name:CARDS.mtg[1].name,qty:60}],share:.5,date:ISO}]};
const response=()=>({summary:'Synthetic conditional coaching, not a played match.',outlook:'uncertain',confidence:'limited',assumptions:['Assume available mana and a functional draw.'],scenarios:['On the play','On the draw','After disruption'].map(title=>({title,setup:'A hypothetical board with usable mana.',plan:'Develop a threat while preserving another resource.',risk:'The opponent may have interaction.',lesson:'Keep a follow-up rather than commit everything.',cardIds:['p0','o0']})),coaching:[{title:'Plan for interaction',text:'Retain another threat before committing resources.',cardIds:['p0']}],recommendation:null,limitations:['Fixture evidence only; no actual game was played.']});
const EVIDENCE='Hosted local actual-app tests with synthetic cards, tournament data and intercepted AI responses. All non-fixture external calls fail closed. No paid provider, real account or real inventory is used.';
assert(player.cards.length&&field.decks[0].main.length);
if(process.argv.includes('--validate-fixtures')){console.log('PASS: synthetic Matchups fixture source, explicit local deck and hosted-only execution contract. No browser or network started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Matchups browser QA is hosted-only; use --validate-fixtures locally.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch({headless:true});
const out=new URL('../test-results/',import.meta.url),checks=[];
let app,hold=null,calls=0;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function matchupLayout(page,label){
 const x=await page.locator('.am-root').evaluate(root=>({width:innerWidth,doc:document.documentElement.scrollWidth,scroll:root.scrollWidth,client:root.clientWidth,rails:[...root.querySelectorAll('.am-pill-row')].map(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,overflow:getComputedStyle(n).overflowX})),bad:[...root.querySelectorAll('button,input,summary,a')].filter(n=>n.getClientRects().length&&!n.closest('.am-pill-row')).filter(n=>{const r=n.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5;}).map(n=>n.textContent)}));
 assert(x.doc<=x.width+2&&x.scroll<=x.client+2,label+' no page overflow '+JSON.stringify(x));assert.deepEqual(x.bad,[],label+' controls fit');
 for(const rail of x.rails){assert(rail.left>=-.5&&rail.right<=x.width+.5,label+' rail contained');assert.equal(rail.overflow,'auto');}
}
async function capture(page,name){await mkdir(out,{recursive:true});await frames(page);await page.screenshot({path:new URL(`magic-matchups-${name}.png`,out).pathname,fullPage:true,animations:'disabled'});}
try{
 app=await openSearchApp(browser,server.base,{game:'mtg',width:390,height:1000});const {page}=app;
 await page.route('**/api/ai/matchup',async route=>{
  calls++;assert.equal(route.request().method(),'POST');const request=cleanMatchupRequest(route.request().postDataJSON());assert.equal(request.game,'mtg');const answer=response();validateMatchupAnalysis(answer,request);
  const gate=hold;if(gate){gate.started.resolve();await gate.release.promise;}
  try{await route.fulfill({contentType:'application/json',body:JSON.stringify({analysis:answer})});}catch(error){if(!/abort|closed|cancel|handled/i.test(String(error)))throw error;}finally{gate?.settled.resolve();}
 });
 await page.evaluate(async({player,field})=>{const S=window.__uiTestState;S.state.decks=[player];const {metaState}=await import('/meta.js');Object.assign(metaState('mtg:Standard'),{data:field,at:Date.now(),busy:false,error:''});Object.defineProperty(navigator.clipboard,'readText',{configurable:true,value:async()=>''});location.hash='#deck/'+player.id+'/matchups';},{player,field});
 await page.locator('.am-root').waitFor();const original=await inventorySnapshot(page);assert.equal(calls,0,'opening Matchups is not an AI request');
 await page.locator('[data-act="amColor"][data-id="G"]').click();await page.locator('[data-act="amSelect"]').click();await page.locator('.am-preview').waitFor();
 assert.match(await page.locator('.am-source').innerText(),/Synthetic hosted matchup source/);assert.equal(calls,0,'finding and previewing an opponent is not paid analysis');
 assert.equal(await inventorySnapshot(page),original);
 await page.locator('[data-act="amAnalyze"]').click();await page.locator('.am-result').waitFor();assert.equal(calls,1);assert.equal(await page.locator('.am-scenario').count(),3);assert.match(await page.locator('.am-result').innerText(),/illustrative|hypothetical/);assert.equal(await inventorySnapshot(page),original);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await matchupLayout(page,'Magic Matchups '+width);await page.locator('.am-scenario summary').first().click();await matchupLayout(page,'expanded scenario '+width);await capture(page,'result-'+width);await page.locator('.am-scenario summary').first().click();}
 checks.push('Explicit opponent selection and Analyze, three grounded synthetic scenarios, four responsive widths and no saved mutations.');
 // Paste is a preview only. Edits invalidate a formerly usable preview.
 await page.setViewportSize({width:390,height:1000});await page.locator('[data-act="amPaste"]').click();await page.locator('#amImportText').fill(`60 ${CARDS.mtg[1].name}`);await page.locator('#amImportName').fill('Synthetic pasted opponent');
 assert(await page.locator('#amImportUse').isDisabled());await page.locator('[data-act="amImportPreview"]').click();await page.waitForFunction(()=>!document.querySelector('#amImportUse').disabled);assert.equal(await inventorySnapshot(page),original);assert.equal(calls,1);
 await page.locator('#amImportName').fill('Revised synthetic opponent');assert(await page.locator('#amImportUse').isDisabled());await page.locator('[data-act="amImportPreview"]').click();await page.waitForFunction(()=>!document.querySelector('#amImportUse').disabled);
 await capture(page,'paste-preview-390');await page.locator('#amImportUse').click();await page.locator('.am-preview').waitFor();assert.match(await page.locator('.am-source').innerText(),/Imported opponent/);assert.equal(await inventorySnapshot(page),original);assert.equal(calls,1,'using a pasted opponent never starts AI or saves a deck');
 checks.push('Paste matching and re-edit invalidate the preview; using opponent changes no deck or collection.');
 // Cancel an in-flight mocked request, then discard a response after navigation.
 hold={started:deferred(),release:deferred(),settled:deferred()};await page.locator('[data-act="amAnalyze"]').click();await hold.started.promise;assert(await page.locator('[data-act="amAnalyze"]').isDisabled());await page.locator('[data-act="amCancel"]').click();hold.release.resolve();await hold.settled.promise;hold=null;await frames(page);assert.equal(await page.locator('.am-result').count(),0);assert.equal(await inventorySnapshot(page),original);
 hold={started:deferred(),release:deferred(),settled:deferred()};await page.locator('[data-act="amAnalyze"]').click();await hold.started.promise;await page.evaluate(()=>{location.hash='#collection';});await page.waitForFunction(()=>document.body.dataset.view==='collection');hold.release.resolve();await hold.settled.promise;hold=null;await frames(page);
 await page.evaluate(id=>{location.hash='#deck/'+id+'/matchups';},player.id);await page.locator('.am-root').waitFor();assert.equal(await page.locator('.am-result').count(),0,'navigation invalidates late response');assert.equal(await inventorySnapshot(page),original);
 await page.locator('[data-act="amAnalyze"]').click();await page.locator('.am-result').waitFor();assert.equal(await inventorySnapshot(page),original,'a fresh request still works after cancellation and navigation');
 checks.push('Cancel, disabled duplicate Analyze, navigation-stale response ignored and subsequent fresh Analyze succeeds.');
 assert.deepEqual(await page.evaluate(()=>window.__fixtureSensitiveWrites),[],'no persisted inventory writes');app.health();
 await writeFile(new URL('magic-matchups-browser.json',out),JSON.stringify({status:'passed',evidence:EVIDENCE,checks,mockedAnalysisRequests:calls},null,2));console.log('PASS: '+checks.join(' '));
}catch(error){if(app)try{await capture(app.page,'failure');}catch{}await mkdir(out,{recursive:true});await writeFile(new URL('magic-matchups-browser.json',out),JSON.stringify({status:'failed',evidence:EVIDENCE,checks,error:String(error.stack||error)},null,2));throw error;}
finally{hold?.release.resolve();await app?.context.close();await browser.close();await server.close();}
