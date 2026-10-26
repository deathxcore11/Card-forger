// Synthetic presentation/transport ordering only; no native or browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createForgePresentationSession} from '../candidate/ui/experiments/forge-proof/forge-session.mjs';

const state=revision=>({schema:'cardstashy.forge-proof.v1',revision,viewer:0,
 forgeRevision:'e5a0f8156da70ffc7866f923bed371c0111707cd',status:'running',busy:false,
 turn:1,phase:'MAIN1',inputType:'InputPayMana',buttons:{ok:'Pay',okEnabled:true},
 players:[{id:0,isViewer:true,name:'You',life:20,zones:{}},
  {id:1,isViewer:false,name:'CPU',life:20,zones:{}}],stack:[]});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(read=async()=>state(11)){
 const action=deferred(),commands=[];let blocked=false;
 const session=createForgePresentationSession({transportStatus:()=>({blocked}),request:(path,body)=>{
  if(path==='/action'){commands.push(body);return action.promise;}
  assert.equal(path,'/state');return read();
 }});
 session.acceptState(state(10));
 return {session,action,commands,block(){blocked=true;}};
}

test('poll advancing the payment state before its receipt does not leave the table busy',async()=>{
 const poll=deferred();let reads=0;
 const f=fixture(()=>++reads===1?poll.promise:Promise.resolve(state(11)));
 const polling=f.session.refresh(),paying=f.session.nativeButton('ok',10);
 poll.resolve(state(11));await polling;
 assert.equal(f.session.snapshot().busy,true,'pending POST still blocks input');
 f.action.resolve({state:'accepted'});await paying;
 assert.equal(f.session.snapshot().native.revision,11);
 assert.equal(f.session.snapshot().busy,false,'already observed advancement satisfies the receipt wait');
 await f.session.refresh();
 assert.equal(f.session.snapshot().busy,false,'stable repeated state cannot re-arm the wait');
 assert.deepEqual(f.commands,[{op:'ok',revision:10}]);f.session.close();
});

test('receipt before the advancing poll remains busy until that poll completes',async()=>{
 const poll=deferred(),f=fixture(()=>poll.promise);
 const paying=f.session.nativeButton('ok',10);f.action.resolve({state:'accepted'});await tick();
 assert.equal(f.session.snapshot().busy,true);
 poll.resolve(state(11));await paying;
 assert.equal(f.session.snapshot().busy,false);
 assert.deepEqual(f.commands,[{op:'ok',revision:10}]);f.session.close();
});

test('unchanged state after acceptance stays busy and blocks a second payment',async()=>{
 const f=fixture(async()=>state(10));
 const paying=f.session.nativeButton('ok',10);f.action.resolve({state:'accepted'});await paying;
 assert.equal(f.session.snapshot().busy,true);
 await assert.rejects(f.session.nativeButton('ok',10),/MATCH_NOT_READY/);
 await f.session.refresh();assert.equal(f.session.snapshot().busy,true);
 f.session.acceptState(state(11));assert.equal(f.session.snapshot().busy,false);
 assert.deepEqual(f.commands,[{op:'ok',revision:10}]);f.session.close();
});

test('rapid duplicate payment is blocked while the original POST is pending',async()=>{
 const f=fixture(),paying=f.session.nativeButton('ok',10);
 await assert.rejects(f.session.nativeButton('ok',10),/MATCH_NOT_READY/);
 f.action.resolve({state:'accepted'});await paying;
 assert.deepEqual(f.commands,[{op:'ok',revision:10}]);
 await assert.rejects(f.session.nativeButton('ok',10),/STALE_CHOICE/);
 assert.equal(f.commands.length,1);f.session.close();
});

test('an older response cannot replace a newer state or release an unchanged-state wait',async()=>{
 const f=fixture(async()=>state(9)),paying=f.session.nativeButton('ok',10);
 f.action.resolve({state:'accepted'});await paying;
 assert.equal(f.session.snapshot().native.revision,10);assert.equal(f.session.snapshot().busy,true);
 f.session.acceptState(state(11));assert.equal(f.session.snapshot().busy,false);
 f.session.acceptState(state(10));assert.equal(f.session.snapshot().native.revision,11);
 assert.deepEqual(f.commands,[{op:'ok',revision:10}]);f.session.close();
});

test('network uncertainty refreshes state without replaying or reopening payment',async()=>{
 const f=fixture(),paying=f.session.nativeButton('ok',10);
 f.block();f.action.reject(Error('ACTION_OUTCOME_UNKNOWN'));await paying;
 assert.equal(f.session.snapshot().busy,true);
 await f.session.refresh();
 await assert.rejects(f.session.nativeButton('ok',11),/MATCH_NOT_READY/);
 assert.deepEqual(f.commands,[{op:'ok',revision:10}]);f.session.close();
});
