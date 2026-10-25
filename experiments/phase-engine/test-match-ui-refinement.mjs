import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerStateEmblem,matchActivity,battlefieldPresentation,cardDraftCue,cardSelectionOffer,draftBoardLinks} from './match-table.mjs';

const fixture=()=>({status:{revision:7,surface:{seat:0,activeSeat:1,turn:5,phase:'PreCombatMain',awaitingHuman:true,decision:{kind:'TargetChoice'},players:[{seat:0},{seat:1}],cards:[{id:1,known:true,types:['Creature']},{id:2,known:true,types:['Artifact']},{id:3,known:false,name:'SECRET'}],interaction:{canSubmit:true,opportunities:[{interactionId:'pick',type:'choose',min:1,max:1,choices:[{id:'one',available:true,surfaces:[{type:'object',reference:'1',name:'One'}]},{id:'two',available:true,surfaces:[{type:'object',reference:'2',name:'Two'}]}]}]}}},pending:null});

test('opponent turn emblem coexists with the human decision and never invents an opening phase',()=>{
 const s=fixture();assert.deepEqual(playerStateEmblem(s,1),{active:true,title:'CPU turn · 5',phase:'First main phase'});
 assert.deepEqual(playerStateEmblem(s,0),{active:false,title:'Your response',phase:'Choose a target'});assert.equal(matchActivity(s).label,'Choose a target');
 s.status.surface.decision.kind='Priority';assert.equal(playerStateEmblem(s,0).title,'Your response');
 s.status.surface.decision.kind='DeclareBlockers';assert.deepEqual(playerStateEmblem(s,0),{active:false,title:'Your response',phase:'Choose blockers'});
 s.status.surface.decision.kind='MulliganDecision';s.status.surface.phase='Untap';
 for(const seat of [0,1])assert.deepEqual(playerStateEmblem(s,seat),{active:false,title:'Opening hand',phase:'Review your cards'});
 s.status.terminal={winner:1};assert.equal(playerStateEmblem(s,1).title,'Match finished');assert.equal(playerStateEmblem(s,1).active,false);
});
test('battlefield presentation follows current types and never reveals hidden type',()=>{
 const c={known:true,types:['Artifact'],power:0,toughness:0};assert.equal(battlefieldPresentation(c).creature,false);
 c.types=['Artifact','Creature'];assert.equal(battlefieldPresentation(c).kind,'creature');
 c.types=['Land','Creature'];assert.equal(battlefieldPresentation(c).kind,'creature');
 c.types=['Land'];assert.equal(battlefieldPresentation(c).kind,'land');
 c.known=false;assert.deepEqual(battlefieldPresentation(c),{kind:'hidden',label:'Face down',creature:false});
});
test('direct card selection requires one exact available object-only offer',()=>{
 const s=fixture();assert.deepEqual(cardSelectionOffer(s,1),{interactionId:'pick',choiceId:'one'});
 const o=s.status.surface.interaction.opportunities[0];o.choices[0].surfaces.push({type:'action',code:'castSpell'});assert.equal(cardSelectionOffer(s,1),null);
 o.choices[0].surfaces.pop();o.choices.push({...o.choices[0],id:'ambiguous'});assert.equal(cardSelectionOffer(s,1),null);o.choices.pop();
 o.choices[0].available=false;assert.equal(cardSelectionOffer(s,1),null);o.choices[0].available=true;
 s.busy=true;assert.equal(cardSelectionOffer(s,1),null);s.busy=false;s.status.surface.cards[0].known=false;assert.equal(cardSelectionOffer(s,1),null);
});
test('selection preview is revision-bound, private-reference-safe and never mutates the snapshot',()=>{
 const s=fixture();s.pending={interactionId:'pick',revision:7,choiceIds:['one']};const before=structuredClone(s);
 assert.equal(cardDraftCue(s,1).selected,true);assert.deepEqual(draftBoardLinks(s),[{from:{prompt:'pick'},to:{id:1}}]);assert.deepEqual(s,before);
 s.pending.revision=6;assert.equal(cardDraftCue(s,1),null);assert.deepEqual(draftBoardLinks(s),[]);
 s.pending.revision=7;s.status.surface.cards[0].known=false;assert.deepEqual(draftBoardLinks(s),[]);
});
test('combat preview connects only declared public endpoints and clears when authority advances',()=>{
 const s=fixture(),v=s.status.surface;v.decision.kind='DeclareAttackers';
 v.interaction.opportunities=[{interactionId:'combat',type:'relations',edges:[{sourceId:'one',targetIds:['cpu']}],choices:[{id:'one',available:true,surfaces:[{type:'object',reference:'1'}]},{id:'cpu',available:true,surfaces:[{type:'player',seat:1}]}]}];
 assert.equal(cardDraftCue(s,1).label,'Can attack');s.pending={interactionId:'combat',revision:7,relations:[{sourceId:'one',targetId:'cpu',group:null}]};
 assert.equal(cardDraftCue(s,1).label,'Attack selected');assert.deepEqual(draftBoardLinks(s),[{from:{id:1},to:{seat:1}}]);
 v.interaction.opportunities[0].edges=[];assert.deepEqual(draftBoardLinks(s),[]);v.interaction.opportunities[0].edges=[{sourceId:'one',targetIds:['cpu']}];
 s.status.revision=8;assert.deepEqual(draftBoardLinks(s),[]);assert.equal(cardDraftCue(s,1).selected,false);
});
