import assert from 'node:assert/strict';
import {createPlayUpdateGate} from './play-update-gate.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
const worker=(controller=true)=>{const listeners=[];let updates=0;return {controller:controller?{}:null,addEventListener:(t,f)=>listeners.push(f),fire:()=>listeners.forEach(f=>f()),getRegistration:async()=>({update:async()=>{updates++;},installing:null,waiting:null}),updates:()=>updates};};
const gate=(over={})=>{const log=[];const g=createPlayUpdateGate({checkRelease:async()=>over.state,serviceWorker:over.sw||worker(),store:over.store||memory(),reload:()=>log.push('reload'),setHash:h=>log.push(h),notify:v=>log.push('notify:'+v),wait:async()=>{},native:()=>!!over.native});return {g,log};};
{const {g,log}=gate({state:{update:false,release:{webVersion:'4.1.1'}}});assert.equal(await g.beforeMatch(),false);assert.deepEqual(log,[]);}
{const sw=worker();const {g,log}=gate({sw,state:{update:true,release:{webVersion:'4.1.1'}}});assert.equal(await g.beforeMatch(),true);assert.deepEqual(log,['notify:4.1.1','#play','reload']);assert.equal(sw.updates(),1);}
{const store=memory();const a=gate({store,state:{update:true,release:{webVersion:'4.1.1'}}});await a.g.beforeMatch();const b=gate({store,state:{update:true,release:{webVersion:'4.1.1'}}});assert.equal(await b.g.beforeMatch(),false,'one attempt per release per tab');}
{const sw=worker();const {g,log}=gate({sw,state:{update:false,release:{webVersion:'4.1.1'}}});sw.fire();assert.equal(g.stale(),true);assert.equal(await g.beforeMatch(),true);assert.equal(log[0],'notify:replaced');}
{const sw=worker(false);const {g}=gate({sw,state:{update:false}});sw.fire();assert.equal(g.stale(),false,'first controller is not an older page');assert.equal(await g.beforeMatch(),false);}
{const {g,log}=gate({native:true,state:{update:true,release:{webVersion:'9'}}});assert.equal(await g.beforeMatch(),false);assert.deepEqual(log,[]);}
{const {g}=gate({state:undefined});assert.equal(await g.beforeMatch(),false,'an unavailable release check does not block play');}
console.log('PASS: Play reopens on a newer website release before a match, once per release, never in the Android app or on first install.');
