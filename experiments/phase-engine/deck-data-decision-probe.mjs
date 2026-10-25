// Replays the failed exact-deck CPU history, then tests the human target path.
// A successful continuation does not change the CPU trial's FAIL outcome.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bootAcceptance,digest} from './acceptance-inputs.mjs';
import {engineDeckFromSnapshot} from './match-input.mjs';
import {projectInteraction,interactionSubmission} from './interaction-surface.mjs';
const trialRoot=resolve(process.argv[2]||'test-results/deck-003-cpu-7331');
const trial=JSON.parse(await readFile(resolve(trialRoot,'report.json'))),failed=JSON.parse(await readFile(resolve(trialRoot,'final-state.json')));
assert.equal(trial.status,'FAIL');assert.equal(trial.lastDecision,'TriggerTargetSelection');assert.equal(trial.acceptedCommands,100);
const receipt=JSON.parse(await readFile(new URL('./fixtures/deck-003/source-receipt.json',import.meta.url))),bytes=await readFile(new URL('./fixtures/deck-003/'+receipt.correctedCandidateFile,import.meta.url));assert.equal(digest(bytes),receipt.correctedCandidateSha256);const additions=JSON.parse(bytes),deckBytes=await readFile(new URL('./fixtures/deck-001/tramplesaurus-rex.json',import.meta.url));assert.equal(digest(deckBytes),trial.exactDeckFixtureSha256);
const d=JSON.parse(deckBytes),list=engineDeckFromSnapshot(d,'Commander'),{engine:e,catalog,provenance}=await bootAcceptance(['Forest']);const cards=Object.fromEntries(d.cards.map(c=>[c.name.toLowerCase(),catalog[c.name.toLowerCase()]||additions[c.name.toLowerCase()]]));assert.equal(digest(JSON.stringify(cards)),trial.combinedDeckDataSha256);assert.equal(e.load_card_database(JSON.stringify(cards)),69);
const report={schema:1,task:'DECK-003',provenance,sourceTrialSha256:digest(await readFile(resolve(trialRoot,'report.json'))),sourceSeed:trial.seed,status:'NOT TESTED',checks:[],operations:[],limits:['Direct scripted human interaction after replaying the original 100 accepted CPU actions.','Not a CPU fix or a complete match; no restore/direct state edits in this replay.','No rendered UI or recovery support claim.']};
const s=()=>JSON.parse(e.export_game_state_json()).state,submit=(actor,action)=>{const result=e.submit_action(actor,action);report.operations.push({actor,action,result});assert.equal(result.status,'applied');};
try{
 const cfg=e.getFormatRegistry().find(f=>f.format==='Commander').default_config;e.initialize_game({player:list,opponent:list},trial.seed,cfg,null,2,0);
 for(const step of trial.trace){const result=e.submit_action(step.actor,step.action);assert.equal(result.status,'applied');}
 const replayed=s(),expected=structuredClone(failed.state),oldSession=expected.interaction_session_id,newSession=replayed.interaction_session_id;
 assert.equal(typeof oldSession,'string');assert.equal(typeof newSession,'string');assert.notEqual(newSession,oldSession,'a fresh initialized game must have a fresh interaction session');
 report.freshCapabilitySession={original:oldSession,replayed:newSession,scope:'Only the session ID and that exact prefix in active interaction IDs are rebound. Every other saved state field must match.'};
 expected.interaction_session_id=newSession;for(const slot of expected.active_interaction_slots){assert(slot.interactionId.startsWith(oldSession+'.'));slot.interactionId=newSession+slot.interactionId.slice(oldSession.length);}
 assert.deepEqual(replayed,expected);report.checks.push({id:'100-command-gameplay-replay',status:'PASS'});report.before=JSON.parse(e.export_game_state_json());
 const waiting=s().waiting_for,actor=waiting.data.player,id=waiting.data.source_id;assert.equal(s().objects[id].name,'Surrak, the Hunt Caller');assert.equal(s().objects[id].entered_battlefield_turn,s().turn_number);
 const view=e.get_viewer_snapshot_js(actor),interaction=projectInteraction(view.viewerInteraction,actor),matches=c=>c.available&&c.surfaces.some(s=>s.type==='object'&&s.reference===String(id)),o=interaction.opportunities.find(o=>o.choices.some(matches));assert(o);const choice=o.choices.find(matches),response=o.type==='choose'?{type:'choose',data:{choiceId:choice.id}}:{type:o.type,data:{choiceIds:[choice.id]}},submission=interactionSubmission({interactionId:o.interactionId,response});report.offer=view.viewerInteraction;
 const result=e.submit_interaction_js(actor,submission);report.operations.push({actor,submission,result});assert.equal(result.status,'applied');
 for(let n=0;n<20&&s().stack.length;n++){assert.equal(s().waiting_for.type,'Priority');const actor=s().waiting_for.data.player,action=e.get_legal_actions_for_viewer_js(actor).actions.find(a=>a.type==='PassPriority');assert(action);submit(actor,action);}
 assert.equal(s().stack.length,0);assert(e.get_viewer_snapshot_js(actor).state.state.objects[id].keywords.includes('Haste'));report.checks.push({id:'human-trigger-target-grants-haste',status:'PASS',source:id,actor});
 const turn=s().turn_number;for(let n=0;n<50&&s().turn_number===turn;n++){const current=s(),actor=current.waiting_for.data.player,actions=e.get_legal_actions_for_viewer_js(actor).actions,action=actions.find(a=>a.type==='PassPriority')||actions.find(a=>a.type==='DeclareAttackers'&&a.data.attacks.length===0);assert(action,'bounded human continuation encountered another required decision');submit(actor,action);}
 assert(s().turn_number>turn);assert(!e.get_viewer_snapshot_js(actor).state.state.objects[id].keywords.includes('Haste'));report.checks.push({id:'temporary-haste-expires',status:'PASS'});report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack||error);}
report.after=JSON.parse(e.export_game_state_json());report.runnerSha256=digest(await readFile(new URL(import.meta.url)));const output=resolve(process.env.CARDSTASHY_DECK_DECISION_OUTPUT||'test-results/deck-003-decision');await mkdir(output,{recursive:true});await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks,error:report.error}));if(report.status!=='PASS')process.exitCode=1;
