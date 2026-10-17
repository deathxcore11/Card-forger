import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {attachRuleLearning,openRuleReference} from './rule-learning.js';
import {entryReference,RULE_VERSIONS,RULE_SOURCES} from './rule-reference.js';
const pack={...JSON.parse(gunzipSync(fs.readFileSync('rulebooks/mtg-rules-v1.json.gz'))),version:RULE_VERSIONS.mtg,sources:RULE_SOURCES.mtg};
class Node {
 constructor(name,doc){this.name=name;this.ownerDocument=doc;this.hidden=false;this.scrollTop=0;this.scrollLeft=0;this.isConnected=true;this.attrs={};this.children=new Map();this.dataset={};}
 set innerHTML(value){this.html=value;this.children=new Map();if(value.includes('data-rule-heading'))this.children.set('[data-rule-heading]',new Node('source heading',this.ownerDocument));}
 get innerHTML(){return this.html||'';}
 querySelector(selector){return this.children.get(selector)||null;}
 setAttribute(k,v){this.attrs[k]=v;}
 focus(){assert(!['input','textarea'].includes(this.name),'source navigation must never focus an editor');this.ownerDocument.activeElement=this;}
 scrollIntoView(){this.scrolled=true;this.ownerDocument.scrollingElement.scrollTop=0;}
}
function fixture(g='ptcg'){
 const doc={scrollingElement:{scrollTop:240,scrollLeft:0}},root=new Node('root',doc);root.dataset.game=g;root.listeners={};root.addEventListener=(k,f)=>(root.listeners[k]||=[]).push(f);
 for(const key of ['data-learning-home','data-learning-library','data-rule-destination','data-library-heading','data-learn-start','data-rule-search'])root.children.set(`[${key}]`,new Node(key==='data-rule-search'?'input':key,doc));
 root.querySelector('[data-rule-search]').value='leave my query alone';root.querySelector('[data-learning-library]').hidden=true;root.querySelector('[data-rule-destination]').hidden=true;
 const trigger=new Node('source button',doc);trigger.dataset={};doc.activeElement=trigger;return {root,doc,trigger};
}

const {root,doc,trigger}=fixture('mtg');
const ancestor={listeners:{},addEventListener(k,f){(this.listeners[k]||=[]).push(f);}};
attachRuleLearning(root);attachRuleLearning(ancestor);
const nested=new Node('nested source button',doc);
await openRuleReference(root,entryReference('mtg','502'),{trigger,load:async()=>pack});
await openRuleReference(root,entryReference('mtg','503'),{trigger:nested,load:async()=>pack});
const back={dataset:{},matches:selector=>selector==='[data-rule-back]',closest:selector=>selector==='button'?back:selector==='[data-learning-root]'?root:null};
const event={target:back};
root.listeners.click[0](event);ancestor.listeners.click[0](event);
assert(root.querySelector('[data-learning-home]').hidden,'One bubbled Back returns only one source level');
assert.match(root.querySelector('[data-rule-destination]').innerHTML,/data-rule-entry="502\."/);
const next={target:back};root.listeners.click[0](next);ancestor.listeners.click[0](next);
assert(!root.querySelector('[data-learning-home]').hidden,'Second actual click returns to original answer');
assert.equal(doc.activeElement,trigger);
await openRuleReference(root,entryReference('mtg','502'),{trigger,load:async()=>pack});
await openRuleReference(root,entryReference('mtg','503'),{trigger:nested,load:async()=>pack});
const key={key:'Escape',target:back,preventDefault(){},stopPropagation(){}};
root.listeners.keydown[0](key);ancestor.listeners.keydown[0](key);
assert(root.querySelector('[data-learning-home]').hidden,'One Escape also returns one source level');
assert.match(root.querySelector('[data-rule-destination]').innerHTML,/data-rule-entry="502\."/);
console.log('PASS: local guide and document Rules delegation process each bubbled click/Escape exactly once.');
