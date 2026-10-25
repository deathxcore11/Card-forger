import test from 'node:test';
import assert from 'node:assert/strict';
import {turnControlElements,turnFlowMessage,supportedTurnControls} from './play-turn-controls.js';
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.events={};this.isConnected=true;this.disabled=false;this.textContent='';}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 prepend(node){node.parent=this;this.children.unshift(node);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(type,fn){this.events[type]=fn;}
}
const doc={createElement:tag=>new Element(tag)},all=nodes=>nodes.flatMap(n=>[n,...all(n.children)]);
function fixture(patch={}){const calls=[],session={setControlMode:async mode=>calls.push(mode),yieldUntilAction:async()=>calls.push('yield'),cancelYield:async()=>calls.push('cancel'),setPhaseStop:async()=>calls.push('stop')},snapshot={status:{revision:7,surface:{seat:0}},turnFlow:{version:1,supported:true,revision:7,controlMode:'smart',reason:'coverage-unknown',capabilities:{smartPass:true,fullControl:true,temporaryYield:true,phaseStops:true},...patch}};return {calls,session,snapshot};}
test('Smart and Full Control are visible outside disclosures and change only the selected control mode',async()=>{
 const f=fixture(),nodes=turnControlElements({document:doc,...f}),controls=all(nodes),smart=controls.find(n=>n.textContent==='Smart'),full=controls.find(n=>n.textContent==='Full Control');
 for(const button of [smart,full]){assert(button);for(let p=button.parent;p;p=p.parent)assert.notEqual(p.tagName,'details');}
 assert.equal(smart.attributes['aria-pressed'],'true');assert.equal(full.attributes['aria-pressed'],'false');assert.deepEqual(f.calls,[]);
 full.events.click();await Promise.resolve();assert.deepEqual(f.calls,['full']);
 assert.match(controls.map(n=>n.textContent).join(' '),/verified empty response windows/);
});
test('unknown coverage is explained without claiming it will automatically continue',()=>{
 const f=fixture();assert.equal(turnFlowMessage(f.snapshot),'Smart paused · response options could not be verified');
 f.snapshot.turnFlow.reason='auto-pass-ready';assert.match(turnFlowMessage(f.snapshot),/continuing/);
 f.snapshot.turnFlow.revision=6;assert.equal(turnFlowMessage(f.snapshot),'');assert.equal(supportedTurnControls(f.snapshot,f.session),null);
});
test('unsupported, stale and terminal sessions do not show enabled mode controls',()=>{
 for(const patch of [{supported:false},{version:2},{revision:6}]){const f=fixture(patch);assert.deepEqual(turnControlElements({document:doc,...f}),[]);}
 const f=fixture();f.snapshot.status.terminal={winner:0};assert.deepEqual(turnControlElements({document:doc,...f}),[]);
});
test('full control has clear manual passing copy and disables temporary yield',()=>{
 const f=fixture({controlMode:'full'}),nodes=all(turnControlElements({document:doc,...f}));assert.match(nodes.map(n=>n.textContent).join(' '),/Pass manually/);assert.equal(nodes.find(n=>n.textContent==='Pass until I can act').disabled,true);
});
