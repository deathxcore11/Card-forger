// Replay the exact 100 accepted commands from the DECK-003 failure. No state edits.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {bootAcceptance,digest} from './acceptance-inputs.mjs';
import {engineDeckFromSnapshot} from './match-input.mjs';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {chooseCpu} from './cpu-public-policy.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {nodePolicyWorker} from './cpu-node-worker.mjs';
const read=async name=>JSON.parse(await readFile(new URL(name,import.meta.url)));
const replay=await read('./fixtures/deck-003/surrak-replay.json'),definition=await read('./fixtures/deck-001/tramplesaurus-rex.json'),data=await read('./fixtures/deck-003/tramplesaurus-additions.corrected.json');
assert.equal(digest(JSON.stringify(replay.trace)),replay.traceSha256);
const {engine:e,catalog,provenance}=await bootAcceptance(['Forest']);
const cards=Object.fromEntries(definition.cards.map(c=>[c.name.toLowerCase(),catalog[c.name.toLowerCase()]||data[c.name.toLowerCase()]]));assert.equal(e.load_card_database(JSON.stringify(cards)),69);
const list=engineDeckFromSnapshot(definition,'Commander'),format=e.getFormatRegistry().find(f=>f.format==='Commander').default_config;
assert(Array.isArray(e.initialize_game({player:list,opponent:list},replay.seed,format,null,2,0).events));
for(const {actor,action}of replay.trace)assert.equal(e.submit_action(actor,action).status,'applied');
const state=()=>e.get_game_state().state;
assert.equal(state().waiting_for.type,replay.expectedDecision);
const actor=state().waiting_for.data.player,actions=e.get_legal_actions_for_viewer_js(actor).actions,save=e.export_game_state_json();
const report={task:'CPU-TARGET-001',provenance,seed:replay.seed,replayedAcceptedCommands:replay.trace.length,cases:[],sources:{},limits:['This natural-history replay and worker test establishes the Surrak target choice and resolution, not arbitrary card mechanics or a browser match.','Other target intents use bounded public heuristics; neutral effects use stable legal-offer order.']};
for(const difficulty of ['Easy','Medium','Hard']){
 e.restore_game_state(save);
 const packet=makeCpuObservation(e.get_filtered_game_state(actor),actor,actions,{difficulty}),chosen=chooseCpu(packet,777);
 assert.equal(packet.targets.intent,'haste');assert.equal(actions[chosen.index].data.target.Object,135);
 const authority=createMatchAuthority({engine:e,epoch:'target-'+difficulty,mode:'cpu-test',difficulty,policyWorker:nodePolicyWorker()});
 try{
  const worker=await authority.choose(actions,777,{actor,revision:100});assert.equal(worker.index,chosen.index);
  assert.equal(e.submit_action(actor,actions[worker.index]).status,'applied');
  let accepted=1;
  for(let n=0;n<8&&state().stack.length;n++){
   assert.equal(state().waiting_for.type,'Priority');const seat=state().waiting_for.data.player;
   const pass=e.get_legal_actions_for_viewer_js(seat).actions.find(a=>a.type==='PassPriority');assert(pass);assert.equal(e.submit_action(seat,pass).status,'applied');accepted++;
  }
  assert.equal(state().stack.length,0);assert(e.get_filtered_game_state(actor).state.objects[135].keywords.includes('Haste'));
  report.cases.push({difficulty,status:'PASS',workerIndex:worker.index,selectedActualObject:135,acceptedAfterReplay:accepted,actualHaste:true});
 }finally{authority.close();}
}
const orderReplay=await read('./fixtures/deck-003/trigger-order-replay.json');
assert.equal(digest(JSON.stringify(orderReplay.trace)),orderReplay.traceSha256);
assert(Array.isArray(e.initialize_game({player:list,opponent:list},orderReplay.seed,format,null,2,0).events));
for(const {actor,action}of orderReplay.trace)assert.equal(e.submit_action(actor,action).status,'applied');
assert.equal(state().waiting_for.type,'OrderTriggers');
const orderActor=state().waiting_for.data.player,orderActions=e.get_legal_actions_for_viewer_js(orderActor).actions,orderSave=e.export_game_state_json();
for(const difficulty of ['Easy','Medium','Hard']){
 e.restore_game_state(orderSave);
 const authority=createMatchAuthority({engine:e,epoch:'order-'+difficulty,mode:'cpu-test',difficulty,policyWorker:nodePolicyWorker()});
 try{
  const worker=await authority.choose(orderActions,777,{actor:orderActor,revision:144});
  assert.equal(orderActions[worker.index].type,'OrderTriggers');assert.equal(e.submit_action(orderActor,orderActions[worker.index]).status,'applied');
  assert.notEqual(state().waiting_for.type,'OrderTriggers');
  report.cases.push({difficulty,decision:'OrderTriggers',status:'PASS',replayedAcceptedCommands:orderReplay.trace.length,workerIndex:worker.index,acceptedAfterReplay:1,nextDecision:state().waiting_for.type});
 }finally{authority.close();}
}
for(const name of ['cpu-public-observation.mjs','cpu-public-policy.mjs','cpu-target-engine.mjs','cpu-public-worker.mjs','match-authority.mjs'])report.sources[name]=digest(await readFile(new URL(name,import.meta.url)));
await mkdir('test-results/cpu-target-worker',{recursive:true});await writeFile('test-results/cpu-target-worker/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.cases));
