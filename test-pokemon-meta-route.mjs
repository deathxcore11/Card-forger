import assert from 'node:assert/strict';
import {pokemonMetaRoute} from './pokemon-meta-route.js';
import {ptcgMeta,loadMeta,metaState} from './meta.js';
import {planServiceRequest,NATIVE_ORIGIN} from './native-service-policy.js';
const now=Date.now(),date=new Date(now-864e5).toISOString(),calls=[],jobs=[],data=new Map();
const cache={match:async k=>data.get(k.url)?.clone(),put:async(k,r)=>{data.set(k.url,r.clone());}};
const ctx={waitUntil:p=>jobs.push(p)};
const fetchImpl=async(url,init)=>{calls.push(url);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.deepEqual([...new Headers(init.headers).keys()],['accept']);return Response.json([{id:'fixture-event',game:'PTCG',format:'STANDARD',players:24,date}]);};
const route=(path,opts={})=>{const url=new URL('https://cardstashy.com/api/meta/ptcg/'+path);return pokemonMetaRoute(new Request(url,opts.request),url,ctx,{fetchImpl:opts.fetchImpl||fetchImpl,cache:opts.cache===false?null:cache});};
assert.equal((await route('tournaments?format=standard')).status,200);await Promise.all(jobs);await route('tournaments?format=standard');assert.equal(calls.length,1,'public source responses are shared/cached');
await route('tournaments?format=expanded');await route('tournaments?format=glc');assert(calls.some(x=>x.includes('format=EXPANDED')));assert(calls.some(x=>x.includes('format=GLC')));
await route('standings?id=fixture-event');await route('pairings?id=fixture-event');assert(calls.includes('https://play.limitlesstcg.com/api/tournaments/fixture-event/standings'));
const before=calls.length;
for(const path of ['tournaments?format=unlimited','tournaments?format=__proto__','tournaments?url=https://attacker.invalid','tournaments?format=standard&format=glc','standings?id=../secret','standings?id=a%2Fb','standings?id=a&token=secret','pairings?id='])assert.equal((await route(path)).status,400,path);
assert.equal(calls.length,before);assert.equal((await route('tournaments',{request:{method:'POST'}})).status,405);
for(const bad of [()=>new Response('bad JSON'),()=>Response.json({not:'array'}),()=>new Response('x'.repeat(4*1024*1024+1)),()=>new Response('',{status:302,headers:{Location:'https://attacker.invalid/'}}),()=>new Response('',{status:429}),()=>{throw Error('outage');}])assert.equal((await route('standings?id=failure',{cache:false,fetchImpl:async()=>bad()})).status,502);
const plan=planServiceRequest(NATIVE_ORIGIN+'/api/meta/ptcg/tournaments?format=expanded');assert.equal(plan.request.url,'https://cardstashy.com/api/meta/ptcg/tournaments?format=expanded');assert.equal(plan.request.credentials,'omit');assert.throws(()=>planServiceRequest('/api/meta/ptcg/tournaments',{headers:{Authorization:'Bearer fixture'}}),/Authorization/);
const oldFetch=globalThis.fetch,oldStore=globalThis.localStorage;const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
const clientCalls=[];let failExpanded=false;
globalThis.fetch=async value=>{const url=new URL(value,'https://cardstashy.com/');clientCalls.push(url);if(url.pathname==='/api/meta/curation')return Response.json({status:'unavailable'});assert(url.pathname.startsWith('/api/meta/ptcg/'));
 if(url.pathname.endsWith('/tournaments')){const f=url.searchParams.get('format');if(failExpanded&&f==='expanded')throw TypeError('Failed to fetch');return Response.json([{id:f,game:'PTCG',format:{standard:'STANDARD',expanded:'EXPANDED',glc:'GLC'}[f],players:f==='standard'?24:8,date},{id:'foreign',game:'VGC',format:'STANDARD',players:9999,date}]);}
 if(url.pathname.endsWith('/pairings'))return Response.json([]);
 return Response.json([{placing:1,player:'fixture',deck:{id:url.searchParams.get('id'),name:'Fixture '+url.searchParams.get('id')},decklist:{pokemon:[{name:'Fixture Pokémon',count:4,set:'FXA',number:'1'}]}}]);
};
try{
 const standard=await loadMeta('ptcg',true),expanded=await loadMeta('ptcg:expanded',true),glc=await loadMeta('ptcg:glc',true);
 assert.equal(standard.formatId,'standard');assert.equal(expanded.formatId,'expanded');assert.equal(glc.formatId,'glc');assert.equal(expanded.decks[0].formatId,'expanded');assert.equal(glc.decks[0].formatId,'glc');
 assert.notEqual(standard.decks[0].key,expanded.decks[0].key);assert.equal(metaState('ptcg').data,standard);
 failExpanded=true;assert.equal(await loadMeta('ptcg:expanded',true),expanded,'format-local failure preserves only that format’s last-good results');assert.equal(metaState('ptcg').data,standard);assert.match(metaState('ptcg:expanded').error,/connection/);
 const count=clientCalls.length;await assert.rejects(()=>ptcgMeta({format:'unlimited'}),/not available/);await assert.rejects(()=>ptcgMeta({format:'__proto__'}),/not available/);assert.equal(clientCalls.length,count,'unsupported formats never fetch or borrow Standard');
 const direct=await ptcgMeta({server:true,fetchImpl:async url=>url.includes('/tournaments?')?Response.json([{id:'wrong',game:'PTCG',format:'GLC',players:100,date}]):assert.fail('foreign-format event must not load'),now}).catch(e=>e);assert.match(direct.message,/No recent/);
}finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStore;}
console.log('PASS: fixed bounded Pokémon proxy, cache, read-only native routing, source errors, format-isolated Standard/Expanded/GLC lists and no fabricated Unlimited coverage.');
