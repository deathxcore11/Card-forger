// Real Chromium + actual existing Play handlers + actual host/Forge. All match
// mutations originate in rendered controls. No force clicks, native fetch POST,
// DOM state injection, hidden-hand lookup, invented legal list or synthetic win.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
const require=createRequire(path.join(process.env.FORGE_BROWSER_TOOLS,'package.json')),{chromium}=require('playwright');
const base=process.env.FORGE_UI_ORIGIN;if(!base||!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Explicit loopback fixture origin required');
const mode=process.env.FORGE_BROWSER_CASE||'saved-keen',touch=process.env.FORGE_TOUCH==='true',width=Number(process.env.FORGE_WIDTH||1440),height=Number(process.env.FORGE_HEIGHT||1000),full=process.env.FORGE_FULL_JOURNEY==='true';
const out=path.resolve(process.env.FORGE_BROWSER_OUT||'test-results/forge-existing-play');await fs.mkdir(out,{recursive:true});
const report={schema:'forge-existing-play-browser.v1',result:'running',case:mode,scope:'isolated existing Play menu/actual app handlers with synthetic auth/cache provider; not whole-app boot or production persistence',browser:null,viewport:{width,height,hasTouch:touch},checks:[],actions:0,creates:0,privacyChecks:0,externalCredentialViolations:0,unexpectedRequests:0,terminal:null,errors:[]};
let browser,page,latest=null,lastStage='startup',nativePosts=0,createBodies=[],terminals=[],snapshots=[],actionIds=new Set();
const pause=ms=>new Promise(r=>setTimeout(r,ms)),check=n=>{report.checks.push(n);console.log('PASS '+n);},own=s=>s.players.find(p=>p.isViewer);
async function until(fn,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await pause(40);}throw Error('Bounded wait expired at '+lastStage);}
function privacy(s){
 const p=s.prompt,reveals=p?.method==='getChoices'&&p.supported&&p.acknowledgeOnly&&p.min===0&&p.max===0?(p.options||[]).map(o=>o.value).filter(c=>c?.hidden===false&&['Hand','Library'].includes(c.zone)):[];
 for(const player of s.players)for(const zone of ['Library',...(!player.isViewer?['Hand']:[])])for(const c of player.zones[zone].cards){assert.equal(c.hidden,false);assert.equal(c.owner,player.id);assert.equal(c.zone,zone);assert.deepEqual(reveals.filter(r=>r.id===c.id&&r.owner===c.owner&&r.zone===zone),[c],'Private identity must equal an exact current native reveal');}report.privacyChecks++;
}
function verifiedTerminal(v){return v?.status==='finished'&&typeof v.result?.draw==='boolean'&&(v.result.draw||Number.isSafeInteger(v.result.winnerPlayerId)&&snapshots.at(-1)?.players.some(p=>p.id===v.result.winnerPlayerId));}
async function ready(oldRevision=null,timeout=20000){return until(async()=>{if(verifiedTerminal(latest))return latest;const s=latest?.snapshot;if(!s||s.revision===oldRevision||s.busy||s.inputType==='InputLockUI'&&!s.prompt)return false;const rev=await page.locator('[data-native-panel]').getAttribute('data-native-revision').catch(()=>null);return rev===String(s.revision)?s:false;},timeout);}
const key=k=>page.locator(`[data-native-panel] [data-native-key="${k}"]`);
const gesture=locator=>touch?locator.tap():locator.click();
async function action(locator,label='native control'){
 lastStage=label;const old=latest?.snapshot?.revision,posts=nativePosts;
 const [response,clicked]=await Promise.allSettled([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/actions')&&r.request().method()==='POST',{timeout:15000}),gesture(locator)]);
 if(response.status==='rejected'||clicked.status==='rejected'){
  report.failedAction={stage:label,clickSettled:clicked.status,responseSettled:response.status,nativePosts:nativePosts-posts,reason:clicked.status==='rejected'?(/intercepts pointer events/.test(String(clicked.reason?.message))?'pointer-intercepted':'click-failed'):'native-post-timeout',geometry:await locator.evaluateAll(es=>{const el=es[0];if(!el)return {matches:0};const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {matches:es.length,rect:{x:r.x,y:r.y,width:r.width,height:r.height},centerReceivesPointer:h===el||el.contains(h),hitCardId:h?.closest('[data-instance]')?.dataset.instance||null};}).catch(()=>null)};throw Error('Rendered action failed');
 }
 assert.equal(response.value.status(),202,'Host rejected rendered action');return ready(old);
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
 browser=await chromium.launch({headless:true});report.browser=browser.version();
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,serviceWorkers:'block',...(touch?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel Fold) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}:{})});
 await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url()),h=req.headers(),local=u.origin===base,art=u.origin==='https://cards.scryfall.io'&&req.method()==='GET'&&req.resourceType()==='image';if(!local&&(h.authorization||h.cookie)){report.externalCredentialViolations++;return route.abort();}if(local||art)return route.continue();report.unexpectedRequests++;return route.abort();});
 page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.name));
 page.on('request',r=>{try{const u=new URL(r.url());if(u.origin!==base)return;if(u.pathname==='/api/play/matches'&&r.method()==='POST'){report.creates++;createBodies.push(r.postDataJSON());}if(u.pathname.endsWith('/actions')&&r.method()==='POST'){const body=r.postDataJSON();nativePosts++;report.actions++;assert(!actionIds.has(body.commandId),'A command was retried');actionIds.add(body.commandId);}}catch(e){report.errors.push(e.name);}});
 page.on('response',async r=>{try{const u=new URL(r.url());if(u.origin!==base||r.request().method()!=='GET'||!/^\/api\/play\/matches\/[^/]+$/.test(u.pathname)||r.status()!==200)return;const value=await r.json();latest=value;if(value.snapshot){privacy(value.snapshot);snapshots.push(value.snapshot);if(snapshots.length>3)snapshots.shift();}if(verifiedTerminal(value)&&!terminals.some(t=>t.matchId===value.matchId))terminals.push(value);}catch(e){report.errors.push(e.name);}});
 await page.goto(base+'/forge-play-browser.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.fixtureReady==='true');
 const fixture=await (await fetch(base+'/fixture-decks.json')).json(),human=fixture.decks[0],cpu=fixture.decks[mode.includes('reign')?2:1];
 if(mode.startsWith('import')){await gesture(page.locator('#playImportDisclosure summary'));await page.locator('#playImportName').fill('Calling All Angels imported browser fixture');await page.locator('#playImportText').fill(fixture.angelsImport);await gesture(page.locator('[data-act=playImportPreview]'));await gesture(page.locator('[data-act=playImportUse]'));}else await gesture(page.locator(`[data-act=playSelectDeck][data-play-deck="${human.id}"]`));
 await gesture(page.locator('.play-matchup [data-act=playInspectSeat][data-play-seat=opponent]'));await gesture(page.locator(`[data-act=playSelectDeck][data-play-deck="${cpu.id}"]`));
 assert.equal(await page.locator('[data-act=playStartCandidate]').isEnabled(),true);await page.screenshot({path:path.join(out,'setup.png')});check('existing Play menu selects concrete human and CPU decks through actual handlers');
 lastStage='native startup';await gesture(page.locator('[data-act=playStartCandidate]'));let s=await ready(null,140000);assert.equal(report.creates,1);assert.equal(createBodies[0].difficultyPolicyVersion,'forge-default-smart-v1');assert.deepEqual(createBodies[0].opponentDeck,cpu);if(!mode.startsWith('import'))assert.deepEqual(createBodies[0].humanDeck,human);else assert.deepEqual(createBodies[0].humanDeck.cards.map(r=>[r.name,r.qty]).sort(),human.cards.map(r=>[r.name,r.qty]).sort());
 report.selectedDigests=Object.fromEntries(['humanDeck','opponentDeck'].map(k=>[k,createHash('sha256').update(JSON.stringify(createBodies[0][k])).digest('hex')]));assert.equal(s.controlMode,'smart');assert(s.players.every(p=>p.life===40));check('exact snapshots admitted by real host with native Smart policy');
 for(let i=0;i<5&&s.inputType!=='InputConfirmMulligan';i++)s=await passive();
 assert.equal(s.inputType,'InputConfirmMulligan');assert.equal(own(s).zones.Hand.cards.length,7);await page.screenshot({path:path.join(out,'opening.png')});check('real native seven-card opening after existing setup');
 s=await action(key('ok'),'native Keep');for(let i=0;i<40&&!(s.phase==='MAIN1'&&s.activePlayer===s.viewer&&!s.prompt);i++)s=await passive();assert.equal(s.phase,'MAIN1');assert.equal(s.activePlayer,s.viewer);
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
  s=await action(page.locator(`.play-match-hand [data-instance="${mimic.id}"]`),touch?'native creature tap':'native creature click');
  for(let i=0;i<30&&(!own(s).zones.Battlefield.cards.some(c=>c.id===mimic.id)||s.prompt);i++)s=await passive();
  assert(own(s).zones.Battlefield.cards.some(c=>c.id===mimic.id),'Creature did not resolve through native casting and payment');await page.screenshot({path:path.join(out,'resolved.png')});check('real native creature cast, Smart payment, creature-type choice and resolution');
 }

 s=await action(key('mode-full'),'native Full Control');assert.equal(s.controlMode,'full');assert.equal(await key('mode-full').getAttribute('aria-pressed'),'true');s=await action(key('mode-smart'),'native Smart');assert.equal(s.controlMode,'smart');check('Smart / Full buttons reflect actual native acknowledgements');
 const exit=page.locator('[data-focus-key=exit-match]');await gesture(exit);await page.getByRole('dialog',{name:'Concede native match'}).waitFor();await gesture(page.getByRole('button',{name:'Keep playing',exact:true}));assert.equal(await page.getByRole('dialog',{name:'Concede native match'}).count(),0);check('Exit cancellation returns to the unchanged native match');
 if(full){lastStage='full native terminal';const end=Date.now()+720000;while(!verifiedTerminal(latest)&&Date.now()<end&&report.actions<1200)await passive();assert(verifiedTerminal(latest),'No verified native terminal outcome');report.terminal=latest.result;await page.getByRole('heading',{name:'Match finished',exact:true}).waitFor();await page.screenshot({path:path.join(out,'terminal.png')});check('actual native result reaches dedicated immutable match result');
  latest=null;await gesture(page.getByRole('button',{name:'Rematch setup',exact:true}));s=await ready(null,140000);assert.equal(report.creates,2);assert.notEqual(latest.matchId,terminals[0].matchId);check('explicit Rematch creates a different allocation');if(s.inputType==='InputConfirm')s=await action(key('ok'),'rematch Play');if(s.inputType==='InputConfirmMulligan')s=await action(key('ok'),'rematch Keep');
 }
 await ready();await gesture(page.locator('[data-focus-key=exit-match]'));await gesture(page.getByRole('button',{name:'Concede and return',exact:true}));await until(()=>terminals.length>(full?1:0));report.concession=terminals.at(-1).result;assert.equal(report.concession.draw,false);assert.notEqual(report.concession.winnerPlayerId,snapshots.at(-1).viewer);await page.locator('#practicePlayerMat').waitFor({state:'detached'});assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);assert.equal(await page.locator('[data-act=playStartCandidate]').isVisible(),true);check('explicit concession waits for native result and returns to existing Play');
 await gesture(page.locator('a.brand'));await page.getByRole('heading',{name:'Home',exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'#home');check('Home navigation after resource cleanup');
 assert.equal(report.externalCredentialViolations,0);assert.equal(report.unexpectedRequests,0);assert.deepEqual(report.errors,[]);report.result='passed';
}catch(e){report.result='failed';report.failure={stage:lastStage,name:e.name,message:String(e.message).replace(/https?:\/\/\S+/g,'[url]').slice(0,240)};process.exitCode=1;}
finally{await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');if(page)await page.screenshot({path:path.join(out,report.result==='passed'?'complete.png':'failure.png'),timeout:5000}).catch(()=>{});await browser?.close();console.log(JSON.stringify(report));}
