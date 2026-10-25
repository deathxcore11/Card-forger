// Local-only actual-WASM table proof. Never deploys or distributes runtime/data.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadMechanicsInputs,sha} from './mechanics-inputs.mjs';
const inputs=await loadMechanicsInputs({cardNames:['Forest','Grizzly Bears','Lightning Bolt']});
const out=resolve(process.env.CARDSTASHY_TABLE_OUTPUT||'test-results/phase-table');await mkdir(out,{recursive:true});
const routes=new Map(),files=['match-authority.mjs','human-command.mjs','visible-cpu-policy.mjs','visible-policy-worker.mjs','table-client.mjs','table-authority.mjs','worker-journal.mjs','protocol-fault.mjs','priority-clock.mjs','priority-scheduler.mjs','seat-surface.mjs','interaction-surface.mjs','smoke-policy-worker.mjs','match-session.mjs','card-placement.mjs','match-table.mjs','match-table.css','card-stats.mjs','random-outcomes.mjs'];
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
 let page=await open();report.browser=context.browser().version();
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 const countdownBefore=await page.getByLabel('Response time').textContent();const countdownRevision=(await page.evaluate(()=>session.snapshot())).status.revision;await page.waitForTimeout(1200);const countdownAfter=await page.getByLabel('Response time').textContent();assert(parseInt(countdownAfter)<parseInt(countdownBefore));assert.equal((await page.evaluate(()=>session.snapshot())).status.revision,countdownRevision);report.checks.push('visible countdown reads fresh authority time without a game mutation');
 await page.getByRole('button',{name:'Take a mulligan',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);
 await page.getByRole('button',{name:'Keep hand',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);
 let snap=await page.evaluate(()=>session.snapshot());assert.equal(snap.status.surface.interaction.opportunities[0].type,'select');assert.equal(snap.status.surface.hand.length,7);
 const oldRevision=snap.status.revision;
 const inspect=page.locator('.play-match-card').first();await inspect.click();assert.equal((await page.evaluate(()=>session.snapshot())).status.revision,oldRevision);
 await inspect.press('Shift+F10');assert.equal(await page.getByRole('menu').count(),1);await page.waitForTimeout(350);await page.keyboard.press('Escape');assert.equal(await page.getByRole('menu').count(),0);assert.equal((await page.evaluate(()=>session.snapshot())).status.revision,oldRevision);
 for(const [width,height]of [[1280,800],[1920,1080],[2560,1440]]){await page.setViewportSize({width,height});const layout=await page.locator('.play-match-decisions').boundingBox();assert(layout.y+layout.height<=height+1);const rail=await page.locator('.play-match-inspector').boundingBox();assert(rail.x>width/2);}
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:join(out,'bottom-choice.png')});
 await context.close();await new Promise(r=>server.close(r));page=await open(true,true);
 snap=await page.evaluate(()=>session.snapshot());assert.equal(snap.status.revision,oldRevision);assert.equal(snap.status.surface.hand.length,7);
 const field=page.locator('fieldset');await field.getByRole('button').first().click();assert.equal((await page.evaluate(()=>session.snapshot())).status.revision,oldRevision);
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.equal((await page.evaluate(()=>session.snapshot())).pending,null);
 await field.getByRole('button').first().click();await page.getByRole('button',{name:'Confirm choice',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);assert.equal((await page.evaluate(()=>session.snapshot())).status.surface.hand.length,6);
 report.checks.push('visible keep/mulligan/bottom selection','inspect/context menu/Escape leave revision unchanged','footer and inspector at three desktop widths','offline cold-browser resume during bottoming','clear local selection preserves prompt','explicit confirmation moves one card');
 // Drive visible human buttons through an entire real game; this driver is not CPU quality evidence.
 let acceptedHuman=0;
 while(true){
  const state=await page.evaluate(()=>session.snapshot());if(state.status.terminal){report.terminal=state.status.terminal;report.finalRevision=state.status.revision;report.finalTurn=state.status.surface.turn;break;}
  assert(!state.error,JSON.stringify(state));assert(acceptedHuman<1500,'human command ceiling');
  const choices=state.status.surface.choices;assert(choices.length,'required decision has no visible implemented choice');
  const ranks={PlayLand:0,CastSpell:1,DeclareAttackers:2,DeclareBlockers:3,PassPriority:4,MulliganDecision:5};
  const choice=[...choices].sort((a,b)=>(ranks[a.kind]??99)-(ranks[b.kind]??99)||b.label.length-a.label.length)[0];
  await page.locator('button[data-focus-key]').filter({hasText:choice.label}).first().click();await page.waitForFunction(()=>!session.snapshot().busy);acceptedHuman++;
 }
 report.acceptedHuman=acceptedHuman;report.checks.push('complete game using visible human buttons and bounded CPU command path');await page.screenshot({path:join(out,'terminal.png')});
 const recordDigest=async p=>p.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('cardstashy-phase-research-v1',1);q.onsuccess=()=>{const db=q.result,t=db.transaction('matches'),r=t.objectStore('matches').get('visible-table');t.oncomplete=async()=>{db.close();const bytes=new TextEncoder().encode(JSON.stringify(r.result));const digest=await crypto.subtle.digest('SHA-256',bytes);resolve({sha256:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''),revision:r.result.revision,history:r.result.history.length,receipts:Object.keys(r.result.receipts).length});};t.onabort=()=>reject(t.error);};q.onerror=()=>reject(q.error);}));
 const terminalRecord=await recordDigest(page);await context.close();page=await open(true,true);const restored=await page.evaluate(()=>session.snapshot());assert.deepEqual(restored.status.terminal,report.terminal);assert.equal(restored.status.revision,report.finalRevision);assert.deepEqual(await recordDigest(page),terminalRecord);report.terminalRecord=terminalRecord;report.checks.push('cold-offline terminal recovery preserves saved history and receipts without another command');
 report.harnessSha256=sha(await readFile(new URL(import.meta.url)));
 await writeFile(join(out,'table-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(context)await context.close();if(server.listening)await new Promise(r=>server.close(r));}
