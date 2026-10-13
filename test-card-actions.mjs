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
