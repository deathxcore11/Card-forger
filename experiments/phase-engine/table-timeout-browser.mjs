// Local-only actual-WASM table proof. Never deploys or distributes runtime/data.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadMechanicsInputs,sha} from './mechanics-inputs.mjs';
const inputs=await loadMechanicsInputs({cardNames:['Forest','Grizzly Bears','Lightning Bolt']});
const out=resolve(process.env.CARDSTASHY_TABLE_OUTPUT||'test-results/phase-table-timeout');await mkdir(out,{recursive:true});
const routes=new Map(),files=['visible-cpu-policy.mjs','visible-policy-worker.mjs','table-client.mjs','table-authority.mjs','worker-journal.mjs','protocol-fault.mjs','priority-clock.mjs','priority-scheduler.mjs','seat-surface.mjs','interaction-surface.mjs','smoke-policy-worker.mjs','match-session.mjs','match-table.mjs','match-table.css'];
for(const file of files)routes.set('/'+file,await readFile(new URL(file,import.meta.url)));
routes.set('/runtime/engine_wasm.js',await readFile(join(inputs.pkg,'engine_wasm.js')));routes.set('/runtime/engine_wasm_bg.wasm',inputs.wasm);routes.set('/runtime/cards.json',Buffer.from(inputs.cardsJson));
const config={version:inputs.provenance.buildIdentity+':table-v1',cardCount:3,hashes:Object.fromEntries([...routes].filter(([p])=>p.startsWith('/runtime/')).map(([p,b])=>[p,sha(b)]))};
routes.set('/runtime-config.mjs',Buffer.from('export const RUNTIME='+JSON.stringify(config)+';'));
routes.set('/',Buffer.from(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CardStashy private table proof</title><link rel="stylesheet" href="/match-table.css"><style>body{margin:0}</style><main id="table"></main><script type="module">
import {connect} from './table-client.mjs';import {createMatchSession} from './match-session.mjs';import {mountMatchTable} from './match-table.mjs';
let table;window.session=createMatchSession({client:connect('visible-table',{mode:'human-timed'}),onChange:s=>table?.render(s)});table=mountMatchTable(document.getElementById('table'),{session,profile:{displayName:'Human test seat'}});table.render(session.snapshot());await session.open({resume:new URL(location.href).searchParams.has('resume')});window.loaded=true;
</script>`));
const cache='table-'+sha(Buffer.concat([...routes.values()]));
routes.set('/sw.js',Buffer.from(`const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify([...routes.keys()])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin===self.location.origin)e.respondWith(caches.open(CACHE).then(c=>c.match(e.request,{ignoreSearch:true})).then(r=>r||fetch(e.request)));});`));
let requests=0;const server=createServer((req,res)=>{requests++;const p=new URL(req.url,'http://localhost').pathname,b=routes.get(p);if(!b){res.writeHead(404).end();return;}res.setHeader('Content-Type',p==='/'?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.wasm')?'application/wasm':p.endsWith('.json')?'application/json':'text/javascript');res.end(b);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')));
const launch={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],executablePath:process.env.CARDSTASHY_CHROMIUM_PATH};let context;
const report={provenance:inputs.provenance,files:Object.fromEntries([...routes].map(([p,b])=>[p,sha(b)])),checks:[],limits:'Local research table with unequal Forest/Bears Modern fixtures, no actual account, real card art/finish, calibrated CPU, Standard/Commander admission or all-mechanic controls. Not an owner-ready app preview.'};
const profile=join(out,'profile-'+Date.now());
async function open(offline=false,resume=false){context=await chromium.launchPersistentContext(profile,launch);await context.setOffline(offline);context.setDefaultTimeout(60000);const p=await context.newPage();p.on('pageerror',e=>console.error('PAGE',e.message));await p.setViewportSize({width:1440,height:900});await p.goto(origin+(resume?'/?resume=1':''));await p.waitForFunction(()=>window.loaded);return p;}
try{
 const page=await open();report.browser=context.browser().version();
 await page.getByRole('button',{name:'Keep hand',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);
 const before=await page.evaluate(()=>session.snapshot());assert.equal(before.status.waiting,'Priority');assert.equal(before.status.surface.prioritySeat,0);
 await page.waitForFunction(()=>session.snapshot().clock?.warning===true,{},{timeout:35000});
 assert.equal((await page.evaluate(()=>session.snapshot())).status.revision,before.status.revision);assert(await page.locator('.play-match-warning').count());
 await page.waitForFunction(revision=>session.snapshot().status.revision>revision&&session.snapshot().busy===false,before.status.revision,{timeout:10000});
 const after=await page.evaluate(()=>session.snapshot());assert.equal(after.error,null);assert.equal(after.status.surface.prioritySeat,0);assert.equal(after.status.revision,before.status.revision+2);
 assert.deepEqual(after.status.surface.players.map(p=>p.life),before.status.surface.players.map(p=>p.life));
 report.result={beforeRevision:before.status.revision,afterRevision:after.status.revision,defaultWindowMs:30000,nearExpiryWarning:true,oneHumanTimeoutPass:true,oneCpuResponse:true,nextHumanDecision:true};
 report.checks=['visible near-expiry warning before mutation','real 30-second human timeout','one accepted human pass plus legal CPU response','next human decision with unchanged life'];
 report.harnessSha256=sha(await readFile(new URL(import.meta.url)));await writeFile(join(out,'table-timeout-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(context)await context.close();if(server.listening)await new Promise(r=>server.close(r));}
