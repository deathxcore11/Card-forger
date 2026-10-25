import test from 'node:test';import assert from 'node:assert/strict';
import {searchBlockAssignments,chooseBoundedBlock} from './cpu-block-search.mjs';
import {cpuLegalCandidates} from './cpu-legal-candidates.mjs';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {analyzeCpu} from './cpu-public-policy.mjs';
import {CPU_PROFILES} from './cpu-difficulty-config.mjs';
import {makeSearchBudget} from './cpu-tactical-planning.mjs';
const creature=controller=>({known:true,creature:true,controller,power:2,toughness:2,damage:0,keywords:[],tapped:false});
function combat(n=20,a=4){return {seat:1,life:[20,2],objects:[...Array.from({length:a},()=>creature(0)),...Array.from({length:n},()=>creature(1))],attackers:Array.from({length:a},(_,object)=>({object,target:{kind:'player',seat:1}})),legalBlocks:Array.from({length:n},(_,b)=>Array.from({length:a},(_,i)=>[b+a,i])).flat(),complete:true,uncertain:false,decision:'DeclareBlockers'};}
function envelope(c){const objects=Object.fromEntries(c.objects.map((o,i)=>[i+1,{...o,id:i+1,owner:o.controller,zone:'Battlefield',name:'Public creature',display_visible_to_viewer:true,card_types:{core_types:['Creature']},damage_marked:o.damage}]));
 return {state:{viewer_projection:1,players:[{life:c.life[0],hand:[],library:[]},{life:c.life[1],hand:[],library:[]}],objects,battlefield:Object.keys(objects).map(Number),stack:[],combat:{attackers:c.attackers.map(a=>({object_id:a.object+1,attack_target:{type:'Player',data:1},defending_player:1}))},waiting_for:{type:'DeclareBlockers',data:{player:1,valid_blocker_ids:[...new Set(c.legalBlocks.map(([b])=>b+1))],valid_block_targets:Object.fromEntries([...new Set(c.legalBlocks.map(([b])=>b))].map(b=>[b+1,c.legalBlocks.filter(([x])=>x===b).map(([,a])=>a+1)]))}}}};}
for(const n of [12,13,20])test(n+' blockers: broad legal proposal covers all lethal attackers',()=>{const c=combat(n),r=searchBlockAssignments(c,{now:()=>0});assert(r.candidates.some(x=>x.assignments.length===4&&x.evaluation.outcome==='survive'));assert.equal(r.candidates[0].evaluation.outcome,'survive');assert(r.nodes<=2048);});
test('scarce legal edges are preserved by reassignment',()=>{const c=combat(2,2);c.legalBlocks=[[2,0],[2,1],[3,0]];const best=searchBlockAssignments(c,{now:()=>0}).candidates[0];assert.equal(best.evaluation.outcome,'survive');assert.deepEqual(best.assignments,[[2,1],[3,0]]);});
test('safe nonblock beats an unnecessary sacrifice',()=>{const c=combat(1,1);c.life[1]=20;c.objects[0].power=4;c.objects[0].toughness=5;assert.deepEqual(searchBlockAssignments(c,{now:()=>0}).candidates[0].assignments,[]);});
test('unknown effects stay uncertain in search',()=>{const c=combat();c.uncertain=true;assert(searchBlockAssignments(c,{now:()=>0}).candidates.every(x=>x.evaluation.outcome==='unknown'));});
test('node/time/cancellation stops bound search and preserve legal fallback',()=>{
 const c=combat();let tick=0;const timed=searchBlockAssignments(c,{now:()=>tick+=10,maxMs:20});assert(timed.truncated);assert(timed.nodes<=1);
 const capped=searchBlockAssignments(c,{maxNodes:7,now:()=>0});assert(capped.nodes<=7);assert(capped.truncated);
 const cancelled=searchBlockAssignments(c,{cancelled:()=>true,now:()=>0});assert.equal(cancelled.nodes,0);assert(cancelled.truncated);
});
test('added broad blocks require previews; failed previews never escape',()=>{
 const s=envelope(combat()),base=[{type:'DeclareBlockers',data:{assignments:[]}}],calls=[];
 const engine={get_filtered_game_state:()=>s,preview_action_js:(seat,a)=>{calls.push(a);return {status:'rejected'};}};
 const r=cpuLegalCandidates(engine,1,base,{now:()=>0});assert.deepEqual(r.actions,base);assert(calls.length>0&&calls.length<=4);assert(calls[0].data.assignments.length===4);
});
test('preview work stops after a slow synchronous call and uses best validated result',()=>{
 let clock=0,calls=0;const s=envelope(combat()),base=[{type:'DeclareBlockers',data:{assignments:[]}}];
 const engine={get_filtered_game_state:()=>s,preview_action_js:()=>{calls++;clock+=200;return {status:'applied'};}};
 const r=cpuLegalCandidates(engine,1,base,{now:()=>clock,maxMs:120});assert.equal(calls,1);assert.equal(r.added,1);assert(r.truncated);
});
test('all profiles score broad survival before hundreds of single-block suggestions',()=>{
 const c=combat(),s=envelope(c),base=[{type:'DeclareBlockers',data:{assignments:[]}},...Array.from({length:500},(_,i)=>({type:'DeclareBlockers',data:{assignments:[[5+i%20,1]]}}))];
 const r=cpuLegalCandidates({get_filtered_game_state:()=>s,preview_action_js:()=>({status:'applied'})},1,base,{now:()=>0});
 for(const difficulty of ['Easy','Medium','Hard']){const p=makeCpuObservation(s,1,r.actions,{difficulty}),chosen=analyzeCpu(p,7,{now:()=>0});assert.equal(r.actions[chosen.index].data.assignments.length,4);assert(chosen.metrics.nodes>0&&chosen.metrics.nodes<=CPU_PROFILES[difficulty].maxNodes);}
});
test('expired block budget returns an offered candidate without unbounded scoring',()=>{
 const c=combat();c.blockCandidates=[[],[[4,0],[5,1],[6,2],[7,3]]];let ticks=0;const budget=makeSearchBudget(CPU_PROFILES.Easy,()=>ticks+=100);const chosen=chooseBoundedBlock(c,budget);assert.equal(chosen.index,1);assert.equal(chosen.evaluated,false);assert.equal(budget.stats().nodes,0);
});
test('foreign view and invalid budgets fail explicitly',()=>{const engine={get_filtered_game_state:()=>envelope(combat())};assert.throws(()=>cpuLegalCandidates(engine,0,[]),/INVALID_CPU_VIEW/);assert.throws(()=>cpuLegalCandidates(engine,1,[],{maxPreviews:0}),/BAD_CPU_CANDIDATE_BUDGET/);});
