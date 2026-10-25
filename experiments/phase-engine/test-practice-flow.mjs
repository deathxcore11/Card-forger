import {test} from 'node:test';import assert from 'node:assert/strict';
import {createPracticeFlow} from './practice-flow.mjs';
function fixture({ready,game={status:{terminal:null},error:null}}={}){
 let a={user:{id:'owner-a'},accountGeneration:1},closed=0,opened=0,last,sessionOptions;
 const deck={name:'Selected',format:'Standard',cards:[{name:'Plains',qty:60,finish:'foil',printingId:'exact'}]},setup={selected:deck,match:{format:'Standard',difficulty:'Medium',mode:'cpu'},profile:{ownerId:'owner-a',signedIn:true,displayName:'A'}};
 const flow=createPracticeFlow({readAccount:()=>a,readSetup:()=>setup,newId:()=> 'new-match',connect:options=>{last=options;return {ready:ready||Promise.resolve({admission:{admitted:true},cpuAvailable:true}),close(){closed++;}};},makeSession:options=>{sessionOptions=options;return {async open(options){opened++;return game;},close(){closed++;}};}});
 return {flow,deck,setup,account:v=>{a=v;},last:()=>last,closed:()=>closed,opened:()=>opened,emit:g=>sessionOptions.onChange(g)};
}
test('selected account/import list is captured once and opponent stays exact',async()=>{
 const f=fixture();await f.flow.start({opponent:f.deck,seed:123,first:1});const v=f.last();assert.equal(v.ownerId,'owner-a');assert.equal(v.match,'new-match');assert.equal(v.input.engineLists.player.main_deck.length,60);f.deck.cards[0].finish='nonfoil';assert.equal(v.input.decks.player.cards[0].finish,'foil');assert.equal(v.input.decks.opponent.cards[0].printingId,'exact');assert.equal(f.flow.snapshot().phase,'playing');
});
test('account transition during engine startup rejects stale binding and retires worker',async()=>{
 let resolve;const f=fixture({ready:new Promise(r=>{resolve=r;})}),p=f.flow.start({opponent:f.deck,seed:1});f.account({user:{id:'owner-b'},accountGeneration:2});resolve({admission:{admitted:true},cpuAvailable:true});await assert.rejects(p,/ACCOUNT_CHANGED/);assert.equal(f.opened(),0);assert.equal(f.flow.snapshot().matchId,null);assert(f.closed()>0);
});
test('changed account generation retires active session and ignores its late projections',async()=>{
 const f=fixture();await f.flow.start({opponent:f.deck,seed:1});f.account({user:{id:'owner-a'},accountGeneration:2});assert.equal(f.flow.reconcile(),false);f.emit({private:'old owner'});assert.equal(f.flow.snapshot().game,null);assert.equal(f.flow.getSession(),null);
});
test('unadmitted decks and unimplemented difficulty never start a game',async()=>{
 for(const b of [{admission:{admitted:false},cpuAvailable:true},{admission:{admitted:true},cpuAvailable:false}]){const f=fixture({ready:Promise.resolve(b)});assert.equal((await f.flow.start({opponent:f.deck,seed:1})).phase,'unavailable');assert.equal(f.opened(),0);assert(f.closed()>0);}
});
test('resume uses stored input without re-reading or regenerating selected decks',async()=>{
 const f=fixture();f.setup.selected=null;await f.flow.resume('existing');assert.equal(f.last().resume,true);assert.equal(f.last().match,'existing');assert.equal(Object.hasOwn(f.last(),'input'),false);
});
test('a startup outcome needing recovery retains the original match identity',async()=>{
 const f=fixture({game:{status:null,error:'RECOVERY_REQUIRED'}});await f.flow.start({opponent:f.deck,seed:1});assert.equal(f.flow.snapshot().phase,'recovery-required');assert.equal(f.flow.snapshot().matchId,'new-match');await assert.rejects(f.flow.start({opponent:f.deck,seed:1}),/MATCH_ALREADY_OPEN/);
});
test('accepted terminal and recovery projections update the host phase without adding actions',async()=>{
 const f=fixture();await f.flow.start({opponent:f.deck,seed:1});f.emit({status:{terminal:{winner:0}},error:null});assert.equal(f.flow.snapshot().phase,'finished');f.emit({status:null,error:'RECOVERY_REQUIRED'});assert.equal(f.flow.snapshot().phase,'recovery-required');assert.equal(f.opened(),1);
});
test('an account mismatch, missing pregame or Friends selection cannot bind a worker',()=>{
 for(const change of [f=>f.setup.profile.ownerId='owner-b',f=>f.setup.match.mode='friends']){const f=fixture();change(f);assert.throws(()=>f.flow.start({opponent:f.deck,seed:1}));assert.equal(f.last(),undefined);}const f=fixture();assert.throws(()=>f.flow.start({opponent:f.deck}),/PREGAME_REQUIRED/);assert.equal(f.last(),undefined);
});
