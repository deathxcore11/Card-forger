// SESSION-001: executable false-negative witnesses for the shipped action lists.
// These are engineered positions, not legal setup histories or card-rule proof.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bootAcceptance,digest} from './acceptance-inputs.mjs';
import {prepare,deck} from './mechanics-fixtures.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {priorityCapability,createPriorityFlow} from './priority-flow.mjs';

const {engine:e,provenance}=await bootAcceptance(['Forest','Swamp','Bane of the Living']);
const output=resolve(process.env.CARDSTASHY_CAPABILITY_GAP_OUTPUT||'test-results/priority-capability-gap');
const fixture=prepare(e,deck('Swamp','Bane of the Living'),deck('Forest'));
const [id]=fixture.move('Bane of the Living',0,'Hand');fixture.move('Swamp',0,'Battlefield',8);fixture.restore();
const startingSave=e.export_game_state_json();
const report={task:'SESSION-001 action coverage counterexample',provenance,fixture:{seed:12345,format:'Vintage',card:'Bane of the Living',handObject:id,battlefield:'Eight untapped Swamps',phase:'PreCombatMain',actor:0},startingStateSha256:digest(startingSave),cases:[],limits:['Engineered starting position with unchanged compiled card definitions; not a complete match.','Acceptance witnesses show actions omitted by published candidates; they do not prove correct Magic rules execution for these mechanics.','No capability promotion, production behavior change, new runtime, or arbitrary-deck support.']};
for(const [type,code,data] of [
 ['PlayFaceDown','playFaceDown',{object_id:id,card_id:e.get_game_state().state.objects[id].card_id}],
 ['TurnFaceUp','turnFaceUp',{object_id:id,x:1}],
]){
 const packet=e.get_legal_actions_for_viewer_js(0),view=e.get_viewer_snapshot_js(0),interaction=projectInteraction(view.viewerInteraction,0);
 const flatTypes=packet.actions.map(a=>a.type),groupedTypes=[...new Set(Object.values(packet.legalActionsByObject).flat().map(a=>a.type))];
 const interactionCodes=[...new Set(interaction.opportunities.flatMap(o=>o.choices.flatMap(c=>c.surfaces.filter(s=>s.type==='action').map(s=>s.code))))];
 assert(!flatTypes.includes(type));assert(!groupedTypes.includes(type));assert(!interactionCodes.includes(code));
 if(type==='TurnFaceUp')assert.deepEqual(flatTypes,['PassPriority']);
 const before=e.export_game_state_json(),capability=priorityCapability({state:e.get_filtered_game_state(0).state,actor:0,epoch:'gap-fixture',revision:report.cases.length});
 let queued=0;
 const flow=createPriorityFlow({read:()=>({status:{revision:capability.revision,priorityCapability:capability}}),dispatch:async()=>{assert.fail('Unknown coverage must not dispatch');},enqueue:()=>{queued++;return 1;},dequeue(){}});
 flow.reconcile();assert.equal(queued,0);assert.equal(flow.snapshot().reason,'coverage-unknown');assert.equal(capability.coverage,'unknown');flow.close();
 assert.equal(e.export_game_state_json(),before,'Capability inspection must not mutate the game');
 const action={type,data},result=e.submit_action(0,action);assert.equal(result.status,'applied');
 assert.equal(e.get_game_state().state.objects[id].face_down,type==='PlayFaceDown');
 report.cases.push({id:type,status:'PASS',expected:'Engine accepts the action even though flat, grouped and interaction offers omit it; unknown coverage blocks automation.',flatTypes,groupedTypes,interactionCodes,topAutoPassRecommended:packet.autoPassRecommended,nestedAutoPassRecommended:view.viewerInteraction.autoPassRecommended,capability,action,accepted:true,beforeStateSha256:digest(before),afterStateSha256:digest(e.export_game_state_json())});
}
report.sources=Object.fromEntries(await Promise.all(['priority-capability-gap-engine.mjs','priority-flow.mjs','acceptance-inputs.mjs','mechanics-fixtures.mjs','interaction-surface.mjs'].map(async path=>[path,digest(await readFile(new URL(path,import.meta.url)))])));
await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(resolve(output,'starting-state.json'),startingSave+'\n');
console.log(JSON.stringify({cases:report.cases.map(({id,status})=>({id,status})),report:resolve(output,'report.json'),coverage:'unknown'}));
