// DECK-003: a bounded exact-deck trial through the unchanged CPU-005 policy.
// Direct policy calls, not a browser/worker/session or a coverage admission.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {bootAcceptance,digest} from './acceptance-inputs.mjs';
import {engineDeckFromSnapshot} from './match-input.mjs';
const [modulePath,seedText='7331',level0='Medium',level1='Medium']=process.argv.slice(2),seed=Number(seedText);
assert(modulePath&&Number.isSafeInteger(seed),'Usage: node experiments/phase-engine/deck-data-cpu.mjs /CPU005/experiments/phase-engine [seed] [level0] [level1]');assert([level0,level1].every(l=>['Easy','Medium','Hard'].includes(l)));
const root=resolve(modulePath),cpuReceipt=JSON.parse(await readFile(new URL('./fixtures/deck-003/cpu-005-source-receipt.json',import.meta.url)));
assert.equal(cpuReceipt.commit,'97fc5705ccea76a51a9132ffcac189b2f1747878');
for(const [name,r]of Object.entries(cpuReceipt.files))assert.equal(digest(await readFile(resolve(root,name))),r.sha256,'Exact CPU module required: '+name);
const [{makeCpuObservation},{analyzeCpu},{cpuLegalCandidates},{createCpuPlaybook},{CPU_CONFIGURATION_VERSION}]=await Promise.all(['cpu-public-observation.mjs','cpu-public-policy.mjs','cpu-legal-candidates.mjs','cpu-playbook.mjs','cpu-difficulty-config.mjs'].map(n=>import(pathToFileURL(resolve(root,n)))));
const receipt=JSON.parse(await readFile(new URL('./fixtures/deck-003/source-receipt.json',import.meta.url))),additionBytes=await readFile(new URL('./fixtures/deck-003/'+receipt.correctedCandidateFile,import.meta.url));assert.equal(digest(additionBytes),receipt.correctedCandidateSha256);const additions=JSON.parse(additionBytes);
const deckBytes=await readFile(new URL('./fixtures/deck-001/tramplesaurus-rex.json',import.meta.url));assert.equal(digest(deckBytes),receipt.exactDeckFixtureSha256);const definition=JSON.parse(deckBytes),list=engineDeckFromSnapshot(definition,'Commander');
const {engine:e,catalog,provenance}=await bootAcceptance(['Forest']);for(const key of Object.keys(additions))assert(!Object.hasOwn(catalog,key));
const cards=Object.fromEntries(definition.cards.map(c=>[c.name.toLowerCase(),catalog[c.name.toLowerCase()]||additions[c.name.toLowerCase()]]));assert.equal(e.load_card_database(JSON.stringify(cards)),69);
const format=e.getFormatRegistry().find(f=>f.format==='Commander').default_config;assert.equal(e.evaluateDeckFormatGate({...list,selected_format:'Commander',player_count:2}).compatible,true);
const output=resolve(process.env.CARDSTASHY_DECK_CPU_OUTPUT||'test-results/deck-003-cpu-'+seed);await mkdir(output,{recursive:true});
const report={schema:1,task:'DECK-003',status:'RUNNING',seed,levels:[level0,level1],format:'Commander',exactDeckFixtureSha256:receipt.exactDeckFixtureSha256,effectiveCandidateSha256:receipt.correctedCandidateSha256,combinedDeckDataSha256:digest(JSON.stringify(cards)),cpuCommit:cpuReceipt.commit,cpuConfiguration:CPU_CONFIGURATION_VERSION,cpuSources:cpuReceipt.files,provenance,startedAt:new Date().toISOString(),decisions:0,decisionKinds:{},trace:[],maxEngineCollectionMs:0,maxPolicyMs:0,limits:['One bounded direct-policy trial with the exact list in both seats; not all mechanics or difficulty strength certification.','Policy receives only makeCpuObservation from the acting seat-filtered envelope, its legal offers and own deck playbook.','Harness records full synthetic states for debugging; they are not passed to policy.','No coverage bypass in production, worker/session integration, browser, recovery or deployment.']};
const checkpoint=()=>writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const init=e.initialize_game({player:list,opponent:list},seed,format,null,2,0);assert(Array.isArray(init.events));const start=e.export_game_state_json();await writeFile(resolve(output,'starting-state.json'),start+'\n');report.startingStateSha256=digest(start);await checkpoint();
const playbook=createCpuPlaybook(list),rng=[777,777],startTime=performance.now();
let lastOffered,lastObservation;
try{
 for(;report.decisions<1800;report.decisions++){
  const s=e.get_game_state().state;report.turn=s.turn_number;report.lastDecision=s.waiting_for.type;
  if(s.waiting_for.type==='GameOver'){report.status='PASS';report.outcome=s.waiting_for;break;}
  if(performance.now()-startTime>240000){report.status='NOT TESTED';report.stopReason='240-second harness budget; not a game loss or engine timeout';break;}
  const before=performance.now();let offered;
  for(const actor of [0,1]){const legal=e.get_legal_actions_for_viewer_js(actor);if(legal.actions.length){offered={actor,legal,...cpuLegalCandidates(e,actor,legal.actions)};break;}}
  report.maxEngineCollectionMs=Math.max(report.maxEngineCollectionMs,performance.now()-before);assert(offered,'NO_LEGAL_CANDIDATE');
  const {actor,legal,actions}=offered,observation=makeCpuObservation(e.get_filtered_game_state(actor),actor,actions,{difficulty:report.levels[actor],legal,playbook});lastOffered=offered;lastObservation=observation;const policyStart=performance.now(),chosen=analyzeCpu(observation,rng[actor]);report.maxPolicyMs=Math.max(report.maxPolicyMs,performance.now()-policyStart);rng[actor]=chosen.rng;assert(actions[chosen.index],'PROPOSAL_OUT_OF_RANGE');
  const action=actions[chosen.index],result=e.submit_action(actor,action);if(result.status!=='applied'){report.failedSubmission={actor,action,result};throw Error('ENGINE_REJECTED');}
  report.decisionKinds[s.waiting_for.type]=(report.decisionKinds[s.waiting_for.type]||0)+1;report.trace.push({actor,decision:s.waiting_for.type,action});
  if(report.decisions%25===0){await checkpoint();console.log(JSON.stringify({decisions:report.trace.length,turn:report.turn,waiting:report.lastDecision}));}
 }
 if(report.status==='RUNNING'){report.status='NOT TESTED';report.stopReason='1800-command harness limit; no match outcome inferred';}
}catch(error){report.status='FAIL';report.error=String(error.stack||error);report.waiting=e.get_game_state().state.waiting_for;report.failureOffers=lastOffered;report.failurePolicyInput=lastObservation;
 if(lastObservation)report.sameDecisionPolicyResults=['Easy','Medium','Hard'].map(difficulty=>{try{return {difficulty,result:analyzeCpu({...lastObservation,difficulty},777)};}catch(error){return {difficulty,error:String(error.message||error)};}});
}
const final=e.export_game_state_json();await writeFile(resolve(output,'final-state.json'),final+'\n');report.finalStateSha256=digest(final);report.acceptedCommands=report.trace.length;report.traceSha256=digest(JSON.stringify(report.trace));report.finishedAt=new Date().toISOString();report.runnerSha256=digest(await readFile(new URL(import.meta.url)));await checkpoint();console.log(JSON.stringify({status:report.status,acceptedCommands:report.acceptedCommands,turn:report.turn,outcome:report.outcome,error:report.error,stopReason:report.stopReason}));if(report.status!=='PASS')process.exitCode=1;
