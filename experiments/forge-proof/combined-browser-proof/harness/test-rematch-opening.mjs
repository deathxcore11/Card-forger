// Small control-flow test, NOT browser/native evidence.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('./browser-journey.mjs',import.meta.url),'utf8');
const segment=source.match(/(for\(let i=0;i<5&&s.inputType!=='InputConfirmMulligan';i\+\+\)s=await passive\(\);\s*assert.equal\(s.inputType,'InputConfirmMulligan'\);assert.equal\(own\(s\).zones.Hand.cards.length,7\);s=await action\(key\('ok'\),'rematch Keep'\);)/)?.[1];assert(segment);
const run=new Function('s','passive','action','key','own','assert','return (async()=>{'+segment+'return s;})()');
const mulligan={inputType:'InputConfirmMulligan',zones:{Hand:{cards:Array(7).fill({})}}},opening={inputType:'InputConfirm'},warning={inputType:null,prompt:{method:'getChoices',acknowledgeOnly:true}};
let calls=0,queue=[opening,mulligan],actions=[];await run(warning,async()=>{calls++;return queue.shift();},async(k,label)=>{actions.push(label);return {};},k=>k,s=>s,assert);assert.equal(calls,2);assert.deepEqual(actions,['rematch Keep']);
queue=[mulligan];calls=0;await run(opening,async()=>{calls++;return queue.shift();},async()=>({}),k=>k,s=>s,assert);assert.equal(calls,1);
calls=0;await assert.rejects(run(warning,async()=>{calls++;return warning;},async()=>{throw Error('Must not skip native prompt');},k=>k,s=>s,assert));assert.equal(calls,5);
for(const required of ['assert.notEqual(latest.matchId,first.matchId)','assert.notEqual(latest.generation,first.generation)','report.naturalFinish=true','report.rematchVerified=true','assert.equal(terminals.length,2)','assert.deepEqual(report.errors,[])'])assert(source.includes(required),required);
for(const forbidden of ['route.fulfill','force:true','force: true','dispatchEvent(','scrollLeft='])assert(!source.includes(forbidden),forbidden);
console.log('PASS bounded warning→Play→Mulligan rematch, exact new identity and fail-closed result/source checks');
