// LOCAL_TEST_NOT_DEPLOYABLE. One recorded Docker container per fixture allocation.
// No production import, global selector, mutable image tags or process restart.
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,rm,lstat,rename} from 'node:fs/promises';import path from 'node:path';
import {SCOPE,assertVerifiedLocalIdentity,assertSameContainerImage} from './oci-identity.mjs';
const relayCode=await readFile(new URL('./relay-http.py',import.meta.url),'utf8');
const extractionCode=await readFile(new URL('./extract-image-files.py',import.meta.url),'utf8');
const ROUTES=new Set(['GET /bootstrap-ready','POST /initialize','GET /ready','GET /state','POST /action']);
const HEADER_KEYS=new Set(['authorization','content-type','content-length','x-expected-host-epoch']);
const RESPONSE_HEADERS=new Set(['content-type','cache-control','content-length','x-content-type-options','x-host-epoch','x-host-native-source-sha256','x-host-native-manifest-sha256']);
const IMAGE_ID=/^sha256:[a-f0-9]{64}$/,CONTAINER_ID=/^[a-f0-9]{64}$/;
const INSPECT_FORMAT='{"Id":{{json .Id}},"Image":{{json .Image}},"Config":{"User":{{json .Config.User}},"Entrypoint":{{json .Config.Entrypoint}}},"HostConfig":{"NetworkMode":{{json .HostConfig.NetworkMode}},"ReadonlyRootfs":{{json .HostConfig.ReadonlyRootfs}},"Memory":{{json .HostConfig.Memory}},"MemorySwap":{{json .HostConfig.MemorySwap}},"NanoCpus":{{json .HostConfig.NanoCpus}},"PidsLimit":{{json .HostConfig.PidsLimit}},"CapDrop":{{json .HostConfig.CapDrop}},"SecurityOpt":{{json .HostConfig.SecurityOpt}},"Tmpfs":{{json .HostConfig.Tmpfs}}},"State":{"Running":{{json .State.Running}},"Status":{{json .State.Status}},"ExitCode":{{json .State.ExitCode}},"OOMKilled":{{json .State.OOMKilled}}},"LocalTestScope":{{json (index .Config.Labels "org.cardstashy.scope")}},"LocalAllocation":{{json (index .Config.Labels "org.cardstashy.local-allocation")}}}';
export function execDocker(args,{stdin=Buffer.alloc(0),signal,timeoutMs=10000,maxOutputBytes=6*1024*1024}={}){
 assert(Array.isArray(args)&&args.every(x=>typeof x==='string'),'Typed Docker arguments required');
 return new Promise((resolve,reject)=>{
  signal?.throwIfAborted();const child=spawn('docker',args,{stdio:['pipe','pipe','pipe'],shell:false});let stdout=[],stderr=[],outBytes=0,errBytes=0,settled=false,timedOut=false;
  const abort=()=>{timedOut=true;child.kill('SIGKILL');};const timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});
  const finish=(error,code)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error||timedOut||signal?.aborted)return reject(Error(signal?.aborted?'docker_operation_aborted':timedOut?'docker_operation_deadline':'docker_operation_failed'));resolve({code,stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr)});};
  child.stdout.on('data',b=>{outBytes+=b.length;if(outBytes>maxOutputBytes){abort();return;}stdout.push(b);});
  child.stderr.on('data',b=>{errBytes+=b.length;if(errBytes<=65536)stderr.push(b);else abort();});
  child.once('error',()=>finish(true));child.once('close',code=>finish(false,code));child.stdin.on('error',()=>{});child.stdin.end(stdin);
 });
}
async function boundedBody(request){const chunks=[];let bytes=0;if(!request.body)return Buffer.alloc(0);const signal=AbortSignal.any([request.signal,AbortSignal.timeout(6000)]),reader=request.body.getReader();try{while(true){signal.throwIfAborted();const {value,done}=await waitAbortable(reader.read(),signal);if(done)break;bytes+=value.byteLength;assert(bytes<=262144,'Bounded native request required');chunks.push(Buffer.from(value));}}catch(error){void reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}return Buffer.concat(chunks);}
function waitAbortable(promise,signal){if(!signal)return promise;signal.throwIfAborted();return new Promise((resolve,reject)=>{const abort=()=>reject(Error('recorded_container_wait_aborted'));signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});}
export function createDockerContainer({identity,privateRoot,counters={starts:0,destroys:0},id,execDocker:run=execDocker}){
 assertVerifiedLocalIdentity(identity);assert(IMAGE_ID.test(identity.dockerImageId)&&typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id),'Bounded local allocation identity required');
 const name='cardstashy-local-test-'+id,privateDir=path.join(path.resolve(privateRoot),id),envPath=path.join(privateDir,'runtime.env'),ledgerPath=path.join(privateDir,'container-ledger.json');
 let ownershipRecorded=false,createAcknowledged=false;
 let cid=null,started=false,startPromise=null,destroyPromise=null,closed=false,running=false,idleTimer=null,absoluteTimer=null,idleMs=600000,startError=null,lastInspection=null,cleanup=null;
 const writeLedger=async status=>{const data={schema:'cardstashy.local-owned-container.v1',scope:SCOPE,id,name,imageId:identity.dockerImageId,containerId:cid,createAcknowledged,status};const temporary=ledgerPath+'.new';await writeFile(temporary,JSON.stringify(data)+'\n',{mode:0o600});await rename(temporary,ledgerPath);};
 const checked=async(args,opts)=>{const r=await run(args,opts);assert(r?.code===0,'docker_operation_failed');return r;};
 const inspect=async({allowMissing=false}={})=>{
  const r=await run(['inspect','--type','container','--format',INSPECT_FORMAT,cid||name],{timeoutMs:5000,maxOutputBytes:32768});
  if(r.code!==0){if(allowMissing&&/No such (object|container)/i.test(r.stderr?.toString()||''))return null;throw Error('recorded_container_inspection_failed');}
  const value=JSON.parse(r.stdout.toString());assert(CONTAINER_ID.test(value.Id)&&value.LocalTestScope===SCOPE&&value.LocalAllocation===id,'Recorded local container labels mismatch');
  const recovered=!cid;if(cid)assert(value.Id===cid,'Recorded container changed');
  assertSameContainerImage(identity,value);assert(value.HostConfig.CapDrop?.some(x=>x.toUpperCase()==='ALL')&&value.HostConfig.SecurityOpt?.some(x=>x==='no-new-privileges'||x==='no-new-privileges:true'),'Container hardening mismatch');
  assert(value.HostConfig.Tmpfs?.['/run/cardstashy']==='rw,noexec,nosuid,size=512m,uid=10001,gid=10001,mode=0700'&&value.HostConfig.Tmpfs?.['/tmp']==='rw,noexec,nosuid,size=64m,mode=1777','Container private tmpfs mismatch');
  if(recovered){cid=value.Id;await writeLedger('observed');}lastInspection=value;return value;
 };
 const touch=()=>{clearTimeout(idleTimer);if(!closed&&running){idleTimer=setTimeout(()=>{void destroy('idle-timeout').catch(()=>{});},idleMs);idleTimer.unref?.();}};
 async function destroy(reason='host-destroy'){
  if(destroyPromise)return destroyPromise;
  if(!startPromise){closed=true;cleanup={scope:SCOPE,confirmed:true,privateInputRemoved:true,removed:true,reason,forced:false,status:null,exitCode:null,oomKilled:null,imageId:identity.dockerImageId,containerId:null,starts:0,destroys:0};return structuredClone(cleanup);}
  closed=true;clearTimeout(idleTimer);clearTimeout(absoluteTimer);
  destroyPromise=(async()=>{
   await startPromise?.catch(()=>{});assert(ownershipRecorded,'local_container_ownership_unconfirmed');let current=await inspect({allowMissing:true});let forced=false;
   // A killed/failed CLI is not cancellation of an already-sent daemon create.
   // Keep the ownership ledger until a valid receipt or observed container
   // resolves that operation; one absent inspection can precede late commit.
   assert(current||createAcknowledged,'local_create_completion_unconfirmed');
   if(current?.State.Running){await run(['stop','--time','10',cid],{timeoutMs:16000,maxOutputBytes:1024}).catch(()=>({code:1}));current=await inspect({allowMissing:true});}
   if(current?.State.Running){forced=true;await checked(['kill',cid],{timeoutMs:5000,maxOutputBytes:1024});current=await inspect();assert(current.State.Running===false,'Recorded container still running');}
   const finalState=current?.State||lastInspection?.State||null;
   if(current){await checked(['rm',cid],{timeoutMs:5000,maxOutputBytes:1024});assert(await inspect({allowMissing:true})===null,'Recorded container removal unconfirmed');}
   await rm(privateDir,{recursive:true,force:true});running=false;counters.destroys++;
   cleanup={scope:SCOPE,confirmed:true,privateInputRemoved:true,removed:true,reason,forced,status:finalState?.Status??null,imageId:identity.dockerImageId,containerId:cid,exitCode:finalState?.ExitCode??null,oomKilled:finalState?.OOMKilled??null,starts:started?1:0,destroys:1};return structuredClone(cleanup);
  })();return destroyPromise;
 }
 function start(options){
  assert(!startPromise&&!closed,'Recorded allocation cannot start twice');assert(options?.enableInternet===false&&JSON.stringify(options.entrypoint)===JSON.stringify(['python3','/opt/host-service/bootstrap.py']),'Exact offline bootstrap required');
  const env=options.env||{},token=env.HOST_INTERNAL_TOKEN,deadline=Number(env.HOST_ABSOLUTE_DEADLINE_MS);
  assert(Object.keys(env).every(k=>['HOST_INTERNAL_TOKEN','HOST_ABSOLUTE_DEADLINE_MS'].includes(k))&&typeof token==='string'&&token.length>=32&&token.length<=256&&/^[!-~]+$/.test(token)&&!/[\r\n]/.test(token),'Private bounded bootstrap capability required');
  assert(Number.isSafeInteger(deadline)&&deadline>Date.now()&&deadline<=Date.now()+900000,'Bounded local absolute deadline required');
  startPromise=(async()=>{
   const st=await lstat(privateRoot);assert(st.isDirectory()&&!st.isSymbolicLink(),'Private local root required');await mkdir(privateDir,{mode:0o700});await writeLedger('planned');ownershipRecorded=true;
   await writeFile(envPath,`HOST_INTERNAL_TOKEN=${token}\nHOST_ABSOLUTE_DEADLINE_MS=${deadline}\nHOST_SEED=20261025\n`,{mode:0o600,flag:'wx'});
   try{
    await writeLedger('create-pending');
    const result=await checked(['create','--name',name,'--label','org.cardstashy.scope='+SCOPE,'--label','org.cardstashy.local-allocation='+id,'--platform','linux/amd64','--user','10001:10001','--network','none','--read-only','--memory','4g','--memory-swap','4g','--cpus','.5','--pids-limit','256','--cap-drop','ALL','--security-opt','no-new-privileges','--tmpfs','/run/cardstashy:rw,noexec,nosuid,size=512m,uid=10001,gid=10001,mode=0700','--tmpfs','/tmp:rw,noexec,nosuid,size=64m,mode=1777','--env-file',envPath,identity.dockerImageId],{timeoutMs:15000,maxOutputBytes:1024});
    const returnedId=result.stdout.toString().trim();assert(CONTAINER_ID.test(returnedId),'Docker create returned no recorded identity');cid=returnedId;createAcknowledged=true;await writeLedger('created');
   }finally{await rm(envPath,{force:true});}
   await inspect();if(closed)throw Error('Allocation closed during startup');
   await checked(['start',cid],{timeoutMs:10000,maxOutputBytes:1024});started=true;counters.starts++;running=true;await writeLedger('running');
   const current=await inspect();assert(current.State.Running===true,'Recorded bootstrap did not start');touch();
   absoluteTimer=setTimeout(()=>{void destroy('absolute-deadline').catch(()=>{});},Math.max(1,deadline-Date.now()));absoluteTimer.unref?.();
  })().catch(error=>{startError=error;throw error;});startPromise.catch(()=>{});
  // Platform-compatible: admission observes the ORIGINAL async work via fetch,
  // never waits on or retries a Promise returned by start().
 }
 function getTcpPort(port){assert(port===8080&&startPromise&&!closed,'No recorded existing local container');return {fetch:async request=>{
  assert(request instanceof Request,'Typed native Request required');const url=new URL(request.url);assert(url.origin==='http://host001.internal'&&!url.search&&!url.hash&&ROUTES.has(request.method+' '+url.pathname),'Native relay route forbidden');
  const headers={};for(const [key,value]of request.headers){assert(HEADER_KEYS.has(key)&&value.length<=8192&&!/[\r\n]/.test(value),'Native relay header forbidden');headers[key]=value;}
  const body=await boundedBody(request);assert(request.method!=='GET'||body.length===0,'GET body forbidden');if(headers['content-length'])assert(headers['content-length']===String(body.length),'Request length mismatch');
  await waitAbortable(startPromise,request.signal);assert(!closed&&running&&cid&&!startError,'Recorded container not running');touch();
  const payload=Buffer.from(JSON.stringify({method:request.method,path:url.pathname,headers,bodyBase64:body.toString('base64')}));
  const r=await checked(['exec','-i',cid,'python3','-c',relayCode],{stdin:payload,signal:request.signal,timeoutMs:6500,maxOutputBytes:6*1024*1024});
  const result=JSON.parse(r.stdout.toString());assert(result.scope===SCOPE&&Number.isInteger(result.status)&&result.status>=100&&result.status<=599&&typeof result.bodyBase64==='string','Invalid local relay response');
  const responseHeaders={};for(const [k,v]of Object.entries(result.headers||{})){assert(RESPONSE_HEADERS.has(k)&&typeof v==='string'&&v.length<=8192&&!/[\r\n]/.test(v),'Relay response header rejected');responseHeaders[k]=v;}
  assert(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.bodyBase64),'Invalid relay body encoding');const bytes=Buffer.from(result.bodyBase64,'base64');assert(bytes.length<=4*1024*1024,'Relay response too large');
  return new Response([204,205,304].includes(result.status)?null:bytes,{status:result.status,headers:responseHeaders});
 }};}
 async function extractImageArtifacts(){await startPromise;assert(!closed&&running&&cid,'Recorded image container must be running');await inspect();const r=await checked(['exec','-i',cid,'python3','-c',extractionCode],{timeoutMs:6500,maxOutputBytes:12*1024*1024});const data=JSON.parse(r.stdout.toString());const expected=['nativeSourceBytes','imageCheckpointBytes','buildAttestationBytes','runtimeIndexBytes'];assert(data.scope===SCOPE&&JSON.stringify(Object.keys(data.files).sort())===JSON.stringify(expected.sort()),'Image extraction allowlist mismatch');return Object.fromEntries(expected.map(k=>{assert(typeof data.files[k]==='string','Invalid image extraction');const bytes=Buffer.from(data.files[k],'base64');assert(bytes.length<=2*1024*1024,'Image metadata exceeds bound');return [k,bytes];}));}
 return {start,getTcpPort,async setInactivityTimeout(ms){assert(ms===600000,'Unexpected native inactivity bound');idleMs=ms;touch();},destroy,async inspect(){assert(startPromise,'No recorded local container');await startPromise;return inspect();},extractImageArtifacts,get ledgerPath(){return ledgerPath;},get containerId(){return cid;},get running(){return running&&!closed;},evidence(){return {scope:SCOPE,imageId:identity.dockerImageId,starts:started?1:0,destroys:cleanup?1:0,running:running&&!closed,cleanup:cleanup?structuredClone(cleanup):null};}};
}
export const makeDockerProvider=createDockerContainer;
