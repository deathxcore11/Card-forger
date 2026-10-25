// Actual original WASM + new isolated timed journal. Not a ninjutsu fix.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {bootMechanics,sha} from './mechanics-inputs.mjs';
import {prepare,deck,state,snapshot} from './mechanics-fixtures.mjs';
import {createTimedPriorityJournal} from './timed-priority-journal.mjs';
const {engine:e,provenance,networkCalls}=await bootMechanics();
const setupSha256=prepare(e,deck('Forest'),deck('Forest')).restore();
let time=1000,saved=null,applies=0;
const adapter={save:()=>snapshot(e),restore:s=>e.restore_game_state(s),context:r=>{
 const w=state(e).waiting_for;return {actor:w.data.player,kind:w.type,decisionId:`choice-${r}`};
},legal:()=>e.get_legal_actions_for_viewer_js(state(e).waiting_for.data.player).actions,
apply:(actor,action)=>{const result=e.submit_action(actor,action);assert(['applied','Applied'].includes(result.status));applies++;}};
const storage={read:async()=>structuredClone(saved),write:async(next,expected)=>{assert.equal(saved?.revision??null,expected);saved=structuredClone(next);}};
const open=()=>createTimedPriorityJournal({engine:adapter,storage,matchId:'timed-engine',version:provenance.buildIdentity,now:()=>time,newId:()=> 'timeout-original'});
const first=open();await first({op:'create'});time=30999;
assert.equal((await first({op:'tick'})).clock.remainingMs,1);assert.equal(applies,0);
const restored=open();time=31000;await restored({op:'resume'});
const accepted=await restored({op:'tick'});assert.equal(accepted.revision,1);assert.equal(accepted.accepted,true);assert.equal(saved.receipts['timeout-original'].revision,1);
assert.equal(state(e).waiting_for.data.player,1);await restored({op:'tick'});assert.equal(applies,1);assert.equal(networkCalls(),0);
assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);
const sourceFiles=Object.fromEntries(await Promise.all(['timed-priority-engine.mjs','timed-priority-journal.mjs','priority-clock.mjs','mechanics-inputs.mjs','mechanics-fixtures.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
const report={provenance,sourceFiles,setupSha256,defaultResponseSeconds:30,retainedDeadlineAt:31000,acceptedPasses:applies,durableRevision:saved.revision,durableReceipt:true,nextActor:1,networkCalls:0,limits:'Original runtime only, engineered position, in-memory compare-and-write store and reconstructed authority in one process. No fresh-process/browser IndexedDB proof, mounted scheduler/countdown, corrected ninjutsu runtime or complete mandatory-choice timeout policy.'};
await writeFile(new URL('./timed-priority-evidence-2026-10-24.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
