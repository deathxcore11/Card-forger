// Engineered initial positions; every claimed cast/attack/damage transition is
// subsequently accepted by the unchanged shipped WASM. Not a complete match.
import assert from 'node:assert/strict';
import {e} from './cpu-test-runtime.mjs';
import {tracker,state} from './mechanics-fixtures.mjs';
import {projectCommander,createCommanderProjector} from './commander-projection.mjs';
import {RUNTIME_IDENTITY} from './runtime-assets.mjs';
const list={main_deck:Array(99).fill('Forest'),commander:['Ghalta, Primal Hunger']};
function init(){e.initialize_game({player:list,opponent:list},12345,e.getFormatRegistry().find(f=>f.format==='Commander').default_config,null,2,0);return JSON.parse(e.export_game_state_json());}
function main(s,phase='PreCombatMain'){s.phase=phase;s.waiting_for={type:'Priority',data:{player:0}};s.active_player=0;s.priority_player=0;s.turn_number=2;s.priority_pass_count=0;s.priority_passes=[];s.combat=null;}
const view=seat=>projectCommander(e.get_filtered_game_state(seat),seat);
const fixtures=[];
const ledgers=[createCommanderProjector(),createCommanderProjector()];
function resetLedgers(){for(const seat of [0,1])ledgers[seat].reset(e.get_filtered_game_state(seat),seat);}
const ledgerView=seat=>ledgers[seat].read(e.get_filtered_game_state(seat),seat);
{
 const save=init(),s=save.state,c=Object.values(s.objects).find(o=>o.is_commander&&o.owner===0);
 resetLedgers();const initial=view(0);assert.equal(initial.commanders.length,2);assert.equal(initial.commanders.find(o=>o.id===c.id).tax,0);assert.equal(initial.commanders.find(o=>o.id===c.id).castCount,null);
 for(const o of Object.values(s.objects).filter(o=>o.owner===0&&o.zone==='Library').slice(0,14)){s.players[0].library=s.players[0].library.filter(n=>n!==o.id);o.zone='Battlefield';o.tapped=false;o.entered_battlefield_turn=1;s.battlefield.push(o.id);}
 const oc=Object.values(s.objects).find(o=>o.is_commander&&o.owner===1);s.command_zone=s.command_zone.filter(id=>id!==oc.id);oc.zone='Battlefield';oc.entered_battlefield_turn=1;s.battlefield.push(oc.id);
 main(s);e.restore_game_state(JSON.stringify(save));const t=tracker(e);
 // Generated candidate proves this exact Command-zone cast; it is not fabricated by the UI.
 t.take('CastSpell',a=>a.data.object_id===c.id);const announced=view(0);
 assert.equal(announced.commanders.find(o=>o.id===c.id).zone,'Stack');assert.equal(announced.commanders.find(o=>o.id===c.id).tax,2);assert.equal(announced.commanders.find(o=>o.id===c.id).castCount,1);
 t.passUntil(st=>st.stack.length===0);const resolved=view(0);assert.equal(resolved.commanders.find(o=>o.id===c.id).zone,'Battlefield');
 assert.deepEqual(resolved,view(1));fixtures.push({id:'COMMANDER-CAST',status:'PASS',initial,announced,resolved,trace:structuredClone(t.trace)});
 let attacked=false,recast=false,returned=false;
 for(let n=0;n<100&&!recast;n++){
  const st=state(e),kind=st.waiting_for.type;
  const rows=[0,1].map(actor=>({actor,...e.get_legal_actions_for_viewer_js(actor)})).filter(r=>r.actions.length);
  if(kind==='Priority'){
   const cast=rows.find(r=>r.actor===0)?.actions.find(a=>a.type==='CastSpell'&&a.data.object_id===c.id);
   if(cast&&returned){t.submit(0,cast);recast=true;}else t.take('PassPriority');
  }else if(kind==='DeclareAttackers'){
   if(st.active_player===0&&st.turn_number>=4){t.take('DeclareAttackers',a=>a.data.attacks.some(([id])=>id===c.id));attacked=true;}
   else t.take('DeclareAttackers',a=>a.data.attacks.length===0);
  }else if(kind==='DeclareBlockers'){
   if(attacked&&st.active_player===0)t.take('DeclareBlockers',a=>a.data.assignments.some(([id])=>id===oc.id));
   else t.take('DeclareBlockers',a=>a.data.assignments.length===0);
  }else if(kind==='CommanderZoneChoice'){
   const target=st.waiting_for.data.commander_id;t.take('DecideOptionalEffect',a=>a.data.accept===true);
   if(target===c.id){returned=true;assert.equal(ledgerView(0).commanders.find(o=>o.id===c.id).zone,'Command');assert.equal(ledgerView(0).commanders.find(o=>o.id===c.id).tax,2);}
  }else if(kind==='DiscardToHandSize'){t.submit(rows[0].actor,rows[0].actions[0]);}
  else throw Error('Unexpected recast decision '+kind);
 }
 assert(recast&&returned);const recastView=ledgerView(0);assert.equal(recastView.commanders.find(o=>o.id===c.id).tax,4);assert.equal(recastView.commanders.find(o=>o.id===c.id).castCount,2);assert.deepEqual(recastView,ledgerView(1));
 fixtures.push({id:'COMMANDER-TRADE-RETURN-RECAST',status:'PASS',projection:recastView,trace:t.trace});
}
{
 const save=init(),s=save.state,c=Object.values(s.objects).find(o=>o.is_commander&&o.owner===0);
 resetLedgers();s.command_zone=s.command_zone.filter(id=>id!==c.id);c.zone='Battlefield';c.entered_battlefield_turn=1;s.battlefield.push(c.id);main(s,'BeginCombat');e.restore_game_state(JSON.stringify(save));const t=tracker(e);
 for(let n=0;n<30&&!state(e).commander_damage.length;n++){
  const w=state(e).waiting_for.type;
  if(w==='Priority')t.take('PassPriority');
  else if(w==='DeclareAttackers')t.take('DeclareAttackers',a=>a.data.attacks.some(([id])=>id===c.id));
  else if(w==='DeclareBlockers')t.take('DeclareBlockers',a=>a.data.assignments.length===0);
  else throw Error('Unexpected decision '+w);
 }
 assert.equal(state(e).players[1].life,28);assert.deepEqual(view(0).damage,[{commanderId:c.id,player:1,amount:12}]);assert.deepEqual(view(0),view(1));
 fixtures.push({id:'COMMANDER-COMBAT-DAMAGE',status:'PASS',projection:view(0),trace:t.trace});
 // Privacy test uses an engineered zone change, not a claimed engine transition.
 const hidden=JSON.parse(e.export_game_state_json()),h=hidden.state;h.battlefield=h.battlefield.filter(id=>id!==c.id);h.objects[c.id].zone='Library';h.players[0].library.push(c.id);e.restore_game_state(JSON.stringify(hidden));
 for(const seat of [0,1]){assert(!view(seat).commanders.some(o=>o.id===c.id));assert(!view(seat).damage.some(o=>o.commanderId===c.id));}
 for(const seat of [0,1]){const hiddenRow=ledgerView(seat).commanders.find(o=>o.id===c.id);assert.equal(hiddenRow.visible,false);assert.equal(hiddenRow.zone,null);assert.equal(hiddenRow.tax,null);assert.equal(hiddenRow.name,'Ghalta, Primal Hunger');assert.deepEqual(ledgerView(seat).damage,[{commanderId:c.id,player:1,amount:12}]);}assert.deepEqual(ledgerView(0),ledgerView(1));
 fixtures.push({id:'COMMANDER-HIDDEN-ZONE-REDACTION',status:'PASS',projection:view(0),publicLedger:ledgerView(0),setup:'engineered public commander relocation to Library; no legal transition claim'});
}
console.log(JSON.stringify({runtime:RUNTIME_IDENTITY,seed:12345,layer:'unchanged engine, engineered initial positions, generated-candidate actions; not complete-match evidence',fixtures},null,2));
