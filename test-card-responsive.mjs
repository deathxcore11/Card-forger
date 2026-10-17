// Pure lifecycle/fixture tests: no DOM renderer, server, browser or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {attachTilt,motionCard} from './feel.js';
import {rememberDetailViewport,restoreDetailViewport} from './pricing-presentation.js';
import {visibleRulePassage,ygoTurnStructureDisplay} from './rule-reference.js';
class Node {
 constructor(classes='') { this.classes=new Set(classes.split(' '));this.values={};this.dataset={};this.handlers={};this.bounds={width:140,height:200,left:10,right:150,top:10,bottom:210};this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v)};this.style={setProperty:(k,v)=>this.values[k]=v}; }
 addEventListener(k,f) {(this.handlers[k]||=[]).push(f);}
 emit(k,extra={}) {for(const f of this.handlers[k]||[])f({target:this,pointerType:'touch',clientX:135,clientY:30,...extra});}
 getBoundingClientRect(){return this.bounds;}
 closest(s){return s.includes('.cd-img')&&this.classes.has('cd-img')?this:null;}
 contains(n){return n===this;}
 querySelectorAll(){return this.cards||[];}
}
let reduce=false,frames=[],intersection,mutation,observed=[];
const root=new Node(),win=new Node(),background=new Node('cd-img'),card=new Node('cd-img'),dialog=new Node();
root.dialogs=[];root.cards=[background,card];dialog.cards=[card];root.querySelectorAll=s=>s==='dialog[open]'?root.dialogs:s.includes('data-shone')?root.cards.filter(c=>!c.dataset.shone):root.cards;root.querySelector=()=>({querySelectorAll:()=>[background]});
globalThis.document=root;root.body=root;globalThis.window=win;globalThis.innerWidth=390;globalThis.innerHeight=844;
Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:1},configurable:true});
globalThis.matchMedia=q=>({matches:q.includes('reduced-motion')?reduce:q.includes('coarse')});
win.DeviceOrientationEvent=globalThis.DeviceOrientationEvent=class {};
globalThis.requestAnimationFrame=f=>{frames.push(f);return frames.length;};globalThis.addEventListener=win.addEventListener.bind(win);
globalThis.IntersectionObserver=class {constructor(f){intersection=f;}observe(c){observed.push(c);}unobserve(){}};
globalThis.MutationObserver=class {constructor(f){mutation=f;}observe(){}};
const flush=()=>{const q=frames;frames=[];q.forEach(f=>f());};
attachTilt(root);assert.equal(win.handlers.deviceorientation.length,1);
win.emit('deviceorientation',{beta:30,gamma:0});flush();assert(background.classes.has('gyro'));
root.dialogs=[dialog];mutation();flush();assert(card.classes.has('gyro'),'opening the first dialog consumes the last available sample without a zoom round trip');
assert.equal(motionCard(root),card);win.emit('deviceorientation',{beta:42,gamma:12});flush();assert.notEqual(card.values['--tx'],'0deg');
card.classList.remove('gyro','tilting');card.classList.add('shine-once');
root.emit('pointerdown',{target:card});assert(!card.classes.has('shine-once'),'first touch removes animation fill before it can mask tilt');assert.notEqual(card.values['--tx'],'0deg');
intersection([{isIntersecting:true,target:card}]);assert(!card.classes.has('shine-once'),'late intersection cannot put the entrance animation over an active touch');flush();
root.emit('pointerup',{target:card});root.emit('pointerdown',{target:card});await new Promise(r=>setTimeout(r,280));assert(card.classes.has('tilting'),'release from an earlier press cannot end a newer press');
root.emit('pointercancel',{target:card});assert(!card.classes.has('tilting'),'scroll cancellation releases touch immediately');
win.emit('deviceorientation',{beta:48,gamma:15});flush();assert(card.classes.has('gyro'));
const replacement=new Node('cd-img');dialog.cards=[replacement];root.cards=[background,replacement];mutation();flush();assert.equal(replacement.values['--tx'],'0deg','replacement printing gets its own resting angle');win.emit('deviceorientation',{beta:55,gamma:25});flush();assert.notEqual(replacement.values['--tx'],'0deg');
const overlay=new Node();overlay.cards=[];root.dialogs.push(overlay);assert.equal(motionCard(root),null,'a non-card foreground modal never animates a background card');const held=replacement.values['--tx'];win.emit('deviceorientation',{beta:70,gamma:35});flush();assert.equal(replacement.values['--tx'],held);
root.dialogs.pop();mutation();flush();assert.notEqual(replacement.values['--tx'],held,'closing overlay resumes existing card without re-opening it');
win.emit('orientationchange');flush();assert.equal(replacement.values['--tx'],'0deg','rotation recalibrates rather than throwing the card to an extreme');
replacement.bounds={...replacement.bounds,top:1100,bottom:1300};assert.equal(motionCard(root),null);replacement.bounds={...replacement.bounds,top:100,bottom:300};root.emit('scroll');flush();assert(replacement.classes.has('gyro'),'scrolling into view schedules motion with no extra touch');
let permissionCalls=0;DeviceOrientationEvent.requestPermission=()=>{permissionCalls++;return Promise.resolve('granted');};const permittedRoot=new Node();permittedRoot.querySelector=()=>null;attachTilt(permittedRoot);assert.equal(win.handlers.deviceorientation.length,2,'Platforms with an existing permission also listen immediately');assert.equal(permissionCalls,0,'Registering for existing motion never prompts for new permission');delete DeviceOrientationEvent.requestPermission;
reduce=true;const reducedRoot=new Node();attachTilt(reducedRoot);assert.deepEqual(reducedRoot.handlers,{});reduce=false;
console.log('PASS: first-open sensor activation, active-touch/late-observer race, release-timer race, cancellation, foreground ownership, replacement calibration, scrolling, rotation and reduced motion.');
const pack=JSON.parse(gunzipSync(readFileSync('rulebooks/ygo-rules-v1.json.gz'))),entry=pack.entries.find(e=>e.id==='0-p20'),before=structuredClone(entry),display=visibleRulePassage('ygo',entry);
assert.equal(display.fullText,entry.text);assert.deepEqual(entry,before);assert(display.text.startsWith('Turn Structure\n\nA Duel'));assert(!display.text.startsWith('How\nTo\nPlay'));assert(display.text.includes('IMPORTANT: The player who goes first cannot draw during the Draw Phase of their first turn.'));
for(const label of ['Draw Phase','Standby Phase','Main Action in this Phase','Possible Other Actions'])assert.equal(display.text.split(label).length,entry.text.split(label).length,'Legitimate repeated '+label+' remains intact');
const tokens=s=>s.replace(/\s+/g,' ').trim();assert.equal(tokens(display.text),tokens(entry.text.replace('How\nTo\nPlay\nHow\nTo\nPlay\nTurn Structure\nTurn Structure\n','Turn Structure\n').replace(/\n35\n34$/,'')),'Only verified page furniture and whitespace change; no rule words disappear');
for(const changed of [{...entry,id:'0-p21'},{...entry,doc:1},{...entry,text:'Rule 1\nRule 1\n'+entry.text},{...entry,text:entry.text+'\n1. Repeated rule 1.'}])assert.equal(ygoTurnStructureDisplay(changed),null,'Unknown structure must remain exact');
for(const game of ['mtg','ptcg'])assert.equal(visibleRulePassage(game,{id:'new',text:'Rule 1\nRule 1\nDraw Phase\nDraw Phase'}).text,'Rule 1\nRule 1\nDraw Phase\nDraw Phase');
console.log('PASS: exact-page display cleanup preserves every rule token and legitimate repeated phase label, complete raw text, canonical entry and all other sources.');
const css=readFileSync('style.css','utf8'),app=readFileSync('app.js','utf8');assert.match(css,/@container \(max-width:520px\)/);assert.match(css,/\.ca-main \{ grid-template-columns:1fr;/);assert.match(app,/window.addEventListener\?\.\("resize"/);assert.doesNotMatch(app,/resize[^\n]*(refreshSheet|location\.reload)/);
const reflow=css.slice(css.indexOf('/* Reflow the existing components'));
for(const selector of ['.card-actions .ca-more { display:flex','.card-actions .ca-more .btn { flex:1','.card-actions .ca-main .btn { padding:9px','.cs-card-side .own-line { margin:0','.cs-card-side .stat-grid > :only-child'])assert(reflow.indexOf(selector)>reflow.indexOf('@container (max-width:520px)'),selector+' is narrow-only; approved wide layout retains its existing grid, padding and margins');
assert.match(app,/\.detailMountGeneration = \(\$\("#sheetBody"\)\.detailMountGeneration \|\| 0\) \+ 1;\s*\$\("#sheetBody"\)\.innerHTML = html/,'Every actual open/mount creates a new viewport lifetime');
assert.match(app,/body\.detailMountGeneration = \(body\.detailMountGeneration \|\| 0\) \+ 1;\s*body\.innerHTML = ctx\.type/,'A refreshed mount cannot inherit clamp intent from replaced content');

let top=600,max=1000;const body={get scrollTop(){return top;},set scrollTop(v){top=Math.min(max,v);}};
const id='ygo:print-1:overview',portrait='390x1000',landscape='844x390';
rememberDetailViewport(body,id,portrait,1);
max=400;top=400;rememberDetailViewport(body,id,'1024x1000',1); // Native clamp before resize.
restoreDetailViewport(body,id,'1024x1000',1);assert.equal(top,400);
rememberDetailViewport(body,id,'1024x1000',1); // The assignment's scroll event must not erase 600.
max=300;restoreDetailViewport(body,id,landscape,1);rememberDetailViewport(body,id,landscape,1);
max=1000;restoreDetailViewport(body,id,portrait,1);assert.equal(top,600,'Returning from multiple clamped viewports restores the intended reading position');
top=250;rememberDetailViewport(body,id,portrait,1);restoreDetailViewport(body,id,landscape,1);assert.equal(top,250,'A real user scroll updates the remembered place');
top=10;rememberDetailViewport(body,'ygo:print-2:prices',landscape,1);restoreDetailViewport(body,'ygo:print-2:prices',portrait,1);assert.equal(top,10,'New selected printing/tab never inherits another card’s reading position');
// Exact review regression: current intent supersedes every old geometry, not
// only the geometry in which the user happened to scroll.
const current={scrollTop:100};rememberDetailViewport(current,id,portrait,1);restoreDetailViewport(current,id,landscape,1);
current.scrollTop=900;rememberDetailViewport(current,id,landscape,1);restoreDetailViewport(current,id,portrait,1);
assert.equal(current.scrollTop,900,'Portrait100 → landscape → user900 → portrait retains latest900, not obsolete100');
// A user scroll also cancels an outstanding larger, temporarily clamped intent.
top=900;max=1000;rememberDetailViewport(body,id,portrait,2);max=400;top=400;restoreDetailViewport(body,id,landscape,2);
top=150;rememberDetailViewport(body,id,landscape,2);max=1000;restoreDetailViewport(body,id,portrait,2);assert.equal(top,150,'A genuine scroll while clamped discards the earlier900 intent');
// The sheet body and exact card identity persist across close/reopen. Its new
// mount generation, unlike a resize, must discard all earlier carryover.
top=600;rememberDetailViewport(body,id,portrait,3);restoreDetailViewport(body,id,landscape,3);
top=0;rememberDetailViewport(body,id,landscape,4);restoreDetailViewport(body,id,portrait,4);assert.equal(top,0,'Close/reopen same card at0 cannot revive the old600 reading position');
top=600;rememberDetailViewport(body,id,portrait,7);max=0;top=0;restoreDetailViewport(body,id,landscape,7);rememberDetailViewport(body,id,landscape,7);
rememberDetailViewport(body,id,landscape,8);max=1000;restoreDetailViewport(body,id,portrait,8);assert.equal(top,0,'A fresh mount clears600 carryover even when the previous clamped top was already0');
top=600;rememberDetailViewport(body,id,portrait,5);top=0;restoreDetailViewport(body,id,landscape,6);assert.equal(top,0,'Even a resize before the new mount scroll callback starts at its current0');
console.log('PASS: clamp-only carryover, latest user intent across geometries, new-mount/close-reopen reset and exact card/printing/tab isolation without resize remount or focus changes.');
