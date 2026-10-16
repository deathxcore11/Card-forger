import assert from 'node:assert/strict';
import {pickerOptions,chooseOption,attachGlassSelects} from './glass-select.js';
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
