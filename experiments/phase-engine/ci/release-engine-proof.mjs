// Inert unless manually dispatched for an exact owner-approved GitHub commit.
// Produces a separate proof artifact. Never adopts runtime bytes or deploys.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,readdir,stat,appendFile,rm} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {platform,arch,totalmem} from 'node:os';

const PIN='71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234';
const SHIPPED_TREE='60fc8715ad91f5c91b81f8a8335e238c623ec957';
const BASE_PATCH_SHA='b8a5b0efb91b10d8930252bfe522a07e8ba95030436aa5b5419478a42a2cdb5d';
// Replaced only after forward application against SHIPPED_TREE is verified.
const CANDIDATE_PATCH_SHA='a1188d35bfb3905dae06e5fda8b6fa4ed0dbc4cd8d0dbe19ee574ba211afc343';
const CANDIDATE_TREE='c8f2db24fd81f34821dddf69e5b7404fcf16412c';
const FIXTURE_SHA='0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9';
const TOOLCHAIN='nightly-2026-04-19',BINDGEN='0.2.121';
const MAX_ARTIFACT=256*1024*1024;
const sha=x=>createHash('sha256').update(x).digest('hex');
const workspace=resolve(process.env.GITHUB_WORKSPACE||process.cwd());
const git=(source,args,encoding='utf8')=>execFileSync('git',['-C',source,...args],{encoding,maxBuffer:32*1024*1024});
let child=null,deadline=0,logs;
async function command(name,bin,args,{cwd=workspace,env={},minutes=30}={}){
 const timeout=Math.min(minutes*60_000,deadline-Date.now());assert(timeout>0,'Overall build-proof deadline exhausted');
 const log=join(logs,name+'.log'),fd=openSync(log,'a');
 await appendFile(log,JSON.stringify({command:[bin,...args],startedAt:new Date().toISOString()})+'\n');
 await new Promise((ok,fail)=>{
  let finished=false,killTimer;
  child=spawn(bin,args,{cwd,env:{...process.env,...env},stdio:['ignore',fd,fd],detached:true});
  const current=child;
  const kill=signal=>{try{process.kill(-current.pid,signal);}catch{}};
  const timer=setTimeout(()=>{kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),5000);},timeout);
  const finish=(error)=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(killTimer);closeSync(fd);child=null;error?fail(error):ok();};
  current.once('error',finish);current.once('exit',(code,signal)=>finish(code===0?null:Error(name+' failed ('+(signal||code)+'); see '+log)));
 });
 return log;
}
async function inventory(dir,prefix=''){
 const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name),relative=prefix+entry.name;assert(!entry.isSymbolicLink(),'Artifact symlink forbidden');
  if(entry.isDirectory())out.push(...await inventory(path,relative+'/'));
  else {assert(entry.isFile());out.push({path:relative,bytes:(await stat(path)).size,sha256:sha(await readFile(path))});}
 }return out;
}
async function approve(){
 assert.equal(process.argv[2],'--approved-manual-build','No build without explicit manual invocation');
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');
 assert.equal(process.env.GITHUB_REPOSITORY,'deathxcore11/Card-forger');
 const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 assert.equal(event.repository?.private,true);assert.equal(event.inputs?.approval,'BUILD RELEASE ENGINE ONCE');
 assert(/^[0-9a-f]{40}$/.test(event.inputs?.expected_commit||''));assert.equal(event.inputs.expected_commit,process.env.GITHUB_SHA);
 assert.equal(git(workspace,['rev-parse','HEAD']).trim(),process.env.GITHUB_SHA);
 assert.equal(platform(),'darwin');assert.equal(arch(),'x64');assert.equal(process.versions.node.split('.')[0],'24');
 assert(totalmem()>=12*1024**3,'Existing proof guard requires at least 12 GiB; prior 8 GiB LLVM attempts OOM-killed');
 assert(/^[0-9a-f]{64}$/.test(CANDIDATE_PATCH_SHA)&&/^[0-9a-f]{40}$/.test(CANDIDATE_TREE),'Candidate source pins are incomplete');
}

// This function is serialized into an isolated child process, so an engine
// trap, long computation or failed assertion remains bounded by command().
async function verifyWasm(){
 const {default:assert}=await import('node:assert/strict');
 const {readFile,writeFile}=await import('node:fs/promises');
 const {gunzipSync}=await import('node:zlib');const {createHash}=await import('node:crypto');
 const {pathToFileURL}=await import('node:url');const {join}=await import('node:path');
 const [pkg,source,workspace,reportPath]=process.argv.slice(2);
 const digest=x=>createHash('sha256').update(x).digest('hex');
 const e=await import(pathToFileURL(join(pkg,'engine_wasm.js')));
 await e.default({module_or_path:await readFile(join(pkg,'engine_wasm_bg.wasm'))});
 assert.equal(typeof e.get_priority_capability_v1_js,'function','Required export absent');
 const catalog=JSON.parse(gunzipSync(await readFile(join(source,'crates/engine/tests/fixtures/integration_cards.json.gz'))));
 const names=['Forest','Swamp','Plains','Bane of the Living','Sol Ring','Ornithopter','Ram Through','Savannah Lions','Grizzly Bears'];
 const subset=Object.fromEntries(names.map(n=>{assert(catalog[n.toLowerCase()]);return[n.toLowerCase(),catalog[n.toLowerCase()]];}));
 assert.equal(e.load_card_database(JSON.stringify(subset)),names.length);
 globalThis.fetch=async()=>{throw Error('Network forbidden in runtime regression');};
 const {prepare,deck}=await import(pathToFileURL(join(workspace,'experiments/phase-engine/mechanics-fixtures.mjs')));
 const rows=[];const snapshot=()=>e.export_game_state_json();
 function check(name,body){try{const actual=body();rows.push({name,status:'PASS',actual});}catch(error){rows.push({name,status:'FAIL',error:String(error.stack)});}}
 function cap(viewer=0){const before=snapshot(),value=e.get_priority_capability_v1_js(viewer);assert.equal(snapshot(),before,'Capability mutated complete live save');return value;}
 function applied(actor,action){const r=e.submit_action(actor,action);assert.equal(r.status,'applied',JSON.stringify(r));return r;}
 function empty(){const f=prepare(e,deck('Forest'),deck('Forest'));f.restore();return f;}
 check('empty-window-read-only-and-accepted-pass',()=>{empty();const c=cap();assert.deepEqual(c,{version:1,status:'actionless',actor:0,priorityHolder:0,floatingMana:false,passVerified:true});const pass=e.get_legal_actions_for_viewer_js(0).actions.find(x=>x.type==='PassPriority');assert(pass);applied(0,pass);return c;});
 check('unauthorized-and-invalid-viewer-privacy',()=>{empty();const c=cap(1);assert.deepEqual(c,{version:1,status:'unknown',actor:null,priorityHolder:null,floatingMana:null,passVerified:false});assert.equal(cap(256),null);return c;});
 check('land-and-free-spell-stop',()=>{for(const name of ['Forest','Ornithopter']){const f=prepare(e,deck('Forest',...(name==='Forest'?[]:[name])),deck('Forest'));f.move(name,0,'Hand');f.restore();assert.notEqual(cap().status,'actionless');}return {cards:['Forest','Ornithopter']};});
 check('sol-ring-and-floating-mana-stop',()=>{const f=prepare(e,deck('Forest','Sol Ring'),deck('Forest'));const[id]=f.move('Sol Ring',0,'Battlefield');f.restore();assert.notEqual(cap().status,'actionless');const action=e.get_legal_actions_for_viewer_js(0).legalActionsByObject[id].find(x=>x.type==='ActivateAbility');assert(action);applied(0,action);assert.equal(e.get_game_state().state.players[0].mana_pool.mana.length,2);assert.equal(cap().floatingMana,true);return cap();});
 check('omitted-face-down-and-variable-x-actions-stop',()=>{const f=prepare(e,deck('Swamp','Bane of the Living'),deck('Forest'));const[id]=f.move('Bane of the Living',0,'Hand');f.move('Swamp',0,'Battlefield',8);f.restore();assert.notEqual(cap().status,'actionless');applied(0,{type:'PlayFaceDown',data:{object_id:id,card_id:e.get_game_state().state.objects[id].card_id}});assert.notEqual(cap().status,'actionless');applied(0,{type:'TurnFaceUp',data:{object_id:id,x:1}});return {acceptedActions:['PlayFaceDown','TurnFaceUp(x=1)']};});
 check('engineered-rejection-complete-save-atomicity',()=>{const f=prepare(e,deck('Plains','Savannah Lions','Ram Through'),deck('Forest','Grizzly Bears'));f.move('Plains',0,'Battlefield',2);f.move('Savannah Lions',0,'Battlefield');f.move('Grizzly Bears',1,'Battlefield');const[id]=f.move('Ram Through',0,'Hand');f.restore();const before=snapshot();assert(JSON.parse(before).state.zone_change_library_knowledge_stamps.length);const r=e.submit_action(0,{type:'CastSpell',data:{object_id:id,card_id:id,targets:[],payment_mode:{type:'Auto'}}});assert.equal(r.status,'rejected');assert.equal(snapshot(),before);return {beforeSha256:digest(before),afterSha256:digest(snapshot()),rejected:true};});
 check('natural-history-rejection-complete-save-atomicity',()=>{
  const decks={player:{main_deck:[...Array(52).fill('Plains'),...Array(4).fill('Savannah Lions'),...Array(4).fill('Ram Through')]},opponent:{main_deck:[...Array(56).fill('Forest'),...Array(4).fill('Grizzly Bears')]}};
  const init=e.initialize_game(decks,10,e.getFormatRegistry().find(x=>x.format==='Vintage').default_config,null,2,0);assert(Array.isArray(init.events));let reached=false;
  for(let n=0;n<180;n++){
   const before=snapshot(),s=JSON.parse(before).state;const own=s.battlefield.filter(id=>s.objects[id].controller===0&&s.objects[id].name==='Savannah Lions');const opposing=s.battlefield.filter(id=>s.objects[id].controller===1&&s.objects[id].name==='Grizzly Bears');const lands=s.battlefield.filter(id=>s.objects[id].controller===0&&s.objects[id].name==='Plains'&&!s.objects[id].tapped);const spell=s.players[0].hand.find(id=>s.objects[id].name==='Ram Through');
   if(s.phase==='Draw'&&s.active_player===0&&s.waiting_for.type==='Priority'&&s.waiting_for.data.player===0&&s.zone_change_library_knowledge_stamps?.length&&own.length&&opposing.length&&lands.length>=2&&spell){const r=e.submit_action(0,{type:'CastSpell',data:{object_id:spell,card_id:spell,targets:[],payment_mode:{type:'Auto'}}});assert.equal(r.status,'rejected');assert.equal(snapshot(),before);reached=true;return {acceptedSetupActions:n,seed:10,restoreUsed:false,beforeSha256:digest(before),afterSha256:digest(snapshot())};}
   const row=[0,1].map(actor=>({actor,actions:e.get_legal_actions_for_viewer_js(actor).actions})).find(r=>r.actions.length);assert(row);const {actor,actions}=row;const name=actor===0?'Savannah Lions':'Grizzly Bears',has=s.battlefield.some(id=>s.objects[id].controller===actor&&s.objects[id].name===name);
   const action=actions.find(a=>a.type==='MulliganDecision'&&a.data.choice.type==='Keep')||actions.find(a=>a.type==='PlayLand')||(!has&&actions.find(a=>a.type==='CastSpell'&&s.objects[a.data.object_id]?.name===name&&a.data.payment_mode?.type==='Auto'))||actions.find(a=>a.type==='DeclareAttackers'&&a.data.attacks.length===0)||actions.find(a=>a.type==='DeclareBlockers'&&a.data.assignments.length===0)||actions.find(a=>a.type==='PassPriority');assert(action);applied(actor,action);
  }assert(reached,'Natural setup did not reach bounded rejection fixture');
 });
 const report={schema:1,passed:rows.every(x=>x.status==='PASS'),cases:rows,limits:'Bounded engine regressions, not full card coverage or combined browser acceptance. Fixture saves/card database are not uploaded.'};await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');assert(report.passed,'Generated WASM regression failed');
}

async function main(){
 await approve();deadline=Date.now()+70*60_000;
 const identity=process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT;assert(/^\d+-\d+$/.test(identity));
 const scratch=join(resolve(process.env.RUNNER_TEMP),'cardstashy-release-proof-'+identity),source=join(scratch,'source'),target=join(scratch,'target'),nativeTarget=join(scratch,'native-target'),tools=join(scratch,'tools');
 const artifact=join(workspace,'test-results/release-engine-proof/artifact');await mkdir(scratch);await mkdir(artifact,{recursive:true});logs=join(artifact,'logs');await mkdir(logs);
 const report={schema:1,appCommit:process.env.GITHUB_SHA,buildIdentity:'manual-release-engine-'+identity,upstreamCommit:PIN,shippedTree:SHIPPED_TREE,candidateTree:CANDIDATE_TREE,candidatePatchSha256:CANDIDATE_PATCH_SHA,toolchain:TOOLCHAIN,wasmBindgenCli:BINDGEN,runner:{platform:platform(),arch:arch(),memoryBytes:totalmem()},passed:false,releaseReady:false,nativeCapabilityTests:{status:'NOT RUN',reason:'Required test step has not run yet'},formatCheck:{status:'NOT RUN'},adopted:false,deployed:false};let failure;
 try{
  const basePatch=join(workspace,'experiments/phase-engine/upstream/ninjutsu-stack-a49b8aa.patch'),patch=join(workspace,'experiments/phase-engine/patches/release-priority-atomicity-candidate.patch');
  assert.equal(sha(await readFile(basePatch)),BASE_PATCH_SHA);assert.equal(sha(await readFile(patch)),CANDIDATE_PATCH_SHA);
  await command('source-init','git',['init','--quiet',source],{minutes:1});await command('source-remote','git',['remote','add','origin','https://github.com/phase-rs/phase.git'],{cwd:source,minutes:1});await command('source-fetch','git',['fetch','--depth=1','--no-tags','origin',PIN],{cwd:source,minutes:3});await command('source-checkout','git',['checkout','--detach','FETCH_HEAD'],{cwd:source,env:{GIT_LFS_SKIP_SMUDGE:'1'},minutes:2});assert.equal(git(source,['rev-parse','HEAD']).trim(),PIN);
  await command('shipped-patch','git',['apply','--index',basePatch],{cwd:source,minutes:1});assert.equal(git(source,['write-tree']).trim(),SHIPPED_TREE);
  await command('candidate-patch','git',['apply','--index',patch],{cwd:source,minutes:1});assert.equal(git(source,['write-tree']).trim(),CANDIDATE_TREE);
  const fixture=join(source,'crates/engine/tests/fixtures/integration_cards.json.gz');assert.equal(sha(await readFile(fixture)),FIXTURE_SHA);
  await command('source-commit','git',['-c','user.name=CardStashy proof','-c','user.email=cardstashy-proof@users.noreply.github.com','-c','commit.gpgsign=false','commit','--quiet','-m','Local release-engine proof candidate; not pushed'],{cwd:source,minutes:1});report.sourceCommit=git(source,['rev-parse','HEAD']).trim();assert.equal(git(source,['status','--porcelain=v1','--untracked-files=all']).trim(),'');
  const common={CARGO_BUILD_JOBS:'1',CARGO_INCREMENTAL:'0',RUST_MIN_STACK:'16777216',CARGO_PROFILE_DEV_OPT_LEVEL:'0',CARGO_PROFILE_DEV_DEBUG:'0',CARGO_PROFILE_DEV_LTO:'false',CARGO_PROFILE_DEV_CODEGEN_UNITS:'256',CARGO_PROFILE_TEST_OPT_LEVEL:'0',CARGO_PROFILE_TEST_DEBUG:'0',CARGO_PROFILE_TEST_LTO:'false',CARGO_PROFILE_TEST_CODEGEN_UNITS:'256',CARGO_PROFILE_WASM_DEV_OPT_LEVEL:'0',CARGO_PROFILE_WASM_DEV_DEBUG:'0',CARGO_PROFILE_WASM_DEV_LTO:'false',CARGO_PROFILE_WASM_DEV_CODEGEN_UNITS:'256',CARGO_REGISTRIES_CRATES_IO_PROTOCOL:'sparse'};
  await command('toolchain-install','rustup',['toolchain','install',TOOLCHAIN,'--profile','minimal','--component','rustfmt','--target','wasm32-unknown-unknown'],{env:common,minutes:5});
  await command('bindgen-install','cargo',['+'+TOOLCHAIN,'install','wasm-bindgen-cli','--version','='+BINDGEN,'--locked','--jobs','1','--root',tools],{cwd:scratch,env:{...common,RUSTFLAGS:''},minutes:10});
  const flags='-C link-arg=-z -C link-arg=stack-size=16777216 -Zno-parallel-backend -Zmir-opt-level=0 -Zfewer-names=yes -Zthreads=1 -Ztime-passes=yes';report.rustflags=flags;
  await command('engine-wasm-build','cargo',['+'+TOOLCHAIN,'build','--locked','-p','engine-wasm','--target','wasm32-unknown-unknown','--profile','wasm-dev'],{cwd:source,env:{...common,CARGO_TARGET_DIR:target,RUSTFLAGS:flags},minutes:28});
  const pkg=join(scratch,'pkg');await mkdir(pkg);await command('bindgen-web',join(tools,'bin/wasm-bindgen'),[join(target,'wasm32-unknown-unknown/wasm-dev/engine_wasm.wasm'),'--target','web','--out-dir',pkg,'--out-name','engine_wasm'],{minutes:2});await writeFile(join(pkg,'package.json'),'{"type":"module"}\n');
  const regression=join(scratch,'generated-runtime-check.mjs');await writeFile(regression,'await ('+verifyWasm.toString()+')();\n');await command('generated-wasm-regressions',process.execPath,[regression,pkg,source,workspace,join(artifact,'runtime-regressions.json')],{minutes:4});
  assert.equal(sha(await readFile(fixture)),FIXTURE_SHA);assert.equal(git(source,['status','--porcelain=v1','--untracked-files=all']).trim(),'');assert.equal(git(source,['rev-parse','HEAD^{tree}']).trim(),CANDIDATE_TREE);
  report.runtimeRegressionCases=7;report.glueSha256=sha(await readFile(join(pkg,'engine_wasm.js')));report.wasmSha256=sha(await readFile(join(pkg,'engine_wasm_bg.wasm')));report.rulesSha256=FIXTURE_SHA;
  // Native assertions are mandatory within this single 75-minute job.
  const nativeFlags='-Zmir-opt-level=0 -Zfewer-names=yes -Zthreads=1';
  const nativeLog=await command('native-capability-tests','cargo',['+'+TOOLCHAIN,'test','--locked','-p','phase-engine','--features','test-support','--test','integration','priority_capability_v1::','--','--test-threads=1'],{cwd:source,env:{...common,CARGO_TARGET_DIR:nativeTarget,RUSTFLAGS:nativeFlags},minutes:22});
  assert(/7 passed; 0 failed/.test(await readFile(nativeLog,'utf8')),'Expected seven native capability assertions');report.nativeCapabilityTests={status:'PASS',count:7};
  await copyFile(patch,join(artifact,'candidate.patch'));for(const name of ['LICENSE-MIT','LICENSE-APACHE'])await copyFile(join(source,name),join(artifact,name));
  await command('package-runtime','tar',['-czf',join(artifact,'runtime-package.tar.gz'),'-C',scratch,'pkg'],{minutes:2});report.passed=true;
 }catch(error){failure=error;report.error=String(error.stack);}
 finally{
  await writeFile(join(artifact,'build-receipt.json'),JSON.stringify(report,null,2)+'\n');
  let files=await inventory(artifact),bytes=files.reduce((n,f)=>n+f.bytes,0);
  if(bytes>MAX_ARTIFACT){report.passed=false;report.delivery='Artifact limit exceeded; runtime package omitted';await rm(join(artifact,'runtime-package.tar.gz'),{force:true});for(const f of files.filter(x=>x.path.startsWith('logs/')&&x.bytes>256*1024)){const b=await readFile(join(artifact,f.path));await writeFile(join(artifact,f.path),Buffer.concat([Buffer.from('TRUNCATED LOG: last256KiB\n'),b.subarray(-256*1024)]));}await writeFile(join(artifact,'build-receipt.json'),JSON.stringify(report,null,2)+'\n');failure??=Error(report.delivery);}
  files=await inventory(artifact);await writeFile(join(artifact,'SHA256SUMS.json'),JSON.stringify(files,null,2)+'\n');bytes=(await inventory(artifact)).reduce((n,f)=>n+f.bytes,0);const ready=bytes<=MAX_ARTIFACT;
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'upload_ready='+String(ready)+'\n');console.log(JSON.stringify({passed:report.passed,uploadReady:ready,artifactBytes:bytes,adopted:false,deployed:false}));if(!ready)failure??=Error('Artifact exceeds bound');
 }if(failure)throw failure;
}
process.once('SIGTERM',()=>{if(child?.pid)try{process.kill(-child.pid,'SIGTERM');}catch{};process.exit(143);});
if(process.argv[2]==='--self-check'){
 assert(/^[0-9a-f]{64}$/.test(CANDIDATE_PATCH_SHA)&&/^[0-9a-f]{40}$/.test(CANDIDATE_TREE),'Incomplete source pins');
 assert.equal(sha(await readFile(join(workspace,'experiments/phase-engine/upstream/ninjutsu-stack-a49b8aa.patch'))),BASE_PATCH_SHA);
 assert.equal(sha(await readFile(join(workspace,'experiments/phase-engine/patches/release-priority-atomicity-candidate.patch'))),CANDIDATE_PATCH_SHA);
 console.log(JSON.stringify({inert:true,pin:PIN,shippedTree:SHIPPED_TREE,candidateTree:CANDIDATE_TREE,patchSha256:CANDIDATE_PATCH_SHA}));
}else await main().catch(error=>{console.error(String(error.stack));process.exitCode=1;});
