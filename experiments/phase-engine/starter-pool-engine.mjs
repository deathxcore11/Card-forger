// Exact delivered engine and unchanged compiled cards. Engineered positions
// exercise each starter mechanic; they are not full legal-game histories.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {sha,PIN} from './mechanics-inputs.mjs';
import {prepare,deck,state,tracker,candidates,signature} from './mechanics-fixtures.mjs';
import {RUNTIME_IDENTITY,RULES_IDENTITY} from './runtime-assets.mjs';
import {projectSeat} from './seat-surface.mjs';
import {projectInteraction,interactionSubmission} from './interaction-surface.mjs';
import {cpuPacket,chooseVisible} from './visible-cpu-policy.mjs';

const inputs=resolve(process.env.CARDSTASHY_VERIFICATION_INPUTS||'verification-inputs'),pkg=resolve(process.env.CARDSTASHY_PHASE_PKG||resolve(inputs,'pkg')),output=resolve(process.env.CARDSTASHY_STARTER_OUTPUT||'test-results/starter-pool');
const [receiptBytes,wasm,glue,gzip]=await Promise.all([readFile(resolve(inputs,'build-receipt.json')),readFile(resolve(pkg,'engine_wasm_bg.wasm')),readFile(resolve(pkg,'engine_wasm.js')),readFile(resolve(inputs,'integration_cards.json.gz'))]);
const receipt=JSON.parse(receiptBytes);
assert.equal(receipt.schemaVersion,1);assert.equal(receipt.upstreamCommit,PIN);assert.equal(receipt.sourceCommit,'5169f7fe03f93a6afe36fec767c3cda10120dcdd');assert.equal(receipt.sourceTree,RUNTIME_IDENTITY.sourceTree);assert.equal(receipt.sourceDiffSha256,'b8a5b0efb91b10d8930252bfe522a07e8ba95030436aa5b5419478a42a2cdb5d');
for(const [bytes,expected]of [[wasm,RUNTIME_IDENTITY.wasmSha256],[wasm,receipt.wasmSha256],[glue,RUNTIME_IDENTITY.glueSha256],[glue,receipt.glueSha256],[gzip,RULES_IDENTITY.sha256],[gzip,receipt.integrationFixtureGzipSha256]])assert.equal(sha(bytes),expected);
const decoded=gunzipSync(gzip);assert.equal(sha(decoded),RULES_IDENTITY.decodedSha256);const catalog=JSON.parse(decoded);assert.equal(Object.keys(catalog).length,RULES_IDENTITY.entries);
const starterNames=['Forest','Llanowar Elves','Bear Cub','Ordinary Bear','Ghalta, Primal Hunger','Lashwhip Predator','Tarmogoyf','Tapestry Warden','Virulent Emissary','Scarecrow Guide'];
const names=[...starterNames,'Air Elemental','Lightning Bolt'];
const subset=Object.fromEntries(names.map(name=>{const key=name.toLowerCase();assert(Object.hasOwn(catalog,key),'Missing compiled card '+name);assert(!JSON.stringify(catalog[key]).includes('Unimplemented'),'Unimplemented definition '+name);return [key,catalog[key]];}));
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('No network in starter mechanics proof');};
const e=await import(pathToFileURL(resolve(pkg,'engine_wasm.js')));await e.default({module_or_path:wasm});assert.equal(e.load_card_database(JSON.stringify(subset)),names.length);
const report={passed:false,provenance:{...receipt,receiptSha256:sha(receiptBytes),subsetSha256:sha(JSON.stringify(subset)),loadedNames:names},cases:[],limits:'Engineered positions using unchanged compiled definitions, followed by real accepted actions. Current catalog legality is checked separately. No all-card, all-interaction, CPU strength or signed-in account certificate.'};
function view(id,seat=0){return projectSeat(e.get_filtered_game_state(seat),seat).cards.find(c=>c.id===id);}
function cast(t,id){t.take('CastSpell',a=>a.data.object_id===id&&a.data.payment_mode?.type==='Auto');t.passUntil(s=>s.stack.length===0,30);}
function combat(t,attacker,blocker){
 t.passUntil(s=>s.waiting_for.type==='DeclareAttackers',16);t.take('DeclareAttackers',a=>a.data.attacks.length===1&&a.data.attacks[0][0]===attacker);
 t.passUntil(s=>['DeclareBlockers','PostCombatMain'].includes(s.waiting_for.type)||s.phase==='PostCombatMain',20);
 if(state(e).waiting_for.type==='DeclareBlockers')t.take('DeclareBlockers',a=>blocker?a.data.assignments.length===1&&a.data.assignments[0][0]===blocker&&a.data.assignments[0][1]===attacker:a.data.assignments.length===0);
 for(let n=0;n<30&&state(e).phase!=='PostCombatMain';n++){
  if(state(e).waiting_for.type==='AssignCombatDamage'){
   const waiting=state(e).waiting_for.data,o=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0).opportunities.find(o=>o.type==='assignDamage');assert(o,'damage must be projected to usable controls');let left=o.total;
   const assignments=o.choices.map(c=>{const ref=c.surfaces.find(s=>s.type==='object')?.reference,block=waiting.blockers.find(b=>String(b.blocker_id)===ref);const amount=block?Math.min(left,block.lethal_minimum):left;left-=amount;return {choiceId:c.id,amount};});
   const player=o.choices.find(c=>c.surfaces.some(s=>s.type==='player'));
   if(player){const before=sha(JSON.stringify(signature(e))),invalid=e.submit_interaction_js(waiting.player,{interactionId:o.interactionId,response:{type:'assignDamage',data:{mode:'normal',assignments:[{choiceId:player.id,amount:o.total}]}}});assert.equal(invalid.status,'rejected');assert.equal(sha(JSON.stringify(signature(e))),before);}
   const reply=e.submit_interaction_js(waiting.player,interactionSubmission({interactionId:o.interactionId,response:{type:'assignDamage',data:{mode:'normal',assignments}}}));assert.equal(reply.status,'applied');
  }else t.take('PassPriority');
 }
 assert.equal(state(e).phase,'PostCombatMain');
}
async function run(name,body){try{const result=await body();report.cases.push({name,passed:true,...result});console.log('PASS '+name);}catch(error){report.cases.push({name,passed:false,error:String(error.stack||error),diagnostic:{waiting:state(e).waiting_for,candidates:candidates(e),interaction:e.get_viewer_snapshot_js(0).viewerInteraction}});console.log('FAIL '+name+' '+error.message);}}
for(const [name,power,toughness]of [['Bear Cub',2,2],['Ordinary Bear',4,5]])await run(name+' casts and resolves at printed size',()=>{
 const f=prepare(e,deck('Forest',name),deck('Forest'));f.move('Forest',0,'Battlefield',8);const [id]=f.move(name,0,'Hand');const setupSha256=f.restore(),t=tracker(e);cast(t,id);assert.equal(view(id).power,power);assert.equal(view(id).toughness,toughness);assert.equal(view(id).zone,'Battlefield');return {setupSha256,receipt:t.receipt()};
});
await run('Llanowar Elves produces one green mana, taps, and cannot activate twice',()=>{
 const f=prepare(e,deck('Forest','Llanowar Elves'),deck('Forest'));const [id]=f.move('Llanowar Elves',0,'Battlefield');const setupSha256=f.restore(),o=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0).opportunities.find(o=>o.type==='choose'),choice=o?.choices.find(c=>c.surfaces.some(s=>s.type==='action'&&s.code==='activateAbility')&&c.surfaces.some(s=>s.type==='object'&&s.reference===String(id)));assert(choice,'published mana activation required');const submission=interactionSubmission({interactionId:o.interactionId,response:{type:'choose',data:{choiceId:choice.id}}}),reply=e.submit_interaction_js(0,submission);assert.equal(reply.status,'applied');assert.equal(state(e).objects[id].tapped,true);const pool=state(e).players[0].mana_pool;assert.equal(pool.mana.length,1);assert.equal(pool.mana[0].color,'Green',JSON.stringify(pool));const before=sha(JSON.stringify(signature(e))),again=e.submit_interaction_js(0,submission);assert.equal(again.status,'rejected');assert.equal(sha(JSON.stringify(signature(e))),before);return {setupSha256,manaPool:pool,acceptedInteraction:submission};
});
for(const creatures of [0,2])await run('Ghalta cost reduction with '+creatures+' eight-power support creatures',()=>{
 const f=prepare(e,deck('Forest','Ghalta, Primal Hunger',...Array(creatures).fill('Ordinary Bear')),deck('Forest'));f.move('Forest',0,'Battlefield',4);if(creatures)f.move('Ordinary Bear',0,'Battlefield',creatures);const [id]=f.move('Ghalta, Primal Hunger',0,'Hand');const setupSha256=f.restore(),t=tracker(e),can=candidates(e).some(r=>r.actions.some(a=>a.type==='CastSpell'&&a.data.object_id===id));assert.equal(can,creatures===2);if(can){cast(t,id);assert.equal(view(id).power,12);assert.equal(view(id).toughness,12);assert(view(id).keywords.includes('Trample'));}return {setupSha256,castAvailable:can,receipt:t.receipt()};
});
for(const opponents of [0,3])await run('Lashwhip Predator cost condition with '+opponents+' opposing creatures',()=>{
 const f=prepare(e,deck('Forest','Lashwhip Predator'),deck('Forest',...Array(opponents).fill('Bear Cub')));f.move('Forest',0,'Battlefield',4);if(opponents)f.move('Bear Cub',1,'Battlefield',opponents);const [id]=f.move('Lashwhip Predator',0,'Hand');const setupSha256=f.restore(),t=tracker(e),can=candidates(e).some(r=>r.actions.some(a=>a.type==='CastSpell'&&a.data.object_id===id));assert.equal(can,opponents===3);if(can){cast(t,id);assert.equal(view(id).power,5);assert.equal(view(id).toughness,7);assert(view(id).keywords.includes('Reach'));}return {setupSha256,castAvailable:can,receipt:t.receipt()};
});
await run('Tarmogoyf counts distinct card types across both graveyards',()=>{
 const f=prepare(e,deck('Forest','Tarmogoyf','Bear Cub'),deck('Forest','Lightning Bolt'));const [id]=f.move('Tarmogoyf',0,'Battlefield');f.move('Forest',0,'Graveyard');f.move('Bear Cub',0,'Graveyard');f.move('Lightning Bolt',1,'Graveyard');const setupSha256=f.restore();assert.equal(view(id).power,3);assert.equal(view(id).toughness,4);return {setupSha256,power:view(id).power,toughness:view(id).toughness};
});
await run('Ghalta trample deals excess combat damage through a smaller blocker',()=>{
 const f=prepare(e,deck('Forest','Ghalta, Primal Hunger'),deck('Forest','Bear Cub'));const [attacker]=f.move('Ghalta, Primal Hunger',0,'Battlefield'),[blocker]=f.move('Bear Cub',1,'Battlefield');const setupSha256=f.restore(),t=tracker(e);combat(t,attacker,blocker);assert.equal(state(e).players[1].life,10);assert.equal(state(e).objects[blocker].zone,'Graveyard');return {setupSha256,life:state(e).players.map(p=>p.life),receipt:t.receipt()};
});
await run('A legal all-to-blocker trample split omits zero targets on the wire',()=>{
 const f=prepare(e,deck('Forest','Ghalta, Primal Hunger'),deck('Forest','Bear Cub'));const [attacker]=f.move('Ghalta, Primal Hunger',0,'Battlefield'),[blocker]=f.move('Bear Cub',1,'Battlefield');const setupSha256=f.restore(),t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers',16);t.take('DeclareAttackers',a=>a.data.attacks.length===1&&a.data.attacks[0][0]===attacker);t.passUntil(s=>s.waiting_for.type==='DeclareBlockers',16);t.take('DeclareBlockers',a=>a.data.assignments.length===1&&a.data.assignments[0][0]===blocker);t.passUntil(s=>s.waiting_for.type==='AssignCombatDamage',16);
 const o=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0).opportunities.find(o=>o.type==='assignDamage'),assignments=o.choices.map(c=>({choiceId:c.id,amount:c.surfaces.some(s=>s.type==='object')?12:0})),submission=interactionSubmission({interactionId:o.interactionId,response:{type:'assignDamage',data:{mode:'normal',assignments}}});assert.equal(submission.response.data.assignments.length,1);assert.equal(e.submit_interaction_js(0,submission).status,'applied');t.passUntil(s=>s.phase==='PostCombatMain',20);assert.equal(state(e).players[1].life,20);assert.equal(state(e).objects[blocker].zone,'Graveyard');return {setupSha256,submission,receipt:t.receipt()};
});
await run('CPU resolves the legend rule using only public permanent summaries',()=>{
 const f=prepare(e,deck('Forest','Ghalta, Primal Hunger','Ghalta, Primal Hunger'),deck('Forest'));f.move('Forest',0,'Battlefield',2);const [old]=f.move('Ghalta, Primal Hunger',0,'Battlefield'),[fresh]=f.move('Ghalta, Primal Hunger',0,'Hand');const setupSha256=f.restore(),t=tracker(e);cast(t,fresh);assert.equal(state(e).waiting_for.type,'ChooseLegend');const rows=candidates(e);assert.equal(rows.length,1);const row=rows[0],packet=cpuPacket(projectSeat(e.get_filtered_game_state(row.actor),row.actor),row.actions),proposal=chooseVisible(packet,123);assert.equal(row.actions[proposal.index].type,'ChooseLegend');t.submit(row.actor,row.actions[proposal.index]);assert.equal([old,fresh].filter(id=>state(e).objects[id].zone==='Battlefield').length,1);assert.equal([old,fresh].filter(id=>state(e).objects[id].zone==='Graveyard').length,1);assert(!JSON.stringify(packet).includes('Ghalta'));return {setupSha256,packet,receipt:t.receipt()};
});
await run('Tapestry Warden attacks without tapping and deals damage using toughness',()=>{
 const f=prepare(e,deck('Forest','Tapestry Warden'),deck('Forest'));const [id]=f.move('Tapestry Warden',0,'Battlefield');const setupSha256=f.restore(),t=tracker(e);combat(t,id);assert.equal(state(e).objects[id].tapped,false);assert.equal(state(e).players[1].life,16);return {setupSha256,life:state(e).players.map(p=>p.life),receipt:t.receipt()};
});
await run('Virulent Emissary gains life for another entering creature',()=>{
 const f=prepare(e,deck('Forest','Virulent Emissary','Bear Cub'),deck('Forest'));f.move('Virulent Emissary',0,'Battlefield');f.move('Forest',0,'Battlefield',2);const [id]=f.move('Bear Cub',0,'Hand');const setupSha256=f.restore(),t=tracker(e);cast(t,id);assert.equal(state(e).players[0].life,21);return {setupSha256,life:state(e).players.map(p=>p.life),receipt:t.receipt()};
});
await run('Virulent Emissary deathtouch kills a larger blocker',()=>{
 const f=prepare(e,deck('Forest','Virulent Emissary'),deck('Forest','Ordinary Bear'));const [attacker]=f.move('Virulent Emissary',0,'Battlefield'),[blocker]=f.move('Ordinary Bear',1,'Battlefield');const setupSha256=f.restore(),t=tracker(e);combat(t,attacker,blocker);assert.equal(state(e).objects[blocker].zone,'Graveyard');assert.equal(state(e).objects[attacker].zone,'Graveyard');return {setupSha256,receipt:t.receipt()};
});
for(const name of ['Lashwhip Predator','Scarecrow Guide'])await run(name+' can block an actual flying attacker',()=>{
 const f=prepare(e,deck('Forest','Air Elemental'),deck('Forest',name));const [attacker]=f.move('Air Elemental',0,'Battlefield'),[blocker]=f.move(name,1,'Battlefield');const setupSha256=f.restore(),t=tracker(e);combat(t,attacker,blocker);assert.equal(state(e).players[1].life,20);assert.equal(state(e).objects[attacker].zone,name==='Lashwhip Predator'?'Graveyard':'Battlefield');return {setupSha256,receipt:t.receipt()};
});
report.passed=report.cases.every(c=>c.passed);assert.equal(networkCalls,0);report.networkCalls=0;report.sourceSha256=sha(await readFile(new URL(import.meta.url)));await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,cases:report.cases.length}));if(!report.passed)process.exitCode=1;
