// Actual production adapters with offline source/API doubles, no HTTP or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerTcg,SOURCES,cache} from './tcg.js';
import {createScanBudget,scanDeadline,SCAN_DEADLINES,SCAN_LIMITS} from './scancam.js';
import {scanIdentifierEvidence} from './scan-signals.js';
import {mtgCollector,nameCandidates,scanNameKey} from './scan.js';
import {S,blank} from './store.js';
S.state=blank();globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.document={querySelector:()=>null};globalThis.fetch=async()=>assert.fail('No external request');
const ctx={A:{},C:{},I:{},render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};registerTcg(ctx);
const saved={ptcg:{...SOURCES.ptcg},ygo:{...SOURCES.ygo}},limit={...SCAN_DEADLINES};
const makeBudget=()=>{const b=createScanBudget();b.begin();b.beginRevision();return b;};
const many={name:'Pikachu',code:Array.from({length:30},(_,i)=>`${i+1}/128`).join('\n'),full:''};
const tick=()=>new Promise(r=>setTimeout(r,0));
try{
 let calls=0,release;SOURCES.ptcg.byNameNumber=async()=>{calls++;await new Promise(r=>release=r);return [];};
 const budget=makeBudget(),control=budget.adapterControl(),pending=ctx.scanMatch(many,'eng',false,()=>{},'ptcg',control);pending.catch(()=>{});
 await assert.rejects(scanDeadline(()=>pending,5,'Mock adapter',()=>control.cancel()),e=>e.code==='SCAN_TIMEOUT');assert.equal(calls,1);release();await assert.rejects(pending,e=>e.code==='SCAN_CANCELED');assert.equal(calls,1,'timed-out first call cannot start29 later code lookups');assert.equal(scanIdentifierEvidence('ptcg',many).observations.length,30,'request cap never truncates conflict evidence');
 let gets=0;const card={id:'fixture-pikachu',game:'ptcg',name:'Pikachu',set:{id:'test',name:'Fixture',number:'1',total:128},variants:[{key:'normal'}],prices:{}};delete cache.ptcg[card.id];SOURCES.ptcg.byNameNumber=async()=>{calls++;return [{id:card.id}];};SOURCES.ptcg.get=async(id,opts)=>{gets++;assert.deepEqual(opts,{printings:false,prices:false});return card;};SOURCES.ptcg.search=async()=>({cards:[card]});
 const dedupe=makeBudget(),read={name:'Pikachu',code:'1/128',full:''};calls=0;
 for(let n=0;n<2;n++){const c=dedupe.adapterControl();const result=await ctx.scanMatch(read,'eng',false,()=>{},'ptcg',c);c.cancel();assert(result.cands.length);}
 assert.equal(calls,1);assert.equal(gets,1);assert.equal(dedupe.counts.adapterOperations,2,'same source operations reused across changed query rounds');
 calls=0;await ctx.scanMatch(many,'eng',false,()=>{},'ptcg');assert.equal(calls,30,'unguarded legacy/manual adapter behavior is unchanged');
 const capped=makeBudget();let admitted=0;SOURCES.ptcg.byNameNumber=async()=>{admitted++;return Array.from({length:100},(_,i)=>({id:'cap-'+i}));};SOURCES.ptcg.get=async()=>{admitted++;return null;};
 await assert.rejects(ctx.scanMatch(many,'eng',false,()=>{},'ptcg',capped.adapterControl()),e=>e.code==='SCAN_BUDGET');assert.equal(admitted,SCAN_LIMITS.initialAdapterOperations);
 capped.beginRevision(true);await assert.rejects(ctx.scanMatch({...many,name:'Raichu'},'eng',false,()=>{},'ptcg',capped.adapterControl()),e=>e.code==='SCAN_BUDGET');assert.equal(admitted,SCAN_LIMITS.adapterOperations);assert.equal(capped.counts.adapterOperations,12);
 // Exhaustion after a useful early candidate preserves it as review-only.
 const partial=makeBudget();let first=true;SOURCES.ptcg.byNameNumber=async()=>{const id=first?card.id:'noise';first=false;return [{id}];};SOURCES.ptcg.get=async id=>id===card.id?card:null;SOURCES.ptcg.search=async()=>({cards:[]});
 // Spend five operations before this round so the valid name+details leaves
 // only one operation for the later contradictory hypotheses.
 const pc=partial.adapterControl();for(let i=0;i<5;i++)await pc.run('pre-'+i,async()=>null);
 const retained=await ctx.scanMatch(many,'eng',false,()=>{},'ptcg',pc);assert.equal(retained.budgetLimited,true);assert.equal(retained.cands[0]?.id,card.id);assert.equal(retained.cands[0].exact,false);assert.equal(retained.cands[0].identifierConflict,true);
 console.log('PASS: real Pokémon adapter blocks post-timeout fan-out, deduplicates source lookups/hydration, caps8+4 operations and lookup hypotheses while preserving all30 conflicting identifiers; no-guard semantics unchanged.');
 let ygoRelease,ygoCalls=0,ygoGets=0;globalThis.fetch=async()=>{ygoCalls++;await new Promise(r=>ygoRelease=r);return {ok:true,json:async()=>({id:12345678})};};SOURCES.ygo.get=async()=>{ygoGets++;return null;};
 const yc=makeBudget().adapterControl(),yp=ctx.scanMatch({name:'Fixture Dragon',code:'TST-EN001'},'eng',false,()=>{},'ygo',yc);yp.catch(()=>{});await tick();yc.cancel();ygoRelease();await assert.rejects(yp,e=>e.code==='SCAN_CANCELED');assert.equal(ygoCalls,1);assert.equal(ygoGets,0,'no YGO details after canceled setcode');
 const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8'),source=app.slice(app.indexOf('async function mtgScanMatch('),app.indexOf('async function mtgScanAdd('));
 let magicRelease,magicCalls=0;const magic=new Function('api','mtgScanCand','mtgCollector','nameCandidates','key',source+';return mtgScanMatch;')(async()=>{magicCalls++;await new Promise(r=>magicRelease=r);return null;},(card,why,exact)=>({card,name:card.name,exact}),mtgCollector,nameCandidates,scanNameKey);
 const mc=makeBudget().adapterControl(),mp=magic({name:'Fixture Bolt',code:'U 001\nTST EN'},'eng',false,{lockSet:'abc'},mc);mp.catch(()=>{});await tick();mc.cancel();magicRelease();await assert.rejects(mp,e=>e.code==='SCAN_CANCELED');assert.equal(magicCalls,1,'no fuzzy/set-locked fallback after canceled exact request');
 const invalid=makeBudget().adapterControl(()=>false);await assert.rejects(magic({name:'Fixture Bolt'},'eng',false,{},invalid),e=>e.code==='SCAN_CANCELED');assert.equal(magicCalls,1);
 console.log('PASS: actual YGO and MTG adapters stop hydration/fuzzy fallback after canceled requests, and stale revisions cannot admit a first operation. Counts are source operations, not lower-provider HTTP fan-out.');
}finally{Object.assign(SOURCES.ptcg,saved.ptcg);Object.assign(SOURCES.ygo,saved.ygo);Object.assign(SCAN_DEADLINES,limit);}
