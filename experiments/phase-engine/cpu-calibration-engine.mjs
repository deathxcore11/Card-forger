import assert from 'node:assert/strict';import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';import {e,sha} from './cpu-test-runtime.mjs';
import {makeCpuObservation} from './cpu-public-observation.mjs';import {analyzeCpu} from './cpu-public-policy.mjs';
import {cpuLegalCandidates} from './cpu-legal-candidates.mjs';import {createCpuPlaybook} from './cpu-playbook.mjs';
import {CPU_PROFILES,CPU_CONFIGURATION_VERSION} from './cpu-difficulty-config.mjs';
const all=['Llanowar Elves','Bear Cub','Ordinary Bear','Ghalta, Primal Hunger','Lashwhip Predator','Tarmogoyf','Tapestry Warden','Virulent Emissary','Scarecrow Guide'];
const list=names=>[...Array(60-4*names.length).fill('Forest'),...names.flatMap(n=>Array(4).fill(n))];
const decks={starter:list(all),small:list(all.filter(n=>!['Ghalta, Primal Hunger','Lashwhip Predator'].includes(n))),large:list(all.filter(n=>n!=='Scarecrow Guide'))};
const plan=[];for(const pair of [['Easy','Medium'],['Medium','Hard'],['Easy','Hard']])for(const seed of [12345,98765])for(const swapped of [false,true])plan.push({deck:'starter',seed,levels:swapped?[...pair].reverse():pair,swapped});
for(const deck of ['small','large'])for(const swapped of [false,true])plan.push({deck,seed:31415,levels:swapped?['Hard','Medium']:['Medium','Hard'],swapped});
const report={task:'CPU-003',configuration:CPU_CONFIGURATION_VERSION,profiles:CPU_PROFILES,games:[],limits:['Small deterministic samples; no statistical proof of difficulty ordering.','Identical decks within each game; paired seeds swap policy seats, first player stays seat 0.','Direct policy calls with real engine validation; worker separately exercised by tactical tests.','Latency is this Node host, not signed-in browser/mobile performance.','No reload recovery or owner account test.']};
const [offset=0,shard=0,shards=1]=process.argv.slice(2).map(Number);
assert([offset,shard,shards].every(Number.isInteger)&&offset>=0&&offset<plan.length&&shard>=0&&shards>=1&&shard<shards,'Optional args: offset shard shards');
report.execution={offset,shard,shards};const output='test-results/cpu-calibration'+(shards>1?'/shard-'+shard:'');
const format=e.getFormatRegistry().find(f=>f.format==='Standard').default_config;
const quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*q))]??0;
for(const spec of plan.filter((_,i)=>i>=offset&&(i-offset)%shards===shard)){
 const rows=decks[spec.deck],ownDeck={main_deck:rows,sideboard:[],commander:[]},playbook=createCpuPlaybook(ownDeck);assert.equal(rows.length,60);
 const r={...spec,deckSha256:sha(JSON.stringify(rows)),decisions:0,policyLatencyMs:[],enumerationLatencyMs:[],nodes:0,budgetExhaustions:0,expandedBlocks:0,trace:[],decisionKinds:{}};
 try{
  const gate=e.evaluateDeckFormatGate({...ownDeck,selected_format:'Standard',player_count:2});assert(gate.compatible,JSON.stringify(gate));
  const init=e.initialize_game({player:ownDeck,opponent:ownDeck},spec.seed,format,null,2,0);assert(Array.isArray(init.events));let rng=[777,777];
  for(;r.decisions<1800;r.decisions++){
   const state=e.get_game_state().state;if(state.waiting_for.type==='GameOver'){r.winner=state.waiting_for.data.winner;r.turn=state.turn_number;r.status='COMPLETE';break;}
   const start=performance.now();let offered=null;
   for(const actor of [0,1]){const legal=e.get_legal_actions_for_viewer_js(actor);if(legal.actions.length){offered={actor,legal,...cpuLegalCandidates(e,actor,legal.actions)};break;}}
   assert(offered,'NO_LEGAL_CANDIDATE');r.enumerationLatencyMs.push(performance.now()-start);r.expandedBlocks+=offered.added;
   const {actor,actions,legal}=offered,packet=makeCpuObservation(e.get_filtered_game_state(actor),actor,actions,{difficulty:spec.levels[actor],legal,playbook});
   const before=performance.now(),chosen=analyzeCpu(packet,rng[actor]);r.policyLatencyMs.push(performance.now()-before);r.nodes+=chosen.metrics.nodes;r.budgetExhaustions+=Number(chosen.metrics.budgetExhausted);rng[actor]=chosen.rng;
   assert(actions[chosen.index],'PROPOSAL_OUT_OF_RANGE');const action=actions[chosen.index],result=e.submit_action(actor,action);assert.equal(result.status,'applied','ENGINE_REJECTED');
   r.decisionKinds[state.waiting_for.type]=(r.decisionKinds[state.waiting_for.type]||0)+1;r.trace.push({actor,action});
  }
  if(!r.status){r.status='LIMIT';r.turn=e.get_game_state().state.turn_number;}
 }catch(error){r.status='ERROR';r.error=String(error.stack||error);r.waiting=e.get_game_state().state.waiting_for;}
 r.traceSha256=sha(JSON.stringify(r.trace));r.tail=r.trace.slice(-8);delete r.trace;
 r.policyLatencyMs={p50:quantile(r.policyLatencyMs,.5),p95:quantile(r.policyLatencyMs,.95),max:Math.max(0,...r.policyLatencyMs)};
 r.enumerationLatencyMs={p50:quantile(r.enumerationLatencyMs,.5),p95:quantile(r.enumerationLatencyMs,.95),max:Math.max(0,...r.enumerationLatencyMs)};
 report.games.push(r);console.log(JSON.stringify({deck:r.deck,seed:r.seed,levels:r.levels,status:r.status,winner:r.winner,turn:r.turn,decisions:r.decisions,policyP95:r.policyLatencyMs.p95}));
 await mkdir(output,{recursive:true});await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');
}
report.counts={complete:report.games.filter(g=>g.status==='COMPLETE').length,errors:report.games.filter(g=>g.status==='ERROR').length,limits:report.games.filter(g=>g.status==='LIMIT').length};
report.sources=Object.fromEntries(await Promise.all(['cpu-public-observation.mjs','cpu-combat-evaluation.mjs','cpu-public-policy.mjs','cpu-difficulty-config.mjs','cpu-playbook.mjs','cpu-hand-observation.mjs','cpu-tactical-planning.mjs','cpu-legal-candidates.mjs','cpu-calibration-engine.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(report.counts);if(report.counts.errors||report.counts.limits)process.exitCode=1;
