import {test} from 'node:test';import assert from 'node:assert/strict';
import {projectSeat,createSeatController} from './seat-surface.mjs';
function fixture(){
 const obj=(id,name,zone,owner,extra={})=>({id,name,zone,owner,controller:owner,display_visible_to_viewer:name!=='Hidden Card',printed_ref:{oracle_id:name+'-oracle'},...extra});
 const state={viewer_projection:0,turn_number:1,phase:'PreCombatMain',active_player:0,priority_player:0,waiting_for:{type:'Priority'},players:[{life:20,hand:[1],library:[2],graveyard:[]},{life:20,hand:[3],library:[4,5],graveyard:[]}],battlefield:[6,7],stack:[],objects:{1:obj(1,'Forest','Hand',0),2:obj(2,'SecretOwnDraw','Library',0),3:obj(3,'OpponentSecret','Hand',1),4:obj(4,'FutureA','Library',1),5:obj(5,'FutureB','Library',1),6:obj(6,'Grizzly Bears','Battlefield',0,{power:3,toughness:3,damage_marked:1,counters:{'+1/+1':1}}),7:obj(7,'Hidden Card','Battlefield',1,{face_down:true,base_name:'HiddenFaceSecret'})},rng_seed:999,pending_trigger:{secret:'INTERNAL'}};
 return {state,derived:{debug_library_cards:[{name:'SecretOwnDraw'}]}};
}
test('drops private zones, future order, base identity, raw rules and RNG',()=>{const p=projectSeat(fixture(),0),wire=JSON.stringify(p);for(const secret of ['SecretOwnDraw','OpponentSecret','FutureA','FutureB','HiddenFaceSecret','INTERNAL','debug_library','rng_seed'])assert(!wire.includes(secret));assert.deepEqual(p.players.map(x=>x.libraryCount),[1,2]);assert.deepEqual(p.hand,[1]);assert.deepEqual(p.cards.find(c=>c.id===6).counters,{'+1/+1':1});assert.equal(p.cards.find(c=>c.id===6).damage,1);});
test('different hidden worlds produce the same surface',()=>{const a=fixture(),b=fixture();b.state.players[1].library.reverse();b.state.objects[2].name='OtherOwnDraw';b.state.objects[3].name='OtherSecret';b.state.objects[4].name='OtherFuture';b.state.rng_seed=123;assert.deepEqual(projectSeat(a,0),projectSeat(b,0));});
test('base stats and token identity are visible facts only on authorized objects',()=>{const f=fixture();Object.assign(f.state.objects[6],{base_power:2,base_toughness:2,is_token:true,display_source:'Token'});Object.assign(f.state.objects[7],{base_power:99,base_toughness:99,is_token:true});const v=projectSeat(f,0),known=v.cards.find(c=>c.id===6),hidden=v.cards.find(c=>c.id===7);assert.equal(known.basePower,2);assert.equal(known.power,3);assert.equal(known.isToken,true);assert.equal(hidden.basePower,undefined);assert.equal(hidden.isToken,undefined);});
test('cannot change the bound seat or accept unscoped state',()=>{assert.throws(()=>projectSeat(fixture(),1),/INVALID_VIEW/);const f=fixture();delete f.state.viewer_projection;assert.throws(()=>projectSeat(f,0),/INVALID_VIEW/);});
test('unsupported decision cannot leak hidden candidate lists',()=>{const f=fixture();f.state.waiting_for={type:'SearchChoice',data:{player:0,cards:[2,4,5]}};const p=projectSeat(f,0);assert.equal(p.decision.supported,false);assert(!JSON.stringify(p).includes('Future'));});
test('human action uses an offered epoch/revision-bound token and retains RNG',()=>{let f=fixture();const actions=[{type:'PlayLand',data:{object_id:1,card_id:1}},{type:'PassPriority'}],engine={get_filtered_game_state:()=>f,get_legal_actions_for_viewer_js:()=>({actions})},c=createSeatController({engine,seat:0,epoch:'session-one'});const view=c.read(3),choice=view.choices[0];assert.equal(choice.label,'Play Forest');assert.deepEqual(c.select(actions,99,{choice:choice.token,revision:3,actor:0}),{index:0,rng:99});assert.throws(()=>c.select(actions,99,{choice:choice.token,revision:4,actor:0}),/STALE_CHOICE/);assert.throws(()=>c.select(actions,99,{choice:choice.token,revision:3,actor:1}),/WRONG_SEAT/);assert.throws(()=>c.select(actions,99,{choice:'another-session:3:0',revision:3,actor:0}),/STALE_CHOICE/);});
test('inspecting is read-only and changed candidates invalidate the choice',()=>{const f=fixture(),before=JSON.stringify(f),actions=[{type:'PlayLand',data:{object_id:1}}],c=createSeatController({engine:{get_filtered_game_state:()=>f,get_legal_actions_for_viewer_js:()=>({actions})},seat:0,epoch:'one'}),v=c.read(0);assert.equal(JSON.stringify(f),before);assert.throws(()=>c.select([{type:'PassPriority'}],1,{choice:v.choices[0].token,revision:0,actor:0}),/STALE_CHOICE/);});
test('mulligan bottoming cannot be offered as another free keep/mulligan',()=>{
 const f=fixture();f.state.waiting_for={type:'MulliganDecision',data:{pending:[{player:0,phase:{type:'BottomCards',count:1}}]}};
 const c=createSeatController({engine:{get_filtered_game_state:()=>f,get_legal_actions_for_viewer_js:()=>({actions:[{type:'MulliganDecision',data:{choice:{type:'Mulligan'}}}]})},seat:0,epoch:'one'});
 const surface=c.read(8);assert.deepEqual(surface.choices,[]);assert.equal(surface.unavailableReason,'DECISION_NOT_IMPLEMENTED');
});
test('single-color mana fallback exposes only offered revision-bound choices',()=>{
 const f=fixture();f.state.waiting_for={type:'ChooseManaColor',data:{player:0,choice:{type:'SingleColor',data:{options:['White','Green']}}}};
 const actions=['White','Green'].map(color=>({type:'ChooseManaColor',data:{choice:{type:'SingleColor',data:color},count:1}}));
 const c=createSeatController({engine:{get_filtered_game_state:()=>f,get_legal_actions_for_viewer_js:()=>({actions})},seat:0,epoch:'mana'}),v=c.read(8);
 assert.equal(v.canAct,true);assert.deepEqual(v.choices.map(c=>c.label),['Choose white mana','Choose green mana']);assert(!JSON.stringify(v).includes('OpponentSecret'));
 assert.equal(c.select(actions,7,{choice:v.choices[1].token,revision:8,actor:0}).index,1);
 assert.throws(()=>c.select(actions,7,{choice:v.choices[1].token,revision:9,actor:0}),/STALE_CHOICE/);
 assert.throws(()=>c.select(actions,7,{choice:v.choices[1].token,revision:8,actor:1}),/WRONG_SEAT/);
 assert.throws(()=>c.select([...actions].reverse(),7,{choice:v.choices[1].token,revision:8,actor:0}),/STALE_CHOICE/);
});
test('mana fallback does not invent choices or accept batch/combination/foreign decisions',()=>{
 for(const scenario of ['empty','batch','combination','foreign']){
  const f=fixture();f.state.waiting_for={type:'ChooseManaColor',data:{player:scenario==='foreign'?1:0,choice:{type:scenario==='combination'?'Combination':'SingleColor',data:{options:['Green']}}}};
  const actions=scenario==='empty'?[]:[{type:'ChooseManaColor',data:{choice:{type:'SingleColor',data:'Green'},count:scenario==='batch'?2:1}}];
  const c=createSeatController({engine:{get_filtered_game_state:()=>f,get_legal_actions_for_viewer_js:()=>({actions})},seat:0,epoch:'mana'});
  assert.equal(c.read(1).canAct,false,scenario);
 }
});
