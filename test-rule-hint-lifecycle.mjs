import assert from 'node:assert/strict';
import fs from 'node:fs';
import {showRuleHint,dismissRuleHint} from './rule-dex.js';
const listeners = new Map();
class Node {
 constructor(){this.dataset={};this.style={};this.children=[];this.nodes=new Map();this.isConnected=true;this.offsetHeight=100;}
 setAttribute(){}
 querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Node());return this.nodes.get(s);}
 append(n){this.children.push(n);n.parent=this;}
 remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 addEventListener(){}
 closest(){return null;}
 contains(n){return n===this||this.children.includes(n);}
 getBoundingClientRect(){return {left:50,bottom:100};}
 focus(){document.activeElement=this;}
}
globalThis.document={body:new Node(),createElement:()=>new Node(),addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}};
globalThis.window={innerWidth:800,innerHeight:600};
const keyword=new Node();keyword.dataset={game:'mtg',rule:'flying'};
showRuleHint(keyword);
assert.equal(document.body.children.length,1);assert.equal(listeners.get('keydown').size,1);
assert.equal(dismissRuleHint(),keyword,'Return original connected keyword for the next modal focus restoration');
assert.equal(document.body.children.length,0);
assert.equal(listeners.get('keydown').size,0,'Hidden hint cannot capture Escape intended for the guide or its exact source');
assert.equal(listeners.get('pointerdown').size,0);
assert.equal(dismissRuleHint(),null,'Dismissal is idempotent');
showRuleHint(keyword);keyword.isConnected=false;assert.equal(dismissRuleHint(),null,'Never return a detached focus target');
const app=fs.readFileSync('app.js','utf8'),action=app.slice(app.indexOf('A.askRules ='),app.indexOf('A.askOpen ='));
assert(action.indexOf('dismissRuleHint()')<action.indexOf('openRulesAsk('),'Dismiss hint capture listeners before showing Rules dialog');
assert.match(action,/openRulesAsk\(\{ game, format, cards, references, trigger \}\)/,'Pass original keyword trigger, not the removed hint action');
assert.match(app,/function dismissRulesGuide\(\) \{ closeRulesAsk\(\); dismissRuleHint\(\);/,'Navigation also removes obsolete hint listeners');
console.log('PASS: keyword-to-guide handoff removes capture listeners, preserves connected original focus, and cannot swallow source/dialog Escape.');
