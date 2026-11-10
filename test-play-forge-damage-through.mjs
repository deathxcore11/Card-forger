import assert from 'node:assert/strict';
import {damageThrough,throughText} from './experiments/forge-proof/damage-through.mjs';
const mk=(cards)=>({seat:0,players:[{seat:0,nativeId:10},{seat:1,nativeId:11}],cards:cards.map((c,i)=>({id:i+1,zone:'Battlefield',controller:1,attacking:true,attackTarget:{kind:'player',id:10},power:2,keywords:[],attachments:[],blockingIds:[],blocking:false,...c}))});
const blocker=(id,blocks)=>({id,controller:0,attacking:false,blocking:true,blockingIds:blocks,power:1,keywords:[]});
// 3 attackers (2, 3, 4), the 3-power one blocked.
let s=mk([{power:2},{power:3},{power:4},{id:9,controller:0,attacking:false,blocking:true,blockingIds:[2],power:1,keywords:[]}]);
assert.deepEqual(damageThrough(s),{n:6,atLeast:false},'only unblocked power counts');
assert.deepEqual(throughText(damageThrough(s),20),{hurt:true,atLeast:false,head:'6 damage gets through',sub:'Your life: 20 → 14'});
// Everything blocked: green, life stays.
s=mk([{power:2},{id:9,controller:0,attacking:false,blocking:true,blockingIds:[1],power:1,keywords:[]}]);
assert.deepEqual(damageThrough(s),{n:0,atLeast:false});assert.equal(throughText(damageThrough(s),20).sub,'Your life stays at 20');
// Trample unblocked: At least. Trample blocked: still At least.
s=mk([{power:5,keywords:['Trample']},{power:1}]);assert.deepEqual(damageThrough(s),{n:6,atLeast:true});assert.match(throughText(damageThrough(s),20).head,/^At least 6/);
s=mk([{power:5,keywords:[{text:'Trample'}]},{id:9,controller:0,attacking:false,blocking:true,blockingIds:[1],power:1,keywords:[]},{power:1}]);assert.equal(damageThrough(s).atLeast,true);
// Nothing certain: the only unblocked attacker has double strike and 0 shown power, or keywords unknown with power 0.
s=mk([{power:0,keywords:null}]);assert.equal(damageThrough(s),null,'at least 0 hides the chip');
// Equipment on an attacker makes it uncertain.
s=mk([{power:3,attachments:[77]}]);assert.deepEqual(damageThrough(s),{n:3,atLeast:true});
// A pod: attacks aimed at another player do not count.
s=mk([{power:3,attackTarget:{kind:'player',id:12}},{power:2}]);assert.deepEqual(damageThrough(s),{n:2,atLeast:false});
// No attackers: no chip.
assert.equal(damageThrough(mk([{attacking:false}])),null);
console.log('damage through ok');
