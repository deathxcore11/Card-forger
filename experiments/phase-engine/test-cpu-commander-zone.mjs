import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {chooseCpu} from './cpu-public-policy.mjs';
const action=accept=>({type:'DecideOptionalEffect',data:{accept}});
function fixture(){return {state:{viewer_projection:1,players:[{life:20,hand:[7],library:[8]},{life:20,hand:[],library:[9]}],objects:{
  7:{id:7,zone:'Hand',controller:0,get name(){throw Error('PRIVATE_HAND_READ');}},
  8:{id:8,zone:'Library',controller:0,get name(){throw Error('OPPONENT_LIBRARY_READ');}},
  9:{id:9,zone:'Library',controller:1,get name(){throw Error('OWN_LIBRARY_READ');}}},battlefield:[],stack:[],waiting_for:{type:'CommanderZoneChoice',data:{player:1,get commander_id(){throw Error('COMMANDER_ID_READ');},get current_zone(){throw Error('ZONE_READ');}}}}};}
for(const difficulty of ['Easy','Medium','Hard'])test('commander zone prefers the offered return without private reads for '+difficulty,()=>{
 const p=makeCpuObservation(fixture(),1,[action(false),action('true'),action(true)],{difficulty});
 assert.deepEqual(p.commanderZone,[{available:true,accept:false},null,{available:true,accept:true}]);assert.equal(chooseCpu(p,777).index,2);
 assert.doesNotMatch(JSON.stringify(p),/commander_id|current_zone|PRIVATE|object_id|DecideOptionalEffect/);
});
test('commander decision uses only offered actions',()=>{
 assert.equal(chooseCpu(makeCpuObservation(fixture(),1,[action(false)]),1).index,0);
 assert.throws(()=>chooseCpu(makeCpuObservation(fixture(),1,[action(1)]),1),/CPU_DECISION_UNSUPPORTED/);
});
test('commander handling cannot authorize a foreign actor or generic optional effect',()=>{
 const e=fixture();e.state.waiting_for.data.player=0;
 assert.equal(makeCpuObservation(e,1,[action(true)]).commanderZone,null);
 assert.throws(()=>chooseCpu(makeCpuObservation(e,1,[action(true)]),1),/CPU_DECISION_UNSUPPORTED/);
 e.state.waiting_for.data.player=1;e.state.waiting_for.type='OptionalEffect';
 assert.equal(makeCpuObservation(e,1,[action(true)]).commanderZone,null);
 assert.throws(()=>chooseCpu(makeCpuObservation(e,1,[action(true)]),1),/CPU_DECISION_UNSUPPORTED/);
});
test('commander policy rejects malformed packets',()=>{
 const p=makeCpuObservation(fixture(),1,[action(true)]);p.commanderZone[0].accept=1;assert.throws(()=>chooseCpu(p,1),/INVALID_CPU_PACKET/);
 p.commanderZone=[];assert.throws(()=>chooseCpu(p,1),/INVALID_CPU_PACKET/);
});
