import assert from 'node:assert/strict';
import {initCatalog,catalogState,invalidateCatalogRead,localScanMatch} from './scan-catalog.js';

globalThis.fetch=async()=>{throw Error('Catalogue retry fixture attempted external request');};
let reads=0,writes=0,firstRead;
const saved={schema:1,game:'ptcg',rows:[['fixture-101','Vikavolt','fixture','101',264,'Fixture Physical Set','paper/fixture/101']]};
globalThis.localStorage={getItem:()=>null,setItem(){writes++;}};
globalThis.indexedDB={open(){
 const request={result:{objectStoreNames:{contains:()=>true},close(){},transaction(){return {objectStore(){return {
  get(){const r={};reads++;if(reads===1)firstRead=r;else queueMicrotask(()=>{r.result=saved;r.onsuccess();});return r;},
  put(){writes++;}
 };}};}}};
 queueMicrotask(()=>request.onsuccess());return request;
}};
const pending=initCatalog('ptcg');
await new Promise(resolve=>setImmediate(resolve));
assert.equal(reads,1);assert.notEqual(catalogState('ptcg').status,'ready');
assert.equal(invalidateCatalogRead('ptcg'),true,'only the hung read promise is released');
const recovered=await initCatalog('ptcg');
assert.equal(reads,2);assert.equal(recovered.rows[0][0],'fixture-101');
assert.equal(catalogState('ptcg').status,'ready');
assert.equal(invalidateCatalogRead('ptcg'),false,'ready compiled catalogues are retained');
assert.equal(await initCatalog('ptcg'),recovered);assert.equal(reads,2);
assert.equal((await localScanMatch('ptcg',{name:'Vikavolt',code:'101/264'})).cands[0].id,'fixture-101');
// The invalidated read can settle later, but cannot overwrite newer readiness.
firstRead.result={...saved,rows:[['outdated-101','Vikavolt','outdated','101',264,'Outdated Set','paper/outdated/101']]};
firstRead.onsuccess();assert.equal(await pending,recovered);
assert.equal(catalogState('ptcg').pack,recovered);assert.equal(writes,0,'recovery never deletes or writes persisted records');
console.log('PASS: hung catalogue read retries, ready packs survive invalidation, stale reads cannot replace newer data, and storage is unchanged.');
