import assert from 'node:assert/strict';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {e,sha} from './cpu-test-runtime.mjs';
import {prepare,deck,state,tracker,candidates} from './mechanics-fixtures.mjs';
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {chooseCpu} from './cpu-public-policy.mjs';
import {rankBlockCandidates,creatureValue} from './cpu-combat-evaluation.mjs';
import {cpuLegalCandidates} from './cpu-legal-candidates.mjs';
import {createMatchAuthority} from './match-authority.mjs';
import {nodePolicyWorker} from './cpu-node-worker.mjs';
const cases=[
 {id:'ghalta-survival',attack:['Ghalta, Primal Hunger'],block:['Ghalta, Primal Hunger'],life:12,blocks:1},
 {id:'two-attackers',attack:['Ghalta, Primal Hunger','Bear Cub'],block:['Ghalta, Primal Hunger','Bear Cub'],life:12,blocks:2},
 {id:'trample-survival',attack:['Ghalta, Primal Hunger'],block:['Ordinary Bear'],life:8,blocks:1},
 {id:'bad-chump',attack:['Ordinary Bear'],block:['Bear Cub'],life:20,blocks:0},
 {id:'first-strike-blocker',attack:['Bear Cub'],block:['Knight of Dawn'],life:2,blocks:1},
 {id:'first-strike-attacker-bad-trade',attack:['Knight of Dawn'],block:['Bear Cub'],life:20,blocks:0},
 {id:'double-strike-survival',attack:['Hearthfire Hobgoblin'],block:['Bear Cub'],life:4,blocks:1},
 {id:'double-strike-large-blocker',attack:['Hearthfire Hobgoblin'],block:['Ordinary Bear'],life:4,blocks:1},
 {id:'deathtouch-bad-trade',attack:['Feral Abomination'],block:['Ghalta, Primal Hunger'],life:20,blocks:0},
 {id:'deathtouch-lifelink-trample',attack:['Ghalta, Primal Hunger'],block:['Gifted Aetherborn'],life:10,blocks:1},
 {id:'marked-damage-bad-trade',attack:['Bear Cub'],block:['Ordinary Bear'],life:20,marked:3,blocks:0},
 {id:'toughness-vigilance-survival',attack:['Tapestry Warden'],block:['Bear Cub'],life:4,blocks:1,tappedBystander:true},
 {id:'indestructible-trample',attack:['Ghalta, Primal Hunger'],block:['Darksteel Myr'],life:12,blocks:1},
 {id:'flying-legal-blocks',attack:['Air Elemental'],block:['Bear Cub','Air Elemental'],life:4,blocks:1},
 {id:'multiple-blockers-uncertainty',attack:['Ordinary Bear'],block:['Bear Cub','Bear Cub'],life:20,uncertainMulti:true},
 {id:'public-trigger-uncertainty',attack:['Virulent Emissary'],block:['Ordinary Bear'],life:20,uncertain:true}
];
const report={task:'CPU-002',runtime:'a86578b23adcd26c',policy:'public-cpu-v1',cases:[],limits:'Engineered positions with unchanged compiled records. Combat predictions are conditional on no intervening responses; no universal rules/strategy guarantee.'};
const authority=createMatchAuthority({engine:e,epoch:'cpu-survival-test',mode:'cpu-test',policyWorker:nodePolicyWorker()});
const additionalAuthorities=Object.fromEntries(['Easy','Hard'].map(difficulty=>[difficulty,createMatchAuthority({engine:e,epoch:'cpu-survival-'+difficulty,mode:'cpu-test',difficulty,policyWorker:nodePolicyWorker()})]));
function finish(t){for(let n=0;n<40&&state(e).phase!=='PostCombatMain'&&state(e).waiting_for.type!=='GameOver';n++){
 if(state(e).waiting_for.type==='AssignCombatDamage'){
  const r=candidates(e)[0],p=makeCpuObservation(e.get_filtered_game_state(r.actor),r.actor,r.actions);t.submit(r.actor,r.actions[chooseCpu(p,777).index]);
 }else t.take('PassPriority');
}assert(state(e).phase==='PostCombatMain'||state(e).waiting_for.type==='GameOver');}
for(const c of cases){
 const result={id:c.id,fixture:c};try{
  const f=prepare(e,deck('Forest',...c.attack,...(c.tappedBystander?['Ghalta, Primal Hunger']:[])),deck('Forest',...c.block));
  const attackers=c.attack.map(name=>f.move(name,0,'Battlefield')[0]),blockers=c.block.map(name=>f.move(name,1,'Battlefield')[0]);f.s.players[1].life=c.life;
  if(c.marked)f.s.objects[blockers[0]].damage_marked=c.marked;
  if(c.tappedBystander){const [id]=f.move('Ghalta, Primal Hunger',0,'Battlefield');f.s.objects[id].tapped=true;}
  result.setupSha256=f.restore();const t=tracker(e);t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');t.take('DeclareAttackers',a=>a.data.attacks.length===attackers.length&&a.data.attacks.every(([id])=>attackers.includes(id)));t.passUntil(s=>s.waiting_for.type==='DeclareBlockers');
  const beforeExpansion=e.export_game_state_json();const expanded=cpuLegalCandidates(e,1,e.get_legal_actions_for_viewer_js(1).actions);assert.equal(e.export_game_state_json(),beforeExpansion,'candidate previews must not mutate engine state');
  const actions=expanded.actions,p=makeCpuObservation(e.get_filtered_game_state(1),1,actions),selection=chooseCpu(p,777),rated=rankBlockCandidates(p.combat),save=e.export_game_state_json(),publicIds=[...state(e).battlefield].sort((a,b)=>a-b);result.expansion={added:expanded.added,examined:expanded.examined,truncated:expanded.truncated};
  assert.equal(p.combat.attackers.length,attackers.length);assert(actions[selection.index]);result.selection=selection;result.action=actions[selection.index];result.predictions=rated;
  const offered=authority.adapter.legal();assert.equal(offered.actor,1);assert.deepEqual(offered.actions,actions);
  const workerSelection=await authority.choose(offered.actions,777,{actor:1,revision:0});assert.equal(workerSelection.index,selection.index);assert.equal(workerSelection.rng,selection.rng);result.workerAccepted=true;
  result.difficulties=['Medium'];for(const [difficulty,other]of Object.entries(additionalAuthorities)){
   const pp=makeCpuObservation(e.get_filtered_game_state(1),1,actions,{difficulty}),direct=chooseCpu(pp,777),remote=await other.choose(actions,777,{actor:1,revision:0});assert.equal(direct.index,selection.index);assert.equal(remote.index,selection.index);result.difficulties.push(difficulty);
  }
  if(c.blocks!==undefined)assert.equal(actions[selection.index].data.assignments.length,c.blocks,'selected block count');
  if(c.uncertain)assert(rated.every(r=>r.evaluation.outcome==='unknown'));
  if(c.uncertainMulti)assert(rated.filter(r=>actions[r.index].data.assignments.length>1).every(r=>r.evaluation.confidence==='estimate'));
  result.witnesses=[];
  for(const r of rated){e.restore_game_state(save);const witness=tracker(e);assert.equal(e.preview_action_js(1,actions[r.index]).status,'applied');witness.submit(1,actions[r.index],{requireCandidate:false});finish(witness);const actual=state(e).players.map(p=>p.life);result.witnesses.push({index:r.index,previewValidated:true,life:actual,waiting:state(e).waiting_for,trace:witness.trace});
   if(r.evaluation.confidence==='supported-no-response-model')assert.deepEqual(actual,r.evaluation.life,'engine/prediction life mismatch for candidate '+r.index);
   if(r.evaluation.confidence==='supported-no-response-model'&&state(e).waiting_for.type!=='GameOver'){
    const losses=[0,0];for(const [i,id]of publicIds.entries())if(p.combat.objects[i].creature&&state(e).objects[id].zone!=='Battlefield')losses[p.combat.objects[i].controller]+=creatureValue(p.combat.objects[i]);
    assert.equal(r.evaluation.lost,losses[1],'own casualties must match engine');assert.equal(r.evaluation.killed,losses[0],'opponent casualties must match engine');
   }
  }
  result.status='PASS';
 }catch(err){result.status='FAIL';result.error=err.stack;}
 report.cases.push(result);console.log(result.status+' '+c.id+(result.error?' '+result.error.split('\n')[0]:''));
}
authority.close();for(const a of Object.values(additionalAuthorities))a.close();report.counts={PASS:report.cases.filter(c=>c.status==='PASS').length,FAIL:report.cases.filter(c=>c.status==='FAIL').length};
report.sources=Object.fromEntries(await Promise.all(['cpu-public-observation.mjs','cpu-combat-evaluation.mjs','cpu-public-policy.mjs','cpu-survival-engine.mjs','cpu-test-runtime.mjs'].map(async p=>[p,sha(await readFile(new URL(p,import.meta.url)))])));
await mkdir('test-results/cpu-survival',{recursive:true});await writeFile('test-results/cpu-survival/report.json',JSON.stringify(report,null,2)+'\n');console.log(report.counts);if(report.counts.FAIL)process.exitCode=1;
