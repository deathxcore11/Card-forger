// CPU-006: real Chromium practice/client/session/authority/policy workers.
// The human is a deterministic fixture driver, not an authenticated app user.
// Run against a reconciled candidate; no production source is edited by this test.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {resolve, join, posix} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(process.argv[2]||'.');
const runtime=resolve(process.env.CPU006_RUNTIME_DIR||join(root,'experiments/phase-engine/runtime/a86578b23adcd26c'));
const out=resolve(process.env.CPU006_OUTPUT||'test-results/cpu006');
const sha=value=>createHash('sha256').update(value).digest('hex');
const routes=new Map(),sources={};
const todo=['play-menu.js','experiments/phase-engine/practice-flow.mjs','experiments/phase-engine/practice-preflight.mjs','experiments/phase-engine/practice-authority.mjs','experiments/phase-engine/cpu-public-worker.mjs'];
while(todo.length){
 const path=todo.pop();if(routes.has('/'+path))continue;
 const bytes=await readFile(join(root,path));routes.set('/'+path,bytes);sources[path]=sha(bytes);
 for(const match of bytes.toString().matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g))todo.push(posix.normalize(posix.join(posix.dirname(path),match[1])));
}
// Observe only routing/count/timing, without changing the input, choice or RNG.
const policyPath='/experiments/phase-engine/cpu-public-worker.mjs';
routes.set(policyPath,Buffer.concat([routes.get(policyPath),Buffer.from(`
const cpu006Handle=globalThis.onmessage;
globalThis.onmessage=event=>{const started=performance.now();cpu006Handle(event);console.info('CPU006_POLICY '+JSON.stringify({difficulty:event.data.packet.difficulty,decision:event.data.packet.combat.decision,choices:event.data.packet.legacy.choices.length,elapsedMs:performance.now()-started}));};
`)]));
// Session-only execution must not silently gain recovery or durable match writes.
const authorityPath='/experiments/phase-engine/practice-authority.mjs';
routes.set(authorityPath,Buffer.concat([Buffer.from(`Object.defineProperty(globalThis,'indexedDB',{get(){throw Error('CPU006_INDEXEDDB_FORBIDDEN');}});\n`),routes.get(authorityPath)]));
const manifest=JSON.parse(await readFile(join(runtime,'manifest.json')));
const runtimePrefix='/experiments/phase-engine/runtime/a86578b23adcd26c/';
for(const path of ['manifest.json','engine_wasm.js','card-rules.bin',...manifest.chunks.map(c=>c.path)]){
 const bytes=await readFile(join(runtime,path));routes.set(runtimePrefix+path,bytes);sources[runtimePrefix.slice(1)+path]=sha(bytes);
}

const html=`<!doctype html><meta charset="utf-8"><title>CPU-006 practice worker acceptance</title><main id="setup"></main><script type="module">
import {playMenuMarkup} from './play-menu.js';
import {reviewPracticeSetup} from './experiments/phase-engine/practice-preflight.mjs';
import {createPracticeFlow} from './experiments/phase-engine/practice-flow.mjs';
const names=['Llanowar Elves','Bear Cub','Ordinary Bear','Ghalta, Primal Hunger','Lashwhip Predator','Tarmogoyf','Tapestry Warden','Virulent Emissary','Scarecrow Guide'];
const deck={id:'cpu006-starter',name:'CPU-006 exact starter',format:'Standard',cards:[{name:'Forest',qty:24},...names.map(name=>({name,qty:4}))],side:[]};
const setup={profile:{signedIn:true,ownerId:'cpu006-fixture',locked:false},match:{format:'Standard',mode:'cpu',difficulty:'Medium'},selected:deck,opponent:structuredClone(deck)};
document.getElementById('setup').innerHTML=playMenuMarkup(setup,{matchReleaseReady:true});
document.getElementById('playDifficulty').addEventListener('change',event=>{setup.match.difficulty=event.target.value;});
const seenRevisions=new Set();window.revisions=[];window.progress=[];
const flow=createPracticeFlow({readAccount:()=>({user:{id:'cpu006-fixture'},accountGeneration:1}),readSetup:()=>setup,sessionOnly:true,onProgress:p=>window.progress.push(p),onChange:s=>{const r=s.game?.status?.revision;if(Number.isInteger(r)&&!seenRevisions.has(r)){seenRevisions.add(r);window.revisions.push(r);}}});
window.flow=flow;
window.start=async first=>{if(!reviewPracticeSetup(setup).canLoad)throw Error('PREFLIGHT_REJECTED');return flow.start({seed:12345,first});};
window.getSetup=()=>structuredClone(setup);
window.advance=async()=>{
 const state=flow.snapshot(),session=flow.getSession(),game=state.game,status=game?.status,v=status?.surface;
 if(game?.error)throw Error('SESSION_ERROR '+game.error);if(status?.terminal)return {terminal:status.terminal};
 if(!v||game.busy)throw Error('HUMAN_DRIVER_NOT_READY');
 const opps=v.interaction?.opportunities||[],kind=v.decision.kind;
 const result={before:status.revision,kind,turn:v.turn};
 const land=v.choices.find(c=>c.kind==='PlayLand');
 const cast=opps.flatMap(o=>o.choices).find(c=>c.available&&c.surfaces.some(s=>s.type==='action'&&s.code==='castSpell')&&c.surfaces.some(s=>s.type==='object'&&v.cards.some(card=>card.zone==='Hand'&&card.controller===0&&String(card.id)===s.reference)));
 if(kind==='MulliganDecision'&&v.choices.some(c=>c.label==='Keep hand')){result.method='keep';await session.choose(v.choices.find(c=>c.label==='Keep hand').token);}
 else if(opps.some(o=>o.type==='assignDamage')){
  const o=opps.find(o=>o.type==='assignDamage');let remaining=o.total;
  const choices=o.choices.filter(c=>c.available),amounts=choices.map(c=>{const ref=c.surfaces.find(s=>s.type==='object')?.reference,card=v.cards.find(card=>String(card.id)===ref);if(!card)return 0;const amount=Math.min(remaining,Math.max(0,card.toughness-card.damage));remaining-=amount;return amount;});
  const player=choices.findIndex(c=>c.surfaces.some(s=>s.type==='player'));if(player>=0)amounts[player]+=remaining;else if(amounts.length)amounts[amounts.length-1]+=remaining;
  session.setDamage(o.interactionId,'normal',choices.map((c,i)=>({choiceId:c.id,amount:amounts[i]})));result.method='assign-damage';await session.confirm();
 }
 else if(opps.some(o=>o.type==='relations')){
  const o=opps.find(o=>o.type==='relations'),relations=[];
  if(kind==='DeclareAttackers')for(const edge of o.edges){const targetId=edge.targetIds.find(id=>o.choices.some(c=>c.id===id&&c.available&&c.surfaces.some(s=>s.type==='player'&&s.seat===1)));if(targetId)relations.push({sourceId:edge.sourceId,targetId,group:null});}
  session.setRelations(o.interactionId,relations);result.method=kind==='DeclareAttackers'?'attack-all':'no-block';result.selected=relations.length;await session.confirm();
 }
 else if(land){result.method='land';await session.choose(land.token);}
 else if(cast){const ref=cast.surfaces.find(s=>s.type==='object'&&v.cards.some(card=>card.zone==='Hand'&&card.controller===0&&String(card.id)===s.reference)).reference;result.method='cast';result.card=v.cards.find(c=>String(c.id)===ref).name;await session.cast(Number(ref));}
 else if(v.choices.some(c=>c.kind==='PassPriority')){result.method='pass';await session.choose(v.choices.find(c=>c.kind==='PassPriority').token);}
 else{
  const o=opps.find(o=>['choose','select','sequence'].includes(o.type));if(!o)throw Error('NO_HUMAN_FIXTURE_DRIVER '+kind);
  if(o.min===0)session.selectNone(o.interactionId);else for(const c of o.choices.filter(c=>c.available).slice(0,o.min))session.select(o.interactionId,c.id);
  result.method='mandatory-selection';result.opportunityType=o.type;await session.confirm();
 }
 const next=flow.snapshot();if(next.game?.error)throw Error('SESSION_ERROR '+next.game.error);result.after=next.game.status.revision;return result;
};
window.loaded=true;
</script>`;
routes.set('/',Buffer.from(html));
const missing=[];
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname,body=routes.get(path);if(!body&&path!=='/favicon.ico')missing.push(path);
 res.writeHead(body?200:404,{'Content-Type':path==='/'?'text/html':/\.(mjs|js)$/.test(path)?'text/javascript':path.endsWith('.json')?'application/json':'application/octet-stream'});res.end(body);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href:'playwright');
const report={task:'CPU-006',sources,harnessSha256:sha(await readFile(new URL(import.meta.url))),games:[],limits:[
 'Actual Chromium production practice/client/session/authority and nested CPU worker; fixture account and scripted human session API, not real sign-in or full application navigation.',
 'CPU-005 adapters are applied in an isolated candidate. No live release, broad-deck support or difficulty-strength ordering is proved.',
 'Only console telemetry is appended to policy worker; IndexedDB access is forbidden in authority. No decision, legal list, coverage or runtime substitution.',
 'No recovery. No artificial thinking delay. Browser timings include loaded-host effects and are not an SLA.'
],instrumentation:{policyTelemetrySha256:sha(routes.get(policyPath)),authorityGuardSha256:sha(routes.get(authorityPath))}};
const plan=['Easy','Medium','Hard'].flatMap(difficulty=>[0,1].map(first=>({difficulty,first,seed:12345})));
const index=process.env.CPU006_GAME_INDEX===undefined?null:Number(process.env.CPU006_GAME_INDEX);
const quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*q))]??0;
try{
 for(const spec of plan.filter((_,i)=>index===null||i===index)){
  const browser=await chromium.launch({headless:true,executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const game={...spec,status:'RUNNING',commands:[],workerDecisions:[],errors:[],browser:browser.version()};report.games.push(game);
  try{
   const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(30000);
   page.on('console',m=>{if(m.text().startsWith('CPU006_POLICY '))game.workerDecisions.push(JSON.parse(m.text().slice(14)));});
   page.on('pageerror',e=>game.errors.push(e.message));
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.loaded);
   const options=await page.locator('#playDifficulty option').evaluateAll(rows=>rows.map(o=>({value:o.value,disabled:o.disabled,label:o.textContent})));
   assert.deepEqual(options.map(o=>o.value),['Easy','Medium','Hard']);assert(options.every(o=>!o.disabled));assert(options.find(o=>o.value==='Hard').label.includes('Experimental'));
   await page.locator('#playDifficulty').selectOption(spec.difficulty);const setup=await page.evaluate(()=>getSetup());assert.equal(setup.match.difficulty,spec.difficulty);game.deckSha256=sha(JSON.stringify(setup.selected));
   console.log('START '+JSON.stringify(spec));await page.evaluate(first=>window.start(first),spec.first);
   let state=await page.evaluate(()=>flow.snapshot());assert.equal(state.phase,'playing');assert.equal(state.binding.difficulty,spec.difficulty);assert.equal(state.binding.cpuAvailable,true);assert.equal(state.binding.admission.admitted,true);assert.equal(state.binding.sessionOnly,true);game.binding=state.binding;
   while(!state.game.status.terminal){
    assert(game.commands.length<1200,'HUMAN_COMMAND_LIMIT');assert(!state.game.error,JSON.stringify(state.game.error));
    const command=await page.evaluate(()=>window.advance());assert(command.after>command.before,'COMMAND_DID_NOT_ADVANCE');game.commands.push(command);
    if(game.commands.length%40===0)console.log('PROGRESS '+JSON.stringify({...spec,humanCommands:game.commands.length,revision:command.after}));
    state=await page.evaluate(()=>flow.snapshot());
   }
   game.terminal={...state.game.status.terminal,revision:state.game.status.revision,turn:state.game.status.surface.turn,cpuCommands:state.game.cpuCommands,humanCommands:game.commands.length};
   const revisions=await page.evaluate(()=>window.revisions);assert.deepEqual(revisions,Array.from({length:game.terminal.revision+1},(_,i)=>i));
   assert.equal(game.terminal.revision,game.terminal.cpuCommands+game.terminal.humanCommands);
   assert(game.commands.some(c=>c.method==='cast'));assert(game.workerDecisions.length>0);assert(game.workerDecisions.every(d=>d.difficulty===spec.difficulty));assert.equal(game.workerDecisions.length,game.terminal.cpuCommands);
   assert.deepEqual(game.errors,[]);assert.deepEqual(missing,[]);assert.equal(state.phase,'finished');
   game.policyLatencyMs={p50:quantile(game.workerDecisions.map(d=>d.elapsedMs),.5),p95:quantile(game.workerDecisions.map(d=>d.elapsedMs),.95),max:Math.max(...game.workerDecisions.map(d=>d.elapsedMs))};
   game.decisionKinds=Object.fromEntries([...new Set(game.workerDecisions.map(d=>d.decision))].map(k=>[k,game.workerDecisions.filter(d=>d.decision===k).length]));
   game.status='COMPLETE';console.log('COMPLETE '+JSON.stringify({...spec,...game.terminal,policyP95:game.policyLatencyMs.p95}));await page.evaluate(()=>flow.detach());
  }catch(error){game.status='FAIL';game.error=String(error.stack||error);throw error;}
  finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 report.counts={complete:report.games.filter(g=>g.status==='COMPLETE').length,failed:report.games.filter(g=>g.status==='FAIL').length,acceptedDecisions:report.games.reduce((sum,g)=>sum+(g.terminal?.revision||0),0)};
}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await new Promise(done=>server.close(done));}
console.log(JSON.stringify(report.counts));
