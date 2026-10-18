import assert from 'node:assert/strict';
import {resolveFinish} from './finish-effects.js';
import {finishMaterialProfile} from './finish-materials.js';
const c={game:'ptcg',id:'neo1-9',name:'Lugia',category:'Pokemon',rarity:'Rare',set:{id:'neo1'},variants:[{key:'holofoil',label:'Holofoil',finish:'holofoil'},{key:'firstEditionHolofoil',label:'First Edition Holofoil',finish:'holofoil'}]};
for(const key of ['holofoil','firstEditionHolofoil']){const m=resolveFinish('ptcg',c,{priceFinish:key});assert.equal(m.effect,'ptcg-holo');assert.equal(m.layers[0].mask,'pk-neo1-9-art');assert.equal(finishMaterialProfile('ptcg',c,m),'cosmos-holo');}
assert.equal(resolveFinish('ptcg',{...c,id:'neo1-8'},{priceFinish:'holofoil'}).effect,'unknown');
assert.equal(resolveFinish('ptcg',{...c,variants:[]},{priceFinish:'holofoil'}).effect,'unknown');
console.log('PASS: exact known Neo Lugia holo illustration and cosmos profile; no neighboring-card or unsupported availability inference.');
