// Actual-app Power release QA. Browser execution is hosted-only after explicit
// publication authorization. --validate-fixtures is local and never starts a
// browser, HTTP listener, provider call, paid AI request, or remote upload.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {startServer,openSearchApp,inventorySnapshot,noOverflow,ISO} from './search-fixtures.mjs';
import {cardKey,sumQty} from '../core.js';
import {S,blank} from '../store.js';
import {mtgPower,shownPower} from '../power.js';
import {prepareMtgDeck} from '../ai-deck-builder.js';
import {reviewPayload} from '../ai-review.js';
import {cleanDeck,validateReview} from '../ai-review-route.js';
import {completionPlan} from '../planner.js';

const commanderSource=JSON.parse(await readFile(new URL('../test-fixtures/commander-context.json',import.meta.url)));
const standardSource=JSON.parse(await readFile(new URL('../test-fixtures/standard-effect-cards.json',import.meta.url)));
const publicBench=JSON.parse(gunzipSync(await readFile(new URL('../test-fixtures/power-bench.json.gz',import.meta.url))));
const publicRal=publicBench.mtg.meta.EDH.decks.find(d=>d.name.startsWith('Ral,'));
const ralRows=[...publicRal.main,...publicRal.commanders].map(({name,qty})=>({name,qty}));
const EVIDENCE='Actual app with independent synthetic deck arrangements, frozen public card text, and the pre-existing public Ral tournament reference projected to card names/quantities only (no player/event/account metadata). Prices, IDs, set metadata, artwork and AI responses are synthetic. No real account, collection, saved user deck, private photo or provider credential is used. External requests fail closed. This checks UI integration and deterministic contracts, not live AI quality or calibrated competitive strength.';
const syntheticCard=(c,i)=>({...structuredClone(c),id:`power-fixture-${i}`,oracle_id:`power-fixture-oracle-${i}`,set:'fxa',set_name:'Synthetic Power QA',collector_number:String(i+1),full:true,checkedAt:ISO,prices:{usd:'.25',usd_foil:null,usd_etched:null},image_uris:{normal:`https://search-fixtures.invalid/power-${i}.svg`,small:`https://search-fixtures.invalid/power-${i}.svg`,art_crop:`https://search-fixtures.invalid/power-${i}.svg`},card_faces:c.card_faces?.map((f,j)=>({...f,image_uris:{normal:`https://search-fixtures.invalid/power-${i}-${j}.svg`,art_crop:`https://search-fixtures.invalid/power-${i}-${j}.svg`}}))});
// These source entries intentionally retain only effect evidence. Their white
// identity and prices here are explicit synthetic normalization, not live data.
const standardCards=standardSource.cards.map((c,i)=>syntheticCard({...c,color_identity:['W'],colors:/Land/.test(c.type_line)?[]:['W']},1000+i));
const ralCards=ralRows.map((r,i)=>syntheticCard(publicBench.mtg.cards[cardKey(r.name)],2000+i));
const catalog=Object.fromEntries([...ralCards,...Object.values(commanderSource.catalog).map(syntheticCard),...standardCards].map(c=>[cardKey(c.name),c]));
const complete={...structuredClone(commanderSource.decks.knights),id:'power-complete-fixture',name:'Synthetic complete Commander',budget:null};
const incomplete={...structuredClone(complete),id:'power-incomplete-fixture',name:'Synthetic 64-card Commander draft',cards:complete.cards.filter(r=>r.name!=='Plains')};
const standard={...structuredClone(standardSource.syntheticDeck),id:'power-standard-fixture',name:'Synthetic Standard cost evidence',goal:'fun',requestedStyle:'white fun',budget:null,side:[]};
// Public source is already frozen in the benchmark, not a user-supplied deck.
// Do not load its meta context: this tests analysis without reference support.
const unmodeled={id:'power-public-unmodeled-fixture',name:'Public Ral reference · route review',format:'Commander',commander:publicRal.commanders[0].name,cards:ralRows,budget:null};
const decks=[complete,incomplete,standard,unmodeled];
const ideaSeed={id:'power-idea-fixture',name:'Synthetic generated Commander',format:'Commander',commander:complete.commander,strategy:'Auto',budget:null,cards:[{name:complete.commander,qty:1}],versions:[]};
const ideaCatalog=mode=>Object.fromEntries(complete.cards.filter(r=>mode!=='missing'||r.name!=='Plains').map(r=>{
 const c=structuredClone(catalog[cardKey(r.name)]);if(mode==='unpriced'&&r.name==='Plains')c.prices={usd:null,usd_foil:null,usd_etched:null};return [cardKey(c.name),c];
}));
const proposal={game:'mtg',format:'Standard',style:'white fun',goal:'fun',seed:'Hero in Training',commander:'',budget:0,budget_basis:'total',required_cards:['Hero in Training'],excluded_cards:[],colors:['W'],avoid_infinite:false,candidate_cards:[]};
const question='Build me a fun mono-white Standard deck. Build around "Hero in Training" with no budget cap.';
const response=()=>({headline:'Review the printed costs before sequencing.',priority:'',identity:{plan:'A synthetic conditional creature plan.',howItWins:'A route could work if its setup and damage are established; the outcome is unverified.',winCards:[],winEvidence:[],engineCards:[]},explain:[],beyond:[],pilot:{hand:null,lines:[]},pressure:{scenarios:[]},improve:[],tests:[]});

async function validateFixtures(){
 assert.match(commanderSource.scope,/not the user deck/);assert.match(standardSource.source,/not a user deck/);
 assert.equal(sumQty(complete.cards),100);assert.equal(sumQty(incomplete.cards),64);assert.equal(sumQty(standard.cards),60);
 const previousState=S.state,previousCatalog=S.catalog;S.state=blank();S.catalog=catalog;
 try{
  for(const deck of [complete,standard])assert.equal(mtgPower(deck).readiness.eligible,true,deck.name+' is eligible in frozen fixture');
  const partial=mtgPower(incomplete);assert.equal(partial.readiness.missingCards,36);assert.equal(shownPower(partial),null);
  const availability=mtgPower(complete).strategic.dependence;
  assert.equal(availability.withCommander.library,99);assert.equal(availability.withoutCommander.library,99,'commander absence retains the same declared library');
  assert.deepEqual(availability.recast[0].scenarios.map(x=>x.genericTax),[0,2,4]);assert.deepEqual(availability.recast[0].scenarios.map(x=>x.normalMana),[4,6,8]);
  assert(availability.support.independent.some(x=>x.name==='Barkform Harvester'));assert(availability.support.mixed.some(x=>x.name==='Flawless Maneuver'));
  const unknownRoute=mtgPower(unmodeled);assert.equal(sumQty(unmodeled.cards),100);assert.equal(unknownRoute.readiness.eligible,true);assert.equal(unknownRoute.strategic.status,'primary-route-unmapped');assert.equal(shownPower(unknownRoute),null);assert(unknownRoute.strategic.primaryRouteCoverage.missingCapabilities.length);
  const payload=cleanDeck(reviewPayload('mtg',standard,n=>catalog[cardKey(n)],mtgPower(standard)));
  const news=payload.criteria.constructed.cards.find(c=>c.name==='Action News Crew');assert.equal(news.flow.effects[0].activationMana,6);assert.equal(news.flow.effects[0].mode,'alternative');
  validateReview(response(),payload);
  let providerCalls=0;
  const built=await prepareMtgDeck(proposal,{resolve:async n=>structuredClone(catalog[cardKey(n)]),api:async()=>{providerCalls++;return {data:structuredClone(standardCards)};},cacheCard:()=>{},inv:()=>({available:0})});
  assert.equal(built.draft.goal,'fun');assert.equal(built.draft.budget,Infinity);assert.equal(built.draft.total,60);assert.equal(built.draft.legalChecked,true);assert.equal(built.draft.withinBudget,true);assert(providerCalls>0);
  assert.match(built.draft.warnings.join(' '),/fun is subjective/);assert(built.draft.purchaseEstimate>0,'basic lands and every card retain synthetic nonzero prices');
  for(const [mode,budget,total] of [['missing',Infinity,64],['priced',Infinity,100],['unpriced',Infinity,100],['unpriced',25,64]]){
   const plan=completionPlan(ideaSeed,[],[],ideaCatalog(mode),{budget,landTarget:36,preferOwned:true,simple:false});assert.equal(sumQty(plan.deck.cards),total,`${mode}/${budget}: real planner fixture count`);
   if(mode==='unpriced'&&budget===Infinity){assert.equal(plan.cost,null);assert.equal(plan.diagnostics.unpricedPurchaseCopies,36);}
   if(mode==='priced'){assert.equal(plan.diagnostics.lands,36);assert.equal(plan.cost,25);}
  }
 }finally{S.state=previousState;S.catalog=previousCatalog;}
 console.log('PASS: public/synthetic Power hosted fixtures; 100/64 Commander eligibility, Standard printed costs, fun/no-cap build and nonzero basic prices. No browser/server/live request started.');
}
await validateFixtures();
if(process.argv.includes('--validate-fixtures'))process.exit(0);
assert.equal(process.env.GITHUB_ACTIONS,'true','Power browser QA is hosted-only after approval; use --validate-fixtures locally.');

const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch({headless:true}),out=new URL('../test-results/',import.meta.url);
const checks=[],screenshots=[],coachPayloads=[],askPayloads=[],timings=[];
let app,askHold=null,coachCalls=0,askCalls=0,ideaMode=null;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function capture(page,name,scope){await mkdir(out,{recursive:true});await frames(page);const file=`power-release-${name}.png`,options={path:new URL(file,out).pathname,animations:'disabled'};if(scope)await page.locator(scope).screenshot(options);else await page.screenshot({...options,fullPage:true});screenshots.push(file);}
async function gotoDeck(page,id){await page.evaluate(id=>{location.hash='#deck/'+id+'/engine';},id);await page.locator('.score-panel.power').waitFor();await page.waitForFunction(id=>window.__uiTestState.ui.deckId===id,id);}
async function openAsk(page){await page.evaluate(()=>{location.hash='#search';});await page.locator('[data-act="askOpen"]').first().click();await page.locator('.ask-dialog[open]').waitFor();}
try{
 app=await openSearchApp(browser,server.base,{game:'mtg',width:390,height:1000,evidenceLabel:'power-release',prepareFixtures:f=>{
  f.state.decks=structuredClone(decks);f.state.activeDeck=incomplete.id;f.state.collection=[];
  f.catalog={...f.catalog,...structuredClone(catalog)};f.storage['cardforge-catalog-v1']=f.catalog;
 }});
 const {page}=app,initial=await inventorySnapshot(page);
 // Explicit local response handlers override the shared default that rejects
 // all mutations/AI calls. They never forward a request to any provider.
 await page.route('https://api.scryfall.com/**',async route=>{
  const u=new URL(route.request().url());
  // A successful explicit synthetic save may schedule the app's read-only
  // enrichment POST for other fixture decks. Keep missing data missing; never
  // forward it or silently refill this scenario's absent Plains.
  if(ideaMode&&u.pathname==='/cards/collection')return route.fulfill({contentType:'application/json',body:JSON.stringify({object:'list',data:[],not_found:[]})});
  if(ideaMode&&['/cards/search','/cards/named'].includes(u.pathname)){
   const pool=ideaCatalog(ideaMode),name=u.searchParams.get('exact')||u.searchParams.get('fuzzy')||'',isBasic=/t:basic/.test(u.searchParams.get('q')||'');
   const data=isBasic?(pool.plains?.prices?.usd?[pool.plains]:[]):Object.values(pool).filter(c=>!/^Basic\b/.test(c.type_line||''));
   return route.fulfill({status:u.pathname==='/cards/named'&&!pool[cardKey(name)]?404:200,contentType:'application/json',body:JSON.stringify(u.pathname==='/cards/named'?(pool[cardKey(name)]||{object:'error',details:'Synthetic basic identity unavailable'}):{object:'list',data,has_more:false,total_cards:data.length})});
  }
  if(u.pathname==='/cards/search')return route.fulfill({contentType:'application/json',body:JSON.stringify({object:'list',data:standardCards,has_more:false,total_cards:standardCards.length})});
  if(u.pathname==='/cards/named'){const c=catalog[cardKey(u.searchParams.get('exact')||u.searchParams.get('fuzzy')||'')];if(c)return route.fulfill({contentType:'application/json',body:JSON.stringify(c)});}
  return route.fallback();
 });
 await page.route('**/api/ai/deck-review',async route=>{
  coachCalls++;const payload=cleanDeck(route.request().postDataJSON());coachPayloads.push(payload);const report=validateReview(response(),payload);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(report)});
 });
 await page.route('**/api/ai/ask',async route=>{
  askCalls++;askPayloads.push(route.request().postDataJSON());const gate=askHold;gate?.started.resolve();if(gate)await gate.release.promise;
  try{await route.fulfill({contentType:'application/json',body:JSON.stringify({calls:[{type:'function_call',call_id:'power-build-'+askCalls,name:'build_deck',arguments:JSON.stringify(proposal)}]})});}
  catch(e){if(!/abort|closed|cancel|handled/i.test(String(e)))throw e;}finally{gate?.settled.resolve();}
 });
 await gotoDeck(page,incomplete.id);
 assert.match(await page.locator('.deck-hero').innerText(),/64\/100/);assert.match(await page.locator('.deck-hero').innerText(),/power unavailable/i);
 assert.match(await page.locator('.score-panel.power').innerText(),/Finish the deck before rating Power/);
 assert.equal(coachCalls,0);assert.equal(askCalls,0,'ordinary Power navigation never calls AI');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});await noOverflow(page,'.score-panel.power','incomplete Power '+width);await capture(page,'incomplete-'+width);
  await gotoDeck(page,complete.id);assert.match(await page.locator('.score-panel.power').innerText(),/Commander Power estimate/);
  await noOverflow(page,'.score-panel.power','complete Power '+width);await capture(page,'complete-'+width);
  const availability=page.locator('.score-panel.power details.pw-plan-context');assert.equal(await availability.getAttribute('open'),null,'Commander availability is optional collapsed context');
  await availability.locator('summary').click();const text=await availability.innerText();
  assert.match(text,/first command-zone cast \{3\}\{W\}/);assert.match(text,/after one previous command-zone cast \{3\}\{W\} \+ \{2\}/);assert.match(text,/after two \{3\}\{W\} \+ \{4\}/);
  assert.match(text,/What still works without it/);assert.match(text,/Recognized independent functions/);assert.match(text,/Independent function plus commander-linked benefit/);assert.match(text,/not automatically penalized/);assert.match(text,/no automatic Power penalty, survival odds, removal frequency or winning-turn prediction/);
  await noOverflow(page,'.score-panel.power','expanded Commander availability '+width);await capture(page,'commander-availability-'+width,'.score-panel.power');
  await gotoDeck(page,unmodeled.id);const header=await page.locator('.deck-hero').innerText(),unmodeledPanel=await page.locator('.score-panel.power').innerText();
  assert.match(header,/100\/100/);assert.match(header,/power unavailable/i);assert.doesNotMatch(header,/Incomplete draft/);assert.match(unmodeledPanel,/Power estimate unavailable/);assert.doesNotMatch(unmodeledPanel,/Finish the deck/);
  const routeScope='.pw-weak:has(h3:text-is("What drives the Power estimate"))';assert.equal(await page.locator(routeScope).count(),1,'select the strategic route panel, not the separate structural section');
  const routePanel=await page.locator(routeScope).innerText();assert.match(routePanel,/Important storm \/ recursion route not assessed/);assert.match(routePanel,/Supported-route diagnostic \d+\/100 only, not overall Power/);
  await noOverflow(page,'.score-panel.power','complete unmodeled Power '+width);await noOverflow(page,routeScope,'unmodeled route warning '+width);
  assert.match(await page.locator('.mb-table').innerText(),/Mountain/);await noOverflow(page,'.mb-table','Power mana comparison '+width);await capture(page,'mana-comparison-'+width,'.panel:has(.mb-table)');
  await capture(page,'public-unmodeled-'+width);await gotoDeck(page,incomplete.id);
 }
 checks.push('Existing Power panel and deck header: 64/100 stays unavailable; complete Commander has explicitly provisional estimate; four responsive widths.');
 checks.push('Optional Commander availability opens in the existing Power panel at all four widths, with independent/mixed support and normal first/+2/+4 casting costs; no automatic score penalty, survival odds or winning-turn forecast.');
 checks.push('Pre-existing public Ral reference without meta support is complete/legal100 but overall Power unavailable; named storm/recursion model gap and diagnostic-only number are visible, with no incomplete-deck label.');
 await page.locator('[data-act="aiDeckReview"]').click();await page.locator('.ai-review-dialog .air-tabs').waitFor();
 assert.equal(coachPayloads.at(-1).power.score,null);assert.match(await page.locator('.ai-review-dialog').innerText(),/Power unavailable/);
 await page.locator('[data-ai-close]').click();assert.equal(await page.locator('.ai-review-dialog').count(),0);
 await page.locator('[data-act="aiDeckReview"]').click();await page.locator('.ai-review-dialog .air-tabs').waitFor();assert.equal(coachCalls,1,'cached coaching response has no duplicate request');await page.locator('[data-ai-close]').click();
 await gotoDeck(page,standard.id);await page.locator('[data-act="aiDeckReview"]').click();await page.locator('.ai-review-dialog .air-tabs').waitFor();
 const payload=coachPayloads.at(-1),news=payload.criteria.constructed.cards.find(c=>c.name==='Action News Crew');
 assert.equal(news.flow.effects[0].activationMana,6);assert.equal(news.flow.effects[0].mode,'alternative');assert.equal(payload.power.competitive,null);
 assert.match(await page.locator('.ai-review-dialog').innerText(),/Winning route not established|winning route is still unverified/);await capture(page,'standard-coach');await page.locator('[data-ai-close]').click();
 checks.push('Actual AI coach launcher serializes unavailable Commander and Standard printed six-mana alternative cost; cached reopen is request-free and claims remain limited.');
 const cacheCheck=await page.evaluate(async id=>{
  const {mtgPower}=await import('/power.js'),d=window.__uiTestState.state.decks.find(d=>d.id===id),first=mtgPower(d),start=performance.now();
  for(let i=0;i<20;i++)if(mtgPower({...d,cards:[...d.cards].reverse()})!==first)throw Error('Repeated render recomputed unchanged Power');
  return {sameObject:true,cachedCalls:20,milliseconds:performance.now()-start};
 },complete.id);timings.push(cacheCheck);
 checks.push('Browser gameplay cache preserves object identity over 20 row-order-only reads; observed timing recorded without a hardware-dependent performance guarantee.');
 await openAsk(page);await page.locator('.ask-input').fill(question);await page.locator('.ask-send').click();
 await page.locator('.ask-dialog [data-ask-show]').filter({hasText:'Review the deck draft'}).waitFor();
 assert.equal(askCalls,1,'ready draft ends after one proposal');await page.locator('.ask-dialog [data-ask-show]').filter({hasText:'Review the deck draft'}).click();
 await page.locator('#sheet[open] .tier').waitFor();const preview=await page.locator('#sheetBody').innerText();
 assert.match(preview,/60\/60/);assert.match(preview,/budget: unlimited/i);assert.match(preview,/fun is subjective/);assert.match(preview,/Includes basic lands/);assert.doesNotMatch(preview,/Requested whole-deck budget: \$25/);
 const draft=await page.evaluate(()=>window.__uiTestState.ui.build.results.Standard[0]);assert.equal(draft.goal,'fun');assert.equal(draft.goalVerified,false);assert(draft.cost>0);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody .tier','Standard goal review '+width);await capture(page,'goal-preview-'+width);}
 assert.equal(await inventorySnapshot(page),initial,'reviewing a built list never saves it');await page.locator('#sheetBody [data-act="closeSheet"]').first().click();
 checks.push('Actual Ask tool to existing deck-preview sheet: fun goal, unlimited cap, 60-card review, real synthetic basic prices, four widths, no autosave.');
 await openAsk(page);await page.locator('[data-ask-new]').click();askHold={started:deferred(),release:deferred(),settled:deferred()};
 await page.locator('.ask-input').fill(question);await page.locator('.ask-send').click();await askHold.started.promise;
 await page.locator('[data-ask-close]').click();askHold.release.resolve();await askHold.settled.promise;askHold=null;await frames(page);
 assert.equal(await page.locator('.ask-dialog[open]').count(),0);assert.equal(await page.locator('#sheet[open]').count(),0);assert.equal(await inventorySnapshot(page),initial);
 await openAsk(page);assert.equal(await page.locator('.ask-dialog [data-ask-show]').count(),0,'cancelled late build cannot create an action in the reopened conversation');await page.locator('[data-ask-close]').click();
 checks.push('Close cancels in-flight Ask; late synthetic build response creates no preview, action or saved mutation after reopen.');
 assert.deepEqual(await page.evaluate(()=>window.__fixtureSensitiveWrites),[],'all flows before explicit synthetic save leave durable inventory unchanged');
 // Keep the shared write guard intact. This additional log verifies every later
 // changed durable state is exactly one requested synthetic draft save, not a
 // broad exception for writes and not a reset that could hide an earlier write.
 await page.evaluate(()=>{
  const pick=s=>JSON.stringify({collection:s.collection,decks:s.decks,printings:s.printings,wishlist:s.wishlist,tcg:s.tcg,myPrices:s.myPrices,priceChoices:s.priceChoices});
  window.__powerSaveEvidence={baseline:JSON.parse(pick(window.__uiTestState.state)),writes:[]};
  const record=(raw,key,backend)=>{if(key!=='cardforge-v2')return;const after=typeof raw==='string'?JSON.parse(raw):raw;if(pick(after)!==JSON.stringify(window.__powerSaveEvidence.baseline))window.__powerSaveEvidence.writes.push({backend,state:JSON.parse(pick(after))});};
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){record(value,key,'indexedDB');return put.call(this,value,key);};
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){record(value,key,'localStorage');return set.call(this,key,value);};
 });
 async function openIdeaScenario(mode){
  ideaMode=mode;await page.evaluate(()=>{location.hash='#search';});await page.locator('[data-act="askOpen"]').first().waitFor();
  await page.evaluate(({seed,cat})=>{
   const S=window.__uiTestState;S.catalog=cat;
   const commander=cat[seed.commander.toLowerCase()];
   Object.assign(S.ui.ideas,{cache:[{commander,deck:seed,plan:'Synthetic QA',available:0,themeCards:0,slots:1,reason:'Independent synthetic hosted fixture'}],filter:'all',limit:12,ran:true,busy:false,open:null,defaultBudget:undefined,sel:new Set()});
   location.hash='#decks/ideas';
  },{seed:ideaSeed,cat:ideaCatalog(mode)});
  await page.locator('[data-act="openIdea"]').first().click();await page.locator('#sheet[open] [data-act="ideaSaveAll"]').waitFor();
  await page.waitForFunction(()=>window.__uiTestState.ui.ideas.open?.initialized&&!window.__uiTestState.ui.ideas.open?.busy&&!!window.__uiTestState.ui.ideas.open?.custom);
  return page.evaluate(()=>({deck:window.__uiTestState.ui.ideas.open.custom,diagnostics:window.__uiTestState.ui.ideas.open.diagnostics,budget:window.__uiTestState.ui.ideas.open.budget}));
 }
 const missing=await openIdeaScenario('missing');assert.equal(sumQty(missing.deck.cards),64);assert.equal(missing.diagnostics.missingLands,36);
 assert.match(await page.locator('#sheetBody').innerText(),/Save 64-card draft/);assert.match(await page.locator('#sheetBody').innerText(),/Power unavailable/);assert.match(await page.locator('#sheetBody').innerText(),/Basic land details are unavailable/);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody','64-card idea preview '+width);await capture(page,'idea64-preview-'+width);}
 const saveBefore=await page.evaluate(()=>window.__uiTestState.state.decks.length);await page.locator('#sheetBody [data-act="ideaSaveAll"]').first().click();
 await page.waitForFunction(n=>window.__uiTestState.state.decks.length===n+1,saveBefore);await page.waitForFunction(()=>!document.querySelector('#sheet').open);
 const saved=await page.evaluate(()=>window.__uiTestState.state.decks.at(-1));assert.equal(sumQty(saved.cards),64);assert.deepEqual(saved.cards,missing.deck.cards);
 assert.match(await page.locator('.deck-hero').innerText(),/64\/100/);assert.match(await page.locator('.deck-hero').innerText(),/power unavailable/i);
 await page.evaluate(()=>{location.hash='#decks/mine';});await page.locator('#shelfList').waitFor();await gotoDeck(page,saved.id);
 assert.match(await page.locator('.score-panel.power').innerText(),/Finish the deck before rating Power/);
 const savedPower=await page.evaluate(async id=>{const {mtgPower,shownPower}=await import('/power.js');const p=mtgPower(window.__uiTestState.state.decks.find(d=>d.id===id));return {score:p.score,shown:shownPower(p),eligible:p.readiness.eligible};},saved.id);
 assert.deepEqual(savedPower,{score:null,shown:null,eligible:false});await capture(page,'idea64-saved-reopened');
 const afterSave=await inventorySnapshot(page);
 const priced=await openIdeaScenario('priced');assert.equal(sumQty(priced.deck.cards),100);assert.equal(priced.diagnostics.lands,36);assert.equal(priced.diagnostics.purchaseEstimateVerified,true);
 assert.match(await page.locator('#sheetBody').innerText(),/Save 100-card list/);assert.match(await page.locator('#sheetBody').innerText(),/Complete 100-card list/);await capture(page,'idea100-priced-basics');await page.locator('#sheetBody [data-act="closeSheet"]').first().click();
 const unpriced=await openIdeaScenario('unpriced');assert.equal(sumQty(unpriced.deck.cards),100);assert.equal(unpriced.diagnostics.unpricedPurchaseCopies,36);assert.equal(unpriced.diagnostics.purchaseEstimateVerified,false);
 assert.equal(unpriced.deck.budget,null);assert.match(await page.locator('#sheetBody').innerText(),/purchase cost unverified/);assert.match(await page.locator('#sheetBody').innerText(),/Total purchase cost is unverified, not free/);
 await capture(page,'idea100-uncapped-unknown-price');await page.locator('#sheetBody [data-act="ideaBudget"][data-v="25"]').click();
 await page.waitForFunction(()=>!window.__uiTestState.ui.ideas.open.busy&&window.__uiTestState.ui.ideas.open.budget===25);
 const finite=await page.evaluate(()=>window.__uiTestState.ui.ideas.open);assert.equal(sumQty(finite.custom.cards),64);assert.equal(finite.budget,25);assert.match(await page.locator('#sheetBody').innerText(),/No purchase price is available/);assert.match(await page.locator('#sheetBody').innerText(),/Save 64-card draft/);await capture(page,'idea64-finite-unknown-price');
 await page.locator('#sheetBody [data-act="closeSheet"]').first().click();assert.equal(await inventorySnapshot(page),afterSave,'later priced/unpriced budget previews never autosave');
 const persistence=await page.evaluate(()=>window.__powerSaveEvidence);assert(persistence.writes.length>0,'explicit save reached durable storage');
 for(const {state} of persistence.writes){assert.deepEqual({...state,decks:[]},{...persistence.baseline,decks:[]},'only the exact synthetic deck may change');assert.deepEqual(state.decks.slice(0,-1),persistence.baseline.decks);assert.deepEqual(state.decks.at(-1),saved);}
 assert.equal((await page.evaluate(()=>window.__fixtureSensitiveWrites)).length,persistence.writes.length,'every shared-guard write has an audited exact synthetic save');
 checks.push('Actual Ideas handlers build64 with missing basics, save exactly one synthetic draft and reopen with null Power; priced basics complete100; no cap allows100 with explicitly unknown36 basic prices while finite25 remains64. No other durable mutation.');
 app.health();
 await mkdir(out,{recursive:true});await writeFile(new URL('power-release-browser.json',out),JSON.stringify({status:'passed',evidence:EVIDENCE,checks,screenshots,timings,coachCalls,askCalls,persistence:{explicitSyntheticSaves:1,durableWrites:persistence.writes.length,unchangedPriorDecks:true,unchangedOtherInventory:true,savedCardCount:64,reopenedPower:savedPower}},null,2));console.log('PASS: '+checks.join(' '));
}catch(error){await mkdir(out,{recursive:true});if(app)try{await capture(app.page,'failure');}catch{}await writeFile(new URL('power-release-browser.json',out),JSON.stringify({status:'failed',evidence:EVIDENCE,checks,screenshots,timings,coachCalls,askCalls,error:String(error.stack||error),diagnostics:app?.diagnostics()},null,2));throw error;}
finally{askHold?.release.resolve();await app?.context.close();await browser.close();await server.close();}
