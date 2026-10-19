// Actual UI + production loop/tools/builder. Catalogue and AI are synthetic
// dependencies: this checks orchestration, not a live model's interpretation.
import assert from 'node:assert/strict';
import {startServer,openApp,capture,saveReport,noOverflow,closeSheet,RAW} from './detail-rules-fixtures.mjs';
import {ASK_BUILD_CARDS,SAI,ISLAND,KCI} from './ai-deck-build-fixtures.mjs';
import {prepareMtgDeck} from '../ai-deck-builder.js';
import {cardKey} from '../core.js';
import {homeIntent} from '../home-search.js';
const cards=ASK_BUILD_CARDS.filter(c=>!['ask-off-color','ask-banned'].includes(c.id)).map(c=>({...structuredClone(c),name:c.id===SAI.id?'Goblin Fixture Commander':c.id===ISLAND.id?'Mountain':c.id===KCI.id?'Goblin Fixture Guide':c.name.replace('Artifact Fixture','Goblin Fixture'),type_line:c.id===ISLAND.id?'Basic Land — Mountain':c.id===SAI.id?'Legendary Creature — Goblin':'Creature — Goblin',color_identity:['R'],colors:c.id===ISLAND.id?[]:['R'],mana_cost:c.id===ISLAND.id?'':'{1}{R}',oracle_text:c.id===ISLAND.id?'{T}: Add {R}.':c.oracle_text,prices:{usd:'.10'},...(c.id===ISLAND.id?{produced_mana:['R']}:{}),image_uris:{normal:`https://detail-fixtures.invalid/red-${c.id}.svg`,small:`https://detail-fixtures.invalid/red-${c.id}.svg`,art_crop:`https://detail-fixtures.invalid/red-${c.id}.svg`}}));
const catalog=Object.fromEntries(cards.map(c=>[cardKey(c.name),c])),leader=cards.find(c=>c.id===SAI.id);
const baseArgs={game:'mtg',style:'mono-red goblins',format:'Commander',seed:'',commander:'',budget:50,budget_basis:'total',goal:'strongest',colors:['R'],required_cards:[],excluded_cards:[],candidate_cards:[],avoid_infinite:true};
const prepared=await prepareMtgDeck({...baseArgs,avoid_infinite:false},{meta:n=>catalog[cardKey(n)],resolve:async n=>catalog[cardKey(n)],inv:()=>({available:0}),api:async p=>({data:new URL(p,'https://fixture.invalid').searchParams.get('q').includes('is:commander')?[leader]:cards})});
assert.equal(prepared.result.ready,true);assert.equal(prepared.result.total,100);assert.equal(homeIntent("make me a mono red deck it's easy"),'ask');
if(process.argv.includes('--validate-fixtures')){console.log('PASS: synthetic red Goblin catalogue produces exactly 100 checked cards with known quotes under $50; homepage make/create deck intent reaches Ask. No model or browser started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted-only UI checks; --validate-fixtures is safe locally.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch(),checks=[];
const protectedState=page=>page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,window.__uiTestState.state.decks,window.__uiTestState.state.tcg]));
async function setup(app){let calls=0;const payloads=[];
 await app.context.route('**/api/ai/ask',route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{available:true}});
  calls++;const body=route.request().postDataJSON(),request=body.items.filter(i=>i.role==='user').at(-1)?.content||'';payloads.push(body);
  const args={...baseArgs,budget:/\$50|no infinite|more interactive/i.test(request)?50:0};
  if(/beginner|Yu-Gi-Oh/i.test(request))Object.assign(args,{game:'ygo',style:'fun beginner Blue-Eyes',goal:'fun',budget:25,format:'Advanced (TCG)',seed:'Blue-Eyes White Dragon',colors:[]});
  if(/Charizard/i.test(request))Object.assign(args,{game:'ptcg',style:'Fire',goal:'theme',budget:0,format:'Standard',seed:'Charizard ex',required_cards:['Charizard ex'],colors:[]});
  return route.fulfill({json:{calls:[{type:'function_call',call_id:'fixture-'+calls,name:'build_deck',arguments:JSON.stringify(args)}]}});
 });
 await app.context.route('https://api.scryfall.com/**',route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/rulings'))return route.fulfill({json:{data:[]}});if(u.pathname==='/cards/collection')return route.fulfill({json:{data:route.request().postDataJSON().identifiers.map(x=>catalog[cardKey(x.name)]).filter(Boolean),not_found:[]}});if(u.pathname==='/cards/search')return route.fulfill({json:{object:'list',data:(u.searchParams.get('q')||'').includes('is:commander')?[leader]:cards,has_more:false}});if(u.pathname==='/cards/named')return route.fulfill({json:catalog[cardKey(u.searchParams.get('exact')||u.searchParams.get('fuzzy'))]||leader});return route.fulfill({json:cards.find(c=>u.pathname.endsWith(c.id))||leader});});
 await app.page.evaluate(cs=>{for(const c of cs)window.__uiTestState.catalog[c.name.toLowerCase()]=c;},cards);
 return {get calls(){return calls;},payloads};
}
async function submit(page,text){await page.locator('.ask-input').fill(text);await page.locator('.ask-send').click();await page.locator('.ask-msg.thinking').waitFor({state:'detached'});}
async function newChat(page){await page.getByRole('button',{name:'New chat',exact:true}).click();await page.locator('.ask-empty').waitFor();}
async function noMutation(page,before){assert.equal(await protectedState(page),before,'reviewing a request never saves or changes collection');}
try{
 for(const width of [320,390,768,1440]){let app;try{
  app=await openApp(browser,server.base,{game:'mtg',width,height:1000,hash:'#home',reducedMotion:'reduce'});const {page}=app,model=await setup(app),before=await protectedState(page);
  await page.locator('#homeQ').fill('can you make a red deck using a goblin Commander');await page.locator('#homeQ').press('Enter');
  await page.locator('.ask-dialog [data-ask-show]').waitFor();assert.equal(model.calls,1);assert.match(await page.locator('.ask-log').innerText(),/Checked draft: 100\/100/);assert.doesNotMatch(await page.locator('.ask-log').innerText(),/cannot.*infinite/);await noMutation(page,before);
  await noOverflow(page,'.ask-dialog',`plain Goblin request ${width}`,true);await capture(page,`ai-request-recovery-${width}-goblin-answer`);
  await page.getByRole('button',{name:/Review the deck draft/}).click();await page.waitForFunction(()=>document.querySelector('#sheet').open&&window.__uiTestState.ui.build.results.Commander?.[0]?.total===100);
  assert.match(await page.locator('#sheetBody').innerText(),/Goblin Fixture Commander/);await noOverflow(page,'#sheetBody',`red Goblin draft ${width}`,true);await noMutation(page,before);await closeSheet(page);
  await page.locator('[data-act="homeAsk"]').click();await newChat(page);await page.getByRole('button',{name:'Build me a mono-red deck for $50',exact:true}).click();
  await page.locator('[data-ask-choice="format:Commander"]').waitFor();const count=model.calls;assert.equal(count,2);
  await page.locator('[data-ask-choice="format:Commander"]').click();await page.locator('.ask-msg.thinking').waitFor({state:'detached'});assert.equal(model.calls,count,'format selection runs app builder without another model call');assert.match(await page.locator('.ask-log').innerText(),/Checked draft: 100\/100/);await noMutation(page,before);
  await newChat(page);await submit(page,'Build a mono-red Goblin Commander deck under $50, no infinite combos');
  await page.locator('[data-ask-choice="unverified"]').waitFor();assert.match(await page.locator('.ask-log').innerText(),/You asked for no infinite combos/);await capture(page,`ai-request-recovery-${width}-restriction-choices`);
  const comboCalls=model.calls;await page.locator('[data-ask-choice="unverified"]').click();await page.locator('.ask-msg.thinking').waitFor({state:'detached'});assert.equal(model.calls,comboCalls);assert.match(await page.locator('.ask-log').innerText(),/Unverified draft: 100\/100/);assert.match(await page.locator('.ask-log').innerText(),/Infinite combos have not been verified/);
  await page.getByRole('button',{name:/Review the deck draft/}).click();await page.waitForFunction(()=>document.querySelector('#sheet').open&&window.__uiTestState.ui.build.results.Commander?.[0]?.unverifiedConstraints?.length===1);assert.match(await page.locator('#sheetBody').innerText(),/Needs review/);assert.match(await page.locator('#sheetBody').innerText(),/Save draft/);await noMutation(page,before);await capture(page,`ai-request-recovery-${width}-unverified-preview`);await closeSheet(page);
  await page.locator('[data-act="homeAsk"]').click();await newChat(page);await submit(page,'Build a red Goblin Commander deck under $50');assert.match(await page.locator('.ask-log').innerText(),/Checked draft: 100\/100/);assert.equal(await page.locator('[data-ask-choice="unverified"]').count(),0,'New chat has no leaked constraint');await noMutation(page,before);
  app.health();checks.push({width,plainHomepagePrompt:true,actualBuiltInSuggestion:true,formatChoiceNoExtraModel:true,unverifiedConsentNoExtraModel:true,freshChatClearsRestriction:true,exact100:true,noAutosave:true,syntheticModel:true});
 }catch(error){if(app){console.error('Synthetic app failure context:',JSON.stringify({url:app.page.url(),text:(await app.page.locator('body').innerText()).slice(-4000)}));await capture(app.page,`ai-request-recovery-${width}-failure`).catch(()=>{});}throw error;}finally{await app?.context.close();}}
 let app;try{
  app=await openApp(browser,server.base,{game:'ygo',width:390,height:1000,hash:'#home',reducedMotion:'reduce'});const model=await setup(app),before=await protectedState(app.page);await app.page.locator('[data-act="homeAsk"]').click();await submit(app.page,"make me a fun Yu-Gi-Oh deck that doesn't cost that much is good for beginners");
  await app.page.locator('[data-ask-choice="budget:50"]').waitFor();assert.doesNotMatch(await app.page.locator('.ask-log').innerText(),/budget 0|Correct only|repeated the same lookup/);await capture(app.page,'ai-request-recovery-ygo-budget-choice');await app.page.locator('[data-ask-choice="budget:50"]').click();await app.page.locator('[data-ask-choice="format:Advanced (TCG)"]').waitFor();await app.page.locator('[data-ask-choice="format:Advanced (TCG)"]').click();await app.page.getByRole('button',{name:/Open the deck builder/}).waitFor();assert.equal(model.calls,1);assert.match(await app.page.locator('.ask-log').innerText(),/Blue-Eyes White Dragon/);await noMutation(app.page,before);await app.page.getByRole('button',{name:/Open the deck builder/}).click();await app.page.waitForFunction(()=>document.querySelector('#sheet').open&&window.__uiTestState.ui.tbuild?.seed==='89631139'&&window.__uiTestState.ui.tbuild.custom==='50');await noMutation(app.page,before);await capture(app.page,'ai-request-recovery-ygo-existing-builder');app.health();checks.push({ygoScreenshotPrompt:true,budgetThenFormat:true,funPreferenceSupported:true,oneSyntheticModelCall:true,existingBuilderOpenedWithExactSeedAndBudget:true});
 }finally{await app?.context.close();}
 try{
  app=await openApp(browser,server.base,{game:'ptcg',width:390,height:1000,hash:'#home',reducedMotion:'reduce'});const model=await setup(app),before=await protectedState(app.page),raw={...structuredClone(RAW.ptcg[0]),id:'sv08-999',localId:'999',name:'Charizard ex'};
  await app.context.route('https://api.tcgdex.net/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({json:path==='/v2/en/cards'?[raw]:path.startsWith('/v2/en/cards/')?raw:[]});});
  await app.page.locator('[data-act="homeAsk"]').click();await submit(app.page,'make me a deck that stars Charizard ex in Standard');await app.page.getByRole('button',{name:/Open the deck builder/}).waitFor();assert.match(await app.page.locator('.ask-log').innerText(),/Charizard ex/);assert.doesNotMatch(await app.page.locator('.ask-log').innerText(),/cannot yet enforce/);assert.equal(model.calls,1);await noMutation(app.page,before);await capture(app.page,'ai-request-recovery-charizard-handoff');await app.page.getByRole('button',{name:/Open the deck builder/}).click();await app.page.waitForFunction(()=>document.querySelector('#sheet').open&&window.__uiTestState.ui.tbuild?.seed==='sv08-999');await noMutation(app.page,before);await capture(app.page,'ai-request-recovery-charizard-existing-builder');app.health();checks.push({charizardScreenshotPrompt:true,themeAndExactSeedSupported:true,oneSyntheticModelCall:true,noAutosave:true,existingBuilderOpenedWithExactSeed:true});
 }finally{await app?.context.close();}
 await saveReport('ai-request-recovery-browser',checks);
}catch(error){await saveReport('ai-request-recovery-browser',checks,error);throw error;}finally{await browser.close();await server.close();}
