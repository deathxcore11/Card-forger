// Actual engine check for a restored response deadline. Not UI integration.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bootMechanics,sha} from './mechanics-inputs.mjs';
import {prepare,deck,state,snapshot,signature} from './mechanics-fixtures.mjs';
import {createPriorityClock} from './priority-clock.mjs';
const {engine:e,provenance,networkCalls}=await bootMechanics();
const f=prepare(e,deck('Forest'),deck('Forest'));const setupSha256=f.restore();
let now=1000,revision=0,applied=0;
const context=()=>({matchId:'deadline-engine-check',revision,actor:state(e).waiting_for.data.player,
 decisionId:`priority-${revision}`,kind:state(e).waiting_for.type});
const position=()=>sha(JSON.stringify(signature(e)));
const before=position(),clock=createPriorityClock({matchId:'deadline-engine-check',now:()=>now,newId:()=>`timeout-${revision}`});clock.arm(context());
now=30999;assert.equal(clock.propose(context(),e.get_legal_actions_for_viewer_js(0).actions).state,'waiting');assert.equal(position(),before);
const saved={engine:snapshot(e),clock:clock.snapshot()};
// Replace authority state and clock as a restart seam. The saved deadline must
// not restart merely because the authority object was reconstructed.
e.restore_game_state(saved.engine);now=31000;
const resumed=createPriorityClock({matchId:'deadline-engine-check',saved:saved.clock,now:()=>now});
const current=context(),legal=e.get_legal_actions_for_viewer_js(0).actions,proposal=resumed.propose(current,legal);
assert.equal(proposal.state,'timeout-proposal');assert.equal(proposal.deadlineAt,31000);
assert.equal(resumed.validate(proposal,{...current,actor:1},legal).ok,false);assert.equal(position(),before);
const allowed=resumed.validate(proposal,current,e.get_legal_actions_for_viewer_js(0).actions);assert(allowed.ok);
const result=e.submit_action(allowed.actor,allowed.action);assert(['applied','Applied'].includes(result.status));applied++;revision++;
resumed.acknowledge(proposal,revision);assert.equal(resumed.propose(current,legal).state,'committed');assert.equal(resumed.validate(proposal,current,legal).ok,false);
assert.equal(applied,1);assert.equal(state(e).waiting_for.type,'Priority');assert.equal(state(e).waiting_for.data.player,1);assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);assert.equal(networkCalls(),0);
const sourceFiles=Object.fromEntries(await Promise.all(['priority-clock-engine.mjs','priority-clock.mjs','mechanics-inputs.mjs','mechanics-fixtures.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
const report={provenance,setupSha256,sourceFiles,defaultResponseSeconds:30,restoredDeadlineAt:31000,earlyReadNoMutation:true,wrongActorRejected:true,acceptedPasses:1,duplicateRejected:true,nextActor:1,networkCalls:0,
 limits:'Engine-backed response timer contract only; no displayed countdown, live scheduler, atomic journal clock persistence, trusted multiplayer time or complete mandatory-choice/anti-stall policy.'};
const out=resolve(process.env.CARDSTASHY_PHASE_CLOCK_OUTPUT||'test-results/phase-clock');await mkdir(out,{recursive:true});await writeFile(resolve(out,'clock-engine-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
