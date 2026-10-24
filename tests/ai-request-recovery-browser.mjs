// Actual UI + production loop/tools/builder. Catalogue and AI are synthetic
// dependencies: this checks orchestration, not a live model's interpretation.
import assert from 'node:assert/strict';
import {startServer,openApp,capture,saveReport,noOverflow,closeSheet,RAW} from './detail-rules-fixtures.mjs';
import {ASK_BUILD_CARDS,SAI,ISLAND,KCI} from './ai-deck-build-fixtures.mjs';
import {prepareMtgDeck} from '../ai-deck-builder.js';
import {cardKey} from '../core.js';
import {homeIntent} from '../home-search.js';
const cards=ASK_BUILD_CARDS.filter(c=>!['ask-off-color','ask-banned'].includes(c.id)).map(c=>({...structuredClone(c),name:c.id===SAI.id?'Goblin Fixture Commander':c.id===ISLAND.id?'Mountain':c.id===KCI.id?'Goblin Fixture Guide':c.name.replace('Artifact Fixture','Goblin Fixture'),type_line:c.id===ISLAND.id?'Basic Land — Mountain':c.id===SAI.id?'Legendary Creature — Goblin':'Creature — Goblin',color_identity:['R'],colors:c.id===ISLAND.id?[]:['R'],mana_cost:c.id===ISLAND.id?'':'{1}{R}',oracle_text:c.id===ISLAND.id?'{T}: Add {R}.':c.oracle_text,prices:{usd:'.10'},...(c.id===ISLAND.id?{produced_mana:['R']}:{}),image_uris:{normal:`https://detail-fixtures.invalid/red-${c.id}.svg`,small:`https://detail-fixtures.invalid/red-${c.id}.svg`,art_crop:`https://detail-fixtures.invalid/red-${c.id}.svg`}}));
for(const c of cards)c.legalities.standard='legal';
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
  if(request==='Show one fixture card')return route.fulfill({json:{answer:{text:'This is the verified fixture card.',source:'app',show:[{kind:'card',game:'mtg',ref:leader.name,label:leader.name}],suggestions:[]}}});
  const args={...baseArgs,budget:/\$50|no infinite|more interactive/i.test(request)?50:0};
  if(/can you make.*goblin Commander/i.test(request))Object.assign(args,{style:'aggressive',format:'',seed:'Goblin',commander:'',required_cards:['Goblin'],budget:0,avoid_infinite:false});
  if(/beginner|Yu-Gi-Oh/i.test(request))Object.assign(args,{game:'ygo',style:'fun beginner Blue-Eyes',goal:'fun',budget:25,format:'Advanced (TCG)',seed:'Blue-Eyes White Dragon',colors:[]});
  if(/Charizard/i.test(request))Object.assign(args,{game:'ptcg',style:'Fire',goal:'theme',budget:0,format:'Standard',seed:'Charizard ex',required_cards:['Charizard ex'],colors:[]});
  return route.fulfill({json:{calls:[{type:'function_call',call_id:'fixture-'+calls,name:'build_deck',arguments:JSON.stringify(args)}]}});
 });
 await app.context.route('https://api.scryfall.com/**',route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/rulings'))return route.fulfill({json:{data:[]}});if(u.pathname==='/cards/collection')return route.fulfill({json:{data:route.request().postDataJSON().identifiers.map(x=>catalog[cardKey(x.name)]).filter(Boolean),not_found:[]}});if(u.pathname==='/cards/search')return route.fulfill({json:{object:'list',data:(u.searchParams.get('q')||'').includes('is:commander')?[leader]:cards,has_more:false}});if(u.pathname==='/cards/named')return route.fulfill({json:catalog[cardKey(u.searchParams.get('exact')||u.searchParams.get('fuzzy'))]||leader});return route.fulfill({json:cards.find(c=>u.pathname.endsWith(c.id))||leader});});
 // The shared fixture marks its cards as already tracked. Extend that same
 // snapshot to this synthetic catalogue before its card-detail views can open;
 // otherwise the normal price-history registration trips the write guard.
 await app.page.evaluate(cs=>{const key='cardstashy-watch-sent-v1',sent=JSON.parse(localStorage.getItem(key)||'{}');for(const c of cs){window.__uiTestState.catalog[c.name.toLowerCase()]=c;sent['mtg:'+c.id]=Date.now();}localStorage.setItem(key,JSON.stringify(sent));},cards);
 return {get calls(){return calls;},payloads};
}
async function submit(page,text){await page.locator('.ask-input').fill(text);await page.locator('.ask-send').click();await page.locator('.ask-msg.thinking').waitFor({state:'detached'});}
async function newChat(page){if(await page.locator('#sheet[open]').count())await closeSheet(page);if(!await page.locator('.ask-dialog[open]').count())await page.locator('[data-act="homeAsk"]').click();await page.getByRole('button',{name:'New chat',exact:true}).click();await page.locator('.ask-empty').waitFor();}
async function noMutation(page,before){assert.equal(await protectedState(page),before,'reviewing a request never saves or changes collection');}
try{
 for(const width of [320,390,768,1440]){let app;try{
  app=await openApp(browser,server.base,{game:'mtg',width,height:1000,hash:'#home',reducedMotion:'reduce'});const {page}=app,model=await setup(app),before=await protectedState(page);
  await page.locator('#homeQ').fill('can you make a red deck using a goblin Commander');await page.locator('#homeQ').press('Enter');
  await page.locator('#sheet[open] .deck-flow-result').waitFor();assert.equal(model.calls,1);assert.match(await page.locator('#sheetBody').innerText(),/100 main/);assert.match(await page.locator('#sheetBody').innerText(),/Goblin Fixture Commander/);assert.equal(await page.locator('.ask-dialog[open]').count(),0);assert.match(await page.locator('#sheetBody').innerText(),/Tribal plan partly established|Tribal plan not established/,'a Goblin label without a mapped tribal package stays qualified');await noMutation(page,before);
  await noOverflow(page,'#sheet',`plain Goblin request ${width}`,true);await page.locator('.deck-flow-result [data-act="flowSave"]').scrollIntoViewIfNeeded();await capture(page,`ai-request-recovery-${width}-goblin-answer`);
  await newChat(page);await page.getByRole('button',{name:'Build me a mono-red deck for $50',exact:true}).click();await page.locator('#sheet[open] .deck-flow-result').waitFor();assert.equal(model.calls,2);assert.match(await page.locator('.deck-flow-result').innerText(),/Standard/i);assert.match(await page.locator('.deck-flow-result').innerText(),/60 main/);assert.match(await page.locator('.deck-flow-result').innerText(),/Cap \$50\.00 · \$44\.00 below cap/);assert.equal(await page.locator('[data-ask-choice]').count(),0,'visible supported default needs no repeated setup');await noMutation(page,before);
  await newChat(page);await submit(page,'Build a mono-red Goblin Commander deck under $50, no infinite combos');assert.match(await page.locator('.ask-log').innerText(),/cannot verify.*infinite combo/i);assert.equal(await page.locator('[data-act="flowSave"]').count(),0);assert.equal(await page.locator('.deck-flow-result').count(),0,'unsupported requirement is not a successful deck');await noMutation(page,before);await capture(page,`ai-request-recovery-${width}-restriction-failure`);
  await newChat(page);await submit(page,'Build a mono-red Commander deck with only Goblin creatures under $50');await page.locator('#sheet[open] .deck-flow-result').waitFor();assert.match(await page.locator('.deck-flow-result').innerText(),/100 main/);assert.match(await page.locator('.deck-flow-result').innerText(),/Goblin creature cards only/);assert.match(await page.locator('.deck-flow-result').innerText(),/Some request checks remain unmet or unverified/,'a legal typed list is not a fully verified strategy');assert.equal(await page.locator('[data-ask-choice="unverified"]').count(),0,'New chat has no leaked constraint');await noMutation(page,before);const hero=page.locator('#sheet[open] .deck-flow-result .cs-hero img.cs-art');assert.equal(await hero.count(),1,'generated result retains the shared artwork header');assert.equal(await hero.getAttribute('src'),leader.image_uris.art_crop,'the Commander cover uses the selected commander artwork');await noOverflow(page,'#sheet',`Artwork result ${width}`,true);await page.locator('.deck-flow-result [data-act="flowSave"]').scrollIntoViewIfNeeded();await capture(page,`ai-request-recovery-${width}-artwork-result`);
  await closeSheet(page);
  // Renderer-only fixtures exercise both deck row views at the real sheet width.
  for(const kind of ['idea','proven']){
   await page.evaluate(async ({kind,cards})=>{
    const S=window.__uiTestState,V=await import('/views.js'),T=await import('/tcg.js');
    const cs=cards.slice(0,4).map((c,i)=>({...c,set:'TST',collector_number:String(i+1),rarity:'rare'}));for(const c of cs)S.catalog[c.name.toLowerCase()]=c;
    const rows=cs.map(c=>({name:c.name,qty:1,key:c.name.toLowerCase(),kind:'creature',price:.1,owned:0}));let html;
    if(kind==='idea')html=V.ideaSheet({commander:cs[0],plan:'Goblin fixture'}, {id:'render-only',name:'Render fixture',format:'Commander',commander:cs[0].name,cards:rows,side:[]},{budget:50,busy:false,msg:''},new Set([cs[0].name]));
    else{Object.assign(T.proven,{spec:{g:'mtg',title:'Render fixture',sub:'',evidence:'Synthetic layout fixture',rows,lists:[],printingFor:r=>cs.find(c=>c.name===r.name),imageFor:r=>cs.find(c=>c.name===r.name).image_uris.normal},mode:'original',busy:false,msg:''});html=T.provenSheetHtml();}
    const sheet=document.querySelector('#sheet');document.querySelector('#sheetBody').innerHTML=html;if(!sheet.open)sheet.showModal();
   },{kind,cards});
   assert.equal(await page.locator('.deck-compact-row').count(),4);assert.equal(await page.locator('.deck-printing').count(),4);
   const geometry=await page.locator('.deck-compact-row').evaluateAll(rows=>rows.map(n=>{const r=n.getBoundingClientRect(),name=n.querySelector('.deck-compact-copy>b'),a=n.querySelector('img'),nr=name.getBoundingClientRect(),ar=a?.getBoundingClientRect();return {width:r.width,nameWidth:nr.width,artWidth:ar?.width,artHeight:ar?.height,overflow:n.scrollWidth>n.clientWidth+1};}));
   for(const g of geometry){assert(g.width>200&&g.nameWidth>65&&g.artHeight>g.artWidth&&!g.overflow,`${kind} readable portrait tile at ${width}: ${JSON.stringify(g)}`);}
   await noOverflow(page,'#sheetBody',`${kind} compact rows ${width}`,true);await page.locator('.deck-compact-row').first().scrollIntoViewIfNeeded();await capture(page,`ai-request-recovery-${width}-${kind}-compact`);await page.evaluate(()=>document.querySelector('#sheet').close());
  }
  // Lone card answers reuse the row shell and open the existing card sheet in both themes.
  for(const theme of ['dark','light']){
   await page.evaluate(async theme=>(await import('/settings-theme.js')).applyTheme(theme),theme);
   await page.locator('[data-act="homeAsk"]').click();await newChat(page);await submit(page,'Show one fixture card');
   const row=page.locator('.ask-dialog .ask-card-row');await row.waitFor();assert.equal(await row.count(),1);
   const geometry=await row.evaluate(n=>{const r=n.getBoundingClientRect(),art=n.querySelector('.ask-card-thumb').getBoundingClientRect(),style=getComputedStyle(n);return {height:r.height,artHeight:art.height,artWidth:art.width,background:style.backgroundColor,color:style.color,overflow:n.scrollWidth>n.clientWidth+1};});
   assert(geometry.height<180&&geometry.artHeight<=90&&geometry.artHeight>geometry.artWidth&&!geometry.overflow,JSON.stringify({theme,width,geometry}));
   const expected=await row.evaluate(()=>{const sample=document.createElement('span');sample.style.cssText='background:var(--surface);color:var(--text)';document.body.append(sample);const style=getComputedStyle(sample),result={background:style.backgroundColor,color:style.color};sample.remove();return result;});assert.equal(geometry.background,expected.background,theme+' shared surface');assert.equal(geometry.color,expected.color,theme+' shared text');
   assert.equal(await row.locator('[data-change],input,[data-act]').count(),0,'preview has no editing controls');
   await noOverflow(page,'.ask-dialog',`single card ${theme} ${width}`,true);await capture(page,`ai-request-recovery-${width}-single-card-${theme}`);
   await row.click();await page.locator('#sheet[open]').waitFor();assert.match(await page.locator('#sheetBody').innerText(),new RegExp(leader.name));await noMutation(page,before);await closeSheet(page);
  }
  app.health();checks.push({width,plainHomepagePrompt:true,actualBuiltInSuggestion:true,visibleDefaultFormat:true,unsupportedRequirementFailsHonestly:true,freshChatClearsRestriction:true,exact100:true,noAutosave:true,syntheticModel:true});
 }catch(error){if(app){console.error('Synthetic app failure context:',JSON.stringify({url:app.page.url(),text:(await app.page.locator('body').innerText()).slice(-4000)}));await capture(app.page,`ai-request-recovery-${width}-failure`).catch(()=>{});}throw error;}finally{await app?.context.close();}}
 // Sparse all-game providers must not make a fragment look successful. Full
 // deterministic Pokémon and Yu-Gi-Oh! candidate checks live in the accounting suite.
 for(const [game,prompt] of [['ygo',"make me a fun Yu-Gi-Oh deck that doesn't cost that much is good for beginners"],['ptcg','make me a deck that stars Charizard ex']]){let app;try{
  app=await openApp(browser,server.base,{game,width:390,height:1000,hash:'#home',reducedMotion:'reduce'});const model=await setup(app),page=app.page,before=await protectedState(page);
  if(game==='ptcg'){const raw={...structuredClone(RAW.ptcg[0]),id:'sv08-999',localId:'999',name:'Charizard ex',types:['Fire']};await app.context.route('https://api.tcgdex.net/**',route=>{const path=new URL(route.request().url()).pathname;return route.fulfill({json:path==='/v2/en/cards'?[raw]:path.startsWith('/v2/en/cards/')?raw:[]});});}
  await page.locator('[data-act="homeAsk"]').click();await submit(page,prompt);
  if(game==='ygo'){await page.locator('[data-ask-choice="budget:50"]').waitFor();await page.locator('[data-ask-choice="budget:50"]').click();await page.locator('.ask-msg.thinking').waitFor({state:'detached'});}
  assert.equal(await page.locator('.deck-flow-result,[data-act="flowSave"]').count(),0);assert.equal(await page.locator('#sheet[open]').count(),0);assert.doesNotMatch(await page.locator('.ask-log').innerText(),/Open the deck builder|One complete list/);assert.match(await page.locator('.ask-log').innerText(),/could not|couldn’t|cannot|missing|unavailable|not verified|not found|couldn't|incomplete|failed/i);assert.equal(model.calls,1);await noMutation(page,before);await capture(page,'ai-request-recovery-'+game+'-missing-pool');app.health();checks.push({game,missingDataHonest:true,noPartialDeck:true,noSetupHandoff:true,oneSyntheticModelCall:true,noAutosave:true});
 }finally{await app?.context.close();}}
 await saveReport('ai-request-recovery-browser',checks);
}catch(error){await saveReport('ai-request-recovery-browser',checks,error);throw error;}finally{await browser.close();await server.close();}
