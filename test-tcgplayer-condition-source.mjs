import assert from 'node:assert/strict';
import {ConditionPriceCache} from './condition-cache.js';
import {TcgplayerConditionSource,tcgplayerVariants} from './tcgplayer-condition-source.js';
import {normalizeConditionVariants,conditionFeedRoute} from './condition-feed-route.js';
import {applyConditionQuotes,clearConditionAttempts,loadConditionQuotes} from './condition-feed.js';
import {conditionValue,conditionPriceHtml,lastKnownConditionQuote} from './condition-value.js';

const DAY=86400000,clock=Date.now,originalFetch=globalThis.fetch;let now=clock();Date.now=()=>now;
const conditions=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];
const catalog={conditions:conditions.map((name,i)=>({conditionId:i+1,name})),printings:[{printingId:11,name:'Holofoil'},{printingId:12,name:'Reverse Holofoil'}],languages:[{languageId:1,name:'English'},{languageId:7,name:'Japanese'}]};
const skus=catalog.languages.flatMap(l=>catalog.printings.flatMap(p=>catalog.conditions.map(c=>({skuId:l.languageId*1000+p.printingId*10+c.conditionId,productId:89828,conditionId:c.conditionId,printingId:p.printingId,languageId:l.languageId}))));
const prices=skus.map((s,i)=>({skuId:s.skuId,marketPrice:i===4?0:50-i,lowPrice:999,lowestShipping:777}));
const env={TCGPLAYER_PUBLIC_KEY:'synthetic-public',TCGPLAYER_PRIVATE_KEY:'synthetic-private',JUSTTCG_API_KEY:'synthetic-backup',CONDITION_DAILY_LIMIT:1000,CONDITION_MONTHLY_LIMIT:1000,CONDITION_MINUTE_LIMIT:1000};
function storage(){const rows=new Map();let chain=Promise.resolve();const s={rows,get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),delete:async k=>rows.delete(k),list:async({prefix})=>new Map([...rows].filter(([k])=>k.startsWith(prefix))),getAlarm:async()=>1,setAlarm:async()=>{},transaction:fn=>{const job=chain.then(()=>fn(s));chain=job.catch(()=>{});return job;}};return s;}
function fixture({partial=false,tcgFailure=0,backupFailure=false,wrongCategory=false,backupPrinting='Holofoil'}={}){
 const calls=[];globalThis.fetch=async(url,opts={})=>{
  calls.push({url,method:opts.method||'GET'});
  if(url.includes('api.justtcg.com'))return backupFailure?Response.json({code:'EXCESSIVE_FREE_TIER_USAGE'},{status:429,headers:{'Retry-After':'60'}}):Response.json({data:[{tcgplayerId:89828,variants:conditions.map((condition,i)=>({condition,printing:backupPrinting,language:'English',price:20-i,priceStatus:'current',lastUpdated:Math.floor(now/1000)}))}]});
  assert(url.startsWith('https://api.tcgplayer.com/'));assert.equal(opts.redirect,'manual');
  if(url.endsWith('/token')){assert.equal(new URLSearchParams(opts.body).get('client_secret'),'synthetic-private');return Response.json({access_token:'synthetic-token',expires_in:3600});}
  assert.equal(opts.headers.Authorization,'Bearer synthetic-token');
  if(tcgFailure)return Response.json({rawSecret:'must never escape'},{status:tcgFailure,headers:{'Retry-After':'120'}});
  let results;
  if(url.endsWith('/catalog/products/89828'))results=[{productId:89828,categoryId:wrongCategory?1:3}];
  else if(url.endsWith('/skus'))results=skus;
  else if(url.includes('/pricing/sku/')){const ids=url.split('/').at(-1).split(',');assert.equal(ids.length,skus.length,'All conditions/printings/languages in one market batch');results=prices.filter(p=>!partial||p.skuId!==skus[2].skuId);return Response.json({success:!partial,errors:partial?['One SKU missing']:[],results},{status:partial?207:200});}
  else for(const key of ['conditions','printings','languages'])if(url.endsWith('/'+key))results=catalog[key];
  assert(results,'Unexpected request: '+url);return Response.json({success:true,errors:[],results});
 };return calls;
}
const call=(cache,category=3)=>cache.fetch(new Request('https://cache/?product=89828&category='+category)).then(r=>r.json());
try{
 // Same product across simultaneous clients, dropdown choices and isolate restarts.
 const s=storage(),calls=fixture(),cache=new ConditionPriceCache({storage:s},env);
 const replies=await Promise.all(Array.from({length:8},()=>call(cache)));
 assert(replies.every(r=>r.source==='TCGplayer'));assert.equal(calls.length,7);assert.equal(calls.filter(c=>c.url.includes('justtcg')).length,0);
 const initial=calls.length;await call(new ConditionPriceCache({storage:s},env));assert.equal(calls.length,initial,'Durable product prices survive a new isolate');
 const q=normalizeConditionVariants(replies[0],89828,['Holofoil'],'English');assert.deepEqual(q.map(x=>x.price),[50,49,48,47,0]);assert(q.every(x=>x.source==='TCGplayer'&&!x.observedAt&&x.checkedAt));
 assert.deepEqual(normalizeConditionVariants(replies[0],89828,['Etched'],'English'),[]);assert.notEqual(normalizeConditionVariants(replies[0],89828,['Holofoil'],'Japanese')[0].price,q[0].price);
 const entry={cardId:'ex4-10',variant:'holofoil',condition:'Moderately Played'},card={id:'ex4-10'};applyConditionQuotes(card,entry,q);
 assert.equal(conditionValue(null,entry,card.conditionQuotes).price,48);assert.equal(conditionValue(null,{...entry,variant:'reverse-holofoil'},card.conditionQuotes).price,null);
 const html=conditionPriceHtml(48,entry,card.conditionQuotes);assert.match(html,/checked .*source observation date unavailable/);assert.doesNotMatch(html,/last observed|999|777/);
 clearConditionAttempts();let network=0;await loadConditionQuotes(card,entry,'ptcg',async()=>{network++;return Response.json({status:'available',quotes:q});});assert.equal(loadConditionQuotes(card,{...entry,condition:'Damaged'},'ptcg',()=>{throw Error('Must stay local');}),null);assert.equal(network,1);
 now+=DAY+1;const before=calls.length;await call(cache);assert.equal(calls.length-before,2,'A day later only token refresh and one SKU batch; catalog stays weekly');

 // Partial market results fall back per exact condition; primary still wins ties.
 now=clock();const partialCalls=fixture({partial:true}),partial=await call(new ConditionPriceCache({storage:storage()},env));
 const mixed=normalizeConditionVariants(partial,89828,['Holofoil'],'English');assert.equal(mixed[0].source,'TCGplayer');assert.equal(mixed.find(x=>x.condition==='Moderately Played').price,18);assert.equal(mixed.find(x=>x.condition==='Moderately Played').source,'JustTCG');assert.equal(partialCalls.filter(c=>c.url.includes('justtcg')).length,1);

 // A failing primary cannot reveal provider responses or bypass provider backoff.
 const pausedStorage=storage(),failedCalls=fixture({tcgFailure:429}),pausedCache=new ConditionPriceCache({storage:pausedStorage},env);const fallback=await call(pausedCache);assert.equal(normalizeConditionVariants(fallback,89828,['Holofoil'])[0].source,'JustTCG');const afterFailure=failedCalls.length;await call(pausedCache);assert.equal(failedCalls.length,afterFailure);assert(!JSON.stringify(fallback).includes('must never escape'));assert(pausedStorage.rows.get('tcgplayer-pause').nextRetryAt>now);
 // JustTCG's pause never prevents a separately authorized TCGplayer lookup.
 const blocked=storage();blocked.rows.set('usage',{blockedUntil:now+DAY,blockedReason:'provider_shared_limit'});fixture();assert.equal((await call(new ConditionPriceCache({storage:blocked},env))).source,'TCGplayer');assert.equal(blocked.rows.get('usage').blockedUntil,now+DAY);
 const wrongCalls=fixture({wrongCategory:true});assert.equal((await call(new ConditionPriceCache({storage:storage()},env))).status,'unmapped');assert(!wrongCalls.some(c=>c.url.includes('justtcg')),'A category mismatch does not borrow fallback prices');

 // No configured primary means zero TCGplayer requests, unchanged backup behavior.
 const onlyBackup=fixture();await call(new ConditionPriceCache({storage:storage()},{JUSTTCG_API_KEY:'fixture'}));assert.equal(onlyBackup.length,1);assert(onlyBackup[0].url.includes('justtcg'));
 const noBudgetCalls=fixture();const noBudget=await call(new ConditionPriceCache({storage:storage()},{...env,CONDITION_DAILY_LIMIT:0}));assert.equal(noBudget.reason,'app_budget');assert.equal(noBudgetCalls.length,0,'Both sources honor shared app caps');

 // A stale primary must lose to fresh fallback and retain its checked date.
 const staleStorage=storage();fixture();const staleCache=new ConditionPriceCache({storage:staleStorage},env),fresh=await call(staleCache);now+=DAY+1;fixture({tcgFailure:429});const oldWithFreshBackup=await call(staleCache);assert.equal(normalizeConditionVariants(oldWithFreshBackup,89828,['Holofoil'])[0].source,'JustTCG');
 fixture({backupFailure:true});staleStorage.rows.delete('product:89828');const oldOnly=await call(staleCache),oldQuotes=normalizeConditionVariants(oldOnly,89828,['Holofoil']);assert(oldQuotes.every(x=>x.priceStatus==='last_known'));assert.equal(oldQuotes[0].checkedAt,new Date(fresh.cachedAt).toISOString());const oldCard={};applyConditionQuotes(oldCard,entry,oldQuotes);assert.equal(conditionValue(null,entry,oldCard.conditionQuotes).price,null);assert(lastKnownConditionQuote(entry,oldCard.conditionQuotes));

 // Provider-expired prices are last known, never current, and retain observation.
 const expired=normalizeConditionVariants({data:[{tcgplayerId:89828,variants:[{condition:'Moderately Played',printing:'Holofoil',price:null,lastKnownPrice:12,priceStatus:'expired',lastUpdated:Math.floor((now-15*DAY)/1000)}]}]},89828,['Holofoil']);assert.equal(expired[0].price,12);assert.equal(expired[0].priceStatus,'last_known');
 const duplicate=tcgplayerVariants(89828,[skus[0]], [prices[0],prices[0]],catalog,now);assert.deepEqual(duplicate.variants,[]);assert.equal(duplicate.complete,false);

 // TCGplayer-only deployment is accepted by the real identity route.
 const routeEnv={TCGPLAYER_PUBLIC_KEY:'fixture',TCGPLAYER_PRIVATE_KEY:'fixture',CONDITION_PRICES:{idFromName:n=>n,get:()=>({fetch:async u=>{assert.equal(new URL(u).searchParams.get('category'),'3');return Response.json({...fresh,cachedAt:now});}})}};
 const route=await conditionFeedRoute(new URL('https://app/api/prices/conditions?game=ptcg&id=ex4-10&variant=holofoil'),routeEnv,null,async()=>Response.json({id:'ex4-10',pricing:{tcgplayer:{holofoil:{productId:89828}}}}));assert.equal((await route.json()).quotes.length,5);
 // A successfully fetched product can still lack the selected finish entirely.
 const coverageCalls=fixture({backupPrinting:'Normal'}),coverageCache=new ConditionPriceCache({storage:storage()},env),coverageEnv={...env,CONDITION_PRICES:{idFromName:n=>n,get:()=>({fetch:(url,options)=>coverageCache.fetch(new Request(url,options))})}};
 const selectedUrl=new URL('https://app/api/prices/conditions?game=ptcg&id=ex4-10&variant=normal'),identity=async()=>Response.json({id:'ex4-10',pricing:{tcgplayer:{normal:{productId:89828}}}});
 const coverage=await (await conditionFeedRoute(selectedUrl,coverageEnv,null,identity)).json();assert.equal(coverage.quotes.length,5);assert(coverage.quotes.every(q=>q.source==='JustTCG'));assert.equal(coverageCalls.length,8,'One primary batch and one shared backup product, not one call per condition');
 await conditionFeedRoute(selectedUrl,coverageEnv,null,identity);assert.equal(coverageCalls.length,8,'The selection fallback also reuses both shared caches');
 console.log('PASS: official batched SKU matching, all-condition reuse, shared durable primary cache, exact partial fallback, isolated provider pauses, shared caps, no credential leakage, honest timestamps and stale-price isolation.');
}finally{globalThis.fetch=originalFetch;Date.now=clock;clearConditionAttempts();}
