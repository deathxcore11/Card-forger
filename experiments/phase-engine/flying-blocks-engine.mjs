// Engineered combat positions using unchanged delivered-runtime definitions.
// These setups are NOT legal full-game histories or a format/deck certificate.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {gunzipSync} from 'node:zlib';
import {sha,PIN} from './mechanics-inputs.mjs';
import {prepare,deck,state,signature,tracker} from './mechanics-fixtures.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {RUNTIME_IDENTITY,RULES_IDENTITY} from './runtime-assets.mjs';
const inputs=resolve(process.env.CARDSTASHY_VERIFICATION_INPUTS||'verification-inputs'),pkg=resolve(process.env.CARDSTASHY_PHASE_PKG||resolve(inputs,'pkg')),output=resolve(process.env.CARDSTASHY_FLYING_OUTPUT||'test-results/flying-blocks');
const [receiptBytes,wasm,glue,gzip]=await Promise.all([readFile(resolve(inputs,'build-receipt.json')),readFile(resolve(pkg,'engine_wasm_bg.wasm')),readFile(resolve(pkg,'engine_wasm.js')),readFile(resolve(inputs,'integration_cards.json.gz'))]);
const receipt=JSON.parse(receiptBytes);assert.equal(receipt.schemaVersion,1);assert.equal(receipt.upstreamCommit,PIN);assert.equal(receipt.sourceCommit,'5169f7fe03f93a6afe36fec767c3cda10120dcdd');assert.equal(receipt.sourceTree,RUNTIME_IDENTITY.sourceTree);assert.equal(receipt.sourceDiffSha256,'b8a5b0efb91b10d8930252bfe522a07e8ba95030436aa5b5419478a42a2cdb5d');
assert.equal(sha(wasm),RUNTIME_IDENTITY.wasmSha256);assert.equal(sha(wasm),receipt.wasmSha256);assert.equal(sha(glue),RUNTIME_IDENTITY.glueSha256);assert.equal(sha(glue),receipt.glueSha256);assert.equal(sha(gzip),RULES_IDENTITY.sha256);assert.equal(sha(gzip),receipt.integrationFixtureGzipSha256);
const decoded=gunzipSync(gzip);assert.equal(sha(decoded),RULES_IDENTITY.decodedSha256);const catalog=JSON.parse(decoded);assert.equal(Object.keys(catalog).length,RULES_IDENTITY.entries);
const names=['Forest','Grizzly Bears','Air Elemental','Scarecrow Guide'],subset=Object.fromEntries(names.map(name=>{const key=name.toLowerCase();assert(Object.hasOwn(catalog,key),'Missing unchanged fixture '+name);return [key,catalog[key]];}));
assert(subset['air elemental'].keywords.includes('Flying'));assert(subset['scarecrow guide'].keywords.includes('Reach'));assert(!subset['grizzly bears'].keywords.includes('Flying'));assert(!subset['grizzly bears'].keywords.includes('Reach'));
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('Network forbidden in flying/blocking diagnostic');};
const e=await import(pathToFileURL(resolve(pkg,'engine_wasm.js')));await e.default({module_or_path:wasm});assert.equal(e.load_card_database(JSON.stringify(subset)),names.length);
const report={passed:false,provenance:{buildIdentity:receipt.buildIdentity,sourceCommit:receipt.sourceCommit,sourceTree:receipt.sourceTree,sourceDiffSha256:receipt.sourceDiffSha256,buildReceiptSha256:sha(receiptBytes),wasmSha256:sha(wasm),glueSha256:sha(glue),rulesGzipSha256:sha(gzip),rulesDecodedSha256:sha(decoded),fixtureEntries:RULES_IDENTITY.entries,loadedNames:names,subsetSha256:sha(JSON.stringify(subset)),sourceVerification:'Delivered bytes match pinned identities and retained build receipt. Source checkout/archive was not reverified in this run.'},cases:[],limits:'Three engineered two-player Vintage combat positions (ground-rejection case includes a ground control attacker and legal flying control blocker to expose authentic combat capabilities), not complete legal histories, eligible real Standard/Commander decks, UI gesture tests, CPU tactics, all combat mechanics or broad card coverage.'};
const semantic=()=>sha(JSON.stringify({...signature(e),combat:state(e).combat,damageAndCounters:Object.values(state(e).objects).map(o=>({id:o.id,damage:o.damage_marked,counters:o.counters}))}));
const hasName=(choice,name)=>choice.surfaces.some(s=>s.type==='object'&&s.name===name);
async function run(name,body){try{const result=await body();report.cases.push({name,passed:true,...result});console.log(name+': PASS');}catch(error){report.cases.push({name,passed:false,error:String(error.stack||error)});console.log(name+': FAIL '+error.message);}}
for(const blocker of ['Grizzly Bears','Air Elemental','Scarecrow Guide'])await run(blocker+(blocker==='Grizzly Bears'?' cannot block a flying attacker':' can block a flying attacker'),()=>{
 const f=prepare(e,deck('Forest',blocker,...(blocker==='Grizzly Bears'?['Air Elemental']:[])),deck('Forest','Air Elemental',...(blocker==='Grizzly Bears'?['Grizzly Bears']:[]))),[defender]=f.move(blocker,0,'Battlefield'),[attacker]=f.move('Air Elemental',1,'Battlefield');
 const groundAttacker=blocker==='Grizzly Bears'?f.move('Grizzly Bears',1,'Battlefield')[0]:null;
 if(blocker==='Grizzly Bears')f.move('Air Elemental',0,'Battlefield'); // legal control blocker exposes the flyer's authentic target capability
 f.s.active_player=1;f.s.priority_player=1;f.s.waiting_for={type:'Priority',data:{player:1}};const setupSha256=f.restore(),t=tracker(e);
 for(const seat of [0,1])t.submit(seat,{type:'SetPriorityPassingMode',data:{mode:'FullControl'}},{requireCandidate:false});
 t.passUntil(s=>s.waiting_for.type==='DeclareAttackers',12);assert.equal(state(e).active_player,1);t.take('DeclareAttackers',a=>a.data.attacks.length===(groundAttacker===null?1:2)&&a.data.attacks.some(a=>a[0]===attacker)&&(groundAttacker===null||a.data.attacks.some(a=>a[0]===groundAttacker)));t.passUntil(s=>s.waiting_for.type==='DeclareBlockers',12);
 const raw=e.get_viewer_snapshot_js(0).viewerInteraction,view=projectInteraction(raw,0),o=view.opportunities.find(o=>o.type==='relations');assert(view.canSubmit);assert(o,'engine must publish explicit blocker relations');
 const sources=new Set(o.edges.map(edge=>edge.sourceId));
 const source=o.choices.find(c=>hasName(c,blocker)&&sources.has(c.id))||o.choices.find(c=>hasName(c,blocker));assert(source,'blocker instance must have an engine capability');
 const target=o.choices.find(c=>c.id!==source.id&&hasName(c,'Air Elemental')&&o.edges.some(edge=>edge.targetIds.includes(c.id)));assert(target,'flying attacker must have an engine capability');
 const offered=o.edges.some(edge=>edge.sourceId===source.id&&edge.targetIds.includes(target.id)),before=semantic(),submission={interactionId:o.interactionId,response:{type:'relations',data:{relations:[{sourceId:source.id,targetId:target.id,group:null}]}}};
 const reply=e.submit_interaction_js(0,submission);
 if(blocker==='Grizzly Bears'){
  assert.equal(offered,false,'ground creature cannot be offered a legal edge to a flying attacker');assert.equal(reply.status,'rejected','actual engine must reject the ground/flying assignment');assert.equal(semantic(),before,'rejected block must preserve semantic state, combat, damage, counters and RNG');assert.equal(state(e).waiting_for.type,'DeclareBlockers');
  // A separate ground attacker gives the Bear a legal ground block, keeping
  // the blocker window open. It still cannot be assigned to the flyer.
  assert(o.edges.some(edge=>edge.sourceId===source.id&&edge.targetIds.some(id=>o.choices.some(c=>c.id===id&&c.id!==source.id&&hasName(c,'Grizzly Bears')))),'ground Bear must have a legal edge to the separate ground attacker');
  // Explicitly declare no blocks and verify that the flying attacker deals its
  // actual power to the player, rather than silently accepting the Bear.
  const refreshed=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0).opportunities.find(x=>x.type==='relations');const noBlocks=e.submit_interaction_js(0,{interactionId:refreshed.interactionId,response:{type:'relations',data:{relations:[]}}});assert.equal(noBlocks.status,'applied');
 }else{
  assert.equal(offered,true,'flying/reach blocker must receive a legal engine edge');assert.equal(reply.status,'applied');assert.equal(state(e).waiting_for.type,'Priority');const assignments=state(e).combat.blocker_to_attacker[defender];assert(Array.isArray(assignments)&&assignments.includes(attacker),'accepted relations must be recorded as an actual combat assignment');assert(state(e).combat.attackers.find(a=>a.object_id===attacker)?.blocked);
 }
 t.passUntil(s=>s.phase==='PostCombatMain',24);
 if(blocker==='Grizzly Bears'){assert.deepEqual(state(e).players.map(p=>p.life),[14,20]);assert.equal(state(e).objects[defender].zone,'Battlefield');}
 else{assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);assert.equal(state(e).objects[defender].zone,'Graveyard');if(blocker==='Air Elemental')assert.equal(state(e).objects[attacker].zone,'Graveyard');else{assert.equal(state(e).objects[attacker].zone,'Battlefield');assert.equal(state(e).objects[attacker].damage_marked,2);}}
 return {setupSha256,blocker,attacker:'Air Elemental',publishedLegalEdge:offered,explicitRelationStatus:reply.status,rejectedStateUnchanged:blocker==='Grizzly Bears',finalLife:state(e).players.map(p=>p.life),finalSemanticSha256:semantic(),setupAndPriorityTrace:t.receipt(),checks:blocker==='Grizzly Bears'?['no legal ground-to-flying edge','explicit illegal relation rejected','semantic state/combat/RNG unchanged','unblocked flyer plus ground control attacker deal four plus two to defender']:['legal flying/reach-to-flying edge','explicit relation accepted','real blocker assignment and blocked flag','combat damage preserves defending player life']};
});
report.passed=report.cases.every(c=>c.passed);assert.equal(networkCalls,0);report.networkCalls=networkCalls;report.sourceSha256=Object.fromEntries(await Promise.all(['flying-blocks-engine.mjs','mechanics-fixtures.mjs','mechanics-inputs.mjs','interaction-surface.mjs','runtime-assets.mjs'].map(async file=>[file,sha(await readFile(new URL(file,import.meta.url)))])));
await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
