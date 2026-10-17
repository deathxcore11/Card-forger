// Local CPU benchmark only; not a camera/device or recognition latency claim.
// node scripts/benchmark-scan-geometry.mjs /absolute/path/to/baseline.mjs [rounds]
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {boundaryFixtures} from '../tests/fixtures/scan-geometry-fixtures.mjs';
import * as current from '../scan-vision.js';
if(!process.argv[2])throw Error('Supply a separately saved baseline module; no private image inputs are needed.');
const baseline=await import(pathToFileURL(resolve(process.argv[2])).href),rounds=Math.max(5,Math.min(40,Number(process.argv[3])||15)),fixtures=boundaryFixtures().filter(f=>f.w===224&&f.h===300),times={baseline:[],current:[]},perCase={};
for(let warm=0;warm<3;warm++)for(const f of fixtures)for(const mod of [baseline,current])mod.detectCardQuad(f.data,f.w,f.h);
for(let round=0;round<rounds;round++)for(const f of fixtures){
 const order=round%2?[['current',current],['baseline',baseline]]:[['baseline',baseline],['current',current]];
 for(const [name,mod] of order){const start=performance.now();mod.detectCardQuad(f.data,f.w,f.h);const ms=performance.now()-start;times[name].push(ms);((perCase[f.name]||={baseline:[],current:[]})[name]).push(ms);}
}
const stats=a=>{const sorted=[...a].sort((a,b)=>a-b);return{n:a.length,medianMs:+sorted[Math.floor(a.length*.5)].toFixed(2),p95Ms:+sorted[Math.min(a.length-1,Math.ceil(a.length*.95)-1)].toFixed(2)};};
console.log(JSON.stringify({scope:'same-process Node CPU only; synthetic 224x300 RGBA, alternating order, 3 warm rounds; not phone/camera/recognition latency',node:process.version,rounds,fixtures:fixtures.length,baseline:stats(times.baseline),current:stats(times.current),cases:Object.fromEntries(Object.entries(perCase).map(([name,t])=>[name,{baseline:stats(t.baseline),current:stats(t.current)}]))},null,2));
