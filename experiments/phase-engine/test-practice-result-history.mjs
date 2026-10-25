import {test} from 'node:test';import assert from 'node:assert/strict';
import {createPracticeResultHistory} from './practice-result-history.mjs';
import {createPracticeFlow} from './practice-flow.mjs';
import {snapshotDigest} from './practice-record.mjs';
function memory(){const map=new Map();return {get length(){return map.size;},key:n=>[...map.keys()][n]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};}
const deck=()=>({name:'Exact list',format:'Standard',cards:[{name:'Plains',qty:60,printingId:'original-print',finish:'foil'}]});
const result=(matchId='match')=>({matchId,snapshotDigest:'a'.repeat(64),revision:123,terminal:{winner:0,reason:'engine-terminal'},input:{format:'Standard',difficulty:'Medium',decks:{player:deck(),opponent:deck()},profile:{accessToken:'DO_NOT_STORE'},engine:'HIDDEN_ENGINE'}});

test('completed result survives a new history handle and duplicates preserve first time and original lists',()=>{
 const storage=memory(),history=createPracticeResultHistory({storage:()=>storage,now:()=>10});const source=result(),saved=history.record('owner-a',source);source.input.decks.player.cards[0].finish='nonfoil';assert.equal(history.list('owner-a')[0].decks.player.cards[0].finish,'foil');
 const reopened=createPracticeResultHistory({storage:()=>storage,now:()=>99});assert.deepEqual(reopened.record('owner-a',result()),saved);assert.equal(storage.length,1);assert.equal(reopened.list('owner-a')[0].finishedAt,10);
 const text=[...storage.map.values()].join('');assert(!text.includes('DO_NOT_STORE'));assert(!text.includes('HIDDEN_ENGINE'));assert(!text.includes('profile'));assert.equal(saved.snapshotDigest,'a'.repeat(64));
 const read=reopened.list('owner-a');read[0].winner=1;assert.equal(reopened.list('owner-a')[0].winner,0);
});
test('owner keys are separate and only the oldest records of the same owner are pruned',()=>{
 const storage=memory();let now=0;const h=createPracticeResultHistory({storage:()=>storage,now:()=>++now,maxEntries:2});h.record('owner-b',result('other'));for(const id of ['one','two','three'])h.record('owner-a',result(id));assert.deepEqual(h.list('owner-a').map(r=>r.matchId),['three','two']);assert.equal(h.list('owner-b').length,1);assert.equal(storage.length,3);
});
test('conflicting accepted identity, reason, winner and deck revisions cannot overwrite a result',()=>{
 const storage=memory(),h=createPracticeResultHistory({storage:()=>storage});const first=h.record('owner',result());
 for(const mutate of [r=>r.revision++,r=>r.snapshotDigest='b'.repeat(64),r=>r.terminal.winner=1,r=>r.terminal.reason='human-concession',r=>r.input.decks.player.cards[0].printingId='different']){const r=result();mutate(r);assert.throws(()=>h.record('owner',r),/RESULT_CONFLICT/);assert.deepEqual(h.list('owner')[0],first);}
});
test('unverified and corrupt data never display as completed evidence; write failures retain prior result',()=>{
 const storage=memory(),h=createPracticeResultHistory({storage:()=>storage});h.record('owner',result());for(const change of [r=>r.terminal=null,r=>r.terminal.reason='worker-error',r=>r.snapshotDigest='bad',r=>r.terminal.winner=9]){const r=result('new');change(r);assert.throws(()=>h.record('owner',r));}
 storage.map.set('cardstashy-practice-results-v1:owner:corrupt','{');assert.equal(h.list('owner').length,1);storage.setItem=()=>{throw Error('QUOTA_EXCEEDED');};assert.throws(()=>h.record('owner',result('second')),/QUOTA_EXCEEDED/);assert.equal(h.list('owner').length,1);
});
function flowFixture({mismatched=false,unavailable=false}={}){
 const storage=memory(),history=createPracticeResultHistory({storage:()=>{if(unavailable)throw Error('DISABLED');return storage;},now:()=>99});let account={user:{id:'owner-a'},generation:1},emit;
 const selected=deck(),setup={selected,opponent:deck(),match:{format:'Standard',difficulty:'Medium',mode:'cpu'},profile:{ownerId:'owner-a',signedIn:true}};
 const flow=createPracticeFlow({sessionOnly:true,resultHistory:history,readAccount:()=>account,readSetup:()=>setup,newId:()=> 'flow-result',connect:({input})=>({ready:snapshotDigest(input).then(digest=>({admission:{admitted:true},cpuAvailable:true,snapshotDigest:mismatched?'b'.repeat(64):digest})),close(){}}),makeSession:({onChange})=>{emit=onChange;return {open:async()=>({status:{revision:0,terminal:null},error:null}),close(){}};}});
 return {flow,history,selected,emit:g=>emit(g),change:()=>{account={user:{id:'owner-b'},generation:2};}};
}
const terminal=()=>({status:{revision:123,terminal:{winner:1,reason:'idle-timeout'}},error:null});
test('actual flow records once from verified binding, original captured lists and accepted terminal',async()=>{
 const f=flowFixture();await f.flow.start({seed:1});f.selected.cards[0].printingId='later-edit';f.emit(terminal());assert.equal(f.flow.snapshot().history.state,'saved');const first=f.flow.snapshot().history.result;assert.equal(first.reason,'idle-timeout');assert.equal(first.decks.player.cards[0].printingId,'original-print');f.emit(terminal());assert.deepEqual(f.flow.snapshot().history.result,first);assert.equal(f.flow.listHistory().length,1);f.flow.detach();assert.equal(f.flow.listHistory().length,1);
});
test('storage failure or unverified digest cannot replace a finished game with an error',async()=>{
 for(const options of [{unavailable:true},{mismatched:true}]){const f=flowFixture(options);await f.flow.start({seed:1});f.emit(terminal());assert.equal(f.flow.snapshot().phase,'finished');assert.equal(f.flow.snapshot().error,null);assert.equal(f.flow.snapshot().history.state,'unavailable');}
});
test('stale-account terminal and failed authority do not write a history result',async()=>{
 const changed=flowFixture();await changed.flow.start({seed:1});changed.change();changed.emit(terminal());assert.equal(changed.history.list('owner-a').length,0);assert.equal(changed.history.list('owner-b').length,0);
 const failed=flowFixture();await failed.flow.start({seed:1});failed.emit({status:{revision:3,terminal:null},error:'RECOVERY_REQUIRED'});failed.emit(terminal());assert.equal(failed.history.list('owner-a').length,0);assert.equal(failed.flow.snapshot().phase,'session-ended');
});
