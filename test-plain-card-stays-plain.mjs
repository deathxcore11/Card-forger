// Regression (owner, 2026-11-14, app 0.4.78): Avatar of Burgeoning Echoes (FRA 122, mythic) with Finish = Nonfoil
// leaned with the phone and caught light like a foil, and its oval security stamp was covered by a sliding
// pink-to-blue strip. A plain card stays still; only its stamp answers the light, through a mask read from the picture.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {finishAttrs} from './finish-preview.js';
import {MTG_FOIL_FRAGMENT} from './mtg-foil.js';

const avatar={id:'fixture-fra-122',name:'Avatar of Burgeoning Echoes',set:'fra',collector_number:'122',rarity:'mythic',frame:'2015',border_color:'black',security_stamp:'oval',layout:'normal',finishes:['nonfoil','foil'],prices:{usd:'1.00',usd_foil:'2.00'}};
const plainAttrs=finishAttrs('mtg',avatar,{priceFinish:'nonfoil'},'detail'),foilAttrs=finishAttrs('mtg',avatar,{priceFinish:'foil'},'detail');
assert.match(plainAttrs,/data-finish-effect="plain"/,'Nonfoil resolves to the plain finish');
assert.match(plainAttrs,/data-holostamp="1"/,'a mythic keeps its stamp when plain');
assert.doesNotMatch(foilAttrs,/data-finish-effect="plain"/,'Traditional foil is not plain');

// Phone tilt: the real attachTilt, fed real orientation samples.
class Node{
 constructor(classes=''){this.classes=new Set(classes.split(' ').filter(Boolean));this.values={};this.dataset={};this.handlers={};this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v)};this.style={setProperty:(k,v)=>this.values[k]=v,removeProperty:k=>delete this.values[k]};}
 addEventListener(k,f){(this.handlers[k]||=[]).push(f);}
 emit(k,extra={}){for(const f of this.handlers[k]||[])f({target:this,...extra});}
 getBoundingClientRect(){return {width:140,height:200,left:10,right:150,top:10,bottom:210};}
 closest(){return null;}contains(n){return n===this;}querySelectorAll(){return this.cards||[];}
}
let frames=[];
const root=new Node(),win=new Node(),card=new Node('cd-img');
root.cards=[card];root.querySelectorAll=s=>s==='dialog[open]'?[]:root.cards;root.querySelector=()=>({querySelectorAll:()=>root.cards});
globalThis.document=root;root.body=root;globalThis.window=win;globalThis.innerWidth=390;globalThis.innerHeight=844;
globalThis.localStorage={getItem:()=>null,setItem(){}};
Object.defineProperty(globalThis,'navigator',{value:{maxTouchPoints:1},configurable:true});
globalThis.matchMedia=q=>({matches:q.includes('reduced-motion')?false:q.includes('coarse')});
win.DeviceOrientationEvent=globalThis.DeviceOrientationEvent=class{};
globalThis.requestAnimationFrame=f=>{frames.push(f);return frames.length;};globalThis.addEventListener=win.addEventListener.bind(win);
globalThis.IntersectionObserver=class{observe(){}unobserve(){}};globalThis.MutationObserver=class{observe(){}};
const flush=()=>{const q=frames;frames=[];q.forEach(f=>f());};
const {attachTilt}=await import('./feel.js');
attachTilt(root);
const turn=(beta,gamma)=>{win.emit('deviceorientation',{beta,gamma});flush();};
card.dataset.finishEffect='plain';
turn(30,0);turn(40,12);
assert(!card.classes.has('gyro')&&!card.classes.has('tilting'),'a plain card does not lean with the phone');
assert.equal(card.values['--tx'],undefined,'a plain card gets no tilt angle');
assert.notEqual(card.values['--mx'],undefined,'the light position still moves, for the stamp');
card.dataset.finishEffect='mtg-foil';
turn(30,0);turn(40,12);
assert(card.classes.has('gyro'),'a foil still leans with the phone');
card.dataset.finishEffect='plain';
turn(41,13);
assert(!card.classes.has('gyro')&&!card.classes.has('tilting')&&card.values['--tx']===undefined,'switching the same card to Nonfoil stops the lean');

// The moving glare belongs to foils only.
const preview=await readFile(new URL('./finish-preview.js',import.meta.url),'utf8');
assert.match(preview,/if\(detail&&p\.effect!=='plain'\)\{const light=/,'no spotlight layer is mounted on a plain card');

// Stamp: invisible until measured on the picture, never a fixed box, never moving on its own.
const css=await readFile(new URL('./finish-effects.css',import.meta.url),'utf8');
const rule=css.match(/\.finish-holostamp\{[^}]*\}/)[0],after=css.match(/\.finish-holostamp::after\{[^}]*\}/)[0];
assert.doesNotMatch(rule+after,/animation/,'the stamp colour does not slide by itself');
assert.doesNotMatch(css,/@keyframes finish-holostamp/);
assert.match(rule,/opacity:0[;}]/,'an unmeasured stamp draws nothing');
assert.doesNotMatch(rule,/left:|top:|width:|height:/,'no assumed place or size');
assert.match(css,/\.finish-holostamp\.mapped\{opacity:\.\d+\}/);
assert.match(rule,/var\(--mx,50%\)/,'the colour follows the light');
assert.match(preview,/stampFor\(src,\(\)=>readableCopy\(src\)\)/,'the stamp is measured from the shown picture');
assert.doesNotMatch(MTG_FOIL_FRAGMENT,/M15|vec2\(\.5,\.925\)/,'the foil shader no longer paints a stamp at a fixed place');
console.log('PASS: a Nonfoil card stays still under phone tilt, has no glare layer, and its stamp is drawn only where the picture shows one.');
