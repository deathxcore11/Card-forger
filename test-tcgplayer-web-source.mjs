import assert from 'node:assert/strict';
import {ConditionPriceCache} from './condition-cache.js';
import {TcgplayerWebSource,webConditionVariants} from './tcgplayer-web-source.js';
import {conditionFeedRoute,normalizeConditionVariants} from './condition-feed-route.js';
import {applyConditionQuotes,loadConditionQuotes,clearConditionAttempts} from './condition-feed.js';
import {conditionValue,conditionPriceHtml,lastKnownConditionQuote} from './condition-value.js';
const originalFetch=globalThis.fetch,clock=Date.now,DAY=86400000;let now=clock();Date.now=()=>now;
const conditions=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];
// Captured public-page schema; amounts/timestamps here are deterministic fixtures.
const catalog={productId:250317,productLineId:3,marketPrice:999,skus:conditions.flatMap((condition,i)=>[
 {sku:5236151+i,condition,variant:'Holofoil',language:'English'},
 {sku:6236151+i,condition,variant:'Reverse Holofoil',language:'English'},
 {sku:7236151+i,condition,variant:'Holofoil',language:'Japanese'}])};
const prices=catalog.skus.map((s,i)=>({skuId:s.sku,marketPrice:i===14?0:1+i/10,lowestPrice:888,calculatedAt:new Date(now-DAY).toISOString()}));
const env={TCGPLAYER_WEB_TEST:'true',JUSTTCG_API_KEY:'synthetic-backup',CONDITION_DAILY_LIMIT:100,CONDITION_MINUTE_LIMIT:100};
function storage(){const rows=new Map();let chain=Promise.resolve();const s={rows,get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix))),getAlarm:async()=>1,setAlarm:async()=>{},transaction:fn=>{const p=chain.then(()=>fn(s));chain=p.catch(()=>{});return p;}};return s;}
function fixture({catalogue=catalog,quoteRows=prices,status=200,backupFails=false,html=false}={}){
 const calls=[];globalThis.fetch=async(url,opts={})=>{
  calls.push({url,opts});
  if(url.includes('api.justtcg.com'))return backupFails?Response.json({code:'EXCESSIVE_FREE_TIER_USAGE'},{status:429,headers:{'Retry-After':'3600'}}):Response.json({data:[{tcgplayerId:250317,variants:conditions.map((condition,i)=>({condition,printing:'Holofoil',language:'English',price:20+i,priceStatus:'current',lastUpdated:Math.floor(now/1000)}))}]});
  assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'manual');assert(!opts.headers.Authorization&&!opts.headers.Cookie&&!opts.headers['x-api-key']);
  if(status!==200)return Response.json({privateDiagnostic:'do not expose'},{status,headers:{'Retry-After':'120'}});
  if(html)return new Response('<html>Access check</html>',{headers:{'Content-Type':'text/html'}});
  if(url==='https://mp-search-api.tcgplayer.com/v2/product/250317/details')return Response.json(catalogue);
  assert.equal(url,'https://mpgateway.tcgplayer.com/v1/pricepoints/marketprice/skus/search');assert.equal(opts.method,'POST');assert.deepEqual(JSON.parse(opts.body).skuIds,catalog.skus.map(s=>s.sku));return Response.json(quoteRows);
 };return calls;
}
const call=cache=>cache.fetch(new Request('https://cache/?product=250317&category=3')).then(r=>r.json());
try{
 const s=storage(),calls=fixture(),cache=new ConditionPriceCache({storage:s},env);
 const results=await Promise.all(Array.from({length:8},()=>call(cache)));assert.equal(calls.length,2,'Concurrent viewers share one catalog and one all-condition batch');
 const q=normalizeConditionVariants(results[0],250317,['Holofoil'],'English');assert.equal(q.length,5);assert.deepEqual(q.map(v=>v.price),[1,1.3,1.6,1.9,2.2]);assert(q.every(v=>v.method==='public-web-test'&&v.calculatedAt===prices[0].calculatedAt&&!v.observedAt));
 assert(q.every(v=>v.priceType==='market-reference'&&v.retrievalMethod==='structured'));
 const sourceURL=new URL(q[1].sourceUrl);assert.equal(sourceURL.pathname,'/product/250317');assert.equal(sourceURL.searchParams.get('Language'),'English');assert.equal(sourceURL.searchParams.get('Printing'),'Holofoil');assert.equal(sourceURL.searchParams.get('Condition'),'Lightly Played');
 assert.equal(normalizeConditionVariants(results[0],250317,['Holofoil'],'Japanese').at(-1).price,0);assert.equal(normalizeConditionVariants(results[0],250317,['Foil'],'English').length,0);
 await call(new ConditionPriceCache({storage:s},env));assert.equal(calls.length,2,'Durable prices survive isolate restart');assert(!JSON.stringify(s.rows.get('tcg-web-catalog:250317')).includes('marketPrice'),'Product-wide market price is not persisted as a condition quote');
 const card={id:'cel25-22',variants:[{key:'holofoil',finish:'holofoil',productId:250317}]},entry={cardId:card.id,variant:'holofoil',condition:'Moderately Played',language:'English'};applyConditionQuotes(card,entry,q);assert.equal(conditionValue(null,entry,card.conditionQuotes).price,1.6);assert.equal(conditionValue(null,{...entry,language:'Japanese'},card.conditionQuotes).price,null);
 assert.match(conditionPriceHtml(1.6,entry,card.conditionQuotes),/calculated .*checked/);
 clearConditionAttempts();let browserCalls=0;await loadConditionQuotes(card,entry,'ptcg',async()=>{browserCalls++;return Response.json({status:'available',quotes:q});});assert.equal(loadConditionQuotes(card,{...entry,condition:'Lightly Played'},'ptcg',()=>{throw Error('Dropdown made a network call');}),null);assert.equal(browserCalls,1);
 now+=DAY+1;await call(cache);assert.equal(calls.length,3,'Daily refresh needs only one price batch, not the catalog');

 const partial=fixture({quoteRows:prices.filter(p=>p.skuId!==5236153)}),mixed=await call(new ConditionPriceCache({storage:storage()},env));const mixedQuotes=normalizeConditionVariants(mixed,250317,['Holofoil']);assert.equal(mixedQuotes.find(q=>q.condition==='Moderately Played').source,'JustTCG');assert.equal(mixedQuotes[0].source,'TCGplayer');assert.equal(partial.length,3);
 const badCases=[{skuId:5236151,marketPrice:null},{skuId:5236151,marketPrice:'10'},{skuId:5236151,marketPrice:-1},{skuId:5236151,marketPrice:2,calculatedAt:'bad'},{skuId:5236151,marketPrice:2,calculatedAt:new Date(now+DAY).toISOString()}];
 for(const row of badCases)assert.equal(webConditionVariants(250317,{...catalog,skus:[catalog.skus[0]]},[row],now).variants.length,0);
 assert.equal(webConditionVariants(250317,{...catalog,skus:[catalog.skus[0]]},[prices[0],prices[0]],now).variants.length,0);assert.equal(webConditionVariants(250317,{...catalog,skus:[catalog.skus[0],catalog.skus[0]]},[prices[0]],now).variants.length,0);
 const wrongCalls=fixture({catalogue:{...catalog,productLineId:1}});assert.equal((await call(new ConditionPriceCache({storage:storage()},env))).status,'unmapped');assert.equal(wrongCalls.length,1,'Wrong game cannot borrow fallback prices');
 const htmlCalls=fixture({html:true}),htmlStorage=storage();const htmlResult=await new TcgplayerWebSource(htmlStorage,env).load(250317,3);assert.equal(htmlResult.status,'unavailable');assert.equal(htmlCalls.length,1);
 assert.equal((await new TcgplayerWebSource(htmlStorage,env).load(250317,3)).nextRetryAt,htmlResult.nextRetryAt);assert.equal(htmlCalls.length,1,'Failed content is shared across isolate restarts for one minute');
 now+=60001;await new TcgplayerWebSource(htmlStorage,env).load(250317,3);assert.equal(htmlCalls.length,2,'A bounded explicit retry is possible after the failure expires');
 for(const status of [401,403,429]){
  const paused=storage(),requests=fixture({status}),reader=new TcgplayerWebSource(paused,env),first=await reader.load(250317,3,true);assert.equal(first.reason,status===429?'tcgplayer_rate':'tcgplayer_web_access');await reader.load(250317,3,true);assert.equal(requests.length,1,'Even owner honors provider refusal/cooldown');assert(!JSON.stringify(first).includes('privateDiagnostic'));
 }
 const noBudget=fixture();assert.equal((await new TcgplayerWebSource(storage(),{...env,CONDITION_DAILY_LIMIT:0}).load(250317,3)).reason,'app_budget');assert.equal(noBudget.length,0);
 const pausedBackup=storage();pausedBackup.rows.set('usage',{blockedUntil:now+DAY,blockedReason:'provider_shared_limit'});fixture();assert.equal((await call(new ConditionPriceCache({storage:pausedBackup},env))).source,'TCGplayer','JustTCG pause does not stop a separate working source');
 const stale=storage();fixture();const staleCache=new ConditionPriceCache({storage:stale},env),old=await call(staleCache);now+=DAY+1;fixture({status:403,backupFails:true});const unavailable=await call(staleCache),oldQuotes=normalizeConditionVariants(unavailable,250317,['Holofoil'],'English');assert(oldQuotes.every(q=>q.priceStatus==='last_known'));assert.equal(oldQuotes[0].checkedAt,new Date(old.cachedAt).toISOString());const oldCard={};applyConditionQuotes(oldCard,entry,oldQuotes);assert.equal(conditionValue(null,entry,oldCard.conditionQuotes).price,null);assert(lastKnownConditionQuote(entry,oldCard.conditionQuotes));

 // Exercise the actual canonical route without either provider's developer key.
 fixture();const routeEnv={TCGPLAYER_WEB_TEST:'true'},routeCache=new ConditionPriceCache({storage:storage()},routeEnv);routeEnv.CONDITION_PRICES={idFromName:n=>n,get:()=>({fetch:(u,o)=>routeCache.fetch(new Request(u,o))})};
 const route=await conditionFeedRoute(new URL('https://app/api/prices/conditions?game=ptcg&id=cel25-22&variant=holofoil'),routeEnv,null,async()=>Response.json({id:'cel25-22',pricing:{tcgplayer:{holofoil:{productId:250317}}}}));assert.equal((await route.json()).quotes.length,5);
 console.log('PASS: public-page SKU matching, no credentials, exact condition/finish/language isolation, shared batching/cache, real route, calculation dates, partial fallback, refused/challenged response handling and stale values.');
}finally{globalThis.fetch=originalFetch;Date.now=clock;clearConditionAttempts();}
