// Actual Workers Request semantics, synthetic provider responses only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {Miniflare}=await import(process.env.MINIFLARE_MODULE||'miniflare');
const root=fileURLToPath(new URL('../',import.meta.url));
const names=['ygo-set-prices.js','ygo-prices.js','ygo-identity.js','price-reference.js'];
const sources=await Promise.all(names.map(async name=>({type:'ESModule',path:path.join(root,name),contents:await readFile(path.join(root,name),'utf8')})));
const entry={type:'ESModule',path:path.join(root,'ygo-runtime-fixture.js'),contents:`import {ygoSetPriceRoute} from './ygo-set-prices.js';export default {fetch(request,env,ctx){return ygoSetPriceRoute(new URL(request.url),ctx);}};`};
async function run({legacy=false,status=200}={}){
 let calls=0;
 const mf=new Miniflare({modulesRoot:root,modules:[entry,...sources.map(s=>legacy?{...s,contents:s.contents.replace("redirect:'manual'","redirect:'error'")}:s)],compatibilityDate:'2026-07-30',outboundService:async request=>{
  calls++;assert(!request.headers.has('Authorization')&&!request.headers.has('Cookie'));assert.match(request.headers.get('User-Agent'),/^CardStashy\//);
  if(status!==200)return new Response('',{status,headers:{Location:'https://untrusted.invalid/', 'Retry-After':'60'}});
  return Response.json({results:request.url.endsWith('/groups')?[{name:'Synthetic runtime set',abbreviation:'FXR',groupId:91001}]:request.url.endsWith('/products')?[{name:'Synthetic runtime card',categoryId:2,groupId:91001,productId:91002,extendedData:[{name:'Number',value:'FXR-EN001'},{name:'Rarity',value:'Super Rare'}]}]:[{productId:91002,subTypeName:'1st Edition',marketPrice:2}]});
 }});
 try{
  const url='https://fixture.invalid/api/prices/yugioh-set?name=Synthetic+runtime+set&code=FXR',response=await mf.dispatchFetch(url),body=await response.json();
  if(legacy){assert.equal(response.status,503);assert.equal(calls,0,'Old mode fails before reaching the provider');return;}
  if(status!==200){assert.equal(response.status,503);assert.equal(calls,1,'Refusal/redirect not followed');assert.match(body.notice,new RegExp(String(status)));return;}
  assert.equal(response.status,200);assert.equal(body.status,'ready');assert.equal(calls,3);assert.deepEqual(body.products[0].quotes,[{edition:'1st Edition',market:2}]);
  const cached=await (await mf.dispatchFetch(url)).json();assert.equal(cached.updatedAt,body.updatedAt);assert.equal(calls,3,'Daily set snapshot is reused');
 }finally{await mf.dispose();}
}
await run({legacy:true});await run();for(const status of [302,403,429])await run({status});
console.log('PASS: real Workers runtime reproduces pre-network YGO failure, returns fixed exact snapshots, reuses cache, rejects redirects and respects provider refusals.');
