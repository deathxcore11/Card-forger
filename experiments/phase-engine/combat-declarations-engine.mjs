// Engineered human attack/block relationship choices on exact delivered bytes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {sha} from './mechanics-inputs.mjs';
import {prepare,deck,state,signature} from './mechanics-fixtures.mjs';
import {createJournal} from './worker-journal.mjs';
import {projectInteraction} from './interaction-surface.mjs';
import {submitHumanCommand} from './human-command.mjs';
// Delivered-byte verification is independent of a surviving source checkout.
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {RUNTIME_IDENTITY,RULES_IDENTITY} from './runtime-assets.mjs';
const archive=process.env.CARDSTASHY_DELIVERED_ARCHIVE,pkg=process.env.CARDSTASHY_PHASE_PKG,fixture=process.env.CARDSTASHY_RULES_GZIP;
assert(archive&&pkg&&fixture,'Set delivered archive, pkg and rules gzip paths');
const archiveSha=sha(await readFile(archive));assert.equal(archiveSha,'edb82685e8f71de64006da5f8cd188d738939c106ae19d67ad4281158cff513b');
const receipt=JSON.parse(execFileSync('python',['-c','import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read("build-receipt.json").decode())',archive],{encoding:'utf8'}));
assert.equal(receipt.sourceCommit,'5169f7fe03f93a6afe36fec767c3cda10120dcdd');assert.equal(receipt.sourceTree,RUNTIME_IDENTITY.sourceTree);
const wasm=await readFile(resolve(pkg,'engine_wasm_bg.wasm')),glue=await readFile(resolve(pkg,'engine_wasm.js')),gzip=await readFile(fixture);
assert.equal(sha(wasm),RUNTIME_IDENTITY.wasmSha256);assert.equal(sha(wasm),receipt.wasmSha256);assert.equal(sha(glue),RUNTIME_IDENTITY.glueSha256);assert.equal(sha(glue),receipt.glueSha256);assert.equal(sha(gzip),RULES_IDENTITY.sha256);
const decoded=gunzipSync(gzip);assert.equal(sha(decoded),RULES_IDENTITY.decodedSha256);const catalog=JSON.parse(decoded);assert.equal(Object.keys(catalog).length,6137);
const names=['forest','grizzly bears','palace guard'],subset=Object.fromEntries(names.map(n=>{assert(catalog[n]);return [n,catalog[n]];}));
let requests=0;globalThis.fetch=async()=>{requests++;throw Error('Network forbidden');};const networkCalls=()=>requests;
const e=await import(pathToFileURL(resolve(pkg,'engine_wasm.js')));await e.default({module_or_path:wasm});assert.equal(e.load_card_database(JSON.stringify(subset)),3);
const provenance={archiveSha,wasm:sha(wasm),glue:sha(glue),rulesGzip:sha(gzip),subsetSha:sha(JSON.stringify(subset)),sourceCommit:receipt.sourceCommit,sourceTree:receipt.sourceTree,sourceVerification:'Archive-bound historical receipt; source Git checkout not reverified in this run'};
import {tracker} from './mechanics-fixtures.mjs';
const results=[];
async function scenario(blocking){
 let durable=null,n=0,humans,enemy,guard;
 const adapter={humanSeat:0,start(){
  const f=prepare(e,deck('Forest',...Array(4).fill('Grizzly Bears'),'Palace Guard'),deck('Forest',...Array(4).fill('Grizzly Bears')));
  humans=f.move('Grizzly Bears',0,'Battlefield',4);[guard]=f.move('Palace Guard',0,'Battlefield');enemy=f.move('Grizzly Bears',1,'Battlefield',4);
  if(blocking){f.s.active_player=1;f.s.priority_player=1;f.s.waiting_for={type:'Priority',data:{player:1}};}f.restore();
  const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers',12);
  if(blocking){const attacks=enemy.slice(0,2).map(id=>[id,{type:'Player',data:0}]);t.submit(1,{type:'DeclareAttackers',data:{attacks,bands:[]}},{requireCandidate:false});t.passUntil(s=>s.waiting_for.type==='DeclareBlockers',12);}
 },save:()=>e.export_game_state_json(),restore:s=>e.restore_game_state(s),summary:()=>({interaction:projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0)}),respond:s=>{const r=e.submit_interaction_js(0,s);assert(['applied','rejected'].includes(r.status));return r.status==='applied';}};
 const open=()=>createJournal({engine:adapter,storage:{read:async()=>structuredClone(durable),write:async(v,expected)=>{assert.equal(durable?.revision??null,expected);durable=structuredClone(v);}},choose:()=>assert.fail('Human relationship selections cannot depend on AI membership'),version:'combat-proof',epoch:'combat'});
 let h=open();const send=async(op,extra={})=>{const r=await h({v:1,epoch:'combat',id:'c-'+(++n),op,...extra});assert(r.ok,JSON.stringify(r));return r.result;};
 let r=await send('create',{seed:12345,first:0}),o=r.interaction.opportunities.find(o=>o.type==='relations');assert(o);
 const byReference=id=>o.choices.find(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(id)))?.id;
 const pair=(source,target)=>({sourceId:byReference(source),targetId:target==='cpu'?o.choices.find(c=>c.surfaces.some(s=>s.type==='player'&&s.seat===1)).id:byReference(target),group:null});
 const good=()=>blocking?[pair(guard,enemy[0]),pair(guard,enemy[1])]:[pair(humans[0],'cpu'),pair(humans[2],'cpu')];
 const sub=relations=>({interactionId:o.interactionId,response:{type:'relations',data:{relations}}});
 const before=signature(e);const malformed=sub([{sourceId:'forged-source',targetId:good()[0].targetId,group:null}]);r=await send('respond',{revision:r.revision,submission:malformed});assert(r.rejected);assert.deepEqual(signature(e),before);
 if(blocking){r=await send('respond',{revision:r.revision,submission:sub([pair(humans[0],enemy[0]),pair(humans[0],enemy[1])])});assert(r.rejected,'ordinary Bear cannot block two attackers');assert.deepEqual(signature(e),before);}
 const stale=sub(good());h=open();r=await send('resume');assert.deepEqual(signature(e),before);r=await send('respond',{revision:r.revision,submission:stale});assert(r.rejected);assert.deepEqual(signature(e),before);o=r.interaction.opportunities.find(o=>o.type==='relations');assert(o);
 let absentFromCandidates=false;
 if(!blocking){const wanted=[humans[0],humans[2]].sort((a,b)=>a-b);absentFromCandidates=!e.get_legal_actions_for_viewer_js(0).actions.some(a=>a.type==='DeclareAttackers'&&JSON.stringify(a.data.attacks.map(x=>x[0]).sort((a,b)=>a-b))===JSON.stringify(wanted));assert(absentFromCandidates,'must test a legal human selection outside enumerated AI combinations');}
 const request={v:1,epoch:'combat',id:'accept-combat',op:'respond',revision:r.revision,submission:sub(good())};const accepted=await h(request);assert(accepted.ok);assert(!accepted.result.rejected);
 const after=signature(e),combat=structuredClone(state(e).combat);
 if(!blocking){assert.deepEqual(combat.attackers.map(a=>a.object_id).sort((a,b)=>a-b),[humans[0],humans[2]].sort((a,b)=>a-b));assert.equal(state(e).objects[humans[0]].tapped,true);assert.equal(state(e).objects[humans[2]].tapped,true);assert.equal(state(e).objects[humans[1]].tapped,false);}
 else{assert.deepEqual(combat.blocker_to_attacker[String(guard)].slice().sort((a,b)=>a-b),enemy.slice(0,2).sort((a,b)=>a-b));for(const attacker of combat.attackers)assert.equal(attacker.blocked,true);}
 h=open();await send('resume');assert.deepEqual(await h(request),accepted);assert.deepEqual(signature(e),after);assert.equal(durable.revision,1);assert.equal(networkCalls(),0);
 results.push({kind:blocking?'special-multiple-blocking':'noncandidate-attack-subset',revision:durable.revision,absentFromCandidates,combat,checks:['foreign endpoint rejected without mutation','pending combat prompt recovery','stale capability rejected','chosen pairs accepted by actual engine','duplicate accepted receipt recovery'],...(blocking?{ordinaryMultiBlockRejected:true}:{})});
}
await scenario(false);await scenario(true);
const report={provenance,results,networkCalls:networkCalls(),sourceSha256:Object.fromEntries(await Promise.all(['combat-declarations-engine.mjs','interaction-surface.mjs','worker-journal.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))]))),limits:'Two engineered combat declarations, not complete combat/damage/banding/planeswalker/must-attack coverage, calibrated CPU or real account-deck acceptance.'};await mkdir('test-results/combat-declarations',{recursive:true});await writeFile('test-results/combat-declarations/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
