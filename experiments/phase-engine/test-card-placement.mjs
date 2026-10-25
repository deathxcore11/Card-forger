import {test} from 'node:test';import assert from 'node:assert/strict';
import {placementIntent,createPlacementGesture} from './card-placement.mjs';
const fixture=()=>({busy:false,error:null,status:{revision:3,terminal:null,surface:{seat:0,prioritySeat:0,decision:{kind:'Priority'},hand:[5],cards:[{id:5,name:'Forest',zone:'Hand',controller:0,known:true}],choices:[{sourceId:5,token:'e:3:0',kind:'PlayLand',label:'Play Forest'}]}}});
test('placement requires one visible owned hand action and identifies the engine destination',()=>{
 const s=fixture();assert.equal(placementIntent(s,5).zone,'battlefield');s.status.surface.choices[0].kind='CastSpell';assert.equal(placementIntent(s,5).zone,'stack');
 for(const change of [s=>s.busy=true,s=>s.error='RECOVERY_REQUIRED',s=>s.status.terminal={winner:0},s=>s.status.surface.cards[0].known=false,s=>s.status.surface.cards[0].controller=1,s=>s.status.surface.cards[0].zone='Library',s=>s.status.surface.prioritySeat=1,s=>s.status.surface.hand=[],s=>s.status.surface.choices.push({...s.status.surface.choices[0],token:'other'})]){const n=fixture();change(n);assert.equal(placementIntent(n,5),null);}
});
test('tap, off-zone drop, Escape and lost priority never send a command',()=>{
 let state=fixture(),sent=0;const g=createPlacementGesture({read:()=>state,onDrop:()=>sent++});
 const begin=()=>g.begin(5,{pointerId:1,x:0,y:0});begin();g.move({pointerId:1,x:3,y:3});g.end({pointerId:1,zone:'battlefield'});assert.equal(sent,0);
 begin();g.move({pointerId:1,x:20,y:20});g.end({pointerId:1,zone:'stack'});assert.equal(sent,0);
 begin();g.move({pointerId:1,x:20,y:20});g.cancel();g.end({pointerId:1,zone:'battlefield'});assert.equal(sent,0);
 begin();g.move({pointerId:1,x:20,y:20});state.status.surface.prioritySeat=1;g.end({pointerId:1,zone:'battlefield'});assert.equal(sent,0);
});
test('accepted drop sends the current token once, never coordinates or fabricated card movement',()=>{
 const state=fixture(),sent=[],preview=[];const g=createPlacementGesture({read:()=>state,onPreview:p=>preview.push(p),onDrop:p=>sent.push(p.token)});
 g.begin(5,{pointerId:9,x:0,y:0});assert.equal(g.move({pointerId:8,x:20,y:20}),false);assert.equal(g.move({pointerId:9,x:20,y:20}),true);g.end({pointerId:9,zone:'battlefield'});g.end({pointerId:9,zone:'battlefield'});assert.deepEqual(sent,['e:3:0']);assert.equal(preview.at(-1),null);
});
test('revision/token races and busy transitions retire the highlighted offer',()=>{
 for(const change of [s=>s.status.revision++,s=>s.status.surface.choices[0].token='new-capability',s=>s.busy=true]){const s=fixture(),sent=[];const g=createPlacementGesture({read:()=>s,onDrop:p=>sent.push(p)});g.begin(5,{pointerId:1,x:0,y:0});g.move({pointerId:1,x:20,y:20});change(s);g.reconcile();assert.equal(g.active(),false);g.end({pointerId:1,zone:'battlefield'});assert.deepEqual(sent,[]);}
});
