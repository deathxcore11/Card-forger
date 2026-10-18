import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {workspaceSig} from './cloud.js';
import {mergeValueHistory} from './value-history.js';
const source=fs.readFileSync('cloud.js','utf8');
const code=source.slice(source.indexOf('async function adopt('),source.indexOf('// The user\'s answer'));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const p=(date,total)=>({date,total,copies:1});
function harness({equal=false,delayApply=false,delayBackup=false,sameDate=false}={}){
 const cloud={revision:7,data:{collection:[{id:'x',qty:1}],valueHistory:[p('2026-10-18',20)]}};
 let local={collection:[{id:'x',qty:1}],valueHistory:equal?cloud.data.valueHistory:[p('2026-10-16',10),...(sameDate?[p('2026-10-18',99)]:[])]};
 const gate=deferred(),events=[];
 const c={user:{id:'a'},syncEpoch:1,accountReady:true,pending:null,workspaceSig,isEmptyWorkspace:()=>false,setStatus:(...x)=>events.push(['status',...x]),writeMeta:x=>events.push(['meta',x]),scheduleSync:()=>events.push(['schedule']),hooks:{getState:()=>local,backup:async()=>{if(delayBackup)await gate.promise;},decide:()=>events.push(['decide']),apply:async(data,{current})=>{if(delayApply)await gate.promise;if(!current())return false;const baseline=structuredClone(data);local={...data,valueHistory:mergeValueHistory(local.valueHistory,data.valueHistory)};return {cloudBaseline:baseline};}}};
 vm.createContext(c);vm.runInContext(code,c);return {c,cloud,gate,events,run:()=>c.adopt(cloud,local),getLocal:()=>local,setLocal:x=>local=x};
}
{
 const h=harness({sameDate:true});await h.run();const m=h.events.find(x=>x[0]==='meta')[1];assert.equal(m.sig,workspaceSig(h.cloud.data));assert.notEqual(m.sig,workspaceSig(h.getLocal()));assert.equal(h.events.filter(x=>x[0]==='schedule').length,1);assert.deepEqual(h.getLocal().valueHistory.map(x=>x.total),[10,20]);
}
{
 const h=harness({equal:true});await h.run();assert(!h.events.some(x=>x[0]==='schedule'));assert.deepEqual(h.events.at(-1),['status','synced']);
}
for(const phase of ['delayApply','delayBackup']){
 const h=harness({[phase]:true}),before=structuredClone(h.getLocal()),pending=h.run();await Promise.resolve();h.c.user={id:'b'};h.c.syncEpoch++;h.gate.resolve();await pending;assert.deepEqual(h.getLocal(),before);assert(!h.events.some(x=>['meta','schedule'].includes(x[0])));
}
for(const phase of ['delayBackup','delayApply']){
 const h=harness({[phase]:true}),pending=h.run();await Promise.resolve();h.setLocal({collection:[{id:'edited',qty:5}],valueHistory:[]});h.gate.resolve();await pending;assert.equal(h.getLocal().collection[0].id,'edited');assert(h.events.some(x=>x[0]==='decide'));assert(!h.events.some(x=>x[0]==='schedule'));
}
console.log('PASS: actual cloud adoption preserves remote baseline, queues retained observations only when different, same-date remote wins, equal state stays synced, delayed account switches/local edits cannot write or schedule.');
