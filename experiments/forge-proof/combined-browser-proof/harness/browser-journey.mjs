// Real Chromium + actual existing Play handlers + actual host/Forge. All match
// mutations originate in rendered controls. No force clicks, native fetch POST,
// DOM state injection, hidden-hand lookup, invented legal list or synthetic win.
import {readActionMetadata,safeActionStage,actionMetadata,actionEvent} from './action-diagnostics.mjs';
import {deliveredActionReceipt} from './receipt-observation.mjs';
import {createMimicPaymentProof} from './payment-proof.mjs';
import {assertNativePrivacy,boundedTimeout} from './acceptance-contract.mjs';import {visualCheckpoint,waitVisibleCardImages} from './browser-visual-checks.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
const require=createRequire(path.join(process.env.FORGE_BROWSER_TOOLS,'package.json')),{chromium}=require('playwright');
const base=process.env.FORGE_UI_ORIGIN;if(!base||!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Explicit loopback fixture origin required');
const mode=process.env.FORGE_BROWSER_CASE||'saved-keen',touch=process.env.FORGE_TOUCH==='true',width=Number(process.env.FORGE_WIDTH||1440),height=Number(process.env.FORGE_HEIGHT||1000),full=process.env.FORGE_FULL_JOURNEY==='true';
assert.equal(mode,'saved-keen','This proof pins the original saved-deck sequence');
assert.deepEqual([width,height],touch?[750,832]:[1440,1000]);
const caseBudget=full?855000:165000,externalDeadline=Number(process.env.FORGE_BROWSER_ABSOLUTE_DEADLINE_MS);
if(!Number.isSafeInteger(externalDeadline)||externalDeadline<=Date.now())throw Error('Explicit outer browser case deadline required');
const caseDeadline=Math.min(Date.now()+caseBudget,externalDeadline);
let stateDeadline=caseDeadline;
const naturalBudget=600000,expectedPolicy=process.env.FORGE_EXPECTED_POLICY_VERSION;if(!expectedPolicy)throw Error('Reviewed explicit native policy identity required');
const expectedSource=process.env.FORGE_EXPECTED_SOURCE_SHA256;if(!/^[0-9a-f]{64}$/.test(expectedSource||''))throw Error('Reviewed explicit native source hash required');
const expectedDeckDigests={humanDeck:'858b8e6127d3749aeb8f57124246ef30a35ea390d2a758c9eefa9b76a53d72b8',opponentDeck:'7f6d2f7dc9b86b794c2a7fa1f3f7842265e095744deb7ad25f9f04a55c7fab4c'};
const out=path.resolve(process.env.FORGE_BROWSER_OUT||'test-results/forge-existing-play');await fs.mkdir(out,{recursive:true});
const report={schema:'forge-existing-play-browser.v1',result:'running',case:mode,scope:'isolated existing Play menu/actual app handlers with synthetic auth/cache provider; not whole-app boot or production persistence',browser:null,viewport:{width,height,hasTouch:touch},checks:[],actions:0,creates:0,privacyChecks:0,externalCredentialViolations:0,unexpectedRequests:0,terminal:null,difficultySelections:[],naturalFinish:false,rematchVerified:false,visualChecks:[],errors:[],errorDiagnostics:[],actionDiagnostics:[],actionEvents:[],scenario:{seed:20261025,sequence:'saved-keen-mimic-v1',opening:'keep-original-seven'},observation:{method:'fixture-forwarded-viewer-response-cache',intervalMs:250,reads:0,accepted:0,lastHttpStatus:null}};
let concessionPosts=0,paymentProof=null,eventOrder=0;
function recordActionEvent(event,metadata={}){
 const entry=actionEvent({order:++eventOrder,event,...metadata});
 if(report.actionEvents.length<256)report.actionEvents.push(entry);
 else report.actionEventsTruncated=true;
}
let browser,page,latest=null,lastStage='startup',nativePosts=0,createBodies=[],terminals=[],snapshots=[],actionIds=new Set();
const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=n=>{report.checks.push(n);console.log('PASS '+n);},own=s=>s.players.find(p=>p.isViewer);
const fixtureUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let observationToken=null,observationMatch=null,observationGeneration=null,observationCreate=0,observationSequence=0,observationNextAt=0,observationPending=null;
const observedMatches=new Set();
function bindObservedRequest(request){
 const u=new URL(request.url());if(u.origin!==base)return;
 const id=u.pathname.match(/^\/api\/play\/matches\/([^/]+)$/)?.[1];
 if(request.method()==='GET'&&id){
  assert(fixtureUuid.test(id),'Invalid UI match identity');
  if(report.creates>observationCreate&&!observedMatches.has(id)){
   observationMatch=id;observationCreate=report.creates;observationGeneration=null;observationSequence=0;observationNextAt=0;latest=null;snapshots=[];observedMatches.add(id);
  }else assert(observedMatches.has(id),'Unexpected UI match request');
 }
 if(request.method()==='POST'&&u.pathname===`/api/play/matches/${observationMatch}/actions`){
  assert(observationGeneration,'A native action preceded its observed allocation');assert.equal(request.postDataJSON().generation,observationGeneration,'UI action generation differs from delivered viewer state');
 }
}
// Read only a fixture's copy of the exact body already delivered to this UI.
// This endpoint never calls the host/native state route or renews an idle timer.
async function observeDelivered(){
 if(!observationMatch||!observationToken||observationCreate!==report.creates)return;
 if(observationPending)return observationPending;
 if(Date.now()<observationNextAt)return;observationNextAt=Date.now()+250;
 const id=observationMatch,generation=observationGeneration,sequence=observationSequence;
 observationPending=(async()=>{
  report.observation.reads++;
  const r=await fetch(base+'/__fixture/observe/'+id,{headers:{Accept:'application/json',Authorization:'Bearer '+observationToken,...(generation?{'X-Fixture-Generation':generation}:{})},credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(r.status===202&&!sequence)return;
  assert.equal(r.status,200,'Fixture observation unavailable; no native receipt invented');const record=await r.json();
  assert.equal(record.fixtureOnly,true);assert.equal(record.matchId,id);assert(fixtureUuid.test(record.generation),'Invalid delivered generation');if(generation)assert.equal(record.generation,generation);
  assert(Number.isSafeInteger(record.sequence)&&record.sequence>0&&record.sequence>=sequence,'Delivered response sequence regressed');
  if(id!==observationMatch)return; // A completed previous match cannot enter a new table.
  if(record.sequence===observationSequence)return;
  report.observation.lastHttpStatus=Number.isInteger(record.httpStatus)&&record.httpStatus>=100&&record.httpStatus<=599?record.httpStatus:null;
  const value=record.body;assert.equal(value?.matchId,id);assert.equal(value?.generation,record.generation);
  assert(record.httpStatus===200&&['running','finished'].includes(value.status)||record.httpStatus===202&&value.status==='initializing','Delivered host response was not a valid native state envelope');
  observationGeneration=record.generation;observationSequence=record.sequence;report.observation.accepted++;latest=value;
  if(value.snapshot){assert.equal(value.snapshot.schema,'cardstashy.forge-proof.v1');assert.equal(value.snapshot.forgeRevision,'e5a0f8156da70ffc7866f923bed371c0111707cd');privacy(value.snapshot);recordActionEvent('viewer-state-observed',{revision:value.snapshot.revision,inputType:value.snapshot.inputType,decisionId:value.snapshot.prompt?.id,busy:value.snapshot.busy,generationHash:createHash('sha256').update(value.generation).digest('hex')});paymentProof?.observe(value.snapshot);snapshots.push(value.snapshot);if(snapshots.length>3)snapshots.shift();}
  if(value.status==='finished')assert(verifiedTerminal(value),'Delivered terminal lacks a verified native outcome');
  if(verifiedTerminal(value)&&!terminals.some(t=>t.matchId===value.matchId))terminals.push(value);
 })().catch(e=>{recordError('response-observer',e);throw e;}).finally(()=>{observationPending=null;});return observationPending;
}
async function until(fn,timeout=20000){const end=Date.now()+boundedTimeout(timeout,stateDeadline);while(Date.now()<end){await observeDelivered();boundedTimeout(1,end);const value=await fn();boundedTimeout(1,end);if(value)return value;await pause(40);}throw Error('Bounded wait expired at '+lastStage);}
function privacy(s){assertNativePrivacy(s);report.privacyChecks++;}
function verifiedTerminal(v){return v?.status==='finished'&&typeof v.result?.draw==='boolean'&&(v.result.draw||Number.isSafeInteger(v.result.winnerPlayerId)&&snapshots.at(-1)?.players.some(p=>p.id===v.result.winnerPlayerId));}
async function ready(oldRevision=null,timeout=120000){return until(async()=>{if(verifiedTerminal(latest))return latest;const s=latest?.snapshot;if(!s||s.revision===oldRevision||s.busy||s.inputType==='InputLockUI'&&!s.prompt)return false;const rev=await page.locator('[data-native-panel]').getAttribute('data-native-revision').catch(()=>null);return rev===String(s.revision)?s:false;},timeout);}
const key=k=>page.locator(`[data-native-panel] [data-native-key="${k}"]`);
const gesture=locator=>touch?locator.tap():locator.click();
const diagnosticScripts=new Set();
// Bounded metadata only. Never persist exception messages, raw stacks or URLs.
function recordError(source,error){
 const name=['Error','TypeError','AssertionError','TimeoutError'].includes(error?.name)?error.name:'Other';report.errors.push(name);
 const message=String(error?.message||'');
 const category=/ResizeObserver loop/i.test(message)?'resize-observer-loop':/Maximum call stack/i.test(message)?'stack-limit':/is not defined/.test(message)?'not-defined':/is not a function/.test(message)?'not-function':/Cannot read properties of (null|undefined)|Cannot set properties of (null|undefined)/.test(message)?'null-property':error?.name==='SyntaxError'&&/JSON|Unexpected (token|end)/i.test(message)?'json-decode':error?.name==='AssertionError'?'assertion':/No resource with given identifier|No data found for resource|Response body is unavailable|Failed to get response body/i.test(message)?'response-body-unavailable':/Execution context was destroyed|Target page.*closed|Target closed/i.test(message)?'context-closed':/The user aborted|ERR_ABORTED|request aborted/i.test(message)?'aborted':/Failed to fetch|fetch failed|NetworkError|load failed/i.test(message)?'network-failure':'other';
 let location;
 for(const candidate of String(error?.stack||'').match(/https?:\/\/[^\s)]+/g)||[]){
  const match=candidate.match(/^(.*):(\d+):(\d+)$/);if(!match)continue;
  try{const url=new URL(match[1]),file=url.pathname.split('/').pop(),line=Number(match[2]),column=Number(match[3]);if(url.origin!==base||url.search||url.hash||!diagnosticScripts.has(file)||!Number.isSafeInteger(line)||!Number.isSafeInteger(column)||line<1||column<1||line>10000000||column>10000000)continue;location={file,line,column};break;}catch{}
 }
 const entry={source,class:name,category,...(location?{location}:{})},signature=JSON.stringify(entry),found=report.errorDiagnostics.find(x=>JSON.stringify({source:x.source,class:x.class,category:x.category,...(x.location?{location:x.location}:{})})===signature);
 if(found)found.count++;else if(report.errorDiagnostics.length<20)report.errorDiagnostics.push({...entry,count:1});
}
async function openExit(){
 lastStage='open Match menu';const menu=page.locator('details.play-match-menu');
 if(!await menu.evaluate(el=>el.open))await gesture(menu.locator('summary'));
 assert.equal(await menu.evaluate(el=>el.open),true,'Match menu did not open through its visible summary');
 lastStage='open exit confirmation';await gesture(menu.locator('[data-focus-key=exit-match]'));
}
async function action(locator,label='native control'){
 lastStage=label;const before=latest?.snapshot,old=before?.revision,posts=nativePosts;
 const [response,clicked]=await Promise.allSettled([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/actions')&&r.request().method()==='POST',{timeout:15000}),gesture(locator)]);
 if(response.status==='rejected'||clicked.status==='rejected'){
  report.failedAction={stage:safeActionStage(label),clickSettled:clicked.status,responseSettled:response.status,nativePosts:nativePosts-posts,reason:clicked.status==='rejected'?(/intercepts pointer events/.test(String(clicked.reason?.message))?'pointer-intercepted':'click-failed'):'native-post-timeout',geometry:await locator.evaluateAll(es=>{const el=es[0];if(!el)return {matches:0};const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {matches:es.length,rect:{x:r.x,y:r.y,width:r.width,height:r.height},centerReceivesPointer:h===el||el.contains(h)};}).catch(()=>null)};throw Error('Rendered action failed');
 }
 const diagnostic=await readActionMetadata(response.value,{stage:label,inputType:before?.inputType,decisionId:before?.prompt?.id,observedRevision:old},{timeoutMs:boundedTimeout(1000,caseDeadline),readDeliveredReceipt:({request,httpStatus})=>deliveredActionReceipt({base,token:observationToken,matchId:observationMatch,request,httpStatus,timeoutMs:boundedTimeout(1000,caseDeadline)})});
 recordActionEvent('action-receipt-read',diagnostic);
 if(report.actionDiagnostics.length<64)report.actionDiagnostics.push(diagnostic);
 if(response.value.status()!==202||diagnostic.state!=='accepted')report.actionRejection=diagnostic;
 assert.equal(response.value.status(),202,'Host rejected rendered action');assert.equal(diagnostic.state,'accepted','Native action outcome is not confirmed');paymentProof?.receipt(diagnostic);return ready(old);
}
async function reply(p){
 assert.equal(p.supported,true,'Unadapted native prompt must stop visibly');
 if(p.acknowledgeOnly)return action(key('acknowledge-prompt'),'native reveal acknowledgement');
 if(['confirm','showConfirmDialog'].includes(p.method))return action(key('reply-true'),'native confirmation');
 if(p.method==='showInputDialog'){const input=key('native-value');if(await input.evaluate(e=>e.tagName)==='SELECT')await input.selectOption(String(p.options[0].value));else await input.fill(String(p.initialValue??0));return action(key('submit-value'),'native value');}
 if(p.method==='order'){
  assert.equal(p.ordered,true);const present=p.destinationIndexes||[];for(const o of (p.options||[]).filter(o=>!present.includes(o.index)).slice(0,Math.max(0,p.min-present.length)))await gesture(key('option-'+o.index));
 }else for(const o of p.options.slice(0,p.min))await gesture(key('option-'+o.index));
 return action(key('confirm-prompt'),'native '+p.method);
}
async function passive(){
 const s=await ready();if(s.status==='finished')return s;
 if(s.prompt)return reply(s.prompt);
 if(s.inputType==='InputAttack'&&s.buttons.cancel==='Alpha Strike')return action(key('cancel'),'native declared attack');
 if(s.buttons.okEnabled)return action(key('ok'),'native '+s.inputType);
 const chosen=new Set(s.selection.chosen.map(c=>c.id)),c=s.selection.cards.find(c=>!chosen.has(c.id));
 if(c){const control=key('ref-card-'+c.id),details=control.locator('xpath=ancestor::details');if(!await details.evaluate(e=>e.open))await gesture(details.locator('summary'));return action(control,'native required card selection');}
 throw Error('No supported rendered passive command');
}
async function handPan(){
 const row=page.locator('.play-match-hand .play-match-card-row');await row.scrollIntoViewIfNeeded();
 const before=await row.evaluate(e=>({left:e.scrollLeft,max:e.scrollWidth-e.clientWidth}));if(before.max<=2){report.handPan={overflow:false};check('hand fits touch viewport; no horizontal pan required');return;}
 const bounds=await row.boundingBox(),cdp=await page.context().newCDPSession(page),posts=nativePosts;
 // CDP sends real browser input events, not DOM dispatch/scroll assignment. Start
 // on card artwork so the product's actual drag/touch arbitration is exercised.
 const y=bounds.y+bounds.height*.55,x0=bounds.x+bounds.width*.82,x1=bounds.x+bounds.width*.18;
 for(let pan=0;pan<6;pan++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y,id:1}]});
  for(let step=1;step<=12;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*step/12,y,id:1}]});await pause(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(160);
  if(await row.evaluate(e=>e.scrollLeft>=e.scrollWidth-e.clientWidth-3))break;
 }
 const after=await row.evaluate(e=>({left:e.scrollLeft,max:e.scrollWidth-e.clientWidth}));assert(after.left>before.left+3,'Native card drag handler trapped touch pan');assert(after.left>=after.max-3,'Touch pan did not reach the rightmost hand');assert.equal(nativePosts,posts,'Touch pan must not send a card action');
 const last=page.locator('.play-match-hand .play-match-card').last();const hit=await last.evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return h===e||e.contains(h);});assert.equal(hit,true,'Rightmost card lacks a reachable touch center');
 report.handPan={overflow:true,before,after};check('actual touch pan reaches rightmost card through native handler without sending an action');await cdp.detach();
}
try{
 const configResponse=await fetch(base+'/fixture-config.json',{credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});assert.equal(configResponse.status,200);const config=await configResponse.json();assert.equal(config.fixtureOnly,true);assert.equal(config.sourceIdentity?.nativeSourceSHA256,expectedSource);assert.equal(config.sourceIdentity?.forgeRevision,'e5a0f8156da70ffc7866f923bed371c0111707cd');assert.equal(config.sourceIdentity?.difficultyPolicyVersion,expectedPolicy);assert(fixtureUuid.test(config.userId));assert(typeof config.accessToken==='string'&&config.accessToken.length>0&&config.accessToken.length<=8192&&/^[-A-Za-z0-9._]+$/.test(config.accessToken));observationToken=config.accessToken;
 browser=await chromium.launch({headless:true,timeout:boundedTimeout(20000,caseDeadline)});report.browser=browser.version();
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,serviceWorkers:'block',...(touch?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel Fold) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}:{})});
 await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url()),h=req.headers(),local=u.origin===base,art=u.origin==='https://cards.scryfall.io'&&req.method()==='GET'&&req.resourceType()==='image';if(!local&&(h.authorization||h.cookie)){report.externalCredentialViolations++;return route.abort();}if(local||art)return route.continue();report.unexpectedRequests++;return route.abort();});
 page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>recordError('page',e));
 page.on('request',r=>{try{const u=new URL(r.url());if(u.origin!==base)return;bindObservedRequest(r);if(r.resourceType()==='script'){const file=u.pathname.split('/').pop();if(/^[A-Za-z0-9_-]+\.(?:js|mjs)$/.test(file))diagnosticScripts.add(file);}if(u.pathname==='/api/play/matches'&&r.method()==='POST'){report.creates++;createBodies.push(r.postDataJSON());}if(u.pathname.endsWith('/actions')&&r.method()==='POST'){const body=r.postDataJSON();nativePosts++;report.actions++;recordActionEvent('action-submitted',actionMetadata({request:body,inputType:latest?.snapshot?.inputType,decisionId:latest?.snapshot?.prompt?.id,observedRevision:latest?.snapshot?.revision}));paymentProof?.request(body);if(body.action?.op==='concede')concessionPosts++;assert(!actionIds.has(body.commandId),'A command was retried');actionIds.add(body.commandId);}}catch(e){recordError('request-observer',e);}});

 page.on('response',response=>{try{const u=new URL(response.url());if(u.origin===base&&response.request().method()==='GET'&&/^\/api\/play\/matches\/[^/]+$/.test(u.pathname))void observeDelivered().catch(()=>{});}catch(e){recordError('response-observer',e);}});
 await page.goto(base+'/forge-play-browser.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.fixtureReady==='true');
 const fixture=await (await fetch(base+'/fixture-decks.json')).json(),human=fixture.decks[0],cpu=fixture.decks[mode.includes('reign')?2:1];
 if(mode.startsWith('import')){await gesture(page.locator('#playImportDisclosure summary'));await page.locator('#playImportName').fill('Calling All Angels imported browser fixture');await page.locator('#playImportText').fill(fixture.angelsImport);await gesture(page.locator('[data-act=playImportPreview]'));await gesture(page.locator('[data-act=playImportUse]'));}else await gesture(page.locator(`[data-act=playSelectDeck][data-play-deck="${human.id}"]`));
 await gesture(page.locator('.play-matchup [data-act=playInspectSeat][data-play-seat=opponent]'));await gesture(page.locator(`[data-act=playSelectDeck][data-play-deck="${cpu.id}"]`));
 const difficulty=page.locator('select#playDifficulty[data-change=playMatchOption][data-play-option=difficulty]');assert.equal(await difficulty.inputValue(),'Medium');
 const preSelectionPosts=nativePosts,preSelectionCreates=report.creates;
 for(const value of ['Easy','Hard','Medium']){await difficulty.selectOption(value);assert.equal(await difficulty.inputValue(),value);report.difficultySelections.push(value);}
 assert.equal(nativePosts,preSelectionPosts);assert.equal(report.creates,preSelectionCreates);check('real difficulty menu cycles Easy/Hard/Medium without allocating; only Medium native policy is exercised');
 assert.equal(await page.locator('[data-act=playStartCandidate]').isEnabled(),true);await page.screenshot({path:path.join(out,'setup.png')});check('existing Play menu selects concrete human and CPU decks through actual handlers');
 lastStage='native startup';await gesture(page.locator('[data-act=playStartCandidate]'));let s=await ready(null,140000);assert.equal(report.creates,1);assert.equal(createBodies[0].difficultyPolicyVersion,expectedPolicy);assert.deepEqual(createBodies[0].opponentDeck,cpu);if(!mode.startsWith('import'))assert.deepEqual(createBodies[0].humanDeck,human);else assert.deepEqual(createBodies[0].humanDeck.cards.map(r=>[r.name,r.qty]).sort(),human.cards.map(r=>[r.name,r.qty]).sort());
 report.selectedDigests=Object.fromEntries(['humanDeck','opponentDeck'].map(k=>[k,createHash('sha256').update(JSON.stringify(createBodies[0][k])).digest('hex')]));assert.deepEqual(report.selectedDigests,expectedDeckDigests);assert.equal(s.controlMode,'smart');assert(s.players.every(p=>p.life===40));check('exact snapshots admitted by real host with native Smart policy');
 for(let i=0;i<5&&s.inputType!=='InputConfirmMulligan';i++)s=await passive();
 assert.equal(s.inputType,'InputConfirmMulligan');assert.equal(own(s).zones.Hand.cards.length,7);await waitVisibleCardImages(page,caseDeadline);await page.screenshot({path:path.join(out,'opening.png')});check('real native seven-card opening after existing setup');
 s=await action(key('ok'),'native Keep');for(let i=0;i<40&&!(s.phase==='MAIN1'&&s.activePlayer===s.viewer&&!s.prompt);i++)s=await passive();assert.equal(s.phase,'MAIN1');assert.equal(s.activePlayer,s.viewer);
 report.visualChecks.push(await visualCheckpoint(page,{touch,deadline:caseDeadline,stage:'first-main'}));check('hand and both HUDs visible; compact canonical controls reachable; visible card images ready');
 if(touch)await handPan();
 const land=own(s).zones.Hand.cards.find(c=>c.type.includes('Land'));assert(land,'Native opening needs a land for the bounded line');s=await action(page.locator(`.play-match-hand [data-instance="${land.id}"]`),touch?'native land tap':'native land click');
 if(s.prompt){assert.equal(s.prompt.method,'getAbilityToPlay');for(const o of s.prompt.options.slice(0,1))await gesture(key('option-'+o.index));s=await action(key('confirm-prompt'),'native land ability');}
 assert(own(s).zones.Battlefield.cards.some(c=>c.id===land.id));check('real rendered land action reaches native battlefield');
 if(process.env.FORGE_TEST_CAST==='true'||touch){
  // Public deterministic test intention, not a client legal-action calculation:
  // the recorded exact Angels opening has Metallic Mimic. Forge alone validates
  // playing the next Plains, casting, paying and choosing its creature type.
  const firstTurn=s.turn;for(let i=0;i<80&&!(s.turn>firstTurn&&s.phase==='MAIN1'&&s.activePlayer===s.viewer&&!s.prompt);i++)s=await passive();
  assert(s.turn>firstTurn&&s.activePlayer===s.viewer&&s.phase==='MAIN1');
  const nextLand=own(s).zones.Hand.cards.find(c=>c.name==='Plains');assert(nextLand);s=await action(page.locator(`.play-match-hand [data-instance="${nextLand.id}"]`),'second native land');
  if(s.prompt){assert.equal(s.prompt.method,'getAbilityToPlay');await gesture(key('option-'+s.prompt.options[0].index));s=await action(key('confirm-prompt'),'second native land ability');}
  assert(own(s).zones.Battlefield.cards.some(c=>c.id===nextLand.id));const mimic=own(s).zones.Hand.cards.find(c=>c.name==='Metallic Mimic');assert(mimic,'Recorded exact opening cast line differs');
  paymentProof=createMimicPaymentProof(s,mimic.id);
  s=await action(page.locator(`.play-match-hand [data-instance="${mimic.id}"]`),touch?'native creature tap':'native creature click');
  for(let i=0;i<30&&(!own(s).zones.Battlefield.cards.some(c=>c.id===mimic.id)||s.prompt);i++)s=await passive();
  assert(own(s).zones.Battlefield.cards.some(c=>c.id===mimic.id),'Creature did not resolve through native casting and payment');report.paymentProof=paymentProof.resolve(s);report.visualChecks.push(await visualCheckpoint(page,{touch,deadline:caseDeadline,stage:'resolved'}));await page.screenshot({path:path.join(out,'resolved.png')});check('real native creature cast, Smart payment, creature-type choice and resolution');
 }

 s=await action(key('mode-full'),'native Full Control');assert.equal(s.controlMode,'full');assert.equal(await key('mode-full').getAttribute('aria-pressed'),'true');s=await action(key('mode-smart'),'native Smart');assert.equal(s.controlMode,'smart');check('Smart / Full buttons reflect actual native acknowledgements');
 report.paymentProof=paymentProof.finish(s);paymentProof=null;check('one Mimic stack entry and payment; rendered controls resume');
 await openExit();await page.getByRole('dialog',{name:'Concede native match'}).waitFor();lastStage='cancel exit confirmation';await gesture(page.getByRole('button',{name:'Keep playing',exact:true}));assert.equal(await page.getByRole('dialog',{name:'Concede native match'}).count(),0);check('Exit cancellation returns to the unchanged native match');
 if(full){
  lastStage='full native terminal';const end=Date.now()+boundedTimeout(naturalBudget,caseDeadline),beforeNaturalPosts=nativePosts;stateDeadline=end;
  // Deterministic supported test intention: answer actual required decisions and
  // yield priority. Do not compute legal moves, force a loss, or call concede.
  while(!verifiedTerminal(latest)&&Date.now()<end&&report.actions<1200)await passive();
  assert(verifiedTerminal(latest),'Natural match deadline/action bound reached; not a draw');
  assert.equal(concessionPosts,0,'Concession cannot count as natural completion');stateDeadline=caseDeadline;report.terminal=latest.result;report.naturalFinish=true;
  const first={matchId:latest.matchId,generation:latest.generation};
  await page.getByRole('heading',{name:'Match finished',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'terminal.png')});check('actual natural native result reaches dedicated immutable match result');
  assert(nativePosts>=beforeNaturalPosts,'Native action counter regressed');
  // Rematch must allocate through the visible application control, retaining
  // exact decks/policy, not replaying a result or writing session state.
  lastStage='explicit rematch';latest=null;await gesture(page.getByRole('button',{name:'Rematch setup',exact:true}));
  s=await ready(null,120000);assert.equal(report.creates,2);assert.notEqual(latest.matchId,first.matchId);assert.notEqual(latest.generation,first.generation);
  assert.equal(createBodies[1].difficultyPolicyVersion,expectedPolicy);
  for(const k of ['humanDeck','opponentDeck'])assert.equal(createHash('sha256').update(JSON.stringify(createBodies[1][k])).digest('hex'),report.selectedDigests[k]);
  // Native rematch can legitimately begin with warning -> Play -> Mulligan.
  for(let i=0;i<5&&s.inputType!=='InputConfirmMulligan';i++)s=await passive();
  assert.equal(s.inputType,'InputConfirmMulligan');assert.equal(own(s).zones.Hand.cards.length,7);s=await action(key('ok'),'rematch Keep');
  report.rematchVerified=true;check('explicit Rematch creates a new allocation/generation with exact decks and acknowledged native opening');
 }
 await ready();await openExit();lastStage='confirm native concession';await gesture(page.getByRole('button',{name:'Concede and return',exact:true}));await until(()=>terminals.length>(full?1:0));report.concession=terminals.at(-1).result;assert.equal(report.concession.draw,false);assert.notEqual(report.concession.winnerPlayerId,snapshots.at(-1).viewer);await page.locator('#practicePlayerMat').waitFor({state:'detached'});assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);assert.equal(await page.locator('[data-act=playStartCandidate]').isVisible(),true);check('explicit concession waits for native result and returns to existing Play');
 await gesture(page.locator('a.brand'));await page.getByRole('heading',{name:'Home',exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'#home');check('Home navigation after resource cleanup');
 assert.equal(concessionPosts,1);if(full){assert.equal(report.naturalFinish,true);assert.equal(report.rematchVerified,true);assert.equal(report.creates,2);assert.equal(terminals.length,2);}
 assert.equal(report.externalCredentialViolations,0);assert.equal(report.unexpectedRequests,0);assert.deepEqual(report.errors,[]);report.result='passed';
}catch(e){if(paymentProof)report.paymentProof=paymentProof.summary();report.result='failed';report.failure={stage:safeActionStage(lastStage),name:e.name};process.exitCode=1;}
finally{await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');if(page)await page.screenshot({path:path.join(out,report.result==='passed'?'complete.png':'failure.png'),timeout:5000}).catch(()=>{});await browser?.close();observationToken=null;console.log(JSON.stringify(report));}
