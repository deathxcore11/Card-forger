import {test} from 'node:test';import assert from 'node:assert/strict';
import {projectRandomEvents,appendRandomOutcomes,validOutcomeTimeline,randomOutcomeText} from './random-outcomes.mjs';
import {createJournal} from './worker-journal.mjs';
import {createMatchAuthority} from './match-authority.mjs';
const die=(result=17,sides=20)=>({type:'DieRolled',data:{player_id:0,sides,result}});
test('outcome projection keeps only authorized roll facts and distinguishes coin success from a face',()=>{
 const rows=projectRandomEvents([die(22),{type:'CoinFlipped',data:{player_id:1,won:false,secret:'PRIVATE'}},{type:'CardDrawn',data:{name:'PRIVATE',object_id:999}},{type:'DieRollIgnored',data:{player_id:0,sides:20,result:1}},die(null)]);
 assert.deepEqual(rows,[{kind:'die',player:0,sides:20,result:22},{kind:'coin',player:1,won:false},{kind:'ignored-die',player:0,sides:20,result:1},{kind:'die',player:0,sides:20,result:null}]);
 assert.equal(randomOutcomeText({outcome:rows[1]}),'CPU flipped a coin · lost');assert.match(randomOutcomeText({outcome:rows[2]}),/ignored/);assert.match(randomOutcomeText({outcome:rows[3]}),/symbolic/);assert(!JSON.stringify(rows).includes('PRIVATE'));
});
test('known malformed random events fail closed, including invalid ignored natural rolls',()=>{
 for(const events of [null,[die(-1)],[die(256)],[die(1,0)],[{...die(),data:{player_id:2,sides:20,result:1}}],[{type:'CoinFlipped',data:{player_id:0,won:1}}],[{type:'DieRollIgnored',data:{player_id:0,sides:6,result:7}}]])assert.throws(()=>projectRandomEvents(events),/INVALID_OUTCOME_EVENTS/);
});
test('all authority submission paths use viewer-authorized outcomes; rejected responses and rollback cannot retain a roll',()=>{
 let accepted=true,filtered=0,restored=false;
 const result=()=>({status:accepted?'applied':'rejected',result:{events:[die(),{type:'CardDrawn',data:{name:'PRIVATE'}}]}});
 const engine={get_filtered_game_state:()=>({state:{}}),submit_action:result,submit_interaction_js:result,restore_game_state(){restored=true;},get_viewer_transition_snapshot_js(seat,events){assert.equal(seat,0);assert.equal(events.length,1);assert.equal(events[0].type,'DieRolled');filtered++;return {events:[{type:'CoinFlipped',data:{player_id:0,won:true}},{type:'CardDrawn',data:{name:'PRIVATE'}}]};}};
 const {adapter,close}=createMatchAuthority({engine,epoch:'outcome-test',policyWorker:{terminate(){}}});
 try{assert.equal(adapter.act({kind:'concede'}),true);assert.deepEqual(adapter.drainOutcomes(),[{kind:'coin',player:0,won:true}]);assert.deepEqual(adapter.drainOutcomes(),[]);
  assert.equal(adapter.respond({}),true);assert.equal(adapter.drainOutcomes().length,1);accepted=false;assert.equal(adapter.respond({}),false);assert.deepEqual(adapter.drainOutcomes(),[]);assert.equal(filtered,2);
  accepted=true;adapter.apply(0,{});adapter.restore('saved');assert(restored);assert.deepEqual(adapter.drainOutcomes(),[]);
 }finally{close();}
});
test('durable timeline bounds memory, preserves event order and rejects forged/duplicate identities',()=>{
 let rows=[];for(let rev=0;rev<20;rev++)rows=appendRandomOutcomes(rows,projectRandomEvents([die()]),rev);
 assert.equal(rows.length,12);assert.equal(rows[0].revision,8);assert(validOutcomeTimeline(rows,19));assert(!validOutcomeTimeline(rows,18));
 assert.throws(()=>appendRandomOutcomes(rows,projectRandomEvents([die()]),19));assert(!validOutcomeTimeline([...rows].reverse(),19));
 assert(!validOutcomeTimeline([{revision:1,order:0,outcome:{kind:'coin',player:0,won:true,secret:'PRIVATE'}}],1));
 const copy=appendRandomOutcomes(rows,[],20);copy[0].outcome.result=99;assert.equal(rows[0].outcome.result,17);
});
function fixture(){
 let state=0,pending=[],saved=null,failWrite=false;
 const engine={start(){state=0;pending=[];},restore(s){state=JSON.parse(s);pending=[];},save:()=>JSON.stringify(state),summary:()=>({terminal:null}),legal:()=>({actor:0,actions:[{type:'PassPriority'}]}),apply(){state++;pending=projectRandomEvents([die(10),{type:'CoinFlipped',data:{player_id:1,won:state%2===0}}]);},drainOutcomes(){const p=pending;pending=[];return p;}};
 const make=()=>createJournal({engine,version:'outcomes-v1',epoch:'test',choose:async()=>({index:0,rng:1}),storage:{read:async()=>structuredClone(saved),write:async(next,revision)=>{if(failWrite)throw Error('failure');assert.equal(saved?.revision??null,revision);saved=structuredClone(next);}}});
 return {make,get saved(){return saved;},get state(){return state;},set failWrite(v){failWrite=v;}};
}
const msg=(op,id,revision)=>({v:1,epoch:'test',id,op,...(op==='create'?{seed:1,first:0}:op==='step'?{revision}:{})});
test('accepted engine/RNG result and timeline commit atomically; duplicate and restored receipt do not roll again',async()=>{
 const f=fixture(),h=f.make();assert((await h(msg('create','c'))).ok);const receipt=await h(msg('step','once',0));assert(receipt.ok);assert.equal(receipt.result.outcomes.length,2);assert.equal(f.state,1);assert.deepEqual(f.saved.outcomes,receipt.result.outcomes);
 assert.deepEqual(await h(msg('step','once',0)),receipt);assert.equal(f.state,1);
 const resumed=f.make();const status=await resumed(msg('resume','r'));assert(status.ok);assert.deepEqual(status.result.outcomes,receipt.result.outcomes);assert.deepEqual(await resumed(msg('step','once',0)),receipt);assert.equal(f.state,1);
});
test('failed outcome persistence restores the engine and does not advertise an uncommitted roll',async()=>{
 const f=fixture(),h=f.make();await h(msg('create','c'));f.failWrite=true;assert.equal((await h(msg('step','failed',0))).error,'RECOVERY_REQUIRED');assert.equal(f.state,0);assert.deepEqual(f.saved.outcomes,[]);
 f.failWrite=false;const resumed=f.make();assert.deepEqual((await resumed(msg('resume','r'))).result.outcomes,[]);assert.equal((await resumed(msg('step','new',0))).result.outcomes.length,2);
});
test('corrupt saved outcome data is refused before recovery; older records without outcomes stay compatible',async()=>{
 const f=fixture(),h=f.make();await h(msg('create','c'));delete f.saved.outcomes;assert((await f.make()(msg('resume','old'))).ok);
 f.saved.outcomes=[{revision:2,order:0,outcome:{kind:'coin',player:0,won:true}}];assert.equal((await f.make()(msg('resume','bad'))).error,'CORRUPT_SAVE');
});
