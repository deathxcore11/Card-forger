import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {chooseCpu} from './cpu-public-policy.mjs';
const action=choice=>({type:'ChooseOption',data:{choice}});
const creature=(id,zone,controller,subtypes)=>({id,zone,controller,owner:controller,display_visible_to_viewer:true,name:'Visible creature',card_types:{core_types:['Creature'],subtypes},power:2,toughness:2});
function fixture(){
 return {state:{viewer_projection:1,players:[{life:40,hand:[4],library:[5]},{life:40,hand:[1],library:[6]}],objects:{
  1:creature(1,'Hand',1,['Angel']),2:creature(2,'Battlefield',1,['Angel','Cleric']),3:creature(3,'Battlefield',0,['Advisor']),
  4:creature(4,'Hand',0,['Advisor']),5:creature(5,'Library',0,['Advisor']),6:creature(6,'Library',1,['Advisor'])},battlefield:[2,3],stack:[],waiting_for:{type:'NamedChoice',data:{player:1,choice_type:'CreatureType',options:['Advisor','Angel','Cleric'],get source(){throw Error('SOURCE_CONTEXT_READ');}}}}};
}
for(const difficulty of ['Easy','Medium','Hard'])test('named choices prefer an offered own creature type for '+difficulty,()=>{
 const e=fixture(),p=makeCpuObservation(e,1,[action('Bogus'),action('Advisor'),action('Angel'),action('Cleric')],{difficulty});
 assert.deepEqual(p.named,[null,{available:true,preference:0},{available:true,preference:2},{available:true,preference:1}]);
 assert.equal(chooseCpu(p,777).index,2);
 assert.doesNotMatch(JSON.stringify(p),/Angel|Advisor|Cleric|Visible creature|source|ChooseOption/);
});
test('private and face-down creature types cannot influence a named choice',()=>{
 const e=fixture();
 for(const id of [4,5,6])Object.defineProperty(e.state.objects[id].card_types,'subtypes',{get(){throw Error('PRIVATE_SUBTYPE_READ');}});
 e.state.objects[7]={...creature(7,'Battlefield',1,[]),face_down:true};
 Object.defineProperty(e.state.objects[7],'card_types',{get(){throw Error('FACE_DOWN_SUBTYPE_READ');}});e.state.battlefield.push(7);
 const p=makeCpuObservation(e,1,[action('Advisor'),action('Angel')]);assert.equal(chooseCpu(p,1).index,1);
});
test('other finite named choices retain stable engine order without semantic guesses',()=>{
 const e=fixture();e.state.waiting_for.data.choice_type='Color';e.state.waiting_for.data.options=['Blue','Red'];
 assert.equal(chooseCpu(makeCpuObservation(e,1,[action('Green'),action('Red'),action('Blue')]),1).index,1);
});
test('wrong actor, unoffered names and free-form choices stay unsupported',()=>{
 const e=fixture();assert.throws(()=>chooseCpu(makeCpuObservation(e,1,[action('Bogus')]),1),/CPU_DECISION_UNSUPPORTED/);
 e.state.waiting_for.data.player=0;assert.equal(makeCpuObservation(e,1,[action('Angel')]).named,null);
 assert.throws(()=>chooseCpu(makeCpuObservation(e,1,[action('Angel')]),1),/CPU_DECISION_UNSUPPORTED/);
 e.state.waiting_for.data.player=1;e.state.waiting_for.data.options=[];e.state.waiting_for.data.choice_type='CardName';
 assert.equal(makeCpuObservation(e,1,[action('Angel')]).named,null);
});
test('policy rejects malformed named-choice packets',()=>{
 const p=makeCpuObservation(fixture(),1,[action('Angel')]);
 p.named[0].preference=Infinity;assert.throws(()=>chooseCpu(p,1),/INVALID_CPU_PACKET/);
 p.named=[];assert.throws(()=>chooseCpu(p,1),/INVALID_CPU_PACKET/);
});
