// Delivered-WASM proof of the conservative capability boundary, not auto-pass
// completeness. Engineered positions are separate from a full browser match.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {e,sha} from './cpu-test-runtime.mjs';
import {deck,tracker,state} from './mechanics-fixtures.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {createJournal} from './worker-journal.mjs';
import {createPriorityFlow} from './priority-flow.mjs';
const report={task:'SESSION-001 conservative authority gate',runtime:'a86578b23adcd26c',cases:[],limits:'Real engine/journal, small Vintage fixture, not complete action coverage, UI, Commander or recovery proof.'};
for(const first of [0,1]){
 let durable=null;
 const authority=createMatchAuthority({engine:e,epoch:`flow-${first}`,mode:'human-timed',decks:{player:{main_deck:deck('Forest','Bear Cub')},opponent:{main_deck:deck('Forest','Bear Cub')}},format:e.getFormatRegistry().find(f=>f.format==='Vintage').default_config,policyWorker:{terminate(){}},onStart(){
  const t=tracker(e);for(let n=0;n<8&&state(e).waiting_for.type==='MulliganDecision';n++)t.take('MulliganDecision',a=>a.data.choice?.type==='Keep');
 }});
 try{
  const journal=createJournal({engine:authority.adapter,choose:authority.choose,epoch:`flow-${first}`,version:'flow-fixture',storage:{read:async()=>durable,write:async v=>{durable=structuredClone(v);}}});
  const send=(op,id,fields={})=>journal({v:1,epoch:`flow-${first}`,op,id,...fields});
  const initial=await send('create','open',{seed:12345,first});assert(initial.ok,JSON.stringify(initial));
  const c=initial.result.priorityCapability;assert.equal(c.coverage,'unknown');assert.equal(c.passAvailable,false);assert.equal(c.activeSeat,first);assert.equal(c.revision,0);
  const before=e.export_game_state_json(),saved=JSON.stringify(durable);
  const rejected=await send('autoPass','auto',{revision:0,decisionId:c.decisionId});assert.equal(rejected.error,'AUTO_PASS_UNAVAILABLE');assert.equal(e.export_game_state_json(),before);assert.equal(JSON.stringify(durable),saved);
  const flow=createPriorityFlow({read:()=>({status:initial.result}),dispatch:async()=>{throw Error('UNEXPECTED_AUTOMATION');}});const turnFlow=flow.snapshot();flow.close();
  report.cases.push({first,status:'PASS',capability:c,turnFlow,stateSha256:sha(before),automaticPass:rejected.error,acceptedRevision:durable.revision});
 }finally{authority.close();}
}
report.sources=Object.fromEntries(await Promise.all(['priority-flow.mjs','match-session.mjs','match-authority.mjs','worker-journal.mjs','practice-client.mjs','priority-flow-engine.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
await mkdir('test-results/priority-flow',{recursive:true});await writeFile('test-results/priority-flow/engine.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
