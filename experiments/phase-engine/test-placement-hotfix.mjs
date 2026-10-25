import test from 'node:test';import assert from 'node:assert/strict';
import {placementIntent,createPlacementGesture,submitPlacement} from './card-placement.mjs';
const fixture=()=>({status:{revision:7,surface:{seat:0,prioritySeat:0,hand:[23],cards:[{id:23,known:true,zone:'Hand',controller:0}],decision:{kind:'Priority'},choices:[],interaction:{canSubmit:true,opportunities:[{interactionId:'offer',type:'choose',choices:['auto','manual'].map(payment=>({id:payment,available:true,surfaces:[{type:'action',code:'castSpell'},{type:'object',reference:'23'},{type:'value',role:'paymentMode',value:payment}]}))}]}}}});
test('viewer-offered automatic cast can be dropped on battlefield or stack',()=>{
 for(const zone of ['battlefield','stack']){const s=fixture();let dropped;const gesture=createPlacementGesture({read:()=>s,onDrop:i=>{dropped=i;return true;}});assert(gesture.begin(23,{pointerId:1,x:0,y:0}));gesture.move({pointerId:1,x:100,y:100});assert(gesture.end({pointerId:1,zone}));assert.equal(dropped.choiceId,'auto');}
});
test('drop submits the exact automatic interaction once',()=>{const s=fixture(),calls=[],session={snapshot:()=>s,select:(...args)=>calls.push(args),confirm:()=>calls.push('confirm')};submitPlacement(session,placementIntent(s,23));assert.deepEqual(calls,[['offer','auto'],'confirm']);});
test('stale revisions, unavailable/ambiguous offers, pending targets and wrong seats cannot cast',()=>{
 for(const edit of [s=>s.busy=true,s=>s.pending={},s=>s.status.surface.prioritySeat=1,s=>s.status.surface.cards[0].known=false,s=>s.status.surface.interaction.canSubmit=false,s=>s.status.surface.interaction.opportunities[0].choices[0].available=false,s=>s.status.surface.interaction.opportunities[0].choices.push({...s.status.surface.interaction.opportunities[0].choices[0],id:'other-auto'})]){const s=fixture();edit(s);assert.equal(placementIntent(s,23),null);}
 const s=fixture(),intent=placementIntent(s,23);s.status.revision++;assert.throws(()=>submitPlacement({snapshot:()=>s},intent),/STALE_CHOICE/);
});
test('opponent battlefield and outside releases do not submit',()=>{for(const zone of ['opponent',null]){const s=fixture();let drops=0;const g=createPlacementGesture({read:()=>s,onDrop:()=>drops++});g.begin(23,{pointerId:1,x:0,y:0});g.move({pointerId:1,x:20,y:20});assert.equal(g.end({pointerId:1,zone}),false);assert.equal(drops,0);}});
