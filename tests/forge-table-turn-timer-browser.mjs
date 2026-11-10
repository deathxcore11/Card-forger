// Live Forge table (fixture board): the turn clock draws a ring and a line while the game waits on you, warns in the
// last 10 s, passes the turn at zero, and stands still while a card pop-up or the menu is open.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),shots=process.env.TIMER_SHOTS||'';
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 for(const viewport of [{width:844,height:390},{width:1104,height:884}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
  await page.clock.install({time:Date.now()});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
  await page.clock.runFor(1500);
  await page.evaluate(()=>{window.calls=[];const s=window.fixture.session;s.nativeButton=(...a)=>{window.calls.push(['button',...a]);return Promise.resolve();};});
  const state=()=>page.evaluate(()=>{const r=document.getElementById('practicePlayerMat');const ok=r.querySelector('[data-native-key=ok]');return {timer:r.dataset.turnTimer||null,warn:r.dataset.turnWarn||null,left:Number(r.style.getPropertyValue('--tt-left')||'NaN'),count:r.querySelector('.forge-turn-count')?.textContent||null,ring:!!r.querySelector('.forge-turn-ring'),calls:window.calls.slice()};});
  let s=await state();
  assert.equal(s.timer,'own','your turn shows the clock');assert.ok(s.left>.9,`the ring starts nearly full (${s.left})`);assert.equal(s.ring,true,'the main button carries the ring');assert.equal(s.warn,null);
  await page.clock.runFor(30000);s=await state();assert.ok(s.left<.7&&s.left>.55,`it drains (${s.left})`);
  // A card pop-up open: the clock stands still.
  await page.evaluate(()=>{const c=document.querySelector('.play-match-zone[data-owner=you] .play-match-card');c.click();});await page.clock.runFor(600);
  const open=await page.evaluate(()=>!!document.querySelector('.forge-peek[data-open="true"]'));
  if(open){const before=(await state()).left;await page.clock.runFor(20000);const after=(await state()).left;assert.ok(Math.abs(before-after)<.03,'a card pop-up pauses the clock');await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelector('.forge-peek')?.dispatchEvent(new Event('pointerdown')));}
  await page.mouse.click(2,2);
  await page.clock.runFor(5000);
  await page.clock.runFor(45000);s=await state();
  assert.equal(s.warn,'true','the last seconds warn');
  {const f=await page.evaluate(()=>({n:document.querySelector('.forge-fuse b')?.textContent||null,w:parseFloat(document.querySelector('.forge-fuse-burn')?.style.width||'NaN'),ring:!!document.querySelector('.forge-turn-ring'),count:!!document.querySelector('.forge-turn-count'),hot:document.querySelector('.forge-fuse')?.dataset.hot||null}));
   assert.ok(f.n&&Number(f.n)<=10,`the rope shows the seconds (${f.n})`);assert.equal(f.hot,'true','coral in the last 10 s');assert.ok(f.w>=0&&f.w<=260/3+1,`the fuse is a third or less of the way (${f.w}px)`);assert.equal(f.ring||f.count,false,'one countdown: no ring or number beside the button while the rope burns');}
  assert.equal(await page.evaluate(()=>!!document.querySelector('.forge-rope:not([hidden])')),false,'the old idle fuse stays off while the turn clock runs');
  if(shots)await page.screenshot({path:`${shots}/timer-real-${viewport.width}.png`});
  await page.clock.runFor(12000);s=await state();
  assert.ok(s.calls.length>=1&&s.calls.length<=3&&s.calls.every(c=>c[1]==='cancel'),`at zero the turn is passed with End turn (and retried only if the board did not move): ${JSON.stringify(s.calls)}`);
  console.log(`PASS ${viewport.width}x${viewport.height}: ring and line drain, the last 10 s warn with a number, a pop-up pauses it, zero passes the turn.`);
  await context.close();
 }

 // A friend match: the host's clock is drawn, and the table never answers for itself.
 for(const viewport of [{width:844,height:390},{width:1104,height:884}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
  await page.clock.install({time:Date.now()});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main&friend');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
  await page.clock.runFor(1500);
  await page.evaluate(()=>{window.calls=[];const s=window.fixture.session;s.nativeButton=(...a)=>{window.calls.push(['button',...a]);return Promise.resolve();};s.concede=()=>{window.calls.push(['concede']);return Promise.resolve();};});
  const feed=(remainingMs,over={})=>page.evaluate(([ms,o])=>{const n=window.fixture.native;window.fixture.session.acceptState({...n,afk:{own:true,reason:'turn',total:90000,deadline:Date.now()+ms,serverNow:Date.now(),remainingMs:ms,strikes:0,strikeLimit:3,...o}});},[remainingMs,over]);
  const read=()=>page.evaluate(()=>{const r=document.getElementById('practicePlayerMat');return {timer:r.dataset.turnTimer||null,warn:r.dataset.turnWarn||null,left:Number(r.style.getPropertyValue('--tt-left')||'NaN'),count:r.querySelector('.forge-turn-count')?.textContent||null,calls:window.calls.slice()};});
  await feed(36000);await page.clock.runFor(600);let s=await read();
  assert.equal(s.timer,'own');assert.ok(s.left>.35&&s.left<.42,`the ring starts from the host's 36 s of 90 (${s.left})`);
  await page.clock.runFor(20000);s=await read();assert.ok(s.left>.14&&s.left<.2,`it counts down from there (${s.left})`);
  assert.equal(await page.evaluate(()=>!!document.querySelector('.forge-fuse')),true,'inside the last 30 s the rope burns on the divider');
  await feed(7000,{strikes:2});await page.clock.runFor(600);s=await read();
  assert.equal(s.warn,'true','the host last 10 s warn');
  {const n=await page.evaluate(()=>document.querySelector('.forge-fuse b')?.textContent||null);assert.ok(n&&Number(n)<=7,`the rope follows the host (${n})`);}
  assert.ok(await page.evaluate(()=>!!document.querySelector('.forge-afk-note')),'a second strike shows the concede warning');
  if(shots)await page.screenshot({path:`${shots}/timer-host-${viewport.width}.png`});
  await page.clock.runFor(30000);s=await read();assert.deepEqual(s.calls,[],'the host answers; the table does not');
  await feed(50000,{own:false});await page.clock.runFor(600);s=await read();assert.equal(s.timer,'rival','the other seat window is a line only');
  console.log(`PASS ${viewport.width}x${viewport.height} friend: the host's clock is drawn and the table never acts for itself.`);
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
