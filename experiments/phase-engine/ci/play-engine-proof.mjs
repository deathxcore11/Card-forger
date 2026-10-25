// Optional CI-only research proof. This file does nothing unless invoked with
// its explicit flag inside the exact approved private-repository push event.
// No local build, workflow dispatch, deployment, source push, engine adoption or
// billing approval is performed by writing or statically checking this script.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,readdir,lstat,appendFile,rm,open} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {platform,arch,totalmem,release,constants} from 'node:os';
const APPROVAL='APPROVED: verify CardStashy Play engine';
const BRANCH='refs/heads/codex/cardstashy-play-engine-20261024';
const PIN='71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234';
const TREE='60fc8715ad91f5c91b81f8a8335e238c623ec957';
const PATCH_SHA='b8a5b0efb91b10d8930252bfe522a07e8ba95030436aa5b5419478a42a2cdb5d';
const FIXTURE_SHA='0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9';
const TOOLCHAIN='nightly-2026-04-19',BINDGEN='0.2.121',MAX_ARTIFACT=256*1024*1024;
const sha=b=>createHash('sha256').update(b).digest('hex');
const workspace=resolve(process.env.GITHUB_WORKSPACE||process.cwd());
const artifact=join(workspace,'test-results/play-engine-proof/artifact');
let active=null,deadline=0,logs=null;
function git(source,args,encoding='utf8'){return execFileSync('git',['-C',source,...args],{encoding,maxBuffer:32*1024*1024});}
async function command(name,bin,args,{cwd=workspace,env={},maxMinutes=30}={}){
 const timeout=Math.min(maxMinutes*60_000,deadline-Date.now());
 assert(timeout>0,'research proof execution budget exhausted');
 const log=join(logs,name+'.log'),fd=openSync(log,'a');
 await appendFile(log,JSON.stringify({command:[bin,...args],cwd,started:new Date().toISOString()})+'\n');
 return new Promise((resolvePromise,reject)=>{
  let expired=false,killTimer;
  const child=spawn(bin,args,{cwd,env:{...process.env,...env},stdio:['ignore',fd,fd],detached:true});active=child;
  const terminate=signal=>{try{process.kill(-child.pid,signal);}catch{}};
  const timer=setTimeout(()=>{expired=true;terminate('SIGTERM');killTimer=setTimeout(()=>terminate('SIGKILL'),5000);},timeout);
  child.once('error',error=>{clearTimeout(timer);clearTimeout(killTimer);closeSync(fd);active=null;error.exitCode=127;reject(error);});
  child.once('exit',async(code,signal)=>{
   clearTimeout(timer);clearTimeout(killTimer);closeSync(fd);active=null;
   const exitCode=expired?124:code??128+(constants.signals[signal]||0);
   await appendFile(log,JSON.stringify({exitCode,signal,expired,finished:new Date().toISOString()})+'\n');
   if(exitCode){const error=Error(name+' failed; see '+log);error.exitCode=exitCode;reject(error);}else resolvePromise(log);
  });
 });
}
async function files(directory){let out=[];for(const entry of await readdir(directory,{withFileTypes:true})){const p=join(directory,entry.name),s=await lstat(p);assert(!s.isSymbolicLink(),'artifact symlinks are forbidden');if(s.isDirectory())out.push(...await files(p));else {assert(s.isFile(),'unexpected artifact entry');out.push({path:p,bytes:s.size});}}return out;}
async function approved(){
 assert.equal(process.argv[2],'--approved-ci-run','This optional proof is inert without its explicit CI invocation.');
 assert.equal(process.env.GITHUB_ACTIONS,'true','Only an approved GitHub Actions run can execute this proof.');
 assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_REF,BRANCH);assert.equal(process.env.GITHUB_REPOSITORY,'deathxcore11/Card-forger');
 const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 assert.equal(event.repository?.private,true);assert.equal(event.head_commit?.message,APPROVAL);assert.equal(event.ref,BRANCH);assert.equal(event.after,process.env.GITHUB_SHA);
 assert.equal(git(workspace,['rev-parse','HEAD']).trim(),process.env.GITHUB_SHA,'checkout must be the exact approved commit');
 assert.equal(platform(),'darwin');assert.equal(arch(),'x64');assert.equal(process.versions.node.split('.')[0],'24');
 assert(totalmem()>=12*1024**3,'optional runner must provide at least 12 GiB RAM before any installs or compilation');
}
async function run(){
 await approved();
 const runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
 assert(/^\d+$/.test(runId||'')&&/^\d+$/.test(attempt||''));
 const scratch=join(resolve(process.env.RUNNER_TEMP),'cardstashy-play-engine-proof-'+runId+'-'+attempt),source=join(scratch,'source'),target=join(scratch,'target'),tools=join(scratch,'tools');
 // Fresh source/target; no reuse of a previous output or substitute artifact.
 await mkdir(scratch);await mkdir(artifact,{recursive:true});logs=join(artifact,'logs');await mkdir(logs);
 deadline=Date.now()+40*60_000;
 const result={cardstashyCommit:process.env.GITHUB_SHA,runId,attempt,runner:{platform:platform(),arch:arch(),release:release(),memoryBytes:totalmem()},upstreamCommit:PIN,expectedSourceTree:TREE,patchSha256:PATCH_SHA,toolchain:TOOLCHAIN,wasmBindgenCli:BINDGEN,passed:false};
 let failure=null;
 try{
  const patch=join(workspace,'experiments/phase-engine/upstream/ninjutsu-stack-a49b8aa.patch');assert.equal(sha(await readFile(patch)),PATCH_SHA,'source patch hash mismatch');
  await copyFile(patch,join(artifact,'source.patch'));
  await command('source-init','git',['init','--quiet',source],{maxMinutes:1});
  await command('source-remote','git',['-C',source,'remote','add','origin','https://github.com/phase-rs/phase.git'],{maxMinutes:1});
  await command('source-fetch','git',['-C',source,'fetch','--no-tags','--depth=1','origin',PIN],{maxMinutes:3});
  await command('source-checkout','git',['-C',source,'checkout','--detach','FETCH_HEAD'],{env:{GIT_LFS_SKIP_SMUDGE:'1'},maxMinutes:1});assert.equal(git(source,['rev-parse','HEAD']).trim(),PIN);
  await command('source-apply','git',['-C',source,'apply','--index',patch],{maxMinutes:1});assert.equal(git(source,['write-tree']).trim(),TREE,'patched source tree mismatch');
  const fixtureHash=sha(await readFile(join(source,'crates/engine/tests/fixtures/integration_cards.json.gz')));assert.equal(fixtureHash,FIXTURE_SHA,'pinned fixture must be present before installing or compiling');
  await command('source-commit','git',['-C',source,'-c','user.name=CardStashy research proof','-c','user.email=cardstashy-proof@users.noreply.github.com','-c','commit.gpgsign=false','commit','--quiet','-m','Local isolated research candidate; never pushed'],{maxMinutes:1});
  const sourceCommit=git(source,['rev-parse','HEAD']).trim(),sourceTree=git(source,['rev-parse','HEAD^{tree}']).trim();assert.equal(sourceTree,TREE);assert.equal(git(source,['status','--porcelain=v1','--untracked-files=all']).trim(),'');
  const diff=git(source,['-c','core.quotePath=true','diff','--binary','--full-index','--no-color','--no-ext-diff','--no-textconv',PIN,'HEAD','--'],null);assert.equal(sha(diff),PATCH_SHA,'base-to-candidate binary diff mismatch');
  await writeFile(join(artifact,'source-commit.txt'),git(source,['cat-file','commit','HEAD'],null));
  for(const license of ['LICENSE-MIT','LICENSE-APACHE'])await copyFile(join(source,license),join(artifact,license));
  const common={CARGO_BUILD_JOBS:'1',CARGO_INCREMENTAL:'0',RUST_MIN_STACK:'16777216',RUSTUP_DIST_SERVER:'https://static.rust-lang.org',RUSTUP_UPDATE_ROOT:'https://static.rust-lang.org/rustup',CARGO_REGISTRIES_CRATES_IO_INDEX:'sparse+https://index.crates.io/',CARGO_REGISTRIES_CRATES_IO_PROTOCOL:'sparse'};
  await command('toolchain-install','rustup',['toolchain','install',TOOLCHAIN,'--profile','minimal','--target','wasm32-unknown-unknown'],{env:common,maxMinutes:5});
  await command('toolchain-versions','rustc',['+'+TOOLCHAIN,'--version','--verbose'],{env:common,maxMinutes:1});
  await command('bindgen-install','cargo',['+'+TOOLCHAIN,'install','wasm-bindgen-cli','--version','='+BINDGEN,'--locked','--jobs','1','--root',tools],{cwd:scratch,env:{...common,RUSTFLAGS:''},maxMinutes:10});
  const bindgen=join(tools,'bin/wasm-bindgen');const versionLog=await command('bindgen-version',bindgen,['--version'],{maxMinutes:1});assert((await readFile(versionLog,'utf8')).includes('wasm-bindgen '+BINDGEN));
  const flags='-C link-arg=-z -C link-arg=stack-size=16777216 -Zno-parallel-backend -Zmir-opt-level=0 -Zfewer-names=yes -Zthreads=1 -Ztime-passes=yes';
  const buildEnv={...common,CARGO_TARGET_DIR:target,RUSTFLAGS:flags,CARGO_PROFILE_DEV_OPT_LEVEL:'0',CARGO_PROFILE_DEV_DEBUG:'0',CARGO_PROFILE_DEV_LTO:'false',CARGO_PROFILE_DEV_CODEGEN_UNITS:'256',CARGO_PROFILE_WASM_DEV_OPT_LEVEL:'0',CARGO_PROFILE_WASM_DEV_DEBUG:'0',CARGO_PROFILE_WASM_DEV_LTO:'false',CARGO_PROFILE_WASM_DEV_CODEGEN_UNITS:'256'};
  result.rustflags=flags;result.buildProfile='wasm-dev; locked online engine-wasm package build; one job; opt/debug/LTO/incremental off; 256 codegen units; 16 MiB compiler thread stack';
  await command('engine-wasm-build','cargo',['+'+TOOLCHAIN,'build','--locked','-p','engine-wasm','--target','wasm32-unknown-unknown','--profile','wasm-dev'],{cwd:source,env:buildEnv,maxMinutes:28});
  const pkg=join(artifact,'pkg');await mkdir(pkg);
  await command('bindgen-web',bindgen,[join(target,'wasm32-unknown-unknown/wasm-dev/engine_wasm.wasm'),'--target','web','--out-dir',pkg,'--out-name','engine_wasm'],{maxMinutes:2});
  await writeFile(join(pkg,'package.json'),'{"type":"module"}\n');
  const allowed=new Set(['engine_wasm.js','engine_wasm_bg.wasm','engine_wasm.d.ts','engine_wasm_bg.wasm.d.ts','package.json']);for(const file of await readdir(pkg))assert(allowed.has(file),'unexpected generated package file: '+file);
  assert.equal(sha(await readFile(join(source,'crates/engine/tests/fixtures/integration_cards.json.gz'))),fixtureHash,'pinned fixture changed during compilation');
  const receipt={schemaVersion:1,buildIdentity:'cardstashy-ci-'+runId+'-'+attempt+'-ninjutsu-a49b8aa',upstreamCommit:PIN,sourceCommit,sourceTree,sourceDiffSha256:sha(diff),glueSha256:sha(await readFile(join(pkg,'engine_wasm.js'))),wasmSha256:sha(await readFile(join(pkg,'engine_wasm_bg.wasm'))),integrationFixtureGzipSha256:fixtureHash};
  const receiptPath=join(artifact,'build-receipt.json');await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');result.receipt=receipt;
  const directory=join(workspace,'experiments/phase-engine'),guards=(await readdir(directory)).filter(f=>/^test-.*\.mjs$/.test(f)).sort().map(f=>join(directory,f));
  const guardLog=await command('node-guards',process.execPath,['--test','--test-reporter=tap',...guards],{maxMinutes:2});const guardText=await readFile(guardLog,'utf8');assert.equal(Number(guardText.match(/^# tests (\d+)$/m)?.[1]),69,'expected all 69 current Node guards');assert.equal(Number(guardText.match(/^# fail (\d+)$/m)?.[1]),0);result.nodeGuards=69;
  const mechanicsOutput=join(scratch,'mechanics');
  try{await command('mechanics',process.execPath,['experiments/phase-engine/mechanics-smoke.mjs'],{env:{CARDSTASHY_PHASE_PKG:pkg,CARDSTASHY_PHASE_SOURCE:source,CARDSTASHY_PHASE_BUILD_RECEIPT:receiptPath,CARDSTASHY_PHASE_MECHANICS_OUTPUT:mechanicsOutput},maxMinutes:3});}
  finally{try{await copyFile(join(mechanicsOutput,'mechanics-report.json'),join(artifact,'mechanics-report.json'));}catch(error){if(error.code!=='ENOENT')throw error;}}
  const report=JSON.parse(await readFile(join(artifact,'mechanics-report.json'),'utf8'));assert.equal(report.cases.length,8);assert(report.cases.every(c=>c.passed===true));assert.equal(report.provenance.loadedNames.length,20);assert.equal(report.provenance.sourceCommit,sourceCommit);assert.equal(report.provenance.runtimeOrigin,'local-research-build');result.mechanicsCases=8;result.passed=true;
 }catch(error){failure=error;result.error=String(error.stack||error);result.exitCode=error.exitCode||1;}
 finally{
  await writeFile(join(artifact,'verification-result.json'),JSON.stringify(result,null,2)+'\n');
  await writeFile(join(artifact,'README.txt'),'Private optional research evidence. No deployment or adoption. No card-data bundle, target directory, saved game snapshot or Cargo cache is included. The build receipt records supplied source/runtime bytes, not an authenticated compiler correctness claim. source-commit.txt contains the exact local Git commit object for reconstruction from the pinned base plus source.patch. Full dependency/data-rights and product engine gates remain open.\n');
  const inventory=await files(artifact),originalBytes=inventory.reduce((n,f)=>n+f.bytes,0);
  if(originalBytes>MAX_ARTIFACT){
   // Preserve the actual proof failure code; if tests passed, package delivery
   // now fails explicitly. Keep small reports instead of uploading a huge pkg.
   result.proofPassedBeforeArtifactLimit=result.passed;result.passed=false;
   result.artifactDelivery={status:'failed-package-omitted',reason:'complete evidence bundle exceeds 256 MiB',originalBytes,limitBytes:MAX_ARTIFACT};
   if(!failure){failure=Error('research package/evidence exceeds the 256 MiB upload ceiling');failure.exitCode=1;}
   result.exitCode=failure.exitCode||1;
   await rm(join(artifact,'pkg'),{recursive:true,force:true});
   const tails=[];
   for(const file of await files(logs))if(file.bytes>256*1024){
    const handle=await open(file.path,'r'),buffer=Buffer.alloc(256*1024);let bytesRead;
    try{({bytesRead}=await handle.read(buffer,0,buffer.length,file.bytes-buffer.length));}finally{await handle.close();}
    await writeFile(file.path,Buffer.concat([Buffer.from('TRUNCATED AFTER ARTIFACT LIMIT: final 256 KiB of '+file.bytes+' original bytes.\n'),buffer.subarray(0,bytesRead)]));
    tails.push({file:file.path.slice(artifact.length+1),originalBytes:file.bytes,retainedTailBytes:bytesRead});
   }
   result.artifactDelivery.truncatedLogs=tails;
   await writeFile(join(artifact,'verification-result.json'),JSON.stringify(result,null,2)+'\n');
   const reducedBytes=(await files(artifact)).reduce((n,f)=>n+f.bytes,0);
   if(reducedBytes>MAX_ARTIFACT){
    // Last-resort summary is tiny and clearly reports missing delivery. The
    // build target/cache/source/card fixture were never inside this directory.
    for(const entry of await readdir(artifact))if(!['verification-result.json','README.txt'].includes(entry))await rm(join(artifact,entry),{recursive:true,force:true});
    result.artifactDelivery.status='failed-summary-only';
    await writeFile(join(artifact,'verification-result.json'),JSON.stringify(result,null,2)+'\n');
   }
  }
  const bytes=(await files(artifact)).reduce((n,f)=>n+f.bytes,0),ready=bytes<=MAX_ARTIFACT;
  console.log(JSON.stringify({passed:result.passed,exitCode:result.exitCode||0,artifactBytes:bytes,artifactLimitBytes:MAX_ARTIFACT,uploadReady:ready}));
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'upload_ready='+String(ready)+'\n');
  if(!ready&&!failure){failure=Error('bounded failure report still exceeds upload ceiling');failure.exitCode=1;}
 }
 if(failure){console.error(failure.message);process.exitCode=failure.exitCode||1;}
}
process.once('SIGTERM',()=>{if(active?.pid)try{process.kill(-active.pid,'SIGTERM');}catch{};process.exit(143);});
await run().catch(error=>{console.error(error.message);process.exitCode=error.exitCode||1;});
