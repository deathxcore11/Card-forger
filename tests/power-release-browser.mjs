// Actual-app Power release QA. Browser execution is hosted-only after explicit
// publication authorization. --validate-fixtures is local and never starts a
// browser, HTTP listener, provider call, paid AI request, or remote upload.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {startServer,openSearchApp,inventorySnapshot,noOverflow,ISO} from './search-fixtures.mjs';
import {cardKey,sumQty} from '../core.js';
import {S,blank} from '../store.js';
import {mtgPower,tcgPower,shownPower} from '../power.js';
import {normalizePtcg,PTCG_FORMATS,validatePtcg} from '../ptcg.js';
import {normalizeYgo,YGO_FORMATS,validateYgo,ygoZoneRange,ygoLegality,ygoLimit} from '../ygo.js';
import {prepareMtgDeck} from '../ai-deck-builder.js';
import {reviewPayload} from '../ai-review.js';
import {cleanDeck,validateReview} from '../ai-review-route.js';
import {completionPlan} from '../planner.js';
import {buildPtcg,buildYgo,PTCG_SUPPORT_BASICS} from '../tcgbuild.js';

const commanderSource=JSON.parse(await readFile(new URL('../test-fixtures/commander-context.json',import.meta.url)));
const standardSource=JSON.parse(await readFile(new URL('../test-fixtures/standard-effect-cards.json',import.meta.url)));
const publicBench=JSON.parse(gunzipSync(await readFile(new URL('../test-fixtures/power-bench.json.gz',import.meta.url))));
const publicRal=publicBench.mtg.meta.EDH.decks.find(d=>d.name.startsWith('Ral,'));
const ralRows=[...publicRal.main,...publicRal.commanders].map(({name,qty})=>({name,qty}));
const EVIDENCE='Actual app with independent synthetic deck arrangements, frozen public card text, and the pre-existing public Ral tournament reference projected to card names/quantities only (no player/event/account metadata). The added GLC/Speed Duel/GOAT cards and arrangements are entirely invented normalized rule probes, not real legal lists. Builder probes use synthetic normalized text, quotes and arrangements; Pokémon support names come from the public built-in list, not private data. Prices, IDs, set metadata, artwork and AI responses are synthetic. No real account, collection, saved user deck, private photo or provider credential is used. External requests fail closed. This checks UI integration and deterministic contracts, not live AI quality or calibrated competitive strength.';
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
const formatCoachResponse=()=>{const r=response();r.pilot.hand={verdict:'keep',reason:'Review these synthetic initial options.',firstTurns:'No turn sequence is simulated.',lookFor:'',preserve:'',evidence:[]};return r;};
const handFields=['initialHandCards','firstTurnDraw','secondTurnDraw','firstTurnCards','secondTurnCards'];
const expectedHand=id=>id==='speed'?[4,0,1,4,5]:[5,1,1,6,6];

// Entirely invented, normalized format probes. These test bounded eligibility
// profiles, not actual card legality, tournament performance or numerical bands.
const formatOfProbe=(game,id)=>(game==='ptcg'?PTCG_FORMATS:YGO_FORMATS).find(f=>f.id===id);
let formatSequence=90000000;
const probeArt=c=>({...c,fetchedAt:ISO,prices:{...c.prices,usd:.25},image:`https://search-fixtures.invalid/${c.id}.svg`,imageLarge:`https://search-fixtures.invalid/${c.id}.svg`,art:`https://search-fixtures.invalid/${c.id}.svg`,artDirect:`https://search-fixtures.invalid/${c.id}.svg`});
const probeRow=(c,qty=1)=>({cardId:c.id,name:c.name,qty});
function pokemonProbe(name,more={}){
 return probeArt(normalizePtcg({id:`xy1-${++formatSequence}`,name,category:'Pokemon',stage:'Basic',types:['Grass'],hp:100,rarity:'Common',legal:{standard:false,expanded:true},attacks:[{name:'Fixture attack',cost:['Grass'],damage:30}],set:{id:'xy1',name:'Synthetic XY identity'},...more}));
}
function glcProbe(kind){
 const attacker=pokemonProbe('Synthetic Grass attacker'),energy=pokemonProbe('Basic Grass Energy',{category:'Energy',stage:null,types:[],energyType:'Normal'}),ace=pokemonProbe('Synthetic ACE fixture',{category:'Trainer',rarity:'ACE SPEC Rare',stage:null,types:[]});
 const main=[probeRow(attacker,kind==='four'?4:1),...(kind==='ace'?[probeRow(ace)]:[])];main.push(probeRow(energy,60-sumQty(main)));
 return {game:'ptcg',cards:Object.fromEntries([attacker,energy,ace].map(c=>[c.id,c])),deck:{id:'power-glc-'+kind,name:'Synthetic GLC '+kind,format:'glc',zones:{main,extra:[],side:[]}},eligible:kind==='good',issue:kind==='ace'?/Rule Box|ACE SPEC/:kind==='four'?/allows 1 with the same name/:null};
}
function ygoProbe(format,kind){
 const f=formatOfProbe('ygo',format),cards={},zones={main:[],extra:[],side:[]};
 const sizes=format==='speed'?{main:20,extra:kind==='extra'?7:6,side:6}:{main:kind==='short'?39:61,extra:16,side:kind==='side'?1:15};
 for(const [zone,n]of Object.entries(sizes))for(let i=0;i<n;i++){
  const id=String(++formatSequence),c=probeArt(normalizeYgo({id,name:`Synthetic ${zone} ${id}`,type:zone==='extra'?'Fusion Monster':'Normal Monster',frameType:zone==='extra'?'fusion':'normal',level:4,atk:1000,def:1000,race:'Warrior',attribute:'LIGHT',desc:'',misc_info:[{formats:[f.pool.toLowerCase()]}],card_prices:[]}));
  cards[id]=c;zones[zone].push(probeRow(c));
 }
 return {game:'ygo',cards,deck:{id:`power-${format}-${kind}`,name:`Synthetic ${f.name} ${kind}`,format,zones,...(kind==='skill'?{skill:'Synthetic declared Skill'}:{})},eligible:kind==='good',issue:kind==='skill'?/Skill is declared/:kind==='extra'?/Extra Deck has 7/:kind==='side'?/intended Side Deck variant/:kind==='short'?/needs 40\+ \(no maximum\)/:null};
}
const formatProbes=[{id:'glc',game:'ptcg',cases:['good','ace','four'].map(glcProbe),save:'power-glc-ace'},{id:'speed',game:'ygo',cases:['good','skill','extra'].map(k=>ygoProbe('speed',k)),save:'power-speed-skill'},{id:'goat',game:'ygo',cases:['good','side','short'].map(k=>ygoProbe('goat',k)),save:'power-goat-side'}];
function validateFormatFixtures(){
 for(const group of formatProbes)for(const x of group.cases){
  const f=formatOfProbe(x.game,x.deck.format),p=tcgPower(x.game,x.deck,f,id=>x.cards[id]),issues=(x.game==='ptcg'?validatePtcg:validateYgo)(x.deck,id=>x.cards[id],f);
  assert.equal(p.readiness.eligible,x.eligible,x.deck.name+': '+JSON.stringify(issues));
  if(x.eligible)assert(Number.isFinite(shownPower(p)),x.deck.name+' gets an uncalibrated heuristic only');else assert.equal(shownPower(p),null,x.deck.name+' cannot earn overall Power');
  if(x.issue)assert.match(issues.map(i=>i.text).join(' | '),x.issue);
  if(group.id==='glc'){for(const key of ['Ace','Consistency']){const part=p.parts.find(p=>p.key===key);assert.equal(part.weight,0);assert.equal(part.lost,0,'GLC does not reward ACE SPEC or four-of targets');}}
  if(x.game==='ygo'){const raw=reviewPayload(x.game,x.deck,id=>x.cards[id],p),payload=cleanDeck(raw);assert.equal(raw.format,group.id);assert.deepEqual(handFields.map(k=>raw.handProfile[k]),expectedHand(group.id));assert.equal(raw.hand.length,expectedHand(group.id)[0]);assert.deepEqual(raw.handProfile,payload.handProfile);assert.deepEqual(raw.hand,payload.hand);assert.equal(validateReview(formatCoachResponse(),payload).pilot.hand.verdict,'none');}
 }
 const speed=formatOfProbe('ygo','speed'),goat=formatOfProbe('ygo','goat');
 assert.deepEqual([speed.extra,speed.side,speed.firstTurnCards,speed.secondTurnCards],[6,6,4,5]);
 assert.deepEqual([goat.main[0],goat.main[1],goat.extra,goat.firstTurnCards,goat.secondTurnCards],[40,Infinity,Infinity,6,6]);
 assert.match(ygoZoneRange(goat,'main'),/40.*no maximum/i);assert.match(ygoZoneRange(goat,'extra'),/No maximum/);assert.doesNotMatch(ygoZoneRange(goat,'main')+ygoZoneRange(goat,'extra'),/Infinity/);
}

// Builder probes seed only normalized cards and a one-card input deck. The real
// production handlers assemble every preview and persist every explicit save.
function builderFixture(game,kind){
 const cards={},format=game==='ptcg'?'standard':'tcg',prefix=`build-${game}-${kind}`;
 const add=c=>{cards[c.id]=c;return c;};let n=0;
 const pk=(name,category='Pokemon',value=.1)=>add({...probeArt(normalizePtcg({id:`${prefix}-${++n}`,name,category,stage:category==='Pokemon'?'Basic':null,types:category==='Pokemon'?['Fire']:[],hp:category==='Pokemon'?70:null,trainerType:category==='Trainer'?'Item':null,energyType:category==='Energy'?'Normal':null,rarity:'Common',legal:{standard:true,expanded:true},set:{id:'energy-fixture',name:'Verified synthetic printing'},attacks:category==='Pokemon'?[{name:'Fixture Ember',cost:['Fire'],damage:'20',effect:''}]:[]})),prices:{usd:value},priceFallbackSchema:3});
 const yg=(name,type='Normal Monster',value=1)=>{
  const id=String(91000000+(++n)),c={...probeArt(normalizeYgo({id,name,type,frameType:type==='Spell Card'?'spell':'normal',level:4,atk:1000,def:1000,race:type==='Spell Card'?'Normal':'Warrior',attribute:'FIRE',archetype:type==='Spell Card'?'':'Synthetic Fixture',desc:'Synthetic builder rule probe only.',misc_info:[{formats:['tcg']}],card_prices:[]})),printPriceSchema:1,prices:{usd:1}};
  c.sets=[{name:'Synthetic checked release',code:`FXQ-EN${String(n).padStart(3,'0')}`,rarity:'Common',productId:910000+n,priceSource:'Synthetic provider',checkedAt:ISO,...(value===null?{}:{quotes:[{edition:'Unlimited',market:value}]})}];return add(c);
 };
 let seed,support=[],trainers=[],archetype=[],staples=[],energy;
 if(game==='ptcg'){
  seed=pk('Synthetic Fire build seed');support=PTCG_SUPPORT_BASICS.map(name=>pk(name));
  trainers=Array.from({length:15},(_,i)=>pk('Synthetic Trainer '+(i+1),'Trainer'));energy=pk('Basic Fire Energy','Energy',2);
 }else{
  const quote=kind==='unknown'?null:1;seed=yg('Synthetic YGO build seed','Normal Monster',kind==='constraint'?1000:quote);
  archetype=Array.from({length:16},(_,i)=>yg('Synthetic engine '+(i+1),'Normal Monster',quote));staples=Array.from({length:15},(_,i)=>yg('Synthetic spell '+(i+1),'Spell Card',quote));
 }
 const input={id:prefix+'-input',name:'Synthetic one-card build input',format,zones:{main:[probeRow(seed)],extra:[],side:[]}};
 return {game,kind,format,cards,seedId:seed.id,supportIds:support.map(c=>c.id),trainerIds:trainers.map(c=>c.id),archetypeIds:archetype.map(c=>c.id),stapleIds:staples.map(c=>c.id),energyId:energy?.id,input,budget:game==='ptcg'?(kind==='constraint'?10:null):(kind==='unknown'?null:50)};
}
const builderProbes=[builderFixture('ptcg','complete'),builderFixture('ptcg','constraint'),builderFixture('ygo','complete'),builderFixture('ygo','constraint'),builderFixture('ygo','unknown')];
const checkedBasicCatalog=()=>{const cat=ideaCatalog('priced');cat.plains={...cat.plains,id:'basic-art-expensive',games:['paper'],digital:false,oversized:false,border_color:'black',set_type:'core',full_art:true,prices:{usd:'25'}};return cat;};
const checkedBasicCandidates=()=>{
 const expensive=checkedBasicCatalog().plains,make=(id,usd,more={})=>({...structuredClone(expensive),id,full_art:false,prices:{usd},...more});
 return [expensive,make('basic-illegal','.001',{legalities:{commander:'banned'}}),make('basic-wrong-oracle','.001',{oracle_id:'not-the-same-basic'}),make('basic-no-quote',null),make('basic-legal-cheap','.05',{set:'low',set_name:'Synthetic low checked set',collector_number:'22'})];
};
async function validateBuilderFixtures(){
 const {ygoPurchaseReference}=await import('../ygo-price-selection.js');
 for(const x of builderProbes){
  const seed=x.cards[x.seedId],f=formatOfProbe(x.game,x.format),price=c=>x.game==='ygo'?ygoPurchaseReference(c).value:c.prices.usd;
  let result;
  if(x.game==='ptcg')result=buildPtcg({line:[{card:seed,want:4},...x.supportIds.slice(0,3).map(id=>({card:x.cards[id],want:2}))],trainers:x.trainerIds.map(id=>({card:x.cards[id],want:4})),energy:[x.cards[x.energyId]],owned:()=>0,price,budget:x.budget??Infinity});
  else result=buildYgo({f,seed,archetype:x.archetypeIds.map(id=>x.cards[id]),staples:x.stapleIds.map(id=>x.cards[id]),owned:()=>0,price,budget:x.budget??Infinity,legal:ygoLegality,limit:ygoLimit});
  if(x.game==='ptcg'&&x.kind==='constraint')assert(result.total<60,'finite Energy probe cannot complete');
  else{assert.equal(result.total,x.game==='ptcg'?60:40);assert.equal((x.game==='ptcg'?validatePtcg:validateYgo)(result,id=>x.cards[id],f).filter(i=>i.level==='bad'||i.level==='pending').length,0);}
  if(x.game==='ptcg'&&x.kind==='complete')assert(result.cost>25,'unowned Energy is charged');
  if(x.game==='ygo'&&x.kind==='constraint')assert(!result.zones.main.some(r=>r.cardId===seed.id),'finite full-count fallback really omits the unaffordable required seed');
  if(x.game==='ygo'&&x.kind==='unknown'){assert.equal(result.unknown,40);assert(Object.values(x.cards).every(c=>c.prices.usd===1&&ygoPurchaseReference(c).value===null),'generic references cannot certify an exact purchase');}
  if(x.game==='ygo'&&x.kind==='complete')assert(Object.values(x.cards).every(c=>ygoPurchaseReference(c).selection.edition==='unlimited'));
 }
 const {findCheapestPrinting}=await import('../mtg-cheap.js'),cat=checkedBasicCatalog(),result=await findCheapestPrinting('Plains',{api:async()=>({data:checkedBasicCandidates(),has_more:true}),reference:cat.plains,format:'commander',basicOnly:true});
 assert.equal(result.card.id,'basic-legal-cheap');assert.equal(result.coverage.marketComplete,false);assert.equal(result.coverage.hasMore,true);
 cat.plains=result.card;const plan=completionPlan(ideaSeed,[],[],cat,{budget:25,landTarget:36,preferOwned:true,simple:false});assert.equal(sumQty(plan.deck.cards),100);assert.equal(plan.diagnostics.lands,36);assert.equal(plan.cost,17.8);
 console.log('PASS: builder inputs form complete or explicit constraint-shortfall lists using real pure builders; exact YGO quotes and bounded legal Magic basic selection are independently checked. No finished browser result is injected.');
}

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
await validateBuilderFixtures();
validateFormatFixtures();
console.log('PASS: nine synthetic GLC/Speed Duel/GOAT profile probes, including ACE SPEC/singleton, bounded Skills and historical size/side-policy gates. Not strength calibration.');
if(process.argv.includes('--validate-fixtures'))process.exit(0);
assert.equal(process.env.GITHUB_ACTIONS,'true','Power browser QA is hosted-only after approval; use --validate-fixtures locally.');

const {chromium}=await import('playwright');
const server=await startServer(),browser=await chromium.launch({headless:true}),out=new URL('../test-results/',import.meta.url);
const checks=[],screenshots=[],coachPayloads=[],askPayloads=[],timings=[],formatResults=[],builderResults=[],failures=[];
let magicPersistence=null;
let app,formatApp,builderApp,askHold=null,coachCalls=0,askCalls=0,ideaMode=null;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function capture(page,name,scope){await mkdir(out,{recursive:true});await frames(page);const file=`power-release-${name}.png`,options={path:new URL(file,out).pathname,animations:'disabled'};if(scope)await page.locator(scope).screenshot(options);else await page.screenshot({...options,fullPage:true});screenshots.push(file);}
async function recordScenarioFailure(scenario,error,context){
 const failure={scenario,error:String(error.stack||error),diagnostics:context?.diagnostics()||error.fixtureDiagnostics||null};failures.push(failure);
 // A failed prerequisite ends this context, never its assertions or the job.
 // Preserve any safety failure too, then the caller closes the context before
 // the next independent scenario creates its own fresh app and fixtures.
 if(context){try{context.health();}catch(health){failure.healthError=String(health.stack||health);}try{await capture(context.page,'failure-'+scenario);}catch(captureError){failure.captureError=String(captureError.stack||captureError);}}
 console.error('FAIL ['+scenario+']: '+failure.error);
 if(!context&&(!error.fixtureDiagnostics||error.fixtureDiagnostics.cleanupError))throw new Error('Could not confirm '+scenario+' bootstrap context closed; remaining scenarios stopped.',{cause:error});
}
async function closeScenarioContext(scenario,context){
 if(!context)return;
 try{await context.context.close();}catch(error){
  await recordScenarioFailure(scenario+'-cleanup',error,context);
  // Failure to close is an infrastructure prerequisite failure. Do not start
  // another scenario while this context may still be live; outer cleanup still
  // attempts browser and server termination, without masking the failed job.
  throw new Error('Could not confirm '+scenario+' context closed; remaining scenarios stopped.',{cause:error});
 }
}
async function coachTabNavigation(page,label){
 const tabs=page.locator('.air-tabs [data-ai-tab]');assert.equal(await tabs.count(),4,label+': all four coach sections remain');
 for(const [key,name,count]of [['deck','Deck','0'],['meta','Meta','0'],['improve','Improve','0'],['pilot','Pilot','1']]){
  const tab=page.locator('.air-tabs [data-ai-tab="'+key+'"]');assert.equal(await tab.evaluate(n=>[...n.childNodes].filter(x=>x.nodeType===Node.TEXT_NODE).map(x=>x.textContent).join('').trim()),name,label+': full section label is retained');assert.equal(await tab.locator('em').innerText(),count,label+': section count is retained');
  await tab.click();await page.waitForFunction(key=>document.querySelector('.air-tabs [data-ai-tab="'+key+'"]')?.getAttribute('aria-selected')==='true',key);
  assert.equal(await page.locator('.air-tabs [aria-selected="true"]').count(),1);
  const panel=page.locator('.air-panel');
  if(key==='deck')assert.equal(await panel.locator('.air-identity').count(),1,'Deck navigation renders its actual identity panel');
  else if(key==='pilot')assert.equal(await panel.locator('.air-hand').count(),1,'Pilot navigation renders its actual initial-hand panel');
  else assert.equal((await panel.locator('.air-empty').innerText()).trim(),key==='meta'?'No tournament data for this format is loaded yet. Open Power and tap "Compare with tournament decks", then ask again.':"No swap held up to the app's checks.",'Actual tab navigation replaces the prior panel with the fixture-specific section');
  // Wait for the real click's pressed transition to settle without a second action.
  await tab.click({trial:true});
  const r=await tab.boundingBox(),body=await page.locator('.ai-dialog-body').boundingBox(),v=page.viewportSize();
  assert(r&&body&&r.width>=44&&r.height>=44&&r.x>=-.5&&r.x+r.width<=v.width+.5&&r.y>=Math.max(0,body.y)-.5&&r.y+r.height<=Math.min(v.height,body.y+body.height)+.5,label+': full44px tab remains visible and reachable '+JSON.stringify({r,body}));
  const parts=await tab.evaluate(n=>{const ranges=[...n.childNodes].filter(x=>x.nodeType===Node.TEXT_NODE&&x.textContent.trim()).flatMap(x=>{const range=document.createRange();range.selectNodeContents(x);return [...range.getClientRects()].map(r=>r.toJSON());});return [...ranges,n.querySelector('em').getBoundingClientRect().toJSON()];});
  assert(parts.length>=2,label+': full label and count have visible geometry');for(const part of parts)assert(part.width>0&&part.height>0&&part.left>=r.x-.5&&part.right<=r.x+r.width+.5&&part.top>=r.y-.5&&part.bottom<=r.y+r.height+.5,label+': full label/count fit their own target '+JSON.stringify(part));
 }
 assert.equal((await page.locator('.air-hand .air-verdict').innerText()).trim().toLowerCase(),'assessment','actual navigation returns to the same honest YGO initial-hand assessment');
}
async function reachableIdeaActions(page,label){
 const actions=page.locator('.idea-actions [data-act]');assert.equal(await actions.count(),4,label+': all Save/Buy/Wish/Own actions remain present');
 for(const action of await actions.all()){
  assert(await action.isVisible(),label+': action is visible');assert(await action.isEnabled(),label+': action is enabled');
  // Trial checks stability, scrolling and hit testing without firing a click.
  // Never activate Buy/Wish/Own or preempt the later explicit Save assertion.
  await action.click({trial:true});const r=await action.boundingBox(),v=page.viewportSize();
  assert(r&&r.width>=24&&r.height>=24&&r.x>=-.5&&r.y>=-.5&&r.x+r.width<=v.width+.5&&r.y+r.height<=v.height+.5,label+': usable action fits the visible viewport '+JSON.stringify(r));
 }
}
async function gotoDeck(page,id){await page.evaluate(id=>{location.hash='#deck/'+id+'/engine';},id);await page.locator('.score-panel.power').waitFor();await page.waitForFunction(id=>window.__uiTestState.ui.deckId===id,id);}
async function openAsk(page){await page.evaluate(()=>{location.hash='#search';});await page.locator('[data-act="askOpen"]').first().click();await page.locator('.ask-dialog[open]').waitFor();}
async function installBuilderSaveAudit(page){
 await page.evaluate(()=>{
  const pick=s=>({collection:s.collection,decks:s.decks,printings:s.printings,wishlist:s.wishlist,tcg:s.tcg,myPrices:s.myPrices,priceChoices:s.priceChoices});
  window.__powerBuilderSave={baseline:structuredClone(pick(window.__uiTestState.state)),writes:[]};
  const record=(raw,key)=>{if(key!=='cardforge-v2')return;const state=typeof raw==='string'?JSON.parse(raw):raw;if(JSON.stringify(pick(state))!==JSON.stringify(window.__powerBuilderSave.baseline))window.__powerBuilderSave.writes.push(structuredClone(pick(state)));};
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){record(v,k);return put.call(this,v,k);};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){record(v,k);return set.call(this,k,v);};
 });
}
async function configureBuilderProviders(page,x){
 await page.evaluate(async x=>{
  const T=window.__uiTestTcg,{sameCardLogic}=await import('/deck-optimizer.js'),cards=x.cards,all=Object.values(cards),get=id=>{const c=cards[id];if(!c)throw Error('Unmapped synthetic builder identity: '+id);return c;},reads=window.__powerBuilderReads=[];
  const log=(kind,value)=>reads.push({kind,value});
  if(x.game==='ptcg')Object.assign(T.SOURCES.ptcg,{
   get:async id=>{log('get',id);return get(id);},
   search:async({q})=>{log('search',q);return {cards:all.filter(c=>c.name.toLowerCase()===String(q).toLowerCase()),more:false};},
   byName:async name=>{log('byName',name);return all.find(c=>c.name===name)||null;},
   evolutions:async name=>{log('evolutions',name);return [];},
   cheapestPrint:async(card,{legal,owned,known})=>{log('cheapestPrint',card.id);const options=known.filter(c=>legal(c)&&sameCardLogic('ptcg',card,c)),mine=options.filter(c=>owned(c)>0),price=c=>c.prices.usd==null||String(c.prices.usd).trim()===''?Infinity:Number(c.prices.usd);return (mine.length?mine:options).sort((a,b)=>price(a)-price(b))[0]||card;}
  });
  else Object.assign(T.SOURCES.ygo,{
   get:async id=>{log('get',id);return get(id);},
   search:async args=>{log('search',args.archetype||args.q||'');if(args.archetype!=='Synthetic Fixture')throw Error('Unexpected synthetic archetype search');return {cards:x.archetypeIds.map(get),more:false};},
   byNames:async names=>{log('byNames',names.length);return x.stapleIds.map(get);},
   byName:async name=>{log('byName',name);return all.find(c=>c.name===name)||null;},
   byIds:async ids=>{log('byIds',ids.length);return ids.map(get);},
   randomArchetype:async()=>{log('randomArchetype','local');return {cards:[get(x.seedId)]};}
  });
 },x);
}
async function settleBuilder(page,format){
 await page.waitForFunction(format=>{const B=window.__uiTestState.ui.tbuild;return B?.format===format&&!B.busy&&(B.error||Array.isArray(B.results?.[format]));},format);
 const state=await page.evaluate(()=>({error:window.__uiTestState.ui.tbuild.error,message:window.__uiTestState.ui.tbuild.msg}));assert.equal(state.error,false,state.message);
}
async function builderTier(page,cap){
 return page.evaluate(cap=>{const B=window.__uiTestState.ui.tbuild,tiers=B.results[B.format],i=tiers.findIndex(t=>t.covers.includes(cap===null?Infinity:cap));if(i<0)throw Error('Expected budget tier absent');return {i,tier:tiers[i],custom:B.custom};},cap);
}

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
  // The app deliberately preserves disclosure choices across deck navigation.
  // End this scenario through the real control, rather than resetting DOM/state.
  await availability.locator('summary').click();assert.equal(await availability.getAttribute('open'),null,'Commander availability closes through its summary before the next viewport');
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
  await page.locator('[data-act="openIdea"]').first().click();await page.locator('#sheet[open] .btn.block[data-act="ideaSaveAll"]').waitFor();
  await page.waitForFunction(()=>window.__uiTestState.ui.ideas.open?.initialized&&!window.__uiTestState.ui.ideas.open?.busy&&!!window.__uiTestState.ui.ideas.open?.custom);
  return page.evaluate(()=>({deck:window.__uiTestState.ui.ideas.open.custom,diagnostics:window.__uiTestState.ui.ideas.open.diagnostics,budget:window.__uiTestState.ui.ideas.open.budget}));
 }
 const missing=await openIdeaScenario('missing');assert.equal(sumQty(missing.deck.cards),64);assert.equal(missing.diagnostics.missingLands,36);
 assert.match(await page.locator('#sheetBody').innerText(),/Save 64-card draft/);assert.match(await page.locator('#sheetBody').innerText(),/Power unavailable/);assert.match(await page.locator('#sheetBody').innerText(),/Basic land details are unavailable/);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody','64-card idea preview '+width);await reachableIdeaActions(page,'64-card idea preview '+width);await capture(page,'idea64-preview-'+width);}
 await page.setViewportSize({width:844,height:390});await noOverflow(page,'#sheetBody','64-card idea landscape844x390');await reachableIdeaActions(page,'64-card idea landscape844x390');await capture(page,'idea64-preview-landscape-844x390');await capture(page,'idea64-landscape-actions','.idea-actions');await page.setViewportSize({width:390,height:1000});
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
 magicPersistence={explicitSyntheticSaves:1,durableWrites:persistence.writes.length,unchangedPriorDecks:true,unchangedOtherInventory:true,savedCardCount:64,reopenedPower:savedPower};
 checks.push('Actual Ideas handlers build64 with missing basics at four widths and844x390 landscape with every action retained, save exactly one synthetic draft and reopen with null Power; priced basics complete100; no cap allows100 with explicitly unknown36 basic prices while finite25 remains64. No other durable mutation.');
 app.health();await app.context.close();app=null;
 // Separate real-app contexts keep format probes independent of the Magic
 // catalog replacement, mock AI handlers, explicit save and disclosure state.
 for(const group of formatProbes){
  try{
  formatApp=await openSearchApp(browser,server.base,{game:group.game,width:390,height:1000,evidenceLabel:'power-format-'+group.id,prepareFixtures:f=>{
   f.state.decks=[];f.state.collection=[];
   for(const game of ['ptcg','ygo']){f.state.tcg[game].decks=[];f.state.tcg[game].collection=[];}
   f.state.tcg[group.game].decks=structuredClone(group.cases.map(x=>x.deck));
   Object.assign(f.cache[group.game],...group.cases.map(x=>structuredClone(x.cards)));
  }});
  const fp=formatApp.page,before=await inventorySnapshot(fp),profile=formatOfProbe(group.game,group.id),cases=[];
  const coachHandoffs=[];
  if(group.game==='ygo')await fp.route('**/api/ai/deck-review',async route=>{
   // Exact local mock only. No forward, provider request or broad write exception.
   const raw=route.request().postDataJSON(),payload=cleanDeck(raw);assert.equal(raw.game,'ygo');assert.equal(raw.format,group.id);assert.equal(raw.handProfile.sample,'initial-opening-hand-before-draw');assert.equal(raw.handProfile.status,'supported');assert.deepEqual(handFields.map(k=>raw.handProfile[k]),expectedHand(group.id));assert.equal(raw.hand.length,expectedHand(group.id)[0]);assert.deepEqual(raw.handProfile,payload.handProfile);assert.deepEqual(raw.hand,payload.hand);assert(raw.hand.every(id=>raw.cards.find(c=>c.id===id)?.zone==='main'));
   const report=validateReview(formatCoachResponse(),payload);assert.equal(report.pilot.hand.verdict,'none','Yu-Gi-Oh! never gains a normal keep/mulligan verdict');coachHandoffs.push({format:raw.format,handProfile:payload.handProfile,initialSampleCount:payload.hand.length,normalizedVerdict:report.pilot.hand.verdict});await route.fulfill({contentType:'application/json',body:JSON.stringify(report)});
  });
  const openProbe=async id=>{await fp.evaluate(id=>{location.hash='#tdeck/'+id+'/insights';},id);await fp.waitForFunction(id=>window.__uiTestState.ui.tdeckId===id,id);await fp.locator('.score-panel.power').waitFor();await fp.locator('.deck-hero h1').filter({hasText:group.cases.find(x=>x.deck.id===id).deck.name}).waitFor();};
  const stateOf=()=>fp.evaluate(async()=>{
   const S=window.__uiTestState,T=window.__uiTestTcg,game=S.state.settings.game,d=S.state.tcg[game].decks.find(x=>x.id===S.ui.tdeckId),{tcgPower,shownPower}=await import('/power.js');
   const formats=game==='ptcg'?(await import('/ptcg.js')).PTCG_FORMATS:(await import('/ygo.js')).YGO_FORMATS,p=tcgPower(game,d,formats.find(f=>f.id===d.format),id=>T.cardOf(game,id));return {eligible:p.readiness.eligible,incomplete:p.readiness.incomplete,shown:shownPower(p),issues:p.readiness.issues};
  });
  for(const x of group.cases){
   await openProbe(x.deck.id);const result=await stateOf();assert.equal(result.eligible,x.eligible);
   if(x.eligible)assert(Number.isFinite(result.shown));else assert.equal(result.shown,null);
   const expectedBadge=x.eligible?(group.game==='ygo'?['Profile checked · caveats','warn']:['✓ Legal in '+profile.name,'ok']):['power-speed-skill','power-goat-side'].includes(x.deck.id)?['Unverified · checks pending','warn']:[x.deck.id==='power-glc-ace'?'2 to fix':'1 to fix','bad'];
   for(const width of [320,390,768,1440]){
    await fp.setViewportSize({width,height:1000});
    const hero=fp.locator('.deck-hero'),panel=fp.locator('.score-panel.power'),header=await hero.innerText(),text=await panel.innerText();
    assert.match(header,new RegExp(profile.name));assert.equal((await hero.locator('[data-act="tDeckTab"][data-id="insights"] b').innerText()).trim(),x.eligible?String(result.shown):'—','header and shared Power availability agree');
    const badge=hero.locator('.review-badge');assert.equal((await badge.innerText()).trim(),expectedBadge[0],'header distinguishes informational caveats from unresolved checks and explicit errors');assert((await badge.getAttribute('class')).split(/\s+/).includes(expectedBadge[1]),'badge tone matches its actual issue category');
    if(x.eligible){assert.doesNotMatch(header,/power unavailable/);assert.doesNotMatch(text,/Power estimate unavailable|Finish the deck before rating Power/);assert.equal((await panel.locator('p.eyebrow').innerText()).trim().toLowerCase(),'deck power · engine estimate','visible label retains the exact engine-estimate meaning despite CSS capitalization');}
    else{assert.match(header,/power unavailable/);assert.match(text,result.incomplete?/Finish the deck before rating Power/:/Power estimate unavailable/);assert.match(text,/Component diagnostics below are not an overall Power rating/);assert.match((await fp.locator('.deck-body').innerText()),x.issue);}
    if(group.id==='glc'){assert.match(await fp.locator('.deck-body').innerText(),/Singleton consistency/);assert.doesNotMatch(await fp.locator('.deck-body').innerText(),/No ACE SPEC\. Every deck may play one|One ACE SPEC .*free power boost/);}
    else{
     const odds=fp.locator('section.panel').filter({has:fp.locator('h3:text-is("Card by card")')});assert.equal(await odds.count(),1);
     assert.deepEqual(await odds.locator('thead th').allTextContents(),['Card','Qty',`1st (${profile.firstTurnCards})`,`2nd (${profile.secondTurnCards})`],'opening-hand odds use this format, not modern 5/6');
     assert.deepEqual((await odds.locator('tbody tr').first().locator('td.num').allTextContents()),['1',...['firstTurnCards','secondTurnCards'].map(k=>Math.round(profile[k]/sumQty(x.deck.zones.main)*100)+'%')],'one-copy probabilities use the same format-specific hand sizes as the labels');
     assert.doesNotMatch(await fp.locator('.deck-body').innerText(),/Infinity/);
    }
    await noOverflow(fp,'.score-panel.power',group.id+' '+x.deck.id+' Power '+width);await capture(fp,group.id+'-'+x.deck.id.split('-').at(-1)+'-'+width);
   }
   cases.push({id:x.deck.id,...result});
  }
  await fp.setViewportSize({width:390,height:1000});await openProbe(group.cases[0].deck.id);
  if(group.game==='ygo'){
   assert.equal(coachHandoffs.length,0,'ordinary format Power navigation never calls AI');await fp.locator('[data-act="aiDeckReview"]').click();await fp.locator('.ai-review-dialog .air-tabs').waitFor();assert.equal(coachHandoffs.length,1);await fp.locator('.air-tabs [data-ai-tab="pilot"]').click();
   assert.equal((await fp.locator('.air-hand .air-verdict').innerText()).trim().toLowerCase(),'assessment','YGO hand verdict remains Assessment, never Keep/Mulligan');assert.equal(await fp.locator('.air-hand .air-fan > span').count(),expectedHand(group.id)[0]);assert.equal(await fp.locator('.air-hand .air-note').innerText(),coachHandoffs[0].handProfile.note);assert.match(await fp.locator('.air-hand').innerText(),/No normal mulligan/);
   for(const viewport of [{width:320,height:1000},{width:360,height:1000},{width:390,height:1000},{width:768,height:1000},{width:1440,height:1000},{width:844,height:390}]){
    await fp.setViewportSize(viewport);const label=group.id+' initial-hand coach '+viewport.width+'x'+viewport.height;await noOverflow(fp,'.ai-review-dialog',label);await coachTabNavigation(fp,label);await noOverflow(fp,'.ai-review-dialog',label+' after actual tabs');await capture(fp,group.id+'-initial-hand-coach-'+viewport.width+'x'+viewport.height,'.ai-review-dialog');await capture(fp,group.id+'-coach-tabs-'+viewport.width+'x'+viewport.height,'.air-tabs');
   }
   assert.equal(coachHandoffs.length,1,'tab navigation and responsive layouts never make another AI request');
   await fp.locator('[data-ai-close]').click();assert.equal(await fp.locator('.ai-review-dialog').count(),0);await fp.setViewportSize({width:390,height:1000});
  }
  await fp.locator('nav[role="tablist"] [data-act="tDeckTab"][data-id="cards"]').click();await fp.locator('.deck-add').waitFor();
  if(group.game==='ygo'){
   const labels=await fp.locator('.deck-body .section-head h2').allTextContents();
   for(const [zone,label]of [['main','Main Deck'],['extra','Extra Deck'],['side','Side Deck']])assert(labels.some(text=>text.includes(label)&&text.includes(ygoZoneRange(profile,zone))),group.id+' '+zone+' displays the actual format bound');
   assert.doesNotMatch(labels.join(' | '),/Infinity/);
  }
  await capture(fp,group.id+'-format-limits','.deck-body');
  assert.equal(await inventorySnapshot(fp),before,'format navigation is read-only');assert.deepEqual(await fp.evaluate(()=>window.__fixtureSensitiveWrites),[]);
  // A real, explicit options Save is supported for these seeded synthetic lists.
  // Retain the shared guard and audit every durable change against one exact
  // renamed deck; invalid/unsupported declarations must survive the round trip.
  await fp.evaluate(()=>{
   const pick=s=>JSON.stringify({collection:s.collection,decks:s.decks,printings:s.printings,wishlist:s.wishlist,tcg:s.tcg,myPrices:s.myPrices,priceChoices:s.priceChoices});
   window.__powerFormatSave={baseline:JSON.parse(pick(window.__uiTestState.state)),writes:[]};
   const record=(raw,key)=>{if(key!=='cardforge-v2')return;const state=typeof raw==='string'?JSON.parse(raw):raw;if(pick(state)!==JSON.stringify(window.__powerFormatSave.baseline))window.__powerFormatSave.writes.push(JSON.parse(pick(state)));};
   const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){record(v,k);return put.call(this,v,k);};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){record(v,k);return set.call(this,k,v);};
  });
  const original=group.cases.find(x=>x.deck.id===group.save).deck,newName=original.name+' saved';
  await openProbe(original.id);await fp.locator('.deck-hero .fmt-chip[data-act="tDeckMenu"]').click();await fp.locator('#sheet[open] #tDmName').fill(newName);await fp.locator('#sheet[open] [data-act="tDeckSave"]').click();
  await fp.waitForFunction(({game,id,name})=>window.__uiTestState.state.tcg[game].decks.find(x=>x.id===id)?.name===name&&!document.querySelector('#sheet').open,{game:group.game,id:original.id,name:newName});
  await fp.locator('.deck-hero [data-act="go"][data-to="#decks"]').click();await fp.waitForFunction(()=>window.__uiTestState.ui.view==='decks');await openProbe(original.id);
  const saved=await fp.evaluate(({game,id})=>JSON.parse(JSON.stringify(window.__uiTestState.state.tcg[game].decks.find(x=>x.id===id))),{game:group.game,id:original.id}),reopened=await stateOf();
  assert.deepEqual(saved.zones,original.zones);assert.equal(saved.skill,original.skill);assert.equal(saved.format,original.format);assert.equal(saved.name,newName);assert.equal(reopened.eligible,false);assert.equal(reopened.shown,null);assert.match(reopened.issues.join(' | '),group.cases.find(x=>x.deck.id===group.save).issue);assert.match(await fp.locator('.deck-hero').innerText(),/power unavailable/);assert.match(await fp.locator('.score-panel.power').innerText(),/Power estimate unavailable/);
  assert.equal((await fp.locator('.deck-hero .review-badge').innerText()).trim(),group.game==='ptcg'?'2 to fix':'Unverified · checks pending','exact saved invalid declaration retains its honest issue category');
  const audit=await fp.evaluate(()=>window.__powerFormatSave),expected=structuredClone(audit.baseline),index=expected.tcg[group.game].decks.findIndex(x=>x.id===original.id),prior=expected.tcg[group.game].decks[index];
  const {name:savedName,boxAppearance:savedBox,...savedRest}=saved,{name:priorName,boxAppearance:priorBox,...priorRest}=prior;assert.deepEqual(savedRest,priorRest,'options Save changes only name and existing box-appearance fields');assert.deepEqual(savedBox,{color:priorBox?.color||'#7664a0',image:priorBox?.image||''},'untouched appearance is the existing default, not arbitrary mutation');expected.tcg[group.game].decks[index]=saved;
  assert(audit.writes.length>0);for(const state of audit.writes)assert.deepEqual(state,expected,'every durable write is exactly the requested synthetic options Save');assert.equal((await fp.evaluate(()=>window.__fixtureSensitiveWrites)).length,audit.writes.length);
  await capture(fp,group.id+'-saved-unavailable');formatApp.health();formatResults.push({format:profile.name,cases,coachHandoffs,save:{id:saved.id,unavailableAfterReopen:true,unchangedCardsAndDeclarations:true,durableWrites:audit.writes.length},diagnostics:formatApp.diagnostics()});
  checks.push(profile.name+': isolated synthetic actual-app eligibility/header/Power, four widths, actual format bounds'+(group.game==='ygo'?', mocked initial-hand coach context':'')+' and exact explicit save/reopen remain honest; not numerical calibration.');
  }catch(error){await recordScenarioFailure('format-'+group.id,error,formatApp);}
  finally{try{await closeScenarioContext('format-'+group.id,formatApp);}finally{formatApp=null;}}
 }
 // Fresh contexts test real card-detail Build actions. Only provider adapters
 // receive local card catalogs; no generated result, optimizer or save handler
 // is stubbed. The shared deny-all network and durable-write guards stay intact.
 for(const x of builderProbes){
  const resultStart=builderResults.length;
  try{
  builderApp=await openSearchApp(browser,server.base,{game:x.game,width:390,height:1000,evidenceLabel:'power-build-'+x.game+'-'+x.kind,prepareFixtures:f=>{
   f.state.decks=[];f.state.collection=[];for(const game of ['ptcg','ygo']){f.state.tcg[game].decks=[];f.state.tcg[game].collection=[];}
   f.state.tcg[x.game].decks=[structuredClone(x.input)];Object.assign(f.cache[x.game],structuredClone(x.cards));
   const meta=f.storage['cardforge-meta-v1'][x.game].data;meta.decks=[];meta.top=x.trainerIds.map(id=>({kind:'Trainer',name:x.cards[id].name,pct:100,avg:4}));
  }});
  const bp=builderApp.page,before=await inventorySnapshot(bp);await configureBuilderProviders(bp,x);
  await bp.evaluate(id=>{location.hash='#tdeck/'+id+'/cards';},x.input.id);await bp.waitForFunction(id=>window.__uiTestState.ui.tdeckId===id,x.input.id);
  await bp.locator('.deck-body .lot-name[data-act="tCard"][data-id="'+x.seedId+'"]').first().click();
  await bp.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.type==='tcard'&&!window.__uiTestState.ui.sheetCtx.previewBusy);
  await bp.locator('#sheetBody [data-act="tBuild"][data-id="'+x.seedId+'"]').first().click();await settleBuilder(bp,x.format);
  assert.equal(await bp.locator('[data-change="tBuildCustom"]').inputValue(),'','actual Build starts unlimited, not an implicit25');
  if(x.budget!==null){await bp.locator('[data-change="tBuildCustom"]').fill(String(x.budget));await bp.locator('[data-change="tBuildCustom"]').press('Tab');await bp.waitForFunction(v=>window.__uiTestState.ui.tbuild.custom===v,String(x.budget));await settleBuilder(bp,x.format);}
  let chosen=await builderTier(bp,x.budget),d=chosen.tier.buildDiagnostics,target=bp.locator('#sheetBody .tier').nth(chosen.i);
  assert.equal(d.ownedCopies,0);assert.equal(await inventorySnapshot(bp),before,'actual building never saves or changes ownership');
  if(x.game==='ptcg'){
   if(x.kind==='complete'){assert.equal(chosen.tier.total,60);assert.equal(d.ready,true);assert(d.purchaseEstimate>25);assert(d.purchaseEstimateVerified);assert(chosen.tier.zones.main.find(r=>r.cardId===x.energyId)?.qty>=11);}
   else{assert(chosen.tier.total<60);assert(d.missingEnergy>0);assert.equal(d.ready,false);assert(d.purchaseEstimate<=10);assert.match(await target.innerText(),/intended Energy copies are still missing/);assert.match(await target.innerText(),/power unavailable/);}
  }else if(x.kind==='constraint'){
   assert.equal(chosen.tier.total,40);assert.equal(d.ready,false);assert.equal(d.missingRequiredSeeds[0].id,x.seedId);assert(!chosen.tier.zones.main.some(r=>r.cardId===x.seedId));assert.match(await target.innerText(),/Draft.*constraint shortfall/i);assert.match(await target.innerText(),/required build-around card missing/);
  }else if(x.kind==='unknown'){
   assert.equal(chosen.tier.total,40);assert.equal(d.ready,true);assert.equal(d.unpricedPurchaseCopies,40);assert.equal(d.purchaseEstimate,null);assert.match(await target.innerText(),/Total purchase cost is unverified, not free/);assert.match(await target.locator('[data-act="tTierSave"]').innerText(),/cost unverified/);
  }else{assert.equal(chosen.tier.total,40);assert.equal(d.ready,true);assert.equal(d.purchaseEstimate,40);assert.equal(d.purchaseEstimateVerified,true);}
  if(x.game==='ygo'&&x.kind!=='unknown')for(const row of chosen.tier.zones.main){assert.equal(row.ygoPurchaseSelection.edition,'unlimited');assert(row.ygoPurchaseSelection.productId>0);assert.match(row.ygoPurchaseSelection.printingKey,/^FXQ-EN\d+::Common$/);}
  assert.match(await target.locator('[data-act="tTierSave"]').innerText(),d.ready?/Save as deck|cost unverified/:/Save draft/);
  for(const width of [320,390,768,1440]){await bp.setViewportSize({width,height:1000});await noOverflow(bp,'#sheetBody','actual '+x.game+' '+x.kind+' builder '+width);await capture(bp,'build-'+x.game+'-'+x.kind+'-'+width,'#sheetBody');}
  // Inspect the real expanded card rows, not just a hidden preview count.
  await target.locator('[data-act="tTier"]').click();await bp.waitForFunction(i=>window.__uiTestState.ui.tbuild.openTier===i,chosen.i);target=bp.locator('#sheetBody .tier').nth(chosen.i);
  if(x.game==='ptcg'&&x.kind==='complete')assert.match(await target.innerText(),/Basic Fire Energy/);
  if(x.game==='ygo'&&x.kind!=='unknown')assert.match(await target.innerText(),/Unlimited/);
  await bp.setViewportSize({width:320,height:1000});await noOverflow(bp,'#sheetBody .tier.on','expanded actual builder');await capture(bp,'build-'+x.game+'-'+x.kind+'-expanded','#sheetBody .tier.on');
  await target.locator('[data-act="tTier"]').click();await bp.waitForFunction(()=>window.__uiTestState.ui.tbuild.openTier===null);
  if(x.kind==='unknown'){
   await bp.locator('[data-change="tBuildCustom"]').fill('50');await bp.locator('[data-change="tBuildCustom"]').press('Tab');await bp.waitForFunction(()=>window.__uiTestState.ui.tbuild.custom==='50');await settleBuilder(bp,x.format);
   const finite=await builderTier(bp,50);assert.equal(finite.tier.total,0);assert.equal(finite.tier.buildDiagnostics.ready,false);assert.equal(finite.tier.buildDiagnostics.unpricedPurchaseCopies,0);assert.match(await bp.locator('#sheetBody .tier').nth(finite.i).locator('[data-act="tTierSave"]').innerText(),/Save draft/);
   await capture(bp,'build-ygo-generic-price-finite-draft','#sheetBody');assert.equal(await inventorySnapshot(bp),before);assert.deepEqual(await bp.evaluate(()=>window.__fixtureSensitiveWrites),[]);
   builderResults.push({game:x.game,kind:x.kind,uncapped:d,finite:finite.tier.buildDiagnostics,saved:false,providerReads:await bp.evaluate(()=>window.__powerBuilderReads),diagnostics:builderApp.diagnostics()});
  }else{
   assert.deepEqual(await bp.evaluate(()=>window.__fixtureSensitiveWrites),[]);await installBuilderSaveAudit(bp);
   await target.locator('[data-act="tTierSave"]').click();await bp.waitForFunction(game=>window.__uiTestState.state.tcg[game].decks.length===2,x.game);
   const saved=await bp.evaluate(game=>structuredClone(window.__uiTestState.state.tcg[game].decks.at(-1)),x.game);assert.deepEqual(saved.zones,chosen.tier.zones);assert.equal(saved.buildDiagnostics.ready,d.ready);assert.equal(saved.buildDiagnostics.purchaseBudget,d.purchaseBudget);
   await bp.locator('#sheetBody .sheet-head [data-act="closeSheet"]').click();await bp.evaluate(()=>{location.hash='#decks';});await bp.waitForFunction(()=>window.__uiTestState.ui.view==='decks');
   await bp.evaluate(id=>{location.hash='#tdeck/'+id+'/insights';},saved.id);await bp.waitForFunction(id=>window.__uiTestState.ui.tdeckId===id,saved.id);await bp.locator('.score-panel.power').waitFor();
   const reopened=await bp.evaluate(async({game,format,id})=>{const T=window.__uiTestTcg,formats=(await import(game==='ptcg'?'/ptcg.js':'/ygo.js'))[game==='ptcg'?'PTCG_FORMATS':'YGO_FORMATS'],d=window.__uiTestState.state.tcg[game].decks.find(d=>d.id===id);return T.tcgBuildDiagnostics(game,d,formats.find(f=>f.id===format));},{game:x.game,format:x.format,id:saved.id});
   assert.equal(reopened.ready,d.ready);assert.equal(reopened.purchaseEstimate,d.purchaseEstimate);assert.equal(reopened.ownedCopies,0);assert.match(await bp.locator('.deck-hero').innerText(),/0%\s*owned/);
   if(x.game==='ptcg'&&x.kind==='constraint'){assert.match(await bp.locator('.deck-hero').innerText(),/Incomplete draft/);assert.match(await bp.locator('.deck-hero').innerText(),/power unavailable/);assert.match(await bp.locator('.score-panel.power').innerText(),/Finish the deck before rating Power/);}
   if(x.game==='ygo'&&x.kind==='constraint')assert.match(await bp.locator('.deck-hero').innerText(),/Draft: required build-around card missing: Synthetic YGO build seed/);
   for(const width of [320,390,768,1440]){await bp.setViewportSize({width,height:1000});await noOverflow(bp,'.deck-hero','saved '+x.game+' '+x.kind+' '+width);await noOverflow(bp,'.score-panel.power','saved builder Power '+width);await capture(bp,'build-'+x.game+'-'+x.kind+'-reopened-'+width);}
   const audit=await bp.evaluate(()=>window.__powerBuilderSave),expected=structuredClone(audit.baseline);expected.tcg[x.game].decks.push(saved);assert(audit.writes.length>0);for(const state of audit.writes)assert.deepEqual(state,expected,'every durable builder write appends exactly the requested synthetic deck');assert.equal((await bp.evaluate(()=>window.__fixtureSensitiveWrites)).length,audit.writes.length);
   builderResults.push({game:x.game,kind:x.kind,preview:d,reopened,saved:{id:saved.id,unchangedZones:true,durableWrites:audit.writes.length},providerReads:await bp.evaluate(()=>window.__powerBuilderReads),diagnostics:builderApp.diagnostics()});
  }
  builderApp.health();
  }catch(error){builderResults.splice(resultStart);await recordScenarioFailure('builder-'+x.game+'-'+x.kind,error,builderApp);}
  finally{try{await closeScenarioContext('builder-'+x.game+'-'+x.kind,builderApp);}finally{builderApp=null;}}
 }
 if(builderResults.length===builderProbes.length)checks.push('Actual card-detail Build handlers, real optimizers, previews and explicit save/reopen: Pokémon60 charges unowned Energy while finite10 is a draft; exact-quote YGO40 fits50 while a missing1000 seed remains a constraint-shortfall draft despite40 cards. Generic YGO card references stay unknown: uncapped40, finite50 empty draft. No ownership, private-price or unrelated deck mutation.');
 // A separate Magic context begins with expensive basic art. Only the actual
 // bounded Scryfall adapter supplies a cheaper legal equivalent; rejected rows
 // and has_more demonstrate that the result is not a market-wide minimum.
 try{
 builderApp=await openSearchApp(browser,server.base,{game:'mtg',width:390,height:1000,evidenceLabel:'power-build-checked-basics',prepareFixtures:f=>{
  f.state.decks=[];f.state.collection=[];for(const game of ['ptcg','ygo']){f.state.tcg[game].decks=[];f.state.tcg[game].collection=[];}
  f.catalog={...f.catalog,...checkedBasicCatalog()};f.storage['cardforge-catalog-v1']=f.catalog;
 }});
 const mp=builderApp.page,magicBefore=await inventorySnapshot(mp);let basicQueries=0;
 await mp.route('https://api.scryfall.com/**',async route=>{
  const u=new URL(route.request().url()),pool=checkedBasicCatalog();if(route.request().method()!=='GET')return route.fallback();
  if(u.pathname==='/cards/search'){
   const isBasic=/\bt:basic\b/.test(u.searchParams.get('q')||'');if(isBasic)basicQueries++;
   const data=isBasic?checkedBasicCandidates():Object.values(pool).filter(c=>!/^Basic\b/.test(c.type_line||''));return route.fulfill({contentType:'application/json',body:JSON.stringify({object:'list',data,has_more:isBasic,total_cards:data.length})});
  }
  if(u.pathname==='/cards/named'){const c=pool[cardKey(u.searchParams.get('exact')||u.searchParams.get('fuzzy')||'')];if(c)return route.fulfill({contentType:'application/json',body:JSON.stringify(c)});}
  return route.fallback();
 });
 await mp.evaluate(({seed,cat})=>{const S=window.__uiTestState;S.catalog=cat;Object.assign(S.ui.ideas,{cache:[{commander:cat[seed.commander.toLowerCase()],deck:seed,plan:'Synthetic checked-basic QA',available:0,themeCards:0,slots:1,reason:'Synthetic input, not a generated preview'}],filter:'all',limit:12,ran:true,busy:false,open:null,defaultBudget:undefined,sel:new Set()});location.hash='#decks/ideas';},{seed:ideaSeed,cat:checkedBasicCatalog()});
 await mp.locator('[data-act="openIdea"]').first().click();await mp.waitForFunction(()=>window.__uiTestState.ui.ideas.open?.initialized&&!window.__uiTestState.ui.ideas.open.busy&&!!window.__uiTestState.ui.ideas.open.custom);
 await mp.locator('#sheetBody [data-act="ideaBudget"][data-v="25"]').click();await mp.waitForFunction(()=>!window.__uiTestState.ui.ideas.open.busy&&window.__uiTestState.ui.ideas.open.budget===25);
 const basicResult=await mp.evaluate(async()=>{const S=window.__uiTestState,{cheapestKnown}=await import('/mtg-cheap.js'),{priceOf}=await import('/store.js');return {deck:S.ui.ideas.open.custom,diagnostics:S.ui.ideas.open.diagnostics,message:S.ui.ideas.open.msg,purchaseEstimate:Math.round(S.ui.ideas.open.custom.cards.reduce((n,r)=>n+r.qty*priceOf(r.name),0)*100)/100,basic:S.catalog.plains,price:priceOf('Plains'),quote:cheapestKnown('plains')};});
 assert(basicQueries>0);assert.equal(basicResult.basic.id,'basic-legal-cheap');assert.equal(basicResult.price,.05);assert.equal(basicResult.quote.coverage.hasMore,true);assert.equal(basicResult.quote.coverage.marketComplete,false);assert.equal(sumQty(basicResult.deck.cards),100);assert.equal(basicResult.deck.cards.find(r=>r.name==='Plains').qty,36);assert.equal(basicResult.purchaseEstimate,17.8);assert.match(basicResult.message,/\$17\.80 for new copies currently listed/);assert.equal(basicResult.diagnostics.purchaseEstimateVerified,true);assert.match(await mp.locator('#sheetBody').innerText(),/Complete 100-card list/);
 for(const width of [320,390,768,1440]){await mp.setViewportSize({width,height:1000});await noOverflow(mp,'#sheetBody','checked basic build '+width);await capture(mp,'build-magic-checked-basics-'+width);}
 assert.equal(await inventorySnapshot(mp),magicBefore);assert.deepEqual(await mp.evaluate(()=>window.__fixtureSensitiveWrites),[]);builderApp.health();builderResults.push({game:'mtg',kind:'checked-basics',queries:basicQueries,selectedId:basicResult.basic.id,price:basicResult.price,coverage:basicResult.quote.coverage,diagnostics:basicResult.diagnostics,saved:false,network:builderApp.diagnostics()});
 checks.push('Actual Magic Ideas loading replaces a25 basic-art reference with the lowest eligible checked0.05 equivalent, rejects illegal/wrong-identity/unpriced rows, budgets all36 purchased basics, and completes100 under25. Bounded one-page coverage is recorded, never market-complete; no save or ownership mutation.');

 }catch(error){await recordScenarioFailure('builder-mtg-checked-basics',error,builderApp);}
 finally{try{await closeScenarioContext('builder-mtg-checked-basics',builderApp);}finally{builderApp=null;}}
 if(failures.length)throw new AggregateError(failures.map(f=>new Error(f.scenario+': '+f.error)),failures.length+' isolated Power browser scenario(s) failed; see failures and screenshots.');
 await mkdir(out,{recursive:true});await writeFile(new URL('power-release-browser.json',out),JSON.stringify({status:'passed',evidence:EVIDENCE,checks,screenshots,timings,formatResults,builderResults,coachCalls,askCalls,failures,persistence:magicPersistence},null,2));console.log('PASS: '+checks.join(' '));
}catch(error){await mkdir(out,{recursive:true});if(builderApp||formatApp||app)try{await capture((builderApp||formatApp||app).page,'failure');}catch{}await writeFile(new URL('power-release-browser.json',out),JSON.stringify({status:'failed',evidence:EVIDENCE,checks,screenshots,timings,formatResults,builderResults,coachCalls,askCalls,failures,persistence:magicPersistence,error:String(error.stack||error),diagnostics:(builderApp||formatApp||app)?.diagnostics()},null,2));throw error;}
finally{
 askHold?.release.resolve();const cleanupErrors=[];
 for(const [name,resource]of [['builder context',builderApp?.context],['format context',formatApp?.context],['initial context',app?.context],['browser',browser],['server',server]])if(resource)try{await resource.close();}catch(error){cleanupErrors.push({resource:name,error:String(error.stack||error)});}
 if(cleanupErrors.length){
  await mkdir(out,{recursive:true});const file=new URL('power-release-browser.json',out);let prior={};try{prior=JSON.parse(await readFile(file,'utf8'));}catch{}
  await writeFile(file,JSON.stringify({...prior,status:'failed',evidence:EVIDENCE,checks,screenshots,timings,formatResults,builderResults,coachCalls,askCalls,failures,persistence:magicPersistence,cleanupErrors},null,2));
  throw new AggregateError(cleanupErrors.map(x=>new Error(x.resource+': '+x.error)),'Power browser cleanup failed; every remaining resource was attempted.');
 }
}
