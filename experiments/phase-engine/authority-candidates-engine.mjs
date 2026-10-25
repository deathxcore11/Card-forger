// Real-engine regression for integration's revision-scoped candidate reuse.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {e,sha} from './cpu-test-runtime.mjs';
import {prepare,deck,tracker,state} from './mechanics-fixtures.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {createJournal} from './worker-journal.mjs';
import {nodePolicyWorker} from './cpu-node-worker.mjs';

const cases=[
 {id:'ghalta-survival',attack:['Ghalta, Primal Hunger'],block:['Ghalta, Primal Hunger'],life:12},
 {id:'four-by-four',attack:Array(4).fill('Bear Cub'),block:Array(4).fill('Ordinary Bear'),life:8},
 {id:'three-by-eight',attack:Array(3).fill('Bear Cub'),block:[...Array(4).fill('Ordinary Bear'),...Array(4).fill('Bear Cub')],life:6},
 {id:'four-by-twelve',attack:Array(4).fill('Bear Cub'),block:[...Array(4).fill('Ordinary Bear'),...Array(4).fill('Bear Cub'),...Array(4).fill('Air Elemental')],life:8},
 {id:'four-by-twenty',attack:Array(4).fill('Bear Cub'),block:[...Array(4).fill('Ordinary Bear'),...Array(4).fill('Bear Cub'),...Array(4).fill('Air Elemental'),...Array(4).fill('Knight of Dawn'),...Array(4).fill('Darksteel Myr')],life:8}
];
let previews=0;
const engine=new Proxy(e,{get(target,key){const value=Reflect.get(target,key,target);if(key==='preview_action_js')return (...args)=>{previews++;return value.apply(target,args);};return typeof value==='function'?value.bind(target):value;}});
const report={task:'SESSION-001-LATENCY-B',runtime:'a86578b23adcd26c',node:process.version,platform:process.platform,cases:[],limits:'Engine fixtures, not browser or broad search-coverage proof. CPU-002 policy unchanged. More than twelve blockers still skips expansion.'};
for(const c of cases){
 let authority;
 try{
  const setup=()=>{const f=prepare(e,deck('Forest',...c.attack),deck('Forest',...c.block));const ids=c.attack.map(name=>f.move(name,0,'Battlefield')[0]);for(const name of c.block)f.move(name,1,'Battlefield');f.s.players[1].life=c.life;f.restore();const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');t.take('DeclareAttackers',a=>a.data.attacks.length===ids.length&&a.data.attacks.every(([id])=>ids.includes(id)));t.passUntil(s=>s.waiting_for.type==='DeclareBlockers');};
  authority=createMatchAuthority({engine,epoch:c.id,mode:'cpu-test',decks:{player:{main_deck:deck('Forest',...c.attack)},opponent:{main_deck:deck('Forest',...c.block)}},format:e.getFormatRegistry().find(f=>f.format==='Vintage').default_config,onStart:setup,policyWorker:nodePolicyWorker()});
  let durable=null;
  const journal=createJournal({engine:authority.adapter,choose:authority.choose,epoch:c.id,version:'cache-regression',storage:{read:async()=>durable,write:async(s,expected)=>{assert.equal(durable?.revision??null,expected);durable=structuredClone(s);}}});
  const send=(op,id,extra={})=>journal({v:1,epoch:c.id,id,op,...extra});
  const created=await send('create','create',{seed:12345,first:0});assert(created.ok,JSON.stringify(created));
  const before=e.export_game_state_json();previews=0;let t=performance.now();
  const first=authority.adapter.legal(),again=authority.adapter.legal();
  const uncachedMs=performance.now()-t,uncachedPreviews=previews;assert.deepEqual(first,again);assert.equal(e.export_game_state_json(),before);
  const expected=await authority.choose(first.actions,0x63d34a91,{actor:1,revision:0});
  previews=0;t=performance.now();const response=await send('step','decision',{revision:0});const journalMs=performance.now()-t,cachedPreviews=previews;
  assert(response.ok,JSON.stringify(response));assert.equal(response.result.revision,1);
  assert.deepEqual(durable.history[0].action,first.actions[expected.index]);assert.equal(cachedPreviews*2,uncachedPreviews);
  if(c.id==='ghalta-survival'){
   assert.equal(durable.history[0].action.data.assignments.length,1);
   const tr=tracker(e);tr.passUntil(s=>s.phase==='PostCombatMain'||s.waiting_for.type==='GameOver');
   assert.equal(state(e).players[1].life,12);assert.notEqual(state(e).waiting_for.type,'GameOver');
  }
  const after=e.export_game_state_json();assert.deepEqual(await send('step','decision',{revision:0}),response);assert.equal((await send('step','stale',{revision:0})).error,'STALE_REVISION');assert.equal(e.export_game_state_json(),after);
  report.cases.push({id:c.id,status:'PASS',fixture:c,setupSha256:sha(before),uncachedPreviews,cachedPreviews,uncachedTwoCollectionsMs:uncachedMs,cachedJournalStepMs:journalMs,action:durable.history[0].action,acceptedRevision:1});
  console.log('PASS',c.id,{uncachedPreviews,cachedPreviews,uncachedMs,journalMs});
 }catch(error){report.cases.push({id:c.id,status:'FAIL',error:error.stack});console.log('FAIL',c.id,error.stack);}finally{authority?.close();}
}
report.sources=Object.fromEntries(await Promise.all(['match-authority.mjs','worker-journal.mjs','cpu-legal-candidates.mjs','cpu-public-policy.mjs','authority-candidates-engine.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
await mkdir('test-results/authority-candidates',{recursive:true});await writeFile('test-results/authority-candidates/report.json',JSON.stringify(report,null,2)+'\n');
if(report.cases.some(c=>c.status==='FAIL'))process.exitCode=1;
