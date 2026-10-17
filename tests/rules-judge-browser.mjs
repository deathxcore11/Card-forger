// Rules guide Q&A integration in the actual app shell, for hosted CI only.
// --validate-fixtures runs production retrieval/validation against local corpora
// without importing Playwright, launching a browser, or calling any AI provider.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAMES,WIDTHS,ROOT,CARDS,validateFixtures,startServer,openApp,navigate,inventorySnapshot,noOverflow,capture,saveReport,isAllowedRulesFixtureRequest} from './detail-rules-fixtures.mjs';
import {prepareRulesQuestion,finishRulesQuestion} from '../ai-rules-route.js';
import {RULE_VERSIONS,entryReference,resolveRuleReference} from '../rule-reference.js';
import {loadServerRulePack} from '../rules-retrieval.js';
import {ruleCardContext} from '../rule-dex.js';
import {validateRulesResponse,rulesContext} from '../ai-rules.js';

const CASES={
 mtg:{format:'Commander',alternative:'Modern',id:'504.1',question:'Explain the draw step in rule 504.1.',short:'At the start of the draw step, the active player draws a card.',explanation:'That initial draw is a turn-based action. The cited rule says it does not use the stack.',example:'For this example, the turn has reached the draw step: the active player draws a card.',detail:'This excerpt describes the turn-based draw, not every effect that might draw cards.'},
 ptcg:{format:'Standard',alternative:'Expanded',id:'0-p10',question:'Explain the draw action in rule 0-p10.',short:'Start your turn by drawing a card.',explanation:'If the deck is empty at the beginning of the turn and the player cannot draw, this rule says the opponent wins.',example:'For this example, the turn begins with cards still in the deck: draw a card to start the turn.',detail:'The same page also describes placing Basic Pokémon onto the Bench. An individual card interaction needs its full wording.'},
 ygo:{format:'Advanced (TCG)',alternative:'Traditional (TCG)',id:'0-p25',question:'Explain Chains and Spell Speed in rule 0-p25.',short:'A Chain organizes the resolution of multiple card effects.',explanation:'The indexed legacy rulebook describes responding to an activated card effect before that effect takes effect.',example:'For this example, a player activates an effect and the opponent wants to respond. The relevant response and Spell Speed restrictions still need to be checked.',detail:'These are legacy excerpts. They cannot establish every current interaction or later activation change.'}
};
const EVIDENCE='Guide prose and model outputs are deterministic synthetic fixtures, not a quality evaluation of a live model. Every displayed citation is reconstructed from the real integrity-pinned corpus. No provider call, payment or external mutation is made.';
const ASSETS={async fetch(request){const url=new URL(request.url);assert.equal(url.origin,'https://cardstashy.rules.invalid');assert.match(url.pathname,/^\/rulebooks\/(mtg|ptcg|ygo)-rules-v1\.json\.gz$/);return new Response(await readFile(resolve(ROOT,'.'+url.pathname)));}};
const env={ASSETS,OPENAI_MODEL:'deterministic-fixture-never-contacted'};
function requestFor(game,overrides={}){return {mode:'rules',game,format:CASES[game].format,version:RULE_VERSIONS[game],question:CASES[game].question,cards:[],references:[],...overrides};}
function cardContext(game,{complete=true}={}){const raw=ruleCardContext(game,CARDS[game][0]);return rulesContext({game,cards:[{...raw,complete,text:complete?raw.text:''}]}).cards[0];}
function modelOutput(prepared,{kind='answered',tag=''}={}){
 const c=CASES[prepared.context.game],p=prepared.passages.find(p=>p.reference.entryId.replace(/\.$/,'')===c.id)||prepared.passages[0];assert(p,'Actual retriever returned evidence');
 const text=p.text,start=prepared.context.game==='ptcg'?text.indexOf('Start your turn'):prepared.context.game==='ygo'?text.indexOf('Chains are a way'):0;
 const quote=text.slice(Math.max(0,start),Math.max(0,start)+Math.min(500,text.length));
 const section=text=>({text,citationIds:text?[p.id]:[]});
 const answer={status:kind==='needs_context'?'needs_context':kind==='insufficient_evidence'?'insufficient_evidence':'answered',shortAnswer:section(c.short),explanation:[section(c.explanation+(tag?' Deterministic response '+tag+'.':''))],example:section(c.example),details:[section(c.detail)],questions:kind==='needs_context'?['Whose turn is it, what is on the board, and what exact effect is waiting to resolve?']:[],limitations:['Only the supplied indexed excerpt is used in this deterministic test.'],citations:[{id:p.id,quote}]};
 if(kind==='bad-provider-citation')answer.citations[0].id=prepared.context.game+':0:invented-rule';
 if(kind==='bad-provider-quote')answer.citations[0].quote='This fabricated sentence does not appear in any cited rule.';
 return {output:[{type:'function_call',name:'rules_answer',arguments:JSON.stringify(answer)}]};
}
function createResponder(){
 const scenarios=new Map(),providerCalls=[],requests=[];
 const respond=async body=>{
  const scenario=scenarios.get(body.question)||{};requests.push(structuredClone(body));
  try{
   const prepared=await prepareRulesQuestion(body,env);let result;
   if(prepared.immediate)result=prepared.immediate;
   else{providerCalls.push({game:body.game,format:body.format,question:body.question});result=finishRulesQuestion(modelOutput(prepared,scenario),prepared);}
   // Deliberately damaged network responses test client defense after the real
   // server trust path above has already validated the original answer.
   if(scenario.kind==='corrupt-game')result.context.game=body.game==='mtg'?'ptcg':'mtg';
   if(scenario.kind==='corrupt-format')result.context.format='Wrong fixture format';
   if(scenario.kind==='corrupt-reference')result.answer.citations[0].reference={...result.answer.citations[0].reference,game:body.game==='mtg'?'ptcg':'mtg'};
   if(scenario.kind==='fabricated-reference')result.answer.citations[0].reference.entryId='fixture-not-a-real-rule';
   if(scenario.kind==='corrupt-quote')result.answer.citations[0].quote='A fabricated quote, never official evidence.';
   return {status:200,body:result};
  }catch(error){return {status:error.status||500,body:{message:error.message}};}
 };
 return {respond,providerCalls,requests,set(question,scenario){scenarios.set(question,scenario);}};
}
async function validateJudgeFixtures(){
 const base='http://127.0.0.1:3210',good=new URL(base+'/api/ai/ask');
 assert(isAllowedRulesFixtureRequest(base,good,'POST',{mode:'rules'},true));
 for(const [url,method,body,enabled] of [[good,'POST',{mode:'rules'},false],[good,'POST',{mode:'search'},true],[good,'PUT',{mode:'rules'},true],[new URL(base+'/api/ai/ask?mode=rules'),'POST',{mode:'rules'},true],[new URL('https://cardstashy.com/api/ai/ask'),'POST',{mode:'rules'},true],[new URL(base+'/api/payments'),'POST',{mode:'rules'},true]])assert.equal(isAllowedRulesFixtureRequest(base,url,method,body,enabled),false,'No mutation except explicitly enabled, exact local Rules POST');
 for(const game of GAMES){
  const mock=createResponder(),request=requestFor(game),response=await mock.respond(request);assert.equal(response.status,200);assert.equal(response.body.answer.status,'answered');assert.equal(mock.providerCalls.length,1);
  assert.deepEqual(response.body.context,{game,format:CASES[game].format,version:RULE_VERSIONS[game]});
  const citation=response.body.answer.citations[0],pack=await loadServerRulePack(env,game),canonical=resolveRuleReference(pack,citation.reference);assert(canonical?.entry);assert.equal(canonical.entry.id.replace(/\.$/,''),CASES[game].id);assert.equal(citation.destination.url,canonical.destination.url);await validateRulesResponse(response.body,request,{load:()=>Promise.resolve(pack)});
  for(const kind of ['corrupt-game','corrupt-format','corrupt-reference','fabricated-reference','corrupt-quote']){const question=CASES[game].question+' '+kind;mock.set(question,{kind});const corrupted=await mock.respond(requestFor(game,{question}));assert.equal(corrupted.status,200);await assert.rejects(validateRulesResponse(corrupted.body,request,{load:()=>Promise.resolve(pack)}),/match|verify/,'Client rejects a damaged response after server validation');}
  for(const kind of ['bad-provider-citation','bad-provider-quote']){const question=CASES[game].question+' '+kind;mock.set(question,{kind});const rejected=await mock.respond(requestFor(game,{question}));assert.equal(rejected.status,502);assert(!rejected.body.answer,'Server rejects fabricated evidence rather than showing a ruling');}
  for(const [question,expected] of [['What does this card do?','needs_context'],['Is this legal in the current format?','insufficient_evidence'],[game==='ptcg'?'How does Magic priority work?':'How does Pokémon Checkup work?','insufficient_evidence']]){const count=mock.providerCalls.length,res=await mock.respond(requestFor(game,{question}));assert.equal(res.body.answer.status,expected);assert.equal(mock.providerCalls.length,count,'Unsupported/missing-context request never invokes even the mock provider');}
  const exact=cardContext(game),incomplete=await mock.respond(requestFor(game,{cards:[{...exact,text:'',complete:false}]}));assert.equal(incomplete.body.answer.status,'needs_context');
  const cross=await mock.respond(requestFor(game,{cards:[{...exact,game:game==='mtg'?'ptcg':'mtg'}]}));assert.equal(cross.status,400);
  const selected=await mock.respond(requestFor(game,{cards:[exact],references:[entryReference(game,CASES[game].id)]}));assert.equal(selected.status,200);assert.equal(selected.body.answer.citations[0].reference.game,game);
  const prior=[CASES[game].question],prepared=await prepareRulesQuestion(requestFor(game,{question:'It is my turn with no other effects waiting.',priorQuestions:prior}),env);assert.deepEqual(JSON.parse(prepared.payload.input[0].content).priorPlayerQuestions,prior);assert.deepEqual(prepared.payload.input.map(message=>message.role),['user'],'Only the explicit player scenario enters the provider input');
  assert.equal((await mock.respond(requestFor(game,{priorQuestions:Array(4).fill('Too many earlier statements')}))).status,400);assert.equal((await mock.respond({...requestFor(game),history:[{role:'assistant',content:'Untrusted earlier answer'}]})).status,400);
 }
 console.log('Rules Q&A fixture boundary, all game/format/card contexts, real corpus retrieval, exact canonical sources, no-cost clarification, and rejected fabricated server citations passed. No browser or AI provider started.');
}
console.log(await validateFixtures());await validateJudgeFixtures();
if(process.argv.includes('--validate-fixtures'))process.exit(0);

const {chromium}=await import('playwright');
const server=await startServer();let browser,failure;const report=[EVIDENCE];
const D='.rules-ask-dialog[open]';
async function flush(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function openHub(app){
 const {page}=app;await navigate(page,'#decks/ideas');await page.locator('#content [data-act="learnGame"]').first().click();await page.locator('#sheet[open] [data-learning-root]').waitFor();
 await page.locator('#sheet [data-act="askRules"]').click();await page.locator(D).waitFor();
 assert.equal(await page.locator(D+' [data-learning-root]').getAttribute('data-game'),app.fixtures.state.settings.game);
 assert.equal(await page.locator(D+' [data-rules-format]').inputValue(),'','The hub never silently chooses a format');
 assert.equal(await page.evaluate(()=>document.activeElement?.matches('[data-rules-close]')),true,'Opening uses a noneditable control, not keyboard focus');
}
async function selectFormat(page,value){
 const option=await page.locator(D+' [data-rules-format] option').evaluateAll((nodes,value)=>nodes.filter(n=>n.value===value).map(n=>({value:n.value,label:n.label})),value);assert.equal(option.length,1,`Exactly one canonical Rules format value ${value} exists`);
 await page.locator(D+' [data-rules-format]').click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:option[0].label,exact:true}).click();
 await page.waitForFunction(value=>{const n=document.querySelector('.rules-ask-dialog[open] [data-rules-format]');return n?.isConnected&&n.value===value;},value);
}
async function submit(app,question){
 const {page}=app;await page.locator(D+' .ask-input').fill(question);const request=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/ai/ask'&&r.method()==='POST');await page.locator(D+' .ask-send').click();await request;
}
async function settled(page,answers=1,errors=0){await page.waitForFunction(({answers,errors})=>{const d=document.querySelector('.rules-ask-dialog[open]'),log=d?.querySelector('.rules-ai-log');return d?.isConnected&&log?.getAttribute('aria-busy')==='false'&&log.querySelectorAll('.rules-ai-answer').length===answers&&log.querySelectorAll('.ask-msg.error').length===errors;},{answers,errors});}
function answer(page){return page.locator(D+' .rules-ai-answer').last();}
async function newChat(page){await page.locator(D+' [data-rules-new]').click();await page.locator(D+' .ask-empty').waitFor();assert.equal(await page.locator(D+' .rules-ai-answer').count(),0);}
async function fullDisclosures(page){
 const details=answer(page).locator('details');for(let i=0;i<await details.count();i++){const item=details.nth(i);if(await item.getAttribute('open')===null)await item.locator(':scope > summary').click();}
 assert(await answer(page).locator('.rules-ai-details').isVisible());assert(await answer(page).locator('.rules-ai-limits').isVisible());assert(await answer(page).locator('.rule-source-text').isVisible());
}
async function sourceRoundTrip(app,game){
 const {page}=app,citation=page.locator(D+' [data-rules-citation]').first(),beforeRequests=app.rulesRequests.length;
 await citation.scrollIntoViewIfNeeded();await citation.focus();const before=await page.locator(D+' .rules-ai-log').evaluate(log=>({text:log.textContent,top:log.scrollTop,open:[...log.querySelectorAll('details')].map(d=>d.open)}));await citation.click();
 const call=app.rulesRequests.at(-1),ref=call.response.answer.citations[0].reference,pack=await loadServerRulePack(env,game),canonical=resolveRuleReference(pack,ref),id=canonical.entry.id;
 await page.waitForFunction(id=>{const d=document.querySelector('.rules-ask-dialog[open]'),root=d?.querySelector('[data-rule-destination]'),entry=root?.querySelector(`[data-rule-entry="${id}"]`),heading=root?.querySelector('[data-rule-heading]');const r=heading?.getBoundingClientRect(),e=entry?.getBoundingClientRect();return d?.isConnected&&!root.hidden&&entry?.isConnected&&entry.getClientRects().length>0&&heading===document.activeElement&&r.top>=0&&r.bottom<=innerHeight&&e.top<innerHeight&&e.bottom>0;},id);
 assert.equal(await page.locator(D+' [data-rule-destination] input,'+D+' [data-rule-destination] textarea,'+D+' [data-rule-destination] [contenteditable="true"]').count(),0);
 assert.equal(await page.evaluate(()=>document.activeElement?.matches('input,textarea,[contenteditable="true"]')),false,'Canonical source opens without search or keyboard focus');
 assert.equal(await page.locator(D+' [data-rule-search]').count(),0,'Citation navigation does not substitute a search box');
 const link=page.locator(D+' [data-rule-destination] a[data-source-kind]').first();assert.equal(await link.getAttribute('href'),canonical.destination.url);assert.equal(await link.getAttribute('data-source-kind'),game==='ptcg'?'official-page':'pdf');if(game==='ptcg')assert(!canonical.destination.url.includes('#page='));else assert.match(canonical.destination.url,/#page=\d+$/);
 assert((await page.locator(D+' [data-rule-destination] .rule-passages').innerText()).length>50);await noOverflow(page,D,`${game} guide exact source`);await capture(page,`rules-judge-${game}-exact-source`);
 await page.locator(D+' [data-rule-back]').click();await page.locator(D+' [data-learning-home]').waitFor({state:'visible'});
 const after=await page.locator(D+' .rules-ai-log').evaluate(log=>({text:log.textContent,top:log.scrollTop,open:[...log.querySelectorAll('details')].map(d=>d.open)}));assert.equal(after.text,before.text,'Back restores the same complete answer');assert.deepEqual(after.open,before.open,'Back preserves optional explanation/excerpt disclosures');assert(Math.abs(after.top-before.top)<=2,`Back preserves answer scroll: ${before.top} → ${after.top}`);assert.equal(await citation.evaluate(n=>n.isConnected&&n===document.activeElement),true,'Back focuses the original current citation button');assert.equal(app.rulesRequests.length,beforeRequests,'Opening and returning from an exact source cannot submit AI');
}
async function layout(app,game){
 const {page}=app;await fullDisclosures(page);
 for(const width of WIDTHS){await page.setViewportSize({width,height:1000});await page.locator(D+' .rules-ai-log').evaluate(n=>{n.scrollTop=0;});await noOverflow(page,D,`${game} guide ${width}px`);assert(await page.locator(D+' .ask-input').isVisible());await capture(page,`rules-judge-${game}-${width}`);}
 await page.setViewportSize({width:844,height:390});await noOverflow(page,D,`${game} guide short landscape`);for(const selector of ['[data-rules-close]','[data-rules-format]','.ask-input','.ask-send']){const b=await page.locator(D+' '+selector).boundingBox();assert(b&&b.y>=0&&b.y+b.height<=390,`${selector} remains reachable in short landscape`);}await capture(page,`rules-judge-${game}-landscape`);
 for(const width of [390,680,768,390]){await page.setViewportSize({width,height:1000});await noOverflow(page,D,`${game} guide fold ${width}px`);assert.equal(await page.locator(D+' [data-learning-root]').getAttribute('data-game'),game);}
}
async function primaryGame(game){
 const mock=createResponder(),app=await openApp(browser,server.base,{game,rulesResponder:mock.respond});
 try{
  const {page}=app,inventoryBefore=await inventorySnapshot(page);await openHub(app);await flush(page);assert.equal(app.rulesRequests.length,0,'Opening the guide is not a paid request');
  await page.locator(D+' .ask-bar').dispatchEvent('submit');await page.locator(D+' [data-rules-example]').first().click();await flush(page);assert.equal(app.rulesRequests.length,0,'Blank submit and example prefill never request an answer');assert((await page.locator(D+' .ask-input').inputValue()).length>10);
  await selectFormat(page,CASES[game].format);assert.equal(app.rulesRequests.length,0,'Changing format does not submit');
  await submit(app,CASES[game].question);await settled(page);assert.equal(app.rulesRequests.length,1);assert.deepEqual(app.rulesRequests[0].body,requestFor(game),'Only explicit question, exact game/format/source and selected context cross the network boundary');assert.equal(mock.providerCalls.length,1);assert.match(await answer(page).innerText(),/AI interpretation|not an official judge/);assert.equal(await answer(page).locator('[data-rules-citation]').count(),1);
  await layout(app,game);await sourceRoundTrip(app,game);
  const text=await answer(page).innerText();await selectFormat(page,CASES[game].alternative);assert.equal(await page.locator(D+' .rules-ai-answer').count(),0,'Another format has an isolated conversation');assert.equal(app.rulesRequests.length,1);await selectFormat(page,CASES[game].format);assert.equal(await page.locator(D+' [data-rules-format]').inputValue(),CASES[game].format,'A reattached cached session restores its canonical visible format, not the last value selected before detaching');assert.equal(await answer(page).innerText(),text,'Returning to a format restores that answer without another request');assert.equal(app.rulesRequests.length,1,'Format round-trip restores cached answer without another request');
  await newChat(page);const boardQuestion=CASES[game].question+' What additional board state do you need?';mock.set(boardQuestion,{kind:'needs_context'});await submit(app,boardQuestion);await settled(page);assert.match(await answer(page).innerText(),/One detail first/);assert.match(await answer(page).locator('.rules-ai-questions').innerText(),/Whose turn.*board.*effect/);assert.doesNotMatch(await answer(page).innerText(),new RegExp(CASES[game].short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'Missing board state cannot be displayed as the authoritative sample ruling');await capture(page,`rules-judge-${game}-missing-board`);
  const followup='It is my turn, the board is empty, and no other effect is waiting to resolve.';await submit(app,followup);await settled(page,2);assert.deepEqual(app.rulesRequests.at(-1).body,{...requestFor(game,{question:followup}),priorQuestions:[boardQuestion]},'Clarification retains only exact prior player statements, never generated answers or full chat history');assert.match(await answer(page).innerText(),/From the indexed rules/);
  await newChat(page);const count=mock.providerCalls.length;await submit(app,'Is this legal in the current format?');await settled(page);assert.match(await answer(page).innerText(),/cannot verify current card legality/i);assert.equal(mock.providerCalls.length,count,'Unsupported current legality is a no-provider clarification');assert.equal(await answer(page).locator('[data-rules-citation]').count(),0);
  await newChat(page);await submit(app,game==='ptcg'?'How does Magic priority work?':'How does Pokémon Checkup work?');await settled(page);assert.match(await answer(page).innerText(),/Switch games/);assert.equal(mock.providerCalls.length,count,'Cross-game questions cannot invoke a model or leak another game answer');
  if(game==='ygo'){await newChat(page);await submit(app,'How does a Link Monster leave the Extra Deck?');await settled(page);assert.match(await answer(page).innerText(),/legacy|not indexed/);await page.locator(D+' [data-rules-external]').click();await page.locator(D+' [data-rule-destination] a[data-source-kind="official-page"]').waitFor();assert.equal(await page.locator(D+' [data-rule-destination] [data-rule-entry]').count(),0,'Unindexed later update is an honest external reference, not invented corpus text');await page.locator(D+' [data-rule-back]').click();}
  // Supplemental exact selected-card/ref contract inside this booted app shell.
  // Module imports are resolved once outside every synchronous polling predicate.
  await page.evaluate(async()=>{window.__judgeModule=await import('/ai-rules.js');});
  const exact=cardContext(game);await page.evaluate(options=>{window.__judgeModule.openRulesAsk(options);},{game,format:CASES[game].format,cards:[exact],references:[entryReference(game,CASES[game].id)]});assert.match(await page.locator(D+' .rules-ai-cards').innerText(),new RegExp(exact.id));await submit(app,CASES[game].question);await settled(page);assert.deepEqual(app.rulesRequests.at(-1).body.cards,[exact]);assert.deepEqual(app.rulesRequests.at(-1).body.references,[entryReference(game,CASES[game].id)].map(r=>({kind:r.kind,game:r.game,version:r.version,doc:r.doc,entryId:r.entryId,label:r.label})));
  const before=mock.providerCalls.length;await page.evaluate(options=>{window.__judgeModule.openRulesAsk(options);},{game,format:CASES[game].format,cards:[{...exact,text:'',complete:false}],references:[entryReference(game,CASES[game].id)]});await submit(app,CASES[game].question);await settled(page);assert.match(await answer(page).innerText(),/complete wording/);assert.equal(mock.providerCalls.length,before);
  const calls=app.rulesRequests.length;await page.locator(D+' [data-rules-drop-cards]').click();await page.locator(D+' .ask-empty').waitFor();assert.equal(await page.locator(D+' .rules-ai-cards').count(),0);assert.equal(await page.locator(D+' .rules-ai-answer').count(),0,'Removing context starts a clean general-rules session');assert.equal(app.rulesRequests.length,calls,'Removing context does not submit or promote incomplete text');await submit(app,CASES[game].question);await settled(page);assert.deepEqual(app.rulesRequests.at(-1).body,requestFor(game),'Explicit general question has no card, selected reference or previous clarification context');
  assert.equal(await inventorySnapshot(page),inventoryBefore,'Rules Q&A never changes saved cards, lots or decks');
  report.push(`${game}: actual Rules hub, explicit-only requests, ${CASES[game].format}/${CASES[game].alternative} session isolation, exact card/reference payload and explicit removal, player-only clarification follow-up, canonical ${CASES[game].id} source and Back, missing board state and evidence, five widths/landscape/fold.`);await app.close();
 }catch(error){await capture(app.page,`rules-judge-${game}-failure`).catch(()=>{});await app.context.close();throw error;}
}
async function modalContainment(){
 const mock=createResponder(),app=await openApp(browser,server.base,{game:'mtg',hash:'#deck/saved-mtg',width:390,height:800,rulesResponder:mock.respond});
 try{
  const {page}=app;await page.locator('#content [data-act="deckTab"][data-id="rules"]').click();
  const launcher='#content [data-learning-root] [data-act="askRules"]',outside='#content [data-act="deckTab"][data-id="cards"]';await page.locator(launcher).waitFor();
  const before=await page.evaluate(()=>({sheet:document.querySelector('#sheet').open,sheetLock:document.documentElement.classList.contains('sheet-open'),root:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY}));assert.equal(before.sheet,false);assert.equal(before.sheetLock,false,'Direct deck Rules starts without a sheet-provided scroll lock');
  await page.locator(launcher).click();await page.locator(D).waitFor();assert.equal(await page.locator(D+' [data-rules-format]').inputValue(),'Commander','Direct deck guide inherits the actual deck format');
  const locked=await page.evaluate(outside=>{const dialog=document.querySelector('.rules-ask-dialog[open]'),background=document.querySelector(outside);background.focus({preventScroll:true});return {modal:dialog.matches(':modal'),contained:dialog.contains(document.activeElement),outsideFocused:document.activeElement===background,root:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY,top:document.scrollingElement.scrollTop,bodyTop:document.body.scrollTop,max:document.scrollingElement.scrollHeight-innerHeight};},outside);
  assert.equal(locked.modal,true,'Guide uses actual native modal behavior');assert.equal(locked.contained,true,'Background focus cannot leave the modal');assert.equal(locked.outsideFocused,false,'The background control is inert');assert.equal(locked.root,'hidden');assert.equal(locked.body,'hidden');assert(locked.max>0,'Underlying real deck/Rules page is meaningfully scrollable');
  for(let i=0;i<3;i++){await page.keyboard.press('Tab');assert.equal(await page.locator(D).evaluate(n=>n.contains(document.activeElement)),true,'Keyboard focus remains inside the modal');}
  // Observe an actual wheel event over the backdrop, then its rendering frames.
  // This is not a synthetic scroll assignment or an arbitrary timing sleep.
  await page.evaluate(()=>{window.__judgeWheel=0;document.addEventListener('wheel',()=>{window.__judgeWheel++;},{capture:true,once:true});});await page.mouse.move(1,1);await page.mouse.wheel(0,locked.top>1?-600:600);await page.waitForFunction(()=>window.__judgeWheel===1);await flush(page);
  assert.deepEqual(await page.evaluate(()=>({top:document.scrollingElement.scrollTop,bodyTop:document.body.scrollTop})),{top:locked.top,bodyTop:locked.bodyTop},'Backdrop wheel cannot scroll the background while guide is open');await capture(page,'rules-judge-direct-deck-modal');
  await page.locator(D+' [data-rules-close]').click();await page.waitForFunction(()=>!document.querySelector('.rules-ask-dialog[open]'));
  const restored=await page.evaluate(outside=>{const background=document.querySelector(outside);background.focus({preventScroll:true});return {sheet:document.querySelector('#sheet').open,sheetLock:document.documentElement.classList.contains('sheet-open'),root:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY,outsideFocused:document.activeElement===background,top:document.scrollingElement.scrollTop};},outside);
  assert.deepEqual({sheet:restored.sheet,sheetLock:restored.sheetLock,root:restored.root,body:restored.body},before,'Closing a direct guide releases only its own scroll lock');assert.equal(restored.outsideFocused,true,'Background controls stop being inert after close');
  await page.mouse.move(1,1);await page.mouse.wheel(0,restored.top>1?-600:600);await page.waitForFunction(top=>document.scrollingElement.scrollTop!==top,restored.top);assert.equal(app.rulesRequests.length,0,'Modal/focus/scroll interactions never submit AI');
  report.push('Actual deck Rules launcher: native :modal, background focus inertness, keyboard containment, document/body scroll lock, unchanged backdrop wheel position, and restored background focus/scroll after close.');await app.close();
 }catch(error){await capture(app.page,'rules-judge-modal-failure').catch(()=>{});await app.context.close();throw error;}
}
async function keywordEscape(){
 const mock=createResponder(),app=await openApp(browser,server.base,{game:'mtg',rulesResponder:mock.respond});
 try{
  const {page}=app,before=await inventorySnapshot(page);await page.locator('#content .lot-art[data-entry="lot-mtg-0"]').click();
  const selector='#sheet[open] .rule-word[data-rule="vigilance"]';await page.locator(selector).waitFor();
  const raw=await page.locator(selector).evaluate(n=>JSON.parse(n.closest('[data-rule-card-context]').dataset.ruleCardContext));assert.deepEqual(raw,ruleCardContext('mtg',CARDS.mtg[0]),'Keyword context is the exact selected printing and full wording');
  await page.locator(selector).click();await page.locator('.rule-glass [data-act="askRules"]').waitFor();
  const references=JSON.parse(await page.locator('.rule-glass [data-act="askRules"]').getAttribute('data-rules-references'));assert.equal(references.length,1);assert.equal(references[0].game,'mtg');
  await page.locator('.rule-glass [data-act="askRules"]').click();await page.locator(D).waitFor();
  // No pointer/focus action between opening and Escape: a stale capture listener
  // used to consume Escape and leave this new guide open.
  await page.keyboard.press('Escape');await page.waitForFunction(selector=>!document.querySelector('.rules-ask-dialog[open]')&&document.querySelector(selector)?.isConnected&&document.activeElement===document.querySelector(selector),selector);
  assert.equal(await page.locator('.rule-glass').count(),0,'Old hint and its capture listener were dismissed');assert.equal(await page.locator('#sheet[open]').count(),1,'Escape closes the guide, not its underlying card');assert.equal(app.rulesRequests.length,0,'Keyword → guide → Escape makes no request');
  const sheetLock=await page.evaluate(()=>({sheet:document.querySelector('#sheet').matches(':modal'),sheetClass:document.documentElement.classList.contains('sheet-open'),guideLock:document.documentElement.matches(':has(.rules-ask-dialog[open])'),root:getComputedStyle(document.documentElement).overflowY,body:getComputedStyle(document.body).overflowY}));assert.deepEqual(sheetLock,{sheet:true,sheetClass:true,guideLock:false,root:'hidden',body:'hidden'},'Guide Escape releases its own lock while the underlying modal card sheet keeps its existing lock');
  await page.locator(selector).click();await page.locator('.rule-glass [data-act="askRules"]').click();await submit(app,CASES.mtg.question);await settled(page);
  assert.deepEqual(app.rulesRequests[0].body,{...rulesContext({game:'mtg',format:'',cards:[raw],references}),question:CASES.mtg.question},'Typed keyword question carries exact identity, complete text, type/mana context and canonical reference only');assert.equal(await inventorySnapshot(page),before);await capture(page,'rules-judge-keyword-context');report.push('Real card keyword → Ask about this situation → immediate Escape closes guide and restores original keyword focus. Explicit typed request carries exact printing/text and selected canonical source; no inventory mutation.');await app.close();
 }catch(error){await capture(app.page,'rules-judge-keyword-failure').catch(()=>{});await app.context.close();throw error;}
}
async function corruption(){
 const mock=createResponder(),app=await openApp(browser,server.base,{game:'ptcg',rulesResponder:mock.respond});
 try{await openHub(app);await selectFormat(app.page,'Standard');for(const kind of ['bad-provider-citation','bad-provider-quote','corrupt-game','corrupt-format','corrupt-reference','fabricated-reference','corrupt-quote']){await newChat(app.page);const question=CASES.ptcg.question+' '+kind;mock.set(question,{kind});await submit(app,question);await settled(app.page,0,1);assert.match(await app.page.locator(D+' .ask-msg.error').innerText(),/No answer was verified/);assert.equal(await app.page.locator(D+' [data-rules-citation]').count(),0,'Rejected evidence cannot expose a citation action');assert.equal(await app.page.locator(D+' [data-rule-destination]:visible').count(),0);assert.equal(app.rulesRequests.at(-1).status,kind.startsWith('bad-provider')?502:200);}
 await capture(app.page,'rules-judge-rejected-citation');report.push('Server rejects fabricated model IDs/quotes; client rejects wrong game, cross-game reference, unknown canonical entry and mismatching quote. No unverified answer or citation button shown.');await app.close();}catch(error){await capture(app.page,'rules-judge-rejection-failure').catch(()=>{});await app.context.close();throw error;}
}
async function races(){
 const mock=createResponder(),app=await openApp(browser,server.base,{game:'mtg',rulesResponder:mock.respond,reducedMotion:'reduce'});
 try{
  const {page}=app;await openHub(app);await selectFormat(page,'Commander');const qa=CASES.mtg.question+' Response A.',qb=CASES.mtg.question+' Response B.';mock.set(qa,{tag:'A'});mock.set(qb,{tag:'B'});
  const gate=app.hold(u=>u.pathname==='/api/ai/ask');await submit(app,qa);await gate.seen;assert(await page.locator(D+' .ask-send').isDisabled());await page.locator(D+' .ask-bar').dispatchEvent('submit');await flush(page);assert.equal(app.rulesRequests.length,1,'Double submit while pending produces one request');
  await page.locator(D+' [data-rules-close]').click();assert.equal(await page.locator(D).count(),0);await page.locator('#sheet [data-act="askRules"]').click();await selectFormat(page,'Commander');assert(await page.locator(D+' .ask-send').isDisabled());assert.equal(app.rulesRequests.length,1,'Reopening pending session never repeats the request');
  await selectFormat(page,'Modern');await submit(app,qb);await settled(page);assert.match(await answer(page).innerText(),/Deterministic response B/);const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/ai/ask'&&r.request().postDataJSON()?.question===qa);gate.release();await response;await flush(page);assert.match(await answer(page).innerText(),/Deterministic response B/);assert.doesNotMatch(await answer(page).innerText(),/Deterministic response A/,'Late A cannot replace format B');await selectFormat(page,'Commander');await settled(page);assert.match(await answer(page).innerText(),/Deterministic response A/);assert.equal(app.rulesRequests.length,2);
  const motion=await answer(page).evaluate(n=>({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,animation:getComputedStyle(n).animationName}));assert.equal(motion.reduced,true);assert.equal(motion.animation,'none');await page.setViewportSize({width:320,height:640});await noOverflow(page,D,'Reduced-motion 320px guide');await capture(page,'rules-judge-race-reduced-motion');report.push('Held A, duplicate submit, close/reopen and format B race: exactly one request per explicit question; late A stays in its original conversation. Reduced motion disables answer animation.');await app.close();
 }catch(error){await capture(app.page,'rules-judge-race-failure').catch(()=>{});await app.context.close();throw error;}
 const navMock=createResponder(),nav=await openApp(browser,server.base,{game:'ptcg',rulesResponder:navMock.respond});
 try{const {page}=nav;await openHub(nav);const gate=nav.hold(u=>u.pathname==='/api/ai/ask');await submit(nav,CASES.ptcg.question);await gate.seen;await navigate(page,'#collection');await page.waitForFunction(()=>!document.querySelector('.rules-ask-dialog[open]'));const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/ai/ask'&&r.request().postDataJSON()?.question===CASES.ptcg.question);gate.release();await response;await flush(page);assert.equal(await page.locator(D).count(),0,'Late answer never reopens after navigation');await openHub(nav);await settled(page);assert.equal(nav.rulesRequests.length,1,'Reopening completed context never retries');assert.match(await answer(page).innerText(),/Start your turn/);report.push('Navigation while a request is pending closes the guide; late result cannot reopen it. Same-context reopen restores its completed answer without resubmitting.');await nav.close();}catch(error){await capture(nav.page,'rules-judge-navigation-failure').catch(()=>{});await nav.context.close();throw error;}
}
try{browser=await chromium.launch();await modalContainment();for(const game of GAMES)await primaryGame(game);await keywordEscape();await corruption();await races();console.log('PASS: '+report.join('\nPASS: '));}
catch(error){failure=error;throw error;}
finally{await saveReport('rules-judge-browser',report,failure);await browser?.close();await server.close();}
