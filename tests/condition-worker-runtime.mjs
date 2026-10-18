// Exercise the real Workers Request implementation and Durable Object storage.
// Node-only fetch mocks cannot detect unsupported Workers request options.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {Miniflare}=await import(process.env.MINIFLARE_MODULE||'miniflare');
const root=fileURLToPath(new URL('../',import.meta.url));
const names=['condition-cache.js','tcgplayer-web-source.js','tcgplayer-condition-source.js'];
const sources=await Promise.all(names.map(async name=>({type:'ESModule',path:path.join(root,name),contents:await readFile(path.join(root,name),'utf8')})));
const entry={type:'ESModule',path:path.join(root,'runtime-test-entry.js'),contents:`
 export {ConditionPriceCache} from './condition-cache.js';
 export default {async fetch(request,env){
  return env.PRICES.get(env.PRICES.idFromName('test')).fetch('https://prices/?product=250317&category=3');
 }};`};
const catalog={productId:250317,productLineId:3,skus:[
 {sku:5236151,condition:'Near Mint',variant:'Holofoil',language:'English'},
 {sku:5236152,condition:'Lightly Played',variant:'Holofoil',language:'English'}]};
const prices=catalog.skus.map((s,i)=>({skuId:s.sku,marketPrice:i?0.64:0.81,calculatedAt:new Date().toISOString()}));
async function run({legacy=false,status=200}={}){
 let calls=0;
 const mf=new Miniflare({modulesRoot:root,modules:[entry,...sources.map(s=>legacy?{...s,contents:s.contents.replaceAll("redirect:'manual'","redirect:'error'")}:s)],
  compatibilityDate:'2026-07-30',bindings:{TCGPLAYER_WEB_TEST:'true'},durableObjects:{PRICES:{className:'ConditionPriceCache',useSQLite:true}},
  outboundService:async request=>{calls++;
   assert(!request.headers.has('Authorization')&&!request.headers.has('Cookie'));
   if(status!==200)return new Response('',{status,headers:status===302?{Location:'https://unexpected.invalid/'}:{'Retry-After':'60'}});
   if(request.url.endsWith('/details'))return Response.json(catalog);
   assert.deepEqual(await request.json(),{skuIds:[5236151,5236152]});return Response.json(prices);
  }});
 try{
  const first=await (await mf.dispatchFetch('https://app.test/')).json();
  if(legacy){assert.equal(first.providers.tcgplayer,'tcgplayer_web_error');assert.equal(calls,0,'Old request fails before contacting the source');return;}
  if(status!==200){assert.equal(first.status,'unavailable');assert.equal(calls,1,'Redirect or refusal is never followed');assert.equal(first.diagnostics.tcgplayer.httpStatus,status);return;}
  assert.equal(first.status,'available');assert.equal(first.source,'TCGplayer');assert.deepEqual(first.data[0].variants.map(v=>[v.condition,v.price]),[['Near Mint',.81],['Lightly Played',.64]]);assert.equal(calls,2);
  const cached=await (await mf.dispatchFetch('https://app.test/')).json();assert.equal(cached.cachedAt,first.cachedAt);assert.equal(calls,2,'Durable cache prevents a second source request');
 }finally{await mf.dispose();}
}
await run({legacy:true});await run();await run({status:302});await run({status:403});
console.log('PASS: actual Workers runtime reproduces the old pre-network failure; fixed reader returns NM/LP, reuses durable cache, rejects redirects and respects refusals.');

// The new daily selection uses the same real Workers runtime, persisted SQLite
// storage and alarm API. No live card provider is contacted by this fixture.
const dailySources=await Promise.all(['daily-card-route.js','daily-clock.js'].map(async name=>({type:'ESModule',path:path.join(root,name),contents:await readFile(path.join(root,name),'utf8')})));
const dailyEntry={type:'ESModule',path:path.join(root,'daily-runtime-test-entry.js'),contents:`
 export {DailyCards} from './daily-card-route.js';
 import {dailyCardRoute} from './daily-card-route.js';
 export default {fetch:dailyCardRoute};`};
const dailyCalls={mtg:0,ygo:0,ptcg:0};
const dailyRuntime=new Miniflare({modulesRoot:root,modules:[dailyEntry,...dailySources],compatibilityDate:'2026-07-30',durableObjects:{DAILY_CARDS:{className:'DailyCards',useSQLite:true}},
 outboundService:async request=>{
  const g=request.url.includes('scryfall')?'mtg':request.url.includes('ygoprodeck')?'ygo':'ptcg';dailyCalls[g]++;
  return Response.json(g==='mtg'?{id:'runtime-magic',name:'Runtime Magic',image_uris:{art_crop:'https://example.test/magic.jpg'}}:g==='ygo'?{data:[{id:1,name:'One'},{id:2,name:'Two'}]}:[{id:'sv01-1',name:'One',image:'https://assets.tcgdex.net/en/sv/sv01/001'},{id:'sv01-2',name:'Two',image:'https://assets.tcgdex.net/en/sv/sv01/002'}]);
 }});
try{
 for(const game of ['mtg','ygo','ptcg']){
  const replies=await Promise.all([1,2,3].map(()=>dailyRuntime.dispatchFetch('https://app.test/api/daily-card?game='+game)));
  assert(replies.every(r=>r.status===200));const data=await Promise.all(replies.map(r=>r.json()));
  assert(data.every(d=>d.card.id===data[0].card.id));assert.equal(data[0].timeZone,'America/New_York');assert(Date.parse(data[0].nextResetAt)>Date.now());assert.equal(dailyCalls[game],1);
 }
 assert.equal((await dailyRuntime.dispatchFetch('https://app.test/api/daily-card?game=invalid')).status,400);
}finally{await dailyRuntime.dispose();}
console.log('PASS: shared daily cards execute in the real Workers runtime with durable SQLite storage, concurrent request deduplication and midnight alarms.');
