// Optional real-browser timer/recovery proof. Uses pinned inputs; serves only a private
// localhost diagnostic origin, never the application or third-party websites.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const pkg=process.env.CARDSTASHY_PHASE_PKG,source=process.env.CARDSTASHY_PHASE_SOURCE;
assert(pkg&&source,'Use the exact external pkg/source paths documented in README.md.');
const out=resolve(process.env.CARDSTASHY_PHASE_BROWSER_OUTPUT||'test-results/phase-browser-timer');await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const inputs=[['engine_wasm.js','47c42e78d34eeaad37d74b8163e5319d0578ba0ee8bd3476cfb70131de6287c9'],['engine_wasm_bg.wasm','6057521d851bb8544eaeea467f741b90cd2941aa5ba2fddb17e1bcc3d9933f8f']];
const routes=new Map();
for(const [file,hash]of inputs){const bytes=await readFile(join(pkg,file));assert.equal(sha(bytes),hash);routes.set('/runtime/'+file,bytes);}
const cards=await readFile(join(source,'crates/engine/tests/fixtures/runtime_card_export_fixture.json'));assert.equal(sha(cards),'ee062b8ad351e067723b79fc8462aaea19202ef9756d35b2101334eb3e350107');routes.set('/runtime/cards.json',cards);
const dir=new URL('./',import.meta.url),files=['priority-scheduler.mjs','priority-clock.mjs','protocol-fault.mjs','interaction-surface.mjs','worker-journal.mjs','browser-authority.mjs','browser-client.mjs','smoke-policy-worker.mjs','seat-surface.mjs'];
for(const file of files)routes.set('/'+file,await readFile(new URL(file,dir)));
routes.set('/',Buffer.from(`<!doctype html><meta charset="utf-8"><title>CardStashy engine diagnostic</title><p>Research harness. No playable interface.</p><script type="module">import {connect} from './browser-client.mjs';import {createPriorityScheduler} from './priority-scheduler.mjs';window.createPriorityScheduler=createPriorityScheduler;window.connect=connect;window.loaded=true;</script>`));
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
try {
 let page=await open();report.browser=await context.browser().version();
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 const before=await page.evaluate(async()=>{
  window.client=connect('timed-human',{mode:'human-timed'});
  let s=await client.request('create',{seed:12345,first:0});
  for(let i=0;i<100&&!(s.waiting==='Priority'&&s.surface.prioritySeat===0);i++){
   const choice=s.surface.choices.find(c=>c.label==='Keep hand')||s.surface.choices[0];
   s=await client.request('step',{revision:s.revision,...(choice?{choice:choice.token}:{})});
  }
  if(s.waiting!=='Priority'||s.surface.prioritySeat!==0)throw Error('NO_HUMAN_PRIORITY');
  const early=await client.request('tick',{revision:s.revision,id:'early'});
  if(early.revision!==s.revision||early.clock.deadlineAt!==s.clock.deadlineAt)throw Error('EARLY_MUTATION');
  client.close();return s;
 });
 const saved=await readRecord(page,'timed-human');assert.equal(saved.clock.current.deadlineAt,before.clock.deadlineAt);
 await context.close();await new Promise(r=>server.close(r));page=await open(true);
 const result=await page.evaluate(async before=>{
  window.client=connect('timed-human',{mode:'human-timed'});
  const resumed=await client.request('resume');
  if(resumed.clock.deadlineAt!==before.clock.deadlineAt)throw Error('DEADLINE_RESET');
  let revision=resumed.revision,latest=null,ticks=0;
  await new Promise((resolve,reject)=>{
   const watchdog=setTimeout(()=>{scheduler.stop();reject(Error('TIMER_STALLED'));},40000);
   const scheduler=createPriorityScheduler({request:async({op})=>{
    const r=await client.request(op,op==='tick'?{revision,id:'browser-timeout'}:{});if(op==='tick')ticks++;revision=r.revision;return r;
   },onStatus:s=>{latest=s;if(s.revision===resumed.revision+1){scheduler.stop();clearTimeout(watchdog);resolve();}},onError:()=>{clearTimeout(watchdog);reject(Error('SCHEDULER_FAILED'));}});
   scheduler.start();
  });
  const duplicate=await client.request('tick',{id:'browser-timeout',revision:resumed.revision});
  const final=await client.request('status');client.close();
  return {resumedDeadline:resumed.clock.deadlineAt,ticks,latest,duplicateRevision:duplicate.revision,finalRevision:final.revision,prioritySeat:final.surface.prioritySeat};
 },before);
 assert.equal(result.ticks,1);assert.equal(result.finalRevision,before.revision+1);assert.equal(result.duplicateRevision,result.finalRevision);assert.equal(result.prioritySeat,1);
 const final=await readRecord(page,'timed-human');assert.equal(final.history.length,saved.history.length+1);assert.equal(final.history.at(-1).action.type,'PassPriority');assert.deepEqual(final.history.slice(0,-1),saved.history);
 report.checks=['real human priority','early tick no mutation','cold browser restart offline','unchanged absolute deadline','scheduler single legal pass','duplicate receipt no second move','atomic clock/action/receipt IndexedDB record'];
 report.result=result;report.harnessSha256=sha(await readFile(new URL(import.meta.url)));report.inputs=inputs;report.fixtureSha256=sha(cards);
 await writeFile(join(out,'browser-timer-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally {if(context)await context.close();if(server.listening)await new Promise(r=>server.close(r));}
