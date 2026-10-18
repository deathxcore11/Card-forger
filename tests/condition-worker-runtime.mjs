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
