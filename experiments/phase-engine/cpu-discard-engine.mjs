import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {e} from './cpu-test-runtime.mjs';import {prepare,deck,state,tracker,candidates} from './mechanics-fixtures.mjs';
import {createMatchAuthority} from './match-authority.mjs';import {nodePolicyWorker} from './cpu-node-worker.mjs';
const report={task:'CPU-003 mandatory discard',cases:[]};
for(const count of [8,9]){
 const f=prepare(e,deck('Forest','Bear Cub','Ghalta, Primal Hunger'),deck('Forest'));f.move('Forest',0,'Hand',count-2);f.move('Bear Cub',0,'Hand');f.move('Ghalta, Primal Hunger',0,'Hand');f.move('Forest',0,'Battlefield',6);const setupSha256=f.restore(),t=tracker(e);
 for(let i=0;i<80&&state(e).waiting_for.type!=='DiscardToHandSize';i++){const r=candidates(e)[0],action=r.actions.find(a=>a.type==='PassPriority')||r.actions.find(a=>a.type==='DeclareAttackers'&&!a.data.attacks.length);assert(action);t.submit(r.actor,action);}
 assert.equal(state(e).waiting_for.type,'DiscardToHandSize');const save=e.export_game_state_json();
 for(const difficulty of ['Easy','Medium','Hard']){
  e.restore_game_state(save);const a=createMatchAuthority({engine:e,epoch:'discard-'+difficulty,mode:'cpu-test',difficulty,policyWorker:nodePolicyWorker()});
  try{const offered=a.adapter.legal(),proposal=await a.choose(offered.actions,42,{actor:0,revision:0}),action=offered.actions[proposal.index];assert.equal(action.type,'SelectCards');assert.equal(action.data.cards.length,count-7);assert(action.data.cards.every(id=>state(e).objects[id].name==='Forest'));a.adapter.apply(0,action);assert.equal(state(e).players[0].hand.length,7);report.cases.push({difficulty,count,setupSha256,action,status:'PASS',remainingHand:7});console.log('PASS '+difficulty+' discard '+(count-7));}finally{a.close();}
 }
}
await mkdir('test-results/cpu-discard',{recursive:true});await writeFile('test-results/cpu-discard/report.json',JSON.stringify(report,null,2)+'\n');
