// Actual shipped WASM; engineered starts followed only by engine submissions.
// This diagnoses manifest independently of the absent Innocuous Rat definition.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bootAcceptance,digest} from './acceptance-inputs.mjs';
import {prepare,deck,state,tracker,snapshot,candidates} from './mechanics-fixtures.mjs';
import {projectSeat} from './seat-surface.mjs';
import {projectInteraction,interactionSubmission} from './interaction-surface.mjs';
import {cpuPacket,chooseVisible} from './visible-cpu-policy.mjs';
const names=['Forest','Island','Swamp','Plains','Manifest Dread','Grizzly Bears','Lightning Bolt','Elvish Visionary','Conductive Machete','Doom Blade','Unsummon','Swords to Plowshares','Declaration in Stone'];
const {engine:e,catalog,provenance}=await bootAcceptance(names);
const output=resolve(process.env.CARDSTASHY_ACCEPTANCE_OUTPUT||'test-results/gameplay-acceptance');await mkdir(output,{recursive:true});
const requested=new Set((process.env.CARDSTASHY_ACCEPTANCE_CASES||'').split(',').filter(Boolean));
const report={schema:1,startedAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},provenance,cases:[],limits:['Engineered starting positions are not full game histories.','Manifest Dread is tested directly; Innocuous Rat is absent from the shipped database.','Same-process engine state restoration is not browser reload or fresh-process recovery.','No card is promoted into the supported pool by this report.']};
let active=null,t=null;
function differences(a,b,path='',out=[]){
 if(JSON.stringify(a)===JSON.stringify(b))return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],path+'/'+k,out);}
 else if(out.length<40)out.push({path,before:a,after:b});return out;
}
function valuePaths(value,needle,path='',out=[]){if(value===needle)out.push(path);else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))valuePaths(v,needle,path+'/'+k,out);return out;}
function rejectAction(action){const before=snapshot(e),r=e.submit_action(0,action);active.rejectedAttempt={actor:0,action,status:r.status,beforeSha256:digest(before),afterSha256:digest(snapshot(e))};assert.equal(r.status,'rejected');return before;}
function assertSaveUnchanged(before){const diffs=differences(JSON.parse(before),JSON.parse(snapshot(e)));active.rejectionDifferences=diffs;assert.deepEqual(diffs,[],'rejected action must not change the save');}
function semanticState(value){const s=structuredClone(value);delete s.active_interaction_slots;delete s.interaction_session_id;delete s.next_interaction_serial;return s;}
function semanticInteraction(value){return JSON.parse(JSON.stringify(value,(key,v)=>['id','interactionId'].includes(key)?undefined:v));}
function saveStart(){active.startingState=JSON.parse(snapshot(e));active.startingStateSha256=digest(JSON.stringify(active.startingState));}
function setup({top=['Elvish Visionary','Lightning Bolt'],lands=8,spellName='Manifest Dread',extra=[],opponentExtra=[],librarySize=null}={}){
 const config={top,lands,spellName,extra,opponentExtra,librarySize};
 const f=prepare(e,deck('Forest',spellName,...top.filter(n=>n!=='Forest'),...extra),deck('Island',...opponentExtra));
 f.move('Forest',0,'Battlefield',lands);const [spell]=f.move(spellName,0,'Hand');
 const topIds=[],used=new Set();for(const name of top){const o=Object.values(f.s.objects).find(o=>o.owner===0&&o.zone==='Library'&&o.name===name&&!used.has(o.id));assert(o);topIds.push(o.id);used.add(o.id);}
 f.s.players[0].library=[...topIds,...f.s.players[0].library.filter(id=>!used.has(id))];
 if(librarySize!==null){const removed=f.s.players[0].library.splice(librarySize);f.s.exile.push(...removed);for(const id of removed)f.s.objects[id].zone='Exile';}
 f.restore();t=tracker(e);saveStart();active.fixture={config,spell,topIds,spellName,librarySize};return {spell,topIds,f};
}
function cast(id){t.take('CastSpell',a=>a.data.object_id===id&&a.data.payment_mode?.type==='Auto');}
function resolveManifest(id){cast(id);assert.equal(state(e).waiting_for.type,'Priority');assert(state(e).stack.length>0);assert.equal(projectSeat(e.get_filtered_game_state(0),0).decisionCards,undefined);t.passUntil(s=>s.waiting_for.type==='ManifestDreadChoice'||!s.stack.length,16);}
function choose(id){
 const raw=e.get_viewer_snapshot_js(0).viewerInteraction,o=projectInteraction(raw,0).opportunities.find(o=>o.choices.some(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(id))));assert(o,'human choice must be offered');
 const c=o.choices.find(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(id))),submission=interactionSubmission({interactionId:o.interactionId,response:{type:'choose',data:{choiceId:c.id}}});
 const r=e.submit_interaction_js(0,submission);assert.equal(r.status,'applied');active.interactions.push(submission);t.events.push(...(r.result?.events||[]));return r;
}
function surface(seat=0){return projectSeat(e.get_filtered_game_state(seat),seat);}
function turnUp(id){const before=state(e),stack=JSON.stringify(before.stack),turn=before.objects[id].entered_battlefield_turn;t.take('TurnFaceUp',a=>a.data.object_id===id);assert.equal(JSON.stringify(state(e).stack),stack);assert.equal(state(e).objects[id].id,id);assert.equal(state(e).objects[id].entered_battlefield_turn,turn);assert.equal(state(e).objects[id].face_down,false);}
async function run(id,checklist,title,expected,body){
 if(requested.size&&!requested.has(id))return;
 active={id,checklist,title,status:'NOT TESTED',expected,interactions:[]};t=null;
 try{active.actual=await body();active.status='PASS';}catch(error){active.status='FAIL';active.actual={error:error.message.slice(0,3000),...(active.rejectionDifferences?{differences:active.rejectionDifferences}:{})};active.error=String(error.stack).slice(0,4000);}
 if(t){active.actions=t.trace;active.events=t.events;active.receipt=t.receipt();}active.finalStateSha256=digest(snapshot(e));
 const filename=id+'.json';await writeFile(resolve(output,filename),JSON.stringify(active,null,2)+'\n');report.cases.push({id,checklist,title,status:active.status,expected,actual:active.actual,evidence:filename});console.log(active.status+' '+id+' '+title);
}
for(const n of [0,1])await run('choice-'+n,[3,4,5],'Human chooses either of the two real cards ('+n+')','Both choices are available only to the controller; selected instance enters face down and the other goes to graveyard.',()=>{
 const {spell,topIds}=setup();resolveManifest(spell);assert.equal(state(e).waiting_for.type,'ManifestDreadChoice');
 const own=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0),opp=projectInteraction(e.get_viewer_snapshot_js(1).viewerInteraction,1);assert.equal(own.opportunities[0].choices.length,2);assert.equal(opp.canSubmit,false);assert.deepEqual(opp.opportunities,[]);
 for(const name of ['Elvish Visionary','Lightning Bolt'])assert(!JSON.stringify(e.get_viewer_snapshot_js(1)).includes(name),'opponent choice leaked '+name);
 choose(topIds[n]);const s=state(e),chosen=s.objects[topIds[n]];assert.equal(chosen.zone,'Battlefield');assert.equal(chosen.face_down,true);assert.notEqual(chosen.is_token,true);assert.equal(s.objects[topIds[1-n]].zone,'Graveyard');assert.equal(chosen.id,topIds[n]);return {chosenInstance:chosen.id,otherInstance:topIds[1-n],selectedZone:chosen.zone,otherZone:s.objects[topIds[1-n]].zone,opponentChoiceCount:0};
});
await run('engine-facedown-characteristics',[6],'Engine face-down characteristics','Manifested permanent has no subtypes, color, mana cost, abilities or ward and is 2/2.',()=>{
 const {spell,topIds}=setup();resolveManifest(spell);choose(topIds[0]);const o=state(e).objects[topIds[0]];
 assert.deepEqual(o.card_types,{core_types:['Creature'],subtypes:[],supertypes:[]});assert.deepEqual(o.color,[]);assert.equal(o.mana_cost.type,'NoCost');assert.deepEqual(o.abilities,[]);assert.deepEqual(o.keywords,[]);assert.equal(o.power,2);assert.equal(o.toughness,2);
 return {power:2,toughness:2,types:o.card_types,colors:o.color,manaCost:o.mana_cost,abilities:o.abilities,keywords:o.keywords,note:'Raw authority retains printed identity for controller inspection; name-sensitive rule behavior is a separate test.'};
});
await run('public-and-private-view',[6,8,28,32],'Public face-down stats and controller-only inspection','Both seat projections retain public 2/2 stats, and the controller can inspect the underlying identity.',()=>{
 const {spell,topIds}=setup();resolveManifest(spell);choose(topIds[0]);const raw=state(e).objects[topIds[0]],own=surface(0).cards.find(c=>c.id===topIds[0]),opp=surface(1).cards.find(c=>c.id===topIds[0]);
 assert.deepEqual(raw.card_types,{core_types:['Creature'],subtypes:[],supertypes:[]});assert.deepEqual(raw.color,[]);assert.equal(raw.mana_cost.type,'NoCost');assert.deepEqual(raw.abilities,[]);assert.deepEqual(raw.keywords,[]);
 active.projectedCards={controller:own,opponent:opp};
 for(const c of [own,opp]){assert.equal(c.known,false);assert.equal(c.power,2,'public face-down power must survive the UI projection');assert.equal(c.toughness,2);assert.equal(c.oracleId,undefined);assert.equal(c.printing,undefined);}
 assert.equal(own.privateFace.name,'Elvish Visionary');assert.equal(opp.privateFace,undefined);assert(!JSON.stringify({view:surface(1),interaction:e.get_viewer_snapshot_js(1).viewerInteraction}).includes('Elvish Visionary'));
 return {publicCreature:opp,controllerInspection:own.privateFace.name,note:'Public name redaction is asserted at the projection; name-dependent core rules need a separate fixture.'};
});
await run('private-filter-isolation',[4,8,27,32],'Engine controller inspection and opponent privacy','Engine filtered controller state permits inspection; opponent state contains no hidden name or printed ID.',()=>{
 const {spell,topIds}=setup();resolveManifest(spell);choose(topIds[0]);const own=e.get_filtered_game_state(0).state.objects[topIds[0]],other=e.get_filtered_game_state(1).state.objects[topIds[0]];
 assert.equal(own.name,'Elvish Visionary');assert.equal(own.display_visible_to_viewer,true);assert.equal(other.name,'Hidden Card');assert.equal(other.back_face,undefined);assert.equal(other.printed_ref,undefined);
 const snapshot=e.get_viewer_snapshot_js(1);active.identityLeakPaths=valuePaths(snapshot,'Elvish Visionary');active.opponentSnapshot=snapshot;active.appProjection=surface(1);active.appProjectionIdentityPaths=valuePaths(active.appProjection,'Elvish Visionary');assert.deepEqual(active.appProjectionIdentityPaths,[],'current app projection must not expose the identity');assert.deepEqual(active.identityLeakPaths,[],'opponent snapshot must not contain the face-down identity');return {ownInspection:true,opponentName:other.name,opponentHasPrintedIdentity:false};
});
for(const selected of ['Forest','Lightning Bolt'])await run('noncreature-'+selected.toLowerCase().replaceAll(' ','-'),[7,17],'Manifest '+selected+' without a free turn-up','Land and instant enter as 2/2 creatures; illegal turn-up is rejected with no state change.',()=>{
 const {spell,topIds}=setup({top:[selected,'Grizzly Bears']});resolveManifest(spell);choose(topIds[0]);assert.equal(state(e).objects[topIds[0]].power,2);assert(!candidates(e).some(r=>r.actions.some(a=>a.type==='TurnFaceUp'&&a.data.object_id===topIds[0])));
 const before=rejectAction({type:'TurnFaceUp',data:{object_id:topIds[0],x:0}});assertSaveUnchanged(before);return {selected,turnUp:'rejected',stateUnchanged:true};
});
await run('turn-up-special-action',[9,10,11],'Turn up Elvish Visionary without casting or ETB draw','Mana is paid, the same permanent turns up immediately, stack and library count do not change.',()=>{
 const {spell,topIds}=setup();resolveManifest(spell);choose(topIds[0]);const before=state(e),lib=before.players[0].library.length,tapped=before.battlefield.filter(id=>before.objects[id].tapped).length;
 turnUp(topIds[0]);const after=state(e);assert.equal(after.players[0].library.length,lib);assert.equal(after.battlefield.filter(id=>after.objects[id].tapped).length,tapped+2);assert.equal(after.objects[topIds[0]].power,1);return {sameInstance:topIds[0],libraryCount:lib,manaSourcesTapped:2,stackSize:after.stack.length};
});
for(const wrongColors of [false,true])await run(wrongColors?'wrong-colors':'insufficient-mana',[9,17],'Turn-up payment rejects '+(wrongColors?'wrong colors':'insufficient mana'),'No spent mana, moved card, changed counters or partially completed turn-up after rejection.',()=>{
 const {spell,topIds}=setup({lands:2,extra:wrongColors?['Island','Island']:[]});resolveManifest(spell);choose(topIds[0]);
 if(wrongColors){const save=JSON.parse(snapshot(e));for(const o of Object.values(save.state.objects).filter(o=>o.name==='Island'&&o.owner===0)){save.state.players[0].library=save.state.players[0].library.filter(id=>id!==o.id);o.zone='Battlefield';o.tapped=false;save.state.battlefield.push(o.id);}e.restore_game_state(JSON.stringify(save));active.paymentFixture=save;}
 const before=rejectAction({type:'TurnFaceUp',data:{object_id:topIds[0],x:0}});assertSaveUnchanged(before);return {wrongColors,rejected:true,stateUnchanged:true};
});
await run('attachments-and-counters',[11,12],'Turn up with an attached Machete, counter and tapped status','Same permanent, attachment, counter and tapped status persist; no Visionary ETB draw.',()=>{
 const {spell,topIds}=setup({spellName:'Conductive Machete',lands:10});resolveManifest(spell);choose(topIds[0]);const save=JSON.parse(snapshot(e)),o=save.state.objects[topIds[0]];assert.deepEqual(save.state.objects[spell].attached_to,{type:'Object',data:topIds[0]});o.tapped=true;o.counters={P1P1:1};e.restore_game_state(JSON.stringify(save));active.counterFixture=save;
 const lib=state(e).players[0].library.length;turnUp(topIds[0]);const s=state(e);assert.deepEqual(s.objects[spell].attached_to,{type:'Object',data:topIds[0]});assert.equal(s.objects[topIds[0]].tapped,true);assert.equal(s.objects[topIds[0]].counters.P1P1,1);assert.equal(s.players[0].library.length,lib);assert.equal(s.objects[topIds[0]].power,4);assert.equal(s.objects[topIds[0]].toughness,3);return {instance:topIds[0],attachment:spell,tapped:true,counters:s.objects[topIds[0]].counters,power:4,toughness:3};
});
for(const count of [0,1])await run('library-'+count,[14],'Manifest with '+count+' cards in library','One card is manifested; empty library does nothing without prompting or crashing.',()=>{
 const {spell,topIds}=setup({librarySize:count});resolveManifest(spell);
 if(state(e).waiting_for.type==='ManifestDreadChoice')choose(topIds[0]);
 const facedown=state(e).battlefield.filter(id=>state(e).objects[id].face_down);assert.equal(facedown.length,count);assert.equal(state(e).players[0].library.length,0);assert.equal(state(e).waiting_for.type,'Priority');return {faceDownCount:facedown.length,prompt:state(e).waiting_for.type};
});
await run('invalid-selection',[17],'Invalid manifest selection has no partial effect','An object outside the two choices is rejected with the whole saved state unchanged.',()=>{
 const {spell}=setup();resolveManifest(spell);const before=rejectAction({type:'SelectCards',data:{cards:[999999]}});assertSaveUnchanged(before);return {status:'rejected',stateUnchanged:true};
});
await run('cpu-choice-and-turnup',[16,28,30],'CPU completes manifest and turns up using its allowed view','CPU chooses a valid creature from its own choice and can turn it up; no private names or IDs go to the policy.',()=>{
 const {spell,topIds}=setup({top:['Grizzly Bears','Lightning Bolt']});resolveManifest(spell);const row=candidates(e)[0],packet=cpuPacket(surface(row.actor),row.actions);active.cpuPacket=packet;const chosen=chooseVisible(packet,123);assert.equal(row.actions[chosen.index].data.cards[0],topIds[0]);assert(!JSON.stringify(packet).includes('Grizzly'));t.submit(row.actor,row.actions[chosen.index]);
 const actions=candidates(e)[0].actions,p=cpuPacket(surface(0),actions),result=chooseVisible(p,123);assert.equal(actions[result.index].type,'TurnFaceUp');t.submit(0,actions[result.index]);assert.equal(state(e).objects[topIds[0]].face_down,false);return {packet,selectedAction:'SelectCards',followup:'TurnFaceUp',rng:result.rng};
});
await run('cpu-hidden-world-equivalence',[27],'Changing opponent hidden hand preserves CPU decisions','Two different real, unrevealed opponent hands with the same public observations and seed produce identical policy packets and selected actions.',()=>{
 const {spell,topIds,f}=setup({opponentExtra:['Grizzly Bears','Elvish Visionary','Lightning Bolt','Forest']});
 const firstHand=[...f.move('Grizzly Bears',1,'Hand'),...f.move('Elvish Visionary',1,'Hand')];f.restore();t=tracker(e);saveStart();active.extraFixture={opponentHand:firstHand};
 resolveManifest(spell);choose(topIds[0]);const alternate=JSON.parse(snapshot(e));
 const firstNames=firstHand.map(id=>alternate.state.objects[id].name);assert.deepEqual(firstNames,['Grizzly Bears','Elvish Visionary']);
 const get=()=>{const actions=candidates(e)[0].actions,packet=cpuPacket(surface(0),actions);return {visible:surface(0),packet,proposal:chooseVisible(packet,777)};};const first=get();
 const secondHand=['Lightning Bolt','Forest'].map(name=>Object.values(alternate.state.objects).find(o=>o.owner===1&&o.zone==='Library'&&o.name===name).id);
 firstHand.forEach((oldId,index)=>{const nextId=secondHand[index];alternate.state.players[1].library=alternate.state.players[1].library.map(id=>id===nextId?oldId:id);alternate.state.objects[oldId].zone='Library';alternate.state.objects[nextId].zone='Hand';});
 alternate.state.players[1].hand=secondHand;active.alternateHiddenHandState=alternate;e.restore_game_state(JSON.stringify(alternate));const second=get();assert.deepEqual(second,first);
 const restored=JSON.parse(snapshot(e)),secondNames=restored.state.players[1].hand.map(id=>restored.state.objects[id].name);assert.deepEqual(secondNames,['Lightning Bolt','Forest']);
 return {firstHand:firstNames,secondHand:secondNames,sameVisibleState:true,samePacket:true,sameChoice:true,seed:777,scope:'one policy position; no complete-game fairness claim'};
});
await run('pending-state-restore',[33],'Engine serialization preserves a pending manifest choice','Restoring the same saved engine state preserves candidates and selection result; this is not browser reload support.',()=>{
 const {spell,topIds}=setup();resolveManifest(spell);const pending=snapshot(e),choices=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0);choose(topIds[0]);const end=JSON.parse(snapshot(e));e.restore_game_state(pending);assert.deepEqual(semanticInteraction(projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0)),semanticInteraction(choices));choose(topIds[0]);const diffs=differences(semanticState(end.state),semanticState(JSON.parse(snapshot(e)).state));active.restoreDifferences=diffs;assert.deepEqual(diffs,[]);return {choicePreserved:true,endStatePreserved:true,productReload:'UNSUPPORTED',note:'Authority regenerates opaque interaction tokens on restoration; compare semantic choices and reacquire tokens.'};
});
function setupTwo(secondCreature='Grizzly Bears'){
 const x=setup({top:['Grizzly Bears','Lightning Bolt',secondCreature,'Forest'],extra:['Manifest Dread','Declaration in Stone','Plains','Plains']}),{f}=x;
 const [second]=f.move('Manifest Dread',0,'Hand'),[removal]=f.move('Declaration in Stone',0,'Hand');f.move('Plains',0,'Battlefield',2);f.restore();t=tracker(e);saveStart();active.extraFixture={secondSpell:second,removal,additionalLands:'2 Plains'};
 resolveManifest(x.spell);choose(x.topIds[0]);resolveManifest(second);choose(x.topIds[2]);return {...x,second,removal};
}
function targetedCast(id,target){
 const mark=stage=>{const s=state(e);(active.targetStages??=[]).push({stage,waiting:s.waiting_for.type,stack:s.stack.map(x=>x.id),creatures:s.battlefield.map(n=>s.objects[n]).filter(o=>o.card_types.core_types.includes('Creature')).map(o=>({id:o.id,name:o.name,faceDown:o.face_down,tapped:o.tapped}))});};mark('before candidate read');
 const actions=candidates(e);active.targetingCandidates=actions.flatMap(r=>r.actions.filter(a=>a.type==='CastSpell'&&a.data.object_id===id));
 mark('after candidate read');
 t.take('CastSpell',a=>a.data.object_id===id&&a.data.payment_mode?.type==='Auto');
 mark('after cast announcement');
 active.stackAfterAnnouncement=state(e).stack;
 if(state(e).waiting_for.type==='TargetSelection'){
 const interaction=projectInteraction(e.get_viewer_snapshot_js(0).viewerInteraction,0),o=interaction.opportunities.find(o=>o.choices.some(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(target))));active.targetingInteraction=interaction;
 assert(o,'target must have an engine-authored interaction');
 const c=o.choices.find(c=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(target))),response=o.type==='choose'?{type:'choose',data:{choiceId:c.id}}:{type:o.type,data:{choiceIds:[c.id]}},submission=interactionSubmission({interactionId:o.interactionId,response});
 const r=e.submit_interaction_js(0,submission);assert.equal(r.status,'applied');active.interactions.push(submission);t.events.push(...(r.result?.events||[]));
 mark('after target submission');
 }
 const spell=state(e).stack.find(s=>s.id===id);assert(spell,'spell must be on the stack');active.targetedStackItem=spell;
 assert.deepEqual(spell.kind.data.ability.targets,[{Object:target}],'spell must target only the intended instance');
 assert.equal(state(e).objects[target].face_down,true,'removal fixture must still be face down before resolution');
 for(let n=0;n<20&&state(e).stack.length;n++){t.take('PassPriority');mark('after pass '+n);}assert.equal(state(e).stack.length,0);
}
await run('distinct-manifests',[13],'Two identical printed cards retain separate instance identities','Both chosen original instances exist face down; turning one up does not turn up or replace the other.',()=>{
 const {topIds}=setupTwo(),first=topIds[0],second=topIds[2];assert.notEqual(first,second);for(const id of [first,second])assert.equal(state(e).objects[id].face_down,true);turnUp(first);assert.equal(state(e).objects[second].face_down,true);assert.equal(state(e).objects[second].zone,'Battlefield');return {first,second,firstFaceUp:true,secondFaceDown:true};
});
await run('nameless-rule',[6],'Two face-down Bears do not share a name for Declaration in Stone','Exiling one face-down creature does not exile another face-down creature with the same printed name.',()=>{
 const {topIds,removal}=setupTwo();targetedCast(removal,topIds[0]);const a=state(e).objects[topIds[0]],b=state(e).objects[topIds[2]];active.resultZones={target:a.zone,other:b.zone};assert.equal(a.zone,'Exile');assert.equal(b.zone,'Battlefield');return {target:a.zone,other:b.zone};
});
await run('nameless-control',[6],'Same-name removal control with different printed identities','Declaration in Stone targets one of two face-down creatures with different printed names; the other remains.',()=>{
 const {topIds,removal}=setupTwo('Elvish Visionary');targetedCast(removal,topIds[0]);const a=state(e).objects[topIds[0]],b=state(e).objects[topIds[2]];active.resultZones={target:a.zone,other:b.zone};assert.equal(a.zone,'Exile');assert.equal(b.zone,'Battlefield');return {target:a.zone,other:b.zone};
});
for(const [id,removal,land,destination]of [['destroy','Doom Blade','Swamp','Graveyard'],['bounce','Unsummon','Island','Hand'],['exile','Swords to Plowshares','Plains','Exile']])await run('reveal-'+id,[15],'Reveal manifested creature on '+id,'Identity is available to the opponent when the permanent leaves; correct destination and face-up characteristics are restored.',()=>{
 const {spell,topIds,f}=setup({extra:[removal,land,land]});const [remove]=f.move(removal,0,'Hand');f.move(land,0,'Battlefield',2);f.restore();t=tracker(e);saveStart();active.extraFixture={removal:remove,additionalLands:'2 '+land};resolveManifest(spell);choose(topIds[0]);const offset=t.events.length;targetedCast(remove,topIds[0]);
 const o=state(e).objects[topIds[0]],events=t.events.slice(offset),authorized=e.get_viewer_transition_snapshot_js(1,events),filtered=e.get_filtered_game_state(1).state.objects[topIds[0]];active.authorizedDepartureEvents=authorized.events;active.departedObject={zone:o.zone,faceDown:o.face_down,power:o.power,toughness:o.toughness};active.departureObservation={filtered,identityPaths:valuePaths(authorized,'Elvish Visionary')};assert.equal(o.zone,destination);assert.equal(o.face_down,false);
 const eventReveal=JSON.stringify(authorized.events).includes('Elvish Visionary'),objectReveal=filtered?.display_visible_to_viewer===true&&filtered.name==='Elvish Visionary';
 assert(eventReveal||objectReveal,'authorized departure must expose the identity in an event or the visible object');return {zone:o.zone,faceDown:o.face_down,eventTypes:events.map(e=>e.type),eventReveal,objectReveal,revealed:true};
});
await run('reveal-game-end',[15],'Reveal face-down permanent at game end','Concession reaches GameOver and the formerly hidden permanent is revealed to the other seat.',()=>{
 const {spell,topIds}=setup();resolveManifest(spell);choose(topIds[0]);const r=e.submit_action(0,{type:'Concede',data:{player_id:0}});assert.equal(r.status,'applied');active.concession={type:'Concede',data:{player_id:0}};const events=r.result?.events||[],authorized=e.get_viewer_transition_snapshot_js(1,events),other=e.get_filtered_game_state(1).state.objects[topIds[0]];active.terminalView={waiting:state(e).waiting_for,other,events:authorized.events};assert.equal(state(e).waiting_for.type,'GameOver');assert(other?.name==='Elvish Visionary'||JSON.stringify(authorized.events).includes('Elvish Visionary'),'game end must reveal identity');return {terminal:true,revealed:true};
});
const stress=['Innocuous Rat','Bronze Bombshell','Rats of Rath','Progenitus','Soldier of Fortune','Chaos Orb','City in a Bottle','Karn Liberated','Panglacial Wurm'];
report.catalog=stress.map(name=>({name,status:'UNSUPPORTED',reason:!catalog[name.toLowerCase()]?'Missing compiled record':JSON.stringify(catalog[name.toLowerCase()]).includes('Unimplemented')?'Contains explicit Unimplemented effect':'Not admitted or executed'}));
report.counts=Object.fromEntries(['PASS','FAIL','NOT TESTED','UNSUPPORTED'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
report.partial=requested.size>0;
if(!report.partial)assert.equal(report.cases.length,24,'full suite must run all 24 cases');else assert.deepEqual([...requested].sort(),report.cases.map(c=>c.id).sort(),'unknown requested case ID');
report.finishedAt=new Date().toISOString();
report.sourceSha256=Object.fromEntries(await Promise.all(['acceptance-inputs.mjs','manifest-acceptance.mjs','seat-surface.mjs','visible-cpu-policy.mjs','interaction-surface.mjs','mechanics-fixtures.mjs','mechanics-inputs.mjs','runtime-assets.mjs'].map(async n=>[n,digest(await readFile(new URL(n,import.meta.url)))])));
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.counts));if(report.counts.FAIL)process.exitCode=1;
