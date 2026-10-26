// Authority/transport regressions only; no native, browser or container acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatewayDriver } from '../candidate/host/src/vendor/host001/gateway-driver.mjs';
import { MatchAuthority } from '../candidate/host/src/vendor/host001/session-authority.mjs';

const OWNER='00000000-0000-4000-8000-000000000001';
const MATCH='00000000-0000-4000-8000-000000000002';
const GENERATION='00000000-0000-4000-8000-000000000003';
const EPOCH='00000000-0000-4000-8000-000000000004';
const COMMAND='rejection_deadline_command_00001';
class Storage {
 data=new Map();
 async get(key){return structuredClone(this.data.get(key));}
 async put(key,value){this.data.set(key,structuredClone(value));}
 async transaction(operation){return operation(this);}
}
async function fixture({requestTimeoutMs=250,onBodyRead}={}){
 const f={calls:0,cancelled:false,nextStatus:409,rejectionHeadersSeen:false,bodyRead:false};
 const driver=new GatewayDriver({internalToken:'synthetic-deadline-transport-fixture-only',
  isRunning:async()=>true,stopExisting:async()=>({confirmed:true}),fetchExisting:async()=>{
   f.calls++;
   const body=f.nextStatus===202?null:new ReadableStream({
    pull(){f.bodyRead=true;onBodyRead?.();},cancel(){f.cancelled=true;}
   },{highWaterMark:0});
   return new Response(body,{status:f.nextStatus,
    headers:{'X-Host-Epoch':EPOCH,'Content-Type':'application/json'}});
  }});
 const originalRequest=driver.request.bind(driver);
 driver.request=async(...args)=>{
  const response=await originalRequest(...args);
  if(args[0]==='/action'&&response.status===409)f.rejectionHeadersSeen=true;
  return response;
 };
 const storage=new Storage();
 const authority=new MatchAuthority({storage,driver,requestTimeoutMs,
  verifyBearer:async()=>({id:OWNER,is_anonymous:false})});
 await authority.initialize({ownerId:OWNER,matchId:MATCH,generation:GENERATION,epoch:EPOCH,
  viewerId:0,deckDigests:{human:'a'.repeat(64),opponent:'b'.repeat(64)},expiresAt:Date.now()+60000});
 const request=({commandId=COMMAND,revision=1,signal}={})=>new Request(
  `https://cardstashy.com/api/play/matches/${MATCH}/actions`,{
   method:'POST',signal,
   headers:{Origin:'https://cardstashy.com',Authorization:'Bearer synthetic','Content-Type':'application/json'},
   body:JSON.stringify({commandId,generation:GENERATION,action:{revision,op:'ok'}})
  });
 return Object.assign(f,{driver,storage,authority,request});
}
async function keepAlive(operation){
 const timer=setTimeout(()=>{},3000);
 try{return await operation();}finally{clearTimeout(timer);}
}

for(const abort of ['authority deadline','caller cancellation']){
 test(`confirmed rejection survives ${abort} while optional diagnostics stall`,async()=>{
  const controller=new AbortController();
  // Allow request parsing and WebCrypto hashing to complete under a parallel
  // suite; the body deliberately stalls until the real authority deadline.
  const f=await fixture({requestTimeoutMs:1000,
   onBodyRead:abort==='caller cancellation'?()=>controller.abort():undefined});
  const response=await keepAlive(()=>f.authority.handle(f.request({signal:controller.signal})));
  assert.equal(f.rejectionHeadersSeen,true,'fixture must reach epoch-validated rejection headers before cancellation');
  assert.equal(f.bodyRead,true,'fixture must reach the optional diagnostic body before cancellation');
  assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{commandId:COMMAND,state:'rejected',error:'native_action_rejected'});
  assert.equal(f.cancelled,true);
  assert.equal((await f.storage.get('match')).pendingCommand,null);
  // Repeating a known command returns its durable receipt without resubmitting it.
  const repeated=await f.authority.handle(f.request());
  assert.equal(repeated.status,409);
  assert.deepEqual(await repeated.json(),{commandId:COMMAND,state:'rejected',error:'native_action_rejected'});
  assert.equal(f.calls,1);
  // Only a deliberate new action can perform another native dispatch.
  f.nextStatus=202;
  const next=await f.authority.handle(f.request({commandId:COMMAND+'_next',revision:2}));
  assert.equal(next.status,202);assert.equal((await next.json()).state,'accepted');
  assert.equal(f.calls,2);
 });
}

test('transport timeout before rejection headers preserves unknown outcome and blocks another dispatch',async()=>{
 const f=await fixture();
 f.driver.fetchExisting=()=>{f.calls++;return new Promise(()=>{});};
 const response=await keepAlive(()=>f.authority.handle(f.request()));
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),{commandId:COMMAND,state:'pending_outcome_unknown'});
 assert.equal((await f.storage.get('match')).pendingCommand,COMMAND);
 const next=await f.authority.handle(f.request({commandId:COMMAND+'_next',revision:2}));
 assert.equal(next.status,409);assert.deepEqual(await next.json(),{error:'another_command_pending'});
 assert.equal(f.calls,1);
});

for(const confirmation of [{epoch:GENERATION,status:409},{epoch:EPOCH,status:202}]){
 test(`invalid early rejection confirmation cannot clear pending state: ${JSON.stringify(confirmation)}`,async()=>{
  const f=await fixture();
  f.driver.submitExisting=async(_action,{onRejected})=>{
   f.calls++;onRejected?.(confirmation);return new Promise(()=>{});
  };
  const response=await keepAlive(()=>f.authority.handle(f.request()));
  assert.equal(response.status,202);
  assert.deepEqual(await response.json(),{commandId:COMMAND,state:'pending_outcome_unknown'});
  assert.equal((await f.storage.get('match')).pendingCommand,COMMAND);assert.equal(f.calls,1);
 });
}
