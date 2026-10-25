// Actual pinned WASM through the durable human ingress; no adopted runtime/UI.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {bootMechanics,sha} from './mechanics-inputs.mjs';
import {prepare,deck,state,signature,tracker} from './mechanics-fixtures.mjs';
import {createJournal} from './worker-journal.mjs';
import {projectInteraction} from './interaction-surface.mjs';
const {engine:e,provenance,networkCalls}=await bootMechanics();
const evidence=[];
function authority(start){
 let saved=null,sequence=0,applies=0;
 const engine={humanSeat:0,start,save:()=>e.export_game_state_json(),restore:s=>e.restore_game_state(s),
  summary:()=>({interaction:projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0)}),
  respond:s=>{const r=e.submit_interaction_js(0,s);if(r.status==='applied'){applies++;return true;}assert.equal(r.status,'rejected');return false;}};
 const storage={read:async()=>structuredClone(saved),write:async(next,expected)=>{assert.equal(saved?.revision??null,expected);saved=structuredClone(next);}};
 const open=()=>createJournal({engine,storage,version:provenance.buildIdentity+':interaction-proof',epoch:'human',choose:()=>assert.fail('AI generator must not choose human input')});
 let handler=open();
 const send=async(op,fields={})=>{const r=await handler({v:1,epoch:'human',id:'request-'+(++sequence),op,...fields});assert.equal(r.ok,true,JSON.stringify(r));return r.result;};
 return {send,async resume(){handler=open();return send('resume');},get saved(){return saved;},get applies(){return applies;}};
}
const choose=(i,value)=>{const o=i.opportunities.find(o=>o.type==='choose');assert(o);const c=o.choices.find(c=>c.surfaces.some(s=>s.type==='value'&&s.value===value));assert(c);return {interactionId:o.interactionId,response:{type:'choose',data:{choiceId:c.id}}};};
const select=(o,ids)=>({interactionId:o.interactionId,response:{type:'select',data:{choiceIds:ids}}});
const format=e.getFormatRegistry().find(f=>f.format==='Modern').default_config;
const a=authority(()=>{
 e.initialize_game({player:{main_deck:Array(60).fill('Forest')},opponent:{main_deck:Array(60).fill('Island')}},1,format,null,2,0);
 // Explicit fixed opponent keep for this narrow pregame test, not a CPU policy.
 assert.equal(e.submit_action(1,{type:'MulliganDecision',data:{choice:{type:'Keep'}}}).status,'applied');
});
let r=await a.send('create',{seed:1,first:0});
r=await a.send('respond',{revision:r.revision,submission:choose(r.interaction,'mulligan')});
r=await a.send('respond',{revision:r.revision,submission:choose(r.interaction,'keep')});
let o=r.interaction.opportunities.find(o=>o.type==='select');assert.equal(o.min,1);assert.equal(o.max,1);assert.equal(o.choices.length,7);
const before=signature(e),bad=await a.send('respond',{revision:r.revision,submission:select(o,[])});assert.equal(bad.rejected,true);assert.equal(bad.revision,r.revision);assert.deepEqual(signature(e),before);
const old=select(o,[o.choices.at(-1).id]);const selected=Number(o.choices.at(-1).surfaces.find(s=>s.type==='object').reference);
r=await a.resume();assert.equal(r.revision,2);const stale=await a.send('respond',{revision:2,submission:old});assert.equal(stale.rejected,true);assert.deepEqual(signature(e),before);
o=r.interaction.opportunities.find(o=>o.type==='select');const c=o.choices.find(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(selected)));assert(c);
const submission=select(o,[c.id]);r=await a.send('respond',{id:'bottom-once',revision:2,submission});assert.equal(r.revision,3);assert.equal(state(e).players[0].hand.length,6);assert(!state(e).players[0].hand.includes(selected));assert.equal(state(e).players[0].library.at(-1),selected,'chosen card is at the library bottom');
const final=signature(e);await a.resume();await a.send('respond',{id:'bottom-once',revision:2,submission});assert.deepEqual(signature(e),final);assert.equal(a.applies,3);
evidence.push({name:'Mulligan, keep and exact bottom through durable human route',accepted:3,invalidCountRejected:true,rebindRejectsOldInteraction:true,duplicateAfterRestore:true,handCount:6});
const h=authority(()=>{
 const f=prepare(e,deck('Swamp','Head Games','Head Games','Head Games','Head Games'),deck('Forest','Ornithopter','Ornithopter','Ornithopter','Ornithopter'));
 f.move('Swamp',0,'Battlefield',5);const [spell]=f.move('Head Games',0,'Hand');f.move('Forest',1,'Hand');f.move('Ornithopter',1,'Hand');f.restore();
 const t=tracker(e);t.take('CastSpell',a=>a.data.object_id===spell);t.passUntil(s=>s.waiting_for.type==='EffectZoneChoice');t.take('SelectCards');assert.equal(state(e).waiting_for.type,'SearchChoice');
});
r=await h.send('create',{seed:1,first:0});o=r.interaction.opportunities.find(o=>o.type==='select');assert(o);assert.equal(o.min,2);assert.equal(o.max,2);
const selectedIds=state(e).players[1].library.slice(-2);const cs=selectedIds.map(id=>o.choices.find(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(id))));assert(cs.every(Boolean));
const candidates=e.get_legal_actions_for_viewer_js(0).actions;assert(!candidates.some(a=>a.type==='SelectCards'&&JSON.stringify(a.data.cards)===JSON.stringify(selectedIds)));
const ownLibrary=[...state(e).players[0].library];r=await h.send('respond',{id:'head-once',revision:0,submission:select(o,cs.map(c=>c.id))});assert.equal(r.revision,1);assert.deepEqual(state(e).players[1].hand,selectedIds);assert.deepEqual(state(e).players[0].library,ownLibrary);
for(const id of selectedIds)assert.equal(e.get_filtered_game_state(0).state.objects[id].name,'Hidden Card');
assert(!JSON.stringify(r.interaction).includes(cs[0].id));
evidence.push({name:'Head Games non-AI-candidate selection through human route',selectedCount:2,correctOpponentHand:true,ownLibraryUnchanged:true,permissionRetired:true});
assert.equal(networkCalls(),0);
const files=['interaction-engine.mjs','interaction-surface.mjs','worker-journal.mjs','protocol-fault.mjs','mechanics-inputs.mjs','mechanics-fixtures.mjs'];
const sourceFiles=Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
const report={provenance,sourceFiles,cases:evidence,networkCalls:0,limits:'Original runtime, Node execution, in-memory transactional store, same-process restore. Head Games uses engineered setup. No corrected ninjutsu, browser UI, CPU strategy, full pregame/payment/target coverage or cold offline certification.'};
await writeFile(new URL('interaction-evidence-2026-10-24.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
