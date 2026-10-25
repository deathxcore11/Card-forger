// Engineered Pithing Needle position; real delivered-runtime card-name route.
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
const names=['forest','pithing needle','basalt monolith'],subset=Object.fromEntries(names.map(n=>{assert(catalog[n]);return [n,catalog[n]];}));
let requests=0;globalThis.fetch=async()=>{requests++;throw Error('Network forbidden');};const networkCalls=()=>requests;
const e=await import(pathToFileURL(resolve(pkg,'engine_wasm.js')));await e.default({module_or_path:wasm});assert.equal(e.load_card_database(JSON.stringify(subset)),3);
const provenance={archiveSha,wasm:sha(wasm),glue:sha(glue),rulesGzip:sha(gzip),subsetSha:sha(JSON.stringify(subset)),sourceCommit:receipt.sourceCommit,sourceTree:receipt.sourceTree,sourceVerification:'Archive-bound historical receipt; source Git checkout not reverified in this run'};
let saved=null,seq=0;
const engine={humanSeat:0,start(){
 const f=prepare(e,deck('Forest','Pithing Needle'),deck('Forest'));f.move('Forest',0,'Battlefield',4);const [card]=f.move('Pithing Needle',0,'Hand');f.restore();
 assert.equal(submitHumanCommand(e,{kind:'cast',instanceId:card,payment:'auto'}),true);
 for(let i=0;i<8&&state(e).waiting_for.type==='Priority';i++){
  const actor=state(e).waiting_for.data.player,action=e.get_legal_actions_for_viewer_js(actor).actions.find(a=>a.type==='PassPriority');assert(action);assert.equal(e.submit_action(actor,action).status,'applied');
 }
 assert.equal(state(e).waiting_for.type,'NamedChoice');
},save:()=>e.export_game_state_json(),restore:s=>e.restore_game_state(s),summary:()=>({interaction:projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0)}),respond:s=>{const r=e.submit_interaction_js(0,s);assert(['applied','rejected'].includes(r.status));return r.status==='applied';}};
const open=()=>createJournal({engine,storage:{read:async()=>structuredClone(saved),write:async(n,expected)=>{assert.equal(saved?.revision??null,expected);saved=structuredClone(n);}},choose:()=>assert.fail('No AI candidate membership'),version:'text-proof',epoch:'text'});
let h=open();const send=async(op,fields={})=>{const r=await h({v:1,epoch:'text',id:'n-'+(++seq),op,...fields});assert(r.ok,JSON.stringify(r));return r.result;};
let r=await send('create',{seed:1,first:0}),o=r.interaction.opportunities.find(o=>o.type==='text');assert(o);
const submission=()=>({interactionId:o.interactionId,response:{type:'text',data:{value:'Basalt Monolith'}}});
const before=signature(e);r=await send('respond',{revision:r.revision,submission:{interactionId:o.interactionId,response:{type:'text',data:{value:'Not A Loaded Card 987654'}}}});assert(r.rejected);assert.deepEqual(signature(e),before);
const stale=submission();h=open();r=await send('resume');assert.deepEqual(signature(e),before);r=await send('respond',{revision:r.revision,submission:stale});assert(r.rejected);assert.deepEqual(signature(e),before);
o=r.interaction.opportunities.find(o=>o.type==='text');assert(o);const id='text-accepted',revision=r.revision,accepted=submission();
let reply=await h({v:1,epoch:'text',id,op:'respond',revision,submission:accepted});assert(reply.ok);assert(!reply.result.rejected);assert.notEqual(state(e).waiting_for.type,'NamedChoice');
const needle=Object.values(state(e).objects).find(o=>o.name==='Pithing Needle');assert.equal(needle.zone,'Battlefield');assert(JSON.stringify(needle).includes('Basalt Monolith'));
const after=signature(e);h=open();await send('resume');reply=await h({v:1,epoch:'text',id,op:'respond',revision,submission:accepted});assert(reply.ok);assert.deepEqual(signature(e),after);assert.equal(networkCalls(),0);
const report={provenance,checks:['Pithing Needle resolves to real card-name prompt','text prompt projected only to authorized seat','unknown card name rejected without mutation','pending name prompt restores without a move','stale capability rejected without mutation','explicit Basalt Monolith name accepted without AI candidate membership','Needle enters battlefield retaining chosen name','duplicate receipt after restore cannot submit twice'],revision:saved.revision,networkCalls:networkCalls(),sourceSha256:Object.fromEntries(await Promise.all(['text-controls-engine.mjs','interaction-surface.mjs','worker-journal.mjs','human-command.mjs','runtime-assets.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))]))),limits:'Engineered Pithing Needle naming, not inhibition-effect coverage, all card-name rules, browser interaction or a real account match. Source tree provenance is from the exact verified archive receipt, not a fresh source checkout verification.'};
await mkdir('test-results/text-controls',{recursive:true});await writeFile('test-results/text-controls/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
