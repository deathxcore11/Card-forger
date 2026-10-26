import test from 'node:test';import assert from 'node:assert/strict';import {lifecycleEvidence}from './lifecycle-contract.mjs';
const imageId='sha256:'+'a'.repeat(64);
function evidence(i=1){return {imageId,starts:1,destroys:1,running:false,cleanup:{containerId:String(i).repeat(64),imageId,confirmed:true,removed:true,privateInputRemoved:true,forced:false,oomKilled:false,status:'exited',exitCode:0}};}
function run(es){return lifecycleEvidence(es.map(e=>({evidence:()=>e})),{imageId,expected:es.length===1?1:2});}
test('one and two distinct same-image allocations pass only strict cleanup',()=>{assert.equal(run([evidence()]).confirmed,true);assert.equal(run([evidence(),evidence(2)]).confirmed,true);});
for(const [key,value]of Object.entries({forced:true,oomKilled:true,status:'running',exitCode:137,removed:false,privateInputRemoved:false,confirmed:false,imageId:'sha256:'+'b'.repeat(64),containerId:null}))test('rejects allocation '+key,()=>{const e=evidence();e.cleanup[key]=value;assert.equal(run([e]).confirmed,false);});
test('rejects missing cleanup, duplicate allocation and running container',()=>{const e=evidence();delete e.cleanup;assert.equal(run([e]).confirmed,false);assert.equal(run([evidence(),evidence()]).confirmed,false);const r=evidence();r.running=true;assert.equal(run([r]).confirmed,false);});
test('unstarted entry does not manufacture completed allocation',()=>{assert.equal(run([{starts:0,cleanup:null}]).confirmed,false);});
