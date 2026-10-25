// Browser input/serialization proof with a projected schema and simulated transport.
// Engine authority is checked separately by casting-controls-engine.mjs.
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
const surface={seat:0,turn:1,phase:'PreCombatMain',decision:{kind:'NamedChoice'},players:[{seat:0,life:20},{seat:1,life:20}],cards:[],hand:[],stack:[],choices:[],canAct:false,awaitingHuman:true,interaction:{canSubmit:true,opportunities:[{interactionId:'ordered',type:'sequence',min:2,max:3,unique:false,choices:['a','b','c'].map(id=>({id,available:true,surfaces:[{type:'value',value:id}]}))}]}};
const outcomes=[];
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
 const pick=id=>page.getByRole('button',{name:id,exact:true}),order=page.getByRole('list',{name:'Chosen order'}),confirm=page.getByRole('button',{name:'Confirm choice',exact:true});
 await pick('a').click();await pick('b').click();await pick('a').click();assert(await pick('c').isDisabled());assert.equal(await page.evaluate(()=>sent.length),0);
 await order.getByRole('listitem').nth(2).getByRole('button',{name:'Remove',exact:true}).click();assert(await pick('c').isEnabled());
 await order.getByRole('listitem').nth(1).getByRole('button',{name:'Move earlier',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>session.snapshot().pending.choiceIds),['b','a']);assert(await order.getByRole('listitem').first().getByRole('button',{name:'Move earlier',exact:true}).isDisabled());
 await page.evaluate(()=>{const s=session.snapshot();s.clock={remainingSeconds:12};table.render(s);});assert.deepEqual(await page.evaluate(()=>session.snapshot().pending.choiceIds),['b','a']);
 await confirm.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>session.snapshot().status.revision===1&&!session.snapshot().busy);
 assert.deepEqual(await page.evaluate(()=>sent.map(s=>s.submission)),[{interactionId:'ordered',response:{type:'sequence',data:{choiceIds:['b','a']}}}]);assert.deepEqual(errors,[]);
 const report={passed:true,checks:['repeat occurrences retained','full sequence disables extra entries','remove reopens available capacity','keyboard-accessible move and explicit confirmation','timer paint preserves order','exact edited sequence submitted once'],browser:browser.version(),sourceSha256:Object.fromEntries([...routes].map(([p,b])=>[p,createHash('sha256').update(b).digest('hex')])),limits:'Actual shared table/session with simulated sequence schema and transport. Not an engine action, signed-in account route or complete match; see separate corrected-runtime proofs.'};
 const out=resolve('test-results/table-sequence');await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
