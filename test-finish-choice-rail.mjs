// Finish choice rail contracts and real attachment lifecycle. No browser or network.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {finishPreview,syncFinishChoiceRail,attachFinishPreview} from './finish-preview.js';
const card={id:'fixture',set:'clb',layout:'normal',finishes:['nonfoil','foil','etched']};
const html=finishPreview('mtg',card,{priceFinish:'etched'});
assert.match(html,/class="finish-choice-rail" tabindex="0" aria-label="Card finishes, scroll horizontally"/);
assert.match(html,/class="finish-choice-hint small muted" hidden aria-hidden="true">Scroll ↔/);
assert.match(html,/data-finish="etched" aria-pressed="true"/);
assert.equal((html.match(/type="button" class="chip(?: on)?"/g)||[]).length,3);
assert.doesNotMatch(html,/tabindex="-1"|onkeydown|onwheel/,'native buttons and keyboard scrolling stay intact');
const css=await readFile(new URL('./finish-effects.css',import.meta.url),'utf8');
assert.match(css,/\.finish-choice-rail\{[^}]*flex-wrap:nowrap[^}]*width:100%[^}]*min-width:0[^}]*max-width:100%[^}]*overflow-x:auto[^}]*scroll-behavior:auto[^}]*scrollbar-width:thin/);
assert.match(css,/\.finish-choice-rail \.chip\{flex:0 0 auto;min-height:44px;white-space:nowrap\}/);
assert.doesNotMatch(css,/\.finish-preview>div\{[^}]*flex-wrap:wrap/);
let writes=0;const hint={hidden:true};
const rail={isConnected:true,clientWidth:200,scrollWidth:600,clientLeft:0,parentElement:{querySelector:()=>hint},getBoundingClientRect:()=>({left:20,right:220,width:200}),querySelector:()=>selected};
let scroll=0;Object.defineProperty(rail,'scrollLeft',{get:()=>scroll,set:value=>{scroll=value;writes++;}});
const pill=(start,width)=>({getBoundingClientRect:()=>({left:20+start-scroll,right:20+start+width-scroll,width})});
let selected=pill(440,140);
syncFinishChoiceRail(rail);assert.equal(scroll,380);assert.equal(hint.hidden,false);assert.equal(writes,1,'initial selected button becomes visible by scrolling only its rail');
scroll=0;syncFinishChoiceRail(rail);assert.equal(scroll,0);assert.equal(writes,1,'routine render sync does not fight a manual swipe');
selected=pill(240,120);syncFinishChoiceRail(rail);assert.equal(scroll,160);assert.equal(writes,2,'changed selection reveals only the needed distance');
selected=pill(0,90);syncFinishChoiceRail(rail);assert.equal(scroll,0,'backward selection is revealed');
selected=pill(440,140);syncFinishChoiceRail(rail);scroll=0;rail.clientWidth=250;syncFinishChoiceRail(rail);assert.equal(scroll,330,'resize rechecks the selected finish');
scroll=0;syncFinishChoiceRail(rail,{force:true});assert.equal(scroll,330,'explicit resize can recheck geometry');
rail.clientWidth=700;syncFinishChoiceRail(rail);assert.equal(hint.hidden,true,'no scroll hint when all finishes fit');
rail.clientWidth=0;selected=pill(500,100);const before=writes;syncFinishChoiceRail(rail);assert.equal(writes,before,'hidden panels do not scroll or consume initial reveal');
rail.clientWidth=200;syncFinishChoiceRail(rail);assert.equal(scroll,400);
selected=pill(50,300);syncFinishChoiceRail(rail);assert.equal(scroll,50,'an unusually long choice aligns its beginning without page overflow');
selected=null;syncFinishChoiceRail(rail);assert.equal(scroll,50,'missing selection never invents one');
rail.isConnected=false;const detached=writes;syncFinishChoiceRail(rail,{force:true});assert.equal(writes,detached);

// Attachment is active even with reduced motion, but never adds key/wheel handlers.
const original={document:globalThis.document,matchMedia:globalThis.matchMedia,addEventListener:globalThis.addEventListener,removeEventListener:globalThis.removeEventListener,ResizeObserver:globalThis.ResizeObserver,MutationObserver:globalThis.MutationObserver};
const listeners=new Map(),observed=new Set();let mutations,resize,disconnects=0;
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){},querySelectorAll:()=>[]};
globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
globalThis.addEventListener=(key,fn)=>listeners.set(key,fn);globalThis.removeEventListener=key=>listeners.delete(key);
globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(el){observed.add(el);}unobserve(el){observed.delete(el);}disconnect(){disconnects++;observed.clear();}};
globalThis.MutationObserver=class{constructor(fn){mutations=fn;}observe(_root,opts){assert(opts.attributeFilter.includes('aria-pressed'));}disconnect(){disconnects++;}};
rail.isConnected=true;scroll=0;selected=pill(440,140);
const rootListeners=[],root={querySelectorAll:selector=>selector==='.finish-choice-rail'?[rail]:[],addEventListener:key=>rootListeners.push(key),removeEventListener(){}};
try{
 const dispose=attachFinishPreview(root);assert.equal(scroll,380);assert(observed.has(rail));assert.equal(attachFinishPreview(root),dispose);
 scroll=0;mutations([{type:'attributes'}]);await Promise.resolve();assert.equal(scroll,0,'unrelated mutations preserve user scroll');
 rail.clientWidth=240;resize([{target:rail}]);assert.equal(scroll,340);
 scroll=0;listeners.get('resize')();assert.equal(scroll,340);
 assert(!rootListeners.some(key=>/key|wheel/.test(key)));dispose();assert.equal(observed.size,0);assert.equal(listeners.size,0);assert.equal(disconnects,2);
}finally{for(const [key,value] of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
console.log('PASS: single-row native finish rail, 44px controls, overflow-only hint, selected initial/change/resize reveal, manual swipe preservation, hidden/oversized choices, reduced-motion behavior and observer cleanup.');
