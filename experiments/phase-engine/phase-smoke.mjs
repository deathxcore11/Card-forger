// Research-only legal-action smoke policy. Not a CardStashy difficulty profile.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const pin='71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234';
assert(process.env.CARDSTASHY_PHASE_PKG&&process.env.CARDSTASHY_PHASE_SOURCE,
 'Set CARDSTASHY_PHASE_PKG and CARDSTASHY_PHASE_SOURCE; see README.md.');
const root=resolve(process.env.CARDSTASHY_PHASE_OUTPUT||'test-results/phase-engine');
const pkg=resolve(process.env.CARDSTASHY_PHASE_PKG),source=resolve(process.env.CARDSTASHY_PHASE_SOURCE);
await mkdir(root,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(await readFile(resolve(pkg,'engine_wasm.js'))),
 '47c42e78d34eeaad37d74b8163e5319d0578ba0ee8bd3476cfb70131de6287c9');
const wasm=await readFile(resolve(pkg,'engine_wasm_bg.wasm'));
assert.equal(sha(wasm),'6057521d851bb8544eaeea467f741b90cd2941aa5ba2fddb17e1bcc3d9933f8f');
const db=await readFile(resolve(source,'crates/engine/tests/fixtures/runtime_card_export_fixture.json'),'utf8');
assert.equal(sha(db),'ee062b8ad351e067723b79fc8462aaea19202ef9756d35b2101334eb3e350107');
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('Network forbidden.');};
const engine=await import(pathToFileURL(resolve(pkg,'engine_wasm.js')));await engine.default({module_or_path:wasm});assert.equal(engine.load_card_database(db),3);
const format=engine.getFormatRegistry().find(f=>f.format==='Modern').default_config;
const decks={player:{main_deck:[...Array(56).fill('Forest'),...Array(4).fill('Grizzly Bears')]},opponent:{main_deck:[...Array(57).fill('Forest'),...Array(3).fill('Grizzly Bears')]}};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function score(a){
 if(a.type==='MulliganDecision')return a.data.choice.type==='Keep'?1000:-100;
 if(a.type==='PlayLand')return 900;
 if(a.type==='CastSpell')return 800;
 if(a.type==='DeclareAttackers')return 500+(a.data.attacks?.length||0)*20;
 if(a.type==='DeclareBlockers')return 400+(a.data.assignments?.length||0)*20;
 if(a.type==='PassPriority')return 0;
 if(a.type==='ActivateAbility')return -50;
 if(a.type==='CancelCast')return -100;
 return 10;
}
// This function uses only legal choices and its independent policy RNG.
// It is not an isolated worker or a security/privacy certification.
// This deliberately simple policy does not establish a contextual CPU.
function choose(actions,policy){
 const best=Math.max(...actions.map(score)),choices=actions.filter(a=>score(a)===best);
 policy.rng=(Math.imul(policy.rng,1664525)+1013904223)>>>0;
 return choices[policy.rng%choices.length];
}
async function drive({seed=12345,first=0,snapshotAt=null,resume=null}={}){
 let policy={rng:0x63d34a91},history=[],snapshot=null,events={};
 if(resume){engine.restore_game_state(resume.engine);policy=resume.policy;}
 else{const init=engine.initialize_game(decks,seed,format,null,2,first);assert(Array.isArray(init.events),JSON.stringify(init));}
 for(let tick=0;tick<20000;tick++){
  const view=engine.get_filtered_game_state(0),state=view.state;
  assert(state&&Array.isArray(state.players),'valid engine state');
  if(state.waiting_for?.type==='GameOver')return {history,events,terminal:state.waiting_for,turn:state.turn_number,snapshot,policy};
  const legal=[0,1].map(seat=>engine.get_legal_actions_for_viewer_js(seat));
  const actor=legal.findIndex(l=>l.actions.length);assert(actor>=0,'no legal actor before terminal: '+JSON.stringify(state.waiting_for));
  const action=choose(structuredClone(legal[actor].actions),policy);
  assert(legal[actor].actions.some(a=>same(a,action)),'choice must be a member of current legal actions');
  const result=engine.submit_action(actor,action);
  assert(result.status==='applied'||result.status==='Applied',JSON.stringify({tick,actor,action,result}));
  history.push({actor,action});
  for(const e of result.result?.events||[])events[e.type]=(events[e.type]||0)+1;
  if(snapshotAt!==null&&history.length===snapshotAt){
   const waiting=engine.get_filtered_game_state(0).state.waiting_for;
   assert.equal(waiting.type,'Priority');
   snapshot={engine:engine.export_game_state_json(),policy:structuredClone(policy),seed,first,accepted:history.length,pending:waiting};
  }
 }
 throw Error('Smoke policy exceeded the explicit 20000-action ceiling.');
}
if(process.argv[2]==='--resume'){
 const saved=JSON.parse(await readFile(process.argv[3],'utf8')),game=await drive({resume:saved});
 console.log(JSON.stringify({history:game.history,terminal:game.terminal,turn:game.turn,networkCalls}));
}else{
 // Initial-position redaction checks are intentionally narrow, not the full
 // hidden-world equivalence/revealed-identity audit required for adoption.
 engine.initialize_game(decks,12345,format,null,2,0);
 const raw=engine.get_game_state().state,privacy=[];
 for(const seat of [0,1]){
  const f=engine.get_filtered_game_state(seat).state;
  assert.equal(f.rng_seed,0);assert.equal(f.rng_word_pos,0);
  const ids=[...f.players[0].library,...f.players[1].library,...f.players[1-seat].hand];
  for(const id of ids){const o=f.objects[String(id)];assert.equal(o.name,'Hidden Card');assert.equal(o.card_id,0);}
  privacy.push({seat,hiddenObjects:ids.length,hiddenNamesAndCardIdsRedacted:true,rngSeedAndPositionZero:true,
   orderedLibraryObjectIdsRetained:f.players.every((p,i)=>same(p.library,raw.players[i].library))});
 }
 const cases=[];
 for(const first of [0,1])for(const seed of [12345,67890,24680]){
  const start=performance.now(),game=await drive({seed,first,snapshotAt:first===0&&seed===12345?80:null});
  const trace=JSON.stringify(game.history);await writeFile(resolve(root,`actions-${seed}-${first}.json`),trace+'\n');
  const row={seed,first,acceptedTraceSha256:sha(trace),actions:game.history.length,turn:game.turn,terminal:game.terminal,events:game.events,milliseconds:Math.round(performance.now()-start)};
  if(game.snapshot){
   const path=resolve(root,'pending-choice-snapshot.json');await writeFile(path,JSON.stringify(game.snapshot));
   const child=spawnSync(process.execPath,[import.meta.filename,'--resume',path],{encoding:'utf8',maxBuffer:20*1024*1024});
   assert.equal(child.status,0,child.stderr||child.stdout);const resumed=JSON.parse(child.stdout.trim());
   assert.equal(resumed.networkCalls,0);assert.deepEqual(resumed.history,game.history.slice(80),'fresh process resumes the exact accepted action suffix');assert.deepEqual(resumed.terminal,game.terminal);assert.equal(resumed.turn,game.turn);
   row.coldProcessRestore={acceptedAtSave:80,pending:game.snapshot.pending,identicalSuffix:true,identicalOutcome:true,networkCalls:0};
  }
  cases.push(row);console.log(JSON.stringify(row));
 }
 assert.equal(networkCalls,0);
 await writeFile(resolve(root,'smoke-games-report.json'),JSON.stringify({upstreamCommit:pin,wasmSha256:sha(wasm),glueSha256:sha(await readFile(resolve(pkg,'engine_wasm.js'))),fixtureSha256:sha(db),runtime:process.version,initialRedactionChecks:privacy,policy:'ungraded legal-action smoke policy v0; no production CPU certification',fixture:'3 exported records; two land-heavy Modern lists',cases,networkCalls,limits:'Node/WASM and a fetch-failure guard only. Unequal land-heavy lists, no seat/deck strength benchmark; no browser cold-offline/device latency, isolated policy worker, full privacy/tactics audit, complete supported pool or 4.0 readiness proof.'},null,2)+'\n');
}
