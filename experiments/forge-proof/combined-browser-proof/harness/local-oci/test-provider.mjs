// MOCK DOCKER + SYNTHETIC OCI ONLY. This test never invokes a Docker executable.
import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,readFile,lstat,access} from 'node:fs/promises';import path from 'node:path';
import {syntheticOCI,syntheticPolicy} from './test-fixtures.mjs';
import {verifyLocalOciLayout,SCOPE} from './oci-identity.mjs';
import {createDockerContainer} from './docker-provider.mjs';import {cleanupOwnedLedger,cleanupOwnedRoot} from './cleanup-owned.mjs';import {createLocalNativeAdapter} from './local-native-adapter.mjs';
const token='SYNTHETIC_TEST_CAPABILITY_NOT_A_REAL_SECRET_123456';
function dockerMock(f,{createGate=null,uncertainCreate=false,wrongLabel=false,failStop=false}={}){
 let exists=false,running=false,exitCode=0;const calls=[],id='c'.repeat(64),allocation='unit-fixture';
 const inspect=()=>({...f.containerInspect,Id:id,LocalTestScope:wrongLabel?'NOT_OURS':SCOPE,LocalAllocation:allocation,Scope:wrongLabel?'NOT_OURS':SCOPE,Allocation:allocation,Running:running,State:{Running:running,Status:running?'running':'exited',ExitCode:exitCode,OOMKilled:false},HostConfig:{...f.containerInspect.HostConfig,CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],Tmpfs:{'/run/cardstashy':'rw,noexec,nosuid,size=512m,uid=10001,gid=10001,mode=0700','/tmp':'rw,noexec,nosuid,size=64m,mode=1777'}}});
 const ok=body=>({code:0,stdout:Buffer.from(typeof body==='string'?body:JSON.stringify(body)),stderr:Buffer.alloc(0)});
 const run=async(args,options={})=>{
  calls.push({args,options});assert(!args.some(a=>a.includes(token)),'Capability entered command argv');
  if(args[0]==='create'){
   const envPath=args[args.indexOf('--env-file')+1];assert((await readFile(envPath,'utf8')).includes(token));assert.equal((await lstat(envPath)).mode&0o777,0o600);
   const ledger=JSON.parse(await readFile(path.join(path.dirname(envPath),'container-ledger.json')));assert.equal(ledger.status,'create-pending');assert.equal(ledger.containerId,null);assert.equal(ledger.createAcknowledged,false);
   exists=true;if(createGate)await createGate;if(uncertainCreate)throw Error('Synthetic ambiguous Docker receipt');return ok(id+'\n');
  }
  if(args[0]==='inspect')return exists?ok(inspect()):{code:1,stdout:Buffer.alloc(0),stderr:Buffer.from('Error: No such object: recorded-unit')};
  if(args[0]==='start'){assert(exists&&!running);running=true;return ok(id);}
  if(args[0]==='exec'){
   assert(exists&&running&&args[2]===id);assert.equal(args[3],'python3');assert.equal(args[4],'-c');
   if(args[5].includes('MAX_INPUT=')){const request=JSON.parse(options.stdin);assert(request.path.startsWith('/'));return ok({scope:SCOPE,status:request.path==='/initialize'?204:200,headers:{'content-type':'application/json','x-host-epoch':'unit-epoch','x-host-native-source-sha256':'1'.repeat(64),'x-host-native-manifest-sha256':'2'.repeat(64)},bodyBase64:request.path==='/initialize'?'':Buffer.from('{"revision":7}').toString('base64')});}
   assert(args[5].includes("'nativeSourceBytes'"));return ok({scope:SCOPE,files:Object.fromEntries(['nativeSourceBytes','imageCheckpointBytes','buildAttestationBytes','runtimeIndexBytes'].map(k=>[k,Buffer.from('SYNTHETIC_IMAGE_FILE').toString('base64')]))});
  }
  if(args[0]==='stop'){if(failStop)return {code:1,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)};running=false;exitCode=0;return ok(id);}
  if(args[0]==='kill'){running=false;exitCode=137;return ok(id);}
  if(args[0]==='rm'){assert(!running||args.includes('--force'));exists=false;running=false;return ok(id);}
  throw Error('Unexpected mock Docker command');
 };
 return {run,calls,get exists(){return exists;},get running(){return running;},inspect};
}
async function fixture(options={}){const f=await syntheticOCI(),identity=await verifyLocalOciLayout(f.root,f),privateRoot=path.join(f.root,'private');await mkdir(privateRoot);const mock=dockerMock(f,options),counters={starts:0,destroys:0},container=createDockerContainer({identity,privateRoot,counters,id:'unit-fixture',execDocker:mock.run});return {...f,identity,privateRoot,mock,counters,container};}
const options=()=>({enableInternet:false,entrypoint:['python3','/opt/host-service/bootstrap.py'],env:{HOST_INTERNAL_TOKEN:token,HOST_ABSOLUTE_DEADLINE_MS:String(Date.now()+180000)}});
test('mock provider exact security args, private ledger, immutable identity, relay headers/body and cleanup',async()=>{const f=await fixture();try{
 assert.equal(f.container.start(options()),undefined);const response=await f.container.getTcpPort(8080).fetch(new Request('http://host001.internal/state',{headers:{Authorization:'Bearer '+token}}));assert.deepEqual(await response.json(),{revision:7});assert.equal(response.headers.get('x-host-epoch'),'unit-epoch');assert.equal(response.headers.get('x-host-native-source-sha256'),'1'.repeat(64));
 const create=f.mock.calls.find(c=>c.args[0]==='create').args;for(const flag of ['--user','--network','--read-only','--memory','--memory-swap','--cpus','--pids-limit','--cap-drop','--security-opt','--tmpfs'])assert(create.includes(flag));assert.equal(create.at(-1),f.identity.dockerImageId);assert(!create.includes('--publish'));assert.equal(f.counters.starts,1);
 const ledger=JSON.parse(await readFile(f.container.ledgerPath));assert.equal(ledger.containerId,f.container.containerId);assert.equal(ledger.status,'running');assert.equal(ledger.createAcknowledged,true);await assert.rejects(access(path.join(path.dirname(f.container.ledgerPath),'runtime.env')));
 const extracted=await f.container.extractImageArtifacts();assert(Buffer.isBuffer(extracted.buildAttestationBytes));
 const result=await f.container.destroy();assert.deepEqual({confirmed:result.confirmed,privateInputRemoved:result.privateInputRemoved,exitCode:result.exitCode,oomKilled:result.oomKilled,forced:result.forced},{confirmed:true,privateInputRemoved:true,exitCode:0,oomKilled:false,forced:false});assert.equal(f.counters.destroys,1);await f.container.destroy();assert.equal(f.counters.destroys,1);assert(!f.mock.exists);await assert.rejects(access(f.container.ledgerPath));assert.throws(()=>f.container.start(options()));
 }finally{await f.cleanup();}});
test('forbidden routes, headers and body cannot reach Docker relay; no action replay',async()=>{const f=await fixture();try{f.container.start(options());await f.container.inspect();const fetch=f.container.getTcpPort(8080).fetch;for(const request of [new Request('http://evil.invalid/state'),new Request('http://host001.internal/state?viewer=1'),new Request('http://host001.internal/logs'),new Request('http://host001.internal/action',{method:'DELETE'}),new Request('http://host001.internal/state',{headers:{Cookie:'not-permitted'}})])await assert.rejects(fetch(request));assert.equal(f.mock.calls.filter(c=>c.args[0]==='exec').length,0);await f.container.destroy();}finally{await f.cleanup();}});
test('destroy racing unresolved create removes same recorded ID and never starts it',async()=>{let resolve;const gate=new Promise(r=>resolve=r),f=await fixture({createGate:gate});try{f.container.start(options());const closing=f.container.destroy();resolve();const result=await closing;assert.equal(result.confirmed,true);assert.equal(result.starts,0);assert.equal(f.mock.calls.filter(c=>c.args[0]==='start').length,0);assert(!f.mock.exists);}finally{await f.cleanup();}});
test('ambiguous create reconciles exact recorded name without retry',async()=>{const f=await fixture({uncertainCreate:true});try{f.container.start(options());await assert.rejects(f.container.getTcpPort(8080).fetch(new Request('http://host001.internal/ready')));const result=await f.container.destroy();assert(result.confirmed);assert.equal(f.mock.calls.filter(c=>c.args[0]==='create').length,1);assert(!f.mock.exists);}finally{await f.cleanup();}});
test('forced enforcement is disclosed, never a graceful pass',async()=>{const f=await fixture({failStop:true});try{f.container.start(options());await f.container.getTcpPort(8080).fetch(new Request('http://host001.internal/ready'));const result=await f.container.destroy();assert.equal(result.forced,true);assert.equal(result.exitCode,137);assert.equal(result.removed,true);}finally{await f.cleanup();}});
test('outer ledger cleanup only removes exact owned image/labels and fails closed on mismatch',async()=>{const f=await fixture();try{f.container.start(options());await f.container.getTcpPort(8080).fetch(new Request('http://host001.internal/ready'));const result=await cleanupOwnedLedger(f.container.ledgerPath,{execDocker:f.mock.run});assert(result.confirmed);assert(!f.mock.exists);await f.container.destroy();}finally{await f.cleanup();}
 const bad=await fixture({wrongLabel:true});try{bad.container.start(options());await assert.rejects(bad.container.getTcpPort(8080).fetch(new Request('http://host001.internal/ready')));const result=await cleanupOwnedRoot(bad.privateRoot,{execDocker:bad.mock.run});assert.equal(result.confirmed,false);assert.equal(result.unresolved,1);assert.equal(bad.mock.calls.filter(c=>['stop','kill','rm'].includes(c.args[0])).length,0);}finally{await bad.cleanup();}});
test('local adapter preserves real transport interface and exact receipt gates, cannot select by env JSON',async()=>{const f=await syntheticOCI();try{const {identity,policy,probe}=await syntheticPolicy(f);assert.throws(()=>createLocalNativeAdapter({identity,policy}));const adapter=createLocalNativeAdapter({identity,policy,localTestScope:SCOPE,now:()=>Date.parse('2026-10-26T12:00:00Z')});assert.equal(adapter.ready,true);assert.throws(()=>adapter.validateAdmissionInput({difficultyPolicyVersion:'default'}));
 const launch=await adapter.startOptions({input:probe.input,allocation:{expiresAt:Date.now()+180000},internalToken:token});assert.equal(launch.enableInternet,false);assert.deepEqual(launch.entrypoint,['python3','/opt/host-service/bootstrap.py']);
 const confirm=options=>adapter.confirmInitialization({...probe,...options,internalToken:token,fetchExisting:async request=>{assert.equal(request.url,'http://host001.internal/state');return new Response(JSON.stringify(probe.state),{status:200,headers:{'content-type':'application/json',...probe.responseHeaders}});}});
 const receipt=await confirm({});assert.equal(receipt.schema,'cardstashy.forge-proof.v1');await assert.rejects(confirm({epoch:'wrong-epoch'}));
 }finally{await f.cleanup();}});

test('destroy before start creates no resources and cannot later start',async()=>{const f=await fixture();try{const result=await f.container.destroy();assert(result.confirmed);assert.equal(result.starts,0);assert.equal(result.destroys,0);assert.equal(f.mock.calls.length,0);assert.throws(()=>f.container.start(options()));}finally{await f.cleanup();}});
test('preexisting allocation directory cannot grant cleanup ownership',async()=>{const f=await fixture();try{await mkdir(path.join(f.privateRoot,'unit-fixture'));f.container.start(options());await assert.rejects(f.container.inspect());await assert.rejects(f.container.destroy(),/ownership_unconfirmed/);assert.equal(f.mock.calls.length,0);await access(path.join(f.privateRoot,'unit-fixture'));}finally{await f.cleanup();}});

test('aborted streaming request body cannot hang or reach native relay',async()=>{const f=await fixture();try{f.container.start(options());await f.container.inspect();const controller=new AbortController(),body=new ReadableStream({start(){}}),request=new Request('http://host001.internal/action',{method:'POST',body,duplex:'half',signal:controller.signal});const response=f.container.getTcpPort(8080).fetch(request);controller.abort();await assert.rejects(response);assert.equal(f.mock.calls.filter(c=>c.args[0]==='exec').length,0);await f.container.destroy();}finally{await f.cleanup();}});

// Regression for independent review's delayed daemon commit reproduction.
// The create CLI can terminate before the daemon commits: absence is NOT final.
test('lost create receipt plus absent inspection retains uncertainty until exact delayed allocation is observed',async()=>{
 for(const failure of ['rejected','nonzero','malformed']){
  const f=await syntheticOCI();try{
   const identity=await verifyLocalOciLayout(f.root,f),privateRoot=path.join(f.root,'private');await mkdir(privateRoot);
   let pending=false,exists=false;const calls=[],id='d'.repeat(64),allocation='delayed-create';
   const mock=async(args)=>{calls.push(args[0]);
    if(args[0]==='create'){pending=true;if(failure==='rejected')throw Error('synthetic CLI lost receipt before daemon commit');return {code:failure==='nonzero'?1:0,stdout:Buffer.from('unacknowledged'),stderr:Buffer.alloc(0)};}
    if(args[0]==='inspect')return exists?{code:0,stdout:Buffer.from(JSON.stringify({...f.containerInspect,Id:id,Scope:SCOPE,Allocation:allocation,Running:false})),stderr:Buffer.alloc(0)}:{code:1,stdout:Buffer.alloc(0),stderr:Buffer.from('Error: No such object: planned-name')};
    if(args[0]==='rm'){assert(exists);assert(args.includes(id));const stored=JSON.parse(await readFile(path.join(privateRoot,allocation,'container-ledger.json')));assert.equal(stored.containerId,id);assert.equal(stored.status,'observed');exists=false;return {code:0,stdout:Buffer.from(id),stderr:Buffer.alloc(0)};}
    throw Error('Unexpected synthetic Docker command');
   };
   const c=createDockerContainer({identity,privateRoot,id:allocation,execDocker:mock});c.start(options());await assert.rejects(c.inspect());
   await assert.rejects(c.destroy(),/local_create_completion_unconfirmed/);await access(c.ledgerPath);assert.equal(c.evidence().cleanup,null);
   const ledger=JSON.parse(await readFile(c.ledgerPath));assert.equal(ledger.createAcknowledged,false);assert.equal(ledger.containerId,null);assert.equal(ledger.status,'create-pending');
   const absent=await cleanupOwnedRoot(privateRoot,{execDocker:mock});assert.equal(absent.confirmed,false);assert.equal(absent.unresolved,1);await access(c.ledgerPath);
   assert(pending);exists=true; // already-issued create finally commits; no retry
   const resolved=await cleanupOwnedRoot(privateRoot,{execDocker:mock});assert.equal(resolved.confirmed,true);assert.equal(exists,false);await assert.rejects(access(c.ledgerPath));
   assert.equal(calls.filter(x=>x==='create').length,1);assert.equal(calls.filter(x=>x==='start').length,0);
  }finally{await f.cleanup();}
 }
});
