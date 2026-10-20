// Hosted actual-app mana guidance QA. Every card, arrangement, price and picture
// below is synthetic. This is not a user's deck or a live provider/AI test.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openApp,navigate,closeSheet,noOverflow,inventorySnapshot,ISO,NOW,RESULTS} from './detail-rules-fixtures.mjs';
import {cardKey,sumQty,validateDeck} from '../core.js';
import {engineProfile,manaPaymentProfile} from '../insights.js';
import {manaBase,deckReview} from '../extras.js';

const EVIDENCE='Actual registered deck/review/Power controls in isolated hosted Chromium. Independently invented normalized Magic cards, deck arrangements, prices and SVG artwork only. No private deck, photo, account or provider credential. All provider responses are local fixtures; every network write is forbidden and no AI control is used. These tests establish a casting-cost guideline and UI integration, not casting probabilities, legal tournament cards or physical-device performance.';
const WIDTHS=[320,390,768,1440],TITLE='Review your basic-land split';
const PANEL='.deck-body[data-tab="engine"] > section.panel:has(.mb-table), .deck-body[data-tab="engine"] > section.panel:has(.mana-payment-notes)';
const artifact=name=>`${RESULTS}/mana-warning-${name}`;
function card(name,cost,extra={}){
 const id='mana-fixture-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 return {id,oracle_id:id+'-oracle',name,mana_cost:cost,type_line:'Creature — Fixture',oracle_text:'',cmc:2,power:'2',toughness:'2',colors:['W'],color_identity:['W'],legalities:{standard:'legal',commander:'legal'},set:'mqa',set_name:'Synthetic Mana QA',collector_number:'1',rarity:'common',prices:{usd:'.25',usd_foil:null},finishes:['nonfoil'],games:['paper'],digital:false,oversized:false,border_color:'black',set_type:'core',full:true,checkedAt:ISO,image_uris:{normal:`https://detail-fixtures.invalid/${id}.svg`,small:`https://detail-fixtures.invalid/${id}.svg`,art_crop:`https://detail-fixtures.invalid/${id}.svg`},...extra};
}
const plains=card('Plains','',{type_line:'Basic Land — Plains',cmc:0,colors:[],produced_mana:['W']}),
 white=Array.from({length:6},(_,i)=>card(`Synthetic white adept ${i+1}`,'{1}{W}')),
 heavy=Array.from({length:2},(_,i)=>card(`Synthetic white guardian ${i+1}`,'{1}{W}{W}')),
 generic=card('Synthetic neutral construct','{2}',{colors:[],color_identity:[]});
function fixture(kind){
 let choice=card('Synthetic flexible sentinel','{W/U}{W/U}',{colors:['W','U'],color_identity:['W','U']}),lands=plains,spells=[...white,...heavy];
 if(kind==='blue')choice=card('Synthetic blue archivist','{U}{U}',{colors:['U'],color_identity:['U']});
 if(kind==='optional')choice=card('Synthetic alternative payment','{W}{U/P}{2/B}',{colors:['W','U','B'],color_identity:['W','U','B']});
 if(kind==='missing'){choice=card('Synthetic incomplete casting data',undefined);delete choice.mana_cost;}
 if(kind==='faces')choice=card('Synthetic dawn // Synthetic tide','',{layout:'modal_dfc',color_identity:['W','U'],card_faces:[{name:'Synthetic dawn',type_line:'Creature — Fixture',mana_cost:'{W}',oracle_text:'',power:'2',toughness:'2'},{name:'Synthetic tide',type_line:'Sorcery',mana_cost:'{U}{U}',oracle_text:''}]});
 if(kind==='hybrid-only'){
  lands=card('Snow-Covered Plains','',{type_line:'Basic Snow Land — Plains',cmc:0,colors:[],produced_mana:[]});
  spells=Array.from({length:8},(_,i)=>card(`Synthetic flexible cohort ${i+1}`,'{W/U}{W/U}',{colors:['W','U'],color_identity:['W','U']}));
 }
 const rows=[{name:lands.name,qty:22},...spells.map(c=>({name:c.name,qty:4})),{name:choice.name,qty:4},{name:generic.name,qty:2}],cards=[lands,...spells,choice,generic];
 if(kind==='source-gap'){
  const land=card('Synthetic unlisted source','',{type_line:'Land',cmc:0,colors:[],color_identity:[],produced_mana:[]});cards.push(land);rows[rows.length-1]={name:land.name,qty:2};
 }
 const catalog=Object.fromEntries(cards.map(c=>[cardKey(c.name),c])),deck={id:'mana-'+kind,name:'Synthetic mana review · '+kind,format:'Standard',cards:rows,side:[],versions:[],locked:false};
 return {kind,choice,cards,catalog,deck,warning:kind==='blue',complete:!['missing','faces'].includes(kind)};
}
const cases=['hybrid','blue','hybrid-only','optional','missing','faces','source-gap'].map(fixture);
function validateFixtures(){
 for(const f of cases){
  assert.equal(sumQty(f.deck.cards),60);assert.equal(validateDeck(f.deck,f.catalog,[],[]).issues.filter(i=>i.kind==='count').length,0);
  const p=engineProfile(f.deck,f.catalog),m=manaBase(f.deck,f.catalog,p.pips,p.mana),warning=deckReview(f.deck,f.catalog).find(x=>x.title===TITLE);
  assert.equal(p.mana.complete,f.complete);assert.equal(!!warning,f.warning);assert.equal(m.canSuggest,f.complete);
  if(f.warning){assert.deepEqual(m.suggested,{W:18,U:4});assert.deepEqual(warning.cards,[f.choice.name]);assert.match(warning.detail,/Current basics: 22 Plains\. Suggested guideline: 18 Plains, 4 Islands/);}
  else if(f.complete){assert.equal(p.pips.U,0);assert.deepEqual(m.suggested,{W:22});}
  if(f.kind==='hybrid-only'){assert.equal(p.sources.W,22);assert.equal(p.pips.W,72);}
  if(f.kind==='optional'){assert.equal(p.pips.B,0);assert.match(p.mana.notes.join(' '),/blue mana or 2 life/);assert.match(p.mana.notes.join(' '),/black mana or two mana of any type/);}
  if(f.kind==='missing')assert.match(p.mana.notes.join(' '),/Synthetic incomplete casting data: casting-cost data is missing or unsupported/);
  if(f.kind==='faces')assert.match(p.mana.notes.join(' '),/alternative spell costs \{W\} or \{U\}\{U\}/);
  if(f.kind==='source-gap')assert.match(p.mana.notes.join(' '),/Synthetic unlisted source: no mana production is listed/);
 }
 const hybrid=cases[0].choice,even=manaPaymentProfile([{card:hybrid,qty:1}]);assert.equal(even.pips.W,1);assert.equal(even.pips.U,1);assert.match(even.notes.join(' '),/Other payment choices remain legal/);
 return 'PASS: seven independent 60-card synthetic mana fixtures, exact genuine-blue guideline, optional/face/missing/source controls. No browser, server, network or provider started.';
}
console.log(validateFixtures());
if(process.argv.includes('--validate-fixtures'))process.exit(0);
assert.equal(process.env.GITHUB_ACTIONS,'true','Actual browser QA is hosted-only; use --validate-fixtures locally.');
const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch(),checks=[],failures=[];
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const sensitive=page=>page.evaluate(()=>JSON.stringify({memory:[window.__uiTestState.state.collection,window.__uiTestState.state.decks,window.__uiTestState.state.tcg,window.__uiTestState.state.myPrices],stored:localStorage.getItem('cardforge-v2')}));
async function openFixture(f){
 // Fixture price cache avoids an unrelated background quote-refresh repaint.
 // Its entries are synthetic, recent and verified only within this test setup.
 const cache=Object.fromEntries(f.cards.map(c=>[cardKey(c.name),{usd:.25,verified:true,at:NOW,id:c.id,oracle_id:c.oracle_id,legalities:c.legalities,coverage:{provider:'Synthetic local fixture',pages:1,checked:1,hasMore:false,marketComplete:false}}]));
 const isolated={newContext:async options=>{const context=await browser.newContext(options);await context.addInitScript(cache=>localStorage.setItem('cardstashy-mtg-cheapest',JSON.stringify(cache)),cache);return context;}};
 const app=await openApp(isolated,server.base,{game:'mtg',width:390,height:1000,hasTouch:true});
 await app.page.evaluate(({deck,catalog})=>{const S=window.__uiTestState;Object.assign(S.catalog,catalog);S.state.decks=[deck];S.state.activeDeck=deck.id;},f);
 const before=await sensitive(app.page);await navigate(app.page,`#deck/${f.deck.id}/cards`);await app.page.locator('.deck-hero h1').filter({hasText:f.deck.name}).waitFor();
 assert.equal(await sensitive(app.page),before,'opening the synthetic deck never saves or changes ownership');
 return {app,before};
}
async function openReview(page,f){
 await page.locator('#content [data-act="deckReview"]').click();await page.locator('#sheet[open] .sheet-head h2').filter({hasText:'Deck review'}).waitFor();
 const warning=page.locator('#sheetBody .review-item').filter({has:page.locator('.review-main > .row > b').filter({hasText:TITLE})});
 assert.equal(await warning.count(),f.warning?1:0);
 if(f.warning){
  assert.equal((await warning.locator('.chip').textContent()).trim(),'Guideline');
  const detail=await warning.locator('.review-main > p').first().innerText();assert.match(detail,/Current basics: 22 Plains\. Suggested guideline: 18 Plains, 4 Islands/);assert(detail.includes('4× '+f.choice.name+' ({U}{U})'));assert.match(detail,/not a requirement or a full mana-source check/);
  assert.equal(await warning.locator('[data-act="card"]').getAttribute('data-name'),f.choice.name);
  assert.match(await warning.locator('[data-act="deckTab"][data-id="engine"]').innerText(),/See mana details/);
 }
 return warning;
}
async function assertMana(page,f){
 const panel=page.locator(PANEL);assert.equal(await panel.count(),1);await panel.locator('h3').filter({hasText:'Mana base'}).waitFor();
 const text=await panel.innerText();assert.match(text,/Commander color identity is checked separately/);assert.match(text,/not a casting guarantee/);
 if(f.complete){
  assert.match(text,f.warning?/Current basics: 22 Plains\. Suggested guideline: 18 Plains, 4 Islands/:/Current basics: 22 Plains\. Suggested guideline: 22 Plains/);
  const rows=await panel.locator('.mb-row:not(.head)').allTextContents();assert.equal(rows.length,f.warning?2:1);
  assert.equal(await panel.locator('.mb-row:not(.head)').filter({has:page.locator('span').filter({hasText:/^Island$/})}).count(),f.warning?1:0);
 }else{assert.equal(await panel.locator('.mb-table').count(),0);assert.match(text,/No basic-land split recommended: alternative or unsupported costs need a casting plan first/);}
 if(['hybrid','hybrid-only'].includes(f.kind)){assert.match(text,/accepts white or blue/);assert.match(text,/Each symbol is counted once; this estimate allocates it to white\./);assert.match(text,/Other payment choices remain legal/);}
 if(f.kind==='optional'){assert.match(text,/blue mana or 2 life/);assert.match(text,/black mana or two mana of any type/);assert.match(text,/optional color is not forced/);}
 if(f.kind==='missing')assert.match(text,/Synthetic incomplete casting data: casting-cost data is missing or unsupported/);
 if(f.kind==='faces')assert.match(text,/Synthetic dawn \/\/ Synthetic tide: alternative spell costs \{W\} or \{U\}\{U\}/);
 if(f.kind==='source-gap')assert.match(text,/Synthetic unlisted source: no mana production is listed in the cached source data; it is not counted in the colored-source comparison/);
 const details=panel.locator('details');assert.equal(await details.count(),1);assert.equal(await details.getAttribute('open'),null);
 await details.locator('summary').click();assert.notEqual(await details.getAttribute('open'),null);
 const counted=await details.locator('ul').innerText();
 if(f.complete)assert(counted.includes('4× '+f.choice.name+' · '+f.choice.mana_cost),'expanded real disclosure preserves the named printed cost');
 else assert(!counted.includes(f.choice.name),'unmodeled alternative/missing cost is not silently counted');
 await details.locator('summary').click();assert.equal(await details.getAttribute('open'),null);
 return {panel,text,counted};
}
async function layout(page,f,theme,width,panel){
 await page.setViewportSize({width,height:1000});await frames(page);await panel.scrollIntoViewIfNeeded();
 const geometry=await noOverflow(page,PANEL,`${f.kind} ${theme} ${width} mana panel`,true);
 const readable=await panel.evaluate(root=>{
  const failures=[];let words=0;
  for(const n of root.querySelectorAll('p,.mana-payment-notes li,.mb-row span,summary')){
   if(!n.getClientRects().length)continue;const bounds=n.getBoundingClientRect(),walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let t;
   while((t=walker.nextNode()))for(const match of t.textContent.matchAll(/\S+/g)){words++;const r=document.createRange();r.setStart(t,match.index);r.setEnd(t,match.index+match[0].length);for(const b of r.getClientRects())if(b.width&&(b.left<bounds.left-2||b.right>bounds.right+2))failures.push({text:match[0],left:b.left,right:b.right,bounds:{left:bounds.left,right:bounds.right}});}
  }
  return {words,failures,table:root.querySelector('.mb-table')?.getBoundingClientRect().toJSON()||null};
 });assert(readable.words>20);assert.deepEqual(readable.failures,[],'all mana prose and table text stays readable inside its own column');
 await panel.screenshot({path:artifact(`${f.kind}-${theme}-${width}-panel.png`),animations:'disabled'});
 if(width===320||width===1440)await page.screenshot({path:artifact(`${f.kind}-${theme}-${width}-viewport.png`),animations:'disabled'});
 return {theme,width,geometry,readable};
}
try{
 for(const f of cases){let app;const result={kind:f.kind,layouts:[],status:'running'};checks.push(result);
  try{
   const opened=await openFixture(f);app=opened.app;const {page}=app,before=opened.before,inventory=await inventorySnapshot(page);
   await openReview(page,f);await closeSheet(page);await openReview(page,f);
   if(f.warning){await page.locator('#sheetBody [data-act="deckTab"][data-id="engine"]').filter({hasText:'See mana details'}).click();await page.waitForFunction(id=>location.hash===`#deck/${id}/engine`&&!document.querySelector('#sheet').open,f.deck.id);}
   else{await closeSheet(page);await page.locator('#content nav.tabs [data-act="deckTab"][data-id="engine"]').click();}
   await page.locator('.deck-body[data-tab="engine"]').waitFor();const proof=await assertMana(page,f);result.manaText=proof.text;result.countedCards=proof.counted;
   for(const theme of ['dark',...(['hybrid','blue'].includes(f.kind)?['light']:[])]){
    await page.evaluate(async theme=>(await import('/settings-theme.js')).applyTheme(theme,{persist:false}),theme);
    for(const width of WIDTHS){result.layouts.push(await layout(page,f,theme,width,proof.panel));
     // Actual review action is reopened at each width, not injected HTML.
     const warning=await openReview(page,f);await noOverflow(page,'#sheetBody',`${f.kind} ${theme} ${width} review`,true);
     if(f.warning){await warning.scrollIntoViewIfNeeded();await warning.screenshot({path:artifact(`${f.kind}-${theme}-${width}-warning.png`),animations:'disabled'});}
     await closeSheet(page);assert.equal(await sensitive(page),before,'review/Power/disclosure/theme/resize never writes the deck or owned data');
    }
   }
   assert.equal(await inventorySnapshot(page),inventory);assert.equal(await sensitive(page),before);app.health();assert.equal(app.rulesRequests.length,0);assert(!app.requests.some(x=>/\/(?:api\/ai|functions\/v1\/ai)/.test(x)),'no AI endpoint is called');
   result.status='passed';result.repeatedActualReview=true;result.actualWarningNavigation=f.warning;result.inventoryAndDurableStateUnchanged=true;result.requests=app.requests;result.externalWrites=0;result.forwardedExternalRequests=0;console.log(`PASS ${f.kind}: actual review and mana panel, all four widths, payment evidence, no save/AI/write.`);
  }catch(error){result.status='failed';result.error=String(error.stack||error);failures.push({kind:f.kind,error:result.error});if(app){result.requests=app.requests;await app.page.screenshot({path:artifact(f.kind+'-failure.png'),fullPage:true,animations:'disabled'}).catch(()=>{});}}
  finally{if(app){try{app.health();}catch(error){result.status='failed';failures.push({kind:f.kind,cleanup:true,error:String(error.stack||error)});}try{await app.context.close();}catch(error){result.status='failed';failures.push({kind:f.kind,cleanup:true,error:String(error.stack||error)});}}}
 }
}finally{
 for(const [kind,close] of [['browser',()=>browser.close()],['server',()=>server.close()]])try{await close();}catch(error){failures.push({kind,cleanup:true,error:String(error.stack||error)});}
 await mkdir(RESULTS,{recursive:true});await writeFile(artifact('browser.json'),JSON.stringify({generatedAt:new Date().toISOString(),evidence:EVIDENCE,status:failures.length?'failed':'passed',checks,failures},null,2));
}
assert.deepEqual(failures,[],'Every isolated mana UI scenario and safety guard must pass; no scenario is waived.');
