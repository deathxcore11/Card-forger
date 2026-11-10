import assert from 'node:assert/strict';
import {thinkKind,pickThink,THINK,CpuActionPlaybackQueue} from './experiments/forge-proof/cpu-action-playback.mjs';
assert.equal(thinkKind({actor:'CPU',kind:'land'}),'land');
assert.equal(thinkKind({actor:'CPU',kind:'spell',label:'CPU · CASTS',targets:[]}),'spell');
assert.equal(thinkKind({actor:'CPU',kind:'spell',label:'CPU · CASTS',targets:[{}]}),'targeted');
assert.equal(thinkKind({actor:'CPU',kind:'spell',label:'CPU · TRIGGER',targets:[]}),null,'a trigger is not a decision');
assert.equal(thinkKind({actor:'CPU',kind:'phase',tone:'attack'}),'attack');
assert.equal(thinkKind({actor:'CPU',kind:'phase',tone:'block'}),'block');
assert.equal(thinkKind({kind:'land'}),null,'your own plays never think');
for(const k of ['land','spell','targeted','attack','block']){let last=-1;for(let i=0;i<200;i++){const v=pickThink(k,last);assert.ok(v>=THINK[k][0]&&v<=THINK[k][1]+10,`${k} ${v}`);assert.notEqual(v,last,'never the same value twice running');last=v;}}
console.log('cpu think ok');
