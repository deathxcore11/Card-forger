// Local-only actual-WASM table proof. Never deploys or distributes runtime/data.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadMechanicsInputs,sha} from './mechanics-inputs.mjs';
const inputs=await loadMechanicsInputs({cardNames:['Forest','Grizzly Bears','Lightning Bolt','Mountain']});
const out=resolve(process.env.CARDSTASHY_TABLE_OUTPUT||'test-results/phase-casting-browser');await mkdir(out,{recursive:true});
const routes=new Map(),files=['human-command.mjs','visible-cpu-policy.mjs','visible-policy-worker.mjs','table-client.mjs','table-authority.mjs','worker-journal.mjs','protocol-fault.mjs','priority-clock.mjs','priority-scheduler.mjs','seat-surface.mjs','interaction-surface.mjs','smoke-policy-worker.mjs','match-session.mjs','match-table.mjs','match-table.css'];
for(const file of files)routes.set('/'+file,await readFile(new URL(file,import.meta.url)));
routes.set('/runtime/engine_wasm.js',await readFile(join(inputs.pkg,'engine_wasm.js')));routes.set('/runtime/engine_wasm_bg.wasm',inputs.wasm);routes.set('/runtime/cards.json',Buffer.from(inputs.cardsJson));
const config={version:inputs.provenance.buildIdentity+':table-v1',cardCount:4,decks:{player:{main_deck:[...Array(56).fill('Mountain'),...Array(4).fill('Lightning Bolt')]},opponent:{main_deck:Array(60).fill('Forest')}},hashes:Object.fromEntries([...routes].filter(([p])=>p.startsWith('/runtime/')).map(([p,b])=>[p,sha(b)]))};
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
const report={provenance:inputs.provenance,files:Object.fromEntries([...routes].map(([p,b])=>[p,sha(b)])),checks:[],limits:'Four-card Modern research fixture with Mountain/Bolt versus Forest. No account, real artwork/finish, competitive deck or broad payment/mechanic claim. Not an owner-ready app preview.'};
const profile=join(out,'profile-'+Date.now());
async function open(offline=false,resume=false){context=await chromium.launchPersistentContext(profile,launch);await context.setOffline(offline);context.setDefaultTimeout(60000);const p=await context.newPage();p.on('pageerror',e=>console.error('PAGE',e.message));await p.setViewportSize({width:1440,height:900});await p.goto(origin+(resume?'/?resume=1':''));await p.waitForFunction(()=>window.loaded);return p;}
try{
 const page=await open();report.browser=context.browser().version();
 await page.getByRole('button',{name:'Keep hand',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);
 for(let step=0;step<100;step++){
  const snap=await page.evaluate(()=>session.snapshot());assert(!snap.error,JSON.stringify(snap));
  const hand=snap.status.surface.cards.filter(c=>snap.status.surface.hand.includes(c.id));
  const hasBolt=hand.some(c=>c.name==='Lightning Bolt'),land=snap.status.surface.cards.find(c=>c.zone==='Battlefield'&&c.name==='Mountain'&&!c.tapped);
  if(hasBolt&&land&&snap.status.surface.prioritySeat===0&&snap.status.surface.decision.kind==='Priority')break;
  const choices=snap.status.surface.choices,play=choices.find(c=>c.kind==='PlayLand'),choice=play||choices.find(c=>c.kind==='PassPriority')||choices[0];assert(choice);await page.getByRole('button',{name:choice.label,exact:true}).first().click();await page.waitForFunction(()=>!session.snapshot().busy);
 }
 let snap=await page.evaluate(()=>session.snapshot());const bolt=snap.status.surface.cards.find(c=>c.zone==='Hand'&&c.name==='Lightning Bolt');assert(bolt);
 const begin=async()=>{await page.locator(`[data-instance="${bolt.id}"]`).click();await page.getByRole('button',{name:'Cast · manual mana',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);const status=await page.evaluate(()=>session.snapshot());assert.equal(status.status.waiting,'TargetSelection');await page.getByRole('button',{name:'Player 2',exact:true}).click();await page.getByRole('button',{name:'Confirm choice',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);assert.equal((await page.evaluate(()=>session.snapshot())).status.waiting,'ManaPayment');};
 const choose=async code=>{await page.locator('fieldset button').filter({hasText:{tapLandForMana:'Tap for mana',cancelCast:'Cancel casting',passPriority:'Pay selected mana'}[code]}).first().click();await page.getByRole('button',{name:'Confirm choice',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);};
 await begin();await choose('cancelCast');snap=await page.evaluate(()=>session.snapshot());assert(snap.status.surface.cards.some(c=>c.id===bolt.id&&c.zone==='Hand'));assert(snap.status.surface.cards.filter(c=>c.zone==='Battlefield'&&c.name==='Mountain').every(c=>!c.tapped));
 await begin();await choose('tapLandForMana');await choose('passPriority');snap=await page.evaluate(()=>session.snapshot());assert.equal(snap.status.surface.stack.length,1);
 for(let step=0;step<10;step++){snap=await page.evaluate(()=>session.snapshot());if(snap.status.surface.stack.length===0)break;await page.getByRole('button',{name:'Pass priority',exact:true}).click();await page.waitForFunction(()=>!session.snapshot().busy);}
 snap=await page.evaluate(()=>session.snapshot());assert.equal(snap.status.surface.players[1].life,17);assert.equal(snap.status.surface.players[0].life,20);assert(snap.status.surface.cards.some(c=>c.name==='Lightning Bolt'&&c.zone==='Graveyard'));
 report.checks=['visible manual cast from exact hand instance','ordered opponent target confirmation','explicit cast cancellation preserves card and untapped mana source','explicit tap and payment confirmation','visible stack and legal response','chosen opponent takes three damage'];report.finalRevision=snap.status.revision;report.harnessSha256=sha(await readFile(new URL(import.meta.url)));await page.screenshot({path:join(out,'bolt-resolved.png')});await writeFile(join(out,'casting-browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(context)await context.close();if(server.listening)await new Promise(r=>server.close(r));}
