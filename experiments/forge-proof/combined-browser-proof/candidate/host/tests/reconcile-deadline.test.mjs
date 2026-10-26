// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdmissionService } from '../src/service-core.mjs';
const FIRST = '00000000-0000-4000-8000-000000000001';
const SECOND = '00000000-0000-4000-8000-000000000002';
const GENERATION = '00000000-0000-4000-8000-000000000003';
class Storage {
  data = new Map(); tail = Promise.resolve();
  async get(k) { return structuredClone(this.data.get(k)); }
  async put(k,v) { this.data.set(k,structuredClone(v)); }
  async delete(k) { this.data.delete(k); }
  async list({prefix}) { return new Map([...this.data].filter(([k])=>k.startsWith(prefix))); }
  async getAlarm() { return this.alarmAt ?? null; }
  async setAlarm(t) { this.alarmAt=t; }
  transaction(fn) { const r=this.tail.then(()=>fn(this));this.tail=r.catch(()=>{});return r; }
}
async function bounded(work) {
  let timer;
  try { return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('alarm blocked beyond six seconds')),6000);})]); }
  finally {clearTimeout(timer);}
}
async function fixture(hangAt) {
  const storage=new Storage(),calls={firstReconcile:0,firstProof:0,secondReconcile:0};let resolveLate;
  const stalled=new Promise(resolve=>{resolveLate=resolve;});
  await storage.put('leases',[FIRST,SECOND].map(matchId=>({matchId,generation:GENERATION})));
  const env={FORGE_MATCHES:{getByName(id){return {
    reconcile:async()=>{if(id===FIRST)calls.firstReconcile++;if(id===FIRST&&hangAt==='reconcile')return stalled;if(id===SECOND)calls.secondReconcile++;},
    destructionProof:async()=>{if(id===FIRST){calls.firstProof++;return stalled;}return {confirmed:true,generation:GENERATION};}
  };}}};
  const service=new AdmissionService({ctx:{storage},env,native:{ready:false},verifyBearer:async()=>null,now:()=>1000});
  return {storage,calls,service,resolveLate};
}
for(const hangAt of ['reconcile','proof'])test(`stalled ${hangAt} retains its lease while alarm releases another confirmed allocation`,async()=>{
  const f=await fixture(hangAt);const work=f.service.alarm();
  // Let local storage promises finish, without waiting for the remote RPC.
  await new Promise(resolve=>setTimeout(resolve,20));
  const retryAt=f.storage.alarmAt;
  await bounded(work);
  assert.equal(retryAt,31000,'retry must be durable before awaiting remote cleanup');
  assert.equal(f.calls.secondReconcile,1);
  assert.deepEqual((await f.storage.get('leases')).map(a=>a.matchId),[FIRST]);
  f.resolveLate({confirmed:true,generation:GENERATION});
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual((await f.storage.get('leases')).map(a=>a.matchId),[FIRST],'late proof cannot free capacity after timeout');
  if(hangAt==='reconcile')assert.equal(f.calls.firstProof,0,'do not continue to release after reconciliation timeout');
  await bounded(f.service.alarm());
  assert.deepEqual(await f.storage.get('leases'),[],'a subsequent alarm may release only after a fresh generation-bound proof call');
  assert.equal(f.calls.firstReconcile,2,'late completion must not autonomously continue the timed-out alarm');
  assert.equal(f.calls.firstProof,hangAt==='proof'?2:1);
});

for (const stage of ['reconcile','proof']) for (const failure of ['reject','throw']) {
  test(`${failure} from ${stage} preserves its lease and still reconciles another allocation`,async()=>{
    const storage=new Storage();let secondCalls=0;
    await storage.put('leases',[FIRST,SECOND].map(matchId=>({matchId,generation:GENERATION})));
    const fail=()=>{if(failure==='throw')throw Error('synthetic RPC failure');return Promise.reject(Error('synthetic RPC failure'));};
    const env={FORGE_MATCHES:{getByName(id){return {
      reconcile(){if(id===FIRST&&stage==='reconcile')return fail();if(id===SECOND)secondCalls++;return Promise.resolve();},
      destructionProof(generation){if(id===FIRST)return fail();return Promise.resolve({confirmed:true,generation});}
    };}}};
    const service=new AdmissionService({ctx:{storage},env,native:{ready:false},verifyBearer:async()=>null,now:()=>1000});
    await bounded(service.alarm());
    assert.equal(secondCalls,1);
    assert.deepEqual((await storage.get('leases')).map(a=>a.matchId),[FIRST]);
    assert.equal(storage.alarmAt,31000);
  });
}

test('unknown, explicit false and wrong-generation proofs never release occupied capacity',async()=>{
  const otherGeneration='00000000-0000-4000-8000-000000000004';
  for(const proof of [undefined,null,{}, {confirmed:false,generation:GENERATION}, {confirmed:true,generation:otherGeneration}]) {
    const storage=new Storage();await storage.put('leases',[{matchId:FIRST,generation:GENERATION}]);
    const env={FORGE_MATCHES:{getByName(){return {async reconcile(){},async destructionProof(){return proof;}};}}};
    const service=new AdmissionService({ctx:{storage},env,native:{ready:false},verifyBearer:async()=>null,now:()=>1000});
    await bounded(service.alarm());
    assert.deepEqual(await storage.get('leases'),[{matchId:FIRST,generation:GENERATION}]);
    assert.equal(storage.alarmAt,31000);
  }
});

test('proof for an old generation cannot release its replacement committed during the RPC',async()=>{
  const storage=new Storage(),replacement='00000000-0000-4000-8000-000000000004';
  await storage.put('leases',[{matchId:FIRST,generation:GENERATION}]);
  const env={FORGE_MATCHES:{getByName(){return {async destructionProof(){
    await storage.put('leases',[{matchId:FIRST,generation:replacement}]);
    return {confirmed:true,generation:GENERATION};
  }};}}};
  const service=new AdmissionService({ctx:{storage},env,native:{ready:false},verifyBearer:async()=>null,now:()=>1000});
  assert.equal(await service.release(FIRST,GENERATION),false);
  assert.deepEqual(await storage.get('leases'),[{matchId:FIRST,generation:replacement}]);
});
