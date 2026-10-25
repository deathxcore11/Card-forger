import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connect} from './browser-client.mjs';
class FakeWorker {
 static instances=[];
 constructor(){this.messages=[];this.terminated=false;FakeWorker.instances.push(this);}
 postMessage(m){this.messages.push(m);if(m.op==='bind')queueMicrotask(()=>this.onmessage({data:{v:1,epoch:m.epoch,id:'bind',ok:true}}));}
 terminate(){this.terminated=true;}
 answer(m,result,epoch=m.epoch){this.onmessage({data:{v:1,epoch,id:m.id,ok:true,result}});}
}
test('timeout is uncertain, terminates the worker and never retries',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{const c=connect('test',{timeout:15});await c.ready;const w=FakeWorker.instances.at(-1);const p=c.request('step',{id:'move',revision:0});await assert.rejects(p,/OUTCOME_UNKNOWN/);assert(w.terminated);assert.equal(w.messages.filter(m=>m.op==='step').length,1);w.answer(w.messages.at(-1),{revision:1});await assert.rejects(c.request('status'),/WORKER_CLOSED/);}finally{globalThis.Worker=old;}
});
test('old epoch reply cannot settle a pending command',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{const c=connect('test');await c.ready;const w=FakeWorker.instances.at(-1);let settled=false;const p=c.request('status',{id:'s'}).then(r=>{settled=true;return r;});await Promise.resolve();const m=w.messages.at(-1);w.answer(m,{revision:999},'old');await Promise.resolve();assert.equal(settled,false);w.answer(m,{revision:1});assert.deepEqual(await p,{revision:1});c.close();}finally{globalThis.Worker=old;}
});

test('postMessage failure cleans its request without terminating a usable worker',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{
  const c=connect('test',{timeout:20});await c.ready;const w=FakeWorker.instances.at(-1),send=w.postMessage.bind(w);
  w.postMessage=m=>{if(m.id==='bad')throw Error('PRIVATE_CLONE_DETAIL');send(m);};
  await assert.rejects(c.request('step',{id:'bad',revision:0}),/^Error: REQUEST_NOT_SENT$/);
  const p=c.request('status',{id:'good'});await Promise.resolve();w.answer(w.messages.at(-1),{revision:0});assert.deepEqual(await p,{revision:0});assert.equal(w.terminated,false);c.close();
 }finally{globalThis.Worker=old;}
});
test('worker failure or explicit close during a move reports uncertain outcome',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{
  for(const kind of ['error','close']){
   const c=connect('test');await c.ready;const w=FakeWorker.instances.at(-1),p=c.request('step',{id:'move',revision:0});await Promise.resolve();
   if(kind==='error')w.onerror();else c.close();
   await assert.rejects(p,/OUTCOME_UNKNOWN/);assert(w.terminated);assert.equal(w.messages.filter(m=>m.op==='step').length,1);
  }
 }finally{globalThis.Worker=old;}
});
test('malformed same-session reply closes transport instead of accepting a move',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{
  const c=connect('test');await c.ready;const w=FakeWorker.instances.at(-1),p=c.request('step',{id:'move',revision:0});await Promise.resolve();const m=w.messages.at(-1);
  w.onmessage({data:{v:2,epoch:m.epoch,id:m.id,ok:true,result:{revision:999}}});await assert.rejects(p,/OUTCOME_UNKNOWN/);assert(w.terminated);
 }finally{globalThis.Worker=old;}
});

test('closing during a human response reports unknown outcome rather than a read failure',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{const c=connect('test',{mode:'human'});await c.ready;const p=c.request('respond',{revision:0,id:'human-response',submission:{interactionId:'i',response:{type:'select',data:{choiceIds:['c']}}}});await Promise.resolve();c.close();await assert.rejects(p,/OUTCOME_UNKNOWN/);}finally{globalThis.Worker=old;}
});
