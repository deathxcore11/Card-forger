// CPU-001: acceptance evidence against the shipped engine, not a difficulty claim.
// Engineered positions use unchanged compiled cards. No engine build or network.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {cpuPacket,chooseVisible,CPU_POLICY_VERSION} from './visible-cpu-policy.mjs';
import {makeCpuObservation,PUBLIC_CPU_VERSION} from './cpu-public-observation.mjs';
import {chooseCpu} from './cpu-public-policy.mjs';
import {cpuLegalCandidates} from './cpu-legal-candidates.mjs';
import {projectSeat} from './seat-surface.mjs';
import {prepare,deck,state,tracker,candidates} from './mechanics-fixtures.mjs';
import {RUNTIME_IDENTITY,RULES_IDENTITY,validateRuntimeManifest,validateRulesManifest} from './runtime-assets.mjs';

const baseCommit='2af11c9a1326e0db75b875d9c122e3dea01055d7';
const sha=b=>createHash('sha256').update(b).digest('hex');
const here=new URL('./',import.meta.url),runtime=new URL('./runtime/a86578b23adcd26c/',here);
const manifest=validateRuntimeManifest(JSON.parse(await readFile(new URL('manifest.json',runtime))));
validateRulesManifest(manifest.cardDatabase);
const compressed=Buffer.concat(await Promise.all(manifest.chunks.map(async c=>{
 const b=await readFile(new URL(c.path,runtime));assert.equal(b.length,c.bytes);assert.equal(sha(b),c.sha256);return b;
})));
assert.equal(sha(compressed),manifest.compressedSha256);
const wasm=gunzipSync(compressed);assert.equal(wasm.length,RUNTIME_IDENTITY.wasmBytes);assert.equal(sha(wasm),RUNTIME_IDENTITY.wasmSha256);
const glue=await readFile(new URL('engine_wasm.js',runtime));assert.equal(sha(glue),RUNTIME_IDENTITY.glueSha256);
const rules=await readFile(new URL('card-rules.bin',runtime));assert.equal(sha(rules),RULES_IDENTITY.sha256);
const decoded=gunzipSync(rules);assert.equal(sha(decoded),RULES_IDENTITY.decodedSha256);
const catalog=JSON.parse(decoded),names=['Forest','Bear Cub','Ordinary Bear','Ghalta, Primal Hunger','Tapestry Warden'];
const subset=Object.fromEntries(names.map(name=>{assert(catalog[name.toLowerCase()]);return [name.toLowerCase(),catalog[name.toLowerCase()]];}));
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('CPU acceptance forbids network');};
const e=await import(new URL('engine_wasm.js',runtime));await e.default({module_or_path:wasm});assert.equal(e.load_card_database(JSON.stringify(subset)),names.length);
const report={task:'CPU-001 regression / CPU-002',baseCommit,testedCommit:process.env.CARDSTASHY_CPU_COMMIT||null,policyVersion:PUBLIC_CPU_VERSION,legacyPolicyVersion:CPU_POLICY_VERSION,runtimeSha256:RUNTIME_IDENTITY.wasmSha256,
 sourceSha256:sha(await readFile(new URL(import.meta.url))),policySha256:sha(await readFile(new URL('visible-cpu-policy.mjs',here))),
 projectionSha256:sha(await readFile(new URL('seat-surface.mjs',here))),node:process.version,cases:[],
 limits:['Engineered initial positions, not full legal match histories.','No browser, signed-in account, reload recovery or complete-match test in this task.','Privacy fixtures cover the described variations only; no complete noninterference proof.','Rules implementation and legacy policy unchanged; public CPU wrapper supplies survival evaluation.']};
report.cpuSources=Object.fromEntries(await Promise.all(['cpu-public-observation.mjs','cpu-combat-evaluation.mjs','cpu-public-policy.mjs'].map(async p=>[p,sha(await readFile(new URL(p,here)))])));
async function run(id,name,expected,body){
 const evidence={id,name,layer:'engine + CPU policy',expected};
 try{await body(evidence);evidence.status='PASS';}catch(error){evidence.status='FAIL';evidence.assertion=error.message;}
 report.cases.push(evidence);console.log(`${evidence.status} ${id}: ${name}`);
}
function proposal(actor){
 const actions=cpuLegalCandidates(e,actor,e.get_legal_actions_for_viewer_js(actor).actions).actions;assert(actions.length);
 const packet=makeCpuObservation(e.get_filtered_game_state(actor),actor,actions),selection=chooseCpu(packet,777);
 assert(Number.isInteger(selection.index)&&selection.index>=0&&selection.index<actions.length);
 return {actor,actions,packet,selection,action:actions[selection.index]};
}
function record(v,t,p){v.packet=p.packet;v.proposal=p.selection;v.selectedAction=p.action;v.acceptedActions=structuredClone(t.trace);v.actual={life:state(e).players.map(p=>p.life),waiting:state(e).waiting_for,phase:state(e).phase};}
function finishCombat(t){
 for(let i=0;i<40&&!['PostCombatMain'].includes(state(e).phase)&&state(e).waiting_for.type!=='GameOver';i++){
  if(state(e).waiting_for.type==='AssignCombatDamage'){
   const row=candidates(e)[0];assert(row);const p=proposal(row.actor);t.submit(row.actor,p.action);
  }else t.take('PassPriority');
 }
 assert(state(e).phase==='PostCombatMain'||state(e).waiting_for.type==='GameOver','combat must finish within 40 actions');
}
function lethalBlockPosition(life=12){
 const f=prepare(e,deck('Forest','Ghalta, Primal Hunger'),deck('Forest','Ghalta, Primal Hunger'));
 const [attacker]=f.move('Ghalta, Primal Hunger',0,'Battlefield'),[blocker]=f.move('Ghalta, Primal Hunger',1,'Battlefield');f.s.players[1].life=life;
 const setupSha256=f.restore(),t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');
 t.take('DeclareAttackers',a=>a.data.attacks.length===1&&a.data.attacks[0][0]===attacker);
 t.passUntil(s=>s.waiting_for.type==='DeclareBlockers');return {attacker,blocker,setupSha256,t};
}
await run('CPU-001-A','CPU blocks lethal Ghalta attack','Choose the generated block, trade creatures, remain alive at 12 life.',v=>{
 const f=lethalBlockPosition();v.start={seed:12345,cpuSeat:1,cpuLife:12,attacker:'Ghalta, Primal Hunger',blocker:'Ghalta, Primal Hunger',setupSha256:f.setupSha256};
 const save=e.export_game_state_json(),p=proposal(1),blocking=p.actions.find(a=>a.type==='DeclareBlockers'&&a.data.assignments.some(([b,a])=>b===f.blocker&&a===f.attacker));assert(blocking,'surviving alternative must be generated by engine');
 f.t.submit(1,p.action);finishCombat(f.t);record(v,f.t,p);const survived=state(e).waiting_for.type!=='GameOver';
 e.restore_game_state(save);const alternate=tracker(e);alternate.submit(1,blocking);finishCombat(alternate);
 v.alternative={action:blocking,acceptedActions:alternate.trace,life:state(e).players.map(p=>p.life),waiting:state(e).waiting_for,attackerZone:state(e).objects[f.attacker].zone,blockerZone:state(e).objects[f.blocker].zone};
 assert.notEqual(state(e).waiting_for.type,'GameOver','alternative must survive');assert.equal(state(e).players[1].life,12);
 assert.equal(state(e).objects[f.attacker].zone,'Graveyard');assert.equal(state(e).objects[f.blocker].zone,'Graveyard');
 assert(survived,'CPU chose a lethal no-block despite an engine-accepted surviving block');
});
await run('CPU-001-B','CPU takes an unopposed Tapestry Warden attack','Attack with Warden and deal its four toughness as damage.',v=>{
 const f=prepare(e,deck('Forest','Tapestry Warden'),deck('Forest')),[attacker]=f.move('Tapestry Warden',0,'Battlefield');
 v.start={seed:12345,cpuSeat:0,attacker:'Tapestry Warden',opponentBattlefield:[],setupSha256:f.restore()};const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');
 const save=e.export_game_state_json(),p=proposal(0),attack=p.actions.find(a=>a.type==='DeclareAttackers'&&a.data.attacks.length===1&&a.data.attacks[0][0]===attacker);assert(attack);
 t.submit(0,p.action);finishCombat(t);record(v,t,p);const damage=20-state(e).players[1].life;
 e.restore_game_state(save);const alternate=tracker(e);alternate.submit(0,attack);finishCombat(alternate);
 v.alternative={action:attack,acceptedActions:alternate.trace,life:state(e).players.map(p=>p.life)};assert.equal(state(e).players[1].life,16);
 assert.equal(damage,4,'CPU declined four free combat damage');
});
await run('CPU-001-C','CPU develops a castable creature','Choose and successfully resolve Bear Cub instead of passing.',v=>{
 const f=prepare(e,deck('Forest','Bear Cub'),deck('Forest'));f.move('Forest',0,'Battlefield',2);const [bear]=f.move('Bear Cub',0,'Hand');
 v.start={seed:12345,cpuSeat:0,hand:['Bear Cub'],untappedForests:2,setupSha256:f.restore()};const t=tracker(e),p=proposal(0);t.submit(0,p.action);t.passUntil(s=>s.stack.length===0);record(v,t,p);
 assert.equal(p.action.type,'CastSpell');assert.equal(state(e).objects[bear].zone,'Battlefield');
});
await run('CPU-001-D','CPU attacks with an unopposed Bear Cub','Choose attack and deal two combat damage.',v=>{
 const f=prepare(e,deck('Forest','Bear Cub'),deck('Forest'));f.move('Bear Cub',0,'Battlefield');v.start={seed:12345,cpuSeat:0,attacker:'Bear Cub',opponentBattlefield:[],setupSha256:f.restore()};
 const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');const p=proposal(0);t.submit(0,p.action);finishCombat(t);record(v,t,p);assert.equal(state(e).players[1].life,18);
});
await run('CPU-001-E','Hidden world changes do not change CPU packet or decision','Identical packet, selected action and policy RNG after changing opponent hand identity and both private library orders.',v=>{
 const f=prepare(e,deck('Forest','Ghalta, Primal Hunger','Bear Cub','Ordinary Bear'),deck('Forest','Ghalta, Primal Hunger'));f.move('Bear Cub',0,'Hand');f.move('Ghalta, Primal Hunger',1,'Battlefield');const [attacker]=f.move('Ghalta, Primal Hunger',0,'Battlefield');
 v.start={seed:12345,cpuSeat:1,opponentHandCount:1,setupSha256:f.restore()};
 // Offer at least two real block choices; equality must not depend on a sole pass.
 const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');t.take('DeclareAttackers',a=>a.data.attacks.length===1&&a.data.attacks[0][0]===attacker);t.passUntil(s=>s.waiting_for.type==='DeclareBlockers');
 const original=e.export_game_state_json(),first=proposal(1),save=JSON.parse(original),s=save.state;assert(first.actions.length>=2);
 const old=s.players[0].hand[0],next=s.players[0].library.find(id=>s.objects[id].name==='Ordinary Bear');assert(next);
 s.players[0].hand=[next];s.players[0].library=s.players[0].library.map(id=>id===next?old:id).reverse();s.objects[old].zone='Library';s.objects[next].zone='Hand';
 s.players[1].library.reverse();
 e.restore_game_state(JSON.stringify(save));assert.equal(state(e).objects[state(e).players[0].hand[0]].name,'Ordinary Bear');
 assert.deepEqual(state(e).players[0].library,s.players[0].library);assert.deepEqual(state(e).players[1].library,s.players[1].library);
 const second=proposal(1);
 v.actual={hiddenChanges:{opponentHandBefore:'Bear Cub',opponentHandAfter:'Ordinary Bear',bothLibrariesReversed:true},firstPacket:first.packet,secondPacket:second.packet,firstProposal:first.selection,secondProposal:second.selection,firstAction:first.action,secondAction:second.action};
 assert.deepEqual(second.packet,first.packet);assert.deepEqual(second.selection,first.selection);assert.deepEqual(second.action,first.action);
 assert(!/Bear Cub|Ordinary Bear|Ghalta|oracle|object_id|rng_seed/.test(JSON.stringify(first.packet)));
});
await run('CPU-001-F','CPU resolves a forced legend choice','Choose a generated keep action and leave exactly one Ghalta on battlefield.',v=>{
 const f=prepare(e,deck('Forest','Ghalta, Primal Hunger','Ghalta, Primal Hunger'),deck('Forest'));f.move('Forest',0,'Battlefield',2);const [old]=f.move('Ghalta, Primal Hunger',0,'Battlefield'),[fresh]=f.move('Ghalta, Primal Hunger',0,'Hand');
 v.start={seed:12345,cpuSeat:0,setupSha256:f.restore()};const t=tracker(e);t.take('CastSpell',a=>a.data.object_id===fresh&&a.data.payment_mode?.type==='Auto');t.passUntil(s=>s.waiting_for.type==='ChooseLegend');const p=proposal(0);t.submit(0,p.action);record(v,t,p);
 assert.equal(p.action.type,'ChooseLegend');assert.notEqual(state(e).waiting_for.type,'ChooseLegend');assert.equal([old,fresh].filter(id=>state(e).objects[id].zone==='Battlefield').length,1);
});
await run('CPU-001-G','Unsupported CPU choices stop explicitly','Throw CPU_DECISION_UNSUPPORTED without inventing an action.',v=>{
 v.layer='synthetic policy contract';v.start={choices:[{kind:'unsupported'}],policyRng:777};
 assert.throws(()=>chooseVisible({version:CPU_POLICY_VERSION,choices:v.start.choices},777),/CPU_DECISION_UNSUPPORTED/);v.actual={error:'CPU_DECISION_UNSUPPORTED',actionSubmitted:false};
});
report.cases.push({id:'CPU-001-H',name:'Signed-in complete starter match and recovery',layer:'browser',status:'NOT TESTED',expected:'Integration runs the combined changes through a signed-in complete match.',actual:'Outside this bounded engine/policy task.'});
report.networkCalls=networkCalls;assert.equal(networkCalls,0);
report.counts=Object.fromEntries(['PASS','FAIL','NOT TESTED','UNSUPPORTED'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
const output=resolve(process.env.CARDSTASHY_CPU_OUTPUT||'test-results/cpu-baseline');await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts));if(report.counts.FAIL)process.exitCode=1;
