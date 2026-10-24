import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connect} from './browser-client.mjs';
class FakeWorker {
 static instances=[];
 constructor(){this.messages=[];this.terminated=false;FakeWorker.instances.push(this);}
 postMessage(m){this.messages.push(m);if(m.op==='bind')queueMicrotask(()=>this.onmessage({data:{epoch:m.epoch,id:'bind',ok:true}}));}
 terminate(){this.terminated=true;}
 answer(m,result,epoch=m.epoch){this.onmessage({data:{epoch,id:m.id,ok:true,result}});}
}
test('timeout is uncertain, terminates the worker and never retries',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{const c=connect('test',{timeout:15});await c.ready;const w=FakeWorker.instances.at(-1);const p=c.request('step',{id:'move',revision:0});await assert.rejects(p,/OUTCOME_UNKNOWN/);assert(w.terminated);assert.equal(w.messages.filter(m=>m.op==='step').length,1);w.answer(w.messages.at(-1),{revision:1});await assert.rejects(c.request('status'),/WORKER_CLOSED/);}finally{globalThis.Worker=old;}
});
test('old epoch reply cannot settle a pending command',async()=>{
 const old=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{const c=connect('test');await c.ready;const w=FakeWorker.instances.at(-1);let settled=false;const p=c.request('status',{id:'s'}).then(r=>{settled=true;return r;});await Promise.resolve();const m=w.messages.at(-1);w.answer(m,{revision:999},'old');await Promise.resolve();assert.equal(settled,false);w.answer(m,{revision:1});assert.deepEqual(await p,{revision:1});c.close();}finally{globalThis.Worker=old;}
});
