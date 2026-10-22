import assert from 'node:assert/strict';
import {createScryfallClient} from './scryfall-client.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const calls=[];
const fetcher=(url,options)=>new Promise((resolve,reject)=>{
 calls.push({url,at:Date.now(),resolve});
 options.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'})),{once:true});
});
const api=createScryfallClient({fetcher,timeoutMs:1500});
const abort=new AbortController(),background=api('/sets',{signal:abort.signal});const canceled=assert.rejects(background,/cancelled/);
const card=api('/cards/exact');while(calls.length<2)await wait(5);
assert(calls[1].at-calls[0].at>=100,'Request starts remain paced while /sets is pending');
calls[1].resolve(Response.json({id:'exact'}));assert.equal((await card).id,'exact','Exact card resolves without waiting for /sets');abort.abort();await canceled;
const boundedCalls=[];let active=0,peak=0;const started=Date.now(),bounded=createScryfallClient({timeoutMs:80,intervalMs:1,maxActive:2,fetcher:(url,options)=>new Promise((resolve,reject)=>{boundedCalls.push(url);peak=Math.max(peak,++active);options.signal.addEventListener('abort',()=>{active--;reject(Object.assign(Error(),{name:'AbortError'}));},{once:true});})});
await Promise.all(Array.from({length:4},(_,i)=>assert.rejects(bounded('/cards/'+i),/timed out/)));
assert.equal(peak,2,'Bounded in-flight requests');assert(Date.now()-started<145,'Deadline includes queue time, not a fresh timeout after every predecessor');
let attempts=0;const busy=createScryfallClient({timeoutMs:70,fetcher:async()=>{attempts++;return new Response('',{status:429,headers:{'Retry-After':'60'}});}});
await assert.rejects(busy('/cards/busy'),/timed out/);assert.equal(attempts,1,'Provider cooldown is not bypassed by retries');
let missing=0;const bad=createScryfallClient({fetcher:async()=>{missing++;return Response.json({details:'Not found'},{status:404});}});await assert.rejects(bad('/cards/missing'),/Not found/);assert.equal(missing,1);
// No response at all (Scryfall's limiter answers without CORS headers): back off together, longer each
// time, then say the database could not be reached, never "Failed to fetch" or a spelling problem.
let tries=[];const flaky=createScryfallClient({networkBackoffMs:20,fetcher:async()=>{tries.push(Date.now());if(tries.length<3)throw new TypeError('Failed to fetch');return Response.json({id:'late'});}});
assert.equal((await flaky('/cards/late')).id,'late','a request that gets through after a cooldown succeeds');
assert(tries[1]-tries[0]>=20&&tries[2]-tries[1]>=40,'network failures back off longer each time');
tries=[];const down=createScryfallClient({networkBackoffMs:5,fetcher:async()=>{tries.push(1);throw new TypeError('Failed to fetch');}});
await assert.rejects(down('/cards/down'),e=>e.network===true&&/Couldn’t reach the card database/.test(e.message)&&!/Failed to fetch/.test(e.message));
assert.equal(tries.length,3,'three tries before giving up, so a dead provider fails in seconds');
console.log('PASS: slow background request cannot block exact lookup; shared start pacing, bounded concurrency, queue-inclusive deadlines, cancellation and provider cooldown.');
