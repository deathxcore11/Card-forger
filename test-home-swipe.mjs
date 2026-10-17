import assert from 'node:assert/strict';
import {swipeGame,attachHomeSwipe} from './home-swipe.js';
assert.equal(swipeGame('mtg',-100,5,200),'ygo');
assert.equal(swipeGame('mtg',100,5,200),'ptcg');
assert.equal(swipeGame('ptcg',-100,5,200),'mtg');
for(const args of [[-40,0,100],[-100,90,200],[-100,0,800]])assert.equal(swipeGame('mtg',...args),null);
const handlers={},root={addEventListener:(n,f)=>handlers[n]=f,removeEventListener:(n)=>delete handlers[n],animate:()=>{}},target={closest:()=>null,parentElement:root,scrollWidth:100,clientWidth:100};
let current='mtg',enabled=true,switched=[];
const view={innerWidth:500,getComputedStyle:()=>({overflowX:'auto'}),matchMedia:()=>({matches:true})};
const dispose=attachHomeSwipe(root,{view,enabled:()=>enabled,current:()=>current,switchGame:async g=>{switched.push(g);current=g;}});
const evt=(x,y=100,extra={})=>({target,touches:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}],cancelable:true,preventDefault(){this.prevented=true;},...extra});
async function swipe({start=250,end=120,dy=0}={}){handlers.touchstart(evt(start));handlers.touchmove(evt(end,100+dy));await handlers.touchend(evt(end,100+dy,{touches:[]}));}
await swipe();assert.deepEqual(switched,['ygo']);
let prevented=false;handlers.click({preventDefault:()=>prevented=true,stopImmediatePropagation(){}});assert.ok(prevented,'swipe does not activate the card/button underneath');
enabled=false;await swipe();assert.equal(switched.length,1,'no navigation outside Home or under overlay');enabled=true;
await swipe({dy:150});assert.equal(switched.length,1,'vertical scrolling retains control');
target.scrollWidth=400;await swipe();assert.equal(switched.length,1,'nested horizontal scroller retains control');target.scrollWidth=100;
target.closest=()=>({});await swipe();assert.equal(switched.length,1,'input/slider retains control');target.closest=()=>null;
await swipe({start:10});assert.equal(switched.length,1,'native edge back gesture retains control');
handlers.touchstart(evt(250));handlers.touchmove(evt(130));handlers.touchcancel();await handlers.touchend(evt(120,100,{touches:[]}));assert.equal(switched.length,1,'cancelled touch cannot navigate');
dispose();assert.equal(Object.keys(handlers).length,0);
console.log('PASS: Home swipe cycles games; scroll, input, overlay, edge and cancellation guards; click suppression.');

// Every semantic page shares one gesture path; an interrupted route cannot finish it.
const h={},r={addEventListener:(n,f)=>h[n]=f,removeEventListener(){},animate(){throw Error('Reduced motion must not animate');}},t={closest:()=>null,parentElement:r,scrollWidth:100,clientWidth:100};
let revision=0,game='ptcg',count=0,release;
attachHomeSwipe(r,{view,enabled:()=>true,current:()=>game,context:()=>revision,switchGame:async next=>{count++;await new Promise(ok=>release=ok);game=next;return true;}});
const touch=(x,y=100,extra={})=>({...evt(x,y,extra),target:t});
h.touchstart(touch(250));h.touchmove(touch(120));revision++;await h.touchend(touch(120,100,{touches:[]}));assert.equal(count,0,'route changed mid-gesture');
h.touchstart(touch(250));h.touchmove(touch(120));const first=h.touchend(touch(120,100,{touches:[]}));
h.touchstart(touch(250));h.touchmove(touch(120));await h.touchend(touch(120,100,{touches:[]}));assert.equal(count,1,'second swipe waits for first transition');release();await first;
let clicks=0;h.click({preventDefault:()=>clicks++,stopImmediatePropagation(){}});h.click({preventDefault:()=>clicks++,stopImmediatePropagation(){}});assert.equal(clicks,1,'only the follow-on click is suppressed');
for(const selector of ['button','a','canvas','video','#cropWrap','.scan-confirm','.scan-batch-strip','[data-home-gesture]']){
 t.closest=s=>s.split(',').includes(selector)?{}:null;
 h.touchstart(touch(250));h.touchmove(touch(120));await h.touchend(touch(120,100,{touches:[]}));assert.equal(count,1,selector+' retains its own gestures');
}
t.closest=()=>null;
h.touchstart(touch(250,100,{touches:[{clientX:250,clientY:100},{clientX:260,clientY:100}]}));h.touchmove(touch(120));await h.touchend(touch(120,100,{touches:[]}));assert.equal(count,1,'two fingers never initiate a game change');
console.log('PASS: section/revision guard, serialized gestures, one-click suppression, interactive/carousel/scanner exclusions, two fingers and reduced motion.');
