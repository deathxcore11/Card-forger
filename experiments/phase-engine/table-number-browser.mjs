// Browser input/serialization proof with a projected schema and simulated transport.
// Engine authority is checked separately by number-controls-engine.mjs.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const routes=new Map();
for(const file of ['interaction-surface.mjs','protocol-fault.mjs','card-placement.mjs','match-table.mjs','match-table.css','card-stats.mjs','random-outcomes.mjs','protocol-fault.mjs','match-session.mjs','priority-scheduler.mjs'])routes.set('/'+file,await readFile(new URL(file,import.meta.url)));
routes.set('/',Buffer.from(`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="match-table.css"><main id="table"></main><script type="module">
import {mountMatchTable} from './match-table.mjs';import {createMatchSession} from './match-session.mjs';
const surface={seat:0,turn:1,phase:'PreCombatMain',decision:{kind:'ChooseXValue'},players:[{seat:0,life:20},{seat:1,life:20}],cards:[],hand:[],stack:[],choices:[],canAct:false,awaitingHuman:true,interaction:{canSubmit:true,opportunities:[{interactionId:'numeric-x',type:'number',min:0,max:5,choices:[]}]}};
const outcomes=[{revision:0,order:0,outcome:{kind:'die',player:0,sides:20,result:22}},{revision:0,order:1,outcome:{kind:'ignored-die',player:0,sides:20,result:1}},{revision:0,order:2,outcome:{kind:'coin',player:1,won:false}}];
window.sent=[];window.state={revision:0,surface,outcomes,terminal:null,clock:{state:'needs-choice'}};
const session=createMatchSession({client:{close(){},async request(op,fields){if(op==='respond'){sent.push(structuredClone(fields));await new Promise(r=>setTimeout(r,75));state={...state,revision:state.revision+1,surface:{...surface,interaction:{canSubmit:false,opportunities:[]}}};}return structuredClone(state);}},onChange:s=>table.render(s)});
const table=mountMatchTable(document.getElementById('table'),{session});window.session=session;window.table=table;await session.open();window.loaded=true;
</script>`));
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,b=routes.get(p);if(!b){res.writeHead(404).end();return;}res.setHeader('Content-Type',p==='/'?'text/html':p.endsWith('.css')?'text/css':'text/javascript');res.end(b);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.loaded);
 const number=page.getByRole('spinbutton',{name:'Chosen number'}),confirm=page.getByRole('button',{name:'Confirm number'});
 assert.equal(await number.inputValue(),'');assert(await confirm.isDisabled());
 const results=page.getByRole('region',{name:'Recent rules results'});assert.match(await results.innerText(),/You rolled d20 · 22/);assert.match(await results.innerText(),/You ignored d20 roll 1/);assert.match(await results.innerText(),/CPU flipped a coin · lost/);assert(!/heads|tails/i.test(await results.innerText()));const resultsBefore=await results.innerText();
 for(const invalid of ['-1','6','1.5']){await number.fill(invalid);assert(await confirm.isDisabled());}assert.equal(await page.evaluate(()=>sent.length),0);
 await number.fill('2');assert(await confirm.isEnabled());await number.focus();
 await page.evaluate(()=>{window.inputBefore=document.querySelector('input');const s=session.snapshot();s.clock={remainingSeconds:12};table.render(s);});
 assert.equal(await number.inputValue(),'2');assert(await page.evaluate(()=>inputBefore===document.querySelector('input')&&document.activeElement===inputBefore));assert.equal(await page.evaluate(()=>sent.length),0);assert.equal(await results.innerText(),resultsBefore);
 await number.fill('0');await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirm number');b.click();b.click();});
 await page.waitForFunction(()=>session.snapshot().status.revision===1&&!session.snapshot().busy);const sent=await page.evaluate(()=>window.sent);assert.equal(sent.length,1);assert.deepEqual(sent[0].submission,{interactionId:'numeric-x',response:{type:'number',data:{value:0}}});assert.equal(await number.count(),0);assert.deepEqual(errors,[]);
 const report={passed:true,checks:['blank initial value and explicit confirmation','range and integer validation without submission','clock-only update preserves input node, text and focus','explicit zero submitted once under rapid duplicate click','accepted revision removes stale numeric prompt','engine-projected modified die, ignored roll and coin success display without face fabrication','timer paint leaves displayed outcomes unchanged and sends no command'],browser:browser.version(),sourceSha256:Object.fromEntries([...routes].map(([p,b])=>[p,createHash('sha256').update(b).digest('hex')])),limits:'Actual shared table/session with simulated schema/transport and outcome fixtures. Not an engine action, signed-in account route or complete match; see separate corrected-runtime proofs.'};
 const out=resolve('test-results/table-number');await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
