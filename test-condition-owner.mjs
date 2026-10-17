import assert from 'node:assert/strict';
import {conditionOwner,conditionFeedRoute} from './condition-feed-route.js';
import {ConditionPriceCache} from './condition-cache.js';
import {configureConditionAuth,clearConditionAttempts,loadConditionQuotes} from './condition-feed.js';
const env={CONDITION_OWNER_ID:'owner-id',SUPABASE_URL:'https://auth.example.test',SUPABASE_ANON_KEY:'public-key'};
const request=new Request('https://app/api/prices/conditions',{headers:{Authorization:'Bearer signed-token'}});
let identity={id:'owner-id',email_confirmed_at:'2026-01-01',is_anonymous:false},checks=0;
const verify=async(url,opts)=>{checks++;assert.equal(url,'https://auth.example.test/auth/v1/user');assert.equal(opts.headers.Authorization,'Bearer signed-token');return Response.json(identity);};
assert.equal(await conditionOwner(request,env,verify),true);
for(const value of [{id:'other',email_confirmed_at:'yes',user_metadata:{owner:true}},{id:'owner-id'},{...identity,is_anonymous:true}]){identity=value;assert.equal(await conditionOwner(request,env,verify),false);}
assert.equal(await conditionOwner(request,env,async()=>new Response('',{status:401})),false);
assert.equal(await conditionOwner(new Request('https://app/?owner=true',{headers:{'X-Condition-Owner':'verified'}}),env,()=>{throw Error('must not fetch');}),false);
identity={id:'owner-id',email_confirmed_at:'2026-01-01',is_anonymous:false};
const routeEnv={...env,JUSTTCG_API_KEY:'fake',CONDITION_PRICES:{idFromName:n=>n,get:()=>({fetch:async(url,options)=>{assert.equal(options.headers['X-Condition-Owner'],'verified');return Response.json({status:'available',cachedAt:Date.now(),data:[{tcgplayerId:123,variants:['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'].map((condition,i)=>({condition,price:10-i,priceStatus:'current',printing:'Normal',language:'English',lastUpdated:Math.floor(Date.now()/1000)}))}]});}})}};
const routeResult=await (await conditionFeedRoute(new URL('https://app/api/prices/conditions?game=ptcg&id=fixture-1&variant=normal'),routeEnv,null,async(url,opts)=>url.includes('/auth/v1/user')?verify(url,opts):Response.json({id:'fixture-1',pricing:{tcgplayer:{normal:{productId:123}}}}),{request})).json();
assert.equal(routeResult.status,'available');assert.equal(routeResult.quotes.length,5,'owner route retains all exact condition estimates');
const rows=new Map(),storage={get:async k=>structuredClone(rows.get(k)),put:async(k,v)=>rows.set(k,structuredClone(v)),transaction:fn=>fn(storage),getAlarm:async()=>1};
const savedFetch=globalThis.fetch;let calls=0;
try{
 globalThis.fetch=async url=>{calls++;return Response.json({data:[{tcgplayerId:new URL(url).searchParams.get('tcgplayerId'),variants:[]}]});};
 const cache=new ConditionPriceCache({storage},{JUSTTCG_API_KEY:'fake',CONDITION_DAILY_LIMIT:0,CONDITION_MONTHLY_LIMIT:0,CONDITION_MINUTE_LIMIT:0});
 const call=async(id,owner=false)=>(await cache.fetch(new Request('https://cache/?product='+id,{headers:owner?{'X-Condition-Owner':'verified'}:{}}))).json();
 assert.equal((await call(1)).status,'rate_limited');assert.equal(calls,0);
 assert.equal((await call(1,true)).status,'available');assert.equal(calls,1,'verified owner bypasses all app caps');
 assert.equal((await call(1,true)).status,'available');assert.equal(calls,1,'owner still uses shared daily cache');
 rows.set('usage',{...rows.get('usage'),blockedUntil:Date.now()+60000});assert.equal((await call(2,true)).reason,'provider_rate');assert.equal(calls,1,'owner honors provider backoff');
}finally{globalThis.fetch=savedFetch;}
configureConditionAuth(async()=>'signed-token');clearConditionAttempts();
await loadConditionQuotes({id:'fixture'},{variant:'normal'},'ptcg',async(url,opts)=>{assert.equal(opts.headers.Authorization,'Bearer signed-token');return Response.json({status:'unpriced',quotes:[]});});
configureConditionAuth(async()=>'');clearConditionAttempts();
console.log('PASS: verified owner-only exemption, forged/anonymous/revoked denial, token forwarding, daily cache reuse and provider backoff.');
