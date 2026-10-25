import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectCommander,createCommanderProjector} from './commander-projection.mjs';
const card=(id,more={})=>({id,is_commander:true,owner:0,controller:0,zone:'Command',display_visible_to_viewer:true,name:'Ghalta, Primal Hunger',commander_tax:0,...more});
const state=(objects,more={})=>({state:{viewer_projection:0,objects,commander_cast_count:{},commander_damage:[],...more}});
test('public commander designation/tax and recorded casts use exact engine fields',()=>{
 const v=projectCommander(state({1:card(1,{zone:'Battlefield',commander_tax:2})},{commander_cast_count:{1:1},commander_damage:[{commander:1,player:1,damage:12}]}),0);
 assert.deepEqual(v.commanders,[{id:1,owner:0,controller:0,zone:'Battlefield',tax:2,castCount:1}]);
 assert.deepEqual(v.damage,[{commanderId:1,player:1,amount:12}]);assert.equal(v.damageAvailable,true);
});
test('private zones and hidden/face-down identities never enter public commander projection',()=>{
 const objects={1:card(1),2:card(2,{zone:'Library'}),3:card(3,{zone:'Hand'}),4:card(4,{face_down:true}),5:card(5,{display_visible_to_viewer:false}),6:card(6,{name:'Hidden Card'})};
 const v=projectCommander(state(objects,{commander_damage:[{commander:2,player:1,damage:12}]}),0);
 assert.deepEqual(v.commanders.map(c=>c.id),[1]);assert.deepEqual(v.damage,[]);assert(!JSON.stringify(v).includes('Library'));
});
test('missing facts remain unknown and malformed values cannot manufacture totals',()=>{
 const v=projectCommander(state({1:card(1,{commander_tax:-2})},{commander_damage:[{commander:1,player:2,damage:12},{commander:1,player:1,damage:-1},{commander:99,player:1,damage:12}]}),0);
 assert.equal(v.commanders[0].tax,null);assert.equal(v.commanders[0].castCount,null);assert.deepEqual(v.damage,[]);
 assert.equal(projectCommander(state({}, {commander_damage:null}),0).damageAvailable,false);
});
test('raw authority and wrong viewer states are refused',()=>{
 assert.throws(()=>projectCommander({state:{objects:{}}},0),/INVALID_VIEW/);
 assert.throws(()=>projectCommander(state({}),1),/INVALID_VIEW/);
});

test('public designation and damage persist without copying hidden object fields',()=>{
 const ledger=createCommanderProjector();ledger.reset(state({1:card(1)}),0);
 const hidden=state({1:card(1,{zone:'Library',name:'SECRET REPLACEMENT',owner:1,controller:1,commander_tax:99})},{commander_cast_count:{1:1},commander_damage:[{commander:1,player:1,damage:12},{commander:2,player:1,damage:20}]});
 const view=ledger.read(hidden,0);assert.equal(view.coverage,'public-designation-ledger');
 assert.deepEqual(view.commanders,[{id:1,owner:0,name:'Ghalta, Primal Hunger',controller:null,zone:null,tax:null,castCount:1,visible:false}]);
 assert.deepEqual(view.damage,[{commanderId:1,player:1,amount:12}]);assert(!JSON.stringify(view).includes('SECRET'));
});
test('ledger resets on new game, rejects wrong seat and never adopts hidden or zero sentinel IDs',()=>{
 const ledger=createCommanderProjector();assert.equal(ledger.read(state({}),0).coverage,'visible-public-objects');
 ledger.reset(state({0:card(0),1:card(1),2:card(2,{zone:'Library'})}),0);
 assert.deepEqual(ledger.read(state({}),0).commanders.map(c=>c.id),[1]);
 ledger.reset(state({3:card(3)}),0);assert.deepEqual(ledger.read(state({}),0).commanders.map(c=>c.id),[3]);
 assert.throws(()=>ledger.read({state:{viewer_projection:1}},1),/WRONG_SEAT/);
});

test('fresh restored authority falls back to visible objects without claiming hidden history',()=>{
 const ledger=createCommanderProjector(),restored=state({1:card(1,{zone:'Battlefield'}),2:card(2,{zone:'Library'})},{commander_damage:[{commander:1,player:1,damage:12},{commander:2,player:0,damage:7}]});
 const v=ledger.read(restored,0);assert.equal(v.coverage,'visible-public-objects');assert.deepEqual(v.commanders.map(c=>c.id),[1]);assert.deepEqual(v.damage,[{commanderId:1,player:1,amount:12}]);
});
