import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
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

// Actual handler, with the native original-target rule: connected targets bubble
// to #content; a target removed by a same-route render keeps its own listeners but
// no longer bubbles. No synthetic trust claims and no browser are involved.
function eventNode(parent = null) {
 const listeners=new Map();
 return {parentElement:parent,isConnected:true,scrollWidth:100,clientWidth:100,closest:()=>null,
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  contains(target){for(let node=target;node;node=node.parentElement)if(node===this)return true;return false;},
  count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);},
  async dispatch(type,event){for(const fn of [...(listeners.get(type)||[])])await fn(event);if(this.isConnected&&this.parentElement)await this.parentElement.dispatch(type,event);}
 };
}
function originalTargetHarness(contextOverride) {
 const root=eventNode(),target=eventNode(root),other=eventNode(root),changes=[];
 let game='mtg',revision=0,allowed=true;
 const dispose=attachHomeSwipe(root,{view,enabled:()=>allowed,current:()=>game,context:contextOverride||(()=>revision),switchGame:async next=>{changes.push(next);game=next;return true;}});
 const send=async (type,x=120,y=100,node=target,extra={})=>{
  const event={target:node,touches:type==='touchend'||type==='touchcancel'?[]:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}],cancelable:true,prevented:0,preventDefault(){this.prevented++;},...extra};
  await node.dispatch(type,event);return event;
 };
 return {root,target,other,changes,dispose,send,detach(){target.isConnected=false;target.parentElement=null;},context(){revision++;},game(){game='ptcg';},overlay(){allowed=false;}};
}
{
 const h=originalTargetHarness();await h.send('touchstart',250);assert.equal(h.target.count(),3,'One temporary move/end/cancel listener set');
 assert.equal((await h.send('touchmove',120)).prevented,1,'Connected event runs only the root handler');
 await h.send('touchend');assert.deepEqual(h.changes,['ygo'],'Connected gesture switches once');assert.equal(h.target.count(),0,'End releases the original target');h.dispose();assert.equal(h.root.count(),0);
}
{
 const h=originalTargetHarness();await h.send('touchstart',250);await h.send('touchmove',230);h.detach();
 assert.equal((await h.send('touchmove',120)).prevented,1,'Detached target still receives and handles the native move');
 await h.send('touchend');assert.deepEqual(h.changes,['ygo'],'A same-route render cannot lose the original-target touchend');assert.equal(h.target.count(),0);h.dispose();
}
{
 const h=originalTargetHarness();await h.send('touchstart',250);h.detach();
 // A node removed during dispatch can still have #content in the event's
 // already-computed native propagation path. That root path remains the owner.
 const event=await h.send('touchmove',120,100,h.target,{composedPath:()=>[h.target,h.root]});
 assert.equal(event.prevented,0,'Detached listener defers to an already-computed root path');
 await h.root.dispatch('touchmove',event);assert.equal(event.prevented,1);
 await h.send('touchend');assert.deepEqual(h.changes,['ygo']);assert.equal(h.target.count(),0);h.dispose();
}
for(const interrupt of ['context','game','overlay']){
 const h=originalTargetHarness();await h.send('touchstart',250);await h.send('touchmove',230);h.detach();h[interrupt]();await h.send('touchmove',120);await h.send('touchend');
 assert.deepEqual(h.changes,[],interrupt+' guard still rejects a detached gesture');assert.equal(h.target.count(),0);h.dispose();
}
for(const interrupt of ['cancel','vertical','multitouch','replacement','dispose','outside']){
 const h=originalTargetHarness();await h.send('touchstart',250);await h.send('touchmove',230);h.detach();
 if(interrupt==='cancel')await h.send('touchcancel');
 if(interrupt==='vertical'){
  // Restart unlocked, then give the vertical page gesture priority.
  await h.send('touchstart',250,100,h.other);h.other.isConnected=false;h.other.parentElement=null;
  await h.send('touchmove',249,130,h.other);assert.equal(h.other.count(),0);
 }
 if(interrupt==='multitouch')await h.send('touchmove',120,100,h.target,{touches:[{clientX:120,clientY:100},{clientX:140,clientY:100}]});
 if(interrupt==='replacement'){
  await h.send('touchstart',250,100,h.other);assert.equal(h.target.count(),0,'A new target releases the previous detached one');
  await h.send('touchmove',120,100,h.other);await h.send('touchend',120,100,h.other);assert.equal(h.other.count(),0);
 }
 if(interrupt==='dispose')h.dispose();
 if(interrupt==='outside'){
  h.target.isConnected=true;h.target.parentElement=eventNode();await h.send('touchend');
 }
 await h.send('touchend');assert.deepEqual(h.changes,interrupt==='replacement'?['ygo']:[],interrupt+' cannot finish the obsolete gesture');
 assert.equal(h.target.count(),0,interrupt+' releases the target listeners');h.dispose();assert.equal(h.root.count(),0);
}
console.log('PASS: actual original-target handlers survive same-route detachment, never double-handle connected events, preserve guards and release every interrupted gesture.');

// Execute the exact app context hook, not a separately invented replacement guard.
const application=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const contextSource=application.match(/attachHomeSwipe\(\$\("#content"\), \{[\s\S]*?context: ([^\n]+),/)?.[1];
assert(contextSource,'App supplies a stable gesture authority context');
assert.match(application,/const ticket=navigation\.pause\(\); workspaceVisitRevision\+\+/,'Workspace replacement advances the visit even when its game and navigation revision stay unchanged');
for(const change of ['background','workspace','entry','route']){
 const authority={navigation:{revision:7},workspaceVisitRevision:4,activeEntry:{entryId:'original'},location:{hash:'#deck/same/versions'}};
 const actualContext=vm.runInNewContext('('+contextSource+')',authority),h=originalTargetHarness(actualContext);
 const original=actualContext();assert.equal(actualContext(),original,'Repeated context reads are value-stable');
 await h.send('touchstart',250);await h.send('touchmove',230);h.detach();
 if(change==='workspace')authority.workspaceVisitRevision++; // Same-game restore/import begin, with queue revision unchanged.
 if(change==='entry')authority.activeEntry={entryId:'replacement'}; // Completed replacement installs a fresh entry.
 if(change==='route')authority.location.hash='#collection/cards';
 assert.equal(authority.navigation.revision,7,'Regression isolates workspace/visit identity from navigation revision');
 await h.send('touchmove',120);await h.send('touchend');
 assert.deepEqual(h.changes,change==='background'?['ygo']:[],change+' uses the actual app authority hook');assert.equal(h.target.count(),0);h.dispose();
}
console.log('PASS: actual app gesture context permits same-route refresh but rejects replacement workspace, history entry and route changes at unchanged navigation revision.');
