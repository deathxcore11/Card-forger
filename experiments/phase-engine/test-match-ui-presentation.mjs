import {test} from 'node:test';
import assert from 'node:assert/strict';
import {battlefieldGroups,matchPhaseLabel,matchActivity,cardActionCues} from './match-table.mjs';

test('battlefield grouping preserves each instance and uses current public types',()=>{
 const cards=[{id:1,known:true,types:['Artifact','Creature']},{id:2,known:true,types:['Land']},{id:3,known:true,types:['Enchantment']},{id:4,known:true,types:['Land','Creature']}];
 const original=structuredClone(cards),groups=battlefieldGroups(cards);
 assert.deepEqual(groups.map(g=>[g.key,g.cards.map(c=>c.id)]),[['creatures',[1,4]],['lands',[2]],['other',[3]]]);
 assert.deepEqual(cards,original);assert.equal(groups[0].cards[0],cards[0]);
});
test('unknown cards cannot leak private type into a battlefield label',()=>{
 const hidden={id:9,known:false,types:['Creature','Land'],name:'PRIVATE_CANARY'};
 assert.equal(battlefieldGroups([hidden])[0].key,'other');
 assert.deepEqual(battlefieldGroups([]),[]);
});
test('phase wording handles both main phases and preserves unfamiliar phases',()=>{
 assert.equal(matchPhaseLabel('PreCombatMain'),'First main phase');
 assert.equal(matchPhaseLabel('PostCombatMain'),'Second main phase');
 assert.equal(matchPhaseLabel('DeclareBlockers'),'Combat · Blockers');
 assert.equal(matchPhaseLabel('CustomDecision'),'Custom Decision');
 assert.equal(matchPhaseLabel(null),'');
});
test('turn ownership never determines who must act',()=>{
 const surface={seat:0,activeSeat:1,awaitingHuman:true,decision:{kind:'Priority'},stack:[]};
 assert.deepEqual(matchActivity({status:{surface}}),{actor:'you',label:'Your response'});
 surface.activeSeat=0;surface.awaitingHuman=false;
 assert.deepEqual(matchActivity({status:{surface},busy:true}),{actor:'none',label:'CPU is thinking'});
 surface.awaitingHuman=true;
 assert.equal(matchActivity({status:{surface}}).label,'You can act');
 surface.stack=[{source:1}];assert.equal(matchActivity({status:{surface}}).label,'Your response');
});
test('required prompts, in-flight actions and terminal state keep honest labels',()=>{
 const surface={seat:0,activeSeat:0,awaitingHuman:true,decision:{kind:'MulliganDecision'}};
 assert.equal(matchActivity({status:{surface}}).label,'Opening hand');
 assert.equal(matchActivity({status:{surface},busy:true}).label,'Resolving your action…');
 surface.decision.kind='DeclareBlockers';assert.equal(matchActivity({status:{surface}}).label,'Choose blockers');
 assert.equal(matchActivity({status:{surface},error:'RECOVERY_REQUIRED'}).label,'Match stopped');
 assert.equal(matchActivity({status:{surface,terminal:{winner:0}}}).label,'Match finished');
});
test('action cues require current offered commands, never name or mana guesses',()=>{
 const surface={cards:[{id:1,known:true,name:'Forest'},{id:2,known:true,name:'Forest'}],canAct:true,decision:{kind:'Priority'},choices:[{sourceId:1,kind:'PlayLand',label:'Play Forest',token:'r1'}]},snapshot={status:{surface}};
 assert.equal(cardActionCues(snapshot,1)[0].label,'Play');
 assert.deepEqual(cardActionCues(snapshot,2),[]);
 for(const state of [{...snapshot,busy:true},{...snapshot,error:'FAILED'},{status:{surface,terminal:{winner:0}}}])assert.deepEqual(cardActionCues(state,1),[]);
 surface.choices=[];assert.deepEqual(cardActionCues(snapshot,1),[]);
});
test('ability cues require an available exact reference and authorized interaction',()=>{
 const choice={id:'a',available:true,surfaces:[{type:'object',reference:'1',name:'Forest'},{type:'action',code:'activateAbility'}]};
 const surface={cards:[{id:1,known:true},{id:2,known:false}],decision:{kind:'Priority'},interaction:{canSubmit:true,opportunities:[{interactionId:'r1',type:'choose',choices:[choice]}]}},snapshot={status:{surface}};
 assert.equal(cardActionCues(snapshot,1)[0].tone,'ability');
 choice.available=false;assert.deepEqual(cardActionCues(snapshot,1),[]);choice.available=true;
 choice.surfaces[0].reference='2';assert.deepEqual(cardActionCues(snapshot,2),[]);choice.surfaces[0].reference='1';
 surface.interaction.canSubmit=false;assert.deepEqual(cardActionCues(snapshot,1),[]);
});
test('ambiguous object roles are not turned into a playable-card promise',()=>{
 const surface={cards:[{id:1,known:true}],decision:{kind:'Priority'},interaction:{canSubmit:true,opportunities:[{interactionId:'r1',type:'choose',choices:[{id:'a',available:true,surfaces:[{type:'object',reference:'1'},{type:'object',reference:'2'},{type:'action',code:'castSpell'}]}]}]}};
 assert.deepEqual(cardActionCues({status:{surface}},1),[]);
});
