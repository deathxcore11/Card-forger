import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {chooseCpu} from './cpu-public-policy.mjs';
const action=indices=>({type:'SelectModes',data:{indices}});
function fixture(type='ModeChoice'){
 return {state:{viewer_projection:1,players:[{life:40,hand:[],library:[]},{life:40,hand:[],library:[]}],objects:{},battlefield:[],stack:[],waiting_for:{type,data:{player:1,modal:{mode_count:3,min_choices:1,max_choices:1,allow_repeat_modes:false,get mode_descriptions(){throw Error('MODE_TEXT_READ');}},unavailable_modes:[1],get pending_cast(){throw Error('PENDING_CAST_READ');}}}}};
}
for(const type of ['ModeChoice','AbilityModeChoice'])for(const difficulty of ['Easy','Medium','Hard'])test(type+' completes an offered available mode for '+difficulty,()=>{
 const e=fixture(type),p=makeCpuObservation(e,1,[action([1]),action([2]),action([0])],{difficulty});assert.deepEqual(p.modes,[null,{available:true},{available:true}]);assert.equal(chooseCpu(p,777).index,1);
 assert.doesNotMatch(JSON.stringify(p),/mode_descriptions|pending_cast|indices|source_id/);
});
test('modal choices enforce count, bounds, repeat permission and unavailable modes',()=>{
 const e=fixture();e.state.waiting_for.data.modal.max_choices=2;
 const p=makeCpuObservation(e,1,[action([]),action([-1]),action([3]),action([1]),action([0,0]),action([0,2]),action([0,2,0])]);assert.equal(chooseCpu(p,1).index,5);
 e.state.waiting_for.data.modal.allow_repeat_modes=true;assert.equal(chooseCpu(makeCpuObservation(e,1,[action([0,0])]),1).index,0);
});
test('no available mode and wrong actor remain unsupported',()=>{
 const e=fixture();assert.throws(()=>chooseCpu(makeCpuObservation(e,1,[action([1])]),1),/CPU_DECISION_UNSUPPORTED/);
 e.state.waiting_for.data.player=0;assert.equal(makeCpuObservation(e,1,[action([0])]).modes,null);
 assert.throws(()=>chooseCpu(makeCpuObservation(e,1,[action([0])]),1),/CPU_DECISION_UNSUPPORTED/);
});
