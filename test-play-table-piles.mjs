import assert from 'node:assert/strict';
import {battlefieldPiles} from './experiments/phase-engine/match-table.mjs';
const land=(id,name,o={})=>({id,known:true,name,controller:0,isToken:false,tapped:false,type:'Basic Land',types:['Land'],...o});
const guy=(id,o={})=>({id,known:true,name:'Goblin Guide',controller:0,isToken:false,tapped:false,power:2,toughness:2,type:'Creature',types:['Creature'],...o});
const sizes=cards=>battlefieldPiles(cards).map(p=>p.length);
// 12 lands of 3 names give 3 piles of 4.
const lands=[...'abc'].flatMap((n,k)=>Array.from({length:4},(_,i)=>land(k*4+i+1,'Land '+n)));
assert.deepEqual(sizes(lands),[4,4,4]);
// A tapped land splits out; the rest stay a pile.
lands[0].tapped=true;assert.deepEqual(sizes(lands).sort(),[1,4,4,3].sort());
// Two identical ordinary creatures do not pile; three do.
assert.deepEqual(sizes([guy(1),guy(2)]),[1,1]);assert.deepEqual(sizes([guy(1),guy(2),guy(3)]),[3]);
// Tokens pile from two.
const tok=(id,o={})=>guy(id,{isToken:true,name:'Goblin',...o});assert.deepEqual(sizes([tok(1),tok(2)]),[2]);
// Counters, damage, attachments and combat keep a card on its own.
assert.deepEqual(sizes([guy(1),guy(2),guy(3,{counters:{P1P1:1}})]),[1,1,1],'a plain pair of three does not pile once the third differs');
assert.deepEqual(sizes([tok(1),tok(2),tok(3,{damage:1}),tok(4,{attacking:true}),tok(5,{attachments:[9]})]),[2,1,1,1]);
// A face-down card stands alone.
assert.deepEqual(sizes([{id:1,known:false},{id:2,known:false}]),[1,1]);
console.log('tidy board piles ok');
