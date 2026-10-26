// Real Chromium + unchanged real Forge. The test reads snapshots as assertions;
// every state-changing command must originate from a rendered user control.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(path.join(process.env.FORGE_BROWSER_TOOLS,'package.json'));
const {chromium}=require('playwright');
const out=path.resolve('test-results/forge-browser-proof/artifact');
const revision='e5a0f8156da70ffc7866f923bed371c0111707cd';
const summary={schema:'forge-native-browser-proof.v1',scope:'isolated Forge browser roundtrip and terminal; NOT whole-app, Angels, difficulty-selector or Smart-flow acceptance',commit:process.env.GITHUB_SHA||null,forgeRevision:revision,seed:20261025,humanDeck:'keen-engineering',aiDeck:'reign-of-dragons',aiProfile:'Default',controlMode:'full',browser:null,result:'running',checks:[],actions:0,prompts:[],inputs:[],terminal:null};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let browser,page,conn,state,lastStage='startup',connected=false;
const observedInputs=new Set(),observedPrompts=new Set(),pageErrors=[];
let externalCredentialViolations=0,unexpectedRequests=0;
async function bounded(fn,ms=20000){const until=Date.now()+ms;let result;while(Date.now()<until){result=await fn();if(result)return result;await pause(35);}throw Error(`Timeout at ${lastStage}`);}
const check=name=>{summary.checks.push(name);console.log(`PASS ${name}`);};
const own=s=>s.players.find(p=>p.isViewer);
async function get(){const r=await fetch(conn.baseUrl+'/state',{headers:{Authorization:'Bearer '+conn.token},signal:AbortSignal.timeout(3000)});assert.equal(r.status,200,'Native state request rejected');const s=await r.json();assert.equal(s.forgeRevision,revision);assert.equal(s.failure,null,'Native engine failure');if(s.inputType)observedInputs.add(s.inputType);if(s.prompt)observedPrompts.add(s.prompt.method);return s;}
function privacy(s){
  // Native reveal acknowledgements may temporarily expose an exact card while
  // it remains in a normally private zone (e.g. Adaptive Omnitool). This is not
  // permission to expose its neighbours or preserve visibility after the prompt.
  const p=s.prompt,reveals=p?.method==='getChoices'&&p.supported===true&&p.acknowledgeOnly===true&&p.min===0&&p.max===0
    ?(p.options||[]).map(o=>o.value).filter(c=>c&&c.hidden===false&&Number.isSafeInteger(c.id)&&Number.isSafeInteger(c.owner)&&typeof c.name==='string'&&['Hand','Library'].includes(c.zone)):[];
  for(const player of s.players)for(const zone of ['Library',...(!player.isViewer?['Hand']:[])]){
    const cards=player.zones[zone].cards,ids=new Set();
    for(const card of cards){
      assert.equal(card.hidden,false,'Hidden identity escaped a private zone');
      assert.equal(card.owner,player.id,'Private-zone owner mismatch');
      assert.equal(card.zone,zone,'Private-zone label mismatch');
      assert.ok(!ids.has(card.id),'Duplicate private-zone identity');ids.add(card.id);
      const matches=reveals.filter(r=>r.id===card.id&&r.owner===player.id&&r.zone===zone);
      assert.equal(matches.length,1,'Private identity lacks an exact current native reveal acknowledgement');
      assert.deepEqual(card,matches[0],'Private-zone identity differs from the exact native revealed card');
    }
  }
}
async function sync(s){
  await page.waitForFunction(rev=>document.querySelector('[data-native-panel]')?.dataset.nativeRevision===String(rev),s.revision,{timeout:15000});
}
async function next(old){let seen=null,since=0;state=await bounded(async()=>{const s=await get();if(s.revision!==seen){seen=s.revision;since=Date.now();}return s.revision!==old.revision&&!s.busy&&(s.status==='finished'||s.inputType!=='InputLockUI'||s.prompt)&&Date.now()-since>=100?s:null;});privacy(state);await sync(state);return state;}
const key=k=>page.locator(`[data-native-panel] [data-native-key="${k}"]`);
function clickFailureReason(error){
  // Classify known Playwright actionability failures without retaining its raw
  // call log, DOM text, URL, request headers, or arbitrary exception message.
  const message=String(error?.message||'');
  if(/intercepts pointer events/.test(message))return 'pointer-intercepted';
  if(/outside of the viewport/.test(message))return 'outside-viewport';
  if(/not visible/.test(message))return 'not-visible';
  if(/not enabled/.test(message))return 'not-enabled';
  if(/not stable/.test(message))return 'not-stable';
  if(/detached/.test(message))return 'detached';
  if(/strict mode violation/.test(message))return 'multiple-matching-controls';
  return error?.name==='TimeoutError'?'click-timeout':'click-failed';
}
async function clickDiagnostics(locator){
  return locator.evaluateAll(elements=>{
    const el=elements[0];if(!el)return {matches:0};
    const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
    const describe=node=>{if(!node)return null;const id=node.closest('.play-match-card[data-instance]')?.dataset.instance;return {tag:node.tagName,classes:[...node.classList].filter(c=>/^(play-|native-|forge-)[a-z0-9_-]{1,70}$/i.test(c)).slice(0,8),visibleCardId:/^\d+$/.test(id||'')?Number(id):null};};
    return {matches:elements.length,control:describe(el),rect:{x:r.x,y:r.y,width:r.width,height:r.height},centerInViewport:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,centerReceivesPointer:!!hit&&(hit===el||el.contains(hit)),centerHit:describe(hit)};
  }).catch(()=>({unavailable:true}));
}
async function action(locator){
  const old=state;await sync(old);const before=summary.actions;
  // Attach rejection handlers to BOTH operations immediately. A failed click
  // must not leave a later response timeout unhandled and kill the reporter.
  const [response,click]=await Promise.allSettled([
    page.waitForResponse(r=>r.url()===conn.baseUrl+'/action'&&r.request().method()==='POST',{timeout:15000}),
    locator.click()
  ]);
  if(click.status==='rejected'||response.status==='rejected'){
    summary.failedAction={stage:lastStage,reason:click.status==='rejected'?clickFailureReason(click.reason):'native-post-response-timeout',clickSettled:click.status,responseSettled:response.status,nativePosts:summary.actions-before,nativeBusy:old.busy===true,nativeInput:/^Input[A-Za-z0-9_]+$/.test(old.inputType||'')?old.inputType:null,control:await clickDiagnostics(locator)};
    throw click.status==='rejected'?click.reason:response.reason;
  }
  assert.equal(response.value.status(),202,'Rendered action rejected by native engine');return next(old);
}
async function button(k){return action(key(k));}
async function reply(p,{forceOne=false,testDraft=false}={}){
  assert.equal(p.supported,true,`Unsupported native prompt ${p.method}`);
  if(p.acknowledgeOnly)return button('acknowledge-prompt');
  if(['confirm','showConfirmDialog'].includes(p.method))return button('reply-true');
  if(p.method==='showInputDialog'){
    const input=key('native-value');const tag=await input.evaluate(el=>el.tagName);
    if(tag==='SELECT')await input.selectOption(String(p.options[0].value));else await input.fill(String(p.initialValue||'0'));
    return button('submit-value');
  }
  assert.notEqual(p.method,'order','Ordering is outside this adapter proof');
  const count=Math.max(p.min,forceOne?1:0),options=p.options.slice(0,count);
  assert.equal(options.length,count,'Native choices missing');
  if(testDraft&&options.length){const before=summary.actions,o=key(`option-${options[0].index}`);await o.click();assert.equal(await o.getAttribute('aria-pressed'),'true');await o.click();assert.equal(await o.getAttribute('aria-pressed'),'false');assert.equal(summary.actions,before,'Draft toggles sent a native command');check('repeated option clicks remain local drafts');}
  for(const o of options)await key(`option-${o.index}`).click();
  return button('confirm-prompt');
}
async function passive(){
  if(state.prompt)return reply(state.prompt);
  if(state.inputType==='InputAttack'&&state.buttons.cancel==='Alpha Strike')return button('cancel');
  if(state.buttons.okEnabled)return button('ok');
  const chosen=new Set(state.selection.chosen.map(c=>c.id));
  const c=state.selection.cards.find(c=>!chosen.has(c.id));
  if(c){const control=key(`ref-card-${c.id}`),details=control.locator('xpath=ancestor::details');if(!await details.evaluate(el=>el.open))await details.locator('summary').click();return action(control);}
  throw Error(`No supported rendered passive command for ${state.inputType}`);
}
try {
  await fs.mkdir(out,{recursive:true});
  await bounded(async()=>{try{conn=JSON.parse(await fs.readFile(path.join(process.env.FORGE_PROOF_ROOT,'adapter/connection.json'),'utf8'));state=await get();return state.schema==='cardstashy.forge-proof.v1'&&state.buttons;}catch{return false;}},60000);
  assert.equal(conn.baseUrl,'http://127.0.0.1:8765');assert.equal(conn.forgeRevision,revision);
  assert.equal(state.aiProfile,'Default');assert.equal(state.match.humanDeck,'keen-engineering');assert.equal(state.match.aiDeck,'reign-of-dragons');assert.equal(state.controlMode,'full');
  const denied=await fetch(conn.baseUrl+'/state');assert.equal(denied.status,401);check('bridge denies unauthenticated private state');
  browser=await chromium.launch({headless:true});summary.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const req=route.request(),u=new URL(req.url()),headers=req.headers();
    const local=u.protocol==='http:'&&u.hostname==='127.0.0.1'&&['8765','8766'].includes(u.port);
    const art=u.origin==='https://cards.scryfall.io'&&req.method()==='GET'&&req.resourceType()==='image';
    if(!local&&(headers.authorization||headers.cookie)){externalCredentialViolations++;return route.abort();}
    if(local||art)return route.continue();unexpectedRequests++;return route.abort();
  });
  page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>pageErrors.push(e.name));
  page.on('request',r=>{if(r.url()===conn.baseUrl+'/action'&&r.method()==='POST'){summary.actions++;const body=r.postDataJSON();assert.notEqual(body.op,'concede','No manufactured terminal outcome');}});
  await page.goto('http://127.0.0.1:8766/experiments/forge-proof/index.html',{waitUntil:'networkidle'});
  assert.match(await page.title(),/CardStashy/);
  await page.locator('#connectionFile').setInputFiles(path.join(process.env.FORGE_PROOF_ROOT,'adapter/connection.json'));
  await page.getByText('Local connection loaded. Ready to connect.',{exact:true}).waitFor();
  await page.locator('#connectButton').click();await page.locator('#table').waitFor({state:'visible'});connected=true;
  state=await get();await sync(state);assert.equal(await page.locator('#bridgeToken').inputValue(),'');check('real Chromium loaded actual CardStashy table and cleared token field');
  assert.ok(state.players.every(p=>p.life===40));privacy(state);
  lastStage='native Play';await button('ok');
  assert.equal(state.inputType,'InputConfirmMulligan');assert.equal(own(state).zones.Hand.cards.length,7);privacy(state);
  assert.equal(await page.locator('.play-match-hand .play-match-card').count(),7);
  await page.screenshot({path:path.join(out,'opening.png')});check('native Play and visible seven-card Commander opening hand');
  lastStage='representative unfolded viewport';
  const beforeViewport=summary.actions;
  await page.setViewportSize({width:960,height:1024});
  await page.locator('[data-native-panel]').scrollIntoViewIfNeeded();
  const bounds=await page.locator('[data-native-panel]').boundingBox();
  assert.ok(bounds&&bounds.width>0&&bounds.x>=-1&&bounds.x+bounds.width<=961,'Native controls escape representative unfolded width');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Document overflows representative unfolded width');
  assert.equal(await key('ok').isEnabled(),true);
  await page.screenshot({path:path.join(out,'unfolded.png')});
  assert.equal(summary.actions,beforeViewport,'Viewport change mutated the game');
  summary.representativeUnfoldedViewport={width:960,height:1024,actualHardware:false};
  check('representative 960x1024 unfolded layout keeps native controls usable without a move');
  await page.setViewportSize({width:1440,height:1000});
  const first=own(state).zones.Hand.cards[0],before=summary.actions;
  await page.locator(`.play-match-hand [data-instance="${first.id}"]`).press('i');
  assert.match(await page.locator('.play-match-card-inspector h2').textContent(),new RegExp(first.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await page.getByRole('button',{name:'Close inspector',exact:true}).click();assert.equal(summary.actions,before);check('inspect and Close do not mutate native game');
  lastStage='native Keep';await button('ok');
  for(let i=0;i<30&&!(state.phase==='MAIN1'&&state.activePlayer===state.viewer&&state.inputType==='InputPassPriority');i++)await passive();
  assert.equal(state.phase,'MAIN1');assert.equal(state.activePlayer,state.viewer);check('Keep advances through native priorities to first main phase');
  lastStage='play land';const land=own(state).zones.Hand.cards.find(c=>c.type.includes('Land'));assert.ok(land);
  await action(page.locator(`.play-match-hand [data-instance="${land.id}"]`));
  if(state.prompt){assert.equal(state.prompt.method,'getAbilityToPlay');await reply(state.prompt,{forceOne:true});}
  assert.ok(own(state).zones.Battlefield.cards.some(c=>c.id===land.id));
  await page.locator(`.play-match-zone[data-owner="you"] [data-instance="${land.id}"]`).waitFor();check('browser card click plays land through native Forge');
  lastStage='cast and pay';const ring=own(state).zones.Hand.cards.find(c=>c.name==='Sol Ring');assert.ok(ring,'Pinned seed must offer the known native Sol Ring line');
  await action(page.locator(`.play-match-hand [data-instance="${ring.id}"]`));
  lastStage='native ability cancellation and resume';
  assert.equal(state.prompt?.method,'getAbilityToPlay');assert.equal(state.prompt.min,0);
  await button('confirm-prompt');
  assert.equal(state.prompt,null,'Canceled ability dialog stayed open');assert.equal(state.busy,false,'Canceled ability permanently busy');
  assert.ok(own(state).zones.Hand.cards.some(c=>c.id===ring.id),'Canceled spell left hand');
  assert.equal(state.stack.length,0,'Canceled spell was put on stack');
  assert.equal(own(state).zones.Battlefield.cards.find(c=>c.id===land.id).tapped,false,'Cancel spent mana');
  await action(page.locator(`.play-match-hand [data-instance="${ring.id}"]`));
  assert.equal(state.prompt?.method,'getAbilityToPlay');check('native ability cancellation returns control and the same spell can be reopened');
  lastStage='cast and pay';
  assert.equal(state.prompt?.method,'getAbilityToPlay');await reply(state.prompt,{forceOne:true,testDraft:true});
  let sawStack=state.stack.some(s=>s.source?.id===ring.id),sawPayment=state.inputType.startsWith('InputPayMana');
  for(let i=0;i<12&&!own(state).zones.Battlefield.cards.some(c=>c.id===ring.id);i++){
    if(state.prompt)await reply(state.prompt,{forceOne:true});else await button('ok');
    sawStack ||= state.stack.some(s=>s.source?.id===ring.id);sawPayment ||= state.inputType.startsWith('InputPayMana');
  }
  assert.ok(sawPayment,'Real native payment prompt not observed');assert.ok(sawStack,'Real native stack item not observed');
  assert.ok(own(state).zones.Battlefield.cards.some(c=>c.id===ring.id));assert.ok(own(state).zones.Battlefield.cards.some(c=>c.type.includes('Land')&&c.tapped));
  await page.locator(`.play-match-zone[data-owner="you"] [data-instance="${ring.id}"]`).waitFor();
  await page.screenshot({path:path.join(out,'resolved.png')});check('actual native ability, payment, tapped land, stack and Sol Ring resolution rendered');
  // Reuse the same native match. Test automation chooses only engine-presented
  // controls, never mutates snapshots or substitutes a synthetic winner.
  lastStage='full native match';const matchDeadline=Date.now()+240000;
  for(let i=0;i<800&&state.status!=='finished';i++){
    assert.ok(Date.now()<matchDeadline,'Native browser match exceeded four-minute observation bound');
    await passive();
  }
  assert.equal(state.status,'finished','Native full match did not reach terminal state');privacy(state);
  assert.ok(state.winner||state.draw===true);assert.ok(state.turn>1);
  await sync(state);await page.getByText(/Forge result:/).waitFor();
  summary.terminal={turn:state.turn,winner:state.winner,winnerPlayerId:state.winnerPlayerId,draw:state.draw};
  await page.screenshot({path:path.join(out,'terminal.png')});check('same native match reaches and renders a real non-conceded terminal result');
  assert.deepEqual(pageErrors,[],'Browser runtime errors');assert.equal(externalCredentialViolations,0);assert.equal(unexpectedRequests,0,'Unexpected nonlocal service request');
  check('no browser exceptions or unapproved credential/service requests');summary.result='passed';
} catch(error) {
  summary.result='failed';summary.failedStage=lastStage;
  // Error objects can contain response bodies or token-bearing requests; do not
  // serialize arbitrary errors, page console logs, browser traces or snapshots.
  summary.failureClass=['Error','TimeoutError','AssertionError','TypeError'].includes(error?.name)?error.name:'Error';
  console.error(`FAIL Forge browser proof at ${lastStage} (${summary.failureClass}${summary.failedAction?', '+summary.failedAction.reason:''}); no whole-app pass claimed.`);
  // Persist before screenshot/cleanup, which can themselves fail or time out.
  await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
  if(connected&&page)await page.screenshot({path:path.join(out,'failure.png'),timeout:5000}).catch(()=>{});
  process.exitCode=1;
} finally {
  summary.inputs=[...observedInputs];summary.prompts=[...observedPrompts];
  summary.pageErrorCount=pageErrors.length;summary.externalCredentialViolations=externalCredentialViolations;summary.unexpectedRequests=unexpectedRequests;
  await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
  await browser?.close().catch(()=>{});
}
