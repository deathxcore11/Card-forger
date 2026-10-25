import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {chooseCpu} from './cpu-public-policy.mjs';
const action=accept=>({type:'PayCombatTax',data:{accept}});
function fixture(){return {state:{viewer_projection:1,players:[{life:20,hand:[7],library:[8]},{life:20,hand:[],library:[9]}],objects:{
  7:{id:7,zone:'Hand',controller:0,get name(){throw Error('PRIVATE_HAND_READ');}},
  8:{id:8,zone:'Library',controller:0,get name(){throw Error('OPPONENT_LIBRARY_READ');}},
  9:{id:9,zone:'Library',controller:1,get name(){throw Error('OWN_LIBRARY_READ');}}},battlefield:[],stack:[],waiting_for:{type:'CombatTaxPayment',data:{player:1,get pending(){throw Error('PENDING_DECLARATION_READ');},get total_cost(){throw Error('PAYMENT_RECONSTRUCTION');}}}}};}
for(const difficulty of ['Easy','Medium','Hard'])test('combat tax honors legal payment without reading hidden information for '+difficulty,()=>{
 const p=makeCpuObservation(fixture(),1,[action(false),action('true'),action(true)],{difficulty});
 assert.deepEqual(p.combatTax,[{available:true,accept:false},null,{available:true,accept:true}]);
 assert.equal(chooseCpu(p,777).index,2);
 assert.doesNotMatch(JSON.stringify(p),/pending|total_cost|PRIVATE|object_id|PayCombatTax/);
});
test('combat tax declines when no legal payment is offered',()=>{
 assert.equal(chooseCpu(makeCpuObservation(fixture(),1,[action(false)]),1).index,0);
});
test('combat tax rejects malformed actions and foreign actors',()=>{
 const e=fixture();assert.throws(()=>chooseCpu(makeCpuObservation(e,1,[action(1)]),1),/CPU_DECISION_UNSUPPORTED/);
 e.state.waiting_for.data.player=0;const p=makeCpuObservation(e,1,[action(true)]);assert.equal(p.combatTax,null);assert.throws(()=>chooseCpu(p,1),/CPU_DECISION_UNSUPPORTED/);
});
test('combat tax policy rejects malformed availability packets',()=>{
 const p=makeCpuObservation(fixture(),1,[action(true)]);p.combatTax[0].accept='true';assert.throws(()=>chooseCpu(p,1),/INVALID_CPU_PACKET/);
 p.combatTax=[];assert.throws(()=>chooseCpu(p,1),/INVALID_CPU_PACKET/);
});
