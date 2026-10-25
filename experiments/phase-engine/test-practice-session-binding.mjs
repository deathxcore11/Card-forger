import {test} from 'node:test';import assert from 'node:assert/strict';
import {validPracticeBinding} from './practice-authority.mjs';
const bind=()=>({v:1,epoch:'private-epoch',id:'bind',op:'bind',ownerId:'owner',match:'match',operation:'create',input:{fixture:true}});
test('worker accepts legacy durable binding and explicit boolean session mode only',()=>{
 assert.equal(validPracticeBinding(bind()),true);assert.equal(validPracticeBinding({...bind(),sessionOnly:false}),true);assert.equal(validPracticeBinding({...bind(),sessionOnly:true}),true);for(const sessionOnly of [undefined,null,0,1,'true',{},[]])assert.equal(validPracticeBinding({...bind(),sessionOnly}),false);assert.equal(validPracticeBinding({...bind(),extra:true}),false);
});
test('invalid flags and session resume never start storage or engine loading',async()=>{
 const messages=[],previous=globalThis.postMessage;globalThis.postMessage=m=>messages.push(m);
 try{for(const sessionOnly of [null,1,'true']){await globalThis.onmessage({data:{...bind(),sessionOnly}});assert.equal(messages.at(-1).error,'BIND_REQUIRED');}
 const data={...bind(),sessionOnly:true,operation:'resume'};delete data.input;await globalThis.onmessage({data});assert.equal(messages.at(-1).error,'SESSION_RESUME_UNAVAILABLE');assert.equal(messages.at(-1).epoch,data.epoch);assert.equal(messages.at(-1).id,'bind');assert.equal(messages.some(m=>m.progress),false);
 }finally{globalThis.postMessage=previous;}
});
