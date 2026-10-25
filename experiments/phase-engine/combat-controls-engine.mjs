// Engineered Pithing Needle position; real delivered-runtime card-name route.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {sha} from './mechanics-inputs.mjs';
import {prepare,deck,state,signature,tracker} from './mechanics-fixtures.mjs';
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

const results=[];
for(const mode of ['attack','block']){
 let saved=null,seq=0;const seat=0;
 const engine={humanSeat:seat,start(){
  const guardSeat=mode==='attack'?1:0;
  const lists=[0,1].map(seat=>deck('Forest',...(seat===guardSeat?['Palace Guard']:[]),...Array(4).fill('Grizzly Bears')));
  const f=prepare(e,...lists);f.move('Grizzly Bears',0,'Battlefield',4);f.move('Palace Guard',guardSeat,'Battlefield');f.move('Grizzly Bears',1,'Battlefield',4);f.restore();
  const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers',12);
  if(mode==='block'){t.take('DeclareAttackers',a=>a.data.attacks.length===0);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers'&&s.active_player===1,40);t.take('DeclareAttackers',a=>a.data.attacks.length===4);t.passUntil(s=>s.waiting_for.type==='DeclareBlockers',12);}
 },save:()=>e.export_game_state_json(),restore:s=>e.restore_game_state(s),summary:()=>({interaction:projectInteraction(e.get_viewer_snapshot_js(seat).viewerInteraction,seat)}),respond:s=>{const r=e.submit_interaction_js(seat,s);assert(['applied','rejected'].includes(r.status));return r.status==='applied';}};
 const start=engine.start;engine.start=()=>{try{return start();}catch(err){console.error(err);throw err;}};
 const open=()=>createJournal({engine,storage:{read:async()=>structuredClone(saved),write:async(n,expected)=>{assert.equal(saved?.revision??null,expected);saved=structuredClone(n);}},choose:()=>assert.fail('No AI membership'),version:'combat-'+mode,epoch:mode});
 let h=open();const send=async(op,fields={})=>{const r=await h({v:1,epoch:mode,id:'c-'+(++seq),op,...fields});assert(r.ok,JSON.stringify(r));return r.result;};
 let status=await send('create',{seed:1,first:0}),o=status.interaction.opportunities.find(o=>o.type==='relations');assert(o);
 const make=()=>{if(mode==='attack')return o.edges.slice(0,2).map(edge=>({sourceId:edge.sourceId,targetId:edge.targetIds[0],group:null}));const guard=o.choices.find(c=>c.surfaces.some(s=>s.name==='Palace Guard')),edge=o.edges.find(e=>e.sourceId===guard.id);assert(edge.targetIds.length>=2);return edge.targetIds.slice(0,2).map(targetId=>({sourceId:guard.id,targetId,group:null}));};
 const submit=relations=>({interactionId:o.interactionId,response:{type:'relations',data:{relations}}});
 const before=signature(e),stale=submit(make());
 status=await send('respond',{revision:status.revision,submission:submit([{sourceId:o.edges[0].sourceId,targetId:'not-a-capability',group:null}])});assert(status.rejected);assert.deepEqual(signature(e),before);
 h=open();status=await send('resume');assert.deepEqual(signature(e),before);status=await send('respond',{revision:status.revision,submission:stale});assert(status.rejected);assert.deepEqual(signature(e),before);
 o=status.interaction.opportunities.find(o=>o.type==='relations');const relations=make();
 // Prove these assignments are absent from the small generated candidate set.
 const candidates=e.get_legal_actions_for_viewer_js(seat).actions;
 if(mode==='attack')assert(!candidates.some(a=>a.type==='DeclareAttackers'&&a.data.attacks.length===2));
 if(mode==='block'){const bear=o.choices.find(c=>c.surfaces.some(s=>s.name==='Grizzly Bears')&&o.edges.some(edge=>edge.sourceId===c.id)),edge=o.edges.find(edge=>edge.sourceId===bear.id);const illegal=edge.targetIds.slice(0,2).map(targetId=>({sourceId:bear.id,targetId,group:null}));assert.equal(illegal.length,2);status=await send('respond',{revision:status.revision,submission:submit(illegal)});assert(status.rejected);assert.deepEqual(signature(e),before);}
 const revision=status.revision,id='accepted-'+mode;const reply=await h({v:1,epoch:mode,id,op:'respond',revision,submission:submit(relations)});assert(reply.ok);assert(!reply.result.rejected);
 const after=signature(e);assert.notDeepEqual(after,before);assert.equal(state(e).waiting_for.type,'Priority');
 if(mode==='attack')assert.equal(state(e).combat.attackers.length,2);
 else {const assignments=Object.values(state(e).combat.blocker_to_attacker);assert.equal(assignments.length,1);assert.equal(assignments[0].length,2);assert.equal(state(e).combat.attackers.filter(a=>a.blocked).length,2);}
 h=open();await send('resume');const dup=await h({v:1,epoch:mode,id,op:'respond',revision,submission:submit(relations)});assert(dup.ok);assert.deepEqual(signature(e),after);
 results.push({mode,assignments:relations.length,candidates:candidates.length,revision:saved.revision,checks:['invalid target rejects unchanged','pending combat restores','stale capability rejects unchanged','explicit relations accepted without AI membership','duplicate receipt does not repeat combat']});
}
assert.equal(networkCalls(),0);
const report={provenance,results,networkCalls:networkCalls(),limits:'Engineered four-Bears attack subset and Palace Guard multi-block positions, not all combat restrictions, banding, browser controls, eligible real decks or full account match.',sourceSha256:Object.fromEntries(await Promise.all(['combat-controls-engine.mjs','interaction-surface.mjs','worker-journal.mjs','runtime-assets.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])))};
await mkdir('test-results/combat-controls',{recursive:true});await writeFile('test-results/combat-controls/engine.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
