// Optional actual-WASM mechanic regressions. No application UI or shipping pool
// is enabled. Run with the same exact external source/pkg as the Node smoke.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {bootMechanics,sha,PIN} from './mechanics-inputs.mjs';
import {deck,state,snapshot,prepare,candidates,tracker,signature} from './mechanics-fixtures.mjs';
const {engine:e,provenance,networkCalls}=await bootMechanics();
const output=resolve(process.env.CARDSTASHY_PHASE_MECHANICS_OUTPUT||'test-results/phase-mechanics');await mkdir(output,{recursive:true});
function headResult(selected){
 const s=state(e);assert.equal(s.waiting_for.type,'SearchChoice');assert.equal(s.waiting_for.data.player,0);assert.equal(s.waiting_for.data.library_owner,1);
 const t=tracker(e);t.submit(0,{type:'SelectCards',data:{cards:selected}},{requireCandidate:false});
 assert.deepEqual(state(e).players[1].hand,selected);assert.equal(state(e).players[0].life,20);assert.equal(state(e).players[1].life,20);
 const shuffled=t.events.filter(x=>x.type==='PlayerPerformedAction'&&x.data.action==='ShuffledLibrary').map(x=>x.data.player_id);assert.deepEqual(shuffled,[1]);
 return {signature:signature(e),receipt:t.receipt(),selectionWasGenerated:t.trace[0].generatedCandidate};
}
if(process.argv[2]==='--resume-head'){
 const saved=JSON.parse(await readFile(process.argv[3],'utf8'));e.restore_game_state(saved.engine);const result=headResult(saved.selected);assert.equal(networkCalls(),0);console.log(JSON.stringify({...result,provenance,networkCalls:0}));
}else{
 const report={upstreamCommit:PIN,runtimeOrigin:provenance.runtimeOrigin,sourceCommit:provenance.sourceCommit,buildIdentity:provenance.buildIdentity,provenance,runtime:process.version,setup:'Engineered persisted-state positions using unchanged upstream card definitions. Setup movements are not claimed legal gameplay histories.',cases:[],limits:'Selected actual-WASM scenarios only. No broad card/mechanic certification, browser UI, contextual CPU, multiplayer or production package claim. Candidate actions are nonexhaustive; authoritative submit acceptance is reported separately.'};
 async function run(name,body){const start=performance.now();try{const result=await body();report.cases.push({name,passed:true,milliseconds:Math.round(performance.now()-start),...result});console.log(name+': PASS');}catch(error){report.cases.push({name,passed:false,milliseconds:Math.round(performance.now()-start),error:String(error?.stack||error),...(error?.observed?{observed:error.observed}:{})});console.log(name+': FAIL '+String(error));}}
 await run('Head Games: correct opponent, legal noncandidate search, privacy window and fresh-process restore',async()=>{
  const f=prepare(e,deck('Swamp','Head Games','Head Games','Head Games','Head Games'),deck('Forest','Ornithopter','Ornithopter','Ornithopter','Ornithopter'));
  const lands=f.move('Swamp',0,'Battlefield',5),[spell]=f.move('Head Games',0,'Hand'),originalHand=[...f.move('Forest',1,'Hand'),...f.move('Ornithopter',1,'Hand')];const setupSha256=f.restore(),ownLibrary=[...state(e).players[0].library];
  const t=tracker(e);t.take('CastSpell',a=>a.data.object_id===spell);assert(lands.every(id=>state(e).objects[id].tapped));
  t.passUntil(s=>s.waiting_for.type==='EffectZoneChoice');assert.equal(state(e).waiting_for.data.player,1);t.take('SelectCards');
  assert.equal(state(e).waiting_for.type,'SearchChoice');assert.equal(state(e).players[1].hand.length,0);
  const selected=state(e).players[1].library.slice(-2);assert(selected.every(id=>!originalHand.includes(id)));
  const generated=candidates(e).find(x=>x.actor===0).actions;
  assert(!generated.some(a=>JSON.stringify(a)===JSON.stringify({type:'SelectCards',data:{cards:selected}})),'chosen tail pair demonstrates nonexhaustive candidate generation');
  for(const id of selected){assert.notEqual(e.get_filtered_game_state(0).state.objects[id].name,'Hidden Card');assert.equal(e.get_filtered_game_state(1).state.objects[id].name,'Hidden Card');}
  const saved={engine:snapshot(e),selected};const path=resolve(output,'head-games-search-snapshot.json');await writeFile(path,JSON.stringify(saved));
  const original=headResult(selected);assert.equal(original.selectionWasGenerated,false);
  assert.deepEqual(state(e).players[0].library,ownLibrary);assert(originalHand.every(id=>state(e).players[1].library.includes(id)));assert.equal(state(e).objects[spell].zone,'Graveyard');
  for(const id of selected){assert.equal(e.get_filtered_game_state(0).state.objects[id].name,'Hidden Card');assert.notEqual(e.get_filtered_game_state(1).state.objects[id].name,'Hidden Card');}
  const child=spawnSync(process.execPath,[import.meta.filename,'--resume-head',path],{encoding:'utf8',env:{...process.env},maxBuffer:5*1024*1024});assert.equal(child.status,0,child.stderr||child.stdout);const resumed=JSON.parse(child.stdout.trim());assert.deepEqual(resumed.provenance,provenance,'fresh child restore must use the same exact source/build receipt and runtime bytes');assert.deepEqual(resumed.signature,original.signature);assert.equal(resumed.networkCalls,0);
  return {setupSha256,beforeSearch:t.receipt(),search:original.receipt,noncandidateChoiceAccepted:true,correctLibraryShuffledOnly:true,temporarySearchFacePermission:true,freshProcessExactResult:true};
 });
 for(const doubling of [false,true])await run('Raise the Alarm: '+(doubling?'Parallel Lives creates four':'two Soldiers'),()=>{
  const f=prepare(e,deck('Plains','Raise the Alarm','Parallel Lives'),deck('Forest'));const lands=f.move('Plains',0,'Battlefield',2),[spell]=f.move('Raise the Alarm',0,'Hand');if(doubling)f.move('Parallel Lives',0,'Battlefield');const setupSha256=f.restore();
  const t=tracker(e);t.take('CastSpell',a=>a.data.object_id===spell);assert(lands.every(id=>state(e).objects[id].tapped));t.passUntil(s=>s.stack.length===0);
  const tokens=Object.values(state(e).objects).filter(o=>o.is_token&&o.zone==='Battlefield');assert.equal(tokens.length,doubling?4:2);assert.equal(new Set(tokens.map(o=>o.id)).size,tokens.length);
  for(const o of tokens){assert.equal(o.controller,0);assert.equal(o.owner,0);assert.equal(o.power,1);assert.equal(o.toughness,1);assert(o.card_types.subtypes.includes('Soldier'));assert.deepEqual(o.color,['White']);assert.equal(o.tapped,false);assert.equal(o.damage_marked,0);}
  assert.equal(t.events.filter(x=>x.type==='TokenCreated').length,tokens.length);assert.equal(state(e).objects[spell].zone,'Graveyard');assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);
  return {setupSha256,...t.receipt(),tokenCount:tokens.length,distinctInstances:true,exactCharacteristics:true};
 });
 for(const counterResponse of [false,true])await run(counterResponse?'Lightning Bolt answered by Counterspell through real opponent priority':'Lightning Bolt positive control resolves for three damage',()=>{
  const f=prepare(e,deck('Mountain','Lightning Bolt'),deck('Island','Counterspell'));
  const [mountain]=f.move('Mountain',0,'Battlefield'),[bolt]=f.move('Lightning Bolt',0,'Hand'),islands=f.move('Island',1,'Battlefield',2),[counter]=f.move('Counterspell',1,'Hand');const setupSha256=f.restore(),t=tracker(e);
  for(const actor of [0,1])t.submit(actor,{type:'SetPriorityPassingMode',data:{mode:'FullControl'}},{requireCandidate:false});
  t.take('CastSpell',a=>a.data.object_id===bolt);assert.equal(state(e).waiting_for.type,'TargetSelection');assert.equal(state(e).waiting_for.data.player,0);t.take('ChooseTarget',a=>a.data.target.Player===1);
  assert.equal(state(e).objects[mountain].tapped,true);assert.equal(state(e).stack.length,1);assert.equal(state(e).stack[0].source_id,bolt);assert.deepEqual(state(e).stack[0].kind.data.ability.targets,[{Player:1}]);assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);
  t.take('PassPriority');assert.equal(state(e).waiting_for.type,'Priority');assert.equal(state(e).waiting_for.data.player,1,'opponent receives the response window');
  if(counterResponse){
   const row=candidates(e).find(l=>l.actor===1);assert(row.actions.some(a=>a.type==='CastSpell'&&a.data.object_id===counter),'opponent has a real Counterspell cast');
   t.take('CastSpell',a=>a.data.object_id===counter);
   if(state(e).waiting_for.type==='TargetSelection')t.take('ChooseTarget',a=>a.data.target.Object===bolt);
   assert.equal(state(e).stack.length,2);assert.equal(state(e).stack[1].controller,1);assert.equal(state(e).stack[1].source_id,counter);assert.deepEqual(state(e).stack[1].kind.data.ability.targets,[{Object:bolt}]);assert(islands.every(id=>state(e).objects[id].tapped));
  }
  t.passUntil(s=>s.stack.length===0);assert.equal(state(e).objects[bolt].zone,'Graveyard');assert(state(e).players[0].graveyard.includes(bolt));
  if(counterResponse){assert.equal(state(e).objects[counter].zone,'Graveyard');assert(state(e).players[1].graveyard.includes(counter));assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);}
  else{assert.deepEqual(state(e).players.map(p=>p.life),[20,17]);assert.equal(state(e).objects[counter].zone,'Hand');assert(islands.every(id=>!state(e).objects[id].tapped));}
  return {setupSha256,...t.receipt(),targetedOpponent:1,responseActor:1,counterResponse,finalLife:state(e).players.map(p=>p.life),realManaSourcesPaid:true};
 });
 await run('Ninja of the Deep Hours: combat timing, actual mana, return cost and attacking entry',()=>{
  const f=prepare(e,deck('Island','Ninja of the Deep Hours','Ornithopter'),deck('Forest'));const lands=f.move('Island',0,'Battlefield',2),[attacker]=f.move('Ornithopter',0,'Battlefield'),[ninja]=f.move('Ninja of the Deep Hours',0,'Hand');const setupSha256=f.restore(),t=tracker(e);
  for(const actor of [0,1])t.submit(actor,{type:'SetPriorityPassingMode',data:{mode:'FullControl'}},{requireCandidate:false});
  assert(!candidates(e).some(l=>l.actions.some(a=>a.type==='ActivateNinjutsu')),'no ninjutsu in main phase');
  t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');t.take('DeclareAttackers',a=>a.data.attacks.length===1&&a.data.attacks[0][0]===attacker);
  t.passUntil(s=>s.phase==='DeclareBlockers'&&candidates(e).some(l=>l.actions.some(a=>a.type==='ActivateNinjutsu')));
  assert.equal(state(e).waiting_for.data.player,0);const activation=t.take('ActivateNinjutsu',a=>a.data.ninjutsu_object_id===ninja&&a.data.creature_to_return===attacker);
  assert.equal(state(e).objects[attacker].zone,'Hand','return is an activation cost');assert(lands.every(id=>state(e).objects[id].tapped));if(state(e).stack.length===0){const error=new Error('Ninjutsu must put its activated ability on the stack and permit responses before the Ninja enters.');error.observed={setupSha256,afterActivation:{returnedCreatureZone:state(e).objects[attacker].zone,ninjaZone:state(e).objects[ninja].zone,stackEntries:state(e).stack.length,pending:state(e).waiting_for,manaSourcesTapped:lands.every(id=>state(e).objects[id].tapped),opponentLife:state(e).players[1].life},...t.receipt(),activationAction:t.trace.at(-1),activationEvents:(activation.result?.events||[]).map(x=>x.type)};throw error;}
  assert.equal(state(e).objects[ninja].zone,'Hand','Ninja stays in hand while its ability is pending');
  const pending=snapshot(e);t.passUntil(s=>s.objects[ninja].zone==='Battlefield');const entry=signature(e);
  assert.equal(state(e).objects[ninja].tapped,true);const combatAttacker=state(e).combat.attackers.find(a=>a.object_id===ninja);assert(combatAttacker,'Ninja is an actual attacking instance');assert.equal(combatAttacker.defending_player,1);assert.deepEqual(combatAttacker.attack_target,{type:'Player',data:1});
  assert.equal(state(e).players[1].life,20,'entry itself does not deal combat damage');
  e.restore_game_state(pending);const resumed=tracker(e);resumed.passUntil(s=>s.objects[ninja].zone==='Battlefield');assert.deepEqual(signature(e),entry,'restore reproduces the same pre-damage entry state');
  resumed.passUntil(s=>s.players[1].life<20);assert.equal(state(e).players[1].life,18,'subsequent unblocked combat damage is two');assert.equal(state(e).players[0].life,20);
  return {setupSha256,...t.receipt(),correctCostAndDefender:true,lifeAtEntry:20,opponentLifeAfterDamage:18,pendingAbilityRestoreExact:true,resumedThroughDamage:resumed.receipt()};
 });
 await run('Basalt Monolith plus Power Artifact: three finite repeatable net-mana cycles',()=>{
  const f=prepare(e,deck('Island','Basalt Monolith','Power Artifact'),deck('Forest'));const[monolith]=f.move('Basalt Monolith',0,'Battlefield'),[aura]=f.move('Power Artifact',0,'Battlefield');f.s.objects[monolith].attachments=[aura];f.s.objects[aura].attached_to={type:'Object',data:monolith};const setupSha256=f.restore(),t=tracker(e),counts=[];
  for(let cycle=0;cycle<3;cycle++){
   t.submit(0,{type:'ActivateAbility',data:{source_id:monolith,ability_index:0,payment_mode:{type:'Auto'}}},{requireCandidate:false});assert.equal(state(e).objects[monolith].tapped,true);
   t.take('ActivateAbility',a=>a.data.source_id===monolith&&a.data.ability_index===1);t.passUntil(s=>s.stack.length===0);assert.equal(state(e).objects[monolith].tapped,false);
   const count=state(e).players[0].mana_pool.mana.length;counts.push(count);assert.equal(count,(cycle+1)*2,'three generated minus one activation cost');
  }
  assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);return {setupSha256,...t.receipt(),manaAfterEachCycle:counts,finiteRepetitionOnly:true};
 });
 assert.equal(networkCalls(),0);report.networkCalls=0;report.sourceFiles=Object.fromEntries(await Promise.all(['mechanics-inputs.mjs','mechanics-fixtures.mjs','mechanics-smoke.mjs'].map(async file=>[file,sha(await readFile(new URL(file,import.meta.url)))])));
 await writeFile(resolve(output,'mechanics-report.json'),JSON.stringify(report,null,2)+'\n');if(report.cases.some(c=>!c.passed))process.exitCode=1;
}
