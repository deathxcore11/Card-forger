import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ruleHoverPosition} from './rule-hover.js';
import {keywordHelp,ruleText} from './rule-dex.js';
for(const [game,key] of [['ptcg','Knocked Out'],['ptcg','Ability'],['mtg','flying'],['ygo','Quick Effect']]){assert(keywordHelp(game,key)?.definition);assert.match(ruleText(game,key),/data-act="ruleHint"/);}
const r={left:30,top:50,bottom:70},v={width:800,height:600},s={width:320,height:150};
assert.deepEqual(ruleHoverPosition(r,s,v,{x:40,y:65}),{left:40,top:82});
assert.deepEqual(ruleHoverPosition({left:760,top:560,bottom:580},s,v,{x:770,y:570}),{left:472,top:398});
for(const width of [240,360,800])for(const x of [-5,50,width+10])for(const y of [0,300,590]){const p=ruleHoverPosition({left:x,top:y,bottom:y+20},s,{width,height:600},{x,y});assert(p.left>=8);assert(p.top>=8);assert(p.top+s.height<=592);}
const source=fs.readFileSync('rule-hover.js','utf8');assert(!source.includes('innerHTML'));assert.match(source,/any-hover: hover/);assert.match(source,/pointerType==='touch'/);assert.match(source,/textContent=text/);assert.match(source,/root.addEventListener\('close'/);assert.match(source,/aria-describedby/);
assert.match(fs.readFileSync('app.js','utf8'),/attachRuleHover\(\);/);
console.log('PASS shared rule definitions, position/clamp, touch guard, safe text and lifecycle hooks');
