// CPU-003-LATENCY-A: diagnostics only. No production policy/runtime changes.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {e,sha} from './cpu-test-runtime.mjs';
import {prepare,deck,state,tracker} from './mechanics-fixtures.mjs';
import {cpuLegalCandidates} from './cpu-legal-candidates.mjs';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {analyzeCpu} from './cpu-public-policy.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {nodePolicyWorker} from './cpu-node-worker.mjs';
const specs=[
 {id:'ghalta-survival',attackers:1,blockers:1,card:'Ghalta, Primal Hunger',life:12},
 {id:'four-by-four',attackers:4,blockers:4,card:'Bear Cub',life:20},
 {id:'three-by-eight',attackers:3,blockers:8,card:'Bear Cub',life:20},
 {id:'four-by-twelve',attackers:4,blockers:12,card:'Bear Cub',life:20},
 {id:'four-by-twenty',attackers:4,blockers:20,card:'Bear Cub',life:20}
];
const report={task:'CPU-003-LATENCY-A',base:'142e21de8071a38a52fd5d6444ed47c33a2d05c7',runtime:'a86578b23adcd26c',host:{node:process.version,platform:process.platform,arch:process.arch},cases:[],limits:[
 'Engineered creature positions, not token equivalence tests or complete matches.',
 'Three stage samples and one warmed production-authority decision per case; no population latency guarantee.',
 'Single Node process; excludes browser rendering, actual match worker transport, storage, timers and full journal overhead.',
 'Full authority sample includes initial legal collection, production policy-worker choice, fresh legal revalidation and accepted submit; no stage caches.',
 'Total authority wall time includes fixture assertions/export; individual stages isolate production calls.',
 'No changes to production code. Recovery remains unsupported; signed-in path not tested.'
]};
const timed=fn=>{const at=performance.now(),value=fn();return {ms:performance.now()-at,value};};
function trackedEngine(){
 const calls={};
 const engine=new Proxy(e,{get(target,key){const value=target[key];if(typeof value!=='function')return value;return (...args)=>{const at=performance.now();try{return value(...args);}finally{const row=calls[key]??={count:0,totalMs:0,maxMs:0};const ms=performance.now()-at;row.count++;row.totalMs+=ms;row.maxMs=Math.max(row.maxMs,ms);}};}});
 return {engine,calls};
}
const authorityTraces=trackedEngine(),authority=createMatchAuthority({engine:authorityTraces.engine,epoch:'cpu-latency',mode:'cpu-test',difficulty:'Medium',policyWorker:nodePolicyWorker()});
try{
 for(const spec of specs){
  const row={...spec,samples:[],profiles:[]};report.cases.push(row);
  try{
   const blockPool=spec.card==='Bear Cub'?['Bear Cub','Ordinary Bear','Scarecrow Guide','Virulent Emissary','Llanowar Elves']:[spec.card];
   const blockCards=Array.from({length:spec.blockers},(_,i)=>blockPool[Math.floor(i/4)]);row.blockCards=blockCards;
   const f=prepare(e,deck('Forest',...Array(spec.attackers).fill(spec.card)),deck('Forest',...blockCards));
   f.move(spec.card,0,'Battlefield',spec.attackers);for(const name of new Set(blockCards))f.move(name,1,'Battlefield',blockCards.filter(n=>n===name).length);f.s.players[1].life=spec.life;row.setupSha256=f.restore();
   const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');t.take('DeclareAttackers',a=>a.data.attacks.length===spec.attackers);t.passUntil(s=>s.waiting_for.type==='DeclareBlockers');
   const save=e.export_game_state_json();row.decisionSha256=sha(save);let packet,actions;
   for(let repeat=0;repeat<3;repeat++){
    const probe=trackedEngine(),none=timed(()=>probe.engine.get_legal_actions_for_viewer_js(0)),legal=timed(()=>probe.engine.get_legal_actions_for_viewer_js(1));assert.equal(none.value.actions.length,0);
    const filtered=timed(()=>probe.engine.get_filtered_game_state(1)),expanded=timed(()=>cpuLegalCandidates(probe.engine,1,legal.value.actions));actions=expanded.value.actions;
    const observation=timed(()=>makeCpuObservation(filtered.value,1,actions,{difficulty:'Medium',legal:legal.value}));packet=observation.value;
    row.samples.push({repeat,inactiveLegalMs:none.ms,activeLegalMs:legal.ms,filteredStateMs:filtered.ms,expandedCandidatesMs:expanded.ms,observationMs:observation.ms,baseCandidates:legal.value.actions.length,candidates:actions.length,added:expanded.value.added,examined:expanded.value.examined,truncated:expanded.value.truncated,engineCalls:probe.calls});
    assert.equal(e.export_game_state_json(),save,'profiling must not mutate state');
   }
   for(const difficulty of ['Easy','Medium','Hard']){
    const profilePacket={...packet,difficulty},samples=[];
    for(let repeat=0;repeat<3;repeat++){const result=timed(()=>analyzeCpu(profilePacket,777));assert(actions[result.value.index]);samples.push({ms:result.ms,...result.value});}
    row.profiles.push({difficulty,samples});
   }
   // Warm worker/import separately; production choose includes fresh costs/view.
   if(report.cases.length===1){const at=performance.now();await authority.choose(actions,777,{actor:1,revision:0});report.workerColdChooseMs=performance.now()-at;}
   for(const key of Object.keys(authorityTraces.calls))delete authorityTraces.calls[key];
   const started=performance.now(),offered=timed(()=>authority.adapter.legal());assert.equal(offered.value.actor,1);
   const chooseStart=performance.now(),proposal=await authority.choose(offered.value.actions,777,{actor:1,revision:0}),chooseMs=performance.now()-chooseStart;
   const fresh=timed(()=>authority.adapter.legal()),action=offered.value.actions[proposal.index];assert(action);assert.equal(fresh.value.actor,1);assert(fresh.value.actions.some(a=>JSON.stringify(a)===JSON.stringify(action)));
   assert.equal(e.export_game_state_json(),save,'choice/revalidation must not mutate state');
   const applied=timed(()=>authority.adapter.apply(1,action));
   row.authority={totalMs:performance.now()-started,initialLegalMs:offered.ms,chooseMs,freshLegalMs:fresh.ms,applyMs:applied.ms,engineCalls:structuredClone(authorityTraces.calls),action,accepted:true};
   row.status='PASS';
  }catch(error){row.status='FAIL';row.error=String(error.stack||error).slice(0,1800);}
  await mkdir('test-results/cpu-latency',{recursive:true});await writeFile('test-results/cpu-latency/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({id:row.id,status:row.status,samples:row.samples.map(s=>({legal:s.activeLegalMs,expand:s.expandedCandidatesMs,preview:s.engineCalls.preview_action_js,base:s.baseCandidates,added:s.added,truncated:s.truncated})),authority:row.authority,error:row.error}));
 }
}finally{authority.close();}
report.counts={PASS:report.cases.filter(c=>c.status==='PASS').length,FAIL:report.cases.filter(c=>c.status==='FAIL').length};
report.sources=Object.fromEntries(await Promise.all(['cpu-latency-engine.mjs','cpu-legal-candidates.mjs','cpu-public-observation.mjs','cpu-hand-observation.mjs','cpu-combat-evaluation.mjs','cpu-public-policy.mjs','cpu-tactical-planning.mjs','cpu-difficulty-config.mjs','match-authority.mjs','cpu-public-worker.mjs','cpu-node-worker.mjs','cpu-test-runtime.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
await writeFile('test-results/cpu-latency/report.json',JSON.stringify(report,null,2)+'\n');console.log(report.counts);if(report.counts.FAIL)process.exitCode=1;
