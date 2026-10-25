// Optional real-WASM response proof. Engineered starting positions, never a
// shipping pool or substitute for the preserved mechanics-smoke regressions.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {bootMechanics,CARD_NAMES,sha} from './mechanics-inputs.mjs';
import {deck,state,snapshot,prepare,candidates,tracker,signature} from './mechanics-fixtures.mjs';

const {engine:e,provenance,networkCalls}=await bootMechanics({cardNames:[...CARD_NAMES,'Stifle']});
const output=resolve(process.env.CARDSTASHY_PHASE_RESPONSE_OUTPUT||'test-results/phase-ninjutsu-response');
await mkdir(output,{recursive:true});

function castStifle(t,{stifle,ability,opponentLand}){
 t.take('PassPriority');
 assert.equal(state(e).waiting_for.type,'Priority');
 assert.equal(state(e).waiting_for.data.player,1);
 t.take('CastSpell',a=>a.data.object_id===stifle);
 if(state(e).waiting_for.type==='TargetSelection')t.take('ChooseTarget',a=>a.data.target.Object===ability);
 assert.equal(state(e).stack.length,2,'real Stifle response is above the activated ability');
 const top=state(e).stack.at(-1);
 assert.equal(top.source_id,stifle);assert.equal(top.controller,1);
 assert.deepEqual(top.kind.data.ability.targets,[{Object:ability}]);
 assert.equal(state(e).objects[opponentLand].tapped,true);
}

function finish({creature,returned,stifle,lands,opponentLand}){
 const t=tracker(e);
 t.passUntil(s=>s.stack.length===0);
 const s=state(e);
 assert.equal(s.objects[creature].zone,'Hand','countered ninjutsu never moves its source onto the battlefield');
 assert.equal(s.objects[returned].zone,'Hand','returning the attacker was a paid cost');
 assert(lands.every(id=>s.objects[id].tapped),'paid lands stay tapped');
 assert.equal(s.players[0].mana_pool.mana.length,0,'no mana refund');
 assert.equal(s.objects[opponentLand].tapped,true,'Stifle pays real blue mana');
 assert.equal(s.objects[stifle].zone,'Graveyard');
 assert(s.players[1].graveyard.includes(stifle));
 assert(!s.combat.attackers.some(a=>[creature,returned].includes(a.object_id)));
 assert.deepEqual(s.players.map(p=>p.life),[20,20]);
 assert.equal(e.get_filtered_game_state(1).state.objects[creature].name,'Hidden Card','temporary ninjutsu reveal retires with its stack entry');
 assert(!t.events.some(x=>x.type==='NinjutsuResolved'),'countered ability does not resolve');
 t.passUntil(s=>s.phase==='PostCombatMain');
 assert.deepEqual(state(e).players.map(p=>p.life),[20,20],'neither the returned attacker nor the countered entrant deals combat damage');
 return {signature:signature(e),receipt:t.receipt()};
}

function finishUntap({monolith,stifle,lands,opponentLand}){
 const t=tracker(e);t.passUntil(s=>s.stack.length===0);
 assert.equal(state(e).objects[monolith].tapped,true,'countered untap does not resolve');
 assert.equal(state(e).objects[stifle].zone,'Graveyard');
 assert(lands.every(id=>state(e).objects[id].tapped));
 assert.equal(state(e).objects[opponentLand].tapped,true);
 assert.equal(state(e).players[0].mana_pool.mana.length,0);
 assert.deepEqual(state(e).players.map(p=>p.life),[20,20]);
 return {signature:signature(e),receipt:t.receipt()};
}

async function freshResponse(ids,kind,label){
 const path=resolve(output,label+'-stifle-pending.json');
 await writeFile(path,JSON.stringify({engine:snapshot(e),ids,kind}));
 const original=kind==='untap'?finishUntap(ids):finish(ids);
 const child=spawnSync(process.execPath,[import.meta.filename,'--resume-stifle',path],{encoding:'utf8',env:{...process.env},timeout:90_000,maxBuffer:5*1024*1024});
 assert.equal(child.status,0,child.stderr||child.stdout);
 const resumed=JSON.parse(child.stdout.trim());
 assert.deepEqual(resumed.provenance,provenance);
 assert.deepEqual(resumed.signature,original.signature);
 assert.deepEqual(resumed.receipt,original.receipt,'restored accepted response suffix matches exactly');
 assert.equal(resumed.networkCalls,0);
 return original;
}

if(process.argv[2]==='--resume-stifle'){
 const saved=JSON.parse(await readFile(process.argv[3],'utf8'));
 e.restore_game_state(saved.engine);
 assert.equal(state(e).stack.length,2,'fresh process restores both the response and paid ninjutsu');
 assert(['untap','ninjutsu'].includes(saved.kind));
 const result=saved.kind==='untap'?finishUntap(saved.ids):finish(saved.ids);
 assert.equal(networkCalls(),0);
 console.log(JSON.stringify({...result,provenance,networkCalls:0}));
}else{
 const report={provenance,runtime:process.version,
  setup:'Engineered persisted-state positions with 21 unchanged records from the hash-verified integration fixture. Subsequent actions are validated by the actual runtime.',
  cases:[],limits:'One ordinary-ability response control and selected printed/granted ninjutsu responses. Fresh Node process recovery, not browser offline or journal idempotency. No UI, engine adoption, CPU or all-card claim.'};
 // This control must work even on the original broken-ninjutsu runtime. It
 // independently checks the exact Stifle card, target ID and response helper.
 try{
  const f=prepare(e,deck('Island','Basalt Monolith'),deck('Island','Stifle'));
  const lands=f.move('Island',0,'Battlefield',3),[monolith]=f.move('Basalt Monolith',0,'Battlefield');
  const [opponentLand]=f.move('Island',1,'Battlefield'),[stifle]=f.move('Stifle',1,'Hand');
  f.s.objects[monolith].tapped=true;
  const setupSha256=f.restore(),t=tracker(e);
  for(const actor of [0,1])t.submit(actor,{type:'SetPriorityPassingMode',data:{mode:'FullControl'}},{requireCandidate:false});
  t.take('ActivateAbility',a=>a.data.source_id===monolith&&a.data.ability_index===1);
  assert.equal(state(e).stack.length,1);assert(lands.every(id=>state(e).objects[id].tapped));
  castStifle(t,{stifle,ability:state(e).stack[0].id,opponentLand});
  const original=await freshResponse({monolith,stifle,lands,opponentLand},'untap','control');
  report.cases.push({name:'Positive control: Stifle counters Basalt Monolith untap',passed:true,setupSha256,
   beforeResponse:t.receipt(),afterResponse:original.receipt,finalSignatureSha256:sha(JSON.stringify(original.signature)),freshProcessResponseRestoreExact:true});
  console.log('Stifle positive control: PASS');
 }catch(error){
  report.cases.push({name:'Positive control: Stifle counters Basalt Monolith untap',passed:false,error:String(error.stack||error)});
  console.log('Stifle positive control: FAIL '+String(error));
 }
 for(const granted of [false,true]){
  const name=granted?'Stifle counters Satoru-granted ninjutsu after returning Satoru':'Stifle counters printed ninjutsu after paid return';
  const started=performance.now();
  try{
   const player=granted?deck('Forest','Forest','Island','Swamp','Satoru Umezawa','Grizzly Bears'):deck('Island','Ninja of the Deep Hours','Ornithopter');
   const f=prepare(e,player,deck('Island','Stifle'));
   const lands=granted?[...f.move('Forest',0,'Battlefield',2),...f.move('Island',0,'Battlefield'),...f.move('Swamp',0,'Battlefield')]:f.move('Island',0,'Battlefield',2);
   const [returned]=f.move(granted?'Satoru Umezawa':'Ornithopter',0,'Battlefield');
   const [creature]=f.move(granted?'Grizzly Bears':'Ninja of the Deep Hours',0,'Hand');
   const [opponentLand]=f.move('Island',1,'Battlefield'),[stifle]=f.move('Stifle',1,'Hand');
   const ids={creature,returned,stifle,lands,opponentLand},setupSha256=f.restore(),t=tracker(e);
   for(const actor of [0,1])t.submit(actor,{type:'SetPriorityPassingMode',data:{mode:'FullControl'}},{requireCandidate:false});
   t.passUntil(s=>s.waiting_for.type==='DeclareAttackers');
   t.take('DeclareAttackers',a=>a.data.attacks.length===1&&a.data.attacks[0][0]===returned);
   t.passUntil(s=>s.phase==='DeclareBlockers'&&candidates(e).some(l=>l.actor===0&&l.actions.some(a=>a.type==='ActivateNinjutsu'&&a.data.ninjutsu_object_id===creature&&a.data.creature_to_return===returned)));
   t.take('ActivateNinjutsu',a=>a.data.ninjutsu_object_id===creature&&a.data.creature_to_return===returned);
   assert.equal(state(e).objects[returned].zone,'Hand');
   assert(lands.every(id=>state(e).objects[id].tapped));
   assert.equal(state(e).stack.length,1,'paid ninjutsu must await a real opponent response');
   assert.equal(state(e).objects[creature].zone,'Hand');
   const ability=state(e).stack[0].id;
   assert(ability!==undefined&&ability!==creature,'the response targets the activated ability, not its source card');
   assert.notEqual(e.get_filtered_game_state(1).state.objects[creature].name,'Hidden Card','pending ninjutsu has its required reveal');
   castStifle(t,{stifle,ability,opponentLand});
   const original=await freshResponse(ids,'ninjutsu',granted?'granted':'printed');
   report.cases.push({name,passed:true,milliseconds:Math.round(performance.now()-started),setupSha256,
    beforeResponse:t.receipt(),afterResponse:original.receipt,finalSignatureSha256:sha(JSON.stringify(original.signature)),
    targetedStackAbility:true,costsRetained:true,noEntryOrCombatDamage:true,revealRetired:true,freshProcessResponseRestoreExact:true});
   console.log(name+': PASS');
  }catch(error){
   report.cases.push({name,passed:false,milliseconds:Math.round(performance.now()-started),error:String(error.stack||error)});
   console.log(name+': FAIL '+String(error));
  }
 }
 assert.equal(networkCalls(),0);report.networkCalls=0;
 report.sourceFiles=Object.fromEntries(await Promise.all(['mechanics-inputs.mjs','mechanics-fixtures.mjs','ninjutsu-response-engine.mjs'].map(async file=>[file,sha(await readFile(new URL(file,import.meta.url)))])));
 await writeFile(resolve(output,'ninjutsu-response-report.json'),JSON.stringify(report,null,2)+'\n');
 if(report.cases.some(c=>!c.passed))process.exitCode=1;
}
