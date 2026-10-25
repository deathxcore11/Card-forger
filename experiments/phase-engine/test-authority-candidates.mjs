import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMatchAuthority} from './match-authority.mjs';
import {createJournal} from './worker-journal.mjs';

function fixture(mode='cpu-test'){
 let previews=0,submits=0,actor=1,status='applied',throwSubmit=false;
 let decision={type:'DeclareBlockers',data:{player:1,valid_blocker_ids:[11,12],valid_block_targets:{11:[21],12:[22]}}};
 let base=[{type:'DeclareBlockers',data:{assignments:[]}}];
 const engine={
  get_filtered_game_state:seat=>({state:{viewer_projection:seat,waiting_for:decision}}),
  get_legal_actions_for_viewer_js:seat=>({actions:seat===actor?structuredClone(base):[]}),
  preview_action_js(){previews++;return {status:'applied'};},
  submit_action(){submits++;if(throwSubmit)throw Error('engine error');return {status};},
  submit_interaction_js(){submits++;return {status};},
  initialize_game:()=>({events:[]}),restore_game_state(){},export_game_state_json:()=> '{}'
 };
 const authority=createMatchAuthority({engine,epoch:'test',mode,policyWorker:{terminate(){}}});
 return {adapter:authority.adapter,get previews(){return previews;},get submits(){return submits;},set actor(v){actor=v;},set base(v){base=v;},set decision(v){decision=v;},set status(v){status=v;},set throwSubmit(v){throwSubmit=v;}};
}
const context={epoch:'test',revision:4};
test('unchanged decision expands once and returned candidate mutations cannot corrupt the snapshot',()=>{
 const f=fixture(),a=f.adapter.legal(context),n=f.previews,expected=structuredClone(a);
 assert.equal(n,3);a.actions[1].data.assignments[0][0]=999;a.actions.length=0;
 assert.deepEqual(f.adapter.legal(context),expected);assert.equal(f.previews,n);
 const b=f.adapter.legal(context);b.actions[1].data.assignments.length=0;
 assert.deepEqual(f.adapter.legal(context),expected);assert.equal(f.previews,n);
});
test('new revision, wrong epoch and absent revision never reuse expansion',()=>{
 const f=fixture();f.adapter.legal(context);
 for(const c of [{...context,revision:5},{...context,epoch:'other'},undefined,{...context,revision:-1}]){
  const before=f.previews;f.adapter.legal(c);assert(f.previews>before);
 }
});
test('fresh actor, base suggestions and mandatory decision remain authoritative',()=>{
 const f=fixture();f.adapter.legal(context);const before=f.previews;
 f.base=[{type:'DeclareBlockers',data:{assignments:[[11,21]]}}];
 assert.deepEqual(f.adapter.legal(context).actions[0],{type:'DeclareBlockers',data:{assignments:[[11,21]]}});assert(f.previews>before);
 f.actor=0;f.decision={type:'ChooseCard',data:{player:0}};f.base=[{type:'ChooseCard',data:{id:9}}];
 assert.deepEqual(f.adapter.legal(context),{actor:0,actions:[{type:'ChooseCard',data:{id:9}}]});
});
test('all mutation routes, including rejected and thrown submissions, retire the snapshot',()=>{
 for(const route of ['apply','rejected-apply','throw-apply','start','restore','act','respond']){
  const f=fixture('human-timed');f.adapter.legal(context);const before=f.previews;
  if(route==='apply')f.adapter.apply(1,{type:'PassPriority'});
  if(route==='rejected-apply'){f.status='rejected';assert.throws(()=>f.adapter.apply(1,{}));}
  if(route==='throw-apply'){f.throwSubmit=true;assert.throws(()=>f.adapter.apply(1,{}));}
  if(route==='start')f.adapter.start(1,0);
  if(route==='restore')f.adapter.restore('{}');
  if(route==='act'){f.status='rejected';assert.equal(f.adapter.act({kind:'concede'}),false);}
  if(route==='respond'){f.status='rejected';assert.equal(f.adapter.respond({}),false);}
  f.adapter.legal(context);assert(f.previews>before,route);
 }
});
test('cache is isolated by authority instance and final engine rejection is retained',()=>{
 const a=fixture(),b=fixture();a.adapter.legal(context);b.adapter.legal(context);assert.equal(a.previews,3);assert.equal(b.previews,3);
 a.status='rejected';assert.throws(()=>a.adapter.apply(1,a.adapter.legal(context).actions[0]));assert.equal(a.submits,1);
});
test('journal binds both reads to its revision and still rejects a changed legal proposal',async()=>{
 let durable=null,applies=0,changed=false;const contexts=[];
 const engine={start(){},save:()=> '{}',summary:()=>({terminal:null}),legal(c){contexts.push(c);return {actor:1,actions:[{type:changed?'Concede':'PassPriority'}]};},apply(){applies++;}};
 const journal=createJournal({engine,epoch:'test',version:'test',storage:{read:async()=>durable,write:async s=>{durable=s;}},choose:async()=>{changed=true;return {index:0,rng:1};}});
 assert((await journal({v:1,epoch:'test',id:'start',op:'create',seed:1,first:0})).ok);
 const r=await journal({v:1,epoch:'test',id:'step',op:'step',revision:0});
 assert.equal(r.error,'STALE_ACTION');assert.equal(applies,0);assert.deepEqual(contexts,[{epoch:'test',revision:0},{epoch:'test',revision:0}]);
});
