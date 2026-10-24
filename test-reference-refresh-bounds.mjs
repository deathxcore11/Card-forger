import assert from 'node:assert/strict';
import {waitForReferenceRefresh} from './deck-pipeline.js';
const nativeSet=globalThis.setTimeout,nativeClear=globalThis.clearTimeout,pending=new Set();
globalThis.setTimeout=(fn,ms)=>{let id=nativeSet(()=>{pending.delete(id);fn();},ms);pending.add(id);return id;};globalThis.clearTimeout=id=>{pending.delete(id);return nativeClear(id);};
try{
 let calls=0;assert.equal((await waitForReferenceRefresh(async()=>{calls++;},{timeoutMs:10})).status,'ready');assert.equal(calls,1);assert.equal(pending.size,0);
 const error=await waitForReferenceRefresh(async()=>{throw Error('fixture failure');},{timeoutMs:10});assert.equal(error.status,'failed');assert.equal(pending.size,0);
 let resolveLate;const timed=await waitForReferenceRefresh(()=>new Promise(resolve=>resolveLate=resolve),{timeoutMs:5});assert.equal(timed.status,'timeout');assert.equal(pending.size,0);
 const newer=await waitForReferenceRefresh(async()=>{}, {timeoutMs:10});resolveLate();await Promise.resolve();assert.equal(timed.status,'timeout');assert.equal(newer.status,'ready','Late shared cache completion cannot replace a newer result');
 await assert.rejects(waitForReferenceRefresh(()=>{calls++;},{current:()=>false,timeoutMs:10}),{name:'AbortError'});assert.equal(calls,1,'Already-cancelled work never starts a fetch');
 let active=true,finish;const cancelled=waitForReferenceRefresh(()=>new Promise(resolve=>finish=resolve),{current:()=>active,timeoutMs:100});await Promise.resolve();active=false;finish();await assert.rejects(cancelled,{name:'AbortError'});assert.equal(pending.size,0);
}finally{globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;}
console.log('PASS: current reference refresh wait is bounded, rejection-safe and cancellable; timers clean up and late shared-cache completion cannot relabel results.');
