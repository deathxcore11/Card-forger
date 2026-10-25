// RULES-002: isolate rejection mutation without editing the shipped runtime.
// Natural setup uses only initialized exact decks and witnessed legal actions.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bootAcceptance,digest} from './acceptance-inputs.mjs';
import {prepare,deck} from './mechanics-fixtures.mjs';

const taskBase='ed3175347bc86b346205f3cba102a73bd3494c6c';
const names=['Plains','Forest','Ram Through','Savannah Lions','Grizzly Bears'];
const {engine:e,provenance}=await bootAcceptance(names);
const output=resolve(process.env.CARDSTASHY_REJECTION_OUTPUT||'test-results/rules-002');
await mkdir(output,{recursive:true});
const full=()=>JSON.parse(e.export_game_state_json());
const json=v=>JSON.stringify(v);
const stamps=s=>s.state.zone_change_library_knowledge_stamps||[];
function diffs(a,b,path='',out=[]){
 if(json(a)===json(b))return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)]))diffs(a[key],b[key],path+'/'+key,out);
 else out.push({path,before:a,after:b});
 return out;
}
const report={schema:1,task:'RULES-002',taskBase,integrationInspected:'4bd9801c0b5593288c9c29b76cc447ce47781f75',provenance,startedAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},cases:[],limits:['Engine/API assertions, not a browser or production CPU match.','No new runtime, card data, coverage promotion, session policy or recovery implementation.','Subsequent-visibility checks cover the named fixtures and six accepted continuations; no universal privacy or harmlessness claim.']};
const evidence={report};
function record(id,expected,body){
 const row={id,buildCommit:provenance.appBaseCommit,expected,status:'NOT TESTED'};
 try{row.actual=body();row.status='PASS';}catch(error){row.status='FAIL';row.actual={error:error.message.slice(0,1800)};row.stack=String(error.stack).slice(0,3000);}
 report.cases.push(row);console.log(row.status+' '+id);return row;
}
function observers(events=[]){return [0,1].map(seat=>({seat,filtered:e.get_filtered_game_state(seat),viewer:e.get_viewer_snapshot_js(seat),transition:e.get_viewer_transition_snapshot_js(seat,events)}));}
function assertHidden(seats,authority){
 for(const row of seats){
  const s=row.filtered.state;
  for(const p of authority.state.players){
   const hidden=[...p.library,...(p.id===row.seat?[]:p.hand)];
   for(const id of hidden){assert.equal(s.objects[id].name,'Hidden Card');assert.equal(s.objects[id].card_id,0);}
  }
  for(const id of authority.state.players[row.seat].hand)assert.equal(s.objects[id].name,authority.state.objects[id].name);
 }
}
function apply(actor,action,trace){
 const packet=e.get_legal_actions_for_viewer_js(actor);
 assert(packet.actions.some(a=>json(a)===json(action)),'legal candidate witness required');
 const result=e.submit_action(actor,action);assert.equal(result.status,'applied',json(result));
 trace.push({actor,action,result});return result;
}
function legalNaturalSetup(){
 const decks={player:{main_deck:[...Array(52).fill('Plains'),...Array(4).fill('Savannah Lions'),...Array(4).fill('Ram Through')]},opponent:{main_deck:[...Array(56).fill('Forest'),...Array(4).fill('Grizzly Bears')]}};
 const seed=10,format=e.getFormatRegistry().find(f=>f.format==='Vintage').default_config;
 const initialized=e.initialize_game(decks,seed,format,null,2,0);assert(Array.isArray(initialized.events));
 const trace=[];let lastEvents=initialized.events;
 for(let step=0;step<180;step++){
  const save=full(),s=save.state;
  const own=s.battlefield.filter(id=>s.objects[id].controller===0&&s.objects[id].name==='Savannah Lions');
  const opposing=s.battlefield.filter(id=>s.objects[id].controller===1&&s.objects[id].name==='Grizzly Bears');
  const lands=s.battlefield.filter(id=>s.objects[id].controller===0&&s.objects[id].name==='Plains'&&!s.objects[id].tapped);
  const spell=s.players[0].hand.find(id=>s.objects[id].name==='Ram Through');
  if(s.phase==='Draw'&&s.active_player===0&&s.waiting_for.type==='Priority'&&s.waiting_for.data.player===0&&stamps(save).length&&own.length&&opposing.length&&lands.length>=2&&spell){
   return {decks,seed,format:'Vintage',setupMethod:'initialize plus accepted legal actions; no restore or direct state edits',initialized,trace,lastEvents,save,ids:{own:own[0],opposing:opposing[0],spell,lands}};
  }
  const rows=[0,1].map(actor=>({actor,packet:e.get_legal_actions_for_viewer_js(actor)})).filter(r=>r.packet.actions.length);
  assert(rows.length,'natural setup stranded: '+json(s.waiting_for));
  const {actor,packet}=rows[0],actions=packet.actions;
  const creatureName=actor===0?'Savannah Lions':'Grizzly Bears';
  const hasCreature=s.battlefield.some(id=>s.objects[id].controller===actor&&s.objects[id].name===creatureName);
  const action=actions.find(a=>a.type==='MulliganDecision'&&a.data.choice.type==='Keep')
   ||actions.find(a=>a.type==='PlayLand')
   ||(!hasCreature&&actions.find(a=>a.type==='CastSpell'&&s.objects[a.data.object_id]?.name===creatureName&&a.data.payment_mode?.type==='Auto'))
   ||actions.find(a=>a.type==='DeclareAttackers'&&a.data.attacks.length===0)
   ||actions.find(a=>a.type==='DeclareBlockers'&&a.data.assignments.length===0)
   ||actions.find(a=>a.type==='PassPriority');
  assert(action,'natural setup needs an explicitly handled decision: '+json(s.waiting_for));
  const result=apply(actor,action,trace);lastEvents=result.result.events||[];
  if(step%20===0)console.log('SETUP '+step+' '+s.turn_number+' '+s.phase);
 }
 assert.fail('natural legal setup exceeded 180 accepted actions');
}

const natural=legalNaturalSetup();evidence.natural=natural;
record('natural-setup','A real legal history reaches a draw-step priority window with two untapped Plains, own/opposing creatures, Ram Through in hand and draw metadata.',()=>({acceptedActions:natural.trace.length,turn:natural.save.state.turn_number,phase:natural.save.state.phase,ids:natural.ids,stampCount:stamps(natural.save).length,restoreUsed:false,stateEdited:false}));
const a={type:'CastSpell',data:{object_id:natural.ids.spell,card_id:natural.ids.spell,targets:[],payment_mode:{type:'Auto'}}};
record('repeated-save-control','Five consecutive saves with no attempted action are deeply identical, including metadata.',()=>{
 const samples=Array.from({length:5},full);evidence.saveControl=samples.map(s=>({sha256:digest(json(s)),stamps:stamps(s)}));
 for(const s of samples)assert.deepEqual(s,samples[0]);return evidence.saveControl;
});
record('read-only-control','Both-seat reads, legal-action generation and target queries leave the entire save unchanged.',()=>{
 const before=full();evidence.readOnly={before,views:observers(natural.lastEvents),legal:[0,1].map(i=>e.get_legal_actions_for_viewer_js(i)),targets:e.legal_targets_for_castable_js(natural.ids.spell),after:full()};
 assert.deepEqual(evidence.readOnly.after,before);return {unchanged:true,targetQuery:evidence.readOnly.targets};
});
const before=full(),beforeViews=observers(natural.lastEvents),rejection=e.submit_action(0,a),after=full(),afterViews=observers(natural.lastEvents);
evidence.naturalRejection={before,action:a,rejection,after,beforeViews,afterViews,differences:diffs(before,after),viewDifferences:diffs(beforeViews,afterViews)};
record('natural-rejection-atomicity','Wrong-color automatic cast rejects and preserves the entire save in a naturally reached valid-target position.',()=>{
 assert.equal(rejection.status,'rejected');assert.deepEqual(after,before);return {unchanged:true};
});
record('natural-resource-preservation','Rejection leaves every recorded field except the separately reported event-metadata field unchanged.',()=>{
 assert.equal(rejection.status,'rejected');
 assert(evidence.naturalRejection.differences.every(d=>d.path==='/state/zone_change_library_knowledge_stamps'));
 return {rejection:rejection.rejection,allDifferencePaths:evidence.naturalRejection.differences.map(d=>d.path),cardsManaLifeAndZonesUnchanged:true};
});
record('natural-immediate-seat-visibility','Each seat gets the same filtered/viewer/transition output before and after rejection; hidden hand/library identities remain hidden.',()=>{
 assertHidden(beforeViews,before);assertHidden(afterViews,after);assert.deepEqual(afterViews,beforeViews);return {seats:[0,1],equal:true};
});
record('second-rejection-control','Repeating the same rejected action does not make a further state change.',()=>{
 const beforeAgain=full(),again=e.submit_action(0,a),afterAgain=full();evidence.repeat={before:beforeAgain,result:again,after:afterAgain};
 assert.equal(again.status,'rejected');assert.deepEqual(afterAgain,beforeAgain);return {unchanged:true};
});

// Supplemental continuation control: restore the same unedited naturally
// produced save for both branches. Restore changes debug/session bookkeeping,
// so branch comparison uses each branch's own before/after and seat identities.
function continuation(rejectFirst){
 e.restore_game_state(json(before));const initial=full();assert(stamps(initial).length);
 const immediateBefore=observers(natural.lastEvents);const rejected=rejectFirst?e.submit_action(0,a):null;
 const immediateAfter=observers(natural.lastEvents);const trace=[],views=[],states=[];
 for(let n=0;n<6;n++){
  const s=full().state;const actor=s.waiting_for.data?.player;assert(Number.isInteger(actor));
  const actions=e.get_legal_actions_for_viewer_js(actor).actions;
  const action=actions.find(a=>a.type==='PassPriority')||actions.find(a=>a.type==='DeclareAttackers'&&a.data.attacks.length===0);
  assert(action,'unhandled bounded continuation');
  const result=apply(actor,action,trace);const state=full();const view=observers(result.result.events||[]);assertHidden(view,state);states.push(state);views.push(view);
 }
 return {restoredFromSha256:digest(json(before)),initial,immediateBefore,rejected,immediateAfter,trace,views,states};
}
const control=continuation(false),attempt=continuation(true);evidence.continuations={control,attempt};
record('six-action-seat-visibility','After six equivalent accepted continuations, both seats have identical filtered state and visible transition events with and without rejection.',()=>{
 assert.equal(attempt.rejected.status,'rejected');
 assert.deepEqual(attempt.trace.map(t=>({actor:t.actor,action:t.action})),control.trace.map(t=>({actor:t.actor,action:t.action})));
 // Session-bound interaction IDs change on restore. Full raw views remain in
 // evidence; the seat-filtered game state and transition events are compared
 // without deleting or masking any field inside them.
 const visible=rows=>rows.map(seats=>seats.map(r=>({seat:r.seat,filtered:r.filtered,transitionEvents:r.transition.events})));
 evidence.continuations.visibleDifferences=diffs(visible(control.views),visible(attempt.views));
 assert.deepEqual(visible(attempt.views),visible(control.views));return {acceptedContinuationActions:6,seats:[0,1],equal:true};
});

const f=prepare(e,deck('Plains','Savannah Lions','Ram Through'),deck('Forest','Grizzly Bears'));
f.move('Plains',0,'Battlefield',2);f.move('Savannah Lions',0,'Battlefield');f.move('Grizzly Bears',1,'Battlefield');const [spell]=f.move('Ram Through',0,'Hand');f.restore();
const engineeredBefore=full(),engineeredAction={type:'CastSpell',data:{object_id:spell,card_id:spell,targets:[],payment_mode:{type:'Auto'}}},engineeredResult=e.submit_action(0,engineeredAction),engineeredAfter=full();
evidence.engineered={before:engineeredBefore,action:engineeredAction,result:engineeredResult,after:engineeredAfter,differences:diffs(engineeredBefore,engineeredAfter)};
record('engineered-rejection-atomicity','The original engineered-fixture pattern also rejects without changing the entire save.',()=>{
 assert(stamps(engineeredBefore).length);assert.equal(engineeredResult.status,'rejected');assert.deepEqual(engineeredAfter,engineeredBefore);return {unchanged:true};
});
report.counts=Object.fromEntries(['PASS','FAIL','NOT TESTED','UNSUPPORTED'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
report.sourceSha256=Object.fromEntries(await Promise.all(['rejection-atomicity-audit.mjs','acceptance-inputs.mjs','mechanics-fixtures.mjs','mechanics-inputs.mjs','runtime-assets.mjs'].map(async name=>[name,digest(await readFile(new URL(name,import.meta.url)))])));
report.finishedAt=new Date().toISOString();
await writeFile(resolve(output,'full.json'),json(evidence)+'\n');await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts));if(report.counts.FAIL)process.exitCode=1;
