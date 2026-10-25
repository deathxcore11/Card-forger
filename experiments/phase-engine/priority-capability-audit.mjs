// RULES-004. Bounded capability witnesses, not an exhaustive no-action oracle.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bootAcceptance,digest} from './acceptance-inputs.mjs';
import {prepare,deck} from './mechanics-fixtures.mjs';
import {projectInteraction,interactionSubmission} from './interaction-surface.mjs';
const names=['Forest','Island','Mountain','Plains','Sol Ring','Scavenging Ooze','Grizzly Bears','Ornithopter','Lightning Bolt','Force of Will','Think Twice','Unearth','Light Up the Stage','Manifest Dread'];
const {engine:e,provenance}=await bootAcceptance(names);
const output=resolve(process.env.CARDSTASHY_PRIORITY_OUTPUT||'test-results/rules-004');await mkdir(output,{recursive:true});
const wanted=new Set((process.env.CARDSTASHY_PRIORITY_CASES||'').split(',').filter(Boolean));
const exact=v=>JSON.stringify(v),save=()=>JSON.parse(e.export_game_state_json()),state=()=>save().state;
const report={schema:1,task:'RULES-004',taskBase:'ed3175347bc86b346205f3cba102a73bd3494c6c',integrationInspected:'d81a0a14f3f34cf64fc0156abf495fab590263b6',provenance,startedAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},cases:[],generalPriorityCompleteness:'NOT TESTED',sessionImplementation:'NOT TESTED',limits:['Engineered starts followed by accepted engine commands, not normal complete games.','Positive action witnesses and bounded negatives do not prove exhaustive priority enumeration.','Neither auto-pass flag is a completeness field.','No session/UI/CPU policy change, coverage promotion, runtime build, deployment or recovery support.']};
let active;
const hasObject=(c,id)=>c.surfaces.some(s=>s.type==='object'&&s.reference===String(id));
const hasAction=(c,code)=>c.available&&c.surfaces.some(s=>s.type==='action'&&s.code===code);
function setup({land='Forest',own=[],opponent=[],placements=[],activeSeat=0,prioritySeat=0,top=[]}={}){
 const f=prepare(e,deck(land,...own),deck('Forest',...opponent));const ids={};
 for(const [key,name,owner,zone,count=1]of placements){
  if(zone==='Exile')throw Error('Use an accepted effect to establish exile permission');
  const values=f.move(name,owner,zone,count);ids[key]=count===1?values[0]:values;
 }
 if(top.length){const chosen=[],used=new Set();for(const name of top){const o=Object.values(f.s.objects).find(o=>o.owner===0&&o.zone==='Library'&&o.name===name&&!used.has(o.id));assert(o);chosen.push(o.id);used.add(o.id);}f.s.players[0].library=[...chosen,...f.s.players[0].library.filter(id=>!used.has(id))];ids.top=chosen;}
 f.s.active_player=activeSeat;f.s.priority_player=prioritySeat;f.s.waiting_for={type:'Priority',data:{player:prioritySeat}};f.restore();
 active.fixture={land,own,opponent,placements,activeSeat,prioritySeat,top,ids,seed:12345,format:'Vintage'};active.startingState=save();return ids;
}
function observe(label,actor=0){
 const packet=e.get_legal_actions_for_viewer_js(actor),view=e.get_viewer_snapshot_js(actor),interaction=projectInteraction(view.viewerInteraction,actor),s=state();
 const summary={label,actor,authoritativeDecision:s.waiting_for.type,activeSeat:s.active_player,prioritySeat:s.priority_player,flatTypes:[...new Set(packet.actions.map(a=>a.type))],groupedTypes:[...new Set(Object.values(packet.legalActionsByObject).flat().map(a=>a.type))],topAutoPass:packet.autoPassRecommended,nestedAutoPass:view.viewerInteraction.autoPassRecommended,waitingForKind:view.viewerInteraction.waitingForKind,availability:view.viewerInteraction.availability,interactionCanSubmit:interaction.canSubmit,interactionActionCodes:[...new Set(interaction.opportunities.flatMap(o=>o.choices.flatMap(c=>c.available?c.surfaces.filter(s=>s.type==='action').map(s=>s.code):[])))]};
 active.observations.push({summary,packet,view});return {packet,view,interaction,summary};
}
function submit(actor,action){
 const packet=e.get_legal_actions_for_viewer_js(actor);assert(packet.actions.some(a=>exact(a)===exact(action)),'direct action must have a generated witness');
 const result=e.submit_action(actor,action);active.operations.push({kind:'action',actor,action,result});assert.equal(result.status,'applied',exact(result));return result;
}
function choose(o,choices,actor=0){
 assert(choices.length>0&&choices.every(c=>c.available));
 const response=o.type==='choose'?{type:'choose',data:{choiceId:choices[0].id}}:{type:o.type,data:{choiceIds:choices.map(c=>c.id)}};
 assert(['choose','select','sequence'].includes(o.type));const submission=interactionSubmission({interactionId:o.interactionId,response});
 const result=e.submit_interaction_js(actor,submission);active.operations.push({kind:'interaction',actor,submission,result});assert.equal(result.status,'applied',exact(result));return result;
}
function actObject(id,code,actor=0){
 const {interaction}=observe('action offer '+code,actor);const o=interaction.opportunities.find(o=>o.choices.some(c=>hasAction(c,code)&&hasObject(c,id)));assert(o,'missing interaction offer '+code);
 const c=o.choices.find(c=>hasAction(c,code)&&hasObject(c,id)&&!c.surfaces.some(s=>s.type==='value'&&s.role==='paymentMode'&&s.value==='manual'))||o.choices.find(c=>hasAction(c,code)&&hasObject(c,id));return choose(o,[c],actor);
}
function cast(id,actor=0){const actions=e.get_legal_actions_for_viewer_js(actor).actions;const a=actions.find(a=>a.type==='CastSpell'&&a.data.object_id===id&&a.data.payment_mode?.type==='Auto')||actions.find(a=>a.type==='CastSpell'&&a.data.object_id===id);assert(a,'cast offer required for '+id);return submit(actor,a);}
function pass(){const s=state();assert.equal(s.waiting_for.type,'Priority');const actor=s.waiting_for.data.player,a=e.get_legal_actions_for_viewer_js(actor).actions.find(a=>a.type==='PassPriority');assert(a);return submit(actor,a);}
function settle(){for(let n=0;n<16&&state().stack.length&&state().waiting_for.type==='Priority';n++)pass();return state().waiting_for.type;}
function target({id,seat},actor=0){const {interaction}=observe('mandatory target',actor);const match=c=>c.available&&(id!==undefined?hasObject(c,id):c.surfaces.some(s=>s.type==='player'&&s.seat===seat));const o=interaction.opportunities.find(o=>o.choices.some(match));assert(o,'required target choice must be exposed');choose(o,o.choices.filter(match).slice(0,1),actor);}
async function run(id,expected,fn){
 if(wanted.size&&!wanted.has(id))return;
 active={id,expected,status:'NOT TESTED',observations:[],operations:[]};
 try{active.actual=await fn();active.status='PASS';}catch(error){active.status='FAIL';active.actual={error:error.message.slice(0,2500)};active.stack=String(error.stack).slice(0,4500);}
 active.finalState=save();active.startingStateSha256=digest(exact(active.startingState));active.finalStateSha256=digest(exact(active.finalState));
 await writeFile(resolve(output,id+'.json'),exact(active)+'\n');report.cases.push({id,status:active.status,expected,actual:active.actual,observations:active.observations.map(o=>o.summary),evidence:id+'.json'});console.log(active.status+' '+id);
}

await run('empty-priority','An engineered empty hand/board priority window offers a legal pass; the two flag values are recorded without interpreting either as a completeness certificate.',()=>{
 setup({activeSeat:1});const o=observe('empty priority');assert.deepEqual(o.packet.actions.map(a=>a.type),['PassPriority']);assert.equal(o.summary.nestedAutoPass,false);assert(o.interaction.opportunities.some(p=>p.choices.some(c=>hasAction(c,'passPriority'))));pass();return {before:o.summary,passAccepted:true,scope:'only this exact empty position'};
});
await run('mana-only-sol-ring','Empty-hand Sol Ring activation is offered and executes despite a pass-only flat list.',()=>{
 const {ring}=setup({own:['Sol Ring'],placements:[['ring','Sol Ring',0,'Battlefield']]});const o=observe('mana only');assert.deepEqual(o.packet.actions.map(a=>a.type),['PassPriority']);assert(o.packet.legalActionsByObject[ring].some(a=>a.type==='ActivateAbility'));actObject(ring,'activateAbility');assert.equal(state().players[0].mana_pool.mana.length,2);assert(state().objects[ring].tapped);return {before:o.summary,accepted:true,sessionRequiredReason:'mana-window'};
});
await run('empty-hand-ooze','Opponent-turn graveyard-targeted activation executes with an empty hand.',()=>{
 const {ooze,bear}=setup({own:['Scavenging Ooze'],opponent:['Grizzly Bears'],activeSeat:1,placements:[['ooze','Scavenging Ooze',0,'Battlefield'],['land','Forest',0,'Battlefield'],['bear','Grizzly Bears',1,'Graveyard']]});const o=observe('empty hand nonmana');const activated=actObject(ooze,'activateAbility');assert(activated.result.events.some(event=>event.type==='BecomesTarget'&&event.data.target.Object===bear),'the sole graveyard target was selected by the engine');settle();assert.equal(state().objects[bear].zone,'Exile');assert.equal(state().players[0].life,21);assert.equal(state().objects[ooze].counters.P1P1,1);return {before:o.summary,accepted:true,soleTargetSelectedAutomatically:true};
});
await run('zero-cost-main','With no mana sources, zero-cost Ornithopter is offered and resolves in the controller main phase.',()=>{
 const {card}=setup({own:['Ornithopter'],placements:[['card','Ornithopter',0,'Hand']]});const o=observe('zero cost');cast(card);settle();assert.equal(state().objects[card].zone,'Battlefield');return {before:o.summary,accepted:true};
});
await run('zero-cost-opponent-turn','Zero cost alone does not let an ordinary creature be cast during the opponent turn.',()=>{
 const {card}=setup({own:['Ornithopter'],activeSeat:1,placements:[['card','Ornithopter',0,'Hand']]});const o=observe('zero cost wrong timing');assert(!o.packet.actions.some(a=>a.type==='CastSpell'&&a.data.object_id===card));assert(!o.interaction.opportunities.some(p=>p.choices.some(c=>hasAction(c,'castSpell')&&hasObject(c,card))));return {before:o.summary,castOffered:false,scope:'one negative timing fixture'};
});
await run('unpayable-instant','An instant in hand with no available mana has no offered automatic cast.',()=>{
 const {card}=setup({own:['Think Twice'],activeSeat:1,placements:[['card','Think Twice',0,'Hand']]});const o=observe('unpayable instant');assert(!o.packet.actions.some(a=>a.type==='CastSpell'&&a.data.object_id===card));assert(!o.interaction.opportunities.some(p=>p.choices.some(c=>hasAction(c,'castSpell')&&hasObject(c,card))));return {before:o.summary,castOffered:false,scope:'one negative affordability fixture'};
});
await run('own-spell-response','The top-level auto-pass recommendation can be true while an instant response to the controller own spell is available and executable; mandatory targeting remains separate.',()=>{
 const {free,bolt}=setup({land:'Mountain',own:['Ornithopter','Lightning Bolt'],placements:[['free','Ornithopter',0,'Hand'],['bolt','Lightning Bolt',0,'Hand'],['land','Mountain',0,'Battlefield']]});cast(free);const o=observe('own spell with legal response');assert.equal(o.summary.topAutoPass,true);assert(o.packet.actions.some(a=>a.type==='CastSpell'&&a.data.object_id===bolt));cast(bolt);const mandatory=observe('targeting after cast');assert.equal(mandatory.summary.authoritativeDecision,'TargetSelection');assert.equal(mandatory.summary.topAutoPass,false);assert(!mandatory.packet.actions.some(a=>a.type==='PassPriority'));target({seat:1});settle();assert.equal(state().players[1].life,17);assert.equal(state().objects[free].zone,'Battlefield');return {before:o.summary,mandatory:mandatory.summary,responseAccepted:true};
});
await run('flashback-graveyard','An empty-hand Think Twice in the graveyard can be cast on the opponent turn for its flashback cost, draws one card and goes to exile.',()=>{
 const {card}=setup({land:'Island',own:['Think Twice'],activeSeat:1,placements:[['card','Think Twice',0,'Graveyard'],['lands','Island',0,'Battlefield',3]]});const before=state().players[0].library.length,o=observe('graveyard cast');assert.equal(state().players[0].hand.length,0);cast(card);settle();assert.equal(state().objects[card].zone,'Exile');assert.equal(state().players[0].library.length,before-1);return {before:o.summary,accepted:true};
});
await run('cycling-hand','Unearth cycling is available during the opponent turn with two generic mana, discards itself and draws a card.',()=>{
 const {card}=setup({own:['Unearth'],activeSeat:1,placements:[['card','Unearth',0,'Hand'],['lands','Forest',0,'Battlefield',2]]});const before=state().players[0].library.length,o=observe('hand cycling');actObject(card,'activateAbility');settle();assert.equal(state().objects[card].zone,'Graveyard');assert.equal(state().players[0].library.length,before-1);return {before:o.summary,accepted:true,actionType:'ActivateAbility'};
});
await run('alternate-force-of-will','Force of Will is available without mana when an opposing spell and a blue card to exile exist; elected alternate costs and countering complete.',()=>{
 const {force,pitch,bear}=setup({own:['Force of Will','Think Twice'],opponent:['Grizzly Bears'],activeSeat:1,prioritySeat:1,placements:[['force','Force of Will',0,'Hand'],['pitch','Think Twice',0,'Hand'],['bear','Grizzly Bears',1,'Hand'],['lands','Forest',1,'Battlefield',2]]});cast(bear,1);pass();const o=observe('alternate cost response');cast(force);
 for(let i=0;i<6&&state().waiting_for.type!=='Priority';i++){
  const waiting=observe('alternate cost pending'),interaction=waiting.interaction;
  assert.equal(waiting.summary.topAutoPass,false);assert(!waiting.packet.actions.some(a=>a.type==='PassPriority'));
  const candidates=interaction.opportunities.flatMap(op=>op.choices.filter(c=>c.available).map(c=>({op,c})));
  active.pendingAlternatives??=[];active.pendingAlternatives.push({decision:state().waiting_for,interaction});
  const picked=state().waiting_for.type==='OptionalCostChoice'?candidates.find(x=>hasAction(x.c,'decideOptionalCost')&&x.c.surfaces.some(s=>s.type==='value'&&s.role==='pay'&&s.value==='true')):candidates.find(x=>hasObject(x.c,pitch))||candidates.find(x=>hasObject(x.c,bear));assert(picked,'alternate-cost prompt needs an explicit choice');choose(picked.op,[picked.c]);
 }
 settle();assert.equal(state().objects[pitch].zone,'Exile');assert.equal(state().players[0].life,19);assert.equal(state().objects[bear].zone,'Graveyard');assert.equal(state().objects[force].zone,'Graveyard');return {before:o.summary,accepted:true};
});
await run('exile-play-permission','Light Up the Stage establishes an actual exile-play permission; the exiled zero-cost creature remains castable after all mana was spent.',()=>{
 const {spell,top}=setup({land:'Mountain',own:['Light Up the Stage','Ornithopter'],placements:[['spell','Light Up the Stage',0,'Hand'],['lands','Mountain',0,'Battlefield',3]],top:['Ornithopter','Mountain']});cast(spell);settle();assert.equal(state().objects[top[0]].zone,'Exile');const o=observe('exile cast after paid effect');cast(top[0]);settle();assert.equal(state().objects[top[0]].zone,'Battlefield');return {before:o.summary,accepted:true};
});
await run('manifest-choice-and-special-action','Manifest selection is mandatory; after selection a manifested creature can turn up as a special action without casting or a response window.',()=>{
 const {spell,top}=setup({own:['Manifest Dread','Grizzly Bears'],placements:[['spell','Manifest Dread',0,'Hand'],['lands','Forest',0,'Battlefield',4]],top:['Grizzly Bears','Forest']});cast(spell);settle();const mandatory=observe('manifest required choice');assert.equal(mandatory.summary.authoritativeDecision,'ManifestDreadChoice');assert.equal(mandatory.summary.topAutoPass,false);assert(!mandatory.packet.actions.some(a=>a.type==='PassPriority'));target({id:top[0]});const o=observe('manifest turn up');const before=state(),a=o.packet.actions.find(a=>a.type==='TurnFaceUp'&&a.data.object_id===top[0]);assert(a);submit(0,a);assert.equal(state().objects[top[0]].face_down,false);assert.deepEqual(state().stack,before.stack);return {mandatory:mandatory.summary,before:o.summary,turnUpAccepted:true};
});

report.partial=wanted.size>0;if(report.partial)assert.deepEqual([...wanted].sort(),report.cases.map(c=>c.id).sort());else assert.equal(report.cases.length,12);
report.counts=Object.fromEntries(['PASS','FAIL','NOT TESTED','UNSUPPORTED'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
report.sourceSha256=Object.fromEntries(await Promise.all(['priority-capability-audit.mjs','acceptance-inputs.mjs','mechanics-fixtures.mjs','interaction-surface.mjs','runtime-assets.mjs'].map(async name=>[name,digest(await readFile(new URL(name,import.meta.url)))])));
report.finishedAt=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.counts));if(report.counts.FAIL)process.exitCode=1;
