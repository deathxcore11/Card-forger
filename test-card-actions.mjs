import assert from 'node:assert/strict';
import { CompareSelection, attachCardGestures, moved, cardActionButtons } from './card-actions.js';
assert.equal(moved({x:0,y:0},{clientX:0,clientY:30}),true);
assert.equal(moved({x:0,y:0},{clientX:3,clientY:4}),false);
const c=new CompareSelection();c.start('ptcg',{id:'a',name:'A'});
assert.equal(c.pick('mtg',{id:'b'}),'ignored');
assert.equal(c.pick('ptcg',{id:'a'}),'duplicate');
assert.equal(c.pick('ptcg',{id:'b',name:'B'}),'ready');
assert.equal(c.active,false);assert.deepEqual(c.cards.map(x=>x.id),['a','b']);c.cancel();assert.deepEqual(c.cards,[]);
const events={}, root={addEventListener:(type,fn)=>{(events[type] ||= []).push(fn);}},card={isConnected:true},target={closest:()=>card};
let held=0,picked=0,blocked=0,choosing=false,timer;
const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
globalThis.setTimeout=fn=>(timer=fn,1);globalThis.clearTimeout=()=>{timer=null;};
attachCardGestures({root,onHold:()=>held++,onPick:()=>picked++,choosing:()=>choosing});
const fire=(type,extra={})=>{const e={target,clientX:20,clientY:20,pointerId:1,button:0,isPrimary:true,detail:1,preventDefault:()=>blocked++,stopImmediatePropagation(){},...extra};for(const f of events[type]||[])f(e);};
fire('pointerdown');fire('pointermove',{clientY:50});assert.equal(timer,null);fire('pointerup');fire('click');assert.equal(held,0);assert.equal(picked,0);assert.equal(blocked,1,'scroll cannot turn into a click');
fire('pointerdown');timer();fire('pointerup');fire('click');assert.equal(held,1);assert.equal(blocked,2,'release after hold cannot open the card');
choosing=true;fire('pointerdown');fire('pointerup');fire('click');assert.equal(picked,1);
fire('pointerdown');fire('pointercancel');fire('click');assert.equal(picked,1,'cancelled touch never picks');
fire('keydown',{key:'F10',shiftKey:true});assert.equal(held,2,'keyboard action menu');
globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;
console.log('PASS: hold menu, movement/cancellation guard, keyboard access, distinct same-game comparison.');

// A normal control must not inherit card gesture suppression from a rail scroll.
// Selectable lot backgrounds still need drag/cancel protection before onSelect.
const scopeEvents={},scopeRoot={addEventListener:(type,fn)=>{(scopeEvents[type] ||= []).push(fn);}},batchLot={querySelector:()=>({})};
const ordinary={closest:()=>null},batchTarget={closest:s=>s==='.lot'?batchLot:null},excludedInput={closest:s=>s==='.lot'?batchLot:s==='label,input,select,.stepper,.lot-side'?{}:null},otherButton={closest:s=>s==='.lot'?batchLot:s==='button'?{dataset:{act:'qty'}}:null};
let scopeBlocked=0,scopeStopped=0,batchSelected=0;
attachCardGestures({root:scopeRoot,onHold:()=>assert.fail('non-card background must not hold'),onPick:()=>assert.fail('non-card background must not compare'),choosing:()=>false,onSelect:t=>t===batchTarget?(batchSelected++,true):false});
const scopedFire=(type,target,extra={})=>{const e={target,clientX:20,clientY:20,pointerId:1,button:0,isPrimary:true,detail:1,preventDefault:()=>scopeBlocked++,stopImmediatePropagation:()=>scopeStopped++,...extra};for(const f of scopeEvents[type]||[])f(e);};
for(const control of [ordinary,excludedInput,otherButton])for(const interrupt of ['scroll','pointermove','pointercancel']){
 const before=[scopeBlocked,scopeStopped,batchSelected];scopedFire('pointerdown',control);scopedFire(interrupt,control,{clientY:50});scopedFire('pointerup',control);scopedFire('click',control);
 assert.deepEqual([scopeBlocked,scopeStopped,batchSelected],before,'non-card control retains its single click after '+interrupt);
}
for(const interrupt of ['scroll','pointermove','pointercancel']){
 const before=[scopeBlocked,scopeStopped,batchSelected];scopedFire('pointerdown',batchTarget);scopedFire(interrupt,batchTarget,{clientY:50});scopedFire('pointerup',batchTarget);scopedFire('click',batchTarget);
 assert.deepEqual([scopeBlocked,scopeStopped,batchSelected],[before[0]+1,before[1]+1,before[2]],'selectable lot '+interrupt+' cannot select');
}
scopedFire('pointerdown',batchTarget);scopedFire('pointerup',batchTarget);scopedFire('click',batchTarget);assert.equal(batchSelected,1,'normal lot-background selection remains supported');
scopedFire('pointerdown',batchTarget);scopedFire('scroll',batchTarget);scopedFire('pointerup',batchTarget);scopedFire('click',batchTarget,{detail:0});assert.equal(batchSelected,2,'keyboard selection is not suppressed by stale pointer movement');
scopedFire('pointerdown',batchTarget);scopedFire('scroll',batchTarget);const beforeOrdinary=[scopeBlocked,scopeStopped];scopedFire('pointerdown',ordinary);scopedFire('pointerup',ordinary);scopedFire('click',ordinary);assert.deepEqual([scopeBlocked,scopeStopped],beforeOrdinary,'a new ordinary press clears stale card-domain movement');
console.log('PASS: ordinary controls propagate after scroll/move/cancel; selectable lot drag/cancel and normal/keyboard selection stay protected.');


for (const game of ['mtg','ptcg','ygo']) {
 const html=cardActionButtons({game});
 assert.equal((html.match(/<svg /g)||[]).length,5,'every action has a real SVG');
 assert.doesNotMatch(html,/undefined|null/);
 const icons=[...html.matchAll(/(<svg[\s\S]*?<\/svg>)/g)].map(x=>x[1]);
 assert.equal(new Set(icons).size,5,'collection, binder, wishlist, deck and compare are visually distinct');
 assert.match(html,/Add to wishlist/);
}
assert.match(cardActionButtons({existing:true}),/Move to binder/);
console.log('PASS: five distinct action icons across all games; no undefined menu labels.');
