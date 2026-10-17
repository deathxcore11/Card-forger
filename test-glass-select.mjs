import assert from 'node:assert/strict';
import {pickerOptions,chooseOption,revealCollectionFilter,attachGlassSelects} from './glass-select.js';
const group={label:'Finishes',disabled:false,hidden:false};
const option=(value,label,extra={})=>({value,label,selected:false,disabled:false,hidden:false,closest:()=>group,...extra});
class Select extends EventTarget {
 constructor(options){super();this.options=options;this.selectedIndex=0;this.disabled=false;}
}
for(const game of ['mtg','ptcg','ygo']){
 const select=new Select([option('a','Normal',{selected:true}),option('b','Foil'),option('c','Unavailable',{disabled:true}),option('d','Hidden',{hidden:true})]);
 let changes=0,inputs=0;select.addEventListener('change',e=>{changes++;assert.equal(e.bubbles,true);});select.addEventListener('input',()=>inputs++);
 assert.equal(pickerOptions(select)[1].group,'Finishes');
 assert.equal(chooseOption(select,1),true);assert.equal(select.selectedIndex,1);assert.equal(changes,1);assert.equal(inputs,1);
 assert.equal(chooseOption(select,1),true);assert.equal(changes,1,'same selection does not save twice');
 for(const n of [2,3,99,-1])assert.equal(chooseOption(select,n),false);
 select.disabled=true;assert.equal(chooseOption(select,0),false);select.disabled=false;
 group.disabled=true;assert.equal(chooseOption(select,0),false);group.disabled=false;
 group.hidden=true;assert.equal(chooseOption(select,0),false);group.hidden=false;
 // A subsequent app render can replace the option list; opening reads the current list.
 select.options=[option('new','New printing')];assert.equal(pickerOptions(select)[0].value,'new');
}
// Headless/action environments and unsupported browsers retain the original control.
assert.doesNotThrow(()=>attachGlassSelects({body:{}}));
console.log('PASS: shared dropdown choices preserve original input/change events, disabled groups, hidden options, same-value saves and replaced options in all three games.');
// Actual delegated focus handler, with geometry only. It reveals a known native
// Collection pill without invoking scrollIntoView or changing vertical scroll,
// the focused element, its value, or any input/change events.
const content={isConnected:true},handlers={},view={scrollX:0,scrollY:470,getComputedStyle:()=>({overflowX:'auto'})},doc={body:{dataset:{view:'collection',game:'ygo'}},defaultView:view,querySelector:()=>content,addEventListener:(type,fn)=>{handlers[type]=fn;}};
const rail={scrollLeft:0,scrollTop:17,offsetWidth:288,clientWidth:288,clientLeft:0,matches:s=>s==='.coll-tools > .filter-pills',closest:()=>content,getBoundingClientRect:()=>({left:16,right:304,width:288})};
const pill={tagName:'SELECT',isConnected:true,disabled:false,multiple:false,size:0,dataset:{change:'tCollSort'},parentElement:rail,value:'set-order',getBoundingClientRect:()=>({left:238.078-rail.scrollLeft,right:436.469-rail.scrollLeft,width:198.391}),scrollIntoView:()=>assert.fail('Do not scroll the whole page to reveal the rail')};
doc.activeElement=pill;attachGlassSelects(doc);assert.equal(typeof handlers.focusin,'function','Native controls retain focus reveal even without custom-dialog support');
handlers.focusin({target:pill});assert.equal(rail.scrollLeft,132.469);assert.equal(rail.scrollTop,17);assert.equal(view.scrollY,470);assert.equal(view.scrollX,0);assert.equal(doc.activeElement,pill);assert.equal(pill.value,'set-order');
handlers.focusin({target:pill});assert.equal(rail.scrollLeft,132.469,'Already visible control does not move');
const first={...pill,dataset:{change:'tCollSet'},getBoundingClientRect:()=>({left:16-rail.scrollLeft,right:116-rail.scrollLeft,width:100})};handlers.focusin({target:first});assert.equal(rail.scrollLeft,0,'Reverse Tab reveals the first pill by the minimal negative delta');
for(const change of [{tagName:'BUTTON'},{isConnected:false},{disabled:true},{multiple:true},{size:2},{dataset:{change:'unknown'}},{dataset:{change:'constructor'}},{dataset:{change:'toString'}},{dataset:{change:'tCollKind',field:'unknown'}},{parentElement:{...rail,matches:()=>false}},{parentElement:{...rail,closest:()=>({})}}]){const candidate={...pill,...change},before=candidate.parentElement.scrollLeft;revealCollectionFilter(candidate,doc);assert.equal(candidate.parentElement.scrollLeft,before,'Unknown or ineligible control is unchanged');assert.equal(rail.scrollLeft,0);}
for(const dataset of [{view:'search',game:'ygo'},{view:'collection',game:'mtg'},{view:'collection',game:'other'}]){revealCollectionFilter(pill,{...doc,body:{dataset}});assert.equal(rail.scrollLeft,0,'Other routes and games are unchanged');}
revealCollectionFilter(pill,{...doc,defaultView:{getComputedStyle:()=>({overflowX:'hidden'})}});assert.equal(rail.scrollLeft,0,'Clipped containers are not treated as intentional rails');
const orphan={...rail,closest:()=>null};revealCollectionFilter({...pill,parentElement:orphan},{...doc,querySelector:()=>null});assert.equal(orphan.scrollLeft,0,'Two missing roots never make an orphan rail eligible');
content.isConnected=false;revealCollectionFilter(pill,doc);assert.equal(rail.scrollLeft,0,'A detached content root cannot own live focus reveal');content.isConnected=true;
const scaledRail={...rail,offsetWidth:288,clientWidth:288,getBoundingClientRect:()=>({left:20,right:380,width:360})},scaled={...pill,parentElement:scaledRail,getBoundingClientRect:()=>({left:297.5975,right:545.58625,width:247.98875})};revealCollectionFilter(scaled,doc);assert(Math.abs(scaledRail.scrollLeft-132.469)<1e-8,'Visual zoom converts only the local horizontal delta to scroll units');assert.equal(scaledRail.scrollTop,17);
console.log('PASS: delegated exact Collection focus reveals left/right native pills by minimal horizontal deltas, preserves vertical/page/focus/value state, supports visual scale, and leaves unrelated controls/routes/scrollers unchanged.');
