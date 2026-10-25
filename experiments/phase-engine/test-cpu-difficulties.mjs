import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeCpu,chooseCpu} from './cpu-public-policy.mjs';
import {CPU_POLICY_VERSION} from './visible-cpu-policy.mjs';
import {PUBLIC_CPU_VERSION,makeCpuObservation} from './cpu-public-observation.mjs';
import {CPU_DIFFICULTIES,CPU_PROFILES,CPU_LABELS_READY} from './cpu-difficulty-config.mjs';
import {createCpuPlaybook,currentCpuPlaybook,CPU_PLAYBOOK_VERSION,cpuDeckKey} from './cpu-playbook.mjs';
const card=(mana,power,toughness)=>({creature:true,power,toughness,cost:{generic:mana-1,colored:1,total:mana},keywords:[]});
function packet(difficulty,cards,mana){return {version:PUBLIC_CPU_VERSION,difficulty,legacy:{version:CPU_POLICY_VERSION,ownLife:20,opponentLife:20,opponentBattlefield:[],choices:cards.map(card=>({kind:'cast',available:true,card}))},combat:{seat:0,life:[20,20],objects:[],attackers:[],decision:'Priority',blockCandidates:cards.map(()=>null),attackCandidates:cards.map(()=>null)},hand:{mana,plan:'generic-material',cards,castIndices:cards.map((_,i)=>i)}};}
test('Medium finds a two-spell sequence Easy does not search',()=>{
 const cards=[card(4,4,5),card(3,3,4),card(3,3,4)];assert.equal(chooseCpu(packet('Easy',cards,6),1,{now:()=>0}).index,0);assert.equal(chooseCpu(packet('Medium',cards,6),1,{now:()=>0}).index,1);
});
test('Hard finds a three-spell sequence beyond Medium depth',()=>{
 const cards=[card(5,6,8),card(2,3,3),card(2,3,3),card(2,3,3)];assert.equal(chooseCpu(packet('Medium',cards,6),1,{now:()=>0}).index,0);assert.equal(chooseCpu(packet('Hard',cards,6),1,{now:()=>0}).index,1);
});
test('search uses only own supplied hand and cannot spend future discount below colored costs',()=>{
 const cards=[card(2,4,4),{...card(12,12,12),powerDiscount:true,cost:{generic:10,colored:2,total:12}},card(3,3,3)];
 const p=packet('Hard',cards,4);p.legacy.choices[1]={kind:'unsupported'};p.hand.castIndices[1]=null;
 assert.notEqual(chooseCpu(p,1,{now:()=>0}).index,1);
});
test('deterministic node budgets and timed fallback always return a supplied candidate',()=>{
 for(const difficulty of CPU_DIFFICULTIES){const cards=Array.from({length:24},()=>card(1,2,2)),p=packet(difficulty,cards,10),a=analyzeCpu(p,17,{now:()=>0}),b=analyzeCpu(p,17,{now:()=>0});assert.deepEqual(a,b);assert(a.metrics.nodes<=CPU_PROFILES[difficulty].maxNodes);assert(a.index>=0&&a.index<cards.length);
  let t=0;const timed=analyzeCpu(p,17,{now:()=>t+=100});assert(timed.metrics.budgetExhausted||difficulty==='Easy');assert(timed.index>=0&&timed.index<cards.length);
 }
});
test('all levels choose the life-saving trade and never randomize into the losing line',()=>{
 const o=(id,controller)=>({id,controller,owner:controller,zone:'Battlefield',name:'Arbitrary',display_visible_to_viewer:true,power:12,toughness:12,damage_marked:0,keywords:['Trample'],card_types:{core_types:['Creature']}});
 const e={state:{viewer_projection:1,players:[{life:20,hand:[],library:[]},{life:12,hand:[],library:[]}],objects:{1:o(1,0),2:o(2,1)},battlefield:[1,2],stack:[],combat:{attackers:[{object_id:1,attack_target:{type:'Player',data:1},defending_player:1}]},waiting_for:{type:'DeclareBlockers',data:{player:1,valid_block_targets:{2:[1]}}}}};
 const actions=[{type:'DeclareBlockers',data:{assignments:[]}},{type:'DeclareBlockers',data:{assignments:[[2,1]]}}];
 for(const level of CPU_DIFFICULTIES)for(const seed of [0,1,42,0xffffffff])assert.equal(chooseCpu(makeCpuObservation(e,1,actions,{difficulty:level}),seed).index,1);
});
test('a proposed deck plan is bound to the exact own deck and declared dependencies',()=>{
 const deck={main_deck:['Forest','Bear Cub'],sideboard:[],commander:[]},proposal={version:CPU_PLAYBOOK_VERSION,deckKey:cpuDeckKey(deck),dependencies:['Bear Cub']};
 const book=createCpuPlaybook(deck,proposal);assert(book.proposalAccepted);assert(currentCpuPlaybook(book,deck));assert.equal(currentCpuPlaybook(book,{...deck,main_deck:['Forest']}),null);
 assert.equal(createCpuPlaybook(deck,{...proposal,dependencies:['Missing combo piece']}).proposalAccepted,false);assert.equal(createCpuPlaybook({main_deck:['Unsupported card']}).kind,'generic-material');
});
test('beta tiers are implemented and unknown profiles fail explicitly',()=>{assert.equal(CPU_LABELS_READY,true);assert.throws(()=>chooseCpu(packet('Impossible',[card(1,1,1)],1),1),/INVALID_CPU_DIFFICULTY/);});
