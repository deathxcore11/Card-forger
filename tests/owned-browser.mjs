import {POKEMON_VARIANT_SCHEMA} from '../pokemon-variant-options.js';
// Synthetic ownership fixtures. --validate-fixtures never imports Playwright or
// starts a server/browser; real gesture and decoded-image checks run in hosted CI.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {artworkSources} from '../artwork.js';
import {magicArtworkSources} from '../ui.js';
import {entryPrice,needsCardRefresh} from '../tcg.js';
import {lotPrice} from '../insights.js';
import {cardKey} from '../core.js';
import {valueHistoryModel,valueHistoryChart} from '../value-page.js';
import {recordValueObservation} from '../value-history.js';
import {homeValueCoverage} from '../home-ui.js';
import {adoptOwnedGame,validateOwnedGameAdoption} from './owned-navigation-fixture.mjs';
const GAMES=['mtg','ptcg','ygo'];
const SVG='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" rx="25" fill="#547ca0"/><text x="30" y="110" fill="white" font-size="36">SYNTHETIC OWNERSHIP FIXTURE</text><text x="60" y="180" fill="white" font-size="40">Owned test card</text></svg>';
function ownedFixture(g){
 const img=`https://owned-fixtures.invalid/${g}/test-owned.svg`,now=new Date().toISOString();
 const common={id:'test-owned',name:'Owned test card',image:img,imageLarge:img,prices:{usd:100},fetchedAt:now,checkedAt:now,brief:false};
 const card=g==='mtg'?{...common,set:'tst',set_name:'Test',collector_number:'1',type_line:'Creature',oracle_text:'Draw a card.',legalities:{},finishes:['nonfoil'],image_uris:{normal:img,small:img,art_crop:img}}:{...common,game:g,category:g==='ptcg'?'Pokemon':undefined,typeLine:g==='ptcg'?'Pokémon · Basic':'Normal Monster',type:g==='ygo'?'Normal Monster':undefined,stage:'Basic',hp:120,prize:1,set:{id:'tst',name:'Test',number:'1',total:100},stats:[],variants:[{key:'normal',label:'Normal',usd:100}],attacks:[],abilities:[],variantSchema:POKEMON_VARIANT_SCHEMA,priceFallbackSchema:3,artSchema:1,printPriceSchema:1,sets:[]};
 const lots=[{id:'owned-nm',name:card.name,cardId:card.id,key:'id:'+card.id,qty:2,condition:'Near Mint',finish:'nonfoil',variant:g==='ptcg'?'normal':'',addedAt:now},{id:'owned-damaged',name:card.name,cardId:card.id,key:'id:'+card.id,qty:1,condition:'Damaged',finish:'nonfoil',variant:g==='ptcg'?'normal':'',addedAt:now}];
 if(g==='mtg')for(const lot of lots)Object.assign(lot,{printingVerified:true,printingId:card.id,set:card.set,collectorNumber:card.collector_number});
 const valueHistory=[{date:new Date(Date.now()-86400000).toISOString().slice(0,10),total:300,copies:3,unpriced:0,currency:'USD',basis:'exact-owned-v1'}];
 return {card,lots,valueHistory};
}
const lotIdentity=lots=>lots.map(({id,name,cardId,key,qty,condition,finish,variant,addedAt})=>({id,name,cardId,key,qty,condition,finish,variant,addedAt}));
for(const g of GAMES){
 const {card,lots,valueHistory}=ownedFixture(g),before=structuredClone(card);
 for(const large of [false,true])assert.equal(artworkSources(card,large)[0],card.image,`${g}: the supplied exact HTTPS source must reach the card and zoom`);
 const old='data:image/svg+xml,'+encodeURIComponent(SVG),invalid={...card,image:old,imageLarge:old,image_uris:{normal:old,small:old,art_crop:old}};
 assert.ok(!artworkSources(invalid,true).includes(old),`${g}: do not re-enable the invalid data-URL fixture`);
 if(g==='mtg')assert.deepEqual(magicArtworkSources(card),[card.image]);
 else assert.equal(needsCardRefresh(g,card,true),false,`${g}: fixture matches the current full-card/printing schemas`);
 const price=lot=>g==='mtg'?lotPrice(lot,{[cardKey(card.name)]:card},{[card.id]:card}):entryPrice(card,lot);
 assert.deepEqual(lots.map(price),[100,null],`${g}: reference price cannot price the damaged lot`);
 const saved=[lots[0],{...lots[1],manualValue:15,manualValueCondition:'Damaged'}];
 assert.deepEqual(saved.map(price),[100,15]);
 const total=saved.reduce((total,lot)=>total+price(lot)*lot.qty,0);assert.equal(total,215);
 const coverage=homeValueCoverage({total,copies:3,unpriced:0});assert.deepEqual(coverage,{unpriced:0,currency:'USD',basis:'exact-owned-v1'});
 const current=recordValueObservation(valueHistory,total,3,coverage),model=valueHistoryModel(current);
 assert.deepEqual(model.points.map(point=>point.status),['complete','complete'],`${g}: synthetic yesterday and current values are explicitly comparable`);assert.equal(model.change.delta,-85);assert.equal(model.change.direction,'down');
 const first=recordValueObservation([],total,3,{unpriced:0,currency:'USD',basis:'exact-owned-v1'});assert.equal(first.length,1);assert.equal(valueHistoryModel(first).change,null);assert.match(valueHistoryChart(first),/Your first saved snapshot\. No earlier values have been estimated\./);
 assert.deepEqual(card,before,`${g}: artwork/valuation cannot mutate the fixture's printing or prices`);
}
await validateOwnedGameAdoption(ownedFixture,lotIdentity);
if(process.argv.includes('--validate-fixtures')){console.log('PASS: all three exact HTTPS ownership artwork fixtures, current card schemas, real-controller fixture adoption, unchanged identities and condition-bound $215 value, comparable −$85 history and truthful first snapshot; no server/browser/provider request.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Ownership browser tests are hosted-only. Use --validate-fixtures for local pure validation.');
const {createServer}=await import('node:http');
const {chromium,devices}=await import('playwright');
const root=process.cwd(),server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');const f=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(f)]||'application/octet-stream');let body=await readFile(f);if(f.endsWith("/config.js"))body=Buffer.from(body.toString().replace(/key:\s*"[^"]*"/,'key: ""'));res.end(body);}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{for(const g of GAMES){
 const fixture=ownedFixture(g);
 const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{
  const url=r.request().url();
  // Only the exact source declared by this game's fixture receives synthetic
  // pixels. No real card provider, private image, or live price is requested.
  if(url===fixture.card.image)return r.fulfill({status:200,contentType:'image/svg+xml',body:SVG});
  return url.startsWith(base+'/')?r.continue():r.abort();
 });
 await page.addInitScript(()=>localStorage.setItem('cardstashy-tour-v1','done'));
 await page.goto(base+'/#home');await page.locator('#app.ready').waitFor();
 await page.evaluate(async({g,card,lots,valueHistory})=>{
  const {S,blank,STORAGE,CATALOG_RECORD}=await import('/store.js'),{cache,TCG_CACHE}=await import('/tcg.js'),{cardKey}=await import('/core.js'),{writeRecord}=await import('/storage.js');
  // Keep one stable reference to the live store for the later adoption checks.
  window.__ownedTestState=S;
  S.state=blank();S.state.tcg={ptcg:{collection:[],decks:[],wishlist:[],valueHistory:[]},ygo:{collection:[],decks:[],wishlist:[],valueHistory:[]}};
  // This is explicit synthetic comparable coverage, not unverifiable legacy history.
  (g==='mtg'?S.state:S.state.tcg[g]).valueHistory=valueHistory;
  if(g==='mtg'){S.catalog[cardKey(card.name)]=card;S.state.printings[card.id]=card;}else cache[g][card.id]=card;
  (g==='mtg'?S.state:S.state.tcg[g]).collection=lots;await writeRecord(STORAGE,S.state);await writeRecord(CATALOG_RECORD,S.catalog);await writeRecord(TCG_CACHE,cache);
 },{g,...fixture});
 // Synthetic data setup does not bypass the controller's active game entry.
 await adoptOwnedGame(page,g);
 await page.getByRole('navigation',{name:'Main',exact:true}).getByRole('button',{name:'Collection',exact:true}).click();await page.getByRole('heading',{name:'Collection',exact:true}).waitFor();
 const tile=page.locator('[data-entry="owned-nm"].lot-art').first();await tile.waitFor();
 await tile.click({button:'right'});const owned=page.getByRole('region',{name:'Owned copies',exact:true});
 // section has an accessible label; Chromium exposes it as a region.
 await owned.waitFor();assert.equal(await page.locator('[data-act="quickOwn"]').count(),1);assert(await page.locator('[data-act="quickWish"]').isVisible());
 await page.getByRole('button',{name:'One more owned copy',exact:true}).click();await page.waitForFunction(g=>{const S=window.__ownedTestState;return(g==='mtg'?S.state:S.state.tcg[g]).collection.find(e=>e.id==='owned-nm').qty===3;},g);
 await page.getByRole('button',{name:'One fewer owned copy',exact:true}).click();await page.waitForFunction(g=>{const S=window.__ownedTestState;return(g==='mtg'?S.state:S.state.tcg[g]).collection.find(e=>e.id==='owned-nm').qty===2;},g);
 await page.getByRole('combobox',{name:'Saved lot to change',exact:true}).click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:/Damaged/}).click();
 await page.getByText('Value for this copy',{exact:true}).click();await page.getByLabel('Your value per copy (USD)',{exact:true}).fill('15');await page.getByRole('button',{name:'Save value',exact:true}).click();
 await page.waitForFunction(g=>{const S=window.__ownedTestState;return(g==='mtg'?S.state:S.state.tcg[g]).collection.find(e=>e.id==='owned-damaged').manualValue===15;},g);
 assert.equal(await page.locator('.brand .mark .stashy-logo').count(),1,'save status cannot replace app logo');
 const saved=await page.evaluate(async g=>{const {S}=await import('/store.js');return(g==='mtg'?S.state:S.state.tcg[g]).collection;},g);assert.equal(saved.length,2);assert.equal(saved[0].qty,2);assert.equal(saved[1].qty,1);assert.equal(saved[1].condition,'Damaged');assert.equal(saved[1].manualValueCondition,'Damaged');assert.deepEqual(lotIdentity(saved),lotIdentity(fixture.lots),'Artwork and menu interactions preserve exact lot identity, quantities and conditions');
 await page.locator('#sheet').getByRole('button',{name:'Close',exact:true}).click();await tile.click();
 await page.locator('[data-owned-group="owned-nm"]:visible').waitFor();assert.equal(await page.locator('.owned-group:visible').count(),2,'Saved conditions get separate controls');
 assert.equal(await page.locator('#sheet [data-act="'+(g==='mtg'?'own':'tOwn')+'"]:visible').count(),1,'Add another condition or printing is always available');
 const qty=async id=>page.evaluate(({g,id})=>{const S=window.__ownedTestState;return(g==='mtg'?S.state:S.state.tcg[g]).collection.find(e=>e.id===id)?.qty||0;},{g,id});
 await page.locator('[data-act="cardOwnedQty"][data-lot="owned-nm"][data-delta="1"]:visible').click();await page.waitForFunction(g=>{const S=window.__ownedTestState;return(g==='mtg'?S.state:S.state.tcg[g]).collection.find(e=>e.id==='owned-nm').qty===3;},g);assert.equal(await qty('owned-damaged'),1);
 await page.locator('[data-act="cardOwnedQty"][data-lot="owned-nm"][data-delta="-1"]:visible').click();await page.waitForFunction(g=>{const S=window.__ownedTestState;return(g==='mtg'?S.state:S.state.tcg[g]).collection.find(e=>e.id==='owned-nm').qty===2;},g);
 await page.locator('[data-act="cardOwnedQty"][data-lot="owned-damaged"][data-delta="-1"]:visible').click();await page.locator('[data-owned-group="owned-damaged"]:visible').waitFor({state:'detached'});assert.equal(await qty('owned-nm'),2);
 await page.locator('#toast [data-act="undo"]').click();await page.waitForFunction(g=>{const S=window.__ownedTestState;return(g==='mtg'?S.state:S.state.tcg[g]).collection.some(e=>e.id==='owned-damaged');},g);console.log('Undo restored',g,await page.evaluate(()=>({ctx:window.__ownedTestState.ui.sheetCtx,open:document.querySelector('#sheet').open,groups:[...document.querySelectorAll('[data-owned-group]')].map(n=>n.dataset.ownedGroup),toast:document.querySelector('#toast')?.textContent})));await page.locator('[data-owned-group="owned-damaged"]:visible').waitFor();assert.equal(await qty('owned-damaged'),1);assert.equal(await qty('owned-nm'),2);
 if(g==='ptcg'){
  await page.locator('#sheet [data-act="cardTab"][data-tab="versions"]').click();
  assert.equal(await page.locator('.owned-group:visible').count(),2,'Versions preserves independent saved conditions');
  await page.locator('[data-act="cardOwnedQty"][data-lot="owned-damaged"][data-delta="1"]:visible').click();
  await page.waitForFunction(()=>window.__ownedTestState.state.tcg.ptcg.collection.find(e=>e.id==='owned-damaged').qty===2);assert.equal(await qty('owned-nm'),2);
  await page.locator('[data-act="cardOwnedQty"][data-lot="owned-damaged"][data-delta="-1"]:visible').click();
  await page.waitForFunction(()=>window.__ownedTestState.state.tcg.ptcg.collection.find(e=>e.id==='owned-damaged').qty===1);assert.equal(await qty('owned-nm'),2);
  await page.locator('#sheet [data-act="cardTab"][data-tab="overview"]').click();
 }
 await page.locator('#sheet .cd-zoom[data-hold-card]').waitFor();
 // Do not mistake an available button or placeholder for the actual card scan.
 // Query the current sheet each time because its background refresh replaces DOM.
 for(const selector of ['#sheet .cd-zoom img.card-img','dialog.zoom .zoom-img[data-hold-card]']){
  await page.waitForFunction(({selector,src})=>{const image=document.querySelector(selector);return image?.isConnected&&image.complete&&image.naturalWidth>0&&image.naturalHeight>0&&!image.hidden&&image.currentSrc===src;},{selector,src:fixture.card.image});
  assert(await page.locator(selector).isVisible(),`${g}: decoded exact card image is visible`);
  assert.equal(await page.locator(selector).evaluate(image=>image.currentSrc),fixture.card.image);
  if(selector.startsWith('#sheet'))await page.locator('#sheet .cd-zoom').click();
 }
 assert.equal(await page.locator('dialog.zoom .zoom-img').getAttribute('data-entry'),'owned-nm','Zoom retains the selected saved lot');
 assert.equal(await page.locator('dialog.zoom .zoom-img').getAttribute('data-name'),fixture.card.name,'Zoom retains the card identity');
 await page.locator('dialog.zoom .zoom-img').click({button:'right'});await owned.waitFor();assert.equal(await page.locator('dialog.zoom[open]').count(),0,'full image hold brings its ownership menu forward');assert.equal(await page.locator('[data-act="quickOwn"]').count(),1);
 const afterZoom=await page.evaluate(async g=>{const {S}=await import('/store.js'),{cache}=await import('/tcg.js'),{cardKey}=await import('/core.js');return{lots:(g==='mtg'?S.state:S.state.tcg[g]).collection,card:g==='mtg'?S.catalog[cardKey('Owned test card')]:cache[g]['test-owned']};},g);
 assert.deepEqual(afterZoom.lots,saved,'Opening/holding the decoded image never mutates saved lots');assert.equal(afterZoom.card.id,fixture.card.id);assert.equal(afterZoom.card.name,fixture.card.name);assert.deepEqual(afterZoom.card.set,fixture.card.set,'Artwork never substitutes another set/printing');assert.equal(afterZoom.card.collector_number,fixture.card.collector_number);assert.deepEqual(afterZoom.card.variants,fixture.card.variants);assert.deepEqual(afterZoom.card.prices,fixture.card.prices,'Artwork and ownership do not alter source prices');
 await page.reload();await page.getByRole('heading',{name:'Collection',exact:true}).waitFor();const reloaded=await page.evaluate(async g=>{const {S}=await import('/store.js');return(g==='mtg'?S.state:S.state.tcg[g]).collection;},g);assert.equal(reloaded[1].manualValue,15);assert.equal(reloaded[0].qty,2);assert.deepEqual(lotIdentity(reloaded),lotIdentity(fixture.lots),'Reload preserves every original lot identity');await page.getByRole('tab',{name:'Value',exact:true}).click();await page.locator('.value-chart-change.down').waitFor();assert.match(await page.locator('.value-chart-change').innerText(),/−\$85\.00/);assert.equal(await page.locator('[data-value-amount]').innerText(),'$215.00');
 const observed=await page.evaluate(async g=>{const {S}=await import('/store.js');return {history:(g==='mtg'?S.state:S.state.tcg[g]).valueHistory,today:new Date().toISOString().slice(0,10)};},g);
 assert.deepEqual(observed.history.find(point=>point.date===fixture.valueHistory[0].date),fixture.valueHistory[0],'explicit previous $300 observation is preserved');assert.deepEqual(observed.history.find(point=>point.date===observed.today),{date:observed.today,total:215,copies:3,unpriced:0,currency:'USD',basis:'exact-owned-v1'},'actual current $215 observation uses the same verified coverage basis');
 assert(await page.getByRole('img',{name:'Collection value over time, recorded USD snapshots',exact:true}).isVisible());await page.evaluate(async g=>{const {S}=await import('/store.js');const side=g==='mtg'?S.state:S.state.tcg[g];side.valueHistory=[];const {recordValueObservation}=await import('/value-history.js');side.valueHistory=recordValueObservation(side.valueHistory,215,3,{unpriced:0,currency:'USD',basis:'exact-owned-v1'});},g);
 await page.getByRole('tab',{name:'Cards',exact:true}).click();await page.getByRole('tab',{name:'Value',exact:true}).click();await page.getByText('Your first saved snapshot. No earlier values have been estimated.',{exact:false}).waitFor();assert.equal(await page.locator('.value-chart-point').count(),1,'first-day graph has exactly one recorded observation');assert.equal(await page.locator('.value-chart-line').count(),0,'first-day graph has no invented past segment');assert.equal(await page.locator('.value-chart-change').count(),0,'first-day graph makes no comparison claim');assert(await page.getByRole('img',{name:'Collection value over time, recorded USD snapshots',exact:true}).isVisible(),'a first-day collection still has its own graph');
 await page.getByRole('tab',{name:'Cards',exact:true}).click();await tile.click();
 // Background card/history refresh replaces the sheet DOM. Re-query its current
 // connected tabs and check visibility, sticky position and one row atomically.
 await page.waitForFunction(()=>{
  const n=document.querySelector('#sheet[open] .cs-tabs'),button=n?.querySelector('button');
  if(!n?.isConnected||!button)return false;
  const css=getComputedStyle(n),rect=n.getBoundingClientRect();
  return css.position==='sticky'&&css.display!=='none'&&css.visibility==='visible'&&Number(css.opacity)>0
   &&rect.width>0&&rect.height>0&&button.clientHeight>0&&n.clientHeight<=button.clientHeight+22;
 });
 await page.locator(g==='mtg'?'#sheet [data-act="own"]':'#sheet [data-act="tOwn"]').first().click();const preview=page.getByRole('status',{name:'Selected condition value',exact:true});await preview.waitFor();assert.match(await preview.innerText(),/\$100.00/);
 await page.getByLabel('Condition',{exact:true}).click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:'Lightly Played',exact:true}).click();await preview.getByText('Condition lookup unavailable',{exact:true}).waitFor();assert.match(await preview.innerText(),/Lightly Played[\s\S]*Condition lookup unavailable/);
 await page.locator('#lotManualValue').fill('60');assert.match(await preview.innerText(),/\$60.00/);
 await page.getByLabel('Condition',{exact:true}).click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:'Damaged',exact:true}).click();await preview.getByText('Condition lookup unavailable',{exact:true}).waitFor();assert.match(await preview.innerText(),/Damaged[\s\S]*Condition lookup unavailable/);assert.equal(await page.locator('#lotManualValue').inputValue(),'');
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${g} owned tile +/−, saved-lot selection, independent wishlist, condition-bound value, full-image hold and reload persistence; branded header survives saving.`);await context.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));}
