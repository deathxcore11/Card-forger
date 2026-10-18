import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ruleHoverPosition,installRuleHover} from './rule-hover.js';
import {keywordHelp,ruleText} from './rule-dex.js';
for(const [game,key] of [['ptcg','Knocked Out'],['ptcg','Ability'],['mtg','flying'],['ygo','Quick Effect']]){assert(keywordHelp(game,key)?.definition);assert.match(ruleText(game,key),/data-act="ruleHint"/);}
const r={left:30,top:50,bottom:70},v={width:800,height:600},s={width:320,height:150};
assert.deepEqual(ruleHoverPosition(r,s,v,{x:40,y:65}),{left:40,top:82});
assert.deepEqual(ruleHoverPosition({left:760,top:560,bottom:580},s,v,{x:770,y:570}),{left:472,top:398});
for(const width of [240,360,800])for(const x of [-5,50,width+10])for(const y of [0,300,590]){const p=ruleHoverPosition({left:x,top:y,bottom:y+20},s,{width,height:600},{x,y});assert(p.left>=8);assert(p.top>=8);assert(p.top+s.height<=592);}
const source=fs.readFileSync('rule-hover.js','utf8');assert(!source.includes('innerHTML'));assert.match(source,/any-hover: hover/);assert.match(source,/pointerType==='touch'/);assert.match(source,/textContent=text/);assert.match(source,/root.addEventListener\('close'/);assert.match(source,/aria-describedby/);
assert.match(fs.readFileSync('app.js','utf8'),/attachRuleHover\(\);/);
console.log('PASS shared rule definitions, position/clamp, touch guard, safe text and lifecycle hooks');

// Direct production-handler regression: focusin -> queued native scroll must not
// erase a keyboard preview, while pointer, touch, Escape and focusout stay intact.
function eventHub(){const events=new Map();return{addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},emit(type,data={}){const e={type,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...data};for(const fn of events.get(type)||[]){fn(e);if(e.stopped)break;}return e;}};}
function hoverFixture(){
 const all=[],observers=[];let nextTimer=0;const timers=new Map();
 const win={...eventHub(),innerWidth:800,innerHeight:600,matchMedia:()=>({matches:true}),clearTimeout:id=>timers.delete(id),setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}}};
 const node=tag=>{const n={tagName:tag.toUpperCase(),children:[],dataset:{},attrs:{},style:{},isConnected:true,offsetWidth:260,offsetHeight:100,parent:null,rect:{left:40,top:120,right:140,bottom:140},append(child){this.children.push(child);child.parent=this;},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},contains(other){for(let p=other;p;p=p.parent)if(p===this)return true;return false;},closest(selector){if(selector.startsWith('[data-act')&&this.dataset.act==='ruleHint')return this;for(let p=this;p;p=p.parent){if(selector==='dialog'&&p.tagName==='DIALOG')return p;if(selector==='dialog:not([open])'&&p.tagName==='DIALOG'&&!p.open)return p;if(selector==='[hidden]'&&p.hidden)return p;}return null;},getBoundingClientRect(){return this.rect;},showPopover(){}};all.push(n);return n;};
 const body=node('body'),dialog=node('dialog');dialog.open=true;body.append(dialog);
 const root={...eventHub(),defaultView:win,body,activeElement:body,createElement:node,querySelector:s=>s==='#rule-hover-tip'?all.find(n=>n.id==='rule-hover-tip'&&n.isConnected)||null:null};
 const button=node('button');button.dataset={act:'ruleHint',game:'ptcg',rule:'Ability'};dialog.append(button);
 const close=installRuleHover(root,()=>({label:'Ability',definition:'Fixture definition',tip:'Fixture help'}));
 const focus=()=>{root.emit('keydown',{key:'Tab',target:body});root.activeElement=button;root.emit('focusin',{target:button});};
 return{root,win,body,dialog,button,close,focus,tip:()=>root.querySelector('#rule-hover-tip'),mutate:()=>observers.forEach(f=>f())};
}
const h=hoverFixture();h.focus();const keyboardPreview=h.tip();assert(keyboardPreview);const oldTop=keyboardPreview.style.top;
h.button.rect={left:50,top:60,right:150,bottom:80};h.root.emit('scroll',{target:h.dialog});assert.equal(h.tip(),keyboardPreview,'queued focus scroll retains the same keyboard preview');assert.notEqual(h.tip().style.top,oldTop,'retained preview repositions');assert.match(h.button.getAttribute('aria-describedby'),/rule-hover-tip/);
const escape=h.root.emit('keydown',{key:'Escape',target:h.button});assert(escape.prevented&&escape.stopped);assert.equal(h.tip(),null);h.root.emit('scroll',{target:h.dialog});assert.equal(h.tip(),null,'scroll cannot resurrect Escape-dismissed preview');assert.equal(h.dialog.open,true);assert.equal(h.button.getAttribute('aria-describedby'),null);
h.focus();h.root.emit('pointerover',{target:h.button,pointerType:'mouse',clientX:50,clientY:65});assert(h.tip());h.root.emit('scroll',{target:h.dialog});assert.equal(h.tip(),null,'pointer preview dismisses even when target retains keyboard focus');
h.root.emit('pointerover',{target:h.button,pointerType:'touch'});assert.equal(h.tip(),null,'touch never opens hover');h.focus();h.root.emit('pointerdown',{target:h.button,pointerType:'touch'});assert.equal(h.tip(),null,'touch dismisses keyboard preview');
h.focus();h.root.emit('focusout',{target:h.button});assert.equal(h.tip(),null);h.focus();h.button.rect={left:40,top:650,right:140,bottom:670};h.root.emit('scroll',{target:h.dialog});assert.equal(h.tip(),null,'offscreen keyboard anchors do not leave a detached preview');
h.button.rect={left:40,top:120,right:140,bottom:140};h.focus();h.button.isConnected=false;h.mutate();assert.equal(h.tip(),null,'removed anchors dismiss');
console.log('PASS keyboard focus-scroll retention/reposition, pointer-scroll dismissal, touch, Escape and detached-anchor regression');
