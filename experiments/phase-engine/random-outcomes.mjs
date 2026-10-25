// Display-only projections of engine-authorized events. Never generate RNG here.
import {fail} from './protocol-fault.mjs';
const seat=v=>v===0||v===1;
const u8=v=>Number.isInteger(v)&&v>=0&&v<=255;
const keys=(o,list)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===list.length&&list.every(k=>Object.hasOwn(o,k));
export const RANDOM_OUTCOME_LIMIT=12;
export function projectRandomEvents(events){
 if(!Array.isArray(events)||events.length>4096)fail('INVALID_OUTCOME_EVENTS');
 const results=[];
 for(const e of events){
  const d=e?.data;
  if(!['DieRolled','DieRollIgnored','CoinFlipped'].includes(e?.type))continue;
  if(!seat(d?.player_id))fail('INVALID_OUTCOME_EVENTS');
  if(e.type==='CoinFlipped'){
   if(typeof d.won!=='boolean')fail('INVALID_OUTCOME_EVENTS');
   results.push({kind:'coin',player:d.player_id,won:d.won});
  }else{
   // Modifiers may put an accepted result outside the die's natural face range.
   if(!u8(d.sides)||d.sides<1||!(d.result===null&&e.type==='DieRolled')&&!u8(d.result))fail('INVALID_OUTCOME_EVENTS');
   if(e.type==='DieRollIgnored'&&(d.result<1||d.result>d.sides))fail('INVALID_OUTCOME_EVENTS');
   results.push({kind:e.type==='DieRollIgnored'?'ignored-die':'die',player:d.player_id,sides:d.sides,result:d.result});
  }
 }
 return results;
}
const validOutcome=o=>seat(o?.player)&&(o.kind==='coin'?keys(o,['kind','player','won'])&&typeof o.won==='boolean':
 ['die','ignored-die'].includes(o?.kind)&&keys(o,['kind','player','sides','result'])&&u8(o.sides)&&o.sides>0&&
 (o.kind==='die'&&o.result===null||u8(o.result)&&(o.kind!=='ignored-die'||o.result>=1&&o.result<=o.sides)));
export function validOutcomeTimeline(rows,revision){
 if(!Array.isArray(rows)||rows.length>RANDOM_OUTCOME_LIMIT)return false;
 let lastRevision=-1,lastOrder=-1;
 for(const row of rows){
  if(!keys(row,['revision','order','outcome'])||!Number.isSafeInteger(row.revision)||row.revision<0||row.revision>revision||!Number.isSafeInteger(row.order)||row.order<0||row.order>4095||!validOutcome(row.outcome)||row.revision<lastRevision||row.revision===lastRevision&&row.order<=lastOrder)return false;
  lastRevision=row.revision;lastOrder=row.order;
 }
 return true;
}
export function appendRandomOutcomes(previous,next,revision){
 if(!Number.isSafeInteger(revision)||revision<0||!validOutcomeTimeline(previous,revision)||!Array.isArray(next)||next.length>4096||!next.every(validOutcome)||next.length&&previous.some(r=>r.revision===revision))fail('INVALID_OUTCOME_EVENTS');
 return structuredClone([...previous,...next.map((outcome,order)=>({revision,order,outcome}))].slice(-RANDOM_OUTCOME_LIMIT));
}
export function randomOutcomeText(row,seat=0){
 const o=row.outcome,who=o.player===seat?'You':'CPU';
 if(o.kind==='coin')return `${who} flipped a coin · ${o.won?'won':'lost'}`;
 if(o.kind==='ignored-die')return `${who} ignored d${o.sides} roll ${o.result}`;
 return o.result===null?`${who} rolled a symbolic die`:`${who} rolled d${o.sides} · ${o.result}`;
}
