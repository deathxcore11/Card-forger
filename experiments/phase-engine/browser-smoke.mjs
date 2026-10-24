// Optional real-browser proof. Uses external pinned inputs; serves only a private
// localhost diagnostic origin, never the application or third-party websites.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const pkg=process.env.CARDSTASHY_PHASE_PKG,source=process.env.CARDSTASHY_PHASE_SOURCE;
assert(pkg&&source,'Use the exact external pkg/source paths documented in README.md.');
const out=resolve(process.env.CARDSTASHY_PHASE_BROWSER_OUTPUT||'test-results/phase-browser');await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const inputs=[['engine_wasm.js','47c42e78d34eeaad37d74b8163e5319d0578ba0ee8bd3476cfb70131de6287c9'],['engine_wasm_bg.wasm','6057521d851bb8544eaeea467f741b90cd2941aa5ba2fddb17e1bcc3d9933f8f']];
const routes=new Map();
for(const [file,hash]of inputs){const bytes=await readFile(join(pkg,file));assert.equal(sha(bytes),hash);routes.set('/runtime/'+file,bytes);}
const cards=await readFile(join(source,'crates/engine/tests/fixtures/runtime_card_export_fixture.json'));assert.equal(sha(cards),'ee062b8ad351e067723b79fc8462aaea19202ef9756d35b2101334eb3e350107');routes.set('/runtime/cards.json',cards);
const dir=new URL('./',import.meta.url),files=['worker-journal.mjs','browser-authority.mjs','browser-client.mjs','smoke-policy-worker.mjs','seat-surface.mjs'];
for(const file of files)routes.set('/'+file,await readFile(new URL(file,dir)));
routes.set('/',Buffer.from(`<!doctype html><meta charset="utf-8"><title>CardStashy engine diagnostic</title><p>Research harness. No playable interface.</p><script type="module">import {connect} from './browser-client.mjs';window.connect=connect;window.loaded=true;</script>`));
const cache='phase-research-'+sha(Buffer.concat([...routes.values()]));
routes.set('/sw.js',Buffer.from(`const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify([...routes.keys()])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin===self.location.origin)e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||fetch(e.request)));});`));
let requests=0;const server=createServer((req,res)=>{requests++;const path=new URL(req.url,'http://localhost').pathname,bytes=routes.get(path);if(!bytes){res.writeHead(404).end();return;}res.setHeader('Content-Type',path==='/'?'text/html':path.endsWith('.wasm')?'application/wasm':path.endsWith('.json')?'application/json':'text/javascript');res.end(bytes);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const modulePath=process.env.CARDSTASHY_PLAYWRIGHT_MODULE||join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'node_modules','playwright/index.mjs');
const {chromium}=await import(pathToFileURL(resolve(modulePath)));
const launch={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],...(process.env.CARDSTASHY_CHROMIUM_PATH?{executablePath:process.env.CARDSTASHY_CHROMIUM_PATH}:{})};
// A unique profile keeps prior runs and actual application storage untouched.
const profile=join(out,'profile-'+Date.now());let context;
const report={upstream:'71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234',sourceFiles:Object.fromEntries(files.map(f=>[f,sha(routes.get('/'+f))])),cases:[],checks:[],limits:'Forest/Bears smoke only; ungraded summary-only policy. Not game UI, general privacy/rules/card-pool certification, production offline package, device performance or full engine gate.'};
async function open(offline=false){context=await chromium.launchPersistentContext(profile,launch);await context.setOffline(offline);context.setDefaultTimeout(60000);const page=await context.newPage();page.on('pageerror',e=>console.error('PAGE',e.message));await page.goto(origin);await page.waitForFunction(()=>window.loaded);return page;}
async function readRecord(page,key){return page.evaluate(key=>new Promise((resolve,reject)=>{const q=indexedDB.open('cardstashy-phase-research-v1',1);q.onsuccess=()=>{const db=q.result,t=db.transaction('matches'),r=t.objectStore('matches').get(key);t.oncomplete=()=>{db.close();resolve(r.result);};t.onabort=()=>reject(t.error);};q.onerror=()=>reject(q.error);}),key);}
async function copyRecord(page,from,to){await page.evaluate(({from,to})=>new Promise((resolve,reject)=>{const q=indexedDB.open('cardstashy-phase-research-v1',1);q.onsuccess=()=>{const db=q.result,t=db.transaction('matches','readwrite'),s=t.objectStore('matches'),r=s.get(from);r.onsuccess=()=>s.put(r.result,to);t.oncomplete=()=>{db.close();resolve();};t.onabort=()=>reject(t.error);};}),{from,to});}
async function run(page,{key,seed,first,stop=20000,resume=false}){return page.evaluate(async o=>{
 window.client?.close();window.client=connect(o.key);let status=await client.request(o.resume?'resume':'create',o.resume?{}:{seed:o.seed,first:o.first});
 while(!status.terminal&&status.revision<o.stop)status=await client.request('step',{id:'step-'+status.revision,revision:status.revision});return status;
 },{key,seed,first,stop,resume});}
try{
 let page=await open();report.browser=await context.browser().version();
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 const reference=JSON.parse(await readFile(new URL('evidence-2026-10-24.json',dir),'utf8'));
 for(const first of [0,1])for(const seed of [12345,67890,24680]){
  const key=`smoke-${seed}-${first}`,start=performance.now();let status;
  if(seed===12345&&first===0){
   status=await run(page,{key,seed,first,stop:80});assert.equal(status.waiting,'Priority');await copyRecord(page,key,'cold-resume');
   const duplicate=await page.evaluate(()=>client.request('step',{id:'step-79',revision:79}));assert.deepEqual(duplicate,status);
   const stale=await page.evaluate(()=>client.request('step',{id:'stale',revision:0}).catch(e=>e.message));assert.equal(stale,'STALE_REVISION');
   const collision=await page.evaluate(()=>client.request('step',{id:'step-79',revision:80}).catch(e=>e.message));assert.equal(collision,'ID_COLLISION');
   const race=await page.evaluate(()=>Promise.allSettled([client.request('step',{id:'step-80',revision:80}),client.request('step',{id:'race',revision:80})]).then(rs=>rs.map(r=>r.status==='fulfilled'?r.value:r.reason.message)));assert.equal(race.filter(r=>r==='STALE_REVISION').length,1);assert.equal((await readRecord(page,key)).revision,81);
   report.checks.push('duplicate receipt','stale rejection','ID collision','concurrent revision rejection');
   status=await run(page,{key,resume:true});
  }else status=await run(page,{key,seed,first});
  assert(status.terminal,'action ceiling is failure');
  const record=await readRecord(page,key),expected=reference.cases.find(c=>c.seed===seed&&c.first===first);
  assert.equal(sha(JSON.stringify(record.history)),expected.acceptedTraceSha256);assert.equal(status.revision,expected.actions);assert.equal(status.turn,expected.turn);assert.equal(status.terminal.winner,expected.terminal.data.winner);
  const row={seed,first,actions:status.revision,turn:status.turn,winner:status.terminal.winner,traceSha256:sha(JSON.stringify(record.history)),milliseconds:Math.round(performance.now()-start)};report.cases.push(row);console.log(JSON.stringify(row));
 }
 // Test the human command route with explicit offered choices. This scripted
 // driver acts as the human; no UI usability or playing strength follows.
 const human=await page.evaluate(async()=>{
  client.close();window.client=connect('human-route',{mode:'human'});
  let status=await client.request('create',{seed:12345,first:0});let counts={};
  const noChoice=await client.request('step',{revision:0,id:'missing-human-choice'}).then(()=>null,e=>e.message);
  if(noChoice!=='CHOICE_REQUIRED')throw Error('Human turn was automated');
  let lastHumanToken=null;
  while(!status.terminal&&status.revision<20000){
   const choices=status.surface.choices;let selected=null;
   if(choices.length){
    // Deterministic test driver; inspect-only requests must not move the game.
    const read=await client.request('status');if(read.revision!==status.revision)throw Error('Read changed revision');
    const weights={MulliganDecision:1000,PlayLand:900,CastSpell:800,DeclareAttackers:500,DeclareBlockers:400,PassPriority:0};
    selected=[...choices].sort((a,b)=>(weights[b.kind]||0)-(weights[a.kind]||0)||(a.label==='Keep hand'?-1:b.label==='Keep hand'?1:0)||b.label.length-a.label.length)[0];
    lastHumanToken=selected.token;counts[selected.kind]=(counts[selected.kind]||0)+1;
   }else if(status.surface.unavailableReason)throw Error(status.surface.unavailableReason);
   status=await client.request('step',{revision:status.revision,id:'human-'+status.revision,...(selected?{choice:selected.token}:{})});
  }
  if(!status.terminal)throw Error('Human-route action ceiling');
  return {actions:status.revision,turn:status.turn,terminal:status.terminal,choices:counts,noChoice,onlySeat:status.surface.seat};
 });
 assert.equal(human.onlySeat,0);for(const type of ['MulliganDecision','PlayLand','CastSpell','DeclareAttackers','PassPriority'])assert(human.choices[type]>0,type);
 report.humanRoute=human;console.log(JSON.stringify({humanRoute:human}));
 // Finish acknowledged writes, stop all workers/browser processes, then remove
 // the origin server and networking before navigating a fresh browser process.
 await context.close();context=null;await new Promise(r=>server.close(r));const servedBeforeCold=requests;
 page=await open(true);assert.equal(await page.evaluate(()=>navigator.onLine),false);
 const coldStart=performance.now(),restored=await run(page,{key:'cold-resume',resume:true,stop:80});assert.equal(restored.revision,80);assert.equal(restored.waiting,'Priority');
 const repeated=await page.evaluate(()=>client.request('step',{id:'step-79',revision:79}));assert.deepEqual(repeated,restored);
 const final=await run(page,{key:'cold-resume',resume:true}),cold=await readRecord(page,'cold-resume'),expected=reference.cases[0];
 assert.equal(sha(JSON.stringify(cold.history)),expected.acceptedTraceSha256);assert.equal(final.revision,expected.actions);assert.equal(final.turn,expected.turn);assert.equal(final.terminal.winner,expected.terminal.data.winner);assert.equal(requests,servedBeforeCold);
 report.coldOffline={freshBrowserProcess:true,serverStopped:true,networkOffline:true,restoredRevision:80,pending:'Priority',duplicateReceiptSurvived:true,exactTraceAndOutcome:true,milliseconds:Math.round(performance.now()-coldStart)};
 // New match creation also works from the cached package with no origin server.
 const fresh=await run(page,{key:'created-offline',seed:67890,first:1,stop:1});assert.equal(fresh.revision,1);report.coldOffline.newMatchCreated=true;
 await writeFile(join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.coldOffline));
}finally{await context?.close();if(server.listening)await new Promise(r=>server.close(r));}
