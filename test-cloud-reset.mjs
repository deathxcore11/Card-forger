import assert from 'node:assert/strict';
import {blank} from './store.js';
import {initCloud,signOut,detachDeviceSync,decideSync,isEmptyWorkspace,summarize,workspaceSig,startSync,cloudInfo} from './cloud.js';
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true,userAgent:'Test browser'},configurable:true});
globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.window={addEventListener(){}};globalThis.location={search:'',origin:'https://test.invalid',pathname:'/',hash:'#home'};
globalThis.fetch=async()=>Response.json({external:{email:true}});
const owned=g=>({...blank(),tcg:{[g]:{collection:[{id:'one',name:'Card',qty:4}],decks:[{id:'deck'}],wishlist:[]}}});
for(const g of ['ptcg','ygo']){
 assert.equal(isEmptyWorkspace(owned(g)),false);assert.equal(summarize(owned(g)).copies,4);assert.equal(summarize(owned(g)).decks,1);
 assert.equal(decideSync({cloud:null,meta:null,userId:'one',local:owned(g)}),'offer','never silently replace Pokémon/YGO device data');
 assert.equal(decideSync({cloud:{data:owned(g),revision:5},meta:{userId:'one',sig:workspaceSig(owned(g)),revision:5},userId:'one',local:blank()}),'choose','a reset cannot upload an empty copy over a populated account');
}
let local=owned('ptcg'),cloud={data:structuredClone(local),revision:5},authEvent,session={user:{id:'one',email:'test@example.invalid'}},writes=0,holdUpdate=null;
const client={auth:{onAuthStateChange(fn){authEvent=fn;},async getSession(){return {data:{session}};},async signOut(options){assert.equal(options.scope,'local');session=null;authEvent('SIGNED_OUT',null);return {}; }},from(table){let operation='read',data,owner;const q={select(){return q;},eq(k,v){if(k==='user_id')owner=v;return q;},update(d){operation='update';data=d;return q;},insert(d){operation='insert';data=d;return q;},async maybeSingle(){return {data:table==='profiles'?null:structuredClone(cloud)};},async single(){writes++;cloud={data:data.data,revision:data.revision};return {data:{revision:cloud.revision}};},then(resolve){assert.equal(owner,'one');writes++;const done=()=>{cloud={data:data.data,revision:data.revision};resolve({data:[{revision:cloud.revision}]});};if(holdUpdate)holdUpdate(done);else done();}};return q;}};
await initCloud({getState:()=>local,status(){},changed(){},decide(){},apply:async data=>{local=structuredClone(data);},backup:async()=>{}},{createClient:()=>client});
await new Promise(r=>setTimeout(r,0));await startSync();
assert.equal(cloudInfo().status.state,'synced');
await signOut();detachDeviceSync();local=blank();
assert.equal(writes,0,'sign-out and reset never write an empty account');
assert.equal(summarize(cloud.data).copies,4,'account still contains Pokémon cards');
assert.equal(cloudInfo().meta,null,'reset removes the stale sync baseline');
session={user:{id:'one',email:'test@example.invalid'}};authEvent('SIGNED_IN',session);await new Promise(r=>setTimeout(r,0));await startSync();
assert.equal(summarize(local).copies,4,'signing back in restores the account copy');assert.equal(writes,0);
// A request already sent before sign-out may finish, but cannot recreate this device's old link.
local.tcg.ptcg.collection[0].qty=7;
let finish;holdUpdate=fn=>{finish=fn;};const pending=startSync();while(!finish)await new Promise(r=>setTimeout(r,0));
await signOut();detachDeviceSync();finish();await pending;
assert.equal(cloudInfo().meta,null,'a late write cannot relink a signed-out/reset device');
assert.equal(summarize(cloud.data).copies,7,'in-flight request contains the pre-reset data, never the cleared copy');
console.log('PASS: Pokémon/YGO account protection, real mocked DB read/write flow, sign-out → reset → sign-in recovery, local auth scope and stale-write isolation.');
