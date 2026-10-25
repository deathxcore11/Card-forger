// Shared table/session/scheduler proof with explicit projected clock fixtures.
// This does not run an engine, consume real time, or certify timeout forfeits.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),routes=new Map();
for(const file of ['interaction-surface.mjs','protocol-fault.mjs','card-placement.mjs','match-table.mjs','match-table.css','card-stats.mjs','random-outcomes.mjs','match-session.mjs','priority-scheduler.mjs'])routes.set('/'+file,await readFile(new URL(file,import.meta.url)));
routes.set('/',Buffer.from(`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="match-table.css"><style>body{margin:0}</style><main id="table"></main><script type="module">
import {mountMatchTable} from './match-table.mjs';import {createMatchSession} from './match-session.mjs';
const surface={seat:0,turn:1,phase:'PreCombatMain',decision:{kind:'ChooseXValue'},players:[{seat:0,life:20,handCount:7,libraryCount:53},{seat:1,life:20,handCount:7,libraryCount:53}],cards:[],hand:[],stack:[],choices:[],canAct:false,awaitingHuman:true,interaction:{canSubmit:true,opportunities:[{interactionId:'numeric-x',type:'number',min:0,max:5,choices:[]}]}};
window.requests=[];window.exits=0;window.state={revision:0,surface,terminal:null,clock:{state:'waiting',remainingMs:30000,deadlineAt:Date.now()+30000},turnClock:{state:'human',idleRemainingMs:90000,turnRemainingMs:300000,remainingMs:90000,warning:false,expired:false,reason:null}};
let scheduled=null,serial=0;
const client={close(){},async request(op,fields){requests.push({op,fields:structuredClone(fields)});return structuredClone(state);}};
const session=createMatchSession({client,schedulerOptions:{setTimer(fn){scheduled=fn;return ++serial;},clearTimer(){scheduled=null;}},onChange:s=>table.render(s)});
const table=mountMatchTable(document.getElementById('table'),{session,allowConcede:true,onExit:()=>exits++});
window.session=session;window.table=table;window.poll=async limits=>{Object.assign(state.clock,limits.clock||{});Object.assign(state.turnClock,limits.turnClock||{});const run=scheduled;if(!run)throw Error('STATUS_POLL_NOT_SCHEDULED');scheduled=null;run();await new Promise(resolve=>setTimeout(resolve,0));};
await session.open();window.loaded=true;
</script>`));
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,b=routes.get(p);if(!b){res.writeHead(404).end();return;}res.setHeader('Content-Type',p==='/'?'text/html':p.endsWith('.css')?'text/css':'text/javascript');res.end(b);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const out=resolve(process.env.CARDSTASHY_BUDGET_OUTPUT||'test-results/table-budget');await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={passed:false,checks:[],layouts:[],browser:browser.version(),sourceSha256:Object.fromEntries([...routes].map(([p,b])=>[p,sha(b)])),limits:'Actual current shared table, session and scheduler with simulated authoritative clock/status schemas. No engine or real elapsed-time wait, account route, offline persistence, complete match or timeout-forfeit proof.'};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.loaded);
 const reaction=page.getByLabel('Response time',{exact:true}),idle=page.getByLabel('Inactivity time',{exact:true}),turn=page.getByLabel('Turn time',{exact:true}),number=page.getByRole('spinbutton',{name:'Chosen number'});
 assert.equal(await reaction.innerText(),'30s to respond');assert.equal(await idle.innerText(),'Idle 1:30');assert.equal(await turn.innerText(),'Turn 5:00');
 report.checks.push('distinct reaction 30 seconds, inactivity 1:30 and turn 5:00 displays from shared scheduler projection');
 await number.fill('2');await number.focus();await page.evaluate(()=>{window.inputBefore=document.querySelector('input');});
 for(const [idleMs,turnMs]of [[31000,301000],[30000,30000],[29000,29000]]){
  await page.evaluate(async({idleMs,turnMs})=>poll({clock:{remainingMs:10000},turnClock:{idleRemainingMs:idleMs,turnRemainingMs:turnMs,remainingMs:Math.min(idleMs,turnMs),warning:Math.min(idleMs,turnMs)<=30000}}),{idleMs,turnMs});
  assert.equal(await number.inputValue(),'2');assert(await page.evaluate(()=>inputBefore===document.querySelector('input')&&document.activeElement===inputBefore));
  assert.equal(await idle.evaluate(n=>n.classList.contains('play-match-warning')),idleMs<=30000);assert.equal(await turn.evaluate(n=>n.classList.contains('play-match-warning')),turnMs<=30000);
 }
 assert.equal(await reaction.evaluate(n=>n.classList.contains('play-match-warning')),false);
 await page.evaluate(()=>poll({clock:{remainingMs:5000}}));assert.equal(await reaction.innerText(),'5s to respond');assert.equal(await reaction.evaluate(n=>n.classList.contains('play-match-warning')),true);
 assert(await page.evaluate(()=>inputBefore===document.querySelector('input')&&document.activeElement===inputBefore));
 const actions=await page.evaluate(()=>requests.filter(r=>!['create','status'].includes(r.op)));assert.deepEqual(actions,[]);assert.equal((await page.evaluate(()=>session.snapshot())).status.revision,0);
 report.checks.push('inactivity and turn warnings activate at 30 seconds and remain off above the boundary','reaction warning activates at its separate five-second boundary','clock-only scheduler polls retain exact numeric input, text, focus and accepted revision without mutation requests');
 await page.evaluate(()=>poll({clock:{remainingMs:30000},turnClock:{idleRemainingMs:90000,turnRemainingMs:300000,remainingMs:90000,warning:false}}));
 for(const [width,height]of [[1280,720],[1920,1080],[3440,1440]]){
  await page.setViewportSize({width,height});
  const boxes=await page.evaluate(()=>{const labels=['Response time','Inactivity time','Turn time'];const nodes=[...labels.map(label=>document.querySelector('[aria-label="'+label+'"]')),document.querySelector('[aria-label="Match decisions"]'),document.querySelector('input'),document.querySelector('[data-focus-key="exit-match"]')];return nodes.map(n=>{const r=n.getBoundingClientRect();return {tag:n.getAttribute('aria-label')||n.tagName,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});});
  for(const b of boxes)assert(b.width>0&&b.height>0&&b.left>=0&&b.top>=0&&b.right<=width+.5&&b.bottom<=height+.5,JSON.stringify({width,height,box:b}));
  const screenshot=join(out,'budget-'+width+'x'+height+'.png');await page.screenshot({path:screenshot});report.layouts.push({width,height,boxes,screenshot});
 }
 report.checks.push('response/inactivity/turn timers, numeric input, decisions footer and exit control fit all three desktop viewports');
 const before=await page.evaluate(()=>({revision:session.snapshot().status.revision,requests:requests.length}));await page.evaluate(()=>table.requestExit());assert(await page.getByRole('dialog').isVisible());assert.match(await page.getByRole('dialog').innerText(),/Confirming ends this match as a loss/);await page.getByRole('button',{name:'Keep playing',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);const after=await page.evaluate(()=>({revision:session.snapshot().status.revision,requests:requests.length,exits,actions:requests.filter(r=>!['create','status'].includes(r.op))}));assert.equal(after.revision,before.revision);assert.equal(after.requests,before.requests);assert.equal(after.exits,0);assert.deepEqual(after.actions,[]);assert.deepEqual(errors,[]);
 report.checks.push('programmatic exit opens the existing concession confirmation; Keep playing cancels without an engine command or navigation');report.passed=true;
 console.log(JSON.stringify({passed:true,checks:report.checks,layouts:report.layouts.map(({width,height,screenshot})=>({width,height,screenshot})),limits:report.limits}));
}catch(error){report.error=String(error.stack||error);throw error;}
finally{report.harnessSha256=sha(await readFile(new URL(import.meta.url)));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.close(r));}
