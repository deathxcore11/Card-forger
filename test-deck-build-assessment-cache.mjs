// Synthetic assessments isolate work counts; the real optimizer and its exact
// candidate order, legality/price gates and scoring comparison run unchanged.
import assert from 'node:assert/strict';
import {createBuildAssessmentCache} from './deck-pipeline.js';
import {comparePower,refineCandidates,towardDeck} from './deck-optimizer.js';
const seed={name:'Original',ranking:1,cards:[{name:'Original card',qty:4}]};
const candidates=Array.from({length:40},(_,i)=>({name:'Candidate '+i,ranking:i+2,cards:[{name:'Card '+i,qty:4}],legal:i!==0,unknown:i===1}));
// Independent original filter-then-slice reference: retain the exact admitted
// window before quoting/evaluating, including unknown-price entries.
async function originalRefine(candidates,{neighbors,evaluate,cost,accept,rounds,maxNeighbors}){
 const found=[...candidates];let frontier=[...candidates];
 for(let round=0;round<rounds;round++){
  const next=[];
  for(const deck of frontier){
   const before=evaluate(deck),options=neighbors(deck).filter(accept).slice(0,maxNeighbors);let best=null;
   for(const d of options){const quote=cost(d);if(quote.unknown)continue;const after=evaluate(d);if(comparePower(after,before)<=0)continue;
    const improved={...d,...quote,assessment:after,power:after.score};found.push(improved);if(!best||comparePower(after,best.assessment)>0)best=improved;
   }if(best)next.push(best);
  }frontier=next;if(!frontier.length)break;
 }return found;
}
async function run(lazy,refine=refineCandidates){
 let inspections=0,scores=0;const scored=[];
 const score=d=>{scores++;scored.push(d.name);return {score:d.ranking,readiness:{provisional:false}};};
 const inspect=d=>{inspections++;return {rows:[{price:d.unknown?null:1,qty:4,owned:0}],check:{legal:d.legal!==false}};};
 const cache=createBuildAssessmentCache(inspect,score);
 const assessment=d=>lazy?cache.inspect(d):{...inspect(d),power:score(d)};
 const initial=JSON.stringify([seed,candidates]);
 const result=await refine([seed],{rounds:1,maxNeighbors:2,neighbors:()=>candidates,
  accept:d=>assessment(d).check.legal,
  cost:d=>{const a=assessment(d);return {cost:a.rows[0].price===null?0:4,unknown:a.rows[0].price===null?4:0};},
  evaluate:d=>lazy?cache.power(d):assessment(d).power});
 assert.equal(JSON.stringify([seed,candidates]),initial,'Refinement must not mutate candidates retained by the request-local cache');
 return {result,inspections,scores,scored};
}
const before=await run(false,originalRefine),after=await run(true);
assert.deepEqual(after.result,before.result,'Lazy work preserves exact output, source candidates, order, assessment and costs');
assert.deepEqual(after.result.map(d=>d.name),['Original','Candidate 2'],'Illegal and unknown-price candidates remain excluded; unused later candidates cannot replace the same admitted set');
assert.deepEqual(after.scored,['Original','Candidate 2'],'Only the original and admitted, known-price neighbor require full Power');
assert(after.scores<before.scores/10,JSON.stringify({before:before.scores,after:after.scores}));
assert.equal(after.inspections,4,'Only seed, rejected first neighbor and first two accepted neighbors need inspection; later neighbors cannot enter the original admission window');
let quote=1,reads=0;const deck={cards:[{name:'Mutable outside evidence',qty:1}]};
const buildPass=()=>createBuildAssessmentCache(()=>{reads++;return {quote};},()=>null);
const first=buildPass();assert.equal(first.inspect(deck).quote,1);assert.equal(first.power(deck),null);assert.equal(first.power(deck),null);assert.equal(reads,1);
quote=7;assert.equal(buildPass().inspect(deck).quote,7,'A new request reads changed quote/card/ownership evidence rather than carrying old cached assessments');assert.equal(reads,2);
const live={oracle_text:'Draw a card.',quote:1,owned:0};let liveReads=0,liveScores=0;
const refreshed=createBuildAssessmentCache(()=>{liveReads++;return structuredClone(live);},()=>{liveScores++;return live.oracle_text;},{revision:()=>JSON.stringify(live)});
assert.equal(refreshed.inspect(deck).quote,1);assert.equal(refreshed.power(deck),'Draw a card.');
live.oracle_text='Discard a card.';live.quote=9;live.owned=1;
assert.deepEqual(refreshed.inspect(deck),live,'A rules, price or ownership refresh invalidates an in-progress candidate assessment');assert.equal(refreshed.power(deck),'Discard a card.');assert.equal(liveReads,2);assert.equal(liveScores,2);
const original={cards:[{name:'Keep',qty:1},{name:'Cut',qty:3}]},target={cards:[{name:'Keep',qty:1},{name:'Add',qty:3}]},snapshot=JSON.stringify([original,target]);
const neighbors=towardDeck(original,target,{protectedKeys:new Set(['Keep'])});assert(neighbors.length);neighbors[0].cards[0].qty=99;assert.equal(JSON.stringify([original,target]),snapshot,'Replacement generation owns cloned rows, making per-pass object identity safe');
console.log('PASS: request-local lazy assessment preserves exact optimizer output and hard gates, scores only admitted priced candidates, reads each candidate once, and never reuses evidence across builds.');

for(const maxNeighbors of [0,1,2,12,50]){
 const options={rounds:2,maxNeighbors,neighbors:()=>candidates,accept:d=>d.legal!==false,cost:d=>({cost:4,unknown:d.unknown?1:0}),evaluate:d=>({score:d.ranking,readiness:{provisional:false}})};
 assert.deepEqual(await refineCandidates([seed],options),await originalRefine([seed],options),`Exact original output across two rounds and admission limit ${maxNeighbors}`);
}
let calls=0;
await assert.rejects(refineCandidates([seed],{current:()=>false,neighbors:()=>{calls++;return candidates;},evaluate:()=>{calls++;return {};},cost:()=>({})}),{name:'AbortError'});
assert.equal(calls,0,'Already replaced request performs no refinement work');
let active=true,accepted=0;
await assert.rejects(refineCandidates([seed],{current:()=>active,neighbors:()=>candidates,evaluate:()=>({score:1}),cost:()=>({cost:1}),accept:()=>{accepted++;active=false;return false;}}),{name:'AbortError'});
assert.equal(accepted,1,'Replacement during admission stops further checks');
active=true;
await assert.rejects(refineCandidates([seed],{current:()=>active,rounds:2,maxNeighbors:1,neighbors:()=>[seed],evaluate:()=>({score:1}),cost:()=>({cost:1}),status:()=>{active=false;}}),{name:'AbortError'});
console.log('PASS: first-accepted refinement matches the original full filter across limits and rounds; cancellation stops stale work.');
