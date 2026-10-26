// Transport fixtures only: no native/browser/container acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GatewayDriver } from '../candidate/host/src/vendor/host001/gateway-driver.mjs';
import { MatchAuthority } from '../candidate/host/src/vendor/host001/session-authority.mjs';
import { createForgeHostClient, exactDigest, FORGE_REVISION } from '../candidate/ui/play-forge-host-client.js';

const OWNER='00000000-0000-4000-8000-000000000001';
const MATCH='00000000-0000-4000-8000-000000000002';
const GENERATION='00000000-0000-4000-8000-000000000003';
const EPOCH='00000000-0000-4000-8000-000000000004';
const ORIGIN='https://cardstashy.com';
const reasons=['stale_revision','stale_prompt','native_engine_busy','native_input_changed',
 'native_dialog_requires_reply','ok_disabled','cancel_disabled','native_match_unavailable',
 'native_game_finished','native_concession_in_progress','exact_initialization_unverified'];
class Storage {
 data=new Map();
 async get(k){return structuredClone(this.data.get(k));}
 async put(k,v){this.data.set(k,structuredClone(v));}
 async transaction(fn){return fn(this);}
}
async function fixture({reason='stale_revision',status=409}={}){
 const f={posts:[],receipts:[],status,reason,alter:null};
 const driver=new GatewayDriver({internalToken:'synthetic-private-transport-fixture-only',isRunning:async()=>true,
  stopExisting:async()=>({confirmed:true}),fetchExisting:async req=>{
   f.posts.push(await req.json());return Response.json({error:f.reason,privateData:'MUST_NOT_ESCAPE'},
    {status:f.status,headers:{'X-Host-Epoch':EPOCH}});
  }});
 const authority=new MatchAuthority({storage:new Storage(),driver,verifyBearer:async()=>({id:OWNER,is_anonymous:false})});
 await authority.initialize({ownerId:OWNER,matchId:MATCH,generation:GENERATION,epoch:EPOCH,viewerId:0,
  deckDigests:{human:'a'.repeat(64),opponent:'b'.repeat(64)},expiresAt:Date.now()+60000});
 let serial=0;
 const input={humanDeck:{fixture:'human'},opponentDeck:{fixture:'opponent'}};
 const client=createForgeHostClient({readAccount:()=>({user:{id:OWNER}}),getAccessToken:async()=>'synthetic-token',
  newId:()=>`test_command_${String(++serial).padStart(8,'0')}`,fetchImpl:async(url,options)=>{
   if(url==='/api/play/matches')return Response.json({matchId:MATCH,generation:GENERATION,
    schema:'cardstashy.forge-proof.v1',forgeRevision:FORGE_REVISION,status:'initializing',expiresAt:Date.now()+60000,
    deckDigests:{human:await exactDigest(input.humanDeck),opponent:await exactDigest(input.opponentDeck)}},{status:202});
   const response=await authority.handle(new Request(ORIGIN+url,{...options,headers:{...options.headers,Origin:ORIGIN}}));
   const data=await response.json();f.receipts.push(data);
   return Response.json(f.alter?f.alter(data):data,{status:response.status});
  }});
 await client.create(input);Object.assign(f,{driver,authority,client});return f;
}
for(const reason of reasons)test(`native ${reason} reaches client as a bound rejection without replay`,async()=>{
 const f=await fixture({reason,status:reason.endsWith('_disabled')?400:409});
 await assert.rejects(f.client.submit({revision:12,op:'ok'}),e=>e.code===reason&&e.message!==reason);
 assert.deepEqual(f.posts,[{revision:12,op:'ok'}]);
 assert.deepEqual(Object.keys(f.receipts[0]).sort(),['commandId','error','state']);
 assert.equal(f.receipts[0].state,'rejected');assert.equal(f.client.status().blocked,false);
 // A new deliberate action is allowed; the rejected action is never replayed.
 f.status=202;await f.client.submit({revision:13,op:'cancel'});
 assert.deepEqual(f.posts,[{revision:12,op:'ok'},{revision:13,op:'cancel'}]);
});
test('native exception/card/token text is discarded at both host boundaries',async()=>{
 for(const reason of ['private_card_name','Bearer secret',null,{},['stale_revision'],'__proto__']){
  const f=await fixture({reason});
  await assert.rejects(f.client.submit({revision:12,op:'ok'}),{code:'native_action_rejected'});
  assert.equal(f.receipts[0].error,'native_action_rejected');
  assert.equal(JSON.stringify(f.receipts).includes('MUST_NOT_ESCAPE'),false);
 }
});
test('rejected command ID mismatch blocks further submissions rather than permitting a retry',async()=>{
 const f=await fixture();f.alter=data=>({...data,commandId:'different_command_0001'});
 await assert.rejects(f.client.submit({revision:12,op:'ok'}),{code:'HOST_COMMAND_RECEIPT_MISMATCH'});
 assert.equal(f.client.status().blocked,true);
 await assert.rejects(f.client.submit({revision:13,op:'ok'}));assert.equal(f.posts.length,1);
});
test('unknown dispatch outcome remains blocked with one POST',async()=>{
 const f=await fixture({status:503});
 await assert.rejects(f.client.submit({revision:12,op:'ok'}),{code:'ACTION_OUTCOME_UNKNOWN'});
 assert.equal(f.client.status().blocked,true);assert.equal(f.posts.length,1);
});
test('a persisted rejected command retains its safe reason without a second native dispatch',async()=>{
 const f=await fixture({reason:'ok_disabled',status:400});
 const request=()=>new Request(ORIGIN+`/api/play/matches/${MATCH}/actions`,{method:'POST',
  headers:{Authorization:'Bearer synthetic-token',Origin:ORIGIN,'Content-Type':'application/json'},
  body:JSON.stringify({commandId:'duplicate_command_0001',generation:GENERATION,action:{revision:12,op:'ok'}})});
 const first=await f.authority.handle(request()),second=await f.authority.handle(request());
 assert.equal(first.status,400);assert.equal(second.status,400);
 const receipt=await first.json();assert.equal(receipt.error,'ok_disabled');
 assert.deepEqual(receipt,await second.json());assert.equal(f.posts.length,1);
});
test('unknown and inherited-property reasons use plain generic client text',async()=>{
 for(const code of ['__proto__','constructor','unknown_native_text']){
  const f=await fixture();f.alter=data=>({...data,error:code});
  await assert.rejects(f.client.submit({revision:12,op:'ok'}),e=>typeof e.message==='string'&&e.message.startsWith('Forge did not accept'));
  assert.equal(f.posts.length,1);
 }
});
test('unreadable rejection diagnostics preserve confirmed status and never leak raw data',async()=>{
 for(const body of ['not json',JSON.stringify({error:'stale_revision',private:'x'.repeat(2048)})]){
  const f=await fixture();f.driver.fetchExisting=async()=>new Response(body,{status:409,
   headers:{'X-Host-Epoch':EPOCH,'Content-Type':'application/json'}});
  assert.deepEqual(await f.driver.submitExisting({revision:12,op:'ok'},{expectedEpoch:EPOCH}),
   {epoch:EPOCH,status:409,error:'native_action_rejected'});
 }
});
test('stalled rejection body is bounded, cancelled and retains rejection without replay',async()=>{
 const f=await fixture();let calls=0,cancelled=false;
 f.driver.timeoutMs=20;f.driver.fetchExisting=async()=>{calls++;return new Response(new ReadableStream({cancel(){cancelled=true;}}),
  {status:409,headers:{'X-Host-Epoch':EPOCH,'Content-Type':'application/json'}});};
 const keepAlive=setTimeout(()=>{},200);
 try{assert.deepEqual(await f.driver.submitExisting({revision:12,op:'ok'},{expectedEpoch:EPOCH}),
  {epoch:EPOCH,status:409,error:'native_action_rejected'});}
 finally{clearTimeout(keepAlive);}
 assert.equal(calls,1);assert.equal(cancelled,true);
});
