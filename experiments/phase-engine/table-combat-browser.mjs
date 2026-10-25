// Browser input/serialization proof with a projected schema and simulated transport.
// Engine authority is checked separately by text-controls-engine.mjs.
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
const choices=['a','c','p'].map(id=>({id,available:true,surfaces:[{type:'object',name:id==='a'?'Bear A':id==='c'?'Bear B':'CPU'}]}));
const opportunity={interactionId:'combat',type:'relations',min:0,max:2,sourceConstraint:'atMostOne',allowGroups:false,edges:[{sourceId:'a',targetIds:['p']},{sourceId:'c',targetIds:['p']}],choices};
const surface={seat:0,turn:2,phase:'DeclareAttackers',decision:{kind:'DeclareAttackers'},players:[{seat:0,life:20},{seat:1,life:20}],cards:[],hand:[],stack:[],choices:[],canAct:false,awaitingHuman:true,interaction:{canSubmit:true,opportunities:[opportunity]}};
window.opportunity=opportunity;window.sent=[];window.state={revision:0,surface,terminal:null,clock:{state:'needs-choice'}};
const session=createMatchSession({client:{close(){},async request(op,fields){if(op==='respond'){sent.push(structuredClone(fields));await new Promise(r=>setTimeout(r,75));state={...state,revision:state.revision+1,surface:{...surface,interaction:{canSubmit:false,opportunities:[]}}};}return structuredClone(state);}},onChange:s=>table.render(s)});
const table=mountMatchTable(document.getElementById('table'),{session});window.session=session;window.table=table;await session.open();window.loaded=true;
</script>`));
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname,b=routes.get(p);if(!b){res.writeHead(404).end();return;}res.setHeader('Content-Type',p==='/'?'text/html':p.endsWith('.css')?'text/css':'text/javascript');res.end(b);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.loaded);
 const confirm=page.getByRole('button',{name:'Confirm attackers'}),targets=page.getByRole('button',{name:'Attack CPU',exact:true});
 assert(await confirm.isEnabled());assert.equal(await targets.count(),2);
 await targets.nth(0).click();assert.equal(await targets.nth(0).getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>sent.length),0);
 await targets.nth(1).click();assert.match(await page.locator('fieldset').innerText(),/2 attackers selected/);
 await page.evaluate(()=>{const s=session.snapshot();s.clock={remainingSeconds:12};table.render(s);});assert.equal(await targets.nth(0).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Clear combat selection'}).click();assert.equal(await targets.nth(0).getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>sent.length),0);
 await targets.nth(0).focus();await page.keyboard.press('Enter');await targets.nth(1).click();
 await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirm attackers');b.click();b.click();});
 await page.waitForFunction(()=>session.snapshot().status.revision===1&&!session.snapshot().busy);
 let sent=await page.evaluate(()=>window.sent);assert.equal(sent.length,1);assert.deepEqual(sent[0].submission.response.data.relations,[{sourceId:'a',targetId:'p',group:null},{sourceId:'c',targetId:'p',group:null}]);
 // A multi-block capacity is not reduced to one target per source by the UI.
 await page.evaluate(async()=>{state={...state,revision:2,surface:{...state.surface,decision:{kind:'DeclareBlockers'},interaction:{canSubmit:true,opportunities:[{...opportunity,interactionId:'block',sourceConstraint:'engineValidated',edges:[{sourceId:'p',targetIds:['a','c']}]}]}}};await session.refresh();});
 await page.getByRole('button',{name:'Block Bear A',exact:true}).click();await page.getByRole('button',{name:'Block Bear B',exact:true}).click();assert.equal(await page.evaluate(()=>sent.length),1);
 await page.getByRole('button',{name:'Confirm blockers'}).click();await page.waitForFunction(()=>sent.length===2&&!session.snapshot().busy);sent=await page.evaluate(()=>window.sent);assert.equal(sent[1].submission.response.data.relations.length,2);assert.deepEqual(errors,[]);
 const report={passed:true,browser:browser.version(),checks:['attacker selection is local until confirmation','clear is local only','timer-only paint retains assignments','keyboard can select a combat target','duplicate confirm sends exactly one command','engineValidated multi-block keeps two targets for one blocker'],sourceSha256:Object.fromEntries([...routes].map(([p,b])=>[p,createHash('sha256').update(b).digest('hex')])),limits:'Shared actual table/session with simulated transport. Actual rule validation is a separate delivered-runtime driver, not a signed-in full match.'};await mkdir('test-results/combat-controls',{recursive:true});await writeFile('test-results/combat-controls/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
